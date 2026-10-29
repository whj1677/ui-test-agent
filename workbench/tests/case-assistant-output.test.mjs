import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { checkAssistantOutput, exportAssistantWorkbook } from '../server/case-assistant/output.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const source = { snapshot_id: 'source-prd', sha256: 'a'.repeat(64), file_name: '需求.md', kind: 'PRD', read_status: 'READ',
  segments: [{ segment_id: 'segment-1', text: '输入设备编号后点击查询，仅显示匹配编号的设备。', location: { line: 1 } }] };
const message = { id: 'message-1', role: 'user', text: '清空查询后恢复全部设备。', created_at: '2026-10-10T00:00:00Z' };
const context = () => ({ conversation_id: 'conversation-fixture', sources: [structuredClone(source)], messages: [structuredClone(message)] });
const candidate = (type = 'UI', id = '001') => ({ case_id: `draft-${type}-${id}`, case_type: type, external_id: id, title: '查询后清空', module: '设备', preconditions: '已存在设备 A 与 B', test_data: '编号 A', pending_questions: [],
  steps: [{ order: 1, action: '输入设备编号 A，点击查询', expected: '仅显示设备 A', source_refs: [{ source_id: 'source-prd', segment_id: 'segment-1', quote: '仅显示匹配编号的设备' }] },
    { order: 2, action: '清空查询', expected: '恢复全部设备', source_refs: [{ message_id: 'message-1', quote: '清空查询后恢复全部设备' }] }] });
const response = (...cases) => ({ reply: '已整理用例，请核对。', questions: [], cases, image_observations: [] });

async function importer(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'case-assistant-output-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CaseLibraryStore(root); await store.init();
  const manager = new CaseLibraryManager(store);
  const project = await manager.createProject({ name: '用例助手往返' });
  const upload = body => manager.upload({ fileName: '前端测试用例.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body });
  return { manager, project, upload };
}

test('typed Excel roundtrip preserves literal IDs, aligned steps, pending confirmation and source fields', async t => {
  const conversation = context(), input = response(candidate()), before = JSON.stringify(input);
  const checked = checkAssistantOutput(input, conversation);
  assert.equal(checked.checks.ready_count, 1);
  assert.equal(checked.checks.status, 'READY_FOR_REVIEW');
  assert.equal(JSON.stringify(input), before);
  const bytes = await exportAssistantWorkbook({ conversation, turn: checked, caseType: 'UI' });
  const { manager, project, upload } = await importer(t);
  const uploaded = await upload(bytes), sheet = uploaded.workbook.sheets[0];
  assert.equal(sheet.name, '测试用例');
  assert.equal(sheet.suggested_mapping.case_type, '用例层级');
  assert.equal(sheet.row_count, 1);
  assert.deepEqual(sheet.mapping_issues, []);
  const preview = await manager.preview(project.project_id, { upload_id: uploaded.upload_id, sheet_name: sheet.name });
  const row = preview.items[0];
  assert.equal(row.content.external_id, '001');
  assert.equal(row.content.case_type, 'UI');
  assert.equal(row.content.status, 'PENDING_CONFIRMATION');
  assert.deepEqual(row.content.steps, input.cases[0].steps.map(({ order, action, expected }) => ({ order, action, expected })));
  assert.equal(row.root_source.source_fields['执行状态'], '未执行');
  assert.equal(JSON.parse(row.root_source.source_fields['来源依据'])[1].source_refs[0].message_id, 'message-1');
  const imported = await manager.confirm(project.project_id, preview.preview_id);
  assert.equal(imported.project.cases[0].versions[0].content.case_type, 'UI');
  assert.equal(imported.project.cases[0].status, 'PENDING_CONFIRMATION');
});

test('business questions export as editable pending drafts in UI and backend workbooks', async t => {
  const missing = candidate('UI', '002');
  missing.pending_questions = ['编号大小写是否敏感？'];
  const turn = checkAssistantOutput(response(candidate(), missing, candidate('BACKEND', 'API-1')), context());
  assert.equal(turn.checks.ready_count, 3);
  assert.equal(turn.checks.pending_count, 0);
  assert.equal(turn.checks.content_warning_count, 1);
  assert.deepEqual(turn.checks.by_type.UI, { ready_count: 2, pending_count: 0 });
  const bytes = await exportAssistantWorkbook({ conversation: context(), turn, caseType: 'UI' });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
  assert.equal(workbook.worksheets.length, 2);
  assert.equal(workbook.worksheets[0].rowCount, 3);
  assert.equal(workbook.worksheets[0].getCell('K3').value, '编号大小写是否敏感？');
  assert.equal(workbook.worksheets[0].getCell('H3').value, '待确认');
  assert.equal(workbook.worksheets[0].getCell('L3').value, '未执行');
  assert.match(JSON.stringify(workbook.worksheets[1].getSheetValues()), /编号大小写是否敏感/);
  const { manager, project, upload } = await importer(t);
  const uploaded = await upload(bytes);
  assert(uploaded.workbook.sheets[1].mapping_issues.some(item => item.code === 'MAPPING_REQUIRED'));
  await assert.rejects(manager.preview(project.project_id, { upload_id: uploaded.upload_id, sheet_name: '资料与说明' }), /CASE_EXCEL_MAPPING_REQUIRED/);
  const backend = await exportAssistantWorkbook({ conversation: context(), turn: { output: turn }, caseType: 'BACKEND' });
  const backendUpload = await upload(backend);
  const backendPreview = await manager.preview(project.project_id, { upload_id: backendUpload.upload_id, sheet_name: '测试用例' });
  assert.equal(backendPreview.items.length, 1);
  assert.equal(backendPreview.items[0].content.case_type, 'BACKEND');
});

test('invented refs, assistant messages and images cannot serve as a business oracle', () => {
  const conversation = context();
  conversation.sources.push({ snapshot_id: 'source-image', kind: 'IMAGE', sha256: 'b'.repeat(64), segments: [{ segment_id: 'segment-1', text: '已完成' }] });
  conversation.messages.push({ id: 'assistant-1', role: 'assistant', text: '允许删除。' });
  for (const badRef of [{ source_id: 'unknown', segment_id: 'segment-1' }, { source_id: 'source-prd', segment_id: 'segment-1', quote: '允许删除' },
    { message_id: 'assistant-1' }, { message_id: 'message-1', quote: '恢复三条设备' }, { source_id: 'source-image', segment_id: 'segment-1' }]) {
    const entry = candidate();
    entry.steps[0].source_refs.push(badRef);
    const checked = checkAssistantOutput(response(entry), conversation);
    assert.equal(checked.checks.ready_count, 1);
    assert(checked.checks.issues.some(item => item.code === 'SOURCE_REF_INVALID' && item.severity === 'WARNING'));
    // Exportability cannot clear the rejected reference or imply business confirmation.
    const rechecked = checkAssistantOutput(checked, conversation);
    assert.equal(rechecked.cases[0].status, 'PENDING_CONFIRMATION');
    assert(rechecked.checks.issues.some(item => item.code === 'SOURCE_REF_INVALID'));
  }
});

test('missing expected results and changed sources remain visible without blocking draft editing', async t => {
  const entry = candidate(); entry.steps[0].expected = '';
  const checkedMissing = checkAssistantOutput(response(entry), context());
  assert.equal(checkedMissing.checks.ready_count, 1);
  assert.equal(checkedMissing.cases[0].steps[0].expected, '待补充：请测试工程师填写本步骤预期结果');
  assert.equal(checkAssistantOutput(checkedMissing, context()).checks.content_warning_count, 1);
  const bytes = await exportAssistantWorkbook({ conversation: context(), turn: response(entry), caseType: 'UI' });
  const { manager, project, upload } = await importer(t);
  const uploaded = await upload(bytes);
  const preview = await manager.preview(project.project_id, { upload_id: uploaded.upload_id, sheet_name: '测试用例' });
  assert.equal(preview.items[0].content.status, 'PENDING_CONFIRMATION');
  assert.equal(preview.items[0].content.steps.length, 2);
  assert.equal(preview.items[0].content.steps[0].expected, checkedMissing.cases[0].steps[0].expected);
  assert.equal(preview.items[0].content.steps[1].expected, entry.steps[1].expected);
  assert.match(preview.items[0].root_source.source_fields['待补充问题'], /步骤 1：预期尚未确定/);
  const checked = checkAssistantOutput(response(candidate()), context());
  const changed = context(); changed.sources[0].segments[0].text = '更改后的规则';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exportAssistantWorkbook({ conversation: changed, turn: checked, caseType: 'UI' }));
  assert.match(workbook.worksheets[0].getCell('K2').value, /来源未核实/);
  assert.equal(workbook.worksheets[0].getCell('H2').value, '待确认');
});

test('an explanatory leave-empty placeholder remains unresolved even without a separate pending question', async () => {
  const entry = candidate();
  entry.steps[0].expected = '预期留空：需要确认编号大小写是否敏感。';
  const checked = checkAssistantOutput(response(entry), context());
  assert.equal(checked.checks.ready_count, 1);
  assert(checked.checks.issues.some(item => item.code === 'STEP_EXPECTED_UNRESOLVED' && item.step_order === 1 && item.severity === 'WARNING'));
  assert((await exportAssistantWorkbook({ conversation: context(), turn: checked, caseType: 'UI' })).length > 0);
});

test('unassigned global questions stay visible in every affected draft without a format blocker', async () => {
  const raw = response(candidate(), candidate('BACKEND', 'API-01'));
  raw.questions = ['编号重复的判定范围是否跨运行空间？'];
  const checked = checkAssistantOutput(raw, context());
  assert.equal(checked.checks.ready_count, 2);
  assert.equal(checked.checks.pending_count, 0);
  assert.equal(checked.checks.content_warning_count, 2);
  assert.deepEqual(checked.questions, raw.questions);
  assert(checked.cases.every(entry => entry.checks.issues.some(item => item.code === 'GLOBAL_QUESTIONS_UNRESOLVED')));
  assert.equal(checkAssistantOutput(checked, context()).checks.ready_count, 2);
  for (const caseType of ['UI', 'BACKEND']) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportAssistantWorkbook({ conversation: context(), turn: checked, caseType }));
    assert.match(workbook.worksheets[0].getCell('K2').value, /编号重复的判定范围/);
    assert.equal(workbook.worksheets[0].getCell('H2').value, '待确认');
  }
});

test('questions associated with pending cases do not block independent ready cases', async () => {
  const pending = candidate('UI', '002');
  pending.pending_questions = ['编号大小写是否敏感？'];
  const raw = response(candidate(), pending);
  raw.questions = [...pending.pending_questions];
  const checked = checkAssistantOutput(raw, context());
  assert.equal(checked.checks.ready_count, 2);
  assert.equal(checked.checks.pending_count, 0);
  assert.equal(checked.checks.issues.some(item => item.code === 'GLOBAL_QUESTIONS_UNRESOLVED'), false);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exportAssistantWorkbook({ conversation: context(), turn: checked, caseType: 'UI' }));
  assert.equal(workbook.worksheets[0].rowCount, 3);
  assert.equal(workbook.worksheets[0].getCell('A2').value, '001');
});

test('replacement characters in case text stay visible and block readiness and Excel export', async () => {
  for (const field of ['case_id', 'external_id', 'title', 'module', 'preconditions', 'test_data', 'pending_questions', 'action', 'expected']) {
    const entry = candidate();
    if (['action', 'expected'].includes(field)) entry.steps[0][field] += '\uFFFD';
    else if (field === 'pending_questions') entry.pending_questions = ['原文\uFFFD需确认'];
    else entry[field] += '\uFFFD';
    const checked = checkAssistantOutput(response(entry), context());
    assert.equal(checked.checks.ready_count, 0, field);
    assert(checked.cases[0].checks.issues.some(item => item.code === 'CASE_TEXT_ENCODING_INVALID' && item.field === field), field);
    assert(JSON.stringify(checked.cases[0]).includes('\uFFFD'), 'Do not erase corrupted evidence during normalization');
    await assert.rejects(exportAssistantWorkbook({ conversation: context(), turn: checked, caseType: 'UI' }), /CASE_ASSISTANT_EXPORT_NO_READY_CASES/);
  }
});

test('corrupted reply or global questions create a global blocker without rewriting the original text', async () => {
  for (const field of ['reply', 'questions']) {
    const raw = response(candidate());
    raw[field] = field === 'reply' ? '已生\uFFFD成' : ['请确认\uFFFD'];
    const checked = checkAssistantOutput(raw, context());
    assert.deepEqual(checked[field], raw[field]);
    assert.equal(checked.checks.ready_count, 0);
    assert.equal(checked.checks.status, 'NEEDS_CLARIFICATION');
    const blocking = checked.checks.issues.find(item => item.code === 'CASE_TEXT_ENCODING_INVALID');
    assert.equal(blocking.case_id, null);
    assert.equal(blocking.field, field);
    assert.equal(checked.cases[0].checks.issues.some(item => item.code === 'CASE_TEXT_ENCODING_INVALID'), false);
    await assert.rejects(exportAssistantWorkbook({ conversation: context(), turn: checked, caseType: 'UI' }), /CASE_ASSISTANT_EXPORT_NO_READY_CASES/);
  }
});

test('step misalignment, multiline cells and duplicate IDs stay blocked while content warnings do not', () => {
  for (const change of [entry => { entry.steps[1].order = 3; }, entry => { entry.steps[0].action += '\n另一步'; },
    entry => { entry.steps[0].action = ''; }]) {
    const entry = candidate(); change(entry);
    assert.equal(checkAssistantOutput(response(entry), context()).checks.ready_count, 0);
  }
  const duplicated = checkAssistantOutput(response(candidate(), candidate()), context());
  assert.equal(duplicated.checks.ready_count, 0);
  assert.equal(duplicated.checks.pending_count, 2);
  assert.throws(() => checkAssistantOutput({ cases: 'not an array' }, context()), /CASE_ASSISTANT_OUTPUT_INVALID/);
  for (const change of [entry => { entry.steps[1].expected = '待补充'; }, entry => { entry.steps[1].source_refs = []; }, entry => { entry.test_data = '同上'; }]) {
    const entry = candidate(); change(entry);
    const checked = checkAssistantOutput(response(entry), context());
    assert.equal(checked.checks.ready_count, 1);
    assert.equal(checked.checks.content_warning_count, 1);
    assert.equal(checked.cases[0].status, 'PENDING_CONFIRMATION');
  }
});

test('bad row structure and oversized text block only their row and survive saved-output rechecks', async () => {
  for (const change of [entry => { entry.title = '长'.repeat(501); }, entry => { entry.test_data = '长'.repeat(5001); },
    entry => { entry.pending_questions = 'not a list'; }, entry => { entry.test_data = { value: 'invalid type' }; },
    entry => { entry.steps[1] = null; }, entry => { entry.steps[0].source_refs = [null]; },
    entry => { entry.title += '\u0001'; }]) {
    const invalid = candidate('UI', 'bad'); change(invalid);
    const checked = checkAssistantOutput(response(candidate(), invalid), context());
    assert.equal(checked.checks.ready_count, 1);
    assert.equal(checked.cases[1].checks.ready, false);
    assert.equal(checkAssistantOutput(checked, context()).cases[1].checks.ready, false);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportAssistantWorkbook({ conversation: context(), turn: checked, caseType: 'UI' }));
    assert.equal(workbook.worksheets[0].rowCount, 2);
    assert.equal(workbook.worksheets[0].getCell('A2').value, '001');
    assert.match(JSON.stringify(workbook.worksheets[1].getSheetValues()), /格式受阻/);
  }
});

test('unread-reference markers cannot be promoted by a later full-context recheck', () => {
  const entry = candidate();
  entry.steps[0].source_refs[0] = { ...entry.steps[0].source_refs[0], validity: 'INVALID', issue: 'REFERENCE_NOT_READ' };
  const checked = checkAssistantOutput(response(entry), context());
  for (const output of [checked, checkAssistantOutput(checked, context())]) {
    assert.equal(output.checks.ready_count, 1);
    assert.equal(output.cases[0].steps[0].source_refs[0].validity, 'INVALID');
    assert(output.cases[0].checks.issues.some(item => item.code === 'EXPECTED_SOURCE_REQUIRED'));
    assert(output.cases[0].checks.issues.some(item => item.code === 'SOURCE_REF_INVALID'));
  }
});

test('unknown short-reference identity survives stored-output rechecks and Excel export', async () => {
  const entry = candidate();
  entry.steps[0].source_refs = [{ reference_id: 'ref-missing-77', validity: 'INVALID', issue: 'REFERENCE_UNKNOWN' }];
  const checked = checkAssistantOutput(response(entry), context());
  const rechecked = checkAssistantOutput(checked, context());
  assert.equal(rechecked.cases[0].steps[0].source_refs[0].reference_id, 'ref-missing-77');
  assert(rechecked.cases[0].checks.issues.some(item => item.code === 'SOURCE_REF_INVALID' && item.severity === 'WARNING'));
  assert(rechecked.cases[0].checks.issues.some(item => item.code === 'EXPECTED_SOURCE_REQUIRED'));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exportAssistantWorkbook({ conversation: context(), turn: rechecked, caseType: 'UI' }));
  const refs = JSON.parse(workbook.worksheets[0].getCell('J2').value);
  assert.deepEqual(refs[0].source_refs, entry.steps[0].source_refs);
  assert.match(workbook.worksheets[0].getCell('K2').value, /来源未核实/);
});

test('editable UI and BACKEND drafts roundtrip all import fields and literal formula-like text', async t => {
  const { manager, project, upload } = await importer(t);
  for (const type of ['UI', 'BACKEND']) {
    const entry = candidate(type, type === 'UI' ? '0007' : '0008');
    entry.title = '=测试工程师草稿（待补充）';
    entry.preconditions = '已登录测试环境\n准备本次独立数据';
    entry.test_data = '编号="0001"；中文、逗号,换行\n保留原始输入';
    entry.pending_questions = ['成功后的状态值请工程师补充'];
    entry.steps[0].expected = '';
    const checked = checkAssistantOutput(response(entry), context());
    const bytes = await exportAssistantWorkbook({ conversation: context(), turn: checked, caseType: type });
    const uploaded = await upload(bytes);
    assert.deepEqual(uploaded.workbook.sheets[0].mapping_issues, []);
    const preview = await manager.preview(project.project_id, { upload_id: uploaded.upload_id, sheet_name: '测试用例' });
    assert.equal(preview.items.length, 1);
    const actual = preview.items[0];
    for (const field of ['external_id', 'title', 'module', 'preconditions', 'test_data', 'case_type']) assert.equal(actual.content[field], entry[field], field);
    assert.deepEqual(actual.content.steps, checked.cases[0].steps.map(({ order, action, expected }) => ({ order, action, expected })));
    assert.equal(actual.content.status, 'PENDING_CONFIRMATION');
    assert.equal(actual.root_source.source_fields['执行状态'], '未执行');
    assert.match(actual.root_source.source_fields['待补充问题'], /成功后的状态值请工程师补充/);
    assert.equal(actual.issues.some(item => item.code === 'FORMULA_UNSUPPORTED'), false);
    const imported = await manager.confirm(project.project_id, preview.preview_id);
    const saved = imported.project.cases.find(item => item.versions[0].content.external_id === entry.external_id);
    assert(saved);
    assert.equal(saved.status, 'PENDING_CONFIRMATION');
    assert.equal(saved.versions[0].content.case_type, type);
  }
});

test('Excel importer rejects unknown explicit case layers while preserving legacy test-type meaning', async t => {
  const { manager, project, upload } = await importer(t);
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('普通表');
  sheet.addRow(['用例编号', '标题', '测试步骤', '预期结果', '用例层级', '测试类型']);
  sheet.addRow(['C-1', '无效层级', '动作', '结果', '正向', 'UI']);
  sheet.addRow(['C-2', '后端层级', '动作', '结果', 'BACKEND', '反向']);
  sheet.addRow(['C-3', '未分类旧用例', '动作', '结果', '', '正向']);
  const saved = await upload(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(saved.workbook.sheets[0].suggested_mapping.case_type, '用例层级');
  const preview = await manager.preview(project.project_id, { upload_id: saved.upload_id, sheet_name: '普通表' });
  assert.equal(preview.items[0].classification, 'UNIMPORTABLE');
  assert(preview.items[0].issues.some(item => item.code === 'CASE_TYPE_INVALID'));
  assert.equal(preview.items[1].content.case_type, 'BACKEND');
  assert.equal(preview.items[2].content.case_type, undefined);
});

test('image observations refer only to registered standalone or embedded images', () => {
  const conversation = context();
  conversation.sources.push({ snapshot_id: 'screenshot', kind: 'IMAGE', sha256: 'b'.repeat(64) });
  conversation.sources[0].embedded_images = [{ image_id: 'image-1' }];
  const raw = response();
  raw.image_observations = [{ source_id: 'screenshot', observations: [{ description: '可见查询按钮', location: '顶部' }], uncertainties: [] },
    { source_id: 'source-prd', image_id: 'image-1', observations: [], uncertainties: ['小字无法辨识'] }];
  const checked = checkAssistantOutput(raw, conversation);
  assert.equal(checked.image_observations.length, 2);
  assert.equal(checked.checks.status, 'WAITING_FOR_INPUT');
  raw.image_observations[1].image_id = 'image-999';
  assert.throws(() => checkAssistantOutput(raw, conversation), /CASE_ASSISTANT_IMAGE_SOURCE_INVALID/);
});
