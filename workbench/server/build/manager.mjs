import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { buildAdapter, usageFromEvents } from './adapter.mjs';
import { indexAttemptFiles } from './files.mjs';
import { finalizeLifecycle } from './finalize-lifecycle.mjs';
import { counterexampleDetected, parseCandidateReport, projectCaseStepCoverage } from './report.mjs';
import { BUILD_TEMPLATE_ID, loadBuildTemplate, loadProjectCaseEnvironment, taskDocument } from './template.mjs';
import { contentHash } from '../cases/excel.mjs';
import {
  assembleProjectCaseInput,
  renderProjectCaseAgentInstruction,
} from './project-case.mjs';
import { AUTH01_PROJECT_CASE_AUTHORIZATION_ID, E2E01_PROJECT_CASE_AUTHORIZATION_ID, M3B2_PROJECT_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID } from './store.mjs';
import { sha256File } from '../integrity.mjs';
import { redactText } from '../../../harness-probe/src/redact.mjs';
import { dshHomeSecrets, harnessStderrDiagnostic } from './diagnostic.mjs';
import { renderStepReplay } from './step-replay.mjs';

const MAX_TOOL_CALLS = 30;
const TIMEOUT_MS = 600_000;
const TRIAL_RUNNER_VERSION = 'e2e01-step-evidence-replay-v1';

const LIFECYCLE_FIELDS = new Set([
  'type', 'at', 'pid', 'parent_pid', 'bytes', 'exit_code', 'signal', 'reason', 'output_complete',
  'trailing_stdout_line', 'event_type', 'phase', 'tool', 'code', 'partial_observation',
]);

function taskId(now) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14).toLowerCase();
  return `build-${stamp}-${randomUUID().slice(0, 8).toLowerCase()}`;
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function projectCaseRequestIdentity(request) {
  if (typeof request?.project_id !== 'string' || typeof request.case_id !== 'string' ||
      !Number.isInteger(request.case_version) || request.case_version < 1 ||
      !/^[A-F0-9]{64}$/.test(request.content_sha256 || '') ||
      typeof request.environment_id !== 'string' || !request.environment_id) {
    throw new Error('CASE_BUILD_SELECTION_INVALID');
  }
  if (request.auth_role != null && (typeof request.auth_role !== 'string' || !/^[\w-]+$/.test(request.auth_role))) {
    throw new Error('CASE_BUILD_SELECTION_INVALID');
  }
  return {
    project_id: request.project_id,
    case_id: request.case_id,
    case_version: request.case_version,
    content_sha256: request.content_sha256,
    environment_id: request.environment_id,
    ...(request.auth_role != null ? { auth_role: request.auth_role } : {}),
  };
}

function requestFingerprint(identity) { return hashText(JSON.stringify(identity)); }

function persistedRequestFingerprint(task) {
  try {
    const identity = projectCaseRequestIdentity({
      project_id: task.source?.project_id,
      case_id: task.source?.case_id,
      case_version: task.source?.case_version,
      content_sha256: task.source?.content_sha256,
      environment_id: task.environment_ref?.environment_id,
      auth_role: task.auth_requirement?.role ?? null,
    });
    const derived = requestFingerprint(identity);
    const stored = task.source?.creation_request_fingerprint;
    if (stored != null && (!/^[A-F0-9]{64}$/.test(stored) || stored !== derived)) return null;
    return derived;
  } catch {
    return null;
  }
}

function projectCaseTaskScope(task) {
  return {
    project_id: task.source?.project_id,
    case_id: task.source?.case_id,
    case_version: task.source?.case_version,
    content_sha256: task.source?.content_sha256,
    environment_id: task.environment_ref?.environment_id,
    ...(task.auth_requirement?.role ? { auth_role: task.auth_requirement.role } : {}),
  };
}

function sameIdentity(left, right) { return requestFingerprint(projectCaseRequestIdentity(left)) === requestFingerprint(projectCaseRequestIdentity(right)); }

const E2E01_CASES = [
  { external_id: 'TC-001', paired_external_id: 'TC-004', environment_id: 'test-site-01-query-v1' },
  { external_id: 'TC-002', paired_external_id: 'TC-005', environment_id: 'test-site-01-sorting-v1' },
  { external_id: 'TC-003', paired_external_id: 'TC-006', environment_id: 'test-site-01-detail-v1' },
];

function normalizeTrialContent(content, route) {
  const copy = structuredClone(content);
  copy.external_id = '<registered-pair-id>';
  copy.title = copy.title.replace(`入口 ${route}`, '入口 <registered-route>');
  copy.test_data = copy.test_data.replace(`入口=http://127.0.0.1:4320${route}`, '入口=<registered-route>');
  return copy;
}

function e2eAuthorizationMatches(authorization, scope) {
  return authorization?.authorization_id === E2E01_PROJECT_CASE_AUTHORIZATION_ID &&
    authorization.project_id === scope.project_id && authorization.scopes.some((item) =>
      item.case_id === scope.case_id && item.external_id === scope.external_id &&
      item.case_version === scope.case_version && item.content_sha256 === scope.content_sha256 &&
      item.environment_id === scope.environment_id);
}

export function e2eTrialReadiness(candidate) {
  const runs = candidate?.trial_runs || [];
  const normal = runs.filter((run) => run.run_type === 'normal').at(-1);
  const negative = runs.filter((run) => run.run_type === 'negative').at(-1);
  const mediaReady = (run) => run.runner_version === TRIAL_RUNNER_VERSION
    ? run.step_replay?.status === 'READY' && run.step_replay?.evidence_complete === true && run.media_file_ids?.length >= 4
    : !run.runner_version && run.media_file_ids?.length === 3;
  return Boolean(normal && negative &&
    normal.candidate_sha256 === candidate.sha256 && negative.candidate_sha256 === candidate.sha256 &&
    normal.status === 'PASSED' && normal.complete_pass === true && normal.step_coverage?.complete === true &&
    negative.status === 'FAILED' && negative.complete_pass === false && negative.specified_defect_detected === true &&
    (normal.same_candidate_hash === true || (normal.same_candidate_hash == null && candidate.same_candidate_hash === true)) &&
    negative.same_candidate_hash === true &&
    !normal.technical_error && !negative.technical_error &&
    mediaReady(normal) && mediaReady(negative));
}

function lifecycleMetadata(event) {
  return Object.fromEntries(Object.entries(event || {}).filter(([key, value]) => LIFECYCLE_FIELDS.has(key) &&
    (value === null || ['string', 'number', 'boolean'].includes(typeof value))).map(([key, value]) => [
      key, typeof value === 'string' ? value.slice(0, 160) : value,
    ]));
}

function lineDiff(previous, current) {
  if (!previous) return { base: null, changed: false, lines: [] };
  const left = previous.split(/\r?\n/);
  const right = current.split(/\r?\n/);
  const lines = [];
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === right[index]) continue;
    lines.push({ line: index + 1, before: left[index] ?? null, after: right[index] ?? null });
    if (lines.length >= 80) break;
  }
  return { base: 'previous-candidate', changed: lines.length > 0, lines };
}

export function authTrialReadiness(candidate) {
  const runs = candidate?.trial_runs || [];
  return runs.some((run) => run.schema === 'workbench/auth01-case-run-v1' && !run.auth_block &&
    run.candidate_sha256 === candidate.sha256 && run.status === 'PASSED' && run.complete_pass === true &&
    run.step_coverage?.complete === true && run.same_candidate_hash === true && !run.technical_error);
}

function authSessionBlockError(block) {
  return {
    code: 'AUTH_SESSION_BLOCKED',
    message: `认证会话在活动期间失效（${block.reason}）；已停止关联操作，不补写未执行步骤，不以原始绿色结果覆盖。`,
    auth_block: structuredClone(block),
  };
}

export function promptFor({ kind, task, entryUrl, candidatePath }) {
  if (task.source?.kind === 'project-case') {
    const initial = renderProjectCaseAgentInstruction(task.input_bundle.agent_instruction_template, { entryUrl, candidatePath });
    const authPreamble = task.auth_requirement ? [
      'This is an authorized local synthetic authentication fixture. The operator has already logged in before this session started; the attached browser session is already authenticated.',
      `Navigate only to ${entryUrl} and observe the visible protected page as the already-authenticated account.`,
      'Do not perform login or logout, request or enter credentials, inspect browser cookies/tokens/session storage, access other sites, or alter the fixture account state.',
    ].join('\n') : null;
    if (kind === 'initial') return authPreamble ? `${authPreamble}\n${initial}` : initial;
    return [
      ...(authPreamble ? [authPreamble] : []),
      'Revise the failed Playwright candidate in this dedicated task workspace.',
      'Read task.md, input/case-snapshot.json, feedback.json, and input/candidate-v1.spec.mjs only.',
      'Fix only the actual normal-page failure or missing original-case step described in feedback.json.',
      'Do not change the frozen actions or expected results, remove assertions, swallow errors, skip work, or infer any counterexample.',
      initial.replace('Create one Playwright Test candidate', 'Write one revised Playwright Test candidate'),
    ].join('\n');
  }
  const template = task.template;
  const common = [
    `Use the Playwright MCP browser tools to open exactly ${entryUrl}.`,
    'Perform the interaction in task.md and observe the visible result.',
    `Write exactly one Playwright Test candidate to ${candidatePath}.`,
    'The candidate must use process.env.PROBE_URL and preserve the task-provided expected result.',
    'Do not derive or change the expected value from page content. Do not skip, swallow errors, remove the assertion, or add unrelated actions.',
    'Do not inspect parent directories, other repository files, accounts, external sites, or company systems. Do not create other files.',
  ];
  if (kind === 'revision') {
    return [
      'Revise one failed Playwright candidate in this dedicated task workspace.',
      'Read only task.md, feedback.json, and input/candidate-v1.spec.mjs as task inputs.',
      'Fix the technical cause described by the actual verification feedback without changing the original task.',
      ...common,
    ].join('\n');
  }
  return [
    'Create one Playwright candidate for the frozen structured task in this dedicated task workspace.',
    'Read task.md as the only task input.',
    ...common,
  ].join('\n');
}

export class BuildTaskManager {
  constructor(options) {
    this.store = options.store;
    this.caseStore = options.caseStore || null;
    this.paths = options.paths;
    this.adapter = options.adapter || buildAdapter;
    this.browserExecutable = options.browserExecutable || process.env.DSH_PROBE_BROWSER_EXECUTABLE;
    this.credentialProvider = options.credentialProvider || (() => ({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL,
    }));
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || (() => taskId(this.now()));
    this.otherActive = options.otherActive || (() => false);
    this.active = null;
    this.starting = false;
    this.completions = new Map();
    this.runtimeReady = null;
    this.serviceInstanceId = options.serviceInstanceId || `service-${randomUUID()}`;
    this.lifecycleSequences = new Map();
    this.storageFault = null;
    this.authorizationId = options.authorizationId || null;
    this.harnessDshHome = options.harnessDshHome || path.join(this.paths.buildRuntimeRoot, 'dsh');
    const configuredPatch = options.harnessPatchPath || path.join(this.paths.repoRoot, 'harness-probe', 'config', 'browser.cordis.yml');
    this.harnessPatchPath = path.isAbsolute(configuredPatch) ? configuredPatch : path.resolve(configuredPatch);
    this.useStoredDshCredentials = options.useStoredDshCredentials === true;
    this.modelConfiguration = options.modelConfiguration || null;
    this.caseSubmissions = new Map();
    this.authSessions = options.authSessions || null;
    this.authWatch = null;
    this.authSessions?.setInvalidationListener?.((state) => {
      const watch = this.authWatch;
      if (!watch || watch.detected) return;
      if (state.session_version === watch.version && state.project_id === watch.scope.project_id &&
          state.environment_id === watch.scope.environment_id && state.role === watch.scope.role) {
        this.#tripAuthInvalid(watch, state.reason || state.status || 'AUTH_SESSION_INVALIDATED', state.trigger || 'listener');
      }
    });
  }

  // 认证会话看守：活动 attempt/run 期间推送监听 + 每秒只读身份复核。
  // 只中止绑定了同一 scope 与 session_version 的本服务活动，不影响其他项目会话。
  #startAuthWatch(scope, version, controller) {
    this.#stopAuthWatch();
    const watch = { scope, version, controller, detected: null, timer: null, probing: false };
    const probe = async () => {
      if (watch.detected || watch.probing || controller.signal.aborted) return;
      watch.probing = true;
      try {
        const status = await this.authSessions.check(scope);
        if (status.status !== 'VALID' || status.session_version !== version) {
          this.#tripAuthInvalid(watch, status.reason || status.status || 'AUTH_SESSION_INVALIDATED', 'identity_check');
        }
      } catch { /* 下一次周期继续；check 自身已把不可用分类到会话状态。 */ }
      finally { watch.probing = false; }
    };
    watch.timer = setInterval(() => { void probe(); }, 1000);
    watch.timer.unref?.();
    this.authWatch = watch;
    return watch;
  }

  #tripAuthInvalid(watch, reason, trigger) {
    if (!watch || watch.detected || watch.controller.signal.aborted) return;
    watch.detected = { reason, trigger, detected_at: this.now().toISOString() };
    watch.controller.abort({ code: 'AUTH_SESSION_INVALIDATED', reason });
  }

  #stopAuthWatch() {
    if (this.authWatch?.timer) clearInterval(this.authWatch.timer);
    this.authWatch = null;
  }

  #authScopeFor(task) {
    if (!task?.auth_requirement) return null;
    return {
      project_id: task.source.project_id,
      environment_id: task.auth_requirement.environment_id,
      role: task.auth_requirement.role,
    };
  }

  // 启动前只读复核：未登录、身份不符或检查不可用时拒绝启动业务进程。
  async #bindAuthSession(task) {
    const scope = this.#authScopeFor(task);
    if (!scope) return null;
    if (!this.authSessions) throw new Error('AUTH_BUILD_UNAVAILABLE');
    const status = await this.authSessions.check(scope);
    if (status.status !== 'VALID') {
      const error = new Error('AUTH_SESSION_REQUIRED');
      error.auth_status = status.status;
      throw error;
    }
    return {
      scope, session_version: status.session_version, account_id: status.account_id,
      role: scope.role, bound_at: this.now().toISOString(),
    };
  }

  diagnostics() {
    return {
      service_instance_id: this.serviceInstanceId,
      storage_status: this.storageFault ? 'FAILED' : 'READY',
      storage_error: this.storageFault,
      authorization_id: this.authorizationId,
      trial_runner_version: TRIAL_RUNNER_VERSION,
    };
  }

  #assertWritable() {
    if (this.storageFault) throw new Error('BUILD_STORAGE_UNAVAILABLE');
  }

  #tripStorageFault(error, operation) {
    if (!this.storageFault) {
      this.storageFault = {
        code: error?.code || 'BUILD_STORAGE_FAILURE',
        operation,
        at: this.now().toISOString(),
      };
      console.error(JSON.stringify({ type: 'build_storage_failure', ...this.storageFault }));
    }
  }

  async #recordLifecycle(taskIdValue, attemptId, event) {
    const key = `${taskIdValue}:${attemptId}`;
    const sequence = (this.lifecycleSequences.get(key) || 0) + 1;
    this.lifecycleSequences.set(key, sequence);
    try {
      await this.store.appendLifecycle(taskIdValue, attemptId, {
        schema: 'workbench/build-lifecycle-event-v1',
        sequence,
        at: event.at || this.now().toISOString(),
        task_id: taskIdValue,
        attempt_id: attemptId,
        service_instance_id: this.serviceInstanceId,
        ...lifecycleMetadata(event),
      });
    } catch (error) {
      this.#tripStorageFault(error, 'append_lifecycle');
      const wrapped = new Error('BUILD_DIAGNOSTIC_STORAGE_FAILED');
      wrapped.code = error?.code || 'BUILD_DIAGNOSTIC_STORAGE_FAILED';
      throw wrapped;
    }
  }

  async templates() {
    const template = await loadBuildTemplate(this.paths);
    return [template.public];
  }

  async submit(templateId) {
    this.#assertWritable();
    if (templateId !== BUILD_TEMPLATE_ID) throw new Error('BUILD_TEMPLATE_NOT_ALLOWED');
    const template = await loadBuildTemplate(this.paths);
    const now = this.now().toISOString();
    const budget = await this.store.getBudget();
    const authorization = this.authorizationId ? await this.store.getRevalidationAuthorization() : null;
    if (this.authorizationId && (!authorization || authorization.authorization_id !== this.authorizationId || authorization.used_starts >= authorization.max_starts)) {
      throw new Error('BUILD_REVALIDATION_AUTHORIZATION_UNAVAILABLE');
    }
    return this.store.createTask({
      schema: 'workbench/build-task-v1',
      task_id: this.idFactory(),
      template: template.public,
      created_at: now,
      started_at: null,
      finished_at: null,
      task_status: 'SUBMITTED',
      generation_status: 'NOT_STARTED',
      verification_status: 'NOT_STARTED',
      human_review_status: 'NOT_READY',
      active_attempt_id: null,
      attempts: [],
      candidates: [],
      files: [],
      revision_allowed: false,
      budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts },
      authorization: authorization ? {
        authorization_id: authorization.authorization_id, kind: authorization.kind,
        max_starts: authorization.max_starts, used_starts: authorization.used_starts,
        linked_stage: authorization.linked_stage,
      } : null,
      runtime: { os_file_isolation: false, os_network_isolation: false, residual_risk_accepted: true },
      error: null,
    });
  }

  async submitProjectCase(request) {
    this.#assertWritable();
    const requestId = request?.request_id;
    if (!/^case-build-request-[a-z0-9-]{8,80}$/.test(requestId || '')) throw new Error('CASE_BUILD_REQUEST_ID_INVALID');
    const identity = projectCaseRequestIdentity(request);
    const fingerprint = requestFingerprint(identity);
    const active = this.caseSubmissions.get(requestId);
    if (active) {
      if (active.fingerprint !== fingerprint) throw new Error('CASE_BUILD_REQUEST_KEY_CONFLICT');
      return active.completion;
    }
    let record;
    const completion = this.#submitProjectCase(request, identity, fingerprint).finally(() => {
      if (this.caseSubmissions.get(requestId) === record) this.caseSubmissions.delete(requestId);
    });
    record = { fingerprint, completion };
    this.caseSubmissions.set(requestId, record);
    return completion;
  }

  async #submitProjectCase(request, identity, fingerprint) {
    if (!this.caseStore) throw new Error('CASE_BUILD_STORE_UNAVAILABLE');
    const existing = (await this.store.listTasks()).filter((task) => task.source?.creation_request_id === request.request_id);
    if (existing.length) {
      if (existing.some((task) => persistedRequestFingerprint(task) !== fingerprint)) {
        throw new Error('CASE_BUILD_REQUEST_KEY_CONFLICT');
      }
      return existing[0];
    }
    const environmentDefinition = await loadProjectCaseEnvironment(this.paths, identity.environment_id);
    const authEnvironment = Boolean(environmentDefinition.internal.auth01);
    if (authEnvironment) {
      if (!this.authSessions) throw new Error('AUTH_BUILD_UNAVAILABLE');
      if (!identity.auth_role) throw new Error('CASE_BUILD_SELECTION_INVALID');
      // 环境目录只承认登记过的角色；非秘密认证要求随任务身份与幂等指纹保存。
      this.authSessions.environment({ project_id: identity.project_id, environment_id: identity.environment_id, role: identity.auth_role });
    } else if (identity.auth_role) {
      throw new Error('CASE_BUILD_SELECTION_INVALID');
    }
    const project = await this.caseStore.getProject(identity.project_id);
    if (!project) throw new Error('CASE_PROJECT_NOT_FOUND');
    const item = project.cases.find((entry) => entry.case_id === identity.case_id);
    if (!item) throw new Error('CASE_NOT_FOUND');
    const versionRecord = item.versions.find((entry) => entry.version === identity.case_version);
    if (!versionRecord) throw new Error('CASE_BUILD_VERSION_NOT_FOUND');
    const calculatedHash = contentHash(versionRecord.content);
    if (calculatedHash !== versionRecord.content_sha256 || calculatedHash !== identity.content_sha256) {
      throw new Error('CASE_BUILD_CONTENT_HASH_MISMATCH');
    }
    let trialBinding = null;
    if (E2E01_CASES.some((entry) => entry.external_id === versionRecord.content.external_id)) {
      const group = E2E01_CASES.find((entry) => entry.external_id === versionRecord.content.external_id);
      if (identity.environment_id !== group.environment_id) throw new Error('E2E01_CASE_ENVIRONMENT_MISMATCH');
      const paired = project.cases.find((entry) => entry.external_id === group.paired_external_id);
      const pairedVersion = paired?.versions.find((entry) => entry.version === paired.current_version);
      const pairedRoute = `/${group.paired_external_id === 'TC-004' ? 'ui/b' : group.paired_external_id === 'TC-005' ? 'ui/d' : 'ui/f'}`;
      const sourceRoute = `/${group.external_id === 'TC-001' ? 'ui/a' : group.external_id === 'TC-002' ? 'ui/c' : 'ui/e'}`;
      if (!paired || !pairedVersion || pairedVersion.version !== identity.case_version ||
          JSON.stringify(normalizeTrialContent(versionRecord.content, sourceRoute)) !== JSON.stringify(normalizeTrialContent(pairedVersion.content, pairedRoute))) {
        throw new Error('E2E01_PAIRED_CASE_CONTENT_MISMATCH');
      }
      trialBinding = {
        schema: 'workbench/e2e01-paired-case-binding-v1', pair_group: group.environment_id,
        source: { case_id: item.case_id, external_id: group.external_id, case_version: versionRecord.version, content_sha256: calculatedHash, entry_route: sourceRoute },
        paired: { case_id: paired.case_id, external_id: group.paired_external_id, case_version: pairedVersion.version, content_sha256: pairedVersion.content_sha256, entry_route: pairedRoute },
      };
    }
    const steps = versionRecord.content?.steps;
    if (versionRecord.content?.status !== 'CONFIRMED') throw new Error('CASE_BUILD_CONTENT_NOT_CONFIRMED');
    if (!Array.isArray(steps) || !steps.length || steps.some((step, index) =>
      step?.order !== index + 1 || typeof step.action !== 'string' || !step.action.trim() ||
      typeof step.expected !== 'string' || !step.expected.trim())) {
      throw new Error('CASE_BUILD_STEPS_INCOMPLETE');
    }

    const now = this.now().toISOString();
    const assembled = assembleProjectCaseInput({
      project, item, versionRecord, environmentDefinition, frozenAt: now,
    });
    const budget = await this.store.getBudget();
    let authorization = this.authorizationId ? await this.store.getRevalidationAuthorization() : null;
    const projectCaseAuthorized = [M3B2_PROJECT_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID, E2E01_PROJECT_CASE_AUTHORIZATION_ID, AUTH01_PROJECT_CASE_AUTHORIZATION_ID].includes(this.authorizationId);
    if (projectCaseAuthorized) {
      if (!assembled.input_bundle.verification_contract) throw new Error('CASE_BUILD_VERIFICATION_BINDING_INVALID');
      const m4 = this.authorizationId === M4A_QUERY_CASE_AUTHORIZATION_ID;
      const flashRetry = this.authorizationId === M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID;
      const e2e01 = this.authorizationId === E2E01_PROJECT_CASE_AUTHORIZATION_ID;
      const auth01 = this.authorizationId === AUTH01_PROJECT_CASE_AUTHORIZATION_ID;
      if (e2e01 && !trialBinding) throw new Error('E2E01_CASE_NOT_AUTHORIZED');
      if (auth01 && !authEnvironment) throw new Error('AUTH01_ENVIRONMENT_REQUIRED');
      if (authEnvironment && !auth01) throw new Error('AUTH01_AUTHORIZATION_REQUIRED');
      const registeredAuthorization = e2e01 ? {
        schema: 'workbench/e2e01-build-authorization-v1', authorization_id: this.authorizationId,
        kind: 'initial-with-optional-revision', linked_stage: 'E2E-01', project_id: project.project_id,
        max_starts: 6, used_starts: 0, claims: [],
        scopes: E2E01_CASES.map((entry) => {
          const allowed = project.cases.find((candidate) => candidate.external_id === entry.external_id);
          const allowedVersion = allowed?.versions.find((candidate) => candidate.version === allowed.current_version);
          if (!allowed || allowed.current_version !== 1 || !allowedVersion || allowedVersion.content.status !== 'CONFIRMED') throw new Error('E2E01_PROJECT_CASE_SET_INVALID');
          return { project_id: project.project_id, case_id: allowed.case_id, external_id: entry.external_id, case_version: 1, content_sha256: allowedVersion.content_sha256, environment_id: entry.environment_id };
        }),
        limits: { max_tool_calls: MAX_TOOL_CALLS, timeout_ms: TIMEOUT_MS }, created_at: now,
      } : auth01 ? {
        schema: 'workbench/auth01-build-authorization-v1',
        authorization_id: this.authorizationId,
        kind: 'initial-with-optional-revision', linked_stage: 'AUTH-01',
        max_starts: 2, used_starts: 0, claims: [],
        scope: structuredClone(identity), limits: { max_tool_calls: MAX_TOOL_CALLS, timeout_ms: TIMEOUT_MS },
        created_at: now,
      } : {
        schema: 'workbench/build-project-case-authorization-v1',
        authorization_id: this.authorizationId,
        kind: m4 ? 'initial-with-optional-revision' : 'initial', linked_stage: m4 ? 'M4-A' : (flashRetry ? 'M4-A-FLASH-RETRY' : 'M3-B2'),
        max_starts: m4 ? 2 : 1, used_starts: 0, claims: [],
        scope: structuredClone(identity), limits: { max_tool_calls: MAX_TOOL_CALLS, timeout_ms: TIMEOUT_MS },
        created_at: now,
      };
      authorization = await this.store.registerProjectCaseAuthorization(registeredAuthorization);
      if (e2e01 && !e2eAuthorizationMatches(authorization, {
        ...identity, external_id: versionRecord.content.external_id,
      })) throw new Error('E2E01_CASE_NOT_AUTHORIZED');
    }
    const files = assembled.initial_files.map(({ content, ...descriptor }) => descriptor);
    return this.store.createTask({
      schema: 'workbench/build-task-v1', task_id: this.idFactory(), template: assembled.public_template,
      source: {
        ...assembled.source,
        creation_request_id: request.request_id,
        creation_request_fingerprint: fingerprint,
      },
      environment_ref: assembled.environment_ref, input_bundle: assembled.input_bundle,
      ...(trialBinding ? { trial_binding: trialBinding } : {}),
      ...(authEnvironment ? {
        auth_requirement: {
          schema: 'workbench/auth-build-requirement-v1',
          environment_id: identity.environment_id,
          role: identity.auth_role,
          account_requirement: 'ROLE_MATCH',
          template_id: assembled.environment_ref.template_id,
          template_version: assembled.environment_ref.template_version,
        },
      } : {}),
      execution_policy: projectCaseAuthorized
        ? { mode: [M4A_QUERY_CASE_AUTHORIZATION_ID, AUTH01_PROJECT_CASE_AUTHORIZATION_ID].includes(this.authorizationId) ? 'AUTHORIZED_INITIAL_OPTIONAL_REVISION' : 'SINGLE_AUTHORIZED_INITIAL', launch_enabled: true, reason: `${authorization.linked_stage.replace('-', '_')}_SCOPED_AUTHORIZATION` }
        : { mode: 'INPUT_ONLY', launch_enabled: false, reason: 'M3_B1_INPUT_ONLY' },
      created_at: now, started_at: null, finished_at: null,
      task_status: 'SUBMITTED', generation_status: 'NOT_STARTED', verification_status: 'NOT_STARTED',
      human_review_status: 'NOT_READY', active_attempt_id: null, attempts: [], candidates: [], files,
      revision_allowed: false,
      budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts },
      authorization: authorization ? {
        authorization_id: authorization.authorization_id, kind: authorization.kind,
        max_starts: authorization.max_starts, used_starts: authorization.used_starts,
        linked_stage: authorization.linked_stage, scope: authorization.scope ? structuredClone(authorization.scope) : (trialBinding ? { ...structuredClone(identity), external_id: versionRecord.content.external_id } : null),
      } : null,
      runtime: { os_file_isolation: false, os_network_isolation: false, residual_risk_accepted: true },
      error: null,
    }, assembled.initial_files);
  }

  async prepareRuntime() {
    if (!this.browserExecutable) throw new Error('BUILD_BROWSER_EXECUTABLE_REQUIRED');
    if (!this.runtimeReady) {
      this.runtimeReady = this.adapter.ensureHarnessRuntime(
        this.harnessDshHome,
        this.paths.workbenchRoot,
      ).catch((error) => { this.runtimeReady = null; throw error; });
    }
    return this.runtimeReady;
  }

  async start(taskId) { return this.#launch(taskId, 'initial'); }
  async revise(taskId) { return this.#launch(taskId, 'revision'); }

  async runProjectCaseTrial(taskId, request) {
    this.#assertWritable();
    if (this.starting || this.active || this.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
    this.starting = true;
    try {
      const task = await this.store.getTask(taskId);
      if (!task?.trial_binding || task.source?.kind !== 'project-case' || task.authorization?.authorization_id !== E2E01_PROJECT_CASE_AUTHORIZATION_ID || this.authorizationId !== E2E01_PROJECT_CASE_AUTHORIZATION_ID) throw new Error('E2E01_TRIAL_NOT_ALLOWED');
      const authorization = await this.store.getRevalidationAuthorization();
      if (!e2eAuthorizationMatches(authorization, task.authorization.scope)) throw new Error('E2E01_TRIAL_AUTHORIZATION_INVALID');
      const candidate = task.candidates.at(-1);
      if (!candidate || candidate.sha256 !== request?.candidate_sha256 || candidate.version !== request?.candidate_version) throw new Error('E2E01_CANDIDATE_IDENTITY_MISMATCH');
      const allowedCase = request.executed_external_id === task.trial_binding.source.external_id
        ? task.trial_binding.source
        : request.executed_external_id === task.trial_binding.paired.external_id ? task.trial_binding.paired : null;
      if (!allowedCase || request.case_id !== allowedCase.case_id || request.case_version !== allowedCase.case_version ||
          request.content_sha256 !== allowedCase.content_sha256) throw new Error('E2E01_EXECUTION_CASE_NOT_ALLOWED');
      const project = await this.caseStore.getProject(task.source.project_id);
      const caseItem = project?.cases.find((entry) => entry.case_id === allowedCase.case_id);
      const versionRecord = caseItem?.versions.find((entry) => entry.version === allowedCase.case_version);
      if (!versionRecord || contentHash(versionRecord.content) !== allowedCase.content_sha256) throw new Error('E2E01_EXECUTION_CASE_VERSION_MISMATCH');
      const candidatePath = path.join(this.store.taskDirectory(taskId), 'attempts', candidate.attempt_id, 'workspace', 'output', 'candidate.spec.mjs');
      if (await sha256File(candidatePath) !== candidate.sha256) throw new Error('E2E01_CANDIDATE_FILE_CHANGED');
      const runId = `run-${randomUUID()}`;
      const runType = request.executed_external_id === task.trial_binding.source.external_id ? 'normal' : 'negative';
      const template = await loadProjectCaseEnvironment(this.paths, task.environment_ref.environment_id);
      const fixtureUrl = runType === 'normal' ? template.internal.normalUrl : template.internal.pairedUrl;
      if (!fixtureUrl) throw new Error('E2E01_EXECUTION_ENTRY_UNAVAILABLE');
      const attemptRoot = path.join(this.store.taskDirectory(taskId), 'attempts', candidate.attempt_id);
      const runDirectory = path.join(attemptRoot, 'verification', runType, 'runs', runId);
      const controller = new AbortController();
      this.active = { taskId, attemptId: runId, controller, phase: 'TRIAL_RUNNING' };
      const startedAt = this.now().toISOString();
      const raw = await this.adapter.verifyCandidate({ candidatePath, browserExecutable: this.browserExecutable, fixtureUrl, runDirectory, signal: controller.signal,
        stepObservation: { run_id: runId, candidate_sha256: candidate.sha256, executed_external_id: allowedCase.external_id,
          executed_case_id: allowedCase.case_id, executed_case_version: allowedCase.case_version,
          executed_content_sha256: allowedCase.content_sha256 } });
      const verification = await parseCandidateReport(raw.reportPath, raw.process);
      const hashAfter = await sha256File(candidatePath);
      const stepCoverage = projectCaseStepCoverage(verification, task.input_bundle.verification_contract);
      const detected = runType === 'negative' && counterexampleDetected(verification, task.input_bundle.verification_contract);
      const replay = await renderStepReplay({ runDirectory, runId, candidateSha256: candidate.sha256,
        executedExternalId: allowedCase.external_id, executedCaseVersion: allowedCase.case_version,
        caseContent: versionRecord.content, coverage: stepCoverage, browserExecutable: this.browserExecutable });
      const indexed = await indexAttemptFiles({
        taskRoot: this.store.taskDirectory(taskId), attemptRoot, candidatePath,
        attemptId: candidate.attempt_id, runId, startIndex: task.files.length,
        alreadyIndexed: task.files.map((file) => file.relative_path),
      });
      const files = indexed.files.filter((file) => file.run_id === runId);
      const failure = verification.error?.type === 'ASSERTION_MISMATCH' ? verification.error : null;
      const failureMap = stepCoverage.items.find((item) => item.error_attributed);
      const storedAuthorization = await this.store.getRevalidationAuthorization();
      const revisionAllowed = runType === 'normal' && (!verification.complete_pass || !stepCoverage.complete) &&
        !task.attempts.some((attempt) => attempt.kind === 'revision') && storedAuthorization.used_starts < storedAuthorization.max_starts;
      const run = {
        schema: 'workbench/e2e01-case-run-v1', run_id: runId, run_type: runType,
        source_build_task_id: task.task_id, source_case_id: task.source.case_id,
        source_external_id: task.source.external_id, source_case_version: task.source.case_version,
        executed_case_id: allowedCase.case_id, executed_external_id: allowedCase.external_id,
        executed_case_version: allowedCase.case_version, executed_content_sha256: allowedCase.content_sha256,
        environment_id: task.environment_ref.environment_id, entry_route: allowedCase.entry_route,
        candidate_version: candidate.version, candidate_sha256: candidate.sha256,
        status: verification.test_status, complete_pass: verification.complete_pass,
        failure_step: failureMap?.marker || null, error: verification.error,
        step_coverage: stepCoverage, specified_defect_detected: detected,
        same_candidate_hash: hashAfter === candidate.sha256,
        media_file_ids: files.filter((file) => /_(?:screenshot|video|trace)$/.test(file.kind)).map((file) => file.file_id),
        step_replay: replay.replay, caption_timeline: { schema: 'workbench/trial-timeline-v1', status: 'UNAVAILABLE',
          run_id: runId, candidate_sha256: candidate.sha256, reason: 'ORIGINAL_VIDEO_STEP_TIME_NOT_CALIBRATED' },
        runner_version: TRIAL_RUNNER_VERSION,
        started_at: startedAt, finished_at: this.now().toISOString(), origin: 'WORKBENCH_CANDIDATE_TRIAL',
        technical_error: indexed.unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', files: indexed.unexpected }
          : replay.replay.status !== 'READY' || !replay.videoPath ? { code: 'STEP_REPLAY_UNAVAILABLE', reason: replay.replay.reason }
          : !replay.replay.evidence_complete ? { code: 'STEP_CAPTURE_INCOMPLETE', steps: replay.replay.missing_captures } : null,
      };
      if (!run.same_candidate_hash) throw new Error('E2E01_CANDIDATE_CHANGED_DURING_TRIAL');
      const ready = e2eTrialReadiness({ ...candidate, trial_runs: [...(candidate.trial_runs || []), run] });
      return await this.store.updateTask(taskId, (current) => ({
        ...current,
        task_status: ready ? 'WAITING_HUMAN_REVIEW' : 'WAITING_E2E_TRIALS',
        verification_status: ready ? 'TECHNICAL_VALIDATION_PASSED' : 'INCOMPLETE',
        human_review_status: ready ? 'WAITING_REVIEW' : 'NOT_READY',
        finished_at: this.now().toISOString(),
        candidates: current.candidates.map((item) => item.version === candidate.version ? {
          ...item, trial_runs: [...(item.trial_runs || []), run],
          ...(runType === 'normal' ? { normal: verification } : { negative: verification }),
          verification_status: ready ? 'TECHNICAL_VALIDATION_PASSED'
            : (runType === 'negative' ? 'PAIR_VALIDATION_FAILED'
              : verification.complete_pass && stepCoverage.complete ? 'NORMAL_PASSED_AWAITING_PAIR' : 'FAILED'),
          ...(runType === 'negative' ? { counterexample_detected: detected } : {}),
          error: runType === 'normal' ? (verification.error || (stepCoverage.complete ? null : { code: 'STEP_COVERAGE_INCOMPLETE' })) : item.error,
        } : item),
        files: [...current.files, ...files],
        revision_allowed: revisionAllowed,
      }));
    } finally {
      if (this.active?.taskId === taskId) this.active = null;
      this.starting = false;
    }
  }

  // AUTH-01 复跑：复用已登记候选，不调用模型；要求同 scope 当前 VALID 会话，
  // 运行记录绑定新的 session_version 与新的 run_id，历史阻塞记录保持不变。
  async runAuthTrial(taskId, request) {
    this.#assertWritable();
    if (this.starting || this.active || this.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
    this.starting = true;
    try {
      const task = await this.store.getTask(taskId);
      if (!task?.auth_requirement || task.source?.kind !== 'project-case' ||
          task.authorization?.authorization_id !== AUTH01_PROJECT_CASE_AUTHORIZATION_ID ||
          this.authorizationId !== AUTH01_PROJECT_CASE_AUTHORIZATION_ID) throw new Error('AUTH01_TRIAL_NOT_ALLOWED');
      const candidate = task.candidates.at(-1);
      if (!candidate || candidate.sha256 !== request?.candidate_sha256 || candidate.version !== request?.candidate_version) throw new Error('AUTH01_CANDIDATE_IDENTITY_MISMATCH');
      const candidatePath = path.join(this.store.taskDirectory(taskId), 'attempts', candidate.attempt_id, 'workspace', 'output', 'candidate.spec.mjs');
      if (await sha256File(candidatePath) !== candidate.sha256) throw new Error('AUTH01_CANDIDATE_FILE_CHANGED');
      // 启动前只读复核；未登录或身份不符时拒绝并返回 AUTH_SESSION_REQUIRED。
      const authBinding = await this.#bindAuthSession(task);
      const template = await loadProjectCaseEnvironment(this.paths, task.environment_ref.environment_id);
      const authStorageState = await this.authSessions.stateForExecution(authBinding.scope, authBinding.session_version);
      const runId = `run-${randomUUID()}`;
      const attemptRoot = path.join(this.store.taskDirectory(taskId), 'attempts', candidate.attempt_id);
      const runDirectory = path.join(attemptRoot, 'verification', 'auth', 'runs', runId);
      const controller = new AbortController();
      this.active = { taskId, attemptId: runId, controller, phase: 'TRIAL_RUNNING' };
      const watch = this.#startAuthWatch(authBinding.scope, authBinding.session_version, controller);
      const startedAt = this.now().toISOString();
      try {
        let raw = null;
        try {
          raw = await this.adapter.verifyCandidate({
            candidatePath, browserExecutable: this.browserExecutable, fixtureUrl: template.internal.normalUrl,
            runDirectory, signal: controller.signal, authStorageState,
            stepObservation: {
              run_id: runId, candidate_sha256: candidate.sha256,
              executed_external_id: task.source.external_id, executed_case_id: task.source.case_id,
              executed_case_version: task.source.case_version, executed_content_sha256: task.source.content_sha256,
            },
          });
        } catch (error) {
          if (!watch.detected) throw error;
        }
        const verification = await parseCandidateReport(path.join(runDirectory, 'playwright-report.json'),
          raw?.process || { exitCode: null, termination: 'auth_session_blocked' });
        const hashAfter = await sha256File(candidatePath);
        const stepCoverage = projectCaseStepCoverage(verification, task.input_bundle.verification_contract);
        const replay = await renderStepReplay({
          runDirectory, runId, candidateSha256: candidate.sha256,
          executedExternalId: task.source.external_id, executedCaseVersion: task.source.case_version,
          caseContent: task.input_bundle.snapshot.content, coverage: stepCoverage, browserExecutable: this.browserExecutable,
        });
        const indexed = await indexAttemptFiles({
          taskRoot: this.store.taskDirectory(taskId), attemptRoot, candidatePath,
          attemptId: candidate.attempt_id, runId, startIndex: task.files.length,
          alreadyIndexed: task.files.map((file) => file.relative_path),
        });
        const files = indexed.files.filter((file) => file.run_id === runId);
        const blocked = Boolean(watch.detected);
        const run = {
          schema: 'workbench/auth01-case-run-v1', run_id: runId, run_type: 'auth-reexecution',
          source_build_task_id: task.task_id, source_case_id: task.source.case_id,
          source_external_id: task.source.external_id, source_case_version: task.source.case_version,
          executed_case_id: task.source.case_id, executed_external_id: task.source.external_id,
          executed_case_version: task.source.case_version, executed_content_sha256: task.source.content_sha256,
          environment_id: task.environment_ref.environment_id, entry_route: '/protected',
          candidate_version: candidate.version, candidate_sha256: candidate.sha256,
          status: verification.test_status, complete_pass: blocked ? false : verification.complete_pass,
          failure_step: stepCoverage.items.find((item) => item.error_attributed)?.marker || null,
          error: verification.error,
          step_coverage: stepCoverage, same_candidate_hash: hashAfter === candidate.sha256,
          auth: {
            environment_id: authBinding.scope.environment_id, role: authBinding.scope.role,
            account_id: authBinding.account_id, session_version: authBinding.session_version,
            bound_at: authBinding.bound_at,
          },
          auth_block: blocked ? { ...watch.detected, stopped_at: this.now().toISOString() } : null,
          media_file_ids: files.filter((file) => /_(?:screenshot|video|trace)$/.test(file.kind)).map((file) => file.file_id),
          step_replay: replay.replay,
          runner_version: TRIAL_RUNNER_VERSION,
          started_at: startedAt, finished_at: this.now().toISOString(), origin: 'WORKBENCH_CANDIDATE_TRIAL',
          technical_error: blocked ? null
            : indexed.unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', files: indexed.unexpected }
            : replay.replay.status !== 'READY' ? { code: 'STEP_REPLAY_UNAVAILABLE', reason: replay.replay.reason } : null,
        };
        if (!run.same_candidate_hash) throw new Error('AUTH01_CANDIDATE_CHANGED_DURING_TRIAL');
        const ready = authTrialReadiness({ ...candidate, trial_runs: [...(candidate.trial_runs || []), run] });
        return await this.store.updateTask(taskId, (current) => ({
          ...current,
          task_status: ready ? 'WAITING_HUMAN_REVIEW' : current.task_status,
          verification_status: ready ? 'TECHNICAL_VALIDATION_PASSED' : current.verification_status,
          human_review_status: ready ? 'WAITING_REVIEW' : current.human_review_status,
          finished_at: this.now().toISOString(),
          candidates: current.candidates.map((item) => item.version === candidate.version ? {
            ...item, trial_runs: [...(item.trial_runs || []), run],
            ...(ready ? { verification_status: 'TECHNICAL_VALIDATION_PASSED' } : {}),
          } : item),
          files: [...current.files, ...files],
        }));
      } finally {
        this.#stopAuthWatch();
      }
    } finally {
      if (this.active?.taskId === taskId) this.active = null;
      this.starting = false;
    }
  }

  async reconcileE2E01Task(taskId) {
    this.#assertWritable();
    if (this.active || this.starting) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
    const task = await this.store.getTask(taskId);
    if (!task?.trial_binding || task.authorization?.authorization_id !== E2E01_PROJECT_CASE_AUTHORIZATION_ID ||
        this.authorizationId !== E2E01_PROJECT_CASE_AUTHORIZATION_ID) throw new Error('E2E01_TRIAL_NOT_ALLOWED');
    const candidate = task.candidates.at(-1);
    if (!candidate) throw new Error('E2E01_CANDIDATE_IDENTITY_MISMATCH');
    const candidatePath = path.join(this.store.taskDirectory(taskId), 'attempts', candidate.attempt_id, 'workspace', 'output', 'candidate.spec.mjs');
    if (await sha256File(candidatePath) !== candidate.sha256) throw new Error('E2E01_CANDIDATE_FILE_CHANGED');
    if (!e2eTrialReadiness(candidate)) throw new Error('E2E01_TRIALS_INCOMPLETE');
    return this.store.updateTask(taskId, (current) => ({
      ...current, task_status: 'WAITING_HUMAN_REVIEW', verification_status: 'TECHNICAL_VALIDATION_PASSED',
      human_review_status: 'WAITING_REVIEW',
      candidates: current.candidates.map((item) => item.version === candidate.version
        ? { ...item, verification_status: 'TECHNICAL_VALIDATION_PASSED' } : item),
    }));
  }

  async #launch(taskIdValue, kind) {
    this.#assertWritable();
    if (this.starting || this.active || this.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
    this.starting = true;
    try {
      const task = await this.store.getTask(taskIdValue);
      if (!task) throw new Error('BUILD_TASK_NOT_FOUND');
      if (task.execution_policy?.launch_enabled === false) throw new Error('BUILD_INPUT_ONLY_TASK_NOT_STARTABLE');
      if (kind === 'initial' && (task.task_status !== 'SUBMITTED' || task.attempts.length)) throw new Error('BUILD_INITIAL_NOT_ALLOWED');
      if (kind === 'revision' && (!task.revision_allowed || task.attempts.some((item) => item.kind === 'revision'))) throw new Error('BUILD_REVISION_NOT_ALLOWED');
      const revalidationId = task.authorization?.authorization_id || null;
      const m4Authorization = revalidationId === M4A_QUERY_CASE_AUTHORIZATION_ID;
      const e2e01Authorization = revalidationId === E2E01_PROJECT_CASE_AUTHORIZATION_ID;
      const auth01Authorization = revalidationId === AUTH01_PROJECT_CASE_AUTHORIZATION_ID;
      if (revalidationId && (revalidationId !== this.authorizationId || (!m4Authorization && !e2e01Authorization && !auth01Authorization && kind !== 'initial'))) throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
      if (e2e01Authorization && kind === 'revision' && (!task.trial_binding || task.attempts.filter((item) => item.kind === 'revision').length)) throw new Error('BUILD_REVISION_NOT_ALLOWED');
      if (revalidationId) {
        const authorization = await this.store.getRevalidationAuthorization();
        if (!authorization || authorization.authorization_id !== revalidationId || authorization.used_starts >= authorization.max_starts) {
          throw new Error('BUILD_REVALIDATION_AUTHORIZATION_EXHAUSTED');
        }
        if ([M3B2_PROJECT_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID, AUTH01_PROJECT_CASE_AUTHORIZATION_ID].includes(revalidationId) &&
            (task.source?.kind !== 'project-case' || !sameIdentity(authorization.scope, projectCaseTaskScope(task)))) {
          throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
        }
        if (e2e01Authorization && !e2eAuthorizationMatches(authorization, { ...projectCaseTaskScope(task), external_id: task.source?.external_id })) {
          throw new Error('BUILD_REVALIDATION_AUTHORIZATION_INVALID');
        }
      }
      // 认证任务在消耗任何预算/授权之前做启动前只读身份复核：
      // 未登录、身份不符或检查不可用时拒绝启动业务进程（不记为业务失败）。
      const authBinding = await this.#bindAuthSession(task);
      const credentials = this.useStoredDshCredentials ? { apiKey: null, baseUrl: null } : this.credentialProvider();
      if (!this.useStoredDshCredentials && (!credentials?.apiKey || !credentials?.baseUrl)) throw new Error('BUILD_MODEL_CONFIGURATION_REQUIRED');
      await this.prepareRuntime();

      const attemptNumber = task.attempts.length + 1;
      const attemptId = `attempt-${String(attemptNumber).padStart(2, '0')}-${kind}`;
      const taskRoot = this.store.taskDirectory(task.task_id);
      const attemptRoot = path.join(taskRoot, 'attempts', attemptId);
      const workspace = path.join(attemptRoot, 'workspace');
      const inputRoot = path.join(workspace, 'input');
      const outputRoot = path.join(workspace, 'output');
      const candidatePath = path.join(outputRoot, 'candidate.spec.mjs');
      await fs.mkdir(inputRoot, { recursive: true });
      await fs.mkdir(outputRoot, { recursive: true });
      if (task.source?.kind === 'project-case') {
        for (const relative of ['task.md', 'input/case-snapshot.json']) {
          const descriptor = task.files.find((item) => item.attempt_id === null && item.relative_path === relative);
          if (!descriptor) throw new Error('BUILD_PROJECT_CASE_FROZEN_INPUT_MISSING');
          const source = path.join(taskRoot, relative);
          if (await sha256File(source) !== descriptor.sha256) throw new Error('BUILD_PROJECT_CASE_FROZEN_INPUT_CHANGED');
          const destination = path.join(workspace, relative);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.copyFile(source, destination);
        }
      } else {
        await fs.writeFile(path.join(workspace, 'task.md'), taskDocument(task), { flag: 'wx' });
      }
      if (kind === 'revision') {
        const previous = task.candidates.at(-1);
        if (!previous || previous.verification_status !== 'FAILED') throw new Error('BUILD_REVISION_SOURCE_INVALID');
        await fs.writeFile(path.join(inputRoot, 'candidate-v1.spec.mjs'), previous.code, { flag: 'wx' });
        await fs.writeFile(path.join(workspace, 'feedback.json'), `${JSON.stringify({
          candidate_version: previous.version,
          candidate_sha256: previous.sha256,
          actual_verification_error: previous.error,
        }, null, 2)}\n`, { flag: 'wx' });
      }

      const startedAt = this.now().toISOString();
      const budget = revalidationId ? await this.store.getBudget() : await this.store.claimStart(task.task_id, attemptId, startedAt);
      const attempt = {
        attempt_id: attemptId, kind, started_at: startedAt, finished_at: null,
        status: 'RUNNING', max_tool_calls: MAX_TOOL_CALLS, timeout_ms: TIMEOUT_MS,
        service_instance_id: this.serviceInstanceId,
        authorization_id: revalidationId,
        authorization_status: revalidationId ? 'RESERVED_UNTIL_PROCESS_SPAWN' : null,
        observation: { complete: false, lifecycle_file: `attempts/${attemptId}/lifecycle.ndjson` },
        harness: null, error: null,
        auth: authBinding ? {
          environment_id: authBinding.scope.environment_id, role: authBinding.scope.role,
          account_id: authBinding.account_id, session_version: authBinding.session_version,
          bound_at: authBinding.bound_at,
        } : null,
      };
      const next = await this.store.updateTask(task.task_id, (current) => ({
        ...current,
        started_at: current.started_at || startedAt,
        task_status: 'GENERATING', generation_status: 'RUNNING', verification_status: 'NOT_STARTED',
        human_review_status: 'NOT_READY', active_attempt_id: attemptId,
        attempts: [...current.attempts, attempt], revision_allowed: false,
        budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts }, error: null,
      }));
      const controller = new AbortController();
      try {
        await this.#recordLifecycle(task.task_id, attemptId, { type: 'attempt_started', partial_observation: true });
      } catch (error) {
        await this.store.updateTask(task.task_id, (current) => ({
          ...current, task_status: 'FAILED', generation_status: 'FAILED', verification_status: 'NOT_RUN',
          active_attempt_id: null, finished_at: this.now().toISOString(),
          attempts: current.attempts.map((item) => item.attempt_id === attemptId ? {
            ...item, status: 'FAILED', finished_at: this.now().toISOString(),
            error: { code: 'BUILD_DIAGNOSTIC_STORAGE_FAILED', message: '生命周期记录无法持久化；工作台已停止接纳新建例。' },
          } : item),
          error: { code: 'BUILD_DIAGNOSTIC_STORAGE_FAILED', message: '生命周期记录无法持久化；工作台已停止接纳新建例。' },
        })).catch((writeError) => this.#tripStorageFault(writeError, 'persist_launch_failure'));
        throw error;
      }
      this.active = { taskId: task.task_id, attemptId, controller, phase: 'GENERATING' };
      const completion = this.#execute({ task: next, kind, attemptId, attemptRoot, workspace, candidatePath, credentials, controller, revalidationId, authBinding })
        .finally(async () => {
          if (this.active?.attemptId === attemptId) this.active.phase = 'FINALIZING';
          try { await finalizeLifecycle(this.store, task.task_id, attemptId); }
          finally { if (this.active?.attemptId === attemptId) this.active = null; }
        });
      this.completions.set(task.task_id, completion);
      void completion.catch((error) => this.#tripStorageFault(error, 'background_completion'));
      return next;
    } finally {
      this.starting = false;
    }
  }

  async #execute(context) {
    const { task, kind, attemptId, attemptRoot, workspace, candidatePath, credentials, controller, revalidationId, authBinding } = context;
    const template = task.source?.kind === 'project-case'
      ? await loadProjectCaseEnvironment(this.paths, task.environment_ref.environment_id)
      : await loadBuildTemplate(this.paths);
    let normalServer;
    let negativeServer;
    let authWatch = null;
    try {
      if (authBinding) authWatch = this.#startAuthWatch(authBinding.scope, authBinding.session_version, controller);
      await this.#recordLifecycle(task.task_id, attemptId, { type: 'phase', phase: 'fixture_starting', partial_observation: true });
      normalServer = template.internal.e2e01 || template.internal.auth01
        ? { url: template.internal.normalUrl, close: async () => {} }
        : await this.adapter.startFixtureServer(template.internal.normalFixture, { route: template.internal.normalRoute || '/probe' });
      await this.#recordLifecycle(task.task_id, attemptId, { type: 'phase', phase: 'harness_starting', partial_observation: true });
      const prompt = promptFor({ kind, task, entryUrl: normalServer.url, candidatePath });
      if (task.source?.kind === 'project-case') {
        await fs.writeFile(path.join(workspace, 'agent-instruction.txt'), prompt, { flag: 'wx' });
        await this.store.updateTask(task.task_id, (current) => ({
          ...current,
          attempts: current.attempts.map((item) => item.attempt_id === attemptId
            ? { ...item, rendered_agent_instruction: prompt }
            : item),
        }));
      }
      const harnessStarted = Date.now();
      let authorizationClaimed = false;
      // 认证任务：Harness 通过 CDP 附着到已登录窗口，端点按会话版本复核后下发并脱敏。
      const authAttachEndpoint = authBinding
        ? await this.authSessions.attachEndpoint(authBinding.scope, authBinding.session_version)
        : null;
      const harness = await this.adapter.runHarnessTask({
        task: prompt,
        workspace,
        dshHome: this.harnessDshHome,
        patchPath: this.harnessPatchPath,
        candidatePath,
        browserExecutable: this.browserExecutable,
        browserAttachEndpoint: authAttachEndpoint,
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl,
        timeoutMs: TIMEOUT_MS,
        maxToolCalls: MAX_TOOL_CALLS,
        signal: controller.signal,
        onLifecycle: async (event) => {
          if (event?.type === 'process_spawn' && revalidationId && !authorizationClaimed) {
            try {
              const authorization = await this.store.claimRevalidationStart(revalidationId, task.task_id, attemptId, this.now().toISOString());
              authorizationClaimed = true;
              await this.store.updateTask(task.task_id, (current) => ({
                ...current,
                authorization: { ...current.authorization, used_starts: authorization.used_starts },
                attempts: current.attempts.map((item) => item.attempt_id === attemptId ? {
                  ...item, authorization_status: 'CONSUMED_ON_PROCESS_SPAWN',
                } : item),
              }));
            } catch (error) {
              this.#tripStorageFault(error, 'claim_revalidation_authorization');
              throw error;
            }
          }
          await this.#recordLifecycle(task.task_id, attemptId, event);
        },
      });
      const diagnosticSecrets = this.useStoredDshCredentials ? await dshHomeSecrets(this.harnessDshHome) : [];
      const harnessSummary = {
        model_configuration: this.modelConfiguration ? structuredClone(this.modelConfiguration) : null,
        assessment: harness.assessment,
        wall_ms: Date.now() - harnessStarted,
        observable_agent_steps: harness.events.filter((event) => event.type === 'status' && event.phase === 'step_end').length,
        total_tool_calls: harness.events.filter((event) => event.type === 'tool_call').length,
        browser_tool_calls: harness.events.filter((event) => event.type === 'tool_call' && /^mcp__playwright-mcp__/.test(event.tool || '')).length,
        provider_request_count: null,
        provider_usage: usageFromEvents(harness.events),
        tool_names: [...new Set(harness.events.filter((event) => event.type === 'tool_call').map((event) => event.tool))].sort(),
        process: {
          pid: harness.process.pid, parent_pid: harness.process.parentPid,
          exit_code: harness.process.exitCode, signal: harness.process.signal,
          termination: harness.process.termination, exit_observed: harness.process.exitObserved,
          close_observed: harness.process.closeObserved, output_complete: harness.process.outputComplete,
          observer_error: harness.process.observerError ? { code: harness.process.observerError.code } : null,
          stderr_diagnostic: harnessStderrDiagnostic(harness.process.stderr, [credentials.apiKey, credentials.baseUrl, ...diagnosticSecrets]),
        },
      };
      await fs.mkdir(attemptRoot, { recursive: true });
      await fs.writeFile(path.join(attemptRoot, 'harness-summary.json'), `${JSON.stringify(harnessSummary, null, 2)}\n`);
      if (!harness.assessment.success || !harness.candidate) {
        return this.#finishFailure(task.task_id, attemptId, {
          code: harness.assessment.termination === 'cancelled' ? 'BUILD_CANCELLED' : 'HARNESS_INCOMPLETE',
          message: harness.assessment.termination === 'cancelled' ? '用户取消了当前建例任务。' : 'Harness终态或候选文件不完整。',
        }, harnessSummary, controller.signal.aborted ? 'CANCELLED' : 'FAILED', attemptRoot, candidatePath);
      }

      const code = await fs.readFile(candidatePath, 'utf8');
      if (Buffer.byteLength(code) > 64 * 1024 || [credentials.apiKey, credentials.baseUrl].some((secret) => secret && code.includes(secret))) {
        return this.#finishFailure(task.task_id, attemptId, { code: 'SENSITIVE_OR_OVERSIZED_CANDIDATE', message: '候选过大或包含敏感连接信息，未展示或执行。' }, harnessSummary, 'FAILED', attemptRoot, candidatePath);
      }
      const candidateSha = await sha256File(candidatePath);
      const previous = task.candidates.at(-1);
      const candidate = {
        version: task.candidates.length + 1,
        attempt_id: attemptId,
        created_at: this.now().toISOString(),
        sha256: candidateSha,
        bytes: Buffer.byteLength(code),
        code,
        diff_from_previous: lineDiff(previous?.code || null, code),
        generation_status: 'GENERATED',
        verification_status: 'RUNNING',
        normal: null,
        negative: null,
        error: null,
        approved: false,
        project_case_step_mapping: task.source?.kind === 'project-case'
          ? task.input_bundle.snapshot.content.steps.map((step) => ({ order: step.order, marker: `CASE_STEP_${step.order}`, action: step.action, expected: step.expected, observed: null }))
          : null,
      };
      await this.store.updateTask(task.task_id, (current) => ({
        ...current, task_status: 'VERIFYING', generation_status: 'GENERATED', verification_status: 'RUNNING',
        candidates: [...current.candidates, candidate],
      }));
      this.active.phase = 'VERIFYING';
      await this.#recordLifecycle(task.task_id, attemptId, { type: 'phase', phase: 'verification_started', partial_observation: true });

      if (template.internal.auth01) {
        // AUTH-01 认证执行：携带当前登录会话状态运行候选；失效即停，不补写未执行步骤。
        const authStorageState = await this.authSessions.stateForExecution(authBinding.scope, authBinding.session_version);
        const authRunId = `run-${randomUUID()}`;
        const authRunDirectory = path.join(attemptRoot, 'verification', 'auth', 'runs', authRunId);
        const authStartedAt = this.now().toISOString();
        let authRaw = null;
        try {
          authRaw = await this.adapter.verifyCandidate({
            candidatePath, browserExecutable: this.browserExecutable, fixtureUrl: normalServer.url,
            runDirectory: authRunDirectory, signal: controller.signal, authStorageState,
            stepObservation: {
              run_id: authRunId, candidate_sha256: candidateSha,
              executed_external_id: task.source.external_id, executed_case_id: task.source.case_id,
              executed_case_version: task.source.case_version, executed_content_sha256: task.source.content_sha256,
            },
          });
        } catch (error) {
          if (!authWatch?.detected) throw error;
        }
        const authResult = await parseCandidateReport(path.join(authRunDirectory, 'playwright-report.json'),
          authRaw?.process || { exitCode: null, termination: 'auth_session_blocked' });
        const afterAuth = await sha256File(candidatePath);
        await normalServer.close();
        normalServer = null;
        const stepCoverage = projectCaseStepCoverage(authResult, task.input_bundle.verification_contract);
        const replay = await renderStepReplay({
          runDirectory: authRunDirectory, runId: authRunId, candidateSha256: candidateSha,
          executedExternalId: task.source.external_id, executedCaseVersion: task.source.case_version,
          caseContent: task.input_bundle.snapshot.content, coverage: stepCoverage, browserExecutable: this.browserExecutable,
        });
        const indexed = await indexAttemptFiles({
          taskRoot: this.store.taskDirectory(task.task_id), attemptRoot, candidatePath, attemptId,
          runId: authRunId, startIndex: (await this.store.getTask(task.task_id)).files.length,
        });
        const authMedia = indexed.files.filter((file) => file.run_id === authRunId && /_(?:screenshot|video|trace)$/.test(file.kind)).map((file) => file.file_id);
        const blocked = Boolean(authWatch?.detected);
        const authBlock = blocked ? { ...authWatch.detected, stopped_at: this.now().toISOString() } : null;
        const authorization = revalidationId ? await this.store.getRevalidationAuthorization() : null;
        const authRun = {
          schema: 'workbench/auth01-case-run-v1', run_id: authRunId, run_type: 'auth-initial',
          source_build_task_id: task.task_id, source_case_id: task.source.case_id,
          source_external_id: task.source.external_id, source_case_version: task.source.case_version,
          executed_case_id: task.source.case_id, executed_external_id: task.source.external_id,
          executed_case_version: task.source.case_version, executed_content_sha256: task.source.content_sha256,
          environment_id: task.environment_ref.environment_id, entry_route: '/protected',
          candidate_version: candidate.version, candidate_sha256: candidateSha,
          status: authResult.test_status, complete_pass: blocked ? false : authResult.complete_pass, error: authResult.error,
          step_coverage: stepCoverage, same_candidate_hash: candidateSha === afterAuth,
          auth: {
            environment_id: authBinding.scope.environment_id, role: authBinding.scope.role,
            account_id: authBinding.account_id, session_version: authBinding.session_version,
            bound_at: authBinding.bound_at,
          },
          auth_block: authBlock,
          media_file_ids: authMedia,
          step_replay: replay.replay,
          runner_version: TRIAL_RUNNER_VERSION,
          started_at: authStartedAt, finished_at: this.now().toISOString(), origin: 'WORKBENCH_CANDIDATE_TRIAL',
          technical_error: blocked ? null
            : indexed.unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', files: indexed.unexpected }
            : replay.replay.status !== 'READY' ? { code: 'STEP_REPLAY_UNAVAILABLE', reason: replay.replay.reason } : null,
        };
        const ready = !blocked && authResult.complete_pass && stepCoverage.complete && candidateSha === afterAuth && indexed.unexpected.length === 0;
        const blockError = blocked ? authSessionBlockError(authBlock) : null;
        const coverageError = !blocked && !stepCoverage.complete ? {
          code: 'PROJECT_CASE_STEP_COVERAGE_INCOMPLETE', message: '认证执行报告未覆盖完整的原用例步骤；不补写未执行步骤。',
          expected: task.input_bundle.verification_contract.required_step_markers.join(', '),
          actual: stepCoverage.items.filter((item) => item.observed).map((item) => item.marker).join(', '),
        } : null;
        const hashError = !blocked && candidateSha !== afterAuth ? { code: 'CANDIDATE_HASH_CHANGED', message: '认证执行期间候选字节发生变化。' } : null;
        const indexedError = !blocked && indexed.unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', message: `发现未登记输出：${indexed.unexpected.join(', ')}` } : null;
        const finalError = blockError || indexedError || hashError || authResult.error || coverageError;
        const observation = await this.store.lifecycleSummary(task.task_id, attemptId);
        await this.#recordLifecycle(task.task_id, attemptId, { type: 'attempt_settled', phase: blocked ? 'auth_session_blocked' : ready ? 'technical_pass' : 'candidate_validation_failed', partial_observation: false });
        return this.store.updateTask(task.task_id, (current) => ({
          ...current,
          task_status: blocked ? 'CANCELLED' : ready ? 'WAITING_HUMAN_REVIEW' : 'CANDIDATE_VALIDATION_FAILED',
          generation_status: 'GENERATED',
          verification_status: blocked ? 'INCOMPLETE' : ready ? 'TECHNICAL_VALIDATION_PASSED' : 'FAILED',
          human_review_status: ready ? 'WAITING_REVIEW' : 'NOT_READY',
          active_attempt_id: null, finished_at: this.now().toISOString(),
          attempts: current.attempts.map((item) => item.attempt_id === attemptId ? {
            ...item, finished_at: this.now().toISOString(),
            status: blocked ? 'CANCELLED' : ready ? 'COMPLETED' : 'CANDIDATE_VALIDATION_FAILED',
            observation: { ...item.observation, complete: true, summary: observation },
            harness: harnessSummary, error: finalError,
          } : item),
          candidates: current.candidates.map((item) => item.attempt_id === attemptId ? {
            ...item,
            verification_status: blocked ? 'INCOMPLETE' : ready ? 'TECHNICAL_VALIDATION_PASSED' : 'FAILED',
            normal: authResult, negative: null, same_candidate_hash: candidateSha === afterAuth,
            counterexample_detected: null, error: finalError,
            trial_runs: [...(item.trial_runs || []), authRun],
            project_case_step_mapping: item.project_case_step_mapping?.map((mapping) => ({
              ...mapping, observed: stepCoverage?.items.find((coverage) => coverage.marker === mapping.marker)?.observed ?? null,
            })) || null,
          } : item),
          files: [...current.files, ...indexed.files],
          revision_allowed: !blocked && !ready && kind === 'initial' && Boolean(authorization && authorization.used_starts < authorization.max_starts),
          authorization: authorization ? { ...current.authorization, used_starts: authorization.used_starts } : current.authorization,
          error: finalError,
        }));
      }
      const normalRaw = await this.adapter.verifyCandidate({
        candidatePath, browserExecutable: this.browserExecutable, fixtureUrl: normalServer.url,
        runDirectory: path.join(attemptRoot, 'verification', 'normal'), signal: controller.signal,
      });
      const normal = await parseCandidateReport(normalRaw.reportPath, normalRaw.process);
      const afterNormal = await sha256File(candidatePath);
      await normalServer.close();
      normalServer = null;
      if (template.internal.e2e01) {
        const stepCoverage = projectCaseStepCoverage(normal, task.input_bundle.verification_contract);
        const normalRunId = `run-${randomUUID()}`;
        const indexed = await indexAttemptFiles({
          taskRoot: this.store.taskDirectory(task.task_id), attemptRoot, candidatePath, attemptId,
          runId: normalRunId, startIndex: (await this.store.getTask(task.task_id)).files.length,
        });
        const normalMedia = indexed.files.filter((file) => file.run_id === normalRunId && /_(?:screenshot|video|trace)$/.test(file.kind)).map((file) => file.file_id);
        const normalTrialRun = {
          schema: 'workbench/e2e01-case-run-v1', run_id: normalRunId, run_type: 'normal',
          source_build_task_id: task.task_id, source_case_id: task.source.case_id,
          source_external_id: task.source.external_id, source_case_version: task.source.case_version,
          executed_case_id: task.trial_binding.source.case_id, executed_external_id: task.trial_binding.source.external_id,
          executed_case_version: task.trial_binding.source.case_version, executed_content_sha256: task.trial_binding.source.content_sha256,
          environment_id: task.environment_ref.environment_id, entry_route: task.trial_binding.source.entry_route,
          candidate_version: candidate.version, candidate_sha256: candidateSha,
          status: normal.test_status, complete_pass: normal.complete_pass, error: normal.error,
          step_coverage: stepCoverage, media_file_ids: normalMedia,
          started_at: this.now().toISOString(), finished_at: this.now().toISOString(),
          origin: 'WORKBENCH_CANDIDATE_TRIAL',
        };
        const budget = await this.store.getBudget();
        const authorization = revalidationId ? await this.store.getRevalidationAuthorization() : null;
        const normalReady = normal.complete_pass && stepCoverage.complete && candidateSha === afterNormal;
        const coverageError = !stepCoverage.complete ? {
          type: 'PROJECT_CASE_STEP_COVERAGE_INCOMPLETE', message: '正常页报告未覆盖完整的原用例步骤。',
          expected: task.input_bundle.verification_contract.required_step_markers.join(', '),
          actual: stepCoverage.items.filter((item) => item.observed).map((item) => item.marker).join(', '),
          attribution: 'PENDING_ANALYSIS',
        } : null;
        const indexedError = indexed.unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', message: `发现未登记输出：${indexed.unexpected.join(', ')}` } : null;
        const normalError = indexedError || normal.error || coverageError || (candidateSha !== afterNormal ? { code: 'CANDIDATE_HASH_CHANGED', message: '正常页执行期间候选字节发生变化。' } : null);
        const observation = await this.store.lifecycleSummary(task.task_id, attemptId);
        await this.#recordLifecycle(task.task_id, attemptId, { type: 'attempt_settled', phase: 'normal_trial_settled', partial_observation: false });
        return this.store.updateTask(task.task_id, (current) => ({
          ...current,
          task_status: 'WAITING_E2E_TRIALS', generation_status: 'GENERATED', verification_status: 'INCOMPLETE',
          human_review_status: 'NOT_READY', active_attempt_id: null, finished_at: this.now().toISOString(),
          attempts: current.attempts.map((item) => item.attempt_id === attemptId ? {
            ...item, finished_at: this.now().toISOString(), status: 'COMPLETED',
            observation: { ...item.observation, complete: true, summary: observation }, harness: harnessSummary, error: normalError,
          } : item),
          candidates: current.candidates.map((item) => item.attempt_id === attemptId ? {
            ...item, verification_status: normalReady ? 'NORMAL_PASSED_AWAITING_PAIR' : 'FAILED',
            normal, negative: null, same_candidate_hash: candidateSha === afterNormal, counterexample_detected: null,
            error: normalError, trial_runs: [...(item.trial_runs || []), normalTrialRun],
            project_case_step_mapping: item.project_case_step_mapping?.map((mapping) => ({
              ...mapping, observed: stepCoverage?.items.find((coverage) => coverage.marker === mapping.marker)?.observed ?? null,
            })) || null,
          } : item),
          files: [...current.files, ...indexed.files],
          revision_allowed: kind === 'initial' && !normalReady && Boolean(authorization?.used_starts < authorization?.max_starts),
          error: normalError,
        }));
      }
      negativeServer = await this.adapter.startFixtureServer(template.internal.negativeFixture, { route: template.internal.negativeRoute || '/probe' });
      const negativeRaw = await this.adapter.verifyCandidate({
        candidatePath, browserExecutable: this.browserExecutable, fixtureUrl: negativeServer.url,
        runDirectory: path.join(attemptRoot, 'verification', 'negative'), signal: controller.signal,
      });
      const negative = await parseCandidateReport(negativeRaw.reportPath, negativeRaw.process);
      const afterNegative = await sha256File(candidatePath);
      const sameCandidate = candidateSha === afterNormal && candidateSha === afterNegative;
      const verificationContract = task.source?.kind === 'project-case'
        ? task.input_bundle.verification_contract
        : { expected_literal: task.template.expected, counterexample_actual: template.internal.counterexampleActual };
      const stepCoverage = task.source?.kind === 'project-case' ? projectCaseStepCoverage(normal, verificationContract) : null;
      const negativeDetected = counterexampleDetected(negative, verificationContract);
      const technicalPass = normal.complete_pass && negativeDetected && sameCandidate && (!stepCoverage || stepCoverage.complete);
      const coverageError = stepCoverage && !stepCoverage.complete ? {
        type: 'PROJECT_CASE_STEP_COVERAGE_INCOMPLETE',
        message: '正常执行报告未包含全部登记的项目用例步骤标记。',
        expected: verificationContract.required_step_markers.join(', '),
        actual: stepCoverage.items.filter((item) => item.observed).map((item) => item.marker).join(', '),
        attribution: 'PENDING_ANALYSIS',
      } : null;
      const candidateError = technicalPass ? null : normal.error || coverageError || negative.error || {
        type: 'COUNTEREXAMPLE_NOT_DETECTED', message: '独立错误输出未产生指定断言不符。', expected: null, actual: null, attribution: 'PENDING_ANALYSIS',
      };
      const budget = await this.store.getBudget();
      const authorization = revalidationId ? await this.store.getRevalidationAuthorization() : null;
      await this.#recordLifecycle(task.task_id, attemptId, { type: 'attempt_settled', phase: technicalPass ? 'technical_pass' : 'candidate_validation_failed', partial_observation: false });
      const indexed = await indexAttemptFiles({
        taskRoot: this.store.taskDirectory(task.task_id), attemptRoot, candidatePath, attemptId,
        startIndex: (await this.store.getTask(task.task_id)).files.length,
      });
      const unexpected = indexed.unexpected;
      const effectivePass = technicalPass && unexpected.length === 0;
      const finalError = unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', message: `发现未登记输出：${unexpected.join(', ')}` } : candidateError;
      const observation = await this.store.lifecycleSummary(task.task_id, attemptId);
      return this.store.updateTask(task.task_id, (current) => ({
        ...current,
        task_status: effectivePass ? 'WAITING_HUMAN_REVIEW' : 'CANDIDATE_VALIDATION_FAILED',
        generation_status: 'GENERATED', verification_status: effectivePass ? 'PASSED' : 'FAILED',
        human_review_status: effectivePass ? 'WAITING_REVIEW' : 'NOT_READY', active_attempt_id: null,
        finished_at: this.now().toISOString(),
        attempts: current.attempts.map((item) => item.attempt_id === attemptId ? {
          ...item, finished_at: this.now().toISOString(), status: effectivePass ? 'COMPLETED' : 'CANDIDATE_VALIDATION_FAILED',
          observation: { ...item.observation, complete: true, summary: observation }, harness: harnessSummary, error: finalError,
        } : item),
        candidates: current.candidates.map((item) => item.attempt_id === attemptId ? {
          ...item, verification_status: effectivePass ? 'PASSED' : 'FAILED', normal, negative,
          same_candidate_hash: sameCandidate, counterexample_detected: negativeDetected, error: finalError,
          project_case_step_mapping: item.project_case_step_mapping?.map((mapping) => ({
            ...mapping,
            observed: stepCoverage?.items.find((coverage) => coverage.marker === mapping.marker)?.observed ?? null,
          })) || null,
        } : item),
        files: [...current.files, ...indexed.files],
        revision_allowed: kind === 'initial' && !effectivePass &&
          ((!revalidationId && budget.used_starts < budget.max_starts) ||
            (revalidationId === M4A_QUERY_CASE_AUTHORIZATION_ID && authorization.used_starts < authorization.max_starts &&
              (!normal.complete_pass || Boolean(coverageError)))),
        budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts },
        authorization: authorization ? { ...current.authorization, used_starts: authorization.used_starts } : current.authorization,
        error: finalError,
      }));
    } catch (error) {
      const authBlocked = Boolean(authWatch?.detected);
      const authBlock = authBlocked ? { ...authWatch.detected, stopped_at: this.now().toISOString() } : null;
      const message = authBlocked
        ? authSessionBlockError(authBlock).message
        : redactText(error?.message || String(error), [credentials.apiKey, credentials.baseUrl].filter(Boolean));
      await this.#recordLifecycle(task.task_id, attemptId, {
        type: 'attempt_error', code: authBlocked ? 'AUTH_SESSION_BLOCKED' : (error?.code || (controller.signal.aborted ? 'BUILD_CANCELLED' : 'BUILD_EXECUTION_ERROR')), partial_observation: true,
      }).catch(() => {});
      return this.#finishFailure(task.task_id, attemptId, {
        code: authBlocked ? 'AUTH_SESSION_BLOCKED' : controller.signal.aborted ? 'BUILD_CANCELLED' : 'BUILD_EXECUTION_ERROR',
        message,
        ...(authBlock ? { auth_block: authBlock } : {}),
      }, null, (authBlocked || controller.signal.aborted) ? 'CANCELLED' : 'FAILED', attemptRoot, candidatePath);
    } finally {
      if (authWatch) this.#stopAuthWatch();
      await normalServer?.close().catch(() => {});
      await negativeServer?.close().catch(() => {});
    }
  }

  async #finishFailure(taskIdValue, attemptId, error, harnessSummary, status, attemptRoot, candidatePath) {
    const current = await this.store.getTask(taskIdValue);
    const indexed = await indexAttemptFiles({
      taskRoot: this.store.taskDirectory(taskIdValue), attemptRoot, candidatePath, attemptId, startIndex: current.files.length,
    }).catch(() => ({ files: [], unexpected: [] }));
    const budget = await this.store.getBudget();
    const authorization = current.authorization?.authorization_id ? await this.store.getRevalidationAuthorization() : null;
    const observation = await this.store.lifecycleSummary(taskIdValue, attemptId);
    return this.store.updateTask(taskIdValue, (task) => ({
      ...task,
      task_status: status,
      generation_status: status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
      verification_status: 'NOT_RUN', human_review_status: 'NOT_READY', active_attempt_id: null,
      finished_at: this.now().toISOString(),
      attempts: task.attempts.map((item) => item.attempt_id === attemptId ? {
        ...item, status, finished_at: this.now().toISOString(),
        observation: { ...item.observation, complete: false, summary: observation }, harness: harnessSummary, error,
      } : item),
      files: [...task.files, ...indexed.files],
      revision_allowed: false,
      budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts },
      authorization: authorization ? { ...task.authorization, used_starts: authorization.used_starts } : task.authorization,
      error,
    }));
  }

  async stop(taskIdValue) {
    if (!this.active || this.active.taskId !== taskIdValue || this.active.phase === 'FINALIZING') throw new Error('BUILD_TASK_NOT_ACTIVE_OR_NOT_OWNED');
    const active = this.active;
    const recorded = this.#recordLifecycle(taskIdValue, active.attemptId, { type: 'cancel_requested', reason: 'user_cancelled', partial_observation: true })
      .catch(() => {});
    active.controller.abort('cancelled');
    await recorded;
    return this.store.updateTask(taskIdValue, (task) => task.active_attempt_id
      ? { ...task, task_status: 'CANCELLING' } : task);
  }

  async wait(taskIdValue) {
    await this.completions.get(taskIdValue);
    return this.store.getTask(taskIdValue);
  }

  async settle() {
    await Promise.allSettled([...this.completions.values()]);
  }
}
