import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readBrowserAssertionEvidence, applyBrowserAssertionVerdict } from '../server/build/browser-assertion-records.mjs';

test('missing later checks cannot erase a real fail-fast business mismatch',()=>{
 const content={steps:[{order:1,expected:'保存失败'}],test_data:'[workbench-browser-assertions-v1]'+JSON.stringify([{id:'no-write',step_order:1,source_quote:'保存失败',kind:'no_writes',contract:{paths:['/api/a'],methods:['PUT']}}])+'[/workbench-browser-assertions-v1]'};
 const error={type:'ASSERTION_MISMATCH',expected:'name',actual:'wrong'};
 const failed=applyBrowserAssertionVerdict({complete_pass:false,test_status:'FAILED',error},{status:'NOT_USED',records:[]},content);
 assert.deepEqual(failed.error,error);assert.equal(failed.browser_assertion_obligations.status,'MISSING');
 const green=applyBrowserAssertionVerdict({complete_pass:true,test_status:'PASSED',error:null},{status:'NOT_USED',records:[]},content);
 assert.equal(green.complete_pass,false);assert.equal(green.test_status,'FAILED');assert.equal(green.error.code,'FROZEN_BROWSER_ASSERTION_REQUIREMENT_FAILED');
});

test('browser assertion records reject stale run, bundle and case evidence; unused is not coverage', async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'browser-records-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const identity={run_id:'run-1',candidate_sha256:'a'.repeat(64),candidate_bundle_sha256:'b'.repeat(64),executed_case_id:'case-1',executed_case_version:2,executed_content_sha256:'c'.repeat(64)};
 assert.equal((await readBrowserAssertionEvidence(root,identity)).status,'NOT_USED');
 const dir=path.join(root,'artifacts','step-evidence');await fs.mkdir(dir,{recursive:true});
 const file=path.join(dir,'browser-assertions.ndjson');
 const record={schema:'workbench/browser-assertion-evidence-v1',...identity,step_order:2,status:'PASSED',kind:'no_writes'};
 const write=row=>fs.writeFile(file,JSON.stringify(row)+'\n');
 await write(record);assert.equal((await readBrowserAssertionEvidence(root,identity)).status,'CHECKS_PASSED');
 for(const key of ['run_id','candidate_sha256','candidate_bundle_sha256','executed_case_id','executed_content_sha256']){
  await write({...record,[key]:'other'});await assert.rejects(readBrowserAssertionEvidence(root,identity),/IDENTITY_INVALID/);
 }
 await write({...record,status:'UNKNOWN'});assert.equal((await readBrowserAssertionEvidence(root,identity)).status,'CHECKS_NOT_PASSED');
 await write({...record,executed_case_version:1});await assert.rejects(readBrowserAssertionEvidence(root,identity),/IDENTITY_INVALID/);
 await fs.writeFile(file,'{');await assert.rejects(readBrowserAssertionEvidence(root,identity),/RECORD_INVALID/);
});
