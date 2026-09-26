// Connect to the existing formal instance only. No server or model starts.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',project='project-80875248-3e14-4055-b077-b890dead1a9e';
const prefix=`/api/case-library/projects/${project}`,out=new URL('./',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const get=async route=>{const r=await fetch(base+route);assert.equal(r.status,200,route);return r.json();};
const health=await get('/api/health');assert.equal(health.status,'ready');
const batches=(await get(prefix+'/batches')).batches;
const batch=batches.find(b=>b.software_version==='reliability-20260925-4322-retry');
assert.equal(batch.state,'FINISHED');assert.equal(batch.items.length,2);
const failedAttempt=batches.find(b=>b.software_version==='reliability-20260925-4322');
assert.equal(failedAttempt.state,'INTERRUPTED');
const runs=[],media=[];
for(const item of batch.items){
  const run=await get('/api/runs/'+item.run_id);
  assert.equal(run.execution_status,'FINISHED');assert.equal(run.status,item.external_id==='KC-02'?'FAILED':'PASSED');
  assert.equal(run.model_calls,0);assert.equal(run.harness_starts,0);assert.equal(run.approval_status,'NOT_APPROVED');
  assert.equal(run.service_identity.source_sha256,batch.service_identity.source_sha256);
  assert.equal(run.evidence_status,'COMPLETE');assert.equal(run.bundle_sha256,item.selection.bundle_sha256);
  if(item.external_id==='KC-02'){
    // S1 asserts a pager regexp; preserve its original text instead of inventing a scalar extraction.
    assert.equal(run.frozen_case_content.steps[0].expected,'立即筛选，匹配EQ-101至EQ-108全部8条，回到第1页');
    assert.match(run.error.message,/Expected pattern: \/共 8 条/);
    assert.equal(run.error.actual,'共 5 条，第 1/2 页，每页3条');
    assert.equal(run.step_replay.steps[0].execution_status,'FAILED');
  }
  // This explicitly exercises terminal stop while another generation may own the executor.
  const response=await fetch(base+'/api/candidate-trials/'+run.run_id+'/stop',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'});
  assert.equal(response.status,202);assert.deepEqual(await response.json(),run);
  assert.deepEqual(await get('/api/runs/'+run.run_id),run);
  for(const file of run.files){
    const response=await fetch(base+`/api/runs/${run.run_id}/media/${file.file_id}`);assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256.toUpperCase());
    media.push({run_id:run.run_id,file_id:file.file_id,bytes:bytes.length,sha256:file.sha256});
  }
  runs.push({run_id:run.run_id,case:item.external_id,status:run.status,evidence_status:run.evidence_status,error:run.error,service_identity:run.service_identity,step_coverage:run.step_coverage});
}
const reportId=(await get(prefix+'/reports')).reports.find(r=>r.batch_id===batch.batch_id).report_id;
const report=await get(prefix+'/reports/'+reportId);
assert.deepEqual(report.counts,{requested:2,executed:2,passed:1,failed:1,not_run:0});
assert.ok(report.report_service_identity);
let embedded=0;
for(const entry of report.entries){assert.ok(entry.service_identity);for(const m of entry.media){
  assert.equal(m.included,true,m.name);const bytes=Buffer.from(m.data_url.split(',')[1],'base64');assert.equal(bytes.length,m.bytes);assert.equal(hash(bytes),m.sha256.toUpperCase());embedded++;
}}
const response=await fetch(base+prefix+'/reports/'+reportId+'/html?download=1');assert.equal(response.status,200);
const html=await response.text();assert.match(html,/KC-02/);assert.match(html,/KC-08/);
await fs.writeFile(new URL('official-batch-report.html',out),html);
const result={checked_at:new Date().toISOString(),entry:base+'/workspace/',batch_id:batch.batch_id,failed_attempt:{batch_id:failedAttempt.batch_id,state:failedAttempt.state,items:failedAttempt.items.map(i=>({case:i.external_id,state:i.state,reason:i.reason,run_id:i.run_id}))},runs,media,report:{report_id:reportId,counts:report.counts,embedded_media:embedded,html_bytes:Buffer.byteLength(html)},terminal_stop:'IDEMPOTENT',model_calls:0};
await fs.writeFile(new URL('official-results.json',out),JSON.stringify(result,null,2));
console.log(JSON.stringify({batch_id:batch.batch_id,results:runs.map(r=>({case:r.case,status:r.status})),media:media.length,embedded,terminal_stop:result.terminal_stop}));
