import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCandidateTrialAuthorization} from '../web-v2/project-target-access.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const element=()=>({isConnected:true,value:'operator',checked:true,disabled:false,textContent:'',listeners:new Map(),addEventListener(name,handler){this.listeners.set(name,handler);}});
const selection={project_id:'project-a',case_id:'case-a',case_version:1,content_sha256:'content',source_task_id:'task-a',candidate_version:1,bundle_sha256:'bundle',environment_id:'env-a'};
function fixture(t,{onAuthorized,defaultGuard=false}={}){
 const old={document:globalThis.document,window:globalThis.window,location:globalThis.location,fetch:globalThis.fetch};t.after(()=>Object.assign(globalThis,old));
 const windowEvents=new Map(),documentEvents=new Map(),root={firstElementChild:null},calls=[],authorizations=[];
 let dialog,controls,closers,current=true;
 Object.defineProperty(root,'innerHTML',{set(){controls=new Map(['trial-confirm','trial-operator','trial-authorize','trial-auth-error'].map(id=>['#'+id,element()]));closers=[element(),element()];dialog={isConnected:true,querySelector:id=>controls.get(id),querySelectorAll:()=>closers,remove(){this.isConnected=false;if(root.firstElementChild===this)root.firstElementChild=null;}};root.firstElementChild=dialog;}});
 const location={hash:'#/projects/project-a/cases/case-a'};
 globalThis.location=location;
 globalThis.window={location,addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:(name,fn)=>{if(windowEvents.get(name)===fn)windowEvents.delete(name);}};
 globalThis.document={querySelector:selector=>selector==='#modal-root'?root:null,addEventListener:(name,fn)=>documentEvents.set(name,fn),removeEventListener:(name,fn)=>{if(documentEvents.get(name)===fn)documentEvents.delete(name);}};
 globalThis.fetch=(url,options)=>{const pending=deferred();calls.push({url,body:JSON.parse(options.body),...pending});return pending.promise;};
 return {root,windowEvents,documentEvents,calls,authorizations,
  open:()=>requestCandidateTrialAuthorization({project:{project_id:'project-a',name:'A'},selection,candidate:{...selection,external_id:'A1'},onAuthorized:onAuthorized||((value,guard)=>authorizations.push({value,current:guard.isCurrent()})),...(defaultGuard?{}:{isCurrent:()=>current})}),
  submit:()=>controls.get('#trial-authorize').listeners.get('click')(),
  control:id=>controls.get('#'+id),
  change:()=>controls.get('#trial-confirm').listeners.get('change')(),
  close:()=>closers[0].listeners.get('click')(),
  leave:(emit=true)=>{current=false;location.hash='#/projects/project-b/cases';if(emit)windowEvents.get('hashchange')?.();},
  replace:()=>{const other=element();root.firstElementChild=other;dialog.isConnected=false;return other;},
  settle:(index,ok=true)=>calls[index].resolve({ok,json:async()=>ok?{authorization_id:'auth-one'}:{error:'AUTHORIZATION_REJECTED'}}),
 };
}

for(const ok of [true,false]){
 test(`authorization ${ok?'success':'failure'} after hash navigation cannot invoke followup or alter a new modal`,async t=>{
  const f=fixture(t);await f.open();const submitting=f.submit();f.leave();const other=f.replace();f.settle(0,ok);await submitting;
  assert.deepEqual(f.authorizations,[]);assert.equal(f.root.firstElementChild,other);assert.equal(f.control('trial-auth-error').textContent,'');assert.equal(f.windowEvents.size,0);assert.equal(f.documentEvents.size,0);
 });
 test(`authorization ${ok?'success':'failure'} after manual close cannot invoke followup`,async t=>{
  const f=fixture(t);await f.open();const submitting=f.submit();f.close();f.settle(0,ok);await submitting;
  assert.deepEqual(f.authorizations,[]);assert.equal(f.root.firstElementChild,null);assert.equal(f.control('trial-auth-error').textContent,'');
 });
 test(`authorization ${ok?'success':'failure'} after modal replacement does not remove its new owner`,async t=>{
  const f=fixture(t);await f.open();const submitting=f.submit();const other=f.replace();f.settle(0,ok);await submitting;
  assert.deepEqual(f.authorizations,[]);assert.equal(f.root.firstElementChild,other);assert.equal(f.windowEvents.size,0);
 });
}

test('default guard rejects a changed hash even when hashchange delivery is delayed',async t=>{
 const f=fixture(t,{defaultGuard:true});await f.open();const submitting=f.submit();f.leave(false);f.settle(0);await submitting;assert.deepEqual(f.authorizations,[]);assert.equal(f.root.firstElementChild,null);
});

test('pending submit stays disabled after edits and double clicks send one authorization',async t=>{
 const f=fixture(t);await f.open();const submitting=f.submit();f.change();assert.equal(f.control('trial-authorize').disabled,true);await f.submit();assert.equal(f.calls.length,1);
 f.settle(0);await submitting;assert.equal(f.authorizations.length,1);assert.equal(f.authorizations[0].current,true);assert.equal(f.root.firstElementChild,null);assert.equal(f.windowEvents.size,0);
});

test('old submit and input handlers cannot submit or enable after Escape closes the modal',async t=>{
 const f=fixture(t);await f.open();f.documentEvents.get('keydown')({key:'Escape'});f.change();await f.submit();assert.equal(f.calls.length,0);assert.equal(f.root.firstElementChild,null);assert.equal(f.documentEvents.size,0);
});

test('response body decode finishing after close cannot authorize a followup',async t=>{
 const f=fixture(t);await f.open();const submitting=f.submit(),body=deferred();f.calls[0].resolve({ok:true,json:()=>body.promise});await Promise.resolve();f.close();body.resolve({authorization_id:'auth-one'});await submitting;assert.deepEqual(f.authorizations,[]);
});

test('current failure shows an error and permits an explicit retry',async t=>{
 const f=fixture(t);await f.open();const first=f.submit();f.settle(0,false);await first;assert.equal(f.control('trial-auth-error').textContent,'AUTHORIZATION_REJECTED');assert.equal(f.control('trial-authorize').disabled,false);assert.ok(f.root.firstElementChild);
 const retry=f.submit();f.settle(1);await retry;assert.equal(f.authorizations.length,1);assert.equal(f.calls.length,2);
});

test('callback guard remains valid during automation GET but blocks its continuation after navigation',async t=>{
 const gate=deferred(),entered=deferred(),continuations=[];
 const f=fixture(t,{onAuthorized:async(value,guard)=>{assert.equal(guard.isCurrent(),true);entered.resolve();await gate.promise;if(guard.isCurrent())continuations.push(value);}});
 await f.open();const submitting=f.submit();f.settle(0);await entered.promise;assert.equal(f.root.firstElementChild,null);f.leave();gate.resolve();await submitting;assert.deepEqual(continuations,[]);assert.equal(f.windowEvents.size,0);
});

test('successful followup may open the next modal and final cleanup preserves it',async t=>{
 let next;
 const f=fixture(t,{onAuthorized:async(value,guard)=>{assert.equal(guard.isCurrent(),true);next=f.replace();}});await f.open();const submitting=f.submit();f.settle(0);await submitting;assert.equal(f.root.firstElementChild,next);
});

test('automation followup rejection arriving after navigation does not reject the old event handler',async t=>{
 const gate=deferred(),entered=deferred();
 const f=fixture(t,{onAuthorized:async()=>{entered.resolve();await gate.promise;throw Error('AUTOMATION_READ_FAILED');}});
 await f.open();const submitting=f.submit();f.settle(0);await entered.promise;f.leave();gate.resolve();await submitting;assert.equal(f.windowEvents.size,0);assert.equal(f.root.firstElementChild,null);
});
