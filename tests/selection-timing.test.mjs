import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionTimingGaps } from '../src/selection-timing.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
const scope = { role: 'dialog', name: '对象详情', exact: true };
const target = {
  kind: 'within',
  scope,
  target: { kind: 'role', role: 'tab', name: '基本信息', exact: true },
};
const a = { target, check: 'aria_selected', expected: true, obligation_ids: ['O'] };
const click = { op: 'click', target };
const original = {
  action: '切回基本信息页签并复核',
  expected: '基本信息选中',
  obligations: [{ id: 'O', text: '基本信息选中' }],
};
test('post-switch assertion cannot precede original action even in a partial candidate', () => {
  const step = { actions: [], assertions: [a] },
    c = { steps: [original] },
    plan = { steps: [step] },
    context = { adaptive_readonly: true, pages: [{ controls: [{ locator: target }] }] };
  assert.equal(selectionTimingGaps(original, step).length, 1);
  for (const complete of [true, false])
    assert.throws(() => requirePlanSemantics(plan, c, context, { complete }), {
      code: 'ASSERTION_SELECTION_BEFORE_ACTION',
    });
});
test('same-point and earlier-point exact original target click precedes assertion', () => {
  for (const step of [
    { actions: [click], assertions: [a] },
    {
      checkpoints: [
        { actions: [click], assertions: [] },
        { actions: [], assertions: [a] },
      ],
    },
  ])
    assert.deepEqual(selectionTimingGaps(original, step), []);
});
test('future click cannot backfill earlier assertion', () => {
  assert.equal(
    selectionTimingGaps(original, {
      checkpoints: [
        { actions: [], assertions: [a] },
        { actions: [click], assertions: [] },
      ],
    }).length,
    1,
  );
});
for (const [name, edit] of [
  ['other dialog', (c) => (c.target.scope.name = '其他详情')],
  ['other tab', (c) => (c.target.target.name = '作业参数')],
  ['hover is not switch', (c) => (c.op = 'hover')],
])
  test(name + ' cannot discharge pending switch', () => {
    const other = structuredClone(click);
    edit(other);
    assert.equal(selectionTimingGaps(original, { actions: [other], assertions: [a] }).length, 1);
  });
for (const action of [
  '不点击基本信息页签',
  '如果出现则点击基本信息页签',
  '例如切回基本信息页签',
  '点击详情并核对基本信息页签',
  '查看基本信息页签',
])
  test('no inferred switch: ' + action, () => {
    assert.deepEqual(
      selectionTimingGaps({ ...original, action }, { actions: [], assertions: [a] }),
      [],
    );
  });
for (const expected of ['默认页签为基本信息', '初始基本信息页签选中', '切换前基本信息已选中'])
  test('preserve original pre-state measurement: ' + expected, () => {
    assert.deepEqual(
      selectionTimingGaps({ ...original, expected }, { actions: [], assertions: [a] }),
      [],
    );
  });
for (const action of [
  '点击“基本信息”页签',
  '切换到基本信息标签页',
  '切换至基本信息页签',
  '选择基本信息页签',
])
  test('literal positive switch: ' + action, () => {
    assert.equal(
      selectionTimingGaps({ ...original, action }, { actions: [], assertions: [a] }).length,
      1,
    );
  });
test('previous original-step click does not carry into new step; original and candidate are not edited', () => {
  const earlier = { actions: [click], assertions: [] },
    current = { actions: [], assertions: [a] },
    before = structuredClone({ original, earlier, current });
  assert.deepEqual(selectionTimingGaps(original, earlier), []);
  assert.equal(selectionTimingGaps(original, current).length, 1);
  assert.deepEqual({ original, earlier, current }, before);
});
