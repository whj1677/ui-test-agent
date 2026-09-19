import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function startContrastLab(port = 4197) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('INVALID_PORT');
  const assets = new Map(
    await Promise.all(
      ['index.html', 'style.css', 'app.js'].map(async (name) => [
        name,
        await fs.readFile(new URL('./public/' + name, import.meta.url)),
      ]),
    ),
  );
  const server = http.createServer((req, res) => {
    const headers = {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
    };
    const send = (code, body, mime = 'text/plain; charset=utf-8') => {
      res.writeHead(code, { ...headers, 'content-type': mime });
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
      return send(200, JSON.stringify({ site: 'contrast-lab', version: 1 }), 'application/json');
    if (u.pathname === '/favicon.ico') return send(204, '');
    const name =
      u.pathname === '/' || /^\/site\/[abcd][12]$/.test(u.pathname)
        ? 'index.html'
        : u.pathname === '/style.css'
          ? 'style.css'
          : u.pathname === '/app.js'
            ? 'app.js'
            : null;
    if (!name) return send(404, 'Not found');
    send(
      200,
      assets.get(name),
      name.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : name.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/javascript; charset=utf-8',
    );
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
    const s = await startContrastLab(
      process.argv[2] === undefined ? 4197 : Number(process.argv[2]),
    );
    console.log('Contrast lab ' + s.url);
  } catch (e) {
    console.error(e.code ?? e.message);
    process.exitCode = 1;
  }
}
