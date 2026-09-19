import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { validateAssertion } from '../src/plans.mjs';
import { checkAssertionGroup, snapshot } from '../src/browser.mjs';
import { requireAdaptiveAssertionTargets } from '../src/adaptive-execution.mjs';
const target = { kind: 'role', role: 'tab', name: '基本信息', exact: true };
const original = {
  step_id: '1',
  action: '核对默认页签',
  expected: '默认页签为基本信息。',
  obligations: [{ id: '1-O1', text: '默认页签为基本信息' }],
};
const assertion = {
  target,
  check: 'aria_selected',
  expected: true,
  oracle_quote: '默认页签为基本信息',
  obligation_ids: ['1-O1'],
};
test('explicit ARIA selection is boolean, not selected text or checkbox state', () => {
  validateAssertion(assertion, original);
  validateAssertion({ ...assertion, expected: false }, original);
  for (const expected of [undefined, null, 'true', '基本信息', 1])
    assert.throws(() => validateAssertion({ ...assertion, expected }, original), {
      code: 'ASSERTION_BOOL_INVALID',
    });
});
test('current tab selected_label misuse is rejected before dispatch with specific feedback', async (t) => {
  const b = await chromium.launch({ headless: true });
  t.after(() => b.close());
  const p = await b.newPage();
  await p.setContent('<button role="tab" aria-selected="true">基本信息</button>');
  await assert.rejects(
    requireAdaptiveAssertionTargets(
      p,
      { assertions: [{ ...assertion, check: 'selected_label', expected: '基本信息' }] },
      original,
    ),
    { code: 'ASSERTION_SELECTION_TARGET_REQUIRED' },
  );
  await requireAdaptiveAssertionTargets(p, { assertions: [assertion] }, original);
});
for (const state of ['true', 'false'])
  test(`actual ARIA tab selection ${state} is measured and observed`, async (t) => {
    const b = await chromium.launch({ headless: true });
    t.after(() => b.close());
    const p = await b.newPage();
    await p.goto('data:text/html,<title>states</title>');
    await p.setContent(
      `<h1>状态</h1><button role='tab' aria-selected='${state}'>基本信息</button><select aria-label='园区'><option>全部</option></select>`,
    );
    const observed = await snapshot(p);
    assert.equal(observed.controls.find((c) => c.role === 'tab').aria_selected, state === 'true');
    const result = (await checkAssertionGroup(p, [assertion], { timeout: 1000 }))[0];
    assert.equal(result.actual, state === 'true');
    assert.equal(result.passed, state === 'true');
    const native = (
      await checkAssertionGroup(
        p,
        [
          {
            target: { kind: 'label', value: '园区', exact: true },
            check: 'selected_label',
            expected: '全部',
          },
        ],
        { timeout: 1000 },
      )
    )[0];
    assert.equal(native.passed, true);
    await assert.rejects(
      checkAssertionGroup(p, [{ ...assertion, check: 'selected_label', expected: '基本信息' }], {
        timeout: 1000,
      }),
      { code: 'ASSERTION_TARGET_TYPE' },
    );
  });
for (const [html, error] of [
  ['<button role="tab">基本信息</button>', 'ASSERTION_SELECTION_STATE_UNSUPPORTED'],
  [
    '<button role="tab" aria-selected="mixed">基本信息</button>',
    'ASSERTION_SELECTION_STATE_UNSUPPORTED',
  ],
  ['<button aria-selected="true">基本信息</button>', 'ASSERTION_TARGET_TYPE'],
])
  test(`unsupported selection target is technical, never false by default: ${html}`, async (t) => {
    const b = await chromium.launch({ headless: true });
    t.after(() => b.close());
    const p = await b.newPage();
    await p.setContent(html);
    await assert.rejects(
      checkAssertionGroup(
        p,
        [{ ...assertion, target: { kind: 'css', value: 'button' }, expected: false }],
        { timeout: 1000 },
      ),
      { code: error },
    );
  });
