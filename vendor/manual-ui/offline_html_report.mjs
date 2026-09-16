import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses = new Set(['PASS','FAIL_PRODUCT','AUTOMATION_ERROR','BLOCKED_PERMISSION','BLOCKED_LOCATOR','BLOCKED_DATA','BLOCKED_ORACLE','MANUAL_REQUIRED','EXTERNAL_BLOCKED','NOT_EXECUTED','NOT_EXECUTED_AUTH']);
const statusText = value => ({PASS:'通过',FAIL_PRODUCT:'产品差异',AUTOMATION_ERROR:'自动化异常',BLOCKED_PERMISSION:'权限受阻',BLOCKED_LOCATOR:'定位受阻',BLOCKED_DATA:'数据受阻',BLOCKED_ORACLE:'预期观察受阻',MANUAL_REQUIRED:'需人工执行',EXTERNAL_BLOCKED:'外部条件受阻',NOT_EXECUTED:'未执行',NOT_EXECUTED_AUTH:'认证受阻未执行',INVALID:'无效状态'}[value] ?? value);
const validSteps = steps => Array.isArray(steps) && steps.every(x=>x && typeof x==='object' && !Array.isArray(x));
const stepsOf = item => validSteps(item?.steps) ? item.steps : [];
function caseObservations(record) {
  const value = (record.historical_result ?? record.result)?.observations;
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (typeof value === 'object' && Object.keys(value).length === 0)) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
function resultSummary(record) {
  if (record.historical_result) return record.result.reason ?? '本轮未执行；历史观察见展开详情。';
  return record.result.reason ?? (caseObservations(record) ? '已记录用例观察值，展开查看；逐步对应仍须核对证据。' : '未提供文字观察');
}
function observationText(record, stepNumber) {
  const observed = record.timeline.find(step=>step.step_number===stepNumber);
  for (const value of [observed?.actual_observation, observed?.actual_result, observed?.observation]) if (typeof value==='string' && value.trim()) return value;
  const completed = Array.isArray(record.result.observed_step_ids) && record.result.observed_step_ids.includes(stepNumber);
  const timing = observed?.observation;
  if (timing && typeof timing==='object' && Number.isFinite(timing.from_ms) && Number.isFinite(timing.to_ms) && timing.to_ms>=timing.from_ms) return `已记录观察时段：${timing.from_ms}–${timing.to_ms} ms（录像起点计时）。${completed?'已记录步骤完成；':'未记录步骤完成；'}时间记录不代表业务断言已满足，具体结果须核对原始证据。`;
  return completed ? '已记录步骤完成；未提供文字观察，具体断言须核对原始事实。' : '未记录完成或文字观察。';
}
const within = (root, target) => { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
const href = file => file.split('/').map(encodeURIComponent).join('/');

// Reject links/junctions on every component, not just on the final file. Media
// may be absolute because the standard runner records absolute artifact paths.
async function safePath(root, value, {directory = false} = {}) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f]/.test(value) || /^\w+:\/\//.test(value) || value.startsWith('\\\\') || value.startsWith('//')) throw new Error('PATH_REJECTED');
  if (value.replace(/\\/g, '/').split('/').includes('..')) throw new Error('PATH_REJECTED');
  if (value.replace(/^[A-Za-z]:[\\/]/,'').includes(':')) throw new Error('PATH_REJECTED');
  const target = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  if (!within(root, target)) throw new Error('PATH_OUTSIDE_RUN');
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of ['', ...parts]) {
    if (part) current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
    if (!within(await fs.realpath(root), await fs.realpath(current))) throw new Error('REALPATH_REJECTED');
  }
  const stat = await fs.stat(target);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error('FILE_TYPE_REJECTED');
  return target;
}

async function checkedDirectory(root, target) {
  if (!within(root, target)) throw new Error('OUTPUT_OUTSIDE_RUN');
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { await fs.mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await safePath(root, current, {directory:true});
  }
}
async function checkedWrite(root, file, data) {
  await checkedDirectory(root, path.dirname(file));
  try { if (!(await fs.lstat(file)).isFile() || (await fs.lstat(file)).isSymbolicLink()) throw new Error('OUTPUT_LINK_REJECTED'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(file, data);
}

function indexCases(items, name, issues) {
  const result = new Map();
  if (!Array.isArray(items)) { issues.push({code:`${name}_CASES_MISSING`}); return result; }
  for (const item of items) {
    if (typeof item?.case_id !== 'string' || !item.case_id.trim()) { issues.push({code:`${name}_ID_INVALID`}); continue; }
    if (result.has(item.case_id)) issues.push({code:`${name}_ID_DUPLICATE`,case_id:item.case_id});
    else result.set(item.case_id, item);
  }
  return result;
}
function sourceRows(item) { return (Array.isArray(item.original_rows) ? item.original_rows : item.raw_row ? [item.raw_row] : []).filter(x=>x && typeof x==='object' && !Array.isArray(x)); }
function moduleName(item) { const row = sourceRows(item)[0] ?? {}; return String(row['功能模块'] ?? row['所属模块'] ?? row.module ?? row['模块'] ?? '其他'); }
function comparable(steps) { return validSteps(steps) ? steps.map(x => ({step_id:x.step_id ?? null,action:x.action,observation:x.observation,expected:x.expected ?? null,source_row:x.source_row ?? null,original_step_number:x.original_step_number ?? null,requires_click:!!x.requires_click})) : null; }

// The guard may observe a current main-window tool in its redacted host stream
// before the transcript is flushed. Re-read its exact recorded segment/prefix;
// stream evidence never substitutes for an executor transcript or an invalid proof.
async function verifiedStreamEvidence(root, event) {
  const proof = event.stream_evidence;
  if (event.evidence_source !== 'HOST_STREAM_CURRENT_TOOL' || event.role !== 'supervisor' || event.agent_id != null || event.model !== 'deepseek-v4-pro' || !proof || typeof proof !== 'object') return false;
  if (typeof proof.relative_path !== 'string' || !/^(?:continuations\/[0-9]{4}\/)?host-events\.jsonl$/.test(proof.relative_path)) return false;
  const control = await safePath(root, 'control', {directory:true});
  const file = await safePath(control, proof.relative_path);
  const directory = path.dirname(file);
  const segment = path.relative(control, directory).split(path.sep).join('/') || '.';
  const process = JSON.parse(await fs.readFile(await safePath(control, path.join(directory, 'process.json')), 'utf8'));
  if (process.run_id !== event.run_id || proof.run_id !== event.run_id || !proof.launch_id || proof.launch_id !== process.launch_id || proof.segment !== segment) return false;
  if (!Number.isSafeInteger(proof.bytes) || proof.bytes <= 0 || !proof.message_id || !proof.received_at || !proof.tool_name) return false;
  const raw = await fs.readFile(file);
  if (raw.length < proof.bytes) return false;
  const prefix = raw.subarray(0, proof.bytes);
  if (sha(prefix) !== proof.sha256) return false;
  const entries = new TextDecoder('utf-8', {fatal:true}).decode(prefix).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  const matches = entries.filter(entry => entry.type === 'assistant').flatMap(entry => (Array.isArray(entry.tool_uses) ? entry.tool_uses : []).filter(tool => tool && tool.id === event.tool_use_id).map(tool => ({entry,tool})));
  if (matches.length !== 1) return false;
  const {entry, tool} = matches[0], context = entry.host_stream;
  return !!context && entry.model === event.model && entry.session_id === event.session_id && entry.session_id === proof.session_id
    && entry.message_id === proof.message_id && Object.hasOwn(entry, 'parent_tool_use_id') && entry.parent_tool_use_id === null
    && tool.id === proof.tool_use_id && tool.name === event.tool_name && tool.name === proof.tool_name
    && context.launch_id === proof.launch_id && context.run_id === proof.run_id && context.segment === proof.segment && context.received_at === proof.received_at;
}


async function hookEvidenceIntact(root, runId) {
  const relative = 'control/model-hook-failures';
  const present = await fs.lstat(path.join(root, relative)).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!present) return true;
  const directory = await safePath(root, relative, {directory:true});
  for (const name of await fs.readdir(directory)) {
    // A leftover atomic-write temporary is an unresolved persistence failure,
    // even if it happens to contain complete JSON for a different run.
    if (!name.endsWith('.json')) return false;
    const file = await safePath(directory, name);
    const marker = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)
        || marker.schema_version !== 'manual-case-ui-automation/hook-failure-v1'
        || marker.event_kind !== 'HOOK_EVIDENCE_PERSISTENCE_FAILURE'
        || typeof marker.run_id !== 'string' || !marker.run_id.trim()) return false;
    if (marker.run_id === runId) return false;
  }
  return true;
}


async function verifiedHostToolCoverage(root, entries, receipt) {
  const protocol = 'current-tool-stream-v1';
  const control = await safePath(root, 'control', {directory:true});
  const directories = [control];
  const continuations = path.join(control, 'continuations');
  const present = await fs.lstat(continuations).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (present) {
    await safePath(control, continuations, {directory:true});
    for (const name of (await fs.readdir(continuations)).filter(name => /^[0-9]{4}$/.test(name)).sort()) directories.push(path.join(continuations, name));
  }
  const segments = [];
  for (const directory of directories) {
    const processFile = path.join(directory, 'process.json');
    const exists = await fs.lstat(processFile).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!exists) continue;
    const processBytes = await fs.readFile(await safePath(control, processFile));
    const process = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(processBytes));
    if (!Object.hasOwn(process, 'evidence_protocol')) continue;
    if (process.evidence_protocol !== protocol || process.run_id !== receipt.run_id || !process.launch_id) return false;
    const segment = path.relative(control, directory).split(path.sep).join('/') || '.';
    const bytes = await fs.readFile(await safePath(control, path.join(directory, 'host-events.jsonl')));
    if (!bytes.length || bytes.at(-1) !== 10) return false;
    const rows = new TextDecoder('utf-8', {fatal:true}).decode(bytes).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
    let observed = 0;
    for (const row of rows) {
      const context = row.host_stream;
      if (!context || context.run_id !== receipt.run_id || context.launch_id !== process.launch_id || context.segment !== segment) return false;
      if (row.type !== 'assistant') continue;
      if (row.tool_uses !== undefined && !Array.isArray(row.tool_uses)) return false;
      for (const tool of row.tool_uses ?? []) {
        if (!tool?.id || !tool.name || !row.session_id || !Object.hasOwn(row, 'parent_tool_use_id')) return false;
        const role = row.parent_tool_use_id === null ? 'supervisor' : 'executor';
        if (!entries.some(event => event.run_id === receipt.run_id && event.session_id === row.session_id && event.event_kind === 'hook'
          && event.role === role && event.tool_use_id === tool.id && event.tool_name === tool.name
          && event.launcher_context && Object.keys(event.launcher_context).length === 3
          && event.launcher_context.run_id === receipt.run_id && event.launcher_context.launch_id === process.launch_id && event.launcher_context.segment === segment)) return false;
        observed += 1;
      }
    }
    segments.push({segment,launch_id:process.launch_id,process_sha256:sha(processBytes),stream_bytes:bytes.length,stream_sha256:sha(bytes),observed_tools:observed});
  }
  const proof = receipt.host_tool_coverage;
  if (!proof) return segments.length === 0;
  const status = segments.length ? 'VERIFIED' : 'LEGACY_NOT_CAPTURED';
  if (proof.protocol !== protocol || proof.status !== status || !Array.isArray(proof.segments) || proof.segments.length !== segments.length
      || proof.observed_tools !== segments.reduce((sum, segment) => sum + segment.observed_tools, 0)) return false;
  return segments.every((segment, index) => Object.keys(segment).every(key => proof.segments[index]?.[key] === segment[key]));
}


async function verifiedModels(projectDir, facts) {
  let root = projectDir;
  if (process.env.MANUAL_UI_CLAUDE_CONTROL) {
    const selected = path.resolve(process.env.MANUAL_UI_CLAUDE_CONTROL);
    if (selected !== path.join(projectDir,'control') && selected !== path.join(path.dirname(projectDir),'control')) return null;
    root = path.dirname(selected);
  }
  try {
    // A continuation leaves the initial receipt immutable. A present but invalid
    // latest receipt must not fall back to a successful historical receipt.
    const latest = 'control/model-verification.latest.json';
    const receiptPath = await fs.lstat(path.join(root,latest)).then(() => latest, error => {
      if (error.code === 'ENOENT') return 'control/model-verification.json';
      throw error;
    });
    const receipt = JSON.parse(await fs.readFile(await safePath(root,receiptPath),'utf8'));
    if (receipt.schema_version !== 'manual-case-ui-automation/claude-models-v1' || receipt.status !== 'VERIFIED' || !facts.model_run_id || facts.model_run_id !== receipt.run_id || receipt.evidence_file !== 'model-events.jsonl') return null;
    if (!await hookEvidenceIntact(root, receipt.run_id)) return null;
    const bytes = await fs.readFile(await safePath(root,'control/model-events.jsonl'));
    if (sha(bytes) !== receipt.evidence_sha256) return null;
    const entries = bytes.toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    const expected = {supervisor:'deepseek-v4-pro',executor:'deepseek-v4-flash-vision-exp'};
    if (entries.length !== receipt.entries || !Object.entries(expected).every(([role,model])=>receipt.models?.[role]===model && entries.some(x=>x.role===role))) return null;
    if (!entries.length || entries.some(x=>x.run_id!==receipt.run_id || x.decision!=='allow' || x.event_kind!=='hook' || expected[x.role]!==x.model || !x.session_id || !x.tool_use_id || (x.role==='supervisor' ? !!x.agent_id : !x.agent_id))) return null;
    for (const entry of entries) {
      if (entry.evidence_source === 'HOST_STREAM_CURRENT_TOOL' ? !await verifiedStreamEvidence(root, entry) : !entry.transcript_sha256) return null;
    }
    if (new Set(entries.map(x=>x.session_id)).size !== 1) return null;
    if (!await verifiedHostToolCoverage(root, entries, receipt)) return null;
    return {status:'RUNTIME_REPORTED_VERIFIED',models:expected,evidence_sha256:receipt.evidence_sha256,run_id:receipt.run_id};
  } catch { return null; }
}

/** A report receipt proves deterministic structural checks, never product acceptance
 * or actual video playback. The input bytes and original machine facts stay intact. */
export async function generateOfflineReport({runDir, projectDir}) {
  runDir = path.resolve(runDir); projectDir = path.resolve(projectDir ?? path.join(runDir, '..', '..'));
  await safePath(runDir, runDir, {directory:true});
  await safePath(projectDir, projectDir, {directory:true});
  const issues = [];
  const readInput = async (root, file, required = true) => {
    try { const filename = await safePath(root, file); const bytes = await fs.readFile(filename); return {value:JSON.parse(bytes),sha256:sha(bytes)}; }
    catch (error) { if (required) issues.push({code:'INPUT_UNAVAILABLE',file,error:error.code ?? error.message}); return {value:null,sha256:null}; }
  };
  const factInput = await readInput(runDir, 'machine-facts.json');
  const importInput = await readInput(projectDir, 'cases/case-import.json');
  const facts = factInput.value ?? {};
  const imported = importInput.value ?? {};
  const authStopped = facts.authentication?.status && facts.authentication.status !== 'AUTH_SUCCEEDED';
  const planInput = await readInput(runDir, 'frozen-case-plan.json', !authStopped);
  const plan = planInput.value ?? {};
  if (!facts.run_id) issues.push({code:'RUN_ID_MISSING'});
  if (plan.run_id && plan.run_id !== facts.run_id) issues.push({code:'PLAN_RUN_MISMATCH'});
  if (facts.frozen_plan_sha256 && facts.frozen_plan_sha256 !== planInput.sha256) issues.push({code:'PLAN_HASH_MISMATCH'});
  if (facts.case_import_sha256 !== importInput.sha256) issues.push({code:'SOURCE_BINDING_MISSING_OR_MISMATCH'});
  const originals = indexCases(imported.cases, 'SOURCE', issues);
  const results = indexCases(facts.cases, 'FACT', issues);
  const planned = planInput.value ? indexCases(plan.cases, 'PLAN', issues) : new Map();
  if (!originals.size) issues.push({code:'SOURCE_CASE_SET_EMPTY'});
  if (imported.case_count !== originals.size) issues.push({code:'SOURCE_COUNT_MISMATCH'});
  for (const [id, result] of results) {
    if (!originals.has(id)) issues.push({code:'FACT_ID_EXTRA',case_id:id});
    if (!statuses.has(result.status)) issues.push({code:'STATUS_INVALID',case_id:id,status:result.status});
  }
  for (const id of planned.keys()) if (!originals.has(id)) issues.push({code:'PLAN_ID_EXTRA',case_id:id});
  const cleanup = indexCases(facts.cleanup_ledger ?? [], 'CLEANUP', issues);
  const reportDir = path.join(runDir, 'report');
  try {
    await safePath(runDir, reportDir, {directory:true});
    const previous = JSON.parse(await fs.readFile(await safePath(runDir,path.join(reportDir,'data','validation.json')),'utf8'));
    if (previous.schema_version !== 'manual-case-ui-automation/offline-report-v1') throw new Error('REPORT_DIRECTORY_NOT_OWNED');
    // Preserve the previous generated bundle outside the new portable bundle.
    // This also prevents stale, no-longer-referenced media from being shipped.
    await fs.rename(reportDir,path.join(runDir,`report-previous-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const present = await fs.lstat(reportDir).catch(()=>null);
    if (present && (await fs.readdir(reportDir)).length) throw new Error('REPORT_DIRECTORY_NOT_OWNED');
  }
  await checkedDirectory(runDir, reportDir);
  const copied = new Map(); const assets = [];
  const copyMedia = async (value, kind, expectedHash, caseId) => {
    if (!value) return null;
    try {
      const input = await safePath(runDir, value);
      const extension = path.extname(input).toLowerCase();
      if (!(kind === 'videos' ? ['.webm','.mp4'] : ['.png','.jpg','.jpeg','.webp']).includes(extension)) throw new Error('MEDIA_EXTENSION_REJECTED');
      const bytes = await fs.readFile(input);
      if (!bytes.length) throw new Error('MEDIA_EMPTY');
      const hash = sha(bytes);
      if (!expectedHash) issues.push({code:'MEDIA_HASH_UNBOUND',case_id:caseId,kind});
      else if (expectedHash !== hash) { issues.push({code:'MEDIA_HASH_MISMATCH',case_id:caseId,kind}); return null; }
      const key = `${kind}:${hash}:${path.basename(input)}`;
      if (copied.has(key)) return copied.get(key);
      const relative = `assets/${kind}/${hash.slice(0,16)}-${path.basename(input)}`;
      await checkedWrite(runDir, path.join(reportDir, relative), bytes);
      assets.push({path:relative,sha256:hash,bytes:bytes.length});
      copied.set(key,relative); return relative;
    } catch (error) { issues.push({code:'MEDIA_UNAVAILABLE',case_id:caseId,kind,error:error.code ?? error.message}); return null; }
  };
  const synthetic = facts.execution_driver !== 'STANDARD_PLAYWRIGHT' || facts.product_environment_access !== true;
  if (facts.retry && !Array.isArray(facts.retry.selected_case_ids)) issues.push({code:'RETRY_SELECTION_INVALID'});
  if (facts.batch && !Array.isArray(facts.batch.selected_case_ids)) issues.push({code:'BATCH_SELECTION_INVALID'});
  if (facts.batch && facts.retry) issues.push({code:'BATCH_RETRY_SELECTION_CONFLICT'});
  const selection = facts.retry ?? facts.batch;
  const selectionKind = facts.retry ? 'RETRY' : 'BATCH';
  const selectedIds = Array.isArray(selection?.selected_case_ids) ? selection.selected_case_ids : [];
  const selected = selection ? new Set(selectedIds) : null;
  if (selected && selected.size !== selectedIds.length) issues.push({code:`${selectionKind}_ID_DUPLICATE`});
  if (selected) for (const id of selected) if (!originals.has(id)) issues.push({code:`${selectionKind}_ID_INVALID`,case_id:id});
  const records = [];
  for (const [id, original] of originals) {
    const result = results.get(id) ?? {case_id:id,status:'NOT_EXECUTED',reason:'本次事实源缺少该用例记录'};
    const frozen = planned.get(id);
    if (!validSteps(original.steps) || !original.steps.length) issues.push({code:'SOURCE_STEPS_INVALID',case_id:id});
    if (frozen?.classification === 'runnable' && !validSteps(frozen.steps)) issues.push({code:'PLAN_STEPS_INVALID',case_id:id});
    if (!results.has(id)) issues.push({code:'FACT_ID_MISSING',case_id:id});
    if (!frozen && !authStopped) issues.push({code:'PLAN_ID_MISSING',case_id:id});
    if (frozen?.classification === 'runnable' && JSON.stringify(comparable(frozen.steps)) !== JSON.stringify(comparable(original.steps))) issues.push({code:'ORACLE_OR_STEPS_CHANGED',case_id:id});
    if (frozen?.steps && frozen.classification !== 'runnable' && JSON.stringify(comparable(frozen.steps)) !== JSON.stringify(comparable(original.steps))) issues.push({code:'ORACLE_OR_STEPS_CHANGED',case_id:id});
    if (result.status === 'PASS' && frozen?.classification !== 'runnable') issues.push({code:'PASS_WITHOUT_RUNNABLE_PLAN',case_id:id});
    if (result.run_id && result.run_id !== facts.run_id) issues.push({code:'CASE_RUN_MISMATCH',case_id:id});
    const observed = Array.isArray(result.observed_step_ids) ? result.observed_step_ids : [];
    const expected = stepsOf(original).map((_,i) => i+1);
    if (observed.some(n => !expected.includes(n)) || new Set(observed).size !== observed.length) issues.push({code:'OBSERVED_STEPS_INVALID',case_id:id});
    if (result.status === 'PASS' && JSON.stringify(observed) !== JSON.stringify(expected)) issues.push({code:'PASS_STEPS_INCOMPLETE',case_id:id});
    const video = await copyMedia(result.video,'videos',result.video_sha256,id);
    const screenshots = [];
    const mainShot = await copyMedia(result.screenshot,'screenshots',result.screenshot_sha256,id);
    if (mainShot) screenshots.push({path:mainShot,label:'结果截图'});
    let timeline = [];
    if (result.timeline_path) {
      try {
        const filename = await safePath(runDir,result.timeline_path); const bytes = await fs.readFile(filename);
        if (result.timeline_sha256 !== sha(bytes)) issues.push({code:'TIMELINE_HASH_MISMATCH',case_id:id});
        else { const parsed = JSON.parse(bytes); if (!Array.isArray(parsed) || parsed.some(x=>!x || typeof x!=='object' || Array.isArray(x) || !Number.isInteger(x.step_number))) throw new Error('TIMELINE_INVALID'); timeline = parsed; }
      } catch(error) { issues.push({code:'TIMELINE_UNAVAILABLE',case_id:id,error:error.code ?? error.message}); }
    }
    for (const step of timeline) {
      const shot = await copyMedia(step.screenshot,'screenshots',step.screenshot_sha256,id);
      if (shot) screenshots.push({path:shot,label:`步骤 ${step.step_number}`});
    }
    const attempted = !!result.video || observed.length > 0 || ['PASS','FAIL_PRODUCT'].includes(result.status);
    if (attempted && !video) issues.push({code:'VIDEO_REQUIRED',case_id:id});
    if (attempted && !screenshots.length) issues.push({code:'SCREENSHOT_REQUIRED',case_id:id});
    if (result.status === 'PASS' && result.media_verification_status !== 'VERIFIED') issues.push({code:'PASS_MEDIA_NOT_VERIFIED',case_id:id});
    const clean = cleanup.get(id) ?? result.cleanup ?? {status:frozen?.cleanup_required === false ? 'NOT_APPLICABLE':'NOT_RECORDED'};
    if (attempted && frozen?.cleanup_required === true && clean.status !== 'CLEAN') issues.push({code:'CLEANUP_INCOMPLETE',case_id:id});
    const originCurrent = result.evidence_origin === undefined || ['current','current_run'].includes(result.evidence_origin);
    const current = (!result.run_id || result.run_id === facts.run_id) && (!selected || selected.has(id)) && !result.inherited_from_run_id && originCurrent;
    if (!originCurrent) issues.push({code:'CASE_EVIDENCE_NOT_CURRENT',case_id:id});
    if (selected && !selected.has(id) && attempted) issues.push({code:`${selectionKind}_UNSELECTED_EXECUTION`,case_id:id});
    const confirmedObservation = current && !synthetic && observed.length > 0 && !!video;
    const currentResult = current ? result : {case_id:id,status:'NOT_EXECUTED',reason:'本次未执行；已提供的历史、夹具或未选范围结果仅在详情中保留。'};
    records.push({case_id:id,module:moduleName(original),original,result:currentResult,historical_result:current?null:result,cleanup:clean,video,screenshots,timeline,attempted,current,product_observation:confirmedObservation,evidence_status:issues.some(x=>x.case_id===id)?'INCOMPLETE':'STRUCTURALLY_CHECKED'});
  }
  const summary = {total:originals.size,selected_cases:selected ? [...selected].filter(id=>originals.has(id)).length : originals.size,not_selected_cases:selected ? [...originals.keys()].filter(id=>!selected.has(id)).length : 0,by_status:{},product_cases_with_observed_steps:records.filter(x=>x.product_observation).length,fixture_cases:records.filter(x=>x.attempted && (synthetic || /fixture|synthetic/i.test(String((x.historical_result ?? x.result).evidence_origin ?? '')))).length,case_evidence_incomplete:records.filter(x=>x.evidence_status==='INCOMPLETE').length};
  for (const record of records) summary.by_status[statuses.has(record.result.status)?record.result.status:'INVALID'] = (summary.by_status[statuses.has(record.result.status)?record.result.status:'INVALID'] ?? 0)+1;
  const modelEvidence = await verifiedModels(projectDir,facts);
  const validation = {schema_version:'manual-case-ui-automation/offline-report-v1',generated_at:new Date().toISOString(),run_id:facts.run_id ?? null,status:issues.length?'INCOMPLETE':'COMPLETE',meaning:'Deterministic structure and hash checks only. Not product acceptance, video playback or privacy approval.',inputs:{machine_facts_sha256:factInput.sha256,case_import_sha256:importInput.sha256,frozen_plan_sha256:planInput.sha256},summary,issues,assets,model_verification:modelEvidence?.status ?? 'UNVERIFIED',model_evidence:modelEvidence,media_semantic_review_status:facts.media_semantic_review_status ?? 'PENDING',reviewer_status:facts.reviewer_status ?? 'PENDING'};
  const data = {validation,source:{source_file:imported.source_file ?? null,case_count:imported.case_count},facts,plan,cases:records};
  // Every render rewrites the receipt; a prior COMPLETE receipt cannot survive
  // a new failed validation. Original facts are copied as data, never rewritten.
  await checkedWrite(runDir,path.join(reportDir,'data','results.json'),JSON.stringify(data,null,2));
  await checkedWrite(runDir,path.join(reportDir,'data','validation.json'),JSON.stringify(validation,null,2));
  const output = path.join(reportDir,'index.html');
  await checkedWrite(runDir,output,render(data));
  const legacyOutput = path.join(runDir,'report.html');
  const parentRun = facts.retry?.parent_run_id;
  const parentLink = typeof parentRun === 'string' && /^[A-Za-z0-9_-]+$/.test(parentRun) ? `<p>本次为局部技术重试；未选用例不重跑。父运行：<a href="../${encodeURIComponent(parentRun)}/report.html">${esc(parentRun)}</a>（仅原工程内可用，不包含在本次离线包）</p>` : '';
  await checkedWrite(runDir,legacyOutput,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>UI 测试报告</title><a href="report/index.html">打开完整离线测试报告（含录像）</a>${parentLink}</html>`);
  return {output,legacyOutput,validation};
}

function render({validation:v,source,facts,cases}) {
  const modules = [...new Set(cases.map(x=>x.module))];
  const options = Object.keys(v.summary.by_status);
  const rows = cases.map((record,index)=> {
    const {original,result}=record;
    const originals = sourceRows(original);
    const fields = originals.map((raw,i)=>`<h4>原表第 ${i+1} 行（历史结果不代表本轮结果）</h4><dl>${Object.entries(raw).map(([key,value])=>`<dt>${esc(key)}</dt><dd class="preserve">${esc(value)}</dd>`).join('')}</dl>`).join('');
    const steps = stepsOf(original).map((step,i)=>`<tr class="${result.failed_step===i+1?'failed':''}"><td>${i+1}${step.vector_ref?`<br>参数：${esc(step.vector_ref)}<br>输入：${esc(typeof step.vector_input==='string'?step.vector_input:JSON.stringify(step.vector_input))}<br>预期分支：${esc(step.vector_expected_branch??'未记录')}`:''}</td><td class="preserve">${esc(step.action)}</td><td class="preserve">${esc(step.expected)}</td><td class="preserve">${esc(observationText(record,i+1))}</td></tr>`).join('');
    const statusClass = result.status==='PASS'?'pass':result.status==='FAIL_PRODUCT'?'fail':result.status==='AUTOMATION_ERROR'?'error':'blocked';
    const raw = originals[0]??{};
    const originalSteps = validSteps(original.original_steps) && original.original_steps.length ? original.original_steps : stepsOf(original);
    const briefSteps = originalSteps.map(s=>s.action).join('\n');
    const briefExpected = originalSteps.map(s=>s.expected).join('\n');
    return `<tbody class="case-group" data-module="${esc(record.module)}" data-status="${esc(result.status)}"><tr><td class="case-id">${esc(record.case_id)}</td><td>${esc(record.module)}</td><td>${esc(original.title)}</td><td class="preserve">${esc(raw['测试场景']??raw.scenario??'')}</td><td class="preserve">${esc(briefSteps)}</td><td class="preserve">${esc(briefExpected)}</td><td><span class="badge ${statusClass}" title="${esc(result.status)}">${esc(statusText(result.status))}</span><p class="preserve">${esc(resultSummary(record))}</p><small>${esc(result.error_code)}</small></td><td>${esc(record.cleanup.status)}<p>${esc(record.cleanup.error_code)}</p></td><td><button class="expand-case" aria-expanded="false" aria-controls="detail-${index}">查看证据 · ${record.video?'有录像':'无录像'}</button></td></tr><tr id="detail-${index}" class="detail-row" hidden><td colspan="9"><section class="detail"><h3>${esc(record.case_id)} · ${esc(original.title)}</h3><p>证据结构：${esc(record.evidence_status)} · 业务断言：${esc(result.business_status??'未单独记录')} · 机器媒体：${esc(result.media_status??'未单独记录')} · 清理：${esc(result.cleanup_status??record.cleanup.status)} · 媒体语义复核：${esc(v.media_semantic_review_status)} · 失败步骤：${esc(result.failed_step??'未记录')}</p>${record.historical_result?`<div class="notice">以下媒体来自历史、夹具或未选范围结果，本轮状态为未执行。原记录状态：${esc(statusText(record.historical_result.status))}（${esc(record.historical_result.status)}）</div>`:''}<div class="evidence-grid"><div>${record.video?`<video controls preload="metadata" ${record.screenshots[0]?`poster="${href(record.screenshots[0].path)}"`:''} src="${href(record.video)}">浏览器无法播放此录像。</video><a download href="${href(record.video)}">下载原始录像</a><p class="muted">存在文件不等于可播放或已完成视觉复核。</p>`:'<div class="empty">本用例无可用录像；未执行不生成替代录像。</div>'}</div><div class="shots">${record.screenshots.map(s=>`<a href="${href(s.path)}" target="_blank" rel="noopener"><img loading="lazy" src="${href(s.path)}" alt="${esc(s.label)}"><span>${esc(s.label)}</span></a>`).join('')}</div></div><h4>${original.original_steps?'参数执行映射与本轮观察（原步骤见主表和原行）':'原始步骤与本轮观察'}</h4><table class="steps"><thead><tr><th>步骤</th><th>${original.original_steps?'映射操作':'原操作'}</th><th>${original.original_steps?'映射预期':'原预期'}</th><th>本轮观察</th></tr></thead><tbody>${steps}</tbody></table>${caseObservations(record)?`<h4>${record.historical_result?'历史执行器记录的观察':'执行器记录的用例观察'}</h4><p class="muted">以下是原始观察值；未自动分配到步骤，不替代原预期、逐步证据或独立审核。</p><pre class="preserve">${esc(caseObservations(record))}</pre>`:''}${fields}<h4>当前用例校验问题</h4><ul>${v.issues.filter(x=>x.case_id===record.case_id).map(x=>`<li>${esc(x.code)}</li>`).join('')||'<li>未发现结构问题；不代表最终验收通过。</li>'}</ul></section></td></tr></tbody>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(source.source_file??'UI 自动化')} · 测试报告</title><style>
  :root{font-family:Arial,"Microsoft YaHei",sans-serif;color:#20334d;background:#f3f6fb}*{box-sizing:border-box}body{margin:0}header{background:#183656;color:#fff;padding:28px 32px}h1{margin:6px 0 12px;font-size:27px}header p{margin:7px 0;overflow-wrap:anywhere}header small{color:#bfd0e7}.overview{display:flex;gap:12px;flex-wrap:wrap;margin:22px 28px}.metric{background:white;border:1px solid #dae3ef;border-radius:10px;padding:16px 22px;min-width:150px}.metric strong{font-size:27px;display:block;margin-bottom:6px}.notice{margin:16px 28px;padding:14px 18px;background:#fff3d8;border-left:4px solid #d99718;border-radius:4px}.layout{display:grid;grid-template-columns:180px minmax(0,1fr);gap:18px;margin:20px 28px}aside{background:white;padding:14px;border:1px solid #dae3ef;border-radius:10px;align-self:start;position:sticky;top:12px}button{font:inherit;border:0;border-radius:6px;padding:9px 10px;background:#e9f0f8;color:#183656;cursor:pointer}aside button{display:block;width:100%;text-align:left;margin:7px 0}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}input,select{font:inherit;padding:10px;border:1px solid #bdcde1;border-radius:6px}input{min-width:240px;flex:1}.table-wrap{overflow:auto;background:white;border:1px solid #cfdbea;border-radius:9px;max-height:76vh}table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px}th{background:#e2ebf6;color:#24476e;position:sticky;top:0;z-index:3;text-align:left;padding:13px 12px;white-space:nowrap;border-bottom:1px solid #bdcde1}td{vertical-align:top;padding:13px 12px;border-bottom:1px solid #dce5f0;min-width:110px;max-width:320px;overflow-wrap:anywhere}.case-group:nth-of-type(even){background:#f7f9fc}.case-id{position:sticky;left:0;background:#eff4fa;min-width:80px;font-weight:bold;z-index:2}.preserve{white-space:pre-wrap;line-height:1.65}.badge{display:inline-block;padding:5px 8px;border-radius:5px;font-weight:bold;font-size:11px}.pass{background:#dff3e8;color:#146044}.fail{background:#ffe3e3;color:#a02233}.error{background:#ffedd5;color:#a44a14}.blocked{background:#e8edf3;color:#52647b}small,.muted{color:#6c7d92}.detail{padding:20px;background:#fff;border:1px solid #c9d7e8;border-radius:8px;width:100%;max-width:1080px;margin:0 auto}summary{cursor:pointer;color:#245c99;min-width:150px}h3,h4{color:#24476e}.evidence-grid{display:grid;grid-template-columns:2fr 1fr;gap:18px}video{width:100%;max-height:500px;background:#152639;border-radius:8px}.shots{display:flex;gap:10px;flex-wrap:wrap;align-content:start}.shots a{width:130px;font-size:12px;color:#245c99}.shots img{width:100%;border:1px solid #d5e0eb;border-radius:4px}.empty{padding:45px 20px;background:#f2f5f9;color:#60748c}.steps th{position:static}.steps td{max-width:400px}dl{display:grid;grid-template-columns:130px minmax(0,1fr);border:1px solid #dde5ee}dt,dd{padding:10px;margin:0;border-bottom:1px solid #dde5ee}dt{background:#f0f4f9}dd{overflow-wrap:anywhere}.failed{background:#fff0f0}footer{padding:20px 28px;color:#6c7d92;font-size:12px}a{color:#245c99}[hidden]{display:none!important}.issues{margin:16px 28px}.issues details{padding:12px;background:white;border:1px solid #d5e0eb}
  @media(max-width:850px){.layout{grid-template-columns:1fr;margin:12px}aside{position:static;display:flex;flex-wrap:wrap;gap:6px}aside button{width:auto}.evidence-grid{grid-template-columns:1fr}.overview,.notice{margin:12px}.detail{width:100%}}@media print{header{background:white;color:black}.layout{display:block;margin:0}aside,.toolbar,video{display:none}.table-wrap{overflow:visible;max-height:none}th,.case-id{position:static}.detail{width:100%;border:0}.overview{margin:12px 0}.case-group{break-inside:avoid}a{color:black}}
  </style></head><body><header><small>MANUAL CASE · UI TEST REPORT</small><h1>人工用例执行报告</h1><p>${esc(path.basename(String(source.source_file??'来源未记录')).split(/[/\\]/).at(-1))} · ${esc(facts.run_id??'运行未记录')}</p><p>生成时间：${esc(v.generated_at)} · 来源摘要：${esc(v.inputs.case_import_sha256)}</p><p>主窗口模型：${esc(v.model_evidence?.models.supervisor ?? "未验证")} · 执行窗口模型：${esc(v.model_evidence?.models.executor ?? "未验证")} · 主管验收：${esc(v.reviewer_status)}</p></header><div class="overview"><div class="metric"><strong>${v.summary.total}</strong>原始用例</div><div class="metric"><strong>${v.summary.selected_cases}</strong>本轮选择</div><div class="metric"><strong>${v.summary.product_cases_with_observed_steps}</strong>本轮有业务步骤证据</div><div class="metric"><strong>${v.summary.fixture_cases}</strong>夹具尝试（不计产品执行）</div>${Object.entries(v.summary.by_status).map(([s,n])=>`<div class="metric"><strong>${n}</strong>${esc(statusText(s))}</div>`).join('')}</div><div class="notice">报告结构校验：<b>${v.status}</b> · ${v.issues.length} 项问题。状态按原用例互斥统计；部分步骤、夹具、历史和局部重试不能计作完整产品通过。媒体播放与隐私复核仍需独立验收。${facts.batch?` 本次批次：${esc(facts.batch.batch_id)}；执行周期：${esc(facts.batch.batch_group_id)}；未选 ${v.summary.not_selected_cases} 条。`:""}${facts.retry?` 本次局部重试，父运行：${esc(facts.retry.parent_run_id)}；未选用例保持本次未执行。`:''}</div><div class="layout"><aside><b>功能模块</b><button data-module="">全部模块</button>${modules.map(m=>`<button data-module="${esc(m)}">${esc(m)}</button>`).join('')}</aside><main><div class="toolbar"><input id="search" aria-label="搜索用例" placeholder="搜索编号、步骤、预期或实际结果"><select id="status" aria-label="执行状态"><option value="">全部状态</option>${options.map(s=>`<option value="${esc(s)}">${esc(statusText(s))}</option>`).join('')}</select><button id="reset">重置筛选</button><span id="visible"></span></div><div class="table-wrap"><table><thead><tr><th>用例编号</th><th>功能模块</th><th>测试项</th><th>测试场景</th><th>原测试步骤</th><th>原预期结果</th><th>本轮实际结果／状态</th><th>清理</th><th>录像与详情</th></tr></thead>${rows}</table></div></main></div><div class="issues"><details><summary>报告校验明细（${v.issues.length}）</summary><ul>${v.issues.map(x=>`<li>${esc(x.case_id??'全局')} · ${esc(x.code)}</li>`).join('')||'<li>结构校验完成；媒体播放、视觉语义及产品结论须单独验收。</li>'}</ul></details></div><footer><a href="data/results.json" download>下载事实与原用例 JSON</a> · <a href="data/validation.json" download>下载本次结构校验收据</a> · 所有媒体使用包内相对路径。转发时请包含 assets 和 data 目录。</footer><script>
  (()=>{let module='';const groups=[...document.querySelectorAll('.case-group')];const search=document.getElementById('search');const status=document.getElementById('status');const apply=()=>{let count=0;const q=search.value.toLocaleLowerCase();for(const row of groups){row.hidden=!!((module&&row.dataset.module!==module)||(status.value&&row.dataset.status!==status.value)||(q&&!row.textContent.toLocaleLowerCase().includes(q)));if(!row.hidden)count++}document.getElementById('visible').textContent=count+' 条用例'};search.addEventListener('input',apply);status.addEventListener('change',apply);document.querySelectorAll('aside button').forEach(b=>b.addEventListener('click',()=>{module=b.dataset.module;apply()}));document.querySelectorAll('.expand-case').forEach(button=>button.addEventListener('click',()=>{const target=document.getElementById(button.getAttribute('aria-controls'));target.hidden=!target.hidden;button.setAttribute('aria-expanded',String(!target.hidden));}));document.getElementById('reset').addEventListener('click',()=>{module='';search.value='';status.value='';apply()});apply()})();
  </script></body></html>`;
}
