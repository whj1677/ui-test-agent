// Read-only verification against the only formal workbench. Never starts a service/model/run.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadCandidateBundle } from '../../server/build/candidate-trials.mjs';
const base='http://127.0.0.1:4322',qa='workbench/qa/20260925-v21';
const file=path.join(qa,'user-workflow-v9-evidence.json'),e=JSON.parse(await fs.readFile(file));
const get=async route=>{const r=await fetch(base+route);assert.ok(r.ok,route+':'+r.status);return r.json();};
const hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const project=await get('/api/case-library/projects/'+e.project);assert.equal(hash(project.cases),e.before.cases_hash);
const ledger=JSON.parse(await fs.readFile('workbench/.local/fresh25-b/build-tasks/development-authorizations.json'));
for(const old of e.before.old_receipt_hashes)assert.equal(hash(ledger.entries.find(x=>x.logical_id===old.logical_id)),old.sha256);
assert.equal(ledger.entries.length,e.before.ledger_count+1);
const task=await get('/api/build/tasks/'+e.generation.task_id);assert.equal(task.task_status,'WAITING_HUMAN_REVIEW');assert.equal(task.development.harness_starts,1);assert.equal(task.script_version,2);
assert.equal(task.development.self_tests.length,1);assert.equal(task.candidates[0].trial_runs[0].status,'PASSED');
assert.equal(task.development.self_tests[0].step_replay.status,'READY');assert.equal(task.candidates[0].trial_runs[0].step_replay.status,'READY');
assert.equal(ledger.entries.at(-1).task_id,task.task_id);assert.equal(ledger.entries.at(-1).limits.harness_starts,1);
const operations=await get('/api/case-library/projects/'+e.project+'/script-operations');assert.equal(operations.operations.length,e.before.operations+1);
const records=(await get('/api/case-library/projects/'+e.project+'/execution-records')).records;
const batches=await Promise.all(e.batches.map(id=>get('/api/case-library/projects/'+e.project+'/batches/'+id)));
assert.deepEqual(batches.map(b=>b.items.length),[2,1]);assert.deepEqual(batches.flatMap(b=>b.items.map(i=>i.result)),['FAILED','PASSED','PASSED']);
const runIds=batches.flatMap(b=>b.items.map(i=>i.run_id));runIds.push(task.task_id+'-dev-1',task.task_id+'-normal');
const media=[],executions=[];
for(const id of runIds){
 const record=records.find(r=>r.run_id===id);assert.ok(record);assert.equal(record.evidence_status,'COMPLETE');assert.equal(record.step_replay.status,'READY');
 if(id.startsWith('trial-')){assert.equal(record.model_calls,0);assert.equal(record.harness_starts,0);assert.equal(record.same_candidate_hash,true);}
 executions.push({run_id:id,case:record.executed_external_id,case_version:record.executed_case_version,script_version:record.script_version||null,status:record.status,origin:record.origin,steps:record.step_replay.steps.map(s=>s.execution_status),evidence_status:record.evidence_status});
 for(const f of record.files){
  assert.equal(f.run_id,id);
  const url=id.startsWith('trial-')?'/api/runs/'+id+'/media/'+f.file_id:'/api/build/tasks/'+record.source_build_task_id+'/media/'+f.file_id;
  const response=await fetch(base+url);assert.ok(response.ok,url);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes).toUpperCase(),f.sha256.toUpperCase());
  media.push({run_id:id,file_id:f.file_id,sha256:f.sha256,bytes:f.bytes,kind:f.kind});
 }
}
for(const b of batches)for(const i of b.items){
 const t=await get('/api/build/tasks/'+i.selection.source_task_id),c=t.candidates.find(c=>c.version===i.selection.candidate_version);
 const bundle=await loadCandidateBundle(path.resolve('workbench/.local/fresh25-b/build-tasks',t.task_id,'development/final'),c.bundle);assert.equal(bundle.sha256,i.selection.bundle_sha256);
}
const kc02=records.find(r=>r.run_id===runIds[0]);assert.deepEqual(kc02.step_replay.steps.map(s=>s.execution_status),['FAILED','PASSED','PASSED']);assert.match(kc02.step_replay.steps[0].actual,/5/);
const health=await get('/api/health');assert.equal(health.active_build_task_id,null);assert.equal(health.active_script_operation_id,null);assert.equal(health.active_batch_id,null);
const missing=await fetch(base+'/api/runs/run-nonexistent/media/media-1');assert.equal(missing.status,404);
e.verification={checked_at:new Date().toISOString(),cases_unchanged:true,old_receipts_unchanged:e.before.ledger_count,new_receipts:1,new_operations:1,batches:batches.map(b=>({id:b.batch_id,scope:b.scope,software_version:b.software_version,items:b.items.map(i=>({case:i.external_id,script_version:i.script_version,result:i.result,run_id:i.run_id}))})),executions,media,active_tasks:0,missing_run_media_status:404};
await fs.writeFile(file,JSON.stringify(e,null,2));console.log(JSON.stringify({scope:'FORMAL_4322_READ_ONLY',generation:1,rerun_batches:2,reruns:3,results:['FAILED','PASSED','PASSED'],media_verified:media.length,old_receipts_unchanged:e.before.ledger_count,cases_unchanged:true}));
