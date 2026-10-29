import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { backendDigest, executeBackendCase, validateBackendExecution } from '../server/backend/execution.mjs';
import { BackendHarnessSession } from '../server/backend/harness-session.mjs';
import { backendRunHtml } from '../web-v2/backend.js';
import { ReportSnapshots } from '../server/report-snapshots.mjs';

const member = (value = 'BK-001') => ({ target: 'json', pointer: '/items', op: 'array_some_field_equals', field: 'code', value });

async function fixture(t, items) {
  const calls = [];
  const server = http.createServer((request, response) => {
    calls.push(request.url);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ items }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close'); });
  const environment = { id: 'env-array-member', non_production: true, authorized: true, mode: 'http-json-readonly',
    base_url: `http://127.0.0.1:${server.address().port}`, allowed_path_prefixes: ['/api/books/'], allowed_methods: ['GET'], allowed_headers: [] };
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', steps: [
    { order: 1, action: '搜索', expected: '结果包含 BK-001' },
    { order: 2, action: '复核响应', expected: '结果包含 BK-001' },
  ] };
  const caseVersion = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const binding = { binding_id: 'binding-array-member', version: 1, case_version: 1, case_content_sha256: caseVersion.content_sha256,
    protocol_source_id: 'source-array-member', protocol_sha256: 'A'.repeat(64), status: 'COMPLETE', confirmation_status: 'CONFIRMED' };
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.id, setup: [], cleanup: [], steps: [
    { order: 1, requests: [{ id: 'search', method: 'GET', path: '/api/books?keyword=bk-001', assertions: [
      { target: 'status', op: 'equals', value: 200 }, member(), { target: 'json', pointer: '/items', op: 'length', value: Array.isArray(items) ? items.length : 0 },
    ] }] },
    { order: 2, requests: [{ id: 'review', response_ref: 'search', assertions: [member()] }] },
  ] };
  return { environment, caseVersion, binding, execution, calls };
}

const check = (fixture, execution = fixture.execution) => validateBackendExecution({ ...fixture, execution });

test('any array position matches, preserves the observed array and field through HTTP and response_ref without extra HTTP', async t => {
  const items = [{ code: 'BK-002' }, { code: 'BK-001' }];
  const f = await fixture(t, items);
  const validated = check(f);
  assert.equal(validated.execution_sha256, backendDigest(f.execution));
  const result = await executeBackendCase(f);
  assert.equal(result.status, 'PASSED');
  assert.equal(result.requests_sent, 1);
  assert.equal(f.calls.length, 1);
  for (const step of result.steps) {
    const a = step.requests[0].assertions.find(row => row.op === 'array_some_field_equals');
    assert.equal(a.status, 'PASSED'); assert.equal(a.field, 'code'); assert.equal(a.expected, 'BK-001'); assert.deepEqual(a.actual, items);
  }
  const html = backendRunHtml({ http_evidence: result });
  assert.match(html, /任一记录的字段 code/);
  assert.match(html, /BK-002/);
  const session = new BackendHarnessSession({ plan: {execution:f.execution,content_sha256:f.caseVersion.content_sha256},
    context: {caseVersion:f.caseVersion,binding:{...f.binding,mappings:[{order:1,path:'/api/books'},{order:2,response_ref:'search'}]},
      protocol:{segments:[{text:'GET /api/books returns items[].code'}]}}, environment: f.environment, execute: async () => result,
    assertCurrent: async () => {}, persist: async () => {} });
  session.state.self_tests = [{ number: 1, status: 'PASSED', execution_sha256: backendDigest(f.execution), finished_at:'2026-10-01T00:00:00.000Z', result }];
  const compact = await session.readEvidence({ number: 1 });
  assert.deepEqual(compact.submission_contract.coverage.map(row=>row.requirement),f.caseVersion.content.steps.map(step=>step.expected));
  assert.equal(compact.evidence[0].assertions[1].field, 'code');
  assert.deepEqual(compact.evidence[0].assertions[1].actual, items);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-array-report-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const run = { schema: 'workbench/backend-run-v1', run_id: 'backend-array-run', executed_case_id: 'case-array', executed_case_version: 1,
    executed_external_id: 'BE-ARRAY', frozen_case_content: f.caseVersion.content, status: 'PASSED', execution_status: 'FINISHED',
    http_evidence: result, files: [] };
  const reports = new ReportSnapshots({ root, caseStore: { getProject: async () => ({ project_id: 'project-array', name: 'test' }) },
    batchManager: null, records: async () => [run], store: { runDirectory: () => root }, buildStore: null });
  const report = await reports.createSnapshot('project-array', { scope: 'run', run_id: run.run_id, request_id: 'array-report-1' });
  assert.match(report.entries[0].steps[0].actual, /任一记录的字段 code/);
  assert.equal(report.entries[0].http_evidence.steps[0].requests[0].assertions[1].field, 'code');
});

for (const [name, items, expected, actualExists] of [
  ['empty array', [], 'BK-001', true],
  ['non-array', { code: 'BK-001' }, 'BK-001', true],
  ['missing field', [{ title: 'Book' }], 'BK-001', true],
  ['null does not match non-null', [{ code: null }], 'BK-001', true],
]) test(`${name} remains a failed business assertion with actual response value`, async t => {
  const f = await fixture(t, items);
  const result = await executeBackendCase(f);
  const a = result.steps[0].requests[0].assertions.find(row => row.op === 'array_some_field_equals');
  assert.equal(result.status, 'FAILED'); assert.equal(a.status, 'FAILED'); assert.deepEqual(a.actual, items);
  assert.equal(a.expected, expected); assert.equal(a.actual_exists, actualExists);
});

test('explicit null own field matches null', async t => {
  const f = await fixture(t, [{ code: null }]);
  f.execution.steps[0].requests[0].assertions[1] = member(null);
  f.execution.steps[1].requests[0].assertions[0] = member(null);
  const result = await executeBackendCase(f);
  assert.equal(result.status, 'PASSED'); assert.equal(result.requests_sent, 1);
});

test('inherited field cannot satisfy membership', async t => {
  const f = await fixture(t, [{ title: 'Book' }]);
  Object.prototype.code = 'BK-001';
  try {
    const result = await executeBackendCase(f);
    assert.equal(result.status, 'FAILED');
    assert.equal(result.steps[0].requests[0].assertions[1].status, 'FAILED');
  } finally { delete Object.prototype.code; }
});

test('missing array pointer is a failed assertion with absent actual', async t => {
  const f = await fixture(t, [{ code: 'BK-001' }]);
  f.execution.steps[0].requests[0].assertions[1].pointer = '/missing';
  const result = await executeBackendCase(f);
  const a = result.steps[0].requests[0].assertions[1];
  assert.equal(a.status, 'FAILED'); assert.equal(a.actual_exists, false); assert.equal(a.actual, null);
});

test('schema rejects unsafe field names, invalid combinations and non-scalar values in both request branches', async t => {
  const f = await fixture(t, [{ code: 'BK-001' }]);
  const reject = (branch, assertion) => {
    const execution = structuredClone(f.execution);
    execution.steps[branch].requests[0].assertions[branch === 0 ? 1 : 0] = assertion;
    assert.throws(() => check(f, execution), /BACKEND_ASSERTION_INVALID/);
  };
  for (const branch of [0, 1]) {
    for (const field of ['', '__proto__', 'prototype', 'constructor', 'nested.code', 'a'.repeat(65)]) reject(branch, { ...member(), field });
    reject(branch, { ...member(), expected_from: { request_id: 'search', pointer: '/items' } });
    reject(branch, { ...member(), expected_from: null });
    reject(branch, { ...member(), expected_from: false });
    reject(branch, { ...member(), value: ['BK-001'] });
    reject(branch, { ...member(), value: { code: 'BK-001' } });
    reject(branch, { target: 'json', pointer: '/items', op: 'equals', field: 'code', value: [] });
    reject(branch, { target: 'status', op: 'array_some_field_equals', field: 'code', value: 200 });
  }
});
