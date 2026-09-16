import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Controller} from '../src/controller.mjs';
import {DeepSeek} from '../src/deepseek.mjs';
import {Store} from '../src/store.mjs';
import {DiagnosticLog} from '../src/telemetry.mjs';
import {demoCases} from '../src/demo.mjs';
import {caseHash,planHash} from '../src/plans.mjs';
import {fixtureModelPhase,fixtureModelReply,fixtureTransportRequest} from './fixture-model.mjs';

const code=expected=>error=>error.code===expected;
const base='http://127.0.0.1:4000';
const key='fixture-private-key-without-required-prefix';
const reply=value=>new Response(JSON.stringify({model:'fixture-model',usage:{prompt_tokens:5,completion_tokens:7},choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}),{status:200});
async function setup(provider,browser={}){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-controller-diagnostic-')),store=new Store(dir);await store.init();
  const {baseline,plans}=demoCases(),id=await store.create({name:'diagnostic fixture',target:base,baseline});
  const controller=new Controller({store,provider,browser});
  await store.update(id,state=>{state.snapshots=[{text:'fixture controls'}];state.cases.forEach(c=>c.reviewed=true);});
  return {dir,store,baseline,plans,id,controller};
}
async function launch(f,kind='plan',ids=[f.baseline.cases[0].case_id]){await f.controller.launch(f.id,kind,ids);const job=f.controller.active;await job.finished;return job;}

test('revalidate a retained bare-plan response without a model call, approval, or rewriting the source',async()=>{
  const f=await setup({configured:()=>false}),cid=f.baseline.cases[0].case_id,raw=structuredClone(f.plans[0]);
  const log=f.controller.diagnosticLog(f.id);await log.append({type:'MODEL_RESPONSE_PARSED',phase:'plan',case_id:cid,request_id:'retained-request',parsed_value:raw});
  await f.controller.revalidatePlan(f.id,cid);const row=(await f.store.read(f.id)).cases[0];
  assert.equal(row.status,'PLAN_REVIEW');assert.equal(row.plan_approved,false);assert.deepEqual(row.plan,raw);assert.equal(row.revalidated_plan.request_id,'retained-request');assert.deepEqual((await log.read())[0].parsed_value,raw);
  await assert.rejects(f.controller.revalidatePlan(f.id,cid),code('PLAN_REVALIDATION_LIMIT'));
  const second=f.baseline.cases[1].case_id,bad={...f.plans[1],case_hash:'wrong-baseline'};await log.append({type:'MODEL_RESPONSE_PARSED',phase:'plan',case_id:second,request_id:'bad-request',parsed_value:bad});
  await assert.rejects(f.controller.revalidatePlan(f.id,second),code('PLAN_BASELINE_MISMATCH'));
});

test('plan revision is bounded, revokes approval and preserves original case and prior candidate',async()=>{
  const f=await setup({configured:()=>true}),cid=f.baseline.cases[0].case_id;
  await f.store.update(f.id,s=>{s.cases[0].plan=f.plans[0];s.cases[0].plan_approved=true;});
  const baselineBefore=await f.store.baseline(f.id);
  await f.controller.requestPlanRevision(f.id,cid,{feedback:'Assert the exact original message, not only visibility.'});
  const row=(await f.store.read(f.id)).cases[0];
  assert.equal(row.plan_approved,false);assert.deepEqual(row.plan,f.plans[0]);assert.deepEqual(await f.store.baseline(f.id),baselineBefore);assert.equal(row.plan_feedback.length,1);
  await assert.rejects(f.controller.requestPlanRevision(f.id,cid,{feedback:'again'}),code('PLAN_REVISION_LIMIT'));
  await f.store.update(f.id,s=>{s.cases[1].attempts.push({id:'existing-attempt'});});
  await assert.rejects(f.controller.requestPlanRevision(f.id,f.baseline.cases[1].case_id,{feedback:'rewrite executed case'}),code('CASE_ALREADY_EXECUTED'));
});

test('legacy tasks expose truthful basic diagnostics without fabricated model history',async()=>{
  const f=await setup({configured:()=>true}),out=await f.controller.diagnostics(f.id);
  assert.equal(out.schema_version,'ui-agent-diagnostics/v1');assert.equal(out.logging_available,false);assert.equal(out.records.length,0);assert.ok(out.timeline.length>0);assert.match(out.scope,/无法补录/);
  assert.equal(out.summary.requests,0);assert.equal(out.summary.approved_plans,0);assert.equal(out.summary.execution_receipts,0);assert.equal(out.summary.token_usage.prompt_tokens,null);
});
test('accepted plan links request, transport and decision, with no implicit plan approval',async()=>{
  let f;const provider=new DeepSeek({key,fetchImpl:async(url,options)=>{const {prompt,input}=fixtureTransportRequest(options);return reply(fixtureModelReply(prompt,input,f.plans));}});f=await setup(provider);await launch(f);
  const out=await f.controller.diagnostics(f.id),requests=out.records.filter(r=>r.type==='MODEL_REQUEST'),request=requests.find(r=>r.phase==='plan'),decision=out.records.find(r=>r.type==='MODEL_DECISION'&&r.phase==='plan');
  assert.equal(out.logging_available,true);assert.equal(out.summary.requests,3);assert.equal(out.summary.transport_attempts,3);assert.equal(out.summary.accepted,3);assert.equal(out.summary.approved_plans,0);assert.equal(out.summary.execution_receipts,0);
  assert.deepEqual(requests.map(r=>r.phase),['input_review','plan','plan_audit']);assert.equal(new Set(requests.map(r=>r.request_id)).size,3);
  assert.equal(decision.request_id,request.request_id);assert.equal(decision.job_id,request.job_id);assert.equal(decision.case_id,f.baseline.cases[0].case_id);assert.equal(decision.phase,'plan');assert.equal(decision.code,'PLAN_STRUCTURE_VALID');assert.ok(decision.duration_ms>=0);
  assert.equal(request.requested_model,provider.model);assert.equal(out.metadata.timeline_authority,'MUTABLE_PROGRESS_PROJECTION');assert.equal(out.execution_evidence.facts_url,'/api/tasks/'+f.id+'/facts');
  assert.match(request.prompt_hash,/^[a-f0-9]{64}$/);assert.match(request.input_hash,/^[a-f0-9]{64}$/);assert.match(request.sent_input_hash,/^[a-f0-9]{64}$/);assert.ok(request.prompt);assert.ok(request.input.original);assert.ok(out.records.every(r=>r.at));
  assert.equal(out.summary.token_usage.prompt_tokens,15);assert.equal(out.summary.token_usage.completion_tokens,21);assert.equal(out.summary.token_usage.unknown_calls,0);
  const state=await f.store.read(f.id);assert.equal(state.cases[0].status,'PLAN_REVIEW');assert.equal(state.cases[0].plan_approved,false);
});
test('invalid plan is rejected with the validator code and unrelated planning continues',async()=>{
  let calls=0,f;const provider={configured:()=>true,json:async(prompt,input)=>{calls++;return {value:fixtureModelPhase(prompt,input)==='plan'&&input.original.case_id===f.baseline.cases[0].case_id?{plan:{wrong:'shape'}}:fixtureModelReply(prompt,input,f.plans),usage:{response_model:'fixture'}};}};f=await setup(provider);await launch(f,'plan',f.baseline.cases.map(c=>c.case_id));
  const out=await f.controller.diagnostics(f.id),decisions=out.records.filter(r=>r.type==='MODEL_DECISION');
  const requests=out.records.filter(r=>r.type==='MODEL_REQUEST'),firstId=f.baseline.cases[0].case_id,secondId=f.baseline.cases[1].case_id;
  assert.equal(requests.filter(r=>r.case_id===firstId&&r.phase==='plan').length,2,'identical invalid candidate stops at the first repeated response');
  assert.ok(decisions.some(d=>d.phase==='plan'&&d.case_id===firstId&&d.code==='INVALID_SCHEMA'&&d.outcome==='REJECTED'));
  assert.equal(requests.filter(r=>r.case_id===firstId&&r.phase==='plan_audit').length,0);
  assert.deepEqual(requests.filter(r=>r.case_id===secondId).map(r=>r.phase),['input_review','plan','plan_audit']);
  assert.equal(out.summary.requests,calls);assert.equal(out.summary.token_usage.unknown_calls,calls);assert.equal(decisions.length,calls);
  const state=await f.store.read(f.id);assert.equal(state.cases[0].status,'BLOCKED_MAPPING');assert.equal(state.cases[1].status,'PLAN_REVIEW');assert.equal(state.cases[1].plan_approved,false);
});
test('model blocked reason and every persisted request/response/decision mask configured key echoes',async()=>{
  let f;const provider=new DeepSeek({key,fetchImpl:async(url,options)=>{const {prompt,input}=fixtureTransportRequest(options);return reply(fixtureModelPhase(prompt,input)==='plan'?{blocked:true,reason:'Unable to map '+key}:fixtureModelReply(prompt,input,f.plans));}});f=await setup(provider);
  await f.store.update(f.id,s=>{s.snapshots=[{text:'page echoed '+key,password:'private password value',cookie:'sid=private'}];});await launch(f);
  const out=await f.controller.diagnostics(f.id);assert.equal(out.summary.blocked,2);assert.equal(out.summary.rejected,0);assert.equal(out.summary.accepted,1);assert.ok(!JSON.stringify(out).includes(key));
  assert.deepEqual(out.records.filter(r=>r.type==='MODEL_REQUEST').map(r=>r.phase),['input_review','plan','blocked_audit']);
  const folder=path.join(f.store.dir(f.id),'diagnostics');for(const file of await fs.readdir(folder)){const bytes=await fs.readFile(path.join(folder,file),'utf8');assert.ok(!bytes.includes(key));assert.ok(!bytes.includes('private password value'));assert.ok(!bytes.includes('sid=private'));}
  const blocked=out.records.filter(r=>r.type==='MODEL_DECISION'&&r.outcome==='BLOCKED');assert.equal(blocked.length,2);assert.ok(blocked.every(r=>r.reason.includes('[REDACTED]')));
  assert.equal((await f.store.read(f.id)).cases[0].plan,null);
});
test('cancelled late model output is diagnostic only and cannot publish a plan',async()=>{
  let f,calls=0;const provider={configured:()=>true,json:async(prompt,input)=>{calls++;if(fixtureModelPhase(prompt,input)==='plan')f.controller.active.abort.abort();return {value:fixtureModelReply(prompt,input,f.plans),usage:{response_model:'fixture'}};}};f=await setup(provider);await launch(f);
  const out=await f.controller.diagnostics(f.id),state=await f.store.read(f.id);assert.equal(calls,2);assert.equal(out.summary.cancelled,1);assert.equal(out.summary.accepted,1);assert.equal(state.status,'STOPPED');assert.equal(state.cases[0].plan,null);
  assert.ok(out.records.some(r=>r.type==='MODEL_PROVIDER_RESULT'&&r.phase==='plan'));assert.equal(out.records.find(r=>r.type==='MODEL_DECISION'&&r.phase==='plan').code,'STOPPED');assert.ok(!out.records.some(r=>r.type==='MODEL_REQUEST'&&r.phase==='plan_audit'));
});
test('provider failure logs rejection and halts the remaining batch',async()=>{
  let calls=0;const provider=new DeepSeek({key,fetchImpl:async()=>{calls++;return new Response('bad credential '+key,{status:401});}}),f=await setup(provider);await launch(f,'plan',f.baseline.cases.map(c=>c.case_id));
  const out=await f.controller.diagnostics(f.id);assert.equal(calls,1);assert.equal(out.summary.rejected,1);assert.equal(out.records.find(r=>r.type==='MODEL_DECISION').code,'DEEPSEEK_AUTH_FAILED');assert.ok(!JSON.stringify(out).includes(key));assert.equal((await f.store.read(f.id)).status,'NEEDS_ATTENTION');
});
test('diagnostic write failure before dispatch performs no model call and stops batch',async()=>{
  let calls=0;const f=await setup({configured:()=>true,json:async()=>{calls++;return {value:{issues:[]}};}});
  f.controller.diagnosticLogs.set(f.id,{append:async()=>{throw Object.assign(new Error('disk full'),{code:'ENOSPC'});}});
  const job=await launch(f,'review',f.baseline.cases.map(c=>c.case_id));assert.equal(calls,0);assert.equal(job.diagnostic_failed,true);const state=await f.store.read(f.id);assert.equal(state.status,'NEEDS_ATTENTION');assert.equal(state.events.filter(e=>e.type==='CASE_STARTED').length,1);assert.equal(state.events.find(e=>e.type==='JOB_FAILED').code,'DIAGNOSTIC_WRITE_FAILED');
});
test('diagnostic read polling and a concurrent launch do not duplicate model requests or lose records',async()=>{
  let release,arrive,calls=0;const hold=new Promise(r=>release=r),entered=new Promise(r=>arrive=r);
  const provider=new DeepSeek({key,fetchImpl:async()=>{calls++;arrive();await hold;return reply({issues:[]});}}),f=await setup(provider);
  await f.controller.launch(f.id,'review',[f.baseline.cases[0].case_id]);const job=f.controller.active;await entered;
  await assert.rejects(()=>f.controller.launch(f.id,'review',[f.baseline.cases[1].case_id]),code('JOB_ALREADY_RUNNING'));
  const reads=Array.from({length:15},()=>f.controller.diagnostics(f.id));release();await Promise.all(reads);await job.finished;
  const out=await f.controller.diagnostics(f.id);assert.equal(calls,1);assert.equal(out.summary.requests,1);assert.equal(out.summary.accepted,1);assert.equal(out.summary.undecided,0);assert.equal(out.records.length,6);
});
test('a repair logging failure swallowed by the browser still seals facts and stops before the next case',async()=>{
  let f,calls=0,executions=0;const provider={configured:()=>true,json:async()=>{calls++;return {value:{blocked:true,reason:'fixture blocked'},usage:{response_model:'fixture'}};}};
  const browser={active:()=>true,authenticated:true,execute:async(task,c,p,dir,options)=>{
    executions++;const a=p.steps[0].actions[0];let error;try{await options.onRepair({action_id:a.action_id,code:'LOCATOR_NOT_VISIBLE',phase:'RESOLVE',dispatched:false,current_target:a.target});}catch(e){error=e.code;}
    return {id:path.basename(dir),case_id:c.case_id,case_hash:caseHash(c),baseline_sha256:task.baseline_sha256,run_scope_id:options.run_scope_id,approved_plan_hash:options.approved_plan_hash,plan_hash:planHash(p),executed_plan:p,status:'TECHNICAL_FAILED',business_status:'NOT_EXECUTED',error,dirty:false,cleanup_status:'NOT_REQUIRED',actions:[],assertions:[],media:[],finished_at:new Date().toISOString()};
  }};f=await setup(provider,browser);
  await f.store.update(f.id,s=>{s.authorization.nonproduction=true;s.authorization.writes=true;s.cases.forEach((r,i)=>{r.plan=f.plans[i];r.plan_approved=true;r.approved_hash=planHash(r.plan);r.status='READY';});});
  const log=new DiagnosticLog(path.join(f.store.dir(f.id),'diagnostics'));f.controller.diagnosticLogs.set(f.id,{append:async record=>{if(record.type==='MODEL_PROVIDER_RESULT')throw Object.assign(new Error('disk full'),{code:'ENOSPC'});return log.append(record);},read:()=>log.read()});
  await launch(f,'run',f.baseline.cases.map(c=>c.case_id));assert.equal(calls,1);assert.equal(executions,1);
  const state=await f.store.read(f.id);assert.equal(state.status,'NEEDS_ATTENTION');assert.equal(state.cases[0].attempts.length,1);assert.equal(state.cases[1].attempts.length,0);const fact=await f.store.facts(f.id,state.cases[0].attempts[0]);assert.equal(fact.error,'DIAGNOSTIC_WRITE_FAILED');assert.deepEqual(fact.executed_plan,f.plans[0]);
});
