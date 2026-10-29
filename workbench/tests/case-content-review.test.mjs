import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { pendingReviewItems } from '../web-v2/case-review.js';

const headers = ['用例编号', '用例标题', '模块', '前置条件', '测试数据', '测试步骤', '预期结果', '内容状态', '用例层级', '实际结果'];
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const current = item => item.versions.find(version => version.version === item.current_version);

function sample(externalId, changes = {}) {
  return {
    external_id: externalId, title: `核对 ${externalId}`, module: '电价模板',
    preconditions: '使用独立测试园区', test_data: '名称="模板, A"；价格=1.2345',
    steps: '打开模板详情\n点击取消', expected: '显示原模板价格\n模板内容不变化',
    status: '待确认', case_type: 'UI', historical_result: '历史通过，非本次执行', ...changes,
  };
}

async function fixture(t, rows = [sample('UI-1'), sample('API-2', { case_type: 'BACKEND' })]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-content-review-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CaseLibraryStore(root); await store.init();
  const manager = new CaseLibraryManager(store);
  const project = await manager.createProject({ name: '正文核对隔离测试' });
  const csv = '\uFEFF' + [headers, ...rows.map(row => [row.external_id, row.title, row.module,
    row.preconditions, row.test_data, row.steps, row.expected, row.status, row.case_type,
    row.historical_result])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const upload = await manager.upload({ fileName: 'content-review.csv', contentType: 'text/csv', body: Buffer.from(csv) });
  const preview = await manager.preview(project.project_id, { upload_id: upload.upload_id });
  const imported = await manager.confirm(project.project_id, preview.preview_id);
  assert.equal(imported.result.added, rows.length, 'the cases must go through the real CSV import path');
  return { root, store, manager, upload, project: imported.project };
}

function confirmation(project, cases = project.cases) {
  return {
    revision: project.revision, reviewer: '测试核对人', confirm_content: true,
    items: cases.map(item => ({ case_id: item.case_id, case_version: item.current_version,
      content_sha256: current(item).content_sha256 })),
  };
}

async function rejectUnchanged(store, manager, project, body, code) {
  await assert.rejects(() => manager.confirmContents(project.project_id, body), { message: code });
  assert.deepEqual(await store.getProject(project.project_id), project,
    'a rejected group must not change any case, old version, lineage, or project revision');
}

// These states represent persisted requirement drafts or legacy incomplete rows.
// They are created exclusively in the isolated store, never in a live project.
async function changeFixtureContent(store, project, externalId, change) {
  return store.updateProject(project.project_id, project.revision, draft => {
    const item = draft.cases.find(row => row.external_id === externalId);
    const version = current(item);
    change(version.content);
    version.content_sha256 = contentHash(version.content);
    item.status = version.content.status;
    return draft;
  });
}

test('batch content confirmation adds reviewed versions while preserving business text, source and old versions', async t => {
  const { store, manager, project } = await fixture(t);
  const original = structuredClone(project);
  const updated = await manager.confirmContents(project.project_id, {
    ...confirmation(project), reviewer: '  王测试  ',
  });
  assert.equal(updated.revision, original.revision + 1, 'both approvals are one project transaction');
  assert.equal(updated.cases.length, 2);
  assert.deepEqual(updated.imports, original.imports);
  for (const previous of original.cases) {
    const item = updated.cases.find(row => row.case_id === previous.case_id);
    assert.equal(item.current_version, previous.current_version + 1);
    assert.equal(item.status, 'CONFIRMED');
    assert.deepEqual(item.versions.slice(0, -1), previous.versions);
    assert.deepEqual(item.root_source, previous.root_source);
    assert.equal(item.root_source.source_fields['实际结果'], '历史通过，非本次执行');
    assert.equal(item.import_batch_id, previous.import_batch_id);
    assert.equal(item.created_at, previous.created_at);
    assert.deepEqual(item.lineage.slice(0, -1), previous.lineage);
    const version = current(item);
    assert.deepEqual(version.content, { ...current(previous).content, status: 'CONFIRMED' });
    assert.equal(version.content_sha256, contentHash(version.content));
    assert.notEqual(version.content_sha256, current(previous).content_sha256);
    assert.equal(version.source, 'MANUAL_CONFIRMATION');
    assert.equal(version.reviewed_by, '王测试');
    assert.deepEqual(item.lineage.at(-1), {
      project_id: project.project_id, case_id: item.case_id, version: item.current_version,
      change: 'MANUAL_CONFIRMATION', reviewer: '王测试', at: version.created_at,
    });
    assert.equal(item.updated_at, version.created_at);
  }
  assert.deepEqual(await store.getProject(project.project_id), updated);
  assert.deepEqual(project, original, 'the caller snapshot must remain frozen');
});

test('confirmation requires an explicit acknowledgement and a named reviewer without implicit approval', async t => {
  const { store, manager, project } = await fixture(t);
  const body = confirmation(project);
  for (const value of [undefined, false, 'true', 1]) {
    await rejectUnchanged(store, manager, project, { ...body, confirm_content: value }, 'CASE_CONTENT_CONFIRMATION_INVALID');
  }
  for (const reviewer of [undefined, '', '   ', '名'.repeat(101)]) {
    await rejectUnchanged(store, manager, project, { ...body, reviewer }, 'CASE_CONTENT_REVIEWER_REQUIRED');
  }
  await rejectUnchanged(store, manager, project, { ...body, items: [] }, 'CASE_CONTENT_CONFIRMATION_INVALID');
  await rejectUnchanged(store, manager, project, { ...body, items: [body.items[0], body.items[0]] }, 'CASE_CONTENT_CONFIRMATION_INVALID');
});

test('stale project revision, per-case version or hash, and foreign IDs reject the complete group', async t => {
  const { store, manager, upload, project } = await fixture(t);
  const secondProject = await manager.createProject({ name: '其他项目' });
  const otherPreview = await manager.preview(secondProject.project_id, { upload_id: upload.upload_id });
  const other = (await manager.confirm(secondProject.project_id, otherPreview.preview_id)).project;
  const body = confirmation(project);
  await rejectUnchanged(store, manager, project, { ...body, revision: project.revision - 1 }, 'CASE_PROJECT_REVISION_CONFLICT');
  await rejectUnchanged(store, manager, project, {
    ...body, items: [body.items[0], { ...body.items[1], case_version: body.items[1].case_version + 1 }],
  }, 'CASE_CONTENT_REVIEW_CONFLICT');
  await rejectUnchanged(store, manager, project, {
    ...body, items: [body.items[0], { ...body.items[1], content_sha256: '0'.repeat(64) }],
  }, 'CASE_CONTENT_REVIEW_CONFLICT');
  // A real case ID belonging to the first project may never approve it through another project.
  await rejectUnchanged(store, manager, other, {
    ...body, revision: other.revision,
  }, 'CASE_CONTENT_REVIEW_CONFLICT');
  await rejectUnchanged(store, manager, project, {
    ...body, items: [body.items[0], confirmation(other).items[1]],
  }, 'CASE_CONTENT_REVIEW_CONFLICT');
  assert.deepEqual(await store.getProject(other.project_id), other);
  assert.deepEqual(await store.getProject(project.project_id), project);

  // Editing the second case after opening review makes the frozen item stale;
  // even with the newly current project revision, neither selected row is approved.
  const edited = await manager.updateCase(project.project_id, project.cases[1].case_id, {
    revision: project.revision, content: { ...current(project.cases[1]).content, title: '核对后发生实际编辑' },
  });
  await rejectUnchanged(store, manager, edited, { ...body, revision: edited.revision }, 'CASE_CONTENT_REVIEW_CONFLICT');
});

test('one incomplete expected result prevents partial confirmation of otherwise complete rows', async t => {
  const { store, manager, project } = await fixture(t, [
    sample('COMPLETE'), sample('MISSING', { expected: '显示原模板价格\n' }),
  ]);
  assert.equal(current(project.cases[1]).content.steps[1].expected, '');
  await rejectUnchanged(store, manager, project, confirmation(project), 'CASE_CONTENT_REVIEW_INCOMPLETE');
  const onlyComplete = await manager.confirmContents(project.project_id, confirmation(project, [project.cases[0]]));
  assert.equal(onlyComplete.cases[0].status, 'CONFIRMED');
  assert.deepEqual(onlyComplete.cases[1], project.cases[1]);
});

test('requirement drafts, unclassified cases and empty steps stay outside manual batch approval', async t => {
  const { store, manager, project } = await fixture(t, [
    sample('COMPLETE'), sample('DRAFT'), sample('UNTYPED', { case_type: '' }), sample('EMPTY'),
  ]);
  let prepared = await changeFixtureContent(store, project, 'DRAFT', content => {
    content.requirements_origin = { project_id: project.project_id, design_id: 'design-isolated', candidate_id: 'candidate-isolated' };
  });
  prepared = await changeFixtureContent(store, prepared, 'EMPTY', content => { content.steps = []; });
  const complete = prepared.cases.find(row => row.external_id === 'COMPLETE');
  for (const [externalId, code] of [
    ['DRAFT', 'CASE_DESIGN_REVIEW_REQUIRED'], ['UNTYPED', 'CASE_CONTENT_REVIEW_INCOMPLETE'], ['EMPTY', 'CASE_CONTENT_REVIEW_INCOMPLETE'],
  ]) {
    const blocked = prepared.cases.find(row => row.external_id === externalId);
    await rejectUnchanged(store, manager, prepared, confirmation(prepared, [complete, blocked]), code);
  }
});

test('already approved rows reject a mixed group and keep unapproved rows unchanged', async t => {
  const { store, manager, project } = await fixture(t);
  const updated = await manager.confirmContents(project.project_id, confirmation(project, [project.cases[1]]));
  await rejectUnchanged(store, manager, updated, confirmation(updated), 'CASE_CONTENT_ALREADY_CONFIRMED');
});

test('pendingReviewItems uses current content and exposes actionable gaps within the selected scope', async t => {
  const { store, manager, project } = await fixture(t, [
    sample('READY-UI'), sample('READY-API', { case_type: 'BACKEND' }),
    sample('CONFIRMED', { status: '已确认' }), sample('REOPENED', { status: '已确认' }),
    sample('MISSING', { expected: '显示原模板价格\n' }), sample('UNTYPED', { case_type: '' }), sample('DRAFT'),
  ]);
  const reopened = project.cases.find(row => row.external_id === 'REOPENED');
  let prepared = await manager.updateCase(project.project_id, reopened.case_id, {
    revision: project.revision, content: { ...current(reopened).content, status: 'PENDING_CONFIRMATION' },
  });
  prepared = await changeFixtureContent(store, prepared, 'DRAFT', content => {
    content.requirements_origin = { project_id: project.project_id, design_id: 'design-isolated', candidate_id: 'candidate-isolated' };
  });
  const before = structuredClone(prepared);
  const review = pendingReviewItems(prepared);
  assert.deepEqual(review.map(row => row.external_id), ['READY-UI', 'READY-API', 'REOPENED', 'MISSING', 'UNTYPED', 'DRAFT']);
  assert.deepEqual(review.filter(row => !row.issue).map(row => row.external_id), ['READY-UI', 'READY-API', 'REOPENED']);
  assert.deepEqual(review.filter(row => row.issue).map(row => [row.external_id, row.issue]), [
    ['MISSING', '步骤或预期不完整，请先编辑补充'],
    ['UNTYPED', '用例类型未分类，请先编辑'],
    ['DRAFT', '请先在用例助手核对设计草案'],
  ]);
  for (const item of review) {
    const source = prepared.cases.find(row => row.case_id === item.case_id);
    assert.equal(item.case_version, source.current_version);
    assert.equal(item.content_sha256, current(source).content_sha256);
    assert.deepEqual(item.content, current(source).content);
  }
  assert.equal(review.find(row => row.external_id === 'REOPENED').case_version, 2,
    'an old confirmed version does not suppress a newly pending version');
  const ids = prepared.cases.filter(row => ['READY-UI', 'MISSING', 'CONFIRMED'].includes(row.external_id)).map(row => row.case_id);
  assert.deepEqual(pendingReviewItems(prepared, ids).map(row => row.external_id), ['READY-UI', 'MISSING']);
  assert.deepEqual(pendingReviewItems(prepared, []), []);
  assert.deepEqual(prepared, before, 'partitioning the review list must not modify content or status');
});
