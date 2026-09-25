// UI import and UI task launch. Never fabricate build tasks, candidates or outcomes.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {fork,execFileSync} from 'node:child_process';import net from 'node:net';import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';import {createPaths} from '../server/paths.mjs';import {BuildTaskStore} from '../server/build/store.mjs';import {registerDevelopmentAuthorization,developmentAuthorizations} from '../server/build/development-authorization.mjs';import {digest} from '../server/build/development-session.mjs';import {startSite} from '../qa/20260925-kimi-complex/server.mjs';
const wb=fileURLToPath(new URL('../',import.meta.url)),root=path.join(wb,'.local/fresh25-b'),control=path.join(wb,'.local/kimi-workbench-control'),evidence=path.join(control,'evidence');await fs.mkdir(evidence,{recursive:true});
const mode=process.argv[2];if(!['--import','--run','--view'].includes(mode))throw Error('Explicit --import, --run or --view required');
const base='http://127.0.0.1:4322',executable='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const pkgPath=path.join(wb,'qa/20260925-kimi-workbench/cases.workbench.json'),pkg=JSON.parse(await fs.readFile(pkgPath,'utf8'));
const configPath=path.join(control,'runtime.json'),envPath=path.join(control,'environments.json');
const expectedSite='649508B83110076A267D4BD99C9424508E06408DDA060B6BA87D6B1FC715CCF0';assert.equal(digest(await fs.readFile(path.join(wb,'qa/20260925-kimi-complex/index.html'))),expectedSite);
const paths=createPaths({localRoot:root}),store=new BuildTaskStore(paths.buildTasksRoot);await store.init();
let child,browser,site,binding;const get=async u=>{const r=await fetch(base+u);if(!r.ok)throw Error(`${r.status} ${await r.text()}`);return r.json()};
async function start(){const probe=net.createServer();await new Promise((r,j)=>probe.once('error',j).listen(4322,'127.0.0.1',r));await new Promise(r=>probe.close(r));
 const env={...process.env,WORKBENCH_PORT:'4322',WORKBENCH_DATA_DIR:root,DSH_PROBE_BROWSER_EXECUTABLE:executable,WORKBENCH_CANDIDATE_TRIAL_CONFIG:configPath,WORKBENCH_DEVELOPMENT_ENVIRONMENTS:envPath};
 for(const k of ['WORKBENCH_BUILD_AUTHORIZATION_ID','M2C_BUILD_AUTHORIZATION_ID','WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_USE_STORED_DSH_CREDENTIALS'])delete env[k];
 if(mode==='--run'){const c=JSON.parse(await fs.readFile(path.join(wb,'scripts/start-workbench.local.json'),'utf8')).profiles.e2e;env.WORKBENCH_DSH_HOME=c.WORKBENCH_DSH_HOME;env.WORKBENCH_HARNESS_PATCH=c.WORKBENCH_HARNESS_PATCH;env.WORKBENCH_USE_STORED_DSH_CREDENTIALS='1';}
 child=fork(path.join(wb,'server/index.mjs'),[],{env,stdio:['ignore','pipe','pipe','ipc']});for(const name of ['stdout','stderr'])child[name].on('data',b=>void fs.appendFile(path.join(control,'service.log'),b));
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error('OWNED_SERVICE_EXITED');try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('SERVICE_START_TIMEOUT');}
async function stop(){if(!child)return;const c=child;child=null;const done=new Promise(r=>c.once('exit',r));c.send({type:'shutdown'});await done;}
await fs.writeFile(configPath,JSON.stringify({model_calls_allowed:mode==='--run',authorizations:[],environments:[]}));
await fs.writeFile(envPath,JSON.stringify([{id:'kimi-complex-20260925',normal_url:'http://127.0.0.1:4391/',validation_mode:'normal-only'}]));
try{
 if(mode==='--run')site=await startSite(4391);
 await start();browser=await chromium.launch({headless:true,executablePath:executable});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
 try{binding=JSON.parse(await fs.readFile(path.join(control,'binding.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!binding){if(mode!=='--import')throw Error('IMPORT_REQUIRED');await page.goto(base+'/workspace/');await page.locator('#new-project').click();await page.locator('#new-name').fill('Kimi复杂预约台 · 24条工作台实测');await page.locator('#new-description').fill('Kimi原始24条用例，工作台Coding Agent自主建例并实际执行；保留页面缺陷和原用例输入，独立验收，不自动批准。');await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.waitForURL(/projects\/project-.*\/cases/);const projectId=page.url().split('/projects/')[1].split('/')[0];
 await page.getByRole('link',{name:'导入用例',exact:true}).click();await page.locator('#import-file').setInputFiles(pkgPath);await page.locator('#upload-file').click();await page.locator('#create-preview').click();await page.locator('#confirm-import').waitFor();await page.screenshot({path:path.join(evidence,'import-preview.png'),fullPage:true});await page.locator('#confirm-import').click();await page.getByText('导入确认已完成',{exact:true}).waitFor();await page.screenshot({path:path.join(evidence,'import-result.png'),fullPage:true});
 binding={project_id:projectId,package_sha256:digest(await fs.readFile(pkgPath)),site_sha256:expectedSite,imported_at:new Date().toISOString(),source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),data_profile:'fresh-b',base};await fs.writeFile(path.join(control,'binding.json'),JSON.stringify(binding,null,2));}
 const project=await get(`/api/case-library/projects/${binding.project_id}`);assert.equal(project.cases.length,24);
 for(const c of project.cases){const expected=pkg.cases.find(x=>x.content.external_id===c.external_id).content,version=c.versions.find(v=>v.version===c.current_version);assert.deepEqual(version.content,expected);}
 console.log(JSON.stringify({phase:'IMPORTED',project_id:project.project_id,cases:24,model_started:false}));
 const entries=await developmentAuthorizations(store);
 for(const c of project.cases){const logical_id='kimi-wb-20260925-'+c.external_id;if(!entries.some(e=>e.logical_id===logical_id)){if(mode!=='--import')throw Error('AUTHORIZATION_PREPARATION_REQUIRED');const v=c.versions.find(v=>v.version===c.current_version);await registerDevelopmentAuthorization(store,{logical_id,project_id:project.project_id,case_id:c.case_id,case_version:v.version,content_sha256:v.content_sha256,environment_id:'kimi-complex-20260925',mode:'new',budget_profile:'exploratory',limits:{harness_starts:1}});}}
 await page.goto(`${base}/workspace/#/projects/${project.project_id}/cases`);await page.locator('[data-open-case]').first().waitFor();await page.screenshot({path:path.join(evidence,'case-library.png'),fullPage:true});
 if(mode==='--run'){
  const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();await fs.writeFile(path.join(control,'execution-source.json'),JSON.stringify({commit:source,started_at:new Date().toISOString()},null,2),{flag:'wx'});
  for(const c of [...project.cases].sort((a,b)=>a.external_id.localeCompare(b.external_id))){
   const logical='kimi-wb-20260925-'+c.external_id;const latest=(await developmentAuthorizations(store)).find(e=>e.logical_id===logical);if(latest.task_id){console.log(JSON.stringify({phase:'ALREADY_CLAIMED_NOT_RESTARTED',case:c.external_id,task_id:latest.task_id}));continue;}
   await page.goto(`${base}/workspace/#/projects/${project.project_id}/develop`);await page.locator(`[data-develop="${logical}"]`).click();await page.waitForURL(/build-tasks\/build-/);const taskId=page.url().split('/').at(-1);console.log(JSON.stringify({phase:'STARTED',case:c.external_id,task_id:taskId}));
   let task;for(let i=0;i<2000;i++){task=await get('/api/build/tasks/'+taskId);if(!task.active_attempt_id)break;if(i%15===0)console.log(JSON.stringify({phase:'PROGRESS',case:c.external_id,status:task.task_status,tools:task.development?.tool_calls,executions:task.development?.self_tests?.map(r=>r.result?.test_status||r.status)}));await new Promise(r=>setTimeout(r,1000));}
   if(task.active_attempt_id)throw Error('TASK_NOT_SETTLED');
   await fs.writeFile(path.join(control,c.external_id+'-result.json'),JSON.stringify(task,null,2));await page.reload();await page.getByTestId('development-status').waitFor();await page.screenshot({path:path.join(evidence,c.external_id+'-task.png'),fullPage:true});
   console.log(JSON.stringify({phase:'SETTLED',case:c.external_id,task_id:taskId,status:task.task_status,error:task.error?.code,self_tests:task.development?.self_tests?.map(r=>r.result?.test_status||r.status),independent:task.candidates?.at(-1)?.trial_runs?.map(r=>r.status)}));
   if(task.error&&!(task.development?.tool_calls>0))throw Error('SHARED_STARTUP_BLOCKER_STOP_REMAINING');
  }
 }
 await page.goto(`${base}/workspace/#/projects/${project.project_id}/build-tasks`);await page.screenshot({path:path.join(evidence,'project-tasks.png'),fullPage:true});
 console.log(JSON.stringify({phase:'DONE',project_id:project.project_id,mode}));
}finally{await browser?.close();await stop();await site?.close();}
