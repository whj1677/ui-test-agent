import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createPaths } from '../server/paths.mjs';
import { APPROVED_SCRIPT_SHA256 } from '../server/registry.mjs';
import { sha256File } from '../server/integrity.mjs';

const paths = createPaths();
const baseUrl = process.env.WORKBENCH_URL || 'http://127.0.0.1:4210';
const acceptanceRoot = path.join(paths.localRoot, 'acceptance');
await fs.mkdir(acceptanceRoot, { recursive: true });
const sourceScript = path.join(paths.repoRoot, 'pilot', 'revision-s02', 'tests', 'sorting.spec.ts');
const existingNormalRunId = process.argv.find((value) => value.startsWith('--normal-run-id='))?.split('=')[1] || null;

async function waitForTerminal(runId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/runs/${encodeURIComponent(runId)}`);
    assert.equal(response.status, 200);
    const run = await response.json();
    if (!['STARTING', 'RUNNING', 'STOPPING', 'QUEUED'].includes(run.execution_status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`RUN_TIMEOUT:${runId}`);
}

async function startFromWeb(page, environment) {
  await page.getByTestId('environment-select').selectOption(environment);
  if (environment === 'fault') await page.waitForTimeout(2300);
  assert.equal(await page.getByTestId('environment-select').inputValue(), environment);
  const requestPromise = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs');
  await page.getByTestId('run-button').click();
  const request = await requestPromise;
  assert.equal(request.postDataJSON().environment, environment);
  await page.waitForFunction(() => /^已启动 run-[a-z0-9-]+$/.test(document.querySelector('[data-testid="action-message"]')?.textContent || ''));
  const message = await page.getByTestId('action-message').innerText();
  const runId = message.match(/run-[a-z0-9-]+/)?.[0];
  assert.ok(runId, `页面未返回run_id: ${message}`);
  const run = await waitForTerminal(runId);
  assert.equal(run.environment.id, environment);
  await page.reload();
  await page.getByTestId('history').locator(`button[data-run-id="${runId}"]`).click();
  await page.getByTestId('run-detail').waitFor();
  return run;
}

async function loadExistingFromWeb(page, runId) {
  const response = await fetch(`${baseUrl}/api/runs/${encodeURIComponent(runId)}`);
  assert.equal(response.status, 200);
  const run = await response.json();
  await page.getByTestId('history').locator(`button[data-run-id="${runId}"]`).click();
  await page.getByTestId('run-detail').waitFor();
  return run;
}

function reportTests(report) {
  const tests = [];
  const visit = (suites) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) tests.push(...(spec.tests || []));
      visit(suite.suites);
    }
  };
  visit(report.suites);
  return tests;
}

function assertShared(run) {
  assert.equal(run.execution_status, 'PROCESS_ENDED');
  assert.equal(run.report_status, 'COMPLETE');
  assert.equal(run.evidence_status, 'COMPLETE');
  assert.equal(run.integrity.expected_sha256, APPROVED_SCRIPT_SHA256);
  assert.equal(run.integrity.source_before_sha256, APPROVED_SCRIPT_SHA256);
  assert.equal(run.integrity.runtime_sha256, APPROVED_SCRIPT_SHA256);
  assert.equal(run.integrity.source_after_sha256, APPROVED_SCRIPT_SHA256);
  assert.equal(run.integrity.runtime_after_sha256, APPROVED_SCRIPT_SHA256);
  assert.equal(run.runtime.model_calls, 0);
  assert.equal(run.runtime.retries, 0);
  assert.equal(run.runtime.healer, false);
  assert.deepEqual(run.media.map((item) => item.kind).sort(), ['screenshot', 'trace', 'video']);
}

const sourceBefore = await sha256File(sourceScript);
assert.equal(sourceBefore, APPROVED_SCRIPT_SHA256);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
const startedAt = new Date().toISOString();

try {
  await page.goto(baseUrl);
  await page.getByTestId('asset-card').waitFor();
  const normal = existingNormalRunId
    ? await loadExistingFromWeb(page, existingNormalRunId)
    : await startFromWeb(page, 'normal');
  assertShared(normal);
  assert.equal(normal.process.exit_code, 0);
  assert.equal(normal.test_status, 'PASSED');
  assert.equal(normal.summary.complete_pass, true);
  assert.deepEqual(normal.steps.map((step) => [step.step_id, step.status]), [['S01','PASSED'],['S02','PASSED'],['S03','PASSED'],['S04','PASSED']]);
  await page.screenshot({ path: path.join(acceptanceRoot, `${normal.run_id}-normal.png`), fullPage: true });

  const fault = await startFromWeb(page, 'fault');
  assertShared(fault);
  assert.equal(fault.process.exit_code, 1);
  assert.equal(fault.test_status, 'FAILED');
  assert.equal(fault.summary.complete_pass, false);
  assert.deepEqual(fault.steps.map((step) => [step.step_id, step.status]), [['S01','PASSED'],['S02','PASSED'],['S03','FAILED'],['S04','NOT_EXECUTED']]);
  assert.equal(fault.error.type, 'ASSERTION_MISMATCH');
  assert.equal(fault.error.expected, 'H111');
  assert.equal(fault.error.actual, 'H106');
  assert.equal(fault.error.attribution, 'PENDING_ANALYSIS');
  await page.screenshot({ path: path.join(acceptanceRoot, `${fault.run_id}-fault.png`), fullPage: true });

  for (const run of [normal, fault]) {
    const report = JSON.parse(await fs.readFile(path.join(paths.runsRoot, run.run_id, 'report.json'), 'utf8'));
    const tests = reportTests(report);
    assert.equal(tests.length, 1);
    assert.equal(tests[0].results.length, 1);
    assert.equal(tests[0].results[0].status, run.test_status === 'PASSED' ? 'passed' : 'failed');
  }

  const sourceAfter = await sha256File(sourceScript);
  assert.equal(sourceAfter, APPROVED_SCRIPT_SHA256);
  const summary = {
    schema: 'approved-workbench/acceptance-summary-v1',
    started_at: startedAt, finished_at: new Date().toISOString(), source_sha_before: sourceBefore, source_sha_after: sourceAfter,
    model_calls: 0, retries: 0, healer: false,
    prior_attempts: existingNormalRunId ? [{
      run_id: existingNormalRunId,
      note: '首次验收脚本过早读取“正在启动”提示而退出；工作台运行未重放、未删除，完成后独立核验并作为本次normal运行。',
    }] : [],
    runs: [normal, fault].map((run) => ({
      run_id: run.run_id, environment: run.environment.id, entry_url: run.environment.entry_url,
      asset_version: run.asset_version, source_commit: run.source_commit, expected_sha256: run.integrity.expected_sha256,
      exit_code: run.process.exit_code, report_status: run.report_status, test_status: run.test_status,
      evidence_status: run.evidence_status, complete_pass: run.summary.complete_pass,
      steps: run.steps.map((step) => ({ step_id: step.step_id, status: step.status })),
      error: run.error ? { type: run.error.type, expected: run.error.expected, actual: run.error.actual, attribution: run.error.attribution } : null,
      media: run.media.map((item) => ({ media_id: item.media_id, kind: item.kind, sha256: item.sha256, bytes: item.bytes })),
    })),
  };
  const summaryFile = path.join(acceptanceRoot, 'real-integration-summary.json');
  await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'passed', normal_run_id: normal.run_id, fault_run_id: fault.run_id, summary_file: summaryFile }));
} finally {
  await browser.close();
}
