import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export const sites = ['devices', 'work-orders', 'requests'];
const routes = new Set([
  '/',
  '/login',
  '/home',
  '/devices',
  '/devices/new',
  '/devices/legacy',
  '/inspect',
  '/overview',
]);
const catalog = { 青岚站: { 检修工具: 60, 安全护具: 110 }, 远川站: { 办公耗材: 20 } };
const seeds = [
  {
    id: 'seed-1',
    name: '例行工具申请',
    project: '青岚站',
    applicant: '演示管理员',
    category: '检修工具',
    quantity: 1,
    unitPrice: 60,
    total: 60,
    status: '待审批',
    protected: true,
  },
  {
    id: 'seed-2',
    name: '回归专用申请甲（勿删）',
    project: '远川站',
    applicant: '演示管理员',
    category: '办公耗材',
    quantity: 2,
    unitPrice: 20,
    total: 40,
    status: '待审批',
    protected: true,
  },
];
function problem(status, message) {
  return Object.assign(new Error(message), { status });
}
async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))
    throw problem(415, '仅接受JSON');
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 8192) throw problem(413, '请求过大');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw problem(400, 'JSON格式错误');
  }
}
function quantity(value) {
  if (!Number.isInteger(value) || value < 1 || value > 20)
    throw problem(400, '数量必须是1至20的整数');
  return value;
}

// This is an isolated synthetic target, not the Agent server or an oracle API.
export async function startFixture({ site = 'requests', port = 0 } = {}) {
  if (!sites.includes(site)) throw new Error('Unknown fixture site');
  let rows = structuredClone(seeds);
  let sequence = 0;
  const mutations = [];
  let origin;
  const server = http.createServer(async (req, res) => {
    const send = (status, payload, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, {
        'content-type': type,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': `default-src 'self'; script-src 'self'${site === 'devices' ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`,
      });
      res.end(
        req.method === 'HEAD'
          ? undefined
          : typeof payload === 'string' || Buffer.isBuffer(payload)
            ? payload
            : JSON.stringify(payload),
      );
    };
    try {
      if (req.headers.host !== new URL(origin).host) throw problem(403, 'Host不允许');
      if (req.headers.origin && req.headers.origin !== origin) throw problem(403, 'Origin不允许');
      const pathname = new URL(req.url, origin).pathname;
      if (pathname === '/health' && ['GET', 'HEAD'].includes(req.method))
        return send(200, { ok: true, site, synthetic: true });
      if (site === 'requests' && /^\/api\/requests(?:\/[^/]+)?$/.test(pathname)) {
        if (!(req.headers.cookie || '').split(';').some((c) => c.trim() === 'requests_demo=1'))
          throw problem(401, '请进入演示');
        const id = pathname.split('/')[3];
        if (!id && req.method === 'GET') return send(200, { records: rows });
        if (!id && req.method === 'POST') {
          const body = await jsonBody(req);
          for (const key of ['name', 'project', 'applicant', 'category'])
            if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 80)
              throw problem(400, '字段无效');
          const price = catalog[body.project]?.[body.category];
          if (!Number.isFinite(price)) throw problem(400, '项目品类不匹配');
          const name = body.name.trim();
          if (rows.some((row) => row.name === name)) throw problem(409, '申请名称已存在');
          const q = quantity(body.quantity);
          const row = {
            id: `new-${++sequence}`,
            name,
            project: body.project,
            applicant: body.applicant.trim(),
            category: body.category,
            quantity: q,
            unitPrice: price,
            total: q * price,
            status: '待审批',
            protected: false,
          };
          rows.push(row);
          mutations.push({ method: 'POST', id: row.id, name });
          return send(201, { record: row });
        }
        if (id && ['PATCH', 'DELETE'].includes(req.method)) {
          const row = rows.find((row) => row.id === id);
          if (!row) throw problem(404, '申请不存在');
          if (row.protected) throw problem(403, '演示种子记录不可修改');
          if (req.method === 'PATCH') {
            const body = await jsonBody(req);
            row.quantity = quantity(body.quantity);
            row.total = row.quantity * row.unitPrice;
          } else rows = rows.filter((item) => item.id !== id);
          mutations.push({ method: req.method, id, name: row.name });
          return send(200, { record: row });
        }
        throw problem(405, '方法不允许');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw problem(405, '方法不允许');
      const filename =
        site === 'devices'
          ? routes.has(pathname)
            ? 'index.html'
            : null
          : {
              '/': 'index.html',
              '/index.html': 'index.html',
              '/app.js': 'app.js',
              '/style.css': 'style.css',
            }[pathname];
      if (!filename) throw problem(404, '资源不存在');
      const type = filename.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : filename.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/html; charset=utf-8';
      return send(200, await readFile(path.join(root, 'fixtures', site, filename)), type);
    } catch (error) {
      if (!res.headersSent)
        send(error.status || 500, { error: error.status ? error.message : '夹具内部错误' });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    site,
    // In-process reference evidence only; never routed to the tested browser.
    inspect: () => structuredClone({ records: rows, mutations }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const site = process.argv[2] || 'requests';
  const defaults = { devices: 4190, 'work-orders': 4191, requests: 4192 };
  const port = Number(process.argv[3] || defaults[site]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const fixture = await startFixture({ site, port });
  console.log(`Synthetic ${site}: ${fixture.origin} (reset by restarting this instance)`);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await fixture.close();
      process.exit(0);
    });
}
