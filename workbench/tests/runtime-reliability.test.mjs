import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { stopCandidateTrial, submitCandidateTrial } from '../server/build/candidate-trials.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';
import { BatchManager } from '../server/batches.mjs';
import { writeAtomicJson } from '../server/atomic-json.mjs';

function manager() {
  return new BuildTaskManager({ paths: { buildRuntimeRoot: os.tmpdir(), repoRoot: os.tmpdir() },
    otherActive: () => false });
}

test('terminal candidate trial stop is idempotent while active cleanup is pending', async () => {
  const m = manager();
  const controller = new AbortController();
  m.active = { runId: 'trial-done', controller };
  const terminal = { run_id: 'trial-done', execution_status: 'FINISHED' };
  let writes = 0;
  m.runStore = { getRun: async () => terminal, updateRun: async () => { writes++; throw Error('unexpected write'); } };
  assert.equal(await stopCandidateTrial(m, 'trial-done'), terminal);
  assert.equal(await stopCandidateTrial(m, 'trial-done'), terminal);
  assert.equal(writes, 0);
  assert.equal(controller.signal.aborted, false);
});

test('queued stop updater cannot turn a concurrent terminal write back into STOPPING', async () => {
  const m = manager();
  const controller = new AbortController();
  m.active = { runId: 'trial-race', controller };
  let stored = { run_id: 'trial-race', execution_status: 'RUNNING' };
  m.runStore = {
    getRun: async () => structuredClone(stored),
    updateRun: async (_id, updater) => {
      stored = { ...stored, execution_status: 'FINISHED' }; // terminal save wins before stop's queued updater
      stored = updater(structuredClone(stored));
      return structuredClone(stored);
    },
  };
  const result = await stopCandidateTrial(m, 'trial-race');
  assert.equal(result.execution_status, 'FINISHED');
  assert.equal(stored.execution_status, 'FINISHED');
  assert.equal(controller.signal.aborted, false);
});

test('stop queued behind a pending terminal write preserves FINISHED', async () => {
  const m = manager();
  const controller = new AbortController();
  m.active = { runId: 'trial-pending', controller };
  let stored = { run_id: 'trial-pending', execution_status: 'RUNNING' };
  let releaseFinal, finalEntered;
  const finalGate = new Promise(resolve => { releaseFinal = resolve; });
  const entered = new Promise(resolve => { finalEntered = resolve; });
  let queue = Promise.resolve();
  m.runStore = {
    getRun: async () => structuredClone(stored),
    updateRun: (_id, updater) => {
      const pending = queue.then(async () => {
        const next = updater(structuredClone(stored));
        if (next.execution_status === 'FINISHED') { finalEntered(); await finalGate; }
        stored = next;
        return structuredClone(stored);
      });
      queue = pending.catch(() => {});
      return pending;
    },
  };
  const finalWrite = m.runStore.updateRun('trial-pending', r => ({ ...r, execution_status: 'FINISHED' }));
  await entered;
  const stop = stopCandidateTrial(m, 'trial-pending');
  releaseFinal();
  await finalWrite;
  assert.equal((await stop).execution_status, 'FINISHED');
  assert.equal(stored.execution_status, 'FINISHED');
  assert.equal(controller.signal.aborted, false);
});

test('candidate stop persistence failure degrades manager and rejects new work', async () => {
  const m = manager();
  const controller = new AbortController();
  m.active = { runId: 'trial-write', controller };
  m.runStore = { getRun: async () => ({ run_id: 'trial-write', execution_status: 'RUNNING' }),
    updateRun: async () => { const error = Error('disk unavailable'); error.code = 'EIO'; throw error; } };
  await assert.rejects(stopCandidateTrial(m, 'trial-write'), /disk unavailable/);
  assert.equal(m.diagnostics().storage_status, 'FAILED');
  assert.equal(m.diagnostics().storage_error.code, 'EIO');
  assert.equal(controller.signal.aborted, true);
  assert.throws(() => m.assertStorageWritable(), /BUILD_STORAGE_UNAVAILABLE/);
});

test('candidate stop read failure still aborts the captured owned task', async () => {
  const m = manager();
  const controller = new AbortController();
  m.active = { runId: 'trial-read', controller };
  m.runStore = { getRun: async () => { const error = Error('read failed'); error.code = 'EIO'; throw error; } };
  await assert.rejects(stopCandidateTrial(m, 'trial-read'), /read failed/);
  assert.equal(controller.signal.aborted, true);
  assert.equal(m.diagnostics().storage_error.operation, 'trial_stop_read');
});

test('candidate stop never aborts a replacement active task', async () => {
  const m = manager();
  const original = { runId: 'trial-old', controller: new AbortController() };
  const replacement = { runId: 'trial-new', controller: new AbortController() };
  m.active = original;
  m.runStore = {
    getRun: async () => ({ run_id: 'trial-old', execution_status: 'RUNNING' }),
    updateRun: async (_id, updater) => {
      m.active = replacement;
      const result = updater({ run_id: 'trial-old', execution_status: 'RUNNING' });
      assert.equal(result.execution_status, 'RUNNING');
      const error = Error('write failed'); error.code = 'EIO'; throw error;
    },
  };
  await assert.rejects(stopCandidateTrial(m, 'trial-old'), /write failed/);
  assert.equal(original.controller.signal.aborted, false);
  assert.equal(replacement.controller.signal.aborted, false);
  assert.equal(m.diagnostics().storage_error.operation, 'trial_stop_update');
});

test('script and batch reserve mutually exclusive preparation windows', async () => {
  const m = manager();
  const scripts = new ScriptOperations({ root: os.tmpdir(), buildManager: m });
  const batches = new BatchManager({ root: os.tmpdir(), buildManager: m });
  let releaseScript;
  scripts.list = () => new Promise(resolve => { releaseScript = resolve; });
  const scriptStart = scripts.start('project', { request_id: 'request-12345678' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(scripts.starting, true);
  await assert.rejects(batches.start('batch-id', 'project', { request_id: 'request-87654321' }), /BATCH_EXECUTOR_BUSY/);
  releaseScript([]);
  scripts.preflight = async () => { throw Error('test stop'); };
  await assert.rejects(scriptStart, /test stop/);
  assert.equal(scripts.starting, false);

  let releaseBatch;
  batches.get = () => new Promise(resolve => { releaseBatch = resolve; });
  const batchStart = batches.start('batch-id', 'project', { request_id: 'request-87654321' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(batches.starting, true);
  await assert.rejects(scripts.start('project', { request_id: 'request-12345678' }), /BUILD_TASK_ALREADY_ACTIVE/);
  releaseBatch({ state: 'INVALID', items: [] });
  await assert.rejects(batchStart, /BATCH_REQUEST_INVALID/);
  assert.equal(batches.starting, false);
});

test('script and batch persistence failures report storage fault', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-reliability-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const m = manager();
  const unusable = path.join(root, 'unusable-root');
  await fs.writeFile(unusable, 'file blocks mkdir');
  const scripts = new ScriptOperations({ root: unusable, buildManager: m });
  await assert.rejects(scripts.save({ operation_id: 'generation-12345678-1234-1234-1234-123456789abc' }));
  assert.equal(m.diagnostics().storage_status, 'FAILED');
  await assert.rejects(scripts.start('project', { request_id: 'request-12345678' }), /BUILD_STORAGE_UNAVAILABLE/);

  const n = manager();
  const batches = new BatchManager({ root: unusable, buildManager: n });
  await assert.rejects(batches.save({ batch_id: 'batch-12345678-1234-1234-1234-123456789abc' }));
  assert.equal(n.diagnostics().storage_status, 'FAILED');
  await assert.rejects(batches.start('batch-id', 'project', { request_id: 'request-87654321' }), /BUILD_STORAGE_UNAVAILABLE/);
});

test('batch and script save retry a transient Windows rename error without degrading', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-retry-success-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const kind of ['batch', 'script']) {
    const m = manager();
    const directory = path.join(root, kind);
    const value = kind === 'batch'
      ? { batch_id: 'batch-12345678-1234-1234-1234-123456789abc', state: 'QUEUED' }
      : { operation_id: 'generation-12345678-1234-1234-1234-123456789abc', state: 'QUEUED' };
    let renames = 0;
    const delays = [];
    const io = { mkdir: fs.mkdir, writeFile: fs.writeFile, rm: fs.rm,
      rename: async (from, to) => {
        if (++renames === 1) { const error = Error('transient lock'); error.code = 'EPERM'; throw error; }
        await fs.rename(from, to);
      } };
    const atomicJson = (file, record) => writeAtomicJson(file, record, io, async ms => { delays.push(ms); });
    const operation = kind === 'batch'
      ? new BatchManager({ root: directory, buildManager: m, atomicJson })
      : new ScriptOperations({ root: directory, buildManager: m, atomicJson });
    await operation.save(value);
    assert.equal(renames, 2);
    assert.deepEqual(delays, [20]);
    assert.equal(m.diagnostics().storage_status, 'READY');
    const files = await fs.readdir(directory);
    assert.deepEqual(files, [kind === 'batch' ? `${value.batch_id}.json` : `${value.operation_id}.json`]);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, files[0]), 'utf8')), value);
  }
});

test('batch and script save exhaust rename retries, preserve old JSON, and lock storage', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-retry-failure-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const kind of ['batch', 'script']) {
    const m = manager();
    const directory = path.join(root, kind);
    await fs.mkdir(directory);
    const id = kind === 'batch' ? 'batch-12345678-1234-1234-1234-123456789abc'
      : 'generation-12345678-1234-1234-1234-123456789abc';
    const key = kind === 'batch' ? 'batch_id' : 'operation_id';
    const target = path.join(directory, `${id}.json`);
    await fs.writeFile(target, JSON.stringify({ [key]: id, state: 'PREVIEW' }));
    let renames = 0;
    const delays = [];
    const io = { mkdir: fs.mkdir, writeFile: fs.writeFile, rm: fs.rm,
      rename: async () => { renames++; const error = Error('persistent lock'); error.code = 'EPERM'; throw error; } };
    const atomicJson = (file, record) => writeAtomicJson(file, record, io, async ms => { delays.push(ms); });
    const operation = kind === 'batch'
      ? new BatchManager({ root: directory, buildManager: m, atomicJson })
      : new ScriptOperations({ root: directory, buildManager: m, atomicJson });
    await assert.rejects(operation.save({ [key]: id, state: 'FINISHED' }), /persistent lock/);
    assert.equal(renames, 8);
    assert.deepEqual(delays, [20, 40, 60, 80, 100, 120, 140]);
    assert.equal(m.diagnostics().storage_status, 'FAILED');
    assert.equal(m.diagnostics().storage_error.code, 'EPERM');
    assert.equal(JSON.parse(await fs.readFile(target, 'utf8')).state, 'PREVIEW');
    assert.deepEqual(await fs.readdir(directory), [`${id}.json`]);
    assert.throws(() => m.assertStorageWritable(), /BUILD_STORAGE_UNAVAILABLE/);
  }
});

test('background terminal write failure remains visible as degraded without a false FINISHED state', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'trial-terminal-fault-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const final = path.join(root, 'build-source', 'development', 'final');
  await fs.mkdir(final, { recursive: true });
  await fs.writeFile(path.join(final, 'candidate.spec.mjs'), '// frozen candidate');
  const bundle = await developmentBundle(final, { validate: false });
  const content = { external_id: 'UNIT', title: 'unit', status: 'CONFIRMED', steps: [{ order: 1, action: 'observe', expected: 'yes' }] };
  const request = { project_id: 'project-unit', case_id: 'case-unit', case_version: 1,
    content_sha256: contentHash(content), source_task_id: 'build-source', candidate_version: 1,
    bundle_sha256: bundle.sha256, environment_id: 'unit-env', lane: 'normal', request_id: 'request-terminal-fault' };
  const task = { task_id: 'build-source', source: request, environment_ref: { environment_id: 'unit-env' },
    active_attempt_id: null, development: { submission: { bundle } }, files: [],
    candidates: [{ version: 1, sha256: bundle.files.find(f => f.path === 'candidate.spec.mjs').sha256, bundle }] };
  const m = manager();
  m.store = { getTask: async () => task, taskDirectory: () => path.join(root, 'build-source') };
  m.caseStore = { getProject: async () => ({ cases: [{ case_id: 'case-unit', versions: [{ version: 1, content, content_sha256: request.content_sha256 }] }] }) };
  m.candidateTrialAuthorizations = [{ ...request, lanes: ['normal'] }];
  m.candidateTrialEnvironments = [{ id: 'unit-env', check: async () => {}, acquire: async () => ({ identity: {}, url: 'http://127.0.0.1:1', release: async () => {} }) }];
  m.adapter = { verifyCandidate: async () => { throw Error('ENGINE_FAIL'); } };
  let stored = null;
  m.runStore = {
    runDirectory: id => path.join(root, id),
    getRun: async () => stored && structuredClone(stored),
    createRun: async run => { stored = structuredClone(run); return structuredClone(run); },
    updateRun: async (_id, updater) => {
      const next = updater(structuredClone(stored));
      if (next.execution_status === 'FINISHED') { const error = Error('terminal write failed'); error.code = 'EIO'; throw error; }
      stored = next;
      return structuredClone(next);
    },
  };
  const receipt = await submitCandidateTrial(m, request);
  await assert.rejects(m.completions.get(receipt.run_id), /terminal write failed/);
  assert.equal(m.diagnostics().storage_status, 'FAILED');
  assert.equal(m.diagnostics().storage_error.operation, 'trial_result_update');
  assert.equal(stored.execution_status, 'RUNNING');
  assert.equal(stored.technical_error.code, 'ENGINE_FAIL');
  assert.throws(() => m.assertStorageWritable(), /BUILD_STORAGE_UNAVAILABLE/);
});
