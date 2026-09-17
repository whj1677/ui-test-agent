const app = document.querySelector('#app');
const dialogs = document.querySelector('#dialogs');
const categories = { 青岚站: { 检修工具: 60, 安全护具: 110 }, 远川站: { 办公耗材: 20 } };
let navOpen = false,
  generation = 0,
  step = 1,
  keyword = '',
  notice = '';
let draft = freshDraft();
function freshDraft() {
  return { name: '', project: '', applicant: '', category: '', quantity: '1' };
}
function html(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function loggedIn() {
  return document.cookie.split(';').some((c) => c.trim() === 'requests_demo=1');
}
function go(route) {
  if (location.hash === `#/${route}`) render();
  else location.hash = `/${route}`;
}
function button(name, fn, container = app) {
  container.querySelector(`[data-action="${name}"]`)?.addEventListener('click', fn);
}
function showDialog(title, contents) {
  const element = document.createElement('dialog');
  const id = `dialog-${dialogs.children.length}`;
  element.setAttribute('aria-labelledby', `${id}-title`);
  element.innerHTML = `<h2 id="${id}-title">${html(title)}</h2>${contents}`;
  dialogs.append(element);
  element.addEventListener('close', () => element.remove(), { once: true });
  element.showModal();
  return element;
}
async function api(method = 'GET', id, body) {
  const response = await fetch(`/api/requests${id ? `/${encodeURIComponent(id)}` : ''}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
}
function confirm(title, message, label, callback) {
  const dialog = showDialog(
    title,
    `<p>${html(message)}</p><p role="alert" class="error"></p><div class="actions"><button data-action="cancel">取消</button><button class="primary" data-action="confirm">${html(label)}</button></div>`,
  );
  button('cancel', () => dialog.close(), dialog);
  button(
    'confirm',
    async () => {
      const control = dialog.querySelector('[data-action=confirm]');
      control.disabled = true;
      try {
        await callback();
        dialog.close();
      } catch (error) {
        dialog.querySelector('[role=alert]').textContent = error.message;
        control.disabled = false;
      }
    },
    dialog,
  );
}
function render() {
  const token = ++generation;
  for (const dialog of [...dialogs.children].reverse()) {
    dialog.close();
  }
  if (!loggedIn()) {
    app.innerHTML = `<main class="panel login"><div class="eyebrow">LOCAL DEMO / PROCUREMENT</div><h1>采购申请工作台</h1><p class="muted">合成测试环境。申请数据只保存在当前演示服务器内存中，不连接真实业务。</p><button class="primary" data-action="login">进入演示</button></main>`;
    button('login', () => {
      document.cookie = 'requests_demo=1; Path=/; SameSite=Strict';
      go('home');
    });
    return;
  }
  const route = location.hash.slice(2) || 'home';
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="eyebrow">PROCUREMENT / DEMO</div><div class="brand">青岚采购协作</div><p class="muted">本机隔离 · 合成数据</p><nav aria-label="主导航"><a href="#/home" ${route === 'home' ? 'aria-current="page"' : ''}>首页</a><div><button data-action="nav" aria-expanded="${navOpen}" aria-controls="purchase-nav">采购管理</button><div id="purchase-nav" class="subnav" ${navOpen ? '' : 'hidden'}><a href="#/requests" ${route === 'requests' ? 'aria-current="page"' : ''}>申请记录</a></div></div></nav></aside><div class="workspace"><header class="topbar"><span>工作空间 / 合成申请站</span><button data-action="logout">退出登录</button></header><main class="content"></main></div></div>`;
  button('nav', () => {
    navOpen = !navOpen;
    app.querySelector('#purchase-nav').hidden = !navOpen;
    app.querySelector('[data-action=nav]').setAttribute('aria-expanded', String(navOpen));
  });
  button('logout', () => {
    document.cookie = 'requests_demo=; Max-Age=0; Path=/; SameSite=Strict';
    draft = freshDraft();
    keyword = '';
    notice = '';
    render();
  });
  if (route === 'requests') records(token);
  else if (route === 'new') wizard();
  else home();
}
function main() {
  return app.querySelector('main');
}
function home() {
  main().innerHTML = `<div class="page-heading"><div><div class="eyebrow muted">WORKSPACE</div><h1>采购申请工作台</h1><p class="muted">准备申请、核对明细，然后确认提交。</p></div></div><div class="home-grid"><section class="panel"><h2>让每一笔申请有据可查</h2><p>通过左侧采购管理进入申请记录。创建、编辑与清理只作用于此演示实例。</p><div class="actions"><a class="button" href="#/requests">查看申请记录</a></div></section><section class="panel"><h2>演示约定</h2><p class="muted">保留初始申请，核对目标名称后再操作。本页面不会自动提交表单。</p></section></div>`;
}
async function records(token) {
  main().innerHTML = `<div class="page-heading"><div><div class="eyebrow muted">PROCUREMENT</div><h1>申请记录</h1></div><div class="actions"><button data-action="help">使用说明</button><button class="primary" data-action="new">新建申请</button></div></div><div class="notice" role="status" ${notice ? '' : 'hidden'}>${html(notice)}</div><form class="panel filters"><label>申请关键字<input name="keyword" value="${html(keyword)}" placeholder="按申请名称查询"></label><button class="primary" type="submit">查询</button><button type="button" data-action="reset">重置</button></form><div id="records" aria-live="polite">正在加载申请…</div>`;
  button('help', () => {
    const d = showDialog(
      '试用说明',
      '<p>所有数据仅用于本机合成测试</p><form method="dialog" class="actions"><button class="primary">知道了</button></form>',
    );
    d.querySelector('button').focus();
  });
  button('new', () => {
    draft = freshDraft();
    step = 1;
    notice = '';
    go('new');
  });
  const load = async () => {
    const loadToken = ++generation;
    const box = app.querySelector('#records');
    if (!box) return;
    box.textContent = '正在加载申请…';
    try {
      const { records: all } = await api();
      if (loadToken !== generation || !box.isConnected) return;
      const matches = all.filter((r) => r.name.includes(keyword));
      box.innerHTML = matches.length
        ? `<p class="muted">共 ${matches.length} 条申请</p><ul class="record-list">${matches.map((r) => `<li class="record"><div><h2>${html(r.name)}</h2><p><span class="badge">${html(r.status)}</span></p><p class="muted">${html(r.project)} · ${html(r.category)} · ${html(r.applicant)}</p><p>数量 ${r.quantity} · 单价 ${r.unitPrice} · <strong>金额 ${r.total}</strong></p>${r.protected ? '<p class="muted">初始保留申请</p>' : ''}</div><div class="actions"><button data-id="${html(r.id)}" data-operation="edit">编辑</button><button class="danger" data-id="${html(r.id)}" data-operation="delete">删除</button></div></li>`).join('')}</ul>`
        : '<div class="panel empty">没有匹配的申请</div>';
      box.querySelectorAll('[data-operation]').forEach((control) =>
        control.addEventListener('click', () => {
          const row = matches.find((r) => r.id === control.dataset.id);
          if (control.dataset.operation === 'delete')
            confirm(
              '删除申请',
              `确认删除「${row.name}」？此操作不能撤销。`,
              '确认删除',
              async () => {
                await api('DELETE', row.id);
                notice = '删除成功';
                go('requests');
              },
            );
          else edit(row);
        }),
      );
    } catch (error) {
      if (loadToken === generation && box.isConnected) box.textContent = error.message;
    }
  };
  app.querySelector('form.filters').addEventListener('submit', (e) => {
    e.preventDefault();
    keyword = e.target.elements.keyword.value.trim();
    load();
  });
  button('reset', () => {
    keyword = '';
    app.querySelector('[name=keyword]').value = '';
    load();
  });
  if (token === generation) load();
}
function field(label, name, control) {
  return `<label for="field-${name}">${label}</label>${control}<span id="error-${name}" class="error" role="alert"></span>`;
}
function input(name, value, type = 'text') {
  return `<input id="field-${name}" name="${name}" value="${html(value)}" type="${type}" aria-describedby="error-${name}" ${type === 'text' ? 'maxlength="80"' : 'step="1"'}>`;
}
function options(items, value) {
  return `<option value="">请选择</option>${items.map((s) => `<option value="${html(s)}" ${s === value ? 'selected' : ''}>${html(s)}</option>`).join('')}`;
}
function displayedTotal() {
  return (
    Number(draft.quantity) *
    (draft.category === '安全护具' ? 100 : categories[draft.project]?.[draft.category] || 0)
  );
}
function wizard() {
  const titles = ['1 基本信息', '2 采购明细', '3 确认提交'];
  let fields;
  if (step === 1)
    fields = `<div class="full">${field('申请名称', 'name', input('name', draft.name))}</div><div>${field('项目', 'project', `<select id="field-project" name="project" aria-describedby="error-project">${options(Object.keys(categories), draft.project)}</select>`)}</div><div>${field('申请人', 'applicant', input('applicant', draft.applicant))}</div>`;
  else if (step === 2)
    fields = `<div>${field('品类', 'category', `<select id="field-category" name="category" aria-describedby="error-category">${options(Object.keys(categories[draft.project] || {}), draft.category)}</select>`)}</div><div>${field('数量', 'quantity', input('quantity', draft.quantity, 'number'))}</div><p class="muted full">数量范围：1 至 20。返回修改项目后，请重新选择品类。</p>`;
  else
    fields = `<dl class="summary full">${[
      ['申请名称', draft.name],
      ['项目', draft.project],
      ['申请人', draft.applicant],
      ['品类', draft.category],
      ['数量', draft.quantity],
      ['单价', categories[draft.project]?.[draft.category]],
      ['合计', displayedTotal()],
    ]
      .map(([k, v]) => `<dt>${k}</dt><dd${k === '合计' ? ' class="total"' : ''}>${html(v)}</dd>`)
      .join('')}</dl>`;
  main().innerHTML = `<div class="wizard"><div class="eyebrow muted">NEW REQUEST</div><h1>新建申请</h1><ol class="steps">${titles.map((title, i) => `<li ${i + 1 === step ? 'aria-current="step"' : ''}>${title}</li>`).join('')}</ol><section class="panel"><h2>${titles[step - 1]}</h2><form novalidate><div class="field-grid">${fields}</div><div class="actions"><button type="button" data-action="cancel">取消</button>${step > 1 ? '<button type="button" data-action="back">上一步</button>' : ''}<button class="primary" type="submit">${step === 3 ? '提交申请' : '下一步'}</button></div></form></section></div>`;
  const form = main().querySelector('form');
  for (const control of form.querySelectorAll('input,select'))
    control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (control.name === 'project' && control.value !== draft.project) draft.category = '';
      draft[control.name] = control.value;
    });
  button('cancel', () => {
    draft = freshDraft();
    notice = '';
    go('requests');
  });
  button('back', () => {
    step--;
    wizard();
    main().querySelector('h2').setAttribute('tabindex', '-1');
    main().querySelector('h2').focus();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errors = {};
    if (step === 1) {
      if (!draft.name.trim()) errors.name = '申请名称必填';
      if (!draft.project) errors.project = '项目必选';
      if (!draft.applicant.trim()) errors.applicant = '申请人必填';
    } else if (step === 2) {
      if (!draft.category) errors.category = '品类必选';
      if (
        !/^\d+$/.test(draft.quantity) ||
        Number(draft.quantity) < 1 ||
        Number(draft.quantity) > 20
      )
        errors.quantity = '数量必须是1至20的整数';
    }
    for (const control of form.querySelectorAll('input,select')) {
      const message = errors[control.name] || '';
      form.querySelector(`#error-${control.name}`).textContent = message;
      control.setAttribute('aria-invalid', String(!!message));
    }
    if (Object.keys(errors).length) {
      form.querySelector('[aria-invalid=true]').focus();
      return;
    }
    if (step < 3) {
      step++;
      wizard();
      main().querySelector('h2').setAttribute('tabindex', '-1');
      main().querySelector('h2').focus();
    } else
      confirm('提交申请', `请核对申请「${draft.name}」后提交。`, '确认提交', async () => {
        await api('POST', undefined, { ...draft, quantity: Number(draft.quantity) });
        notice = '提交成功';
        keyword = '';
        draft = freshDraft();
        go('requests');
      });
  });
}
function edit(row) {
  const d = showDialog(
    '编辑申请',
    `<p>${html(row.name)}</p><p class="muted">${html(row.project)} · ${html(row.category)}</p><form novalidate><label for="edit-quantity">数量</label><input id="edit-quantity" name="quantity" type="number" step="1" value="${row.quantity}" aria-describedby="edit-error"><p id="edit-error" role="alert" class="error"></p><div class="actions"><button type="button" data-action="cancel">取消</button><button class="primary" type="submit">保存</button></div></form>`,
  );
  button('cancel', () => d.close(), d);
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = Number(d.querySelector('input').value);
    if (!Number.isInteger(q) || q < 1 || q > 20) {
      d.querySelector('[role=alert]').textContent = '数量必须是1至20的整数';
      return;
    }
    confirm('保存修改', `将「${row.name}」的数量改为${q}？`, '确认保存', async () => {
      await api('PATCH', row.id, { quantity: q });
      notice = '保存成功';
      go('requests');
    });
  });
}
window.addEventListener('hashchange', render);
render();
