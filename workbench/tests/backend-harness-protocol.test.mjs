import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../server/backend/harness-tool-guard.mjs';
import { startBackendHarnessMcp } from '../server/backend/harness-mcp.mjs';

test('backend DSH guard exposes only the six MCP tools and denies native, run_code and browser at pre-execute', async () => {
  const listeners = new Map(), restricted = [];
  const schemas = ['read', 'write', 'edit', 'run_code', 'browser_navigate', 'mcp__workbench-backend__read_context',
    'mcp__workbench-backend__write_draft', 'mcp__workbench-backend__self_test', 'mcp__workbench-backend__read_evidence', 'mcp__workbench-backend__review_candidate', 'mcp__workbench-backend__submit_candidate'];
  const ctx = { tools: { schemas: () => schemas.map(name => ({ name })) }, on: (name, fn) => listeners.set(name, fn) };
  apply(ctx);
  let presented = false;
  listeners.get('agent/created')({ agent: { ctx: { tools: { presentAs: value => { presented = value === 'native'; }, restrict: value => restricted.push(value) } } } });
  assert.equal(presented, true);
  assert.deepEqual(restricted[0].deny, ['read', 'write', 'edit', 'run_code', 'browser_navigate']);
  let continued = 0;
  for (const name of ['read', 'write', 'edit', 'run_code', 'browser_navigate']) {
    const result = await listeners.get('tools/pre-execute')({ name, arguments: {} }, () => { continued += 1; });
    assert.equal(result.kind, 'deny'); assert.match(result.reason, /BACKEND_HARNESS_TOOL_DENIED/);
  }
  const allowed = await listeners.get('tools/pre-execute')({ name: 'mcp__workbench-backend__self_test', arguments: {} }, () => { continued += 1; return 'allowed'; });
  assert.equal(allowed, 'allowed'); assert.equal(continued, 1);
});

test('backend MCP accepts notifications/discover and serves the six tools including self-test calls', async t => {
  const calls = [];
  const server = await startBackendHarnessMcp(async (name, args) => { calls.push({ name, args }); return { result: 'self-test-evidence' }; });
  t.after(server.close);
  const post = (payload) => fetch(server.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const notification = await post({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  assert.equal(notification.status, 202);
  const discover = await post({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} });
  assert.equal((await discover.json()).error.code, -32601);
  const listing = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const toolDefinitions = (await listing.json()).result.tools;
  const tools = toolDefinitions.map(item => item.name);
  assert.deepEqual(tools, ['read_context', 'write_draft', 'self_test', 'read_evidence', 'review_candidate', 'submit_candidate']);
  const submitDescription = toolDefinitions.find(item => item.name === 'submit_candidate').description;
  assert.match(submitDescription, /whether each original obligation is implemented in the plan, not whether it passed or ran/);
  assert.match(submitDescription, /READY and BUSINESS_DIFFERENCE require each step to cite its real plan request_id and set uncovered to empty/);
  assert.match(submitDescription, /later NOT_RUN steps stay in execution evidence/);
  const call = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'self_test', arguments: {} } });
  assert.equal((await call.json()).result.content[0].text, JSON.stringify({ result: 'self-test-evidence' }));
  assert.deepEqual(calls, [{ name: 'self_test', args: {} }]);
});
