import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveProgress } from '../src/adaptive-recovery.mjs';

const original = {
  step_id: 'S3',
  obligations: [
    { id: 'S3-O1', text: '表格为5行；总计12条，当前第1/3页' },
    { id: 'S3-O2', text: '详情按钮可见' },
  ],
};
const completed = [
  { actions: [], assertions: [{ check: 'row_count', expected: 5, obligation_ids: ['S3-O1'] }] },
];
const audit = {
  checks: [
    {
      step_id: 'S3',
      obligation_id: 'S3-O1',
      status: 'MISSING',
      assertion_indices: [0],
      reason: '5行已测量，但总计及当前页未检查',
    },
    {
      step_id: 'S3',
      obligation_id: 'S3-O2',
      status: 'MISSING',
      assertion_indices: [],
      reason: '尚未检查详情按钮',
    },
  ],
  issues: [{ step_id: 'S3', code: 'ASSERTION_GAP', reason: '缺少总计12条/第1/3页与详情按钮' }],
};

test('initial progress contains every original obligation without guessed coverage', () => {
  const result = adaptiveProgress(original, [], undefined);
  assert.equal(result.remaining_obligations.length, 2);
  assert.ok(
    result.obligations.every((o) => o.status === 'PENDING' && !o.measured_assertion_refs.length),
  );
});

test('same-obligation partial row count remains pending with measured reference and missing-clause reason', () => {
  const before = structuredClone({ original, completed, audit });
  const result = adaptiveProgress(original, completed, audit);
  assert.equal(result.remaining_obligations.length, 2);
  assert.deepEqual(result.remaining_obligations[0].measured_assertion_refs, ['A1']);
  assert.match(result.remaining_obligations[0].reason, /总计及当前页未检查/);
  assert.deepEqual(result.issues, audit.issues);
  assert.deepEqual({ original, completed, audit }, before);
});

test('covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference', () => {
  for (const [stepId, id, indices, expected] of [
    ['S3', 'S3-O1', [0], 'MEASURED_COVERED'],
    ['S3', 'S3-O1', [1], 'PENDING'],
    ['S3', 'S3-O1', [], 'PENDING'],
    ['S2', 'S3-O1', [0], 'PENDING'],
    ['S3', 'S3-O2', [0], 'PENDING'],
  ]) {
    const result = adaptiveProgress(original, completed, {
      checks: [
        {
          step_id: stepId,
          obligation_id: id,
          status: 'COVERED',
          assertion_indices: indices,
          reason: '注入审查',
        },
      ],
      issues: [],
    });
    assert.equal(result.obligations.find((o) => o.id === id).status, expected);
  }
});
