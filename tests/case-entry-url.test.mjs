import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { importCases } from '../src/importer.mjs';
import {
  caseEntryURL,
  withoutEntryHints,
  entryObservationCode,
  requireEntryNavigation,
} from '../src/case-entry-url.mjs';
import { planningInput } from '../src/planning-input.mjs';
import { caseHash } from '../src/plans.mjs';
import { Controller } from '../src/controller.mjs';
import { Store } from '../src/store.mjs';

const target = 'https://fixture.invalid/home';
const original = (hint) => ({
  case_id: 'ENTRY-1',
  title: '商品目录页面',
  ...(hint === undefined ? {} : { page_entry_url: hint }),
  steps: [
    {
      step_id: 'S1',
      action: '从首页点击商品目录菜单进入页面',
      expected: '显示商品名称',
      obligations: [{ id: 'O1', text: '显示商品名称' }],
    },
  ],
});
const code = (expected) => (e) => e.code === expected;

test('safe absolute, relative and SPA URLs preserve route, query and fragment', () => {
  for (const value of [
    '/catalog',
    'catalog',
    'https://fixture.invalid/catalog',
    '/#/catalog?tab=all',
    '/#!/catalog',
    '#/catalog',
    '/catalog?q=%E5%95%86%E5%93%81',
  ]) {
    const url = caseEntryURL(value, target);
    assert.equal(url.url, new URL(value, target).href);
    assert.equal(new URL(url.url).origin, new URL(target).origin);
  }
  assert.equal(caseEntryURL(''), null);
  assert.equal(caseEntryURL(undefined), null);
});

test('credentials, nested encodings, sensitive parameters, external and dangerous protocols reject without raw values', () => {
  for (const value of [
    'javascript:SECRET',
    'data:text/plain,SECRET',
    '//evil.invalid/SECRET',
    'https://evil.invalid/SECRET',
    'https://user:SECRET@fixture.invalid/catalog',
    '/catalog?session_id=SECRET',
    '/catalog#access_token=SECRET',
    '/#/catalog?auth_token=SECRET',
    '/catalog?%2574oken=SECRET',
    '/catalog?authorization=SECRET',
    '/catalog?code=SECRET',
    '/catalog?cookie=SECRET',
    '/catalog%255cSECRET',
    '/catalog\nSECRET',
  ]) {
    assert.throws(
      () => caseEntryURL(value, target),
      (e) => /^CASE_ENTRY_URL_/.test(e.code) && !e.message.includes('SECRET'),
      value,
    );
  }
  assert.equal(
    JSON.stringify(
      withoutEntryHints({
        original: original('/catalog?session=SECRET'),
        rows: [{ 页面入口URL: '/?code=SECRET' }],
      }),
    ).includes('SECRET'),
    false,
  );
});

test('JSON field and optional Chinese CSV column import without changing actions/expectations', async () => {
  const c = original('/#/catalog');
  const json = await importCases('cases.json', Buffer.from(JSON.stringify({ cases: [c] })));
  assert.deepEqual(json.cases[0], c);
  for (const withHint of [false, true]) {
    const csv = `用例编号,用例名称,操作步骤,预期结果${withHint ? ',页面入口URL' : ''}\nENTRY-1,商品目录,点击菜单,显示商品名称${withHint ? ',/#/catalog' : ''}\n`;
    const b = await importCases('cases.csv', Buffer.from(csv));
    assert.equal(b.cases[0].page_entry_url, withHint ? '/#/catalog' : undefined);
    assert.equal(b.cases[0].steps[0].action, '点击菜单');
    assert.equal(b.cases[0].steps[0].expected, '显示商品名称');
  }
  await assert.rejects(
    importCases('bad.json', Buffer.from(JSON.stringify({ cases: [original('/?session=SECRET')] }))),
    code('CASE_ENTRY_URL_SENSITIVE'),
  );
  const conflict =
    '用例编号,操作步骤,预期结果,页面入口URL\nENTRY-1,查看,显示,/one\nENTRY-1,查看,显示,/two\n';
  await assert.rejects(
    importCases('conflict.csv', Buffer.from(conflict)),
    code('CASE_ENTRY_URL_CONFLICT'),
  );
});

test('Excel optional Chinese column is projected from real workbook rows', async () => {
  const result = spawnSync(
    process.env.PYTHON || 'python',
    [
      '-c',
      "import io,sys,openpyxl; b=openpyxl.Workbook(); s=b.active; s.append(['用例编号','操作步骤','预期结果','页面入口URL']); s.append(['ENTRY-1','点击菜单','显示商品名称','/#/catalog?tab=all']); s.append(['ENTRY-2','查看列表','显示列表',None]); o=io.BytesIO(); b.save(o); sys.stdout.buffer.write(o.getvalue())",
    ],
    { windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr.toString());
  const b = await importCases('cases.xlsx', result.stdout);
  assert.equal(b.cases[0].page_entry_url, '/#/catalog?tab=all');
  assert.equal(b.cases[1].page_entry_url, undefined);
});

async function harness(t, hint, { outcome = 'normal', repeat = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-entry-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.init();
  const baseline = { cases: [original(hint)] };
  const id = await store.create({ name: 'URL fixture', target, baseline });
  await store.update(id, (s) => {
    s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
  });
  const calls = [],
    routes = [];
  let current = '/home',
    counter = 0;
  const observe = () => ({
    page_id: 'p' + counter,
    snapshot: {
      url: new URL(current, target).href,
      title: current === '/home' ? '首页' : '商品目录',
      text: current === '/home' ? '首页菜单' : '商品名称',
      login_page: false,
      controls: [
        {
          role: 'heading',
          name: current === '/home' ? '首页' : '商品目录',
          locator: { kind: 'testid', value: 'heading' },
        },
      ],
    },
    candidates: [
      {
        candidate_id: 'menu-' + counter,
        name: '商品目录',
        kind: 'link',
        locator: { kind: 'testid', value: 'menu-' + counter },
      },
    ],
  });
  const browser = { authenticated: true, active: () => true };
  const controller = new Controller({
    store,
    browser,
    provider: {
      configured: () => true,
      json: async (prompt, input) => {
        calls.push(input);
        return {
          value: repeat
            ? {
                action: { candidate_id: input.candidates[0].candidate_id },
                reason: '继续探索商品目录',
              }
            : { done: true, reason: '已取得页面观察' },
        };
      },
    },
    discoveryFactory: (_session, _task, options) => ({
      beginCase() {},
      async open() {
        return observe();
      },
      async observe() {
        return observe();
      },
      async close() {},
      async navigate(route) {
        routes.push(route);
        counter++;
        current = route;
        await options.onEvent({ type: 'DISCOVERY_NAVIGATE_BEFORE' });
        if (route !== '/home' && outcome === 'login')
          throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
        const result = observe();
        if (route !== '/home' && outcome === '404') result.snapshot.http_status = 404;
        if (route !== '/home' && outcome === 'wrong')
          result.snapshot.url = 'https://fixture.invalid/other';
        if (route !== '/home' && outcome === 'irrelevant') {
          result.snapshot.title = '无关模块';
          result.snapshot.controls = [];
        }
        return result;
      },
      async act() {
        counter++;
        current = '/catalog/' + counter;
        await options.onEvent({ type: 'DISCOVERY_ACTION_BEFORE' });
        return observe();
      },
    }),
  });
  return {
    controller,
    store,
    id,
    baseline,
    calls,
    routes,
    run: async () => {
      await controller.launch(id, 'discover', ['ENTRY-1']);
      await controller.active?.promise;
      return store.read(id);
    },
  };
}

test('hint observations are case scoped, followed by homepage discovery; no auto approval', async (t) => {
  const h = await harness(t, '/#/catalog?tab=all');
  const s = await h.run();
  assert.deepEqual(h.routes, ['/#/catalog?tab=all', '/home']);
  assert.equal(s.cases[0].entry_hint.status, 'OBSERVED');
  assert.equal(s.discovery.steps, 2);
  assert.equal(h.calls[0].remaining.steps, 10);
  assert.equal(h.calls[0].current.url, target);
  assert.equal(h.calls[0].case.page_entry_url, undefined);
  assert.equal(s.cases[0].plan_approved, false);
  const c = (await h.controller.view(h.id)).cases[0].effective;
  const input = planningInput(s, c, s.cases[0], caseHash(c));
  assert.deepEqual(input.technical_context.entry_paths, []);
  assert.ok(input.technical_context.observed_entry_paths.includes('/#/catalog?tab=all'));
  assert.equal(input.technical_context.entry_hint.execution_entry_path, '/home');
  assert.deepEqual(await h.store.baseline(h.id), h.baseline);
});

for (const [outcome, expected] of [
  ['404', 'CASE_ENTRY_HTTP_ERROR'],
  ['wrong', 'CASE_ENTRY_WRONG_PAGE'],
  ['login', 'CASE_ENTRY_LOGIN_REDIRECT'],
  ['irrelevant', 'CASE_ENTRY_RELEVANCE_UNCONFIRMED'],
])
  test(`${outcome} is not accepted as observed and restores home`, async (t) => {
    const h = await harness(t, '/catalog', { outcome });
    const s = await h.run();
    assert.deepEqual(h.routes, ['/catalog', '/home']);
    assert.equal(s.cases[0].entry_hint.code, expected);
    assert.equal(s.cases[0].entry_hint.status, 'REJECTED');
    assert.ok(s.snapshots.every((p) => p.url === target));
    assert.equal(h.calls[0].current.url, target);
  });

test('unsafe persisted hint is never navigated or sent to model; missing hint retains exploration', async (t) => {
  const bad = await harness(t, 'https://evil.invalid/?session_id=SECRET');
  const s = await bad.run();
  assert.deepEqual(bad.routes, ['/home']);
  assert.equal(s.cases[0].entry_hint.status, 'REJECTED');
  assert.equal(JSON.stringify(bad.calls).includes('SECRET'), false);
  assert.equal(JSON.stringify(s.events).includes('SECRET'), false);
  const absent = await harness(t, undefined);
  await absent.run();
  assert.deepEqual(absent.routes, []);
  assert.equal(absent.calls[0].remaining.steps, 12);
});

test('direct entry and fallback exhaust only the Case step budget', async (t) => {
  const h = await harness(t, '/catalog', { repeat: true });
  const s = await h.run();
  assert.equal(s.discovery.steps, 12);
  assert.equal(h.calls.length, 11);
  assert.equal(h.calls.at(-1).remaining.steps, 0);
  assert.equal(s.discovery.reason, null);
  assert.equal(s.cases[0].status, 'BLOCKED_BUDGET');
  assert.equal(s.cases[0].discovery.reason, 'DISCOVERY_CASE_STEP_LIMIT');
});

test('changing or clearing hint changes effective hash and invalidates old plan/evidence while retaining baseline', async (t) => {
  const h = await harness(t, '/catalog');
  await h.store.update(h.id, (s) => {
    Object.assign(s.cases[0], {
      plan: { placeholder: true },
      plan_approved: true,
      approved_hash: 'old',
      plan_audit: {},
      discovery: {},
      discovery_memory: {},
      entry_hint: {},
    });
    s.snapshots = [{ discovery_case_id: 'ENTRY-1', url: target }];
  });
  const previous = caseHash((await h.controller.view(h.id)).cases[0].effective);
  await h.controller.confirmCase(h.id, 'ENTRY-1', {
    steps: h.baseline.cases[0].steps,
    page_entry_url: '/#/catalog',
  });
  const row = (await h.controller.view(h.id)).cases[0];
  assert.notEqual(caseHash(row.effective), previous);
  assert.equal(row.effective.page_entry_url, '/#/catalog');
  assert.equal(row.plan, null);
  assert.equal(row.plan_approved, false);
  assert.equal(row.discovery, undefined);
  assert.equal(row.entry_hint, undefined);
  assert.equal((await h.store.read(h.id)).snapshots.length, 0);
  const next = caseHash(row.effective);
  await h.controller.confirmCase(h.id, 'ENTRY-1', {
    steps: h.baseline.cases[0].steps,
    page_entry_url: '',
  });
  assert.notEqual(caseHash((await h.controller.view(h.id)).cases[0].effective), next);
  assert.deepEqual(await h.store.baseline(h.id), h.baseline);
  await assert.rejects(
    h.controller.confirmCase(h.id, 'ENTRY-1', {
      steps: h.baseline.cases[0].steps,
      page_entry_url: '/?session=SECRET',
    }),
    code('CASE_ENTRY_URL_SENSITIVE'),
  );
});

test('execution entry and navigation clicks cannot be replaced by direct hint navigation', () => {
  const c = original('/catalog');
  const plan = { entry_path: '/home', steps: [{ step_id: 'S1', actions: [{ op: 'click' }] }] };
  requireEntryNavigation(plan, c, target);
  assert.throws(
    () => requireEntryNavigation({ ...plan, entry_path: '/catalog' }, c, target),
    code('CASE_ENTRY_NAVIGATION_REQUIRED'),
  );
  assert.throws(
    () =>
      requireEntryNavigation(
        { ...plan, steps: [{ step_id: 'S1', actions: [{ op: 'navigate', value: '/catalog' }] }] },
        c,
        target,
      ),
    code('CASE_ENTRY_NAVIGATION_REQUIRED'),
  );
});

test('hint-only edits retain exhausted candidate budget and old hint cannot enter immediate planning', async (t) => {
  const h = await harness(t, '/catalog');
  await h.run();
  const initial = (await h.controller.view(h.id)).cases[0].effective;
  const oldHint = (await h.store.read(h.id)).snapshots.find((p) => p.entry_hint_observation);
  await h.store.update(h.id, (s) => {
    s.cases[0].preparation_budget = { case_hash: caseHash(initial), used: 3, limit: 3 };
    s.snapshots.push({ url: target, title: '首页', text: '首页', controls: [], login_page: false });
  });
  for (const hint of ['/another', '']) {
    await h.controller.confirmCase(h.id, 'ENTRY-1', {
      steps: h.baseline.cases[0].steps,
      page_entry_url: hint,
    });
    const view = await h.controller.view(h.id),
      row = view.cases[0];
    assert.equal(row.preparation_budget.used, 3);
    assert.equal(row.preparation_budget.case_hash, caseHash(row.effective));
    // Defense in depth: even an old/global hint capture injected into snapshots
    // cannot pass the planner projection after a hint change or clear.
    const projected = planningInput(
      { ...view, snapshots: [...view.snapshots, { ...oldHint, discovery_case_id: undefined }] },
      row.effective,
      row,
      caseHash(row.effective),
    );
    assert.ok(projected.pages.every((p) => !p.entry_hint_observation));
    assert.ok(!projected.technical_context.observed_entry_paths.includes('/catalog'));
  }
  const beforeCalls = h.calls.length;
  h.controller.provider.json = async (_prompt, input) => {
    h.calls.push(input);
    return { value: { issues: [] } };
  };
  await h.controller.launch(h.id, 'plan', ['ENTRY-1']);
  await h.controller.active?.promise;
  const final = await h.store.read(h.id);
  assert.equal(final.cases[0].preparation_budget.used, 3);
  assert.equal(final.cases[0].self_repair.outcome, 'EXHAUSTED');
  assert.equal(
    final.cases[0].mapping_reason,
    '本用例的三次候选机会已用完；重新采证或加载适配器不会重置预算。',
  );
  assert.ok(h.calls.slice(beforeCalls).every((c) => !c.target_origin));
});
