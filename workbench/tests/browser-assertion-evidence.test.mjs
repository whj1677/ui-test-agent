import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installBrowserAssertionEvidence } from '../server/build/browser-assertion-evidence.mjs';

function fixture() {
  const page = new EventEmitter();
  page.url = () => 'http://127.0.0.1:3100/local-pilot.html';
  const records = [];
  const evidence = installBrowserAssertionEvidence({ page, identity: { run_id: 'run-1', step_order: 2 }, record: async item => { records.push(item); } });
  return { page, records, evidence };
}
function send(page, { method = 'GET', path = '/detail/11', origin = 'http://127.0.0.1:3100', status = 200, body = { code: 200 }, rawBody, duplicate = false, finish = true, delay = 0 } = {}) {
  const request = { method: () => method, url: () => origin + path };
  page.emit('request', request);
  setTimeout(() => {
    const response = { request: () => request, status: () => status, body: async () => rawBody === undefined ? Buffer.from(JSON.stringify(body)) : Buffer.from(rawBody) };
    page.emit('response', response);
    if (duplicate) page.emit('response', response);
    if (finish) page.emit('requestfinished', request);
  }, delay);
  return request;
}

test('silent successful write fails, HTTP 200 + business 500 is explicit refusal, and an expected write in another step is out of scope', async () => {
  const { page, records, evidence } = fixture();
  const options = { paths: ['/template/11'], business_status: { pointer: '/code', success: [200], failure: [500] } };
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', body: { code: 200 } })), /SUCCESSFUL_WRITE_OBSERVED/);
  assert.equal(records.at(-1).status, 'FAILED');
  assert.equal(records.at(-1).actual.success_count, 1);
  assert.deepEqual(records.at(-1).expected.business_status, { pointer: '/code', success: [200], failure: [500] });
  await evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', body: { code: 500 } }));
  assert.equal(records.at(-1).status, 'PASSED');
  await evidence.expectNoWrites({ paths: ['/template/11'] }, async () => send(page, { method: 'PUT', path: '/template/10' }));
  assert.equal(records.at(-1).actual.request_count, 0);
  await assert.rejects(evidence.expectNoWrites({ paths: ['/template/11'] }, async () => send(page, { method: 'PUT', path: '/template/11' })), /WRITE_REQUEST_OBSERVED/);
});

test('pending, missing business code and type drift never count as no successful write', async () => {
  const { page, records, evidence } = fixture();
  const options = { paths: ['/template/11'], business_status: { pointer: '/code', success: [200], failure: [500] } };
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => page.emit('request', { method: () => 'PUT', url: () => 'http://127.0.0.1:3100/template/11' })), /BROWSER_ASSERTION_UNKNOWN/);
  assert.equal(records.at(-1).reason, 'INCOMPLETE_OR_LATE_REQUEST');
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', body: {} })), /WRITE_OUTCOME_UNKNOWN/);
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', body: { code: '500' } })), /WRITE_OUTCOME_UNKNOWN/);
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', rawBody: '' })), /WRITE_OUTCOME_UNKNOWN/);
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', rawBody: '{broken' })), /WRITE_OUTCOME_UNKNOWN/);
  await assert.rejects(evidence.expectNoSuccessfulWrites(options, async () => send(page, { method: 'PUT', path: '/template/11', duplicate: true })), /WRITE_OUTCOME_UNKNOWN/);
});

test('missing or empty business mappings fail before the original action executes', async () => {
  const { evidence, records } = fixture();
  let actions = 0;
  for (const business_status of [undefined,
    { pointer: '/error/code', success: [], failure: ['ALREADY_COMPLETED'] },
    { pointer: '/code', success: [200], failure: [] }]) {
    await assert.rejects(async () => evidence.expectNoSuccessfulWrites(
      { paths: ['/orders/1/complete'], business_status }, async () => { actions += 1; }),
    /BROWSER_ASSERTION_CONTRACT_INVALID: BUSINESS_(?:STATUS_REQUIRED|VALUES_INVALID)/);
  }
  assert.equal(actions, 0);
  assert.deepEqual(records, []);
});

test('GET must start within action, be unique, and match complete same-item tuples', async () => {
  const { page, records, evidence } = fixture();
  const good = [
    { periodType: 3, startTime: '06:00', endTime: '08:00', price: 0.6333 },
    { periodType: 3, startTime: '12:00', endTime: '18:00', price: 0.6333 },
  ];
  const options = { method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/id', value: 11 }], arrays: [{ pointer: '/data/items', fields: ['periodType', 'startTime', 'endTime', 'price'], items: good }] };
  send(page, { path: '/detail/11', body: { data: { id: 11, items: good } } }); // before observation
  await assert.rejects(evidence.expectJsonResponse(options, async () => {}), /EXPECTED_ONE_FRESH_RESPONSE/);
  assert.equal(records.at(-1).actual.response_count, 0);
  await evidence.expectJsonResponse(options, async () => send(page, { path: '/detail/11', body: { data: { id: 11, items: [...good].reverse() } } }));
  assert.equal(records.at(-1).status, 'PASSED');
  await assert.rejects(evidence.expectJsonResponse(options, async () => {
    send(page, { path: '/detail/11', body: { data: { id: 11, items: good } } });
    send(page, { path: '/detail/11', body: { data: { id: 11, items: good } } });
  }), /EXPECTED_ONE_FRESH_RESPONSE/);
  const wrongSecond = [good[0], { ...good[1], price: 0.6222 }];
  await assert.rejects(evidence.expectJsonResponse(options, async () => send(page, { path: '/detail/11', body: { data: { id: 11, items: wrongSecond } } })), /JSON_ASSERTION_MISMATCH/);
  assert.equal(records.at(-1).actual.checks[1].matches, false);
  assert.equal(records.at(-1).actual.checks[1].actual_count, 2);
  assert.equal(records.at(-1).actual.checks[1].expected_items.length, 2);
  assert.deepEqual(records.at(-1).actual.checks[1].actual_diff, [{ periodType: 3, startTime: '12:00', endTime: '18:00', price: 0.6222 }]);
  assert.deepEqual(records.at(-1).actual.checks[1].missing_items, [good[1]]);
});

test('decimal parser preserves sign and rejects trailing garbage', async () => {
  const { evidence, records } = fixture();
  assert.equal(await evidence.decimalText('-0.9555 元/kWh', { unit: '元/kWh' }), '-0.9555');
  assert.equal(await evidence.decimalText('0.9555 元/kWh', { unit: '元/kWh' }), '0.9555');
  await assert.rejects(evidence.decimalText('0.9555oops', { unit: '元/kWh' }), /DECIMAL_TEXT_INVALID/);
  await assert.rejects(evidence.decimalText('', { unit: '元/kWh' }), /DECIMAL_TEXT_INVALID/);
  assert.equal(records.at(-1).status, 'FAILED');
});

test('origin, unsafe paths, secret fields and business value contracts fail closed', async () => {
  const { page, evidence, records } = fixture();
  assert.equal(Object.getOwnPropertyDescriptor(page, 'testEvidence').writable, false);
  assert.equal(Object.getOwnPropertyDescriptor(page, 'testEvidence').configurable, false);
  assert.throws(() => evidence.expectNoWrites({ paths: ['/template/*'] }, async () => {}), /EXACT_PATH_REQUIRED/);
  assert.throws(() => evidence.expectNoWrites({ paths: ['/template/%31'] }, async () => {}), /EXACT_PATH_REQUIRED/);
  assert.throws(() => evidence.expectNoWrites({ paths: ['/a/../template/11'] }, async () => {}), /EXACT_PATH_REQUIRED/);
  assert.throws(() => evidence.expectNoWrites({ paths: ['/a/./template/11'] }, async () => {}), /EXACT_PATH_REQUIRED/);
  assert.throws(() => evidence.expectNoWrites({ paths: ['/a\u0001b'] }, async () => {}), /EXACT_PATH_REQUIRED/);
  assert.throws(() => evidence.expectNoWrites({ paths: ['/' + 'a'.repeat(513)] }, async () => {}), /EXACT_PATH_REQUIRED/);
  assert.throws(() => evidence.expectJsonResponse({ method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/token', value: 'x' }] }, async () => {}), /SAFE_POINTER_REQUIRED/);
  assert.throws(() => evidence.expectJsonResponse({ method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/__proto__', value: 'x' }] }, async () => {}), /SAFE_POINTER_REQUIRED/);
  assert.throws(() => evidence.expectJsonResponse({ method: 'GET', path: '/detail/11', arrays: [{ pointer: '/data/items', fields: ['password'], items: [{ password: 'x' }] }] }, async () => {}), /ARRAY_CONTRACT_INVALID/);
  assert.throws(() => evidence.expectNoSuccessfulWrites({ paths: ['/template/11'], business_status: { pointer: '/code', success: [200], failure: ['500'] } }, async () => {}), /BUSINESS_VALUES_INVALID/);
  await assert.rejects(evidence.expectNoWrites({ paths: ['/template/11'] }, async () => send(page, { method: 'PUT', path: '/template/11', origin: 'https://elsewhere.example' })), /SCOPE_VIOLATION/);
  assert.equal(records.at(-1).status, 'UNKNOWN');
  assert.equal(JSON.stringify(records.at(-1)).includes('elsewhere.example'), false);
});

test('about:blank installation delays origin freeze and accepts runner identity', async () => {
  const page = new EventEmitter();
  page.url = () => 'about:blank';
  const records = [];
  const identity = { task_id: 'task-1', run_id: 'run-1', candidate_sha256: 'abc', candidate_bundle_sha256: 'def', executed_case_id: 'case-1', executed_case_version: 2, executed_external_id: 'CLOUD-UI-C2', executed_content_sha256: 'ghi' };
  const evidence = installBrowserAssertionEvidence({ page, identity, record: async row => records.push(row) });
  assert.equal(await evidence.decimalText('-0.5 元/kWh', { unit: '元/kWh' }), '-0.5');
  page.url = () => 'http://127.0.0.1:3100/local-pilot.html';
  await evidence.expectNoWrites({ paths: ['/template/11'] }, async () => {});
  assert.deepEqual(records.at(-1).identity, identity);
  page.url = () => 'http://127.0.0.1:3200/other';
  await assert.rejects(evidence.expectNoWrites({ paths: ['/template/11'] }, async () => send(page, { method: 'PUT', path: '/template/11', origin: 'http://127.0.0.1:3200' })), /SCOPE_VIOLATION/);
  await assert.rejects(evidence.expectNoWrites({ paths: ['/template/11'] }, async () => {}), /SCOPE_VIOLATION/);
});

test('recorded scalar and array projections redact sensitive values', async () => {
  const { page, records, evidence } = fixture();
  const options = { method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/name', value: 'safe-name' }], arrays: [{ pointer: '/data/items', fields: ['price'], items: [{ price: '0.6333' }] }] };
  await assert.rejects(evidence.expectJsonResponse(options, async () => send(page, { path: '/detail/11', body: { data: { name: 'token=actual456', items: [{ price: 'password=actual' }] } } })), /JSON_ASSERTION_MISMATCH/);
  const serialized = JSON.stringify(records.at(-1));
  assert.equal(serialized.includes('actual456'), false);
  assert.equal(serialized.includes('password=actual'), false);
  assert.match(serialized, /redacted-sensitive-value/);
});

test('callback exception is recorded and rethrown unchanged', async () => {
  const { evidence, records } = fixture();
  const original = new Error('original action failure');
  await assert.rejects(evidence.expectNoWrites({ paths: ['/template/11'] }, async () => { throw original; }), error => error === original);
  assert.equal(records.at(-1).status, 'UNKNOWN');
  assert.equal(records.at(-1).reason, 'ACTION_ERROR');
});

test('trusted step getter marks an unawaited cross-step helper UNKNOWN with its starting step', async () => {
  const page = new EventEmitter(); page.url = () => 'http://127.0.0.1:3100/local-pilot.html';
  const records = []; let step = 2;
  const evidence = installBrowserAssertionEvidence({ page, getStep: () => step, record: async row => records.push(row) });
  const pending = evidence.expectNoWrites({ paths: ['/template/11'] }, async () => {});
  step = null;
  await assert.rejects(pending, /STEP_CHANGED_DURING_ASSERTION/);
  assert.equal(records.at(-1).status, 'UNKNOWN');
  assert.equal(records.at(-1).step_order, 2);
  assert.deepEqual(records.at(-1).contract, { paths: ['/template/11'], methods: ['POST', 'PUT', 'PATCH', 'DELETE'] });
  step = 3;
  const pendingDecimal = evidence.decimalText('0.5 元/kWh', { unit: '元/kWh' });
  step = null;
  await assert.rejects(pendingDecimal, /STEP_CHANGED_DURING_ASSERTION/);
  assert.equal(records.at(-1).step_order, 3);
  assert.equal(records.at(-1).status, 'UNKNOWN');
});

test('callback cannot mutate frozen contract arrays or change the check', async () => {
  const { page, records, evidence } = fixture();
  const options = { method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/id', value: 11 }], arrays: [{ pointer: '/data/items', fields: ['periodType', 'price'], items: [{ periodType: 3, price: 0.6333 }] }] };
  await assert.rejects(evidence.expectJsonResponse(options, async () => {
    options.equals[0].value = 99;
    options.arrays[0].fields[1] = 'wrong';
    options.arrays[0].items[0].price = 0.6222;
    send(page, { path: '/detail/11', body: { data: { id: 99, items: [{ periodType: 3, price: 0.6222 }] } } });
  }), /JSON_ASSERTION_MISMATCH/);
  assert.deepEqual(records.at(-1).contract, { method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/id', value: 11 }], arrays: [{ pointer: '/data/items', fields: ['periodType', 'price'], items: [{ periodType: 3, price: 0.6333 }] }] });
  const write = { paths: ['/template/11'], methods: ['PUT'], business_status: { pointer: '/code', success: [200], failure: [500] } };
  await assert.rejects(evidence.expectNoSuccessfulWrites(write, async () => {
    write.paths[0] = '/template/12'; write.methods[0] = 'DELETE'; write.business_status.success[0] = 500;
    send(page, { method: 'PUT', path: '/template/11', body: { code: 200 } });
  }), /SUCCESSFUL_WRITE_OBSERVED/);
  assert.deepEqual(records.at(-1).contract, { paths: ['/template/11'], methods: ['PUT'], business_status: { pointer: '/code', success: [200], failure: [500] } });
  assert.equal(records.at(-1).status, 'FAILED');
  assert.throws(() => evidence.expectJsonResponse({ method: 'GET', path: '/detail/11', equals: [{ pointer: '/data/name', value: 'token=secret' }] }, async () => {}), /SENSITIVE_CONTRACT_VALUE/);
});
