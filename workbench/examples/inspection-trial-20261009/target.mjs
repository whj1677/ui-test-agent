import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = 4460;
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../.local/inspection-trial-20261009/namespaces');
const page = fs.readFileSync(path.join(here, 'target.html'));
const runIdPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const codePattern = /^WO-[0-9]{4}$/;
const baseline = [
  { code: 'WO-1001', title: 'PCS月度巡检', station: 'EAST', priority: 'HIGH', status: 'PENDING' },
  { code: 'WO-1002', title: '消防设备检查', station: 'WEST', priority: 'NORMAL', status: 'PENDING' },
  { code: 'WO-1003', title: '电池温差复核', station: 'EAST', priority: 'NORMAL', status: 'DONE' },
];

function respond(res, status, value, type = 'application/json; charset=utf-8') {
  const content = type.startsWith('application/json') ? JSON.stringify(value) : value;
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(content),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  res.end(content);
}

function failure(res, status, runId, code, message) {
  respond(res, status, { runId, error: { code, message } });
}

function fileFor(runId) {
  if (typeof runId !== 'string' || !runIdPattern.test(runId)) return null;
  return path.join(dataDir, `${runId}.json`);
}

function readItems(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeItems(file, items) {
  fs.mkdirSync(dataDir, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(items), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function jsonBody(req) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) {
    throw new Error('请求必须使用 JSON。');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error('请求内容过大。');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('JSON 格式无效。'); }
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('请求内容必须是对象。');
  }
  return value;
}

function sameOrigin(req) {
  if (!req.headers.origin) return true;
  return req.headers.origin === `http://${host}:${port}`;
}

const server = http.createServer(async (req, res) => {
  let runId = null;
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const pathname = url.pathname;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !sameOrigin(req)) {
      return failure(res, 403, runId, 'FORBIDDEN_ORIGIN', '此来源不能修改练习数据。');
    }
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/healthz')) {
      return respond(res, 200, { service: 'inspection-trial-20261009', status: 'ok' });
    }
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(302, { location: '/inspection/' });
      return res.end();
    }
    if (req.method === 'GET' && pathname === '/inspection/') {
      return respond(res, 200, page, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && pathname === '/__control/baseline') {
      return respond(res, 200, { items: baseline.map(item => ({ ...item })), total: 3 });
    }
    if (req.method === 'POST' && pathname === '/__control/namespaces') {
      const body = await jsonBody(req);
      runId = body.runId;
      const file = fileFor(runId);
      if (!file) return failure(res, 400, runId, 'VALIDATION_ERROR', '运行编号格式无效。');
      fs.mkdirSync(dataDir, { recursive: true });
      if (fs.existsSync(file)) return respond(res, 200, { runId, created: false });
      writeItems(file, baseline.map(item => ({ ...item })));
      return respond(res, 201, { runId, created: true });
    }
    const control = /^\/__control\/namespaces\/([^/]+)$/.exec(pathname);
    if (req.method === 'DELETE' && control) {
      runId = control[1];
      const file = fileFor(runId);
      if (!file) return failure(res, 400, runId, 'VALIDATION_ERROR', '运行编号格式无效。');
      const deleted = fs.existsSync(file);
      if (deleted) fs.unlinkSync(file);
      return respond(res, 200, { runId, deleted });
    }
    const business = /^\/api\/v1\/namespaces\/([^/]+)\/orders(?:\/([^/]+)(?:\/(complete))?)?$/.exec(pathname);
    if (!business) return failure(res, 404, runId, 'NOT_FOUND', '接口不存在。');
    runId = business[1];
    const file = fileFor(runId);
    if (!file) return failure(res, 400, runId, 'VALIDATION_ERROR', '运行编号格式无效。');
    if (!fs.existsSync(file)) return failure(res, 404, runId, 'NAMESPACE_NOT_FOUND', '运行编号尚未初始化。');
    const code = business[2];
    const complete = business[3];
    let items = readItems(file);
    if (req.method === 'GET' && !code) {
      const filters = ['code', 'station', 'status'];
      const filtered = items.filter(item => filters.every(key => !url.searchParams.has(key) || item[key] === url.searchParams.get(key)));
      return respond(res, 200, { runId, items: filtered.sort((a, b) => a.code.localeCompare(b.code)), total: filtered.length });
    }
    if (req.method === 'GET' && code && !complete) {
      const item = items.find(entry => entry.code === code);
      return item ? respond(res, 200, { runId, item }) : failure(res, 404, runId, 'ORDER_NOT_FOUND', '工单不存在。');
    }
    if (req.method !== 'POST' || (code && !complete) || (!code && complete)) {
      return failure(res, 404, runId, 'NOT_FOUND', '接口不存在。');
    }
    if (req.headers['x-synthetic-role'] !== 'editor') {
      return failure(res, 403, runId, 'FORBIDDEN', '当前角色无权修改工单。');
    }
    if (complete) {
      const item = items.find(entry => entry.code === code);
      if (!item) return failure(res, 404, runId, 'ORDER_NOT_FOUND', '工单不存在。');
      if (item.status === 'DONE') return failure(res, 409, runId, 'ALREADY_COMPLETED', '工单已完成，不能再次完成。');
      item.status = 'DONE';
      writeItems(file, items);
      return respond(res, 200, { runId, updated: true, item });
    }
    const body = await jsonBody(req);
    // Body reads yield: recheck the namespace and reload before the atomic mutation.
    if (!fs.existsSync(file)) return failure(res, 404, runId, 'NAMESPACE_NOT_FOUND', '运行编号尚未初始化。');
    items = readItems(file);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (typeof body.code !== 'string' || !codePattern.test(body.code) || title.length < 1 || title.length > 60 ||
        !['EAST', 'WEST'].includes(body.station) || !['HIGH', 'NORMAL'].includes(body.priority)) {
      return failure(res, 400, runId, 'VALIDATION_ERROR', '工单编号、标题、站点或优先级无效。');
    }
    if (items.some(item => item.code === body.code)) {
      return failure(res, 409, runId, 'DUPLICATE_CODE', '工单编号已存在。');
    }
    const item = { code: body.code, title, station: body.station, priority: body.priority, status: 'PENDING' };
    items.push(item);
    writeItems(file, items);
    return respond(res, 201, { runId, created: true, item });
  } catch (error) {
    if (error.message === '请求内容过大。') return failure(res, 413, runId, 'VALIDATION_ERROR', error.message);
    if (error.message === '请求必须使用 JSON。' || error.message === 'JSON 格式无效。' || error.message === '请求内容必须是对象。') {
      return failure(res, 400, runId, 'VALIDATION_ERROR', error.message);
    }
    console.error(error);
    return failure(res, 500, runId, 'INTERNAL_ERROR', '服务暂时不可用。');
  }
});

server.listen(port, host, () => console.log(`Inspection trial: http://${host}:${port}/inspection/`));
