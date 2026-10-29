import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { BACKEND_EXECUTION_INPUT_SCHEMA, BACKEND_FORMAT_EXAMPLE, BACKEND_CONTRACT_PROMPT, BACKEND_VALIDATION_GUIDANCE } from '../server/backend/harness-contract.mjs';
import { BACKEND_HARNESS_TOOLS, startBackendHarnessMcp } from '../server/backend/harness-mcp.mjs';
import { BackendHarnessSession } from '../server/backend/harness-session.mjs';
import { backendDigest, validateBackendExecution } from '../server/backend/schema.mjs';

const copy = value => structuredClone(value);
function fixture(execution = copy(BACKEND_FORMAT_EXAMPLE)) {
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', steps: execution.steps.map(step => ({ order: step.order, action: 'Read fixture', expected: 'value equals 1' })) };
  const hash = backendDigest(content).toUpperCase();
  const context = { caseVersion: { version: 1, content, content_sha256: hash }, binding: { binding_id: 'binding-test', version: 1,
    case_version: 1, case_content_sha256: hash, protocol_source_id: 'source-test', protocol_sha256: 'a'.repeat(64),
    status: 'COMPLETE', confirmation_status: 'CONFIRMED', mappings: [] }, protocol: { segments: [] } };
  const environment = { id: 'syntax-example', environment_id: 'syntax-example', authorized: true, non_production: true,
    mode: 'synthetic-namespace', base_url: 'http://127.0.0.1:1', allowed_methods: ['GET', 'POST', 'DELETE'],
    allowed_path_prefixes: ['/__control/namespaces/', '/api/v1/namespaces/'],
    namespace: { setup_path: '/__control/namespaces', resource_prefix: '/api/v1/namespaces/', cleanup_prefix: '/__control/namespaces/' } };
  return { context, environment, execution, validate: input => validateBackendExecution({ ...context, environment, execution: input }) };
}
// Validate the advertised subset of standard JSON Schema without dependencies,
// server bindings or model/SUT calls. This also checks nested additionalProperties.
function matches(value, schema) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![].concat(schema.type).some(t => t === type || t === 'integer' && Number.isInteger(value))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
  if (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum) return false;
  if (type === 'array') return !(schema.minItems > value.length || schema.maxItems < value.length) && value.every(item => matches(item, schema.items || {}));
  if (type === 'object') return (schema.required || []).every(key => Object.hasOwn(value, key)) && Object.entries(value).every(([key, item]) => {
    if (schema.properties?.[key]) return matches(item, schema.properties[key]);
    return schema.additionalProperties !== false && (typeof schema.additionalProperties !== 'object' || matches(item, schema.additionalProperties));
  });
  return true;
}

test('advertised nested schema and complete format example agree with authoritative validator', () => {
  const tool = BACKEND_HARNESS_TOOLS.find(row => row.name === 'write_draft');
  assert.deepEqual(tool.inputSchema.properties.execution, BACKEND_EXECUTION_INPUT_SCHEMA);
  assert.equal(matches({ previous_sha256: null, execution: BACKEND_FORMAT_EXAMPLE }, tool.inputSchema), true);
  const f = fixture(); assert.ok(f.validate(f.execution));
  assert.ok(BACKEND_CONTRACT_PROMPT.includes(JSON.stringify(BACKEND_FORMAT_EXAMPLE)));
  const extra = copy(f.execution); extra.steps[0].requests[0].body = {};
  assert.equal(matches(extra, BACKEND_EXECUTION_INPUT_SCHEMA), false);
  assert.throws(() => f.validate(extra), /BACKEND_REQUEST_INVALID/);
});

test('MCP normalizes only quoted null and keeps strict draft compare-and-swap', async () => {
  for (const initial of ['null', null]) {
    const f = fixture(), plan = { execution: null, revision: 1, quality_review_mode: 'static-v1' };
    const session = new BackendHarnessSession({ plan, ...f, persist: async () => {}, execute: async () => { throw Error('HTTP must not run'); } });
    const server = await startBackendHarnessMcp((name, args) => session.invoke(name, args));
    const call = async args => {
      const response = await fetch(server.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'write_draft', arguments: args } }) });
      const result = (await response.json()).result;
      return { isError: !!result.isError, ...JSON.parse(result.content[0].text) };
    };
    try {
      for (const previous_sha256 of ['', 'NULL', ' null ', '0'.repeat(64)]) {
        assert.equal((await call({ execution: f.execution, previous_sha256 })).code, 'BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED');
        assert.equal(plan.execution, null);
      }
      assert.equal((await call({ execution: f.execution })).code, 'BACKEND_HARNESS_ARGUMENTS_INVALID');
      const first = await call({ execution: f.execution, previous_sha256: initial });
      assert.equal(first.isError, false); assert.equal(first.draft_saved, true);
      const frozenExecution = copy(plan.execution), frozenRevision = plan.revision;
      const changed = copy(f.execution); changed.request_timeout_ms = 4321;
      for (const previous_sha256 of ['null', null, '0'.repeat(64)]) {
        assert.equal((await call({ execution: changed, previous_sha256 })).code, 'BACKEND_DRAFT_CHANGED_RELOAD_REQUIRED');
        assert.deepEqual(plan.execution, frozenExecution); assert.equal(plan.revision, frozenRevision);
      }
      const updated = await call({ execution: changed, previous_sha256: first.draft_sha256 });
      assert.equal(updated.isError, false); assert.notEqual(updated.draft_sha256, first.draft_sha256);
      assert.equal(plan.execution.request_timeout_ms, 4321);
    } finally { await server.close(); }
  }
});

test('read-only, response reference, header and expected_from formats retain existing gates', () => {
  const f = fixture(); const execution = f.execution;
  execution.steps[0].requests.push({ id: 'reuse', response_ref: 'query', assertions: [
    { target: 'json', pointer: '/value', op: 'equals', expected_from: { request_id: 'query', pointer: '/value' } },
    { target: 'header', pointer: '/content-type', op: 'media_type_equals', value: 'application/json' }] });
  assert.equal(matches(execution, BACKEND_EXECUTION_INPUT_SCHEMA), true); assert.ok(f.validate(execution));
  const readonly = { ...execution, setup: [], cleanup: [], steps: [{ order: 1, requests: [{ id: 'query', method: 'GET', path: '/api/example', assertions: [{ target: 'json', pointer: '/value', op: 'equals', value: 1 }] }] }] };
  const environment = { ...f.environment, mode: 'http-json-readonly', namespace: undefined, allowed_methods: ['GET'], allowed_path_prefixes: ['/api/'] };
  assert.equal(matches(readonly, BACKEND_EXECUTION_INPUT_SCHEMA), true);
  assert.ok(validateBackendExecution({ ...f.context, environment, execution: readonly }));
});

test('model-visible schema and validator agree on same-record and nonempty-string assertions', () => {
  const f=fixture();f.execution.steps[0].requests[0].assertions.push(
    {target:'json',pointer:'/items',op:'array_some_fields_equal',value:{code:'KNOWN-ID',name:'Known name'}},
    {target:'json',pointer:'/message',op:'string_nonempty',value:true});
  assert.equal(matches(f.execution,BACKEND_EXECUTION_INPUT_SCHEMA),true);assert.ok(f.validate(f.execution));
  const reuse={id:'check-same-response',response_ref:'query',assertions:[
    {target:'json',pointer:'/items',op:'array_some_fields_equal',value:{code:'KNOWN-ID',name:'Known name'}}]};
  f.execution.steps[0].requests.push(reuse);assert.ok(f.validate(f.execution));
  reuse.assertions[0].expected_from=null;assert.throws(()=>f.validate(f.execution),/BACKEND_ASSERTION_INVALID/);
});

test('known error parameters have specific correction guidance and remain rejected until corrected', async () => {
  const mutations = [
    ['BACKEND_EXECUTION_INVALID', plan => { plan.schema = 'wrong'; }, /schema/],
    ['BACKEND_ASSERTION_INVALID', plan => { plan.steps[0].requests[0].assertions[2].value = 'true'; }, /Boolean/],
    ['BACKEND_CLEANUP_REQUIRED', plan => { plan.cleanup = []; }, /both/],
    ['BACKEND_NAMESPACE_SETUP_ASSERTIONS_REQUIRED', plan => { plan.setup[0].assertions[0].value = 200; }, /201/],
    ['BACKEND_NAMESPACE_CLEANUP_ASSERTIONS_REQUIRED', plan => { plan.cleanup[0].assertions[0].value = 201; }, /200/],
  ];
  for (const [code, mutate, expectedGuide] of mutations) {
    const f = fixture(), bad = copy(f.execution); mutate(bad);
    assert.throws(() => f.validate(bad), error => error.message === code);
    assert.match(BACKEND_VALIDATION_GUIDANCE[code], expectedGuide);
    let executes = 0;
    const plan = { execution: null, revision: 1, quality_review_mode: 'static-v1' };
    const session = new BackendHarnessSession({ plan, ...f, persist: async () => {}, execute: async () => { executes++; } });
    await assert.rejects(session.invoke('write_draft', { previous_sha256: null, execution: bad }), error => error.message === code);
    assert.equal(session.state.tool_diagnostics.recent.at(-1).error_code, code);
    assert.equal(plan.execution, null);
    await session.invoke('write_draft', { previous_sha256: null, execution: f.execution });
    assert.ok(plan.execution); assert.equal(executes, 0);
  }
});

test('all schema validator codes have safe persistent guidance, unknown errors stay collapsed', async () => {
  const source = await fs.readFile(new URL('../server/backend/schema.mjs', import.meta.url), 'utf8');
  const codes = new Set([...source.matchAll(/(?:fail|keys)\([^\n]*?'(BACKEND_[A-Z_]+)'/g)].map(match => match[1]));
  for (const code of codes) assert.equal(typeof BACKEND_VALIDATION_GUIDANCE[code], 'string', code);
  const f = fixture(), session = new BackendHarnessSession({ plan: { execution: null }, ...f, persist: async () => {} });
  session.recordTool('write_draft', null, new Error('unsanitized secret text'));
  assert.equal(session.state.tool_diagnostics.recent.at(-1).error_code, 'OTHER_TOOL_FAILURE');
});
