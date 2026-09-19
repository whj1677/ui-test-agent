import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const heldoutRoutes = [
  '/',
  ...['q', 'f', 'm', 's'].flatMap((k) => [1, 2].map((n) => `/probe/${k}${n}`)),
];
export async function startHeldoutLab(port = 4198) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('INVALID_PORT');
  const html = await fs.readFile(new URL('./index.html', import.meta.url));
  const script = html.toString('utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw Error('HELDOUT_SCRIPT_MISSING');
  const scriptHash = createHash('sha256').update(script).digest('base64');
  const server = http.createServer((req, res) => {
    const send = (status, body, mime = 'text/plain; charset=utf-8') => {
      res.writeHead(status, {
        'content-type': mime,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`,
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (
      ![`localhost:${server.address().port}`, `127.0.0.1:${server.address().port}`].includes(
        req.headers.host,
      )
    )
      return send(421, 'Unexpected host');
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Read-only site');
    let u;
    try {
      u = new URL(req.url, 'http://localhost');
    } catch {
      return send(400, 'Bad request');
    }
    if (u.search) return send(404, 'Not found');
    if (u.pathname === '/healthz')
      return send(200, JSON.stringify({ site: 'heldout-lab', version: 1 }), 'application/json');
    if (u.pathname === '/favicon.ico') return send(204, '');
    if (!heldoutRoutes.includes(u.pathname)) return send(404, 'Not found');
    send(200, html, 'text/html; charset=utf-8');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: `http://localhost:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
    server,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lab = await startHeldoutLab(process.argv[2] === undefined ? 4198 : Number(process.argv[2]));
  console.log('Held-out synthetic lab ' + lab.url);
}
