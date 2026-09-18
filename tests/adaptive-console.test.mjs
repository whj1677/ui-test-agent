import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// The real console DOM/CSS with synthetic API replies only. No server, user
// task, filesystem outputs, model requests or protocol implementation is used.
const [html, css, source] = await Promise.all([
  fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
]);
const script =
  source.slice(0, source.lastIndexOf('await action(() => refresh(true));')) +
  `
globalThis.consoleFixture = {
  set(task, settings, selection) {
    state = task; config = settings; current = task.id; selected = new Set(selection);
    outputSyncAt = Date.now(); outputConnectionError = false; render();
  },
  workflow: workflowState, planHTML, approveSelected,
  submit: (caseIds) => startPreparedSelection(current, caseIds),
  refresh: () => refresh(true),
  eventNames, reasonText, eventText,
};`;
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});

const step = {
  step_id: 'S1',
  action: '查看目标设备',
  expected: '显示目标设备',
  obligations: [{ id: 'O1', text: '显示目标设备' }],
};
function row(case_id = 'C1', overrides = {}) {
  return {
    case_id,
    status: 'NEEDS_MAPPING',
    reviewed: true,
    attempts: [],
    issues: [],
    repair_count: 0,
    plan: null,
    plan_approved: false,
    confirmations: [],
    original: { case_id, title: `设备测试 ${case_id}`, steps: [step] },
    effective: { case_id, title: `设备测试 ${case_id}`, steps: [step] },
    obligation_draft: [step],
    ...overrides,
  };
}
const adaptive = () => ({
  schema_version: 'ui-agent-adaptive-plan/v1',
  steps: [
    {
      step_id: 'S1',
      source_action: step.action,
      source_expected: step.expected,
      obligations: step.obligations,
    },
  ],
});
const fixed = () => ({
  schema_version: 'ui-agent-plan/v2',
  entry_path: '/',
  data_effect: 'read_only',
  steps: [
    {
      step_id: 'S1',
      source_action: step.action,
      source_expected: step.expected,
      within_ms: 1000,
      actions: [],
      assertions: [],
    },
  ],
  preconditions: [],
  cleanup: null,
});

async function fixture(t, { rows = [row()], config = {}, task = {}, width = 1280, selected } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  });
  t.after(() => context.close());
  const state = {
    id: 'synthetic',
    name: '只读直接测试',
    target: 'http://fixture.invalid/',
    status: 'IDLE',
    revision: 1,
    active: null,
    authenticated: false,
    browser_open: false,
    authorization: { writes: false, nonproduction: true, readOnlyEndpoints: [] },
    cases: rows,
    snapshots: [],
    events: [],
    site_cleanup_blockers: [],
    ...task,
  };
  const settings = {
    version: 'local-test',
    configured: true,
    model: 'synthetic',
    planning_mode: 'adaptive',
    direct_testing: true,
    autonomous_preparation: true,
    preparation_controls: true,
    login_recovery: true,
    labels: {},
    ...config,
  };
  const posts = [],
    errors = [];
  let jobWait = null;
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await context.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      pathname = url.pathname;
    const respond = (body) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: html.replace('__CSRF__', 'synthetic'),
      });
    if (pathname === '/styles.css') return route.fulfill({ contentType: 'text/css', body: css });
    if (pathname === '/app.js')
      return route.fulfill({ contentType: 'text/javascript', body: script });
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      posts.push({ pathname, body });
      if (pathname.endsWith('/confirm')) {
        const r = state.cases.find((r) => r.case_id === body.case_id);
        r.reviewed = true;
        r.effective.steps = body.steps;
        state.revision++;
        return respond({ confirmed: true });
      }
      if (pathname.endsWith('/job')) {
        if (jobWait) await jobWait;
        state.active = { kind: body.kind, stage: 'ADAPTIVE_OBSERVED', calls: 0 };
        return respond({ started: true });
      }
      if (pathname.endsWith('/login-evidence'))
        return respond({ token: 'synthetic', markers: [{ name: '设备首页', role: 'heading' }] });
      if (pathname.endsWith('/login-confirmation')) {
        state.authenticated = true;
        state.active.stage = 'ADAPTIVE_OBSERVED';
        return respond({ authenticated: true, preparation_resumed: true });
      }
      return respond({});
    }
    if (pathname === '/api/config') return respond(settings);
    if (pathname === '/api/tasks')
      return respond([{ id: state.id, name: state.name, total: rows.length }]);
    if (pathname === '/api/tasks/synthetic') return respond(state);
    if (pathname.endsWith('/diagnostics')) return respond({ records: [] });
    return route.abort();
  });
  await page.goto('http://adaptive-console.test/');
  await page.waitForFunction(() => !!globalThis.consoleFixture);
  const selection = selected ?? rows.map((r) => r.case_id);
  const render = () =>
    page.evaluate(
      ({ state, settings, selection }) => consoleFixture.set(state, settings, selection),
      { state, settings, selection },
    );
  await render();
  t.after(() => assert.deepEqual(errors, [], 'no console page errors'));
  return {
    page,
    state,
    settings,
    selection,
    posts,
    render,
    holdJob() {
      let release;
      jobWait = new Promise((r) => {
        release = r;
      });
      return release;
    },
  };
}
const waitPosts = (x, path) =>
  x.page.waitForFunction(
    (path) => document.querySelector('#toast')?.textContent.includes(path),
    path,
  );

test('direct testing has three stages, one primary action and no pre-emptive login gate', async (t) => {
  const x = await fixture(t),
    { page } = x;
  assert.deepEqual(await page.locator('.workflow-steps strong').allTextContents(), [
    '核对用例',
    '执行测试',
    '结果',
  ]);
  assert.equal(await page.locator('#guided-workflow .primary').count(), 1);
  assert.equal(await page.locator('#test-main').isEnabled(), true);
  assert.ok(!(await page.locator('#workflow-summary').innerText()).match(/已探索|已生成计划/));
  assert.equal(await page.locator('#preparation-tools .discovery-status').count(), 1);
  assert.equal(await page.locator('#approve').isDisabled(), true);
  assert.equal(await page.locator('#run').isDisabled(), true);
});

test('keyboard start sends test with original prepare options; duplicate submission is locked', async (t) => {
  const options = { concurrency: 2, independent_readonly: true, time_multiplier: 2 };
  const x = await fixture(t, { task: { preparation: { options, case_ids: [], workers: {} } } });
  const release = x.holdJob();
  await x.page.locator('#test-main').focus();
  await x.page.keyboard.press('Enter');
  await x.page.waitForFunction(
    () => document.querySelector('#test-main')?.textContent === '正在提交…',
  );
  assert.equal(await x.page.locator('#test-main').getAttribute('aria-busy'), 'true');
  assert.equal(await x.page.locator('#test-main').isDisabled(), true);
  await x.page.evaluate(() => consoleFixture.submit(['C1']));
  release();
  await waitPosts(x, '已开始测试');
  assert.deepEqual(
    x.posts.filter((p) => p.pathname.endsWith('/job')).map((p) => p.body),
    [{ kind: 'test', case_ids: ['C1'], options }],
  );
  assert.equal(
    x.posts.some((p) => p.pathname.endsWith('/approve')),
    false,
  );
});

test('confirming the original case directly starts test, even without autonomous preparation support', async (t) => {
  const x = await fixture(t, {
    rows: [row('C1', { reviewed: false, status: 'NEEDS_REVIEW' })],
    config: { autonomous_preparation: false },
  });
  await x.page.locator('#confirm-main').click();
  assert.equal(await x.page.locator('#confirm-all').innerText(), '确认用例并开始测试');
  await x.page.locator('#confirm-all').click();
  await waitPosts(x, '已开始测试');
  assert.deepEqual(
    x.posts.map((p) => p.pathname.split('/').at(-1)),
    ['confirm', 'job'],
  );
  assert.equal(x.posts[1].body.kind, 'test');
});

test('pending adaptive contracts can re-enter test, with business goals shown and no approval', async (t) => {
  const x = await fixture(t, { rows: [row('C1', { plan: adaptive(), status: 'PLAN_REVIEW' })] });
  const content = await x.page.evaluate((p) => consoleFixture.planHTML(p), adaptive());
  assert.match(content, /技术步骤执行时决定，无需技术计划审批/);
  assert.match(content, /查看目标设备/);
  assert.match(content, /显示目标设备/);
  assert.match(await x.page.locator('tbody tr').innerText(), /业务合同已冻结/);
  await x.page.locator('#test-main').click();
  await waitPosts(x, '已开始测试');
  assert.equal(x.posts.at(-1).body.kind, 'test');
});

for (const [name, options] of [
  ['direct flag absent', { config: { direct_testing: undefined } }],
  ['fixed planning mode', { config: { planning_mode: 'single' } }],
  ['write authorization', { task: { authorization: { nonproduction: true, writes: true } } }],
  ['old fixed plan', { rows: [row('C1', { plan: fixed() })] }],
  ['mixed pending selection', { rows: [row(), row('C2', { plan: fixed() })] }],
])
  test(`${name} retains the five-stage workflow and never offers direct test`, async (t) => {
    const x = await fixture(t, options);
    assert.equal(await x.page.locator('.workflow-steps li').count(), 5);
    assert.equal(await x.page.locator('#test-main').count(), 0);
    assert.equal(x.posts.length, 0);
  });

test('fixed and adaptive contracts cannot be approved together through the legacy helper', async (t) => {
  const x = await fixture(t, {
    rows: [row('C1', { plan: fixed() }), row('C2', { plan: adaptive() })],
  });
  assert.equal(await x.page.locator('#approve').isDisabled(), true);
  await x.page.evaluate(() => consoleFixture.approveSelected());
  assert.equal(x.posts.length, 0);
  await x.page.locator('#workflow-select-plans').click();
  assert.equal(await x.page.locator('#approve-main').isEnabled(), true);
  assert.deepEqual(
    await x.page.evaluate(() => consoleFixture.workflow().pending.map((r) => r.case_id)),
    ['C1'],
  );
});

test('legacy prepare and approved fixed run still submit their original job kinds', async (t) => {
  const prepare = await fixture(t, { config: { direct_testing: false, planning_mode: 'single' } });
  await prepare.page.locator('#prepare').click();
  await waitPosts(prepare, '已开始自动准备');
  assert.equal(prepare.posts.at(-1).body.kind, 'prepare');
  const run = await fixture(t, {
    rows: [row('C1', { plan: fixed(), plan_approved: true })],
    task: { authenticated: true },
  });
  const response = run.page.waitForResponse((r) => r.url().endsWith('/job'));
  await run.page.locator('#run-main').click();
  await response;
  assert.equal(run.posts.at(-1).body.kind, 'run');
});

test('authorization or fixed-plan changes in fresh state block a stale direct start', async (t) => {
  const x = await fixture(t);
  x.state.cases[0].plan = fixed();
  await x.page.locator('#test-main').click();
  await waitPosts(x, '所选用例或授权已变化');
  assert.equal(x.posts.length, 0);
});

test('active test login waits reuse the existing confirmation controls without restarting the job', async (t) => {
  const x = await fixture(t, {
    task: { browser_open: true, active: { kind: 'test', stage: 'WAITING_USER_LOGIN' } },
  });
  await x.page.locator('#workflow-confirm-login').click();
  await x.page.locator('#confirm-login-evidence:enabled').waitFor();
  assert.match(await x.page.locator('#login-marker-fields').innerText(), /继续已授权的原测试任务/);
  await x.page.locator('#confirm-login-evidence').click();
  await waitPosts(x, '已确认登录');
  assert.deepEqual(
    x.posts.map((p) => p.pathname.split('/').at(-1)),
    ['login-evidence', 'login-confirmation'],
  );
});

test('changing selection to a fixed plan does not hide the active test login recovery control', async (t) => {
  const x = await fixture(t, {
    rows: [row('C1', { plan: fixed() })],
    task: {
      browser_open: true,
      active: { kind: 'test', stage: 'WAITING_USER_LOGIN' },
    },
  });
  assert.equal(await x.page.locator('#workflow-confirm-login').isEnabled(), true);
});

test('missing nonproduction authorization routes to environment settings, not a test job', async (t) => {
  const x = await fixture(t, { task: { authorization: { writes: false, nonproduction: false } } });
  assert.equal(await x.page.locator('#workflow-environment').isEnabled(), true);
  assert.equal(await x.page.locator('#test-main').count(), 0);
  assert.equal(x.posts.length, 0);
});

test('each adaptive runtime event has a Chinese user-facing label', async (t) => {
  const x = await fixture(t);
  const labels = await x.page.evaluate(() =>
    [
      'OBSERVED',
      'PLANNING',
      'SEGMENT_ACCEPTED',
      'REPLANNING',
      'STEP_COMPLETE',
      'BLOCKED',
      'CONTRACT_FROZEN',
    ].map((suffix) => consoleFixture.eventNames['ADAPTIVE_' + suffix]),
  );
  assert.equal(labels.length, 7);
  assert.ok(labels.every((label) => typeof label === 'string' && /[\u4e00-\u9fff]/u.test(label)));
  const blocked = await x.page.evaluate(() =>
    consoleFixture.eventText({
      type: 'ADAPTIVE_BLOCKED',
      message: '当前页面缺少唯一设备身份',
    }),
  );
  assert.match(blocked, /当前技术步骤受阻.*当前页面缺少唯一设备身份/);
});

test('adaptive errors explain blocked execution in Chinese without relaxing write scope', async (t) => {
  const x = await fixture(t);
  const messages = await x.page.evaluate(() =>
    Object.fromEntries(
      [
        'MODEL_BLOCKED',
        'NO_PROGRESS',
        'SEGMENT_LIMIT',
        'SEGMENT_REJECTED',
        'READ_ONLY_REQUIRED',
        'REVIEW_REQUIRED',
        'MODEL_REQUIRED',
      ].map((suffix) => [suffix, consoleFixture.reasonText('ADAPTIVE_' + suffix)]),
    ),
  );
  assert.equal(Object.keys(messages).length, 7);
  assert.ok(Object.values(messages).every((message) => /[\u4e00-\u9fff]/u.test(message)));
  assert.match(messages.MODEL_BLOCKED, /具体缺口/);
  assert.match(messages.READ_ONLY_REQUIRED, /写入任务请使用原固定计划通道/);
  assert.match(messages.READ_ONLY_REQUIRED, /不要解除或改写权限/);
});

test('completed attempts show results without implying all expectations passed', async (t) => {
  const x = await fixture(t, {
    rows: [
      row('C1', { attempts: [{ id: 'attempt' }], status: 'FAIL_ASSERTION', plan: adaptive() }),
    ],
  });
  assert.equal(await x.page.locator('#workflow-report').isEnabled(), true);
  assert.match(await x.page.locator('#workflow-detail').innerText(), /不代表全部预期满足/);
  assert.equal(
    await x.page.locator('.workflow-steps [aria-current=step] strong').innerText(),
    '结果',
  );
});

test('null plans and adaptive source text render safely without fixed locator fields', async (t) => {
  const x = await fixture(t);
  const text = await x.page.evaluate(() => ({
    empty: consoleFixture.planHTML(null),
    contract: consoleFixture.planHTML({
      schema_version: 'ui-agent-adaptive-plan/v1',
      steps: [
        { step_id: 'S1', source_action: '<img onerror=x>', source_expected: '<script>x</script>' },
      ],
    }),
  }));
  assert.match(text.empty, /尚未生成计划/);
  assert.ok(!text.contract.includes('<img') && !text.contract.includes('<script>'));
  assert.match(text.contract, /&lt;img/);
});

test('375px layout preserves disclosure focus and scroll across progress refreshes', async (t) => {
  const x = await fixture(t, {
    width: 375,
    task: { active: { kind: 'test', stage: 'ADAPTIVE_PLANNING', calls: 1 } },
  });
  const summary = x.page.locator('#adaptive-preparation-history > summary');
  await summary.click();
  await summary.focus();
  const before = await x.page.evaluate(() => ({
    y: scrollY,
    top: document.activeElement.getBoundingClientRect().top,
  }));
  x.state.active.calls = 2;
  x.state.active.stage = 'ADAPTIVE_SEGMENT_ACCEPTED';
  await x.render();
  const after = await x.page.evaluate(() => ({
    y: scrollY,
    top: document.activeElement.getBoundingClientRect().top,
    focus: document.activeElement.parentElement.id,
    open: document.querySelector('#adaptive-preparation-history').open,
    width: document.querySelector('#guided-workflow').getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(after.focus, 'adaptive-preparation-history');
  assert.equal(after.open, true);
  assert.ok(Math.abs(after.y - before.y) < 2);
  assert.ok(Math.abs(after.top - before.top) < 2);
  assert.ok(after.width <= 375);
  assert.equal(after.overflow, false);
  assert.match(await x.page.locator('#agent-output').innerText(), /当前操作与检查已独立核验/);
  assert.equal(await x.page.locator('#guided-workflow .primary').count(), 1);
  if (process.env.ADAPTIVE_CONSOLE_SCREENSHOTS === '1') {
    const directory = new URL('../validation/req0017/', import.meta.url);
    await fs.mkdir(directory, { recursive: true });
    await summary.click();
    for (const width of [375, 1280]) {
      await x.page.setViewportSize({ width, height: 900 });
      await x.page.evaluate(() => scrollTo(0, 0));
      await x.page.screenshot({
        path: fileURLToPath(new URL(`adaptive-console-${width}.png`, directory)),
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
});
