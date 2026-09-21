import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { createPaths } from '../server/paths.mjs';
import { buildApprovedAsset } from '../server/registry.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-browser-'));
const paths = createPaths({ localRoot });
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
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

const server = createWorkbenchServer({ store, manager });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
const consoleErrors = [];
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
  const screenshot = path.join(paths.workbenchRoot, 'test-results', 'workbench-browser-smoke.png');
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({ browser_flow: 'passed', run_id: runId, screenshot }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(localRoot, { recursive: true, force: true });
}
