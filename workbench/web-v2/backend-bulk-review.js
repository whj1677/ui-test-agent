import { api } from './api.js';
import { backendPlanSummaryHtml, backendGenerationEvidenceHtml, backendReasons } from './backend.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const errorText = error => backendReasons[error?.code || error?.message] || ({
  BACKEND_QUALITY_REVIEW_REQUIRED: '质量审查或独立复验尚未完整通过，请进入单条计划查看。',
  BACKEND_HARNESS_CANDIDATE_INCOMPLETE: '候选没有完整覆盖原业务预期，请进入单条计划查看。',
  WORKBENCH_UNREACHABLE: '连接中断，请重新载入核对结果后再操作。',
})[error?.code || error?.message] || error?.message || '核对资料读取失败，请重试。';
const detailHref = (projectId, item, plan) => `#/projects/${encodeURIComponent(projectId)}/cases/${encodeURIComponent(item.case_id)}?${new URLSearchParams({ version: plan?.case_version ?? item.case_version, tab: 'scripts', ...(plan?.plan_id ? { plan_id: plan.plan_id } : {}), return: `#/projects/${encodeURIComponent(projectId)}?test_type=backend` })}`;

// This is an early, read-only usability gate. The existing confirm endpoint
// remains authoritative and receives the exact revision displayed for review.
export function assessBackendBulkReview({ project, item, plans = [], bindings = [], environment, executionSha256 }) {
  const record = project.cases?.find(row => row.case_id === item.case_id);
  const version = record?.versions?.find(row => row.version === item.case_version);
  const current = plans.filter(plan => plan.case_id === item.case_id && plan.case_version === item.case_version);
  const pending = current.filter(plan => ['DRAFT', 'GENERATING'].includes(plan.state));
  const plan = pending.length === 1 ? pending[0] : null;
  const result = { item, plan, plans: current.length ? current : plans, caseSteps: version?.content?.steps || [], eligible: false, selected: false, outcome: null, existingConfirmed: [], reloadRequired: false, reason: '' };
  const block = reason => ({ ...result, reason });
  if (!record || record.current_version !== item.case_version || version?.content?.status !== 'CONFIRMED' || version.content.case_type !== 'BACKEND') return block('当前用例版本或确认状态已变化，请重新打开核对列表。');
  if (pending.length > 1) return block(`当前用例有 ${pending.length} 个待核对或生成中的计划，请进入详情明确选择计划版本。`);
  if (!plan) {
    const existingConfirmed = current.filter(row => row.state === 'CONFIRMED' && row.project_id === project.project_id && row.content_sha256 === version.content_sha256);
    if (existingConfirmed.length) return { ...result, existingConfirmed, reason: '当前用例已有已确认计划，无需重复确认。返回工作台选择运行版本即可检查运行条件。' };
    return block(plans.length ? '没有当前用例版本的待核对计划；请查看计划详情。' : '尚未生成或编写计划，请先准备脚本。');
  }
  if (plan.project_id !== project.project_id || plan.content_sha256 !== version.content_sha256 || !Number.isSafeInteger(plan.revision)) return block('计划身份与当前用例不一致，请进入详情重新核对。');
  if (plan.state !== 'DRAFT') return block('计划仍在生成中，请完成后重新载入核对结果。');
  if (!environment?.backend_environment_id || environment.backend_status !== 'CONFIGURED') return block(backendReasons[environment?.backend_status] || '项目 HTTP 测试环境尚未就绪。');
  if (plan.environment_id !== environment.backend_environment_id || plan.environment_sha256 !== environment.backend?.configuration_sha256) return block('计划绑定的环境或配置与项目当前测试环境不同，请进入详情处理。');
  const binding = bindings.find(row => row.version === plan.binding_version && row.binding_id === plan.binding_id && row.project_id === project.project_id && row.case_id === item.case_id);
  if (!binding || binding.status !== 'COMPLETE' || binding.confirmation_status !== 'CONFIRMED' || binding.case_version !== item.case_version || binding.case_content_sha256 !== version.content_sha256 || binding.protocol_sha256 !== plan.protocol_sha256 || /STALE|INVALID/.test(binding.applicability || '')) return block('协议绑定不完整、已变化或过期，请进入详情重新核对绑定。');
  const execution = plan.execution;
  if (!execution || execution.environment_id !== plan.environment_id || !Array.isArray(execution.steps) || !result.caseSteps.length || execution.steps.length !== result.caseSteps.length || execution.steps.some((step, index) => step.order !== result.caseSteps[index].order || !Array.isArray(step.requests) || !step.requests.length)) return block('计划尚未完整覆盖用例步骤，请进入详情检查请求与断言。');
  const session = plan.generation_session;
  if (session) {
    const candidate = session.candidate, tested = session.self_tests?.at(-1);
    if (session.status !== 'COMPLETED' || !candidate || !['READY', 'BUSINESS_DIFFERENCE'].includes(candidate.status)) return block('生成会话尚无可核对的完整候选，请进入详情查看。');
    if (!executionSha256 || candidate.execution_sha256 !== executionSha256 || tested?.execution_sha256 !== executionSha256 || tested.status !== (candidate.status === 'READY' ? 'PASSED' : 'FAILED')) return block('当前计划与冻结的自测记录不一致，请进入详情处理。');
    if (candidate.coverage?.length !== result.caseSteps.length || candidate.coverage.some((row, index) => row.order !== result.caseSteps[index].order || row.requirement !== result.caseSteps[index].expected || !row.request_ids?.length || row.uncovered)) return block('候选没有完整覆盖原业务预期，请进入详情查看。');
    if (plan.quality_policy === 'required-v1' || session.quality_policy === 'required-v1') {
      const review = session.quality_reviews?.find(row => row.number === candidate.quality_review_number);
      const validation = session.independent_validations?.find(row => row.number === candidate.independent_validation_number);
      const mode = plan.quality_review_mode ?? 'static-v1';
      if (plan.quality_policy !== 'required-v1' || session.quality_policy !== 'required-v1' || candidate.quality_policy !== 'required-v1' || !['static-v1', 'dsh-tools-v1'].includes(mode) || (session.quality_review_mode ?? 'static-v1') !== mode || !review || (review.mode ?? 'static-v1') !== mode || review.status !== 'NO_FINDINGS' || review.candidate_sha256 !== executionSha256 || review.self_test_number !== candidate.self_test_number || !validation || validation.execution_sha256 !== executionSha256 || validation.self_test_number !== candidate.self_test_number || validation.status !== (candidate.status === 'READY' ? 'PASSED' : 'FAILED')) return block('质量审查或独立复验不完整，暂不能参与批量确认；请进入单条计划查看。');
    }
    if (candidate.status === 'BUSINESS_DIFFERENCE') return block('自测发现业务差异：请进入单条计划核对后决定是否确认，本列表不批量确认该项。');
  }
  return { ...result, eligible: true, reason: session ? '生成、自测及所需质量记录已具备，等待人工核对。' : '人工计划，等待人工逐步核对；未取得自动自测结论。' };
}

export function invalidateBackendBulkReviewRows(rows, error) {
  return rows.map(row => row.outcome === 'CONFIRMED' ? row : { ...row, eligible: false, selected: false, existingConfirmed: [], reloadRequired: true, reason: `重新载入失败：${errorText(error)} 请重新载入成功后再核对。` });
}

const selectable = row => row.eligible && row.outcome !== 'CONFIRMED' && !row.reloadRequired;
export function backendBulkReviewSummary(rows) {
  const available = rows.filter(selectable);
  return {
    available,
    selected: available.filter(row => row.selected),
    confirmed: rows.filter(row => row.outcome === 'CONFIRMED' || row.existingConfirmed?.length).length,
    failed: rows.filter(row => row.outcome === 'FAILED').length,
  };
}

export function createBackendBulkReviewSession({ projectId, rows, request = api, isCurrent = () => true, onChange = () => {}, onUpdated = async () => {} }) {
  let busy = false, stopped = false;
  return {
    get busy() { return busy; },
    stop() { stopped = true; },
    async confirm({ reviewer, reviewed }) {
      if (busy) return;
      if (!reviewed || typeof reviewer !== 'string' || !reviewer.trim() || reviewer.trim().length > 100) throw Error('请填写核对人，并确认已核对全部所选计划。');
      const selected = rows.filter(row => row.selected && row.eligible && row.outcome !== 'CONFIRMED' && !row.reloadRequired);
      if (!selected.length) throw Error('请先选择已逐项核对的计划。');
      busy = true; stopped = false; onChange();
      try {
        for (const row of selected) {
          if (stopped || !isCurrent()) break;
          row.outcome = 'SUBMITTING'; row.message = '正在确认此计划…'; onChange();
          try {
            const confirmed = await request(`/api/case-library/projects/${encodeURIComponent(projectId)}/backend/plans/${encodeURIComponent(row.plan.plan_id)}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: row.plan.revision, reviewer: reviewer.trim() }) });
            row.plan = confirmed?.plan_id === row.plan.plan_id ? confirmed : { ...row.plan, state: 'CONFIRMED', reviewer: reviewer.trim() };
            row.outcome = 'CONFIRMED'; row.selected = false; row.message = '已确认并冻结。'; row.reason = '计划已确认并冻结，可返回工作台核对本次运行清单。';
          } catch (error) {
            row.outcome = 'FAILED'; row.message = (error?.code || error?.message) === 'WORKBENCH_UNREACHABLE' ? `当前请求未取得回复，确认结果未知。${errorText(error)}` : errorText(error);
            // A stale revision or uncertain network outcome must be explicitly
            // reloaded and reviewed; never silently replace the revision.
            row.reloadRequired = !['WORKBENCH_BUSY', 'BACKEND_EXECUTOR_BUSY', 'PROJECT_ENVIRONMENT_BUSY'].includes(error?.code || error?.message);
            if (row.reloadRequired) row.selected = false;
          }
          onChange();
        }
      } finally {
        try { await onUpdated(); } catch { /* Confirmation results remain visible if preflight refresh fails. */ }
        busy = false; onChange();
      }
    },
  };
}

let activeDispose = null;
export function openBackendBulkReview({ project, items, onUpdated = async () => {}, isCurrent = () => true, opener = document.activeElement }) {
  activeDispose?.();
  const pid = encodeURIComponent(project.project_id), endpoint = `/api/case-library/projects/${pid}`;
  const initialHash = location.hash;
  let disposed = false, loading = false, rows = [], session = null, status = '', loadNumber = 0;
  const active = () => !disposed && location.hash === initialHash && isCurrent();
  if (!document.querySelector('#backend-styles')) {
    const style = document.createElement('link'); style.id = 'backend-styles'; style.rel = 'stylesheet'; style.href = '/workspace/backend.css'; document.head.append(style);
  }
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal script-dialog backend-bulk-review" role="dialog" aria-modal="true" aria-labelledby="backend-bulk-title"><header><h2 id="backend-bulk-title">集中核对后端计划</h2><button class="icon-button" data-close aria-label="关闭核对窗口">×</button></header><div class="modal-body"><p data-review-intro>正在读取计划状态…</p><p class="notice" data-review-notice>确认后可以进入运行核对；本操作不会生成脚本或开始测试，确认计划不代表产品验收通过。</p><div class="actions"><label><input type="checkbox" data-select-all> 全选可核对项</label><button class="button" data-reload>重新载入核对结果</button></div><p data-status role="status" aria-live="polite"></p><div data-rows></div></div><footer class="bulk-review-footer"><label class="field" data-review-field><span>核对人</span><input data-reviewer maxlength="100" autocomplete="name"></label><label class="backend-check" data-review-field><input type="checkbox" data-reviewed> 我已逐项核对全部所选计划的原业务预期、请求、断言与本次清理范围，同意确认并冻结这些计划。</label><div class="actions"><button class="button" data-close>关闭</button><button class="button primary" data-confirm disabled>确认所选 0 条</button></div></footer></section>`;
  document.body.append(backdrop);
  const dialog = backdrop.querySelector('[role=dialog]'), rowRoot = backdrop.querySelector('[data-rows]');
  const reviewed = backdrop.querySelector('[data-reviewed]'), reviewer = backdrop.querySelector('[data-reviewer]'), confirmButton = backdrop.querySelector('[data-confirm]');
  const selectAll = backdrop.querySelector('[data-select-all]'), reloadButton = backdrop.querySelector('[data-reload]');
  const updateControls = () => {
    if (!active()) return;
    const { available, selected, confirmed, failed } = backendBulkReviewSummary(rows);
    const busy = session?.busy || false;
    const showReview = !loading && (!!available.length || busy);
    [...backdrop.querySelectorAll('[data-review-field]'), selectAll.parentElement, confirmButton, backdrop.querySelector('[data-review-notice]')].forEach(node => { node.hidden = !showReview; node.style.display = showReview ? '' : 'none'; });
    backdrop.querySelector('[data-review-intro]').textContent = loading ? '正在读取计划状态…' : available.length ? '展开每条计划核对业务预期、请求、断言与清理范围，再勾选要确认的计划。' : confirmed === rows.length && rows.length ? '这些用例已有已确认计划，无需重复核对。可查看计划后返回工作台选择运行版本。' : '当前没有可批量核对的计划，请按每条说明处理。';
    confirmButton.textContent = busy ? '正在确认所选计划…' : `确认所选 ${selected.length} 条`;
    confirmButton.disabled = loading || busy || !selected.length || !reviewed.checked || !reviewer.value.trim();
    selectAll.disabled = loading || busy || !available.length; selectAll.checked = !!available.length && selected.length === available.length; selectAll.indeterminate = !!selected.length && selected.length < available.length;
    reloadButton.disabled = loading || busy; reviewer.disabled = busy; reviewed.disabled = busy;
    backdrop.querySelectorAll('[data-close]').forEach(button => { button.textContent = busy ? '停止后续确认' : button.classList.contains('icon-button') ? '×' : '关闭'; button.setAttribute('aria-label', busy ? '停止后续确认，等待当前请求结果' : '关闭核对窗口'); });
    backdrop.querySelector('[data-status]').textContent = `${status}${rows.length ? ` 共 ${rows.length} 条用例，可核对 ${available.length} 条，已确认 ${confirmed} 条${failed ? `，确认失败 ${failed} 条` : ''}。` : ''}`;
  };
  const render = () => {
    if (!active()) return;
    const opened = new Set([...rowRoot.querySelectorAll('[data-review-details][open]')].map(node => node.dataset.reviewDetails));
    rowRoot.innerHTML = rows.map((row, index) => {
      const plan = row.plan, disabled = !selectable(row) || session?.busy;
      const confirmed = row.outcome === 'CONFIRMED' || !!row.existingConfirmed?.length;
      const state = confirmed ? '已确认' : row.outcome === 'SUBMITTING' ? '确认中' : row.outcome === 'FAILED' ? '确认失败' : row.eligible ? '待人工核对' : '请单条处理';
      const evidence = plan ? `${backendPlanSummaryHtml({ ...plan.execution, environment_name: row.environmentName }, row.caseSteps, plan)}${backendGenerationEvidenceHtml(plan, row.caseSteps)}<details><summary>计划身份及完整执行内容</summary><p>计划 P${esc(plan.version)} · 用例 v${esc(plan.case_version)} · 修订 ${esc(plan.revision)}</p><pre>${esc(JSON.stringify(plan.execution, null, 2))}</pre></details>` : '';
      const links = plan ? [plan] : row.existingConfirmed?.length ? row.existingConfirmed : row.plans?.length ? row.plans : [null];
      return `<article class="panel"><div class="panel-header"><label>${confirmed ? '' : `<input type="checkbox" data-row="${index}" ${row.selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}> `}${esc(row.item.external_id || row.item.case_id)} · ${esc(row.item.title)}${plan ? ` · P${esc(plan.version)}` : ''}</label><span class="badge ${confirmed ? 'success' : 'warning'}">${state}</span></div><div class="panel-body"><p class="${row.eligible || confirmed ? 'muted' : 'notice warning'}">${esc(row.reason)}</p>${row.message ? `<p role="status" class="notice ${row.outcome === 'FAILED' ? 'warning' : ''}">${esc(row.message)}${row.reloadRequired ? ' 请重新载入并再次审阅；系统不会自动改用新修订。' : ''}</p>` : ''}${plan ? `<details data-review-details="${index}" ${opened.has(String(index)) ? 'open' : ''}><summary>展开核对：业务步骤、请求、断言、清理及质量结果</summary>${evidence}</details>` : ''}<div class="actions">${links.map(entry => `<a href="${esc(detailHref(project.project_id, row.item, entry))}">${entry ? `查看计划 P${esc(entry.version)}（用例 v${esc(entry.case_version)}）` : '进入用例详情'}</a>`).join(' ')}</div></div></article>`;
    }).join('');
    rowRoot.querySelectorAll('[data-row]').forEach(checkbox => checkbox.addEventListener('change', () => { rows[Number(checkbox.dataset.row)].selected = checkbox.checked; reviewed.checked = false; updateControls(); }));
    updateControls();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; loadNumber += 1; session?.stop();
    window.removeEventListener('hashchange', navigated); backdrop.remove();
    if (activeDispose === dispose) activeDispose = null;
    if (location.hash === initialHash && opener?.isConnected) opener.focus();
  };
  const navigated = () => { if (location.hash !== initialHash) dispose(); };
  const close = () => {
    if (session?.busy) { session.stop(); status = '已停止后续确认；当前已发出的请求仍在处理，结果会显示在本窗口。'; updateControls(); return; }
    dispose();
  };
  const load = async () => {
    if (!active() || session?.busy) return;
    loading = true; const number = ++loadNumber; reviewed.checked = false; status = '正在读取当前计划和核对资料…'; updateControls();
    const completed = new Map(rows.filter(row => row.outcome === 'CONFIRMED').map(row => [row.item.case_id, row]));
    try {
      const [freshProject, environment] = await Promise.all([api(endpoint), api(`${endpoint}/environment`)]);
      if (!active() || number !== loadNumber) return;
      const loaded = await Promise.all(items.map(async item => {
        if (completed.has(item.case_id)) return completed.get(item.case_id);
        try {
          const [{ plans }, { bindings }] = await Promise.all([api(`${endpoint}/backend?case_id=${encodeURIComponent(item.case_id)}`), api(`${endpoint}/requirements/bindings?case_id=${encodeURIComponent(item.case_id)}`)]);
          const pending = plans.filter(plan => plan.case_id === item.case_id && plan.case_version === item.case_version && ['DRAFT', 'GENERATING'].includes(plan.state));
          const execution = pending.length === 1 && pending[0].generation_session ? pending[0].execution : null;
          const executionSha256 = execution ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(execution))))].map(byte => byte.toString(16).padStart(2, '0')).join('') : null;
          return { ...assessBackendBulkReview({ project: freshProject, item, plans, bindings, environment, executionSha256 }), environmentName: environment.backend?.name };
        } catch (error) { return { item, plans: [], eligible: false, selected: false, reason: errorText(error) }; }
      }));
      if (!active() || number !== loadNumber) return;
      rows = loaded; session = createBackendBulkReviewSession({ projectId: project.project_id, rows, isCurrent: active, onChange: render, onUpdated });
      status = rows.some(selectable) ? '请展开审阅后勾选。' : '';
    } catch (error) { if (active() && number === loadNumber) { status = errorText(error); rows = invalidateBackendBulkReviewRows(rows, error); session = null; } }
    finally { if (active() && number === loadNumber) { loading = false; render(); } }
  };
  backdrop.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  reloadButton.addEventListener('click', () => void load());
  reviewer.addEventListener('input', updateControls); reviewed.addEventListener('change', updateControls);
  selectAll.addEventListener('change', () => { rows.filter(selectable).forEach(row => { row.selected = selectAll.checked; }); reviewed.checked = false; render(); });
  confirmButton.addEventListener('click', async () => {
    if (!session || session.busy || confirmButton.disabled) return;
    status = '按所选顺序确认计划。';
    try { await session.confirm({ reviewer: reviewer.value, reviewed: reviewed.checked }); }
    catch (error) { status = errorText(error); }
    if (active()) { reviewed.checked = false; if (!status.startsWith('已停止')) status = '本轮确认完成，请查看逐条结果。'; render(); }
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],summary')].filter(node => node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  window.addEventListener('hashchange', navigated); activeDispose = dispose;
  backdrop.querySelector('[data-close]').focus();
  void load();
  return dispose;
}
