import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  resolveOptionalDialog,
  dispatchOptionalDialog,
  recheckOptionalDialog,
} from '../src/optional-dialog.mjs';
import { checkAssertion, BrowserSession } from '../src/browser.mjs';
import { StepBudget } from '../src/step-budget.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const target = { kind: 'css', value: '#detail' };
const action = {
  action_id: 'notice',
  op: 'dismiss_optional',
  target: { kind: 'role', role: 'dialog', name: '使用提示', exact: true },
  value: '知道了',
};
const html = `<style>button{padding:20px;margin:30px}dialog::backdrop{background:#1238}</style><button id="detail">查看详情</button><dialog aria-label="使用提示"><p>使用说明</p><form method="dialog"><button>知道了</button></form></dialog>`;
const reset = async (show = false) => {
  await page.setContent(html);
  if (show) await page.locator('dialog').evaluate((e) => e.showModal());
};
const check = () =>
  checkAssertion(page, { target, check: 'unobstructed', expected: true }, { timeout: 180 });
const close = async () => {
  const b = await resolveOptionalDialog(page, action, { timeout: 0 });
  try {
    await dispatchOptionalDialog(page, b, 600);
  } finally {
    await b.target?.dispose();
    await b.dialog?.dispose();
  }
};
let scenarios = 0;
try {
  await reset();
  const absent = await resolveOptionalDialog(page, action, { timeout: 0 });
  assert.equal(absent.absent, true);
  assert.equal((await check()).passed, true);
  scenarios++;
  await reset(true);
  assert.equal(
    (await checkAssertion(page, { target, check: 'visible' }, { timeout: 180 })).passed,
    true,
  );
  const blocked = await check();
  assert.equal(blocked.passed, false);
  assert.equal(blocked.obstruction.modal_blocked, true);
  await close();
  assert.equal((await check()).passed, true);
  scenarios++;
  await reset();
  await page.evaluate(() => setTimeout(() => document.querySelector('dialog').showModal(), 100));
  const delayed = await resolveOptionalDialog(page, action, { timeout: 500 });
  assert.ok(delayed.target);
  await dispatchOptionalDialog(page, delayed, 600);
  await delayed.target.dispose();
  await delayed.dialog.dispose();
  scenarios++;
  for (const mutate of [
    (e) => e.setAttribute('aria-label', '其他提示'),
    (e) => (e.querySelector('form').method = 'post'),
    (e) => (e.querySelector('p').textContent = '同意授权'),
    (e) => e.querySelector('form').insertAdjacentHTML('afterbegin', '<input>'),
    (e) => e.querySelector('form').insertAdjacentHTML('beforeend', '<button>知道了</button>'),
  ]) {
    await reset(true);
    await page.locator('dialog').evaluate(mutate);
    await assert.rejects(resolveOptionalDialog(page, action, { timeout: 0 }));
    scenarios++;
  }
  await reset(true);
  const binding = await resolveOptionalDialog(page, action, { timeout: 0 });
  await page.locator('form button').evaluate((e) => {
    e.outerHTML = e.outerHTML;
  });
  await assert.rejects(recheckOptionalDialog(page, binding), { code: 'OPTIONAL_DIALOG_CHANGED' });
  await binding.target.dispose();
  await binding.dialog.dispose();
  scenarios++;
  await reset(true);
  await page.locator('form button').evaluate((e) =>
    e.addEventListener('pointerdown', () => {
      e.textContent = '确定';
    }),
  );
  await assert.rejects(close(), { code: 'OPTIONAL_DIALOG_CHANGED' });
  assert.equal(await page.locator('dialog').evaluate((e) => e.open), true);
  scenarios++;
  await reset();
  await page.evaluate(() =>
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="mask" style="position:fixed;inset:0;z-index:999;background:transparent"></div>',
    ),
  );
  assert.equal((await check()).passed, false);
  scenarios++;
  for (const css of ['margin-top:2000px', 'opacity:0', 'visibility:hidden']) {
    await reset();
    await page.locator('#detail').evaluate((e, s) => (e.style.cssText = s), css);
    assert.equal((await check()).passed, false);
    scenarios++;
  }
  await reset();
  await page.locator('#detail').evaluate((e) => e.setAttribute('inert', ''));
  assert.equal((await check()).passed, false);
  scenarios++;
  // Real executor receipts: absent does not dispatch or count as an executed action.
  const session = new BrowserSession({ headless: true });
  const run = () => ({
    page,
    step: { step_id: 's' },
    point: {},
    result: { actions: [] },
    budget: new StepBudget(3000),
    recording: { beforeAction: async () => {} },
    guard: {},
    emit: async () => {},
    setPhase: () => {},
  });
  await reset();
  let r = run();
  await session.executeOptionalDialog(r, action);
  assert.equal(r.result.actions[0].status, 'SKIPPED_NOT_PRESENT');
  assert.equal(r.result.actions[0].dispatched, false);
  scenarios++;
  await reset(true);
  r = run();
  await session.executeOptionalDialog(r, action);
  assert.equal(r.result.actions[0].status, 'EXECUTED');
  assert.equal(r.result.actions[0].condition.branch, 'PRESENT');
  scenarios++;
  await reset(true);
  r = run();
  r.emit = async (type) => {
    if (type === 'ACTION_STARTED')
      await page.locator('form button').evaluate((e) => (e.textContent = '确定'));
  };
  await assert.rejects(session.executeOptionalDialog(r, action), {
    code: 'OPTIONAL_DIALOG_CHANGED',
  });
  assert.equal(r.result.actions[0].dispatched, false);
  scenarios++;
  await reset(true);
  r = run();
  r.emit = async (type) => {
    if (type === 'ACTION_STARTED') throw new Error('evidence unavailable');
  };
  await assert.rejects(session.executeOptionalDialog(r, action));
  assert.equal(r.result.actions[0].dispatched, false);
  assert.equal(await page.locator('dialog').evaluate((e) => e.open), true);
  scenarios++;
  await reset();
  r = run();
  r.budget = new StepBudget(30);
  await assert.rejects(session.executeOptionalDialog(r, action), {
    code: 'STEP_DEADLINE_EXCEEDED',
  });
  assert.equal(r.result.actions[0].dispatched, false);
  scenarios++;
  await reset();
  await resolveOptionalDialog(page, action, { timeout: 0 });
  await page.locator('dialog').evaluate((e) => e.showModal());
  assert.equal(
    (await check()).passed,
    false,
    'late popup must not inherit an earlier absence result',
  );
  scenarios++;
  await reset(true);
  await page.evaluate(() => {
    const d = document.querySelector('dialog').cloneNode(true);
    d.removeAttribute('open');
    document.body.append(d);
    d.showModal();
  });
  await assert.rejects(resolveOptionalDialog(page, action, { timeout: 0 }));
  scenarios++;
  await reset();
  await page.evaluate(() => {
    document.querySelector('dialog').remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog" aria-label="使用提示"><button>知道了</button></div>',
    );
  });
  await assert.rejects(resolveOptionalDialog(page, action, { timeout: 0 }), {
    code: 'OPTIONAL_DIALOG_UNSAFE',
  });
  scenarios++;
  await reset();
  const ac = new AbortController();
  ac.abort();
  r = run();
  r.signal = ac.signal;
  await assert.rejects(session.executeOptionalDialog(r, action), { code: 'STOPPED' });
  assert.equal(r.result.actions[0].dispatched, false);
  scenarios++;
  console.log(
    JSON.stringify({
      scope: 'Chromium fixed-protocol checks; no model calls',
      scenarios,
      failed: 0,
    }),
  );
} finally {
  await browser.close();
}
