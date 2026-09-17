import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const COOKIE = 'fixture_session';
const RATES = Object.freeze([
  Object.freeze({ name: '工业日间方案', period: '08:00—22:00', price: '0.68元/度', status: '启用' }),
  // Frozen fixture defect. The independently frozen case expects 0.32.
  Object.freeze({ name: '工业夜间方案', period: '22:00—08:00', price: '0.23元/度', status: '启用' }),
]);

const CSS = `
:root{font-family:"Microsoft YaHei","Segoe UI",sans-serif;color:#1e293b;background:#f3f6fb;color-scheme:light}
*{box-sizing:border-box}body{margin:0}button,input{font:inherit}button,a{touch-action:manipulation}
button{cursor:pointer}a{color:inherit}button:focus-visible,a:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}
[hidden]{display:none!important}.layout{display:flex;min-height:100vh}.sidebar{width:236px;flex-shrink:0;background:#122239;color:#dce6f4;padding:30px 18px}
.brand{font-size:20px;font-weight:700;padding:0 12px;margin-bottom:6px}.brand-sub{color:#97abc6;font-size:12px;padding:0 12px;margin-bottom:38px;letter-spacing:2px}
nav ul{list-style:none;margin:0;padding:0}nav li{margin:6px 0}.nav-link,.menu-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 14px;border:0;border-radius:8px;background:transparent;color:inherit;text-decoration:none;text-align:left;font-size:14px}
.nav-link:hover,.menu-toggle:hover{background:#203954}.nav-link[aria-current=page]{background:#2463df;color:#fff}.submenu{padding-left:18px}
.menu-toggle span{color:#91a6c2}.menu-toggle[aria-expanded=true] span{transform:rotate(90deg)}.main-area{min-width:0;flex:1}
.topbar{height:76px;background:#fff;border-bottom:1px solid #e4eaf3;display:flex;align-items:center;justify-content:space-between;padding:0 34px}.topbar-title{font-weight:600;font-size:15px}.account{display:flex;gap:22px;align-items:center;font-size:13px;color:#52627b}
.secondary{background:#fff;border:1px solid #d5dfeb;border-radius:7px;padding:8px 14px;color:#405570}.secondary:hover{background:#f2f6fc}
main{padding:34px}.breadcrumb{font-size:12px;color:#718199;margin:0 0 12px}h1{font-size:25px;margin:0 0 12px;letter-spacing:.4px}.subtitle{color:#6b7b91;font-size:14px;margin:0 0 28px}
.card{background:#fff;border:1px solid #e2e8f1;border-radius:12px;padding:28px;box-shadow:0 3px 12px #19334d06}.card h2{margin:0 0 12px;font-size:18px}.card p{line-height:1.9;color:#61718a}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-top:24px}.module-index{font-size:12px;color:#3973de;letter-spacing:1px;margin-bottom:18px}
.table-card{padding:0;overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap;text-align:left}caption{text-align:left;padding:23px 26px;font-size:15px;font-weight:600;border-bottom:1px solid #e7edf4}
th,td{padding:20px 26px;border-bottom:1px solid #edf1f6;font-size:14px}th{background:#f8fafd;color:#728097;font-size:12px;font-weight:600}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fbfcff}td:first-child{font-weight:600}
.status{display:inline-block;color:#1c7d58;background:#e9f6ee;border-radius:5px;padding:4px 10px;font-size:12px}.detail-button{border:0;background:#eef4ff;color:#2661ce;border-radius:6px;padding:8px 13px;font-size:13px}.detail-button:hover{background:#e2ecff}
dialog{border:1px solid #e0e7f1;border-radius:14px;padding:30px;width:min(440px,calc(100vw - 40px));color:#22324c;box-shadow:0 24px 80px #12223933}dialog::backdrop{background:#13233d80}dialog h2{font-size:21px;margin:0 0 22px}dialog p{font-size:14px;line-height:1.9;color:#64748b}dl{margin:0 0 26px}dl div{display:grid;grid-template-columns:90px 1fr;padding:13px 0;border-bottom:1px solid #edf1f6}dt{color:#738199;font-size:14px}dd{margin:0;font-size:14px;font-weight:500}.dialog-actions{text-align:right}.primary{background:#2463df;color:#fff;border:0;border-radius:7px;padding:10px 24px}.primary:hover{background:#1e53c2}
.login-wrap{min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at 25% 20%,#e1edff,transparent 55%),#f4f7fc}.login-card{width:min(420px,calc(100vw - 40px));padding:38px;background:#fff;border:1px solid #e0e8f4;border-radius:16px;box-shadow:0 18px 60px #26477912}.login-brand{font-size:12px;letter-spacing:3px;color:#376dd3;margin-bottom:28px}.login-card h1{font-size:25px}.login-card .subtitle{line-height:1.7}.field{margin:20px 0}.field label{display:block;font-size:13px;margin-bottom:9px}.field input{width:100%;border:1px solid #d5dfeb;border-radius:7px;padding:11px 12px;outline:none}.field input:focus{border-color:#3977eb;box-shadow:0 0 0 3px #3977eb18}.login-card .primary{width:100%;margin-top:8px}.error{font-size:13px;color:#b42318;background:#fff0ed;border-radius:6px;padding:10px}
@media(max-width:800px){.sidebar{width:185px;padding:24px 10px}.brand{font-size:17px}.topbar{padding:0 20px}main{padding:24px 20px}.cards{grid-template-columns:1fr}th,td{padding:16px}.account{gap:12px}}
`;

function htmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function page(title, body, script = '') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlEscape(title)} · 运营工作台</title><link rel="icon" href="/favicon.ico"><style>${CSS}</style></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`;
}

function loginPage(autoLoginDelayMs, error = '') {
  const body = `<main class="login-wrap"><form class="login-card" method="post" action="/login" id="login-form">
    <div class="login-brand">运营管理平台</div><h1>登录工作台</h1><p class="subtitle">欢迎回来，请登录以访问运营服务。</p>
    ${error ? `<p class="error" role="alert">${htmlEscape(error)}</p>` : ''}
    <div class="field"><label for="username">用户名</label><input id="username" name="username" autocomplete="off" required></div>
    <div class="field"><label for="password">密码</label><input id="password" name="password" type="password" autocomplete="off" required></div>
    <button class="primary" type="submit">登录</button></form></main>`;
  // The optional driver uses this exact form; it has no business navigation code.
  const script = autoLoginDelayMs > 0 && !error ? `
    const form = document.getElementById('login-form');
    const timer = setTimeout(() => {
      form.elements.username.value = 'tester';
      form.elements.password.value = 'demo-only';
      form.requestSubmit();
    }, ${autoLoginDelayMs});
    ['pointerdown', 'keydown', 'input', 'submit'].forEach(type => {
      form.addEventListener(type, () => clearTimeout(timer), { once: true });
    });` : '';
  return page('登录', body, script);
}

const MENU_SCRIPT = `
  document.querySelectorAll('.menu-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      document.getElementById(button.getAttribute('aria-controls')).hidden = !expanded;
    });
  });`;

function businessPage(kind, showNotice = false) {
  const isBilling = kind === 'billing';
  const isReports = kind === 'reports';
  const title = isBilling ? '费率目录' : isReports ? '用量报表' : '工作台';
  const body = `<div class="layout"><aside class="sidebar"><div class="brand">运营工作台</div><div class="brand-sub">资产 · 服务 · 运营</div>
    <nav aria-label="主导航"><ul>
      <li><a class="nav-link" href="/dashboard" ${kind === 'dashboard' ? 'aria-current="page"' : ''}>工作台</a></li>
      <li><button type="button" class="menu-toggle" aria-expanded="${isBilling}" aria-controls="asset-menu">资产运营<span aria-hidden="true">›</span></button>
        <ul class="submenu" id="asset-menu" ${isBilling ? '' : 'hidden'}><li><a class="nav-link" href="/billing" ${isBilling ? 'aria-current="page"' : ''}>计费中心</a></li></ul></li>
      <li><button type="button" class="menu-toggle" aria-expanded="${isReports}" aria-controls="report-menu">报表中心<span aria-hidden="true">›</span></button>
        <ul class="submenu" id="report-menu" ${isReports ? '' : 'hidden'}><li><a class="nav-link" href="/reports" ${isReports ? 'aria-current="page"' : ''}>用量报表</a></li></ul></li>
    </ul></nav></aside><div class="main-area"><header class="topbar"><div class="topbar-title">运营管理平台</div><div class="account"><span>测试用户</span><form method="post" action="/logout"><button class="secondary" type="submit">退出登录</button></form></div></header>
    <main><p class="breadcrumb">${isBilling ? '资产运营 / 计费中心' : isReports ? '报表中心 / 用量报表' : '首页'}</p><h1>${title}</h1>
      ${isBilling ? `<p class="subtitle">查看当前启用的计费方案与时段信息。</p><section class="card table-card"><table aria-label="费率目录"><caption>计费方案</caption><thead><tr>${['方案名称', '时段', '单价', '状态', '操作'].map(name => `<th scope="col">${name}</th>`).join('')}</tr></thead><tbody>
        ${RATES.map((rate, index) => `<tr><td>${rate.name}</td><td>${rate.period}</td><td>${rate.price}</td><td><span class="status">${rate.status}</span></td><td><button class="detail-button" type="button" value="${index}">查看详情</button></td></tr>`).join('')}
      </tbody></table></section>` : isReports ? '<p class="subtitle">查看运营用量信息。</p><section class="card"><h2>用量概览</h2><p>暂无用量记录。</p></section>' : '<p class="subtitle">欢迎使用运营工作台，请从左侧导航选择业务模块。</p><section class="card"><h2>今天，从这里开始</h2><p>集中查看资产服务与运营信息。</p></section><div class="cards"><section class="card"><div class="module-index">01 / ASSET</div><h2>资产运营</h2><p>管理计费方案，查看方案时段与单价。</p></section><section class="card"><div class="module-index">02 / REPORT</div><h2>报表中心</h2><p>浏览运营用量，了解业务概况。</p></section></div>'}
    </main></div></div>
    ${isBilling ? `<dialog id="rate-detail" aria-labelledby="detail-title"><h2 id="detail-title">方案详情</h2><dl><div><dt>方案名称</dt><dd id="detail-name"></dd></div><div><dt>时段</dt><dd id="detail-period"></dd></div><div><dt>单价</dt><dd id="detail-price"></dd></div></dl><form method="dialog" class="dialog-actions"><button class="primary">关闭</button></form></dialog>` : ''}
    ${showNotice ? '<dialog id="usage-notice" aria-labelledby="notice-title"><h2 id="notice-title">使用提示</h2><p>欢迎使用计费中心。选择方案右侧的“查看详情”，可查看完整的时段与单价信息。</p><form method="dialog" class="dialog-actions"><button class="primary">知道了</button></form></dialog>' : ''}`;
  return page(title, body, MENU_SCRIPT + (isBilling ? `
    const rates = ${JSON.stringify(RATES)};
    const detail = document.getElementById('rate-detail');
    document.querySelectorAll('.detail-button').forEach(button => {
      button.addEventListener('click', () => {
        const rate = rates[Number(button.value)];
        document.getElementById('detail-name').textContent = rate.name;
        document.getElementById('detail-period').textContent = rate.period;
        document.getElementById('detail-price').textContent = rate.price;
        detail.showModal();
      });
    });` : '') + (showNotice ? `
    const notice = document.getElementById('usage-notice');
    notice.addEventListener('cancel', event => event.preventDefault());
    notice.showModal();` : ''));
}

function sessionId(req) {
  return (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
}

async function readForm(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 4096) throw new Error('FORM_TOO_LARGE');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function send(res, status, body, contentType = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(303, { location });
  res.end();
}

export async function startFixture({ port = 0, mode = 'normal', autoLoginDelayMs = 0 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port must be an integer from 0 to 65535');
  if (!['normal', 'obstacle'].includes(mode)) throw new Error('mode must be normal or obstacle');
  if (!Number.isInteger(autoLoginDelayMs) || autoLoginDelayMs < 0 || autoLoginDelayMs > 2147483647) throw new Error('autoLoginDelayMs must be a non-negative timer integer');
  const sessions = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const sid = sessionId(req);
      const session = sessions.get(sid);
      if (req.method === 'GET' && pathname === '/health') {
        send(res, 200, JSON.stringify({ mode, ready: true }), 'application/json; charset=utf-8');
        return;
      }
      if (req.method === 'GET' && pathname === '/favicon.ico') {
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'GET' && pathname === '/login') {
        if (session) redirect(res, '/dashboard');
        else send(res, 200, loginPage(autoLoginDelayMs));
        return;
      }
      if (req.method === 'POST' && pathname === '/login') {
        const form = await readForm(req);
        if (form.get('username') !== 'tester' || form.get('password') !== 'demo-only') {
          send(res, 401, loginPage(0, '用户名或密码错误'));
          return;
        }
        if (sid) sessions.delete(sid);
        const nextId = randomBytes(32).toString('hex');
        sessions.set(nextId, { noticeSeen: false });
        res.setHeader('set-cookie', `${COOKIE}=${nextId}; HttpOnly; SameSite=Strict; Path=/`);
        redirect(res, '/dashboard');
        return;
      }
      if (req.method === 'POST' && pathname === '/logout') {
        sessions.delete(sid);
        res.setHeader('set-cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
        redirect(res, '/login');
        return;
      }
      if (['/', '/dashboard', '/billing', '/reports'].includes(pathname)) {
        if (!session) { redirect(res, '/login'); return; }
        if (req.method !== 'GET') { send(res, 405, '不支持的请求方法', 'text/plain; charset=utf-8'); return; }
        if (pathname === '/') { redirect(res, '/dashboard'); return; }
        const showNotice = pathname === '/billing' && mode === 'obstacle' && !session.noticeSeen;
        if (showNotice) session.noticeSeen = true;
        send(res, 200, businessPage(pathname.slice(1), showNotice));
        return;
      }
      send(res, 404, '页面不存在', 'text/plain; charset=utf-8');
    } catch (error) {
      if (!res.headersSent) send(res, error.message === 'FORM_TOO_LARGE' ? 413 : 500, '请求处理失败', 'text/plain; charset=utf-8');
      else res.end();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolveListen();
    });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  let closing;
  return {
    server,
    url,
    close() {
      closing ??= new Promise((resolveClose, reject) => {
        sessions.clear();
        server.close(error => error ? reject(error) : resolveClose());
        server.closeAllConnections();
      });
      return closing;
    },
  };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(modulePath).href) {
  try {
    const options = { port: 4188, mode: 'normal', autoLoginDelayMs: 0 };
    const names = { '--port': 'port', '--mode': 'mode', '--auto-login-ms': 'autoLoginDelayMs' };
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
      const name = names[args[i]];
      if (!name || args[i + 1] === undefined) throw new Error('Usage: node server.mjs --port 4188 --mode normal|obstacle --auto-login-ms 0');
      options[name] = name === 'mode' ? args[i + 1] : Number(args[i + 1]);
    }
    const fixture = await startFixture(options);
    console.log(JSON.stringify({ status: 'READY', url: fixture.url, mode: options.mode, auto_login: options.autoLoginDelayMs > 0 ? 'test-driver-only' : 'disabled' }));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await fixture.close(); });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
