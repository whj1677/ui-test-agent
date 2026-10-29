// Project-scoped requirements design and protocol binding views. All mutations
// go through the injected facade; rendering never manufactures a saved state.
const pageState = new Map();
const requirementsPollers = new Map();
let lastProjectId = null;

export function disposeRequirementsPolling() {
  for (const timer of requirementsPollers.values()) clearInterval(timer);
  requirementsPollers.clear();
  for (const state of pageState.values()) if (state.batchPlan?.confirmed) state.batchPlan.paused = true;
}

export function resetRequirementsSelection() {
  for (const state of pageState.values()) {
    state.selectedSources.clear();
    state.selectedCandidates.clear();
    state.candidateId = '';
    state.candidateType = 'UI';
    state.candidateTypeChosen = false;
    state.selectedCaseId = '';
    state.selectedCaseVersion = 0;
    state.protocolId = '';
    state.mappings = [];
    state.bindingCaseKey = '';
    state.allowImages = false;
    state.qualityMode = 'STANDARD';
  }
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const projectPath = project => `#/projects/${encodeURIComponent(project.project_id)}`;
const available = (facade, method) => typeof facade?.[method] === 'function' && facade.capabilities?.[method] !== false;
const rowsOf = (value, key) => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
const issueText = issue => `${issue?.partition === 'UI' ? '前端分区：' : issue?.partition === 'BACKEND' ? '后端分区：' : ''}${issue?.message || issue?.code || String(issue || '待核对')}`;
const normalizedKind = source => String(source?.kind || source?.source_kind || '').toUpperCase();
const sourceId = source => source?.snapshot_id || source?.source_id || '';
const sourceLabel = source => source?.file_name || source?.fileName || sourceId(source);
const statusLabel = status => ({
  DRAFT: '草稿', RUNNING: '分析中', QUEUED: '排队中', COMPLETED: '分析结束',
  FAILED: '失败', CANCELLED: '已取消', CANCEL_REQUESTED: '已请求取消', INTERRUPTED: '已中断',
  CONFIRMED: '已确认', PENDING: '待核对', PENDING_REVIEW: '待人工审阅',
  PENDING_CONFIRMATION: '待人工确认', PARTIALLY_CONFIRMED: '部分用例已确认', CONFIRMING: '确认入库中',
  PARTIAL: '部分绑定', CONFLICT: '业务冲突', COMPLETE: '技术映射完整',
  NOT_READ: '未读取', PARTIALLY_READ: '部分读取', READ: '已读取',
  UNANALYZED: '未分析', NOT_PRESENT: '未提供', NOT_APPLICABLE: '不适用',
  UNKNOWN: '待核对', REVIEW_DRAFT: '评审稿',
  PLANNED: '待确认', PREPARED: '已冻结待启动', STARTING: '提交中', START_UNKNOWN: '提交结果待核实',
})[status] || status || '未提供';
const sourceReadLabel = status => ({ READ: '已读取', PARTIAL: '部分读取', UNANALYZED: '未分析',
  NOT_PRESENT: '未提供', NOT_APPLICABLE: '不适用' })[status] || statusLabel(status);
const generationErrorLabel = (code, networkCode, transportErrorKind) => ({
  DEEPSEEK_CONNECTION_FAILED: networkCode
    ? `无法连接模型服务（${networkCode}）。请检查本机网络、代理或证书配置后再明确重试；本次未形成候选。`
    : '模型请求失败，旧记录未保留底层错误码，尚不能确定是网络还是本机传输配置问题。请检查本机网络、代理及运行时配置后再明确重试。',
  DEEPSEEK_TRANSPORT_ERROR: transportErrorKind === 'TYPE_ERROR'
    ? '请求传输层返回 TypeError，网络问题也可能产生此错误，目前尚未确定根因。请核对网络、代理及运行时配置后再明确重试。'
    : '模型请求在本机传输层失败，尚未定位具体根因。请检查运行时与代理配置，并查看诊断代码后再明确重试。',
  DEEPSEEK_AUTH_FAILED: '模型服务拒绝了认证。请在本机检查已配置的 API 凭据和服务权限后再明确重试。',
  DEEPSEEK_KEY_REQUIRED: '尚未配置模型 API 凭据。请在本机完成配置后再明确重试。',
  DEEPSEEK_OUTPUT_TRUNCATED: '模型输出达到上限并被截断，本次没有形成候选。请缩小本期范围，或拆成最多 4 个明确子范围后分别生成。',
  DEEPSEEK_JSON_INVALID: '模型返回的数据无法按 JSON 解析，未形成用例候选。',
  REQUIREMENT_MODEL_OUTPUT_INVALID: '模型返回的候选结构不符合要求，未形成可审阅候选。',
  REQUIREMENT_MODEL_INPUT_LIMIT_EXCEEDED: '本轮选定资料超过模型输入上限，未形成候选。',
  REQUIREMENT_MODEL_FAILED: '模型处理失败，未形成候选。',
  REQUIREMENT_IMAGE_OBSERVATIONS_INVALID: '模型图像观察缺失或格式不完整，未形成候选。原图与失败记录已保留。',
  REQUIREMENT_IMAGE_OBSERVATIONS_SOURCE_INVALID: '模型图像观察没有对应本次所选原图，未形成候选。',
  REQUIREMENT_DOCX_IMAGE_PATH_UNSAFE: 'Word 内嵌图片关系路径不安全，资料未导入。请将正文原图另存为 PNG/JPEG 后单独上传。',
})[code] || '资料分析失败，未形成可审阅候选。';
export function generationFailureHtml(generation, candidateCount = 0, design = null) {
  const code = generation.error?.code || generation.error || 'REQUIREMENT_MODEL_FAILED';
  const outcome = candidateCount ? '本次生成未完整结束，已产出的用例草稿已保留，仍需完成检查和人工核对。' : '本次未产出可审阅的测试用例。';
  const next = ['DEEPSEEK_OUTPUT_TRUNCATED','REQUIREMENT_MODEL_INPUT_LIMIT_EXCEEDED'].includes(code)
    ? '请缩小本轮范围后重新生成；已有记录保留。'
    : '请检查所选资料和范围；服务不可用时联系工作台管理员，恢复后再点击生成测试用例。';
  return `<div class="notice warning req-generation-error" role="alert"><strong>${escapeHtml(outcome)}</strong><p>${escapeHtml(next)}不会自动重试。</p><details><summary>技术详情</summary><p>${escapeHtml(generationErrorLabel(code, generation.diagnostic?.network_error_code, generation.diagnostic?.transport_error_kind))}</p><p>${escapeHtml(generationUsageLabel(generation))}</p><code>${escapeHtml(code)}</code><pre>${escapeHtml(JSON.stringify({ transport: generation.diagnostic || null, validation: design?.quality?.failed_stage_output?.validation || null }, null, 2))}</pre></details></div>`;
}

function generationUsageLabel(generation) {
  const usage = generation?.usage || generation?.diagnostic?.usage;
  if (!usage) return '模型未返回可用 token 用量';
  const total = Number(usage.total_tokens);
  const input = Number(usage.prompt_tokens ?? usage.input_tokens);
  const output = Number(usage.completion_tokens ?? usage.output_tokens);
  const parts = [];
  if (Number.isFinite(total) && total >= 0) parts.push(`合计 ${total}`);
  if (Number.isFinite(input) && input >= 0) parts.push(`输入 ${input}`);
  if (Number.isFinite(output) && output >= 0) parts.push(`输出 ${output}`);
  const unknown = generation?.usage_summary?.unknown_requests;
  return parts.length ? `已知 token：${parts.join(' · ')}${unknown ? `；另有 ${unknown} 次请求用量未知` : ''}` : '模型未返回可用 token 用量';
}

const ACTIVE_GENERATION = ['RUNNING', 'QUEUED', 'CANCEL_REQUESTED'];
const generationTerminal = generation => Boolean(generation?.status && !ACTIVE_GENERATION.includes(generation.status));
export function generationNeedsReconciliation(design, generation) {
  return Boolean(design?.generation?.task_id && design.generation.task_id === generation?.task_id &&
    ACTIVE_GENERATION.includes(design.generation.status) && generationTerminal(generation));
}
export function generationTerminalMessage(generation, uiCount = null, backendCount = null) {
  const status = generation?.status;
  if (status === 'COMPLETED') return Number.isInteger(uiCount) && Number.isInteger(backendCount)
    ? `资料分析已结束：前端 ${uiCount} 条、后端 ${backendCount} 条候选待人工审阅。`
    : '资料分析已结束；请查看已保存的前后端候选并人工审阅。';
  if (status === 'CANCELLED') return '资料分析已取消；已保存的候选仍可查看，请核对生成记录。';
  return '资料分析未完成；请查看错误和已保存的候选，系统不会自动重试。';
}
export function generationStatusHtml(generation, uiCount = null, backendCount = null) {
  const active=ACTIVE_GENERATION.includes(generation?.status);
  const title=generation?.status==='CANCEL_REQUESTED'?'正在取消用例生成':generation?.status==='QUEUED'?'用例生成排队中':active?'正在生成测试用例':statusLabel(generation?.status);
  const stage = ({ GENERATE: '正在整理测试步骤与预期', REVIEW: '正在检查测试用例', REVISE: '正在修订检查发现的问题', RECHECK: '正在复查修订结果' })[generation?.stage];
  const started = Date.parse(generation?.started_at || generation?.created_at || '');
  const ended = active ? Date.now() : Date.parse(generation?.finished_at || '');
  const elapsed = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, Math.floor((ended - started) / 1000)) : null;
  return `<strong>${escapeHtml(title)}</strong>${elapsed !== null ? `<small>已用 ${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒</small>` : ''}${active?'<progress aria-label="用例生成进行中，尚无可计算的完成百分比"></progress>':''}<p>${escapeHtml(active ? stage || '正在处理已选需求资料，状态自动更新。' : generationTerminalMessage(generation,uiCount,backendCount))}</p>${active ? '<div class="req-progress-next"><strong>接下来的步骤</strong><p>整理前端与后端用例 → 检查步骤和预期 → 展示待核对用例。</p><small>任务在后台继续；离开后返回会读取现有状态，不会重新启动。</small></div>' : ''}`;
}

export function correctionInitialSelection(design) {
  if (design?.revision_basis?.mode !== 'CASE_DESIGN_CORRECTION') return null;
  const candidates = [...(design.candidates?.UI || []), ...(design.candidates?.BACKEND || [])];
  return candidates.length === 1 ? { type: candidates[0].case_type, candidateId: candidates[0].candidate_id } : null;
}

export function caseType(item) {
  return item?.case_type || item?.content?.case_type || item?.type || null;
}

export function candidateBlockers(candidate) {
  const issues = candidate?.issues || [];
  return issues.filter(issue => !issue?.resolved_at && (String(issue?.severity || '').toUpperCase() !== 'INFO' || issue?.blocking === true));
}

function needsCoverageDecision(candidate, sources) {
  if (candidate?.coverage_decision) return false;
  return (candidate?.content?.steps || []).some(step => (step.source_refs || []).some(ref => {
    const source = sources.find(item => sourceId(item) === ref.snapshot_id);
    return ['PARTIAL', 'PARTIALLY_READ'].includes(source?.sections?.body)
      || ['PARTIAL', 'PARTIALLY_READ'].includes(source?.sections?.tables);
  }));
}

export function bindingMissingSteps(steps, mappings) {
  return (steps || []).filter(step => {
    const mapping = (mappings || []).find(row => Number(row.order) === Number(step.order));
    return !String(mapping?.command || '').trim() || !String(mapping?.business_observation || '').trim()
      || !Array.isArray(mapping?.source_refs) || !mapping.source_refs.some(ref => ref?.snapshot_id && ref?.segment_id && ref?.quote_sha256);
  }).map(step => Number(step.order));
}

export function parseRequirementsScopePlan(value) {
  const scopes = String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  if (!scopes.length) throw new Error('至少填写一个明确子范围，每行一份');
  if (scopes.length > 4) throw new Error('一次最多规划 4 份子范围');
  if (scopes.some(item => item.length > 2000)) throw new Error('每份子范围说明最多 2000 个字符');
  return scopes;
}

export async function startNextRequirementsScope(plan, { projectId, requirementsApi, isActive = () => true }) {
  if (!plan?.confirmed || plan.cancelled || plan.paused || plan.currentTaskId || plan.startingItemId || !isActive()) return null;
  const item = plan.items.find(row => row.status === 'PREPARED');
  if (!item) return null;
  // Set the lock and visible state before the first await so concurrent renders
  // cannot submit the same design twice.
  plan.startingItemId = item.designId;
  item.status = 'STARTING';
  let dispatchAttempted = false;
  try {
    const design = await requirementsApi.getDesign(projectId, item.designId);
    if (plan.cancelled) { item.status = 'CANCELLED'; return null; }
    if (plan.paused) { item.status = 'PREPARED'; return null; }
    if (!isActive()) { item.status = 'PREPARED'; return null; }
    dispatchAttempted = true;
    const task = await requirementsApi.startGeneration(projectId, item.designId, {
      revision: design.revision, allowModelText: plan.allowModelText, allowModelImages: plan.allowModelImages,
    });
    const taskId = task?.task_id || task?.generation_id;
    if (!taskId) throw new Error('REQUIREMENT_GENERATION_RESPONSE_INVALID');
    item.status = 'RUNNING'; item.taskId = taskId;
    plan.currentTaskId = taskId;
    plan.lastError = null;
    if (plan.cancelled && typeof requirementsApi.cancelGeneration === 'function') {
      await requirementsApi.cancelGeneration(projectId, taskId).catch(() => {});
    }
    return { item, taskId };
  } catch (error) {
    const code = error?.code || error?.message || 'REQUIREMENT_MODEL_FAILED';
    if (code === 'REQUIREMENT_MODEL_BUSY') { item.status = 'PREPARED'; plan.lastError = code; plan.halted = true; plan.haltedReason = 'MODEL_BUSY'; }
    else if (dispatchAttempted) { item.status = 'START_UNKNOWN'; item.error = code; plan.halted = true; plan.haltedReason = 'START_UNKNOWN'; }
    else { item.status = 'FAILED'; item.error = code; }
    return null;
  } finally {
    plan.startingItemId = null;
  }
}

export function finishRequirementsScope(plan, taskId, generation) {
  if (!plan || plan.currentTaskId !== taskId) return false;
  const item = plan.items.find(row => row.status === 'RUNNING' && row.taskId === taskId);
  if (!item) return false;
  item.status = generation?.status || 'FAILED';
  item.usage = generation?.usage || generation?.diagnostic?.usage || null;
  if (generation?.error) item.error = generation.error?.code || generation.error;
  plan.currentTaskId = null;
  return true;
}

function stateFor(project) {
  const key = project.project_id;
  if (lastProjectId !== null && lastProjectId !== key) resetRequirementsSelection();
  lastProjectId = key;
  if (!pageState.has(key)) pageState.set(key, {
    selectedSources: new Set(), selectedCandidates: new Set(), designId: '',
    candidateType: 'UI', candidateId: '', scopeMode: 'ALL', scopeText: '', preparationSettingsOpen: false, sourceHistoryOpen: false,
    allowImages: false, qualityMode: 'STANDARD', selectedCaseId: '', protocolId: '',
    mappings: [], bindingCaseKey: '', generationId: '', bindingReviewer: '',
    selectedCaseVersion: 0, bindingQueryKey: '', requirementsQueryKey: '',
    uploadDraft: { kind: 'PRD', file: null, version: '', status: 'TO_CHECK', replacesSourceId: '' },
    batchScopeDraft: '', batchPlan: null, lastTerminalNoticeTaskId: '', requirementsStage: '', bindingStepOrder: 0, bindingDrafts: {}, bindingDirty: false, confirmedForAutomation: false,
  });
  return pageState.get(key);
}

function errorMessage(error) {
  const code = error?.code || error?.message || 'UNKNOWN';
  const labels = {
    REQUIREMENT_CONFIRM_SINK_UNAVAILABLE: '用例确认尚未接入现有用例库，未保存确认结果。',
    REQUIREMENT_MODEL_AUTH_REQUIRED: '本次模型处理尚未获得明确授权。',
    REQUIREMENT_MODEL_IMAGE_AUTH_REQUIRED: '请勾选“同时分析所选图片”后重新提交。',
    REQUIREMENT_MODEL_IMAGE_UNAVAILABLE: '当前已配置模型不支持图片输入，原图尚未发送。',
    REQUIREMENT_IMAGE_LIMIT_EXCEEDED: '每次最多 3 张图片，单张不超过 10 MiB，合计不超过 20 MiB。请缩小本轮范围。',
    REQUIREMENT_REVISION_CONFLICT: '资料或设计版本已变化，请重新读取后核对。',
    REQUIREMENT_SOURCE_REF_INVALID: '候选来源引用无效，不能确认。',
    REQUIREMENT_CONFIRM_BLOCKED: '候选仍有来源、规则或覆盖缺口，不能确认。',
    BINDING_PROTOCOL_REQUIRED: '请先选择协议快照。',
    BINDING_CASE_VERSION_MISMATCH: '用例版本已变化，请重新检查映射。',
    BINDING_CONFIRM_BLOCKED: '技术映射仍缺少必需字段或协议原文引用，不能确认完整绑定。',
    BINDING_CONFLICT_UNRESOLVED: '此用例版本与协议快照已有业务冲突；请先完成待审业务修订，不能用空冲突说明覆盖。',
  };
  return labels[code] || `操作未完成：${code}`;
}

function notice(text, warning = false) {
  return `<div class="notice${warning ? ' warning' : ''}" role="status">${escapeHtml(text)}</div>`;
}

export function imageAnalysisView(analysis, projectId = '') {
  if (!analysis) return '';
  if (analysis.status === 'NOT_REQUESTED') return '<p class="req-muted">本设计未向模型发送图片；上传原图不代表已分析。</p>';
  const label = analysis.status === 'ANALYZED' ? '图片已由模型读取，观察待人工核对' : `图片分析：${statusLabel(analysis.status)}`;
  return `<section class="req-image-analysis"><h3>${escapeHtml(label)}</h3><p class="req-muted">${escapeHtml(analysis.limitation)}</p>${(analysis.source_snapshots || []).map(source => {
    const observation = (analysis.observations || []).find(item => item.snapshot_id === source.snapshot_id);
    const parent = source.parent_snapshot_id || source.snapshot_id;
    const preview = `/api/case-library/projects/${encodeURIComponent(projectId)}/requirements/sources/${encodeURIComponent(parent)}/image${source.image_id ? `?embedded=${encodeURIComponent(source.image_id)}` : ''}`;
    const origin = source.parent_snapshot_id ? ` · Word 正文 ${(source.references || []).map(ref => ref.location.table ? `表 ${ref.location.table} 行 ${ref.location.row} 列 ${ref.location.cell}` : `段落 ${ref.location.paragraph}`).join('、')} · 父文档 SHA-256 ${source.parent_sha256.slice(0, 12)}` : '';
    return `<details open><summary>${escapeHtml(source.file_name)} · 原图 SHA-256 ${escapeHtml(source.sha256.slice(0, 12))}</summary><small>原图快照 ${escapeHtml(source.snapshot_id)}${escapeHtml(origin)}</small>${projectId ? `<img class="req-image-preview" alt="本次分析的原图：${escapeHtml(source.file_name)}" src="${preview}">` : ''}${observation ? `<ul>${observation.observations.map(item => `<li>${escapeHtml(item.description)}${item.location ? `（${escapeHtml(item.location)}）` : ''}</li>`).join('')}</ul>${observation.uncertainties.length ? `<p>图片不确定项：${observation.uncertainties.map(escapeHtml).join('；')}</p>` : '<p class="req-muted">模型未列出不确定项，仍需核对原图与业务来源。</p>'}` : '<p>尚无可核对的图像观察；不能按已理解使用。</p>'}</details>`;
  }).join('')}<p>审阅下方候选时一并核对图片用途；图片当前值不能作为应通过的业务规则。</p></section>`;
}

function sectionStatus(section) {
  if (section == null) return '未记录';
  if (typeof section === 'string') return sourceReadLabel(section);
  return sourceReadLabel(section.status || section.read_status);
}

function sourceCard(source, selected, showCheck = true, allowRemove = false) {
  const id = sourceId(source), kind = normalizedKind(source);
  const read = source.read_status || source.status;
  const sections = source.sections || {};
  return `<div class="req-source-row">
    ${showCheck ? `<label class="req-source-select"><input type="checkbox" data-req-source="${escapeHtml(id)}" ${selected ? 'checked' : ''}><span class="sr-only">本次采用 ${escapeHtml(sourceLabel(source))}</span></label>` : ''}
    <div class="req-source-body"><strong>${escapeHtml(sourceLabel(source))}</strong><small>已上传${selected ? ' · 本轮采用' : ''}</small><details class="req-source-reading"><summary>资料读取详情</summary><small>${escapeHtml(kind || '资料')} · ${escapeHtml(source.document_version || source.version || '版本待核对')} · ${escapeHtml(sourceReadLabel(read))}${source.supersedes_source_id ? ` · 新快照替代 ${escapeHtml(source.supersedes_source_id)}` : ''}</small>
      <small>正文 ${escapeHtml(sectionStatus(sections.body))} · 表格 ${escapeHtml(sectionStatus(sections.tables))} · 图片 ${escapeHtml(sectionStatus(sections.images))}${source.embedded_images?.length ? ` · 已识别正文嵌入图 ${source.embedded_images.length} 张（待选择分析）` : ''}</small></details></div>
    <span class="req-pill">${escapeHtml(statusLabel(source.document_status || 'UNKNOWN'))}</span>${selected && allowRemove ? `<button type="button" class="button req-source-remove" data-req-remove-source="${escapeHtml(id)}" aria-label="从本轮移除 ${escapeHtml(sourceLabel(source))}">移除</button>` : ''}
  </div>`;
}

function candidateSummary(candidate, selected, current, sources) {
  const blockers = candidateBlockers(candidate);
  const firstIssue = blockers[0];
  const coveragePending = needsCoverageDecision(candidate, sources);
  const id = candidate.candidate_id || '';
  const content = candidate.content || {};
  const confirmed = candidate.confirmation_status === 'CONFIRMED';
  return `<div class="req-candidate-row${current ? ' active' : ''}">
    <label class="req-source-select"><input type="checkbox" data-req-candidate="${escapeHtml(id)}" ${selected ? 'checked' : ''} ${confirmed || blockers.length || coveragePending ? 'disabled' : ''}><span class="sr-only">选择 ${escapeHtml(content.external_id || '候选')}</span></label>
    <button type="button" class="req-candidate-open" data-req-open-candidate="${escapeHtml(id)}"><strong>${escapeHtml(content.external_id || '候选')} · ${escapeHtml(content.title || '未命名候选')}</strong><small>${escapeHtml(content.module || '未标模块')} · ${candidate.target_case ? `修订原用例 v${escapeHtml(candidate.target_case.case_version)} · ` : ''}${escapeHtml(confirmed ? '人工已确认' : blockers.length || coveragePending ? '待澄清' : '待人工审阅')}</small>${firstIssue ? `<small class="req-candidate-issue">${firstIssue.step_order ? `步骤 ${escapeHtml(firstIssue.step_order)} · ` : ''}${escapeHtml(issueText(firstIssue))}</small>` : ''}</button>
    <span class="req-pill${blockers.length || coveragePending ? ' req-pill-warn' : ''}">${escapeHtml(blockers.length ? `${blockers.length} 项待处理` : coveragePending ? '部分读取范围待核对' : statusLabel(candidate.confirmation_status || 'PENDING'))}</span>
  </div>`;
}

function sourceRefs(step, sources = []) {
  const refs = step?.source_refs || [];
  return refs.length ? refs.map(ref => {
    if (ref.decision_id) return `<li><strong>人工核对决定</strong> · ${escapeHtml(ref.decision_id)} · 摘要 ${escapeHtml((ref.quote_sha256 || '').slice(0, 12) || '待核对')}</li>`;
    const source = sources.find(item => sourceId(item) === ref.snapshot_id);
    const segment = rowsOf(source?.segments, 'segments').find(item => item.segment_id === ref.segment_id);
    const quote = ref.quote || segment?.text || segment?.content || '';
    return `<li><strong>${escapeHtml(source ? sourceLabel(source) : ref.snapshot_id || '未知资料')}</strong> · ${escapeHtml(formatSourceLocation(segment?.location || ref.location, segment?.kind))} · 片段 ${escapeHtml(ref.segment_id || '待定位')} · 摘要 ${escapeHtml((ref.quote_sha256 || '').slice(0, 12) || '待核对')}${quote ? `<blockquote>${escapeHtml(quote)}</blockquote>` : ''}</li>`;
  }).join('') : '<li>此步尚无来源引用</li>';
}

export function formatSourceLocation(location, kind = '') {
  if (typeof location === 'string' && location.trim()) return location.trim();
  if (!location || typeof location !== 'object' || Array.isArray(location)) return '位置待核对';
  const number = value => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const table = number(location.table), row = number(location.row), cell = number(location.cell);
  const paragraph = number(location.paragraph), line = number(location.line);
  if (table && row && cell) return `表 ${table} 第 ${row} 行第 ${cell} 列`;
  if (table && row) return `表 ${table} 第 ${row} 行`;
  if (paragraph) return `第 ${paragraph} 段`;
  if (line) return kind === 'table_row' ? `第 ${line} 行（表格行）` : `第 ${line} 行`;
  return '位置待核对';
}

export function modelProposalDetail(candidate, sources = []) {
  const proposal = candidate?.model_proposal?.content;
  if (!proposal?.steps?.length) return '';
  return `<details class="req-issues" data-req-model-proposal><summary>模型原提议（生成时未确认）</summary><p>生成时存在业务未决问题，相关确定预期已转为待核对。以下保留模型当时的提议；当前预期请看下方步骤。</p><p><strong>原前置条件</strong>：${escapeHtml(proposal.preconditions || '未提供')}</p><p><strong>原测试数据</strong>：${escapeHtml(proposal.test_data || '未提供')}</p><ol>${proposal.steps.map(step => `<li><strong>步骤 ${escapeHtml(step.order)}</strong><p>${escapeHtml(step.action)}</p><p>原提议：${escapeHtml(step.expected || '未提供')}</p><ul>${sourceRefs(step, sources)}</ul></li>`).join('')}</ol></details>`;
}

export const qualityRequestLimit = mode => mode === 'CHECKED' ? 4 : 1;
const qualityLabel = value => ({ GENERATE: '生成首稿', REVIEW: '独立审查', REPAIR: '定向修订', RECHECK: '复审修订稿',
  CHECKED: '声明计算已核对', NEEDS_REVIEW: '待人工核对', NOT_CHECKED: '尚未核算', STALE: '旧检查已失效', COMPLETE: '流程结束',
  UNREVIEWED: '尚未完整审查', REVIEWED: '模型审查结束，待人工核对', COMPLETED: '流程结束，待人工核对',
  NO_FINDINGS: '本次模型未发现问题', NEEDS_REVISION: '模型提出修订', NEEDS_CLARIFICATION: '模型提出待澄清项',
})[value] || statusLabel(value);
const qualityFindings = (findings, sources) => (findings || []).map(item => `<li>${escapeHtml(item.code || '')}${item.step_order ? ` · 步骤 ${escapeHtml(item.step_order)}` : ''}<p>${escapeHtml(item.message)}</p>${item.source_refs?.length ? `<details><summary>问题来源</summary><ul>${sourceRefs(item, sources)}</ul></details>` : ''}</li>`).join('');

export function qualityCandidateDetail(candidate, sources = []) {
  if (!candidate?.quality_check && !candidate?.quality_review) return '';
  const check = candidate.quality_check || {}, review = candidate.quality_review || {};
  const stale = check.status === 'STALE' || review.status === 'STALE';
  return `<details class="req-issues" data-req-quality-candidate><summary>增强检查 · ${escapeHtml(qualityLabel(stale ? 'STALE' : review.verdict || review.status || check.status))}</summary><p>程序只核算声明数据与正文的一致性；模型审查不等于业务批准。${stale ? '人工修改后旧检查已失效，须逐项记录人工核对决定；原检查仅作历史记录。' : '请结合原资料核对前提、操作和预期。'}</p><p>结构检查：${escapeHtml(qualityLabel(check.status || 'NOT_CHECKED'))}</p><ul>${qualityFindings(check.findings, sources)}</ul>${check.calculations?.length ? `<details><summary>计算明细</summary><pre>${escapeHtml(JSON.stringify(check.calculations, null, 2))}</pre></details>` : ''}<p>模型意见：${escapeHtml(qualityLabel(review.verdict || review.status || 'UNREVIEWED'))}</p><ul>${qualityFindings(review.findings, sources)}</ul></details>`;
}

export function qualityProgressLabel(design, generation) {
  const quality = design?.quality;
  if (!quality || quality.mode !== 'CHECKED') return '';
  const count = generation?.request_count ?? generation?.model_request_count ?? design.model_request_count ?? design.model_requests?.length ?? 0;
  return `增强检查：${qualityLabel(generation?.stage || quality.stage || 'GENERATE')} · 已登记 ${count} / 最多 4 次模型请求 · ${qualityLabel(quality.status || 'UNREVIEWED')}`;
}

export function qualityDesignDetail(design, generation, sources = []) {
  const quality = design?.quality;
  if (!quality || quality.mode !== 'CHECKED') return '';
  const drafts = (quality.snapshots || []).map(draft => `<details><summary>${escapeHtml(qualityLabel(draft.stage))} · ${escapeHtml(draft.at || '')}</summary>${['UI', 'BACKEND'].map(type => (draft.candidates?.[type] || []).map(candidate => `<details><summary>${type === 'UI' ? '前端' : '后端'} · ${escapeHtml(candidate.content?.external_id)} · ${escapeHtml(candidate.content?.title)}</summary><p>前置条件：${escapeHtml(candidate.content?.preconditions || '未提供')}</p><p>测试数据：${escapeHtml(candidate.content?.test_data || '未提供')}</p><ol>${(candidate.content?.steps || []).map(step => `<li><p>${escapeHtml(step.action)}</p><p>预期：${escapeHtml(step.expected || '待核对')}</p></li>`).join('')}</ol>${modelProposalDetail(candidate, sources)}</details>`).join('')).join('')}</details>`).join('');
  const reviews = (quality.reviews || []).map(review => `<details><summary>${escapeHtml(qualityLabel(review.stage))} · ${escapeHtml(review.at || '')}</summary><ul>${(review.result?.reviews || []).map(item => `<li>${escapeHtml(item.candidate_id)} · ${escapeHtml(qualityLabel(item.verdict))}<ul>${qualityFindings(item.findings, sources)}</ul></li>`).join('')}</ul>${review.result?.coverage_findings?.length ? `<p>范围覆盖问题</p><ul>${qualityFindings(review.result.coverage_findings, sources)}</ul>` : ''}</details>`).join('');
  return `<details class="req-issues" data-req-quality-design><summary>增强检查记录</summary><p data-req-quality-progress>${escapeHtml(qualityProgressLabel(design, generation))}</p><p>同一配置模型分别生成、审查；发现问题后最多修订一次并复审。失败或取消保留已有稿件，不自动重试。完整审查后仍需人工确认。</p><p>${escapeHtml(generationUsageLabel(generation))}</p><details><summary>历次稿件与审查（${quality.snapshots?.length || 0} 份稿件 / ${quality.reviews?.length || 0} 次审查）</summary>${drafts}${reviews}</details></details>`;
}

export function qualityConfirmationPending(design, generation) {
  return design?.quality?.mode === 'CHECKED' && (design.quality.review_completed !== true || generation?.status !== 'COMPLETED');
}

function correctionStepEditor(step, sources, design) {
  const selected = new Set((step.source_refs || []).filter(ref => !ref.decision_id)
    .map(ref => `${ref.snapshot_id}:${ref.segment_id}:${ref.quote_sha256}`));
  const eligible = sources.filter(source => design?.source_refs?.some(ref => ref.snapshot_id === sourceId(source))
    && normalizedKind(source) !== 'IMAGE');
  const refs = eligible.flatMap(source => rowsOf(source.segments, 'segments').filter(segment => segment.segment_id && segment.quote_sha256)
    .map(segment => ({ source, segment })));
  return `<div class="req-step" data-correction-step><div class="req-step-index" data-correction-index>${escapeHtml(step.order)}</div><div><button type="button" class="button" data-req-remove-step>删除此步骤</button><strong>操作</strong><textarea data-correction-action aria-label="步骤操作" rows="2">${escapeHtml(step.action || '')}</textarea><strong>预期</strong><textarea data-correction-expected aria-label="步骤预期" rows="2">${escapeHtml(step.expected || '')}</textarea><details open><summary>本步事实来源（至少选一项；人工决定须另行填写）</summary>${refs.length ? refs.map(({ source, segment }) => `<label class="req-check"><input type="checkbox" data-correction-ref data-snapshot="${escapeHtml(sourceId(source))}" data-segment="${escapeHtml(segment.segment_id)}" data-quote="${escapeHtml(segment.quote_sha256)}" ${selected.has(`${sourceId(source)}:${segment.segment_id}:${segment.quote_sha256}`) ? 'checked' : ''}><span>${escapeHtml(sourceLabel(source))} · ${escapeHtml(formatSourceLocation(segment.location, segment.kind))} · ${escapeHtml(String(segment.text || '').slice(0, 140))}</span></label>`).join('') : '<small>所选需求资料没有可引用片段；请先核对资料读取结果。</small>'}</details></div></div>`;
}

export function candidateDetail(candidate, editing = false, sources = [], canReview = true, design = null) {
  if (!candidate) return `<div class="req-empty">选择左侧候选，查看原预期、步骤和来源。</div>`;
  const content = candidate.content || {}, steps = content.steps || [];
  const correction = Boolean(candidate.target_case && design?.revision_basis?.mode === 'CASE_DESIGN_CORRECTION');
  const revisionOnly = Boolean(candidate.target_case && !correction);
  const blockers = candidateBlockers(candidate);
  const partialCoverage = needsCoverageDecision(candidate, sources);
  return `<div class="req-detail-head"><div><small>${escapeHtml(caseType(candidate) || '类型待核对')}</small><h3>${escapeHtml(content.title || '未命名候选')}</h3></div><span class="req-pill${blockers.length ? ' req-pill-warn' : ''}">${escapeHtml(candidate.confirmation_status === 'CONFIRMED' ? '已确认版本' : blockers.length ? '不可确认' : '待人工确认')}</span></div>
    ${candidate.target_case ? `<details class="req-optional-case"><summary>修订目标与身份说明</summary><p class="req-muted">业务修订目标：原用例 ${escapeHtml(candidate.target_case.case_id)} v${escapeHtml(candidate.target_case.case_version)}。${correction ? '本次是有来源的人工用例修订；可修改标题、前置、数据及步骤，编号、类型和模块保持原值。每个变动步骤须核对来源并记录当前正文的人工决定；旧版本和旧导出不变。' : '仅修订冲突预期及其来源/人工决定；动作和用例基本信息沿用原已确认版本，确认前不改原用例和旧导出。'}</p></details>` : ''}
    ${modelProposalDetail(candidate, sources)}
    ${qualityCandidateDetail(candidate, sources)}
    ${editing && !revisionOnly ? `<label class="req-field">标题<input name="title" maxlength="500" value="${escapeHtml(content.title)}"></label>${correction ? `<p class="req-muted">模块：${escapeHtml(content.module || '未标注')}（保持原值）</p>` : `<label class="req-field">模块<input name="module" maxlength="500" value="${escapeHtml(content.module)}"></label>`}` : `<p class="req-muted">模块：${escapeHtml(content.module || '未标注')}</p>`}
    <details class="req-optional-case" open><summary>前置条件与测试数据</summary><div class="req-two"><div><strong>前置条件</strong>${editing && !revisionOnly ? `<textarea name="preconditions" aria-label="前置条件" rows="3">${escapeHtml(content.preconditions)}</textarea>` : `<p>${escapeHtml(content.preconditions || '未提供')}</p>`}</div><div><strong>测试数据</strong>${editing && !revisionOnly ? `<textarea name="test_data" aria-label="测试数据" rows="3">${escapeHtml(content.test_data)}</textarea>` : `<p>${escapeHtml(content.test_data || '未提供')}</p>`}</div></div></details>
    <div class="req-steps">${editing && correction ? steps.map(step => correctionStepEditor(step, sources, design)).join('') : steps.map(step => `<div class="req-step" data-step="${escapeHtml(step.order)}"><div class="req-step-index">${escapeHtml(step.order)}</div><div><strong>操作</strong>${editing && !revisionOnly ? `<textarea data-step-action="${escapeHtml(step.order)}" aria-label="步骤 ${escapeHtml(step.order)} 操作" rows="2">${escapeHtml(step.action)}</textarea>` : `<p>${escapeHtml(step.action || '未提供')}</p>`}<strong>预期</strong>${editing ? `<textarea data-step-expected="${escapeHtml(step.order)}" aria-label="步骤 ${escapeHtml(step.order)} 预期" rows="2">${escapeHtml(step.expected)}</textarea>` : `<p>${escapeHtml(step.expected || '未提供')}</p>`}<details><summary>来源引用（${(step.source_refs || []).length}）</summary><ul>${sourceRefs(step, sources)}</ul></details></div></div>`).join('') || '<p>尚无步骤，不能确认。</p>'}</div>${editing && correction ? '<button type="button" class="button" data-req-add-step>新增步骤</button><small>先保存正文，再对每条新增的待核对问题记录决定；不会自动确认。</small>' : ''}
    ${(candidate.issues || []).length ? `<div class="req-issues"><strong>候选问题</strong><ul>${candidate.issues.map(issue => `<li>${escapeHtml(issueText(issue))} · ${issue.resolved_at ? '已记录决定' : statusLabel(issue.severity)}</li>`).join('')}</ul></div>` : ''}
    ${candidate.confirmation_status !== 'CONFIRMED' && (blockers.length || partialCoverage) ? `<div class="req-review"><h3>人工核对决定</h3><p class="req-muted">决定将作为来源事实保留；不得凭空补业务规则。每条待核对问题要指定受影响步骤。</p><label class="req-field">核对人<input data-req-reviewer maxlength="120" placeholder="姓名或团队内可追溯标识"></label>${blockers.map(issue => `<div class="req-review-issue" data-req-issue="${escapeHtml(issue.issue_id)}"><strong>${escapeHtml(issueText(issue))}</strong><label class="req-field">关联步骤<select data-req-review-step><option value="">请选择</option>${steps.map(step => `<option value="${escapeHtml(step.order)}" ${step.order === issue.step_order ? 'selected' : ''}>步骤 ${escapeHtml(step.order)}</option>`).join('')}</select></label><label class="req-field">决定与依据<textarea data-req-review-text rows="2" placeholder="说明采纳、待定或排除的业务依据"></textarea></label></div>`).join('')}${partialCoverage ? `<div class="req-review-issue"><strong>来源存在部分读取</strong><label class="req-field">本轮采用的已读范围<textarea data-req-coverage-scope rows="2" placeholder="明确被采用的资料章节或范围"></textarea></label><label class="req-field">覆盖决定说明<textarea data-req-coverage-note rows="2" placeholder="说明未读内容如何处理"></textarea></label></div>` : ''}<button type="button" class="button" data-req-review-candidate ${canReview ? '' : 'disabled'}>保存人工核对决定</button>${canReview ? '' : '<small>候选核对接口尚未接入。</small>'}</div>` : ''}
    <div class="req-actions">${editing ? '<button type="button" class="button primary" data-req-save-candidate>保存候选修改</button><button type="button" class="button" data-req-cancel-edit>取消</button>' : `<button type="button" class="button" data-req-edit-candidate ${candidate.confirmation_status === 'CONFIRMED' || !canReview ? 'disabled' : ''}>修改候选</button>`}</div>`;
}

function saveBlob(result) {
  if (!(result?.blob instanceof Blob)) throw new Error('EXPORT_RESPONSE_INVALID');
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = result.name || 'cases'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function candidateEditContent(candidate, input) {
  const old = candidate.content || {};
  const revisionOnly = Boolean(candidate.target_case);
  const steps = (old.steps || []).map(step => ({ ...step,
    action: revisionOnly ? step.action : input.actions?.[step.order] ?? step.action,
    expected: input.expecteds?.[step.order] ?? step.expected,
  }));
  if (revisionOnly) return { ...old, steps };
  return { ...old, title: input.title, module: input.module,
    preconditions: input.preconditions, test_data: input.test_data, steps };
}

export function caseCorrectionContent(candidate, input) {
  const old = candidate.content || {};
  return { ...old, title: input.title, preconditions: input.preconditions,
    test_data: input.test_data, steps: input.steps.map((step, index) => ({
      order: index + 1, action: step.action, expected: step.expected,
      source_refs: step.source_refs.map(ref => ({ ...ref })),
    })) };
}

export function candidateContentFromPanel(candidate, panel, design = null) {
  if (candidate.target_case && design?.revision_basis?.mode === 'CASE_DESIGN_CORRECTION') {
    const rows = [...panel.querySelectorAll('[data-correction-step]')];
    if (!rows.length) return null;
    return caseCorrectionContent(candidate, {
      title: panel.querySelector('[name="title"]')?.value.trim(),
      preconditions: panel.querySelector('[name="preconditions"]')?.value,
      test_data: panel.querySelector('[name="test_data"]')?.value,
      steps: rows.map(row => ({ action: row.querySelector('[data-correction-action]').value,
        expected: row.querySelector('[data-correction-expected]').value,
        source_refs: [...row.querySelectorAll('[data-correction-ref]:checked')].map(input => ({
          snapshot_id: input.dataset.snapshot, segment_id: input.dataset.segment,
          quote_sha256: input.dataset.quote,
        })) })),
    });
  }
  if (!panel.querySelector('[data-step-expected]')) return null;
  const old = candidate.content || {};
  return candidateEditContent(candidate, {
    title: panel.querySelector('[name="title"]')?.value.trim(),
    module: panel.querySelector('[name="module"]')?.value.trim(),
    preconditions: panel.querySelector('[name="preconditions"]')?.value,
    test_data: panel.querySelector('[name="test_data"]')?.value,
    actions: Object.fromEntries((old.steps || []).map(step => [step.order, panel.querySelector(`[data-step-action="${step.order}"]`)?.value])),
    expecteds: Object.fromEntries((old.steps || []).map(step => [step.order, panel.querySelector(`[data-step-expected="${step.order}"]`)?.value])),
  });
}

export async function renderRequirements({ project, query, showPage, go, toast, requirementsApi = {}, isCurrent = () => true }) {
  if (!isCurrent()) return;
  const state = stateFor(project), projectId = project.project_id;
  const viewCurrent = () => isCurrent() && lastProjectId === projectId;
  const errors = [];
  let sources = [], designs = [], design = null, generation = null, batchGeneration = null, serviceCapabilities = null;
  if (available(requirementsApi, 'listSources')) {
    try { const result = await requirementsApi.listSources(projectId); sources = rowsOf(result, 'sources'); serviceCapabilities = result?.capabilities || null; }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  if (available(requirementsApi, 'listDesigns')) {
    try { designs = rowsOf(await requirementsApi.listDesigns(projectId), 'designs'); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  const requestedDesign = query?.get?.('design') || query?.get?.('design_id') || '';
  const openingRequestedDesign = Boolean(requestedDesign && requestedDesign !== state.requirementsQueryKey);
  if (openingRequestedDesign) {
    state.requirementsQueryKey = requestedDesign;
    state.designId = requestedDesign;
    state.requirementsStage = '';
    state.candidateId = '';
    state.selectedCandidates.clear();
  }
  if (!state.designId && designs.length) state.designId = designs[0].design_id;
  if (state.designId && available(requirementsApi, 'getDesign')) {
    try { design = await requirementsApi.getDesign(projectId, state.designId); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  if (design) state.generationId = design.generation?.task_id || '';
  if (state.generationId && available(requirementsApi, 'getGeneration')) {
    try { generation = await requirementsApi.getGeneration(projectId, state.generationId); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  // The task can finish between reading the design and its task status. Read the
  // saved design once more so the terminal view does not keep showing RUNNING.
  if (generationNeedsReconciliation(design, generation) && available(requirementsApi, 'getDesign')) {
    try { design = await requirementsApi.getDesign(projectId, state.designId); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  const batchTaskId = state.batchPlan?.currentTaskId || '';
  if (batchTaskId && available(requirementsApi, 'getGeneration')) {
    try { batchGeneration = batchTaskId === state.generationId ? generation : await requirementsApi.getGeneration(projectId, batchTaskId); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  const candidates = design?.candidates || { UI: [], BACKEND: [] };
  const allCandidates = [...rowsOf(candidates.UI, 'candidates'), ...rowsOf(candidates.BACKEND, 'candidates')];
  if (openingRequestedDesign) state.candidateTypeChosen = false;
  const correctionSelection = openingRequestedDesign && correctionInitialSelection(design);
  if (correctionSelection) {
    state.candidateType = correctionSelection.type;
    state.candidateId = correctionSelection.candidateId;
  }
  const globalBlockers = (design?.issues || []).filter(issue => !issue.resolved_at && String(issue.severity || '').toUpperCase() !== 'INFO');
  if (!state.candidateTypeChosen && !rowsOf(candidates[state.candidateType], 'candidates').length && allCandidates.length) {
    state.candidateType = rowsOf(candidates.UI, 'candidates').length ? 'UI' : 'BACKEND';
  }
  const activeCandidates = rowsOf(candidates[state.candidateType], 'candidates');
  if (!activeCandidates.some(item => item.candidate_id === state.candidateId)) state.candidateId = activeCandidates[0]?.candidate_id || '';
  const activeCandidate = activeCandidates.find(item => item.candidate_id === state.candidateId);
  const selected = activeCandidates.filter(item => state.selectedCandidates.has(item.candidate_id) && !candidateBlockers(item).length
    && !needsCoverageDecision(item, sources) && item.confirmation_status !== 'CONFIRMED');
  const selectedSources = sources.filter(source => state.selectedSources.has(sourceId(source)));
  const hasRequirementDocument = selectedSources.some(source => ['PRD', 'MRD'].includes(normalizedKind(source)));
  const imageModelAvailable = serviceCapabilities?.image_model_available === true;
  const qualityAvailable = serviceCapabilities?.quality_modes?.includes('CHECKED') === true;
  const selectedImageCount = selectedSources.reduce((sum, source) => sum + (normalizedKind(source) === 'IMAGE' ? 1 : (source.embedded_images || []).length), 0);
  if (!imageModelAvailable) state.allowImages = false;
  const canGenerate = hasRequirementDocument && serviceCapabilities?.accepting === true
    && (state.qualityMode !== 'CHECKED' || qualityAvailable)
    && !serviceCapabilities?.active
    && serviceCapabilities?.model_available === true && available(requirementsApi, 'createDesign') && available(requirementsApi, 'startGeneration');
  const qualityPending = qualityConfirmationPending(design, generation);
  const confirmationReady = !qualityPending && !globalBlockers.length && serviceCapabilities?.confirm_sink_available === true
    && available(requirementsApi, 'confirmCandidates');
  const canConfirm = confirmationReady && selected.length > 0;
  const canConfirmCurrent = confirmationReady && activeCandidate && !candidateBlockers(activeCandidate).length
    && !needsCoverageDecision(activeCandidate, sources) && activeCandidate.confirmation_status !== 'CONFIRMED';
  const generationActive = ACTIVE_GENERATION.includes(generation?.status);
  const currentLabel = activeCandidate?.content?.external_id || activeCandidate?.candidate_id || '';
  const currentConfirmationHtml = () => activeCandidate ? `<footer class="req-current-confirm"><span class="req-muted">只确认当前查看的 ${escapeHtml(currentLabel)}</span><button type="button" class="button" data-req-confirm-current ${canConfirmCurrent ? '' : 'disabled'}>确认当前用例</button></footer>` : '';
  const confirmationHint = qualityPending ? '用例检查尚未完整结束，暂不能确认。' : globalBlockers.length ? '范围问题待核对，暂不能确认。' : serviceCapabilities?.confirm_sink_available !== true ? '用例库当前不能写入，请联系工作台管理员。' : '勾选只表示选择，点击按钮才确认。';
  const uiCount = rowsOf(candidates.UI, 'candidates').length, backendCount = rowsOf(candidates.BACKEND, 'candidates').length;
  const sourceError = !available(requirementsApi, 'listSources') ? notice('资料读取接口尚未接入，不能上传或分析。', true) : '';
  showPage(`<div class="req-page" data-req-root data-req-project="${escapeHtml(projectId)}">
    <div class="page-heading"><div><h1 data-req-heading>${generationActive ? '正在设计测试用例' : allCandidates.length ? '核对生成的测试用例' : '准备测试用例'}</h1><p>已有用例可以直接导入；只有需求资料时，先起草，再由你核对。</p></div><div class="req-actions"><button type="button" class="button" data-req-go-workbench>返回工作台</button></div></div>
    <nav class="req-stage-nav" aria-label="测试用例准备步骤"><button type="button" data-req-stage="sources">准备资料</button><button type="button" data-req-stage="generation">生成进度与记录</button><button type="button" data-req-stage="review">核对用例</button></nav>
    ${errors.map(error => notice(error, true)).join('')}${sourceError}
    <div class="req-entry-grid" data-req-stage-panel="sources"><section class="panel req-design-entry"><div class="panel-body"><div class="req-entry-icon" aria-hidden="true">▤</div><h2>根据需求设计用例</h2><p class="req-muted">导入需求说明，生成待核对的前端和后端用例。</p>
      <div class="req-upload"><label class="req-field req-file-picker">选择需求文件<input type="file" data-req-file accept=".docx,.md,.markdown,.png,.jpg,.jpeg"></label><small>支持 Word、Markdown 和 PNG/JPEG 图片。先上传资料，再生成用例。</small>
      <details class="req-upload-metadata"><summary>资料类型、版本与状态</summary><label class="req-field">资料角色<select data-req-kind>${[['PRD','需求说明'],['MRD','市场/业务需求'],['PROTOCOL','通讯协议'],['IMAGE','原型/截图']].map(([value,label]) => `<option value="${value}" ${state.uploadDraft.kind === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="req-two"><label class="req-field">采用版本<input data-req-version value="${escapeHtml(state.uploadDraft.version)}" placeholder="如 v1.2"></label><label class="req-field">文档状态<select data-req-doc-status>${[['TO_CHECK','待核对'],['DRAFT','评审稿'],['CONFIRMED','已确认']].map(([value,label]) => `<option value="${value}" ${state.uploadDraft.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><label class="req-field">明确替代原资料（可选）<select data-req-replaces><option value="">新增独立快照</option>${sources.map(source => `<option value="${escapeHtml(sourceId(source))}" ${state.uploadDraft.replacesSourceId === sourceId(source) ? 'selected' : ''}>${escapeHtml(sourceLabel(source))}</option>`).join('')}</select></label><small>替代须为同一文件内容；旧快照与历史引用保留。</small></details><button type="button" class="button" data-req-upload ${available(requirementsApi, 'upload') ? '' : 'disabled'}>上传资料</button>${!available(requirementsApi, 'upload') ? '<small>资料上传服务尚未接通。</small>' : ''}</div>
      <div class="req-selected-sources"><h3>本轮采用的资料 · ${selectedSources.length}</h3><div class="req-source-list">${selectedSources.map(source => sourceCard(source, true, false, !generationActive)).join('') || '<div class="req-empty">尚未选择资料。上传需求文件或从已存资料中选择。</div>'}</div><small>移除仅取消本轮选择，已上传资料和历史记录保留。</small></div>
      ${sources.length ? `<details class="req-source-history"${state.sourceHistoryOpen ? ' open' : ''}><summary>从已存资料中选择（${sources.length}）</summary><div class="req-source-list">${sources.map(source => sourceCard(source, state.selectedSources.has(sourceId(source)))).join('')}</div></details>` : ''}
<details class="req-preparation-settings"${state.preparationSettingsOpen ? ' open' : ''}><summary>范围与生成选项</summary><div class="req-two"><label class="req-field">本期范围<select data-req-scope><option value="ALL" ${state.scopeMode === 'ALL' ? 'selected' : ''}>本期全部</option><option value="SELECTED" ${state.scopeMode === 'SELECTED' ? 'selected' : ''}>指定功能</option></select></label><label class="req-field">指定功能说明<input data-req-scope-text value="${escapeHtml(state.scopeText)}" placeholder="仅在选择指定功能时填写" ${state.scopeMode === 'SELECTED' ? '' : 'disabled'}></label></div>
      <label class="req-check"><input type="checkbox" data-req-image-consent ${state.allowImages ? 'checked' : ''} ${imageModelAvailable ? '' : 'disabled'}>同时分析所选图片 ${imageModelAvailable ? `（当前选中 ${selectedImageCount} 张，含 Word 正文图片）` : '（当前暂不支持图片分析）'}</label>
      <details class="req-generation-options"><summary>高级设置</summary><p class="req-muted">图片最多 3 张 PNG/JPEG，单张 10 MiB，合计 20 MiB；不勾选则仅分析文字。外链、页眉页脚图片仍未分析。</p>
      <label class="req-check"><input type="checkbox" data-req-quality-mode ${state.qualityMode === 'CHECKED' ? 'checked' : ''} ${qualityAvailable ? '' : 'disabled'}>增强检查：独立审查，必要时修订一次并复审${qualityAvailable ? '' : '（当前服务尚未提供）'}</label><p class="req-muted">${state.qualityMode === 'CHECKED' ? '增强检查需选择“指定功能”并填写范围；检查结束后仍需人工核对。' : '全部功能按前端、后端依次生成；结果仍需人工审阅。'}</p></details>
      <details class="req-scope-plan"><summary>分批处理较多需求（最多 4 份）</summary><p class="req-muted">每行写一份用户确定的范围。开始前固定同一组已选资料；每份独立保留成功/失败状态，失败不自动重试或确认。离开此页会停止轮询和后续项调度；已提交请求继续运行，返回后读取状态且不重发。整页刷新不恢复未启动队列，但各已保存设计和请求记录保留。</p><label class="req-field">子范围说明（每行一份）<textarea data-req-batch-scopes rows="4" maxlength="8000" placeholder="图书检索与筛选\n借阅与归还状态">${escapeHtml(state.batchScopeDraft)}</textarea></label><button type="button" class="button" data-req-plan-scopes ${canGenerate ? '' : 'disabled'}>预览范围</button>${state.batchPlan ? `<div class="req-batch-plan"><strong>${state.batchPlan.confirmed ? '执行状态' : '待确认'} · ${state.batchPlan.items.length} 份范围</strong><ol>${state.batchPlan.items.map(item => `<li>${escapeHtml(item.scope)} · ${escapeHtml(statusLabel(item.status))}${item.designId ? ` · 设计 ${escapeHtml(item.designId)}` : ''}${item.error ? ` · 原因 ${escapeHtml(item.error)}` : ''}</li>`).join('')}</ol>${!state.batchPlan.confirmed ? '<p>确认后先创建各自独立的冻结设计快照，再串行开始；候选仍分别待审。</p><button type="button" class="button primary" data-req-start-plan>确认并开始串行分析</button>' : ''}${state.batchPlan.confirmed && state.batchPlan.items.some(item => ['PLANNED','PREPARED','STARTING','RUNNING'].includes(item.status)) ? '<button type="button" class="button" data-req-cancel-plan>取消当前调用并停止未开始项</button>' : ''}${state.batchPlan.confirmed && !state.batchPlan.cancelled && state.batchPlan.haltedReason !== 'START_UNKNOWN' && !state.batchPlan.items.some(item => ['STARTING','RUNNING'].includes(item.status)) && state.batchPlan.items.some(item => item.status === 'PREPARED') ? '<button type="button" class="button" data-req-resume-plan>继续已确认的串行计划</button>' : ''}</div>` : ''}</details>
      ${serviceCapabilities && !serviceCapabilities.model_available ? notice('资料分析服务暂不可用，请联系工作台管理员后重试。', true) : ''}
      </details>
      ${!hasRequirementDocument ? notice('请先上传或选择一份需求说明；协议和截图作为补充资料。', true) : ''}
      ${serviceCapabilities && !serviceCapabilities.model_available ? notice('用例生成服务暂不可用，请联系工作台管理员。', true) : ''}
      <div class="req-actions"><button type="button" class="button primary" data-req-generate ${canGenerate && (state.qualityMode !== 'CHECKED' || state.scopeMode === 'SELECTED') && (state.scopeMode !== 'SELECTED' || state.scopeText.trim()) ? '' : 'disabled'}>生成测试用例</button><span class="req-muted">生成后请核对来源、操作和预期，再确认入库。</span></div>
    </div></section><section class="panel req-import-entry"><div class="panel-body"><div class="req-entry-icon" aria-hidden="true">▧</div><h2>导入已有测试用例</h2><p>已有人工测试用例时，可以直接导入。</p><div class="req-import-drop"><strong>导入用例文件</strong><p>使用工作台支持的 Excel / CSV / JSON 用例格式。</p></div><a class="button" data-nav href="${projectPath(project)}/import">选择用例文件</a><p class="req-muted">导入后先预览，再确认入库。</p><div class="req-progress-next">两种入口最终进入同一个用例库。</div></div></section></div>
    <section class="panel" data-req-stage-panel="generation"><div class="panel-header"><h2>用例生成进度</h2><span class="req-muted">状态由后台任务返回。</span></div><div class="panel-body"><div class="req-actions"><details class="req-record-picker"><summary>查看已有生成记录</summary><label class="req-field">已有设计<select data-req-design><option value="">请选择</option>${designs.map(item => `<option value="${escapeHtml(item.design_id)}" ${item.design_id === state.designId ? 'selected' : ''}>${escapeHtml(item.design_id)} · ${escapeHtml(statusLabel(item.status))}</option>`).join('')}</select></label></details><button type="button" class="button" data-req-refresh>刷新状态</button>${generationActive && available(requirementsApi, 'cancelGeneration') ? `<button type="button" class="button" data-req-cancel-generation ${generation.status === 'CANCEL_REQUESTED' ? 'disabled' : ''}>${generation.status === 'CANCEL_REQUESTED' ? '正在停止生成' : '停止生成'}</button>` : ''}</div>
      ${generation?.status === 'FAILED' ? generationFailureHtml(generation, allCandidates.length, design) : generation ? `<div class="notice req-generation-progress" role="status" data-req-generation-status>${generationStatusHtml(generation, uiCount, backendCount)}</div>` : ''}
      ${qualityDesignDetail(design, generation, sources)}
      ${generation?.image_analysis ? `<details class="req-generation-record"><summary>查看图片分析与来源</summary>${imageAnalysisView(generation.image_analysis, projectId)}</details>` : ''}
      ${design ? `<details class="req-generation-record" ${globalBlockers.length ? 'open' : ''}><summary>资料、范围与生成记录</summary><div class="req-design-summary"><strong>设计 ${escapeHtml(design.design_id || state.designId)} · ${escapeHtml(statusLabel(design.status))}</strong><small>修订 ${escapeHtml(design.revision)} · 本期范围 ${escapeHtml(typeof design.scope === 'string' ? design.scope : design.scope?.description || design.scope?.mode || '待核对')} · 候选：前端 ${uiCount} / 后端 ${backendCount}</small></div><div class="req-issues"><strong>设计范围问题</strong>${(design.issues || []).length ? `<ul>${design.issues.map(issue => `<li>${escapeHtml(issueText(issue))} · ${issue.resolved_at ? '已记录决定' : statusLabel(issue.severity)}</li>`).join('')}</ul>` : '<p>当前没有返回待核对问题；仍需人工检查业务语义。</p>'}</div>${globalBlockers.map(issue => `<details class="req-global-review" data-req-global-issue="${escapeHtml(issue.issue_id)}"><summary>${escapeHtml(issueText(issue))} · 记录影响范围与决定</summary><p class="req-muted">只勾选确实受影响的候选。无法判断时保留待核对，不要把影响范围默认为空。</p><label class="req-field">核对人<input data-req-global-reviewer maxlength="120"></label><label class="req-field">决定与依据<textarea data-req-global-decision rows="2"></textarea></label><div class="req-global-candidates">${allCandidates.map(item => `<label class="req-check"><input type="checkbox" data-req-affected="${escapeHtml(item.candidate_id)}">${escapeHtml(item.content?.external_id || item.candidate_id)} · ${escapeHtml(item.case_type)}</label>`).join('')}</div><label class="req-check"><input type="checkbox" data-req-none-affected>确认本期候选均不受影响</label><button type="button" class="button" data-req-review-global ${available(requirementsApi, 'reviewDesignIssue') ? '' : 'disabled'}>保存范围决定</button>${!available(requirementsApi, 'reviewDesignIssue') ? '<small>设计范围复核接口尚未接入，当前问题不能解除。</small>' : ''}</details>`).join('')}</details>` : '<div class="req-empty">选择已有生成记录或上传需求资料后，查看生成结果。</div>'}
    </div></section>
    <section class="panel" data-req-candidates data-req-stage-panel="review"><div class="panel-header"><h2>核对业务步骤与预期</h2><span class="req-muted">确认业务预期不等于脚本或执行通过。</span></div><div class="panel-body">${state.confirmedForAutomation || allCandidates.some(item => item.confirmation_status === 'CONFIRMED') || (project.cases || []).some(item => (item.versions || []).some(version => version.content?.status === 'CONFIRMED')) ? '<div class="req-actions req-stage-next"><button type="button" class="button primary" data-req-go-automation>下一步：准备自动化</button></div>' : ''}${qualityPending || globalBlockers.length ? '<div class="req-actions"><span class="req-muted">当前仍有生成质量或设计范围审阅项待处理；确认保持禁用。</span><button type="button" class="button" data-req-stage="generation">前往生成步骤核对</button></div>' : ''}<div class="req-review-layout"><aside class="req-candidate-list"><div class="req-tabs"><button type="button" data-req-type="UI" aria-pressed="${state.candidateType === 'UI'}">前端用例 · ${uiCount}</button><button type="button" data-req-type="BACKEND" aria-pressed="${state.candidateType === 'BACKEND'}">后端用例 · ${backendCount}</button></div>${activeCandidates.map(item => candidateSummary(item, state.selectedCandidates.has(item.candidate_id), item.candidate_id === state.candidateId, sources)).join('') || '<div class="req-empty">本组暂无候选。</div>'}<footer class="req-batch-confirm"><strong>已选择 ${selected.length} 条</strong><p data-req-selected-ids>${selected.map(item => escapeHtml(item.content?.external_id || item.candidate_id)).join(' · ') || '尚未选择用例'}</p><details class="req-selection-identities"><summary>所选用例标识</summary><ul>${selected.map(item => `<li>${escapeHtml(item.content?.external_id || '候选')} · ${escapeHtml(item.candidate_id)}</li>`).join('')}</ul></details><button type="button" class="button primary" data-req-confirm ${canConfirm ? '' : 'disabled'}>确认所选 ${selected.length} 条</button><p class="req-muted">${escapeHtml(confirmationHint)}</p>${activeCandidate && !selected.some(item => item.candidate_id === activeCandidate.candidate_id) ? `<small>本次不包含右侧正在查看的 ${escapeHtml(currentLabel)}。</small>` : ''}</footer></aside><div class="req-candidate-detail"><p class="req-detail-viewing">当前查看 ${escapeHtml(currentLabel)}${activeCandidate ? selected.some(item => item.candidate_id === activeCandidate.candidate_id) ? ' · 已选入左侧批量操作' : ' · 未选入左侧批量操作' : ''}</p><div data-req-detail>${candidateDetail(activeCandidate, false, sources, available(requirementsApi, 'editCandidate'), design)}</div><div data-req-current-confirm>${currentConfirmationHtml()}</div></div></div>
    </div></section>
    <details class="req-export-details" data-req-stage-panel="review"><summary>导出已确认用例</summary><div class="panel-body"><p>按类型导出本项目当前已确认的全部前端或后端用例，并非仅导出当前设计的候选。Excel 供人工测试，JSON 接续自动化；后补协议不改旧导出文件。</p><div class="req-export-grid">${['UI', 'BACKEND'].map(type => `<div><strong>本项目当前已确认的${type === 'UI' ? '前端' : '后端'}用例</strong><div class="req-actions"><button type="button" class="button" data-req-export="${type}:xlsx" ${available(requirementsApi, 'exportCases') ? '' : 'disabled'}>导出 Excel</button><button type="button" class="button" data-req-export="${type}:json" ${available(requirementsApi, 'exportCases') ? '' : 'disabled'}>导出 JSON</button></div></div>`).join('')}</div>${!available(requirementsApi, 'exportCases') ? notice('分类型导出接口尚未接入，不能生成文件。', true) : ''}<div class="req-actions"><button type="button" class="button" data-req-go-cases>进入现有用例库</button><button type="button" class="button" data-req-go-bindings>为后端用例补协议</button></div></div></details>
  </div>`);
  const root = document.querySelector('[data-req-root]');
  if (!root || !viewCurrent() || (root.dataset?.reqProject && root.dataset.reqProject !== projectId)) return;
  const live = () => viewCurrent() && root.isConnected && (!root.dataset?.reqProject || root.dataset.reqProject === projectId);
  if (!state.requirementsStage || generationActive) state.requirementsStage = generationActive || globalBlockers.length || qualityPending ? 'generation' : allCandidates.length ? 'review' : 'sources';
  const setRequirementsStage = stage => {
    state.requirementsStage = stage;
    const heading = root.querySelector('[data-req-heading]');
    if (heading) heading.textContent = stage === 'review' ? '核对生成的测试用例' : stage === 'generation' && generationActive ? '正在设计测试用例' : stage === 'generation' ? '用例生成记录' : '准备测试用例';
    root.querySelectorAll('[data-req-stage-panel]').forEach(panel => { panel.hidden = panel.dataset.reqStagePanel !== stage; });
    root.querySelectorAll('[data-req-stage]').forEach(button => {
      if (button.dataset.reqStage === stage) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
  };
  setRequirementsStage(state.requirementsStage);
  const uploadFile = root.querySelector('[data-req-file]');
  if (state.uploadDraft.file && typeof DataTransfer === 'function') {
    const transfer = new DataTransfer(); transfer.items.add(state.uploadDraft.file); uploadFile.files = transfer.files;
  }
  let busy = false;
  const refresh = () => {
    if (!live()) return Promise.resolve();
    const settings = root.querySelector('.req-preparation-settings');
    if (typeof settings?.open === 'boolean') state.preparationSettingsOpen = settings.open;
    const history = root.querySelector('.req-source-history');
    if (typeof history?.open === 'boolean') state.sourceHistoryOpen = history.open;
    return renderRequirements({ project, query, showPage, go, toast, requirementsApi, isCurrent });
  };
  if (state.batchPlan) state.batchPlan.refreshActiveView = () => live() ? refresh() : Promise.resolve();
  const advanceBatch = async () => {
    const plan = state.batchPlan;
    if (!plan || plan.halted || plan.cancelled || !live()) return;
    const started = await startNextRequirementsScope(plan, { projectId, requirementsApi, isActive: live });
    if (!live()) return;
    if (plan.refreshActiveView) await plan.refreshActiveView();
    return started;
  };
  if (requirementsPollers.has(projectId)) clearInterval(requirementsPollers.get(projectId));
  requirementsPollers.delete(projectId);
  let batchReconciled = false;
  if (batchTaskId && generationTerminal(batchGeneration)) {
    batchReconciled = finishRequirementsScope(state.batchPlan, batchTaskId, batchGeneration);
    if (state.batchPlan.cancelled) {
      for (const item of state.batchPlan.items) if (item.status === 'PREPARED') item.status = 'CANCELLED';
    }
  }
  // Read the active batch task again after awaits above. A competing render may
  // have completed the STARTING reservation and installed a task since entry.
  const polledBatchTaskId = state.batchPlan?.currentTaskId || '';
  const polledTaskId = polledBatchTaskId || state.generationId;
  const polledGeneration = polledBatchTaskId ? batchGeneration : generation;
  if ((polledBatchTaskId || ACTIVE_GENERATION.includes(polledGeneration?.status) ||
    generationNeedsReconciliation(design, polledGeneration)) && polledTaskId && available(requirementsApi, 'getGeneration')) {
    let polling = false;
    const timer = setInterval(async () => {
      if (polling || !live()) return;
      polling = true;
      try {
        const latest = await requirementsApi.getGeneration(projectId, polledTaskId);
        if (!live() || (!polledBatchTaskId &&
          (state.designId !== design?.design_id || state.generationId !== polledTaskId))) return;
        const progress = root.querySelector('[data-req-quality-progress]');
        if (progress && polledTaskId === state.generationId) progress.textContent = qualityProgressLabel(design, latest);
        const statusText = root.querySelector('[data-req-generation-status]');
        if (statusText && polledTaskId === state.generationId) statusText.innerHTML = generationStatusHtml(latest);
        if (generationTerminal(latest)) {
          if (!polledBatchTaskId && latest.status === 'COMPLETED') state.requirementsStage = 'review';
          clearInterval(timer); requirementsPollers.delete(projectId);
          let batchAdvanced = false;
          if (state.batchPlan?.currentTaskId === polledTaskId) {
            finishRequirementsScope(state.batchPlan, polledTaskId, latest);
            if (state.batchPlan.cancelled) {
              for (const item of state.batchPlan.items) if (item.status === 'PREPARED') item.status = 'CANCELLED';
            } else if (live() && !state.batchPlan.paused) {
              await advanceBatch();
              batchAdvanced = true;
            }
          }
          if (live() && !batchAdvanced) {
            const shouldNotify = !polledBatchTaskId && state.lastTerminalNoticeTaskId !== polledTaskId;
            await refresh();
            if (viewCurrent() && shouldNotify && state.designId === design.design_id) {
              let shown;
              try { shown = await requirementsApi.getDesign(projectId, state.designId); } catch { /* The refreshed view already shows any read error. */ }
              if (viewCurrent() && generationTerminal(shown?.generation) && lastProjectId === projectId && state.designId === design.design_id) {
                state.lastTerminalNoticeTaskId = polledTaskId;
                const counts = shown?.candidates;
                toast(generationTerminalMessage(latest, counts?.UI?.length, counts?.BACKEND?.length), latest.status === 'COMPLETED' ? 'success' : 'error');
                document.querySelector(`[data-req-root][data-req-project="${projectId}"] [data-req-candidates]`)?.scrollIntoView?.({ block: 'start' });
              }
            }
          }
        }
      } catch { /* A later poll can recover from a transient read failure. */ }
      finally { polling = false; }
    }, 1500);
    requirementsPollers.set(projectId, timer);
  }
  if (state.batchPlan?.confirmed && !state.batchPlan.cancelled && !state.batchPlan.paused && !state.batchPlan.halted
    && !state.batchPlan.currentTaskId && !state.batchPlan.startingItemId
    && state.batchPlan.items.some(item => item.status === 'PREPARED')) {
    void advanceBatch();
  } else if (batchReconciled && live()) void refresh();
  const act = async (button, operation, refreshOnError = true) => {
    if (busy || !live()) return; busy = true; button.disabled = true;
    try { await operation(); } catch (error) { if (live()) { toast(errorMessage(error), 'error'); button.disabled = false; if (refreshOnError && state.designId) void refresh(); } }
    finally { busy = false; }
  };
  root.addEventListener('change', event => {
    if (!live()) return;
    const el = event.target;
    if (el.dataset.reqKind != null) {
      state.uploadDraft.kind = el.value;
      const file = root.querySelector('[data-req-file]');
      file.accept = '.docx,.md,.markdown,.png,.jpg,.jpeg';
    }
    if (el.dataset.reqFile != null) {
      state.uploadDraft.file = el.files?.[0] || null;
      if (state.uploadDraft.file) {
        if (/\.(png|jpe?g)$/i.test(state.uploadDraft.file.name)) state.uploadDraft.kind = 'IMAGE';
        else if (state.uploadDraft.kind === 'IMAGE') state.uploadDraft.kind = 'PRD';
        root.querySelector('[data-req-kind]').value = state.uploadDraft.kind;
      }
    }
    if (el.dataset.reqDocStatus != null) state.uploadDraft.status = el.value;
    if (el.dataset.reqReplaces != null) state.uploadDraft.replacesSourceId = el.value;
    if (el.dataset.reqSource != null) { if (el.checked) state.selectedSources.add(el.dataset.reqSource); else state.selectedSources.delete(el.dataset.reqSource); void refresh(); }
    else if (el.dataset.reqScope != null) { state.scopeMode = el.value; void refresh(); }
    else if (el.dataset.reqQualityMode != null) { state.qualityMode = el.checked ? 'CHECKED' : 'STANDARD'; void refresh(); }
    else if (el.dataset.reqImageConsent != null) { state.allowImages = el.checked; void refresh(); }
    else if (el.dataset.reqDesign != null) { state.designId = el.value; state.candidateId = ''; state.selectedCandidates.clear(); void refresh(); }
    else if (el.dataset.reqCandidate != null) { if (el.checked) state.selectedCandidates.add(el.dataset.reqCandidate); else state.selectedCandidates.delete(el.dataset.reqCandidate); void refresh(); }
  });
  root.addEventListener('input', event => {
    if (!live()) return;
    if (event.target.dataset.reqVersion != null) state.uploadDraft.version = event.target.value;
    if (event.target.dataset.reqBatchScopes != null) state.batchScopeDraft = event.target.value;
    if (event.target.dataset.reqScopeText != null) {
      state.scopeText = event.target.value;
      root.querySelector('[data-req-generate]').disabled = !(canGenerate && (state.qualityMode !== 'CHECKED' || state.scopeMode === 'SELECTED') && state.scopeText.trim());
    }
  });
  root.addEventListener('click', event => {
    if (!live()) return;
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.reqStage) { setRequirementsStage(button.dataset.reqStage); const heading = root.querySelector(`[data-req-stage-panel="${button.dataset.reqStage}"] h2`); if (heading) { heading.tabIndex = -1; heading.focus(); } return; }
    if (button.dataset.reqAddStep != null && design?.revision_basis?.mode === 'CASE_DESIGN_CORRECTION') {
      const panel = root.querySelector('[data-req-detail]');
      const container = panel.querySelector('.req-steps');
      const order = container.querySelectorAll('[data-correction-step]').length + 1;
      container.insertAdjacentHTML('beforeend', correctionStepEditor({ order, action: '', expected: '', source_refs: [] }, sources, design));
      return;
    }
    if (button.dataset.reqRemoveStep != null && design?.revision_basis?.mode === 'CASE_DESIGN_CORRECTION') {
      const panel = root.querySelector('[data-req-detail]');
      const rows = [...panel.querySelectorAll('[data-correction-step]')];
      if (rows.length < 2) return void toast('至少保留一个步骤。', 'error');
      button.closest('[data-correction-step]').remove();
      [...panel.querySelectorAll('[data-correction-index]')].forEach((index, position) => { index.textContent = String(position + 1); });
      return;
    }
    if (button.dataset.reqRemoveSource != null) { state.selectedSources.delete(button.dataset.reqRemoveSource); void refresh(); return; }
    if (button.dataset.reqGoWorkbench != null) return void go(projectPath(project));
    if (button.dataset.reqGoCases != null) return void go(`${projectPath(project)}/cases`);
    if (button.dataset.reqGoAutomation != null) return void go(`${projectPath(project)}/automation`);
    if (button.dataset.reqGoBindings != null) return void go(`${projectPath(project)}/bindings`);
    if (button.dataset.reqRefresh != null) return void refresh();
    if (button.dataset.reqPlanScopes != null) return void act(button, async () => {
      const scopes = parseRequirementsScopePlan(state.batchScopeDraft);
      if (!selectedSources.some(source => ['PRD','MRD'].includes(normalizedKind(source)))) throw new Error('请先选择至少一份 PRD 或 MRD');
      state.batchPlan = { confirmed: false, cancelled: false, qualityMode: state.qualityMode, allowModelText: true, allowModelImages: state.allowImages,
        sourceIds: selectedSources.map(sourceId), items: scopes.map((scope, index) => ({ index: index + 1, scope, status: 'PLANNED' })) };
      await refresh();
    }, false);
    if (button.dataset.reqStartPlan != null) return void act(button, async () => {
      const plan = state.batchPlan;
      if (!plan || plan.confirmed || plan.items.length < 1 || plan.items.length > 4) throw new Error('REQUIREMENT_SCOPE_PLAN_INVALID');
      plan.confirmed = true;
      for (const item of plan.items) {
        if (!live()) return;
        try {
          const design = await requirementsApi.createDesign(projectId, { sourceIds: [...plan.sourceIds],
            scope: { mode: 'SELECTED', description: item.scope }, qualityMode: plan.qualityMode, allowModelText: plan.allowModelText, allowModelImages: plan.allowModelImages });
          if (!live()) return;
          item.designId = design.design_id; item.status = 'PREPARED';
        } catch (error) {
          item.status = 'FAILED'; item.error = error?.code || error?.message || 'REQUIREMENT_DESIGN_CREATE_FAILED';
        }
      }
      await advanceBatch();
      if (!viewCurrent()) return;
      toast(`已保存 ${plan.items.filter(item => item.designId).length} 份独立范围，逐份串行生成，结果分别待审。`);
    }, false);
    if (button.dataset.reqCancelPlan != null) return void act(button, async () => {
      const plan = state.batchPlan;
      if (!plan?.confirmed) return;
      plan.cancelled = true;
      for (const item of plan.items) if (['PLANNED','PREPARED'].includes(item.status)) item.status = 'CANCELLED';
      const active = plan.items.find(item => item.status === 'RUNNING');
      if (active?.taskId && available(requirementsApi, 'cancelGeneration')) await requirementsApi.cancelGeneration(projectId, active.taskId);
      if (!live()) return;
      toast('已请求停止当前调用，并取消所有尚未开始的子范围。'); await refresh();
    }, false);
    if (button.dataset.reqResumePlan != null) return void act(button, async () => {
      state.batchPlan.paused = false;
      state.batchPlan.halted = false;
      await advanceBatch();
    }, false);
    if (button.dataset.reqType) { state.candidateType = button.dataset.reqType; state.candidateTypeChosen = true; state.candidateId = ''; state.selectedCandidates.clear(); return void refresh(); }
    if (button.dataset.reqOpenCandidate) { state.candidateId = button.dataset.reqOpenCandidate; return void refresh(); }
    if (button.dataset.reqEditCandidate != null && activeCandidate) { root.querySelector('[data-req-detail]').innerHTML = candidateDetail(activeCandidate, true, sources, available(requirementsApi, 'editCandidate'), design); root.querySelector('[data-req-current-confirm]').innerHTML = '<small>先保存或取消当前修改，再确认用例。</small>'; if (selected.some(item => item.candidate_id === activeCandidate.candidate_id)) root.querySelector('[data-req-confirm]').disabled = true; return; }
    if (button.dataset.reqCancelEdit != null) { root.querySelector('[data-req-detail]').innerHTML = candidateDetail(activeCandidate, false, sources, available(requirementsApi, 'editCandidate'), design); root.querySelector('[data-req-current-confirm]').innerHTML = currentConfirmationHtml(); root.querySelector('[data-req-confirm]').disabled = !canConfirm; return; }
    if (button.dataset.reqReviewGlobal != null) return void act(button, async () => {
      const panel = button.closest('[data-req-global-issue]');
      const reviewer = panel.querySelector('[data-req-global-reviewer]').value.trim();
      const decisionText = panel.querySelector('[data-req-global-decision]').value.trim();
      const affectedCandidateIds = [...panel.querySelectorAll('[data-req-affected]:checked')].map(input => input.dataset.reqAffected);
      const noneAffected = panel.querySelector('[data-req-none-affected]').checked;
      if (!reviewer || !decisionText || (!affectedCandidateIds.length && !noneAffected) || (affectedCandidateIds.length && noneAffected)) {
        throw new Error('请填写核对人与依据，并明确选择受影响候选或确认均不受影响');
      }
      await requirementsApi.reviewDesignIssue(projectId, state.designId, {
        revision: design.revision, issueId: panel.dataset.reqGlobalIssue, reviewer, decisionText,
        affectedCandidateIds, ...(noneAffected ? { noneAffectedConfirmed: true } : {}),
      });
      if (!live()) return;
      toast('设计范围决定已保存；受影响候选仍需逐条核对。'); await refresh();
    });
    if (button.dataset.reqReviewCandidate != null && activeCandidate) return void act(button, async () => {
      const panel = root.querySelector('[data-req-detail]');
      const reviewer = panel.querySelector('[data-req-reviewer]').value.trim();
      const decisions = [...panel.querySelectorAll('[data-req-issue]')].filter(row => row.querySelector('[data-req-review-text]').value.trim()).map(row => ({
        issue_id: row.dataset.reqIssue, reviewer,
        text: row.querySelector('[data-req-review-text]').value.trim(),
        step_order: Number(row.querySelector('[data-req-review-step]').value),
      }));
      const adoptedScope = panel.querySelector('[data-req-coverage-scope]')?.value.trim() || '';
      const coverageDecision = adoptedScope ? { reviewer, adopted_scope: adoptedScope,
        note: panel.querySelector('[data-req-coverage-note]')?.value.trim() || '' } : null;
      if (!reviewer || (!decisions.length && !coverageDecision) || decisions.some(item => !item.step_order)) {
        throw new Error('请填写核对人，并为至少一项决定填写依据和关联步骤；部分读取还需明确采用范围');
      }
      const content = candidateContentFromPanel(activeCandidate, panel, design);
      await requirementsApi.editCandidate(projectId, state.designId, activeCandidate.candidate_id, {
        revision: design.revision, ...(content ? { content } : {}), decisions, coverageDecision,
      });
      if (!live()) return;
      toast(content ? '当前编辑内容与人工决定已一并保存；请复查新预期及剩余问题。' : '候选核对决定已保存；请复查剩余问题与业务预期。'); await refresh();
    }, false);
    if (button.dataset.reqUpload != null) return void act(button, async () => {
      const file = root.querySelector('[data-req-file]').files?.[0] || state.uploadDraft.file;
      if (!file) throw new Error('请先选择文件');
      const kind = root.querySelector('[data-req-kind]').value;
      const imageFile = /\.(png|jpe?g)$/i.test(file.name);
      const documentFile = /\.(docx|md|markdown)$/i.test(file.name);
      if ((kind === 'IMAGE' && !imageFile) || (kind !== 'IMAGE' && !documentFile)) throw new Error(kind === 'IMAGE' ? '原型/截图只接受 PNG/JPEG 文件，请调整资料角色或重新选择兼容文件。' : 'PRD、MRD 和协议只接受 DOCX/Markdown 文件，请调整资料角色或重新选择兼容文件。');
      const result = await requirementsApi.upload(projectId, { kind, fileName: file.name, body: file,
        documentVersion: root.querySelector('[data-req-version]').value.trim(), documentStatus: root.querySelector('[data-req-doc-status]').value,
        replacesSourceId: root.querySelector('[data-req-replaces]').value });
      if (!live()) return;
        if (sourceId(result)) {
          if (result.supersedes_source_id) state.selectedSources.delete(result.supersedes_source_id);
          state.selectedSources.add(sourceId(result));
        }
      Object.assign(state.uploadDraft, { file: null, version: '', replacesSourceId: '' });
      toast('资料快照已保存；读取状态请按返回结果核对。'); await refresh();
    });
    if (button.dataset.reqGenerate != null) return void act(button, async () => {
      const scope = { mode: state.scopeMode, description: state.scopeMode === 'SELECTED' ? state.scopeText.trim() : '' };
      const created = await requirementsApi.createDesign(projectId, { sourceIds: selectedSources.map(sourceId), scope, qualityMode: state.qualityMode,
        allowModelText: true, allowModelImages: state.allowImages });
      if (!live()) return;
      if (!created?.design_id || !Number.isInteger(created.revision)) throw new Error('REQUIREMENT_DESIGN_RESPONSE_INVALID');
      state.designId = created.design_id; state.requirementsStage = 'generation';
      const task = await requirementsApi.startGeneration(projectId, created.design_id, {
        revision: created.revision, allowModelText: true, allowModelImages: state.allowImages,
      });
      if (!live()) return;
      state.generationId = task?.task_id || task?.generation_id || '';
      if (!state.generationId) throw new Error('REQUIREMENT_GENERATION_RESPONSE_INVALID');
      toast('分析任务已创建，后台状态会自动更新；也可手动刷新。'); await refresh();
    });
    if (button.dataset.reqCancelGeneration != null) return void act(button, async () => {
      await requirementsApi.cancelGeneration(projectId, state.generationId);
      if (!live()) return;
      toast('已请求取消后续分析。'); await refresh();
    });
    if (button.dataset.reqSaveCandidate != null && activeCandidate) return void act(button, async () => {
      const panel = root.querySelector('[data-req-detail]');
      const content = candidateContentFromPanel(activeCandidate, panel, design);
      if (!content) throw new Error('候选编辑框已关闭，请重新进入编辑模式');
      await requirementsApi.editCandidate(projectId, state.designId, activeCandidate.candidate_id, {
        revision: design.revision, content, sourceRefs: content.steps.flatMap(step => step.source_refs || []),
      });
      if (!live()) return;
      toast(design.revision_basis?.mode === 'CASE_DESIGN_CORRECTION' ? '用例修订稿已保存；请逐步核对来源并记录当前正文的决定。' : activeCandidate.target_case ? '冲突预期已保存为待审候选；仍需逐项记录人工决定。' : '候选修改已保存，仍需重新核对来源与预期。'); await refresh();
    }, false);
    if (button.dataset.reqConfirm != null || button.dataset.reqConfirmCurrent != null) return void act(button, async () => {
      const currentOnly = button.dataset.reqConfirmCurrent != null;
      if (currentOnly ? !canConfirmCurrent : !canConfirm) throw new Error('当前用例仍有待核对项，不能确认');
      const toConfirm = currentOnly ? [activeCandidate] : selected;
      const result = await requirementsApi.confirmCandidates(projectId, state.designId, {
        revision: design.revision, projectRevision: design.projectRevision ?? project.revision,
        candidateIds: toConfirm.map(item => item.candidate_id),
      });
      if (!live()) return;
      const confirmedCases = result?.cases;
      if (!Array.isArray(confirmedCases) || confirmedCases.length !== toConfirm.length
        || confirmedCases.some(item => !item.case_id || !item.version)) throw new Error('REQUIREMENT_CONFIRM_RESPONSE_INVALID');
      for (const item of toConfirm) state.selectedCandidates.delete(item.candidate_id);
      state.requirementsStage = 'review'; state.confirmedForAutomation = true; toast(`已确认 ${confirmedCases.length} 条${state.candidateType === 'UI' ? '前端' : '后端'}用例。下一步可进入后端协议绑定与自动化计划；执行仍需单独审阅。`); await refresh();
      if (!viewCurrent()) return;
      document.querySelector(`[data-req-root][data-req-project="${projectId}"] [data-req-candidates] [data-req-go-automation]`)?.focus();
    });
    if (button.dataset.reqExport) return void act(button, async () => {
      const [caseTypeValue, format] = button.dataset.reqExport.split(':');
      const exported = await requirementsApi.exportCases(projectId, { caseType: caseTypeValue, format });
      if (!live()) return;
      saveBlob(exported);
      toast(`已导出本项目当前已确认的${caseTypeValue === 'UI' ? '前端' : '后端'}用例快照。`); button.disabled = false;
    });
  });
}

function confirmedBackendVersions(item) {
  return (item?.versions || []).filter(version => caseType(version.content) === 'BACKEND'
    && version.content?.status === 'CONFIRMED').sort((left, right) => right.version - left.version);
}

function mappingValue(mapping, field) { return escapeHtml(mapping?.[field] || ''); }

function bindingDraftKey(caseKey, protocolId) { return `${caseKey || ''}|${protocolId || ''}`; }

export function cacheBindingDraft(state, caseKey, protocolId, draft) {
  if (!state.bindingDrafts) state.bindingDrafts = {};
  state.bindingDrafts[bindingDraftKey(caseKey, protocolId)] = {
    mappings: structuredClone(draft.mappings || []), reviewer: draft.reviewer || '', conflict: draft.conflict || '',
  };
  return state.bindingDrafts[bindingDraftKey(caseKey, protocolId)];
}

export function restoreBindingDraft(state, caseKey, protocolId) {
  const draft = state.bindingDrafts?.[bindingDraftKey(caseKey, protocolId)];
  return draft ? structuredClone(draft) : null;
}

export function persistBindingFormEvent(state, { caseKey, protocolId, event, collectMappings, conflict = '' }) {
  if (!event?.target?.matches?.('[data-bind-field], [data-bind-conflict], [data-bind-reviewer], [data-bind-source-ref]')) return false;
  const mappings = collectMappings();
  const reviewer = event.target.dataset?.bindReviewer != null ? event.target.value : state.bindingReviewer || '';
  if (event.target.dataset?.bindReviewer != null) state.bindingReviewer = reviewer;
  cacheBindingDraft(state, caseKey, protocolId, {
    mappings, reviewer,
    conflict: event.target.dataset?.bindConflict != null ? event.target.value : conflict,
  });
  state.mappings = mappings;
  return true;
}

export function editableMapping(mapping) {
  return {
    order: mapping.step_order ?? mapping.order,
    command: mapping.command ?? mapping.request ?? '',
    request_fields: mapping.request_fields ?? '',
    units: mapping.units ?? mapping.unit ?? '',
    response_fields: mapping.response_fields ?? mapping.response ?? '',
    business_observation: mapping.business_observation ?? mapping.observation ?? '',
    cleanup: mapping.cleanup ?? '',
    source_refs: mapping.source_refs || [],
  };
}

const INTERFACE_MAPPING_FIELDS = ['command', 'request_fields', 'units', 'response_fields', 'cleanup'];

export function copyPreviousInterfaceMapping(previous, current, protocolId, protocolSegments) {
  const next = { ...current };
  for (const field of INTERFACE_MAPPING_FIELDS) next[field] = previous?.[field] ?? '';
  next.source_refs = (previous?.source_refs || []).filter(ref => ref?.snapshot_id === protocolId
    && protocolSegments.some(segment => segment.segment_id === ref.segment_id
      && segment.quote_sha256 === ref.quote_sha256)).map(ref => ({ ...ref }));
  return next;
}

function bindingStatus(binding) {
  if (!binding) return '尚未保存绑定';
  const technical = statusLabel(binding.status);
  const confirmation = binding.confirmation_status === 'CONFIRMED' ? '已人工确认' : '草稿';
  return `${technical} · ${confirmation}`;
}

export async function renderBindings({ project, query, showPage, go, toast, requirementsApi = {}, isCurrent = () => true }) {
  if (!isCurrent()) return;
  const state = stateFor(project), projectId = project.project_id, errors = [];
  const viewCurrent = () => isCurrent() && lastProjectId === projectId;
  const backendCases = (project.cases || []).filter(item => confirmedBackendVersions(item).length);
  let sources = [], bindings = [];
  if (available(requirementsApi, 'listSources')) {
    try { sources = rowsOf(await requirementsApi.listSources(projectId), 'sources'); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  const protocolSources = sources.filter(source => normalizedKind(source) === 'PROTOCOL');
  const requestedCase = query?.get?.('case_id'), requestedVersion = Number(query?.get?.('version'));
  const queryKey = `${requestedCase || ''}:${Number.isInteger(requestedVersion) ? requestedVersion : ''}`;
  if (queryKey !== state.bindingQueryKey) {
    state.bindingQueryKey = queryKey;
    if (requestedCase && backendCases.some(item => item.case_id === requestedCase)) {
      state.selectedCaseId = requestedCase;
      state.selectedCaseVersion = requestedVersion;
    }
  }
  if (!backendCases.some(item => item.case_id === state.selectedCaseId)) state.selectedCaseId = backendCases[0]?.case_id || '';
  const selectedCase = backendCases.find(item => item.case_id === state.selectedCaseId);
  const eligibleVersions = confirmedBackendVersions(selectedCase);
  const version = eligibleVersions.find(item => item.version === state.selectedCaseVersion) || eligibleVersions[0] || null;
  state.selectedCaseVersion = version?.version || 0;
  const caseKey = `${state.selectedCaseId}:v${version?.version || ''}:${version?.content_sha256 || ''}`;
  if (state.bindingCaseKey !== caseKey) {
    if (state.bindingCaseKey && state.bindingDirty) cacheBindingDraft(state, state.bindingCaseKey, state.protocolId, {
      mappings: state.mappings, reviewer: state.bindingReviewer, conflict: state.bindingConflict || '',
    });
    state.bindingCaseKey = caseKey;
    state.mappings = []; state.bindingReviewer = ''; state.bindingConflict = ''; state.protocolId = ''; state.bindingDirty = false;
  }
  if (selectedCase && available(requirementsApi, 'getBindings')) {
    try { bindings = rowsOf(await requirementsApi.getBindings(projectId, selectedCase.case_id), 'bindings'); }
    catch (error) { errors.push(errorMessage(error)); }
    if (!viewCurrent()) return;
  }
  bindings.sort((left, right) => Number(right.version || 0) - Number(left.version || 0));
  const latest = bindings[0] || null;
  if (!state.protocolId && latest?.protocol_source_id && protocolSources.some(source => sourceId(source) === latest.protocol_source_id)) state.protocolId = latest.protocol_source_id;
  if (!state.protocolId && protocolSources.length === 1) state.protocolId = sourceId(protocolSources[0]);
  const selectedBindingDraft = restoreBindingDraft(state, caseKey, state.protocolId);
  if (selectedBindingDraft) { state.mappings = selectedBindingDraft.mappings; state.bindingReviewer = selectedBindingDraft.reviewer; state.bindingConflict = selectedBindingDraft.conflict; state.bindingDirty = true; }
  const protocolSource = protocolSources.find(source => sourceId(source) === state.protocolId);
  const protocolSegments = rowsOf(protocolSource?.segments, 'segments').filter(segment => segment.segment_id && segment.quote_sha256);
  const activeBinding = bindings.find(binding => binding.protocol_source_id === state.protocolId
    && binding.case_version === version?.version && binding.case_content_sha256 === version?.content_sha256) || null;
  const bindingHistory = bindings.filter(binding => binding.case_version === version?.version
    && binding.case_content_sha256 === version?.content_sha256);
  const conflictingBindings = bindingHistory.filter(binding => binding.status === 'CONFLICT'
    && binding.protocol_source_id === state.protocolId
    && (!protocolSource?.sha256 || binding.protocol_sha256 === protocolSource.sha256));
  const unresolvedConflict = conflictingBindings.length > 0;
  const conflictNote = selectedBindingDraft ? selectedBindingDraft.conflict
    : conflictingBindings.find(binding => binding.conflict_note)?.conflict_note || '';
  const requirementsSourceCase = selectedCase?.root_source?.type === 'requirements-design'
    && Boolean(version?.content?.requirements_origin?.design_id);
  const canReviseCase = requirementsSourceCase && selectedCase?.current_version === version?.version;
  if (!state.mappings.length && activeBinding?.mappings?.length) {
    state.mappings = activeBinding.mappings.map(editableMapping);
  }
  const steps = version?.content?.steps || [];
  const mappings = steps.map(step => ({ order: Number(step.order), ...(state.mappings.find(row => Number(row.order) === Number(step.order)) || {}) }));
  const missing = bindingMissingSteps(steps, mappings);
  const canSave = Boolean(selectedCase && state.protocolId && available(requirementsApi, 'createBinding'));
  const canConfirm = canSave && steps.length > 0 && !missing.length && !unresolvedConflict
    && Boolean(state.bindingReviewer.trim());
  const canBackendAutomation = Boolean(selectedCase && version && requirementsApi.capabilities?.backendRunner === true);
  showPage(`<div class="req-page" data-req-binding-root data-req-binding-project="${escapeHtml(projectId)}">
    <div class="page-heading"><div><h1>后补协议与自动化绑定</h1><p>${escapeHtml(project.name)} · 选择已确认后端用例，逐步绑定实际协议；原业务预期保持可见。</p></div><div class="req-actions"><button type="button" class="button" data-bind-go-design>资料与用例设计</button><button type="button" class="button" data-bind-go-cases>返回用例库</button></div></div>
    ${errors.map(error => notice(error, true)).join('')}
    ${notice('HTTP/JSON 计划入口已开放。上传协议或确认技术映射不等于可运行；还需非生产环境、角色、数据与清理，以及请求和业务断言的审阅确认。')}
    <section class="panel"><div class="panel-header"><h2>1. 选择业务用例版本与协议快照</h2></div><div class="panel-body"><div class="req-two"><label class="req-field">已确认后端用例<select data-bind-case><option value="">请选择</option>${backendCases.map(item => `<option value="${escapeHtml(item.case_id)}" ${item.case_id === state.selectedCaseId ? 'selected' : ''}>${escapeHtml(item.external_id)} · ${escapeHtml(item.title)}</option>`).join('')}</select></label><label class="req-field">已确认业务版本<select data-bind-case-version>${eligibleVersions.map(item => `<option value="${escapeHtml(item.version)}" ${item.version === version?.version ? 'selected' : ''}>v${escapeHtml(item.version)}${item.version === selectedCase?.current_version ? ' · 当前' : ' · 历史'}</option>`).join('')}</select></label></div><label class="req-field">协议快照<select data-bind-protocol><option value="">请选择</option>${protocolSources.map(source => `<option value="${escapeHtml(sourceId(source))}" ${sourceId(source) === state.protocolId ? 'selected' : ''}>${escapeHtml(sourceLabel(source))} · ${escapeHtml(source.document_version || '版本待核对')}</option>`).join('')}</select></label>
      ${!backendCases.length ? notice('当前项目暂无已确认且明确分类的后端用例。已有用例可先到用例库核对类型与版本。', true) : ''}
      ${!protocolSources.length ? notice('当前项目还没有协议快照。可在下方单独补充；上传后仍需逐步骤映射与人工确认。', true) : ''}
      <div class="req-upload req-upload-inline"><label class="req-field">补充协议文件<input type="file" data-bind-file accept=".docx,.md,.markdown"></label><label class="req-field">协议版本<input data-bind-version placeholder="如 v1.0"></label><button type="button" class="button" data-bind-upload ${available(requirementsApi, 'upload') ? '' : 'disabled'}>保存协议快照</button></div>
      ${!available(requirementsApi, 'upload') ? '<small>协议上传接口尚未接入。</small>' : ''}
      ${selectedCase ? `<p class="req-muted">当前选择：${escapeHtml(selectedCase.external_id)} · 用例 v${escapeHtml(version.version)} · 内容摘要 ${escapeHtml((version.content_sha256 || '').slice(0, 16))}。绑定版本不会改写此用例或旧导出。</p>` : ''}
    </div></section>
    <section class="panel"><div class="panel-header"><h2>2. 逐步骤技术映射</h2><span class="req-pill${missing.length ? ' req-pill-warn' : ''}">${escapeHtml(bindingStatus(activeBinding))}</span></div><div class="panel-body">
      ${selectedCase ? `<div class="req-origin"><strong>原业务预期</strong><p>${escapeHtml(version.content.title)}</p><small>每步预期以用例 v${escapeHtml(version.version)} 为准；协议 ACK 或成功码不能代替业务结果。</small></div>
      <p class="req-muted">以下例子仅说明填写格式，不会自动填入；请逐步对照当前协议原文、参数取值来源和业务观察点。未知内容留空并在草稿中待核验。</p>
      <div class="req-mappings">${steps.map((step, stepIndex) => {
        const row = mappings.find(item => Number(item.order) === Number(step.order)) || {};
        const incomplete = missing.includes(Number(step.order));
        return `<details class="req-mapping req-mapping-step" data-bind-step="${escapeHtml(step.order)}" ${Number(step.order) === Number(state.bindingStepOrder || missing[0] || steps[0]?.order) ? 'open' : ''}><summary><strong>步骤 ${escapeHtml(step.order)}</strong> · ${escapeHtml(step.action || '动作待核对')} · ${escapeHtml(incomplete ? '映射有缺项' : '待人工核对')}</summary><header><h3>步骤 ${escapeHtml(step.order)}</h3><span class="req-pill${incomplete ? ' req-pill-warn' : ''}">${incomplete ? '映射有缺项' : '待人工核对'}</span>${stepIndex ? '<button type="button" class="button" data-bind-copy-previous>沿用上一步接口资料</button>' : ''}</header><div class="req-two"><div><strong>原动作</strong><p>${escapeHtml(step.action)}</p></div><div><strong>原预期</strong><p>${escapeHtml(step.expected || '缺少业务预期，不能确认完整绑定')}</p></div></div><div class="req-mapping-fields"><label class="req-field">接口或命令<input data-bind-field="command" value="${mappingValue(row, 'command')}" placeholder="例：GET /v1/items/{id}"><small>协议规定的方法与路径，或命令名称。</small></label><details class="req-optional-mapping"><summary>请求、响应、单位与清理细节</summary><div class="req-mapping-fields"><label class="req-field">请求字段/输入<input data-bind-field="request_fields" value="${mappingValue(row, 'request_fields')}" placeholder="例：id=测试夹具的对象编号"><small>写字段名、传入位置与取值来源；逐步核对参数。</small></label><label class="req-field">字段单位与范围<input data-bind-field="units" value="${mappingValue(row, 'units')}" placeholder="例：limit 为条数，范围按协议"><small>只记录协议明示的单位、必填和范围；无依据可留空。</small></label><label class="req-field">响应字段/错误<input data-bind-field="response_fields" value="${mappingValue(row, 'response_fields')}" placeholder="例：status、data.id、错误码"><small>区分接口返回字段与业务预期。</small></label><label class="req-field req-wide">数据与清理依据<input data-bind-field="cleanup" value="${mappingValue(row, 'cleanup')}" placeholder="例：记录新建ID并按协议删除"><small>说明测试数据隔离、复原方式及其协议依据；只读操作可说明无副作用。</small></label></div></details><label class="req-field req-wide">业务结果如何观察<input data-bind-field="business_observation" value="${mappingValue(row, 'business_observation')}" placeholder="按原预期核对返回值或再次读取"><small>每一步必填；成功码不能替代业务观察。</small></label><details class="req-protocol-ref-details" ${!(row.source_refs || []).some(ref => ref.snapshot_id === state.protocolId && protocolSegments.some(segment => segment.segment_id === ref.segment_id && segment.quote_sha256 === ref.quote_sha256)) ? 'open' : ''}><summary>选择本步协议原文引用（完整确认至少一项）</summary><fieldset class="req-protocol-refs"><legend>协议原文引用</legend>${protocolSegments.length ? protocolSegments.map(segment => `<label class="req-check"><input type="checkbox" data-bind-source-ref="${escapeHtml(segment.segment_id)}" ${(row.source_refs || []).some(ref => ref.snapshot_id === state.protocolId && ref.segment_id === segment.segment_id) ? 'checked' : ''}><span>${escapeHtml(formatSourceLocation(segment.location, segment.kind))} · ${escapeHtml(String(segment.text || '').slice(0, 140) || '无可显示原文')}</span></label>`).join('') : '<small>当前协议没有可引用的已读取片段；可保存草稿，不能确认完整绑定。</small>'}</fieldset></details><details><summary>原用例来源引用</summary><ul>${sourceRefs(step, sources)}</ul></details></div></details>`;
      }).join('')}</div>
      <label class="req-field">协议与原业务预期冲突时的说明<textarea data-bind-conflict rows="2" placeholder="记录冲突依据，原业务预期保持不变">${escapeHtml(conflictNote)}</textarea></label><p class="req-muted">有业务冲突时保存绑定草稿仅作留痕；原用例不变。需通过下方冲突绑定创建待审业务修订候选，本页不会自动改写用例。</p>${unresolvedConflict ? notice('此用例版本与当前协议快照已有业务冲突；不能直接确认技术映射。请在下方创建并审阅业务修订。', true) : ''}
      <label class="req-field">技术映射核对人<input data-bind-reviewer maxlength="120" value="${escapeHtml(state.bindingReviewer)}" placeholder="完整确认时必填"></label>
      <div class="req-actions"><button type="button" class="button" data-bind-save ${canSave ? '' : 'disabled'}>保存部分绑定草稿</button><button type="button" class="button primary" data-bind-confirm ${canConfirm ? '' : 'disabled'}>确认本条技术映射</button><span class="req-muted" data-bind-missing>${unresolvedConflict ? '业务冲突尚未通过新用例版本解决，不能确认。' : missing.length ? `步骤 ${missing.join('、')} 缺少接口/命令、业务观察或协议原文引用，不能确认完整。` : '提交时服务端还会校验协议、字段与适用的清理要求。'}</span></div>
      ${!available(requirementsApi, 'createBinding') ? notice('绑定保存接口尚未接入；当前输入不会被保存。', true) : ''}` : '<div class="req-empty">先选择一条已确认后端用例，再逐步绑定协议。</div>'}
    </div></section>
    <section class="panel"><div class="panel-header"><h2>3. 绑定历史与业务冲突</h2></div><div class="panel-body">${bindingHistory.length ? bindingHistory.map(binding => `<div class="req-binding-history"><div><strong>绑定 v${escapeHtml(binding.version)} · ${escapeHtml(statusLabel(binding.status))}</strong><small>协议 ${escapeHtml(binding.protocol_source_id)} · ${escapeHtml(binding.confirmation_status === 'CONFIRMED' ? '人工已确认' : '草稿')}</small></div>${binding.status === 'CONFLICT' ? `<button type="button" class="button" data-bind-revision="${escapeHtml(binding.version)}" ${canReviseCase && available(requirementsApi, 'createBindingRevision') ? '' : 'disabled'}>创建待审业务修订</button>` : ''}</div>`).join('') : '<div class="req-empty">此用例版本尚无协议绑定历史。</div>'}${!requirementsSourceCase && bindingHistory.some(binding => binding.status === 'CONFLICT') ? notice('此用例未带可追溯的需求设计来源，需先核对原用例身份、内容与业务依据；不能按编号直接创建修订。', true) : ''}${requirementsSourceCase && !canReviseCase && bindingHistory.some(binding => binding.status === 'CONFLICT') ? notice('当前查看的是历史业务版本；必须先核对当前版本与冲突关系，本页不能从过期版本直接创建修订。', true) : ''}${requirementsSourceCase && !available(requirementsApi, 'createBindingRevision') && bindingHistory.some(binding => binding.status === 'CONFLICT') ? notice('业务修订接口尚未接入；冲突仅被记录，尚未形成待审用例版本。', true) : ''}<p class="req-muted">创建待审修订只生成候选供人工核对，不调用模型；原业务用例和旧导出保持原样。</p></div></section>
    <section class="panel"><div class="panel-header"><h2>4. 执行前仍需核对</h2></div><div class="panel-body"><div class="req-gates"><span>技术映射 ${activeBinding?.status === 'COMPLETE' && activeBinding?.confirmation_status === 'CONFIRMED' ? '已确认' : '待确认'}</span><span>HTTP/JSON 计划入口 已开放</span><span>非生产环境/角色 待核对</span><span>数据/清理 待核对</span><span>执行计划/断言 待审阅确认</span></div><p class="req-muted">协议或用例版本变化后，既有绑定和脚本须重新检查适用性；旧结果和旧导出保持原样。</p><button type="button" class="button primary" data-bind-automation ${canBackendAutomation ? '' : 'disabled'}>进入后端 HTTP/JSON 计划</button>${!canBackendAutomation ? '<small>请先选择已确认后端用例，再进入详情配置环境与审阅计划；绑定完整也不会自动运行。</small>' : ''}</div></section>
  </div>`);
  const root = document.querySelector('[data-req-binding-root]');
  if (!root || !viewCurrent() || (root.dataset?.reqBindingProject && root.dataset.reqBindingProject !== projectId)) return;
  const live = () => viewCurrent() && root.isConnected && (!root.dataset?.reqBindingProject || root.dataset.reqBindingProject === projectId);
  let busy = false;
  const refresh = () => live() ? renderBindings({ project, query, showPage, go, toast, requirementsApi, isCurrent }) : Promise.resolve();
  const persistCurrentDraft = () => {
    if (state.bindingDirty) cacheBindingDraft(state, state.bindingCaseKey, state.protocolId, {
      mappings: collectMappings(), reviewer: state.bindingReviewer, conflict: root.querySelector('[data-bind-conflict]')?.value || '',
    });
  };
  const run = async (button, operation) => {
    if (busy || !live()) return; busy = true; button.disabled = true;
    try { await operation(); } catch (error) {
      if (!live()) return;
      toast(errorMessage(error), 'error'); button.disabled = false;
      if (['BINDING_CONFIRM_BLOCKED','BINDING_CASE_VERSION_MISMATCH'].includes(error?.code || error?.message)) {
        const targetOrder = missing[0] || steps[0]?.order;
        const target = root.querySelector(`[data-bind-step="${targetOrder}"]`);
        if (target) { root.querySelectorAll('[data-bind-step][open]').forEach(item => { if (item !== target) item.open = false; }); target.open = true; state.bindingStepOrder = Number(targetOrder); target.scrollIntoView?.({ block: 'center' }); }
      }
    }
    finally { busy = false; }
  };
  function collectMappings() {
    return [...root.querySelectorAll('[data-bind-step]')].map(container => ({
      order: Number(container.dataset.bindStep),
      ...Object.fromEntries([...container.querySelectorAll('[data-bind-field]')].map(input => [input.dataset.bindField, input.value.trim()])),
      source_refs: [...container.querySelectorAll('[data-bind-source-ref]:checked')].map(input => {
        const segment = protocolSegments.find(item => item.segment_id === input.dataset.bindSourceRef);
        return segment && { snapshot_id: state.protocolId, segment_id: segment.segment_id, quote_sha256: segment.quote_sha256 };
      }).filter(Boolean),
    }));
  }
  function updateBindingReadiness() {
    const missingNow = bindingMissingSteps(steps, collectMappings());
    const confirm = root.querySelector('[data-bind-confirm]');
    if (confirm) confirm.disabled = !(canSave && steps.length > 0 && !missingNow.length && !unresolvedConflict
      && state.bindingReviewer.trim() && !root.querySelector('[data-bind-conflict]').value.trim());
    const hint = root.querySelector('[data-bind-missing]');
    if (hint) hint.textContent = unresolvedConflict ? '业务冲突尚未通过新用例版本解决，不能确认。' : missingNow.length
      ? `步骤 ${missingNow.join('、')} 缺少接口/命令、业务观察或协议原文引用，不能确认完整。`
      : '提交时服务端还会校验协议、字段与适用的清理要求。';
  }
  root.addEventListener('input', event => {
    if (!live()) return;
    if (event.target.dataset.bindReviewer != null) state.bindingReviewer = event.target.value;
    if (persistBindingFormEvent(state, { caseKey: state.bindingCaseKey, protocolId: state.protocolId, event, collectMappings, conflict: root.querySelector('[data-bind-conflict]')?.value || '' })) {
      state.bindingDirty = true;
      if (event.target.dataset.bindConflict != null) state.bindingConflict = event.target.value;
      updateBindingReadiness();
    }
  });
  root.addEventListener('toggle', event => {
    if (!live()) return;
    const step = event.target.closest?.('[data-bind-step]');
    if (step && event.target === step && step.open) state.bindingStepOrder = Number(step.dataset.bindStep);
  }, true);
  root.addEventListener('change', event => {
    if (!live()) return;
    if (event.target.dataset.bindCase != null) { persistCurrentDraft(); state.selectedCaseId = event.target.value; state.selectedCaseVersion = 0; state.bindingCaseKey = ''; state.mappings = []; state.protocolId = ''; void refresh(); }
    else if (event.target.dataset.bindCaseVersion != null) { persistCurrentDraft(); state.selectedCaseVersion = Number(event.target.value); state.bindingCaseKey = ''; state.mappings = []; state.protocolId = ''; void refresh(); }
    else if (event.target.dataset.bindProtocol != null) { persistCurrentDraft(); state.protocolId = event.target.value; const draft = restoreBindingDraft(state, state.bindingCaseKey, state.protocolId); state.mappings = draft?.mappings || []; state.bindingReviewer = draft?.reviewer || ''; state.bindingConflict = draft?.conflict || ''; state.bindingDirty = Boolean(draft); void refresh(); }
    else if (event.target.dataset.bindSourceRef != null) { persistBindingFormEvent(state, { caseKey: state.bindingCaseKey, protocolId: state.protocolId, event, collectMappings, conflict: root.querySelector('[data-bind-conflict]')?.value || '' }); state.bindingDirty = true; updateBindingReadiness(); }
  });
  root.addEventListener('click', event => {
    if (!live()) return;
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.bindCopyPrevious != null) {
      const containers = [...root.querySelectorAll('[data-bind-step]')];
      const currentContainer = button.closest('[data-bind-step]');
      const index = containers.indexOf(currentContainer);
      if (index < 1) return;
      const collected = collectMappings();
      const copied = copyPreviousInterfaceMapping(collected[index - 1], collected[index], state.protocolId, protocolSegments);
      for (const field of INTERFACE_MAPPING_FIELDS) currentContainer.querySelector(`[data-bind-field="${field}"]`).value = copied[field];
      for (const input of currentContainer.querySelectorAll('[data-bind-source-ref]')) {
        input.checked = copied.source_refs.some(ref => ref.segment_id === input.dataset.bindSourceRef);
      }
      updateBindingReadiness();
      toast('已沿用上一步接口资料；请逐步核对参数、协议引用和当前步业务观察点，未自动保存。');
      return;
    }
    if (button.dataset.bindGoDesign != null) return void go(`${projectPath(project)}/requirements`);
    if (button.dataset.bindGoCases != null) return void go(`${projectPath(project)}/cases`);
    if (button.dataset.bindAutomation != null && selectedCase) return void go(`${projectPath(project)}/cases/${encodeURIComponent(selectedCase.case_id)}?version=${version.version}&tab=scripts`);
    if (button.dataset.bindRevision != null && selectedCase) return void run(button, async () => {
      const bindingVersion = Number(button.dataset.bindRevision);
      if (!bindingHistory.some(item => item.version === bindingVersion && item.status === 'CONFLICT')) throw new Error('BINDING_CONFLICT_VERSION_INVALID');
      const result = await requirementsApi.createBindingRevision(projectId, { caseId: selectedCase.case_id, bindingVersion });
      if (!live()) return;
      const designId = result?.design_id || result?.design?.design_id;
      if (!designId) throw new Error('BINDING_REVISION_RESPONSE_INVALID');
      toast('已创建待审业务修订候选；请核对原预期与冲突依据。');
      go(`${projectPath(project)}/requirements?design=${encodeURIComponent(designId)}`);
    });
    if (button.dataset.bindUpload != null) return void run(button, async () => {
      const file = root.querySelector('[data-bind-file]').files?.[0]; if (!file) throw new Error('请先选择协议文件');
      const result = await requirementsApi.upload(projectId, { kind: 'PROTOCOL', fileName: file.name, body: file,
        documentVersion: root.querySelector('[data-bind-version]').value.trim(), documentStatus: 'TO_CHECK' });
      if (!live()) return;
      if (sourceId(result)) state.protocolId = sourceId(result);
      toast('协议快照已保存；仍需逐步核对映射。'); await refresh();
    });
    if (button.dataset.bindSave != null || button.dataset.bindConfirm != null) return void run(button, async () => {
      const confirmation = button.dataset.bindConfirm != null ? 'CONFIRM' : 'DRAFT';
      const conflict = root.querySelector('[data-bind-conflict]').value.trim();
      if (confirmation === 'CONFIRM' && conflict) throw new Error('业务预期存在冲突，请保留绑定草稿并提出用例新版本');
      const submitted = collectMappings();
      const result = await requirementsApi.createBinding(projectId, {
        caseId: selectedCase.case_id, caseVersion: version.version, caseContentSha256: version.content_sha256,
        protocolSourceId: state.protocolId, mappings: submitted, expectedRevision: latest?.version || 0,
        confirmation, conflictNote: conflict, reviewer: state.bindingReviewer.trim(),
      });
      if (!live()) return;
      if (!result?.binding_id || !result?.status) throw new Error('BINDING_RESPONSE_INVALID');
      if (confirmation === 'CONFIRM' && result.confirmation_status !== 'CONFIRMED') throw new Error('BINDING_CONFIRM_RESPONSE_INVALID');
      state.mappings = structuredClone(submitted);
      toast(confirmation === 'CONFIRM' ? '技术映射已人工确认；执行条件仍需单独检查。' : conflict ? '业务冲突已记录在绑定草稿；原用例未改，需另行设计待审修订。' : '部分绑定草稿已保存；原用例版本未改。');
      await refresh();
    });
  });
}
