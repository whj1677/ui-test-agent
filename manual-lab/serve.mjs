import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Only this single synthetic page is served. The repository and grading files are not a web root.
const routes = new Set(['/', '/overview', '/assets', '/tariffs', '/work-orders', '/audit']);
export async function startLab(port = 4196) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const html = await fs.readFile(new URL('./public/index.html', import.meta.url));
  const server = http.createServer((req, res) => {
    const actualPort = server.address().port;
    const validHosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
    const headers = {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
    };
    const send = (code, body, mime = 'text/plain; charset=utf-8') => {
      res.writeHead(code, { ...headers, 'content-type': mime });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!validHosts.includes(req.headers.host)) return send(421, 'Unexpected host');
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Read-only static server');
    let url;
    try {
      url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
    } catch {
      return send(400, 'Bad request');
    }
    if (url.search) return send(404, 'Not found');
    if (url.pathname === '/healthz')
      return send(
        200,
        JSON.stringify({ site: 'complex-manual-lab', version: 1 }),
        'application/json',
      );
    if (url.pathname === '/favicon.ico') return send(204, '');
    if (!routes.has(url.pathname)) return send(404, 'Not found');
    send(200, html, 'text/html; charset=utf-8');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const lab = await startLab(process.argv[2] === undefined ? 4196 : Number(process.argv[2]));
    console.log(`Synthetic manual lab: ${lab.url}`);
    console.log(
      'No API key needed. Press Ctrl+C to stop this server. Existing Agent processes are unchanged.',
    );
  } catch (e) {
    console.error(
      e.code === 'EADDRINUSE'
        ? 'Port occupied; no process was stopped. Check the existing server before retrying.'
        : e.message,
    );
    process.exitCode = 1;
  }
}
