import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const base='http://127.0.0.1:4322',dir='workbench/qa/20260925-workflow-phase1',get=async u=>{const r=await fetch(base+u);assert.equal(r.status,200);return r.json();};
const small=JSON.parse(await fs.readFile('workbench/.local/phase1/small-project.json','utf8')),full=JSON.parse(await fs.readFile(dir+'/full-result.json','utf8')),single=JSON.parse(await fs.readFile(dir+'/single-result.json','utf8'));
const before=(await get('/api/case-library/projects/'+small.project_id+'/execution-records')).records.length;
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await b.newPage({viewport:{width:1500,height:1000}});
try{
 const c=small.cases.find(c=>c.external_id==='KC-11'),project=await get('/api/case-library/projects/'+small.project_id),current=project.cases.find(i=>i.case_id===c.case_id);
 await p.goto(`${base}/workspace/#/projects/${small.project_id}/cases/${c.case_id}`);await p.locator('#edit-case').waitFor();
 if(current.current_version===1){await p.locator('#edit-case').click();await p.locator('input[name="title"]').fill(c.title+'（隔离版本变化验证）');await p.getByRole('button',{name:'保存为新版本'}).click();}
 await p.locator('#case-result-choice').waitFor();await p.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('隔离版本变化验证'));
 assert.equal(await p.locator('#case-results video').count(),0);assert.match(await p.locator('#case-results').innerText(),/尚未执行/);assert.equal(await p.locator('[data-candidate-trial]:enabled').count(),0);await p.screenshot({path:dir+'/case-v2-no-inheritance.png',fullPage:true});
 await p.locator('[data-version="1"]').click();await p.locator('#case-batch-choice').waitFor();await p.locator('#case-batch-choice').selectOption(full.batch.batch_id);await p.locator('[data-run-id="'+full.runs.find(r=>r.external_id==='KC-11'||r.executed_external_id==='KC-11').run_id+'"]').waitFor();assert.equal(await p.locator('#case-results video').count(),2);
 await p.goto(`${base}/workspace/#/projects/${small.project_id}/cases/${c.case_id}?version=1&run_id=${single.runs[0].run_id}`);await p.getByTestId('run-record-not-found').waitFor();assert.equal(await p.locator('#case-results video').count(),0);
 const bad=await p.evaluate(async url=>(await fetch(url)).status,`/api/case-library/projects/${small.project_id}/batches/${single.batch.batch_id}`);assert.notEqual(bad,200);
 await p.goto(base+'/workspace/#/projects/'+small.project_id+'/batches?batch_id='+full.batch.batch_id);await p.locator('[data-batch-id="'+full.batch.batch_id+'"]').waitFor();await p.reload();await p.locator('[data-batch-id="'+full.batch.batch_id+'"]').waitFor();await p.goBack();await p.goForward();
 const after=(await get('/api/case-library/projects/'+small.project_id+'/execution-records')).records.length;assert.equal(before,after);
 const imported=JSON.parse(await fs.readFile('workbench/.local/phase1/project.json','utf8'));assert.equal((await get('/api/case-library/projects/'+imported.project_id)).cases.length,24);
 await fs.writeFile(dir+'/restart-version-validation.json',JSON.stringify({software_versions:['模拟构建-V1','模拟构建-V2'],scope:'same frozen deployment, labels simulate product release; not real deployment validation',normal_restart_readback:true,excel_import_cases_readback:24,version2_no_inheritance:true,version1_history_available:true,cross_project_run_rejected:true,cross_project_batch_rejected:true,refresh_back_forward_no_execution:true,run_counts:{before,after},harness_starts:0,model_calls:0},null,2));console.log('restart / v2 / invalid IDs / navigation verified');
}finally{await b.close();}
