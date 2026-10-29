import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBrowserAssertionContract, evaluateBrowserAssertionObligations } from '../server/build/browser-assertion-contract.mjs';

const noWrites = { paths: ['/api/templates'], methods: ['POST', 'PUT'] };
const jsonResponse = { method: 'GET', path: '/api/templates/11', equals: [{ pointer: '/code', value: 200 }],
  arrays: [{ pointer: '/data/items', fields: ['periodType', 'price'], items: [{ periodType: 3, price: 0.6222 }, { periodType: 3, price: 0.6222 }] }] };
const obligations = [
  { id: 'no-write', step_order: 1, source_quote: '不得产生模板写请求', kind: 'no_writes', contract: noWrites },
  { id: 'detail', step_order: 2, source_quote: '两个平段价格均为0.6222', kind: 'json_response', contract: jsonResponse },
];
const frozen = rows => ({ test_data: `固定夹具。\n[workbench-browser-assertions-v1]\n${JSON.stringify(rows)}\n[/workbench-browser-assertions-v1]`,
  steps: [{ order: 1, expected: '取消后不得产生模板写请求。' }, { order: 2, expected: '两个平段价格均为0.6222，逐项核对。' }] });
const evidence = records => ({ status: 'CHECKS_PASSED', records });
const record = (item, changes = {}) => ({ step_order: item.step_order, kind: item.kind, status: 'PASSED', contract: structuredClone(item.contract), ...changes });

test('unconfigured cases retain the old behavior, while NOT_USED and absent records stay missing', () => {
  assert.deepEqual(extractBrowserAssertionContract({ test_data: 'ordinary data', steps: [] }), { configured: false, obligations: [] });
  assert.deepEqual(evaluateBrowserAssertionObligations({ test_data: 'ordinary data', steps: [] }, { status: 'NOT_USED', records: [] }),
    { configured: false, status: 'NOT_CONFIGURED', items: [] });
  for (const browserEvidence of [{ status: 'NOT_USED', records: [] }, evidence([]),
    { status: 'NOT_USED', records: obligations.map(item => record(item)) }]) {
    const result = evaluateBrowserAssertionObligations(frozen(obligations), browserEvidence);
    assert.equal(result.status, 'MISSING');
    assert.deepEqual(result.items.map(item => item.status), ['MISSING', 'MISSING']);
    assert.deepEqual(result.items.map(item => item.record_index), [null, null]);
  }
});

test('only the same step, kind and complete canonical contract can cover an obligation', () => {
  const wrongPrice = structuredClone(jsonResponse); wrongPrice.arrays[0].items[1].price = 0.9555;
  for (const wrong of [
    record(obligations[1], { step_order: 1 }), record(obligations[1], { kind: 'no_writes' }),
    record(obligations[1], { contract: { ...jsonResponse, path: '/api/templates/12' } }),
    record(obligations[1], { contract: wrongPrice }),
    record(obligations[1], { contract: { ...jsonResponse, extra: true } }),
  ]) {
    const result = evaluateBrowserAssertionObligations(frozen([obligations[1]]), evidence([wrong]));
    assert.equal(result.status, 'MISSING');
    assert.equal(result.items[0].record_index, null);
  }
  const good = obligations.map(item => record(item));
  const result = evaluateBrowserAssertionObligations(frozen(obligations), evidence(good));
  assert.equal(result.status, 'COVERED');
  assert.deepEqual(result.items.map(item => [item.status, item.record_index]), [['COVERED', 0], ['COVERED', 1]]);
});

test('a failed or unknown matching check cannot be overridden by another passing record', () => {
  const result = evaluateBrowserAssertionObligations(frozen([obligations[0]]),
    { status: 'CHECKS_NOT_PASSED', records: [record(obligations[0]), record(obligations[0], { status: 'FAILED' })] });
  assert.equal(result.status, 'CHECKS_NOT_PASSED');
  assert.deepEqual(result.items.map(item => [item.status, item.record_index]), [['CHECKS_NOT_PASSED', 1]]);
});

test('business status scope is part of the no-successful-writes contract', () => {
  const item = { ...obligations[0], kind: 'no_successful_writes', contract: { ...noWrites,
    business_status: { pointer: '/code', success: [200], failure: [500] } } };
  assert.equal(evaluateBrowserAssertionObligations(frozen([item]), evidence([record(item)])).status, 'COVERED');
  const changed = record(item); changed.contract.business_status.failure = [400];
  assert.equal(evaluateBrowserAssertionObligations(frozen([item]), evidence([changed])).status, 'MISSING');
});

test('source quote, duplicate or malformed blocks and unsafe contracts are rejected', () => {
  for (const rows of [
    [{ ...obligations[0], source_quote: '页面看起来正确' }],
    [obligations[0], { ...obligations[1], id: obligations[0].id }],
    [{ ...obligations[0], contract: { ...noWrites, paths: ['/api/templates?x=1'] } }],
    [{ ...obligations[0], contract: { ...noWrites, extra: true } }],
    [{ ...obligations[1], contract: { ...jsonResponse, equals: [{ pointer: '/data/token', value: 'x' }] } }],
    [{ ...obligations[1], contract: { ...jsonResponse, arrays: [{ ...jsonResponse.arrays[0], fields: ['__proto__'] }] } }],
  ]) assert.throws(() => extractBrowserAssertionContract(frozen(rows)), /BROWSER_ASSERTION_CONTRACT_INVALID/);
  const duplicate = frozen(obligations); duplicate.test_data += '\n' + duplicate.test_data;
  assert.throws(() => extractBrowserAssertionContract(duplicate), /BROWSER_ASSERTION_CONTRACT_INVALID/);
  assert.throws(() => extractBrowserAssertionContract({ ...frozen(obligations), test_data: '[workbench-browser-assertions-v1]\n{' }), /BROWSER_ASSERTION_CONTRACT_INVALID/);
  assert.throws(() => extractBrowserAssertionContract({ ...frozen(obligations), test_data: frozen(obligations).test_data.replace('[/workbench-browser-assertions-v1]', '') }), /BROWSER_ASSERTION_CONTRACT_INVALID/);
  assert.throws(() => extractBrowserAssertionContract(frozen(Array.from({ length: 21 }, (_, index) => ({ ...obligations[0], id: `item-${index}` })))), /BROWSER_ASSERTION_CONTRACT_INVALID/);
  assert.throws(() => extractBrowserAssertionContract({ ...frozen(obligations), test_data: `[workbench-browser-assertions-v1]\n${' '.repeat(24 * 1024 + 1)}\n[/workbench-browser-assertions-v1]` }), /BROWSER_ASSERTION_CONTRACT_INVALID/);
});
