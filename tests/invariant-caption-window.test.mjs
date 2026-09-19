import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { BrowserSession } from '../src/browser.mjs';
import { captureTableBaselines } from '../src/table-invariant.mjs';
import { StepBudget } from '../src/step-budget.mjs';
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => browser.close());
const table = { kind: 'testid', value: 'table' };
const source = '表格保持不变';
const invariant = {
  target: table,
  check: 'table_unchanged',
  oracle_quote: source,
  obligation_ids: ['1-O1'],
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function fixture(t, scenario) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route('**/*', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<h1>演练</h1><label>关键词<input data-testid="kw"></label><table data-testid="table"><thead><tr><th>编号</th><th>值</th></tr></thead><tbody><tr><td>X1</td><td id="v">10</td></tr></tbody></table>',
    }),
  );
  const page = await context.newPage();
  await page.goto('http://caption-window.test/');
  const original = {
    step_id: '1',
    action: '输入A再输入B',
    expected: source,
    obligations: [{ id: '1-O1', text: source }],
  };
  const token = await captureTableBaselines(
    page,
    { controls: [{ role: 'table', locator: table }] },
    { run_id: 'run', step_id: '1' },
  );
  if (scenario === 'difference' || scenario === 'presentation-fails')
    await page.evaluate(() => {
      let count = 0;
      document.querySelector('input').oninput = () =>
        (document.querySelector('#v').textContent = ++count === 1 ? '99' : '10');
    });
  const actions = ['A', 'B'].map((value, i) => ({
    action_id: 'A' + i,
    op: 'fill',
    target: { kind: 'testid', value: 'kw' },
    value,
  }));
  const point = {
    checkpoint_id: 'C1',
    actions,
    assertions: scenario === 'action-only' ? [] : [invariant],
    within_ms: 500,
  };
  const step = {
    step_id: '1',
    source_action: original.action,
    source_expected: source,
    timeout_ms: 10000,
    checkpoints: [point],
  };
  const result = {
    id: 'run',
    actions: [],
    assertions: [],
    media: [],
    checkpoints: [{ step_id: '1', checkpoint_id: 'C1' }],
  };
  const calls = [],
    events = [];
  const run = {
    page,
    tableBaselines: token,
    step,
    stepIndex: 0,
    budget: new StepBudget(10000),
    task: { target: page.url() },
    plan: { data_effect: 'read_only' },
    c: { steps: [original] },
    result,
    runDirectory: await fs.mkdtemp(path.join(os.tmpdir(), 'caption-checkpoint-')),
    guard: { dirty: false, blocked: null },
    setPhase: () => {},
    recording: {
      beginStep: async () => {},
      beginCheckpoint: async () => {},
      beforeAction: async () => {},
      observed: async (obs) => {
        calls.push({
          observations: obs,
          declaredAtCall: result.assertions.length,
          actionsAtCall: result.actions.length,
        });
        if (scenario === 'presentation-fails') throw Error('synthetic caption failure');
        await delay(700); // deliberately exceeds the unchanged 500ms observation window
      },
      screenshot: (options) => page.screenshot(options),
    },
    emit: async (type, data) => {
      events.push({ type, data });
      if (scenario === 'late-measurement' && type === 'ACTION_EXECUTED' && data.action_id === 'A1')
        await delay(700);
    },
  };
  return { run, result, calls, events, page };
}
for (const scenario of [
  'normal',
  'difference',
  'late-measurement',
  'presentation-fails',
  'action-only',
])
  test('checkpoint-owned invariant presentation: ' + scenario, async (t) => {
    const { run, result, calls, events, page } = await fixture(t, scenario);
    const action = new BrowserSession().executeStep(run);
    if (scenario === 'difference' || scenario === 'presentation-fails') {
      await assert.rejects(action, { code: 'BUSINESS_ASSERTION_FAILED' });
      assert.equal(result.actions.length, 1);
      assert.equal(await page.locator('input').inputValue(), 'A');
      assert.equal(result.relational_observations[0].passed, false);
      assert.equal(result.assertions.length, 0);
      assert.equal(calls.length, 1);
      if (scenario === 'presentation-fails') assert.equal(result.evidence_status, 'PARTIAL');
    } else if (scenario === 'late-measurement') {
      await assert.rejects(action, { code: 'ASSERTION_OBSERVATION_LATE' });
      assert.equal(result.assertions[0].window_observed, false);
      assert.equal(result.assertions[0].timed_out, true);
      assert.equal(result.actions.length, 2);
    } else {
      await action;
      assert.equal(result.actions.length, 2);
      assert.equal(result.relational_observations.length, 2);
      assert.ok(result.relational_observations.every((a) => a.passed));
      assert.equal(calls.length, 3); // two guards, then original declared group (possibly empty)
      assert.ok(calls.every((c) => c.actionsAtCall === 2));
      if (scenario === 'normal') {
        assert.equal(result.assertions[0].passed, true);
        assert.equal(result.assertions[0].window_observed, true);
        assert.ok(calls.every((c) => c.declaredAtCall === 1));
        const a = result.actions.at(-1),
          o = result.assertions[0];
        assert.equal(Date.parse(o.deadline_at) - Date.parse(a.completed_at), 500);
        assert.ok(Date.parse(o.at) <= Date.parse(o.deadline_at));
      }
    }
    assert.equal(
      events.filter((e) => e.type === 'TABLE_INVARIANT_OBSERVED').length,
      result.actions.length,
    );
    assert.equal(events.filter((e) => e.type === 'ACTION_STARTED').length, result.actions.length);
  });
