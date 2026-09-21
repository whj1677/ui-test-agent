import { createWorkbenchServer } from './app.mjs';
import { createPaths } from './paths.mjs';
import { WorkbenchStore } from './store.mjs';
import { WorkbenchRunManager } from './executor.mjs';
import { BuildTaskStore } from './build/store.mjs';
import { BuildTaskManager } from './build/manager.mjs';
import { BuildRevalidationStore } from './build/revalidations.mjs';
import { CaseLibraryStore } from './cases/store.mjs';
import { CaseLibraryManager } from './cases/manager.mjs';
import { randomUUID } from 'node:crypto';

const host = '127.0.0.1';
const port = Number(process.env.WORKBENCH_PORT || 4210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_WORKBENCH_PORT');

const paths = createPaths();
const serviceInstanceId = `service-${randomUUID()}`;
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const recovered = await store.recoverInterrupted();
const manager = new WorkbenchRunManager({ store, paths });
const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: process.env.M2C_BUILD_AUTHORIZATION_ID });
await buildStore.init();
const buildRevalidationStore = new BuildRevalidationStore(paths.buildRevalidationsRoot, buildStore);
await buildRevalidationStore.init();
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
await caseStore.init();
const caseManager = new CaseLibraryManager(caseStore);
const recoveredBuilds = await buildStore.recoverInterrupted(new Date().toISOString(), serviceInstanceId);
const buildManager = new BuildTaskManager({
  store: buildStore,
  caseStore,
  paths,
  serviceInstanceId,
  authorizationId: process.env.M2C_BUILD_AUTHORIZATION_ID || null,
  browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
  otherActive: () => Boolean(manager.active),
});
const server = createWorkbenchServer({ store, manager, buildStore, buildManager, buildRevalidationStore, caseStore, caseManager });
server.listen(port, host, () => {
  console.log(`Approved test workbench http://${host}:${port}`);
  if (recovered.length) console.log(`Recovered interrupted runs: ${recovered.join(', ')}`);
  if (recoveredBuilds.length) console.log(`Recovered interrupted build tasks: ${recoveredBuilds.join(', ')}`);
});

let shutdownStarted = false;
async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(JSON.stringify({ type: 'service_shutdown_requested', service_instance_id: serviceInstanceId, signal }));
  if (buildManager.active) await buildManager.stop(buildManager.active.taskId).catch((error) => {
    console.error(JSON.stringify({ type: 'build_stop_failed', code: error?.code || error?.message || 'UNKNOWN' }));
  });
  const drained = await Promise.race([
    buildManager.settle().then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!drained) console.error(JSON.stringify({ type: 'build_settlement_timeout', service_instance_id: serviceInstanceId }));
  await new Promise((resolve) => server.close(resolve));
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
