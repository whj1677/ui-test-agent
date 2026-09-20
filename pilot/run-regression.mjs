import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const spec=path.join(root,'tests/sorting.spec.ts');
const approvalFile=path.join(root,'private/human-approval.json');
const mode=process.argv[2];
if(!['--draft-check','--formal'].includes(mode))throw Error('EXPLICIT_MODE_REQUIRED');
const correction=process.argv[3];
if(correction!==undefined && !(mode==='--draft-check' && correction==='correction-2'))throw Error('ATTEMPT_LABEL_DENIED');
// Approval is a separate human decision, never inferred from a passing dry run.
let approval;
if(mode==='--formal'){
 try{approval=JSON.parse(await fs.readFile(approvalFile));}catch{throw Error('HUMAN_APPROVAL_REQUIRED');}
 if(approval.approved!==true||!approval.reviewer||!approval.user_confirmation||!approval.reviewed_at)throw Error('HUMAN_APPROVAL_REQUIRED');
}
const scriptHash=hash(await fs.readFile(spec));
const configHash=hash(await fs.readFile(path.join(root,'playwright.config.ts')));
const runnerHash=hash(await fs.readFile(fileURLToPath(import.meta.url)));
const dependencyHash=hash(await fs.readFile(path.join(root,'package-lock.json')));
const frozen=JSON.parse(await fs.readFile(path.join(root,'../heldout-lab/manifest.json')));
for(const f of frozen.files)assert.equal(hash(await fs.readFile(path.join(root,'../heldout-lab',f.path))),f.sha256,'FROZEN_ASSET_CHANGED');
const original=JSON.parse(await fs.readFile(path.join(root,'../heldout-lab/cases.json'))).cases;
const normal=original.find(c=>c.case_id==='HOLD-S1'),fault=original.find(c=>c.case_id==='HOLD-S2');
const semantics=c=>({data:c.data,preconditions:c.preconditions,read_only_scope:c.read_only_scope,steps:c.steps.map(s=>({...s,action:s.action.replaceAll(c.page_entry_url,'<ORIGINAL_ENTRY>')}))});
assert.deepEqual(semantics(normal),semantics(fault),'PAIRED_ORIGINAL_SEMANTICS_DIFFER');
const caseHash=hash(JSON.stringify(semantics(normal)));
if(approval){assert.equal(approval.script_sha256,scriptHash);assert.equal(approval.config_sha256,configHash);assert.equal(approval.case_semantics_sha256,caseHash);assert.equal(approval.runner_sha256,runnerHash);assert.equal(approval.dependency_sha256,dependencyHash);}
const dir=path.join(root,'private',mode==='--formal'?'formal-sorting':correction?'draft-check-correction-2':'draft-check');
// Exclusive mkdir reserves the attempt before any execution; never overwrite a failed run.
await fs.mkdir(dir);
const start=Date.now();const receipts=[];
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({mode,started_at:new Date(start).toISOString(),script_sha256:scriptHash,config_sha256:configHash,case_semantics_sha256:caseHash,runner_sha256:runnerHash,dependency_sha256:dependencyHash,retries:0,model_calls:0,human_approval:approval??null},null,2));
for(const c of (mode==='--formal'?[normal,fault]:[normal])){
 assert.equal(hash(await fs.readFile(spec)),scriptHash);assert.equal(hash(await fs.readFile(path.join(root,'playwright.config.ts'))),configHash);
 const name=c.case_id,begin=Date.now();
 const response=await fetch(c.page_entry_url);
 assert.equal(response.status,200);
 assert.equal(hash(Buffer.from(await response.arrayBuffer())),frozen.files.find(f=>f.path==='index.html').sha256,'SERVED_PAGE_CHANGED');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(ANTHROPIC|DEEPSEEK|API_KEY|AUTH_TOKEN)/i.test(k)));
 Object.assign(env,{PILOT_ENTRY_URL:c.page_entry_url,PILOT_RESULT_DIR:path.join(dir,name+'-artifacts'),PILOT_JSON_REPORT:path.join(dir,name+'.json'),PILOT_HTML_REPORT:path.join(dir,name+'-html')});
 const log=await fs.open(path.join(dir,name+'.log'),'wx');
 const cli=path.join(root,'node_modules/playwright/cli.js');
 const child=spawn(process.execPath,[cli,'test','--config=playwright.config.ts','--repeat-each='+ (mode==='--formal'?3:1),'--workers=1','--retries=0'],{cwd:root,env,stdio:['ignore',log.fd,log.fd],windowsHide:true});
 const exit=await new Promise(resolve=>{child.once('exit',resolve);child.once('error',()=>resolve(-1));});await log.close();
 assert.equal(hash(await fs.readFile(spec)),scriptHash);assert.equal(hash(await fs.readFile(path.join(root,'playwright.config.ts'))),configHash);
 receipts.push({case_id:name,entry:c.page_entry_url,exit_code:exit,elapsed_ms:Date.now()-begin,repeats:mode==='--formal'?3:1});
 await fs.writeFile(path.join(dir,'receipts.json'),JSON.stringify(receipts,null,2));
 if(mode==='--draft-check')process.exitCode=exit??1;
}
console.log(JSON.stringify({mode,receipts,total_ms:Date.now()-start,model_calls:0,semantic_acceptance:'REQUIRES_EVIDENCE_REVIEW'}));
