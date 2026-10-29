const params = new URLSearchParams(location.search);
const projectId = params.get('project_id');
const demonstrationId = params.get('demonstration_id');
const valid = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const statusNode = document.querySelector('#status');
const stepNode = document.querySelector('#step');
const stepActionNode = document.querySelector('#step-action');
const stepExpectedNode = document.querySelector('#step-expected');
const nextStepNode = document.querySelector('#next-step');
const actionsNode = document.querySelector('#actions');
const noticeNode = document.querySelector('#notice');
const errorNode = document.querySelector('#error');
const closeNode = document.querySelector('#pause-close');
const base = valid(projectId) && valid(demonstrationId)
  ? `/api/case-library/projects/${encodeURIComponent(projectId)}/demonstrations/${encodeURIComponent(demonstrationId)}` : null;
let recording = null, busy = false, closed = false, pollTimer = null;
const active = new Set(['WAITING_LOGIN', 'PAUSED', 'RECORDING']);
const labels = { WAITING_LOGIN: '等待人工登录 · 尚未录制', PAUSED: '已暂停', RECORDING: '正在记录', STOPPED: '已停止', CONFIRMED: '已确认', INTERRUPTED: '已中断', CANCELLED: '已取消' };
const authReasons = { LOGIN_REQUIRED: '请先人工登录。', NOT_LOGGED_IN: '尚未登录。', AWAITING_LOGIN: '专用浏览器正在等待登录。', EXPIRED: '登录已过期，请重新登录。', ROLE_MISMATCH: '当前账号角色不符，请使用该环境要求的角色。', PERMISSION_DENIED: '当前账号没有所需权限。', IDENTITY_CHANGED: '账号身份变化，请重新登录并核验。', IDENTITY_UNVERIFIED: '身份尚未核验成功。', CHECK_UNAVAILABLE: '身份检查暂不可用，请恢复目标服务后重试。', BROWSER_CLOSED: '登录浏览器已关闭，请重新打开并登录。', LOGIN_RECHECK_REQUIRED: '登录会话已更新，请重新检查登录。', AUTH_SESSION_REQUIRED: '登录状态需重新核验。' };
const notices = { SELECTION_RECORDED: '检查对象已记录。', SELECTION_INVALID: '检查对象无效，未记录。', SELECTION_ESCAPE: '已取消标记。', SELECTION_NO_HIT: '未命中对象，未记录。', SELECTION_OVERFLOW: '框选对象过多，未记录。', SELECTION_CROSS_FRAME: '跨窗口内容暂不可标记。', SELECTION_UNLOCATABLE_DOM: '对象无法稳定定位，未记录。', SELECTION_SENSITIVE_TARGET: '敏感对象不可标记。', SELECTION_NAVIGATION: '页面导航中断了标记。', SELECTION_CANCELLED: '检查对象选择已取消。' };
const request = async (url, options) => {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  let data;
  try { data = await response.json(); } catch { throw Error(`HTTP ${response.status}`); }
  if (!response.ok) throw Error(data?.error?.code || data?.error || `HTTP ${response.status}`);
  return data?.demonstration || data?.recording || data;
};
const showError = error => { errorNode.textContent = `操作失败：${String(error?.message || error)}`; };
const addButton = (name, text, primary = false) => {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.action = name; button.textContent = text;
  if (primary) button.className = 'primary';
  button.disabled = busy;
  actionsNode.append(button);
};
const render = () => {
  const status = recording?.status;
  const focusedAction = document.activeElement?.dataset?.action;
  const focusedId = document.activeElement?.id;
  statusNode.textContent = `状态：${labels[status] || status || '未开始'}${recording?.selection_mode ? ` · ${recording.selection_mode === 'box' ? '框选' : '单点'}标记中` : ''}`;
  statusNode.className = `status ${status === 'RECORDING' ? 'recording' : status === 'WAITING_LOGIN' ? 'waiting' : ''}`;
  const count = recording?.steps?.length || 0;
  if (stepNode.options.length !== count) {
    stepNode.replaceChildren();
    for (let i = 0; i < count; i++) { const option = document.createElement('option'); option.value = String(i); option.textContent = `步骤 ${i + 1} · ${String(recording.steps[i]?.action || '').slice(0, 36)}`; stepNode.append(option); }
  }
  stepNode.value = String(recording?.current_step_index ?? 0);
  const step = recording?.steps?.[recording?.current_step_index ?? 0];
  stepActionNode.textContent = step?.action || '无';
  stepExpectedNode.textContent = step?.expected || '无';
  const next = recording?.steps?.[(recording?.current_step_index ?? 0) + 1];
  nextStepNode.textContent = next ? `下一步 ${(recording.current_step_index ?? 0) + 2}：${next.action || '未填写动作'}` : '当前已是最后一步。';
  stepNode.disabled = busy || Boolean(recording?.selection_mode) || !['PAUSED', 'RECORDING'].includes(status);
  actionsNode.replaceChildren();
  if (status === 'WAITING_LOGIN') { addButton('login-open', '打开登录浏览器', true); addButton('login-check', '检查登录'); }
  if (status === 'PAUSED') addButton('start', '开始记录', true);
  if (status === 'RECORDING') addButton('pause', '暂停', true);
  if (['PAUSED', 'RECORDING'].includes(status)) {
    addButton('pick-point', '断言点选'); addButton('pick-box', '断言框选');
    for (const button of actionsNode.querySelectorAll('[data-action^="pick-"]')) {
      button.title = '按原预期选择检查对象；录制中会先暂停';
      button.disabled = busy || Boolean(recording?.selection_mode);
    }
  }
  if (['PAUSED', 'RECORDING'].includes(status) && next) {
    addButton('next-step', '下一步');
    actionsNode.querySelector('[data-action="next-step"]').disabled = busy || Boolean(recording?.selection_mode);
  }
  if (active.has(status)) addButton('stop', '停止录制');
  closeNode.disabled = busy;
  noticeNode.textContent = notices[recording?.selection_notice] || (status === 'WAITING_LOGIN' ? `请先人工登录，再检查登录状态。${authReasons[recording?.auth_reason] || ''}` :
    recording?.selection_mode ? '请按原预期选择检查对象；选择完会保持暂停，可点暂停取消标记。' : '断言点选/框选仅记录检查对象，不改变原预期。');
  const nextFocus = focusedAction ? [...actionsNode.querySelectorAll('button')].find(button => button.dataset.action === focusedAction) :
    focusedId ? document.getElementById(focusedId) : null;
  if (nextFocus && !nextFocus.disabled) nextFocus.focus({ preventScroll: true });
  else if (focusedAction) statusNode.focus({ preventScroll: true });
};
const control = async (action, extra = {}) => {
  if (!base || busy || !recording || !active.has(recording.status)) return false;
  busy = true; render(); errorNode.textContent = '';
  try {
    recording = await request(`${base}/control`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    render(); return true;
  } catch (error) { showError(error); return false; }
  finally { busy = false; render(); }
};
actionsNode.addEventListener('click', event => {
  const name = event.target.closest('button[data-action]')?.dataset.action;
  if (!name) return;
  if (name === 'pick-point' || name === 'pick-box') {
    void (async () => {
      if (busy || recording?.selection_mode || !['PAUSED', 'RECORDING'].includes(recording?.status)) return;
      if (recording.status === 'RECORDING' && !await control('pause')) return;
      if (recording?.status !== 'PAUSED' || recording.selection_mode) return;
      await control('pick', { pick_mode: name === 'pick-box' ? 'box' : 'point' });
    })();
  } else if (name === 'next-step') {
    if (!busy && !recording?.selection_mode && ['PAUSED', 'RECORDING'].includes(recording?.status))
      void control('step', { step_index: (recording?.current_step_index ?? 0) + 1 });
  }
  else void control(name);
});
stepNode.addEventListener('change', () => {
  if (!busy && !recording?.selection_mode && ['PAUSED', 'RECORDING'].includes(recording?.status))
    void control('step', { step_index: Number(stepNode.value) });
});
closeNode.addEventListener('click', async () => {
  if (busy) return;
  if (recording?.status === 'RECORDING' && !await control('pause')) return;
  closed = true; window.close();
});
window.addEventListener('pagehide', () => {
  closed = true; clearTimeout(pollTimer);
  if (recording?.status === 'RECORDING' && base) {
    void fetch(`${base}/control`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'pause' }), keepalive: true }).catch(() => {});
  }
});
const poll = async () => {
  if (!base) { errorNode.textContent = '录制链接无效，请从工作台主窗口重新打开。'; return; }
  try {
    const next = await request(base);
    if (!busy && JSON.stringify(next) !== JSON.stringify(recording)) { recording = next; render(); }
  } catch (error) { showError(error); }
  if (!closed) pollTimer = setTimeout(poll, 1500);
};
void poll();
