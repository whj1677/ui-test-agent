import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { CaseLibraryStore, newCaseId } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { confirmDesignedCases, exportCasesWorkbook } from '../server/cases/design.mjs';
import { WORKBOOK_META_SHEET, readWorkbookPackage } from '../server/cases/workbook-package.mjs';

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'requirements-export-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CaseLibraryStore(root); await store.init();
  const manager = new CaseLibraryManager(store);
  const project = await manager.createProject({ name: '合成需求项目', description: '' });
  const candidate = { candidate_id: 'C-1', case_type: 'BACKEND', source_refs: [{ source: 'PRD', locator: '3.2' }],
    root_source: { type: 'requirements-design', stable_id: 'requirements:D-1:C-1' },
    content: { external_id: 'API-01', title: '查订单', module: '订单', preconditions: '已有订单', test_data: '订单号 01',
      steps: [{ order: 1, action: '请求订单', expected: '返回已确认订单', source_refs: [{ source: 'PRD', locator: '3.2' }] }] } };
  await confirmDesignedCases(store, { projectId: project.project_id, projectRevision: project.revision, designId: 'D-1', candidates: [candidate] });
  const pkg = await manager.exportPackage(project.project_id, null, 'BACKEND');
  const bytes = await exportCasesWorkbook(pkg);
  const upload = body => manager.upload({ fileName: 'cases.xlsx', contentType: xlsxType, body });
  return { store, manager, project, pkg, bytes, upload };
}

async function edit(bytes, change) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  change(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('unchanged exported workbook returns duplicate with original type, source and version', async t => {
  const { manager, project, pkg, bytes, upload } = await setup(t);
  const imported = await upload(bytes);
  assert.equal(imported.workbook_export_format, 'workbench/case-xlsx-v1');
  assert.deepEqual(imported.workbook.sheets.map(sheet => sheet.name), ['测试用例']);
  const preview = await manager.preview(project.project_id, { upload_id: imported.upload_id });
  assert.equal(preview.summary.DUPLICATE, 1);
  assert.equal(preview.source_detail.visible_change_count, 0);
  assert.equal(preview.items[0].source_version, pkg.cases[0].source_version);
  assert.deepEqual(preview.items[0].root_source, pkg.cases[0].root_source);
  assert.equal(preview.items[0].content.case_type, 'BACKEND');
  assert.deepEqual(preview.items[0].content.source_refs, pkg.cases[0].content.source_refs);
  const confirmed = await manager.confirm(project.project_id, preview.preview_id);
  assert.equal(confirmed.result.added, 0);
  assert.equal(confirmed.result.skipped_duplicate, 1);
});

test('typed export includes only current confirmed versions and rejects explicit draft or wrong-type IDs', async t => {
  const { store, manager, project } = await setup(t);
  const before = await store.getProject(project.project_id);
  const confirmedId = before.cases[0].case_id;
  const draftId = newCaseId(), legacyId = newCaseId();
  await store.updateProject(project.project_id, before.revision, current => {
    const addCase = (caseId, externalId, typed) => {
      const content = { external_id:externalId, title:externalId, module:'订单', preconditions:'', test_data:'',
        steps:[{order:1,action:'读取订单',expected:''}], status:'PENDING_CONFIRMATION' };
      if (typed) content.case_type = 'BACKEND';
      current.cases.push({case_id:caseId,external_id:externalId,title:externalId,module:'订单',status:content.status,
        current_version:1,root_source:{type:'import',stable_id:externalId},lineage:[],versions:[{version:1,content,content_sha256:contentHash(content)}]});
    };
    addCase(draftId,'API-DRAFT',true);
    addCase(legacyId,'LEGACY-DRAFT',false);
    return current;
  });
  const typed = await manager.exportPackage(project.project_id,null,'BACKEND');
  assert.deepEqual(typed.cases.map(item=>item.package_case_id),[`${project.project_id}:${confirmedId}:v1`]);
  await assert.rejects(manager.exportPackage(project.project_id,[confirmedId,draftId],'BACKEND'),/CASE_EXPORT_SELECTION_INVALID/);
  await assert.rejects(manager.exportPackage(project.project_id,[legacyId],'BACKEND'),/CASE_EXPORT_SELECTION_INVALID/);
  const legacy = await manager.exportPackage(project.project_id);
  assert.equal(legacy.cases.length,3);
});

test('JSON cannot relabel an unchanged confirmed requirements case as a new source',async t=>{
  const {manager,project,pkg}=await setup(t);
  const body=structuredClone(pkg);
  body.cases[0].root_source={type:'generic',stable_id:'forged-new-identity'};
  const uploaded=await manager.upload({fileName:'forged.json',contentType:'application/json',body:Buffer.from(JSON.stringify(body))});
  await assert.rejects(manager.preview(project.project_id,{upload_id:uploaded.upload_id}),/CASE_DESIGN_REVIEW_REQUIRED/);
});

test('visible edits cannot reuse the hidden confirmed snapshot', async t => {
  const { manager, project, bytes, upload } = await setup(t);
  const changed = await edit(bytes, workbook => { workbook.getWorksheet('测试用例').getCell('B2').value = '用户修改后的标题'; });
  const saved = await upload(changed);
  const preview = await manager.preview(project.project_id, { upload_id: saved.upload_id });
  assert.equal(preview.summary.UNIMPORTABLE, 1);
  assert.equal(preview.items[0].issues.some(issue => issue.code === 'CASE_WORKBOOK_VISIBLE_CHANGED_REVIEW_REQUIRED'), true);
  const result = await manager.confirm(project.project_id, preview.preview_id);
  assert.equal(result.result.added, 0);
  assert.equal(result.result.skipped_unimportable, 1);
});

test('tampered snapshot, missing snapshot and another project are rejected', async t => {
  const { manager, project, bytes, upload } = await setup(t);
  const other = await manager.createProject({ name: '另一项目', description: '' });
  const original = await upload(bytes);
  await assert.rejects(() => manager.preview(other.project_id, { upload_id: original.upload_id }), /CASE_WORKBOOK_PROJECT_MISMATCH/);

  const tampered = await edit(bytes, workbook => {
    const meta = workbook.getWorksheet(WORKBOOK_META_SHEET);
    const json = JSON.parse(meta.getCell('A2').value);
    json.cases[0].content.title = '隐藏快照被改';
    const changed = JSON.stringify(json);
    meta.getCell('A2').value = changed;
    meta.getCell('B1').value = createHash('sha256').update(changed).digest('hex').toUpperCase();
  });
  const uploadTampered = await upload(tampered);
  await assert.rejects(() => manager.preview(project.project_id, { upload_id: uploadTampered.upload_id }), /CASE_WORKBOOK_SOURCE_CHANGED/);

  const stripped = await edit(bytes, workbook => { workbook.removeWorksheet(workbook.getWorksheet(WORKBOOK_META_SHEET).id); });
  await assert.rejects(() => upload(stripped), /CASE_WORKBOOK_SNAPSHOT_MISSING/);
});

test('ordinary xlsx remains on the original mapping import path', async t => {
  const { manager, project, upload } = await setup(t);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('普通表');
  sheet.addRow(['用例编号', '标题', '步骤', '逐步预期']);
  sheet.addRow(['L-01', '旧式输入', '操作', '预期']);
  const saved = await upload(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(saved.workbook_export_format, undefined);
  const preview = await manager.preview(project.project_id, { upload_id: saved.upload_id,
    sheet_name: '普通表', mapping: { external_id: '用例编号', title: '标题', steps: '步骤', expected: '逐步预期' } });
  assert.equal(preview.summary.NEW, 1);
  assert.equal(preview.items[0].content.case_type, undefined);
});

test('segmented snapshot preserves large Unicode content without changing visible rows', async t => {
  const { pkg } = await setup(t);
  pkg.cases[0].content.test_data = `${'资料'.repeat(13000)}😃`;
  const bytes = await exportCasesWorkbook(pkg);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbook-segments-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'large.xlsx');
  await fs.writeFile(file, bytes);
  const restored = await readWorkbookPackage(file);
  assert.equal(restored.pkg.cases[0].content.test_data, pkg.cases[0].content.test_data);
  assert.deepEqual(restored.changes, []);
});
