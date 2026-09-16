import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DeepSeek} from '../src/deepseek.mjs';
import {DiagnosticLog,scrubForLog} from '../src/telemetry.mjs';
import {semanticHash} from '../src/common.mjs';

const code=expected=>error=>error.code===expected;
const secret='arbitrary-provider-credential-no-standard-prefix';
const response=(content='{"ok":true}',extra={})=>new Response(JSON.stringify({model:'fixture-model',usage:{prompt_tokens:4,completion_tokens:3},choices:[{finish_reason:'stop',message:{content}}],...extra}),{status:200});
const temp=()=>fs.mkdtemp(path.join(os.tmpdir(),'ui-agent-diagnostic-'));

test('log scrub preserves useful structures and types while removing nested and echoed credentials',()=>{
  const input={count:3,ok:true,missing:null,prompt_tokens:4,list:[1,{password:'a secret with spaces',cookie:'sid=abc; other=def',api_key:'custom'}],text:`model said ${secret}`,raw:'{"password":"another private value", "access_token":"token value"}',headers:'Cookie: sid=abc; session=def\nAuthorization: Bearer arbitrary\nstatus: useful'};
  const out=scrubForLog(input,{secrets:[secret]});
  assert.equal(out.count,3);assert.equal(out.ok,true);assert.equal(out.missing,null);assert.equal(out.prompt_tokens,4);assert.equal(out.list[0],1);
  for(const hidden of [secret,'a secret with spaces','sid=abc','other=def','custom','another private value','token value','session=def','arbitrary'])assert.ok(!JSON.stringify(out).includes(hidden),hidden);
  assert.equal(input.list[1].password,'a secret with spaces');assert.ok(out.headers.includes('status: useful'));
});
test('oversized diagnostic text is visibly truncated and prototype fields cannot mutate objects',()=>{
  const out=scrubForLog(JSON.parse('{"__proto__":{"polluted":true},"text":"'+('x'.repeat(300))+'"}'),{maxTextChars:100});
  assert.ok(out.text.includes('[TRUNCATED original_chars=300 limit=100]'));assert.equal({}.polluted,undefined);assert.ok(Object.hasOwn(out,'__proto__'));
});
test('escaped and URL-encoded configured keys are also scrubbed',()=>{
  const key='fixture"private\\credential';
  const out=scrubForLog({raw:JSON.stringify({note:key}),encoded:encodeURIComponent(key)},{secrets:[key]});
  assert.ok(!JSON.stringify(out).includes('credential'));assert.ok(out.raw.includes('[REDACTED]'));assert.equal(out.encoded,'[REDACTED]');
});
test('repeated scrubbing is stable for nested keys, quoted text, bearer values and truncation markers',()=>{
  const input={password:'fixture password',nested:[{notes:'password="fixture-password-do-not-export"',text:'Authorization: Bearer private-bearer\nCookie: sid=private; other=private',other:'prefix Bearer private-suffix'}],long:'x'.repeat(1000),echo:secret};
  const once=scrubForLog(input,{secrets:[secret],maxTextChars:100}),twice=scrubForLog(once,{secrets:[secret],maxTextChars:100});
  assert.deepEqual(twice,once);assert.deepEqual(scrubForLog(twice,{secrets:[secret],maxTextChars:100}),once);assert.match(once.long,/original_chars=1000 limit=100/);
});
test('diagnostic append serializes concurrent records, masks secrets, and survives a new reader',async()=>{
  const dir=await temp(),log=new DiagnosticLog(dir,{secrets:[secret]});
  const receipts=await Promise.all(Array.from({length:12},(_,i)=>log.append({type:'TEST',i,text:secret})));
  assert.deepEqual(receipts.map(r=>r.sequence),Array.from({length:12},(_,i)=>i+1));
  const records=await new DiagnosticLog(dir).read();assert.equal(records.length,12);assert.equal(records[11].i,11);
  assert.ok(!JSON.stringify(records).includes(secret));assert.equal((await fs.readdir(dir)).length,12);
});
test('diagnostic reader detects mutation in the latest entry',async()=>{
  const dir=await temp(),log=new DiagnosticLog(dir),receipt=await log.append({type:'TEST',value:'original'});
  const file=path.join(dir,receipt.file),entry=JSON.parse(await fs.readFile(file,'utf8'));entry.record.value='modified';await fs.writeFile(file,JSON.stringify(entry));
  await assert.rejects(()=>new DiagnosticLog(dir).read(),code('DIAGNOSTIC_CHANGED'));
  await assert.rejects(()=>new DiagnosticLog(dir).append({type:'NEW'}),code('DIAGNOSTIC_WRITE_FAILED'));
});
test('diagnostic reader detects a missing middle entry',async()=>{
  const dir=await temp(),log=new DiagnosticLog(dir);await log.append({type:'ONE'});const middle=await log.append({type:'TWO'});await log.append({type:'THREE'});
  await fs.unlink(path.join(dir,middle.file));await assert.rejects(()=>new DiagnosticLog(dir).read(),code('DIAGNOSTIC_CHANGED'));
});
test('progress reads and appends share one queue and retain every entry',async()=>{
  const dir=await temp(),log=new DiagnosticLog(dir),pending=[];
  for(let i=0;i<20;i++){pending.push(log.append({type:'PROGRESS',i}));pending.push(log.read());}
  await Promise.all(pending);const all=await log.read();assert.equal(all.length,20);assert.deepEqual(all.map(r=>r.i),Array.from({length:20},(_,i)=>i));
});
test('DeepSeek success traces model, timing, token usage and masked output without changing executable value',async()=>{
  const events=[],original={ok:true,password:'user fixture private',note:secret};let requests=0,usageCalls=0;
  const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;return response(JSON.stringify(original));}});
  const result=await provider.json('fixture',{purpose:'test'},{onTrace:async e=>events.push(e),onUsage:async()=>{usageCalls++;}});
  assert.deepEqual(result.value,original);assert.equal(requests,1);assert.equal(usageCalls,1);
  assert.deepEqual(events.map(e=>e.type),['MODEL_TRANSPORT_STARTED','MODEL_TRANSPORT_FINISHED','MODEL_RESPONSE_PARSED']);
  assert.equal(events[1].http_status,200);assert.equal(events[1].will_retry,false);assert.ok(events[1].duration_ms>=0);
  assert.equal(events[2].usage.prompt_tokens,4);assert.equal(events[2].usage.total_tokens,null);assert.equal(events[2].finish_reason,'stop');
  const logs=JSON.stringify(events);assert.ok(!logs.includes(secret));assert.ok(!logs.includes('user fixture private'));assert.ok(!logs.includes('Authorization'));assert.ok(logs.includes('[REDACTED]'));
});
for(const [name,make,error,text]of [
  ['invalid envelope',()=>new Response('not json '+secret,{status:200}),'DEEPSEEK_RESPONSE_INVALID','not json'],
  ['invalid model JSON',()=>response('malformed '+secret),'DEEPSEEK_JSON_INVALID','malformed'],
  ['truncated completion',()=>response('',{choices:[{finish_reason:'length',message:{content:'{"unfinished": "'+secret}}]}),'DEEPSEEK_OUTPUT_TRUNCATED','unfinished'],
  ['empty completion',()=>response(''),'DEEPSEEK_EMPTY_RESPONSE',null]
])test('DeepSeek keeps safe diagnostics for '+name,async()=>{
  const events=[];let requests=0;const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;return make();}});
  await assert.rejects(()=>provider.json('fixture',{}, {onTrace:e=>events.push(e)}),code(error));
  const rejected=events.at(-1);assert.equal(rejected.type,'MODEL_RESPONSE_REJECTED');assert.equal(rejected.error_code,error);assert.equal(requests,1);
  assert.ok(!JSON.stringify(events).includes(secret));if(text)assert.ok(JSON.stringify(events).includes(text));
});
test('DeepSeek missing usage stays unknown instead of zero',async()=>{
  const events=[],provider=new DeepSeek({key:secret,fetchImpl:async()=>response('{"ok":true}',{usage:undefined})});
  const result=await provider.json('fixture',{}, {onTrace:e=>events.push(e)});
  assert.equal(result.usage.prompt_tokens,null);assert.equal(result.usage.completion_tokens,null);assert.equal(events.at(-1).usage.prompt_tokens,null);
});
test('transport trace captures the parameters and actual adapter-expanded messages digest',async()=>{
  let sent;const events=[],provider=new DeepSeek({key:secret,fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return response();}});
  await provider.json('fixture system',{case:'fixture'},{onTrace:e=>events.push(e)});
  const started=events[0];assert.equal(started.messages_hash,semanticHash(sent.messages));assert.equal(sent.messages[0].content,'fixture system'+started.system_suffix);
  const {messages,...settings}=sent;assert.deepEqual(started.request_settings,settings);assert.equal(settings.max_tokens,6000);assert.equal(settings.temperature,0);assert.equal(settings.thinking.type,'disabled');
});
test('DeepSeek 401 records sanitized response and makes no retry',async()=>{
  const events=[];let requests=0;const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;return new Response('credential rejected: '+secret,{status:401});}});
  await assert.rejects(()=>provider.json('fixture',{}, {onTrace:e=>events.push(e)}),code('DEEPSEEK_AUTH_FAILED'));
  assert.equal(requests,1);assert.equal(events.at(-1).http_status,401);assert.equal(events.at(-1).will_retry,false);assert.ok(!JSON.stringify(events).includes(secret));
});
test('DeepSeek failed connection records a safe error without exception message or retry',async()=>{
  const events=[];let requests=0;const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;throw new Error(secret);}});
  await assert.rejects(()=>provider.json('fixture',{}, {onTrace:e=>events.push(e)}),code('DEEPSEEK_CONNECTION_FAILED'));
  assert.equal(requests,1);assert.equal(events.at(-1).http_status,null);assert.equal(events.at(-1).error_code,'DEEPSEEK_CONNECTION_FAILED');assert.ok(!JSON.stringify(events).includes(secret));
});
test('DeepSeek transport retry remains bounded and separately recorded',async()=>{
  const events=[];let requests=0;const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;return requests===1?new Response('busy',{status:503}):response();}});
  await provider.json('fixture',{}, {onTrace:e=>events.push(e)});
  assert.equal(requests,2);const finished=events.filter(e=>e.type==='MODEL_TRANSPORT_FINISHED');assert.deepEqual(finished.map(e=>e.attempt),[1,2]);assert.deepEqual(finished.map(e=>e.will_retry),[true,false]);
});
for(const [name,failType,expectedRequests]of [['before request','MODEL_TRANSPORT_STARTED',0],['after response','MODEL_TRANSPORT_FINISHED',1],['after parse','MODEL_RESPONSE_PARSED',1]])test('a logging failure '+name+' never adds a model request',async()=>{
  let requests=0;const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;return response();}});
  await assert.rejects(()=>provider.json('fixture',{}, {onTrace:async e=>{if(e.type===failType)throw Object.assign(new Error('disk full'),{code:'ENOSPC'});}}),code('DIAGNOSTIC_WRITE_FAILED'));
  assert.equal(requests,expectedRequests);
});
test('a failure while logging retryable HTTP status prevents the second request',async()=>{
  let requests=0;const provider=new DeepSeek({key:secret,fetchImpl:async()=>{requests++;return new Response('busy',{status:503});}});
  await assert.rejects(()=>provider.json('fixture',{}, {onTrace:async e=>{if(e.type==='MODEL_TRANSPORT_FINISHED')throw new Error('ENOSPC');}}),code('DIAGNOSTIC_WRITE_FAILED'));
  assert.equal(requests,1);
});
