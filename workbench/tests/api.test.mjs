import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorkbenchServer } from '../server/app.mjs';

let server;
let baseUrl;
const calls = [];
const manager = {
  active: null,
  async start(assetId, environment) {
    calls.push(['start', assetId, environment]);
    return { run_id: 'run-api-12345678', execution_status: 'RUNNING' };
  },
  async stop(runId) {
    calls.push(['stop', runId]);
    return { run_id: runId, execution_status: 'STOPPING' };
  },
};
const store = {
  async listAssets() { return []; }, async getAsset() { return null; }, async listRuns() { return []; }, async getRun() { return null; },
};

before(async () => {
  server = createWorkbenchServer({ store, manager });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise((resolve) => server.close(resolve)));

test('state changes require exact local origin and JSON schema', async () => {
  const rejected = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.invalid' },
    body: JSON.stringify({ asset_id: 'a', environment: 'normal' }),
  });
  assert.equal(rejected.status, 403);
  const accepted = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify({ asset_id: 'a', environment: 'normal' }),
  });
  assert.equal(accepted.status, 202);
  assert.deepEqual(calls.at(-1), ['start', 'a', 'normal']);
  const extra = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify({ asset_id: 'a', environment: 'normal', command: 'whoami' }),
  });
  assert.equal(extra.status, 400);
});

test('stop route accepts only an empty JSON object from local origin', async () => {
  const response = await fetch(`${baseUrl}/api/runs/run-api-12345678/stop`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: '{}',
  });
  assert.equal(response.status, 202);
  assert.deepEqual(calls.at(-1), ['stop', 'run-api-12345678']);
});
