// Offline, package-local runtime preparation. No PowerShell, installer,
// global Harness lookup, model request or user credential migration.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {verifyPortable} from './verify-portable.mjs';
import {nativeDshPackage} from './native-dsh-package.mjs';
const execute=promisify(execFile);
export const applicationRoot=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const absent=error=>error?.code==='ENOENT';
export async function optionalStat(file) { try{return await fs.lstat(file);}catch(error){if(absent(error))return null;throw error;} }
export async function readJson(file) { return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'')); }
export async function atomicJson(file,value) {
  const temporary=path.join(path.dirname(file),`.managed-${randomUUID()}.tmp`);
  try {await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await fs.rename(temporary,file);}
  finally {await fs.unlink(temporary).catch(error=>{if(!absent(error))throw error;});}
}
export function privateRuntimeHome(environment=process.env) {
  if(!environment.LOCALAPPDATA || !path.isAbsolute(environment.LOCALAPPDATA))throw Error('RUNTIME_LOCALAPPDATA_REQUIRED');
  return path.join(environment.LOCALAPPDATA,'ui-test-agent/runtime');
}
export async function runtimePaths(root=applicationRoot,environment=process.env) {
  root=path.resolve(root);
  if(Number(process.versions.node.split('.')[0])<22)throw Error('RUNTIME_NODE22_REQUIRED');
  const portable=Boolean(await optionalStat(path.join(root,'portable-manifest.json')));
  const node=portable?path.join(root,'runtime/node/node.exe'):process.execPath;
  if(!(await optionalStat(node))?.isFile())throw Error('RUNTIME_BUNDLED_NODE_MISSING');
  const env={...environment};
  if(portable) {env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'runtime/browsers');env.PATH=path.dirname(node)+path.delimiter+(env.PATH||'');}
  return {root,node,portable,env};
}
export async function runNode(runtime,args,{cwd=runtime.root,env=runtime.env,accepted=[0],timeout=30000}={}) {
  try {return await execute(runtime.node,args,{cwd,env,windowsHide:true,timeout,maxBuffer:1024*1024});}
  catch(error) {if(accepted.includes(error.code))return {stdout:error.stdout,stderr:error.stderr,code:error.code};throw Error('RUNTIME_CHILD_FAILED');}
}
export async function verifyCredentialBroker(root=applicationRoot) {
  const directory=path.join(root,'workbench/scripts/native');
  const manifest=await readJson(path.join(directory,'build-manifest.json'));
  const file=path.join(directory,'WindowsCredential.exe');
  if(manifest.schema!=='workbench/windows-credential-build-v1' || manifest.artifact!=='WindowsCredential.exe' || manifest.platform!=='win32-x64'
    || !(await fs.lstat(file)).isFile() || (await fs.lstat(file)).isSymbolicLink() || sha(await fs.readFile(file))!==manifest.sha256)throw Error('CREDENTIAL_BROKER_BYTES_INVALID');
  return file;
}
export async function doctor({root=applicationRoot,environment=process.env}={}) {
  const runtime=await runtimePaths(root,environment),checks=[];
  if(runtime.portable)checks.push(await verifyPortable(runtime.root));
  const broker=await verifyCredentialBroker(runtime.root);
  let dotnet;
  try {dotnet=JSON.parse((await execute(broker,['doctor'],{windowsHide:true,timeout:10000})).stdout);}
  catch {throw Error('DOTNET48_OR_CREDENTIAL_BROKER_UNAVAILABLE');}
  checks.push(dotnet);
  for(const relative of ['.','workbench','harness-probe','workbench/native']) {
    const value=await runNode(runtime,[path.join(runtime.root,'workbench/scripts/verify-runtime-dependencies.mjs'),path.join(runtime.root,relative)]);
    checks.push({scope:relative,dependency_check:value.stdout.trim()});
  }
  const browserResult=await runNode(runtime,['-p',"require('./node_modules/playwright').chromium.executablePath()"],{cwd:path.join(runtime.root,'workbench')});
  const browser=browserResult.stdout.trim();
  if(!path.isAbsolute(browser) || !(await optionalStat(browser))?.isFile()
    || (runtime.portable && path.relative(path.join(runtime.root,'runtime/browsers'),browser).startsWith('..')))throw Error('RUNTIME_BROWSER_MISSING');
  if(!(await optionalStat(path.join(runtime.root,'harness-probe/node_modules/@deepseek-ai/dsh/lib/bin.js')))?.isFile())throw Error('RUNTIME_DSH_MISSING');
  const nativeDsh=await nativeDshPackage(runtime.root);
  return {status:'OFFLINE_RUNTIME_READY_NOT_PRODUCT_ACCEPTANCE',node:runtime.node,browser,portable:runtime.portable,native_dsh:nativeDsh,checks};
}
export async function setupRuntime({root=applicationRoot,runtimeHome=privateRuntimeHome(),environment=process.env}={}) {
  if(!path.isAbsolute(runtimeHome))throw Error('RUNTIME_HOME_ABSOLUTE_REQUIRED');
  runtimeHome=path.resolve(runtimeHome);
  if((await optionalStat(runtimeHome))?.isSymbolicLink())throw Error('RUNTIME_HOME_LINK_REJECTED');
  const runtime=await runtimePaths(root,environment);
  const configDirectory=path.join(runtimeHome,'config'),dshHome=path.join(runtimeHome,'dsh');
  const configFile=path.join(configDirectory,'start-workbench.json');
  const previous=await optionalStat(configFile)?await readJson(configFile):null;
  if(previous && (previous.schema!=='workbench/portable-runtime-v1' || !previous.profiles?.['fresh-b']))throw Error('RUNTIME_UNOWNED_CONFIG_PRESERVED');
  const nativeDsh=await nativeDshPackage(runtime.root);
  const profileDirectory=path.join(dshHome,'profiles/headless'),profileFile=path.join(profileDirectory,'package.json');
  const modulesLink=path.join(profileDirectory,'node_modules'),marker=path.join(profileDirectory,'portable-modules.json');
  const target=path.join(runtime.root,'harness-probe/node_modules');
  const plugins=['@deepseek-ai/dsh-browser-use','@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'];
  const existingProfile=await optionalStat(profileFile)?await readJson(profileFile):null;
  for(const plugin of plugins) {
    const installed=await readJson(path.join(target,plugin,'package.json'));
    if(installed.version!=='0.1.6-alpha.2')throw Error('RUNTIME_PLUGIN_VERSION_INVALID');
    if(existingProfile?.dependencies?.[plugin] && existingProfile.dependencies[plugin]!==installed.version)throw Error('RUNTIME_EXISTING_PLUGIN_PRESERVED');
  }
  const oldLink=await optionalStat(modulesLink);
  if(oldLink) {
    if(!oldLink.isSymbolicLink() || !(await optionalStat(marker))?.isFile())throw Error('RUNTIME_UNOWNED_MODULES_PRESERVED');
    const owner=await readJson(marker),actual=path.resolve(await fs.readlink(modulesLink));
    if(owner.schema!=='workbench/portable-harness-link-v1' || actual.toLowerCase()!==String(owner.target).toLowerCase())throw Error('RUNTIME_MODULES_OWNER_MISMATCH');
  }
  await fs.mkdir(runtimeHome,{recursive:true});
  const lock=path.join(runtimeHome,'setup.lock');
  let handle;
  try {handle=await fs.open(lock,'wx');}catch {throw Error('RUNTIME_SETUP_ALREADY_RUNNING');}
  try {
    await fs.mkdir(configDirectory,{recursive:true});await fs.mkdir(dshHome,{recursive:true});
    // Upstream's offline dump initializes only this private profile, no tools
    // or agents. Preserve any previously supplied private profile first.
    if(!existingProfile)await runNode(runtime,[path.join(target,'@deepseek-ai/dsh/lib/bin.js'),'--profile','headless','--dump-default-config'],{env:{...runtime.env,DSH_HOME:dshHome}});
    const profile=existingProfile||await readJson(profileFile);profile.dependencies ||= {};
    for(const plugin of plugins)profile.dependencies[plugin]='0.1.6-alpha.2';
    await atomicJson(profileFile,profile);
    if(oldLink && path.resolve(await fs.readlink(modulesLink)).toLowerCase()!==target.toLowerCase()) {
      if(path.dirname(modulesLink)!==profileDirectory || path.basename(modulesLink)!=='node_modules' || !(await fs.lstat(modulesLink)).isSymbolicLink())throw Error('RUNTIME_LINK_REMOVAL_REFUSED');
      await fs.unlink(modulesLink); // Only the verified junction, never its target.
    }
    if(!await optionalStat(modulesLink))await fs.symlink(target,modulesLink,process.platform==='win32'?'junction':'dir');
    await atomicJson(marker,{schema:'workbench/portable-harness-link-v1',target});
    const environmentFile=path.join(configDirectory,'environments.json'),trialFile=path.join(configDirectory,'trial.json');
    for(const [file,value] of [[environmentFile,'[]\n'],[trialFile,await fs.readFile(path.join(runtime.root,'workbench/config/empty-trial.json'),'utf8')]]) {
      try {await fs.writeFile(file,value,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
    }
    await atomicJson(configFile,{...previous,schema:'workbench/portable-runtime-v1',profiles:{...previous?.profiles,'fresh-b':{
      ...previous?.profiles['fresh-b'],
      WORKBENCH_DSH_HOME:dshHome,WORKBENCH_HARNESS_PATCH:path.join(runtime.root,'harness-probe/config/browser-flash.cordis.yml'),
      WORKBENCH_NATIVE_DSH_BIN:nativeDsh.binary,WORKBENCH_NATIVE_DSH_URL:null,
      WORKBENCH_USE_STORED_DSH_CREDENTIALS:'1',WORKBENCH_DEVELOPMENT_ENVIRONMENTS:environmentFile,
      WORKBENCH_AUTH_ENVIRONMENTS:previous?.profiles['fresh-b'].WORKBENCH_AUTH_ENVIRONMENTS || null,WORKBENCH_CANDIDATE_TRIAL_CONFIG:trialFile,
    }}});
    return {status:'PRIVATE_HARNESS_READY_NO_MODEL_CALL',runtimeHome,configFile,dshHome,native_dsh:nativeDsh};
  } finally {await handle.close();await fs.unlink(lock);}
}
