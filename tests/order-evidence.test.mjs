import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { orderEvidenceGaps, sourceOrderRequirements } from '../src/order-evidence.mjs';

const original = {
  action: '观察默认列表',
  expected: '排序为编号升序',
  obligations: [{ id: 'O', text: '排序为编号升序' }],
};
const control = {
  target: { kind: 'label', value: '排序', exact: true },
  check: 'selected_label',
  expected: '编号升序',
  oracle_quote: original.expected,
  obligation_ids: ['O'],
};
const plan = { steps: [{ actions: [], assertions: [control] }] };
test('sort control cannot complete an original actual order obligation', () => {
  assert.throws(
    () => requirePlanSemantics(plan, { steps: [original] }, { adaptive_readonly: true }),
    { code: 'PLAN_TABLE_ORDER_UNPROVEN' },
  );
});
test('missing order witness is not complete either', () => {
  assert.throws(
    () =>
      requirePlanSemantics(
        { steps: [{ actions: [], assertions: [] }] },
        { steps: [original] },
        { adaptive_readonly: true },
      ),
    { code: 'PLAN_TABLE_ORDER_UNPROVEN' },
  );
});
test('partial may still gather order evidence; fixed path is unchanged', () => {
  assert.doesNotThrow(() =>
    requirePlanSemantics(
      plan,
      { steps: [original] },
      { adaptive_readonly: true },
      { complete: false },
    ),
  );
  assert.doesNotThrow(() => requirePlanSemantics(plan, { steps: [original] }, {}));
});

const table = { kind: 'role', role: 'table', name: '结果', exact: true };
const relation = {
  target: table,
  check: 'table_order',
  expected: { field: '编号', column: '编号', direction: 'ascending', comparison: 'identifier' },
  oracle_quote: original.expected,
  obligation_ids: ['O'],
};
const withText = (text) => ({ action: '观察', expected: text, obligations: [{ id: 'O', text }] });
for (const text of [
  '排序为编号升序',
  '默认排序是编号升序',
  '表格按编号升序排列',
  '列表以编号升序排序',
  '默认计数器为3，排序为编号升序，表体3行',
])
  test('literal supported source ' + text, () =>
    assert.equal(sourceOrderRequirements(withText(text)).length, 1),
  );
for (const text of [
  '排序控件显示编号升序',
  '排序下拉框排序为编号升序',
  '不要求排序为编号升序',
  '如果排序为编号升序才检查',
  '例如排序为编号升序',
  '排序为编号升序或名称降序',
  '尚未应用，排序为编号升序',
  '操作前排序为编号升序',
  '排序为编号升序仅为示例',
  '表格不按编号升序',
  '只核对行数',
  '标题包含排序为编号升序',
])
  test('does not invent ordering for ' + text, () =>
    assert.deepEqual(sourceOrderRequirements(withText(text)), []),
  );
test('same original relation witness accepted, no source or candidate mutation', () => {
  const step = { actions: [], assertions: [control, relation] },
    before = structuredClone({ original, step });
  assert.deepEqual(orderEvidenceGaps(original, step), []);
  assert.deepEqual({ original, step }, before);
});
for (const [name, edit] of [
  ['wrong obligation', (a) => (a.obligation_ids = ['OTHER'])],
  ['wrong field', (a) => (a.expected.field = '功率')],
  ['wrong direction', (a) => (a.expected.direction = 'descending')],
  ['invented quote', (a) => (a.oracle_quote = '功率降序')],
  [
    'control only',
    (a) => {
      a.check = 'selected_label';
      a.expected = '编号升序';
    },
  ],
])
  test('relation witness rejects ' + name, () => {
    const a = structuredClone(relation);
    edit(a);
    assert.equal(orderEvidenceGaps(original, { assertions: [a] }).length, 1);
  });
const matrix = {
  target: table,
  check: 'table_cells',
  obligation_ids: ['O'],
  expected: {
    key_column: '编号',
    ordered: true,
    exact_rows: true,
    rows: [
      { key: 'X001', cells: [] },
      { key: 'X002', cells: [] },
    ],
  },
};
test('complete original identity matrix can prove identifier order without a redundant check', () =>
  assert.deepEqual(orderEvidenceGaps(original, { assertions: [matrix] }), []));
for (const [name, edit] of [
  ['subset', (a) => (a.expected.exact_rows = false)],
  ['unordered', (a) => (a.expected.ordered = false)],
  ['reverse', (a) => a.expected.rows.reverse()],
  ['single', (a) => a.expected.rows.pop()],
  ['wrong field', (a) => (a.expected.key_column = '状态')],
  ['wrong source', (a) => (a.obligation_ids = ['OTHER'])],
])
  test('matrix cannot prove whole order: ' + name, () => {
    const a = structuredClone(matrix);
    edit(a);
    assert.equal(orderEvidenceGaps(original, { assertions: [a] }).length, 1);
  });
test('projected matrix cannot establish actual suffix uniqueness or absence of exact header', () => {
  const a = structuredClone(matrix);
  a.expected.key_column = '设备编号';
  assert.equal(orderEvidenceGaps(original, { assertions: [a] }).length, 1);
});
const numeric = withText('表格按额定功率降序排列');
const values = {
  ...matrix,
  expected: {
    key_column: '编号',
    ordered: true,
    exact_rows: true,
    rows: [
      { key: 'X001', cells: [{ column: '额定功率', check: 'text', expected: '20 kW' }] },
      { key: 'X002', cells: [{ column: '额定功率', check: 'text', expected: '10 kW' }] },
    ],
  },
};
test('complete exact-value same-unit matrix supports the original numeric order', () =>
  assert.deepEqual(orderEvidenceGaps(numeric, { assertions: [values] }), []));
for (const [name, edit] of [
  ['mixed units', (a) => (a.expected.rows[1].cells[0].expected = '10 MW')],
  ['wrong column', (a) => (a.expected.rows[1].cells[0].column = '温度')],
  [
    'numeric projection',
    (a) => (a.expected.rows[1].cells[0] = { column: '额定功率', check: 'number', expected: 10 }),
  ],
  [
    'duplicate column',
    (a) => a.expected.rows[0].cells.push({ column: '额定功率', check: 'text', expected: '99 kW' }),
  ],
])
  test('matrix relation does not infer unsupported values: ' + name, () => {
    const a = structuredClone(values);
    edit(a);
    assert.equal(orderEvidenceGaps(numeric, { assertions: [a] }).length, 1);
  });
test('original short field still needs actual header inventory, not an expected-column projection', () => {
  assert.equal(
    orderEvidenceGaps(withText('表格按功率降序排列'), { assertions: [values] }).length,
    1,
  );
});
