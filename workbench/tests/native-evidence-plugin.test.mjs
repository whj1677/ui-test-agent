import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { instrumentNativeSource } from '../server/native-dsh/evidence-transform.mjs';
const require=createRequire(import.meta.url);
const {babelTransform,babelParse}=require(path.join(path.dirname(require.resolve('playwright/package.json')),'lib/transform/babelBundle.js'));
const plugin=require.resolve('../server/native-dsh/evidence-plugin.cjs');
const steps=[{order:1},{order:2}];

test('the real Babel evidence plugin retains exported class bindings and aliased imports',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-evidence-plugin-'));
 const prior=process.env.NATIVE_EVIDENCE_CONFIG;
 try {
  const file=path.join(root,'helper.mjs'),config=path.join(root,'config.json');
  const source="import {expect as verify} from '@playwright/test';export class Checks {same(v){verify(v).toEqual(v);}} export function make(){return new Checks();}";
  await fs.writeFile(config,JSON.stringify({snapshot:root,entry:'case.spec.mjs',runDirectory:root,files:[{path:'helper.mjs'}],caseContent:{steps}}));
  process.env.NATIVE_EVIDENCE_CONFIG=config;
  const output=babelTransform(source,file,true,[],[[plugin,{}]]);
  assert.ok(output.code.includes('wrapExpect'));
  assert.doesNotThrow(()=>babelParse(output.code,file,true));
  assert.equal((output.code.match(/class Checks/g)||[]).length,1);
 } finally {
  if(prior===undefined)delete process.env.NATIVE_EVIDENCE_CONFIG;else process.env.NATIVE_EVIDENCE_CONFIG=prior;
  await fs.rm(root,{recursive:true,force:true});
 }
});

test('named test steps inside cleanup try blocks retain their original callbacks and return values',()=>{
 const source="import {test,expect} from '@playwright/test';test('CASE-1',async()=>{try{await test.step('CASE_STEP_1',async()=>{const n=1;expect(n).toBe(1);return n;});await test.step('CASE_STEP_2',async()=>{expect(false).toBe(false);});}finally{console.log('cleanup');}});";
 const output=instrumentNativeSource(source,'case.spec.mjs',{entry:true,steps});
 assert.equal(output.mapping.status,'BOUND');
 assert.equal(output.mapping.method,'NAMED_TEST_STEPS');
 assert.deepEqual(output.mapping.boundaries.map(s=>s.order),[1,2]);
 assert.equal((output.source.match(/test\.step\(/g)||[]).length,2);
 assert.equal((output.source.match(/return n;/g)||[]).length,1);
 assert.match(output.source,/finally\{console\.log\('cleanup'\)/);
 assert.doesNotThrow(()=>babelParse(output.source,'case.spec.mjs',true));
});

test('missing, duplicate, out-of-order, nested or dynamic test steps remain unbound',()=>{
 const cases=[
  "await test.step('CASE_STEP_1',async()=>{});",
  "await test.step('CASE_STEP_1',async()=>{});await test.step('CASE_STEP_1',async()=>{});",
  "await test.step('CASE_STEP_2',async()=>{});await test.step('CASE_STEP_1',async()=>{});",
  "await test.step('CASE_STEP_1',async()=>{await test.step('CASE_STEP_2',async()=>{});});",
  "await test.step(name,async()=>{});await test.step('CASE_STEP_2',async()=>{});",
 ];
 for(const body of cases){const source=`import {test} from '@playwright/test';test('CASE-1',async()=>{${body}});`;
  assert.equal(instrumentNativeSource(source,'case.spec.mjs',{entry:true,steps}).mapping.status,'UNAVAILABLE',body);
 }
});
