import http from 'node:http';

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

export function createWorkbenchServer(options = {}) {
  const store = options.store;
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { service: 'approved-test-workbench', status: 'ready' });
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
    sendJson(response, 404, { error: 'NOT_FOUND' });
  });
}
