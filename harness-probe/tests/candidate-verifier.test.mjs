import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePlaywrightReport } from '../src/candidate-verifier.mjs';

const report = (status = 'expected', resultStatus = 'passed') => ({
  suites: [{ specs: [{ tests: [{ status, results: [{ status: resultStatus }] }] }] }],
});

test('真实通过且至少一个测试才完整', () => {
  assert.deepEqual(evaluatePlaywrightReport(report()), {
    success: true, reason: 'COMPLETE_PASS', testCount: 1, passed: 1, skipped: 0, failed: 0,
  });
});

test('缺失或损坏报告不能成功', () => {
  assert.equal(evaluatePlaywrightReport(null).success, false);
  assert.equal(evaluatePlaywrightReport({ suites: 'bad' }).success, false);
});

test('零测试、跳过和失败不能成功', () => {
  assert.equal(evaluatePlaywrightReport({ suites: [] }).success, false);
  assert.equal(evaluatePlaywrightReport(report('skipped', 'skipped')).success, false);
  assert.equal(evaluatePlaywrightReport(report('unexpected', 'failed')).success, false);
});
