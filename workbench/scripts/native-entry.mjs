// Customer entry: fixed 4322, bundled runtime, explicit model opt-in.
// The repository's formal PowerShell launcher remains available for operators.
import fs from 'node:fs/promises';
import {configureDiagnostics,diagnostics} from '../server/diagnostics.mjs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {applicationRoot,privateRuntimeHome,runtimePaths,doctor,setupRuntime,verifyCredentialBroker,readJson,atomicJson,optionalStat,runNode} from './native-runtime.mjs';
import {locateModelCredential,modelCredentialWritePath} from '../server/model-credential-storage.mjs';
const address='http://127.0.0.1:4322';
const managedKeys=['WORKBENCH_BUILD_AUTHORIZATION_ID','M2C_BUILD_AUTHORIZATION_ID','WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_USE_STORED_DSH_CREDENTIALS','WORKBENCH_DEVELOPMENT_ENVIRONMENTS','WORKBENCH_AUTH_ENVIRONMENTS','WORKBENCH_CANDIDATE_TRIAL_CONFIG','WORKBENCH_NATIVE_DSH_BIN','WORKBENCH_NATIVE_DSH_URL'];
export async function existingService(root=applicationRoot) {
  const occupied=await new Promise((resolve,reject)=>{
    const socket=net.connect({host:'127.0.0.1',port:4322});
    socket.setTimeout(1500,()=>{socket.destroy();reject(Error('RUNTIME_PORT_CHECK_TIMEOUT'));});
    socket.once('connect',()=>{socket.destroy();resolve(true);});
    socket.once('error',error=>error.code==='ECONNREFUSED'?resolve(false):reject(Error('RUNTIME_PORT_CHECK_FAILED')));
  });
  if(!occupied)return null;
  let health;
  try {const response=await fetch(address+'/api/health',{signal:AbortSignal.timeout(2000)});if(!response.ok)throw Error();health=await response.json();}
  catch {throw Error('RUNTIME_PORT4322_OTHER_PROCESS');}
  const expected=createHash('sha256').update(path.join(path.resolve(root),'workbench/.local/fresh25-b')).digest('hex');
  if(health.service!=='approved-test-workbench' || health.service_identity?.data_root_sha256!==expected)throw Error('RUNTIME_PORT4322_OTHER_PROJECT');
  return health;
}
export async function enableModel({root=applicationRoot,runtimeHome=privateRuntimeHome(),environment=process.env,preferWindowsCredentials=false}={}) {
  if(!environment.LOCALAPPDATA || !path.isAbsolute(environment.LOCALAPPDATA))throw Error('RUNTIME_LOCALAPPDATA_REQUIRED');
  if(!await locateModelCredential({environment}))throw Error('MODEL_CREDENTIAL_NOT_SAVED');
  const prepared=await setupRuntime({root,runtimeHome,environment});
  const file=path.join(runtimeHome,'config/trial.json'),trial=await readJson(file);
  if(!Array.isArray(trial.authorizations) || !Array.isArray(trial.environments))throw Error('RUNTIME_TRIAL_CONFIG_INVALID');
  trial.model_calls_allowed=true;trial.user_initiated_operations=true;
  await atomicJson(file,trial);
  if(preferWindowsCredentials) {
    const config=await readJson(prepared.configFile);
    config.profiles['fresh-b'].WORKBENCH_MODEL_CREDENTIAL_SOURCE='windows-dpapi';
    await atomicJson(prepared.configFile,config);
  }
  return {...prepared,status:'MODEL_ENTRY_ENABLED_NO_MODEL_REQUEST'};
}
// Saving a Key is not model opt-in. Restore only the mode explicitly enabled
// through enable-model or the explicit webpage action; fresh starts stay off.
export async function savedModelOptIn(runtimeHome=privateRuntimeHome()) {
  const file=path.join(runtimeHome,'config/trial.json');
  if(!await optionalStat(file))return false;
  const trial=await readJson(file);
  return trial.model_calls_allowed===true && trial.user_initiated_operations===true;
}
async function foreground(command,args,options={}) {
  const release=await readJson(path.join(applicationRoot,'workbench/release.json')).catch(()=>({version:'unknown'}));
  configureDiagnostics({programRoot:applicationRoot,version:release.version,role:"launcher"});
  await diagnostics.record('launcher','process.starting',{platform:process.platform,arch:process.arch,node:process.version});
  return new Promise((resolve,reject)=>{
    let stderr='';
    const child=spawn(command,args,{windowsHide:false,stdio:['inherit','pipe','pipe'],...options});
    child.stdout?.on('data',data=>process.stdout.write(data));
    child.stderr?.on('data',data=>{process.stderr.write(data);if(stderr.length<16000)stderr+=data.toString('utf8').slice(0,16000-stderr.length);});
    child.once('error',error=>{void diagnostics.record('launcher','process.spawn.failed',{error},'error').finally(()=>reject(Error('RUNTIME_PROCESS_START_FAILED')));});
    child.once('exit',code=>{void diagnostics.record('launcher','process.exited',{exit_code:code,stderr},code===0?'info':'error').finally(()=>resolve(code??1));});
  });
}
export async function openWorkbenchWhenReady({root=applicationRoot,signal,inspect=()=>existingService(root),open=()=>{
  const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32/rundll32.exe'),['url.dll,FileProtocolHandler',address+'/workspace/'],{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();
},timeoutMs=180000}={}) {
  const deadline=Date.now()+timeoutMs;
  while(!signal?.aborted&&Date.now()<deadline){
    try{const health=await inspect();if(health?.status==='ready'){if(!signal?.aborted)open();return true;}}catch{ return false; }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  return false;
}
export async function prepareLaunch({root=applicationRoot,runtimeHome=privateRuntimeHome(),environment=process.env,model=false}={}) {
  const runtime=await runtimePaths(root,environment);
  const ready=await doctor({root,environment});
  const data=path.join(runtime.root,'workbench/.local/fresh25-b');
  const profileFile=path.join(data,'workspace-profile.json');
  const marker=await optionalStat(profileFile)?await readJson(profileFile):null;
  if(marker && (marker.schema!=='workbench/data-profile-v1' || marker.profile!=='empty'))throw Error('RUNTIME_WORKSPACE_MARKER_INVALID');
  if(!marker && !await optionalStat(path.join(data,'case-library/projects')) && await optionalStat(data) && (await fs.readdir(data)).length)throw Error('RUNTIME_EXISTING_DATA_PRESERVED');
  const env={...runtime.env};for(const key of managedKeys)delete env[key];
  delete env.WORKBENCH_MODEL_CREDENTIAL_SOURCE;
  env.WORKBENCH_MANAGED_RUNTIME_HOME=path.resolve(runtimeHome);
  env.WORKBENCH_MANAGED_ENTRY='native';
  env.WORKBENCH_PORT='4322';env.WORKBENCH_DATA_DIR=data;
  env.WORKBENCH_CANDIDATE_TRIAL_CONFIG=path.join(runtime.root,'workbench/config/empty-trial.json');
  env.DSH_PROBE_BROWSER_EXECUTABLE=ready.browser;
  if(model) {
    const config=await readJson(path.join(runtimeHome,'config/start-workbench.json'));
    if(config.schema!=='workbench/portable-runtime-v1' || !config.profiles?.['fresh-b'])throw Error('RUNTIME_MODEL_CONFIG_INVALID');
    const profile=config.profiles['fresh-b'];
    for(const key of ['WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_DEVELOPMENT_ENVIRONMENTS','WORKBENCH_CANDIDATE_TRIAL_CONFIG']) {
      if(!profile[key] || !path.isAbsolute(profile[key]) || !await optionalStat(profile[key]))throw Error('RUNTIME_MODEL_PATH_INVALID');
      env[key]=profile[key];
    }
    if(profile.WORKBENCH_USE_STORED_DSH_CREDENTIALS!=='1')throw Error('RUNTIME_STORED_CREDENTIALS_REQUIRED');
    if(profile.WORKBENCH_NATIVE_DSH_BIN && path.resolve(profile.WORKBENCH_NATIVE_DSH_BIN)!==ready.native_dsh.binary)throw Error('RUNTIME_NATIVE_DSH_CONFIG_STALE');
    env.WORKBENCH_NATIVE_DSH_BIN=ready.native_dsh.binary;
    env.WORKBENCH_USE_STORED_DSH_CREDENTIALS='1';
    if(profile.WORKBENCH_MODEL_CREDENTIAL_SOURCE==='windows-dpapi')env.WORKBENCH_MODEL_CREDENTIAL_SOURCE='windows-dpapi';
    if(profile.WORKBENCH_AUTH_ENVIRONMENTS) {
      if(!path.isAbsolute(profile.WORKBENCH_AUTH_ENVIRONMENTS) || !(await optionalStat(profile.WORKBENCH_AUTH_ENVIRONMENTS))?.isFile())throw Error('RUNTIME_AUTH_PATH_INVALID');
      env.WORKBENCH_AUTH_ENVIRONMENTS=profile.WORKBENCH_AUTH_ENVIRONMENTS;
    }
    if((await readJson(profile.WORKBENCH_CANDIDATE_TRIAL_CONFIG)).model_calls_allowed!==true)throw Error('RUNTIME_MODEL_OPT_IN_REQUIRED');
  }
  const license=await runNode(runtime,[path.join(runtime.root,'workbench/server/licensing/cli.mjs'),'check','--root',runtime.root],{accepted:[0,2]});
  return {runtime,env,data,profileFile,marker,license:JSON.parse(license.stdout),ready};
}
export async function main(argv=process.argv.slice(2)) {
  const command=argv.shift();
  const {values}=parseArgs({args:argv,options:{'runtime-home':{type:'string'},'check-only':{type:'boolean'},'prepare-only':{type:'boolean'},'no-open':{type:'boolean'}},strict:true});
  const runtimeHome=values['runtime-home']||privateRuntimeHome();
  if(command==='doctor') {console.log(JSON.stringify(await doctor()));return 0;}
  if(command==='key') {
    const broker=await verifyCredentialBroker();
    const file=modelCredentialWritePath(process.env);
    return foreground(broker,['configure','--file',file]);
  }
  if(!['prepare','install','launch','enable-model'].includes(command))throw Error('RUNTIME_COMMAND_INVALID');
  if(command==='prepare') {console.log(JSON.stringify(await setupRuntime({runtimeHome})));return 0;}
  const existing=await existingService();
  if(existing && command!=='launch')throw Error('RUNTIME_STOP_EXISTING_BEFORE_SETUP');
  if(existing) {
    console.log('已复用本目录的原 4322 工作台，数据和配置保持不变。');
    if(existing.case_assistant?.available===false)console.log('当前实例尚未启用 AI 用例助手。请在网页“模型设置”中保存并启用模型。');
    if(!values['check-only']&&!values['no-open'])await openWorkbenchWhenReady();
    return values['check-only']?2:0;
  }
  if(command==='install') {
    console.log(JSON.stringify(await doctor()));console.log(JSON.stringify(await setupRuntime({runtimeHome})));return 0;
  }
  const model=command==='enable-model' || command==='launch' && await savedModelOptIn(runtimeHome);
  if(!values['check-only']) {
    console.log(JSON.stringify(model?await enableModel({runtimeHome}):await setupRuntime({runtimeHome})));
    if(values['prepare-only'])return 0;
  }
  const prepared=await prepareLaunch({runtimeHome,model});
  console.log(JSON.stringify({status:'STARTUP_READY_NOT_PRODUCT_ACCEPTANCE',entry:address+'/workspace/',model,license_state:prepared.license.state,browser:prepared.ready.browser}));
  if(values['check-only'])return 0;
  if(!prepared.marker && !await optionalStat(path.join(prepared.data,'case-library/projects'))) {
    await fs.mkdir(prepared.data,{recursive:true});
    await fs.writeFile(prepared.profileFile,JSON.stringify({schema:'workbench/data-profile-v1',profile:'empty'}),{flag:'wx'});
  }
  console.log('入口：http://127.0.0.1:4322/workspace/；启动窗口保持运行，Ctrl+C 正常停止。');
  const controller=new AbortController();
  const running=foreground(prepared.runtime.node,[path.join(applicationRoot,'workbench/server/owned-supervisor.mjs')],{cwd:path.join(applicationRoot,'workbench'),env:prepared.env});
  if(!values['no-open'])void openWorkbenchWhenReady({signal:controller.signal});
  try{return await running;}finally{controller.abort();}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().then(code=>{process.exitCode=code;}).catch(async error=>{
    if(!diagnostics.status().enabled)configureDiagnostics({programRoot:applicationRoot,version:(await readJson(path.join(applicationRoot,'workbench/release.json')).catch(()=>({version:'unknown'}))).version,role:'launcher'});
    await diagnostics.record('launcher','preparation.failed',{error},'error');
    const code=/^(?:RUNTIME_|NATIVE_DSH_PACKAGE_|MODEL_CREDENTIAL_|CREDENTIAL_BROKER_|DOTNET48_|PORTABLE_)[A-Z0-9_]+$/.test(error.message)?error.message:'RUNTIME_PREPARATION_FAILED';
    const help={RUNTIME_STOP_EXISTING_BEFORE_SETUP:'工作台已经运行。请等任务结束后正常停止，再运行“启用模型工作台.cmd”。',MODEL_CREDENTIAL_NOT_SAVED:'尚未找到当前 Windows 账户保存的密钥，请先运行“配置模型密钥.cmd”。'};
    console.error(code+'：'+(help[code] || '准备未完成；未切换端口、结束其他进程或修改系统策略。'));process.exitCode=1;
  });
}
