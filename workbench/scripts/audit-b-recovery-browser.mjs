// Read-only browser acceptance of the settled production task. No Harness or candidate execution.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { createPaths } from '../server/paths.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { digest } from '../server/build/development-session.mjs';
const root=path.resolve('workbench/.local/br25');
const task=JSON.parse(await fs.readFile(path.join(root,'b-recovery-20260925-result.json')));
const paths=createPaths({localRoot:root});const store=new BuildTaskStore(paths.buildTasksRoot);const caseStore=new CaseLibraryStore(paths.caseLibraryRoot);
const server=createWorkbenchServer({buildStore:store,caseStore});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
try{
 const page=await browser.newPage();await page.goto(`${base}/workspace/#/projects/${task.source.project_id}/build-tasks/${task.task_id}`);
 await page.getByTestId('development-status').filter({hasText:task.task_status}).waitFor();
 const rows=await page.locator('.preview-item h3').allTextContents();
 assert.equal(rows.length,task.development.self_tests.length+(task.candidates[0]?.trial_runs.length||0));
 const links=await page.locator('a[href*="/files/"]').evaluateAll(items=>items.map(item=>({text:item.textContent,href:item.getAttribute('href')})));
 const media=[];
 for(const file of task.files.filter(f=>f.web_visible&&f.file_name.endsWith('.png'))){
  const link=links.find(l=>l.href.endsWith('/'+file.file_id));assert.ok(link);
  const response=await page.request.get(base+link.href);assert.equal(response.status(),200);const bytes=await response.body();assert.equal(digest(bytes),file.sha256);
  media.push({file_id:file.file_id,path:file.relative_path,sha256:digest(bytes),http_status:response.status()});
 }
 await page.screenshot({path:path.join(root,'browser-acceptance.png'),fullPage:true});
 await fs.writeFile(path.join(root,'browser-acceptance.json'),JSON.stringify({task_id:task.task_id,status:await page.getByTestId('development-status').textContent(),rows,media,model_calls:0,candidate_executions:0},null,2));
 console.log(JSON.stringify({task_id:task.task_id,rows:rows.length,verified_media:media.length}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
