import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizedEntry } from './execution-purpose.mjs';
import { redact } from './transcript.mjs';
import { importedScriptDrafts } from '../cases/script-package.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
const time = record => record.finished_at || record.started_at || record.created_at || '';
const newest = (a, b) => time(b).localeCompare(time(a)) || String(b.run_id || b.task_id).localeCompare(String(a.run_id || a.task_id));
const artifactUrl = (projectId, taskId, id) => `/api/case-library/projects/${encodeURIComponent(projectId)}/native-dsh/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(id)}`;
const bindingKey = row => JSON.stringify([row.project_id, row.case_id, row.case_version, row.content_sha256]);

function relativeSource(value) {
  const entry = normalizedEntry(value);
  if (entry !== value || entry.split('/').some(part => ['.private', 'node_modules', 'execute.mjs', 'current-task.json'].includes(part))) throw Error('SOURCE_PATH_INVALID');
  return entry;
}

// Read only registered frozen files. Never resolve a mutable workspace or follow a link.
export async function readFrozenNativeFile(projectDirectory, runId, relative, store = 'runs') {
  if (!(store === 'runs' ? /^run-[a-f0-9-]{36}$/ : store === 'drafts' ? /^draft-[a-f0-9-]{36}$/ : /$a/).test(runId)) throw Error('SOURCE_PATH_INVALID');
  let file = projectDirectory;
  for (const part of [store, runId, ...relativeSource(relative).split('/')]) {
    file = path.join(file, part);
    const info = await fs.lstat(file);
    if (info.isSymbolicLink()) throw Error('SOURCE_PATH_INVALID');
  }
  const info = await fs.stat(file);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw Error('SOURCE_PATH_INVALID');
  return fs.readFile(file);
}
const frozenFile = readFrozenNativeFile;

function artifactsFor(projectId, taskId, run) {
  return (run.artifacts || []).flatMap(file => {
    try {
      relativeSource(file.relative_path);
      if (typeof file.id !== 'string' || !file.id || !sha(file.sha256)) return [];
      return [{ id: file.id, name: file.name || path.posix.basename(file.relative_path), kind: file.kind || 'evidence',
        relative_path: file.relative_path, sha256: sha(file.sha256), bytes: file.bytes ?? null,
        content_type: file.content_type || file.mime_type || 'application/octet-stream', url: artifactUrl(projectId, taskId, file.id) }];
    } catch { return []; }
  });
}

function publicEvidence(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(publicEvidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /password|passwd|secret|token|cookie|authorization|api[_-]?key|credential|storage[_-]?state/i.test(key) ? '[凭据已隐藏]' : publicEvidence(item)]));
  return value;
}

function taskDiagnostics(task, projectId) {
  const token = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,119}$/.test(value) ? value : null;
  return (Array.isArray(task.diagnostics) ? task.diagnostics : []).filter(item =>
    item?.schema === 'workbench/native-dsh-task-diagnostic-v1' && item.project_id === projectId &&
    item.task_id === task.id && token(item.phase) && typeof item.summary === 'string').slice(-20).map(item => ({
      schema: item.schema, project_id: projectId, task_id: task.id,
      at: typeof item.at === 'string' ? item.at.slice(0, 80) : null,
      phase: item.phase, update_phase: ['LOAD', 'CHANGE', 'SAVE', 'CLONE'].includes(item.update_phase) ? item.update_phase : null,
      name: ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AggregateError', 'AbortError', 'DataCloneError'].includes(item.name) ? item.name : 'Error',
      code: token(item.code), syscall: ['open', 'read', 'write', 'rename', 'unlink', 'mkdir', 'stat'].includes(item.syscall) ? item.syscall : null,
      summary: redact(item.summary).slice(0, 1200),
    }));
}

function mediaProjection(run, artifacts) {
  const legacyKind = { video: 'trial_video', screenshot: 'trial_screenshot', trace: 'trial_trace' };
  const files = artifacts.map(artifact => {
    const recorded = (run.files || []).find(file => file.file_id === artifact.id || file.relative_path === artifact.relative_path && sha(file.sha256) === artifact.sha256);
    return { ...artifact, file_id: artifact.id, file_name: artifact.name, mime_type: artifact.content_type,
      kind: recorded?.kind || legacyKind[artifact.kind] || artifact.kind };
  });
  const evidence = Object.fromEntries(['execution_mode', 'page_recording', 'step_coverage', 'step_replay', 'window_recording', 'window_timeline', 'caption_timeline', 'timing_validation', 'failure_step']
    .filter(key => run[key] != null).map(key => [key, structuredClone(run[key])]));
  for (const key of ['unbound_assertions', 'evidence_mapping', 'evidence_errors']) {
    if (run[key] != null) evidence[key] = publicEvidence(run[key]);
  }
  return { ...evidence, files, evidence_status: run.evidence_status || 'NOT_CAPTURED' };
}

async function frozenSource(manager, projectId, run, artifacts, store = 'runs') {
  const unavailable = reason => ({ available: false, reason, script_url: null, manifest_url: null });
  let manifestBytes;
  try { manifestBytes = await frozenFile(manager.directory(projectId), run.id, 'source-manifest.json', store); }
  catch (error) { return unavailable(error.code === 'ENOENT' ? 'SOURCE_MANIFEST_MISSING' : 'SOURCE_MANIFEST_UNREADABLE'); }
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { return unavailable('SOURCE_MANIFEST_INVALID'); }
  try {
    const entry = relativeSource(manifest.entry), files = manifest.files;
    if (store === 'drafts' && (manifest.purpose !== 'draft' || manifest.project_id !== projectId || manifest.task_id !== run.task_id ||
      manifest.case_version !== run.case_version || sha(manifest.content_sha256) !== sha(run.content_sha256))) return unavailable('SOURCE_MANIFEST_MISMATCH');
    if (manifest.case_id !== run.external_id || entry !== run.entry || (manifest.purpose && manifest.purpose !== run.purpose) || !sha(run.script_sha256) || !sha(run.bundle_sha256) ||
      sha(manifest.script_sha256) !== sha(run.script_sha256) || sha(manifest.bundle_sha256) !== sha(run.bundle_sha256) ||
      !Array.isArray(files) || !files.length || files.length > 1000 || digest(JSON.stringify(files)) !== sha(run.bundle_sha256) ||
      files.find(file => file.path === entry)?.sha256?.toLowerCase() !== sha(run.script_sha256)) return unavailable('SOURCE_MANIFEST_MISMATCH');
    let bytes = 0;
    const seen = new Set();
    for (const file of files) {
      relativeSource(file.path);
      if (seen.has(file.path)) return unavailable('SOURCE_MANIFEST_MISMATCH');
      seen.add(file.path);
      const content = await frozenFile(manager.directory(projectId), run.id, `snapshot/${file.path}`, store);
      bytes += content.length;
      if (bytes > 20 * 1024 * 1024 || digest(content) !== sha(file.sha256)) return unavailable('SOURCE_FILE_MISMATCH');
    }
    const script = artifacts.find(file => file.relative_path === `snapshot/${entry}` && file.sha256 === sha(run.script_sha256));
    const manifestArtifact = artifacts.find(file => file.relative_path === 'source-manifest.json' && file.sha256 === digest(manifestBytes));
    if (!script || !manifestArtifact) return unavailable('SOURCE_ARTIFACT_UNREGISTERED');
    return { available: true, reason: null, script_url: script.url, manifest_url: manifestArtifact.url };
  } catch (error) { return unavailable(error.code === 'ENOENT' ? 'SOURCE_FILE_MISSING' : 'SOURCE_FILE_UNREADABLE'); }
}

function bindingFor(project, task, run) {
  const item = task.items?.find(item => item.case_id === run.case_id);
  const caseVersion = run.case_version ?? item?.case_version;
  const contentSha = sha(run.case_content_sha256 ?? item?.content_sha256);
  const externalId = run.external_id ?? item?.external_id;
  const current = project.cases.find(row => row.case_id === run.case_id);
  const version = current?.versions?.find(version => version.version === caseVersion);
  const bound = (!task.project_id || task.project_id === project.project_id) && item && Number.isSafeInteger(caseVersion) && contentSha &&
    caseVersion === item.case_version && contentSha === sha(item.content_sha256) && externalId === item.external_id &&
    version && contentSha === sha(version.content_sha256) && externalId === version.content.external_id;
  return { case_id: run.case_id, external_id: externalId || '', title: item?.content?.title || version?.content?.title || externalId || '',
    case_version: caseVersion ?? null, content_sha256: contentSha,
    binding_status: !bound ? 'UNBOUND' : current.current_version === caseVersion ? 'CURRENT' : 'HISTORICAL',
    applies_to_current_version: Boolean(bound && current.current_version === caseVersion),
    frozen_case_content: item?.content ? structuredClone(item.content) : null };
}

export async function nativeDshConsole(manager, projectId, { caseId, caseVersion, runId, summary = false } = {}) {
  const project = await manager.caseStore.getProject(projectId);
  if (!project) throw Error('NATIVE_DSH_PROJECT_NOT_FOUND');
  if (caseId && !project.cases.some(row => row.case_id === caseId) || caseVersion != null && (!caseId || !Number.isSafeInteger(caseVersion) || caseVersion < 1) ||
      runId && !/^run-[a-f0-9-]{36}$/.test(runId)) throw Error('NATIVE_DSH_CONSOLE_SCOPE_INVALID');
  const session = await manager.load(projectId);
  if (session.project_id !== projectId || project.project_id !== projectId) throw Error('NATIVE_DSH_PROJECT_MISMATCH');
  const inScope = (row, task) => (!caseId || row.case_id === caseId) &&
    (caseVersion == null || (row.case_version ?? task.items?.find(item => item.case_id === row.case_id)?.case_version) === caseVersion) && (!runId || row.id === runId);
  if (caseId || runId) session.tasks = (session.tasks || []).map(task => ({ ...task,
    runs: (task.runs || []).filter(row => inScope(row, task)), drafts: runId ? [] : (task.drafts || []).filter(row => inScope(row, task)),
  })).filter(task => task.runs.length || task.drafts.length || !runId && task.items?.some(item => inScope(item, task))).map(task => ({ ...task,
    items: (task.items || []).filter(item => (!caseId || item.case_id === caseId) && (caseVersion == null || item.case_version === caseVersion) && (!runId || task.runs.some(run => run.case_id === item.case_id))),
  }));
  session.tasks = await Promise.all((session.tasks || []).map(task => manager.projectResults(projectId, task)));
  // Independent frozen bundles are verified with bounded I/O concurrency. No hash,
  // path/link, version or binding check is cached or omitted by the summary view.
  const sourceJobs = (session.tasks || []).flatMap(task => [
    ...(task.drafts || []).map(run => ({ task, run, store: 'drafts' })),
    ...(task.runs || []).map(run => ({ task, run, store: 'runs' })),
  ]), sources = new Map();
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, sourceJobs.length) }, async () => {
    while (cursor < sourceJobs.length) {
      const { task, run, store } = sourceJobs[cursor++];
      const bound = store === 'drafts' ? { ...run, purpose: 'draft' } : { ...run, external_id: bindingFor(project, task, run).external_id };
      sources.set(`${store}/${run.id}`, await frozenSource(manager, projectId, bound, artifactsFor(projectId, task.id, run), store));
    }
  }));
  const records = [], drafts = importedScriptDrafts(project).filter(row => !runId && (!caseId || row.case_id === caseId) && (caseVersion == null || row.case_version === caseVersion));
  for (const task of session.tasks || []) {
    if (task.project_id && task.project_id !== projectId) continue;
    // Preserve registration order when two versions share the same timestamp.
    for (const draft of [...(task.drafts || [])].reverse()) {
      if (draft.schema !== 'workbench/native-dsh-draft-v1' || draft.project_id !== projectId || draft.task_id !== task.id) continue;
      const binding = bindingFor(project, task, { ...draft, case_content_sha256: draft.content_sha256 });
      const artifacts = artifactsFor(projectId, task.id, draft);
      const source = sources.get(`drafts/${draft.id}`);
      const blocker = draft.blocker && typeof draft.blocker.summary === 'string' ? {
        code: /^[A-Z][A-Z0-9_]{1,119}$/.test(draft.blocker.code || '') ? draft.blocker.code : 'OTHER_PRECONDITION',
        summary: redact(draft.blocker.summary).slice(0, 1200), source: 'DSH_REPORTED', verification_status: 'NOT_VERIFIED' } : null;
      drafts.push({ origin: 'NATIVE_DSH', project_id: projectId, task_id: task.id, draft_id: draft.id, ...binding,
        created_at: draft.created_at, entry: draft.entry, draft_status: draft.draft_status, blocker,
        execution_status: 'NOT_RUN', evidence_status: 'NOT_CAPTURED', counts_for_case: false,
        script_sha256: sha(draft.script_sha256), bundle_sha256: sha(draft.bundle_sha256), source, artifacts,
        human_review_status: 'NOT_REVIEWED', script_url: source.script_url, manifest_url: source.manifest_url });
    }
    for (const run of task.runs || []) {
      const binding = bindingFor(project, task, run), artifacts = artifactsFor(projectId, task.id, run);
      const source = sources.get(`runs/${run.id}`);
      const counted = run.purpose === 'case' && run.counts_for_case === true;
      records.push({ origin: 'NATIVE_DSH', project_id: projectId, task_id: task.id, run_id: run.id, ...binding,
        execution_kind: run.execution_kind || task.kind || 'DSH_GENERATION_SELF_TEST', source_task_id: run.source_task_id || null, source_run_id: run.source_run_id || null,
        ...(run.source_kind==='IMPORTED_SCRIPT'?{source_kind:'IMPORTED_SCRIPT',source_draft_id:run.source_draft_id}:{}),
        status: run.status, purpose: run.purpose || 'unclassified', recorded_counts_for_case: counted,
        counts_for_case: Boolean(counted && binding.binding_status !== 'UNBOUND' && source.available), is_latest_for_case: false,
        started_at: run.started_at || null, finished_at: run.finished_at || null, created_at: task.created_at || null,
        environment_binding: publicEvidence(run.environment_identity || task.environment_identity || null),
        service_identity: publicEvidence(run.service_identity || task.service_identity || null),
        error: run.error || null, entry: run.entry || null, script_sha256: sha(run.script_sha256), bundle_sha256: sha(run.bundle_sha256),
        human_review_status: 'NOT_REVIEWED', source,
        ...(summary ? { evidence_deferred: true, evidence_status: run.evidence_status || 'NOT_CAPTURED',
          assertion_coverage: assertionCoverage(run) } : { artifacts, ...mediaProjection(run, artifacts) }) });
    }
  }
  records.sort(newest);
  drafts.sort(newest);
  const latestBindings = new Set();
  for (const record of records) {
    if (!record.recorded_counts_for_case || !record.applies_to_current_version) continue;
    const key = bindingKey(record);
    if (latestBindings.has(key)) continue;
    latestBindings.add(key);
    // A newer formal result with missing source cannot silently fall back to an older pass.
    record.is_latest_for_case = record.counts_for_case;
  }
  const scriptsByIdentity = new Map();
  for (const record of records) {
    if (!record.counts_for_case) continue;
    const key = JSON.stringify([bindingKey(record), record.script_sha256, record.bundle_sha256]);
    let script = scriptsByIdentity.get(key);
    if (!script) {
      script = { ...record, script_id: `native-script-${digest(key)}`, run_ids: [], task_ids: [], latest_run_id: record.run_id,
        created_at: time(record), updated_at: time(record), script_url: record.source.script_url, manifest_url: record.source.manifest_url };
      scriptsByIdentity.set(key, script);
    }
    script.run_ids.push(record.run_id);
    if (!script.task_ids.includes(record.task_id)) script.task_ids.push(record.task_id);
    if (time(record) < script.created_at) script.created_at = time(record);
  }
  const tasks = (session.tasks || []).filter(task => !task.project_id || task.project_id === projectId).map(task => {
    const taskRecords = records.filter(record => record.task_id === task.id);
    const items = (task.items || []).map(item => {
      const latest = taskRecords.find(record => record.case_id === item.case_id && record.case_version === item.case_version &&
        record.content_sha256 === sha(item.content_sha256) && record.recorded_counts_for_case);
      const status = item.status === 'RUNNING' ? 'RUNNING' : latest?.counts_for_case ? latest.status : 'NOT_RUN';
      const draft = drafts.find(row => row.task_id === task.id && row.case_id === item.case_id && row.case_version === item.case_version && row.content_sha256 === sha(item.content_sha256));
      return { case_id: item.case_id, external_id: item.external_id, case_version: item.case_version, content_sha256: sha(item.content_sha256), status,
        ...(draft ? { draft_id: draft.draft_id, draft_status: draft.draft_status, blocker: draft.blocker } : {}) };
    });
    const completed = task.kind !== 'REGISTER_EXISTING_DRAFT' && (task.recorded_status || task.status) === 'COMPLETED';
    const status = completed ? items.every(item => item.status === 'PASSED') ? 'COMPLETED' : taskRecords.some(record => record.counts_for_case) ? 'PARTIAL' : 'FAILED' : task.status;
    const diagnostics = taskDiagnostics(task, projectId);
    return { task_id: task.id, execution_mode:task.execution_mode || 'FOREGROUND', kind: task.kind || 'DSH_GENERATION_SELF_TEST', model_calls: task.kind === 'FROZEN_SCRIPT_RERUN' ? 0 : task.model_calls ?? null,
      status, recorded_status: task.recorded_status || (status !== task.status ? task.status : null),
      created_at: task.created_at || null, finished_at: task.finished_at || null, revision_notes: task.revision_notes || '',
      run_ids: taskRecords.map(record => record.run_id), items, ...(diagnostics.length ? { diagnostics } : {}) };
  }).sort(newest);
  return { schema: 'workbench/native-dsh-console-v1', project_id: projectId, session_id: session.session_id || null,
    scripts: [...scriptsByIdentity.values()], records, drafts, tasks };
}

function assertionCoverage(run) {
  const assertions = (run.step_replay?.steps || []).flatMap(step => step.assertions || []);
  const actual = assertions.filter(value => ['PLAYWRIGHT_MATCHER_RESULT', 'PLAYWRIGHT_MATCHER_ARGUMENTS', 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS', 'PLAYWRIGHT_LOCATOR_OBSERVATION'].includes(value?.value_source) &&
    value.actual_present !== false && value.actual_recorded !== false && Object.hasOwn(value, 'actual') && value.actual !== undefined).length;
  return { total: assertions.length, actual, missing: assertions.length - actual };
}
