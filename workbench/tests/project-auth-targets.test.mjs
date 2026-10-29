import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectTargetAccess, normalizeProjectTarget } from '../server/project-target-access.mjs';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { checkDevelopmentEnvironment, scriptEnvironments } from '../server/build/user-workflow.mjs';
import { trialNetworkPolicy } from '../server/build/candidate-trials.mjs';
import { resolveDemonstrationEnvironment } from '../server/demonstration-environment.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';

const project = 'project-example';
const input = { name: 'Protected UI', entry_url: 'https://target.example.test/app/', path_prefix: '/app',
  operator: 'operator', confirm_non_production: true, login_required: true, identity_url: 'https://target.example.test/api/identity' };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-auth-target-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sessions = new TargetAuthSessions({ environments: [], browserExecutable: 'fake' });
  const caseStore = { getProject: async id => id === project ? { cases: [{ case_id: 'case-x', versions: [{ version: 1,
    content_sha256: 'a'.repeat(64), content: { status: 'CONFIRMED', case_type: 'FRONTEND', external_id: 'C1' } }] }] } : null };
  const manager = { authSessions: sessions, developmentEnvironments: [], candidateTrialEnvironments: [], store: { root },
    userInitiatedOperations: true, modelConfiguration: {}, caseAutomation: async () => ({ candidates: [] }) };
  const targets = new ProjectTargetAccess({ root, buildManager: manager, caseStore });
  manager.projectTargetAccess = targets;
  return { root, sessions, manager, targets, caseStore };
}

test('required registration persists configuration, restores empty session, separates projects and keeps original none hash', async t => {
  const f = await fixture(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('anonymous business request forbidden'); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const target = await f.targets.register(project, input);
  assert.equal(target.role, 'tester');
  assert.equal(target.login_url, input.entry_url);
  const scope = { project_id: project, environment_id: target.environment_id, role: target.role };
  assert.equal(f.sessions.status(scope).status, 'NOT_LOGGED_IN');
  assert.equal(f.sessions.list('project-other').length, 0);
  assert.equal(f.sessions.list(project)[0].environment_id, target.environment_id);
  assert.throws(() => f.sessions.environment({ ...scope, project_id: 'project-other' }), /AUTH_ENVIRONMENT_PROJECT_MISMATCH/);
  const environment = f.manager.developmentEnvironments[0];
  const catalog = await scriptEnvironments(f.manager, project, { catalog: true });
  assert.equal(catalog.environments[0].auth_required, true);
  assert.equal(catalog.environments[0].ready, true);
  await assert.rejects(checkDevelopmentEnvironment(f.manager, environment, project), /AUTH_SESSION_REQUIRED/);
  const operation = new ScriptOperations({ root: f.root, buildManager: f.manager, caseStore: f.caseStore });
  const preflight = await operation.preflight(project, { mode: 'generate', environment_id: target.environment_id,
    items: [{ case_id: 'case-x', case_version: 1 }] });
  assert.equal(preflight.items[0].reason, 'AUTH_SESSION_REQUIRED');
  assert.deepEqual(trialNetworkPolicy(f.manager.candidateTrialEnvironments[0]), { origin: target.origin, path_prefix: '/app' });
  const demonstration = await resolveDemonstrationEnvironment(f.manager, project, target.environment_id);
  assert.equal(demonstration.auth_required, true);
  assert.deepEqual(demonstration.auth_scope, scope);
  const bytes = await fs.readFile(f.targets.file, 'utf8');
  for (const secret of ['cookies', 'session_version', 'account_id', 'storageState']) assert.equal(bytes.includes(secret), false);
  const restoredSessions = new TargetAuthSessions({ environments: [], browserExecutable: 'fake' });
  const restored = { ...f.manager, authSessions: restoredSessions, developmentEnvironments: [], candidateTrialEnvironments: [] };
  await new ProjectTargetAccess({ root: f.root, buildManager: restored, caseStore: f.caseStore }).init();
  assert.equal(restoredSessions.environment(scope).identity_url, input.identity_url);
  assert.equal(restoredSessions.status(scope).status, 'NOT_LOGGED_IN');
  const noneInput = { ...input, login_required: false };
  const normalized = normalizeProjectTarget(noneInput);
  assert.deepEqual(normalized, { origin: target.origin, entry_url: input.entry_url, path_prefix: '/app', protocol: 'https:' });
  const legacyHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex').toUpperCase();
  globalThis.fetch = async () => ({ ok: true, body: { cancel: async () => {} } });
  const none = await f.targets.register(project, noneInput);
  assert.equal(none.configuration_sha256, legacyHash);
  assert.equal(f.manager.developmentEnvironments[1].auth_requirement, undefined);
  assert.equal((await checkDevelopmentEnvironment(f.manager, f.manager.developmentEnvironments[1], project)).auth_required, false);
  await new ProjectTargetAccess({ root: f.root, buildManager: restored, caseStore: f.caseStore }).init();
});

test('login without identity supports LAN HTTP and still rejects cross-origin, public HTTP, and changed config hashes', async t => {
  const f = await fixture(t);
  const browserTarget = normalizeProjectTarget({ ...input, identity_url: '' });
  assert.equal(browserTarget.verification_mode, 'browser-page');
  assert.equal(browserTarget.identity_url, undefined);
  const lan = { ...input, entry_url: 'http://192.168.1.249:18081/control-electricity-price/config', path_prefix: '/', identity_url: '' };
  const registered = await f.targets.register(project, lan);
  const scope = { project_id: project, environment_id: registered.environment_id, role: 'tester' };
  assert.equal(f.sessions.environment(scope).entry_url, lan.entry_url);
  assert.equal(f.sessions.status(scope).verification_mode, 'browser-page');
  assert.equal(f.sessions.status(scope).status, 'NOT_LOGGED_IN');
  const restored = { ...f.manager, authSessions: new TargetAuthSessions({ environments: [], browserExecutable: 'fake' }), developmentEnvironments: [], candidateTrialEnvironments: [] };
  await new ProjectTargetAccess({ root: f.root, buildManager: restored, caseStore: f.caseStore }).init();
  assert.equal(restored.authSessions.environment(scope).entry_url, lan.entry_url);
  for (const patch of [{ login_url: 'https://other.test/login' }, { identity_url: 'https://other.test/identity' },
    { entry_url: 'http://remote.test/app', identity_url: 'http://remote.test/identity' }])
    assert.throws(() => normalizeProjectTarget({ ...input, ...patch }), /PROJECT_TARGET_AUTH_ORIGIN_INVALID/);
  const target = await f.targets.register(project, input);
  const state = JSON.parse(await fs.readFile(f.targets.file, 'utf8'));
  state.targets.find(item => item.environment_id === target.environment_id).identity_url = 'https://target.example.test/api/changed';
  await fs.writeFile(f.targets.file, JSON.stringify(state));
  await assert.rejects(f.targets.read(), /PROJECT_TARGET_STORE_INVALID/);
  assert.ok(target.configuration_sha256);
});

test('dynamic required session checks identity and expiry, protects attached observation browser path and cross-origin requests', async t => {
  const f = await fixture(t);
  let routeHandler, connected = true, expiry = new Date(Date.now() + 60000).toISOString();
  const context = { route: async (_, fn) => { routeHandler = fn; }, routeWebSocket: async () => {},
    newPage: async () => ({ goto: async () => {}, bringToFront: async () => {}, isClosed: () => false, close: async () => {} }),
    request: { get: async () => ({ status: () => 200, ok: () => true,
      json: async () => ({ authenticated: true, account_id: 'u1', role: 'tester', expires_at: expiry }) }) } };
  f.sessions.browserType = { launch: async () => ({ newContext: async () => context, on: () => {},
    isConnected: () => connected, close: async () => { connected = false; } }) };
  f.sessions.loginPageProbe = async () => {};
  const target = await f.targets.register(project, input);
  const scope = { project_id: project, environment_id: target.environment_id, role: 'tester' };
  await f.sessions.open(scope);
  const valid = await f.sessions.check(scope);
  assert.equal(valid.status, 'VALID');
  assert.equal((await checkDevelopmentEnvironment(f.manager, f.manager.developmentEnvironments[0], project)).auth_required, true);
  const release = f.sessions.beginTaskProtection(scope, valid.session_version);
  const outcomes = [];
  for (const url of ['https://target.example.test/app/page', 'https://target.example.test/other', 'https://outside.test/app'])
    await routeHandler({ request: () => ({ url: () => url, method: () => 'GET' }),
      continue: () => outcomes.push('continue'), abort: () => outcomes.push('abort') });
  assert.deepEqual(outcomes, ['continue', 'abort', 'abort']);
  release();
  expiry = new Date(Date.now() - 1000).toISOString();
  assert.equal((await f.sessions.check(scope)).status, 'EXPIRED');
  await assert.rejects(checkDevelopmentEnvironment(f.manager, f.manager.developmentEnvironments[0], project), /AUTH_SESSION_REQUIRED/);
  await assert.rejects(f.sessions.stateForExecution(scope, valid.session_version), /AUTH_SESSION_NOT_VALID/);
  await f.sessions.close();
});
