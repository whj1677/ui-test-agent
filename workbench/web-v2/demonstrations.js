import { api } from './api.js';
import { esc, batchReasons } from './workflow.js';

const post = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const active = new Set(['PREPARING', 'WAITING_LOGIN', 'PAUSED', 'RECORDING']);
const authReasons = { LOGIN_REQUIRED: '请先人工登录。', NOT_LOGGED_IN: '尚未登录。', AWAITING_LOGIN: '专用浏览器正在等待登录。', EXPIRED: '登录已过期，请重新登录。', ROLE_MISMATCH: '当前账号角色不符，请使用该环境要求的角色。', PERMISSION_DENIED: '当前账号没有所需权限。', IDENTITY_CHANGED: '账号身份变化，请重新登录并核验。', IDENTITY_UNVERIFIED: '身份尚未核验成功。', CHECK_UNAVAILABLE: '身份检查暂不可用，请恢复目标服务后重试。', BROWSER_CLOSED: '登录浏览器已关闭，请重新打开并登录。', LOGIN_RECHECK_REQUIRED: '登录会话已更新，请重新检查登录。', AUTH_SESSION_REQUIRED: '登录状态需重新核验。' };
const selectionNotices = { SELECTION_RECORDED: '检查对象已记录。', SELECTION_INVALID: '检查对象无效，未记录。', SELECTION_ESCAPE: '已取消标记。', SELECTION_NO_HIT: '未命中对象，未记录。', SELECTION_OVERFLOW: '框选对象过多，未记录。', SELECTION_CROSS_FRAME: '跨窗口内容暂不可标记。', SELECTION_UNLOCATABLE_DOM: '对象无法稳定定位，未记录。', SELECTION_SENSITIVE_TARGET: '敏感对象不可标记。', SELECTION_NAVIGATION: '页面导航中断了标记。', SELECTION_CANCELLED: '检查对象选择已取消。' };
const kindName = { click: '点击', fill: '输入（不记录输入值）', select: '选择（不记录选中值）', check: '勾选切换（状态依据原用例）', navigation: '页面导航', assertion_target: '检查对象定位' };
const unwrap = value => value?.demonstration || value?.recording || value;
const recordId = value => value?.demonstration_id;
const statusText = status => ({ PREPARING: '正在打开专用浏览器', WAITING_LOGIN: '等待人工登录（未录制）', PAUSED: '已暂停', RECORDING: '正在记录',
  STOPPED: '已停止，待核对', CONFIRMED: '已确认', CANCELLED: '已取消', INTERRUPTED: '已中断，请重新录制' })[status] || status || '未开始';
export function demonstrationLabel(value) {
  const count=Array.isArray(value?.steps)?value.steps.length:
    Number.isInteger(value?.step_count)&&value.step_count>=0?value.step_count:null;
  const time=value?.created_at||value?.started_at||value?.finished_at;
  const parsed=time?new Date(time):null;
  const date=parsed&&!Number.isNaN(parsed.valueOf())?parsed.toLocaleString('zh-CN',{hour12:false}):'时间未记录';
  return `${value?.case_title||value?.title||value?.case_external_id||value?.external_id||'人工示范'} · ${count!==null?count+' 步':'步骤未记录'} · ${date} · ${statusText(value?.status)}`;
}
const messages = {
  WORKBENCH_UNREACHABLE: '工作台暂不可访问；录制状态未能确认，请重新打开后检查草稿。',
  DEMONSTRATION_BUSY: '当前有录制或测试任务在运行，请先结束该任务。',
  DEMONSTRATION_NOT_ACTIVE: '录制已结束或浏览器已关闭，请重新打开历史示范查看状态。',
  DEMONSTRATION_CONFIRMED_CASE_REQUIRED: '请先确认前端用例，并为每一步填写明确的预期。',
  DEMONSTRATION_REGISTERED_TARGET_REQUIRED: '请先登记测试环境，或配置需要登录的认证环境，再开始示范。',
  DEMONSTRATION_RECORDING_CHANGED: '录制为空、未正常停止或内容已变化，请重新录制后核对。',
  DEMONSTRATION_SOURCE_CHANGED: '用例或环境已变化，原示范不能用于本次生成，请重新录制。',
  DEMONSTRATION_TARGET_CHANGED: '被测系统已变化，请重新录制并核对。',
  DEMONSTRATION_STATE_INVALID: '录制状态已变化，请刷新后按当前状态操作。',
  DEMONSTRATIONS_CLOSING: '工作台正在关闭录制，请稍后重新打开。',
  TARGET_SCOPE_REQUEST_BLOCKED: '页面请求超出登记范围，已停止打开浏览器。请检查被测系统登记。',
  AUTH_LOGIN_TARGET_UNREACHABLE: '登录目标当前无法连接，请先恢复被测服务，再打开登录浏览器。',
  AUTH_LOGIN_PAGE_UNAVAILABLE: '登录页面暂不可用，请检查被测服务后重试。',
  DEMONSTRATION_FLOATING_UNSUPPORTED: '此悬浮控制条仅支持 Windows；仍可使用网页控制窗。',
  DEMONSTRATION_FLOATING_START_FAILED: '未能启动 Windows 悬浮控制条；仍可使用网页控制窗。',
  DEMONSTRATION_FLOATING_READY_TIMEOUT: '悬浮控制条启动超时；请检查任务栏，或使用网页控制窗。',
};
const message = error => messages[error?.message] || batchReasons[error?.message] || String(error?.message || error);
export function eventSummary(event) {
  const hint = event?.locator_hint || {};
  const path = [hint.css_path, hint.row_path].filter(value => typeof value === 'string').join(' ');
  const row = path.match(/\btr:nth-of-type\((\d+)\)/i)?.[1];
  const column = path.match(/\btd:nth-of-type\((\d+)\)/i)?.[1];
  const grid = row && column ? `表格第${row}行 · 第${column}列` : row ? `表格第${row}行` : column ? `表格第${column}列` : '';
  const detail = [hint.visible_name, hint.aria_label, hint.placeholder,
    hint.testid && `testid: ${hint.testid}`, hint.name && `name: ${hint.name}`,
    hint.id && `#${hint.id}`, grid, hint.role, hint.tag, hint.row_path, hint.css_path]
    .find(value => typeof value === 'string' && value.trim());
  return `${kindName[event?.kind] || '页面操作'}${detail ? ` · ${detail.slice(0, 100)}` : ''}`;
}

export function eligibleDemonstration(recording, caseId, caseVersion, environmentId) {
  return recording?.status === 'CONFIRMED' && recording.case_id === caseId &&
    recording.case_version === caseVersion && recording.environment_id === environmentId &&
    typeof recording.demonstration_id === 'string';
}

export function buildAssertionReviews(steps, reviewed, targets) {
  if (!Array.isArray(steps) || !steps.length || steps.some((step, index) =>
    !String(step.expected || '').trim() || !reviewed.has(index))) throw Error('DEMONSTRATION_ASSERTIONS_NOT_REVIEWED');
  return steps.map((_, step_index) => {
    const raw = targets.get(step_index);
    const ids = [...new Set(raw instanceof Set ? [...raw] : Array.isArray(raw) ? raw : raw ? [raw] : [])];
    if (ids.length > 20 || ids.some(id => typeof id !== 'string' || !id.trim())) throw Error('DEMONSTRATION_LOCATOR_LIMIT');
    return { step_index, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: ids };
  });
}

export function canConfirmDemonstration(recording) {
  return recording?.status === 'STOPPED' && Array.isArray(recording.events) &&
    recording.events.length > 0 && Boolean(recording.recording_sha256);
}

export async function openDemonstrationDialog({ project, item, onClose = () => {}, onError = () => {} }) {
  const root = document.querySelector('#modal-root');
  if (!root || !project?.project_id || !item?.case_id) { onError(Error('DEMONSTRATION_CONTEXT_INVALID')); return; }
  const version = item.version || item.versions?.find(value => value.version === (item.case_version ?? item.current_version));
  if (!version?.content || (version.content.case_type !== undefined && version.content.case_type !== 'UI') || version.content.status !== 'CONFIRMED') {
    onError(Error('只支持当前已确认的前端 UI 用例版本。')); return;
  }
  const caseSteps = version.content.steps || [];
  if (!caseSteps.length || caseSteps.some(step => !String(step.expected || '').trim())) {
    onError(Error('每步原预期必须明确；请先修改并确认用例版本。')); return;
  }
  const base = `/api/case-library/projects/${encodeURIComponent(project.project_id)}/demonstrations`;
  const initialDialog=root.firstElementChild;
  let leftDuringLoad=false;
  const markLeft=()=>{leftDuringLoad=true;};
  window.addEventListener('hashchange',markLeft);
  let environments, previous, projectEnvironment;
  try {
    [{ environments }, { recordings: previous }, projectEnvironment] = await Promise.all([
      api(`/api/script-environments?project_id=${encodeURIComponent(project.project_id)}`), api(base),
      api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/environment`),
    ]);
  } catch (error) { if(!leftDuringLoad)onError(error); return; }
  finally { window.removeEventListener('hashchange',markLeft); }
  if(leftDuringLoad || !root.isConnected || root.firstElementChild!==initialDialog)return;
  const available = (environments || []).filter(env => env.id === projectEnvironment.ui_environment_id && env.demonstration_ready);
  const history = (previous || []).filter(value => value.case_id === item.case_id && value.case_version === version.version);
  let recording = null, busy = false, closed = false, closeRequested = false, timer = null, sequence = 0;
  let popupWindow = null, popupWasOpen = false;
  let ownedDialog = null;
  const ownership = new MutationObserver(() => { if (!closed && ownedDialog && root.firstElementChild !== ownedDialog) void close(); });
  const reviewed = new Set();
  const selectedTargets = new Map();
  const safeSteps = () => recording?.steps?.length === caseSteps.length ? recording.steps : caseSteps;
  const notice = text => { const node = root.querySelector('#demonstration-error'); if (node) node.textContent = text || ''; };
  const setBusy = value => {
    busy = value;
    root.querySelectorAll('[data-demo-action],#demonstration-close,#demonstration-close-footer,#demonstration-existing').forEach(node => {
      node.disabled = value || (node.dataset.demoAction === 'confirm' && !canConfirmDemonstration(recording)) ||
        (Boolean(recording?.selection_mode) && ['pick-point', 'pick-box', 'next-step'].includes(node.dataset.demoAction));
    });
    const environment = root.querySelector('#demonstration-environment');
    if (environment) environment.disabled = value || Boolean(recording);
    const step = root.querySelector('#demonstration-step');
    if (step) step.disabled = value || Boolean(recording?.selection_mode) || !['PAUSED', 'RECORDING'].includes(recording?.status);
  };
  const pauseIfPopupClosed = async () => {
    if (!popupWasOpen || !popupWindow?.closed || busy || closed) return;
    popupWasOpen = false;
    if (recording?.status === 'RECORDING') await control('pause');
    else notice('独立控制窗已关闭；主窗口仍可控制录制。');
  };
  const schedulePoll = () => {
    clearTimeout(timer);
    if (!closed && recording && active.has(recording.status)) timer = setTimeout(async () => {
      if (ownedDialog && root.firstElementChild !== ownedDialog) { void close(); return; }
      await pauseIfPopupClosed();
      const token = ++sequence;
      try {
        const next = unwrap(await api(`${base}/${encodeURIComponent(recordId(recording))}`));
        if (!closed && token === sequence && !busy && JSON.stringify(next) !== JSON.stringify(recording)) { recording = next; render(); }
      } catch (error) { if (!closed) notice(`状态刷新失败：${message(error)}`); }
      schedulePoll();
    }, 1500);
  };
  const render = () => {
    if (closed) return;
    if (ownedDialog && root.firstElementChild !== ownedDialog) { void close(); return; }
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const priorScrollTop = ownedDialog?.querySelector('.modal')?.scrollTop || 0;
    const focusSelector = focused?.dataset?.demoAction ? `[data-demo-action="${focused.dataset.demoAction}"]` :
      focused?.dataset?.demoTarget ? `[data-demo-target="${focused.dataset.demoTarget}"][value="${CSS.escape(focused.value)}"]` :
      focused?.dataset?.demoReview ? `[data-demo-review="${focused.dataset.demoReview}"]` :
      focused?.id ? `#${CSS.escape(focused.id)}` : null;
    const status = recording?.status;
    const steps = safeSteps();
    const events = recording?.events || [];
    const stepRows = steps.map((step, index) => {
      const indexEvents = events.filter(event => event.step_index === index);
      const hints = indexEvents.filter(event => event.kind === 'assertion_target');
      const targets = selectedTargets.get(index) || new Set();
      return `<article class="step-pair" data-demonstration-step="${index}"><strong>步骤 ${index + 1}${recording?.current_step_index === index ? ' · 当前' : ''}</strong>
        <div><small>原动作</small><p class="preserve-text">${esc(step.action || '')}</p><small>示范动作摘要</small>
          <p>${indexEvents.length ? indexEvents.map(event => esc(eventSummary(event))).join('、') : '尚无记录'}</p></div>
        <div><small>原预期（只读，页面实际值不会成为断言）</small><p class="preserve-text">${esc(step.expected || '')}</p>
          ${status === 'STOPPED' ? `<label><input type="checkbox" data-demo-review="${index}" ${reviewed.has(index) ? 'checked' : ''}>我已核对本步骤沿用原预期</label>
          <fieldset class="field"><legend>检查对象定位提示（可选，最多 20 项）</legend>${hints.length ? hints.map(event => `<label style="display:block;margin:8px 0"><input type="checkbox" data-demo-target="${index}" value="${esc(event.event_id)}" ${targets.has(event.event_id) ? 'checked' : ''}> <strong>${esc(eventSummary(event))}</strong><small style="display:block;margin-left:22px;overflow-wrap:anywhere">${esc(event.locator_hint?.css_path || event.locator_hint?.row_path || event.event_id)}</small></label>`).join('') : '<small>尚无检查对象标记</small>'}</fieldset>` : ''}</div></article>`;
    }).join('');
    root.innerHTML = `<div class="modal-backdrop"><section class="modal script-dialog" role="dialog" aria-modal="true" aria-label="人工示范录制">
      <header><h2>人工示范录制</h2><button class="icon-button" id="demonstration-close" aria-label="关闭">×</button></header>
      <div class="modal-body"><p class="notice">只支持当前已确认 UI 用例 v${esc(version.version)}。登录阶段不录制；输入值和页面实际值不会成为断言。示范只提供动作与定位提示，原预期仍是唯一断言来源。</p>
        <input type="hidden" id="demonstration-environment" value="${esc(projectEnvironment.ui_environment_id || '')}">
        ${projectEnvironment.ui ? `<p>项目当前被测系统：${esc(projectEnvironment.ui.name || projectEnvironment.ui.id)} · ${esc(projectEnvironment.ui.entry_url || projectEnvironment.ui.entry || '地址未记录')}</p>` : '<p class="notice warning">项目尚未配置 UI 测试环境。<a data-nav href="#/projects/'+encodeURIComponent(project.project_id)+'/auth">去项目测试环境设置</a></p>'}
        ${history.length && !recording ? `<label class="field">已有示范<select id="demonstration-existing"><option value="">请选择历史示范</option>${history.map(value => `<option value="${esc(recordId(value))}">${esc(demonstrationLabel(value))}</option>`).join('')}</select></label><button class="button" data-demo-action="load">查看已有示范</button>` : ''}
        <p role="status">状态：${esc(statusText(status))}</p>${recording?`<details><summary>录制记录身份</summary><code>${esc(recordId(recording))}</code></details>`:''}
        ${status === 'WAITING_LOGIN' ? `<p class="notice warning">请在专用浏览器完成登录，然后点击“检查登录”。${authReasons[recording.auth_reason] || ''}</p>` : ''}
        ${recording?.selection_mode ? `<p class="notice">检查对象标记：${recording.selection_mode === 'box' ? '框选' : '单点'}。${selectionNotices[recording.selection_notice] || ''}</p>` : recording?.selection_notice ? `<p class="notice">${selectionNotices[recording.selection_notice] || '标记状态已更新。'}</p>` : ''}
        ${recording?.environment_id ? `<p class="muted">被测系统：${esc(available.find(env=>env.id===recording.environment_id)?.name||recording.environment_id)}</p>` : ''}
        ${status === 'CONFIRMED' ? '<p class="notice">示范已确认。关闭后在单例“生成自动化脚本”弹窗中选择同用例版本、同环境的示范。</p>' : ''}
        ${status === 'INTERRUPTED' || status === 'CANCELLED' ? '<p class="notice warning">此记录只读，无法继续录制；关闭后可新开一次示范。</p>' : ''}
        ${recording ? `<label class="field">当前步骤<select id="demonstration-step" ${!['PAUSED', 'RECORDING'].includes(status) || recording.selection_mode ? 'disabled' : ''}>${steps.map((entry, index) => `<option value="${index}" ${recording.current_step_index === index ? 'selected' : ''}>步骤 ${index + 1} · ${esc(String(entry.action || '').slice(0, 48))}</option>`).join('')}</select></label>${steps[recording.current_step_index + 1] ? `<p class="muted">下一步 ${recording.current_step_index + 2}：${esc(steps[recording.current_step_index + 1].action || '')}</p>` : '<p class="muted">当前已是最后一步。</p>'}` : ''}
        <div class="actions">${!recording ? `<button class="button primary" data-demo-action="open" ${available.length?'':'disabled'}>打开专用浏览器</button>${!available.length?'<span class="muted">请先配置可用于示范的项目 UI 环境并检查是否可访问。</span>':''}` : ''}
          ${status === 'WAITING_LOGIN' ? '<button class="button primary" data-demo-action="login-open">打开登录浏览器</button><button class="button" data-demo-action="login-check">检查登录</button>' : ''}
          ${status === 'PAUSED' ? '<button class="button primary" data-demo-action="start">开始记录</button>' : ''}
          ${status === 'RECORDING' ? '<button class="button" data-demo-action="pause">暂停</button>' : ''}
          ${['PAUSED', 'RECORDING'].includes(status) ? `<button class="button" data-demo-action="pick-point" title="按原预期选择检查对象；录制中会先暂停" ${recording.selection_mode ? 'disabled' : ''}>断言点选</button><button class="button" data-demo-action="pick-box" title="按原预期框选检查对象；录制中会先暂停" ${recording.selection_mode ? 'disabled' : ''}>断言框选</button>` : ''}
          ${['PAUSED', 'RECORDING'].includes(status) && steps[recording.current_step_index + 1] ? `<button class="button" data-demo-action="next-step" ${recording.selection_mode ? 'disabled' : ''}>下一步</button>` : ''}
          ${active.has(status) ? '<button class="button" data-demo-action="floating-open">打开 Windows 悬浮控制条</button><button class="button" data-demo-action="popup">网页控制窗（备用）</button>' : ''}
          ${active.has(status) ? '<button class="button" data-demo-action="stop">停止并核对</button>' : ''}</div>
        ${recording ? `<p class="muted">已记录 ${events.length} 个脱敏事件。断言标记按原预期选择检查对象，完成后保持暂停；不读取页面实际值作为预期。</p>` : ''}
        ${status === 'STOPPED' && events.length === 0 ? '<p class="notice warning">未记录任何操作，请关闭后重新录制。</p>' : ''}
        <div class="step-list">${stepRows}</div>
        <p id="demonstration-error" role="alert"></p>
      </div><footer>${status === 'STOPPED' ? `<button class="button primary" data-demo-action="confirm" ${canConfirmDemonstration(recording) ? '' : 'disabled'}>确认示范</button>` : ''}
        <button class="button" id="demonstration-close-footer">关闭${active.has(status) ? '并停止录制（保留草稿）' : ''}</button></footer></section></div>`;
    ownedDialog = root.firstElementChild;
    root.querySelector('#demonstration-environment').value = recording?.environment_id || projectEnvironment.ui_environment_id || '';
    root.querySelectorAll('[data-demo-review]').forEach(node => node.addEventListener('change', () => node.checked ? reviewed.add(Number(node.dataset.demoReview)) : reviewed.delete(Number(node.dataset.demoReview))));
    root.querySelectorAll('[data-demo-target]').forEach(node => node.addEventListener('change', () => {
      const index = Number(node.dataset.demoTarget);
      const ids = selectedTargets.get(index) || new Set();
      if (node.checked && ids.size >= 20) { node.checked = false; notice('每步最多关联 20 个检查对象。'); return; }
      if (node.checked) ids.add(node.value); else ids.delete(node.value);
      selectedTargets.set(index, ids);
    }));
    root.querySelector('#demonstration-step')?.addEventListener('change', async event => {
      if (recording?.selection_mode || busy || !['PAUSED', 'RECORDING'].includes(recording?.status)) return;
      const step_index = Number(event.target.value);
      await control('step', { step_index });
    });
    root.querySelectorAll('[data-demo-action]').forEach(node => node.addEventListener('click', () => {
      if (node.dataset.demoAction === 'popup') { openPopup(); return; }
      void action(node.dataset.demoAction);
    }));
    root.querySelector('#demonstration-close').addEventListener('click', () => void close());
    root.querySelector('#demonstration-close-footer').addEventListener('click', () => void close());
    root.querySelector('.modal').scrollTop = priorScrollTop;
    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  };
  const openPopup = () => {
    if (!recording || !active.has(recording.status)) return;
    if (popupWindow && !popupWindow.closed) { popupWindow.focus(); return; }
    const url = `/workspace/demonstration-control.html?project_id=${encodeURIComponent(project.project_id)}&demonstration_id=${encodeURIComponent(recordId(recording))}`;
    popupWindow = window.open(url, `demonstration-control-${recordId(recording)}`, 'popup,width=420,height=650');
    if (!popupWindow) { notice('浏览器阻止了独立控制窗；请允许工作台弹窗，或继续使用主窗口控制。'); return; }
    popupWindow.opener = null;
    popupWasOpen = true;
    popupWindow.focus();
  };
  const refresh = async () => { recording = unwrap(await api(`${base}/${encodeURIComponent(recordId(recording))}`)); render(); schedulePoll(); };
  const control = async (action, extra = {}) => {
    if (!recording || busy) return false;
    setBusy(true); clearTimeout(timer); sequence++;
    try {
      recording = unwrap(await api(`${base}/${encodeURIComponent(recordId(recording))}/control`, post({ action, ...extra })));
      await refresh();
      if (action === 'floating-open') notice('Windows 悬浮控制条已请求打开；它由工作台启动，不是网页弹窗。');
      return true;
    } catch (error) { notice(message(error)); schedulePoll(); return false; }
    finally { if (!closed) { setBusy(false); if (closeRequested) void close(); } }
  };
  const action = async name => {
    if (busy) return;
    if (name === 'load') {
      const id = root.querySelector('#demonstration-existing')?.value;
      if (!history.some(value => recordId(value) === id)) return notice('请选择已有示范。');
      setBusy(true);
      try { recording = unwrap(await api(`${base}/${encodeURIComponent(id)}`)); reviewed.clear(); selectedTargets.clear(); render(); schedulePoll(); }
      catch (error) { notice(message(error)); }
      finally { if (!closed) { setBusy(false); if (closeRequested) void close(); } }
      return;
    }
    if (name === 'open') {
      const environment_id = root.querySelector('#demonstration-environment').value;
      if (!available.some(env => env.id === environment_id)) return notice('请选择可用于示范的已登记环境。');
      setBusy(true);
      try {
        recording = unwrap(await api(base, post({ case_id: item.case_id, case_version: version.version, environment_id })));
        await refresh();
      } catch (error) { notice(message(error)); }
      finally { if (!closed) { setBusy(false); if (closeRequested) void close(); } }
      return;
    }
    if (name === 'confirm') {
      if (!canConfirmDemonstration(recording))
        return notice(recording?.status === 'STOPPED' && !recording?.events?.length ? '未记录任何操作，请关闭后重新录制。' : '请先停止录制，并逐步核对全部原预期。');
      let assertion_reviews;
      try { assertion_reviews = buildAssertionReviews(safeSteps(), reviewed, selectedTargets); }
      catch { return notice('请逐步核对全部原预期；缺少原预期时先修改用例。'); }
      setBusy(true);
      try {
        recording = unwrap(await api(`${base}/${encodeURIComponent(recordId(recording))}/confirm`,
          post({ recording_sha256: recording.recording_sha256, assertion_reviews })));
        render();
      } catch (error) { notice(message(error)); }
      finally { if (!closed) { setBusy(false); if (closeRequested) void close(); } }
      return;
    }
    if (name === 'pick-point' || name === 'pick-box') {
      if (!['PAUSED', 'RECORDING'].includes(recording?.status) || recording.selection_mode) return;
      if (recording.status === 'RECORDING' && !await control('pause')) return;
      if (recording?.status !== 'PAUSED' || recording.selection_mode) return;
      return control('pick', { pick_mode: name === 'pick-box' ? 'box' : 'point' });
    }
    if (name === 'next-step') {
      if (recording?.selection_mode || !['PAUSED', 'RECORDING'].includes(recording?.status)) return;
      return control('step', { step_index: recording.current_step_index + 1 });
    }
    await control(name);
  };
  const close = async () => {
    if (closed) return;
    if (busy) { closeRequested = true; return; }
    clearTimeout(timer); sequence++;
    if (recording && active.has(recording.status)) {
      setBusy(true);
      try { await api(`${base}/${encodeURIComponent(recordId(recording))}/control`, post({ action: 'stop' })); }
      catch (error) { setBusy(false); if (root.firstElementChild === ownedDialog) notice(`未能停止专用浏览器，窗口保持打开：${message(error)}`); else onError(error); schedulePoll(); return; }
    }
    closed = true; clearTimeout(timer); ownership.disconnect(); window.removeEventListener('hashchange', onRouteChange);
    if (popupWindow && !popupWindow.closed) popupWindow.close();
    document.removeEventListener('keydown', onKey);
    if (root.firstElementChild === ownedDialog) root.innerHTML = '';
    onClose();
  };
  const onRouteChange = () => { void close(); };
  const onKey = event => { if (event.key === 'Escape') void close(); };
  window.addEventListener('hashchange', onRouteChange);
  document.addEventListener('keydown', onKey);
  render();
  ownership.observe(root, { childList: true });
}
