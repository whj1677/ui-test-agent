import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Controller} from '../src/controller.mjs';
import {Store} from '../src/store.mjs';
import {demoCases} from '../src/demo.mjs';
import {start} from '../src/server.mjs';
import {DeepSeek} from '../src/deepseek.mjs';
import {fixtureModelPhase,fixtureModelReply} from './fixture-model.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('page capture holds the preparation reservation until its commit',async()=>{
  const store=new Store(await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-preparation-')));await store.init();
  const id=await store.create({name:'reservation',target:'http://127.0.0.1:3999',baseline:demoCases().baseline}),gate=deferred(),entered=deferred();
  const browser={active:()=>true,snapshot:async()=>{entered.resolve();await gate.promise;return {url:'http://127.0.0.1:3999',controls:[],text:'fixture',login_page:false};}};
  const ctrl=new Controller({store,browser,provider:{configured:()=>true}}),capture=ctrl.capture(id);await entered.promise;
  await assert.rejects(ctrl.launch(id,'review',['CATALOG-001']),e=>e.code==='JOB_ALREADY_RUNNING');
  gate.resolve();await capture;assert.equal(ctrl.preparing,null);assert.equal((await store.read(id)).snapshots.length,1);
});

test('server close retains instance lock until launch validation has stopped',async()=>{
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-close-validation-'));
  const app=await start({port:0,dataDir,headless:true,provider:new DeepSeek({key:'fixture-no-request'})});
  const id=await app.store.create({name:'close',target:'http://127.0.0.1:3999',baseline:demoCases().baseline});
  const gate=deferred(),entered=deferred(),read=app.store.read.bind(app.store);let first=true;
  app.store.read=async(...args)=>{if(first){first=false;entered.resolve();await gate.promise;}return read(...args);};
  const launching=app.controller.launch(id,'review',['CATALOG-001']).catch(e=>e);
  await entered.promise;const closing=app.close(),contender=new Store(dataDir);await contender.init();
  await assert.rejects(contender.acquireLock(),e=>e.code==='DATA_DIRECTORY_LOCKED');
  gate.resolve();const error=await launching;assert.equal(error.code,'STOPPED');await closing;
  await contender.acquireLock();await contender.releaseLock();assert.equal(app.controller.active,null);
});

test('server close waits for preparation before releasing instance lock',async()=>{
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-close-preparation-'));
  const app=await start({port:0,dataDir,headless:true,provider:new DeepSeek({key:''})});
  const id=await app.store.create({name:'close preparation',target:'http://127.0.0.1:3999',baseline:demoCases().baseline});
  const gate=deferred(),entered=deferred();app.browser.active=()=>true;
  app.browser.snapshot=async()=>{entered.resolve();await gate.promise;return {url:'http://127.0.0.1:3999',controls:[],text:'fixture',login_page:false};};
  const capture=app.controller.capture(id);await entered.promise;const closing=app.close(),contender=new Store(dataDir);await contender.init();
  await assert.rejects(contender.acquireLock(),e=>e.code==='DATA_DIRECTORY_LOCKED');
  gate.resolve();await capture;await closing;await contender.acquireLock();await contender.releaseLock();
});

for(const interruptedPhase of ['plan','plan_audit'])test('server close during '+interruptedPhase+' rejects late output and retains its instance lock until settled',{timeout:10000},async t=>{
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-close-model-stage-')),gate=deferred(),entered=deferred(),calls=[];
  const {baseline,plans}=demoCases();
  const provider={model:'fixture-model',configured:()=>true,json:async(prompt,input)=>{
    const phase=fixtureModelPhase(prompt,input);calls.push(phase);
    if(phase===interruptedPhase){entered.resolve();await gate.promise;}
    return {value:fixtureModelReply(prompt,input,plans),usage:{response_model:'fixture-model'}};
  }};
  const app=await start({port:0,dataDir,headless:true,provider});
  t.after(async()=>{gate.resolve();await app.close();});
  const id=await app.store.create({name:'close during model stage',target:'http://127.0.0.1:3999',baseline});
  await app.store.update(id,s=>{s.snapshots=[{text:'fixture'}];s.cases[0].reviewed=true;});
  await app.controller.launch(id,'plan',[baseline.cases[0].case_id]);const job=app.controller.active;
  await entered.promise;const closing=app.close(),contender=new Store(dataDir);await contender.init();
  try{await assert.rejects(contender.acquireLock(),e=>e.code==='DATA_DIRECTORY_LOCKED');}finally{gate.resolve();}
  await job.finished;await closing;
  const state=await app.store.read(id);assert.equal(state.cases[0].plan,null);assert.equal(state.cases[0].plan_approved,false);assert.equal(state.status,'STOPPED');
  assert.deepEqual(calls,interruptedPhase==='plan'?['input_review','plan']:['input_review','plan','plan_audit']);
  const logs=await app.controller.diagnosticLog(id).read();assert.ok(logs.some(r=>r.type==='MODEL_DECISION'&&r.phase===interruptedPhase&&r.outcome==='CANCELLED'));assert.ok(!state.events.some(e=>e.type==='PLAN_GENERATED'));
  await contender.acquireLock();await contender.releaseLock();assert.equal(app.controller.active,null);
});
