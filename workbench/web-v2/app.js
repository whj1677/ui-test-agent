import { openScriptOperation, renderGeneration } from './script-actions.js';
import { openDemonstrationDialog } from './demonstrations.js';
import { renderReports } from './reports.js';
import { renderHistory } from './history.js';
import {renderModelSettings} from './model-settings.js';
import { openBatch, automationState, remedyHtml, batchHtml, reviewHtml, batchReasons, stateLabel, candidateReadiness, candidateOptionLabel, workspaceViewsHtml } from '/workspace/workflow.js';
import { executionSteps, displayFailureStep, stepResultLabel, stepOutcomeNotice, executionMediaUrl, executionDisplayStatus, executionMediaFiles, windowRecordingNoticeHtml, enhanceMedia } from '/workspace/execution-media.js';
import { executionIndexMeta } from '/workspace/execution-list.js';
import { ApiError, api, downloadPackage, uploadCaseFile } from '/workspace/api.js';
import { projectTargetsMarkup, targetCatalogMarkup, bindProjectTargets, requestCandidateTrialAuthorization } from './project-target-access.js';
import { renderProjectWorkflow } from './project-workflow.js';
import { renderProjectSetup } from './project-setup.js';
import { openCaseContentReview, pendingReviewItems } from './case-review.js';
import { renderBatchPage } from './batch-view.js';
import { loadNativeConsole, nativeConsoleModel, nativeScriptAvailability, nativeScriptsHtml, nativeRecordsHtml, bindNativeConsole } from './native-console-view.js';
import { executionNotesHtml, mountExecutionNotes } from './execution-notes.js';
import { renderCaseContent, loadCaseExecutionContext } from './case-content-view.js';
import { openCaseLifecycle, renderDeletedCases } from './case-lifecycle.js';

const state = {
  projects: [], projectsLoaded: false, project: null, serviceReady: false, error: null,
  query: '', module: '', status: '', page: 1, pageSize: 10,
  caseType: '', activeProjectId: null,
  selected: new Map(), importDrafts: new Map(), caseVersion: null,
  editing: null, environmentDirty: false, allowNavigation: false,
};
const app = document.querySelector('#app');
const loading = document.querySelector('#page-loading');
const breadcrumbs = document.querySelector('#breadcrumbs');
const sideNav = document.querySelector('.side-nav');
const modalRoot = document.querySelector('#modal-root');
const errorLabels = {
  WORKBENCH_UNREACHABLE: '无法连接工作台服务，请确认前台服务仍在运行。',
  WORKBENCH_RELOAD_REQUIRED: '正式工作台仍在运行旧版服务。请在无运行中任务时按原启动方式重启 4322 工作台，再刷新页面使用此功能。原有项目、用例和运行记录仍可查看。',
  CASE_PROJECT_REVISION_CONFLICT: '项目已在其他页面发生变化。当前草稿没有保存，请重新加载并核对。',
  CASE_DESIGN_REVIEW_REQUIRED: '此文件含PRD/MRD来源用例，只能在原项目中保留来源与审阅历史。跨项目导入暂不支持；请回到原项目使用，或在新项目导入原PRD/MRD重新设计用例。原项目内修改请从用例内容页创建修订稿。',
  CASE_DESIGN_REVISION_REASON_REQUIRED: '请填写修订原因，方便核对业务依据。',
  CASE_DESIGN_REVISION_TARGET_STALE: '当前用例版本已变化，请重新打开当前版本再创建修订稿。',
  REQUIREMENT_PROJECT_REVISION_CONFLICT: '项目已发生变化，请刷新并核对后再提交。',
  CASE_DESIGN_REVISION_SOURCE_UNVERIFIED: '原用例的资料来源尚未核验，不能创建修订稿。请先核对原设计与来源。',
  CASE_DESIGN_REVISION_REQUEST_CONFLICT: '这个提交标识已用于不同内容，请关闭弹窗、核对当前版本后重新创建。',
  CASE_IMPORT_PREVIEW_STALE: '预览后项目已发生变化。请保留当前文件与映射并重新生成预览。',
  CASE_UPLOAD_TYPE_UNSUPPORTED: '支持 .csv、.xlsx 和正式的 .json 用例包。',
  CASE_SCRIPT_PACKAGE_INVALID: '脚本包格式或用例内容绑定不匹配，未导入。请使用工作台重新导出的文件。',
  CASE_SCRIPT_FILE_MISMATCH: '脚本文件的大小或 SHA-256 不匹配，未导入。',
  CASE_SCRIPT_BUNDLE_MISMATCH: '脚本文件包校验失败，未导入。',
  CASE_SCRIPT_PATH_INVALID: '脚本包包含不支持的文件路径，未导入。',
  CASE_SCRIPT_EXPORT_SOURCE_UNAVAILABLE: '当前版本最新登记的脚本文件不可读取，无法完整导出；请先核对脚本来源。',
  CASE_SCRIPT_EXPORT_TOO_LARGE: '含脚本的文件包超过 10 MiB，请减少所选用例后分批导出。',
  CASE_UPLOAD_SIZE_INVALID: '文件为空或超过 10 MiB。',
  CASE_PACKAGE_SCHEMA_UNSUPPORTED: 'JSON 不是 workbench/case-package-v1 正式用例包；UI-D1 演示包不兼容。',
  CASE_PACKAGE_INVALID_JSON: 'JSON 文件无法解析。', CASE_EXCEL_MAPPING_REQUIRED: '必填字段映射不完整。',
  CASE_PROJECT_NOT_FOUND: '项目不存在或已不可用。', CASE_NOT_FOUND: '用例不存在或不属于当前项目。',
  BACKEND_EXECUTOR_NOT_CONFIGURED: '后端尚未配置当前用例版本的可运行 HTTP 计划，本次没有运行。',
  CASE_EXPORT_SELECTION_INVALID: '导出选择无效，请刷新后重新选择。', REQUEST_TOO_LARGE: '请求内容过大。',
  E2E01_CASE_NOT_AUTHORIZED: '本次试跑只允许来自已导入六案例的 TC-001、TC-002、TC-003。',
  E2E01_CASE_ENVIRONMENT_MISMATCH: '用例与预设演示入口不匹配。', E2E01_PAIRED_CASE_CONTENT_MISMATCH: '正常与故障用例正文并非同一业务预期，未创建建例任务。',
  E2E01_TRIAL_NOT_ALLOWED: '该任务不属于本次受控演示试跑。', E2E01_CANDIDATE_IDENTITY_MISMATCH: '候选版本已变化，请刷新任务详情。',
  E2E01_EXECUTION_CASE_NOT_ALLOWED: '执行目标超出此候选明确绑定的用例范围。', E2E01_TRIAL_AUTHORIZATION_INVALID: '演示试跑授权不匹配。',
  AUTH_BROWSER_EXECUTABLE_REQUIRED: '尚未配置受控浏览器，请检查工作台启动配置。',
  AUTH_ENVIRONMENT_ROLE_NOT_ALLOWED: '当前环境不允许这个账号角色。',
  AUTH_SESSION_REQUIRED: '需要先完成当前 UI 环境登录；请到项目测试环境设置页登录后再启动或复跑。',
  AUTH_SESSION_BLOCKED: '登录会话在活动期间失效，已停止关联操作；未执行的步骤不会补写，原始结果不被覆盖。',
  AUTH_BUILD_UNAVAILABLE: '工作台当前配置未启用登录建例能力。',
  AUTH01_TRIAL_NOT_ALLOWED: '该任务不属于 AUTH-01 登录建例闭环。',
  AUTH01_CANDIDATE_IDENTITY_MISMATCH: '候选版本已变化，请刷新任务详情。',
  AUTH01_CANDIDATE_FILE_CHANGED: '候选文件与登记哈希不一致，未执行。',
  AUTH01_ENVIRONMENT_REQUIRED: 'AUTH-01 限定授权只适用于登录演示环境。',
  AUTH01_AUTHORIZATION_REQUIRED: '登录演示环境的建例任务需要绑定 AUTH-01 限定授权。',
  TARGET_SCOPE_REQUEST_BLOCKED: '页面尝试访问登记路径范围以外的地址，已阻止；这是环境范围阻塞，不记为业务用例失败。',
  PROJECT_TRIAL_CANDIDATE_EXPIRED: '候选已过期；新脚本版本不继承旧授权，请为当前候选重新授权。',
  PROJECT_TARGET_CONFIGURATION_CHANGED: '被测环境配置已变化；请重新登记并为新环境候选单独授权。',
  PROJECT_TRIAL_ENVIRONMENT_NOT_USER_REGISTERED: '该候选不属于用户登记的项目环境，不能走自助授权。',
  PROJECT_ENVIRONMENT_NOT_CONFIGURED: '项目尚未配置所需测试环境；请到项目测试环境设置选择 UI 或 HTTP 环境。',
  PROJECT_ENVIRONMENT_MISMATCH: '所选脚本、示范或计划与项目当前测试环境不一致；历史记录不会自动切换，请检查项目测试环境设置。',
  PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED: '项目测试环境配置已变化，请刷新并到项目测试环境设置重新核对。',
  PROJECT_ENVIRONMENT_BUSY: '项目有运行任务正在使用测试环境，当前不能更改绑定；任务结束后再保存。',
  PROJECT_ENVIRONMENT_REVISION_CONFLICT: '项目测试环境已在其他页面发生变化；刷新本页并核对后重试。',
};
const mappingLabels = {
  external_id: '用例编号', title: '标题', case_type: '用例层级', module: '模块', preconditions: '前置条件', test_data: '测试数据',
  steps: '步骤', expected: '逐步预期', status: '内容状态',
};
const classificationLabels = { NEW: '新增', DUPLICATE: '重复', CONFLICT: '同源内容冲突', PENDING_CLARIFICATION: '待确认/待澄清', UNIMPORTABLE: '无法导入' };

function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]); }
function fmtDate(value) { if (!value) return '未知'; try { return new Intl.DateTimeFormat('zh-CN', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)); } catch { return String(value); } }
function short(value, length = 12) { return value ? `${String(value).slice(0, length)}…` : '未记录'; }
function currentContent(item) { return item?.versions?.find((version) => version.version === item.current_version)?.content || null; }
function route() {
  const raw = location.hash.slice(1) || '/projects';
  const [pathname, search = ''] = raw.split('?');
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  return { raw, parts, query: new URLSearchParams(search), projectId: parts[0] === 'projects' ? parts[1] : null };
}
function selection(projectId) { if (!state.selected.has(projectId)) state.selected.set(projectId, new Set()); return state.selected.get(projectId); }
function storedCaseType(item) { return currentContent(item)?.case_type || 'UNCLASSIFIED'; }
function toast(message, kind = '') { const node = document.querySelector('#toast'); node.textContent = message; node.className = `toast visible ${kind}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.className = 'toast'; }, 3600); }
function messageFor(error) { return errorLabels[error?.code || error?.message] || `操作失败：${error?.code || error?.message || 'UNKNOWN'}`; }
let loadedRequirementsUi = null;
async function loadWorkspaceModule(path) {
  let response;
  try { response = await fetch(path); }
  catch { throw new ApiError('WORKBENCH_UNREACHABLE', 0); }
  if (response.status === 404) throw new ApiError('WORKBENCH_RELOAD_REQUIRED', 503);
  if (!response.ok) throw new ApiError(`WORKBENCH_ASSET_HTTP_${response.status}`, response.status);
  return import(path);
}
async function loadRequirementsFeature() {
  const [ui, facade] = await Promise.all([
    loadWorkspaceModule('/workspace/requirements.js'),
    loadWorkspaceModule('/workspace/requirements-api.js'),
  ]);
  loadedRequirementsUi = ui;
  return { ui, requirementsApi: facade.requirementsApi };
}
async function loadCaseAssistantFeature() {
  const ui = await loadWorkspaceModule('/workspace/case-assistant.js');
  if (!document.querySelector('#case-assistant-styles')) {
    const link = document.createElement('link'); link.id = 'case-assistant-styles'; link.rel = 'stylesheet'; link.href = '/workspace/case-assistant.css'; document.head.append(link);
  }
  return ui;
}
let loadedBackendUi = null;
async function loadBackendFeature() {
  loadedBackendUi ||= await loadWorkspaceModule('/workspace/backend.js');
  Object.assign(batchReasons, loadedBackendUi.backendReasons);
  if (!document.querySelector('#backend-styles')) {
    const link = document.createElement('link'); link.id = 'backend-styles'; link.rel = 'stylesheet'; link.href = '/workspace/backend.css'; document.head.append(link);
  }
  return loadedBackendUi;
}
function createServiceHealthPoller({ read, apply, onError, shouldPause, getGeneration, intervalMs = 4000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let paused = true, stopped = false, inFlight = false, timer = null;
  const schedule = () => { if (!paused && !stopped && timer === null) timer = setTimer(poll, intervalMs); };
  async function poll() {
    timer = null;
    if (paused || stopped) return;
    if (shouldPause()) { schedule(); return; }
    if (inFlight) { schedule(); return; }
    inFlight = true;
    const generation = getGeneration();
    try {
      const value = await read();
      if (!paused && !stopped && !shouldPause() && generation === getGeneration()) apply(value);
    } catch (error) {
      if (!paused && !stopped && !shouldPause() && generation === getGeneration()) onError(error);
    } finally { inFlight = false; schedule(); }
  }
  return {
    start() { if (stopped) return; paused = false; schedule(); },
    pause() { paused = true; clearTimer(timer); timer = null; },
    resume() { if (stopped) return; paused = false; schedule(); },
    stop() { stopped = true; paused = true; clearTimer(timer); timer = null; },
  };
}

let serviceHealth = null;
let restartInProgress = false;
let serviceHealthGeneration = 0;
let serviceHealthRequest = null;
let serviceHealthAbort = null;
function setService(ok, error = null) {
  if (!ok) serviceHealth = null;
  const unavailable = serviceHealth && (serviceHealth.status !== 'ready' || serviceHealth.accepting === false);
  document.querySelector('.top-status').classList.toggle('error', !ok || Boolean(unavailable));
  document.querySelector('#service-label').textContent = !ok ? (error?.message === 'HEALTH_CHECK_TIMEOUT' ? '连接检查超时 · 正在重试' : '连接检查未通过 · 正在重试') : unavailable ? '服务已暂停接收新任务 · 请查看故障记录' : '服务就绪 · 真实后端';
  const versionLabel = document.querySelector('#workbench-version');
  const version = serviceHealth?.service_identity?.release?.version;
  if (versionLabel) versionLabel.textContent = version ? `版本 ${version}` : '版本待确认';
  updateRestartControl();
}
function updateRestartControl() {
  const button = document.querySelector('#service-restart');
  const status = document.querySelector('#service-restart-status');
  if (!button || !status) return;
  const restart = serviceHealth?.restart;
  const enabled = serviceHealth?.restart?.managed === true && serviceHealth?.restart?.available === true && !restartInProgress;
  button.disabled = !enabled;
  button.title = enabled ? '在没有运行中任务时重启工作台' : restart?.managed !== true ? '当前服务未由受控启动器管理' : restart?.reason || '当前不可重启';
  if (restartInProgress) status.textContent = '正在恢复服务…';
  else if (status.dataset.state === 'failed') status.textContent = status.dataset.message || '重启未完成';
  else if (!serviceHealth) status.textContent = '连接检查尚未通过，暂不可重启';
  else if (restart?.managed !== true) status.textContent = '未托管，无法从此处重启';
  else if (restart?.available !== true && restart?.reason) status.textContent = restart.reason;
  else if (status.dataset.state !== 'success') status.textContent = '';
}
async function readServiceHealth() {
  if (serviceHealthRequest) return serviceHealthRequest;
  const controller = new AbortController();
  serviceHealthAbort = controller;
  const timeout = setTimeout(() => controller.abort(), 4000);
  const request = api('/api/health', { signal:controller.signal }).catch(error => {
    if (controller.signal.aborted) throw new Error('HEALTH_CHECK_TIMEOUT');
    throw error;
  });
  const pending = request.finally(() => {
    clearTimeout(timeout);
    if (serviceHealthAbort === controller) serviceHealthAbort = null;
    if (serviceHealthRequest === pending) serviceHealthRequest = null;
  });
  serviceHealthRequest = pending;
  return pending;
}
async function refreshServiceHealth() {
  if (restartInProgress) return serviceHealth;
  const generation = serviceHealthGeneration;
  try {
    const health = await readServiceHealth();
    if (!restartInProgress && generation === serviceHealthGeneration) { serviceHealth = health; setService(true); }
    return serviceHealth;
  } catch (error) {
    if (restartInProgress || generation !== serviceHealthGeneration) return serviceHealth;
    setService(false, error); throw error;
  }
}
const serviceHealthPoller = createServiceHealthPoller({
  read:readServiceHealth,
  apply:health => { serviceHealth = health; setService(true); },
  onError:error => setService(false, error),
  shouldPause:() => restartInProgress,
  getGeneration:() => serviceHealthGeneration,
});
async function restartService() {
  if (restartInProgress || serviceHealth?.restart?.managed !== true || serviceHealth?.restart?.available !== true) return;
  if (isDirty()) { toast('请先保存或取消当前编辑，再重启工作台。', 'error'); return; }
  const identity = serviceHealth.service_identity;
  if (!identity?.service_instance_id || !identity.data_root_sha256 || !identity.configuration_sha256) {
    toast('服务身份信息不完整，无法安全发起重启。', 'error'); return;
  }
  if (!confirm('将重启工作台。内存中的登录会话需要重新连接，项目数据和配置会保留。确认重启？')) return;
  const status = document.querySelector('#service-restart-status');
  restartInProgress = true; status.dataset.state = 'pending'; status.textContent = '正在准备重启…'; updateRestartControl();
  serviceHealthGeneration++;
  serviceHealthPoller.pause();
  const staleHealthRequest = serviceHealthRequest;
  serviceHealthAbort?.abort();
  await staleHealthRequest?.catch(() => {});
  let restartModule;
  try { restartModule = await import('/workspace/service-restart.js'); }
  catch (error) {
    restartInProgress = false; status.dataset.state = 'failed'; status.dataset.message = '当前工作台版本不支持在线重启，请使用启动器更新。';
    status.textContent = status.dataset.message; updateRestartControl(); serviceHealthPoller.resume(); toast(status.dataset.message, 'error'); return;
  }
  status.textContent = '正在安排重启…'; updateRestartControl();
  try {
    status.textContent = '旧实例正在退出，等待新实例恢复…';
    serviceHealth = await restartModule.restartAndWait({
      previous: identity,
      postRestart: (serviceInstanceId, signal) => api('/api/service/restart', { ...jsonOptions({service_instance_id:serviceInstanceId}), signal }),
      getHealth: signal => api('/api/health', { signal }),
    });
    setService(true); status.dataset.state = 'success'; status.textContent = '工作台已恢复；内存登录会话需重新连接。';
    toast('工作台已由新实例恢复。');
    void render(true);
  } catch (error) {
    setService(false);
    status.dataset.state = 'failed'; status.dataset.message = error.message || messageFor(error);
    status.textContent = `重启未确认：${status.dataset.message}`;
    updateRestartControl();
  } finally {
    restartInProgress = false; serviceHealthGeneration++; updateRestartControl(); serviceHealthPoller.resume();
  }
}
document.querySelector('#service-restart')?.addEventListener('click', () => void restartService());
function setSidebarNavigation(project, section = 'projects') {
  const link = (label, href, active, extra = '', glyph = '') => `<a class="side-link ${extra}${active ? ' active' : ''}" data-nav href="${esc(href)}"${active ? ' aria-current="page"' : ''}>${glyph}${esc(label)}</a>`;
  sideNav.dataset.projectId = project?.project_id || '';
  if (!project) { sideNav.innerHTML = link('项目列表', '#/projects', true); return; }
  const base = `#/projects/${encodeURIComponent(project.project_id)}`;
  const resultRoutes=['execution-list','execution-records','batches','reports'];
  const settingRoutes=['auth','settings','environment-advanced','bindings'];
  const current=settingRoutes.includes(section)?'settings':resultRoutes.includes(section)?'results':'workbench';
  const children=items=>`<ul class="nav-children">${items.map(([key,label])=>`<li>${link(label,`${base}/${key}`,section===key)}</li>`).join('')}</ul>`;
  const icon=kind=>`<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${{work:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',cases:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/>',history:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',settings:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="9" cy="18" r="2" fill="white"/>'}[kind]}</svg></span>`;
  sideNav.innerHTML = `${link('← 全部项目','#/projects',false,'side-back')}<div class="side-project"><small>当前项目</small><strong title="${esc(project.name)}">${esc(project.name)}</strong><small>${project.cases.length} 条测试用例</small></div><div class="project-main-nav" aria-label="项目主要功能">${link('工作台',base,current==='workbench','',icon('work'))}${link('测试记录',`${base}/batches`,current==='results','',icon('history'))}</div><div class="project-settings-nav">${link('项目设置',`${base}/auth`,current==='settings','',icon('settings'))}</div>`;
}
function isDirty() { return Boolean(state.editing?.dirty || state.environmentDirty); }
function go(hash, force = false) {
  if (!force && isDirty() && !confirm('当前修改尚未保存，离开后草稿会丢失。是否继续？')) return false;
  state.editing = null; state.environmentDirty = false;
  if (location.hash === hash) { void render(); return true; }
  state.allowNavigation = true; location.hash = hash; return true;
}
window.addEventListener('beforeunload', (event) => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('click', (event) => { const link = event.target.closest('a[data-nav]'); if (!link) return; event.preventDefault(); go(link.getAttribute('href')); });

async function loadProjects() {
  const result = await api('/api/case-library/projects');
  state.projects = result.projects;
  state.projectsLoaded = true;
  setService(true);
  return state.projects;
}
async function loadProject(projectId) {
  const loaded = await api(`/api/case-library/projects/${encodeURIComponent(projectId)}`);
  if (route().projectId === projectId) state.project = loaded;
  const index = state.projects.findIndex((item) => item.project_id === projectId);
  if (index >= 0) state.projects[index] = loaded; else state.projects.unshift(loaded);
  return loaded;
}
async function mutate(path, options) {
  try { return await api(path, options); }
  catch (error) { if (error.code === 'WORKBENCH_UNREACHABLE') setService(false); throw error; }
}
function jsonOptions(body, method = 'POST') { return { method, headers: { 'content-type':'application/json' }, body: JSON.stringify(body) }; }

function projectTabs() { return ''; }
function setBreadcrumb(items) { breadcrumbs.innerHTML = items.map((item, index) => `${index ? '<span>/</span>' : ''}${item.href ? `<a data-nav href="${item.href}">${esc(item.label)}</a>` : `<strong>${esc(item.label)}</strong>`}`).join(''); }
let visiblePageRoute = null;
function showPage(html) {
  const changedRoute = visiblePageRoute !== location.hash;
  loading.hidden = true; app.hidden = false; app.innerHTML = html;
  visiblePageRoute = location.hash;
  if (changedRoute) window.scrollTo?.(0,0);
}
function showFatal(error) {
  loading.hidden = true; app.hidden = false; state.error = error; if(error.code==='WORKBENCH_UNREACHABLE')setService(false);
  setSidebarNavigation(null);
  showPage(`<section class="empty"><h2>无法读取真实数据</h2><p>${esc(messageFor(error))}</p><button class="button primary" id="retry">重新连接</button></section>`);
  document.querySelector('#retry')?.addEventListener('click', () => render(true));
}

function openModal({ title, body, confirmLabel = '确认', onConfirm }) {
  const previousFocus = document.activeElement;
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-close aria-label="关闭">×</button></header><div class="modal-body">${body}</div><footer><button class="button" data-close>取消</button><button class="button primary" id="modal-confirm">${esc(confirmLabel)}</button></footer></section></div>`;
  const close = () => { modalRoot.innerHTML = ''; previousFocus?.isConnected && previousFocus.focus(); };
  modalRoot.querySelector('.modal').addEventListener('keydown', event => {
    const busy = modalRoot.querySelector('#modal-confirm').disabled;
    if (event.key === 'Escape' && !busy) { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...modalRoot.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(node => !node.hidden && node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  modalRoot.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', close));
  modalRoot.querySelector('#modal-confirm').addEventListener('click', async () => {
    const invalid = [...modalRoot.querySelectorAll('input,textarea,select')].find(node => !node.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    const button = modalRoot.querySelector('#modal-confirm'); button.disabled = true;
    const closeButtons = [...modalRoot.querySelectorAll('[data-close]')]; closeButtons.forEach(node => { node.disabled = true; });
    try { await onConfirm(close); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; closeButtons.forEach(node => { node.disabled = false; }); }
  });
  (modalRoot.querySelector('input:not([type=hidden]),textarea,select') || modalRoot.querySelector('[data-close]')).focus();
}

const projectIndex = { query:'', filter:'all', sort:'updated', page:1, pageSize:10 };
const projectRecentCache = new Map();
function projectContentState(project) {
  if (!project.cases.length) return { key:'empty', label:'尚无用例', tone:'neutral' };
  const pending = project.cases.filter(item => item.status !== 'CONFIRMED').length;
  return pending ? { key:'pending', label:`${pending} 条待核对`, tone:'warning' } : { key:'confirmed', label:'内容已核对', tone:'success' };
}
function selectProjectPage(projects, options) {
  const query = options.query.trim().toLocaleLowerCase();
  const filtered = projects.filter(project => (!query || `${project.name} ${project.description || ''}`.toLocaleLowerCase().includes(query)) && (options.filter === 'all' || projectContentState(project).key === options.filter));
  filtered.sort((a,b) => {
    const diff = options.sort === 'name' ? a.name.localeCompare(b.name,'zh-CN',{numeric:true}) : options.sort === 'cases' ? b.cases.length-a.cases.length : String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    return diff || a.project_id.localeCompare(b.project_id);
  });
  const pages = Math.max(1,Math.ceil(filtered.length/options.pageSize));
  const page = Math.min(Math.max(1,options.page),pages);
  return { total:filtered.length, pages, page, items:filtered.slice((page-1)*options.pageSize,page*options.pageSize) };
}
function renderProjects() {
  setSidebarNavigation(null);
  setBreadcrumb([{ label:'项目' }]);
  const totalCases = state.projects.reduce((sum, project) => sum + project.cases.length, 0);
  const projectsNeedingReview = state.projects.filter(project => project.cases.some(item => item.status !== 'CONFIRMED')).length;
  showPage(`<section class="project-hero"><div class="project-hero-copy"><h1>项目</h1><p>管理测试，继续上次的工作。</p></div><button class="button primary" id="new-project">新建项目</button><div class="project-hero-stats" aria-label="项目汇总"><div><strong>${state.projects.length}</strong><span>个项目</span></div><div><strong>${totalCases}</strong><span>条测试用例</span></div><button type="button" id="project-pending-shortcut"><strong>${projectsNeedingReview}</strong><span>个项目待核对</span></button></div></section>
    <section class="project-library" aria-label="项目工作区"><div class="project-toolbar"><label class="search"><span class="sr-only">搜索项目</span><input id="project-search" type="search" value="${esc(projectIndex.query)}" placeholder="搜索项目名称或说明"></label><div class="project-controls"><label><span class="sr-only">项目状态</span><select id="project-filter"><option value="all">全部状态</option><option value="pending">待核对</option><option value="confirmed">内容已核对</option><option value="empty">尚无用例</option></select></label><label><span class="sr-only">项目排序</span><select id="project-sort"><option value="updated">最近更新</option><option value="name">项目名称</option><option value="cases">用例数量</option></select></label></div></div>
    <div class="project-columns" aria-hidden="true"><span>项目 / 内容状态</span><span>用例</span><span>最近运行</span><span>最近更新</span></div><div id="project-grid" class="project-grid"></div><div id="project-search-empty" class="empty" role="status" hidden><h2>没有匹配的项目</h2><p>换个关键词，或清除当前筛选。</p><button class="button" id="project-search-clear" type="button">清除筛选</button></div><nav class="pagination project-pagination" aria-label="项目分页"><span id="project-page-summary" role="status" aria-live="polite"></span><div><label class="project-page-size"><span class="sr-only">每页项目数量</span><select id="project-page-size"><option value="10">10 项 / 页</option><option value="20">20 项 / 页</option><option value="50">50 项 / 页</option></select></label><button class="button small" id="project-prev" type="button" aria-label="上一页项目">上一页</button><span id="project-page-number"></span><button class="button small" id="project-next" type="button" aria-label="下一页项目">下一页</button></div></nav></section><p class="project-history-link"><a data-nav href="#/history">查看历史记录与批准资产</a></p>`);
  const grid = document.querySelector('#project-grid');
  let disposed = false, generation = 0, controller = null;
  activeProjectDispose = () => { disposed = true; controller?.abort(); };
  const recentMarkup = value => {
    if (value.error) return '<span class="muted">读取失败</span><small>重新筛选可重试</small>';
    if (!value.record) return '<span class="muted">暂无运行记录</span>';
    const record = value.record, status = record.status || record.result || record.state || '';
    const labels = {PASSED:'运行通过',FAILED:'运行失败',TIMEDOUT:'运行超时',TIMED_OUT:'运行超时',RUNNING:'运行中',CANCELLED:'已取消',INTERRUPTED:'已中断',NOT_RUN:'未执行',BLOCKED:'已阻塞',PARTIAL:'部分完成',COMPLETED:'已完成'};
    const tone = status === 'PASSED' ? 'success' : ['FAILED','TIMEDOUT','TIMED_OUT'].includes(status) ? 'danger' : ['RUNNING','PARTIAL','BLOCKED','INTERRUPTED'].includes(status) ? 'warning' : 'neutral';
    return `<span class="badge ${tone}">${esc(labels[status] || '状态待核对')}</span><small>${esc(fmtDate(record.finished_at || record.started_at || record.created_at))}</small>`;
  };
  const loadRecent = async (items, token, signal) => {
    const queue = items.slice();
    await Promise.all(Array.from({length:Math.min(3,queue.length)},async () => {
      while (queue.length && !signal.aborted) {
        const project = queue.shift(), id = project.project_id;
        let value = projectRecentCache.get(id);
        if (!value || Date.now()-value.at > 30000) {
          const results = await Promise.allSettled([api(`/api/case-library/projects/${encodeURIComponent(id)}/execution-records`,{signal}),loadNativeConsole(project,api,{signal})]);
          if (signal.aborted) return;
          const legacy = results[0].status === 'fulfilled' ? results[0].value.records || [] : [];
          const native = results[1].status === 'fulfilled' && !results[1].value.load_error ? (results[1].value.records || []).filter(row => row.purpose === 'case' && row.counts_for_case === true && ['CURRENT','HISTORICAL'].includes(row.binding_status)) : [];
          const error = results[0].status !== 'fulfilled' || results[1].status !== 'fulfilled' || Boolean(results[1].value?.load_error);
          const records = [...legacy,...native].sort((a,b) => String(b.finished_at || b.started_at || b.created_at || '').localeCompare(String(a.finished_at || a.started_at || a.created_at || '')));
          value = {at:Date.now(),error,record:records[0]};
          if (!error) projectRecentCache.set(id,value);
        }
        if (disposed || token !== generation) return;
        const row = [...grid.querySelectorAll('[data-project-id]')].find(node => node.dataset.projectId === id);
        const target = row?.querySelector('.project-recent');
        if (target) target.innerHTML = recentMarkup(value);
      }
    }));
  };
  const paint = () => {
    controller?.abort(); controller = new AbortController();
    const token = ++generation;
    const result = selectProjectPage(state.projects,projectIndex); projectIndex.page = result.page;
    grid.innerHTML = result.items.map(project => {
      const content = projectContentState(project), href = `#/projects/${encodeURIComponent(project.project_id)}`;
      return `<article class="project-row" data-project-id="${esc(project.project_id)}"><div class="project-row-main"><h2><a data-nav href="${href}">${esc(project.name)}</a></h2><div class="project-row-context"><span class="badge ${content.tone}">${content.label}</span><p title="${esc(project.description || '')}">${esc(project.description || '暂无项目说明')}</p></div></div><div class="project-row-count"><strong>${project.cases.length}</strong><small>条用例</small></div><a class="project-recent" data-nav href="${href}/execution-list" aria-label="${esc(project.name)}：查看最近运行"><span class="muted">正在读取…</span></a><div class="project-row-updated"><time datetime="${esc(project.updated_at || '')}">${esc(fmtDate(project.updated_at))}</time><a data-nav href="${href}">进入项目<span class="row-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span></a></div></article>`;
    }).join('');
    if (!state.projects.length) grid.innerHTML = '<div class="empty"><h2>创建你的第一个测试项目</h2><p>点击上方“新建项目”，配置测试环境后准备测试用例。</p></div>';
    document.querySelector('#project-search-empty').hidden = Boolean(result.total) || !state.projects.length;
    document.querySelector('.project-columns').hidden = !result.total;
    document.querySelector('#project-page-summary').textContent = result.total ? `显示 ${(result.page-1)*projectIndex.pageSize+1}–${Math.min(result.page*projectIndex.pageSize,result.total)} 项，共 ${result.total} 项` : '共 0 项';
    document.querySelector('#project-page-number').textContent = `${result.page} / ${result.pages}`;
    document.querySelector('#project-prev').disabled = result.page === 1;
    document.querySelector('#project-next').disabled = result.page === result.pages;
    void loadRecent(result.items,token,controller.signal);
  };
  document.querySelector('#project-filter').value = projectIndex.filter;
  document.querySelector('#project-sort').value = projectIndex.sort;
  document.querySelector('#project-page-size').value = String(projectIndex.pageSize);
  paint();
  document.querySelector('#new-project').addEventListener('click', () => openModal({
    title:'新建项目', confirmLabel:'创建并进入',
    body:`<div class="form-grid"><label class="field wide"><span>项目名称</span><input id="new-name" maxlength="120" required></label><label class="field wide"><span>项目说明</span><textarea id="new-description" rows="4" maxlength="5000"></textarea></label></div>`,
    onConfirm: async (close) => {
      const project = await mutate('/api/case-library/projects', jsonOptions({ name: modalRoot.querySelector('#new-name').value, description: modalRoot.querySelector('#new-description').value }));
      state.projects.unshift(project); close(); toast('项目已创建，ID 与修订号来自后端。'); go(`#/projects/${encodeURIComponent(project.project_id)}`, true);
    },
  }));
  document.querySelector('#project-search').addEventListener('input', (event) => {
    projectIndex.query = event.target.value; projectIndex.page = 1; paint();
  });
  document.querySelector('#project-search-clear').addEventListener('click', () => {
    projectIndex.query = ''; projectIndex.filter = 'all'; projectIndex.page = 1;
    document.querySelector('#project-filter').value = 'all';
    const input = document.querySelector('#project-search'); input.value = ''; paint(); input.focus();
  });
  for (const [selector,key] of [['#project-filter','filter'],['#project-sort','sort'],['#project-page-size','pageSize']]) document.querySelector(selector).addEventListener('change',event => { projectIndex[key] = key === 'pageSize' ? Number(event.target.value) : event.target.value; projectIndex.page = 1; paint(); });
  document.querySelector('#project-pending-shortcut').addEventListener('click',() => { projectIndex.filter = 'pending'; projectIndex.page = 1; document.querySelector('#project-filter').value = 'pending'; paint(); document.querySelector('#project-filter').focus(); });
  document.querySelector('#project-prev').addEventListener('click',() => { projectIndex.page--; paint(); });
  document.querySelector('#project-next').addEventListener('click',() => { projectIndex.page++; paint(); });
}

async function renderProjectOverview(project) {
  const hash = location.hash;
  const id = encodeURIComponent(project.project_id);
  const [batchResult, recordResult, sourceResult, environmentResult, automationResult] = await Promise.allSettled([
    api(`/api/case-library/projects/${id}/batches`),
    api(`/api/case-library/projects/${id}/execution-records`),
    api(`/api/case-library/projects/${id}/requirements/sources`),
    api(`/api/case-library/projects/${id}/environment`),
    loadAutomationReadiness(project),
  ]);
  if (location.hash !== hash || route().projectId !== project.project_id) return;
  const batches = batchResult.status === 'fulfilled' ? (batchResult.value.batches || []).filter(item => item.state !== 'PREVIEW') : null;
  const latest = batches?.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
  const records = recordResult.status === 'fulfilled' ? recordResult.value.records || [] : null;
  const sources = sourceResult.status === 'fulfilled' ? sourceResult.value.sources || [] : null;
  const sourceNeedsReload = sourceResult.status === 'rejected' && sourceResult.reason?.status === 404;
  const count = type => project.cases.filter(item => storedCaseType(item) === type).length;
  const base = `#/projects/${id}`;
  const batchCount = state => latest?.items?.filter(item => item.state === state).length || 0;
  const confirmed = project.cases.filter(item => currentContent(item)?.status === 'CONFIRMED').length;
  const prepared = automationResult.status === 'fulfilled' ? automationResult.value.filter(item => !item.reason).length : null;
  const environment = environmentResult.status === 'fulfilled' ? environmentResult.value : null;
  const needsEnvironment = environment && ((count('UI') && environment.ui_status !== 'CONFIGURED') || (count('BACKEND') && environment.backend_status !== 'CONFIGURED'));
  const currentResults = records ? project.cases.filter(item => records.some(record => record.executed_case_id === item.case_id && Number(record.executed_case_version) === Number(item.current_version))).length : null;
  const next = !project.cases.length
    ? { index:0, title:sources?.length ? '资料已就位，开始设计用例' : '从准备资料开始', text:'上传需求和协议，或导入已有测试用例。', href:`${base}/requirements`, action:'准备资料与用例' }
    : confirmed < project.cases.length
      ? { index:1, title:'核对待确认的用例', text:`${project.cases.length - confirmed} 条用例内容待确认。`, href:`${base}/cases?status=PENDING_CONFIRMATION`, action:'核对用例' }
      : needsEnvironment
        ? { index:2, title:'先配置本项目的测试环境', text:'保存一次，后续生成与执行自动使用本项目环境。', href:`${base}/auth`, action:'配置项目环境' }
        : prepared === project.cases.length
          ? currentResults === project.cases.length
            ? { index:3, title:'查看当前用例的执行结果', text:'结果保留实际失败和未完成状态；不同批次不合并为一次验收。', href:`${base}/execution-list`, action:'查看结果' }
            : { index:2, title:'自动化已准备，可以检查运行范围', text:`${prepared} 条用例可进入运行检查；确认范围后才会执行。`, href:`${base}/cases`, action:'选择用例并运行' }
          : { index:2, title:'继续准备自动化', text:prepared === null ? '打开准备清单，重新读取每条用例的运行条件。' : `${prepared} 条可进入运行检查，${project.cases.length - prepared} 条仍需准备。`, href:`${base}/automation`, action:'继续准备自动化' };
  const journey = [
    ['准备资料',sources ? `${sources.length} 份资料` : '资料状态未取得','requirements'],
    ['确认用例',`${confirmed} / ${project.cases.length} 条已确认`,'cases'],
    ['准备并运行',prepared === null ? '准备状态未取得' : `${prepared} 条可检查运行`,'automation'],
    ['查看结果',currentResults === null ? '结果未取得' : `${currentResults} 条当前版本有记录`,'execution-list'],
  ];
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name }]);
  showPage(`<div class="page-heading"><div><h1>${esc(project.name)}</h1><p>按步骤完成一次测试；环境在项目中配置一次即可。</p></div><a class="button" data-nav href="${base}/auth">项目环境</a></div>
    <section class="automation-next-step" aria-label="建议下一步"><div><strong>${esc(next.title)}</strong><p>${esc(next.text)}</p></div><a class="button primary" data-nav href="${next.href}">${next.action} →</a></section>
    <ol class="project-journey" aria-label="项目测试流程">${journey.map(([title,note,path],index)=>`<li${index===next.index?' class="current"':''}><a data-nav href="${base}/${path}"><span class="journey-number" aria-hidden="true">${index+1}</span><span><strong>${title}</strong><small>${esc(note)}</small></span></a></li>`).join('')}</ol>
    <section class="summary-strip project-overview-metrics"><div><span>已存资料</span><strong>${sources ? sources.length : '未取得'}</strong></div><div><span>前端用例</span><strong>${count('UI')}</strong></div><div><span>后端用例</span><strong>${count('BACKEND')}</strong></div><div><span>未分类用例</span><strong>${count('UNCLASSIFIED')}</strong></div><div><span>运行记录</span><strong>${records ? records.length : '未取得'}</strong></div></section>
    <section class="panel"><div class="panel-header"><h2>最近测试批次</h2><a class="button small" data-nav href="${base}/execution-list${latest ? `?batch_id=${encodeURIComponent(latest.batch_id)}` : ''}">查看执行列表</a></div><div class="panel-body">${latest ? `<p><strong>${esc(fmtDate(latest.created_at))}</strong> · ${esc(latest.software_version || '软件版本未提供')} · ${esc(stateLabel(latest.state))}</p><p>本批请求 ${latest.items.length} 条；执行结束 ${batchCount('FINISHED')}、执行中 ${batchCount('RUNNING')}、排队 ${batchCount('QUEUED')}、阻塞 ${batchCount('BLOCKED')}、已取消 ${batchCount('CANCELLED')}、未执行 ${batchCount('NOT_RUN')}。本批通过 ${latest.items.filter(item=>item.result==='PASSED').length}、失败 ${latest.items.filter(item=>['FAILED','TIMEDOUT'].includes(item.result)).length}。这些数字只属于本批。</p>` : `<p>${batches ? '本项目尚无正式测试批次。' : '批次数据未取得，请稍后重试。'}</p>`}</div></section>
    <details class="workflow-details"><summary>其他入口与项目说明</summary><p>${esc(project.description || '暂无项目说明')}</p><div class="project-overview-links"><a class="button" data-nav href="${base}/import">导入已有用例</a><a class="button" data-nav href="${base}/bindings">协议绑定</a><a class="button" data-nav href="${base}/reports">导出报告</a><a class="button" data-nav href="${base}/settings">项目设置</a></div></details>
    ${!project.cases.length ? '<p class="notice">新项目可先导入 PRD/MRD 设计前后端用例，也可直接导入已有 Excel/CSV/JSON 用例。资料和用例确认分别进行。</p>' : ''}
    ${sourceNeedsReload ? `<p class="notice warning">${esc(errorLabels.WORKBENCH_RELOAD_REQUIRED)}</p>` : ''}
    <p class="muted">生成、确认与执行分别操作，实际结果在“执行结果”中查看。</p>`);
}

function filteredCases(project) {
  return project.cases.filter((item) => {
    const content = currentContent(item); const query = state.query.toLocaleLowerCase();
    return (!query || `${item.external_id} ${item.title}`.toLocaleLowerCase().includes(query)) && (!state.module || item.module === state.module) && (!state.status || content?.status === state.status) && (!state.caseType || storedCaseType(item) === state.caseType);
  });
}
async function loadAutomationReadiness(project) {
  if (project.cases.some(item => storedCaseType(item) === 'BACKEND')) await loadBackendFeature();
  const data = await Promise.all(project.cases.map(item => api(`/api/case-library/projects/${project.project_id}/cases/${item.case_id}/automation?version=${item.current_version}`)));
  return project.cases.map((item, index) => ({ item, ...automationState(data[index]) }));
}

function automationStatusText({ item, reason, chosen }) {
  const backendLabels = { SCRIPT_MISSING:'尚无后端执行计划', CASE_VERSION_NOT_APPLICABLE:'执行计划不适用于此用例版本', SCRIPT_SELECTION_REQUIRED:'存在多个执行计划，请明确选择版本' };
  if (reason) return (storedCaseType(item) === 'BACKEND' && backendLabels[reason]) || batchReasons[reason] || reason;
  return chosen ? candidateReadiness(chosen).label : '当前不可运行';
}

async function renderAutomation(project, show) {
  const expectedHash = location.hash;
  const readiness = await loadAutomationReadiness(project);
  if (location.hash !== expectedHash) return;
  const base = `#/projects/${encodeURIComponent(project.project_id)}`;
  const ready = readiness.filter(item => !item.reason).length;
  const rows = readiness.map(({ item, reason, chosen }) => {
    const type = storedCaseType(item);
    const confirmed = currentContent(item)?.status === 'CONFIRMED';
    const tab = confirmed && type !== 'UNCLASSIFIED' ? 'scripts' : 'content';
    const href = `${base}/cases/${encodeURIComponent(item.case_id)}?version=${item.current_version}&tab=${tab}&return=${encodeURIComponent(`${base}/automation`)}`;
    const action = !confirmed ? '确认用例内容' : type === 'BACKEND' ? '准备后端计划' : type === 'UI' ? '准备 UI 脚本' : '核对用例类型';
    const status = automationStatusText({ item, reason, chosen });
    const directGenerate = type === 'UI' && confirmed && reason === 'SCRIPT_MISSING';
    return `<tr><td><strong>${esc(item.title)}</strong><small>${esc(item.external_id)}</small></td><td>${type === 'BACKEND' ? '后端 HTTP' : type === 'UI' ? '前端 UI' : '未分类'}<small>用例 v${item.current_version}</small></td><td>${esc(status)}</td><td>${directGenerate ? `<button class="button small" data-prepare-ui="${esc(item.case_id)}">生成脚本</button>` : `<a class="button small" data-nav href="${esc(href)}">${!reason && confirmed ? (type === 'BACKEND' ? '查看执行计划' : '查看脚本') : action}</a>`}</td></tr>`;
  }).join('');
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:base},{label:'准备并运行'}]);
  show(`<div class="page-heading"><div><h1>准备并运行</h1><p>按每条用例的“下一步”操作，准备好后检查范围并运行。</p></div><div class="actions"><a class="button" data-nav href="${base}/cases">选择运行范围</a><button class="button${ready ? ' primary' : ''}" id="automation-run" ${project.cases.length ? '' : 'disabled'}>检查并运行项目</button></div></div>
    <div class="workflow-links"><span>沿用项目固定环境</span><a data-nav href="${base}/auth">查看环境</a><a data-nav href="${base}/bindings">后端协议绑定</a><a data-nav href="${base}/generation">生成记录</a></div>
    <section class="panel automation-checklist"><div class="panel-header"><h2>用例准备清单</h2><span class="muted">${project.cases.length} 条用例 · 可进入技术试跑 ${ready} 条 · 待处理 ${project.cases.length - ready} 条</span></div><div class="panel-body">${rows ? `<div class="table-wrap"><table><thead><tr><th>用例</th><th>类型 / 内容版本</th><th>当前准备状态</th><th>下一步</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty"><h2>先准备测试用例</h2><p>上传资料并与 AI 对话设计用例，或导入已有用例。</p><a class="button primary" data-nav href="${base}/requirements">AI 用例助手</a><a class="button" data-nav href="${base}/import">导入用例</a></div>`}</div></section>
    <p class="muted">生成脚本需要单独授权；运行使用已有脚本或已确认计划。准备状态不代表测试已通过。</p>`);
  document.querySelector('#automation-run')?.addEventListener('click',()=>void launchBatch(project,'project',[]));
  document.querySelectorAll('[data-prepare-ui]').forEach(button=>button.addEventListener('click',()=>{
    const item=project.cases.find(value=>value.case_id===button.dataset.prepareUi);
    if(item)void openScriptOperation({project,items:[{case_id:item.case_id,case_version:item.current_version,external_id:item.external_id}],mode:'generate',go,onError:error=>toast(messageFor(error),'error')});
  }));
}

async function renderCases(project) {
  const changeLifecycle = (ids, restore = false) => {
    try { openCaseLifecycle({project,ids,restore,openModal,mutate,jsonOptions,onChanged:updated=>{
      state.project=updated;
      const selected=selection(project.project_id);ids.forEach(id=>selected.delete(id));
      toast(restore?'用例已恢复。':'用例已移到“已删除”，可随时恢复。');
      const query=new URLSearchParams(route().query);query.delete('selected');
      go(`#/projects/${project.project_id}/cases?${query}`,true);
    }}); } catch(error) { toast(error.message,'error'); }
  };
  if (route().query.get('deleted') === '1') {
    setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}/cases`},{label:'已删除的用例'}]);
    return renderDeletedCases({project,showPage,onRestore:id=>changeLifecycle([id],true)});
  }

  const q=route().query;state.query=q.get('q')||'';state.module=q.get('module')||'';state.status=q.get('status')||'';state.caseType=['UI','BACKEND','UNCLASSIFIED'].includes(q.get('type'))?q.get('type'):'';state.page=Math.max(1,Number(q.get('page'))||1);
  const focused=document.activeElement?.id,caret=document.activeElement?.selectionStart;
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}` }, { label:'工作台', href:`#/projects/${encodeURIComponent(project.project_id)}` }, { label:'用例' }]);
  const filtered = filteredCases(project); const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize)); state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize; const pageItems = filtered.slice(start, start + state.pageSize); const selected = selection(project.project_id);
  if(q.has('selected')){selected.clear();const requested=new Set((q.get('selected') || '').split(','));project.cases.filter(item=>requested.has(item.case_id)).forEach(item=>selected.add(item.case_id));}
  else if(q.get('review')==='all'){selected.clear();filtered.forEach(item=>selected.add(item.case_id));}
  const modules = [...new Set(project.cases.map((item) => item.module).filter(Boolean))].sort();
  const confirmed = project.cases.filter((item) => currentContent(item)?.status === 'CONFIRMED').length;
  const rows = pageItems.map((item) => {
    const content = currentContent(item); const checked = selected.has(item.case_id) ? 'checked' : '';
    return `<tr data-case-id="${esc(item.case_id)}"><td><input class="checkbox case-check" type="checkbox" aria-label="选择 ${esc(item.external_id)}" ${checked}></td>
      <td><button class="case-link" data-open-case="${esc(item.case_id)}"><strong>${esc(item.external_id)}</strong><span>${esc(item.title)}</span><small>${esc(item.module || '未分模块')}</small></button></td><td>${esc(storedCaseType(item)==='UNCLASSIFIED'?'未分类':storedCaseType(item)==='BACKEND'?'后端':'前端')}</td>
      <td><span class="badge ${content?.status === 'CONFIRMED' ? 'success' : 'warning'}">${content?.status === 'CONFIRMED' ? '内容已确认' : '内容待确认'}</span></td>
      <td><a data-nav href="#/projects/${project.project_id}/cases/${item.case_id}?version=${item.current_version}&tab=content">查看用例</a> <button class="button small" data-delete-case="${esc(item.case_id)}" aria-label="删除用例 ${esc(item.external_id)}">删除</button></td></tr>`;
  }).join('');
  showPage(`<div class="page-heading"><div><h1>${esc(project.name)}</h1><p>在同一工作台管理用例、生成脚本并运行测试。</p></div><div class="actions"><a class="button${!project.cases.length ? ' primary' : ''}" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/requirements">AI 用例助手</a><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/import">导入用例</a><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases?deleted=1">已删除（${(project.deleted_cases||[]).length}）</a></div></div>
    ${workspaceViewsHtml(project,'cases',[...selected])}<p class="muted">用例页管理测试步骤、预期与正文确认；切换“脚本与运行”可批量生成和执行。</p>
    <p class="case-library-summary">共 ${project.cases.length} 条 · 内容已确认 ${confirmed} 条 · 待核对 ${project.cases.length-confirmed} 条</p>
    <section class="panel"><div class="panel-header"><h2>项目用例</h2><span class="muted">每页10条，选择跨页保留</span></div><div class="panel-body">
      <div class="table-toolbar"><div class="filters"><label class="search"><span class="sr-only">搜索用例</span><input id="case-search" value="${esc(state.query)}" placeholder="按编号或标题搜索"></label>
        <select id="module-filter" aria-label="模块筛选"><option value="">全部模块</option>${modules.map((value) => `<option ${value === state.module ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select>
        <select id="status-filter" aria-label="内容状态筛选"><option value="">全部内容状态</option><option value="CONFIRMED" ${state.status === 'CONFIRMED' ? 'selected' : ''}>内容已确认</option><option value="PENDING_CONFIRMATION" ${state.status === 'PENDING_CONFIRMATION' ? 'selected' : ''}>内容待确认</option></select><select id="type-filter" aria-label="用例类型筛选"><option value="">全部类型</option><option value="UI" ${state.caseType==='UI'?'selected':''}>前端 UI</option><option value="BACKEND" ${state.caseType==='BACKEND'?'selected':''}>后端</option><option value="UNCLASSIFIED" ${state.caseType==='UNCLASSIFIED'?'selected':''}>未分类用例</option></select></div>
        <div class="actions"><button class="button small" id="export-selected" ${selected.size ? '' : 'disabled'}>导出所选（${selected.size}）</button><button class="button small" id="export-all" ${project.cases.length ? '' : 'disabled'}>导出全部</button></div></div>
      <p class="muted">导出包含当前用例版本已登记的 DSH 脚本与公共依赖；JSON 文件包可随用例导入，历史运行结果与批准不会随包生效。</p>
      <p id="export-feedback" class="notice" hidden></p>
      <p class="selection-note">已选 ${selected.size} 条 · 跨页保留，其中 ${[...selected].filter(id=>!filtered.some(c=>c.case_id===id)).length} 条不在当前筛选中。<button class="button small" id="select-filtered" ${filtered.length?'':'disabled'}>选择全部筛选结果（${filtered.length}）</button><button class="button small" id="clear-selection">清空选择</button><button class="button small" id="delete-selected" ${selected.size?'':'disabled'}>删除所选（${selected.size}）</button><button class="button primary" id="confirm-selected-content" ${pendingReviewItems(project,[...selected]).length?'':'disabled'}>批量核对所选用例（${pendingReviewItems(project,[...selected]).length}）</button></p>
      ${project.cases.length ? `<div class="table-wrap"><table><thead><tr><th><input id="page-select" class="checkbox" type="checkbox" aria-label="选择当前页"></th><th>编号 / 标题</th><th>类型</th><th>内容状态</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="5">当前筛选无结果</td></tr>'}</tbody></table></div>
      <div class="pagination"><span>第 ${state.page} / ${pageCount} 页，共 ${filtered.length} 条</span><div><button class="button small" id="prev-page" ${state.page <= 1 ? 'disabled' : ''}>上一页</button><button class="button small" id="next-page" ${state.page >= pageCount ? 'disabled' : ''}>下一页</button></div></div>` : '<div class="empty"><h2>暂无用例</h2><p>上传 Excel 或平台 JSON 包，预览确认后才会写入项目。</p></div>'}
    </div></section>`);
  const rerender = () => { const q=new URLSearchParams();const back=route().query.get('return');if(back)q.set('return',back);q.set('selected',[...selected].join(','));if(state.query)q.set('q',state.query);if(state.module)q.set('module',state.module);if(state.status)q.set('status',state.status);if(state.caseType)q.set('type',state.caseType);q.set('page',state.page);history.replaceState(null,'',`#/projects/${project.project_id}/cases?${q}`);return renderCases(project); };
  document.querySelector('#clear-selection').onclick=()=>{selected.clear();void rerender();};
  document.querySelector('#delete-selected').onclick=()=>changeLifecycle([...selected]);
  document.querySelectorAll('[data-delete-case]').forEach(button=>button.addEventListener('click',()=>changeLifecycle([button.dataset.deleteCase])));
  document.querySelector('#select-filtered').onclick=()=>{selected.clear();filtered.forEach(item=>selected.add(item.case_id));void rerender();};
  const reviewContent=ids=>{const reviewRoute=route().raw;return openCaseContentReview({project,ids,onError:error=>toast(error.message,'error'),isCurrent:()=>state.activeProjectId===project.project_id && route().raw===reviewRoute,onConfirmed:updated=>{state.project=updated;const back=q.get('return');if(back?.startsWith(`#/projects/${project.project_id}`)){const [path,search='']=back.split('?');const params=new URLSearchParams(search);if(!params.get('selected'))params.set('selected',[...selected].join(','));go(`${path}?${params}`);}else void renderCases(updated);}});};
  document.querySelector('#confirm-selected-content').onclick=()=>void reviewContent([...selected]);
  if(q.get('review')==='all'){
    const clean=new URLSearchParams(q);clean.delete('review');history.replaceState(null,'',`#/projects/${project.project_id}/cases?${clean}`);
    const requested=q.get('selected')?new Set(q.get('selected').split(',')):null;
    void reviewContent(filtered.filter(item=>!requested || requested.has(item.case_id)).map(item=>item.case_id));
  }
  if(focused==='case-search'){const input=document.getElementById(focused);input.focus();if(caret!==null)input.setSelectionRange(caret,caret);}
  document.querySelector('#case-search')?.addEventListener('input', (event) => { state.query = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#module-filter')?.addEventListener('change', (event) => { state.module = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#status-filter')?.addEventListener('change', (event) => { state.status = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#type-filter')?.addEventListener('change', (event) => { state.caseType = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#prev-page')?.addEventListener('click', () => { state.page -= 1; rerender(); }); document.querySelector('#next-page')?.addEventListener('click', () => { state.page += 1; rerender(); });
  document.querySelectorAll('[data-open-case]').forEach((button) => button.addEventListener('click', () => go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(button.dataset.openCase)}?tab=content&return=${encodeURIComponent(location.hash)}`)));
  document.querySelectorAll('.case-check').forEach((checkbox) => checkbox.addEventListener('change', () => { const id = checkbox.closest('tr').dataset.caseId; checkbox.checked ? selected.add(id) : selected.delete(id); rerender(); }));
  document.querySelector('#page-select')?.addEventListener('change', (event) => { for (const item of pageItems) event.target.checked ? selected.add(item.case_id) : selected.delete(item.case_id); rerender(); });
  document.querySelector('#export-selected')?.addEventListener('click', () => void exportCases(project, [...selected]));
  document.querySelector('#export-all')?.addEventListener('click', () => void exportCases(project, null));
}

async function exportCases(project, ids) {
  if (Array.isArray(ids) && !ids.length) return toast('请先选择至少一条用例。', 'error');
  try {
    const { blob, name } = await downloadPackage(project.project_id, ids);
    const pkg = JSON.parse(await blob.text());
    const scripts = pkg.cases.reduce((n,item)=>n+(item.script_packages?.length||0),0);
    const feedback = document.querySelector('#export-feedback');
    if (feedback) {
      const href = `/api/case-library/projects/${encodeURIComponent(project.project_id)}/export${ids ? `?case_ids=${ids.map(encodeURIComponent).join(',')}` : ''}`;
      feedback.hidden=false;feedback.innerHTML=`已导出 ${pkg.cases.length} 条用例、${scripts} 份脚本（含依赖）。<a href="${esc(href)}" download="${esc(name)}">再次下载此范围文件包</a>`;
    }
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast(`已请求下载${ids ? `选中的 ${ids.length} 条` : `全部 ${project.cases.length} 条`}用例及其当前已登记脚本、公共依赖；无脚本的用例仍保留。`);
  } catch (error) { toast(messageFor(error), 'error'); }
}

function draftFor(projectId) { if (!state.importDrafts.has(projectId)) state.importDrafts.set(projectId, { upload:null, preview:null, result:null, busy:false }); return state.importDrafts.get(projectId); }
function originalSourceFieldsHtml(rootSource) {
  const fields = rootSource?.source_fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length) return '';
  return `<details class="import-source-fields"><summary>原表信息（实际结果仅为历史记录）</summary><p class="muted">以下内容按原表保留，不代表本次测试结果或内容确认状态。</p><dl>${Object.entries(fields).map(([header, value]) => `<div><dt>${esc(header)}</dt><dd class="preserve-text">${esc(typeof value === 'object' && value !== null ? JSON.stringify(value) : value)}</dd></div>`).join('')}</dl></details>`;
}
function importMappingIssueText(issue) {
  if (typeof issue === 'string') return issue;
  if (!issue || typeof issue !== 'object') return '存在未确定的列，请手动核对。';
  const field = mappingLabels[issue.field] || issue.field || '字段';
  if (issue.code === 'MAPPING_AMBIGUOUS') return `${field}对应多个原表列（${(issue.headers || []).join('、')}），请手动选择。`;
  if (issue.code === 'MAPPING_REQUIRED') return `未识别${field}，请手动选择对应列。`;
  if (issue.code === 'MAPPING_HEADER_CONFLICT') return `原表列“${issue.header || ''}”同时匹配${(issue.fields || []).map(value => mappingLabels[value] || value).join('、')}，请核对列对应关系。`;
  return issue.message || issue.code || '存在未确定的列，请手动核对。';
}
function importMappingSummary(mapping, sheet) {
  const required = ['external_id', 'title', 'steps'];
  const matched = required.filter(field => mapping[field]);
  return `<div class="notice ${matched.length === required.length ? '' : 'warning'}"><strong>${matched.length === required.length ? '必需列已识别' : `还需选择 ${required.filter(field => !mapping[field]).map(field => mappingLabels[field]).join('、')}`}</strong><p>${esc(sheet?.row_count ?? 0)} 行 · ${matched.length}/${required.length} 个必需列已对应</p><p>${required.map(field => `${esc(mappingLabels[field])} ← ${esc(mapping[field] || '尚未选择')}`).join('；')}</p>${!mapping.expected ? '<p>逐步预期尚未对应；缺失的预期会保留待确认。</p>' : ''}</div>`;
}
function renderImport(project) {
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:'导入用例' }]);
  const draft = draftFor(project.project_id); const stage = draft.result ? 4 : draft.preview ? 3 : draft.upload ? 2 : 1;
  const nativeWorkbook = draft.upload?.workbook_export_format === 'workbench/case-xlsx-v1';
  const progress = ['选文件',nativeWorkbook?'来源核对与预览':'识别与预览','确认导入','结果'].map((label, index) => `<li class="${stage === index + 1 ? 'active' : stage > index + 1 ? 'done' : ''}"><span>${index + 1}</span>${label}</li>`).join('');
  let body = '';
  if (stage === 1) body = `<div class="dropzone"><div><h2>选择测试用例文件</h2><p class="muted">支持 CSV、Excel（.xlsx）和平台用例包（.json），最大 10 MiB。上传后先预览，再确认导入。</p><input id="import-file" type="file" accept=".csv,.xlsx,.json"><div class="actions center-actions"><button class="button primary" id="upload-file" disabled>上传并读取</button><a class="button" href="/workspace/test-case-template.xlsx" download="测试用例模板.xlsx">下载用例模板</a></div></div></div>`;
  if (stage === 2) body = renderMappingStage(draft);
  if (stage === 3) body = renderPreviewStage(draft.preview);
  if (stage === 4) body = `<div class="empty"><h2>导入确认已完成</h2><p>本次新增 ${draft.result.result.added} 条；重复跳过 ${draft.result.result.skipped_duplicate} 条；冲突跳过 ${draft.result.result.skipped_conflict} 条；无法导入跳过 ${draft.result.result.skipped_unimportable} 条。</p><p>登记脚本 ${draft.result.result.scripts_added || 0} 份（含依赖）；未新增脚本 ${draft.result.result.scripts_skipped || 0} 份。导入稿件均为“未执行、未首审”，不计用例通过。</p><div class="actions center-actions"><button class="button" id="import-another">继续导入</button><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/automation?type=UI">查看脚本与运行</a><a class="button primary" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases">返回用例</a></div></div>`;
  showPage(`<div class="page-heading"><div><p class="eyebrow">REAL FILE IMPORT</p><h1>导入用例</h1><p>项目：${esc(project.name)} · 确认前不会写入新用例</p></div><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases">退出导入</a></div>
    ${projectTabs(project, '')}<ol class="wizard-progress">${progress}</ol><section class="panel"><div class="panel-body">${body}</div></section>`);
  bindImport(project, draft, stage);
}
function renderMappingStage(draft) {
  const upload = draft.upload;
  const facts = `<div class="file-facts"><div><small>文件</small><strong>${esc(upload.file_name)}</strong></div><div><small>大小</small><strong>${Math.ceil(upload.bytes / 1024)} KiB</strong></div><div><small>SHA-256</small><strong class="mono">${esc(short(upload.sha256, 16))}</strong></div></div>`;
  if (upload.source_type === 'case-package') return `${facts}<div class="notice">已识别正式原生包 ${esc(upload.package.package_id)}，包含 ${upload.package.case_count} 条。JSON 包无需工作表映射。</div><div class="actions"><button class="button" id="replace-file">换文件</button><button class="button primary" id="create-preview">预览用例</button></div>`;
  if (upload.workbook_export_format === 'workbench/case-xlsx-v1') return `${facts}<div class="notice">已识别本工作台导出的 Excel。预览时会自动核对原类型、版本、来源及可见内容，无需手工列映射；如文件已改动，会提示重新核对。</div><div class="actions"><button class="button" id="replace-file">换文件</button><button class="button primary" id="create-preview">预览用例</button></div>`;
  const sheets = upload.workbook?.sheets || []; const selectedSheet = draft.sheet || sheets[0]?.name || ''; const sheet = sheets.find((item) => item.name === selectedSheet) || sheets[0];
  const headers = sheet?.headers || [];
  const suggested = sheet?.suggested_mapping;
  const mapping = draft.mapping || Object.fromEntries(Object.entries(mappingLabels).map(([field, label]) => [field,
    suggested && typeof suggested === 'object' ? (headers.includes(suggested[field]) ? suggested[field] : '') : (headers.includes(label) ? label : '')]));
  draft.sheet = sheet?.name; draft.mapping = mapping;
  const issues = Array.isArray(sheet?.mapping_issues) ? sheet.mapping_issues : [];
  const complete = ['external_id', 'title', 'steps'].every(field => mapping[field]);
  const open = draft.mappingOpen ?? (!complete || issues.length > 0);
  return `${facts}<label class="field"><span>${upload.source_type === 'csv' ? '数据表' : '工作表'}</span><select id="sheet-select">${sheets.map((item) => `<option value="${esc(item.name)}" ${item.name === draft.sheet ? 'selected' : ''}>${esc(item.name)} · ${esc(item.row_count)} 行</option>`).join('')}</select></label>
    <div id="mapping-summary">${importMappingSummary(mapping, sheet)}</div>
    <details class="import-mapping" id="mapping-details" ${open ? 'open' : ''}><summary>调整列对应关系</summary><p class="muted">带 * 的列为必需项。这里只对应原表列，仍需在预览中核对用例内容。</p>${issues.map(issue => `<p class="notice warning">自动识别提示：${esc(importMappingIssueText(issue))}</p>`).join('')}
    <div class="mapping-grid">${Object.entries(mappingLabels).map(([field, label]) => `<label class="field"><span>${esc(label)}${['external_id','title','steps'].includes(field) ? ' *' : ''}</span><select data-map="${field}"><option value="">不映射</option>${headers.map((header) => `<option value="${esc(header)}" ${mapping[field] === header ? 'selected' : ''}>${esc(header)}</option>`).join('')}</select></label>`).join('')}</div></details>
    <div class="actions"><button class="button" id="replace-file">换文件</button><button class="button primary" id="create-preview">预览用例</button></div>`;
}
function renderPreviewStage(preview) {
  const summary = Object.entries(classificationLabels).map(([key, label]) => `<div><strong>${preview.summary[key]}</strong><span>${label}</span></div>`).join('');
  const incoming = preview.summary.NEW + preview.summary.PENDING_CLARIFICATION + preview.summary.CONFLICT;
  const items = preview.items.map((item) => `<article class="preview-item"><header><div><h3>${esc(item.content.external_id || '无编号')} · ${esc(item.content.title || '无标题')}</h3><p>${esc(item.source_location.sheet || item.source_location.package_id || '来源')} / ${esc(item.source_location.row || item.source_location.index || '')} · ${esc(item.candidate_key)}</p></div><span class="badge ${item.classification === 'UNIMPORTABLE' ? 'danger' : item.classification === 'PENDING_CLARIFICATION' || item.classification === 'CONFLICT' ? 'warning' : 'success'}">${classificationLabels[item.classification]}</span></header>
    <ol>${(item.content.steps || []).map((step) => `<li><strong>${esc(step.action)}</strong><br><span class="muted">预期：${esc(step.expected || '（缺失，导入后保持待确认）')}</span></li>`).join('')}</ol>
    <p class="notice">${item.script_packages?.length ? `随包脚本 ${item.script_packages.length} 份 · ${item.script_packages.reduce((n,s)=>n+s.manifest.length,0)} 个源文件（含公共依赖）；导入后未执行、未首审。重复用例仅给当前同内容版本追加缺失的脚本，不覆盖正文。` : '此用例没有随包脚本。'}</p>
    ${originalSourceFieldsHtml(item.root_source)}
    ${(item.issues || []).map((issue) => `<div class="issue ${issue.severity === 'ERROR' ? 'error' : ''}">${esc(issue.code)} · ${esc(issue.message)}</div>`).join('')}
    ${item.classification === 'CONFLICT' ? `<label class="field"><span>冲突处理</span><select data-conflict="${esc(item.candidate_key)}"><option value="SKIP">默认跳过，不覆盖</option><option value="IMPORT_COPY">作为独立副本导入</option></select></label>` : ''}</article>`).join('');
  return `<div class="preview-summary">${summary}</div><div class="notice warning">按当前选择，最多新增 ${incoming} 条；其中待澄清 ${preview.summary.PENDING_CLARIFICATION} 条会入库并保持“内容待确认”。冲突默认跳过，只有明确选择才作为独立副本。随包脚本 ${preview.script_summary?.included || 0} 份，仅登记为未执行，不携带运行通过或批准。</div><div class="preview-list">${items}</div><div class="actions spaced-actions"><button class="button" id="redo-preview">${preview.source_detail?.workbook_format === 'workbench/case-xlsx-v1' ? '返回来源核对' : '返回映射'}</button><button class="button primary" id="confirm-import">确认导入</button></div>`;
}
function bindImport(project, draft, stage) {
  if (stage === 1) {
    const input = document.querySelector('#import-file'); const button = document.querySelector('#upload-file');
    input.addEventListener('change', () => { button.disabled = !input.files[0]; });
    button.addEventListener('click', async () => { button.disabled = true; try { draft.upload = await uploadCaseFile(input.files[0]); draft.preview = null; draft.result = null; toast('文件已读取。'); renderImport(project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
  }
  if (stage === 2) {
    document.querySelector('#replace-file').addEventListener('click', () => { Object.assign(draft, { upload:null, preview:null, result:null, sheet:null, mapping:null, mappingOpen:null }); renderImport(project); });
    document.querySelector('#sheet-select')?.addEventListener('change', (event) => { draft.sheet = event.target.value; draft.mapping = null; draft.mappingOpen = null; renderImport(project); });
    document.querySelector('#mapping-details')?.addEventListener('toggle', event => { if (event.currentTarget.isConnected) draft.mappingOpen = event.currentTarget.open; });
    document.querySelectorAll('[data-map]').forEach((node) => node.addEventListener('change', () => { draft.mapping[node.dataset.map] = node.value; const sheet = draft.upload.workbook.sheets.find(item => item.name === draft.sheet); document.querySelector('#mapping-summary').innerHTML = importMappingSummary(draft.mapping, sheet); }));
    document.querySelector('#create-preview').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; const body = { upload_id:draft.upload.upload_id }; if (['xlsx','csv'].includes(draft.upload.source_type) && draft.upload.workbook_export_format !== 'workbench/case-xlsx-v1') { body.sheet_name = draft.sheet; body.mapping = draft.mapping; } try { draft.preview = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/imports/preview`, jsonOptions(body)); toast('预览已生成；确认前不会写入新用例。'); renderImport(project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
  }
  if (stage === 3) {
    document.querySelector('#redo-preview').addEventListener('click', () => { draft.preview = null; renderImport(project); });
    document.querySelector('#confirm-import').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; const decisions = {}; document.querySelectorAll('[data-conflict]').forEach((node) => { if (node.value === 'IMPORT_COPY') decisions[node.dataset.conflict] = 'IMPORT_COPY'; }); try { draft.result = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/imports/${encodeURIComponent(draft.preview.preview_id)}/confirm`, jsonOptions({ decisions })); await loadProject(project.project_id); toast(draft.result.idempotent ? '该预览已经确认，本次未重复导入。' : '导入结果已保存。'); renderImport(state.project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
  }
  if (stage === 4) document.querySelector('#import-another').addEventListener('click', () => { Object.assign(draft, { upload:null, preview:null, result:null, sheet:null, mapping:null, mappingOpen:null }); renderImport(project); });
}

function resolveCaseVersion(item, requestedVersion) {
  if (requestedVersion === null) {
    const current = item.versions.find((entry) => entry.version === item.current_version);
    return current ? { version:current } : { error:'CURRENT_VERSION_MISSING' };
  }
  if (!/^[1-9]\d*$/.test(requestedVersion)) return { error:'INVALID_VERSION' };
  const versionNumber = Number(requestedVersion);
  if (!Number.isSafeInteger(versionNumber)) return { error:'INVALID_VERSION' };
  const version = item.versions.find((entry) => entry.version === versionNumber);
  return version ? { version } : { error:'VERSION_NOT_FOUND', versionNumber };
}
function renderCaseVersionError(project, item, requestedVersion, result) {
  state.caseVersion = null;
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:item.external_id }, { label:'版本不可用' }]);
  const detail = result.error === 'VERSION_NOT_FOUND' ? `版本 ${result.versionNumber} 不存在。` : result.error === 'CURRENT_VERSION_MISSING' ? `当前版本 v${item.current_version} 的正文不存在。` : `版本参数无效：${requestedVersion || '空值'}。只接受正整数。`;
  showPage(`<div class="page-heading"><div><p class="eyebrow">CASE VERSION</p><h1>无法显示用例版本</h1><p>${esc(detail)}</p></div></div>
    ${projectTabs(project, 'cases')}
    <section class="empty"><h2>${esc(item.external_id)} · ${esc(item.title)}</h2><p>系统没有回退到其他版本，也没有替换链接中的版本选择。</p><a class="button primary" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}?version=${item.current_version}">查看当前版本 v${item.current_version}</a></section>`);
}
const E2E01_ENVIRONMENTS = {
  'TC-001':'test-site-01-query-v1', 'TC-002':'test-site-01-sorting-v1', 'TC-003':'test-site-01-detail-v1',
};
const AUTH01_ENVIRONMENTS = {
  'AUTH-TC-001': { environment_id: 'auth01-local-fixture-v1', auth_role: 'inspector' },
};
async function createE2E01BuildTask(project, item, version) {
  const response = await mutate('/api/build/tasks/from-project-case', jsonOptions({
    request_id:`case-build-request-${crypto.randomUUID()}`, project_id:project.project_id,
    case_id:item.case_id, case_version:version.version, content_sha256:version.content_sha256,
    environment_id:E2E01_ENVIRONMENTS[version.content.external_id],
  }));
  toast(`已创建 ${version.content.external_id} 的冻结建例任务；尚未启动 Harness。`);
  go(`#/projects/${encodeURIComponent(project.project_id)}/build-tasks/${encodeURIComponent(response.task_id)}`, true);
}
async function createAuth01BuildTask(project, item, version) {
  const target = AUTH01_ENVIRONMENTS[version.content.external_id];
  const response = await mutate('/api/build/tasks/from-project-case', jsonOptions({
    request_id:`case-build-request-${crypto.randomUUID()}`, project_id:project.project_id,
    case_id:item.case_id, case_version:version.version, content_sha256:version.content_sha256,
    environment_id:target.environment_id, auth_role:target.auth_role,
  }));
  toast(`已创建 ${version.content.external_id} 的登录建例任务；启动前请先在“登录准备”页完成登录。`);
  go(`#/projects/${encodeURIComponent(project.project_id)}/build-tasks/${encodeURIComponent(response.task_id)}`, true);
}
const trialReasons = { TRIAL_NOT_AUTHORIZED:'没有与此文件包匹配的试跑授权', TRIAL_IDENTITY_MISMATCH:'来源或候选身份不匹配', TRIAL_CASE_VERSION_MISMATCH:'原用例版本或内容哈希不一致', TRIAL_BUNDLE_MISSING:'候选文件包缺失', TRIAL_BUNDLE_CHANGED:'候选文件包字节已变化', TRIAL_ENVIRONMENT_UNAVAILABLE:'原环境当前不可用', TRIAL_SITE_FILES_MISSING:'已登记环境的站点文件缺失', TRIAL_SITE_MANIFEST_CHANGED:'站点冻结清单变化', TRIAL_SITE_FILE_CHANGED:'站点文件与冻结记录不一致' };
const trialSelectionKeys = ['project_id','case_id','case_version','content_sha256','source_task_id','candidate_version','bundle_sha256','environment_id'];
function sameTrialSelection(a, b) { return trialSelectionKeys.every(key => a?.[key] === b?.[key]); }
function isLatestListedCandidate(data, candidate) {
  const versions = data.candidates.filter(row => row.source_task_id === candidate?.source_task_id)
    .map(row => Number(row.selection?.candidate_version)).filter(Number.isInteger);
  return versions.length > 0 && Number(candidate?.selection?.candidate_version) === Math.max(...versions);
}
function automationSection(project, item, version, data, registeredTargetIds = new Set(), targetLookupFailed = false) {
  const records = `#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}?version=${version.version}&tab=history`;
  const cards = data.candidates.map((c,i) => {
    const selected = c.applies_to_selected_version;
    const exactScope = c.selection?.project_id === project.project_id && c.selection?.case_id === item.case_id;
    const isUserTarget = registeredTargetIds.has(c.selection?.environment_id);
    const currentCaseVersion = version.version === item.current_version;
    const latestCandidate = isLatestListedCandidate(data, c);
    const reason = !exactScope ? '此候选来源不属于当前项目和用例，不能在此授权或运行'
      : isUserTarget && !currentCaseVersion ? '历史用例版本不可授权用户登记环境；请切换到当前用例版本'
        : isUserTarget && !latestCandidate ? '此候选已过期；新候选不继承旧授权，请选择最新候选'
      : !selected ? `对应历史版本v${c.selection.case_version}，不适用于当前所选v${version.version}`
        : c.reason ? (trialReasons[c.reason] || c.reason) : null;
    const needsAuthorization = Boolean(exactScope && selected && currentCaseVersion && latestCandidate && isUserTarget && c.reason === 'TRIAL_NOT_AUTHORIZED');
    const canRun = !reason;
    const authorizeButton = needsAuthorization ? `<button class="button primary" data-candidate-authorize="${i}">明确授权此候选的正常技术试跑</button><p class="muted">仅适用于当前项目、用例版本、候选文件包和登记环境；授权后仍须重新检查并确认运行。</p>` : '';
    const lookupNotice = targetLookupFailed && c.reason === 'TRIAL_NOT_AUTHORIZED'
      ? '<p class="notice warning">无法读取本项目登记环境，当前不能核实授权目标；刷新页面后重试。</p>' : '';
    const negativeButton = route().query.get('validation')==='negative' && !isUserTarget && c.reason !== 'TRIAL_NOT_AUTHORIZED'
      ? `<button class="button" data-candidate-trial="${i}" data-lane="negative" ${canRun?'':'disabled'}>受控故障验证（不调用模型）</button>` : '';
    return `<article class="preview-item"><h3>${c.script_version?'脚本 S'+c.script_version:'历史脚本'} · 候选 v${c.selection.candidate_version} · 用例 v${c.selection.case_version}</h3><p>环境：${esc(c.selection.environment_id)} · ${esc(statusText(c.technical_status))} · ${c.human_review_status==='NOT_REQUIRED'?'自测通过，可运行':`人工核对：${esc(statusText(c.human_review_status))}（未批准）`}</p>${reason?`<p class="notice warning">${esc(reason)}</p>`:''}${lookupNotice}${c.human_review_status==='NOT_REQUIRED' && !c.requirement_review?'':reviewHtml(c.requirement_review)}<p>脚本资格：${reason?'当前不可运行':c.human_review_status==='NOT_REQUIRED'?'自测通过，可运行':'限定技术试跑，未批准'}</p><a data-nav href="#/history?task_id=${encodeURIComponent(c.source_task_id)}">查看来源任务</a> · <a data-nav href="${records}">查看已有运行</a> · <a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}?version=${c.selection.case_version}">查看脚本对应的用例版本</a><details><summary>候选代码与文件清单</summary>${c.files.map(f=>`<p>${esc(f.path)} · ${f.bytes}字节 <code>${esc(f.sha256)}</code>${f.file_id?` <button class="button" data-candidate-code="${esc(c.source_task_id)}|${esc(f.file_id)}">查看代码</button>`:' · 文件登记缺失'}</p>`).join('')}<pre class="candidate-code" hidden></pre></details>${authorizeButton}<button class="button primary" data-candidate-trial="${i}" ${canRun?'':'disabled'}>${c.human_review_status==='NOT_REQUIRED'?'运行当前脚本':'试跑当前文件包'}（不调用模型）</button>${negativeButton}<details><summary>技术身份</summary><pre>${esc(JSON.stringify(c.selection,null,2))}</pre></details></article>`;
  }).join('');
  return `<section class="panel" data-testid="case-automation"><div class="panel-header"><h2>自动化脚本</h2></div><div class="panel-body"><p>运行已有脚本不调用模型。执行结果只对应所选用例与脚本版本。</p>${cards||`<p class="notice">${esc(data.error||'此用例尚无已提交的自主建例文件包；不会自动重新生成。')}</p>`}<p>请使用顶部“生成自动化脚本 / 重新生成脚本”或“更多 → 基于问题修订”。<a data-nav href="#/projects/${project.project_id}/generation">查看生成记录</a></p><details><summary>历史受控任务与兼容能力</summary><a data-nav href="#/projects/${project.project_id}/build-tasks">查看本项目既有开发任务</a>${version.version===1&&version.content.status==='CONFIRMED'&&(E2E01_ENVIRONMENTS[version.content.external_id]||AUTH01_ENVIRONMENTS[version.content.external_id])?'<p>仅适用于已登记的合成验证环境；不会扩展为通用业务规则。</p><button class="button" id="create-legacy-build">创建已有专项建例任务（不启动）</button>':''}</details></div></section>`;
}
function bindAutomation(project, item, version, data) {
  document.querySelector('#demonstrate-case')?.addEventListener('click', () => {
    void openDemonstrationDialog({project,item:{...item,case_version:version.version,version,content:version.content},
      onClose:()=>{},onError:error=>toast(messageFor(error),'error')});
  });
  document.querySelectorAll('[data-candidate-code]').forEach(button => button.addEventListener('click', async () => {
    const [task,file] = button.dataset.candidateCode.split('|');
    const response = await fetch(`/api/build/tasks/${encodeURIComponent(task)}/files/${encodeURIComponent(file)}`);
    const pre = button.closest('details').querySelector('pre');pre.hidden=false;pre.textContent=await response.text();
  }));
  document.querySelectorAll('[data-candidate-trial]').forEach(button => {
    const requestId = `trial-request-${crypto.randomUUID()}`;
    button.addEventListener('click', async () => {
      if(button.disabled)return;button.disabled=true;
      try { const choice=data.candidates[Number(button.dataset.candidateTrial)].selection; if(button.dataset.lane==='negative'){const run=await mutate('/api/candidate-trials',jsonOptions({...choice,lane:'negative',request_id:requestId}));go(`#/projects/${project.project_id}/cases/${choice.case_id}?version=${choice.case_version}&run_id=${run.run_id}`,true);}else await launchBatch(project,'single',[choice.case_id],[choice],choice);
      } catch(error) { toast(trialReasons[error.code]||messageFor(error),'error'); } finally { button.disabled=false; }
    });
  });
  document.querySelectorAll('[data-candidate-authorize]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      const candidate = data.candidates[Number(button.dataset.candidateAuthorize)];
      const selection = candidate?.selection;
      if (!candidate || !candidate.applies_to_selected_version || candidate.reason !== 'TRIAL_NOT_AUTHORIZED' ||
          selection?.project_id !== project.project_id || selection?.case_id !== item.case_id ||
          selection?.case_version !== version.version || version.version !== item.current_version || !isLatestListedCandidate(data, candidate)) {
        return toast('候选身份或版本已变化，请刷新用例页面后重新核对。', 'error');
      }
      button.disabled = true;
      const authorizationRoute = route().raw;
      const authorizationCurrent = () => route().raw === authorizationRoute && button.isConnected;
      try {
        await requestCandidateTrialAuthorization({
          project, selection, isCurrent: authorizationCurrent,
          candidate: { case_id: selection.case_id, case_version: selection.case_version,
            source_task_id: selection.source_task_id, candidate_version: selection.candidate_version,
            bundle_sha256: selection.bundle_sha256, external_id: candidate.external_id },
          onAuthorized: async (_authorization, guard) => {
            let refreshed;
            try {
              refreshed = await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(selection.case_id)}/automation?version=${encodeURIComponent(selection.case_version)}`);
            } catch (error) {
              if (authorizationCurrent() && guard.isCurrent()) toast(messageFor(error), 'error');
              return;
            }
            if (!authorizationCurrent() || !guard.isCurrent()) return;
            const current = refreshed.candidates.find(row => sameTrialSelection(row.selection, selection));
            if (!current || !current.applies_to_selected_version || current.reason) {
              toast(`授权已保存，但重新读取的候选准备状态仍未就绪：${current ? trialReasons[current.reason] || current.reason : '精确候选已变化或不可用'}。未启动试跑。`, 'error');
              return;
            }
            await launchBatch(project, 'single', [selection.case_id], [current.selection],
              { case_id: selection.case_id, case_version: selection.case_version });
          },
        });
      } catch (error) { toast(trialReasons[error.code] || messageFor(error), 'error'); }
      finally { if (button.isConnected) button.disabled = false; }
    });
  });
}
async function renderCaseDetail(project,item,requestedVersion,isCurrent=()=>true) {
  const resolved=resolveCaseVersion(item,requestedVersion);if(!resolved.version)return renderCaseVersionError(project,item,requestedVersion,resolved);
  const version=resolved.version,content=version.content,base=`#/projects/${project.project_id}/cases/${item.case_id}`,q=route().query;
  state.caseVersion=version.version;
  if(q.get('tab')==='content'&&content.case_type!=='BACKEND'){
    setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}/cases`},{label:content.external_id}]);
    return renderCaseContent({project,item,version,query:q,showPage,go,statusText,sourceHtml:originalSourceFieldsHtml(item.root_source),onEdit:()=>openCaseEdit(project,item,version)});
  }
  if(content.case_type==='BACKEND'){
    setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}/cases`},{label:content.external_id}]);
    const ui=await loadBackendFeature();
    if(!isCurrent())return;
    return ui.renderBackendCase({project,item,version,query:q,showPage,go,toast,api,launchBatch,
      onDirty:dirty=>{state.editing=dirty?{kind:'backend-plan',dirty:true}:null;},
      onEdit:()=>openCaseEdit(project,item,version)});
  }
  const [automation,nativeData,{records}]=await loadCaseExecutionContext({project,item,version,query:q,api,loadNativeConsole});
  if(!isCurrent())return;
  const nativeModel=nativeConsoleModel(project,nativeData,{caseId:item.case_id,version}),nativeScriptStatus=nativeScriptAvailability(nativeModel),hasNativeScripts=nativeScriptStatus.hasScripts,hasNativeHistory=nativeScriptStatus.hasHistory,hasNativeDrafts=nativeScriptStatus.hasDrafts;
  const preferNative=(hasNativeScripts||hasNativeHistory||hasNativeDrafts) && !q.has('run_id') && !q.has('batch_id');
  let registeredTargetIds = new Set(), targetLookupFailed = false;
  if (automation.candidates.some(candidate => candidate.reason === 'TRIAL_NOT_AUTHORIZED')) {
    try {
      const targetData = await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/targets`);
      registeredTargetIds = new Set((targetData.targets || []).map(target => target.environment_id));
    } catch { targetLookupFailed = true; }
  }
  if(!isCurrent())return;
  const historyRows=records.filter(r=>r.executed_case_id===item.case_id&&r.executed_case_version===version.version);
  const tab=q.get('tab')||((historyRows.length||nativeModel.records.length||q.has('run_id')||q.has('native_run')||q.has('batch_id'))?'results':'content');
  if(!['results','content','scripts','history'].includes(tab))throw Error('用例页签无效');
  const applicable=automation.candidates.filter(c=>c.applies_to_selected_version);
  const explicitScript=q.has('script_task')||q.has('candidate');
  let chosen=explicitScript?applicable.find(c=>c.source_task_id===q.get('script_task')&&String(c.selection.candidate_version)===q.get('candidate')):applicable.length===1?applicable[0]:null;
  const runnableCandidates=applicable.filter(c=>candidateReadiness(c).runnable);
  const recommendation=!chosen&&!explicitScript&&runnableCandidates.length===1?runnableCandidates[0]:null;
  const returnPath=(q.get('return') || '').split('?')[0];
  const fromAutomation = [`#/projects/${encodeURIComponent(project.project_id)}`,`#/projects/${encodeURIComponent(project.project_id)}/automation`].includes(returnPath);
  const back=fromAutomation||q.get('return')?.startsWith(`#/projects/${project.project_id}/cases`)?q.get('return'):`#/projects/${project.project_id}/cases`;
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:back},{label:content.external_id}]);
  const tabLink=t=>{const next=new URLSearchParams(q);next.set('version',version.version);next.set('tab',t);return base+'?'+next;};
  const reason=chosen?.reason||(!chosen?(applicable.length?'SCRIPT_SELECTION_REQUIRED':automation.candidates.length?'CASE_VERSION_NOT_APPLICABLE':'SCRIPT_MISSING'):null);
  const canAuthorizeChosen = Boolean(chosen?.applies_to_selected_version && chosen.reason === 'TRIAL_NOT_AUTHORIZED' &&
    chosen.selection?.project_id === project.project_id && chosen.selection?.case_id === item.case_id &&
    chosen.selection?.case_version === version.version && version.version === item.current_version &&
    isLatestListedCandidate(automation, chosen) && registeredTargetIds.has(chosen.selection?.environment_id));
  const chosenIsUserTarget = registeredTargetIds.has(chosen?.selection?.environment_id);
  const historicalTargetCandidate = Boolean(chosenIsUserTarget && version.version !== item.current_version);
  const expiredTargetCandidate = Boolean(chosenIsUserTarget && !isLatestListedCandidate(automation, chosen));
  const reasonText = hasNativeDrafts && reason==='SCRIPT_MISSING' ? nativeScriptStatus.notice : hasNativeHistory && !hasNativeScripts && reason==='SCRIPT_MISSING' ? nativeScriptStatus.notice : hasNativeScripts && reason==='SCRIPT_MISSING' ? '已有 DSH 脚本，可查看结果与证据；请在自动化脚本页的“选择已有脚本复跑”中核对后运行' : nativeModel.load_error && reason==='SCRIPT_MISSING' ? 'DSH 状态读取失败，暂不能判断脚本是否缺失' : historicalTargetCandidate ? '用户登记环境不接受历史用例版本授权'
    : expiredTargetCandidate ? '此候选已过期，新候选不继承旧授权'
      : batchReasons[reason] || reason;
  const reasonAction = (hasNativeHistory || hasNativeDrafts) && reason==='SCRIPT_MISSING' ? `<a data-nav href="${base}?version=${version.version}&tab=scripts">查看 DSH 已有脚本</a>` : historicalTargetCandidate
    ? `<a data-nav href="${base}?version=${item.current_version}&tab=scripts">查看当前用例版本的候选</a>`
    : expiredTargetCandidate ? `<a data-nav href="${base}?version=${version.version}&tab=scripts">查看最新候选</a>`
    : canAuthorizeChosen
    ? `<a data-nav href="${base}?version=${version.version}&tab=scripts">前往此候选明确授权正常技术试跑</a>`
    : remedyHtml({case_id:item.case_id,case_version:version.version,reason},project.project_id);
  showPage(`<div class="page-heading case-heading"><div><a data-nav href="${esc(back)}">← ${fromAutomation ? '返回工作台' : '返回用例'}</a><h1>${esc(content.external_id)} · ${esc(content.title)}</h1><p>${esc(content.module||'未填写模块')} · 用例 v${version.version}</p></div><div class="actions"><button class="button${!reason || reason==='SCRIPT_SELECTION_REQUIRED'?' primary':''}" id="run-case" ${reason?'disabled':''} title="${esc(reasonText||'运行已有脚本，不调用模型')}">运行此用例</button><button class="button${!applicable.length?' primary':''}" id="generate-case">${applicable.length||hasNativeScripts||hasNativeDrafts?'重新生成脚本':'生成自动化脚本'}</button>${content.case_type!=='BACKEND'&&content.status==='CONFIRMED'&&version.version===item.current_version?'<button class="button" id="demonstrate-case">人工示范</button>':''}<details class="script-menu"><summary>更多</summary><button class="button" id="revise-case" ${applicable.length?'':'disabled'}>基于问题修订</button><button class="button" id="report-case" ${!historyRows.length && (nativeModel.records.length || hasNativeDrafts)?'hidden':''}>导出本用例报告</button></details></div></div>
  ${tab==='results'||preferNative?`<details class="case-run-preparation"><summary>${preferNative?'历史脚本准备与版本（旧流程）':'用例版本与再次运行准备'}</summary><p class="muted">${preferNative?'本轮 DSH 脚本与原稿复跑请进入“自动化脚本”；此处仅保留旧流程版本。':'这里检查当前环境和脚本，历史运行结果保留在下方。'}</p>`:''}<div class="case-context"><label>用例版本 <select id="content-version">${[...item.versions].reverse().map(v=>`<option value="${v.version}" ${v.version===version.version?'selected':''}>v${v.version}${v.version===item.current_version?' · 当前':' · 历史只读'}</option>`).join('')}</select></label><label>脚本版本 <select id="script-version"><option value="">${applicable.length?'请选择':nativeScriptStatus.label}</option>${applicable.map((c,i)=>`<option value="${i}" ${c===chosen?'selected':''}>${esc(candidateOptionLabel(c))}</option>`).join('')}</select></label><span>脚本资格：${chosen?chosen.selection?.kind==='HTTP_JSON'?'HTTP 技术计划（非产品验收）':chosen.human_review_status==='NOT_REQUIRED'?'自测通过，可运行':'候选未批准':hasNativeDrafts&&!hasNativeScripts?'DSH 稿件 · 未执行':hasNativeScripts?'DSH 自测 · 人工首审未登记':hasNativeHistory?'DSH 历史记录 · 待核验':'尚未选择'}</span>${reason?`<span class="muted">${esc(reasonText)} · ${reasonAction}</span>`:''}${recommendation?`<p>推荐 ${esc(candidateOptionLabel(recommendation))}；请选择后核对本次运行。</p>`:''}</div>${tab==='results'||preferNative?'</details>':''}
  <nav class="case-tabs" aria-label="用例详情页签">${[['results','结果与证据'],['content','用例内容'],['scripts','自动化脚本'],['history','历史结果']].map(([key,label])=>`<a data-nav href="${tabLink(key)}" ${tab===key?'aria-current="page" class="active"':''}>${label}</a>`).join('')}</nav>
  ${tab==='scripts'?nativeScriptsHtml(project,nativeModel):tab==='history'?nativeRecordsHtml(project,nativeModel,{selectedRunId:q.get('native_run')}):''}
  ${tab==='results'?'<section id="case-results" class="panel">读取本次结果…</section>':tab==='content'?`<section class="panel"><div class="panel-header"><h2>原始用例正文</h2>${version.version===item.current_version?`<button class="button" id="edit-case">${content.requirements_origin?'创建用例修订稿':'编辑当前版本'}</button>`:'<span>历史正文只读</span>'}</div><div class="panel-body"><p>内容状态：${esc(statusText(content.status))}</p><h3>前置条件</h3><p class="preserve-text">${esc(content.preconditions||'未填写')}</p><h3>测试数据</h3><p class="preserve-text">${esc(content.test_data||'未填写')}</p>${content.steps.map(step=>`<article class="step-pair"><strong>${step.order}</strong><div><small>动作</small><p>${esc(step.action)}</p></div><div><small>原预期</small><p>${esc(step.expected||'缺失，待确认')}</p></div></article>`).join('')}${originalSourceFieldsHtml(item.root_source)}<details><summary>来源物理行列与版本身份</summary><pre>${esc(JSON.stringify({source:item.root_source,source_location:version.source_location||item.source_location,content_sha256:version.content_sha256,lineage:item.lineage},null,2))}</pre></details></div></section>`:tab==='scripts'?((hasNativeHistory||hasNativeDrafts)&&!automation.candidates.length?'':preferNative?`<details class="case-legacy-history"><summary>历史自动化脚本（旧流程）</summary>${automationSection(project,item,version,automation,registeredTargetIds,targetLookupFailed)}</details>`:automationSection(project,item,version,automation,registeredTargetIds,targetLookupFailed)):`<section class="panel"><div class="panel-body"><h2>本用例 v${version.version} 历史结果</h2><p>开发自测、独立验证与新测试批次分别标识，不拼接为一次全项目通过。</p>${historyRows.slice().reverse().map(r=>`<article class="history-row"><a data-nav href="${base}?version=${version.version}&tab=results&run_id=${encodeURIComponent(r.run_id)}${r.batch_id?'&batch_id='+r.batch_id:''}">${esc(fmtDate(r.started_at))} · ${esc(statusText(executionDisplayStatus(r)))}</a><span>${r.batch_id?'批次运行':r.origin==='DEVELOPMENT_SELF_TEST'?'开发自测':'历史结果 / 来源未分批'}</span><span>软件 ${esc(r.software_version||'未提供')} · 候选 v${esc(r.candidate_version||'未编号')}</span></article>`).join('')||(nativeModel.records.length?'':'<p>此用例版本尚无历史结果。</p>')}</div></section>`}`);
  if (tab === 'results') {
    const heading = document.querySelector('.case-heading');
    heading.classList.add('case-results-heading');
    const menu = heading.querySelector('.script-menu');
    menu.querySelector('summary').textContent = '再次运行与修订';
    for (const id of ['run-case', 'generate-case', 'demonstrate-case']) {
      const button = heading.querySelector('#' + id);
      if (button) menu.append(button);
    }
    const report = heading.querySelector('#report-case');
    report.classList.add('primary');
    heading.querySelector('.actions').prepend(report);
    const module = heading.querySelector(':scope > div > p');
    if (module) document.querySelector('.case-run-preparation').append(module);
  }
  document.querySelector('#content-version').onchange=e=>go(base+'?version='+e.target.value+'&tab='+tab);
  document.querySelector('#script-version').onchange=e=>{const c=applicable[Number(e.target.value)],next=new URLSearchParams(q);next.set('version',version.version);if(e.target.value!==''&&c){next.set('script_task',c.source_task_id);next.set('candidate',c.selection.candidate_version);}else{next.delete('script_task');next.delete('candidate');}go(base+'?'+next);};
  const runCase=document.querySelector('#run-case');
  // A multi-version case opens the same confirmation with an explicit selector.
  if(reason==='SCRIPT_SELECTION_REQUIRED')runCase.disabled=false;
  if(preferNative){runCase.disabled=false;runCase.textContent='选择已有 DSH 脚本复跑';runCase.title='在自动化脚本中核对冻结版本，不调用模型';}
  runCase.onclick=()=>preferNative?go(tabLink('scripts')):launchBatch(project,'single',[item.case_id],chosen?[chosen.selection]:[],{case_id:item.case_id,case_version:version.version});
  const script=mode=>openScriptOperation({project,items:[{case_id:item.case_id,case_version:version.version,external_id:content.external_id,run_id:mode==='revise'?(q.get('run_id')||document.querySelector('[data-run-id]')?.dataset.runId):null}],mode,go,onError:e=>toast(messageFor(e),'error')});
  document.querySelector('#generate-case').onclick=()=>preferNative?go(`#/projects/${project.project_id}/native-dsh?selected=${encodeURIComponent(item.case_id)}`):void script(applicable.length?'regenerate':'generate');if(preferNative)document.querySelector('#revise-case').hidden=true;document.querySelector('#revise-case').onclick=()=>void script('revise');
  document.querySelector('#report-case').onclick=()=>{const run=q.get('run_id')||document.querySelector('[data-run-id]')?.dataset.runId;if(!run)return toast('请在结果与证据中明确选择一次运行后导出。');go(`#/projects/${project.project_id}/reports?run_id=${encodeURIComponent(run)}`);};
  document.querySelector('#edit-case')?.addEventListener('click',()=>openCaseEdit(project,item,version));
  if(tab==='scripts')bindAutomation(project,item,version,automation);
  else document.querySelector('#demonstrate-case')?.addEventListener('click',()=>void openDemonstrationDialog({project,item:{...item,case_version:version.version,version,content},onError:error=>toast(messageFor(error),'error')}));
  document.querySelector('#create-legacy-build')?.addEventListener('click',async e=>{e.target.disabled=true;try{if(AUTH01_ENVIRONMENTS[content.external_id])await createAuth01BuildTask(project,item,version);else await createE2E01BuildTask(project,item,version);}catch(error){toast(messageFor(error),'error');e.target.disabled=false;}});
  if(tab==='results'){
    if(!q.has('run_id') && !q.has('batch_id') && (nativeModel.records.length||nativeModel.load_error)) document.querySelector('#case-results').outerHTML=nativeRecordsHtml(project,nativeModel,{selectedRunId:q.get('native_run')||nativeModel.latest[0]?.run_id});
    else { await renderExecutionRecords(project,{item,version}); if(!q.has('batch_id'))document.querySelector('#case-results')?.insertAdjacentHTML('beforebegin',nativeRecordsHtml(project,nativeModel,{selectedRunId:q.get('native_run')})); }
  }
  bindNativeConsole();
  if(q.get('demo')==='1' && content.status==='CONFIRMED' && version.version===item.current_version){
    const next=new URLSearchParams(q);next.delete('demo');history.replaceState(null,'',base+'?'+next);
    document.querySelector('#demonstrate-case')?.click();
  }
}

function openCaseEdit(project,item,version) {
  if (version.version !== item.current_version) return;
  if (!version.content.requirements_origin) {
    state.editing={projectRevision:project.revision,caseId:item.case_id,baseVersion:item.current_version,content:structuredClone(version.content),dirty:false};
    return renderCaseEditor(project,item);
  }
  const requestId=`case-revision-${crypto.randomUUID()}`;
  openModal({title:'创建用例修订稿',confirmLabel:'创建并核对修订稿',
    body:`<p>基于 ${esc(version.content.external_id)} 的当前 v${version.version} 创建待审稿。修改后逐步核对原资料，再确认成新版本；原正文、脚本和历史报告保留。</p><p class="muted">此次创建不调用模型，也不会自动确认。</p><label class="field"><span>修订原因</span><textarea id="case-revision-reason" rows="3" maxlength="2000" placeholder="说明发现的问题及需要核对的原资料"></textarea></label>`,
    onConfirm:async close=>{
      const {requirementsApi}=await loadRequirementsFeature();
      const design=await requirementsApi.createCaseRevision(project.project_id,{
        caseId:item.case_id,caseVersion:version.version,contentSha256:version.content_sha256,
        projectRevision:project.revision,reason:modalRoot.querySelector('#case-revision-reason').value,requestId,
      });
      if (!design?.design_id) throw new Error('CASE_DESIGN_REVISION_RESPONSE_INVALID');
      close();toast('修订稿已创建，请修改正文并逐步记录来源与决定。');
      go(`#/projects/${encodeURIComponent(project.project_id)}/requirements?view=legacy&design=${encodeURIComponent(design.design_id)}`);
    }});
}
function renderCaseEditor(project, item) {
  const edit = state.editing; const content = edit.content; setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:item.external_id, href:`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}` }, { label:'编辑当前版本' }]);
  const stepRows = content.steps.map((step, index) => `<div class="edit-step" data-step="${index}"><strong>${index + 1}</strong><label class="field"><span>动作</span><textarea data-action>${esc(step.action)}</textarea></label><label class="field"><span>对应预期</span><textarea data-expected>${esc(step.expected)}</textarea></label><button class="icon-button" data-remove-step="${index}" aria-label="删除第 ${index + 1} 步">×</button></div>`).join('');
  showPage(`<div class="page-heading"><div><p class="eyebrow">EDIT CURRENT VERSION</p><h1>编辑 ${esc(item.external_id)} · v${item.current_version}</h1><p>保存会形成新版本；历史版本和已有任务快照不改写。</p></div></div>
    <section class="panel"><div class="panel-body"><form id="case-edit-form"><div class="form-grid"><label class="field"><span>用例编号</span><input name="external_id" value="${esc(content.external_id)}" required></label><label class="field"><span>标题</span><input name="title" value="${esc(content.title)}" required></label><label class="field"><span>模块</span><input name="module" value="${esc(content.module)}"></label><label class="field"><span>用例类型</span><select name="case_type">${!content.case_type?'<option value="" selected disabled>未分类（请选择）</option>':''}<option value="UI" ${content.case_type === 'UI' ? 'selected' : ''}>前端 UI</option><option value="BACKEND" ${content.case_type === 'BACKEND' ? 'selected' : ''}>后端</option></select></label><label class="field"><span>内容状态</span><select name="status"><option value="CONFIRMED" ${content.status === 'CONFIRMED' ? 'selected' : ''}>内容已确认</option><option value="PENDING_CONFIRMATION" ${content.status !== 'CONFIRMED' ? 'selected' : ''}>内容待确认</option></select></label><label class="field wide"><span>前置条件</span><textarea name="preconditions" rows="3">${esc(content.preconditions)}</textarea></label><label class="field wide"><span>测试数据</span><textarea name="test_data" rows="4">${esc(content.test_data)}</textarea></label></div>
      <div class="panel-header inline-section-heading"><h2>步骤与对应预期</h2><button class="button small" type="button" id="add-step">新增步骤</button></div><div id="edit-steps" class="edit-steps">${stepRows}</div>
      <div id="edit-message" class="notice spaced-notice">加载时项目修订：r${project.revision}。发生 409 时会保留当前草稿，不自动覆盖。</div><div class="sticky-actions"><button class="button" type="button" id="cancel-edit">取消</button><button class="button primary" type="submit">保存为新版本</button></div></form></div></section>`);
  const form = document.querySelector('#case-edit-form'); const mark = () => { edit.dirty = true; }; form.addEventListener('input', mark);
  document.querySelector('#add-step').addEventListener('click', () => { syncEditForm(); edit.content.steps.push({ order:edit.content.steps.length + 1, action:'', expected:'' }); edit.dirty = true; renderCaseEditor(project, item); });
  document.querySelectorAll('[data-remove-step]').forEach((button) => button.addEventListener('click', () => { syncEditForm(); edit.content.steps.splice(Number(button.dataset.removeStep), 1); edit.content.steps.forEach((step,index) => { step.order = index + 1; }); edit.dirty = true; renderCaseEditor(project, item); }));
  document.querySelector('#cancel-edit').addEventListener('click', () => go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}`, false));
  form.addEventListener('submit', async (event) => { event.preventDefault(); syncEditForm(); const firstInvalid = edit.content.steps.findIndex((step) => !step.action.trim()); if (!edit.content.steps.length || firstInvalid >= 0) return setEditMessage(firstInvalid >= 0 ? `第 ${firstInvalid + 1} 步缺少动作，不能保存。` : '至少需要一个步骤。', true); const button = form.querySelector('[type=submit]'); button.disabled = true; try { const updated = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}`, jsonOptions({ revision:edit.projectRevision, content:edit.content }, 'PATCH')); edit.dirty = false; state.project = updated; state.caseVersion = item.current_version + 1; toast('已形成新的用例版本。'); go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}?version=${state.caseVersion}`, true); } catch (error) { setEditMessage(messageFor(error), true); button.disabled = false; } });
}
function syncEditForm() { const edit = state.editing; const form = document.querySelector('#case-edit-form'); if (!edit || !form) return; const data = new FormData(form); for (const key of ['external_id','title','module','status','preconditions','test_data']) edit.content[key] = String(data.get(key) || ''); const caseType = data.get('case_type'); if (caseType) edit.content.case_type = String(caseType); edit.content.steps = [...document.querySelectorAll('.edit-step')].map((row,index) => ({ order:index + 1, action:row.querySelector('[data-action]').value, expected:row.querySelector('[data-expected]').value })); }
function setEditMessage(text, danger = false) { const node = document.querySelector('#edit-message'); node.textContent = text; node.className = `notice ${danger ? 'danger' : ''}`; }

const BUILD_TERMINAL = new Set(['READY','ENVIRONMENT_BLOCKED','WAITING_HUMAN_REVIEW','WAITING_E2E_TRIALS','CANDIDATE_VALIDATION_FAILED','FAILED','CANCELLED','INTERRUPTED']);
const statusLabels = {
  READY: '自测通过，可运行', ENVIRONMENT_BLOCKED: '前置条件受阻', NOT_REQUIRED: '无需确认',
  CONFIRMED: '内容已确认', PENDING_CONFIRMATION: '内容待确认', NOT_APPROVED: '未批准',
  SUBMITTED: '已创建，尚未启动', QUEUED: '排队中', GENERATING: '正在生成', VERIFYING: '正在验证',
  WAITING_E2E_TRIALS: '等待对照试跑', WAITING_HUMAN_REVIEW: '等待人工核对',
  CANDIDATE_VALIDATION_FAILED: '候选验证未通过', FAILED: '失败', CANCELLING: '正在取消',
  CANCELLED: '已取消', INTERRUPTED: '中断', NOT_STARTED: '尚未开始', NOT_RUN: '尚未执行', NOT_EXECUTED: '未执行',
  RUNNING: '进行中', GENERATED: '已生成', COMPLETED: '已完成', INCOMPLETE: '尚未完成',
  NORMAL_PASSED_AWAITING_PAIR: '正常试跑通过，等待对照试跑', PAIR_VALIDATION_FAILED: '对照验证未通过',
  TECHNICAL_VALIDATION_PASSED: '技术验证通过', PASSED: '通过', NOT_READY: '尚不可核对',
  WAITING_REVIEW: '等待人工核对', APPROVED: '已批准',
  ASSERTION_MISMATCH: '断言不符', REPORT_MISSING: '未生成完整执行报告',
};
function statusText(value) { return statusLabels[value] || (value ? `未知状态（${value}）` : '未记录'); }
function resultBadge(status) {
  const label = statusText(status || 'NOT_RUN');
  return `<span class="badge ${status === 'PASSED' ? 'success' : status === 'FAILED' ? 'danger' : 'warning'}">${esc(label)}</span>`;
}
function buildTaskUrl(project, task) { return `#/projects/${encodeURIComponent(project.project_id)}/build-tasks/${encodeURIComponent(task.task_id)}`; }
function buildMediaUrl(taskId, fileId) { return `/api/build/tasks/${encodeURIComponent(taskId)}/media/${encodeURIComponent(fileId)}`; }
function renderBuildTasks(project, tasks) {
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${encodeURIComponent(project.project_id)}/cases`},{label:'建例任务'}]);
  const rows = tasks.map((task) => `<tr><td><a data-nav href="${buildTaskUrl(project,task)}"><strong>${esc(task.source?.external_id || task.template?.title || '任务')}</strong> · ${esc(task.source?.case_version ? `v${task.source.case_version}` : '')}</a></td><td>${esc(statusText(task.task_status))}</td><td>${esc(statusText(task.generation_status))} / ${esc(statusText(task.verification_status))}</td><td>${task.candidates?.length || 0}</td><td>${esc(fmtDate(task.created_at))}</td></tr>`).join('');
  showPage(`<div class="page-heading"><div><p class="eyebrow">BUILD TASKS</p><h1>建例任务</h1><p>任务创建和启动分开；此处启动后由工作台调用 Coding Agent 生成候选并执行正常入口。</p></div></div>${projectTabs(project,'build-tasks')}<section class="panel"><div class="panel-header"><h2>项目任务</h2><span class="muted">${tasks.length} 条</span></div><div class="panel-body">${rows ? `<div class="table-wrap"><table><thead><tr><th>来源用例</th><th>任务状态</th><th>生成 / 验证</th><th>候选版本</th><th>创建时间</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty"><h2>暂无建例任务</h2><p>进入 TC-001、TC-002 或 TC-003 的用例详情，点击“创建演示建例任务”。</p></div>'}</div></section>`);
}
function buildTaskActions(project, task) {
  const latest = task.candidates?.at(-1); const pair = task.trial_binding?.paired;
  const normalRuns = latest?.trial_runs?.filter((run) => run.executed_external_id === task.trial_binding?.source.external_id) || [];
  const pairRuns = latest?.trial_runs?.filter((run) => run.executed_external_id === pair?.external_id) || [];
  const actions = [];
  if (task.task_status === 'SUBMITTED' && !task.attempts?.length) actions.push('<button class="button primary" id="start-generation">生成并试跑正常入口</button>');
  if (task.revision_allowed) actions.push('<button class="button" id="revise-candidate">基于正常页问题修订一次</button>');
  if (latest && task.auth_requirement) actions.push('<button class="button small" id="rerun-auth">使用当前登录会话复跑候选（不调用模型）</button>');
  if (latest && task.trial_binding) {
    if (normalRuns.length) actions.push('<button class="button small" id="rerun-normal">重新试跑正常入口（不调用模型）</button>');
    if (!pairRuns.length) actions.push(`<button class="button primary" id="run-pair">运行 ${esc(pair.external_id)} 对照入口（不调用模型）</button>`);
    else actions.push(`<button class="button small" id="rerun-pair">重新运行 ${esc(pair.external_id)}（不调用模型）</button>`);
  }
  if (task.active_attempt_id) actions.push('<button class="button danger" id="stop-build">取消当前任务</button>');
  return actions.join('');
}
function renderBuildTaskDetail(project, task) {
  if (task.authorization?.logical_id) return renderDevelopmentDetail(project, task);
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${encodeURIComponent(project.project_id)}/cases`},{label:'建例任务',href:`#/projects/${encodeURIComponent(project.project_id)}/build-tasks`},{label:task.source?.external_id || task.task_id}]);
  const content=task.input_bundle?.snapshot?.content; const originalLatest=task.candidates?.at(-1);
  const latest=originalLatest?{...originalLatest,trial_runs:originalLatest.trial_runs?.map(run=>({...run,failure_step:displayFailureStep(run)}))}:null;
  const steps=(content?.steps || []).map((step)=>`<article class="step-pair"><div class="step-number">${step.order}</div><div><small>动作</small><p>${esc(step.action)}</p></div><div><small>对应预期</small><p>${esc(step.expected)}</p></div></article>`).join('');
  const runs=(latest?.trial_runs || []).map((run)=>`<article class="preview-item"><header><div><h3>${esc(run.executed_external_id)} · ${esc(run.run_id)}</h3><p>入口 ${esc(run.entry_route)} · 候选 v${run.candidate_version} · ${esc(short(run.candidate_sha256,20))}${run.run_type ? ` · ${esc(run.run_type === 'auth-reexecution' ? '复跑（未调用模型）' : run.run_type === 'auth-initial' ? '建例执行' : run.run_type)}` : ''}</p></div>${resultBadge(run.status)}</header><p>${run.failure_step ? `失败步骤：${esc(run.failure_step)}` : '失败步骤：无'}</p>${run.auth ? `<p>登录身份：${esc(run.auth.account_id || '未确认')} · 角色 ${esc(run.auth.role)} · 会话版本 ${esc(short(run.auth.session_version,12))}</p>` : ''}${run.auth_block ? `<p class="notice danger">会话失效停止：${esc(run.auth_block.reason)}（${esc(run.auth_block.trigger)}）· ${esc(fmtDate(run.auth_block.detected_at))}；已执行步骤保留，未执行步骤不补写。</p>` : ''}${run.error ? `<p>错误：${esc(run.error.type || run.error.code || run.error.message)}${run.error.expected ? ` · 期望 ${esc(run.error.expected)} / 实际 ${esc(run.error.actual)}` : ''}</p>` : ''}<p>${run.specified_defect_detected ? '对照验证检出指定缺陷（原始业务结果仍为失败）' : run.run_type === 'negative' ? '未检出指定缺陷；保持原始运行状态' : ''}</p></article>`).join('');
  const harness=task.attempts?.map((attempt)=>`<li>${esc(attempt.attempt_id)} · ${esc(statusText(attempt.status))} · 工具调用 ${attempt.harness?.total_tool_calls ?? '未知'} · 模型 ${esc(attempt.harness?.model_configuration?.model || '未知')}</li>`).join('') || '尚未启动';
  const pairText=task.trial_binding ? `${task.trial_binding.source.external_id} → ${task.trial_binding.paired.external_id}；候选来源与本次执行用例分别记录。` : '';
  const authText=task.auth_requirement ? `登录建例：环境 ${task.auth_requirement.environment_id} · 要求角色 ${task.auth_requirement.role}；启动与复跑前复核当前登录会话，会话失效或清除即停止关联运行。` : '';
  const media=(latest?.trial_runs || []).flatMap((run)=>run.media_file_ids.map((fileId)=>({run,file:task.files.find((item)=>item.file_id===fileId)}))).filter((item)=>item.file);
  const mediaHtml=(latest?.trial_runs||[]).map((run)=>`<a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/execution-records?run_id=${encodeURIComponent(run.run_id)}">查看 ${esc(run.executed_external_id)} · ${esc(run.run_id)} 的步骤、录像与媒体</a>`).join('')+media.filter(({file})=>file.kind.endsWith('_screenshot')).map(({run,file})=>`<a href="${buildMediaUrl(task.task_id,file.file_id)}" target="_blank" rel="noreferrer">${esc(run.executed_external_id)} 截图 · ${esc(file.file_name)}</a>`).join('');
  showPage(`<div class="page-heading"><div><p class="eyebrow">${esc(task.task_id)}</p><h1>${esc(task.source?.external_id || task.template?.title || '建例任务')} · v${esc(task.source?.case_version || '')}</h1><p>任务状态：${esc(statusText(task.task_status))} · 生成：${esc(statusText(task.generation_status))} · 验证：${esc(statusText(task.verification_status))} · 人工核对：${esc(statusText(task.human_review_status))}</p></div><div class="actions">${buildTaskActions(project,task)}</div></div>${projectTabs(project,'build-tasks')}<div class="detail-layout"><div class="detail-main"><section class="panel"><div class="panel-header"><h2>本次冻结输入</h2><span class="mono">${esc(short(task.source?.content_sha256,20))}</span></div><div class="panel-body"><dl class="definition-grid"><div><dt>标题</dt><dd>${esc(content?.title)}</dd></div><div><dt>前置条件</dt><dd>${esc(content?.preconditions)}</dd></div><div class="wide"><dt>测试数据</dt><dd>${esc(content?.test_data)}</dd></div></dl><div class="step-list">${steps}</div><p class="notice">${esc(pairText)}${esc(authText)} Harness 输入只包含当前正常用例、正常入口及页面观察；对照入口信息由工作台执行端保管。</p></div></section><section class="panel"><div class="panel-header"><h2>候选与运行</h2><span class="muted">${latest ? `v${latest.version} · ${esc(short(latest.sha256,20))}` : '候选尚未生成'}</span></div><div class="panel-body">${runs || '<p class="muted">目前没有候选运行记录。</p>'}${mediaHtml ? `<div class="source-box">${mediaHtml}</div>`:''}</div></section></div><aside class="panel"><div class="panel-header"><h2>建例来源</h2></div><div class="panel-body"><p>${esc(task.source?.external_id || '固定模板')}</p><p>任务状态：${esc(statusText(task.task_status))}</p><p>人工核对：${esc(statusText(task.human_review_status))}；尚未登记批准。</p><h3>Harness 启动记录</h3><ul>${harness}</ul><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/execution-records">查看项目执行记录</a></div></aside></div>`);
  const refresh=async()=>{if(BUILD_TERMINAL.has(task.task_status))return;try{const fresh=await api(`/api/build/tasks/${encodeURIComponent(task.task_id)}`);if(!BUILD_TERMINAL.has(fresh.task_status)){setTimeout(refresh,1500);return;}renderBuildTaskDetail(project,fresh);}catch{}};
  if(!BUILD_TERMINAL.has(task.task_status)) setTimeout(refresh,1500);
  const invoke=async(button,operation)=>{button.disabled=true;try{await operation();const fresh=await api(`/api/build/tasks/${encodeURIComponent(task.task_id)}`);renderBuildTaskDetail(project,fresh);}catch(error){toast(messageFor(error),'error');button.disabled=false;}};
  document.querySelector('#start-generation')?.addEventListener('click',(event)=>{if(!confirm('将启动一次真实 Harness 会话，生成新候选并试跑正常入口。继续？'))return;void invoke(event.currentTarget,()=>mutate(`/api/build/tasks/${encodeURIComponent(task.task_id)}/start`,jsonOptions({})));});
  document.querySelector('#revise-candidate')?.addEventListener('click',(event)=>{if(!confirm('将消耗本组最多一次修订额度；反馈仅使用正常入口问题。继续？'))return;void invoke(event.currentTarget,()=>mutate(`/api/build/tasks/${encodeURIComponent(task.task_id)}/revise`,jsonOptions({})));});
  document.querySelector('#stop-build')?.addEventListener('click',(event)=>void invoke(event.currentTarget,()=>mutate(`/api/build/tasks/${encodeURIComponent(task.task_id)}/stop`,jsonOptions({}))));
  const runCase=async(executed)=>{if(!confirm(`将使用同一候选 v${latest.version} 在 ${executed.external_id} 演示入口运行一次，不调用模型。继续？`))return;const body={candidate_version:latest.version,candidate_sha256:latest.sha256,executed_external_id:executed.external_id,case_id:executed.case_id,case_version:executed.case_version,content_sha256:executed.content_sha256};await invoke(document.activeElement,()=>mutate(`/api/build/tasks/${encodeURIComponent(task.task_id)}/trial-runs`,jsonOptions(body)));};
  document.querySelector('#run-pair')?.addEventListener('click',()=>void runCase(task.trial_binding.paired));
  document.querySelector('#rerun-pair')?.addEventListener('click',()=>void runCase(task.trial_binding.paired));
  document.querySelector('#rerun-normal')?.addEventListener('click',()=>void runCase(task.trial_binding.source));
  document.querySelector('#rerun-auth')?.addEventListener('click',(event)=>{if(!confirm(`将使用同一候选 v${latest.version} 与当前登录会话复跑一次，不调用模型；会话失效会立即停止。继续？`))return;void invoke(event.currentTarget,()=>mutate(`/api/build/tasks/${encodeURIComponent(task.task_id)}/auth-trial-runs`,jsonOptions({candidate_version:latest.version,candidate_sha256:latest.sha256})));});
}
async function renderBuildTasksRoute(project, taskId = null, isCurrent = currentNavigation()) {
  if(!taskId){const {tasks}=await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/build-tasks`);if(!isCurrent())return;return renderBuildTasks(project,tasks);}
  const task=await api(`/api/build/tasks/${encodeURIComponent(taskId)}`);if(!isCurrent())return;if(task.source?.project_id!==project.project_id)throw new ApiError('BUILD_TASK_NOT_FOUND',404);return renderBuildTaskDetail(project,task);
}

function failureSummary(run) {
  if (!run.error) return '';
  const expected = run.error.expected;
  const actual = run.error.actual;
  return `<div class="notice danger"><strong>${esc(run.error.type==='LOCATOR_OR_TARGET'?'断言或页面定位失败':statusText(run.error.type)||'执行失败')}</strong>${expected!=null?`<p>失败断言预期：${esc(expected)}</p>`:''}${actual!=null?`<p>失败断言实际：${esc(actual)}</p>`:expected==null?'<p>本次执行未单独采集断言实际值，请查看原始错误与证据。</p>':''}<details><summary>查看原始错误</summary><pre>${esc(run.error.message||run.error.type)}</pre></details></div>`;
}

// Keep recorded evidence ahead of explanatory material. Failure and incomplete
// evidence warnings remain visible; only the supporting detail is collapsed.
function prioritizeCaseEvidence(target) {
  const detail = target.querySelector('.execution-detail');
  if (!detail) return;
  const explanation = document.createElement('details');
  explanation.className = 'result-explanation';
  const summary = document.createElement('summary');
  const review = detail.querySelector(':scope > [data-testid="requirement-review"]');
  summary.textContent = `${review?.querySelector('strong')?.textContent ? review.querySelector('strong').textContent+' · 查看说明与运行详情' : '查看运行详情'}`;
  explanation.append(summary);
  const header = detail.querySelector(':scope > header');
  for (const node of [...(header?.querySelectorAll('p, details') || [])]) explanation.append(node);
  for (const node of [...detail.children]) {
    if (node === review || node.tagName === 'DETAILS' ||
      node.tagName === 'P' && !node.matches('.warning, .danger, [data-testid="window-recording-notice"]') && !node.querySelector('button')) explanation.append(node);
  }
  const evidence = detail.querySelector(':scope > .execution-evidence-layout');
  if (evidence) detail.insertBefore(explanation, evidence);
  else detail.append(explanation);
}

async function renderExecutionRecords(project, context=null, isCurrent=currentNavigation()) {
  const [{records:loadedRecords},nativeData,batchData]=await Promise.all([
    api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/execution-records`),
    context?null:loadNativeConsole(project,api),
    context?api(`/api/case-library/projects/${project.project_id}/batches`):null,
  ]);
  if(!isCurrent())return;
  let records=loadedRecords;
  const nativeHistory=context?null:nativeConsoleModel(project,nativeData);
  records=records.map(run=>({...run,failure_step:displayFailureStep(run)}));
  if(context)records=records.filter(r=>r.executed_case_id===context.item.case_id&&r.executed_case_version===context.version.version);
  const availableBatches=context?batchData.batches.filter(b=>b.state!=='PREVIEW'&&b.items.some(i=>i.case_id===context.item.case_id&&i.case_version===context.version.version)):[];
  let batch=null;const batchId=route().query.get('batch_id');
  if(context&&batchId){try{batch=await api(`/api/case-library/projects/${project.project_id}/batches/${encodeURIComponent(batchId)}`);if(!isCurrent())return;if(!batch.items.some(i=>i.case_id===context.item.case_id&&i.case_version===context.version.version))throw Error('批次不包含此用例版本');records=records.filter(r=>r.batch_id===batchId);}catch(e){if(isCurrent())document.querySelector('#case-results').textContent='指定批次不可用：'+e.message;return;}}
  if(!context)  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${encodeURIComponent(project.project_id)}/cases`},{label:'执行记录'}]);
  const recordsUrl = context ? `#/projects/${project.project_id}/cases/${context.item.case_id}?version=${context.version.version}&tab=results` : `#/projects/${encodeURIComponent(project.project_id)}/execution-records`;
  const query=route().query;
  const requestedRunId=query.has('run_id')?query.get('run_id'):(context?.pinnedRunId||null);
  const ordered=[...records].sort((left,right)=>String(left.started_at||'').localeCompare(String(right.started_at||'')));
  const selected=requestedRunId===null?(ordered.at(-1)||null):records.find((run)=>run.run_id===requestedRunId)||null;
  if(context&&selected)context.pinnedRunId=selected.run_id;
  const invalidRunMessage=requestedRunId!==null
    ?`指定的运行记录“${esc(requestedRunId||'（空值）')}”不存在、编号无效或不属于当前项目。没有替换为其他运行记录。`
    :'';
  const rows=records.map((run)=>{const index=executionIndexMeta(run,project.project_id);return `<tr${selected?.run_id===run.run_id?' class="selected-run"':''}><td><strong>${esc(run.executed_external_id)}</strong> v${run.executed_case_version}</td><td>${esc(index.source)}</td><td><details><summary>技术身份</summary><code>${esc(run.run_id)}<br>${esc(run.bundle_sha256||run.candidate_sha256)}</code></details></td><td>${resultBadge(run.status)}<small>${esc(index.origin)}${index.batchHref?` · <a data-nav href="${index.batchHref}">查看批次</a>`:''}</small></td><td>${esc(run.failure_step || '—')}</td><td><a data-nav href="${recordsUrl}${context?'&':'?'}run_id=${encodeURIComponent(run.run_id)}">查看详情</a>${index.taskHref?` · <a data-nav href="${index.taskHref}">${index.taskLabel}</a>`:''}</td></tr>`;}).join('');
  const steps=selected?executionSteps(selected):[];
  const {derived,original,replay:replayFile}=executionMediaFiles(selected);
  const replayReady=selected?.step_replay?.status==='READY'&&Boolean(replayFile);
  const screenshot=selected?.files?.find((file)=>file.kind.endsWith('_screenshot'));
  const trace=selected?.files?.find((file)=>file.kind.endsWith('_trace'));
  const timelineReady=selected?.caption_timeline?.status==='VERIFIED' && selected?.caption_timeline?.schema==='workbench/trial-timeline-v2' && Boolean(derived);
  const stepCards=steps.map((step)=>{
    const segment=timelineReady?selected.caption_timeline.presentation?.segments?.find((item)=>item.step_id===step.step_id):null;
    const runnable=segment&&step.execution_status!=='NOT_EXECUTED';
    return `<li class="execution-step" data-step-id="${esc(step.step_id)}"><button type="button" class="execution-step-select" data-step-seek="${esc(step.step_id)}" ${runnable?'':'disabled'} aria-label="${runnable?'定位到':'无法定位'}步骤 ${step.order}">${esc(step.order)}. ${esc(step.action)}</button><span class="badge ${step.execution_status==='FAILED'?'danger':step.execution_status==='PASSED'?'success':'warning'}">${esc(stepResultLabel(step, selected)||statusText(step.execution_status))}</span><dl><dt>预期</dt><dd>${esc(step.expected)}</dd><dt>实际</dt><dd>${esc(step.actual)}</dd>${step.execution_status==='FAILED'&&step.assertion_expected?`<dt>失败断言预期</dt><dd>${esc(step.assertion_expected)}</dd>`:''}</dl></li>`;
  }).join('');
  let detail=selected?`<article class="preview-item execution-detail" data-run-id="${esc(selected.run_id)}"><header><div><h3>${esc(selected.executed_external_id)} · 运行结果</h3><p>候选来源 ${esc(selected.source_external_id)} v${selected.source_case_version} · 当前执行 ${esc(selected.executed_external_id)} v${selected.executed_case_version}</p><details><summary>候选技术身份</summary><p>候选 v${selected.candidate_version} · SHA-256 ${esc(selected.candidate_sha256)} · build ${esc(selected.source_build_task_id)}</p></details></div>${resultBadge(executionDisplayStatus(selected))}</header><p>入口：${esc(selected.entry_route)} · 失败步骤：${esc(selected.failure_step||'无')} · 运行器：${esc(selected.runner_version||'历史版本未记录')}</p>${failureSummary(selected)}<details><summary>技术详情：运行身份与原始记录</summary><pre>${esc(JSON.stringify({run_id:selected.run_id,bundle_sha256:selected.bundle_sha256,candidate_sha256:selected.candidate_sha256,source_task_id:selected.source_build_task_id,environment:selected.environment_binding,execution_status:selected.execution_status,evidence_status:selected.evidence_status,technical_error:selected.technical_error,service_identity:selected.service_identity},null,2))}</pre></details>${selected.specified_defect_detected?'<p>对照验证检出指定缺陷；原始业务状态仍为失败。</p>':''}${derived&&!timelineReady?'<p class="notice warning">当前保留的是旧版中文字幕录像；原录像首帧与步骤事件的时间零点尚未验证，因此不提供精确步骤定位。</p>':''}<div class="execution-evidence-layout"><div class="execution-media"><h4>${derived?(timelineReady?'带中文字幕的交付录像':'旧版带中文字幕录像'):'原始录像'}</h4>${derived||original?`<video data-testid="execution-video" controls preload="metadata" src="${executionMediaUrl(selected,(derived||original).file_id)}"></video><p id="execution-video-message" role="status">${timelineReady?'播放位置随步骤更新。':'本次只有原始录像，无中文字幕，也没有已验证的步骤时间轴。下方步骤结果来自执行报告，不能精确定位到录像。'}</p>`:'<p class="notice danger">本次运行没有可用录像。</p>'}${derived?`<a href="${executionMediaUrl(selected,derived.file_id)}" download="${esc(selected.executed_external_id)}-captioned.webm">下载带字幕视频</a>`:''}${original?`<a href="${executionMediaUrl(selected,original.file_id)}" target="_blank" rel="noreferrer">打开原始录像</a>`:''}${screenshot?`<a href="${executionMediaUrl(selected,screenshot.file_id)}" target="_blank" rel="noreferrer">查看本次截图</a>`:'<span>截图未采集</span>'}${trace?`<a href="${executionMediaUrl(selected,trace.file_id)}" download>下载本次 Trace</a>`:'<span>Trace 未采集</span>'}</div><div class="execution-steps"><h4>本次运行步骤</h4><p id="execution-playing-step">播放位置：尚未播放</p><ol>${stepCards}</ol></div></div></article>`:requestedRunId!==null?`<div class="notice danger" role="alert" data-testid="run-record-not-found"><p>${invalidRunMessage}</p><a class="button" data-nav href="${recordsUrl}">返回运行列表</a></div>`:'<p class="muted">尚无运行记录。</p>';
  if(selected?.step_replay){
    const replay=selected.step_replay;
    const chapterById=new Map((replay.chapters||[]).map((chapter)=>[chapter.step_id,chapter]));
    const cards=steps.map((step)=>{
      const chapter=chapterById.get(step.step_id);
      const image=selected.files.find((file)=>file.file_name===step.screenshot_file_name&&file.kind.endsWith('_screenshot'));
      return `<li class="execution-step" data-step-id="${esc(step.step_id)}"><button type="button" class="execution-step-select" data-step-seek="${esc(step.step_id)}" ${replayReady&&chapter?'':'disabled'}>${esc(step.order)}. ${esc(step.action)}</button><span class="badge ${step.execution_status==='FAILED'?'danger':step.execution_status==='PASSED'?'success':'warning'}">${esc(stepResultLabel(step, selected)||statusText(step.execution_status))}</span><dl><dt>预期</dt><dd>${esc(step.expected)}</dd><dt>实际</dt><dd>${esc(step.actual)}</dd>${step.execution_status==='FAILED'?`<dt>原断言预期</dt><dd>${esc(step.assertion_expected||step.expected)}</dd>`:''}<dt>采集</dt><dd>${esc(step.screenshot_phase||'未采集')} · ${esc(step.screenshot_error||'步骤结束后截图，未录得连续动作片段')}</dd></dl>${image?`<a href="${executionMediaUrl(selected,image.file_id)}" target="_blank" rel="noreferrer">打开本步骤原始截图</a>`:step.execution_status!=='NOT_EXECUTED'?'<p class="notice danger">本步骤截图缺失。</p>':''}</li>`;
    }).join('');
    detail=`<article class="preview-item execution-detail" data-run-id="${esc(selected.run_id)}"><header><div><h3>${esc(selected.executed_external_id)} · 运行结果</h3><p>来源 ${esc(selected.source_external_id)} · ${selected.origin==='DEVELOPMENT_SELF_TEST'?'开发草稿 / 自测 '+esc(selected.number):selected.script_version?'脚本 S'+esc(selected.script_version):'历史候选 v'+esc(selected.candidate_version||'未登记')}</p></div>${resultBadge(executionDisplayStatus(selected))}</header><p>执行用例 v${selected.executed_case_version} · 运行器 ${esc(selected.runner_version||'自主开发验证执行器')}</p>${failureSummary(selected)}<details><summary>技术详情：运行身份与原始记录</summary><pre>${esc(JSON.stringify({run_id:selected.run_id,bundle_sha256:selected.bundle_sha256,candidate_sha256:selected.candidate_sha256,source_task_id:selected.source_build_task_id,environment:selected.environment_binding,execution_status:selected.execution_status,evidence_status:selected.evidence_status,technical_error:selected.technical_error,service_identity:selected.service_identity},null,2))}</pre></details>${selected.specified_defect_detected?'<p>对照验证检出指定缺陷；原始业务状态仍为失败。</p>':''}<p class="notice">步骤证据回放由本次运行的步骤截图和实际结果合成，不是原始连续录像。浏览器录像在本次时间轴核验通过后支持步骤定位。</p><div class="execution-evidence-layout"><div class="execution-media"><h4>中文步骤证据回放（非原始连续录像）</h4>${replayReady?`<video data-testid="execution-video" controls preload="metadata" src="${executionMediaUrl(selected,replayFile.file_id)}"></video><p id="execution-video-message" role="status">播放位置随回放章节更新；点击已执行步骤可定位。</p><a href="${executionMediaUrl(selected,replayFile.file_id)}" download="${esc(selected.executed_external_id)}-step-replay.webm">下载带中文字幕的步骤证据回放</a>`:`<p class="notice danger">步骤回放不可用：${esc(replay.reason||'素材未登记')}；原始业务结果未改变。</p>`}<h4>原始连续录像（不支持精确步骤定位）</h4>${original?`<video data-testid="original-video" controls preload="metadata" src="${executionMediaUrl(selected,original.file_id)}"></video><a href="${executionMediaUrl(selected,original.file_id)}" target="_blank" rel="noreferrer">单独打开原始连续录像</a><a href="${executionMediaUrl(selected,original.file_id)}" download="original.webm">下载原始连续录像</a>`:'<p class="notice danger">原始录像缺失。</p>'}${screenshot?`<a href="${executionMediaUrl(selected,screenshot.file_id)}" target="_blank" rel="noreferrer">查看运行截图</a>`:''}${trace?`<a href="${executionMediaUrl(selected,trace.file_id)}" download>下载本次 Trace</a>`:'<p>Trace 未采集</p>'}</div><div class="execution-steps"><h4>本次运行步骤</h4><p id="execution-playing-step">播放位置：尚未播放</p><ol>${cards}</ol></div></div></article>`;
  }
  if (original && selected?.step_replay?.action_highlight?.version==='passive-dom-v1' && selected.step_replay.action_highlight.status==='INSTALLED') {
    const highlightNote='<p class="notice" data-testid="action-highlight-legend">本次已启用操作高亮，请播放下方原始连续录像：橙框表示点击，绿框表示输入，紫框表示原生下拉选择，灰色虚线表示准备操作。高亮用于观察操作，不代表断言通过；步骤截图回放不含高亮。</p>';
    detail=detail.replace('<div class="execution-evidence-layout">',highlightNote+'<div class="execution-evidence-layout">');
  }
  if (selected) detail=detail.replace('<div class="execution-evidence-layout">', ((selected.approval_status==='NOT_REQUIRED'||selected.validation_source==='SELF_TEST')&&!selected.requirement_review?'':reviewHtml(selected.requirement_review))+windowRecordingNoticeHtml(selected)+'<div class="execution-evidence-layout">');
  if (selected && !selected.recording) detail += '<p class="notice warning">本次记录未登记录制尺寸，清晰度未核验。</p>';
  if (selected) {
    const active = ['QUEUED','RUNNING','STOPPING'].includes(selected.execution_status);
    detail += active ? '<p class="notice">正在执行已有文件包（模型调用0）。</p><button class="button" id="stop-candidate-trial">取消本次试跑</button>' : '';
    if (selected.evidence_status === 'LEGACY_STEP_CAPTURES_UNAVAILABLE') detail += '<p class="notice warning">本次运行未采集现场步骤截图，无法提供中文步骤证据回放；不事后补拍。</p>';
    if (selected.technical_error || selected.evidence_status === 'INCOMPLETE') detail += `<p class="notice danger">证据或技术处理不完整：${esc(selected.technical_error?.code || selected.evidence_error || '未取得完整证据')}；请与业务结果分开核对。</p>`;
    if (screenshot) detail += `<img data-testid="run-screenshot" src="${executionMediaUrl(selected,screenshot.file_id)}" width="640" alt="本次运行截图">`;
    if(active&&!context)setTimeout(()=>{if(route().parts[2]==='execution-records'&&route().query.get('run_id')===selected.run_id)void renderExecutionRecords(project);},1500);
  }
  if(selected){
    const note=stepOutcomeNotice(selected,steps);
    if(note)detail=detail.replace('<h4>本次运行步骤</h4>',`<h4>本次运行步骤</h4><p class="notice danger" data-testid="step-outcome-summary">${esc(note)}</p>`);
    if(!derived&&!replayReady)detail=detail.replace('<h4>原始录像</h4>','<h4>原始录像 · 无中文字幕</h4>');
  }
  if(selected?.step_replay?.evidence_complete===false)
    detail=detail.replace('<div class="execution-evidence-layout">',`<p class="notice danger">步骤截图采集不完整：${esc((selected.step_replay.missing_captures||[]).join('、'))}。回放可查看已取得素材，不能视为完整步骤证据。</p><div class="execution-evidence-layout">`);
  const backendRecord=selected&&(selected.runner_kind==='HTTP_JSON'||selected.selection?.kind==='HTTP_JSON'||selected.schema==='workbench/backend-run-v1');
  if(backendRecord){
    const ui=await loadBackendFeature();
    if(!isCurrent())return;
    detail=ui.backendRunHtml(selected);
    if(selected.batch_id&&['RUNNING','QUEUED','STOPPING'].includes(selected.execution_status))detail+='<button class="button" id="stop-backend-batch">取消本批运行并清理本次数据</button>';
  }
  if(context){
    const target=document.querySelector('#case-results');if(!target)return;
    const fingerprint=JSON.stringify([selected?.run_id,selected?.execution_status,selected?.evidence_status,selected?.window_recording,selected?.window_timeline,selected?.files,batch?.state]);
    if(target.dataset.fingerprint===fingerprint){if(batch&&['QUEUED','RUNNING','STOPPING'].includes(batch.state)){const raw=route().raw;setTimeout(()=>{if(route().raw===raw)void renderExecutionRecords(project,context);},1500);}return;}
    const oldVideos=[...target.querySelectorAll('video')];target.dataset.fingerprint=fingerprint;
    target.innerHTML=`<div class="panel-body case-result-body"><details class="result-history-switch"><summary>切换测试批次或历史运行</summary><div class="result-history-fields"><label>选择测试批次<select id="case-batch-choice"><option value="">全部历史（来源分别标识）</option>${availableBatches.map(b=>`<option value="${b.batch_id}" ${b.batch_id===batchId?'selected':''}>${esc(b.created_at)} · ${esc(b.software_version||'软件版本未提供')} · ${esc(stateLabel(b.state))}</option>`).join('')}</select></label>${batch?`<p><a data-nav href="#/projects/${project.project_id}/batches?batch_id=${batch.batch_id}">返回本批次</a> · ${esc(stateLabel(batch.state))} · 软件 ${esc(batch.software_version||'未提供')}</p>`:'<p>历史结果 / 来源未分批；开发自测与独立验证分别保留。</p>'}<label>选择本版本具体结果<select id="case-result-choice"><option value="">${batch?'本批最近结果':'本版本最近历史结果'}</option>${records.map(r=>`<option value="${esc(r.run_id)}" ${selected?.run_id===r.run_id?'selected':''}>${esc(r.started_at)} · ${esc(r.origin==='DEVELOPMENT_SELF_TEST'?'开发自测':r.batch_id?(r.approval_status==='NOT_REQUIRED'?'批次运行':'批次技术试跑'):'独立验证')} · ${esc(statusText(executionDisplayStatus(r)))}</option>`).join('')}</select></label></div></details>${selected?`<p class="selected-run-summary">${esc(fmtDate(selected.started_at))} · 用例 v${esc(selected.executed_case_version)} · ${selected.origin==='DEVELOPMENT_SELF_TEST'?'开发自测 '+esc(selected.number):selected.script_version?'脚本 S'+esc(selected.script_version):'历史候选 v'+esc(selected.candidate_version||'未登记')} · 软件 ${esc(selected.software_version||'未提供')}${batch?` · <a data-nav href="#/projects/${project.project_id}/batches?batch_id=${batch.batch_id}">查看本批次</a>`:''}</p>`:''}${detail}${!records.length?'<p>当前版本/选定批次尚未执行，不借用其他版本或批次的结果。</p>':''}</div>`;
    prioritizeCaseEvidence(target);
    for(const old of oldVideos){const replacement=[...target.querySelectorAll('video')].find(v=>v.src===old.src);if(replacement)replacement.replaceWith(old);else old.pause();}
    document.querySelector('#case-batch-choice').onchange=e=>go(recordsUrl+(e.target.value?'&batch_id='+e.target.value:''));
    document.querySelector('#case-result-choice').onchange=e=>go(recordsUrl+(batch?'&batch_id='+batch.batch_id:'')+(e.target.value?'&run_id='+encodeURIComponent(e.target.value):''));
    if(batch&&['QUEUED','RUNNING','STOPPING'].includes(batch.state)){const activeRoute=route().raw;setTimeout(()=>{if(route().raw===activeRoute)void renderExecutionRecords(project,context);},1500);}
  }else {
    const indexHtml=(selected||requestedRunId===null)?`<section class="panel"><div class="panel-header"><h2>运行索引</h2><span class="muted">${records.length} 条</span></div><div class="panel-body">${rows?`<div class="table-wrap"><table><thead><tr><th>执行用例</th><th>生成来源</th><th>技术详情</th><th>原始结果</th><th>失败步骤</th><th>详情</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty"><h2>暂无执行记录</h2><p>从用例创建任务并试跑后，记录会显示在这里。</p></div>'}</div></section>`:'';
    const detailHtml=`<section class="panel"><div class="panel-header"><h2>${requestedRunId!==null&&!selected?'运行记录未找到':'步骤与媒体'}</h2></div><div class="panel-body">${detail}</div></section>`;
    const directToRun=requestedRunId!==null && Boolean(selected);
    showPage(`<div class="page-heading"><div><p class="eyebrow">CANDIDATE TRIAL RECORDS</p><h1>项目执行记录</h1><p>每次运行的原始结果分别保留；执行结果与脚本或HTTP计划的确认状态分别核对。</p></div></div>${projectTabs(project,'execution-records')}${nativeHistory?nativeRecordsHtml(project,nativeHistory,{selectedRunId:query.get('native_run')}):''}${!records.length&&nativeHistory?.records.length&&!requestedRunId?'':directToRun?detailHtml+indexHtml:indexHtml+detailHtml}`);
  }
  if(!context)bindNativeConsole();
  if(selected && (['FAILED','TIMEDOUT','CANCELLED','INTERRUPTED'].includes(selected.status) || ['CANCELLED','INTERRUPTED'].includes(selected.execution_status))){
    const host=context?document.querySelector('#case-results .panel-body'):document.querySelector('[data-run-id]')?.parentElement;
    if(host){host.insertAdjacentHTML('beforeend',executionNotesHtml());void mountExecutionNotes({root:host.querySelector('.execution-notes'),projectId:project.project_id,runId:selected.run_id,api,jsonOptions});}
  }
  document.querySelector('#stop-candidate-trial')?.addEventListener('click',async()=>{await mutate(`/api/candidate-trials/${selected.run_id}/stop`,jsonOptions({}));});
  document.querySelector('#stop-backend-batch')?.addEventListener('click',async()=>{await mutate(`/api/case-library/projects/${project.project_id}/batches/${selected.batch_id}/cancel`,jsonOptions({}));await renderExecutionRecords(project,context);});
  const mediaController=selected&&!backendRecord?enhanceMedia(context?document.querySelector('#case-results'):app,selected):null;
  // The shared controller owns both real-window and synthetic replay clocks.
  // Legacy caption timelines below remain separate and must not bind this video.
  if(mediaController?.handlesSteps)return;
  const video=document.querySelector('[data-testid="execution-video"]');
  if(!video)return;
  video._executionBindings?.abort();const videoBindings=new AbortController();video._executionBindings=videoBindings;
  const bindVideo=(event,handler)=>video.addEventListener(event,handler,{signal:videoBindings.signal});
  const disableSeeking=()=>document.querySelectorAll('[data-step-seek]').forEach((button)=>{button.disabled=true;});
  bindVideo('error',()=>{document.querySelector('#execution-video-message').textContent='录像加载失败，请核对本次运行媒体；业务结果未改变。';disableSeeking();});
  const checkDuration=()=>{
    if(!Number.isFinite(video.duration)||video.duration<=0){
      document.querySelector('#execution-video-message').textContent='这段录像缺少可校验时长，不能精确定位步骤；请查看原始录像。';
      disableSeeking();
    }
  };
  bindVideo('loadedmetadata',checkDuration);
  if(video.readyState>=1)checkDuration();
  if(replayReady){
    const chapters=selected.step_replay.chapters||[];
    const playing=document.querySelector('#execution-playing-step');
    const update=()=>{
      const chapter=[...chapters].reverse().find((item)=>video.currentTime>=item.start_seconds-0.04&&video.currentTime<item.end_seconds+0.04);
      document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('playing',item.dataset.stepId===chapter?.step_id));
      playing.textContent=chapter?`播放位置：步骤 ${steps.find((step)=>step.step_id===chapter.step_id)?.order} · ${video.currentTime>=chapter.result_start_seconds?'结果':'动作'}`:'播放位置：章节间';
    };
    bindVideo('timeupdate',update);bindVideo('seeked',update);
    document.querySelectorAll('[data-step-seek]').forEach((button)=>button.addEventListener('click',()=>{
      const chapter=chapters.find((item)=>item.step_id===button.dataset.stepSeek);if(!chapter)return;
      document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('selected',item.dataset.stepId===button.dataset.stepSeek));
      const phaseStart=steps.find((step)=>step.step_id===button.dataset.stepSeek)?.execution_status==='FAILED'
        ?chapter.result_start_seconds:chapter.start_seconds;
      // Canvas recording timestamps precede the encoded frame by a few frames.
      // Seek inside the selected phase so a paused player does not show the prior step.
      video.currentTime=Math.min(phaseStart+0.15,chapter.end_seconds-0.02);
    }));
    return;
  }
  if(!timelineReady)return;
  const segments=selected.caption_timeline.presentation?.segments||[];
  const playing=document.querySelector('#execution-playing-step');
  const updatePlayback=()=>{
    if(video.hidden)return;
    const segment=[...segments].reverse().find((item)=>video.currentTime>=item.action_start_seconds-0.08&&video.currentTime<item.end_seconds+0.08);
    document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('playing',item.dataset.stepId===segment?.step_id));
    playing.textContent=segment?`播放位置：步骤 ${steps.find((item)=>item.step_id===segment.step_id)?.order} · ${video.currentTime>=segment.result_start_seconds?'结果':'操作'}`:'播放位置：步骤间';
  };
  bindVideo('timeupdate',updatePlayback);
  bindVideo('seeked',updatePlayback);
  document.querySelectorAll('[data-step-seek]').forEach((button)=>button.addEventListener('click',()=>{
    const segment=segments.find((item)=>item.step_id===button.dataset.stepSeek);if(!segment)return;
    document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('selected',item.dataset.stepId===button.dataset.stepSeek));
    const step=steps.find((item)=>item.step_id===button.dataset.stepSeek);
    video.currentTime=step?.execution_status==='FAILED'
      ? Math.max(segment.action_start_seconds,segment.result_start_seconds-0.35)
      : segment.action_start_seconds;
  }));
}

function focusExecutionRecord(runId) {
  if (!runId) return;
  const target = [...document.querySelectorAll('.execution-detail[data-run-id]')].find((item) => item.dataset.runId === runId);
  if (target) { target.tabIndex = -1; target.style.scrollMarginTop = '72px'; target.scrollIntoView({ block:'start' }); target.focus({ preventScroll:true }); }
}

async function renderSettings(project) {
  const id = encodeURIComponent(project.project_id);
  const [uiResult, backendResult] = await Promise.allSettled([
    api(`/api/script-environments?project_id=${id}`),
    api(`/api/case-library/projects/${id}/backend/environments`),
  ]);
  const uiEnvironments = uiResult.status === 'fulfilled' ? uiResult.value.environments : [];
  const backendEnvironments = backendResult.status === 'fulfilled' ? (backendResult.value.environments || []).map(env => ({
    id: env.environment_id, name: env.name, entry_url: env.base_url,
    source: 'PROJECT_UI_REGISTRATION', operator: env.reviewer, registered_at: env.created_at,
    purpose: env.mode === 'http-json-readonly' ? '后端 HTTP/JSON 只读 GET' : '后端合成 namespace',
    auth_label: env.mode === 'http-json-readonly' && Array.isArray(env.allowed_headers) && env.allowed_headers.length === 0
      ? '无需登录' : env.mode === 'synthetic-namespace' ? '合成角色请求头（非人工登录）' : '未记录',
    allowed_path_prefixes: env.allowed_path_prefixes, status_label: '已登记（可用性未在此检查）',
  })) : [];
  const catalogNotice = [uiResult.status === 'rejected' ? '前端被测系统配置暂无法读取。' : '', backendResult.status === 'rejected' ? '后端 HTTP/JSON 配置暂无法读取。' : ''].filter(Boolean).join(' ');
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:'项目设置' }]);
  showPage(`<div class="page-heading"><div><p class="eyebrow">PROJECT SETTINGS</p><h1>项目设置</h1><p>管理项目名称和说明，并查看本项目可见的被测系统配置。</p></div></div>${projectTabs(project, 'settings')}
    <section class="panel settings-card"><div class="panel-header"><h2>基本信息</h2><span class="mono">${esc(project.project_id)}</span></div><div class="panel-body"><form id="settings-form" class="form-grid"><label class="field wide"><span>项目名称</span><input name="name" value="${esc(project.name)}" maxlength="120" required></label><label class="field wide"><span>项目说明</span><textarea name="description" rows="5" maxlength="5000">${esc(project.description)}</textarea></label><div class="notice wide">当前项目修订 r${project.revision}。若其他标签页先保存，当前请求会被后端拒绝而不会静默覆盖。</div><div class="actions wide"><button class="button primary" type="submit">保存项目信息</button></div></form></div></section>${catalogNotice ? `<p class="notice warning">${catalogNotice}</p>` : ''}${targetCatalogMarkup([...uiEnvironments, ...backendEnvironments])}<p><a data-nav href="#/projects/${id}/auth">查看登录状态或登记无需登录的新被测系统</a></p>`);
  document.querySelector('#settings-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('[type=submit]'); button.disabled = true; const data = new FormData(event.currentTarget); try { state.project = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}`, jsonOptions({ revision:project.revision, name:String(data.get('name')), description:String(data.get('description')) }, 'PATCH')); toast('项目信息已由后端保存。'); renderSettings(state.project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
}

const authStatusLabels = {
  NOT_LOGGED_IN: '未登录', AWAITING_LOGIN: '等待人工登录', VALID: '有效',
  EXPIRED: '已过期', ROLE_MISMATCH: '角色不符', PERMISSION_DENIED: '权限不足',
  CHECK_UNAVAILABLE: '身份检查暂不可用', IDENTITY_UNVERIFIED: '身份依据不足',
  IDENTITY_CHANGED: '账号发生变化', BROWSER_CLOSED: '专用浏览器已关闭',
};

async function renderAuth(project) {
  const id = encodeURIComponent(project.project_id);
  const endpoint = `/api/case-library/projects/${id}/auth`;
  const [{ environments },targets,registeredTargets] = await Promise.all([
    api(endpoint), api(`/api/script-environments?project_id=${encodeURIComponent(project.project_id)}`),
    api(`/api/case-library/projects/${id}/targets`),
  ]);
  const environment = environments[0];
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${id}/cases` }, { label:'登录准备' }]);
  showPage(`<div class="page-heading"><div><p class="eyebrow">TARGET AUTHENTICATION</p><h1>被测系统与登录</h1><p>被测系统配置记录目标地址、允许范围和登录条件；它不代表被测软件版本。测试浏览器由执行器独立启动。</p></div></div>${projectTabs(project,'auth')}
    ${targetCatalogMarkup(targets.environments)}
    ${projectTargetsMarkup(registeredTargets.targets)}
    <section class="panel settings-card"><div class="panel-header"><h2>需要登录的系统（按用例需要准备）</h2></div><div class="panel-body">
    ${environment ? `<div class="form-grid"><label class="field" ${environments.length === 1 ? 'hidden' : ''}><span>被测系统</span><select id="auth-environment">${environments.map(item=>`<option value="${esc(item.environment_id)}">${esc(item.name)}</option>`).join('')}</select></label>${environments.length === 1 ? `<p>当前被测系统：${esc(environment.name)}</p>` : ''}
    <label class="field"><span>账号角色</span><select id="auth-role"></select></label></div>
    <p id="auth-status" role="status" class="notice">正在检查登录状态…</p>
    <div class="actions"><button class="button primary" id="auth-open">打开专用登录浏览器</button><button class="button" id="auth-check">检查登录</button><button class="button" id="auth-clear">清除会话</button></div>` : '<p class="notice">当前没有需要在此准备登录的系统；这不表示上方本机测试页面不可运行。</p>'}
    <p class="notice">以下登录功能仅用于已绑定登录环境的用例。请在专用窗口自行输入账号和密码；验证码、扫码或多因素认证也由你完成。登录阶段不启动模型观察、不采集业务录像、截图或 Trace。选择与用例绑定的环境及角色，显示“有效”后，启动建例与候选复跑会复核并绑定当前会话版本；会话失效或被清除时关联运行立即停止，需要重新登录后再复跑。</p>
    </div></section>`);
  bindProjectTargets(project, () => renderAuth(project));
  if (!environment) return;
  const envSelect = document.querySelector('#auth-environment');
  const roleSelect = document.querySelector('#auth-role');
  const statusNode = document.querySelector('#auth-status');
  const currentScope = () => ({ environment_id:envSelect.value, role:roleSelect.value });
  const fillRoles = () => {
    const current = environments.find(item=>item.environment_id===envSelect.value);
    roleSelect.innerHTML = current.roles.map(role=>`<option value="${esc(role)}">${esc(role)}</option>`).join('');
  };
  const showStatus = (value) => {
    statusNode.textContent = value.verification_mode==='browser-page'
      ? `状态：${value.status==='VALID'?'页面访问已确认':authStatusLabels[value.status] || value.status} · 人工登录会话${value.reason?' · 请检查页面访问或重新登录':''}`
      : `状态：${authStatusLabels[value.status] || value.status} · 角色：${value.role} · 账号：${value.account_id || '未确认'}${value.expires_at ? ` · 服务端有效期至 ${fmtDate(value.expires_at)}` : ''}${value.reason ? ` · 原因：${value.reason}` : ''}`;
    statusNode.classList.toggle('danger', value.status !== 'VALID' && value.status !== 'AWAITING_LOGIN' && value.status !== 'NOT_LOGGED_IN');
  };
  const loadStatus = async () => {
    const scope = currentScope();
    const result = await api(`${endpoint}?environment_id=${encodeURIComponent(scope.environment_id)}&role=${encodeURIComponent(scope.role)}`);
    showStatus(result.session);
  };
  const act = async (operation) => {
    const buttons = [...document.querySelectorAll('#auth-open,#auth-check,#auth-clear')];
    buttons.forEach(button=>button.disabled=true);
    try {
      const result = await mutate(`${endpoint}/${operation}`, jsonOptions({...currentScope(),...(operation==='check'?{confirm_login:true}:{})}));
      showStatus(result);
      if (operation==='open') toast('专用登录窗口已打开；完成登录后点击“检查登录”。');
    } catch (error) { toast(messageFor(error),'error'); }
    finally { buttons.forEach(button=>button.disabled=false); }
  };
  fillRoles();
  envSelect.addEventListener('change', () => { fillRoles(); void loadStatus().catch(error=>toast(messageFor(error),'error')); });
  roleSelect.addEventListener('change', () => void loadStatus().catch(error=>toast(messageFor(error),'error')));
  document.querySelector('#auth-open').addEventListener('click', () => void act('open'));
  document.querySelector('#auth-check').addEventListener('click', () => void act('check'));
  document.querySelector('#auth-clear').addEventListener('click', () => void act('clear'));
  await loadStatus();
}

async function renderProjectEnvironment(project, isCurrent=currentNavigation()) {
  const id = encodeURIComponent(project.project_id), endpoint = `/api/case-library/projects/${id}/environment`;
  const [environment, targets, authData] = await Promise.all([
    api(endpoint), api(`/api/case-library/projects/${id}/targets`), api(`/api/case-library/projects/${id}/auth`),
  ]);
  if(!isCurrent())return;
  const uiOptions = environment.ui_options || [], backendOptions = environment.backend_options || [];
  const ui = environment.ui, backend = environment.backend;
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${id}/cases`},{label:'项目测试环境'}]);
  const uiAddress = value => value?.entry_url || value?.entry || value?.target_scope?.origin || '未记录地址';
  showPage(`<div class="page-heading"><div><p class="eyebrow">PROJECT TEST ENVIRONMENT</p><h1>项目测试环境</h1><p>先设置这个项目要测试的网站和接口。保存后，生成、示范和运行统一使用这里的配置。</p></div><a class="button" data-nav href="#/projects/${id}/automation">去准备自动化</a></div>${projectTabs(project,'auth')}
    <section class="panel settings-card"><div class="panel-header"><h2>当前项目环境</h2><span class="mono">修订 r${esc(environment.revision)}</span></div><div class="panel-body"><form id="project-environment-form" class="form-grid">
      <label class="field"><span>UI 测试环境</span><select name="ui_environment_id"><option value="">未配置</option>${uiOptions.map(option=>`<option value="${esc(option.id)}" ${option.id===environment.ui_environment_id?'selected':''}>${esc(option.name||option.id)} · ${esc(uiAddress(option))}</option>`).join('')}</select></label>
      <label class="field"><span>HTTP 测试环境</span><select name="backend_environment_id"><option value="">未配置</option>${backendOptions.map(option=>`<option value="${esc(option.environment_id)}" ${option.environment_id===environment.backend_environment_id?'selected':''}>${esc(option.name)} · ${esc(option.base_url)}</option>`).join('')}</select></label>
      <p class="notice wide">当前 UI：${ui?`${esc(ui.name||ui.id)} · ${esc(uiAddress(ui))} · ${ui.auth_required?`需要登录${ui.auth_role?`（${esc(ui.auth_role)}）`:''}`:'无需登录'}`:'未配置'}<br>当前 HTTP：${backend?`${esc(backend.name)} · ${esc(backend.base_url)}`:'未配置'}</p>
      ${[environment.ui_status,environment.backend_status].includes('PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED')?'<p class="notice warning wide">已保存的环境配置发生变化，请重新核对并保存；旧脚本仍须与生成时的环境一致。</p>':''}
      <p class="muted wide">UI 用于浏览器操作，HTTP 用于接口测试；只做其中一种时，可只配置对应入口。更换环境后，旧脚本和历史结果保留，执行前会重新检查是否适用。</p>
      <div class="actions wide"><button class="button primary" type="submit">保存项目测试环境</button><span id="project-environment-status" role="status"></span></div></form></div></section>
    <details class="panel settings-card"><summary>新建本项目 UI 环境</summary><div class="panel-body">${projectTargetsMarkup(targets.targets||[])}</div></details>
    <details class="panel settings-card"><summary>查看可选 UI 环境的地址、来源与登录要求</summary><div class="panel-body">${targetCatalogMarkup(uiOptions)}</div></details>
    <details class="panel backend-environments"><summary>新建本项目 HTTP 环境</summary><div class="panel-body"><p>创建后设为项目当前 HTTP 环境。普通 HTTP 仅 GET；合成 namespace 按隔离写入与清理协议执行。</p><form id="project-backend-environment-form" class="form-grid"><label class="field"><span>环境名称</span><input name="name" required maxlength="100"></label><label class="field"><span>根地址</span><input name="base_url" type="url" required placeholder="http://127.0.0.1:4401"></label><label class="field"><span>环境模式</span><select name="mode"><option value="http-json-readonly">普通 HTTP/JSON 只读 GET</option><option value="synthetic-namespace">合成 namespace 隔离写入</option></select></label><label class="field wide"><span>允许路径前缀（每行一个）</span><textarea name="allowed_path_prefixes" rows="3"></textarea></label><label class="field"><span>核对人</span><input name="reviewer" required maxlength="100"></label><label class="backend-check"><input name="non_production" type="checkbox" required>确认非生产环境</label><label class="backend-check wide"><input name="authorized" type="checkbox" required>确认已获授权</label><div class="actions wide"><button class="button" type="submit">创建并设为项目 HTTP 环境</button><span id="project-backend-environment-status" role="status"></span></div></form></div></details>
    <section class="panel settings-card"><div class="panel-header"><h2>当前 UI 登录条件</h2></div><div class="panel-body">${ui?.auth_required?`<p>当前环境要求登录${ui.auth_role?`，角色：${esc(ui.auth_role)}`:''}。复杂登录继续使用专用浏览器，由操作者完成账号、验证码或多因素认证。</p><div class="form-grid"><label class="field"><span>账号角色</span><select id="project-auth-role">${(authData.environments?.find(item=>item.environment_id===environment.ui_environment_id)?.roles||[ui.auth_role].filter(Boolean)).map(role=>`<option value="${esc(role)}">${esc(role)}</option>`).join('')}</select></label></div><p id="project-auth-status" role="status" class="notice">登录状态待检查。</p><div class="actions"><button class="button primary" id="project-auth-open">打开专用登录浏览器</button><button class="button" id="project-auth-check">检查登录</button><button class="button" id="project-auth-clear">清除会话</button></div>`:(ui?'<p class="notice">当前 UI 环境无需登录。</p>':'<p class="notice">尚未设置 UI 环境。</p>')}${!ui?'<p class="notice warning">请先在上方选择或登记 UI 环境。</p>':''}</div></section>`);
  document.querySelector('#project-environment-form').addEventListener('submit', async event=>{
    event.preventDefault(); const form=new FormData(event.currentTarget), button=event.currentTarget.querySelector('[type=submit]'), status=document.querySelector('#project-environment-status'); button.disabled=true;
    try { const saved=await mutate(endpoint,jsonOptions({revision:environment.revision,ui_environment_id:String(form.get('ui_environment_id')||'')||null,backend_environment_id:String(form.get('backend_environment_id')||'')||null})); status.textContent=`项目测试环境已保存（r${saved.revision}）。`; await renderProjectEnvironment(project); }
    catch(error) { status.textContent=messageFor(error); button.disabled=false; }
  });
  bindProjectTargets(project,()=>renderProjectEnvironment(project));
  document.querySelector('#project-backend-environment-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=new FormData(event.currentTarget), status=document.querySelector('#project-backend-environment-status'), button=event.currentTarget.querySelector('[type=submit]'); button.disabled=true;
    try {
      const value=await api(`/api/case-library/projects/${id}/backend/environments`,jsonOptions({name:String(form.get('name')),base_url:String(form.get('base_url')),mode:String(form.get('mode')),allowed_path_prefixes:String(form.get('allowed_path_prefixes')||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean),reviewer:String(form.get('reviewer')),non_production:form.has('non_production'),authorized:form.has('authorized')}));
      try {
        const current=await api(endpoint);
        await mutate(endpoint,jsonOptions({revision:current.revision,ui_environment_id:current.ui_environment_id,backend_environment_id:value.environment_id}));
        await renderProjectEnvironment(project);
        toast(`${value.name} 已创建并设为项目当前 HTTP 环境。`);
      } catch(error) {
        status.textContent=`${value.name} 已创建，但尚未设为项目当前环境（${messageFor(error)}）；刷新后在上方选择并保存。`;
      }
      button.disabled=false;
    }
    catch(error) { status.textContent=`登记失败：${messageFor(error)}`; button.disabled=false; }
  });
  if(ui?.auth_required){
    const endpointAuth=`/api/case-library/projects/${id}/auth`, role=document.querySelector('#project-auth-role'), status=document.querySelector('#project-auth-status');
    const scope=()=>({environment_id:environment.ui_environment_id,role:role.value});
    const show=session=>{status.textContent=session.verification_mode==='browser-page'?`状态：${session.status==='VALID'?'页面访问已确认':authStatusLabels[session.status]||session.status} · 人工登录会话`:`状态：${authStatusLabels[session.status]||session.status} · 角色：${session.role} · 账号：${session.account_id||'未确认'}${session.reason?` · ${session.reason}`:''}`;};
    const check=async()=>show((await api(`${endpointAuth}?environment_id=${encodeURIComponent(scope().environment_id)}&role=${encodeURIComponent(scope().role)}`)).session);
    const act=async operation=>{try{const value=await mutate(`${endpointAuth}/${operation}`,jsonOptions({...scope(),...(operation==='check'?{confirm_login:true}:{})}));show(value);if(operation==='open')toast('专用登录窗口已打开；完成登录后点击“检查登录”。');}catch(error){toast(messageFor(error),'error');}};
    document.querySelector('#project-auth-open').onclick=()=>void act('open'); document.querySelector('#project-auth-check').onclick=()=>void act('check'); document.querySelector('#project-auth-clear').onclick=()=>void act('clear');
    role.onchange=()=>void check().catch(error=>toast(messageFor(error),'error'));
    await check().catch(error=>{status.textContent=messageFor(error);});
  }
}

async function renderDevelopmentStart(project, isCurrent=currentNavigation()) {
  const response = await api('/api/build/development-authorizations');
  if(!isCurrent())return;
  const entries = response.authorizations.filter(item => item.project_id === project.project_id);
  showPage(`<div class="page-heading"><h1>自主建例</h1></div>${projectTabs(project, 'develop')}<section class="panel"><div class="panel-body"><p>Agent观察正常页面、编写并实际自测，失败后在同一任务内有限修订。最终独立验证后仍等待人工核对。</p>${entries.length ? entries.map(entry => `<article class="preview-item"><h2>${esc(project.cases.find(c => c.case_id === entry.case_id)?.title || entry.logical_id)}</h2><p>${entry.mode === 'recovery' ? '继续完善已有草稿' : '自主观察、编写和验证'}；Agent决定何时交付，工作台独立验收。</p><details><summary>技术详情：任务范围与停止边界</summary><pre>${esc(JSON.stringify({logical_id:entry.logical_id,limits:entry.limits},null,2))}</pre></details>${entry.task_id ? `<a class="button" data-nav href="${buildTaskUrl(project, {task_id:entry.task_id})}">查看任务</a>` : `<button class="button primary" data-develop="${esc(entry.logical_id)}">开始已授权任务</button>`}</article>`).join('') : '<p>当前项目没有已登记的自主建例授权。</p>'}</div></section>`);
  document.querySelectorAll('[data-develop]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { const task = await mutate('/api/build/tasks/develop', jsonOptions({ logical_id: button.dataset.develop })); go(buildTaskUrl(project, task)); }
    catch (error) { toast(messageFor(error), 'error'); button.disabled = false; }
  }));
}

function renderDevelopmentDetail(project, task) {
  const development = task.development || {};
  const candidate = task.candidates?.at(-1);
  const tests = development.self_tests || [];
  const qualityReviews = development.quality_reviews || [];
  const reviewMode = task.quality_policy?.quality_review_mode || 'static-v1';
  const independentValidations = development.independent_validations || [];
  const failure = task.failure || null;
  const fidelity = [development.fidelity_review, development.fidelity].find(value => value && typeof value === 'object') || null;
  const finiteChecks = fidelity?.finite_checks || fidelity;
  const serviceIdentity = task.service_identity || null;
  const fidelityGaps = (finiteChecks?.obligations || []).filter(item => item.status === 'INSUFFICIENT').length;
  const fastMode = reviewMode === 'self-test-v1';
  const fidelitySummary = fastMode ? `有限规则检查：${fidelityGaps} 项已识别缺口；运行资格依据当前脚本的自测结果。` : fidelity ? `有限规则核查：${fidelityGaps} 项明确缺口，${(finiteChecks.pre_step_state_changes || []).length} 处初始化或首步骤内状态选择，需对照原动作；材料不代替人工核对。` : '有限规则核查材料未记录；仍需人工核对。';
  const bundleMatch = fidelity?.bundle_sha256 && development.submission?.bundle?.sha256 ? fidelity.bundle_sha256 === development.submission.bundle.sha256 : null;
  const statusLabel = task.active_attempt_id ? (task.task_status === 'VERIFYING' ? '正在独立验收' : tests.at(-1)?.result?.test_status === 'FAILED' ? '发现执行问题，正在分析与修订' : '正在自主开发') : task.task_status === 'READY' ? '自测通过，脚本已保存，可直接运行' : task.task_status === 'ENVIRONMENT_BLOCKED' ? '前置条件受阻，请补齐数据或环境' : task.task_status === 'WAITING_HUMAN_REVIEW' ? '独立技术验证完成，待核对' : task.task_status === 'CANCELLED' ? '已取消' : development.submission?.outcome === 'business_difference' ? '发现业务差异，待分析' : '任务未完成，查看原因';
  const row = run => `<article class="preview-item"><h3>${esc(run.number ? `开发自测 ${run.number}` : `最终 ${run.run_type}`)} · ${esc(run.status)}</h3><p>候选 SHA：${esc(run.sha256 || run.candidate_sha256)}</p><pre>${esc(JSON.stringify(run.result?.error || run.error || null, null, 2))}</pre><ul>${(run.coverage?.items || run.step_coverage?.items || []).map(step => `<li>${esc(step.marker)}：${esc(step.execution_status)}</li>`).join('')}</ul></article>`;
  const files = (task.files || []).filter(file => file.web_visible && /\.(json|mjs|txt|png|webm|zip)$/.test(file.file_name)).map(file => `<a href="/api/build/tasks/${encodeURIComponent(task.task_id)}/${/\.(png|webm|zip)$/.test(file.file_name)?'media':'files'}/${encodeURIComponent(file.file_id)}" target="_blank" rel="noopener">${esc(file.relative_path)}</a>`).join('<br>');
   showPage(`<div class="page-heading"><h1>自主建例任务 · ${esc(task.source.external_id)}</h1></div>${projectTabs(project, 'build-tasks')}<section class="panel"><div class="panel-body"><p data-testid="development-status" data-state="${esc(task.task_status)}">${esc(statusLabel)}</p><p>${fastMode?'自测通过即可运行；AI 审核和人工确认已关闭。':'冻结业务预期不变；技术验证不代表人工批准。'}</p>${development.blocker?`<div class="notice warning"><strong>前置条件：${esc(development.blocker.requirement)}</strong><p>实际检查：${esc(development.blocker.observed)}</p><p>受阻原因：${esc(development.blocker.reason)}</p></div>`:''}${failure ? `<p class="notice warning">任务未完成原因：${esc(failure.category || '未分类')} · ${esc(failure.reason || '未记录')}</p>` : ''}<p>${esc(fidelitySummary)}</p>${task.active_attempt_id ? '<button class="button" id="cancel-development">取消任务</button>' : ''}${task.error ? `<pre>${esc(JSON.stringify(task.error, null, 2))}</pre>` : ''}${(candidate?.trial_runs || []).map(row).join('')}<details data-testid="development-technical"><summary>技术详情：开发过程、资源与覆盖核查</summary><p data-testid="development-counts">审查模式 ${esc(reviewMode)} · 作者 Harness ${development.harness_starts || 0} · 审查 DSH 启动占额 ${development.reviewer_harness_starts ?? 0} · 工具合计 ${development.tool_calls || 0}（审查工具 ${development.reviewer_tool_calls_used ?? 0}） · 开发执行 ${tests.length}/${task.authorization?.limits?.self_tests || '未登记'} · 质量审查 ${qualityReviews.length}/${task.authorization?.limits?.quality_reviews ?? 3} · 独立复验 ${independentValidations.length}/${task.authorization?.limits?.independent_validations ?? 2}</p><p>${esc(task.task_status)} · ${esc(task.human_review_status)} · 验证范围 ${esc(task.environment_ref?.validation_mode || 'paired')}</p>${tests.map(row).join('')}<h2>${fastMode?'AI 审核已关闭':'独立质量审查（不代替人工批准）'}</h2>${qualityReviews.map(review => `<p>第 ${esc(review.number)} 次 · ${esc(review.status)} · 自测 ${esc(review.self_test)} · 发现 ${esc(review.review?.findings?.length ?? '未知')} 项 · 错误 ${esc(review.review?.error_code ?? '无')} · 模式 ${esc(review.mode || reviewMode)} · 审查 DSH 启动占额 ${esc(review.reviewer_harness_starts ?? 0)} · 实际启动 ${esc(review.review?.harness_starts ?? '未知')} · 审查工具 ${esc(review.reviewer_tool_calls_used ?? 0)} · 模型调用 ${esc(review.review?.model_calls ?? '未知')} · 模型用量 ${esc(review.review?.usage == null ? '未知' : JSON.stringify(review.review.usage))}</p><details><summary>逐项审查及受控工具过程</summary><pre>${esc(JSON.stringify({findings: review.review?.findings || [], investigation: review.review?.investigation || null, process_diagnostic: review.review?.process_diagnostic || null}, null, 2))}</pre></details>`).join('')}<h2>${fastMode?'复用已通过的自测证据，无重复复验':'提交前独立正常复验'}</h2>${independentValidations.map(row).join('')}<h2>Agent提交的覆盖核查材料（不代替独立验收）</h2><pre>${esc(JSON.stringify(development.submission?.coverage || [], null, 2))}</pre><h2>有限规则与原要求核查</h2><p>有限规则检查保留已识别的动作、前提与断言缺口。</p><p>核查包与提交包：${bundleMatch === true ? '哈希一致' : bundleMatch === false ? '哈希不一致，待核对' : '未能比对'}</p><pre>${esc(JSON.stringify(fidelity, null, 2))}</pre><h2>任务失败分类与服务身份</h2><pre>${esc(JSON.stringify({failure, service_identity:serviceIdentity}, null, 2))}</pre></details><details><summary>执行证据与文件</summary>${files}</details></div></section>`);
  document.querySelector('#cancel-development')?.addEventListener('click', async () => { await mutate(`/api/build/tasks/${encodeURIComponent(task.task_id)}/stop`, jsonOptions({})); });
  if (task.active_attempt_id) setTimeout(async () => {
    if (!location.hash.includes(task.task_id)) return;
    try { renderDevelopmentDetail(project, await api(`/api/build/tasks/${encodeURIComponent(task.task_id)}`)); } catch (error) { toast(messageFor(error), 'error'); }
  }, 1500);
}

let renderEpoch = 0;
function currentNavigation() {
  const epoch=renderEpoch,hash=location.hash;
  return ()=>epoch===renderEpoch&&hash===location.hash;
}
let activeRequirementsRoute = null;
let activeProjectDispose = null;
async function render(force = false) {
  const epoch = ++renderEpoch;
  activeProjectDispose?.(); activeProjectDispose = null;
  const requestedRoute = route();
  const nextRequirementsRoute = requestedRoute.parts[2] === 'requirements' && requestedRoute.query.get('view') === 'legacy'
    ? `${requestedRoute.parts[1]}/requirements` : null;
  if (activeRequirementsRoute && activeRequirementsRoute !== nextRequirementsRoute) {
    loadedRequirementsUi?.disposeRequirementsPolling?.();
  }
  activeRequirementsRoute = nextRequirementsRoute;
  if (force || visiblePageRoute !== location.hash) { loading.hidden = false; app.hidden = true; state.error = null; }
  try {
    // Connection monitoring must not serialize every navigation behind health.
    // Execution and restart still use their own server-side admission checks.
    void refreshServiceHealth().catch(() => {});
    const isProjectIndex = requestedRoute.parts.length === 1 && requestedRoute.parts[0] === 'projects';
    if (isProjectIndex && (!state.projectsLoaded || force)) await loadProjects();
    if (epoch !== renderEpoch) return;
    const value = requestedRoute; const parts = value.parts;
    if(parts[0]==='model-settings') {setSidebarNavigation(null);setBreadcrumb([{label:'项目',href:'#/projects'},{label:'模型设置'}]);const dispose=await renderModelSettings({showPage:html=>{if(epoch===renderEpoch)showPage(html);},isCurrent:()=>epoch===renderEpoch});if(epoch===renderEpoch)activeProjectDispose=dispose;else dispose?.();return;}
    if(parts[0]==='history'){setSidebarNavigation(null);setBreadcrumb([{label:'项目',href:'#/projects'},{label:'历史记录'}]);return await renderHistory({query:value.query,showPage,go});}
    if (!parts.length || parts[0] !== 'projects') return go('#/projects', true);
    if (parts.length === 1) { state.activeProjectId = null; state.selected.clear(); state.caseType = ''; state.query = ''; state.module = ''; state.status = ''; return renderProjects(); }
    const projectId = parts[1];
    if (state.activeProjectId !== projectId) { loadedRequirementsUi?.resetRequirementsSelection(); state.selected.clear(); state.query = ''; state.module = ''; state.status = ''; state.caseType = ''; state.page = 1; state.activeProjectId = projectId; }
    const project = await loadProject(projectId);
    if (epoch !== renderEpoch) return;
    const expectedHash = location.hash;
    const scopedShowPage = html => { if (epoch === renderEpoch && location.hash === expectedHash) showPage(html); };
    setSidebarNavigation(project, parts[2] || '');
    const isCurrent = () => epoch === renderEpoch && location.hash === expectedHash;
    const installProjectPage = async pending => {
      const dispose = await pending;
      if (isCurrent()) activeProjectDispose = dispose || null; else dispose?.();
    };
    const setupPage = () => renderProjectSetup({project,showPage:scopedShowPage,go,isCurrent,onDirty:dirty=>{if(isCurrent())state.environmentDirty=dirty;}});
    if (!parts[2] || parts[2] === 'automation') {
      const environment = await api(`/api/case-library/projects/${encodeURIComponent(projectId)}/environment`);
      if (!isCurrent()) return;
      const hasImportedScripts = project.cases.some(item=>item.versions.some(version=>version.imported_scripts?.length));
      // Viewing imported source needs no target or login. Execution admission is unchanged.
      const needsSetup = !environment.ui_environment_id && !environment.backend_environment_id && !hasImportedScripts;
      setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name},{label:needsSetup?'配置项目环境':'工作台'}]);
      return await installProjectPage(needsSetup ? setupPage() : renderProjectWorkflow({project,showPage:scopedShowPage,go,launchBatch,isCurrent,onError:error=>toast(messageFor(error),'error')}));
    }
    if (parts[2] === 'overview-advanced') return await renderProjectOverview(project);
    if (parts[2] === 'automation-advanced') return await renderAutomation(project, scopedShowPage);
    if (parts[2] === 'native-dsh') {
      const { renderNativeDsh } = await loadWorkspaceModule('/workspace/native-dsh.js');
      if (!isCurrent()) return;
      setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}`},{label:'原生 dsh 项目测试'}]);
      return await installProjectPage(renderNativeDsh({project,query:value.query,showPage:scopedShowPage,isCurrent}));
    }
    if (parts[2] === 'requirements' || parts[2] === 'bindings') {
      if (parts[2] === 'requirements' && value.query.get('view') !== 'legacy') {
        const ui = await loadCaseAssistantFeature();
        if (!isCurrent()) return;
        setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}`},{label:'AI 用例助手'}]);
        return await installProjectPage(ui.renderCaseAssistant({project,query:value.query,showPage:scopedShowPage,go,isCurrent}));
      }
      const { ui, requirementsApi } = await loadRequirementsFeature();
      if (epoch !== renderEpoch) return;
      if (parts[2] === 'requirements') {
        const legacyGo = (href, ...args) => {
          if (href.split('?')[0].endsWith('/requirements')) {
            const [path, search = ''] = href.split('?'); const query = new URLSearchParams(search); query.set('view', 'legacy'); href = `${path}?${query}`;
          }
          return go(href, ...args);
        };
        setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}`},{label:'旧版资料与用例设计'}]);
        return await ui.renderRequirements({project,query:value.query,showPage:scopedShowPage,go:legacyGo,toast,requirementsApi,isCurrent});
      }
      setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}`},{label:'协议绑定'}]);
      return await ui.renderBindings({project,query:value.query,showPage:scopedShowPage,go,toast,requirementsApi,isCurrent});
    }
    if (parts[2] === 'execution-list') {
      const { renderExecutionList } = await loadWorkspaceModule('/workspace/execution-list.js');
      if (epoch !== renderEpoch) return;
      setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}`},{label:'执行结果'}]);
      return await renderExecutionList({project,query:value.query,showPage:scopedShowPage,go,api,
        onRerun: rows => {
          if (!rows.length || rows.some(row => row.project_id !== project.project_id || !row.eligible_to_rerun || !row.selection || row.selection.case_id !== row.case_id || row.selection.case_version !== row.case_version)) return toast('复跑范围或冻结脚本身份无效，请刷新执行列表。','error');
          return launchBatch(project,'selected',rows.map(row => row.case_id),rows.map(row => structuredClone(row.selection)));
        },
        onRevise: async (rows,feedback) => {
          const backendRows=rows.filter(row=>row.selection?.kind==='HTTP_JSON');
          if(backendRows.length){
            if(backendRows.length===rows.length){
              const ui=await loadBackendFeature();
              for(const row of backendRows){
              if(row.project_id!==project.project_id||!row.eligible_to_revise||!row.run_id||!row.source_task_id||row.selection?.source_task_id!==row.source_task_id)return toast('后端反馈来源身份无效，请刷新后重新选择。','error');
              ui.stageBackendRevisionContext({project_id:project.project_id,case_id:row.case_id,case_version:row.case_version,plan_id:row.source_task_id,run_id:row.run_id,feedback});
              }
              const row=backendRows[0];
              return go(`#/projects/${project.project_id}/cases/${row.case_id}?version=${row.case_version}&tab=scripts&plan_id=${encodeURIComponent(row.source_task_id)}`);
            }
            return toast('请分别选择前端或后端失败记录提交反馈，两个执行器的审阅方式不同。','error');
          }
          if (!rows.length || rows.some(row => row.project_id !== project.project_id || !row.eligible_to_revise || !row.run_id || !row.source_task_id || row.candidate_version == null || !row.bundle_sha256 || row.selection?.source_task_id !== row.source_task_id || String(row.selection?.candidate_version) !== String(row.candidate_version) || row.selection?.bundle_sha256 !== row.bundle_sha256)) return toast('修订范围或原候选身份无效，请刷新执行列表。','error');
          return openScriptOperation({project,items:rows.map(row => ({case_id:row.case_id,case_version:row.case_version,external_id:row.external_id,source_task_id:row.source_task_id,candidate_version:row.candidate_version,bundle_sha256:row.bundle_sha256,run_id:row.run_id})),mode:'revise',initialFeedback:feedback,go,onError:error=>toast(messageFor(error),'error')});
        }});
    }
    if (parts[2] === 'reports') {setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}/cases`},{label:'报告'}]);return await installProjectPage(renderReports({project,query:value.query,showPage:scopedShowPage,go,isCurrent}));}
    if (parts[2] === 'generation') {setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${project.project_id}/cases`},{label:'脚本生成'}]);return await installProjectPage(renderGeneration({project,id:parts[3],showPage:scopedShowPage,isCurrent}));}
    if (parts[2] === 'import') return renderImport(project);
    if (parts[2] === 'settings') return renderSettings(project);
    if (parts[2] === 'auth') {
      setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${projectId}`},{label:'基础环境'}]);
      return await installProjectPage(setupPage());
    }
    if (parts[2] === 'environment-advanced') return await renderProjectEnvironment(project);
    if (parts[2] === 'develop') return await renderDevelopmentStart(project);
    if (parts[2] === 'build-tasks') return await renderBuildTasksRoute(project, parts[3] || null);
    if (parts[2] === 'batches') {
      setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${projectId}`},{label:'测试记录'}]);
      return await installProjectPage(renderBatchPage({project,query:value.query,showPage:scopedShowPage,api,mutate,jsonOptions,launchBatch,isCurrent}));
    }
    if (parts[2] === 'execution-records') { await renderExecutionRecords(project); focusExecutionRecord(value.query.get('run_id')); return; }
    if (parts[2] === 'cases' && parts[3]) { const item = project.cases.find((entry) => entry.case_id === parts[3]); if (!item) throw new ApiError('CASE_NOT_FOUND', 404); return await renderCaseDetail(project, item, value.query.get('version'),isCurrent); }
    return await renderCases(project);
  } catch (error) { if (epoch === renderEpoch) showFatal(error); }
}

window.addEventListener('hashchange', () => { if (state.allowNavigation) { state.allowNavigation = false; void render(); return; } if (isDirty() && !confirm('当前修改尚未保存，离开后草稿会丢失。是否继续？')) { history.forward(); return; } state.editing = null; state.environmentDirty = false; void render(); });
await render(true);
serviceHealthPoller.start();

function launchBatch(project,scope,ids,selections=[],caseContext=null){return openBatch({project,scope,ids,selections,api,mutate,jsonOptions,go,toast,caseContext,caseReturn:route().query.get('return')});}
async function renderBatches(project){
 await refreshServiceHealth();
 const {batches}=await api(`/api/case-library/projects/${project.project_id}/batches`),id=route().query.get('batch_id');
 const b=id?batches.find(b=>b.batch_id===id):null,base=`#/projects/${project.project_id}`;
 setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:base+'/cases'},{label:'测试批次'}]);
 showPage(`<div class="page-heading"><div><h1>测试批次</h1><p>每次明确运行创建新批次；范围和三个版本分别记录。</p></div>${b?`<div class="actions"><a class="button" data-nav href="${base}/reports?batch_id=${b.batch_id}">预览与导出本批报告</a><button class="button" id="rerun-failed" ${b.items.some(i=>i.result==='FAILED'||i.result==='TIMEDOUT')?'':'disabled'}>重跑本批未通过</button></div>`:''}</div><section class="panel"><div class="panel-body">${id&&!b?'<p role="alert">指定批次不存在或不属于当前项目，未替换其他批次。</p>':b?`<label class="field">按本次状态筛选<select id="batch-state-filter"><option value="">全部请求项</option><option value="PASSED">通过</option><option value="FAILED">未通过</option><option value="BLOCKED">阻塞</option><option value="NOT_RUN">取消 / 未执行</option></select></label>${batchHtml(b,base)}`:`<table><thead><tr><th>创建时间 / 软件版本</th><th>范围</th><th>请求数</th><th>状态</th></tr></thead><tbody>${batches.filter(b=>b.state!=='PREVIEW').map(b=>`<tr><td><a data-nav href="${base}/batches?batch_id=${b.batch_id}">${esc(b.created_at)} · ${esc(b.software_version||'未提供')}</a></td><td>${esc({single:'单条',selected:'选中',project:'全项目'}[b.scope])}</td><td>${b.items.length}</td><td>${esc(stateLabel(b.state))}</td></tr>`).join('')}</tbody></table><p><a data-nav href="${base}/execution-records">历史结果 / 来源未分批</a></p>`}${b&&['QUEUED','RUNNING','STOPPING'].includes(b.state)?'<button class="button" id="cancel-batch">取消本批，保留已执行结果</button>':''}</div></section>`);
 document.querySelector('#cancel-batch')?.addEventListener('click',async e=>{e.target.disabled=true;await mutate(`/api/case-library/projects/${project.project_id}/batches/${b.batch_id}/stop`,jsonOptions({}));});
 document.querySelector('#rerun-failed')?.addEventListener('click',()=>{const rows=b.items.filter(i=>['FAILED','TIMEDOUT'].includes(i.result));void launchBatch(project,'selected',rows.map(i=>i.case_id),rows.map(i=>i.selection));});
 document.querySelector('#batch-state-filter')?.addEventListener('change',e=>document.querySelectorAll('[data-batch-id] tbody tr').forEach((row,n)=>{const i=b.items[n],key=e.target.value;row.hidden=key==='PASSED'?i.result!=='PASSED':key==='FAILED'?!['FAILED','TIMEDOUT'].includes(i.result):key==='BLOCKED'?i.state!=='BLOCKED':key==='NOT_RUN'?!['NOT_RUN','CANCELLED','QUEUED'].includes(i.state):false;}));
 if(b&&['QUEUED','RUNNING','STOPPING'].includes(b.state)){const current=route().raw;setTimeout(()=>{if(route().raw===current)void renderBatches(project);},1500);}
}
