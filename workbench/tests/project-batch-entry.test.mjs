import test from 'node:test';
import assert from 'node:assert/strict';
import { uiGenerationItems, renderProjectWorkflow } from '../web-v2/project-workflow.js';

const row=(id,status='CONFIRMED',type='UI',version=1)=>({case_id:id,current_version:version,versions:[{version,content:{external_id:id,title:id,status,case_type:type}}]});
const ready=(id,version=1)=>({case_id:id,case_version:version,state:'QUEUED',reason:null});

test('generation scope includes only current confirmed ready frontend cases and never broadens a stale selection',()=>{
  const project={cases:[row('one'),row('two'),row('pending','PENDING_CONFIRMATION'),row('backend','CONFIRMED','BACKEND'),row('updated','CONFIRMED','UI',2)]};
  const plan=[ready('one'),ready('two'),ready('pending'),ready('backend'),ready('updated',1)];
  assert.deepEqual(uiGenerationItems(project,plan).map(item=>item.case_id),['one','two']);
  assert.deepEqual(uiGenerationItems(project,plan,new Set(['two','backend'])).map(item=>item.case_id),['two']);
  for(const ids of [['pending'],['foreign'],['backend']])assert.deepEqual(uiGenerationItems(project,plan,new Set(ids)),[]);
});

async function renderFixture(project,callback,configuration={}){
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};
  const nodes=new Map(),calls=[],navigations=[],checks=project.cases.map(item=>({dataset:{pwCase:item.case_id},checked:false}));let html='';
  const environment=configuration.environment || {ui:{id:'env',auth_required:false,ready:true},ui_environment_id:'env'};
  const preflight=(id,version)=>configuration.preflightReason?
    {...ready(id,version),state:'BLOCKED',reason:configuration.preflightReason,environment_id:environment.ui_environment_id || environment.ui?.id}:ready(id,version);
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,hidden:false,attributes:{},setAttribute(key,value){this.attributes[key]=value;},classList:{toggle(){}},addEventListener(name,handler){this[name]=handler;},querySelectorAll(query){return selector==='#pw-run-table' && query==='[data-pw-case]'?checks:[];}});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,options});let body={};
    if(path.endsWith('/environment'))body=environment;
    else if(path.includes('/preparation'))body={items:[],protocols:[]};
    else if(path.endsWith('/generation-batches'))body={batches:[]};
    else if(path.endsWith('/script-operations/preflight'))body={items:JSON.parse(options.body).items.map(item=>preflight(item.case_id,item.case_version))};
    else if(path.endsWith('/batches/preflight'))body={items:project.cases.map(item=>preflight(item.case_id,item.current_version))};
    else if(path.endsWith('/script-operations'))body={operations:[]};
    else if(path.includes('/auth?'))body={session:configuration.authSession || {status:'NOT_LOGGED_IN'}};
    return {ok:true,status:200,json:async()=>body};
  };
  try{
    const dispose=await renderProjectWorkflow({project:{project_id:'project-test',...project},showPage:value=>{html=value;},go:href=>navigations.push(href)});
    await callback({node,checks,calls,navigations,get html(){return html;}});dispose();
  }finally{Object.assign(globalThis,original);}
}

test('an all-pending project still shows bulk preparation and an explicit review remedy without submitting generation',async()=>{
  await renderFixture({cases:[row('one','PENDING_CONFIRMATION'),row('two','PENDING_CONFIRMATION')]},async({node,calls,html,navigations})=>{
    assert.ok(!/<section class="panel pw-workspace" hidden/.test(html));
    assert.match(html,/批量核对用例（2）/);assert.match(html,/<details class="pw-case-picker" id="pw-case-picker">/);
    assert.equal(node('#pw-prepare-ui').hidden,false);
    node('#pw-prepare-ui').onclick();
    assert.deepEqual(navigations,['#/projects/project-test/native-dsh']);
    assert.equal(node('#pw-generate-ui').hidden,false);assert.equal(node('#pw-generate-ui').disabled,true);
    assert.match(node('#pw-ui-blockers').innerHTML,/2 条用例正文尚未确认/);
    assert.match(node('#pw-ui-blockers').innerHTML,/批量核对并确认用例/);
    assert.ok(!calls.some(call=>call.options.method==='POST' && /\/script-operations$|\/generation-batches$|\/confirm-content$/.test(call.path)));
  });
});

test('selecting a pending case preserves that scope when preparing and cannot enable unrelated ready cases',async()=>{
  await renderFixture({cases:[row('ready'),row('pending','PENDING_CONFIRMATION')]},async({node,checks,navigations})=>{
    assert.equal(node('#pw-generate-ui').disabled,false);
    const pending=checks.find(input=>input.dataset.pwCase==='pending');pending.checked=true;pending.onchange();
    assert.equal(node('#pw-generate-ui').disabled,true);
    node('#pw-prepare-ui').onclick();
    assert.deepEqual(navigations,['#/projects/project-test/native-dsh?selected=pending']);
    assert.equal(node('#pw-generate-ui').disabled,true);assert.equal(node('#pw-generate-ui').textContent,'生成所选就绪脚本（0）');
    assert.match(node('#pw-ui-blockers').innerHTML,/selected=pending/);
    assert.match(node('#pw-ui-blockers').innerHTML,/1 条用例正文尚未确认/);
  });
});

test('shared login blocker keeps bulk generation visible above collapsed per-case preparation without duplicate login cards',async()=>{
  await renderFixture({cases:[row('one'),row('two')]},async({node,calls,html,navigations})=>{
    const generatePosition=html.indexOf('id="pw-generate-ui"'),readinessPosition=html.indexOf('id="pw-ui-readiness"');
    assert.ok(generatePosition>=0 && generatePosition<readinessPosition,'the batch action must precede per-case readiness');
    node('#pw-prepare-ui').onclick();
    assert.deepEqual(navigations,['#/projects/project-test/native-dsh']);
    assert.equal(node('#pw-generate-ui').hidden,false);
    assert.equal(node('#pw-generate-ui').disabled,true);
    assert.equal(node('#pw-generate-ui').textContent,'批量生成前端脚本（0）');
    const readiness=node('#pw-ui-readiness').innerHTML;
    assert.match(readiness,/2 条已确认用例 · 2 条需处理/);
    assert.match(readiness,/<details class="pw-case-picker"><summary>查看每条用例的生成准备（2 条）<\/summary>/);
    assert.doesNotMatch(readiness,/<details\b[^>]*\bopen(?:\s|=|>)/,'the native per-case details starts collapsed');
    assert.match(readiness,/<small>one<\/small>/);assert.match(readiness,/<small>two<\/small>/);
    assert.equal((readiness.match(/需要登录/g)||[]).length,2,'each case still exposes the actual readiness reason');
    assert.doesNotMatch(readiness,/data-pw-login|class="pw-gap"/,'the shared auth problem must not become repeated login cards');
    assert.equal((html.match(/id="pw-login"/g)||[]).length,1,'the top-level login entry remains available');
    assert.equal(node('#pw-login').hidden,false);assert.equal(typeof node('#pw-login').click,'function');
    assert.match(node('#pw-login-status').textContent,/专用浏览器登录/);
    // Calling the registered handler directly must still respect the auth barrier.
    await node('#pw-generate-ui').onclick();
    assert.ok(!calls.some(call=>call.options.method==='POST' && /\/script-operations$|\/generation-batches$/.test(call.path)));
  },{
    environment:{ui:{id:'shared-auth-env',auth_required:true,auth_role:'tester',ready:true},ui_environment_id:'shared-auth-env'},
    authSession:{status:'NOT_LOGGED_IN',verification_mode:'browser-page'},
    preflightReason:'AUTH_SESSION_NOT_LOGGED_IN',
  });
});
