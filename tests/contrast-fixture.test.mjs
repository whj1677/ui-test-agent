import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { startContrastLab } from '../expanded-lab/serve.mjs';
import { startVerifiedContrastFixture } from '../scripts/contrast-fixture.mjs';

test('owned contrast fixture verifies all frozen routes/assets', async (t) => {
  const fixture = await startVerifiedContrastFixture(0);
  t.after(fixture.close);
  assert.equal(fixture.reused, false);
  await fixture.verify();
});

test('existing byte-identical contrast fixture is reused without stopping server', async (t) => {
  const owner = await startContrastLab(0);
  t.after(owner.close);
  const fixture = await startVerifiedContrastFixture(Number(new URL(owner.url).port));
  assert.equal(fixture.reused, true);
  assert.equal(fixture.url, owner.url);
  await fixture.verify();
  await fixture.close();
  assert.equal((await fetch(owner.url + '/healthz')).status, 200);
});

test('correct health and HTML never authorize a mismatched script asset', async (t) => {
  const html = await fs.readFile(new URL('../expanded-lab/public/index.html', import.meta.url));
  const css = await fs.readFile(new URL('../expanded-lab/public/style.css', import.meta.url));
  const server = http.createServer((req, res) =>
    res.end(
      req.url === '/healthz'
        ? JSON.stringify({ site: 'contrast-lab', version: 1 })
        : req.url === '/style.css'
          ? css
          : req.url === '/app.js'
            ? '/* wrong fixture */'
            : html,
    ),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(
    startVerifiedContrastFixture(server.address().port),
    /CONTRAST_FIXTURE_MISMATCH/,
  );
});
