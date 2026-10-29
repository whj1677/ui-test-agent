import test from 'node:test';
import assert from 'node:assert/strict';
import { generationProgress, generationProgressHtml, generationStage, watchGenerationProgress, openScriptOperation } from '../web-v2/script-actions.js';
import { generationStatusHtml } from '../web-v2/requirements.js';
import { renderProjectWorkflow } from '../web-v2/project-workflow.js';

const receipt=(state,items,extra={})=>({project_id:'p',operation_id:'operation',state,items,created_at:'2026-10-05T01:00:00Z',...extra});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('self-tested scripts are runnable and prerequisite blockers remain failed results',()=>{
  const value=receipt('FINISHED',[{state:'READY'},{state:'ENVIRONMENT_BLOCKED',reason:'MISSING_TEST_PREREQUISITE'}],{quality_review_mode:'self-test-v1'});
  const progress=generationProgress(value);
  assert.equal(progress.generated,1);assert.equal(progress.failed,1);
  const html=generationProgressHtml(value);
  assert.match(html,/可运行 1/);assert.match(html,/自测通过，可运行/);assert.match(html,/前置条件受阻/);
  assert.doesNotMatch(html,/待核对 1/);
  assert.equal(generationStage({task_status:'VERIFYING',quality_policy:{quality_review_mode:'self-test-v1'}}),'正在保存已通过自测的脚本');
  const ready=generationProgressHtml(receipt('FINISHED',[{state:'READY'}],{quality_review_mode:'self-test-v1'}));
  assert.match(ready,/已通过自测的脚本可以直接运行/);assert.doesNotMatch(ready,/请核对候选结果/);
});

test('finished operation with failed validation is a failure, not generated success',()=>{
  const value=receipt('FINISHED',[{state:'CANDIDATE_VALIDATION_FAILED',external_id:'UI-1'}]);
  const progress=generationProgress(value);
  assert.equal(progress.active,false);assert.equal(progress.generated,0);assert.equal(progress.failed,1);
  const html=generationProgressHtml(value);
  assert.match(html,/1 条未成功/);assert.match(html,/脚本校验未通过/);assert.doesNotMatch(html,/已生成 1 条/);
});
test('failed items show returned cause and next action without hiding details',()=>{
  const value=receipt('FINISHED',[
    {state:'CANDIDATE_VALIDATION_FAILED',external_id:'UI-1',reason:'HARNESS_MODEL_TRANSPORT_FAILED',task_id:'task-one'},
    {state:'NOT_RUN',external_id:'UI-2',reason:'MODEL_PROVIDER_UNAVAILABLE'}
  ]);
  const html=generationProgressHtml(value,{compact:true});
  assert.match(html,/<details data-generation-details open>/);
  assert.match(html,/模型服务调用失败，请检查服务连接/);
  assert.match(html,/模型服务暂不可用，本条未生成/);
  assert.match(html,/检查后需显式重新发起生成/);
  assert.match(html,/build-tasks\/task-one/);
  assert.deepEqual([generationProgress(value).failed,generationProgress(value).skipped],[1,1]);
});
test('interrupted receipt and older failed result expose only recorded causes',()=>{
  const interrupted=receipt('INTERRUPTED',[{state:'NOT_RUN',reason:'MODEL_PROVIDER_UNAVAILABLE'}],{error:'MODEL_PROVIDER_UNAVAILABLE'});
  const html=generationProgressHtml(interrupted,{compact:true});
  assert.match(html,/<details data-generation-details open>/);
  assert.match(html,/任务中断：模型服务暂不可用/);
  const old=generationProgressHtml(receipt('FINISHED',[{state:'CANDIDATE_VALIDATION_FAILED',task_id:'task-old'}]),{compact:true});
  assert.match(old,/失败原因未返回；请查看过程记录/);
  assert.match(old,/build-tasks\/task-old/);
});

test('batch meter counts handled cases and preserves failed, skipped and queued cases in the denominator',()=>{
  const value=receipt('RUNNING',['WAITING_HUMAN_REVIEW','BLOCKED','NOT_RUN','RUNNING','QUEUED'].map((state,i)=>({state,external_id:`UI-${i}`})));
  const result=generationProgress(value);
  assert.deepEqual([result.total,result.processed,result.generated,result.failed,result.skipped,result.waiting],[5,3,1,1,1,2]);
  assert.equal(result.current.external_id,'UI-3');
  const html=generationProgressHtml(value);
  assert.match(html,/<progress max="5" value="3"/);assert.match(html,/当前用例处理中/);assert.match(html,/待核对 1 · 未成功 1 · 跳过\/未生成 1/);
});

test('single ongoing script has an indeterminate meter, and completed candidate remains pending human review',()=>{
  const active=receipt('RUNNING',[{state:'RUNNING'}]);
  const meter=generationProgressHtml(active).match(/<progress[^>]*>/)[0];
  assert.doesNotMatch(meter,/\bvalue=/);
  const done=receipt('FINISHED',[{state:'WAITING_HUMAN_REVIEW'}]);
  assert.match(generationProgressHtml(done),/已生成 1 条，待核对/);
  assert.match(generationProgressHtml(done),/处理结束不等于业务测试通过/);
});

test('terminal cancellation and interrupted jobs never remain labelled stopping or generating',()=>{
  const value=receipt('CANCELLED',[{state:'NOT_RUN'}],{cancel_requested:true});
  const html=generationProgressHtml(value);
  assert.match(html,/生成已取消/);assert.doesNotMatch(html,/正在停止|data-generation-stop/);
  const interrupted=generationProgress(receipt('INTERRUPTED',[{state:'RUNNING'},{state:'QUEUED'}]));
  assert.equal(interrupted.generated,0);assert.equal(interrupted.active,false);assert.equal(interrupted.skipped,2);assert.equal(interrupted.title,'生成已中断');
});

test('backend drafts, retained scripts and failures remain distinct and labels are escaped',()=>{
  const value=receipt('FINISHED',[{state:'DRAFT',external_id:'<img>'},{state:'EXISTS'},{state:'FAILED',reason:'<script>'}]);
  const progress=generationProgress(value,'backend');
  assert.deepEqual([progress.generated,progress.skipped,progress.failed],[1,1,1]);
  const html=generationProgressHtml(value,{kind:'backend'});
  assert.match(html,/&lt;img&gt;/);assert.match(html,/&lt;script&gt;/);assert.match(html,/已产出，待审阅/);assert.doesNotMatch(html,/<img>|<script>/);
});

test('stage uses active evidence only and keeps frontend and backend wording appropriate',()=>{
  assert.equal(generationStage({development:{quality_reviews:[{status:'REVIEWING'}]}}),'正在审查脚本');
  assert.equal(generationStage({task_status:'VERIFYING'}),'正在独立复验');
  assert.equal(generationStage({development:{self_tests:[{status:'EXECUTING',finished_at:123}]}}),'正在观察页面、编写或修订脚本');
  assert.equal(generationStage({generation_session:{}},'backend'),'正在根据协议编写或修订脚本');
});

test('polling reads a running build, then settles exactly once on failed completion without submitting jobs',async()=>{
  const active=receipt('RUNNING',[{state:'RUNNING',task_id:'task-1'}]),done=receipt('FINISHED',[{state:'CANDIDATE_VALIDATION_FAILED'}]);
  const reads=[],updates=[],settled=[];let current=active;
  const watcher=watchGenerationProgress({projectId:'p',initial:active,interval:60000,request:async(path,options)=>{reads.push({path,options});return path.includes('/build/tasks/')?{task_status:'VERIFYING'}:current;},onUpdate:(v,task)=>updates.push({v,task}),onSettled:v=>settled.push(v)});
  try{await watcher.ready;assert.equal(updates.at(-1).task.task_status,'VERIFYING');current=done;await watcher.refresh();await watcher.refresh();assert.equal(settled.length,1);assert.equal(settled[0],done);assert.ok(reads.every(r=>!r.options.method));assert.ok(reads.some(r=>r.path==='/api/build/tasks/task-1'));}
  finally{watcher.dispose();}
});

test('transient polling failure retains state and can recover without another generation request',async()=>{
  const active=receipt('RUNNING',[{state:'QUEUED'}]),done=receipt('FINISHED',[{state:'WAITING_HUMAN_REVIEW'}]);let fail=true;const updates=[],errors=[];
  const watcher=watchGenerationProgress({projectId:'p',initial:active,interval:60000,request:async()=>{if(fail)throw Error('offline');return done;},onUpdate:v=>updates.push(v),onError:e=>errors.push(e)});
  try{await watcher.ready;assert.equal(updates.at(-1),active);assert.equal(errors.length,1);fail=false;await watcher.refresh();assert.equal(updates.at(-1),done);}
  finally{watcher.dispose();}
});

test('disposing pending reads aborts and prevents updates to another page',async()=>{
  let release,signal;const updates=[],active=receipt('RUNNING',[{state:'QUEUED'}]);
  const watcher=watchGenerationProgress({projectId:'p',initial:active,request:(_path,options)=>{signal=options.signal;return new Promise(resolve=>release=resolve);},onUpdate:v=>updates.push(v)});
  watcher.dispose();release(receipt('FINISHED',[{state:'WAITING_HUMAN_REVIEW'}]));await watcher.ready;
  assert.equal(signal.aborted,true);assert.deepEqual(updates,[active]);
});

function viewFixture(t,respond){
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,location:globalThis.location,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  const nodes=new Map(),calls=[],timers=[],disposers=[];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:selector==='#script-environment'?'env':selector==='#script-review-mode'?'static-v1':'',checked:false,disabled:false,isConnected:true,hidden:false,addEventListener(name,handler){this[name]=handler;},querySelector:node,querySelectorAll(selectors){return selectors==='#script-close,#script-cancel'?['#script-close','#script-cancel'].map(node):selectors==='[data-progress-close]'?[node('progress-close')]:[];},remove(){this.isConnected=false;}});return nodes.get(selector);};
  const dialog=node('dialog');node('#modal-root').firstElementChild=dialog;
  let modalHtml='';Object.defineProperty(node('#modal-root'),'innerHTML',{get:()=>modalHtml,set:value=>{modalHtml=value;dialog.isConnected=true;}});
  globalThis.document={querySelector:node,addEventListener(){},removeEventListener(){}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.location={hash:'#/projects/p'};
  globalThis.setTimeout=handler=>{timers.push(handler);return timers.length;};globalThis.clearTimeout=()=>{};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});const body=await respond(path,options);return {ok:true,status:200,json:async()=>body};};
  t.after(()=>{disposers.forEach(dispose=>dispose());Object.assign(globalThis,original);});
  return {node,calls,timers,disposers,dialog};
}

test('bulk dialog is immediate, cancellable during slow loading and never reopens from a late response',async t=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const f=viewFixture(t,async path=>{await gate;return path.includes('script-environments')?{environments:[]}:{ui_environment_id:'env',ui:{id:'env'}};});
  const opening=openScriptOperation({project:{project_id:'p'},items:Array.from({length:72},(_,i)=>({case_id:`ui-${i}`,case_version:1})),mode:'generate',onError:assert.fail});
  assert.match(f.node('#modal-root').innerHTML,/正在检查 72 条/);
  f.node('[data-loading-close]').onclick();
  assert.ok(f.calls.every(call=>call.options.signal.aborted));
  release();await opening;
  assert.equal(f.dialog.isConnected,false);assert.equal(f.calls.length,2);assert.equal(f.timers.length,0);
});

test('bulk generation reads history once through preflight and retains blocking gates',async t=>{
  const items=Array.from({length:72},(_,i)=>({case_id:`ui-${i}`,case_version:1}));
  const f=viewFixture(t,async path=>{
    if(path.includes('script-environments'))return {environments:[{id:'env'}]};
    if(path.endsWith('/environment'))return {ui_environment_id:'env',ui:{id:'env'}};
    if(path.endsWith('/preflight'))return {items:items.map((item,i)=>({...item,reason:i===0?'SCRIPT_ALREADY_EXISTS':null,old_scripts:i===0?[{candidate_version:2,source_task_id:'old-task'}]:[]}))};
    throw Error(`unexpected ${path}`);
  });
  await openScriptOperation({project:{project_id:'p'},items,mode:'generate',onError:assert.fail});
  f.timers[0]();await flush();
  assert.equal(f.calls.length,3);assert.equal(f.node('#script-confirm').disabled,true);
  assert.match(f.node('[data-script-history="0"]').textContent,/候选 v2 · old-task/);
  assert.ok(!f.calls.some(call=>call.path.includes('/automation?')));
  f.node('#script-cancel').onclick();
});

test('confirmed generation stays on the same route and passes the receipt into the current view',async t=>{
  const active=receipt('RUNNING',[{state:'QUEUED',case_id:'ui',case_version:1}]);
  const f=viewFixture(t,async(path,options)=>{
    if(path.startsWith('/api/script-environments'))return {environments:[{id:'env'}]};
    if(path.endsWith('/environment'))return {ui_environment_id:'env',ui:{id:'env'}};
    if(path.includes('/automation?'))return {candidates:[]};
    if(path.endsWith('/demonstrations'))return {recordings:[]};
    if(path.endsWith('/preflight'))return {items:[{reason:null,requires_model_confirmation:true}]};
    if(path.endsWith('/script-operations') && options.method==='POST')return active;
    throw Error(`unexpected ${path}`);
  });
  const started=[],navigations=[],errors=[];
  await openScriptOperation({project:{project_id:'p',name:'项目'},items:[{case_id:'ui',case_version:1}],mode:'generate',go:v=>navigations.push(v),onStarted:v=>started.push(v),onError:e=>errors.push(e)});
  assert.equal(errors.length,0);f.timers[0]();await flush();
  assert.ok(!f.node('#modal-root').innerHTML.includes('script-model-confirm'));assert.ok(!f.calls.some(c=>c.path.endsWith('/script-operations') && c.options.method==='POST'));
  assert.equal(f.node('#script-confirm').disabled,false);await f.node('#script-confirm').onclick();
  assert.equal(JSON.parse(f.calls.find(c=>c.path.endsWith('/script-operations') && c.options.method==='POST').options.body).confirm_model_use,true);assert.deepEqual(started,[active]);assert.equal(globalThis.location.hash,'#/projects/p');assert.equal(navigations.length,0);assert.equal(f.dialog.isConnected,false);
  await f.node('#script-confirm').onclick();assert.equal(f.calls.filter(c=>c.path.endsWith('/script-operations') && c.options.method==='POST').length,1);
});

test('slow batch submission shows immediate feedback and repeated clicks cannot send a duplicate',async t=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const active=receipt('RUNNING',[{state:'QUEUED'}]);
  const f=viewFixture(t,async(path,options)=>{
    if(path.startsWith('/api/script-environments'))return {environments:[{id:'env'}]};
    if(path.endsWith('/environment'))return {ui_environment_id:'env',ui:{id:'env'}};
    if(path.endsWith('/preflight'))return {items:[{reason:null}]};
    if(path.endsWith('/script-operations') && options.method==='POST'){await gate;return active;}
    throw Error(`unexpected ${path}`);
  });
  await openScriptOperation({project:{project_id:'p'},items:[{case_id:'ui-1',case_version:1},{case_id:'ui-2',case_version:1}],mode:'generate',onError:assert.fail,onStarted:()=>{}});
  f.timers[0]();await flush();
  const sending=f.node('#script-confirm').onclick();
  assert.equal(f.node('#script-confirm').textContent,'正在启动…');
  assert.match(f.node('#script-plan').textContent,/正在提交 2 条用例/);
  await f.node('#script-confirm').onclick();
  assert.equal(f.calls.filter(call=>call.options.method==='POST' && call.path.endsWith('/script-operations')).length,1);
  release();await sending;assert.equal(f.dialog.isConnected,false);
});

test('project reload restores the active operation and ends in-place with a visible failure',async t=>{
  let current=receipt('RUNNING',[{state:'RUNNING',external_id:'UI-1'}]);
  const f=viewFixture(t,async path=>{
    if(path.endsWith('/environment'))return {ui_environment_id:'env',ui:{id:'env',auth_required:false}};
    if(path.endsWith('/preflight'))return {items:[{case_id:'ui',case_version:1}]};
    if(path.includes('/preparation'))return {items:[],protocols:[]};
    if(path.endsWith('/generation-batches'))return {batches:[]};
    if(path.endsWith('/script-operations'))return {operations:[current]};
    if(path.endsWith('/operation'))return current;
    throw Error(`unexpected ${path}`);
  });
  f.disposers.push(await renderProjectWorkflow({project:{project_id:'p',cases:[{case_id:'ui',current_version:1,versions:[{version:1,content:{case_type:'UI',status:'CONFIRMED'}}]}]},showPage(){}}));
  await flush();assert.match(f.node('#pw-ui-progress').innerHTML,/正在生成脚本/);assert.equal(f.node('#pw-generate-ui').disabled,true);
  current=receipt('FINISHED',[{state:'CANDIDATE_VALIDATION_FAILED',external_id:'UI-1'}]);f.timers.at(-1)();await flush();
  assert.match(f.node('#pw-ui-progress').innerHTML,/脚本校验未通过/);assert.equal(f.node('#pw-generate-ui').disabled,false);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/script-operations') && c.options.method==='POST').length,0);
});

test('generation from a case stays in a progress dialog, and closing it only stops display polling',async t=>{
  const active=receipt('RUNNING',[{state:'QUEUED'}]);
  const f=viewFixture(t,async path=>{
    if(path.startsWith('/api/script-environments'))return {environments:[{id:'env'}]};
    if(path.endsWith('/environment'))return {ui_environment_id:'env',ui:{id:'env'}};
    if(path.includes('/automation?'))return {candidates:[]};
    if(path.endsWith('/demonstrations'))return {recordings:[]};
    if(path.endsWith('/preflight'))return {items:[{reason:null}]};
    if(path.endsWith('/script-operations') || path.endsWith('/operation'))return active;
    throw Error(`unexpected ${path}`);
  });
  const navigations=[];
  await openScriptOperation({project:{project_id:'p',name:'项目'},items:[{case_id:'ui',case_version:1}],mode:'generate',go:value=>navigations.push(value),onError:assert.fail});
  f.timers[0]();await flush();await f.node('#script-confirm').onclick();await flush();
  assert.match(f.node('#modal-root').innerHTML,/脚本生成进度/);assert.match(f.node('[data-progress-body]').innerHTML,/正在生成脚本/);assert.equal(navigations.length,0);
  f.node('progress-close').onclick();assert.equal(f.dialog.isConnected,false);
  const reads=f.calls.length;f.timers.at(-1)();await flush();assert.equal(f.calls.length,reads);assert.ok(!f.calls.some(c=>c.path.endsWith('/stop')));
});

test('failure to restore a job is visible and recheck recovers it without permitting duplicate generation',async t=>{
  let offline=true;const active=receipt('RUNNING',[{state:'QUEUED'}]);let page='';
  const f=viewFixture(t,async path=>{
    if(path.endsWith('/environment'))return {ui_environment_id:'env',ui:{id:'env'}};
    if(path.endsWith('/preflight'))return {items:[{case_id:'ui',case_version:1}]};
    if(path.includes('/preparation'))return {items:[],protocols:[]};
    if(path.endsWith('/generation-batches'))return {batches:[]};
    if(path.endsWith('/script-operations')){if(offline)throw Error('offline');return {operations:[active]};}
    if(path.endsWith('/operation'))return active;
    return {};
  });
  f.disposers.push(await renderProjectWorkflow({project:{project_id:'p',cases:[{case_id:'ui',current_version:1,versions:[{version:1,content:{case_type:'UI',status:'CONFIRMED'}}]}]},showPage:html=>page=html}));
  assert.match(f.node('#pw-ui-error').textContent,/暂时无法恢复生成进度/);assert.equal(f.node('#pw-generate-ui').disabled,true);
  offline=false;f.node('#pw-recheck-ui').onclick();await flush();
  assert.match(f.node('#pw-ui-progress').innerHTML,/正在生成脚本/);assert.equal(f.node('#pw-generate-ui').disabled,true);
});


test('case design updates preserve the indeterminate meter and replace it with the actual terminal outcome',()=>{
  for(const status of ['QUEUED','RUNNING','CANCEL_REQUESTED']){const html=generationStatusHtml({status});assert.match(html,/<progress/);assert.doesNotMatch(html,/value=/);}
  assert.match(generationStatusHtml({status:'CANCEL_REQUESTED'}),/正在取消/);
  const completed=generationStatusHtml({status:'COMPLETED'},3,2);assert.doesNotMatch(completed,/<progress/);assert.match(completed,/前端 3 条、后端 2 条候选待人工审阅/);
  const failed=generationStatusHtml({status:'FAILED'});assert.doesNotMatch(failed,/<progress/);assert.match(failed,/资料分析未完成/);
});
