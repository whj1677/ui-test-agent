import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { NativeDshManager } from '../server/native-dsh/manager.mjs';
import { nativeDshRoute } from '../server/native-dsh/routes.mjs';
import { registeredRunEvidence } from '../server/native-dsh/reruns.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const contentSha = 'a'.repeat(64);
const pause = () => new Promise(resolve => setTimeout(resolve, 5));
async function until(predicate) { for (let i = 0; i < 200; i++) { if (predicate()) return; await pause(); } throw Error('TEST_TIMEOUT'); }

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-dsh-reruns-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^native-dsh-reruns-/);
    await fs.rm(root, { recursive: true, force: true });
  });
  const projectId = `project-${randomUUID()}`, sourceTaskId = `native-${randomUUID()}`, sourceRunId = `run-${randomUUID()}`;
  const content = { external_id: 'TC-001', title: '冻结用例', steps: [{ order: 1, action: '原动作', expected: '原预期' }] };
  const project = { project_id: projectId, cases: [{ case_id: 'case-one', current_version: 1, versions: [{ version: 1, content_sha256: contentSha, content }] }] };
  const sourceDirectory = path.join(root, projectId, 'runs', sourceRunId), entry = 'specs/TC-001.spec.mjs';
  await fs.mkdir(path.join(sourceDirectory, 'snapshot/specs'), { recursive: true });
  const script = 'export const frozen = "original";', helper = 'export const helper = "old version";';
  const files = [{ path: entry, bytes: Buffer.byteLength(script), sha256: digest(script) }, { path: 'helper.mjs', bytes: Buffer.byteLength(helper), sha256: digest(helper) }];
  const manifest = { entry, case_id: 'TC-001', purpose: 'case', script_sha256: digest(script), bundle_sha256: digest(JSON.stringify(files)), files };
  const contents = { 'source-manifest.json': JSON.stringify(manifest), [`snapshot/${entry}`]: script, 'snapshot/helper.mjs': helper };
  const artifacts = [];
  for (const [relative_path, value] of Object.entries(contents)) {
    await fs.writeFile(path.join(sourceDirectory, relative_path), value);
    artifacts.push({ id: `${sourceRunId}-${digest(relative_path).slice(0, 24)}`, kind: relative_path.startsWith('snapshot/') ? 'script' : 'report', relative_path,
      name: path.basename(relative_path), sha256: digest(value), bytes: Buffer.byteLength(value) });
  }
  const environmentIdentity = { environment_id: 'env-one', configuration_sha256: 'e'.repeat(64) };
  const original = { id: sourceTaskId, project_id: projectId, status: 'COMPLETED', environment_id: 'env-one', environment_identity: environmentIdentity,
    created_at: '2026-10-15T00:00:00.000Z', items: [{ case_id: 'case-one', case_version: 1, content_sha256: contentSha, external_id: 'TC-001', formal_entry: entry, content, status: 'PASSED' }],
    runs: [{ id: sourceRunId, case_id: 'case-one', external_id: 'TC-001', case_version: 1, case_content_sha256: contentSha,
      status: 'PASSED', entry, purpose: 'case', counts_for_case: true, script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256,
      started_at: '2026-10-15T00:00:01.000Z', finished_at: '2026-10-15T00:00:02.000Z', artifacts }] };
  const sessionFile = path.join(root, projectId, 'session.json');
  await fs.writeFile(sessionFile, JSON.stringify({ project_id: projectId, session_id: 'session-preserved', tasks: [original] }));
  let authValid = true, protectedCount = 0, otherActive = false, executeImpl;
  const executions = [];
  const manager = new NativeDshManager({ root, workspaceRoot: path.join(root, 'never-use-workspace'),
    caseStore: { getProject: async id => id === projectId ? structuredClone(project) : null },
    projectEnvironments: { assert: async (id, kind, environmentId) => {
      assert.equal(id, projectId); assert.equal(kind, 'ui'); assert.equal(environmentId, 'env-one'); return { ui_identity: environmentIdentity };
    } },
    buildManager: { browserExecutable: 'fake.exe', developmentEnvironments: [{ id: 'env-one', normal_url: 'http://sut.invalid', auth_requirement: { environment_id: 'env-one', role: 'tester' } }],
      authSessions: {
        check: async () => ({ status: authValid ? 'VALID' : 'INVALID', session_version: 'auth-v1' }),
        beginTaskProtection: () => { protectedCount++; return () => { protectedCount--; }; },
        stateForExecution: async () => ({ cookies: [], origins: [] }),
        attachEndpoint() { assert.fail('frozen rerun does not need a model exploration browser'); }
      } },
    client: { available: false, run() { assert.fail('frozen rerun must never call DSH/model'); } }, otherActive: () => otherActive,
    execute: async args => {
      executions.push(args);
      if (executeImpl) return executeImpl(args);
      assert.equal(args.workspace, undefined); assert.equal(args.frozenSource.runDirectory, sourceDirectory);
      assert.equal(args.identity.executed_case_id, 'case-one'); assert.equal(args.frozenCaseContent.steps[0].expected, '原预期');
      await fs.cp(sourceDirectory, args.runDirectory, { recursive: true });
      return { status: 'FAILED', error: 'REAL_ASSERTION_FAILED', started_at: '2026-10-15T02:00:00.000Z', finished_at: '2026-10-15T02:00:01.000Z',
        script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256,
        artifacts: artifacts.map(file => ({ ...file, id: file.id.slice(sourceRunId.length + 1) })), evidence_status: 'INCOMPLETE',
        step_coverage: { complete: false, items: [{ order: 1, execution_status: 'FAILED' }] } };
    }
  });
  const selection = { source_task_id: sourceTaskId, source_run_id: sourceRunId, case_id: 'case-one', case_version: 1,
    content_sha256: contentSha, script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256 };
  const input = () => ({ request_id: randomUUID(), allow_execution: true, items: [structuredClone(selection)], timeout_minutes: 1 });
  return { root, manager, projectId, project, original, sessionFile, sourceDirectory, manifest, selection, input, executions,
    setAuth: value => { authValid = value; }, setBusy: value => { otherActive = value; }, setExecute: value => { executeImpl = value; },
    setEnvironmentHash: value => { environmentIdentity.configuration_sha256 = value; },
    protectedCount: () => protectedCount };
}

test('preflight and frozen rerun require no model, preserve source, append actual failure, and are idempotent', async t => {
  const f = await fixture(t), before = await fs.readFile(f.sessionFile), sourceBefore = await fs.readFile(path.join(f.sourceDirectory, 'snapshot/helper.mjs'));
  const preview = await f.manager.previewRerun(f.projectId, { items: [f.selection] });
  assert.equal(preview.allowed, true); assert.equal(preview.model_calls, 0); assert.equal(f.executions.length, 0);
  assert.deepEqual(await fs.readFile(f.sessionFile), before);
  const input = f.input(), task = await f.manager.createRerun(f.projectId, input);
  await f.manager.completion;
  const saved = await f.manager.get(f.projectId, task.id);
  assert.equal(saved.kind, 'FROZEN_SCRIPT_RERUN'); assert.equal(saved.model_calls, 0); assert.equal(saved.status, 'PARTIAL');
  assert.equal(saved.runs[0].status, 'FAILED'); assert.equal(saved.runs[0].source_run_id, f.selection.source_run_id);
  assert.equal(saved.runs[0].evidence_status, 'INCOMPLETE'); assert.equal(f.executions.length, 1); assert.equal(f.protectedCount(), 0);
  assert.equal((await f.manager.createRerun(f.projectId, input)).id, task.id); assert.equal(f.executions.length, 1);
  await assert.rejects(f.manager.createRerun(f.projectId, { ...input, timeout_minutes: 2 }), /REQUEST_CONFLICT/);
  const stored = JSON.parse(await fs.readFile(f.sessionFile)); assert.deepEqual(stored.tasks[0], f.original);
  assert.deepEqual(await fs.readFile(path.join(f.sourceDirectory, 'snapshot/helper.mjs')), sourceBefore);
  assert.equal(stored.session_id, 'session-preserved');
  const console = await f.manager.console(f.projectId);
  assert.equal(console.records[0].execution_kind, 'FROZEN_SCRIPT_RERUN'); assert.equal(console.records[0].status, 'FAILED');
  assert.equal(console.records[0].evidence_status, 'INCOMPLETE'); assert.equal(console.records[0].step_coverage.items[0].execution_status, 'FAILED');
});

test('preflight rejects stale case, source hash, foreign source, diagnostics, changed environment and invalid login', async t => {
  const f = await fixture(t);
  for (const [change, reason] of [[{ case_version: 2 }, 'NATIVE_DSH_CASE_CHANGED'], [{ bundle_sha256: 'b'.repeat(64) }, 'NATIVE_DSH_RERUN_SOURCE_CHANGED'],
    [{ source_task_id: `native-${randomUUID()}` }, 'NATIVE_DSH_RERUN_SOURCE_NOT_FOUND']]) {
    assert.equal((await f.manager.previewRerun(f.projectId, { items: [{ ...f.selection, ...change }] })).reason, reason);
  }
  f.setAuth(false); assert.equal((await f.manager.previewRerun(f.projectId, { items: [f.selection] })).reason, 'NATIVE_DSH_LOGIN_REQUIRED');
  await assert.rejects(f.manager.createRerun(f.projectId, f.input()), /LOGIN_REQUIRED/); f.setAuth(true);
  f.project.cases[0].current_version = 2; assert.equal((await f.manager.previewRerun(f.projectId, { items: [f.selection] })).reason, 'NATIVE_DSH_CASE_CHANGED');
  f.project.cases[0].current_version = 1;
  f.setEnvironmentHash('f'.repeat(64)); assert.equal((await f.manager.previewRerun(f.projectId, { items: [f.selection] })).reason, 'NATIVE_DSH_ENVIRONMENT_CHANGED');
  f.setEnvironmentHash('e'.repeat(64));
  const stored = JSON.parse(await fs.readFile(f.sessionFile)); stored.tasks[0].runs[0].purpose = 'diagnostic'; await fs.writeFile(f.sessionFile, JSON.stringify(stored));
  assert.equal((await f.manager.previewRerun(f.projectId, { items: [f.selection] })).reason, 'NATIVE_DSH_RERUN_FORMAL_SOURCE_REQUIRED');
  assert.equal(f.executions.length, 0);
});

test('source mutation after preflight blocks startup and never falls back to workspace', async t => {
  const f = await fixture(t), input = f.input();
  assert.equal((await f.manager.previewRerun(f.projectId, input)).allowed, true);
  await fs.writeFile(path.join(f.sourceDirectory, 'snapshot/helper.mjs'), 'mutated frozen file');
  await assert.rejects(f.manager.createRerun(f.projectId, input), /SOURCE_FILE_MISMATCH/);
  assert.equal(f.executions.length, 0); assert.equal((await f.manager.load(f.projectId)).tasks.length, 1);
});

test('rerun shares busy protection and cancellation releases only confirmed execution', async t => {
  const f = await fixture(t);
  f.setBusy(true); await assert.rejects(f.manager.createRerun(f.projectId, f.input()), /NATIVE_DSH_BUSY/); f.setBusy(false);
  f.setExecute(args => new Promise(resolve => args.signal.addEventListener('abort', () => resolve({ status: 'CANCELLED', artifacts: [], finished_at: new Date().toISOString() }), { once: true })));
  const task = await f.manager.createRerun(f.projectId, f.input()); await until(() => f.executions.length === 1);
  await assert.rejects(f.manager.createRerun(f.projectId, f.input()), /NATIVE_DSH_BUSY/);
  assert.equal(f.protectedCount(), 1); await f.manager.stop(f.projectId, task.id); await f.manager.completion;
  assert.equal((await f.manager.get(f.projectId, task.id)).status, 'CANCELLED'); assert.equal(f.protectedCount(), 0); assert.equal(f.manager.active, null);
});

test('unconfirmed execution retains STOP_UNCONFIRMED lock and login protection', async t => {
  const f = await fixture(t);
  f.setExecute(async () => ({ status: 'ERROR', stop_unconfirmed: true, artifacts: [], error: 'PROCESS_STOP_UNCONFIRMED' }));
  const task = await f.manager.createRerun(f.projectId, f.input()); await f.manager.completion;
  assert.equal((await f.manager.get(f.projectId, task.id)).status, 'STOP_UNCONFIRMED');
  assert.equal(f.manager.active.unconfirmed, true); assert.equal(f.protectedCount(), 1); assert.equal(f.manager.storageFault, true);
  f.manager.active.release(); assert.equal(f.protectedCount(), 0);
});

test('registered evidence remaps file references consistently and rerun routes enforce mutation gate', async () => {
  const result = registeredRunEvidence({ error: 'video', tests: [{ actual: 'video' }], artifacts: [{ id: 'video', relative_path: 'video.webm' }], files: [{ file_id: 'video' }], window_recording: { file_id: 'video' },page_recording:{file_ids:['video']} }, 'run-owned');
  assert.equal(result.files[0].file_id, result.artifacts[0].id); assert.equal(result.window_recording.file_id, result.artifacts[0].id);assert.equal(result.page_recording.file_ids[0],result.artifacts[0].id);
  assert.equal(result.error, 'video'); assert.equal(result.tests[0].actual, 'video');
  for (const [suffix, method] of [['reruns/preflight', 'previewRerun'], ['reruns', 'createRerun']]) {
    let called = false, status;
    const args = { request: { method: 'POST' }, response: {}, url: new URL(`http://127.0.0.1/api/case-library/projects/project-one/native-dsh/${suffix}`),
      manager: { [method]: async (id, input) => { called = true; assert.equal(id, 'project-one'); assert.deepEqual(input, { items: [] }); return {}; } },
      sendJson: (_, value) => { status = value; }, readJsonBody: async () => ({ items: [] }), trustedMutation: () => false };
    await nativeDshRoute(args); assert.equal(status, 403); assert.equal(called, false);
    await nativeDshRoute({ ...args, trustedMutation: () => true }); assert.equal(called, true); assert.equal(status, suffix.includes('preflight') ? 200 : 202);
  }
});
