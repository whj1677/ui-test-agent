import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',out=new URL('./',import.meta.url);
const get=async route=>{const r=await fetch(base+route);assert.equal(r.status,200);return r.json();};
const ids=['build-20260925135104-907921c7','build-20260925135700-4097fd1b'],rows=[];
const hash=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
for(const [i,id] of ids.entries()){
  const t=await get('/api/build/tasks/'+id),d=t.development,c=t.candidates.at(-1),review=d.fidelity_review;
  assert.equal(t.active_attempt_id,null);assert.equal(d.harness_starts,1);assert.ok(d.tool_calls<=120);assert.ok(d.self_tests.length<=3);
  assert.equal(c.approval_status,'NOT_APPROVED');assert.equal(review.semantic_approval,false);
  assert.equal(review.bundle_sha256,c.bundle.sha256);assert.ok(t.service_identity.source_sha256);
  assert.deepEqual(review.steps.map(s=>({order:s.order,action:s.action,expected:s.expected})),t.input_bundle.snapshot.content.steps.map(s=>({order:s.order,action:s.action,expected:s.expected})));
  assert.equal(c.trial_runs.length,1);
  const dir=path.resolve('workbench/.local/fresh25-b/build-tasks',id);
  const code=await fs.readFile(path.join(dir,'development/final/candidate.spec.mjs'),'utf8');
  assert.equal(hash(code),c.sha256);
  const frozen=JSON.parse(await fs.readFile(path.join(dir,'development/fidelity-review.json'),'utf8'));assert.deepEqual(frozen,review);
  if(i===0){
    assert.equal(t.failure.category,'BUSINESS_DIFFERENCE');assert.equal(d.submission.outcome,'business_difference');
    assert.equal(d.self_tests[0].recovery_original,true);assert.equal(d.self_tests[0].bundle_sha256,d.recovery_seed_bundle_sha256);
    const source=await get('/api/build/tasks/'+t.maintenance.source_selection.source_task_id);
    assert.equal(d.recovery_seed_bundle_sha256,source.candidates.find(x=>x.version===t.maintenance.source_selection.candidate_version).bundle.sha256);
    assert.equal(d.self_tests.at(-1).result.test_status,'FAILED');assert.equal(c.trial_runs[0].status,'FAILED');
    assert.ok(!code.includes("name: '维护'"));assert.ok(!code.includes('name: "维护"'));
  }else{
    assert.equal(d.recovery,false);assert.equal(t.authorization.mode,'new');assert.equal(t.task_status,'WAITING_HUMAN_REVIEW');
    assert.equal(c.trial_runs[0].complete_pass,true);assert.equal(c.trial_runs[0].step_coverage.complete,true);
  }
  const mediaFiles=t.files.filter(f=>/\.(png|webm|zip)$/.test(f.relative_path));
  for(const f of mediaFiles){const bytes=await fs.readFile(path.join(dir,f.relative_path));assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes),f.sha256);}
  await fs.writeFile(new URL(i?'fresh-task.json':'recovery-task.json',out),JSON.stringify({task_id:id,source:t.source,task_status:t.task_status,service_identity:t.service_identity,authorization:t.authorization,runtime:t.runtime,
    failure:t.failure,development:{harness_starts:d.harness_starts,tool_calls:d.tool_calls,recovery:d.recovery,recovery_seed_bundle_sha256:d.recovery_seed_bundle_sha256,
      self_tests:d.self_tests,submission:d.submission,fidelity_review:review},candidates:t.candidates},null,2));
  await fs.writeFile(new URL(i?'fresh-candidate.mjs':'recovery-candidate.mjs',out),code);
  rows.push({task_id:id,case:t.source.external_id,mode:t.authorization.mode,status:t.task_status,outcome:d.submission.outcome,failure:t.failure,
    harness:d.harness_starts,tools:d.tool_calls,self_tests:d.self_tests.map(r=>({number:r.number,status:r.result?.test_status,bundle_sha256:r.bundle_sha256,recovery_original:r.recovery_original})),
    independent_runs:c.trial_runs.map(r=>({run_id:r.run_id,status:r.status,steps:r.step_coverage.items.map(s=>({step:s.marker,status:s.execution_status}))})),
    bundle_sha256:c.bundle.sha256,source_sha256:t.service_identity.source_sha256,media_files_verified:mediaFiles.length,provider_usage:null,cost:null,approval:'NOT_APPROVED'});
}
await fs.writeFile(new URL('model-results.json',out),JSON.stringify({checked_at:new Date().toISOString(),tasks:rows,harness_starts:rows.reduce((s,r)=>s+r.harness,0),tool_calls:rows.reduce((s,r)=>s+r.tools,0),supplier_tokens:null,supplier_cost:null},null,2));
console.log(JSON.stringify(rows));
