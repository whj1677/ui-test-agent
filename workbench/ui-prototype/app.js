import { DEMO_STORAGE_KEY, createDemoState, currentCaseVersion, freezeCaseVersion, appendCaseVersion, generationPhase, technicalValidationPhase, humanReviewPhase, registrationPhase, makeCasePackage } from './demo-data.js';

const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toast = document.querySelector('#toast');
let modalTrigger = null;

const icons = {
  projects: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/></svg>',
  cases: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>',
  build: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 6.5 3-3a4 4 0 0 1-5 5l-7 7a2 2 0 1 0 3 3l7-7a4 4 0 0 1 5-5l-3 3z"/></svg>',
  run: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>',
  settings: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 15l2 1-2 3-2-1a8 8 0 0 1-2 1l-1 2h-4l-1-2a8 8 0 0 1-2-1l-2 1-2-3 2-1a8 8 0 0 1 0-3L3 11l2-3 2 1a8 8 0 0 1 2-1l1-2h4l1 2a8 8 0 0 1 2 1l2-1 2 3-2 1a8 8 0 0 1 0 3z"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  upload: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5"/></svg>',
  download: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4v12m0 0 5-5m-5 5-5-5M4 19h16"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  close: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  reset: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4v6h6M5 10a8 8 0 1 1 2 7"/></svg>',
};

function loadState() {
  try {
    const saved = sessionStorage.getItem(DEMO_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : createDemoState();
    parsed.ui.editingCase = null;
    return parsed;
  } catch {
    return createDemoState();
  }
}

let state = loadState();
const persist = () => sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const projectCases = (projectId) => state.cases.filter((item) => item.projectId === projectId);
const projectBuilds = (projectId) => state.builds.filter((item) => item.projectId === projectId);
const projectRuns = (projectId) => state.runs.filter((item) => item.projectId === projectId);
const getProject = (id) => state.projects.find((item) => item.id === id);
const getCase = (projectId, id) => state.cases.find((item) => item.projectId === projectId && item.id === id);
const getBuild = (projectId, id) => state.builds.find((item) => item.projectId === projectId && item.id === id);
const getRun = (projectId, id) => state.runs.find((item) => item.projectId === projectId && item.id === id);

function toneFor(label) {
  if (/通过|已确认|已完成|已首审且适用|证据齐全/.test(label)) return 'success';
  if (/失败|不符|异常|缺失|中断/.test(label)) return 'danger';
  if (/待|范围|澄清|不匹配|未完成/.test(label)) return 'warning';
  if (/生成中|进行中/.test(label)) return 'progress';
  return 'neutral';
}

function badge(label, tone = toneFor(label)) {
  return `<span class="badge ${tone}"><span class="status-dot"></span>${esc(label)}</span>`;
}

function route() {
  const raw = (location.hash || '#/projects').slice(2);
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] !== 'projects' || parts.length === 1) return { page: 'projects', params };
  const projectId = parts[1];
  if (parts[2] === 'import') return { page: 'import', projectId, params };
  if (parts[2] === 'cases' && parts[3]) return { page: 'case', projectId, id: parts[3], params };
  if (parts[2] === 'builds' && parts[3]) return { page: 'build', projectId, id: parts[3], params };
  if (parts[2] === 'runs' && parts[3]) return { page: 'run', projectId, id: parts[3], params };
  return { page: parts[2] || 'cases', projectId, params };
}

function navigate(target, { force = false } = {}) {
  if (!force && state.ui.editingCase && !window.confirm('当前用例有未保存修改。离开后将丢弃这些修改，是否继续？')) return;
  if (state.ui.editingCase) state.ui.editingCase = null;
  if (location.hash === target) render(); else location.hash = target;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3800);
}

function counts(projectId) {
  const cases = projectCases(projectId);
  return {
    cases: cases.length,
    confirmed: cases.filter((item) => item.contentStatus === '内容已确认').length,
    scripted: cases.filter((item) => item.automationStatus === '已有适用脚本').length,
    attention: cases.filter((item) => /待|澄清|不匹配|异常/.test(`${item.contentStatus}${item.automationStatus}${item.recentStatus}`)).length,
  };
}

function shell(content, active, project, title) {
  const projectContext = Boolean(project);
  const count = projectContext ? counts(project.id) : null;
  return `<div class="shell">
    <aside class="sidebar" aria-label="工作台导航">
      <div class="brand"><span class="brand-mark">${icons.cases}</span><div><strong>测试工作台</strong><small>TEST WORKSPACE</small></div></div>
      <nav class="side-nav"><button class="side-link ${active === 'projects' ? 'active' : ''}" data-route="#/projects">${icons.projects}<span>所有项目</span></button></nav>
      ${projectContext ? `<div class="project-context"><strong>${esc(project.name)}</strong><span>${count.cases}条用例 · 演示项目</span></div>
        <nav class="side-nav" aria-label="项目内导航">
          <button class="side-link ${active === 'cases' ? 'active' : ''}" data-route="#/projects/${project.id}/cases">${icons.cases}<span>用例库</span></button>
          <button class="side-link ${active === 'builds' ? 'active' : ''}" data-route="#/projects/${project.id}/builds">${icons.build}<span>建例任务</span></button>
          <button class="side-link ${active === 'runs' ? 'active' : ''}" data-route="#/projects/${project.id}/runs">${icons.run}<span>执行记录</span></button>
          <button class="side-link ${active === 'settings' ? 'active' : ''}" data-route="#/projects/${project.id}/settings">${icons.settings}<span>项目设置</span></button>
        </nav>` : ''}
      <div class="side-spacer"></div>
      <div class="prototype-note"><span class="workspace-indicator"></span><div><strong>本地演示工作区</strong><small>交互原型 · 演示数据</small></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumbs"><button data-route="#/projects">所有项目</button>${projectContext ? `<span>/</span><button data-route="#/projects/${project.id}/cases">${esc(project.name)}</button>` : ''}${title ? `<span>/</span><strong>${esc(title)}</strong>` : ''}</div><div class="top-actions"><span class="demo-pill">配色示例 · 演示数据</span><button class="button ghost" id="reset-demo">${icons.reset}重置演示</button></div></header>
      <main id="main-content" class="content" tabindex="-1">${content}</main>
    </div>
  </div>`;
}

function notFound(message, project = null) {
  return shell(`<section class="empty-state"><h1>无法找到对象</h1><p>${esc(message)}</p><button class="button primary" data-route="${project ? `#/projects/${project.id}/cases` : '#/projects'}">返回</button></section>`, project ? 'cases' : 'projects', project, '未找到');
}

function pageHeading(kicker, title, description, actions = '') {
  return `<header class="page-heading"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="heading-actions">${actions}</div></header>`;
}

function renderProjects() {
  const query = state.ui.projectSearch.trim().toLowerCase();
  const projects = state.projects.filter((item) => !query || `${item.name} ${item.description}`.toLowerCase().includes(query));
  const content = `${pageHeading('项目工作区', '所有项目', '从项目进入用例、建例任务和执行记录。', `<button class="button primary" id="new-project">${icons.plus}新建项目</button>`)}
    <section class="workspace-overview"><div><span class="eyebrow">从用例到结果</span><h2>让每一次验证，都有据可查。</h2><p>选择一个项目，继续维护用例、核对候选或查看执行结果。</p></div><div class="overview-metrics"><div><strong>${state.projects.length}</strong><span>项目</span></div><div><strong>${state.cases.length}</strong><span>用例</span></div><div><strong>${state.builds.length}</strong><span>建例任务</span></div></div></section>
    <div class="toolbar compact project-toolbar"><label class="search-field"><span class="sr-only">搜索项目</span><input id="project-search" value="${esc(state.ui.projectSearch)}" placeholder="搜索项目名称或说明"></label><span class="toolbar-note">${projects.length} / ${state.projects.length} 个项目</span></div>
    <div class="project-grid" data-testid="projects-table">${projects.map((item,index) => { const summary=counts(item.id); return `<article class="project-card"><div class="project-card-top"><span class="project-symbol variant-${index % 3}">${icons.projects}</span><span class="demo-label">演示项目</span></div><button class="project-title" data-route="#/projects/${item.id}/cases">${esc(item.name)}</button><p>${esc(item.description)}</p><div class="project-metrics"><div><strong>${summary.cases}</strong><span>用例</span></div><div><strong>${summary.confirmed}</strong><span>内容已确认</span></div><div><strong>${summary.scripted}</strong><span>适用脚本</span></div></div><footer><small>最近活动 · ${esc(item.lastActivity)}</small><button class="link-button" data-route="#/projects/${item.id}/cases">进入项目 <span aria-hidden="true">→</span></button></footer></article>`; }).join('') || `<div class="empty-state"><strong>没有匹配项目</strong><p>调整关键词或清空搜索。</p><button class="button" id="clear-project-search">清空搜索</button></div>`}</div>`;
  app.innerHTML = shell(content, 'projects', null, '');
}

function filterFor(projectId) { return state.ui.caseFilters[projectId] ||= { search: '', module: '全部模块', content: '全部内容状态', automation: '全部自动化状态' }; }
function selectedFor(projectId) { return state.ui.selectedCaseIds[projectId] ||= []; }

function filteredCases(projectId) {
  const filter = filterFor(projectId);
  return projectCases(projectId).filter((item) => {
    const search = !filter.search || `${item.externalId} ${item.title}`.toLowerCase().includes(filter.search.toLowerCase());
    return search && (filter.module === '全部模块' || item.module === filter.module) && (filter.content === '全部内容状态' || item.contentStatus === filter.content) && (filter.automation === '全部自动化状态' || item.automationStatus === filter.automation);
  });
}

function renderCases(project) {
  const all = projectCases(project.id);
  const filtered = filteredCases(project.id);
  const perPage = 25;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(state.ui.casePage[project.id] || 1, pages);
  state.ui.casePage[project.id] = page;
  const visible = filtered.slice((page - 1) * perPage, page * perPage);
  const selected = selectedFor(project.id);
  const visibleIds = new Set(visible.map((item) => item.id));
  const hiddenCount = selected.filter((id) => !visibleIds.has(id)).length;
  const modules = [...new Set(all.map((item) => item.module))].sort();
  const f = filterFor(project.id);
  const summary = counts(project.id);
  const actions = `<button class="button" id="export-all">${icons.download}导出全部</button><button class="button primary" data-route="#/projects/${project.id}/import">${icons.upload}导入用例</button>`;
  const content = `${pageHeading('项目用例库', '用例库', `${summary.cases}条用例 · ${summary.confirmed}条内容已确认 · ${summary.scripted}条已有适用脚本`, actions)}
    ${all.length ? `<div class="toolbar filters"><label class="search-field"><span class="sr-only">搜索用例</span><input id="case-search" value="${esc(f.search)}" placeholder="搜索编号或标题"></label><select id="module-filter" aria-label="模块筛选"><option>全部模块</option>${modules.map((value) => `<option ${f.module === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><select id="content-filter" aria-label="内容状态筛选">${['全部内容状态','内容已确认','内容待确认','存在待澄清项'].map((value) => `<option ${f.content === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select id="automation-filter" aria-label="自动化状态筛选">${['全部自动化状态','未建例','生成中','待处理','待人工核对','已有适用脚本','脚本版本不匹配','验收范围待确认'].map((value) => `<option ${f.automation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
    ${selected.length ? `<div class="bulk-bar" data-testid="bulk-bar"><strong>已选${selected.length}条</strong>${hiddenCount ? `<span>其中${hiddenCount}条不在当前筛选或页面内</span>` : '<span>均在当前页面可见</span>'}<button class="button" id="export-selected">${icons.download}导出选中</button><button class="link-button" id="clear-selection">清空选择</button></div>` : ''}
    <div class="table-wrap"><table data-testid="case-table"><thead><tr><th><input type="checkbox" id="select-visible" aria-label="选择当前页全部用例" ${visible.length && visible.every((item) => selected.includes(item.id)) ? 'checked' : ''}></th><th>编号与标题</th><th>模块</th><th>内容状态</th><th>自动化状态</th><th>最近执行</th><th>用例版本</th><th>更多</th></tr></thead><tbody>${visible.map((item) => `<tr class="${(state.ui.highlightedCaseIds[project.id] || []).includes(item.id) ? 'highlighted' : ''}"><td><input type="checkbox" data-select-case="${item.id}" aria-label="选择${esc(item.externalId)}" ${selected.includes(item.id) ? 'checked' : ''}></td><td><button class="row-link" data-route="#/projects/${project.id}/cases/${item.id}"><strong>${esc(item.externalId)}</strong><span title="${esc(item.title)}">${esc(item.title)}</span></button><small>${esc(item.sourceType)} · ${esc(item.sourceBatch)}</small></td><td>${esc(item.module)}</td><td>${badge(item.contentStatus)}</td><td>${badge(item.automationStatus)}</td><td>${badge(item.recentStatus)}<small>${esc(item.recentTime)}</small></td><td>v${item.currentVersion}</td><td><button class="button small" data-route="#/projects/${project.id}/cases/${item.id}">查看</button></td></tr>`).join('')}</tbody></table></div>
    <footer class="pagination"><span>${filtered.length ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, filtered.length)}` : 0} / ${filtered.length}条 · 25条/页</span><div><button class="button small" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button><span>第${page}/${pages}页</span><button class="button small" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>下一页</button></div></footer>` : `<section class="empty-state"><h2>这个项目还没有用例</h2><p>可以随时载入Excel演示场景或平台原生JSON包。</p><button class="button primary" data-route="#/projects/${project.id}/import">${icons.upload}导入用例</button></section>`}`;
  app.innerHTML = shell(content, 'cases', project, '用例库');
}

function importRows(projectId, source) {
  const existing = new Set(projectCases(projectId).map((item) => item.externalId));
  const base = source === 'excel' ? [
    ['DEMO-X-101','温度筛选保真','新增','用例!2', [{ order: 1, action: '选择温度筛选条件。', expected: '数值220.5 kW保持原文。' }]],
    ['DEMO-X-102','网络地址字段核对','新增','用例!3', [{ order: 1, action: '读取地址。', expected: '显示127.0.0.1和版本3.65 V。' }]],
    ['DEMO-S-001','设备排序与分页','重复','用例!4', queryImportSteps()],
    ['DEMO-Q-001','列表查询核对（修订稿）','同源版本冲突','用例!5', queryImportSteps()],
    ['DEMO-X-105','缺少逐步预期','待澄清','用例!6', [{ order: 1, action: '点击保存。', expected: '' }]],
    ['DEMO-X-106','公式字段不可读取','不能导入','用例!7', [{ order: 1, action: '=EXTERNAL.VALUE()', expected: '公式值不可可靠取得。' }]],
  ] : [
    ['DEMO-J-201','平台包联合查询','新增','cases[0]', queryImportSteps()],
    ['DEMO-J-202','平台包结果导出','新增','cases[1]', [{ order: 1, action: '选择两条用例并导出。', expected: '下载平台用例包JSON，步骤与来源完整。' }]],
    ['DEMO-Q-001','列表查询核对','重复','cases[2]', queryImportSteps()],
  ];
  return base.map(([externalId,title,kind,location,steps]) => ({ externalId, title, kind: existing.has(externalId) && kind === '新增' ? '重复' : kind, location, steps, decision: kind === '新增' ? '导入' : kind === '同源版本冲突' ? '跳过，不覆盖' : '不导入' }));
}

function queryImportSteps() { return [{ order: 1, action: '打开列表。', expected: '默认状态正确。' }, { order: 2, action: '选择条件但不查询。', expected: '表格保持前态。' }, { order: 3, action: '点击查询。', expected: '数量、顺序与字段符合要求。' }]; }
function importableRows(draft) { return draft.rows.filter((row) => row.kind === '新增' || (row.kind === '同源版本冲突' && row.decision === '作为独立副本导入')); }
function getImportDraft(projectId) { return state.ui.importDrafts[projectId] ||= { source: 'excel', step: 1, rows: [], completed: null }; }

function renderImport(project) {
  const draft = getImportDraft(project.id);
  const labels = ['选择场景','字段映射','预览与决定','导入结果'];
  const progress = `<div class="wizard-progress">${labels.map((label,index) => `<div class="wizard-step ${draft.step === index + 1 ? 'active' : draft.step > index + 1 ? 'done' : ''}"><span>${draft.step > index + 1 ? '✓' : index + 1}</span><strong>${label}</strong></div>`).join('')}</div>`;
  let body = '';
  if (draft.step === 1) body = `<section class="wizard-card"><h2>选择演示导入场景</h2><p class="boundary-note">不读取真实文件。下面按钮载入预置夹具，预览结果不是对任意用户文件的真实解析。</p><div class="source-grid"><button class="source-option ${draft.source === 'excel' ? 'selected' : ''}" data-import-source="excel"><strong>Excel · .xlsx</strong><span>一行一条用例；步骤与预期按单元格内行位置配对。</span><small>载入演示Excel场景</small></button><button class="source-option ${draft.source === 'json' ? 'selected' : ''}" data-import-source="json"><strong>平台原生用例包 · .json</strong><span>格式：workbench/case-package-v1；不携带脚本和结果。</span><small>载入演示JSON包</small></button></div><div class="wizard-actions"><button class="button" data-route="#/projects/${project.id}/cases">取消</button><button class="button primary" id="load-import-demo">载入${draft.source === 'excel' ? 'Excel' : 'JSON'}演示场景</button></div></section>`;
  if (draft.step === 2) body = `<section class="wizard-card"><h2>${draft.source === 'excel' ? '工作表与字段映射' : '校验平台包'}</h2>${draft.source === 'excel' ? `<div class="mapping-grid">${[['工作表','用例'],['用例编号','编号'],['标题','标题'],['模块','模块'],['步骤','步骤'],['逐步预期','预期']].map(([label,value]) => `<label><span>${label}</span><select><option>${value}</option></select></label>`).join('')}</div><p class="helper">空行位置不会被重新配对；公式、外部链接和归属不明记录进入问题清单。</p>` : `<dl class="definition-grid"><div><dt>Schema</dt><dd>workbench/case-package-v1</dd></div><div><dt>文件</dt><dd>demo-platform-cases.json</dd></div><div><dt>安全边界</dt><dd>演示JSON，不执行任何代码</dd></div></dl>`}<div class="wizard-actions"><button class="button" id="import-back">上一步</button><button class="button primary" id="generate-preview">生成演示预览</button></div></section>`;
  if (draft.step === 3) {
    const kinds = ['新增','重复','同源版本冲突','待澄清','不能导入'];
    body = `<section class="wizard-card wide"><div class="section-heading"><div><h2>预览与导入决定</h2><p class="boundary-note">演示解析结果，不是对用户所选文件的真实解析。</p></div><div class="count-strip">${kinds.map((kind) => `<span><strong>${draft.rows.filter((row) => row.kind === kind).length}</strong>${kind}</span>`).join('')}</div></div><div class="table-wrap"><table data-testid="import-preview"><thead><tr><th>分类</th><th>编号与标题</th><th>动作与逐步预期</th><th>原始位置</th><th>处理决定</th></tr></thead><tbody>${draft.rows.map((row) => `<tr><td>${badge(row.kind)}</td><td><strong>${row.externalId}</strong><small>${esc(row.title)}</small></td><td>${row.steps.map((step) => `<div class="mini-step"><b>${step.order}</b><span>动作：${esc(step.action)}<br>预期：${esc(step.expected || '缺失，待澄清')}</span></div>`).join('')}</td><td class="mono">${esc(row.location)}</td><td>${row.kind === '同源版本冲突' ? `<select data-row-decision="${row.externalId}" aria-label="${row.externalId}冲突处理"><option ${row.decision === '跳过，不覆盖' ? 'selected' : ''}>跳过，不覆盖</option><option ${row.decision === '作为独立副本导入' ? 'selected' : ''}>作为独立副本导入</option></select>` : esc(row.decision)}</td></tr>`).join('')}</tbody></table></div><div class="wizard-actions"><button class="button" id="import-back">上一步</button><button class="button primary" id="confirm-import">确认导入${importableRows(draft).length}条</button></div></section>`;
  }
  if (draft.step === 4) body = `<section class="wizard-card result"><span class="result-icon">✓</span><h2>演示导入完成</h2><p>新增${draft.completed.added}条，重复${draft.completed.duplicate}条，冲突${draft.completed.conflict}条，待澄清${draft.completed.clarify}条，拒绝${draft.completed.rejected}条。</p><p class="helper">重复导入不会再次增加同一批用例；项目数量已从同一演示数据源重新计算。</p><div class="wizard-actions center">${draft.source === 'excel' ? '<button class="button" id="continue-json">继续导入平台演示JSON</button>' : '<button class="button" id="repeat-json">再次载入同一JSON包</button>'}<button class="button primary" data-route="#/projects/${project.id}/cases">返回用例列表</button></div></section>`;
  const content = `${pageHeading('多来源追加导入', '导入用例', 'Excel与平台原生JSON包使用同一套项目用例模型。', `<button class="button" data-route="#/projects/${project.id}/cases">${icons.back}返回用例库</button>`)}${progress}${body}`;
  app.innerHTML = shell(content, 'cases', project, '导入用例');
}

function addImportedCases(project, draft) {
  const additions = importableRows(draft);
  const ids = [];
  for (const row of additions) {
    const independent = row.kind === '同源版本冲突';
    const id = `${project.id}-${row.externalId.toLowerCase()}${independent ? '-independent-demo' : ''}`;
    if (getCase(project.id, id)) continue;
    ids.push(id);
    const preconditions = '演示导入用例。';
    const testData = '演示数据，不连接真实后台。';
    state.cases.push({ id, projectId: project.id, externalId: row.externalId, title: independent ? `${row.title}（独立副本）` : row.title, module: draft.source === 'excel' ? 'Excel演示' : '平台包演示', contentStatus: '内容已确认', automationStatus: '未建例', recentStatus: '未运行', recentTime: '未运行', currentVersion: 1, sourceType: draft.source === 'excel' ? 'Excel' : '平台用例包', sourceBatch: independent ? 'demo-excel-conflict-copy-01' : draft.source === 'excel' ? 'demo-excel-import-01' : 'demo-json-import-01', highlighted: true, preconditions, testData, versions: [{ version: 1, contentHash: `${row.externalId}-V1-DEMO${independent ? '-COPY' : ''}`, createdAt: state.demoClock, preconditions, testData, steps: row.steps }] });
  }
  state.ui.highlightedCaseIds[project.id] = ids;
  const count = (kind) => draft.rows.filter((row) => row.kind === kind).length;
  draft.completed = { added: ids.length, duplicate: count('重复'), conflict: count('同源版本冲突'), clarify: count('待澄清'), rejected: count('不能导入') };
  draft.step = 4; project.lastActivity = state.demoClock; persist();
}

function caseTabContent(project, testCase, version) {
  const edit = state.ui.editingCase?.caseId === testCase.id ? state.ui.editingCase : null;
  if (edit) return `<section class="card"><div class="card-header"><div><h2>编辑用例v${testCase.currentVersion + 1}（演示）</h2><p>保存会形成新版本，旧任务快照和旧脚本绑定不变。</p></div><span class="demo-label">演示修改</span></div><div class="card-body"><div class="form-grid"><label><span>前置条件</span><textarea id="edit-preconditions">${esc(edit.draft.preconditions)}</textarea></label><label><span>测试数据</span><textarea id="edit-test-data">${esc(edit.draft.testData)}</textarea></label></div><h3>步骤与逐步预期</h3><div id="edit-steps">${edit.draft.steps.map((step,index) => `<div class="edit-step"><span class="step-number">${index + 1}</span><label><span>动作</span><textarea data-edit-action="${index}">${esc(step.action)}</textarea></label><label><span>预期</span><textarea data-edit-expected="${index}">${esc(step.expected)}</textarea></label><button class="button icon-only" data-remove-step="${index}" aria-label="删除第${index + 1}步">${icons.close}</button></div>`).join('')}</div><div id="edit-error" class="inline-error" hidden></div><div class="card-actions"><button class="button" id="add-step">新增完整步骤</button><span></span><button class="button" id="cancel-edit">取消</button><button class="button primary" id="save-version">保存为v${testCase.currentVersion + 1}</button></div></div></section>`;
  return `<section class="card"><div class="card-header"><div><h2>用例内容</h2><p>当前展示用例v${version.version}的完整正文；动作和预期以同一个步骤对象保存。</p></div><button class="button" id="edit-case">编辑当前版本（演示）</button></div><div class="card-body"><dl class="definition-grid"><div><dt>模块</dt><dd>${esc(testCase.module)}</dd></div><div><dt>来源</dt><dd>${esc(testCase.sourceType)} · ${esc(testCase.sourceBatch)}</dd></div><div><dt>前置条件</dt><dd>${esc(version.preconditions)}</dd></div><div><dt>测试数据</dt><dd class="preserve-lines">${esc(version.testData)}</dd></div></dl><h3>步骤与逐步预期</h3><div class="step-pairs">${version.steps.map((step) => `<div class="step-pair"><span class="step-number">${step.order}</span><div><small>操作</small><p>${esc(step.action)}</p></div><div><small>预期结果</small><p>${esc(step.expected || '缺少预期，不能创建可执行任务')}</p></div></div>`).join('')}</div></div></section>`;
}

function renderCase(project, testCase, params) {
  const requestedVersion = Number(params.get('version')) || testCase.currentVersion;
  const version = testCase.versions.find((item) => item.version === requestedVersion);
  if (!version) { app.innerHTML = notFound('指定用例版本不存在。', project); return; }
  const tab = params.get('tab') || 'content';
  const builds = state.builds.filter((item) => item.projectId === project.id && item.caseId === testCase.id);
  const runs = state.runs.filter((item) => item.projectId === project.id && item.caseId === testCase.id);
  const scripts = testCase.scripts || [];
  const canCreate = testCase.contentStatus === '内容已确认' && version.steps.every((step) => step.action && step.expected);
  const applicable = scripts.find((item) => item.caseVersion === requestedVersion && item.status === '已首审且适用');
  const tabs = [['content','用例内容'],['builds','建例任务'],['scripts','脚本版本'],['runs','执行历史'],['versions','版本与来源']];
  let panel = '';
  if (tab === 'content') panel = caseTabContent(project, testCase, version);
  if (tab === 'builds') panel = `<section class="card"><div class="card-header"><h2>关联建例任务</h2><button class="button primary" id="create-build" ${canCreate ? '' : 'disabled'}>创建建例任务（演示）</button></div><div class="card-body"><div class="relation-list">${builds.map((item) => `<div class="relation-item"><div><strong>${esc(item.id)}</strong><p>冻结${testCase.externalId}@v${item.caseVersion} · ${esc(item.createdAt)}</p></div>${badge(item.status)}<button class="button small" data-route="#/projects/${project.id}/builds/${item.id}">查看任务</button></div>`).join('') || '<div class="empty-inline">尚无建例任务。创建只冻结输入，不会启动模型。</div>'}</div></div></section>`;
  if (tab === 'scripts') panel = `<section class="card"><div class="card-header"><h2>自动化脚本版本</h2><span>用例当前为v${testCase.currentVersion}</span></div><div class="card-body">${scripts.length ? scripts.map((item) => `<div class="script-row"><div><strong>脚本v${item.version}</strong><p>适用用例v${item.caseVersion} · ${esc(item.reviewScope)}</p></div>${badge(item.status)}<span>最近：${esc(item.lastRun)}</span>${item.caseVersion === requestedVersion && item.status === '已首审且适用' ? '<button class="button primary" data-demo-run>演示运行</button>' : '<button class="button" disabled title="脚本不会自动继承到新用例版本">不可用于当前版本</button>'}<details><summary>技术详情</summary><p class="mono">SHA-256 ${esc(item.hash)}</p></details></div>`).join('') : '<div class="empty-inline">尚无脚本版本。用例内容已确认也不等于脚本已批准。</div>'}</div></section>`;
  if (tab === 'runs') panel = `<section class="card"><div class="card-header"><h2>执行历史</h2><span>${runs.length}条记录</span></div><div class="card-body"><div class="relation-list">${runs.map((item) => `<div class="relation-item"><div><strong>${esc(item.mode)} · ${esc(item.createdAt)}</strong><p>用例v${item.caseVersion} · 脚本v${item.scriptVersion}</p></div>${badge(item.status)}<button class="button small" data-route="#/projects/${project.id}/runs/${item.id}">查看结果</button></div>`).join('') || '<div class="empty-inline">没有运行记录。</div>'}</div></div></section>`;
  if (tab === 'versions') panel = `<section class="card"><div class="card-header"><h2>版本与来源</h2><span>当前v${testCase.currentVersion}</span></div><div class="card-body"><div class="relation-list">${[...testCase.versions].reverse().map((item) => `<div class="relation-item"><div><strong>用例v${item.version}${item.version === testCase.currentVersion ? ' · 当前' : ''}</strong><p>${esc(item.createdAt)} · ${esc(testCase.sourceType)} · ${esc(testCase.sourceBatch)}</p></div><span class="mono">${esc(item.contentHash)}</span><button class="button small" data-route="#/projects/${project.id}/cases/${testCase.id}?version=${item.version}&tab=content">查看</button></div>`).join('')}</div></div></section>`;
  const actions = `<button class="button" data-route="#/projects/${project.id}/cases">${icons.back}返回用例库</button>${canCreate ? '<button class="button primary" id="create-build-top">创建建例任务（演示）</button>' : '<button class="button" disabled title="内容待确认或存在缺少预期的步骤">暂不能创建任务</button>'}`;
  const content = `${pageHeading(`${testCase.externalId} · 用例v${requestedVersion}`, testCase.title, `${testCase.module} · ${testCase.sourceType} · 当前版本v${testCase.currentVersion}`, actions)}<div class="status-strip"><div><span>内容状态</span>${badge(testCase.contentStatus)}</div><div><span>自动化状态</span>${badge(testCase.automationStatus)}</div><div><span>最近执行</span>${badge(testCase.recentStatus)}</div><div><span>脚本适用性</span>${badge(applicable ? '已首审且适用当前版本' : scripts.length ? '版本不匹配' : '未登记')}</div></div><nav class="tabs" aria-label="用例详情页签">${tabs.map(([id,label]) => `<button class="${tab === id ? 'active' : ''}" data-route="#/projects/${project.id}/cases/${testCase.id}?version=${requestedVersion}&tab=${id}">${label}</button>`).join('')}</nav>${panel}`;
  app.innerHTML = shell(content, 'cases', project, `${testCase.externalId} · v${requestedVersion}`);
}

function renderBuilds(project) {
  const builds = projectBuilds(project.id);
  const content = `${pageHeading('当前项目', '建例任务', '创建、生成、技术验证和人工核对分别显示。')}<div class="table-wrap"><table><thead><tr><th>任务</th><th>来源用例</th><th>候选生成</th><th>技术验证</th><th>人工核对</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${builds.map((item) => { const testCase = getCase(project.id,item.caseId); return `<tr><td><strong>${esc(item.id)}</strong></td><td>${esc(testCase?.externalId || '来源缺失')}@v${item.caseVersion}</td><td>${badge(item.generation)}</td><td>${badge(item.normal === '通过' ? '正常试跑通过' : item.normal)}</td><td>${badge(item.humanReview)}</td><td>${esc(item.createdAt)}</td><td><button class="button small" data-route="#/projects/${project.id}/builds/${item.id}">查看任务</button></td></tr>`; }).join('') || '<tr><td colspan="7"><div class="empty-inline">当前项目没有建例任务。</div></td></tr>'}</tbody></table></div>`;
  app.innerHTML = shell(content, 'builds', project, '建例任务');
}

function renderBuild(project, build) {
  const testCase = getCase(project.id, build.caseId);
  if (!testCase) { app.innerHTML = notFound('任务的来源用例不存在。', project); return; }
  const phases = [
    ['任务创建', { state: 'done', label: '已完成' }],
    ['候选生成', generationPhase(build.generation)],
    ['技术验证', technicalValidationPhase(build)],
    ['人工核对', humanReviewPhase(build.humanReview)],
    ['脚本登记', registrationPhase(build.registration)],
  ];
  const snapshot = build.inputSnapshot;
  const snapshotBody = snapshot
    ? `<dl class="definition-grid"><div><dt>来源</dt><dd>${esc(snapshot.externalId)}@v${snapshot.caseVersion}</dd></div><div><dt>内容哈希</dt><dd class="mono">${esc(snapshot.contentHash)}</dd></div><div><dt>前置条件</dt><dd>${esc(snapshot.preconditions)}</dd></div><div><dt>测试数据</dt><dd class="preserve-lines">${esc(snapshot.testData)}</dd></div><div><dt>候选</dt><dd>${esc(build.candidate)}</dd></div><div><dt>候选哈希</dt><dd class="mono">${esc(build.candidateHash)}</dd></div></dl><div class="step-pairs compact">${snapshot.steps.map((step) => `<div class="step-pair ${build.businessReview.includes('范围') && step.order === 3 ? 'attention' : ''}"><span class="step-number">${step.order}</span><div><small>操作</small><p>${esc(step.action)}</p></div><div><small>预期结果</small><p>${esc(step.expected || '缺失')}</p></div></div>`).join('')}</div>`
    : '<div class="callout danger"><strong>冻结快照缺失</strong><p>任务输入不可追溯，不能用当前用例正文代替。</p></div>';
  const content = `${pageHeading(`${snapshot?.externalId || testCase.externalId}@v${build.caseVersion}`, '建例任务详情', `${build.createdAt}创建 · 第${build.attempts}次尝试`, `<button class="button" data-route="#/projects/${project.id}/builds">${icons.back}返回任务列表</button>`)}<section class="task-hero"><div><span>当前结论</span><h2>${esc(build.status)}</h2><p>${esc(build.currentIssue)}</p></div>${badge(build.status)}</section><ol class="phase-bar">${phases.map(([label,status]) => `<li class="${status.state}"><span>${status.state === 'done' ? '✓' : status.state === 'error' ? '!' : status.state === 'unknown' ? '?' : ''}</span><div><strong>${label}</strong><small>${status.label}</small></div></li>`).join('')}</ol><div class="task-grid"><section class="card"><div class="card-header"><h2>分层结果</h2><span class="demo-label">演示任务</span></div><div class="card-body result-matrix">${[['候选生成',build.generation],['正常试跑',build.normal],['反例验证',build.counterexample],['步骤映射',build.mapping],['业务核对',build.businessReview],['人工首审',build.humanReview]].map(([label,value]) => `<div><span>${label}</span>${badge(value)}</div>`).join('')}</div></section><section class="card"><div class="card-header"><h2>当前待处理项</h2><span>处理主体：测试负责人</span></div><div class="card-body"><div class="callout warning"><strong>${esc(build.status)}</strong><p>${esc(build.currentIssue)}</p></div>${build.id !== 'demo-build-scope' ? `<button class="button" data-route="#/projects/${project.id}/builds/demo-build-scope">查看预置“要求待确认”任务</button>` : ''}</div></section></div><section class="card"><div class="card-header"><h2>任务冻结输入快照</h2><button class="button" data-route="#/projects/${project.id}/cases/${testCase.id}?version=${build.caseVersion}&tab=builds">返回来源用例</button></div><div class="card-body">${snapshotBody}<details class="technical"><summary>技术详情：输入、模型记录、哈希与原始错误</summary><pre>{\n  "task_id": "${esc(build.id)}",\n  "source": "${esc(snapshot ? `${snapshot.externalId}@v${snapshot.caseVersion}` : '冻结快照缺失')}",\n  "usage": "未提供用量信息",\n  "candidate_sha256": "${esc(build.candidateHash)}"\n}</pre></details></div></section>`;
  app.innerHTML = shell(content, 'builds', project, '建例任务详情');
}

function renderRuns(project) {
  const runs = projectRuns(project.id);
  const content = `${pageHeading('当前项目', '执行记录', '正常回归、受控反例和异常记录互不覆盖。')}<div class="table-wrap"><table><thead><tr><th>运行记录</th><th>用例与版本</th><th>脚本版本</th><th>类型</th><th>测试结果</th><th>证据</th><th>时间</th><th>操作</th></tr></thead><tbody>${runs.map((item) => { const testCase = getCase(project.id,item.caseId); return `<tr><td class="mono">${esc(item.id)}</td><td>${esc(testCase?.externalId || '来源缺失')}@v${item.caseVersion}</td><td>v${esc(item.scriptVersion)}</td><td>${esc(item.mode)}</td><td>${badge(item.status)}</td><td>${badge(item.evidence)}</td><td>${esc(item.createdAt)}</td><td><button class="button small" data-route="#/projects/${project.id}/runs/${item.id}">查看结果</button></td></tr>`; }).join('')}</tbody></table></div>`;
  app.innerHTML = shell(content, 'runs', project, '执行记录');
}

function stepDetail(step) { return `<div class="check-detail"><div><span>检查说明</span><strong>${esc(step.label || step.action)}</strong></div><div class="expect-actual"><section><small>预期</small><p>${esc(step.expected)}</p></section><section class="${step.status === '断言不符' ? 'failed' : ''}"><small>实际</small><p>${esc(step.actual)}</p>${step.error ? `<code>${esc(step.error)}</code>` : ''}</section></div></div>`; }

function renderRun(project, run) {
  const testCase = getCase(project.id, run.caseId);
  if (!testCase) { app.innerHTML = notFound('运行记录的来源用例不存在。', project); return; }
  const selectedOrder = state.ui.selectedRunStep[run.id] || run.steps[0]?.order;
  const selected = run.steps.find((step) => step.order === selectedOrder) || run.steps[0];
  const otherRuns = projectRuns(project.id).filter((item) => item.caseId === run.caseId);
  const content = `${pageHeading(`${testCase.externalId}@v${run.caseVersion} · 脚本v${run.scriptVersion}`, '执行结果详情', `${run.mode} · ${run.createdAt} · ${run.duration}`, `<button class="button" data-route="#/projects/${project.id}/runs">${icons.back}返回执行记录</button>`)}<section class="run-summary"><div><span>本次结果</span><h2>${esc(run.status)}</h2><p>${run.status === '断言不符' ? '保留原始预期与实际；问题归因待分析。' : run.status === '通过' ? '本次演示检查完整通过；不等于产品发布验收。' : '运行或证据不完整，不能标记整体通过。'}</p></div><dl><div><dt>进程</dt><dd>${esc(run.execution)}</dd></div><div><dt>报告</dt><dd>${esc(run.report)}</dd></div><div><dt>证据</dt><dd>${esc(run.evidence)}</dd></div></dl></section>${otherRuns.length > 1 ? `<div class="run-switch"><span>同一用例的记录：</span>${otherRuns.map((item) => `<button class="${item.id === run.id ? 'active' : ''}" data-route="#/projects/${project.id}/runs/${item.id}">${esc(item.mode)} · ${esc(item.status)}</button>`).join('')}</div>` : ''}<div class="result-layout" data-testid="run-result-detail"><aside class="step-rail"><h2>步骤结果</h2>${run.steps.map((step) => `<button class="step-button ${step.order === selected.order ? 'active' : ''}" data-result-step="${step.order}"><span>${step.order}</span><div><strong>${esc(step.label || step.action)}</strong>${badge(step.status)}</div></button>`).join('')}</aside><section class="result-main"><div id="step-detail">${stepDetail(selected)}</div><div class="media-panel"><article><header><strong>页面截图</strong><span>演示媒体，非真实测试证据</span></header>${run.screenshot ? `<button class="image-button" data-open-image><img src="${run.screenshot}" width="1280" height="720" alt="${esc(run.mode)}的合成演示截图"></button>` : '<div class="media-missing"><strong>截图缺失</strong><span>没有用其他运行的截图兜底。</span></div>'}</article><article><header><strong>本次完整执行录像</strong><span>无步骤时间点关联</span></header>${run.video ? `<video controls preload="metadata" data-testid="result-video" src="${run.video}">浏览器不支持video。</video>` : '<div class="media-missing"><strong>录像缺失</strong><span>本次运行未登记录像文件。</span></div>'}</article></div><div class="trace-row"><div><strong>Trace</strong><p>${run.trace ? '可通过登记ID下载并在本地Trace Viewer打开。' : '原型未提供Trace文件，不下载伪造ZIP。'}</p></div><button class="button" disabled>没有可用Trace</button></div><details class="technical"><summary>技术详情：运行信息、脚本哈希和原始记录</summary><pre>{\n  "run_id": "${esc(run.id)}",\n  "project_id": "${esc(project.id)}",\n  "case": "${esc(testCase.id)}@v${run.caseVersion}",\n  "script_version": "${esc(run.scriptVersion)}",\n  "usage": "未记录"\n}</pre></details></section></div>`;
  app.innerHTML = shell(content, 'runs', project, '执行结果详情');
}

function renderSettings(project) {
  const content = `${pageHeading('项目工作区', '项目设置', '本轮仅演示项目名称和说明，不包含删除、成员或环境管理。')}<section class="card narrow"><div class="card-body"><label class="field"><span>项目名称</span><input value="${esc(project.name)}" readonly></label><label class="field"><span>项目说明</span><textarea readonly>${esc(project.description)}</textarea></label><p class="helper">只读演示；正式写接口不在本轮范围。</p></div></section>`;
  app.innerHTML = shell(content, 'settings', project, '项目设置');
}

function render() {
  const r = route();
  const project = r.projectId ? getProject(r.projectId) : null;
  if (r.projectId && !project) { app.innerHTML = notFound('项目不存在或不属于当前演示数据。'); bindCommon(); return; }
  if (r.page === 'projects') renderProjects();
  else if (r.page === 'cases') renderCases(project);
  else if (r.page === 'import') renderImport(project);
  else if (r.page === 'case') { const testCase = getCase(project.id, r.id); if (testCase) renderCase(project,testCase,r.params); else app.innerHTML = notFound('用例不存在或不属于当前项目。', project); }
  else if (r.page === 'builds') renderBuilds(project);
  else if (r.page === 'build') { const build = getBuild(project.id,r.id); if (build) renderBuild(project,build); else app.innerHTML = notFound('任务不存在或不属于当前项目。', project); }
  else if (r.page === 'runs') renderRuns(project);
  else if (r.page === 'run') { const run = getRun(project.id,r.id); if (run) renderRun(project,run); else app.innerHTML = notFound('运行不存在或不属于当前项目。', project); }
  else if (r.page === 'settings') renderSettings(project);
  bindCommon();
}

function openModal({ title, description = '', body, footer = '', small = false }, trigger = document.activeElement) {
  modalTrigger = trigger;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal ${small ? 'small' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><h2 id="modal-title">${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div><button class="button icon-only" data-close-modal aria-label="关闭弹窗">${icons.close}</button></header><div class="modal-body">${body}</div><footer class="modal-footer">${footer}</footer></section></div>`;
  modalRoot.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', closeModal));
  modalRoot.querySelector('[data-close-modal]').focus();
  modalRoot.querySelector('[data-modal-backdrop]').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeModal(); });
  modalRoot.addEventListener('keydown', trapModalFocus);
}

function trapModalFocus(event) {
  if (event.key === 'Escape') return closeModal();
  if (event.key !== 'Tab') return;
  const focusable = [...modalRoot.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function closeModal() { modalRoot.removeEventListener('keydown', trapModalFocus); modalRoot.innerHTML = ''; modalTrigger?.focus(); modalTrigger = null; }

function openNewProject(trigger) {
  openModal({ title: '新建项目', description: '创建后进入空项目，可随时多次导入。', small: true, body: `<label class="field"><span>项目名称 *</span><input id="new-project-name" maxlength="60" aria-describedby="project-name-error"></label><div id="project-name-error" class="inline-error" hidden></div><label class="field"><span>项目说明</span><textarea id="new-project-description"></textarea></label><p class="boundary-note">演示操作，只写入当前浏览器会话。</p>`, footer: `<button class="button" data-close-modal>取消</button><button class="button primary" id="confirm-new-project">创建项目</button>` }, trigger);
  const name = modalRoot.querySelector('#new-project-name'); name.focus();
  modalRoot.querySelector('#confirm-new-project').addEventListener('click', () => { const value = name.value.trim(); if (!value) { const error = modalRoot.querySelector('#project-name-error'); error.hidden = false; error.textContent = '请输入项目名称。'; name.setAttribute('aria-invalid','true'); name.focus(); return; } const id = `demo-project-created-${Date.now()}`; state.projects.push({ id, name: value, description: modalRoot.querySelector('#new-project-description').value.trim() || '新建演示项目', lastActivity: '尚无活动' }); persist(); closeModal(); navigate(`#/projects/${id}/cases`, { force: true }); showToast('演示项目已创建。现在可以载入Excel场景。'); });
}

function openExport(project, ids, trigger) {
  const selected = projectCases(project.id).filter((item) => ids.includes(item.id));
  openModal({ title: '导出平台用例包', description: '导出仅包含演示用例内容，不含脚本、审批、媒体或绝对路径。', small: true, body: `<p>将导出<strong>${selected.length}条</strong>用例，格式为<code>workbench/case-package-v1</code>。</p><p class="boundary-note">文件内容标记demo_only=true。</p>`, footer: `<button class="button" data-close-modal>取消</button><button class="button primary" id="confirm-export" ${selected.length ? '' : 'disabled'}>${icons.download}下载演示JSON</button>` }, trigger);
  modalRoot.querySelector('#confirm-export')?.addEventListener('click', () => { const form = document.createElement('form'); form.method = 'post'; form.action = '/demo-download'; form.hidden = true; const payload = document.createElement('input'); payload.name = 'payload'; payload.value = JSON.stringify(makeCasePackage(project,selected),null,2); const filename = document.createElement('input'); filename.name = 'filename'; filename.value = `${project.id}-demo-cases.json`; form.append(payload, filename); document.body.append(form); form.submit(); form.remove(); closeModal(); showToast(`已生成${selected.length}条演示用例的JSON包。`); });
}

function openCreateBuild(project, testCase, version, trigger) {
  openModal({ title: '创建建例任务（演示）', description: '创建只冻结输入，不会启动模型。', body: `<dl class="definition-grid"><div><dt>来源项目</dt><dd>${esc(project.name)}</dd></div><div><dt>来源用例</dt><dd>${esc(testCase.externalId)}@v${version.version}</dd></div><div><dt>内容哈希</dt><dd class="mono">${esc(version.contentHash)}</dd></div><div><dt>允许环境</dt><dd>无登录合成环境 · demo-env-synthetic</dd></div></dl><h3>将冻结的步骤</h3><div class="step-pairs compact">${version.steps.map((step) => `<div class="step-pair"><span class="step-number">${step.order}</span><div><small>动作</small><p>${esc(step.action)}</p></div><div><small>预期</small><p>${esc(step.expected)}</p></div></div>`).join('')}</div>`, footer: `<button class="button" data-close-modal>取消</button><button class="button primary" id="confirm-create-build">创建任务，尚不启动</button>` }, trigger);
  modalRoot.querySelector('#confirm-create-build').addEventListener('click', () => { const existing = state.builds.find((item) => item.projectId === project.id && item.caseId === testCase.id && item.caseVersion === version.version && item.status === '任务已创建，尚未启动'); if (existing) { closeModal(); navigate(`#/projects/${project.id}/builds/${existing.id}`, { force: true }); return; } const id = `demo-build-created-${Date.now()}`; const inputSnapshot = freezeCaseVersion(testCase, version, 'demo-env-synthetic'); state.builds.unshift({ id, projectId: project.id, caseId: testCase.id, caseVersion: version.version, inputSnapshot, createdAt: state.demoClock, status: '任务已创建，尚未启动', generation: '未开始', normal: '未运行', counterexample: '未运行', mapping: '未运行', businessReview: '未进行', humanReview: '未进行', registration: '未登记', candidate: '尚未生成', candidateHash: '未记录', currentIssue: '输入快照已冻结；需要用户另行明确启动生成。本原型不会调用模型。', attempts: 0 }); persist(); closeModal(); navigate(`#/projects/${project.id}/builds/${id}`, { force: true }); showToast('演示任务已创建，Harness尚未启动。'); });
}

function openDemoRun(project, testCase, trigger) {
  const asset = testCase.scripts.find((item) => item.caseVersion === testCase.currentVersion && item.status === '已首审且适用');
  openModal({ title: '运行已首审脚本（演示）', description: '不会启动真实Playwright，只创建一条清楚标注的演示运行。', small: true, body: `<dl class="definition-grid one"><div><dt>用例</dt><dd>${esc(testCase.externalId)}@v${testCase.currentVersion}</dd></div><div><dt>脚本</dt><dd>v${asset.version} · ${esc(asset.reviewScope)}</dd></div><div><dt>环境</dt><dd>demo-env-synthetic</dd></div></dl>`, footer: `<button class="button" data-close-modal>取消</button><button class="button primary" id="confirm-demo-run">明确触发演示运行</button>` }, trigger);
  modalRoot.querySelector('#confirm-demo-run').addEventListener('click', () => { const source = state.runs.find((item) => item.id === 'demo-run-pass'); const id = `demo-run-triggered-${Date.now()}`; state.runs.unshift({ ...structuredClone(source), id, createdAt: state.demoClock, mode: '手动演示回归' }); persist(); closeModal(); navigate(`#/projects/${project.id}/runs/${id}`, { force: true }); showToast('演示运行已生成；没有启动真实业务测试。'); });
}

function bindCommon() {
  document.querySelectorAll('[data-route]').forEach((node) => node.addEventListener('click', () => navigate(node.dataset.route)));
  document.querySelector('#reset-demo')?.addEventListener('click', () => { if (!window.confirm('重置会清除当前浏览器会话中的全部演示修改，是否继续？')) return; sessionStorage.removeItem(DEMO_STORAGE_KEY); state = createDemoState(); navigate('#/projects', { force: true }); showToast('演示数据已重置。'); });
  document.querySelector('#new-project')?.addEventListener('click', (event) => openNewProject(event.currentTarget));
  document.querySelector('#project-search')?.addEventListener('input', (event) => { state.ui.projectSearch = event.target.value; persist(); render(); document.querySelector('#project-search')?.focus(); });
  document.querySelector('#clear-project-search')?.addEventListener('click', () => { state.ui.projectSearch = ''; persist(); render(); });
  const r = route(); const project = r.projectId ? getProject(r.projectId) : null;
  if (r.page === 'cases' && project) bindCases(project);
  if (r.page === 'import' && project) bindImport(project);
  if (r.page === 'case' && project) { const testCase = getCase(project.id,r.id); if (testCase) bindCase(project,testCase,r.params); }
  if (r.page === 'run' && project) { const run = getRun(project.id,r.id); if (run) bindRun(run); }
  modalRoot.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', closeModal));
}

function bindCases(project) {
  const f = filterFor(project.id);
  const updateFilter = (key,value) => { f[key] = value; state.ui.casePage[project.id] = 1; persist(); render(); };
  document.querySelector('#case-search')?.addEventListener('input', (event) => { updateFilter('search',event.target.value); document.querySelector('#case-search')?.focus(); });
  document.querySelector('#module-filter')?.addEventListener('change', (event) => updateFilter('module',event.target.value));
  document.querySelector('#content-filter')?.addEventListener('change', (event) => updateFilter('content',event.target.value));
  document.querySelector('#automation-filter')?.addEventListener('change', (event) => updateFilter('automation',event.target.value));
  document.querySelectorAll('[data-page]').forEach((node) => node.addEventListener('click', () => { state.ui.casePage[project.id] = Number(node.dataset.page); persist(); render(); }));
  document.querySelectorAll('[data-select-case]').forEach((node) => node.addEventListener('change', () => { const selected = selectedFor(project.id); const id = node.dataset.selectCase; state.ui.selectedCaseIds[project.id] = node.checked ? [...new Set([...selected,id])] : selected.filter((item) => item !== id); persist(); render(); }));
  document.querySelector('#select-visible')?.addEventListener('change', (event) => { const currentPage = state.ui.casePage[project.id] || 1; const ids = filteredCases(project.id).slice((currentPage - 1) * 25,currentPage * 25).map((item) => item.id); const selected = selectedFor(project.id); state.ui.selectedCaseIds[project.id] = event.target.checked ? [...new Set([...selected,...ids])] : selected.filter((id) => !ids.includes(id)); persist(); render(); });
  document.querySelector('#clear-selection')?.addEventListener('click', () => { state.ui.selectedCaseIds[project.id] = []; persist(); render(); });
  document.querySelector('#export-selected')?.addEventListener('click', (event) => openExport(project,selectedFor(project.id),event.currentTarget));
  document.querySelector('#export-all')?.addEventListener('click', (event) => openExport(project,projectCases(project.id).map((item) => item.id),event.currentTarget));
}

function bindImport(project) {
  const draft = getImportDraft(project.id);
  document.querySelectorAll('[data-import-source]').forEach((node) => node.addEventListener('click', () => { draft.source = node.dataset.importSource; persist(); render(); }));
  document.querySelector('#load-import-demo')?.addEventListener('click', () => { draft.step = 2; persist(); render(); });
  document.querySelector('#generate-preview')?.addEventListener('click', () => { draft.rows = importRows(project.id,draft.source); draft.step = 3; persist(); render(); });
  document.querySelector('#import-back')?.addEventListener('click', () => { draft.step -= 1; persist(); render(); });
  document.querySelectorAll('[data-row-decision]').forEach((node) => node.addEventListener('change', () => { const row = draft.rows.find((item) => item.externalId === node.dataset.rowDecision); row.decision = node.value; persist(); render(); }));
  document.querySelector('#confirm-import')?.addEventListener('click', () => { addImportedCases(project,draft); render(); });
  document.querySelector('#continue-json')?.addEventListener('click', () => { state.ui.importDrafts[project.id] = { source: 'json', step: 1, rows: [], completed: null }; persist(); render(); });
  document.querySelector('#repeat-json')?.addEventListener('click', () => { state.ui.importDrafts[project.id] = { source: 'json', step: 2, rows: [], completed: null }; persist(); render(); });
}

function bindCase(project,testCase,params) {
  const requestedVersion = Number(params.get('version')) || testCase.currentVersion;
  const version = testCase.versions.find((item) => item.version === requestedVersion);
  document.querySelector('#edit-case')?.addEventListener('click', () => { state.ui.editingCase = { projectId: project.id, caseId: testCase.id, draft: structuredClone({ preconditions: version.preconditions, testData: version.testData, steps: version.steps }) }; render(); });
  document.querySelector('#cancel-edit')?.addEventListener('click', () => { if (window.confirm('取消后将丢弃未保存修改，是否继续？')) { state.ui.editingCase = null; render(); } });
  document.querySelector('#add-step')?.addEventListener('click', () => { syncEditDraft(); state.ui.editingCase.draft.steps.push({ order: state.ui.editingCase.draft.steps.length + 1, action: '', expected: '' }); render(); });
  document.querySelectorAll('[data-remove-step]').forEach((node) => node.addEventListener('click', () => { syncEditDraft(); state.ui.editingCase.draft.steps.splice(Number(node.dataset.removeStep),1); state.ui.editingCase.draft.steps.forEach((step,index) => step.order = index + 1); render(); }));
  document.querySelector('#save-version')?.addEventListener('click', () => { syncEditDraft(); const draft = state.ui.editingCase.draft; const missing = draft.steps.findIndex((step) => !step.action.trim() || !step.expected.trim()); if (missing >= 0) { const error = document.querySelector('#edit-error'); error.hidden = false; error.textContent = `第${missing + 1}步缺少动作或预期，不能保存为已确认版本。`; return; } const saved = appendCaseVersion(testCase, draft, state.demoClock); if (testCase.scripts?.length) testCase.automationStatus = '脚本版本不匹配'; state.ui.editingCase = null; persist(); navigate(`#/projects/${project.id}/cases/${testCase.id}?version=${saved.version}&tab=versions`, { force: true }); showToast(`已形成演示用例v${saved.version}；旧任务仍绑定原版本。`); });
  const create = (trigger) => openCreateBuild(project,testCase,version,trigger);
  document.querySelector('#create-build')?.addEventListener('click', (event) => create(event.currentTarget));
  document.querySelector('#create-build-top')?.addEventListener('click', (event) => create(event.currentTarget));
  document.querySelector('[data-demo-run]')?.addEventListener('click', (event) => openDemoRun(project,testCase,event.currentTarget));
}

function syncEditDraft() {
  const edit = state.ui.editingCase; if (!edit) return;
  edit.draft.preconditions = document.querySelector('#edit-preconditions')?.value ?? edit.draft.preconditions;
  edit.draft.testData = document.querySelector('#edit-test-data')?.value ?? edit.draft.testData;
  edit.draft.steps = edit.draft.steps.map((step,index) => ({ order: index + 1, action: document.querySelector(`[data-edit-action="${index}"]`)?.value ?? step.action, expected: document.querySelector(`[data-edit-expected="${index}"]`)?.value ?? step.expected }));
}

function bindRun(run) {
  document.querySelectorAll('[data-result-step]').forEach((node) => node.addEventListener('click', () => { const order = Number(node.dataset.resultStep); state.ui.selectedRunStep[run.id] = order; persist(); document.querySelectorAll('[data-result-step]').forEach((button) => button.classList.toggle('active',button === node)); document.querySelector('#step-detail').innerHTML = stepDetail(run.steps.find((step) => step.order === order)); }));
  document.querySelector('[data-open-image]')?.addEventListener('click', (event) => { const img = event.currentTarget.querySelector('img'); openModal({ title: '演示截图原图', description: '合成媒体，非真实测试证据。', body: `<img class="full-image" src="${img.getAttribute('src')}" alt="${esc(img.alt)}">`, footer: '<button class="button primary" data-close-modal>关闭</button>' }, event.currentTarget); modalRoot.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click',closeModal)); });
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
if (!location.hash) history.replaceState(null,'','#/projects');
render();
