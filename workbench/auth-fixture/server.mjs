import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ACCOUNTS = new Map([
  ['inspector', { password: 'demo-inspector', role: 'inspector' }],
  ['supervisor', { password: 'demo-supervisor', role: 'supervisor' }],
]);
const TTL_MS = 15 * 60 * 1000;

function html(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...headers });
  response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>AUTH-01 独立登录样例</title><body>${body}</body></html>`);
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function form(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 2048) throw new Error('FORM_TOO_LARGE');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

export function createAuthFixture({ now = () => Date.now() } = {}) {
  const sessions = new Map();
  const handler = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const token = /(?:^|;\s*)auth01_session=([\w-]+)/.exec(request.headers.cookie || '')?.[1];
      const session = token ? sessions.get(token) : null;
      const active = session && session.expires_at > now() ? session : null;
      if (session && !active) sessions.delete(token);
      if (request.method === 'GET' && url.pathname === '/login') {
        return html(response, 200, '<h1>AUTH-01 独立合成登录</h1><p>仅供本机工程验证，不是真实公司系统。</p>' +
          '<form method="post" action="/login"><label>账号<input name="account" autocomplete="username"></label>' +
          '<label>密码<input name="password" type="password" autocomplete="current-password"></label>' +
          '<button type="submit">登录</button></form>');
      }
      if (request.method === 'POST' && url.pathname === '/login') {
        const data = await form(request);
        const account = String(data.get('account') || '');
        const match = ACCOUNTS.get(account);
        if (!match || match.password !== data.get('password')) return html(response, 401, '<h1>账号或密码错误</h1><a href="/login">返回登录</a>');
        const id = randomUUID();
        sessions.set(id, { account_id: account, role: match.role, expires_at: now() + TTL_MS });
        response.writeHead(303, { location: '/protected', 'set-cookie': `auth01_session=${id}; HttpOnly; SameSite=Lax; Path=/`, 'cache-control': 'no-store' });
        return response.end();
      }
      if (request.method === 'GET' && url.pathname === '/api/identity') {
        return active ? json(response, 200, { authenticated: true, account_id: active.account_id, role: active.role,
          expires_at: new Date(active.expires_at).toISOString() }) : json(response, 401, { authenticated: false });
      }
      if (request.method === 'GET' && url.pathname === '/api/admin') {
        if (!active) return json(response, 401, { authenticated: false });
        if (active.role !== 'supervisor') return json(response, 403, { error: 'PERMISSION_DENIED' });
        return json(response, 200, { authenticated: true, account_id: active.account_id, role: active.role,
          expires_at: new Date(active.expires_at).toISOString() });
      }
      if (request.method === 'GET' && url.pathname === '/protected') {
        if (!active) { response.writeHead(303, { location: '/login' }); return response.end(); }
        return html(response, 200, `<h1>受保护设备台账样例</h1><p data-testid="account">账号：${active.account_id}</p><p data-testid="role">角色：${active.role}</p><p data-testid="protected-value">设备 DEV-AUTH-01</p><form method="post" action="/logout"><button>退出登录</button></form>`);
      }
      if (request.method === 'POST' && url.pathname === '/api/expire') {
        if (!active) return json(response, 401, { error: 'NOT_LOGGED_IN' });
        sessions.delete(token);
        return json(response, 200, { expired: true });
      }
      if (request.method === 'POST' && url.pathname === '/logout') {
        if (token) sessions.delete(token);
        response.writeHead(303, { location: '/login', 'set-cookie': 'auth01_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
        return response.end();
      }
      json(response, 404, { error: 'NOT_FOUND' });
    } catch {
      json(response, 400, { error: 'INVALID_REQUEST' });
    }
  });
  return {
    server: handler,
    async listen(port = 4330) {
      await new Promise((resolve, reject) => handler.once('error', reject).listen(port, '127.0.0.1', resolve));
      return `http://127.0.0.1:${handler.address().port}`;
    },
    async close() { await new Promise((resolve) => handler.close(resolve)); },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = createAuthFixture();
  const address = await fixture.listen(Number(process.env.AUTH01_FIXTURE_PORT || 4330));
  console.log(`AUTH-01 fixture ${address}/login`);
}
