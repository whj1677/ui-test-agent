import path from 'node:path';
import { BuildTaskStore, M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID } from './build/store.mjs';
import { BuildRevalidationStore } from './build/revalidations.mjs';
import { createPaths } from './paths.mjs';

const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const paths = createPaths({ localRoot });
const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID });
await buildStore.init();
const revalidations = new BuildRevalidationStore(paths.buildRevalidationsRoot, buildStore);
await revalidations.init();
const record = await revalidations.register('candidate-runtime-fix-20260921');
console.log(JSON.stringify({ registered: true, idempotent_key: record.validation_id, source_task_id: record.source_task_id, candidate_sha256: record.candidate_sha256 }));
