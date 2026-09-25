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
import { createWorkbenchServer } from '../server/app.mjs';

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

test('exact identity + whole helper bundle; concurrent and persisted request replay executes once without changing source task',async t=>{
  const f=await fixture(t);const before=await fs.readFile(path.join(f.store.taskDirectory(f.request.source_task_id),'task.json'));
  const [a,b]=await Promise.all([f.manager.startCandidateTrial(f.request),f.manager.startCandidateTrial(Object.fromEntries(Object.entries(f.request).reverse()))]);assert.equal(a.run_id,b.run_id);await f.manager.settle();
  const restarted=new BuildTaskManager(f.options);assert.equal((await restarted.startCandidateTrial(f.request)).run_id,a.run_id);assert.deepEqual(f.counts(),{executes:1,releases:1});
  assert.deepEqual(await fs.readFile(path.join(f.store.taskDirectory(f.request.source_task_id),'task.json')),before);
  const run=await f.runStore.getRun(a.run_id);assert.equal(run.status,'PASSED');assert.equal(run.complete_pass,true);assert.equal(run.evidence_status,'INCOMPLETE'); // no synthetic screenshots: media failure is independent
  await assert.rejects(restarted.startCandidateTrial({...f.request,lane:'negative'}),/REQUEST_CONFLICT/);
});
test('cross-project/version/content and unauthorized environment are rejected before execution',async t=>{
  const f=await fixture(t);
  for(const change of [{project_id:'project-other-12345678'},{case_version:2},{content_sha256:'0'.repeat(64)},{environment_id:'elsewhere'},{bundle_sha256:'0'.repeat(64)}])await assert.rejects(f.manager.startCandidateTrial({...f.request,...change}),/IDENTITY/);
  f.manager.candidateTrialAuthorizations=[];await assert.rejects(f.manager.startCandidateTrial(f.request),/NOT_AUTHORIZED/);assert.equal(f.counts().executes,0);
});
test('helper change or missing file rejects unchanged entry; historical version remains explicitly historical',async t=>{
  const f=await fixture(t);
  const current=await f.caseStore.getProject(f.request.project_id);
  await f.caseStore.updateProject(current.project_id,current.revision,p=>({...p,cases:p.cases.map(c=>{const content={...c.versions[0].content,title:'new requirement'};return {...c,current_version:2,versions:[...c.versions,{version:2,content,content_sha256:contentHash(content)}]};})}));
  const view=await f.manager.caseAutomation(f.request.project_id,f.request.case_id,2);assert.equal(view.candidates[0].applies_to_selected_version,false);
  await fs.writeFile(path.join(f.final,'helper.mjs'),'changed');await assert.rejects(f.manager.startCandidateTrial(f.request),/BUNDLE_CHANGED/);
  await fs.unlink(path.join(f.final,'helper.mjs'));await assert.rejects(f.manager.startCandidateTrial(f.request),/ENOENT/);assert.equal(f.counts().executes,0);
});
test('cancel uses owned signal and lease, does not reopen source; restart does not replay',async t=>{
  const f=await fixture(t,true);const r=await f.manager.startCandidateTrial(f.request);
  while(!f.counts().executes)await new Promise(resolve=>setTimeout(resolve,5));
  await f.manager.stopCandidateTrial(r.run_id);await f.manager.settle();const run=await f.runStore.getRun(r.run_id);assert.equal(run.execution_status,'CANCELLED');assert.equal(run.complete_pass,false);assert.equal(f.counts().releases,1);
  assert.equal((await f.manager.startCandidateTrial(f.request)).run_id,r.run_id);assert.equal(f.counts().executes,1);
});
test('green Playwright report with missing original steps is not complete_pass',async t=>{
  const f=await fixture(t);const original=f.manager.adapter.verifyCandidate;
  f.manager.adapter.verifyCandidate=async options=>{const result=await original(options);const report=JSON.parse(await fs.readFile(result.reportPath));report.suites[0].specs[0].tests[0].results[0].steps=[];await fs.writeFile(result.reportPath,JSON.stringify(report));return result;};
  const run=await f.manager.startCandidateTrial(f.request);await f.manager.settle();const saved=await f.runStore.getRun(run.run_id);
  assert.equal(saved.status,'PASSED');assert.equal(saved.step_coverage.complete,false);assert.equal(saved.complete_pass,false);
});
test('helper mutation during execution cannot inherit a passing report',async t=>{
  const f=await fixture(t);const original=f.manager.adapter.verifyCandidate;
  f.manager.adapter.verifyCandidate=async options=>{const result=await original(options);await fs.writeFile(path.join(path.dirname(options.candidatePath),'helper.mjs'),'mutated');return result;};
  const run=await f.manager.startCandidateTrial(f.request);await f.manager.settle();const saved=await f.runStore.getRun(run.run_id);
  assert.equal(saved.result.test_status,'PASSED');assert.equal(saved.complete_pass,false);assert.equal(saved.same_candidate_hash,false);assert.equal(saved.technical_error.code,'TRIAL_SNAPSHOT_CHANGED');
});
test('run media route enforces run ownership, digest and byte size; old build WebM has correct MIME',async t=>{
  const f=await fixture(t);const runId=`run-${randomUUID()}`;const bytes=Buffer.from('engineering-media');const media={media_id:'media-1',file_name:'video.webm',relative_path:'video.webm',kind:'video',content_type:'video/webm',bytes:bytes.length,sha256:digest(bytes)};
  await f.runStore.createRun({run_id:runId,media:[media]});await fs.writeFile(path.join(f.runStore.runDirectory(runId),'video.webm'),bytes);
  const server=createWorkbenchServer({store:f.runStore,buildStore:f.store,buildManager:f.manager});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base=`http://127.0.0.1:${server.address().port}`;
  const url=`${base}/api/runs/${runId}/media/media-1`;assert.equal((await fetch(url)).headers.get('content-type'),'video/webm');assert.equal((await fetch(`${base}/api/runs/run-nonexistent/media/media-1`)).status,404);
  await fs.writeFile(path.join(f.runStore.runDirectory(runId),'video.webm'),'tampered');assert.equal((await fetch(url)).status,409);
  const taskDir=f.store.taskDirectory(f.request.source_task_id);await fs.writeFile(path.join(taskDir,'old.webm'),bytes);await f.store.updateTask(f.request.source_task_id,r=>({...r,files:[{...media,file_id:'old-video',relative_path:'old.webm',kind:'development_evidence',content_type:'text/plain',web_visible:true}]}));
  assert.equal((await fetch(`${base}/api/build/tasks/${f.request.source_task_id}/media/old-video`)).headers.get('content-type'),'video/webm');
  f.manager.generationDisabled=true;assert.equal((await fetch(base+'/api/build/tasks/develop',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({logical_id:'never-start'})})).status,403);
});
