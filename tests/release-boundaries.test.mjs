import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readBuildInfo, dataDirectoryId } from '../src/build-info.mjs';
import { start } from '../src/server.mjs';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { demoCases } from '../src/demo.mjs';
import { uid } from '../src/common.mjs';

const code = (expected) => (error) => error.code === expected;
async function temporary(t, prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('build identity detects same-version runtime changes, excluding private data and Python caches', async (t) => {
  const root = await temporary(t, 'ui-build-');
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'data'));
  await fs.writeFile(path.join(root, 'package.json'), '{"version":"0.4.0-beta.1"}');
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  await fs.writeFile(path.join(root, 'src', 'app.mjs'), 'export const n=1;');
  const first = await readBuildInfo(root);
  await fs.writeFile(path.join(root, 'data', 'credential.json'), 'PRIVATE_CANARY');
  await fs.mkdir(path.join(root, 'src', '__pycache__'));
  await fs.writeFile(path.join(root, 'src', '__pycache__', 'app.pyc'), 'generated');
  assert.equal((await readBuildInfo(root)).build_id, first.build_id);
  assert.ok(!JSON.stringify(first).includes('PRIVATE_CANARY'));
  await fs.writeFile(path.join(root, 'src', 'app.mjs'), 'export const n=2;');
  assert.notEqual((await readBuildInfo(root)).build_id, first.build_id);
  assert.equal((await readBuildInfo(root)).version, first.version);
});

test('build identity also binds dependency definitions and UI assets', async (t) => {
  const root = await temporary(t, 'ui-build-assets-');
  await fs.mkdir(path.join(root, 'public'));
  await fs.writeFile(path.join(root, 'package.json'), '{"version":"candidate"}');
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  const original = await readBuildInfo(root);
  await fs.writeFile(path.join(root, 'public', 'app.js'), 'console.log(1)');
  const withUI = await readBuildInfo(root);
  assert.notEqual(withUI.build_id, original.build_id);
  await fs.writeFile(path.join(root, 'package-lock.json'), '{"revision":2}');
  assert.notEqual((await readBuildInfo(root)).build_id, withUI.build_id);
});

test('server exposes package identity and shutdown validates CSRF and exact instance', async (t) => {
  const dataDir = await temporary(t, 'ui-instance-');
  const app = await start({ port: 0, dataDir, provider: new DeepSeek({ key: '' }) });
  t.after(() => app.close());
  const config = await (await fetch(app.url + '/api/config')).json();
  const build = await readBuildInfo();
  assert.equal(config.version, build.version);
  assert.equal(config.build_id, build.build_id);
  assert.equal(config.instance.data_directory_id, dataDirectoryId(dataDir));
  const request = (instance, csrf = app.csrf) =>
    fetch(app.url + '/api/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ instance_id: instance }),
    });
  assert.equal((await request(config.instance.id, 'wrong')).status, 403);
  assert.equal((await request(uid())).status, 409);
  assert.equal((await request(config.instance.id)).status, 202);
  await app.close();
  await assert.rejects(fs.access(path.join(dataDir, '.writer.lock')), { code: 'ENOENT' });
});

async function siteFixture(t) {
  const store = new Store(await temporary(t, 'ui-site-guard-'));
  await store.init();
  const cases = demoCases();
  const create = (name, target) => store.create({ name, target, baseline: cases.baseline });
  const dirty = await create('原任务', 'http://example.test/first');
  const next = await create('新任务', 'http://example.test/second');
  const other = await create('另一站点', 'http://other.test/first');
  await store.update(dirty, (s) => {
    s.authorization.nonproduction = true;
    s.cases[1].plan = cases.plans[1];
    s.cases[1].cleanup_required = true;
  });
  await store.update(next, (s) => {
    s.authorization.nonproduction = true;
  });
  const calls = { open: 0, discover: 0, execute: 0 };
  const controller = new Controller({
    store,
    provider: { configured: () => true },
    browser: {
      active: () => true,
      authenticated: true,
      open: async () => {
        calls.open++;
      },
      execute: async () => {
        calls.execute++;
        throw Error('must not execute');
      },
    },
    discoveryFactory: () => {
      calls.discover++;
      throw Error('must not discover');
    },
  });
  return { store, controller, dirty, next, other, calls, cases };
}

test('new tasks cannot bypass a same-origin cleanup hold through browser, discovery or execution', async (t) => {
  const { controller, next, calls } = await siteFixture(t);
  await assert.rejects(controller.openBrowser(next), code('SITE_CLEANUP_REQUIRED'));
  for (const kind of ['discover', 'run']) {
    await assert.rejects(
      controller.launch(next, kind, ['CATALOG-001']),
      code('SITE_CLEANUP_REQUIRED'),
    );
    assert.equal(controller.active, null);
  }
  assert.deepEqual(calls, { open: 0, discover: 0, execute: 0 });
});

test('cleanup holds survive storage reopen, while unrelated origins remain usable', async (t) => {
  const { store, dirty, next, other } = await siteFixture(t);
  const reopened = new Store(store.root);
  const blocks = await reopened.cleanupBlockers((await store.read(next)).target);
  assert.equal(blocks[0].task_id, dirty);
  assert.equal((await reopened.cleanupBlockers((await store.read(other)).target)).length, 0);
});

test('operator recovery is recorded on the original task; it does not delete or rewrite old facts', async (t) => {
  const { controller, store, dirty, next } = await siteFixture(t);
  await controller.openBrowser(dirty); // Manual recovery remains accessible.
  await assert.rejects(
    controller.recovered(dirty, 'TASK-001', ''),
    code('RECOVERY_EVIDENCE_REQUIRED'),
  );
  const caseId = (await store.read(dirty)).cases[1].case_id;
  await controller.recovered(dirty, caseId, '人工核对临时记录已删除，相关基准记录保持原值。');
  const record = (await store.read(dirty)).cases[1];
  assert.equal(record.recovery_confirmation.source, 'LOCAL_OPERATOR');
  assert.deepEqual(record.recovery_confirmation.attempt_ids, []);
  assert.equal((await store.cleanupBlockers((await store.read(next)).target)).length, 0);
  await controller.openBrowser(next);
});

test('interrupted mutation becomes a cross-task cleanup hold on restart', async (t) => {
  const { store, dirty, next } = await siteFixture(t);
  await store.update(dirty, (s) => {
    s.status = 'RUNNING';
    s.cases[1].status = 'RUNNING';
    s.cases[1].cleanup_required = false;
  });
  const reopened = new Store(store.root);
  await reopened.recoverInterrupted();
  assert.equal((await reopened.read(dirty)).cases[1].status, 'INTERRUPTED');
  assert.equal((await reopened.cleanupBlockers((await store.read(next)).target)).length, 1);
});

test('unknown corrupt task state blocks new execution instead of assuming there is no residue', async (t) => {
  const { store, controller, dirty, next } = await siteFixture(t);
  await fs.writeFile(path.join(store.dir(dirty), 'state.json'), '{broken');
  await assert.rejects(
    controller.launch(next, 'run', ['CATALOG-001']),
    code('CLEANUP_STATE_UNVERIFIED'),
  );
});

test('new committed execution facts contain build identity without modifying historical facts', async (t) => {
  const { store, next } = await siteFixture(t);
  const fact = { id: uid(), status: 'NOT_EXECUTED', finished_at: new Date().toISOString() };
  const oldReceipt = await store.fact(next, fact);
  store.build = await readBuildInfo();
  const newReceipt = await store.fact(next, { ...fact, id: uid() });
  assert.equal((await store.facts(next, oldReceipt)).agent_build, undefined);
  assert.equal((await store.facts(next, newReceipt)).agent_build.build_id, store.build.build_id);
});
