import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredAuthEnvironments } from '../server/auth/catalog.mjs';
import { sessionTerminationRequest } from '../server/auth/session-request-policy.mjs';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { verifyCandidate } from '../../harness-probe/src/verify-candidate.mjs';

const origin = 'http://127.0.0.1:4381';
const declared = { environment_id: 'protected-test', origin, login_url: `${origin}/login`,
  identity_url: `${origin}/api/identity`, roles: ['inspector'], session_termination_endpoints: [
    { method: 'POST', path: '/api/logout' }, { method: 'POST', path: '/api/expire' },
  ] };
const scope = { project_id: 'project-policy', environment_id: declared.environment_id, role: 'inspector' };

test('termination policy validates exact canonical paths and preserves ordinary same-origin POSTs', () => {
  const env = configuredAuthEnvironments({ environments: [declared] })[1];
  assert.deepEqual(env.session_termination_endpoints, declared.session_termination_endpoints);
  for (const changed of [
    [{ method: 'post', path: '/api/logout' }], [{ method: 'POST', path: 'api/logout' }],
    [{ method: 'POST', path: '//elsewhere/logout' }], [{ method: 'POST', path: '/api/../logout' }],
    [{ method: 'POST', path: '/api/logout?x=1' }], [{ method: 'POST', path: '/api/%6cogout' }],
    [{ method: 'POST', path: '/api/logout' }, { method: 'POST', path: '/api/logout' }],
  ]) assert.throws(() => configuredAuthEnvironments({ environments: [{ ...declared, session_termination_endpoints: changed }] }), /AUTH_ENVIRONMENTS_INVALID/);
  assert.equal(sessionTerminationRequest(`${origin}/api/logout`, 'POST', origin, env.session_termination_endpoints), true);
  assert.equal(sessionTerminationRequest(`${origin}/api/%6cogout`, 'POST', origin, env.session_termination_endpoints), true);
  assert.equal(sessionTerminationRequest(`${origin}/api/expire`, 'POST', origin, env.session_termination_endpoints), true);
  assert.equal(sessionTerminationRequest(`${origin}/api/search`, 'POST', origin, env.session_termination_endpoints), false);
  assert.equal(sessionTerminationRequest(`${origin}/api/logout`, 'GET', origin, env.session_termination_endpoints), false);
  assert.equal(sessionTerminationRequest('https://other.example/api/logout', 'POST', origin, env.session_termination_endpoints), false);
});

test('active scope and version lease blocks termination requests, then releases for manual actions', async () => {
  let routeHandler;
  const context = {
    route: async (_pattern, handler) => { routeHandler = handler; },
    request: { get: async () => ({ status: () => 200, ok: () => true,
      json: async () => ({ authenticated: true, account_id: 'inspector-1', role: 'inspector' }) }) },
    newPage: async () => ({ goto: async () => {}, bringToFront: async () => {}, isClosed: () => false, close: async () => {} }),
  };
  const browser = { isConnected: () => true, on: () => {}, close: async () => {}, newContext: async () => context };
  const sessions = new TargetAuthSessions({ environments: [declared], browserExecutable: 'fake',
    browserType: { launch: async () => browser }, headless: true });
  const opened = await sessions.open(scope);
  const actions = [];
  const send = async (path, method = 'POST') => routeHandler({
    request: () => ({ url: () => `${origin}${path}`, method: () => method }),
    continue: () => actions.push('allow'), abort: () => actions.push('block'),
  });
  await send('/api/logout');
  assert.deepEqual(actions, ['allow'], 'manual logout remains available before task protection');
  await assert.rejects(async () => sessions.beginTaskProtection(scope, opened.session_version), /AUTH_SESSION_NOT_VALID/);
  const valid = await sessions.check(scope);
  assert.equal(valid.status, 'VALID');
  assert.throws(() => sessions.beginTaskProtection(scope, 'wrong-version'), /AUTH_SESSION_NOT_VALID/);
  assert.throws(() => sessions.beginTaskProtection({ ...scope, project_id: 'project-other' }, valid.session_version), /AUTH_SESSION_NOT_VALID/);
  const release = sessions.beginTaskProtection(scope, valid.session_version);
  await send('/api/logout');
  await send('/api/expire');
  await send('/api/search');
  await send('/api/logout', 'GET');
  assert.deepEqual(actions, ['allow', 'block', 'block', 'allow', 'allow']);
  release(); release();
  await send('/api/logout');
  assert.equal(actions.at(-1), 'allow', 'manual logout is restored after finally release');
  await sessions.close();
});

test('authenticated verifier refuses configured request protection without the observer wrapper', async () => {
  await assert.rejects(verifyCandidate({ authStorageState: { cookies: [] },
    sessionTerminationEndpoints: declared.session_termination_endpoints }),
  /AUTH_REQUEST_POLICY_REQUIRES_STEP_OBSERVATION/);
});
