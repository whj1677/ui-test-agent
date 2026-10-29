import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { contentHash } from '../server/cases/excel.mjs';
import { Demonstrations } from '../server/demonstrations.mjs';
import { resolveDemonstrationEnvironment } from '../server/demonstration-environment.mjs';

const projectId = 'project-12345678';
const caseId = 'case-12345678';
const environmentId = 'auth-target-demo';
const content = { case_type: 'UI', status: 'CONFIRMED', steps: [
  { order: 1, action: 'open', expected: 'own row visible' },
] };
const entry = 'http://127.0.0.1:4330/protected';
const credential = 'never-persist-cookie-token-password';

function fixture(root, { failWrites = [] } = {}) {
  let status = 'NOT_LOGGED_IN';
  let account = 'account-A';
  let version = 'auth-version-1';
  let sent, browserStarts = 0, browserCloses = 0, authOpens = 0, authClears = 0;
  let browserOptions, writes = 0;
  const sessions = {
    environment: scope => {
      assert.deepEqual(scope, { project_id: projectId, environment_id: environmentId, role: 'inspector' });
      return { origin: 'http://127.0.0.1:4330', login_url: 'http://127.0.0.1:4330/login',
        identity_url: 'http://127.0.0.1:4330/api/identity', session_termination_endpoints: ['/logout'] };
    },
    check: async () => ({ status, account_id: status === 'VALID' ? account : null,
      session_version: status === 'VALID' ? version : null }),
    status: () => ({ status, account_id: status === 'VALID' ? account : null,
      session_version: status === 'VALID' ? version : null }),
    open: async () => { authOpens++; status = 'AWAITING_LOGIN'; return { status }; },
    clear: async () => { authClears++; status = 'NOT_LOGGED_IN'; },
    stateForExecution: async (_scope, expectedVersion) => {
      assert.equal(status, 'VALID'); assert.equal(expectedVersion, version);
      return { cookies: [{ name: 'sid', value: credential }], origins: [] };
    },
  };
  const buildManager = {
    projectTargetAccess: { get: async () => { throw Error('PROJECT_TARGET_NOT_FOUND'); } },
    developmentEnvironments: [{ id: environmentId, normal_url: entry, validation_mode: 'normal-only',
      auth_requirement: { environment_id: environmentId, role: 'inspector' } }], authSessions: sessions,
    reportStorageFault() {},
  };
  const demos = new Demonstrations({ root, caseStore: { getProject: async () => ({ cases: [{ case_id: caseId,
    versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) }, buildManager,
  browserExecutable: 'fixture', atomicJson: async (file, value) => {
    writes++;
    if (failWrites.includes(writes)) throw Error('FIXTURE_STORAGE_FAILURE');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(value));
  }, browserFactory: async (_target, _executable, onEvent, _interrupt, options) => {
    browserStarts++; sent = onEvent; browserOptions = options;
    return { setMode: async () => {}, close: async () => { browserCloses++; } };
  } });
  return { demos, buildManager, sessions, setStatus: value => { status = value; },
    setAccount: value => { account = value; version = `auth-version-${value}`; },
    get browserStarts() { return browserStarts; }, get browserCloses() { return browserCloses; },
    get authOpens() { return authOpens; }, get authClears() { return authClears; },
    get browserOptions() { return browserOptions; }, get writes() { return writes; },
    send: event => sent(event) };
}

const action = (kind, step_index = 0, id = 'button') => ({ kind, step_index,
  locator_hint: { tag: 'button', id }, frame_hint: { index: 0, path: '/protected' } });
const drain = () => new Promise(resolve => setImmediate(resolve));

test('login is outside recording; verified memory state starts paused and stop preserves AUTH session', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-'));
  const f = fixture(root); t.after(async () => { await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
  const target = await resolveDemonstrationEnvironment(f.buildManager, projectId, environmentId);
  assert.equal(target.auth_required, true);
  assert.match(target.configuration_sha256, /^[A-F0-9]{64}$/);
  const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  assert.equal(opened.status, 'WAITING_LOGIN'); assert.equal(f.browserStarts, 0);
  assert.equal((await f.demos.control(projectId, opened.demonstration_id, { action: 'login-open' })).status, 'WAITING_LOGIN');
  assert.equal(f.authOpens, 1);
  await f.demos.control(projectId, opened.demonstration_id, { action: 'login-open' });
  assert.equal(f.authOpens, 1, 'an awaiting login browser must be reused');
  f.setStatus('VALID');
  const ready = await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  assert.equal(ready.status, 'PAUSED'); assert.equal(f.browserStarts, 1);
  assert.equal(f.browserOptions.storageState.cookies[0].value, credential);
  assert.equal(ready.auth_context.role, 'inspector');
  assert.match(ready.auth_context.identity_sha256, /^[A-F0-9]{64}$/);
  assert.equal(JSON.stringify(ready).includes(credential), false);
  await f.demos.control(projectId, opened.demonstration_id, { action: 'start' });
  f.send(action('click')); await drain();
  const stopped = await f.demos.control(projectId, opened.demonstration_id, { action: 'stop' });
  assert.equal(stopped.events.length, 1); assert.equal(f.browserCloses, 1); assert.equal(f.authClears, 0);
  const disk = await fs.readFile(path.join(root, projectId, `${opened.demonstration_id}.json`), 'utf8');
  assert.equal(disk.includes(credential), false);
  assert.equal(disk.includes('account-A'), false);
  const confirmed = await f.demos.confirm(projectId, opened.demonstration_id, { recording_sha256: stopped.recording_sha256,
    assertion_reviews: [{ step_index: 0, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: [] }] });
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal((await f.demos.resolve(projectId, opened.demonstration_id, { case_id: caseId,
    case_version: 1, content_sha256: contentHash(content), environment_id: environmentId })).status, 'CONFIRMED');
  f.setAccount('account-B');
  await assert.rejects(f.demos.resolve(projectId, opened.demonstration_id, { case_id: caseId,
    case_version: 1, content_sha256: contentHash(content), environment_id: environmentId }), /DEMONSTRATION_AUTH_ACCOUNT_CHANGED/);
});

test('expired session blocks start, preserves prior actions, and a different account cannot resume', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-'));
  const f = fixture(root); t.after(async () => { await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
  f.setStatus('VALID');
  const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'start' });
  f.send(action('click')); await drain();
  await f.demos.control(projectId, opened.demonstration_id, { action: 'pause' });
  f.setStatus('EXPIRED');
  const blocked = await f.demos.control(projectId, opened.demonstration_id, { action: 'start' });
  assert.equal(blocked.status, 'WAITING_LOGIN'); assert.equal(blocked.auth_reason, 'EXPIRED');
  assert.equal(blocked.events.length, 1); assert.equal(f.browserCloses, 1);
  f.setAccount('account-B'); f.setStatus('VALID');
  const interrupted = await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  assert.equal(interrupted.status, 'INTERRUPTED');
  assert.equal(interrupted.interruption_reason, 'AUTH_ACCOUNT_CHANGED');
  assert.equal(f.browserStarts, 1);
});

test('box selection is atomic, cancellation records no assertion, and review IDs must match step', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-'));
  const f = fixture(root); t.after(async () => { await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
  f.setStatus('VALID');
  const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'pick', pick_mode: 'box' });
  f.send({ kind: 'assertion_targets', step_index: 0, targets: [action('assertion_target', 0, 'first'),
    action('assertion_target', 1, 'wrong-step')] });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'step', step_index: 0 });
  assert.equal((await f.demos.get(projectId, opened.demonstration_id)).events.length, 0);
  assert.equal((await f.demos.get(projectId, opened.demonstration_id)).selection_notice, 'SELECTION_INVALID');
  await f.demos.control(projectId, opened.demonstration_id, { action: 'pick', pick_mode: 'box' });
  f.send({ kind: 'assertion_targets', step_index: 0, targets: Array.from({ length: 21 }, (_, index) =>
    action('assertion_target', 0, `target-${index}`)) });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'step', step_index: 0 });
  assert.equal((await f.demos.get(projectId, opened.demonstration_id)).events.length, 0);
  await f.demos.control(projectId, opened.demonstration_id, { action: 'pick', pick_mode: 'box' });
  f.send({ kind: 'selection_cancelled', step_index: 0, reason: 'OVERFLOW' });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'step', step_index: 0 });
  assert.equal((await f.demos.get(projectId, opened.demonstration_id)).status, 'PAUSED');
  assert.equal((await f.demos.get(projectId, opened.demonstration_id)).selection_notice, 'SELECTION_OVERFLOW');
  assert.equal((await f.demos.get(projectId, opened.demonstration_id)).events.length, 0);
  await f.demos.control(projectId, opened.demonstration_id, { action: 'pick', pick_mode: 'box' });
  f.send({ kind: 'assertion_targets', step_index: 0, targets: [action('assertion_target', 0, 'first'),
    action('assertion_target', 0, 'second')] });
  const stopped = await f.demos.control(projectId, opened.demonstration_id, { action: 'stop' });
  assert.deepEqual(stopped.events.map(event => event.event_id), ['event-1', 'event-2']);
  await assert.rejects(f.demos.confirm(projectId, opened.demonstration_id, { recording_sha256: stopped.recording_sha256,
    assertion_reviews: [{ step_index: 0, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: ['event-1', 'event-1'] }] }),
  /DEMONSTRATION_REVIEW_INVALID/);
  const confirmed = await f.demos.confirm(projectId, opened.demonstration_id, { recording_sha256: stopped.recording_sha256,
    assertion_reviews: [{ step_index: 0, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: ['event-1', 'event-2'] }] });
  assert.deepEqual(confirmed.assertion_reviews[0].locator_event_ids, ['event-1', 'event-2']);
});

for (const failedWrite of [3, 4]) {
  test(`authenticated control write ${failedWrite} failure closes the demonstration browser and faults closed`, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-fault-'));
    const f = fixture(root, { failWrites: [failedWrite] });
    t.after(async () => { await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
    f.setStatus('VALID');
    const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    if (failedWrite === 3) await assert.rejects(
      f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' }), /FIXTURE_STORAGE_FAILURE/);
    else {
      await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
      await assert.rejects(f.demos.control(projectId, opened.demonstration_id, { action: 'start' }),
        /FIXTURE_STORAGE_FAILURE/);
    }
    assert.equal(f.browserCloses, 1);
    assert.equal(f.demos.active, null);
    assert.equal(f.demos.timer, null);
    assert.equal(f.demos.authTimer, null);
    assert.equal(f.demos.storageFault?.code, 'DEMONSTRATION_STORAGE_FAULT');
    assert.equal(f.demos.shutdownRequested, true);
    await assert.rejects(f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId }),
      /DEMONSTRATIONS_CLOSING/);
    const disk = await fs.readFile(path.join(root, projectId, `${opened.demonstration_id}.json`), 'utf8');
    assert.equal(disk.includes(credential), false);
  });
}

test('restart changes WAITING_LOGIN to interrupted without opening a browser', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-restart-'));
  const f = fixture(root); t.after(async () => { await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
  const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  const recovered = fixture(root);
  await recovered.demos.init();
  const item = await recovered.demos.get(projectId, opened.demonstration_id);
  assert.equal(item.status, 'INTERRUPTED');
  assert.equal(item.interruption_reason, 'SERVICE_RESTART');
  assert.equal(recovered.browserStarts, 0);
});

test('same account may recheck a renewed session, and missing account identity never opens a recorder', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-renew-'));
  const f = fixture(root); t.after(async () => { await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
  f.setStatus('VALID');
  const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  f.setStatus('EXPIRED');
  await f.demos.control(projectId, opened.demonstration_id, { action: 'start' });
  f.setAccount('account-A'); f.setStatus('VALID');
  const resumed = await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  assert.equal(resumed.status, 'PAUSED'); assert.equal(f.browserStarts, 2);
  await f.demos.control(projectId, opened.demonstration_id, { action: 'stop' });

  const second = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  f.setAccount('');
  const rejected = await f.demos.control(projectId, second.demonstration_id, { action: 'login-check' });
  assert.equal(rejected.status, 'WAITING_LOGIN');
  assert.equal(f.browserStarts, 2);
});

test('periodic identity check pauses an active authenticated recording when the session expires', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-auth-watch-'));
  const f = fixture(root);
  const originalSetInterval = globalThis.setInterval;
  let tick;
  globalThis.setInterval = (callback, delay) => {
    if (delay === 2000) { tick = callback; return { fixtureAuthTimer: true }; }
    return originalSetInterval(callback, delay);
  };
  t.after(async () => { globalThis.setInterval = originalSetInterval; await f.demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); });
  f.setStatus('VALID');
  const opened = await f.demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'login-check' });
  await f.demos.control(projectId, opened.demonstration_id, { action: 'start' });
  assert.equal(typeof tick, 'function');
  f.setStatus('EXPIRED'); tick();
  await f.demos.control(projectId, opened.demonstration_id, { action: 'step', step_index: 0 });
  const item = await f.demos.get(projectId, opened.demonstration_id);
  assert.equal(item.status, 'WAITING_LOGIN');
  assert.equal(item.auth_reason, 'EXPIRED');
  assert.equal(f.browserCloses, 1);
});
