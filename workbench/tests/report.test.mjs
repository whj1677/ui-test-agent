import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { analyzeRunArtifacts } from '../server/report.mjs';

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

afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

test('complete passing report requires all registered steps and all media kinds', async () => {
  const files = await fixture(reportWith('passed', registeredSteps.map(({ step_id }) => ({ title: step_id }))));
  const artifact = path.join(files.runRoot, 'artifacts', 'case');
  await fs.mkdir(artifact, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(artifact, 'shot.png'), 'png'),
    fs.writeFile(path.join(artifact, 'video.webm'), 'video'),
    fs.writeFile(path.join(artifact, 'trace.zip'), 'trace'),
  ]);
  const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 0, executionStatus: 'PROCESS_ENDED' });
  assert.equal(result.report_status, 'COMPLETE');
  assert.equal(result.test_status, 'PASSED');
  assert.equal(result.evidence_status, 'COMPLETE');
  assert.equal(result.summary.complete_pass, true);
  assert.deepEqual(result.steps.map((step) => step.status), ['PASSED', 'PASSED', 'PASSED', 'PASSED']);
  assert.deepEqual(result.media.map((item) => item.kind).sort(), ['screenshot', 'trace', 'video']);
});

test('assertion mismatch remains a failed test and later steps are not executed', async () => {
  const message = 'Error: expect(locator).toHaveText(expected)\nTimed out 5000ms\nExpected: "H111"\nReceived: "H106"';
  const files = await fixture(reportWith('failed', [
    { title: 'S01' }, { title: 'S02' }, { title: 'S03', error: { message } },
  ]));
  const result = await analyzeRunArtifacts({ ...files, registeredSteps, exitCode: 1, executionStatus: 'PROCESS_ENDED' });
  assert.equal(result.test_status, 'FAILED');
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
