import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { WorkbenchRunManager } from '../server/executor.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const assetId = 'reviewed-project-case-4b183ad25305';
const expectedCandidateSha = '4B183AD25305913547C309A86F273DAAB861004313385A5DEF3094385F3B0730';
const localRoot = path.resolve(process.env.M3C_ACCEPTANCE_ROOT || process.env.WORKBENCH_DATA_DIR || path.join(process.cwd(), '.local', 'm3b2-project-case-acceptance'));
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const paths = createPaths({ localRoot });
const evidenceRoot = path.join(localRoot, 'evidence');
const summaryFile = path.join(evidenceRoot, 'm3c-reviewed-asset-summary.json');
const publicNormalScreenshot = path.resolve('docs/evidence/M3C_REVIEWED_ASSET_NORMAL_WEB.png');
const publicCounterexampleScreenshot = path.resolve('docs/evidence/M3C_REVIEWED_ASSET_COUNTEREXAMPLE_WEB.png');

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex').toUpperCase();
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) { await new Promise((resolve) => server.close(resolve)); }

await fs.access(browserExecutable);
try {
  await fs.access(summaryFile);
  throw new Error('M3C_REAL_ACCEPTANCE_ALREADY_RECORDED');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

let store; let caseStore; let manager; let server; let baseUrl;
const buildStore = {
  async getBudget() { return null; },
  async getRevalidationAuthorization() { return null; },
  async listTasks() { return []; },
};
const buildManager = {
  active: null,
  diagnostics() { return { storage_status: 'READY' }; },
  async templates() { return []; },
};
async function constructRuntime() {
  store = new WorkbenchStore(paths.dataRoot); await store.init();
  caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  manager = new WorkbenchRunManager({ store, paths, browserExecutable });
  const caseManager = new CaseLibraryManager(caseStore);
  server = createWorkbenchServer({ store, manager, buildStore, buildManager, caseStore, caseManager });
  baseUrl = await listen(server);
}

await fs.mkdir(evidenceRoot, { recursive: true });
await fs.mkdir(path.dirname(publicNormalScreenshot), { recursive: true });
await constructRuntime();
const asset = await store.getAsset(assetId);
assert.ok(asset, 'reviewed asset must be registered before the real acceptance');
assert.equal(asset.script.sha256, expectedCandidateSha);
const managedCandidate = path.join(store.assetVersionDirectory(asset.asset_id, asset.version), asset.script.relative_path);
assert.equal(hash(await fs.readFile(managedCandidate)), expectedCandidateSha);
assert.equal((await store.listRuns()).filter((run) => run.asset_id === assetId).length, 0, 'refuse to substitute a previous run');

const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
const startedAt = new Date().toISOString();
let normal; let counterexample; let restartReadback = false;
const mediaChecks = {};

async function selectProjectCase() {
  await page.locator('#case-project-list').getByText(/M3-B2 真实建例项目/).click();
  await page.getByRole('cell', { name: 'M3B2-001', exact: true }).locator('..').click();
  await page.getByTestId('case-reviewed-run').waitFor();
}
async function verifyMedia(run, lane) {
  assert.deepEqual(new Set(run.media.map((item) => item.kind)), new Set(['screenshot', 'video', 'trace']));
  const checks = { screenshot: false, video: false, trace: false };
  const runButton = page.locator(`#case-reviewed-assets button[data-run-id="${run.run_id}"]`);
  await runButton.click();
  await page.locator('#detail').waitFor();
  const screenshot = page.locator('#media img').first();
  await screenshot.waitFor();
  checks.screenshot = await screenshot.evaluate((image) => image.complete && image.naturalWidth > 0);
  assert.equal(checks.screenshot, true);
  const video = page.locator('#media video').first();
  await video.waitFor();
  await video.evaluate(async (element) => { await element.play(); });
  await page.waitForTimeout(350);
  await video.evaluate((element) => element.pause());
  const pausedAt = await video.evaluate((element) => element.currentTime);
  assert.ok(pausedAt > 0);
  await video.evaluate((element) => { element.currentTime = Math.min(Math.max(element.duration * 0.5, 0.05), Math.max(element.duration - 0.05, 0.05)); });
  await page.waitForTimeout(250);
  checks.video = await video.evaluate((element) => Number.isFinite(element.currentTime) && element.currentTime > 0 && element.paused);
  assert.equal(checks.video, true);
  const trace = run.media.find((item) => item.kind === 'trace');
  const response = await page.request.get(`${baseUrl}/api/runs/${run.run_id}/media/${trace.media_id}`);
  assert.equal(response.status(), 200);
  assert.equal(hash(await response.body()), trace.sha256);
  checks.trace = true;
  mediaChecks[lane] = checks;
}

try {
  await page.goto(baseUrl);
  const health = await page.request.get(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.status, 'ready');
  assert.equal(health.active_run_id, null);
  await selectProjectCase();
  assert.match(await page.locator('#case-reviewed-assets').innerText(), /已首审，仅适用于本合成场景/);
  await page.getByTestId('case-reviewed-run').click();
  await page.waitForFunction((id) => document.querySelector(`#case-reviewed-assets button[data-run-id]`)?.dataset.runId?.startsWith('run-'), assetId);
  normal = (await store.listRuns()).find((run) => run.asset_id === assetId && run.run_mode === 'NORMAL_REGRESSION');
  assert.ok(normal);
  normal = await manager.waitFor(normal.run_id);
  assert.equal(normal.test_status, 'PASSED');
  assert.equal(normal.summary.playwright_pass, true);
  assert.equal(normal.summary.complete_pass, true);
  assert.equal(normal.process.exit_code, 0);
  assert.equal(normal.steps.length, 2);
  assert.equal(normal.steps.every((step) => step.status === 'PASSED'), true);
  await page.waitForFunction((runId) => document.querySelector(`#case-reviewed-assets button[data-run-id="${runId}"]`)?.textContent.includes('PASSED'), normal.run_id);
  await verifyMedia(normal, 'normal');
  await page.screenshot({ path: publicNormalScreenshot, fullPage: true });

  counterexample = await manager.startAcceptance(assetId, 'counterexample');
  counterexample = await manager.waitFor(counterexample.run_id);
  assert.equal(counterexample.test_status, 'FAILED');
  assert.equal(counterexample.summary.complete_pass, false);
  assert.equal(counterexample.process.exit_code, 1);
  assert.equal(counterexample.error.type, 'ASSERTION_MISMATCH');
  assert.equal(counterexample.error.expected, 'PROBE-42');
  assert.equal(counterexample.error.actual, 'PROBE-41');
  await page.waitForFunction((runId) => document.querySelector(`#case-reviewed-assets button[data-run-id="${runId}"]`)?.textContent.includes('FAILED'), counterexample.run_id);
  await verifyMedia(counterexample, 'counterexample');
  assert.match(await page.locator('#error').innerText(), /PROBE-42/);
  assert.match(await page.locator('#error').innerText(), /PROBE-41/);
  await page.screenshot({ path: publicCounterexampleScreenshot, fullPage: true });

  assert.equal(hash(await fs.readFile(managedCandidate)), expectedCandidateSha);
  const beforeRestartRunIds = (await store.listRuns()).filter((run) => run.asset_id === assetId).map((run) => run.run_id).sort();
  await close(server);
  await constructRuntime();
  await page.goto(baseUrl);
  await selectProjectCase();
  const afterRestartRunIds = (await store.listRuns()).filter((run) => run.asset_id === assetId).map((run) => run.run_id).sort();
  assert.deepEqual(afterRestartRunIds, beforeRestartRunIds);
  assert.equal(manager.active, null);
  assert.match(await page.locator('#case-reviewed-assets').innerText(), new RegExp(normal.run_id));
  assert.match(await page.locator('#case-reviewed-assets').innerText(), new RegExp(counterexample.run_id));
  restartReadback = true;
} finally {
  await browser.close();
  if (server?.listening) await close(server);
}

const summary = {
  schema: 'workbench/m3c-reviewed-asset-acceptance-v1', started_at: startedAt, finished_at: new Date().toISOString(),
  asset: { asset_id: asset.asset_id, version: asset.version, scope: asset.scope, candidate_sha256: asset.script.sha256, review_sha256: asset.review_basis.sha256, project_case: asset.project_case, source_build: asset.source_build },
  normal: { run_id: normal.run_id, execution_status: normal.execution_status, report_status: normal.report_status, test_status: normal.test_status, evidence_status: normal.evidence_status, complete_pass: normal.summary.complete_pass, exit_code: normal.process.exit_code, steps: normal.steps, media: normal.media },
  counterexample: { run_id: counterexample.run_id, execution_status: counterexample.execution_status, report_status: counterexample.report_status, test_status: counterexample.test_status, evidence_status: counterexample.evidence_status, complete_pass: counterexample.summary.complete_pass, exit_code: counterexample.process.exit_code, error: counterexample.error, steps: counterexample.steps, media: counterexample.media },
  media_web_checks: mediaChecks, restart_readback: restartReadback,
  model_calls: 0, harness_starts: 0, candidate_sha256_after: hash(await fs.readFile(managedCandidate)),
  public_screenshots: [path.relative(paths.repoRoot, publicNormalScreenshot).replaceAll('\\', '/'), path.relative(paths.repoRoot, publicCounterexampleScreenshot).replaceAll('\\', '/')],
};
await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ asset_id: asset.asset_id, normal_run_id: normal.run_id, counterexample_run_id: counterexample.run_id, restart_readback: restartReadback, summary: summaryFile }));
