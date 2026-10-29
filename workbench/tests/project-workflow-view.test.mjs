import test from 'node:test';
import assert from 'node:assert/strict';
import { currentUiItems,splitUiReadiness,backendGroups,backendBatchInput,backendGenerationBlock,preparationHtml,limitsHtml,renderProjectWorkflow,currentCaseItems,visibleWorkflowItems,workflowSelection,workflowRunState,workflowBackendPlans,workflowEnvironmentState,workflowNextAction } from '../web-v2/project-workflow.js';

test('an empty project needs no runnable-batch preflight and keeps execution disabled',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};
  const nodes=new Map(),calls=[];
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,options});
    if(path.endsWith('/batches/preflight'))return {ok:false,status:422,json:async()=>({error:'BATCH_CASES_REQUIRED'})};
    const body=path.endsWith('/environment')?{ui:null,backend:null}:path.includes('/preparation')?{items:[],protocols:[]}:path.endsWith('/generation-batches')?{batches:[]}:{};
    return {ok:true,status:200,json:async()=>body};
  };
  let dispose;
  try{
    dispose=await renderProjectWorkflow({project:{project_id:'empty-project',name:'空项目',cases:[]},showPage(){},isCurrent:()=>true});
    assert.ok(!calls.some(call=>call.path.endsWith('/batches/preflight')),'an empty selection is not a failed preparation request');
    assert.equal(nodes.get('#pw-run-error').textContent,'');
    assert.equal(nodes.get('#pw-run-selected').disabled,true);
    assert.ok(calls.every(call=>!call.options.method),'viewing an empty project must not start work');
  }finally{dispose?.();Object.assign(globalThis,original);}
});

test('visible workflow selection excludes hidden types and reports disjoint frontend/backend counts',()=>{
  const items=[{case_id:'ui-1',case_type:'UI'},{case_id:'be-1',case_type:'BACKEND'},{case_id:'ui-2',case_type:'UI'}],selected=new Set(['ui-1','be-1','ui-2']);
  assert.deepEqual(workflowSelection(items,selected),{ids:['ui-1','be-1','ui-2'],ui:2,backend:1});
  assert.deepEqual(workflowSelection(items,selected,'ui'),{ids:['ui-1','ui-2'],ui:2,backend:0});
  assert.deepEqual(visibleWorkflowItems(items,'backend'),[items[1]]);
});
test('generation records and stale previews never become execution readiness',()=>{
  const item={status:'CONFIRMED',case_version:2};
  for(const preview of [null,{case_version:2,state:'WAITING_HUMAN_REVIEW'},{case_version:2,state:'DRAFT'},{case_version:1,state:'QUEUED'},{case_version:2,state:'QUEUED',reason:'TRIAL_NOT_AUTHORIZED'}])assert.equal(workflowRunState(item,preview).ready,false);
  assert.equal(workflowRunState(item,{case_version:2,state:'QUEUED',reason:null}).ready,true);
  assert.equal(workflowRunState({...item,status:'PENDING_CONFIRMATION'},{case_version:2,state:'QUEUED'}).ready,false);
});

test('current generation scope uses only confirmed current versions and excludes backend',()=>{
  const row=(id,current,versions)=>({case_id:id,current_version:current,versions});
  const version=(number,status,type)=>({version:number,content:{status,case_type:type}});
  const items=currentUiItems({cases:[row('ui',2,[version(1,'CONFIRMED','UI'),version(2,'CONFIRMED','UI')]),row('pending',2,[version(1,'CONFIRMED','UI'),version(2,'PENDING_CONFIRMATION','UI')]),row('api',1,[version(1,'CONFIRMED','BACKEND')]),row('missing',1,[])]});
  assert.deepEqual(items.map(i=>[i.case_id,i.case_version]),[['ui',2]]);
});
test('an existing script or blocked item does not remove ready siblings',()=>{
  const items=[{case_id:'one',reason:null},{case_id:'two',reason:'SCRIPT_ALREADY_EXISTS'},{case_id:'three',reason:'AUTH_SESSION_REQUIRED'}];
  const groups=splitUiReadiness(items);
  assert.deepEqual(groups.ready,[items[0]]);assert.deepEqual(groups.existing,[items[1]]);assert.deepEqual(groups.blocked,[items[2]]);
});
test('failed records remain visible history while preflight decides whether a new generation is allowed',()=>{
  const failed={case_id:'failed',state:'QUEUED',reason:null,failed_script_records:[{task_id:'task-failed',reason:'HARNESS_MODEL_TRANSPORT_FAILED'}]};
  const existing={case_id:'approved',state:'BLOCKED',reason:'SCRIPT_ALREADY_EXISTS'};
  const unknown={case_id:'unknown',state:'BLOCKED',reason:null};
  const groups=splitUiReadiness([failed,existing,unknown]);
  assert.deepEqual(groups.ready,[failed]);assert.deepEqual(groups.existing,[existing]);
  assert.deepEqual(groups.failedHistory,[failed]);assert.deepEqual(groups.blocked,[unknown]);
});
test('project readiness distinguishes a failed generation from an existing reviewable script',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,location:globalThis.location};
  const nodes=new Map(),calls=[];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){},querySelectorAll(){return [];}});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={hash:'#/projects/p?prepare=ui&legacy=1'};
  const cases=['failed','approved'].map(case_id=>({case_id,current_version:1,versions:[{version:1,content:{status:'CONFIRMED',case_type:'UI',title:case_id,external_id:case_id}}]}));
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,options});
    let body={};
    if(path.endsWith('/environment'))body={ui:{id:'env'},ui_environment_id:'env'};
    else if(path.endsWith('/batches/preflight'))body={items:[{case_id:'failed',case_version:1,state:'BLOCKED',reason:'SCRIPT_GENERATION_FAILED'},{case_id:'approved',case_version:1,state:'BLOCKED',reason:'TRIAL_NOT_AUTHORIZED'}]};
    else if(path.endsWith('/script-operations/preflight'))body={items:JSON.parse(options.body).items.map(item=>item.case_id==='failed'?{...item,state:'QUEUED',reason:null,failed_script_records:[{task_id:'task-one',reason:'HARNESS_MODEL_TRANSPORT_FAILED'}]}:{...item,state:'BLOCKED',reason:'SCRIPT_ALREADY_EXISTS'})};
    else if(path.includes('/preparation'))body={items:[],protocols:[]};
    else if(path.endsWith('/generation-batches'))body={batches:[]};
    else if(path.endsWith('/script-operations'))body={operations:[]};
    return {ok:true,status:200,json:async()=>body};
  };
  let dispose;
  try {
    dispose=await renderProjectWorkflow({project:{project_id:'p',cases},showPage(){}});
    const html=node('#pw-ui-readiness').innerHTML;
    assert.match(html,/1 条待生成/);assert.match(html,/1 条已有脚本/);assert.match(html,/1 条有失败历史/);assert.equal((html.match(/>人工示范<\/a>/g)||[]).length,2,'existing scripts retain demonstration entry');
    assert.match(html,/上次失败，可重新生成/);assert.match(html,/失败记录：模型服务调用失败/);
    assert.match(html,/build-tasks\/task-one/);assert.equal(node('#pw-generate-ui').textContent,'批量生成前端脚本（1）');
    assert.equal(node('#pw-generate-ui').disabled,false);
    assert.equal(node('#pw-panel-ui').hidden,false);
    assert.match(node('#pw-run-table').innerHTML,/生成失败/);
    assert.match(node('#pw-run-table').innerHTML,/脚本生成未成功，请重新生成/);
    assert.match(node('#pw-run-table').innerHTML,/projects\/p\?prepare=ui">准备生成脚本/);
    assert.ok(!calls.some(call=>call.path.endsWith('/script-operations') && call.options.method==='POST'));
  }finally{dispose?.();Object.assign(globalThis,original);}
});
test('backend status classification is independent per case',()=>{
  const items=['READY','NEEDS_SUPPLEMENT','CONFLICT','UNSUPPORTED','EXISTS'].map(status=>({status}));
  const groups=backendGroups(items);assert.equal(Object.keys(groups).length,5);for(const status of Object.keys(groups))assert.deepEqual(groups[status],[items.find(i=>i.status===status)]);
});

test('project console shows a registered blocked draft instead of inviting first generation or claiming rerun readiness',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,location:globalThis.location};
  const nodes=new Map(),calls=[],node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){},querySelectorAll(){return [];}});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={hash:'#/projects/p'};
  const project={project_id:'p',cases:[{case_id:'c',current_version:1,versions:[{version:1,content_sha256:'abc',content:{status:'CONFIRMED',case_type:'UI',title:'blocked',external_id:'TC-024'}}]}]};
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,options});let body={};
    if(path.endsWith('/environment'))body={ui:{id:'env'},ui_environment_id:'env'};
    else if(path.endsWith('/batches/preflight'))body={items:[{case_id:'c',case_version:1,state:'BLOCKED',reason:'SCRIPT_MISSING'}]};
    else if(path.endsWith('/script-operations/preflight'))body={items:[{case_id:'c',case_version:1,state:'QUEUED',reason:null}]};
    else if(new URL(path,'http://localhost').pathname.endsWith('/native-dsh/console')){assert.equal(new URL(path,'http://localhost').searchParams.get('view'),'summary');body={project_id:'p',drafts:[{project_id:'p',case_id:'c',case_version:1,content_sha256:'abc',external_id:'TC-024',task_id:'t',draft_id:'draft-one',draft_status:'BLOCKED_PRECONDITION',blocker:{summary:'缺少授权园区'},source:{available:true},script_url:'/api/case-library/projects/p/native-dsh/tasks/t/files/draft-one-source'}]};}
    else if(path.includes('/preparation'))body={items:[],protocols:[]};
    else if(path.endsWith('/generation-batches'))body={batches:[]};
    else if(path.endsWith('/script-operations'))body={operations:[]};
    return {ok:true,status:200,json:async()=>body};
  };
  let dispose;
  try{
    dispose=await renderProjectWorkflow({project,showPage(){}});
    assert.match(node('#pw-native-console').innerHTML,/DSH 已登记稿件/);
    assert.match(node('#pw-run-table').innerHTML,/前置阻塞 · 未执行/);assert.match(node('#pw-run-table').innerHTML,/DSH 报告：缺少授权园区/);
    assert.match(node('#pw-selection-summary').textContent,/未执行稿件/);assert.doesNotMatch(node('#pw-native-console').innerHTML,/data-native-rerun-preview/);
    assert.doesNotMatch(node('#pw-ui-readiness').innerHTML,/1 条待生成/);
    assert.ok(!calls.some(call=>call.options.method==='POST' && !call.path.endsWith('/preflight')));
  }finally{dispose?.();Object.assign(globalThis,original);}
});
test('backend generation requires three explicit authorizations and operator identity',()=>{
  const preparation={preparation_sha256:'frozen',protocol_source_id:'protocol',items:[{status:'READY'},{status:'CONFLICT'}]};
  const authorization={requestId:'retry-same-id',reviewer:' operator ',modelConfirmed:true,httpConfirmed:true,analysisConfirmed:true};
  for(const flag of ['modelConfirmed','httpConfirmed','analysisConfirmed'])assert.throws(()=>backendBatchInput(preparation,{...authorization,[flag]:false}),/提交/);
  assert.throws(()=>backendBatchInput(preparation,{...authorization,reviewer:''}),/操作者/);
  assert.throws(()=>backendBatchInput({...preparation,items:[{status:'EXISTS'}]},authorization),/没有可生成/);
  assert.deepEqual(backendBatchInput(preparation,authorization),{request_id:'retry-same-id',preparation_sha256:'frozen',protocol_source_id:'protocol',reviewer:'operator',confirm_protocol_analysis:true,allow_model:true,allow_http_self_test:true});
});
test('preparation output escapes protocol diagnostics and shows missing step',()=>{
  const html=preparationHtml({items:[{status:'NEEDS_SUPPLEMENT',external_id:'<script>',title:'bad <img>',missing:[{step_order:2,message:'请补充 <body>'}]}]});
  assert.ok(html.includes('步骤 2'));assert.ok(html.includes('需补充'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(limitsHtml({wall_ms:120000,tool_calls:9}).includes('2 分钟'));assert.ok(limitsHtml({wall_ms:120000,tool_calls:9}).includes('9 次'));
});
test('backend preparation shows every status and preserves nearby missing diagnostics and actions',()=>{
  const html=preparationHtml({items:[{external_id:'ready-item',title:'complete title',status:'READY'},{external_id:'existing-item',status:'EXISTS'},{external_id:'missing-item',status:'NEEDS_SUPPLEMENT',missing:[{message:'补充字段'}]},{external_id:'conflict-item',status:'CONFLICT'},{external_id:'unsupported-item',status:'UNSUPPORTED'}]},{base:'#/projects/p'});
  for(const id of ['ready-item','existing-item','missing-item','conflict-item','unsupported-item'])assert.ok(html.includes(id));
  assert.ok(html.includes('complete title'));assert.ok(html.includes('补充字段'));assert.ok(html.includes('data-pw-protocol'));assert.ok(html.includes('核对执行计划'));
  assert.ok(!html.includes('pw-preparation-normal'));
});
test('project view prioritizes absent environment and performs no paid request',async()=>{
  const oldFetch=globalThis.fetch,oldDocument=globalThis.document,oldWindow=globalThis.window;
  const calls=[],nodes=new Map(),events=new Map();
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){}});return nodes.get(selector);}};
  globalThis.window={addEventListener:(name,handler)=>events.set(name,handler),removeEventListener:(name)=>events.delete(name)};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:null,backend:null};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};return {ok:true,status:200,json:async()=>body};};
  try{let html='';const dispose=await renderProjectWorkflow({project:{project_id:'p',name:'项目',cases:[]},showPage:value=>html=value,isCurrent:()=>true});assert.ok(html.includes('先配置环境'));assert.ok(html.includes('高级操作'));assert.ok(html.includes('运行所选用例'));assert.ok(html.includes('AI 用例助手'));assert.ok(html.includes('/import'));assert.ok(html.includes('/bindings'));assert.ok(html.includes('/execution-list'));assert.ok(!html.includes('此环境无需登录'));assert.ok(html.includes('pw-empty-backend'));assert.ok(html.includes('暂无后端用例'));assert.ok(html.includes('pw-recheck-backend'));assert.ok(html.indexOf('id="pw-protocol-select"')<html.indexOf('id="pw-generate-backend"'));assert.ok(html.indexOf('id="pw-generate-backend"')<html.indexOf('id="pw-backend-preparation"'));assert.equal(nodes.get('#pw-generate-ui').disabled,true);assert.equal(nodes.get('#pw-generate-backend').disabled,true);assert.ok(calls.every(call=>!call.options.method || call.path.endsWith('/batches/preflight')));assert.ok(events.has('hashchange'));dispose();assert.ok(!events.has('hashchange'));}
  finally{globalThis.fetch=oldFetch;globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
test('backend generation is blocked for unknown resource limits or unavailable model',()=>{
  const limits={generation:{wall_ms:120000,tool_calls:18,harness_starts:2,self_tests:2}};
  assert.equal(backendGenerationBlock({model_available:true,limits}),'');
  assert.match(backendGenerationBlock({model_available:false,limits}),/服务暂不可用/);
  assert.match(backendGenerationBlock({model_available:true}),/服务尚未就绪/);
  assert.match(backendGenerationBlock({limits:{generation:{wall_ms:120000}}}),/服务尚未就绪/);
});
test('valid login is reused, expiration restores login entry, and failed backend refresh blocks stale ready items',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};const calls=[],nodes=new Map();let status='VALID',backendFail=false,html='';
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,value:'',checked:false,addEventListener(){},querySelector:node,querySelectorAll(){return [];},remove(){}});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env',auth_required:true,auth_role:'admin'},ui_environment_id:'env',backend:{reviewer:'operator'}};else if(path.includes('/preflight'))body={items:[{case_id:'ui',case_version:1,reason:null}]};else if(path.includes('/preparation')){if(backendFail)throw Error('offline');body={items:[{status:'READY',case_id:'api'}],protocols:[],limits:{generation:{wall_ms:120000,tool_calls:18,harness_starts:2,self_tests:2}},model_available:true};}else if(path.endsWith('/generation-batches'))body={batches:[]};else if(path.includes('/auth?'))body={session:{status}};return {ok:true,status:200,json:async()=>body};};
  try{const dispose=await renderProjectWorkflow({project:{project_id:'p',cases:[{case_id:'ui',current_version:1,versions:[{version:1,content:{status:'CONFIRMED',case_type:'UI'}}]}]},showPage:value=>html=value});assert.equal(node('#pw-login-status').textContent,'登录有效');assert.equal(node('#pw-login').hidden,false);assert.equal(node('#pw-login').textContent,'查看登录浏览器');assert.equal(node('#pw-generate-ui').disabled,false);assert.ok(!calls.some(c=>c.path.endsWith('/auth/focus')));assert.ok(calls.some(c=>c.path.includes('/auth?environment_id=env&role=admin')));
    const root=node('#modal-root');root.firstElementChild=node('dialog');node('#pw-generate-backend').onclick();assert.equal((root.innerHTML.match(/type="checkbox"/g)||[]).length,0);assert.ok(!root.innerHTML.includes('费用'));assert.ok(root.innerHTML.includes('项目已选协议'));assert.ok(root.innerHTML.includes('value="operator"'));
    status='INVALID';await node('#pw-recheck-ui').onclick();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(node('#pw-login').hidden,false);assert.equal(node('#pw-generate-ui').disabled,true);
    backendFail=true;node('#pw-recheck-backend').onclick();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(node('#pw-generate-backend').disabled,true);assert.ok(node('#pw-backend-preparation').innerHTML.includes('可生成'));assert.ok(node('#pw-backend-gate').textContent.includes('仅供参考'));backendFail=false;node('#pw-recheck-backend').onclick();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(node('#pw-generate-backend').disabled,false);dispose();
  }finally{Object.assign(globalThis,originals);}
});
test('readiness checks split at 200 without starting generation',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};const calls=[],nodes=new Map();
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env',auth_required:false},ui_environment_id:'env'};else if(path.includes('/preflight'))body={items:JSON.parse(options.body).items.map(item=>({...item,reason:null}))};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};return {ok:true,status:200,json:async()=>body};};
  try{const cases=Array.from({length:201},(_,i)=>({case_id:`case-${i}`,current_version:1,versions:[{version:1,content:{case_type:'UI',status:'CONFIRMED'}}]}));const dispose=await renderProjectWorkflow({project:{project_id:'p',cases},showPage(){}});const checks=calls.filter(c=>c.path.includes('/script-operations/preflight'));assert.deepEqual(checks.map(c=>JSON.parse(c.options.body).items.length),[200,1]);assert.ok(nodes.get('#pw-ui-readiness').innerHTML.includes('本次处理前 200 条'));assert.ok(!calls.some(c=>c.path.endsWith('/script-operations') && c.options.method==='POST'));dispose();}
  finally{Object.assign(globalThis,originals);}
});
test('login checks use frozen environment role and cease when leaving the page',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};const calls=[],nodes=new Map(),timers=[];
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(name,handler){this[name]=handler;}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.setTimeout=handler=>{timers.push(handler);return timers.length;};globalThis.clearTimeout=()=>{};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env',auth_required:true,auth_role:'管理员'},ui_environment_id:'env'};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};else if(path.endsWith('/auth/check'))body={status:calls.filter(c=>c.path.endsWith('/auth/check')).length===1?'NOT_LOGGED_IN':'PENDING'};return {ok:true,status:200,json:async()=>body};};
  try{const dispose=await renderProjectWorkflow({project:{project_id:'p',cases:[]},showPage(){}});await nodes.get('#pw-login').click();assert.deepEqual(JSON.parse(calls.find(c=>c.path.endsWith('/auth/focus')).options.body),{environment_id:'env',role:'管理员'});timers[0]();await new Promise(resolve=>originals.setTimeout(resolve,0));assert.equal(calls.filter(c=>c.path.endsWith('/auth/check')).length,1);assert.equal(timers.length,2);dispose();timers[1]();await Promise.resolve();assert.equal(calls.filter(c=>c.path.endsWith('/auth/check')).length,1);assert.ok(!calls.some(c=>c.path.endsWith('/script-operations') && c.options.method==='POST'));}
  finally{Object.assign(globalThis,originals);}
});
test('stopping batches continue read-only polling and offer no second cancellation',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};const calls=[],nodes=new Map(),timers=[];
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.setTimeout=handler=>{timers.push(handler);return timers.length;};globalThis.clearTimeout=()=>{};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[{batch_id:'active',state:'STOPPING',items:[]}]};else if(path.endsWith('/active'))body={batch_id:'active',state:'STOPPING',items:[]};return {ok:true,status:200,json:async()=>body};};
  try{const dispose=await renderProjectWorkflow({project:{project_id:'p',cases:[]},showPage(){}});await new Promise(resolve=>originals.setTimeout(resolve,0));assert.equal(timers.length,1);assert.ok(!nodes.get('#pw-backend-batches').innerHTML.includes('data-pw-cancel'));assert.ok(calls.some(c=>c.path.endsWith('/active')));assert.ok(calls.every(c=>!c.options.method || c.path.endsWith('/batches/preflight')));dispose();timers[0]();await Promise.resolve();assert.equal(calls.filter(c=>c.path.endsWith('/active')).length,1);}
  finally{Object.assign(globalThis,originals);}
});
test('after login polling expires, retry requests focus of the existing browser without starting generation',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};const calls=[],nodes=new Map(),timers=[];let loggedIn=false;
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(name,handler){this[name]=handler;}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.setTimeout=handler=>{timers.push(handler);return timers.length;};globalThis.clearTimeout=()=>{};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env',auth_required:true,auth_role:'admin'},ui_environment_id:'env'};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};else if(path.includes('/auth?'))body={session:{status:loggedIn?'VALID':'NOT_LOGGED_IN'}};else if(path.endsWith('/auth/focus'))body={status:loggedIn?'VALID':'AWAITING_LOGIN'};else if(path.endsWith('/auth/check'))body={status:loggedIn?'VALID':calls.filter(c=>c.path.endsWith('/auth/check')).length===1?'NOT_LOGGED_IN':'AWAITING_LOGIN'};return {ok:true,status:200,json:async()=>body};};
  try{const dispose=await renderProjectWorkflow({project:{project_id:'p',cases:[]},showPage(){}});await nodes.get('#pw-login').click();assert.equal(calls.filter(c=>c.path.endsWith('/auth/focus')).length,1);for(let i=0;i<60;i++){assert.ok(timers[i]);timers[i]();await new Promise(resolve=>originals.setTimeout(resolve,0));}assert.equal(nodes.get('#pw-login').disabled,false);loggedIn=true;await nodes.get('#pw-login').click();assert.equal(calls.filter(c=>c.path.endsWith('/auth/focus')).length,2);assert.equal(nodes.get('#pw-login').hidden,false);assert.ok(!calls.some(c=>c.path.includes('/script-operations/preflight')));dispose();}
  finally{Object.assign(globalThis,originals);}
});
test('browser-page login waits for explicit confirmation without polling or starting generation',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};const calls=[],nodes=new Map(),timers=[];let status='NOT_LOGGED_IN';
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(name,handler){this[name]=handler;}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.setTimeout=handler=>{timers.push(handler);return timers.length;};globalThis.clearTimeout=()=>{};
  const session=()=>({status,verification_mode:'browser-page',account_id:null});
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env',auth_required:true,auth_role:'tester'},ui_environment_id:'env'};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};else if(path.includes('/auth?'))body={session:session()};else if(path.endsWith('/auth/focus')){status='AWAITING_LOGIN';body=session();}else if(path.endsWith('/auth/check')){if(JSON.parse(options.body).confirm_login)status='VALID';body=session();}return {ok:true,status:200,json:async()=>body};};
  try{
    const dispose=await renderProjectWorkflow({project:{project_id:'p',cases:[]},showPage(){}});
    await nodes.get('#pw-login').click();assert.equal(nodes.get('#pw-login-check').hidden,false);assert.equal(timers.length,0);assert.equal(nodes.get('#pw-generate-ui').disabled,true);
    await nodes.get('#pw-login-check').click();assert.equal(nodes.get('#pw-login-status').textContent,'页面访问已确认');assert.equal(nodes.get('#pw-login-check').hidden,true);
    assert.ok(calls.some(c=>c.path.endsWith('/auth/check') && JSON.parse(c.options.body).confirm_login===true));
    assert.ok(!calls.some(c=>c.options.method==='POST' && /\/script-operations$|\/batches$/.test(c.path)));dispose();
  }finally{Object.assign(globalThis,originals);}
});
test('leaving while the browser opens prevents subsequent checks and generation',async()=>{
  const originals={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};const calls=[],nodes=new Map();let resolveCheck;
  globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(name,handler){this[name]=handler;}});return nodes.get(selector);}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env',auth_required:true,auth_role:'admin'},ui_environment_id:'env'};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};else if(path.endsWith('/auth/focus'))await new Promise(resolve=>resolveCheck=resolve);return {ok:true,status:200,json:async()=>path.endsWith('/auth/focus')?{status:'NOT_LOGGED_IN'}:body};};
  try{const dispose=await renderProjectWorkflow({project:{project_id:'p',cases:[]},showPage(){}});const login=nodes.get('#pw-login').click();dispose();resolveCheck();await login;assert.equal(calls.filter(c=>c.path.endsWith('/auth/focus')).length,1);assert.ok(!calls.some(c=>c.path.endsWith('/auth/check')));assert.ok(!calls.some(c=>c.path.endsWith('/script-operations') && c.options.method==='POST'));}
  finally{Object.assign(globalThis,originals);}
});

test('switching test tabs preserves inputs and old-version running receipts without submitting a run or carrying hidden type selections',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};const nodes=new Map(),calls=[],runs=[],navigation=[];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,value:'',disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},addEventListener(){},querySelector:node});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};
  const receipt={operation_id:'op-switch',state:'RUNNING',created_at:'2026-10-05T01:00:00Z',items:[{state:'RUNNING',external_id:'UI-1'}]};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});const body=path.endsWith('/environment')?{ui:{id:'env'},ui_environment_id:'env'}:path.endsWith('/preflight')?{items:[]}:path.includes('/preparation')?{items:[],protocols:[]}:path.endsWith('/generation-batches')?{batches:[]}:path.endsWith('/script-operations')?{operations:[receipt]}:receipt;return {ok:true,status:200,json:async()=>body};};
  let dispose;
  try{const project={project_id:'p-switch',cases:[]};let html='';dispose=await renderProjectWorkflow({project,showPage:value=>html=value,launchBatch:(...args)=>runs.push(args),go:value=>navigation.push(value)});assert.doesNotMatch(html,/<section class="panel pw-workspace" hidden/);await new Promise(resolve=>setImmediate(resolve));
    const before=calls.length,progress=node('#pw-ui-progress').innerHTML;node('#pw-protocol-select').value='chosen-protocol';
    node('#pw-tab-backend').onclick();assert.equal(node('#pw-panel-ui').hidden,true);assert.equal(node('#pw-panel-backend').hidden,true);assert.equal(node('#pw-panel-all').hidden,false);assert.equal(node('#pw-tab-backend').attributes['aria-selected'],'true');
    node('#pw-tab-ui').onclick();assert.equal(node('#pw-panel-ui').hidden,true);node('#pw-prepare-ui').onclick();assert.deepEqual(navigation,['#/projects/p-switch/native-dsh']);assert.equal(node('#pw-panel-ui').hidden,true);assert.equal(node('#pw-protocol-select').value,'chosen-protocol');assert.equal(node('#pw-ui-progress').innerHTML,progress);assert.equal(calls.length,before);assert.equal(node('#pw-generate-ui').disabled,true);
    node('#pw-run-selected').onclick();assert.deepEqual(runs,[]);assert.ok(!calls.some(c=>c.options.method==='POST' && c.path.endsWith('/script-operations')));
  }finally{dispose?.();Object.assign(globalThis,original);}
});

test('unknown backend batch state blocks generation and recheck restores its existing operation',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};const nodes=new Map(),calls=[];let unavailable=true;
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',disabled:false,addEventListener(){},querySelector:node});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};
  const batch={batch_id:'known-batch',state:'RUNNING',items:[{state:'GENERATING',external_id:'BE-1'}]};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={backend:{id:'env'}};else if(path.includes('/preparation'))body={items:[{status:'READY'}],protocols:[],model_available:true,limits:{generation:{wall_ms:60000,tool_calls:20,harness_starts:1,self_tests:1}}};else if(path.endsWith('/generation-batches')){if(unavailable)throw Error('offline');body={batches:[batch]};}else if(path.endsWith('/known-batch'))body=batch;return {ok:true,status:200,json:async()=>body};};
  let dispose;
  try{dispose=await renderProjectWorkflow({project:{project_id:'p-unknown-batch',cases:[]},showPage(){}});assert.equal(node('#pw-generate-backend').disabled,true);assert.match(node('#pw-backend-gate').textContent,/无法读取生成进度/);node('#pw-generate-backend').onclick();assert.ok(!nodes.has('#modal-root'));
    unavailable=false;node('#pw-recheck-backend').onclick();await new Promise(resolve=>setImmediate(resolve));assert.match(node('#pw-backend-progress').innerHTML,/正在生成脚本/);assert.equal(node('#pw-generate-backend').disabled,true);assert.ok(calls.every(c=>!c.options.method || c.path.endsWith('/batches/preflight')));
  }finally{dispose?.();Object.assign(globalThis,original);}
});

test('stage conflicts lead to case revision instead of asking for an already complete protocol',()=>{
  const html=preparationHtml({items:[{case_id:'case-old',case_version:1,status:'NEEDS_SUPPLEMENT',title:'初始化与清理',missing:[{code:'BACKEND_CASE_STAGE_CONFLICT',step_order:6,message:'请先修订用例'}]}]}, {base:'#/projects/project-one'});
  assert.match(html,/需修订用例/); assert.match(html,/tab=content/); assert.match(html,/修订用例<\/a>/);
  assert.doesNotMatch(html,/data-pw-protocol/);
});

test('daily table runs explicit mixed selections, clears them on type changes, and excludes hidden backend IDs',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window},nodes=new Map(),calls=[],runs=[],navigation=[];
  const cases=[['u1','UI','前端正常'],['u2','UI','前端待登录'],['b1','BACKEND','后端正常']].map(([case_id,case_type,title])=>({case_id,current_version:1,versions:[{version:1,content:{case_type,title,external_id:case_id,status:'CONFIRMED'}}]}));
  const preview=[{case_id:'u1',case_version:1,state:'QUEUED'},{case_id:'u2',case_version:1,state:'BLOCKED',reason:'AUTH_SESSION_REQUIRED'},{case_id:'b1',case_version:1,state:'QUEUED'}];
  const node=selector=>{if(!nodes.has(selector)){const value={textContent:'',hidden:false,disabled:false,value:'',attributes:{},addEventListener(){},setAttribute(name,value){this.attributes[name]=value;},querySelectorAll(selector){return selector==='[data-pw-case]'?this.inputs || []:[];}};let html='';Object.defineProperty(value,'innerHTML',{get:()=>html,set:text=>{html=text;value.inputs=[...text.matchAll(/<input type="checkbox" data-pw-case="([^"]+)"[^>]*>/g)].map(match=>({dataset:{pwCase:match[1]},checked:/\schecked[ >]/.test(match[0])}));}});nodes.set(selector,value);}return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};if(path.endsWith('/environment'))body={ui:{id:'env'},ui_environment_id:'env',backend:{id:'be'}};else if(path.endsWith('/batches/preflight'))body={items:preview};else if(path.endsWith('/script-operations/preflight'))body={items:JSON.parse(options.body).items.map(item=>({...item,reason:'SCRIPT_ALREADY_EXISTS'}))};else if(path.includes('/preparation'))body={items:[],protocols:[]};else if(path.endsWith('/generation-batches'))body={batches:[]};else if(path.endsWith('/script-operations'))body={operations:[]};return {ok:true,status:200,json:async()=>body};};
  let dispose;
  try{
    const project={project_id:'p-selected-v2',name:'项目',cases};dispose=await renderProjectWorkflow({project,showPage(){},launchBatch:(...args)=>runs.push(args),go:value=>navigation.push(value)});
    assert.equal(node('#pw-tab-all').attributes['aria-selected'],'true');assert.equal(node('#pw-run-selected').disabled,true);assert.match(node('#pw-run-table').innerHTML,/前端待登录/);assert.match(node('#pw-run-table').innerHTML,/需登录/);
    node('#pw-run-selected').onclick();assert.equal(runs.length,0);
    node('#pw-select-ready').onclick();assert.equal(node('#pw-selection-summary').textContent,'已选择 2 条：前端 1 条，后端 1 条');node('#pw-run-selected').onclick();assert.deepEqual(runs[0],[project,'selected',['u1','b1']]);
    node('#pw-tab-ui').onclick();assert.equal(node('#pw-run-selected').disabled,true);assert.match(node('#pw-selection-summary').textContent,/请选择本次要运行/);assert.ok(!node('#pw-run-table').innerHTML.includes('后端正常'));
    assert.equal(node('#pw-panel-all').hidden,false);assert.equal(node('#pw-panel-ui').hidden,true);
    node('#pw-prepare-ui').onclick();assert.deepEqual(navigation,['#/projects/p-selected-v2/native-dsh']);assert.equal(node('#pw-panel-ui').hidden,true);assert.equal(node('#pw-panel-all').hidden,false);
    node('#pw-back-to-cases').onclick();assert.equal(node('#pw-panel-all').hidden,false);assert.equal(node('#pw-panel-ui').hidden,true);assert.equal(node('#pw-generation-footer').hidden,true);assert.equal(node('#pw-tab-ui').attributes['aria-selected'],'true');
    node('#pw-select-ready').onclick();assert.equal(node('#pw-selection-summary').textContent,'已选择 1 条：前端 1 条，后端 0 条');node('#pw-run-selected').onclick();assert.deepEqual(runs[1],[project,'selected',['u1']]);
    const blocked=node('#pw-run-table').inputs.find(input=>input.dataset.pwCase==='u2');blocked.checked=true;blocked.onchange();assert.equal(node('#pw-selection-summary').textContent,'已选择 2 条：前端 2 条，后端 0 条');node('#pw-run-selected').onclick();assert.deepEqual(runs[2],[project,'selected',['u1','u2']]);
    node('#pw-tab-all').onclick();assert.equal(node('#pw-run-selected').disabled,true);assert.ok(calls.every(call=>!call.options.method || call.path.endsWith('/preflight')));
  }finally{dispose?.();Object.assign(globalThis,original);}
});


test('backend return restores only visible case selections and exposes run confirmation without opening preparation',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,location:globalThis.location};
  const nodes=new Map(),runs=[],calls=[];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,disabled:false,setAttribute(){},addEventListener(){},querySelectorAll(){return [];}});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.location={hash:'#/projects/p?test_type=backend&selected=b1,u1,unknown'};
  const cases=[['b1','BACKEND'],['b2','BACKEND'],['u1','UI']].map(([case_id,case_type])=>({case_id,current_version:1,versions:[{version:1,content:{case_type,status:'CONFIRMED',external_id:case_id,title:case_id}}]}));
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};
    if(path.endsWith('/environment'))body={backend:{id:'env'}};
    else if(path.endsWith('/batches/preflight'))body={items:[{case_id:'b1',case_version:1,state:'QUEUED'},{case_id:'b2',case_version:1,state:'BLOCKED',reason:'BACKEND_PLAN_REVIEW_REQUIRED'}]};
    else if(path.endsWith('/backend'))body={plans:[{case_id:'b1',case_version:1,state:'CONFIRMED'},{case_id:'b2',case_version:1,state:'DRAFT'}]};
    else if(path.includes('/preparation'))body={items:[],protocols:[]};
    else if(path.endsWith('/generation-batches'))body={batches:[]};
    return {ok:true,status:200,json:async()=>body};};
  let dispose;
  try{
    const project={project_id:'p',cases};dispose=await renderProjectWorkflow({project,showPage(){},launchBatch:(...args)=>runs.push(args)});
    assert.equal(node('#pw-panel-all').hidden,false);assert.equal(node('#pw-panel-backend').hidden,true);
    assert.equal(node('#pw-prepare-ui').hidden,true);assert.equal(node('#pw-run-selected').disabled,false);
    assert.equal(node('#pw-selection-summary').textContent,'已选择 1 条：前端 0 条，后端 1 条');
    const html=node('#pw-run-table').innerHTML;
    assert.doesNotMatch(html,/data-pw-demo/);assert.equal(node('#pw-review-backend').disabled,true);
    node('#pw-tab-all').onclick();node('#pw-tab-backend').onclick();assert.equal(node('#pw-review-backend').disabled,false);assert.equal(node('#pw-review-backend').textContent,'批量核对计划（1）');node('#pw-select-ready').onclick();
    assert.match(html,/data-pw-run="b1"/);assert.doesNotMatch(html,/data-pw-run="b2"/);assert.match(html,/待核对计划/);
    assert.match(html,/return=/);assert.match(decodeURIComponent(html),/test_type=backend&selected=b1/);
    node('#pw-run-selected').onclick();assert.deepEqual(runs,[[project,'selected',['b1']]]);
    node('#pw-prepare-backend').onclick();assert.equal(node('#pw-panel-backend').hidden,false);
    node('#pw-back-to-cases').onclick();assert.equal(node('#pw-panel-all').hidden,false);assert.equal(node('#pw-run-selected').disabled,false);
    assert.ok(calls.every(call=>!call.options.method || call.path.endsWith('/preflight')));
  }finally{dispose?.();Object.assign(globalThis,original);}
});

test('confirmed backend plans are not pending review and still require explicit version choice',()=>{
  const item={case_id:'api',case_version:2,status:'CONFIRMED',case_type:'BACKEND'};
  const preview={case_id:'api',case_version:2,state:'BLOCKED',reason:'SCRIPT_SELECTION_REQUIRED'};
  const plans=[{case_id:'api',case_version:2,version:2,state:'CONFIRMED'},{case_id:'api',case_version:2,version:1,state:'FAILED'},{case_id:'api',case_version:1,version:3,state:'DRAFT'}];
  const state=workflowRunState(item,preview,plans);
  assert.equal(state.ready,false);assert.equal(state.label,'已确认 · 待选版本');assert.match(state.reason,/P2 已确认.*无需重复核对/);
  assert.equal(workflowBackendPlans(item,plans).pending.length,0);
  assert.equal(workflowNextAction([item],[preview],{backend:{base_url:'http://local'}},{type:'backend',plans}).action,'choose');
  assert.equal(workflowRunState({...item,case_version:3},preview,plans).label,'版本需重查');
});

test('saved configuration is not connection success and unavailable frontend stays visible',()=>{
  const env={ui_status:'CONFIGURED',ui:{entry_url:'http://local',ready:false,reason:'GENERATION_TARGET_UNREACHABLE'},backend_status:'CONFIGURED',backend:{base_url:'http://local'}};
  const [ui,backend]=workflowEnvironmentState(env);
  assert.equal(ui.tone,'warning');assert.match(ui.label,/地址无法访问/);
  assert.equal(backend.tone,'neutral');assert.match(backend.label,/配置已保存.*连接未检查/);
  assert.equal(workflowEnvironmentState({ui:{ready:true}},'ui')[0].tone,'success');
  assert.equal(workflowEnvironmentState({ui:{ready:true},ui_status:'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED'},'ui')[0].tone,'warning');
  assert.equal(workflowEnvironmentState({},'backend')[0].tone,'warning');
});

test('next action prioritizes actual blockers without starting generation or running tests',()=>{
  const item={case_id:'ui',case_version:1,status:'CONFIRMED',case_type:'UI'};
  const env={ui:{ready:true}};
  const p=reason=>[{case_id:'ui',case_version:1,state:reason?'BLOCKED':'QUEUED',reason}];
  assert.equal(workflowNextAction([item],p('SCRIPT_MISSING'),{}).action,'environment');
  assert.equal(workflowNextAction([item],p('SCRIPT_MISSING'),env).action,'ui');
  assert.equal(workflowNextAction([item],p('TRIAL_NOT_AUTHORIZED'),env).action,'case');
  assert.equal(workflowNextAction([item],p('SCRIPT_SELECTION_REQUIRED'),env).action,'choose');
  assert.equal(workflowNextAction([item],p(null),env),null);
  assert.equal(workflowNextAction([item],p(null),env,{checking:true}).action,'wait');
  assert.equal(workflowNextAction([item],p(null),env,{error:'offline'}).action,'recheck');
  assert.equal(workflowNextAction([{...item,status:'DRAFT'}],p(null),env).action,'cases');
  assert.equal(workflowNextAction([],[],env).action,'import');
});


test('ordinary frontend preparation routes straight to DSH with selected frontend IDs and never submits generation',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,location:globalThis.location};
  const calls=[],navigation=[];
  globalThis.location={hash:'#/projects/p?prepare=ui&selected=u1,b1'};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.document={querySelector(){throw Error('No old preparation UI should mount');}};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});return {ok:true,status:200,json:async()=>({ui:{id:'env'},ui_environment_id:'env'})};};
  const cases=[['u1','UI'],['b1','BACKEND']].map(([case_id,case_type])=>({case_id,current_version:1,versions:[{version:1,content:{case_type,status:'CONFIRMED'}}]}));
  try{const dispose=await renderProjectWorkflow({project:{project_id:'p',cases},showPage(){assert.fail('Old prepare UI');},go:value=>navigation.push(value)});
    assert.deepEqual(navigation,['#/projects/p/native-dsh?selected=u1']);assert.equal(calls.length,1);assert.equal(calls[0].options.method,undefined);dispose();
  }finally{Object.assign(globalThis,original);}
});

test('an active project task turns generation entries into a read-only return to the original progress',async()=>{
  const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,location:globalThis.location};
  const nodes=new Map(),navigation=[],calls=[];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},querySelectorAll(){return [];}});return nodes.get(selector);};
  globalThis.document={querySelector:node};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={hash:'#/projects/p?selected=u1'};
  globalThis.fetch=async(path,options={})=>{calls.push({path,options});let body={};
    if(path.endsWith('/environment'))body={ui:{id:'env'},ui_environment_id:'env'};
    else if(path.includes('/native-dsh/console'))body={project_id:'p',tasks:[{task_id:'existing-task',status:'RUNNING'}],records:[],scripts:[]};
    else if(path.endsWith('/batches/preflight'))return {ok:false,status:409,json:async()=>({error:'WORKBENCH_BUSY'})};
    else if(path.endsWith('/generation-batches'))body={batches:[]};
    return {ok:true,status:200,json:async()=>body};};
  let dispose;
  try{
    const project={project_id:'p',cases:[{case_id:'u1',current_version:1,versions:[{version:1,content:{external_id:'u1',case_type:'UI',status:'CONFIRMED'}}]}]};
    dispose=await renderProjectWorkflow({project,showPage(){},go:path=>navigation.push(path)});
    assert.equal(node('#pw-native-dsh').textContent,'查看当前测试进度');assert.equal(node('#pw-native-dsh').attrs.href,'#/projects/p/native-dsh');
    assert.equal(node('#pw-prepare-ui').textContent,'查看前端生成进度');assert.equal(node('#pw-run-selected').disabled,true);assert.equal(node('#pw-run-error').textContent,'');
    node('#pw-prepare-ui').onclick();assert.deepEqual(navigation,['#/projects/p/native-dsh']);
    assert.ok(calls.every(call=>!call.options.method||call.path.endsWith('/preflight')),'opening progress never submits a generation request');
  }finally{dispose?.();Object.assign(globalThis,original);}
});
