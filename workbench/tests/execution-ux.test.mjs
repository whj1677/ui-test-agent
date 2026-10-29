import test from 'node:test';
import assert from 'node:assert/strict';
import { batchReasons, candidateOptionLabel, candidateReadiness, openBatch, remedyHtml } from '../web-v2/workflow.js';

test('failed backend generation links to the exact plan without sending users to frontend generation', () => {
  const item = { reason: 'SCRIPT_GENERATION_FAILED', case_id: 'backend-case', case_version: 2, selection: { kind: 'HTTP_JSON', source_task_id: 'plan/failed' } };
  const html = remedyHtml(item, 'project/a', { caseReturn: '#/projects/project%2Fa?test_type=backend' });
  assert.match(html, /查看生成失败并重试/);
  assert.match(html, /cases\/backend-case\?version=2&amp;tab=scripts&amp;plan_id=plan%2Ffailed/);
  assert.match(html, /return=/);
  assert.doesNotMatch(html, /prepare=ui|核对后端计划/);
  assert.match(batchReasons.SCRIPT_GENERATION_FAILED, /生成未成功/);
});
import { demonstrationOptionLabel } from '../web-v2/script-actions.js';

const candidate = (reason = null) => ({ script_version: 5, selection: { case_version: 2, candidate_version: 5 },
  applies_to_selected_version: true, created_at: '2026-09-30T00:00:00Z', reason });

test('version options state content version, exact readiness and Chinese blockers', () => {
  assert.match(candidateOptionLabel(candidate()), /S5 · 用例 v2 · 可技术试跑/);
  assert.equal(candidateReadiness(candidate()).runnable, true);
  for (const [code, status] of [
    ['AUTH_SESSION_REQUIRED', '需登录'],
    ['BACKEND_PLAN_REVIEW_REQUIRED', '计划待审阅'],
    ['TRIAL_NOT_AUTHORIZED', '未授权'],
    ['TRIAL_BUNDLE_MISSING', '当前不可运行'],
  ]) {
    const value = candidate(code);
    assert.equal(candidateReadiness(value).runnable, false);
    assert.match(candidateOptionLabel(value), new RegExp(status));
    assert.doesNotMatch(candidateOptionLabel(value), /undefined/);
  }
  assert.equal(candidateReadiness({ ...candidate(), applies_to_selected_version: false }).runnable, false);
});

test('demonstration choice presents a readable title, step count, time and status', () => {
  const label = demonstrationOptionLabel({ demonstration_id: 'demo-uuid', case_title: '编号搜索',
    steps: [{}, {}], finished_at: '2026-09-30T01:00:00Z', status: 'CONFIRMED' });
  assert.match(label, /编号搜索 · 2 步 · .+ · 已确认/);
  assert.equal(label.includes('时间未记录'), false);
  assert.equal(label.includes('demo-uuid'), false);
});

const batchItem=(case_id,state='QUEUED',reason=null)=>({case_id,case_version:1,external_id:case_id,content_sha256:'content-'+case_id,state,reason,selection:{case_id,case_version:1,source_task_id:'task-'+case_id,candidate_version:2,bundle_sha256:'bundle-'+case_id,environment_id:'env'}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function batchFixture(t,items,context={}){
 const original={document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const nodes=new Map(),timers=new Map(),requests=[],navigations=[],selectNodes=[],windowEvents=new Map();let nextTimer=0;
 const node=selector=>{
  if(nodes.has(selector))return nodes.get(selector);
  let html='';
  const value={value:'',checked:false,disabled:false,isConnected:true,textContent:'',dataset:{},listeners:{},setAttribute(){},
   addEventListener(event,handler){this.listeners[event]=handler;},remove(){this.isConnected=false;},
   querySelector(query){if(query.startsWith('[data-batch-choice=')&&!html.includes(query.slice(1,-1)))return null;return node(query);},
   querySelectorAll(query){return query==='[data-batch-script]'?selectNodes:query==='button,input,select'?[...nodes.entries()].filter(([key])=>/^#batch-(start|close|cancel|preflight|software|diagnostic)$/.test(key)).map(([,value])=>value).concat(selectNodes):[];},
   insertAdjacentHTML(_position,source){html+=source;const match=source.match(/data-batch-script="([^"]+)"/);if(match){const select=node('select-'+match[1]);select.dataset.batchScript=match[1];selectNodes.push(select);}}
  };
  Object.defineProperty(value,'innerHTML',{get:()=>html,set:text=>{html=text;if(selector==='#batch-preview'){selectNodes.length=0;node('#batch-run-ack').checked=false;}}});
  nodes.set(selector,value);return value;
 };
 const dialog=node('dialog');node('#modal-root').firstElementChild=dialog;
 globalThis.document={querySelector:node,addEventListener(){},removeEventListener(){}};
 globalThis.window={addEventListener:(event,handler)=>windowEvents.set(event,handler),removeEventListener:(event,handler)=>{if(windowEvents.get(event)===handler)windowEvents.delete(event);}};
 globalThis.setTimeout=fn=>{const id=++nextTimer;timers.set(id,fn);return id;};globalThis.clearTimeout=id=>timers.delete(id);
 const state={preview:{items:structuredClone(items),software_version:''},freeze:null,failPreflight:false,startError:null,candidates:[]};
 const endpoint='/api/case-library/projects/p/batches';
 const mutate=async(path,options)=>{
  requests.push({path,body:structuredClone(options)});
  if(path.endsWith('/preflight')){if(state.failPreflight)throw Error('temporary failure');return structuredClone(state.preview);}
  if(path===endpoint){if(state.waitFreeze)await state.waitFreeze;return structuredClone(state.freeze||{...state.preview,batch_id:'batch-1'});}
  if(path.endsWith('/start')){if(state.waitStart)await state.waitStart;if(state.startError)throw Error(state.startError);return {batch_id:'batch-1',state:'RUNNING'};}
  throw Error('unexpected mutation '+path);
 };
 const api=async path=>{assert.match(path,/\/automation\?version=1$/);return {candidates:state.candidates};};
 const closed=openBatch({...context,project:{project_id:'p',cases:items},scope:'project',ids:[],api,mutate,jsonOptions:value=>value,go:path=>navigations.push(path)});
 t.after(async()=>{node('#batch-cancel').onclick();await closed;Object.assign(globalThis,original);});
 return {node,requests,navigations,state,selectNodes,endpoint,closed,
  leave(){windowEvents.get('hashchange')?.();},
  async check(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());await flush();},
  confirm(){if(node('#batch-preview').innerHTML.includes('id="batch-run-ack"')){node('#batch-run-ack').checked=true;node('#batch-run-ack').listeners.change();}},
  writes(){return requests.filter(request=>!request.path.endsWith('/preflight'));}
 };
}

test('mixed readiness offers an explicit partial-run button and starts only after one click',async t=>{
 const f=batchFixture(t,[batchItem('ready'),...Array.from({length:5},(_,i)=>batchItem('blocked-'+i,'BLOCKED','TRIAL_NOT_AUTHORIZED'))]);
 await f.check();f.confirm();
 assert.equal(f.node('#batch-start').disabled,false);
 assert.equal(f.node('#batch-start').textContent,'先运行可用的 1 条');
 assert.match(f.node('#batch-start-hint').textContent,/其余 5 条本次不运行/);
 assert.doesNotMatch(f.node('#modal-root').innerHTML+f.node('#batch-preview').innerHTML,/batch-partial|<table/);
 assert.equal(f.writes().length,0);
 const first=f.node('#batch-start').onclick(),second=f.node('#batch-start').onclick();await Promise.all([first,second]);
 assert.equal(f.writes().length,2);assert.equal(f.writes()[0].body.scope,'project');
 assert.equal(f.writes()[1].body.allow_partial,true);assert.equal(f.state.preview.items.length,6);
 assert.equal(f.navigations.length,1);assert.equal((await f.closed).state,'started');
});

test('all-ready scope starts without partial permission',async t=>{
 const f=batchFixture(t,[batchItem('a'),batchItem('b')]);await f.check();f.confirm();
 assert.equal(f.node('#batch-start').textContent,'开始运行 2 条');
 await f.node('#batch-start').onclick();assert.equal(f.writes().at(-1).body.allow_partial,false);
});

test('self-tested ready scripts start directly without a manual acknowledgement',async t=>{
 const f=batchFixture(t,[{...batchItem('a'),qualification:'SELF_TEST_PASSED'}]);await f.check();
 assert.doesNotMatch(f.node('#batch-preview').innerHTML,/batch-run-ack/);
 assert.equal(f.node('#batch-start').disabled,false);assert.equal(f.writes().length,0);
 assert.match(f.node('#batch-start-hint').textContent,/已通过自测/);
 await f.node('#batch-start').onclick();assert.equal(f.writes().at(-1).body.allow_partial,false);
 assert.equal((await f.closed).state,'started');
});

test('self-test readiness still requires acknowledging diagnostic or blocked scope',async t=>{
 const f=batchFixture(t,[{...batchItem('a'),qualification:'SELF_TEST_PASSED'}]);await f.check();
 f.node('#batch-diagnostic').checked=true;f.node('#batch-diagnostic').listeners.change();await f.check();
 assert.equal(f.node('#batch-start').disabled,true);assert.match(f.node('#batch-preview').innerHTML,/batch-run-ack/);
 f.node('#batch-diagnostic').checked=false;f.state.preview.items.push(batchItem('b','BLOCKED','SCRIPT_MISSING'));
 f.node('#batch-preflight').onclick();await f.check();assert.equal(f.node('#batch-start').disabled,true);
 f.confirm();await f.node('#batch-start').onclick();assert.equal(f.writes().at(-1).body.allow_partial,true);
});

test('zero-ready scope exposes remedies and cannot freeze or start a batch',async t=>{
 const f=batchFixture(t,[batchItem('a','BLOCKED','TRIAL_NOT_AUTHORIZED')]);await f.check();f.confirm();
 assert.equal(f.node('#batch-start').disabled,true);assert.equal(f.node('#batch-start').textContent,'暂无可运行用例');
 assert.match(f.node('#batch-preview').innerHTML,/核对脚本并允许运行/);
 await f.node('#batch-start').onclick();assert.deepEqual(f.writes(),[]);
});

test('changed frozen readiness requires another explicit click with the updated scope',async t=>{
 const f=batchFixture(t,[batchItem('a'),batchItem('b')]);await f.check();f.confirm();
 f.state.freeze={batch_id:'batch-1',items:[batchItem('a'),batchItem('b','BLOCKED','TRIAL_NOT_AUTHORIZED')]};
 await f.node('#batch-start').onclick();
 assert.equal(f.writes().length,1);assert.match(f.node('#batch-error').textContent,/准备条件已变化/);
 assert.equal(f.node('#batch-start').textContent,'先运行可用的 1 条');
 assert.equal(f.node('#batch-start').disabled,true);f.confirm();
 await f.node('#batch-start').onclick();
 assert.equal(f.writes().length,2);assert.equal(f.writes()[1].body.allow_partial,true);
});

test('start retry keeps the same frozen batch and request identity',async t=>{
 const f=batchFixture(t,[batchItem('a'),batchItem('b','BLOCKED','SCRIPT_MISSING')]);await f.check();f.confirm();
 f.state.startError='BATCH_EXECUTOR_BUSY';await f.node('#batch-start').onclick();
 assert.equal(f.node('#batch-start').disabled,false);assert.equal(f.node('#batch-start').textContent,'先运行可用的 1 条');
 f.state.startError=null;await f.node('#batch-start').onclick();
 assert.equal(f.writes().filter(r=>r.path===f.endpoint).length,1);
 const starts=f.writes().filter(r=>r.path.endsWith('/start'));
 assert.equal(starts.length,2);assert.equal(starts[0].body.request_id,starts[1].body.request_id);
});

test('leaving while freezing closes the old dialog and never starts the frozen batch',async t=>{
 const f=batchFixture(t,[batchItem('a')]);await f.check();f.confirm();
 let release;f.state.waitFreeze=new Promise(resolve=>release=resolve);
 const launching=f.node('#batch-start').onclick();await flush();
 assert.equal(f.writes().length,1);assert.equal(f.writes()[0].path,f.endpoint);
 try{f.leave();assert.equal(f.node('dialog').isConnected,false);}
 finally{release();await launching;}
 assert.equal(f.writes().some(request=>request.path.endsWith('/start')),false);
 assert.deepEqual(f.navigations,[]);assert.notEqual((await f.closed).state,'started');
});

test('leaving during an accepted start closes the old dialog and does not navigate after response',async t=>{
 const f=batchFixture(t,[batchItem('a')]);await f.check();f.confirm();
 let release;f.state.waitStart=new Promise(resolve=>release=resolve);
 const launching=f.node('#batch-start').onclick();await flush();
 assert.equal(f.writes().length,2);assert.ok(f.writes()[1].path.endsWith('/start'));
 try{f.leave();assert.equal(f.node('dialog').isConnected,false);}
 finally{release();await launching;}
 assert.equal(f.writes().length,2);assert.deepEqual(f.navigations,[]);
 assert.notEqual((await f.closed).state,'started');
});

test('preflight failure and edited inputs keep start disabled until a successful recheck',async t=>{
 const f=batchFixture(t,[batchItem('a')]);f.state.failPreflight=true;await f.check();f.confirm();
 assert.equal(f.node('#batch-start').disabled,true);assert.match(f.node('#batch-preview').textContent,/重新检查/);
 f.state.failPreflight=false;f.node('#batch-preflight').onclick();await f.check();f.confirm();
 assert.equal(f.node('#batch-start').disabled,false);
 f.node('#batch-software').value='v2';f.node('#batch-software').listeners.input();
 assert.equal(f.node('#batch-start').disabled,true);await f.node('#batch-start').onclick();assert.equal(f.writes().length,0);
 await f.check();f.confirm();await f.node('#batch-start').onclick();assert.equal(f.writes()[0].body.software_version,'v2');
});

test('multiple versions stay unselected until the tester explicitly chooses one',async t=>{
 const row=batchItem('a','BLOCKED','SCRIPT_SELECTION_REQUIRED');row.selection=null;
 const f=batchFixture(t,[row]);f.state.candidates=[1,2].map(n=>({...candidate(),selection:{...batchItem('a').selection,source_task_id:'task-'+n,candidate_version:n}}));
 await f.check();f.confirm();assert.equal(f.selectNodes.length,1);assert.equal(f.node('#batch-start').disabled,true);
 assert.deepEqual(f.requests[0].body.selections,[]);
 const select=f.selectNodes[0];select.value='1';f.state.preview={items:[{...row,state:'QUEUED',reason:null,selection:f.state.candidates[1].selection}]};select.listeners.change();await f.check();f.confirm();
 assert.deepEqual(f.requests.at(-1).body.selections,[f.state.candidates[1].selection]);
 assert.equal(f.writes().length,0);assert.equal(f.node('#batch-start').disabled,false);
});

test('remedies retain the exact UI candidate or backend plan and route login separately',()=>{
 const ui=batchItem('a','BLOCKED','TRIAL_NOT_AUTHORIZED');
 const html=remedyHtml(ui,'p');assert.match(html,/核对脚本并允许运行/);assert.match(html,/script_task=task-a&amp;candidate=2/);assert.doesNotMatch(html,/\/auth/);
 const backend={...ui,reason:'BACKEND_PLAN_REVIEW_REQUIRED',selection:{kind:'HTTP_JSON',source_task_id:'plan/2'}};
 assert.match(remedyHtml(backend,'p'),/version=1&amp;tab=scripts&amp;plan_id=plan%2F2/);
 assert.match(remedyHtml({...ui,reason:'AUTH_SESSION_REQUIRED'},'p'),/projects\/p\/auth">去登录/);
 assert.doesNotMatch(remedyHtml({...ui,reason:'SCRIPT_MISSING'},'p'),/模型授权/);
});
test('failed generation directs the run blocker to the project generation step',()=>{
  const failed=batchItem('case/a','BLOCKED','SCRIPT_GENERATION_FAILED');
  assert.equal(batchReasons[failed.reason],'脚本生成未成功，请重新生成');
  const html=remedyHtml(failed,'project/a');
  assert.match(html,/projects\/project%2Fa\?prepare=ui/);
  assert.match(html,/准备生成脚本/);
  assert.doesNotMatch(html,/script_task|candidate=|授权/);
});

 test('run permission starts unchecked and resets after scope recheck',async t=>{
 const f=batchFixture(t,[batchItem('a')]);await f.check();
 assert.equal(f.node('#batch-start').disabled,true);await f.node('#batch-start').onclick();assert.equal(f.writes().length,0);
 f.confirm();assert.equal(f.node('#batch-start').disabled,false);
 f.node('#batch-preflight').onclick();await f.check();assert.equal(f.node('#batch-start').disabled,true);
 });


test('single-case result retains the project workbench return scope after explicit start',async t=>{
 const caseReturn='#/projects/p?test_type=backend&selected=a';
 const f=batchFixture(t,[batchItem('a')],{caseContext:{case_id:'a',case_version:1},caseReturn});
 await f.check();assert.equal(f.node('#batch-start').disabled,true);f.confirm();await f.node('#batch-start').onclick();
 assert.equal(new URLSearchParams(f.navigations[0].split('?')[1]).get('return'),caseReturn);
});
test('result navigation rejects a different project as its return destination',async t=>{
 const f=batchFixture(t,[batchItem('a')],{caseContext:{case_id:'a',case_version:1},caseReturn:'#/projects/other?test_type=backend'});
 await f.check();f.confirm();await f.node('#batch-start').onclick();
 assert.equal(new URLSearchParams(f.navigations[0].split('?')[1]).has('return'),false);
});
