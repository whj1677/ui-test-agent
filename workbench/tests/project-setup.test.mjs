import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {setupValues,setupRequests,projectSetupHtml,renderProjectSetup} from '../web-v2/project-setup.js';

const project={name:'练习项目',cases:[{current_version:1,versions:[{version:1,content:{case_type:'UI'}}]}]};
const environment={revision:4,ui_environment_id:'ui-old',backend_environment_id:'api-old',ui:{name:'旧环境',entry:'http://127.0.0.1:4401/ledger/',auth_required:false},backend:{base_url:'http://127.0.0.1:4401',mode:'synthetic-namespace',reviewer:'tester'}};

test('renaming readonly environment preserves reviewed queries, changing host requires new query registration',()=>{
 const queries=[{path:'/api/page',protocol_source_id:'source-1',protocol_sha256:'a'.repeat(64),readonly_reviewed:true,body_schema:{type:'object'}}];
 const saved={...environment,backend:{...environment.backend,mode:'http-json-readonly',allowed_path_prefixes:['/api/'],read_only_post_queries:queries}};
 const initial=setupValues(project,saved);
 assert.equal(setupRequests({...initial,authorized:false},initial,saved).backend,null);
 const renamed=setupRequests({...initial,allowed_path_prefixes:['/api/','/other/'],authorized:true},initial,saved);
 assert.deepEqual(renamed.backend.read_only_post_queries,queries);
 assert.notEqual(renamed.backend.read_only_post_queries,queries);
 const moved=setupRequests({...initial,backend_url:'http://127.0.0.1:9999',authorized:true},initial,saved);
 assert.equal(Object.hasOwn(moved.backend,'read_only_post_queries'),false);
 assert.match(projectSetupHtml(project,saved,initial),/已登记 1 个/);
});
test('unchanged project setup preserves both immutable targets without requiring another authorization',()=>{
  const initial=setupValues(project,environment);
  const plan=setupRequests({...initial,authorized:false},initial,environment);
  assert.equal(plan.ui,null);assert.equal(plan.backend,null);
  assert.deepEqual(plan.binding,{revision:4,ui_environment_id:'ui-old',backend_environment_id:'api-old'});
});
test('unused login draft fields cannot create a new anonymous environment',()=>{
  const initial=setupValues(project,environment);
  const plan=setupRequests({...initial,login_url:'invalid draft',identity_url:'https://unused.example.com/check',role:'another',authorized:false},initial,environment);
  assert.equal(plan.ui,null);assert.equal(plan.backend,null);
});

test('optional namespace prefix is frozen only for synthetic environments and blank restores the default',()=>{
  const initial=setupValues(project,environment);
  const values={...initial,run_id_prefix:'qa-20261008',authorized:true};
  const plan=setupRequests(values,initial,environment);
  assert.equal(plan.ui,null);assert.equal(plan.backend.run_id_prefix,'qa-20261008');
  const stored={...environment,backend:{...environment.backend,namespace:{run_id_prefix:'qa-20261008'}}};
  const reopened=setupValues(project,stored);
  assert.equal(setupRequests({...reopened,authorized:false},reopened,stored).backend,null);
  assert.equal(Object.hasOwn(setupRequests({...reopened,run_id_prefix:'',authorized:true},reopened,stored).backend,'run_id_prefix'),false);
  for(const run_id_prefix of ['../other','UPPER','x'.repeat(27)])assert.throws(()=>setupRequests({...values,run_id_prefix},initial,environment),/编号前缀/);
  const readonly=setupRequests({...values,backend_mode:'http-json-readonly',allowed_path_prefixes:['/api/']},initial,environment);
  assert.equal(Object.hasOwn(readonly.backend,'run_id_prefix'),false);
});
test('frontend login needs no identity endpoint and preserves backend binding and existing API setup',()=>{
  const initial=setupValues(project,environment);
  const values={...initial,login_required:true,authorized:true,operator:'tester'};
  const plan=setupRequests(values,initial,environment);
  assert.equal(plan.ui.login_url,initial.base_url);assert.equal(plan.ui.login_required,true);assert.equal(plan.ui.role,'tester');
  assert.equal(Object.hasOwn(plan.ui,'identity_url'),false);
  assert.equal(plan.backend,null);assert.equal(plan.binding.backend_environment_id,'api-old');
  const existing={...initial,login_required:true,identity_url:'http://127.0.0.1:4401/api/identity'};
  assert.equal(setupRequests({...existing,name:'renamed',authorized:true},existing,environment).ui.identity_url,existing.identity_url);
  assert.equal(Object.hasOwn(setupRequests({...existing,base_url:'http://192.168.1.249:18081/control-electricity-price/config',authorized:true},existing,environment).ui,'identity_url'),false);
});
test('a new environment cannot be created without operator and explicit local authorization',()=>{
  const initial=setupValues(project,{ui:null,backend:null,revision:0,ui_environment_id:null,backend_environment_id:null});
  const values={...initial,base_url:'http://127.0.0.1:4401',authorized:true};
  assert.throws(()=>setupRequests(values,initial,{}),/操作者/);
  assert.throws(()=>setupRequests({...values,operator:'tester',authorized:false},initial,{}),/获准/);
});
test('readonly backend setup requires request scope and retains UI target',()=>{
  const initial=setupValues(project,environment),values={...initial,backend_mode:'http-json-readonly',authorized:true};
  assert.throws(()=>setupRequests(values,initial,environment),/允许路径/);
  const plan=setupRequests({...values,allowed_path_prefixes:['/api/']},initial,environment);
  assert.equal(plan.ui,null);assert.equal(plan.binding.ui_environment_id,'ui-old');assert.deepEqual(plan.backend.allowed_path_prefixes,['/api/']);
});
test('registered login fields survive reopening and runtime-only labels are not treated as URL values',()=>{
  const initial=setupValues(project,{...environment,ui:{name:'已登录环境',entry:'运行时启动',auth_required:true,auth_role:'editor'}},[{environment_id:'ui-old',entry_url:'https://test.example.com/app/',path_prefix:'/app/',login_url:'https://test.example.com/login',identity_url:'https://test.example.com/api/identity',role:'editor',operator:'reviewer'}]);
  assert.equal(initial.base_url,'https://test.example.com/app/');assert.equal(initial.role,'editor');assert.equal(initial.operator,'reviewer');
  assert.equal(setupRequests({...initial,authorized:false},initial,environment).ui,null);
  assert.equal(setupValues(project,{...environment,ui:{entry:'运行时启动'}}).base_url,'');
});
test('disabling one test purpose clears only that project binding',()=>{
  const initial=setupValues(project,environment);
  const plan=setupRequests({...initial,backend_enabled:false},initial,environment);
  assert.equal(plan.ui,null);assert.equal(plan.binding.ui_environment_id,'ui-old');assert.equal(plan.binding.backend_environment_id,null);
  assert.throws(()=>setupRequests({...initial,ui_enabled:false,backend_enabled:false},initial,environment),/至少一种/);
});

test('first-use settings distinguish unsaved configuration from login verification',()=>{
  const empty={revision:0,ui_environment_id:null,backend_environment_id:null,ui:null,backend:null};
  const html=projectSetupHtml({...project,project_id:'p'},empty,setupValues(project,empty));
  assert.ok(html.includes('配置测试环境'));
  assert.ok(html.includes('aria-current="step"'));
  for(const text of ['配置环境','准备测试用例','生成脚本','运行与结果','账号由你登录','尚未保存','未配置前端','保存环境并不代表已经登录','我已登录，检查页面'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('name="identity_url"'));
  assert.ok(!html.includes('登录状态校验地址'));
  assert.ok(html.indexOf('name="name"')<html.indexOf('name="base_url"'));
  assert.ok(html.includes('name="operator"'));assert.ok(html.includes('name="authorized"'));
  assert.ok(html.includes('<details class="setup-advanced">'));
  assert.ok(!html.includes('setup-advanced" open'));
  assert.ok(html.includes('#/projects/p/cases'));assert.ok(html.includes('#/projects/p/environment-advanced'));assert.ok(html.includes('#/projects/p/execution-records'));
  assert.ok(!html.includes('type="password"'));
});

test('reopened settings expose saved fixed addresses while keeping login unverified',()=>{
  const saved={...environment,ui:{...environment.ui,auth_required:true}};
  const values=setupValues(project,saved);
  const html=projectSetupHtml({...project,project_id:'<p>'},saved,{...values,name:'<script>alert(1)</script>'});
  assert.ok(html.includes('当前项目环境'));assert.ok(html.includes('已保存 · 下方修改仅在保存后生效'));
  assert.ok(html.includes(values.base_url));assert.ok(html.includes(values.backend_url));assert.ok(html.includes('待检查'));
  assert.ok(!html.includes('登录有效'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('#/projects/%3Cp%3E/cases'));
});

test('save conflict preserves dirty draft and retries registered target without duplicating it',async()=>{
  // In-memory DOM and API only: this test does not start a workbench or visit a target.
  const old={fetch:globalThis.fetch,document:globalThis.document,FormData:globalThis.FormData};
  const empty={revision:0,ui_environment_id:null,backend_environment_id:null,ui:null,backend:null};
  const controls=new Map(),listeners=new Map(),calls=[],dirty=[],navigations=[];
  const values={...setupValues(project,empty),base_url:'https://test.example.com',operator:'tester',authorized:true};
  for(const [name,value] of Object.entries(values))controls.set(name,{name,value:name==='login_required'?'no':value,checked:Boolean(value),disabled:false,closest(){return null;}});
  const submit={disabled:false},status={textContent:'',className:''},bindingStatus={textContent:''};
  const sections=new Map(['[data-setup-ui]','[data-setup-auth]','[data-setup-backend]','[data-setup-paths]'].map(key=>[key,{hidden:false,querySelectorAll(){return [];}}]));
  const form={isConnected:true,elements:{namedItem:name=>controls.get(name)},querySelector(selector){return selector==='[type=submit]'?submit:selector==='#project-setup-status'?status:sections.get(selector);},querySelectorAll(selector){return selector==='[data-setup-ui],[data-setup-backend]'?[sections.get('[data-setup-ui]'),sections.get('[data-setup-backend]')]:[...controls.values(),submit];},addEventListener(name,handler){listeners.set(name,handler);}};
  globalThis.document={querySelector:selector=>selector==='#project-setup-form'?form:selector==='#setup-binding-status'?bindingStatus:null};
  globalThis.FormData=class{constructor(){this.data=new Map([...controls].filter(([name,c])=>!c.disabled&&(!['ui_enabled','backend_enabled','authorized'].includes(name)||c.checked)).map(([name,c])=>[name,Array.isArray(c.value)?c.value.join('\n'):String(c.value)]));}has(name){return this.data.has(name);}get(name){return this.data.get(name);}};
  let bindingAttempts=0;
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,options});
    if(!options.method)return {ok:true,status:200,json:async()=>path.endsWith('/environment')?empty:{targets:[]}};
    if(path.endsWith('/targets'))return {ok:true,status:200,json:async()=>({environment_id:'saved-once'})};
    bindingAttempts++;return bindingAttempts===1?{ok:false,status:409,json:async()=>({error:'PROJECT_ENVIRONMENT_REVISION_CONFLICT'})}:{ok:true,status:200,json:async()=>({})};
  };
  try{
    await renderProjectSetup({project:{...project,project_id:'p'},showPage:()=>{},go:value=>navigations.push(value),onDirty:value=>dirty.push(value)});
    listeners.get('input')();assert.equal(bindingStatus.textContent,'有未保存修改');
    await listeners.get('submit')({preventDefault(){}});
    assert.ok(status.textContent.includes('当前输入保留'));assert.equal(controls.get('base_url').value,'https://test.example.com');
    assert.equal(controls.get('operator').disabled,false);assert.equal(dirty.at(-1),true);assert.deepEqual(navigations,[]);
    await listeners.get('submit')({preventDefault(){}});
    assert.equal(calls.filter(call=>call.options.method&&call.path.endsWith('/targets')).length,1);
    assert.equal(bindingAttempts,2);assert.equal(dirty.at(-1),false);assert.deepEqual(navigations,['#/projects/p']);
    assert.equal(JSON.parse(calls.filter(call=>call.options.method&&call.path.endsWith('/environment')).at(-1).options.body).ui_environment_id,'saved-once');
  }finally{globalThis.fetch=old.fetch;globalThis.document=old.document;globalThis.FormData=old.FormData;}
});


// Real browser form semantics, with in-memory API responses only; no workbench or SUT is started.
test('native FormData preserves disabled synthetic scope on no-change save and still gates real edits',async t=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.WORKBENCH_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  page.setDefaultTimeout(7000);
  await page.route('**/*',route=>route.abort());
  const apiSource=await fs.readFile(new URL('../web-v2/api.js',import.meta.url),'utf8');
  const apiUrl='data:text/javascript;base64,'+Buffer.from(apiSource).toString('base64');
  const handoffSource=(await fs.readFile(new URL('../web-v2/frontend-handoffs.js',import.meta.url),'utf8')).replace("'./api.js'",JSON.stringify(apiUrl));
  const handoffUrl='data:text/javascript;base64,'+Buffer.from(handoffSource).toString('base64');
  const source=(await fs.readFile(new URL('../web-v2/project-setup.js',import.meta.url),'utf8')).replace("'./api.js'",JSON.stringify(apiUrl)).replace("'./frontend-handoffs.js'",JSON.stringify(handoffUrl));
  const moduleUrl='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  const saved={...environment,backend:{...environment.backend,allowed_path_prefixes:['/api/','/__control/'],namespace:{run_id_prefix:'release-qa'}}};
  const snapshot=structuredClone(saved);
  async function mount(env=saved){
    await page.setContent('<main id="host"></main>');
    await page.evaluate(async({moduleUrl,env,project})=>{
      window.calls=[];window.destinations=[];
      window.fetch=async(path,options={})=>{
        window.calls.push({path,method:options.method||'GET',body:options.body&&JSON.parse(options.body)});
        const value=options.method?(path.endsWith('/backend/environments')?{environment_id:'api-new'}:{}):path.endsWith('/environment')?env:{targets:[]};
        return {ok:true,status:200,json:async()=>value};
      };
      const {renderProjectSetup}=await import(moduleUrl);
      await renderProjectSetup({project:{...project,project_id:'p'},showPage:html=>document.querySelector('#host').innerHTML=html,go:path=>window.destinations.push(path)});
    },{moduleUrl,env,project});
  }
  await mount();
  assert.equal(await page.locator('[name="allowed_path_prefixes"]').isDisabled(),true);
  assert.equal(await page.locator('[name="authorized"]').isChecked(),false);
  await page.getByRole('button',{name:'保存并继续 →'}).click();
  assert.deepEqual(await page.evaluate(()=>window.destinations),['#/projects/p']);
  assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.method==='POST').length),0,'unchanged scope must not register or rebind an environment');
  assert.deepEqual(saved,snapshot,'saved environment identity and revision remain intact');

  await mount();
  await page.locator('[name="backend_url"]').fill('http://127.0.0.1:4402');
  await page.getByRole('button',{name:'保存并继续 →'}).click();
  assert.match(await page.locator('#project-setup-status').textContent(),/请确认已获准/);
  assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.method==='POST').length),0);
  assert.deepEqual(await page.evaluate(()=>window.destinations),[]);
  await page.locator('[name="authorized"]').check();
  await page.getByRole('button',{name:'保存并继续 →'}).click();
  assert.deepEqual(await page.evaluate(()=>window.destinations),['#/projects/p']);
  const edits=await page.evaluate(()=>window.calls.filter(call=>call.method==='POST'));
  assert.equal(edits.length,2);
  assert.deepEqual(edits[0].body.allowed_path_prefixes,saved.backend.allowed_path_prefixes);
  assert.equal(edits[0].body.base_url,'http://127.0.0.1:4402');
  assert.equal(edits[1].body.backend_environment_id,'api-new');
  assert.equal(edits[1].body.revision,saved.revision);

  await mount({...saved,backend:{...saved.backend,mode:'http-json-readonly'}});
  await page.locator('[name="allowed_path_prefixes"]').fill('');
  await page.locator('[name="authorized"]').check();
  await page.getByRole('button',{name:'保存并继续 →'}).click();
  assert.match(await page.locator('#project-setup-status').textContent(),/请填写接口允许路径/);
  assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.method==='POST').length),0,'an explicitly cleared visible scope is still rejected');
});
