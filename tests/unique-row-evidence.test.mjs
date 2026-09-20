import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { sourceTableCounts, sourceUniqueRows } from '../src/table-cardinality.mjs';
import { uniqueRowRequirements, uniqueRowEvidenceGaps } from '../src/unique-row-evidence.mjs';
import { stepCapabilityFacts } from '../src/adaptive-capabilities.mjs';

const table = { kind: 'role', role: 'table', name: '结果', exact: true };
const expected = '唯一行是 R009，名称设备；不出现 R001。';
const original = {
  step_id: '1',
  action: '核对结果。',
  expected,
  obligations: [
    { id: 'O1', text: '唯一行是 R009' },
    { id: 'O2', text: '名称设备' },
    { id: 'O3', text: '不出现 R001' },
  ],
};
const identity = () => ({
  target: { kind: 'cell', table, key: { column: '编号', value: 'R009' }, column: '编号' },
  check: 'text',
  expected: 'R009',
  obligation_ids: ['O1'],
});
const count = () => ({ target: table, check: 'row_count', expected: 1, obligation_ids: ['O1'] });
const absence = () => ({
  target: { kind: 'row', table, key: { column: '编号', value: 'R001' } },
  check: 'count',
  expected: 0,
  obligation_ids: ['O3'],
});
function check(points, source = original, complete = true) {
  return requirePlanSemantics(
    { steps: [{ checkpoints: points.map((assertions) => ({ actions: [], assertions })) }] },
    { steps: [source] },
    { adaptive_readonly: true },
    { complete },
  );
}
test('literal sole record is a source quantity of one, not an observed default', () => {
  assert.deepEqual(sourceTableCounts(expected), [1]);
  assert.deepEqual(sourceTableCounts('记录R009可见；不出现R001。'), []);
});
test('identity plus exclusion of another key cannot prove sole record', () => {
  assert.throws(() => check([[identity(), absence()]]), { code: 'PLAN_UNIQUE_ROW_UNPROVEN' });
  assert.doesNotThrow(() => check([[identity(), absence()]], original, false));
});
test('sole record needs same-group same-table identity and total', () => {
  assert.doesNotThrow(() => check([[identity(), count(), absence()]]));
  assert.throws(() => check([[identity()], [count(), absence()]]), {
    code: 'PLAN_UNIQUE_ROW_UNPROVEN',
  });
  const other = count();
  other.target = { ...table, name: '其他表' };
  assert.throws(() => check([[identity(), other, absence()]]), {
    code: 'PLAN_UNIQUE_ROW_UNPROVEN',
  });
});
test('one closed matrix proves sole identity, open membership does not', () => {
  const matrix = {
    target: table,
    check: 'table_cells',
    expected: {
      key_column: '编号',
      rows: [{ key: 'R009', cells: [{ column: '编号', check: 'text', expected: 'R009' }] }],
      ordered: false,
      exact_rows: true,
    },
    obligation_ids: ['O1'],
  };
  assert.doesNotThrow(() => check([[matrix]]));
  matrix.expected.exact_rows = false;
  assert.throws(() => check([[matrix]]), { code: 'PLAN_UNIQUE_ROW_UNPROVEN' });
});

test('unique source is shared by capabilities and count authorization', () => {
  assert.deepEqual(sourceUniqueRows(expected), ['R009']);
  assert.deepEqual(uniqueRowRequirements(original), [
    { source_ref: 'O1', key: 'R009', row_count: 1 },
  ]);
  assert.deepEqual(
    stepCapabilityFacts(original, 'http://localhost/').unique_rows,
    uniqueRowRequirements(original),
  );
  for (const text of ['唯一记录为R009', '当前表中唯一的结果行是「R009」'])
    assert.deepEqual(sourceTableCounts(text), [1]);
});
for (const text of [
  '不要求唯一行是R009',
  '如果唯一行是R009',
  '此前唯一行是R009',
  '例如唯一行是R009',
  '标题说明唯一行是R009',
  '唯一行是R009或R010',
  '唯一行是R009的说法不成立',
  '编号唯一，记录R009可见',
  '第一行是R009',
  '前一行是R009',
  '唯一行',
  '点击唯一行按钮',
])
  test('not an affirmative sole-table record source: ' + text, () => {
    assert.deepEqual(sourceUniqueRows(text), []);
    assert.deepEqual(sourceTableCounts(text), []);
  });

test('a rejected sole-row phrase cannot mask a separate explicit quantity', () => {
  assert.deepEqual(sourceTableCounts('标题说明唯一行是R009；结果共2行'), [2]);
  assert.deepEqual(sourceTableCounts('唯一行是R009；结果共1行'), [1]);
});

test('different source, identity, key-only count, unbound text and count alone remain gaps', () => {
  const wrongCount = count();
  wrongCount.obligation_ids = ['O3'];
  const wrongIdentity = identity();
  wrongIdentity.target = { ...wrongIdentity.target, key: { column: '编号', value: 'R001' } };
  wrongIdentity.expected = 'R001';
  const keyCount = {
    ...identity(),
    target: { kind: 'row', table, key: { column: '编号', value: 'R009' } },
    check: 'count',
    expected: 1,
  };
  const textOnly = { ...identity(), target: { kind: 'text', value: 'R009', exact: true } };
  for (const assertions of [
    [identity(), wrongCount],
    [wrongIdentity, count()],
    [keyCount, count()],
    [textOnly, count()],
    [count()],
  ])
    assert.equal(uniqueRowEvidenceGaps(original, { assertions }).length, 1);
});

test('no new closed-population obligation for ordinary membership and no input mutation', () => {
  const source = {
    ...original,
    expected: '记录R009可见。',
    obligations: [{ id: 'O1', text: '记录R009可见' }],
  };
  const before = structuredClone(source);
  assert.deepEqual(uniqueRowRequirements(source), []);
  assert.doesNotThrow(() => check([[identity()]], source));
  assert.deepEqual(source, before);
});
