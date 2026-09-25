import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DevelopmentSession } from '../server/build/development-session.mjs';
import { developmentBundle, verifyBundle } from '../server/build/development-bundle.mjs';
import { checkDevelopmentCandidate } from '../server/build/development-policy.mjs';
import { developmentToolAllowed } from '../server/build/development-tool-guard.mjs';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import http from 'node:http';
const source = `import {test,expect} from '@playwright/test';
import {readLabel} from './helpers/read.mjs';
test('engineering', async({page},info)=>{await page.goto(process.env.PROBE_URL);await test.step('CASE_STEP_1',async()=>{try {await expect(page.locator('p')).toHaveText('good'); const value=await readLabel(page);expect(value).toBe('good');await info.attach('diagnostic',{body:await page.screenshot(),contentType:'image/png'});}catch(error){console.log('diagnostic failure');throw error;}});});`;
test('native file paths and read-only DOM operations are allowed; escapes and mutation remain denied', async()=>{
 const root=await fs.mkdtemp(path.resolve('workbench/.local/dev-boundary-'));
 try {
 assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_snapshot',{filename:'observation.yml'},'',root),true);
 assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_snapshot',{filename:'../outside.yml'},'',root),false);
 for(const tool of ['read','write','edit','read_image'])assert.equal(developmentToolAllowed(tool,{file_path:path.join(root,'helper.mjs')},'http://normal',root),true);
 assert.equal(developmentToolAllowed('read',{file_path:'.playwright-mcp/page.yml'},'',root),true);
 assert.equal(developmentToolAllowed('write',{file_path:'.playwright-mcp/page.yml'},'',root),false);
 assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_evaluate',{function:'() => document.getElementById("dlg").className'},'',root),true);
 for(const file of ['../private.json','node_modules/x.mjs','.env','package.json'])assert.equal(developmentToolAllowed('write',{file_path:file},'',root),false);
 assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_evaluate',{function:'() => document.querySelector("p").textContent'},'',root),true);
 assert.equal(developmentToolAllowed('mcp__playwright-mcp__browser_evaluate',{function:'() => document.querySelector("p").textContent="good"'},'',root),false);
 checkDevelopmentCandidate(source,{importAllowed:s=>s==='./helpers/read.mjs'});
 for(const code of ['await page.evaluate(()=>document.body.remove());','await page.route("**",()=>{});','test.skip();','await import("node:fs");'])assert.throws(()=>checkDevelopmentCandidate(source+code,{importAllowed:()=>true}));
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('real executor snapshots helpers, native edits invalidate old proof, and frozen bundle keeps exact dependency bytes',async()=>{
 const directory=await fs.mkdtemp(path.resolve('workbench/.local/dev-bundle-'));
 const server=http.createServer((req,res)=>{res.end('<p>good</p>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const session=new DevelopmentSession({directory,frozenCase:{steps:[{order:1,expected:'The label is good'}]},normalUrl:`http://127.0.0.1:${server.address().port}`,signal:new AbortController().signal,persist:async()=>{},verify:o=>verifyWorkbenchCandidate({...o,browserExecutable:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'})});
 try {
 await session.init();await fs.mkdir(path.join(directory,'draft/helpers'));await fs.writeFile(session.draftPath,source);await fs.writeFile(path.join(directory,'draft/helpers/read.mjs'),'export const readLabel=page=>page.evaluate(()=>document.querySelector("p").textContent);');
 const diagnostic=await session.invoke('run_diagnostic');assert.equal(diagnostic.results.every(r=>r.exit_code===0),true);assert.equal(diagnostic.executes_candidate,false);
 await fs.mkdir(path.join(directory,'draft/.playwright-mcp'));await fs.writeFile(path.join(directory,'draft/.playwright-mcp/page.yml'),'Browser managed snapshot');
 const first=await session.invoke('self_test');assert.equal(first.result?.complete_pass,true,JSON.stringify(first));assert.equal(first.files.length,2);
 const submit={sha256:first.sha256,outcome:'ready',coverage:[{order:1,requirement:'The label is good',check_lines:[3],execution:1,uncovered:''}]};
 await fs.appendFile(path.join(directory,'draft/helpers/read.mjs'),'\n// changed dependency');
 await assert.rejects(session.invoke('submit_candidate',submit),/CURRENT_BYTES_REQUIRE_SELF_TEST/);
 const second=await session.invoke('self_test');assert.equal(second.result.complete_pass,true);assert.notEqual(second.bundle_sha256,first.bundle_sha256);
 submit.coverage[0].execution=2;await session.invoke('submit_candidate',submit);
 assert.equal(await verifyBundle(path.join(directory,'final'),session.state.submission.bundle),true);
 await fs.appendFile(path.join(directory,'final/helpers/read.mjs'),'\n// tampering');assert.equal(await verifyBundle(path.join(directory,'final'),session.state.submission.bundle),false);
 await fs.writeFile(path.join(directory,'draft/.playwright-mcp/hidden.mjs'),'export const hidden=1;');await fs.writeFile(path.join(directory,'draft/helpers/read.mjs'),'export {hidden} from "../.playwright-mcp/hidden.mjs";');await assert.rejects(developmentBundle(path.join(directory,'draft')),/IMPORT_ALLOWED/);
 await fs.writeFile(path.join(directory,'draft/helpers/read.mjs'),'export {readFile} from "node:fs";');await assert.rejects(developmentBundle(path.join(directory,'draft')),/IMPORT_ALLOWED/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(directory,{recursive:true,force:true});}
});
