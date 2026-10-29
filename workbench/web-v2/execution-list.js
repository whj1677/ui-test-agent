import {loadNativeConsole,nativeConsoleModel,nativeRecordsHtml,bindNativeConsole} from './native-console-view.js';
import { executionSteps, displayFailureStep } from './execution-media.js';
import { esc, stateLabel, batchReasons } from './workflow.js';

const abnormal = row => row.kind !== 'passed';
const backendRun = run => run?.runner_kind === 'HTTP_JSON' || run?.selection?.kind === 'HTTP_JSON' || run?.schema === 'workbench/backend-run-v1';
export function executionIndexMeta(run, projectId) {
  if (!backendRun(run)) return {
    source: `${run.source_external_id} · v${run.source_case_version}`,
    origin: run.origin === 'EXPLICIT_CANDIDATE_TRIAL' ? '本次显式试跑' : run.origin === 'DEVELOPMENT_SELF_TEST' ? '开发自测' : '首次独立验证',
    taskHref: `#/history?task_id=${encodeURIComponent(run.source_build_task_id)}`,
    taskLabel: '查看任务',
    batchHref: null,
  };
  const planVersion = run.script_version ?? run.candidate_version;
  const caseVersion = run.executed_case_version ?? run.case_version;
  const planId = run.source_build_task_id;
  const caseId = run.executed_case_id ?? run.case_id;
  const source = `HTTP 计划${planVersion == null ? '' : ` P${planVersion}`} · 用例${caseVersion == null ? '版本未记录' : ` v${caseVersion}`}`;
  const planHref = typeof planId === 'string' && planId.startsWith('plan-') && typeof caseId === 'string' && caseId && Number.isSafeInteger(caseVersion)
    ? `#/projects/${encodeURIComponent(projectId)}/cases/${encodeURIComponent(caseId)}?version=${caseVersion}&tab=scripts&plan_id=${encodeURIComponent(planId)}` : null;
  return {
    source,
    origin: run.batch_id ? '批次技术执行' : '后端计划技术执行',
    taskHref: planHref,
    taskLabel: '查看 HTTP 计划',
    batchHref: run.batch_id ? `#/projects/${encodeURIComponent(projectId)}/batches?batch_id=${encodeURIComponent(run.batch_id)}` : null,
  };
}
const failedStatuses = ['FAILED', 'TIMEDOUT', 'TIMED_OUT', 'ERROR'];
const failureCategories = {
  SCRIPT_ERROR: '脚本实现问题', ENVIRONMENT_BLOCKED: '环境阻塞',
  BUSINESS_DIFFERENCE: '疑似产品差异', NEEDS_ANALYSIS: '待分析', NO_FAILURE: '无失败',
};
export function failureFeedbackForRun(run) {
  const feedback = run?.failure_feedback;
  const identity = feedback?.identity;
  if (feedback?.schema !== 'workbench/failure-feedback-v1' || !identity ||
      identity.run_id !== run.run_id || identity.project_id !== run.project_id ||
      identity.case_id !== run.executed_case_id || identity.case_version !== run.executed_case_version ||
      identity.source_task_id !== run.source_build_task_id ||
      String(identity.candidate_version) !== String(run.candidate_version) ||
      identity.bundle_sha256 !== run.bundle_sha256 ||
      identity.environment_id !== (run.environment_id || run.selection?.environment_id) ||
      !Object.hasOwn(failureCategories, feedback.classification?.category)) return null;
  return feedback;
}
export function failureCategoryForRun(run) {
  const category = failureFeedbackForRun(run)?.classification.category;
  return category === 'NO_FAILURE' && failedStatuses.includes(run?.status) ? 'NEEDS_ANALYSIS' : category || 'NEEDS_ANALYSIS';
}
export function failureFeedbackHtml(run) {
  const feedback = failureFeedbackForRun(run);
  const category = failureCategoryForRun(run);
  const steps = Array.isArray(feedback?.steps) ? feedback.steps : [];
  const failed = steps.filter(step => step && (step.status === 'FAILED' || step.execution_status === 'FAILED')).slice(0, 3);
  const next = feedback?.classification?.next_action;
  return `<div class="execution-feedback-summary"><strong>系统分类：${esc(failureCategories[category])}</strong>${failed.map(step=>`<small>步骤 ${esc(step.order ?? step.step_id ?? '未编号')} · 原预期：${esc(visibleValue(step.expected))} · 可信实际：${esc(step.actual_recorded ? step.actual === null ? 'null' : brief(step.actual) : '未采集')}</small>`).join('')}${run?.run_id?`<small>证据：原运行 ${esc(run.run_id)} 的步骤记录与媒体；先核对记录身份。</small>`:''}${next ? `<small>下一步：${esc(brief(next, 180))}</small>` : '<small>下一步：核对原运行证据；原因未确认前不要改变业务预期。</small>'}</div>`;
}
const valueText = value => value != null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
const brief = (value, limit = 110) => {
  const text = valueText(value).replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};
const visibleValue = value => value == null || value === '' ? '未单独采集' : brief(value);
const visibleActual = row => row.actual_exists === false ? '字段不存在'
  : row.actual_recorded !== true ? row.actual_exists === true ? '字段存在，实际值未记录' : '未记录'
  : row.actual === null ? 'null' : row.actual === '' ? '""（空字符串）' : brief(row.actual);
const rowId = (batchId, item, run) => `${batchId || 'history'}:${item?.case_id || run?.executed_case_id}:${item?.case_version || run?.executed_case_version}:${run?.run_id || 'no-run'}`;
const runBelongsToItem = (run, item, batch, projectId) => Boolean(run &&
  run.project_id === projectId && run.batch_id === batch.batch_id &&
  run.executed_case_id === item.case_id && run.executed_case_version === item.case_version && item.selection &&
  run.source_build_task_id === item.selection.source_task_id && run.candidate_version === item.selection.candidate_version &&
  Boolean(item.selection.bundle_sha256) && run.bundle_sha256 === item.selection.bundle_sha256);

function resultDetails(run) {
  if (!run) return { failureStep: null, expected: null, actual: null };
  if (backendRun(run)) {
    const evidence = run.http_evidence || run;
    const requests = [
      ...(evidence.setup || []).map(request => ({ request, phase: 'setup', step: null })),
      ...(evidence.steps || []).flatMap(step => (step.requests || []).map(request => ({ request, phase: 'step', step }))),
      ...(evidence.cleanup || []).map(request => ({ request, phase: 'cleanup', step: null })),
    ];
    const first = requests.find(({ request }) => failedStatuses.includes(request.status) || request.status === 'CANCELLED' || request.assertions?.some(assertion => assertion.status === 'FAILED'));
    if (!first) return { failureStep: null, expected: null, actual: run.technical_error?.code || null };
    const { request, phase, step } = first;
    const assertion = request.assertions?.find(item => item.status === 'FAILED');
    const path = request.request?.path || request.request?.url || null;
    let groupPath = path;
    if (groupPath) {
      try { const url = new URL(groupPath); groupPath = url.pathname + url.search; } catch { /* Stored relative paths remain relative. */ }
      if (run.namespace_id) groupPath = groupPath.split(encodeURIComponent(run.namespace_id)).join('{{runId}}');
    }
    const hasActual = Boolean(assertion && Object.hasOwn(assertion, 'actual'));
    const fallbackActual = request.error?.code || (request.response?.status ? `HTTP ${request.response.status}` : null);
    return {
      failureStep: phase === 'step' ? `CASE_STEP_${step.order}` : phase === 'setup' ? 'HTTP_SETUP' : 'HTTP_CLEANUP',
      expected: assertion && Object.hasOwn(assertion, 'expected') ? assertion.expected : step?.expected ?? null,
      actual: assertion ? hasActual ? assertion.actual : null : fallbackActual,
      actualExists: assertion && Object.hasOwn(assertion, 'actual_exists') ? assertion.actual_exists : null,
      actualRecorded: assertion ? hasActual : Boolean(fallbackActual),
      requestId: request.request_id || null, requestMethod: request.request?.method || null, requestPath: path, requestGroupPath: groupPath,
      requestPhase: phase, requestErrorCode: request.error?.code || null, assertionTarget: assertion?.target || null, assertionPointer: assertion?.pointer ?? null,
    };
  }
  const steps = executionSteps(run);
  const marker = displayFailureStep(run);
  const failed = steps.find(step => step.execution_status === 'FAILED') ||
    steps.find(step => marker && (step.step_id === marker || `CASE_STEP_${step.order}` === marker));
  const actualSource = ['PLAYWRIGHT_MATCHER_RESULT', 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS'].includes(failed?.value_source) &&
    failed?.actual_recorded !== false ? failed : null;
  return {
    failureStep: marker || failed?.step_id || null,
    expected: failed?.expected ?? run.frozen_case_content?.steps?.find(step => `CASE_STEP_${step.order}` === marker)?.expected ?? null,
    actual: actualSource ? actualSource.actual : null,
    actualExists: null,
    actualRecorded: Boolean(actualSource && actualSource.actual != null),
  };
}

function makeRow(project, item, run, batch = null) {
  const details = resultDetails(run);
  const caseId = item?.case_id || run?.executed_case_id;
  const version = item?.case_version ?? run?.executed_case_version;
  const knownCase = project.cases.find(entry => entry.case_id === caseId);
  const title = item?.title || knownCase?.versions?.find(entry => entry.version === version)?.content?.title || run?.frozen_case_content?.title || '标题未取得';
  const state = item?.state || run?.execution_status || 'UNKNOWN';
  const status = item?.result || run?.status || null;
  const runMissing = Boolean(item?.run_id && !run);
  const isBackend = backendRun(run) || item?.selection?.kind === 'HTTP_JSON';
  const reason = runMissing ? 'RUN_RECORD_NOT_AVAILABLE' : item?.reason || run?.technical_error?.code || null;
  const kind = runMissing ? 'evidence' : state === 'BLOCKED' ? 'blocked' : (state === 'CANCELLED' || status === 'CANCELLED') ? 'cancelled' : ['NOT_RUN', 'QUEUED'].includes(state) ? 'not-run'
    : run?.evidence_status === 'INCOMPLETE' ? 'evidence'
    : failedStatuses.includes(status) ? 'failed' : status === 'PASSED' ? 'passed' : 'other';
  const identity = item?.selection || (isBackend ? run?.selection : null) || null;
  return {
    id: rowId(batch?.batch_id, item, run), project_id: project.project_id, batch_id: batch?.batch_id || run?.batch_id || null,
    case_id: caseId, case_version: version, external_id: item?.external_id || run?.executed_external_id || knownCase?.external_id || caseId,
    title, state, status, kind, reason, run_id: run?.run_id || item?.run_id || null,
    record_available: Boolean(run),
    source_task_id: identity?.source_task_id || run?.source_build_task_id || null,
    candidate_version: identity?.candidate_version ?? run?.candidate_version ?? null,
    bundle_sha256: identity?.bundle_sha256 || run?.bundle_sha256 || null,
    candidate_sha256: run?.candidate_sha256 || null,
    selection: identity, script_version: item?.script_version || run?.script_version || null,
    software_version: batch?.software_version || run?.software_version || null,
    origin: run?.origin || null, failure_step: details.failureStep, expected: details.expected, actual: details.actual,
    actual_exists: details.actualExists, actual_recorded: details.actualRecorded,
    runner_kind: isBackend ? 'HTTP_JSON' : run?.runner_kind || null,
    model_calls: Number.isSafeInteger(run?.model_calls) && run.model_calls >= 0 ? run.model_calls : null,
    request_attempts: Number.isSafeInteger(run?.requests_sent) && run.requests_sent >= 0 ? run.requests_sent : null,
    failure_request_id: details.requestId || null, failure_request_method: details.requestMethod || null, failure_request_path: details.requestPath || null,
    failure_group_path: details.requestGroupPath || null, failure_phase: details.requestPhase || null,
    assertion_target: details.assertionTarget || null, assertion_pointer: details.assertionPointer ?? null,
    error_type: run?.error?.type || null, error_message: run?.error?.message || null,
    technical_error_code: run?.technical_error?.code || details.requestErrorCode || null, evidence_status: run?.evidence_status || null,
    failure_category: run && failedStatuses.includes(status) ? failureCategoryForRun(run) : null,
    failure_feedback: run && failedStatuses.includes(status) ? failureFeedbackForRun(run) : null,
    eligible_to_rerun: Boolean(batch && item?.selection && !runMissing && item?.state !== 'RUNNING' && item?.state !== 'QUEUED'),
    eligible_to_revise: Boolean((isBackend ? identity?.kind === 'HTTP_JSON' && identity.source_task_id === run?.source_build_task_id && identity.bundle_sha256 === run?.bundle_sha256 : batch && item?.selection) && run?.run_id && run.finished_at &&
      (run.execution_status === 'FINISHED' || run.execution_status == null) && failedStatuses.includes(status)),
  };
}

export function symptomFor(row) {
  if (row.kind === 'passed') return null;
  if (row.failure_category === 'ENVIRONMENT_BLOCKED') return { key: 'classification:ENVIRONMENT_BLOCKED', label: '环境阻塞：先恢复共用环境，再复跑原脚本' };
  if (row.failure_category === 'BUSINESS_DIFFERENCE') return { key: 'classification:BUSINESS_DIFFERENCE', label: '疑似产品差异：保留失败，核对原预期与实际结果' };
  if (row.failure_category === 'SCRIPT_ERROR') return { key: 'classification:SCRIPT_ERROR', label: '脚本实现问题：核对原运行后反馈修订' };
  if (row.kind === 'blocked') return { key: `blocked:${row.reason || 'unknown'}`, label: `阻塞：${batchReasons[row.reason] || row.reason || '原因未登记'}` };
  if (row.kind === 'not-run') return { key: `not-run:${row.reason || row.state}`, label: `未执行：${batchReasons[row.reason] || row.reason || stateLabel(row.state)}` };
  if (row.kind === 'cancelled') return { key: `cancelled:${row.failure_phase || 'unknown'}:${row.failure_group_path || 'unknown'}`, label: `已取消：${row.failure_request_method ? `${row.failure_request_method} ${row.failure_group_path || ''}` : '请核对已发生的请求与清理证据'}` };
  if (row.runner_kind === 'HTTP_JSON' && row.kind === 'failed' && row.failure_request_id) {
    const context = `${row.failure_request_method || ''} ${row.failure_group_path || row.failure_request_id}`.trim();
    const observed = brief(row.technical_error_code || visibleActual(row), 100);
    const target = row.assertion_target === 'status' ? 'HTTP 状态' : row.assertion_pointer || '';
    return { key: `http:${row.failure_phase}:${row.failure_step}:${context}:${target}:${valueText(row.expected)}:${row.actual_exists}:${row.actual_recorded}:${valueText(row.actual)}:${row.technical_error_code || ''}`,
      label: `HTTP ${row.failure_phase === 'cleanup' ? '清理失败' : row.failure_phase === 'setup' ? '初始化失败' : '请求失败'}：${context}${target ? ` · ${target}` : ''}${observed ? ` · ${observed}` : ''}` };
  }
  if (row.technical_error_code) return { key: `technical:${row.technical_error_code}`, label: `技术错误：${row.technical_error_code}` };
  if (row.kind === 'evidence') return { key: `evidence:${row.reason || row.evidence_status}`, label: row.reason === 'RUN_RECORD_NOT_AVAILABLE' ? '批次所指运行记录未取得或身份不匹配' : '执行证据不完整' };
  if (row.kind === 'failed') {
    const observed = brief(row.error_message || row.actual || '', 160);
    const key = `failure:${row.failure_step || 'unknown'}:${row.error_type || 'unknown'}:${observed || 'unobserved'}`;
    return { key, label: observed ? `同一步骤 / 报错：${brief(observed, 80)}` : `执行失败：${row.failure_step || '失败步骤未取得'}` };
  }
  return { key: `other:${row.state}:${row.status}`, label: `其他状态：${stateLabel(row.state)} / ${stateLabel(row.status || 'UNKNOWN')}` };
}

export function buildExecutionListModel({ project, records = [], batches = [], query = new URLSearchParams() }) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const ownBatches = batches.filter(batch => batch.project_id === project.project_id && batch.state !== 'PREVIEW')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const ownRecords = records.filter(run => run.project_id === project.project_id);
  const history = params.get('view') === 'history';
  const requestedId = params.get('batch_id');
  const batch = history ? null : requestedId ? ownBatches.find(entry => entry.batch_id === requestedId) || null : ownBatches[0] || null;
  const invalidBatch = Boolean(requestedId && !history && !batch);
  const byId = new Map(ownRecords.map(run => [run.run_id, run]));
  const rows = invalidBatch ? [] : batch ? batch.items.map(item => {
    const match = item.run_id && byId.get(item.run_id);
    return makeRow(project, item, runBelongsToItem(match, item, batch, project.project_id) ? match : null, batch);
  }) : ownRecords.map(run => makeRow(project, null, run));
  const totals = { requested: rows.length, passed: 0, failed: 0, blocked: 0, evidence: 0, notRun: 0, cancelled: 0, other: 0 };
  for (const row of rows) {
    if (row.kind === 'passed') totals.passed++;
    else if (row.kind === 'failed') totals.failed++;
    else if (row.kind === 'blocked') totals.blocked++;
    else if (row.kind === 'evidence') totals.evidence++;
    else if (row.kind === 'not-run') totals.notRun++;
    else if (row.kind === 'cancelled') totals.cancelled++;
    else totals.other++;
  }
  return { project_id: project.project_id, history: history || !batch && !invalidBatch, invalidBatch, batch, batches: ownBatches, rows, totals };
}

export function filterExecutionRows(rows, { search = '', status = 'all', issue = 'all' } = {}) {
  const term = String(search).trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (status !== 'all' && row.kind !== status) return false;
    if (issue === 'abnormal' && !abnormal(row)) return false;
    if (issue === 'with-actual' && row.actual_recorded !== true && row.actual_exists !== false) return false;
    return !term || [row.external_id, row.title, row.failure_step, row.expected, visibleActual(row), row.reason, row.failure_request_id, row.failure_request_path, row.technical_error_code]
      .some(value => valueText(value).toLocaleLowerCase().includes(term));
  });
}

export function groupExecutionSymptoms(rows) {
  const groups = new Map();
  for (const row of rows) {
    const symptom = symptomFor(row);
    if (!symptom) continue;
    if (!groups.has(symptom.key)) groups.set(symptom.key, { ...symptom, rows: [] });
    groups.get(symptom.key).rows.push(row);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label, 'zh-CN'));
}

const baseFor = projectId => `#/projects/${encodeURIComponent(projectId)}`;
const detailLink = (row, projectId) => `${baseFor(projectId)}/execution-records?run_id=${encodeURIComponent(row.run_id)}`;
const labelFor = row => row.kind === 'passed' ? '通过' : row.kind === 'failed' ? '失败'
  : row.kind === 'blocked' ? '阻塞' : row.kind === 'evidence' ? '证据不完整'
  : row.kind === 'cancelled' ? '已取消'
  : row.kind === 'not-run' ? '未执行 / 已取消' : stateLabel(row.status || row.state);

export function executionRowSummaryHtml(row) {
  const request = row.failure_request_id ? `<small>${esc(row.failure_request_method || '请求')} ${esc(row.failure_request_path || '路径未采集')}</small><small>请求 ${esc(row.failure_request_id)}${row.assertion_target ? ` · ${esc(row.assertion_target === 'status' ? 'HTTP 状态' : row.assertion_pointer || 'JSON 根对象')}` : ''}</small>` : '';
  const failure = ['failed', 'evidence', 'cancelled'].includes(row.kind);
  const category = row.failure_category ? `<small><strong>系统分类：${esc(failureCategories[row.failure_category])}</strong></small>${row.failure_feedback?.classification?.next_action ? `<small>建议：${esc(brief(row.failure_feedback.classification.next_action, 160))}</small>` : ''}` : '';
  const evidence = row.run_id && row.record_available ? `<small><a data-nav href="${detailLink(row,row.project_id)}">核对原运行与媒体证据</a></small>` : '';
  const technical = row.error_message ? `<details><summary>技术报错</summary><pre>${esc(brief(row.error_message, 1600))}</pre></details>` : '';
  return `${category}${row.failure_step ? `<strong>${esc(row.failure_step)}</strong>` : ''}${request}${failure ? `<small>原预期：${esc(visibleValue(row.expected))}</small><small>可信实际：${esc(visibleActual(row))}</small>${evidence}${technical}` : technical || '<small>—</small>'}`;
}

export function executionRowActivityHtml(row) {
  if (row.runner_kind !== 'HTTP_JSON') return '';
  return `<small>模型调用 ${row.model_calls === null ? '未记录' : esc(row.model_calls)} · HTTP 请求尝试 ${row.request_attempts === null ? '未记录' : esc(row.request_attempts)}</small>${row.kind === 'cancelled' ? '<small>取消不代表请求从未发生；请核对清理结果。</small>' : ''}`;
}

export function executionRevisionAvailability(rows) {
  const backend = rows.some(row => row.runner_kind === 'HTTP_JSON' || row.selection?.kind === 'HTTP_JSON');
  if (backend && rows.some(row => row.runner_kind !== 'HTTP_JSON' && row.selection?.kind !== 'HTTP_JSON')) return { enabled: false, reason: '请分别选择前端或后端失败记录，保留各自的执行身份。' };
  if (!backend && rows.some(row => !row.batch_id || row.origin === 'DEVELOPMENT_SELF_TEST')) return { enabled: false, reason: '跨历史记录或开发自测请先进入原运行核对来源；这里仅受理当前批次的正式 UI 失败反馈。' };
  if (rows.length && new Set(rows.map(row => row.case_id)).size !== rows.length) return { enabled: false, reason: '同一用例不能同时选择多条运行。' };
  if (rows.some(row => !row.eligible_to_revise)) return { enabled: false, reason: '仅已结束且有精确脚本或HTTP计划身份的失败运行可在此绑定反馈。' };
  return { enabled: rows.length > 0, reason: '' };
}

export function executionArtifactLabel(row) {
  const backend = row.runner_kind === 'HTTP_JSON';
  if (row.script_version) return `${backend ? '计划 P' : '脚本 S'}${row.script_version}`;
  if (row.candidate_version) return `${backend ? '计划 P' : '候选 v'}${row.candidate_version}`;
  return backend ? '计划版本未取得' : '脚本版本未取得';
}

export async function renderExecutionList({ project, query, showPage, go, api, onRerun, onRevise }) {
  const expectedHash = location.hash;
  const validPage = () => location.hash === expectedHash && location.hash.startsWith(`${baseFor(project.project_id)}/execution-list`);
  const id = encodeURIComponent(project.project_id);
  const [{ records }, { batches }, nativeData] = await Promise.all([
    api(`/api/case-library/projects/${id}/execution-records`),
    api(`/api/case-library/projects/${id}/batches`),
    loadNativeConsole(project,api),
  ]);
  if (!validPage()) return;
  const model = buildExecutionListModel({ project, records, batches, query });
  const showLegacy = Boolean(query.get('batch_id') || model.rows.length || !nativeData.records?.length);
  const selected = new Set();
  const filter = { search: '', status: 'all', issue: 'all' };
  const root = baseFor(project.project_id);
  const batchOptions = model.batches.map(batch => `<option value="${esc(batch.batch_id)}" ${model.batch?.batch_id === batch.batch_id ? 'selected' : ''}>${esc(batch.created_at)} · ${esc(batch.software_version || '软件版本未提供')} · ${batch.items.length} 条</option>`).join('');
  showPage(`<section class="execution-list" data-project-id="${esc(project.project_id)}">
    <div class="page-heading"><div><p class="eyebrow">项目执行</p><h1>${esc(project.name)} · 执行结果</h1><p>逐条查看当前范围的结果和失败摘要；相同现象仅供筛查，根因仍需核对。</p></div></div>
    ${!query.get('batch_id')?nativeRecordsHtml(project,nativeConsoleModel(project,nativeData),{selectedRunId:query.get('native_run')}):''}
    ${showLegacy?`<section class="execution-other-results">${nativeData.records?.length?'<h2>其他运行记录</h2><p class="muted">本节统计常规运行入口保存的记录；DSH 自测结果单独列示。</p>':''}<div class="execution-list-scope"><label>结果范围<select id="execution-scope"><option value="history" ${model.history ? 'selected' : ''}>跨批次历史（各次运行独立）</option>${batchOptions}</select></label><span>${model.invalidBatch ? '指定批次不存在或不属于当前项目；没有替换其他批次。' : model.batch ? `当前批次 ${esc(model.batch.batch_id)} · ${esc(model.batch.software_version || '软件版本未提供')}（用户标签）` : '跨批次历史，不能汇总为一次回归'}</span></div>
    <p class="muted">选择同类失败记录后提交反馈，系统冻结原用例版本、脚本或HTTP计划及实际失败证据。后端可批量载入反馈待办，再逐条审阅并明确启动DSH修订；前端保留当前批次修订流程。开发自测先进入原记录核对。原运行和业务预期保持。</p>
    <div id="execution-list-body"></div></section>`:''}</section>`);
  bindNativeConsole();
  if (!showLegacy) return;
  const host = document.querySelector('.execution-list');
  if (!host || !validPage()) return;
  host.querySelector('#execution-scope').addEventListener('change', event => {
    if (!validPage()) return;
    const value = event.target.value;
    go(value === 'history' ? `${root}/execution-list?view=history` : `${root}/execution-list?batch_id=${encodeURIComponent(value)}`);
  });
  const body = host.querySelector('#execution-list-body');
  const renderRows = () => {
    if (!validPage() || !body.isConnected) return;
    const visible = filterExecutionRows(model.rows, filter);
    const visibleIds = new Set(visible.map(row => row.id));
    for (const id of selected) if (!visibleIds.has(id)) selected.delete(id);
    const groups = groupExecutionSymptoms(visible);
    const selectable = model.batch && !model.invalidBatch;
    const chosen = visible.filter(row => selected.has(row.id));
    const duplicateCases = new Set(chosen.map(row => row.case_id)).size !== chosen.length;
    const rerunnable = chosen.length && !duplicateCases && chosen.every(row => row.eligible_to_rerun);
    const revisionAvailability = executionRevisionAvailability(chosen);
    const revisable = revisionAvailability.enabled;
    body.innerHTML = `<div class="execution-list-metrics" aria-label="当前范围统计"><span>请求 / 记录 <strong>${model.totals.requested}</strong></span><span>通过 <strong>${model.totals.passed}</strong></span><span>失败 <strong>${model.totals.failed}</strong></span><span>阻塞 <strong>${model.totals.blocked}</strong></span><span>证据不完整 <strong>${model.totals.evidence}</strong></span><span>未执行 <strong>${model.totals.notRun}</strong></span><span>已取消 <strong>${model.totals.cancelled}</strong></span><span>其他 <strong>${model.totals.other}</strong></span></div>
      <div class="execution-list-filters"><label>搜索<input id="execution-search" value="${esc(filter.search)}" placeholder="用例、请求路径、失败步骤、预期或实际"></label><label>状态<select id="execution-status"><option value="all">全部状态</option>${[['passed','通过'],['failed','失败'],['blocked','阻塞'],['evidence','证据不完整'],['not-run','未执行'],['cancelled','已取消'],['other','其他']].map(([value,label])=>`<option value="${value}" ${filter.status===value?'selected':''}>${label}</option>`).join('')}</select></label><label>异常筛选<select id="execution-issue"><option value="all">全部</option><option value="abnormal" ${filter.issue==='abnormal'?'selected':''}>只看需处理（异常与未执行）</option><option value="with-actual" ${filter.issue==='with-actual'?'selected':''}>有实际值</option></select></label><span>当前显示 ${visible.length} / ${model.rows.length} 条</span></div>
      ${model.invalidBatch ? '<p role="alert">请选择本项目其他批次或切换跨批次历史。</p>' : ''}
      ${groups.length ? `<section class="execution-symptoms"><h2>相同现象 · 待核对</h2><p>按已记录的状态或报错归组，不判定共同根因，也不自动修改用例预期。</p>${groups.map((group,index)=>`<div class="execution-symptom"><span>${esc(group.label)} · ${group.rows.length} 条</span>${selectable?`<button type="button" data-select-group="${index}">选择本组当前显示的 ${group.rows.length} 条</button>`:''}</div>`).join('')}</section>` : ''}
      <div class="execution-list-table-wrap"><table><thead><tr>${selectable?'<th>选择</th>':''}<th>用例 / 版本</th><th>本次结果</th><th>失败摘要</th><th>原始记录</th></tr></thead><tbody>${visible.map(row=>`<tr data-row-id="${esc(row.id)}">${selectable?`<td><input type="checkbox" data-select-row="${esc(row.id)}" aria-label="选择 ${esc(row.external_id)} v${row.case_version}" ${selected.has(row.id)?'checked':''}></td>`:''}<td><strong>${esc(row.external_id)}</strong> v${esc(row.case_version)}<small>${esc(row.title)}</small><small>${esc(executionArtifactLabel(row))} · ${row.software_version?esc(row.software_version):'软件版本未提供'}</small></td><td><span class="execution-list-badge ${esc(row.kind)}">${esc(labelFor(row))}</span><small>${esc(batchReasons[row.reason] || row.reason || '')}</small></td><td>${executionRowSummaryHtml(row)}</td><td>${row.record_available?`<a data-nav href="${detailLink(row,project.project_id)}">查看详情</a>`:row.run_id?'记录未取得或身份不匹配':'无运行记录'}${executionRowActivityHtml(row)}<details><summary>身份</summary><code>run ${esc(row.run_id || '无')}<br>candidate ${esc(row.candidate_sha256 || row.bundle_sha256 || '无')}<br>build ${esc(row.source_task_id || '无')}</code></details></td></tr>`).join('')}</tbody></table>${visible.length?'':'<p class="execution-list-empty">当前范围和筛选下没有记录。</p>'}</div>
      ${selectable?`<div class="execution-list-actions"><span>已选 ${chosen.length} 条${duplicateCases?'；同一用例重复，请只保留一次':''}</span><button type="button" id="execution-rerun" ${rerunnable?'':'disabled'}>复跑选中记录</button><button type="button" id="execution-revise" ${revisable?'':'disabled'}>反馈问题并修订</button>${revisionAvailability.reason?`<span role="status">${esc(revisionAvailability.reason)}</span>`:''}<button type="button" id="execution-clear" ${chosen.length?'':'disabled'}>清空选择</button></div><div id="execution-revision-form" hidden><label>脚本问题反馈<textarea id="execution-feedback" maxlength="${chosen.some(row=>row.runner_kind==='HTTP_JSON')?3000:6000}" rows="4" placeholder="写明证据显示的脚本问题；不要修改原用例动作或预期"></textarea></label><label><input type="checkbox" id="execution-revision-ack">我已核对运行证据，认为需要修订脚本技术实现；原用例动作和预期保持不变。</label><button type="button" id="execution-revision-submit" disabled>带反馈进入修订确认</button></div>`:''}`;
    const revisionForm = body.querySelector('#execution-revision-form');
    if (revisionForm) {
      revisionForm.querySelector('#execution-feedback').parentElement.firstChild.textContent = '实际观察（用户补充）';
      revisionForm.querySelector('#execution-feedback').placeholder = '只补充你实际观察到的现象；系统已绑定原运行与版本，不修改原用例预期';
      revisionForm.querySelector('#execution-revision-ack').parentElement.lastChild.textContent = '我已核对原运行证据；原用例动作和预期保持不变。';
      revisionForm.insertAdjacentHTML('afterbegin', `<div class="execution-feedback-summary" role="status"><strong>系统已绑定 ${chosen.length} 条原运行</strong>${chosen.map(row=>`<small>${esc(row.external_id)} v${esc(row.case_version)} · ${esc(executionArtifactLabel(row))} · ${esc(row.run_id)} · ${esc(failureCategories[row.failure_category] || '待分析')}</small>`).join('')}${chosen.some(row=>row.failure_category==='ENVIRONMENT_BLOCKED')?'<small>存在共用环境阻塞：先恢复环境并复跑；无需仅因环境失败改脚本。</small>':''}${chosen.some(row=>row.failure_category==='BUSINESS_DIFFERENCE')?'<small>疑似产品差异保留原失败，请核对业务预期与实际结果。</small>':''}</div>`);
      revisionForm.insertAdjacentHTML('beforeend', '<button type="button" id="execution-revision-cancel">取消反馈</button>');
    }
    const search = body.querySelector('#execution-search');
    search.addEventListener('input', event => {
      const next = event.target.value; filter.search = next; selected.clear();
      const position = event.target.selectionStart; renderRows();
      const replacement = body.querySelector('#execution-search'); replacement.focus(); replacement.setSelectionRange(position, position);
    });
    body.querySelector('#execution-status').addEventListener('change', event => { filter.status = event.target.value; selected.clear(); renderRows(); });
    body.querySelector('#execution-issue').addEventListener('change', event => { filter.issue = event.target.value; selected.clear(); renderRows(); });
    body.querySelectorAll('[data-select-row]').forEach(input => input.addEventListener('change', event => {
      event.target.checked ? selected.add(event.target.dataset.selectRow) : selected.delete(event.target.dataset.selectRow); renderRows();
    }));
    body.querySelectorAll('[data-select-group]').forEach(button => button.addEventListener('click', () => {
      for (const row of groups[Number(button.dataset.selectGroup)].rows) selected.add(row.id);
      renderRows();
    }));
    body.querySelector('#execution-clear')?.addEventListener('click', () => { selected.clear(); renderRows(); });
    body.querySelector('#execution-rerun')?.addEventListener('click', () => { if (rerunnable && validPage()) onRerun(chosen); });
    body.querySelector('#execution-revise')?.addEventListener('click', () => { body.querySelector('#execution-revision-form').hidden = false; body.querySelector('#execution-feedback').focus(); });
    const form = body.querySelector('#execution-revision-form');
    if (form) {
      form.querySelector('#execution-revision-cancel').addEventListener('click', () => { form.hidden = true; body.querySelector('#execution-revise')?.focus(); });
      const update = () => { form.querySelector('#execution-revision-submit').disabled = !form.querySelector('#execution-feedback').value.trim() || !form.querySelector('#execution-revision-ack').checked; };
      form.querySelector('#execution-feedback').addEventListener('input', update);
      form.querySelector('#execution-revision-ack').addEventListener('change', update);
      form.querySelector('#execution-revision-submit').addEventListener('click', () => {
        const feedback = form.querySelector('#execution-feedback').value.trim();
        if (revisable && feedback && form.querySelector('#execution-revision-ack').checked && validPage()) onRevise(chosen, feedback);
      });
    }
  };
  renderRows();
}
