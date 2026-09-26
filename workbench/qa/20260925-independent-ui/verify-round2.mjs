// Read-only evidence verification against the sole formal workbench.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base='http://127.0.0.1:4322', project='project-80875248-3e14-4055-b077-b890dead1a9e';
const prefix=`/api/case-library/projects/${project}`, out=new URL('./supervisor/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').toUpperCase();
const get=async route=>{const r=await fetch(base+route);assert.equal(r.status,200,route);return r.json();};
const ids=process.argv.slice(2);assert.ok(ids.length,'Pass explicit batch-/build- IDs from this round.');
const results=[];
for(const id of ids){
 if(id.startsWith('batch-')){
  const b=await get(`${prefix}/batches/${id}`);assert.ok(['FINISHED','CANCELLED'].includes(b.state),b.state);
  const runs=[];
  for(const item of b.items){
   if(!item.run_id)continue;
   const r=await get('/api/runs/'+item.run_id);
   assert.equal(r.model_calls,0);assert.equal(r.harness_starts,0);assert.equal(r.approval_status,'NOT_APPROVED');
   assert.equal(r.bundle_sha256,item.selection.bundle_sha256);assert.equal(r.executed_case_version,item.case_version);
   assert.equal(r.service_identity.source_sha256,b.service_identity.source_sha256);
   const media=[];
   for(const f of r.files){const response=await fetch(base+`/api/runs/${r.run_id}/media/${f.file_id}`);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes),f.sha256.toUpperCase());media.push({file_id:f.file_id,bytes:f.bytes,sha256:f.sha256});}
   if(item.external_id==='KC-02'&&r.execution_status==='FINISHED'){
    assert.equal(r.status,'FAILED');assert.equal(r.frozen_case_content.steps[0].expected,'立即筛选，匹配EQ-101至EQ-108全部8条，回到第1页');
    assert.match(r.error.message,/Expected pattern: \/共 8 条/);assert.equal(r.error.actual,'共 5 条，第 1/2 页，每页3条');
   }
   const result={run_id:r.run_id,case:item.external_id,execution_status:r.execution_status,status:r.status,complete_pass:r.complete_pass,script_version:r.script_version,source_task_id:r.source_task_id,bundle_sha256:r.bundle_sha256,approval_status:r.approval_status,error:r.error,steps:r.step_coverage,media};
   runs.push(result);
   await fs.writeFile(new URL(r.run_id+'.json',out),JSON.stringify(r,null,2));
  }
  results.push({kind:'batch',id,state:b.state,software_version:b.software_version,service_identity:b.service_identity,items:b.items,runs});
 }else if(id.startsWith('build-')){
  const t=await get('/api/build/tasks/'+id),d=t.development,c=t.candidates.at(-1);
  assert.equal(t.active_attempt_id,null);assert.equal(d.harness_starts,1);assert.ok(d.tool_calls<=120);assert.ok(d.self_tests.length<=3);assert.equal(d.recovery,false);assert.equal(t.authorization.mode,'new');
  assert.equal(c.approval_status,'NOT_APPROVED');assert.equal(d.fidelity_review.semantic_approval,false);
  assert.equal(d.fidelity_review.bundle_sha256,c.bundle.sha256);
  const originals=JSON.parse((await fs.readFile(new URL('original-case-inputs.json',out),'utf8')).replace(/^\uFEFF/,''));
  const original=originals.find(x=>x.case_id===t.source.case_id).versions.find(v=>v.version===t.source.case_version);
  assert.deepEqual(t.input_bundle.snapshot.content,original.content);
  assert.deepEqual(d.fidelity_review.steps.map(s=>({order:s.order,action:s.action,expected:s.expected})),original.content.steps);
  const dir=path.resolve('workbench/.local/fresh25-b/build-tasks',id),code=await fs.readFile(path.join(dir,'development/final/candidate.spec.mjs'),'utf8');
  assert.equal(hash(code),c.sha256);assert.equal(c.trial_runs.length,1);
  const media=t.files.filter(f=>/\.(png|webm|zip)$/.test(f.relative_path));
  for(const f of media){const bytes=await fs.readFile(path.join(dir,f.relative_path));assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes),f.sha256.toUpperCase());}
  await fs.writeFile(new URL('fresh-kc08-candidate.mjs',out),code);
  await fs.writeFile(new URL('fresh-kc08-task.json',out),JSON.stringify({task_id:id,source:t.source,task_status:t.task_status,input_bundle:t.input_bundle,service_identity:t.service_identity,authorization:t.authorization,failure:t.failure,development:{harness_starts:d.harness_starts,tool_calls:d.tool_calls,recovery:d.recovery,self_tests:d.self_tests,submission:d.submission,fidelity_review:d.fidelity_review},candidates:t.candidates},null,2));
  results.push({kind:'build',id,status:t.task_status,source:t.source,failure:t.failure,outcome:d.submission.outcome,harness:d.harness_starts,tools:d.tool_calls,self_tests:d.self_tests.map(s=>({number:s.number,status:s.result?.test_status,bundle_sha256:s.bundle_sha256})),independent_runs:c.trial_runs.map(r=>({run_id:r.run_id,status:r.status,complete_pass:r.complete_pass,steps:r.step_coverage})),media_files_verified:media.length,bundle_sha256:c.bundle.sha256,service_identity:t.service_identity,approval:c.approval_status});
 }else if(id.startsWith('report-')){
  const r=await get(`${prefix}/reports/${id}`);
  assert.equal(r.batch_id,'batch-ef21886d-a9b2-4bf4-97b1-cbde23f3b1f9');
  assert.deepEqual(r.counts,{requested:2,executed:2,passed:1,failed:1,not_run:0});
  let embedded=0;const omitted=[];
  for(const e of r.entries)for(const m of e.media){if(m.included){const bytes=Buffer.from(m.data_url.split(',')[1],'base64');assert.equal(bytes.length,m.bytes);assert.equal(hash(bytes),m.sha256.toUpperCase());embedded++;}else omitted.push({name:m.name,reason:m.reason});}
  const response=await fetch(base+`${prefix}/reports/${id}/html?download=1`);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/KC-02/);assert.match(html,/KC-08/);assert.match(html,/共 5 条/);
  await fs.writeFile(new URL('mixed-report.html',out),html);
  results.push({kind:'report',id,batch_id:r.batch_id,counts:r.counts,embedded_media:embedded,omitted,html_sha256:hash(html),html_bytes:Buffer.byteLength(html),report_service_identity:r.report_service_identity});
 }else throw Error('Unexpected ID: '+id);
}
await fs.writeFile(new URL('verified-results.json',out),JSON.stringify({checked_at:new Date().toISOString(),entry:base+'/workspace/',results,supplier_tokens:null,supplier_cost:null},null,2));
console.log(JSON.stringify(results.map(r=>({kind:r.kind,id:r.id,state:r.state||r.status,runs:r.runs?.map(x=>({case:x.case,status:x.status,media:x.media.length})),tools:r.tools,independent:r.independent_runs?.map(x=>({status:x.status,complete_pass:x.complete_pass}))}))));
