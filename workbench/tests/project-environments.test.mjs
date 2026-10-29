import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ProjectEnvironments } from '../server/project-environments.mjs';
import { BackendManager } from '../server/backend-manager.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';
import { resolveTrialCandidate } from '../server/build/candidate-trials.mjs';
import { resolveDemonstrationEnvironment } from '../server/demonstration-environment.mjs';
import { scriptEnvironments } from '../server/build/user-workflow.mjs';
import { writeAtomicJson } from '../server/atomic-json.mjs';

const projectA = `project-${randomUUID()}`;
const projectB = `project-${randomUUID()}`;
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const backendHash = value => {
  const { configuration_sha256, ...facts } = value;
  return sha(facts);
};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-environments-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(root, { recursive: true });
  const uiId = `user-target-${randomUUID()}`;
  const uiTarget = {
    id: uiId, name: 'UI test target', normal_url: 'http://127.0.0.1:4511/', validation_mode: 'normal-only',
    project_id: projectA, user_registered_target: true,
    target_scope: { origin: 'http://127.0.0.1:4511', path_prefix: '/' },
    configuration_sha256: 'a'.repeat(64), operator: 'tester', registered_at: new Date().toISOString(),
  };
  const trialTarget = {
    id: uiId, configurationIdentity: { kind: 'registered-user-target', project_id: projectA,
      origin: uiTarget.target_scope.origin, path_prefix: '/', configuration_sha256: uiTarget.configuration_sha256 },
    check: async () => {},
  };
  const buildManager = {
    developmentEnvironments: [uiTarget], candidateTrialEnvironments: [trialTarget],
    authSessions: null, generationDisabled: false, userInitiatedOperations: false,
  };
  const caseStore = { getProject: async id => [projectA, projectB].includes(id) ? { project_id: id } : null };
  const backendRoot = path.join(root, 'backend');
  const backend = new BackendManager({ root: backendRoot, caseStore, requirementsManager: {}, runStore: {} });
  const httpId = `env-${randomUUID()}`;
  const backendEnvironment = {
    mode: 'http-json-readonly', environment_id: httpId, id: httpId, project_id: projectA,
    name: 'HTTP test target', base_url: 'http://127.0.0.1:4512', non_production: true, authorized: true,
    reviewer: 'tester', created_at: new Date().toISOString(), allowed_methods: ['GET'], allowed_headers: [],
    allowed_path_prefixes: ['/api/'],
  };
  backendEnvironment.configuration_sha256 = backendHash(backendEnvironment);
  await backend.save(backendEnvironment);

  const manager = new ProjectEnvironments({ root, caseStore, buildManager, backendManager: backend });
  buildManager.projectEnvironments = manager;
  backend.projectEnvironments = manager;
  await manager.init();
  return { root, manager, buildManager, backend, caseStore, uiTarget, trialTarget, httpId, backendEnvironment };
}

const bindBoth = (manager, uiId, backendId, revision = 0) => manager.set(projectA, {
  revision, ui_environment_id: uiId, backend_environment_id: backendId,
});

test('unconfigured project blocks both execution domains with no defaults', async t => {
  const f = await fixture(t);
  await assert.rejects(f.manager.assert(projectA, 'ui', f.uiTarget.id), { message: 'PROJECT_ENVIRONMENT_NOT_CONFIGURED' });
  await assert.rejects(f.manager.assert(projectA, 'backend', f.httpId), { message: 'PROJECT_ENVIRONMENT_NOT_CONFIGURED' });
  assert.deepEqual((await scriptEnvironments(f.buildManager, projectA)).environments, []);
  assert.deepEqual((await f.backend.list(projectA)).environments, []);
});

test('UI and HTTP environments bind independently and reject wrong IDs', async t => {
  const f = await fixture(t);
  const value = await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  assert.equal(value.revision, 1);
  assert.equal((await f.manager.assert(projectA, 'ui', f.uiTarget.id)).ui_environment_id, f.uiTarget.id);
  assert.equal((await f.manager.assert(projectA, 'backend', f.httpId)).backend_environment_id, f.httpId);
  await assert.rejects(f.manager.assert(projectA, 'ui', `user-target-${randomUUID()}`), { message: 'PROJECT_ENVIRONMENT_MISMATCH' });
  await assert.rejects(f.manager.assert(projectA, 'backend', `env-${randomUUID()}`), { message: 'PROJECT_ENVIRONMENT_MISMATCH' });
});

test('unknown and cross-project environments cannot be bound', async t => {
  const f = await fixture(t);
  await assert.rejects(f.manager.set(projectA, { revision: 0, ui_environment_id: 'unknown-ui', backend_environment_id: null }),
    { message: 'PROJECT_ENVIRONMENT_TARGET_INVALID' });
  await assert.rejects(f.manager.set(projectB, { revision: 0, ui_environment_id: f.uiTarget.id, backend_environment_id: null }),
    { message: 'PROJECT_ENVIRONMENT_TARGET_INVALID' });
  await assert.rejects(f.manager.set(projectB, { revision: 0, ui_environment_id: null, backend_environment_id: f.httpId }),
    { message: 'BACKEND_RECORD_NOT_FOUND' });
});

test('configuration identity changes block until explicitly rebound', async t => {
  const f = await fixture(t);
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  f.uiTarget.normal_url = 'http://127.0.0.1:4513/';
  await assert.rejects(f.manager.assert(projectA, 'ui', f.uiTarget.id), { message: 'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED' });
  const changedBackend = { ...f.backendEnvironment, base_url: 'http://127.0.0.1:4514' };
  changedBackend.configuration_sha256 = backendHash(changedBackend);
  await f.backend.save(changedBackend);
  await assert.rejects(f.manager.assert(projectA, 'backend', f.httpId), { message: 'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED' });
  await f.manager.set(projectA, { revision: 1, ui_environment_id: f.uiTarget.id, backend_environment_id: f.httpId });
  await f.manager.assert(projectA, 'ui', f.uiTarget.id);
  await f.manager.assert(projectA, 'backend', f.httpId);
});

test('revision CAS rejects stale writes; busy writes preserve the binding', async t => {
  let busy = false;
  const f = await fixture(t);
  f.manager.busy = () => busy;
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  await assert.rejects(f.manager.set(projectA, { revision: 0, ui_environment_id: f.uiTarget.id, backend_environment_id: f.httpId }),
    { message: 'PROJECT_ENVIRONMENT_REVISION_CONFLICT' });
  busy = true;
  await assert.rejects(f.manager.set(projectA, { revision: 1, ui_environment_id: null, backend_environment_id: null }),
    { message: 'PROJECT_ENVIRONMENT_BUSY' });
  busy = false;
  const current = await f.manager.binding(projectA);
  assert.equal(current.revision, 1);
  assert.equal(current.ui_environment_id, f.uiTarget.id);
  assert.equal(current.backend_environment_id, f.httpId);
});

test('persisted revisions survive reload and retain history', async t => {
  const f = await fixture(t);
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  await f.manager.set(projectA, { revision: 1, ui_environment_id: f.uiTarget.id, backend_environment_id: null });
  const reloaded = new ProjectEnvironments({ root: f.root, caseStore: f.caseStore, buildManager: f.buildManager, backendManager: f.backend });
  const binding = await reloaded.binding(projectA);
  assert.equal(binding.revision, 2);
  assert.equal(binding.backend_environment_id, null);
  const stored = JSON.parse(await fs.readFile(path.join(f.root, 'project-environments.json'), 'utf8'));
  assert.equal(stored.revisions.length, 2);
  assert.equal(stored.revisions[0].backend_environment_id, f.httpId);
});

test('corrupt environment binding storage fails closed', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'project-environments.json'), '{broken', 'utf8');
  await assert.rejects(f.manager.binding(projectA), { message: 'PROJECT_ENVIRONMENT_STORAGE_INVALID' });
});

test('catalog endpoints expose only the current environment and no implicit default', async t => {
  const f = await fixture(t);
  assert.deepEqual((await scriptEnvironments(f.buildManager, projectA)).environments, []);
  assert.deepEqual((await f.backend.list(projectA)).environments, []);
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  assert.deepEqual((await scriptEnvironments(f.buildManager, projectA)).environments.map(row => row.id), [f.uiTarget.id]);
  assert.deepEqual((await f.backend.list(projectA)).environments.map(row => row.environment_id), [f.httpId]);
});

test('generation, trial lookup, demonstration resolution, and backend plan entry points reject mismatches before work', async t => {
  const f = await fixture(t);
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  const wrongUi = `user-target-${randomUUID()}`;

  const scriptOps = new ScriptOperations({ root: path.join(f.root, 'generations'), buildManager: f.buildManager, caseStore: f.caseStore, records: async () => [] });
  await assert.rejects(scriptOps.preflight(projectA, { mode: 'generate', items: [{ case_id: 'case-x', case_version: 1 }], environment_id: wrongUi }),
    { message: 'PROJECT_ENVIRONMENT_MISMATCH' });

  let taskReads = 0;
  const trialManager = { projectEnvironments: f.manager, store: { getTask: async () => { taskReads++; throw Error('should-not-read-task'); } } };
  await assert.rejects(resolveTrialCandidate(trialManager, { project_id: projectA, environment_id: wrongUi }, false),
    { message: 'PROJECT_ENVIRONMENT_MISMATCH' });
  assert.equal(taskReads, 0);

  await assert.rejects(resolveDemonstrationEnvironment({ projectEnvironments: f.manager }, projectA, wrongUi),
    { message: 'PROJECT_ENVIRONMENT_MISMATCH' });
  await assert.rejects(f.backend.environment(projectA, `env-${randomUUID()}`), { message: 'PROJECT_ENVIRONMENT_MISMATCH' });
  await assert.rejects(f.backend.create(projectA, { environment_id: `env-${randomUUID()}` }), { message: 'PROJECT_ENVIRONMENT_MISMATCH' });
});

test('new task snapshot remains stale after same-ID configuration change and rebind', async t => {
  const f = await fixture(t);
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  const binding = await f.manager.binding(projectA);
  const task = {
    source: { project_id: projectA },
    environment_ref: { environment_id: f.uiTarget.id, project_environment_identity: structuredClone(binding.ui_identity) },
  };
  f.uiTarget.normal_url = 'http://127.0.0.1:4515/';
  await assert.rejects(f.manager.assert(projectA, 'ui', f.uiTarget.id), { message: 'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED' });
  await f.manager.set(projectA, { revision: 1, ui_environment_id: f.uiTarget.id, backend_environment_id: f.httpId });
  await f.manager.assert(projectA, 'ui', f.uiTarget.id);
  await assert.rejects(f.manager.assertTask(task), { message: 'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED' });
});

test('legacy registered task is checked against frozen network scope without rewriting task', async t => {
  const f = await fixture(t);
  await bindBoth(f.manager, f.uiTarget.id, f.httpId);
  const task = {
    source: { project_id: projectA },
    environment_ref: { environment_id: f.uiTarget.id,
      network_policy: { ...structuredClone(f.uiTarget.target_scope), configuration_sha256: f.uiTarget.configuration_sha256 } },
  };
  const before = structuredClone(task);
  await f.manager.assertTask(task);
  assert.deepEqual(task, before);

  const unverifiable = { source: { project_id: projectA }, environment_ref: { environment_id: f.uiTarget.id } };
  const unverifiableBefore = structuredClone(unverifiable);
  await assert.rejects(f.manager.assertTask(unverifiable), { message: 'PROJECT_ENVIRONMENT_SCRIPT_REGENERATION_REQUIRED' });
  assert.deepEqual(unverifiable, unverifiableBefore);
});

test('assert is busy during atomic persistence; queued stale revision cannot overwrite the winner', async t => {
  const f = await fixture(t);
  let entered;
  const persistenceEntered = new Promise(resolve => { entered = resolve; });
  let release;
  const persistGate = new Promise(resolve => { release = resolve; });
  f.manager.atomicJson = async (file, value) => {
    entered();
    await persistGate;
    return writeAtomicJson(file, value);
  };

  const first = f.manager.set(projectA, { revision: 0, ui_environment_id: f.uiTarget.id, backend_environment_id: f.httpId });
  const second = f.manager.set(projectA, { revision: 0, ui_environment_id: null, backend_environment_id: null });
  try {
    await persistenceEntered;
    await assert.rejects(f.manager.assert(projectA, 'ui', f.uiTarget.id), { message: 'PROJECT_ENVIRONMENT_BUSY' });
  } finally {
    release();
  }
  await first;
  await assert.rejects(second, { message: 'PROJECT_ENVIRONMENT_REVISION_CONFLICT' });
  const current = await f.manager.binding(projectA);
  assert.equal(current.revision, 1);
  assert.equal(current.ui_environment_id, f.uiTarget.id);
  assert.equal(current.backend_environment_id, f.httpId);
  await f.manager.assert(projectA, 'ui', f.uiTarget.id);
});
