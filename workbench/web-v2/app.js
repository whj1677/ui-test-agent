import { ApiError, api, downloadPackage, uploadCaseFile } from '/workspace/api.js';

const state = {
  projects: [], project: null, serviceReady: false, error: null,
  query: '', module: '', status: '', page: 1, pageSize: 25,
  selected: new Map(), importDrafts: new Map(), caseVersion: null,
  editing: null, allowNavigation: false,
};
const app = document.querySelector('#app');
const loading = document.querySelector('#page-loading');
const breadcrumbs = document.querySelector('#breadcrumbs');
const sideNav = document.querySelector('.side-nav');
const modalRoot = document.querySelector('#modal-root');
const errorLabels = {
  WORKBENCH_UNREACHABLE: '无法连接工作台服务，请确认前台服务仍在运行。',
  CASE_PROJECT_REVISION_CONFLICT: '项目已在其他页面发生变化。当前草稿没有保存，请重新加载并核对。',
  CASE_IMPORT_PREVIEW_STALE: '预览后项目已发生变化。请保留当前文件与映射并重新生成预览。',
  CASE_UPLOAD_TYPE_UNSUPPORTED: '只支持 .xlsx 和正式的 .json 用例包。',
  CASE_UPLOAD_SIZE_INVALID: '文件为空或超过 10 MiB。',
  CASE_PACKAGE_SCHEMA_UNSUPPORTED: 'JSON 不是 workbench/case-package-v1 正式用例包；UI-D1 演示包不兼容。',
  CASE_PACKAGE_INVALID_JSON: 'JSON 文件无法解析。', CASE_EXCEL_MAPPING_REQUIRED: '必填字段映射不完整。',
  CASE_PROJECT_NOT_FOUND: '项目不存在或已不可用。', CASE_NOT_FOUND: '用例不存在或不属于当前项目。',
  CASE_EXPORT_SELECTION_INVALID: '导出选择无效，请刷新后重新选择。', REQUEST_TOO_LARGE: '请求内容过大。',
  E2E01_CASE_NOT_AUTHORIZED: '本次试跑只允许来自已导入六案例的 TC-001、TC-002、TC-003。',
  E2E01_CASE_ENVIRONMENT_MISMATCH: '用例与预设演示入口不匹配。', E2E01_PAIRED_CASE_CONTENT_MISMATCH: '正常与故障用例正文并非同一业务预期，未创建建例任务。',
  E2E01_TRIAL_NOT_ALLOWED: '该任务不属于本次受控演示试跑。', E2E01_CANDIDATE_IDENTITY_MISMATCH: '候选版本已变化，请刷新任务详情。',
  E2E01_EXECUTION_CASE_NOT_ALLOWED: '执行目标超出此候选明确绑定的用例范围。', E2E01_TRIAL_AUTHORIZATION_INVALID: '演示试跑授权不匹配。',
  AUTH_BROWSER_EXECUTABLE_REQUIRED: '尚未配置受控浏览器，请检查工作台启动配置。',
  AUTH_ENVIRONMENT_ROLE_NOT_ALLOWED: '当前环境不允许这个账号角色。',
  AUTH_SESSION_REQUIRED: '需要先完成被测系统登录；请先在“登录准备”页登录后再启动或复跑。',
  AUTH_SESSION_BLOCKED: '登录会话在活动期间失效，已停止关联操作；未执行的步骤不会补写，原始结果不被覆盖。',
  AUTH_BUILD_UNAVAILABLE: '工作台当前配置未启用登录建例能力。',
  AUTH01_TRIAL_NOT_ALLOWED: '该任务不属于 AUTH-01 登录建例闭环。',
  AUTH01_CANDIDATE_IDENTITY_MISMATCH: '候选版本已变化，请刷新任务详情。',
  AUTH01_CANDIDATE_FILE_CHANGED: '候选文件与登记哈希不一致，未执行。',
  AUTH01_ENVIRONMENT_REQUIRED: 'AUTH-01 限定授权只适用于登录演示环境。',
  AUTH01_AUTHORIZATION_REQUIRED: '登录演示环境的建例任务需要绑定 AUTH-01 限定授权。',
};
const mappingLabels = {
  external_id: '用例编号', title: '标题', module: '模块', preconditions: '前置条件', test_data: '测试数据',
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
function toast(message, kind = '') { const node = document.querySelector('#toast'); node.textContent = message; node.className = `toast visible ${kind}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.className = 'toast'; }, 3600); }
function messageFor(error) { return errorLabels[error?.code || error?.message] || `操作失败：${error?.code || error?.message || 'UNKNOWN'}`; }
function setService(ok) { document.querySelector('.top-status').classList.toggle('error', !ok); document.querySelector('#service-label').textContent = ok ? '服务就绪 · 真实后端' : '服务连接失败'; }
function setSidebarNavigation(project, section = 'projects') {
  const link = (label, icon, href, active) => `<a class="side-link${active ? ' active' : ''}" data-nav href="${href}"${active ? ' aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</a>`;
  const disabled = (label, icon) => `<span class="side-link disabled" aria-disabled="true"><span class="nav-icon" aria-hidden="true">${icon}</span>${label}<small>请先选择项目</small></span>`;
  const id = project && encodeURIComponent(project.project_id);
  sideNav.innerHTML = link('项目', '◇', '#/projects', section === 'projects') +
    (id ? link('登录准备', '◇', `#/projects/${id}/auth`, section === 'auth') +
      link('建例任务', '○', `#/projects/${id}/build-tasks`, section === 'build-tasks') +
      link('执行记录', '□', `#/projects/${id}/execution-records`, section === 'execution-records') :
      disabled('登录准备', '◇') + disabled('建例任务', '○') + disabled('执行记录', '□'));
}
function isDirty() { return Boolean(state.editing?.dirty); }
function go(hash, force = false) {
  if (!force && isDirty() && !confirm('当前修改尚未保存，离开后草稿会丢失。是否继续？')) return false;
  state.editing = null; state.allowNavigation = true; location.hash = hash; return true;
}
window.addEventListener('beforeunload', (event) => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('click', (event) => { const link = event.target.closest('a[data-nav]'); if (!link) return; event.preventDefault(); go(link.getAttribute('href')); });

async function loadProjects() {
  const result = await api('/api/case-library/projects');
  state.projects = result.projects;
  setService(true);
  return state.projects;
}
async function loadProject(projectId) {
  state.project = await api(`/api/case-library/projects/${encodeURIComponent(projectId)}`);
  const index = state.projects.findIndex((item) => item.project_id === projectId);
  if (index >= 0) state.projects[index] = state.project; else state.projects.unshift(state.project);
  return state.project;
}
async function mutate(path, options) {
  try { return await api(path, options); }
  catch (error) { if (error.code === 'WORKBENCH_UNREACHABLE') setService(false); throw error; }
}
function jsonOptions(body, method = 'POST') { return { method, headers: { 'content-type':'application/json' }, body: JSON.stringify(body) }; }

function projectTabs(project, active) {
  const id = encodeURIComponent(project.project_id);
  return `<nav class="project-tabs" aria-label="项目导航">
    <a data-nav class="${active === 'cases' ? 'active' : ''}" href="#/projects/${id}/cases">用例库</a>
    <a data-nav class="${active === 'auth' ? 'active' : ''}" href="#/projects/${id}/auth">登录准备</a>
    <a data-nav class="${active === 'build-tasks' ? 'active' : ''}" href="#/projects/${id}/build-tasks">建例任务</a>
    <a data-nav class="${active === 'execution-records' ? 'active' : ''}" href="#/projects/${id}/execution-records">执行记录</a>
    <a data-nav class="${active === 'settings' ? 'active' : ''}" href="#/projects/${id}/settings">项目设置</a>
    <span class="stage-note">受控演示候选试跑 · 尚未批准</span>
  </nav>`;
}
function setBreadcrumb(items) { breadcrumbs.innerHTML = items.map((item, index) => `${index ? '<span>/</span>' : ''}${item.href ? `<a data-nav href="${item.href}">${esc(item.label)}</a>` : `<strong>${esc(item.label)}</strong>`}`).join(''); }
function showPage(html) { loading.hidden = true; app.hidden = false; app.innerHTML = html; }
function showFatal(error) {
  loading.hidden = true; app.hidden = false; state.error = error; setService(false);
  setSidebarNavigation(null);
  showPage(`<section class="empty"><h2>无法读取真实数据</h2><p>${esc(messageFor(error))}</p><button class="button primary" id="retry">重新连接</button></section>`);
  document.querySelector('#retry')?.addEventListener('click', () => render(true));
}

function openModal({ title, body, confirmLabel = '确认', onConfirm }) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-close aria-label="关闭">×</button></header><div class="modal-body">${body}</div><footer><button class="button" data-close>取消</button><button class="button primary" id="modal-confirm">${esc(confirmLabel)}</button></footer></section></div>`;
  const close = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', close));
  modalRoot.querySelector('#modal-confirm').addEventListener('click', async () => {
    const button = modalRoot.querySelector('#modal-confirm'); button.disabled = true;
    try { await onConfirm(close); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; }
  });
}

function renderProjects() {
  setSidebarNavigation(null);
  setBreadcrumb([{ label:'项目' }]);
  const cards = state.projects.map((project, index) => `<article class="project-card" data-project-id="${esc(project.project_id)}">
    <div class="project-card-top"><span class="project-symbol">${String(index + 1).padStart(2, '0')}</span><span class="badge ${project.cases.some((item) => item.status !== 'CONFIRMED') ? 'warning' : 'success'}">${project.cases.some((item) => item.status !== 'CONFIRMED') ? '有待确认内容' : '内容已核对'}</span></div>
    <h2>${esc(project.name)}</h2><p>${esc(project.description || '暂无项目说明')}</p>
    <div class="project-meta"><div><strong>${project.cases.length}</strong><small>用例</small></div><div><strong>${project.imports.length}</strong><small>导入批次</small></div><div><strong>r${project.revision}</strong><small>项目修订</small></div></div>
    <footer><time>${esc(fmtDate(project.updated_at))}</time><a class="button link" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases">进入项目 →</a></footer>
  </article>`).join('');
  showPage(`<div class="page-heading"><div><p class="eyebrow">REAL PROJECT DATA</p><h1>项目</h1><p>真实数据由本机工作台后端持久化；创建项目后可多次导入。</p></div><button class="button primary" id="new-project">新建项目</button></div>
    <div class="project-toolbar"><label class="search"><span class="sr-only">搜索项目</span><input id="project-search" placeholder="搜索项目名称或说明"></label><span class="muted">${state.projects.length} 个项目</span></div>
    <section id="project-grid" class="project-grid">${cards || '<div class="empty"><h2>还没有项目</h2><p>先创建一个项目，再导入真实 Excel 或平台用例包。</p></div>'}</section>`);
  document.querySelector('#new-project').addEventListener('click', () => openModal({
    title:'新建项目', confirmLabel:'创建并进入',
    body:`<div class="form-grid"><label class="field wide"><span>项目名称</span><input id="new-name" maxlength="120" required></label><label class="field wide"><span>项目说明</span><textarea id="new-description" rows="4" maxlength="5000"></textarea></label></div>`,
    onConfirm: async (close) => {
      const project = await mutate('/api/case-library/projects', jsonOptions({ name: modalRoot.querySelector('#new-name').value, description: modalRoot.querySelector('#new-description').value }));
      state.projects.unshift(project); close(); toast('项目已创建，ID 与修订号来自后端。'); go(`#/projects/${encodeURIComponent(project.project_id)}/cases`, true);
    },
  }));
  document.querySelector('#project-search').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLocaleLowerCase();
    document.querySelectorAll('.project-card').forEach((card) => { const project = state.projects.find((item) => item.project_id === card.dataset.projectId); card.hidden = !(`${project.name} ${project.description}`.toLocaleLowerCase().includes(query)); });
  });
}

function filteredCases(project) {
  return project.cases.filter((item) => {
    const content = currentContent(item); const query = state.query.toLocaleLowerCase();
    return (!query || `${item.external_id} ${item.title}`.toLocaleLowerCase().includes(query)) && (!state.module || item.module === state.module) && (!state.status || content?.status === state.status);
  });
}
async function loadProjectTestOverview(project) {
  const id = encodeURIComponent(project.project_id);
  const [taskResult, recordResult] = await Promise.all([
    api(`/api/case-library/projects/${id}/build-tasks`),
    api(`/api/case-library/projects/${id}/execution-records`),
  ]);
  return { tasks: taskResult.tasks || [], records: recordResult.records || [] };
}
function projectTestOverview(project, activity) {
  const { tasks, records } = activity;
  const latestByCase = new Map();
  for (const record of records) {
    const key = record.executed_case_id || `${record.executed_external_id}@v${record.executed_case_version}`;
    const previous = latestByCase.get(key);
    if (!previous || String(record.started_at) >= String(previous.started_at)) latestByCase.set(key, record);
  }
  const caseResults = [...latestByCase.values()].sort((left, right) => left.executed_external_id.localeCompare(right.executed_external_id, 'en'));
  const passed = caseResults.filter((record) => record.status === 'PASSED').length;
  const failed = caseResults.filter((record) => record.status === 'FAILED').length;
  const other = caseResults.length - passed - failed;
  const latest = records.at(-1);
  const recordsUrl = `#/projects/${encodeURIComponent(project.project_id)}/execution-records`;
  const resultRows = caseResults.map((record) => `<a class="project-test-case" data-nav href="${recordsUrl}?run_id=${encodeURIComponent(record.run_id)}" aria-label="${esc(record.executed_external_id)} ${esc(statusText(record.status))}，查看测试详情"><span><strong>${esc(record.executed_external_id)}</strong><small>v${record.executed_case_version} · ${esc(fmtDate(record.finished_at || record.started_at))}${record.failure_step ? ` · ${esc(record.failure_step)}` : ''}</small></span>${resultBadge(record.status)}<span class="project-test-case-action">查看详情 →</span></a>`).join('');
  return `<section class="panel project-test-overview"><div class="panel-header"><div><h2>测试概况</h2><span class="muted">${records.length ? `最近结果 · ${caseResults.length} 条用例 / ${records.length} 次运行 · 建例任务 ${tasks.length} 个` : '尚无测试运行记录'}</span></div><a class="button small" data-nav href="${recordsUrl}">查看全部测试记录</a></div><div class="panel-body"><div class="project-test-metrics"><div><span>已测试用例</span><strong>${caseResults.length}</strong></div><div><span>最近通过</span><strong>${passed}</strong></div><div><span>最近失败</span><strong>${failed}</strong></div><div><span>其他状态</span><strong>${other}</strong></div></div>${caseResults.length ? `<div class="project-test-case-list">${resultRows}</div>` : `<p class="muted project-test-empty">${tasks.length ? `已有 ${tasks.length} 个建例任务，尚未产生测试运行记录。` : '该项目还没有建例任务或测试运行。'}</p>`}${latest ? `<div class="project-test-latest"><span>最近运行：${esc(latest.executed_external_id)} · ${esc(statusText(latest.status))} · ${esc(fmtDate(latest.finished_at || latest.started_at))}</span><a class="button link" data-nav href="${recordsUrl}?run_id=${encodeURIComponent(latest.run_id)}">查看最近运行 →</a></div>` : ''}</div></section>`;
}
async function renderCases(project, activity = null) {
  activity ||= await loadProjectTestOverview(project);
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name }, { label:'用例库' }]);
  const filtered = filteredCases(project); const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize)); state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize; const pageItems = filtered.slice(start, start + state.pageSize); const selected = selection(project.project_id);
  const modules = [...new Set(project.cases.map((item) => item.module).filter(Boolean))].sort();
  const confirmed = project.cases.filter((item) => currentContent(item)?.status === 'CONFIRMED').length;
  const rows = pageItems.map((item) => {
    const content = currentContent(item); const checked = selected.has(item.case_id) ? 'checked' : '';
    return `<tr data-case-id="${esc(item.case_id)}"><td><input class="checkbox case-check" type="checkbox" aria-label="选择 ${esc(item.external_id)}" ${checked}></td>
      <td><button class="case-link" data-open-case="${esc(item.case_id)}"><strong>${esc(item.external_id)}</strong><span>${esc(item.title)}</span></button></td><td>${esc(item.module || '—')}</td>
      <td><span class="badge ${content?.status === 'CONFIRMED' ? 'success' : 'warning'}">${content?.status === 'CONFIRMED' ? '内容已确认' : '内容待确认'}</span></td>
      <td>v${item.current_version}</td><td>${esc(fmtDate(item.updated_at))}</td></tr>`;
  }).join('');
  showPage(`<div class="page-heading"><div><p class="eyebrow">${esc(project.project_id)}</p><h1>${esc(project.name)}</h1><p>${esc(project.description || '暂无项目说明')}</p></div><div class="actions"><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/settings">项目设置</a><a class="button primary" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/import">导入用例</a></div></div>
    ${projectTabs(project, 'cases')}
    <section class="summary-strip"><div><span>全部用例</span><strong>${project.cases.length}</strong></div><div><span>内容已确认</span><strong>${confirmed}</strong></div><div><span>内容待确认</span><strong>${project.cases.length - confirmed}</strong></div><div><span>项目修订</span><strong>r${project.revision}</strong></div></section>
    ${projectTestOverview(project, activity)}
    <section class="panel"><div class="panel-header"><h2>项目用例</h2><span class="muted">默认每页 25 条</span></div><div class="panel-body">
      <div class="table-toolbar"><div class="filters"><label class="search"><span class="sr-only">搜索用例</span><input id="case-search" value="${esc(state.query)}" placeholder="按编号或标题搜索"></label>
        <select id="module-filter" aria-label="模块筛选"><option value="">全部模块</option>${modules.map((value) => `<option ${value === state.module ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select>
        <select id="status-filter" aria-label="内容状态筛选"><option value="">全部内容状态</option><option value="CONFIRMED" ${state.status === 'CONFIRMED' ? 'selected' : ''}>内容已确认</option><option value="PENDING_CONFIRMATION" ${state.status === 'PENDING_CONFIRMATION' ? 'selected' : ''}>内容待确认</option></select></div>
        <div class="actions"><button class="button small" id="export-selected" ${selected.size ? '' : 'disabled'}>导出选中（${selected.size}）</button><button class="button small" id="export-all" ${project.cases.length ? '' : 'disabled'}>导出全部（${project.cases.length}）</button></div></div>
      <p class="selection-note">已选择 ${selected.size} 条${selected.size && !pageItems.some((item) => selected.has(item.case_id)) ? '，当前筛选未显示已选用例' : ''}。</p>
      ${project.cases.length ? `<div class="table-wrap"><table><thead><tr><th><input id="page-select" class="checkbox" type="checkbox" aria-label="选择当前页"></th><th>编号 / 标题</th><th>模块</th><th>内容状态</th><th>版本</th><th>更新时间</th></tr></thead><tbody>${rows || '<tr><td colspan="6">当前筛选无结果</td></tr>'}</tbody></table></div>
      <div class="pagination"><span>第 ${state.page} / ${pageCount} 页，共 ${filtered.length} 条</span><div><button class="button small" id="prev-page" ${state.page <= 1 ? 'disabled' : ''}>上一页</button><button class="button small" id="next-page" ${state.page >= pageCount ? 'disabled' : ''}>下一页</button></div></div>` : '<div class="empty"><h2>暂无用例</h2><p>上传 Excel 或平台 JSON 包，预览确认后才会写入项目。</p></div>'}
    </div></section>`);
  const rerender = () => renderCases(project, activity);
  document.querySelector('#case-search')?.addEventListener('input', (event) => { state.query = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#module-filter')?.addEventListener('change', (event) => { state.module = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#status-filter')?.addEventListener('change', (event) => { state.status = event.target.value; state.page = 1; rerender(); });
  document.querySelector('#prev-page')?.addEventListener('click', () => { state.page -= 1; rerender(); }); document.querySelector('#next-page')?.addEventListener('click', () => { state.page += 1; rerender(); });
  document.querySelectorAll('[data-open-case]').forEach((button) => button.addEventListener('click', () => go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(button.dataset.openCase)}`)));
  document.querySelectorAll('.case-check').forEach((checkbox) => checkbox.addEventListener('change', () => { const id = checkbox.closest('tr').dataset.caseId; checkbox.checked ? selected.add(id) : selected.delete(id); rerender(); }));
  document.querySelector('#page-select')?.addEventListener('change', (event) => { for (const item of pageItems) event.target.checked ? selected.add(item.case_id) : selected.delete(item.case_id); rerender(); });
  document.querySelector('#export-selected')?.addEventListener('click', () => void exportCases(project, [...selected]));
  document.querySelector('#export-all')?.addEventListener('click', () => void exportCases(project, null));
}

async function exportCases(project, ids) {
  if (Array.isArray(ids) && !ids.length) return toast('请先选择至少一条用例。', 'error');
  try {
    const { blob, name } = await downloadPackage(project.project_id, ids);
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast(`已请求下载${ids ? `选中的 ${ids.length} 条` : `全部 ${project.cases.length} 条`}用例；内容来自正式后端导出。`);
  } catch (error) { toast(messageFor(error), 'error'); }
}

function draftFor(projectId) { if (!state.importDrafts.has(projectId)) state.importDrafts.set(projectId, { upload:null, preview:null, result:null, busy:false }); return state.importDrafts.get(projectId); }
function renderImport(project) {
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:'导入用例' }]);
  const draft = draftFor(project.project_id); const stage = draft.result ? 4 : draft.preview ? 3 : draft.upload ? 2 : 1;
  const progress = ['选文件','映射与预览','确认导入','结果'].map((label, index) => `<li class="${stage === index + 1 ? 'active' : stage > index + 1 ? 'done' : ''}"><span>${index + 1}</span>${label}</li>`).join('');
  let body = '';
  if (stage === 1) body = `<div class="dropzone"><div><h2>选择 Excel 或平台用例包</h2><p class="muted">支持 .xlsx 与 workbench/case-package-v1 .json，最大 10 MiB。上传只创建服务端上传记录，不会提前写入项目。</p><input id="import-file" type="file" accept=".xlsx,.json"><div><button class="button primary" id="upload-file" disabled>上传并读取</button></div></div></div>`;
  if (stage === 2) body = renderMappingStage(draft);
  if (stage === 3) body = renderPreviewStage(draft.preview);
  if (stage === 4) body = `<div class="empty"><h2>导入确认已完成</h2><p>后端实际新增 ${draft.result.result.added} 条；重复跳过 ${draft.result.result.skipped_duplicate} 条；冲突跳过 ${draft.result.result.skipped_conflict} 条；无法导入跳过 ${draft.result.result.skipped_unimportable} 条。</p><div class="actions center-actions"><button class="button" id="import-another">继续导入</button><a class="button primary" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases">返回用例库</a></div></div>`;
  showPage(`<div class="page-heading"><div><p class="eyebrow">REAL FILE IMPORT</p><h1>导入用例</h1><p>项目：${esc(project.name)} · 确认前不会写入新用例</p></div><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases">退出导入</a></div>
    ${projectTabs(project, '')}<ol class="wizard-progress">${progress}</ol><section class="panel"><div class="panel-body">${body}</div></section>`);
  bindImport(project, draft, stage);
}
function renderMappingStage(draft) {
  const upload = draft.upload;
  const facts = `<div class="file-facts"><div><small>文件</small><strong>${esc(upload.file_name)}</strong></div><div><small>大小</small><strong>${Math.ceil(upload.bytes / 1024)} KiB</strong></div><div><small>SHA-256</small><strong class="mono">${esc(short(upload.sha256, 16))}</strong></div></div>`;
  if (upload.source_type === 'case-package') return `${facts}<div class="notice">已识别正式原生包 ${esc(upload.package.package_id)}，包含 ${upload.package.case_count} 条。JSON 包无需工作表映射。</div><div class="actions"><button class="button" id="replace-file">换文件</button><button class="button primary" id="create-preview">生成后端预览</button></div>`;
  const sheets = upload.workbook.sheets || []; const selectedSheet = draft.sheet || sheets[0]?.name || ''; const sheet = sheets.find((item) => item.name === selectedSheet) || sheets[0];
  const mapping = draft.mapping || Object.fromEntries(Object.entries(mappingLabels).map(([field, label]) => [field, sheet?.headers?.includes(label) ? label : ''])); draft.sheet = sheet?.name; draft.mapping = mapping;
  return `${facts}<div class="form-grid"><label class="field"><span>工作表</span><select id="sheet-select">${sheets.map((item) => `<option value="${esc(item.name)}" ${item.name === draft.sheet ? 'selected' : ''}>${esc(item.name)} · ${item.row_count} 行</option>`).join('')}</select></label><div class="notice">映射值是实际表头文本。用例编号、标题和步骤为必填映射；预期缺失将保持待确认。</div></div>
    <div class="mapping-grid">${Object.entries(mappingLabels).map(([field, label]) => `<label class="field"><span>${esc(label)}${['external_id','title','steps'].includes(field) ? ' *' : ''}</span><select data-map="${field}"><option value="">不映射</option>${(sheet?.headers || []).map((header) => `<option value="${esc(header)}" ${mapping[field] === header ? 'selected' : ''}>${esc(header)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="actions"><button class="button" id="replace-file">换文件</button><button class="button primary" id="create-preview">生成后端预览</button></div>`;
}
function renderPreviewStage(preview) {
  const summary = Object.entries(classificationLabels).map(([key, label]) => `<div><strong>${preview.summary[key]}</strong><span>${label}</span></div>`).join('');
  const incoming = preview.summary.NEW + preview.summary.PENDING_CLARIFICATION + preview.summary.CONFLICT;
  const items = preview.items.map((item) => `<article class="preview-item"><header><div><h3>${esc(item.content.external_id || '无编号')} · ${esc(item.content.title || '无标题')}</h3><p>${esc(item.source_location.sheet || item.source_location.package_id || '来源')} / ${esc(item.source_location.row || item.source_location.index || '')} · ${esc(item.candidate_key)}</p></div><span class="badge ${item.classification === 'UNIMPORTABLE' ? 'danger' : item.classification === 'PENDING_CLARIFICATION' || item.classification === 'CONFLICT' ? 'warning' : 'success'}">${classificationLabels[item.classification]}</span></header>
    <ol>${(item.content.steps || []).map((step) => `<li><strong>${esc(step.action)}</strong><br><span class="muted">预期：${esc(step.expected || '（缺失，导入后保持待确认）')}</span></li>`).join('')}</ol>
    ${(item.issues || []).map((issue) => `<div class="issue ${issue.severity === 'ERROR' ? 'error' : ''}">${esc(issue.code)} · ${esc(issue.message)}</div>`).join('')}
    ${item.classification === 'CONFLICT' ? `<label class="field"><span>冲突处理</span><select data-conflict="${esc(item.candidate_key)}"><option value="SKIP">默认跳过，不覆盖</option><option value="IMPORT_COPY">作为独立副本导入</option></select></label>` : ''}</article>`).join('');
  return `<div class="preview-summary">${summary}</div><div class="notice warning">按当前选择，最多新增 ${incoming} 条；其中待澄清 ${preview.summary.PENDING_CLARIFICATION} 条会入库并保持“内容待确认”。冲突默认跳过，只有明确选择才作为独立副本。</div><div class="preview-list">${items}</div><div class="actions spaced-actions"><button class="button" id="redo-preview">返回映射</button><button class="button primary" id="confirm-import">确认导入</button></div>`;
}
function bindImport(project, draft, stage) {
  if (stage === 1) {
    const input = document.querySelector('#import-file'); const button = document.querySelector('#upload-file');
    input.addEventListener('change', () => { button.disabled = !input.files[0]; });
    button.addEventListener('click', async () => { button.disabled = true; try { draft.upload = await uploadCaseFile(input.files[0]); draft.preview = null; draft.result = null; toast('文件已上传并由后端读取。'); renderImport(project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
  }
  if (stage === 2) {
    document.querySelector('#replace-file').addEventListener('click', () => { Object.assign(draft, { upload:null, preview:null, result:null, sheet:null, mapping:null }); renderImport(project); });
    document.querySelector('#sheet-select')?.addEventListener('change', (event) => { draft.sheet = event.target.value; draft.mapping = null; renderImport(project); });
    document.querySelectorAll('[data-map]').forEach((node) => node.addEventListener('change', () => { draft.mapping[node.dataset.map] = node.value; }));
    document.querySelector('#create-preview').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; const body = { upload_id:draft.upload.upload_id }; if (draft.upload.source_type === 'xlsx') { body.sheet_name = draft.sheet; body.mapping = draft.mapping; } try { draft.preview = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/imports/preview`, jsonOptions(body)); toast('后端预览已生成；项目尚未写入新用例。'); renderImport(project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
  }
  if (stage === 3) {
    document.querySelector('#redo-preview').addEventListener('click', () => { draft.preview = null; renderImport(project); });
    document.querySelector('#confirm-import').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; const decisions = {}; document.querySelectorAll('[data-conflict]').forEach((node) => { if (node.value === 'IMPORT_COPY') decisions[node.dataset.conflict] = 'IMPORT_COPY'; }); try { draft.result = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/imports/${encodeURIComponent(draft.preview.preview_id)}/confirm`, jsonOptions({ decisions })); await loadProject(project.project_id); toast(draft.result.idempotent ? '该预览已经确认，本次未重复导入。' : '导入结果已由后端持久化。'); renderImport(state.project); } catch (error) { toast(messageFor(error), 'error'); button.disabled = false; } });
  }
  if (stage === 4) document.querySelector('#import-another').addEventListener('click', () => { Object.assign(draft, { upload:null, preview:null, result:null, sheet:null, mapping:null }); renderImport(project); });
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
function renderCaseDetail(project, item, requestedVersion) {
  const resolved = resolveCaseVersion(item, requestedVersion);
  if (!resolved.version) return renderCaseVersionError(project, item, requestedVersion, resolved);
  const version = resolved.version; state.caseVersion = version.version; const content = version.content;
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:item.external_id }]);
  const versions = [...item.versions].sort((a,b) => b.version - a.version).map((entry) => `<button data-version="${entry.version}" class="${entry.version === version.version ? 'active' : ''}"><strong>v${entry.version} · ${entry.content.status === 'CONFIRMED' ? '内容已确认' : '内容待确认'}</strong><span>${esc(fmtDate(entry.created_at))} · ${esc(short(entry.content_sha256))}</span></button>`).join('');
  const steps = content.steps.map((step) => `<article class="step-pair"><div class="step-number">${step.order}</div><div><small>动作</small><p>${esc(step.action)}</p></div><div><small>对应预期</small><p>${esc(step.expected || '（缺失，内容待确认）')}</p></div></article>`).join('');
  const e2eAllowed = E2E01_ENVIRONMENTS[content.external_id] && content.status === 'CONFIRMED' && version.version === 1;
  const authAllowed = !e2eAllowed && AUTH01_ENVIRONMENTS[content.external_id] && content.status === 'CONFIRMED' && version.version === 1;
  const buildButton = e2eAllowed ? '<button class="button primary" id="create-build-task">创建演示建例任务</button>'
    : authAllowed ? '<button class="button primary" id="create-build-task">创建登录建例任务</button>' : '';
  showPage(`<div class="page-heading"><div><p class="eyebrow">${esc(item.case_id)}</p><h1>${esc(content.external_id)} · ${esc(content.title)}</h1><p>${esc(content.module || '未填写模块')} · v${version.version}</p></div><div class="actions">${buildButton}${version.version === item.current_version ? '<button class="button" id="edit-case">编辑当前版本</button>' : '<span class="notice">历史版本只读；编辑请先选择最新版本</span>'}</div></div>
    ${projectTabs(project, 'cases')}<div class="detail-layout"><div class="detail-main">
      <section class="panel"><div class="panel-header"><h2>用例正文</h2><span class="badge ${content.status === 'CONFIRMED' ? 'success' : 'warning'}">${content.status === 'CONFIRMED' ? '内容已确认' : '内容待确认'}</span></div><div class="panel-body"><dl class="definition-grid"><div><dt>模块</dt><dd>${esc(content.module || '—')}</dd></div><div><dt>对外编号</dt><dd>${esc(content.external_id)}</dd></div><div class="wide"><dt>前置条件</dt><dd>${esc(content.preconditions || '—')}</dd></div><div class="wide"><dt>测试数据</dt><dd>${esc(content.test_data || '—')}</dd></div></dl></div></section>
      <section class="panel"><div class="panel-header"><h2>步骤与逐步预期</h2><span class="muted">${content.steps.length} 步</span></div><div class="panel-body"><div class="step-list">${steps}</div></div></section>
      <section class="panel"><div class="panel-header"><h2>来源与追溯</h2></div><div class="panel-body source-box"><dl><dt>根来源身份</dt><dd class="mono">${esc(item.root_source?.stable_id || '未记录')}</dd><dt>导入批次</dt><dd class="mono">${esc(item.import_batch_id || '未记录')}</dd><dt>当前版本内容 SHA-256</dt><dd class="mono">${esc(version.content_sha256)}</dd><dt>版本来源</dt><dd>${esc(version.source || '未知')}</dd></dl></div></section>
    </div><aside class="panel"><div class="panel-header"><h2>版本历史</h2></div><div class="panel-body version-list">${versions}</div></aside></div>`);
  document.querySelectorAll('[data-version]').forEach((button) => button.addEventListener('click', () => { state.caseVersion = Number(button.dataset.version); go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}?version=${button.dataset.version}`, true); }));
  document.querySelector('#create-build-task')?.addEventListener('click', async (event) => { const button=event.currentTarget; button.disabled=true; try { if (authAllowed) { await createAuth01BuildTask(project,item,version); } else { await createE2E01BuildTask(project,item,version); } } catch(error) { toast(messageFor(error),'error'); button.disabled=false; } });
  document.querySelector('#edit-case')?.addEventListener('click', () => { state.editing = { projectRevision:project.revision, caseId:item.case_id, baseVersion:item.current_version, content:structuredClone(content), dirty:false }; renderCaseEditor(project, item); });
}

function renderCaseEditor(project, item) {
  const edit = state.editing; const content = edit.content; setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:item.external_id, href:`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}` }, { label:'编辑当前版本' }]);
  const stepRows = content.steps.map((step, index) => `<div class="edit-step" data-step="${index}"><strong>${index + 1}</strong><label class="field"><span>动作</span><textarea data-action>${esc(step.action)}</textarea></label><label class="field"><span>对应预期</span><textarea data-expected>${esc(step.expected)}</textarea></label><button class="icon-button" data-remove-step="${index}" aria-label="删除第 ${index + 1} 步">×</button></div>`).join('');
  showPage(`<div class="page-heading"><div><p class="eyebrow">EDIT CURRENT VERSION</p><h1>编辑 ${esc(item.external_id)} · v${item.current_version}</h1><p>保存会形成新版本；历史版本和已有任务快照不改写。</p></div></div>
    <section class="panel"><div class="panel-body"><form id="case-edit-form"><div class="form-grid"><label class="field"><span>用例编号</span><input name="external_id" value="${esc(content.external_id)}" required></label><label class="field"><span>标题</span><input name="title" value="${esc(content.title)}" required></label><label class="field"><span>模块</span><input name="module" value="${esc(content.module)}"></label><label class="field"><span>内容状态</span><select name="status"><option value="CONFIRMED" ${content.status === 'CONFIRMED' ? 'selected' : ''}>内容已确认</option><option value="PENDING_CONFIRMATION" ${content.status !== 'CONFIRMED' ? 'selected' : ''}>内容待确认</option></select></label><label class="field wide"><span>前置条件</span><textarea name="preconditions" rows="3">${esc(content.preconditions)}</textarea></label><label class="field wide"><span>测试数据</span><textarea name="test_data" rows="4">${esc(content.test_data)}</textarea></label></div>
      <div class="panel-header inline-section-heading"><h2>步骤与对应预期</h2><button class="button small" type="button" id="add-step">新增步骤</button></div><div id="edit-steps" class="edit-steps">${stepRows}</div>
      <div id="edit-message" class="notice spaced-notice">加载时项目修订：r${project.revision}。发生 409 时会保留当前草稿，不自动覆盖。</div><div class="sticky-actions"><button class="button" type="button" id="cancel-edit">取消</button><button class="button primary" type="submit">保存为新版本</button></div></form></div></section>`);
  const form = document.querySelector('#case-edit-form'); const mark = () => { edit.dirty = true; }; form.addEventListener('input', mark);
  document.querySelector('#add-step').addEventListener('click', () => { syncEditForm(); edit.content.steps.push({ order:edit.content.steps.length + 1, action:'', expected:'' }); edit.dirty = true; renderCaseEditor(project, item); });
  document.querySelectorAll('[data-remove-step]').forEach((button) => button.addEventListener('click', () => { syncEditForm(); edit.content.steps.splice(Number(button.dataset.removeStep), 1); edit.content.steps.forEach((step,index) => { step.order = index + 1; }); edit.dirty = true; renderCaseEditor(project, item); }));
  document.querySelector('#cancel-edit').addEventListener('click', () => go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}`, false));
  form.addEventListener('submit', async (event) => { event.preventDefault(); syncEditForm(); const firstInvalid = edit.content.steps.findIndex((step) => !step.action.trim()); if (!edit.content.steps.length || firstInvalid >= 0) return setEditMessage(firstInvalid >= 0 ? `第 ${firstInvalid + 1} 步缺少动作，不能保存。` : '至少需要一个步骤。', true); const button = form.querySelector('[type=submit]'); button.disabled = true; try { const updated = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}`, jsonOptions({ revision:edit.projectRevision, content:edit.content }, 'PATCH')); edit.dirty = false; state.project = updated; state.caseVersion = item.current_version + 1; toast('已形成新的用例版本。'); go(`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}?version=${state.caseVersion}`, true); } catch (error) { setEditMessage(messageFor(error), true); button.disabled = false; } });
}
function syncEditForm() { const edit = state.editing; const form = document.querySelector('#case-edit-form'); if (!edit || !form) return; const data = new FormData(form); for (const key of ['external_id','title','module','status','preconditions','test_data']) edit.content[key] = String(data.get(key) || ''); edit.content.steps = [...document.querySelectorAll('.edit-step')].map((row,index) => ({ order:index + 1, action:row.querySelector('[data-action]').value, expected:row.querySelector('[data-expected]').value })); }
function setEditMessage(text, danger = false) { const node = document.querySelector('#edit-message'); node.textContent = text; node.className = `notice ${danger ? 'danger' : ''}`; }

const BUILD_TERMINAL = new Set(['WAITING_HUMAN_REVIEW','WAITING_E2E_TRIALS','CANDIDATE_VALIDATION_FAILED','FAILED','CANCELLED','INTERRUPTED']);
const statusLabels = {
  SUBMITTED: '已创建，尚未启动', QUEUED: '排队中', GENERATING: '正在生成', VERIFYING: '正在验证',
  WAITING_E2E_TRIALS: '等待对照试跑', WAITING_HUMAN_REVIEW: '等待人工核对',
  CANDIDATE_VALIDATION_FAILED: '候选验证未通过', FAILED: '失败', CANCELLING: '正在取消',
  CANCELLED: '已取消', INTERRUPTED: '中断', NOT_STARTED: '尚未开始', NOT_RUN: '尚未执行', NOT_EXECUTED: '未执行',
  RUNNING: '进行中', GENERATED: '已生成', COMPLETED: '已完成', INCOMPLETE: '尚未完成',
  NORMAL_PASSED_AWAITING_PAIR: '正常试跑通过，等待对照试跑', PAIR_VALIDATION_FAILED: '对照验证未通过',
  TECHNICAL_VALIDATION_PASSED: '技术验证通过', PASSED: '通过', NOT_READY: '尚不可核对',
  WAITING_REVIEW: '等待人工核对', APPROVED: '已批准',
  ASSERTION_MISMATCH: '断言不符',
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
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${encodeURIComponent(project.project_id)}/cases`},{label:'建例任务',href:`#/projects/${encodeURIComponent(project.project_id)}/build-tasks`},{label:task.source?.external_id || task.task_id}]);
  const content=task.input_bundle?.snapshot?.content; const latest=task.candidates?.at(-1);
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
async function renderBuildTasksRoute(project, taskId = null) {
  if(!taskId){const {tasks}=await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/build-tasks`);return renderBuildTasks(project,tasks);}
  const task=await api(`/api/build/tasks/${encodeURIComponent(taskId)}`);if(task.source?.project_id!==project.project_id)throw new ApiError('BUILD_TASK_NOT_FOUND',404);return renderBuildTaskDetail(project,task);
}
function executionSteps(run) {
  if (run.step_replay?.steps?.length) return run.step_replay.steps;
  if (run.caption_timeline?.steps?.length) return run.caption_timeline.steps;
  return (run.step_coverage?.items || []).map((item) => {
    const source = run.frozen_case_content?.steps?.find((step) => step.order === item.order);
    const mismatch = item.attributed_errors?.find((entry) => entry.error?.type === 'ASSERTION_MISMATCH')?.error;
    return { step_id: item.marker, order: item.order, action: source?.action || '原步骤动作未取得',
      expected: source?.expected || '原步骤预期未取得', execution_status: item.execution_status,
      actual: mismatch?.actual ?? '未单独采集实际值', assertion_expected: mismatch?.expected ?? null };
  });
}

function failureSummary(run) {
  if (!run.error) return '';
  const expected = run.error.expected;
  const actual = run.error.actual;
  return `<div class="notice danger"><strong>${esc(statusText(run.error.type)||'执行失败')}</strong>${expected!=null?`<p>预期：${esc(expected)}</p><p>实际：${esc(actual??'未采集')}</p>`:'<p>本次执行未得到可核对的业务实际值。</p>'}<details><summary>查看原始错误</summary><pre>${esc(run.error.message||run.error.type)}</pre></details></div>`;
}

async function renderExecutionRecords(project) {
  const {records}=await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/execution-records`);
  setBreadcrumb([{label:'项目',href:'#/projects'},{label:project.name,href:`#/projects/${encodeURIComponent(project.project_id)}/cases`},{label:'执行记录'}]);
  const recordsUrl = `#/projects/${encodeURIComponent(project.project_id)}/execution-records`;
  const query=route().query;
  const requestedRunId=query.has('run_id')?query.get('run_id'):null;
  const ordered=[...records].sort((left,right)=>String(left.started_at||'').localeCompare(String(right.started_at||'')));
  const selected=requestedRunId===null?(ordered.at(-1)||null):records.find((run)=>run.run_id===requestedRunId)||null;
  const invalidRunMessage=requestedRunId!==null
    ?`指定的运行记录“${esc(requestedRunId||'（空值）')}”不存在、编号无效或不属于当前项目。没有替换为其他运行记录。`
    :'';
  const rows=records.map((run)=>`<tr${selected?.run_id===run.run_id?' class="selected-run"':''}><td><strong>${esc(run.executed_external_id)}</strong> v${run.executed_case_version}</td><td>${esc(run.source_external_id)} · v${run.source_case_version}</td><td>${esc(short(run.candidate_sha256,16))}</td><td>${esc(run.run_id)}</td><td>${resultBadge(run.status)}</td><td>${esc(run.failure_step || '—')}</td><td><a data-nav href="${recordsUrl}?run_id=${encodeURIComponent(run.run_id)}">查看详情</a> · <a data-nav href="${buildTaskUrl(project,{task_id:run.source_build_task_id})}">查看任务</a></td></tr>`).join('');
  const steps=selected?executionSteps(selected):[];
  const derived=selected?.files.find((file)=>file.kind.endsWith('_caption_video'));
  const original=selected?.files.find((file)=>file.kind.endsWith('_video')&&!file.kind.endsWith('_caption_video')&&!file.kind.endsWith('_step_replay_video'));
  const replayFile=selected?.files.find((file)=>file.kind.endsWith('_step_replay_video'));
  const replayReady=selected?.step_replay?.status==='READY'&&Boolean(replayFile);
  const screenshot=selected?.files.find((file)=>file.kind.endsWith('_screenshot'));
  const trace=selected?.files.find((file)=>file.kind.endsWith('_trace'));
  const timelineReady=selected?.caption_timeline?.status==='VERIFIED' && selected?.caption_timeline?.schema==='workbench/trial-timeline-v2' && Boolean(derived);
  const stepCards=steps.map((step)=>{
    const segment=timelineReady?selected.caption_timeline.presentation?.segments?.find((item)=>item.step_id===step.step_id):null;
    const runnable=segment&&step.execution_status!=='NOT_EXECUTED';
    return `<li class="execution-step" data-step-id="${esc(step.step_id)}"><button type="button" class="execution-step-select" data-step-seek="${esc(step.step_id)}" ${runnable?'':'disabled'} aria-label="${runnable?'定位到':'无法定位'}步骤 ${step.order}">${esc(step.order)}. ${esc(step.action)}</button><span class="badge ${step.execution_status==='FAILED'?'danger':step.execution_status==='PASSED'?'success':'warning'}">${esc(statusText(step.execution_status))}</span><dl><dt>预期</dt><dd>${esc(step.expected)}</dd><dt>实际</dt><dd>${esc(step.actual)}</dd>${step.execution_status==='FAILED'&&step.assertion_expected?`<dt>失败断言预期</dt><dd>${esc(step.assertion_expected)}</dd>`:''}</dl></li>`;
  }).join('');
  let detail=selected?`<article class="preview-item execution-detail" data-run-id="${esc(selected.run_id)}"><header><div><h3>${esc(selected.executed_external_id)} · ${esc(selected.run_id)}</h3><p>候选来源 ${esc(selected.source_external_id)} v${selected.source_case_version} · 当前执行 ${esc(selected.executed_external_id)} v${selected.executed_case_version}</p><p>候选 v${selected.candidate_version} · SHA-256 ${esc(selected.candidate_sha256)} · build ${esc(selected.source_build_task_id)}</p></div>${resultBadge(selected.status)}</header><p>入口：${esc(selected.entry_route)} · 失败步骤：${esc(selected.failure_step||'无')} · 运行器：${esc(selected.runner_version||'历史版本未记录')}</p>${failureSummary(selected)}${selected.specified_defect_detected?'<p>对照验证检出指定缺陷；原始业务状态仍为失败。</p>':''}${derived&&!timelineReady?'<p class="notice warning">当前保留的是旧版中文字幕录像；原录像首帧与步骤事件的时间零点尚未验证，因此不提供精确步骤定位。</p>':''}<div class="execution-evidence-layout"><div class="execution-media"><h4>${derived?(timelineReady?'带中文字幕的交付录像':'旧版带中文字幕录像'):'原始录像'}</h4>${derived||original?`<video data-testid="execution-video" controls preload="metadata" src="${buildMediaUrl(selected.source_build_task_id,(derived||original).file_id)}"></video><p id="execution-video-message" role="status">${timelineReady?'播放位置随步骤更新。':'此记录缺少已验证时间零点，无法精确定位；仍可查看录像和完整步骤说明。'}</p>`:'<p class="notice danger">本次运行没有可用录像。</p>'}${derived?`<a href="${buildMediaUrl(selected.source_build_task_id,derived.file_id)}" download="${esc(selected.executed_external_id)}-captioned.webm">下载带字幕视频</a>`:''}${original?`<a href="${buildMediaUrl(selected.source_build_task_id,original.file_id)}" target="_blank" rel="noreferrer">打开原始录像</a>`:''}${screenshot?`<a href="${buildMediaUrl(selected.source_build_task_id,screenshot.file_id)}" target="_blank" rel="noreferrer">查看本次截图</a>`:'<span>截图未采集</span>'}${trace?`<a href="${buildMediaUrl(selected.source_build_task_id,trace.file_id)}" download>下载本次 Trace</a>`:'<span>Trace 未采集</span>'}</div><div class="execution-steps"><h4>本次运行步骤</h4><p id="execution-playing-step">播放位置：尚未播放</p><ol>${stepCards}</ol></div></div></article>`:requestedRunId!==null?`<div class="notice danger" role="alert" data-testid="run-record-not-found"><p>${invalidRunMessage}</p><a class="button" data-nav href="${recordsUrl}">返回运行列表</a></div>`:'<p class="muted">尚无运行记录。</p>';
  if(selected?.step_replay){
    const replay=selected.step_replay;
    const chapterById=new Map((replay.chapters||[]).map((chapter)=>[chapter.step_id,chapter]));
    const cards=steps.map((step)=>{
      const chapter=chapterById.get(step.step_id);
      const image=selected.files.find((file)=>file.file_name===step.screenshot_file_name&&file.kind.endsWith('_screenshot'));
      return `<li class="execution-step" data-step-id="${esc(step.step_id)}"><button type="button" class="execution-step-select" data-step-seek="${esc(step.step_id)}" ${replayReady&&chapter?'':'disabled'}>${esc(step.order)}. ${esc(step.action)}</button><span class="badge ${step.execution_status==='FAILED'?'danger':step.execution_status==='PASSED'?'success':'warning'}">${esc(statusText(step.execution_status))}</span><dl><dt>预期</dt><dd>${esc(step.expected)}</dd><dt>实际</dt><dd>${esc(step.actual)}</dd>${step.execution_status==='FAILED'?`<dt>原断言预期</dt><dd>${esc(step.assertion_expected||step.expected)}</dd>`:''}<dt>采集</dt><dd>${esc(step.screenshot_phase||'未采集')} · ${esc(step.screenshot_error||'步骤结束后截图，未录得连续动作片段')}</dd></dl>${image?`<a href="${buildMediaUrl(selected.source_build_task_id,image.file_id)}" target="_blank" rel="noreferrer">打开本步骤原始截图</a>`:step.execution_status!=='NOT_EXECUTED'?'<p class="notice danger">本步骤截图缺失。</p>':''}</li>`;
    }).join('');
    detail=`<article class="preview-item execution-detail" data-run-id="${esc(selected.run_id)}"><header><div><h3>${esc(selected.executed_external_id)} · ${esc(selected.run_id)}</h3><p>来源候选 ${esc(selected.source_external_id)} v${selected.candidate_version} · SHA-256 ${esc(selected.candidate_sha256)}</p></div>${resultBadge(selected.status)}</header><p>执行用例 v${selected.executed_case_version} · 运行器 ${esc(selected.runner_version)}</p>${failureSummary(selected)}${selected.specified_defect_detected?'<p>对照验证检出指定缺陷；原始业务状态仍为失败。</p>':''}<p class="notice">步骤证据回放由本次运行的步骤截图和实际结果合成，不是原始连续录像。原始录像尚不支持精确步骤定位。</p><div class="execution-evidence-layout"><div class="execution-media"><h4>中文步骤证据回放（非原始连续录像）</h4>${replayReady?`<video data-testid="execution-video" controls preload="metadata" src="${buildMediaUrl(selected.source_build_task_id,replayFile.file_id)}"></video><p id="execution-video-message" role="status">播放位置随回放章节更新；点击已执行步骤可定位。</p><a href="${buildMediaUrl(selected.source_build_task_id,replayFile.file_id)}" download="${esc(selected.executed_external_id)}-step-replay.webm">下载带中文字幕的步骤证据回放</a>`:`<p class="notice danger">步骤回放不可用：${esc(replay.reason||'素材未登记')}；原始业务结果未改变。</p>`}<h4>原始连续录像（不支持精确步骤定位）</h4>${original?`<video data-testid="original-video" controls preload="metadata" src="${buildMediaUrl(selected.source_build_task_id,original.file_id)}"></video><a href="${buildMediaUrl(selected.source_build_task_id,original.file_id)}" target="_blank" rel="noreferrer">单独打开原始连续录像</a>`:'<p class="notice danger">原始录像缺失。</p>'}${screenshot?`<a href="${buildMediaUrl(selected.source_build_task_id,screenshot.file_id)}" target="_blank" rel="noreferrer">查看运行截图</a>`:''}${trace?`<a href="${buildMediaUrl(selected.source_build_task_id,trace.file_id)}" download>下载本次 Trace</a>`:'<p>Trace 未采集</p>'}</div><div class="execution-steps"><h4>本次运行步骤</h4><p id="execution-playing-step">播放位置：尚未播放</p><ol>${cards}</ol></div></div></article>`;
  }
  if(selected?.step_replay?.evidence_complete===false)
    detail=detail.replace('<div class="execution-evidence-layout">',`<p class="notice danger">步骤截图采集不完整：${esc((selected.step_replay.missing_captures||[]).join('、'))}。回放可查看已取得素材，不能视为完整步骤证据。</p><div class="execution-evidence-layout">`);
  showPage(`<div class="page-heading"><div><p class="eyebrow">CANDIDATE TRIAL RECORDS</p><h1>项目执行记录</h1><p>故障入口的原始结果保持失败；候选尚未批准。</p></div></div>${projectTabs(project,'execution-records')}${(selected||requestedRunId===null)?`<section class="panel"><div class="panel-header"><h2>运行索引</h2><span class="muted">${records.length} 条</span></div><div class="panel-body">${rows?`<div class="table-wrap"><table><thead><tr><th>执行用例</th><th>生成来源</th><th>候选哈希</th><th>Run ID</th><th>原始结果</th><th>失败步骤</th><th>详情</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty"><h2>暂无执行记录</h2><p>从用例创建任务并试跑后，记录会显示在这里。</p></div>'}</div></section>`:''}<section class="panel"><div class="panel-header"><h2>${requestedRunId!==null&&!selected?'运行记录未找到':'步骤与媒体'}</h2></div><div class="panel-body">${detail}</div></section>`);
  const video=document.querySelector('[data-testid="execution-video"]');
  if(!video)return;
  const disableSeeking=()=>document.querySelectorAll('[data-step-seek]').forEach((button)=>{button.disabled=true;});
  video.addEventListener('error',()=>{document.querySelector('#execution-video-message').textContent='录像加载失败，请核对本次运行媒体；业务结果未改变。';disableSeeking();});
  const checkDuration=()=>{
    if(!Number.isFinite(video.duration)||video.duration<=0){
      document.querySelector('#execution-video-message').textContent='这段录像缺少可校验时长，不能精确定位步骤；请查看原始录像。';
      disableSeeking();
    }
  };
  video.addEventListener('loadedmetadata',checkDuration);
  if(video.readyState>=1)checkDuration();
  if(replayReady){
    const chapters=selected.step_replay.chapters||[];
    const playing=document.querySelector('#execution-playing-step');
    const update=()=>{
      const chapter=[...chapters].reverse().find((item)=>video.currentTime>=item.start_seconds-0.04&&video.currentTime<item.end_seconds+0.04);
      document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('playing',item.dataset.stepId===chapter?.step_id));
      playing.textContent=chapter?`播放位置：步骤 ${steps.find((step)=>step.step_id===chapter.step_id)?.order} · ${video.currentTime>=chapter.result_start_seconds?'结果':'动作'}`:'播放位置：章节间';
    };
    video.addEventListener('timeupdate',update);video.addEventListener('seeked',update);
    document.querySelectorAll('[data-step-seek]').forEach((button)=>button.addEventListener('click',()=>{
      const chapter=chapters.find((item)=>item.step_id===button.dataset.stepSeek);if(!chapter)return;
      document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('selected',item.dataset.stepId===button.dataset.stepSeek));
      video.currentTime=steps.find((step)=>step.step_id===button.dataset.stepSeek)?.execution_status==='FAILED'
        ?chapter.result_start_seconds:chapter.start_seconds;
    }));
    return;
  }
  if(!timelineReady)return;
  const segments=selected.caption_timeline.presentation?.segments||[];
  const playing=document.querySelector('#execution-playing-step');
  const updatePlayback=()=>{
    const segment=[...segments].reverse().find((item)=>video.currentTime>=item.action_start_seconds-0.08&&video.currentTime<item.end_seconds+0.08);
    document.querySelectorAll('.execution-step').forEach((item)=>item.classList.toggle('playing',item.dataset.stepId===segment?.step_id));
    playing.textContent=segment?`播放位置：步骤 ${steps.find((item)=>item.step_id===segment.step_id)?.order} · ${video.currentTime>=segment.result_start_seconds?'结果':'操作'}`:'播放位置：步骤间';
  };
  video.addEventListener('timeupdate',updatePlayback);
  video.addEventListener('seeked',updatePlayback);
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
  const target = [...document.querySelectorAll('.preview-item')].find((item) => item.querySelector('h3')?.textContent.includes(runId));
  if (target) { target.tabIndex = -1; target.style.scrollMarginTop = '72px'; target.scrollIntoView({ block:'start' }); target.focus({ preventScroll:true }); }
}

function renderSettings(project) {
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${encodeURIComponent(project.project_id)}/cases` }, { label:'项目设置' }]);
  showPage(`<div class="page-heading"><div><p class="eyebrow">PROJECT SETTINGS</p><h1>项目设置</h1><p>仅修改名称和说明；本阶段不提供删除、成员或权限管理。</p></div></div>${projectTabs(project, 'settings')}
    <section class="panel settings-card"><div class="panel-header"><h2>基本信息</h2><span class="mono">${esc(project.project_id)}</span></div><div class="panel-body"><form id="settings-form" class="form-grid"><label class="field wide"><span>项目名称</span><input name="name" value="${esc(project.name)}" maxlength="120" required></label><label class="field wide"><span>项目说明</span><textarea name="description" rows="5" maxlength="5000">${esc(project.description)}</textarea></label><div class="notice wide">当前项目修订 r${project.revision}。若其他标签页先保存，当前请求会被后端拒绝而不会静默覆盖。</div><div class="actions wide"><button class="button primary" type="submit">保存项目信息</button></div></form></div></section>`);
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
  const { environments } = await api(endpoint);
  const environment = environments[0];
  setBreadcrumb([{ label:'项目', href:'#/projects' }, { label:project.name, href:`#/projects/${id}/cases` }, { label:'登录准备' }]);
  showPage(`<div class="page-heading"><div><p class="eyebrow">TARGET AUTHENTICATION</p><h1>被测系统登录准备</h1><p>登录发生在工作台打开的专用浏览器，不是工作台账号登录。登录完成后，可在 AUTH-TC-001 用例详情创建登录建例任务；会话失效或被清除时，关联的建例与复跑会立即停止。</p></div></div>${projectTabs(project,'auth')}
    <section class="panel settings-card"><div class="panel-header"><h2>环境与角色</h2></div><div class="panel-body">
    ${environment ? `<div class="form-grid"><label class="field"><span>被测环境</span><select id="auth-environment">${environments.map(item=>`<option value="${esc(item.environment_id)}">${esc(item.name)}</option>`).join('')}</select></label>
    <label class="field"><span>账号角色</span><select id="auth-role"></select></label></div>
    <p id="auth-status" role="status" class="notice">正在检查登录状态…</p>
    <div class="actions"><button class="button primary" id="auth-open">打开专用登录浏览器</button><button class="button" id="auth-check">检查登录</button><button class="button" id="auth-clear">清除会话</button></div>` : '<p class="notice">当前未登记可登录的被测环境。</p>'}
    <p class="notice">本阶段只提供独立本机合成站。请在专用窗口自行输入账号和密码；验证码、扫码或多因素认证也由你完成。登录阶段不启动模型观察、不采集业务录像、截图或 Trace。AUTH-TC-001 的登录建例任务已绑定此环境：显示“有效”后，启动建例与候选复跑会复核并绑定当前会话版本；会话失效或被清除时关联运行立即停止，需要重新登录后再复跑。</p>
    </div></section>`);
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
    statusNode.textContent = `状态：${authStatusLabels[value.status] || value.status} · 角色：${value.role} · 账号：${value.account_id || '未确认'}${value.expires_at ? ` · 服务端有效期至 ${fmtDate(value.expires_at)}` : ''}${value.reason ? ` · 原因：${value.reason}` : ''}`;
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
      const result = await mutate(`${endpoint}/${operation}`, jsonOptions(currentScope()));
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

async function render(force = false) {
  if (force) { loading.hidden = false; app.hidden = true; state.error = null; }
  try {
    await api('/api/health'); setService(true);
    if (!state.projects.length || force) await loadProjects();
    const value = route(); const parts = value.parts;
    if (!parts.length || parts[0] !== 'projects') return go('#/projects', true);
    if (parts.length === 1) return renderProjects();
    const projectId = parts[1]; if (!state.project || state.project.project_id !== projectId || force) await loadProject(projectId); const project = state.project;
    setSidebarNavigation(project, parts[2] === 'auth' ? 'auth' : parts[2] === 'build-tasks' ? 'build-tasks' : parts[2] === 'execution-records' ? 'execution-records' : 'projects');
    if (parts[2] === 'import') return renderImport(project);
    if (parts[2] === 'settings') return renderSettings(project);
    if (parts[2] === 'auth') return renderAuth(project);
    if (parts[2] === 'build-tasks') return renderBuildTasksRoute(project, parts[3] || null);
    if (parts[2] === 'execution-records') { await renderExecutionRecords(project); focusExecutionRecord(value.query.get('run_id')); return; }
    if (parts[2] === 'cases' && parts[3]) { const item = project.cases.find((entry) => entry.case_id === parts[3]); if (!item) throw new ApiError('CASE_NOT_FOUND', 404); return renderCaseDetail(project, item, value.query.get('version')); }
    return await renderCases(project);
  } catch (error) { showFatal(error); }
}

window.addEventListener('hashchange', () => { if (state.allowNavigation) { state.allowNavigation = false; void render(); return; } if (isDirty() && !confirm('当前修改尚未保存，离开后草稿会丢失。是否继续？')) { history.forward(); return; } state.editing = null; void render(); });
await render(true);
