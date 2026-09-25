// Locked real tools and executor; model drivers disabled. --original is a one-shot business execution.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runProfile } from '../../harness-probe/node_modules/@deepseek-ai/dsh/lib/profile-boot.js';
import { loadLayeredEnv } from '../../harness-probe/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js';
import { developmentPatch } from '../server/build/development-patch.mjs';
import { startDevelopmentMcp } from '../server/build/development-mcp.mjs';
import { DevelopmentSession,digest } from '../server/build/development-session.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
const workbench=fileURLToPath(new URL('../',import.meta.url));
const original=process.argv.includes('--original');
const directory=original?path.join(workbench,'.local/br25-original'):await fs.mkdtemp(path.join(workbench,'.local/dev-preflight-'));
await fs.mkdir(directory,{recursive:true});
if(original)await fs.writeFile(path.join(directory,'execution-claimed.json'),JSON.stringify({at:new Date().toISOString(),limit:1}),{flag:'wx'});
const local=JSON.parse(await fs.readFile(path.join(workbench,'scripts/start-workbench.local.json'))).profiles.e2e;
const seed=original?await fs.readFile(path.join(workbench,'qa/20260925-autonomous/b-open/draft/candidate.spec.mjs')):null;
if(seed)assert.equal(digest(seed),'E8B05F854163B65BC5CD703BA5F28CCCB858DF5E6AB1D983FAD4E0253AE94022');
const frozenCase=original?JSON.parse(await fs.readFile(path.join(workbench,'qa/20260924/site/cases.workbench.json'))).cases.find(c=>c.content.external_id==='NEW-002').content:{steps:[{order:1,expected:'The observed label is good'}]};
const html=original?await fs.readFile(path.join(workbench,'qa/20260924/site/index.html')):Buffer.from('<main><p id="label">good</p></main>');
const site=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});await new Promise(r=>site.listen(0,'127.0.0.1',r));
const normalUrl=`http://127.0.0.1:${site.address().port}/index.html?scene=retry&variant=normal`;
const executable='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const session=new DevelopmentSession({directory,frozenCase,normalUrl,signal:new AbortController().signal,persist:state=>fs.writeFile(path.join(directory,'state.json'),JSON.stringify(state,null,2)),verify:options=>verifyWorkbenchCandidate({...options,browserExecutable:executable})});
await session.init(seed);const draft=path.dirname(session.draftPath);
const bridge=await startDevelopmentMcp((name,args)=>session.invoke(name,args),{getState:()=>session.state});
process.env.DSH_HOME=local.WORKBENCH_DSH_HOME;process.env.DSH_PROBE_BROWSER_EXECUTABLE=executable;
process.env.WORKBENCH_DEVELOPMENT_ENDPOINT=bridge.url;process.env.WORKBENCH_DEVELOPMENT_NORMAL_URL=normalUrl;process.env.WORKBENCH_DEVELOPMENT_DIRECTORY=draft;
const previous=process.cwd();process.chdir(draft);let boot,handle;const records=[];
try{
 const patch=path.join(directory,'zero-model.yml');await fs.writeFile(patch,developmentPatch(await fs.readFile(local.WORKBENCH_HARNESS_PATCH,'utf8'),workbench)+'\n- id: headless-startup\n  disabled: true\n- id: headless-runner\n  disabled: true\n- id: llm-retry\n  disabled: true\n');
 boot=await runProfile({environment:loadLayeredEnv('dsh'),profile:'headless',patchFiles:[patch],args:[]});
 handle=await boot.ctx.agents.create({sessionId:`session-${randomUUID()}`,meta:{cwd:draft}});
 async function call(name,args={},expectedError=false){const result=await boot.ctx.tools.execute({callId:`call-${randomUUID()}`,name,arguments:args,agent:handle.agent,signal:new AbortController().signal});records.push({tool:name,input:args,isError:!!result.isError,text:result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n'),image_count:result.content?.filter(c=>c.type==='image').length||0});assert.equal(!!result.isError,expectedError,JSON.stringify(result));return result;}
 const text=r=>r.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'';
 const value=r=>JSON.parse(text(r));
 await call('mcp__playwright-mcp__browser_navigate',{url:normalUrl});
 const snap=await call('mcp__playwright-mcp__browser_snapshot',{filename:'engineering-snapshot.yml'});
 const match=text(snap).match(/\[[^\]]+\]\(([^)]+)\)/);assert.ok(match,text(snap));
 const snapshotPath=path.resolve(draft,match[1]);
 const read=await call('read',{file_path:snapshotPath});assert.ok(text(read).length>0);
 await call('mcp__playwright-mcp__browser_evaluate',{function:'() => document.body.textContent'});
 await fs.writeFile(path.join(directory,'private-credential.json'),'engineering-canary-not-a-real-credential');
 const deniedRead=await call('read',{file_path:path.join(directory,'private-credential.json')},true);assert.match(text(deniedRead),/TASK_TOOL_POLICY_DENIED/);assert.ok(!text(deniedRead).includes('engineering-canary-not-a-real-credential'));
 if(!original){
  const helper=path.join(draft,'helper.mjs');await call('read',{file_path:helper},true);await call('write',{file_path:helper,content:'export const expected="bad";'});
  await call('read',{file_path:session.draftPath},true);
  await call('write',{file_path:session.draftPath,content:`import {test,expect} from '@playwright/test';\nimport {expected} from './helper.mjs';\ntest('engineering',async({page})=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{await expect(page.locator('p')).toHaveText(expected);});});`});
 }
 if(!original){
  const helper=path.join(draft,'helper.mjs');
  await call('edit',{file_path:helper,old_string:'export const expected="bad";',new_string:'export {expected} from "./.playwright-mcp/observation.mjs";'});
  const rejected=await call('mcp__workbench__self_test',{},true);assert.match(text(rejected),/IMPORT_ALLOWED/);assert.equal(session.state.self_tests.length,0);
  await call('edit',{file_path:helper,old_string:'export {expected} from "./.playwright-mcp/observation.mjs";',new_string:'export const expected="bad";'});
 }
 const diagnostic=value(await call('mcp__workbench__run_diagnostic'));assert.ok(diagnostic.results.every(r=>r.exit_code===0));
 const first=value(await call('mcp__workbench__self_test'));assert.ok(first.result,JSON.stringify(first));
 assert.ok(first.files.every(f=>!f.path.startsWith('.playwright-mcp')));assert.ok(await fs.stat(snapshotPath));
 const report=value(await call('mcp__workbench__read_evidence',{execution:1,kind:'report'}));assert.ok(report.raw_report);
 const image=await call('mcp__workbench__read_evidence',{execution:1,kind:'screenshot'});const rawImages=[];const scan=v=>{if(!v||typeof v!=='object')return;if(v.type==='image'&&v.data)rawImages.push(v);for(const child of Object.values(v))if(typeof child==='object')scan(child);};scan(image.value);assert.ok(rawImages.length,JSON.stringify({keys:Object.keys(image.value||{}),text:text(image)}));assert.equal(digest(Buffer.from(rawImages[0].data,'base64')),first.media.find(f=>f.relative_path.endsWith('.png')).sha256);
 if(!original){
  assert.equal(first.result.test_status,'FAILED');assert.equal(first.result.error.actual,'good');assert.ok(first.files.some(f=>f.path==='helper.mjs'));
  await call('read',{file_path:path.join(draft,'helper.mjs')});await call('edit',{file_path:path.join(draft,'helper.mjs'),old_string:'"bad"',new_string:'"good"'});
  const second=value(await call('mcp__workbench__self_test'));assert.equal(second.result.complete_pass,true);
  await call('mcp__workbench__submit_candidate',{sha256:second.sha256,outcome:'ready',coverage:[{order:1,requirement:frozenCase.steps[0].expected,check_lines:[3],execution:2,uncovered:''}]});
 }
 await fs.writeFile(path.join(directory,'tool-chain.json'),JSON.stringify({model_calls:0,original,normal_url:normalUrl,records,state:session.state},null,2));
 console.log(JSON.stringify({status:'REAL_TOOL_CHAIN_VERIFIED',model_calls:0,original,actual_executions:session.state.self_tests.length,result:first.result.test_status,bundle:first.bundle_sha256,directory}));
}finally{await fs.writeFile(path.join(directory,'tool-chain-partial.json'),JSON.stringify(records,null,2));await handle?.dispose();await boot?.ctx.fiber.dispose();await bridge.close();site.closeAllConnections();await new Promise(r=>site.close(r));process.chdir(previous);}
