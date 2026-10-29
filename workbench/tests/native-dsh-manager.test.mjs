import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { NativeDshManager } from '../server/native-dsh/manager.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  for (let count = 0; count < 200; count++) { if (predicate()) return; await pause(5); }
  throw Error('TEST_WAIT_TIMEOUT');
}
const caseRow = (id, type = 'UI', status = 'CONFIRMED') => ({ case_id: id, current_version: 2, versions: [
  { version: 1, content_sha256: 'a'.repeat(64), content: { external_id: `TC-${id}`, case_type: 'UI', status: 'CONFIRMED', title: 'old', steps: [{ order: 1, action: 'old', expected: 'old' }] } },
  { version: 2, content_sha256: 'b'.repeat(64), content: { external_id: `TC-${id}`, case_type: type, status, title: id, steps: [{ order: 1, action: 'fixed action', expected: 'fixed oracle' }] } },
] });
const selection = id => ({ case_id: id, case_version: 2, content_sha256: 'b'.repeat(64) });
const taskInput = (id = 'one', changes = {}) => ({ request_id: `request-${randomUUID()}`, items: [selection(id)], environment_id: 'test-env', allow_model: true, allow_execution: true, timeout_minutes: 30, ...changes });

test('41 cases start once, run 20/20/1 in the same session and preserve a business failure', async t => {
  const f = await fixture(t, { execute: async args => ({ status: args.caseId === 'TC-full-0' ? 'FAILED' : 'PASSED', error: args.caseId === 'TC-full-0' ? 'EXPECTED_BUSINESS_DIFFERENCE' : null, artifacts: [] }) });
  preparationWithoutNetwork(f);
  const ids = Array.from({ length: 41 }, (_, i) => `full-${i}`);
  f.projects.get(f.p1).cases = ids.map(id => caseRow(id));
  const input = taskInput('unused', { items: ids.map(selection) });
  const task = await f.manager.create(f.p1, input);
  for (let batch = 0; batch < 3; batch++) {
    const control = await f.ready(batch + 1);
    const current = JSON.parse(await fs.readFile(path.join(task.workspace, 'current-task.json'), 'utf8'));
    assert.equal(current.batch_number, batch + 1); assert.equal(current.batch_count, 3);
    assert.deepEqual(current.cases.map(item => item.case_id), ids.slice(batch * 20, batch * 20 + 20));
    assert.equal(control.sessionId, batch ? f.sharedSession : null);
    if (!batch) {
      assert.equal((await f.manager.create(f.p1, input)).id, task.id, 'retry is idempotent');
      await assert.rejects(f.manager.executeRequest(f.p1, task.id, { request_id: 'outside-current-batch', case_id: ids[20], entry: 'specs/TC-full-20.spec.mjs' }, f.bearer()), /NOT_IN_BATCH/);
      assert.throws(() => f.manager.registerDraft(f.p1, task.id, { case_id: ids[20] }, f.bearer()), /NOT_IN_BATCH/);
    }
    for (const item of current.cases) await f.manager.executeRequest(f.p1, task.id, { request_id: `run-full-${item.external_id}`, case_id: item.case_id, entry: item.formal_entry }, f.bearer());
    control.finish();
  }
  await f.manager.completion;
  const saved = await f.manager.get(f.p1, task.id);
  assert.equal(saved.status, 'PARTIAL'); assert.equal(saved.items[0].status, 'FAILED');
  assert.equal(saved.runs.length, 41); assert.equal(saved.items.filter(i => i.status === 'PASSED').length, 40);
  assert.deepEqual(saved.batches.map(b => b.case_ids.length), [20, 20, 1]); assert.equal(saved.model_calls, 3);
  assert.equal(f.protectedCount, 0); assert.equal(f.manager.active, null);
});

test('cancellation in batch two stops the entire submission and retains executed results', async t => {
  const f = await fixture(t); preparationWithoutNetwork(f);
  const ids = Array.from({ length: 41 }, (_, i) => `cancel-${i}`);
  f.projects.get(f.p1).cases = ids.map(id => caseRow(id));
  const task = await f.manager.create(f.p1, taskInput('unused', { items: ids.map(selection) }));
  const first = await f.ready(1);
  await f.manager.executeRequest(f.p1, task.id, { request_id: 'before-batch-cancellation', case_id: ids[0], entry: 'specs/TC-cancel-0.spec.mjs' }, f.bearer());
  first.finish(); await f.ready(2); await f.manager.stop(f.p1, task.id); await f.manager.completion;
  const saved = await f.manager.get(f.p1, task.id);
  assert.equal(saved.status, 'CANCELLED'); assert.equal(f.calls.length, 2); assert.equal(saved.items[0].status, 'PASSED');
  assert.equal(saved.items.filter(i => i.status === 'NOT_RUN').length, 40); assert.equal(saved.runs.length, 1); assert.equal(f.protectedCount, 0);
});

test('login, environment and case version are checked again before starting the next batch', async t => {
  for (const mode of ['login', 'environment', 'version']) await t.test(mode, async t => {
    const f = await fixture(t); preparationWithoutNetwork(f);
    const ids = Array.from({ length: 21 }, (_, i) => `drift-${i}`);
    f.projects.get(f.p1).cases = ids.map(id => caseRow(id));
    const task = await f.manager.create(f.p1, taskInput('unused', { items: ids.map(selection) }));
    const first = await f.ready(1);
    if (mode === 'login') f.setAuth('NOT_LOGGED_IN');
    if (mode === 'environment') f.setEnvironmentHash('f'.repeat(64));
    if (mode === 'version') f.projects.get(f.p1).cases[20].current_version = 1;
    first.finish(); await f.manager.completion;
    const saved = await f.manager.get(f.p1, task.id);
    assert.equal(f.calls.length, 1); assert.equal(saved.runs.length, 0); assert.equal(saved.items.every(i => i.status === 'NOT_RUN'), true);
    assert.equal(saved.error, { login: 'NATIVE_DSH_LOGIN_REQUIRED', environment: 'NATIVE_DSH_ENVIRONMENT_CHANGED', version: 'NATIVE_DSH_CASE_CHANGED' }[mode]);
    assert.equal(f.protectedCount, 0);
  });
});

test('diagnostic success never establishes or replaces a case result, and formal entry is server bound', async t => {
  let status = 'PASSED';
  const f = await fixture(t, { execute: (args, saveEvidence) => saveEvidence(args, status) });
  const task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  assert.equal(task.items[0].formal_entry, 'specs/TC-one.spec.mjs');
  const invoke = (entry, purpose) => f.manager.executeRequest(f.p1, task.id, { request_id: randomUUID(), case_id: 'one', entry, ...(purpose ? { purpose } : {}) }, f.bearer());
  for (const entry of ['_diag.spec.mjs', 'specs/TC-two.spec.mjs', '../specs/TC-one.spec.mjs', 'C:/specs/TC-one.spec.mjs']) await assert.rejects(invoke(entry), /ENTRY/);
  await assert.rejects(invoke('specs/TC-one.spec.mjs', 'unknown'), /PURPOSE_INVALID/);
  assert.equal(f.executions.length, 0);
  const diagnostic = await invoke('_diag.spec.mjs', 'diagnostic');
  assert.equal(diagnostic.counts_for_case, false);
  assert.equal((await f.manager.get(f.p1, task.id)).items[0].status, 'NOT_RUN');
  status = 'FAILED'; await invoke('./specs/other/../TC-one.spec.mjs');
  status = 'PASSED'; await invoke('_diag2.spec.mjs', 'diagnostic');
  assert.equal((await f.manager.get(f.p1, task.id)).items[0].status, 'FAILED');
  await invoke('specs\\TC-one.spec.mjs');
  for (status of ['FAILED', 'CANCELLED']) await invoke('_diag3.spec.mjs', 'diagnostic');
  const current = await f.manager.get(f.p1, task.id);
  assert.equal(current.items[0].status, 'PASSED'); assert.equal(current.runs.length, 6);
  assert.equal(current.runs.filter(run => run.counts_for_case).length, 2);
  control.finish(); await f.manager.completion;
  assert.equal((await f.manager.get(f.p1, task.id)).status, 'COMPLETED');
});

test('diagnostic-only batch is incomplete and revision notes are frozen in the continuing task', async t => {
  const f = await fixture(t), revision_notes = '  补齐既定用例原数据，不弱化断言  ';
  await assert.rejects(f.manager.create(f.p1, taskInput('one', { revision_notes: 123 })), /NOTES_INVALID/);
  await assert.rejects(f.manager.create(f.p1, taskInput('one', { revision_notes: 'x'.repeat(8001) })), /NOTES_INVALID/);
  const task = await f.manager.create(f.p1, taskInput('one', { revision_notes })), control = await f.ready(1);
  assert.equal(task.revision_notes, revision_notes.trim()); assert.ok(control.prompt.includes(revision_notes.trim()));
  const frozen = JSON.parse(await fs.readFile(path.join(control.workspace, 'current-task.json'), 'utf8'));
  assert.equal(frozen.revision_notes, task.revision_notes); assert.equal(frozen.cases[0].formal_entry, task.items[0].formal_entry);
  assert.match(await fs.readFile(path.join(control.workspace, 'execute.mjs'), 'utf8'), /--diagnostic/);
  await f.manager.executeRequest(f.p1, task.id, { request_id: randomUUID(), case_id: 'one', entry: '_diag.spec.mjs', purpose: 'diagnostic' }, f.bearer());
  control.finish(); await f.manager.completion;
  const finished = await f.manager.get(f.p1, task.id);
  assert.equal(finished.status, 'PARTIAL'); assert.equal(finished.items[0].status, 'NOT_RUN');
});

test('legacy manifest classification excludes diagnostics and unknown records without rewriting history', async t => {
  const f = await fixture(t), taskId = `native-${randomUUID()}`, sha = 'c'.repeat(64);
  const makeRun = (status, extra = {}) => ({ id: `run-${randomUUID()}`, case_id: 'one', external_id: 'TC-one', status, script_sha256: sha, ...extra });
  const formal = makeRun('FAILED'), diag = makeRun('PASSED'), unknown = makeRun('PASSED');
  const value = { ...(await f.manager.load(f.p1)), tasks: [{ id: taskId, status: 'COMPLETED', items: [{ case_id: 'one', external_id: 'TC-one', status: 'PASSED' }], runs: [formal, diag, unknown] }] };
  await f.manager.save(value);
  for (const [run, entry] of [[formal, 'specs/TC-one.spec.mjs'], [diag, 'specs/_diag-009.spec.mjs']]) {
    const directory = path.join(f.root, f.p1, 'runs', run.id); await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'source-manifest.json'), JSON.stringify({ case_id: 'TC-one', entry, script_sha256: sha, files: [{ path: entry, sha256: sha }] }));
  }
  const before = await fs.readFile(path.join(f.root, f.p1, 'session.json'), 'utf8');
  const task = await f.manager.get(f.p1, taskId);
  assert.deepEqual(task.runs.map(run => run.purpose), ['case', 'diagnostic', 'unclassified']);
  assert.equal(task.items[0].status, 'FAILED'); assert.equal(task.items[0].recorded_status, 'PASSED');
  assert.equal(task.status, 'PARTIAL'); assert.equal(task.recorded_status, 'COMPLETED');
  assert.equal((await f.manager.describe(f.p1)).tasks[0].items[0].status, 'FAILED');
  assert.equal(await fs.readFile(path.join(f.root, f.p1, 'session.json'), 'utf8'), before);
  value.tasks[0].runs = [diag, unknown]; await f.manager.save(value);
  assert.equal((await f.manager.get(f.p1, taskId)).items[0].status, 'NOT_RUN');
  assert.equal((await f.manager.get(f.p1, taskId)).status, 'FAILED');
  const manifestPath = path.join(f.root, f.p1, 'runs', formal.id, 'source-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  await fs.writeFile(manifestPath, JSON.stringify({ ...manifest, purpose: 'diagnostic' }));
  value.tasks[0].runs = [{ ...formal, status: 'PASSED' }]; await f.manager.save(value);
  assert.equal((await f.manager.get(f.p1, taskId)).runs[0].purpose, 'diagnostic');
  assert.equal((await f.manager.get(f.p1, taskId)).items[0].status, 'NOT_RUN');
});

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-dsh-manager-'));
  const p1 = `project-${randomUUID()}`, p2 = `project-${randomUUID()}`;
  const projects = new Map([p1, p2].map(project_id => [project_id, { project_id, cases: [caseRow('one'), caseRow('two'), caseRow('backend', 'BACKEND'), caseRow('pending', 'UI', 'PENDING_CONFIRMATION'), caseRow('unknown', 'UNCLASSIFIED')] }]));
  const calls = [], executions = [], authCalls = [], controls = [], sharedSession = `session-${randomUUID()}`;
  const client = { available: true, identity: { model: 'fake-no-network', profile: 'unit-test' }, closed: false,
    run: async args => {
      calls.push(args); let finish;
      const completion = new Promise(resolve => { finish = resolve; });
      const onAbort = () => finish({ session_id: sharedSession, reply: 'cancelled', error: 'CANCELLED' });
      args.signal.addEventListener('abort', onAbort, { once: true });
      if (args.signal.aborted) onAbort();
      await args.onEvent({ session_id: sharedSession });
      controls.push({ ...args, finish: result => finish({ session_id: sharedSession, reply: 'finished', ...result }) });
      try { return await completion; } finally { args.signal.removeEventListener('abort', onAbort); }
    },
    close: async () => { client.closed = true; },
  };
  let authStatus = 'VALID', protectedCount = 0, externalBusy = false, environmentHash = 'd'.repeat(64);
  const auth = {
    check: async scope => { authCalls.push(['check', scope]); return { status: authStatus, session_version: 'auth-v1' }; },
    beginTaskProtection: (scope, version) => { authCalls.push(['protect', scope, version]); protectedCount++; return () => { protectedCount--; authCalls.push(['release']); }; },
    attachEndpoint: async (scope, version) => { authCalls.push(['cdp', scope, version]); return 'ws://127.0.0.1:1/devtools/browser/test-only'; },
    stateForExecution: async (scope, version) => { authCalls.push(['state', scope, version]); return { cookies: [], origins: [] }; },
  };
  const saveEvidence = async (args, status = 'PASSED', error = null) => {
    await fs.mkdir(args.runDirectory, { recursive: true });
    const body = Buffer.from(`test-only evidence ${args.caseId} ${status}`), name = 'test-evidence.png';
    await fs.writeFile(path.join(args.runDirectory, name), body);
    return { status, error, artifacts: [{ id: `artifact-${randomUUID()}`, name, relative_path: name, kind: 'screenshot', mime_type: 'image/png', bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }] };
  };
  const manager = new NativeDshManager({ root, client,
    caseStore: { getProject: async id => structuredClone(projects.get(id) || null) },
    projectEnvironments: { assert: async (id, kind, environment) => { assert.ok(projects.has(id)); assert.equal(kind, 'ui'); if (environment !== 'test-env') throw Error('PROJECT_ENVIRONMENT_MISMATCH'); return { ui_identity: { environment_id: environment, configuration_sha256: environmentHash } }; } },
    buildManager: { developmentEnvironments: [{ id: 'test-env', normal_url: 'http://sut.invalid/', auth_requirement: { environment_id: 'test-env', role: 'tester' } }], authSessions: auth, browserExecutable: 'not-used.exe' },
    otherActive: () => externalBusy,
    execute: async args => { executions.push(args); return options.execute ? options.execute(args, saveEvidence) : saveEvidence(args); },
  });
  await manager.init();
  t.after(async () => {
    await manager.shutdown();
    const resolved = path.resolve(root), parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), parent); assert.match(path.basename(resolved), /^native-dsh-manager-/);
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return { manager, client, root, p1, p2, projects, calls, executions, controls, sharedSession, authCalls, saveEvidence,
    get protectedCount() { return protectedCount; },
    setAuth: status => { authStatus = status; }, setExternalBusy: value => { externalBusy = value; }, setEnvironmentHash: value => { environmentHash = value; },
    ready: async n => { await until(() => controls.length >= n); return controls[n - 1]; },
    bearer: () => `Bearer ${manager.active.token}`,
  };
}

function preparationWithoutNetwork(f) {
  f.manager.buildManager.developmentEnvironments[0].normal_url = undefined;
  f.manager.browserType = { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [{ url: () => 'about:blank' }] }], close: async () => {} }) };
}

test('an authorized model task can finish with a blocked registered draft and no execution', async t => {
  const f = await fixture(t); preparationWithoutNetwork(f);
  const task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  await fs.mkdir(path.join(control.workspace, 'specs'), { recursive: true });
  await fs.writeFile(path.join(control.workspace, 'specs/TC-one.spec.mjs'), "throw Error('MUST_NOT_EXECUTE');\n");
  assert.match(control.prompt, /register-draft/);
  await f.manager.registerDraft(f.p1, task.id, { request_id: randomUUID(), ...selection('one'), entry: 'specs/TC-one.spec.mjs',
    draft_status: 'BLOCKED_PRECONDITION', blocker: { code: 'MISSING_AUTHORIZED_TEST_DATA', summary: '缺少授权园区' } }, f.bearer());
  control.finish(); await f.manager.completion;
  const finished = await f.manager.get(f.p1, task.id);
  assert.equal(finished.status, 'BLOCKED'); assert.equal(finished.error, null); assert.equal(finished.runs.length, 0);
  assert.equal(finished.drafts.length, 1); assert.equal(finished.items[0].status, 'NOT_RUN'); assert.equal(f.executions.length, 0);
  assert.equal((await f.manager.console(f.p1)).tasks[0].items[0].draft_status, 'BLOCKED_PRECONDITION');
});

test('shutdown closes the native client after completion rejection and still reports the failure', async () => {
  const failure = Error('EXPECTED_COMPLETION_FAILURE'); let closes = 0;
  const manager = new NativeDshManager({ client: { close: async () => { closes++; } } });
  manager.completion = Promise.reject(failure);
  await assert.rejects(manager.shutdown(), error => error === failure);
  assert.equal(manager.shutdownRequested, true); assert.equal(closes, 1);
});

test('shutdown still reports a native client close failure', async () => {
  const failure = Error('EXPECTED_CLOSE_FAILURE');
  const manager = new NativeDshManager({ client: { close: async () => { throw failure; } } });
  manager.completion = Promise.resolve();
  await assert.rejects(manager.shutdown(), error => error === failure);
});

test('session IO serializes readers and writers per project without recursively taking the business queue', async t => {
  const f = await fixture(t);
  let release, entered = false, secondEntered = false;
  const hold = f.manager.sessionIo(f.p1, async () => { entered = true; await new Promise(resolve => { release = resolve; }); });
  await until(() => entered);
  const sameProject = f.manager.load(f.p1).then(() => { secondEntered = true; });
  const otherProject = await f.manager.load(f.p2);
  assert.equal(otherProject.project_id, f.p2); assert.equal(secondEntered, false);
  release(); await Promise.all([hold,sameProject]); assert.equal(secondEntered,true);
  await assert.rejects(f.manager.sessionIo(f.p1,()=>{throw Error('EXPECTED_IO_FAILURE');}),/EXPECTED_IO_FAILURE/);
  const taskId=`native-${randomUUID()}`;
  await f.manager.save({schema:'workbench/native-dsh-v1',project_id:f.p1,session_id:null,tasks:[{id:taskId,status:'FAILED',items:[],runs:[],counter:0}]});
  // Mixed public load/update calls must finish, including update's nested load/save.
  await Promise.all(Array.from({length:8},()=>f.manager.load(f.p1)).concat(Array.from({length:20},()=>
    f.manager.update(f.p1,taskId,task=>{task.counter++;}))));
  assert.equal((await f.manager.load(f.p1)).tasks[0].counter,20);
});

test('preparation save failure and first terminal save failure recover one consistent failed outcome with safe diagnostics', async t => {
  const f = await fixture(t); preparationWithoutNetwork(f);
  const originalSave = f.manager.save.bind(f.manager); let stageFailed = false, terminalFailed = false;
  f.manager.save = async value => {
    const task = value.tasks.at(-1);
    if (task?.stage === '原生 dsh 正在编写与自测' && !stageFailed) {
      stageFailed = true; throw Object.assign(Error('rename denied Bearer do-not-store-secret ws://private/endpoint?token=do-not-store-secret'), { code: 'EACCES', syscall: 'rename' });
    }
    if (task?.status === 'FAILED' && task.finished_at && !terminalFailed) {
      terminalFailed = true; throw Object.assign(Error('second private failure'), { code: 'EBUSY', syscall: 'rename' });
    }
    return originalSave(value);
  };
  const task = await f.manager.create(f.p1, taskInput()); await f.manager.completion;
  const saved = await f.manager.get(f.p1, task.id);
  assert.equal(saved.status, 'FAILED'); assert.ok(saved.finished_at); assert.equal(saved.error, 'NATIVE_DSH_TASK_FAILED');
  assert.equal(f.calls.length, 0); assert.equal(f.manager.active, null); assert.equal(f.protectedCount, 0);
  assert.deepEqual(saved.diagnostics.map(d => [d.phase,d.update_phase,d.code]), [
    ['SAVE_MODEL_STAGE','SAVE','EACCES'], ['SAVE_TERMINAL_STATE','SAVE','EBUSY']]);
  const log = await fs.readFile(path.join(f.root,f.p1,'task-diagnostics.ndjson'),'utf8');
  assert.doesNotMatch(log, /do-not-store-secret|private\/endpoint|second private failure|Bearer/);
  assert.equal(f.manager.diagnostics().last_diagnostic.code, 'EBUSY');
});

test('persistent terminal save failure retains execution lock and authentication protection', async t => {
  const f = await fixture(t); preparationWithoutNetwork(f);
  const originalSave = f.manager.save.bind(f.manager); let finalAttempts = 0;
  f.manager.save = async value => {
    const task = value.tasks.at(-1);
    if (task?.stage === '原生 dsh 正在编写与自测' || task?.finished_at) {
      if (task.finished_at) finalAttempts++;
      throw Object.assign(Error('sensitive storage failure'), { code: 'EPERM', syscall: 'rename' });
    }
    return originalSave(value);
  };
  const task = await f.manager.create(f.p1,taskInput()); await f.manager.completion;
  const saved = await f.manager.load(f.p1);
  assert.equal(saved.tasks.find(t=>t.id===task.id).finished_at,undefined);
  assert.equal(f.manager.active.taskId,task.id); assert.equal(f.manager.active.unconfirmed,true);
  assert.equal(f.manager.storageFault,true); assert.equal(f.protectedCount,1); assert.equal(finalAttempts,3);
  assert.equal(f.calls.length,0); assert.equal(f.manager.diagnostics().state_unconfirmed,true);
  // Release the test-only retained lock after validating it; no production repair.
  f.manager.save = originalSave; f.manager.active.release(); f.manager.active = null; f.manager.storageFault = false;
});

test('successful generated task keeps completed verdict and completion timestamp without diagnostics', async t => {
  const f = await fixture(t); preparationWithoutNetwork(f);
  const task = await f.manager.create(f.p1,taskInput()), control = await f.ready(1);
  await f.manager.executeRequest(f.p1,task.id,{request_id:randomUUID(),case_id:'one',entry:'specs/TC-one.spec.mjs'},f.bearer());
  control.finish(); await f.manager.completion;
  const saved = await f.manager.get(f.p1,task.id);
  assert.equal(saved.status,'COMPLETED'); assert.equal(saved.error,null); assert.ok(saved.finished_at);
  assert.equal(saved.diagnostics,undefined); assert.equal(f.manager.active,null); assert.equal(f.protectedCount,0);
});

test('open existing project session is read-only and never creates tasks or executes tests', async t => {
  const f = await fixture(t), opened = [];
  await f.manager.save({ ...(await f.manager.load(f.p1)), session_id: f.sharedSession });
  f.client.openBrowserSession = async value => { opened.push(value); return { session_id: value.sessionId, url: 'http://127.0.0.1:3080/?token=fixture#workbench-session=existing' }; };
  const before = await fs.readFile(path.join(f.root, f.p1, 'session.json'), 'utf8');
  assert.equal((await f.manager.describe(f.p1)).can_open_session, true);
  const target = await f.manager.openSession(f.p1);
  assert.equal(target.session_id, f.sharedSession);
  assert.deepEqual(opened, [{ sessionId: f.sharedSession }]);
  assert.equal(await fs.readFile(path.join(f.root, f.p1, 'session.json'), 'utf8'), before);
  assert.equal(f.calls.length, 0); assert.equal(f.executions.length, 0); assert.equal(f.authCalls.length, 0);
  await assert.rejects(f.manager.openSession(f.p2), /NO_PROJECT_SESSION/);
  assert.equal(opened.length, 1);
  f.manager.accepting = () => false;
  await assert.rejects(f.manager.openSession(f.p1), /WORKBENCH_UNAVAILABLE/);
  assert.equal(opened.length, 1);
});

test('open session never falls back when browser access is unavailable', async t => {
  const f = await fixture(t);
  await f.manager.save({ ...(await f.manager.load(f.p1)), session_id: f.sharedSession });
  await assert.rejects(f.manager.openSession(f.p1), /BROWSER_UNAVAILABLE/);
  assert.equal(f.calls.length, 0); assert.equal(f.executions.length, 0);
});

test('two explicit project batches continue one session and workspace, preserving original case content and evidence', async t => {
  const f = await fixture(t), original = JSON.stringify(f.projects.get(f.p1));
  const first = await f.manager.create(f.p1, taskInput('one')), one = await f.ready(1);
  assert.equal(one.sessionId, null); assert.equal(f.protectedCount, 1);
  await fs.writeFile(path.join(one.workspace, 'page-facts.md'), 'verified shared facts');
  await fs.writeFile(path.join(one.workspace, 'lib.mjs'), 'export const shared = true;');
  const frozen = JSON.parse(await fs.readFile(path.join(one.workspace, 'current-task.json'), 'utf8'));
  assert.equal(frozen.cases[0].case_version, 2); assert.equal(frozen.cases[0].content.steps[0].expected, 'fixed oracle');
  assert.equal(frozen.cases[0].content_sha256, 'b'.repeat(64)); assert.equal('cookies' in frozen, false);
  const run1 = await f.manager.executeRequest(f.p1, first.id, { request_id: 'execution-one', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, f.bearer());
  one.finish(); await f.manager.completion;
  assert.equal((await f.manager.get(f.p1, first.id)).status, 'COMPLETED'); assert.equal(f.protectedCount, 0);
  assert.equal(f.calls.length, 1, 'finishing batch one must not start batch two');
  const second = await f.manager.create(f.p1, taskInput('two')), two = await f.ready(2);
  assert.equal(two.sessionId, f.sharedSession); assert.equal(two.workspace, one.workspace);
  assert.equal(await fs.readFile(path.join(two.workspace, 'page-facts.md'), 'utf8'), 'verified shared facts');
  assert.equal(await fs.readFile(path.join(two.workspace, 'lib.mjs'), 'utf8'), 'export const shared = true;');
  const run2 = await f.manager.executeRequest(f.p1, second.id, { request_id: 'execution-two', case_id: 'two', entry: 'specs/TC-two.spec.mjs' }, f.bearer());
  two.finish(); await f.manager.completion;
  const state = await f.manager.describe(f.p1);
  assert.equal(state.session_id, f.sharedSession); assert.deepEqual(state.tasks.map(item => item.status), ['COMPLETED', 'COMPLETED']);
  assert.notEqual(run1.id, run2.id); assert.notEqual(f.executions[0].runDirectory, f.executions[1].runDirectory);
  assert.equal(JSON.stringify(f.projects.get(f.p1)), original);
  assert.match(await fs.readFile(path.join(two.workspace, 'execute.mjs'), 'utf8'), /NO_ACTIVE_TASK/);
  assert.equal(f.authCalls.filter(call => call[0] === 'state').length, 2);
});

test('input guards require exact current confirmed UI version and hash before any model task', async t => {
  const f = await fixture(t);
  const rejected = [
    [taskInput('one', { allow_model: false }), /NOT_AUTHORIZED/],
    [taskInput('one', { allow_execution: false }), /NOT_AUTHORIZED/],
    [taskInput('backend'), /CONFIRMED_UI_REQUIRED/], [taskInput('pending'), /CONFIRMED_UI_REQUIRED/], [taskInput('unknown'), /CONFIRMED_UI_REQUIRED/],
    [taskInput('missing'), /CASE_CHANGED/],
    [taskInput('one', { items: [{ ...selection('one'), case_version: 1 }] }), /CASE_CHANGED/],
    [taskInput('one', { items: [{ ...selection('one'), content_sha256: 'a'.repeat(64) }] }), /CASE_CHANGED/],
    [taskInput('one', { items: [selection('one'), selection('one')] }), /CASES_INVALID/],
    [taskInput('one', { environment_id: 'another-env' }), /ENVIRONMENT_MISMATCH/],
  ];
  for (const [input, expected] of rejected) await assert.rejects(f.manager.create(f.p1, input), expected);
  assert.equal(f.calls.length, 0); assert.equal(f.executions.length, 0); assert.deepEqual((await f.manager.describe(f.p1)).tasks, []);
});

test('request retries are idempotent while running and after completion, different content conflicts', async t => {
  const f = await fixture(t), input = taskInput();
  const [a, b] = await Promise.all([f.manager.create(f.p1, input), f.manager.create(f.p1, structuredClone(input))]);
  assert.equal(a.id, b.id); const control = await f.ready(1);
  await assert.rejects(f.manager.create(f.p1, { ...input, timeout_minutes: 31 }), /REQUEST_CONFLICT/);
  assert.equal(f.calls.length, 1); control.finish(); await f.manager.completion;
  assert.equal((await f.manager.create(f.p1, input)).id, a.id); assert.equal(f.calls.length, 1);
  assert.equal((await f.manager.describe(f.p1)).tasks.length, 1);
});

test('execution requests enforce project/task/bearer and preserve one result per request', async t => {
  const f = await fixture(t), task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  const request = { request_id: 'execution-unique', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, bearer = f.bearer();
  for (const [projectId, taskId, authorization] of [[f.p2, task.id, bearer], [f.p1, `native-${randomUUID()}`, bearer], [f.p1, task.id, 'Bearer wrong'], [f.p1, task.id, undefined]])
    await assert.rejects(f.manager.executeRequest(projectId, taskId, request, authorization), /NOT_AUTHORIZED/);
  await assert.rejects(f.manager.executeRequest(f.p1, task.id, { ...request, case_id: 'two' }, bearer), /CASE_NOT_IN_TASK/);
  assert.equal(f.executions.length, 0);
  const first = await f.manager.executeRequest(f.p1, task.id, request, bearer);
  const again = await f.manager.executeRequest(f.p1, task.id, structuredClone(request), bearer);
  assert.equal(first.id, again.id); assert.equal(f.executions.length, 1);
  await assert.rejects(f.manager.executeRequest(f.p1, task.id, { ...request, entry: 'different.spec.mjs' }, bearer), /REQUEST_CONFLICT/);
  control.finish(); await f.manager.completion;
  await assert.rejects(f.manager.executeRequest(f.p1, task.id, request, bearer), /NOT_AUTHORIZED/);
  const artifact = await f.manager.artifact(f.p1, task.id, first.artifacts[0].id);
  assert.equal(artifact.media.content_type, 'image/png'); assert.equal(artifact.media.file_name, 'test-evidence.png');
  assert.ok((await fs.stat(path.join(artifact.root, artifact.media.relative_path))).isFile());
  await assert.rejects(f.manager.artifact(f.p2, task.id, first.artifacts[0].id), /TASK_NOT_FOUND/);
});

test('cancelling active execution aborts work, keeps failure evidence and shared files, and releases auth protection', async t => {
  const f = await fixture(t, { execute: async (args, saveEvidence) => {
    await new Promise(resolve => { if (args.signal.aborted) resolve(); else args.signal.addEventListener('abort', resolve, { once: true }); });
    return saveEvidence(args, 'CANCELLED', 'CANCELLED_BY_USER');
  } });
  const task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1), bearer = f.bearer();
  await fs.writeFile(path.join(control.workspace, 'lib.mjs'), 'preserved shared script');
  const runPromise = f.manager.executeRequest(f.p1, task.id, { request_id: 'execution-cancel', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, bearer);
  await until(() => f.executions.length === 1);
  await f.manager.stop(f.p1, task.id);
  const run = await runPromise; await f.manager.completion;
  const saved = await f.manager.get(f.p1, task.id);
  assert.equal(saved.status, 'CANCELLED'); assert.equal(run.status, 'CANCELLED'); assert.equal(saved.runs.length, 1);
  assert.equal(saved.runs[0].error, 'CANCELLED_BY_USER'); assert.equal(saved.items[0].status, 'CANCELLED');
  assert.equal(await fs.readFile(path.join(control.workspace, 'lib.mjs'), 'utf8'), 'preserved shared script');
  assert.ok(await f.manager.artifact(f.p1, task.id, run.artifacts[0].id));
  assert.equal(f.protectedCount, 0); assert.equal(f.calls.length, 1); assert.equal(f.manager.active, null);
  await f.manager.stop(f.p1, task.id); assert.equal(f.calls.length, 1);
});

test('concurrent execution attempts share a single executor and an eventual identical retry reads its saved result', async t => {
  let finishExecution;
  const gate = new Promise(resolve => { finishExecution = resolve; });
  const f = await fixture(t, { execute: async (args, saveEvidence) => { await gate; return saveEvidence(args); } });
  const task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1), bearer = f.bearer();
  const input = { request_id: 'execution-concurrent', case_id: 'one', entry: 'specs/TC-one.spec.mjs' };
  const running = f.manager.executeRequest(f.p1, task.id, input, bearer);
  await until(() => f.executions.length === 1);
  try {
    await assert.rejects(f.manager.executeRequest(f.p1, task.id, structuredClone(input), bearer), /EXECUTOR_BUSY/);
    await assert.rejects(f.manager.executeRequest(f.p1, task.id, { ...input, request_id: 'execution-another' }, bearer), /EXECUTOR_BUSY/);
    assert.equal(f.executions.length, 1);
  } finally { finishExecution(); }
  const result = await running;
  const repeated = await f.manager.executeRequest(f.p1, task.id, input, bearer);
  assert.equal(repeated.id, result.id); assert.equal(f.executions.length, 1);
  control.finish(); await f.manager.completion;
});

test('cross-project and other manager activity block starts without sharing project session or task ownership', async t => {
  const f = await fixture(t), task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  await assert.rejects(f.manager.create(f.p2, taskInput()), /NATIVE_DSH_BUSY/);
  const other = await f.manager.describe(f.p2);
  assert.equal(other.active_task_id, null); assert.equal(other.runtime_busy, true); assert.equal(other.session_id, null); assert.deepEqual(other.tasks, []);
  await assert.rejects(f.manager.stop(f.p2, task.id), /TASK_NOT_FOUND/); assert.equal(control.signal.aborted, false);
  control.finish(); await f.manager.completion;
  f.setExternalBusy(true); await assert.rejects(f.manager.create(f.p2, taskInput()), /NATIVE_DSH_BUSY/);
  assert.equal(f.calls.length, 1);
});

test('startup recovery preserves session/files/history and marks unfinished tasks interrupted without replay', async t => {
  const f = await fixture(t);
  const unfinished = { id: `native-${randomUUID()}`, status: 'RUNNING', items: [{ case_id: 'one', status: 'RUNNING' }, { case_id: 'two', status: 'NOT_RUN' }], runs: [{ id: `run-${randomUUID()}`, status: 'FAILED', artifacts: [] }] };
  const ended = { id: `native-${randomUUID()}`, status: 'CANCELLED', items: [{ case_id: 'one', status: 'NOT_RUN' }], runs: [] };
  await f.manager.save({ schema: 'workbench/native-dsh-v1', project_id: f.p1, session_id: 'session-preserved', tasks: [unfinished, ended] });
  const workspace = path.join(f.manager.directory(f.p1), 'workspace'); await fs.mkdir(workspace, { recursive: true }); await fs.writeFile(path.join(workspace, 'page-facts.md'), 'preserved');
  await f.manager.init();
  const state = await f.manager.describe(f.p1);
  assert.equal(state.session_id, 'session-preserved'); assert.equal(state.tasks[0].status, 'INTERRUPTED'); assert.ok(state.tasks[0].finished_at);
  assert.deepEqual(state.tasks[0].items.map(item => item.status), ['INTERRUPTED', 'NOT_RUN']); assert.deepEqual((await f.manager.load(f.p1)).tasks[0].runs, unfinished.runs); assert.equal(state.tasks[0].runs[0].purpose, 'unclassified');
  assert.deepEqual(state.tasks[1], ended); assert.equal(await fs.readFile(path.join(workspace, 'page-facts.md'), 'utf8'), 'preserved');
  assert.equal(f.calls.length, 0); assert.equal(f.executions.length, 0); assert.equal(f.manager.active, null);
});

test('invalid login blocks before model, execution and auth lease acquisition', async t => {
  const f = await fixture(t); f.setAuth('NOT_LOGGED_IN');
  await assert.rejects(f.manager.create(f.p1, taskInput()), /NATIVE_DSH_LOGIN_REQUIRED/);
  assert.equal(f.calls.length, 0); assert.equal(f.executions.length, 0); assert.equal(f.protectedCount, 0);
  assert.equal((await f.manager.load(f.p1)).tasks.length, 0, 'no empty failed model task is created');
});

test('execution refuses a newly valid environment identity that differs from the task frozen hash', async t => {
  const f = await fixture(t), task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  f.setEnvironmentHash('e'.repeat(64));
  const result = await f.manager.executeRequest(f.p1, task.id, { request_id: 'execution-changed-environment', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, f.bearer());
  assert.equal(result.status, 'ERROR'); assert.equal(result.error, 'NATIVE_DSH_ENVIRONMENT_CHANGED'); assert.equal(f.executions.length, 0);
  assert.equal((await f.manager.get(f.p1, task.id)).runs[0].id, result.id);
  control.finish(); await f.manager.completion;
  assert.equal((await f.manager.get(f.p1, task.id)).status, 'PARTIAL');
});

test('same relative artifact name in successive self-tests resolves the correct run rather than older evidence', async t => {
  let count = 0;
  const f = await fixture(t, { execute: async (args, saveEvidence) => {
    const result = await saveEvidence(args, count++ === 0 ? 'FAILED' : 'PASSED');
    result.artifacts[0].id = 'same-relative-path-hash'; return result;
  } });
  const task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  const run1 = await f.manager.executeRequest(f.p1, task.id, { request_id: 'execution-original', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, f.bearer());
  const run2 = await f.manager.executeRequest(f.p1, task.id, { request_id: 'execution-repair', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, f.bearer());
  assert.notEqual(run1.artifacts[0].id, run2.artifacts[0].id, 'public artifact identity must include its run');
  const a = await f.manager.artifact(f.p1, task.id, run1.artifacts[0].id), b = await f.manager.artifact(f.p1, task.id, run2.artifacts[0].id);
  assert.notEqual(a.root, b.root); assert.match(await fs.readFile(path.join(a.root, a.media.relative_path), 'utf8'), /FAILED/);
  assert.match(await fs.readFile(path.join(b.root, b.media.relative_path), 'utf8'), /PASSED/);
  control.finish(); await f.manager.completion;
});

test('unconfirmed process cancellation retains executor and auth ownership and cannot recover into a fresh start', async t => {
  const f = await fixture(t);
  f.client.run = async args => {
    f.calls.push(args); await args.onEvent({ session_id: f.sharedSession });
    await new Promise(resolve => { if (args.signal.aborted) resolve(); else args.signal.addEventListener('abort', resolve, { once: true }); });
    return { session_id: f.sharedSession, error: 'NATIVE_DSH_CANCEL_NOT_CONFIRMED' };
  };
  const task = await f.manager.create(f.p1, taskInput()); await until(() => f.calls.length === 1);
  const bearer = f.bearer(); await f.manager.stop(f.p1, task.id); await f.manager.completion;
  const saved = await f.manager.get(f.p1, task.id);
  assert.equal(saved.status, 'STOP_UNCONFIRMED'); assert.equal(saved.finished_at, undefined); assert.equal(f.manager.storageFault, true);
  assert.equal(f.manager.active.taskId, task.id); assert.equal(f.protectedCount, 1);
  await assert.rejects(f.manager.create(f.p2, taskInput()), /SERVICE_STOPPING|BUSY/);
  await assert.rejects(f.manager.executeRequest(f.p1, task.id, { request_id: 'execution-after-unconfirmed', case_id: 'one', entry: 'specs/TC-one.spec.mjs' }, bearer), /NOT_AUTHORIZED/);
  await f.manager.init();
  assert.equal((await f.manager.get(f.p1, task.id)).status, 'STOP_UNCONFIRMED'); assert.equal(f.calls.length, 1);
});

test('workspace relocation starts a new session, archives the old session identity and preserves old tasks and files', async t => {
  const f = await fixture(t);
  const oldWorkspace = path.join(f.manager.directory(f.p1), 'workspace'), oldSession = `session-${randomUUID()}`;
  await fs.mkdir(oldWorkspace, { recursive: true });
  await fs.writeFile(path.join(oldWorkspace, 'lib.mjs'), 'export const original = true;');
  await fs.writeFile(path.join(oldWorkspace, 'page-facts.md'), 'original verified facts');
  const oldTask = { id: `native-${randomUUID()}`, project_id: f.p1, status: 'COMPLETED', session_id: oldSession, workspace: oldWorkspace,
    created_at: '2026-10-14T00:00:00.000Z', finished_at: '2026-10-14T00:01:00.000Z', items: [{ ...selection('one'), status: 'PASSED' }],
    runs: [{ id: `run-${randomUUID()}`, status: 'PASSED', artifacts: [] }] };
  // Older sessions did not persist session_workspace; recovery must use the
  // former data-root location rather than silently resume in a new directory.
  await f.manager.save({ schema: 'workbench/native-dsh-v1', project_id: f.p1, session_id: oldSession, tasks: [oldTask] });
  const newRoot = path.join(f.root, 'user-local-workspaces'); f.manager.workspaceRoot = newRoot;
  const first = await f.manager.create(f.p1, taskInput('one')), one = await f.ready(1);
  assert.equal(first.session_id, null); assert.equal(one.sessionId, null);
  assert.equal(one.workspace, path.join(newRoot, f.p1, 'workspace')); assert.notEqual(one.workspace, oldWorkspace);
  const migrated = await f.manager.describe(f.p1);
  assert.equal(migrated.session_id, f.sharedSession); assert.notEqual(migrated.session_id, oldSession);
  assert.equal(migrated.session_workspace, one.workspace); assert.equal(migrated.session_history.length, 1);
  assert.equal(migrated.session_history[0].session_id, oldSession); assert.equal(migrated.session_history[0].workspace, oldWorkspace);
  assert.equal(migrated.session_history[0].reason, 'workspace-location-changed'); assert.ok(migrated.session_history[0].ended_at);
  assert.deepEqual((await f.manager.load(f.p1)).tasks.find(task => task.id === oldTask.id), oldTask); assert.equal((await f.manager.get(f.p1, oldTask.id)).items[0].status, 'NOT_RUN');
  assert.equal(await fs.readFile(path.join(oldWorkspace, 'lib.mjs'), 'utf8'), 'export const original = true;');
  assert.equal(await fs.readFile(path.join(oldWorkspace, 'page-facts.md'), 'utf8'), 'original verified facts');
  await fs.writeFile(path.join(one.workspace, 'page-facts.md'), 'new workspace facts');
  one.finish(); await f.manager.completion;
  const second = await f.manager.create(f.p1, taskInput('two')), two = await f.ready(2);
  assert.equal(second.session_id, f.sharedSession); assert.equal(two.sessionId, f.sharedSession); assert.equal(two.workspace, one.workspace);
  assert.equal(await fs.readFile(path.join(two.workspace, 'page-facts.md'), 'utf8'), 'new workspace facts');
  assert.equal((await f.manager.describe(f.p1)).session_history.length, 1, 'the unchanged workspace must not rotate the session again');
  two.finish(); await f.manager.completion;
  assert.deepEqual((await f.manager.load(f.p1)).tasks.find(task => task.id === oldTask.id), oldTask); assert.equal((await f.manager.get(f.p1, oldTask.id)).items[0].status, 'NOT_RUN'); assert.equal(f.calls.length, 2);
});

test('public progress, approval lifecycle and observed model metadata persist without raw hidden fields', async t => {
  const f = await fixture(t), task = await f.manager.create(f.p1, taskInput()), control = await f.ready(1);
  const selected = { provider: 'deepseek-official', model: 'deepseek-flash' }, permissions = { mode: 'workspace' };
  await control.onEvent({ type: 'session_metadata', selected_model: selected, permissions });
  let saved = await f.manager.get(f.p1, task.id);
  assert.deepEqual(saved.runtime.selected_model, selected); assert.deepEqual(saved.runtime.permissions, permissions);
  assert.equal(saved.runtime.profile, 'unit-test');
  await control.onEvent({ event_type: 'assistant/message', seq: 10, at: '2026-10-14T10:00:00.000Z', summary: '复用已验证的月份操作',
    thinking: 'DO_NOT_PERSIST_PRIVATE_REASONING', raw: { content: 'DO_NOT_PERSIST_RAW_MESSAGE' } });
  await control.onEvent({ event_type: 'tool/result', seq: 11, at: '2026-10-14T10:00:01.000Z', tool_name: 'pwsh',
    summary: '工具操作被权限限制阻止', is_error: true, error_code: 'ACCESS_DENIED', command: 'DO_NOT_PERSIST_RAW_COMMAND' });
  await control.onEvent({ type: 'approval_requested', approval_id: 'approval-one', tool_name: 'pwsh', purpose: '执行终端操作', command: 'DO_NOT_PERSIST_APPROVAL_COMMAND', stage: '等待用户授权：执行终端操作' });
  saved = await f.manager.get(f.p1, task.id);
  assert.deepEqual(saved.pending_approvals, [{ id: 'approval-one', tool_name: 'pwsh', purpose: '执行终端操作' }]);
  assert.equal(saved.stage, '等待用户授权：执行终端操作');
  assert.deepEqual(saved.events.map(event => event.type), ['progress', 'tool/result']);
  assert.equal(saved.events[0].summary, '复用已验证的月份操作'); assert.equal(saved.events[0].at, '2026-10-14T10:00:00.000Z');
  assert.equal(saved.events[1].tool_name, 'pwsh'); assert.equal(saved.events[1].is_error, true); assert.equal(saved.events[1].error_code, 'ACCESS_DENIED');
  assert.doesNotMatch(JSON.stringify(saved), /DO_NOT_PERSIST/);
  await control.onEvent({ type: 'approval_resolved', approval_id: 'approval-one' });
  assert.deepEqual((await f.manager.get(f.p1, task.id)).pending_approvals, []);
  const finalModel = { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' };
  const finalPermissions = { mode: 'workspace', approval: 'user-decided' };
  control.finish({ selected_model: finalModel, permissions: finalPermissions, pending_approvals: [], reply: '本轮已记录工具问题，尚未执行用例。', usage: { total_tokens: 123 } });
  await f.manager.completion;
  const persisted = JSON.parse(await fs.readFile(path.join(f.manager.directory(f.p1), 'session.json'), 'utf8')).tasks.find(item => item.id === task.id);
  assert.deepEqual(persisted.runtime.selected_model, finalModel); assert.deepEqual(persisted.runtime.permissions, finalPermissions);
  assert.deepEqual(persisted.pending_approvals, []); assert.equal(persisted.events.length, 2); assert.equal(persisted.usage.total_tokens, 123);
  assert.equal(persisted.reply, '本轮已记录工具问题，尚未执行用例。'); assert.equal(persisted.status, 'FAILED'); assert.equal(persisted.error, 'NATIVE_DSH_NO_EXECUTION');
  assert.doesNotMatch(JSON.stringify(persisted), /DO_NOT_PERSIST/); assert.equal(f.executions.length, 0);
});
