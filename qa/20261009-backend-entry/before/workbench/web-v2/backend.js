import { failureFeedbackHtml } from './execution-list.js';
import { executionNotesHtml, mountExecutionNotes } from './execution-notes.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const text = value => value === undefined ? '未取得' : JSON.stringify(value);
const label = value => ({ DRAFT: '待审阅', GENERATING: '生成中', COMPLETED: '会话结束', CONFIRMED: '已确认', FAILED: '失败', PASSED: '通过', CANCELLED: '已取消', INTERRUPTED: '服务中断', RUNNING: '执行中', QUEUED: '排队中', STOPPING: '取消中', TIMED_OUT: '超时', ERROR: '技术错误', NOT_RUN: '未执行', FINISHED: '执行结束' })[value] || value || '未取得';
export const backendReasons = {
  PROJECT_ENVIRONMENT_NOT_CONFIGURED: '项目尚未配置 HTTP 测试环境；请前往项目测试环境设置。',
  PROJECT_ENVIRONMENT_MISMATCH: '计划或运行所绑定的 HTTP 环境与项目当前环境不同；历史计划不会自动切换，请检查项目测试环境设置。',
  PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED: '项目测试环境配置已变化，请刷新后重新检查。',
  PROJECT_ENVIRONMENT_BUSY: '有项目运行任务正在使用测试环境，暂不能更改绑定。',
  PROJECT_ENVIRONMENT_REVISION_CONFLICT: '项目测试环境修订已变化，请刷新并核对后重试。',
  BACKEND_PLAN_REVIEW_REQUIRED: 'HTTP 计划尚未审阅确认', BACKEND_CONFIRMED_BINDING_REQUIRED: '缺少当前用例版本的完整已确认协议绑定',
  BACKEND_CONFIRMED_CASE_REQUIRED: '需先确认后端用例内容', BACKEND_CASE_VERSION_STALE: '计划对应的用例版本已过期',
  BACKEND_CASE_STAGE_CONFLICT: '用例把测试初始化或清理列入了业务步骤。请在“用例内容”中创建修订稿，保留原要求，将准备和清理移入前置及测试数据，再生成新版本脚本。',
  BACKEND_PROTOCOL_STALE: '协议版本已变化，需重新绑定', BACKEND_PLAN_IDENTITY_CHANGED: '计划或环境身份已变化，需重新核对',
  BACKEND_PLAN_IMMUTABLE: '已确认计划不可修改，请创建新版本', BACKEND_PLAN_REVISION_CONFLICT: '计划已变化，请刷新后重新审阅',
  BACKEND_ENVIRONMENT_AUTH_REQUIRED: '请确认非生产环境、操作授权并填写核对人', BACKEND_ENVIRONMENT_INVALID: '环境须为 HTTP/HTTPS 根地址，不能包含凭据或使用工作台 4322',
  BACKEND_MODEL_AUTH_REQUIRED: '脚本生成服务暂不可用；请联系工作台管理员检查服务配置，或创建空白计划手工填写', BACKEND_REVIEWER_REQUIRED: '请填写计划核对人',
  BACKEND_EXECUTOR_BUSY: '工作台正在执行任务，请结束后重试', WORKBENCH_BUSY: '工作台正在执行其他任务，本次未启动',
  BACKEND_HARNESS_PROCESS_FAILED: '生成服务未能完成；请联系工作台管理员检查服务，恢复后点击修订或重新生成。',
  BACKEND_HARNESS_CANDIDATE_REQUIRED: '尚未生成可审阅计划；请检查自测反馈后修订，或创建空白计划手工填写。',
  BACKEND_CLEANUP_FAILED: '本次数据清理失败；请按运行编号核对并清理本次测试数据后再运行', BACKEND_TIMEOUT: 'HTTP 请求或运行超时',
  BACKEND_CANCELLED: '运行已取消', BACKEND_ENVIRONMENT_UNAVAILABLE: '后端测试目标未就绪',
  BACKEND_HARNESS_SELF_TEST_REQUIRED: '计划内容与自动生成自测时的冻结哈希不一致，不能确认。请基于反馈重新启动脚本生成与自测，或在本页上方创建空白人工计划（不调用模型）后逐步核对。',
};
const reason = error => backendReasons[error?.code || error?.message || error] || error?.message || error?.code || error || '未知原因';
const badge = status => `<span class="badge ${status === 'PASSED' || status === 'CONFIRMED' ? 'success' : ['FAILED', 'ERROR', 'TIMED_OUT'].includes(status) ? 'danger' : 'warning'}">${esc(label(status))}</span>`;
export const isBackendRun = run => run?.runner_kind === 'HTTP_JSON' || run?.selection?.kind === 'HTTP_JSON' || run?.schema === 'workbench/backend-run-v1';

const generationStatusLabels = {
  RUNNING: '自动生成会话进行中', COMPLETED: '自动生成会话已结束', FAILED: '自动生成会话失败', CANCELLED: '自动生成会话已取消', INTERRUPTED: '自动生成会话中断',
};
const candidateStatusLabels = {
  READY: '候选已提交，待按业务要求审阅', BUSINESS_DIFFERENCE: '发现业务差异，待人工检查',
  NEEDS_ANALYSIS: '需要进一步分析', ENVIRONMENT_BLOCKED: '自测环境受阻',
};
const numberText = value => Number.isFinite(value) ? String(value) : null;
const shortHash = value => typeof value === 'string' ? value.length > 16 ? `${value.slice(0, 12)}…` : value || '未记录' : '未记录';
function budgetText(used, limit) {
  const actual = numberText(used), cap = numberText(limit);
  if (actual !== null && cap !== null) return `${actual} / ${cap}`;
  if (actual !== null) return `${actual}（上限未记录）`;
  if (cap !== null) return `未记录 / ${cap}`;
  return '未记录';
}
function generationBudgetSummary(limits) {
  const fields = ['wall_ms', 'tool_calls', 'harness_starts', 'self_tests', 'quality_reviews', 'independent_validations'];
  if (!limits || typeof limits !== 'object' || fields.some(key => !Number.isSafeInteger(limits[key]) || limits[key] <= 0)) return null;
  return `最长 ${Math.ceil(limits.wall_ms / 1000)} 秒 · 工具调用最多 ${limits.tool_calls} 次 · 自测最多 ${limits.self_tests} 次 · 付费独立质量审查最多 ${limits.quality_reviews} 次 · 独立复验最多 ${limits.independent_validations} 次 · 自动生成启动最多 ${limits.harness_starts} 次；工具调用上限含审查工具，B 模式审查另最多启动 ${limits.quality_reviews} 次，每审最多 12 次受控工具、1 次复验、180 秒。模型用量可能未知，不能据此视为费用相等`;
}
const processFailureStages = {
  PROCESS_SPAWN_FAILURE: '进程启动阶段失败', PROCESS_EXIT_NONZERO: '进程以非零代码退出',
  RUNTIME_OR_CONFIGURATION_FAILURE: '运行时或配置阶段失败', FINAL_EVENT_MISSING: '未观察到最终事件',
  TURN_END_EVENT_MISSING: '未观察到回合结束事件', TURN_NOT_COMPLETED: '回合结束状态非完成',
  NO_TOOL_CALL: '未观察到工具调用', TOOL_RESULT_MISSING: '工具结果事件不完整',
  TIMEOUT: '会话超时', TOOL_BUDGET: '达到工具调用预算', CANCELLED: '会话已取消',
  EVENT_OBSERVER_FAILURE: '事件观察器报告错误', COMPLETED: '事件与工具调用阶段归类为完成',
};
const processDiagnosticLabels = {
  MODULE_RESOLUTION_FAILURE: '模块加载线索', CONFIG_OR_PATCH_FAILURE: '运行配置线索',
  PROVIDER_CREDENTIALS_FAILURE: '模型服务凭据线索', PROVIDER_HTTP_FAILURE: '模型服务 HTTP 响应线索',
  TRANSPORT_FAILURE: '网络传输线索', LOCAL_BRIDGE_BIND_FAILURE: '本地桥接端口线索',
  MCP_INITIALIZATION_FAILURE: 'MCP 初始化线索', TOOL_REGISTRATION_FAILURE: '工具注册线索',
  SPAWN_NOT_FOUND: '启动程序未找到', SPAWN_DENIED: '启动权限被拒', SPAWN_INVALID: '启动参数无效',
  OTHER_PROCESS_ERROR: '其他进程启动错误',
  MODEL_TOOL_RESPONSE_MALFORMED: '模型返回的工具参数格式无效；未取得有效审查结论',
};
const turnEndLabels = { completed: '完成', aborted: '中止', tool_limit: '工具预算耗尽', cancelled: '取消', error: '错误' };
const terminationLabels = { timeout: '超时', tool_limit: '工具预算耗尽', cancelled: '取消', observer_error: '事件观察错误' };
function backendProcessDiagnosticHtml(session) {
  const diagnostic = session?.process_diagnostic;
  const failed = ['FAILED', 'INTERRUPTED'].includes(session?.status);
  if (!diagnostic || typeof diagnostic !== 'object' || Array.isArray(diagnostic)) {
    return failed ? '<p class="notice warning">该历史失败记录未保存过程诊断详情，根因未知。</p>' : '';
  }
  const stage = processFailureStages[diagnostic.failure_stage];
  const stderrClass = processDiagnosticLabels[diagnostic.stderr_class];
  const eventClass = processDiagnosticLabels[diagnostic.event_error_class];
  const processError = processDiagnosticLabels[diagnostic.process_error_kind];
  const observerError = processDiagnosticLabels[diagnostic.observer_error_kind];
  const clueParts = [stage, stderrClass, eventClass, processError, observerError].filter(Boolean);
  if (Number.isInteger(diagnostic.provider_http_status) && diagnostic.provider_http_status >= 100 && diagnostic.provider_http_status <= 599) {
    clueParts.push(`模型服务 HTTP ${diagnostic.provider_http_status}`);
  }
  const clue = failed
    ? `<p class="notice warning">诊断线索（有限事件的启发式分类，不能证明根因）：${esc(clueParts.join(' · ') || '未能归类；根因未知')}</p>`
    : '';
  const rows = [];
  const add = (name, value) => { if (value !== null && value !== undefined) rows.push(`<dt>${esc(name)}</dt><dd>${esc(value)}</dd>`); };
  if (stage) add('诊断阶段', stage);
  if (typeof diagnostic.error_code === 'string' && /^[A-Z][A-Z0-9_]{2,100}$/.test(diagnostic.error_code)) add('会话错误码', diagnostic.error_code);
  if (Number.isInteger(diagnostic.exit_code)) add('进程退出码', diagnostic.exit_code);
  if (terminationLabels[diagnostic.termination]) add('终止标记', terminationLabels[diagnostic.termination]);
  if (turnEndLabels[diagnostic.turn_end_reason]) add('回合结束状态', turnEndLabels[diagnostic.turn_end_reason]);
  if (stderrClass) add('标准错误分类线索', stderrClass);
  if (eventClass) add('事件错误分类线索', eventClass);
  if (processError) add('进程错误分类线索', processError);
  if (observerError) add('事件观察错误分类线索', observerError);
  if (Number.isInteger(diagnostic.provider_http_status) && diagnostic.provider_http_status >= 100 && diagnostic.provider_http_status <= 599) add('模型服务 HTTP 状态', diagnostic.provider_http_status);
  for (const [key, labelText] of [['final_seen', '收到最终事件'], ['output_complete', '进程输出完整'], ['exit_observed', '观察到进程退出'], ['close_observed', '观察到进程关闭']]) {
    if (typeof diagnostic[key] === 'boolean') add(labelText, diagnostic[key] ? '是' : '否');
  }
  for (const [key, labelText] of [['dsh_tool_call_events', '自动生成工具调用事件数'], ['dsh_tool_result_events', '自动生成工具结果事件数']]) {
    if (Number.isSafeInteger(diagnostic[key]) && diagnostic[key] >= 0) add(labelText, diagnostic[key]);
  }
  const details = `<details class="backend-process-diagnostic"><summary>有限进程诊断详情（脱敏字段，不代表已证实根因）</summary>${rows.length ? `<dl>${rows.join('')}</dl>` : '<p class="muted">已保存记录没有可展示的白名单诊断字段。</p>'}</details>`;
  return `${clue}${details}`;
}

function backendSelfTestHtml(row, caseSteps) {
  const result = row.result && typeof row.result === 'object' ? row.result : null;
  const steps = Array.isArray(result?.steps) ? result.steps : null;
  const stepHtml = steps === null ? '' : `<section><h4>业务步骤与断言</h4>${steps.map(step => {
    const original = caseSteps.find(item => item.order === step.order);
    const action = step.action ?? original?.action;
    const expected = step.expected ?? original?.expected;
    const requests = Array.isArray(step.requests) ? step.requests : null;
    return `<article class="backend-step"><div class="backend-step-heading"><strong>步骤 ${esc(step.order ?? '未记录')}</strong>${badge(step.status)}</div><dl><dt>原动作</dt><dd>${esc(action ?? '未取得')}</dd><dt>原预期</dt><dd>${esc(expected ?? '未取得')}</dd></dl>${requests === null ? '<p class="muted">请求证据未提供。</p>' : requests.map(request => requestHtml(request, { forceOpen: true })).join('') || '<p>本步骤未发送请求。</p>'}</article>`;
  }).join('')}</section>`;
  const setupHtml = Array.isArray(result?.setup) ? `<section><h4>初始化请求</h4>${result.setup.map(request => requestHtml(request, { forceOpen: true })).join('') || '<p>本次无初始化请求。</p>'}</section>` : '';
  const cleanupHtml = Array.isArray(result?.cleanup) && result.cleanup.length ? `<section><h4>清理请求</h4>${result.cleanup.map(request => requestHtml(request, { forceOpen: true })).join('')}</section>` : '';
  const resultSummary = result ? `<p>执行器结果 ${badge(result.status)}${result.execution_status ? ` · ${esc(label(result.execution_status))}` : ''}${Number.isFinite(result.requests_sent) ? ` · HTTP 请求 ${result.requests_sent}` : ''}</p>` : '';
  const error = row.error ? `<p class="notice danger">${esc(reason(row.error))}</p>` : '';
  const technical = `<details class="backend-self-test-technical"><summary>技术详情（脱敏 JSON 与完整计划哈希）</summary><p>执行计划 SHA-256：<code>${esc(row.execution_sha256 || '未记录')}</code></p>${result ? `<pre>${esc(JSON.stringify(result, null, 2))}</pre>` : '<p class="muted">完整自测结果未记录。</p>'}</details>`;
  return `<details class="backend-self-test"><summary>第 ${esc(row.number ?? '未记录')} 次 · ${esc(label(row.status))} · 计划哈希 ${esc(shortHash(row.execution_sha256))}</summary><p>开始 ${esc(row.started_at || '未记录')} · 结束 ${esc(row.finished_at || '未记录')}</p>${resultSummary}${error}${setupHtml}${stepHtml}${cleanupHtml}${technical}</details>`;
}

export function backendGenerationEvidenceHtml(plan, caseSteps = []) {
  if (!plan || !plan.generation_session || typeof plan.generation_session !== 'object') return '';
  const session = plan.generation_session;
  const tests = Array.isArray(session?.self_tests) ? session.self_tests : null;
  const reviews = Array.isArray(session?.quality_reviews) ? session.quality_reviews : null;
  const validations = Array.isArray(session?.independent_validations) ? session.independent_validations : null;
  const candidate = session?.candidate && typeof session.candidate === 'object' ? session.candidate : null;
  const limits = session?.limits && typeof session.limits === 'object' ? session.limits : {};
  const sessionLabel = session
    ? generationStatusLabels[session.status] || label(session.status)
    : '会话状态未记录';
  const elapsedCap = numberText(limits.wall_ms);
  const elapsedText = elapsedCap === null ? '未记录' : `${Math.round(Number(elapsedCap) / 1000)} 秒`;
  const usageText = value => value == null ? '未提供可靠统计' : esc(text(value));
  const processDiagnosticHtml = backendProcessDiagnosticHtml(session);
  const phaseLabels = { WRITE_DRAFT:'编写测试计划', SELF_TEST:'验证当前计划', QUALITY_REVIEW:'核对用例覆盖与断言',
    INDEPENDENT_VALIDATION:'独立复跑当前计划', SUBMIT_CURRENT_DRAFT:'准备提交当前版本', REPAIR_DRAFT:'根据审查修订',
    INSPECT_SELF_TEST:'分析自测结果', NEEDS_ANALYSIS:'保留问题待分析', FROZEN_FOR_HUMAN_REVIEW:'候选已保存，待人工核对', STOPPED:'会话已停止' };
  const progressHtml = phaseLabels[session.progress?.phase] ? `<p role="status">当前阶段：${esc(phaseLabels[session.progress.phase])}</p>` : '';
  const diagnostic = session.tool_diagnostics;
  const diagnosticHtml = diagnostic && Array.isArray(diagnostic.recent) ? `<details><summary>工具过程：${esc(diagnostic.calls)} 次 · 错误 ${esc(diagnostic.errors)} 次</summary><p>仅记录工具名、阶段和错误类别，不记录参数、密钥或响应正文。</p><ol>${diagnostic.recent.map(row=>`<li>${esc(row.tool)} · ${esc(row.status)}${row.error_code ? ` · ${esc(row.error_code)}` : ''}</li>`).join('')}</ol></details>` : '';
  const sessionHtml = `<section class="backend-generation" aria-label="脚本生成会话"><h3>脚本生成与自测会话</h3>
    <p>${esc(sessionLabel)} · 生成和自测结束后，请核对请求与业务断言。自测会在登记的非生产环境发送实际 HTTP 请求；业务预期保持不变，结束后不会自动重启生成。</p>
    ${progressHtml}${session.error ? `<p class="notice danger">会话原因：${esc(reason(session.error))}</p>` : ''}<details class="backend-generation-advanced"><summary>高级详情：服务诊断与资源记录</summary>${processDiagnosticHtml}${diagnosticHtml}
     <dl><dt>会话预算</dt><dd>模式 ${esc(session?.quality_review_mode || 'static-v1')} · 最长 ${elapsedText} · 工具调用 ${esc(budgetText(session?.tool_calls_used, limits.tool_calls))}（含审查工具 ${esc(session?.reviewer_tool_calls_used ?? 0)}） · 自动生成启动 ${esc(budgetText(session?.harness_starts, limits.harness_starts))} · 审查自动生成启动占额 ${esc(session?.reviewer_harness_starts ?? 0)} · 自测 ${esc(budgetText(tests?.length, limits.self_tests))} · 付费独立质量审查 ${esc(budgetText(reviews?.length, limits.quality_reviews))} · 独立复验 ${esc(budgetText(validations?.length, limits.independent_validations))}</dd>
      <dt>底层模型调用数</dt><dd>${usageText(session?.provider_requests)}</dd><dt>模型用量</dt><dd>${usageText(session?.provider_usage)}</dd>
      <dt>完成时间</dt><dd>${esc(session.finished_at || '未记录')}</dd></dl></details></section>`;
  const testsHtml = tests === null ? Object.hasOwn(session || {}, 'self_tests') ? '<p class="muted">自动生成自测记录未提供。</p>' : '' : `<section class="backend-self-tests"><h3>HTTP 自测记录（${tests.length}）</h3>${tests.map(row => backendSelfTestHtml(row, caseSteps)).join('')}</section>`;
  const reviewsHtml = reviews === null ? '' : `<section class="backend-quality-reviews"><h3>独立质量审查（${reviews.length}）</h3>${reviews.map(row => `<details><summary>第 ${esc(row.number)} 次 · ${esc(row.status)} · 计划 ${esc(shortHash(row.candidate_sha256))} · 自测 ${esc(row.self_test_number ?? '未记录')}</summary><p>审查模式 ${esc(row.mode || session?.quality_review_mode || 'static-v1')} · 审查自动生成启动占额 ${esc(row.reviewer_harness_starts ?? 0)} · 实际启动 ${esc(row.harness_starts ?? '未知')} · 审查工具 ${esc(row.reviewer_tool_calls_used ?? 0)} · 模型调用 ${esc(row.model_calls ?? '未知')} · 用量 ${usageText(row.usage)} · 输入摘要 ${esc(shortHash(row.input_sha256))}</p>${row.error_code ? `<p class="notice warning">审查未能确定：${esc(row.error_code)}</p>` : ''}${Array.isArray(row.steps) ? `<p>逐步审查：${row.steps.map(step => `步骤 ${esc(step.order)} ${esc(step.implementation)}：${esc(step.explanation)}`).join('；') || '未记录'}</p>` : ''}${row.investigation ? `<details><summary>逐项审查及受控工具过程</summary><pre>${esc(JSON.stringify({ investigation: row.investigation, process_diagnostic: row.process_diagnostic || null }, null, 2))}</pre></details>` : ''}${Array.isArray(row.findings) && row.findings.length ? `<ol>${row.findings.map(item => `<li><strong>步骤 ${esc(item.step_order)} · ${esc(item.kind)}</strong> · 原用例 ${esc(item.source?.field || '字段未记录')} · 计划 ${esc(item.location?.pointer || '位置待分析')}<p>原文：“${esc(item.source?.quote || '')}”</p><p>${esc(item.message || '')}</p><p>建议：${esc(item.suggestion || '')}</p></li>`).join('')}</ol>` : '<p>未记录具体缺口；无发现不等于人工确认。</p>'}</details>`).join('')}</section>`;
  const validationsHtml = validations === null ? '' : `<section class="backend-independent-validations"><h3>独立 HTTP 复验（${validations.length}）</h3>${validations.map(row => `<details><summary>第 ${esc(row.number)} 次 · ${esc(row.status)} · 计划 ${esc(shortHash(row.execution_sha256))} · 自测 ${esc(row.self_test_number ?? '未记录')}</summary><p>复验模式 ${esc(row.mode || session?.quality_review_mode || 'static-v1')}</p>${row.error ? `<p class="notice warning">${esc(reason(row.error))}</p>` : ''}${row.result ? `<p>结果 ${esc(row.result.status)} · 请求 ${esc(row.result.requests_sent ?? '未记录')} · 清理 ${esc(row.result.cleanup_status || (row.result.cleanup_error ? '失败' : '未记录'))}</p>` : ''}</details>`).join('')}</section>`;
  const candidateHtml = candidate === null ? Object.hasOwn(session || {}, 'candidate') ? '<p class="muted">自动生成候选状态未提供。</p>' : '' : `<section class="backend-candidate"><h3>待审阅计划</h3><p>${esc(candidateStatusLabels[candidate.status] || label(candidate.status))} · 计划哈希 ${esc(shortHash(candidate.execution_sha256))} · 提交时间 ${esc(candidate.submitted_at || '未记录')}</p><details><summary>候选技术身份</summary><p>执行计划 SHA-256：<code>${esc(candidate.execution_sha256 || '未记录')}</code></p></details><p class="notice warning">脚本生成、自测和提交不会自动确认计划；请逐条核对原业务步骤、预期、请求与断言。自测通过不等于业务验收通过。</p></section>`;
  return `<section class="backend-generation-evidence">${sessionHtml}${testsHtml}${reviewsHtml}${validationsHtml}${candidateHtml}</section>`;
}
// Unsubmitted feedback stays in this page's memory. It is never placed in URLs,
// persisted to browser storage, or sent to the model by navigation.
const revisionContexts = new Map();
const revisionKey = value => JSON.stringify([value.project_id, value.case_id, value.case_version, value.plan_id]);
export function stageBackendRevisionContext(value) {
  if (!value || !['project_id', 'case_id', 'plan_id', 'run_id', 'feedback'].every(key => typeof value[key] === 'string' && value[key].trim()) || !Number.isSafeInteger(value.case_version)) throw Error('后端反馈身份或内容不完整，请重新选择实际失败记录。');
  revisionContexts.set(revisionKey(value), { project_id: value.project_id, case_id: value.case_id, case_version: value.case_version, plan_id: value.plan_id, run_id: value.run_id, feedback: value.feedback });
}
export function pendingBackendRevisions(projectId) {
  return [...revisionContexts.values()].filter(value => value.project_id === projectId).map(value => ({ ...value }));
}
export function backendRevisionContextFor(identity, records) {
  const value = revisionContexts.get(revisionKey(identity));
  if (!value) return null;
  const run = records.find(run => run.run_id === value.run_id && run.project_id === value.project_id && run.executed_case_id === value.case_id && run.executed_case_version === value.case_version && run.source_build_task_id === value.plan_id && (!identity.environment_id || (run.environment_id || run.selection?.environment_id) === identity.environment_id));
  return { ...value, valid: Boolean(run), run: run || null };
}
export function backendRevisionRunBinding(identity, records) {
  const context = backendRevisionContextFor(identity, records);
  if (context && !context.valid) throw Error('原运行与当前计划身份不匹配，请返回执行列表重新选择。');
  return context ? { run_id: context.run_id } : {};
}

function ensureStyles() {
  if (document.querySelector('#backend-styles')) return;
  const link = document.createElement('link'); link.id = 'backend-styles'; link.rel = 'stylesheet'; link.href = '/workspace/backend.css'; document.head.append(link);
}

function requestHtml(request, { forceOpen = false } = {}) {
  const failed = request.status !== 'PASSED';
  const responseReference = request.request?.kind === 'response-reference';
  const requestSummary = responseReference
    ? `复核已存响应 · 来源 ${esc(request.request.source_request_id || '未记录')}`
    : `${esc(request.request?.method || '未发送')} ${esc(request.request?.url || request.request?.path || '路径未采集')}`;
  const detailLabel = responseReference ? '来源与冻结响应' : '脱敏请求与响应';
  return `<details class="backend-request" ${failed || forceOpen ? 'open' : ''}><summary>${esc(request.request_id)} · ${requestSummary} · ${esc(label(request.status))}${request.response ? ` · HTTP ${esc(request.response.status)}` : ''}</summary>
    ${request.error ? `<p class="notice danger">${esc(reason(request.error))}</p>` : ''}
    <p class="muted">开始 ${esc(request.started_at || '未取得')} · 结束 ${esc(request.finished_at || '未结束')}</p>
    ${request.assertions?.length ? `<div class="table-wrap"><table><thead><tr><th>断言</th><th>预期</th><th>实际</th><th>结果</th></tr></thead><tbody>${request.assertions.map(a => `<tr><td>${esc(assertionName(a))} · ${esc(a.op === 'array_some_field_equals' ? `任一记录的字段 ${a.field} 等于` : assertionOpName(a.op))}</td><td><code>${esc(text(a.expected))}</code></td><td><code>${esc(text(a.actual))}</code>${a.actual_exists === false ? '<small>字段不存在</small>' : ''}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">本请求尚无已完成的断言记录。</p>'}
    <details><summary>${detailLabel}</summary><pre>${esc(JSON.stringify({ request: request.request, response: request.response }, null, 2))}</pre></details></details>`;
}

export function backendRunHtml(run) {
  const evidence = run.http_evidence || run;
  const cleanup = evidence.cleanup || [];
  const setup = evidence.setup || [];
  const steps = evidence.steps || [];
  const readOnlyNoCleanup = run.environment_binding?.mode === 'http-json-readonly' && setup.length === 0 && cleanup.length === 0;
  const cleanupStatus = cleanup.length ? cleanup.every(row => row.status === 'PASSED') ? '已执行，清理断言通过' : '清理未通过，请处理本次命名空间' : readOnlyNoCleanup ? '只读 GET 环境未配置初始化或清理请求，无需单独清理；结果仍按业务步骤和断言判断' : ['RUNNING', 'QUEUED', 'STOPPING'].includes(run.execution_status) ? '等待执行清理' : '未取得清理记录，不能视为清理成功';
  return `<article class="backend-evidence" data-run-id="${esc(run.run_id)}"><div class="panel-header"><div><h3>${esc(run.executed_external_id || run.external_id)} · HTTP/JSON 执行结果</h3><p>用例 v${esc(run.executed_case_version || run.case_version)} · 计划 P${esc(run.script_version || run.candidate_version)}</p></div>${badge(run.status)}</div>
    <p>开始 ${esc(run.started_at || '未取得')} · 结束 ${esc(run.finished_at || '执行中')} · 软件版本 ${esc(run.software_version || '未提供')}</p>
    ${run.technical_error ? `<p class="notice danger">${esc(reason(run.technical_error))}</p>` : ''}
    ${run.cleanup_error ? `<p class="notice danger">${esc(reason(run.cleanup_error))} · 命名空间 ${esc(run.cleanup_error.namespace_id)}</p>` : ''}
    <p class="notice">结果依据本次真实 HTTP 请求、业务字段断言和独立查询。此执行器不采集浏览器录像；计划确认不代表产品验收通过。</p>
    <details><summary>运行身份与版本</summary><pre>${esc(JSON.stringify({ model_calls: run.model_calls, run_id: run.run_id, namespace_id: run.namespace_id, case_id: run.executed_case_id || run.case_id, case_version: run.executed_case_version || run.case_version, plan_id: run.source_build_task_id, execution_sha256: run.execution_sha256 || run.bundle_sha256, environment_id: run.environment_id || run.selection?.environment_id, binding_version: run.binding_version, protocol_sha256: run.protocol_sha256 }, null, 2))}</pre></details>
    <section><h4>初始化</h4>${(evidence.setup || []).map(requestHtml).join('') || '<p>尚无初始化请求记录。</p>'}</section>
    <section><h4>业务步骤与断言</h4>${steps.map(step => `<article class="backend-step"><div class="backend-step-heading"><strong>步骤 ${esc(step.order)}</strong>${badge(step.status)}</div><dl><dt>原动作</dt><dd>${esc(step.action)}</dd><dt>原预期</dt><dd>${esc(step.expected)}</dd></dl>${(step.requests || []).map(requestHtml).join('') || '<p>本步骤未发送请求。</p>'}</article>`).join('') || '<p>尚无业务步骤记录。</p>'}</section>
    <section><h4>本次数据清理</h4><p class="notice ${cleanup.length && cleanup.every(row => row.status === 'PASSED') ? '' : 'warning'}">${esc(cleanupStatus)}</p>${cleanup.map(requestHtml).join('')}</section></article>`;
}

function caseContentHtml(version, onEdit) {
  const c = version.content;
  return `<section class="panel"><div class="panel-header"><h2>已确认业务用例</h2>${onEdit ? `<button class="button" id="backend-edit-case">${c.requirements_origin?'创建用例修订稿':'编辑当前用例版本'}</button>` : '<span>历史用例只读</span>'}</div><div class="panel-body"><p>内容状态：${esc(c.status === "CONFIRMED" ? "内容已确认" : c.status === "PENDING_CONFIRMATION" ? "内容待确认" : "状态待核对")}</p><h3>前置条件</h3><p class="preserve-text">${esc(c.preconditions || '未填写')}</p><h3>测试数据</h3><p class="preserve-text">${esc(c.test_data || '未填写')}</p>${c.steps.map(step => `<article class="step-pair"><strong>${esc(step.order)}</strong><div><small>动作</small><p>${esc(step.action)}</p></div><div><small>原预期</small><p>${esc(step.expected)}</p></div></article>`).join('')}</div></section>`;
}

const planValue = value => value === undefined ? '未填写' : JSON.stringify(value);
const assertionName = assertion => assertion.target === 'status' ? 'HTTP 状态' : assertion.target === 'header' ? '响应 Content-Type' : `响应 JSON ${assertion.pointer === '' ? '根对象' : assertion.pointer || '路径未填'}`;
const assertionOpName = op => op === 'media_type_equals' ? '媒体类型等于' : op || '操作未填';
function planRequestHtml(request, purpose) {
  const reference = typeof request.response_ref === 'string';
  const assertions = Array.isArray(request.assertions) ? request.assertions : [];
  const query = !reference && typeof request.path === 'string' ? request.path.split('?')[1] : null;
  return `<article class="backend-plan-request"><h5>${reference ? `复核已取得响应 · ${esc(request.response_ref)}` : `${esc(request.method || '方法未填')} ${esc(request.path || '路径未填')}`}</h5><p class="muted">用途：${esc(purpose)}</p>${query ? `<p>查询参数：<code>${esc(query)}</code></p>` : ''}${Object.hasOwn(request, 'json') ? `<p>请求 JSON 参数：<code>${esc(planValue(request.json))}</code></p>` : ''}<div class="backend-plan-assertions"><strong>断言 ${assertions.length} 项</strong>${assertions.length ? `<ul>${assertions.map(assertion => `<li>${esc(assertionName(assertion))} · ${esc(assertionOpName(assertion.op))}${assertion.field ? `（字段 ${esc(assertion.field)}）` : ''} · ${assertion.expected_from ? `基线来自 ${esc(assertion.expected_from.request_id || '请求未填')} 的 JSON ${esc(assertion.expected_from.pointer === '' ? '根对象' : assertion.expected_from.pointer || '路径未填')}` : `预期 ${esc(planValue(assertion.value))}`}</li>`).join('')}</ul>` : '<p class="notice warning">尚无断言。</p>'}</div></article>`;
}

export function backendPlanSummaryHtml(execution, caseSteps = [], plan = null) {
  if (!execution || typeof execution !== 'object' || !Array.isArray(execution.steps)) return '<p class="notice warning">当前计划结构无法预览；请检查技术详情中的 JSON。</p>';
  const setup = Array.isArray(execution.setup) ? execution.setup : [];
  const cleanup = Array.isArray(execution.cleanup) ? execution.cleanup : [];
  const requestCount = setup.length + cleanup.length + execution.steps.reduce((count, step) => count + (Array.isArray(step.requests) ? step.requests.length : 0), 0);
  const state = plan?.state === 'CONFIRMED' ? `技术计划已由 ${esc(plan.reviewer || '核对人未记录')} 确认并冻结；仍需依据真实运行结果做产品验收。` : '技术计划待人工逐项确认；生成或自测结果不代表产品验收。';
  return `<div class="backend-plan-summary" aria-label="执行计划可读审阅"><p class="notice">${state}</p><div class="backend-plan-facts"><p><strong>执行范围</strong> 环境 ${esc(execution.environment_name || execution.environment_id || '未填写')} · ${requestCount} 项请求或响应复核</p><p><strong>超时预算</strong> 单请求 ${esc(execution.request_timeout_ms ?? 10000)} ms · 整体 ${esc(execution.timeout_ms ?? 120000)} ms</p><p><strong>初始化与清理</strong> ${setup.length} 项初始化、${cleanup.length} 项清理。${!setup.length && !cleanup.length ? '只读环境无本次数据初始化与清理。' : '请核对清理仅针对本次数据。'}</p></div>${setup.length ? `<section><h3>初始化</h3>${setup.map(request => planRequestHtml(request, '准备本次测试数据')).join('')}</section>` : ''}<section><h3>逐步请求与业务断言</h3>${execution.steps.map((step, index) => { const original = caseSteps.find(row => row.order === step.order) || caseSteps[index] || {}; const requests = Array.isArray(step.requests) ? step.requests : []; return `<article class="backend-plan-step"><h4>步骤 ${esc(step.order ?? index + 1)}</h4><p><strong>原动作：</strong>${esc(original.action || '未取得')}</p><p><strong>原预期：</strong>${esc(original.expected || '未取得')}</p>${requests.map(request => planRequestHtml(request, original.action || '核验本步骤')).join('') || '<p class="notice warning">尚无请求。</p>'}</article>`; }).join('')}</section>${cleanup.length ? `<section><h3>清理本次数据</h3>${cleanup.map(request => planRequestHtml(request, '清理本次测试数据')).join('')}</section>` : ''}</div>`;
}

export async function renderBackendCase({ project, item, version, query, showPage, go, toast, api, launchBatch, onEdit, onDirty = () => {} }) {
  ensureStyles();
  const expectedHash = location.hash;
  const active = () => location.hash === expectedHash;
  const pid = encodeURIComponent(project.project_id), cid = encodeURIComponent(item.case_id);
  const endpoint = `/api/case-library/projects/${pid}/backend`;
  const base = `#/projects/${pid}/cases/${cid}`;
  const bindingLink = `#/projects/${pid}/bindings?case_id=${cid}&version=${version.version}`;
  const [{ environments, plans, model_available, generation_limits }, automation, bindingData, runData, batchData] = await Promise.all([
    api(`${endpoint}?case_id=${cid}`), api(`/api/case-library/projects/${pid}/cases/${cid}/automation?version=${version.version}`),
    api(`/api/case-library/projects/${pid}/requirements/bindings?case_id=${cid}`), api(`/api/case-library/projects/${pid}/execution-records`), api(`/api/case-library/projects/${pid}/batches`),
  ]);
  const projectEnvironment = await api(`/api/case-library/projects/${pid}/environment`);
  const currentBackendId = projectEnvironment.backend_environment_id;
  const currentBackend = projectEnvironment.backend;
  const allBackendOptions = projectEnvironment.backend_options || [];
  if (!active()) return;
  const generationBudget = generationBudgetSummary(generation_limits);
  const canStartGeneration = model_available === true && generationBudget !== null;
  const generationBudgetHtml = generationBudget
    ? `<p class="muted wide">服务资源记录：${esc(generationBudget)}。会内可以检查结果并在不改变原用例预期的前提下修订、复测；会话结束后不会自动重启。</p>`
    : '<p class="muted wide">服务未提供完整生成限额，自动生成暂不可用。</p>';
  const reviewModeHtml = '<label class="field wide"><span>独立质量审查模式（本次计划冻结）</span><select name="quality_review_mode"><option value="static-v1">基础审查</option><option value="dsh-tools-v1">独立工具审查（实验）</option></select></label>';
  const records = (runData.records || []).filter(run => run.executed_case_id === item.case_id && run.executed_case_version === version.version).sort((a,b) => String(b.started_at).localeCompare(String(a.started_at)));
  const candidates = automation.candidates.filter(c => c.applies_to_selected_version);
  const selectedId = query.get('plan_id') || query.get('script_task');
  const selected = selectedId ? plans.find(plan => plan.plan_id === selectedId && plan.case_version === version.version) : plans.find(plan => plan.case_version === version.version);
  const revisionContext = selected ? backendRevisionContextFor({ project_id: project.project_id, case_id: item.case_id, case_version: version.version, plan_id: selected.plan_id, environment_id: selected.environment_id }, records) : null;
  const chosen = selected && candidates.find(c => c.source_task_id === selected.plan_id);
  const selectedCandidate = selected?.generation_session?.candidate;
  const selectedReview = selected?.generation_session?.quality_reviews?.find(row => row.number === selectedCandidate?.quality_review_number);
  const selectedValidation = selected?.generation_session?.independent_validations?.find(row => row.number === selectedCandidate?.independent_validation_number);
  const selectedQualityReady = selected?.quality_policy !== 'required-v1' && selected?.generation_session?.quality_policy !== 'required-v1' || (
    selected?.quality_policy === 'required-v1' && selected?.generation_session?.quality_policy === 'required-v1' &&
    selectedCandidate?.quality_policy === 'required-v1' && selectedReview?.status === 'NO_FINDINGS' &&
    selectedReview.candidate_sha256 === selectedCandidate.execution_sha256 && selectedReview.self_test_number === selectedCandidate.self_test_number &&
    selectedValidation?.execution_sha256 === selectedCandidate.execution_sha256 && selectedValidation.self_test_number === selectedCandidate.self_test_number &&
    selectedValidation.status === (selectedCandidate.status === 'READY' ? 'PASSED' : 'FAILED'));
  const dshCandidateReviewable = !selected?.generation_session || (
    selected.state === 'DRAFT'
    && selected.generation_session.status === 'COMPLETED'
    && ['READY', 'BUSINESS_DIFFERENCE'].includes(selected.generation_session.candidate?.status)
    && selectedQualityReady
  );
  const reasonText = chosen?.reason ? reason(chosen.reason) : !selected ? '先创建并确认此版本的 HTTP 计划' : selected.state !== 'CONFIRMED' ? '先审阅确认 HTTP 计划' : null;
  const bindings = (bindingData.bindings || []).filter(binding => binding.case_version === version.version && binding.case_content_sha256 === version.content_sha256 && binding.status === 'COMPLETE' && binding.confirmation_status === 'CONFIRMED' && binding.applicability !== 'STALE_CASE_VERSION');
  const current = version.version === item.current_version && version.content.status === 'CONFIRMED';
  const eligible = current && bindings.length > 0 && Boolean(currentBackendId);
  const tab = query.get('tab') || (records.length || query.has('batch_id') || query.has('run_id') ? 'results' : 'content');
  if (!['content', 'scripts', 'results', 'history'].includes(tab)) throw Error('用例页签无效');
  const link = (target, extras = {}) => { const q = new URLSearchParams(query); q.set('version', version.version); q.set('tab', target); for (const [key, value] of Object.entries(extras)) value == null ? q.delete(key) : q.set(key, value); return `${base}?${q}`; };
  const fromAutomation = query.get('return') === `#/projects/${pid}/automation`;
  const back = fromAutomation || query.get('return')?.startsWith(`#/projects/${project.project_id}/cases`) ? query.get('return') : `#/projects/${pid}/cases`;
  let dirty = false;
  const refresh = async () => { onDirty(false); await renderBackendCase({ project, item, version, query: new URLSearchParams(location.hash.split('?')[1] || ''), showPage, go, toast, api, launchBatch, onEdit, onDirty }); };
  const operation = async action => {
    const buttons = [...document.querySelectorAll('.backend-case button')]; const previous = buttons.map(button => button.disabled); buttons.forEach(button => { button.disabled = true; });
    try { await action(); } catch (error) { toast(error instanceof SyntaxError ? 'JSON 格式无效，修改内容仍保留，请修正后重试。' : reason(error), 'error'); }
    finally { if (active()) buttons.forEach((button, index) => { if (button.isConnected) button.disabled = previous[index]; }); }
  };
  const planRows = plans.map(plan => `<tr><td><a data-nav href="${base}?version=${plan.case_version}&tab=scripts&plan_id=${encodeURIComponent(plan.plan_id)}">P${plan.version}</a></td><td>用例 v${plan.case_version} · 绑定 v${plan.binding_version}</td><td>${badge(plan.state)}</td><td>${esc(allBackendOptions.find(env => env.environment_id === plan.environment_id)?.name || plan.environment_id)}</td><td>${esc(plan.reviewer || '待核对')}<small>${esc(plan.confirmed_at || plan.created_at)}</small></td></tr>`).join('');
  const environmentHtml = `<details class="panel backend-environments"><summary>HTTP \u73af\u5883\u4fe1\u606f</summary><div class="panel-body"><p>HTTP \u73af\u5883\u53ea\u80fd\u5728\u9879\u76ee\u6d4b\u8bd5\u73af\u5883\u8bbe\u7f6e\u4e2d\u7ed1\u5b9a\u3002</p><p>\u5f53\u524d\u9879\u76ee HTTP \u73af\u5883\uff1a${currentBackend ? `${esc(currentBackend.name)} · ${esc(currentBackend.base_url)}` : `<a data-nav href="#/projects/${pid}/auth">\u672a\u914d\u7f6e\uff0c\u53bb\u9879\u76ee\u6d4b\u8bd5\u73af\u5883\u8bbe\u7f6e</a>`}</p><p class="muted">\u666e\u901a HTTP \u4ec5 GET\uff0c\u5408\u6210 namespace \u6309\u9694\u79bb\u534f\u8bae\u6267\u884c\u3002</p></div></details>`;
  const reworkHtml = selected && selected.state !== 'GENERATING' && current ? `<details class="backend-rework"><summary>修订或重新生成计划（旧版本保留）</summary><form id="backend-rework-form" class="form-grid"><p class="wide">Agent 会依据已确认用例与协议生成、自测；问题修订还会读取选定旧计划。候选仍需人工核对，原用例预期不变。</p><input type="hidden" name="environment_id" value="${esc(currentBackendId||'')}"><p class="notice wide">固定项目环境：${currentBackend ? `${esc(currentBackend.name)} · ${esc(currentBackend.base_url)}` : `<a data-nav href="#/projects/${pid}/auth">未配置，去项目测试环境设置</a>`}</p><label class="field"><span>协议绑定版本</span><select name="binding_version" required>${bindings.map(binding => `<option value="${binding.version}" ${binding.version === selected.binding_version ? 'selected' : ''}>绑定 v${binding.version}</option>`).join('')}</select></label><label class="field wide"><span>问题反馈（修订时必填）</span><textarea name="feedback" rows="3" maxlength="3000" placeholder="描述真实失败、缺少的断言或技术映射问题；不修改原用例预期。"></textarea></label><details class="backend-advanced wide"><summary>高级设置：审查模式与服务资源</summary>${generationBudgetHtml}${reviewModeHtml}<label class="backend-check"><input name="skill_profile" type="checkbox">使用测试编写规范（实验）</label></details><p class="muted wide">点击生成或修订后，会在当前登记的非生产环境发送实际 HTTP 请求；完成后仍需逐条核对计划。</p><div class="actions wide"><button class="button" type="submit" value="revise" ${eligible && canStartGeneration ? '' : 'disabled'}>修订并自测</button><button class="button" type="submit" value="regenerate" ${eligible && canStartGeneration ? '' : 'disabled'}>从头生成并自测</button></div></form></details>` : '';
  const executionForView = execution => ({ ...execution, environment_name: allBackendOptions.find(env => env.environment_id === execution.environment_id)?.name || execution.environment_id });
  const selectedExecutionForView = selected?.execution ? executionForView(selected.execution) : null;
  const editorHtml = selected ? `<section class="panel"><div class="panel-header"><h2>计划 P${selected.version} · ${esc(label(selected.state))}</h2><span>用例 v${selected.case_version} / 绑定 v${selected.binding_version}</span></div><div class="panel-body">${selected.error ? `<p class="notice danger">${esc(reason(selected.error))}</p>` : ''}${backendGenerationEvidenceHtml(selected, version.content.steps)}${selected.state === 'GENERATING' ? '<p role="status">脚本生成与自测会话进行中；请等待完成后逐条核对计划。</p><button class="button" id="backend-cancel-generation">取消本次生成会话</button>' : `<p>${selected.state === 'CONFIRMED' ? `已由 ${esc(selected.reviewer)} 确认并冻结。需要变更时复制为新版本，历史版本保留。` : '逐步核对请求、原业务预期、独立观察及清理范围。JSON 修改在确认时一并保存；确认失败保留输入。'}</p><div id="backend-plan-summary">${backendPlanSummaryHtml(selectedExecutionForView || { environment_id: selected.environment_id, steps: version.content.steps.map(step => ({ order: step.order, requests: [] })) }, version.content.steps, selected)}</div><details class="backend-plan-technical"><summary>技术详情与 JSON 编辑（确认时保存）</summary><p class="muted">可在此修改计划；上方卡片会同步预览尚未保存的内容。确认时仍由服务端校验版本与范围。</p><label class="field"><span>HTTP 执行计划 JSON</span><textarea id="backend-plan-json" class="backend-plan-json" rows="22" spellcheck="false" ${selected.state === 'CONFIRMED' || !current ? 'readonly' : ''}>${esc(JSON.stringify(selected.execution || { schema: 'workbench/backend-execution-v1', environment_id: selected.environment_id, setup: [], steps: version.content.steps.map(step => ({ order: step.order, requests: [] })), cleanup: [] }, null, 2))}</textarea></label></details>${selected.state === 'CONFIRMED' ? `<button class="button" id="backend-copy-plan" ${current ? '' : 'disabled'}>复制为新计划版本（不调用模型）</button>` : current && dshCandidateReviewable ? '<label class="field"><span>计划核对人</span><input id="backend-reviewer" maxlength="100"></label><label class="backend-check"><input type="checkbox" id="backend-reviewed">我已逐步核对原业务预期、请求、断言与本次清理范围</label><button class="button primary" id="backend-confirm-plan">确认并冻结此计划</button>' : current ? '<p class="notice warning">此自动生成会话尚无可审阅候选，不能确认。请基于问题反馈重新启动脚本生成与自测，或创建空白人工计划（不调用模型）后逐步核对。</p>' : '<p class="notice">历史用例版本不可确认新计划。</p>'}`}
    ${reworkHtml}<details><summary>模型调用与不可变身份</summary><pre>${esc(JSON.stringify({ plan_id: selected.plan_id, revision: selected.revision, request_mode: selected.request_mode, source_plan_id: selected.source_plan_id, content_sha256: selected.content_sha256, protocol_sha256: selected.protocol_sha256, execution_sha256: selected.execution_sha256, model_requests: selected.model_requests }, null, 2))}</pre></details>${selected.rejected_execution ? `<details><summary>未通过格式校验的模型候选（不可执行）</summary><p class="notice warning">以下内容仅供排查格式错误，没有填入执行计划，也不能直接运行。</p><pre>${esc(JSON.stringify(selected.rejected_execution, null, 2))}</pre></details>` : ''}</div></section>` : '<p class="notice">当前版本尚无选定计划。创建草稿后，根据协议填写请求、业务断言和清理步骤。</p>';
  const readinessHtml = `<section class="panel backend-readiness"><div class="panel-header"><h2>从协议到可执行计划</h2></div><div class="panel-body"><p>上传协议只提供参考内容，仍需将当前用例版本的步骤与具体接口逐项绑定，使用项目当前 HTTP 环境，审阅并确认执行计划。计划确认仅允许受控执行，不代表产品验收。</p><ol><li>${current ? '已具备' : '待完成'}：当前后端用例内容已确认</li><li>${bindings.length ? '已具备' : '待完成'}：<a data-nav href="${bindingLink}">当前版本完整且已确认的协议绑定</a></li><li>${environments.length ? '已具备' : '待完成'}：项目 HTTP 环境及允许路径已绑定</li><li>${selected?.state === 'CONFIRMED' && chosen && !reasonText ? '已具备' : '待完成'}：逐项核对请求、基线、断言与清理，并确认计划${selected?.state === 'CONFIRMED' && !chosen ? '（当前计划未进入可执行候选，请检查版本或绑定）' : ''}</li></ol>${reasonText ? `<p class="notice warning">当前不能运行：${esc(reasonText)}</p>` : '<p class="notice">当前计划可从原测试批次运行；运行后仍须核对实际业务结果。</p>'}</div></section>`;
  const pending = pendingBackendRevisions(project.project_id);
  const pendingHtml = pending.length ? `<section class="notice" aria-label="待处理后端失败反馈"><strong>已载入 ${pending.length} 条后端原运行反馈</strong><p>逐条审阅原证据后启动修订，尚未自动调用模型；刷新或关闭页面会清除此待办，请从原执行列表重新选择。每项提交后从待办移除。</p>${pending.map(row => `<p><a data-nav href="#/projects/${pid}/cases/${encodeURIComponent(row.case_id)}?version=${row.case_version}&tab=scripts&plan_id=${encodeURIComponent(row.plan_id)}">用例 v${row.case_version} · ${esc(row.run_id)}</a></p>`).join('')}</section>` : '';
  const scriptsHtml = `${pendingHtml}${readinessHtml}${environmentHtml}<section class="panel"><div class="panel-header"><h2>准备 HTTP 执行计划</h2><a class="button" data-nav href="#/projects/${pid}/auth">环境设置</a><a class="button" data-nav href="${bindingLink}">协议绑定</a></div><div class="panel-body">${!currentBackendId ? '<p class="notice warning">项目尚未配置 HTTP 环境；请先到项目测试环境设置。</p>' : !current ? '<p class="notice warning">仅当前已确认用例版本可创建计划。</p>' : !bindings.length ? '<p class="notice warning">当前版本缺少完整、已确认的协议绑定；先补齐绑定。</p>' : ''}<form id="backend-create-form" class="form-grid"><input type="hidden" name="environment_id" value="${esc(currentBackendId||'')}"><p class="notice wide">固定项目环境：${currentBackend ? `${esc(currentBackend.name)} · ${esc(currentBackend.base_url)}` : `未配置，请前往 <a data-nav href="#/projects/${pid}/auth">项目测试环境设置</a>`}</p><label class="field"><span>协议绑定</span><select name="binding_version" required>${bindings.map(binding => `<option value="${binding.version}">绑定 v${binding.version}</option>`).join('')}</select></label><details class="backend-advanced wide"><summary>高级设置：审查模式与服务资源</summary>${generationBudgetHtml}${reviewModeHtml}<label class="backend-check"><input name="skill_profile" type="checkbox">使用测试编写规范（实验）</label></details><p class="muted wide">点击生成或修订后，会在当前登记的非生产环境发送实际 HTTP 请求；完成后仍需逐条核对计划。</p><div class="actions wide"><button class="button primary" type="submit" value="model" ${eligible && canStartGeneration ? '' : 'disabled'}>Agent 生成并自测</button><details class="backend-manual wide"><summary>手工填写计划</summary><p>创建空白计划，不调用模型。之后需填写请求与断言并单独确认。</p><button class="button" type="submit" value="manual" ${eligible ? '' : 'disabled'}>创建空白计划</button></details></div>${!canStartGeneration ? '<p class="muted wide">自动生成暂不可用；请联系工作台管理员检查生成服务，或展开“手工填写计划”。</p>' : ''}</form></div></section>${selectedId && !selected ? '<p class="notice danger">指定计划不存在或不属于此用例版本，没有替换为其他计划。</p>' : editorHtml}<section class="panel"><div class="panel-header"><h2>计划版本历史</h2></div><div class="panel-body"><div class="table-wrap"><table><thead><tr><th>计划</th><th>绑定范围</th><th>状态</th><th>环境</th><th>核对与时间</th></tr></thead><tbody>${planRows || '<tr><td colspan="5">尚无计划</td></tr>'}</tbody></table></div></div></section>`;
  const batches = (batchData.batches || []).filter(batch => batch.state !== 'PREVIEW' && batch.items.some(row => row.case_id === item.case_id && row.case_version === version.version));
  const batchId = query.get('batch_id'), requestedRun = query.get('run_id');
  const batch = batchId ? batches.find(row => row.batch_id === batchId) : null;
  const scopedRuns = batchId ? records.filter(run => run.batch_id === batchId) : records;
  const run = requestedRun ? scopedRuns.find(row => row.run_id === requestedRun) : scopedRuns[0];
  const resultsHtml = `<section class="panel"><div class="panel-header"><h2>本版本结果与 HTTP 证据</h2><button class="button" id="backend-refresh">刷新结果</button></div><div class="panel-body"><label class="field"><span>测试批次</span><select id="backend-batch-select"><option value="">全部历史（每次独立）</option>${batches.map(row => `<option value="${esc(row.batch_id)}" ${batchId === row.batch_id ? 'selected' : ''}>${esc(row.created_at)} · ${esc(row.software_version || '软件版本未提供')} · ${esc(label(row.state))}</option>`).join('')}</select></label><label class="field"><span>具体运行</span><select id="backend-run-select"><option value="">当前范围最近一次</option>${scopedRuns.map(row => `<option value="${esc(row.run_id)}" ${run?.run_id === row.run_id ? 'selected' : ''}>${esc(row.started_at)} · ${esc(label(row.status))} · P${esc(row.script_version || row.candidate_version)}</option>`).join('')}</select></label>${batchId && !batch ? '<p class="notice danger">指定批次不存在或不属于此用例版本，没有替换其他批次。</p>' : requestedRun && !run ? '<p class="notice danger">指定运行不存在或不属于当前版本和批次。</p>' : run ? backendRunHtml(run) : '<p>当前版本 / 批次尚无运行结果，不借用其他版本的结果。</p>'}${batch ? `<p><a data-nav href="#/projects/${pid}/batches?batch_id=${encodeURIComponent(batch.batch_id)}">查看完整批次</a></p>${['RUNNING', 'QUEUED', 'STOPPING'].includes(batch.state) ? '<button class="button" id="backend-cancel-batch">取消本批运行并清理本次数据</button>' : ''}` : ''}</div></section>`;
  const historyHtml = `<section class="panel"><div class="panel-header"><h2>本用例 v${version.version} 历史结果</h2></div><div class="panel-body">${records.map(run => `<article class="history-row"><a data-nav href="${link('results', { run_id: run.run_id, batch_id: run.batch_id || null })}">${esc(run.started_at)} · ${esc(label(run.status))}</a><span>HTTP 计划 P${esc(run.script_version || run.candidate_version)}</span><span>${esc(run.software_version || '软件版本未提供')}</span></article>`).join('') || '<p>此用例版本尚无历史结果。</p>'}</div></section>`;
  showPage(`<section class="backend-case"><div class="page-heading case-heading"><div><a data-nav href="${esc(back)}">← ${fromAutomation ? '返回自动化准备' : '返回用例库'}</a><h1>${esc(version.content.external_id)} · ${esc(version.content.title)}</h1><p>后端 HTTP/JSON · ${esc(version.content.module || '未填写模块')} · 用例 v${version.version}</p></div><div class="actions"><button class="button primary" id="run-backend-case" ${chosen && !reasonText ? '' : 'disabled'}>运行此用例</button><a class="button" data-nav href="${link('scripts')}">管理 HTTP 计划</a><button class="button" id="backend-report" ${run ? '' : 'disabled'}>导出本次运行报告</button></div></div><div class="case-context"><label>用例版本 <select id="backend-case-version">${[...item.versions].reverse().map(v => `<option value="${v.version}" ${v.version === version.version ? 'selected' : ''}>v${v.version}${v.version === item.current_version ? ' · 当前' : ' · 历史只读'}</option>`).join('')}</select></label><label>执行计划 <select id="backend-plan-select"><option value="">当前版本最近计划</option>${plans.filter(plan => plan.case_version === version.version).map(plan => `<option value="${esc(plan.plan_id)}" ${plan.plan_id === selected?.plan_id ? 'selected' : ''}>P${plan.version} · ${esc(label(plan.state))}</option>`).join('')}</select></label><a data-nav href="${bindingLink}">协议绑定</a></div>${reasonText ? `<p class="notice warning">${esc(reasonText)}</p>` : '<p class="notice">当前计划已确认，可通过原测试批次执行。执行不调用模型；测试结果仍需按业务证据验收。</p>'}<nav class="case-tabs" aria-label="用例详情页签">${[['results','结果与证据'],['content','用例内容'],['scripts','HTTP 执行计划'],['history','历史结果']].map(([key, value]) => `<a data-nav href="${link(key)}" ${tab === key ? 'aria-current="page" class="active"' : ''}>${value}</a>`).join('')}</nav>${tab === 'content' ? caseContentHtml(version, current && onEdit) : tab === 'scripts' ? scriptsHtml : tab === 'history' ? historyHtml : resultsHtml}</section>`);
  if (!active()) return;
  const root = document.querySelector('.backend-case');
  if(tab==='results' && run && ['FAILED','TIMEDOUT','TIMED_OUT','CANCELLED','INTERRUPTED','ERROR'].includes(run.status)){
    root.insertAdjacentHTML('beforeend',executionNotesHtml());
    void mountExecutionNotes({root:root.querySelector('.execution-notes'),projectId:project.project_id,runId:run.run_id,api,jsonOptions:json});
  }
  if (revisionContext?.valid && root.querySelector('#backend-rework-form')) {
    const form = root.querySelector('#backend-rework-form');
    form.querySelector('[name="feedback"]').value = revisionContext.feedback;
    form.insertAdjacentHTML('afterbegin', `<div class="notice wide">原运行 <a data-nav href="#/projects/${pid}/execution-records?run_id=${encodeURIComponent(revisionContext.run_id)}">${esc(revisionContext.run_id)}</a> · 用例 v${esc(version.version)} · 原计划 P${esc(selected.version)} · 原结果 ${esc(label(revisionContext.run.status))}。${failureFeedbackHtml(revisionContext.run)}<p>已绑定原运行和原反馈；请只补充实际观察，原用例预期不随反馈自动更改。</p></div>`);
    form.closest('details').open = true;
    dirty = true; onDirty(true);
  } else if (revisionContext && !revisionContext.valid) {
    root.querySelector('.case-context').insertAdjacentHTML('afterend', '<p class="notice danger">原反馈的运行记录与当前计划不匹配，未填入或发送；请返回执行列表重新选择。</p>');
  }
  root.querySelector('#backend-case-version').onchange = event => go(`${base}?version=${event.target.value}&tab=${tab}`);
  root.querySelector('#backend-plan-select').onchange = event => go(link(tab, { plan_id: event.target.value || null, script_task: null, candidate: null }));
  root.querySelector('#run-backend-case').onclick = () => launchBatch(project, 'single', [item.case_id], chosen ? [chosen.selection] : [], { case_id: item.case_id, case_version: version.version });
  root.querySelector('#backend-report').onclick = () => run && go(`#/projects/${pid}/reports?run_id=${encodeURIComponent(run.run_id)}`);
  root.querySelector('#backend-edit-case')?.addEventListener('click', () => onEdit?.());
  root.querySelector('#backend-refresh')?.addEventListener('click', () => void refresh());
  root.querySelector('#backend-batch-select')?.addEventListener('change', event => go(link('results', { batch_id: event.target.value || null, run_id: null })));
  root.querySelector('#backend-run-select')?.addEventListener('change', event => go(link('results', { run_id: event.target.value || null })));
  root.querySelector('#backend-cancel-batch')?.addEventListener('click', () => void operation(async () => { await api(`/api/case-library/projects/${pid}/batches/${encodeURIComponent(batch.batch_id)}/cancel`, json({})); await refresh(); }));
  root.querySelector('#backend-cancel-generation')?.addEventListener('click', () => void operation(async () => { await api(`${endpoint}/plans/${selected.plan_id}/cancel`, json({})); await refresh(); }));
  const selectCreated = plan => { dirty = false; onDirty(false); go(link('scripts', { plan_id: plan.plan_id, script_task: null, candidate: null })); };
  root.querySelector('#backend-create-form')?.addEventListener('submit', event => {
    event.preventDefault(); const form = new FormData(event.currentTarget), generate = event.submitter?.value === 'model';
    void operation(async () => {
      if (generate && !canStartGeneration) throw Error('自动生成服务暂不可用，本次未启动；请联系工作台管理员检查服务，或创建空白计划手工填写。');
      const plan = await api(`${endpoint}/plans`, json({ case_id: item.case_id, case_version: version.version, binding_version: Number(form.get('binding_version')), environment_id: form.get('environment_id'), request_mode: 'generate', generate, allow_model: generate, quality_review_mode: form.get('quality_review_mode'), skill_profile: generate && form.has('skill_profile') ? 'test-authoring-v1' : 'off' }));
      selectCreated(plan);
    });
  });
  root.addEventListener('input', event => {
    if (!event.target.readOnly && (event.target.closest('form') || event.target.id === 'backend-reviewer')) { dirty = true; onDirty(true); }
  });
  root.querySelector('#backend-rework-form')?.addEventListener('submit', event => {
    event.preventDefault(); const form = new FormData(event.currentTarget), request_mode = event.submitter?.value, feedback = String(form.get('feedback') || '').trim();
    void operation(async () => {
      if (!canStartGeneration) throw Error('自动生成服务暂不可用，本次未启动；请联系工作台管理员检查服务，或创建空白计划手工填写。');
      if (!['revise', 'regenerate'].includes(request_mode)) throw Error('请选择修订或重新生成操作。');
      if (request_mode === 'revise' && !feedback) throw Error('基于问题修订需要填写真实问题反馈。');
      if (request_mode === 'revise' && feedback.length > 3000) throw Error('问题反馈最多 3000 字；原输入仍保留，请缩短后再提交。');
      const runBinding = request_mode === 'revise' ? backendRevisionRunBinding({ project_id: project.project_id, case_id: item.case_id, case_version: version.version, plan_id: selected.plan_id, environment_id: form.get('environment_id') }, records) : {};
      const plan = await api(`${endpoint}/plans`, json({ case_id: item.case_id, case_version: version.version, binding_version: Number(form.get('binding_version')), environment_id: form.get('environment_id'), request_mode, source_plan_id: selected.plan_id, ...(request_mode === 'revise' ? { feedback, ...runBinding } : {}), generate: true, allow_model: true, quality_review_mode: form.get('quality_review_mode'), skill_profile: form.has('skill_profile') ? 'test-authoring-v1' : 'off' }));
      revisionContexts.delete(revisionKey({ project_id: project.project_id, case_id: item.case_id, case_version: version.version, plan_id: selected.plan_id }));
      selectCreated(plan);
    });
  });
  root.querySelector('#backend-plan-json')?.addEventListener('input', event => { dirty = true; onDirty(true); const preview = root.querySelector('#backend-plan-summary'); if (!preview) return; try { preview.innerHTML = backendPlanSummaryHtml(executionForView(JSON.parse(event.target.value)), version.content.steps, { ...selected, state: 'DRAFT' }); } catch { preview.innerHTML = '<p class="notice warning">JSON 格式暂不完整，卡片预览已暂停；原输入保留。</p>'; } });
  root.querySelector('#backend-confirm-plan')?.addEventListener('click', () => void operation(async () => {
    if (!root.querySelector('#backend-reviewed').checked) throw Error('请先逐步核对原预期、请求、断言和清理，并勾选核对声明。');
    const execution = JSON.parse(root.querySelector('#backend-plan-json').value);
    await api(`${endpoint}/plans/${selected.plan_id}/confirm`, json({ revision: selected.revision, reviewer: root.querySelector('#backend-reviewer').value.trim(), execution }));
    dirty = false; onDirty(false); toast('计划已确认并冻结，历史版本保留。'); await refresh();
  }));
  root.querySelector('#backend-copy-plan')?.addEventListener('click', () => void operation(async () => {
    const plan = await api(`${endpoint}/plans`, json({ case_id: item.case_id, case_version: version.version, binding_version: selected.binding_version, environment_id: selected.environment_id, execution: selected.execution, generate: false, allow_model: false }));
    selectCreated(plan);
  }));
  if (selected?.state === 'GENERATING' || tab === 'results' && (['RUNNING', 'QUEUED', 'STOPPING'].includes(batch?.state) || ['RUNNING', 'QUEUED', 'STOPPING'].includes(run?.execution_status))) {
    setTimeout(() => { if (active() && !dirty) void refresh().catch(error => toast(reason(error), 'error')); }, 1500);
  }
}
