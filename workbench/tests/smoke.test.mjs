import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorkbenchServer } from '../server/app.mjs';

let server;
let baseUrl;

before(async () => {
  server = createWorkbenchServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('health endpoint reports the independent workbench', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: 'approved-test-workbench',
    status: 'ready',
    active_run_id: null,
    active_build_task_id: null,
    build_budget: null,
  });
});

test('unknown routes fail closed', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(response.status, 404);
});
