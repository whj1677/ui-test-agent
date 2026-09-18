import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptiveProgress,
  missingAssertionFocus,
  requireMissingAssertionFocus,
  adaptiveCorrection,
} from '../src/adaptive-recovery.mjs';

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

test('focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions', () => {
  const focus = missingAssertionFocus(adaptiveProgress(original, completed, audit), completed);
  const fresh = {
    target: { kind: 'text', value: '共12条 · 第1/3页', exact: true },
    check: 'visible',
    obligation_ids: ['S3-O1'],
    oracle_quote: original.obligations[0].text,
  };
  assert.deepEqual(
    focus.obligations.map((o) => o.id),
    ['S3-O1', 'S3-O2'],
  );
  assert.doesNotThrow(() =>
    requireMissingAssertionFocus({ actions: [], assertions: [fresh], complete: false }, focus),
  );
  for (const ids of [['S3-O1'], ['S3-O2']]) {
    assert.throws(
      () =>
        requireMissingAssertionFocus(
          {
            actions: [],
            assertions: [
              {
                ...completed[0].assertions[0],
                obligation_ids: ids,
                oracle_quote: '换引用不产生新测量',
              },
            ],
            complete: false,
          },
          focus,
        ),
      { code: 'ADAPTIVE_NO_PROGRESS' },
    );
  }
  assert.throws(
    () =>
      requireMissingAssertionFocus(
        { actions: [{ op: 'click' }], assertions: [fresh], complete: false },
        focus,
      ),
    { code: 'ADAPTIVE_REPAIR_FOCUS_VIOLATION' },
  );
  assert.throws(
    () =>
      requireMissingAssertionFocus(
        { actions: [], assertions: [{ ...fresh, obligation_ids: ['OTHER'] }], complete: false },
        focus,
      ),
    { code: 'ADAPTIVE_REPAIR_FOCUS_VIOLATION' },
  );
  assert.throws(
    () => requireMissingAssertionFocus({ actions: [], assertions: [], complete: true }, focus),
    { code: 'ADAPTIVE_NO_PROGRESS' },
  );
});

test('focused no-gap completion contains no new assertions or actions and does not mutate historical evidence', () => {
  const progress = { step_id: 'S3', remaining_obligations: [], issues: [] };
  const focus = missingAssertionFocus(progress, completed);
  assert.doesNotThrow(() =>
    requireMissingAssertionFocus({ actions: [], assertions: [], complete: true }, focus),
  );
  assert.throws(
    () =>
      requireMissingAssertionFocus(
        { actions: [], assertions: completed[0].assertions, complete: true },
        focus,
      ),
    { code: 'ADAPTIVE_NO_PROGRESS' },
  );
  focus.already_measured[0].expected = 999;
  assert.equal(completed[0].assertions[0].expected, 5);
});

test('source correction exposes exact failed field but never automatically normalizes observed units', () => {
  const proposal = {
    assertions: [
      {
        check: 'table_cells',
        expected: {
          rows: [
            { key: 'D009', cells: [{ column: '额定功率', check: 'text', expected: '200 kW' }] },
          ],
        },
      },
    ],
  };
  const before = structuredClone(proposal);
  const correction = adaptiveCorrection(
    { code: 'TABLE_SOURCE_UNGROUNDED', path: 'expected.rows[0].cells[0].expected' },
    proposal,
    { source_action: '核对功率', source_expected: '额定功率200' },
  );
  assert.equal(correction.field_path, 'expected.rows[0].cells[0].expected');
  assert.match(correction.instruction, /check:"number"/);
  assert.deepEqual(proposal, before);
  assert.deepEqual(correction.invalid_response, before);
});
