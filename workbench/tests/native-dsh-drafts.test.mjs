import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeDshManager } from '../server/native-dsh/manager.mjs';
import { nativeTaskHelper, nativeTaskOutcome } from '../server/native-dsh/drafts.mjs';
import { nativeDshRoute } from '../server/native-dsh/routes.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-draft-'));
  t.after(async () => {
    const absolute = path.resolve(root);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir())); assert.match(path.basename(absolute), /^native-draft-/);
    await fs.rm(absolute, { recursive: true, force: true });
  });
  const project = { project_id: `project-${randomUUID()}`, cases: [{ case_id: 'case-one', current_version: 1, versions: [{
    version: 1, content_sha256: 'A'.repeat(64), content: { external_id: 'TC-024', title: '前置不足', status: 'CONFIRMED', case_type: 'UI', steps: [{ order: 1, action: '原动作', expected: '原预期' }] },
  }] }] };
  const workspace = path.join(root, 'workspace'); await fs.mkdir(path.join(workspace, 'specs'), { recursive: true });
  const script = "import { marker } from '../helper.mjs'; throw Error('MUST_NOT_EXECUTE');\n";
  await fs.writeFile(path.join(workspace, 'specs/TC-024.spec.mjs'), script);
  await fs.writeFile(path.join(workspace, 'helper.mjs'), "export const marker = 'original';\n");
  await fs.writeFile(path.join(workspace, 'execute.mjs'), 'PRIVATE_HELPER_TOKEN');
  await fs.writeFile(path.join(workspace, 'current-task.json'), '{"private":"TASK_TOKEN"}');
  const forbidden = () => assert.fail('registration must not call a model, browser, authentication or execution');
  const manager = new NativeDshManager({ root, caseStore: { getProject: async id => id === project.project_id ? structuredClone(project) : null },
    client: { run: forbidden }, execute: forbidden, projectEnvironments: { assert: forbidden }, buildManager: { authSessions: { check: forbidden, stateForExecution: forbidden } } });
  const task = { id: `native-${randomUUID()}`, project_id: project.project_id, status: 'RUNNING', created_at: '2026-10-15T01:00:00Z',
    items: [{ case_id: 'case-one', external_id: 'TC-024', case_version: 1, content_sha256: 'A'.repeat(64), formal_entry: 'specs/TC-024.spec.mjs', content: project.cases[0].versions[0].content, status: 'NOT_RUN' }], runs: [] };
  await fs.mkdir(manager.directory(project.project_id), { recursive: true });
  await manager.save({ project_id: project.project_id, tasks: [task] });
  manager.active = { projectId: project.project_id, taskId: task.id, controller: new AbortController(), token: 'test-only-token', workspace };
  const input = { request_id: randomUUID(), case_id: 'case-one', case_version: 1, content_sha256: 'a'.repeat(64), entry: 'specs/TC-024.spec.mjs',
    draft_status: 'BLOCKED_PRECONDITION', blocker: { code: 'MISSING_AUTHORIZED_TEST_DATA', summary: '缺少两个授权园区' } };
  const register = async (changes = {}) => manager.registerDraft(project.project_id, task.id, { ...input, ...changes }, 'Bearer test-only-token');
  return { root, workspace, project, manager, task, input, register, script };
}

test('draft registration freezes source without any execution and projects a separate blocked draft', async t => {
  const f = await fixture(t), draft = await f.register();
  assert.equal(draft.operation, 'REGISTER_DRAFT'); assert.equal(draft.execution_status, 'NOT_RUN');
  assert.equal(draft.counts_for_case, false); assert.equal(draft.evidence_status, 'NOT_CAPTURED');
  assert.deepEqual(draft.blocker, { code: 'MISSING_AUTHORIZED_TEST_DATA', summary: '缺少两个授权园区', source: 'DSH_REPORTED', verification_status: 'NOT_VERIFIED' });
  const projection = await f.manager.console(f.project.project_id);
  assert.deepEqual(projection.records, []); assert.deepEqual(projection.scripts, []); assert.equal(projection.drafts.length, 1);
  assert.equal(projection.drafts[0].source.available, true); assert.equal(projection.tasks[0].items[0].status, 'NOT_RUN');
  assert.equal(projection.tasks[0].items[0].draft_status, 'BLOCKED_PRECONDITION');
  const artifact = draft.artifacts.find(file => file.relative_path === 'snapshot/specs/TC-024.spec.mjs');
  const served = await f.manager.artifact(f.project.project_id, f.task.id, artifact.id);
  assert.equal(await fs.readFile(path.join(served.root, served.media.relative_path), 'utf8'), f.script);
  assert.ok(draft.artifacts.every(file => !/execute\.mjs|current-task\.json/.test(file.relative_path)));
  assert.match(projection.drafts[0].script_url, /\/native-dsh\/tasks\/native-.*\/files\/draft-/);
});

test('request identity is idempotent and new drafts preserve immutable older source', async t => {
  const f = await fixture(t), first = await f.register();
  await fs.writeFile(path.join(f.workspace, 'helper.mjs'), 'export const marker = 2;');
  assert.deepEqual(await f.register(), first);
  await assert.rejects(f.register({ draft_status: 'UNEXECUTED', blocker: null }), /REQUEST_CONFLICT/);
  const second = await f.register({ request_id: randomUUID(), draft_status: 'UNEXECUTED', blocker: null });
  assert.notEqual(second.id, first.id); assert.equal(second.script_sha256, first.script_sha256); assert.notEqual(second.bundle_sha256, first.bundle_sha256);
  const data = await f.manager.console(f.project.project_id);
  assert.equal(data.drafts.length, 2); assert.ok(data.drafts.every(row => row.source.available));
  assert.equal((await f.manager.get(f.project.project_id, f.task.id)).runs.length, 0);
  f.manager.active = null;
  assert.equal((await f.manager.console(f.project.project_id)).drafts.length, 2, 'historical drafts stay readable without an active task');
  await assert.rejects(f.register(), /NOT_AUTHORIZED/);
});

test('registration rejects unauthorized scope, changed versions, wrong entry and invalid blocker claims', async t => {
  const f = await fixture(t);
  for (const [projectId, taskId, bearer] of [[f.project.project_id, f.task.id, 'Bearer wrong'], [`project-${randomUUID()}`, f.task.id, 'Bearer test-only-token'], [f.project.project_id, `native-${randomUUID()}`, 'Bearer test-only-token']])
    await assert.rejects(async () => f.manager.registerDraft(projectId, taskId, f.input, bearer), /NOT_AUTHORIZED/);
  for (const changes of [{ case_id: 'other' }, { case_version: 2 }, { content_sha256: 'b'.repeat(64) }, { entry: '../escape.mjs' }, { entry: 'specs/TC-OTHER.spec.mjs' },
    { draft_status: 'PASSED' }, { blocker: null }, { blocker: { code: 'UNKNOWN', summary: 'x' } }, { blocker: { code: 'OTHER_PRECONDITION', summary: ' ' } }, { run_id: 'fake' }])
    await assert.rejects(f.register(changes));
  f.project.cases[0].versions[0].content_sha256 = 'c'.repeat(64);
  await assert.rejects(f.register(), /CASE_CHANGED/);
  assert.equal((await f.manager.get(f.project.project_id, f.task.id)).drafts, undefined);
});

test('invalid source dependencies cannot register a draft or create a fake run', async t => {
  const f = await fixture(t);
  for (const script of ["import './missing.mjs';", "import '/absolute/outside.mjs';", "import x from 'unapproved-package';", 'import(process.env.PRIVATE_PATH);']) {
    await fs.writeFile(path.join(f.workspace, f.input.entry), script);
    await assert.rejects(f.register({ request_id: randomUUID() }), /DEPENDENCY/);
  }
  const task = await f.manager.get(f.project.project_id, f.task.id);
  assert.equal(task.drafts, undefined); assert.equal(task.runs.length, 0);
});

test('workspace cannot contain the draft store and linked source paths are rejected', async t => {
  const f = await fixture(t);
  f.manager.active.workspace = f.root;
  await assert.rejects(f.register(), /DIRECTORY_UNSAFE/);
  f.manager.active.workspace = f.workspace;
  const target = path.join(f.root, 'linked-target'); await fs.mkdir(target);
  await fs.symlink(target, path.join(f.workspace, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.register(), /SYMLINK_NOT_ALLOWED/);
  assert.equal((await f.manager.get(f.project.project_id, f.task.id)).drafts, undefined);
});

test('draft artifact IDs cannot collide with the same relative file in a run', async t => {
  const f = await fixture(t), draft = await f.register();
  const file = draft.artifacts.find(row => row.relative_path === 'snapshot/specs/TC-024.spec.mjs');
  const runId = `run-${randomUUID()}`, runArtifact = { ...file, id: file.id.slice(draft.id.length + 1) };
  const runRoot = path.join(f.manager.directory(f.project.project_id), 'runs', runId);
  await fs.mkdir(path.join(runRoot, 'snapshot/specs'), { recursive: true }); await fs.writeFile(path.join(runRoot, file.relative_path), 'old run content');
  await f.manager.update(f.project.project_id, f.task.id, task => task.runs.push({ id: runId, case_id: 'case-one', entry: 'probe.mjs', purpose: 'diagnostic', status: 'PASSED', artifacts: [runArtifact] }));
  const a = await f.manager.artifact(f.project.project_id, f.task.id, file.id), b = await f.manager.artifact(f.project.project_id, f.task.id, runArtifact.id);
  assert.notEqual(a.root, b.root); assert.equal(await fs.readFile(path.join(a.root, a.media.relative_path), 'utf8'), f.script);
  assert.equal(await fs.readFile(path.join(b.root, b.media.relative_path), 'utf8'), 'old run content');
  const data = await f.manager.console(f.project.project_id);
  assert.equal(data.records.length, 1); assert.equal(data.records[0].purpose, 'diagnostic'); assert.equal(data.records[0].counts_for_case, false);
  assert.equal(data.scripts.length, 0); assert.equal(data.drafts.length, 1);
});

test('same-timestamp draft revisions keep the latest registration status without rewriting the old draft', async t => {
  const f = await fixture(t), old = await f.register(), newer = await f.register({ request_id: randomUUID(), draft_status: 'UNEXECUTED', blocker: null });
  await f.manager.update(f.project.project_id, f.task.id, task => { for (const draft of task.drafts) draft.created_at = '2026-10-15T10:00:00.000Z'; });
  const data = await f.manager.console(f.project.project_id);
  assert.deepEqual(data.drafts.map(row => row.draft_id), [newer.id, old.id]);
  assert.equal(data.tasks[0].items[0].draft_status, 'UNEXECUTED'); assert.equal(data.drafts[1].draft_status, 'BLOCKED_PRECONDITION');
});

test('source tampering and manifest identity mismatches remain visible as unavailable drafts', async t => {
  const f = await fixture(t), draft = await f.register(), root = path.join(f.manager.directory(f.project.project_id), 'drafts', draft.id);
  await fs.writeFile(path.join(root, 'snapshot/helper.mjs'), 'tampered');
  let data = await f.manager.console(f.project.project_id);
  assert.equal(data.drafts[0].source.reason, 'SOURCE_FILE_MISMATCH'); assert.equal(data.drafts[0].draft_status, 'BLOCKED_PRECONDITION');
  const manifestPath = path.join(root, 'source-manifest.json'), manifest = JSON.parse(await fs.readFile(manifestPath));
  manifest.task_id = `native-${randomUUID()}`; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  data = await f.manager.console(f.project.project_id);
  assert.equal(data.drafts[0].source.reason, 'SOURCE_MANIFEST_MISMATCH'); assert.deepEqual(data.records, []); assert.deepEqual(data.scripts, []);
});

test('registration and execution are mutually exclusive; cancellation cannot publish a partial registration', async t => {
  const f = await fixture(t);
  f.manager.active.executePromise = Promise.resolve(); await assert.rejects(f.register(), /EXECUTOR_BUSY/); f.manager.active.executePromise = null;
  const pending = f.register(); await assert.rejects(f.register({ request_id: randomUUID() }), /EXECUTOR_BUSY/); await pending;
  const update = f.manager.update.bind(f.manager);
  f.manager.update = async (...args) => { f.manager.active.controller.abort('cancelled'); return update(...args); };
  await assert.rejects(f.register({ request_id: randomUUID() }), /NOT_AUTHORIZED/);
  assert.equal((await f.manager.get(f.project.project_id, f.task.id)).drafts.length, 1);
  assert.equal(f.manager.active.draftPromise, null);
});

test('registration already accepted can finish while new registrations are closed at model completion', async t => {
  const f = await fixture(t), pending = f.register(); f.manager.active.finishing = true;
  await assert.rejects(f.register({ request_id: randomUUID() }), /NOT_AUTHORIZED/);
  assert.equal((await pending).operation, 'REGISTER_DRAFT');
});

test('late execution rechecks authorization after asynchronous task loading', async t => {
  const f = await fixture(t), get = f.manager.get.bind(f.manager);
  for (const change of [active => { active.finishing = true; }, active => { active.controller.abort('cancelled'); }, () => { f.manager.active = null; }]) {
    f.manager.active = { projectId: f.project.project_id, taskId: f.task.id, controller: new AbortController(), token: 'test-only-token', workspace: f.workspace };
    f.manager.get = async (...args) => { const task = await get(...args); change(f.manager.active); return task; };
    await assert.rejects(f.manager.executeRequest(f.project.project_id, f.task.id, { request_id: randomUUID(), case_id: 'case-one', entry: f.input.entry }, 'Bearer test-only-token'), /EXECUTION_NOT_AUTHORIZED/);
  }
});

test('task outcomes keep model errors, cancellation and timeout ahead of draft status', () => {
  const controller = new AbortController(), active = { controller }, task = { items: [{ case_id: 'one', status: 'NOT_RUN' }], runs: [], drafts: [{ case_id: 'one', draft_status: 'BLOCKED_PRECONDITION' }] };
  assert.equal(nativeTaskOutcome(task, {}, active), 'BLOCKED');
  assert.equal(nativeTaskOutcome(task, { error: 'MODEL_FAILED' }, active), 'FAILED');
  task.drafts.push({ case_id: 'one', draft_status: 'UNEXECUTED' }); assert.equal(nativeTaskOutcome(task, {}, active), 'PARTIAL');
  controller.abort('timeout'); assert.equal(nativeTaskOutcome(task, {}, active), 'TIMED_OUT');
  const cancelled = new AbortController(); cancelled.abort('cancelled'); assert.equal(nativeTaskOutcome(task, {}, { controller: cancelled }), 'CANCELLED');
  assert.equal(nativeTaskOutcome(task, {}, { controller, unconfirmed: true }), 'STOP_UNCONFIRMED');
});

test('only the precise draft route delegates its task bearer without relying on a browser Origin', async () => {
  let called, body;
  await nativeDshRoute({ request: { method: 'POST', headers: { authorization: 'Bearer fixture' } }, response: {},
    url: new URL('http://127.0.0.1/api/case-library/projects/p/native-dsh/tasks/t/drafts'),
    manager: { registerDraft: async (...args) => { called = args; return { operation: 'REGISTER_DRAFT', counts_for_case: false }; } },
    readJsonBody: async () => ({ request_id: 'fixture-request' }), trustedMutation() { assert.fail('task bearer owns this precise route'); },
    sendJson: (_, status, value) => { assert.equal(status, 200); body = value; } });
  assert.deepEqual(called, ['p', 't', { request_id: 'fixture-request' }, 'Bearer fixture']); assert.equal(body.counts_for_case, false);
});

test('DSH helper has explicit non-execution registration and preserves existing execution syntax', async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const source = nativeTaskHelper('http://local.invalid/tasks/t', 'fixture-token').replace("import { readFile } from 'node:fs/promises';", '').replace('import.meta.url', "'file:///fixture/execute.mjs'");
  for (const register of [true, false]) {
    let call, exit;
    const argv = ['node', 'execute.mjs', ...(register ? ['register-draft'] : []), 'TC-024', 'specs/TC-024.spec.mjs', ...(register ? ['--blocked-code', 'MISSING_AUTHORIZED_TEST_DATA', '--reason', '两个园区缺失'] : ['--diagnostic'])];
    await new AsyncFunction('readFile', 'fetch', 'process', 'crypto', 'console', source)(
      async () => JSON.stringify({ cases: [{ case_id: 'case-one', external_id: 'TC-024', case_version: 1, content_sha256: 'a'.repeat(64) }] }),
      async (url, options) => { call = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => register ? { operation: 'REGISTER_DRAFT', execution_status: 'NOT_RUN' } : { status: 'PASSED' } }; },
      { argv, exit: code => { exit = code; } }, { randomUUID: () => 'fixture-request' }, { log() {} });
    assert.equal(exit, 0); assert.equal(call.url, `http://local.invalid/tasks/t/${register ? 'drafts' : 'execute'}`);
    if (register) { assert.equal(call.body.case_id, 'case-one'); assert.equal(call.body.draft_status, 'BLOCKED_PRECONDITION'); assert.equal(call.body.blocker.summary, '两个园区缺失'); }
    else assert.equal(call.body.purpose, 'diagnostic');
  }
});
