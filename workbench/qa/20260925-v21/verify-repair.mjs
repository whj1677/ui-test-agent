// Read back the formal 4322 repair runs. No server, model or new execution is started.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',project='project-6f4c682c-590c-4d65-a23c-120835e00e0c';
const get=async url=>{const r=await fetch(base+url);assert.ok(r.ok,`${url}: ${r.status}`);return r.json();};
const hash=b=>createHash('sha256').update(b).digest('hex');
const all=await get(`/api/case-library/projects/${project}/batches`);
const batches=all.batches.filter(b=>b.software_version?.startsWith('repair-20260925-'));
assert.equal(batches.length,3);assert.ok(batches.every(b=>b.state==='FINISHED'&&b.mode==='technical'));
assert.ok(batches.filter(b=>b.scope==='single').every(b=>b.items.length===1));
assert.deepEqual(batches.find(b=>b.scope==='selected').items.map(i=>i.external_id),['KC-02','KC-11']);
const runs=[];let mediaVerified=0;
const before=(await get('/api/runs')).runs.length;
for(const batch of batches){
  // Replay the already-admitted receipt; duplicate submission must not start again.
  const response=await fetch(`${base}/api/case-library/projects/${project}/batches/${batch.batch_id}/start`,{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify({request_id:batch.request_id,allow_partial:batch.allow_partial})});
  assert.ok(response.ok);assert.equal((await response.json()).batch_id,batch.batch_id);
  for(const item of batch.items){
    const run=await get('/api/runs/'+item.run_id);
    assert.equal(run.batch_id,batch.batch_id);assert.equal(run.executed_case_id,item.case_id);
    assert.equal(run.executed_case_version,item.case_version);assert.equal(run.bundle_sha256,item.selection.bundle_sha256);
    assert.equal(run.software_version,batch.software_version);assert.equal(run.model_calls,0);assert.equal(run.harness_starts,0);
    assert.equal(run.status,item.external_id==='KC-02'?'FAILED':'PASSED');
    if(item.external_id==='KC-02'){assert.equal(run.error.expected,'8');assert.equal(run.error.actual,'5');}
    for(const file of run.files){
      assert.equal(file.run_id,run.run_id);
      const response=await fetch(`${base}/api/runs/${run.run_id}/media/${file.file_id}`);assert.ok(response.ok);
      const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes).toUpperCase(),file.sha256);mediaVerified++;
    }
    runs.push({run_id:run.run_id,case:item.external_id,case_version:item.case_version,candidate_version:item.selection.candidate_version,bundle_sha256:run.bundle_sha256,batch_id:batch.batch_id,result:run.status,error:run.error,model_calls:run.model_calls,harness_starts:run.harness_starts,recording:run.recording});
  }
}
assert.equal((await get('/api/runs')).runs.length,before);
const preflight=await fetch(`${base}/api/case-library/projects/${project}/batches/preflight`,{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify({scope:'project'})});
assert.ok(preflight.ok);const check=await preflight.json();assert.equal(check.batch_id,null);
assert.equal(check.items.length,12);assert.equal(check.items.filter(i=>i.state==='QUEUED').length,2);
assert.equal(check.items.filter(i=>i.reason==='SCRIPT_MISSING').length,9);
assert.equal(check.items.find(i=>i.external_id==='KC-22').reason,'CASE_VERSION_NOT_APPLICABLE');
assert.equal((await get(`/api/case-library/projects/${project}/batches`)).batches.length,all.batches.length);
const history=JSON.parse(await fs.readFile('workbench/.local/v21-repair/history-before.json','utf8'));
for(const [file,expected] of Object.entries(history))assert.equal(hash(await fs.readFile(file)),expected,file);
const originals=JSON.parse(await fs.readFile('workbench/.local/v21/original-build-files.json','utf8'));
for(const [file,expected] of Object.entries(originals))assert.equal(hash(await fs.readFile(path.join('workbench/.local/fresh25-b/build-tasks',file))),expected,file);
const original=JSON.parse(await fs.readFile('workbench/.local/v21/original-case-hash.json','utf8'));assert.equal(hash(await fs.readFile(original.path)),original.sha256);
const checks={actual_executions:runs.length,started_batches:batches.length,media_hashes_verified:mediaVerified,existing_data_files_unchanged:Object.keys(history).length,original_candidate_files_unchanged:Object.keys(originals).length,original_24_unchanged:true,preview_wrote_no_batch:true,replay_started_no_run:true,full_scope:12,runnable:2,missing:9,version_mismatch:1,model_calls:0,harness_starts:0};
const result={checked_at:new Date().toISOString(),checks,runs,batches:batches.map(b=>({batch_id:b.batch_id,scope:b.scope,software_version:b.software_version,state:b.state,items:b.items})),health:await get('/api/health')};
await fs.writeFile('workbench/qa/20260925-v21/repair-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(checks));
