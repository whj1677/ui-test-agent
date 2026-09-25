import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ReportSnapshots, renderReport } from '../server/report-snapshots.mjs';
import { ScriptOperations } from '../server/script-operations.mjs';
import { claimDevelopmentAuthorization } from '../server/build/development-authorization.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';

async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-v21-unit-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const content={external_id:'UNIT-1',title:'原要求 <script>alert(1)</script>',status:'CONFIRMED',steps:[{order:1,action:'读取字段',expected:'220.5 kW'}]};
  const project={project_id:'project-unit',name:'Unit',cases:[{case_id:'case-unit',versions:[{version:1,content,content_sha256:'A'.repeat(64)}]}]};
  const image=Buffer.from('unit-image-raw-bytes');await fs.writeFile(path.join(root,'image.png'),image);
  const run={project_id:project.project_id,run_id:'run-unit',origin:'EXPLICIT_CANDIDATE_TRIAL',executed_case_id:'case-unit',executed_case_version:1,executed_external_id:'UNIT-1',execution_status:'FINISHED',status:'FAILED',frozen_case_content:content,error:{actual:'200 kW',password:'SECRET'},files:[{kind:'trial_screenshot',file_id:'media-1',relative_path:'image.png',bytes:image.length,sha256:createHash('sha256').update(image).digest('hex').toUpperCase()}]};
  const records=async()=>[run],caseStore={getProject:async id=>id===project.project_id?project:null};
  const reports=new ReportSnapshots({root:path.join(root,'reports'),caseStore,records,store:{runDirectory:()=>root},buildStore:{taskDirectory:()=>root},batchManager:{get:async()=>({batch_id:'batch-unit',state:'FINISHED',items:[{case_id:'case-unit',case_version:1,external_id:'UNIT-1',run_id:'run-unit',state:'FINISHED'},{case_id:'case-unit',case_version:1,external_id:'UNIT-2',state:'BLOCKED',reason:'SCRIPT_MISSING'}]})}});
  return {root,run,project,caseStore,reports,records};
}
test('report snapshots freeze exact run, escape content, redact fields and embed verified media',async t=>{
  const f=await fixture(t),input={scope:'run',run_id:'run-unit',request_id:'unit-report-request'};
  const r=await f.reports.create(f.project.project_id,input);f.run.status='PASSED';
  const again=await f.reports.create(f.project.project_id,input);assert.equal(again.entries[0].result,'FAILED');assert.equal(r.entries[0].media[0].included,true);
  const html=renderReport(r);assert.ok(html.includes('data:image/png;base64,'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('SECRET'));assert.ok(html.includes('200 kW'));
  assert.ok(!html.includes('http://127.0.0.1'));await assert.rejects(f.reports.get(r.report_id,'other-project'),/MISMATCH/);
  await assert.rejects(f.reports.create(f.project.project_id,{...input,run_id:'other'}),/CONFLICT/);
});
test('report missing/tampered media remains missing and blocked batch items stay in denominator',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.root,'image.png'),'changed');
  const r=await f.reports.create(f.project.project_id,{scope:'batch',batch_id:'batch-unit',request_id:'unit-batch-report'});
  assert.deepEqual(r.counts,{requested:2,executed:1,passed:0,failed:1,not_run:1});assert.equal(r.entries[0].media[0].included,false);assert.match(r.entries[0].media[0].reason,/INTEGRITY/);
  await assert.rejects(f.reports.create(f.project.project_id,{scope:'run',run_id:'other',request_id:'invalid-run-report'}),/NOT_IN_PROJECT/);
});
test('generation preflight has real authorization boundary, separates revision input, no task on rejection',async t=>{
  const f=await fixture(t);let starts=0;
  const source={project_id:f.project.project_id,case_id:'case-unit',case_version:1,source_task_id:'source',candidate_version:2,bundle_sha256:'B'.repeat(64)};
  const m={store:{root:f.root},generationDisabled:true,developmentEnvironments:[],caseAutomation:async()=>({candidates:[{applies_to_selected_version:true,selection:source}]}),submitDevelopment:()=>{starts++;throw Error('MODEL_MUST_NOT_START');}};
  const operations=new ScriptOperations({root:path.join(f.root,'operations'),caseStore:f.caseStore,records:f.records,buildManager:m});
  const request={mode:'regenerate',environment_id:'not-ready',items:[{case_id:'case-unit',case_version:1}]};
  const preview=await operations.preflight(f.project.project_id,request);assert.equal(preview.items[0].reason,'GENERATION_NOT_AUTHORIZED');
  await assert.rejects(operations.start(f.project.project_id,{...request,request_id:'generation-rejected'}),/GENERATION_BLOCKED/);assert.equal((await operations.list()).length,0);assert.equal(starts,0);
  await assert.rejects(operations.preflight(f.project.project_id,{...request,items:[{...request.items[0],source_task_id:'source'}]}),/FRESH_INPUT/);
  const revise=await operations.preflight(f.project.project_id,{...request,mode:'revise'});assert.equal(revise.items[0].reason,'REVISION_SCRIPT_AND_FEEDBACK_REQUIRED');
  await assert.rejects(operations.preflight(f.project.project_id,{...request,mode:'revise',items:[{...source,feedback:'定位错误',run_id:'other'}]}),/RUN_IDENTITY/);
});

test('invalid revision seed cannot consume an existing authorization',async t=>{
  const f=await fixture(t),file=path.join(f.root,'development-authorizations.json');
  await fs.writeFile(file,JSON.stringify({entries:[{logical_id:'unit-grant',task_id:null,mode:'recovery'}]}));
  const store={root:f.root,serial:fn=>fn()};
  await assert.rejects(claimDevelopmentAuthorization(store,'unit-grant','task-invalid',()=>{throw Error('REVISION_AUTHORIZED_SEED_MISMATCH');}),/SEED_MISMATCH/);
  assert.equal(JSON.parse(await fs.readFile(file)).entries[0].task_id,null);
});

test('generation queue freezes each input, preserves mode, is idempotent and does not create grants (coordinator unit double)',async t=>{
  const f=await fixture(t);let starts=0;const calls=[];
  await fs.writeFile(path.join(f.root,'development-authorizations.json'),JSON.stringify({entries:[{logical_id:'unit-new',project_id:f.project.project_id,case_id:'case-unit',case_version:1,content_sha256:'A'.repeat(64),environment_id:'unit-env',mode:'new',limits:{wall_ms:100,self_tests:1,tool_calls:1},task_id:null}]}));
  const manager={store:{root:f.root,getTask:async()=>({task_status:'FAILED',error:{code:'UNIT_NO_MODEL_EXECUTED'}})},generationDisabled:false,developmentEnvironments:[{id:'unit-env'}],caseAutomation:async()=>({candidates:[]}),otherActive:()=>false,completions:new Map(),
    submitDevelopment:async request=>{calls.push(request);starts++;manager.completions.set('unit-task',Promise.resolve());return{task_id:'unit-task'};}};
  const operations=new ScriptOperations({root:path.join(f.root,'ops'),buildManager:manager,caseStore:f.caseStore,records:f.records});
  const input={mode:'regenerate',environment_id:'unit-env',items:[{case_id:'case-unit',case_version:1}],request_id:'unit-generation-idempotency'};
  const [a,b]=await Promise.all([operations.start(f.project.project_id,input),operations.start(f.project.project_id,input)]);assert.equal(a.operation_id,b.operation_id);await operations.completion;
  assert.equal(starts,1);assert.equal(calls[0].maintenance.mode,'regenerate');assert.equal(calls[0].seedBundle,undefined);assert.equal(calls[0].maintenance.feedback,null);
  assert.equal((await operations.get(a.operation_id,f.project.project_id)).items[0].state,'FAILED');
});

test('revision passes verified complete bundle and selected feedback; cancellation is durable and restart does not replay (unit double)',async t=>{
  const f=await fixture(t),directory=path.join(f.root,'source','development','final');
  await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'candidate.spec.mjs'),'// unit entry');await fs.writeFile(path.join(directory,'helper.mjs'),'// unit helper');
  const bundle=await developmentBundle(directory,{validate:false});const {entries,...manifest}=bundle;
  const selection={project_id:f.project.project_id,case_id:'case-unit',case_version:1,source_task_id:'source',candidate_version:2,bundle_sha256:manifest.sha256};
  await fs.writeFile(path.join(f.root,'development-authorizations.json'),JSON.stringify({entries:[{logical_id:'unit-revise',project_id:f.project.project_id,case_id:'case-unit',case_version:1,content_sha256:'A'.repeat(64),environment_id:'unit-env',mode:'recovery',task_id:null}]}));
  let release,submitted;const wait=new Promise(r=>release=r);
  const m={store:{root:f.root,taskDirectory:()=>path.join(f.root,'source'),getTask:async id=>id==='source'?{task_id:id,candidates:[{version:2,bundle:manifest}]}:{task_status:'CANCELLED'}},generationDisabled:false,developmentEnvironments:[{id:'unit-env'}],caseAutomation:async()=>({candidates:[{applies_to_selected_version:true,selection}]}),otherActive:()=>false,completions:new Map(),stop:async()=>release(),submitDevelopment:async request=>{submitted=request;m.active={taskId:'unit-task'};m.completions.set('unit-task',wait);return {task_id:'unit-task'};}};
  const op=new ScriptOperations({root:path.join(f.root,'ops'),caseStore:f.caseStore,records:f.records,buildManager:m});
  const v=await op.start(f.project.project_id,{mode:'revise',environment_id:'unit-env',request_id:'unit-revision-request',items:[{...selection,feedback:'保留原动作与预期，仅修复定位'}]});
  for(let i=0;i<100&&!submitted;i++)await new Promise(r=>setTimeout(r,5));
  assert.ok(submitted);assert.equal(submitted.seedBundle.entries.length,2);assert.equal(submitted.seedBundle.sha256,manifest.sha256);assert.match(submitted.maintenance.feedback,/原动作/);assert.equal(submitted.maintenance.source_selection.source_task_id,'source');
  await op.stop(v.operation_id,f.project.project_id);await op.completion;
  const saved=await op.get(v.operation_id,f.project.project_id);assert.equal(saved.cancel_requested,true);assert.equal(saved.state,'CANCELLED');
  saved.state='RUNNING';saved.items[0].state='QUEUED';await op.save(saved);await op.init();
  const recovered=await op.get(v.operation_id,f.project.project_id);assert.equal(recovered.state,'INTERRUPTED');assert.equal(recovered.items[0].reason,'SERVICE_INTERRUPTED_NO_REPLAY');
});
