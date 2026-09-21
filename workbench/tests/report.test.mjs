import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { analyzeRunArtifacts, reportInternals } from '../server/report.mjs';

const roots = [];
const registeredSteps = ['S01', 'S02', 'S03', 'S04'].map((step_id) => ({ step_id, action: `action ${step_id}`, expected: `expected ${step_id}` }));

async function fixture(report) {
  const runRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-report-'));
  roots.push(runRoot);
  const reportFile = path.join(runRoot, 'report.json');
  if (report !== undefined) await fs.writeFile(reportFile, typeof report === 'string' ? report : JSON.stringify(report));
  return { runRoot, reportFile };
}

function reportWith(status, steps, stats = {}) {
  return {
    suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status, steps, error: steps.find((step) => step.error)?.error }] }] }] }],
    stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0, ...stats },
  };
}

async function addMedia(files, kinds = ['screenshot', 'video', 'trace']) {
  const definitions = {
    screenshot: ['shot.png', 'png'],
    video: ['video.webm', 'video'],
    trace: ['trace.zip', 'trace'],
  };
  const artifact = path.join(files.runRoot, 'artifacts', 'case');
  await fs.mkdir(artifact, { recursive: true });
  await Promise.all(kinds.map((kind) => fs.writeFile(path.join(artifact, definitions[kind][0]), definitions[kind][1])));
}

afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

test('complete passing report requires all registered steps and all media kinds', async () => {
  const files = await fixture(reportWith('passed', registeredSteps.map(({ step_id }) => ({ title: step_id }))));
  await addMedia(files);
  const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' });
  assert.equal(result.report_status, 'COMPLETE');
  assert.equal(result.test_status, 'PASSED');
  assert.equal(result.evidence_status, 'COMPLETE');
  assert.equal(result.summary.complete_pass, true);
  assert.deepEqual(result.steps.map((step) => step.status), ['PASSED', 'PASSED', 'PASSED', 'PASSED']);
  assert.deepEqual(result.media.map((item) => item.kind).sort(), ['screenshot', 'trace', 'video']);
});

for (const [scenario, kinds] of [
  ['all media are missing', []],
  ['screenshot is missing', ['video', 'trace']],
  ['video is missing', ['screenshot', 'trace']],
  ['trace is missing', ['screenshot', 'video']],
]) {
  test(`raw passing result is not an overall pass when ${scenario}`, async () => {
    const files = await fixture(reportWith('passed', registeredSteps.map(({ step_id }) => ({ title: step_id }))));
    await addMedia(files, kinds);
    const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' });
    assert.equal(result.test_status, 'PASSED');
    assert.equal(result.summary.playwright_status, 'passed');
    assert.equal(result.summary.playwright_pass, true);
    assert.equal(result.evidence_status, 'INCOMPLETE');
    assert.equal(result.summary.complete_pass, false, scenario);
  });
}

test('assertion mismatch remains a failed test and later steps are not executed', async () => {
  const message = 'Error: expect(locator).toHaveText(expected)\nTimed out 5000ms\nExpected: "H111"\nReceived: "H106"';
  const files = await fixture(reportWith('failed', [
    { title: 'S01' }, { title: 'S02' }, { title: 'S03', error: { message } },
  ]));
  await addMedia(files);
  const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 1, executionStatus: 'PROCESS_ENDED' });
  assert.equal(result.test_status, 'FAILED');
  assert.equal(result.evidence_status, 'COMPLETE');
  assert.equal(result.summary.complete_pass, false);
  assert.equal(result.error.type, 'ASSERTION_MISMATCH');
  assert.equal(result.error.expected, 'H111');
  assert.equal(result.error.actual, 'H106');
  assert.equal(result.error.attribution, 'PENDING_ANALYSIS');
  assert.deepEqual(result.steps.map((step) => step.status), ['PASSED', 'PASSED', 'FAILED', 'NOT_EXECUTED']);
});

test('missing, corrupt, skipped and zero-target reports fail closed', async () => {
  const missing = await fixture(undefined);
  assert.equal((await analyzeRunArtifacts({ ...missing, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' })).report_status, 'MISSING');
  const corrupt = await fixture('{broken');
  assert.equal((await analyzeRunArtifacts({ ...corrupt, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' })).report_status, 'CORRUPT');
  const skipped = await fixture(reportWith('skipped', [], { expected: 0, skipped: 1 }));
  const skippedResult = await analyzeRunArtifacts({ ...skipped, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' });
  assert.equal(skippedResult.test_status, 'SKIPPED');
  assert.equal(skippedResult.summary.complete_pass, false);
  const empty = await fixture({ suites: [], stats: { expected: 0, unexpected: 0, skipped: 0 } });
  const emptyResult = await analyzeRunArtifacts({ ...empty, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' });
  assert.equal(emptyResult.test_status, 'NOT_RUN');
  assert.equal(emptyResult.error.type, 'TARGET_TEST_COUNT_INVALID');
});

test('exit code zero cannot override an incomplete step set', async () => {
  const files = await fixture(reportWith('passed', [{ title: 'S01' }, { title: 'S02' }, { title: 'S03' }]));
  const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' });
  assert.equal(result.test_status, 'PASSED');
  assert.equal(result.summary.complete_pass, false);
  assert.equal(result.steps[3].status, 'NOT_EXECUTED');
});

test('a passing Playwright report cannot override a non-normal execution terminal state', async () => {
  for (const executionStatus of ['INTEGRITY_FAILED', 'CANCELLED', 'INTERRUPTED', 'PROCESS_ERROR', 'START_FAILED']) {
    const files = await fixture(reportWith('passed', registeredSteps.map(({ step_id }) => ({ title: step_id }))));
    await addMedia(files);
    const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 0, executionStatus });
    assert.equal(result.test_status, 'PASSED');
    assert.equal(result.summary.playwright_status, 'passed');
    assert.equal(result.summary.playwright_pass, true);
    assert.equal(result.evidence_status, 'COMPLETE');
    assert.equal(result.summary.complete_pass, false, executionStatus);
  }
});

test('error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches', () => {
  const missing = reportInternals.errorFacts({
    message: 'Error: expect(locator).toHaveText(expected)\nExpected: "H111"\nError: element(s) not found\nCall log: waiting for getByRole("cell")',
  });
  assert.equal(missing.type, 'LOCATOR_OR_TARGET');
  assert.equal(missing.expected, 'H111');
  assert.equal(missing.actual, null);

  const strict = reportInternals.errorFacts({
    message: 'Error: strict mode violation: getByText("H111") resolved to 2 elements\nexpect(locator).toBeVisible()',
  });
  assert.equal(strict.type, 'LOCATOR_OR_TARGET');
  assert.equal(strict.actual, null);

  const unavailable = reportInternals.errorFacts({
    message: 'Error: expect(locator).toHaveText(expected)\nTimed out 5000ms\nExpected: "H111"\nReceived: <value unavailable>',
  });
  assert.equal(unavailable.type, 'ASSERTION_UNRESOLVED');
  assert.equal(unavailable.expected, 'H111');
  assert.equal(unavailable.actual, null);
  assert.equal(unavailable.attribution, 'PENDING_ANALYSIS');

  const compared = reportInternals.errorFacts({
    message: 'Error: expect(locator).toHaveText(expected)\nTimed out 5000ms\nExpected: "H111"\nReceived: "H106"',
  });
  assert.equal(compared.type, 'ASSERTION_MISMATCH');
  assert.equal(compared.expected, 'H111');
  assert.equal(compared.actual, 'H106');

  const timeout = reportInternals.errorFacts({ message: 'TimeoutError: page.click: Timeout 5000ms exceeded' });
  assert.equal(timeout.type, 'TIMEOUT');
  assert.equal(timeout.expected, null);
  assert.equal(timeout.actual, null);
});
