// One zero-model cancellation on the existing official workbench.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4322',project='project-80875248-3e14-4055-b077-b890dead1a9e',prefix=`/api/case-library/projects/${project}`;
const get=async p=>{const r=await fetch(base+p);assert.equal(r.status,200);return r.json();};
const post=async(p,b)=>{const r=await fetch(base+p,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(b)});assert.ok(r.ok,await r.clone().text());return r.json();};
const health=await get('/api/health');assert.equal(health.status,'ready');assert.ok(!health.active_build_task_id&&!health.active_script_operation_id&&!health.active_batch_id);
const old=(await get(prefix+'/batches')).batches.find(b=>b.software_version==='reliability-20260925-4322-retry');
const selected=old.items.find(i=>i.external_id==='KC-02').selection;
const preview=await post(prefix+'/batches',{scope:'single',case_ids:[selected.case_id],selections:[selected],software_version:'reliability-20260925-cancel'});
const started=await post(prefix+'/batches/'+preview.batch_id+'/start',{request_id:preview.batch_id+'-cancel-test',allow_partial:false});
let current;
for(let n=0;n<100;n++){
  current=await get(prefix+'/batches/'+started.batch_id);
  if(current.items[0].run_id)break;
  assert.ok(['QUEUED','RUNNING'].includes(current.state));await new Promise(r=>setTimeout(r,100));
}
assert.ok(current.items[0].run_id,'An owned candidate run must exist before cancellation');
const before=await get('/api/runs/'+current.items[0].run_id);assert.ok(['QUEUED','RUNNING'].includes(before.execution_status));
await post(prefix+'/batches/'+current.batch_id+'/stop',{});
for(let n=0;n<150;n++){
  current=await get(prefix+'/batches/'+started.batch_id);
  if(current.state==='CANCELLED')break;
  await new Promise(r=>setTimeout(r,100));
}
assert.equal(current.state,'CANCELLED');
const run=await get('/api/runs/'+current.items[0].run_id);assert.equal(run.execution_status,'CANCELLED');assert.equal(run.complete_pass,false);assert.equal(run.model_calls,0);
assert.deepEqual(await post('/api/candidate-trials/'+run.run_id+'/stop',{}),run);
const after=await get('/api/health');assert.equal(after.status,'ready');assert.equal(after.active_build_task_id,null);assert.equal(after.active_batch_id,null);
const result={at:new Date().toISOString(),batch_id:current.batch_id,run_id:run.run_id,before:before.execution_status,after:run.execution_status,complete_pass:run.complete_pass,model_calls:run.model_calls,service_identity:run.service_identity,health:after.status};
await fs.writeFile(new URL('active-cancel.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
