// Verify the finished real round. Read-only against the formal workbench;
// writes only this round's verification evidence. No model or execution starts.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',out='workbench/qa/20260925-v21',privateRoot='workbench/.local/v21-real';
const projectId='project-80875248-3e14-4055-b077-b890dead1a9e';
const hash=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const get=async p=>{const r=await fetch(base+p);assert.ok(r.ok,`${p}: ${r.status}`);return r.json();};
const baseline=await read(privateRoot+'/engineer-before.json'),scope=await read(out+'/engineer-scope.json');
const project=await get('/api/case-library/projects/'+projectId);
assert.deepEqual(project.cases,baseline.project.cases,'Current round must not edit case content/history');
const historic=await read(privateRoot+'/history-before.json'),historicChanged=[];
for(const [file,sha] of Object.entries(historic))if(hash(await fs.readFile(file))!==sha.toUpperCase())historicChanged.push(file.replaceAll('\\','/'));
assert.ok(historicChanged.every(f=>f==='workbench/.local/fresh25-b/build-tasks/development-authorizations.json'),'Original historic files changed: '+historicChanged.join(','));
assert.equal(hash(await fs.readFile('workbench/qa/20260925-kimi-complex/index.html')),scope.software_sha256);
const grants=(await get('/api/build/development-authorizations')).authorizations;
assert.deepEqual(grants.filter(g=>!g.logical_id.startsWith('v21-engineer-20260925-')),baseline.grants,'Earlier grants preserved');
const currentGrants=grants.filter(g=>g.logical_id.startsWith('v21-engineer-20260925-'));
assert.equal(currentGrants.length,10);assert.equal(currentGrants.filter(g=>g.task_id).length,10);
const op=await get(`/api/case-library/projects/${projectId}/script-operations/generation-ad99c803-96d9-4702-94eb-3f9628f76303`);
assert.equal(op.state,'FINISHED');assert.equal(op.items.length,10);
const tasks=[];
for(const item of op.items){
 const t=await get('/api/build/tasks/'+item.task_id);
 const frozen=scope.scope.find(c=>c.case_id===t.source.case_id);
 assert.equal(t.source.case_version,frozen.case_version);assert.equal(t.source.content_sha256,frozen.content_sha256);
 assert.equal(t.development.harness_starts,1);assert.ok(t.development.tool_calls<=120);
 assert.ok(t.development.self_tests.length<=3);assert.equal(t.runtime.model.provider,'deepseek-official');
 assert.equal(t.maintenance.mode,'generate');assert.equal(t.maintenance.feedback,null);assert.equal(t.maintenance.source_selection,undefined);
 for(const c of t.candidates)for(const file of c.bundle.files){const bytes=await fs.readFile(`workbench/.local/fresh25-b/build-tasks/${t.task_id}/development/final/${file.path}`);assert.equal(hash(bytes),file.sha256);assert.equal(bytes.length,file.bytes);}
 tasks.push({case:item.external_id,task_id:t.task_id,status:t.task_status,harness_starts:t.development.harness_starts,tool_calls:t.development.tool_calls,self_tests:t.development.self_tests.length,candidates:t.candidates.map(c=>({version:c.version,bundle_sha256:c.bundle.sha256})),human_review_status:t.human_review_status});
}
const batches=(await get(`/api/case-library/projects/${projectId}/batches`)).batches;
for(const old of baseline.old_batches.batches)assert.deepEqual(batches.find(b=>b.batch_id===old.batch_id),old,'Earlier batch changed');
const fresh=batches.filter(b=>b.software_version?.startsWith('engineer-20260925')&&b.started_at);
assert.ok(fresh.some(b=>b.scope==='project'&&b.items.length===12));
const runs=[];let mediaVerified=0;
for(const b of fresh){
 assert.ok(['FINISHED','CANCELLED'].includes(b.state));assert.equal(b.model_calls,0);
 for(const item of b.items){if(!item.run_id)continue;
  const r=await get('/api/runs/'+item.run_id);
  assert.equal(r.batch_id,b.batch_id);assert.equal(r.executed_case_id,item.case_id);assert.equal(r.executed_case_version,item.case_version);
  assert.equal(r.bundle_sha256,item.selection.bundle_sha256);assert.equal(r.model_calls,0);assert.equal(r.harness_starts,0);
  for(const m of r.files){assert.equal(m.run_id,r.run_id);const response=await fetch(`${base}/api/runs/${r.run_id}/media/${m.file_id}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,m.bytes);assert.equal(hash(bytes),m.sha256);mediaVerified++;}
  runs.push({run_id:r.run_id,batch_id:b.batch_id,external_id:r.executed_external_id,case_version:r.executed_case_version,script_version:r.script_version,bundle_sha256:r.bundle_sha256,status:r.status,error:r.error,technical_error:r.technical_error,steps:r.step_replay?.steps||r.step_coverage?.items||[],recording:r.recording,evidence_status:r.evidence_status,media_count:r.files.length,requirement_review:r.requirement_review,model_calls:r.model_calls});
 }
}
const earlierReport=await read(out+'/model-single-report-download.json');
const oldResponse=await fetch(`${base}/api/case-library/projects/${projectId}/reports/${earlierReport.report_id}/html`);assert.ok(oldResponse.ok);assert.equal(hash(Buffer.from(await oldResponse.arrayBuffer())),earlierReport.sha256.toUpperCase());
const health=await get('/api/health');for(const key of ['active_run_id','active_build_task_id','active_batch_id','active_script_operation_id'])assert.equal(health[key],null);
const result={checked_at:new Date().toISOString(),project_id:projectId,source_case_count:12,current_versions_unchanged:true,historic_files_checked:Object.keys(historic).length,historic_changed_files:historicChanged,target_sha256:scope.software_sha256,old_grants_unchanged:true,old_batches_unchanged:true,earlier_report_unchanged:true,model_tasks:tasks,totals:{harness_starts:tasks.reduce((n,t)=>n+t.harness_starts,0),tool_calls:tasks.reduce((n,t)=>n+t.tool_calls,0),self_tests:tasks.reduce((n,t)=>n+t.self_tests,0),new_batches:fresh.length,zero_model_runs:runs.length,verified_media:mediaVerified},batches:fresh,runs};
await fs.writeFile(out+'/engineer-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.totals));
