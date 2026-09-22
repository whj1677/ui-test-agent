import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  PROJECT_CASE_STEP_TITLE_RULE_VERSION,
  counterexampleDetected,
  mapProjectCaseSteps,
  parseCandidateReport,
  parseProjectCaseStepTitle,
} from '../server/build/report.mjs';

function report(status, error = null) {
  return { stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status, error }] }] }] }] };
}

test('candidate report parser keeps normal pass and concrete assertion mismatch separate', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-report-'));
  try {
    const normalFile = path.join(root, 'normal.json');
    const negativeFile = path.join(root, 'negative.json');
    await fs.writeFile(normalFile, JSON.stringify(report('passed')));
    await fs.writeFile(negativeFile, JSON.stringify(report('failed', { message: 'Expected string: "VALUE-A"\nReceived string: "VALUE-B"' })));
    const normal = await parseCandidateReport(normalFile, { exitCode: 0, termination: null, error: null });
    const negative = await parseCandidateReport(negativeFile, { exitCode: 1, termination: null, error: null });
    assert.equal(normal.complete_pass, true);
    assert.equal(counterexampleDetected(negative, 'VALUE-A', 'VALUE-B'), true);
    assert.equal(counterexampleDetected(negative, 'VALUE-A', 'OTHER'), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('missing report and locator errors cannot become technical pass or specified mismatch', async () => {
  const missing = await parseCandidateReport(path.join(os.tmpdir(), 'definitely-missing-build-report.json'), { exitCode: 0, termination: null });
  assert.equal(missing.complete_pass, false);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-locator-'));
  try {
    const file = path.join(root, 'report.json');
    await fs.writeFile(file, JSON.stringify(report('failed', { message: "expect(locator('status')).toHaveText timed out; locator resolved to 0 elements" })));
    const parsed = await parseCandidateReport(file, { exitCode: 1, termination: null });
    assert.equal(parsed.error.type, 'LOCATOR_OR_TARGET');
    assert.equal(counterexampleDetected(parsed, 'A', 'B'), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('versioned step title rule accepts only bare or explicitly separated leading markers', () => {
  for (const title of ['CASE_STEP_1', 'CASE_STEP_1 说明', 'CASE_STEP_1: 说明', 'CASE_STEP_1：说明', 'CASE_STEP_1 - 说明', 'CASE_STEP_1 – 说明', 'CASE_STEP_1 — 说明']) {
    const parsed = parseProjectCaseStepTitle(title);
    assert.equal(parsed.step_id, 'CASE_STEP_1');
    assert.equal(parsed.raw_title, title);
    assert.equal(parsed.rule_version, PROJECT_CASE_STEP_TITLE_RULE_VERSION);
  }
  for (const title of ['前文 CASE_STEP_1', 'CASE_STEP_1/说明', 'CASE_STEP_1-说明', 'CASE_STEP_0 说明', 'CASE_STEP_ 说明']) {
    assert.equal(parseProjectCaseStepTitle(title), null);
  }
  assert.equal(parseProjectCaseStepTitle('CASE_STEP_10 说明').step_id, 'CASE_STEP_10');
});

test('step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers', () => {
  const contract = { required_step_markers: ['CASE_STEP_1', 'CASE_STEP_2'] };
  const valid = mapProjectCaseSteps({ steps: [{ title: 'CASE_STEP_1' }, { title: 'CASE_STEP_2: 说明' }] }, contract);
  assert.equal(valid.complete, true);
  assert.deepEqual(valid.observed_sequence, ['CASE_STEP_1', 'CASE_STEP_2']);
  assert.equal(mapProjectCaseSteps({ steps: [{ title: 'CASE_STEP_10 不是步骤1' }, { title: 'CASE_STEP_2' }] }, contract).complete, false);
  assert.deepEqual(mapProjectCaseSteps({ steps: [{ title: 'CASE_STEP_1' }, { title: 'CASE_STEP_1 复制' }] }, contract).duplicates, ['CASE_STEP_1']);
  assert.deepEqual(mapProjectCaseSteps({ steps: [{ title: 'CASE_STEP_1' }] }, contract).missing, ['CASE_STEP_2']);
  assert.equal(mapProjectCaseSteps({ steps: [{ title: 'CASE_STEP_2' }, { title: 'CASE_STEP_1' }] }, contract).order_valid, false);
  assert.deepEqual(mapProjectCaseSteps({ steps: [{ title: '说明 CASE_STEP_1' }, { title: 'CASE_STEP_2' }] }, contract).malformed_titles, ['说明 CASE_STEP_1']);
});

test('nested assertion error is attributed to its business step and another step cannot satisfy the counterexample', () => {
  const mismatch = { type: 'ASSERTION_MISMATCH', message: 'Expected: "A"\nReceived: "B"', expected: 'A', actual: 'B', attribution: 'PENDING_ANALYSIS' };
  const contract = { required_step_markers: ['CASE_STEP_1', 'CASE_STEP_2', 'CASE_STEP_3'], detection: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_3' } };
  const base = { report_status: 'COMPLETE', test_status: 'FAILED', test_count: 1, error: mismatch };
  const nestedAtS3 = { ...base, steps: [
    { title: 'CASE_STEP_1' }, { title: 'CASE_STEP_2 说明' },
    { title: 'CASE_STEP_3：核对', steps: [{ title: 'expect output', error: mismatch, raw_error: { message: 'RAW A/B' }, steps: [] }] },
  ] };
  assert.equal(counterexampleDetected(nestedAtS3, contract), true);
  assert.equal(mapProjectCaseSteps(nestedAtS3, contract).items[2].error_attributed, true);
  const errorAtS2 = { ...base, steps: [
    { title: 'CASE_STEP_1' }, { title: 'CASE_STEP_2 说明', error: mismatch, raw_error: { message: 'RAW A/B' } }, { title: 'CASE_STEP_3 仅出现' },
  ] };
  assert.equal(counterexampleDetected(errorAtS2, contract), false);
});

test('steps after the attributed failure remain not executed without hiding the specified mismatch', () => {
  const mismatch = { type: 'ASSERTION_MISMATCH', message: 'Expected: "A"\nReceived: "B"', expected: 'A', actual: 'B', attribution: 'PENDING_ANALYSIS' };
  const contract = { required_step_markers: ['CASE_STEP_1', 'CASE_STEP_2', 'CASE_STEP_3'], detection: { kind: 'assertion-mismatch-at-step', step_marker: 'CASE_STEP_2' } };
  const verification = {
    report_status: 'COMPLETE', test_status: 'FAILED', test_count: 1, error: mismatch,
    steps: [{ title: 'CASE_STEP_1' }, { title: 'CASE_STEP_2 失败步骤', error: mismatch, raw_error: { message: 'RAW' } }],
  };
  const mapping = mapProjectCaseSteps(verification, contract);
  assert.equal(mapping.complete, false);
  assert.equal(mapping.items[2].execution_status, 'NOT_EXECUTED');
  assert.equal(counterexampleDetected(verification, contract), true);
});

test('parser preserves raw title hierarchy raw error and expected actual facts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-step-raw-'));
  try {
    const file = path.join(root, 'report.json');
    const rawMessage = 'Expected: "原期望"\nReceived: "原实际"';
    const nested = report('failed', { message: rawMessage });
    nested.suites[0].specs[0].tests[0].results[0].steps = [{
      title: 'CASE_STEP_3 原始标题', duration: 7,
      steps: [{ title: '子断言', duration: 3, error: { message: rawMessage, location: { file: 'candidate.spec.mjs', line: 8, column: 9 } } }],
    }];
    await fs.writeFile(file, JSON.stringify(nested));
    const parsed = await parseCandidateReport(file, { exitCode: 1, termination: null, error: null });
    assert.equal(parsed.steps[0].raw_title, 'CASE_STEP_3 原始标题');
    assert.equal(parsed.steps[0].steps[0].raw_error.message, rawMessage);
    assert.equal(parsed.steps[0].steps[0].error.expected, '原期望');
    assert.equal(parsed.steps[0].steps[0].error.actual, '原实际');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
