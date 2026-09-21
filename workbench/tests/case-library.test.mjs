import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const mapping = { external_id: '用例编号', title: '标题', module: '模块', preconditions: '前置条件', test_data: '测试数据', steps: '步骤', expected: '逐步预期', status: '内容状态' };

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-library-'));
  const store = new CaseLibraryStore(root); await store.init();
  return { root, store, manager: new CaseLibraryManager(store) };
}

test('real xlsx and native package round trip preserve fields, lineage and project isolation', async (t) => {
  const { root, store, manager } = await fixture(); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const template = await fs.readFile(new URL('../examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx', import.meta.url));
  const [a, b, c] = await Promise.all([
    manager.createProject({ name: '项目A', description: 'Excel 来源' }), manager.createProject({ name: '项目B', description: '混合来源' }), manager.createProject({ name: '空项目', description: '' }),
  ]);
  const uploadA = await manager.upload({ fileName: encodeURIComponent('合成模板.xlsx'), contentType: xlsxType, body: template });
  assert.deepEqual(uploadA.workbook.sheets.map((sheet) => sheet.name), ['项目A示例', '项目B示例']);
  const previewA = await manager.preview(a.project_id, { upload_id: uploadA.upload_id, sheet_name: '项目A示例', mapping });
  assert.deepEqual(previewA.summary, { NEW: 2, DUPLICATE: 0, CONFLICT: 0, PENDING_CLARIFICATION: 1, UNIMPORTABLE: 0 });
  const importedA = await manager.confirm(a.project_id, previewA.preview_id);
  assert.equal(importedA.result.added, 3);
  assert.equal(importedA.project.cases[0].external_id, '001');
  assert.equal(importedA.project.cases[0].versions[0].content.steps.length, 3);
  assert.match(importedA.project.cases[0].versions[0].content.test_data, /\n/);
  assert.equal(importedA.project.cases.find((item) => item.external_id === '003').status, 'PENDING_CONFIRMATION');
  assert.equal((await manager.confirm(a.project_id, previewA.preview_id)).idempotent, true);

  const uploadB = await manager.upload({ fileName: encodeURIComponent('合成模板.xlsx'), contentType: xlsxType, body: template });
  const previewBExcel = await manager.preview(b.project_id, { upload_id: uploadB.upload_id, sheet_name: '项目B示例', mapping });
  await manager.confirm(b.project_id, previewBExcel.preview_id);
  const packageFromA = await manager.exportPackage(a.project_id, importedA.project.cases.slice(0, 2).map((item) => item.case_id));
  const packageBytes = Buffer.from(JSON.stringify(packageFromA));
  const uploadPackage = await manager.upload({ fileName: 'selected.json', contentType: 'application/json', body: packageBytes });
  const previewPackage = await manager.preview(b.project_id, { upload_id: uploadPackage.upload_id });
  assert.equal(previewPackage.summary.NEW, 2);
  const mixedB = await manager.confirm(b.project_id, previewPackage.preview_id);
  assert.equal(mixedB.project.cases.length, 3);
  const repeatPreview = await manager.preview(b.project_id, { upload_id: uploadPackage.upload_id });
  assert.equal(repeatPreview.summary.DUPLICATE, 2);
  assert.equal((await manager.confirm(b.project_id, repeatPreview.preview_id)).result.added, 0);

  const importedFromA = mixedB.project.cases.find((item) => item.root_source.stable_id === importedA.project.cases[0].root_source.stable_id);
  await manager.updateCase(b.project_id, importedFromA.case_id, { revision: (await store.getProject(b.project_id)).revision, content: { ...structuredClone(importedFromA.versions[0].content), title: '项目B独立修改' } });
  assert.equal((await store.getProject(a.project_id)).cases[0].title, '中文多步骤登录校验');
  const editedB = await store.getProject(b.project_id);
  const blankExpected = structuredClone(editedB.cases.find((item) => item.case_id === importedFromA.case_id).versions.at(-1).content);
  blankExpected.steps[0].expected = ''; blankExpected.status = 'CONFIRMED';
  const forcedPending = await manager.updateCase(b.project_id, importedFromA.case_id, { revision: editedB.revision, content: blankExpected });
  assert.equal(forcedPending.cases.find((item) => item.case_id === importedFromA.case_id).status, 'PENDING_CONFIRMATION');

  const conflicting = structuredClone(packageFromA); conflicting.package_id = 'conflict-package'; conflicting.cases[0].content.title = '同来源不同内容';
  const conflictUpload = await manager.upload({ fileName: 'conflict.json', contentType: 'application/json', body: Buffer.from(JSON.stringify(conflicting)) });
  const conflictPreview = await manager.preview(b.project_id, { upload_id: conflictUpload.upload_id });
  assert.equal(conflictPreview.items[0].classification, 'CONFLICT');
  const beforeCount = (await store.getProject(b.project_id)).cases.length;
  const skipped = await manager.confirm(b.project_id, conflictPreview.preview_id);
  assert.equal(skipped.project.cases.length, beforeCount);
  assert.equal(skipped.result.skipped_conflict, 1);

  const exportB = await manager.exportPackage(b.project_id);
  const uploadC = await manager.upload({ fileName: 'project-b.json', contentType: 'application/json', body: Buffer.from(JSON.stringify(exportB)) });
  const previewC = await manager.preview(c.project_id, { upload_id: uploadC.upload_id });
  const importedC = await manager.confirm(c.project_id, previewC.preview_id);
  assert.equal(importedC.project.cases.length, beforeCount);
  assert.deepEqual(importedC.project.cases.map((item) => item.versions[0].content), (await store.getProject(b.project_id)).cases.map((item) => item.versions.at(-1).content));
  assert.notEqual(importedC.project.cases[0].case_id, (await store.getProject(b.project_id)).cases[0].case_id);
});

test('formula cells and stale or cross-project confirmations fail closed', async (t) => {
  const { root, manager } = await fixture(); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const one = await manager.createProject({ name: '一', description: '' }); const two = await manager.createProject({ name: '二', description: '' });
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('公式'); sheet.addRow(['用例编号', '标题', '步骤', '逐步预期']);
  sheet.addRow(['F-01', { formula: '="标题"', result: '标题' }, '步骤一', '预期一']);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const upload = await manager.upload({ fileName: 'formula.xlsx', contentType: xlsxType, body: buffer });
  const preview = await manager.preview(one.project_id, { upload_id: upload.upload_id, sheet_name: '公式', mapping: { external_id: '用例编号', title: '标题', steps: '步骤', expected: '逐步预期' } });
  assert.equal(preview.summary.UNIMPORTABLE, 1);
  await assert.rejects(() => manager.confirm(two.project_id, preview.preview_id), /CASE_PREVIEW_NOT_FOUND/);
  await manager.updateProject(one.project_id, { revision: one.revision, name: '已变化', description: '' });
  await assert.rejects(() => manager.confirm(one.project_id, preview.preview_id), /CASE_IMPORT_PREVIEW_STALE/);
  await assert.rejects(() => manager.upload({ fileName: 'bad.xlsm', contentType: xlsxType, body: buffer }), /CASE_UPLOAD_TYPE_UNSUPPORTED/);
});
