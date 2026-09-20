// Read-only bookkeeping. Does not judge semantic correctness or grant approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const reports=[];
for(const round of ['draft-1','correction-1','correction-2']){
 let receipt;try{receipt=JSON.parse(await fs.readFile(path.join(root,'private',round+'-result.json')));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const launch=JSON.parse(await fs.readFile(path.join(root,'private',round+'-launch.json')));
 const messages=(await fs.readFile(path.join(root,'private',round+'-session.jsonl'),'utf8')).trim().split('\n').map(l=>JSON.parse(l));
 const end=messages.findLast(m=>m.type==='result');
 const tools=messages.find(m=>m.type==='system'&&m.subtype==='init')?.tools??[];
 if(tools.some(t=>!t.startsWith('mcp__playwright-test__')))throw Error('UNEXPECTED_AUTHORING_TOOL');
 let log=[];try{log=(await fs.readFile(path.join(root,'private',round+'-tools.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(e=>e.at>=launch.started_at&&e.at<=receipt.finished_at);}catch(e){if(e.code!=='ENOENT')throw e;}
 reports.push({round,...receipt,model:launch.model,tool_calls:log.filter(e=>e.kind==='call').length,tool_denials:log.filter(e=>e.kind==='denied').length,tool_errors:log.filter(e=>e.kind==='result'&&e.result?.isError).length,model_turns:end?.num_turns??null,usage:end?.usage??null,cli_estimated_usd:end?.total_cost_usd??null,cost_caveat:'CLI estimate only, not provider billing; interrupted round total unknown',tools});
}
const checks=[];
for(const name of ['draft-check','draft-check-correction-2']){
 try{checks.push({attempt:name,receipts:JSON.parse(await fs.readFile(path.join(root,'private',name,'receipts.json')))});}catch(e){if(e.code!=='ENOENT')throw e;}
}
const hashFile=async p=>createHash('sha256').update(await fs.readFile(path.join(root,p))).digest('hex');
console.log(JSON.stringify({route:'Coding Agent assisted / human first review / fixed Playwright regression',base_commit:'c1e9455d6cb32fd919b604585ba440c4997448ee',authoring:reports,authoring_wall_ms:reports.reduce((n,r)=>n+r.elapsed_ms,0),engineering_normal_checks:checks,human_review:{status:'PENDING',measured_minutes:null},formal_regression:{executed:0,normal_planned:3,fault_planned:3,model_calls:0},hashes:{script:await hashFile('tests/sorting.spec.ts'),config:await hashFile('playwright.config.ts'),runner:await hashFile('run-regression.mjs'),dependencies:await hashFile('package-lock.json')},scope:'No autonomous product acceptance or generalization claim'},null,2));
