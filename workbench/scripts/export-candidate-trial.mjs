import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../server/build/development-session.mjs';
const wb=fileURLToPath(new URL('../',import.meta.url)),repo=path.dirname(wb),root=path.join(wb,'.local/fresh25-b'),privateEvidence=path.join(root,'trial-ui-acceptance'),out=path.join(wb,'qa/20260925-candidate-trial');
await fs.mkdir(out,{recursive:true});
const selection=JSON.parse(await fs.readFile(path.join(wb,'config/fresh-b-trial.json'))).authorizations[0];
const manifest={schema:'candidate-trial-evidence-v1',harness_starts:0,model_calls:0,product_executions:2,selection,files:[],runs:[],redaction:'Absolute repository paths replaced in JSON/text; no sessions, credentials, original videos or trace archives exported.'};
function sanitize(v){if(typeof v==='string')return v.replaceAll(repo.replaceAll('\\','\\\\'),'<REPO>').replaceAll(repo,'<REPO>').replaceAll(repo.replaceAll('\\','/'),'<REPO>').replaceAll(process.env.USERPROFILE,'<USER_HOME>');if(Array.isArray(v))return v.map(sanitize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,sanitize(x)]));return v;}
async function copy(source,name,kind){const original=await fs.readFile(source);const bytes=kind==='json'?Buffer.from(JSON.stringify(sanitize(JSON.parse(original)),null,2)+'\n'):kind==='text'?Buffer.from(sanitize(original.toString('utf8'))):original;await fs.writeFile(path.join(out,name),bytes);manifest.files.push({file:name,source_sha256:digest(original),sha256:digest(bytes),bytes:bytes.length});}
for(const lane of ['normal','negative']){
  const receipt=JSON.parse(await fs.readFile(path.join(privateEvidence,`${lane}-receipt.json`)));const directory=path.join(root,'data/runs',receipt.run_id);const run=JSON.parse(await fs.readFile(path.join(directory,'run.json')));
  manifest.runs.push({run_id:run.run_id,status:run.status,complete_pass:run.complete_pass,bundle_sha256:run.bundle_sha256,evidence_status:run.evidence_status,environment:run.environment_binding,steps:run.step_coverage.items.map(s=>({step:s.marker,status:s.execution_status})),error:run.error});
  await copy(path.join(directory,'run.json'),`${lane}-run.json`,'json');await copy(path.join(directory,'execution/playwright-report.json'),`${lane}-playwright-report.json`,'json');
  await copy(path.join(directory,'execution/artifacts/step-evidence/step-observations.ndjson'),`${lane}-step-observations.ndjson`,'text');
  await copy(path.join(privateEvidence,`${lane}-result-readback.png`),`${lane}-result.png`);
}
await copy(path.join(privateEvidence,'case-automation.png'),'case-automation.png');
const browser=JSON.parse(await fs.readFile(path.join(privateEvidence,'browser-summary-readback.json')));delete browser.runs;
await fs.writeFile(path.join(out,'browser-summary.json'),JSON.stringify(sanitize(browser),null,2)+'\n');
const taskRoot=path.join(root,'build-tasks',selection.source_task_id),taskBytes=await fs.readFile(path.join(taskRoot,'task.json'));const originalTask=await fs.readFile(path.join(root,'trial-integration-backup/source-task.json'));
if(digest(taskBytes)!==digest(originalTask))throw Error('SOURCE_TASK_CHANGED');
const task=JSON.parse(taskBytes);for(const file of task.files)if(digest(await fs.readFile(path.join(taskRoot,file.relative_path)))!==file.sha256)throw Error('SOURCE_REGISTERED_FILE_CHANGED');
manifest.source_unchanged={task_sha256:digest(taskBytes),registered_files:task.files.length,harness_starts:task.development.harness_starts,self_tests:task.development.self_tests.length};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(sanitize(manifest),null,2)+'\n');
console.log(JSON.stringify({source_unchanged:manifest.source_unchanged,runs:manifest.runs.map(r=>({id:r.run_id,status:r.status,evidence:r.evidence_status}))}));
