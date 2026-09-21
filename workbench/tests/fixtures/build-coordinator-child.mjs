import { BuildTaskStore } from '../../server/build/store.mjs';

const [root, taskId] = process.argv.slice(2);
const attemptId = 'attempt-01-initial';
const store = new BuildTaskStore(root);
await store.init();
await store.createTask({
  schema: 'workbench/build-task-v1', task_id: taskId, created_at: new Date().toISOString(),
  task_status: 'GENERATING', generation_status: 'RUNNING', verification_status: 'NOT_STARTED',
  human_review_status: 'NOT_READY', active_attempt_id: attemptId,
  attempts: [{ attempt_id: attemptId, status: 'RUNNING', finished_at: null, observation: { complete: false }, error: null }],
  candidates: [], files: [], revision_allowed: false,
});
await store.claimStart(taskId, attemptId, new Date().toISOString());
await store.appendLifecycle(taskId, attemptId, {
  schema: 'workbench/build-lifecycle-event-v1', sequence: 1, at: new Date().toISOString(),
  task_id: taskId, attempt_id: attemptId, service_instance_id: 'service-killed-fixture',
  type: 'process_spawn', pid: process.pid, parent_pid: process.ppid, partial_observation: true,
});
console.log('READY');
setInterval(() => {}, 1000);
