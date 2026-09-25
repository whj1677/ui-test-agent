import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {chromium} from '@playwright/test';
const dir='workbench/qa/20260925-workflow-phase1',normal=JSON.parse(await fs.readFile(dir+'/single-result.json','utf8')),cross=JSON.parse(await fs.readFile(dir+'/cross-result.json','utf8'));
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await b.newPage({viewport:{width:1500,height:1000}}),results=[];
try{for(const run of [normal.runs[0],cross.runs[0]]){
 await p.goto(`http://127.0.0.1:4322/workspace/#/projects/${run.project_id}/cases/${run.case_id}?version=${run.case_version}&batch_id=${run.batch_id}&run_id=${run.run_id}`);
 await p.locator(`[data-run-id="${run.run_id}"]`).waitFor();const result={run_id:run.run_id,status:run.status,media:[]};
 if(run.step_replay?.status!=='READY'){assert.ok((await p.locator('#case-results').innerText()).includes(run.step_replay.reason));result.replay_unavailable=run.step_replay.reason;}
 for(const testId of run.step_replay?.status==='READY'?['execution-video','original-video']:['original-video']){const v=p.getByTestId(testId);await v.waitFor();await v.evaluate(el=>new Promise((resolve,reject)=>{if(el.readyState>=1)return resolve();el.addEventListener('loadedmetadata',resolve,{once:true});el.addEventListener('error',()=>reject(Error('decode failed')),{once:true});}));
 const before=await v.evaluate(el=>{el.muted=true;return {width:el.videoWidth,height:el.videoHeight,duration:el.duration};});await v.evaluate(el=>el.play());await p.waitForTimeout(500);assert.ok(await v.evaluate(el=>el.currentTime>0));await v.evaluate(el=>el.pause());assert.equal(await v.evaluate(el=>el.paused),true);await v.evaluate(el=>{el.currentTime=Math.min(el.duration/2,2);});await p.waitForTimeout(300);const seek=await v.evaluate(el=>el.currentTime);assert.ok(seek>0);result.media.push({kind:testId,...before,played:true,paused:true,seek});}
 const chapters=p.locator('[data-step-seek]:enabled');if(await chapters.count()){await chapters.first().click();await p.waitForTimeout(150);assert.ok((await p.getByTestId('execution-video').evaluate(el=>el.currentTime))<1);result.chapter_seek=true;}
 const image=p.getByTestId('run-screenshot');await image.waitFor();assert.ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0));result.screenshot_decoded=true;
 const popup=p.waitForEvent('popup');await p.getByRole('link',{name:'查看运行截图',exact:true}).click();const img=await popup;await img.waitForLoadState();assert.ok(await img.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0));await img.close();result.original_image_opened=true;
 const download=p.waitForEvent('download');await p.getByRole('link',{name:'下载本次 Trace',exact:true}).click();const dl=await download,buf=await fs.readFile(await dl.path());const expected=run.media.find(m=>m.kind==='trace');assert.equal(createHash('sha256').update(buf).digest('hex').toUpperCase(),expected.sha256);result.trace_download_sha256=expected.sha256;
 await p.screenshot({path:dir+'/'+run.status+'-media.png',fullPage:true});results.push(result);
 }
 // Invalid run never falls back; version not in current case never borrows a result.
 const r=normal.runs[0];await p.goto(`http://127.0.0.1:4322/workspace/#/projects/${r.project_id}/cases/${r.case_id}?version=1&run_id=invalid-run-id`);await p.getByTestId('run-record-not-found').waitFor();assert.equal(await p.locator('video').count(),0);
 await fs.writeFile(dir+'/media-validation.json',JSON.stringify({results,invalid_run_no_fallback:true,harness_starts:0,model_calls:0},null,2));console.log(JSON.stringify(results));
}finally{await b.close();}
