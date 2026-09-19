import test from 'node:test';
import assert from 'node:assert/strict';
import { visibilityEvidenceGaps } from '../src/expectation-visibility.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';

const scope = { role: 'dialog', name: '对象详情', exact: true };
const field = {
  target: { kind: 'within', scope, target: { kind: 'definition', name: '功率', exact: true } },
  check: 'text',
  expected: '22 kW',
  obligation_ids: ['O'],
};
const note = {
  target: {
    kind: 'within',
    scope,
    target: { kind: 'role', role: 'heading', name: '旧记录', exact: true },
  },
  check: 'visible',
  obligation_ids: ['O'],
};
const original = {
  action: '查看对象详情的功率',
  expected: '可见旧记录即使含22 kW也不能作为功率字段',
  obligations: [{ id: 'O', text: '可见旧记录即使含22 kW也不能作为功率字段' }],
};
const close = {
  op: 'click',
  target: {
    kind: 'within',
    scope,
    target: { kind: 'role', role: 'button', name: '关闭详情', exact: true },
  },
};
const closed = {
  action: '点击关闭详情',
  expected: '详情关闭后恢复列表',
  obligations: [{ id: 'O', text: '详情关闭后恢复列表' }],
};
const hidden = { target: { kind: 'within', scope }, check: 'hidden', obligation_ids: ['O'] };

test('field value with same source is not visibility; correct scoped named visibility supplies only missing witness', () => {
  assert.equal(visibilityEvidenceGaps(original, { assertions: [field] })[0].name, '旧记录');
  assert.deepEqual(visibilityEvidenceGaps(original, { assertions: [field, note] }), []);
});
for (const [name, alter] of [
  ['other source', (a) => (a.obligation_ids = ['OTHER'])],
  ['other dialog', (a) => (a.target.scope.name = '另一个对象')],
  ['field instead', (a) => (a.target.target = field.target.target)],
  [
    'text is not visibility',
    (a) => {
      a.check = 'text';
      a.expected = '旧记录';
    },
  ],
  [
    'count is not visibility',
    (a) => {
      a.check = 'count';
      a.expected = 1;
    },
  ],
  ['non-exact name', (a) => (a.target.target.exact = false)],
])
  test('visible source witness rejects ' + name, () => {
    const a = structuredClone(note);
    alter(a);
    assert.equal(visibilityEvidenceGaps(original, { assertions: [field, a] }).length, 1);
  });
for (const text of [
  '如果可见旧记录即使含22 kW也不作为字段',
  '不可见旧记录',
  '无需可见旧记录',
  '旧记录即使含22 kW也不作为字段',
  '备注正文必须显示22 kW',
  '可见旧记录即使含22 kW也不作为字段仅为示例',
  '不要求可见旧记录即使有相同值',
  '可见旧记录即使相同或者允许不显示',
])
  test('does not reinterpret unsupported/conditional requirement: ' + text, () => {
    assert.deepEqual(
      visibilityEvidenceGaps({ ...original, obligations: [{ id: 'O', text }] }, { assertions: [] }),
      [],
    );
  });
test('an exact text locator can witness named visibility with unchanged object scope', () => {
  const a = structuredClone(note);
  a.target.target = { kind: 'text', value: '旧记录', exact: true };
  assert.deepEqual(visibilityEvidenceGaps(original, { assertions: [field, a] }), []);
});
test('same whole dialog hidden or exact absence witnesses closure, not acceptance of other obligations', () => {
  assert.equal(visibilityEvidenceGaps(closed, { actions: [close], assertions: [] }).length, 1);
  assert.deepEqual(visibilityEvidenceGaps(closed, { actions: [close], assertions: [hidden] }), []);
  const absent = { ...hidden, target: { kind: 'role', ...scope }, check: 'count', expected: 0 };
  assert.deepEqual(visibilityEvidenceGaps(closed, { actions: [close], assertions: [absent] }), []);
});
for (const [name, alter] of [
  ['wrong dialog', (a) => (a.target.scope.name = '其他详情')],
  ['button only', (a) => (a.target = close.target)],
  ['wrong source', (a) => (a.obligation_ids = ['OTHER'])],
  ['visible', (a) => (a.check = 'visible')],
  [
    'nonzero count',
    (a) => {
      a.check = 'count';
      a.expected = 1;
    },
  ],
])
  test('closure does not accept ' + name, () => {
    const a = structuredClone(hidden);
    alter(a);
    assert.equal(visibilityEvidenceGaps(closed, { actions: [close], assertions: [a] }).length, 1);
  });
for (const action of ['不点击关闭详情', '如果出现则点击关闭详情', '例如点击关闭详情', '点击取消'])
  test('does not reinterpret negative/conditional/other action ' + action, () => {
    assert.deepEqual(
      visibilityEvidenceGaps({ ...closed, action }, { actions: [close], assertions: [] }),
      [],
    );
  });
test('guard is adaptive complete-only; original source and candidate remain immutable', () => {
  const plan = { steps: [{ actions: [], assertions: [] }] },
    c = { steps: [original] },
    before = structuredClone({ plan, c });
  assert.doesNotThrow(() =>
    requirePlanSemantics(plan, c, { adaptive_readonly: true }, { complete: false }),
  );
  assert.doesNotThrow(() => requirePlanSemantics(plan, c, {}));
  assert.throws(() => requirePlanSemantics(plan, c, { adaptive_readonly: true }), {
    code: 'PLAN_VISIBILITY_UNPROVEN',
  });
  assert.deepEqual({ plan, c }, before);
});

for (const text of ['如果详情关闭后恢复列表', '例如详情已关闭', '详情已关闭或仍可见'])
  test('closed-state guard does not choose conditional/example/alternative: ' + text, () => {
    assert.deepEqual(
      visibilityEvidenceGaps(
        { ...closed, obligations: [{ id: 'O', text }] },
        { actions: [close], assertions: [] },
      ),
      [],
    );
  });
