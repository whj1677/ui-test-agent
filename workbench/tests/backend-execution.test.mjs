import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { exampleEnvironment, exampleExecution } from '../server/backend/example.mjs';
import { backendDigest, executeBackendCase, validateBackendExecution } from '../server/backend/execution.mjs';

function input(base = 'http://127.0.0.1:4383') {
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', steps: [
    { order: 1, action: '查询原台账', expected: '只有DEV-001' },
    { order: 2, action: '提交重复编码', expected: '拒绝重复编码' },
    { order: 3, action: '重新查询', expected: '原台账不变' },
  ] };
  const hash = backendDigest(content).toUpperCase();
  return { caseVersion: { version: 1, content, content_sha256: hash }, binding: {
    binding_id: 'binding-test', version: 1, case_version: 1, case_content_sha256: hash,
    protocol_source_id: 'source-test', protocol_sha256: 'protocol-test', status: 'COMPLETE', confirmation_status: 'CONFIRMED',
  }, execution: structuredClone(exampleExecution), environment: { ...structuredClone(exampleEnvironment), base_url: base } };
}
function readonlyInput(base) {
  const args = input(base);
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', steps: [
    { order: 1, action: '查询关键词 Alpha', expected: '返回图书列表' },
    { order: 2, action: '用大小写变体查询 alpha', expected: '结果列表一致' },
  ] };
  const digest = backendDigest(content).toUpperCase();
  args.caseVersion = { version: 1, content, content_sha256: digest };
  args.binding = { ...args.binding, case_content_sha256: digest };
  args.environment = { id: 'env-readonly-test', environment_id: 'env-readonly-test', mode: 'http-json-readonly',
    base_url: base, non_production: true, authorized: true, reviewer: 'reviewer', allowed_methods: ['GET'], allowed_headers: [], allowed_path_prefixes: ['/api/books/'] };
  args.execution = { schema: 'workbench/backend-execution-v1', environment_id: args.environment.id, setup: [], cleanup: [], steps: [
    { order: 1, requests: [{ id: 'initial', method: 'GET', path: '/api/books?keyword=Alpha', assertions: [{ target: 'json', pointer: '/items', op: 'equals', value: [{ title: 'Alpha' }] }] }] },
    { order: 2, requests: [{ id: 'variant', method: 'GET', path: '/api/books?keyword=alpha', assertions: [{ target: 'json', pointer: '/items', op: 'equals', expected_from: { request_id: 'initial', pointer: '/items' } }] }] },
  ] };
  return args;
}
// This is a small protocol target for engineering tests, never a workbench instance.
async function target(t, options = {}) {
  const namespaces = new Map(), calls = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const parts = url.pathname.split('/');
    let data = '';
    for await (const chunk of req) data += chunk;
    const body = data ? JSON.parse(data) : {};
    calls.push({ method: req.method, path: url.pathname, body });
    const send = (status, value, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/__control/namespaces' && req.method === 'POST') {
      namespaces.set(body.runId, [{ code: 'DEV-001', name: '泵', site: '东站', ratedPowerKw: 80 }]);
      if (options.setupFail) return send(500, { runId: body.runId, created: false });
      if (options.alreadyExisted) return send(200, { runId: body.runId, created: false });
      return send(201, { runId: body.runId, created: true });
    }
    const runId = parts[3];
    if (url.pathname.startsWith('/__control/namespaces/') && req.method === 'DELETE') {
      if (options.cleanupFail) return send(500, { runId, deleted: false });
      return send(200, { runId, deleted: namespaces.delete(runId) });
    }
    const deviceRun = parts[4];
    if (url.pathname.startsWith('/api/v1/namespaces/') && req.method === 'GET') {
      if (options.redirect) return send(302, { runId: deviceRun }, { location: '/escape' });
      if (options.huge) return send(200, { runId: deviceRun, pad: 'x'.repeat(140000) });
      if (options.invalidJson) { res.end('not json'); return; }
      if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
      return send(200, { runId: deviceRun, items: namespaces.get(deviceRun) || [], total: (namespaces.get(deviceRun) || []).length,
        ...(options.secret ? { access_token: 'private-test-token', echoed: 'Bearer private-test-token' } : {}) });
    }
    if (url.pathname.startsWith('/api/v1/namespaces/') && req.method === 'POST') {
      if (options.badBusiness) return send(201, { runId: deviceRun, created: true });
      return send(409, { runId: deviceRun, created: false, error: { code: 'DUPLICATE_CODE' } });
    }
    return send(404, { error: 'not-found' });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });
  return { base: `http://127.0.0.1:${server.address().port}`, namespaces, calls };
}

test('HTTP JSON case sends real requests, checks unchanged business state and removes only its namespace', async t => {
  const site = await target(t); site.namespaces.set('unrelated-run', [{ code: 'KEEP' }]);
  const result = await executeBackendCase(input(site.base));
  assert.equal(result.status, 'PASSED'); assert.equal(result.complete_pass, true);
  assert.equal(result.model_calls, 0); assert.equal(result.requests_sent, 5);
  assert.deepEqual(result.steps.map(step => step.status), ['PASSED', 'PASSED', 'PASSED']);
  assert.equal(result.cleanup[0].status, 'PASSED');
  assert.equal(site.namespaces.has(result.run_id), false); assert.equal(site.namespaces.has('unrelated-run'), true);
  assert.match(site.calls.at(-1).path, new RegExp('/' + result.run_id + '$'));
});
test('unexpected business success remains FAILED and cleanup still runs', async t => {
  const site = await target(t, { badBusiness: true });
  const result = await executeBackendCase(input(site.base));
  assert.equal(result.status, 'FAILED'); assert.equal(result.complete_pass, false);
  assert.equal(result.steps[1].requests[0].assertions.find(a => a.pointer === '/created').actual, true);
  assert.equal(result.steps[2].status, 'NOT_RUN'); assert.equal(site.namespaces.has(result.run_id), false);
});
test('cancel aborts the active HTTP request without replay and completes scoped cleanup', async t => {
  const site = await target(t, { delay: 500 }); const control = new AbortController();
  const result = await executeBackendCase({ ...input(site.base), signal: control.signal, onEvidence: async event => {
    if (event.type === 'request-started' && event.request_id === 'before') setTimeout(() => control.abort(), 30);
  } });
  assert.equal(result.status, 'CANCELLED'); assert.equal(result.execution_status, 'CANCELLED');
  assert.equal(result.cleanup[0].status, 'PASSED'); assert.equal(site.namespaces.has(result.run_id), false);
  assert.equal(site.calls.filter(call => call.method === 'POST').length, 1);
});
test('request timeout is a technical failure, not a business pass, and still cleans up', async t => {
  const site = await target(t, { delay: 250 }); const args = input(site.base); args.execution.request_timeout_ms = 50;
  const result = await executeBackendCase(args);
  assert.equal(result.status, 'TIMED_OUT'); assert.equal(result.technical_error.code, 'BACKEND_TIMEOUT');
  assert.equal(result.cleanup[0].status, 'PASSED'); assert.equal(site.namespaces.has(result.run_id), false);
});
test('redirect is refused and never contacts redirect destination', async t => {
  const site = await target(t, { redirect: true }); const result = await executeBackendCase(input(site.base));
  assert.equal(result.status, 'ERROR'); assert.equal(result.technical_error.code, 'BACKEND_REDIRECT_REFUSED');
  assert.equal(site.calls.some(call => call.path === '/escape'), false); assert.equal(result.cleanup[0].status, 'PASSED');
});
test('secret keys and echoed tokens are redacted from result and emitted evidence', async t => {
  const site = await target(t, { secret: true }); const events = [];
  const result = await executeBackendCase({ ...input(site.base), onEvidence: event => events.push(event) });
  const text = JSON.stringify({ result, events });
  assert.equal(result.status, 'PASSED'); assert.equal(text.includes('private-test-token'), false); assert.ok(text.includes('[REDACTED]'));
});
test('cleanup failure prevents complete pass and records exact owned namespace for recovery', async t => {
  const site = await target(t, { cleanupFail: true }); const result = await executeBackendCase(input(site.base));
  assert.equal(result.status, 'FAILED'); assert.equal(result.complete_pass, false);
  assert.equal(result.cleanup_error.namespace_id, result.run_id); assert.equal(result.cleanup_error.manual_recovery_required, true);
});
test('unconfirmed/stale/changed case and binding are rejected before HTTP', () => {
  for (const mutate of [args => args.caseVersion.content.status = 'PENDING_CONFIRMATION', args => args.binding.confirmation_status = 'DRAFT', args => args.binding.case_version = 2, args => args.binding.applicability = 'STALE_CASE_VERSION', args => args.caseVersion.content.steps[0].expected = 'changed']) {
    const args = input(); mutate(args); assert.throws(() => validateBackendExecution(args), /BACKEND_/);
  }
});
test('200-only steps, missing original steps, unknown fields and unauthorized target are rejected', () => {
  for (const mutate of [args => args.execution.steps[0].requests[0].assertions = [{ target: 'status', op: 'equals', value: 200 }], args => args.execution.steps.pop(), args => args.execution.script = 'shell', args => args.environment.authorized = false, args => args.environment.non_production = false]) {
    const args = input(); mutate(args); assert.throws(() => validateBackendExecution(args), /BACKEND_/);
  }
});
test('file URLs, cross-origin, encoded traversal and undeclared headers fail closed', () => {
  for (const path of ['file:///C:/secret', '//example.com/api', '/api/v1/namespaces/{{runId}}/%2e%2e/devices', '/api/v1/namespaces/{{runId}}/%252e%252e/devices', '/api/v1/namespaces/{{runId}}/..\\devices', '/unregistered/path']) {
    const args = input(); args.execution.steps[0].requests[0].path = path; assert.throws(() => validateBackendExecution(args), /BACKEND_/);
  }
  const args = input(); args.execution.steps[0].requests[0].headers = { authorization: 'secret' };
  assert.throws(() => validateBackendExecution(args), /BACKEND_HEADERS_INVALID/);
});
test('write without namespace, static cleanup, wider cleanup and alien namespace are refused', () => {
  for (const mutate of [args => { args.execution.setup = []; args.execution.cleanup = []; }, args => args.execution.cleanup[0].path = '/__control/namespaces/other-run', args => args.execution.cleanup[0].path = '/__control/namespaces/', args => args.execution.steps[1].requests[0].path = '/api/v1/namespaces/other-run/devices']) {
    const args = input(); mutate(args); assert.throws(() => validateBackendExecution(args), /BACKEND_/);
  }
});
test('oversized and non-JSON responses are not silently accepted', async t => {
  for (const [options, code] of [[{ huge: true }, 'BACKEND_RESPONSE_TOO_LARGE'], [{ invalidJson: true }, 'BACKEND_RESPONSE_JSON_INVALID']]) {
    const site = await target(t, options); const result = await executeBackendCase(input(site.base));
    assert.equal(result.status, 'ERROR'); assert.equal(result.technical_error.code, code); assert.equal(result.complete_pass, false);
  }
});
test('metadata-only and existence-only business assertions cannot satisfy case coverage', () => {
  for (const assertion of [
    { target: 'json', pointer: '/runId', op: 'equals', value: '{{runId}}' },
    { target: 'json', pointer: '/ticket', op: 'equals', value: 'ticket' },
    { target: 'json', pointer: '/items', op: 'exists', value: true },
  ]) {
    const args = input(); args.execution.steps[0].requests[0].assertions = [assertion];
    assert.throws(() => validateBackendExecution(args), /BACKEND_BUSINESS_ASSERTION_REQUIRED/);
  }
});
test('registered namespace setup and cleanup must assert exact status and ownership outcomes', () => {
  for (const phase of ['setup', 'cleanup']) for (const omit of ['status', 'json']) {
    const args = input(); args.execution[phase][0].assertions = args.execution[phase][0].assertions.filter(assertion => assertion.target !== omit);
    assert.throws(() => validateBackendExecution(args), /BACKEND_(NAMESPACE_SETUP|CLEANUP_SCOPE|NAMESPACE_CLEANUP)/);
  }
});
test('setup 500 cannot pass or imply an existing foreign namespace; exact own cleanup is attempted', async t => {
  const site = await target(t, { setupFail: true }); const result = await executeBackendCase(input(site.base));
  assert.equal(result.status, 'FAILED'); assert.equal(result.complete_pass, false);
  assert.equal(result.setup[0].response.status, 500); assert.equal(result.steps[0].status, 'NOT_RUN');
  assert.equal(result.cleanup[0].status, 'PASSED'); assert.equal(site.namespaces.has(result.run_id), false);
  assert.equal(site.calls.filter(call => call.method === 'DELETE').length, 1);
});
test('explicit 200 created=false never deletes a namespace that already existed', async t => {
  const site = await target(t, { alreadyExisted: true }); const result = await executeBackendCase(input(site.base));
  assert.equal(result.status, 'FAILED'); assert.equal(result.complete_pass, false); assert.equal(result.cleanup.length, 0);
  assert.equal(site.namespaces.has(result.run_id), true); assert.equal(site.calls.filter(call => call.method === 'DELETE').length, 0);
});

test('ordinary HTTP JSON read-only mode executes registered GET queries and compares business results across responses', async t => {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push({ method: req.method, path: req.url });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ items: [{ title: 'Alpha' }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });
  const args = readonlyInput(`http://127.0.0.1:${server.address().port}`);
  const result = await executeBackendCase(args);
  assert.equal(result.status, 'PASSED'); assert.equal(result.complete_pass, true);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET']);
  assert.deepEqual(result.steps[1].requests[0].assertions[0], { target: 'json', pointer: '/items', op: 'equals', expected: [{ title: 'Alpha' }], actual: [{ title: 'Alpha' }], actual_exists: true, status: 'PASSED' });
  assert.deepEqual(result.setup, []); assert.deepEqual(result.cleanup, []);
});

test('read-only mode accepts business assertions against a root JSON array', async t => {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify([{ code: 'BK-001' }, { code: 'BK-002' }])); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });
  const args = readonlyInput(`http://127.0.0.1:${server.address().port}`);
  args.caseVersion.content.steps = [{ order: 1, action: '读取根列表', expected: '包含两本图书' }];
  args.caseVersion.content_sha256 = backendDigest(args.caseVersion.content).toUpperCase();
  args.binding.case_content_sha256 = args.caseVersion.content_sha256;
  args.execution.steps = [{ order: 1, requests: [{ id: 'root', method: 'GET', path: '/api/books', assertions: [
    { target: 'json', pointer: '', op: 'length', value: 2 },
    { target: 'json', pointer: '', op: 'equals', value: [{ code: 'BK-001' }, { code: 'BK-002' }] },
  ] }] }];
  const result = await executeBackendCase(args);
  assert.equal(result.status, 'PASSED'); assert.equal(result.complete_pass, true);
  assert.deepEqual(result.steps[0].requests[0].assertions.map(assertion => assertion.status), ['PASSED', 'PASSED']);
});

test('read-only mode rejects writes, cleanup, path-prefix lookalikes, encoded traversal and redirects', async t => {
  for (const mutate of [
    args => { args.execution.steps[0].requests[0].method = 'POST'; },
    args => { args.execution.cleanup = [{ id: 'clean', method: 'DELETE', path: '/api/books/1', assertions: [{ target: 'json', pointer: '/deleted', op: 'equals', value: true }] }]; },
    args => { args.execution.steps[0].requests[0].path = '/api/bookstore/1'; },
    args => { args.execution.steps[0].requests[0].path = '/api/books/%252e%252e/admin'; },
    args => { args.environment.base_url = 'http://user:pass@127.0.0.1:4401'; },
    args => { args.execution.steps[0].requests[0].path = 'http://example.com/api/books'; },
  ]) {
    const args = readonlyInput('http://127.0.0.1:4401'); mutate(args);
    assert.throws(() => validateBackendExecution(args), /BACKEND_/);
  }
  let escaped = false;
  const redirectTarget = http.createServer((req, res) => { escaped = true; res.end('{}'); });
  redirectTarget.listen(0, '127.0.0.1'); await once(redirectTarget, 'listening');
  t.after(async () => { redirectTarget.closeAllConnections(); redirectTarget.close(); await once(redirectTarget, 'close'); });
  const redirectServer = http.createServer((req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${redirectTarget.address().port}/escape` }); res.end(); });
  redirectServer.listen(0, '127.0.0.1'); await once(redirectServer, 'listening');
  t.after(async () => { redirectServer.closeAllConnections(); redirectServer.close(); await once(redirectServer, 'close'); });
  const result = await executeBackendCase(readonlyInput(`http://127.0.0.1:${redirectServer.address().port}`));
  assert.equal(result.status, 'ERROR'); assert.equal(result.technical_error.code, 'BACKEND_REDIRECT_REFUSED'); assert.equal(escaped, false);
});
test('record fields swapped across rows evade scalar membership checks but fail per-record literal checks', async t => {
  const rows = [{ code: 'DEV001', name: '冷却泵', power: 110 }, { code: 'DEV007', name: '循环泵', power: 80 }];
  const server = http.createServer((req, res) => {
    const code = new URL(req.url, 'http://localhost').searchParams.get('code');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ items: code ? rows.filter(row => row.code === code) : rows }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const args = readonlyInput(`http://127.0.0.1:${server.address().port}`);
  const weak = [
    { target: 'json', pointer: '/items', op: 'array_some_field_equals', field: 'code', value: 'DEV001' },
    { target: 'json', pointer: '/items', op: 'array_some_field_equals', field: 'name', value: '循环泵' },
    { target: 'json', pointer: '/items', op: 'array_some_field_equals', field: 'power', value: 80 },
  ];
  args.execution.steps[0].requests = [{ id: 'weak', method: 'GET', path: '/api/books', assertions: weak }];
  args.execution.steps[1].requests = [{ id: 'weakAgain', response_ref: 'weak', assertions: weak }];
  assert.equal((await executeBackendCase(args)).status, 'PASSED', 'independent membership admits the counterexample');
  args.execution.steps[0].requests = [{ id: 'correlated', method: 'GET', path: '/api/books?code=DEV001', assertions: [
    { target: 'json', pointer: '/items', op: 'length', value: 1 },
    { target: 'json', pointer: '/items/0/code', op: 'equals', value: 'DEV001' },
    { target: 'json', pointer: '/items/0/name', op: 'equals', value: '循环泵' },
    { target: 'json', pointer: '/items/0/power', op: 'equals', value: 80 },
  ] }];
  args.execution.steps[1].requests = [{ id: 'correlatedAgain', response_ref: 'correlated', assertions: args.execution.steps[0].requests[0].assertions }];
  const strong = await executeBackendCase(args);
  assert.equal(strong.status, 'FAILED');
  assert(strong.steps[0].requests[0].assertions.some(item => item.status === 'FAILED'));
});
