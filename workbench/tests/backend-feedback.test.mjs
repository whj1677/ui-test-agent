import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BackendManager } from '../server/backend-manager.mjs';
import { BackendHarnessSession } from '../server/backend/harness-session.mjs';
import { exampleExecution } from '../server/backend/example.mjs';
import { backendDigest } from '../server/backend/execution.mjs';

const copy = value => structuredClone(value);
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-feedback-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectId = 'project-' + randomUUID(), caseId = 'case-' + randomUUID();
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-F-1', title: '查询', steps: [
    { order: 1, action: '查询设备', expected: '结果包含 DEV001' }, { order: 2, action: '查询持续性', expected: '设备保持不变' }, { order: 3, action: '再次查询', expected: '设备保持不变' },
  ] };
  const version = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const project = { project_id: projectId, cases: [{ case_id: caseId, current_version: 1, versions: [version] }] };
  const binding = { project_id: projectId, case_id: caseId, binding_id: 'binding-' + randomUUID(), version: 1, case_version: 1,
    case_content_sha256: version.content_sha256, status: 'COMPLETE', confirmation_status: 'CONFIRMED', protocol_source_id: 'source-' + randomUUID(),
    protocol_sha256: 'protocol-sha', mappings: [{ step_order: 1, path: '/api/devices' }] };
  const protocol = { project_id: projectId, kind: 'PROTOCOL', sha256: binding.protocol_sha256, segments: [{ text: 'fixture protocol' }] };
  const runs = new Map();
  const runStore = { listRuns: async () => copy([...runs.values()]), createRun: async run => { runs.set(run.run_id, copy(run)); return copy(run); },
    getRun: async id => copy(runs.get(id) || null), updateRun: async (id, updater) => { const next = await updater(copy(runs.get(id))); runs.set(id, copy(next)); return copy(next); } };
  const manager = new BackendManager({ root, caseStore: { getProject: async id => id === projectId ? copy(project) : null },
    requirementsManager: { getBindings: async () => ({ bindings: [copy(binding)] }), getSource: async () => copy(protocol) }, runStore,
    execute: async () => ({ schema: 'workbench/backend-result-v1', run_id: 'namespace-' + randomUUID(), runner_kind: 'HTTP_JSON',
      status: 'FAILED', execution_status: 'FINISHED', complete_pass: false, setup: [], cleanup: [],
      steps: [{ order: 1, status: 'FAILED', requests: [{ request_id: 'query', status: 'FAILED', request: { method: 'GET', path: '/api/devices' },
        response: { status: 200, body: { access_token: 'do-not-store' } }, assertions: [{ target: 'json', pointer: '/items', op: 'length', expected: 1, actual: 0, status: 'FAILED' }] }] }] }) });
  await manager.init();
  const environment = await manager.registerEnvironment(projectId, { name: '合成目标', base_url: 'http://127.0.0.1:4401', non_production: true, authorized: true, reviewer: 'reviewer' });
  const execution = { ...copy(exampleExecution), environment_id: environment.environment_id };
  const input = { case_id: caseId, case_version: 1, binding_version: 1, environment_id: environment.environment_id, execution };
  const draft = await manager.create(projectId, input);
  const source = await manager.confirm(projectId, draft.plan_id, { revision: draft.revision, reviewer: 'reviewer' });
  const run = await manager.start(manager.automationIdentity(source)); await manager.completions.get(run.run_id);
  return { manager, projectId, caseId, content, binding, environment, input, source, run: runs.get(run.run_id), runs, root };
}

const reviseInput = f => ({ ...f.input, execution: undefined, request_mode: 'revise', source_plan_id: f.source.plan_id,
  feedback: '核对运行失败的业务断言', run_id: f.run.run_id });

test('matching terminal backend run binds sanitized feedback to a new revision and DSH context', async t => {
  const f = await fixture(t); const frozenSource = await f.manager.get(f.projectId, f.source.plan_id);
  const revision = await f.manager.create(f.projectId, reviseInput(f));
  assert.equal(revision.revision_evidence.run_id, f.run.run_id);
  assert.equal(revision.revision_evidence.source_execution_sha256, f.source.execution_sha256);
  assert.equal(revision.revision_evidence.failure_feedback.schema, 'workbench/failure-feedback-v1');
  assert.equal(JSON.stringify(revision.revision_evidence).includes('do-not-store'), false);
  assert.deepEqual(await f.manager.get(f.projectId, f.source.plan_id), frozenSource);
  const restarted = new BackendManager({ ...f.manager, root: f.root });
  assert.deepEqual((await restarted.get(f.projectId, revision.plan_id)).revision_evidence, revision.revision_evidence);
  const context = await f.manager.context(f.projectId, f.caseId, 1, 1);
  const session = new BackendHarnessSession({ plan: revision, context, environment: f.environment,
    revisionSourceExecution: f.source.execution, persist: async () => {}, signal: new AbortController().signal });
  const exposed = session.readContext().revision_input;
  assert.equal(exposed.revision_evidence.run_id, f.run.run_id);
  assert.deepEqual(exposed.revision_evidence.failure_feedback, revision.revision_evidence.failure_feedback);
  assert.equal(JSON.stringify(exposed).includes('do-not-store'), false);
  f.runs.set(f.run.run_id, { ...copy(f.run), test_status: 'PASSED', http_evidence: { steps: [] } });
  assert.deepEqual(session.readContext().revision_input.revision_evidence, revision.revision_evidence);
  const tampered = copy(revision); tampered.revision_evidence.failure_feedback.classification.category = 'NO_FAILURE';
  const rejected = new BackendHarnessSession({ plan: tampered, context, environment: f.environment,
    revisionSourceExecution: f.source.execution, persist: async () => {}, signal: new AbortController().signal });
  assert.throws(() => rejected.readContext(), /BACKEND_REVISION_EVIDENCE_CHANGED/);
});

test('backend run binding rejects foreign, forged, unfinished and mismatched identities before creating a revision', async t => {
  const f = await fixture(t); const input = reviseInput(f);
  const bad = async patch => { f.runs.set(f.run.run_id, { ...copy(f.run), ...patch }); await assert.rejects(f.manager.create(f.projectId, input), /BACKEND_REVISION_RUN_IDENTITY_MISMATCH/); f.runs.set(f.run.run_id, copy(f.run)); };
  await bad({ project_id: 'project-' + randomUUID() });
  await bad({ source_build_task_id: 'plan-' + randomUUID() });
  await bad({ bundle_sha256: 'forged' });
  await bad({ execution_status: 'RUNNING', finished_at: null });
  await bad({ status: 'RUNNING', execution_status: 'FINISHED' });
  await bad({ environment_binding: { ...f.run.environment_binding, configuration_sha256: 'changed' } });
  await assert.rejects(f.manager.create(f.projectId, { ...input, run_id: 'backend-' + randomUUID() }), /BACKEND_REVISION_RUN_IDENTITY_MISMATCH/);
  await assert.rejects(f.manager.create(f.projectId, { ...f.input, run_id: f.run.run_id }), /BACKEND_RUN_ID_UNEXPECTED/);
  await assert.rejects(f.manager.create(f.projectId, { ...f.input, request_mode: 'regenerate', source_plan_id: f.source.plan_id, run_id: f.run.run_id }), /BACKEND_RUN_ID_UNEXPECTED/);
  await assert.rejects(f.manager.create(f.projectId, { ...f.input, revision_evidence: { run_id: f.run.run_id } }), /BACKEND_REVISION_EVIDENCE_INPUT_FORBIDDEN/);
  await assert.rejects(f.manager.create(f.projectId, { ...input, failure_feedback: { classification: { category: 'NO_FAILURE' } } }), /BACKEND_REVISION_EVIDENCE_INPUT_FORBIDDEN/);
  const revisions = (await f.manager.list(f.projectId, f.caseId)).plans.filter(plan => plan.request_mode === 'revise');
  assert.equal(revisions.length, 0);
});

test('backend self-test returns structured business and environment feedback without rewriting expectations', async t => {
  const f = await fixture(t); const context = await f.manager.context(f.projectId, f.caseId, 1, 1);
  const failed = { status: 'FAILED', run_id: 'namespace-original', complete_pass: false, setup: [], cleanup: [], steps: [{ order: 1, status: 'FAILED', requests: [
    { request_id: 'query', status: 'FAILED', assertions: [{ target: 'json', pointer: '/items', op: 'length', expected: 1, actual: 0, status: 'FAILED' }] },
  ] }] };
  const session = new BackendHarnessSession({ plan: copy(f.source), context, environment: f.environment,
    execute: async () => failed, persist: async () => {}, signal: new AbortController().signal });
  await session.initialize(); await session.invoke('self_test');
  const business = await session.invoke('read_evidence', { number: 1 });
  assert.equal(business.failure_feedback.classification.category, 'BUSINESS_DIFFERENCE');
  assert.equal(business.failure_feedback.identity.project_id, f.projectId);
  assert.equal(business.failure_feedback.identity.case_id, f.caseId);
  assert.equal(business.failure_feedback.identity.source_task_id, f.source.plan_id);
  assert.equal(business.failure_feedback.identity.candidate_version, f.source.version);
  assert.equal(business.failure_feedback.identity.bundle_sha256, business.execution_sha256);
  assert.equal(business.failure_feedback.identity.environment_id, f.environment.environment_id);
  assert.equal(business.failure_feedback.identity.run_id, 'namespace-original');
  assert.deepEqual(session.state.self_tests[0].failure_feedback, business.failure_feedback);
  assert.equal(business.failure_feedback.steps[0].expected, f.content.steps[0].expected);
  assert.equal(business.status, 'FAILED');
  const blocked = new BackendHarnessSession({ plan: copy(f.source), context, environment: f.environment,
    execute: async () => ({ status: 'FAILED', complete_pass: false, technical_error: { code: 'AUTH_SESSION_REQUIRED' }, setup: [], steps: [], cleanup: [] }),
    persist: async () => {}, signal: new AbortController().signal });
  await blocked.initialize(); await blocked.invoke('self_test');
  const environment = await blocked.invoke('read_evidence', { number: 1 });
  assert.equal(environment.failure_feedback.classification.category, 'ENVIRONMENT_BLOCKED');
  assert.equal(environment.failure_feedback.identity.source_task_id, f.source.plan_id);
  assert.equal(environment.failure_feedback.steps[0].expected, f.content.steps[0].expected);
  assert.equal(environment.failure_feedback.steps[0].status, 'NOT_EXECUTED');
});
