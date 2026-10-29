import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectDocument} from '../../server/requirements/documents.mjs';
import {protocolCatalog} from '../../server/backend/protocol-preparation.mjs';
const dir = new URL('./',import.meta.url), base='http://127.0.0.1:4322';
const name='手动体验 · 储能站巡检工单 · 20261009';
const save=(file,data)=>fs.writeFile(new URL(file,dir),JSON.stringify(data,null,2)+'\n');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
let state={};
try {state=JSON.parse(await fs.readFile(new URL('project-state.json',dir),'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
const prefix=()=>'/api/case-library/projects/'+state.project_id;
const calls=[];
async function req(route,body,headers={}) {
  const allowed=body===undefined || route==='/api/case-library/projects' && !state.project_id || route==='/api/case-library/uploads' || [
    '/imports/preview','/requirements/sources','/targets','/backend/environments','/environment','/script-operations/preflight',
  ].some(end=>route===prefix()+end) || route.startsWith(prefix()+'/imports/') && route.endsWith('/confirm');
  assert(allowed,'Preparation route is not allowed: '+route);
  const method=body===undefined?'GET':'POST';
  const r=await fetch(base+route,{method,headers:{Origin:base,'Content-Type':'application/json',...headers},body:body===undefined?undefined:Buffer.isBuffer(body)||typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const value=await r.json();calls.push({method,route,status:r.status});
  assert(r.ok,JSON.stringify({route,status:r.status,value}));return value;
}
try {
  const health=await req('/api/health');
  assert.equal(health.service,'approved-test-workbench');assert.equal(health.status,'ready');
  assert(!Object.entries(health).some(([k,v])=>/^active_/.test(k)&&v)&&!health.requirements.active&&!health.backend,'Workbench must be idle');
  const target=await fetch('http://127.0.0.1:4460/health').then(r=>r.json());assert.equal(target.service,'inspection-trial-20261009');
  const definitions=[['PRD','01-PRD.md'],['MRD','02-用例说明.md'],['PROTOCOL','03-通讯协议.md']];
  const docs=[];
  for(const [kind,file] of definitions) {
    const body=await fs.readFile(new URL(file,dir));const doc=inspectDocument({kind,fileName:file,body});
    assert(doc.segments.length && !doc.issues.length,JSON.stringify({file,issues:doc.issues}));
    if(kind==='PROTOCOL') {const catalog=protocolCatalog(doc);assert.equal(catalog.length,6);assert(catalog.every(e=>e.response_text));await save('protocol-catalog.json',catalog);}
    docs.push({kind,file,body,sha256:doc.sha256});
  }
  if(!state.project_id) {
    const projects=(await req('/api/case-library/projects')).projects;
    assert(!projects.some(p=>p.name===name),'Named project exists; inspect before creating duplicate');
    const before=[];
    for(const p of projects)before.push({project_id:p.project_id,sha256:digest(await req('/api/case-library/projects/'+p.project_id))});
    await save('old-projects-before.json',before);
    const p=await req('/api/case-library/projects',{name,description:'全新公开合成练习：前端6条、后端6条，覆盖新增、重复编号、只读权限、组合查询与状态流转。环境4460；用例和协议已准备。脚本生成及执行由用户亲自操作。'});
    state={project_id:p.project_id,name,entry:base+'/workspace/#/projects/'+p.project_id,target:'http://127.0.0.1:4460/inspection/',phase:'CREATED',service_instance_id:health.service_identity.service_instance_id};
    await save('project-state.json',state);
  }
  let project=await req(prefix());assert.equal(project.name,name);
  const pkg=JSON.parse(await fs.readFile(new URL('case-package.json',dir),'utf8'));
  if(project.cases.length===0) {
    const up=await req('/api/case-library/uploads',JSON.stringify(pkg),{'x-file-name':'inspection-trial-cases.json'});
    const preview=await req(prefix()+'/imports/preview',{upload_id:up.upload_id});await save('import-preview.json',preview);
    assert.equal(preview.summary.UNIMPORTABLE,0);
    const imported=await req(prefix()+`/imports/${preview.preview_id}/confirm`,{decisions:{}});await save('import-result.json',imported);
    assert.equal(imported.result.added,12);
  }
  let sources=(await req(prefix()+'/requirements/sources')).sources;
  for(const doc of docs) {
    const match=sources.find(s=>s.file_name===doc.file);
    if(match){assert.equal(match.sha256,doc.sha256);continue;}
    await req(prefix()+'/requirements/sources',doc.body,{'Content-Type':'application/octet-stream','x-file-name':encodeURIComponent(doc.file),'x-source-kind':doc.kind,'x-document-version':'v1','x-document-status':'CONFIRMED'});
  }
  let environment=await req(prefix()+'/environment');
  let targets=(await req(prefix()+'/targets')).targets;
  let ui=targets.find(t=>t.entry_url===state.target);
  if(!ui){await req(prefix()+'/targets',{name:'巡检工单 · 前端环境',entry_url:state.target,path_prefix:'/',operator:'Codex：按用户要求准备本地合成练习',confirm_non_production:true});targets=(await req(prefix()+'/targets')).targets;ui=targets.find(t=>t.entry_url===state.target);}
  assert(ui?.ready);state.ui_environment_id=ui.environment_id||ui.id;
  assert(state.ui_environment_id);
  let backend=environment.backend_options.find(e=>e.base_url==='http://127.0.0.1:4460');
  if(!backend)backend=await req(prefix()+'/backend/environments',{name:'巡检工单 · 后端环境',base_url:'http://127.0.0.1:4460',mode:'synthetic-namespace',reviewer:'Codex：按用户要求准备本地合成练习',non_production:true,authorized:true,run_id_prefix:'inspection'});
  state.backend_environment_id=backend.environment_id;await save('project-state.json',state);
  if(environment.ui_environment_id!==state.ui_environment_id||environment.backend_environment_id!==state.backend_environment_id)environment=await req(prefix()+'/environment',{revision:environment.revision,ui_environment_id:state.ui_environment_id,backend_environment_id:state.backend_environment_id});
  assert.equal(environment.ui_status,'CONFIGURED');assert.equal(environment.backend_status,'CONFIGURED');
  await save('environment.json',environment);
  project=await req(prefix());assert.equal(project.cases.length,12);
  const content=c=>c.versions.find(v=>v.version===c.current_version).content;
  for(const c of pkg.cases)assert.deepEqual(content(project.cases.find(x=>content(x).external_id===c.content.external_id)),c.content);
  const preparation=await req(prefix()+'/backend/preparation');await save('backend-preparation.json',preparation);
  assert.equal(preparation.items.length,6);assert(preparation.items.every(i=>i.status==='READY'),JSON.stringify(preparation.items.map(i=>({id:i.external_id,status:i.status,missing:i.missing}))));
  const uiItems=project.cases.filter(c=>content(c).case_type==='UI').map(c=>({case_id:c.case_id,case_version:c.current_version}));
  const preflight=await req(prefix()+'/script-operations/preflight',{mode:'generate',request_id:'inspection-preflight-20261009',environment_id:state.ui_environment_id,quality_review_mode:'static-v1',skill_profile:'off',items:uiItems});
  await save('frontend-preflight.json',preflight);assert.equal(preflight.items.length,6);assert(preflight.items.every(i=>!i.reason),JSON.stringify(preflight));
  const records=await req(prefix()+'/execution-records');const operations=await req(prefix()+'/script-operations');const plans=await req(prefix()+'/backend');
  assert.equal(records.records.length,0);assert.equal(operations.operations.length,0);assert.equal(plans.plans.length,0);
  const old=JSON.parse(await fs.readFile(new URL('old-projects-before.json',dir),'utf8')),changed=[];
  for(const p of old)if(digest(await req('/api/case-library/projects/'+p.project_id))!==p.sha256)changed.push(p.project_id);
  assert.equal(changed.length,0);
  Object.assign(state,{phase:'PREPARED_FOR_USER',prepared_at:new Date().toISOString(),frontend_cases:6,backend_cases:6,backend_ready:6,frontend_ready:6,old_projects_unchanged:old.length,model_requests_started:0,business_executions_started:0});
  await save('project-state.json',state);console.log(JSON.stringify(state,null,2));
} finally {await save('preparation-api-log.json',calls);}
