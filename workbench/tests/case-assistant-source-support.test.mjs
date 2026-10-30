import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { checkAssistantOutput, exportAssistantWorkbook } from '../server/case-assistant/output.mjs';
import { CaseAssistantMcpSession } from '../server/case-assistant/mcp-session.mjs';
import { caseAssistantPrompt, freezeCaseDesignSkill } from '../server/case-assistant/prompt.mjs';

const ref = { source_id: 'source-prd', segment_id: 'segment-1' };
const source = text => ({ snapshot_id: 'source-prd', kind: 'PRD', file_name: 'synthetic.md', extension: '.md', read_status: 'READ',
  body: Buffer.from(text), segments: [{ segment_id: 'segment-1', text, location: { line: 1 } }] });
const context = text => ({ sources: [source(text)], messages: [] });
const step = (action, expected, source_refs = [ref]) => ({ order: 1, action, expected, source_refs });
const response = steps => ({ reply: '合成草稿，待核对。', questions: [], image_observations: [], cases: [{ case_id: 'draft-1', case_type: 'UI', external_id: 'UI-001', title: '组合筛选',
  module: '合成', preconditions: '', test_data: '', pending_questions: [], steps: steps.map((item, index) => ({ ...item, order: index + 1 })) }] });
const supportWarnings = result => result.checks.issues.filter(item => item.code === 'STEP_SOURCE_SUPPORT_UNVERIFIED');

test('complete quoted actions and expectations have literal support, never a semantic pass', () => {
  const ctx = context('点击查询。查询后两个下拉框保留所选值。选择东站后点击页面空白处使选择生效。站点显示东站。');
  const input = response([step('点击查询', '查询后两个下拉框保留所选值'), step('选择东站后点击页面空白处使选择生效', '站点显示东站')]);
  const checked = checkAssistantOutput(input, ctx);
  assert.equal(checked.checks.status, 'READY_FOR_REVIEW'); assert.equal(checked.checks.semantic_status, 'NOT_REVIEWED');
  assert.equal(supportWarnings(checked).length, 0);
  for (const item of checked.cases[0].steps) {
    assert.equal(item.source_support.action.status, 'DIRECT_QUOTE'); assert.equal(item.source_support.expected.status, 'DIRECT_QUOTE');
    assert.equal(item.source_support.semantic_status, 'NOT_REVIEWED');
  }
  assert.equal(checked.cases[0].status, 'PENDING_CONFIRMATION');
});

test('real expansion regression retains blank-click and post-query-retention text as unverified with field-specific Excel warnings', async () => {
  const ctx = context('在站点下拉框选择东站。点击查询。列表仅显示 WO-1001。点击清空后两个下拉框恢复全部。');
  const input = response([step('在站点下拉框选择东站，点击页面空白处使选择生效', '站点显示东站'),
    step('点击查询', '列表仅显示 WO-1001，站点下拉框仍显示东站')]);
  const frozen = JSON.stringify(input), checked = checkAssistantOutput(input, ctx);
  assert.equal(checked.checks.status, 'NEEDS_CLARIFICATION'); assert.equal(checked.checks.ready_count, 1);
  assert.equal(checked.cases[0].steps.length, 2); assert.equal(JSON.stringify(input), frozen);
  assert.equal(checked.cases[0].steps[0].action, input.cases[0].steps[0].action);
  assert.equal(checked.cases[0].steps[1].expected, input.cases[0].steps[1].expected);
  assert.equal(checked.cases[0].steps[1].source_support.action.status, 'DIRECT_QUOTE');
  assert.equal(checked.cases[0].steps[1].source_support.expected.status, 'UNVERIFIED');
  assert.deepEqual(supportWarnings(checked).map(item => [item.step_order, item.field]), [[1, 'action'], [1, 'expected'], [2, 'expected']]);
  assert.deepEqual(checkAssistantOutput(checked, ctx), checked);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await exportAssistantWorkbook({ conversation: ctx, turn: checked, caseType: 'UI' }));
  const row = workbook.getWorksheet('测试用例').getRow(2);
  assert.equal(row.getCell(6).value, input.cases[0].steps.map(item => item.action).join('\n'));
  assert.equal(row.getCell(7).value, input.cases[0].steps.map(item => item.expected).join('\n'));
  assert.match(row.getCell(11).value, /步骤 1：动作完整表述未核对/); assert.match(row.getCell(11).value, /步骤 2：预期完整表述未核对/);
  assert.equal(row.getCell(8).value, '待确认'); assert.equal(row.getCell(12).value, '未执行');
});

test('an unrelated valid source, partial quote, omitted condition or reversed negation cannot verify a field', () => {
  for (const [text, expected, quote] of [
    ['点击查询。清空后控件恢复全部。', '查询后控件保持东站', undefined],
    ['点击查询。仅管理员查询后保留筛选值。', '查询后保留筛选值', '查询后保留筛选值'],
    ['点击查询。查询后不保留筛选值。', '查询后保留筛选值', undefined],
    ['点击查询。如果查询成功，保留筛选值。', '保留筛选值', '保留筛选值'],
    ['点击查询。列表显示 A，其他记录不变。', '列表显示 A', '列表显示 A'],
  ]) {
    const checked = checkAssistantOutput(response([step('点击查询', expected, [{ ...ref, ...(quote ? { quote } : {}) }])]), context(text));
    assert.equal(checked.cases[0].steps[0].source_support.expected.status, 'UNVERIFIED', text);
    assert(supportWarnings(checked).some(item => item.field === 'expected'));
    assert.equal(checked.cases[0].steps[0].expected, expected);
  }
});

test('line wrapping and semicolons cannot detach conditions or negation from the quoted sentence', () => {
  for (const [sentence, fragment] of [
    ['如果查询成功，\n保留筛选值', '保留筛选值'],
    ['不允许\r\n删除全部数据', '删除全部数据'],
    ['如果查询成功；保留筛选值', '保留筛选值'],
    ['不允许以下操作;删除全部数据', '删除全部数据'],
  ]) {
    const ctx = context(`点击查询。${sentence}。`);
    const partial = checkAssistantOutput(response([step('点击查询', fragment, [{ ...ref, quote: fragment }])]), ctx);
    assert.equal(partial.cases[0].steps[0].source_support.expected.status, 'UNVERIFIED', sentence);
    assert(supportWarnings(partial).some(item => item.field === 'expected'), sentence);
    assert.equal(partial.cases[0].steps[0].expected, fragment);

    const complete = checkAssistantOutput(response([step('点击查询', sentence.replace(/\s+/gu, ' '))]), ctx);
    assert.equal(complete.cases[0].steps[0].source_support.expected.status, 'DIRECT_QUOTE', sentence);
    assert.equal(supportWarnings(complete).length, 0, sentence);
    assert.equal(complete.checks.semantic_status, 'NOT_REVIEWED');
  }
});

test('source evidence applies only to the cited field text and does not leak warnings to a supported step', () => {
  const ctx = context('点击查询。列表显示 A。点击清空。列表恢复全部。');
  const checked = checkAssistantOutput(response([step('点击查询', '查询完成后控件保持值'), step('点击清空', '列表恢复全部')]), ctx);
  assert.deepEqual(supportWarnings(checked).map(item => [item.step_order, item.field]), [[1, 'expected']]);
  const narrowed = checkAssistantOutput(response([step('点击查询', '列表显示 A', [{ ...ref, quote: '列表显示 A' }])]), ctx);
  assert.deepEqual(supportWarnings(narrowed).map(item => item.field), ['action']);
  const unread = checkAssistantOutput(response([step('点击查询', '列表显示 A', [{ ...ref, validity: 'INVALID', issue: 'REFERENCE_NOT_READ' }])]), ctx);
  assert.equal(unread.cases[0].steps[0].source_support.expected.status, 'UNVERIFIED');
});

test('user source sentences are eligible but assistant suggestions and self-declared support are not', () => {
  const ctx = { sources: [], messages: [{ id: 'user-1', role: 'user', text: '点击查询。列表显示 A。' }, { id: 'assistant-1', role: 'assistant', text: '查询后保留筛选值。' }] };
  const direct = checkAssistantOutput(response([step('点击查询', '列表显示 A', [{ message_id: 'user-1' }])]), ctx);
  assert.equal(supportWarnings(direct).length, 0);
  const input = response([step('点击查询', '查询后保留筛选值', [{ message_id: 'assistant-1' }])]);
  input.cases[0].steps[0].source_support = { expected: { status: 'DIRECT_QUOTE' }, semantic_status: 'PASSED' };
  const checked = checkAssistantOutput(input, ctx);
  assert.equal(checked.cases[0].steps[0].source_support.expected.status, 'UNVERIFIED');
  assert.equal(checked.checks.semantic_status, 'NOT_REVIEWED');
});

test('MCP staging and submission expose the same conservative source findings without dropping draft cases', async () => {
  const ctx = context('点击查询。列表显示 A。');
  const session = new CaseAssistantMcpSession({ projectId: 'project-test', ...ctx });
  await session.invoke('read_context'); const read = await session.invoke('read_source', { source_id: 'source-prd' });
  const input = response([step('点击查询', '查询后控件保留所选值', [{ reference_id: read.segments[0].reference_id }])]);
  const staged = await session.invoke('stage_cases', { cases: input.cases });
  assert.equal(staged.staged_case_count, 1); assert.equal(staged.checks.semantic_status, 'NOT_REVIEWED');
  assert(staged.checks.issues.some(item => item.code === 'STEP_SOURCE_SUPPORT_UNVERIFIED' && item.field === 'expected'));
  const submitted = await session.invoke('submit_response', { reply: input.reply, questions: [], image_observations: [], use_staged_cases: true });
  assert.equal(submitted.accepted, true); assert.equal(submitted.checks.status, 'NEEDS_CLARIFICATION');
  assert.equal(session.response.cases[0].steps[0].expected, input.cases[0].steps[0].expected);
});

test('prompt and frozen guidance no longer prescribe unsupported blur or clearing actions', async () => {
  const skill = await freezeCaseDesignSkill(), prompt = caseAssistantPrompt(skill);
  assert.doesNotMatch(skill.text, /输入前说明清空旧值，选择后说明失焦或确认/);
  assert.match(skill.text, /仅在资料或用户明确约定时写入/);
  assert.match(prompt, /不要默认增加清空旧值、失焦、点击空白或查询后控件保持/);
  assert.match(prompt, /动作和预期优先分别沿用来源中完整原句/);
});
