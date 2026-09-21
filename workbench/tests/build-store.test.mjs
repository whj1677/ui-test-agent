import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildTaskStore } from '../server/build/store.mjs';
import { runOwnedProcess } from '../../harness-probe/src/process-control.mjs';
import { fileURLToPath } from 'node:url';

const coordinatorFixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'build-coordinator-child.mjs');

test('M2-C stage budget persists across task ids and store restarts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-store-'));
  try {
    let store = new BuildTaskStore(root); await store.init();
    await store.claimStart('build-one-12345678', 'attempt-01-initial', '2026-09-21T00:00:00Z');
    store = new BuildTaskStore(root); await store.init();
    await store.claimStart('build-two-12345678', 'attempt-01-initial', '2026-09-21T00:01:00Z');
    await assert.rejects(() => store.claimStart('build-three-12345678', 'attempt-01-initial', '2026-09-21T00:02:00Z'), /BUILD_STAGE_BUDGET_EXHAUSTED/);
    const budget = await store.getBudget();
    assert.equal(budget.used_starts, 2);
    assert.equal(budget.claims.length, 2);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('restart marks active build interrupted without replaying it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-recover-'));
  try {
    const store = new BuildTaskStore(root); await store.init();
    await store.createTask({
      task_id: 'build-active-12345678', created_at: '2026-09-21', task_status: 'GENERATING',
      generation_status: 'RUNNING', verification_status: 'NOT_STARTED', human_review_status: 'NOT_READY',
      active_attempt_id: 'attempt-01-initial',
      attempts: [{ attempt_id: 'attempt-01-initial', status: 'RUNNING', finished_at: null, error: null }],
    });
    assert.deepEqual(await store.recoverInterrupted('2026-09-21T01:00:00Z'), ['build-active-12345678']);
    const task = await store.getTask('build-active-12345678');
    assert.equal(task.task_status, 'INTERRUPTED');
    assert.equal(task.generation_status, 'INTERRUPTED');
    assert.equal(task.active_attempt_id, null);
    assert.equal(task.attempts[0].status, 'INTERRUPTED');
    assert.equal(task.attempts[0].finished_at, '2026-09-21T01:00:00Z');
    assert.equal(task.attempts[0].error.code, 'SERVICE_RESTARTED');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('task状态原子替换的短暂占用有限重试后成功', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-store-retry-'));
  try {
    const normal = new BuildTaskStore(root); await normal.init();
    await normal.createTask({ task_id: 'build-retry-12345678', task_status: 'SUBMITTED' });
    let failures = 0;
    const io = { ...fs, rename: async (...args) => {
      if (failures < 2) { failures += 1; const error = new Error('busy'); error.code = 'EBUSY'; throw error; }
      return fs.rename(...args);
    } };
    const store = new BuildTaskStore(root, { io });
    const updated = await store.updateTask('build-retry-12345678', (task) => ({ ...task, task_status: 'FAILED' }));
    assert.equal(updated.task_status, 'FAILED');
    assert.equal(failures, 2);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('task状态持续写失败会显式返回错误而非静默成功', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-store-fail-'));
  try {
    const normal = new BuildTaskStore(root); await normal.init();
    await normal.createTask({ task_id: 'build-fail-12345678', task_status: 'SUBMITTED' });
    let attempts = 0;
    const io = { ...fs, rename: async () => { attempts += 1; const error = new Error('locked'); error.code = 'EACCES'; throw error; } };
    const store = new BuildTaskStore(root, { io });
    await assert.rejects(() => store.updateTask('build-fail-12345678', (task) => ({ ...task, task_status: 'FAILED' })), /locked/);
    assert.equal(attempts, 8);
    assert.equal((await normal.getTask('build-fail-12345678')).task_status, 'SUBMITTED');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('协调进程被终止后重启保留逐事件记录、标中断且不重放预算', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-killed-'));
  const taskId = 'build-killed-12345678';
  try {
    const controller = new AbortController();
    const child = await runOwnedProcess(process.execPath, [coordinatorFixture, root, taskId], {
      timeoutMs: 5_000,
      signal: controller.signal,
      onStdoutLine: (line) => { if (line === 'READY') controller.abort('fixture_killed'); },
    });
    assert.equal(child.termination, 'fixture_killed');
    const restarted = new BuildTaskStore(root); await restarted.init();
    assert.deepEqual(await restarted.recoverInterrupted('2026-09-21T08:00:00Z', 'service-after-restart'), [taskId]);
    const task = await restarted.getTask(taskId);
    assert.equal(task.task_status, 'INTERRUPTED');
    assert.equal(task.attempts[0].error.cause, 'UNKNOWN');
    assert.equal(task.attempts[0].observation.recovery.event_count, 1);
    assert.equal((await restarted.getBudget()).used_starts, 1);
    const summary = await restarted.lifecycleSummary(taskId, 'attempt-01-initial');
    assert.equal(summary.event_count, 2);
    assert.equal(summary.last_event.type, 'recovered_interrupted');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
