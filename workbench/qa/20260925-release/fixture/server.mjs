import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = readFileSync(path.join(HERE, 'index.html'), 'utf8');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4381;
const COOKIE_NAME = 'sid';
const SESSION_TTL_MS = 30 * 60 * 1000;
const PAGE_SIZE = 2;
const LIST_DELAY_MS = 500;
const DETAIL_DELAY_MS = 500;

const ACCOUNT_ID = 'synthetic-inspector';
const ROLE = 'inspector';
const RESTRICT_REASON = '该设备为受限资产，当前角色 inspector 无权选择';
const ALLOW_NOTE = '当前角色 inspector 可选择该设备';

const DEVICES = [
  { id: 'INV-101', name: '温控采集器A', model: 'TCA-100', location: 'A-01-01', stock_status: '在库（充足）', selectable: true },
  { id: 'INV-102', name: '温控采集器B', model: 'TCA-100B', location: 'A-01-02', stock_status: '在库（紧张）', selectable: true },
  { id: 'INV-103', name: '电池巡检仪', model: 'BPI-200', location: 'B-02-01', stock_status: '在库（充足）', selectable: false },
  { id: 'INV-104', name: '温控采集器C', model: 'TCA-100C', location: 'A-01-03', stock_status: '在库（充足）', selectable: true },
  { id: 'INV-105', name: '电源模块', model: 'PSU-500', location: 'C-03-01', stock_status: '在库（紧张）', selectable: true },
];

const sessions = new Map();

function parsePort(argv) {
  const i = argv.indexOf('--port');
  if (i === -1) return DEFAULT_PORT;
  const p = Number(argv[i + 1]);
  if (Number.isInteger(p) && p > 0 && p < 65536) return p;
  return DEFAULT_PORT;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return { token: null, session: null };
  const session = sessions.get(token);
  if (!session) return { token, session: null };
  if (Date.now() >= session.expiresAtMs) {
    sessions.delete(token);
    return { token, session: null };
  }
  return { token, session };
}

function identityPayload(session) {
  return {
    authenticated: true,
    account_id: session.accountId,
    role: session.role,
    expires_at: new Date(session.expiresAtMs).toISOString(),
  };
}

function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function clearedCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: 'method_not_allowed', message: '方法不允许' });
}

function unauthenticated(res) {
  sendJson(res, 401, { error: 'unauthenticated', message: '未登录或会话已失效' });
}

function requireSession(req, res) {
  const { session } = getSession(req);
  if (!session) {
    unauthenticated(res);
    return null;
  }
  return session;
}

function handleLogin(req, res) {
  const token = crypto.randomBytes(24).toString('hex');
  const session = { accountId: ACCOUNT_ID, role: ROLE, expiresAtMs: Date.now() + SESSION_TTL_MS };
  sessions.set(token, session);
  sendJson(res, 200, identityPayload(session), { 'Set-Cookie': sessionCookie(token) });
}

function handleIdentity(req, res) {
  const session = requireSession(req, res);
  if (!session) return;
  sendJson(res, 200, identityPayload(session));
}

function destroySession(req, res, body) {
  const { token } = getSession(req);
  if (token) sessions.delete(token);
  sendJson(res, 200, body, { 'Set-Cookie': clearedCookie() });
}

function handleDeviceList(req, res, url) {
  const session = requireSession(req, res);
  if (!session) return;
  const filter = (url.searchParams.get('name_filter') || '').trim();
  let page = parseInt(url.searchParams.get('page') || '1', 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  const filtered = DEVICES.filter((d) => !filter || d.name.includes(filter));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((d) => ({
    id: d.id,
    name: d.name,
    stock_status: d.stock_status,
    selectable: d.selectable,
    selectable_label: d.selectable ? '可选' : '受限不可选',
    restriction_reason: d.selectable ? null : RESTRICT_REASON,
  }));
  setTimeout(() => {
    sendJson(res, 200, { items, page, page_size: PAGE_SIZE, total, total_pages: totalPages, name_filter: filter });
  }, LIST_DELAY_MS);
}

function handleDeviceDetail(req, res, id) {
  const session = requireSession(req, res);
  if (!session) return;
  const d = DEVICES.find((x) => x.id === id);
  if (!d) {
    sendJson(res, 404, { error: 'device_not_found', message: '设备不存在' });
    return;
  }
  setTimeout(() => {
    sendJson(res, 200, {
      id: d.id,
      name: d.name,
      model: d.model,
      location: d.location,
      stock_status: d.stock_status,
      selectable: d.selectable,
      selectable_label: d.selectable ? '可选' : '受限不可选',
      permission_note: d.selectable ? ALLOW_NOTE : RESTRICT_REASON,
    });
  }, DETAIL_DELAY_MS);
}

const PORT = parsePort(process.argv.slice(2));

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const p = url.pathname;
    const m = req.method;

    if (p === '/' && m === 'GET') return redirect(res, '/login');

    if (p === '/login') {
      if (m !== 'GET') return methodNotAllowed(res);
      return sendHtml(res, INDEX_HTML);
    }

    if (p === '/workspace') {
      if (m !== 'GET') return methodNotAllowed(res);
      const { session } = getSession(req);
      if (!session) return redirect(res, '/login');
      return sendHtml(res, INDEX_HTML);
    }

    if (p === '/api/login') {
      if (m !== 'POST') return methodNotAllowed(res);
      return handleLogin(req, res);
    }

    if (p === '/api/identity') {
      if (m !== 'GET') return methodNotAllowed(res);
      return handleIdentity(req, res);
    }

    if (p === '/api/logout') {
      if (m !== 'POST') return methodNotAllowed(res);
      return destroySession(req, res, { logged_out: true });
    }

    if (p === '/api/expire') {
      if (m !== 'POST') return methodNotAllowed(res);
      return destroySession(req, res, { expired: true });
    }

    if (p === '/api/devices') {
      if (m !== 'GET') return methodNotAllowed(res);
      return handleDeviceList(req, res, url);
    }

    const detailMatch = p.match(/^\/api\/devices\/([A-Za-z0-9-]+)$/);
    if (detailMatch) {
      if (m !== 'GET') return methodNotAllowed(res);
      return handleDeviceDetail(req, res, detailMatch[1]);
    }

    sendJson(res, 404, { error: 'not_found', message: '资源不存在' });
  } catch (err) {
    sendJson(res, 500, { error: 'internal_error', message: '服务器内部错误' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`设备库存台（合成试点）已启动: http://${HOST}:${PORT}/login`);
});
