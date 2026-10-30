import ExcelJS from 'exceljs';
import { sourceTextSupport } from './source-support.mjs';

const FAIL = 'CASE_ASSISTANT_OUTPUT_INVALID';
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 5000) => {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw Error(FAIL);
  return value.trim();
};
const array = (value, max) => {
  if (!Array.isArray(value) || value.length > max) throw Error(FAIL);
  return value;
};
const strings = value => array(value ?? [], 40).map(item => text(item, 1500)).filter(Boolean);
const issue = (code, message, caseId = null, stepOrder = null, severity = 'BLOCKING') => ({ code, severity, message, case_id: caseId, step_order: stepOrder });
const UNRESOLVED_EXPECTED = '待补充：请测试工程师填写本步骤预期结果';
const NORMALIZATION_ISSUES = new Set(['CASE_STRUCTURE_INVALID', 'CASE_FIELD_TYPE_INVALID', 'STEP_STRUCTURE_INVALID', 'SOURCE_REF_STRUCTURE_INVALID']);
const caseWarnings = entry => entry.checks.issues.filter(item => item.severity === 'WARNING');
const questionText = entry => [...new Set(caseWarnings(entry).map(item => `${item.step_order ? `步骤 ${item.step_order}：` : ''}${item.message}`))].join('\n');

function sourceReference(raw, sources, messages) {
  if (!plain(raw) || raw.validity === 'INVALID') return null;
  const sourceId = text(raw.source_id, 200), segmentId = text(raw.segment_id, 200), messageId = text(raw.message_id, 200), quote = text(raw.quote, 3000);
  if (messageId) {
    if (segmentId || (sourceId && sourceId !== 'conversation')) return null;
    const message = messages.find(item => item.id === messageId && item.role === 'user');
    if (!message || typeof message.text !== 'string' || (quote && !message.text.includes(quote))) return null;
    return { message_id: messageId, ...(quote ? { quote } : {}) };
  }
  const source = sources.find(item => item.snapshot_id === sourceId);
  const segment = source?.segments?.find(item => item.segment_id === segmentId);
  if (!source || source.kind === 'IMAGE' || !segment || typeof segment.text !== 'string' || (quote && !segment.text.includes(quote))) return null;
  return { source_id: sourceId, segment_id: segmentId, ...(quote ? { quote } : {}) };
}

function supportEvidence(references, sources, messages) {
  return references.flatMap((ref, reference_index) => {
    let verified;
    try { verified = sourceReference(ref, sources, messages); } catch { return []; }
    if (!verified) return [];
    const text = verified.message_id ? messages.find(item => item.id === verified.message_id).text
      : sources.find(item => item.snapshot_id === verified.source_id).segments.find(item => item.segment_id === verified.segment_id).text;
    return [{ text, quote: verified.quote, reference_index }];
  });
}

function normalizeImages(raw, sources) {
  return array(raw ?? [], 100).map(item => {
    if (!plain(item)) throw Error(FAIL);
    const sourceId = text(item.source_id ?? item.snapshot_id, 200), imageId = text(item.image_id, 200);
    const source = sources.find(entry => entry.snapshot_id === sourceId);
    const known = source && (imageId ? source.embedded_images?.some(image => image.image_id === imageId) : source.kind === 'IMAGE');
    if (!known) throw Error('CASE_ASSISTANT_IMAGE_SOURCE_INVALID');
    return { source_id: sourceId, ...(imageId ? { image_id: imageId } : {}), observations: array(item.observations ?? [], 40).map(observation => {
      if (!plain(observation)) throw Error(FAIL);
      return { description: text(observation.description, 1500), location: text(observation.location, 500) };
    }), uncertainties: strings(item.uncertainties) };
  });
}

/** ready means Excel-compatible draft only; every case still requires human confirmation. */
export function checkAssistantOutput(raw, { sources = [], messages = [] } = {}) {
  if (!plain(raw)) throw Error(FAIL);
  const result = { reply: text(raw.reply, 20000), questions: strings(raw.questions), cases: [], image_observations: normalizeImages(raw.image_observations, sources) };
  const globalIssues = [];
  for (const field of ['reply', 'questions', 'image_observations']) if (JSON.stringify(result[field]).includes('\uFFFD'))
    globalIssues.push({ ...issue('CASE_TEXT_ENCODING_INVALID', '回复、问题或图片观察含乱码字符，请根据原资料重新表述。'), field });
  for (const [index, input] of array(raw.cases ?? [], 200).entries()) {
    const value = plain(input) ? input : {};
    const id = typeof value.case_id === 'string' && value.case_id.trim() ? value.case_id.trim() : `case-draft-${index + 1}`;
    const issues = [], add = (code, message, order, severity = 'BLOCKING') => issues.push(issue(code, message, id, order, severity));
    // Invalid values are normalized for display; retain their blockers when rechecking saved output.
    for (const saved of Array.isArray(value.checks?.issues) ? value.checks.issues : [])
      if (NORMALIZATION_ISSUES.has(saved?.code)) add(saved.code, text(saved.message, 1500), saved.step_order);
    const readText = (rawValue, field, max = 5000) => {
      if (rawValue == null) return '';
      if (typeof rawValue !== 'string') { add('CASE_FIELD_TYPE_INVALID', `${field} 必须为文字。`); return ''; }
      if (rawValue.length > max) add('CASE_FIELD_LENGTH_INVALID', `${field} 超出 ${max} 字符限制，请拆分或精简。`);
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(rawValue)) add('CASE_TEXT_CONTROL_INVALID', `${field} 含 Excel 不支持的控制字符。`);
      return rawValue.trim();
    };
    const readArray = (rawValue, field, max) => {
      if (rawValue == null) return [];
      if (!Array.isArray(rawValue)) { add('CASE_FIELD_TYPE_INVALID', `${field} 必须为列表。`); return []; }
      if (rawValue.length > max) add('CASE_FIELD_LENGTH_INVALID', `${field} 超出 ${max} 项限制，请拆分。`);
      return rawValue;
    };
    if (!plain(input)) add('CASE_STRUCTURE_INVALID', '用例必须为包含编号、标题与步骤的对象。');
    const entry = { case_id: readText(value.case_id, 'case_id', 200) || id, case_type: readText(value.case_type, 'case_type', 30), external_id: readText(value.external_id, 'external_id', 200), title: readText(value.title, 'title', 500),
      module: readText(value.module, 'module', 500), preconditions: readText(value.preconditions, 'preconditions'), test_data: readText(value.test_data, 'test_data'),
      steps: [], pending_questions: readArray(value.pending_questions, 'pending_questions', 40).map(item => readText(item, 'pending_questions', 1500)).filter(Boolean), status: 'PENDING_CONFIRMATION' };
    for (const field of ['case_id', 'case_type', 'external_id', 'title', 'module', 'preconditions', 'test_data', 'pending_questions'])
      if (JSON.stringify(entry[field]).includes('\uFFFD')) issues.push({ ...issue('CASE_TEXT_ENCODING_INVALID', '用例文字含乱码字符，请根据原资料重新表述。', id), field });
    if (!['UI', 'BACKEND'].includes(entry.case_type)) add('CASE_TYPE_REQUIRED', '请明确是前端 UI 还是后端用例。');
    if (!entry.external_id) add('CASE_ID_REQUIRED', '缺少用例编号。');
    if (!entry.title) add('CASE_TITLE_REQUIRED', '缺少用例标题。');
    for (const [stepIndex, step] of readArray(value.steps, 'steps', 100).entries()) {
      if (!plain(step)) { add('STEP_STRUCTURE_INVALID', '步骤必须为包含操作和预期的对象。', stepIndex + 1); continue; }
      const action = readText(step.action, 'action', 3000), rawExpected = readText(step.expected, 'expected', 3000), expected = rawExpected || UNRESOLVED_EXPECTED, order = stepIndex + 1;
      for (const [field, value] of Object.entries({ action, expected, source_refs: step.source_refs ?? [] }))
        if (JSON.stringify(value).includes('\uFFFD')) issues.push({ ...issue('CASE_TEXT_ENCODING_INVALID', '步骤文字或引用含乱码字符，请根据原资料重新表述。', id, order), field });
      if (step.order !== order) add('STEP_ORDER_INVALID', '步骤编号须从 1 连续排列。', order);
      if (!action) add('STEP_ACTION_REQUIRED', '本步骤缺少操作。', order);
      if (/\r|\n/.test(action) || /\r|\n/.test(expected)) add('STEP_LINE_BREAK', '一个步骤的动作和预期各须保持一行；请将子步骤拆为对应步骤。', order);
      if (/^(?:(?:待(?:确认|补充|澄清)|未知|TBD|TODO)(?:[：:。.!！?？]|$)|预期留空)/i.test(expected)) add('STEP_EXPECTED_UNRESOLVED', '预期尚未确定，请测试工程师补充。', order, 'WARNING');
      const references = [];
      for (const ref of readArray(step.source_refs, 'source_refs', 30)) {
        const saved = plain(ref) ? Object.fromEntries(['reference_id', 'source_id', 'segment_id', 'message_id', 'quote', 'validity', 'issue'].filter(key => ref[key] != null).map(key => [key, readText(ref[key], `source_refs.${key}`, key === 'quote' ? 3000 : 200)])) : {};
        if (!plain(ref)) add('SOURCE_REF_STRUCTURE_INVALID', '来源引用必须为对象。', order);
        let normalized = null;
        try { normalized = sourceReference(saved, sources, messages); } catch { /* Keep malformed reference and the field-size issue. */ }
        if (normalized) references.push(normalized);
        else {
          // Preserve rejected identities and MCP validation markers across saved-result checks.
          references.push(saved);
          add('SOURCE_REF_INVALID', '来源未核实：不存在、未读取、引文不符，或不是文档片段/用户补充。', order, 'WARNING');
        }
      }
      if (!references.some(ref => { try { return sourceReference(ref, sources, messages); } catch { return false; } })) add('EXPECTED_SOURCE_REQUIRED', '本步骤缺少可核对的文档或用户补充来源，请测试工程师核对。', order, 'WARNING');
      const evidence = supportEvidence(references, sources, messages);
      const source_support = { action: sourceTextSupport(action, evidence), expected: sourceTextSupport(expected, evidence), semantic_status: 'NOT_REVIEWED' };
      for (const [field, label, content] of [['action', '动作', action], ['expected', '预期', expected]]) {
        if (content && source_support[field].status === 'UNVERIFIED') issues.push({
          ...issue('STEP_SOURCE_SUPPORT_UNVERIFIED', `${label}完整表述未核对为所引来源原句，请人工核对（改写不等于错误）：${content.slice(0, 100)}`, id, order, 'WARNING'), field,
        });
      }
      entry.steps.push({ order: step.order, action, expected, source_refs: references, source_support });
    }
    if (!entry.steps.length) add('CASE_STEPS_REQUIRED', '缺少测试步骤。');
    if (['action', 'expected'].some(key => entry.steps.map(step => step[key]).join('\n').length > 32767) ||
        JSON.stringify(entry.steps.map(step => ({ step: step.order, source_refs: step.source_refs }))).length > 32767)
      add('CASE_WORKBOOK_CELL_LIMIT', '单条用例超出 Excel 单元格上限，请拆为可独立执行的用例。');
    if (/(?:同上|同基线|沿用上一(?:条|个)?用例|参照上一(?:条|个)?用例)/.test(`${entry.preconditions}\n${entry.test_data}`)) add('CASE_DATA_NOT_STANDALONE', '前置条件与数据依赖其他用例，请展开为可独立使用的内容。', null, 'WARNING');
    entry.pending_questions.forEach(question => add('CASE_CLARIFICATION_REQUIRED', question, null, 'WARNING'));
    entry.checks = { ready: !issues.some(item => item.severity === 'BLOCKING'), semantic_status: 'NOT_REVIEWED', issues };
    result.cases.push(entry);
  }
  for (const key of ['case_id', 'external_id']) {
    const groups = new Map();
    for (const entry of result.cases) if (entry[key]) groups.set(entry[key], [...(groups.get(entry[key]) ?? []), entry]);
    for (const entries of groups.values()) if (entries.length > 1) for (const entry of entries) {
      entry.checks.issues.push(issue('CASE_ID_DUPLICATE', `${key === 'case_id' ? '内部标识' : '用例编号'}重复，请为每条用例保留独立编号。`, entry.case_id));
      entry.checks.ready = false;
    }
  }
  if (globalIssues.length) for (const entry of result.cases) entry.checks.ready = false;
  if (result.cases.length && result.questions.length) {
    const assigned = new Set(result.cases.flatMap(entry => entry.pending_questions));
    const unassigned = result.questions.filter(question => !assigned.has(question));
    for (const entry of result.cases) {
      for (const question of unassigned) entry.checks.issues.push(issue('GLOBAL_QUESTIONS_UNRESOLVED', `本轮待核对：${question}`, entry.case_id, null, 'WARNING'));
    }
  }
  for (const entry of result.cases) {
    if (questionText(entry).length > 32767) {
      entry.checks.issues.push(issue('CASE_WORKBOOK_CELL_LIMIT', '待补充问题超出 Excel 单元格上限，请精简或拆分。', entry.case_id));
      entry.checks.ready = false;
    }
    entry.checks.content_warning_count = caseWarnings(entry).length;
  }
  const ready = result.cases.filter(entry => entry.checks.ready);
  const warningCount = result.cases.filter(entry => entry.checks.content_warning_count > 0).length;
  result.checks = { status: globalIssues.length ? 'NEEDS_CLARIFICATION' : result.cases.length ? (ready.length === result.cases.length && !warningCount ? 'READY_FOR_REVIEW' : 'NEEDS_CLARIFICATION') : 'WAITING_FOR_INPUT',
    semantic_status: 'NOT_REVIEWED',
    issues: [...globalIssues, ...result.cases.flatMap(entry => entry.checks.issues)], total_count: result.cases.length, ready_count: ready.length,
    pending_count: result.cases.length - ready.length, content_warning_count: warningCount,
    by_type: Object.fromEntries(['UI', 'BACKEND'].map(type => [type, { ready_count: ready.filter(entry => entry.case_type === type).length, pending_count: result.cases.filter(entry => entry.case_type === type && !entry.checks.ready).length }])),
    limitation: '可下载仅表示 Excel 格式可导入；DIRECT_QUOTE 仅表示完整文字可在所引来源中找到，不证明业务语义正确。改写或未匹配表述保留待核对提示；所有用例均待确认、语义未审查、未执行。' };
  return result;
}

const HEADERS = ['用例编号', '用例标题', '模块', '前置条件', '测试数据', '测试步骤', '预期结果', '内容状态', '用例层级', '来源依据', '待补充问题', '执行状态'];
function styleSheet(sheet, widths) {
  sheet.columns.forEach((column, index) => { column.width = widths[index] ?? 30; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF116D67' } };
  sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
}

export async function exportAssistantWorkbook({ conversation, turn, caseType }) {
  if (!['UI', 'BACKEND'].includes(caseType)) throw Error('CASE_ASSISTANT_CASE_TYPE_INVALID');
  const sources = conversation?.sources ?? [], messages = conversation?.messages ?? [];
  const checked = checkAssistantOutput(turn?.output ?? turn?.response ?? turn?.result ?? turn, { sources, messages });
  const selected = checked.cases.filter(entry => entry.case_type === caseType && entry.checks.ready);
  if (!selected.length) throw Error('CASE_ASSISTANT_EXPORT_NO_READY_CASES');
  const pending = checked.cases.filter(entry => entry.case_type === caseType && !entry.checks.ready);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '测试工作台';
  const sheet = workbook.addWorksheet('测试用例');
  sheet.addRow(HEADERS);
  for (const entry of selected) {
    const refs = entry.steps.map(step => ({ step: step.order, source_refs: step.source_refs }));
    const row = sheet.addRow([entry.external_id, entry.title, entry.module, entry.preconditions, entry.test_data,
      entry.steps.map(step => step.action).join('\n'), entry.steps.map(step => step.expected).join('\n'),
      '待确认', caseType, JSON.stringify(refs), questionText(entry), '未执行']);
    row.getCell(1).numFmt = '@';
  }
  styleSheet(sheet, [18, 32, 20, 40, 40, 65, 65, 16, 16, 65, 35, 16]);
  sheet.autoFilter = { from: 'A1', to: `L${sheet.rowCount}` };
  const notes = workbook.addWorksheet('资料与说明');
  notes.addRow(['项目', '标识', '说明', '依据原文或问题']);
  notes.addRow(['下载范围', caseType, `主表包含 ${selected.length} 条格式合格的草稿；格式受阻 ${pending.length} 条不进入主表。`, '导入时选择第一张「测试用例」工作表；请先核对并补充业务内容。']);
  notes.addRow(['检查边界', '', checked.checks.limitation, '下载及导入不代表人工已确认，也不代表测试已执行。']);
  notes.addRow(['会话', conversation?.conversation_id ?? conversation?.id ?? '', turn?.turn_id ?? turn?.id ?? '', conversation?.title ?? '']);
  for (const source of sources) {
    notes.addRow(['资料', source.snapshot_id, `${source.file_name ?? ''} / SHA256 ${source.sha256 ?? ''}`, source.read_status ?? '']);
    for (const segment of source.segments ?? []) notes.addRow(['片段', `${source.snapshot_id}/${segment.segment_id}`, JSON.stringify(segment.location ?? {}), String(segment.text ?? '').length > 32000 ? `${segment.text.slice(0, 32000)}\n[长片段仅展示前 32000 字，请对照原资料]` : segment.text]);
  }
  for (const message of messages.filter(item => item.role === 'user')) notes.addRow(['用户补充', message.id, message.created_at ?? '', String(message.text ?? '').slice(0, 32000)]);
  for (const entry of selected) if (entry.checks.content_warning_count) notes.addRow(['内容待核对（已进入主表）', entry.external_id, entry.title, questionText(entry)]);
  for (const entry of pending) notes.addRow(['格式受阻（未进入主表）', entry.external_id || entry.case_id, entry.title, entry.checks.issues.map(item => `${item.step_order ? `步骤 ${item.step_order}：` : ''}${item.message}`).join('\n').slice(0, 32000)]);
  for (const question of checked.questions) notes.addRow(['本轮问题', '', '', question]);
  notes.eachRow(row => row.eachCell(cell => {
    if (typeof cell.value === 'string' && cell.value.length > 32000) cell.value = `${cell.value.slice(0, 32000)}\n[内容过长，仅展示前 32000 字；完整内容保留在会话中]`;
  }));
  styleSheet(notes, [27, 45, 55, 100]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw Error('CASE_ASSISTANT_EXPORT_TOO_LARGE');
  return bytes;
}
