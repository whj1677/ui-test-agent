import { createWorkbenchServer } from './app.mjs';
import { createPaths } from './paths.mjs';
import { WorkbenchStore } from './store.mjs';
import { WorkbenchRunManager } from './executor.mjs';
import { BuildTaskStore } from './build/store.mjs';
import { BuildTaskManager } from './build/manager.mjs';

const host = '127.0.0.1';
const port = Number(process.env.WORKBENCH_PORT || 4210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_WORKBENCH_PORT');

const paths = createPaths();
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const recovered = await store.recoverInterrupted();
const manager = new WorkbenchRunManager({ store, paths });
const buildStore = new BuildTaskStore(paths.buildTasksRoot);
await buildStore.init();
const recoveredBuilds = await buildStore.recoverInterrupted();
const buildManager = new BuildTaskManager({
  store: buildStore,
  paths,
  browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
  otherActive: () => Boolean(manager.active),
});
const server = createWorkbenchServer({ store, manager, buildStore, buildManager });
server.listen(port, host, () => {
  console.log(`Approved test workbench http://${host}:${port}`);
  if (recovered.length) console.log(`Recovered interrupted runs: ${recovered.join(', ')}`);
  if (recoveredBuilds.length) console.log(`Recovered interrupted build tasks: ${recoveredBuilds.join(', ')}`);
});

async function shutdown() {
  if (buildManager.active) await buildManager.stop(buildManager.active.taskId).catch(() => {});
  server.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
