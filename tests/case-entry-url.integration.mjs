import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { fixtureModelPhase, fixtureAuditReply } from './fixture-model.mjs';
import { caseHash } from '../src/plans.mjs';

const authored = (entry) => ({
  case_id: 'URL-1',
  title: '商品目录入口',
  ...(entry === undefined ? {} : { page_entry_url: entry }),
  steps: [
    {
      step_id: 'S1',
      action: '从首页点击商品目录菜单',
      expected: '显示商品名称',
      requires_click: true,
      obligations: [{ id: 'O1', text: '显示商品名称' }],
    },
  ],
});
const confirmation = (c) => c.steps.map(({ requires_click, ...step }) => step);
const marker = { kind: 'testid', value: 'signed-in' };

test(
  'isolated Chromium console fill/save/clear and actual guarded URL observations',
  { timeout: 120000 },
  async (t) => {
    const requests = [],
      modelCalls = [];
    let malformedOnce = true;
    let outsideHits = 0;
    const outside = http.createServer((_req, res) => {
      outsideHits++;
      res.end('outside');
    });
    await new Promise((resolve) => outside.listen(0, '127.0.0.1', resolve));
    const outsideURL = `http://127.0.0.1:${outside.address().port}/outside`;
    t.after(() => new Promise((resolve) => outside.close(resolve)));
    const pageHead =
      '<meta charset="utf-8"><title>商品目录</title><span data-testid="signed-in">已登录测试用户</span>';
    const fixture = http.createServer((req, res) => {
      requests.push({ method: req.method, url: req.url });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.url === '/redirect-login') {
        res.writeHead(302, { Location: '/login' });
        res.end();
        return;
      }
      if (req.url === '/redirect-outside') {
        res.writeHead(302, { Location: outsideURL });
        res.end();
        return;
      }
      if (req.url === '/login') {
        res.end('<title>登录</title><input type="password"><button>登录</button>');
        return;
      }
      if (req.url === '/home') {
        res.end(
          pageHead + '<h1>首页</h1><a data-testid="catalog-menu" href="/catalog">商品目录</a>',
        );
        return;
      }
      if (req.url === '/missing') {
        res.statusCode = 404;
        res.end(pageHead + '<h1>商品目录</h1>商品名称');
        return;
      }
      if (req.url === '/wrong') {
        res.end(
          '<title>其他页面</title><span data-testid="signed-in">已登录测试用户</span><h1>无关页面</h1>',
        );
        return;
      }
      if (req.url === '/write-page') {
        res.end(
          pageHead +
            '<script>fetch("/write",{method:"POST"}).catch(()=>{})</script><h1>商品目录</h1>',
        );
        return;
      }
      if (req.url === '/spa') {
        res.end(
          pageHead + '<h1>商品目录</h1><input data-testid="product-name" aria-label="商品名称">',
        );
        return;
      }
      if (req.url === '/catalog') {
        res.end(
          pageHead + '<h1>商品目录</h1><input data-testid="product-name" aria-label="商品名称">',
        );
        return;
      }
      res.statusCode = 404;
      res.end('not found');
    });
    await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
    const target = `http://127.0.0.1:${fixture.address().port}/home`;
    t.after(() => new Promise((resolve) => fixture.close(resolve)));
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'case-entry-browser-'));
    const provider = {
      configured: () => true,
      model: 'synthetic-fixture',
      json: async (prompt, input) => {
        const phase = fixtureModelPhase(prompt, input);
        modelCalls.push({ phase, input: structuredClone(input) });
        let value;
        if (phase === 'discovery') {
          const menu = input.candidates.find((c) => c.name === '商品目录');
          value =
            input.current.url.endsWith('/home') && menu
              ? {
                  action: { candidate_id: menu.candidate_id },
                  reason: '按原步骤查看商品目录菜单入口',
                }
              : { done: true, reason: '商品名称控件已实际观察' };
        } else if (phase === 'input_review') value = { issues: [] };
        else if (phase === 'plan_audit')
          value = fixtureAuditReply(input.original, input.candidate_plan);
        else if (phase === 'plan') {
          value = {
            plan: {
              schema_version: 'ui-agent-plan/v2',
              case_id: input.original.case_id,
              case_hash: input.case_hash,
              entry_path: '/home',
              data_effect: 'read_only',
              preconditions: [],
              cleanup: null,
              steps: input.original.steps.map((s) => ({
                step_id: s.step_id,
                source_action: s.action,
                source_expected: s.expected,
                actions: [
                  {
                    action_id: 'A1',
                    op: 'click',
                    target: { kind: 'testid', value: 'catalog-menu' },
                  },
                ],
                assertion_mode: 'simultaneous',
                within_ms: 8000,
                assertions: [
                  {
                    target: { kind: 'testid', value: 'product-name' },
                    check: 'visible',
                    oracle_quote: s.expected,
                    obligation_ids: ['O1'],
                  },
                ],
              })),
            },
          };
          if (malformedOnce) {
            value.plan.entry_path = '/catalog';
            malformedOnce = false;
          }
        } else throw new Error('Unexpected phase: ' + phase);
        return {
          value,
          usage: { response_model: 'synthetic-fixture', prompt_tokens: 1, completion_tokens: 1 },
        };
      },
    };
    const app = await start({ port: 0, dataDir: directory, headless: true, provider });
    t.after(() => app.close());
    const uiBrowser = await chromium.launch({ headless: true });
    t.after(() => uiBrowser.close());
    const page = await uiBrowser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const post = async (route, body) => {
      const response = await fetch(app.url + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': app.csrf },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.ok(response.ok, JSON.stringify(result));
      return result;
    };

    await t.test(
      'Chinese console uses actual confirm API for fill, saved value and clear',
      async () => {
        await page.goto(app.url);
        await page.locator('#empty-import').click();
        await page.locator('#task-name').fill('入口URL界面测试');
        await page.locator('#target').fill(target);
        await page.locator('#case-file').setInputFiles({
          name: 'entry.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({ cases: [authored(undefined)] })),
        });
        await page.locator('#nonproduction').check();
        await page.locator('#import-submit').click();
        await page.getByRole('heading', { name: '入口URL界面测试', exact: true }).waitFor();
        const id = (await app.store.list())[0].id;
        const before = await app.store.baseline(id);
        await page.locator('[data-case="URL-1"]').click();
        const placement = await page.locator('#case-entry-url').evaluate((input) => {
          const field = input.closest('label').parentElement;
          const status = document.querySelector('#modal-body > h2 + p');
          const steps = document.querySelector('#modal-body > .step-editor');
          const rect = input.getBoundingClientRect();
          return {
            afterStatus: field.previousElementSibling === status,
            beforeSteps: !!(
              field.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING
            ),
            visibleInitially: rect.top >= 0 && rect.bottom <= window.innerHeight,
          };
        });
        assert.deepEqual(placement, {
          afterStatus: true,
          beforeSteps: true,
          visibleInitially: true,
        });
        await page.getByLabel('页面入口URL（选填）').fill('/spa#/catalog?tab=all');
        const saved = page.waitForResponse(
          (r) => r.url().endsWith('/confirm') && r.request().method() === 'POST',
        );
        await page.locator('#confirm-one').click();
        assert.equal((await saved).status(), 200);
        await page.locator('#case-entry-url').waitFor({ state: 'detached' });
        let view = await app.controller.view(id);
        const firstHash = caseHash(view.cases[0].effective);
        assert.equal(view.cases[0].effective.page_entry_url, '/spa#/catalog?tab=all');
        await page.locator('[data-case="URL-1"]').click();
        assert.equal(await page.locator('#case-entry-url').inputValue(), '/spa#/catalog?tab=all');
        await page.locator('#case-entry-url').fill('');
        const cleared = page.waitForResponse(
          (r) => r.url().endsWith('/confirm') && r.request().method() === 'POST',
        );
        await page.locator('#confirm-one').click();
        assert.equal((await cleared).status(), 200);
        await page.locator('#case-entry-url').waitFor({ state: 'detached' });
        view = await app.controller.view(id);
        assert.equal(view.cases[0].effective.page_entry_url, '');
        assert.notEqual(caseHash(view.cases[0].effective), firstHash);
        assert.equal(view.cases[0].plan_approved, false);
        assert.deepEqual(await app.store.baseline(id), before);
        assert.deepEqual(errors, []);
      },
    );

    async function discover(entry, reviewed = false) {
      const c = authored(entry);
      const { id } = await post('/api/tasks', {
        name: 'URL browser ' + entry,
        target,
        filename: 'entry.json',
        data_base64: Buffer.from(JSON.stringify({ cases: [c] })).toString('base64'),
        nonproduction: true,
        writes: false,
      });
      if (reviewed)
        await post(`/api/tasks/${id}/confirm`, { case_id: c.case_id, steps: confirmation(c) });
      await app.controller.openBrowser(id);
      await app.controller.authenticate(id, marker);
      const beforeRequests = requests.length;
      await app.controller.launch(id, 'discover', [c.case_id]);
      await app.controller.active?.promise;
      return { id, state: await app.store.read(id), requests: requests.slice(beforeRequests) };
    }
    await t.test(
      'valid SPA direct evidence then actual home-menu exploration produces unapproved plan',
      async () => {
        const result = await discover('/spa#/catalog?tab=all', true);
        assert.equal(result.state.cases[0].entry_hint.status, 'OBSERVED');
        assert.equal(
          result.state.cases[0].status,
          'PLAN_REVIEW',
          JSON.stringify(result.state.cases[0]),
        );
        assert.equal(result.state.cases[0].plan.entry_path, '/home');
        assert.equal(result.state.cases[0].plan.steps[0].actions[0].op, 'click');
        assert.equal(result.state.cases[0].plan_approved, false);
        assert.equal(result.state.cases[0].preparation_budget.used, 2);
        assert.equal(
          result.state.cases[0].self_repair.rounds[0].code,
          'CASE_ENTRY_NAVIGATION_REQUIRED',
        );
        assert.ok(
          modelCalls.some(
            (c) =>
              c.phase === 'plan' &&
              c.input.self_repair?.feedback?.code === 'CASE_ENTRY_NAVIGATION_REQUIRED',
          ),
        );
        assert.equal(result.state.cases[0].attempts.length, 0);
        assert.equal(result.state.discovery.steps, 3);
        assert.ok(result.state.snapshots.some((p) => p.url.endsWith('/spa#/catalog?tab=all')));
        assert.ok(
          modelCalls.some(
            (c) =>
              c.phase === 'plan' &&
              c.input.technical_context.observed_entry_paths.includes('/spa#/catalog?tab=all'),
          ),
        );
        assert.deepEqual(
          result.requests
            .filter((r) => ['/spa', '/home', '/catalog'].includes(r.url))
            .map((r) => r.url),
          ['/home', '/spa', '/home', '/catalog'],
        );
      },
    );
    for (const [entry, expected] of [
      ['/missing', 'CASE_ENTRY_HTTP_ERROR'],
      ['/wrong', 'CASE_ENTRY_RELEVANCE_UNCONFIRMED'],
      ['/redirect-login', 'CASE_ENTRY_LOGIN_REDIRECT'],
    ])
      await t.test(entry + ' restores homepage and does not promote failed hint', async () => {
        const result = await discover(entry);
        assert.equal(result.state.cases[0].entry_hint.code, expected);
        assert.equal(
          result.state.cases[0].discovery.status,
          'CAPTURED',
          JSON.stringify(result.state.cases[0]),
        );
        assert.ok(!result.state.snapshots.some((p) => p.entry_hint_observation));
        assert.ok(result.requests.some((r) => r.url === '/home'));
        assert.ok(result.requests.some((r) => r.url === '/catalog'));
      });
    for (const entry of ['/redirect-outside', '/write-page'])
      await t.test(entry + ' cannot weaken existing redirect/write guard', async () => {
        const priorOutsideHits = outsideHits;
        const result = await discover(entry);
        assert.equal(result.state.cases[0].entry_hint.status, 'REJECTED');
        assert.notEqual(result.state.cases[0].discovery.status, 'CAPTURED');
        assert.equal(outsideHits, priorOutsideHits);
        assert.ok(!requests.some((r) => r.method === 'POST' && r.url === '/write'));
      });
    assert.equal(JSON.stringify(modelCalls).includes('page_entry_url'), false);
    assert.deepEqual(errors, []);
  },
);
