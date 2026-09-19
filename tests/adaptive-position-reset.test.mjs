import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { extractRowPositions } from '../src/table-position.mjs';
import {
  validateTableExpectation,
  compareTableCells,
  TABLE_ASSERTION_GUIDANCE,
} from '../src/table-assertion.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { isQueryResetStep } from '../src/adaptive-query-reset.mjs';
import {
  createAdaptivePlan,
  validateAdaptiveFragment,
  ADAPTIVE_NEXT_PROMPT,
} from '../src/adaptive-plan.mjs';
import { ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';
import { BrowserSession, checkAssertionGroup } from '../src/browser.mjs';
import { queryFormFacts } from '../src/query-forms.mjs';
import { StepBudget } from '../src/step-budget.mjs';

const original = '第一行是 R012 汇流柜 额定功率600；第二行是 R007 配电柜 额定功率300。';
const table = { kind: 'role', role: 'table', name: '设备', exact: true };
const expected = () => ({
  key_column: '编号',
  ordered: false,
  exact_rows: false,
  rows: [
    { key: 'R012', position: 1, cells: [{ column: '功率', check: 'number', expected: 600 }] },
    { key: 'R007', position: 2, cells: [{ column: '功率', check: 'number', expected: 300 }] },
  ],
});
const actual = () => ({
  headers: ['编号', '功率'],
  rows: [
    ['R012', '600 kW'],
    ['R007', '300 kW'],
    ['R003', '100 kW'],
  ],
});

test('position grammar binds original identity and ordinal, not incidental numeric values', () => {
  assert.deepEqual(extractRowPositions(original), [
    { key: 'R012', position: 1 },
    { key: 'R007', position: 2 },
  ]);
  for (const text of [
    '首行恢复为 R001。',
    '首行回到 R001。',
    '首行 R001 额定功率100。',
    '第1行是 R001。',
  ])
    assert.deepEqual(extractRowPositions(text), [{ key: 'R001', position: 1 }]);
  for (const text of [
    '不要求第一行是 R001',
    '如果第一行是 R001',
    '首行不是 R001',
    '首行可能是 R001',
    '首行 R001 或 R002',
    'R001 数量1 排序2',
    '第0行是R001',
    '第一行是其他对象',
  ])
    assert.deepEqual(extractRowPositions(text), []);
  assert.deepEqual(extractRowPositions('首行 R0010。'), [{ key: 'R0010', position: 1 }]);
  assert.doesNotThrow(() => validateTableExpectation(expected(), { expected: original }));
  assert.throws(
    () =>
      validateTableExpectation(expected(), { expected: '存在R012及R007', data: [1, 2, 300, 600] }),
    { code: 'TABLE_POSITION_UNGROUNDED' },
  );
  const wrong = expected();
  wrong.rows[0].position = 3;
  assert.throws(() => validateTableExpectation(wrong, { expected: original }), {
    code: 'TABLE_POSITION_UNGROUNDED',
  });
});

test('absolute position allows trailing rows but fails shifted prefixes and swapped rows', () => {
  assert.equal(compareTableCells(actual(), expected()).passed, true);
  const shifted = actual();
  shifted.rows.unshift(['R099', '1 kW']);
  const diff = compareTableCells(shifted, expected());
  assert.equal(diff.invalid, false);
  assert.equal(diff.passed, false);
  assert.deepEqual(
    diff.differences.map((d) => [d.key, d.reason, d.expected, d.actual]),
    [
      ['R012', 'row_position', 1, 2],
      ['R007', 'row_position', 2, 3],
    ],
  );
  const swapped = actual();
  [swapped.rows[0], swapped.rows[1]] = [swapped.rows[1], swapped.rows[0]];
  assert.equal(compareTableCells(swapped, expected()).passed, false);
  const membership = expected();
  membership.rows.forEach((r) => delete r.position);
  membership.ordered = true;
  assert.equal(
    compareTableCells(shifted, membership).passed,
    true,
    'relative order alone is insufficient',
  );
  const absent = actual();
  absent.rows.shift();
  assert.ok(
    compareTableCells(absent, expected()).differences.some(
      (d) => d.reason === 'row_position' && d.actual === null,
    ),
  );
});

test('malformed positions and duplicate identities cannot pass', () => {
  for (const value of [0, -1, 1.5, '1', null, Infinity, 1001]) {
    const e = expected();
    e.rows[0].position = value;
    assert.throws(() => validateTableExpectation(e), { code: 'TABLE_POSITION_INVALID' });
  }
  const duplicate = expected();
  duplicate.rows[1].position = 1;
  assert.throws(() => validateTableExpectation(duplicate), { code: 'TABLE_POSITION_DUPLICATE' });
  const a = actual();
  a.rows.push(a.rows[0]);
  assert.equal(compareTableCells(a, expected()).error, 'TABLE_KEY_DUPLICATE');
});

test('complete adaptive proof cannot substitute membership or relative order for position', () => {
  const c = {
    steps: [
      { action: '核对前两行', expected: original, obligations: [{ id: 'O1', text: original }] },
    ],
  };
  const a = { target: table, check: 'table_cells', expected: expected(), obligation_ids: ['O1'] };
  const validate = (proof, complete = true) =>
    requirePlanSemantics(
      { steps: [{ assertions: [proof] }] },
      c,
      { adaptive_readonly: true },
      { complete },
    );
  assert.doesNotThrow(() => validate(a));
  const membership = structuredClone(a);
  membership.expected.rows.forEach((r) => delete r.position);
  assert.throws(() => validate(membership), { code: 'PLAN_ROW_POSITION_UNPROVEN' });
  membership.expected.ordered = true;
  assert.throws(() => validate(membership), { code: 'PLAN_ROW_POSITION_UNPROVEN' });
  assert.doesNotThrow(
    () => validate(membership, false),
    'partial measurements may defer, never finish the missing proof',
  );
  assert.throws(() => validate({ ...a, obligation_ids: ['wrong'] }), {
    code: 'PLAN_ROW_POSITION_UNPROVEN',
  });
  for (const prompt of [ADAPTIVE_NEXT_PROMPT, ADAPTIVE_REVIEW_REFERENCES])
    assert.ok(prompt.includes(TABLE_ASSERTION_GUIDANCE));
});

test('browser measures absolute positions from the same table sample, not source-selected nth', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const content = (rows) =>
    `<table aria-label="设备"><thead><tr><th>编号</th><th>功率</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
  await page.setContent(content(actual().rows));
  const proof = { target: table, check: 'table_cells', expected: expected() };
  const [pass] = await checkAssertionGroup(page, [proof], { timeout: 300 });
  assert.equal(pass.passed, true);
  await page.setContent(content([['R099', '1 kW'], ...actual().rows]));
  const [fail] = await checkAssertionGroup(page, [proof], { timeout: 300 });
  assert.equal(fail.passed, false);
  assert.match(JSON.stringify(fail), /row_position/);
  assert.match(JSON.stringify(fail), /R099/);
});

const resetAction = '点击「重置」。';
const resetExpected = '清空条件和排序并回第1页；首行回到 R001。';
test('short reset action is grounded in this original step, not blanket reset permission', () => {
  assert.equal(isQueryResetStep(resetAction, resetExpected), true);
  assert.equal(isQueryResetStep(resetAction, '条件与排序清空并回第1页；首行恢复为 R001。'), true);
  assert.equal(isQueryResetStep('查询之后，重置查询，核对列表。', ''), true);
  for (const action of [
    '不要点击重置',
    '如果有问题点击重置',
    '点击重置数据',
    '点击重置密码',
    '查看重置说明',
  ])
    assert.equal(isQueryResetStep(action, resetExpected), false, action);
  for (const text of ['记录恢复默认', '清空业务数据并更新查询结果', ''])
    assert.equal(isQueryResetStep(resetAction, text), false, text);
  const c = {
    case_id: 'Q1',
    steps: [
      {
        step_id: '1',
        action: resetAction,
        expected: resetExpected,
        obligations: [{ id: 'O1', text: resetExpected }],
      },
    ],
  };
  const plan = createAdaptivePlan(c, '/');
  const fragment = {
    actions: [
      {
        action_id: 'A1',
        op: 'click',
        target: { kind: 'role', role: 'button', name: '重置', exact: true },
      },
    ],
    assertions: [],
    complete: false,
    within_ms: 5000,
    reason: '原步骤查询重置',
  };
  assert.doesNotThrow(() =>
    validateAdaptiveFragment(fragment, {
      c,
      plan,
      step: plan.steps[0],
      base: 'http://fixture.test/',
    }),
  );
});

for (const scenario of [
  'button',
  'native',
  'outside-form',
  'post',
  'business',
  'late-post',
  'late-name',
  'native-input',
]) {
  test(`real dispatch query reset checks original and current form: ${scenario}`, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const reset =
      scenario === 'native-input'
        ? '<input id="go" type="reset" value="继续" onclick="window.clicks++">'
        : `<button id="go" type="${scenario === 'native' ? 'reset' : 'button'}" onclick="window.clicks++">${scenario === 'business' ? '重置数据' : '重置'}</button>`;
    const body = `<form ${scenario === 'post' ? 'method="post"' : ''}><label>关键词<input name="q"></label><button type="submit">查询</button>${scenario !== 'outside-form' ? reset : ''}</form>${scenario === 'outside-form' ? reset : ''}<script>window.clicks=0</script>`;
    await page.route('http://fixture.test/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body }),
    );
    await page.goto('http://fixture.test/');
    if (scenario === 'button')
      assert.equal(
        await page.locator('#go').evaluate(queryFormFacts),
        null,
        'discovery native-reset contract unchanged',
      );
    const c = {
      case_id: 'Q1',
      steps: [
        {
          step_id: '1',
          action: resetAction,
          expected: resetExpected,
          obligations: [{ id: 'O1', text: resetExpected }],
        },
      ],
    };
    const plan = createAdaptivePlan(c, '/');
    const action = { action_id: 'A1', op: 'click', target: { kind: 'css', value: '#go' } };
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
        if (type !== 'ACTION_STARTED') return;
        if (scenario === 'late-post')
          await page.locator('form').evaluate((e) => (e.method = 'post'));
        if (scenario === 'late-name')
          await page.locator('#go').evaluate((e) => (e.textContent = '重置数据'));
      },
    };
    const session = new BrowserSession({ headless: true });
    if (['button', 'native'].includes(scenario)) {
      await session.executeActions(run);
      assert.equal(result.actions[0].status, 'EXECUTED');
      assert.equal(await page.evaluate(() => window.clicks), 1);
    } else {
      await assert.rejects(session.executeActions(run), {
        code: ['business', 'late-name'].includes(scenario)
          ? 'ADAPTIVE_ACTION_WRITE_FORBIDDEN'
          : 'ADAPTIVE_QUERY_RESET_CONTEXT_REQUIRED',
      });
      assert.equal(await page.evaluate(() => window.clicks), 0);
      assert.ok(result.actions.length);
      assert.ok(result.actions.every((r) => r.dispatched === false));
    }
  });
}
