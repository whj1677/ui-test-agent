import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {publishShared, useShared} from './shared.mjs';

const entry = {id:'search',file:'controls.mjs',operation:'search',verify:'verify'};
const control = `export async function verify(page) { return await page.getByRole('button', {name:'查询',exact:true}).count() === 1; }
export async function search(page) { return page.getByRole('button', {name:'查询',exact:true}).click(); }`;
async function fixture(t, source = control) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-shared-test-'));
  const root = path.join(base, 'shared');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'controls.mjs'), source);
  t.after(async () => {
    const relative = path.relative(os.tmpdir(), base);
    assert.match(relative, /^dsh-shared-test-[^\\/]+$/);
    await fs.rm(base, {recursive:true,force:true});
  });
  const state = {url:'http://example.test/app#/templates',count:1,clicks:0};
  const page = {url:()=>state.url,getByRole:()=>({count:async()=>state.count,click:async()=>++state.clicks})};
  return {root,base,page,state};
}

test('unchanged shared operation runs with a live guard', async t => {
  const {root,page,state} = await fixture(t);
  const manifest = await publishShared({page,root,entries:[entry]});
  assert.equal(manifest.module_url, state.url);
  const ops = await useShared({page,root,ids:['search']});
  assert.equal(await ops.search(), 1);
});

test('hash route and query changes reject cross-module reuse', async t => {
  const {root,page,state} = await fixture(t);
  await publishShared({page,root,entries:[entry]});
  for (const url of ['http://example.test/app#/parks','http://example.test/app?view=other#/templates']) {
    state.url = url;
    await assert.rejects(useShared({page,root,ids:['search']}), /SHARED_SCOPE_MISMATCH/);
  }
  assert.equal(state.clicks, 0);
});

test('retained operations recheck scope and guards immediately before acting', async t => {
  const {root,page,state} = await fixture(t);
  await publishShared({page,root,entries:[entry]});
  const ops = await useShared({page,root,ids:['search']});
  state.url = 'http://example.test/different';
  await assert.rejects(ops.search(), /SHARED_SCOPE_MISMATCH/);
  state.url = 'http://example.test/app#/templates';
  state.count = 2;
  await assert.rejects(ops.search(), /SHARED_STALE_REPAIR_THIS_OPERATION:search/);
  assert.equal(state.clicks, 0);
});

test('dependency repair requires a fresh process instead of executing stale ESM cache', async t => {
  const {root,page} = await fixture(t, `import {value} from './dep.mjs'; ${control}\nexport const read=async()=>value;`);
  await fs.writeFile(path.join(root,'dep.mjs'), `export const value='v1';`);
  const readEntry = {...entry, operation:'read'};
  await publishShared({page,root,entries:[readEntry]});
  const ops = await useShared({page,root,ids:['search']});
  assert.equal(await ops.search(), 'v1');
  await fs.writeFile(path.join(root,'dep.mjs'), `export const value='v2';`);
  await assert.rejects(ops.search(), /SHARED_SOURCE_CHANGED_RESTART_PROCESS_REQUIRED/);
  await assert.rejects(publishShared({page,root,entries:[readEntry]}), /SHARED_SOURCE_CHANGED_RESTART_PROCESS_REQUIRED/);
  await assert.rejects(useShared({page,root,ids:['search']}), /SHARED_SOURCE_CHANGED_RESTART_PROCESS_REQUIRED/);
  const code = `import {publishShared,useShared} from ${JSON.stringify(new URL('./shared.mjs', import.meta.url).href)};
    const root=process.argv[1], page={url:()=> 'http://example.test/app#/templates',getByRole:()=>({count:async()=>1})};
    await publishShared({page,root,entries:[${JSON.stringify(readEntry)}]});
    const ops=await useShared({page,root,ids:['search']});console.log(await ops.search());`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code,root], {encoding:'utf8',env:process.env}).trim(), 'v2');
});

test('local static and literal dynamic imports and node builtins are tracked and accepted', async t => {
  const {root,page} = await fixture(t, `import path from 'node:path'; import {value} from './dep.mjs'; ${control}\nexport const read=async()=>path.basename((await import('./dep.mjs')).value)+value;`);
  await fs.writeFile(path.join(root,'dep.mjs'), `export const value='ok';`);
  const manifest=await publishShared({page,root,entries:[{...entry,operation:'read'}]});
  assert.deepEqual(manifest.files.map(f=>f.file), ['controls.mjs','dep.mjs']);
  const ops=await useShared({page,root,ids:['search']});
  assert.equal(await ops.search(),'okok');
});

for (const [label, source, error] of [
  ['outside static import', `import '../external.mjs';`, /SHARED_IMPORT_OUTSIDE_ROOT/],
  ['outside re-export', `export * from '../external.mjs';`, /SHARED_IMPORT_OUTSIDE_ROOT/],
  ['outside literal dynamic import', `async function f(){return import('../external.mjs');}`, /SHARED_IMPORT_OUTSIDE_ROOT/],
  ['nonliteral dynamic import', `async function f(file){return import(file);}`, /SHARED_NONLITERAL_IMPORT_UNSUPPORTED/],
  ['template dynamic import', 'async function f(){return import(`./dep.mjs`);}', /SHARED_NONLITERAL_IMPORT_UNSUPPORTED/],
  ['bare third-party import', `import 'not-installed';`, /SHARED_EXTERNAL_IMPORT_UNSUPPORTED/],
  ['unsupported cjs import', `import './dep.cjs';`, /SHARED_IMPORT_TYPE_UNSUPPORTED/],
  ['untracked evidence import', `import './evidence/dep.mjs';`, /SHARED_IMPORT_UNTRACKED/],
  ['import URL suffix', `import './dep.mjs?version=2';`, /SHARED_IMPORT_URL_UNSUPPORTED/],
  ['require loader', `function f(){return require('./dep.cjs');}`, /SHARED_REQUIRE_UNSUPPORTED/],
]) {
  test(`reject ${label} before module execution`, async t => {
    const {root,page} = await fixture(t, `${source}\n${control}\nthrow Error('MODULE_EXECUTED');`);
    await assert.rejects(publishShared({page,root,entries:[entry]}), error);
    await assert.rejects(fs.access(path.join(root,'manifest.json')), {code:'ENOENT'});
  });
}

test('entry cannot point to unsupported or untracked files', async t => {
  const {root,page} = await fixture(t);
  await fs.writeFile(path.join(root,'other.cjs'), 'module.exports={};');
  await assert.rejects(publishShared({page,root,entries:[{...entry,file:'other.cjs'}]}), /SHARED_ENTRY_UNTRACKED/);
});

test('guards that navigate during publication cannot change the recorded module scope', async t => {
  const {root,page,state} = await fixture(t, `export async function verify(page){await page.go();return true;} export const search=async()=>1;`);
  page.go = async () => {state.url='http://example.test/app#/parks';};
  await assert.rejects(publishShared({page,root,entries:[entry]}), /SHARED_SCOPE_CHANGED_DURING_VERIFY/);
});
