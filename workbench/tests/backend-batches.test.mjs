import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BackendManager } from '../server/backend-manager.mjs';
import { BatchManager } from '../server/batches.mjs';
import { exampleExecution } from '../server/backend/example.mjs';
import { backendDigest } from '../server/backend/execution.mjs';
const clone = value => structuredClone(value);

async function fixture(t, waitForCancel = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-batch-'));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const projectId = 'project-' + randomUUID(), caseId = 'case-' + randomUUID();
  const content = { case_type: 'BACKEND', external_id: 'BACKEND-BATCH', title: '批次后端用例', status: 'CONFIRMED', steps: [1, 2, 3].map(order => ({ order, action: '合成输入', expected: '明确预期' })) };
  const hash = backendDigest(content).toUpperCase();
  const project = { project_id: projectId, revision: 1, cases: [{ case_id: caseId, current_version: 1, versions: [{ version: 1, content, content_sha256: hash }] }] };
  const caseStore = { getProject: async id => id === projectId ? clone(project) : null };
  const runs = new Map();
  const runStore = { listRuns: async () => clone([...runs.values()]), getRun: async id => clone(runs.get(id)), createRun: async value => { runs.set(value.run_id, clone(value)); return clone(value); }, updateRun: async (id, update) => { const value = await update(clone(runs.get(id))); runs.set(id, clone(value)); return clone(value); } };
  let executions = 0;
  const backend = new BackendManager({ root: path.join(root, 'backend'), caseStore, runStore,
    requirementsManager: { getBindings: async (project, case_id) => ({ bindings: [{ project_id: project, case_id, binding_id: 'binding-' + case_id.slice(5), version: 1, case_version: 1, case_content_sha256: hash, protocol_source_id: 'source-' + randomUUID(), protocol_sha256: 'protocol', status: 'COMPLETE', confirmation_status: 'CONFIRMED', mappings: [] }] }), getSource: async () => ({ project_id: projectId, kind: 'PROTOCOL', sha256: 'protocol', segments: [] }) },
    execute: async ({ signal }) => { executions++; if (waitForCancel && !signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); return { schema: 'workbench/backend-result-v1', run_id: 'backend-run-' + randomUUID(), execution_status: signal.aborted ? 'CANCELLED' : 'FINISHED', status: signal.aborted ? 'CANCELLED' : 'PASSED', complete_pass: !signal.aborted, setup: [], steps: [], cleanup: [], model_calls: 0 }; },
  }); await backend.init();
  const environment = await backend.registerEnvironment(projectId, { name: '已登记的合成接口', base_url: 'http://127.0.0.1:4401', non_production: true, authorized: true, reviewer: '工程检查' });
  async function confirm(id = caseId) {
    const draft = await backend.create(projectId, { case_id: id, case_version: 1, binding_version: 1, environment_id: environment.environment_id, execution: { ...clone(exampleExecution), environment_id: environment.environment_id } });
    return backend.confirm(projectId, draft.plan_id, { revision: draft.revision, reviewer: '工程检查' });
  }
  const plan = await confirm();
  const buildManager = { assertStorageWritable() {}, reportStorageFault(error) { throw error; }, otherActive: () => Boolean(backend.active), store: {}, caseAutomation: async () => ({ candidates: [] }), candidateTrialEnvironments: [], startCandidateTrial: async () => { throw Error('UI_RUNNER_MUST_NOT_START'); } };
  const batches = new BatchManager({ root: path.join(root, 'batches'), buildManager, caseStore, runStore }); batches.backendManager = backend; await batches.init();
  const input = { project_id: projectId, scope: 'single', case_ids: [caseId], selections: [backend.automationIdentity(plan)] };
  return { root, projectId, caseId, project, runs, backend, batches, environment, plan, confirm, input, executions: () => executions };
}
const receipt = () => ({ request_id: 'test-' + randomUUID(), allow_partial: false });

test('backend batch dispatch and identical request receipt are zero-model and single-run', async t => {
  const f = await fixture(t); const preview = await f.batches.preview(f.input), request = receipt();
  assert.equal(preview.items[0].environment_name, f.environment.name);
  const [first, replay] = await Promise.all([f.batches.start(preview.batch_id, f.projectId, request), f.batches.start(preview.batch_id, f.projectId, request)]);
  assert.equal(first.batch_id, replay.batch_id); await f.batches.completion;
  const complete = await f.batches.get(preview.batch_id, f.projectId);
  assert.equal(complete.items[0].result, 'PASSED'); assert.equal(f.executions(), 1); assert.equal(complete.model_calls, 0); assert.equal(complete.harness_starts, 0);
  assert.equal(f.runs.get(complete.items[0].run_id).schema, 'workbench/backend-run-v1');
  await assert.rejects(() => f.batches.start(preview.batch_id, f.projectId, receipt()), /BATCH_REQUEST_CONFLICT/);
});
test('mixed availability retains blocked backend case and requires explicit partial execution', async t => {
  const f = await fixture(t); f.project.cases.push({ ...clone(f.project.cases[0]), case_id: 'case-' + randomUUID() });
  const preview = await f.batches.preview({ ...f.input, scope: 'project' });
  assert.equal(preview.items[1].state, 'BLOCKED'); assert.equal(preview.items[1].reason, 'BACKEND_CONFIRMED_PLAN_REQUIRED');
  await assert.rejects(() => f.batches.start(preview.batch_id, f.projectId, receipt()), /BATCH_PARTIAL_CONFIRMATION_REQUIRED/);
  await f.batches.start(preview.batch_id, f.projectId, { ...receipt(), allow_partial: true }); await f.batches.completion;
  const done = await f.batches.get(preview.batch_id); assert.equal(done.items[1].state, 'BLOCKED'); assert.equal(done.items[1].result, undefined); assert.equal(f.executions(), 1);
});
test('changed backend environment after preview is rejected before a request is dispatched', async t => {
  const f = await fixture(t); const preview = await f.batches.preview(f.input);
  await f.backend.save({ ...f.environment, base_url: 'http://127.0.0.1:9999' });
  await assert.rejects(() => f.batches.start(preview.batch_id, f.projectId, receipt()), /BACKEND_ENVIRONMENT_IDENTITY_CHANGED/);
  assert.equal(f.executions(), 0); assert.equal((await f.batches.get(preview.batch_id)).state, 'PREVIEW');
});
test('backend batch cancellation stops owned run and does not start remaining cases', async t => {
  const f = await fixture(t, true); const second = 'case-' + randomUUID(); f.project.cases.push({ ...clone(f.project.cases[0]), case_id: second }); await f.confirm(second);
  const preview = await f.batches.preview({ ...f.input, scope: 'project' }); await f.batches.start(preview.batch_id, f.projectId, receipt());
  while (!f.executions()) await new Promise(resolve => setTimeout(resolve, 5));
  await f.batches.stop(preview.batch_id, f.projectId); await f.batches.completion;
  const done = await f.batches.get(preview.batch_id); assert.equal(done.state, 'CANCELLED'); assert.equal(done.items[0].result, 'CANCELLED'); assert.equal(done.items[1].state, 'NOT_RUN'); assert.equal(f.executions(), 1);
});
test('backend cross-project and stale-content selections cannot enter execution', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.batches.preview({ ...f.input, case_ids: ['case-' + randomUUID()], selections: [] }), /BATCH_CROSS_PROJECT_CASE/);
  const stale = await f.batches.preview({ ...f.input, selections: [{ ...f.input.selections[0], content_sha256: 'stale' }] }); assert.equal(stale.items[0].state, 'BLOCKED');
  await assert.rejects(() => f.batches.start(stale.batch_id, f.projectId, { ...receipt(), allow_partial: true }), /BATCH_NO_RUNNABLE_CASES/); assert.equal(f.executions(), 0);
});
test('backend batch restart marks queued work interrupted without model or HTTP replay', async t => {
  const f = await fixture(t); const preview = await f.batches.preview(f.input); preview.state = 'RUNNING'; await f.batches.save(preview); await f.batches.init();
  const done = await f.batches.get(preview.batch_id); assert.equal(done.state, 'INTERRUPTED'); assert.equal(done.items[0].state, 'NOT_RUN'); assert.equal(done.items[0].reason, 'SERVICE_INTERRUPTED_NO_REPLAY'); assert.equal(f.executions(), 0);
});
