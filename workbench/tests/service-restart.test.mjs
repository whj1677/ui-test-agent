import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createServiceRestart} from '../server/service-restart.mjs';
import {createWorkbenchServer} from '../server/app.mjs';
import {supervise} from '../server/owned-supervisor.mjs';

function fixture(overrides={}) {
  const parent=new EventEmitter();
  const messages=[];
  parent.send=message=>{messages.push(message);if(message.type==='restart-request'&&!overrides.dropAck)queueMicrotask(()=>parent.emit('message',{type:'restart-ack',request_id:message.request_id,accepted:true}));};
  parent.disconnect=()=>messages.push({type:'disconnect'});
  const state={accepting:true,inFlightMutations:0};
  const identity={service_instance_id:'service-current',data_root_sha256:'data',configuration_sha256:'config'};
  let drained=0;
  const restart=createServiceRestart({processRef:parent,serviceState:state,serviceIdentity:identity,
    managers:overrides.managers||{},inFlightMutations:()=>state.inFlightMutations,timeoutMs:overrides.timeoutMs||3000,
    onDrain:async()=>{drained++;return {closed:true};}});
  return {parent,messages,state,identity,restart,drained:()=>drained};
}

async function request(options,body,headers={}) {
  const server=createWorkbenchServer(options);
  const input=Readable.from([Buffer.from(JSON.stringify(body))]);
  Object.assign(input,{url:'/api/service/restart',method:'POST',headers:{host:'127.0.0.1:4322',origin:'http://127.0.0.1:4322','content-type':'application/json',...headers}});
  return await new Promise(resolve=>{
    const output=new EventEmitter();
    output.writeHead=status=>{output.status=status;};
    output.end=bytes=>{const result={status:output.status,body:JSON.parse(String(bytes))};output.emit('finish');resolve(result);};
    server.emit('request',input,output);
  });
}

test('unmanaged, stale, busy and foreign-origin restart requests leave admission open',async()=>{
  const f=fixture({managers:{build:{starting:true}}});
  const options={serviceState:f.state,serviceIdentity:f.identity,serviceRestart:f.restart};
  assert.equal((await request(options,{service_instance_id:'service-current'})).status,503);
  f.restart.markReady();f.parent.emit('message',{type:'supervisor-hello'});
  assert.equal((await request(options,{service_instance_id:'service-old'})).status,409);
  assert.equal((await request(options,{service_instance_id:'service-current'})).status,409);
  assert.equal((await request(options,{service_instance_id:'service-current'},{origin:'http://attacker.test'})).status,403);
  assert.equal(f.state.accepting,true);
  assert.equal(f.messages.filter(message=>message.type==='restart-request').length,0);
});

test('accepted restart closes admission before response and drains after response finishes',async()=>{
  const f=fixture();f.restart.markReady();f.parent.emit('message',{type:'supervisor-hello'});
  const result=await request({serviceState:f.state,serviceIdentity:f.identity,serviceRestart:f.restart},{service_instance_id:'service-current'});
  assert.deepEqual(result,{status:202,body:{status:'restart_scheduled',service_instance_id:'service-current'}});
  assert.equal(f.state.accepting,false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.drained(),1);
  assert.equal(f.messages.find(message=>message.type==='restart-drained')?.closed,true);
  assert.equal((await request({serviceState:f.state,serviceIdentity:f.identity,serviceRestart:f.restart},{service_instance_id:'service-current'})).status,503);
});

test('overlapping admitted mutation prevents restart before closing admission',async()=>{
  const f=fixture();f.restart.markReady();f.parent.emit('message',{type:'supervisor-hello'});
  f.state.inFlightMutations=1;
  const result=await request({serviceState:f.state,serviceIdentity:f.identity,serviceRestart:f.restart},{service_instance_id:'service-current'});
  assert.equal(result.status,409);
  assert.equal(f.state.accepting,true);
});

test('health availability uses the same busy predicate as restart admission',async()=>{
  const build={generationOwner:'model'};
  const f=fixture({managers:{build}});f.restart.markReady();f.parent.emit('message',{type:'supervisor-hello'});
  assert.equal(f.restart.available(),false);
  build.generationOwner=null;build.storageFault={code:'EIO'};
  assert.equal(f.restart.available(),false);
  build.storageFault=null;
  assert.equal(f.restart.available(),true);
  build.generationBatchActive={batch:{batch_id:'between-plans'}};
  assert.equal(f.restart.available(),false);
  build.generationBatchActive=null;
  f.state.inFlightMutations=1;
  assert.equal(f.restart.available(),false);
});

test('lost supervisor acknowledgement fails closed and drains without a replacement approval',async()=>{
  const f=fixture({dropAck:true,timeoutMs:15});f.restart.markReady();f.parent.emit('message',{type:'supervisor-hello'});
  const result=await request({serviceState:f.state,serviceIdentity:f.identity,serviceRestart:f.restart},{service_instance_id:'service-current'});
  assert.equal(result.status,503);
  assert.equal(f.state.accepting,false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.drained(),1);
  assert.equal(f.messages.find(message=>message.type==='restart-drained')?.closed,false);
});

test('parent disconnect revokes managed restart and drains once',async()=>{
  const f=fixture();f.restart.markReady();f.parent.emit('message',{type:'supervisor-hello'});
  f.parent.emit('disconnect');f.parent.emit('disconnect');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.restart.isManaged(),false);
  assert.equal(f.state.accepting,false);
  assert.equal(f.drained(),1);
});

test('owned supervisor replaces only a drained child and checks retained identity',async()=>{
  let spawned=0,oldExited=false;
  const reports=[];
  const spawn=()=>{
    spawned++;
    const number=spawned;
    const child=new EventEmitter();
    child.send=message=>{
      if(message.type==='supervisor-hello')queueMicrotask(()=>child.emit('message',{type:'managed-ready',
        service_instance_id:`service-${number}`,data_root_sha256:'same-data',configuration_sha256:'same-config'}));
      if(message.type==='restart-ack'&&message.accepted){queueMicrotask(()=>{
        child.emit('message',{type:'restart-drained',closed:true});oldExited=true;child.emit('exit',0,null);
      });}
    };
    queueMicrotask(()=>child.emit('message',{type:'supervisor-awaiting'}));
    if(number===1)setTimeout(()=>child.emit('message',{type:'restart-request',request_id:'r1',service_instance_id:'service-1'}),10);
    if(number===2)setTimeout(()=>child.emit('exit',0,null),80);
    return child;
  };
  const result=await supervise({spawn,childPath:'fake',startupMs:500,shutdownMs:200,
    health:async()=>{if(oldExited&&spawned===1)throw Object.assign(Error('closed'),{code:'ECONNREFUSED'});return {status:'ready',accepting:true,
      service_identity:{service_instance_id:`service-${spawned}`,data_root_sha256:'same-data',configuration_sha256:'same-config'}};},
    report:message=>reports.push(message)});
  assert.equal(result,0);
  assert.equal(spawned,2);
  assert.equal(reports[0]?.type,'restart_complete');
});

test('owned supervisor does not replace an unexpected child exit',async()=>{
  let spawned=0;
  const spawn=()=>{
    spawned++;
    const child=new EventEmitter();
    child.send=message=>{if(message.type==='supervisor-hello')queueMicrotask(()=>child.emit('message',{type:'managed-ready',
      service_instance_id:'service-1',data_root_sha256:'data',configuration_sha256:'config'}));};
    queueMicrotask(()=>child.emit('message',{type:'supervisor-awaiting'}));
    setTimeout(()=>child.emit('exit',7,null),10);
    return child;
  };
  const result=await supervise({spawn,childPath:'fake',startupMs:500,shutdownMs:100,report:()=>{}});
  assert.equal(result,7);
  assert.equal(spawned,1);
});

test('hanging health check is bounded and cannot authorize a second child',async()=>{
  let spawned=0;
  const spawn=()=>{
    spawned++;
    const child=new EventEmitter();
    child.send=message=>{
      if(message.type==='supervisor-hello')queueMicrotask(()=>child.emit('message',{type:'managed-ready',service_instance_id:'one',data_root_sha256:'data',configuration_sha256:'config'}));
      if(message.type==='restart-ack'&&message.accepted)queueMicrotask(()=>{child.emit('message',{type:'restart-drained',closed:true});child.emit('exit',0,null);});
    };
    queueMicrotask(()=>child.emit('message',{type:'supervisor-awaiting'}));
    setTimeout(()=>child.emit('message',{type:'restart-request',request_id:'r1',service_instance_id:'one'}),10);
    return child;
  };
  const reports=[];
  const result=await supervise({spawn,childPath:'fake',health:()=>new Promise(()=>{}),healthMs:15,transitionMs:55,shutdownMs:30,report:message=>reports.push(message)});
  assert.equal(result,1);
  assert.equal(spawned,1);
  assert.equal(reports.at(-1).error,'PORT_NOT_RELEASED');
});

test('real owned fixture process is shut down after replacement identity mismatch',async()=>{
  let spawned=0;
  const children=[];
  const spawn=(childPath,args,options)=>{
    spawned++;
    const child=fork(childPath,args,{...options,env:{...options.env,FAKE_CHILD_INDEX:String(spawned)}});
    children.push(child);
    return child;
  };
  const result=await supervise({spawn,childPath:fileURLToPath(new URL('./fixtures/owned-child.mjs',import.meta.url)),
    startupMs:2000,shutdownMs:200,healthMs:40,transitionMs:200,
    health:async()=>{throw Object.assign(Error('closed'),{code:'ECONNREFUSED'});},report:()=>{}});
  assert.equal(result,1);
  assert.equal(spawned,2);
  assert.ok(children.every(child=>child.exited));
});

test('real owned fixture supports two explicit restart cycles after a completed task interval',async()=>{
  let spawned=0;
  const children=[];
  const reports=[];
  const spawn=(childPath,args,options)=>{
    spawned++;
    const child=fork(childPath,args,{...options,env:{...options.env,FAKE_CHILD_INDEX:String(spawned),FAKE_KEEP_IDENTITY:'1',FAKE_RESTART_COUNT:'2'}});
    children.push(child);
    return child;
  };
  const result=await supervise({spawn,childPath:fileURLToPath(new URL('./fixtures/owned-child.mjs',import.meta.url)),
    startupMs:2000,shutdownMs:300,healthMs:40,transitionMs:300,
    health:async()=>{
      const latest=children.at(-1);
      if(latest?.exited)throw Object.assign(Error('closed'),{code:'ECONNREFUSED'});
      return {status:'ready',accepting:true,service_identity:{service_instance_id:`fake-${spawned}`,data_root_sha256:'same-data',configuration_sha256:'same-config'}};
    },report:message=>reports.push(message)});
  assert.equal(result,0);
  assert.equal(spawned,3);
  assert.equal(reports.filter(message=>message.type==='restart_complete').length,2);
  assert.ok(children.every(child=>child.exited));
});
