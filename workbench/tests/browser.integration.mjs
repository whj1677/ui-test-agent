import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { createPaths } from '../server/paths.mjs';
import { buildApprovedAsset } from '../server/registry.mjs';
import { WorkbenchStore } from '../server/store.mjs';
import { sha256File } from '../server/integrity.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';

const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-browser-'));
const paths = createPaths({ localRoot });
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
await caseStore.init();
const asset = await buildApprovedAsset(paths, { registeredAt: '2026-09-20T00:00:00.000Z' });
await store.registerAsset(asset);

const runId = 'run-web-12345678';
let requestedEnvironmentId = null;
const manager = {
  active: null,
  async start(assetId, environmentId) {
    assert.equal(assetId, asset.asset_id);
    requestedEnvironmentId = environmentId;
    const environment = asset.allowed_environments.find((item) => item.id === environmentId);
    const run = {
      schema: 'approved-workbench/run-v1', run_id: runId, asset_id: asset.asset_id, asset_version: asset.version,
      case_id: environment.case_id, source_commit: asset.source_commit, environment,
      created_at: '2026-09-20T10:00:00.000Z', started_at: '2026-09-20T10:00:01.000Z', finished_at: null,
      execution_status: 'RUNNING', report_status: 'PENDING', test_status: 'PENDING', evidence_status: 'PENDING',
      process: { pid: 12345, state: 'RUNNING', exit_code: null, signal: null },
      integrity: { expected_sha256: asset.script.sha256, source_before_sha256: asset.script.sha256, source_after_sha256: null },
      runtime: { browser: 'chromium', workers: 1, retries: 0, model_calls: 0, healer: false },
      steps: environment.steps.map((step) => ({ ...step, status: 'PENDING', error: null })), media: [], summary: null,
      error: { type: 'TEST_TEXT', message: '<img id="injected" src=x> 必须作为文本显示', attribution: 'PENDING_ANALYSIS' },
    };
    await store.createRun(run);
    this.active = { runId };
    return run;
  },
  async stop(requestedRunId) {
    assert.equal(requestedRunId, runId);
    this.active = null;
    return store.updateRun(runId, (run) => ({
      ...run, execution_status: 'CANCELLED', finished_at: '2026-09-20T10:00:02.000Z',
      process: { ...run.process, pid: null, state: 'ENDED', exit_code: 1 },
      report_status: 'MISSING', test_status: 'NOT_RUN', evidence_status: 'INCOMPLETE',
      steps: run.steps.map((step) => ({ ...step, status: 'NOT_EXECUTED' })),
    }));
  },
};

const buildBudget = {
  schema: 'workbench/build-stage-budget-v1', phase: 'M2-C', max_starts: 2, used_starts: 0, claims: [],
};
const buildStore = {
  async getBudget() { return buildBudget; },
  async listTasks() { return []; },
};
const buildManager = {
  active: null,
  async templates() {
    return [{
      template_id: 'synthetic-probe-v1', version: '1.0.0', title: '合成探针候选建例',
      summary: '浏览器点击后验证固定输出。', input_sha256: 'a'.repeat(64),
      allowed_entry: { kind: 'fixture', route: '/probe' },
    }];
  },
};

const server = createWorkbenchServer({ store, manager, buildStore, buildManager, caseStore });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
const consoleErrors = [];
const failedResponses = [];
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

try {
  await page.goto(baseUrl);
  await page.getByTestId('asset-card').waitFor();
  await page.getByTestId('environment-select').selectOption('fault');
  await page.waitForTimeout(2300);
  assert.equal(await page.getByTestId('environment-select').inputValue(), 'fault');
  await page.getByTestId('run-button').click();
  await page.getByTestId('history').locator(`button[data-run-id="${runId}"]`).waitFor();
  await page.getByTestId('run-detail').waitFor();
  assert.match(await page.getByTestId('run-detail').innerText(), /RUNNING/);
  assert.equal(requestedEnvironmentId, 'fault');
  assert.match(await page.getByTestId('run-detail').innerText(), /\/probe\/s2/);
  assert.equal(await page.getByTestId('environment-select').isDisabled(), true);
  assert.equal(await page.getByTestId('run-button').isDisabled(), true);
  assert.equal(await page.locator('#injected').count(), 0);
  assert.match(await page.locator('#error').innerText(), /<img id=\\"injected\\"/);
  await page.getByTestId('stop-button').click();
  await page.getByText('CANCELLED', { exact: true }).first().waitFor();
  assert.equal(await page.getByTestId('environment-select').isEnabled(), true);
  await page.getByTestId('environment-select').selectOption('normal');
  await page.waitForTimeout(1100);
  assert.equal(await page.getByTestId('environment-select').inputValue(), 'normal');
  assert.equal(await page.getByTestId('history').locator(`button[data-run-id="${runId}"]`).count(), 1);
  // Synthetic historical media: no private project or original recording is needed.
  const artifact = path.join(store.runDirectory(runId), 'artifacts', 'history.png');
  await fs.mkdir(path.dirname(artifact), { recursive: true });
  await page.screenshot({ path: artifact });
  const digest = await sha256File(artifact);
  const artifactBytes = (await fs.stat(artifact)).size;
  await store.updateRun(runId, (run) => ({ ...run, media: [{
    media_id: 'history-image', kind: 'screenshot', content_type: 'image/png',
    file_name: 'history.png', relative_path: 'artifacts/history.png',
    sha256: digest, bytes: artifactBytes,
  }] }));
  const beforeRead = await fs.readFile(path.join(store.runDirectory(runId), 'run.json'));
  await page.reload();
  await page.getByTestId('history').locator(`button[data-run-id="${runId}"]`).click();
  const historicalImage = page.locator(`img[src="/api/runs/${runId}/media/history-image"]`);
  await historicalImage.waitFor();
  await historicalImage.evaluate((img) => img.decode());
  assert.equal(await sha256File(artifact), digest);
  assert.deepEqual(await fs.readFile(path.join(store.runDirectory(runId), 'run.json')), beforeRead);
  const screenshot = path.join(paths.workbenchRoot, 'test-results', 'workbench-browser-smoke.png');
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  assert.deepEqual(consoleErrors, [], JSON.stringify(failedResponses));
  console.log(JSON.stringify({ browser_flow: 'passed', run_id: runId, screenshot, historical_media_readonly: true }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(localRoot, { recursive: true, force: true });
}
