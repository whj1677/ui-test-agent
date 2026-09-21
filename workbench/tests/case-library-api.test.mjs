import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

test('case library API requires local origin and serves only registered operations', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-api-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const caseStore = new CaseLibraryStore(root); await caseStore.init(); const caseManager = new CaseLibraryManager(caseStore);
  const server = createWorkbenchServer({ caseStore, caseManager }); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`; const headers = { origin: base, 'content-type': 'application/json' };
  let response = await fetch(`${base}/api/case-library/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '拒绝', description: '' }) });
  assert.equal(response.status, 403);
  response = await fetch(`${base}/api/case-library/projects`, { method: 'POST', headers, body: JSON.stringify({ name: '接口项目', description: '中文' }) });
  assert.equal(response.status, 201); const project = await response.json();
  assert.equal((await (await fetch(`${base}/api/case-library/projects/${project.project_id}`)).json()).name, '接口项目');
  response = await fetch(`${base}/api/case-library/projects/../../etc`); assert.equal(response.status, 404);
  response = await fetch(`${base}/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx`); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /spreadsheetml/); assert.ok((await response.arrayBuffer()).byteLength > 1000);
});
