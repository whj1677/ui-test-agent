import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createNativeDshRuntime, NATIVE_DSH_VERSION } from '../server/native-dsh/runtime.mjs';
import { BROWSER_BRIDGE_PATCH_PATH } from '../server/native-dsh/browser-bridge.mjs';

const testKey = 'engineering-only-key-not-real', launchToken = 'engineering_launch_token_not_real';
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-dsh-host-'));
  const packageRoot = path.join(root, 'node_modules/@deepseek-ai/dsh'), workspace = path.join(root, 'project');
  await fs.mkdir(path.join(packageRoot, 'lib'), { recursive: true }); await fs.mkdir(workspace);
  const dshBin = path.join(packageRoot, 'lib/bin.js');
  await fs.writeFile(dshBin, '// fake CLI: never executed\n');
  await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version: NATIVE_DSH_VERSION, bin: { dsh: 'lib/bin.js' } }));
  return { root, packageRoot, options: { dshBin, dshHome: path.join(root, 'managed-home'), workspace, startupTimeoutMs: 300, stopTimeoutMs: 200,
    environment: { SystemRoot: 'C:/Windows', DEEPSEEK_API_KEY: testKey, DSH_HOME: path.join(root, 'user-home'), NODE_OPTIONS: '--unsafe', PERSONAL_SECRET: 'secret' } },
  close: () => fs.rm(root, { recursive: true, force: true }) };
}

function processes({ output = `dsh web: http://127.0.0.1:39999/?token=${launchToken}\n`, autoExit = false } = {}) {
  const children = [], launches = [], stopped = [];
  const spawn = (command, args, options) => {
    const child = new EventEmitter();
    Object.assign(child, { pid: 50000 + children.length, exitCode: null, stdout: new PassThrough(), stderr: new PassThrough() });
    children.push(child); launches.push({ command, args, options });
    queueMicrotask(() => {
      if (output) child.stdout.write(output);
      if (autoExit) { child.exitCode = 1; child.emit('close', 1, null); }
    });
    return child;
  };
  const terminate = async child => {
    stopped.push(child);
    child.exitCode = 0;
    child.emit('close', 0, null);
  };
  return { spawn, terminate, children, launches, stopped,
    credentials: async ({ useStoredCredentials }) => useStoredCredentials ? null : ({ apiKey: testKey, baseUrl: 'https://api.deepseek.com', source: 'test' }) };
}

test('managed host uses the fixed version, private home, loopback port zero and in-memory credentials', async () => {
  const f = await fixture(), p = processes(), events = [];
  const runtime = createNativeDshRuntime({ ...f.options, onEvent: event => events.push(event) }, p);
  try {
    const [first, second] = await Promise.all([runtime.start(), runtime.start()]);
    assert.equal(first.url, `http://127.0.0.1:39999/?token=${launchToken}`);
    assert.deepEqual(first, second); assert.equal(p.launches.length, 1);
    assert.deepEqual(p.launches[0].args, [f.options.dshBin, '--profile', 'web', '--patch', BROWSER_BRIDGE_PATCH_PATH, '--host', '127.0.0.1', '--port', '0', '--no-open']);
    assert.equal(runtime.inspect().browser_bridge, true);
    assert.equal(p.launches[0].options.windowsHide, true); assert.equal(p.launches[0].options.shell, false);
    assert.equal(p.launches[0].options.env.DSH_HOME, f.options.dshHome);
    assert.equal(p.launches[0].options.env.DEEPSEEK_API_KEY, testKey);
    assert.equal(p.launches[0].options.env.DEEPSEEK_BASE_URL, undefined);
    assert.equal(p.launches[0].options.env.DSH_PERMISSION_MODE, undefined);
    assert.equal(p.launches[0].options.env.NODE_OPTIONS, undefined); assert.equal(p.launches[0].options.env.PERSONAL_SECRET, undefined);
    assert.equal(runtime.inspect().state, 'RUNNING'); assert.equal(runtime.inspect().version, NATIVE_DSH_VERSION);
    assert.ok(!JSON.stringify(events).includes(launchToken)); assert.ok(!JSON.stringify(events).includes(testKey));
    assert.ok(!JSON.stringify(runtime.inspect()).includes(launchToken));
    const saved = await fs.readFile(path.join(f.options.dshHome, 'workbench-native-host.json'), 'utf8');
    assert.ok(!saved.includes(testKey)); assert.ok(!saved.includes(launchToken));
    assert.deepEqual(await runtime.stop(), { stopped: true });
    assert.deepEqual(p.stopped, [p.children[0]]); assert.equal(runtime.inspect().state, 'STOPPED');
    await assert.rejects(fs.stat(path.join(f.options.dshHome, 'workbench-native-host.lock')), { code: 'ENOENT' });
    const resumed = await runtime.start();
    assert.notEqual(resumed.pid, first.pid); assert.equal(p.launches.length, 2);
  } finally { await runtime.stop(); await f.close(); }
});

test('version drift and an unowned user home are rejected before spawning or reading credentials', async () => {
  const f = await fixture(), p = processes(); let reads = 0;
  p.credentials = async () => { reads++; return null; };
  try {
    const pkg = path.join(f.packageRoot, 'package.json');
    await fs.writeFile(pkg, JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.1.6-alpha.2', bin: { dsh: 'lib/bin.js' } }));
    await assert.rejects(createNativeDshRuntime(f.options, p).start(), /VERSION_MISMATCH/);
    await fs.writeFile(pkg, JSON.stringify({ name: '@deepseek-ai/dsh', version: NATIVE_DSH_VERSION, bin: { dsh: 'lib/bin.js' } }));
    await fs.mkdir(f.options.dshHome); await fs.writeFile(path.join(f.options.dshHome, 'user-secret.json'), '{"private":"preserve"}');
    await assert.rejects(createNativeDshRuntime(f.options, p).start(), /HOME_NOT_OWNED/);
    assert.equal(p.launches.length, 0); assert.equal(reads, 0);
    assert.equal(await fs.readFile(path.join(f.options.dshHome, 'user-secret.json'), 'utf8'), '{"private":"preserve"}');
  } finally { await f.close(); }
});

test('startup timeout and non-loopback announcement stop only the owned process', async () => {
  const f = await fixture();
  try {
    for (const output of ['', `dsh web: http://0.0.0.0:39999/?token=${launchToken}\n`, `dsh web: http://127.0.0.1:4322/?token=${launchToken}\n`]) {
      const p = processes({ output }), runtime = createNativeDshRuntime(f.options, p);
      await assert.rejects(runtime.start(), output ? /LAUNCH_URL_INVALID/ : /STARTUP_TIMED_OUT/);
      assert.equal(p.stopped.length, 1); assert.equal(p.stopped[0], p.children[0]);
      assert.equal(runtime.inspect().state, 'ERROR');
      await assert.rejects(fs.stat(path.join(f.options.dshHome, 'workbench-native-host.lock')), { code: 'ENOENT' });
    }
  } finally { await f.close(); }
});

test('credential fallback uses the existing resolver and never reads a user Host authentication secret', async () => {
  const f = await fixture(), p = processes(), reads = [];
  p.credentials = async options => { reads.push(options); return options.useStoredCredentials ? { apiKey: testKey, baseUrl: 'https://api.deepseek.com', source: 'windows-dpapi-current-user' } : null; };
  const runtime = createNativeDshRuntime(f.options, p);
  try {
    await runtime.start();
    assert.equal(reads.length, 2); assert.equal(reads[0].useStoredCredentials, false); assert.equal(reads[1].useStoredCredentials, true);
    assert.equal(reads[1].dshHome, undefined);
    assert.equal(p.launches[0].options.env.DEEPSEEK_API_KEY, testKey);
  } finally { await runtime.stop(); await f.close(); }
});

test('managed Host shares the service credential provider without consulting another source', async () => {
  const f = await fixture(), p = processes(); let calls = 0;
  p.credentials = async () => { throw Error('independent credential resolution forbidden'); };
  const runtime = createNativeDshRuntime({ ...f.options, credentialProvider: async () => {
    calls++; return { apiKey: 'shared-service-fixture-key', source: 'windows-dpapi-current-user' };
  } }, p);
  try {
    await Promise.all([runtime.start(), runtime.start()]);
    assert.equal(calls, 1);
    assert.equal(p.launches[0].options.env.DEEPSEEK_API_KEY, 'shared-service-fixture-key');
    assert.doesNotMatch(JSON.stringify(runtime.inspect()), /shared-service-fixture-key/);
  } finally { await runtime.stop(); await f.close(); }
});

test('missing or rejected shared credentials never fall back to personal environment or spawn a Host', async () => {
  for (const outcome of ['missing', 'rejected']) {
    const f = await fixture(), p = processes();
    p.credentials = async () => { throw Error('fallback forbidden'); };
    const runtime = createNativeDshRuntime({ ...f.options, credentialProvider: async () => {
      if (outcome === 'rejected') throw Error('secret text must never escape');
      return null;
    } }, p);
    try {
      await assert.rejects(runtime.start(), error => error.message === (outcome === 'missing'
        ? 'NATIVE_DSH_MODEL_CREDENTIAL_REQUIRED' : 'NATIVE_DSH_CREDENTIAL_UNAVAILABLE'));
      assert.equal(p.launches.length, 0);
      assert.doesNotMatch(JSON.stringify(runtime.inspect()), /secret text/);
    } finally { await runtime.stop(); await f.close(); }
  }
});

test('another runtime cannot reuse an active private home or stop its process', async () => {
  const f = await fixture(), p = processes();
  const owner = createNativeDshRuntime(f.options, p), second = createNativeDshRuntime(f.options, p);
  try {
    await owner.start();
    await assert.rejects(second.start(), /HOME_BUSY/);
    await second.stop(); assert.equal(p.stopped.length, 0); assert.equal(owner.inspect().state, 'RUNNING');
  } finally { await owner.stop(); await f.close(); }
});

test('stop during startup is terminal and unexpected exit invalidates readiness', async () => {
  const f = await fixture(), p = processes({ output: '' });
  const runtime = createNativeDshRuntime(f.options, p);
  try {
    const started = runtime.start(); started.catch(() => {});
    while (!p.children.length) await new Promise(resolve => setTimeout(resolve, 5));
    await runtime.stop(); await assert.rejects(started, /START_CANCELLED/);
    assert.equal(runtime.inspect().state, 'STOPPED'); assert.equal(p.stopped.length, 1);
    const q = processes(), next = createNativeDshRuntime(f.options, q);
    await next.start(); q.children[0].exitCode = 1; q.children[0].emit('close', 1, null);
    assert.equal(next.inspect().state, 'ERROR'); assert.equal(next.inspect().publicUrl, null);
    await next.stop();
  } finally { await runtime.stop(); await f.close(); }
});
