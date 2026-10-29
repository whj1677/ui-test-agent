import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { contentHash } from '../server/cases/excel.mjs';
import { Demonstrations } from '../server/demonstrations.mjs';
import { demonstrationRoute } from '../server/demonstration-routes.mjs';

const projectId = 'project-12345678';
const caseId = 'case-12345678';
const environmentId = 'user-target-12345678-1234-1234-1234-123456789012';
const content = { case_type: 'UI', status: 'CONFIRMED', steps: [
  { order: 1, action: 'open', expected: 'visible' },
  { order: 2, action: 'search', expected: 'filtered' },
] };
const target = { project_id: projectId, environment_id: environmentId,
  configuration_sha256: 'A'.repeat(64), origin: 'http://127.0.0.1:3100',
  path_prefix: '/', entry_url: 'http://127.0.0.1:3100/' };
const event = (kind, step_index, extra = {}) => ({ kind, step_index, locator_hint: {
  tag: 'button', id: 'save', value: 'never-persist', ...extra,
}, frame_hint: { index: 0, path: '/' }, secret: 'never-persist' });

test('historical list projects frozen version metadata without rewriting recording files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-list-'));
  const frozen = { ...content, title: '原版两步示范', external_id: 'CASE-02' };
  const versions = [{ version: 1, content: frozen, content_sha256: contentHash(frozen) },
    { version: 2, content: { ...frozen, title: '新版四步示范' } }];
  const caseStore = { getProject: async () => ({ cases: [{ case_id: caseId, current_version: 2, versions }] }) };
  const demos = new Demonstrations({ root, caseStore });
  const id = 'demo-00000000-0000-4000-8000-000000000001';
  const file = path.join(root, projectId, `${id}.json`);
  const record = { schema: 'workbench/human-demonstration-v1', demonstration_id: id,
    project_id: projectId, case_id: caseId, case_version: 1, content_sha256: contentHash(frozen),
    status: 'CONFIRMED', created_at: '2026-09-30T04:00:00Z', steps: frozen.steps };
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(record));
    const original = await fs.readFile(file);
    const { recordings } = await demos.list(projectId);
    assert.equal(recordings[0].case_title, '原版两步示范');
    assert.equal(recordings[0].case_external_id, 'CASE-02');
    assert.equal(recordings[0].step_count, 2);
    assert.deepEqual(await fs.readFile(file), original);
    versions[0].content.title = '被改变的旧正文';
    assert.equal((await demos.list(projectId)).recordings[0].case_title, null,
      'mismatched frozen hash must not label history with altered or current case content');
    assert.deepEqual(await fs.readFile(file), original);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('frozen case recording, redaction, step race, confirmation and tamper rejection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-'));
  let send;
  let closed = false;
  const browserFactory = async (_target, _exe, onEvent) => {
    send = onEvent;
    return { setMode: async () => {}, close: async () => { closed = true; } };
  };
  const caseStore = { getProject: async () => ({ cases: [{ case_id: caseId,
    versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) };
  const buildManager = { projectTargetAccess: { get: async () => target } };
  const demos = new Demonstrations({ root, caseStore, buildManager, browserExecutable: 'fixture', browserFactory });
  try {
    await demos.init();
    const opened = await demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    const id = opened.demonstration_id;
    assert.equal(opened.status, 'PAUSED');
    await demos.control(projectId, id, { action: 'start' });
    send(event('click', 0));
    await demos.control(projectId, id, { action: 'step', step_index: 1 });
    send(event('fill', 0)); // Delayed event from the previous step is discarded.
    send(event('fill', 1, { id: 'search' }));
    send(event('fill', 1, { id: 'search' })); // Per-keystroke duplicate is collapsed.
    await demos.control(projectId, id, { action: 'pause' });
    const stopped = await demos.control(projectId, id, { action: 'stop' });
    assert.equal(closed, true);
    assert.equal(stopped.events.length, 2);
    assert.equal(stopped.events[0].step_index, 0);
    assert.equal(stopped.events[1].step_index, 1);
    assert.equal(JSON.stringify(stopped).includes('never-persist'), false);
    assert.rejects(() => demos.confirm(projectId, id, { recording_sha256: 'B'.repeat(64), assertion_reviews: [] }),
      /DEMONSTRATION_RECORDING_CHANGED/);
    const reviews = [0, 1].map(step_index => ({ step_index, confirmed: true,
      source: 'FROZEN_CASE', locator_event_id: null }));
    const confirmed = await demos.confirm(projectId, id,
      { recording_sha256: stopped.recording_sha256, assertion_reviews: reviews });
    assert.equal(confirmed.status, 'CONFIRMED');
    assert.match(confirmed.confirmed_sha256, /^[A-F0-9]{64}$/);
    assert.equal((await demos.resolve(projectId, id, { case_id: caseId, case_version: 1,
      content_sha256: contentHash(content), environment_id: environmentId })).demonstration_id, id);
    const file = path.join(root, projectId, `${id}.json`);
    const legacy = JSON.parse(await fs.readFile(file, 'utf8'));
    delete legacy.selection_mode; delete legacy.selection_notice;
    await fs.writeFile(file, JSON.stringify(legacy));
    assert.equal((await demos.resolve(projectId, id, { case_id: caseId, case_version: 1,
      content_sha256: contentHash(content), environment_id: environmentId })).demonstration_id, id,
    'older records without selection fields retain their original hashes');
    await assert.rejects(() => demos.resolve(projectId, id, { case_id: caseId, case_version: 2,
      content_sha256: contentHash(content), environment_id: environmentId }), /DEMONSTRATION_BINDING_MISMATCH/);
    const tampered = JSON.parse(await fs.readFile(file, 'utf8'));
    tampered.assertion_reviews[0].source = 'OBSERVED_PAGE';
    await fs.writeFile(file, JSON.stringify(tampered));
    await assert.rejects(() => demos.resolve(projectId, id, { case_id: caseId, case_version: 1,
      content_sha256: contentHash(content), environment_id: environmentId }), /DEMONSTRATION_BINDING_MISMATCH/);
  } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
});

test('untrusted mutation is rejected by route before body read', async () => {
  let bodyRead = false;
  const response = {};
  const sent = [];
  const handled = await demonstrationRoute({ request: { method: 'POST' }, response,
    url: new URL(`http://127.0.0.1:4322/api/case-library/projects/${projectId}/demonstrations`),
    demonstrations: {}, trustedMutation: () => false,
    readJsonBody: async () => { bodyRead = true; return {}; },
    sendJson: (_response, code, body) => sent.push({ code, body }) });
  assert.equal(handled, true);
  assert.equal(bodyRead, false);
  assert.equal(sent[0].code, 403);
});

test('violation while browser factory opens is serialized into interruption', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-'));
  const caseStore = { getProject: async () => ({ cases: [{ case_id: caseId,
    versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) };
  const buildManager = { projectTargetAccess: { get: async () => target } };
  let closed = false;
  const demos = new Demonstrations({ root, caseStore, buildManager, browserExecutable: 'fixture',
    browserFactory: async (_target, _exe, _event, onInterruption) => {
      onInterruption('TARGET_SCOPE_REQUEST_BLOCKED');
      return { setMode: async () => {}, close: async () => { closed = true; } };
    } });
  try {
    const opened = await demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    const deadline = Date.now() + 1000;
    let item;
    do {
      item = await demos.get(projectId, opened.demonstration_id);
      if (item.status === 'INTERRUPTED') break;
      await new Promise(resolve => setTimeout(resolve, 5));
    } while (Date.now() < deadline);
    assert.equal(item.status, 'INTERRUPTED');
    assert.equal(item.interruption_reason, 'TARGET_SCOPE_REQUEST_BLOCKED');
    assert.equal(closed, true);
  } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
});

test('normal closeAll records SERVICE_SHUTDOWN, not a storage failure', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-'));
  const caseStore = { getProject: async () => ({ cases: [{ case_id: caseId,
    versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) };
  const buildManager = { projectTargetAccess: { get: async () => target } };
  let closed = false;
  const demos = new Demonstrations({ root, caseStore, buildManager, browserExecutable: 'fixture',
    browserFactory: async () => ({ setMode: async () => {}, close: async () => { closed = true; } }) });
  try {
    const opened = await demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    await demos.closeAll();
    const saved = await demos.get(projectId, opened.demonstration_id);
    assert.equal(saved.status, 'INTERRUPTED');
    assert.equal(saved.interruption_reason, 'SERVICE_SHUTDOWN');
    assert.equal(closed, true);
    assert.equal(demos.storageFault, null);
  } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
});

test('unknown interruption reason stays unspecified', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-'));
  const caseStore = { getProject: async () => ({ cases: [{ case_id: caseId,
    versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) };
  const buildManager = { projectTargetAccess: { get: async () => target } };
  let interrupt;
  const demos = new Demonstrations({ root, caseStore, buildManager, browserExecutable: 'fixture',
    browserFactory: async (_target, _exe, _event, onInterruption) => {
      interrupt = onInterruption;
      return { setMode: async () => {}, close: async () => {} };
    } });
  try {
    const opened = await demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    interrupt('UNEXPECTED_INTERNAL_REASON');
    const deadline = Date.now() + 1000;
    let saved;
    do {
      saved = await demos.get(projectId, opened.demonstration_id);
      if (saved.status === 'INTERRUPTED') break;
      await new Promise(resolve => setTimeout(resolve, 5));
    } while (Date.now() < deadline);
    assert.equal(saved.interruption_reason, 'INTERRUPTION_UNSPECIFIED');
    assert.equal(demos.storageFault, null);
  } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
});

for (const failWrites of [[2], [2, 3]]) {
  test(`failed PAUSED persistence with failed writes ${failWrites.join(',')} closes browser and clears ownership`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-fault-'));
    let writes = 0, closes = 0;
    const caseStore = { getProject: async () => ({ cases: [{ case_id: caseId,
      versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) };
    const buildManager = { projectTargetAccess: { get: async () => target }, reportStorageFault() {} };
    const demos = new Demonstrations({ root, caseStore, buildManager, browserExecutable: 'fixture',
      browserFactory: async () => ({ setMode: async () => {}, close: async () => { closes++; } }),
      atomicJson: async (file, item) => {
        writes++;
        if (failWrites.includes(writes)) throw Error('FIXTURE_WRITE_FAILURE');
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(item));
      } });
    try {
      await assert.rejects(demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId }),
        /FIXTURE_WRITE_FAILURE/);
      assert.equal(closes >= 1, true);
      assert.equal(demos.active, null, 'closed browser must not remain globally active');
      assert.equal(demos.timer, null);
      assert.equal(demos.starting, false);
      assert.equal(demos.storageFault?.code, 'DEMONSTRATION_STORAGE_FAULT');
      assert.equal(demos.shutdownRequested, true);
      await assert.rejects(demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId }),
        /DEMONSTRATIONS_CLOSING/);
      const names = await fs.readdir(path.join(root, projectId));
      const stored = JSON.parse(await fs.readFile(path.join(root, projectId, names[0]), 'utf8'));
      assert.equal(stored.status, failWrites.length === 1 ? 'INTERRUPTED' : 'PREPARING');
    } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
  });
}

test('legacy confirmed UI case without case_type records without changing original content hash', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-legacy-'));
  const { case_type: _ignored, ...legacyContent } = content;
  const originalHash = contentHash(legacyContent);
  let browserStarts = 0;
  const demos = new Demonstrations({ root, caseStore: { getProject: async () => ({ cases: [{ case_id: caseId,
    versions: [{ version: 1, content: legacyContent, content_sha256: originalHash }] }] }) },
    buildManager: { projectTargetAccess: { get: async () => target } }, browserExecutable: 'fixture',
    browserFactory: async () => { browserStarts++; return { setMode: async () => {}, close: async () => {} }; } });
  try {
    const opened = await demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    assert.equal(opened.status, 'PAUSED');
    assert.equal(opened.content_sha256, originalHash);
    assert.equal(browserStarts, 1);
    await demos.control(projectId, opened.demonstration_id, { action: 'stop' });
    assert.equal(Object.hasOwn(legacyContent, 'case_type'), false);
    assert.equal(contentHash(legacyContent), originalHash);
  } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
});

test('server refuses BACKEND, null and unknown case types before opening a browser', async () => {
  for (const caseType of ['BACKEND', null, 'OTHER']) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-type-'));
    const nonUi = { ...content, case_type: caseType };
    let browserStarts = 0;
    const demos = new Demonstrations({ root, caseStore: { getProject: async () => ({ cases: [{ case_id: caseId,
      versions: [{ version: 1, content: nonUi, content_sha256: contentHash(nonUi) }] }] }) },
      buildManager: { projectTargetAccess: { get: async () => target } }, browserExecutable: 'fixture',
      browserFactory: async () => { browserStarts++; return { setMode: async () => {}, close: async () => {} }; } });
    try {
      await assert.rejects(demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId }),
        /DEMONSTRATION_CONFIRMED_CASE_REQUIRED/);
      assert.equal(browserStarts, 0);
    } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
  }
});

test('timeout persistence failure closes recording without an unhandled rejection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-demo-timeout-'));
  let writes = 0, closes = 0, expire;
  const originalSetTimeout = globalThis.setTimeout;
  const unhandled = [];
  const onUnhandled = error => unhandled.push(error);
  const demos = new Demonstrations({ root,
    caseStore: { getProject: async () => ({ cases: [{ case_id: caseId,
      versions: [{ version: 1, content, content_sha256: contentHash(content) }] }] }) },
    buildManager: { projectTargetAccess: { get: async () => target }, reportStorageFault() {} },
    browserExecutable: 'fixture',
    browserFactory: async () => ({ setMode: async () => {}, close: async () => { closes++; } }),
    atomicJson: async (file, item) => {
      writes++;
      if (writes === 3) throw Error('FIXTURE_TIMEOUT_WRITE_FAILURE');
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(item));
    } });
  try {
    globalThis.setTimeout = (callback, delay, ...args) => {
      if (delay === 20 * 60 * 1000) { expire = () => callback(...args); return { fixtureTimer: true }; }
      return originalSetTimeout(callback, delay, ...args);
    };
    const opened = await demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId });
    globalThis.setTimeout = originalSetTimeout;
    process.on('unhandledRejection', onUnhandled);
    assert.equal(typeof expire, 'function');
    expire();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(demos.active, null);
    assert.equal(demos.timer, null);
    assert.equal(closes, 1);
    assert.equal(demos.storageFault?.code, 'DEMONSTRATION_STORAGE_FAULT');
    assert.equal(demos.shutdownRequested, true);
    assert.deepEqual(unhandled, []);
    await assert.rejects(demos.open(projectId, { case_id: caseId, case_version: 1, environment_id: environmentId }),
      /DEMONSTRATIONS_CLOSING/);
    assert.equal((await demos.get(projectId, opened.demonstration_id)).status, 'PAUSED',
      'failed timeout persistence must not be reported as durable interruption');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    process.off('unhandledRejection', onUnhandled);
    await demos.closeAll();
    await fs.rm(root, { recursive: true, force: true });
  }
});
