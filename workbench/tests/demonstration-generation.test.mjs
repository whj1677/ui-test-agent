import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ScriptOperations } from '../server/script-operations.mjs';
import { submitDevelopment, resolveDevelopmentDemonstration, developmentDemonstrationPrompt } from '../server/build/development-task.mjs';

const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const projectId='project-demo', caseId='case-demo', envId='env-demo', caseHash='A'.repeat(64), envHash='B'.repeat(64);
const demoId='demo-00000000-0000-4000-8000-000000000001';
const recording = () => ({schema:'workbench/human-demonstration-v1',project_id:projectId,case_id:caseId,case_version:1,
  content_sha256:caseHash,environment_id:envId,environment_configuration_sha256:envHash,status:'CONFIRMED',
  recording_sha256:'C'.repeat(64),confirmed_sha256:'E'.repeat(64),steps:[{order:1,action:'Open edit form',expected:'Name is required'}],
  events:[{event_id:'event-1',step_index:1,kind:'click',locator_hint:'Edit button',frame_hint:'main'}],
  assertion_reviews:[{step_index:1,confirmed:true,source:'FROZEN_CASE',locator_event_id:'event-1'}]});

function store(snapshot) {
  return {resolve: async (project,id,identity) => {
    assert.equal(project,projectId);assert.equal(id,demoId);
    if (identity.case_id!==snapshot.case_id || identity.case_version!==snapshot.case_version ||
        identity.content_sha256!==snapshot.content_sha256 || identity.environment_id!==snapshot.environment_id)
      throw Error('DEMONSTRATION_IDENTITY_MISMATCH');
    return structuredClone(snapshot);
  }};
}

function fixture(root,snapshot) {
  const calls=[];
  const manager={store:{root,serviceIdentity:null,getTask:async()=>({task_status:'FAILED',error:{code:'UNIT_STOP'}})},
    developmentEnvironments:[{id:envId,configuration_sha256:envHash}],caseAutomation:async()=>({candidates:[]}),
    otherActive:()=>false,assertStorageWritable(){},reportStorageFault(){},completions:new Map(),
    submitDevelopment:async request=>{calls.push(request);manager.completions.set('unit-task',Promise.resolve());return {task_id:'unit-task'};}};
  const caseStore={getProject:async()=>({project_id:projectId,cases:[{case_id:caseId,versions:[{version:1,content_sha256:caseHash,
    content:{case_type:'UI',status:'CONFIRMED',external_id:'UI-DEMO',title:'Demo case'}}]}]})};
  return {calls,manager,operations:new ScriptOperations({root:path.join(root,'ops'),buildManager:manager,caseStore,
    demonstrations:snapshot?store(snapshot):null,records:async()=>[]})};
}

async function grant(root) {
  await fs.writeFile(path.join(root,'development-authorizations.json'),JSON.stringify({entries:[{logical_id:'demo-grant',
    project_id:projectId,case_id:caseId,case_version:1,content_sha256:caseHash,environment_id:envId,mode:'new',task_id:null}]}));
}

test('recording identity, confirmation, environment digest, and forged snapshot are checked before generation',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'demonstration-generation-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await grant(root);
  const original=recording();const {operations}=fixture(root,original);
  const request={mode:'regenerate',request_id:'demo-preflight',environment_id:envId,
    items:[{case_id:caseId,case_version:1,demonstration_id:demoId}]};
  const plan=await operations.preflight(projectId,request);
  assert.equal(plan.items[0].demonstration.snapshot_sha256,sha(original));
  assert.equal(plan.items[0].demonstration.confirmed_sha256,original.confirmed_sha256);
  for(const [change,error] of [
    [{status:'STOPPED'},/GENERATION_DEMONSTRATION_MISMATCH/],
    [{environment_configuration_sha256:'D'.repeat(64)},/GENERATION_DEMONSTRATION_MISMATCH/],
    [{confirmed_sha256:null},/GENERATION_DEMONSTRATION_MISMATCH/],
    [{case_id:'another-case'},/DEMONSTRATION_IDENTITY_MISMATCH/],
    [{case_version:2},/DEMONSTRATION_IDENTITY_MISMATCH/],
    [{content_sha256:'D'.repeat(64)},/DEMONSTRATION_IDENTITY_MISMATCH/],
    [{environment_id:'another-env'},/DEMONSTRATION_IDENTITY_MISMATCH/],
  ]){
    const other=fixture(root,{...original,...change}).operations;
    await assert.rejects(other.preflight(projectId,request),error);
  }
  await assert.rejects(operations.preflight(projectId,{...request,items:[{...request.items[0],demonstration:{...original}}]}),/GENERATION_DEMONSTRATION_SNAPSHOT_FORBIDDEN/);
});

test('operation freezes recording, carries only stored snapshot into submission, and detects later change',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'demonstration-operation-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await grant(root);const snapshot=recording();let current=snapshot;
  const {operations,calls}=fixture(root,snapshot);
  operations.demonstrations={resolve:async()=>structuredClone(current)};
  const request={mode:'regenerate',request_id:'demo-operation',environment_id:envId,
    items:[{case_id:caseId,case_version:1,demonstration_id:demoId}]};
  const operation=await operations.start(projectId,request);await operations.completion;
  assert.equal(calls.length,1);
  assert.equal(calls[0].demonstration.snapshot_sha256,sha(snapshot));
  assert.equal(calls[0].demonstration.confirmed_sha256,snapshot.confirmed_sha256);
  assert.deepEqual(calls[0].demonstration.snapshot,snapshot);
  assert.equal(operation.fingerprint,sha({request:{...request,quality_review_mode:'static-v1'},demonstrationDigest:[sha(snapshot)]}));
  current={...snapshot,confirmed_sha256:'F'.repeat(64),assertion_reviews:[{step_index:1,confirmed:true,source:'FROZEN_CASE',locator_event_id:null}]};
  await assert.rejects(operations.start(projectId,request),/GENERATION_DEMONSTRATION_CHANGED/);
});

test('direct submission re-resolves the confirmed store snapshot and prompt treats it only as guidance',async()=>{
  const snapshot=recording();const authorization={project_id:projectId,case_id:caseId,case_version:1,content_sha256:caseHash,environment_id:envId};
  const manager={demonstrations:store(snapshot)};
  const supplied={demonstration_id:demoId,confirmed_sha256:snapshot.confirmed_sha256,snapshot_sha256:sha(snapshot),snapshot};
  assert.deepEqual(await resolveDevelopmentDemonstration(manager,supplied,authorization,{configuration_sha256:envHash}),snapshot);
  await assert.rejects(resolveDevelopmentDemonstration({},supplied,authorization,{configuration_sha256:envHash}),/DEVELOPMENT_DEMONSTRATION_INVALID/);
  await assert.rejects(resolveDevelopmentDemonstration(manager,{...supplied,snapshot:{...snapshot,status:'STOPPED'}},authorization,{configuration_sha256:envHash}),/DEVELOPMENT_DEMONSTRATION_MISMATCH/);
  await assert.rejects(resolveDevelopmentDemonstration(manager,{...supplied,snapshot_sha256:'D'.repeat(64)},authorization,{configuration_sha256:envHash}),/DEVELOPMENT_DEMONSTRATION_MISMATCH/);
  await assert.rejects(resolveDevelopmentDemonstration(manager,{...supplied,confirmed_sha256:'D'.repeat(64)},authorization,{configuration_sha256:envHash}),/DEVELOPMENT_DEMONSTRATION_MISMATCH/);
  await assert.rejects(resolveDevelopmentDemonstration(manager,supplied,{...authorization,case_version:2},{configuration_sha256:envHash}),/DEMONSTRATION_IDENTITY_MISMATCH/);
  await assert.rejects(resolveDevelopmentDemonstration(manager,supplied,authorization,{configuration_sha256:'D'.repeat(64)}),/DEVELOPMENT_DEMONSTRATION_MISMATCH/);
  assert.equal(await resolveDevelopmentDemonstration(manager,undefined,authorization,{configuration_sha256:envHash}),null);
  assert.deepEqual(developmentDemonstrationPrompt(null),[]);
  const prompt=developmentDemonstrationPrompt(snapshot).join('\n');
  assert.match(prompt,/untrusted action and locator guidance only/);
  assert.match(prompt,/never overrides the frozen case/);
  assert.match(prompt,/Name is required/);
  assert.match(prompt,/Edit button/);
  const marked={...snapshot,events:[...snapshot.events,
    {event_id:'event-2',step_index:0,kind:'assertion_target',locator_hint:{id:'selected-target'}},
    {event_id:'event-3',step_index:0,kind:'assertion_target',locator_hint:{id:'unselected-target'}}],
    assertion_reviews:[{step_index:0,confirmed:true,source:'FROZEN_CASE',locator_event_ids:['event-2']}]};
  const selectedPrompt=developmentDemonstrationPrompt(marked).join('\n');
  assert.match(selectedPrompt,/"id":"selected-target"/);
  assert.doesNotMatch(selectedPrompt,/"id":"unselected-target"/);
});

test('direct submitDevelopment rejects a forged demonstration before consuming its grant',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'demonstration-direct-submit-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await grant(root);
  const snapshot=recording();
  const scope={origin:'http://127.0.0.1:3100',path_prefix:'/'};
  const environment={id:envId,project_id:projectId,user_registered_target:true,configuration_sha256:envHash,
    validation_mode:'normal-only',normal_url:'http://127.0.0.1:3100/',target_scope:scope};
  const manager={store:{root},caseStore:{getProject:async()=>({cases:[{case_id:caseId,versions:[{version:1,content:{case_type:'UI'}}]}]})},
    demonstrations:store(snapshot),developmentEnvironments:[environment],candidateTrialEnvironments:[{id:envId,
      configurationIdentity:{kind:'registered-user-target',...scope},check:async()=>{}}],
    starting:false,active:null,otherActive:()=>false,assertStorageWritable(){},idFactory:()=> 'task-never-created'};
  const supplied={demonstration_id:demoId,confirmed_sha256:snapshot.confirmed_sha256,snapshot_sha256:sha(snapshot),snapshot};
  await assert.rejects(submitDevelopment(manager,{logical_id:'demo-grant',demonstration:{...supplied,snapshot:{...snapshot,
    assertion_reviews:[{step_index:0,confirmed:true,source:'FROZEN_CASE',locator_event_id:null}]}}}),/DEVELOPMENT_DEMONSTRATION_MISMATCH/);
  await assert.rejects(submitDevelopment({...manager,demonstrations:null},{logical_id:'demo-grant',demonstration:supplied}),/DEVELOPMENT_DEMONSTRATION_INVALID/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'development-authorizations.json'),'utf8')).entries[0].task_id,null);
});
