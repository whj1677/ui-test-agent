// Read-only evidence collection from the single formal 4322 workbench.
// Never starts a model, service, or case execution.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4322';
const projectId='project-80875248-3e14-4055-b077-b890dead1a9e';
const operationId='generation-ad99c803-96d9-4702-94eb-3f9628f76303';
const get=async p=>{const r=await fetch(base+p);assert.ok(r.ok,`${p}: ${r.status}`);return r.json();};
const op=await get(`/api/case-library/projects/${projectId}/script-operations/${operationId}`);
const tasks=[];
for(const i of op.items){
 if(!i.task_id){tasks.push({case:i.external_id,state:i.state});continue;}
 const t=await get('/api/build/tasks/'+i.task_id),d=t.development;
 tasks.push({case:i.external_id,case_id:i.case_id,case_version:i.case_version,task_id:i.task_id,state:i.state,task_status:t.task_status,reason:i.reason,error:t.error,
  model:t.runtime?.model,tool_calls:d?.tool_calls,harness_starts:d?.harness_starts,
  self_tests:(d?.self_tests||[]).map(s=>({number:s.number,bundle_sha256:s.bundle_sha256,status:s.result?.test_status,error:s.result?.error,coverage:s.coverage})),
  script_version:t.script_version,candidates:(t.candidates||[]).map(c=>({version:c.version,bundle:c.bundle,trial_runs:c.trial_runs})),source:t.source,human_review_status:t.human_review_status});
}
const evidence={checked_at:new Date().toISOString(),project_id:projectId,operation_id:operationId,state:op.state,tasks};
await fs.writeFile(new URL('./engineer-generation.json',import.meta.url),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({at:evidence.checked_at,state:op.state,tasks:tasks.map(t=>({case:t.case,state:t.state,status:t.task_status,tools:t.tool_calls,self_tests:t.self_tests?.length,candidates:t.candidates?.length,reason:t.reason}))}));
