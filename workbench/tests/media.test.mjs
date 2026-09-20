import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createWorkbenchServer } from '../server/app.mjs';
import { sha256File } from '../server/integrity.mjs';
import { WorkbenchStore } from '../server/store.mjs';

let root;
let store;
let server;
let baseUrl;
const runId = 'run-media-12345678';

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-media-'));
  store = new WorkbenchStore(root);
  await store.init();
  await store.createRun({ run_id: runId, created_at: '2026-09-20T00:00:00.000Z', media: [] });
  const artifact = path.join(store.runDirectory(runId), 'artifacts', 'shot.png');
  await fs.mkdir(path.dirname(artifact), { recursive: true });
  await fs.writeFile(artifact, 'safe-image-bytes');
  const artifactSha = await sha256File(artifact);
  await store.updateRun(runId, (run) => ({ ...run, media: [{
    media_id: 'media-001', kind: 'screenshot', content_type: 'image/png', file_name: 'shot.png',
    relative_path: 'artifacts/shot.png', sha256: artifactSha, bytes: 16,
  }] }));
  server = createWorkbenchServer({ store });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
});

test('only indexed media for the selected run can be read', async () => {
  const response = await fetch(`${baseUrl}/api/runs/${runId}/media/media-001`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'safe-image-bytes');
  assert.equal(response.headers.get('content-type'), 'image/png');
  const unknown = await fetch(`${baseUrl}/api/runs/${runId}/media/media-999`);
  assert.equal(unknown.status, 404);
  const traversal = await fetch(`${baseUrl}/api/runs/${runId}/media/${encodeURIComponent('../run.json')}`);
  assert.notEqual(traversal.status, 200);
});

test('changed media bytes are not served as the registered attachment', async () => {
  const artifact = path.join(store.runDirectory(runId), 'artifacts', 'shot.png');
  await fs.writeFile(artifact, 'different-bytes!');
  const response = await fetch(`${baseUrl}/api/runs/${runId}/media/media-001`);
  assert.equal(response.status, 409);
});
