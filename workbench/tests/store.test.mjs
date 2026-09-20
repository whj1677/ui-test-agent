import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { WorkbenchStore } from '../server/store.mjs';

const temporaryRoots = [];
async function temporaryStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-store-'));
  temporaryRoots.push(root);
  const store = new WorkbenchStore(root);
  await store.init();
  return { root, store };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('asset registration is persistent and idempotent', async () => {
  const { root, store } = await temporaryStore();
  const asset = { schema: 'approved-workbench/asset-v1', asset_id: 'asset-12345678', registered_at: '2026-09-20T00:00:00.000Z' };
  assert.equal((await store.registerAsset(asset)).created, true);
  assert.equal((await store.registerAsset({ ...asset, registered_at: 'later' })).created, false);
  const reopened = new WorkbenchStore(root);
  await reopened.init();
  assert.deepEqual((await reopened.listAssets()).map((item) => item.asset_id), ['asset-12345678']);
  await assert.rejects(
    store.registerAsset({ ...asset, schema: 'changed', registered_at: 'later' }),
    /ASSET_ID_CONFLICT/,
  );
});

test('runs remain readable and active records become interrupted after restart', async () => {
  const { root, store } = await temporaryStore();
  const run = {
    schema: 'approved-workbench/run-v1', run_id: 'run-12345678', created_at: '2026-09-20T01:00:00.000Z',
    execution_status: 'RUNNING', process: { pid: 999, state: 'RUNNING' }, evidence_status: 'PENDING',
  };
  await store.createRun(run);
  const reopened = new WorkbenchStore(root);
  await reopened.init();
  assert.deepEqual(await reopened.recoverInterrupted('2026-09-20T02:00:00.000Z'), ['run-12345678']);
  const recovered = await reopened.getRun('run-12345678');
  assert.equal(recovered.execution_status, 'INTERRUPTED');
  assert.equal(recovered.process.pid, null);
  assert.equal(recovered.error.code, 'SERVICE_RESTARTED');
  assert.equal((await reopened.listRuns()).length, 1);
});

test('run ids cannot escape the data root', async () => {
  const { store } = await temporaryStore();
  await assert.rejects(store.createRun({ run_id: '../outside' }), /INVALID_RUN_ID/);
  await assert.rejects(store.getRun('..\\outside'), /INVALID_RUN_ID/);
});
