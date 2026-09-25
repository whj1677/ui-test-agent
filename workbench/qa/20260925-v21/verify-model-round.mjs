// Readback of the real 4322 round. Starts no service, model task or business run.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',projectId='project-80875248-3e14-4055-b077-b890dead1a9e';
const root='workbench/.local/v21-real',out='workbench/qa/20260925-v21';
const hash=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const get=async p=>{const r=await fetch(base+p);assert.ok(r.ok,`${p}: ${r.status}`);return r.json();};
const project=await get('/api/case-library/projects/'+projectId);
const originals=JSON.parse(await fs.readFile(root+'/input-cases.json','utf8'));
assert.equal(project.cases.length,12);
for(const c of project.cases)assert.deepEqual(c.versions[0].content,originals.find(o=>o.external_id===c.external_id));
const operations=(await get(`/api/case-library/projects/${projectId}/script-operations`)).operations;
assert.ok(operations.every(o=>!['RUNNING','QUEUED'].includes(o.state)));
const tasks=[];
for(const o of operations)for(const item of o.items)if(item.task_id){
 const t=await get('/api/build/tasks/'+item.task_id),d=t.development;
 assert.equal(t.source.project_id,projectId);assert.ok(d.harness_starts<=1);
 assert.deepEqual(t.input_bundle.snapshot.content,originals.find(c=>c.external_id===t.source.external_id));
 const taskRoot=path.join('workbench/.local/fresh25-b/build-tasks',t.task_id);
 for(const c of t.candidates)for(const f of c.bundle.files){const b=await fs.readFile(path.join(taskRoot,'development/final',f.path));assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);}
 const seed=d.self_tests?.[0]?.bundle_sha256;
 if(o.mode==='revise')assert.equal(seed,t.maintenance.source_selection.bundle_sha256,'revision must first self-test the exact old bundle');
 if(o.mode!=='revise'){assert.equal(t.maintenance.source_selection,undefined);assert.equal(t.maintenance.feedback,null);assert.ok(!d.recovery);}
 tasks.push({task_id:t.task_id,case:t.source.external_id,mode:o.mode,status:t.task_status,script_version:t.script_version,model:t.runtime.model,harness_starts:d.harness_starts,tool_calls:d.tool_calls,
  self_tests:(d.self_tests||[]).map(r=>({number:r.number,bundle_sha256:r.bundle_sha256,status:r.result?.test_status,error:r.result?.error})),
  final_runs:t.candidates.flatMap(c=>c.trial_runs||[]).map(r=>({run_id:r.run_id,status:r.status,error:r.error})),
  candidates:t.candidates.map(c=>({version:c.version,sha256:c.sha256,bundle_sha256:c.bundle.sha256,files:c.bundle.files})),maintenance:t.maintenance,error:t.error,human_review_status:t.human_review_status});
}
assert.ok(tasks.length<=6);assert.ok(tasks.every(t=>t.model.provider==='deepseek-official'&&t.model.model==='deepseek-flash'));
const batches=(await get(`/api/case-library/projects/${projectId}/batches`)).batches,runs=[];
let mediaVerified=0;
for(const b of batches)for(const i of b.items)if(i.run_id){
 const r=await get('/api/runs/'+i.run_id);assert.equal(r.batch_id,b.batch_id);assert.equal(r.executed_case_id,i.case_id);assert.equal(r.bundle_sha256,i.selection.bundle_sha256);assert.equal(r.model_calls,0);assert.equal(r.harness_starts,0);
 for(const f of r.files){assert.equal(f.run_id,r.run_id);const response=await fetch(`${base}/api/runs/${r.run_id}/media/${f.file_id}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes),f.sha256);mediaVerified++;}
 runs.push({run_id:r.run_id,batch_id:b.batch_id,case:r.executed_external_id,case_version:r.executed_case_version,script_version:r.script_version,bundle_sha256:r.bundle_sha256,status:r.status,error:r.error,model_calls:r.model_calls,harness_starts:r.harness_starts,recording:r.recording});
}
const before=JSON.parse(await fs.readFile(root+'/history-before.json','utf8')),changed=[];
for(const [file,expected] of Object.entries(before)){if(hash(await fs.readFile(file))!==expected.toUpperCase())changed.push(file.replaceAll('\\','/'));}
const allowed=['workbench/.local/fresh25-b/data/catalog.json','workbench/.local/fresh25-b/build-tasks/development-authorizations.json'];
assert.ok(changed.every(f=>allowed.includes(f)),JSON.stringify(changed));
const allGrants=(await get('/api/build/development-authorizations')).authorizations;
assert.deepEqual(allGrants.filter(g=>!g.logical_id.startsWith('v21-real-20260925-')),JSON.parse(await fs.readFile(root+'/grants-before.json','utf8')),'old grants must not be reset');
const grants=allGrants.filter(g=>g.logical_id.startsWith('v21-real-20260925-'));
assert.equal(grants.length,6);assert.equal(grants.filter(g=>g.task_id).length,tasks.length);
const frozenReport=JSON.parse(await fs.readFile(out+'/model-single-report-download.json','utf8'));
const response=await fetch(`${base}/api/case-library/projects/${projectId}/reports/${frozenReport.report_id}/html`);assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),frozenReport.sha256,'later runs must not rewrite the earlier report');
const report={checked_at:new Date().toISOString(),project_id:projectId,checks:{cases:12,original_contents_equal:true,model_tasks:tasks.length,harness_starts:tasks.reduce((n,t)=>n+t.harness_starts,0),registered_grants:grants.length,unclaimed_grants:grants.filter(g=>!g.task_id).length,runs:runs.length,run_model_calls:0,media_hashes_verified:mediaVerified,old_files_checked:Object.keys(before).length,old_changed_files:changed},tasks,runs,batches:batches.map(b=>({batch_id:b.batch_id,scope:b.scope,state:b.state,software_version:b.software_version,items:b.items}))};
await fs.writeFile(out+'/model-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.checks));
