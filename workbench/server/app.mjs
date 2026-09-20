import http from 'node:http';

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
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
      sendJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      sendJson(response, errorStatus(error), { error: error.message.split(':')[0] });
    }
  });
}
