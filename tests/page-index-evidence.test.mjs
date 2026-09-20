import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestObligations } from '../src/plans.mjs';
import { createAdaptivePlan, fragmentAuditPlan } from '../src/adaptive-plan.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import {
  currentPageRequirements,
  currentPageEvidenceGaps,
  requireCurrentPageAssertion,
  CURRENT_PAGE_GUIDANCE,
} from '../src/page-index-evidence.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
import { ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';
import { requireAdaptiveAssertionTargets } from '../src/adaptive-execution.mjs';
import { chromium } from 'playwright';

const c = {
  case_id: 'PAGE-INDEX',
  steps: suggestObligations([
    { step_id: '1', action: '观察默认列表。', expected: '默认第1页显示X001至X002。' },
  ]),
};
const table = { kind: 'role', role: 'table', name: '结果', exact: true };
const matrix = {
  target: table,
  check: 'table_cells',
  expected: {
    key_column: '编号',
    rows: ['X001', 'X002'].map((key) => ({
      key,
      cells: [{ column: '编号', check: 'text', expected: key }],
    })),
    ordered: false,
    exact_rows: false,
  },
  oracle_quote: '默认第1页显示X001至X002',
  obligation_ids: ['1-O1'],
};
const pager = {
  target: { kind: 'text', value: '第1/9页', exact: true },
  check: 'contains',
  expected: '第1/',
  oracle_quote: '默认第1页显示X001至X002',
  obligation_ids: ['1-O1'],
};
function validate(assertions) {
  const p = createAdaptivePlan(c, '/');
  const b = fragmentAuditPlan(
    c,
    p.steps[0],
    [],
    { actions: [], assertions, complete: true, within_ms: 1000, reason: '观察当前页及记录' },
    'http://127.0.0.1:4888/',
  );
  requirePlanSemantics(b.plan, b.c, { adaptive_readonly: true });
}
test('record identities alone do not prove original current page', () =>
  assert.throws(() => validate([matrix]), { code: 'PLAN_CURRENT_PAGE_UNPROVEN' }));
test('current-page prefix does not invent a total from the observation', () =>
  assert.doesNotThrow(() => validate([matrix, pager])));
test('original current page does not authorize an observed total', () =>
  assert.throws(() => validate([matrix, { ...pager, expected: '第1/9页' }]), {
    code: 'PLAN_CURRENT_PAGE_SOURCE_INVALID',
  }));

const source = (expected) => suggestObligations([{ step_id: '1', action: '观察。', expected }])[0];
for (const text of [
  '当前第1页。',
  '回到第1页。',
  '恢复到第1页。',
  '默认第1页显示X001至X002。',
  '分页显示第1页。',
])
  test('positive current page ' + text, () =>
    assert.equal(currentPageRequirements(source(text))[0]?.current, 1),
  );
for (const text of [
  '不是第1页。',
  '如果当前第1页则显示。',
  '例如默认第1页。',
  '显示第1页按钮。',
  '操作前显示第1页。',
  '曾经显示第1页。',
  '显示第1页至第3页。',
  '未要求当前第1页。',
  '默认第1/9页。',
  '回到第1页；分页第1/9页。',
])
  test('do not manufacture current-only source ' + text, () =>
    assert.deepEqual(currentPageRequirements(source(text)), []),
  );
for (const expected of ['第1', '第11/', '共2条 · 第1/', '第1/9页'])
  test('weak boundary/wrong page/extra total does not prove original page: ' + expected, () => {
    assert.equal(
      currentPageEvidenceGaps(c.steps[0], { assertions: [matrix, { ...pager, expected }] }).length,
      1,
    );
  });
for (const target of [
  { kind: 'label', value: '跳页', exact: true },
  { kind: 'role', role: 'button', name: '第1页', exact: true },
  table,
  matrix.target,
  { kind: 'cell', table, key: { column: '编号', value: 'X001' }, column: '页码' },
])
  test(
    'table or control is not a current-page counter ' + target.kind + (target.role ?? ''),
    () => {
      assert.throws(() => requireCurrentPageAssertion({ ...pager, target }, c.steps[0]), {
        code: 'ADAPTIVE_TARGET_PAGE_MISMATCH',
      });
    },
  );
test('same step obligation only; source/candidate immutable, shared guidance', () => {
  const x = structuredClone(pager),
    before = structuredClone({ c, x });
  requireCurrentPageAssertion(x, c.steps[0]);
  assert.deepEqual({ c, x }, before);
  assert.equal(
    currentPageEvidenceGaps(c.steps[0], { assertions: [{ ...x, obligation_ids: ['2-O1'] }] })
      .length,
    1,
  );
  assert.ok(ADAPTIVE_NEXT_PROMPT.includes(CURRENT_PAGE_GUIDANCE));
  assert.ok(ADAPTIVE_REVIEW_REFERENCES.includes(CURRENT_PAGE_GUIDANCE));
});
test('runtime CSS aliases still cannot use a table or interactive control as counter', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(
    '<table id="grid"><tbody><tr><td>第1/9页</td></tr></tbody></table><button id="jump">第1/9页</button><input id="input" value="第1/9页"><span id="counter">第1/9页</span>',
  );
  for (const id of ['grid', 'jump', 'input'])
    await assert.rejects(
      requireAdaptiveAssertionTargets(
        page,
        { assertions: [{ ...pager, target: { kind: 'css', value: '#' + id } }] },
        c.steps[0],
      ),
      { code: 'ADAPTIVE_TARGET_PAGE_MISMATCH' },
    );
  await requireAdaptiveAssertionTargets(
    page,
    { assertions: [{ ...pager, target: { kind: 'css', value: '#counter' } }] },
    c.steps[0],
  );
});

for (const other of [
  '不显示第1/9页',
  '如果显示第1/9页',
  '按钮显示第1/9页',
  '之前显示第1/9页',
  '分页第1/0页',
])
  test(
    'negative/conditional/control/past/invalid full counter does not suppress current-page obligation: ' +
      other,
    () => {
      assert.equal(currentPageRequirements(source('默认第1页；' + other + '。'))[0]?.current, 1);
    },
  );
