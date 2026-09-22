import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M4A_QUERY_CASE_AUTHORIZATION_ID, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { holdQ1CasePackage, loadHoldQ1Source } from '../server/build/heldout-query.mjs';
import { createPaths } from '../server/paths.mjs';

const localRoot = path.resolve(process.env.M4A_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm4a-query-case-acceptance'));
const paths = createPaths({ localRoot });
const privateInput = path.join(localRoot, 'private-input', 'hold-q1.case-package.json');
const evidenceRoot = path.join(localRoot, 'evidence');
const summaryFile = path.join(evidenceRoot, 'm4a-real-summary.json');
const privateScreenshot = path.join(evidenceRoot, 'm4a-query-case-web.png');
const publicScreenshot = path.resolve(process.env.M4A_PUBLIC_SCREENSHOT || 'docs/evidence/M4A_QUERY_CASE_REAL_WEB.png');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const useStoredDshCredentials = process.env.M4A_USE_STORED_DSH_CREDENTIALS === '1';
const authorizationId = process.env.M4A_FLASH_RETRY === '1' ? M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID : M4A_QUERY_CASE_AUTHORIZATION_ID;
const requiredSecrets = useStoredDshCredentials ? [] : ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL'];
const harnessDshHome = process.env.M4A_DSH_HOME ? path.resolve(process.env.M4A_DSH_HOME) : undefined;
const harnessPatchPath = process.env.M4A_HARNESS_PATCH ? path.resolve(process.env.M4A_HARNESS_PATCH) : undefined;
const terminalStates = new Set(['WAITING_HUMAN_REVIEW', 'CANDIDATE_VALIDATION_FAILED', 'FAILED', 'CANCELLED', 'INTERRUPTED']);

function hash(buffer) { return createHash('sha256').update(buffer).digest('hex').toUpperCase(); }
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function waitText(page, selector, value) {
  await page.waitForFunction(([target, text]) => document.querySelector(target)?.textContent.includes(text), [selector, value]);
}
async function waitForTask(store, taskId, previousAttempts = 0, timeout = 660_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const task = await store.getTask(taskId);
    if (task && task.attempts.length > previousAttempts && terminalStates.has(task.task_status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`M4A_TASK_TERMINAL_TIMEOUT:${taskId}`);
}
function safeAttempt(attempt) {
  return {
    attempt_id: attempt.attempt_id, kind: attempt.kind, status: attempt.status,
    max_tool_calls: attempt.max_tool_calls, timeout_ms: attempt.timeout_ms,
    authorization_status: attempt.authorization_status, error: attempt.error,
    harness: attempt.harness ? {
      assessment: attempt.harness.assessment, wall_ms: attempt.harness.wall_ms,
      observable_agent_steps: attempt.harness.observable_agent_steps,
      total_tool_calls: attempt.harness.total_tool_calls,
      browser_tool_calls: attempt.harness.browser_tool_calls,
      provider_request_count: attempt.harness.provider_request_count,
      provider_usage: attempt.harness.provider_usage,
      tool_names: attempt.harness.tool_names,
    } : null,
  };
}

const missing = requiredSecrets.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`M4A_MODEL_CONFIGURATION_REQUIRED:${missing.join(',')}`);
await fs.access(browserExecutable);
try {
  await fs.access(summaryFile);
  throw new Error('M4A_REAL_ATTEMPT_ALREADY_RECORDED');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await fs.mkdir(path.dirname(privateInput), { recursive: true });
await fs.mkdir(evidenceRoot, { recursive: true });
const source = await loadHoldQ1Source(paths);
const pkg = await holdQ1CasePackage(paths, { packageId: 'case-package-hold-q1-m4a-real' });
await fs.writeFile(privateInput, `${JSON.stringify(pkg, null, 2)}\n`, { flag: 'wx' });

const emptyRunStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const runManager = { active: null };
let caseStore; let caseManager; let buildStore; let buildManager; let server; let baseUrl;
async function constructRuntime() {
  caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  caseManager = new CaseLibraryManager(caseStore);
  buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId }); await buildStore.init();
  await buildStore.recoverInterrupted();
  buildManager = new BuildTaskManager({
    store: buildStore, caseStore, paths, authorizationId,
    browserExecutable, otherActive: () => Boolean(runManager.active),
    harnessDshHome, harnessPatchPath, useStoredDshCredentials,
  });
  server = createWorkbenchServer({ store: emptyRunStore, manager: runManager, buildStore, buildManager, caseStore, caseManager });
  baseUrl = await listen(server);
}

await constructRuntime();
assert.equal((await buildStore.listTasks()).length, 0, 'do not reuse or reset another task');
assert.equal(await buildStore.getRevalidationAuthorization(), null, 'new M4-A ledger must not replace a prior ledger');

const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
const startedAt = new Date().toISOString();
let task; let taskId; let selectedProject; let selectedCase; let restartReadback = false;
let mediaWebCheck = { screenshots: [], videos: [], traces: [] };
let driverError = null;
try {
  await page.goto(baseUrl);
  const health = await page.request.get(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.status, 'ready');
  assert.equal(health.active_build_task_id, null);
  await page.locator('#new-project-name').fill('M4-A HOLD-Q1 查询迁移');
  await page.locator('#new-project-description').fill('完整原用例、有限建例与独立反例验证');
  await page.locator('#create-project').click();
  await page.locator('#case-project-list').getByText(/M4-A HOLD-Q1 查询迁移/).waitFor();
  await page.locator('#case-import-file').setInputFiles(privateInput);
  await page.locator('#upload-cases').click(); await waitText(page, '#case-message', '已读取');
  await page.locator('#preview-import').click(); await waitText(page, '#case-message', '预览已生成');
  await page.locator('#confirm-import').click(); await waitText(page, '#case-message', '新增 1 条');
  await page.getByRole('cell', { name: 'HOLD-Q1', exact: true }).locator('..').click();
  await page.locator('#case-build-environment').selectOption('heldout-query-q1-v1');
  await page.getByTestId('case-build-version').selectOption('1');
  await page.getByTestId('case-build-create').click(); await waitText(page, '#case-build-message', 'Harness 尚未启动');
  [task] = await buildStore.listTasks();
  taskId = task.task_id;
  selectedProject = await caseStore.getProject(task.source.project_id);
  selectedCase = selectedProject.cases.find((item) => item.case_id === task.source.case_id);
  assert.equal(task.source.external_id, 'HOLD-Q1');
  assert.equal(task.source.content_sha256, source.content_sha256);
  assert.equal(task.environment_ref.environment_id, 'heldout-query-q1-v1');
  assert.equal(task.authorization.max_starts, process.env.M4A_FLASH_RETRY === '1' ? 1 : 2);
  await page.waitForFunction(() => !document.querySelector('[data-testid="build-start"]')?.disabled);
  await page.getByTestId('build-start').click();
  task = await waitForTask(buildStore, taskId, 0);
  if (task.task_status === 'CANDIDATE_VALIDATION_FAILED' && task.revision_allowed) {
    const errorType = task.candidates.at(-1)?.error?.type || task.error?.type || task.error?.code;
    if (!['PROJECT_CASE_STEP_COVERAGE_INCOMPLETE', 'ASSERTION_MISMATCH', 'ASSERTION_VALUE_UNAVAILABLE'].includes(errorType)) {
      throw new Error(`M4A_REVISION_NOT_JUSTIFIED:${errorType || 'UNKNOWN'}`);
    }
    await page.getByTestId('build-revise').click();
    task = await waitForTask(buildStore, taskId, 1);
  }
  await page.waitForFunction(([id, states]) => {
    const selected = document.querySelector(`#build-history button.selected[data-task-id="${CSS.escape(id)}"]`);
    const status = document.querySelector('#build-statuses')?.textContent || '';
    return Boolean(selected) && states.some((state) => status.includes(state));
  }, [taskId, [...terminalStates]], { timeout: 30_000 });

  if (task.task_status === 'WAITING_HUMAN_REVIEW' && task.candidates.length) {
    const candidate = task.candidates.at(-1);
    const candidateFile = path.join(buildStore.taskDirectory(taskId), candidate.relative_path);
    assert.equal(hash(await fs.readFile(candidateFile)), candidate.sha256);
    for (const lane of ['normal', 'negative']) {
      const screenshot = page.locator(`[data-testid="candidate-${lane}-screenshot"]`);
      await screenshot.waitFor();
      assert.equal(await screenshot.evaluate((image) => image.complete && image.naturalWidth > 0), true);
      mediaWebCheck.screenshots.push(lane);
      const video = page.locator(`[data-testid="candidate-${lane}-video"]`);
      await video.waitFor();
      await video.evaluate(async (element) => { await element.play(); });
      await page.waitForTimeout(300);
      await video.evaluate((element) => element.pause());
      const pausedAt = await video.evaluate((element) => element.currentTime);
      assert.ok(pausedAt > 0);
      mediaWebCheck.videos.push(lane);
      const traceKind = lane === 'normal' ? 'normal_trace' : 'counterexample_trace';
      const trace = task.files.find((item) => item.attempt_id === candidate.attempt_id && item.kind === traceKind);
      const response = await page.request.get(`${baseUrl}/api/build/tasks/${taskId}/media/${trace.file_id}`);
      assert.equal(response.status(), 200);
      assert.equal(hash(await response.body()), trace.sha256);
      mediaWebCheck.traces.push(lane);
    }
  }
  await fs.mkdir(path.dirname(publicScreenshot), { recursive: true });
  await page.screenshot({ path: privateScreenshot, fullPage: true });
  await page.screenshot({ path: publicScreenshot, fullPage: true });

  await close(server);
  await buildManager.settle();
  await constructRuntime();
  await page.goto(baseUrl);
  await page.locator('#case-project-list').getByText(/M4-A HOLD-Q1 查询迁移/).click();
  await page.getByRole('cell', { name: 'HOLD-Q1', exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(taskId).click();
  task = await buildStore.getTask(taskId);
  assert.equal(terminalStates.has(task.task_status), true);
  assert.equal((await page.request.get(`${baseUrl}/api/health`).then((response) => response.json())).active_build_task_id, null);
  restartReadback = true;
} catch (error) {
  driverError = { name: error.name || 'Error', message: String(error.message || error).slice(0, 500) };
} finally {
  await browser.close();
  if (server?.listening) await close(server);
  await buildManager?.settle();
}

task = taskId ? await buildStore.getTask(taskId) : task;
const authorization = await buildStore.getRevalidationAuthorization();
const candidate = task?.candidates?.at(-1) || null;
const summary = {
  schema: 'workbench/m4a-query-case-real-summary-v1', started_at: startedAt, finished_at: new Date().toISOString(),
  model_configuration: { provider: 'deepseek-official', model: process.env.M4A_MODEL_LABEL || 'deepseek-v4-pro', credential_source: useStoredDshCredentials ? 'dsh-home' : 'process-environment' },
  task_id: taskId, task_status: task?.task_status, generation_status: task?.generation_status,
  verification_status: task?.verification_status, human_review_status: task?.human_review_status,
  source: task?.source, environment_ref: task?.environment_ref,
  imported_case: selectedCase ? { case_id: selectedCase.case_id, external_id: selectedCase.external_id, version: selectedCase.current_version, content_sha256: selectedCase.versions[0].content_sha256 } : null,
  frozen_sources: source.source,
  authorization: authorization ? { authorization_id: authorization.authorization_id, used_starts: authorization.used_starts, max_starts: authorization.max_starts, claims: authorization.claims } : null,
  attempts: task?.attempts?.map(safeAttempt) || [],
  candidate: candidate ? {
    version: candidate.version, sha256: candidate.sha256, bytes: candidate.bytes,
    same_candidate_hash: candidate.same_candidate_hash, counterexample_detected: candidate.counterexample_detected,
    project_case_step_mapping: candidate.project_case_step_mapping, normal: candidate.normal, negative: candidate.negative,
  } : null,
  registered_files: task?.files?.map(({ file_id, attempt_id, kind, file_name, bytes, sha256, web_visible }) => ({ file_id, attempt_id, kind, file_name, bytes, sha256, web_visible })) || [],
  media_web_check: mediaWebCheck, restart_readback: restartReadback, driver_error: driverError,
  private_web_screenshot: privateScreenshot, public_web_screenshot: publicScreenshot,
};
await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ task_id: taskId, task_status: task?.task_status, candidates: task?.candidates?.length || 0,
  authorization: `${authorization?.used_starts ?? 0}/${authorization?.max_starts ?? 2}`, summary: summaryFile }));
if (task?.task_status !== 'WAITING_HUMAN_REVIEW' || driverError) process.exitCode = 1;
