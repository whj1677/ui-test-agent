import test from 'node:test';
import assert from 'node:assert/strict';
import {openDemonstrationDialog} from '../web-v2/demonstrations.js';
test('leaving during demonstration metadata read cannot open an old case dialog or start recording',async t=>{
 const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
 t.after(()=>Object.assign(globalThis,old));
 const handlers=new Map(),requests=[],pending=[],root={isConnected:true,firstElementChild:null};
 Object.defineProperty(root,'innerHTML',{set(){throw Error('OLD_DIALOG_MUST_NOT_RENDER');}});
 globalThis.document={querySelector:()=>root};globalThis.window={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);}};
 globalThis.fetch=(url,options={})=>{requests.push({url,method:options.method||'GET'});return new Promise(resolve=>pending.push(()=>resolve({ok:true,status:200,json:async()=>url.includes('script-environments')?{environments:[]}:url.endsWith('/environment')?{ui_environment_id:'env'}:{recordings:[]}})));};
 const result=openDemonstrationDialog({project:{project_id:'p'},item:{case_id:'c',current_version:1,versions:[{version:1,content:{case_type:'UI',status:'CONFIRMED',steps:[{action:'observe',expected:'expected'}]}}]}});
 handlers.get('hashchange')();for(const done of pending)done();await result;
 assert.equal(requests.length,3);assert.ok(requests.every(request=>request.method==='GET'));assert.equal(handlers.size,0);
});
