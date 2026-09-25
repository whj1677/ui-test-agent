import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {chromium} from '@playwright/test';
const root=path.resolve('workbench/qa/20260925-workflow-phase1');await fs.mkdir(root,{recursive:true});
const local=path.resolve('workbench/.local/phase1');await fs.mkdir(local,{recursive:true});
const base='http://127.0.0.1:4322', get=async url=>{const r=await fetch(base+url);assert.equal(r.status,200);return r.json();};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1000}});page.on('pageerror',e=>console.error('PAGEERROR',e.message));
try{
 const source=JSON.parse(await fs.readFile('workbench/qa/20260925-kimi-workbench/cases.workbench.json','utf8'));
 const chosen=source.cases.filter((c,i)=>i<11||c.content.external_id==='KC-22');
 const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('原用例保真副本');sheet.addRow(['用例编号','标题','模块','前置条件','测试数据','步骤','逐步预期','内容状态']);
 for(const {content:c} of chosen)sheet.addRow([c.external_id,c.title,c.module,c.preconditions,c.test_data,c.steps.map(s=>s.action).join('\n'),c.steps.map(s=>s.expected).join('\n'),c.status]);
 await wb.xlsx.writeFile(path.join(root,'phase1-cases.xlsx'));
 const existing=(await get('/api/case-library/projects')).projects.find(p=>p.name==='第一批流程验收 · 原用例副本');
 await page.goto(base+'/workspace/#/projects/'+existing.project_id+'/cases');
 const projectId=page.url().split('/projects/')[1].split('/')[0],project=await get('/api/case-library/projects/'+projectId);
 assert.equal(project.cases.length,24);for(const item of project.cases){const expected=chosen.find(c=>c.content.external_id===item.external_id).content;assert.deepEqual(item.versions[0].content,expected);}
 await fs.writeFile(path.join(local,'project.json'),JSON.stringify(project,null,2));
 const original=await get('/api/case-library/projects/project-4ea92d3d-7c94-4aef-b610-4552742e95ca');const checks=[];
 for(const c of original.cases){await page.goto(base+`/workspace/#/projects/${original.project_id}/cases/${c.case_id}`);await page.waitForFunction(id=>document.querySelector('h1')?.textContent.startsWith(id),c.external_id);await page.locator('#case-result-choice').waitFor();await page.locator('[data-testid="case-automation"]').waitFor();assert.match(await page.locator('h1').innerText(),new RegExp(c.external_id));const review=await page.locator('[data-testid="case-automation"] [data-testid="requirement-review"]').innerText();checks.push({case_id:c.case_id,external_id:c.external_id,review});if(['KC-01','KC-12','KC-21','KC-22'].includes(c.external_id))await page.screenshot({path:path.join(root,c.external_id+'-detail.png'),fullPage:true});}
 await page.goto(base+`/workspace/#/projects/${original.project_id}/cases`);await page.locator('#rerun-project').click();await page.locator('#batch-preflight').click();await page.locator('#batch-start:enabled').waitFor();const preflight=await page.locator('#batch-preview').innerText();assert.match(preflight,/24/);await page.screenshot({path:path.join(root,'original24-preflight.png'),fullPage:true});await page.locator('#batch-close').click();
 await fs.writeFile(path.join(root,'import-history.json'),JSON.stringify({project_id:projectId,excel_cases:24,unique_source_cases:12,driver_issue:"初次历史页面等待错误后驱动重复上传，保留第二次导入，不伪称仅一次；两份均逐字核对原内容",exact_content_equal:true,history:checks,preflight,harness_starts:0,model_calls:0},null,2));
 console.log(JSON.stringify({project_id:projectId,imported:project.cases.length,history_checked:checks.length}));
}finally{await browser.close();}
