import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { buildAdapter, usageFromEvents } from './adapter.mjs';
import { indexAttemptFiles } from './files.mjs';
import { counterexampleDetected, parseCandidateReport } from './report.mjs';
import { BUILD_TEMPLATE_ID, loadBuildTemplate, taskDocument } from './template.mjs';
import { sha256File } from '../integrity.mjs';
import { redactText } from '../../../harness-probe/src/redact.mjs';

const MAX_TOOL_CALLS = 30;
const TIMEOUT_MS = 600_000;

function taskId(now) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14).toLowerCase();
  return `build-${stamp}-${randomUUID().slice(0, 8).toLowerCase()}`;
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
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

function promptFor({ kind, template, entryUrl, candidatePath }) {
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
  }

  async templates() {
    const template = await loadBuildTemplate(this.paths);
    return [template.public];
  }

  async submit(templateId) {
    if (templateId !== BUILD_TEMPLATE_ID) throw new Error('BUILD_TEMPLATE_NOT_ALLOWED');
    const template = await loadBuildTemplate(this.paths);
    const now = this.now().toISOString();
    const budget = await this.store.getBudget();
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
      runtime: { os_file_isolation: false, os_network_isolation: false, residual_risk_accepted: true },
      error: null,
    });
  }

  async prepareRuntime() {
    if (!this.browserExecutable) throw new Error('BUILD_BROWSER_EXECUTABLE_REQUIRED');
    if (!this.runtimeReady) {
      this.runtimeReady = this.adapter.ensureHarnessRuntime(
        path.join(this.paths.buildRuntimeRoot, 'dsh'),
        this.paths.workbenchRoot,
      ).catch((error) => { this.runtimeReady = null; throw error; });
    }
    return this.runtimeReady;
  }

  async start(taskId) { return this.#launch(taskId, 'initial'); }
  async revise(taskId) { return this.#launch(taskId, 'revision'); }

  async #launch(taskIdValue, kind) {
    if (this.starting || this.active || this.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
    this.starting = true;
    try {
      const task = await this.store.getTask(taskIdValue);
      if (!task) throw new Error('BUILD_TASK_NOT_FOUND');
      if (kind === 'initial' && (task.task_status !== 'SUBMITTED' || task.attempts.length)) throw new Error('BUILD_INITIAL_NOT_ALLOWED');
      if (kind === 'revision' && (!task.revision_allowed || task.attempts.some((item) => item.kind === 'revision'))) throw new Error('BUILD_REVISION_NOT_ALLOWED');
      const credentials = this.credentialProvider();
      if (!credentials?.apiKey || !credentials?.baseUrl) throw new Error('BUILD_MODEL_CONFIGURATION_REQUIRED');
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
      await fs.writeFile(path.join(workspace, 'task.md'), taskDocument(task.template), { flag: 'wx' });
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
      const budget = await this.store.claimStart(task.task_id, attemptId, startedAt);
      const attempt = {
        attempt_id: attemptId, kind, started_at: startedAt, finished_at: null,
        status: 'RUNNING', max_tool_calls: MAX_TOOL_CALLS, timeout_ms: TIMEOUT_MS,
        harness: null, error: null,
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
      this.active = { taskId: task.task_id, attemptId, controller, phase: 'GENERATING' };
      const completion = this.#execute({ task: next, kind, attemptId, attemptRoot, workspace, candidatePath, credentials, controller })
        .finally(() => { if (this.active?.attemptId === attemptId) this.active = null; });
      this.completions.set(task.task_id, completion);
      completion.catch(() => {});
      return next;
    } finally {
      this.starting = false;
    }
  }

  async #execute(context) {
    const { task, kind, attemptId, attemptRoot, workspace, candidatePath, credentials, controller } = context;
    const template = await loadBuildTemplate(this.paths);
    let normalServer;
    let negativeServer;
    try {
      normalServer = await this.adapter.startFixtureServer(template.internal.normalFixture);
      const prompt = promptFor({ kind, template: task.template, entryUrl: normalServer.url, candidatePath });
      const harnessStarted = Date.now();
      const harness = await this.adapter.runHarnessTask({
        task: prompt,
        workspace,
        dshHome: path.join(this.paths.buildRuntimeRoot, 'dsh'),
        patchPath: path.join(this.paths.repoRoot, 'harness-probe', 'config', 'browser.cordis.yml'),
        candidatePath,
        browserExecutable: this.browserExecutable,
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl,
        timeoutMs: TIMEOUT_MS,
        maxToolCalls: MAX_TOOL_CALLS,
        signal: controller.signal,
      });
      const harnessSummary = {
        assessment: harness.assessment,
        wall_ms: Date.now() - harnessStarted,
        observable_agent_steps: harness.events.filter((event) => event.type === 'status' && event.phase === 'step_end').length,
        total_tool_calls: harness.events.filter((event) => event.type === 'tool_call').length,
        browser_tool_calls: harness.events.filter((event) => event.type === 'tool_call' && /^mcp__playwright-mcp__/.test(event.tool || '')).length,
        provider_request_count: null,
        provider_usage: usageFromEvents(harness.events),
        tool_names: [...new Set(harness.events.filter((event) => event.type === 'tool_call').map((event) => event.tool))].sort(),
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
      };
      await this.store.updateTask(task.task_id, (current) => ({
        ...current, task_status: 'VERIFYING', generation_status: 'GENERATED', verification_status: 'RUNNING',
        candidates: [...current.candidates, candidate],
      }));
      this.active.phase = 'VERIFYING';

      const normalRaw = await this.adapter.verifyCandidate({
        candidatePath, browserExecutable: this.browserExecutable, fixtureUrl: normalServer.url,
        runDirectory: path.join(attemptRoot, 'verification', 'normal'), signal: controller.signal,
      });
      const normal = await parseCandidateReport(normalRaw.reportPath, normalRaw.process);
      const afterNormal = await sha256File(candidatePath);
      await normalServer.close();
      normalServer = null;
      negativeServer = await this.adapter.startFixtureServer(template.internal.negativeFixture);
      const negativeRaw = await this.adapter.verifyCandidate({
        candidatePath, browserExecutable: this.browserExecutable, fixtureUrl: negativeServer.url,
        runDirectory: path.join(attemptRoot, 'verification', 'negative'), signal: controller.signal,
      });
      const negative = await parseCandidateReport(negativeRaw.reportPath, negativeRaw.process);
      const afterNegative = await sha256File(candidatePath);
      const sameCandidate = candidateSha === afterNormal && candidateSha === afterNegative;
      const negativeDetected = counterexampleDetected(negative, task.template.expected, template.internal.counterexampleActual);
      const technicalPass = normal.complete_pass && negativeDetected && sameCandidate;
      const candidateError = technicalPass ? null : normal.error || negative.error || {
        type: 'COUNTEREXAMPLE_NOT_DETECTED', message: '独立错误输出未产生指定断言不符。', expected: null, actual: null, attribution: 'PENDING_ANALYSIS',
      };
      const budget = await this.store.getBudget();
      const indexed = await indexAttemptFiles({
        taskRoot: this.store.taskDirectory(task.task_id), attemptRoot, candidatePath, attemptId,
        startIndex: (await this.store.getTask(task.task_id)).files.length,
      });
      const unexpected = indexed.unexpected;
      const effectivePass = technicalPass && unexpected.length === 0;
      const finalError = unexpected.length ? { code: 'UNREGISTERED_ATTEMPT_OUTPUT', message: `发现未登记输出：${unexpected.join(', ')}` } : candidateError;
      return this.store.updateTask(task.task_id, (current) => ({
        ...current,
        task_status: effectivePass ? 'WAITING_HUMAN_REVIEW' : 'CANDIDATE_VALIDATION_FAILED',
        generation_status: 'GENERATED', verification_status: effectivePass ? 'PASSED' : 'FAILED',
        human_review_status: effectivePass ? 'WAITING_REVIEW' : 'NOT_READY', active_attempt_id: null,
        finished_at: this.now().toISOString(),
        attempts: current.attempts.map((item) => item.attempt_id === attemptId ? {
          ...item, finished_at: this.now().toISOString(), status: effectivePass ? 'COMPLETED' : 'CANDIDATE_VALIDATION_FAILED', harness: harnessSummary, error: finalError,
        } : item),
        candidates: current.candidates.map((item) => item.attempt_id === attemptId ? {
          ...item, verification_status: effectivePass ? 'PASSED' : 'FAILED', normal, negative,
          same_candidate_hash: sameCandidate, counterexample_detected: negativeDetected, error: finalError,
        } : item),
        files: [...current.files, ...indexed.files],
        revision_allowed: !effectivePass && kind === 'initial' && budget.used_starts < budget.max_starts,
        budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts },
        error: finalError,
      }));
    } catch (error) {
      const message = redactText(error?.message || String(error), [credentials.apiKey, credentials.baseUrl]);
      return this.#finishFailure(task.task_id, attemptId, {
        code: controller.signal.aborted ? 'BUILD_CANCELLED' : 'BUILD_EXECUTION_ERROR', message,
      }, null, controller.signal.aborted ? 'CANCELLED' : 'FAILED', attemptRoot, candidatePath);
    } finally {
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
    return this.store.updateTask(taskIdValue, (task) => ({
      ...task,
      task_status: status,
      generation_status: status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
      verification_status: 'NOT_RUN', human_review_status: 'NOT_READY', active_attempt_id: null,
      finished_at: this.now().toISOString(),
      attempts: task.attempts.map((item) => item.attempt_id === attemptId ? {
        ...item, status, finished_at: this.now().toISOString(), harness: harnessSummary, error,
      } : item),
      files: [...task.files, ...indexed.files],
      revision_allowed: false,
      budget: { phase: budget.phase, max_starts: budget.max_starts, used_starts: budget.used_starts },
      error,
    }));
  }

  async stop(taskIdValue) {
    if (!this.active || this.active.taskId !== taskIdValue) throw new Error('BUILD_TASK_NOT_ACTIVE_OR_NOT_OWNED');
    this.active.controller.abort('cancelled');
    return this.store.updateTask(taskIdValue, (task) => ({ ...task, task_status: 'CANCELLING' }));
  }

  async wait(taskIdValue) {
    await this.completions.get(taskIdValue);
    return this.store.getTask(taskIdValue);
  }

  async settle() {
    await Promise.allSettled([...this.completions.values()]);
  }
}
