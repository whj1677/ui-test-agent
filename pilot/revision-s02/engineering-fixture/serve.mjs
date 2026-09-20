import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const initial = [
  ['H101', '循环泵', '东站', '巡检', '80 kW'],
  ['H102', '循环泵', '西站', '检修', '120 kW'],
  ['H103', '送风机', '东站', '检修', '100 kW'],
];
const page1 = [
  ['H107', '离心风机', '东站', '巡检', '300 kW'],
  ['H111', '压缩机', '西站', '检修', '260 kW'],
  ['H106', '循环泵', '西站', '检修', '220 kW'],
];
const page2 = [
  ['H112', '轴流风机', '西站', '巡检', '200 kW'],
  ['H109', '加药装置', '东站', '巡检', '180 kW'],
  ['H105', '补水泵', '东站', '巡检', '140 kW'],
];
const rowHtml = (row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}<td><button>详情</button></td></tr>`;
const page = (mode) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>S02工程夹具</title></head><body>
<main><h1>巡检任务台账</h1><label>排序<select id="sort"><option value="id-asc">编号升序</option><option value="power-desc">功率降序</option></select></label>
<button id="query">查询</button><div id="counter">共12条 · 第1/4页</div>
<table aria-label="巡检任务列表"><thead><tr><th>编号</th><th>对象名称</th><th>所属站点</th><th>任务类型</th><th>额定功率</th><th>操作</th></tr></thead><tbody></tbody></table>
<button id="next">下一页</button></main><script>
const initial=${JSON.stringify(initial)}, page1=${JSON.stringify(page1)}, page2=${JSON.stringify(page2)}, mode=${JSON.stringify(mode)};
const body=document.querySelector('tbody'), counter=document.querySelector('#counter');
const render=(rows)=>{body.innerHTML=rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'<td><button>详情</button></td></tr>').join('')};
render(initial);
document.querySelector('#sort').addEventListener('change',()=>{if(mode==='extra')render([...initial,['H999','新增对象','东站','巡检','1 kW']])});
document.querySelector('#query').addEventListener('click',()=>{render(page1);counter.textContent='共12条 · 第1/4页'});
document.querySelector('#next').addEventListener('click',()=>{render(page2);counter.textContent='共12条 · 第2/4页'});
</script></body></html>`;

export async function startEngineeringFixture(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') { res.writeHead(200, {'content-type':'application/json'}); return res.end('{"site":"s02-engineering-fixture"}'); }
    if (!['/normal', '/extra'].includes(url.pathname)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    res.end(page(url.pathname.slice(1)));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = await startEngineeringFixture(Number(process.argv[2] || 4207));
  console.log(fixture.baseUrl);
}
