import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareBackend } from '../server/backend/protocol-preparation.mjs';
import { BackendGenerationBatches } from '../server/backend/generation-batches.mjs';
import { backendRoute } from '../server/backend-routes.mjs';

const snapshot = JSON.parse(await fs.readFile(new URL('./fixtures/backend-practice-preparation.json', import.meta.url), 'utf8'));
const copy = value => structuredClone(value);
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-preparation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { project, source } = copy(snapshot); const bindings = new Map(), plans = []; let calls = 0;
  const environment = { environment_id: 'env-fixture', configuration_sha256: 'environment-sha', allowed_methods: ['GET', 'POST', 'DELETE'], allowed_path_prefixes: ['/api/v1/namespaces/', '/__control/namespaces/'] };
  const manager = { root, writable() {}, otherActive: () => false, caseStore: { getProject: async id => id === project.project_id ? copy(project) : null },
    requirementsManager: { listSources: async () => ({ sources: source ? [copy(source)] : [] }), getSource: async () => copy(source),
      getBindings: async (_project, id) => ({ bindings: copy(bindings.get(id) || []) }),
      createBinding: async (_project, input) => { const previous = bindings.get(input.caseId) || []; assert.equal(input.confirmation, 'CONFIRM'); assert.equal(input.reviewer, 'tester');
        const row = { version: previous.length + 1, case_version: input.caseVersion, case_content_sha256: input.caseContentSha256, status: 'COMPLETE', confirmation_status: 'CONFIRMED', protocol_source_id: source.snapshot_id, protocol_sha256: source.sha256, mappings: input.mappings };
        bindings.set(input.caseId, [...previous, row]); return row; } },
    list: async () => ({ environments: [copy(environment)], plans: copy(plans), model_available: true, generation_limits: { wall_ms: 100, tool_calls: 2, harness_starts: 1, self_tests: 1 } }),
    get: async (_project, id) => copy(plans.find(row => row.plan_id === id)),
    async create(_project, input, owner) { assert.equal(owner, manager.generationBatchActive); calls++; const plan = { ...input, plan_id: `plan-${calls}`, execution: {}, content_sha256: project.cases.find(row => row.case_id === input.case_id).versions[0].content_sha256, state: 'DRAFT', environment_sha256: environment.configuration_sha256, protocol_sha256: source.sha256 }; plans.push(plan); manager.completion = Promise.resolve(); return copy(plan); },
  };
  manager.preparation = (...args) => prepareBackend(manager, ...args); manager.generationBatches = new BackendGenerationBatches(manager);
  await manager.generationBatches.init();
  const input = preparation => ({ request_id: 'request-fixture-01', preparation_sha256: preparation.preparation_sha256, protocol_source_id: source.snapshot_id, reviewer: 'tester', confirm_protocol_analysis: true, allow_model: true, allow_http_self_test: true });
  return { manager, project, source, bindings, plans, environment, input, calls: () => calls };
}
test('protocol mapping preserves explicit parameters and genuine references before executor stage checks', async t => {
  const f = await fixture(t), result = await f.manager.preparation(f.project.project_id);
  assert.equal(result.items.length, 3); assert.deepEqual(result.items.map(row => row.status), ['READY', 'READY', 'READY']);
  for (const row of result.items) { assert.equal(row.mappings.length, 6); for (const mapping of row.mappings) for (const ref of mapping.source_refs) assert.equal(f.source.segments.find(segment => segment.segment_id === ref.segment_id)?.quote_sha256, ref.quote_sha256); }
});

test('registered namespace control steps require case revision before any batch generation', async t => {
  const f = await fixture(t), before = copy(f.project);
  Object.assign(f.environment, { mode: 'synthetic-namespace', namespace: { setup_path: '/__control/namespaces', cleanup_prefix: '/__control/namespaces/', resource_prefix: '/api/v1/namespaces/' } });
  const preparation = await f.manager.preparation(f.project.project_id);
  for (const row of preparation.items) {
    assert.equal(row.status, 'NEEDS_SUPPLEMENT');
    assert.deepEqual(row.missing.filter(issue => issue.code === 'BACKEND_CASE_STAGE_CONFLICT').map(issue => issue.phase), ['setup', 'cleanup']);
    assert.ok(row.missing.some(issue => /修订用例/.test(issue.message)));
  }
  await assert.rejects(() => f.manager.generationBatches.create(f.project.project_id, f.input(preparation)), /BACKEND_GENERATION_NO_READY_CASES/);
  assert.equal(f.calls(), 0); assert.equal(f.bindings.size, 0); assert.deepEqual(f.project, before);
});

test('complete bindings and old drafts cannot hide a case stage conflict', async t => {
  const f = await fixture(t);
  Object.assign(f.environment, { mode: 'synthetic-namespace', namespace: { setup_path: '/__control/namespaces', cleanup_prefix: '/__control/namespaces/', resource_prefix: '/api/v1/namespaces/' } });
  const item = f.project.cases[0], version = item.versions[0];
  f.bindings.set(item.case_id, [{ version: 1, case_version: version.version, case_content_sha256: version.content_sha256,
    status: 'COMPLETE', confirmation_status: 'CONFIRMED', protocol_source_id: f.source.snapshot_id, protocol_sha256: f.source.sha256, mappings: [] }]);
  f.plans.push({ plan_id: 'plan-old', case_id: item.case_id, case_version: version.version, content_sha256: version.content_sha256,
    environment_id: f.environment.environment_id, environment_sha256: f.environment.configuration_sha256, state: 'DRAFT', execution: {}, binding_version: 1, protocol_sha256: f.source.sha256 });
  const row = (await f.manager.preparation(f.project.project_id)).items[0];
  assert.equal(row.status, 'NEEDS_SUPPLEMENT'); assert.equal(row.plan_id, undefined); assert.equal(row.binding_version, 1);
  assert.ok(row.missing.some(issue => issue.code === 'BACKEND_CASE_STAGE_CONFLICT'));
  f.bindings.get(item.case_id)[0].status = 'CONFLICT';
  const conflict = (await f.manager.preparation(f.project.project_id)).items[0];
  assert.equal(conflict.status, 'CONFLICT'); assert.ok(conflict.missing.some(issue => issue.code === 'BINDING_CONFLICT_UNRESOLVED'));
});

test('business-only versions keep full protocol mapping with separate setup and cleanup constraints', async t => {
  const f = await fixture(t);
  Object.assign(f.environment, { mode: 'synthetic-namespace', namespace: { setup_path: '/__control/namespaces', cleanup_prefix: '/__control/namespaces/', resource_prefix: '/api/v1/namespaces/' } });
  for (const item of f.project.cases) {
    const content = item.versions[0].content, old = copy(content.steps);
    content.preconditions += '\n测试准备：' + old[0].action + '；要求：' + old[0].expected;
    content.test_data += '\n测试结束清理：' + old.at(-1).action + '；要求：' + old.at(-1).expected;
    content.steps = old.slice(1,-1).map((step,index) => ({ ...step, order:index+1 }));
  }
  const preparation = await f.manager.preparation(f.project.project_id);
  assert.deepEqual(preparation.items.map(row=>row.status), ['READY','READY','READY']);
  assert.ok(preparation.items.every(row=>row.mappings.length===4));
});
test('missing response and duplicate endpoint are actionable blockers, conflict is never cleared', async t => {
  const f = await fixture(t); f.source.segments.push(copy(f.source.segments.find(row => row.text.includes('GET /api/v1/namespaces/{runId}/devices/{code}'))));
  let result = await f.manager.preparation(f.project.project_id); assert.equal(result.items[0].status, 'NEEDS_SUPPLEMENT'); assert.ok(result.items[0].missing.some(row => row.code === 'PROTOCOL_MAPPING_AMBIGUOUS'));
  const row = f.project.cases[0]; f.bindings.set(row.case_id, [{ version: 1, case_version: 1, case_content_sha256: row.versions[0].content_sha256, status: 'CONFLICT', protocol_sha256: f.source.sha256 }]);
  result = await f.manager.preparation(f.project.project_id); assert.equal(result.items[0].status, 'CONFLICT');
});
test('missing protocol, unsupported capability and missing explicit HTTP do not imply readiness', async t => {
  const f = await fixture(t); f.manager.requirementsManager.listSources = async () => ({ sources: [] });
  assert.ok((await f.manager.preparation(f.project.project_id)).items.every(row => row.status === 'NEEDS_SUPPLEMENT'));
  f.manager.requirementsManager.listSources = async () => ({ sources: [f.source] }); f.environment.allowed_methods = ['GET'];
  assert.ok((await f.manager.preparation(f.project.project_id)).items.every(row => row.status === 'UNSUPPORTED'));
  f.environment.allowed_methods = ['GET', 'POST', 'DELETE']; f.project.cases[0].versions[0].content.steps[0].action = '初始化';
  assert.equal((await f.manager.preparation(f.project.project_id)).items[0].status, 'NEEDS_SUPPLEMENT');
});
test('generation processes ready subset serially, preserves existing and idempotent requests do not replay', async t => {
  const f = await fixture(t); f.project.cases[0].versions[0].content.steps[0].action = '请补充初始化接口';
  const preparation = await f.manager.preparation(f.project.project_id), input = f.input(preparation);
  const batch = await f.manager.generationBatches.create(f.project.project_id, input); await f.manager.generationBatches.completion;
  const done = await f.manager.generationBatches.get(f.project.project_id, batch.batch_id); assert.deepEqual(done.items.map(row => row.state), ['BLOCKED', 'DRAFT', 'DRAFT']); assert.equal(f.calls(), 2);
  assert.equal((await f.manager.generationBatches.create(f.project.project_id, input)).batch_id, batch.batch_id); assert.equal(f.calls(), 2);
  await assert.rejects(() => f.manager.generationBatches.create(f.project.project_id, { ...input, reviewer: 'different' }), /REQUEST_CONFLICT/);
  assert.deepEqual((await f.manager.preparation(f.project.project_id)).items.map(row => row.status), ['NEEDS_SUPPLEMENT', 'EXISTS', 'EXISTS']);
});
test('stale admission and revoked identity block before generation', async t => {
  const f = await fixture(t); const preparation = await f.manager.preparation(f.project.project_id); f.environment.configuration_sha256 = 'changed';
  await assert.rejects(() => f.manager.generationBatches.create(f.project.project_id, f.input(preparation)), /PREPARATION_STALE/); assert.equal(f.calls(), 0); assert.equal(f.manager.generationBatchActive, null);
});
test('request parameter omissions and later binding/case changes block affected cases', async t => {
  const f = await fixture(t); f.project.cases[0].versions[0].content.steps[2].action = 'POST /api/v1/namespaces/be-r1-01/devices，JSON code=DEV-007，请求头 x-synthetic-role: editor';
  const preparation = await f.manager.preparation(f.project.project_id);
  assert.ok(preparation.items[0].missing.some(row => row.code === 'CASE_REQUEST_FIELDS_REQUIRED'));
  const original = f.manager.preparation; let reads = 0;
  f.manager.preparation = async (...args) => { if (++reads === 2) f.project.cases[1].current_version = 2; return original(...args); };
  const batch = await f.manager.generationBatches.create(f.project.project_id, f.input(preparation)); await f.manager.generationBatches.completion;
  const done = await f.manager.generationBatches.get(f.project.project_id, batch.batch_id); assert.equal(done.items[1].reason, 'BACKEND_GENERATION_IDENTITY_CHANGED'); assert.equal(done.items[2].state, 'DRAFT'); assert.equal(f.calls(), 1);
});
test('new backend routes expose preparation and reject untrusted generation admission', async t => {
  const f = await fixture(t); const invoke = async (method, suffix, trusted = true, body = {}) => { let result; await backendRoute({ request: { method }, response: {}, url: new URL(`http://127.0.0.1:4322/api/case-library/projects/${f.project.project_id}/backend/${suffix}`), manager: f.manager, sendJson: (_response, status, value) => { result = { status, value }; }, readJsonBody: async () => body, trustedMutation: () => trusted }); return result; };
  const preparation = await invoke('GET', `preparation?protocol_source_id=${f.source.snapshot_id}`); assert.equal(preparation.status, 200); assert.equal(preparation.value.items.length, 3);
  const rejected = await invoke('POST', 'generation-batches', false, f.input(preparation.value)); assert.equal(rejected.status, 403); assert.equal(f.calls(), 0);
  const list = await invoke('GET', 'generation-batches'); assert.deepEqual(list.value.batches, []);
});
test('bound project cannot infer a lone environment and validates configuration identity', async t => {
  const f = await fixture(t); f.manager.projectEnvironments = { assert: async () => { throw Error('PROJECT_ENVIRONMENT_NOT_CONFIGURED'); } };
  let result = await f.manager.preparation(f.project.project_id); assert.equal(result.environment_id, null); assert.ok(result.items.every(row => row.status === 'UNSUPPORTED'));
  const listing = f.manager.list; f.manager.list = async (...args) => ({ ...await listing(...args), environment_binding: { backend_environment_id: f.environment.environment_id } });
  f.manager.projectEnvironments.assert = async () => { throw Error('PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED'); };
  result = await f.manager.preparation(f.project.project_id); assert.ok(result.items.every(row => row.missing.some(issue => issue.code === 'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED')));
});
test('latest source defaults first; equal hashes cannot reuse another source binding and old conflicts remain', async t => {
  const f = await fixture(t); const old = { ...copy(f.source), snapshot_id: 'source-old' };
  f.manager.requirementsManager.listSources = async () => ({ sources: [f.source, old] });
  const getSource = f.manager.requirementsManager.getSource; f.manager.requirementsManager.getSource = async (_project, id) => id === old.snapshot_id ? copy(old) : getSource();
  const item = f.project.cases[0]; f.bindings.set(item.case_id, [{ version: 1, case_version: 1, case_content_sha256: item.versions[0].content_sha256, status: 'COMPLETE', confirmation_status: 'CONFIRMED', protocol_sha256: f.source.sha256, protocol_source_id: old.snapshot_id, mappings: [] }]);
  const result = await f.manager.preparation(f.project.project_id); assert.equal(result.protocol_source_id, f.source.snapshot_id); assert.equal(result.items[0].binding_version, null); assert.equal(result.items[0].mappings.length, 6);
  f.bindings.get(item.case_id)[0].status = 'CONFLICT'; f.bindings.get(item.case_id)[0].protocol_sha256 = 'old-hash'; assert.equal((await f.manager.preparation(f.project.project_id)).items[0].status, 'CONFLICT');
});
test('request JSON/status numbers and unrelated sections cannot masquerade as endpoint responses', async t => {
  const f = await fixture(t); f.source.segments = [
    { segment_id: 'segment-1', text: 'POST /__control/namespaces，JSON {"runId":"demo","status":200}；请求 201 {runId:"input"}' },
    { segment_id: 'segment-2', text: '## 其他无关接口' }, { segment_id: 'segment-3', text: '响应 201 {created:true}' },
  ];
  const result = await f.manager.preparation(f.project.project_id); assert.ok(result.items.every(row => row.missing.some(issue => issue.code === 'PROTOCOL_RESPONSE_REQUIRED' && issue.step_order === 1)));
});
test('empty parameter assignments are missing and protocol-required Authorization is unsupported even omitted by case', async t => {
  const f = await fixture(t); f.project.cases[0].versions[0].content.steps[2].action = 'POST /api/v1/namespaces/be-r1-01/devices，请求头 x-synthetic-role: editor，JSON code=,name=,site=,ratedPowerKw=';
  let result = await f.manager.preparation(f.project.project_id); assert.ok(result.items[0].missing.some(issue => issue.code === 'CASE_REQUEST_FIELDS_REQUIRED'));
  f.source.segments.unshift({ segment_id: 'segment-auth', text: '请求头 Authorization: Bearer example 必须提供。' });
  result = await f.manager.preparation(f.project.project_id); assert.ok(result.items.every(row => row.status === 'UNSUPPORTED' && row.missing.some(issue => issue.code === 'BACKEND_AUTH_UNSUPPORTED')));
});
test('cancel during first session marks remaining items NOT_RUN; restart never replays', async t => {
  const f = await fixture(t); let release; const pending = new Promise(resolve => { release = resolve; }); let entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const create = f.manager.create; f.manager.create = async (...args) => { const result = await create(...args); f.manager.completion = pending; f.manager.active = { project_id: f.project.project_id, controller: { abort: release } }; entered(); return result; };
  const batch = await f.manager.generationBatches.create(f.project.project_id, f.input(await f.manager.preparation(f.project.project_id))); await enteredPromise;
  const cancelled = await f.manager.generationBatches.cancel(f.project.project_id, batch.batch_id); assert.equal(cancelled.state, 'CANCELLED'); assert.deepEqual(cancelled.items.slice(1).map(row => row.state), ['NOT_RUN', 'NOT_RUN']); assert.equal(f.calls(), 1);
  cancelled.state = 'RUNNING'; cancelled.items[1].state = 'QUEUED'; await f.manager.generationBatches.save(cancelled);
  const restored = new BackendGenerationBatches(f.manager); await restored.init(); const record = await restored.get(f.project.project_id, batch.batch_id); assert.equal(record.state, 'INTERRUPTED'); assert.equal(record.items[1].state, 'NOT_RUN'); assert.equal(f.calls(), 1);
});
