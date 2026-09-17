import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileAdapter,
  checkAdapterRegression,
  DEFAULT_ADAPTER_SOURCE,
} from '../src/adapter-program.mjs';
import { runAdapter } from '../src/adapter-runtime.mjs';

test('adapter source maps real metadata and a missing text branch is reproducible and repairable', async () => {
  const broken = DEFAULT_ADAPTER_SOURCE.replace(
    'if (element.navigation_text && element.text) return {kind: "text", value: element.text, exact: true};',
    '',
  );
  const input = { tag: 'SPAN', navigation_text: true, text: '电价管理' };
  assert.equal(compileAdapter(broken).locate(input), null);
  assert.throws(() => checkAdapterRegression(broken), { code: 'ADAPTER_REGRESSION_FAILED' });
  const before = await runAdapter([input], { source: broken });
  const after = await runAdapter([input], { source: DEFAULT_ADAPTER_SOURCE, regression: true });
  assert.deepEqual(before.locators, [null]);
  assert.deepEqual(after.locators, [{ kind: 'text', value: '电价管理', exact: true }]);
  assert.notEqual(before.hash, after.hash);
});

test('generated source cannot import, call code, loop, access prototypes, assign, or change the oracle', () => {
  const bodies = [
    'return process.env;',
    'return element.constructor;',
    'return element["text"];',
    'return element.text.constructor;',
    'return globalThis;',
    'return eval("1");',
    'while (true) {}',
    'element.text = "changed"; return null;',
    'return {__proto__: null};',
    'return {get value() { return "x"; }};',
    'return {kind: "text", value: "x", exact: true, passed: true};',
    'return import("node:fs");',
    'return (() => null)();',
    'return element?.text;',
    'return (element.text, null);',
    'return `text`;',
    'return {...element};',
    'return new String("x");',
    'return /x/;',
  ];
  for (const body of bodies)
    assert.throws(
      () => compileAdapter(`export function locate(element) { ${body} }`),
      undefined,
      body,
    );
  assert.throws(() => compileAdapter('import fs from "node:fs"; ' + DEFAULT_ADAPTER_SOURCE));
});

test('regression gate rejects a syntactically valid adapter that silently rebinds every target', () => {
  assert.throws(
    () =>
      checkAdapterRegression(
        'export function locate(element) { return {kind:"text",value:"删除",exact:true}; }',
      ),
    { code: 'ADAPTER_REGRESSION_FAILED' },
  );
});

test('worker reports rejected source and supports cancellation without invoking generated code', async () => {
  await assert.rejects(
    runAdapter([], { source: 'export function locate(element) { return process.env; }' }),
    { code: 'ADAPTER_PROGRAM_REJECTED' },
  );
  await assert.rejects(runAdapter([], { signal: AbortSignal.abort() }), { code: 'STOPPED' });
  await assert.rejects(runAdapter(Array(301).fill({})), { code: 'ADAPTER_INPUT_LIMIT' });
});
