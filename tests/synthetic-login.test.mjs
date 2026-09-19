import test from 'node:test';
import assert from 'node:assert/strict';
import { startSyntheticLoginFixture } from '../scripts/synthetic-login.mjs';
import { BrowserSession } from '../src/browser.mjs';
import { startLab } from '../manual-lab/serve.mjs';
import http from 'node:http';

test('owned synthetic fixture enters and re-verifies a fresh browser without user actions', async (t) => {
  const fixture = await startSyntheticLoginFixture();
  const browser = new BrowserSession({ headless: true });
  t.after(async () => {
    await browser.close();
    await fixture.close();
  });
  const task = { id: 'synthetic-owned-session', target: fixture.url + '/' };
  for (let i = 0; i < 2; i++) {
    await browser.open(task);
    assert.equal(browser.authenticated, false);
    await fixture.enter(browser, task);
    assert.equal(browser.authenticated, true);
    assert.equal(new URL(browser.loginPage.url()).pathname, '/overview');
    await assert.rejects(fixture.enter(browser, { ...task, id: 'other' }), {
      code: 'SYNTHETIC_LOGIN_SCOPE_MISMATCH',
    });
    await assert.rejects(fixture.enter(browser, { ...task, target: 'https://example.com/' }), {
      code: 'SYNTHETIC_LOGIN_SCOPE_MISMATCH',
    });
    await browser.close();
  }
});

test('reuse only byte-verified synthetic server and leave it running after fixture close', async (t) => {
  const owner = await startLab(0);
  t.after(owner.close);
  const port = Number(new URL(owner.url).port);
  const fixture = await startSyntheticLoginFixture({ port, reuseVerified: true });
  assert.equal(fixture.reused, true);
  assert.equal(fixture.url, owner.url);
  const browser = new BrowserSession({ headless: true });
  t.after(() => browser.close());
  const task = { id: 'verified-reuse', target: fixture.url + '/' };
  await browser.open(task);
  await fixture.enter(browser, task);
  assert.equal(browser.authenticated, true);
  await fixture.close();
  assert.equal((await fetch(owner.url + '/healthz')).status, 200);
});

test('occupied port with matching health but wrong page is never adopted or clicked', async (t) => {
  const server = http.createServer((req, res) => {
    res.end(
      req.url === '/healthz'
        ? JSON.stringify({ site: 'complex-manual-lab', version: 1 })
        : '<button>进入演示</button>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(
    startSyntheticLoginFixture({ port: server.address().port, reuseVerified: true }),
    /SYNTHETIC_FIXTURE_MISMATCH/,
  );
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/`)).status, 200);
});
