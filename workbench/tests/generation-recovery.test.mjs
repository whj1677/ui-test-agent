import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptOperations, generationFailureReason, failedGenerationCandidate } from '../server/script-operations.mjs';
import { freezeSkill, skillIdentity } from '../server/skills/loader.mjs';
import { assessHarnessRun, eventMetadata } from '../../harness-probe/src/harness-runner.mjs';
import { BatchManager } from '../server/batches.mjs';

test('provider failure keeps a bounded code, without untrusted text or credentials', () => {
  const event={type:'status',phase:'turn_end',reason:{kind:'error',error:{code:'TRANSPORT',message:'secret=do-not-save',cause:{url:'private'}}}};
  const result=assessHarnessRun({processResult:{exitCode:1,termination:null},events:[event],candidateExists:true});
  assert.equal(result.completed,false);
  assert.deepEqual(result.provider_error,{code:'TRANSPORT'});
  assert.deepEqual(eventMetadata(event).provider_error,{code:'TRANSPORT'});
  assert.doesNotMatch(JSON.stringify(result),/do-not-save|private/);
  assert.equal(eventMetadata({...event,reason:{kind:'error',error:{code:'secret=unknown'}}}).provider_error,undefined);
});

test('failed candidate can be generated again, while validated and approved versions remain protected', () => {
  const failed={technical_status:'INCOMPLETE',human_review_status:'NOT_READY',selection:{source_task_id:'old'}};
  assert.equal(failedGenerationCandidate(failed),true);
  for(const human_review_status of ['APPROVED','WAITING_REVIEW','REJECTED']) assert.equal(failedGenerationCandidate({...failed,human_review_status}),false);
  assert.equal(failedGenerationCandidate({...failed,technical_status:'TECHNICAL_VALIDATION_PASSED'}),false);
  assert.equal(failedGenerationCandidate({selection:{source_task_id:'legacy'}}),false,'unknown legacy records fail closed');
});

test('old failed review exposes its actual diagnostic without changing stored task', () => {
  const task={development:{quality_reviews:[{review:{error_code:'MODEL_REQUEST_FAILED',model_diagnostic:{error_code:'DEEPSEEK_JSON_INVALID'}}}]}};
  const before=JSON.stringify(task);
  assert.equal(generationFailureReason(task),'DEEPSEEK_JSON_INVALID');
  assert.equal(JSON.stringify(task),before);
  assert.equal(generationFailureReason({...task,error:{code:'CANDIDATE_NEEDS_ANALYSIS'}}),'DEEPSEEK_JSON_INVALID');
  assert.equal(generationFailureReason({...task,error:{code:'AUTH_SESSION_BLOCKED'}}),'AUTH_SESSION_BLOCKED','real terminal errors keep priority');
});

async function executeWith(reason) {
  const starts=[];const saved=[];
  const manager={assertStorageWritable(){},completions:new Map(),store:{getTask:async id=>({task_id:id,task_status:'CANDIDATE_VALIDATION_FAILED',error:{code:reason}})},
    submitDevelopment:async request=>{const id='task-'+starts.length;starts.push(request);return{task_id:id};}};
  const ops=new ScriptOperations({root:'unused',buildManager:manager});
  ops.active={cancelled:false};ops.save=async v=>{saved.push(structuredClone(v));return v;};
  const skill=await freezeSkill('off','ui');
  ops.preflight=async()=>({skill:skillIdentity(skill),items:[{reason:null}]});
  const v={mode:'generate',project_id:'p',request_id:'test-request',skill_snapshot:skill,items:[1,2,3].map(n=>({case_id:'case-'+n,state:'QUEUED',input:{},logical_id:'g'+n}))};
  await ops.execute(v);return{v,starts,saved};
}
test('exhausted provider transport stops the batch and preserves all unstarted cases as NOT_RUN', async()=>{
  const {v,starts,saved}=await executeWith('HARNESS_MODEL_TRANSPORT_FAILED');
  assert.equal(starts.length,1);
  assert.equal(v.state,'INTERRUPTED');assert.equal(v.error,'MODEL_PROVIDER_UNAVAILABLE');
  assert.deepEqual(v.items.map(i=>i.state),['CANDIDATE_VALIDATION_FAILED','NOT_RUN','NOT_RUN']);
  assert.equal(v.items[1].reason,'MODEL_PROVIDER_UNAVAILABLE');assert.equal(v.items[1].task_id,undefined);
  assert.equal(saved.at(-1).items.length,3);
});
test('case-specific validation failure does not stop unrelated cases', async()=>{
  const {v,starts}=await executeWith('CANDIDATE_BUSINESS_DIFFERENCE');
  assert.equal(starts.length,3);assert.equal(v.state,'FINISHED');
});

test('ordinary run preparation excludes failed history; diagnostic selection and validated versions remain available', async()=>{
  const failed={applies_to_selected_version:true,human_review_status:'NOT_READY',technical_status:'INCOMPLETE',reason:'TRIAL_NOT_AUTHORIZED',selection:{case_id:'case',case_version:1,source_task_id:'old'}};
  let candidates=[failed];
  const manager={caseAutomation:async()=>({candidates}),candidateTrialEnvironments:[],requirementReviews:[]};
  const b=new BatchManager({root:'unused',buildManager:manager,caseStore:{getProject:async()=>({revision:1,cases:[{case_id:'case',current_version:1,versions:[{version:1,content:{external_id:'UI-1',case_type:'UI'}}]}]})}});
  const input={project_id:'p',scope:'single',case_ids:['case']};
  assert.equal((await b.preview(input,{persist:false})).items[0].reason,'SCRIPT_GENERATION_FAILED');
  assert.equal((await b.preview({...input,mode:'diagnostic'},{persist:false})).items[0].reason,'TRIAL_NOT_AUTHORIZED');
  candidates.push({...failed,human_review_status:'WAITING_REVIEW',technical_status:'TECHNICAL_VALIDATION_PASSED',reason:null,selection:{...failed.selection,source_task_id:'new'}});
  const ready=(await b.preview(input,{persist:false})).items[0];
  assert.equal(ready.state,'QUEUED');assert.equal(ready.selection.source_task_id,'new');
  assert.equal((await b.preview({...input,selections:[failed.selection]},{persist:false})).items[0].reason,'SCRIPT_GENERATION_FAILED');
  candidates.push({...candidates[1],reason:'TRIAL_NOT_AUTHORIZED',selection:{...failed.selection,source_task_id:'unreviewed'}});
  assert.equal((await b.preview(input,{persist:false})).items[0].selection.source_task_id,'new','one runnable version is not blocked by an unapproved old candidate');
  candidates.push({...candidates[1],selection:{...failed.selection,source_task_id:'also-runnable'}});
  assert.equal((await b.preview(input,{persist:false})).items[0].reason,'SCRIPT_SELECTION_REQUIRED','two runnable versions still need an explicit selection');
});
