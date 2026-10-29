import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startProjectTargetBrowser } from '../server/build/project-target-browser.mjs';

const executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('project target browser scopes in-memory auth state and blocks only configured session termination', async () => {
  const received = { protected: 0, logout: 0, ordinary: 0 };
  const server = http.createServer((request, response) => {
    if (request.url === '/protected') {
      received.protected++;
      const authenticated = request.headers.cookie?.split(';').some(part => part.trim() === 'sid=fixture-session');
      response.writeHead(authenticated ? 200 : 401, { 'content-type': 'text/html; charset=utf-8' });
      response.end(authenticated ? '<!doctype html><title>Protected fixture</title><main>signed-in fixture</main>' :
        '<!doctype html><title>Fixture login required</title><main>login required</main>');
      return;
    }
    if (request.method === 'POST' && request.url === '/logout') received.logout++;
    if (request.method === 'POST' && request.url === '/ordinary') received.ordinary++;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const target = { origin, path_prefix: '/', entry_url: `${origin}/protected` };
  const storageState = { cookies: [{ name: 'sid', value: 'fixture-session', url: origin,
    expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] };
  let authenticatedBrowser;
  let anonymousBrowser;
  try {
    authenticatedBrowser = await startProjectTargetBrowser(target, executablePath, () => {}, {
      headless: true, storageState, sessionTerminationEndpoints: [{ method: 'POST', path: '/logout' }],
    });
    assert.equal(await authenticatedBrowser.page.locator('main').textContent(), 'signed-in fixture');
    assert.equal((await authenticatedBrowser.page.request.get(`${origin}/protected`)).status(), 200);
    const before = { ...received };
    const blocked = await authenticatedBrowser.page.evaluate(async () => {
      try { await fetch('/logout', { method: 'POST' }); return false; }
      catch { return true; }
    });
    assert.equal(blocked, true, 'logout request is blocked in the browser context');
    assert.equal(received.logout, before.logout, 'logout never reached the fixture server');
    assert.equal(await authenticatedBrowser.page.evaluate(async () => (await fetch('/ordinary', { method: 'POST' })).ok), true);
    assert.equal(received.ordinary, before.ordinary + 1, 'unlisted same-origin POST remains reachable');
    await authenticatedBrowser.close(); authenticatedBrowser = null;

    anonymousBrowser = await startProjectTargetBrowser(target, executablePath, () => {}, { headless: true });
    assert.equal(await anonymousBrowser.page.locator('main').textContent(), 'login required');
    assert.equal((await anonymousBrowser.page.request.get(`${origin}/protected`)).status(), 401,
      'a separate context without provided storageState has no authentication cookie');
    assert.equal(received.logout, 0);
  } finally {
    await Promise.allSettled([authenticatedBrowser?.close(), anonymousBrowser?.close()]);
    await new Promise(resolve => server.close(resolve));
  }
});
