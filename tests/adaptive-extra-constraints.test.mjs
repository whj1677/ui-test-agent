import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { compareTableCells } from '../src/table-assertion.mjs';
import { ADAPTIVE_CONSTRAINT_GUIDANCE } from '../src/scope-guidance.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
import { ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';

test('planner and reviewer receive the same constraint-scope contract', () => {
  for (const prompt of [ADAPTIVE_NEXT_PROMPT, ADAPTIVE_REVIEW_REFERENCES])
    assert.ok(prompt.includes(ADAPTIVE_CONSTRAINT_GUIDANCE));
});

const table = { kind: 'role', role: 'table', name: '', exact: true };
const expected = {
  key_column: '编号',
  rows: ['D006', 'D007', 'D008', 'D009', 'D010'].map((key) => ({
    key,
    cells: [{ column: '编号', check: 'text', expected: key }],
  })),
  ordered: false,
  exact_rows: false,
};
const source = '进入第2页，分页显示第2/3页；可见 D006 至 D010，其中包含 D009。';
function validate(assertion, text = source, adaptive = true) {
  requirePlanSemantics(
    { steps: [{ assertions: [assertion] }] },
    { steps: [{ action: '点击下一页', expected: text }] },
    { adaptive_readonly: adaptive },
    { complete: false },
  );
}
const matrix = (flags) => ({
  target: table,
  check: 'table_cells',
  expected: { ...structuredClone(expected), ...flags },
});

for (const flags of [{ ordered: true }, { exact_rows: true }, { ordered: true, exact_rows: true }])
  test(`visible range does not authorize extra matrix constraints: ${JSON.stringify(flags)}`, () => {
    assert.throws(() => validate(matrix(flags)), { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' });
    assert.doesNotThrow(() => validate(matrix({})));
    assert.doesNotThrow(
      () => validate(matrix(flags), source, false),
      'fixed path is not silently changed',
    );
  });

test('explicit count and order remain required rather than removed by repair', () => {
  assert.throws(() => validate(matrix({ ordered: true }), '可见D006至D010，不要求升序。'), {
    code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED',
  });
  assert.doesNotThrow(() =>
    validate(matrix({ ordered: true, exact_rows: true }), '恰好5行，编号依次为D006至D010。'),
  );
  assert.doesNotThrow(() => validate(matrix({ exact_rows: true }), '共5行，可见D006至D010。'));
  assert.throws(() => validate(matrix({ ordered: true }), '共5行，可见D006至D010。'), {
    code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED',
  });
});

test('a legal extra row or alternative ordering proves why the proposed extras are not neutral', () => {
  const actual = {
    headers: ['编号'],
    rows: [['D010'], ['D009'], ['D008'], ['D007'], ['D006'], ['D011']],
  };
  assert.equal(compareTableCells(actual, expected).passed, true);
  assert.equal(compareTableCells(actual, { ...expected, ordered: true }).passed, false);
  assert.equal(compareTableCells(actual, { ...expected, exact_rows: true }).passed, false);
});

for (const check of ['text', 'contains'])
  test(`page text cannot smuggle a copied record total: ${check}`, () => {
    const a = {
      target: { kind: 'text', value: '共12条 · 第2/3页', exact: true },
      check,
      expected: '共12条 · 第2/3页',
    };
    assert.throws(() => validate(a), { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' });
    assert.doesNotThrow(() => validate({ ...a, check: 'contains', expected: '第2/3页' }));
    assert.doesNotThrow(() => validate(a, '分页显示共12条 · 第2/3页。'));
    assert.throws(() => validate(a, '分页显示共13条 · 第2/3页。'), {
      code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED',
    });
    assert.doesNotThrow(() => validate(a, source, false));
  });
