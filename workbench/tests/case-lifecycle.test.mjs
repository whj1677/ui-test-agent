import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { changeCaseLifecycle } from '../server/cases/lifecycle.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { createWorkbenchServer } from '../server/app.mjs';
import { openCaseLifecycle } from '../web-v2/case-lifecycle.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-lifecycle-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CaseLibraryStore(root); await store.init();
  const manager = new CaseLibraryManager(store);
  let project = await manager.createProject({ name: '合成删除验证' });
  project = await store.updateProject(project.project_id, project.revision, p => {
    p.cases = [1, 2].map(n => {
      const content = { external_id: `QA-${n}`, title: `合成用例 ${n}`, case_type: 'UI', status: 'CONFIRMED', steps: [{ order: 1, action: '读取合成值', expected: '显示合成值' }] };
      return { case_id: `case-synthetic-${n}`, external_id: content.external_id, title: content.title, module: '', status: content.status,
        current_version: 2, versions: [1, 2].map(version => ({ version, content: structuredClone(content), content_sha256: contentHash(content) })),
        root_source: { stable_id: `synthetic:${n}` }, lineage: [{ change: 'IMPORT' }], script_packages: [{ frozen: `script-${n}` }] };
    }); return p;
  });
  const body = (p = project, ids = p.cases.map(c => c.case_id), restore = false) => ({ revision: p.revision,
    [restore ? 'confirm_restore' : 'confirm_delete']: true, items: ids.map(id => {
      const item = [...p.cases, ...(p.deleted_cases || [])].find(c => c.case_id === id);
      return { case_id: id, case_version: item.current_version, content_sha256: item.versions.at(-1).content_sha256 };
    }) });
  return { root, store, manager, project, body };
}

test('delete/restore persists complete original identities, versions, script metadata and untouched files', async t => {
  const { root, store, manager, project, body } = await fixture(t);
  const evidence = path.join(root, 'existing-script-and-run.json');
  await fs.writeFile(evidence, '{"script":"original","run":"original"}');
  const before = await fs.readFile(evidence);
  const removed = await changeCaseLifecycle(store, project.project_id, body(project, [project.cases[0].case_id]));
  assert.deepEqual(removed.cases, [project.cases[1]]);
  const { deletion, ...original } = removed.deleted_cases[0];
  assert.ok(Number.isFinite(Date.parse(deletion.deleted_at)));
  assert.deepEqual(original, project.cases[0]);
  const pkg = await manager.exportPackage(project.project_id);
  assert.equal(pkg.cases.length, 1);
  assert.equal(pkg.cases[0].content.external_id, 'QA-2');
  const restarted = new CaseLibraryStore(root);
  assert.deepEqual(await restarted.getProject(project.project_id), removed);
  const restored = await changeCaseLifecycle(restarted, project.project_id, body(removed, [original.case_id], true), { restore: true });
  assert.deepEqual(restored.cases.find(c => c.case_id === original.case_id), project.cases[0]);
  assert.deepEqual(restored.deleted_cases, []);
  assert.deepEqual(await fs.readFile(evidence), before);
});

test('invalid confirmation, duplicate selection, stale version/hash/revision and foreign cases reject atomically', async t => {
  const { store, project, body } = await fixture(t);
  const good = body();
  const invalid = [ { ...good, confirm_delete: false }, { ...good, items: [] }, { ...good, items: [good.items[0],good.items[0]] },
    { ...good, revision: 0 }, { ...good, items: [good.items[0], { ...good.items[1], case_version: 1 }] },
    { ...good, items: [good.items[0], { ...good.items[1], content_sha256: '0'.repeat(64) }] },
    { ...good, items: [good.items[0], { ...good.items[1], case_id: 'case-other-project' }] } ];
  for (const request of invalid) {
    await assert.rejects(changeCaseLifecycle(store, project.project_id, request));
    assert.deepEqual(await store.getProject(project.project_id), project);
  }
  const results = await Promise.allSettled([changeCaseLifecycle(store, project.project_id, good), changeCaseLifecycle(store, project.project_id, good)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const removed = await store.getProject(project.project_id);
  assert.equal(removed.cases.length, 0); assert.equal(removed.deleted_cases.length, 2);
  await assert.rejects(changeCaseLifecycle(store, project.project_id, { ...body(removed, removed.deleted_cases.map(c => c.case_id), true), confirm_restore: false }, { restore: true }));
  assert.deepEqual(await store.getProject(project.project_id), removed);
});

// Exercise the actual server request handler without listening on another port.
function request(server, url, body, origin = 'http://127.0.0.1:4322', method = 'POST') {
  return new Promise(resolve => {
    const req = Readable.from([Buffer.from(JSON.stringify(body || {}))]);
    Object.assign(req, { method, url, headers: { host: '127.0.0.1:4322', origin, 'content-type': 'application/json' } });
    const res = new EventEmitter();
    res.writeHead = code => { res.statusCode = code; };
    res.end = bytes => { res.emit('finish'); resolve({ status: res.statusCode, data: JSON.parse(bytes || '{}') }); };
    server.emit('request', req, res);
  });
}

test('actual route rejects foreign origins, active/starting tasks and stale restores', async t => {
  const { store, manager, project, body } = await fixture(t);
  const task = {};
  const server = createWorkbenchServer({ caseStore: store, caseManager: manager, buildManager: task });
  const url = `/api/case-library/projects/${project.project_id}/cases/delete`;
  assert.equal((await request(server, url, body(), 'https://other.invalid')).status, 403);
  for (const flag of ['active','starting','generationOwner','generationStarting','generationBatchActive','storageFault','shutdownRequested']) {
    task[flag] = true;
    assert.equal((await request(server, url, body())).status, flag === 'storageFault' ? 503 : 409);
    delete task[flag];
    assert.deepEqual(await store.getProject(project.project_id), project);
  }
  const removed = await request(server, url, body());
  assert.equal(removed.status, 200); assert.equal(removed.data.cases.length, 0);
  const restoreUrl = url.replace(/delete$/, 'restore');
  assert.equal((await request(server, restoreUrl, body(project, project.cases.map(c => c.case_id), true))).status, 409);
  const restored = await request(server, restoreUrl, body(removed.data, removed.data.deleted_cases.map(c => c.case_id), true));
  assert.equal(restored.status, 200); assert.deepEqual(restored.data.cases, project.cases);
});

test('lifecycle write closes mutation admission while allowing reads, then releases the guard', async t => {
  const { store, manager, project, body } = await fixture(t);
  const original = store.updateProject.bind(store);
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const paused = new Promise(resolve => { release = resolve; });
  store.updateProject = async (...args) => { entered(); await paused; return original(...args); };
  const server = createWorkbenchServer({ caseStore: store, caseManager: manager });
  const deleting = request(server, `/api/case-library/projects/${project.project_id}/cases/delete`, body());
  await started;
  assert.equal((await request(server, '/api/case-library/projects', { name: 'must not create' })).status, 409);
  assert.equal((await request(server, `/api/case-library/projects/${project.project_id}`, null, undefined, 'GET')).status, 200);
  release(); assert.equal((await deleting).status, 200);
  assert.equal((await request(server, '/api/case-library/projects', { name: 'after guard' })).status, 201);
});

test('UI cancellation is inert and confirmation freezes exact displayed selection and revision', async t => {
  const { project } = await fixture(t);
  let modal; const calls = [];
  openCaseLifecycle({ project, ids: [project.cases[0].case_id], openModal: value => { modal = value; },
    mutate: async (url, body) => { calls.push({ url, body }); return { updated: true }; }, jsonOptions: x => x,
    onChanged: value => calls.push(value) });
  assert.equal(calls.length, 0); assert.match(modal.body, /可随时恢复/); assert.match(modal.body, /QA-1/); assert.doesNotMatch(modal.body, /QA-2/);
  await modal.onConfirm(() => calls.push('closed'));
  assert.equal(calls[0].body.confirm_delete, true); assert.equal(calls[0].body.revision, project.revision);
  assert.deepEqual(calls[0].body.items.map(x => x.case_id), [project.cases[0].case_id]);
  assert.deepEqual(calls.slice(1), ['closed', { updated: true }]);
});
