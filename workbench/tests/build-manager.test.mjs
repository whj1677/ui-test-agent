import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildTaskManager } from '../server/build/manager.mjs';
import {
  BuildTaskStore,
  M2C_REVALIDATION_AUTHORIZATION_ID,
  M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
} from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';

function playwrightReport(status, error = null) {
  return { stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status, error }] }] }] }] };
}

function fakeAdapter({ cancellation = false, emitSpawn = false } = {}) {
  let harnessStarts = 0;
  let lastPatchPath = null;
  return {
    get harnessStarts() { return harnessStarts; },
    get lastPatchPath() { return lastPatchPath; },
    async ensureHarnessRuntime() { return { ready: true }; },
    async startFixtureServer(file) { return { url: file.endsWith('wrong-output.html') ? 'http://127.0.0.1/negative' : 'http://127.0.0.1/normal', async close() {} }; },
    async runHarnessTask({ candidatePath, workspace, signal, onLifecycle, patchPath }) {
      harnessStarts += 1;
      lastPatchPath = patchPath;
      if (emitSpawn) await onLifecycle({ type: 'process_spawn', pid: 4321, parent_pid: process.pid, at: new Date().toISOString() });
      if (cancellation) {
        if (!signal.aborted) await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        return {
          assessment: { success: false, termination: 'cancelled' }, candidate: null, events: [],
          process: { pid: 1234, parentPid: process.pid, exitCode: 1, signal: null, termination: 'cancelled', exitObserved: true, closeObserved: true, outputComplete: true, observerError: null },
        };
      }
      await fs.mkdir(path.dirname(candidatePath), { recursive: true });
      await fs.mkdir(path.join(workspace, '.playwright-mcp'), { recursive: true });
      await fs.writeFile(path.join(workspace, '.playwright-mcp', 'page.yml'), 'synthetic');
      const locator = harnessStarts === 1 ? "locator('status')" : "locator('#probe-result')";
      const code = `import { test, expect } from '@playwright/test';\ntest('probe', async ({ page }) => { await page.goto(process.env.PROBE_URL); await page.getByRole('button', { name: '执行探针交互' }).click(); await expect(page.${locator}).toHaveText('PROBE-42'); });\n`;
      await fs.writeFile(candidatePath, code);
      return {
        assessment: { success: true, completed: true, candidateExists: true, exitCode: 0, termination: null, finalPresent: true, turnEndReason: 'completed', toolCalls: 2, maxToolCalls: 30, toolLimitReached: false },
        candidate: { sha256: 'generated' },
        events: [{ type: 'status', phase: 'step_end' }, { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' }, { type: 'tool_call', tool: 'write_file' }],
        process: { pid: 1234, parentPid: process.pid, exitCode: 0, signal: null, termination: null, exitObserved: true, closeObserved: true, outputComplete: true, observerError: null },
      };
    },
    async verifyCandidate({ fixtureUrl, runDirectory }) {
      await fs.mkdir(runDirectory, { recursive: true });
      let report;
      if (harnessStarts === 1) report = playwrightReport('failed', { message: "expect(locator('status')).toHaveText('PROBE-42') timed out; locator resolved to 0 elements" });
      else if (fixtureUrl.endsWith('/normal')) report = playwrightReport('passed');
      else report = playwrightReport('failed', { message: 'Expected string: "PROBE-42"\nReceived string: "PROBE-41"' });
      const reportPath = path.join(runDirectory, 'playwright-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report));
      const passed = harnessStarts > 1 && fixtureUrl.endsWith('/normal');
      return { reportPath, process: { exitCode: passed ? 0 : 1, termination: null, error: null } };
    },
  };
}

async function setup(adapter, managerOptions = {}) {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'build-manager-'));
  const paths = createPaths({ localRoot });
  const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
  const manager = new BuildTaskManager({ store, paths, adapter, browserExecutable: 'fake-browser', credentialProvider: () => ({ apiKey: 'synthetic-key', baseUrl: 'https://model.invalid' }), idFactory: () => 'build-manager-12345678', ...managerOptions });
  return { localRoot, store, manager };
}

test('failed candidate enables exactly one explicit revision and preserves both versions', async () => {
  const adapter = fakeAdapter();
  const { localRoot, store, manager } = await setup(adapter);
  try {
    const task = await manager.submit('synthetic-probe-v1');
    await manager.start(task.task_id);
    let result = await manager.wait(task.task_id);
    assert.equal(result.task_status, 'CANDIDATE_VALIDATION_FAILED');
    assert.equal(result.revision_allowed, true);
    assert.equal(result.candidates.length, 1);
    await manager.revise(task.task_id);
    result = await manager.wait(task.task_id);
    assert.equal(result.task_status, 'WAITING_HUMAN_REVIEW');
    assert.equal(result.verification_status, 'PASSED');
    assert.equal(result.human_review_status, 'WAITING_REVIEW');
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[1].counterexample_detected, true);
    assert.equal(result.candidates[1].same_candidate_hash, true);
    assert.equal(adapter.harnessStarts, 2);
    await assert.rejects(() => manager.revise(task.task_id), /BUILD_REVISION_NOT_ALLOWED/);
    assert.equal((await store.getBudget()).used_starts, 2);
    const lifecycle = await store.lifecycleSummary(task.task_id, 'attempt-02-revision');
    assert.ok(lifecycle.event_count >= 4);
  } finally { await manager.settle(); await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('relative Harness patch resolves before task workspace changes', async () => {
  const adapter = fakeAdapter();
  const configured = path.join('..', 'harness-probe', 'config', 'browser-flash.cordis.yml');
  const { localRoot, manager } = await setup(adapter, { harnessPatchPath: configured });
  try {
    const task = await manager.submit('synthetic-probe-v1');
    await manager.start(task.task_id);
    await manager.wait(task.task_id);
    assert.equal(adapter.lastPatchPath, path.resolve(configured));
    assert.equal(path.isAbsolute(adapter.lastPatchPath), true);
  } finally { await manager.settle(); await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('生命周期存储持续失败会降级服务并拒绝继续接纳建例', async () => {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'build-manager-storage-fail-'));
  const paths = createPaths({ localRoot });
  try {
    const initial = new BuildTaskStore(paths.buildTasksRoot); await initial.init();
    const appendFile = async () => { const error = new Error('synthetic disk failure'); error.code = 'EIO'; throw error; };
    const store = new BuildTaskStore(paths.buildTasksRoot, { appendFile });
    const manager = new BuildTaskManager({
      store, paths, adapter: fakeAdapter(), browserExecutable: 'fake-browser',
      credentialProvider: () => ({ apiKey: 'synthetic-key', baseUrl: 'https://model.invalid' }),
      idFactory: () => 'build-storage-12345678',
    });
    const task = await manager.submit('synthetic-probe-v1');
    await assert.rejects(() => manager.start(task.task_id), /BUILD_DIAGNOSTIC_STORAGE_FAILED/);
    assert.equal(manager.diagnostics().storage_status, 'FAILED');
    await assert.rejects(() => manager.submit('synthetic-probe-v1'), /BUILD_STORAGE_UNAVAILABLE/);
    assert.equal((await store.getTask(task.task_id)).task_status, 'FAILED');
  } finally { await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('后台completion最终状态持续写失败会被观察并关闭新建例入口', async () => {
  const adapter = fakeAdapter();
  const { localRoot, store, manager } = await setup(adapter);
  const updateTask = store.updateTask.bind(store);
  let updates = 0;
  store.updateTask = async (...args) => {
    updates += 1;
    if (updates >= 2) { const error = new Error('synthetic persistent task write failure'); error.code = 'EIO'; throw error; }
    return updateTask(...args);
  };
  try {
    const task = await manager.submit('synthetic-probe-v1');
    await manager.start(task.task_id);
    await assert.rejects(() => manager.wait(task.task_id), /synthetic persistent task write failure/);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(manager.diagnostics().storage_status, 'FAILED');
    await assert.rejects(() => manager.submit('synthetic-probe-v1'), /BUILD_STORAGE_UNAVAILABLE/);
    assert.equal((await store.getTask(task.task_id)).task_status, 'GENERATING');
  } finally { await manager.settle(); await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('duplicate start is rejected and cancel closes the owned attempt without restart', async () => {
  const adapter = fakeAdapter({ cancellation: true });
  const { localRoot, manager } = await setup(adapter);
  try {
    const task = await manager.submit('synthetic-probe-v1');
    await manager.start(task.task_id);
    await assert.rejects(() => manager.start(task.task_id), /BUILD_TASK_ALREADY_ACTIVE/);
    await manager.stop(task.task_id);
    const result = await manager.wait(task.task_id);
    assert.equal(result.task_status, 'CANCELLED');
    assert.equal(result.verification_status, 'NOT_RUN');
    assert.equal(adapter.harnessStarts, 1);
  } finally { await manager.settle(); await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('单次复验授权只在Harness进程启动事件时消耗且不改旧预算', async () => {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'build-manager-revalidation-'));
  const paths = createPaths({ localRoot });
  const store = new BuildTaskStore(paths.buildTasksRoot); await store.init();
  await store.claimStart('build-old-12345678', 'attempt-01-initial', '2026-09-21T00:00:00Z');
  await store.registerRevalidationAuthorization({
    schema: 'workbench/build-revalidation-authorization-v1', authorization_id: M2C_REVALIDATION_AUTHORIZATION_ID,
    kind: 'initial', max_starts: 1, used_starts: 0, claims: [], linked_stage: { phase: 'M2-C', historical_used_starts: 1, historical_max_starts: 2 },
  });
  const manager = new BuildTaskManager({
    store, paths, adapter: fakeAdapter({ emitSpawn: true }), browserExecutable: 'fake-browser',
    authorizationId: M2C_REVALIDATION_AUTHORIZATION_ID,
    credentialProvider: () => ({ apiKey: 'synthetic-key', baseUrl: 'https://model.invalid' }),
    idFactory: () => 'build-revalidation-12345678',
  });
  try {
    const task = await manager.submit('synthetic-probe-v1');
    assert.equal(task.authorization.used_starts, 0);
    await manager.start(task.task_id);
    const result = await manager.wait(task.task_id);
    assert.equal(result.attempts[0].authorization_status, 'CONSUMED_ON_PROCESS_SPAWN');
    assert.equal(result.authorization.used_starts, 1);
    assert.equal(result.revision_allowed, false);
    assert.equal((await store.getBudget()).used_starts, 1);
    assert.equal((await store.getRevalidationAuthorization()).claims[0].trigger, 'harness_process_spawn');
    await assert.rejects(() => manager.submit('synthetic-probe-v1'), /BUILD_REVALIDATION_AUTHORIZATION_UNAVAILABLE/);
  } finally { await manager.settle(); await fs.rm(localRoot, { recursive: true, force: true }); }
});

test('终态等待修复验证使用独立固定授权文件且不改旧授权', async () => {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'build-manager-wait-fix-authorization-'));
  const paths = createPaths({ localRoot });
  const historicalStore = new BuildTaskStore(paths.buildTasksRoot); await historicalStore.init();
  await historicalStore.claimStart('build-old-12345678', 'attempt-01-initial', '2026-09-21T00:00:00Z');
  await historicalStore.registerRevalidationAuthorization({
    schema: 'workbench/build-revalidation-authorization-v1', authorization_id: M2C_REVALIDATION_AUTHORIZATION_ID,
    kind: 'initial', max_starts: 1, used_starts: 0, claims: [], linked_stage: { phase: 'M2-C', historical_used_starts: 1, historical_max_starts: 2 },
  });
  await historicalStore.claimRevalidationStart(
    M2C_REVALIDATION_AUTHORIZATION_ID, 'build-cancelled-12345678', 'attempt-01-initial', '2026-09-21T00:01:00Z',
  );
  const store = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID });
  await store.init();
  await store.registerRevalidationAuthorization({
    schema: 'workbench/build-revalidation-authorization-v1', authorization_id: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
    kind: 'initial', max_starts: 1, used_starts: 0, claims: [], linked_stage: { phase: 'M2-C', historical_used_starts: 1, historical_max_starts: 2 },
  });
  try {
    assert.equal((await historicalStore.getRevalidationAuthorization()).used_starts, 1);
    assert.equal((await store.getRevalidationAuthorization()).used_starts, 0);
    await store.claimRevalidationStart(
      M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID, 'build-wait-fix-12345678', 'attempt-01-initial', '2026-09-21T00:02:00Z',
    );
    assert.equal((await store.getRevalidationAuthorization()).used_starts, 1);
    assert.equal((await historicalStore.getRevalidationAuthorization()).claims[0].task_id, 'build-cancelled-12345678');
    assert.equal((await historicalStore.getBudget()).used_starts, 1);
  } finally { await fs.rm(localRoot, { recursive: true, force: true }); }
});
