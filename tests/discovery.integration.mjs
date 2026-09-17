import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DeepSeek } from '../src/deepseek.mjs';
import { start as startServer } from '../src/server.mjs';
import { fixtureModelPhase, fixtureAuditReply } from './fixture-model.mjs';

// Independent local fixture, with real Chromium and injected provider replies.
// No demoCases plans, real model calls, pre-existing services or product sites.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(ROOT, 'validation'), { recursive: true });
const directory = await fs.mkdtemp(path.join(ROOT, 'validation', 'discovery-'));
const requests = [],
  modelCalls = [],
  mockFailures = [],
  manualTargetActions = [],
  uiErrors = [];
const baseline = {
  schema_version: 'local-discovery-fixture/v1',
  case_count: 2,
  cases: [
    {
      case_id: 'DISC-CATALOG-001',
      title: '商品目录展示查询字段',
      source_side: 'ui',
      preconditions: '已登录并位于首页。',
      steps: [
        {
          step_id: 'S1',
          action: '点击商品目录菜单。',
          expected: '显示商品名称查询字段。',
          requires_click: true,
        },
      ],
    },
    {
      case_id: 'DISC-TASK-001',
      title: '新增任务弹窗展示任务名称与负责人',
      source_side: 'ui',
      preconditions: '已登录并位于首页。',
      steps: [
        {
          step_id: 'S1',
          action: '点击任务管理菜单。',
          expected: '显示任务管理页面。',
          requires_click: true,
        },
        {
          step_id: 'S2',
          action: '点击新增任务，打开新增弹窗。',
          expected: '显示任务名称字段；显示负责人字段。',
          requires_click: true,
        },
      ],
    },
  ],
};
const confirmedSteps = (c) =>
  c.steps.map(({ requires_click, ...step }) => ({
    ...step,
    obligations: step.expected
      .split(/[；。]/u)
      .filter(Boolean)
      .map((text, i) => ({ id: `${step.step_id}-O${i + 1}`, text })),
  }));
const chrome =
  '<meta charset="utf-8"><title>探索集成测试业务站</title><style>body{font:16px sans-serif;padding:32px}nav{display:flex;gap:24px;margin:20px 0}label{display:block;margin:16px 0}input{display:block;margin-top:6px}button{padding:8px 14px}section[role=dialog]{border:1px solid #aaa;padding:24px;margin-top:24px}</style>';
const navigation =
  '<strong data-testid="signed-in">演示用户</strong><nav><a data-testid="catalog-menu" href="/catalog">商品目录</a><a data-testid="tasks-menu" href="/tasks">任务管理</a></nav>';
const fixture = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  requests.push({ at: new Date().toISOString(), method: req.method, path: url.pathname });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.method === 'POST' && url.pathname === '/session') {
    for await (const ignored of req) void ignored;
    res.writeHead(303, {
      'Set-Cookie': 'discovery_fixture_session=yes; Path=/; HttpOnly; SameSite=Lax',
      Location: '/home',
    });
    res.end();
    return;
  }
  if (!req.headers.cookie?.includes('discovery_fixture_session=yes')) {
    res.end(
      chrome +
        '<h1>演示登录</h1><form action="/session" method="post"><label>口令<input type="password" autocomplete="off"></label><button type="submit">进入演示</button></form>',
    );
    return;
  }
  if (url.pathname === '/api/save' || url.pathname === '/api/delete') {
    res.statusCode = 500;
    res.end('Unexpected business request');
    return;
  }
  if (url.pathname === '/home') {
    res.end(
      chrome +
        navigation +
        '<h1 data-testid="home-heading">首页</h1><p>请选择需要查看的业务模块。</p><script>localStorage.setItem("fixture_login","yes");sessionStorage.setItem("fixture_login","yes");</script>',
    );
    return;
  }
  if (url.pathname === '/catalog') {
    res.end(
      chrome +
        navigation +
        '<h1 data-testid="catalog-heading">商品目录</h1><label>商品名称<input data-testid="product-query" placeholder="按商品名称查询"></label><p>本用例只查看查询字段。</p>',
    );
    return;
  }
  if (url.pathname === '/tasks') {
    res.end(
      chrome +
        navigation +
        `<h1 data-testid="tasks-heading">任务管理</h1><button type="button" data-testid="task-add">新增任务</button><div id="modal-root"></div><script>
      document.querySelector('[data-testid="task-add"]').addEventListener('click',()=>{
        document.querySelector('#modal-root').innerHTML='<section role="dialog" aria-label="新增任务" data-testid="task-dialog"><h2>新增任务</h2><label>任务名称<input data-testid="task-name" placeholder="请输入任务名称"></label><label>负责人<input data-testid="task-owner" placeholder="请选择负责人"></label><button type="button" disabled data-testid="task-save">保存任务</button><button type="button" disabled data-testid="task-delete">删除任务</button><button type="button" data-testid="task-close">关闭</button></section>';
        document.querySelector('[data-testid="task-close"]').onclick=()=>document.querySelector('#modal-root').replaceChildren();
        for(const [testid,endpoint] of [['task-save','/api/save'],['task-delete','/api/delete']])document.querySelector('[data-testid="'+testid+'"]').onclick=()=>{window.fixtureWriteDispatched=true;fetch(endpoint,{method:'POST'});};
      });
    </script>`,
    );
    return;
  }
  res.statusCode = 404;
  res.end('Fixture route not found');
});

let releaseDiscovery, signalFirstDiscovery;
const discoveryGate = new Promise((resolve) => {
  releaseDiscovery = resolve;
});
const firstDiscovery = new Promise((resolve) => {
  signalFirstDiscovery = resolve;
});
async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const hasControl = (page, testid) =>
  page.controls.some(
    (control) => control.locator?.kind === 'testid' && control.locator.value === testid,
  );
function chooseDiscovery(input) {
  assert.ok(
    input.candidates.every((candidate) => !/[保存删除提交]/u.test(candidate.name)),
    'business writes must not be discovery candidates',
  );
  let name;
  if (input.case.case_id === 'DISC-CATALOG-001') {
    if (hasControl(input.current, 'product-query'))
      return { done: true, reason: '已采集商品菜单和商品名称查询字段。' };
    name = '商品目录';
  } else {
    assert.equal(input.case.case_id, 'DISC-TASK-001');
    if (hasControl(input.current, 'task-name') && hasControl(input.current, 'task-owner'))
      return { done: true, reason: '已采集新增任务入口、弹窗中的任务名称和负责人字段。' };
    name = new URL(input.current.url).pathname === '/tasks' ? '新增任务' : '任务管理';
  }
  const candidate = input.candidates.find((item) => item.name === name);
  assert.ok(candidate, `current candidates must contain ${name}`);
  return {
    action: { candidate_id: candidate.candidate_id },
    reason: `查看${name}以采集当前用例的页面事实。`,
  };
}
function makePlan(input) {
  const c = input.original;
  const locator = (testid) => {
    const found = input.pages
      .flatMap((page) => page.controls)
      .find((control) => control.locator?.kind === 'testid' && control.locator.value === testid);
    assert.ok(found, `planning requires observed ${testid}`);
    return structuredClone(found.locator);
  };
  const targets =
    c.case_id === 'DISC-CATALOG-001'
      ? [['catalog-menu', ['product-query']]]
      : [
          ['tasks-menu', ['tasks-heading']],
          ['task-add', ['task-name', 'task-owner']],
        ];
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: input.case_hash,
    entry_path: '/home',
    data_effect: 'read_only',
    preconditions: [{ target: locator('signed-in'), check: 'visible' }],
    steps: c.steps.map((step, index) => ({
      step_id: step.step_id,
      source_action: step.action,
      source_expected: step.expected,
      actions: [{ action_id: `A${index + 1}`, op: 'click', target: locator(targets[index][0]) }],
      assertion_mode: 'simultaneous',
      within_ms: 8000,
      assertions: step.obligations.map((obligation, i) => ({
        target: locator(targets[index][1][i]),
        check: 'visible',
        oracle_quote: obligation.text,
        obligation_ids: [obligation.id],
      })),
    })),
    cleanup: null,
    notes: '只打开页面和弹窗查看字段；不输入、不保存、不删除。',
  };
  return { plan };
}
const provider = new DeepSeek({
  key: 'fixture-discovery-secret-local-only',
  fetchImpl: async (url, options) => {
    try {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer fixture-discovery-secret-local-only');
      const body = JSON.parse(options.body),
        input = JSON.parse(body.messages[1].content);
      const phase = fixtureModelPhase(body.messages[0].content, input);
      const record = {
        at: new Date().toISOString(),
        purpose: input.purpose ?? (phase === 'plan' ? 'case_plan' : phase),
        case_id: input.case?.case_id ?? input.original?.case_id,
        input,
      };
      modelCalls.push(record);
      let value;
      if (input.purpose === 'case_ui_discovery') {
        assert.ok(input.current.controls.length);
        assert.ok(Array.isArray(input.candidates));
        if (modelCalls.filter((call) => call.purpose === 'case_ui_discovery').length === 1) {
          signalFirstDiscovery();
          await bounded(discoveryGate, 30000, 'UI did not observe the automatic discovery start');
        }
        value = chooseDiscovery(input);
      } else if (phase === 'input_review') value = { issues: [] };
      else if (phase === 'plan_audit')
        value = fixtureAuditReply(input.original, input.candidate_plan);
      else {
        assert.ok(input.original);
        assert.ok(input.pages.length);
        value = makePlan(input);
      }
      record.response = value;
      return new Response(
        JSON.stringify({
          model: 'fixture-discovery-json',
          usage: { prompt_tokens: 20, completion_tokens: 10 },
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }],
        }),
        { status: 200 },
      );
    } catch (error) {
      mockFailures.push(error.stack ?? error.message);
      throw error;
    }
  },
});

let app, browser, page, taskId, fixtureOrigin, summary;
const post = async (suffix, body) => {
  const response = await fetch(app.url + suffix, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': app.csrf, Origin: app.url },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  assert.ok(response.ok, `${suffix}: ${JSON.stringify(value)}`);
  return value;
};
try {
  await new Promise((resolve, reject) => {
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', resolve);
  });
  fixtureOrigin = `http://127.0.0.1:${fixture.address().port}`;
  app = await startServer({
    port: 0,
    dataDir: path.join(directory, 'data'),
    headless: true,
    provider,
  });
  const imported = await post('/api/tasks', {
    name: '登录后自主探索 · 独立双业务联调',
    target: fixtureOrigin + '/home',
    filename: 'independent-discovery.json',
    data_base64: Buffer.from(JSON.stringify(baseline)).toString('base64'),
    nonproduction: true,
    writes: false,
  });
  taskId = imported.id;
  for (const c of baseline.cases)
    await post(`/api/tasks/${taskId}/confirm`, {
      case_id: c.case_id,
      steps: confirmedSteps(c),
      note: '核对原文和完整预期分项；仅查看页面与新增弹窗，不提交业务数据。',
    });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1536, height: 1100 } });
  page.on('pageerror', (error) => uiErrors.push(error.message));
  await page.goto(app.url);
  await page.locator(`[data-task="${taskId}"]`).click();
  await page
    .getByRole('heading', { name: '登录后自主探索 · 独立双业务联调', exact: true })
    .waitFor();
  await page.locator('#preparation-tools > summary').click();
  await page.locator('#browser').click();
  await page.getByText('浏览器已打开', { exact: true }).waitFor();
  const loginContext = app.browser.loginContext,
    loginPage = app.browser.loginPage;
  // This is the sole manual action on the target site. No business navigation,
  // modal opening or target-page capture is supplied by this test driver.
  await loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  manualTargetActions.push({ at: new Date().toISOString(), operation: 'click', name: '进入演示' });
  await loginPage.getByTestId('signed-in').waitFor();
  await page.locator('#auth').click();
  await page.locator('#marker').selectOption({ label: '演示用户 · strong' });
  const authenticatedResponse = page.waitForResponse(
    (response) =>
      response.url() === `${app.url}/api/tasks/${taskId}/authenticate` &&
      response.request().method() === 'POST',
  );
  await page.locator('#save-marker').click();
  const authentication = await (await authenticatedResponse).json();
  assert.deepEqual(authentication, { authenticated: true, discovery_started: true });
  await bounded(firstDiscovery, 20000, 'automatic discovery did not ask the model');
  const discoveryJob = app.controller.active;
  assert.equal(discoveryJob?.kind, 'discover');
  await page.locator('.discovery-status').filter({ hasText: '探索中' }).waitFor();
  await page
    .locator('#output-list')
    .getByText(/自动探索已启动/)
    .waitFor();
  await page.screenshot({
    path: path.join(directory, '01-auto-discovery-running.png'),
    fullPage: true,
  });
  releaseDiscovery();
  await bounded(discoveryJob.finished, 90000, 'automatic discovery and planning did not finish');
  const prepared = await app.store.read(taskId);
  assert.equal(
    prepared.fixture,
    undefined,
    'generic imported task must not use fixture-specific server plans',
  );
  assert.equal(prepared.discovery.status, 'CAPTURED');
  assert.equal(prepared.discovery.steps, 3);
  assert.equal(prepared.discovery.completed_cases, 2);
  assert.equal(prepared.discovery.blocked_cases, 0);
  assert.deepEqual(
    prepared.cases.map((c) => c.status),
    ['PLAN_REVIEW', 'PLAN_REVIEW'],
  );
  assert.ok(prepared.cases.every((c) => c.reviewed && !c.plan_approved && !c.attempts.length));
  assert.ok(
    prepared.snapshots.some(
      (shot) =>
        shot.discovery_case_id === 'DISC-TASK-001' &&
        hasControl(shot, 'task-name') &&
        hasControl(shot, 'task-owner'),
    ),
    'dynamic owner field must be discovered without manual navigation',
  );
  assert.ok(
    prepared.snapshots.some(
      (shot) => hasControl(shot, 'task-save') && hasControl(shot, 'task-delete'),
    ),
    'the discovered modal includes visible disabled write controls',
  );
  assert.equal(app.browser.loginContext, loginContext);
  assert.equal(app.browser.loginPage, loginPage);
  assert.equal(loginPage.url(), fixtureOrigin + '/home');
  assert.equal(
    app.browser.browser.contexts().length,
    1,
    'discovery context must close while login context remains',
  );
  assert.ok(app.browser.authenticated);
  const discoveryRequests = requests.filter(
    (request) =>
      request.method !== 'GET' && request.method !== 'HEAD' && request.path !== '/session',
  );
  assert.equal(discoveryRequests.length, 0);
  assert.equal(
    requests.filter((request) => request.path === '/session' && request.method === 'POST').length,
    1,
  );
  assert.equal(modelCalls.filter((call) => call.purpose === 'case_ui_discovery').length, 5);
  assert.equal(modelCalls.filter((call) => call.purpose === 'case_plan').length, 2);
  const chosen = modelCalls
    .filter((call) => call.response?.action)
    .map(
      (call) =>
        call.input.candidates.find(
          (candidate) => candidate.candidate_id === call.response.action.candidate_id,
        )?.name,
    );
  assert.deepEqual(chosen, ['商品目录', '任务管理', '新增任务']);
  const operations = prepared.events.filter((event) => event.type === 'DISCOVERY_ACTION_AFTER');
  assert.deepEqual(
    operations.map((event) => event.name),
    chosen,
  );
  for (const operation of operations) {
    const before = prepared.events.find(
      (event) =>
        event.type === 'DISCOVERY_ACTION_BEFORE' && event.candidate_id === operation.candidate_id,
    );
    assert.ok(before && before.seq < operation.seq);
    assert.ok(operation.url.startsWith(fixtureOrigin));
  }
  await page.locator('.discovery-status').filter({ hasText: '页面采集结束' }).waitFor();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('td .badge')].filter((element) =>
        element.textContent.includes('待确认计划'),
      ).length === 2,
  );
  await page.screenshot({
    path: path.join(directory, '02-discovered-candidate-plans.png'),
    fullPage: true,
  });
  await page.locator('#select-all').check();
  await page.locator('#approve').click();
  await page.locator('#approve-all').click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('td .badge')].filter((element) =>
        element.textContent.includes('可执行'),
      ).length === 2,
  );
  await page.locator('#run').click();
  await page.waitForFunction(
    () => document.querySelectorAll('td .badge.good').length === 2,
    {},
    { timeout: 60000 },
  );
  if (app.controller.active)
    await bounded(app.controller.active.finished, 20000, 'execution job did not close');
  const executed = await app.store.read(taskId),
    facts = await Promise.all(
      executed.cases.map((c) => app.store.facts(taskId, c.attempts.at(-1))),
    );
  assert.deepEqual(
    executed.cases.map((c) => c.status),
    ['PASS_ASSERTIONS', 'PASS_ASSERTIONS'],
  );
  assert.ok(
    facts.every(
      (fact) =>
        fact.business_status === 'ASSERTIONS_PASSED' &&
        fact.cleanup_status === 'NOT_REQUIRED' &&
        fact.dirty === false &&
        fact.semantic_acceptance === 'PENDING_REVIEW',
    ),
  );
  assert.ok(
    facts.every(
      (fact) =>
        fact.assertions.length &&
        fact.assertions.every((observation) => observation.passed && observation.window_observed),
    ),
  );
  assert.ok(
    facts.every(
      (fact) =>
        fact.media.some((media) => media.type === 'video') &&
        fact.media.some((media) => media.file.endsWith('.png')),
    ),
  );
  assert.ok(
    facts.every((fact) =>
      fact.actions.every(
        (action) =>
          action.operation === 'click' &&
          !['task-save', 'task-delete'].includes(action.target?.value),
      ),
    ),
  );
  assert.equal(
    requests.filter((request) => request.path === '/api/save' || request.path === '/api/delete')
      .length,
    0,
  );
  assert.equal(
    requests.filter(
      (request) => !['GET', 'HEAD'].includes(request.method) && request.path !== '/session',
    ).length,
    0,
  );
  assert.equal(
    requests.filter((request) => request.path === '/session' && request.method === 'POST').length,
    1,
  );
  assert.equal(modelCalls.filter((call) => call.purpose === 'input_review').length, 2);
  assert.equal(modelCalls.filter((call) => call.purpose === 'plan_audit').length, 2);
  assert.equal(modelCalls.length, 11);
  assert.deepEqual(mockFailures, []);
  assert.deepEqual(uiErrors, []);
  assert.equal(manualTargetActions.length, 1);
  const diagnostics = await app.controller.diagnostics(taskId);
  assert.equal(diagnostics.records.filter((record) => record.type === 'MODEL_REQUEST').length, 11);
  assert.ok(
    diagnostics.records.some(
      (record) => record.type === 'DISCOVERY_ACTION_BEFORE' && record.name === '新增任务',
    ),
  );
  assert.ok(
    diagnostics.records.some(
      (record) => record.type === 'DISCOVERY_ACTION_AFTER' && record.name === '新增任务',
    ),
  );
  assert.ok(!JSON.stringify(diagnostics).includes('fixture-discovery-secret-local-only'));
  await page.screenshot({
    path: path.join(directory, '03-view-only-assertions.png'),
    fullPage: true,
  });
  await fs.writeFile(
    path.join(directory, 'diagnostics.json'),
    JSON.stringify(diagnostics, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(directory, 'execution-facts.json'),
    JSON.stringify(facts, null, 2) + '\n',
  );
  summary = {
    scope:
      'Independent authenticated localhost fixture; real Chromium; injected DeepSeek HTTP replies. Covers UI authentication triggering autonomous menu/dialog exploration, automatic candidate plans, UI plan approval and two view-only executions. Not a real DeepSeek or product acceptance result.',
    task_id: taskId,
    model_calls: modelCalls.length,
    input_review_calls: modelCalls.filter((call) => call.purpose === 'input_review').length,
    plan_audit_calls: modelCalls.filter((call) => call.purpose === 'plan_audit').length,
    discovery_calls: 5,
    planning_calls: 2,
    manual_target_actions: manualTargetActions,
    discovery_actions: chosen,
    discovery_steps: prepared.discovery.steps,
    discovered_pages: prepared.discovery.pages,
    dynamic_owner_field_discovered: true,
    login_context_preserved: true,
    login_count: 1,
    business_write_requests: 0,
    case_statuses: executed.cases.map((c) => ({ case_id: c.case_id, status: c.status })),
    semantic_acceptance: 'PENDING_REVIEW',
    screenshots: [
      '01-auto-discovery-running.png',
      '02-discovered-candidate-plans.png',
      '03-view-only-assertions.png',
    ],
  };
  process.stdout.write(
    JSON.stringify({
      result: 'LOCAL_DISCOVERY_INTEGRATION_ASSERTIONS_PASSED',
      directory,
      ...summary,
    }) + '\n',
  );
} catch (error) {
  summary = {
    scope: 'Local discovery integration did not satisfy all assertions.',
    error: error.stack ?? error.message,
    mock_failures: mockFailures,
    ui_errors: uiErrors,
  };
  if (page && !page.isClosed())
    await page
      .screenshot({ path: path.join(directory, 'failure.png'), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  releaseDiscovery();
  try {
    await fs.writeFile(
      path.join(directory, 'summary.json'),
      JSON.stringify(summary ?? { scope: 'Setup did not complete' }, null, 2) + '\n',
    );
    await fs.writeFile(
      path.join(directory, 'fixture-requests.json'),
      JSON.stringify(requests, null, 2) + '\n',
    );
    await fs.writeFile(
      path.join(directory, 'mock-model-calls.json'),
      JSON.stringify(modelCalls, null, 2) + '\n',
    );
  } finally {
    const closed = await Promise.allSettled([
      browser?.close(),
      app?.close(),
      fixture.listening
        ? new Promise((resolve, reject) =>
            fixture.close((error) => (error ? reject(error) : resolve())),
          )
        : undefined,
    ]);
    const rejected = closed.find((result) => result.status === 'rejected');
    if (rejected) throw rejected.reason;
  }
}
