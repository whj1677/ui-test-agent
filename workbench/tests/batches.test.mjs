import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { digest } from '../server/build/development-session.mjs';
import { developmentBundle } from '../server/build/development-bundle.mjs';
import { BatchManager } from '../server/batches.mjs';

async function fixture(t, waitForCancel = false) {
  const root = await fs.mkdtemp(fileURLToPath(new URL('../.local/candidate-trial-test-', import.meta.url)));
  const paths = createPaths({localRoot:root}), store = new BuildTaskStore(paths.buildTasksRoot), runStore = new WorkbenchStore(paths.dataRoot), caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
  await store.init(); await runStore.init(); await caseStore.init();
  const project = await caseStore.createProject({name:'trial engineering'}), caseId=`case-${randomUUID()}`, taskId=`build-${randomUUID()}`;
  const content={external_id:'ENGINEERING',title:'one',status:'CONFIRMED',steps:[{order:1,action:'observe',expected:'good'}]};
  await caseStore.updateProject(project.project_id,1,p=>({...p,cases:[{case_id:caseId,current_version:1,versions:[{version:1,content,content_sha256:contentHash(content)}]}]}));
  await store.createTask({task_id:taskId,source:{project_id:project.project_id,case_id:caseId,case_version:1,content_sha256:contentHash(content),external_id:content.external_id},files:[],candidates:[],environment_ref:{environment_id:'engineering'},active_attempt_id:null});
  const final=path.join(store.taskDirectory(taskId),'development/final');await fs.mkdir(final,{recursive:true});
  await fs.writeFile(path.join(final,'candidate.spec.mjs'),"import './helper.mjs';\n");await fs.writeFile(path.join(final,'helper.mjs'),'export const value = 1;\n');
  const bundle=await developmentBundle(final,{validate:false});
  await store.updateTask(taskId,r=>({...r,development:{submission:{bundle},self_tests:[]},candidates:[{version:1,sha256:bundle.files.find(f=>f.path==='candidate.spec.mjs').sha256,bundle,trial_runs:[]}]}));
  const request={project_id:project.project_id,case_id:caseId,case_version:1,content_sha256:contentHash(content),source_task_id:taskId,candidate_version:1,bundle_sha256:bundle.sha256,environment_id:'engineering',lane:'normal',request_id:`request-${randomUUID()}`};
  let executes=0,releases=0;
  const options={paths,store,runStore,caseStore,candidateTrialAuthorizations:[{...request,lanes:['normal']}],candidateTrialEnvironments:[{id:'engineering',check:async()=>{},acquire:async()=>({url:'http://127.0.0.1:1',identity:{id:'engineering-owned'},release:async()=>{releases++;}})}],adapter:{verifyCandidate:async({runDirectory,signal,candidatePath})=>{
    executes++;assert.equal(await fs.readFile(path.join(path.dirname(candidatePath),'helper.mjs'),'utf8'),'export const value = 1;\n');
    if(waitForCancel&&!signal.aborted)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    await fs.mkdir(runDirectory,{recursive:true});const reportPath=path.join(runDirectory,'playwright-report.json');
    await fs.writeFile(reportPath,JSON.stringify({suites:[{specs:[{title:'one',tests:[{expectedStatus:'passed',results:[{status:'passed',steps:[{title:'CASE_STEP_1',category:'test.step',duration:1}]}]}]}]}],stats:{expected:1,unexpected:0,skipped:0,flaky:0}}));
    return {reportPath,process:{exitCode:0,termination:signal.aborted?'cancelled':null}};
  },runHarnessTask:()=>{throw Error('MODEL_MUST_NOT_START');}}};
  const manager=new BuildTaskManager(options);t.after(async()=>{if(manager.active)await manager.stopCandidateTrial(manager.active.runId);await manager.settle();await fs.rm(root,{recursive:true,force:true});});
  return {root,final,store,runStore,caseStore,project,request,manager,options,counts:()=>({executes,releases})};
}


async function batchFixture(t,cancel=false){const f=await fixture(t,cancel);f.batches=new BatchManager({root:path.join(f.root,'batches'),buildManager:f.manager,caseStore:f.caseStore,runStore:f.runStore});await f.batches.init();return f;}
const input=f=>({project_id:f.project.project_id,scope:'single',case_ids:[f.request.case_id],software_version:'engineering-v1'});
const receipt={request_id:'engineering-request-123',allow_partial:true};
test('batch concurrent replay, frozen versions, software label and no model',async t=>{
 const f=await batchFixture(t);const b=await f.batches.preview(input(f));
 const current=await f.caseStore.getProject(f.project.project_id);await f.caseStore.updateProject(current.project_id,current.revision,p=>({...p,cases:p.cases.map(c=>({...c,current_version:2,versions:[...c.versions,{version:2,content:{...c.versions[0].content,title:'v2'},content_sha256:contentHash({...c.versions[0].content,title:'v2'})}]}))}));
 const [a,r]=await Promise.all([f.batches.start(b.batch_id,b.project_id,receipt),f.batches.start(b.batch_id,b.project_id,receipt)]);assert.equal(a.batch_id,r.batch_id);await f.batches.completion;
 const done=await f.batches.get(b.batch_id);assert.equal(done.items[0].result,'PASSED');assert.equal(done.items[0].case_version,1);assert.equal(f.counts().executes,1);
 const run=await f.runStore.getRun(done.items[0].run_id);assert.equal(run.software_version,'engineering-v1');assert.equal(run.model_calls,0);assert.equal(run.approval_status,'NOT_APPROVED');
 const next=await f.batches.preview(input(f));assert.equal(next.items[0].reason,'CASE_VERSION_NOT_APPLICABLE');assert.equal(next.items[0].case_version,2);
 await assert.rejects(f.batches.get(b.batch_id,'another-project'),/PROJECT/);await assert.rejects(f.batches.start(b.batch_id,b.project_id,{...receipt,request_id:'different-request'}),/CONFLICT/);
});
test('whole project retains missing scripts and requires partial consent',async t=>{
 const f=await batchFixture(t);const p=await f.caseStore.getProject(f.project.project_id);await f.caseStore.updateProject(p.project_id,p.revision,x=>({...x,cases:[...x.cases,{...x.cases[0],case_id:'case-missing-script'}]}));
 const b=await f.batches.preview({...input(f),scope:'project'});assert.equal(b.items.length,2);assert.equal(b.items[1].reason,'SCRIPT_MISSING');
 await assert.rejects(f.batches.start(b.batch_id,b.project_id,{...receipt,allow_partial:false}),/PARTIAL/);await f.batches.start(b.batch_id,b.project_id,receipt);await f.batches.completion;const d=await f.batches.get(b.batch_id);assert.equal(d.items[1].state,'BLOCKED');assert.equal(f.counts().executes,1);
 await assert.rejects(f.batches.preview({...input(f),case_ids:['other-case']}),/CROSS_PROJECT/);
});
test('requirements rejection is separate from PASSED, explicit diagnostic only',async t=>{
 const f=await batchFixture(t);f.manager.requirementReviews=[{...f.request,requirements_status:'NOT_ACCEPTED_ACTION_CHANGED',finding:'changed action'}];const b=await f.batches.preview(input(f));assert.equal(b.items[0].reason,'REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY');
 await assert.rejects(f.manager.startCandidateTrial(f.request),/DIAGNOSTIC/);const diagnostic=await f.batches.preview({...input(f),mode:'diagnostic'});await f.batches.start(diagnostic.batch_id,diagnostic.project_id,receipt);await f.batches.completion;assert.equal((await f.batches.get(diagnostic.batch_id)).items[0].result,'PASSED');
});
test('cancel stops owned run and remaining queue; restart never replays',async t=>{
 const f=await batchFixture(t,true);const b=await f.batches.preview(input(f));await f.batches.start(b.batch_id,b.project_id,receipt);while(!f.counts().executes)await new Promise(r=>setTimeout(r,5));await f.batches.stop(b.batch_id,b.project_id);await f.batches.completion;assert.equal((await f.batches.get(b.batch_id)).state,'CANCELLED');assert.ok((await f.batches.get(b.batch_id)).cancel_requested_at);
 const pending=await f.batches.preview(input(f));pending.state='RUNNING';await f.batches.save(pending);await f.batches.init();assert.equal((await f.batches.get(pending.batch_id)).state,'INTERRUPTED');assert.equal(f.counts().executes,1);
});
test('changed helper blocks before executor even after preview',async t=>{const f=await batchFixture(t);const b=await f.batches.preview(input(f));await fs.writeFile(path.join(f.final,'helper.mjs'),'changed');await f.batches.start(b.batch_id,b.project_id,receipt);await f.batches.completion;assert.equal(f.counts().executes,0);assert.match((await f.batches.get(b.batch_id)).items[0].reason,/BUNDLE_CHANGED/);});
