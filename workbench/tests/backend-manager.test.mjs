import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BackendManager } from '../server/backend-manager.mjs';
import { exampleExecution } from '../server/backend/example.mjs';
import { backendDigest } from '../server/backend/execution.mjs';
import { preparationDigest } from '../server/backend/protocol-preparation.mjs';

const copy = value => structuredClone(value);
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-manager-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectId = 'project-' + randomUUID(), caseId = 'case-' + randomUUID();
  const content = { case_type: 'BACKEND', external_id: 'BE-001', title: '重复拒绝', status: 'CONFIRMED', steps: [
    { order: 1, action: '读基线', expected: 'DEV001存在' }, { order: 2, action: '提交重复', expected: '拒绝' }, { order: 3, action: '再查询', expected: '持久化不变' },
  ] };
  const version = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const project = { project_id: projectId, cases: [{ case_id: caseId, current_version: 1, versions: [version] }] };
  const binding = { project_id: projectId, case_id: caseId, binding_id: 'binding-' + randomUUID(), version: 1, case_version: 1, case_content_sha256: version.content_sha256, status: 'COMPLETE', confirmation_status: 'CONFIRMED', protocol_source_id: 'source-' + randomUUID(), protocol_sha256: 'protocol-sha', mappings: [{ step_order: 2, request_fields: { role: 'editor' }, observation: 'exactly unchanged' }] };
  const protocol = { project_id: projectId, kind: 'PROTOCOL', sha256: binding.protocol_sha256, segments: [{ text: 'public protocol fixture' }] };
  const runs = new Map();
  const dependencies = { root, caseStore: { getProject: async id => id === projectId ? copy(project) : null }, requirementsManager: { getBindings: async () => ({ bindings: [copy(binding)] }), getSource: async () => copy(protocol) }, runStore: {
    listRuns: async () => copy([...runs.values()]), createRun: async run => { runs.set(run.run_id, copy(run)); return copy(run); },
    getRun: async id => copy(runs.get(id)), updateRun: async (id, update) => { const next = await update(copy(runs.get(id))); runs.set(id, copy(next)); return copy(next); },
  }, ...options };
  const manager = new BackendManager(dependencies); await manager.init();
  const environment = await manager.registerEnvironment(projectId, { name: '合成目标', base_url: 'http://127.0.0.1:4401', non_production: true, authorized: true, reviewer: 'reviewer' });
  const execution = { ...copy(exampleExecution), environment_id: environment.environment_id };
  const createInput = { case_id: caseId, case_version: 1, binding_version: 1, environment_id: environment.environment_id, execution };
  const confirmed = async () => {
    const draft = await manager.create(projectId, createInput);
    return manager.confirm(projectId, draft.plan_id, { revision: draft.revision, reviewer: 'reviewer' });
  };
  return { root, manager, dependencies, projectId, caseId, project, binding, protocol, runs, environment, execution, createInput, confirmed };
}
function result(namespace = 'backend-run-' + randomUUID()) { return { schema: 'workbench/backend-result-v1', run_id: namespace, runner_kind: 'HTTP_JSON', status: 'PASSED', execution_status: 'FINISHED', complete_pass: true, setup: [], steps: [{ order: 1, status: 'PASSED' }], cleanup: [], model_calls: 0 }; }

test('single-plan generation rejects control steps before saving or calling a model', async t => {
  let calls = 0; const f = await fixture(t, { modelClient: { generate: async () => { calls++; return {}; } } });
  const version = f.project.cases[0].versions[0];
  version.content.steps[2].action = 'DELETE /__control/namespaces/{{runId}}';
  version.content_sha256 = backendDigest(version.content).toUpperCase(); f.binding.case_content_sha256 = version.content_sha256;
  await assert.rejects(() => f.manager.create(f.projectId, { ...f.createInput, execution: undefined, generate: true, allow_model: true }), /BACKEND_CASE_STAGE_CONFLICT/);
  assert.equal(calls, 0); assert.equal(f.manager.active, null);
  assert.equal((await f.manager.list(f.projectId)).plans.length, 0);
});

test('old plans cannot confirm or run when a readback disguises a required control cleanup step', async t => {
  const f = await fixture(t), draft = await f.manager.create(f.projectId, f.createInput);
  const version = f.project.cases[0].versions[0];
  version.content.steps[2].action = 'DELETE /__control/namespaces/{{runId}}';
  version.content_sha256 = backendDigest(version.content).toUpperCase(); f.binding.case_content_sha256 = version.content_sha256;
  const old = { ...draft, content_sha256: version.content_sha256 };
  await f.manager.save(old);
  await assert.rejects(() => f.manager.confirm(f.projectId, draft.plan_id, { revision: draft.revision, reviewer: 'tester' }), /BACKEND_CASE_STAGE_CONFLICT/);
  await f.manager.save({ ...old, state: 'CONFIRMED', execution_sha256: backendDigest(old.execution) });
  await assert.rejects(() => f.manager.resolve(f.projectId, draft.plan_id), /BACKEND_CASE_STAGE_CONFLICT/);
  assert.equal(f.runs.size, 0);
});

test('failed generation is unavailable without being misclassified as awaiting plan review', async t => {
  const f = await fixture(t), draft = await f.manager.create(f.projectId, f.createInput);
  await assert.rejects(f.manager.resolve(f.projectId, draft.plan_id), /BACKEND_PLAN_REVIEW_REQUIRED/);
  const failed = { ...draft, state: 'FAILED', execution: null, error: 'BACKEND_HARNESS_PROCESS_FAILED' };
  await f.manager.save(failed);
  await assert.rejects(f.manager.resolve(f.projectId, draft.plan_id), /SCRIPT_GENERATION_FAILED/);
  const { candidates } = await f.manager.automation(f.projectId, f.caseId, 1);
  assert.equal(candidates.length, 1); assert.equal(candidates[0].reason, 'SCRIPT_GENERATION_FAILED');
  assert.equal(candidates[0].selection.source_task_id, draft.plan_id);
  assert.equal(candidates[0].selection.kind, 'HTTP_JSON');
  assert.deepEqual(await f.manager.get(f.projectId, draft.plan_id), failed);
  assert.equal(f.runs.size, 0);
});

test('generation batch owner blocks manual plan admission and environment registration throughout gaps', async t => {
  const f = await fixture(t); const owner = { project_id: f.projectId }; f.manager.generationBatchActive = owner;
  await assert.rejects(() => f.manager.create(f.projectId, f.createInput), /WORKBENCH_BUSY/);
  await assert.rejects(() => f.manager.registerEnvironment(f.projectId, { base_url: 'http://127.0.0.1:4401' }), /WORKBENCH_BUSY/);
  const plan = await f.manager.create(f.projectId, f.createInput, owner); assert.equal(plan.case_id, f.caseId);
  f.manager.generationBatchActive = null;
});
test('batch rechecks frozen identity after plan persistence before a model can start', async t => {
  let calls = 0; const f = await fixture(t, { modelClient: { generate: async () => { calls++; return {}; } } });
  f.protocol.snapshot_id = f.binding.protocol_source_id;
  const owner = { project_id: f.projectId, expectation: { case_id: f.caseId, case_version: 1, content_sha256: f.project.cases[0].versions[0].content_sha256, protocol_source_id: f.binding.protocol_source_id,
    protocol_sha256: f.protocol.sha256, environment_id: f.environment.environment_id, environment_sha256: f.environment.configuration_sha256, binding_version: 1, mappings_sha256: preparationDigest(f.binding.mappings) } };
  f.manager.generationBatchActive = owner; const save = f.manager.save.bind(f.manager);
  f.manager.save = async item => { const result = await save(item); if (item.state === 'GENERATING') f.project.cases[0].current_version = 2; return result; };
  await assert.rejects(() => f.manager.create(f.projectId, { ...f.createInput, execution: undefined, generate: true, allow_model: true }, owner), /BACKEND_CASE_VERSION_STALE/);
  assert.equal(calls, 0); const plans = await f.manager.all(f.projectId); assert.equal(plans.find(row => row.plan_id)?.state, 'FAILED'); assert.equal(plans.find(row => row.plan_id)?.model_requests[0].status, 'NOT_RUN');
  f.manager.generationBatchActive = null;
});

test('persistent run schema and id remain independent from HTTP namespace identity', async t => {
  const namespace = 'backend-run-' + randomUUID();
  const f = await fixture(t, { execute: async args => { await args.onEvidence({ type: 'request-started', phase: 'setup', run_id: namespace }); return result(namespace); } });
  const plan = await f.confirmed();
  const selection = Object.fromEntries(Object.entries(f.manager.automationIdentity(plan)).reverse());
  const run = await f.manager.start(selection); await f.manager.completions.get(run.run_id);
  const saved = f.runs.get(run.run_id);
  assert.equal(saved.schema, 'workbench/backend-run-v1'); assert.equal(saved.result_schema, 'workbench/backend-result-v1');
  assert.equal(saved.namespace_id, namespace); assert.notEqual(saved.run_id, namespace); assert.equal(saved.run_id, run.run_id);
  assert.equal(saved.model_calls, 0); assert.equal(saved.environment_binding.configuration_sha256, f.environment.configuration_sha256);
  assert.equal(saved.executed_content_sha256, plan.content_sha256); assert.equal(saved.origin, 'HTTP_BACKEND_PLAN'); assert.deepEqual(saved.files, []);
});
test('selection comparison is order-independent but rejects changed or extra identity fields', async t => {
  const f = await fixture(t); const plan = await f.confirmed(); const selection = f.manager.automationIdentity(plan);
  await f.manager.resolveSelection(Object.fromEntries(Object.entries(selection).reverse()));
  await assert.rejects(() => f.manager.resolveSelection({ ...selection, candidate_version: 99 }), /BACKEND_SELECTION_MISMATCH/);
  await assert.rejects(() => f.manager.resolveSelection({ ...selection, arbitrary: true }), /BACKEND_SELECTION_MISMATCH/);
});
test('environment mutation with unchanged configuration hash cannot run or confirm plans', async t => {
  const f = await fixture(t); const plan = await f.confirmed();
  const changed = { ...f.environment, base_url: 'http://127.0.0.1:9999' }; await f.manager.save(changed);
  await assert.rejects(() => f.manager.resolve(f.projectId, plan.plan_id), /BACKEND_ENVIRONMENT_IDENTITY_CHANGED/);
});
test('ordinary environment registration freezes explicit GET-only path scope and refuses credentials or workbench origin', async t => {
  const f = await fixture(t);
  const environment = await f.manager.registerEnvironment(f.projectId, { mode: 'http-json-readonly', name: '图书只读目标', base_url: 'http://127.0.0.1:4462', allowed_path_prefixes: ['/api/books'], non_production: true, authorized: true, reviewer: 'reviewer' });
  assert.equal(environment.mode, 'http-json-readonly'); assert.deepEqual(environment.allowed_methods, ['GET']);
  assert.deepEqual(environment.allowed_headers, []); assert.deepEqual(environment.allowed_path_prefixes, ['/api/books/']);
  assert.equal(Object.hasOwn(environment, 'namespace'), false);
  for (const base_url of ['http://user:password@127.0.0.1:4462', 'http://127.0.0.1:4322']) {
    await assert.rejects(() => f.manager.registerEnvironment(f.projectId, { mode: 'http-json-readonly', base_url, allowed_path_prefixes: ['/api/books'], non_production: true, authorized: true, reviewer: 'reviewer' }), /BACKEND_ENVIRONMENT_INVALID/);
  }
  for (const prefix of ['/api/books/../admin', '/api/books/%2e%2e/admin', '/']) {
    await assert.rejects(() => f.manager.registerEnvironment(f.projectId, { mode: 'http-json-readonly', base_url: 'http://127.0.0.1:4462', allowed_path_prefixes: [prefix], non_production: true, authorized: true, reviewer: 'reviewer' }), /BACKEND_ENVIRONMENT_SCOPE_INVALID/);
  }
});
test('run admission reserves manager while resolving and prevents two simultaneous starts', async t => {
  const hold = gate(); const f = await fixture(t, { execute: async () => { await hold.promise; return result(); } });
  const plan = await f.confirmed(), selection = f.manager.automationIdentity(plan);
  const results = await Promise.allSettled([f.manager.start(selection), f.manager.start(selection)]);
  assert.equal(results.filter(entry => entry.status === 'fulfilled').length, 1);
  assert.match(results.find(entry => entry.status === 'rejected').reason.message, /BACKEND_EXECUTOR_BUSY/);
  hold.resolve(); await f.manager.completion; assert.equal(f.manager.active, null); assert.equal(f.runs.size, 1);
});
test('restart marks pending model and runs interrupted without replaying HTTP or model', async t => {
  let calls = 0; const f = await fixture(t, { execute: async () => { calls++; return result(); }, modelClient: { generate: async () => { calls++; return {}; } } });
  const plan = await f.manager.create(f.projectId, f.createInput);
  await f.manager.save({ ...plan, state: 'GENERATING', model_requests: [{ status: 'STARTED', usage: { prompt_tokens: 8 }, started_at: new Date().toISOString() }] });
  const runId = 'backend-' + randomUUID(); f.runs.set(runId, { schema: 'workbench/backend-run-v1', run_id: runId, status: 'RUNNING', execution_status: 'RUNNING', namespace_id: 'backend-run-interrupted' });
  const restarted = new BackendManager(f.dependencies); await restarted.init();
  const recovered = await restarted.get(f.projectId, plan.plan_id);
  assert.equal(recovered.state, 'INTERRUPTED'); assert.equal(recovered.model_requests[0].status, 'INTERRUPTED'); assert.equal(recovered.model_requests[0].usage.prompt_tokens, 8);
  assert.equal(f.runs.get(runId).status, 'INTERRUPTED'); assert.equal(f.runs.get(runId).complete_pass, false); assert.equal(f.runs.get(runId).cleanup_error.manual_recovery_required, true); assert.equal(calls, 0);
});
test('generate/revise/regenerate preserve original and send seeds only for explicit revision', async t => {
  const calls = []; let execution;
  const f = await fixture(t, { modelClient: { generate: async request => { calls.push(request.input); return { execution: copy(execution), usage: { prompt_tokens: 20, completion_tokens: 30 }, model: 'test-model' }; } } });
  execution = f.execution;
  const original = await f.confirmed(); const frozen = await f.manager.get(f.projectId, original.plan_id);
  const revised = await f.manager.create(f.projectId, { ...f.createInput, execution: undefined, request_mode: 'revise', source_plan_id: original.plan_id, feedback: '核对持久化完整对象', generate: true, allow_model: true });
  await f.manager.completion;
  const revision = await f.manager.get(f.projectId, revised.plan_id);
  assert.equal(revision.state, 'DRAFT'); assert.equal(revision.source_plan_id, original.plan_id); assert.equal(revision.version, original.version + 1); assert.equal(revision.model_requests.length, 1);
  assert.equal(calls[0].feedback, '核对持久化完整对象'); assert.deepEqual(calls[0].source_execution, original.execution); assert.deepEqual(calls[0].confirmed_binding, f.binding.mappings);
  const regenerated = await f.manager.create(f.projectId, { ...f.createInput, execution: undefined, request_mode: 'regenerate', source_plan_id: original.plan_id, generate: true, allow_model: true });
  await f.manager.completion;
  assert.equal((await f.manager.get(f.projectId, regenerated.plan_id)).state, 'DRAFT');
  assert.equal(Object.hasOwn(calls[1], 'source_execution'), false); assert.equal(Object.hasOwn(calls[1], 'feedback'), false);
  assert.deepEqual(await f.manager.get(f.projectId, original.plan_id), frozen);
  await assert.rejects(() => f.manager.confirm(f.projectId, original.plan_id, { revision: original.revision, reviewer: 'any' }), /BACKEND_PLAN_IMMUTABLE/);
});
test('failed paid JSON response preserves numeric usage without persisting raw secret-bearing errors', async t => {
  const f = await fixture(t, { modelClient: { generate: async () => { const error = new Error('transport token=private-key'); error.requirement_diagnostic = { error_code: 'DEEPSEEK_JSON_INVALID', finish_reason: 'stop', usage: { prompt_tokens: 11, completion_tokens: 5, api_key: 'private-key' }, response_text: 'secret raw text' }; throw error; } } });
  const created = await f.manager.create(f.projectId, { ...f.createInput, generate: true, allow_model: true }); await f.manager.completion;
  const plan = await f.manager.get(f.projectId, created.plan_id);
  assert.equal(plan.state, 'FAILED'); assert.equal(plan.model_requests[0].usage.prompt_tokens, 11); assert.equal(plan.model_requests[0].diagnostic.error_code, 'DEEPSEEK_JSON_INVALID');
  assert.equal(JSON.stringify(plan).includes('private-key'), false); assert.equal(JSON.stringify(plan).includes('secret raw text'), false);
});
test('schema-invalid model answer keeps paid-call usage and cancellation never confirms a plan', async t => {
  const f = await fixture(t, { modelClient: { generate: async () => ({ execution: {}, usage: { total_tokens: 25 } }) } });
  const invalid = await f.manager.create(f.projectId, { ...f.createInput, generate: true, allow_model: true }); await f.manager.completion;
  assert.equal((await f.manager.get(f.projectId, invalid.plan_id)).model_requests[0].usage.total_tokens, 25);
  f.manager.modelClient = { generate: async ({ signal }) => { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); return { execution: f.execution, usage: { total_tokens: 12 } }; } };
  const pending = await f.manager.create(f.projectId, { ...f.createInput, generate: true, allow_model: true }); await f.manager.cancel(f.projectId, pending.plan_id);
  const cancelled = await f.manager.get(f.projectId, pending.plan_id); assert.equal(cancelled.state, 'CANCELLED'); assert.equal(cancelled.model_requests[0].usage.total_tokens, 12);
});


test('rejected paid model plan preserves bounded redacted candidate without enabling execution', async t => {
  const f = await fixture(t, {modelClient:{generate:async()=>({execution:{bad:true,headers:{authorization:'not-a-real-secret'}},usage:{total_tokens:7},model:'mock'})}});
  const p=await f.manager.create(f.projectId,{...f.createInput,generate:true,allow_model:true});await f.manager.completion;
  const saved=await f.manager.get(f.projectId,p.plan_id);assert.equal(saved.state,'FAILED');assert.equal(saved.model_requests[0].usage.total_tokens,7);
  assert.equal(saved.rejected_execution.headers.authorization,'[REDACTED]');await assert.rejects(f.manager.resolve(f.projectId,p.plan_id),/SCRIPT_GENERATION_FAILED/);
});
