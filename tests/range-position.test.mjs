import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRowPositions, rowPositionSourceGaps } from '../src/table-position.mjs';
import { sourceTableCounts, hasTablePositionPhrase } from '../src/table-cardinality.mjs';
import { validateTableExpectation, compareTableCells } from '../src/table-assertion.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { stepCapabilityFacts } from '../src/adaptive-capabilities.mjs';

const text = '第2至4行依次为 R301 泵 10、R499 柜 20、R102 阀 30。';
const positions = [
  { key: 'R301', position: 2 },
  { key: 'R499', position: 3 },
  { key: 'R102', position: 4 },
];
const table = { kind: 'role', role: 'table', name: '设备', exact: true };
const matrix = () => ({
  key_column: '编号',
  rows: positions.map((p) => ({
    ...p,
    cells: [{ column: '编号', check: 'text', expected: p.key }],
  })),
  ordered: false,
  exact_rows: false,
});
const original = (source) => ({
  step_id: '1',
  action: '观察当前表格。',
  expected: source,
  obligations: [{ id: 'O1', text: source }],
});
function semantics(assertion, source = text, complete = true) {
  return requirePlanSemantics(
    { steps: [{ assertions: [assertion] }] },
    { steps: [original(source)] },
    { adaptive_readonly: true },
    { complete },
  );
}

test('range source maps each literal identity to its absolute row, not ID numeric suffix', () => {
  assert.deepEqual(extractRowPositions(text), positions);
  assert.deepEqual(
    stepCapabilityFacts(original(text), 'http://127.0.0.1/').row_positions,
    positions.map((p) => ({ source_ref: 'O1', ...p, required_check: 'table_cells' })),
  );
});
test('source-grounded range position is legal and a shifted prefix remains a real difference', () => {
  assert.doesNotThrow(() => validateTableExpectation(matrix(), { expected: text }));
  const actual = { headers: ['编号'], rows: [['R900'], ['R301'], ['R499'], ['R102'], ['R901']] };
  assert.equal(compareTableCells(actual, matrix()).passed, true);
  actual.rows.unshift(['R902']);
  assert.equal(compareTableCells(actual, matrix()).passed, false);
});
test('relative order cannot complete explicit range positions', () => {
  const e = matrix();
  e.rows.forEach((r) => delete r.position);
  e.ordered = true;
  const a = { target: table, check: 'table_cells', expected: e, obligation_ids: ['O1'] };
  assert.throws(() => semantics(a), { code: 'PLAN_ROW_POSITION_UNPROVEN' });
  assert.doesNotThrow(() => semantics(a, text, false));
});
test('range endpoint is not a current-table row count or permission for exact_rows', () => {
  assert.deepEqual(sourceTableCounts(text), []);
  assert.equal(hasTablePositionPhrase(text), true);
  const a = {
    target: table,
    check: 'table_cells',
    expected: { ...matrix(), exact_rows: true },
    obligation_ids: ['O1'],
  };
  assert.throws(() => semantics(a, text, false), { code: 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED' });
  assert.throws(() => semantics({ target: table, check: 'row_count', expected: 4 }, text, false), {
    code: 'PLAN_ASSERTION_UNSUPPORTED',
  });
});

for (const header of ['第2到4行依次是', '第二至第四行依次为', '第2-4行依次为', '第2～4行依次为'])
  test('bounded range syntax maps the same original identities: ' + header, () => {
    const source = header + '「R301」泵10、「R499」柜20、「R102」阀30。';
    assert.deepEqual(extractRowPositions(source), positions);
    assert.deepEqual(sourceTableCounts(source), []);
    assert.doesNotThrow(() => validateTableExpectation(matrix(), { expected: source }));
  });

for (const source of [
  '第0至2行依次为R301、R499、R102。',
  '第-1至1行依次为R301、R499、R102。',
  '第1.5至3行依次为R301、R499。',
  '第1000至1001行依次为R301、R499。',
  '第十一至十三行依次为R301、R499、R102。',
  '第4至2行依次为R301、R499、R102。',
  '第2至4行依次为R301、R499。',
  '第2至4行依次为R301、R499、R499。',
  '第2至4行依次为设备甲、设备乙、设备丙。',
  '第2至4行依次为R301至R303。',
  '第2至4行分别对应现场看到的设备。',
])
  test(
    'recognized ambiguous interval is a completion gap, never a relative-order pass: ' + source,
    () => {
      assert.deepEqual(extractRowPositions(source), []);
      assert.ok(rowPositionSourceGaps(source).length);
      assert.deepEqual(sourceTableCounts(source), []);
      const a = { target: table, check: 'visible', obligation_ids: ['O1'] };
      assert.throws(() => semantics(a, source), { code: 'PLAN_ROW_POSITION_SOURCE_UNRESOLVED' });
      assert.doesNotThrow(() => semantics(a, source, false));
    },
  );

test('at most 50 identities and explicit separate total remains separate', () => {
  const ids = Array.from({ length: 51 }, (_, i) => 'K' + String(i + 1).padStart(3, '0'));
  assert.equal(extractRowPositions('第1至50行依次为' + ids.slice(0, 50).join('、')).length, 50);
  assert.ok(rowPositionSourceGaps('第1至51行依次为' + ids.join('、')).length);
  assert.deepEqual(sourceTableCounts(text + '共7行。'), [7]);
  assert.doesNotThrow(() =>
    semantics({ target: table, check: 'row_count', expected: 7 }, text + '共7行。', false),
  );
  assert.throws(
    () => semantics({ target: table, check: 'row_count', expected: 4 }, text + '共7行。', false),
    { code: 'PLAN_ASSERTION_UNSUPPORTED' },
  );
});

for (const prefix of ['不要求', '如果', '例如', '此前', '操作前', '按钮显示', '标题说明'])
  test(
    'negative, conditional, historical or control text is not a positive position obligation: ' +
      prefix,
    () => {
      const source = prefix + text;
      assert.deepEqual(extractRowPositions(source), []);
      assert.deepEqual(rowPositionSourceGaps(source), []);
    },
  );

test('range source grounding is immutable and cannot come from data or altered keys/ordinals', () => {
  const before = structuredClone(positions);
  const e = matrix();
  e.rows[0].position = 1;
  assert.throws(() => validateTableExpectation(e, { expected: text }), {
    code: 'TABLE_POSITION_UNGROUNDED',
  });
  assert.throws(
    () =>
      validateTableExpectation(matrix(), { expected: '存在R301、R499、R102', data: { positions } }),
    { code: 'TABLE_POSITION_UNGROUNDED' },
  );
  assert.deepEqual(positions, before);
  const prefix = { headers: ['编号'], rows: [['R900'], ['R301'], ['R499'], ['R102'], ['R901']] };
  assert.equal(
    compareTableCells(prefix, matrix()).passed,
    true,
    'unrequested trailing rows remain allowed',
  );
  const swapped = structuredClone(prefix);
  [swapped.rows[2], swapped.rows[3]] = [swapped.rows[3], swapped.rows[2]];
  assert.equal(compareTableCells(swapped, matrix()).passed, false);
});

test('negative-looking field values do not erase a positive positional requirement', () => {
  const source = '当前第2至4行依次为R301 未启用、R499 不可用、R102 类别A。';
  assert.deepEqual(extractRowPositions(source), positions);
  assert.deepEqual(rowPositionSourceGaps(source), []);
  for (const negative of [
    '第2至4行不要求依次为R301、R499、R102。',
    '第2至4行如果依次为R301、R499、R102。',
  ]) {
    assert.deepEqual(extractRowPositions(negative), []);
    assert.deepEqual(rowPositionSourceGaps(negative), []);
  }
  assert.ok(rowPositionSourceGaps('第2至4行依次为R301或R300、R499、R102。').length);
});
