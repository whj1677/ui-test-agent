import http from 'node:http';
import { readFile } from 'node:fs/promises';

export async function startFixtureServer(htmlPath, options = {}) {
  const html = await readFile(htmlPath);
  const route = options.route || '/probe';
  if (!/^\/probe(?:\/[a-z0-9-]+)?$/.test(route)) throw new Error('FIXTURE_ROUTE_INVALID');
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== route) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    response.end(html);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}${route}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
