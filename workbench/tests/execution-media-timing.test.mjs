import test from 'node:test';
import assert from 'node:assert/strict';
import { displayFailureStep, executionSteps } from '../web-v2/execution-media.js';

const base = observation => ({
  status: observation.status === 'PASSED' ? 'PASSED' : 'FAILED',
  failure_step: null,
  step_coverage: { items: [{ marker: 'CASE_STEP_1', order: 1, execution_status: 'PASSED' }] },
  frozen_case_content: { steps: [{ order: 1, action: '查询', expected: '原文 400-600ms' }] },
  timing_validation: { required: true, complete: observation.status === 'PASSED', observations: [
    { step: 1, target: '正在加载设备列表…', min_ms: 400, max_ms: 600, ...observation },
  ] },
});

test('only verified timing is presented as measured against original bounds', () => {
  const run = base({ status: 'PASSED', observed_duration_ms: 500, reason: null });
  const [step] = executionSteps(run);
  assert.equal(step.execution_status, 'PASSED');
  assert.match(step.actual, /实测 500\.0 ms；原要求 400–600 ms；时间要求满足/);
  assert.equal(displayFailureStep(run), null);
});

test('invalid identity cannot turn an untrusted 500 ms value into a measured result', () => {
  const run = base({ status: 'FAILED', observed_duration_ms: 500, reason: 'TIMING_EVIDENCE_MISSING_OR_INVALID' });
  const [step] = executionSteps(run);
  assert.equal(step.execution_status, 'FAILED');
  assert.match(step.actual, /计时证据未通过核验.*来源身份或记录完整性未通过核验/);
  assert.doesNotMatch(step.actual, /实测|时间要求未满足|500\.0 ms/);
  assert.equal(displayFailureStep(run), 'CASE_STEP_1');
});

test('out-of-range and missing intervals remain evidence failures without inventing values', () => {
  for (const observation of [
    { status: 'FAILED', observed_duration_ms: 700, reason: 'TIMING_OUT_OF_FROZEN_RANGE' },
    { status: 'FAILED', observed_duration_ms: null, reason: 'TIMING_REQUIRES_ONE_COMPLETE_CYCLE' },
  ]) {
    const [step] = executionSteps(base(observation));
    assert.equal(step.execution_status, 'FAILED');
    assert.match(step.actual, /计时证据未通过核验/);
    assert.doesNotMatch(step.actual, /实测|时间要求未满足/);
  }
});

test('presentation fallback preserves an existing failure step and never rewrites a passing run', () => {
  assert.equal(displayFailureStep({ ...base({ status: 'FAILED' }), failure_step: 'CASE_STEP_3' }), 'CASE_STEP_3');
  assert.equal(displayFailureStep({ ...base({ status: 'FAILED' }), status: 'PASSED' }), null);
});
