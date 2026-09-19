// Maintenance-only frozen synthetic fixture. Never accepts a remote URL.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startContrastLab } from '../expanded-lab/serve.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function verify(url) {
  const get = async (route) => {
    const response = await fetch(url + route, {
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Error('CONTRAST_FIXTURE_MISMATCH');
    return response;
  };
  const health = await (await get('/healthz')).json();
  if (health.site !== 'contrast-lab' || health.version !== 1)
    throw Error('CONTRAST_FIXTURE_MISMATCH');
  const htmlRoutes = [
    '/',
    ...['a', 'b', 'c', 'd'].flatMap((kind) => [1, 2].map((n) => `/site/${kind}${n}`)),
  ];
  for (const [file, routes] of [
    ['index.html', htmlRoutes],
    ['style.css', ['/style.css']],
    ['app.js', ['/app.js']],
  ]) {
    const expected = digest(
      await fs.readFile(new URL('../expanded-lab/public/' + file, import.meta.url)),
    );
    for (const route of routes) {
      const bytes = Buffer.from(await (await get(route)).arrayBuffer());
      if (digest(bytes) !== expected) throw Error('CONTRAST_FIXTURE_MISMATCH');
    }
  }
}

export async function startVerifiedContrastFixture(port = 4197) {
  let fixture;
  try {
    fixture = await startContrastLab(port);
  } catch (error) {
    if (!port || error.code !== 'EADDRINUSE') throw error;
    const url = `http://127.0.0.1:${port}`;
    await verify(url);
    fixture = { url, close: async () => {}, reused: true };
  }
  return {
    url: fixture.url,
    close: fixture.close,
    reused: fixture.reused === true,
    verify: () => verify(fixture.url),
  };
}
