import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Called only after the owned process, its observer callbacks, fixture cleanup,
// and accepted cancellation requests have drained. No later attempt writes.
export async function finalizeLifecycle(store, taskId, attemptId) {
  await store.serial(async () => {});
  const bytes = await fs.readFile(store.lifecycleFile(taskId, attemptId));
  const summary = await store.lifecycleSummary(taskId, attemptId);
  const sha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  return store.updateTask(taskId, (task) => ({
    ...task,
    files: task.files.map((file) => file.attempt_id === attemptId && file.kind === 'lifecycle_log'
      ? { ...file, bytes: bytes.length, sha256, integrity_state: 'FINALIZED' } : file),
    attempts: task.attempts.map((attempt) => attempt.attempt_id === attemptId
      ? { ...attempt, observation: { ...attempt.observation, summary } } : attempt),
  }));
}
