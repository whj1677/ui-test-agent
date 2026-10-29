import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { TargetAuthSessions } from '../server/auth/session.mjs';

const scope = { project_id: 'project-login-preflight', environment_id: 'local-login', role: 'inspector' };
const environment = origin => ({ environment_id: scope.environment_id, roles: [scope.role], origin,
  login_url: `${origin}/login`, identity_url: `${origin}/api/identity` });
const fakeBrowser = ({ gotoFails = false } = {}) => {
  const state = { launches: 0, closes: 0 };
  const browserType = { launch: async () => {
    state.launches++;
    return { on() {}, isConnected: () => true, async close() { state.closes++; },
      async newContext() { return { async route() {}, async newPage() { return {
        async goto() { if (gotoFails) throw Error('private navigation details'); },
        async bringToFront() {}, isClosed: () => false, async close() {},
      }; } }; } };
  } };
  return { state, browserType };
};

test('unreachable login target fails before browser launch with stable code', async () => {
  const server = http.createServer((_request, response) => response.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await new Promise(resolve => server.close(resolve));
  const { state, browserType } = fakeBrowser();
  const sessions = new TargetAuthSessions({ environments: [environment(origin)], browserExecutable: 'fake', browserType });
  await assert.rejects(sessions.open(scope), { message: 'AUTH_LOGIN_TARGET_UNREACHABLE' });
  assert.equal(state.launches, 0);
  assert.equal(sessions.status(scope).status, 'NOT_LOGGED_IN');
});

test('preflight sends no cookie, does not follow redirect, and accepts a reachable login page', async () => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ path: request.url, method: request.method, cookie: request.headers.cookie });
    response.writeHead(302, { location: 'https://outside.example.invalid/login' }); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { state, browserType } = fakeBrowser();
  const sessions = new TargetAuthSessions({ environments: [environment(`http://127.0.0.1:${server.address().port}`)],
    browserExecutable: 'fake', browserType });
  try {
    assert.equal((await sessions.open(scope)).status, 'AWAITING_LOGIN');
    assert.deepEqual(requests, [{ path: '/login', method: 'GET', cookie: undefined }]);
    assert.equal(state.launches, 1);
  } finally { await sessions.close(); await new Promise(resolve => server.close(resolve)); }
});

test('5xx and navigation failure have stable page code; failed probe retains prior session', async () => {
  const server = http.createServer((_request, response) => { response.writeHead(503); response.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const first = fakeBrowser();
  const firstSessions = new TargetAuthSessions({ environments: [environment(origin)], browserExecutable: 'fake', browserType: first.browserType });
  try {
    await assert.rejects(firstSessions.open(scope), { message: 'AUTH_LOGIN_PAGE_UNAVAILABLE' });
    assert.equal(first.state.launches, 0);
  } finally { await firstSessions.close(); await new Promise(resolve => server.close(resolve)); }

  const second = fakeBrowser();
  let reachable = true;
  const secondSessions = new TargetAuthSessions({ environments: [environment(origin)], browserExecutable: 'fake',
    browserType: second.browserType, loginPageProbe: async () => { if (!reachable) throw Error('AUTH_LOGIN_TARGET_UNREACHABLE'); } });
  try {
    const opened = await secondSessions.open(scope);
    reachable = false;
    await assert.rejects(secondSessions.open(scope), { message: 'AUTH_LOGIN_TARGET_UNREACHABLE' });
    assert.equal(secondSessions.status(scope).session_version, opened.session_version);
    assert.deepEqual([second.state.launches, second.state.closes], [1, 0]);
  } finally { await secondSessions.close(); }

  const third = fakeBrowser({ gotoFails: true });
  const thirdSessions = new TargetAuthSessions({ environments: [environment(origin)], browserExecutable: 'fake',
    browserType: third.browserType, loginPageProbe: async () => {} });
  await assert.rejects(thirdSessions.open(scope), { message: 'AUTH_LOGIN_PAGE_UNAVAILABLE' });
  assert.deepEqual([third.state.launches, third.state.closes], [1, 1]);
});
