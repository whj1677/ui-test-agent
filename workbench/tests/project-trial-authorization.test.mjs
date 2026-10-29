import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createPaths } from '../server/paths.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';
import { ProjectTrialAuthorization } from '../server/build/project-trial-authorization.mjs';
import { ProjectTargetAccess } from '../server/project-target-access.mjs';
import { isolateStartupRegistries } from '../server/service-identity.mjs';
import { resolveTrialCandidate } from '../server/build/candidate-trials.mjs';

const keys = ['project_id', 'case_id', 'case_version', 'content_sha256', 'source_task_id', 'candidate_version', 'bundle_sha256', 'environment_id'];

async function fixture(t, { atomicJson } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-trial-authorization-'));
  const paths = createPaths({ localRoot: root });
  const store = new BuildTaskStore(paths.buildTasksRoot);
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
  await Promise.all([store.init(), caseStore.init()]);
  const project = await caseStore.createProject({ name: '授权回归 fixture' });
  const caseId = `case-${randomUUID()}`;
  const taskId = `build-${randomUUID()}`;
  const environmentId = 'registered-target';
  const origin = 'http://127.0.0.1:4462';
  const pathPrefix = '/api';
  const configurationSha = 'C'.repeat(64);
  const content = { external_id: 'AUTH-CASE', title: '冻结业务用例', status: 'CONFIRMED', steps: [{ order: 1, action: '读取记录', expected: '按已确认用例判断' }] };
  const contentSha = contentHash(content);
  await caseStore.updateProject(project.project_id, project.revision, current => ({
    ...current,
    cases: [{ case_id: caseId, current_version: 1, versions: [{ version: 1, content, content_sha256: contentSha }] }],
  }));
  await store.createTask({
    task_id: taskId,
    source: { project_id: project.project_id, case_id: caseId, case_version: 1, content_sha256: contentSha, external_id: content.external_id },
    files: [], candidates: [], environment_ref: { environment_id: environmentId, network_policy: { origin, path_prefix: pathPrefix } },
    development: { submission: null }, active_attempt_id: null,
  });
  const final = path.join(store.taskDirectory(taskId), 'development', 'final');
  await fs.mkdir(final, { recursive: true });
  await fs.writeFile(path.join(final, 'candidate.spec.mjs'), "import './helper.mjs';\n");
  await fs.writeFile(path.join(final, 'helper.mjs'), 'export const fixture = true;\n');
  const bundle = await developmentBundle(final, { validate: false });
  const candidateSha = bundle.files.find(file => file.path === 'candidate.spec.mjs').sha256;
  await store.updateTask(taskId, current => ({
    ...current,
    development: { submission: { bundle } },
    candidates: [{ version: 1, sha256: candidateSha, bundle, trial_runs: [] }],
  }));

  const environment = { id: environmentId, configurationIdentity: {
    kind: 'registered-user-target', project_id: project.project_id,
    configuration_sha256: configurationSha, origin, path_prefix: pathPrefix,
  }, check: async () => {} };
  const buildManager = {
    store, caseStore, candidateTrialEnvironments: [environment], developmentEnvironments: [], candidateTrialAuthorizations: [], requirementReviews: [],
    projectTargetAccess: { get: async (projectId, id) => projectId === project.project_id && id === environmentId
      ? { configuration_sha256: configurationSha } : null },
  };
  const selection = {
    project_id: project.project_id, case_id: caseId, case_version: 1, content_sha256: contentSha,
    source_task_id: taskId, candidate_version: 1, bundle_sha256: bundle.sha256, environment_id: environmentId,
  };
  const makeAuthorization = options => new ProjectTrialAuthorization({ root, buildManager, caseStore, ...options });
  const auth = makeAuthorization({ atomicJson });
  buildManager.projectTrialAuthorization = auth;
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  return { root, store, caseStore, project, caseId, taskId, environmentId, configurationSha, contentSha, bundle, selection, buildManager, auth, makeAuthorization };
}

const request = (selection, overrides = {}) => ({ selection: { ...selection }, operator: '本机回归操作者', confirm_technical_trial: true, ...overrides });

test('persisted target and exact grant install into runtime without changing loaded startup registries', async t => {
  const f = await fixture(t);
  const startup = {trialConfig:{authorizations:[]},developmentEnvironments:[]};
  const before = JSON.stringify(startup);
  const runtime = isolateStartupRegistries(startup);
  f.buildManager.candidateTrialAuthorizations = runtime.candidateTrialAuthorizations;
  f.buildManager.developmentEnvironments = runtime.developmentEnvironments;
  const targets = new ProjectTargetAccess({root:f.root,buildManager:f.buildManager,caseStore:f.caseStore});
  targets.install({environment_id:'additional-user-target',name:'registered target',entry_url:'http://127.0.0.1:4462/api',
    project_id:f.project.project_id,origin:'http://127.0.0.1:4462',path_prefix:'/api',configuration_sha256:'D'.repeat(64)});
  assert.equal(f.buildManager.developmentEnvironments.length,1);
  await f.auth.init();
  const issued = await f.auth.authorize(f.project.project_id,request(f.selection));
  assert.equal(f.buildManager.candidateTrialAuthorizations.length,1);
  assert.equal(JSON.stringify(startup),before);
  const reloaded = f.makeAuthorization();
  f.buildManager.candidateTrialAuthorizations = isolateStartupRegistries(startup).candidateTrialAuthorizations;
  await reloaded.init();
  assert.equal(f.buildManager.candidateTrialAuthorizations[0].user_authorization_id,issued.authorization_id);
  assert.equal(JSON.stringify(startup),before);
});

test('authorization is exact to project, frozen case/candidate identity and normal lane; project rename keeps the same grant', async t => {
  const f = await fixture(t);
  await f.auth.init();
  await assert.rejects(f.auth.authorize('project-other-12345678', request(f.selection)), /PROJECT_TRIAL_AUTHORIZATION_CONFIRMATION_REQUIRED/);
  await assert.rejects(f.auth.authorize(f.project.project_id, request(f.selection, { confirm_technical_trial: false })), /PROJECT_TRIAL_AUTHORIZATION_CONFIRMATION_REQUIRED/);
  await assert.rejects(f.auth.authorize(f.project.project_id, request(f.selection, { selection: { ...f.selection, lane: 'negative' } })), /PROJECT_TRIAL_AUTHORIZATION_CONFIRMATION_REQUIRED/);
  await assert.rejects(f.auth.authorize(f.project.project_id, request({ ...f.selection, case_version: 2 })), /TRIAL_IDENTITY_MISMATCH/);
  await assert.rejects(f.auth.authorize(f.project.project_id, request({ ...f.selection, candidate_version: 9 })), /TRIAL_IDENTITY_MISMATCH/);

  const issued = await f.auth.authorize(f.project.project_id, request(f.selection));
  assert.equal((await f.auth.match(f.selection, f.configurationSha)).authorization_id, issued.authorization_id);
  const normal = await resolveTrialCandidate(f.buildManager, { ...f.selection, lane: 'normal' });
  assert.equal(normal.authorization.user_authorization_id, issued.authorization_id);
  await assert.rejects(resolveTrialCandidate(f.buildManager, { ...f.selection, lane: 'negative' }), /TRIAL_NOT_AUTHORIZED/);

  const currentProject = await f.caseStore.getProject(f.project.project_id);
  await f.caseStore.updateProject(currentProject.project_id, currentProject.revision, value => ({ ...value, name: '改名后仍为同一项目' }));
  assert.equal((await f.auth.list(f.project.project_id)).authorizations[0].current, true);
  assert.equal((await f.auth.match(f.selection, f.configurationSha)).authorization_id, issued.authorization_id);
});

test('a new candidate version does not inherit the old grant, and a newer case version makes its grant stale', async t => {
  const f = await fixture(t);
  await f.auth.init();
  const first = await f.auth.authorize(f.project.project_id, request(f.selection));
  const task = await f.store.getTask(f.taskId);
  await f.store.updateTask(f.taskId, value => ({ ...value,
    candidates: [...value.candidates, { ...value.candidates[0], version: 2, trial_runs: [] }],
  }));
  const candidateTwo = { ...f.selection, candidate_version: 2 };
  assert.equal(await f.auth.match(candidateTwo, f.configurationSha), null);
  assert.equal((await f.auth.list(f.project.project_id)).authorizations.find(row => row.authorization_id === first.authorization_id).current, false);
  await assert.rejects(f.auth.authorize(f.project.project_id, request(f.selection)), /PROJECT_TRIAL_CANDIDATE_EXPIRED/);
  const second = await f.auth.authorize(f.project.project_id, request(candidateTwo));
  assert.notEqual(second.authorization_id, first.authorization_id);
  assert.equal((await f.auth.match(candidateTwo, f.configurationSha)).authorization_id, second.authorization_id);

  const currentProject = await f.caseStore.getProject(f.project.project_id);
  const nextContent = { ...currentProject.cases[0].versions[0].content, title: '新版冻结业务用例' };
  const nextHash = contentHash(nextContent);
  await f.caseStore.updateProject(currentProject.project_id, currentProject.revision, value => ({
    ...value, cases: value.cases.map(item => ({ ...item, current_version: 2,
      versions: [...item.versions, { version: 2, content: nextContent, content_sha256: nextHash }],
    })),
  }));
  assert.equal(await f.auth.match(candidateTwo, f.configurationSha), null);
  assert.equal((await f.auth.list(f.project.project_id)).authorizations.every(row => row.current === false), true);
  const beforeStaleAuthorize = (await f.auth.list(f.project.project_id)).authorizations.length;
  await assert.rejects(f.auth.authorize(f.project.project_id, request(candidateTwo)), /PROJECT_TRIAL_CASE_VERSION_EXPIRED/);
  assert.equal((await f.auth.list(f.project.project_id)).authorizations.length, beforeStaleAuthorize);
  assert.ok(task.candidates[0].version === 1, 'fixture candidate starts as a frozen version-1 snapshot');
});

test('init restores only the exact durable grant; failed atomic save changes neither memory nor match and retry persists it', async t => {
  const f = await fixture(t);
  await f.auth.init();
  let attempts = 0;
  const durable = [];
  const auth = f.makeAuthorization({ atomicJson: async (_file, value) => {
    attempts++;
    if (attempts === 1) throw new Error('FIXTURE_ATOMIC_WRITE_FAILED');
    durable.push(structuredClone(value));
    await fs.writeFile(path.join(f.root, 'project-trial-authorizations.json'), JSON.stringify(value));
  } });
  f.buildManager.projectTrialAuthorization = auth;
  await auth.init();
  const before = f.buildManager.candidateTrialAuthorizations.length;
  await assert.rejects(auth.authorize(f.project.project_id, request(f.selection)), /FIXTURE_ATOMIC_WRITE_FAILED/);
  assert.equal((await auth.list(f.project.project_id)).authorizations.length, 0);
  assert.equal(await auth.match(f.selection, f.configurationSha), null);
  assert.equal(f.buildManager.candidateTrialAuthorizations.length, before);

  const saved = await auth.authorize(f.project.project_id, request(f.selection));
  assert.equal(attempts, 2);
  assert.equal(durable.at(-1).entries.length, 1);
  assert.equal((await auth.match(f.selection, f.configurationSha)).authorization_id, saved.authorization_id);
  const restartedManager = { ...f.buildManager, candidateTrialAuthorizations: [] };
  const restarted = new ProjectTrialAuthorization({ root: f.root, buildManager: restartedManager, caseStore: f.caseStore });
  restartedManager.projectTrialAuthorization = restarted;
  await restarted.init();
  assert.equal((await restarted.match(f.selection, f.configurationSha)).authorization_id, saved.authorization_id);
  assert.equal(restartedManager.candidateTrialAuthorizations.length, 1);
  assert.equal(restartedManager.candidateTrialAuthorizations[0].lanes.join(','), 'normal');
});
