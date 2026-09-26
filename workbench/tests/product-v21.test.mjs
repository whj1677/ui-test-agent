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

const buildManagerContract = {
  otherActive: () => false,
  assertStorageWritable() {
    if (this.shutdownRequested) throw Error('WORKBENCH_SHUTTING_DOWN');
    if (this.storageFault) throw Error('BUILD_STORAGE_UNAVAILABLE');
  },
  reportStorageFault(error, operation) {
    this.storageFault ||= { code: error.code || 'BUILD_STORAGE_FAILURE', operation };
  },
};

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
  f.run.step_replay={steps:[{order:1,execution_status:'FAILED',actual:'200 kW'}],chapters:[{step_id:'CASE_STEP_1',start_seconds:0}]};
  const r=await f.reports.create(f.project.project_id,input);f.run.status='PASSED';
  const again=await f.reports.create(f.project.project_id,input);assert.equal(again.entries[0].result,'FAILED');assert.equal(r.entries[0].media[0].included,true);
  const html=renderReport(r);assert.ok(html.includes('data:image/png;base64,'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('SECRET'));assert.ok(html.includes('200 kW'));
  assert.ok(!html.includes('http://127.0.0.1'));await assert.rejects(f.reports.get(r.report_id,'other-project'),/MISMATCH/);
  assert.equal(r.entries[0].steps[0].actual,'200 kW');assert.equal(await f.reports.html(r.report_id,f.project.project_id),html);
  await assert.rejects(f.reports.create(f.project.project_id,{...input,run_id:'other'}),/CONFLICT/);
});
test('report missing/tampered media remains missing and blocked batch items stay in denominator',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.root,'image.png'),'changed');
  const r=await f.reports.create(f.project.project_id,{scope:'batch',batch_id:'batch-unit',request_id:'unit-batch-report'});
  assert.deepEqual(r.counts,{requested:2,executed:1,passed:0,failed:1,not_run:1});assert.equal(r.entries[0].media[0].included,false);assert.match(r.entries[0].media[0].reason,/INTEGRITY/);
  await assert.rejects(f.reports.create(f.project.project_id,{scope:'run',run_id:'other',request_id:'invalid-run-report'}),/NOT_IN_PROJECT/);
});
test('report cancellation prevents snapshot commit and pending conflicting request is rejected',async t=>{
  const f=await fixture(t);let release,entered=false;const gate=new Promise(r=>release=r);
  f.reports.records=async()=>{entered=true;await gate;return[f.run];};
  const input={scope:'run',run_id:'run-unit',request_id:'unit-report-cancel'};
  const pending=f.reports.create(f.project.project_id,input);const rejection=assert.rejects(pending,/REPORT_CANCELLED/);
  for(let n=0;n<100&&!entered;n++)await new Promise(r=>setTimeout(r,2));assert.ok(entered);
  await assert.rejects(f.reports.create(f.project.project_id,{...input,include_video:true}),/REPORT_REQUEST_CONFLICT/);
  assert.equal((await f.reports.cancel(f.project.project_id,input)).state,'CANCEL_REQUESTED');release();await rejection;
  assert.equal((await f.reports.list(f.project.project_id)).length,0);
});
test('generation preflight has real authorization boundary, separates revision input, no task on rejection',async t=>{
  const f=await fixture(t);let starts=0;
  const source={project_id:f.project.project_id,case_id:'case-unit',case_version:1,source_task_id:'source',candidate_version:2,bundle_sha256:'B'.repeat(64)};
  const m={...buildManagerContract,store:{root:f.root},generationDisabled:true,developmentEnvironments:[],caseAutomation:async()=>({candidates:[{applies_to_selected_version:true,selection:source}]}),submitDevelopment:()=>{starts++;throw Error('MODEL_MUST_NOT_START');}};
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
  const manager={...buildManagerContract,store:{root:f.root,getTask:async()=>({task_status:'FAILED',error:{code:'UNIT_NO_MODEL_EXECUTED'}})},generationDisabled:false,developmentEnvironments:[{id:'unit-env'}],caseAutomation:async()=>({candidates:[]}),otherActive:()=>false,completions:new Map(),
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
  const m={...buildManagerContract,store:{root:f.root,taskDirectory:()=>path.join(f.root,'source'),getTask:async id=>id==='source'?{task_id:id,candidates:[{version:2,bundle:manifest}]}:{task_status:'CANCELLED'}},generationDisabled:false,developmentEnvironments:[{id:'unit-env'}],caseAutomation:async()=>({candidates:[{applies_to_selected_version:true,selection}]}),otherActive:()=>false,completions:new Map(),stop:async()=>release(),submitDevelopment:async request=>{submitted=request;m.active={taskId:'unit-task'};m.completions.set('unit-task',wait);return {task_id:'unit-task'};}};
  const op=new ScriptOperations({root:path.join(f.root,'ops'),caseStore:f.caseStore,records:f.records,buildManager:m});
  const v=await op.start(f.project.project_id,{mode:'revise',environment_id:'unit-env',request_id:'unit-revision-request',items:[{...selection,feedback:'保留原动作与预期，仅修复定位'}]});
  for(let i=0;i<100&&!submitted;i++)await new Promise(r=>setTimeout(r,5));
  assert.ok(submitted);assert.equal(submitted.seedBundle.entries.length,2);assert.equal(submitted.seedBundle.sha256,manifest.sha256);assert.match(submitted.maintenance.feedback,/原动作/);assert.equal(submitted.maintenance.source_selection.source_task_id,'source');
  await op.stop(v.operation_id,f.project.project_id);await op.completion;
  const saved=await op.get(v.operation_id,f.project.project_id);assert.equal(saved.cancel_requested,true);assert.equal(saved.state,'CANCELLED');
  saved.state='RUNNING';saved.items[0].state='QUEUED';await op.save(saved);await op.init();
  const recovered=await op.get(v.operation_id,f.project.project_id);assert.equal(recovered.state,'INTERRUPTED');assert.equal(recovered.items[0].reason,'SERVICE_INTERRUPTED_NO_REPLAY');
});


test('explicit user generation confirms bounded new receipt without resetting consumed grants; preflight is read-only',async t=>{
  const f=await fixture(t);let starts=0,acquires=0;
  const used={logical_id:'old-consumed',task_id:'old-task',project_id:f.project.project_id,case_id:'case-unit'};
  const ledger=path.join(f.root,'development-authorizations.json');await fs.writeFile(ledger,JSON.stringify({entries:[used]}));
  const manager={...buildManagerContract,store:{root:f.root,serial:fn=>fn(),getTask:async()=>({task_status:'FAILED',error:{code:'UNIT_NO_MODEL_EXECUTED'}})},
    userInitiatedOperations:true,modelConfiguration:{configured:true},generationDisabled:false,developmentEnvironments:[{id:'unit-env',validation_mode:'normal-only'}],
    candidateTrialEnvironments:[{id:'unit-env',configurationIdentity:{kind:'registered-static-html'},check:async()=>{},acquire:async()=>{acquires++;}}],
    caseAutomation:async()=>({candidates:[]}),otherActive:()=>false,completions:new Map(),
    submitDevelopment:async request=>{starts++;await claimDevelopmentAuthorization(manager.store,request.logical_id,'unit-new-task');manager.completions.set('unit-new-task',Promise.resolve());return{task_id:'unit-new-task'};}};
  const operations=new ScriptOperations({root:path.join(f.root,'ops'),buildManager:manager,caseStore:f.caseStore,records:f.records});
  const input={mode:'regenerate',environment_id:'unit-env',items:[{case_id:'case-unit',case_version:1}],request_id:'user-generation-test'};
  const plan=await operations.preflight(f.project.project_id,input);assert.equal(plan.items[0].reason,null);assert.equal(plan.items[0].requires_model_confirmation,true);
  assert.equal(plan.items[0].limits.harness_starts,1);assert.equal(plan.items[0].limits.wall_ms,1200000);
  assert.deepEqual(JSON.parse(await fs.readFile(ledger)).entries,[used]);assert.equal(acquires,0);
  await assert.rejects(operations.start(f.project.project_id,input),/MODEL_CONFIRMATION_REQUIRED/);assert.equal(starts,0);
  const confirmed={...input,confirm_model_use:true};const [a,b]=await Promise.all([operations.start(f.project.project_id,confirmed),operations.start(f.project.project_id,confirmed)]);
  assert.equal(a.operation_id,b.operation_id);await operations.completion;assert.equal(starts,1);
  const entries=JSON.parse(await fs.readFile(ledger)).entries;assert.equal(entries.length,2);assert.deepEqual(entries[0],used);assert.equal(entries[1].task_id,'unit-new-task');assert.equal(entries[1].request_id,input.request_id);
  assert.equal(entries[1].authorization_source,'EXPLICIT_USER_GENERATION_CONFIRMATION');assert.equal(entries[1].limits.harness_starts,1);
  manager.candidateTrialEnvironments[0].check=async()=>{throw Error('TRIAL_ENVIRONMENT_CHANGED');};
  const failed=await operations.preflight(f.project.project_id,{...input,request_id:'another-request'});assert.equal(failed.items[0].reason,'TRIAL_ENVIRONMENT_CHANGED');assert.equal(starts,1);
});


test('user-confirmed revision receipt persists UTF-8 seed and whole bundle without approving script',async t=>{
  const f=await fixture(t),directory=path.join(f.root,'source/development/final');await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(path.join(directory,'candidate.spec.mjs'),'// 原始动作');await fs.writeFile(path.join(directory,'helper.mjs'),'// helper');
  const {entries,...manifest}=await developmentBundle(directory,{validate:false});
  const selection={project_id:f.project.project_id,case_id:'case-unit',case_version:1,source_task_id:'source',candidate_version:1,bundle_sha256:manifest.sha256};let submitted;
  const manager={...buildManagerContract,store:{root:f.root,serial:fn=>fn(),taskDirectory:()=>path.join(f.root,'source'),getTask:async id=>id==='source'?{task_id:id,candidates:[{version:1,bundle:manifest}]}:{task_status:'FAILED'}},
    userInitiatedOperations:true,modelConfiguration:{configured:true},developmentEnvironments:[{id:'unit-env',validation_mode:'normal-only'}],candidateTrialEnvironments:[{id:'unit-env',configurationIdentity:{kind:'registered-static-html'},check:async()=>{}}],
    caseAutomation:async()=>({candidates:[{applies_to_selected_version:true,selection}]}),otherActive:()=>false,completions:new Map(),submitDevelopment:async r=>{submitted=r;manager.completions.set('unit-revision',Promise.resolve());return{task_id:'unit-revision'};}};
  const op=new ScriptOperations({root:path.join(f.root,'ops'),buildManager:manager,caseStore:f.caseStore,records:f.records});
  await op.start(f.project.project_id,{mode:'revise',environment_id:'unit-env',request_id:'explicit-revision-test',confirm_model_use:true,items:[{...selection,feedback:'只修定位，不改原要求'}]});await op.completion;
  assert.equal(submitted.seedBundle.entries.length,2);assert.equal(submitted.seedBundle.sha256,manifest.sha256);
  const receipt=JSON.parse(await fs.readFile(path.join(f.root,'development-authorizations.json'))).entries[0];assert.equal(receipt.seed_code,'// 原始动作');assert.equal(receipt.mode,'recovery');assert.equal(receipt.operation_mode,'revise');
});
