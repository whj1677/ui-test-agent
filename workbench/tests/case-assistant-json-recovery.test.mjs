import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Session } from '../../harness-probe/node_modules/@deepseek-ai/dsh-session/lib/index.js';
import { createUserMessage } from '../../harness-probe/node_modules/@deepseek-ai/dsh-llm/lib/index.js';
import { allowedEnvironment, DSH_BIN, runHarnessEventProcess, assessHarnessRun } from '../../harness-probe/src/harness-runner.mjs';
import { applyJsonRecovery, isToolJsonFailure, JSON_RECOVERY_LIMIT } from '../server/case-assistant/json-recovery.mjs';
import { CaseAssistantMcpSession, startCaseAssistantMcp } from '../server/case-assistant/mcp-session.mjs';
import { caseAssistantPatch } from '../server/case-assistant/prompt.mjs';

const failure = () => ({ code: 'MALFORMED_RESPONSE', message: 'DeepSeek Messages stream: tool input is invalid JSON' });
function setup() {
  const events = [];
  let handler;
  const dispose = () => {};
  assert.equal(applyJsonRecovery({ on: (name, callback) => {
    assert.equal(name, 'agent/request-error'); handler = callback; return dispose;
  } }, { emit: event => events.push(event) }), dispose);
  const session = Session.create('session-json-recovery-test');
  session.append('turn/start', { turn: 1 });
  session.append('step/start', { turn: 1, step: 1 });
  const user = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '设计人工测试用例' }] });
  session.append('user/message', user, { surfaceOp: 'append' });
  const agent = { session };
  const controller = new AbortController();
  let delegated = 0;
  const invoke = (extra = {}) => handler({ agent, turn: 1, step: 1, provider: 'deepseek-official',
    failure: failure(), signal: controller.signal, ...extra }, () => { delegated += 1; return 'delegated'; });
  return { agent, session, controller, events, invoke, handler, user, delegated: () => delegated };
}

test('only the exact DeepSeek tool-input JSON failure is recoverable', () => {
  assert.equal(isToolJsonFailure(failure()), true);
  for (const candidate of [undefined, {}, { ...failure(), code: 'TRANSPORT' },
    { ...failure(), message: 'DeepSeek Messages stream: message_stop without settled blocks and stop reason' },
    { ...failure(), message: `${failure().message}: secret-provider-details` }]) {
    assert.equal(isToolJsonFailure(candidate), false);
  }
});

test('same-step retry persists a plugin notice without changing the human message or leaking failed output', () => {
  const f = setup();
  const result = f.invoke({ failure: { ...failure(), raw: 'private-arguments', requestId: 'private-request-id' } });
  assert.deepEqual(result, { kind: 'retry' });
  const messages = f.session.deriveMessages();
  assert.deepEqual(messages[0], f.user);
  assert.equal(messages.length, 2);
  const notice = messages[1];
  assert.equal(notice.role, 'user');
  assert.equal(notice.source.kind, 'plugin');
  assert.equal(notice.source.plugin, 'workbench-case-assistant-guard');
  assert.equal(notice.source.form, 'notice');
  assert.ok(Object.isFrozen(notice));
  assert.match(notice.content[0].text, /每次只提交 1 条完整详细用例/);
  assert.match(notice.content[0].text, /此前已暂存的用例保持不变/);
  assert.match(notice.content[0].text, /保持用例编号、业务含义、操作步骤和预期不变/);
  assert.doesNotMatch(JSON.stringify([messages, f.events]), /private-arguments|private-request-id|raw/);
  assert.deepEqual(f.events, [{ type: 'status', phase: 'case_assistant_json_retry', retry: 1, max_retries: 2 }]);
  assert.equal(f.delegated(), 0);
});

test('two retries are shared across steps in one turn and exhaustion does not append or emit', () => {
  const f = setup();
  assert.equal(JSON_RECOVERY_LIMIT, 2);
  assert.deepEqual(f.invoke(), { kind: 'retry' });
  f.session.append('step/end', { turn: 1, step: 1 });
  f.session.append('step/start', { turn: 1, step: 2 });
  assert.deepEqual(f.invoke({ step: 2 }), { kind: 'retry' });
  const seq = f.session.seq;
  assert.equal(f.invoke({ step: 3 }), 'delegated');
  assert.equal(f.session.seq, seq);
  assert.equal(f.events.length, 2);
  assert.equal(f.delegated(), 1);
});

test('a new turn and a separate agent each have their own finite retry allowance', () => {
  const f = setup();
  f.invoke(); f.invoke();
  f.session.append('step/end', { turn: 1, step: 1 });
  f.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
  f.session.append('turn/start', { turn: 2 });
  f.session.append('step/start', { turn: 2, step: 1 });
  assert.deepEqual(f.invoke({ turn: 2 }), { kind: 'retry' });
  assert.equal(f.events.at(-1).retry, 1);
  const other = { session: Session.create('session-json-recovery-other') };
  assert.deepEqual(f.invoke({ agent: other }), { kind: 'retry' });
  assert.equal(f.events.at(-1).retry, 1);
});

test('aborted requests never retry, delegate, append a notice or emit progress', () => {
  const f = setup();
  f.controller.abort('cancelled');
  const seq = f.session.seq;
  assert.equal(f.invoke(), undefined);
  assert.equal(f.session.seq, seq);
  assert.equal(f.events.length, 0);
  assert.equal(f.delegated(), 0);
});

test('cancellation triggered during notification wins over the retry decision', () => {
  const f = setup();
  let callback;
  applyJsonRecovery({ on: (_event, handler) => { callback = handler; } }, {
    emit: () => f.controller.abort('cancelled'),
  });
  assert.equal(callback({ agent: f.agent, turn: 1, step: 1, provider: 'deepseek-official',
    failure: failure(), signal: f.controller.signal }, () => 'unexpected'), undefined);
});

test('other providers and errors delegate untouched without consuming the JSON recovery budget', () => {
  const f = setup();
  for (const extra of [{ provider: 'another-provider' }, { failure: { ...failure(), code: 'AUTH' } },
    { failure: { ...failure(), message: 'DeepSeek Messages stream: event precedes message_start' } }]) {
    assert.equal(f.invoke(extra), 'delegated');
  }
  assert.equal(f.events.length, 0);
  assert.equal(f.session.deriveMessages().length, 1);
  assert.deepEqual(f.invoke(), { kind: 'retry' });
  assert.equal(f.events[0].retry, 1);
});

test('failure to persist the recovery notice cannot emit progress or start another model request', () => {
  const f = setup();
  const agent = { session: { append: () => { throw new Error('notice persistence failed'); } } };
  assert.throws(() => f.invoke({ agent }), /notice persistence failed/);
  assert.equal(f.events.length, 0);
  assert.equal(f.delegated(), 0);
});

function messagesStream(index, tool, argumentsText) {
  const events = [{ type: 'message_start', message: { id: `fixture-message-${index}`, type: 'message', role: 'assistant',
    model: 'deepseek-flash', content: [], usage: { input_tokens: 20, output_tokens: 0 } } }];
  events.push({ type: 'content_block_start', index: 0, content_block: tool
    ? { type: 'tool_use', id: `fixture-call-${index}`, name: `mcp__workbench-case-assistant__${tool}`, input: {} }
    : { type: 'text', text: '草稿已提交。' } });
  if (tool) events.push({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: argumentsText } });
  events.push({ type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' });
  return events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
}

// This is a fake provider, not a workbench: the installed DSH process still owns
// the real Messages parser, agent loop, guard plugin and MCP tool execution.
async function runOfflineDsh(t, mode) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'case-assistant-json-loop-'));
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const home = path.join(directory, 'home');
  await fs.mkdir(home);
  const calls = [];
  const mcpSession = new CaseAssistantMcpSession({ projectId: 'project-json-loop', sources: [],
    messages: [{ id: 'message-fixture', role: 'user', text: '根据已有页面写两条人工用例。' }] });
  const invoke = mcpSession.invoke.bind(mcpSession);
  mcpSession.invoke = async (name, args) => {
    calls.push({ name, args: structuredClone(args) });
    return invoke(name, args);
  };
  const endpoint = await startCaseAssistantMcp(mcpSession);
  t.after(() => endpoint.close());
  const makeCase = id => ({ case_id: id, external_id: id, case_type: 'UI', title: `测试页面操作 ${id}`,
    module: '离线解析测试', preconditions: '已打开测试页面。', test_data: `编号 ${id}`, pending_questions: [],
    steps: [{ order: 1, action: `在测试页面的编号输入框填写 ${id}，点击查询并等待结果列表显示。`,
      expected: '列表显示待工程师核对的查询结果。', source_refs: [] }] });
  const first = makeCase('UI-A');
  const second = makeCase('UI-B');
  const requests = [];
  const controller = new AbortController();
  const provider = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(payload);
    const index = requests.length;
    if (mode === 'cancel' && index === 4) { controller.abort('cancelled'); return; }
    let tool;
    let args;
    if (index === 1) { tool = 'read_context'; args = '{}'; }
    else if (index === 2) { tool = 'stage_cases'; args = JSON.stringify({ cases: [first] }); }
    else if (index === 3 || mode === 'exhaust') { tool = 'stage_cases'; args = '{"cases":[{"case_id":"UI-B","title":"unclosed"broken"}]}'; }
    else if (index === 4) { tool = 'stage_cases'; args = JSON.stringify({ cases: [second] }); }
    else if (index === 5) {
      tool = 'submit_response'; args = JSON.stringify({ reply: '已提供两条草稿。', questions: [], use_staged_cases: true, image_observations: [] });
    }
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(messagesStream(index, tool, args));
  });
  await new Promise((resolve, reject) => provider.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(async () => { provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); });
  const patchPath = path.join(directory, 'controlled.patch.yml');
  await fs.writeFile(patchPath, `${caseAssistantPatch()}\n- id: session-title-llm\n  disabled: true\n- id: llm-deepseek\n  config:\n    protocol: messages\n    thinking: disabled\n    baseURL: http://127.0.0.1:${provider.address().port}/anthropic\n`);
  let processSpawns = 0;
  const result = await runHarnessEventProcess({ command: process.execPath,
    args: [DSH_BIN, '--profile', 'headless', '--patch', patchPath, '--json', '执行固定的离线工具协议测试。'],
    cwd: directory, env: allowedEnvironment({ DSH_HOME: home, DEEPSEEK_API_KEY: 'offline-fixture-not-a-real-key',
      WORKBENCH_CASE_ASSISTANT_ENDPOINT: endpoint.url }), signal: controller.signal, timeoutMs: 45000, maxToolCalls: 10,
    onLifecycle: event => { if (event.type === 'process_spawn') processSpawns += 1; },
  });
  return { result, requests, calls, processSpawns, mcpSession };
}

test('installed DSH parser and loop recover malformed tool JSON in one process without replaying successful tools', { timeout: 60000 }, async t => {
  const f = await runOfflineDsh(t, 'success');
  assert.equal(f.result.processResult.exitCode, 0, f.result.processResult.stderr);
  assert.equal(assessHarnessRun({ ...f.result, candidateExists: Boolean(f.mcpSession.response), browserToolRequired: false }).success, true);
  assert.equal(f.processSpawns, 1);
  assert.equal(f.requests.length, 6);
  assert.deepEqual(f.calls.map(call => call.name), ['read_context', 'stage_cases', 'stage_cases', 'submit_response']);
  assert.deepEqual(f.calls.filter(call => call.name === 'stage_cases').map(call => call.args.cases[0].case_id), ['UI-A', 'UI-B']);
  assert.deepEqual(f.mcpSession.response.cases.map(item => item.case_id), ['UI-A', 'UI-B']);
  const retries = f.result.events.filter(event => event.phase === 'case_assistant_json_retry');
  assert.deepEqual(retries, [{ type: 'status', phase: 'case_assistant_json_retry', retry: 1, max_retries: 2 }]);
  assert.match(JSON.stringify(f.requests[3].messages), /工作台的格式纠错通知/);
  assert.doesNotMatch(JSON.stringify(f.requests[3].messages), /unclosed|broken/);
});

test('installed DSH loop stops after two malformed-JSON retries and retains only previously staged cases', { timeout: 60000 }, async t => {
  const f = await runOfflineDsh(t, 'exhaust');
  assert.equal(f.result.processResult.exitCode, 1, f.result.processResult.stderr);
  assert.equal(f.processSpawns, 1);
  assert.equal(f.requests.length, 5);
  assert.deepEqual(f.result.events.filter(event => event.phase === 'case_assistant_json_retry').map(event => event.retry), [1, 2]);
  const ending = f.result.events.findLast(event => event.phase === 'turn_end');
  assert.equal(ending.reason.kind, 'error');
  assert.equal(ending.reason.error.code, 'MALFORMED_RESPONSE');
  assert.deepEqual(f.calls.map(call => call.name), ['read_context', 'stage_cases']);
  assert.deepEqual([...f.mcpSession.stagedCases.keys()], ['UI-A']);
  assert.equal(f.mcpSession.response, null);
});

test('cancelling an actual DSH recovery request ends the same process without executing its tool or finalizing', { timeout: 60000 }, async t => {
  const f = await runOfflineDsh(t, 'cancel');
  assert.equal(f.result.processResult.termination, 'cancelled');
  assert.equal(f.processSpawns, 1);
  assert.equal(f.requests.length, 4);
  assert.equal(f.result.events.filter(event => event.phase === 'case_assistant_json_retry').length, 1);
  assert.deepEqual(f.calls.map(call => call.name), ['read_context', 'stage_cases']);
  assert.deepEqual([...f.mcpSession.stagedCases.keys()], ['UI-A']);
  assert.equal(f.mcpSession.response, null);
});
