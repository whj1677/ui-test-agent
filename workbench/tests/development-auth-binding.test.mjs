import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configuredAuthEnvironments } from '../server/auth/catalog.mjs';
import { TargetAuthSessions } from '../server/auth/session.mjs';
import { checkDevelopmentEnvironment, developmentAuthScope } from '../server/build/user-workflow.mjs';
import { developmentValidationLanes } from '../server/build/development-task.mjs';
import { developmentPatch } from '../server/build/development-patch.mjs';
import { DevelopmentSession } from '../server/build/development-session.mjs';
import { frozenTrialEnvironment } from '../server/build/trial-environment.mjs';
import { developmentRecords, submitCandidateTrial } from '../server/build/candidate-trials.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';

const origin = 'https://synthetic.example.test';
const authEnvironment = { environment_id: 'synthetic-auth', name: 'Synthetic auth target', origin,
  login_url: `${origin}/login`, identity_url: `${origin}/api/identity`, roles: ['inspector'] };
const developmentEnvironment = { id: 'synthetic-auth', normal_url: `${origin}/protected`,
  validation_mode: 'normal-only', auth_requirement: { environment_id: 'synthetic-auth', role: 'inspector' } };

test('pre-registered generation cannot advertise an expired authenticated session as ready', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auth-preflight-'));
  try {
    const entry = {logical_id:'fixed-grant',project_id:'project-example',case_id:'case-example',case_version:1,
      content_sha256:'A'.repeat(64),environment_id:'synthetic-auth',mode:'new',task_id:null};
    await fs.writeFile(path.join(root,'development-authorizations.json'),JSON.stringify({entries:[entry]}));
    let checks = 0;
    const manager = {store:{root},userInitiatedOperations:false,generationDisabled:false,
      developmentEnvironments:[developmentEnvironment],caseAutomation:async()=>({candidates:[]}),
      authSessions:{environment:()=>authEnvironment,check:async()=>{checks++;return {status:'EXPIRED'};}}};
    const operation = new ScriptOperations({root,buildManager:manager,
      caseStore:{getProject:async()=>({cases:[{case_id:'case-example',versions:[{version:1,
        content_sha256:entry.content_sha256,content:{external_id:'CASE',title:'protected',status:'CONFIRMED'}}]}]})}});
    const plan = await operation.preflight('project-example',{mode:'generate',environment_id:'synthetic-auth',
      items:[{case_id:'case-example',case_version:1}]});
    assert.equal(checks,1);
    assert.equal(plan.items[0].logical_id,'fixed-grant');
    assert.equal(plan.items[0].state,'BLOCKED');
    assert.equal(plan.items[0].reason,'AUTH_SESSION_REQUIRED');
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'development-authorizations.json'),'utf8')).entries[0].task_id,null);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('auth-preflight-'));
    await fs.rm(root,{recursive:true,force:true});
  }
});

test('explicit auth catalog accepts registered same-origin HTTPS and rejects unsafe targets', () => {
  const catalog = configuredAuthEnvironments({ environments: [authEnvironment] });
  assert.equal(catalog.length, 2);
  assert.equal(catalog[1].origin, origin);
  for (const changed of [
    { origin: 'http://remote.example.test', login_url: 'http://remote.example.test/login', identity_url: 'http://remote.example.test/api/identity' },
    { login_url: 'https://other.example.test/login' },
    { identity_url: `${origin}/api/identity#fragment` },
    { identity_url: 'https://user:pass@synthetic.example.test/api/identity' },
    { environment_id: 'auth01-local-fixture-v1' },
  ]) assert.throws(() => configuredAuthEnvironments({ environments: [{ ...authEnvironment, ...changed }] }), /AUTH_ENVIRONMENTS_INVALID/);
});

test('identity redirect fails closed without following a cross-origin or downgraded Location', async () => {
  const sessions = new TargetAuthSessions({ environments: [authEnvironment], browserExecutable: 'unused' });
  const scope = { project_id: 'project-example', environment_id: 'synthetic-auth', role: 'inspector' };
  let requested = 0;
  sessions.sessions.set(JSON.stringify([scope.project_id, scope.environment_id, scope.role]), {
    scope, version: 'session-v1', status: 'VALID', identity: { account_id: 'synthetic-user' },
    browser: { isConnected: () => true }, context: { request: { get: async (url, options) => {
      assert.equal(url, authEnvironment.identity_url);
      assert.equal(options.maxRedirects, 0);
      requested++;
      return { status: () => 302, ok: () => false };
    } } },
  });
  const status = await sessions.check(scope);
  assert.equal(requested, 1);
  assert.equal(status.status, 'CHECK_UNAVAILABLE');
  await assert.rejects(sessions.stateForExecution(scope, 'session-v1'), /AUTH_SESSION_NOT_VALID/);
});

test('development auth binds the registered target, fixed role and valid session without anonymous fetch', async () => {
  let checked = 0;
  const manager = { authSessions: {
    environment(scope) {
      assert.deepEqual(scope, { project_id: 'project-example', environment_id: 'synthetic-auth', role: 'inspector' });
      return authEnvironment;
    },
    async check() { checked++; return { status: 'VALID' }; },
  } };
  assert.deepEqual(developmentAuthScope(manager, developmentEnvironment, 'project-example'),
    { project_id: 'project-example', environment_id: 'synthetic-auth', role: 'inspector' });
  const ready = await checkDevelopmentEnvironment(manager, developmentEnvironment, 'project-example');
  assert.equal(ready.preparation, 'REGISTERED_AUTH_TARGET');
  assert.equal(checked, 1);
  assert.deepEqual(developmentValidationLanes(developmentEnvironment, origin), ['normal']);
  await assert.rejects(checkDevelopmentEnvironment({ authSessions: { ...manager.authSessions,
    check: async () => ({ status: 'EXPIRED' }) } }, developmentEnvironment, 'project-example'), /AUTH_SESSION_REQUIRED/);
  for (const normal_url of ['http://remote.example.test/protected', 'https://other.example.test/protected', `${origin}/protected#secret`]) {
    assert.throws(() => developmentAuthScope(manager, { ...developmentEnvironment, normal_url }, 'project-example'), /DEVELOPMENT_AUTH_ENVIRONMENT_INVALID/);
  }
  assert.throws(() => developmentValidationLanes({ ...developmentEnvironment, normal_url: `${origin}/protected` }), /DEVELOPMENT_ENVIRONMENT_NOT_LOCAL/);
});

test('auth development patch retains MCP guard and switches browser to memory attachment', () => {
  const base = `- insert:\n    - id: dsh-browser-use-playwright-mcp\n      config:\n        mode: launch\n        headless: true\n        executablePath: !!js process.env.DSH_PROBE_BROWSER_EXECUTABLE\n`;
  const patch = developmentPatch(base, path.resolve('workbench'), { authAttach: true });
  assert.match(patch, /mode: attach/);
  assert.match(patch, /WORKBENCH_AUTH_CDP_ENDPOINT/);
  assert.match(patch, /workbench-development-guard/);
  assert.match(patch, /workbench-development-mcp/);
  assert.doesNotMatch(patch, /mode: launch/);
  assert.throws(() => developmentPatch('unrecognized patch', path.resolve('workbench'), { authAttach: true }), /DEVELOPMENT_AUTH_PATCH_INVALID/);
});

test('self-test receives authentication only through verifier input and persists no state', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'development-auth-binding-'));
  const secret = 'SYNTHETIC_COOKIE_SENTINEL';
  const state = { cookies: [{ name: 'session', value: secret, domain: 'synthetic.example.test', path: '/' }], origins: [] };
  const persisted = [];
  let seen = 0;
  try {
    const session = new DevelopmentSession({ directory,
      frozenCase: { steps: [{ order: 1, action: 'Inspect protected page', expected: 'Visible' }] },
      normalUrl: `${origin}/protected`, signal: new AbortController().signal,
      persist: async value => persisted.push(value), authStateForExecution: async () => state,
      verify: async ({ authStorageState, runDirectory }) => {
        assert.equal(authStorageState, state); seen++;
        await fs.mkdir(runDirectory, { recursive: true });
        const reportPath = path.join(runDirectory, 'playwright-report.json');
        await fs.writeFile(reportPath, JSON.stringify({ stats: { expected: 1, unexpected: 0, skipped: 0 },
          suites: [{ specs: [{ tests: [{ results: [{ status: 'passed', steps: [{ title: 'CASE_STEP_1', category: 'test.step' }] }] }] }] }] }));
        return { reportPath, process: { exitCode: 0, termination: null } };
      } });
    await session.init(`import {test} from '@playwright/test';\ntest('protected',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{});});\n`);
    await session.selfTest();
    assert.equal(seen, 1);
    assert.doesNotMatch(JSON.stringify(persisted), new RegExp(secret));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('registered auth trial target uses the existing target and has no negative lane', async () => {
  const target = frozenTrialEnvironment({ kind: 'registered-auth-target', id: 'synthetic-auth', normal_url: `${origin}/protected` });
  await target.check();
  const lease = await target.acquire('normal');
  assert.equal(lease.url, `${origin}/protected`);
  await lease.release();
  await assert.rejects(target.acquire('negative'), /TRIAL_ENVIRONMENT_UNAVAILABLE/);
});

test('authenticated development evidence is complete without a network trace', () => {
  const prefix = 'development/run-1/';
  const task = { task_id: 'build-example', auth_requirement: { role: 'inspector' },
    source: { project_id: 'project-example', external_id: 'CASE-1', case_id: 'case-1', case_version: 1 },
    input_bundle: { snapshot: { content: { steps: [] } } },
    development: { self_tests: [{ number: 1, started_at: '2026-09-25T00:00:00Z', sha256: 'A',
      result: { test_status: 'PASSED' }, step_replay: { status: 'READY', evidence_complete: true,
        output_file_name: 'step-replay-v1.webm' } }] }, candidates: [],
    files: ['step-replay-v1.webm', 'test.webm', 'step.png'].map(file_name => ({ relative_path: prefix + file_name })) };
  const [record] = developmentRecords(task);
  assert.equal(record.evidence_status, 'COMPLETE');
  assert.equal(record.trace_policy, 'DISABLED_FOR_AUTH_PRIVACY');
  assert.equal(developmentRecords({ ...task, auth_requirement: null })[0].evidence_status, 'INCOMPLETE');
});

test('authenticated candidate cannot be mapped to another project session', async () => {
  let verifierCalls = 0, receipts = 0;
  const manager = { starting: false, active: null, otherActive: () => false,
    assertStorageWritable() {},
    runStore: { getRun: async () => null, createRun: async () => { receipts++; } },
    store: { getTask: async () => ({ source: { project_id: 'project-source' },
      auth_requirement: { environment_id: 'synthetic-auth', role: 'inspector' } }) },
    adapter: { verifyCandidate: async () => { verifierCalls++; } } };
  const request = { request_id: 'request01', lane: 'normal', project_id: 'project-target',
    case_id: 'case-1', case_version: 1, content_sha256: 'A', source_task_id: 'build-source',
    candidate_version: 1, bundle_sha256: 'B', environment_id: 'synthetic-auth' };
  await assert.rejects(submitCandidateTrial(manager, request), /TRIAL_AUTH_PROJECT_MISMATCH/);
  assert.equal(receipts, 0);
  assert.equal(verifierCalls, 0);
  assert.equal(manager.starting, false);
});
