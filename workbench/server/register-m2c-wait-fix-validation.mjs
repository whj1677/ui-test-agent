import path from 'node:path';
import {
  BuildTaskStore,
  M2C_REVALIDATION_AUTHORIZATION_ID,
  M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
} from './build/store.mjs';
import { createPaths } from './paths.mjs';

const localRoot = path.resolve(
  process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'),
);
const paths = createPaths({ localRoot });
const historicalStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_REVALIDATION_AUTHORIZATION_ID });
const store = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID });
await historicalStore.init();
await store.init();

const previousAuthorization = await historicalStore.getRevalidationAuthorization();
const previousTask = await historicalStore.getTask('build-20260921041411-12b52a7b');
if (previousAuthorization?.used_starts !== 1 || previousTask?.task_status !== 'CANCELLED') {
  throw new Error('BUILD_WAIT_FIX_VALIDATION_BASELINE_MISMATCH');
}

const record = await store.registerRevalidationAuthorization({
  schema: 'workbench/build-revalidation-authorization-v1',
  authorization_id: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
  purpose: 'M2-C terminal-wait-fix single real Web initial validation',
  kind: 'initial',
  max_starts: 1,
  used_starts: 0,
  claims: [],
  linked_stage: { phase: 'M2-C', historical_used_starts: 1, historical_max_starts: 2 },
  reviewed_baseline: 'b7a34c22bfb9401fb88c59a6af5a51561ba1299e',
  previous_task_id: 'build-20260921041411-12b52a7b',
  authorized_at: new Date().toISOString(),
});
console.log(JSON.stringify({
  authorization_id: record.authorization_id,
  kind: record.kind,
  used_starts: record.used_starts,
  max_starts: record.max_starts,
  previous_task_id: record.previous_task_id,
}));
