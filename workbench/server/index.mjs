import { createWorkbenchServer } from './app.mjs';
import { createPaths } from './paths.mjs';
import { WorkbenchStore } from './store.mjs';
import { WorkbenchRunManager } from './executor.mjs';

const host = '127.0.0.1';
const port = Number(process.env.WORKBENCH_PORT || 4210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_WORKBENCH_PORT');

const paths = createPaths();
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const recovered = await store.recoverInterrupted();
const manager = new WorkbenchRunManager({ store, paths });
const server = createWorkbenchServer({ store, manager });
server.listen(port, host, () => {
  console.log(`Approved test workbench http://${host}:${port}`);
  if (recovered.length) console.log(`Recovered interrupted runs: ${recovered.join(', ')}`);
});
