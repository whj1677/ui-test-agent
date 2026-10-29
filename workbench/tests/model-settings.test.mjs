import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createModelSettings,saveModelKey} from '../server/model-settings.mjs';
import {modelCredentialWritePath} from '../server/model-credential-storage.mjs';
import {readWindowsCredential} from '../server/model-credentials.mjs';
import {createWorkbenchServer} from '../server/app.mjs';

test('DPAPI save refuses accidental overwrite and replaces only when requested', {skip:process.platform!=='win32'},async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'web-model-key-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const environment={...process.env,USERPROFILE:root,LOCALAPPDATA:path.join(root,'local')};
  await saveModelKey('synthetic-key-one',{environment});
  const file=modelCredentialWritePath(environment),encrypted=await fs.readFile(file,'utf8');assert.ok(!encrypted.includes('synthetic-key'));
  await assert.rejects(saveModelKey('synthetic-key-two',{environment}),/MODEL_KEY_EXISTS/);
  await saveModelKey('synthetic-key-two',{environment,replace:true});assert.equal((await readWindowsCredential(file)).apiKey,'synthetic-key-two');
});

test('settings status never reveals a key and rejects overlapping saves',async()=>{
  let finish;const settings=createModelSettings({locate:async()=>({file:'private'}),save:()=>new Promise(resolve=>{finish=resolve;})});
  assert.deepEqual(await settings.status(),{configured:true,provider:'DeepSeek',restart_required:true});
  const saving=settings.save({api_key:'synthetic',replace:false});await assert.rejects(settings.save({api_key:'other',replace:true}),/BUSY/);finish();assert.deepEqual(await saving,{saved:true,restart_required:true});
  await assert.rejects(settings.save({api_key:'synthetic',replace:false,path:'elsewhere'}),/INVALID/);
});

test('HTTP credential mutation requires exact local origin and never echoes exceptions',async()=>{
  let saved=0;const server=createWorkbenchServer({modelSettings:{status:async()=>({configured:false}),save:async()=>{saved++;throw Error('secret must not escape');}}});
  async function call(origin){const input=Readable.from([Buffer.from(JSON.stringify({api_key:'synthetic',replace:false}))]);Object.assign(input,{method:'POST',url:'/api/model-settings',headers:{host:'127.0.0.1:4322',origin,'content-type':'application/json'}});return new Promise(resolve=>{const output=new EventEmitter();output.writeHead=status=>{output.status=status;};output.end=bytes=>resolve({status:output.status,body:String(bytes)});server.emit('request',input,output);});}
  assert.equal((await call('https://foreign.invalid')).status,403);assert.equal(saved,0);
  const result=await call('http://127.0.0.1:4322');assert.equal(result.status,400);assert.ok(!result.body.includes('secret'));assert.equal(saved,1);
});
