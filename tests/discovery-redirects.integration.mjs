import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';

async function fixture(t) {
  const hits = [],
    events = [];
  let outsideHits = 0;
  const outside = http.createServer((_req, res) => {
    outsideHits++;
    res.end('outside');
  });
  await new Promise((resolve) => outside.listen(0, '127.0.0.1', resolve));
  const server = http.createServer((req, res) => {
    hits.push({ url: req.url, cookie: req.headers.cookie || '' });
    const redirects = {
      '/first': '/second',
      '/second': '/catalog',
      '/chain-outside': '/outside',
      '/outside': `http://127.0.0.1:${outside.address().port}/outside`,
      '/danger': '/delete-resource',
      '/loop-a': '/loop-b',
      '/loop-b': '/loop-a',
    };
    if (redirects[req.url]) {
      res.writeHead(302, {
        Location: redirects[req.url],
        ...(req.url === '/first'
          ? { 'Set-Cookie': 'redirect_fixture=1;Path=/;SameSite=Strict' }
          : {}),
      });
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<h1>合成目录</h1><span data-testid="signed">已登录</span><a href="/first">查看目录</a>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = new BrowserSession({ headless: true });
  const task = {
    id: 'redirect-fixture',
    target: `http://127.0.0.1:${server.address().port}/home`,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  const explorer = new DiscoveryBrowser(browser, task, {
    maxSteps: 12,
    onEvent: (e) => events.push(e),
  });
  t.after(async () => {
    await explorer.close();
    await browser.close();
    await Promise.all([new Promise((r) => server.close(r)), new Promise((r) => outside.close(r))]);
  });
  await browser.open(task);
  await browser.authenticate(task, { kind: 'testid', value: 'signed' });
  const initial = await explorer.open();
  return { explorer, initial, hits, events, outsideHits: () => outsideHits };
}

test('same-origin redirect chain preserves final URL/cookies and charges every hop without replaying the click', async (t) => {
  const f = await fixture(t);
  const result = await f.explorer.act({
    candidate_id: f.initial.candidates.find((c) => c.name === '查看目录').candidate_id,
  });
  assert.ok(result.snapshot.url.endsWith('/catalog'));
  assert.equal(f.explorer.step, 3);
  assert.equal(f.hits.filter((r) => r.url === '/first').length, 1);
  assert.equal(f.hits.filter((r) => r.url === '/second').length, 1);
  assert.equal(f.hits.filter((r) => r.url === '/catalog').length, 1);
  assert.ok(f.hits.find((r) => r.url === '/catalog').cookie.includes('redirect_fixture=1'));
  assert.equal(f.events.filter((e) => e.type === 'DISCOVERY_ACTION_BEFORE').length, 1);
});

test('cross-origin redirect after an allowed same-origin hop is stopped before the external request', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.explorer.navigate('/chain-outside'), {
    code: 'OUTSIDE_TARGET_ORIGIN',
  });
  assert.equal(f.outsideHits(), 0);
  assert.equal(f.explorer.guard.blocked, 'OUTSIDE_TARGET_ORIGIN');
});

test('dangerous same-origin redirect destination is never requested', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.explorer.navigate('/danger'), { code: 'DISCOVERY_DANGEROUS_ROUTE' });
  assert.ok(!f.hits.some((r) => r.url === '/delete-resource'));
});

test('redirect loop ends under the existing loop and global step budgets', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.explorer.navigate('/loop-a'), { code: 'DISCOVERY_LOOP_LIMIT' });
  assert.ok(f.explorer.step <= 6);
  assert.equal(f.outsideHits(), 0);
});
