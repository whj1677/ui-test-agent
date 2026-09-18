import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { BrowserSession } from '../src/browser.mjs';
import { createAdaptivePlan } from '../src/adaptive-plan.mjs';
import { assertAdaptiveActionTarget } from '../src/adaptive-execution.mjs';
import { StepBudget } from '../src/step-budget.mjs';

for (const scenario of ['write', 'replacement', 'late-name', 'password', 'valid']) {
  test(`final adaptive dispatch validates actual node: ${scenario}`, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.route('http://fixture.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body:
          (scenario === 'password'
            ? '<input id="go" type="button" value="详情" onclick="window.clicks++">'
            : '<button id="go" onclick="window.clicks++">详情</button>') +
          '<script>window.clicks=0</script>',
      }),
    );
    await page.goto('http://fixture.test/');
    const c = {
      case_id: 'C1',
      steps: [
        {
          step_id: 'S1',
          action: '打开详情',
          expected: '详情可见',
          obligations: [{ id: 'O1', text: '详情可见' }],
        },
      ],
    };
    const plan = createAdaptivePlan(c, '/');
    const action = { action_id: 'A1', op: 'click', target: { kind: 'css', value: '#go' } };
    // Earlier observation/audit checks the button. Simulate a change during the audit.
    await assertAdaptiveActionTarget(page.locator('#go'), action, c.steps[0].action);
    if (scenario === 'write') await page.locator('#go').evaluate((e) => (e.textContent = '删除'));
    if (scenario === 'replacement')
      await page
        .locator('#go')
        .evaluate((e) => (e.outerHTML = '<main id="go" onclick="window.clicks++">详情</main>'));
    const result = { actions: [], repairs: [], executed_plan: structuredClone(plan) };
    const run = {
      task: { target: 'http://fixture.test/' },
      page,
      plan,
      step: plan.steps[0],
      point: { checkpoint_id: 'p1', actions: [action], assertions: [] },
      result,
      budget: new StepBudget(10000),
      guard: { dirty: false },
      signal: new AbortController().signal,
      recording: { beforeAction: async () => {} },
      setPhase: () => {},
      emit: async (type) => {
        if (type === 'ACTION_STARTED' && scenario === 'late-name')
          await page.locator('#go').evaluate((e) => e.setAttribute('aria-label', '删除'));
        if (type === 'ACTION_STARTED' && scenario === 'password')
          await page.locator('#go').evaluate((e) => e.setAttribute('type', 'password'));
      },
    };
    const session = new BrowserSession({ headless: true });
    if (scenario === 'valid') {
      await session.executeActions(run);
      assert.equal(result.actions[0].status, 'EXECUTED');
      assert.equal(await page.evaluate(() => window.clicks), 1);
    } else {
      const code =
        scenario === 'replacement'
          ? 'ADAPTIVE_TARGET_NOT_INTERACTIVE'
          : scenario === 'password'
            ? 'SENSITIVE_CONTROL_FORBIDDEN'
            : 'ADAPTIVE_ACTION_WRITE_FORBIDDEN';
      await assert.rejects(session.executeActions(run), { code });
      assert.equal(await page.evaluate(() => window.clicks), 0);
      assert.ok(result.actions.length > 0);
      assert.ok(result.actions.every((receipt) => receipt.dispatched === false));
    }
  });
}
