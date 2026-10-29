import { reviewFor, rejectedReview } from '../batches.mjs';
import fs from 'node:fs/promises';
import { applyBrowserAssertionVerdict } from './browser-assertion-records.mjs';
import path from 'node:path';
import { digest, evidenceFiles } from './development-session.mjs';
import { saveBundle, developmentBundle, assertBundleTiming } from './development-bundle.mjs';
import { contentHash } from '../cases/excel.mjs';
import { parseCandidateReport, projectCaseStepCoverage, counterexampleDetected } from './report.mjs';
import { renderStepReplay } from './step-replay.mjs';
import { extractTimingObligations } from './timing-obligations.mjs';
import { applyTimingVerdict } from './timing-evidence.mjs';

const identityKeys = ['project_id', 'case_id', 'case_version', 'content_sha256', 'source_task_id', 'candidate_version', 'bundle_sha256', 'environment_id'];
const identity = value => Object.fromEntries(identityKeys.map(key => [key, value[key]]));
const same = (a, b) => identityKeys.every(key => a[key] === b[key]);
const terminalExecution = new Set(['FINISHED', 'CANCELLED', 'INTERRUPTED']);

// Read the already-frozen manifest. Never re-collect final/normal or final/negative
// as executable inputs; those are historical outputs, not candidate dependencies.
export async function loadCandidateBundle(root, manifest) {
  if (!manifest?.files?.length || digest(JSON.stringify(manifest.files)) !== manifest.sha256) throw new Error('TRIAL_BUNDLE_MANIFEST_INVALID');
  const realRoot = await fs.realpath(root), names = new Set(), entries = [];
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || !file.path || path.posix.isAbsolute(file.path) || /[\\:\x00-\x1f]/.test(file.path) || file.path.split('/').some(p => !p || p === '..' || p === '.') || names.has(file.path)) throw new Error('TRIAL_BUNDLE_PATH_INVALID');
    names.add(file.path);
    const target = path.join(root, file.path), real = await fs.realpath(target);
    if (!real.startsWith(realRoot + path.sep) || (await fs.lstat(target)).isSymbolicLink()) throw new Error('TRIAL_BUNDLE_PATH_INVALID');
    const bytes = await fs.readFile(target);
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('TRIAL_BUNDLE_CHANGED');
    entries.push({ ...file, content: bytes });
  }
  if (!names.has('candidate.spec.mjs')) throw new Error('TRIAL_ENTRY_MISSING');
  return { ...manifest, entries };
}

export function mediaType(file) {
  const ext = path.extname(file.relative_path).toLowerCase();
  return ext === '.png' ? { kind: 'screenshot', content_type: 'image/png' }
    : ext === '.webm' ? { kind: 'video', content_type: 'video/webm' }
    : ext === '.zip' ? { kind: 'trace', content_type: 'application/zip' } : null;
}

export async function resolveTrialCandidate(manager, request, checkEnvironment = true) {
  await manager.projectEnvironments?.assert(request.project_id, 'ui', request.environment_id);
  const task = await manager.store.getTask(request.source_task_id);
  if (task) await manager.projectEnvironments?.assertTask(task, request.project_id, request.environment_id);
  if (task?.auth_requirement && request.project_id !== task.source?.project_id) throw new Error('TRIAL_AUTH_PROJECT_MISMATCH');
  const candidate = task?.candidates?.find(c => c.version === request.candidate_version);
  let authorization = manager.candidateTrialAuthorizations.find(a => same(a, request));
  const mapped = authorization?.source_binding;
  if (!task?.development?.submission || task.active_attempt_id || !candidate || !same(mapped ? {...request,...mapped} : request, {
    ...task.source, source_task_id: task.task_id, candidate_version: candidate.version,
    bundle_sha256: candidate.bundle?.sha256, environment_id: task.environment_ref?.environment_id,
  })) throw new Error('TRIAL_IDENTITY_MISMATCH');
  const project = await manager.caseStore.getProject(request.project_id);
  const item = project?.cases.find(c => c.case_id === request.case_id);
  const version = item?.versions.find(v => v.version === request.case_version);
  if (!version || version.content_sha256 !== request.content_sha256 || contentHash(version.content) !== request.content_sha256) throw new Error('TRIAL_CASE_VERSION_MISMATCH');
  const bundle = await loadCandidateBundle(path.join(manager.store.taskDirectory(task.task_id), 'development/final'), candidate.bundle);
  if (bundle.files.find(f => f.path === 'candidate.spec.mjs').sha256 !== candidate.sha256 || bundle.sha256 !== task.development.submission.bundle.sha256) throw new Error('TRIAL_BUNDLE_CHANGED');
  if (mapped && task.source.content_sha256 !== request.content_sha256) throw new Error('TRIAL_REUSE_CONTENT_MISMATCH');
  const review = reviewFor(manager, request);
  if (checkEnvironment && rejectedReview(review) && request.diagnostic !== true) throw new Error('REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY');
  const environment = manager.candidateTrialEnvironments.find(e => e.id === request.environment_id);
  if (checkEnvironment) {
    if (environment?.configurationIdentity?.kind === 'registered-user-target') {
      if (environment.configurationIdentity.project_id !== request.project_id) throw new Error('TRIAL_PROJECT_MISMATCH');
      const grant = await manager.projectTrialAuthorization?.match(request, environment.configurationIdentity.configuration_sha256);
      if (!grant) throw new Error('TRIAL_NOT_AUTHORIZED');
      authorization = manager.candidateTrialAuthorizations.find(item => item.user_authorization_id === grant.authorization_id);
    }
    const authTarget = environment?.configurationIdentity?.kind === 'registered-auth-target';
    const registeredDevelopment = manager.developmentEnvironments.find(e => e.id === request.environment_id);
    if (task.auth_requirement && (!authTarget ||
        registeredDevelopment?.normal_url !== environment.configurationIdentity.normal_url ||
        registeredDevelopment?.auth_requirement?.role !== task.auth_requirement.role ||
        registeredDevelopment?.auth_requirement?.environment_id !== task.auth_requirement.environment_id ||
        manager.authSessions.environment({ project_id: request.project_id,
          environment_id: task.auth_requirement.environment_id, role: task.auth_requirement.role }).origin !== new URL(environment.configurationIdentity.normal_url).origin)) {
      throw new Error('TRIAL_AUTH_TARGET_MISMATCH');
    }
    if (!task.auth_requirement && authTarget) throw new Error('TRIAL_AUTH_TARGET_MISMATCH');
    if (task.auth_requirement) {
      const status = await manager.authSessions.check({ project_id: request.project_id,
        environment_id: task.auth_requirement.environment_id, role: task.auth_requirement.role });
      if (status.status !== 'VALID') throw new Error('AUTH_SESSION_REQUIRED');
    }
    const ownedNormalRun = manager.userInitiatedOperations === true && !mapped && task.source.project_id === request.project_id && request.lane === 'normal' &&
      ['registered-static-html', 'registered-auth-target'].includes(environment?.configurationIdentity?.kind);
    if ((!authorization || !authorization.lanes?.includes(request.lane)) && !ownedNormalRun) throw new Error('TRIAL_NOT_AUTHORIZED');
    if (!environment) throw new Error('TRIAL_ENVIRONMENT_UNAVAILABLE');
    await environment.check(); // identity check only: viewing never starts a service or run
  }
  return { task, candidate, version, bundle, authorization, environment };
}

export async function caseAutomation(manager, projectId, caseId, versionNumber, { allTasks } = {}) {
  const mappings=manager.candidateTrialAuthorizations.filter(a=>a.project_id===projectId&&a.case_id===caseId&&a.source_binding);
  // A batch preview may reuse its own task listing. Candidate identity, bundle,
  // environment and authentication checks below still read their current facts.
  const tasks = (allTasks ?? await manager.store.listTasks()).filter(t => t.development && ((t.source?.project_id === projectId && t.source?.case_id === caseId)||mappings.some(a=>a.source_task_id===t.task_id)));
  const output = [];
  for (const task of tasks) for (const candidate of task.candidates || []) {
    const mapped=mappings.find(a=>a.source_task_id===task.task_id&&a.candidate_version===candidate.version);
    const selection = mapped ? identity(mapped) : identity({ ...task.source, source_task_id: task.task_id, candidate_version: candidate.version, bundle_sha256: candidate.bundle?.sha256, environment_id: task.environment_ref?.environment_id });
    let reason = null;
    if (manager.candidateTrialEnvironments.find(e => e.id === selection.environment_id)?.configurationIdentity?.kind === 'registered-user-target' &&
        task.candidates.at(-1)?.version !== candidate.version) reason = 'PROJECT_TRIAL_CANDIDATE_EXPIRED';
    else try { await resolveTrialCandidate(manager, { ...selection, lane: 'normal', diagnostic: true }); } catch (error) { reason = error.code === 'ENOENT' ? 'TRIAL_BUNDLE_MISSING' : error.message; }
    output.push({ selection, applies_to_selected_version: selection.case_version === versionNumber,
      files: (candidate.bundle?.files || []).map(f => ({ ...f, file_id: task.files.find(item => item.relative_path === `development/final/${f.path}`)?.file_id })), human_review_status: task.human_review_status,
      script_version: task.script_version || null, created_at: task.created_at, maintenance_mode: task.maintenance?.mode || null,
      technical_status: task.verification_status, validation_source: candidate.validation_source || null, quality_policy: task.quality_policy,
      requirement_review: reviewFor(manager,selection), reason, source_task_id: task.task_id });
  }
  return { candidates: output };
}

export async function submitCandidateTrial(manager, request) {
  if (manager.batchOwner && (request?.batch_id !== manager.batchOwner || request?.batch_token !== manager.batchToken)) throw new Error('BATCH_EXECUTOR_BUSY');
  if (!manager.runStore || !request || !/^[\w-]{8,100}$/.test(request.request_id || '') || !['normal','negative'].includes(request.lane) || Object.keys(request).some(k => ![...identityKeys,'request_id','lane','batch_id','batch_token','diagnostic'].includes(k))) throw new Error('TRIAL_REQUEST_INVALID');
  const fingerprint = digest(JSON.stringify({ ...identity(request), lane: request.lane, batch_id: request.batch_id || null, diagnostic: request.diagnostic === true }));
  const runId = `trial-${digest(request.project_id + ':' + request.request_id).slice(0, 40).toLowerCase()}`;
  // The request receipt is the durable run itself; replay works after restart.
  let previous;
  try { previous = await manager.runStore.getRun(runId); }
  catch (error) { manager.reportStorageFault(error, 'trial_receipt_read'); throw error; }
  if (previous) { if (previous.request_fingerprint !== fingerprint) throw new Error('TRIAL_REQUEST_CONFLICT'); return previous; }
  manager.assertStorageWritable();
  if (manager.starting || manager.active || manager.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
  manager.starting = true;
  try {
    const { task, candidate, version, bundle, environment } = await resolveTrialCandidate(manager, request);
    const controller = new AbortController();
    manager.assertStorageWritable();
    const run = await manager.runStore.createRun({ schema: 'workbench/candidate-trial-v1', run_id: runId,
      batch_id: request.batch_id || null, requirement_review: reviewFor(manager,request), diagnostic: request.diagnostic === true,
      request_id: request.request_id, request_fingerprint: fingerprint, selection: identity(request),
      ...identity(request), source_build_task_id: task.task_id, source_case_id: task.source.case_id,
      source_external_id: task.source.external_id, source_case_version: task.source.case_version,
      executed_case_id: request.case_id, executed_case_version: request.case_version,
      executed_external_id: version.content.external_id, executed_content_sha256: request.content_sha256,
      frozen_case_content: version.content, script_version: task.script_version || null, candidate_sha256: candidate.sha256, bundle: { files: bundle.files, sha256: bundle.sha256 },
      recording: { viewport: {width:1280,height:720}, video_size: {width:1280,height:720}, device_scale_factor: 1, codec: 'Playwright WebM', encoding_parameters: 'Playwright defaults; bitrate not overridden' },
      run_type: request.lane, origin: 'EXPLICIT_CANDIDATE_TRIAL', created_at: manager.now().toISOString(), started_at: manager.now().toISOString(),
      execution_status: 'QUEUED', status: 'NOT_RUN', complete_pass: false, approval_status: task.quality_policy?.quality_review_mode === 'self-test-v1' ? 'NOT_REQUIRED' : 'NOT_APPROVED',
      harness_starts: 0, model_calls: 0, media: [], files: [], evidence_status: 'PENDING', runner_version: 'candidate-bundle-trial-v1' })
      .catch(error => { manager.reportStorageFault(error, 'trial_receipt_create'); throw error; });
    if (manager.shutdownRequested) {
      await manager.runStore.updateRun(runId, r => ({ ...r, execution_status: 'INTERRUPTED',
        technical_error: { code: 'WORKBENCH_SHUTTING_DOWN' }, finished_at: manager.now().toISOString() }))
        .catch(error => { manager.reportStorageFault(error, 'trial_shutdown_record'); throw error; });
      throw new Error('WORKBENCH_SHUTTING_DOWN');
    }
    manager.assertStorageWritable();
    manager.active = { taskId: task.task_id, runId, attemptId: runId, controller, phase: 'CANDIDATE_TRIAL' };
    const promise = executeTrial(manager, run, bundle, environment, controller, task).finally(() => { if (manager.active?.runId === runId) manager.active = null; });
    manager.completions.set(runId, promise);
    void promise.catch(error => manager.reportStorageFault(error, 'trial_background_completion'));
    return run;
  } finally { manager.starting = false; }
}

export function trialNetworkPolicy(environment) {
  const config = environment.configurationIdentity;
  return config?.kind === 'registered-user-target' || config?.kind === 'registered-auth-target' && config.project_id
    ? { origin: config.origin, path_prefix: config.path_prefix } : null;
}

async function executeTrial(manager, run, bundle, environment, controller, task) {
  const directory = manager.runStore.runDirectory(run.run_id), snapshot = path.join(directory, 'bundle'), output = path.join(directory, 'execution');
  const update = patch => manager.runStore.updateRun(run.run_id, r => ({ ...r, ...patch }))
    .catch(error => { manager.reportStorageFault(error, 'trial_result_update'); throw error; });
  let lease; let authWatch; let authBlock = null; let releaseAuthProtection = null;
  try {
    assertBundleTiming(bundle, run.frozen_case_content);
    let authBinding = null;
    if (task.auth_requirement) {
      authBinding = await manager.bindDevelopmentAuth(task);
      releaseAuthProtection = manager.authSessions.beginTaskProtection(authBinding.scope, authBinding.session_version);
      authWatch = manager.startDevelopmentAuthWatch(authBinding.scope, authBinding.session_version, controller);
      await update({ auth: { environment_id: authBinding.scope.environment_id, role: authBinding.role,
        account_id: authBinding.account_id, session_version: authBinding.session_version, bound_at: authBinding.bound_at } });
    }
    await saveBundle(bundle, snapshot)
      .catch(error => { manager.reportStorageFault(error, 'trial_snapshot_write'); throw error; });
    if ((await developmentBundle(snapshot, { validate: false })).sha256 !== bundle.sha256) throw new Error('TRIAL_SNAPSHOT_CHANGED');
    lease = await environment.acquire(run.run_type);
    if (controller.signal.aborted) throw new Error('TRIAL_CANCELLED');
    manager.assertStorageWritable();
    await update({ execution_status: 'RUNNING', environment_binding: lease.identity, entry_route: lease.url });
    const authStorageState = authBinding
      ? await manager.authSessions.stateForExecution(authBinding.scope, authBinding.session_version) : null;
    const raw = await manager.adapter.verifyCandidate({ candidatePath: path.join(snapshot,'candidate.spec.mjs'), runDirectory: output,
      fixtureUrl: lease.url, signal: controller.signal, browserExecutable: manager.browserExecutable, authStorageState,
      windowRecording: process.platform === 'win32',
      sessionTerminationEndpoints: authBinding ? manager.authSessions.environment(authBinding.scope).session_termination_endpoints || [] : [],
      networkPolicy: trialNetworkPolicy(environment),
      timingRequirements: extractTimingObligations(run.frozen_case_content),
      browserAssertionCase: run.frozen_case_content,
      stepObservation: { run_id: run.run_id, candidate_sha256: run.candidate_sha256, candidate_bundle_sha256: bundle.sha256, executed_external_id: run.executed_external_id,
        executed_case_id: run.case_id, executed_case_version: run.case_version, executed_content_sha256: run.content_sha256 } });
    const windowRecording = raw.windowRecording || (process.platform === 'win32' ? { status: 'UNAVAILABLE', reason: 'WINDOW_RECORDING_MANIFEST_MISSING' } : null);
    await update({ window_recording: windowRecording,
      ...(windowRecording ? { recording: { ...run.recording, viewport: windowRecording.viewport || null,
        viewport_source: windowRecording.viewport ? 'ACTUAL_BROWSER_WINDOW' : 'UNAVAILABLE' } } : {}) });
    if (raw.networkPolicyViolation) throw Object.assign(new Error('TARGET_SCOPE_REQUEST_BLOCKED'), { code: 'TARGET_SCOPE_REQUEST_BLOCKED' });
    const timingRequirements = extractTimingObligations(run.frozen_case_content);
    const timing = raw.timing || { required: timingRequirements.length > 0, complete: timingRequirements.length === 0, observations: [] };
    const result = applyBrowserAssertionVerdict(applyTimingVerdict(await parseCandidateReport(raw.reportPath, raw.process, {
      run_id: run.run_id, candidate_sha256: run.candidate_sha256, executed_external_id: run.executed_external_id,
      executed_case_id: run.case_id, executed_case_version: run.case_version, executed_content_sha256: run.content_sha256 }), timing), raw.browserAssertions, run.frozen_case_content);
    const contract = { required_step_markers: run.frozen_case_content.steps.map(s => `CASE_STEP_${s.order}`), detection: lease.detection };
    const coverage = projectCaseStepCoverage(result, contract);
    const unchanged = (await developmentBundle(snapshot, { validate: false })).sha256 === bundle.sha256;
    authBlock = authWatch?.detected || null;
    await update({ result, timing_validation: timing, browser_assertions: raw.browserAssertions || null, status: authBlock ? 'AUTH_SESSION_BLOCKED' : result.test_status, complete_pass: result.complete_pass && coverage.complete && unchanged && !controller.signal.aborted && !authBlock,
      step_coverage: coverage, failure_step: coverage.items.find(s => s.error_attributed)?.marker || null, error: result.error,
      same_candidate_hash: unchanged, specified_defect_detected: run.run_type === 'negative' && unchanged && counterexampleDetected(result, contract),
      process: result.process });
    if (!unchanged) throw new Error('TRIAL_SNAPSHOT_CHANGED');
    const replay = controller.signal.aborted ? { replay: { status: 'UNAVAILABLE', reason: 'CANCELLED' } }
      : await renderStepReplay({ runDirectory: output, runId: run.run_id, candidateSha256: run.candidate_sha256,
        executedExternalId: run.executed_external_id, executedCaseVersion: run.case_version, caseContent: run.frozen_case_content, coverage, browserExecutable: manager.browserExecutable });
    const media = (await evidenceFiles(output, directory)).filter(f => mediaType(f)).map((f,i) => ({ ...f, ...mediaType(f),
      media_id: `media-${i+1}`, file_id: `media-${i+1}`, run_id: run.run_id, file_name: path.basename(f.relative_path) }));
    const requiredMedia = task.auth_requirement ? ['video', 'screenshot'] : ['video', 'screenshot', 'trace'];
    const complete = replay.replay.status === 'READY' && replay.replay.evidence_complete && requiredMedia.every(k => media.some(f => f.kind === k)) &&
      (!windowRecording || windowRecording.status === 'COMPLETE' && media.some(f => f.relative_path === 'execution/artifacts/window-recording/browser-window.webm'));
    await update({ step_replay: replay.replay, media, files: media.map(f => ({ ...f, kind: f.file_name === 'step-replay-v1.webm' ? 'trial_step_replay_video' : f.relative_path === 'execution/artifacts/window-recording/browser-window.webm' && windowRecording?.reason !== 'WINDOW_RECORDING_IDENTITY_MISMATCH' ? 'trial_window_video' : `trial_${f.kind}` })),
      evidence_status: complete ? 'COMPLETE' : 'INCOMPLETE', evidence_error: complete ? null : (windowRecording && windowRecording.status !== 'COMPLETE' ? windowRecording.reason || 'WINDOW_RECORDING_INCOMPLETE' : replay.replay.reason || 'STEP_OR_MEDIA_MISSING'),
      trace_policy: task.auth_requirement ? 'DISABLED_FOR_AUTH_PRIVACY' : 'ON' });
  } catch (error) {
    if (manager.storageFault) throw error;
    authBlock ||= authWatch?.detected || (task.auth_requirement && ['AUTH_SESSION_REQUIRED', 'AUTH_SESSION_NOT_VALID'].includes(error.message)
      ? { reason: error.message, trigger: 'execution_preflight', detected_at: manager.now().toISOString() } : null);
    const saved = await manager.runStore.getRun(run.run_id)
      .catch(readError => { manager.reportStorageFault(readError, 'trial_error_read'); throw readError; });
    await update({ technical_error: { code: authBlock ? 'AUTH_SESSION_BLOCKED' : error.code || error.message },
      status: authBlock ? 'AUTH_SESSION_BLOCKED' : saved?.status || 'NOT_RUN', evidence_status: 'INCOMPLETE',
      complete_pass: authBlock ? false : saved?.result && !String(error.message).includes('SNAPSHOT') && !controller.signal.aborted ? saved.complete_pass : false });
  }
  finally {
    releaseAuthProtection?.();
    if (authWatch) { authBlock ||= authWatch.detected; manager.stopDevelopmentAuthWatch(); }
    try { await lease?.release(); } catch (error) { if (!manager.storageFault) await update({ environment_cleanup_error: error.message }); }
    if (!manager.storageFault) await update({ execution_status: controller.signal.aborted ? 'CANCELLED' : manager.shutdownRequested ? 'INTERRUPTED' : 'FINISHED',
      ...(authBlock ? { status: 'AUTH_SESSION_BLOCKED', technical_error: { code: 'AUTH_SESSION_BLOCKED' }, complete_pass: false, evidence_status: 'INCOMPLETE' }
        : controller.signal.aborted ? { complete_pass: false } : {}), finished_at: manager.now().toISOString() });
  }
}

export async function stopCandidateTrial(manager, runId) {
  const owned = manager.active?.runId === runId ? manager.active : null;
  const abortOwned = () => {
    if (owned && manager.active === owned && owned.runId === runId) owned.controller.abort('cancelled');
  };
  const current = await manager.runStore.getRun(runId)
    .catch(error => { manager.reportStorageFault(error, 'trial_stop_read'); abortOwned(); throw error; });
  if (current && terminalExecution.has(current.execution_status)) return current;
  if (!owned || manager.active !== owned) throw new Error('TRIAL_NOT_ACTIVE');
  const updated = await manager.runStore.updateRun(runId, r => terminalExecution.has(r.execution_status) || r.execution_status === 'STOPPING'
    ? r : manager.active === owned ? { ...r, execution_status: 'STOPPING' } : r)
    .catch(error => { manager.reportStorageFault(error, 'trial_stop_update'); abortOwned(); throw error; });
  if (updated.execution_status === 'STOPPING') abortOwned();
  else if (!terminalExecution.has(updated.execution_status)) throw new Error('TRIAL_NOT_ACTIVE');
  return updated;
}

// View-only adaptation of old records. No task JSON is rewritten or re-approved.
export function developmentRecords(task) {
  if (!task.development) return [];
  const shared = { project_id: task.source.project_id, source_build_task_id: task.task_id, source_external_id: task.source.external_id,
    source_case_version: task.source.case_version, executed_case_id: task.source.case_id, executed_case_version: task.source.case_version,
    executed_external_id: task.source.external_id, frozen_case_content: task.input_bundle.snapshot.content };
  const selfTestCandidates = new Map((task.candidates || []).flatMap(c => (c.trial_runs || [])
    .filter(r => r.validation_source === 'SELF_TEST' && r.bundle_sha256 === c.bundle?.sha256)
    .map(r => [r.run_id, c])));
  const records = [...task.development.self_tests.map(r => {
    const runId = `${task.task_id}-dev-${r.number}`, candidate = selfTestCandidates.get(runId);
    const binding = candidate && candidate.bundle.sha256 === (r.bundle_sha256 || r.bundle?.sha256)
      ? { candidate_version: candidate.version, validation_source: 'SELF_TEST' } : {};
    return { ...r, ...binding, run_id: runId, run_type: 'development',
    bundle_sha256:r.bundle_sha256 || r.bundle?.sha256, origin: 'DEVELOPMENT_SELF_TEST', status: r.result?.test_status || 'NOT_RUN', step_coverage: r.coverage, candidate_sha256: r.sha256,
    prefix: `development/run-${r.number}/`, started_at: new Date(r.started_at).toISOString() }; }),
  ...(task.candidates || []).flatMap(c => (c.trial_runs || []).filter(r => r.validation_source !== 'SELF_TEST')
    .map(r => ({ ...r, bundle_sha256: c.bundle.sha256, candidate_version:c.version, origin: 'INITIAL_INDEPENDENT_VALIDATION', prefix: `development/final/${r.run_type}/` })))];
  return records.map(r => {
    // Independent verification owns its frozen media manifest. Do not borrow
    // another validation's files merely because the task/candidate is the same.
    const manifest = Array.isArray(r.media) ? new Map(r.media.map(f => [`development/${f.relative_path}`, f])) : null;
    const files = task.files.filter(f => {
      if (!mediaType(f)) return false;
      if (!manifest) return f.relative_path.startsWith(r.prefix);
      const owned = manifest.get(f.relative_path);
      return owned && owned.bytes === f.bytes && owned.sha256 === f.sha256;
    }).map(f => ({ ...f, ...mediaType(f),
      run_id: r.run_id, kind: r.step_replay?.status === 'READY' && path.basename(f.relative_path) === r.step_replay.output_file_name
        ? 'development_step_replay_video' : `${r.step_replay ? 'development' : 'legacy'}_${mediaType(f).kind}` }));
    const requiredMedia = task.auth_requirement ? ['video', 'screenshot'] : ['video', 'screenshot', 'trace'];
    const complete = r.step_replay?.status === 'READY' && r.step_replay.evidence_complete &&
      files.some(f => f.kind === 'development_step_replay_video') && requiredMedia.every(kind => files.some(f => f.kind === `development_${kind}`));
    return { ...shared, ...r, error: r.error || r.result?.error, failure_step: r.step_coverage?.items.find(s => s.error_attributed)?.marker || null,
      files, evidence_status: r.step_replay ? complete ? 'COMPLETE' : 'INCOMPLETE' : 'LEGACY_STEP_CAPTURES_UNAVAILABLE',
      trace_policy: task.auth_requirement ? 'DISABLED_FOR_AUTH_PRIVACY' : r.trace_policy || 'ON' };
  });
}
