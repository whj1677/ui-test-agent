import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createWorkbenchServer } from '../server/app.mjs';
import { sha256File } from '../server/integrity.mjs';

let server;
let baseUrl;
let root;
const calls = [];
const taskId = 'build-api-12345678';
const taskRoot = () => path.join(root, taskId);
const task = {
  task_id: taskId,
  files: [],
};
const buildStore = {
  async getBudget() { return { schema: 'workbench/build-stage-budget-v1', phase: 'M2-C', max_starts: 2, used_starts: 0, claims: [] }; },
  async listTasks() { return [task]; },
  async getTask(id) { return id === taskId ? task : null; },
  taskDirectory(id) { assert.equal(id, taskId); return taskRoot(); },
};
const buildManager = {
  active: null,
  async templates() { return [{ template_id: 'synthetic-probe-v1' }]; },
  async submit(templateId) { calls.push(['submit', templateId]); return task; },
  async start(id) { calls.push(['start', id]); return task; },
  async revise(id) { calls.push(['revise', id]); return task; },
  async stop(id) { calls.push(['stop', id]); return task; },
};
const store = { async listAssets() { return []; }, async listRuns() { return []; } };

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-build-api-'));
  await fs.mkdir(taskRoot(), { recursive: true });
  server = createWorkbenchServer({ store, manager: { active: null }, buildStore, buildManager });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
});

async function post(route, body, origin = baseUrl) {
  return fetch(`${baseUrl}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
  });
}

test('build mutations require local origin and exact fixed schemas', async () => {
  assert.equal((await post('/api/build/tasks', { template_id: 'synthetic-probe-v1' }, 'https://example.invalid')).status, 403);
  assert.equal((await post('/api/build/tasks', { template_id: 'synthetic-probe-v1', path: 'C:\\' })).status, 400);
  assert.equal((await post('/api/build/tasks', { template_id: 'synthetic-probe-v1' })).status, 201);
  assert.deepEqual(calls.at(-1), ['submit', 'synthetic-probe-v1']);

  for (const action of ['start', 'revise', 'stop']) {
    assert.equal((await post(`/api/build/tasks/${taskId}/${action}`, { command: 'whoami' })).status, 400);
    assert.equal((await post(`/api/build/tasks/${taskId}/${action}`, {})).status, 202);
    assert.deepEqual(calls.at(-1), [action, taskId]);
  }
});

test('only registered web-visible unchanged task files are served', async () => {
  const candidate = path.join(taskRoot(), 'candidate.spec.mjs');
  const privateLog = path.join(taskRoot(), 'private.log');
  await fs.writeFile(candidate, 'export const marker = "safe";\n');
  await fs.writeFile(privateLog, 'private tool event\n');
  const candidateStat = await fs.stat(candidate);
  const privateStat = await fs.stat(privateLog);
  task.files = [
    { file_id: 'candidate', relative_path: 'candidate.spec.mjs', bytes: candidateStat.size, sha256: await sha256File(candidate), content_type: 'text/javascript; charset=utf-8', web_visible: true },
    { file_id: 'tool-log', relative_path: 'private.log', bytes: privateStat.size, sha256: await sha256File(privateLog), content_type: 'text/plain; charset=utf-8', web_visible: false },
  ];

  const visible = await fetch(`${baseUrl}/api/build/tasks/${taskId}/files/candidate`);
  assert.equal(visible.status, 200);
  assert.match(await visible.text(), /marker/);
  assert.equal((await fetch(`${baseUrl}/api/build/tasks/${taskId}/files/tool-log`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/build/tasks/${taskId}/files/not-registered`)).status, 404);

  await fs.appendFile(candidate, '// changed\n');
  assert.equal((await fetch(`${baseUrl}/api/build/tasks/${taskId}/files/candidate`)).status, 409);
});
