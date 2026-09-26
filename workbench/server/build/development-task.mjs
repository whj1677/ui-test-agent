import { managedDevelopmentTarget, checkDevelopmentEnvironment, developmentAuthScope } from './user-workflow.mjs';
import { verifyBundle } from './development-bundle.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { developmentPatch } from './development-patch.mjs';
import { dshHomeSecrets, harnessStderrDiagnostic } from './diagnostic.mjs';
import { DevelopmentSession, digest, evidenceFiles } from './development-session.mjs';
import { claimDevelopmentAuthorization, developmentAuthorizations } from './development-authorization.mjs';
import { startDevelopmentMcp } from './development-mcp.mjs';
import { BROWSER_SEMANTICS_RULES } from './browser-semantics.mjs';
import { counterexampleDetected } from './report.mjs';
import { verifyDevelopmentRun } from './development-evidence.mjs';
import { contentHash } from '../cases/excel.mjs';
import { DEVELOPMENT_CONTRACT } from './development-feedback.mjs';
import { allowedBrowserTools } from './development-tool-guard.mjs';

export function developmentValidationLanes(environment, authOrigin = null) {
  if (!environment || !environment.id || !environment.normal_url) throw new Error('DEVELOPMENT_ENVIRONMENT_NOT_REGISTERED');
  const normalOnly = environment.validation_mode === 'normal-only';
  if (environment.validation_mode && !['normal-only', 'paired'].includes(environment.validation_mode)) throw new Error('DEVELOPMENT_VALIDATION_MODE_INVALID');
  if (normalOnly ? environment.fault_url || environment.semantic_url || environment.detection : !environment.fault_url || !environment.detection) throw new Error('DEVELOPMENT_ENVIRONMENT_NOT_REGISTERED');
  for (const url of [environment.normal_url, ...(!normalOnly ? [environment.fault_url] : []), ...(environment.semantic_url ? [environment.semantic_url] : [])]) {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.hash ||
        !(authOrigin ? parsed.origin === authOrigin : parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1')) {
      throw new Error('DEVELOPMENT_ENVIRONMENT_NOT_LOCAL');
    }
  }
  return normalOnly ? ['normal'] : ['normal', 'negative', ...(environment.semantic_url ? ['semantic'] : [])];
}

export async function submitDevelopment(manager, request) {
  manager.assertStorageWritable?.();
  if (manager.starting || manager.active || manager.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
  manager.starting = true;
  let environmentLease;
  try {
    const taskId = manager.idFactory();
    const maintenance = request.maintenance || null;
    const registered=(await developmentAuthorizations(manager.store)).find(a=>a.logical_id===request.logical_id);
    if(!registered)throw Error('DEVELOPMENT_NOT_AUTHORIZED');
    let environment = manager.developmentEnvironments.find(item => item.id === registered.environment_id);
    await checkDevelopmentEnvironment(manager, environment, registered.project_id);
    const authScope = developmentAuthScope(manager, environment, registered.project_id);
    const authOrigin = authScope ? manager.authSessions.environment(authScope).origin : null;
    const managedTarget = managedDevelopmentTarget(manager, environment);
    if (managedTarget) { environmentLease = await managedTarget.acquire('normal'); environment = { ...environment, normal_url: environmentLease.url }; }
    developmentValidationLanes(environment, authOrigin);
    const authorization = await claimDevelopmentAuthorization(manager.store, request.logical_id, taskId, entry => {
      if (request.seedBundle && entry.mode !== 'recovery') throw Error('GENERATION_FRESH_SEED_FORBIDDEN');
      if (request.seedBundle && digest(request.seedBundle.entries?.find(f => f.path === 'candidate.spec.mjs')?.content || '') !== entry.seed_sha256) throw Error('REVISION_AUTHORIZED_SEED_MISMATCH');
      if (maintenance?.mode === 'revise' && (entry.mode !== 'recovery' || digest(request.seedBundle?.entries?.find(f => f.path === 'candidate.spec.mjs')?.content || '') !== entry.seed_sha256)) throw Error('REVISION_AUTHORIZED_SEED_MISMATCH');
      if (maintenance && maintenance.mode !== 'revise' && (entry.mode !== 'new' || request.seedBundle)) throw Error('GENERATION_FRESH_SEED_FORBIDDEN');
    });
    const project = await manager.caseStore.getProject(authorization.project_id);
    const item = project?.cases.find(item => item.case_id === authorization.case_id);
    const version = item?.versions.find(item => item.version === authorization.case_version);
    if (!version || version.content_sha256 !== authorization.content_sha256 || contentHash(version.content) !== authorization.content_sha256 || version.content.status !== 'CONFIRMED') throw new Error('DEVELOPMENT_FROZEN_CASE_MISMATCH');
    const now = new Date().toISOString();
    const frozenCase = structuredClone(version.content);
    const task = await manager.store.createTask({
      schema: 'workbench/build-task-v1', task_id: taskId, created_at: now, started_at: now, finished_at: null,
      task_status: 'GENERATING', generation_status: 'RUNNING', verification_status: 'NOT_STARTED', human_review_status: 'NOT_READY',
      active_attempt_id: 'attempt-01-initial', revision_allowed: false,
      template: { title: frozenCase.title, template_id: 'registered-development-v1' },
      source: { project_id: project.project_id, project_name: project.name, case_id: item.case_id, case_version: version.version, external_id: item.external_id, content_sha256: version.content_sha256 },
      environment_ref: { environment_id: environment.id, validation_mode: environment.validation_mode || 'paired', preparation: environmentLease?.identity || null }, input_bundle: { snapshot: { content: frozenCase } },
      ...(authScope ? { auth_requirement: { schema: 'workbench/development-auth-requirement-v1', environment_id: authScope.environment_id, role: authScope.role, account_requirement: 'ROLE_MATCH' } } : {}),
      authorization: { logical_id: authorization.logical_id, mode: authorization.mode, limits: authorization.limits, recovery_origin: authorization.recovery_origin || null },
      maintenance,
      script_version: 1 + Math.max(0, ...(await manager.store.listTasks()).filter(t => t.source?.project_id === project.project_id && t.source?.case_id === item.case_id).map(t => t.script_version || (t.candidates?.length ? 1 : 0))),
      attempts: [{ attempt_id: 'attempt-01-initial', kind: 'initial', status: 'RUNNING', started_at: now }], candidates: [], files: [], error: null,
      runtime: { os_file_isolation: false, os_network_isolation: false, scope: 'tool-policy-and-executor-allowlist', model: manager.modelConfiguration },
    });
    const controller = new AbortController();
    manager.active = { taskId, attemptId: 'attempt-01-initial', controller, phase: 'DEVELOPING' };
    const completion = executeDevelopment(manager, task, authorization, environment, controller, request.seedBundle, environmentLease)
      .catch(error => { manager.reportStorageFault?.(error, 'development_completion'); throw error; })
      .finally(() => { if (manager.active?.taskId === taskId) manager.active = null; });
    manager.completions.set(taskId, completion);
    // The completion remains observable in the manager map; mark the rejection handled.
    completion.catch(() => {});
    return task;
  } catch (error) { await environmentLease?.release(); throw error; } finally { manager.starting = false; }
}

async function executeDevelopment(manager, task, authorization, environment, controller, seedBundle, environmentLease) {
  const directory = path.join(manager.store.taskDirectory(task.task_id), 'development');
  const evidenceIdentity = { task_id: task.task_id, executed_case_id: task.source.case_id,
    executed_external_id: task.source.external_id, executed_case_version: task.source.case_version,
    executed_content_sha256: task.source.content_sha256 };
  let authBinding = null; let authWatch = null; let authBlock = null; let releaseAuthProtection = null;
  const authStateForExecution = task.auth_requirement ? async () => {
    try { return await manager.authSessions.stateForExecution(authBinding.scope, authBinding.session_version); }
    catch {
      authBlock ||= { reason: 'AUTH_SESSION_NOT_VALID', trigger: 'execution_preflight', detected_at: new Date().toISOString() };
      controller.abort({ code: 'AUTH_SESSION_INVALIDATED', reason: authBlock.reason });
      throw new Error('AUTH_SESSION_BLOCKED');
    }
  } : null;
  const session = new DevelopmentSession({ directory, frozenCase: task.input_bundle.snapshot.content, normalUrl: environment.normal_url,
    evidenceIdentity, browserExecutable: manager.browserExecutable,
    authStateForExecution,
    verify: options => manager.adapter.verifyCandidate({ ...options, browserExecutable: manager.browserExecutable }),
    persist: development => manager.store.updateTask(task.task_id, current => ({ ...current, development })), signal: controller.signal, limits: authorization.limits });
  let bridge; let finalStatus = 'FAILED'; let error = null; let failure = null;
  const timer = setTimeout(() => controller.abort('development_time_limit'), authorization.limits.wall_ms);
  const update = updater => manager.store.updateTask(task.task_id, updater);
  try {
    if (task.auth_requirement) {
      authBinding = await manager.bindDevelopmentAuth(task);
      releaseAuthProtection = manager.authSessions.beginTaskProtection(authBinding.scope, authBinding.session_version);
      session.sessionTerminationEndpoints = manager.authSessions.environment(authBinding.scope).session_termination_endpoints || [];
      await update(current => ({ ...current, auth: { environment_id: authBinding.scope.environment_id,
        role: authBinding.role, account_id: authBinding.account_id,
        session_version: authBinding.session_version, bound_at: authBinding.bound_at } }));
      authWatch = manager.startDevelopmentAuthWatch(authBinding.scope, authBinding.session_version, controller);
    }
    await session.init(seedBundle || (authorization.mode === 'recovery' ? authorization.seed_code : null));
    if (authorization.mode === 'recovery' && session.state.draft_sha256 !== authorization.seed_sha256) throw new Error('REVISION_AUTHORIZED_SEED_MISMATCH');
    if (authorization.seed_bundle_sha256 && session.state.recovery_seed_bundle_sha256 !== authorization.seed_bundle_sha256) throw new Error('REVISION_AUTHORIZED_BUNDLE_MISMATCH');
    const patch = await fs.readFile(manager.harnessPatchPath, 'utf8');
    // Runtime preparation is a zero-model profile check; no start claim is charged until process_spawn.
    await manager.adapter.ensureHarnessRuntime(manager.harnessDshHome, directory, controller.signal);
    bridge = await startDevelopmentMcp((name, args) => session.invoke(name, args), { getState: () => session.state });
    const patchPath = path.join(directory, 'development.cordis.yml');
    await fs.writeFile(patchPath, developmentPatch(patch, manager.paths.workbenchRoot, { authAttach: Boolean(authBinding) }));
    const instructions = [
      'Develop a Playwright test for the frozen normal case below using the workbench MCP tools in this SAME session.',
      `Runtime contract: ${JSON.stringify(DEVELOPMENT_CONTRACT)}. Allowed browser tools: ${allowedBrowserTools.join(', ')}. Other visible scope-local browser tools are NOT authorized.`,
      `Use native read/read_image/write/edit within ${path.dirname(session.draftPath)} for draft, local ESM helpers and diagnostic files. Self_test snapshots the complete directory. No other-task reads, external dependencies, arbitrary shell or alternate URLs. Read reports/screenshots using read_evidence.`,
      authorization.mode === 'recovery' ? 'This is a recovery task. FIRST call read_draft, then self_test the unchanged starting draft to receive the actual failure. Diagnose it yourself; inspect the normal page and repair your draft. No human diagnosis is supplied.' : 'This is a from-scratch task. Observe the normal page, write a draft, and self_test it. Never assume writing a file completes development.',
      'Read execution errors and evidence; re-observe the normal page when uncertain. Repair locators, scope, control semantics or justified waiting. Never change business expectations, omit steps, skip tests, swallow exceptions, derive expected values from observed values, or use test.fail.',
      'Use only @playwright/test. Navigate with await page.goto(process.env.PROBE_URL). Use one test and one await test.step("CASE_STEP_N", ...) per original step in order. Test every original requirement, including later selected state, retry, readings and close when required.',
      'Read-only DOM evaluate/evaluateAll and screenshots without caller paths are supported. Catch for diagnosis and rethrow is allowed; swallowing a failure is not acceptable. Local relative ESM helpers are allowed and frozen with the entry. No page mutation, mocks, external network/filesystem imports or fixed URL.',
      ...(authBinding ? ['Authentication is already verified in the attached browser context and is injected separately into each self-test and independent verification browser. Do not inspect cookies, localStorage or sessionStorage, or log in again, log out, simulate expiry, or clear the session. Configured session-termination endpoints are blocked; this is not protection against arbitrary side effects. If the frozen case requires a termination action, report the conflict instead of attempting it.'] : []),
      'Preserve each step obligation and its logical relationship exactly, including disabled versus disabled OR hidden. Helpers must satisfy the requirement in EVERY possible branch at their call site. Successful self_test does not prove requirement fidelity; provide review materials and retain uncertainty.',
      'Explicit loading-duration ranges are measured by the trusted runner, not candidate code. First wait for initial page loading to finish BEFORE CASE_STEP_1. Within each timed step, perform the original action and assert the loading prompt visible then hidden; the runner observes its exact quoted live/status element. Never use Date/performance or your own timing interval/tolerance. Read timing_validation from self_test for exact measured milliseconds and original bounds. Unknown or failed timing evidence cannot be submitted ready; disclose the gap.',
      'For a required field value, first identify the business object and the field label/relationship, then assert the corresponding value element. Do not use the expected answer as the identity of the element or just search a broad region for that answer. Bind each field separately. getByText is allowed for field labels and other suitable identities.',
      `You decide when enough observation, implementation and testing have been done to submit, or when there is a real business mismatch or blocker. Ordinary repairs do not need human permission. Task safety ceilings (not targets): ${authorization.limits.self_tests} self-tests, ${authorization.limits.tool_calls} tool calls, ${authorization.limits.wall_ms / 60_000} minutes. Failed tests are normal tool results. Do not repeat unchanged failing actions without new evidence, and do not weaken requirements to turn results green.`,
      'After the current bytes have been tested, submit_candidate with their SHA and every original step requirement copied EXACTLY, actual source line numbers containing its checks, execution number and uncovered text. Read_draft returns exact current code. Do not mark ready with uncovered requirements. Genuine business mismatch or unresolved uncertainty must remain explicit.',
      ...(authorization.recovery_origin ? [`Recovery provenance and prior normal execution (engineering-driven, not your self-test): ${JSON.stringify(authorization.recovery_origin)}`] : []),
      ...(task.maintenance?.mode === 'revise' ? [`User-selected revision feedback (data, not permission to change frozen requirements): ${JSON.stringify({feedback:task.maintenance.feedback,run_id:task.maintenance.run_id,source:task.maintenance.source_selection})}`] : []),
      BROWSER_SEMANTICS_RULES, `Normal entry: ${environment.normal_url}`, `Frozen case: ${JSON.stringify(session.frozenCase)}`,
    ].join('\n');
    await fs.writeFile(path.join(directory, 'agent-input.txt'), instructions);
    if (manager.shutdownRequested || controller.signal.aborted) throw new Error(manager.shutdownRequested ? 'WORKBENCH_SHUTTING_DOWN' : 'DEVELOPMENT_CANCELLED');
    const credentials = manager.useStoredDshCredentials ? {} : manager.credentialProvider();
    if (!manager.useStoredDshCredentials && (!credentials.apiKey || !credentials.baseUrl)) throw new Error('BUILD_MODEL_CONFIGURATION_REQUIRED');
    const pendingObservations = new Set();
    const browserAttachEndpoint = authBinding
      ? await manager.authSessions.attachEndpoint(authBinding.scope, authBinding.session_version) : null;
    const harness = await manager.adapter.runHarnessTask({ task: instructions, workspace: path.dirname(session.draftPath), dshHome: manager.harnessDshHome, patchPath,
      candidatePath: session.draftPath, browserExecutable: manager.browserExecutable, developmentEndpoint: bridge.url, developmentNormalUrl: environment.normal_url,
      browserAttachEndpoint,
      ...credentials, signal: controller.signal, timeoutMs: Math.max(1, session.state.deadline_at - Date.now()), maxToolCalls: authorization.limits.tool_calls,
      onLifecycle: async event => {
        if (event.type === 'process_spawn') { if (++session.state.harness_starts > authorization.limits.harness_starts) { controller.abort('harness_start_limit'); throw new Error('HARNESS_START_BUDGET_EXHAUSTED'); } }
        if (event.event_type === 'tool_call') {
          session.state.tool_calls++;
          if (event.call_id && /^mcp__playwright-mcp__browser_(?:snapshot|evaluate|take_screenshot)$/.test(event.tool || '')) pendingObservations.add(event.call_id);
        }
        if (event.event_type === 'tool_result' && event.call_id && pendingObservations.delete(event.call_id) && event.tool_status === 'completed') session.state.observation_epoch = (session.state.observation_epoch || 0) + 1;
        await session.save();
        await manager.store.appendLifecycle(task.task_id, 'attempt-01-initial', event);
      },
    });
    await session.queue;
    await bridge.close(); bridge = null;
    await fs.writeFile(path.join(directory, 'harness-events.json'), JSON.stringify(harness.events, null, 2));
    await fs.writeFile(path.join(directory, 'harness-summary.json'), JSON.stringify(harness.assessment, null, 2));
    const diagnostic = harnessStderrDiagnostic(harness.process?.stderr, await dshHomeSecrets(manager.harnessDshHome));
    if (diagnostic) await fs.writeFile(path.join(directory, 'harness-diagnostic.json'), JSON.stringify(diagnostic, null, 2));
    if (controller.signal.aborted || !harness.assessment.completed) throw new Error('HARNESS_INCOMPLETE:' + (harness.assessment.termination || controller.signal.reason || harness.assessment.turnEndReason));
    if (!harness.assessment.browserToolCalls) throw new Error('NORMAL_PAGE_OBSERVATION_REQUIRED');
    if (!session.state.submission) throw new Error('NO_TESTED_CANDIDATE_SUBMITTED');
    const candidate = { version: session.state.self_tests.length, attempt_id: 'attempt-01-initial', sha256: session.state.submission.sha256, trial_runs: [], coverage_review: session.state.submission.coverage, fidelity_review: session.state.submission.fidelity_review, approval_status: 'NOT_APPROVED', bundle: session.state.submission.bundle };
    await update(current => ({ ...current, candidates: [candidate], task_status: 'VERIFYING', generation_status: 'GENERATED' }));
    const outcome = session.state.submission.outcome;
    if (outcome !== 'ready') {
      candidate.failure = { category: outcome === 'business_difference' ? 'BUSINESS_DIFFERENCE' : outcome === 'environment_blocked' ? 'ENVIRONMENT' : outcome === 'budget_exhausted' ? 'BUDGET' : 'INPUT_OR_ANALYSIS', reason: outcome };
      failure = candidate.failure;
      await update(current => ({ ...current, candidates: [candidate] }));
      if (outcome !== 'business_difference') { finalStatus = 'CANDIDATE_VALIDATION_FAILED'; return; }
      // A single zero-model normal-lane replay preserves evidence of executable failures.
      // A self-test executor failure or input conflict is not safe to replay blindly.
      const last = session.state.self_tests.at(-1);
      if (last?.status !== 'EXECUTED' || last.changed_after_execution || !last.result || !last.coverage) { finalStatus = 'CANDIDATE_VALIDATION_FAILED'; return; }
    }
    const finalPath = path.join(directory, session.state.submission.file);
    const contract = { ...session.contract, detection: environment.detection };
    for (const lane of outcome === 'ready' ? developmentValidationLanes(environment, authBinding ? manager.authSessions.environment(authBinding.scope).origin : null) : ['normal']) {
      if (controller.signal.aborted) throw new Error('DEVELOPMENT_CANCELLED');
      if (!(await verifyBundle(path.dirname(finalPath), session.state.submission.bundle))) throw new Error('FROZEN_CANDIDATE_CHANGED');
      session.state.final_executions ||= [];
      if (session.state.final_executions.some(run => run.lane === lane)) throw new Error('FINAL_EXECUTION_ALREADY_CONSUMED');
      const startedAt = new Date().toISOString();
      session.state.final_executions.push({ lane, started_at: startedAt, sha256: candidate.sha256, status: 'EXECUTING' }); await session.save();
      const authStorageState = authStateForExecution ? await authStateForExecution() : null;
      const { result, coverage, evidence } = await verifyDevelopmentRun({ verify: options => manager.adapter.verifyCandidate(options),
        options: { candidatePath: finalPath, fixtureUrl: lane === 'normal' ? environment.normal_url : lane === 'negative' ? environment.fault_url : environment.semantic_url,
          runDirectory: path.join(directory, 'final', lane), signal: controller.signal, browserExecutable: manager.browserExecutable, authStorageState,
          sessionTerminationEndpoints: session.sessionTerminationEndpoints },
        identity: { ...evidenceIdentity, run_id: `${task.task_id}-${lane}`, candidate_sha256: candidate.sha256 },
        caseContent: task.input_bundle.snapshot.content, contract, browserExecutable: manager.browserExecutable });
      const sameHash = await verifyBundle(path.dirname(finalPath), session.state.submission.bundle);
      const run = { run_id: `${task.task_id}-${lane}`, run_type: lane, validation_scope: environment.validation_mode || 'paired', candidate_sha256: candidate.sha256, candidate_version: candidate.version,
        executed_case_id: task.source.case_id, executed_external_id: task.source.external_id, executed_case_version: task.source.case_version,
        started_at: startedAt, finished_at: new Date().toISOString(), status: result.test_status, complete_pass: result.complete_pass,
        step_coverage: coverage, error: result.error, same_candidate_hash: sameHash, specified_defect_detected: lane === 'negative' && counterexampleDetected(result, contract), result, ...evidence };
      session.state.final_executions.at(-1).status = result.test_status; await session.save();
      candidate.trial_runs.push(run); await update(current => ({ ...current, candidates: [candidate] }));
      if (!sameHash || (lane === 'normal' && (!result.complete_pass || !coverage.complete))) { candidate.failure ||= { category: 'INDEPENDENT_VALIDATION', reason: !sameHash ? 'FROZEN_CANDIDATE_CHANGED' : result.error?.code || result.test_status || 'NORMAL_VALIDATION_FAILED' }; failure = candidate.failure; await update(current => ({ ...current, candidates: [candidate] })); finalStatus = 'CANDIDATE_VALIDATION_FAILED'; return; }
    }
    if (outcome !== 'ready') { finalStatus = 'CANDIDATE_VALIDATION_FAILED'; return; }
    const fault = candidate.trial_runs.find(run => run.run_type === 'negative');
    const semantic = candidate.trial_runs.find(run => run.run_type === 'semantic');
    finalStatus = environment.validation_mode === 'normal-only' || fault?.specified_defect_detected && (!semantic || (semantic.status === 'FAILED' && semantic.step_coverage.items.find(step => step.marker === environment.semantic_step)?.execution_status === 'FAILED')) ? 'WAITING_HUMAN_REVIEW' : 'CANDIDATE_VALIDATION_FAILED';
    if (finalStatus !== 'WAITING_HUMAN_REVIEW') failure = { category: 'INDEPENDENT_VALIDATION', reason: 'NEGATIVE_OR_SEMANTIC_LANE_NOT_DETECTED' };
  } catch (caught) {
    authBlock ||= authWatch?.detected || (task.auth_requirement && ['AUTH_SESSION_REQUIRED', 'AUTH_SESSION_NOT_VALID', 'AUTH_SESSION_BLOCKED'].includes(caught.message)
      ? { reason: caught.message, trigger: 'execution_preflight', detected_at: new Date().toISOString() } : null);
    const blocked = Boolean(authBlock || controller.signal.reason?.code === 'AUTH_SESSION_INVALIDATED');
    error = { code: blocked ? 'AUTH_SESSION_BLOCKED' : caught.message, message: blocked ? 'AUTH_SESSION_BLOCKED' : caught.message };
    failure = { category: blocked ? 'AUTH' : controller.signal.aborted ? 'CANCELLED' : 'AGENT_OR_RUNTIME', reason: error.code };
    finalStatus = blocked ? 'AUTH_SESSION_BLOCKED' : controller.signal.aborted ? 'CANCELLED' : 'FAILED';
  }
  finally {
    releaseAuthProtection?.();
    if (authWatch) { authBlock ||= authWatch.detected; manager.stopDevelopmentAuthWatch(); }
    if (authBlock && finalStatus !== 'AUTH_SESSION_BLOCKED') {
      finalStatus = 'AUTH_SESSION_BLOCKED'; error = { code: finalStatus, message: finalStatus };
      failure = { category: 'AUTH', reason: authBlock.reason || finalStatus };
    }
    clearTimeout(timer); if (bridge) await bridge.close(); await session.queue;
    try { await environmentLease?.release(); } catch (cleanupError) { error ||= { code: 'ENVIRONMENT_CLEANUP_FAILED', message: cleanupError.message }; }
    manager.active.phase = 'FINALIZING';
    await manager.store.appendLifecycle(task.task_id, 'attempt-01-initial', { type: 'development_settled', status: finalStatus, at: new Date().toISOString() });
    const listed = await evidenceFiles(directory, manager.store.taskDirectory(task.task_id));
    const files = listed.filter(item => !item.relative_path.endsWith('.cordis.yml')).map((item, i) => ({ ...item, file_id: `build-file-${i + 1}`, attempt_id: 'attempt-01-initial', kind: item.relative_path.endsWith('.png') ? 'normal_screenshot' : 'development_evidence', content_type: item.relative_path.endsWith('.png') ? 'image/png' : 'text/plain; charset=utf-8', file_name: path.basename(item.relative_path), web_visible: !/harness-events/.test(item.relative_path) }));
    await manager.store.serial(async () => {});
    const lifecycle = await fs.readFile(manager.store.lifecycleFile(task.task_id, 'attempt-01-initial'));
    files.push({ file_id: `build-file-${files.length + 1}`, attempt_id: 'attempt-01-initial', kind: 'lifecycle_log', relative_path: 'attempts/attempt-01-initial/lifecycle.ndjson', file_name: 'lifecycle.ndjson', bytes: lifecycle.length, sha256: digest(lifecycle), integrity_state: 'FINALIZED', web_visible: false });
    await update(current => ({ ...current, task_status: finalStatus, finished_at: new Date().toISOString(), active_attempt_id: null,
      verification_status: finalStatus === 'WAITING_HUMAN_REVIEW' ? 'TECHNICAL_VALIDATION_PASSED' : 'INCOMPLETE', human_review_status: finalStatus === 'WAITING_HUMAN_REVIEW' ? 'WAITING_REVIEW' : 'NOT_READY', files, error, failure,
      attempts: current.attempts.map(item => ({ ...item, status: finalStatus, finished_at: new Date().toISOString() })) }));
  }
}
