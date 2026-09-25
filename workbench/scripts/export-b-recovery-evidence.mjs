// Read-only export of this batch's synthetic evidence; never executes a candidate/model.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../server/build/development-session.mjs';
const workbench = fileURLToPath(new URL('../', import.meta.url));
const repository = path.dirname(workbench);
const source = path.join(workbench, '.local/br25');
const output = path.join(workbench, 'qa/20260925-autonomous');
const manifest = { schema: 'autonomous-acceptance-evidence-v1', baseline: '66d3bde6faa6c4d81d57b6f69377660c5b620697', exported_at: new Date().toISOString(), redaction: 'Repository/home paths replaced; no sessions, reasoning, credentials, videos or trace archives exported. Candidate bytes unchanged.', files: [], tasks: [] };
function sanitize(value) {
  if (typeof value === 'string') return value.replaceAll(repository.replaceAll('\\', '\\\\'), '<REPO>').replaceAll(repository, '<REPO>').replaceAll(repository.replaceAll('\\', '/'), '<REPO>').replaceAll(encodeURI(repository.replaceAll('\\', '/')), '<REPO>').replaceAll(process.env.USERPROFILE.replaceAll('\\', '\\\\'), '<USER_HOME>').replaceAll(process.env.USERPROFILE, '<USER_HOME>');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitize(child)]));
  return value;
}
async function copy(file, target, json = false) {
  const original = await fs.readFile(file);
  const bytes = json ? Buffer.from(JSON.stringify(sanitize(JSON.parse(original)), null, 2) + '\n') : original;
  await fs.mkdir(path.dirname(path.join(output, target)), { recursive: true }); await fs.writeFile(path.join(output, target), bytes);
  manifest.files.push({ file: target, source: path.relative(repository, file).replaceAll('\\', '/'), source_sha256: digest(original), exported_sha256: digest(bytes), bytes: bytes.length, transformed: json });
}
for (const lane of ['b-recovery']) {
  const logical = 'b-recovery-20260925';
  const taskPath = path.join(source, `${logical}-result.json`);
  const task = JSON.parse(await fs.readFile(taskPath, 'utf8'));
  const directory = path.join(source, 'build-tasks', task.task_id, 'development');
  await copy(taskPath, `${lane}/task.json`, true);
  const eventsFile = path.join(directory, 'harness-events.json');
  const raw = await fs.readFile(eventsFile); const events = JSON.parse(raw);
  const publicEvents = events.filter(event => ['tool_call', 'tool_result', 'status'].includes(event.type));
  await fs.writeFile(path.join(output, lane, 'tool-transcript.json'), JSON.stringify(sanitize(publicEvents), null, 2) + '\n');
  manifest.files.push({ file: `${lane}/tool-transcript.json`, source_sha256: digest(raw), exported_sha256: digest(await fs.readFile(path.join(output, lane, 'tool-transcript.json'))), transformed: true, omitted: ['session', 'thinking', 'text', 'final'] });
  await copy(path.join(directory, 'harness-summary.json'), `${lane}/harness-summary.json`, true);
  await copy(path.join(directory, 'agent-input.txt'), `${lane}/agent-input.txt`);
  for (const run of task.development.self_tests) {
    for (const file of run.files || [{path:'candidate.spec.mjs'}]) await copy(path.join(directory, `run-${run.number}`,file.path), `${lane}/dev-${run.number}/${file.path}`);
    await copy(path.join(directory, run.report_path), `${lane}/dev-${run.number}/report.json`, true);
    const shot = run.media.find(file => file.relative_path.endsWith('.png'));
    if (shot) await copy(path.join(directory, shot.relative_path), `${lane}/dev-${run.number}/screenshot.png`);
  }
  if (task.development.submission) for (const file of task.development.submission.bundle.files) await copy(path.join(directory,'final',file.path), `${lane}/final/${file.path}`);
  for (const run of (task.candidates[0]?.trial_runs || [])) {
    await copy(path.join(directory, 'final', run.run_type, 'playwright-report.json'), `${lane}/final/${run.run_type}-report.json`, true);
    const candidates = task.files.filter(file => file.relative_path.includes(`/final/${run.run_type}/`) && file.relative_path.endsWith('.png'));
    if (candidates[0]) await copy(path.join(source, 'build-tasks', task.task_id, candidates[0].relative_path), `${lane}/final/${run.run_type}.png`);
  }
  await copy(path.join(source, `${logical}-workbench.png`), `${lane}/workbench.png`);
  manifest.tasks.push({ logical_id: logical, task_id: task.task_id, external_id: task.source.external_id, status: task.task_status, started_at: task.started_at, finished_at: task.finished_at, elapsed_ms: Date.parse(task.finished_at) - Date.parse(task.started_at), harness_starts: task.development.harness_starts, tool_calls: task.development.tool_calls, tool_errors: events.filter(event => event.type === 'tool_result' && event.status === 'error').length, model_steps: events.filter(event => event.type === 'status' && event.phase === 'step_end').length, developer_self_tests: task.development.self_tests.length, final_executions: (task.candidates[0]?.trial_runs || []).length, final_sha256: task.development.submission?.sha256 ?? null, bundle: task.development.submission?.bundle ?? null, candidate_approved: false });
}
const current = manifest.tasks[0];
const directory = path.join(source,'build-tasks',current.task_id,'development');
await copy(path.join(directory,'draft/candidate.spec.mjs'),'b-recovery/draft/candidate.spec.mjs');
await copy(path.join(source,'browser-acceptance.json'),'b-recovery/browser-acceptance.json',true);
await copy(path.join(source,'browser-acceptance.png'),'b-recovery/browser-acceptance.png');
const draftBytes = await fs.readFile(path.join(directory,'draft/candidate.spec.mjs'));
current.last_working_draft_sha256 = digest(draftBytes);
const events = JSON.parse(await fs.readFile(path.join(directory,'harness-events.json')));
const calls = events.filter(e=>e.type==='tool_call');
const failures = events.filter(e=>e.type==='tool_result' && e.status==='error');
const failedCalls=failures.map(result=>({...calls.find(c=>c.callId===result.callId),error:result.result}));
const analysis={policy_denials:failedCalls.filter(c=>c.error.includes('TASK_TOOL_POLICY_DENIED')).length,
 bundle_admission:failedCalls.filter(c=>c.error.includes('BUNDLE_RUNTIME_OVERRIDE_NOT_ALLOWED')).length,
 browser_observation:failedCalls.filter(c=>c.error.includes('does not match any elements') || c.error.includes('current page snapshot') || c.error.includes('Unexpected token')).length,
 missing_file:failedCalls.filter(c=>c.tool==='read' && c.error.includes('not found')).length,
 parameter_errors:0,
 exact_repeated_failed_calls:failedCalls.filter((c,i,a)=>a.slice(0,i).some(p=>p.tool===c.tool&&JSON.stringify(p.input)===JSON.stringify(c.input))).length,
 draft_writes:calls.filter(c=>c.tool==='mcp__workbench__write_draft'||c.tool==='write'||c.tool==='edit').length,
 self_test_requests:calls.filter(c=>c.tool==='mcp__workbench__self_test').length,
 actual_candidate_executions:current.developer_self_tests + current.final_executions, final_bundle:current.bundle, maintainer_cancelled:false};
analysis.saved_versions=[];
for(const [index,call] of calls.filter(c=>c.tool==='mcp__workbench__write_draft').entries()){
 const file=`b-recovery/edits/edit-${index+1}.spec.mjs`;const bytes=Buffer.from(call.input.code);
 await fs.mkdir(path.dirname(path.join(output,file)),{recursive:true});await fs.writeFile(path.join(output,file),bytes);
 const fact={file,sha256:digest(bytes),bytes:bytes.length,call_id:call.callId};analysis.saved_versions.push(fact);manifest.files.push({...fact,transformed:false});
}
await fs.writeFile(path.join(output,'b-recovery/analysis.json'),JSON.stringify(analysis,null,2)+'\n');
const originalRoot=path.join(workbench,'.local/br25-original');
await copy(path.join(originalRoot,'tool-chain.json'),'b-recovery/original/tool-chain.json',true);
await copy(path.join(originalRoot,'state.json'),'b-recovery/original/state.json',true);
const originalState=JSON.parse(await fs.readFile(path.join(originalRoot,'state.json')));
for(const run of originalState.self_tests){
 await copy(path.join(originalRoot,run.candidate_path),'b-recovery/original/candidate.spec.mjs');
 await copy(path.join(originalRoot,run.report_path),'b-recovery/original/report.json',true);
 const shot=run.media.find(f=>f.relative_path.endsWith('.png'));if(shot)await copy(path.join(originalRoot,shot.relative_path),'b-recovery/original/screenshot.png');
}
const preflight=JSON.parse((await fs.readFile(path.join(output,'b-recovery/tool-chain-preflight.log'),'utf8')).trim().replace(/^\uFEFF/,''));
await copy(path.join(preflight.directory,'tool-chain.json'),'b-recovery/engineering-tool-chain.json',true);
await fs.writeFile(path.join(output, 'b-recovery/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.tasks, null, 2));
