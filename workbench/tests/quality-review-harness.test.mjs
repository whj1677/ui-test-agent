import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareCandidateQualityInput } from '../server/quality-review.mjs';
import { createQualityReviewToolSession, createHarnessQualityReviewer } from '../server/quality-review-harness.mjs';
import { qualityReviewHarnessPatch } from '../server/quality-review-harness-patch.mjs';
import { REVIEW_TOOLS, startQualityReviewMcp } from '../server/quality-review-harness-mcp.mjs';
import { apply as applyGuard } from '../server/quality-review-harness-guard.mjs';

const CASE_SHA = 'a'.repeat(64), CANDIDATE_SHA = 'b'.repeat(64);
const frozenCase = { steps: [{ order: 1, action: '打开列表', expected: '显示三条记录' }] };
const files = [{ path: 'candidate.spec.mjs', content: 'openList();\nassertThreeRows();' }];
const prepared = prepareCandidateQualityInput({ kind: 'ui', frozenCase, caseSha256: CASE_SHA,
  candidateSha256: CANDIDATE_SHA, files, evidence: { status: 'PASSED' } });
const obligations = [
  { order: 1, field: 'action', quote: '打开列表', check: '执行打开列表动作' },
  { order: 1, field: 'expected', quote: '显示三条记录', check: '核对完整数量' },
];
const answer = { steps: [{ order: 1, implementation: 'COVERED', explanation: '第二行断言三条记录',
  locations: [{ path: 'candidate.spec.mjs', start_line: 2, end_line: 2 }] }], findings: [] };

test('B boundary distinguishes wire JSON failure, schema refusal and host invocation without raw arguments', async () => {
  let invoked = 0;
  const endpoint = await startQualityReviewMcp(async () => { invoked++; return {ok:true}; });
  const send = body => fetch(endpoint.url, {method:'POST',headers:{'content-type':'application/json'},body});
  try {
    const invalid = await send('{"sensitive_canary":"not-complete');
    assert.equal(invalid.status,400); await invalid.text();
    const schema = await send(JSON.stringify({id:1,method:'tools/call',params:{name:'read_case',arguments:{sensitive_canary:'do-not-export'}}}));
    assert.equal(schema.status,200); assert.equal((await schema.json()).result.isError,true);
    const valid = await send(JSON.stringify({id:2,method:'tools/call',params:{name:'read_case',arguments:{}}}));
    assert.equal(valid.status,200); await valid.text();
    assert.equal(invoked,1);
    const receipt=endpoint.receipt;
    assert.equal(receipt.received,3);
    assert.deepEqual(receipt.requests.map(x=>x.outcome),['JSON_PARSE_REJECTED','SCHEMA_REJECTED','INVOKED']);
    assert.equal(receipt.requests[0].sha256.length,64);
    assert.equal(JSON.stringify(receipt).includes('sensitive_canary'),false);
    assert.equal(JSON.stringify(receipt).includes(endpoint.url),false);
  } finally { await endpoint.close(); }
});

test('B tools enforce case-first obligation commitment, exact source quotes, and one bounded replay', async () => {
  let replayCount = 0;
  const session = createQualityReviewToolSession({ payload: prepared.payload,
    replay: async () => { replayCount++; return { status: 'PASSED' }; } });
  await assert.rejects(session.invoke('read_candidate'), /QUALITY_REVIEW_TOOL_SEQUENCE_INVALID/);
  await session.invoke('read_case');
  await assert.rejects(session.invoke('submit_obligations', { obligations: [{ ...obligations[0], quote: '伪造原文' }, obligations[1]] }), /QUALITY_REVIEW_OBLIGATIONS_INVALID/);
  await session.invoke('submit_obligations', { obligations: [...obligations, { ...obligations[1], quote: '三条记录', check: '逐条覆盖' }] });
  await session.invoke('read_candidate');
  await session.invoke('read_evidence');
  assert.deepEqual(await session.invoke('request_replay'), { replay: { status: 'PASSED' }, candidate_sha256: CANDIDATE_SHA });
  await assert.rejects(session.invoke('request_replay'), /QUALITY_REVIEW_TOOL_SEQUENCE_INVALID/);
  assert.equal(replayCount, 1);
  await assert.rejects(session.invoke('submit_review', { steps: [{ ...answer.steps[0], locations: [{ path: 'wrong.mjs', start_line: 1, end_line: 1 }] }], findings: [] }), /MODEL_RESPONSE_LOCATION_INVALID/);
  await session.invoke('submit_review', answer);
  assert.deepEqual(session.answer, answer);
  assert.equal(session.investigation.obligations.length, 3);
  assert.equal(session.investigation.replay_identity.candidate_sha256, CANDIDATE_SHA);
  assert.deepEqual(session.investigation.tool_events.map(row => row.tool).slice(0, 3), ['read_candidate', 'read_case', 'submit_obligations']);
  await assert.rejects(session.invoke('read_evidence'), /QUALITY_REVIEW_TOOL_SEQUENCE_INVALID/);
});

test('B MCP rejects arbitrary parameters and exposes no write, browser, shell, or native tool', async () => {
  assert.deepEqual(REVIEW_TOOLS.map(tool => tool.name), ['read_case', 'submit_obligations', 'read_candidate', 'read_evidence', 'request_replay', 'submit_review']);
  const endpoint = await startQualityReviewMcp(async () => ({ ok: true }));
  let id = 0;
  const call = async (name, args) => (await (await fetch(endpoint.url, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id,
      method: 'tools/call', params: { name, arguments: args } }) })).json());
  try {
    const discovered = await (await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'server/discover', params: {} }) })).json();
    assert.equal(discovered.error.code, -32601);
    assert.equal((await call('write_draft', {})).error.message, 'QUALITY_REVIEW_TOOL_DENIED');
    assert.equal((await call('read_candidate', { path: 'C:\\secret' })).result.isError, true);
    assert.equal((await call('request_replay', { url: 'http://127.0.0.1:4462/' })).result.isError, true);
  } finally { await endpoint.close(); }
  assert.match(qualityReviewHarnessPatch(), /toolCallTimeoutMs: 240000/);
  const handlers = new Map();
  applyGuard({ on(name, handler) { handlers.set(name, handler); }, tools: { schemas: () => [{ name: 'run_code' }, { name: 'mcp__workbench-quality-review__read_case' }] } });
  let denied;
  handlers.get('agent/created')({ agent: { ctx: { tools: { presentAs() {}, restrict(value) { denied = value.deny; } } } } });
  assert.deepEqual(denied, ['run_code']);
  assert.equal((await handlers.get('tools/pre-execute')({ name: 'run_code' }, () => 'allowed')).kind, 'deny');
});

test('B MCP lets a reviewer correct invalid submission without weakening host validation or resetting the budget', async () => {
  const session = createQualityReviewToolSession({ payload: prepared.payload });
  const endpoint = await startQualityReviewMcp((name, args) => session.invoke(name, args),
    { onRejected: (name, code) => session.reject(name, code) });
  let id = 0;
  const call = async (name, args = {}) => {
    const response = await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }) });
    return { status: response.status, body: await response.json() };
  };
  try {
    await call('read_case'); await call('submit_obligations', { obligations });
    await call('read_candidate'); await call('read_evidence');
    const invalid = await call('submit_review', { ...answer, verdict: 'PASS' });
    assert.equal(invalid.status, 200);
    assert.equal(invalid.body.result.isError, true);
    assert.equal(session.answer, null); assert.equal(session.phase, 'EVIDENCE_READ');
    assert.equal(session.toolCalls, 5);
    assert.equal(session.investigation.tool_events.at(-1).error_code, 'QUALITY_REVIEW_TOOL_ARGUMENTS_INVALID');
    const wrongLocation = await call('submit_review', { ...answer,
      steps: [{ ...answer.steps[0], locations: [{ path: 'private.mjs', start_line: 1, end_line: 1 }] }] });
    assert.equal(wrongLocation.body.result.isError, true);
    assert.equal(session.answer, null);
    const corrected = await call('submit_review', answer);
    assert.equal(corrected.body.result.isError, undefined);
    assert.deepEqual(session.answer, answer); assert.equal(session.toolCalls, 7);
  } finally { await endpoint.close(); }
  const controller = new AbortController();
  const limited = createQualityReviewToolSession({ payload: prepared.payload, signal: controller.signal,
    maxToolCalls: 1, abort: reason => controller.abort(reason) });
  limited.reject('submit_review', 'QUALITY_REVIEW_TOOL_ARGUMENTS_INVALID');
  limited.reject('submit_review', 'QUALITY_REVIEW_TOOL_ARGUMENTS_INVALID');
  assert.equal(limited.toolCalls, 2); assert.equal(controller.signal.reason, 'QUALITY_REVIEW_TOOL_BUDGET_EXHAUSTED');
  await assert.rejects(limited.invoke('read_case'), /CANCELLED/);
});

test('B factory runs a separate injected DSH flow with unknown provider cost and preserved identity', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-review-test-'));
  let started = 0; const charged = [];
  const reviewer = createHarnessQualityReviewer({ dshHome: 'synthetic-dsh-home', root,
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'synthetic-only', baseUrl: 'https://example.invalid' }),
    ensureRuntime: async () => {}, probeConfig: async () => ({ exitCode: 0,
      stdout: '- id: agent-default-model\n  config:\n    model: deepseek-flash\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- id: quality-review-tool-guard\n- id: quality-review-mcp\n' }),
    runHarness: async ({ env, onLifecycle }) => {
      await onLifecycle({ type: 'process_spawn' });
      let id = 0;
      const invoke = async (name, args = {}) => {
        await onLifecycle({ type: 'harness_event', event_type: 'tool_call', tool: `mcp__workbench-quality-review__${name}` });
        const response = await fetch(env.WORKBENCH_QUALITY_REVIEW_ENDPOINT, { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id,
            method: 'tools/call', params: { name, arguments: args } }) });
        const result = (await response.json()).result;
        if (result.isError) throw Error(result.content[0].text);
        return JSON.parse(result.content[0].text);
      };
      await invoke('read_case'); await invoke('submit_obligations', { obligations });
      await invoke('read_candidate'); await invoke('read_evidence'); await invoke('submit_review', answer);
      return { toolCalls: 5, processResult: { exitCode: 0, termination: null, outputComplete: true, closeObserved: true },
        events: [{ type: 'final' }, { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } }] };
    } });
  try {
    const result = await reviewer.review({ kind: 'ui', frozenCase, caseSha256: CASE_SHA, candidateSha256: CANDIDATE_SHA,
      files, evidence: { status: 'PASSED' }, reserveStartup: () => { started++; },
      onTool: event => charged.push(event) });
    assert.equal(result.status, 'NO_FINDINGS', JSON.stringify(result));
    assert.equal(result.input_sha256, prepared.input_sha256);
    assert.equal(result.harness_starts, 1);
    assert.equal(result.tool_calls, 5);
    assert.equal(started, 1);
    assert.equal(result.model_calls, null);
    assert.equal(result.usage, null);
    assert.equal(result.provider_requests, null);
    assert.equal(result.investigation.phase, 'SUBMITTED');
    assert.equal(result.investigation.tool_events.length, 5);
    assert.equal(charged.length, 5);
    assert.equal(charged[0].name, 'mcp__workbench-quality-review__read_case');
    for(const [key,value] of Object.entries({ exit_code: 0, termination: null,
      turn_end_reason: 'completed', final_present: true, completed: true, candidate_submitted: true }))assert.equal(result.process_diagnostic[key],value);
    assert.equal(result.process_diagnostic.provider_http_status,null);
    assert.equal(result.process_diagnostic.mcp_boundary.received,5);
    assert.equal(result.process_diagnostic.mcp_boundary.requests.filter(x=>x.outcome==='INVOKED').length,5);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('B keeps provider failure classification without exporting raw provider error or credentials', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-review-provider-test-'));
  const canary = 'SYNTHETIC_SECRET_DO_NOT_EXPORT';
  const reviewer = createHarnessQualityReviewer({ dshHome: 'synthetic-dsh-home', root,
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: canary, baseUrl: 'https://example.invalid' }),
    ensureRuntime: async () => {}, probeConfig: async () => ({ exitCode: 0,
      stdout: '- id: agent-default-model\n  config:\n    model: deepseek-flash\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- id: quality-review-tool-guard\n- id: quality-review-mcp\n' }),
    runHarness: async ({ onLifecycle }) => {
      await onLifecycle({ type: 'process_spawn' });
      return { toolCalls: 0, processResult: { exitCode: 1, stderr: 'DeepSeek Messages request failed (429) ' + canary },
        events: [{ type: 'error', message: 'DeepSeek Messages request failed (429) ' + canary },
          { type: 'status', phase: 'turn_end', reason: { kind: 'error', error: {
            code: 'HTTP_429', message: 'DeepSeek Messages request failed (429) ' + canary } } }] };
    } });
  try {
    const result = await reviewer.review({ kind: 'ui', frozenCase, caseSha256: CASE_SHA,
      candidateSha256: CANDIDATE_SHA, files, evidence: { status: 'PASSED' } });
    assert.equal(result.status, 'NEEDS_ANALYSIS'); assert.equal(result.error_code, 'QUALITY_REVIEW_HARNESS_INCOMPLETE');
    assert.equal(result.process_diagnostic.provider_http_status, 429);
    assert.equal(result.process_diagnostic.event_error_class, 'PROVIDER_HTTP_FAILURE');
    assert.equal(result.process_diagnostic.stderr_class, 'PROVIDER_HTTP_FAILURE');
    assert.match(result.process_diagnostic.stderr_diagnostic.excerpt, /429/);
    assert.match(result.process_diagnostic.terminal_error_diagnostic.excerpt, /429/);
    assert.equal(result.process_diagnostic.terminal_error_diagnostic.sha256.length, 64);
    assert.equal(result.harness_starts, 1); assert.equal(result.model_calls, null);
    assert.equal(JSON.stringify(result).includes(canary), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('B tool cap and cancellation remain fail closed with spent counters', async () => {
  const controller = new AbortController();
  let aborted;
  const session = createQualityReviewToolSession({ payload: prepared.payload, maxToolCalls: 1,
    signal: controller.signal, abort: reason => { aborted = reason; controller.abort(reason); } });
  await session.invoke('read_case');
  await assert.rejects(session.invoke('submit_obligations', { obligations }), /QUALITY_REVIEW_TOOL_BUDGET_EXHAUSTED/);
  assert.equal(session.toolCalls, 2);
  assert.equal(aborted, 'QUALITY_REVIEW_TOOL_BUDGET_EXHAUSTED');
  assert.equal(session.answer, null);
});

test('B rejects a replay bearing a different candidate identity', async () => {
  const session = createQualityReviewToolSession({ payload: prepared.payload,
    replay: async () => ({ status: 'PASSED', bundle_sha256: 'c'.repeat(64) }) });
  await session.invoke('read_case');
  await session.invoke('submit_obligations', { obligations });
  await session.invoke('read_candidate');
  await session.invoke('read_evidence');
  await assert.rejects(session.invoke('request_replay'), /QUALITY_REVIEW_REPLAY_IDENTITY_INVALID/);
  assert.equal(session.replays, 1);
  assert.equal(session.investigation.replay_identity, null);
});

test('B charges a denied native DSH tool attempt to the shared task budget', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-review-budget-test-'));
  let charged;
  const reviewer = createHarnessQualityReviewer({ dshHome: 'synthetic-dsh-home', root,
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'synthetic-only', baseUrl: 'https://example.invalid' }),
    ensureRuntime: async () => {}, probeConfig: async () => ({ exitCode: 0,
      stdout: '- id: agent-default-model\n  config:\n    model: deepseek-flash\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- id: quality-review-tool-guard\n- id: quality-review-mcp\n' }),
    runHarness: async ({ onLifecycle }) => {
      await onLifecycle({ type: 'process_spawn' });
      await onLifecycle({ type: 'harness_event', event_type: 'tool_call', tool: 'run_code' });
      return { toolCalls: 1, processResult: { exitCode: 0, termination: null }, events: [] };
    } });
  try {
    const result = await reviewer.review({ kind: 'ui', frozenCase, caseSha256: CASE_SHA, candidateSha256: CANDIDATE_SHA,
      files, evidence: { status: 'PASSED' }, onTool: event => { charged = event; } });
    assert.equal(charged.name, 'run_code');
    assert.equal(result.tool_calls, 1);
    assert.equal(result.status, 'NEEDS_ANALYSIS');
    assert.equal(result.harness_starts, 1);
    assert.equal(result.process_diagnostic.completed, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
