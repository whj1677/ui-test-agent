import {fixtureModelPhase,fixtureModelReply} from './fixture-model.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Store,effectiveCase} from '../src/store.mjs';
import {DeepSeek} from '../src/deepseek.mjs';
import {Controller} from '../src/controller.mjs';
import {demoCases} from '../src/demo.mjs';
import {validatePlan,validateRepair,planHash,caseHash} from '../src/plans.mjs';
import {semanticHash,uid,targetURL,relativeURL} from '../src/common.mjs';
import {importCases,mechanicalIssues} from '../src/importer.mjs';
const base='http://127.0.0.1:4000',clone=structuredClone;
const code=c=>e=>e.code===c;
async function store(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-test-'));const store=new Store(dir);await store.init();return store;}
test('both domain plans validate against exact case baseline',()=>{const {baseline,plans}=demoCases();plans.forEach((p,i)=>assert.equal(validatePlan(p,baseline.cases[i],base),p));});
for(const [label,change,error]of [
  ['foreign origin',p=>p.entry_path='https://example.com/','OUTSIDE_TARGET_ORIGIN'],
  ['arbitrary script',p=>p.steps[0].actions[0]={op:'evaluate',value:'alert(1)'},'ACTION_NOT_ALLOWED'],
  ['missing original step',p=>p.steps=[],'PLAN_STEP_COUNT_MISMATCH'],
  ['rewritten expected text',p=>p.steps[0].source_expected='anything','PLAN_ORIGINAL_STEP_CHANGED'],
  ['missing assertion',p=>p.steps[0].assertions=[],'ASSERTION_COUNT_INVALID'],
  ['invented oracle',p=>p.steps[0].assertions[0].oracle_quote='unconfirmed','ASSERTION_ORACLE_QUOTE_REQUIRED'],
  ['arbitrary CSS',p=>p.steps[0].actions[0].target={kind:'css',value:'button:nth-child(1)'},'UNSAFE_CSS_LOCATOR'],
  ['wrong case hash',p=>p.case_hash='0'.repeat(64),'PLAN_BASELINE_MISMATCH']
])test('rejects '+label,()=>{const {baseline,plans}=demoCases();change(plans[0]);assert.throws(()=>validatePlan(plans[0],baseline.cases[0],base),code(error));});
test('mutation cannot omit cleanup',()=>{const {baseline,plans}=demoCases();plans[1].cleanup=null;assert.throws(()=>validatePlan(plans[1],baseline.cases[1],base),code('INVALID_SCHEMA'));});
test('visible assertion cannot silently ignore an expected false value',()=>{const {baseline,plans}=demoCases();plans[0].steps[0].assertions[0].check='visible';plans[0].steps[0].assertions[0].expected=false;assert.throws(()=>validatePlan(plans[0],baseline.cases[0],base),code('ASSERTION_BOOL_INVALID'));});
test('repair may patch only the failed action locator, never its input or assertion target',()=>{const {baseline,plans}=demoCases(),p=plans[0],c=baseline.cases[0],a=p.steps[0].actions[0];
  const failure={action_id:a.action_id,code:'LOCATOR_NOT_VISIBLE',phase:'RESOLVE',dispatched:false,current_target:a.target};
  const patch={schema_version:'ui-agent-locator-patch/v1',action_id:a.action_id,old_target_hash:semanticHash(a.target),target:{kind:'label',value:'商品名称',exact:true}};
  const before=clone(p),repaired=validateRepair(patch,p,c,base,failure);assert.deepEqual(repaired,{...a,target:patch.target});assert.deepEqual(p,before);
  assert.throws(()=>validateRepair({...patch,value:'香蕉'},p,c,base,failure),code('INVALID_SCHEMA'));
  const oracle=clone(p);oracle.steps[0].assertions[0].target={kind:'testid',value:'another'};assert.throws(()=>validateRepair(oracle,p,c,base,failure),code('INVALID_SCHEMA'));
});
test('URLs retain SPA routes and reject credentials in query or fragment',()=>{assert.equal(targetURL(base+'/#/tasks?q=test').href,base+'/#/tasks?q=test');assert.throws(()=>targetURL('https://u:p@example.com'));assert.throws(()=>targetURL(base+'?token=secret'));assert.throws(()=>targetURL(base+'/#/tasks?token=secret'));assert.throws(()=>relativeURL('//example.com/',base));});
test('original baseline and confirmations remain distinct; per-task updates serialize',async()=>{const s=await store(),{baseline}=demoCases();const id=await s.create({name:'test',target:base,baseline});const before=await s.baseline(id);
  await Promise.all(Array.from({length:10},(_,i)=>s.update(id,state=>s.event(state,'TEST',{i}))));const state=await s.read(id);assert.equal(state.events.length,11);assert.equal(new Set(state.events.map(e=>e.seq)).size,11);
  const r=state.cases[0];r.confirmations=[{step_id:'S1',action:'confirmed action',expected:'confirmed expected',obligations:[{id:'S1-O1',text:'confirmed expected'}]}];const effective=effectiveCase(before.cases[0],r);assert.equal(effective.steps[0].action,'confirmed action');assert.deepEqual(effective.steps[0].obligations,r.confirmations[0].obligations);assert.deepEqual((await s.baseline(id)).cases[0],before.cases[0]);
});
test('changed baseline and facts are rejected; facts cannot be overwritten',async()=>{const s=await store();const id=await s.create({name:'test',target:base,baseline:demoCases().baseline});const result={id:uid(),status:'TECHNICAL_FAILED',finished_at:new Date().toISOString(),media:[]};const receipt=await s.fact(id,result);await assert.rejects(()=>s.fact(id,result),e=>e.code==='EEXIST');await fs.appendFile(path.join(s.dir(id),'runs',result.id,'facts.json'),' ');await assert.rejects(()=>s.facts(id,receipt),code('EVIDENCE_CHANGED'));await fs.appendFile(path.join(s.dir(id),'baseline.json'),' ');await assert.rejects(()=>s.read(id),code('BASELINE_CHANGED'));});
test('restart marks a running mutation as interrupted and needing recovery',async()=>{const s=await store(),{baseline,plans}=demoCases();const id=await s.create({name:'test',target:base,baseline});await s.update(id,x=>{x.status='RUNNING';x.cases[1].status='RUNNING';x.cases[1].plan=plans[1];});await s.recoverInterrupted();const r=await s.read(id);assert.equal(r.cases[1].status,'INTERRUPTED');assert.equal(r.cases[1].cleanup_required,true);});
test('concurrent progress reads do not replay or drop committed events',async()=>{const s=await store(),{baseline}=demoCases();const id=await s.create({name:'test',target:base,baseline});let writing=true;const reads=(async()=>{while(writing){await s.read(id);await new Promise(r=>setTimeout(r,1));}})();try{for(let i=0;i<50;i++)await s.update(id,x=>s.event(x,'READ_WRITE_RACE',{i}));}finally{writing=false;await reads;}assert.equal((await s.read(id)).events.filter(e=>e.type==='READ_WRITE_RACE').length,50);});
test('mechanical review finds missing oracle without altering case',()=>{const c=demoCases().baseline.cases[0];c.steps[0].expected='';const copy=JSON.stringify(c);assert.equal(mechanicalIssues(c)[0].code,'EXPECTED_MISSING');assert.equal(JSON.stringify(c),copy);});
test('JSON, CSV, and actual Excel import preserve identifiers and steps',async()=>{
  const b=demoCases().baseline;assert.deepEqual(await importCases('cases.json',Buffer.from(JSON.stringify(b))),b);
  const csv='用例编号,用例标题,测试步骤,预期结果\nCAT-1,商品查询,输入苹果并点击查询,结果显示苹果\n';const imported=await importCases('cases.csv',Buffer.from(csv));assert.equal(imported.cases[0].case_id,'CAT-1');assert.ok(imported.cases[0].steps.length);
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-xlsx-'));const file=path.join(tmp,'cases.xlsx');const python=spawnSync('python',['-c',"from openpyxl import Workbook; import sys; w=Workbook(); s=w.active; s.title='UI'; s.append(['用例编号','用例标题','测试步骤','预期结果']); s.append(['X-1','任务查询','点击查询','显示任务列表']); w.save(sys.argv[1])",file],{windowsHide:true,encoding:'utf8'});assert.equal(python.status,0,python.stderr);const x=await importCases('cases.xlsx',await fs.readFile(file),'UI');assert.equal(x.cases[0].case_id,'X-1');
});
const response=(value,extra={})=>new Response(JSON.stringify({model:'fixture-model',usage:{prompt_tokens:4,completion_tokens:3},choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],...extra}),{status:200});
test('DeepSeek adapter sends JSON mode and keeps key out of returned metadata',async()=>{let request;const p=new DeepSeek({key:'fixture-secret',fetchImpl:async(url,options)=>{request={url,...options};return response({connected:true});}});const usage=await p.test();assert.equal(request.headers.Authorization,'Bearer fixture-secret');const payload=JSON.parse(request.body);assert.equal(payload.response_format.type,'json_object');assert.equal(payload.thinking.type,'disabled');assert.equal(usage.response_model,'fixture-model');assert.ok(!JSON.stringify(usage).includes('fixture-secret'));assert.ok(!JSON.stringify(p).includes('fixture-secret'));});
for(const [name,fetchImpl,error] of [
  ['401',async()=>new Response('do not expose secret',{status:401}),'DEEPSEEK_AUTH_FAILED'],
  ['truncated',async()=>response({}, {choices:[{finish_reason:'length',message:{content:'{}'}}]}),'DEEPSEEK_OUTPUT_TRUNCATED'],
  ['empty',async()=>response({}, {choices:[{message:{content:''}}]}),'DEEPSEEK_EMPTY_RESPONSE'],
  ['non-JSON',async()=>response({}, {choices:[{message:{content:'bad'}}]}),'DEEPSEEK_JSON_INVALID']
])test('DeepSeek handles '+name,async()=>{const p=new DeepSeek({key:'fixture-secret',fetchImpl});await assert.rejects(()=>p.test(),code(error));});
test('DeepSeek HTTP retry is bounded to two attempts',async()=>{let calls=0;const p=new DeepSeek({key:'fixture-secret',fetchImpl:async()=>{calls++;return new Response('',{status:429});}});await assert.rejects(()=>p.test(),code('DEEPSEEK_RATE_LIMIT'));assert.equal(calls,2);});
test('bad model plan blocks only that case; unrelated plan continues',async()=>{const s=await store(),{baseline,plans}=demoCases();const id=await s.create({name:'test',target:base,baseline});let n=0;const provider={configured:()=>true,json:async(prompt,input)=>{n++;return {value:fixtureModelPhase(prompt,input)==='plan'&&input.original.case_id===plans[0].case_id?{plan:{wrong:'format'}}:fixtureModelReply(prompt,input,plans),usage:{response_model:'fixture'}};}};const ctrl=new Controller({store:s,provider,browser:{}});await s.update(id,x=>{x.snapshots=[{text:'fixture'}];x.cases.forEach(c=>c.reviewed=true);});await ctrl.launch(id,'plan',baseline.cases.map(c=>c.case_id));await ctrl.active.promise;const st=await s.read(id);assert.equal(st.cases[0].status,'BLOCKED_MAPPING');assert.equal(st.cases[1].status,'PLAN_REVIEW');assert.equal(n,6);});
test('a returned evidence I/O failure is sealed once without model repair or full-case replay',async()=>{
  const s=await store(),{baseline,plans}=demoCases();const id=await s.create({name:'test',target:base,baseline});let modelCalls=0,executeCalls=0;
  const provider={configured:()=>true,json:async()=>{modelCalls++;return {value:{plan:plans[0]},usage:{response_model:'fixture'}};}};
  const browser={active:()=>true,authenticated:true,execute:async(task,c,p,dir,options)=>{
    executeCalls++;assert.equal(typeof options.onRepair,'function');
    return {id:path.basename(dir),case_id:c.case_id,case_hash:caseHash(c),baseline_sha256:task.baseline_sha256,run_scope_id:options.run_scope_id,approved_plan_hash:options.approved_plan_hash,plan_hash:planHash(p),executed_plan:p,status:'TECHNICAL_FAILED',business_status:'NOT_EXECUTED',error:'ENOSPC',dirty:false,cleanup_status:'NOT_REQUIRED',actions:[{action_id:p.steps[0].actions[0].action_id,op:'fill',status:'EXECUTED'}],assertions:[],media:[],finished_at:new Date().toISOString()};
  }};
  const ctrl=new Controller({store:s,provider,browser});await s.update(id,x=>{x.authorization.nonproduction=true;const c=x.cases[0];c.reviewed=true;c.plan=plans[0];c.plan_approved=true;c.approved_hash=planHash(plans[0]);});
  await ctrl.launch(id,'run',[baseline.cases[0].case_id]);await ctrl.active.promise;const st=await s.read(id),record=st.cases[0];
  assert.equal(executeCalls,1);assert.equal(modelCalls,0);assert.equal(record.attempts.length,1);assert.equal(record.repair_count,0);
  const fact=await s.facts(id,record.attempts[0]);assert.equal(fact.error,'ENOSPC');assert.equal(fact.status,'TECHNICAL_FAILED');assert.equal(fact.actions.length,1);
  assert.equal((await fs.readdir(path.join(s.dir(id),'runs'))).length,1);assert.equal((await s.executionProjection(id)).counts.technical_failed,1);
  await assert.rejects(()=>ctrl.launch(id,'run',[baseline.cases[0].case_id]),code('CASE_ALREADY_EXECUTED'));assert.equal(executeCalls,1);assert.equal(modelCalls,0);
});
test('a valid model response arriving after cancellation cannot publish a plan',async()=>{
  const s=await store(),{baseline,plans}=demoCases();const id=await s.create({name:'test',target:base,baseline});let calls=0,ctrl;
  const provider={configured:()=>true,json:async()=>{calls++;ctrl.active.abort.abort();return {value:{plan:plans[0]},usage:{response_model:'fixture'}};}};
  ctrl=new Controller({store:s,provider,browser:{}});await s.update(id,x=>{x.snapshots=[{text:'fixture'}];x.cases[0].reviewed=true;});
  await ctrl.launch(id,'plan',[baseline.cases[0].case_id]);await ctrl.active.promise;const st=await s.read(id);
  assert.equal(calls,1);assert.equal(st.status,'STOPPED');assert.equal(st.cases[0].plan,null);assert.equal(st.cases[0].plan_approved,false);assert.notEqual(st.cases[0].status,'PLAN_REVIEW');
  assert.equal(st.events.filter(e=>e.type==='PLAN_GENERATED').length,0);assert.equal(st.events.filter(e=>e.type==='MODEL_RESPONSE').length,0);
});
test('concurrent launch is rejected while the first launch is still reading its task',async()=>{
  const s=await store(),{baseline}=demoCases();const id=await s.create({name:'test',target:base,baseline});let calls=0;
  const provider={configured:()=>true,json:async()=>{calls++;return {value:{issues:[]},usage:{response_model:'fixture'}};}};
  const ctrl=new Controller({store:s,provider,browser:{}}),read=s.read.bind(s);let first=true,release,entered;
  const hold=new Promise(r=>release=r),arrived=new Promise(r=>entered=r);
  s.read=async(...args)=>{if(first){first=false;entered();await hold;}return read(...args);};
  const launch=ctrl.launch(id,'review',[baseline.cases[0].case_id]);await arrived;
  try{await assert.rejects(()=>ctrl.launch(id,'review',[baseline.cases[0].case_id]),code('JOB_ALREADY_RUNNING'));}finally{release();}
  await launch;await ctrl.active.promise;const st=await s.read(id);assert.equal(calls,1);assert.equal(st.events.filter(e=>e.type==='JOB_STARTED').length,1);assert.equal(st.status,'IDLE');
});
