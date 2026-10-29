import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createWorkbenchServer } from '../server/app.mjs';
import { createServiceRestart } from '../server/service-restart.mjs';
import { createServiceShutdown } from '../server/service-shutdown.mjs';

// Invoke the real HTTP handler in memory; never start another workbench.
async function request(options, url, method = 'GET', body = {}, extraHeaders = {}) {
  const server = createWorkbenchServer(options);
  const input = Readable.from([Buffer.from(JSON.stringify(body))]);
  Object.assign(input, {url, method, headers: {host:'127.0.0.1:4322', origin:'http://127.0.0.1:4322',
    'content-type':'application/json', ...extraHeaders}});
  return new Promise(resolve => {
    const output = new EventEmitter();
    output.writeHead = (status, headers) => { output.status = status; output.headers = headers; };
    output.end = bytes => { output.emit('finish'); const raw = String(bytes); resolve({status:output.status, headers:output.headers,
      body:output.headers?.['content-type']?.startsWith('application/json') ? JSON.parse(raw) : raw}); };
    server.emit('request', input, output);
  });
}

test('formal router admits same-origin demonstrations and rejects foreign mutations', async () => {
  const calls = [];
  const demonstrations = {open:async (...args) => {calls.push(args);return {demonstration_id:'demo-unit',status:'PAUSED'};}};
  const url = '/api/case-library/projects/project-unit/demonstrations';
  const input = {case_id:'case-unit',case_version:1,environment_id:'env-unit'};
  const allowed = await request({demonstrations},url,'POST',input);
  assert.equal(allowed.status,201);
  assert.deepEqual(calls,[['project-unit',input]]);
  const blocked = await request({demonstrations},url,'POST',input,{origin:'http://outside.invalid'});
  assert.equal(blocked.status,403);
  assert.equal(calls.length,1);
});

test('recording popup assets use explicit static registration and the existing restrictive CSP', async () => {
  for (const [name, type] of [['html','text/html'],['js','text/javascript'],['css','text/css']]) {
    const response = await request({},`/workspace/demonstration-control.${name}`);
    assert.equal(response.status,200);
    assert.ok(response.headers['content-type'].startsWith(type));
    assert.equal(response.headers['cache-control'],'no-store');
    assert.match(response.headers['content-security-policy'],/script-src 'self'/);
    assert.doesNotMatch(response.headers['content-security-policy'],/unsafe-inline|unsafe-eval/);
    assert.ok(response.body.length > 0);
  }
});

test('active recording is visible in health and prevents managed restart', async () => {
  const demonstrations = {active:{recording:{demonstration_id:'demo-active'}}};
  const state = {accepting:true,inFlightMutations:1};
  const parent = new EventEmitter();parent.send = () => {};
  const serviceIdentity = {service_instance_id:'service-unit'};
  const restart = createServiceRestart({processRef:parent,serviceState:state,serviceIdentity,
    managers:{demonstrations},inFlightMutations:()=>state.inFlightMutations,onDrain:async()=>({closed:true})});
  restart.markReady();parent.emit('message',{type:'supervisor-hello'});
  assert.equal(restart.available(),false);
  assert.deepEqual(await restart.request('service-unit'),{status:409,error:'WORKBENCH_BUSY'});
  const health = await request({demonstrations,serviceIdentity,serviceState:state,serviceRestart:restart},'/api/health');
  assert.equal(health.body.active_demonstration_id,'demo-active');
  assert.equal(health.body.restart.available,false);
});

test('shutdown drains dedicated recording browser before reporting a closed service', async () => {
  const state = {accepting:true};let closed = false;
  const demonstrations = {closeAll:async()=>{closed=true;}};
  const server = {close:callback=>callback(),closeIdleConnections(){}};
  const shutdown = createServiceShutdown({state,server,demonstrations});
  const outcome = await shutdown();
  assert.equal(demonstrations.shutdownRequested,true);
  assert.equal(closed,true);
  assert.equal(outcome.closed,true);
  assert.equal(state.accepting,false);
});
