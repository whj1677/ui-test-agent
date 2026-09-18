import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../src/browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { validatePlan, caseHash, planHash, suggestObligations } from '../src/plans.mjs';
import { INTENT_PLAN_VERSION, INTENT_PLAN_PROMPT } from '../src/intent-plan.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { runtimeIntentHandles } from '../src/runtime-binding.mjs';
import { start } from '../src/server.mjs';

const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const object = '设备 A / D001';
function fixture() {
  const c = {
    case_id: 'RT-1',
    title: '异步详情字段核验',
    data: { identity: object },
    steps: suggestObligations([
      {
        step_id: 'S1',
        action: `点击设备卡片中${object}的详情，在设备详情查看${object}标题`,
        expected: `${object}标题可见`,
      },
      { step_id: 'S2', action: '点击设备详情的运行参数标签并查看频率', expected: '频率为50' },
    ]),
  };
  const intent = (step, scope, r, name) => ({
    kind: 'runtime_intent',
    source_step_id: step,
    page: { path: '/', heading: '设备管理' },
    scope: { role: scope === '设备卡片' ? 'article' : 'dialog', name: scope, identity: object },
    role: r,
    name,
  });
  const targets = [
    intent('S1', '设备卡片', 'button', '详情'),
    intent('S1', '设备详情', 'heading', object),
    intent('S2', '设备详情', 'tab', '运行参数'),
    intent('S2', '设备详情', 'textbox', '频率'),
  ];
  const plan = {
    schema_version: INTENT_PLAN_VERSION,
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: '/',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: c.steps.map((s, i) => ({
      step_id: s.step_id,
      source_action: s.action,
      source_expected: s.expected,
      assertion_mode: 'sequential_checkpoints',
      timeout_ms: 8000,
      checkpoints: [
        {
          checkpoint_id: 'CP' + i,
          within_ms: 1500,
          actions: [{ action_id: 'A' + i, op: 'click', target: targets[i * 2] }],
          assertions: [
            {
              target: targets[i * 2 + 1],
              check: i ? 'value' : 'visible',
              ...(i ? { expected: '50' } : {}),
              oracle_quote: s.expected,
              obligation_ids: [s.step_id + '-O1'],
            },
          ],
        },
      ],
    })),
  };
  return { c, plan };
}
const html = ({
  identity = object,
  duplicate = false,
  delay = 120,
  price = '50',
} = {}) => `<!doctype html><meta charset="utf-8"><h1>设备管理</h1><article aria-label="设备卡片"><h2>${identity}</h2><button type="button" onclick="detail()">详情</button>${duplicate ? '<button type="button">详情</button>' : ''}</article><script>
window.clicks=0;function detail(){clicks++;setTimeout(()=>{const d=document.createElement('dialog');d.setAttribute('aria-label','设备详情');d.innerHTML='<h2>${object}</h2><button type="button" role="tab" onclick="fields(this)">运行参数</button>';document.body.append(d);d.showModal()},${delay})}
function fields(b){clicks++;setTimeout(()=>b.insertAdjacentHTML('afterend','<label>频率<input readonly value="${price}"></label>'),120)}
</script>`;
async function environment(t, options = {}) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html(options));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const target = `http://127.0.0.1:${server.address().port}/`,
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-binding-'));
  const store = new Store(root);
  await store.init();
  t.after(() => store.releaseLock());
  const { c, plan } = fixture();
  const id = await store.create({ name: '合成运行绑定', target, baseline: { cases: [c] } });
  await store.update(id, (s) => {
    s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
    s.auth_marker = role('heading', '设备管理');
  });
  const task = await store.read(id),
    session = new BrowserSession({ headless: true });
  t.after(() => session.close());
  await session.open(task);
  await session.authenticate(task, task.auth_marker);
  return { c, plan, store, id, task, session, root, target };
}
function providerFor(c, plan, { issue = false } = {}) {
  const calls = [];
  return {
    calls,
    configured: () => true,
    json: async (prompt, input) => {
      let value;
      if (prompt.startsWith(INPUT_REVIEW_PROMPT)) {
        calls.push('input');
        value = {
          issues: issue
            ? [
                {
                  code: 'CONTRADICTION',
                  step_id: 'S2',
                  message: '请确认50与60两项冲突预期。',
                  source_quotes: [input.effective.steps[1].expected],
                },
              ]
            : [],
        };
      } else if (prompt.startsWith(PLAN_AUDIT_PROMPT)) {
        calls.push('audit');
        value = {
          checks: c.steps.map((s) => ({
            step_id: s.step_id,
            obligation_id: s.step_id + '-O1',
            status: 'COVERED',
            assertion_indices: [0],
            reason: '仅本机注入协议审查，不是真实模型。',
          })),
          issues: [],
        };
      } else {
        assert.ok(prompt.startsWith(INTENT_PLAN_PROMPT));
        calls.push('plan');
        assert.equal(
          input.pages[0].controls.some((x) => x.name === '频率'),
          false,
        );
        value = { plan: structuredClone(plan) };
      }
      return {
        value,
        usage: { response_model: 'local-injected', prompt_tokens: 1, completion_tokens: 1 },
      };
    },
  };
}

test('intent protocol is opt-in; legacy plans cannot acquire runtime targets', () => {
  const { c, plan } = fixture();
  assert.throws(() => validatePlan(plan, c, 'http://localhost'), {
    code: 'RUNTIME_BINDING_DISABLED',
  });
  assert.equal(validatePlan(plan, c, 'http://localhost', { runtimeBinding: true }), plan);
  for (const schema_version of ['ui-agent-plan/v2', 'ui-agent-plan/v3']) {
    const forged = { ...plan, schema_version };
    assert.throws(() => validatePlan(forged, c, 'http://localhost', { runtimeBinding: true }));
  }
});

test('intent cannot shorten business identity or replace oracle with observed value', () => {
  const { c, plan } = fixture();
  plan.steps[0].checkpoints[0].actions[0].target.scope.identity = '设备 A';
  assert.throws(() => validatePlan(plan, c, 'http://localhost', { runtimeBinding: true }), {
    code: 'INTENT_OBJECT_IDENTITY_REQUIRED',
  });
  const candidate = fixture().plan;
  candidate.steps[1].checkpoints[0].assertions[0].expected = '60';
  assert.throws(() => validatePlan(candidate, c, 'http://localhost', { runtimeBinding: true }), {
    code: 'INTENT_EXPECTED_SOURCE_REQUIRED',
  });
});
for (const [name, change, code] of [
  ['write', (p) => (p.data_effect = 'mutation'), 'INVALID_SCHEMA'],
  [
    'foreign identity',
    (p) => (p.steps[0].checkpoints[0].actions[0].target.scope.identity = 'D999'),
    'INTENT_SOURCE_REQUIRED',
  ],
  [
    'invented field',
    (p) => (p.steps[1].checkpoints[0].assertions[0].target.name = '温度'),
    'INTENT_SOURCE_REQUIRED',
  ],
  [
    'arbitrary future route',
    (p) => (p.steps[0].checkpoints[0].actions[0].target.page.path = '/x?token=1'),
    'SENSITIVE_CONTROL_FORBIDDEN',
  ],
  [
    'mutation op',
    (p) => (p.steps[0].checkpoints[0].actions[0].op = 'hover'),
    'INTENT_ACTION_UNSUPPORTED',
  ],
  [
    'negative inference',
    (p) => (p.steps[0].checkpoints[0].assertions[0].check = 'hidden'),
    'INTENT_ASSERTION_UNSUPPORTED',
  ],
])
  test('schema rejects ' + name, () => {
    const { c, plan } = fixture();
    change(plan);
    assert.throws(() => validatePlan(plan, c, 'http://localhost', { runtimeBinding: true }), {
      code,
    });
  });

test('product entry: shallow observation → input review → audit → approval → real async drawer and tab', async (t) => {
  const e = await environment(t),
    provider = providerFor(e.c, e.plan),
    controller = new Controller({
      store: e.store,
      provider,
      browser: e.session,
      runtimeBinding: true,
    });
  await controller.confirmCase(e.id, e.c.case_id, { steps: e.c.steps });
  await controller.launch(e.id, 'intent-plan', [e.c.case_id]);
  await controller.active.finished;
  let row = (await e.store.read(e.id)).cases[0];
  assert.equal(row.status, 'PLAN_REVIEW', row.mapping_reason);
  assert.equal(row.plan_approved, false);
  assert.deepEqual(provider.calls, ['input', 'plan', 'audit']);
  assert.equal(
    await e.session.loginPage.evaluate(() => clicks),
    0,
    'planning never clicks future UI',
  );
  await assert.rejects(controller.launch(e.id, 'run', [e.c.case_id]), {
    code: 'PLAN_APPROVAL_REQUIRED',
  });
  await controller.approvePlan(e.id, e.c.case_id, planHash(row.plan));
  await controller.launch(e.id, 'run', [e.c.case_id]);
  await controller.active.finished;
  row = (await e.store.read(e.id)).cases[0];
  const facts = await e.store.facts(e.id, row.attempts[0]);
  assert.equal(
    facts.status,
    'PASS_ASSERTIONS',
    JSON.stringify({ error: facts.error, actions: facts.actions, assertions: facts.assertions }),
  );
  assert.equal(facts.actions.length, 2);
  assert.equal(facts.bindings.length, 4);
  assert.equal(
    facts.bindings.every((b) => b.status === 'VERIFIED'),
    true,
  );
  assert.equal(facts.plan_hash, planHash(e.plan));
  assert.deepEqual(facts.executed_plan, e.plan);
  assert.equal(facts.regression_ready, false);
  assert.ok(
    facts.bindings.every(
      (b) => b.approved_plan_hash === facts.approved_plan_hash && b.run_id === facts.id,
    ),
  );
  assert.equal(facts.dirty, false);
  assert.equal(facts.assertions[1].actual, '50');
});

for (const [name, options, code] of [
  ['wrong object', { identity: '设备 B / D002' }, 'BINDING_OBJECT_MISMATCH'],
  ['ambiguous button', { duplicate: true }, 'BINDING_TARGET_AMBIGUOUS'],
])
  test(name + ' blocks before dispatch', async (t) => {
    const e = await environment(t, options),
      events = [];
    const result = await e.session.execute(e.task, e.c, e.plan, path.join(e.root, 'run'), {
      runtimeBinding: true,
      approved_plan_hash: planHash(e.plan),
      onEvent: (e) => events.push(e),
    });
    assert.equal(result.status, 'TECHNICAL_FAILED', JSON.stringify(result.error));
    assert.equal(result.actions.filter((a) => a.dispatched).length, 0);
    assert.ok(result.bindings.some((b) => b.code === code));
  });

test('input doubt returns to review without generating a plan or treating user text as truth', async (t) => {
  const e = await environment(t);
  e.c.steps[1].expected = '频率为50且频率为60';
  e.c.steps = suggestObligations(e.c.steps);
  const provider = providerFor(e.c, e.plan, { issue: true }),
    controller = new Controller({
      store: e.store,
      provider,
      browser: e.session,
      runtimeBinding: true,
    });
  await controller.confirmCase(e.id, e.c.case_id, { steps: e.c.steps, note: '合成冲突输入' });
  await controller.launch(e.id, 'intent-plan', [e.c.case_id]);
  await controller.active.finished;
  const row = (await e.store.read(e.id)).cases[0];
  assert.equal(row.status, 'NEEDS_REVIEW');
  assert.equal(row.plan, null);
  assert.equal(row.reviewed, false);
  assert.deepEqual(provider.calls, ['input']);
  assert.ok(row.issues[0].quote_locations.length);
  assert.equal(await e.session.loginPage.evaluate(() => clicks), 0);
});

test('confirmation changes invalidate the old intent approval and retain original input', async (t) => {
  const e = await environment(t),
    controller = new Controller({
      store: e.store,
      provider: providerFor(e.c, e.plan),
      browser: e.session,
      runtimeBinding: true,
    });
  await controller.confirmCase(e.id, e.c.case_id, { steps: e.c.steps });
  await controller.launch(e.id, 'intent-plan', [e.c.case_id]);
  await controller.active.finished;
  await controller.approvePlan(e.id, e.c.case_id, planHash(e.plan));
  const changed = structuredClone(e.c.steps);
  changed[1].expected = '频率为60';
  await controller.confirmCase(e.id, e.c.case_id, {
    steps: suggestObligations(changed),
    note: '用户明确修订',
  });
  await assert.rejects(controller.launch(e.id, 'run', [e.c.case_id]), {
    code: 'PLAN_APPROVAL_REQUIRED',
  });
  const row = (await e.store.read(e.id)).cases[0];
  assert.equal(row.plan, null);
  assert.ok(row.confirmation_history.length);
  assert.equal((await e.store.baseline(e.id)).cases[0].steps[1].expected, '频率为50');
});

test('assertion time window includes binding latency, never starts over', async (t) => {
  const e = await environment(t);
  e.plan.steps[0].checkpoints[0].within_ms = 100;
  const result = await e.session.execute(e.task, e.c, e.plan, path.join(e.root, 'late'), {
    runtimeBinding: true,
    approved_plan_hash: planHash(e.plan),
  });
  assert.notEqual(result.status, 'PASS_ASSERTIONS');
  assert.equal(result.actions.filter((a) => a.dispatched).length, 1);
  assert.ok(result.bindings.some((b) => b.code === 'BINDING_DEADLINE_EXCEEDED'));
});

test('actual value mismatch is a business failure, not rewritten to the observed value', async (t) => {
  const e = await environment(t, { price: '60' }),
    result = await e.session.execute(e.task, e.c, e.plan, path.join(e.root, 'different'), {
      runtimeBinding: true,
      approved_plan_hash: planHash(e.plan),
    });
  assert.equal(result.status, 'FAIL_ASSERTION', JSON.stringify(result.error));
  assert.equal(result.assertions.at(-1).expected, '50');
  assert.equal(result.assertions.at(-1).actual, '60');
});

test('current page mismatch is not rescued by finding a similarly named control', async (t) => {
  const e = await environment(t);
  await e.session.loginPage.locator('h1').evaluate((e) => (e.textContent = '别的页面'));
  await assert.rejects(
    runtimeIntentHandles(e.session.loginPage, e.plan.steps[0].checkpoints[0].actions[0].target),
    { code: 'BINDING_PAGE_MISMATCH' },
  );
});

test('disabling feature blocks approval even for a persisted accepted candidate', async (t) => {
  const e = await environment(t),
    controller = new Controller({
      store: e.store,
      provider: providerFor(e.c, e.plan),
      browser: e.session,
      runtimeBinding: true,
    });
  await controller.confirmCase(e.id, e.c.case_id, { steps: e.c.steps });
  await controller.launch(e.id, 'intent-plan', [e.c.case_id]);
  await controller.active.finished;
  controller.runtimeBinding = false;
  await assert.rejects(controller.approvePlan(e.id, e.c.case_id, planHash(e.plan)), {
    code: 'RUNTIME_BINDING_DISABLED',
  });
});

test('node replacement after persisted intent never clicks the replacement or replays', async (t) => {
  const e = await environment(t);
  let executionPage,
    intents = 0;
  const context = e.session.context.bind(e.session);
  e.session.context = async (...args) => {
    const result = await context(...args);
    result.on('page', (p) => (executionPage = p));
    return result;
  };
  const result = await e.session.execute(e.task, e.c, e.plan, path.join(e.root, 'stale'), {
    runtimeBinding: true,
    approved_plan_hash: planHash(e.plan),
    onEvent: async (event) => {
      if (event.type === 'ACTION_STARTED') {
        intents++;
        await executionPage
          .locator('article button')
          .evaluate((e) => e.replaceWith(e.cloneNode(true)));
      }
    },
  });
  assert.equal(result.error, 'BINDING_STALE');
  assert.equal(intents, 1);
  assert.equal(
    result.actions.some((a) => a.dispatched),
    false,
  );
});

test('action callback mutates identity between pointer events: guarded click is blocked', async (t) => {
  const e = await environment(t);
  const context = e.session.context.bind(e.session);
  e.session.context = async (...args) => {
    const result = await context(...args);
    await result.addInitScript(() =>
      document.addEventListener('pointerdown', (e) => {
        if (e.target.closest('article'))
          document.querySelector('article h2').textContent = '设备 B / D002';
      }),
    );
    return result;
  };
  const result = await e.session.execute(e.task, e.c, e.plan, path.join(e.root, 'recycled'), {
    runtimeBinding: true,
    approved_plan_hash: planHash(e.plan),
  });
  assert.equal(result.error, 'BINDING_STALE');
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].status, 'UNKNOWN');
  assert.equal(result.bindings.length, 1, 'never rebind after dispatch');
});

test('API config default off; opt-in console shows scoped approval warning at narrow and desktop widths', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-console-'));
  const app = await start({
    port: 0,
    dataDir: root,
    headless: true,
    runtimeBinding: 'readonly',
    provider: { configured: () => false },
  });
  t.after(() => app.close());
  const config = await (await fetch(app.url + '/api/config')).json();
  assert.equal(config.runtime_binding, true);
  const { c, plan } = fixture(),
    id = await app.store.create({
      name: '意图控制台',
      target: 'http://localhost/',
      baseline: { cases: [c] },
    });
  await app.store.update(id, (s) => {
    s.cases[0].plan = plan;
    s.cases[0].intent_preparation = {
      input_review: { issues: [] },
      audit: { outcome: 'ACCEPT', checks: [] },
    };
    s.cases[0].reviewed = true;
    s.cases[0].status = 'PLAN_REVIEW';
  });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(app.url + '/#task=' + id);
  await page.locator('[data-case]').waitFor();
  assert.equal(await page.locator('#intent-plan').count(), 1);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-case]').click();
    await page.locator('[data-runtime-plan]').waitFor();
    assert.match(await page.locator('[data-intent-review]').innerText(), /意图审查记录/);
    assert.doesNotMatch(await page.locator('#modal').innerText(), /历史\/预置计划/);
    assert.match(await page.locator('#modal').innerText(), /用户原稿和模型候选都可能有误/);
    assert.match(await page.locator('#modal').innerText(), /设备 A \/ D001/);
    const before = await page.evaluate(() => scrollY);
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => scrollY), before);
    await page.screenshot({ path: path.join(root, 'intent-' + width + '.png'), fullPage: true });
    await page.locator('[data-runtime-plan]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(root, 'notice-' + width + '.png') });
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors, []);
  const offRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-off-'));
  const off = await start({
    port: 0,
    dataDir: offRoot,
    headless: true,
    runtimeBinding: 'off',
    provider: { configured: () => false },
  });
  t.after(() => off.close());
  assert.equal((await (await fetch(off.url + '/api/config')).json()).runtime_binding, false);
  console.log('intent console artifacts:', root);
});
