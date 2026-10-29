import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { createActivationServer } from '../server/licensing/activation.mjs';
import { validateDeploymentPolicy, licenseStatus } from '../server/licensing/gate.mjs';
import { deploymentPolicy } from '../server/licensing/deployment-policy.mjs';

const keys = generateKeyPairSync('rsa', { modulusLength:3072 });
const publicKey = keys.publicKey.export({type:'spki',format:'pem'});
const policy = {required:true,trust:{schema:'workbench/license-trust-v1',product:'ui-test-agent',profileId:'windows-baseboard-v1',publicKey}};
test('current engineer trial explicitly requires no device license or trust root',async()=>{
  assert.deepEqual(deploymentPolicy,{required:false,trust:null});
  assert.deepEqual(await licenseStatus(deploymentPolicy),{state:'DEVELOPMENT_SOURCE',required:false});
});
function invoke(server,{url,method='GET',body,headers={}}) {
  return new Promise((resolve,reject) => {
    const request=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
    Object.assign(request,{url,method,headers:{host:'127.0.0.1:4322',...headers}});
    const response=new EventEmitter();
    response.writeHead=(status,h)=>Object.assign(response,{status,headers:h});
    response.end=bytes=>{try {resolve({status:response.status,value:JSON.parse(String(bytes)),headers:response.headers});response.emit('finish');} catch(error){reject(error);}};
    server.emit('request',request,response);
  });
}
function fixture() {
  const calls=[];
  const server=createActivationServer({policy,initialReason:'LICENSE_MISSING',filePath:path.resolve('not-written-license.json'),
    collect:async()=>{calls.push('hardware');return {profileId:'windows-baseboard-v1',hardwareFingerprint:'a'.repeat(64)};},
    save:async()=>{calls.push('save');return {alreadyInstalled:false};},onActivated:()=>calls.push('activated')});
  return {server,calls};
}
test('activation gate exposes no business route or accepting service',async()=>{
  const {server,calls}=fixture();
  for (const url of ['/api/case-library/projects','/api/build-tasks','/api/backend/environments']) assert.equal((await invoke(server,{url})).status,403);
  const health=await invoke(server,{url:'/api/health'});assert.equal(health.value.accepting,false);assert.equal(health.value.activation_required,true);assert.deepEqual(calls,[]);
});
test('request consent, CSRF, origin and host are required before hardware or install',async()=>{
  const {server,calls}=fixture();
  const state=await invoke(server,{url:'/api/activation/status'});
  const valid={'content-type':'application/json','x-license-csrf':state.value.csrf,origin:'http://127.0.0.1:4322'};
  for(const headers of [{...valid,host:'evil.example:4322'},{...valid,origin:'https://evil.example'},{...valid,'x-license-csrf':'bad'},{...valid,'sec-fetch-site':'cross-site'}]) {
    assert.equal((await invoke(server,{url:'/api/activation/import',method:'POST',headers,body:{consent:true,license:{}}})).status,403);
  }
  assert.equal((await invoke(server,{url:'/api/activation/import',method:'POST',headers:valid,body:{consent:false,license:{}}})).status,400);
  assert.deepEqual(calls,[]);
});
test('successful import saves before advancing to workbench',async()=>{
  const {server,calls}=fixture(); const state=await invoke(server,{url:'/api/activation/status'});
  const result=await invoke(server,{url:'/api/activation/import',method:'POST',headers:{'content-type':'application/json','x-license-csrf':state.value.csrf},body:{consent:true,license:{}}});
  assert.equal(result.status,200);assert.deepEqual(calls,['save']);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['save','activated']);
});
test('deployment trust rejects missing, private, weak and wrong-product roots',()=>{
  assert.equal(validateDeploymentPolicy({required:false,trust:null}),null);
  assert.equal(validateDeploymentPolicy(policy).product,'ui-test-agent');
  for(const invalid of [{},{required:true,trust:null},{...policy,trust:{...policy.trust,product:'other-agent'}},{...policy,trust:{...policy.trust,publicKey:keys.privateKey.export({type:'pkcs8',format:'pem'})}},{required:false,trust:policy.trust}]) assert.throws(()=>validateDeploymentPolicy(invalid),/LICENSE_TRUST_INVALID/);
  for (const settings of [{modulusLength:2048},{modulusLength:4096},{modulusLength:3072,publicExponent:3}]) {
    const unsupported=generateKeyPairSync('rsa',settings).publicKey.export({type:'spki',format:'pem'});
    assert.throws(()=>validateDeploymentPolicy({...policy,trust:{...policy.trust,publicKey:unsupported}}),/LICENSE_TRUST_INVALID/);
  }
});
test('request validates name before collecting hardware, then awaits the independent SDK request',async()=>{
  const calls=[];
  const server=createActivationServer({policy,filePath:path.resolve('not-written-license.json'),onActivated:()=>{},
    collect:async()=>{calls.push('hardware');return {profileId:'windows-baseboard-v1',hardwareFingerprint:'a'.repeat(64)};},
    requestFactory:async input=>{calls.push('sdk');assert.equal(input.product,'ui-test-agent');return {requestId:'synthetic',subject:{displayName:input.displayName}};}});
  const state=await invoke(server,{url:'/api/activation/status'}),headers={'content-type':'application/json','x-license-csrf':state.value.csrf};
  const invalid=await invoke(server,{url:'/api/activation/request',method:'POST',headers,body:{consent:true,displayName:''}});
  assert.equal(invalid.value.error,'LICENSE_SUBJECT_INVALID');assert.deepEqual(calls,[]);
  const valid=await invoke(server,{url:'/api/activation/request',method:'POST',headers,body:{consent:true,displayName:'合成验收用户'}});
  assert.equal(valid.status,200);assert.deepEqual(calls,['hardware','sdk']);assert.equal(valid.value.request.subject.displayName,'合成验收用户');
});
