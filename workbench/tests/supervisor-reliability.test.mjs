import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkbenchServer } from '../server/app.mjs';
import { createServiceShutdown } from '../server/service-shutdown.mjs';
import { sourceFingerprint,createServiceIdentity } from '../server/service-identity.mjs';
import { WorkbenchStore } from '../server/store.mjs';
import { WorkbenchRunManager } from '../server/executor.mjs';
import { renderReport } from '../server/report-snapshots.mjs';

async function request(options,url,method='GET',body={}) {
  const server=createWorkbenchServer(options); // Handler only; never listen.
  const req=Readable.from([JSON.stringify(body)]);
  Object.assign(req,{url,method,headers:{host:'127.0.0.1:4322',origin:'http://127.0.0.1:4322','content-type':'application/json'}});
  return new Promise(resolve=>server.emit('request',req,{writeHead(status,headers){this.status=status;this.headers=headers;},end(bytes){resolve({status:this.status,body:JSON.parse(String(bytes))});}}));
}
async function temp(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-supervisor-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}

test('health remains inspectable after storage read failure and rejects new writes',async()=>{
  const m={diagnostics(){return{storage_status:this.storageFault?'FAILED':'READY'};},reportStorageFault(e){this.storageFault={code:e.code};}};
  const options={buildManager:m,buildStore:{getBudget:async()=>{throw Object.assign(Error('private path'),{code:'EIO'});}}};
  const h=await request(options,'/api/health');assert.equal(h.status,200);assert.equal(h.body.status,'degraded');assert.equal(h.body.accepting,false);
  assert.equal((await request(options,'/api/runs','POST')).status,503);
});

test('generation ownership blocks new work but allows owned candidate cancellation',async()=>{
  let stopped=0;const m={generationOwner:'generation',stopCandidateTrial:async()=>{stopped++;return{execution_status:'CANCELLED'};}};
  assert.equal((await request({buildManager:m},'/api/candidate-trials','POST')).status,409);
  assert.equal((await request({buildManager:m},'/api/candidate-trials/trial-12345678/stop','POST')).status,202);
  assert.equal(stopped,1);
});

test('preparing build prevents approved run entry before active is assigned',async()=>{
  const result=await request({buildManager:{starting:true},manager:{start:()=>{throw Error('must not execute');}}},'/api/runs','POST',{asset_id:'a',environment:'normal'});
  assert.equal(result.status,409);
});

test('shutdown refuses admission first, stops both executors, drains and closes auth once',async()=>{
  const events=[];const state={accepting:true};
  const run={active:{runId:'r'},async stop(){assert.equal(state.accepting,false);events.push('run-stop');this.active=null;},async settle(){events.push('run-settled');}};
  const build={active:{taskId:'b'},async stop(){events.push('build-stop');this.active=null;},async settle(){events.push('build-settled');}};
  const close=createServiceShutdown({state,server:{close(done){events.push('server-close');done();}},runManager:run,buildManager:build,authSessions:{async close(){events.push('auth-close');}}});
  const a=close(),b=close();assert.equal(a,b);await a;
  assert.deepEqual(events,['server-close','build-stop','run-stop','build-settled','run-settled','auth-close']);assert.equal(state.closed,true);
  assert.equal((await request({serviceState:state},'/api/runs','POST')).status,503);
});

test('service identity changes with source and new records retain captured identity',async t=>{
  const root=await temp(t);
  for(const dir of ['workbench/server','workbench/web-v2','harness-probe/src'])await fs.mkdir(path.join(root,dir),{recursive:true});
  for(const name of ['package.json','package-lock.json','workbench/package.json','workbench/package-lock.json','harness-probe/package.json','harness-probe/package-lock.json'])await fs.writeFile(path.join(root,name),'{}');
  const file=path.join(root,'workbench/server/example.mjs');await fs.writeFile(file,'one');
  const identity=await createServiceIdentity({repoRoot:root,localRoot:root,instanceId:'test',configuration:{mode:'test'}});
  const store=new WorkbenchStore(path.join(root,'data'));await store.init();store.serviceIdentity=identity;
  const run=await store.createRun({run_id:'run-supervisor-12345678'});await fs.writeFile(file,'two');
  assert.notEqual((await sourceFingerprint(root)).source_sha256,identity.source_sha256);
  assert.deepEqual((await store.getRun(run.run_id)).service_identity,identity);
});

test('approved executor keeps ownership through failed finalization and rejects the completion',async t=>{
  const root=await temp(t),child=new EventEmitter();
  const m=new WorkbenchRunManager({store:{getRun:async()=>{throw Object.assign(Error('write unavailable'),{code:'EIO'});}},paths:{}});
  m.active={runId:'run-supervisor-error',child};
  const promise=m.finishOnChild('run-supervisor-error',child,{stdout:[],stderr:[],consoleFile:path.join(root,'console.log'),source:path.join(root,'missing'),runtimeScript:path.join(root,'missing'),runtimeRoot:path.join(root,'runtime')});
  child.emit('exit',1,null);await assert.rejects(promise,/write unavailable/);assert.equal(m.active,null);
});

test('approved executor start guard includes peer preparation and shutdown',async()=>{
  const m=new WorkbenchRunManager({store:{},paths:{},otherActive:()=>true});
  await assert.rejects(m.start('a','b'),/WORKBENCH_BUSY/);m.shutdownRequested=true;
  await assert.rejects(m.start('a','b'),/WORKBENCH_SHUTTING_DOWN/);
});

test('offline report carries the captured execution identity and escaped fidelity materials',()=>{
  const html=renderReport({project:{name:'report'},scope:'run',report_id:'r',run_id:'x',counts:{},
    report_service_identity:{source_sha256:'report-source'},entries:[{steps:[],media:[],service_identity:{source_sha256:'run-source'},
      fidelity_review:{steps:[{action:'<script>unsafe</script>'}]}}]});
  assert.match(html,/report-source/);assert.match(html,/run-source/);
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(!html.includes('<script>unsafe</script>'));
});

test('failed STOPPING persistence still cancels owned child and latches fault',async()=>{
  let killed=0;const m=new WorkbenchRunManager({paths:{},store:{updateRun:async()=>{throw Object.assign(Error('disk full'),{code:'ENOSPC'});}},killTree:async pid=>{assert.equal(pid,999);killed++;}});
  m.active={runId:'run-stop-fault',child:{pid:999},phase:'EXECUTING'};
  await assert.rejects(m.stop('run-stop-fault'),/disk full/);assert.equal(killed,1);assert.equal(m.storageFault.code,'ENOSPC');
});

test('shutdown timeout is bounded, closes auth and never reports drained success',async()=>{
  const state={accepting:true};let closedAuth=false;
  const stop=createServiceShutdown({state,drainMs:30,server:{close(done){done();}},runManager:{starting:true,settle:()=>new Promise(()=>{})},authSessions:{close:async()=>{closedAuth=true;}}});
  const result=await stop();assert.equal(result.closed,false);assert.equal(state.shutdown_incomplete,true);assert.equal(closedAuth,true);
});
