import test from 'node:test';
import assert from 'node:assert/strict';
import { completionEvidenceKey, canProposeCompletion } from '../src/adaptive-recovery.mjs';
import { createAdaptivePlan, validateAdaptiveFragment } from '../src/adaptive-plan.mjs';
import { suggestObligations } from '../src/plans.mjs';

const status = {
  target: { kind: 'role', role: 'status', name: '状态', exact: true },
  check: 'text',
  expected: '正常',
  obligation_ids: ['O1'],
  oracle_quote: '状态正常',
};
const page = {
  target: { kind: 'css', value: '#pager' },
  check: 'contains',
  expected: '第1/',
  obligation_ids: ['O2'],
  oracle_quote: '默认第1页',
};
const key = (assertions) =>
  completionEvidenceKey([
    { actions: [], assertions, complete: false, within_ms: 1000, reason: 'measured' },
  ]);
test('a newly measured distinct assertion changes the completion evidence set', () =>
  assert.notEqual(key([status]), key([status, page])));
test('duplicates, order and fragment/action metadata do not unlock another probe', () => {
  const actual = completionEvidenceKey([
    {
      actions: [{ action_id: 'x', op: 'click' }],
      assertions: [page, status],
      within_ms: 2000,
      reason: 'changed',
    },
    { actions: [], assertions: [status] },
  ]);
  assert.equal(actual, key([status, page]));
});
test('new source IDs or quote alone do not count as new measured content', () => {
  assert.equal(
    key([status]),
    key([{ ...status, obligation_ids: ['O1', 'O2'], oracle_quote: 'another original source' }]),
  );
});
test('default visibility is normalized to its actual default true predicate', () => {
  const a = { ...status, check: 'visible' };
  delete a.expected;
  assert.equal(key([a]), key([{ ...a, expected: true }]));
});
test('changing a real target, predicate or expected value is a different declaration, not approval', () => {
  for (const extra of [
    { target: { kind: 'css', value: '#other' } },
    { check: 'contains' },
    { expected: '异常' },
  ])
    assert.notEqual(key([status]), key([{ ...status, ...extra }]));
  assert.equal(
    canProposeCompletion(
      { obligations: [], remaining_obligations: [] },
      [{ assertions: [status, page] }],
      { outcome: 'ACCEPT', issues: [] },
    ),
    false,
  );
});
test('input is never mutated and property serialization order is immaterial', () => {
  const before = structuredClone(status);
  key([status]);
  assert.deepEqual(status, before);
  assert.equal(
    key([status]),
    key([
      {
        expected: status.expected,
        check: status.check,
        target: { exact: true, name: '状态', role: 'status', kind: 'role' },
      },
    ]),
  );
});

test('a model cannot forge controller probe origin or an evidence epoch', () => {
  const c = {
    case_id: 'NO-SPOOF',
    steps: suggestObligations([{ step_id: '1', action: '观察状态。', expected: '状态为正常。' }]),
  };
  const plan = createAdaptivePlan(c, '/'),
    context = { c, plan, step: plan.steps[0], base: 'http://127.0.0.1:4888/' };
  const fragment = {
    actions: [],
    assertions: [{ ...status, oracle_quote: '状态为正常', obligation_ids: ['1-O1'] }],
    complete: false,
    within_ms: 1000,
    reason: '实际观测候选',
  };
  assert.doesNotThrow(() => validateAdaptiveFragment(fragment, context));
  for (const extra of [
    { proposal_origin: 'controller_completion_probe' },
    { completion_evidence_hash: 'forged' },
  ])
    assert.throws(() => validateAdaptiveFragment({ ...fragment, ...extra }, context));
});
