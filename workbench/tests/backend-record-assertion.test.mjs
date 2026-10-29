import test from 'node:test';
import assert from 'node:assert/strict';
import { backendDigest, executeBackendCase, validateBackendExecution } from '../server/backend/execution.mjs';
import { exampleEnvironment } from '../server/backend/example.mjs';

const baseline = { code: 'DEV-001', name: '循环泵一号', site: '东站', ratedPowerKw: 80 };
const created = { code: 'DEV-007', name: '冷却泵二号', site: '西站', ratedPowerKw: 110 };
const json = (pointer, op, value) => ({ target: 'json', pointer, op, value });

function fixture() {
  const environment = structuredClone(exampleEnvironment);
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-RECORD', title: '完整台账',
    steps: [{ order: 1, action: '读取完整台账', expected: '两条记录各自字段正确' }] };
  const caseVersion = { version: 1, content, content_sha256: backendDigest(content).toUpperCase() };
  const binding = { status: 'COMPLETE', confirmation_status: 'CONFIRMED', case_version: 1,
    case_content_sha256: caseVersion.content_sha256, binding_id: 'binding-record', version: 1,
    protocol_source_id: 'source-record', protocol_sha256: 'A'.repeat(64), mappings: [] };
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.id,
    setup: [{ id: 'setup', method: 'POST', path: '/__control/namespaces', json: { runId: '{{runId}}' },
      assertions: [{ target: 'status', op: 'equals', value: 201 }, json('/created', 'equals', true)] }],
    steps: [{ order: 1, requests: [{ id: 'ledger', method: 'GET', path: '/api/v1/namespaces/{{runId}}/devices',
      assertions: [{ target: 'status', op: 'equals', value: 200 }, json('/items', 'length', 2),
        json('/items', 'array_some_fields_equal', baseline), json('/items', 'array_some_fields_equal', created)] }] }],
    cleanup: [{ id: 'cleanup', method: 'DELETE', path: '/__control/namespaces/{{runId}}',
      assertions: [{ target: 'status', op: 'equals', value: 200 }, json('/deleted', 'equals', true)] }],
  };
  return { environment, caseVersion, binding, execution };
}

test('matches all fields on one member regardless of order and permits extra object fields', async t => {
  const prior = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    const pathname = new URL(url).pathname;
    seen.push({ method: options.method, pathname });
    const runId = options.body ? JSON.parse(options.body).runId : pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    if (options.method === 'POST') return Response.json({ runId, created: true }, { status: 201 });
    if (options.method === 'DELETE') return Response.json({ runId, deleted: true }, { status: 200 });
    return Response.json({ runId, items: [{ ...created, extra: 'allowed' }, baseline], total: 2 }, { status: 200 });
  };
  t.after(() => { globalThis.fetch = prior; });
  const result = await executeBackendCase(fixture());
  assert.equal(result.status, 'PASSED');
  assert.deepEqual(result.steps[0].requests[0].assertions.slice(-2).map(row => row.status), ['PASSED', 'PASSED']);
  assert.deepEqual(seen.map(row => row.method), ['POST', 'GET', 'DELETE']);
});

test('rejects split, missing and wrongly typed fields on full ledger even when filter reads could be correct', async t => {
  const prior = globalThis.fetch;
  let items = [];
  globalThis.fetch = async (url, options) => {
    const pathname = new URL(url).pathname;
    const runId = options.body ? JSON.parse(options.body).runId : pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    if (options.method === 'POST') return Response.json({ runId, created: true }, { status: 201 });
    if (options.method === 'DELETE') return Response.json({ runId, deleted: true }, { status: 200 });
    return Response.json({ runId, items, total: 2 }, { status: 200 });
  };
  t.after(() => { globalThis.fetch = prior; });
  for (const bad of [
    [{ ...baseline, name: created.name }, { ...created, name: baseline.name }],
    [{ ...baseline, name: undefined }, created],
    [{ ...baseline, ratedPowerKw: '80' }, created],
    [{ code: 'DEV-009' }, { code: 'DEV-010' }],
  ]) {
    items = bad;
    const result = await executeBackendCase(fixture());
    assert.equal(result.status, 'FAILED');
    assert.ok(result.steps[0].requests[0].assertions.slice(-2).some(row => row.status === 'FAILED'));
    assert.equal(result.cleanup[0].status, 'PASSED');
  }
});

test('schema rejects invalid field maps and references before any fetch', () => {
  const badValues = [
    {}, Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`f${i}`, i])),
    { 'bad.field': 1 }, JSON.parse('{"__proto__":1}'), { constructor: 1 },
    { code: { nested: true } }, { code: ['DEV-001'] }, { code: '{{runId}}' },
    { code: '{{earlier:/item/code}}' }, { code: 'abc}}' }, { code: 'x'.repeat(1025) },
    { code: Number.POSITIVE_INFINITY },
  ];
  for (const value of badValues) {
    const input = fixture();
    input.execution.steps[0].requests[0].assertions[2].value = value;
    assert.throws(() => validateBackendExecution(input), /BACKEND_ASSERTION_INVALID/);
  }
  for (const mutation of [
    assertion => { assertion.field = 'code'; },
    assertion => { assertion.expected_from = { request_id: 'setup', pointer: '/runId' }; },
    assertion => { assertion.target = 'status'; },
    assertion => { delete assertion.value; },
  ]) {
    const input = fixture();
    mutation(input.execution.steps[0].requests[0].assertions[2]);
    assert.throws(() => validateBackendExecution(input), /BACKEND_ASSERTION_INVALID/);
  }
});

test('same-response record checks catch the counterexample that legacy separate field matches allow', async t => {
  const prior=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;const pathname=new URL(url).pathname;
    const runId=options.body?JSON.parse(options.body).runId:pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    if(options.method==='POST')return Response.json({runId,created:true},{status:201});
    if(options.method==='DELETE')return Response.json({runId,deleted:true},{status:200});
    return Response.json({runId,items:[{...baseline,name:created.name},{...created,name:baseline.name}],total:2});
  };t.after(()=>{globalThis.fetch=prior;});
  const input=fixture(),requests=input.execution.steps[0].requests;
  requests[0].assertions=[json('/items','length',2),...Object.entries(baseline).map(([field,value])=>({target:'json',pointer:'/items',op:'array_some_field_equals',field,value}))];
  requests.push({id:'check-same-response',response_ref:'ledger',assertions:[json('/items','array_some_fields_equal',baseline)]});
  const result=await executeBackendCase(input);
  assert.equal(result.steps[0].requests[0].status,'PASSED');assert.equal(result.steps[0].requests[1].status,'FAILED');
  assert.equal(result.status,'FAILED');assert.equal(result.cleanup[0].status,'PASSED');assert.equal(calls,3);
});

test('string_nonempty accepts only a nonblank string at the requested JSON pointer', async t => {
  const prior = globalThis.fetch;
  let message;
  globalThis.fetch = async (url, options) => {
    const pathname = new URL(url).pathname;
    const runId = options.body ? JSON.parse(options.body).runId : pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    if (options.method === 'POST') return Response.json({ runId, created: true }, { status: 201 });
    if (options.method === 'DELETE') return Response.json({ runId, deleted: true }, { status: 200 });
    return Response.json(message === undefined ? { runId } : { runId, message }, { status: 200 });
  };
  t.after(() => { globalThis.fetch = prior; });
  for (const [value, expected] of [
    ['重复编号', 'PASSED'], ['  拒绝说明  ', 'PASSED'], ['', 'FAILED'], [' \t ', 'FAILED'],
    [null, 'FAILED'], [123, 'FAILED'], [{ text: '拒绝' }, 'FAILED'], [undefined, 'FAILED'],
  ]) {
    message = value;
    const input = fixture();
    input.execution.steps[0].requests[0].assertions = [
      { target: 'status', op: 'equals', value: 200 }, json('/message', 'string_nonempty', true),
    ];
    const result = await executeBackendCase(input);
    assert.equal(result.steps[0].requests[0].assertions[1].status, expected);
    assert.equal(result.status, expected === 'PASSED' ? 'PASSED' : 'FAILED');
  }
});

test('string_nonempty rejects non-true value, references, field and non-JSON target', () => {
  for (const mutate of [
    assertion => { assertion.value = false; },
    assertion => { assertion.value = null; },
    assertion => { assertion.value = 'true'; },
    assertion => { delete assertion.value; },
    assertion => { assertion.expected_from = null; },
    assertion => { assertion.expected_from = { request_id: 'setup', pointer: '/runId' }; },
    assertion => { assertion.field = 'message'; },
    assertion => { assertion.target = 'status'; },
  ]) {
    const input = fixture();
    const assertion = json('/message', 'string_nonempty', true);
    input.execution.steps[0].requests[0].assertions.push(assertion);
    mutate(assertion);
    assert.throws(() => validateBackendExecution(input), /BACKEND_ASSERTION_INVALID/);
  }
});

test('enabled namespace setup enforces this run ID on setup, business and cleanup before assertions', async t => {
  const prior=globalThis.fetch;let badMethod;
  globalThis.fetch=async(url,options)=>{
    const pathname=new URL(url).pathname;
    const actualId=options.body?JSON.parse(options.body).runId:pathname.match(/\/namespaces\/([^/]+)/)?.[1];
    const runId=options.method===badMethod?'different-namespace':actualId;
    if(options.method==='POST')return Response.json({runId,created:true},{status:201});
    if(options.method==='DELETE')return Response.json({runId,deleted:true},{status:200});
    return Response.json({runId,items:[created,baseline],total:2});
  };t.after(()=>{globalThis.fetch=prior;});
  for(const method of ['POST','GET','DELETE']){
    badMethod=method;const result=await executeBackendCase(fixture());
    const request=method==='POST'?result.setup[0]:method==='GET'?result.steps[0].requests[0]:result.cleanup[0];
    assert.equal(request.error.code,'BACKEND_NAMESPACE_ID_MISMATCH');assert.equal(request.status,'ERROR');
    assert.equal(result.complete_pass,false);assert.equal(request.assertions.length,0);
  }
});
