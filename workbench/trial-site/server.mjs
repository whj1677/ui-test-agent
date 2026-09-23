import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const host = '127.0.0.1';
const port = Number(process.env.TRIAL_SITE_PORT || 4320);
const assets = new Map([['/styles.css',['styles.css','text/css; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']]]);
const server = http.createServer(async (request,response) => {
  const url = new URL(request.url,'http://localhost');
  const asset = assets.get(url.pathname);
  const page = /^\/ui\/[a-f]\/?$/.test(url.pathname);
  if (!asset && !page) { response.writeHead(404,{'content-type':'text/plain; charset=utf-8'}); response.end('Not found'); return; }
  const [file,type] = asset || ['index.html','text/html; charset=utf-8'];
  const body = await fs.readFile(path.join(root,file));
  response.writeHead(200,{'content-type':type,'content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",'cache-control':'no-store'});
  response.end(body);
});
server.listen(port,host,() => console.log(`TEST-SITE-01 http://${host}:${port}/ui/a`));

let closing = false;
function close() { if (closing) return; closing = true; server.close(() => process.exit(0)); setTimeout(() => process.exit(1),3000).unref(); }
process.once('SIGINT',close); process.once('SIGTERM',close);
