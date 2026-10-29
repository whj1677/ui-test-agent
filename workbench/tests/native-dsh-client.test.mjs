import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeDshClient } from '../server/native-dsh/client.mjs';

const workspace = process.cwd();
const e = (seq, type, data = {}) => ({ seq, type, time: 1000 + seq, data });
const idle = [e(0, 'agent-preset/selected', { preset: 'standard' })];
const prior = [...idle, e(1, 'turn/start', { turn: 1 }), e(2, 'user/message', { source: { rpcId: 'old' } }),
  e(3, 'assistant/message', { turn: 1, message: { content: [{ type: 'text', text: 'old reply' }] } }),
  e(4, 'turn/end', { turn: 1, reason: { kind: 'completed' } })];

function mockHost({ initial = prior, states, status = 200, cookie = false, rejectPrompt = false, lostPromptReply = false,
  authFailure = false, cancelHook, onCall, paginate = false, modelSelection, permissions } = {}) {
  const calls = [], gets = [], selected = [];
  let requestId, count = 0, current = { events: initial, queued: [] }, cancelled = false;
  const reply = (body, value) => Response.json({ type: 'server-response', rpcId: body.rpcId, result: { ok: true, value } });
  const fetchImpl = async (url, init = {}) => {
    if (!init.body) {
      gets.push(url);
      return new Response(null, { status: authFailure ? 401 : 303,
        headers: { location: './', 'set-cookie': 'dsh-auth-local=opaque_signature; HttpOnly; SameSite=Strict; Path=/' } });
    }
    const body = JSON.parse(init.body), request = body.payload.args.request;
    calls.push({ method: body.method, request, headers: init.headers, rpcId: body.rpcId });
    onCall?.(body.method, request);
    assert.equal(new URL(url).pathname, `/api/${body.method}`);
    assert.equal(init.redirect, 'manual');
    if (status !== 200) return new Response(null, { status });
    if (cookie) assert.equal(init.headers.Cookie, 'dsh-auth-local=opaque_signature');
    switch (body.method) {
      case 'session/canOpenWorkspacePath': return reply(body, true);
      case 'session/create': return reply(body, { sessionId: request.sessionId || 'session-owned', agentPreset: 'standard' });
      case 'session/projections': {
        if (requestId) {
          current = states({ requestId, count: count++, cancelled }) || current;
          selected.push(current);
        }
        return reply(body, { asOfSeq: current.events.at(-1)?.seq ?? -1,
          values: { inbox: { 'next-turn': current.queued || [], 'next-step': [] },
            modelSelection: current.modelSelection || modelSelection || { next: { provider: 'deepseek-official', model: 'deepseek-flash' } },
            permissions: current.permissions || permissions || { currentValue: 'workspace-write' } } });
      }
      case 'session/page': {
        const matching = current.events.filter(event => event.seq <= request.throughSeq && (request.beforeSeq === undefined || event.seq < request.beforeSeq));
        const rows = paginate ? matching.slice(-2) : matching;
        return reply(body, { records: rows.map(event => ({ type: 'event', event })), hasMore: rows.length < matching.length });
      }
      case 'session/prompt': {
        if (rejectPrompt) return Response.json({ type: 'server-response', rpcId: body.rpcId,
          result: { ok: false, error: { code: 'session/agent-busy', message: 'busy', details: {} } } });
        requestId = request.requestId;
        assert.ok(requestId);
        assert.equal(request.mode, 'queue');
        assert.deepEqual(body.payload.args, { request });
        if (lostPromptReply) throw Error('connection reset');
        return reply(body, { accepted: true });
      }
      case 'session/cancel': cancelled = true; cancelHook?.(); return reply(body, { accepted: true });
      default: throw Error(`Unexpected request ${body.method}`);
    }
  };
  return { fetchImpl, calls, gets, selected };
}

function turn(base, requestId, { end = true, reason = 'completed', reply = 'new reply', turn = 2 } = {}) {
  const own = { id: 'message-own', role: 'user', content: [{ type: 'text', text: 'task' }], source: { kind: 'user', rpcId: requestId } };
  const rows = [...base];
  const append = (type, data) => rows.push(e(rows.length, type, data));
  append('agent/inbox/spliced', { target: 'next-turn', start: 0, inserted: [own] });
  append('turn/start', { turn });
  append('agent/inbox/spliced', { target: 'next-turn', start: 0, removedCount: 1, inserted: [] });
  append('step/start', { turn, step: 1 });
  append('user/message', own);
  append('assistant/message', { turn, step: 1, message: { content: [{ type: 'thinking', text: 'never export this' }, { type: 'text', text: reply }] }, usage: { input_tokens: 3, output_tokens: 5 } });
  if (end) append('turn/end', { turn, reason: { kind: reason } });
  return { events: rows, queued: [] };
}

const clientFor = (host, extra = {}) => createNativeDshClient({ baseUrl: 'http://127.0.0.1:3080/', fetchImpl: host.fetchImpl,
  // Successful mock runs may intentionally require several polls. Leave room
  // for parallel test scheduling; only the timeout-specific test uses 8 ms.
  pollIntervalMs: 1, cancelTimeoutMs: 8, startTimeoutMs: 1000, ...extra });

test('accepts only explicit loopback HTTP endpoints and hides launch token', () => {
  for (const url of ['https://localhost/', 'http://example.com/', 'http://127.0.0.2/', 'http://user:pass@localhost/', 'http://localhost/path', 'http://localhost/?key=value']) {
    assert.throws(() => createNativeDshClient({ baseUrl: url }), /NATIVE_DSH_URL_INVALID/);
  }
  const client = createNativeDshClient({ baseUrl: 'http://localhost:3080/?token=secret' });
  assert.equal(client.identity.host, 'http://localhost:3080');
  assert.equal(client.identity.tool_exit_code_tracking, true);
  assert.ok(!JSON.stringify(client.identity).includes('secret'));
});

test('read-only inspect exchanges launch URL once, retains cookie only in memory', async () => {
  const host = mockHost({ cookie: true });
  const client = clientFor(host, { baseUrl: 'http://127.0.0.1:3080/?token=secret' });
  assert.equal((await client.inspect()).available, true);
  assert.equal((await client.inspect()).available, true);
  assert.equal(host.gets.length, 1);
  assert.deepEqual(host.calls.map(call => call.method), ['session/canOpenWorkspacePath', 'session/canOpenWorkspacePath']);
  assert.ok(!JSON.stringify(client.identity).includes('secret'));
});

test('browser launch targets the existing nonempty session after authentication without creating or prompting', async () => {
  const host = mockHost({ cookie: true });
  const client = clientFor(host, { baseUrl: 'http://127.0.0.1:3080/?token=secret' });
  await client.inspect();
  const target = await client.openBrowserSession({ sessionId: 'session-owned' });
  assert.equal(target.session_id, 'session-owned');
  const url = new URL(target.url);
  assert.equal(url.origin, 'http://127.0.0.1:3080');
  assert.equal(url.hash, '#workbench-session=session-owned');
  assert.equal(url.searchParams.get('token'), 'secret');
  assert.equal(host.gets.length, 1);
  assert.deepEqual(host.calls.map(call => call.method), ['session/canOpenWorkspacePath', 'session/projections', 'session/page']);
  assert.ok(!JSON.stringify(client.identity).includes('secret'));
});

test('browser launch refuses blank, invalid and unauthenticated targets without falling back to a new session', async () => {
  const empty = mockHost({ initial: idle });
  await assert.rejects(clientFor(empty, { baseUrl: 'http://localhost:3080/?token=secret' }).openBrowserSession({ sessionId: 'empty' }), /SESSION_EMPTY/);
  assert.equal(empty.calls.filter(call => /create|prompt/.test(call.method)).length, 0);
  const host = mockHost();
  const client = clientFor(host);
  await assert.rejects(client.openBrowserSession({ sessionId: '../other?session' }), /SESSION_INVALID/);
  assert.equal(host.calls.length, 0);
  await assert.rejects(client.openBrowserSession({ sessionId: 'session-owned' }), /BROWSER_AUTH_UNAVAILABLE/);
  assert.equal(host.calls.filter(call => /create|prompt/.test(call.method)).length, 0);
});

test('authentication failure is explicit and never creates a session', async () => {
  const host = mockHost({ status: 401 });
  assert.equal((await clientFor(host).inspect()).error, 'NATIVE_DSH_AUTH_REQUIRED');
  assert.equal(host.calls.length, 1);
});

test('lazy runtime resolution occurs only when inspected or run, once', async () => {
  const host = mockHost();
  let starts = 0;
  const client = clientFor(host, { baseUrl: undefined, resolveBaseUrl: async () => { starts++; return { url: 'http://localhost:4567/' }; } });
  assert.equal(client.available, true);
  assert.equal(starts, 0);
  assert.equal((await client.inspect()).available, true);
  await client.inspect();
  assert.equal(starts, 1);
});

test('adopts one session and does not mistake old idle/history for this prompt completion', async () => {
  const host = mockHost({ states: ({ requestId, count }) => count < 2 ? { events: prior, queued: [] } : turn(prior, requestId) });
  const seen = [];
  const result = await clientFor(host).run({ workspace, prompt: 'task', sessionId: 'session-owned', onEvent: event => seen.push(event) });
  assert.equal(result.error, null);
  assert.equal(result.reply, 'new reply');
  assert.deepEqual(result.usage, { input_tokens: 3, output_tokens: 5 });
  assert.ok(host.selected.length >= 3);
  assert.equal(host.calls.filter(call => call.method === 'session/prompt').length, 1);
  assert.equal(host.calls.find(call => call.method === 'session/create').request.sessionId, 'session-owned');
  assert.equal(seen[0].type, 'session_id');
  assert.ok(!JSON.stringify(result).includes('never export this'));
});

test('paged history handles a whole fast turn between polls without losing the own prompt', async () => {
  const host = mockHost({ paginate: true, states: ({ requestId }) => turn(prior, requestId) });
  const result = await clientFor(host).run({ workspace, prompt: 'task' });
  assert.equal(result.error, null);
  assert.ok(host.calls.some(call => call.method === 'session/page' && call.request.beforeSeq !== undefined));
});

test('refuses an already running adopted session before sending anything', async () => {
  const host = mockHost({ initial: [...prior, e(5, 'turn/start', { turn: 2 })] });
  const result = await clientFor(host).run({ workspace, prompt: 'task', sessionId: 'session-owned' });
  assert.equal(result.error, 'NATIVE_DSH_SESSION_BUSY');
  assert.equal(result.busy, true);
  assert.equal(host.calls.filter(call => call.method === 'session/prompt').length, 0);
  assert.equal(host.calls.filter(call => call.method === 'session/cancel').length, 0);
});

test('returns real turn failure rather than the previous successful reply', async () => {
  const host = mockHost({ states: ({ requestId }) => turn(prior, requestId, { reason: 'error', reply: 'failed this time' }) });
  const result = await clientFor(host).run({ workspace, prompt: 'task' });
  assert.equal(result.error, 'NATIVE_DSH_TURN_FAILED');
  assert.equal(result.reply, 'failed this time');
  assert.equal(result.busy, false);
});

test('pre-step rejection can close claimed input without producing a user/message', async () => {
  const host = mockHost({ states: ({ requestId }) => {
    const rows = turn(prior, requestId, { reason: 'blocked' }).events.filter(event => !['user/message', 'assistant/message'].includes(event.type) || event.seq <= 4);
    return { events: rows.map((event, index) => ({ ...event, seq: index })), queued: [] };
  } });
  const result = await clientFor(host).run({ workspace, prompt: 'task' });
  assert.equal(result.error, 'NATIVE_DSH_TURN_FAILED');
  assert.equal(result.busy, false);
});

test('lost prompt response never retries or falsely releases its uncertain session', async () => {
  const host = mockHost({ lostPromptReply: true });
  const client = clientFor(host);
  const result = await client.run({ workspace, prompt: 'task' });
  assert.equal(result.error, 'NATIVE_DSH_CONNECTION_FAILED');
  assert.equal(result.busy, true);
  assert.equal(host.calls.filter(call => call.method === 'session/prompt').length, 1);
  await assert.rejects(client.run({ workspace, prompt: 'do not duplicate' }), /NATIVE_DSH_SESSION_BUSY/);
});

test('signal cancellation requests only its session and confirms the terminal event', async () => {
  const controller = new AbortController();
  const host = mockHost({ states: ({ requestId, cancelled }) => turn(prior, requestId, { end: cancelled, reason: 'aborted' }) });
  const result = await clientFor(host).run({ workspace, prompt: 'task', signal: controller.signal,
    onEvent: event => { if (event.event_type === 'turn/start') controller.abort(); } });
  assert.equal(result.error, 'NATIVE_DSH_CANCELLED');
  assert.equal(result.stop_confirmed, true);
  assert.deepEqual(host.calls.filter(call => call.method === 'session/cancel').map(call => call.request), [{ sessionId: 'session-owned' }]);
});

test('cancel receipt without a turn end remains busy, and close does not claim it stopped', async () => {
  const controller = new AbortController();
  const host = mockHost({ states: ({ requestId }) => turn(prior, requestId, { end: false }) });
  const client = clientFor(host);
  const result = await client.run({ workspace, prompt: 'task', signal: controller.signal,
    onEvent: event => { if (event.event_type === 'turn/start') controller.abort(); } });
  assert.equal(result.error, 'NATIVE_DSH_CANCEL_NOT_CONFIRMED');
  assert.equal(result.busy, true);
  assert.equal(result.stop_confirmed, false);
  assert.equal((await client.close()).stop_confirmed, false);
});

test('an abort before dispatch creates no session or prompt', async () => {
  const host = mockHost();
  const result = await clientFor(host).run({ workspace, prompt: 'task', signal: AbortSignal.abort() });
  assert.equal(result.error, 'NATIVE_DSH_CANCELLED');
  assert.equal(host.calls.length, 0);
});

test('unobserved accepted prompt times out uncertain rather than returning old idle', async () => {
  const host = mockHost({ states: () => ({ events: prior, queued: [] }) });
  const result = await clientFor(host, { startTimeoutMs: 8 }).run({ workspace, prompt: 'task' });
  assert.equal(result.error, 'NATIVE_DSH_PROMPT_NOT_OBSERVED');
  assert.equal(result.busy, true);
  assert.equal(result.reply, '');
});

test('pending permission is visible, remains active, and never auto-approves or leaks command details', async () => {
  let resolveApproval;
  const waiting = new Promise(resolve => { resolveApproval = resolve; });
  let answered = false, settled = false;
  const host = mockHost({ states: ({ requestId }) => {
    const state = turn(prior, requestId, { end: false });
    state.events.push(e(state.events.length, 'approval/asked', { id: 'approval-123', toolName: 'pwsh',
      callId: 'call-123', reason: 'run command with secret-token-DO-NOT-EXPOSE' }));
    if (answered) {
      state.events.push(e(state.events.length, 'approval/decided', { id: 'approval-123', outcome: 'allowed-once' }));
      state.events.push(e(state.events.length, 'turn/end', { turn: 2, reason: { kind: 'completed' } }));
    }
    return state;
  } });
  const observed = [];
  const operation = clientFor(host).run({ workspace, prompt: 'task', onEvent: event => {
    observed.push(event);
    if (event.type === 'approval_requested') resolveApproval();
  } }).then(result => { settled = true; return result; });
  await waiting;
  assert.equal(settled, false);
  const approval = observed.find(event => event.type === 'approval_requested');
  assert.equal(approval.approval_id, 'approval-123');
  assert.equal(approval.tool_name, 'pwsh');
  assert.match(approval.stage, /等待用户授权/);
  assert.ok(!JSON.stringify(observed).includes('secret-token'));
  assert.ok(!host.calls.some(call => /approval|\$events|selectModel|permission/.test(call.method)));
  answered = true; // Simulated explicit answer arriving from the native UI.
  const result = await operation;
  assert.equal(result.error, null);
  assert.ok(observed.some(event => event.type === 'approval_resolved'));
  assert.equal(result.pending_approvals, undefined);
});

test('progress contains public text and safe tool summaries, never reasoning or command arguments', async () => {
  const host = mockHost({ states: ({ requestId }) => {
    const state = turn(prior, requestId, { end: false });
    const add = (type, data) => state.events.push(e(state.events.length, type, data));
    add('assistant/message', { turn: 2, message: { content: [
      { type: 'thinking', text: 'PRIVATE_THINKING_DO_NOT_EXPORT' },
      { type: 'reasoning', text: 'PRIVATE_REASONING_DO_NOT_EXPORT' },
      { type: 'text', text: '准备验证页面。Bearer helper-secret-value\nws://127.0.0.1:9999/devtools/browser/cdp-secret\nAPI_KEY=key-secret-value' },
    ] } });
    add('tool/call', { turn: 2, name: 'pwsh', callId: 'call-private', arguments: '{"command":"never-export-command-arguments"}' });
    add('tool/result', { turn: 2, message: { toolCallId: 'call-private', isError: true,
      content: [{ type: 'text', text: 'Error: request rejected Bearer response-secret-value' }] } });
    add('tool/call', { turn: 2, name: 'read', callId: 'call-read', arguments: '{"path":"private-file"}' });
    add('tool/result', { turn: 2, message: { toolCallId: 'call-read', isError: false,
      content: [{ type: 'text', text: 'successful output contains secret-do-not-copy' }] } });
    add('turn/end', { turn: 2, reason: { kind: 'completed' } });
    return state;
  } });
  const seen = [];
  await clientFor(host).run({ workspace, prompt: 'task', onEvent: event => seen.push(event) });
  const serialized = JSON.stringify(seen);
  for (const secret of ['PRIVATE_THINKING', 'PRIVATE_REASONING', 'helper-secret-value', 'cdp-secret', 'key-secret-value',
    'never-export-command-arguments', 'response-secret-value', 'secret-do-not-copy']) assert.ok(!serialized.includes(secret), secret);
  const progress = seen.filter(event => event.type === 'event');
  assert.ok(progress.every(event => event.at && Number.isInteger(event.seq) && event.summary));
  assert.ok(progress.some(event => event.event_type === 'assistant/message' && event.summary.includes('准备验证页面')));
  const failure = progress.find(event => event.is_error);
  assert.equal(failure.tool_name, 'pwsh');
  assert.equal(failure.error_code, 'TOOL_ERROR');
  assert.ok(failure.summary.includes('[已隐藏]'));
});

test('actual request model and latest permissions are returned and emitted even when initial projections are empty', async () => {
  const host = mockHost({ modelSelection: { lastUsed: null, next: null }, permissions: {}, states: ({ requestId }) => {
    const state = turn(prior, requestId, { end: false });
    const add = (type, data) => state.events.push(e(state.events.length, type, data));
    add('request/header', { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' } } });
    add('permission/preset', { preset: 'workspace-write' });
    add('sandbox/mode', { mode: 'workspace-write' });
    add('approval/policy', { policy: 'ask' });
    add('tool/call', { turn: 2, name: 'pwsh', callId: 'acl-call', arguments: 'secret arguments' });
    add('tool/result', { turn: 2, message: { toolCallId: 'acl-call', isError: true,
      content: [{ type: 'text', text: 'Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:/workspace)' }] } });
    add('turn/end', { turn: 2, reason: { kind: 'error' } });
    return { ...state, permissions: { currentValue: 'workspace-write' } };
  } });
  const seen = [];
  const result = await clientFor(host).run({ workspace, prompt: 'task', onEvent: event => seen.push(event) });
  assert.deepEqual(result.selected_model, { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' });
  assert.deepEqual(result.permissions, { currentValue: 'workspace-write', preset: 'workspace-write', sandbox_mode: 'workspace-write', approval_policy: 'ask' });
  assert.ok(seen.some(event => event.type === 'session_metadata' && event.selected_model?.model === 'deepseek-flash'));
  assert.ok(seen.some(event => event.error_code === 'WINDOWS_SANDBOX_WORKSPACE_GRANT_DENIED'));
  assert.ok(!host.calls.some(call => /selectModel|permission/.test(call.method)));
});

test('pwsh final nonzero exit footer counts as a failure without treating body examples or read contents as process exits', async () => {
  const samples = [
    { tool: 'pwsh', text: '--- scoped ---\r\n[exit code: 1]', isError: false, expected: true, code: 1 },
    { tool: 'pwsh', text: '[stderr]\nError: Inspected target navigated or closed\nNode.js v22.19.0\r\n[exit code: 1]', isError: false, expected: true, code: 1 },
    { tool: 'pwsh', text: 'sample: [exit code: 1]\nfinished', isError: false, expected: false },
    { tool: 'pwsh', text: '```text\n[exit code: 1]\n```', isError: false, expected: false },
    { tool: 'read', text: 'a file documents\n[exit code: 1]', isError: false, expected: false },
    { tool: 'pwsh', text: 'finished\n[exit code: 0]', isError: false, expected: false, code: 0 },
    { tool: 'pwsh', text: 'explicit tool failure\n[exit code: 0]', isError: true, expected: true, code: 0 },
  ];
  const host = mockHost({ states: ({ requestId }) => {
    const state = turn(prior, requestId, { end: false });
    const add = (type, data) => state.events.push(e(state.events.length, type, data));
    for (const [index, sample] of samples.entries()) {
      add('tool/call', { turn: 2, name: sample.tool, callId: `sample-${index}`, arguments: '{}' });
      add('tool/result', { turn: 2, message: { toolCallId: `sample-${index}`, isError: sample.isError,
        content: [{ type: 'text', text: sample.text }] } });
    }
    add('turn/end', { turn: 2, reason: { kind: 'completed' } });
    return state;
  } });
  const seen = [];
  await clientFor(host).run({ workspace, prompt: 'task', onEvent: event => seen.push(event) });
  const outputs = seen.filter(event => event.event_type === 'tool/result');
  assert.equal(outputs.length, samples.length);
  for (const [index, sample] of samples.entries()) {
    assert.equal(outputs[index].is_error, sample.expected, `sample ${index}`);
    assert.equal(outputs[index].exit_code, sample.code, `sample ${index}`);
  }
  assert.equal(outputs[0].error_code, 'PROCESS_EXIT_NONZERO');
  assert.match(outputs[0].summary, /退出码 1/);
});
