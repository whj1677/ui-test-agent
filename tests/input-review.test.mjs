import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INPUT_REVIEW_PROMPT,
  inputReviewInput,
  validateInputReview,
  validateInputOverrides,
  applyInputOverrides,
} from '../src/input-review.mjs';

const code = (value) => (error) => error.code === value;
const fixture = () => ({
  case_id: 'INPUT-1',
  title: '新增工单',
  preconditions: '使用专用测试客户。',
  data: {
    description: '测试数据中的描述',
    customer: { name: '专用测试客户', region: '东区' },
    tags: ['UI', '待确认'],
    priority: 2,
    enabled: true,
    optional: null,
  },
  test_data: { query: '查询值' },
  steps: [
    { step_id: 'S1', action: '填写描述：步骤中的描述', expected: '详情显示所填写的描述。' },
    { step_id: 'S2', action: '查看列表', expected: '列表数据不改变。' },
  ],
});
const finding = (overrides = {}) => ({
  code: 'CONTRADICTION',
  step_id: 'S1',
  message: '步骤和测试数据的描述不同，请确认以哪份描述为准。',
  source_quotes: ['填写描述：步骤中的描述', '测试数据中的描述'],
  ...overrides,
});

test('input review preserves the original conflict, grounds both quotes and returns inspectable paths', () => {
  const c = fixture(),
    reply = { issues: [finding()] },
    before = structuredClone({ c, reply });
  const result = validateInputReview(reply, c);
  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.issues[0].source_quotes, reply.issues[0].source_quotes);
  assert.deepEqual(result.issues[0].quote_locations, [
    { quote: '填写描述：步骤中的描述', paths: ['/effective/steps/0/action'] },
    { quote: '测试数据中的描述', paths: ['/effective/data/description'] },
  ]);
  result.issues[0].source_quotes[0] = 'changed';
  assert.deepEqual({ c, reply }, before);
});

test('empty issues is a valid review response without confirming or changing a Case', () => {
  assert.deepEqual(validateInputReview({ issues: [] }, fixture()), { issues: [] });
  for (const extra of [
    { confirmed: true },
    { plan: {} },
    { data_overrides: { data: { description: 'chosen by model' } } },
  ])
    assert.throws(
      () => validateInputReview({ issues: [], ...extra }, fixture()),
      code('INPUT_REVIEW_SCHEMA_INVALID'),
    );
  assert.match(INPUT_REVIEW_PROMPT, /cannot confirm, edit, repair or choose/);
  assert.match(INPUT_REVIEW_PROMPT, /not report an original conflict already resolved/);
});

test('forged source quotes, JSON keys and quotes from unrelated steps are rejected', () => {
  for (const quote of [
    '不存在的原文',
    'description',
    '列表数据不改变。',
    'source_control_candidates',
  ]) {
    assert.throws(
      () => validateInputReview({ issues: [finding({ source_quotes: [quote] })] }, fixture()),
      code('INPUT_REVIEW_QUOTE_UNGROUNDED'),
      quote,
    );
  }
});

test('review issues require known steps, finite schema and actual quotes', () => {
  const c = fixture();
  assert.throws(
    () => validateInputReview({ issues: [finding({ step_id: 'S99' })] }, c),
    code('INPUT_REVIEW_STEP_UNKNOWN'),
  );
  for (const change of [
    { code: 'APP_BUG' },
    { message: '' },
    { message: 'x'.repeat(1201) },
    { proposal: 'new Oracle' },
  ])
    assert.throws(
      () => validateInputReview({ issues: [finding(change)] }, c),
      code('INPUT_REVIEW_SCHEMA_INVALID'),
    );
  for (const source_quotes of [[], [''], ['   '], [123], ['x'.repeat(2001)], Array(7).fill('描述')])
    assert.throws(
      () => validateInputReview({ issues: [finding({ source_quotes })] }, c),
      code('INPUT_REVIEW_QUOTE_REQUIRED'),
    );
  assert.throws(
    () => validateInputReview({ issues: Array(21).fill(finding()) }, c),
    code('INPUT_REVIEW_SCHEMA_INVALID'),
  );
});

test('current clarification and overrides are cloned separately from the original source', () => {
  const original = fixture(),
    overrides = { data: { description: '已确认统一描述' } },
    effective = applyInputOverrides(original, overrides);
  effective.steps[0].action = '填写描述：已确认统一描述';
  const row = {
    confirmations: [
      {
        step_id: 'S1',
        action: effective.steps[0].action,
        expected: effective.steps[0].expected,
        note: '以已确认统一描述为准',
        source: 'LOCAL_OPERATOR',
      },
    ],
    data_overrides: overrides,
    confirmation_history: [{ steps: [{ action: '已作废文本' }] }],
    plan: { untrusted: 'excluded' },
  };
  const before = structuredClone({ original, effective, row }),
    view = inputReviewInput(original, effective, row);
  assert.equal(view.original.data.description, '测试数据中的描述');
  assert.equal(view.effective.data.description, '已确认统一描述');
  assert.equal(view.confirmations[0].note, '以已确认统一描述为准');
  assert.ok(!JSON.stringify(view).includes('已作废文本'));
  assert.ok(!own(view, 'plan'));
  const result = validateInputReview(
    { issues: [finding({ code: 'AMBIGUOUS', source_quotes: ['以已确认统一描述为准'] })] },
    view,
  );
  assert.deepEqual(result.issues[0].quote_locations[0].paths, ['/confirmations/0/note']);
  assert.throws(
    () => validateInputReview({ issues: [finding()] }, view),
    code('INPUT_REVIEW_QUOTE_SUPERSEDED'),
  );
  view.original.data.description = 'changed';
  view.effective.steps[0].action = 'changed';
  view.confirmations[0].note = 'changed';
  view.data_overrides.data.description = 'changed';
  assert.deepEqual({ original, effective, row }, before);
});

test('preconditions, nested test data and clarification values are quote sources, not source code or metadata', () => {
  const c = fixture();
  c.clarifications = [{ scope: '仅核对当前页记录标识' }];
  c.steps[1].clarifications = '包含当前页五条记录';
  c.source = { snippet: 'return list.length' };
  for (const [step_id, quote] of [
    ['S1', '使用专用测试客户'],
    ['S1', '查询值'],
    ['S2', '仅核对当前页记录标识'],
    ['S2', '包含当前页五条记录'],
  ])
    assert.doesNotThrow(() =>
      validateInputReview({ issues: [finding({ step_id, source_quotes: [quote] })] }, c),
    );
  assert.throws(
    () => validateInputReview({ issues: [finding({ source_quotes: ['return list.length'] })] }, c),
    code('INPUT_REVIEW_QUOTE_UNGROUNDED'),
  );
  assert.throws(
    () => inputReviewInput(c, { ...c, case_id: 'OTHER' }, {}),
    code('INPUT_REVIEW_CASE_MISMATCH'),
  );
});

test('operator data overrides only replace existing leaves and safely preserve nested siblings', () => {
  const original = fixture(),
    patch = {
      data: {
        customer: { name: '已确认客户' },
        tags: ['UI', '已确认'],
        priority: 3,
        enabled: false,
        optional: '明确的可选值',
      },
      test_data: { query: '' },
    },
    before = structuredClone({ original, patch });
  const validated = validateInputOverrides(patch, original),
    effective = applyInputOverrides(original, patch);
  assert.deepEqual(validated, patch);
  assert.equal(effective.data.customer.name, '已确认客户');
  assert.equal(effective.data.customer.region, '东区');
  assert.equal(effective.data.description, original.data.description);
  assert.deepEqual(effective.steps, original.steps);
  assert.equal(effective.test_data.query, '');
  validated.data.customer.name = 'mutated';
  effective.data.tags[0] = 'mutated';
  assert.deepEqual({ original, patch }, before);
});

test('overrides reject new fields and replacing existing object or array structures', () => {
  const original = fixture();
  for (const patch of [
    { data: { new_field: 'new' } },
    { test_data: { new_field: 'new' } },
    { data: { customer: { new_field: 'new' } } },
  ])
    assert.throws(
      () => validateInputOverrides(patch, original),
      code('INPUT_OVERRIDE_UNKNOWN_FIELD'),
    );
  for (const patch of [
    { data: { customer: 'flattened' } },
    { data: { description: { value: 'object' } } },
    { data: { tags: ['shortened'] } },
    { data: { tags: { 0: 'not-array' } } },
    { data: { priority: [] } },
  ])
    assert.throws(
      () => validateInputOverrides(patch, original),
      code('INPUT_OVERRIDE_STRUCTURE_CHANGED'),
    );
  assert.throws(
    () => validateInputOverrides({ data: { x: 'new' } }, { case_id: 'NO-DATA' }),
    code('INPUT_OVERRIDE_UNKNOWN_FIELD'),
  );
  for (const patch of [
    { steps: [] },
    { expected: 'new Oracle' },
    { data: null },
    { data: [] },
    { test_data: 'freeform' },
  ])
    assert.throws(() => validateInputOverrides(patch, original), code('INPUT_OVERRIDES_INVALID'));
});

test('overrides reject prototype-polluting names and never invoke property getters', () => {
  const original = fixture(),
    before = Object.prototype.polluted;
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const patch = JSON.parse(`{"data":{"${key}":{"polluted":true}}}`);
    assert.throws(() => validateInputOverrides(patch, original), code('INPUT_OVERRIDE_UNSAFE_KEY'));
  }
  const inherited = { data: Object.create({ description: 'inherited' }) };
  assert.throws(() => validateInputOverrides(inherited, original), code('INPUT_OVERRIDES_INVALID'));
  let invoked = false;
  const patch = { data: {} };
  Object.defineProperty(patch.data, 'description', {
    enumerable: true,
    get() {
      invoked = true;
      return 'untrusted';
    },
  });
  assert.throws(() => validateInputOverrides(patch, original), code('INPUT_OVERRIDES_INVALID'));
  assert.equal(invoked, false);
  assert.equal(Object.prototype.polluted, before);
});

test('overrides enforce finite depth, size and JSON values instead of silently truncating', () => {
  const original = fixture();
  assert.throws(
    () => validateInputOverrides({ data: { description: 'x'.repeat(4001) } }, original),
    code('INPUT_OVERRIDE_LIMIT'),
  );
  for (const value of [NaN, Infinity, undefined, () => {}, Symbol('x')])
    assert.throws(() => validateInputOverrides({ data: { description: value } }, original));
  const nest = (depth, value) => (depth ? { child: nest(depth - 1, value) } : value);
  assert.throws(
    () => validateInputOverrides({ data: nest(10, 'new') }, { data: nest(10, 'old') }),
    code('INPUT_OVERRIDE_LIMIT'),
  );
  const sparse = new Array(2);
  sparse[1] = 'last';
  assert.throws(
    () => validateInputOverrides({ data: { tags: sparse } }, original),
    code('INPUT_OVERRIDES_INVALID'),
  );
  const many = Object.fromEntries(
    Array.from({ length: 5 }, (_, i) => ['field' + i, 'x'.repeat(4000)]),
  );
  assert.throws(
    () => validateInputOverrides({ data: many }, { data: many }),
    code('INPUT_OVERRIDE_LIMIT'),
  );
});

const own = (value, key) => Object.hasOwn(value, key);
