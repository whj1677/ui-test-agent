import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M3B2_PROJECT_CASE_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const localRoot = path.resolve(process.env.M3B2_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm3b2-project-case-acceptance'));
const paths = createPaths({ localRoot });
const sourceSummaryFile = path.join(localRoot, 'evidence', 'm3b2-real-summary.json');
const readbackSummaryFile = path.join(localRoot, 'evidence', 'm3b2-real-readback-summary.json');
const publicScreenshot = path.resolve('docs/evidence/M3B2_PROJECT_CASE_REAL_WEB.png');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex').toUpperCase();
const emptyRunStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const runManager = { active: null };

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
async function makeRuntime() {
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const caseManager = new CaseLibraryManager(caseStore);
  const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M3B2_PROJECT_CASE_AUTHORIZATION_ID }); await buildStore.init();
  await buildStore.recoverInterrupted();
  const buildManager = new BuildTaskManager({ store: buildStore, caseStore, paths, authorizationId: M3B2_PROJECT_CASE_AUTHORIZATION_ID });
  const server = createWorkbenchServer({ store: emptyRunStore, manager: runManager, buildStore, buildManager, caseStore, caseManager });
  return { buildStore, buildManager, server, baseUrl: await listen(server) };
}
async function selectTask(page, task, baseUrl) {
  await page.goto(baseUrl);
  await page.locator('#case-project-list').getByText(/M3-B2 真实建例项目/).click();
  await page.getByRole('cell', { name: task.source.external_id, exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(task.task_id).click();
  await page.waitForFunction((id) => Boolean(document.querySelector(`#build-history button.selected[data-task-id="${CSS.escape(id)}"]`)) &&
    document.querySelector('#build-statuses')?.textContent.includes('WAITING_HUMAN_REVIEW'), task.task_id);
}

await fs.access(sourceSummaryFile);
await fs.access(browserExecutable);
let runtime = await makeRuntime();
let tasks = await runtime.buildStore.listTasks();
assert.equal(tasks.length, 1);
let task = tasks[0];
assert.equal(task.task_status, 'WAITING_HUMAN_REVIEW');
assert.equal(task.candidates.length, 1);
const authorization = await runtime.buildStore.getRevalidationAuthorization();
assert.equal(authorization.used_starts, 1);
assert.equal(authorization.claims.length, 1);

const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
const checked = { screenshots: [], videos: [], traces: [] };
let authorizationAfter = authorization;
try {
  await selectTask(page, task, runtime.baseUrl);
  assert.match(await page.locator('#build-input-state').textContent(), /WAITING_HUMAN_REVIEW/);
  assert.match(await page.locator('#build-candidates').textContent(), /正常验证 · PASSED/);
  assert.match(await page.locator('#build-candidates').textContent(), /独立反例 · FAILED/);
  assert.match(await page.locator('#build-candidates').textContent(), /期望：PROBE-42 · 实际：PROBE-41/);
  assert.match(await page.locator('#build-candidates').textContent(), /等待人工核对/);
  assert.match(await page.locator('#build-candidates').textContent(), /CASE_STEP_1 · 已在报告观察/);
  assert.match(await page.locator('#build-candidates').textContent(), /CASE_STEP_2 · 已在报告观察/);
  for (const lane of ['normal', 'negative']) {
    const screenshot = page.locator(`[data-testid="candidate-${lane}-screenshot"]`);
    await screenshot.waitFor();
    assert.equal(await screenshot.evaluate((image) => image.complete && image.naturalWidth > 0), true);
    checked.screenshots.push(lane);
    const video = page.locator(`[data-testid="candidate-${lane}-video"]`);
    await video.waitFor();
    await video.evaluate(async (element) => { await element.play(); });
    await page.waitForTimeout(300);
    await video.evaluate((element) => element.pause());
    const pausedAt = await video.evaluate((element) => element.currentTime);
    await page.waitForTimeout(2200);
    assert.ok(pausedAt > 0);
    assert.ok(Math.abs(await video.evaluate((element) => element.currentTime) - pausedAt) < 0.15);
    await video.evaluate((element) => { element.currentTime = Math.min(0.2, element.duration || 0.2); });
    checked.videos.push(lane);
    const prefix = lane === 'normal' ? 'normal' : 'counterexample';
    const trace = task.files.find((item) => item.kind === `${prefix}_trace`);
    const response = await page.request.get(`${runtime.baseUrl}/api/build/tasks/${task.task_id}/media/${trace.file_id}`);
    assert.equal(response.status(), 200);
    assert.equal(hash(await response.body()), trace.sha256);
    checked.traces.push(lane);
  }
  await fs.mkdir(path.dirname(publicScreenshot), { recursive: true });
  await page.screenshot({ path: publicScreenshot, fullPage: true });

  await close(runtime.server);
  await runtime.buildManager.settle();
  runtime = await makeRuntime();
  task = await runtime.buildStore.getTask(task.task_id);
  await selectTask(page, task, runtime.baseUrl);
  assert.equal(task.task_status, 'WAITING_HUMAN_REVIEW');
  authorizationAfter = await runtime.buildStore.getRevalidationAuthorization();
  assert.equal(authorizationAfter.used_starts, 1);
} finally {
  await browser.close();
  if (runtime.server.listening) await close(runtime.server);
  await runtime.buildManager.settle();
}

const summary = {
  schema: 'workbench/m3b2-project-case-readback-v1', checked_at: new Date().toISOString(),
  source_summary_sha256: hash(await fs.readFile(sourceSummaryFile)), task_id: task.task_id,
  candidate_sha256: task.candidates[0].sha256, task_status: task.task_status,
  normal: task.candidates[0].normal.test_status, counterexample: task.candidates[0].negative.test_status,
  expected: task.candidates[0].negative.error.expected, actual: task.candidates[0].negative.error.actual,
  media_web_check: checked, restart_readback: true, harness_starts_after_readback: authorizationAfter.used_starts,
  public_web_screenshot: publicScreenshot,
};
await fs.writeFile(readbackSummaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
