// Read-only checks against the single already running official workbench.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sourceFingerprint } from '../server/service-identity.mjs';
const base='http://127.0.0.1:4322';
if (process.env.WORKBENCH_URL && process.env.WORKBENCH_URL.replace(/\/$/,'')!==base) throw Error('OFFICIAL_WORKBENCH_PORT_MUST_BE_4322');
const get=async route=>{const r=await fetch(base+route,{signal:AbortSignal.timeout(10000),redirect:'error'});assert.equal(r.status,200,route);return r;};
const health=await (await get('/api/health')).json();
assert.equal(health.service,'approved-test-workbench');
assert.equal(health.status,'ready');
assert.equal(health.service_identity?.schema,'workbench/service-identity-v1','Current service must be reloaded through the original launcher');
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const current=await sourceFingerprint(repoRoot);
assert.equal(health.service_identity.source_sha256,current.source_sha256,'Loaded service does not match current source files');
const html=await (await get('/workspace/')).text();
assert.match(html,/<script/);
const projects=await (await get('/api/case-library/projects')).json();
assert.ok(Array.isArray(projects.projects));
const result={schema:'workbench/official-readonly-check-v1',at:new Date().toISOString(),entry:base+'/workspace/',
  scope:'read-only official service and source identity; no new business/model execution',checks:4,
  service_identity:health.service_identity,project_count:projects.projects.length,
  active:Boolean(health.active_run_id||health.active_build_task_id||health.active_batch_id||health.active_script_operation_id||health.preparing)};
const index=process.argv.indexOf('--output');
if(index!==-1){if(!process.argv[index+1])throw Error('OUTPUT_PATH_REQUIRED');await fs.writeFile(path.resolve(process.argv[index+1]),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
