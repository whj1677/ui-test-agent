// Product UI acceptance against the original independent project; zero model.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import assert from 'node:assert/strict';
import net from 'node:net';
import { chromium } from '@playwright/test';
import { digest } from '../server/build/development-session.mjs';
const wb=fileURLToPath(new URL('../',import.meta.url)), root=path.join(wb,'.local/fresh25-b');
const config=JSON.parse(await fs.readFile(path.join(wb,'config/fresh-b-trial.json'))), selection=config.authorizations[0];
const evidence=path.join(root,'trial-ui-acceptance');await fs.mkdir(evidence,{recursive:true});
const base='http://127.0.0.1:4322', executablePath='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sourceFile=path.join(root,'build-tasks',selection.source_task_id,'task.json');const original=await fs.readFile(sourceFile);
const execute=process.argv.includes('--execute');
let child,browser;const summary={source_task_sha256:digest(original),model_calls:0,harness_starts:0,runs:[],browser:[],restart_readback:false};
async function start(){
  const probe=net.createServer();await new Promise((r,j)=>probe.once('error',j).listen(4322,'127.0.0.1',r));await new Promise(r=>probe.close(r));
  const env={...process.env,WORKBENCH_PORT:'4322',WORKBENCH_DATA_DIR:root,WORKBENCH_CANDIDATE_TRIAL_CONFIG:path.join(wb,'config/fresh-b-trial.json'),DSH_PROBE_BROWSER_EXECUTABLE:executablePath};
  for(const k of ['WORKBENCH_BUILD_AUTHORIZATION_ID','M2C_BUILD_AUTHORIZATION_ID','WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_USE_STORED_DSH_CREDENTIALS','WORKBENCH_DEVELOPMENT_ENVIRONMENTS'])delete env[k];
  child=fork(path.join(wb,'server/index.mjs'),[],{env,stdio:['ignore','pipe','pipe','ipc']});
  child.stdout.on('data',b=>void fs.appendFile(path.join(evidence,'service.log'),b));child.stderr.on('data',b=>void fs.appendFile(path.join(evidence,'service.log'),b));
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('OWNED_SERVICE_EXITED');try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('START_TIMEOUT');
}
async function stop(){if(!child)return;const owned=child;child=null;const exit=new Promise(r=>owned.once('exit',r));owned.send({type:'shutdown'});await exit;}
async function records(){return (await (await fetch(`${base}/api/case-library/projects/${selection.project_id}/execution-records`)).json()).records;}
async function waitRun(id){for(let i=0;i<180;i++){const r=await (await fetch(`${base}/api/runs/${id}`)).json();if(['FINISHED','CANCELLED','INTERRUPTED'].includes(r.execution_status))return r;await new Promise(r=>setTimeout(r,500));}throw Error('RUN_TIMEOUT');}
try{
  await start();browser=await chromium.launch({headless:true,executablePath});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',acceptDownloads:true});const page=await context.newPage();
  const caseUrl=`${base}/workspace/#/projects/${selection.project_id}/cases/${selection.case_id}?version=${selection.case_version}`;
  await page.goto(base+'/workspace/');await page.locator(`a[href*="${selection.project_id}"]`).first().click();
  await page.locator(`[data-open-case="${selection.case_id}"]`).click();await page.getByTestId('case-automation').waitFor();
  await page.getByText('候选代码与文件清单',{exact:true}).click();await page.getByRole('button',{name:'查看代码',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.candidate-code')?.textContent.includes('CASE_STEP_5'));
  assert.match(await page.locator('.candidate-code').innerText(),/CASE_STEP_5/);
  await page.screenshot({path:path.join(evidence,'case-automation.png'),fullPage:true});
  const existing=await records();assert.ok(existing.some(r=>r.origin==='DEVELOPMENT_SELF_TEST'));assert.ok(existing.some(r=>r.origin==='INITIAL_INDEPENDENT_VALIDATION'));
  for(const lane of ['normal','negative']){
    const receipt=path.join(evidence,`${lane}-receipt.json`);let run;
    try { run=JSON.parse(await fs.readFile(receipt));run=await waitRun(run.run_id); }
    catch(error){
      if(error.code!=='ENOENT'||!execute)throw error;
      if(lane==='negative')assert.equal(summary.runs[0].complete_pass,true,'normal must pass before fault');
      await page.goto(caseUrl+(lane==='negative'?'&validation=negative':''));
      const response=page.waitForResponse(r=>r.url().endsWith('/api/candidate-trials')&&r.request().method()==='POST');
      await page.getByRole('button',{name:lane==='normal'?'试跑当前文件包（不调用模型）':'受控故障验证（不调用模型）',exact:true}).click();
      const res=await response;assert.equal(res.status(),202,await res.text());run=await res.json();await fs.writeFile(receipt,JSON.stringify(run,null,2));run=await waitRun(run.run_id);
    }
    assert.equal(run.bundle_sha256,selection.bundle_sha256);assert.equal(run.harness_starts,0);assert.equal(run.model_calls,0);
    if(lane==='normal'){assert.equal(run.complete_pass,true,JSON.stringify(run));assert.deepEqual(run.step_coverage.items.map(s=>s.execution_status),Array(5).fill('PASSED'));}
    else{assert.equal(run.status,'FAILED');assert.equal(run.complete_pass,false);assert.deepEqual([run.failure_step,run.error.expected,run.error.actual],['CASE_STEP_3','WO-202','WO-201']);assert.deepEqual(run.step_coverage.items.slice(3).map(s=>s.execution_status),['NOT_EXECUTED','NOT_EXECUTED']);}
    summary.runs.push(run);await fs.writeFile(path.join(evidence,`${lane}-run.json`),JSON.stringify(run,null,2));
    assert.equal(run.evidence_status,'COMPLETE',JSON.stringify(run.technical_error));
    const runUrl=`${base}/workspace/#/projects/${selection.project_id}/execution-records?run_id=${run.run_id}`;
    await page.goto(runUrl);await page.locator(`.execution-detail[data-run-id="${run.run_id}"]`).waitFor();
    const media=[];
    for(const testId of ['execution-video','original-video']){
      const video=page.getByTestId(testId);await video.evaluate(v=>new Promise((r,j)=>{if(v.readyState>=1)return r();v.onloadedmetadata=r;v.onerror=()=>j(Error('DECODE'));}));
      await video.evaluate(async v=>{v.muted=true;await v.play();});await page.waitForFunction(id=>document.querySelector(`[data-testid="${id}"]`).currentTime>0.2,testId);
      await video.evaluate(v=>v.pause());const before=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(180);assert.ok(Math.abs((await video.evaluate(v=>v.currentTime))-before)<0.04);
      const duration=await video.evaluate(v=>v.duration);const target=Number.isFinite(duration)?duration*0.45:0.5;await video.evaluate((v,t)=>{v.currentTime=t;},target);await page.waitForFunction(({id,target})=>Math.abs(document.querySelector(`[data-testid="${id}"]`).currentTime-target)<0.12,{id:testId,target});
      await video.scrollIntoViewIfNeeded();const box=await video.boundingBox();
      const startX=box.x+20+(box.width-40)*0.45, endX=box.x+20+(box.width-40)*0.72, y=box.y+box.height-20;
      await page.mouse.move(startX,y);await page.mouse.down();await page.mouse.move(endX,y,{steps:12});await page.mouse.up();
      if(Number.isFinite(duration))await page.waitForFunction(({id,duration})=>document.querySelector(`[data-testid="${id}"]`).currentTime>duration*0.55,{id:testId,duration});
      assert.ok(await video.evaluate(v=>v.videoWidth>0&&v.getVideoPlaybackQuality().totalVideoFrames>0));media.push({testId,played:true,paused:true,seeked:true,mouse_dragged:true,duration:Number.isFinite(duration)?duration:'unknown'});
    }
    await page.locator('[data-step-seek="CASE_STEP_3"]').click();const chapter=run.step_replay.chapters.find(c=>c.step_id==='CASE_STEP_3');const target=lane==='negative'?chapter.result_start_seconds:chapter.start_seconds;
    await page.waitForFunction(t=>Math.abs(document.querySelector('[data-testid="execution-video"]').currentTime-t)<0.2,target);
    if(lane==='negative')assert.equal(await page.locator('[data-step-seek="CASE_STEP_4"]').isDisabled(),true);
    await page.getByTestId('run-screenshot').evaluate(img=>img.decode());
    const downloads=[];for(const name of ['下载本次 Trace','下载带中文字幕的步骤证据回放','下载原始连续录像']){
      const pending=page.waitForEvent('download');await page.getByRole('link',{name,exact:true}).click();const d=await pending;const bytes=await fs.readFile(await d.path());
      const registered=run.media.find(f=>f.sha256===digest(bytes));assert.ok(registered,`download hash ${name}`);downloads.push({name,sha256:digest(bytes),bytes:bytes.length});
    }
    await page.screenshot({path:path.join(evidence,`${lane}-result${execute?'':'-readback'}.png`),fullPage:true});
    const count=(await records()).length;await page.reload();await page.getByTestId('execution-video').waitFor();assert.equal((await records()).length,count,'read/reload/play/download cannot execute');
    summary.browser.push({run_id:run.run_id,media,chapter_seek:true,screenshot_decoded:true,downloads});
  }
  const count=(await records()).length;await stop();await start();await page.reload();await page.getByTestId('execution-video').waitFor();assert.equal((await records()).length,count);
  for(const r of summary.runs){await page.locator(`a[href$="run_id=${r.run_id}"]`).first().click();await page.locator(`.execution-detail[data-run-id="${r.run_id}"]`).waitFor();}
  const legacy=existing.find(r=>r.origin==='INITIAL_INDEPENDENT_VALIDATION'&&r.run_type==='normal');
  await page.locator(`a[href$="run_id=${legacy.run_id}"]`).first().click();await page.getByText('旧运行没有现场步骤截图，无法提供步骤证据回放；不事后补拍。',{exact:true}).waitFor();
  const oldVideo=page.getByTestId('execution-video');await oldVideo.evaluate(async v=>{v.muted=true;await v.play();});await page.waitForFunction(()=>document.querySelector('[data-testid="execution-video"]').currentTime>0.1);await oldVideo.evaluate(v=>v.pause());
  assert.equal((await records()).length,count);summary.legacy_media_played=true;summary.switch_records_verified=true;
  summary.restart_readback=true;assert.equal(digest(await fs.readFile(sourceFile)),digest(original),'old task immutable');
  summary.source_unchanged=true;await fs.writeFile(path.join(evidence,execute?'browser-summary.json':'browser-summary-readback.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({runs:summary.runs.map(r=>({run_id:r.run_id,status:r.status,evidence:r.evidence_status})),browser:'verified',restart:true}));
}finally{await browser?.close();await stop();}
