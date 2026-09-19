import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { snapshot, perform, checkAssertionGroup, BrowserSession } from '../src/browser.mjs';
import { captureCaseNamedGuard, caseNamedHandles } from '../src/wizard-binding.mjs';
import { releaseWithinGuard } from '../src/within-locator.mjs';
import {
  caseHash,
  planHash,
  validatePlan,
  validateLocator,
  suggestObligations,
  PLAN_PROMPT,
} from '../src/plans.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { planningInput } from '../src/planning-input.mjs';
import { blockAuditInput } from '../src/block-audit.mjs';
import { startFixture } from '../acceptance/serve.mjs';
import { Controller } from '../src/controller.mjs';
import { Store } from '../src/store.mjs';
import { compileAdapter } from '../src/adapter-program.mjs';

const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const label = (value) => ({ kind: 'label', value, exact: true });
const named = (name = '数量', type = 'number', stepId = '1', step = '2 明细') => ({
  kind: 'case_named',
  source_step_id: stepId,
  target: type === 'button' ? role('button', name) : label(name),
  control_type: type,
  guard: { path: '/', page_heading: '新建申请', step },
});
function simplePlan() {
  const c = {
    case_id: 'W',
    steps: suggestObligations([{ step_id: '1', action: '数量输入2', expected: '数量为2' }]),
  };
  const target = named();
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
        step_id: '1',
        source_action: c.steps[0].action,
        source_expected: c.steps[0].expected,
        actions: [{ action_id: 'a1', op: 'fill', target, value: '2' }],
        assertions: [
          {
            target,
            check: 'value',
            expected: '2',
            oracle_quote: '数量为2',
            obligation_ids: ['1-O1'],
          },
        ],
        assertion_mode: 'simultaneous',
        within_ms: 1000,
      },
    ],
  };
  return { c, plan };
}
const html = (fields = '<label>数量<input type="number"></label>', step = '2 明细') => `
  <h1>新建申请</h1><ol><li ${step === '1 基本' ? 'aria-current="step"' : ''}>1 基本</li><li ${step === '2 明细' ? 'aria-current="step"' : ''}>2 明细</li></ol>
  <section><h2>${step}</h2><form>${fields}<button>下一步</button></form></section>
  <script>window.effects=0; document.querySelector('form').onsubmit=e=>{e.preventDefault(); effects++}; document.querySelector('form').oninput=()=>effects++;</script>`;
async function pageFor(t, content) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('http://wizard.test/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: content }),
  );
  await page.goto('http://wizard.test/');
  return page;
}

test('A: complete fixed plan accepts case literal intent before the future field exists', async (t) => {
  const page = await pageFor(t, html('<label>名称<input></label>', '1 基本'));
  const { c, plan } = simplePlan();
  const observation = await snapshot(page);
  assert.ok(!observation.controls.some((c) => c.name === '数量'));
  assert.deepEqual(observation.wizard_context.steps, ['1 基本', '2 明细']);
  const input = planningInput(
    { target: 'http://wizard.test/', snapshots: [observation] },
    c,
    {},
    caseHash(c),
  );
  assert.doesNotThrow(() => validatePlan(plan, c, 'http://wizard.test/'));
  assert.doesNotThrow(() => requirePlanSemantics(plan, c, input));
  assert.ok(
    blockAuditInput(input, { blocked: true, reason: '后续字段' }).evidence_catalog.some(
      (x) => x.fact.kind === 'wizard_context',
    ),
  );
  assert.match(PLAN_PROMPT, /CASE_NAMED_UNOBSERVED/);
  assert.match(PLAN_AUDIT_PROMPT, /ONLY bounded exception/);
  assert.equal(await page.evaluate(() => effects), 0);
});

test('intent provenance, cleanup, nesting, dangerous buttons and new operations cannot be forged', () => {
  const { c, plan } = simplePlan();
  for (const change of [
    (p) => (p.steps[0].actions[0].target.source_step_id = 'unknown'),
    (p) => (p.steps[0].actions[0].target.target.value = '合计'),
    (p) => (p.steps[0].actions[0].repair_anchor = label('数量')),
    (p) => (p.steps[0].actions[0].op = 'press'),
    (p) => p.preconditions.push({ target: named(), check: 'visible' }),
    (p) => (p.steps[0].actions[0].target.target = named()),
    (p) => (p.steps[0].actions[0].target.provenance = 'DOM_OBSERVED'),
    (p) => (p.steps[0].actions[0].target.control_type = 'password'),
  ]) {
    const bad = structuredClone(plan);
    change(bad);
    assert.throws(() => validatePlan(bad, c, 'http://wizard.test/'));
  }
  const bad = structuredClone(plan);
  bad.steps[0].actions[0] = { action_id: 'a1', op: 'click', target: named('提交申请', 'button') };
  const changed = structuredClone(c);
  changed.steps[0].action = '点击提交申请';
  bad.steps[0].source_action = changed.steps[0].action;
  bad.case_hash = caseHash(changed);
  assert.throws(() => validatePlan(bad, changed, 'http://wizard.test/'), {
    code: 'CASE_NAMED_ACTION_FORBIDDEN',
  });
  assert.throws(() =>
    validateLocator({
      kind: 'within',
      scope: { role: 'dialog', name: '编辑', exact: true },
      target: named(),
    }),
  );
});

test('unobserved intent cannot be laundered into an observed adapter result or a login marker', async (t) => {
  const source = `export function locate(input) { return ${JSON.stringify(named())}; }`;
  assert.throws(() => compileAdapter(source).locate({}), { code: 'ADAPTER_PROGRAM_REJECTED' });
  const browser = new BrowserSession({ headless: true });
  const page = await pageFor(t, html());
  browser.browser = page.context().browser();
  browser.taskId = 'active-test';
  browser.loginPage = page;
  await assert.rejects(browser.authenticate({ id: 'active-test' }, named()), {
    code: 'CASE_NAMED_ACTION_FORBIDDEN',
  });
});

test('guard rejection is latched and DOM method shadowing cannot let a later click through', async (t) => {
  const page = await pageFor(t, html());
  const spec = named('下一步', 'button'),
    [target] = await caseNamedHandles(page, spec);
  const guard = await captureCaseNamedGuard(page, spec, target);
  try {
    assert.equal(await guard.evaluate((g) => g.arm()), true);
    await page.locator('form').evaluate((form) => {
      const shadow = document.createElement('input');
      shadow.name = 'querySelectorAll';
      form.append(shadow);
      form.querySelector = undefined;
      form.lastElementChild.previousElementSibling.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      shadow.remove();
    });
    assert.equal(await guard.evaluate((g) => g.blocked()), true);
    await target.click();
    assert.equal(await page.evaluate(() => effects), 0);
  } finally {
    await releaseWithinGuard(guard);
    await target.dispose();
  }
});

test('future expected text and advice are not context evidence; origin and observed step list must match', () => {
  const { c, plan } = simplePlan();
  for (const context of [
    {},
    { ui_experience_advice: [{ path: '/', page_heading: '新建申请', steps: ['2 明细'] }] },
    {
      target_origin: 'http://wizard.test',
      pages: [
        {
          url: 'http://other.test/',
          wizard_context: { path: '/', page_heading: '新建申请', steps: ['2 明细'] },
        },
      ],
    },
    {
      target_origin: 'http://wizard.test',
      pages: [
        {
          url: 'http://wizard.test/',
          wizard_context: { path: '/', page_heading: '新建申请', steps: ['1 基本'] },
        },
      ],
    },
  ])
    assert.throws(() => requirePlanSemantics(plan, c, context), {
      code: 'CASE_NAMED_GUARD_UNOBSERVED',
    });
  for (const change of [
    (p) => (p.steps[0].actions[0].value = '3'),
    (p) => (p.steps[0].actions[0].target.guard.step = '1 基本'),
    (p) => (p.steps[0].actions[0].target.control_type = 'text'),
    (p) => (p.steps[0].assertions[0].expected = '3'),
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.notEqual(planHash(changed), planHash(plan));
  }
});

test('a mentioned, negated, future-only or expected-only field is not an original input instruction', () => {
  for (const action of ['数量显示在页面上', '不要数量输入2', '不填写数量', '进入明细页']) {
    const { c, plan } = simplePlan();
    c.steps[0].action = action;
    plan.steps[0].source_action = action;
    plan.case_hash = caseHash(c);
    assert.throws(() => validatePlan(plan, c, 'http://wizard.test'), {
      code: 'CASE_NAMED_SOURCE_REQUIRED',
    });
  }
});

test('injected planning plus semantic audit yields an unapproved candidate; stale approval hash cannot authorize a changed future field', async (t) => {
  const page = await pageFor(t, html('<label>名称<input></label>', '1 基本'));
  const { c, plan } = simplePlan();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'case-named-planning-'));
  const store = new Store(directory);
  await store.init();
  t.after(() => store.releaseLock());
  const id = await store.create({
    name: '固定未来字段工程夹具',
    target: 'http://wizard.test/',
    baseline: { cases: [c] },
  });
  const phases = [];
  const provider = {
    configured: () => true,
    model: 'injected-case-named',
    json: async (prompt, input, options) => {
      const phase = options.phase;
      phases.push(phase);
      let value;
      if (input.candidate_plan)
        value = {
          checks: [
            {
              step_id: '1',
              obligation_id: '1-O1',
              status: 'COVERED',
              assertion_indices: [0],
              reason: '注入审查只验证工程流程，不证明模型判断。',
            },
          ],
          issues: [],
        };
      else if (prompt.startsWith(PLAN_PROMPT)) {
        assert.ok(input.pages[0].wizard_context);
        assert.ok(!input.pages[0].controls.some((c) => c.name === '数量'));
        value = { plan: structuredClone(plan) };
      } else value = { issues: [] };
      return {
        value,
        usage: { response_model: 'injected-case-named', prompt_tokens: 1, completion_tokens: 1 },
      };
    },
  };
  const controller = new Controller({ store, provider, browser: {} });
  const observation = await snapshot(page);
  await store.update(id, (s) => {
    s.snapshots = [observation];
  });
  await controller.confirmCase(id, c.case_id, { steps: c.steps, note: '合成用例固定原文' });
  await controller.launch(id, 'plan', [c.case_id]);
  await controller.active.finished;
  let row = (await store.read(id)).cases[0];
  assert.equal(row.status, 'PLAN_REVIEW');
  assert.equal(row.plan_approved, false);
  const oldHash = planHash(row.plan);
  await assert.rejects(controller.approvePlan(id, c.case_id, 'wrong'), { code: 'PLAN_CHANGED' });
  await controller.approvePlan(id, c.case_id, oldHash);
  assert.equal((await store.read(id)).cases[0].plan_approved, true);
  await store.update(id, (s) => {
    s.cases[0].plan.steps[0].actions[0].value = '3';
  });
  await assert.rejects(controller.approvePlan(id, c.case_id, oldHash), {
    code: 'PLAN_AUDIT_REQUIRED',
  });
  assert.ok(phases.length >= 3);
  assert.equal(await page.evaluate(() => effects), 0);
  console.log(
    JSON.stringify({ artifact: directory, injected_calls: phases.length, real_model_calls: 0 }),
  );
});

test('current step binds native input and atomic assertion without modifying the fixed locator', async (t) => {
  const page = await pageFor(t, html());
  const target = named(),
    frozen = JSON.stringify(target);
  await perform(page, { op: 'fill', target, value: '2' }, 'http://wizard.test/');
  const results = await checkAssertionGroup(page, [{ target, check: 'value', expected: '2' }], {
    timeout: 1000,
  });
  assert.equal(results[0].passed, true);
  assert.equal(JSON.stringify(target), frozen);
  assert.equal(await page.evaluate(() => effects), 1);
});

test('role-based intent also rejects hidden duplicate native controls in the current form', async (t) => {
  const page = await pageFor(
    t,
    html('<label>数量<input type="number"></label><label hidden>数量<input type="number"></label>'),
  );
  const target = { ...named(), target: role('spinbutton', '数量') };
  await assert.rejects(perform(page, { op: 'fill', target, value: '2' }, 'http://wizard.test'), {
    code: 'CASE_NAMED_NOT_UNIQUE',
  });
  assert.equal(await page.evaluate(() => effects), 0);
});

for (const [title, content, code] of [
  [
    'wrong step with unique editable same-name field',
    html(undefined, '1 基本'),
    'CASE_NAMED_CONTEXT_MISMATCH',
  ],
  [
    'duplicate fields including hidden collision',
    html('<label>数量<input type="number"></label><label hidden>数量<input type="number"></label>'),
    'CASE_NAMED_NOT_UNIQUE',
  ],
  ['wrong input type', html('<label>数量<input type="text"></label>'), 'CASE_NAMED_TYPE_MISMATCH'],
  ['missing field', html('<label>其他<input></label>'), 'CASE_NAMED_NOT_FOUND'],
  [
    'borrowed field in another form',
    html('<label>其他<input></label>') + '<form><label>数量<input type="number"></label></form>',
    'CASE_NAMED_NOT_FOUND',
  ],
  [
    'nested foreign section',
    html('<section><label>数量<input type="number"></label></section>'),
    'CASE_NAMED_NOT_FOUND',
  ],
  [
    'ambiguous step containers',
    html() + '<section><h2>2 明细</h2><form></form></section>',
    'CASE_NAMED_CONTEXT_MISMATCH',
  ],
])
  test(`binding stops before dispatch: ${title}`, async (t) => {
    const page = await pageFor(t, content);
    await assert.rejects(
      perform(page, { op: 'fill', target: named(), value: '2' }, 'http://wizard.test/'),
      { code },
    );
    assert.equal(await page.evaluate(() => effects), 0);
  });

test('changing approved route, page identity or captured DOM invalidates the binding', async (t) => {
  const page = await pageFor(t, html());
  for (const mutate of [
    () => (location.hash = '/different'),
    () => (document.querySelector('h1').textContent = '编辑另一申请'),
    () => document.querySelector('input').replaceWith(document.querySelector('input').cloneNode()),
    () => document.querySelector('form').append(document.querySelector('input').cloneNode()),
  ]) {
    await page.goto('http://wizard.test/');
    const [target] = await caseNamedHandles(page, named());
    const guard = await captureCaseNamedGuard(page, named(), target);
    try {
      await page.evaluate(mutate);
      assert.equal(await guard.evaluate((g) => g.arm()), false);
    } finally {
      await releaseWithinGuard(guard);
      await target.dispose();
    }
    assert.equal(await page.evaluate(() => effects), 0);
  }
});

test('step identity changing at mousedown blocks the subsequent submit click', async (t) => {
  const page = await pageFor(t, html());
  await page
    .locator('button')
    .evaluate(
      (e) => (e.onmousedown = () => (document.querySelector('h2').textContent = '其他步骤')),
    );
  await assert.rejects(
    perform(page, { op: 'click', target: named('下一步', 'button') }, 'http://wizard.test/'),
    { code: 'CASE_NAMED_CONTEXT_CHANGED' },
  );
  assert.equal(await page.evaluate(() => effects), 0);
});

test('fixed executor honors stop and catches identity changes while action intent is persisted', async (t) => {
  const page = await pageFor(t, html());
  const session = new BrowserSession({ headless: true });
  for (const stop of [true, false]) {
    await page.goto('http://wizard.test/');
    const abort = new AbortController(),
      { c, plan } = simplePlan();
    const result = { actions: [], repairs: [], executed_plan: structuredClone(plan) };
    await assert.rejects(
      session.executeActions({
        task: { target: 'http://wizard.test/' },
        plan,
        step: plan.steps[0],
        point: plan.steps[0],
        budget: { remaining: () => 10000 },
        result,
        page,
        recording: {
          beforeAction: async () => {
            if (stop) abort.abort();
          },
        },
        guard: { dirty: false },
        signal: abort.signal,
        emit: async (type) => {
          if (type === 'ACTION_STARTED')
            await page.locator('h2').evaluate((e) => (e.textContent = '另一对象'));
        },
        setPhase: () => {},
      }),
      { code: stop ? 'STOPPED' : 'CASE_NAMED_CONTEXT_CHANGED' },
    );
    assert.equal(await page.evaluate(() => effects), 0);
    assert.equal(result.actions.length, stop ? 0 : 1);
  }
});

test('approval presentation shows unobserved intent, every guard and values, with HTML escaping', async (t) => {
  const source = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    document: { querySelector: () => ({ content: 'csrf' }) },
    console,
  });
  vm.runInContext(
    source
      .slice(0, source.lastIndexOf('await action(() => refresh(true));'))
      .replace(/^import .*evidence-view\.js';\r?\n/m, '') + '\nglobalThis.renderPlan=planHTML;',
    context,
  );
  const { plan } = simplePlan();
  plan.steps[0].actions[0].target.guard.page_heading = '<img src=x onerror=bad()>';
  const rendered = context.renderPlan(plan);
  assert.match(rendered, /含 2 项尚未观察的定位/);
  assert.match(rendered, /执行时核验唯一表单与控件/);
  assert.match(rendered, /不自动换目标或生成后续计划/);
  assert.ok(rendered.includes('&lt;img'));
  assert.ok(!rendered.includes('<img'));
  assert.match(rendered, /2 明细/);
  const css = await fs.readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const page = await pageFor(t, '');
  await page.setContent(
    `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><dialog open><h2>核对执行计划</h2><div class="plan-card">${rendered}</div><button>以上操作、断言和清理已核对</button></dialog>`,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('[data-unobserved-plan]').isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.locator('button').focus();
    assert.equal(await page.locator('button').evaluate((e) => document.activeElement === e), true);
    await page.locator('dialog').evaluate((e) => (e.scrollTop = 0));
    await page.screenshot({ path: `validation/REQ-0008-approval-${width}.png` });
  }
});

test('original frozen REQS-003: fixed six-step plan traverses hidden future fields and checks original boundaries', async (t) => {
  const fixture = await startFixture({ site: 'requests' });
  const browser = new BrowserSession({ headless: true });
  t.after(async () => {
    await browser.close();
    await fixture.close();
  });
  const imported = JSON.parse(
    await fs.readFile(new URL('../acceptance/cases/requests.json', import.meta.url), 'utf8'),
  ).cases.find((c) => c.case_id === 'REQS-003');
  const c = { ...imported, steps: suggestObligations(imported.steps) };
  const task = {
    id: 'case-named-frozen',
    target: fixture.origin,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  await browser.open(task);
  await browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  await browser.loginPage.getByRole('button', { name: '退出登录', exact: true }).waitFor();
  await browser.authenticate(task, role('button', '退出登录'));
  await browser.loginPage.getByRole('link', { name: '查看申请记录', exact: true }).click();
  await browser.loginPage.getByRole('button', { name: '新建申请', exact: true }).click();
  const observed = await browser.snapshot();
  assert.ok(!observed.controls.some((c) => c.name === '数量'));
  const future = (name, type, id, step = '2 采购明细') => ({
    ...named(name, type, id, step),
    guard: { path: '/#/new', page_heading: '新建申请', step },
  });
  const action = (id, op, target, value) => ({
    action_id: id,
    op,
    target,
    ...(value !== undefined ? { value } : {}),
  });
  const next = (id) => action(id, 'click', role('button', '下一步'));
  const text = (value) => ({ target: { kind: 'text', value, exact: true }, check: 'visible' });
  const steps = [
    { actions: [next('a1')], assertions: ['申请名称必填', '项目必选', '申请人必填'].map(text) },
    {
      actions: [
        action('a2', 'fill', label('申请名称'), '边界校验样本'),
        action('a3', 'select', label('项目'), '青岚站'),
        action('a4', 'fill', label('申请人'), '合成测试员'),
        next('a5'),
      ],
      assertions: [
        { target: role('heading', '2 采购明细'), check: 'visible' },
        { target: future('品类', 'select', '3'), check: 'contains', expected: '检修工具' },
        { target: future('品类', 'select', '3'), check: 'contains', expected: '安全护具' },
      ],
    },
    {
      actions: [
        action('a6', 'select', future('品类', 'select', '3'), '检修工具'),
        action('a7', 'fill', future('数量', 'number', '3'), '0'),
        action('a8', 'click', future('下一步', 'button', '3')),
      ],
      assertions: [
        text('数量必须是1至20的整数'),
        { target: role('heading', '2 采购明细'), check: 'visible' },
      ],
    },
    {
      actions: [
        action('a9', 'fill', future('数量', 'number', '4'), '21'),
        action('a10', 'click', future('下一步', 'button', '4')),
      ],
      assertions: [
        text('数量必须是1至20的整数'),
        { target: role('heading', '3 确认提交'), check: 'hidden' },
      ],
    },
    {
      actions: [
        action('a11', 'fill', future('数量', 'number', '5'), '2'),
        action('a12', 'click', future('下一步', 'button', '5')),
      ],
      assertions: [
        { target: role('heading', '3 确认提交'), check: 'visible' },
        ...['2', '60', '120'].map((value) => ({
          target: { kind: 'text', value, exact: true },
          check: 'text',
          expected: value,
        })),
      ],
    },
    {
      actions: [action('a13', 'click', role('button', '取消'))],
      assertions: [
        text('共 2 条申请'),
        { target: role('heading', '例行工具申请'), check: 'visible' },
        { target: role('heading', '回归专用申请甲（勿删）'), check: 'visible' },
        { target: role('heading', '边界校验样本'), check: 'hidden' },
      ],
    },
  ];
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: '/#/new',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: steps.map((s, i) => ({
      step_id: c.steps[i].step_id,
      source_action: c.steps[i].action,
      source_expected: c.steps[i].expected,
      ...s,
      assertions: s.assertions.map((a) => ({
        ...a,
        oracle_quote: c.steps[i].expected,
        obligation_ids: c.steps[i].obligations.map((o) => o.id),
      })),
      assertion_mode: 'simultaneous',
      within_ms: 3000,
    })),
  };
  validatePlan(plan, c, fixture.origin);
  requirePlanSemantics(plan, c, { target_origin: fixture.origin, pages: [observed] });
  const frozen = planHash(plan),
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-named-frozen-'));
  const result = await browser.execute(task, c, plan, dir, { approved_plan_hash: frozen });
  console.log(
    JSON.stringify({
      artifact: dir,
      status: result.status,
      assertions: result.assertions.length,
      error: result.error,
    }),
  );
  assert.equal(result.status, 'PASS_ASSERTIONS');
  assert.equal(result.actions.length, 13);
  assert.ok(result.assertions.length >= 18);
  assert.equal(result.approved_plan_hash, frozen);
  assert.equal(planHash(result.executed_plan), frozen);
  assert.equal(fixture.inspect().mutations.length, 0);
});
