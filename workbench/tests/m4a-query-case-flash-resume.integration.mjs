import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const localRoot = path.resolve(process.env.M4A_ACCEPTANCE_ROOT || '');
const taskId = process.env.M4A_RESUME_TASK_ID;
const dshHome = path.resolve(process.env.M4A_DSH_HOME || '');
const harnessPatchPath = path.resolve(process.env.M4A_HARNESS_PATCH || '');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
const publicScreenshot = path.resolve(process.env.M4A_PUBLIC_SCREENSHOT || 'docs/evidence/M4A_QUERY_CASE_FLASH_RETRY_WEB.png');
if (!localRoot || !taskId || !dshHome || !harnessPatchPath || !browserExecutable) throw new Error('M4A_FLASH_RESUME_CONFIGURATION_REQUIRED');

const paths = createPaths({ localRoot });
const evidenceRoot = path.join(localRoot, 'evidence');
const readbackOnly = process.env.M4A_READBACK_ONLY === '1';
const summaryFile = path.join(evidenceRoot, process.env.M4A_SUMMARY_FILE || 'm4a-flash-resume-summary.json');
const privateScreenshot = path.join(evidenceRoot, 'm4a-query-case-flash-resume-web.png');
const terminalStates = new Set(['WAITING_HUMAN_REVIEW', 'CANDIDATE_VALIDATION_FAILED', 'FAILED', 'CANCELLED', 'INTERRUPTED']);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex').toUpperCase();
const close = (server) => new Promise((resolve) => server.close(resolve));
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function waitForTask(store, id, timeout = 660_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const task = await store.getTask(id);
    if (task?.attempts?.length && terminalStates.has(task.task_status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`M4A_TASK_TERMINAL_TIMEOUT:${id}`);
}

const emptyRunStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const runManager = { active: null };
let caseStore; let caseManager; let buildStore; let buildManager; let server; let baseUrl;
async function constructRuntime() {
  caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  caseManager = new CaseLibraryManager(caseStore);
  buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID }); await buildStore.init();
  await buildStore.recoverInterrupted();
  buildManager = new BuildTaskManager({
    store: buildStore, caseStore, paths, authorizationId: M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID,
    browserExecutable, otherActive: () => Boolean(runManager.active),
    harnessDshHome: dshHome, harnessPatchPath, useStoredDshCredentials: true,
  });
  server = createWorkbenchServer({ store: emptyRunStore, manager: runManager, buildStore, buildManager, caseStore, caseManager });
  baseUrl = await listen(server);
}

await constructRuntime();
let task = await buildStore.getTask(taskId);
assert.equal(readbackOnly ? terminalStates.has(task?.task_status) : task?.task_status === 'SUBMITTED', true);
assert.equal(readbackOnly ? task?.attempts?.length === 1 : task?.attempts?.length === 0, true);
const beforeAuthorization = await buildStore.getRevalidationAuthorization();
assert.equal(beforeAuthorization.used_starts, readbackOnly ? 1 : 0);
assert.equal(beforeAuthorization.max_starts, 1);

const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
const startedAt = new Date().toISOString();
const mediaWebCheck = { screenshots: [], videos: [], traces: [] };
let restartReadback = false; let driverError = null;
try {
  await page.goto(baseUrl);
  await page.locator('#case-project-list').getByText(/M4-A HOLD-Q1 查询迁移/).click();
  await page.getByRole('cell', { name: 'HOLD-Q1', exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(taskId).click();
  if (!readbackOnly) {
    await page.waitForFunction(() => !document.querySelector('[data-testid="build-start"]')?.disabled);
    await page.getByTestId('build-start').click();
    task = await waitForTask(buildStore, taskId);
  }
  await page.waitForFunction(([id, states]) => {
    const selected = document.querySelector(`#build-history button.selected[data-task-id="${CSS.escape(id)}"]`);
    const status = document.querySelector('#build-statuses')?.textContent || '';
    return Boolean(selected) && states.some((state) => status.includes(state));
  }, [taskId, [...terminalStates]], { timeout: 30_000 });
  if (task.candidates.length === 1) {
    const candidate = task.candidates[0];
    const candidateDescriptor = task.files.find((item) => item.attempt_id === candidate.attempt_id && item.kind === 'candidate');
    assert.ok(candidateDescriptor, 'registered candidate file is required');
    const candidateFile = path.join(buildStore.taskDirectory(taskId), candidateDescriptor.relative_path);
    assert.equal(hash(await fs.readFile(candidateFile)), candidate.sha256);
    for (const lane of ['normal', 'negative']) {
      const screenshot = page.locator(`[data-testid="candidate-${lane}-screenshot"]`); await screenshot.waitFor();
      assert.equal(await screenshot.evaluate((image) => image.complete && image.naturalWidth > 0), true);
      mediaWebCheck.screenshots.push(lane);
      const video = page.locator(`[data-testid="candidate-${lane}-video"]`); await video.waitFor();
      await video.evaluate(async (element) => { await element.play(); }); await page.waitForTimeout(300);
      await video.evaluate((element) => element.pause());
      assert.ok(await video.evaluate((element) => element.currentTime) > 0);
      mediaWebCheck.videos.push(lane);
      const traceKind = lane === 'normal' ? 'normal_trace' : 'counterexample_trace';
      const trace = task.files.find((item) => item.attempt_id === candidate.attempt_id && item.kind === traceKind);
      const response = await page.request.get(`${baseUrl}/api/build/tasks/${taskId}/media/${trace.file_id}`);
      assert.equal(response.status(), 200); assert.equal(hash(await response.body()), trace.sha256);
      mediaWebCheck.traces.push(lane);
    }
  }
  await fs.mkdir(path.dirname(publicScreenshot), { recursive: true });
  await page.screenshot({ path: privateScreenshot, fullPage: true });
  await page.screenshot({ path: publicScreenshot, fullPage: true });
  await close(server); await buildManager.settle();
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

task = await buildStore.getTask(taskId);
const authorization = await buildStore.getRevalidationAuthorization();
const candidate = task.candidates?.[0] || null;
const summary = {
  schema: 'workbench/m4a-query-case-flash-resume-summary-v1', started_at: startedAt, finished_at: new Date().toISOString(),
  task_id: taskId, task_status: task.task_status, generation_status: task.generation_status,
  verification_status: task.verification_status, human_review_status: task.human_review_status,
  model_configuration: { provider: 'deepseek-official', model: 'deepseek-flash', credential_source: 'dsh-home' },
  source: task.source, environment_ref: task.environment_ref,
  authorization: { authorization_id: authorization.authorization_id, used_starts: authorization.used_starts, max_starts: authorization.max_starts, claims: authorization.claims },
  attempts: task.attempts, candidate, registered_files: task.files,
  media_web_check: mediaWebCheck, restart_readback: restartReadback, driver_error: driverError,
  private_web_screenshot: privateScreenshot, public_web_screenshot: publicScreenshot,
};
await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ task_id: taskId, task_status: task.task_status, candidates: task.candidates.length,
  authorization: `${authorization.used_starts}/${authorization.max_starts}`, summary: summaryFile }));
if ((!readbackOnly && task.task_status !== 'WAITING_HUMAN_REVIEW') || driverError) process.exitCode = 1;
