import path from 'node:path';
import { BuildTaskStore, M2C_REVALIDATION_AUTHORIZATION_ID } from './build/store.mjs';
import { createPaths } from './paths.mjs';

const localRoot = path.resolve(
  process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'),
);
const paths = createPaths({ localRoot });
const store = new BuildTaskStore(paths.buildTasksRoot);
await store.init();
const record = await store.registerRevalidationAuthorization({
  schema: 'workbench/build-revalidation-authorization-v1',
  authorization_id: M2C_REVALIDATION_AUTHORIZATION_ID,
  purpose: 'M2-C diagnostic revision single real Web initial revalidation',
  kind: 'initial',
  max_starts: 1,
  used_starts: 0,
  claims: [],
  linked_stage: { phase: 'M2-C', historical_used_starts: 1, historical_max_starts: 2 },
  reviewed_baseline: 'a0da137fb8e262d093f1e8e7fab95f629af8c1bc',
  previous_task_id: 'build-20260921030548-a1bf1358',
  authorized_at: new Date().toISOString(),
});
console.log(JSON.stringify({
  authorization_id: record.authorization_id,
  kind: record.kind,
  used_starts: record.used_starts,
  max_starts: record.max_starts,
  previous_task_id: record.previous_task_id,
}));
