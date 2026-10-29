import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPortable} from '../scripts/verify-portable.mjs';
import {verifyPortableArchive} from '../scripts/verify-portable-archive.mjs';
const exec=promisify(execFile);
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function temporary(fn){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portable-package-test-'));
  try{return await fn(dir);}finally{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('portable-package-test-'));await fs.rm(dir,{recursive:true,force:true});}
}
async function fixture(dir){
 const names=['runtime/node/node.exe','runtime/node/LICENSE','workbench/server/index.mjs','workbench/server/licensing/deployment-policy.mjs'];
 const files=[];
 for(const name of names){const value=Buffer.from('synthetic byte integrity fixture '+name);await fs.mkdir(path.dirname(path.join(dir,name)),{recursive:true});await fs.writeFile(path.join(dir,name),value);files.push({path:name,bytes:value.length,sha256:hash(value)});}
 const manifest={schema:'workbench/portable-package-v1',platform:'win32-x64',files};await fs.writeFile(path.join(dir,'portable-manifest.json'),JSON.stringify(manifest));return manifest;
}
test('portable verifier rejects a changed executable, unlisted executable and traversal',async()=>temporary(async dir=>{
 const original=await fixture(dir);assert.equal((await verifyPortable(dir)).files,4);
 await fs.writeFile(path.join(dir,'runtime/node/node.exe'),'changed');await assert.rejects(verifyPortable(dir),/PORTABLE_FILE_CHANGED/);
 await fixture(dir);await fs.writeFile(path.join(dir,'workbench/server/unlisted.mjs'),'extra');await assert.rejects(verifyPortable(dir),/PORTABLE_UNLISTED_FILE/);await fs.unlink(path.join(dir,'workbench/server/unlisted.mjs'));
 original.files[0].path='../escaped';await fs.writeFile(path.join(dir,'portable-manifest.json'),JSON.stringify(original));await assert.rejects(verifyPortable(dir),/PORTABLE_PATH_INVALID/);
}));
test('portable verifier permits customer workspace but requires listed licensing entry',async()=>temporary(async dir=>{
 const manifest=await fixture(dir);await fs.mkdir(path.join(dir,'workbench/.local/fresh25-b'),{recursive:true});await fs.writeFile(path.join(dir,'workbench/.local/fresh25-b/customer.json'),'{}');assert.equal((await verifyPortable(dir)).files,4);
 manifest.files=manifest.files.filter(f=>!f.path.endsWith('deployment-policy.mjs'));await fs.writeFile(path.join(dir,'portable-manifest.json'),JSON.stringify(manifest));await assert.rejects(verifyPortable(dir),/PORTABLE_REQUIRED_FILE_MISSING/);
}));
test('native ZIP verifier reads serialized bytes and rejects corruption, unlisted, duplicate, escaped and symlink entries',async()=>temporary(async dir=>{
 const app=path.join(dir,'app');await fs.mkdir(app);await fixture(app);
 const manifestHash=hash(await fs.readFile(path.join(app,'portable-manifest.json'))),zip=path.join(dir,'candidate.zip');
 const source="import sys,zipfile;from pathlib import Path;root=Path(sys.argv[1]);mode=sys.argv[3];\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED) as z:\n for f in sorted(root.rglob('*')):\n  if f.is_file():\n   name=f.relative_to(root).as_posix();data=f.read_bytes();z.writestr(name,b'changed' if mode=='corrupt' and name.endswith('node.exe') else data)\n if mode=='unlisted':z.writestr('workbench/server/extra.mjs','extra')\n if mode=='duplicate':z.writestr('runtime/node/LICENSE','duplicate')\n if mode=='escaped':z.writestr('../outside.txt','outside')\n if mode=='symlink':\n  i=zipfile.ZipInfo('link');i.create_system=3;i.external_attr=0o120777<<16;z.writestr(i,'runtime/node/node.exe')";
 const make=mode=>exec('python',['-X','utf8','-B','-c',source,app,zip,mode],{timeout:15000});
 await make('valid');const verified=await verifyPortableArchive(zip,{expectedManifestSha256:manifestHash});assert.equal(verified.files,4);assert.equal(verified.status,'PORTABLE_ARCHIVE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE');
 const cli=await exec(process.execPath,[path.join(root,'workbench/scripts/verify-portable-archive.mjs'),zip,manifestHash],{timeout:15000});assert.equal(JSON.parse(cli.stdout).files,4);
 await assert.rejects(verifyPortableArchive(zip,{expectedManifestSha256:'0'.repeat(64)}),/PORTABLE_MANIFEST_DIGEST_MISMATCH/);
 for(const [mode,error] of [['corrupt',/PORTABLE_ARCHIVE_SIZE_INVALID|PORTABLE_FILE_CHANGED/],['unlisted',/PORTABLE_UNLISTED_FILE/],['duplicate',/PORTABLE_ARCHIVE_PATH_INVALID/],['escaped',/PORTABLE_ARCHIVE_PATH_INVALID/],['symlink',/PORTABLE_ARCHIVE_PATH_INVALID/]]){
  await make(mode);await assert.rejects(verifyPortableArchive(zip,{expectedManifestSha256:manifestHash}),error);
 }
}));
test('current source candidate graph includes dynamic Harness configuration and transitive vendor files',async()=>{
 const source="import importlib.util;from pathlib import Path;p=Path('workbench/scripts/package-candidate.py');s=importlib.util.spec_from_file_location('candidate',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);f=m.collect();assert 'vendor/manual-ui/case_handoff.mjs' in f;assert 'harness-probe/config/browser-auth-attach.cordis.yml' in f;assert 'workbench/scripts/setup-runtime.ps1' in f;assert 'workbench/server/native-dsh/evidence-plugin.cjs' in f;assert 'workbench/server/native-dsh/evidence-transform.cjs' in f;assert not any('/.local/' in n or n.startswith('tools/') for n in f);print(len(f))";
 const result=await exec('python',['-B','-c',source],{cwd:root,timeout:20000});assert.match(result.stdout,/\d+/);
});
test('offline Harness preparation resolves bundled plugins and preserves private credential canary',async()=>temporary(async dir=>{
 const runtime=path.join(dir,'private-runtime');
 await fs.mkdir(path.join(runtime,'dsh'),{recursive:true});const canary=Buffer.from('SYNTHETIC_CREDENTIAL_CANARY_NOT_A_KEY');const file=path.join(runtime,'dsh','credentials.dpapi');await fs.writeFile(file,canary);
 const script=path.join(root,'workbench/scripts/native-entry.mjs');
 for(let i=0;i<2;i++){const result=await exec(process.execPath,[script,'prepare','--runtime-home',runtime],{timeout:30000,windowsHide:true});assert.doesNotMatch(result.stdout,/SYNTHETIC_CREDENTIAL_CANARY/);}
 assert.deepEqual(await fs.readFile(file),canary);
 const pkg=JSON.parse(await fs.readFile(path.join(runtime,'dsh/profiles/headless/package.json'),'utf8'));assert.equal(pkg.dependencies['@deepseek-ai/dsh-browser-use'],'0.1.6-alpha.2');
 const resolve="const{createRequire}=require('node:module');const p=require('node:path');const r=createRequire(p.join(process.argv[1],'dsh/profiles/headless/package.json'));console.log(r.resolve('@deepseek-ai/dsh-browser-use'));console.log(r.resolve('@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'))";
 const output=await exec(process.execPath,['-e',resolve,runtime],{timeout:10000});assert.ok(output.stdout.includes(path.join(root,'harness-probe','node_modules')));
 const config=JSON.parse(await fs.readFile(path.join(runtime,'config/start-workbench.json'),'utf8'));assert.equal(config.profiles['fresh-b'].WORKBENCH_DSH_HOME,path.join(runtime,'dsh'));
 assert.equal(JSON.parse(await fs.readFile(path.join(runtime,'config/trial.json'),'utf8')).model_calls_allowed,false);
 // Remove only the proven test-owned junction before recursive fixture cleanup.
 const junction=path.join(runtime,'dsh/profiles/headless/node_modules');assert.ok((await fs.lstat(junction)).isSymbolicLink());await fs.rmdir(junction);
}));
test('portable builder rejects missing explicit trust and existing stages before copying',async()=>{
 await assert.rejects(exec('python',['-B','workbench/scripts/package-portable.py'],{cwd:root,timeout:10000}),error=>error.code===2&&error.stderr.includes('--trust-file'));
 const source="import importlib.util,tempfile;from pathlib import Path;from types import SimpleNamespace;p=Path('workbench/scripts/package-portable.py');s=importlib.util.spec_from_file_location('portable',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d=tempfile.TemporaryDirectory(prefix='portable-existing-');a=SimpleNamespace(root=Path.cwd(),stage=Path(d.name),output=Path(d.name).with_suffix('.zip'));\ntry:m.build(a);raise AssertionError('allowed existing directory')\nexcept ValueError as e:assert str(e)=='PORTABLE_REQUIRES_NEW_STAGE_AND_ARCHIVE'\nfinally:d.cleanup()";
 await exec('python',['-B','-c',source],{cwd:root,timeout:10000});
});

test('unlicensed build is explicit and exclusive; the real startup CLI succeeds with an empty license directory',async()=>temporary(async dir=>{
 const source="import importlib.util;from types import SimpleNamespace;from pathlib import Path;s=importlib.util.spec_from_file_location('portable',Path('workbench/scripts/package-portable.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);assert m.deployment_policy(SimpleNamespace(no_device_license=True,trust_file=None),None)=={'required':False,'trust':None};\nfor args,code in [(SimpleNamespace(no_device_license=False,trust_file=None),'PORTABLE_EXPLICIT_LICENSE_MODE_REQUIRED'),(SimpleNamespace(no_device_license=True,trust_file='unexpected.json'),'PORTABLE_LICENSE_MODE_CONFLICT')]:\n try:m.deployment_policy(args,None);raise AssertionError('unexpectedly accepted')\n except ValueError as e:assert str(e)==code\nprint('EXPLICIT_MODE_VERIFIED')";
 assert.match((await exec('python',['-X','utf8','-B','-c',source],{cwd:root,timeout:10000})).stdout,/EXPLICIT_MODE_VERIFIED/);
 const output=await exec(process.execPath,[path.join(root,'workbench/server/licensing/cli.mjs'),'check','--root',root],{env:{...process.env,LOCALAPPDATA:dir},timeout:10000});
 assert.deepEqual(JSON.parse(output.stdout),{state:'DEVELOPMENT_SOURCE',required:false});
 assert.deepEqual(await fs.readdir(dir),[]);
}));
test('Windows PowerShell preserves Node UTF-8 paths for Chinese installations',async()=>{
 const helper=path.join(root,'workbench/scripts/runtime-paths.ps1').replaceAll("'","''");
 const quotedRoot=root.replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop';. '${helper}';$runtime=Get-WorkbenchRuntime -Root '${quotedRoot}';$actual=& $runtime.Node -p 'process.argv[1]' '${quotedRoot}';if($actual -cne '${quotedRoot}'){throw 'NATIVE_UTF8_PATH_CORRUPTED'};Write-Output 'NATIVE_UTF8_PATH_PRESERVED'`;
 const result=await exec('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{timeout:15000,windowsHide:true});
 assert.match(result.stdout,/NATIVE_UTF8_PATH_PRESERVED/);
});
test('portable builder accepts RSA3072 public trust and rejects weak or wrong-algorithm keys',async()=>temporary(async dir=>{
 const source="import importlib.util,sys;from pathlib import Path;p=Path('workbench/scripts/package-portable.py');s=importlib.util.spec_from_file_location('portable',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.validate_trust(Path(sys.argv[1]),Path(sys.argv[2]));print('VALID_TRUST')";
 for(const [type,bits,exponent,valid] of [['rsa',3072,65537,true],['rsa',2048,65537,false],['rsa',3072,3,false],['ed25519',null,null,false]]){
  const {publicKey}=generateKeyPairSync(type,bits?{modulusLength:bits,publicExponent:exponent}:{});
  const file=path.join(dir,`${type}-${bits}-${exponent}.json`);await fs.writeFile(file,JSON.stringify({schema:'workbench/license-trust-v1',product:'ui-test-agent',profileId:'windows-baseboard-v1',publicKey:publicKey.export({type:'spki',format:'pem'})}));
  const run=()=>exec('python',['-B','-c',source,file,process.execPath],{cwd:root,timeout:15000});
  if(valid)assert.match((await run()).stdout,/VALID_TRUST/);else await assert.rejects(run(),error=>error.code===1&&error.stderr.includes('PORTABLE_PUBLIC_KEY_INVALID'));
 }
}));
test('portable builder writes dependency files beyond Windows MAX_PATH', async()=>temporary(async dir=>{
 const source="import importlib.util,sys;from pathlib import Path;p=Path('workbench/scripts/package-portable.py');s=importlib.util.spec_from_file_location('portable',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);root=Path(sys.argv[1]);relative='/'.join(['dependency'*8]*3)+'/licenses/original.txt';m.write_file(root,relative,b'original legal text');assert m.windows_io_path(root/relative).read_bytes()==b'original legal text';print('LONG_PATH_OK')";
 const result=await exec('python',['-X','utf8','-B','-c',source,dir],{cwd:root,timeout:20000});assert.match(result.stdout,/LONG_PATH_OK/);
}));
