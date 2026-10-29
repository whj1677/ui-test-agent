import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {upgradeInstallation,rollbackInstallation,resolveInstallation} from '../scripts/incremental-upgrade.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const encode=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
async function write(root,name,value) {const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,value);}
async function fixture(t,{inno=false}={}) {
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ui-upgrade-test-')),outer=path.join(temp,'旧版 中文目录'),root=inno?path.join(outer,'program'):outer,bundle=path.join(temp,'功能包');
  t.after(async()=>{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert.ok(path.basename(temp).startsWith('ui-upgrade-test-'));await fs.rm(temp,{recursive:true,force:true});});
  const before=Buffer.from('const value = "old version";\n'),after=Buffer.from('const value = "new office feature";\n'),module='workbench/server/requirements/manager.mjs',newModule='workbench/server/requirements/office-reader.mjs',payload=Buffer.from('new local reader');
  const files={
    'package.json':encode({name:'deepseek-ui-test-agent'}),
    'runtime/node/node.exe':Buffer.from('existing runtime sentinel'),
    'runtime/browsers/old-browser.bin':Buffer.from('existing browser sentinel'),
    'node_modules/old-dependency/package.json':encode({name:'old dependency'}),
    'workbench/release.json':encode({schema:'workbench/release-v1',version:'0.1.0-native.20261026.1',status:'PENDING_ACCEPTANCE'}),[module]:before,
  };
  for(const [name,data] of Object.entries(files))await write(root,name,data);
  const manifest={schema:'workbench/portable-package-v1',platform:'win32-x64',release:JSON.parse(files['workbench/release.json']),files:Object.entries(files).map(([name,data])=>({path:name,bytes:data.length,sha256:sha(data)}))};
  await write(root,'portable-manifest.json',encode(manifest));
  const originals=new Map([...Object.entries(files),['portable-manifest.json',encode(manifest)]]);
  const userData={'workbench/.local/fresh25-b/project.json':'existing project','workbench/scripts/start-workbench.local.json':'existing settings','workbench/.local/credentials.dpapi':'encrypted credential sentinel'};
  for(const [name,data] of Object.entries(userData))await write(root,name,data);
  const definition={schema:'workbench/incremental-upgrade-v1',id:'office-docx-read-v1',requirement:'REQ-0001/v15',payload:[{path:newModule,bytes:payload.length,sha256:sha(payload)}],edits:[{path:module,variants:[{before_sha256:sha(before),after_sha256:sha(after),changes:[{before:before.toString(),after:after.toString()}]}]}]};
  await write(bundle,'upgrade.json',encode(definition));await write(bundle,'payload/'+newModule,payload);
  const options={selected:outer,bundle,portCheck:async()=>{}};
  return {root,outer,bundle,options,module,newModule,definition,originals,userData};
}
async function untouched(f) {for(const [name,data] of Object.entries(f.userData))assert.equal(await fs.readFile(path.join(f.root,name),'utf8'),data);for(const name of ['runtime/node/node.exe','runtime/browsers/old-browser.bin','node_modules/old-dependency/package.json'])assert.deepEqual(await fs.readFile(path.join(f.root,name)),f.originals.get(name));}
test('old portable/Inno directory resolves; dry-run changes no bytes or user state',async t=>{
  const f=await fixture(t,{inno:true});assert.equal((await resolveInstallation(f.outer)).root,f.root);
  assert.equal((await upgradeInstallation({...f.options,checkOnly:true})).status,'READY_TO_UPGRADE');
  for(const [name,data] of f.originals)assert.deepEqual(await fs.readFile(path.join(f.root,name)),data);
  await assert.rejects(fs.stat(path.join(f.root,'workbench/.local/updates')),/ENOENT/);await untouched(f);
});
test('upgrade and repeat preserve environment/data and update the exact integrity records',async t=>{
  const f=await fixture(t);const result=await upgradeInstallation(f.options);assert.equal(result.status,'UPGRADED');
  assert.equal((await upgradeInstallation(f.options)).status,'ALREADY_CURRENT');
  const manifest=JSON.parse(await fs.readFile(path.join(f.root,'portable-manifest.json'),'utf8'));
  for(const name of [f.module,f.newModule,'workbench/release.json']){const data=await fs.readFile(path.join(f.root,name)),row=manifest.files.find(x=>x.path===name);assert.equal(row.sha256,sha(data));assert.equal(row.bytes,data.length);}
  assert.match(manifest.release.version,/\+office-read\.1$/);await untouched(f);
});
test('explicit rollback restores all original program bytes and preserves user/environment sentinels',async t=>{
  const f=await fixture(t);await upgradeInstallation(f.options);
  assert.equal((await rollbackInstallation(f.options)).status,'ROLLED_BACK');
  for(const [name,data] of f.originals)assert.deepEqual(await fs.readFile(path.join(f.root,name)),data);
  await assert.rejects(fs.stat(path.join(f.root,f.newModule)),/ENOENT/);await untouched(f);
});
test('injected mid-update failure automatically restores only files actually changed',async t=>{
  const f=await fixture(t);await assert.rejects(upgradeInstallation({...f.options,afterWrite:async()=>{throw Error('INJECTED_WRITE_FAILURE');}}),/INJECTED_WRITE_FAILURE/);
  for(const [name,data] of f.originals)assert.deepEqual(await fs.readFile(path.join(f.root,name)),data);
  await assert.rejects(fs.stat(path.join(f.root,f.newModule)),/ENOENT/);await untouched(f);
});
test('running workbench and unknown source versions are refused before any update',async t=>{
  const f=await fixture(t);
  await assert.rejects(upgradeInstallation({...f.options,portCheck:async()=>{throw Error('UPGRADE_WORKBENCH_RUNNING');}}),/WORKBENCH_RUNNING/);
  await write(f.root,f.module,'unrecognized manual edit');await assert.rejects(upgradeInstallation(f.options),/VERSION_NOT_SUPPORTED/);
  await assert.rejects(fs.stat(path.join(f.root,'workbench/.local/updates')),/ENOENT/);await untouched(f);
});
test('modified patch payload and path traversal cannot write program or user files',async t=>{
  const f=await fixture(t);await write(f.bundle,'payload/'+f.newModule,'tampered');await assert.rejects(upgradeInstallation(f.options),/PAYLOAD_CHANGED/);
  f.definition.payload[0].path='../outside';await write(f.bundle,'upgrade.json',encode(f.definition));await assert.rejects(upgradeInstallation(f.options),/BUNDLE_INVALID/);
  for(const [name,data] of f.originals)assert.deepEqual(await fs.readFile(path.join(f.root,name)),data);await untouched(f);
});
test('rollback refuses later manual edits and does not overwrite them',async t=>{
  const f=await fixture(t);await upgradeInstallation(f.options);await write(f.root,f.module,'later manual change');
  await assert.rejects(rollbackInstallation(f.options),/CHANGED_AFTER_INSTALL/);
  assert.equal(await fs.readFile(path.join(f.root,f.module),'utf8'),'later manual change');await untouched(f);
});
