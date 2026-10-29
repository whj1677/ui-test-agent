import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile,spawn} from 'node:child_process';
import {setupRuntime,verifyCredentialBroker,readJson,applicationRoot} from '../scripts/native-runtime.mjs';
import {prepareLaunch,existingService,savedModelOptIn} from '../scripts/native-entry.mjs';
import {readWindowsCredential} from '../server/model-credentials.mjs';
import {modelDiagnostics} from '../scripts/diagnose-model.mjs';
const exec=promisify(execFile);

test('startup diagnostics read metadata and whitelist health fields without leaking credentials',async t=>{
  const f=await fixture(t),directory=path.join(f.root,'ui-test-agent/runtime/config');
  await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(path.join(directory,'trial.json'),JSON.stringify({model_calls_allowed:true,user_initiated_operations:true}));
  await fs.writeFile(path.join(directory,'start-workbench.json'),JSON.stringify({profiles:{'fresh-b':{}}}));
  const environment={USERPROFILE:f.root,LOCALAPPDATA:f.root};
  const report=await modelDiagnostics({environment,fetchHealth:async()=>({service:'approved-test-workbench',status:'ready',case_assistant:{available:false},
    service_identity:{data_root_sha256:'another-copy'},private_field:'SYNTHETIC_PRIVATE_CANARY'})});
  assert.equal(report.saved_key,false);assert.equal(report.explicit_model_opt_in,true);
  assert.equal(report.service.same_program_directory,false);assert.match(report.next_step,/另一份程序目录/);
  assert.equal(report.model_requests,0);assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_PRIVATE_CANARY|USERPROFILE/);
  const unavailable=await modelDiagnostics({environment,fetchHealth:async()=>{throw Error('SYNTHETIC_PRIVATE_CANARY');}});
  assert.equal(unavailable.service.status,'UNREACHABLE');assert.doesNotMatch(JSON.stringify(unavailable),/SYNTHETIC_PRIVATE_CANARY/);
});

test('ordinary launch restores explicit opt-in without enabling a fresh or Key-only installation',async t=>{
  const f=await fixture(t),runtimeHome=path.join(f.root,'私有 运行时'),directory=path.join(runtimeHome,'config'),file=path.join(directory,'trial.json');
  assert.equal(await savedModelOptIn(runtimeHome),false);
  await fs.mkdir(directory,{recursive:true});
  for(const [trial,expected] of [
    [{model_calls_allowed:false,user_initiated_operations:false},false],
    [{model_calls_allowed:true,user_initiated_operations:false},false],
    [{model_calls_allowed:'true',user_initiated_operations:true},false],
    [{model_calls_allowed:true,user_initiated_operations:true},true],
    [{model_calls_allowed:false,user_initiated_operations:true},false],
  ]) {
    const bytes=JSON.stringify({...trial,authorizations:[],environments:[],user_note:'preserve'});
    await fs.writeFile(file,bytes);assert.equal(await savedModelOptIn(runtimeHome),expected);
    assert.equal(await fs.readFile(file,'utf8'),bytes,'mode selection never rewrites configuration or grants authorization');
  }
  await fs.writeFile(file,'{broken');await assert.rejects(savedModelOptIn(runtimeHome),SyntaxError);
});
async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-runtime-test-'));
  const links=[];
  t.after(async()=>{
    for(const link of links.reverse())if((await fs.lstat(link).catch(()=>null))?.isSymbolicLink())await fs.unlink(link);
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('native-runtime-test-'));
    await fs.rm(root,{recursive:true,force:true});
  });return {root,links};
}
async function relocatedRoot(f,name) {
  const root=path.join(f.root,name),modules=path.join(root,'harness-probe/node_modules');
  await fs.mkdir(path.dirname(modules),{recursive:true});await fs.symlink(path.join(applicationRoot,'harness-probe/node_modules'),modules,'junction');f.links.push(modules);
  await fs.mkdir(path.join(root,'workbench/config'),{recursive:true});
  const native=path.join(root,'workbench/native');await fs.mkdir(native,{recursive:true});
  for(const file of ['package.json','package-lock.json'])await fs.copyFile(path.join(applicationRoot,'workbench/native',file),path.join(native,file));
  const nativeModules=path.join(native,'node_modules');await fs.symlink(path.join(applicationRoot,'workbench/native/node_modules'),nativeModules,'junction');f.links.push(nativeModules);
  await fs.copyFile(path.join(applicationRoot,'workbench/config/empty-trial.json'),path.join(root,'workbench/config/empty-trial.json'));
  return root;
}
test('private Harness relocation preserves user files and refreshes only owned junction/configuration',async t=>{
  const f=await fixture(t),one=await relocatedRoot(f,'第一版 程序'),two=await relocatedRoot(f,'第二版 程序'),runtimeHome=path.join(f.root,'私有 运行时');
  await setupRuntime({root:one,runtimeHome});
  const link=path.join(runtimeHome,'dsh/profiles/headless/node_modules');f.links.push(link);
  const environmentFile=path.join(runtimeHome,'config/environments.json'),trialFile=path.join(runtimeHome,'config/trial.json'),configFile=path.join(runtimeHome,'config/start-workbench.json');
  const environmentBytes=Buffer.from('[{"id":"synthetic-user-environment"}]\n'),trialBytes=Buffer.from('{"model_calls_allowed":false,"authorizations":[],"environments":[],"user_custom":"preserve"}\n');
  await fs.writeFile(environmentFile,environmentBytes);await fs.writeFile(trialFile,trialBytes);
  const canary=path.join(runtimeHome,'dsh/credential-canary.txt');await fs.writeFile(canary,'SYNTHETIC_USER_FILE');
  const config=await readJson(configFile);config.profiles['fresh-b'].WORKBENCH_AUTH_ENVIRONMENTS=path.join(f.root,'user-auth.json');config.user_setting='preserve';config.profiles.other={custom:true};config.profiles['fresh-b'].custom='preserve';await fs.writeFile(configFile,JSON.stringify(config));
  for(let i=0;i<2;i++)await setupRuntime({root:two,runtimeHome});
  assert.equal(path.resolve(await fs.readlink(link)),path.join(two,'harness-probe/node_modules'));
  assert.ok((await fs.stat(path.join(one,'harness-probe/node_modules/@deepseek-ai/dsh/package.json'))).isFile());
  assert.deepEqual(await fs.readFile(environmentFile),environmentBytes);assert.deepEqual(await fs.readFile(trialFile),trialBytes);assert.equal(await fs.readFile(canary,'utf8'),'SYNTHETIC_USER_FILE');
  const moved=await readJson(configFile);assert.equal(moved.profiles['fresh-b'].WORKBENCH_HARNESS_PATCH,path.join(two,'harness-probe/config/browser-flash.cordis.yml'));
  assert.equal(moved.profiles['fresh-b'].WORKBENCH_AUTH_ENVIRONMENTS,config.profiles['fresh-b'].WORKBENCH_AUTH_ENVIRONMENTS);
  assert.equal(moved.profiles['fresh-b'].WORKBENCH_NATIVE_DSH_BIN,path.join(two,'workbench/native/node_modules/@deepseek-ai/dsh/lib/bin.js'));
  assert.equal(moved.user_setting,'preserve');assert.deepEqual(moved.profiles.other,{custom:true});assert.equal(moved.profiles['fresh-b'].custom,'preserve');
});
test('unowned configuration and dependency directories are rejected and left intact',async t=>{
  const f=await fixture(t),runtimeHome=path.join(f.root,'private'),configFile=path.join(runtimeHome,'config/start-workbench.json');
  await fs.mkdir(path.dirname(configFile),{recursive:true});await fs.writeFile(configFile,'{"schema":"user-owned"}');
  await assert.rejects(setupRuntime({runtimeHome}),/UNOWNED_CONFIG_PRESERVED/);assert.equal(await fs.readFile(configFile,'utf8'),'{"schema":"user-owned"}');
  await fs.unlink(configFile);
  const directory=path.join(runtimeHome,'dsh/profiles/headless/node_modules');await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'user-file.txt'),'preserve');
  await assert.rejects(setupRuntime({runtimeHome}),/UNOWNED_MODULES_PRESERVED/);assert.equal(await fs.readFile(path.join(directory,'user-file.txt'),'utf8'),'preserve');
});
test('mismatched junction ownership cannot remove a dependency target',async t=>{
  const f=await fixture(t),runtimeHome=path.join(f.root,'private');await setupRuntime({runtimeHome});
  const link=path.join(runtimeHome,'dsh/profiles/headless/node_modules');f.links.push(link);
  const marker=path.join(path.dirname(link),'portable-modules.json');await fs.writeFile(marker,JSON.stringify({schema:'workbench/portable-harness-link-v1',target:path.join(f.root,'another-target')}));
  await assert.rejects(setupRuntime({runtimeHome}),/MODULES_OWNER_MISMATCH/);assert.ok((await fs.lstat(link)).isSymbolicLink());
  assert.ok((await fs.stat(path.join(applicationRoot,'harness-probe/node_modules/@deepseek-ai/dsh/package.json'))).isFile());
});
test('credential broker hash rejects substituted binary before any credential read',async t=>{
  const f=await fixture(t),directory=path.join(f.root,'workbench/scripts/native');await fs.mkdir(directory,{recursive:true});
  await fs.copyFile(path.join(applicationRoot,'workbench/scripts/native/build-manifest.json'),path.join(directory,'build-manifest.json'));await fs.writeFile(path.join(directory,'WindowsCredential.exe'),'substituted');
  await assert.rejects(verifyCredentialBroker(f.root),/BYTES_INVALID/);
});
test('native DPAPI never overwrites a saved credential without interactive replacement',async t=>{
  const f=await fixture(t),broker=await verifyCredentialBroker(),file=path.join(f.root,'fixture.dpapi');
  const write=key=>new Promise((resolve,reject)=>{
    const child=spawn(broker,['write','--file',file,'--stdin'],{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='';
    child.stderr.on('data',b=>stderr+=b);child.once('error',reject);child.once('exit',code=>resolve({code,stderr}));child.stdin.end(key+'\n');
  });
  assert.equal((await write('synthetic-first-private-key')).code,0);const before=await fs.readFile(file);
  const replacement=await write('synthetic-second-private-key');assert.equal(replacement.code,1);assert.match(replacement.stderr,/MODEL_CREDENTIAL_EXISTS/);assert.doesNotMatch(replacement.stderr,/synthetic/);
  assert.deepEqual(await fs.readFile(file),before);assert.equal((await readWindowsCredential(file)).apiKey,'synthetic-first-private-key');
  assert.match((await fs.readFile(file,'utf8')),/^[0-9a-f]+$/);
});
test('normal native startup clears stale model/authorization bindings and does not start another workbench',async t=>{
  const f=await fixture(t),environment={...process.env,USERPROFILE:f.root,LOCALAPPDATA:f.root,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA,'ms-playwright'),WORKBENCH_PORT:'9999',WORKBENCH_DSH_HOME:'stale-home',WORKBENCH_HARNESS_PATCH:'stale-patch',WORKBENCH_BUILD_AUTHORIZATION_ID:'stale-id',M2C_BUILD_AUTHORIZATION_ID:'stale-fallback',WORKBENCH_NATIVE_DSH_BIN:'stale-private-cli',WORKBENCH_NATIVE_DSH_URL:'http://127.0.0.1:9999'};
  const p=await prepareLaunch({environment});
  assert.equal(p.env.WORKBENCH_PORT,'4322');assert.equal(p.env.WORKBENCH_DSH_HOME,undefined);assert.equal(p.env.WORKBENCH_HARNESS_PATCH,undefined);assert.equal(p.env.WORKBENCH_BUILD_AUTHORIZATION_ID,undefined);assert.equal(p.env.M2C_BUILD_AUTHORIZATION_ID,undefined);
  assert.equal((await readJson(p.env.WORKBENCH_CANDIDATE_TRIAL_CONFIG)).model_calls_allowed,false);
  assert.equal(p.env.WORKBENCH_NATIVE_DSH_BIN,undefined);assert.equal(p.env.WORKBENCH_NATIVE_DSH_URL,undefined);
  // A different installation is never allowed to reuse this project's port.
  const server=await existingService();
  if(server)await assert.rejects(existingService(f.root),/PORT4322_OTHER_PROJECT/);
});
test('explicit model launch loads the persisted package-local native binary with no inherited CLI',async t=>{
  const f=await fixture(t),runtimeHome=path.join(f.root,'private');await setupRuntime({runtimeHome});
  f.links.push(path.join(runtimeHome,'dsh/profiles/headless/node_modules'));
  const config=await readJson(path.join(runtimeHome,'config/start-workbench.json'));
  const file=config.profiles['fresh-b'].WORKBENCH_CANDIDATE_TRIAL_CONFIG,trial=await readJson(file);trial.model_calls_allowed=true;await fs.writeFile(file,JSON.stringify(trial));
  const environment={...process.env};delete environment.WORKBENCH_NATIVE_DSH_BIN;delete environment.WORKBENCH_NATIVE_DSH_URL;
  const prepared=await prepareLaunch({runtimeHome,environment,model:true});
  assert.equal(prepared.env.WORKBENCH_NATIVE_DSH_BIN,config.profiles['fresh-b'].WORKBENCH_NATIVE_DSH_BIN);
  assert.equal(prepared.env.WORKBENCH_NATIVE_DSH_URL,undefined);assert.equal(prepared.ready.native_dsh.version,'0.2.0-rc.2');
});
