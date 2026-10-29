import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { backendDigest, executeBackendCase, validateBackendExecution } from '../server/backend/execution.mjs';

const headerAssertion = () => ({ target: 'header', pointer: '/content-type', op: 'media_type_equals', value: 'application/json' });
async function fixture(t, contentType = 'application/json', withRef = false) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    response.statusCode = 200;
    if (contentType !== null) response.setHeader('Content-Type', contentType);
    response.end(JSON.stringify({ items: [{ code: 'BK-001' }], total: 1 }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });
  const environment = { id: 'env-content-type', non_production: true, authorized: true, mode: 'http-json-readonly',
    base_url: `http://127.0.0.1:${server.address().port}`, allowed_path_prefixes: ['/api/'], allowed_methods: ['GET'], allowed_headers: [] };
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', steps: [
    { order: 1, action: '查询图书', expected: '返回 BK-001 且 total 为 1' },
    ...(withRef ? [{ order: 2, action: '复核已取得响应', expected: '响应内容保持一致' }] : []),
  ] };
  const caseVersion = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const binding = { binding_id: 'binding-content-type', version: 1, status: 'COMPLETE', confirmation_status: 'CONFIRMED',
    case_version: 1, case_content_sha256: caseVersion.content_sha256, protocol_source_id: 'protocol-content-type', protocol_sha256: 'A'.repeat(64) };
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.id, setup: [], cleanup: [], steps: [
    { order: 1, requests: [{ id: 'books', method: 'GET', path: '/api/books', assertions: [
      { target: 'status', op: 'equals', value: 200 }, { target: 'json', pointer: '/items/0/code', op: 'equals', value: 'BK-001' }, headerAssertion(),
    ] }] },
    ...(withRef ? [{ order: 2, requests: [{ id: 'recheck', response_ref: 'books', assertions: [
      { target: 'json', pointer: '/total', op: 'equals', expected_from: { request_id: 'books', pointer: '/total' } }, headerAssertion(),
    ] }] }] : []),
  ] };
  return { environment, caseVersion, binding, execution, requests };
}

test('exact JSON Content-Type and case-insensitive single charset pass against actual HTTP evidence', async t => {
  for (const raw of ['application/json', 'Application/JSON; Charset=UTF-8', 'application/json; charset="utf-8"']) {
    const args = await fixture(t, raw);
    const result = await executeBackendCase(args);
    assert.equal(result.status, 'PASSED', raw);
    assert.equal(result.steps[0].requests[0].response.headers['content-type'], raw);
    const header = result.steps[0].requests[0].assertions.find(a => a.target === 'header');
    assert.equal(header.status, 'PASSED'); assert.equal(header.actual, raw); assert.equal(header.expected, 'application/json');
    assert.equal(result.steps[0].requests[0].assertions.find(a => a.target === 'json').status, 'PASSED');
  }
});

test('parseable JSON body cannot pass wrong, missing, or malformed Content-Type', async t => {
  for (const raw of ['text/plain', null, 'application/json; boundary=x', 'application/json; charset=utf-8; charset=ascii', 'application/json; charset=']) {
    const args = await fixture(t, raw);
    const result = await executeBackendCase(args);
    assert.equal(result.status, 'FAILED', String(raw));
    const record = result.steps[0].requests[0];
    assert.equal(record.assertions.find(a => a.target === 'json').status, 'PASSED');
    assert.equal(record.assertions.find(a => a.target === 'header').status, 'FAILED');
    assert.equal(record.response.json.items[0].code, 'BK-001');
    assert.equal(record.response.headers['content-type'], raw);
  }
});

test('response_ref reuses the original HTTP Content-Type and does not dispatch another request', async t => {
  const args = await fixture(t, 'text/plain', true);
  // The first request intentionally checks only the business JSON, so its
  // response can be independently rechecked in the next original case step.
  args.execution.steps[0].requests[0].assertions.pop();
  const result = await executeBackendCase(args);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.steps[0].status, 'PASSED');
  assert.equal(result.steps[1].status, 'FAILED');
  assert.equal(result.requests_sent, 1);
  assert.deepEqual(args.requests, ['/api/books']);
  const original = result.steps[0].requests[0], ref = result.steps[1].requests[0];
  assert.equal(original.response.headers['content-type'], 'text/plain');
  assert.deepEqual(ref.response.headers, original.response.headers);
  assert.deepEqual(ref.response.json, original.response.json);
  assert.equal(ref.assertions.find(a => a.target === 'header').status, 'FAILED');
  assert.equal(ref.assertions.find(a => a.target === 'json').status, 'PASSED');
});

test('new header assertion is narrowly validated and cannot replace a business assertion', async t => {
  const args = await fixture(t);
  for (const change of [
    { target: 'header', pointer: '/authorization', op: 'media_type_equals', value: 'application/json' },
    { target: 'header', pointer: '/content-type', op: 'equals', value: 'application/json' },
    { target: 'header', pointer: '/content-type', op: 'media_type_equals', value: 'text/plain' },
    { ...headerAssertion(), expected_from: { request_id: 'books', pointer: '/x' } },
    { ...headerAssertion(), field: 'code' },
  ]) {
    const execution = structuredClone(args.execution);
    execution.steps[0].requests[0].assertions[2] = change;
    assert.throws(() => validateBackendExecution({ ...args, execution }), /BACKEND_ASSERTION_INVALID/);
  }
  const execution = structuredClone(args.execution);
  execution.steps[0].requests[0].assertions = [headerAssertion(), { target: 'status', op: 'equals', value: 200 }];
  assert.throws(() => validateBackendExecution({ ...args, execution }), /BACKEND_BUSINESS_ASSERTION_REQUIRED/);
});

test('schema v1 old plans retain their input digest and run without a header assertion', async t => {
  const args = await fixture(t, 'text/plain');
  args.execution.steps[0].requests[0].assertions.pop();
  const before = JSON.stringify(args.execution);
  const digest = backendDigest(args.execution);
  const checked = validateBackendExecution(args);
  assert.equal(checked.execution_sha256, digest);
  assert.equal(JSON.stringify(args.execution), before);
  const result = await executeBackendCase(args);
  assert.equal(result.status, 'PASSED');
  assert.equal(result.execution_sha256, digest);
  assert.equal(result.steps[0].requests[0].assertions.length, 2);
});
