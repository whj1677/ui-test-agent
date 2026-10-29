import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProjectWorkflow } from '../web-v2/project-workflow.js';

const route = '#/projects/loading-project';
const turn = () => new Promise(resolve => setImmediate(resolve));
const cases = Array.from({ length: 73 }, (_, index) => {
  const case_id = `case-${index + 1}`, case_type = index === 72 ? 'BACKEND' : 'UI';
  return { case_id, current_version: 1, versions: [{ version: 1, content: {
    external_id: `TC-${index + 1}`, title: `隔离样本 ${index + 1}`, status: 'CONFIRMED', case_type,
  } }] };
});
const project = { project_id: 'loading-project', name: '73 条用例加载测试', cases };

function requestKind(url) {
  if (url.endsWith('/environment')) return 'environment';
  if (url.endsWith('/script-operations/preflight')) return 'ui-preflight';
  if (url.endsWith('/script-operations')) return 'ui-history';
  if (url.includes('/backend/preparation')) return 'backend-preparation';
  if (url.endsWith('/backend/generation-batches')) return 'backend-history';
  if (url.endsWith('/batches/preflight')) return 'run-preflight';
  if (url.endsWith('/backend')) return 'run-plans';
  throw Error(`Unexpected mocked request: ${url}`);
}

function responseBody(kind, options) {
  switch (kind) {
    case 'environment': return {
      ui: { id: 'ui-env', auth_required: false, ready: true }, ui_environment_id: 'ui-env',
      backend: { id: 'backend-env', reviewer: '测试核对人' },
    };
    case 'ui-preflight': return { items: JSON.parse(options.body).items.map(item => ({ ...item, state: 'QUEUED', reason: null })) };
    case 'ui-history': return { operations: [] };
    case 'backend-preparation': return {
      items: [{ case_id: 'case-73', case_version: 1, external_id: 'TC-73', status: 'READY' }],
      protocols: [], protocol_source_id: 'test-protocol', preparation_sha256: 'test-preparation', model_available: true,
      limits: { generation: { wall_ms: 60_000, tool_calls: 20, harness_starts: 1, self_tests: 1 } },
    };
    case 'backend-history': return { batches: [] };
    case 'run-preflight': return { items: cases.map(item => ({ case_id: item.case_id, case_version: 1, state: 'QUEUED', reason: null })) };
    case 'run-plans': return { plans: [{ case_id: 'case-73', case_version: 1, state: 'CONFIRMED' }] };
    default: throw Error(`No response body for ${kind}`);
  }
}

function fixture(t, { holdEnvironment = false } = {}) {
  const original = Object.fromEntries(['fetch', 'document', 'window', 'location'].map(key => [key, {
    exists: Object.hasOwn(globalThis, key), value: globalThis[key],
  }]));
  const requests = [], shown = [], writes = [], launches = [], events = new Map();
  let activeNodes = new Map(), html = '', renderPromise, renderDone = false, dispose;
  const location = { hash: route };
  const node = selector => {
    if (!activeNodes.has(selector)) {
      const values = { innerHTML: '', textContent: '', disabled: false, hidden: false, open: false };
      const value = {
        value: '', checked: false, attributes: {}, inputs: [], isConnected: true,
        setAttribute(key, text) { this.attributes[key] = text; writes.push({ selector, key, text }); },
        classList: { toggle() {} },
        addEventListener(name, handler) { this[`on${name}`] = handler; },
        click() { return this.onclick?.(); },
        querySelector() { return null; },
        querySelectorAll(query) { return query === '[data-pw-case]' ? this.inputs : []; },
      };
      for (const property of Object.keys(values)) Object.defineProperty(value, property, {
        get: () => values[property],
        set: next => {
          values[property] = next; writes.push({ selector, property, next });
          if (property === 'innerHTML') value.inputs = [...String(next).matchAll(/<input type="checkbox" data-pw-case="([^"]+)"[^>]*>/g)]
            .map(match => ({ dataset: { pwCase: match[1] }, checked: /\schecked[ >]/.test(match[0]) }));
        },
      });
      activeNodes.set(selector, value);
    }
    return activeNodes.get(selector);
  };
  globalThis.document = { querySelector: node };
  globalThis.location = location;
  globalThis.window = {
    location,
    addEventListener(name, handler) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(handler);
    },
    removeEventListener(name, handler) {
      events.get(name)?.delete(handler);
      if (!events.get(name)?.size) events.delete(name);
    },
  };
  // The mock deliberately ignores AbortSignal while pending. This models a
  // response that won the transport race; the view's live guard still matters.
  globalThis.fetch = (url, options = {}) => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const request = { url, kind: requestKind(url), options, resolve, promise, settled: false };
    requests.push(request);
    if (request.kind === 'environment' && !holdEnvironment) settle(request);
    return promise;
  };
  function settle(request, ok = true) {
    if (request.settled) return;
    request.settled = true;
    request.resolve({ ok, status: ok ? 200 : 503,
      json: async () => ok ? responseBody(request.kind, request.options) : { error: 'HISTORY_READ_FAILED' } });
  }
  const f = {
    node, requests, shown, writes, launches, events,
    get html() { return html; },
    get renderDone() { return renderDone; },
    start() {
      renderPromise = renderProjectWorkflow({ project, isCurrent: () => location.hash === route,
        showPage: content => { html = content; shown.push(content); },
        go: () => { throw Error('No navigation should be launched by a loading check'); },
        launchBatch: (...args) => launches.push(args),
      });
      renderPromise.then(value => { renderDone = true; dispose = value; }, () => { renderDone = true; });
      return renderPromise;
    },
    settle(kind, ok = true) {
      const request = requests.find(item => item.kind === kind && !item.settled);
      assert.ok(request, `pending ${kind} request must exist`); settle(request, ok);
    },
    navigate(hash) {
      location.hash = hash;
      for (const handler of [...(events.get('hashchange') || [])]) handler();
    },
    replacePage() {
      for (const value of activeNodes.values()) value.isConnected = false;
      activeNodes = new Map(); html = '<p>新页面的内容</p>';
      node('#new-page').textContent = '新页面的提示';
    },
    selectFirstUi() {
      const input = node('#pw-run-table').inputs.find(item => item.dataset.pwCase === 'case-1');
      assert.ok(input, 'the case selection must exist before slow preflight completes');
      input.checked = true; input.onchange();
    },
    async complete(ok = true) {
      // A deterministic event-loop drain, not a wall-time performance threshold.
      for (let index = 0; index < 8 && !renderDone; index += 1) {
        for (const request of requests) settle(request, ok);
        await turn();
      }
      return renderPromise;
    },
  };
  t.after(async () => {
    try { if (renderPromise) await f.complete(); }
    finally {
      dispose?.();
      for (const [key, previous] of Object.entries(original)) {
        if (previous.exists) globalThis[key] = previous.value;
        else delete globalThis[key];
      }
    }
  });
  return f;
}

test('73 cases paint before slow preflights and unfinished checks keep generation and execution disabled', async t => {
  const f = fixture(t); f.start(); await turn();
  assert.equal(f.shown.length, 1, 'first paint must not await UI, history or run preflight responses');
  assert.match(f.html, /全部用例 <span>73<\/span>/);
  assert.match(f.html, /批量生成前端脚本/);
  assert.equal(f.renderDone, false, 'the loading work is still actually pending');
  f.selectFirstUi();
  for (const selector of ['#pw-generate-ui', '#pw-generate-backend', '#pw-run-selected']) {
    assert.equal(f.node(selector).disabled, true, `${selector} must remain blocked while checking`);
    assert.equal(typeof f.node(selector).onclick, 'function', 'first paint includes bound controls');
    await f.node(selector).onclick();
  }
  assert.deepEqual(f.launches, []);
  assert.ok(!f.requests.some(request => request.options.method === 'POST' &&
    /\/script-operations$|\/generation-batches$/.test(request.url)));
});

test('initial UI, backend and execution groups settle independently without enabling a partially checked group', async t => {
  const f = fixture(t); f.start(); await turn(); f.selectFirstUi();
  f.settle('ui-preflight'); await turn();
  assert.equal(f.node('#pw-generate-ui').disabled, true, 'UI readiness alone cannot bypass unread script history');
  f.settle('ui-history'); await turn();
  assert.equal(f.node('#pw-generate-ui').disabled, false, 'finished UI checks must not wait for other groups');
  assert.equal(f.node('#pw-generate-backend').disabled, true);
  assert.equal(f.node('#pw-run-selected').disabled, true);
  assert.equal(f.renderDone, false);
  f.settle('backend-preparation'); await turn();
  assert.equal(f.node('#pw-generate-backend').disabled, true, 'backend preparation alone cannot bypass unread history');
  f.settle('backend-history'); await turn();
  assert.equal(f.node('#pw-generate-backend').disabled, false);
  assert.equal(f.node('#pw-run-selected').disabled, true);
  f.settle('run-preflight'); await turn();
  assert.equal(f.node('#pw-run-selected').disabled, true, 'execution waits for applicable backend plans too');
  f.settle('run-plans'); await f.complete();
  assert.equal(f.node('#pw-run-selected').disabled, false);
  assert.deepEqual(f.launches, [], 'settling readiness never starts execution');
});

test('failed initial script history cannot turn ready UI preflight into permission to generate', async t => {
  const f = fixture(t); f.start(); await turn();
  f.settle('ui-preflight'); f.settle('ui-history', false); await f.complete();
  assert.equal(f.node('#pw-generate-ui').disabled, true);
  assert.equal(f.node('#pw-recheck-ui').disabled, false, 'history failure permits an explicit retry');
  assert.match(f.node('#pw-ui-error').textContent, /进度|历史|重新检查|重查/);
  assert.deepEqual(f.launches, []);
});

for (const ok of [true, false]) test(`late initial ${ok ? 'success' : 'failure'} after leaving and returning to the same route cannot change the new page`, async t => {
  const f = fixture(t); f.start(); await turn();
  assert.equal(f.shown.length, 1);
  const pending = f.requests.filter(request => !request.settled);
  assert.ok(pending.length >= 4, 'several independent reads remain in flight');
  f.navigate('#/projects/another-project');
  assert.equal(f.events.size, 0);
  assert.ok(pending.every(request => request.options.signal?.aborted), 'navigation aborts each pending initial read');
  f.navigate(route); f.replacePage();
  const beforeWrites = f.writes.length, beforeShown = f.shown.length;
  await f.complete(ok);
  assert.equal(f.shown.length, beforeShown);
  assert.equal(f.html, '<p>新页面的内容</p>');
  assert.equal(f.node('#new-page').textContent, '新页面的提示');
  assert.deepEqual(f.writes.slice(beforeWrites), [], 'neither success nor error cleanup can mutate another page');
  assert.deepEqual(f.launches, []);
});

test('navigation while the initial environment read is pending aborts it and prevents an old first paint', async t => {
  const f = fixture(t, { holdEnvironment: true }); f.start(); await turn();
  assert.equal(f.shown.length, 0);
  assert.ok(f.events.has('hashchange'), 'dispose is registered before awaiting the environment');
  const environment = f.requests.find(request => request.kind === 'environment');
  f.navigate('#/projects/another-project');
  assert.equal(environment.options.signal?.aborted, true);
  f.navigate(route); f.replacePage();
  const beforeWrites = f.writes.length;
  await f.complete();
  assert.equal(f.shown.length, 0);
  assert.equal(f.requests.length, 1, 'a disposed environment response must not start further project reads');
  assert.equal(f.html, '<p>新页面的内容</p>');
  assert.deepEqual(f.writes.slice(beforeWrites), []);
});
