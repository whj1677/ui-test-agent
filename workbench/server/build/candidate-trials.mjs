import { reviewFor, rejectedReview } from '../batches.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { digest, evidenceFiles } from './development-session.mjs';
import { saveBundle, developmentBundle } from './development-bundle.mjs';
import { contentHash } from '../cases/excel.mjs';
import { parseCandidateReport, projectCaseStepCoverage, counterexampleDetected } from './report.mjs';
import { renderStepReplay } from './step-replay.mjs';

const identityKeys = ['project_id', 'case_id', 'case_version', 'content_sha256', 'source_task_id', 'candidate_version', 'bundle_sha256', 'environment_id'];
const identity = value => Object.fromEntries(identityKeys.map(key => [key, value[key]]));
const same = (a, b) => identityKeys.every(key => a[key] === b[key]);

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
  const task = await manager.store.getTask(request.source_task_id);
  const candidate = task?.candidates?.find(c => c.version === request.candidate_version);
  const authorization = manager.candidateTrialAuthorizations.find(a => same(a, request));
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
    if (!authorization || !authorization.lanes?.includes(request.lane)) throw new Error('TRIAL_NOT_AUTHORIZED');
    if (!environment) throw new Error('TRIAL_ENVIRONMENT_UNAVAILABLE');
    await environment.check(); // identity check only: viewing never starts a service or run
  }
  return { task, candidate, version, bundle, authorization, environment };
}

export async function caseAutomation(manager, projectId, caseId, versionNumber) {
  const mappings=manager.candidateTrialAuthorizations.filter(a=>a.project_id===projectId&&a.case_id===caseId&&a.source_binding);
  const tasks = (await manager.store.listTasks()).filter(t => t.development && ((t.source?.project_id === projectId && t.source?.case_id === caseId)||mappings.some(a=>a.source_task_id===t.task_id)));
  const output = [];
  for (const task of tasks) for (const candidate of task.candidates || []) {
    const mapped=mappings.find(a=>a.source_task_id===task.task_id&&a.candidate_version===candidate.version);
    const selection = mapped ? identity(mapped) : identity({ ...task.source, source_task_id: task.task_id, candidate_version: candidate.version, bundle_sha256: candidate.bundle?.sha256, environment_id: task.environment_ref?.environment_id });
    let reason = null;
    try { await resolveTrialCandidate(manager, { ...selection, lane: 'normal', diagnostic: true }); } catch (error) { reason = error.code === 'ENOENT' ? 'TRIAL_BUNDLE_MISSING' : error.message; }
    output.push({ selection, applies_to_selected_version: selection.case_version === versionNumber,
      files: (candidate.bundle?.files || []).map(f => ({ ...f, file_id: task.files.find(item => item.relative_path === `development/final/${f.path}`)?.file_id })), human_review_status: task.human_review_status,
      script_version: task.script_version || null, created_at: task.created_at, maintenance_mode: task.maintenance?.mode || null,
      technical_status: task.verification_status, requirement_review: reviewFor(manager,selection), reason, source_task_id: task.task_id });
  }
  return { candidates: output };
}

export async function submitCandidateTrial(manager, request) {
  if (manager.batchOwner && (request?.batch_id !== manager.batchOwner || request?.batch_token !== manager.batchToken)) throw new Error('BATCH_EXECUTOR_BUSY');
  if (!manager.runStore || !request || !/^[\w-]{8,100}$/.test(request.request_id || '') || !['normal','negative'].includes(request.lane) || Object.keys(request).some(k => ![...identityKeys,'request_id','lane','batch_id','batch_token','diagnostic'].includes(k))) throw new Error('TRIAL_REQUEST_INVALID');
  const fingerprint = digest(JSON.stringify({ ...identity(request), lane: request.lane, batch_id: request.batch_id || null, diagnostic: request.diagnostic === true }));
  const runId = `trial-${digest(request.project_id + ':' + request.request_id).slice(0, 40).toLowerCase()}`;
  // The request receipt is the durable run itself; replay works after restart.
  const previous = await manager.runStore.getRun(runId);
  if (previous) { if (previous.request_fingerprint !== fingerprint) throw new Error('TRIAL_REQUEST_CONFLICT'); return previous; }
  if (manager.starting || manager.active || manager.otherActive()) throw new Error('BUILD_TASK_ALREADY_ACTIVE');
  manager.starting = true;
  try {
    const { task, candidate, version, bundle, environment } = await resolveTrialCandidate(manager, request);
    const controller = new AbortController();
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
      execution_status: 'QUEUED', status: 'NOT_RUN', complete_pass: false, approval_status: 'NOT_APPROVED',
      harness_starts: 0, model_calls: 0, media: [], files: [], evidence_status: 'PENDING', runner_version: 'candidate-bundle-trial-v1' });
    manager.active = { taskId: task.task_id, runId, attemptId: runId, controller, phase: 'CANDIDATE_TRIAL' };
    const promise = executeTrial(manager, run, bundle, environment, controller).finally(() => { if (manager.active?.runId === runId) manager.active = null; });
    manager.completions.set(runId, promise);
    return run;
  } finally { manager.starting = false; }
}

async function executeTrial(manager, run, bundle, environment, controller) {
  const directory = manager.runStore.runDirectory(run.run_id), snapshot = path.join(directory, 'bundle'), output = path.join(directory, 'execution');
  const update = patch => manager.runStore.updateRun(run.run_id, r => ({ ...r, ...patch }));
  let lease;
  try {
    await saveBundle(bundle, snapshot);
    if ((await developmentBundle(snapshot, { validate: false })).sha256 !== bundle.sha256) throw new Error('TRIAL_SNAPSHOT_CHANGED');
    lease = await environment.acquire(run.run_type);
    if (controller.signal.aborted) throw new Error('TRIAL_CANCELLED');
    await update({ execution_status: 'RUNNING', environment_binding: lease.identity, entry_route: lease.url });
    const raw = await manager.adapter.verifyCandidate({ candidatePath: path.join(snapshot,'candidate.spec.mjs'), runDirectory: output,
      fixtureUrl: lease.url, signal: controller.signal, browserExecutable: manager.browserExecutable,
      stepObservation: { run_id: run.run_id, candidate_sha256: run.candidate_sha256, executed_external_id: run.executed_external_id,
        executed_case_id: run.case_id, executed_case_version: run.case_version, executed_content_sha256: run.content_sha256 } });
    const result = await parseCandidateReport(raw.reportPath, raw.process);
    const contract = { required_step_markers: run.frozen_case_content.steps.map(s => `CASE_STEP_${s.order}`), detection: lease.detection };
    const coverage = projectCaseStepCoverage(result, contract);
    const unchanged = (await developmentBundle(snapshot, { validate: false })).sha256 === bundle.sha256;
    await update({ result, status: result.test_status, complete_pass: result.complete_pass && coverage.complete && unchanged && !controller.signal.aborted,
      step_coverage: coverage, failure_step: coverage.items.find(s => s.error_attributed)?.marker || null, error: result.error,
      same_candidate_hash: unchanged, specified_defect_detected: run.run_type === 'negative' && unchanged && counterexampleDetected(result, contract),
      process: result.process });
    if (!unchanged) throw new Error('TRIAL_SNAPSHOT_CHANGED');
    const replay = controller.signal.aborted ? { replay: { status: 'UNAVAILABLE', reason: 'CANCELLED' } }
      : await renderStepReplay({ runDirectory: output, runId: run.run_id, candidateSha256: run.candidate_sha256,
        executedExternalId: run.executed_external_id, executedCaseVersion: run.case_version, caseContent: run.frozen_case_content, coverage, browserExecutable: manager.browserExecutable });
    const media = (await evidenceFiles(output, directory)).filter(f => mediaType(f)).map((f,i) => ({ ...f, ...mediaType(f),
      media_id: `media-${i+1}`, file_id: `media-${i+1}`, run_id: run.run_id, file_name: path.basename(f.relative_path) }));
    const complete = replay.replay.status === 'READY' && replay.replay.evidence_complete && ['video','screenshot','trace'].every(k => media.some(f => f.kind === k));
    await update({ step_replay: replay.replay, media, files: media.map(f => ({ ...f, kind: f.file_name === 'step-replay-v1.webm' ? 'trial_step_replay_video' : `trial_${f.kind}` })),
      evidence_status: complete ? 'COMPLETE' : 'INCOMPLETE', evidence_error: complete ? null : (replay.replay.reason || 'STEP_OR_MEDIA_MISSING') });
  } catch (error) { const saved = await manager.runStore.getRun(run.run_id); await update({ technical_error: { code: error.code || error.message }, evidence_status: 'INCOMPLETE', complete_pass: saved.result && !String(error.message).includes('SNAPSHOT') && !controller.signal.aborted ? saved.complete_pass : false }); }
  finally {
    try { await lease?.release(); } catch (error) { await update({ environment_cleanup_error: error.message }); }
    await update({ execution_status: controller.signal.aborted ? 'CANCELLED' : 'FINISHED', ...(controller.signal.aborted ? { complete_pass: false } : {}), finished_at: manager.now().toISOString() });
  }
}

export async function stopCandidateTrial(manager, runId) {
  if (manager.active?.runId !== runId) throw new Error('TRIAL_NOT_ACTIVE');
  manager.active.controller.abort('cancelled');
  return manager.runStore.updateRun(runId, r => ({ ...r, execution_status: 'STOPPING' }));
}

// View-only adaptation of old records. No task JSON is rewritten or re-approved.
export function developmentRecords(task) {
  if (!task.development) return [];
  const shared = { project_id: task.source.project_id, source_build_task_id: task.task_id, source_external_id: task.source.external_id,
    source_case_version: task.source.case_version, executed_case_id: task.source.case_id, executed_case_version: task.source.case_version,
    executed_external_id: task.source.external_id, frozen_case_content: task.input_bundle.snapshot.content };
  const records = [...task.development.self_tests.map(r => ({ ...r, run_id: `${task.task_id}-dev-${r.number}`, run_type: 'development',
    bundle_sha256:r.bundle_sha256 || r.bundle?.sha256, origin: 'DEVELOPMENT_SELF_TEST', status: r.result?.test_status || 'NOT_RUN', step_coverage: r.coverage, candidate_sha256: r.sha256,
    prefix: `development/run-${r.number}/`, started_at: new Date(r.started_at).toISOString() })),
  ...(task.candidates || []).flatMap(c => (c.trial_runs || []).map(r => ({ ...r, bundle_sha256: c.bundle.sha256, candidate_version:c.version, origin: 'INITIAL_INDEPENDENT_VALIDATION', prefix: `development/final/${r.run_type}/` })))];
  return records.map(r => ({ ...shared, ...r, error: r.error || r.result?.error, failure_step: r.step_coverage?.items.find(s => s.error_attributed)?.marker || null,
    files: task.files.filter(f => f.relative_path.startsWith(r.prefix) && mediaType(f)).map(f => ({ ...f, ...mediaType(f), kind: `legacy_${mediaType(f).kind}` })),
    evidence_status: 'LEGACY_STEP_CAPTURES_UNAVAILABLE' }));
}
