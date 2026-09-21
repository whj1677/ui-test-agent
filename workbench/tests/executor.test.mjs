import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, test } from 'node:test';
import { WorkbenchRunManager } from '../server/executor.mjs';
import { createPaths } from '../server/paths.mjs';
import { buildApprovedAsset } from '../server/registry.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const roots = [];
class FakeChild extends EventEmitter {
  constructor(pid = 43210) {
    super();
    this.pid = pid;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
  }
}

async function harness(overrides = {}) {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-executor-'));
  roots.push(localRoot);
  const paths = createPaths({ localRoot });
  const store = new WorkbenchStore(paths.dataRoot);
  await store.init();
  const asset = await buildApprovedAsset(paths, { registeredAt: '2026-09-20T00:00:00.000Z' });
  await store.registerAsset(overrides.asset || asset);
  const calls = [];
  const children = [];
  const manager = new WorkbenchRunManager({
    store, paths,
    idFactory: overrides.idFactory || (() => `run-${String(children.length + 1).padStart(8, '0')}`),
    verifySite: overrides.verifySite || (async () => ({ site: 'heldout-lab', version: 1 })),
    spawnProcess: overrides.spawnProcess || ((command, args, options) => {
      calls.push({ command, args, options });
      const child = new FakeChild(43210 + children.length);
      children.push(child);
      return child;
    }),
    killTree: overrides.killTree || (async () => {}),
  });
  return { asset, calls, children, manager, paths, store };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('approved run uses fixed argument arrays and a reduced environment', async () => {
  const { asset, calls, children, manager, store } = await harness();
  process.env.OPENAI_API_KEY = 'must-not-leak';
  process.env.COOKIE = 'must-not-leak';
  const started = await manager.start(asset.asset_id, 'normal');
  assert.equal(started.execution_status, 'RUNNING');
  assert.equal(calls[0].options.shell, false);
  assert.deepEqual(calls[0].args.slice(-2), ['--workers=1', '--retries=0']);
  assert.equal(calls[0].options.env.PILOT_ENTRY_URL, 'http://localhost:4198/probe/s1');
  assert.equal(calls[0].options.env.OPENAI_API_KEY, undefined);
  assert.equal(calls[0].options.env.COOKIE, undefined);
  assert.equal(started.integrity.runtime_sha256, asset.script.sha256);
  children[0].emit('exit', 0, null);
  const finished = await manager.waitFor(started.run_id);
  assert.equal(finished.execution_status, 'PROCESS_ENDED');
  assert.equal(finished.process.exit_code, 0);
  assert.equal(finished.integrity.source_after_sha256, asset.script.sha256);
  assert.equal((await store.listRuns()).length, 1);
  delete process.env.OPENAI_API_KEY;
  delete process.env.COOKIE;
});

test('duplicate starts are rejected and stop targets only the owned process', async () => {
  const killed = [];
  const setup = await harness({ killTree: async (pid) => killed.push(pid) });
  const first = await setup.manager.start(setup.asset.asset_id, 'fault');
  await assert.rejects(setup.manager.start(setup.asset.asset_id, 'fault'), /RUN_ALREADY_ACTIVE/);
  const stopping = await setup.manager.stop(first.run_id);
  assert.equal(stopping.execution_status, 'STOPPING');
  assert.deepEqual(killed, [setup.children[0].pid]);
  setup.children[0].emit('exit', 1, null);
  const finished = await setup.manager.waitFor(first.run_id);
  assert.equal(finished.execution_status, 'CANCELLED');
  await assert.rejects(setup.manager.stop(first.run_id), /RUN_NOT_ACTIVE_OR_NOT_OWNED/);
});

test('unapproved, wrong-hash, traversal and illegal environment records are refused', async () => {
  const pendingSetup = await harness({ asset: { ...(await buildApprovedAsset(createPaths())), asset_id: 'pending-asset', approval_status: 'PENDING' } });
  await assert.rejects(pendingSetup.manager.start('pending-asset', 'normal'), /ASSET_NOT_APPROVED/);

  const wrongHashSetup = await harness({ asset: { ...(await buildApprovedAsset(createPaths())), asset_id: 'wrong-hash', script: { ...(await buildApprovedAsset(createPaths())).script, sha256: '0'.repeat(64) } } });
  await assert.rejects(wrongHashSetup.manager.start('wrong-hash', 'normal'), /APPROVED_SCRIPT_HASH_MISMATCH/);

  const traversalSetup = await harness({ asset: { ...(await buildApprovedAsset(createPaths())), asset_id: 'traversal-asset', script: { ...(await buildApprovedAsset(createPaths())).script, path: '../outside.ts' } } });
  await assert.rejects(traversalSetup.manager.start('traversal-asset', 'normal'), /PATH_OUTSIDE_ROOT/);

  const validSetup = await harness();
  await assert.rejects(validSetup.manager.start(validSetup.asset.asset_id, 'other'), /ENVIRONMENT_NOT_ALLOWED/);
});

test('runtime-copy integrity failure preserves the raw passing report but blocks overall pass', async () => {
  const setup = await harness();
  const started = await setup.manager.start(setup.asset.asset_id, 'normal');
  const runRoot = setup.store.runDirectory(started.run_id);
  const report = {
    suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{
      status: 'passed', steps: started.steps.map((step) => ({ title: step.step_id })),
    }] }] }] }],
    stats: { expected: 1, unexpected: 0, skipped: 0 },
  };
  await fs.writeFile(path.join(runRoot, 'report.json'), JSON.stringify(report));
  await fs.appendFile(path.join(runRoot, 'runtime', 'tests', 'sorting.spec.ts'), '\n// simulated runtime-copy change\n');
  setup.children[0].emit('exit', 0, null);
  const finished = await setup.manager.waitFor(started.run_id);
  assert.equal(finished.execution_status, 'INTEGRITY_FAILED');
  assert.equal(finished.test_status, 'PASSED');
  assert.equal(finished.summary.playwright_pass, true);
  assert.equal(finished.summary.complete_pass, false);
  assert.equal(finished.error.code, 'SCRIPT_HASH_CHANGED');
  assert.equal(finished.integrity.source_after_sha256, setup.asset.script.sha256);
  assert.notEqual(finished.integrity.runtime_after_sha256, setup.asset.script.sha256);
});
