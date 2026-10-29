import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { contentHash } from '../server/cases/excel.mjs';
import { DemonstrationFloatingHost, prepareDemonstrationFloatingExecutable } from '../server/demonstration-floating.mjs';
import { Demonstrations } from '../server/demonstrations.mjs';

const project = 'project-12345678';
const id = 'demo-12345678-1234-1234-1234-123456789abc';
const other = 'demo-22345678-1234-1234-1234-123456789abc';

function fakeChild() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.exitCode = null;
  child.killed = false;
  child.kill = () => { child.killed = true; child.exitCode = 0; queueMicrotask(() => child.emit('exit', 0)); return true; };
  return child;
}

test('native host waits for bounded ready, reuses and focuses the owned window', async () => {
  const children = [];
  const calls = [];
  const host = new DemonstrationFloatingHost({ platform: 'win32', systemRoot: 'C:\\Windows',
    prepareExecutable: async () => 'C:\\app\\client.exe',
    spawnProcess: (...args) => { calls.push(args); const child = fakeChild(); children.push(child); return child; } });
  const pending = host.open(project, id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'C:\\app\\client.exe');
  assert.deepEqual(calls[0][1], [project, id]);
  assert.deepEqual(calls[0][2], { windowsHide: false, stdio: ['pipe', 'pipe', 'ignore'], shell: false });
  children[0].stdout.write('DEMONSTRATION_FLOATING_READY\r\n');
  await pending;
  let focus = '';
  children[0].stdin.on('data', chunk => { focus += chunk.toString(); });
  await host.open(project, id);
  assert.equal(calls.length, 1);
  assert.equal(focus, 'FOCUS\n');
  await assert.rejects(host.open(project, other), /DEMONSTRATION_FLOATING_ALREADY_ACTIVE/);
  host.close(project, other);
  assert.equal(children[0].killed, false);
  host.close(project, id);
  assert.equal(children[0].killed, true);
  host.closeAll();
});

test('unsupported platform, early exit, spawn failure and no-ready timeout fail explicitly', async () => {
  const unsupported = new DemonstrationFloatingHost({ platform: 'linux' });
  await assert.rejects(unsupported.open(project, id), /DEMONSTRATION_FLOATING_UNSUPPORTED/);
  const early = fakeChild();
  const earlyHost = new DemonstrationFloatingHost({ platform: 'win32', systemRoot: 'C:\\Windows',
    prepareExecutable: async () => 'C:\\app\\client.exe',
    spawnProcess: () => early });
  const opening = earlyHost.open(project, id);
  await new Promise(resolve => setImmediate(resolve));
  early.emit('exit', 1);
  await assert.rejects(opening, /DEMONSTRATION_FLOATING_START_FAILED/);
  assert.equal(earlyHost.current, null);
  const failed = new DemonstrationFloatingHost({ platform: 'win32', systemRoot: 'C:\\Windows',
    prepareExecutable: async () => 'C:\\app\\client.exe',
    spawnProcess: () => { throw Error('private process error'); } });
  await assert.rejects(failed.open(project, id), /DEMONSTRATION_FLOATING_START_FAILED/);
  const silent = fakeChild();
  const timed = new DemonstrationFloatingHost({ platform: 'win32', systemRoot: 'C:\\Windows',
    prepareExecutable: async () => 'C:\\app\\client.exe',
    spawnProcess: () => silent, readyTimeoutMs: 15 });
  await assert.rejects(timed.open(project, id), /DEMONSTRATION_FLOATING_READY_TIMEOUT/);
  assert.equal(silent.killed, true);
  assert.equal(timed.current, null);
});

test('owned helper stdin failure is handled and a new helper can be started', async () => {
  const first = fakeChild(), second = fakeChild();
  const children = [first, second];
  const host = new DemonstrationFloatingHost({ platform: 'win32', systemRoot: 'C:\\Windows',
    prepareExecutable: async () => 'C:\\app\\client.exe', spawnProcess: () => children.shift() });
  const opened = host.open(project, id);
  await new Promise(resolve => setImmediate(resolve));
  first.stdout.write('DEMONSTRATION_FLOATING_READY\n');
  await opened;
  first.stdin.emit('error', Error('EPIPE'));
  assert.equal(first.killed, true);
  assert.equal(host.current, null);
  const reopened = host.open(project, id);
  await new Promise(resolve => setImmediate(resolve));
  second.stdout.write('DEMONSTRATION_FLOATING_READY\n');
  await reopened;
  host.closeAll();
  assert.equal(second.killed, true);
});

test('compiler cache is keyed to source bytes and verifies the executable bytes',
  { skip: process.platform !== 'win32' }, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-floating-build-'));
    const source = path.join(root, 'client.cs');
    const cacheRoot = path.join(root, 'cache');
    let builds = 0;
    const spawnProcess = (_compiler, args) => {
      builds++;
      const child = new EventEmitter();
      queueMicrotask(async () => {
        await fs.writeFile(args.find(arg => arg.startsWith('/out:')).slice(5), `fixture-executable-${builds}`);
        child.emit('exit', 0);
      });
      return child;
    };
    try {
      await fs.writeFile(source, 'class Fixture {}');
      const options = { systemRoot: process.env.SystemRoot, source, cacheRoot, spawnProcess };
      const first = await prepareDemonstrationFloatingExecutable(options);
      assert.equal(builds, 1);
      assert.equal(await prepareDemonstrationFloatingExecutable(options), first);
      assert.equal(builds, 1);
      await fs.writeFile(first, 'tampered');
      assert.equal(await prepareDemonstrationFloatingExecutable(options), first);
      assert.equal(builds, 2);
      await fs.writeFile(source, 'class FixtureChanged {}');
      assert.notEqual(await prepareDemonstrationFloatingExecutable(options), first);
      assert.equal(builds, 3);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

test('floating-open requires active project and demonstration; stop closes only its helper', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-floating-host-'));
  const calls = [];
  const caseContent = { case_type: 'UI', status: 'CONFIRMED', steps: [{ action: 'open', expected: 'visible' }] };
  const demos = new Demonstrations({ root,
    caseStore: { getProject: async () => ({ cases: [{ case_id: 'case-12345678',
      versions: [{ version: 1, content: caseContent, content_sha256: contentHash(caseContent) }] }] }) },
    buildManager: { projectTargetAccess: { get: async () => ({ project_id: project,
      environment_id: 'user-target-12345678-1234-1234-1234-123456789012',
      configuration_sha256: 'A'.repeat(64), origin: 'http://127.0.0.1:3100',
      path_prefix: '/', entry_url: 'http://127.0.0.1:3100/' }) } },
    browserExecutable: 'fixture', browserFactory: async () => ({ setMode: async () => {}, close: async () => {} }),
    floatingHost: { open: async (...args) => calls.push(['open', ...args]),
      close: (...args) => calls.push(['close', ...args]), closeAll: () => calls.push(['closeAll']) } });
  try {
    const item = await demos.open(project, { case_id: 'case-12345678', case_version: 1,
      environment_id: 'user-target-12345678-1234-1234-1234-123456789012' });
    await assert.rejects(demos.control('project-87654321', item.demonstration_id, { action: 'floating-open' }),
      /DEMONSTRATION_NOT_ACTIVE/);
    await assert.rejects(demos.control(project, other, { action: 'floating-open' }), /DEMONSTRATION_NOT_ACTIVE/);
    assert.equal((await demos.control(project, item.demonstration_id, { action: 'floating-open' })).status, 'PAUSED');
    assert.deepEqual(calls, [['open', project, item.demonstration_id]]);
    await demos.control(project, item.demonstration_id, { action: 'stop' });
    assert.deepEqual(calls[1], ['close', project, item.demonstration_id, { afterResponse: true }]);
    await assert.rejects(demos.control(project, item.demonstration_id, { action: 'floating-open' }),
      /DEMONSTRATION_NOT_ACTIVE/);
  } finally { await demos.closeAll(); await fs.rm(root, { recursive: true, force: true }); }
});
