import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { BackendManager } from '../server/backend-manager.mjs';
import { backendDigest, executeBackendCase, validateBackendEnvironment } from '../server/backend/execution.mjs';
import { exampleEnvironment, exampleExecution } from '../server/backend/example.mjs';

const registration = { base_url: 'http://127.0.0.1:4401', non_production: true, authorized: true, reviewer: 'reviewer' };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function managerFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-prefix-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectId = `project-${randomUUID()}`;
  const manager = new BackendManager({ root, caseStore: { getProject: async id => id === projectId ? { project_id: id } : null } });
  return { manager, projectId };
}

function executionFixture(environment) {
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-PREFIX', title: '前缀执行',
    steps: exampleExecution.steps.map((item, index) => ({ order: index + 1, action: `业务步骤${index + 1}`, expected: '协议预期' })) };
  const caseVersion = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const binding = { status: 'COMPLETE', confirmation_status: 'CONFIRMED', case_version: 1,
    case_content_sha256: caseVersion.content_sha256, binding_id: 'binding-prefix', version: 1,
    protocol_source_id: 'source-prefix', protocol_sha256: 'A'.repeat(64), mappings: [] };
  return { caseVersion, binding, environment,
    execution: { ...structuredClone(exampleExecution), environment_id: environment.id } };
}

test('registration freezes optional prefix and retains the old environment shape when omitted', async t => {
  const { manager, projectId } = await managerFixture(t);
  const legacy = await manager.registerEnvironment(projectId, registration);
  const prefixed = await manager.registerEnvironment(projectId, { ...registration, run_id_prefix: 'qa-20261008' });
  assert.equal(Object.hasOwn(legacy.namespace, 'run_id_prefix'), false);
  assert.equal(prefixed.namespace.run_id_prefix, 'qa-20261008');
  assert.deepEqual((await manager.environment(projectId, prefixed.environment_id)).namespace, prefixed.namespace);
  const { configuration_sha256: ignored, ...facts } = prefixed;
  assert.equal(prefixed.configuration_sha256, hash(facts));
  facts.namespace.run_id_prefix = 'other';
  assert.notEqual(prefixed.configuration_sha256, hash(facts));
});

test('invalid prefixes are rejected during registration and direct validation', async t => {
  const { manager, projectId } = await managerFixture(t);
  for (const run_id_prefix of [null, '', 'QA', '/qa', 'qa/', '-qa', 'qa-', 'a'.repeat(27), 7]) {
    await assert.rejects(manager.registerEnvironment(projectId, { ...registration, run_id_prefix }),
      /BACKEND_NAMESPACE_PREFIX_INVALID/);
    const environment = structuredClone(exampleEnvironment);
    environment.namespace.run_id_prefix = run_id_prefix;
    assert.throws(() => validateBackendEnvironment(environment), /BACKEND_NAMESPACE_PREFIX_INVALID/);
  }
  await assert.rejects(manager.registerEnvironment(projectId, { ...registration, mode: 'http-json-readonly',
    allowed_path_prefixes: ['/api/books'], run_id_prefix: 'qa' }), /BACKEND_NAMESPACE_PREFIX_INVALID/);
  const edge = structuredClone(exampleEnvironment);
  edge.namespace.run_id_prefix = 'a'.repeat(26);
  assert.doesNotThrow(() => validateBackendEnvironment(edge));
});

test('two stubbed runs use distinct bounded IDs consistently through setup, business and cleanup', async t => {
  const environment = structuredClone(exampleEnvironment);
  environment.namespace.run_id_prefix = 'qa-20261008';
  const fixture = executionFixture(environment);
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const pathname = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ method: options.method, pathname, body });
    const runId = body?.runId || pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    if (options.method === 'POST' && pathname === '/__control/namespaces')
      return Response.json({ runId, created: true }, { status: 201 });
    if (options.method === 'DELETE') return Response.json({ runId, deleted: true }, { status: 200 });
    if (options.method === 'POST') return Response.json({ runId, created: false, error: { code: 'DUPLICATE_CODE' } }, { status: 409 });
    return Response.json({ runId, items: [{ code: 'DEV-001' }], total: 1 }, { status: 200 });
  };
  t.after(() => { globalThis.fetch = previousFetch; });
  const first = await executeBackendCase(fixture);
  const second = await executeBackendCase(fixture);
  assert.equal(first.status, 'PASSED');
  assert.equal(second.status, 'PASSED');
  assert.notEqual(first.run_id, second.run_id);
  for (const [index, result] of [first, second].entries()) {
    assert.match(result.run_id, /^qa-20261008-[a-f0-9-]{36}$/);
    assert.ok(result.run_id.length <= 63);
    const runRequests = requests.slice(index * 5, index * 5 + 5);
    assert.equal(runRequests.length, 5);
    assert.deepEqual(runRequests.map(row => row.method), ['POST', 'GET', 'POST', 'GET', 'DELETE']);
    assert.equal(runRequests[0].body.runId, result.run_id);
    assert.ok(runRequests.slice(1).every(row => row.pathname.includes(`/${result.run_id}`)));
    assert.equal(runRequests.at(-1).pathname, `/__control/namespaces/${result.run_id}`);
  }
});

test('invalid prefix is rejected before fetch and omitted prefix keeps backend-run default', async t => {
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls++;
    const pathname = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    const runId = body?.runId || pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    if (options.method === 'POST' && pathname === '/__control/namespaces') return Response.json({ runId, created: true }, { status: 201 });
    if (options.method === 'DELETE') return Response.json({ runId, deleted: true }, { status: 200 });
    if (options.method === 'POST') return Response.json({ runId, created: false, error: { code: 'DUPLICATE_CODE' } }, { status: 409 });
    return Response.json({ runId, items: [{ code: 'DEV-001' }], total: 1 }, { status: 200 });
  };
  t.after(() => { globalThis.fetch = previousFetch; });
  const environment = structuredClone(exampleEnvironment);
  environment.namespace.run_id_prefix = 'BAD';
  await assert.rejects(executeBackendCase(executionFixture(environment)), /BACKEND_NAMESPACE_PREFIX_INVALID/);
  assert.equal(calls, 0);
  delete environment.namespace.run_id_prefix;
  const result = await executeBackendCase(executionFixture(environment));
  assert.match(result.run_id, /^backend-run-[a-f0-9-]{36}$/);
  assert.equal(result.status, 'PASSED');
});
