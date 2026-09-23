const DEVICES = Object.freeze([
  { id:'DEV-001', name:'循环泵一号', station:'东站', status:'运行', power:80, model:'CP-80', installed:'2024-03-12', note:'例行巡检正常' },
  { id:'DEV-002', name:'循环泵二号', station:'西站', status:'检修', power:120, model:'CP-120', installed:'2023-11-08', note:'计划检修中' },
  { id:'DEV-003', name:'风机一号', station:'东站', status:'检修', power:60, model:'FN-60', installed:'2024-01-20', note:'轴承温度待复核' },
  { id:'DEV-004', name:'空压机', station:'西站', status:'运行', power:95, model:'AC-95', installed:'2022-09-18', note:'运行稳定' },
  { id:'DEV-005', name:'冷却泵', station:'西站', status:'检修', power:220, model:'CP-220', installed:'2023-06-05', note:'历史额定功率记录：220 kW' },
  { id:'DEV-006', name:'排水泵', station:'东站', status:'运行', power:140, model:'DP-140', installed:'2024-05-16', note:'运行稳定' },
]);

const route = location.pathname.match(/^\/ui\/([a-f])\/?$/)?.[1] || 'a';
const profile = {
  a:{ label:'A · 组合查询正常入口' }, b:{ label:'B · 组合查询故障入口', ignoreStatus:true },
  c:{ label:'C · 功率排序正常入口' }, d:{ label:'D · 功率排序故障入口', swapSortedRows:true },
  e:{ label:'E · 设备详情正常入口' }, f:{ label:'F · 设备详情故障入口', wrongDetailPower:true },
}[route];

const controls = {
  station:document.querySelector('#station-filter'), status:document.querySelector('#status-filter'), sort:document.querySelector('#sort-filter'),
  query:document.querySelector('#query-button'), reset:document.querySelector('#reset-button'), rows:document.querySelector('#device-rows'),
  count:document.querySelector('#result-count'), modal:document.querySelector('#modal-root'), badge:document.querySelector('#route-badge'),
};
controls.badge.textContent = profile.label;
let rendered = [...DEVICES];

function renderRows() {
  controls.count.textContent = `共${rendered.length}条`;
  controls.rows.innerHTML = rendered.map((device) => `<tr data-device-id="${device.id}">
    <td>${device.id}</td><td>${device.name}</td><td>${device.station}</td>
    <td><span class="status ${device.status === '检修' ? 'maintenance' : ''}">${device.status}</span></td>
    <td class="number">${device.power} kW</td><td><button class="detail-button" type="button" data-detail="${device.id}">详情</button></td>
  </tr>`).join('');
}

function query() {
  const station = controls.station.value;
  const status = controls.status.value;
  rendered = DEVICES.filter((device) => (station === 'ALL' || device.station === station) && (profile.ignoreStatus || status === 'ALL' || device.status === status));
  rendered.sort(controls.sort.value === 'POWER_DESC' ? (left,right) => right.power - left.power : (left,right) => left.id.localeCompare(right.id));
  if (profile.swapSortedRows && controls.sort.value === 'POWER_DESC' && rendered.length >= 3) [rendered[1], rendered[2]] = [rendered[2], rendered[1]];
  renderRows();
}

function reset() {
  controls.station.value = 'ALL'; controls.status.value = 'ALL'; controls.sort.value = 'ID_ASC'; rendered = [...DEVICES]; renderRows();
}

function openDetail(id) {
  const device = DEVICES.find((item) => item.id === id);
  const shownPower = profile.wrongDetailPower && id === 'DEV-005' ? 320 : device.power;
  controls.modal.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
    <header><h2 id="detail-title">设备详情 · ${device.id}</h2><button class="icon-button" type="button" data-close aria-label="关闭详情">×</button></header>
    <dl class="detail-grid"><div><dt>设备编号</dt><dd data-field="id">${device.id}</dd></div><div><dt>设备名称</dt><dd data-field="name">${device.name}</dd></div><div><dt>所属站点</dt><dd data-field="station">${device.station}</dd></div><div><dt>状态</dt><dd data-field="status">${device.status}</dd></div><div><dt>额定功率</dt><dd data-field="power">${shownPower} kW</dd></div><div><dt>设备型号</dt><dd data-field="model">${device.model}</dd></div><div><dt>投运日期</dt><dd>${device.installed}</dd></div><div><dt>历史备注</dt><dd data-field="note">${device.note}</dd></div></dl>
    <footer><button type="button" data-close>关闭</button></footer></section></div>`;
}

controls.query.addEventListener('click', query);
controls.reset.addEventListener('click', reset);
controls.rows.addEventListener('click', (event) => { const button = event.target.closest('[data-detail]'); if (button) openDetail(button.dataset.detail); });
controls.modal.addEventListener('click', (event) => { if (event.target.closest('[data-close]') || event.target.classList.contains('modal-backdrop')) controls.modal.replaceChildren(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') controls.modal.replaceChildren(); });
renderRows();
