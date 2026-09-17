(() => {
  'use strict';

  const orders = [
    {
      id: 'WO-101',
      title: '送风机巡检',
      region: '北区',
      priority: '高',
      owner: '周宁',
      status: '待处理',
      minutes: 45,
    },
    {
      id: 'WO-102',
      title: '电表核验',
      region: '南区',
      priority: '中',
      owner: '林川',
      status: '处理中',
      minutes: 30,
    },
    {
      id: 'WO-103',
      title: '水泵检修',
      region: '北区',
      priority: '低',
      owner: '陈若',
      status: '已完成',
      minutes: 60,
    },
    {
      id: 'WO-104',
      title: '温控巡检',
      region: '西区',
      priority: '中',
      owner: '顾禾',
      status: '待处理',
      minutes: 20,
    },
    {
      id: 'WO-105',
      title: '送风机巡检',
      region: '东区',
      priority: '高',
      owner: '赵芷',
      status: '处理中',
      minutes: 45,
    },
    {
      id: 'WO-106',
      title: '门禁校验',
      region: '南区',
      priority: '低',
      owner: '周宁',
      status: '已完成',
      minutes: 15,
    },
    {
      id: 'WO-107',
      title: '照明排查',
      region: '东区',
      priority: '中',
      owner: '沈蓝',
      status: '待处理',
      minutes: 35,
    },
    {
      id: 'WO-108',
      title: '阀门检查',
      region: '西区',
      priority: '高',
      owner: '林川',
      status: '待处理',
      minutes: 25,
    },
  ];
  const $ = (id) => document.getElementById(id);
  const application = $('application');
  const main = $('main');
  const drawerLayer = $('drawer-layer');
  const serviceLayer = $('service-layer');
  const drawer = $('order-dialog');
  const serviceDialog = $('service-dialog');
  const menuToggle = $('service-menu-toggle');
  const menuLinks = $('service-menu-links');
  const pageSize = 3;
  const emptyFilters = () => ({ keyword: '', region: '', priority: '', status: '' });
  const state = { filters: emptyFilters(), page: 1, currentOrder: null, tab: 'basic' };
  let listTimer;
  let retryTimer;
  let drawerTrigger;
  let serviceTrigger;
  // A failed read remains retryable, and a successful retry lasts for this page lifecycle.
  let lightingRecords = 'unseen';
  let movingFocus = false;

  function loggedIn() {
    return document.cookie.split(';').some((value) => value.trim() === 'workorders_demo=1');
  }

  function setMenu(open, restoreFocus = false) {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuLinks.hidden = !open;
    if (restoreFocus) menuToggle.focus();
  }

  menuToggle.addEventListener('click', () => setMenu(menuLinks.hidden));
  menuToggle.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setMenu(true);
      menuLinks.querySelector('a').focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.service-menu')) setMenu(false);
  });
  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('.service-menu')) setMenu(false);
  });
  menuLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: 'start' });
  });

  function pageHeading(kicker, title, subtitle) {
    return `<header class="page-heading"><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="muted">${subtitle}</p></header>`;
  }

  function overview() {
    return `<dl class="overview" aria-label="工单概况">
      <div><dt>全部工单</dt><dd>${orders.length}<small>条</small></dd></div>
      <div><dt>待处理</dt><dd>${orders.filter((order) => order.status === '待处理').length}<small>条</small></dd></div>
      <div><dt>处理中</dt><dd>${orders.filter((order) => order.status === '处理中').length}<small>条</small></dd></div>
      <div><dt>已完成</dt><dd>${orders.filter((order) => order.status === '已完成').length}<small>条</small></dd></div>
    </dl>`;
  }

  function renderLogin() {
    main.innerHTML = `<section class="login-layout">
      <div class="login-intro"><p class="eyebrow">FACILITY SERVICE DESK</p><h1>让每一项运维工作<br>都有清晰的进展。</h1><p>集中查阅工单、定位现场任务，<br>在一个工作空间了解处理动态。</p><div class="login-meta"><span>4 个服务区域</span><span>8 条演示工单</span></div></div>
      <section class="login-panel" aria-labelledby="login-title"><span class="demo-badge">演示空间</span><h2 id="login-title">登录工单协作台</h2><p class="muted">使用演示身份查看工单，无需输入账号或密码。</p><button id="enter-demo" class="primary-button" type="button">进入演示</button><p class="login-note">仅使用合成数据，工单内容不可修改。</p></section>
    </section>`;
    $('enter-demo').addEventListener('click', () => {
      document.cookie = 'workorders_demo=1; Path=/; SameSite=Lax';
      if (location.hash === '#/home') renderRoute();
      else location.hash = '/home';
    });
  }

  function renderHome() {
    main.innerHTML =
      pageHeading('WORKSPACE / 首页', '工作空间', '欢迎回来，查看各区域工单与服务动态。') +
      overview() +
      `<section class="home-section" aria-labelledby="entry-title"><h2 id="entry-title">服务入口</h2><div class="entry-grid">
        <a class="entry-card" href="#/orders" aria-labelledby="orders-entry-title"><span class="entry-icon" aria-hidden="true">01</span><h3 id="orders-entry-title">工单中心</h3><p>按区域、优先级和状态查找工单，查看详情与处理记录。</p><span class="entry-arrow" aria-hidden="true">进入工作区 →</span></a>
        <a class="entry-card" href="#/announcements" aria-labelledby="notice-entry-title"><span class="entry-icon" aria-hidden="true">02</span><h3 id="notice-entry-title">知识公告</h3><p>集中查看服务公告，了解设施运维工作动态。</p><span class="entry-arrow" aria-hidden="true">查看公告 →</span></a>
      </div></section><aside class="workspace-note"><span class="note-dot" aria-hidden="true"></span><p>当前为只读演示空间，所有工单均为合成数据。</p></aside>`;
  }

  function renderAnnouncements() {
    main.innerHTML =
      pageHeading('SERVICE DESK / 知识公告', '知识公告', '服务动态与运维知识，集中在这里。') +
      `<section class="empty-state panel"><span class="empty-symbol" aria-hidden="true">—</span><h2>公告中心暂无新消息</h2><p class="muted">有新的服务公告时，将在此处展示。</p><a class="secondary-button" href="#/home">返回首页</a></section>`;
  }

  function selectField(name, label, options) {
    // Native selects deliberately stay nested inside their visible labels.
    return `<label class="filter-field"><span>${label}</span><span class="select-wrap"><select name="${name}"><option value="">全部</option>${options.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></span></label>`;
  }

  function renderOrders() {
    main.innerHTML =
      pageHeading('SERVICE DESK / 工单中心', '工单中心', '查看设施运维任务，跟进每一张工单。') +
      overview() +
      `<section class="panel filter-panel" aria-labelledby="filters-title"><div class="section-heading"><h2 id="filters-title">筛选工单</h2><span>多条件组合查询</span></div>
        <form id="filters" class="filter-form">
          <label class="filter-field keyword-field"><span>工单关键字</span><input name="keyword" type="search" placeholder="输入工单标题或编号" autocomplete="off"></label>
          ${selectField('region', '区域', ['北区', '南区', '东区', '西区'])}
          ${selectField('priority', '优先级', ['高', '中', '低'])}
          ${selectField('status', '状态', ['待处理', '处理中', '已完成'])}
          <div class="filter-actions"><button id="query" class="primary-button" type="submit">查询</button><button class="secondary-button" type="reset">重置</button></div>
        </form>
      </section>
      <section class="results-section" aria-labelledby="results-title"><div class="section-heading"><h2 id="results-title">工单列表</h2><span id="active-filters">全部工单</span></div>
        <p id="list-status" class="list-status" role="status" aria-live="polite" aria-atomic="true"></p>
        <div id="order-list" class="order-grid" aria-busy="false"></div>
        <nav id="pagination" class="pagination" aria-label="工单分页"><p id="page-summary"></p><div><button id="previous-page" class="secondary-button" type="button">上一页</button><button id="next-page" class="secondary-button" type="button">下一页</button></div></nav>
      </section>`;
    const form = $('filters');
    for (const [name, value] of Object.entries(state.filters))
      form.elements.namedItem(name).value = value;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      state.filters = Object.fromEntries(new FormData(form));
      state.page = 1;
      loadOrders();
    });
    form.addEventListener('reset', (event) => {
      event.preventDefault();
      state.filters = emptyFilters();
      state.page = 1;
      for (const name of Object.keys(state.filters)) form.elements.namedItem(name).value = '';
      loadOrders();
    });
    $('previous-page').addEventListener('click', () => changePage(-1));
    $('next-page').addEventListener('click', () => changePage(1));
    $('order-list').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const order = orders.find((item) => item.id === button.closest('article').dataset.order);
      if (order) openDrawer(order, button);
    });
    loadOrders();
  }

  function filteredOrders() {
    const { keyword, region, priority, status } = state.filters;
    const search = keyword.trim().toLocaleLowerCase();
    return orders.filter(
      (order) =>
        (!search ||
          order.title.toLocaleLowerCase().includes(search) ||
          order.id.toLocaleLowerCase().includes(search)) &&
        (!region || order.region === region) &&
        (!priority || order.priority === priority) &&
        (!status || order.status === status),
    );
  }

  function changePage(direction) {
    const totalPages = Math.max(1, Math.ceil(filteredOrders().length / pageSize));
    state.page = Math.min(totalPages, Math.max(1, state.page + direction));
    loadOrders();
  }

  function statusBadge(order) {
    const style = { 待处理: 'pending', 处理中: 'progress', 已完成: 'complete' }[order.status];
    return `<span class="status-badge ${style}"><span aria-hidden="true">●</span>${order.status}</span>`;
  }

  function renderCard(order) {
    const priority = { 高: 'high', 中: 'medium', 低: 'low' }[order.priority];
    return `<article class="order-card" aria-label="${order.id} ${order.title}" data-order="${order.id}">
      <div class="card-heading"><span class="order-id">${order.id}</span>${statusBadge(order)}</div>
      <h3>${order.title}</h3><dl class="card-facts"><div><dt>区域</dt><dd>${order.region}</dd></div><div><dt>优先级</dt><dd><span class="priority ${priority}">${order.priority}</span></dd></div><div><dt>负责人</dt><dd>${order.owner}</dd></div><div><dt>响应时限</dt><dd>${order.minutes}分钟</dd></div></dl>
      <footer class="card-footer"><span>设施运维</span><button class="detail-button" type="button">查看详情</button></footer>
    </article>`;
  }

  function loadOrders() {
    clearTimeout(listTimer);
    const list = $('order-list');
    const status = $('list-status');
    const pagination = $('pagination');
    const focusBeforeLoading = document.activeElement;
    list.setAttribute('aria-busy', 'true');
    list.replaceChildren();
    list.classList.add('is-loading');
    status.classList.add('loading');
    status.textContent = '正在加载工单…';
    $('query').disabled = true;
    $('previous-page').disabled = true;
    $('next-page').disabled = true;
    pagination.hidden = true;
    $('active-filters').textContent =
      Object.values(state.filters).filter(Boolean).join(' / ') || '全部工单';
    listTimer = setTimeout(() => {
      if (!list.isConnected) return;
      const results = filteredOrders();
      const pages = Math.max(1, Math.ceil(results.length / pageSize));
      state.page = Math.min(state.page, pages);
      const visible = results.slice((state.page - 1) * pageSize, state.page * pageSize);
      list.innerHTML = visible.length
        ? visible.map(renderCard).join('')
        : '<div class="empty-state panel"><h3>暂无符合条件的工单</h3><p class="muted">请调整筛选条件，或点击重置查看全部工单。</p></div>';
      list.classList.remove('is-loading');
      list.setAttribute('aria-busy', 'false');
      status.classList.remove('loading');
      status.textContent = visible.length
        ? `已加载${visible.length}条工单`
        : '查询完成，未找到工单';
      $('page-summary').textContent = `共${results.length}条 · 第${state.page}/${pages}页`;
      $('query').disabled = false;
      $('previous-page').disabled = state.page === 1;
      $('next-page').disabled = state.page === pages;
      pagination.hidden = false;
      // Disabling a focused pagination button must not lose keyboard context.
      if (document.activeElement === document.body && focusBeforeLoading?.isConnected) {
        if (focusBeforeLoading.disabled) {
          $('page-summary').tabIndex = -1;
          $('page-summary').focus({ preventScroll: true });
        } else focusBeforeLoading.focus({ preventScroll: true });
      }
    }, 450);
  }

  function setInert(element, value) {
    element.inert = value;
    if (value) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  }

  function topDialog() {
    if (!serviceLayer.hidden) return serviceDialog;
    if (!drawerLayer.hidden) return drawer;
    return null;
  }

  function focusables(dialog) {
    return [
      ...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'),
    ].filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.disabled &&
        !element.closest('[hidden], [inert]') &&
        element.getClientRects().length,
    );
  }

  function restoreFocus(element, fallback) {
    if (element?.isConnected && !element.closest('[inert], [hidden]') && !element.disabled)
      element.focus({ preventScroll: true });
    else fallback.focus({ preventScroll: true });
  }

  function openDrawer(order, trigger) {
    state.currentOrder = order;
    drawerTrigger = trigger;
    $('order-summary').innerHTML =
      `<div class="card-heading"><span class="order-id">${order.id}</span>${statusBadge(order)}</div><h3>${order.title}</h3><p class="muted">${order.region} · 负责人 ${order.owner}</p>`;
    const detailMinutes = order.id === 'WO-105' ? 30 : order.minutes;
    $('basic-panel').innerHTML =
      `<dl class="detail-facts"><div><dt>工单编号</dt><dd>${order.id}</dd></div><div><dt>工单标题</dt><dd>${order.title}</dd></div><div><dt>区域</dt><dd>${order.region}</dd></div><div><dt>优先级</dt><dd>${order.priority}</dd></div><div><dt>负责人</dt><dd>${order.owner}</dd></div><div><dt>状态</dt><dd>${order.status}</dd></div><div class="response-limit"><dt>响应时限</dt><dd>${detailMinutes}分钟</dd></div></dl>`;
    $('records-panel').replaceChildren();
    selectTab('basic');
    drawerLayer.hidden = false;
    document.body.classList.add('modal-open');
    $('close-drawer').focus();
    setInert(application, true);
    drawer.querySelector('.drawer-scroll').scrollTop = 0;
  }

  function closeService() {
    if (serviceLayer.hidden) return;
    movingFocus = true;
    setInert(drawerLayer, false);
    serviceLayer.hidden = true;
    restoreFocus(serviceTrigger, $('show-service'));
    movingFocus = false;
  }

  function closeDrawer(restore = true) {
    if (drawerLayer.hidden) return;
    if (!serviceLayer.hidden) closeService();
    movingFocus = true;
    drawerLayer.hidden = true;
    setInert(application, false);
    document.body.classList.remove('modal-open');
    state.currentOrder = null;
    if (restore) restoreFocus(drawerTrigger, main);
    movingFocus = false;
  }

  $('close-drawer').addEventListener('click', () => closeDrawer());
  $('show-service').addEventListener('click', (event) => {
    serviceTrigger = event.currentTarget;
    serviceLayer.hidden = false;
    $('close-service').focus();
    setInert(drawerLayer, true);
  });
  $('close-service').addEventListener('click', closeService);
  drawerLayer.addEventListener('click', (event) => {
    if (event.target === drawerLayer && serviceLayer.hidden) closeDrawer();
  });
  serviceLayer.addEventListener('click', (event) => {
    if (event.target === serviceLayer) closeService();
  });

  document.addEventListener('keydown', (event) => {
    const dialog = topDialog();
    if (event.key === 'Escape') {
      if (dialog) {
        event.preventDefault();
        if (dialog === serviceDialog) closeService();
        else closeDrawer();
      } else if (!menuLinks.hidden) {
        event.preventDefault();
        setMenu(false, true);
      }
      return;
    }
    if (!dialog || event.key !== 'Tab') return;
    const elements = focusables(dialog);
    const first = elements[0];
    const last = elements.at(-1);
    if (!first) {
      event.preventDefault();
      dialog.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || !elements.includes(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !elements.includes(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('focusin', (event) => {
    const dialog = topDialog();
    if (!movingFocus && dialog && !dialog.contains(event.target))
      (focusables(dialog)[0] || dialog).focus();
  });

  function selectTab(tab) {
    state.tab = tab;
    for (const name of ['basic', 'records']) {
      const selected = name === tab;
      $(`${name}-tab`).setAttribute('aria-selected', String(selected));
      $(`${name}-tab`).tabIndex = selected ? 0 : -1;
      $(`${name}-panel`).hidden = !selected;
    }
    if (tab === 'records') renderRecords();
  }
  for (const tab of ['basic', 'records']) {
    $(`${tab}-tab`).addEventListener('click', () => selectTab(tab));
    $(`${tab}-tab`).addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 'basic'
          : event.key === 'End'
            ? 'records'
            : tab === 'basic'
              ? 'records'
              : 'basic';
      selectTab(next);
      $(`${next}-tab`).focus();
    });
  }

  function renderRecords() {
    const panel = $('records-panel');
    panel.setAttribute('aria-busy', 'false');
    if (state.currentOrder?.id !== 'WO-107') {
      panel.innerHTML =
        '<div class="record-empty"><h3>暂无处理记录</h3><p class="muted">该工单暂未收录处理记录。</p></div>';
      return;
    }
    if (lightingRecords === 'unseen') lightingRecords = 'error';
    panel.setAttribute('aria-busy', String(lightingRecords === 'loading'));
    if (lightingRecords === 'error') {
      panel.innerHTML =
        '<div class="record-error"><h3 role="alert">处理记录暂时不可用</h3><p>读取失败，请重试。当前工单信息不受影响。</p><button id="retry-records" class="secondary-button" type="button">重试</button></div>';
      $('retry-records').addEventListener('click', retryRecords);
    } else if (lightingRecords === 'loading') {
      panel.innerHTML = '<p class="record-loading" role="status">正在加载处理记录…</p>';
    } else {
      panel.innerHTML =
        '<h3 class="records-heading">处理动态</h3><ol class="timeline"><li><p>2026-09-05 更换灯组</p><span class="muted">现场处理记录已同步</span></li></ol>';
    }
  }

  function retryRecords() {
    lightingRecords = 'loading';
    // Keep focus in the tab set when the retry button is replaced by feedback.
    $('records-tab').focus();
    renderRecords();
    retryTimer = setTimeout(() => {
      lightingRecords = 'ready';
      if (state.currentOrder?.id === 'WO-107' && state.tab === 'records') renderRecords();
    }, 350);
  }

  $('logout').addEventListener('click', () => {
    document.cookie = 'workorders_demo=; Path=/; SameSite=Lax; Max-Age=0';
    state.filters = emptyFilters();
    state.page = 1;
    if (location.hash === '#/home') renderRoute();
    else location.hash = '/home';
  });

  function renderRoute() {
    clearTimeout(listTimer);
    closeDrawer(false);
    setMenu(false);
    const authenticated = loggedIn();
    $('logout').hidden = !authenticated;
    const route = location.hash.slice(1) || '/home';
    for (const link of menuLinks.querySelectorAll('a')) {
      if (authenticated && link.hash === location.hash) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (!authenticated) renderLogin();
    else if (route === '/orders') renderOrders();
    else if (route === '/announcements') renderAnnouncements();
    else renderHome();
    document.title = `${!authenticated ? '登录' : route === '/orders' ? '工单中心' : route === '/announcements' ? '知识公告' : '首页'} · 工单协作台`;
    main.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('pagehide', () => {
    clearTimeout(listTimer);
    clearTimeout(retryTimer);
  });
  renderRoute();
})();
