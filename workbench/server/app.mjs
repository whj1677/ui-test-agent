import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInside, sha256File } from './integrity.mjs';

const defaultWebRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
}

async function sendStatic(response, webRoot, pathname) {
  const files = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ]);
  const selected = files.get(pathname);
  if (!selected) return false;
  response.writeHead(200, securityHeaders(selected[1]));
  response.end(await fs.readFile(path.join(webRoot, selected[0])));
  return true;
}

async function sendMedia(request, response, store, runId, mediaId) {
  const run = await store.getRun(runId);
  const media = run?.media?.find((item) => item.media_id === mediaId);
  if (!media) return sendJson(response, 404, { error: 'MEDIA_NOT_FOUND' });
  const runRoot = store.runDirectory(runId);
  const file = resolveInside(runRoot, media.relative_path);
  const [realRoot, realFile] = await Promise.all([fs.realpath(runRoot), fs.realpath(file)]);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
    return sendJson(response, 403, { error: 'MEDIA_PATH_OUTSIDE_RUN' });
  }
  const stat = await fs.stat(realFile);
  if (!stat.isFile() || stat.size !== media.bytes || await sha256File(realFile) !== media.sha256) {
    return sendJson(response, 409, { error: 'MEDIA_FILE_CHANGED' });
  }
  const body = await fs.readFile(realFile);
  const range = String(request.headers.range || '').match(/^bytes=(\d+)-(\d*)$/);
  const disposition = media.kind === 'trace' ? 'attachment' : 'inline';
  const headers = {
    ...securityHeaders(media.content_type),
    'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(media.file_name)}`,
    'accept-ranges': 'bytes',
  };
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    if (!Number.isInteger(start) || start < 0 || start > end) {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` });
      return response.end();
    }
    response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
    response.end(body.subarray(start, end + 1));
    return;
  }
  response.writeHead(200, { ...headers, 'content-length': body.length });
  response.end(body);
}

async function readJsonBody(request, limit = 16 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function trustedMutation(request) {
  const host = request.headers.host;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) return false;
  if (request.headers.origin !== `http://${host}`) return false;
  return String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json');
}

function errorStatus(error) {
  if (['ASSET_NOT_APPROVED', 'ENVIRONMENT_NOT_ALLOWED'].includes(error.message)) return 400;
  if (error.message === 'RUN_ALREADY_ACTIVE') return 409;
  if (error.message === 'RUN_NOT_ACTIVE_OR_NOT_OWNED') return 404;
  if (error.message === 'REQUEST_TOO_LARGE') return 413;
  if (error.message === 'INVALID_JSON') return 400;
  return 422;
}

export function createWorkbenchServer(options = {}) {
  const store = options.store;
  const manager = options.manager;
  const webRoot = options.webRoot || defaultWebRoot;
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { service: 'approved-test-workbench', status: 'ready', active_run_id: manager?.active?.runId || null });
        return;
      }
      if (store && request.method === 'GET' && url.pathname === '/api/assets') {
        sendJson(response, 200, { assets: await store.listAssets() });
        return;
      }
      if (store && request.method === 'GET' && url.pathname.startsWith('/api/assets/')) {
        const asset = await store.getAsset(decodeURIComponent(url.pathname.slice('/api/assets/'.length)));
        sendJson(response, asset ? 200 : 404, asset || { error: 'ASSET_NOT_FOUND' });
        return;
      }
      if (store && request.method === 'GET' && url.pathname === '/api/runs') {
        sendJson(response, 200, { runs: await store.listRuns() });
        return;
      }
      const mediaMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/media\/([^/]+)$/);
      if (store && request.method === 'GET' && mediaMatch) {
        await sendMedia(request, response, store, decodeURIComponent(mediaMatch[1]), decodeURIComponent(mediaMatch[2]));
        return;
      }
      if (store && request.method === 'GET' && /^\/api\/runs\/[^/]+$/.test(url.pathname)) {
        const run = await store.getRun(decodeURIComponent(url.pathname.slice('/api/runs/'.length)));
        sendJson(response, run ? 200 : 404, run || { error: 'RUN_NOT_FOUND' });
        return;
      }
      if (manager && request.method === 'POST' && url.pathname === '/api/runs') {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        const allowedKeys = Object.keys(body).sort().join(',') === 'asset_id,environment';
        if (!allowedKeys || typeof body.asset_id !== 'string' || typeof body.environment !== 'string') {
          return sendJson(response, 400, { error: 'INVALID_RUN_REQUEST' });
        }
        const run = await manager.start(body.asset_id, body.environment);
        sendJson(response, 202, run);
        return;
      }
      const stop = url.pathname.match(/^\/api\/runs\/([^/]+)\/stop$/);
      if (manager && request.method === 'POST' && stop) {
        if (!trustedMutation(request)) return sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' });
        const body = await readJsonBody(request);
        if (Object.keys(body).length) return sendJson(response, 400, { error: 'INVALID_STOP_REQUEST' });
        sendJson(response, 202, await manager.stop(decodeURIComponent(stop[1])));
        return;
      }
      if (request.method === 'GET' && await sendStatic(response, webRoot, url.pathname)) return;
      sendJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      sendJson(response, errorStatus(error), { error: error.message.split(':')[0] });
    }
  });
}
