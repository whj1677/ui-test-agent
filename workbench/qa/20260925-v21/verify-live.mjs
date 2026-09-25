// Uses the sole formal workbench. Never starts a server or a new execution.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:4322',project='project-6f4c682c-590c-4d65-a23c-120835e00e0c',qa='workbench/qa/20260925-v21';
const get=async url=>{const r=await fetch(base+url);assert.ok(r.ok,`${url}: ${r.status}`);return r.json();};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const {batches}=await get(`/api/case-library/projects/${project}/batches`),started=batches.filter(b=>b.state!=='PREVIEW');
const full=started.find(b=>b.software_version==='V21-全项目-冻结版本');assert.ok(full);assert.equal(full.items.length,12);assert.equal(full.items.filter(i=>i.state==='BLOCKED').length,9);
assert.equal(full.items.find(i=>i.external_id==='KC-22').case_version,1);
const current=await get(`/api/case-library/projects/${project}`);assert.equal(current.cases.find(c=>c.external_id==='KC-22').current_version,2);
// Re-send only this already-started request, proving no duplicate model or execution admission.
const before=(await get('/api/runs')).runs.length;
const replay=await fetch(`${base}/api/case-library/projects/${project}/batches/${full.batch_id}/start`,{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify({request_id:full.request_id,allow_partial:full.allow_partial})});
assert.ok(replay.ok);assert.equal((await replay.json()).batch_id,full.batch_id);assert.equal((await get('/api/runs')).runs.length,before);
const cross=await fetch(`${base}/api/case-library/projects/project-5fb015d9-a47d-4e14-9444-449a997692f7/batches/${full.batch_id}`);assert.ok(!cross.ok);
const baseline=JSON.parse(await fs.readFile('workbench/.local/v21/original-build-files.json','utf8'));let matched=0;
for(const [file,expected] of Object.entries(baseline)){assert.equal(hash(await fs.readFile(path.join('workbench/.local/fresh25-b/build-tasks',file))),expected,file);matched++;}
const original=JSON.parse(await fs.readFile('workbench/.local/v21/original-case-hash.json','utf8'));assert.equal(hash(await fs.readFile(original.path)),original.sha256);
const operations=await get(`/api/case-library/projects/${project}/script-operations`);assert.equal(operations.operations.length,0);
const {runs}=await get('/api/runs');const newRuns=runs.filter(r=>r.started_at>='2026-09-25T07:40:00Z'&&[project,'project-5fb015d9-a47d-4e14-9444-449a997692f7'].includes(r.project_id));
assert.ok(newRuns.every(r=>r.model_calls===0&&r.harness_starts===0));
const result={checked_at:new Date().toISOString(),project,started_batches:started,new_runs:newRuns.map(r=>({run_id:r.run_id,case:r.executed_external_id,status:r.status,execution_status:r.execution_status,batch_id:r.batch_id,model_calls:r.model_calls,harness_starts:r.harness_starts,bundle_sha256:r.bundle_sha256,recording:r.recording})),checks:{original_build_files_unchanged:matched,original_24_case_project_unchanged:true,replay_created_no_run:true,cross_project_batch_rejected:true,full_scope:12,full_blocked:9,frozen_KC22:1,current_KC22:2,generation_operations_created:0}};
await fs.writeFile(path.join(qa,'live-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.checks));
