import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './grade.mjs';
const source = { steps: [{ step_id: '1' }] };
test('missing cases remain in denominator, not successful skips', () =>
  assert.equal(classify('PASS_ASSERTIONS', null, [], source), 'NOT_STARTED'));
test('fault technical block is never defect detection', () =>
  assert.equal(
    classify('FAIL_ASSERTION', {}, [{ status: 'TECHNICAL_FAILED' }], source),
    'TECHNICAL_BLOCK_NOT_DETECTION',
  ));
test('fault returning pass is explicitly false pass', () =>
  assert.equal(
    classify('FAIL_ASSERTION', {}, [{ status: 'PASS_ASSERTIONS' }], source),
    'FALSE_PASS',
  ));
test('real failure still requires checking the measured target', () =>
  assert.equal(
    classify(
      'FAIL_ASSERTION',
      {},
      [{ status: 'FAIL_ASSERTION', assertions: [{ passed: false }] }],
      source,
    ),
    'DIFFERENCE_REQUIRES_TARGET_REVIEW',
  ));
test('normal fixture assertion failure is not a business defect acceptance', () =>
  assert.equal(
    classify('PASS_ASSERTIONS', {}, [{ status: 'FAIL_ASSERTION' }], source),
    'UNEXPECTED_ASSERTION_FAILURE',
  ));
test('candidate plan is not execution', () =>
  assert.equal(classify('PASS_ASSERTIONS', { plan: {} }, [], source), 'PLANNED_NOT_EXECUTED'));
test('review label without a question is not established clarification', () =>
  assert.equal(
    classify('REVIEW', { status: 'NEEDS_REVIEW', issues: [] }, [], source),
    'REVIEW_NOT_ESTABLISHED',
  ));
test('ambiguous cases must not execute', () =>
  assert.equal(
    classify('REVIEW', {}, [{ status: 'PASS_ASSERTIONS' }], source),
    'UNEXPECTED_EXECUTION',
  ));
test('status pass alone cannot prove original step completeness', () =>
  assert.equal(
    classify('PASS_ASSERTIONS', {}, [{ status: 'PASS_ASSERTIONS', assertions: [] }], source),
    'INCOMPLETE_PASS_RECORD',
  ));
