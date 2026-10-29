import { BackendManager } from './backend-manager.mjs';
import { exportNativeScriptPackages } from './native-dsh/portable.mjs';
import { BackendHarnessManager } from './backend/harness-manager.mjs';
import { ProjectTargetAccess } from './project-target-access.mjs';
import { ProjectEnvironments } from './project-environments.mjs';
import { ProjectTrialAuthorization } from './build/project-trial-authorization.mjs';
import { ScriptOperations } from './script-operations.mjs';
import { Demonstrations } from './demonstrations.mjs';
import { ReportSnapshots } from './report-snapshots.mjs';
import { nativeReportRecords } from './native-dsh/report-records.mjs';
import { projectRecords } from './execution-records.mjs';
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
import { localAuthEnvironments, configuredAuthEnvironments } from './auth/catalog.mjs';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createServiceIdentity, isolateStartupRegistries } from './service-identity.mjs';
import { createServiceShutdown } from './service-shutdown.mjs';
import { createServiceRestart } from './service-restart.mjs';
import { CaseAssistantManager } from './case-assistant/manager.mjs';
import { createCaseAssistantClient } from './case-assistant/dsh-client.mjs';
import { RequirementsManager } from './requirements/manager.mjs';
import { createRequirementsModel } from './requirements-model.mjs';
import { createCandidateQualityReviewer } from './quality-review.mjs';
import { createHarnessQualityReviewer } from './quality-review-harness.mjs';
import { createModelCredentialProvider } from './model-credentials.mjs';
import { confirmDesignedCases } from './cases/design.mjs';
import { deploymentPolicy } from './licensing/deployment-policy.mjs';
import { ensureLicensedStartup } from './licensing/activation.mjs';
import { FrontendHandoffs } from './frontend-handoffs.mjs';
import { NativeDshManager } from './native-dsh/manager.mjs';
import { createNativeDshClient } from './native-dsh/client.mjs';
import { createNativeDshRuntime } from './native-dsh/runtime.mjs';
import { nativeDshPackage } from '../scripts/native-dsh-package.mjs';
import { prepareNativeWorkspaceRuntime } from './native-dsh/workspace-runtime.mjs';
import { startupPhase } from './startup-phase.mjs';

const host = '127.0.0.1';
const port = Number(process.env.WORKBENCH_PORT || 4322);
if (port !== 4322) throw new Error('OFFICIAL_WORKBENCH_PORT_MUST_BE_4322');

// This must precede all business stores, recovery, configuration and executors.
await startupPhase('LICENSE',()=>ensureLicensedStartup(deploymentPolicy));

const paths = createPaths();
const serviceInstanceId = `service-${randomUUID()}`;
const serviceState = {accepting:true,shutting_down:false};
let requirementsManager = null;
let caseAssistantManager = null;
let backendManager;
let demonstrations = null;
let nativeDshManager = null;
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
const recovered = await startupPhase('RUN_RECOVERY',()=>store.recoverInterrupted());
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
const configuredAuthCatalog = process.env.WORKBENCH_AUTH_ENVIRONMENTS
  ? JSON.parse(await fs.readFile(process.env.WORKBENCH_AUTH_ENVIRONMENTS, 'utf8')) : null;
const authSessions = new TargetAuthSessions({
  environments: configuredAuthCatalog === null
    ? localAuthEnvironments(process.env.WORKBENCH_AUTH_FIXTURE_BASE_URL)
    : configuredAuthEnvironments(configuredAuthCatalog, process.env.WORKBENCH_AUTH_FIXTURE_BASE_URL),
  browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
});
const recoveredBuilds = await startupPhase('BUILD_RECOVERY',()=>buildStore.recoverInterrupted(new Date().toISOString(), serviceInstanceId));
let developmentEnvironments = [];
if (process.env.WORKBENCH_DEVELOPMENT_ENVIRONMENTS) {
  developmentEnvironments = JSON.parse(await fs.readFile(process.env.WORKBENCH_DEVELOPMENT_ENVIRONMENTS, 'utf8'));
  if (!Array.isArray(developmentEnvironments)) throw new Error('DEVELOPMENT_ENVIRONMENTS_INVALID');
}
const trialConfig = process.env.WORKBENCH_CANDIDATE_TRIAL_CONFIG
  ? JSON.parse(await fs.readFile(process.env.WORKBENCH_CANDIDATE_TRIAL_CONFIG, 'utf8')) : {};
// Runtime registration appends targets and exact trial grants. Keep the loaded
// startup configuration untouched so its fingerprint does not absorb data.
const runtimeRegistries = isolateStartupRegistries({trialConfig,developmentEnvironments});
const modelCredentialProvider = createModelCredentialProvider({ dshHome:harnessDshHome, useStoredCredentials:useStoredDshCredentials,
  preferWindowsCredentials:process.env.WORKBENCH_MODEL_CREDENTIAL_SOURCE==='windows-dpapi' });
const buildManager = new BuildTaskManager({
  runStore: store,
  generationDisabled: trialConfig.model_calls_allowed === false,
  candidateTrialAuthorizations: runtimeRegistries.candidateTrialAuthorizations,
  candidateTrialEnvironments: (trialConfig.environments || []).map(frozenTrialEnvironment),
  store: buildStore,
  caseStore,
  paths,
  serviceInstanceId,
  authorizationId: buildAuthorizationId,
  authSessions,
  developmentEnvironments: runtimeRegistries.developmentEnvironments,
  browserExecutable: process.env.DSH_PROBE_BROWSER_EXECUTABLE,
  harnessDshHome,
  harnessPatchPath,
  useStoredDshCredentials,
  credentialProvider: modelCredentialProvider,
  storedCredentialProvider: modelCredentialProvider,
  modelConfiguration,
  otherActive: () => Boolean(manager.active || manager.starting || manager.shutdownRequested || manager.storageFault || requirementsManager?.active || requirementsManager?.starting || caseAssistantManager?.active || caseAssistantManager?.starting || backendManager?.active || backendManager?.generationBatchActive || backendManager?.storageFault || demonstrations?.active || demonstrations?.starting),
});
buildManager.requirementReviews = trialConfig.requirement_reviews || [];
buildManager.userInitiatedOperations = trialConfig.user_initiated_operations === true;
const projectTargetAccess = new ProjectTargetAccess({root:path.join(paths.dataRoot,'project-targets'),buildManager,caseStore});
buildManager.projectTargetAccess = projectTargetAccess;
await projectTargetAccess.init();
const frontendHandoffs = new FrontendHandoffs({root:path.join(paths.dataRoot,'frontend-handoffs'),caseStore});
await frontendHandoffs.init();
buildManager.frontendHandoffs = frontendHandoffs;
const projectTrialAuthorization = new ProjectTrialAuthorization({root:path.join(paths.dataRoot,'project-trial-authorizations'),buildManager,caseStore});
buildManager.projectTrialAuthorization = projectTrialAuthorization;
await projectTrialAuthorization.init();
const batchManager=new BatchManager({root:path.join(paths.dataRoot,'batches'),buildManager,caseStore,runStore:store});
await batchManager.init();
const records = id => projectRecords({buildStore,caseStore,store,buildManager},id);
demonstrations = new Demonstrations({root:path.join(paths.dataRoot,'demonstrations'),caseStore,buildManager,
  browserExecutable:manager.browserExecutable,
  busy:()=>!serviceState.accepting || Boolean(manager.active || manager.starting || manager.storageFault ||
    buildManager.active || buildManager.starting || buildManager.storageFault || buildManager.generationOwner || buildManager.generationStarting ||
    batchManager.active || batchManager.starting || requirementsManager?.active || requirementsManager?.starting || caseAssistantManager?.active || caseAssistantManager?.starting || backendManager?.active || backendManager?.generationBatchActive || backendManager?.storageFault)});
await demonstrations.init();
buildManager.demonstrations = demonstrations;
const scriptOperations = new ScriptOperations({root:path.join(paths.dataRoot,'script-operations'),buildManager,caseStore,records,demonstrations});
await scriptOperations.init();
const reportSnapshots = new ReportSnapshots({root:path.join(paths.dataRoot,'report-snapshots'),caseStore,batchManager,
  records: async id => [...await records(id), ...await nativeReportRecords(nativeDshManager,id)],store,buildStore,
  nativeArtifact: (projectId,taskId,fileId) => nativeDshManager.artifact(projectId,taskId,fileId)});
const requirementsModel = await createRequirementsModel({disabled:buildManager.generationDisabled,
  configuration:modelConfiguration,dshHome:harnessDshHome,useStoredCredentials:useStoredDshCredentials,credentialProvider:modelCredentialProvider});
// A separate, tool-free model context checks candidate fidelity. Its verdict
// never grants approval; each development session owns the explicit budget.
const candidateQualityReviewer = createCandidateQualityReviewer({ modelClient: requirementsModel }).review;
const toolCandidateQualityReviewer = harnessDshHome ? createHarnessQualityReviewer({ dshHome: harnessDshHome,
  credentialProvider: modelCredentialProvider, configuration: modelConfiguration,
  root: path.join(paths.caseLibraryRoot, 'quality-review-harness') }).review : null;
buildManager.qualityReviewer = candidateQualityReviewer;
buildManager.toolQualityReviewer = toolCandidateQualityReviewer;
if(modelConfiguration) modelConfiguration.credential_source = buildManager.generationDisabled ? 'not-read-model-disabled' : requirementsModel?.credential_source || 'not-configured';
requirementsManager = new RequirementsManager({root:RequirementsManager.defaultRoot(paths),projectStore:caseStore,
  confirmCases:payload=>confirmDesignedCases(caseStore,payload),modelClient:requirementsModel,
  accepting:()=>serviceState.accepting&&!manager.storageFault&&!buildManager.storageFault,
  otherActive:()=>Boolean(caseAssistantManager?.active||caseAssistantManager?.starting||manager.active||manager.starting||buildManager.active||buildManager.starting||scriptOperations.active||scriptOperations.starting||batchManager.active||batchManager.starting||backendManager?.active || backendManager?.generationBatchActive || backendManager?.storageFault||demonstrations?.active||demonstrations?.starting)});
await requirementsManager.init();
const backendHarnessManager = requirementsModel && harnessDshHome ? new BackendHarnessManager({
  root:path.join(paths.caseLibraryRoot,'backend-generation'),dshHome:harnessDshHome,
  credentialProvider:modelCredentialProvider,configuration:modelConfiguration,qualityReviewer:candidateQualityReviewer,toolQualityReviewer:toolCandidateQualityReviewer,
}) : null;
backendManager = new BackendManager({root:path.join(paths.caseLibraryRoot,"backend"),caseStore,requirementsManager,runStore:store,harnessManager:backendHarnessManager,
  accepting:()=>serviceState.accepting&&!manager.storageFault&&!buildManager.storageFault,
  otherActive:()=>Boolean(manager.active||manager.starting||buildManager.active||buildManager.starting||requirementsManager.active||requirementsManager.starting||caseAssistantManager?.active||caseAssistantManager?.starting||batchManager.active||batchManager.starting||scriptOperations.active||scriptOperations.starting||demonstrations?.active||demonstrations?.starting)});
await backendManager.init();
const caseAssistantClient = buildManager.generationDisabled ? null : createCaseAssistantClient({
  config: { provider: modelConfiguration?.provider, model: modelConfiguration?.model, dshHome: harnessDshHome, credentialProvider: modelCredentialProvider },
  root: path.join(paths.caseLibraryRoot, 'case-assistant-harness'),
});
caseAssistantManager = new CaseAssistantManager({root:path.join(paths.caseLibraryRoot,'case-assistant'),
  projectStore:caseStore,sourceStore:requirementsManager.store,client:caseAssistantClient,
  accepting:()=>serviceState.accepting&&!manager.storageFault&&!buildManager.storageFault,
  otherActive:()=>Boolean(manager.active||manager.starting||buildManager.active||buildManager.starting||buildManager.generationOwner||buildManager.generationStarting||
    requirementsManager.active||requirementsManager.starting||backendManager.active||backendManager.generationBatchActive||backendManager.storageFault||
    batchManager.active||batchManager.starting||scriptOperations.active||scriptOperations.starting||demonstrations.active||demonstrations.starting)});
await caseAssistantManager.init();
batchManager.backendManager=backendManager;
const projectEnvironments = new ProjectEnvironments({root:paths.dataRoot,caseStore,buildManager,backendManager,
  busy:()=>!serviceState.accepting || (serviceState.inFlightMutations || 0) > 1 || Boolean(
    manager.active || manager.starting || manager.storageFault ||
    buildManager.active || buildManager.starting || buildManager.storageFault || buildManager.generationOwner || buildManager.generationStarting ||
    buildManager.batchStarting || buildManager.batchOwner || buildManager.caseSubmissions.size ||
    batchManager.active || batchManager.starting || scriptOperations.active || scriptOperations.starting ||
    requirementsManager.active || requirementsManager.starting || caseAssistantManager?.active || caseAssistantManager?.starting || backendManager.active || backendManager.generationBatchActive || backendManager.pendingMutations || backendManager.storageFault ||
    demonstrations.active || demonstrations.starting)});
await projectEnvironments.init();
buildManager.projectEnvironments = projectEnvironments;
backendManager.projectEnvironments = projectEnvironments;
const nativeRuntimeRoot = path.join(paths.dataRoot, 'native-dsh');
let nativeRuntime = null;
let nativeWorkspaceRuntime = null, nativeWorkspaceError = null;
if (process.env.WORKBENCH_NATIVE_DSH_BIN || process.env.WORKBENCH_NATIVE_DSH_URL) {
  try { nativeWorkspaceRuntime = await startupPhase('NATIVE_WORKSPACE',()=>prepareNativeWorkspaceRuntime({ dataRoot: paths.dataRoot })); }
  catch (error) { nativeWorkspaceError = /^NATIVE_[A-Z_]+$/.test(error?.code || '') ? error.code : 'NATIVE_DSH_WORKSPACE_UNAVAILABLE'; }
}
if (process.env.WORKBENCH_NATIVE_DSH_BIN) {
  const managedNativeDsh = await nativeDshPackage(paths.repoRoot);
  const workspace = path.join(nativeRuntimeRoot, 'host-workspace');
  await fs.mkdir(workspace, { recursive: true });
  nativeRuntime = createNativeDshRuntime({ dshBin: managedNativeDsh.binary,
    dshHome: path.join(nativeRuntimeRoot, 'runtime-home'), workspace,
    credentialProvider: modelCredentialProvider });
}
const nativeTransport = createNativeDshClient({ baseUrl: process.env.WORKBENCH_NATIVE_DSH_URL,
  ...(nativeRuntime ? { resolveBaseUrl: () => nativeRuntime.start() } : {}) });
const nativeReadiness = nativeWorkspaceError ? { available: false, error: nativeWorkspaceError } : nativeTransport.available ? await startupPhase('NATIVE_HOST',()=>nativeTransport.inspect()) : { available: false };
const nativeClient = {
  get available() { return nativeReadiness.available && nativeTransport.available; },
  get identity() { return { ...nativeTransport.identity, ...(nativeRuntime ? { runtime: nativeRuntime.inspect() } : {}), workspace_runtime: nativeWorkspaceRuntime, error: nativeReadiness.error || null }; },
  run: args => nativeTransport.run(args),
  ...(nativeRuntime ? { openBrowserSession: args => nativeTransport.openBrowserSession(args) } : {}),
  close: async () => { try { return await nativeTransport.close(); } finally { await nativeRuntime?.stop(); } },
};
nativeDshManager = new NativeDshManager({ root:path.join(paths.dataRoot,'native-dsh'), workspaceRoot:nativeWorkspaceRuntime?.projectsRoot, caseStore, projectEnvironments, buildManager,
  client:nativeClient,
  accepting:()=>serviceState.accepting && !manager.storageFault && !buildManager.storageFault,
  otherActive:()=>Boolean(manager.active || manager.starting || buildManager.active || buildManager.starting || buildManager.generationOwner || buildManager.generationStarting ||
    batchManager.active || batchManager.starting || scriptOperations.active || scriptOperations.starting || requirementsManager.active || requirementsManager.starting ||
    caseAssistantManager.active || caseAssistantManager.starting || backendManager.active || backendManager.generationBatchActive || demonstrations.active || demonstrations.starting),
});
await startupPhase('NATIVE_HISTORY',()=>nativeDshManager.init());
caseManager.scriptExporter = (project, pkg) => exportNativeScriptPackages(nativeDshManager, project, pkg);
// Every existing admission path shares the same executor lease.
for (const owner of [manager,buildManager,requirementsManager,backendManager,caseAssistantManager]) {
  const previous = owner.otherActive;
  owner.otherActive = () => Boolean(nativeDshManager.active || nativeDshManager.starting || previous?.());
}
const previousEnvironmentBusy = projectEnvironments.busy;
projectEnvironments.busy = () => Boolean(nativeDshManager.active || nativeDshManager.starting || previousEnvironmentBusy());
const serviceIdentity = await startupPhase('SERVICE_IDENTITY',()=>createServiceIdentity({repoRoot:paths.repoRoot,localRoot:paths.localRoot,instanceId:serviceInstanceId,
  configuration:{port,model:modelConfiguration,credential_policy:{use_stored_credentials:useStoredDshCredentials},development_environments:developmentEnvironments,trial:trialConfig,auth:authSessions.list(),
    native_dsh:{enabled:Boolean(nativeRuntime || process.env.WORKBENCH_NATIVE_DSH_URL),version:nativeClient.identity.version || nativeClient.identity.runtime?.expected_version || null},
    runtime_locations:{dsh:harnessDshHome||null,patch:harnessPatchPath||null,browser:manager.browserExecutable},authorization:buildAuthorizationId}}));
store.serviceIdentity = serviceIdentity;
buildStore.serviceIdentity = serviceIdentity;
reportSnapshots.serviceIdentity = serviceIdentity;
let drain;
const serviceRestart = createServiceRestart({serviceState,serviceIdentity,
  managers:{nativeDsh:nativeDshManager,caseAssistant:caseAssistantManager,run:manager,build:buildManager,batch:batchManager,script:scriptOperations,requirements:requirementsManager,backend:backendManager,demonstrations},
  inFlightMutations:()=>serviceState.inFlightMutations || 0,onDrain:()=>drain()});
manager.onStorageFault = (error,operation) => buildManager.reportStorageFault(error,operation);
manager.otherActive = () => Boolean(nativeDshManager.active||nativeDshManager.starting||buildManager.active||buildManager.starting||buildManager.storageFault||scriptOperations.active||scriptOperations.starting||batchManager.active||batchManager.starting||requirementsManager.active||requirementsManager.starting||caseAssistantManager?.active||caseAssistantManager?.starting||backendManager?.active || backendManager?.generationBatchActive || backendManager?.storageFault||demonstrations?.active||demonstrations?.starting);
const server = createWorkbenchServer({ nativeDshManager, frontendHandoffs, caseAssistantManager, demonstrations, projectEnvironments, projectTargetAccess, projectTrialAuthorization, backendManager, serviceState, serviceIdentity, serviceRestart, requirementsManager, scriptOperations, reportSnapshots, batchManager, store, manager, buildStore, buildManager, buildRevalidationStore, buildAssessmentStore, caseStore, caseManager, authSessions });
server.listen(port, host, () => {
  serviceRestart.markReady();
  console.log(`Approved test workbench http://${host}:${port}`);
  if (recovered.length) console.log(`Recovered interrupted runs: ${recovered.join(', ')}`);
  if (recoveredBuilds.length) console.log(`Recovered interrupted build tasks: ${recoveredBuilds.join(', ')}`);
});

drain = createServiceShutdown({nativeDshManager,caseAssistantManager,demonstrations,backendManager,state:serviceState,server,runManager:manager,buildManager,batchManager,scriptOperations,authSessions,requirementsManager,requirementsModel,
  onError:(error,operation)=>console.error(JSON.stringify({type:'shutdown_error',operation,code:error?.code||error?.message||'UNKNOWN'}))});
function shutdown(signal) {
  console.log(JSON.stringify({ type: 'service_shutdown_requested', service_instance_id: serviceInstanceId, signal }));
  return drain();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

// Owned test/launcher IPC only; no HTTP shutdown endpoint.
if (process.send) process.on('message', message => { if (message?.type === 'shutdown') void shutdown('owned-ipc').then(() => process.disconnect()); });
