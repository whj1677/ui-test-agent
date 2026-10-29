// A design check is a bounded, model-declared set of facts. This module verifies
// only facts it can locate and recompute; it never judges business correctness.
const ARRAYS = ['source_refs', 'prerequisites', 'text_lengths', 'time_ranges', 'state_transitions', 'observations'];
const LIMIT = 20;
const TEXT_LIMIT = 500;
const OFFSET_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/;
const REF_KEYS = ['snapshot_id', 'segment_id', 'quote_sha256'];
const KNOWN = {
  root: ['target', ...ARRAYS], prerequisite: ['name', 'value', 'source_refs'],
  text_length: ['label', 'value', 'trim', 'claimed_length', 'step_order'],
  time_range: ['label', 'now', 'start', 'end', 'claimed_duration_minutes', 'claimed_lead_minutes', 'step_order'],
  transition: ['record_id', 'before', 'after', 'step_order'],
  observation: ['step_order', 'description'], ref: REF_KEYS,
};
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function keys(value, allowed) { return object(value) && Object.keys(value).every((key) => allowed.includes(key)); }
function str(value, max = TEXT_LIMIT) { return typeof value === 'string' && value.length > 0 && value.length <= max; }
function integer(value, max = 1000000) { return Number.isSafeInteger(value) && value >= 0 && value <= max; }
function signedNumber(value, max = 1000000) { return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max; }
function stepExists(order, content) { return Number.isInteger(order) && content.steps.filter((step) => step?.order === order).length === 1; }
function stepFor(content, order) { return content.steps.find((step) => step?.order === order); }
function inputText(content, order, preconditions = false) {
  const step = stepFor(content, order);
  return `${preconditions ? `${content.preconditions || ''}\n` : ''}${content.test_data || ''}\n${step?.action || ''}`;
}
function fieldText(content, order) {
  const step = stepFor(content, order);
  return `${content.preconditions || ''}\n${content.test_data || ''}\n${step?.action || ''}\n${step?.expected || ''}`;
}
function allText(content) { return `${content.preconditions || ''}\n${content.test_data || ''}\n${content.steps.map((s) => `${s.action || ''}\n${s.expected || ''}`).join('\n')}`; }
function minutes(value) {
  if (!str(value, 40) || !OFFSET_TIME.test(value)) return null;
  const [, year, month, day, hour, minute, second = '00'] =
    value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/);
  if (+month < 1 || +month > 12 || +hour > 23 || +minute > 59 || +second > 59 ||
      new Date(Date.UTC(+year, +month - 1, +day)).getUTCDate() !== +day) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}
function isValidRef(ref, design, sources) {
  if (!keys(ref, KNOWN.ref) || !REF_KEYS.every((key) => str(ref[key], 200))) return false;
  const selected = design?.source_refs?.find((item) => item.snapshot_id === ref.snapshot_id);
  const source = sources?.find((item) => item.snapshot_id === ref.snapshot_id);
  return Boolean(selected && source && source.project_id === design.project_id &&
    selected.sha256 === source.sha256 && source.segments?.some((segment) =>
      segment.segment_id === ref.segment_id && segment.quote_sha256 === ref.quote_sha256));
}
function shape(raw, content) {
  if (!keys(raw, KNOWN.root) || !str(raw.target) || !object(content) || !Array.isArray(content.steps) || !content.steps.length) return false;
  if (JSON.stringify(raw).length > 65536) return false;
  if (ARRAYS.some((name) => !Array.isArray(raw[name]) || raw[name].length > LIMIT)) return false;
  if (raw.source_refs.some((ref) => !keys(ref, KNOWN.ref) || !REF_KEYS.every((key) => str(ref[key], 200)))) return false;
  if (raw.prerequisites.some((x) => !keys(x, KNOWN.prerequisite) || !str(x.name) || !str(x.value) || !Array.isArray(x.source_refs) || x.source_refs.length > LIMIT ||
      x.source_refs.some((ref) => !keys(ref, KNOWN.ref) || !REF_KEYS.every((key) => str(ref[key], 200))))) return false;
  if (raw.text_lengths.some((x) => !keys(x, KNOWN.text_length) || !str(x.label) || !str(x.value) || typeof x.trim !== 'boolean' || !integer(x.claimed_length) || !stepExists(x.step_order, content))) return false;
  if (raw.time_ranges.some((x) => !keys(x, KNOWN.time_range) || !str(x.label) || ![x.now, x.start, x.end].every((v) => str(v, 40)) || !signedNumber(x.claimed_duration_minutes) || !signedNumber(x.claimed_lead_minutes) || !stepExists(x.step_order, content))) return false;
  if (raw.state_transitions.some((x) => !keys(x, KNOWN.transition) || !str(x.record_id) || !str(x.before) || !str(x.after) || !stepExists(x.step_order, content))) return false;
  if (raw.observations.some((x) => !keys(x, KNOWN.observation) || !str(x.description) || !stepExists(x.step_order, content))) return false;
  return true;
}

export function evaluateDesignCheck(raw, candidateContent, design, sources) {
  const findings = [];
  const calculations = [];
  const add = (code, message, step_order = null, source_refs = null) => findings.push({ code, message,
    severity: 'CLARIFICATION', step_order,
    source_refs: source_refs ?? (Array.isArray(raw?.source_refs)
      ? raw.source_refs.filter((ref) => isValidRef(ref, design, sources)) : []) });
  if (!shape(raw, candidateContent)) {
    add('DESIGN_CHECK_NOT_CHECKED', '结构化检查缺失或格式、数量、字段长度超限；保留候选供人工核对。');
    return { status: 'NOT_CHECKED', normalized: null, findings, calculations };
  }
  const normalized = structuredClone(raw);
  const refs = [...raw.source_refs, ...raw.prerequisites.flatMap((item) => item.source_refs)];
  if (refs.some((ref) => !isValidRef(ref, design, sources))) add('DESIGN_CHECK_SOURCE_INVALID', '声明引用不属于当前选中来源或片段摘要不匹配。');
  if (raw.source_refs.length === 0) add('DESIGN_CHECK_SOURCE_MISSING', '检查目标没有可核对来源引用。');
  if (!allText(candidateContent).includes(raw.target)) add('DESIGN_CHECK_TARGET_UNLOCATED', '检查目标未在候选正文定位；不能证明该声明属于本候选。');
  for (const item of raw.prerequisites) {
    if (item.source_refs.some((ref) => !isValidRef(ref, design, sources))) add('DESIGN_CHECK_SOURCE_INVALID', `前提「${item.name}」引用无效。`);
    if (!allText(candidateContent).includes(item.value)) add('DESIGN_CHECK_PREREQUISITE_UNLOCATED', `前提「${item.name}」的具体值未在正文定位。`);
  }
  for (const item of raw.text_lengths) {
    const text = inputText(candidateContent, item.step_order);
    const located = text.includes(item.value);
    const actual = Array.from(item.trim ? item.value.trim() : item.value).length;
    calculations.push({ kind: 'TEXT_LENGTH', label: item.label, step_order: item.step_order, expected: item.claimed_length, actual, located });
    if (!located) add('DESIGN_CHECK_VALUE_UNLOCATED', `长度数据「${item.label}」未在测试数据或对应步骤定位。`, item.step_order);
    if (actual !== item.claimed_length) add('DESIGN_CHECK_LENGTH_MISMATCH', `长度数据「${item.label}」声明 ${item.claimed_length}，按 Unicode code point 重算为 ${actual}。`, item.step_order);
  }
  for (const item of raw.time_ranges) {
    const text = inputText(candidateContent, item.step_order, true);
    const values = [item.now, item.start, item.end].map(minutes);
    const located = [item.now, item.start, item.end].every((value) => text.includes(value));
    const actualDuration = values.every((v) => v !== null) ? (values[2] - values[1]) / 60000 : null;
    const actualLead = values.every((v) => v !== null) ? (values[1] - values[0]) / 60000 : null;
    calculations.push({ kind: 'TIME_RANGE', label: item.label, step_order: item.step_order,
      expected: { duration_minutes: item.claimed_duration_minutes, lead_minutes: item.claimed_lead_minutes },
      actual: { duration_minutes: actualDuration, lead_minutes: actualLead }, located });
    if (!located) add('DESIGN_CHECK_TIME_UNLOCATED', `时间数据「${item.label}」未在前提、测试数据或对应步骤逐字定位。`, item.step_order);
    if (values.some((v) => v === null)) add('DESIGN_CHECK_TIME_INVALID', `时间数据「${item.label}」不是可核算的带偏移时间。`, item.step_order);
    else if (actualDuration !== item.claimed_duration_minutes || actualLead !== item.claimed_lead_minutes)
      add('DESIGN_CHECK_TIME_MISMATCH', `时间数据「${item.label}」声明的时长或提前量与实际算术不符。`, item.step_order);
  }
  const recordStates = new Map();
  for (const item of [...raw.state_transitions].sort((a, b) => a.step_order - b.step_order)) {
    const text = fieldText(candidateContent, item.step_order);
    const located = [item.record_id, item.before, item.after].every((value) => text.includes(value));
    const previous = recordStates.get(item.record_id);
    calculations.push({ kind: 'STATE_TRANSITION', record_id: item.record_id, step_order: item.step_order,
      expected: item.before, actual: previous ?? null, after: item.after, located });
    if (!located) add('DESIGN_CHECK_STATE_UNLOCATED', `记录「${item.record_id}」的初始/目标状态未在正文定位。`, item.step_order);
    if (previous !== undefined && previous !== item.before) add('DESIGN_CHECK_STATE_CHAIN_MISMATCH', `记录「${item.record_id}」前一步状态为 ${previous}，本步却声明 ${item.before}。`, item.step_order);
    recordStates.set(item.record_id, item.after);
  }
  for (const item of raw.observations) {
    calculations.push({ kind: 'OBSERVATION_REF', step_order: item.step_order, description: item.description,
      located: fieldText(candidateContent, item.step_order).includes(item.description) });
    if (!fieldText(candidateContent, item.step_order).includes(item.description))
      add('DESIGN_CHECK_OBSERVATION_UNLOCATED', `观察声明未在第 ${item.step_order} 步逐字定位；是否实际查询仍待审查。`, item.step_order);
  }
  return { status: findings.length ? 'NEEDS_REVIEW' : 'CHECKED', normalized, findings, calculations };
}
