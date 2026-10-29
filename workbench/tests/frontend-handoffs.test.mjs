import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FrontendHandoffs, frontendHandoffRoute } from '../server/frontend-handoffs.mjs';
import { FRONTEND_HANDOFF_SCHEMA, sourceSnapshotHash } from '../server/frontend-handoff-contract.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { frontendHandoffsHtml } from '../web-v2/frontend-handoffs.js';

function document(revision = 'v1', module = { name: '电价管理', aliases: ['电价模板'] }) {
  const files = [{ path: 'src/views/prices.vue', sha256: 'a'.repeat(64), line_count: 100 }];
  const source_refs = [{ path: files[0].path, start_line: 1, end_line: 20 }];
  return { schema: FRONTEND_HANDOFF_SCHEMA, package_id: `export-${revision}`, created_at: '2026-10-14T00:00:00.000Z', module,
    source: { revision, files, snapshot_sha256: sourceSnapshotHash(files) },
    pages: [{ id: 'template', name: '电价模板', entry_paths: ['/prices/template'], source_refs,
      controls: [{ id: 'create', purpose: '打开新增弹窗', locator_candidates: [{ strategy: 'role', role: 'button', value: '新增', evidence: 'source-derived' }], source_refs, notes: [] }],
      waits: [{ id: 'ready', description: '等待列表加载标记消失', source_refs }], technical_notes: [] }],
    unresolved: [{ topic: '部署版本', reason: '尚未核对部署页面与源码快照是否一致' }] };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'frontend-handoffs-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const caseStore = new CaseLibraryStore(path.join(root, 'cases')); await caseStore.init();
  const projectA = await caseStore.createProject({ name: 'A' }), projectB = await caseStore.createProject({ name: 'B' });
  const manager = new FrontendHandoffs({ root: path.join(root, 'handoffs'), caseStore }); await manager.init();
  return { root, manager, caseStore, a: projectA.project_id, b: projectB.project_id };
}

test('import is project-scoped, validates first, and preserves case content and revision', async t => {
  const { root, manager, caseStore, a, b } = await fixture(t);
  const before = await fs.readFile(path.join(caseStore.projectDirectory(a), 'project.json'), 'utf8');
  const invalid = document(); invalid.source_path = 'C:/private/source';
  await assert.rejects(manager.import(a, { package: invalid }), /PACKAGE_INVALID/);
  assert.deepEqual((await manager.list(a)).handoffs, []);
  const imported = await manager.import(a, { package: document() });
  assert.equal(imported.enabled, true);
  assert.equal((await manager.list(b)).handoffs.length, 0);
  await assert.rejects(manager.getForCase(b, imported.handoff_id, '电价模板'), /NOT_FOUND/);
  await assert.rejects(manager.import('../other', { package: document() }), /PROJECT_ID_INVALID/);
  assert.equal(await fs.readFile(path.join(caseStore.projectDirectory(a), 'project.json'), 'utf8'), before);
  assert.equal((await fs.readdir(path.join(root, 'handoffs', a))).length, 2);
});

test('module and alias matching are exact; explicit off never injects available context', async t => {
  const { manager, a } = await fixture(t);
  const imported = await manager.import(a, { package: document() });
  const context = await manager.resolveForCase(a, '电价模板');
  assert.equal(context.handoff_id, imported.handoff_id);
  assert.ok(Object.isFrozen(context.package.pages[0]));
  assert.equal(await manager.resolveForCase(a, '电价'), null);
  assert.equal(await manager.resolveForCase(a, '电价模板', { disabled: true, handoff_id: imported.handoff_id }), null);
  await assert.rejects(manager.getForCase(a, imported.handoff_id, '其他模块'), /MODULE_MISMATCH/);
});

test('new version activation keeps old immutable context and reactivation history', async t => {
  const { root, manager, a } = await fixture(t);
  const first = await manager.import(a, { package: document('v1') });
  const frozen = await manager.getForCase(a, first.handoff_id, '电价模板');
  const second = await manager.import(a, { package: document('v2') });
  let listed = await manager.list(a);
  assert.deepEqual(listed.handoffs.map(row => row.enabled), [false, true]);
  assert.equal(frozen.package.source.revision, 'v1');
  assert.equal((await manager.getForCase(a, first.handoff_id, '电价模板')).sha256, first.sha256);
  assert.equal((await manager.resolveForCase(a, '电价模板')).handoff_id, second.handoff_id);
  await manager.setEnabled(a, first.handoff_id, true);
  assert.equal((await manager.resolveForCase(a, '电价模板')).handoff_id, first.handoff_id);
  await manager.setEnabled(a, first.handoff_id, false);
  assert.equal(await manager.resolveForCase(a, '电价模板'), null);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'handoffs', a, 'index.json'), 'utf8'));
  assert.equal(saved.imports.length, 2); assert.equal(saved.activations.length, 6);
  assert.equal((await fs.readdir(path.join(root, 'handoffs', a))).length, 3);
});

test('concurrent duplicate imports remain one package and one activation', async t => {
  const { manager, a } = await fixture(t);
  const results = await Promise.all([manager.import(a, { package: document() }), manager.import(a, { package: document() })]);
  assert.equal(results[0].handoff_id, results[1].handoff_id);
  assert.deepEqual(results.map(row => row.idempotent), [false, true]);
  const list = await manager.list(a); assert.equal(list.handoffs.length, 1); assert.equal(list.revision, 1);
});

test('content tampering is detected on list and generation read', async t => {
  const { root, manager, a } = await fixture(t);
  const imported = await manager.import(a, { package: document() });
  await fs.writeFile(path.join(root, 'handoffs', a, `${imported.handoff_id}.json`), JSON.stringify(document('modified')));
  await assert.rejects(manager.list(a), /STORAGE_INVALID/);
  await assert.rejects(manager.getForCase(a, imported.handoff_id, '电价模板'), /STORAGE_INVALID/);
});

test('an ambiguous activated module fails closed instead of selecting a version', async t => {
  const { root, manager, a } = await fixture(t);
  const first = await manager.import(a, { package: document('v1') });
  await manager.import(a, { package: document('v2') });
  const file = path.join(root, 'handoffs', a, 'index.json'), data = JSON.parse(await fs.readFile(file, 'utf8'));
  data.activations.push({ revision: data.activations.length + 1, handoff_id: first.handoff_id, enabled: true });
  await fs.writeFile(file, JSON.stringify(data));
  await assert.rejects(manager.resolveForCase(a, '电价模板'), /MODULE_AMBIGUOUS/);
});

test('route enforces trusted origin, known fields and request size before import', async () => {
  const calls = [], sent = [];
  const options = { request: { method: 'POST' }, response: {}, url: new URL('http://127.0.0.1/api/case-library/projects/project-12345678/frontend-handoffs'),
    manager: { import: async (...args) => { calls.push(args); return { idempotent: false }; } },
    sendJson: (_response, status, body) => sent.push({ status, body }), trustedMutation: () => false,
    readJsonBody: async (_request, limit) => { assert.equal(limit, 512 * 1024); return { package: document() }; } };
  assert.equal(await frontendHandoffRoute(options), true); assert.equal(sent[0].status, 403); assert.equal(calls.length, 0);
  await frontendHandoffRoute({ ...options, trustedMutation: () => true }); assert.equal(sent[1].status, 201); assert.equal(calls.length, 1);
  await assert.rejects(frontendHandoffRoute({ ...options, trustedMutation: () => true,
    url: new URL(`${options.url}/handoff-${'a'.repeat(64)}/enabled`), readJsonBody: async () => ({ enabled: true, extra: true }) }), /REQUEST_INVALID/);
});

test('UI escapes module and unresolved text while showing persisted version and enable control', () => {
  const html = frontendHandoffsHtml({ handoffs: [{ handoff_id: `handoff-${'a'.repeat(64)}`, sha256: 'a'.repeat(64), imported_at: '2026-10-14',
    module: { name: '<module>', aliases: [] }, enabled: true, source_revision: 'v1', page_count: 1, control_count: 1,
    package_id: 'example', unresolved: [{ topic: '<script>', reason: '待核对' }] }] });
  assert.ok(html.includes('&lt;module&gt;')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('停用交接资料')); assert.ok(html.includes('v1')); assert.ok(html.includes('待确认信息（1 项）'));
});
