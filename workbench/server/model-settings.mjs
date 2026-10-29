import {spawn} from 'node:child_process';
import {verifyCredentialBroker} from '../scripts/native-runtime.mjs';
import {locateModelCredential,modelCredentialWritePath} from './model-credential-storage.mjs';

export async function saveModelKey(apiKey,{replace=false,environment=process.env}={}) {
  if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>4096||/[\u0000-\u001f\u007f]/.test(apiKey))throw Error('MODEL_KEY_INVALID');
  const broker=await verifyCredentialBroker();
  const args=['write','--file',modelCredentialWritePath(environment),'--stdin',...(replace?['--replace']:[])];
  await new Promise((resolve,reject)=>{
    const child=spawn(broker,args,{windowsHide:true,stdio:['pipe','ignore','pipe'],env:environment});
    let error='',ended=false;
    const finish=code=>{if(ended)return;ended=true;clearTimeout(timer);code===0?resolve():reject(Error(error.includes('MODEL_CREDENTIAL_EXISTS')?'MODEL_KEY_EXISTS':'MODEL_KEY_SAVE_FAILED'));};
    const timer=setTimeout(()=>{child.kill();finish(1);},15000);
    child.stderr.on('data',chunk=>{if(error.length<512)error+=chunk.toString();});
    child.on('error',()=>finish(1));child.on('exit',finish);child.stdin.on('error',()=>{});
    child.stdin.end(apiKey.trim()+'\n');
  });
}

export function createModelSettings({environment=process.env,save=saveModelKey,locate=locateModelCredential,busy=()=>false}={}) {
  let saving=false;
  return {
    async status(){return {configured:Boolean(await locate({environment})),provider:'DeepSeek',restart_required:true};},
    async save(body){
      if(saving||busy())throw Error('MODEL_SETTINGS_BUSY');
      if(!body||Object.keys(body).some(k=>!['api_key','replace'].includes(k))||typeof body.replace!=='boolean')throw Error('MODEL_SETTINGS_INVALID');
      saving=true;
      try{await save(body.api_key,{replace:body.replace,environment});return {saved:true,restart_required:true};}finally{saving=false;}
    },
  };
}
