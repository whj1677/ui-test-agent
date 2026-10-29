import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { NativeDshManager } from '../server/native-dsh/manager.mjs';
import { snapshotSources, collectArtifacts } from '../server/native-dsh/executor.mjs';
import { nativeTaskHelper } from '../server/native-dsh/drafts.mjs';

// Filesystem-only fixtures: no HTTP listener, browser, real model or business execution.
async function fixture(t, { existing = true, previousRun = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-registration-'));
  const projectId = `project-${randomUUID()}`, oldSession = `session-${randomUUID()}`, newSession = `session-${randomUUID()}`;
  const project = { project_id: projectId, cases: ['one', 'two'].map(id => ({ case_id: id, current_version: 1,
    versions: [{ version: 1, content_sha256: 'A'.repeat(64), content: { external_id: `TC-${id}`, status: 'CONFIRMED', case_type: 'UI', title: id, steps: [{ action: 'fixed action', expected: 'fixed expected' }] } }] })) };
  const selection = { case_id: 'one', case_version: 1, content_sha256: 'A'.repeat(64) }, entry = 'specs/TC-one.spec.mjs';
  const input = { request_id: randomUUID(), kind: 'REGISTER_EXISTING_DRAFT', allow_model: true, allow_execution: false, items: [selection] };
  const calls = []; let finish, control, executionCalls = 0;
  const manager = new NativeDshManager({ root: path.join(root, 'data'), workspaceRoot: path.join(root, 'projects'),
    caseStore: { getProject: async id => id === projectId ? structuredClone(project) : null },
    projectEnvironments: { assert: async () => { throw Error('MUST_NOT_RESOLVE_TARGET'); } },
    buildManager: {}, execute: async () => { executionCalls++; throw Error('MUST_NOT_EXECUTE'); },
    client: { available: true, identity: { model: 'fake-no-network' }, run: async args => {
      calls.push(args); control = args;
      args.signal.addEventListener('abort', () => finish?.({ error: 'CANCELLED' }), { once: true });
      await args.onEvent({ session_id: newSession });
      await args.onEvent({ stage: '原生 dsh 正在编写与自测' });
      return new Promise(resolve => { finish = value => resolve({ session_id: newSession, reply: 'registered', ...value }); });
    }, close: async () => {} },
  });
  await manager.init();
  const source = path.join(manager.workspaceRoot, projectId, 'workspace');
  const script = "import { helper } from '../lib/helpers.mjs';\nthrow Error('BUSINESS_SCRIPT_MUST_NOT_EXECUTE');\n";
  if (existing) {
    await fs.mkdir(path.join(source, 'specs'), { recursive: true }); await fs.mkdir(path.join(source, 'lib'));
    await fs.writeFile(path.join(source, entry), script); await fs.writeFile(path.join(source, 'lib/helpers.mjs'), 'export const helper = 1;\n');
    await fs.writeFile(path.join(source, 'execute.mjs'), 'OLD_HELPER_SECRET');
    await fs.writeFile(path.join(source, 'current-task.json'), JSON.stringify({ cdp_endpoint: 'OLD_CDP', base_url: 'OLD_SUT' }));
  }
  const session = await manager.load(projectId);
  session.session_id = oldSession; session.session_workspace = source; session.session_directory = 'unchanged-main-session-directory';
  if (previousRun) {
    const id = `run-${randomUUID()}`, directory = path.join(manager.directory(projectId), 'runs', id);
    await fs.mkdir(path.join(directory, 'snapshot'), { recursive: true });
    const manifest = await snapshotSources(source, path.join(directory, 'snapshot'), entry);
    await fs.writeFile(path.join(directory, 'source-manifest.json'), JSON.stringify({ ...manifest, entry, purpose: 'case', case_id: 'TC-one' }));
    session.tasks.push({ id: `native-${randomUUID()}`, project_id: projectId, status: 'PARTIAL', created_at: '2026-10-01T00:00:00Z',
      items: [{ ...selection, formal_entry: entry, external_id: 'TC-one', status: 'FAILED' }], runs: [{ id, case_id: 'one', external_id: 'TC-one', entry, purpose: 'case', counts_for_case: true,
        status: 'FAILED', case_version: 1, case_content_sha256: selection.content_sha256, script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256,
        finished_at: '2026-10-01T00:00:01Z', artifacts: await collectArtifacts(directory) }] });
  }
  await manager.save(session);
  t.after(async () => { finish?.({ error: 'TEST_CLEANUP' }); await manager.shutdown(); assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); await fs.rm(root, { recursive: true, force: true }); });
  return { manager, projectId, oldSession, newSession, source, script, entry, input, selection, calls,
    ready: async () => { for (let i = 0; i < 300 && !finish; i++) await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(finish, 'fake model became ready'); return control; },
    finish: async value => { finish(value); await manager.completion; },
    register: task => manager.registerDraft(projectId, task.id, { request_id: randomUUID(), ...selection, entry, draft_status: 'UNEXECUTED' }, `Bearer ${manager.active.token}`),
    executions: () => executionCalls };
}

test('registration-only task avoids target access, isolates source/session, and cannot replace an old FAILED run', async t => {
  const f = await fixture(t, { previousRun: true });
  const before = await f.manager.load(f.projectId), oldTask = JSON.stringify(before.tasks[0]);
  const task = await f.manager.create(f.projectId, f.input), model = await f.ready();
  assert.equal(task.kind, 'REGISTER_EXISTING_DRAFT'); assert.equal(task.allow_execution, false);
  assert.match((await f.manager.get(f.projectId, task.id)).stage, /稿件登记（未运行）/);
  assert.equal(model.sessionId, null); assert.notEqual(model.workspace, f.source); assert.equal(task.environment_id, null); assert.equal(task.preflight, null);
  assert.equal(await fs.readFile(path.join(model.workspace, f.entry), 'utf8'), f.script);
  const current = JSON.parse(await fs.readFile(path.join(model.workspace, 'current-task.json'), 'utf8'));
  assert.equal(current.allow_execution, false); assert.equal(current.kind, task.kind);
  assert.equal(Object.hasOwn(current, 'base_url'), false); assert.equal(Object.hasOwn(current, 'cdp_endpoint'), false);
  assert.doesNotMatch(await fs.readFile(path.join(model.workspace, 'execute.mjs'), 'utf8'), /OLD_HELPER_SECRET/);
  assert.match(model.prompt, /禁止新增或修改业务文件/); assert.doesNotMatch(model.prompt, /OLD_CDP|OLD_SUT/);
  const get = f.manager.get; f.manager.get = () => { throw Error('MUST_DENY_BEFORE_LOADING'); };
  await assert.rejects(f.manager.executeRequest(f.projectId, task.id, { request_id: randomUUID(), case_id: 'one', entry: f.entry }, `Bearer ${f.manager.active.token}`), /EXECUTION_DISABLED/);
  f.manager.get = get;
  const draft = await f.register(task); assert.equal(draft.execution_status, 'NOT_RUN'); assert.equal(draft.counts_for_case, false);
  assert.equal(draft.script_sha256, task.items[0].existing_source.script_sha256);
  await f.finish();
  const after = await f.manager.load(f.projectId), ended = await f.manager.get(f.projectId, task.id), projection = await f.manager.console(f.projectId);
  assert.equal(after.session_id, f.oldSession); assert.equal(after.session_workspace, f.source); assert.equal(after.session_directory, before.session_directory);
  assert.equal(ended.session_id, f.newSession); assert.equal(ended.status, 'COMPLETED'); assert.match(ended.stage, /登记完成.*未运行/);
  assert.equal(ended.items[0].status, 'NOT_RUN'); assert.equal(ended.runs.length, 0); assert.equal(f.executions(), 0);
  assert.equal(JSON.stringify(after.tasks[0]), oldTask); assert.equal(await fs.readFile(path.join(f.source, f.entry), 'utf8'), f.script);
  assert.equal(projection.records.length, 1); assert.equal(projection.records[0].status, 'FAILED'); assert.equal(projection.records[0].is_latest_for_case, true);
  assert.equal(projection.drafts.length, 1); assert.equal(projection.tasks.find(x => x.task_id === task.id).status, 'COMPLETED');
});

test('changed script, dependency or added source cannot be registered as the existing package', async t => {
  const f = await fixture(t), task = await f.manager.create(f.projectId, f.input), model = await f.ready();
  for (const [relative, change] of [[f.entry, '// changed script'], ['lib/helpers.mjs', 'export const helper=2;'], ['extra.mjs', 'export const extra=1;']]) {
    const file = path.join(model.workspace, relative), previous = await fs.readFile(file).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
    await fs.writeFile(file, change); await assert.rejects(f.register(task), /EXISTING_SOURCE_CHANGED/);
    if (previous) await fs.writeFile(file, previous); else await fs.unlink(file);
  }
  assert.equal((await f.manager.get(f.projectId, task.id)).drafts, undefined);
  assert.equal(await fs.readFile(path.join(f.source, f.entry), 'utf8'), f.script); assert.equal(f.executions(), 0);
  await f.finish({ error: 'MODEL_STOPPED' });
});

test('registration mode requires explicit model/no-execution authorization and one existing entry', async t => {
  const f = await fixture(t, { existing: false });
  for (const change of [{ allow_execution: true }, { allow_model: false }, { kind: 'UNKNOWN' }, { items: [f.selection, { ...f.selection, case_id: 'two' }] }]) {
    await assert.rejects(f.manager.create(f.projectId, { ...f.input, ...change }));
  }
  await assert.rejects(f.manager.create(f.projectId, f.input), /ENTRY_NOT_IN_SOURCE_BUNDLE/);
  assert.equal(f.calls.length, 0); assert.equal((await f.manager.load(f.projectId)).tasks.length, 0);
});

test('request identity separates registration from generation and retries never create another model call', async t => {
  const f = await fixture(t), task = await f.manager.create(f.projectId, f.input); await f.ready();
  assert.equal((await f.manager.create(f.projectId, f.input)).id, task.id);
  await assert.rejects(f.manager.create(f.projectId, { ...f.input, kind: 'DSH_GENERATION_SELF_TEST', allow_execution: true, environment_id: 'test-env' }), /REQUEST_CONFLICT/);
  await f.register(task); await f.finish();
  assert.equal((await f.manager.create(f.projectId, f.input)).id, task.id); assert.equal(f.calls.length, 1);
  await assert.rejects(async () => f.manager.registerDraft(f.projectId, task.id, { request_id: randomUUID(), ...f.selection, entry: f.entry, draft_status: 'UNEXECUTED' }, 'Bearer expired'), /NOT_AUTHORIZED/);
});

test('registration-only helper refuses a business or diagnostic execute command before any HTTP call', async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const helper = nativeTaskHelper('http://local.invalid/tasks/task', 'test-only-token', { registrationOnly: true })
    .replace("import { readFile } from 'node:fs/promises';", '').replace('import.meta.url', "'file:///fixture/execute.mjs'");
  let calls = 0;
  for (const extra of [[], ['--diagnostic']]) {
    await assert.rejects(new AsyncFunction('process', 'fetch', helper)({ argv: ['node', 'execute.mjs', 'one', 'specs/TC-one.spec.mjs', ...extra] }, async () => { calls++; }), /EXECUTION_DISABLED/);
  }
  assert.equal(calls, 0);
});
