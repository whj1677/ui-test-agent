import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { compareTableCells } from '../src/table-assertion.mjs';

const table = { kind: 'role', role: 'table', name: '设备', exact: true };
const prefix = '第一行是 R012；第二行是 R007。';
const matrix = () => ({
  target: table,
  check: 'table_cells',
  expected: {
    key_column: '编号',
    ordered: false,
    exact_rows: false,
    rows: [
      { key: 'R012', position: 1, cells: [{ column: '编号', check: 'text', expected: 'R012' }] },
      { key: 'R007', position: 2, cells: [{ column: '编号', check: 'text', expected: 'R007' }] },
    ],
  },
});
function validate(assertion, expected = prefix, adaptive = true) {
  requirePlanSemantics(
    { steps: [{ assertions: [assertion] }] },
    { steps: [{ action: '核对当前表格', expected }] },
    { adaptive_readonly: adaptive },
    { complete: false },
  );
}
for (const source of [
  prefix,
  '前两行是 R012 和 R007。',
  '第12行是R012。',
  '最后两行可见。',
  'first 2 rows are R012 and R007',
  '参数有2个，功率200 kW，刷新2秒。',
  '不要求只有2行。',
  '至少2行。',
  '如果有2行则显示。',
])
  test(`ordinal/prefix/incidental/conditional text is not a table count: ${source}`, () => {
    assert.throws(() => validate({ target: table, check: 'row_count', expected: 2 }, source), {
      code: 'PLAN_ASSERTION_UNSUPPORTED',
    });
  });
test('prefix matrix cannot silently require a closed two-row population', () => {
  const a = matrix();
  assert.doesNotThrow(() => validate(a));
  a.expected.exact_rows = true;
  assert.throws(() => validate(a), { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' });
  for (const source of ['前两行是R012和R007', 'first 2 rows are R012 and R007'])
    assert.throws(() => validate(a, source), { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' });
  assert.doesNotThrow(() => validate(a, prefix, false), 'legacy fixed plan stays unchanged');
});
test('an explicitly requested row count remains enforceable with its original value', () => {
  for (const text of [
    '恰好2行。',
    '共两条记录。',
    '结果仅显示二行。',
    'exactly 2 rows',
    '行数为2',
    'record count is 2',
  ]) {
    assert.doesNotThrow(() => validate({ target: table, check: 'row_count', expected: 2 }, text));
    assert.throws(() => validate({ target: table, check: 'row_count', expected: 1 }, text), {
      code: 'PLAN_ASSERTION_UNSUPPORTED',
    });
    const a = matrix();
    a.expected.exact_rows = true;
    assert.doesNotThrow(() => validate(a, prefix + text));
  }
  for (const text of ['共12行。', '共十二行。']) {
    const a = matrix();
    a.expected.exact_rows = true;
    assert.throws(() => validate(a, prefix + text), { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' });
  }
});
test('empty fields and ambiguous Chinese numerals do not define a row count', () => {
  for (const source of ['名称为空', 'empty name', '共一百二行'])
    assert.throws(
      () =>
        validate(
          { target: table, check: 'row_count', expected: source.includes('百') ? 102 : 0 },
          source,
        ),
      { code: 'PLAN_ASSERTION_UNSUPPORTED' },
    );
  for (const source of ['结果为空', '没有记录', 'empty table', 'no rows'])
    assert.doesNotThrow(() => validate({ target: table, check: 'row_count', expected: 0 }, source));
});
test('legal trailing rows do not erase absolute position or explicit full-count failures', () => {
  const actual = { headers: ['编号'], rows: [['R012'], ['R007'], ['R003']] };
  assert.equal(compareTableCells(actual, matrix().expected).passed, true);
  const closed = matrix().expected;
  closed.exact_rows = true;
  assert.equal(compareTableCells(actual, closed).passed, false);
  actual.rows.unshift(['R099']);
  const result = compareTableCells(actual, matrix().expected);
  assert.equal(result.passed, false);
  assert.ok(result.differences.some((d) => d.reason === 'row_position'));
});
