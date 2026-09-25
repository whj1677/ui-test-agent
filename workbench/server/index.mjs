import { BatchManager } from './batches.mjs';
import path from 'node:path';
import { frozenTrialEnvironment } from './build/trial-environment.mjs';
import { createWorkbenchServer } from './app.mjs';
import { createPaths } from './paths.mjs';
import { WorkbenchStore } from './store.mjs';
import { WorkbenchRunManager } from './executor.mjs';
import { BuildTaskStore } from './build/store.mjs';
import { BuildTaskManager } from './build/manager.mjs';
import { BuildRevalidationStore } from './build/revalidations.mjs';
import { BuildSupplementalAssessmentStore } from './build/assessments.mjs';
import { CaseLibraryStore } from './cases/store.mjs';
import { CaseLibraryManager } from './cases/manager.mjs';
import { TargetAuthSessions } from './auth/session.mjs';
import { localAuthEnvironments } from './auth/catalog.mjs';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number(process.env.WORKBENCH_PORT || 4210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_WORKBENCH_PORT');

const paths = createPaths();
const serviceInstanceId = `service-${randomUUID()}`;
const buildAuthorizationId = process.env.WORKBENCH_BUILD_AUTHORIZATION_ID || process.env.M2C_BUILD_AUTHORIZATION_ID || null;
const harnessDshHome = process.env.WORKBENCH_DSH_HOME ? process.env.WORKBENCH_DSH_HOME : undefined;
const harnessPatchPath = process.env.WORKBENCH_HARNESS_PATCH ? process.env.WORKBENCH_HARNESS_PATCH : undefined;
const useStoredDshCredentials = process.env.WORKBENCH_USE_STORED_DSH_CREDENTIALS === '1';
let modelConfiguration = null;
if (harnessPatchPath) {
  const patchText = await fs.readFile(harnessPatchPath, 'utf8');
  const provider = /^\s*provider:\s*([\w-]+)\s*$/m.exec(patchText)?.[1] || null;
  const model = /^\s*model:\s*([\w.-]+)\s*$/m.exec(patchText)?.[1] || null;
  modelConfiguration = { provider, model, profile: 'headless', protocol: provider === 'deepseek-official' ? 'official' : 'configured-provider', credential_source: useStoredDshCredentials ? 'saved-dsh-home' : 'process-environment', dsh_version: '0.1.6-alpha.2' };
}
const store = new WorkbenchStore(paths.dataRoot);
await store.init();
const recovered = await store.recoverInterrupted();
const manager = new WorkbenchRunManager({ store, paths, browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE });
const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: buildAuthorizationId || undefined });
await buildStore.init();
const buildRevalidationStore = new BuildRevalidationStore(paths.buildRevalidationsRoot, buildStore);
await buildRevalidationStore.init();
const buildAssessmentStore = new BuildSupplementalAssessmentStore(paths.buildAssessmentsRoot, buildStore);
await buildAssessmentStore.init();
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
await caseStore.init();
const caseManager = new CaseLibraryManager(caseStore);
const authSessions = new TargetAuthSessions({
  environments: localAuthEnvironments(process.env.WORKBENCH_AUTH_FIXTURE_BASE_URL),
  browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
});
const recoveredBuilds = await buildStore.recoverInterrupted(new Date().toISOString(), serviceInstanceId);
let developmentEnvironments = [];
if (process.env.WORKBENCH_DEVELOPMENT_ENVIRONMENTS) {
  developmentEnvironments = JSON.parse(await fs.readFile(process.env.WORKBENCH_DEVELOPMENT_ENVIRONMENTS, 'utf8'));
  if (!Array.isArray(developmentEnvironments)) throw new Error('DEVELOPMENT_ENVIRONMENTS_INVALID');
}
const trialConfig = process.env.WORKBENCH_CANDIDATE_TRIAL_CONFIG
  ? JSON.parse(await fs.readFile(process.env.WORKBENCH_CANDIDATE_TRIAL_CONFIG, 'utf8')) : {};
const buildManager = new BuildTaskManager({
  runStore: store,
  generationDisabled: trialConfig.model_calls_allowed === false,
  candidateTrialAuthorizations: trialConfig.authorizations || [],
  candidateTrialEnvironments: (trialConfig.environments || []).map(frozenTrialEnvironment),
  store: buildStore,
  caseStore,
  paths,
  serviceInstanceId,
  authorizationId: buildAuthorizationId,
  authSessions,
  developmentEnvironments,
  browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
  harnessDshHome,
  harnessPatchPath,
  useStoredDshCredentials,
  modelConfiguration,
  otherActive: () => Boolean(manager.active),
});
buildManager.requirementReviews = trialConfig.requirement_reviews || [];
const batchManager=new BatchManager({root:path.join(paths.dataRoot,'batches'),buildManager,caseStore,runStore:store});
await batchManager.init();
const server = createWorkbenchServer({ batchManager, store, manager, buildStore, buildManager, buildRevalidationStore, buildAssessmentStore, caseStore, caseManager, authSessions });
server.listen(port, host, () => {
  console.log(`Approved test workbench http://${host}:${port}`);
  if (recovered.length) console.log(`Recovered interrupted runs: ${recovered.join(', ')}`);
  if (recoveredBuilds.length) console.log(`Recovered interrupted build tasks: ${recoveredBuilds.join(', ')}`);
});

let shutdownStarted = false;
async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(JSON.stringify({ type: 'service_shutdown_requested', service_instance_id: serviceInstanceId, signal }));
  if (batchManager.active) { await batchManager.stop(batchManager.active.id); await batchManager.completion; }
  if (buildManager.active) await buildManager.stop(buildManager.active.taskId).catch((error) => {
    console.error(JSON.stringify({ type: 'build_stop_failed', code: error?.code || error?.message || 'UNKNOWN' }));
  });
  const drained = await Promise.race([
    buildManager.settle().then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!drained) console.error(JSON.stringify({ type: 'build_settlement_timeout', service_instance_id: serviceInstanceId }));
  await authSessions.close();
  await new Promise((resolve) => server.close(resolve));
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

// Owned test/launcher IPC only; no HTTP shutdown endpoint.
if (process.send) process.on('message', message => { if (message?.type === 'shutdown') void shutdown('owned-ipc').then(() => process.disconnect()); });
