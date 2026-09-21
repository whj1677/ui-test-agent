import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildTaskStore } from '../server/build/store.mjs';

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
