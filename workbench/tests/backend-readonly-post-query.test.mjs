import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BackendManager } from '../server/backend-manager.mjs';
import { backendDigest, executeBackendCase, validateBackendExecution } from '../server/backend/execution.mjs';
import { validateQueryBody, validateQueryDefinitions } from '../server/backend/query-contract.mjs';
import { prepareBackend } from '../server/backend/protocol-preparation.mjs';
import { BackendHarnessSession } from '../server/backend/harness-session.mjs';

const body_schema = { type: 'object', additionalProperties: false, required: ['pageNo', 'param'], properties: {
  pageNo: { type: 'integer', minimum: 1, maximum: 100 },
  param: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', maxLength: 100 } } },
} };
const query = { path: '/api/query', protocol_source_id: 'source-one', protocol_sha256: 'sha-one', readonly_reviewed: true, body_schema };
const body = { pageNo: 1, param: { name: 'sample' } };
const registration = { mode: 'http-json-readonly', name: 'reviewed query', base_url: 'http://127.0.0.1:49998',
  allowed_path_prefixes: ['/api/'], non_production: true, authorized: true, reviewer: 'reviewer', read_only_post_queries: [query] };

function plan(environment) {
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', steps: [{ order: 1, action: 'POST /api/query', expected: 'total=1' }] };
  const content_sha256 = backendDigest(content).toUpperCase();
  return { environment, caseVersion: { version: 1, content, content_sha256 },
    binding: { binding_id: 'binding-one', version: 1, case_version: 1, case_content_sha256: content_sha256,
      protocol_source_id: 'source-one', protocol_sha256: 'sha-one', status: 'COMPLETE', confirmation_status: 'CONFIRMED' },
    execution: { schema: 'workbench/backend-execution-v1', environment_id: environment.id, setup: [], cleanup: [],
      steps: [{ order: 1, requests: [{ id: 'query', method: 'POST', path: '/api/query', json: body,
        assertions: [{ target: 'json', pointer: '/total', op: 'equals', value: 1 }] }] }] } };
}

async function managerFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'readonly-post-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = 'project-' + randomUUID();
  const source = { project_id: project, snapshot_id: 'source-one', kind: 'PROTOCOL', sha256: 'sha-one',
    segments: [{ segment_id: 'segment-one', quote_sha256: 'quote-one', text: 'POST /api/query，JSON {"pageNo":1,"param":{"name":"sample"}}\n响应 200 {"total":1}' }] };
  const manager = new BackendManager({ root, caseStore: { getProject: async () => ({ project_id: project }) },
    requirementsManager: { getSource: async () => structuredClone(source) }, runStore: { listRuns: async () => [] } });
  await manager.init();
  return { manager, project, source };
}

test('registration verifies an explicit protocol POST and freezes exact method/path scope', async t => {
  const { manager, project, source } = await managerFixture(t);
  const environment = await manager.registerEnvironment(project, registration);
  assert.deepEqual(environment.allowed_methods, ['GET', 'POST']);
  assert.equal(environment.read_only_post_queries[0].path, '/api/query');
  for (const bad of [
    { ...query, path: '/api/other' }, { ...query, protocol_sha256: 'other' }, { ...query, readonly_reviewed: false },
    { ...query, path: '/api/query?x=1' }, { ...query, path: '/api/{id}' },
  ]) await assert.rejects(manager.registerEnvironment(project, { ...registration, read_only_post_queries: [bad] }), /BACKEND_QUERY_/);
  source.segments.push({ segment_id: 'duplicate', quote_sha256: 'duplicate', text: source.segments[0].text });
  await assert.rejects(manager.registerEnvironment(project, registration), /BACKEND_QUERY_PROTOCOL_INVALID/);
  source.segments.pop();
  source.kind = 'OTHER';
  await assert.rejects(manager.registerEnvironment(project, registration), /BACKEND_QUERY_PROTOCOL_INVALID/);
  await assert.rejects(manager.registerEnvironment(project, { ...registration, mode: 'synthetic-namespace' }), /BACKEND_QUERY_CONTRACT_INVALID/);
});

test('bounded schema rejects unknown fields, templates, arrays, unsafe keys and invalid declarations', () => {
  validateQueryDefinitions([query], ['/api/']);
  validateQueryBody(body, body_schema);
  assert.throws(() => validateQueryDefinitions([{ ...query, body_schema: { type: 'string', maxLength: 100 } }], ['/api/']), /BACKEND_QUERY_SCHEMA_INVALID/);
  for (const invalid of [
    { pageNo: 1, param: { name: 'sample', extra: 1 } }, { pageNo: 0, param: { name: 'sample' } },
    { pageNo: 1, param: { name: '{{runId}}' } }, { pageNo: 1, param: ['sample'] },
    { pageNo: 1 }, JSON.parse('{"pageNo":1,"param":{"__proto__":"bad","name":"sample"}}'),
  ]) assert.throws(() => validateQueryBody(invalid, body_schema), /BACKEND_QUERY_BODY_INVALID/);
  assert.throws(() => validateQueryDefinitions([query, query], ['/api/']), /BACKEND_QUERY_CONTRACT_INVALID/);
  assert.throws(() => validateQueryDefinitions([{ ...query, body_schema: { ...body_schema, additionalProperties: true } }], ['/api/']), /BACKEND_QUERY_SCHEMA_INVALID/);
});

test('execution binds POST to current protocol, exact path and literal body before dispatch', async t => {
  const { manager, project } = await managerFixture(t);
  const environment = await manager.registerEnvironment(project, registration);
  const valid = plan(environment);
  validateBackendExecution(valid);
  for (const mutate of [
    args => { args.binding.protocol_sha256 = 'other'; },
    args => { args.execution.steps[0].requests[0].path = '/api/other'; },
    args => { args.execution.steps[0].requests[0].path = '/api/query?x=1'; },
    args => { args.execution.steps[0].requests[0].json.param.name = '{{query:/name}}'; },
    args => { args.execution.steps[0].requests[0].json.param.extra = true; },
    args => { args.execution.steps[0].requests[0].headers = { 'x-test': 'value' }; },
    args => { args.execution.setup = [args.execution.steps[0].requests[0]]; },
  ]) { const args = structuredClone(valid); mutate(args); assert.throws(() => validateBackendExecution(args), /BACKEND_/); }
  const calls = []; const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), method: options.method, body: JSON.parse(options.body) });
    return new Response('{"total":1}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  t.after(() => { globalThis.fetch = original; });
  const result = await executeBackendCase(valid);
  assert.equal(result.status, 'PASSED');
  assert.deepEqual(calls, [{ url: 'http://127.0.0.1:49998/api/query', method: 'POST', body }]);
  assert.equal(result.cleanup.length, 0);
});

test('preparation only admits the exact registered POST for the chosen protocol', async t => {
  const { manager, project, source } = await managerFixture(t);
  const environment = await manager.registerEnvironment(project, registration);
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', title: '分页', steps: [{ order: 1,
    action: 'POST /api/query，JSON pageNo=1,param={name:sample}', expected: 'total=1' }] };
  const version = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const fake = { caseStore: { getProject: async () => ({ project_id: project, revision: 1, cases: [{ case_id: 'case-one', current_version: 1, versions: [version] }] }) },
    requirementsManager: { listSources: async () => ({ sources: [source] }), getSource: async () => source, getBindings: async () => ({ bindings: [] }) },
    list: async () => ({ environments: [environment], plans: [] }) };
  assert.equal((await prepareBackend(fake, project)).items[0].status, 'READY');
  fake.list = async () => ({ environments: [{ ...environment, read_only_post_queries: [{ ...query, protocol_sha256: 'other' }] }], plans: [] });
  const blocked = (await prepareBackend(fake, project)).items[0];
  assert.equal(blocked.status, 'UNSUPPORTED');
  assert.ok(blocked.missing.some(issue => issue.code === 'BACKEND_ENVIRONMENT_CAPABILITY_UNSUPPORTED'));
});

test('harness context exposes the reviewed query contract and protocol identity by copy', async t => {
  const { manager, project } = await managerFixture(t);
  const environment = await manager.registerEnvironment(project, registration);
  const args = plan(environment);
  const session = new BackendHarnessSession({ plan: { case_id: 'case-one', case_version: 1, content_sha256: args.caseVersion.content_sha256,
    binding_id: 'binding-one', binding_version: 1, protocol_sha256: 'sha-one', execution: null },
    context: { caseVersion: args.caseVersion, binding: { ...args.binding, mappings: [] }, protocol: { segments: [] } },
    environment, execute: async () => {}, assertCurrent: async () => {}, persist: async () => {} });
  const view = session.readContext();
  assert.equal(view.binding_identity.protocol_source_id, 'source-one');
  assert.deepEqual(view.environment.read_only_post_queries, [query]);
  view.environment.read_only_post_queries[0].path = '/api/changed';
  assert.equal(environment.read_only_post_queries[0].path, '/api/query');
});
