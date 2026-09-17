import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { checkAssertionGroup } from '../src/browser.mjs';
import { fixtureModelPhase, fixtureAuditReply } from './fixture-model.mjs';

// Real Chromium contexts, console backend and local synthetic site. The model
// transport is injected; this does not establish real-model or business quality.
const directory = path.resolve('validation', 'preparation-browser-' + Date.now());
const requests = [],
  calls = [],
  failures = [];
const fixture = http.createServer((req, res) => {
  requests.push({ method: req.method, path: new URL(req.url, 'http://fixture').pathname });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const devices = req.url.startsWith('/devices');
  res.end(
    '<meta charset="utf-8"><title>隔离探索合成站</title><style>body{font:18px sans-serif;padding:32px}nav{margin:24px 0}</style>' +
      '<strong data-testid="signed-in">本机合成用户</strong><nav><a data-testid="devices-menu" href="/devices">设备目录</a></nav>' +
      (devices ? '<h1 data-testid="devices-heading">设备目录</h1>' : '<h1>工作台</h1>'),
  );
});
await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const target = 'http://127.0.0.1:' + fixture.address().port;
const cases = Array.from({ length: 2 }, (_, i) => ({
  case_id: 'PAR-' + (i + 1),
  title: '独立菜单导航 ' + (i + 1),
  source_side: 'ui',
  preconditions: '已登录工作台。',
  steps: [
    {
      step_id: 'S1',
      action: '点击设备目录菜单。',
      expected: '页面URL包含 /devices；页面URL不包含 legacy。',
      requires_click: true,
      obligations: [
        { id: 'S1-O1', text: '页面URL包含 /devices' },
        { id: 'S1-O2', text: '页面URL不包含 legacy' },
      ],
    },
  ],
}));
let app,
  release,
  signalOverlap,
  cancelMode = false;
const gate = new Promise((r) => {
  release = r;
});
const overlap = new Promise((r) => {
  signalOverlap = r;
});
let first = new Set();
const bounded = async (promise, label, ms = 30000) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
function makePlan(input) {
  const c = input.original,
    step = c.steps[0];
  return {
    plan: {
      schema_version: 'ui-agent-plan/v2',
      case_id: c.case_id,
      case_hash: input.case_hash,
      entry_path: '/',
      data_effect: 'read_only',
      preconditions: [{ target: { kind: 'testid', value: 'signed-in' }, check: 'visible' }],
      steps: [
        {
          step_id: 'S1',
          source_action: step.action,
          source_expected: step.expected,
          actions: [
            { action_id: 'A1', op: 'click', target: { kind: 'testid', value: 'devices-menu' } },
          ],
          assertion_mode: 'simultaneous',
          within_ms: 8000,
          assertions: step.obligations.map((o, i) => ({
            target: { kind: 'testid', value: 'devices-heading' },
            check: i === 0 ? 'url_contains' : 'url_not_contains',
            expected: i === 0 ? '/devices' : 'legacy',
            oracle_quote: o.text,
            obligation_ids: [o.id],
          })),
        },
      ],
      cleanup: null,
      notes: '仅查看菜单和地址栏，不提交业务写入。',
    },
  };
}
const provider = new DeepSeek({
  key: 'synthetic-local-only',
  fetchImpl: async (_url, options) => {
    try {
      const body = JSON.parse(options.body),
        input = JSON.parse(body.messages[1].content);
      const phase = fixtureModelPhase(body.messages[0].content, input);
      calls.push({ phase, case_id: input.case?.case_id ?? input.original?.case_id });
      let value;
      if (phase === 'discovery') {
        if (!first.has(input.case.case_id)) {
          first.add(input.case.case_id);
          if (first.size === 2) signalOverlap();
          if (cancelMode)
            await new Promise((_, reject) => {
              if (options.signal.aborted) return reject(options.signal.reason);
              options.signal.addEventListener('abort', () => reject(options.signal.reason), {
                once: true,
              });
            });
          else await bounded(gate, 'both independent discovery contexts did not enter the model');
        }
        if (new URL(input.current.url).pathname === '/devices')
          value = { done: true, reason: '入口和页面锚点已取证，未执行断言。' };
        else {
          const candidate = input.candidates.find((c) => c.name === '设备目录');
          assert.ok(candidate);
          value = {
            action: { candidate_id: candidate.candidate_id },
            reason: '采集设备目录页面结构。',
          };
        }
      } else if (phase === 'input_review') value = { issues: [] };
      else if (phase === 'plan_audit')
        value = fixtureAuditReply(input.original, input.candidate_plan);
      else {
        assert.equal(phase, 'plan');
        value = makePlan(input);
      }
      return new Response(
        JSON.stringify({
          model: 'synthetic-injected',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }],
        }),
        { status: 200 },
      );
    } catch (e) {
      if (!options.signal.aborted) failures.push(e.stack);
      throw e;
    }
  },
});
try {
  app = await start({ port: 0, dataDir: path.join(directory, 'data'), headless: true, provider });
  const id = await app.store.create({
    name: '真实浏览器两路准备验证',
    target: target + '/',
    baseline: { schema_version: 'parallel-fixture/v1', case_count: cases.length, cases },
  });
  await app.controller.configure(id, { nonproduction: true, writes: false, readOnlyEndpoints: [] });
  for (const c of cases)
    await app.controller.confirmCase(id, c.case_id, {
      steps: c.steps.map(({ requires_click, ...step }) => step),
      note: '合成用例原文与完整分项已核对。',
    });
  await app.controller.openBrowser(id);
  await app.controller.authenticate(id, { kind: 'testid', value: 'signed-in' });
  await app.controller.launch(
    id,
    'discover',
    cases.map((c) => c.case_id),
    { concurrency: 2, independent_readonly: true },
  );
  const job = app.controller.active;
  await bounded(overlap, 'parallel workers never overlapped');
  assert.equal(
    app.browser.browser.contexts().length,
    3,
    'one untouched login context plus TWO independent discovery contexts',
  );
  const view = await app.controller.view(id);
  assert.equal(view.active.workers.length, 2);
  assert.equal(new Set(view.active.workers.map((w) => w.case_id)).size, 2);
  assert.equal(app.browser.loginPage.url(), target + '/');
  release();
  await bounded(job.finished, 'parallel prepare did not finish', 60000);
  const state = await app.store.read(id);
  assert.deepEqual(failures, []);
  assert.deepEqual(
    state.cases.map((r) => r.status),
    ['PLAN_REVIEW', 'PLAN_REVIEW'],
  );
  assert.ok(
    state.cases.every(
      (r) => !r.plan_approved && !r.attempts.length && r.plan.case_id === r.case_id,
    ),
  );
  assert.ok(state.cases.every((r) => r.navigation_start.url === target + '/'));
  assert.equal(app.browser.browser.contexts().length, 1);
  for (const row of state.cases) {
    const { planHash } = await import('../src/plans.mjs');
    await app.controller.approvePlan(id, row.case_id, planHash(row.plan));
  }
  assert.ok(
    (await app.store.read(id)).cases.every((r) => !r.attempts.length),
    'plan approval cannot auto-run',
  );
  const observations = (await app.controller.diagnostics(id)).records.filter(
    (r) => r.type === 'MODEL_REQUEST',
  );
  assert.ok(observations.every((r) => r.worker_id === r.case_id));
  assert.equal(new Set(observations.map((r) => r.call_number)).size, observations.length);

  const context = await app.browser.browser.newContext();
  const page = await context.newPage();
  await page.goto(target + '/devices?token=must-not-persist#legacy');
  const checks = [
    { check: 'url_equals', expected: target + '/devices?token=must-not-persist#legacy' },
    { check: 'url_contains', expected: '#legacy' },
    { check: 'url_not_contains', expected: 'absent-text' },
    { check: 'url_not_contains', expected: 'legacy' },
  ].map((a) => ({ ...a, target: { kind: 'testid', value: 'devices-heading' } }));
  // This verifies URL semantics/redaction, not a 120ms performance contract.
  const results = await checkAssertionGroup(page, checks, { timeout: 1500 });
  assert.deepEqual(
    results.map((r) => r.passed),
    [true, true, true, false],
    JSON.stringify(results),
  );
  assert.ok(results.every((r) => r.actual.query_fragment_redacted));
  assert.ok(results.every((r) => !JSON.stringify(r.actual).includes('must-not-persist')));
  assert.equal(
    new Set(results.map((r) => r.sample_id)).size,
    1,
    'URL and DOM assertions use one observation instant',
  );
  await context.close();

  // Fresh session invalidates both checkpoints. Stop both active readonly
  // workers, retain previous results, and keep the login browser alive.
  cancelMode = true;
  first = new Set();
  app.controller.discoverySessionKey = 'new-synthetic-session';
  await app.controller.launch(
    id,
    'discover',
    cases.map((c) => c.case_id),
    { concurrency: 2, independent_readonly: true },
  );
  const cancelled = app.controller.active;
  const deadline = Date.now() + 20000;
  while (first.size < 2 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  assert.equal(first.size, 2);
  await app.controller.stop(id);
  await bounded(cancelled.finished, 'cancellation did not release both contexts');
  assert.equal((await app.store.read(id)).status, 'STOPPED');
  assert.equal(app.browser.browser.contexts().length, 1);
  assert.equal(requests.filter((r) => !['GET', 'HEAD'].includes(r.method)).length, 0);
  assert.equal((await app.store.read(id)).cases.flatMap((r) => r.attempts).length, 0);
  console.log(
    JSON.stringify({
      validated: true,
      contexts_at_overlap: 3,
      unexpected_business_writes: 0,
      url_checks: results.map((r) => r.passed),
      cancellation: 'two workers closed, login preserved',
      real_model_calls: 0,
      directory,
    }),
  );
} finally {
  release();
  await app?.close();
  await new Promise((resolve) => fixture.close(resolve));
}
