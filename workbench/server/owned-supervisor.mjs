import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const defaultChild = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.mjs');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const connectionRefused = error => error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED';
export const SUPERVISOR_BUDGETS = Object.freeze({startupMs:60_000,shutdownMs:15_000,healthMs:1_000,transitionMs:8_000});

export async function supervise({childPath=defaultChild,spawn=fork,env=process.env,cwd=process.cwd(),
  health=signal=>fetch('http://127.0.0.1:4322/api/health',{signal}).then(response=>response.json()),
  startupMs=SUPERVISOR_BUDGETS.startupMs,shutdownMs=SUPERVISOR_BUDGETS.shutdownMs,healthMs=SUPERVISOR_BUDGETS.healthMs,transitionMs=SUPERVISOR_BUDGETS.transitionMs,
  activateModel=env.WORKBENCH_MANAGED_ENTRY==='native'?async()=>{
    const {enableModel,prepareLaunch}=await import('../scripts/native-entry.mjs');
    const {applicationRoot}=await import('../scripts/native-runtime.mjs');
    const runtimeHome=env.WORKBENCH_MANAGED_RUNTIME_HOME;
    if(!runtimeHome||!path.isAbsolute(runtimeHome))throw Error('MODEL_RUNTIME_HOME_INVALID');
    await enableModel({root:applicationRoot,runtimeHome,environment:env,preferWindowsCredentials:true});
    return prepareLaunch({root:applicationRoot,runtimeHome,environment:env,model:true});
  }:null,
  report=message=>console.log(JSON.stringify(message))}={}) {
  let child, expected, restarting=false, drained=false, stopping=false, modelTransition=false, launchEnv=env;
  const healthOnce = async () => {
    const controller=new AbortController();
    let timer;
    try {
      return await Promise.race([health(controller.signal),new Promise((_,reject)=>{
        timer=setTimeout(()=>{controller.abort();reject(Error('SERVICE_HEALTH_TIMEOUT'));},healthMs);
      })]);
    } finally {clearTimeout(timer);}
  };
  const cleanupOwnedChild = async () => {
    const owned=child;
    if (!owned || owned.exited) return;
    try {owned.send?.({type:'shutdown'});}catch{}
    let ended=await Promise.race([owned.exitPromise.then(()=>true),pause(shutdownMs).then(()=>false)]);
    if (ended) return;
    // This handle was created by spawn() above. Never target a discovered PID.
    try {owned.kill?.('SIGTERM');}catch{}
    ended=await Promise.race([owned.exitPromise.then(()=>true),pause(1000).then(()=>false)]);
    if (!ended) {try {owned.kill?.('SIGKILL');}catch{}}
    await Promise.race([owned.exitPromise,pause(1000)]);
  };
  const launch = () => new Promise((resolve,reject) => {
    let settled=false;
    const current=spawn(childPath,[],{cwd,env:launchEnv,execPath:process.execPath,stdio:['inherit','inherit','inherit','ipc']});
    child=current;
    current.exited=false;
    current.exitPromise=new Promise(resolve=>current.once('exit',(code,signal)=>{current.exited=true;resolve({code,signal});}));
    const timer=setTimeout(()=>fail(Error('SERVICE_START_TIMEOUT')),startupMs);
    const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
    current.on('error',fail);
    current.on('exit',(code,signal)=>{if(!settled)fail(Error(`SERVICE_EXIT_BEFORE_READY:${code ?? signal}`));});
    current.on('message',message=>{
      if(message?.type==='supervisor-awaiting'){
        try {current.send({type:'supervisor-hello',model_activation:typeof activateModel==='function'},error=>{if(error)fail(error);});}catch(error){fail(error);}
      }
      if(message?.type==='managed-ready'){
        if(settled)return;
        settled=true;clearTimeout(timer);
        if(expected && (message.data_root_sha256!==expected.data_root_sha256 || !modelTransition&&message.configuration_sha256!==expected.configuration_sha256)) {
          reject(Error('SERVICE_CONFIGURATION_CHANGED_ON_RESTART'));return;
        }
        expected=message;
        modelTransition=false;
        resolve(current);
      }
    });
  });
  const stop=()=>{stopping=true;restarting=false;child?.send?.({type:'shutdown'});};
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  try {
    let current=await launch();
    for (;;) {
      drained=false;restarting=false;
      let exited=false;
      const exit=current.exitPromise.then(result=>{exited=true;return result;});
      current.on('message',message=>{
        if(message?.type==='restart-request'){
          const modeValid=message.mode===undefined || message.mode==='enable-model'&&typeof activateModel==='function';
          const accepted=modeValid&&!stopping&&!restarting&&message.service_instance_id===expected.service_instance_id;
          if(accepted){restarting=true;modelTransition=message.mode==='enable-model';}
          current.send({type:'restart-ack',request_id:message.request_id,accepted});
        }
        if(message?.type==='restart-drained')drained=message.closed===true;
      });
      while(!exited&&!stopping&&!restarting)await pause(50);
      const ended=(restarting||stopping)&&!exited
        ? await Promise.race([exit,pause(shutdownMs).then(()=>({timeout:true}))])
        : await exit;
      if(ended.timeout){report({type:'restart_failed',error:'SERVICE_SHUTDOWN_TIMEOUT'});return 1;}
      if(stopping)return ended.code ?? 0;
      if(!restarting)return ended.code ?? 1; // No automatic crash restart.
      if(!drained){report({type:'restart_failed',error:'SERVICE_DRAIN_INCOMPLETE'});return 1;}
      let free=false;
      const releaseDeadline=Date.now()+transitionMs;
      while(Date.now()<releaseDeadline){
        try {await healthOnce();}catch(error){if(connectionRefused(error)){free=true;break;}}
        await pause(100);
      }
      if(!free){report({type:'restart_failed',error:'PORT_NOT_RELEASED'});return 1;}
      const oldInstance=expected.service_instance_id;
      if(modelTransition) {
        const prepared=await activateModel();
        const dataHash=createHash('sha256').update(path.resolve(prepared.data)).digest('hex');
        if(dataHash!==expected.data_root_sha256)throw Error('MODEL_ACTIVATION_DATA_CHANGED');
        launchEnv=prepared.env;
      }
      // launch() performs one replacement only; a failed startup exits this supervisor.
      const replacement=await launch();
      let ready=false;
      const readyDeadline=Date.now()+transitionMs;
      while(Date.now()<readyDeadline){
        try {const status=await healthOnce();const identity=status.service_identity;
          if(status.status==='ready'&&status.accepting===true&&identity?.service_instance_id!==oldInstance&&
            identity?.service_instance_id===expected.service_instance_id&&identity?.data_root_sha256===expected.data_root_sha256&&
            identity?.configuration_sha256===expected.configuration_sha256){ready=true;break;}
        }catch{}
        await pause(100);
      }
      if(!ready){report({type:'restart_failed',error:'SERVICE_HEALTH_NOT_READY'});return 1;}
      report({type:'restart_complete',old_instance_id:oldInstance,new_instance_id:expected.service_instance_id});
      // The replacement is now the owned child for a future explicit restart.
      current=replacement;
    }
  }catch(error){report({type:'supervisor_failed',error:error.message});return 1;}
  finally{
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    await cleanupOwnedChild();
  }
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  process.exitCode=await supervise();
}
