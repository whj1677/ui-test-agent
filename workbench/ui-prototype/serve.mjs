import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 4321);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT_INVALID');

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webm', 'video/webm'],
  ['.md', 'text/markdown; charset=utf-8'],
]);

async function readFormBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw Object.assign(new Error('BODY_TOO_LARGE'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    if (request.method === 'POST' && pathname === '/demo-download') {
      const form = await readFormBody(request);
      const payload = form.get('payload') || '';
      const parsed = JSON.parse(payload);
      if (parsed.schema !== 'workbench/case-package-v1' || parsed.demo_only !== true || !Array.isArray(parsed.cases)) {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Invalid demo package');
        return;
      }
      const filename = (form.get('filename') || 'demo-cases.json').replace(/[^a-zA-Z0-9._-]/g, '_');
      const body = Buffer.from(payload, 'utf8');
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': body.length,
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      response.end(body);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD, POST' }).end('Method not allowed');
      return;
    }
    const target = path.resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await fs.readFile(target);
    response.writeHead(200, {
      'content-type': types.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; form-action 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Prototype server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`UI_D1_PROTOTYPE_READY http://127.0.0.1:${port}`);
});
