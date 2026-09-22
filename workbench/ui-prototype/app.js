const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toast = document.querySelector('#toast');

const state = {
  projects: [
    { id: 'project-alpha', name: '巡检台账回归', description: '无登录合成场景 · 查询、排序与证据核对', cases: 12, automated: 5, attention: 3, lastRun: '今天 10:42' },
    { id: 'project-bravo', name: '设备告警看板', description: '演示项目 · 仅用于交互原型状态覆盖', cases: 8, automated: 2, attention: 1, lastRun: '昨天 17:26' },
    { id: 'project-charlie', name: '导入格式验证', description: 'Excel 与平台用例包往返演示', cases: 24, automated: 0, attention: 6, lastRun: '暂无运行' },
  ],
  selectedProject: 'project-alpha',
  selectedRun: 'run-240922-failed',
  caseSearch: '',
  caseStatus: 'all',
  import: { step: 1, source: 'excel' },
};

const cases = [
  { id: 'case-q1', external: 'HOLD-Q1', title: '工作区一列表查询核对', module: '列表查询', version: 1, content: '已确认', automation: '待人工核对', recent: '断言不符', tone: 'danger', task: 'build-0922-0230', issue: '验收范围待确认', selected: true },
  { id: 'case-sort', external: 'SORT-002', title: '创建时间降序与整表顺序核对', module: '列表排序', version: 3, content: '已确认', automation: '已首审脚本', recent: '通过', tone: 'success' },
  { id: 'case-filter', external: 'QUERY-007', title: '站点与任务类型联合筛选', module: '列表查询', version: 2, content: '已确认', automation: '生成中', recent: '尚无结果', tone: 'info' },
  { id: 'case-export', external: 'EXPORT-003', title: '选中用例导出平台用例包', module: '用例管理', version: 1, content: '待确认', automation: '未建例', recent: '尚无结果', tone: 'warning' },
  { id: 'case-import', external: 'IMPORT-011', title: '同来源不同内容导入冲突', module: '用例管理', version: 2, content: '已确认', automation: '未建例', recent: '尚无结果', tone: 'neutral' },
  { id: 'case-video', external: 'MEDIA-004', title: '失败运行截图与录像回读', module: '结果证据', version: 1, content: '已确认', automation: '候选验证失败', recent: '运行中断', tone: 'warning' },
];

const builds = [
  { id: 'build-0922-0230', caseId: 'case-q1', case: 'HOLD-Q1', title: '工作区一列表查询核对', version: 1, task: '已完成', generation: '候选已生成', validation: '技术复验通过', human: '等待人工核对', candidate: 'v1 · CA3819EF…B6914', updated: '今天 10:31', tone: 'primary' },
  { id: 'build-0922-1044', caseId: 'case-filter', case: 'QUERY-007', title: '站点与任务类型联合筛选', version: 2, task: '生成中', generation: '正在观察页面', validation: '尚未开始', human: '尚未就绪', candidate: '尚未生成', updated: '今天 10:44', tone: 'info' },
  { id: 'build-0921-1806', caseId: 'case-video', case: 'MEDIA-004', title: '失败运行截图与录像回读', version: 1, task: '已中断', generation: '进程中断', validation: '未运行', human: '尚未就绪', candidate: '文件不完整', updated: '昨天 18:12', tone: 'warning' },
];

const runs = [
  { id: 'run-240922-passed', case: 'SORT-002', title: '创建时间降序与整表顺序核对', mode: '正常回归', execution: '进程已结束', report: '报告完整', test: '通过', evidence: '证据齐全', complete: '整体通过', time: '今天 10:42', duration: '18.4 秒', tone: 'success', screenshot: '/assets/result-normal.svg', video: '/assets/demo-normal.webm' },
  { id: 'run-240922-failed', case: 'HOLD-Q1', title: '工作区一列表查询核对', mode: '受控反例验收', execution: '进程已结束', report: '报告完整', test: '断言不符', evidence: '证据齐全', complete: '整体未通过', time: '今天 10:31', duration: '12.7 秒', tone: 'danger', screenshot: '/assets/result-failed.svg', video: '/assets/demo-failed.webm' },
  { id: 'run-240921-interrupted', case: 'MEDIA-004', title: '失败运行截图与录像回读', mode: '正常回归', execution: '运行中断', report: '报告缺失', test: '未完成', evidence: '证据不完整', complete: '整体未通过', time: '昨天 18:12', duration: '6.1 秒', tone: 'warning', screenshot: '/assets/result-failed.svg', video: '/assets/demo-failed.webm' },
  { id: 'run-240921-pending', case: 'QUERY-007', title: '站点与任务类型联合筛选', mode: '正常回归', execution: '等待脚本', report: '尚无报告', test: '未运行', evidence: '尚无证据', complete: '尚未结算', time: '昨天 16:05', duration: '—', tone: 'neutral', screenshot: '/assets/result-normal.svg', video: '/assets/demo-normal.webm' },
];

const icons = {
  grid: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  cases: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>',
  build: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14.7 6.3 3-3a4.2 4.2 0 0 1-5.3 5.3l-6.8 6.8a2 2 0 1 0 2.8 2.8l6.8-6.8a4.2 4.2 0 0 1 5.3-5.3l-3 3z"/></svg>',
  run: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>',
  settings: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  upload: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5"/></svg>',
  file: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/></svg>',
  package: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>',
  close: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  arrow: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function badge(label, tone = 'neutral') {
  return `<span class="badge ${tone === 'neutral' ? '' : tone}">${esc(label)}</span>`;
}

function route() {
  const raw = location.hash.slice(1) || 'projects';
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] !== 'project') return { page: 'projects' };
  return { page: 'project', projectId: parts[1] || state.selectedProject, section: parts[2] || 'cases', id: parts[3] || null };
}

function currentProject() {
  return state.projects.find((project) => project.id === state.selectedProject) || state.projects[0];
}

function navigate(hash) {
  if (location.hash === `#${hash}`) render();
  else location.hash = hash;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function shell(content, active = 'projects', title = '') {
  const project = currentProject();
  const projectContext = active !== 'projects';
  return `
    <div class="shell">
      <aside class="sidebar" aria-label="工作台导航">
        <div class="brand"><div class="brand-mark">${icons.run}</div><div><strong>测试工作台</strong><small>UI-D1 prototype</small></div></div>
        <div class="sidebar-label">工作空间</div>
        <nav class="side-nav">
          <button class="side-link ${active === 'projects' ? 'active' : ''}" data-nav="projects">${icons.grid}<span>项目列表</span><span class="nav-badge">${state.projects.length}</span></button>
        </nav>
        ${projectContext ? `
          <div class="sidebar-label">${esc(project.name)}</div>
          <nav class="side-nav" aria-label="项目内导航">
            <button class="side-link ${active === 'cases' ? 'active' : ''}" data-project-nav="cases">${icons.cases}<span>用例库</span><span class="nav-badge">${project.cases}</span></button>
            <button class="side-link ${active === 'builds' ? 'active' : ''}" data-project-nav="builds">${icons.build}<span>建例任务</span><span class="nav-badge">3</span></button>
            <button class="side-link ${active === 'runs' ? 'active' : ''}" data-project-nav="runs">${icons.run}<span>执行记录</span><span class="nav-badge">4</span></button>
            <button class="side-link ${active === 'settings' ? 'active' : ''}" data-project-nav="settings">${icons.settings}<span>项目设置</span></button>
          </nav>
          <div class="sidebar-label">暂未实现</div>
          <div class="side-nav">
            <button class="side-link disabled" disabled>${icons.run}<span>批量执行</span></button>
            <button class="side-link disabled" disabled>${icons.settings}<span>环境管理</span></button>
          </div>` : ''}
        <div class="side-spacer"></div>
        <div class="sidebar-note"><strong>演示边界</strong>不调用正式 API、Harness 或业务脚本；页面状态不能作为真实证据。</div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="crumbs"><button data-nav="projects">项目</button>${projectContext ? `<span class="divider">/</span><span>${esc(project.name)}</span>${title ? `<span class="divider">/</span><strong>${esc(title)}</strong>` : ''}` : ''}</div>
          <div class="top-actions"><span class="connection">原型就绪</span><button class="button" data-open-capabilities>能力边界</button></div>
        </header>
        <main id="main-content" class="content" tabindex="-1">${content}</main>
      </div>
    </div>`;
}

function renderProjects() {
  const content = `
    <div class="page-heading">
      <div><p class="eyebrow">Projects</p><h1>项目</h1><p>从项目进入用例、建例任务和执行结果，避免在全局控制台中寻找资产。</p></div>
      <div class="heading-actions"><button class="button primary" id="create-project">${icons.plus}创建项目</button></div>
    </div>
    <section class="stat-grid" aria-label="项目概览">
      <div class="stat-card"><span>项目</span><strong>${state.projects.length}</strong><small>本地单用户</small></div>
      <div class="stat-card"><span>用例</span><strong>${state.projects.reduce((sum, item) => sum + item.cases, 0)}</strong><small>内容与自动化状态分开</small></div>
      <div class="stat-card"><span>待人工处理</span><strong>4</strong><small>含范围待确认与候选核对</small></div>
      <div class="stat-card"><span>最近运行</span><strong>1 失败</strong><small>断言事实，不做责任裁断</small></div>
    </section>
    <div class="project-grid" data-testid="project-grid">
      ${state.projects.map((project) => `
        <button class="project-card" data-project-id="${project.id}">
          <div>${badge(project.attention ? `${project.attention} 项待处理` : '无待处理', project.attention ? 'warning' : 'success')}</div>
          <h2>${esc(project.name)}</h2><p>${esc(project.description)}</p>
          <div class="project-meta"><span>${project.cases} 条用例</span><span>${project.automated} 条已有脚本</span><span>最近：${project.lastRun}</span></div>
          <div class="project-footer"><span class="muted">进入项目工作区</span><span class="arrow">打开 →</span></div>
        </button>`).join('')}
    </div>`;
  app.innerHTML = shell(content, 'projects');
}

function renderCases() {
  const query = state.caseSearch.trim().toLowerCase();
  const filtered = cases.filter((item) => {
    const searchMatch = !query || `${item.external} ${item.title}`.toLowerCase().includes(query);
    const statusMatch = state.caseStatus === 'all' || item.content === state.caseStatus || item.automation === state.caseStatus;
    return searchMatch && statusMatch;
  });
  const content = `
    <div class="page-heading">
      <div><p class="eyebrow">Case library</p><h1>用例库</h1><p>业务内容、自动化准备和最近运行分别管理。导入可以在项目创建后重复进行。</p></div>
      <div class="heading-actions"><button class="button" disabled title="首版尚未实现批量执行">批量执行 · 规划中</button><button class="button primary" id="open-import">${icons.upload}导入用例</button></div>
    </div>
    <section class="stat-grid" aria-label="用例状态概览">
      <div class="stat-card"><span>全部用例</span><strong>12</strong><small>含 3 个来源批次</small></div>
      <div class="stat-card"><span>内容待确认</span><strong>2</strong><small>不能进入可执行建例</small></div>
      <div class="stat-card"><span>已有脚本</span><strong>5</strong><small>其中 1 条已首审</small></div>
      <div class="stat-card"><span>待处理</span><strong>3</strong><small>核对、冲突或范围确认</small></div>
    </section>
    <div class="toolbar">
      <input class="search" id="case-search" aria-label="搜索用例" placeholder="按编号或标题搜索" value="${esc(state.caseSearch)}">
      <select id="case-status" aria-label="筛选状态"><option value="all">全部状态</option><option value="已确认">内容已确认</option><option value="待确认">内容待确认</option><option value="未建例">未建例</option><option value="待人工核对">待人工核对</option></select>
      <button class="button">导出选中</button><button class="button">导出全部</button>
    </div>
    <div class="table-wrap">
      <table data-testid="case-table"><thead><tr><th><input type="checkbox" aria-label="选择全部用例"></th><th>用例</th><th>模块</th><th>内容状态</th><th>自动化状态</th><th>最近运行</th><th>版本</th><th>操作</th></tr></thead>
      <tbody>${filtered.map((item) => `
        <tr><td><input type="checkbox" aria-label="选择 ${esc(item.external)}"></td>
          <td><button class="row-link" data-case-id="${item.id}"><span class="row-title">${esc(item.external)} · ${esc(item.title)}</span></button>${item.issue ? `<span class="row-subtitle">${esc(item.issue)}</span>` : ''}</td>
          <td>${esc(item.module)}</td><td>${badge(item.content, item.content === '已确认' ? 'success' : 'warning')}</td>
          <td>${badge(item.automation, item.automation === '已首审脚本' ? 'success' : item.automation === '生成中' ? 'info' : item.automation === '待人工核对' ? 'primary' : item.automation.includes('失败') ? 'danger' : 'neutral')}</td>
          <td>${badge(item.recent, item.tone)}</td><td>v${item.version}</td><td><button class="button" data-case-id="${item.id}">查看</button></td></tr>`).join('') || '<tr><td colspan="8"><div class="empty">没有符合当前条件的用例。</div></td></tr>'}</tbody></table>
    </div>`;
  app.innerHTML = shell(content, 'cases', '用例库');
  document.querySelector('#case-status').value = state.caseStatus;
}

function renderCaseDetail(caseId) {
  const item = cases.find((entry) => entry.id === caseId) || cases[0];
  const build = builds.find((entry) => entry.caseId === item.id);
  const content = `
    <div class="page-heading">
      <div><button class="button" data-project-nav="cases">${icons.back}返回用例库</button><p class="eyebrow" style="margin-top:16px">${esc(item.external)} · v${item.version}</p><h1>${esc(item.title)}</h1><p>来源：平台用例包 / 演示批次 IMP-20260922-03</p></div>
      <div class="heading-actions"><button class="button">编辑并形成新版本</button><button class="button primary" ${item.content === '已确认' ? '' : 'disabled'}>创建建例任务</button></div>
    </div>
    <div class="status-strip">
      <div class="status-box"><small>内容状态</small><strong>${badge(item.content, item.content === '已确认' ? 'success' : 'warning')}</strong></div>
      <div class="status-box"><small>自动化状态</small><strong>${badge(item.automation, item.automation === '待人工核对' ? 'primary' : 'neutral')}</strong></div>
      <div class="status-box"><small>最近运行</small><strong>${badge(item.recent, item.tone)}</strong></div>
    </div>
    <div class="detail-layout">
      <div class="detail-stack">
        <section class="card"><div class="card-header"><h3>原用例内容</h3><span class="badge success">v1 内容已确认</span></div><div class="card-body">
          <dl class="kv"><div><dt>模块</dt><dd>无登录合成列表查询</dd></div><div><dt>用例编号</dt><dd>${esc(item.external)}</dd></div><div><dt>前置条件</dt><dd>全新独立浏览器上下文；只读核对</dd></div><div><dt>测试数据</dt><dd>站点=西站；类型=检修</dd></div></dl>
          <h3>步骤与逐步预期</h3>
          <div class="step-list">
            <div class="step-pair"><div class="step-order">01</div><div class="step-cell"><small>动作</small><p>打开列表查询入口，保持默认状态。</p></div><div class="step-cell"><small>预期</small><p>标题、计数、筛选控件、排序和首屏三行均符合冻结用例。</p></div></div>
            <div class="step-pair"><div class="step-order">02</div><div class="step-cell"><small>动作</small><p>选择西站和检修，不点击查询。</p></div><div class="step-cell"><small>预期</small><p>只有控件值改变；计数与完整表格保持操作前状态。</p></div></div>
            <div class="step-pair"><div class="step-order">03</div><div class="step-cell"><small>动作</small><p>点击查询并核对结果集。</p></div><div class="step-cell"><small>预期</small><p>返回三行；编号、站点、类型与功率符合逐步预期。</p></div></div>
          </div>
        </div></section>
        <section class="card"><div class="card-header"><h3>关联建例任务与脚本版本</h3><button class="button" data-project-nav="builds">查看全部建例任务</button></div><div class="card-body relation-list">
          ${build ? `<div class="relation-item"><div><strong>${esc(build.id)} · ${esc(build.task)}</strong><p>候选 ${esc(build.candidate)} · ${esc(build.validation)} · ${esc(build.human)}</p></div><button class="button" data-project-nav="builds">定位任务</button></div>` : '<div class="empty">尚未创建建例任务。</div>'}
          <div class="relation-item"><div><strong>脚本版本 v1 · 尚未批准</strong><p>已有技术复验结果；不能直接作为批准资产运行。</p></div>${badge('等待人工核对', 'primary')}</div>
        </div></section>
      </div>
      <aside class="aside-stack">
        <section class="callout warning" data-testid="pending-issue"><strong>验收范围待确认</strong><p>任务名称列是否属于 HOLD-Q1 必验字段仍待业务负责人确认。该问题不改写已有执行事实。</p><button class="button" id="show-pending-detail" style="margin-top:10px">查看待处理问题</button></section>
        <section class="card"><div class="card-header"><h3>版本历史</h3></div><div class="card-body timeline">
          <div class="timeline-item"><span class="timeline-dot"></span><div><strong>v1 · 当前版本</strong><p>来源内容确认 · 2026-09-22</p></div></div>
          <div class="timeline-item"><span class="timeline-dot pending"></span><div><strong>自动化关联</strong><p>候选已技术复验，等待人工核对</p></div></div>
        </div></section>
        <section class="card"><div class="card-header"><h3>关联执行</h3></div><div class="card-body relation-list">
          <div class="relation-item"><div><strong>run-240922-failed</strong><p>受控反例 · 断言不符 · 证据齐全</p></div><button class="button" data-run-id="run-240922-failed">查看</button></div>
        </div></section>
        <details class="tech"><summary>技术详情</summary><div class="tech-content"><dl class="kv"><div><dt>内容 SHA-256</dt><dd class="mono">2DDBA239…CCD02ED2</dd></div><div><dt>来源身份</dt><dd class="mono">heldout-lab/cases.json#HOLD-Q1</dd></div><div><dt>候选 SHA-256</dt><dd class="mono">CA3819EF…B6914</dd></div><div><dt>模型配置</dt><dd>deepseek-flash（历史生成记录）</dd></div></dl></div></details>
      </aside>
    </div>`;
  app.innerHTML = shell(content, 'cases', item.external);
}

function renderBuilds() {
  const content = `
    <div class="page-heading"><div><p class="eyebrow">Build tasks</p><h1>建例任务</h1><p>任务调用、候选生成、技术验证和人工核对是四个独立状态。</p></div><div class="heading-actions"><button class="button" disabled>批量建例 · 未实现</button></div></div>
    <div class="toolbar"><input class="search" placeholder="搜索任务 ID 或用例"><select><option>全部任务状态</option><option>生成中</option><option>等待人工核对</option><option>中断</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>来源用例</th><th>任务</th><th>候选生成</th><th>技术验证</th><th>人工核对</th><th>候选</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
      ${builds.map((item) => `<tr><td><button class="row-link" data-case-id="${item.caseId}">${item.case} · v${item.version}</button><span class="row-subtitle">${esc(item.title)}</span></td><td>${badge(item.task, item.tone)}</td><td>${esc(item.generation)}</td><td>${esc(item.validation)}</td><td>${badge(item.human, item.human === '等待人工核对' ? 'primary' : 'neutral')}</td><td>${esc(item.candidate)}</td><td>${esc(item.updated)}</td><td><button class="button" data-build-detail="${item.id}">查看详情</button></td></tr>`).join('')}
    </tbody></table></div>
    <section class="callout info" style="margin-top:14px"><strong>状态不是一个“成功”字段</strong><p>Harness 结束不代表候选验证通过；技术验证通过也不代表人工批准。原型只展示现有状态边界。</p></section>`;
  app.innerHTML = shell(content, 'builds', '建例任务');
}

function renderRuns(runId = state.selectedRun) {
  state.selectedRun = runs.some((item) => item.id === runId) ? runId : runs[0].id;
  const selected = runs.find((item) => item.id === state.selectedRun);
  const content = `
    <div class="page-heading"><div><p class="eyebrow">Execution history</p><h1>执行记录</h1><p>进程、报告、测试与证据分别结算；原始断言事实不会被验收结论覆盖。</p></div><div class="heading-actions"><button class="button" disabled>批量运行 · 未实现</button><button class="button" disabled>环境管理 · 未实现</button></div></div>
    <div class="run-layout">
      <section class="card"><div class="card-header"><h3>最近运行</h3><span class="muted">4 条演示记录</span></div><div class="card-body run-list">
        ${runs.map((run) => `<button class="run-card ${run.id === selected.id ? 'selected' : ''}" data-run-id="${run.id}"><span class="run-top"><strong>${esc(run.case)}</strong>${badge(run.test, run.tone)}</span><span class="row-subtitle">${esc(run.title)}</span><p>${esc(run.mode)} · ${esc(run.time)}</p></button>`).join('')}
      </div></section>
      <section class="card" data-testid="run-detail"><div class="card-header"><div><h3>${esc(selected.case)} · ${esc(selected.mode)}</h3><span class="muted mono">${esc(selected.id)}</span></div>${badge(selected.complete, selected.complete === '整体通过' ? 'success' : selected.complete === '尚未结算' ? 'neutral' : 'danger')}</div>
        <div class="card-body">${renderRunDetail(selected)}</div>
      </section>
    </div>`;
  app.innerHTML = shell(content, 'runs', '执行记录');
}

function renderRunDetail(run) {
  const failed = run.tone === 'danger';
  const interrupted = run.tone === 'warning';
  const pending = run.tone === 'neutral';
  const steps = pending ? [
    ['S01', '未执行', '等待已首审脚本', '尚无实际结果', 'not-run'],
  ] : interrupted ? [
    ['S01', '通过', '页面可打开，初始控件可见', '实际通过', ''],
    ['S02', '中断', '选择筛选条件但不查询', '子进程异常退出，实际值未取得', 'failed'],
    ['S03', '未执行', '查询结果满足全部冻结预期', '前一步中断，未执行', 'not-run'],
  ] : [
    ['S01', '通过', '默认态标题、计数和表格符合预期', '实际通过', ''],
    ['S02', '通过', '只改变筛选控件，完整表格保持不变', '实际通过', ''],
    ['S03', failed ? '断言不符' : '通过', '计数器“共3条 · 第1/1页”', failed ? '计数器“共6条 · 第1/2页”' : '实际通过', failed ? 'failed' : ''],
    ['S04', failed ? '未执行' : '通过', '后续证据收集完整', failed ? 'S03 失败后未执行' : '实际通过', failed ? 'not-run' : ''],
  ];
  return `
    <div class="result-hero"><div><strong>${esc(run.title)}</strong><p>${esc(run.time)} · ${esc(run.duration)} · 演示环境</p></div><div><span class="score">${pending ? '—' : failed ? '1 / 4' : interrupted ? '1 / 3' : '4 / 4'}</span><span class="row-subtitle">步骤完成</span></div></div>
    <div class="status-strip"><div class="status-box"><small>执行</small><strong>${esc(run.execution)}</strong></div><div class="status-box"><small>结构化报告</small><strong>${esc(run.report)}</strong></div><div class="status-box"><small>原始测试结果</small><strong>${badge(run.test, run.tone)}</strong></div></div>
    ${failed ? '<div class="callout danger"><strong>断言不符 · 归因待分析</strong><p>保留原始 Expected / Received；这不是“产品缺陷已确认”。</p></div>' : interrupted ? '<div class="callout warning"><strong>运行中断</strong><p>报告与证据不完整，整体不得通过；未执行步骤保持未执行。</p></div>' : pending ? '<div class="callout info"><strong>尚未运行</strong><p>用例内容已确认不等于脚本可执行，目前没有候选、报告或媒体。</p></div>' : ''}
    <h3 style="margin-top:16px">步骤结果</h3>
    <div>${steps.map(([id, status, expected, actual, cls]) => `<div class="result-step ${cls}"><div class="step-state"><strong>${id}</strong><div style="margin-top:5px">${badge(status, status === '通过' ? 'success' : status === '断言不符' || status === '中断' ? 'danger' : 'warning')}</div></div><div class="step-cell"><small>预期</small><p>${esc(expected)}</p></div><div class="step-cell"><small>实际</small><p>${esc(actual)}</p>${status === '断言不符' ? '<span class="actual-mismatch">Expected 3 · Received 6</span>' : ''}</div></div>`).join('')}</div>
    ${pending ? '' : `<h3 style="margin-top:18px">证据</h3><div class="media-grid">
      <article class="media-card"><header><strong>页面截图</strong>${badge('合成演示', 'info')}</header><button class="row-link" data-lightbox="${run.screenshot}" aria-label="查看完整演示截图"><img src="${run.screenshot}" alt="${esc(run.case)} 的合成演示页面截图"></button><footer>与本演示运行关联，不是正式执行媒体。</footer></article>
      <article class="media-card"><header><strong>运行录像</strong>${badge('合成演示', 'info')}</header><video controls preload="metadata" data-testid="result-video" src="${run.video}">浏览器不支持 video。</video><footer>没有步骤级时间戳，不提供虚假的精确跳转。</footer></article>
    </div><div class="trace-box"><div><strong>Trace 本地查看入口</strong><p>正式接入后通过登记 ID 下载，并使用 Playwright Trace Viewer 本地打开。</p></div><button class="button" id="trace-demo">查看说明</button></div>`}
    <details class="tech"><summary>技术详情：哈希、配置、原始 JSON 与日志</summary><div class="tech-content"><dl class="kv"><div><dt>脚本 SHA-256</dt><dd class="mono">CA3819EF8CA3…6B6914</dd></div><div><dt>运行配置</dt><dd>Chromium · workers=1 · retries=0</dd></div><div><dt>报告状态</dt><dd>${esc(run.report)}</dd></div><div><dt>证据状态</dt><dd>${esc(run.evidence)}</dd></div></dl><pre>{
  "run_id": "${esc(run.id)}",
  "test_status": "${esc(run.test)}",
  "complete_pass": ${run.complete === '整体通过'},
  "demo_only": true
}</pre></div></details>`;
}

function renderSettings() {
  const project = currentProject();
  const content = `<div class="page-heading"><div><p class="eyebrow">Project settings</p><h1>项目设置</h1><p>首版只演示名称、说明和数据边界；环境管理和多人权限尚未实现。</p></div></div>
    <div class="detail-layout"><section class="card"><div class="card-header"><h3>基本信息</h3></div><div class="card-body"><div class="field"><span>项目名称</span><input value="${esc(project.name)}"></div><div class="field" style="margin-top:12px"><span>项目说明</span><textarea>${esc(project.description)}</textarea></div><button class="button primary" id="save-settings" style="margin-top:14px">保存演示修改</button></div></section>
    <aside class="aside-stack"><section class="callout info"><strong>单机原型</strong><p>不含权限、成员、通知或共享配置。</p></section><section class="card"><div class="card-header"><h3>未实现能力</h3></div><div class="card-body relation-list"><div class="relation-item"><div><strong>环境管理</strong><p>现有后端只允许登记过的限定入口。</p></div>${badge('规划中')}</div><div class="relation-item"><div><strong>Web审批</strong><p>人工核对结论尚无通用Web写入流程。</p></div>${badge('规划中')}</div></div></section></aside></div>`;
  app.innerHTML = shell(content, 'settings', '项目设置');
}

function render() {
  const current = route();
  if (current.page === 'projects') renderProjects();
  else {
    state.selectedProject = current.projectId;
    if (current.section === 'case') renderCaseDetail(current.id);
    else if (current.section === 'builds') renderBuilds();
    else if (current.section === 'runs' && current.id) renderRuns(current.id);
    else if (current.section === 'runs') renderRuns();
    else if (current.section === 'settings') renderSettings();
    else renderCases();
  }
  bindActions();
  document.querySelector('#main-content')?.focus({ preventScroll: true });
}

function bindActions() {
  document.querySelectorAll('[data-nav="projects"]').forEach((node) => node.addEventListener('click', () => navigate('projects')));
  document.querySelectorAll('[data-project-id]').forEach((node) => node.addEventListener('click', () => { state.selectedProject = node.dataset.projectId; navigate(`project/${state.selectedProject}/cases`); }));
  document.querySelectorAll('[data-project-nav]').forEach((node) => node.addEventListener('click', () => navigate(`project/${state.selectedProject}/${node.dataset.projectNav}`)));
  document.querySelectorAll('[data-case-id]').forEach((node) => node.addEventListener('click', () => navigate(`project/${state.selectedProject}/case/${node.dataset.caseId}`)));
  document.querySelectorAll('[data-run-id]').forEach((node) => node.addEventListener('click', () => navigate(`project/${state.selectedProject}/runs/${node.dataset.runId}`)));
  document.querySelector('#create-project')?.addEventListener('click', openCreateProject);
  document.querySelector('#open-import')?.addEventListener('click', () => openImportWizard(1));
  document.querySelector('#case-search')?.addEventListener('input', (event) => { state.caseSearch = event.target.value; renderCases(); bindActions(); document.querySelector('#case-search')?.focus(); });
  document.querySelector('#case-status')?.addEventListener('change', (event) => { state.caseStatus = event.target.value; render(); });
  document.querySelector('#show-pending-detail')?.addEventListener('click', openPendingIssue);
  document.querySelectorAll('[data-build-detail]').forEach((node) => node.addEventListener('click', () => openBuildDetail(node.dataset.buildDetail)));
  document.querySelectorAll('[data-lightbox]').forEach((node) => node.addEventListener('click', () => openLightbox(node.dataset.lightbox)));
  document.querySelector('#trace-demo')?.addEventListener('click', openTraceInfo);
  document.querySelector('#save-settings')?.addEventListener('click', () => showToast('演示设置已保存到当前浏览器内存。'));
  document.querySelector('[data-open-capabilities]')?.addEventListener('click', openCapabilities);
}

function modalFrame({ title, description = '', body, footer = '', small = false, testid = '' }) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal ${small ? 'small' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" ${testid ? `data-testid="${testid}"` : ''}><header class="modal-header"><div><h2 id="modal-title">${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div><button class="button icon-button" data-close-modal aria-label="关闭弹窗">${icons.close}</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}</section></div>`;
  modalRoot.querySelector('[data-close-modal]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-modal-backdrop]').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeModal(); });
  modalRoot.querySelector('[data-close-modal]').focus();
}

function closeModal() { modalRoot.innerHTML = ''; }

function openCreateProject() {
  modalFrame({
    title: '创建项目', description: '项目创建后仍可随时导入 Excel 或平台用例包。', small: true, testid: 'create-project-dialog',
    body: `<div class="field"><label for="new-project-name">项目名称</label><input id="new-project-name" value="合成查询验证项目" maxlength="60"></div><div class="field" style="margin-top:12px"><label for="new-project-description">项目说明</label><textarea id="new-project-description">UI-D1 交互原型创建的演示项目</textarea></div><div class="callout info" style="margin-top:14px"><strong>仅演示</strong><p>不会调用正式项目创建接口，也不会写入本地工作台数据目录。</p></div>`,
    footer: `<span class="muted">下一步可直接导入，也可稍后从用例库再次导入。</span><div class="modal-actions"><button class="button" data-close-secondary>取消</button><button class="button primary" id="confirm-create-project">创建并导入</button></div>`,
  });
  modalRoot.querySelector('[data-close-secondary]').addEventListener('click', closeModal);
  modalRoot.querySelector('#confirm-create-project').addEventListener('click', () => {
    const name = modalRoot.querySelector('#new-project-name').value.trim();
    if (!name) return showToast('请填写项目名称。');
    const id = `project-demo-${Date.now()}`;
    state.projects.unshift({ id, name, description: modalRoot.querySelector('#new-project-description').value.trim(), cases: 0, automated: 0, attention: 0, lastRun: '暂无运行' });
    state.selectedProject = id;
    closeModal();
    navigate(`project/${id}/cases`);
    setTimeout(() => { showToast('演示项目已创建；现在选择导入来源。'); openImportWizard(1); }, 80);
  });
}

function wizardProgress(step) {
  return `<div class="wizard-progress">${['选择来源', '文件与映射', '预览确认', '完成'].map((label, index) => `<div class="wizard-step ${index + 1 === step ? 'active' : index + 1 < step ? 'done' : ''}"><span class="wizard-number">${index + 1 < step ? '✓' : index + 1}</span><span>${label}</span></div>`).join('')}</div>`;
}

function openImportWizard(step = state.import.step) {
  state.import.step = step;
  let body = wizardProgress(step);
  let footer;
  if (step === 1) {
    body += `<h3>选择导入来源</h3><div class="source-grid"><button class="source-option ${state.import.source === 'excel' ? 'selected' : ''}" data-source="excel">${icons.file}<h3>Excel 用例</h3><p>首版明确模板：一行一条用例，步骤和逐步预期按单元格内行位置对应。</p></button><button class="source-option ${state.import.source === 'package' ? 'selected' : ''}" data-source="package">${icons.package}<h3>平台用例包</h3><p>导入带 schema 版本的 JSON；不携带脚本、批准或执行结果。</p></button></div><div class="callout info" style="margin-top:14px"><strong>支持多次导入</strong><p>导入不会覆盖项目已有用例；重复、冲突与待澄清项会先进入预览。</p></div>`;
    footer = `<span class="muted">第 1 / 4 步</span><div class="modal-actions"><button class="button" data-close-secondary>取消</button><button class="button primary" data-wizard-next>下一步</button></div>`;
  } else if (step === 2) {
    const excel = state.import.source === 'excel';
    body += `<div class="file-drop">${excel ? icons.file : icons.package}<strong>${excel ? 'M3A_CASE_IMPORT_TEMPLATE_V1.xlsx' : 'inspection-cases.package.json'}</strong><span class="muted">演示文件 · 已读取 · 不访问本机真实文件</span></div>${excel ? `<h3>工作表与字段映射</h3><div class="mapping-grid">${[['工作表','用例'],['用例编号','编号'],['标题','标题'],['模块','模块'],['步骤','步骤'],['逐步预期','预期']].map(([label,value]) => `<label class="field"><span>${label}</span><select><option>${value}</option></select></label>`).join('')}</div><div class="preview-issue"><strong>提示</strong><span>步骤与预期的第 3 行位置不一致时保留待澄清，不自动重新配对。</span></div>` : `<h3>平台用例包</h3><dl class="kv"><div><dt>Schema</dt><dd>workbench/case-package-v1</dd></div><div><dt>来源项目</dt><dd>巡检回归样例库</dd></div><div><dt>用例数量</dt><dd>4 条</dd></div><div><dt>内容边界</dt><dd>不含脚本、媒体、凭据</dd></div></dl>`}`;
    footer = `<button class="button" data-wizard-back>上一步</button><div class="modal-actions"><button class="button" data-close-secondary>取消</button><button class="button primary" data-wizard-next>生成预览</button></div>`;
  } else if (step === 3) {
    body += `<div class="preview-summary"><div class="preview-count"><strong>3</strong><span>新增</span></div><div class="preview-count"><strong>1</strong><span>重复跳过</span></div><div class="preview-count"><strong>1</strong><span>冲突</span></div><div class="preview-count"><strong>1</strong><span>待澄清</span></div><div class="preview-count"><strong>0</strong><span>无法导入</span></div></div>
      <div class="table-wrap" style="border-top:1px solid var(--line);border-radius:10px"><table data-testid="import-preview-table"><thead><tr><th>分类</th><th>用例</th><th>来源位置</th><th>处理</th></tr></thead><tbody>
      <tr><td>${badge('新增','success')}</td><td>QRY-001 · 联合条件查询</td><td>用例!2</td><td>导入</td></tr>
      <tr><td>${badge('新增','success')}</td><td>QRY-002 · 查询前状态保持</td><td>用例!3</td><td>导入</td></tr>
      <tr><td>${badge('重复','neutral')}</td><td>SORT-002 · 创建时间降序</td><td>用例!4</td><td>默认跳过</td></tr>
      <tr><td>${badge('冲突','danger')}</td><td>HOLD-Q1 · 工作区一列表查询</td><td>用例!5</td><td><select aria-label="冲突处理"><option>跳过，不覆盖</option><option>作为独立副本导入</option></select></td></tr>
      <tr><td>${badge('待澄清','warning')}</td><td>MEDIA-009 · 录像证据核对</td><td>用例!7</td><td>预期第2行缺失，不导入</td></tr>
      </tbody></table></div><div class="preview-issue"><strong>确认前不会修改项目</strong><span>提交时会重新检查项目版本；失败不会留下部分导入。</span></div>`;
    footer = `<button class="button" data-wizard-back>上一步</button><div class="modal-actions"><button class="button" data-close-secondary>取消</button><button class="button primary" id="confirm-import">确认导入 3 条</button></div>`;
  } else {
    body += `<div style="text-align:center;padding:24px 16px"><span class="timeline-dot" style="width:42px;height:42px;margin:0 auto 14px;font-size:20px">✓</span><h2>导入完成</h2><p class="muted">新增 3 条，重复跳过 1 条，冲突跳过 1 条，待澄清 1 条未写入。</p><div class="callout info" style="max-width:560px;margin:18px auto 0;text-align:left"><strong>仍可再次导入</strong><p>用例库右上角的“导入用例”持续可用，不限定创建项目时导入一次。</p></div></div>`;
    footer = `<span class="muted">第 4 / 4 步</span><button class="button primary" id="finish-import">返回用例列表</button>`;
  }
  modalFrame({ title: '导入用例', description: `目标项目：${currentProject().name}`, body, footer, testid: 'import-wizard' });
  modalRoot.querySelector('[data-close-secondary]')?.addEventListener('click', closeModal);
  modalRoot.querySelectorAll('[data-source]').forEach((node) => node.addEventListener('click', () => { state.import.source = node.dataset.source; openImportWizard(1); }));
  modalRoot.querySelector('[data-wizard-next]')?.addEventListener('click', () => openImportWizard(step + 1));
  modalRoot.querySelector('[data-wizard-back]')?.addEventListener('click', () => openImportWizard(step - 1));
  modalRoot.querySelector('#confirm-import')?.addEventListener('click', () => {
    const project = currentProject(); project.cases += 3; project.attention += 1; openImportWizard(4);
  });
  modalRoot.querySelector('#finish-import')?.addEventListener('click', () => { closeModal(); navigate(`project/${state.selectedProject}/cases`); showToast('演示导入已完成：新增 3 条，未覆盖冲突项。'); });
}

function openPendingIssue() {
  modalFrame({ title: '待处理问题', description: '该问题属于验收范围，不等同于脚本执行失败。', small: true, body: `<div class="callout warning"><strong>验收范围待确认</strong><p>expected_records 中包含任务名称，但 S03 配对预期未明确列出名称。当前候选不自动进入人工首审，也不自动补断言。</p></div><h3>需要确认</h3><p>以 expected_records 全字段为必验范围，还是以 S03 正文明示字段为本轮范围？</p><h3>影响</h3><p class="muted">前者需要一次有授权的候选修订；后者可追加纠正评估。两种选择都不会改写既有原始运行结果。</p>`, footer: `<span></span><button class="button primary" data-close-secondary>我知道了</button>` });
  modalRoot.querySelector('[data-close-secondary]').addEventListener('click', closeModal);
}

function openBuildDetail(id) {
  const build = builds.find((item) => item.id === id);
  modalFrame({ title: build.id, description: `${build.case} · v${build.version} · ${build.title}`, body: `<div class="status-strip"><div class="status-box"><small>任务</small><strong>${build.task}</strong></div><div class="status-box"><small>技术验证</small><strong>${build.validation}</strong></div><div class="status-box"><small>人工核对</small><strong>${build.human}</strong></div></div><div class="timeline"><div class="timeline-item"><span class="timeline-dot"></span><div><strong>输入已冻结</strong><p>来源项目、内部用例ID、版本和内容哈希已绑定</p></div></div><div class="timeline-item"><span class="timeline-dot ${build.task === '已完成' ? '' : 'pending'}"></span><div><strong>${build.generation}</strong><p>候选状态：${build.candidate}</p></div></div><div class="timeline-item"><span class="timeline-dot pending"></span><div><strong>${build.human}</strong><p>技术结果不会自动转为批准资产</p></div></div></div><details class="tech"><summary>查看冻结输入与技术信息</summary><div class="tech-content"><pre>{
  "task_id": "${build.id}",
  "source_case": "${build.case}@v${build.version}",
  "candidate": "${build.candidate}",
  "demo_only": true
}</pre></div></details>`, footer: `<button class="button" data-go-case>返回来源用例</button><button class="button primary" data-close-secondary>关闭</button>` });
  modalRoot.querySelector('[data-close-secondary]').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-go-case]').addEventListener('click', () => { closeModal(); navigate(`project/${state.selectedProject}/case/${build.caseId}`); });
}

function openLightbox(src) {
  modalFrame({ title: '页面截图', description: '合成演示媒体，不是正式执行证据。', body: `<img src="${src}" alt="合成演示页面完整截图" style="display:block;width:100%;border:1px solid var(--line);border-radius:10px">`, footer: `<span class="muted">1280 × 720 · 演示数据</span><button class="button primary" data-close-secondary>关闭</button>` });
  modalRoot.querySelector('[data-close-secondary]').addEventListener('click', closeModal);
}

function openTraceInfo() {
  modalFrame({ title: 'Trace 查看说明', small: true, body: `<p>正式工作台已经使用登记ID和哈希边界提供Trace文件入口。本原型不读取私有Trace，也不将Trace上传外部服务。</p><pre>npx playwright show-trace &lt;已下载的 trace.zip&gt;</pre><div class="callout info" style="margin-top:12px"><strong>原型限制</strong><p>本页只演示入口位置和说明，不提供真实Trace文件。</p></div>`, footer: `<span></span><button class="button primary" data-close-secondary>关闭</button>` });
  modalRoot.querySelector('[data-close-secondary]').addEventListener('click', closeModal);
}

function openCapabilities() {
  modalFrame({ title: '现有能力与原型边界', description: '页面设计以当前代码和API为依据。', body: `<div class="table-wrap" style="border-top:1px solid var(--line);border-radius:10px"><table><thead><tr><th>能力</th><th>当前事实</th><th>原型处理</th></tr></thead><tbody><tr><td>项目、用例、版本</td><td>${badge('已实现','success')}</td><td>可直接对接现有读取/写入API</td></tr><tr><td>Excel / JSON包导入预览</td><td>${badge('已实现','success')}</td><td>按向导重组交互</td></tr><tr><td>单条建例与候选验证</td><td>${badge('限定场景','warning')}</td><td>明确场景与状态边界</td></tr><tr><td>已首审脚本运行与媒体</td><td>${badge('限定场景','warning')}</td><td>从项目用例与运行记录进入</td></tr><tr><td>批量执行</td><td>${badge('尚未实现')}</td><td>禁用并标注规划中</td></tr><tr><td>通用Web审批</td><td>${badge('尚未实现')}</td><td>不展示可用批准按钮</td></tr><tr><td>环境管理</td><td>${badge('尚未实现')}</td><td>禁用并说明现有入口受控</td></tr></tbody></table></div>`, footer: `<span class="muted">详细矩阵见 DESIGN_NOTES.md</span><button class="button primary" data-close-secondary>关闭</button>` });
  modalRoot.querySelector('[data-close-secondary]').addEventListener('click', closeModal);
}

window.addEventListener('hashchange', render);
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modalRoot.children.length) closeModal(); });
render();
