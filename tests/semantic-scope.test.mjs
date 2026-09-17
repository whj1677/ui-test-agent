import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import http from 'node:http';
import { snapshot, perform, BrowserSession, checkAssertionGroup } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { runtimeLocator } from '../src/row-locator.mjs';
import { validateLocator, validateRepair } from '../src/plans.mjs';
import { semanticHash } from '../src/common.mjs';
import { demoCases } from '../src/demo.mjs';
import { recoveryKind, recoveryEvidence, usefulProbe } from '../src/recovery-gap.mjs';
import { repairablePlanError } from '../src/plan-quality.mjs';
import { startFixture } from '../acceptance/serve.mjs';
import { captureWithinGuard, releaseWithinGuard } from '../src/within-locator.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';

const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const within = (scope, target) => ({ kind: 'within', scope, ...(target ? { target } : {}) });
async function pageFor(t, html) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  if (html) await page.setContent(html);
  return page;
}

test('frozen card site exposes all repeated detail actions with exact container identities', async (t) => {
  const fixture = await startFixture({ site: 'work-orders' });
  t.after(() => fixture.close());
  const page = await pageFor(t);
  await page.goto(fixture.origin);
  await page.getByRole('button', { name: '进入演示', exact: true }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).waitFor();
  await page.goto(fixture.origin + '#/orders');
  await page.locator('#order-list[aria-busy=false]').waitFor();
  const controls = (await snapshot(page)).controls.filter((c) => c.name === '查看详情');
  assert.equal(controls.length, 3);
  assert.ok(controls.every((c) => c.locator.kind === 'within'));
  assert.deepEqual(
    controls.map((c) => c.locator.scope.name),
    ['WO-101 送风机巡检', 'WO-102 电表核验', 'WO-103 水泵检修'],
  );
  await perform(page, { op: 'click', target: controls[1].locator }, fixture.origin);
  assert.match(
    await page.getByRole('dialog', { name: '工单详情', exact: true }).innerText(),
    /WO-102/,
  );
  const drawer = await snapshot(page);
  const service = drawer.controls.find((c) => c.name === '服务说明' && c.role === 'button');
  assert.equal(service.locator.scope.name, '工单详情');
  await perform(page, { op: 'click', target: service.locator }, fixture.origin);
  const layered = await snapshot(page);
  const close = layered.controls.filter((c) => c.name === '关闭' && c.role === 'button');
  assert.equal(close.length, 1);
  assert.equal(close[0].locator.scope.name, '服务说明');
  await perform(page, { op: 'click', target: close[0].locator }, fixture.origin);
  assert.equal(
    await page.getByRole('dialog', { name: '服务说明', exact: true }).isVisible(),
    false,
  );
  assert.equal(await page.getByRole('dialog', { name: '工单详情', exact: true }).isVisible(), true);
});
test('frozen request list scopes near-name edit/delete actions by own heading, not substring', async (t) => {
  const fixture = await startFixture({ site: 'requests' });
  t.after(() => fixture.close());
  const page = await pageFor(t);
  await page.goto(fixture.origin);
  await page.getByRole('button', { name: '进入演示', exact: true }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).waitFor();
  await page.goto(fixture.origin + '#/requests');
  await page.locator('li.record').first().waitFor();
  const controls = (await snapshot(page)).controls.filter((c) => ['编辑', '删除'].includes(c.name));
  assert.equal(controls.length, 4);
  assert.ok(
    controls.every((c) => c.locator.kind === 'within' && c.locator.scope.role === 'listitem'),
  );
  const edit = controls.find(
    (c) => c.name === '编辑' && c.locator.scope.heading === '例行工具申请',
  );
  await perform(page, { op: 'click', target: edit.locator }, fixture.origin);
  assert.match(
    await page.getByRole('dialog', { name: '编辑申请', exact: true }).innerText(),
    /例行工具申请/,
  );
  assert.equal(fixture.inspect().mutations.length, 0);
});
test('within schema is one-level, exact, bounded and has a single identity mode', () => {
  assert.doesNotThrow(() =>
    validateLocator(within({ role: 'article', name: 'A', exact: true }, role('button', '详情'))),
  );
  assert.doesNotThrow(() =>
    validateLocator(within({ role: 'listitem', heading: '甲', exact: true })),
  );
  for (const bad of [
    within({ role: 'listitem', heading: '甲', name: '甲', exact: true }),
    within({ role: 'button', name: 'A', exact: true }),
    within({ role: 'article', name: 'A', exact: false }),
    within({ role: 'article', name: '', exact: true }),
    within({ role: 'article', name: 'A', exact: true, index: 0 }),
    within(
      { role: 'article', name: 'A', exact: true },
      within({ role: 'article', name: 'B', exact: true }),
    ),
    within(
      { role: 'article', name: 'A', exact: true },
      { kind: 'row', table: role('table', 'T'), key: { column: 'ID', value: '1' } },
    ),
  ])
    assert.throws(() => validateLocator(bad));
});
test('current unnamed listitems can be resolved with exact heading ownership', async (t) => {
  const page = await pageFor(
    t,
    '<ul><li><h2>申请甲</h2><button>编辑</button></li><li><h2>申请甲（勿删）</h2><button>编辑</button></li></ul>',
  );
  const locator = within(
    { role: 'listitem', heading: '申请甲', exact: true },
    role('button', '编辑'),
  );
  assert.equal(await runtimeLocator(page, locator).count(), 1);
  assert.equal(
    await runtimeLocator(page, locator).evaluate(
      (e) => e.closest('li').querySelector('h2').textContent,
    ),
    '申请甲',
  );
});

test('ambiguous containers, hidden collisions, borrowed headings and foreign targets are refused', async (t) => {
  const page = await pageFor(t);
  const samples = [
    [
      '<article aria-label="A"><button>编辑</button></article><article aria-label="A" hidden><button>编辑</button></article>',
      { role: 'article', name: 'A', exact: true },
      'WITHIN_SCOPE_NOT_UNIQUE',
    ],
    [
      '<li><h2>A</h2><button>编辑</button></li><li><h2>A</h2><button>编辑</button></li>',
      { role: 'listitem', heading: 'A', exact: true },
      'WITHIN_SCOPE_NOT_UNIQUE',
    ],
    [
      '<li><article><h2>A</h2></article><button>编辑</button></li>',
      { role: 'listitem', heading: 'A', exact: true },
      'WITHIN_IDENTITY_UNOWNED',
    ],
    [
      '<article aria-label="A"><li><button>编辑</button></li></article>',
      { role: 'article', name: 'A', exact: true },
      'WITHIN_TARGET_UNOWNED',
    ],
    [
      '<article aria-label="A"><button>编辑</button><button>编辑</button></article>',
      { role: 'article', name: 'A', exact: true },
      'WITHIN_TARGET_NOT_UNIQUE',
    ],
  ];
  for (const [html, scope, code] of samples) {
    await page.setContent(html);
    await assert.rejects(runtimeLocator(page, within(scope, role('button', '编辑'))).count(), {
      code,
    });
  }
});

test('dialog fields retain exact native labels and custom adapters cannot change their identity', async (t) => {
  const page = await pageFor(
    t,
    '<dialog open aria-label="设置"><label>区域<select><option>全部</option><option>西区</option></select></label><label>状态<select><option>正常</option></select></label></dialog>',
  );
  const observation = await snapshot(page);
  const field = observation.controls.find((c) => c.name === '区域');
  assert.equal(field.locator.kind, 'within');
  assert.equal(field.locator.scope.name, '设置');
  await perform(page, { op: 'select', target: field.locator, value: '西区' }, 'http://localhost');
  assert.equal(
    await page.getByRole('combobox', { name: '区域', exact: true }).inputValue(),
    '西区',
  );
  const wrong = await snapshot(page, {
    adapterSource:
      'export function locate(element) { return {kind:"role",role:"combobox",name:"状态",exact:true}; }',
  });
  assert.ok(!wrong.controls.some((c) => c.name === '区域'));
  assert.ok(wrong.adapter_gaps.some((g) => g.code === 'ADAPTER_TARGET_IDENTITY_MISMATCH'));
});

test('event-time guard refuses recycled, moved or newly duplicated business identities before click', async (t) => {
  const page = await pageFor(t);
  for (const mode of ['rename', 'move', 'duplicate']) {
    await page.setContent(
      '<article aria-label="A"><h2>甲</h2><button>编辑</button></article><article aria-label="B"><h2>乙</h2></article>',
    );
    await page.evaluate((mode) => {
      window.businessClicks = 0;
      const button = document.querySelector('button');
      button.addEventListener('click', () => window.businessClicks++);
      button.addEventListener(
        'pointerdown',
        () => {
          const root = button.closest('article');
          if (mode === 'rename') root.setAttribute('aria-label', 'C');
          else if (mode === 'move') document.querySelectorAll('article')[1].append(button);
          else document.body.append(root.cloneNode(true));
        },
        { once: true },
      );
    }, mode);
    await assert.rejects(
      perform(
        page,
        {
          op: 'click',
          target: within({ role: 'article', name: 'A', exact: true }, role('button', '编辑')),
        },
        'http://localhost',
      ),
      { code: 'WITHIN_SCOPE_CHANGED' },
    );
    assert.equal(await page.evaluate(() => window.businessClicks), 0, mode);
  }
});

test('guard allows reorder of the same objects and releases listeners after refusal', async (t) => {
  const page = await pageFor(
    t,
    '<ul><li><h2>甲</h2><button>编辑</button></li><li><h2>乙</h2></li></ul>',
  );
  const target = within({ role: 'listitem', heading: '甲', exact: true }, role('button', '编辑'));
  const handle = await runtimeLocator(page, target).elementHandle();
  const guard = await captureWithinGuard(page, target, handle);
  await page.evaluate(() => document.querySelector('ul').append(document.querySelector('li')));
  assert.equal(await guard.evaluate((s) => s.arm()), true);
  await page.evaluate(() => {
    window.businessClicks = 0;
    document.querySelector('button').onclick = () => window.businessClicks++;
  });
  await handle.click();
  assert.equal(await guard.evaluate((s) => s.blocked()), false);
  assert.equal(await page.evaluate(() => window.businessClicks), 1);
  await page.evaluate(
    () => (document.querySelector('button').closest('li').querySelector('h2').textContent = '丙'),
  );
  await handle.click();
  assert.equal(await guard.evaluate((s) => s.blocked()), true);
  assert.equal(await page.evaluate(() => window.businessClicks), 1);
  await releaseWithinGuard(guard);
  await handle.dispose();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  assert.equal(await page.evaluate(() => window.businessClicks), 2);
});

test('identity cannot change in the guard capture handshake and become its new baseline', async (t) => {
  const page = await pageFor(t, '<article aria-label="A"><button>编辑</button></article>');
  const locator = within({ role: 'article', name: 'A', exact: true }, role('button', '编辑'));
  const handle = await runtimeLocator(page, locator).elementHandle();
  const evaluateHandle = handle.evaluateHandle.bind(handle);
  handle.evaluateHandle = async (...args) => {
    await page.locator('article').evaluate((e) => e.setAttribute('aria-label', 'B'));
    return evaluateHandle(...args);
  };
  let captured;
  try {
    await assert.rejects(
      async () => {
        captured = await captureWithinGuard(page, locator, handle);
      },
      { code: 'WITHIN_SCOPE_CHANGED' },
    );
  } finally {
    await releaseWithinGuard(captured);
    await handle.dispose();
  }
});

test('keyboard submission is refused when the owned record identity changes on keydown', async (t) => {
  const page = await pageFor(
    t,
    '<article aria-label="A"><form><label>名称<input></label><button>保存</button></form></article>',
  );
  await page.evaluate(() => {
    window.submissions = 0;
    document.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      window.submissions++;
    };
    document.querySelector('input').onkeydown = () =>
      document.querySelector('article').setAttribute('aria-label', 'B');
  });
  const target = within(
    { role: 'article', name: 'A', exact: true },
    { kind: 'label', value: '名称', exact: true },
  );
  await assert.rejects(perform(page, { op: 'press', target, value: 'Enter' }, 'http://localhost'), {
    code: 'WITHIN_SCOPE_CHANGED',
  });
  assert.equal(await page.evaluate(() => window.submissions), 0);
});

test('scope semantics need original identity and observed structure, never page-derived expected values', () => {
  const scoped = within(
    { role: 'listitem', heading: '申请甲', exact: true },
    role('button', '编辑'),
  );
  const c = { steps: [{ action: '编辑申请甲', expected: '金额为330' }] };
  const plan = { steps: [{ actions: [{ op: 'click', target: scoped }], assertions: [] }] };
  const context = { pages: [{ controls: [{ locator: scoped }] }] };
  assert.doesNotThrow(() => requirePlanSemantics(plan, c, context));
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_SCOPE_EVIDENCE_MISSING' });
  const template = structuredClone(context);
  template.pages[0].controls[0].locator.scope.heading = '旧种子';
  assert.doesNotThrow(() => requirePlanSemantics(plan, c, template));
  const wrong = structuredClone(plan);
  wrong.steps[0].actions[0].target.scope.heading = '其他申请';
  assert.throws(() => requirePlanSemantics(wrong, c, context), {
    code: 'PLAN_SCOPE_IDENTITY_UNSUPPORTED',
  });
  plan.steps[0].assertions = [{ target: scoped, check: 'number', expected: 300 }];
  assert.throws(() => requirePlanSemantics(plan, c, context), {
    code: 'PLAN_ASSERTION_VALUE_UNSUPPORTED',
  });
  plan.steps[0].assertions = [];
  plan.cleanup = {
    identity: '申请乙',
    ownership: [{ target: scoped, check: 'visible' }],
    actions: [],
    assertions: [],
  };
  assert.throws(() => requirePlanSemantics(plan, c, context), {
    code: 'CLEANUP_SCOPE_IDENTITY_MISMATCH',
  });
});

async function discoveryFor(t, html, onEvent) {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') requests.push(req.method + ' ' + req.url);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<span data-testid="ready">Ready</span>' + html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const task = {
    id: 'scope-discovery',
    target: `http://127.0.0.1:${server.address().port}`,
    authorization: { writes: false, readOnlyEndpoints: [] },
  };
  const session = new BrowserSession({ headless: true });
  let discovery;
  t.after(async () => {
    await discovery?.close();
    await session.close();
    await new Promise((r) => server.close(r));
  });
  await session.open(task);
  await session.authenticate(task, { kind: 'testid', value: 'ready' });
  discovery = new DiscoveryBrowser(session, task, { onEvent });
  const observed = await discovery.open();
  return { discovery, observed, requests };
}

test('discovery exposes separate scoped opaque candidates and does not authorize destructive controls', async (t) => {
  const { discovery, observed } = await discoveryFor(
    t,
    '<article aria-label="A"><button onclick="document.querySelector(\'output\').textContent=\'A\'">查看详情</button><button>删除</button></article><article aria-label="B"><button onclick="document.querySelector(\'output\').textContent=\'B\'">查看详情</button></article><output></output>',
  );
  const details = observed.candidates.filter((c) => c.name === '查看详情');
  assert.equal(details.length, 2);
  assert.equal(new Set(details.map((c) => c.candidate_id)).size, 2);
  assert.ok(!observed.candidates.some((c) => c.name === '删除'));
  const chosen = details.find((c) => c.locator.scope.name === 'B');
  const next = await discovery.act({ candidate_id: chosen.candidate_id });
  assert.equal(await discovery.page.locator('output').textContent(), 'B');
  assert.ok(next.snapshot);
});

test('discovery refuses identity changes during evidence callbacks without any business click', async (t) => {
  let current;
  const { discovery, observed } = await discoveryFor(
    t,
    '<article aria-label="A"><button onclick="document.querySelector(\'output\').textContent=\'clicked\'">查看详情</button></article><output></output>',
    async (event) => {
      if (event.type === 'DISCOVERY_ACTION_BEFORE')
        await current.page.locator('article').evaluate((e) => e.setAttribute('aria-label', 'B'));
    },
  );
  current = discovery;
  const candidate = observed.candidates.find((c) => c.name === '查看详情');
  await assert.rejects(discovery.act({ candidate_id: candidate.candidate_id }), (e) =>
    ['DISCOVERY_STALE_PAGE', 'WITHIN_SCOPE_CHANGED'].includes(e.code),
  );
  assert.equal(await discovery.page.locator('output').textContent(), '');
});

test('scoped discovery actions remain behind the existing network write guard', async (t) => {
  const { discovery, observed, requests } = await discoveryFor(
    t,
    '<article aria-label="A"><button onclick="fetch(\'/mutation\',{method:\'POST\'}).catch(()=>{})">查看详情</button></article>',
  );
  const candidate = observed.candidates.find((c) => c.name === '查看详情');
  await assert.rejects(discovery.act({ candidate_id: candidate.candidate_id }), (e) =>
    /WRITE|NETWORK/.test(e.code),
  );
  assert.deepEqual(requests, []);
});

test('locator repair can change the inner technical binding but never the business scope', () => {
  const { baseline, plans } = demoCases();
  const plan = plans[0],
    original = baseline.cases[0];
  const action = plan.steps[0].actions[0];
  action.target = within({ role: 'listitem', heading: '申请甲', exact: true }, action.target);
  const failure = {
    action_id: action.action_id,
    code: 'LOCATOR_NOT_VISIBLE',
    phase: 'RESOLVE',
    dispatched: false,
    current_target: action.target,
  };
  const patch = {
    schema_version: 'ui-agent-locator-patch/v1',
    action_id: action.action_id,
    old_target_hash: semanticHash(action.target),
    target: within(action.target.scope, { kind: 'label', value: '商品名称', exact: true }),
  };
  assert.deepEqual(
    validateRepair(patch, plan, original, 'http://localhost', failure).target,
    patch.target,
  );
  for (const target of [
    within({ ...patch.target.scope, heading: '申请甲（勿删）' }, patch.target.target),
    patch.target.target,
  ])
    assert.throws(
      () => validateRepair({ ...patch, target }, plan, original, 'http://localhost', failure),
      { code: 'REPAIR_SCOPE_CHANGED' },
    );
  const changedCurrent = {
    ...failure,
    current_target: within({ ...action.target.scope, heading: '乙' }, action.target.target),
  };
  assert.throws(
    () =>
      validateRepair(
        { ...patch, old_target_hash: semanticHash(changedCurrent.current_target) },
        plan,
        original,
        'http://localhost',
        changedCurrent,
      ),
    { code: 'REPAIR_SCOPE_CHANGED' },
  );
});

test('scope diagnostics distinguish candidate repair from missing targeted evidence', () => {
  for (const code of ['PLAN_SCOPE_IDENTITY_UNSUPPORTED', 'CLEANUP_SCOPE_IDENTITY_MISMATCH']) {
    assert.equal(repairablePlanError(code), true);
    assert.equal(recoveryKind({ self_repair: { rounds: [{ code }] } }), 'PLAN_REPAIR_ONLY');
  }
  assert.equal(
    recoveryKind({ self_repair: { rounds: [{ code: 'PLAN_SCOPE_EVIDENCE_MISSING' }] } }),
    'TARGETED_EVIDENCE',
  );
  const locator = within(
    { role: 'listitem', heading: '申请甲', exact: true },
    role('button', '编辑'),
  );
  const reason = '缺少申请甲范围内的定位';
  assert.equal(
    recoveryEvidence(
      [{ url: '/records', controls: [{ role: 'button', name: '编辑', locator }] }],
      reason,
    ).length,
    1,
  );
  assert.equal(usefulProbe({ locator, count: 1, visible: true }, reason), true);
  assert.equal(usefulProbe({ locator, count: 1, visible: true }, '缺少别的页面'), false);
  assert.equal(repairablePlanError('WITHIN_SCOPE_CHANGED'), false);
});

test('atomic assertions bind the exact scoped object and distinguish missing from duplicate identities', async (t) => {
  const page = await pageFor(
    t,
    '<ul><li><h2>申请甲</h2><span data-testid="amount">300</span></li><li><h2>申请甲（勿删）</h2><span data-testid="amount">330</span></li></ul>',
  );
  const target = within(
    { role: 'listitem', heading: '申请甲', exact: true },
    { kind: 'testid', value: 'amount' },
  );
  const result = await checkAssertionGroup(page, [{ target, check: 'text', expected: '330' }], {
    timeout: 100,
  });
  assert.equal(result[0].passed, false);
  assert.equal(result[0].actual, '300');
  await page
    .locator('li')
    .first()
    .evaluate((e) => e.remove());
  const absent = await checkAssertionGroup(
    page,
    [{ target: within(target.scope), check: 'count', expected: 0 }],
    { timeout: 100 },
  );
  assert.equal(absent[0].passed, true);
  await page.setContent('<li><h2>申请甲</h2></li><li><h2>申请甲</h2></li>');
  await assert.rejects(
    checkAssertionGroup(page, [{ target: within(target.scope), check: 'hidden' }], {
      timeout: 100,
    }),
    { code: 'WITHIN_SCOPE_NOT_UNIQUE' },
  );
});
