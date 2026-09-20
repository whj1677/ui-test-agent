import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestObligations } from '../src/plans.mjs';
import { createAdaptivePlan, validateAdaptiveFragment } from '../src/adaptive-plan.mjs';
import {
  sourceQueryRequirements,
  requireQueryResultEvidence,
  QUERY_RESULT_EVIDENCE_GUIDANCE,
} from '../src/query-result-evidence.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
import { ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';

const base = 'http://127.0.0.1:4888/';
const c = {
  case_id: 'QUERY-EVIDENCE',
  data: { keyword: '阀门', park: '西区', state: '在线', id: 'X017' },
  steps: suggestObligations([
    {
      step_id: '1',
      action: '在「关键词」输入 阀门，「园区」选择 西区，「状态」选择 在线。',
      expected: '条件已设置。',
    },
    { step_id: '2', action: '点击「查询」。', expected: '条件按AND生效。' },
  ]),
};
const table = { kind: 'role', role: 'table', name: '记录', exact: true };
const field = (column, expected, extra = {}) => ({
  target: {
    kind: 'cell',
    table: structuredClone(table),
    key: { column: '编号', value: 'X017' },
    column,
  },
  check: 'text',
  expected,
  oracle_quote: '条件按AND生效',
  obligation_ids: ['2-O1'],
  ...extra,
});
const full = () => [field('名称', '阀门'), field('园区', '西区'), field('状态', '在线')];
function validate(assertions, options = {}) {
  const source = options.c ?? c;
  const plan = createAdaptivePlan(source, '/');
  return validateAdaptiveFragment(
    {
      actions: [],
      assertions,
      complete: options.complete ?? true,
      within_ms: 1000,
      reason: '查询结果字段',
    },
    { c: source, plan, step: plan.steps[1], base, previous: options.previous ?? [] },
  );
}
test('AND result cannot complete with keyword input plus only park and state result fields', () => {
  const input = field('名称', '阀门', {
    target: { kind: 'label', value: '关键词', exact: true },
    check: 'value',
  });
  assert.throws(() => validate([input, ...full().slice(1)]), {
    code: 'PLAN_QUERY_RESULT_UNPROVEN',
  });
});
test('AND fields from different records cannot be assembled into one proof', () => {
  const fields = full();
  fields[0].target.key.value = '西区';
  assert.throws(() => validate(fields), { code: 'PLAN_QUERY_RESULT_UNPROVEN' });
});
test('complete same-record field proof remains accepted', () =>
  assert.doesNotThrow(() => validate(full())));

for (const kind of [
  'missing',
  'wrong-value',
  'contains-selector',
  'other-obligation',
  'other-table',
])
  test('necessary field proof rejects ' + kind, () => {
    const fields = full();
    if (kind === 'missing') fields.shift();
    if (kind === 'wrong-value') fields[0].expected = '西区';
    if (kind === 'contains-selector') fields[1].check = 'contains';
    if (kind === 'other-obligation') fields[0].obligation_ids = ['1-O1'];
    if (kind === 'other-table') fields[0].target.table.name = '别的表';
    assert.throws(() => requireQueryResultEvidence(c, c.steps[1], { assertions: fields }), {
      code: 'PLAN_QUERY_RESULT_UNPROVEN',
    });
  });

test('partial fragment may defer result evidence but cannot claim completion', () => {
  assert.doesNotThrow(() => validate(full().slice(1), { complete: false }));
  const previous = [
    {
      actions: [],
      assertions: full().slice(1),
      complete: false,
      within_ms: 1000,
      reason: '已实测其余字段',
    },
  ];
  assert.doesNotThrow(() => validate(full().slice(0, 1), { previous }));
});
test('same-table original matrix supports each row; one bad row cannot borrow a different row field', () => {
  const expected = {
    key_column: '编号',
    ordered: false,
    exact_rows: false,
    rows: [
      {
        key: 'X017',
        cells: full().map((a) => ({
          column: a.target.column,
          check: 'text',
          expected: a.expected,
        })),
      },
    ],
  };
  const matrix = { ...field('名称', '阀门'), target: table, check: 'table_cells', expected };
  assert.doesNotThrow(() => validate([matrix]));
  expected.rows.push({ key: 'X018', cells: [{ column: '园区', check: 'text', expected: '西区' }] });
  assert.throws(() => requireQueryResultEvidence(c, c.steps[1], { assertions: [matrix] }), {
    code: 'PLAN_QUERY_RESULT_UNPROVEN',
  });
});
test('keyword may be measured with original substring, not weakened selector comparison', () => {
  const fields = full();
  fields[0].check = 'contains';
  assert.doesNotThrow(() => validate(fields));
});
for (const expected of [
  '条件不按AND生效。',
  '如果条件按AND生效则显示。',
  '例如条件按AND生效。',
  '尚未查询，不要求条件按AND生效。',
  '输入框条件已设置。',
])
  test('no positive AND requirement manufactured: ' + expected, () => {
    const x = { ...c.steps[1], expected, obligations: [{ id: '2-O1', text: expected }] };
    assert.deepEqual(sourceQueryRequirements(c, x), []);
  });
for (const action of [
  '点击「重置」。',
  '进入另一个页面。',
  '如果需要，在「关键词」输入 阀门。',
  '在关键词输入 阀门。',
  '在「状态」选择 在线，「状态」选择 离线。',
])
  test('ambiguous or interrupted input never borrowed: ' + action, () => {
    const clone = structuredClone(c);
    clone.steps[0].action = action;
    assert.throws(() => validate(full(), { c: clone }), { code: 'PLAN_QUERY_SOURCE_UNRESOLVED' });
  });
test('later expected fields cannot substitute original query inputs', () => {
  const clone = structuredClone(c);
  clone.steps[0].action = '观察页面。';
  clone.steps.push(
    ...suggestObligations([
      { step_id: '3', action: c.steps[0].action, expected: '名称阀门，园区西区，状态在线。' },
    ]),
  );
  assert.throws(() => validate(full(), { c: clone }), { code: 'PLAN_QUERY_SOURCE_UNRESOLVED' });
});
test('same-step literal inputs and quoted values are supported; sorting is not a result condition', () => {
  const clone = structuredClone(c);
  clone.steps[1].action =
    '在「关键词」输入「阀门」，「园区」选择「西区」，「状态」选择「在线」，「排序」选择「编号升序」，点击「查询」。';
  assert.deepEqual(
    sourceQueryRequirements(clone, clone.steps[1])[0].conditions.map((v) => v.value),
    ['阀门', '西区', '在线'],
  );
  assert.doesNotThrow(() => validate(full(), { c: clone }));
});
test('one column cannot prove two different named inputs just because their literals are equal', () => {
  const clone = structuredClone(c);
  clone.steps[0].action = '「甲状态」选择 在线，「乙状态」选择 在线。';
  assert.throws(
    () =>
      requireQueryResultEvidence(clone, clone.steps[1], { assertions: [field('甲状态', '在线')] }),
    { code: 'PLAN_QUERY_RESULT_UNPROVEN' },
  );
  assert.doesNotThrow(() =>
    requireQueryResultEvidence(clone, clone.steps[1], {
      assertions: [field('甲状态', '在线'), field('乙状态', '在线')],
    }),
  );
});
test('source, candidate and shared guidance remain unchanged', () => {
  const fields = full(),
    before = structuredClone({ c, fields });
  requireQueryResultEvidence(c, c.steps[1], { assertions: fields });
  assert.deepEqual({ c, fields }, before);
  assert.ok(ADAPTIVE_NEXT_PROMPT.includes(QUERY_RESULT_EVIDENCE_GUIDANCE));
  assert.ok(ADAPTIVE_REVIEW_REFERENCES.includes(QUERY_RESULT_EVIDENCE_GUIDANCE));
});

test('explicit empty results can use actual empty-table evidence, not invent a record', () => {
  const clone = structuredClone(c);
  clone.steps[1].expected = '条件按AND生效；结果为空。';
  clone.steps[1].obligations = [
    { id: '2-O1', text: '条件按AND生效' },
    { id: '2-O2', text: '结果为空' },
  ];
  const empty = {
    target: table,
    check: 'row_count',
    expected: 0,
    obligation_ids: ['2-O1', '2-O2'],
  };
  assert.doesNotThrow(() =>
    requireQueryResultEvidence(clone, clone.steps[1], { assertions: [empty] }),
  );
  assert.throws(() => requireQueryResultEvidence(c, c.steps[1], { assertions: [empty] }), {
    code: 'PLAN_QUERY_RESULT_UNPROVEN',
  });
});
for (const action of [
  '「名称」输入 阀门，「园区」选择 西区。',
  '「关键词」输入 阀门，「园区」选择 全部。',
  '「关键词」输入 阀门，「园区」选择 西区，然后清空条件。',
  '「关键词」输入 阀门，「园区」选择 西区，设置第三条件。',
])
  test('unknown matching semantics or omitted clauses remain unresolved: ' + action, () => {
    const clone = structuredClone(c);
    clone.steps[0].action = action;
    assert.equal(sourceQueryRequirements(clone, clone.steps[1])[0].unresolved, true);
  });
