import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession, snapshot } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { demoCases } from '../src/demo.mjs';
import { DEFAULT_ADAPTER_SOURCE } from '../src/adapter-program.mjs';
import { fixtureModelPhase, fixtureModelReply } from './fixture-model.mjs';
import { semanticHash } from '../src/common.mjs';

async function fixture(t) {
  let writes = 0;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      writes++;
      res.end('synthetic');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!req.headers.cookie?.includes('fixture=1')) {
      res.end(
        `<input type="password" aria-label="密码"><button onclick="document.cookie='fixture=1;path=/';location.href='/home'">登录</button>`,
      );
      return;
    }
    const nav = `<nav><span onclick="location.href='/catalog'">电价管理</span><span onclick="location.href='/home'">工作台</span><a href="/logout">退出登录</a></nav>`;
    res.end(
      nav +
        (req.url === '/home'
          ? `<h1>首页</h1><script>fetch('/unreviewed',{method:'POST'}).catch(()=>{})</script>`
          : `<h1>电价模板</h1><table><thead><tr><th>模板名称</th><th>适用范围</th></tr></thead><tbody><tr><td>示例</td><td>00:00—24:00</td></tr></tbody></table><button onclick="fetch('/write',{method:'POST'}).catch(()=>{})">查看异常</button>`),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-autonomy-'));
  const store = new Store(directory);
  await store.init();
  const { baseline, plans } = demoCases();
  baseline.cases = baseline.cases.slice(0, 2);
  baseline.case_count = baseline.cases.length;
  const id = await store.create({
    name: 'Bounded autonomy synthetic fixture',
    target: origin + '/home',
    baseline,
  });
  await store.update(id, (s) => {
    s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
    s.cases.forEach((c) => {
      c.reviewed = true;
    });
  });
  const browser = new BrowserSession({ headless: true });
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { store, id, browser, plans, baseline, directory, origin, writes: () => writes };
}

test('one preparation: manual login -> internal source repair -> missing-evidence probe/navigation -> audited candidate, no automatic approval', async (t) => {
  const f = await fixture(t),
    calls = [];
  const before = await f.store.read(f.id),
    baselineBytes = await fs.readFile(path.join(f.store.dir(f.id), 'baseline.json'));
  await f.browser.open(before);
  const loginContext = f.browser.loginContext;
  f.browser.adapterSource = DEFAULT_ADAPTER_SOURCE.replace(
    '  if (element.navigation_text && element.text) return {kind: "text", value: element.text, exact: true};\n',
    '',
  );
  const brokenHash = semanticHash(f.browser.adapterSource);
  let probeReturned = false;
  const provider = {
    configured: () => true,
    model: 'fixture-only',
    async json(prompt, input) {
      const phase = fixtureModelPhase(prompt, input);
      calls.push({ phase, input: structuredClone(input) });
      let value;
      if (phase === 'adapter_repair')
        value = { source: DEFAULT_ADAPTER_SOURCE, reason: '恢复缺失的导航文字映射分支' };
      else if (phase === 'discovery')
        value = { done: true, reason: '注入不完整探索，验证后续恢复' };
      else if (phase === 'plan' && !input.pages.some((p) => p.url.endsWith('/catalog')))
        value = { blocked: true, reason: '缺少电价模板列表页与表格事实' };
      else if (phase === 'evidence_recovery') {
        if (!probeReturned) {
          probeReturned = true;
          value = {
            probe: { target: { kind: 'text', value: '电价管理', exact: true } },
            reason: '核验当前导航入口唯一可见',
          };
        } else if (input.current.url.endsWith('/catalog'))
          value = { done: true, reason: '已找到模板表格事实' };
        else
          value = {
            action: {
              candidate_id: input.candidates.find((c) => c.name === '电价管理').candidate_id,
            },
            reason: '打开观测到的电价管理菜单',
          };
      } else value = fixtureModelReply(prompt, input, f.plans);
      return { value, usage: { response_model: 'fixture-only' } };
    },
  };
  const controller = new Controller({ store: f.store, provider, browser: f.browser });
  await controller.launch(f.id, 'prepare', [before.cases[0].case_id]);
  const finished = controller.active.finished;
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(controller.active.stage, 'WAITING_USER_LOGIN');
  assert.equal(calls.length, 0, 'login form must never be sent to the model');
  await f.browser.loginPage.getByLabel('密码').fill('synthetic-secret-not-for-model');
  await f.browser.loginPage.getByRole('button', { name: '登录', exact: true }).click();
  await finished;
  const result = await f.store.read(f.id),
    row = result.cases[0];
  assert.equal(row.status, 'PLAN_REVIEW', JSON.stringify(result.events.slice(-12)));
  assert.equal(row.plan_approved, false);
  assert.equal(row.attempts.length, 0);
  assert.equal(result.cases[1].plan, null, 'unselected case must remain untouched');
  assert.equal(result.adapter_repair_attempts[0].status, 'VERIFIED');
  assert.notEqual(result.adapter_program.hash, brokenHash);
  assert.equal(
    await fs.readFile(path.join(f.store.dir(f.id), result.adapter_program.artifact), 'utf8'),
    DEFAULT_ADAPTER_SOURCE,
  );
  assert.equal(f.browser.loginContext, loginContext, 'adapter reload must retain the login owner');
  assert.equal(f.browser.authenticated, true);
  assert.equal(row.preparation_budget.used, 2);
  assert.equal(row.evidence_recoveries[0].status, 'NEW_EVIDENCE');
  assert.equal(row.evidence_recoveries[0].probes[0].count, 1);
  assert.equal(row.self_repair_history[0].rounds[0].status, 'BLOCKED');
  assert.ok(
    result.snapshots.some((p) =>
      p.controls.some(
        (c) => c.locator.kind === 'role' && c.locator.role === 'table' && c.locator.name === '',
      ),
    ),
  );
  assert.ok(result.events.some((e) => e.type === 'DISCOVERY_REQUEST_BLOCKED'));
  assert.deepEqual(result.authorization, before.authorization);
  assert.deepEqual(await fs.readFile(path.join(f.store.dir(f.id), 'baseline.json')), baselineBytes);
  assert.ok(!JSON.stringify({ result, calls }).includes('synthetic-secret-not-for-model'));
  assert.equal(
    f.writes(),
    1,
    'only the operator login page sent its synthetic initialization POST; discovery sent none',
  );
});

test('unknown initialization request does not kill navigation; action-induced write remains blocked', async (t) => {
  const f = await fixture(t),
    task = await f.store.read(f.id);
  await f.browser.open(task);
  await f.browser.loginPage.getByRole('button', { name: '登录', exact: true }).click();
  await f.browser.authenticate(task, { kind: 'text', value: '电价管理', exact: true });
  const explorer = new DiscoveryBrowser(f.browser, task);
  t.after(() => explorer.close());
  let observation = await explorer.open();
  assert.equal(observation.snapshot.network_issues[0].path, '/unreviewed');
  observation = await explorer.act({
    candidate_id: observation.candidates.find((c) => c.name === '电价管理').candidate_id,
  });
  assert.ok(observation.snapshot.url.endsWith('/catalog'));
  assert.equal(observation.snapshot.network_issues.length, 0);
  await assert.rejects(
    () =>
      explorer.act({
        candidate_id: observation.candidates.find((c) => c.name === '查看异常').candidate_id,
      }),
    (e) => e.code === 'WRITE_NOT_AUTHORIZED',
  );
  assert.equal(f.writes(), 1);
});

test('public or ambiguous page cannot silently count as login; waiting is cancellable', async (t) => {
  const f = await fixture(t),
    task = await f.store.read(f.id);
  await f.browser.open(task);
  await f.browser.loginPage.setContent('<nav><a>模块一</a><a>模块二</a></nav><h1>公开界面</h1>');
  await assert.rejects(
    () => f.browser.waitForAuthentication(task, { timeoutMs: 100 }),
    (e) => e.code === 'LOGIN_EVIDENCE_REQUIRED',
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    () => f.browser.waitForAuthentication(task, { signal: abort.signal }),
    (e) => e.code === 'STOPPED',
  );
  assert.equal(f.browser.authenticated, false);
});

test('adapter cannot silently rebind an observed node or expose duplicate tables', async (t) => {
  const f = await fixture(t),
    task = await f.store.read(f.id);
  await f.browser.open(task);
  await f.browser.loginPage.setContent(
    '<nav><span>电价管理</span><span>工作台</span></nav><table><tr><td>A</td></tr></table><table><tr><td>B</td></tr></table>',
  );
  const source =
    'export function locate(element) { return {kind:"text",value:"工作台",exact:true}; }';
  const shot = await snapshot(f.browser.loginPage, { adapterSource: source });
  assert.deepEqual(
    shot.controls.map((c) => c.name),
    ['工作台'],
  );
  const safe = await snapshot(f.browser.loginPage);
  assert.ok(!safe.controls.some((c) => c.locator.role === 'table'));
});

test('dismissing a login modal over a public shell and a visible OTP challenge are not login evidence', async (t) => {
  const f = await fixture(t),
    task = await f.store.read(f.id);
  await f.browser.open(task);
  await f.browser.loginPage.setContent(
    '<nav><span>模块一</span><span>模块二</span></nav><input type="password">',
  );
  const waiting = f.browser.waitForAuthentication(task, { timeoutMs: 2000 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await f.browser.loginPage.locator('input').evaluate((e) => e.remove());
  await assert.rejects(
    () => waiting,
    (e) => e.code === 'LOGIN_EVIDENCE_REQUIRED',
  );
  await f.browser.loginPage.setContent(
    '<nav><span>模块一</span><span>模块二</span><button>退出登录</button></nav><input autocomplete="one-time-code">',
  );
  await assert.rejects(
    () => f.browser.waitForAuthentication(task, { timeoutMs: 1600 }),
    (e) => e.code === 'LOGIN_EVIDENCE_REQUIRED',
  );
  assert.equal(f.browser.authenticated, false);
});

test('rejected live adapter keeps the login owner; leaf labels cannot bypass dangerous menu ancestors', async (t) => {
  const f = await fixture(t),
    task = await f.store.read(f.id);
  await f.browser.open(task);
  await f.browser.loginPage.getByRole('button', { name: '登录', exact: true }).click();
  await f.browser.authenticate(task, { kind: 'text', value: '电价管理', exact: true });
  const owner = f.browser.loginContext,
    source = f.browser.adapterSource;
  const explorer = new DiscoveryBrowser(f.browser, task);
  t.after(() => explorer.close());
  await explorer.open();
  await assert.rejects(
    () => explorer.repairAdapter('export function locate(element) { return process.env; }'),
    (e) => e.code === 'ADAPTER_PROGRAM_REJECTED',
  );
  assert.equal(f.browser.adapterSource, source);
  assert.equal(f.browser.loginContext, owner);
  assert.equal(f.browser.authenticated, true);
  await explorer.page
    .locator('nav')
    .evaluate((e) =>
      e.insertAdjacentHTML(
        'beforeend',
        '<li role="menuitem"><span>普通管理</span><span>删除资源</span></li><div role="switch" aria-checked="false"><span>电价设置</span></div>',
      ),
    );
  const observed = await explorer.observe();
  assert.ok(!observed.candidates.some((c) => ['普通管理', '电价设置'].includes(c.name)));
  assert.ok(observed.candidates.some((c) => c.name === '电价管理'));
});
