import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorkbenchServer } from '../server/app.mjs';
import {
  BuildTaskStore,
  M2C_REVALIDATION_AUTHORIZATION_ID,
  M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
} from '../server/build/store.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const paths = createPaths({ localRoot });
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function checkLockedPackages() {
  const expected = new Map([
    ['@deepseek-ai/dsh', '0.1.6-alpha.2'],
    ['@deepseek-ai/dsh-browser-use', '0.1.6-alpha.2'],
    ['@deepseek-ai/dsh-experimental-browser-use-playwright-mcp', '0.1.6-alpha.2'],
  ]);
  for (const [name, version] of expected) {
    const packageFile = path.join(paths.repoRoot, 'harness-probe', 'node_modules', ...name.split('/'), 'package.json');
    const installed = JSON.parse(await fs.readFile(packageFile, 'utf8'));
    assert.equal(installed.version, version, `${name} version changed`);
  }
}

await checkLockedPackages();
await fs.access(browserExecutable);
await fs.mkdir(paths.buildTasksRoot, { recursive: true });
const writeProbe = path.join(paths.buildTasksRoot, `.wait-fix-preflight-${process.pid}.tmp`);
await fs.writeFile(writeProbe, 'write-check', { flag: 'wx' });
await fs.rm(writeProbe);

const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const buildStore = new BuildTaskStore(paths.buildTasksRoot, {
  authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
});
await buildStore.init();
const historicalStore = new BuildTaskStore(paths.buildTasksRoot, {
  authorizationId: M2C_REVALIDATION_AUTHORIZATION_ID,
});
await historicalStore.init();

const authorization = await buildStore.getRevalidationAuthorization();
const previousAuthorization = await historicalStore.getRevalidationAuthorization();
const interruptedTask = await buildStore.getTask('build-20260921030548-a1bf1358');
const cancelledTask = await buildStore.getTask('build-20260921041411-12b52a7b');
const tasks = await buildStore.listTasks();
const activeStates = new Set(['SUBMITTED', 'GENERATING', 'VALIDATING', 'CANCELLING']);
const activeTasks = tasks.filter((task) => activeStates.has(task.task_status));

assert.equal(authorization.authorization_id, M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID);
assert.equal(authorization.used_starts, 0);
assert.equal(authorization.max_starts, 1);
assert.equal(previousAuthorization.used_starts, 1);
assert.equal(interruptedTask.task_status, 'INTERRUPTED');
assert.equal(cancelledTask.task_status, 'CANCELLED');
assert.deepEqual(activeTasks, []);

const runManager = { active: null };
const buildManager = new BuildTaskManager({
  store: buildStore,
  paths,
  authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
  browserExecutable,
  otherActive: () => Boolean(runManager.active),
});
const server = createWorkbenchServer({ store, manager: runManager, buildStore, buildManager });
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
try {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.status, 'ready');
  assert.equal(health.active_build_task_id, null);
  assert.equal(health.build_authorization.authorization_id, M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID);
  assert.equal(health.build_authorization.used_starts, 0);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify({
  status: 'ready',
  authorization_id: authorization.authorization_id,
  authorization: `${authorization.used_starts}/${authorization.max_starts}`,
  active_build_tasks: activeTasks.length,
  locked_harness: 'dsh 0.1.6-alpha.2 + deepseek-v4-pro',
  browser_executable_present: true,
  task_directory_writable: true,
  historical_tasks: {
    interrupted: interruptedTask.task_status,
    cancelled: cancelledTask.task_status,
  },
}));
