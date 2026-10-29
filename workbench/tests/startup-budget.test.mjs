import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {supervise,SUPERVISOR_BUDGETS} from '../server/owned-supervisor.mjs';
import {NATIVE_STARTUP_TIMEOUT_MS,NATIVE_STOP_TIMEOUT_MS} from '../server/native-dsh/runtime.mjs';
import {SERVICE_RESTART_TIMEOUT_MS} from '../web-v2/service-restart.js';
import {startupPhase} from '../server/startup-phase.mjs';

test('startup and reload budgets contain nested host checks, cleanup and the existing desktop wait',async()=>{
 assert.ok(SUPERVISOR_BUDGETS.startupMs>=NATIVE_STARTUP_TIMEOUT_MS+2*NATIVE_STOP_TIMEOUT_MS+10_000);
 assert.ok(SERVICE_RESTART_TIMEOUT_MS>=SUPERVISOR_BUDGETS.startupMs+SUPERVISOR_BUDGETS.shutdownMs+SUPERVISOR_BUDGETS.transitionMs+3_000);
 const script=await fs.readFile(new URL('../scripts/open-workbench.ps1',import.meta.url),'utf8');
 const seconds=Number(script.match(/AddSeconds\((\d+)\)/)?.[1]);assert.ok(Number.isFinite(seconds));
 assert.ok(seconds*1000>=SUPERVISOR_BUDGETS.startupMs+10_000);
});
function childAfter(readyMs,exitAfterReady=true){
 const child=new EventEmitter();let readyTimer,exitTimer;
 child.send=message=>{if(message.type==='shutdown'){clearTimeout(readyTimer);clearTimeout(exitTimer);queueMicrotask(()=>child.emit('exit',0,null));}};
 readyTimer=setTimeout(()=>{child.emit('message',{type:'managed-ready',service_instance_id:'fixture',data_root_sha256:'same',configuration_sha256:'same'});if(exitAfterReady)exitTimer=setTimeout(()=>child.emit('exit',0,null),10);},readyMs);
 return child;
}
test('scaled valid initialization plus host wait fits the outer budget without bypassing readiness',async()=>{
 const child=childAfter((NATIVE_STARTUP_TIMEOUT_MS+15_000)/1000);
 const result=await supervise({spawn:()=>child,childPath:'fixture',startupMs:SUPERVISOR_BUDGETS.startupMs/1000,shutdownMs:30,report:()=>{}});
 assert.equal(result,0);assert.ok(child.exited);
});
test('startup that never becomes ready still fails and cleans only its owned child',async()=>{
 const reports=[];let spawned=0;const child=childAfter(1000,false);
 assert.equal(await supervise({spawn:()=>{spawned++;return child;},childPath:'fixture',startupMs:20,shutdownMs:50,report:x=>reports.push(x)}),1);
 assert.equal(spawned,1);assert.ok(child.exited);assert.equal(reports.at(-1).error,'SERVICE_START_TIMEOUT');
});
test('startup telemetry preserves values and exceptions but never records their private content',async()=>{
 const events=[];let clock=0;const settings={now:()=>clock,report:x=>events.push(x)},secret={apiKey:'private-synthetic-value'};
 assert.equal(await startupPhase('LICENSE',()=>{clock=12;return secret;},settings),secret);
 const error=Error('private-synthetic-error');await assert.rejects(startupPhase('NATIVE_HOST',()=>{throw error;},settings),e=>e===error);
 assert.deepEqual(events.map(e=>e.state),['STARTED','COMPLETED','STARTED','FAILED']);assert.equal(events[1].elapsed_ms,12);
 assert.doesNotMatch(JSON.stringify(events),/private|apiKey/);
 await assert.rejects(startupPhase('untrusted-private-phase',()=>secret,settings),/STARTUP_PHASE_INVALID/);assert.equal(events.length,4);
});
