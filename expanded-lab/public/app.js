// Synthetic site implementation. Grading files and expected outcomes are never served.
const main = document.querySelector('main');
const names = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2'];
const current = location.pathname.split('/').at(-1);
document.querySelector('#entries').innerHTML = names
  .map(
    (n, i) =>
      `<a href="/site/${n}" ${current === n ? 'aria-current="page"' : ''}>资产视图 ${i + 1}</a>`,
  )
  .join('');
const assets = [
  { id: 'D001', name: '储能柜', park: '北园', power: '100 kW' },
  { id: 'D009', name: '储能柜', park: '南园', power: '200 kW' },
];
function modal(name, html, drawer = false) {
  const d = document.createElement('dialog');
  d.setAttribute('aria-label', name);
  if (drawer) d.className = 'drawer';
  d.innerHTML = html;
  document.body.append(d);
  const prior = document.activeElement;
  d.addEventListener(
    'close',
    () => {
      d.remove();
      if (prior?.isConnected) prior.focus();
    },
    { once: true },
  );
  d.showModal();
  return d;
}
function openDetails(asset) {
  const shown = { ...asset };
  if (asset.id === 'D009') {
    if (current === 'a2') shown.power = '120 kW';
    if (current === 'b2') {
      shown.name = '南园';
      shown.park = '储能柜';
    }
    if (current === 'c2') shown.id = 'D001';
  }
  const d = modal(
    '设备详情',
    `<h2>${shown.id}</h2><p class="muted">资产详情 / 基本信息</p><section aria-label="基本信息" class="pending" aria-busy="true">正在读取详情…</section><div class="actions"><button type="button" data-notice>读取说明</button><button type="button" data-close>关闭详情</button></div>`,
    true,
  );
  const section = d.querySelector('section');
  const timer = setTimeout(() => {
    if (!d.isConnected) return;
    section.classList.remove('pending');
    section.setAttribute('aria-busy', 'false');
    if (current.startsWith('b'))
      section.innerHTML = `<table aria-label="当前设备属性"><thead><tr><th>字段</th><th>值</th></tr></thead><tbody><tr><td>园区</td><td>${shown.park}</td></tr><tr><td>额定功率</td><td>${shown.power}</td></tr><tr><td>名称</td><td>${shown.name}</td></tr></tbody></table>`;
    else
      section.innerHTML = `<dl class="fields"><dt>名称</dt><dd data-field="name">${shown.name}</dd><dt>园区</dt><dd data-field="park">${shown.park}</dd><dt>额定功率</dt><dd data-field="power">${shown.power}</dd></dl>`;
    section.insertAdjacentHTML(
      'beforeend',
      '<aside class="note" aria-label="历史备注">历史备注：设计方案曾提及200 kW，仅供追溯，不是当前设备额定功率。</aside>',
    );
    if (current.startsWith('c'))
      section.insertAdjacentHTML(
        'beforeend',
        `<aside class="note" aria-label="关联设备">关联设备：${current === 'c2' ? 'D009' : 'D001'}，关联编号不是当前详情对象。</aside>`,
      );
  }, 300);
  d.addEventListener('close', () => clearTimeout(timer), { once: true });
  d.querySelector('[data-close]').onclick = () => d.close();
  d.querySelector('[data-notice]').onclick = () => {
    const child = modal(
      '读取说明',
      '<h2>读取说明</h2><p>读数每60秒更新</p><p class="muted">关闭此说明后返回当前设备详情。</p><div class="actions"><button type="button">关闭说明</button></div>',
    );
    // Make the intended fault observable in the same transition as dismissal.
    // A queued close listener otherwise introduces an unrelated sampling race.
    const dismiss = () => {
      if (current === 'd2' && d.isConnected && !d.querySelector('.interceptor')) {
        const cover = document.createElement('div');
        cover.className = 'interceptor';
        cover.setAttribute('aria-hidden', 'true');
        d.querySelector('.actions').append(cover);
      }
      child.close();
    };
    child.querySelector('button').onclick = dismiss;
    child.addEventListener('cancel', (event) => {
      event.preventDefault();
      dismiss();
    });
  };
}
if (!names.includes(current)) {
  main.innerHTML =
    '<h1>运营总览</h1><p class="muted">巡维资产工作台 · 离线只读合成站点，无需账号</p><div class="metrics"><div class="card">资产数量<strong>2</strong></div><div class="card">园区数量<strong>2</strong></div><div class="card">资产视图<strong>8</strong></div></div><section class="card"><h2>业务入口</h2><p>选择资产视图进入列表，可查询设备、查看详情和读取说明。</p><div class="grid-links">' +
    names.map((n, i) => `<a href="/site/${n}">资产视图 ${i + 1}</a>`).join('') +
    '</div></section>';
} else {
  main.innerHTML =
    '<h1>资产设备</h1><p class="muted">设备档案 / 当前资产</p><section class="card"><div class="toolbar"><label for="keyword">关键词</label><input id="keyword" placeholder="编号或名称"><button class="primary" type="button" id="query">查询</button><button type="button" id="reset">重置</button></div><p role="status" id="count"></p><div class="table-scroll"><table aria-label="资产列表"><thead><tr><th>编号</th><th>名称</th><th>园区</th><th>额定功率</th><th>操作</th></tr></thead><tbody></tbody></table></div></section>';
  const render = () => {
    const q = document.querySelector('#keyword').value;
    const filtered = assets.filter((a) => a.id.includes(q) || a.name.includes(q));
    document.querySelector('#count').textContent = `共${filtered.length}条`;
    document.querySelector('tbody').innerHTML = filtered
      .map(
        (a) =>
          `<tr><td>${a.id}</td><td>${a.name}</td><td>${a.park}</td><td>${a.power}</td><td><button type="button" data-id="${a.id}">详情</button></td></tr>`,
      )
      .join('');
    document
      .querySelectorAll('[data-id]')
      .forEach((b) => (b.onclick = () => openDetails(assets.find((a) => a.id === b.dataset.id))));
  };
  document.querySelector('#query').onclick = render;
  document.querySelector('#reset').onclick = () => {
    document.querySelector('#keyword').value = '';
    render();
  };
  render();
}
