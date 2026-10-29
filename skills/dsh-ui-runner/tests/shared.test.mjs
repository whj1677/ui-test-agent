import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishShared,useShared} from '../scripts/shared.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'dsh-shared-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'controls.mjs'),'export async function ready(p){return p.ready;} export async function click(p,v){p.clicked=v; return v;}');
  return {root,page:{url:()=> 'https://example.test/module',ready:true},entries:[{id:'click',file:'controls.mjs',operation:'click',verify:'ready'}]};
}
test('publishes guarded technical operations and rechecks guard before reuse',async t=>{
  const f=await fixture(t); await publishShared(f);
  const ops=await useShared({...f,ids:['click']}); assert.equal(await ops.click('x'),'x');
  f.page.ready=false; await assert.rejects(useShared({...f,ids:['click']}),/STALE/);
});
test('rejects changed operation source before executing it',async t=>{
  const f=await fixture(t); await publishShared(f);
  await fs.appendFile(path.join(f.root,'controls.mjs'),'\n// changed');
  await assert.rejects(useShared({...f,ids:['click']}),/SOURCE_CHANGED/);
});
test('module change cannot silently reuse old operations',async t=>{
  const f=await fixture(t); await publishShared(f); f.page.url=()=> 'https://example.test/other';
  await assert.rejects(useShared({...f,ids:['click']}),/SCOPE_MISMATCH/);
});
test('failed live verification cannot publish a manifest',async t=>{
  const f=await fixture(t); f.page.ready=false;
  await assert.rejects(publishShared(f),/GUARD_FAILED/);
  await assert.rejects(fs.stat(path.join(f.root,'manifest.json')), {code:'ENOENT'});
});
test('an operation outside the supplied shared directory is rejected',async t=>{
  const f=await fixture(t); f.entries[0].file='../elsewhere.mjs';
  await assert.rejects(publishShared(f),/OUTSIDE_ROOT/);
});
