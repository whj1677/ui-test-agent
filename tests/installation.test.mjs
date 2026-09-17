import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Store } from '../src/store.mjs';
import { backupData, recoverDeadWriter } from '../src/data-maintenance.mjs';
import { APP_ROOT, readBuildInfo } from '../src/build-info.mjs';
import { createCandidate } from '../src/distribution.mjs';
import { hash } from '../src/common.mjs';

const code = (expected) => (error) => error.code === expected;
async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-install-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('explicit recovery refuses a live writer and preserves its lock', async (t) => {
  const directory = await temporary(t);
  const store = new Store(directory);
  const lock = await store.acquireLock();
  await assert.rejects(recoverDeadWriter(directory), code('WRITER_STILL_RUNNING'));
  assert.equal(JSON.parse(await fs.readFile(path.join(directory, '.writer.lock'))).id, lock.id);
  await store.releaseLock();
});

test('actual crashed process requires explicit recovery; restarted store retains cross-task hold', async (t) => {
  const directory = await temporary(t);
  const child = fork(fileURLToPath(new URL('./fixture-writer.mjs', import.meta.url)), [directory], {
    silent: true,
    windowsHide: true,
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const [message] = await once(child, 'message');
  const exited = once(child, 'exit');
  child.kill('SIGKILL'); // Only this test's own disposable child, not an application session.
  await exited;
  const reopened = new Store(directory);
  await assert.rejects(reopened.acquireLock(), code('DATA_DIRECTORY_LOCKED'));
  const before = await fs.readFile(path.join(reopened.dir(message.task), 'state.json'));
  const result = await recoverDeadWriter(directory);
  assert.equal(result.status, 'RECOVERED');
  assert.deepEqual(await fs.readFile(path.join(reopened.dir(message.task), 'state.json')), before);
  const archived = JSON.parse(await fs.readFile(result.archive));
  assert.equal(archived.owner.id, message.lock.id);
  await reopened.acquireLock();
  await reopened.recoverInterrupted();
  const item = (await reopened.read(message.task)).cases[0];
  assert.equal(item.status, 'INTERRUPTED');
  assert.equal(item.cleanup_required, true);
  assert.equal((await reopened.cleanupBlockers('http://crash-fixture.test/another')).length, 1);
  assert.equal((await reopened.cleanupBlockers('http://other-fixture.test/app')).length, 0);
  await reopened.releaseLock();
});

test('unverifiable lock and incomplete maintenance refuse startup or recovery', async (t) => {
  const directory = await temporary(t);
  const lock = path.join(directory, '.writer.lock');
  await fs.writeFile(lock, '{broken');
  await assert.rejects(recoverDeadWriter(directory), code('WRITER_OWNER_UNVERIFIED'));
  assert.equal(await fs.readFile(lock, 'utf8'), '{broken');
  await fs.writeFile(path.join(directory, '.maintenance.lock'), '{}');
  await assert.rejects(new Store(directory).acquireLock(), code('DATA_MAINTENANCE_ACTIVE'));
  await assert.rejects(recoverDeadWriter(directory), code('DATA_MAINTENANCE_ACTIVE'));
});

test('stopped backup preserves content hashes and cleanup history; active or nested backup is refused', async (t) => {
  const directory = await temporary(t);
  const data = path.join(directory, 'data');
  const store = new Store(data);
  await store.acquireLock();
  const marker = Buffer.from('待清理与历史事实不得被重写');
  await fs.writeFile(path.join(data, 'historical-fact.json'), marker);
  await assert.rejects(
    backupData(data, path.join(directory, 'active-copy')),
    code('BACKUP_REQUIRES_STOP'),
  );
  await store.releaseLock();
  await assert.rejects(
    backupData(data, path.join(data, 'nested')),
    code('BACKUP_INSIDE_DATA_DIRECTORY'),
  );
  const destination = path.join(directory, 'snapshot');
  await backupData(data, destination);
  const manifest = JSON.parse(await fs.readFile(path.join(destination, 'backup-manifest.json')));
  assert.deepEqual(manifest.files, [{ file: 'historical-fact.json', sha256: hash(marker) }]);
  assert.deepEqual(
    await fs.readFile(path.join(destination, 'data', 'historical-fact.json')),
    marker,
  );
  await assert.rejects(backupData(data, destination), { code: 'EEXIST' });
});

test('candidate is allowlisted, has the same build, and excludes private data and paused optimization', async (t) => {
  const directory = await temporary(t);
  const source = path.join(directory, 'source');
  await fs.mkdir(source);
  // First create a clean source using the actual distribution list, then inject excluded material.
  const clean = path.join(directory, 'clean');
  await createCandidate(clean);
  await fs.cp(clean, source, { recursive: true });
  for (const name of [
    'data/private.json',
    'optimization/fixture-secret.json',
    'scripts/governance.py',
    '.env',
  ]) {
    await fs.mkdir(path.dirname(path.join(source, name)), { recursive: true });
    await fs.writeFile(path.join(source, name), 'SYNTHETIC_PRIVATE_CANARY');
  }
  const target = path.join(directory, 'candidate');
  const result = await createCandidate(target, source);
  assert.equal(result.build_id, (await readBuildInfo(APP_ROOT)).build_id);
  assert.equal(result.release_status, 'PENDING_ACCEPTANCE');
  for (const file of result.files) {
    assert.doesNotMatch(file.file, /^(?:data|optimization|scripts|tests|validation|\.env)(?:\/|$)/);
    const bytes = await fs.readFile(path.join(target, file.file));
    assert.equal(hash(bytes), file.sha256);
    assert.equal(bytes.includes(Buffer.from('SYNTHETIC_PRIVATE_CANARY')), false);
  }
  await assert.rejects(createCandidate(target), { code: 'EEXIST' });
});
