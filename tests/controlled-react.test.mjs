import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { BrowserSession, checkAssertionGroup } from '../src/browser.mjs';
import { StepBudget } from '../src/step-budget.mjs';
import { generateStagedPlan, STAGED_STEP_ASSERTIONS_PROMPT } from '../src/plan-staged.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { renderReport } from '../src/report-view.mjs';
import { planHash, validatePlan, caseHash } from '../src/plans.mjs';
import {
  prepareControlledReactPlan,
  validateExecutionPolicy,
  canObserveAgain,
  validateObserveDecision,
} from '../src/controlled-react.mjs';

const role = { kind: 'role', role: 'button', name: '详情', exact: true };
test('matrix compares raw values but redacts nested evidence and field differences', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const sensitive = 'sk' + '-synthetic-not-a-real-secret';
  await page.setContent(
    `<table><thead><tr><th>ID</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>${sensitive}</td></tr></tbody></table>`,
  );
  const [o] = await checkAssertionGroup(
    page,
    [
      {
        target: { kind: 'role', role: 'table', name: '', exact: true },
        check: 'table_cells',
        expected: {
          key_column: 'ID',
          rows: [{ key: 'A', cells: [{ column: 'Value', check: 'text', expected: 'safe' }] }],
          ordered: false,
          exact_rows: false,
        },
      },
    ],
    { timeout: 200 },
  );
  assert.equal(o.passed, false);
  assert.ok(!JSON.stringify(o).includes(sensitive));
  assert.equal(o.actual.rows[0][1], '[REDACTED]');
  assert.equal(o.table_comparison.differences[0].actual, '[REDACTED]');
});
test('staged matrix uses explicit case data, not the observed values', async () => {
  const c = {
    case_id: 'T1',
    data: ['D003', '正常'],
    steps: [
      {
        step_id: 'S1',
        action: '核对记录',
        expected: '符合已确认数据',
        obligations: [{ id: 'O1', text: '符合已确认数据' }],
      },
    ],
  };
  const expected = {
    key_column: '编号',
    rows: [{ key: 'D003', cells: [{ column: '状态', check: 'text', expected: '正常' }] }],
    ordered: false,
    exact_rows: false,
  };
  const assertion = {
    target: { kind: 'role', role: 'table', name: '', exact: true },
    check: 'table_cells',
    expected,
    oracle_quote: c.steps[0].expected,
    obligation_ids: ['O1'],
  };
  const controller = {
    ask: async (job, prompt, input) => {
      if (input.purpose === 'plan_staged_scaffold')
        return {
          scaffold: { entry_path: '/', data_effect: 'read_only', preconditions: [], cleanup: null },
        };
      if (input.purpose === 'plan_staged_step_actions') return { actions: [] };
      assert.equal(prompt, STAGED_STEP_ASSERTIONS_PROMPT);
      assert.match(prompt, /table_cells/);
      return { mapped: { assertions: [assertion], within_ms: 500 } };
    },
  };
  const result = await generateStagedPlan(controller, {}, {}, c, {
    target: 'http://fixture.test/',
  });
  validatePlan(result.plan, c, 'http://fixture.test/');
  expected.rows[0].cells[0].expected = '页面碰巧显示的其他状态';
  await assert.rejects(
    generateStagedPlan(controller, {}, {}, c, { target: 'http://fixture.test/' }),
    { code: 'TABLE_SOURCE_UNGROUNDED' },
  );
});
test('middle identity in an explicit range is source-supported, not page-invented', () => {
  const { c, plan } = fixture();
  c.steps[0].expected = '显示 D001 至 D005';
  c.steps[0].obligations[0].text = c.steps[0].expected;
  plan.steps[0].actions = [];
  plan.steps[0].assertions = [
    {
      target: {
        kind: 'row',
        table: { kind: 'role', role: 'table', name: '', exact: true },
        key: { column: '编号', value: 'D003' },
      },
      check: 'visible',
    },
  ];
  requirePlanSemantics(plan, c);
  plan.steps[0].assertions[0].target.key.value = 'D006';
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_ROW_IDENTITY_UNSUPPORTED' });
});
test('report displays exact matrix field difference without accepting HTML as markup', () => {
  const { c } = fixture();
  const fact = {
    assertions: [
      {
        step_id: 'S1',
        check: 'table_cells',
        passed: false,
        group_passed: false,
        table_comparison: {
          checked_cells: 25,
          differences: [
            {
              key: 'D003',
              column: '功率',
              expected: 100,
              actual: '<img onerror=x>',
              reason: 'value_mismatch',
            },
          ],
        },
      },
    ],
  };
  const html = renderReport({
    state: { name: '合成差异', events: [], fixture: true },
    baseline: { cases: [c] },
    projection: { scope_valid: true },
    labels: {},
    scopeText: '合成',
    manifest: {
      counts: {
        total: 1,
        attempted: 1,
        pass: 0,
        fail: 1,
        technical_failed: 0,
        evidence_incomplete: 0,
        cleanup_required: 0,
      },
    },
    rows: [
      {
        c: { case_id: 'R1', status: 'FAIL_ASSERTION', issues: [], latest: fact },
        record: {},
        original: c,
        effective: c,
        attempts: [],
      },
    ],
  });
  assert.match(html, /本次采样已比对 25 个字段；1 项差异/);
  assert.match(html, /D003 \/ 功率/);
  assert.ok(html.includes('&lt;img') && !html.includes('<img onerror'));
});
function fixture() {
  const c = {
    case_id: 'R1',
    steps: [
      {
        step_id: 'S1',
        action: '点击详情',
        expected: '详情显示',
        obligations: [{ id: 'O1', text: '详情显示' }],
      },
    ],
  };
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: '/',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: [
      {
        step_id: 'S1',
        source_action: c.steps[0].action,
        source_expected: c.steps[0].expected,
        assertion_mode: 'simultaneous',
        within_ms: 500,
        actions: [{ action_id: 'A1', op: 'click', target: role }],
        assertions: [
          {
            target: { kind: 'text', value: '详情显示', exact: true },
            check: 'visible',
            oracle_quote: '详情显示',
            obligation_ids: ['O1'],
          },
        ],
      },
    ],
  };
  return { c, plan };
}
test('new readonly candidate capability changes approval hash, not original or legacy plans', () => {
  const { c, plan } = fixture();
  const before = structuredClone(plan),
    candidate = prepareControlledReactPlan(plan);
  validatePlan(candidate, c, 'http://fixture.test/');
  assert.notEqual(planHash(plan), planHash(candidate));
  assert.deepEqual(plan, before);
  validateExecutionPolicy(plan);
  assert.equal(plan.execution_policy, undefined);
  assert.equal(prepareControlledReactPlan(candidate), candidate);
  const write = { ...plan, data_effect: 'mutation' };
  assert.equal(prepareControlledReactPlan(write), write);
  for (const changed of [
    { data_effect: 'mutation' },
    { schema_version: 'ui-agent-intent/v1' },
    { execution_policy: { mode: 'guarded-react', max_observations: 20 } },
  ])
    assert.throws(() => validateExecutionPolicy({ ...candidate, ...changed }), {
      code: 'REACT_POLICY_INVALID',
    });
});
test('reobserve can only resolve the same pre-dispatch read-only action within shared bound', () => {
  const p = prepareControlledReactPlan(fixture().plan);
  const f = { phase: 'RESOLVE', dispatched: false, code: 'LOCATOR_NOT_UNIQUE' };
  assert.equal(canObserveAgain(p, f, 0), true);
  for (const wrong of [
    { dispatched: true },
    { phase: 'DISPATCH' },
    { code: 'BUSINESS_ASSERTION_FAILED' },
    { code: 'AUTH_REQUIRED' },
  ])
    assert.equal(canObserveAgain(p, { ...f, ...wrong }, 0), false);
  assert.equal(canObserveAgain(p, f, 2), false);
  assert.equal(canObserveAgain(p, f, 0, true), false);
  assert.throws(() => validateObserveDecision({ observe: true }, f));
  assert.throws(() =>
    validateObserveDecision({ observe: true, target: role }, { allowed_tools: ['observe'] }),
  );
});
async function setup(t, { enabled = true, dirty = false } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('http://fixture.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<h1>设备目录</h1><button onclick="window.clicks++">详情</button><button>详情</button><script>window.clicks=0</script>',
    }),
  );
  await page.goto('http://fixture.test/');
  const plan = enabled ? prepareControlledReactPlan(fixture().plan) : fixture().plan;
  const result = { actions: [], repairs: [], executed_plan: structuredClone(plan) };
  const events = [],
    abort = new AbortController();
  const run = {
    task: { target: 'http://fixture.test/' },
    page,
    plan,
    step: plan.steps[0],
    point: plan.steps[0],
    result,
    budget: new StepBudget(10000),
    guard: { dirty },
    signal: abort.signal,
    recording: { beforeAction: async () => {} },
    emit: async (type, detail) => events.push({ type, ...detail }),
    setPhase: () => {},
  };
  return { page, run, result, events, abort, session: new BrowserSession({ headless: true }) };
}
test('real DOM ambiguity recovers by reobservation without anchor or substitute click', async (t) => {
  const x = await setup(t);
  let calls = 0;
  x.run.onRepair = async (failure) => {
    calls++;
    assert.deepEqual(failure.allowed_tools, ['observe', 'stop']);
    assert.equal(failure.dispatched, false);
    await x.page
      .locator('button')
      .last()
      .evaluate((e) => e.remove());
    return { observe: true };
  };
  await x.session.executeActions(x.run);
  assert.equal(calls, 1);
  assert.equal(await x.page.evaluate(() => clicks), 1);
  assert.equal(x.result.actions.length, 1);
  assert.equal(x.result.actions[0].status, 'EXECUTED');
  assert.equal(x.result.react_observations.length, 1);
  assert.equal(x.result.repairs.length, 0);
  assert.deepEqual(x.result.executed_plan, x.run.plan);
  assert.ok(x.events.some((e) => e.type === 'REACT_OBSERVED'));
});
test('identical failed observation stops without a second model call or click', async (t) => {
  const x = await setup(t);
  let calls = 0;
  x.run.onRepair = async () => {
    calls++;
    return { observe: true };
  };
  await assert.rejects(x.session.executeActions(x.run), { code: 'REACT_NO_PROGRESS' });
  assert.equal(calls, 1);
  assert.equal(await x.page.evaluate(() => clicks), 0);
  assert.ok(x.events.some((e) => e.type === 'REACT_STOPPED'));
});
for (const options of [{ enabled: false }, { dirty: true }])
  test(`legacy/dirty policy does not gain observation authority ${JSON.stringify(options)}`, async (t) => {
    const x = await setup(t, options);
    let calls = 0;
    x.run.onRepair = async () => {
      calls++;
      return { observe: true };
    };
    await assert.rejects(x.session.executeActions(x.run), { code: 'LOCATOR_NOT_UNIQUE' });
    assert.equal(calls, 0);
  });
test('abort and original deadline after model response both prevent dispatch', async (t) => {
  for (const stop of [true, false]) {
    const x = await setup(t);
    let clock = 0;
    x.run.budget = new StepBudget(10000, () => clock);
    x.run.onRepair = async () => {
      await x.page
        .locator('button')
        .last()
        .evaluate((e) => e.remove());
      if (stop) x.abort.abort();
      else clock = 10001;
      return { observe: true };
    };
    await assert.rejects(x.session.executeActions(x.run), {
      code: stop ? 'STOPPED' : 'STEP_DEADLINE_EXCEEDED',
    });
    assert.equal(await x.page.evaluate(() => clicks), 0);
  }
});
test('post-dispatch failure cannot enter observe loop or replay click', async (t) => {
  const x = await setup(t);
  let calls = 0;
  await x.page
    .locator('button')
    .last()
    .evaluate((e) => e.remove());
  x.run.onRepair = async () => {
    calls++;
    return { observe: true };
  };
  x.run.emit = async (type) => {
    if (type === 'ACTION_EXECUTED') throw new Error('evidence failed');
  };
  await assert.rejects(x.session.executeActions(x.run), /evidence failed/);
  assert.equal(calls, 0);
  assert.equal(await x.page.evaluate(() => clicks), 1);
});
test('network authorization rejection while observing cannot proceed to a click', async (t) => {
  const x = await setup(t);
  x.run.onRepair = async () => {
    await x.page
      .locator('button')
      .last()
      .evaluate((e) => e.remove());
    x.run.guard.blocked = 'WRITE_NOT_AUTHORIZED';
    return { observe: true };
  };
  await assert.rejects(x.session.executeActions(x.run), { code: 'WRITE_NOT_AUTHORIZED' });
  assert.equal(await x.page.evaluate(() => clicks), 0);
});
test('approval UI discloses bounded recovery and escapes matrix expectations', async (t) => {
  const source = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    document: { querySelector: () => ({ content: 'csrf' }) },
    console,
  });
  vm.runInContext(
    source.slice(0, source.lastIndexOf('await action(() => refresh(true));')) +
      '\nglobalThis.renderPlan=planHTML;',
    context,
  );
  const { plan } = fixture();
  assert.match(context.renderPlan(null), /尚未生成计划/);
  assert.ok(!context.renderPlan(plan).includes('data-react-policy'));
  const fresh = prepareControlledReactPlan(plan);
  fresh.steps[0].assertions = [
    {
      target: role,
      check: 'table_cells',
      expected: {
        key_column: '编号',
        ordered: true,
        exact_rows: false,
        rows: [
          {
            key: '<img onerror=x>',
            cells: [{ column: '名称', check: 'text', expected: '<script>bad()</script>' }],
          },
        ],
      },
    },
  ];
  const html = context.renderPlan(fresh);
  assert.match(html, /data-react-policy/);
  assert.match(html, /1 条记录 \/ 1 个字段/);
  assert.ok(!html.includes('<img') && !html.includes('<script>'));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const css = await fs.readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  await page.setContent(
    `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><dialog id="modal"><div id="modal-body"><h2>核对执行计划</h2><div class="plan-card">${html}</div><button>以上操作、断言和清理已核对</button></div></dialog>`,
  );
  await page.locator('dialog').evaluate((e) => e.showModal());
  const out = path.resolve('validation/req0017');
  await fs.mkdir(out, { recursive: true });
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('[data-react-policy]').isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByText('展开全部预期字段', { exact: true }).focus();
    if (
      !(await page
        .locator('details')
        .first()
        .evaluate((e) => e.open))
    )
      await page.keyboard.press('Enter');
    assert.equal(await page.getByText('<img onerror=x>', { exact: true }).isVisible(), true);
    await page.screenshot({ path: path.join(out, `approval-${width}.png`), fullPage: true });
  }
});
