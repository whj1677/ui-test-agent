import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { snapshotSources, collectArtifacts, rejectSymlinkPath, inside } from './executor.mjs';
import { executionPurpose } from './execution-purpose.mjs';
import { redact } from './transcript.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameSha = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/i.test(a) && a.toLowerCase() === b.toLowerCase();
const blockerCodes = new Set(['MISSING_AUTHORIZED_TEST_DATA', 'TARGET_UNAVAILABLE', 'LOGIN_REQUIRED', 'OTHER_PRECONDITION']);
export const REGISTER_EXISTING_DRAFT = 'REGISTER_EXISTING_DRAFT';

export async function prepareExistingDraftWorkspace(source, workspace, item) {
  if (inside(path.resolve(source), path.resolve(workspace)) || inside(path.resolve(workspace), path.resolve(source))) throw Error('NATIVE_DRAFT_DIRECTORY_UNSAFE');
  await rejectSymlinkPath(path.resolve(source)); await rejectSymlinkPath(path.resolve(workspace));
  try { if (!(await fs.stat(path.join(source, item.formal_entry))).isFile()) throw Error('NATIVE_ENTRY_NOT_IN_SOURCE_BUNDLE'); }
  catch (error) { if (error.code === 'ENOENT') throw Error('NATIVE_ENTRY_NOT_IN_SOURCE_BUNDLE'); throw error; }
  await fs.mkdir(workspace, { recursive: true });
  const manifest = await snapshotSources(path.resolve(source), path.resolve(workspace), item.formal_entry);
  return { script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256 };
}

function boundItem(project, task, input) {
  const item = task.items.find(row => row.case_id === input.case_id);
  if (!item) throw Error('NATIVE_DSH_CASE_NOT_IN_TASK');
  const current = project?.cases.find(row => row.case_id === item.case_id);
  const version = current?.versions.find(row => row.version === current.current_version);
  if (!version || current.current_version !== input.case_version || item.case_version !== input.case_version ||
    !sameSha(item.content_sha256, input.content_sha256) || !sameSha(version.content_sha256, input.content_sha256) ||
    version.content.status !== 'CONFIRMED' || version.content.case_type !== 'UI') throw Error('NATIVE_DSH_CASE_CHANGED');
  executionPurpose({ entry: input.entry, purpose: 'case' }, item);
  if (input.entry !== item.formal_entry) throw Error('NATIVE_DSH_FORMAL_ENTRY_MISMATCH');
  return item;
}

export function registerNativeDraft(manager, projectId, taskId, input, authorization) {
  const active = manager.active;
  const authorized = () => manager.authorized(projectId, taskId, authorization) && manager.active === active;
  if (!authorized() || active.finishing) throw Error('NATIVE_DSH_DRAFT_NOT_AUTHORIZED');
  if (active.executePromise || active.draftPromise) throw Error('NATIVE_DSH_EXECUTOR_BUSY');
  const operation = async () => {
    if (!input || !/^[\w-]{8,100}$/.test(input.request_id || '') ||
      Object.keys(input).some(key => !['request_id', 'case_id', 'case_version', 'content_sha256', 'entry', 'draft_status', 'blocker'].includes(key))) throw Error('NATIVE_DSH_REQUEST_INVALID');
    if (!['UNEXECUTED', 'BLOCKED_PRECONDITION'].includes(input.draft_status)) throw Error('NATIVE_DSH_DRAFT_STATUS_INVALID');
    let blocker = null;
    if (input.draft_status === 'BLOCKED_PRECONDITION') {
      if (!blockerCodes.has(input.blocker?.code) || typeof input.blocker.summary !== 'string' || !input.blocker.summary.trim() || input.blocker.summary.length > 1200) throw Error('NATIVE_DSH_DRAFT_BLOCKER_REQUIRED');
      blocker = { code: input.blocker.code, summary: redact(input.blocker.summary.trim()), source: 'DSH_REPORTED', verification_status: 'NOT_VERIFIED' };
    } else if (input.blocker != null) throw Error('NATIVE_DSH_DRAFT_BLOCKER_INVALID');
    const task = await manager.get(projectId, taskId);
    if (task.project_id !== projectId || task.status !== 'RUNNING' || task.kind === 'FROZEN_SCRIPT_RERUN' || !active.workspace) throw Error('NATIVE_DSH_DRAFT_NOT_AUTHORIZED');
    const requestSha = hash(input), previous = task.drafts?.find(row => row.request_id === input.request_id);
    if (previous) {
      if (previous.request_sha256 !== requestSha) throw Error('NATIVE_DSH_REQUEST_CONFLICT');
      return previous;
    }
    const item = boundItem(await manager.caseStore.getProject(projectId), task, input);
    const id = `draft-${randomUUID()}`, root = path.join(manager.directory(projectId), 'drafts', id), snapshot = path.join(root, 'snapshot');
    if (inside(path.resolve(active.workspace), path.resolve(root)) || inside(path.resolve(root), path.resolve(active.workspace))) throw Error('NATIVE_DRAFT_DIRECTORY_UNSAFE');
    await rejectSymlinkPath(path.resolve(active.workspace)); await rejectSymlinkPath(root);
    await fs.mkdir(path.dirname(root), { recursive: true }); await fs.mkdir(root); await fs.mkdir(snapshot);
    const manifest = await snapshotSources(path.resolve(active.workspace), snapshot, input.entry);
    if (task.kind === REGISTER_EXISTING_DRAFT && (!sameSha(manifest.script_sha256, item.existing_source?.script_sha256) ||
        !sameSha(manifest.bundle_sha256, item.existing_source?.bundle_sha256))) throw Error('NATIVE_DSH_EXISTING_SOURCE_CHANGED');
    const created_at = new Date().toISOString();
    await fs.writeFile(path.join(root, 'source-manifest.json'), JSON.stringify({ ...manifest, entry: input.entry, purpose: 'draft',
      case_id: item.external_id, project_id: projectId, task_id: taskId, case_version: item.case_version,
      content_sha256: item.content_sha256, created_at }, null, 2), { flag: 'wx' });
    const artifacts = (await collectArtifacts(root)).map(file => ({ ...file, id: `${id}-${file.id}` }));
    const draft = { schema: 'workbench/native-dsh-draft-v1', operation: 'REGISTER_DRAFT', id, project_id: projectId, task_id: taskId,
      request_id: input.request_id, request_sha256: requestSha, created_at, case_id: item.case_id, external_id: item.external_id,
      case_version: item.case_version, content_sha256: item.content_sha256, entry: input.entry,
      draft_status: input.draft_status, blocker, execution_status: 'NOT_RUN', evidence_status: 'NOT_CAPTURED', counts_for_case: false,
      script_sha256: manifest.script_sha256, bundle_sha256: manifest.bundle_sha256, artifacts };
    await manager.update(projectId, taskId, async stored => {
      if (!authorized() || stored.status !== 'RUNNING') throw Error('NATIVE_DSH_DRAFT_NOT_AUTHORIZED');
      boundItem(await manager.caseStore.getProject(projectId), stored, input);
      (stored.drafts ||= []).push(draft);
    });
    return structuredClone(draft);
  };
  active.draftPromise = operation();
  return active.draftPromise.finally(() => { active.draftPromise = null; });
}

// Registration never changes run verdicts. Only a confirmed registration affects
// the otherwise empty task outcome; transport/model errors retain precedence.
export function nativeTaskOutcome(task, result, active) {
  if (active.unconfirmed) return 'STOP_UNCONFIRMED';
  if (active.controller.signal.aborted) return active.controller.signal.reason === 'timeout' ? 'TIMED_OUT' : 'CANCELLED';
  if (result.error) return 'FAILED';
  if (task.items.every(item => item.status === 'PASSED')) return task.items.some(item =>
    task.runs.filter(run => run.case_id === item.case_id && run.counts_for_case).at(-1)?.evidence_status === 'INCOMPLETE') ? 'PARTIAL' : 'COMPLETED';
  if (task.runs.length) return 'PARTIAL';
  const latest = new Map((task.drafts || []).map(draft => [draft.case_id, draft]));
  if (task.items.length && task.items.every(item => latest.get(item.case_id)?.draft_status === 'BLOCKED_PRECONDITION')) return 'BLOCKED';
  if (task.kind === REGISTER_EXISTING_DRAFT && task.items.length && task.items.every(item => latest.has(item.case_id))) return 'COMPLETED';
  return latest.size ? 'PARTIAL' : 'FAILED';
}

export function nativeTaskHelper(endpoint, token, { registrationOnly = false } = {}) {
  return `import { readFile } from 'node:fs/promises';
const args=process.argv.slice(2),register=args[0]==='register-draft',finish=args[0]==='finish-batch';
${registrationOnly ? "if(!register)throw Error('NATIVE_DSH_EXECUTION_DISABLED');" : ''}
if(register)args.shift();
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
let body={request_id:option('--request-id')||crypto.randomUUID(),case_id:args[0],entry:args[1]};
if(finish){
 const task=JSON.parse(await readFile(new URL('./current-task.json',import.meta.url),'utf8'));
 body={batch_number:task.batch_number};
}else if(register){
 const task=JSON.parse(await readFile(new URL('./current-task.json',import.meta.url),'utf8'));
 const item=task.cases.find(row=>row.case_id===args[0]||row.external_id===args[0]);
 if(!item)throw Error('NATIVE_DSH_CASE_NOT_IN_TASK');
 const code=option('--blocked-code');
 body={...body,case_id:item.case_id,case_version:item.case_version,content_sha256:item.content_sha256,draft_status:code?'BLOCKED_PRECONDITION':'UNEXECUTED',...(code?{blocker:{code,summary:option('--reason')}}:{})};
}else body.purpose=args[2]==='--diagnostic'?'diagnostic':args[2]||'case';
const response=await fetch(${JSON.stringify(endpoint)}+(finish?'/finish':register?'/drafts':'/execute'),{method:'POST',headers:{'Content-Type':'application/json','Authorization':${JSON.stringify('Bearer ' + token)}},body:JSON.stringify(body)});
const result=await response.json();console.log(JSON.stringify(result,null,2));
process.exit(response.ok&&(finish?result.operation==='BATCH_FINISHED':register?result.operation==='REGISTER_DRAFT'&&result.execution_status==='NOT_RUN':result.status==='PASSED')?0:1);
`;
}
