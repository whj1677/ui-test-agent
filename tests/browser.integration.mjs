import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BrowserSession} from '../src/browser.mjs';
import {demoCases,startDemo} from '../src/demo.mjs';
import {hash,uid} from '../src/common.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(ROOT,'validation','browser-'+Date.now());await fs.mkdir(directory,{recursive:true});
const demo=await startDemo(),browser=new BrowserSession({headless:true});const {baseline,plans}=demoCases();
const task={id:uid(),target:demo.url+'/catalog',authorization:{nonproduction:true,writes:true,readOnlyEndpoints:[]},baseline_sha256:hash(baseline),fixture:true};
const results=[];
async function run(c,p){const dir=path.join(directory,uid());const events=[];const r=await browser.execute(task,c,p,dir,{onEvent:e=>events.push(e)});await fs.writeFile(path.join(dir,'facts.json'),JSON.stringify(r,null,2));results.push({case_id:c.case_id,status:r.status,error:r.error,cleanup:r.cleanup_status,events:events.map(e=>e.type)});return r;}
try{
  await browser.open(task);await browser.loginPage.getByRole('button',{name:'进入演示'}).click();await browser.authenticate(task,{kind:'testid',value:'signed-in'});
  const read=await run(baseline.cases[0],plans[0]);assert.equal(read.status,'PASS_ASSERTIONS',JSON.stringify(read));assert.equal(read.assertions.length,2);assert.ok(read.media.some(m=>m.type==='video'));
  const write=await run(baseline.cases[1],plans[1]);assert.equal(write.status,'PASS_ASSERTIONS',JSON.stringify(write));assert.equal(write.cleanup_status,'CLEAN');assert.equal(demo.tasks.size,0);assert.equal(demo.logins,1);
  const missing=structuredClone(plans[0]);missing.preconditions=[{target:{kind:'testid',value:'prerequisite-missing'},check:'visible'}];const pre=await run(baseline.cases[0],missing);assert.equal(pre.status,'BLOCKED_DATA');assert.equal(pre.actions.length,0);assert.equal(pre.media.length,0);
  const bad=structuredClone(plans[0]);bad.steps[0].actions[0].target.value='missing-input';const locator=await run(baseline.cases[0],bad);assert.equal(locator.status,'TECHNICAL_FAILED');assert.equal(locator.actions[0].status,'FAILED');assert.ok(locator.failure_snapshot.controls.length);
  const diff=structuredClone(plans[0]);diff.steps[0].assertions[0].expected='香蕉';const mismatch=await run(baseline.cases[0],diff);assert.equal(mismatch.status,'FAIL_ASSERTION');assert.equal(mismatch.assertions[0].actual,'苹果');
  const forbidden=structuredClone(plans[1]);forbidden.data_effect='read_only';forbidden.cleanup=null;const noWrite=await run(baseline.cases[1],forbidden);assert.equal(noWrite.status,'BLOCKED_WRITE');assert.equal(demo.tasks.size,0);
  const stopped=new AbortController();stopped.abort();const stopResult=await browser.execute(task,baseline.cases[0],plans[0],path.join(directory,uid()),{signal:stopped.signal});assert.equal(stopResult.status,'STOPPED');assert.equal(stopResult.actions.length,0);
  demo.expire();const auth=await run(baseline.cases[0],plans[0]);assert.equal(auth.status,'AUTH_REQUIRED');assert.equal(auth.actions.length,0);assert.equal(auth.media.length,0);
  await browser.loginPage.goto(task.target);await browser.loginPage.getByRole('button',{name:'进入演示'}).click();await browser.authenticate(task,{kind:'testid',value:'signed-in'});const resume=await run(baseline.cases[0],plans[0]);assert.equal(resume.status,'PASS_ASSERTIONS');assert.equal(demo.logins,2);
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({scope:'Real Chromium against local synthetic apps, no DeepSeek network requests',results,login_count:demo.logins},null,2));
  process.stdout.write(JSON.stringify({validated:true,directory,scenarios:results.length+1,initial_two_domain_logins:1,expiry_recovery_logins:1})+'\n');
}finally{await browser.close();await demo.close();}
