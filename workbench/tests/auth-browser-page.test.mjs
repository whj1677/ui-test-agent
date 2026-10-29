import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { authOriginAllowed } from '../server/auth/catalog.mjs';

const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('auth origin accepts only HTTPS, loopback and explicit private IPv4 HTTP', () => {
  for (const host of ['192.168.1.249', '10.2.3.4', '172.16.0.1', '172.31.255.254', '127.0.0.1', 'localhost'])
    assert.equal(authOriginAllowed(new URL(`http://${host}:18081`)), true, host);
  for (const host of ['172.15.0.1', '172.32.0.1', '8.8.8.8', 'remote.example.com'])
    assert.equal(authOriginAllowed(new URL(`http://${host}`)), false, host);
  assert.equal(authOriginAllowed(new URL('https://remote.example.com')), true);
  assert.equal(authOriginAllowed(new URL('file:///app')), false);
});

for (const mode of ['cookie', 'local-storage']) test(`manual page login with ${mode} verifies access, transfers session and rejects expiry`, async () => {
  let expired = false, broken = false, identityRequests = 0, entryRequests = 0;
  const protectedHtml = mode === 'cookie' ? '<main>Protected price configuration</main>' :
    `<main>Loading</main><script>
      const token=localStorage.getItem('fixture_token');
      if(!token)location.replace('/login');
      else fetch('/api/profile',{headers:{Authorization:'Bearer '+token}}).then(r=>{
        if(!r.ok)location.replace('/login');else document.querySelector('main').textContent='Protected price configuration';
      });
    </script>`;
  const server = http.createServer((request, response) => {
    if (request.url === '/api/identity') { identityRequests++; response.writeHead(404); response.end(); return; }
    if (request.url === '/api/profile') {
      response.writeHead(!expired && request.headers.authorization === 'Bearer fixture-token' ? 200 : 401, { 'content-type': 'application/json' });
      response.end('{"code":0,"data":{"name":"QA user"}}'); return;
    }
    if (request.url === '/login' && request.method === 'POST') {
      response.writeHead(303, { location: '/app', 'set-cookie': 'fixture_session=fixture-only; HttpOnly; Path=/; SameSite=Lax' }); response.end(); return;
    }
    if (request.url === '/login') {
      response.setHeader('content-type', 'text/html');
      response.end(mode === 'cookie' ? '<form method="post"><label>Account<input name="account"></label><label>Password<input type="password" name="password"></label><button>Log in</button></form>' :
        '<main><label>Account<input></label><label>Password<input type="password"></label><button onclick="localStorage.setItem(\'fixture_token\',\'fixture-token\');location.replace(\'/app\')">Log in</button></main>'); return;
    }
    if (request.url === '/app') {
      entryRequests++;
      if (broken) { response.writeHead(503); response.end('Unavailable'); return; }
      if (mode === 'cookie' && (expired || !request.headers.cookie?.includes('fixture_session=fixture-only'))) {
        response.writeHead(302, { location: '/login' }); response.end(); return;
      }
      response.setHeader('content-type', 'text/html'); response.end(protectedHtml); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const scope = { project_id: `project-page-${mode}`, environment_id: `page-${mode}`, role: 'tester' };
  const sessions = new TargetAuthSessions({ environments: [{ environment_id: scope.environment_id, roles: [scope.role], origin,
    login_url: `${origin}/login`, entry_url: `${origin}/app`, path_prefix: '/', verification_mode: 'browser-page' }],
    browserExecutable: executable, headless: true });
  try {
    const opened = await sessions.open(scope);
    assert.equal(opened.status, 'AWAITING_LOGIN');
    assert.equal((await sessions.check(scope)).status, 'AWAITING_LOGIN', 'polling alone cannot confirm manual login');
    assert.equal((await sessions.check(scope, { confirmLogin: true })).status, 'AWAITING_LOGIN', 'a visible login page never becomes valid');
    const item = sessions.sessions.get(JSON.stringify([scope.project_id, scope.environment_id, scope.role]));
    await item.page.getByLabel('Account').fill('synthetic-qa-user');
    await item.page.getByLabel('Password').fill('fixture-only');
    await item.page.getByRole('button', { name: 'Log in' }).click();
    await item.page.getByText('Protected price configuration').waitFor();
    const valid = await sessions.check(scope, { confirmLogin: true });
    assert.equal(valid.status, 'VALID');
    assert.equal(valid.account_id, null);
    assert.equal(valid.account_verified, false);
    assert.equal(valid.role_verified, false);
    assert.notEqual(valid.session_version, opened.session_version);
    const state = await sessions.stateForExecution(scope, valid.session_version);
    await item.page.goto(`${origin}/app`);
    await item.page.getByText('Protected price configuration').waitFor();
    const pagesBefore = item.context.pages(), requestsBefore = entryRequests;
    for (let i = 0; i < 5; i++) assert.equal((await sessions.check(scope, { passive: true })).status, 'VALID');
    assert.equal(entryRequests, requestsBefore, 'watch polls must not reload the registered entry');
    assert.deepEqual(item.context.pages(), pagesBefore, 'watch polls must not replace attached tabs');
    const browser = await chromium.launch({ headless: true, executablePath: executable });
    try {
      const context = await browser.newContext({ storageState: state });
      const page = await context.newPage();
      await page.goto(`${origin}/app`);
      await page.getByText('Protected price configuration').waitFor();
    } finally { await browser.close(); }
    broken = true;
    assert.equal((await sessions.check(scope)).status, 'CHECK_UNAVAILABLE', 'service errors never count as login success');
    await assert.rejects(sessions.stateForExecution(scope, valid.session_version), /AUTH_SESSION_NOT_VALID/);
    broken = false;
    assert.equal((await sessions.check(scope)).status, 'CHECK_UNAVAILABLE', 'recovery needs explicit confirmation');
    const recovered = await sessions.check(scope, { confirmLogin: true });
    assert.equal(recovered.status, 'VALID');
    assert.notEqual(recovered.session_version, valid.session_version);
    await item.page.goto(`${origin}/login`);
    assert.equal((await sessions.check(scope, { passive: true })).status, 'EXPIRED', 'visible logout still invalidates the session');
    await item.page.goto(`${origin}/app`);
    assert.equal((await sessions.check(scope, { passive: true })).status, 'EXPIRED', 'monitoring never restores an invalid session');
    const reconfirmed = await sessions.check(scope, { confirmLogin: true });
    assert.equal(reconfirmed.status, 'VALID');
    expired = true;
    assert.equal((await sessions.check(scope)).status, 'EXPIRED');
    await assert.rejects(sessions.stateForExecution(scope, recovered.session_version), /AUTH_SESSION_NOT_VALID/);
    assert.equal(identityRequests, 0);
    await sessions.clear(scope);
    assert.equal(sessions.status(scope).status, 'NOT_LOGGED_IN');
  } finally {
    await sessions.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
