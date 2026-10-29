import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { backendDigest, executeBackendCase, validateBackendExecution } from '../server/backend/execution.mjs';
import { exampleEnvironment, exampleExecution } from '../server/backend/example.mjs';

const clone = value => structuredClone(value);
const equal = (pointer, value) => ({ target: 'json', pointer, op: 'equals', value });
const length = (pointer, value) => ({ target: 'json', pointer, op: 'length', value });

async function pagingSut(t) {
  const all = Array.from({ length: 8 }, (_, index) => ({ code: `BK-${String(index + 1).padStart(3, '0')}`, title: `Book ${index + 1}` }));
  const requests = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push({ method: request.method, path: url.pathname, page: url.searchParams.get('page') });
    const page = Number(url.searchParams.get('page') || 1);
    const start = (page - 1) * 5;
    const items = all.slice(start, start + 5);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items, total: all.length, page, pages: 2, page_size: 5, sessionToken: 'synthetic-secret-value' }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });

  const environment = { id: 'env-response-ref-test', non_production: true, authorized: true, mode: 'http-json-readonly',
    base_url: `http://127.0.0.1:${server.address().port}`, allowed_path_prefixes: ['/api/'], allowed_methods: ['GET'], allowed_headers: [] };
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-PAGING-REF-001', title: '分页完整性', steps: [
    { order: 1, action: '读取第1页。', expected: '第1页5条，编号BK-001至BK-005。' },
    { order: 2, action: '读取第2页。', expected: '第2页3条，编号BK-006至BK-008。' },
    { order: 3, action: '复核已读取的两页响应。', expected: '两页合计8条，编号BK-001至BK-008，无重复、无遗漏。' },
  ] };
  const caseVersion = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const binding = { status: 'COMPLETE', confirmation_status: 'CONFIRMED', case_version: 1,
    case_content_sha256: caseVersion.content_sha256, binding_id: 'binding-response-ref', version: 1,
    protocol_source_id: 'protocol-response-ref', protocol_sha256: 'A'.repeat(64) };
  const codes = from => Array.from({ length: 8 }, (_, index) => `BK-${String(index + 1).padStart(3, '0')}`).slice(from, from + (from === 0 ? 5 : 3));
  const pageAssertions = expectedCodes => [
    length('/items', expectedCodes.length), equal('/total', 8), equal('/pages', 2), equal('/page_size', 5),
    ...expectedCodes.map((code, index) => equal(`/items/${index}/code`, code)),
  ];
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.id, setup: [], cleanup: [],
    steps: [
      { order: 1, requests: [{ id: 'page1', method: 'GET', path: '/api/books?page=1', assertions: pageAssertions(codes(0)) }] },
      { order: 2, requests: [{ id: 'page2', method: 'GET', path: '/api/books?page=2', assertions: pageAssertions(codes(5)) }] },
      { order: 3, requests: [
        { id: 'verify-page1', response_ref: 'page1', assertions: pageAssertions(codes(0)) },
        { id: 'verify-page2', response_ref: 'page2', assertions: pageAssertions(codes(5)) },
      ] },
    ] };
  return { environment, caseVersion, binding, execution, requests };
}

test('response-reference records verify both prior page responses without extra HTTP dispatch', async t => {
  const fixture = await pagingSut(t);
  const checked = validateBackendExecution({ ...fixture, execution: fixture.execution, environment: fixture.environment });
  assert.equal(checked.execution_sha256, backendDigest(fixture.execution));
  const result = await executeBackendCase({ ...fixture, execution: fixture.execution });

  assert.equal(result.status, 'PASSED');
  assert.equal(result.complete_pass, true);
  assert.equal(result.requests_sent, 2, 'only real HTTP dispatches are counted');
  assert.deepEqual(fixture.requests.map(request => request.page), ['1', '2']);
  assert.equal(result.steps[2].requests.length, 2);
  assert.deepEqual(result.steps[2].requests.map(record => record.request), [
    { kind: 'response-reference', source_request_id: 'page1' },
    { kind: 'response-reference', source_request_id: 'page2' },
  ]);
  assert.equal(result.steps[2].requests[0].response.status, 200);
  assert.deepEqual(result.steps[2].requests[0].response.json, result.steps[0].requests[0].response.json);
  assert.deepEqual(result.steps[2].requests[1].response.json, result.steps[1].requests[0].response.json);
  assert.equal(result.steps[2].requests[0].response.json.sessionToken, '[REDACTED]');
  assert.equal(JSON.stringify(result).includes('synthetic-secret-value'), false);
  assert.ok(result.steps[2].requests.every(record => record.assertions.every(assertion => assertion.status === 'PASSED')));
});

test('a changed response-reference expectation fails without sending another request', async t => {
  const fixture = await pagingSut(t);
  const execution = clone(fixture.execution);
  execution.steps[2].requests[1].assertions.find(assertion => assertion.pointer === '/items/2/code').value = 'BK-009';
  const result = await executeBackendCase({ ...fixture, execution });
  const failed = result.steps[2].requests[1].assertions.find(assertion => assertion.pointer === '/items/2/code');
  assert.equal(result.status, 'FAILED');
  assert.equal(failed.expected, 'BK-009');
  assert.equal(failed.actual, 'BK-008');
  assert.equal(failed.status, 'FAILED');
  assert.equal(result.requests_sent, 2);
  assert.equal(fixture.requests.length, 2);
});

test('response references reject missing, future, self, chained, mixed-field, setup, and cleanup references', async t => {
  const fixture = await pagingSut(t);
  const reject = execution => assert.throws(() => validateBackendExecution({ ...fixture, execution, environment: fixture.environment }),
    /BACKEND_(REFERENCE_INVALID|REQUEST_INVALID|READONLY_SETUP_CLEANUP_FORBIDDEN)/);

  const missing = clone(fixture.execution);
  missing.steps[2].requests[0].response_ref = 'missing';
  reject(missing);
  const self = clone(fixture.execution);
  self.steps[2].requests[0].id = 'self'; self.steps[2].requests[0].response_ref = 'self';
  reject(self);
  const chain = clone(fixture.execution);
  chain.steps[2].requests[1].response_ref = 'verify-page1';
  reject(chain);
  const future = clone(fixture.execution);
  future.steps[0].requests.unshift({ id: 'future-ref', response_ref: 'page2', assertions: [equal('/page', 2)] });
  reject(future);
  const mixed = clone(fixture.execution);
  mixed.steps[2].requests[0].path = '/api/books?page=1';
  reject(mixed);

});

test('response references are forbidden in setup and cleanup phases', async t => {
  const fixture = await pagingSut(t);
  for (const phase of ['setup', 'cleanup']) {
    const execution = clone(exampleExecution);
    execution[phase] = [{ id: `ref-${phase}`, response_ref: 'before', assertions: [length('/items', 5)] }];
    assert.throws(() => validateBackendExecution({ caseVersion: fixture.caseVersion, binding: fixture.binding,
      execution, environment: exampleEnvironment }), /BACKEND_REFERENCE_INVALID/);
  }
});

test('cancellation after the second HTTP response stops before response-reference checks', async t => {
  const fixture = await pagingSut(t);
  const controller = new AbortController();
  const evidence = [];
  const result = await executeBackendCase({ ...fixture, execution: fixture.execution, signal: controller.signal,
    onEvidence: async event => {
      evidence.push(event);
      if (event.type === 'request-finished' && event.request_id === 'page2') controller.abort();
    } });

  assert.equal(result.status, 'CANCELLED');
  assert.equal(result.steps[2].requests.length, 0);
  assert.equal(result.requests_sent, 2);
  assert.equal(fixture.requests.length, 2);
  assert.equal(evidence.some(event => event.type === 'request-started' && event.request?.kind === 'response-reference'), false);
});
