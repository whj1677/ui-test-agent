import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const mode=process.argv[2],base='http://127.0.0.1:4322',dir='workbench/qa/20260925-workflow-phase1',local='workbench/.local/phase1';
const get=async u=>{const r=await fetch(base+u);assert.equal(r.status,200);return r.json();};
const original=await get('/api/case-library/projects/project-4ea92d3d-7c94-4aef-b610-4552742e95ca'),small=JSON.parse(await fs.readFile(local+'/small-project.json','utf8'));
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await b.newPage({viewport:{width:1500,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const navigate=async hash=>{await p.goto(base+'/workspace/'+hash);await p.waitForTimeout(250);};
try{
 const project=['cross','single'].includes(mode)?original:small;
 if((mode==='single'||mode.startsWith('label')||mode==='soft-fix')){
 const c=project.cases.find(c=>c.external_id===(mode==='soft-fix'?'KC-02':'KC-22'));await navigate(`#/projects/${project.project_id}/cases/${c.case_id}`);await p.locator('[data-candidate-trial]').first().click();
 }else{await navigate(`#/projects/${project.project_id}/cases`);await p.locator('#rerun-project').waitFor();
 if(mode==='cross'){await p.getByRole('checkbox',{name:'选择 KC-02',exact:true}).check();await p.locator('#next-page').click();await p.getByRole('checkbox',{name:'选择 KC-11',exact:true}).check();assert.match(await p.locator('.selection-note').innerText(),/2 条/);await p.locator('#rerun-selected').click();}else await p.locator('#rerun-project').click();}
 await p.locator('#batch-software').fill(mode.startsWith('label')?'模拟构建-V2':'模拟构建-V1');
 const pre=p.waitForResponse(r=>r.url().endsWith('/batches')&&r.request().method()==='POST');await p.locator('#batch-preflight').click();const preview=await(await pre).json();await p.locator('#batch-start:enabled').waitFor();if(await p.locator('#batch-partial').count())await p.locator('#batch-partial').check();
 await fs.writeFile(local+'/'+mode+'-receipt.json',JSON.stringify(preview,null,2),{flag:'wx'});
 const start=p.waitForResponse(r=>r.url().endsWith('/start')&&r.request().method()==='POST');await p.locator('#batch-start').dblclick();const response=await start;assert.equal(response.status(),200);const started=await response.json();
 let done,cancelRequested=false;
 for(let n=0;n<240;n++){done=await get(`/api/case-library/projects/${project.project_id}/batches/${started.batch_id}`);if(['FINISHED','CANCELLED','INTERRUPTED'].includes(done.state))break;
 if(!cancelRequested&&mode.startsWith('cancel')&&done.items.some(i=>i.state==='RUNNING')){cancelRequested=true;await p.locator('#cancel-batch').click();}
 await new Promise(r=>setTimeout(r,1000));}
 assert.ok(['FINISHED','CANCELLED'].includes(done.state),JSON.stringify(done));
 if(!mode.startsWith('cancel'))for(const i of done.items.filter(i=>i.selection&&i.state!=='BLOCKED'))assert.equal(i.state,'FINISHED',i.reason);
 await p.reload();await p.waitForTimeout(1000);await p.screenshot({path:dir+'/'+mode+'.png',fullPage:true});
 const repeats=await p.evaluate(async({url,body})=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{url:`/api/case-library/projects/${project.project_id}/batches/${done.batch_id}/start`,body:{request_id:done.request_id,allow_partial:done.allow_partial}});assert.equal(repeats.status,200);assert.equal(repeats.body.batch_id,done.batch_id);
 const runs=[];for(const item of done.items){if(!item.run_id)continue;const records=await get(`/api/case-library/projects/${project.project_id}/execution-records`);const run=records.records.find(r=>r.run_id===item.run_id);assert.equal(run.model_calls,0);assert.equal(run.harness_starts,0);assert.equal(run.bundle_sha256,item.selection.bundle_sha256);assert.equal(run.same_candidate_hash,mode.startsWith('cancel')?run.same_candidate_hash:true);runs.push(run);}
 assert.deepEqual(errors,[]);await fs.writeFile(dir+'/'+mode+'-result.json',JSON.stringify({batch:done,runs,duplicate_request_same_batch:true,page_errors:errors},null,2));console.log(JSON.stringify({mode,batch:done.batch_id,items:done.items.map(i=>({case:i.external_id,state:i.state,result:i.result,reason:i.reason})),runs:runs.length}));
}finally{await b.close();}
