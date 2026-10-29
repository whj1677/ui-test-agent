import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {supervise} from '../server/owned-supervisor.mjs';
import {createServiceRestart} from '../server/service-restart.mjs';
import {createWorkbenchServer} from '../server/app.mjs';
import {restartAndWait} from '../web-v2/service-restart.js';

async function supervisorScenario({changedData=false,ordinaryDrift=false}={}) {
  const children=[],reports=[],data=path.resolve('synthetic-data');let activations=0;
  const dataHash=createHash('sha256').update(data).digest('hex');
  const spawn=(_file,_args,options)=>{
    const index=children.length,child=new EventEmitter();child.launchEnv=options.env;children.push(child);
    child.send=message=>{
      if(message.type==='supervisor-hello'){
        assert.equal(message.model_activation,true);
        queueMicrotask(()=>child.emit('message',{type:'managed-ready',service_instance_id:'s'+index,data_root_sha256:dataHash,configuration_sha256:'config'+(index>1&&ordinaryDrift?2:Math.min(index,1))}));
        if(index===0||index===1&&ordinaryDrift)setTimeout(()=>child.emit('message',{type:'restart-request',request_id:'r'+index,service_instance_id:'s'+index,...(index===0?{mode:'enable-model'}:{})}),15);
        else setTimeout(()=>child.emit('exit',0),30);
      }
      if(message.type==='restart-ack'&&message.accepted)queueMicrotask(()=>{child.emit('message',{type:'restart-drained',closed:true});child.emit('exit',0);});
      if(message.type==='shutdown')queueMicrotask(()=>child.emit('exit',0));
    };
    queueMicrotask(()=>child.emit('message',{type:'supervisor-awaiting'}));return child;
  };
  const result=await supervise({spawn,env:{mode:'off'},childPath:'synthetic',startupMs:500,shutdownMs:100,transitionMs:500,
    activateModel:async()=>{activations++;return {data:changedData?path.resolve('other-data'):data,env:{mode:'enabled'}};},
    health:async()=>{const c=children.at(-1);if(c.exited)throw Object.assign(Error('closed'),{code:'ECONNREFUSED'});return {status:'ready',accepting:true,service_identity:{service_instance_id:'s'+(children.length-1),data_root_sha256:dataHash,configuration_sha256:'config1'}};},
    report:m=>reports.push(m)});
  return {result,children,reports,activations};
}
test('explicit web activation changes model configuration once and keeps its data root',async()=>{
  const f=await supervisorScenario();assert.equal(f.result,0);assert.equal(f.activations,1);assert.equal(f.children.length,2);assert.equal(f.children[1].launchEnv.mode,'enabled');assert.equal(f.reports[0].type,'restart_complete');
});
test('activation cannot change the workspace and does not relax subsequent ordinary restart checks',async()=>{
  const wrongData=await supervisorScenario({changedData:true});assert.equal(wrongData.result,1);assert.equal(wrongData.children.length,1);assert.equal(wrongData.reports.at(-1).error,'MODEL_ACTIVATION_DATA_CHANGED');
  const drift=await supervisorScenario({ordinaryDrift:true});assert.equal(drift.result,1);assert.equal(drift.children.length,3);assert.equal(drift.reports.at(-1).error,'SERVICE_CONFIGURATION_CHANGED_ON_RESTART');assert.ok(drift.children.every(c=>c.exited));
});
async function activate({origin='http://127.0.0.1:4322',configured=true,capable=true,busy=false,extra=false}={}){
  const p=new EventEmitter(),messages=[],state={accepting:true,inFlightMutations:0},identity={service_instance_id:'current',data_root_sha256:'data',configuration_sha256:'config'};
  p.send=m=>{messages.push(m);if(m.type==='restart-request')queueMicrotask(()=>p.emit('message',{type:'restart-ack',request_id:m.request_id,accepted:true}));};p.disconnect=()=>{};
  const restart=createServiceRestart({processRef:p,serviceState:state,serviceIdentity:identity,managers:{task:{starting:busy}},inFlightMutations:()=>state.inFlightMutations,onDrain:async()=>({closed:true})});
  restart.markReady();p.emit('message',{type:'supervisor-hello',model_activation:capable});
  const server=createWorkbenchServer({serviceState:state,serviceRestart:restart,modelSettings:{status:async()=>({configured})}});
  const req=Readable.from([Buffer.from(JSON.stringify({service_instance_id:'current',...(extra?{path:'foreign'}:{})}))]);Object.assign(req,{method:'POST',url:'/api/model-settings/activate',headers:{host:'127.0.0.1:4322',origin,'content-type':'application/json'}});
  const response=await new Promise(resolve=>{const res=new EventEmitter();res.writeHead=s=>{res.status=s;};res.end=b=>{res.emit('finish');resolve({status:res.status,body:JSON.parse(String(b))});};server.emit('request',req,res);});return {...response,messages,state};
}
test('HTTP activation rejects foreign origins, absent keys, custom paths, busy tasks and unmanaged activation',async()=>{
  for(const [options,status] of [[{origin:'https://foreign.invalid'},403],[{configured:false},400],[{capable:false},503],[{busy:true},409],[{extra:true},400]]){
    const r=await activate(options);assert.equal(r.status,status);assert.equal(r.state.accepting,true);assert.equal(r.messages.filter(m=>m.type==='restart-request').length,0);
  }
  const ok=await activate();assert.equal(ok.status,202);assert.equal(ok.state.accepting,false);assert.equal(ok.messages.find(m=>m.type==='restart-request').mode,'enable-model');
});
test('activation polling accepts an enabled new configuration only on the same data root',async()=>{
  let time=0,calls=0;const previous={service_instance_id:'old',data_root_sha256:'data',configuration_sha256:'off'};
  const after=await restartAndWait({previous,modelActivation:true,postRestart:async()=>{},getHealth:async()=>({status:'ready',accepting:true,case_assistant:{available:++calls>=3},service_identity:{service_instance_id:'new',data_root_sha256:calls===1?'other':'data',configuration_sha256:'enabled'}}),now:()=>time,sleep:async ms=>{time+=ms;},intervalMs:1,timeoutMs:20});
  assert.equal(calls,3);assert.equal(after.service_identity.configuration_sha256,'enabled');
});
