import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { contentHash, inspectWorkbook, parseWorksheet } from '../server/cases/excel.mjs';

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-csv-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CaseLibraryStore(root); await store.init();
  return { store, manager: new CaseLibraryManager(store) };
}

test('UTF-8 BOM CSV parses quoted commas, quotes, newlines and keeps unmapped source fields', async (t) => {
  const { manager } = await setup(t);
  const project = await manager.createProject({ name: 'CSV 合成' });
  const csv = '\uFEFF用例编号,用例标题,测试步骤/测试数据,预期结果,实际结果,测试类型\r\n'
    + '"CSV-1","标题, 含""引号""","动作一;保留\r\n动作二","预期一\r\n预期二",通过,正向\r\n';
  const uploaded = await manager.upload({ fileName: 'sample.csv', contentType: 'text/csv; charset=utf-8', body: Buffer.from(csv) });
  const sheet = uploaded.workbook.sheets[0];
  assert.equal(uploaded.source_type, 'csv');
  assert.equal(sheet.row_count, 1);
  assert.deepEqual(sheet.suggested_mapping, {
    external_id: '用例编号', title: '用例标题', steps: '测试步骤/测试数据', expected: '预期结果',
  });
  assert.deepEqual(sheet.mapping_issues, []);
  const preview = await manager.preview(project.project_id, { upload_id: uploaded.upload_id });
  assert.equal(preview.items.length, 1);
  const item = preview.items[0];
  assert.equal(item.root_source.type, 'csv');
  assert.equal(item.root_source.stable_id, `csv:${uploaded.sha256}:sample:2`);
  assert.equal(item.root_source.file_name, 'sample.csv');
  assert.equal(item.root_source.source_fields['实际结果'], '通过');
  assert.equal(item.root_source.source_fields['测试类型'], '正向');
  assert.equal(item.root_source.source_fields['测试步骤/测试数据'], '动作一;保留\r\n动作二');
  assert.equal(item.content.title, '标题, 含"引号"');
  assert.deepEqual(item.content.steps, [
    { order: 1, action: '动作一;保留', expected: '预期一' },
    { order: 2, action: '动作二', expected: '预期二' },
  ]);
  assert.equal(item.content.status, 'PENDING_CONFIRMATION');
  assert.equal(item.content.case_type, undefined);
  assert.equal(item.content_sha256, contentHash(item.content));
  assert.equal(preview.source_detail.mapping.status, undefined);
  assert.equal(preview.source_detail.mapping.test_data, undefined);
});

test('ambiguous aliases are not guessed; explicit mapping wins', async (t) => {
  const { manager } = await setup(t);
  const project = await manager.createProject({ name: '映射复核' });
  const body = Buffer.from('用例编号,标题,用例标题,测试步骤,预期结果\nX-1,甲,乙,动作,预期\n');
  const upload = await manager.upload({ fileName: 'ambiguous.csv', contentType: 'application/vnd.ms-excel', body });
  const sheet = upload.workbook.sheets[0];
  assert.equal(sheet.suggested_mapping.title, undefined);
  assert(sheet.mapping_issues.some((issue) => issue.code === 'MAPPING_AMBIGUOUS' && issue.field === 'title'));
  await assert.rejects(manager.preview(project.project_id, { upload_id: upload.upload_id }), /CASE_EXCEL_MAPPING_REQUIRED/);
  const preview = await manager.preview(project.project_id, {
    upload_id: upload.upload_id, mapping: { external_id: '用例编号', title: '标题', steps: '测试步骤', expected: '预期结果' },
  });
  assert.equal(preview.items[0].content.title, '甲');
  assert.equal(preview.items[0].root_source.source_fields['用例标题'], '乙');
});

test('malformed CSV is rejected before preview', async (t) => {
  const { manager } = await setup(t);
  for (const [name, text, code] of [
    ['unterminated.csv', '用例编号,标题\nX-1,"未闭合', 'CASE_CSV_QUOTE_UNTERMINATED'],
    ['stray.csv', '用例编号,标题\nX-1,"标题"后缀', 'CASE_CSV_QUOTE_INVALID'],
    ['width.csv', '用例编号,标题\nX-1,甲,多余', 'CASE_CSV_ROW_WIDTH_MISMATCH'],
  ]) await assert.rejects(manager.upload({ fileName: name, contentType: 'text/csv', body: Buffer.from(text) }), new RegExp(code));
});

test('real GB18030 engineer CSV previews 77 cases without inventing oracle or type', async (t) => {
  const input = 'C:/Users/20240082/Documents/xwechat_files/wxid_xw4iphhkham522_6ae7/msg/file/2026-09/电价管理.csv';
  try { await fs.access(input); } catch { t.skip('local engineer CSV is unavailable on this host'); return; }
  const { manager } = await setup(t);
  const project = await manager.createProject({ name: '真实 CSV 只预览' });
  const bytes = await fs.readFile(input);
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const uploaded = await manager.upload({ fileName: encodeURIComponent('电价管理.csv'), contentType: 'text/csv', body: bytes });
  assert.equal(uploaded.workbook.sheets[0].row_count, 77);
  assert.deepEqual(uploaded.workbook.sheets[0].suggested_mapping, {
    external_id: '用例编号', title: '用例标题', preconditions: '前置条件', steps: '测试步骤/测试数据', expected: '预期结果',
  });
  const preview = await manager.preview(project.project_id, { upload_id: uploaded.upload_id });
  assert.equal(preview.items.length, 77);
  const missing = preview.items.find((item) => item.content.external_id === 'TC-TPL-005');
  assert(missing);
  assert.equal(missing.content.steps[0].expected.trim(), '');
  assert.equal(missing.content.status, 'PENDING_CONFIRMATION');
  assert.equal(missing.root_source.source_fields['实际结果'], '不通过');
  assert.equal(preview.items.filter((item) => item.root_source.source_fields['实际结果'] === '通过').length, 74);
  assert.equal(preview.items.filter((item) => item.root_source.source_fields['实际结果'] === '不通过').length, 3);
  assert(preview.items.every((item) => item.content.status === 'PENDING_CONFIRMATION' && item.content.case_type === undefined));
  assert.equal((await manager.exportPackage(project.project_id).catch((error) => error.message)), 'CASE_EXPORT_SELECTION_INVALID');
});

test('XLSX content hash remains tied to business content when source_fields are added', async () => {
  const file = fileURLToPath(new URL('./fixtures/m3a-excel-fidelity-boundary.xlsx', import.meta.url));
  const inspected = await inspectWorkbook(file);
  assert.equal(inspected.sheets[0].suggested_mapping.external_id, '用例编号');
  const parsed = await parseWorksheet(file, {
    sheet_name: '保真边界', mapping: { external_id: '用例编号', title: '标题', steps: '步骤', expected: '逐步预期' },
    upload_sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase(), file_name: 'fixture.xlsx',
  });
  assert.equal(parsed.rows[0].root_source.type, 'xlsx');
  assert.equal(parsed.rows[0].root_source.source_fields['用例编号'], '001');
  assert.equal(parsed.rows[0].content_sha256, contentHash(parsed.rows[0].content));
});
