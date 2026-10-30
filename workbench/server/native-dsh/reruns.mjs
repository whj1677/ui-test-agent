import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { importedRerunSource } from './imported-source.mjs';

const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameSha = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) && a.toLowerCase() === b.toLowerCase();
const safeError = error => /^[A-Z][A-Z0-9_]{3,120}$/.test(error?.message || '') ? error.message : 'NATIVE_DSH_RERUN_FAILED';
const unavailable = manager => !manager.accepting() || manager.shutdownRequested || manager.storageFault ? 'NATIVE_DSH_SERVICE_STOPPING'
  : manager.active || manager.starting || manager.otherActive() ? 'NATIVE_DSH_BUSY' : null;

async function resolveSelection(manager, projectId, input, {requireEnvironmentIdentity=false}={}) {
  if (!Array.isArray(input?.items) || !input.items.length || input.items.length > 20 || input.items.some(item => !item || typeof item !== 'object' || Array.isArray(item)) || new Set(input.items.map(item => item.case_id)).size !== input.items.length) throw Error('NATIVE_DSH_CASES_INVALID');
  const [projection, stored, project] = await Promise.all([manager.console(projectId), manager.load(projectId), manager.caseStore.getProject(projectId)]);
  const items = [], sources = [];
  let binding = null, environment = null;
  for (const selection of input.items) {
    const imported=selection.source_kind==='IMPORTED_SCRIPT';
    let source = imported ? projection.drafts.find(row=>row.origin==='IMPORTED_SCRIPT'&&row.draft_id===selection.source_draft_id&&row.case_id===selection.case_id&&row.case_version===selection.case_version)
      : projection.records.find(record => record.task_id === selection.source_task_id && record.run_id === selection.source_run_id);
    const sourceTask = stored.tasks.find(task => task.id === selection.source_task_id);
    let reason = selection.source_kind!==undefined&&!['RUN','IMPORTED_SCRIPT'].includes(selection.source_kind) || imported&&(selection.source_run_id!=null||selection.source_task_id!=null) ? 'NATIVE_DSH_RERUN_SOURCE_INVALID' : null;
    if(imported&&!reason&&source){
      try{const resolved=importedRerunSource(project,selection);source={...source,frozen_case_content:resolved.content};}
      catch(error){reason=safeError(error);}
    }
    if(!reason){
      if (!source || (!imported&&!sourceTask)) reason = 'NATIVE_DSH_RERUN_SOURCE_NOT_FOUND';
      else if (!imported&&(source.purpose !== 'case' || !source.recorded_counts_for_case)) reason = 'NATIVE_DSH_RERUN_FORMAL_SOURCE_REQUIRED';
      else if (!source.source.available) reason = source.source.reason;
      else if (!source.frozen_case_content || !Array.isArray(source.frozen_case_content.steps)) reason = 'NATIVE_DSH_RERUN_CASE_SNAPSHOT_MISSING';
      else if (!source.applies_to_current_version || source.case_id !== selection.case_id || source.case_version !== selection.case_version ||
        !sameSha(source.content_sha256, selection.content_sha256)) reason = 'NATIVE_DSH_CASE_CHANGED';
      else if (!sameSha(source.script_sha256, selection.script_sha256) || !sameSha(source.bundle_sha256, selection.bundle_sha256)) reason = 'NATIVE_DSH_RERUN_SOURCE_CHANGED';
    }
    if (!reason) {
      try {
        const target=imported ? await manager.projectEnvironments.binding(projectId) : null;
        const environmentId=imported?target.ui_environment_id:sourceTask.environment_id;
        const current = await manager.projectEnvironments.assert(projectId, 'ui', environmentId);
        if(imported&&requireEnvironmentIdentity&&!selection.environment_identity)throw Error('NATIVE_DSH_ENVIRONMENT_CONFIRMATION_REQUIRED');
        const expected=imported?selection.environment_identity:sourceTask.environment_identity;
        if (expected&&hash(current.ui_identity) !== hash(expected)) throw Error('NATIVE_DSH_ENVIRONMENT_CHANGED');
        const configured = manager.buildManager.developmentEnvironments.find(value => value.id === environmentId && (!value.user_registered_target || value.project_id===projectId));
        if (!configured) throw Error('NATIVE_DSH_ENVIRONMENT_NOT_FOUND');
        if (environment && environment.id !== configured.id) throw Error('NATIVE_DSH_ENVIRONMENT_CHANGED');
        binding = current; environment = configured;
      } catch (error) { reason = safeError(error); }
    }
    items.push({ ...selection, external_id: source?.external_id || '', title: source?.title || '', entry: source?.entry || null,
      source_status: imported?'NOT_RUN':source?.status || null, environment_id: imported?environment?.id||null:sourceTask?.environment_id || null,
      ...(imported&&binding?{environment_identity:structuredClone(binding.ui_identity),environment_url:environment.normal_url}:{}),ready: !reason, reason });
    sources.push(source);
  }
  let reason = items.find(item => item.reason)?.reason || null;
  if (!reason && environment.auth_requirement) {
    const auth = await manager.buildManager.authSessions.check({ project_id: projectId, ...environment.auth_requirement });
    if (auth.status !== 'VALID') reason = 'NATIVE_DSH_LOGIN_REQUIRED';
  }
  return { preview: { project_id: projectId, kind: 'FROZEN_SCRIPT_RERUN', model_calls: 0, allowed: !reason, reason, items }, sources, binding, environment };
}

export async function previewNativeRerun(manager, projectId, input) {
  const { preview } = await resolveSelection(manager, projectId, input);
  const reason = unavailable(manager) || preview.reason;
  return { ...preview, allowed: !reason, reason };
}

export async function assertNativeRerunSource(manager, projectId, item) {
  const { preview } = await resolveSelection(manager, projectId, { items: [item.rerun_source] });
  if (!preview.allowed) throw Error(preview.reason);
  if(item.rerun_source.source_kind==='IMPORTED_SCRIPT')return importedRerunSource(await manager.caseStore.getProject(projectId),item.rerun_source);
  return { runDirectory: path.join(manager.directory(projectId), 'runs', item.rerun_source.source_run_id), entry: item.formal_entry,
    script_sha256: item.rerun_source.script_sha256, bundle_sha256: item.rerun_source.bundle_sha256 };
}

export function createNativeRerun(manager, projectId, input = {}) {
  return manager.serial(async () => {
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(input.request_id || '')) throw Error('NATIVE_DSH_REQUEST_INVALID');
    if (input.allow_execution !== true || input.allow_model === true) throw Error('NATIVE_DSH_EXECUTION_NOT_AUTHORIZED');
    const stored = await manager.load(projectId), requestSha = hash(input);
    const previous = stored.tasks.find(task => task.request_id === input.request_id);
    if (previous) {
      if (previous.kind !== 'FROZEN_SCRIPT_RERUN' || previous.request_sha256 !== requestSha) throw Error('NATIVE_DSH_REQUEST_CONFLICT');
      return manager.projectResults(projectId, previous);
    }
    const blocked = unavailable(manager);
    if (blocked) throw Error(blocked);
    manager.starting = true;
    try {
      const { preview, sources, binding, environment } = await resolveSelection(manager, projectId, input,{requireEnvironmentIdentity:true});
      if (!preview.allowed) throw Error(preview.reason);
      const task = { id: `native-${randomUUID()}`, project_id: projectId, request_id: input.request_id, request_sha256: requestSha,
        kind: 'FROZEN_SCRIPT_RERUN', model_calls: 0, status: 'RUNNING', stage: '正在准备冻结脚本复跑（无模型）', created_at: now(),
        session_id: stored.session_id, environment_id: environment.id, environment_identity: binding.ui_identity, completion_policy: 'FROZEN_RUNS_FINISHED',
        items: sources.map((source, index) => ({ case_id: source.case_id, case_version: source.case_version, content_sha256: source.content_sha256,
          external_id: source.external_id, formal_entry: source.entry, content: source.frozen_case_content, status: 'NOT_RUN',
          rerun_source: { ...input.items[index] } })), runs: [], reply: '', revision_notes: '', runtime: { kind: 'FROZEN_SCRIPT_RUNNER', model: null } };
      stored.tasks.push(task); await manager.save(stored);
      const active = { projectId, taskId: task.id, controller: new AbortController(), token: randomUUID() + randomUUID(), executePromise: null };
      manager.active = active;
      manager.completion = processNativeRerun(manager, active, task).finally(() => { if (manager.active === active && !active.unconfirmed) manager.active = null; });
      manager.completion.catch(() => {});
      return structuredClone(task);
    } finally { manager.starting = false; }
  });
}

async function processNativeRerun(manager, active, task) {
  const started = Date.now();
  let release;
  try {
    const environment = manager.buildManager.developmentEnvironments.find(value => value.id === task.environment_id);
    if (!environment) throw Error('NATIVE_DSH_ENVIRONMENT_NOT_FOUND');
    active.environment = environment;
    if (environment.auth_requirement) {
      const scope = { project_id: active.projectId, ...environment.auth_requirement };
      const auth = await manager.buildManager.authSessions.check(scope);
      if (auth.status !== 'VALID') throw Error('NATIVE_DSH_LOGIN_REQUIRED');
      active.authScope = scope; active.authVersion = auth.session_version;
      release = manager.buildManager.authSessions.beginTaskProtection(scope, auth.session_version);
    }
    for (const item of task.items) {
      if (active.controller.signal.aborted) break;
      await manager.executeRequest(active.projectId, task.id, { request_id: randomUUID(), case_id: item.case_id, entry: item.formal_entry, purpose: 'case' }, `Bearer ${active.token}`);
      if (active.unconfirmed) break;
    }
    await manager.update(active.projectId, task.id, value => {
      value.status = active.unconfirmed ? 'STOP_UNCONFIRMED' : active.controller.signal.aborted ? active.controller.signal.reason === 'timeout' ? 'TIMED_OUT' : 'CANCELLED'
        : value.items.every(item => item.status === 'PASSED') ? 'COMPLETED' : value.runs.length ? 'PARTIAL' : 'FAILED';
      value.stage = active.unconfirmed ? '尚未确认复跑进程停止，保留运行锁' : value.status === 'COMPLETED' ? '冻结脚本复跑完成（无模型）' : '复跑已结束，保留实际结果与证据';
    });
  } catch (error) {
    await manager.update(active.projectId, task.id, value => {
      value.error = safeError(error); value.status = active.unconfirmed ? 'STOP_UNCONFIRMED' : active.controller.signal.aborted ? active.controller.signal.reason === 'timeout' ? 'TIMED_OUT' : 'CANCELLED' : value.error.includes('LOGIN') ? 'BLOCKED' : 'FAILED';
      value.stage = value.error;
    });
  } finally {
    if (active.executePromise) await active.executePromise.catch(() => {});
    if (active.unconfirmed) active.release = release;
    else if (typeof release === 'function') release();
    await manager.update(active.projectId, task.id, value => { if (!active.unconfirmed) value.finished_at = now(); value.elapsed_ms = Date.now() - started; });
  }
}

export function registeredRunEvidence(result, runId) {
  const idMap = new Map((result.artifacts || []).map(file => [file.id, `${runId}-${file.id}`]));
  const mapIds = (value, key = '') => {
    if (typeof value === 'string') return /(?:^|_)(?:file|artifact)_ids?$/.test(key) ? idMap.get(value) || value : value;
    if (Array.isArray(value)) return value.map(item => mapIds(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, mapIds(item, name)]));
    return value;
  };
  const registered = { ...result, artifacts: (result.artifacts || []).map(file => ({ ...file, id: idMap.get(file.id) })) };
  for (const key of ['files', 'window_recording', 'window_timeline', 'step_replay', 'step_coverage', 'caption_timeline']) {
    if (result[key] != null) registered[key] = mapIds(result[key]);
  }
  return registered;
}
