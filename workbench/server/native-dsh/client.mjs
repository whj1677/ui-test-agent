import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {diagnostics,browserDiagnosticLines} from '../diagnostics.mjs';

const fail = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const validSession = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const textContent = message => (message?.content || []).filter(block => block?.type === 'text').map(block => block.text || '').join('\n');
const safeLabel = value => typeof value === 'string' && /^[A-Za-z0-9_./:-]{1,100}$/.test(value) ? value : null;
const eventTime = value => Number.isFinite(value) && value >= 0 ? new Date(value).toISOString() : null;
const selectedModel = value => object(value) && safeLabel(value.provider) && safeLabel(value.model)
  ? { provider: value.provider, model: value.model,
    ...(safeLabel(String(value.reasoningEffort || '')) ? { reasoningEffort: String(value.reasoningEffort) } : {}) } : null;
function safeProgress(value) {
  return String(value || '').replace(/```[\s\S]*?(?:```|$)/g, '').replace(/`[^`]*`/g, '')
    .replace(/\bBearer\s+[^\s"'<>\\]+/gi, 'Bearer [已隐藏]')
    .replace(/\b(?:sk|sk-ant|ds)[-_][A-Za-z0-9_-]{8,}/g, '[密钥已隐藏]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g, '[凭据已隐藏]')
    .replace(/wss?:\/\/[^\s"'<>]+/gi, '[浏览器连接地址已隐藏]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, value => {
      try { const url = new URL(value); return /\/devtools\//i.test(url.pathname) ? '[浏览器连接地址已隐藏]' : `${url.origin}${url.pathname}`; }
      catch { return '[地址已隐藏]'; }
    })
    .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|cookie|set-cookie)\b["']?\s*[:=]\s*[^\r\n]*/gi, '[凭据字段已隐藏]')
    .replace(/[A-Za-z0-9_+/=-]{24,}/g, '[长标识已隐藏]')
    .replace(/[\r\n\t ]+/g, ' ').trim().slice(0, 180);
}
function toolResultProgress(message, toolName) {
  const content = textContent(message);
  // The native pwsh tool reports process failure in a final footer while
  // message.isError remains false. Match only its standalone terminal footer,
  // never a code example in the body or another tool's returned file content.
  const footer = toolName === 'pwsh' ? content.match(/(?:^|\r?\n)\[exit code: (-?\d+)\][\r\n\t ]*$/) : null;
  const exitCode = footer && Number.isSafeInteger(Number(footer[1])) ? Number(footer[1]) : null;
  const exitInfo = exitCode === null ? {} : { exit_code: exitCode };
  if (!message?.isError && (exitCode === null || exitCode === 0)) return { is_error: false, ...exitInfo, summary: '工具操作已完成' };
  const known = [
    [/SetNamedSecurityInfoW failed \(Win32 5\): grantWrite/i, 'WINDOWS_SANDBOX_WORKSPACE_GRANT_DENIED', 'Windows 沙箱无法授予工作区写入权限'],
    [/\bEACCES\b|permission denied|access denied/i, 'ACCESS_DENIED', '工具操作被权限限制阻止'],
    [/\bENOENT\b|cannot find|not found/i, 'NOT_FOUND', '工具所需文件或对象未找到'],
    [/\bECONNREFUSED\b|\bENOTFOUND\b/i, 'CONNECTION_FAILED', '工具连接目标失败'],
    [/TimeoutError|timed? ?out|timeout/i, 'TIMEOUT', '工具操作超时'],
  ].find(([pattern]) => pattern.test(content));
  if (known) return { is_error: true, ...exitInfo, error_code: known[1], summary: known[2] };
  const firstLine = content.split(/\r?\n/).find(line => line.trim()) || '';
  // Error wrappers sometimes echo a complete command. Such text stays in the
  // native session; the workbench receives only a generic failure summary.
  const summary = /command|arguments|\b(?:curl|pwsh|powershell|cmd|node|npm|python)\b|<content>|[{};]/i.test(firstLine)
    ? '工具执行失败，详情保留于原生会话' : safeProgress(firstLine);
  return { is_error: true, ...exitInfo, error_code: exitCode ? 'PROCESS_EXIT_NONZERO' : 'TOOL_ERROR',
    summary: exitCode ? `终端命令执行失败，退出码 ${exitCode}` : summary || '工具执行失败' };
}
function approvalSummary(data) {
  const tool = safeLabel(data?.toolName) || 'tool';
  return { approval_id: safeLabel(data?.id), tool_name: tool,
    purpose: /pwsh|bash|shell|terminal/i.test(tool) ? '执行终端操作'
      : /write|edit|patch|file|fs/i.test(tool) ? '执行文件操作'
        : /browser|playwright/i.test(tool) ? '操作测试浏览器' : '执行工具操作' };
}

function endpoint(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { throw fail('NATIVE_DSH_URL_INVALID'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.hash || url.pathname !== '/' ||
      [...url.searchParams.keys()].some(key => key !== 'token') || url.searchParams.getAll('token').length > 1) {
    throw fail('NATIVE_DSH_URL_INVALID');
  }
  return { origin: url.origin, launchUrl: url.searchParams.has('token') ? url.href : null };
}

function delay(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

function latestTurn(events) {
  return [...events].reverse().find(event => event.type === 'turn/start' || event.type === 'turn/end');
}

function pending(projections) {
  const inbox = projections?.values?.inbox;
  if (!object(inbox) || !Array.isArray(inbox['next-turn']) || !Array.isArray(inbox['next-step'])) throw fail('NATIVE_DSH_STATE_UNAVAILABLE');
  return [...inbox['next-turn'], ...inbox['next-step']];
}

function numericUsage(events) {
  const total = {};
  for (const event of events) {
    if (event.type !== 'assistant/message' || !object(event.data?.usage)) continue;
    for (const [name, value] of Object.entries(event.data.usage)) {
      if (Number.isFinite(value) && value >= 0) total[name] = (total[name] || 0) + value;
    }
  }
  return Object.keys(total).length ? total : null;
}

/** A thin client for dsh Web 0.2's public Remote protocol. It never starts or stops its Host. */
export function createNativeDshClient({ baseUrl, resolveBaseUrl, fetchImpl = globalThis.fetch, pollIntervalMs = 1000,
  requestTimeoutMs = 10000, cancelTimeoutMs = 30000, startTimeoutMs = 30000 } = {}) {
  let address = endpoint(baseUrl), resolving, runtimeVersion;
  let browserLaunchUrl = address?.launchUrl || null;
  const identity = () => ({ engine: 'dsh-web-native', host: address?.origin || null, protocol: 'remote-v2', tool_exit_code_tracking: true,
    ...(runtimeVersion ? { version: runtimeVersion } : {}) });
  const active = new Map(), uncertain = new Set();
  let closed = false, cookie = '', authentication;

  async function request(url, init = {}) {
    try {
      return await fetchImpl(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(requestTimeoutMs) });
    } catch(error) {await diagnostics.record('dsh','request.failed',{error},'error');throw fail('NATIVE_DSH_CONNECTION_FAILED'); }
  }

  async function authenticate() {
    if (!address && typeof resolveBaseUrl === 'function') {
      resolving ||= Promise.resolve().then(resolveBaseUrl).then(value => {
        if (typeof value?.version === 'string' && /^[\w.+-]{1,80}$/.test(value.version)) runtimeVersion = value.version;
        const next = endpoint(typeof value === 'string' ? value : value?.url);
        browserLaunchUrl = next?.launchUrl || null;
        return next;
      });
      try { address = await resolving; } catch(error) {await diagnostics.record('dsh','host.start.failed',{error},'error');resolving = null;throw fail('NATIVE_DSH_RUNTIME_UNAVAILABLE'); }
    }
    if (!address) throw fail('NATIVE_DSH_NOT_CONFIGURED');
    if (!address.launchUrl || cookie) return;
    authentication ||= (async () => {
      const response = await request(address.launchUrl);
      if (response.status !== 303 || response.headers.get('location') !== './') throw fail('NATIVE_DSH_AUTH_REQUIRED');
      const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
      cookie = values.map(value => value.split(';', 1)[0]).filter(value => /^dsh[\w-]*=[A-Za-z0-9_.-]+$/.test(value)).join('; ');
      if (!cookie) throw fail('NATIVE_DSH_AUTH_REQUIRED');
      // Launch tokens are one-time transport inputs, never part of identity, logs, or returned errors.
      address.launchUrl = null;
    })();
    await authentication;
  }

  async function rpc(method, value, { args = value === undefined ? {} : { request: value }, rpcId = randomUUID() } = {}) {
    await authenticate();
    const response = await request(`${address.origin}/api/${method}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }) });
    if (response.status === 401 || response.status === 403) throw fail('NATIVE_DSH_AUTH_REQUIRED');
    if (response.status === 404) throw fail('NATIVE_DSH_PROTOCOL_UNSUPPORTED');
    if (!response.ok) throw fail('NATIVE_DSH_CONNECTION_FAILED');
    let data;
    try { data = await response.json(); } catch { throw fail('NATIVE_DSH_RESPONSE_INVALID'); }
    if (data?.type !== 'server-response' || data.rpcId !== rpcId || typeof data.result?.ok !== 'boolean') throw fail('NATIVE_DSH_RESPONSE_INVALID');
    if (!data.result.ok) {
      const remoteCode = typeof data.result.error?.code === 'string' ? data.result.error.code : '';
      const code = /(?:agent-busy|writer-held)$/.test(remoteCode) ? 'NATIVE_DSH_SESSION_BUSY'
        : /(?:conflict)$/.test(remoteCode) ? 'NATIVE_DSH_SESSION_CONFLICT' : 'NATIVE_DSH_REMOTE_ERROR';
      throw fail(code, { remote_code: remoteCode.replace(/[^A-Za-z0-9_/-]/g, '').slice(0, 100) });
    }
    return data.result.value;
  }

  async function snapshot(sessionId, after = -1) {
    const projections = await rpc('session/projections', { sessionId });
    if (!object(projections) || !Number.isInteger(projections.asOfSeq) || projections.asOfSeq < -1) throw fail('NATIVE_DSH_STATE_UNAVAILABLE');
    const queued = pending(projections), cursor = projections.asOfSeq;
    if (cursor < after) throw fail('NATIVE_DSH_HISTORY_REWOUND');
    if (cursor === after) return { cursor, events: [], queued, projections };
    const collected = new Map();
    let beforeSeq;
    while (true) {
      const page = await rpc('session/page', { address: { kind: 'session', sessionId }, throughSeq: cursor,
        maxMessages: 100, ...(beforeSeq === undefined ? {} : { beforeSeq }) });
      if (!Array.isArray(page?.records) || typeof page.hasMore !== 'boolean') throw fail('NATIVE_DSH_RESPONSE_INVALID');
      const events = page.records.map(record => record?.type === 'event' ? record.event : null);
      if (events.some(event => !object(event) || !Number.isInteger(event.seq) || event.seq < 0 || event.seq > cursor || typeof event.type !== 'string')) throw fail('NATIVE_DSH_RESPONSE_INVALID');
      for (const event of events) if (event.seq > after) collected.set(event.seq, event);
      const minimum = events.length ? Math.min(...events.map(event => event.seq)) : null;
      if (!page.hasMore || (minimum !== null && minimum <= after)) break;
      if (minimum === null || (beforeSeq !== undefined && minimum >= beforeSeq)) throw fail('NATIVE_DSH_HISTORY_STALLED');
      beforeSeq = minimum;
    }
    const events = [...collected.values()].sort((a, b) => a.seq - b.seq);
    if (cursor > after && events.at(-1)?.seq !== cursor) throw fail('NATIVE_DSH_HISTORY_INCOMPLETE');
    return { cursor, events, queued, projections };
  }

  const client = {
    get available() { return Boolean((address || typeof resolveBaseUrl === 'function') && !closed); },
    get identity() { return identity(); },
    async inspect() {
      if (closed) return { ...identity(), available: false, error: 'NATIVE_DSH_CLIENT_CLOSED' };
      try {
        const canOpenPath = await rpc('session/canOpenWorkspacePath');
        if (typeof canOpenPath !== 'boolean') throw fail('NATIVE_DSH_RESPONSE_INVALID');
        return { ...identity(), available: true, authenticated: true };
      } catch (error) { return { ...identity(), available: false, error: error.code || 'NATIVE_DSH_CONNECTION_FAILED' }; }
    },
    async openBrowserSession({ sessionId }) {
      if (closed) throw fail('NATIVE_DSH_CLIENT_CLOSED');
      if (!validSession(sessionId)) throw fail('NATIVE_DSH_SESSION_INVALID');
      // Read the stored session without create/adopt/prompt. A missing or blank
      // selection must not fall through to the native UI's new-session fallback.
      const existing = await snapshot(sessionId);
      if (!existing.events.some(event => event.type === 'user/message')) throw fail('NATIVE_DSH_SESSION_EMPTY');
      if (!browserLaunchUrl) throw fail('NATIVE_DSH_BROWSER_AUTH_UNAVAILABLE');
      const url = new URL(browserLaunchUrl);
      url.hash = `workbench-session=${encodeURIComponent(sessionId)}`;
      return { session_id: sessionId, url: url.href };
    },
    async run({ workspace, prompt, sessionId, signal, completionSignal, closeoutCheck, onEvent = async () => {} }) {
      if (closed) throw fail('NATIVE_DSH_CLIENT_CLOSED');
      if (!address && typeof resolveBaseUrl !== 'function') throw fail('NATIVE_DSH_NOT_CONFIGURED');
      if (typeof workspace !== 'string' || !path.isAbsolute(workspace) || typeof prompt !== 'string' || !prompt.trim() ||
          (sessionId !== undefined && sessionId !== null && !validSession(sessionId))) throw fail('NATIVE_DSH_INPUT_INVALID');
      const key = path.resolve(workspace).toLowerCase();
      if (active.has(key) || uncertain.has(key)) throw fail('NATIVE_DSH_SESSION_BUSY');
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
      const operation = { controller, done: null };
      active.set(key, operation);
      operation.done = (async () => {
        let id = sessionId || null, submitted = false, promptAccepted = false, baseline = -1, cursor = -1;
        let ownTurn, lastEvent, terminal, seenPrompt = false, queuedPrompt = false, model = null, permissions = null;
        const requestId = randomUUID(), events = [], approvals = new Map(), toolNames = new Map();
        const emit = async event => onEvent({ ...event, ...(id ? { session_id: id } : {}) });
        const result = (error = null, busy = false, stopped = !busy) => ({ session_id: id,
          reply: [...events].reverse().filter(event => event.type === 'assistant/message' && event.data?.turn === ownTurn)
            .map(event => textContent(event.data?.message)).find(Boolean) || '',
          usage: numericUsage(events.filter(event => event.data?.turn === ownTurn)), error, busy, stop_confirmed: stopped,
          selected_model: model, permissions,
          ...(approvals.size ? { pending_approvals: [...approvals.values()] } : {}) });
        const observeMetadata = event => {
          if (event.type === 'request/header') model = selectedModel(event.data?.header?.config) || model;
          if (event.type === 'permission/preset' && safeLabel(event.data?.preset)) permissions = { ...permissions, preset: event.data.preset };
          if (event.type === 'sandbox/mode' && safeLabel(event.data?.mode)) permissions = { ...permissions, sandbox_mode: event.data.mode };
          if (event.type === 'approval/policy' && safeLabel(event.data?.policy)) permissions = { ...permissions, approval_policy: event.data.policy };
        };
        const observeProjection = values => {
          model = selectedModel(values?.modelSelection?.lastUsed) || model;
          if (safeLabel(values?.permissions?.currentValue)) permissions = { ...permissions, currentValue: values.permissions.currentValue };
        };
        const observeApproval = async (event, announce = true) => {
          if (event.type === 'approval/asked') {
            const summary = approvalSummary(event.data);
            if (summary.approval_id) approvals.set(summary.approval_id, summary);
            if (announce) await emit({ type: 'approval_requested', ...summary, seq: event.seq, at: eventTime(event.time),
              stage: `等待用户授权：${summary.purpose}（请在原生 dsh 窗口处理）` });
          } else if (event.type === 'approval/decided') {
            const id = safeLabel(event.data?.id);
            if (id) approvals.delete(id);
            if (announce) await emit({ type: 'approval_resolved', approval_id: id, seq: event.seq, at: eventTime(event.time),
              outcome: ['allowed-once', 'rejected', 'cancelled', 'unavailable'].includes(event.data?.outcome) ? event.data.outcome : 'unknown',
              stage: approvals.size ? '仍有操作等待用户授权' : '授权请求已处理，原生 dsh 继续执行' });
          }
        };
        const consume = async state => {
          cursor = state.cursor;
          observeProjection(state.projections.values);
          for (const event of state.events) {
            events.push(event);
            observeMetadata(event);
            await observeApproval(event);
            if (event.type === 'turn/start' || event.type === 'turn/end') lastEvent = event;
            if (event.type === 'agent/inbox/spliced' && event.data?.inserted?.some(message => message?.source?.rpcId === requestId)) queuedPrompt = true;
            if (event.type === 'turn/start' && queuedPrompt && ownTurn === undefined) ownTurn = event.data?.turn;
            if (event.type === 'user/message' && event.data?.source?.rpcId === requestId) {
              seenPrompt = true;
              const start = [...events].reverse().find(item => item.seq < event.seq && item.type === 'turn/start');
              if (!start) throw fail('NATIVE_DSH_TURN_NOT_IDENTIFIED');
              ownTurn = start.data?.turn;
            }
            if (event.type === 'turn/end' && ownTurn !== undefined && event.data?.turn === ownTurn) terminal = event;
            if (['request/header', 'permission/preset', 'sandbox/mode', 'approval/policy'].includes(event.type)) {
              void diagnostics.record('dsh','session.metadata',{session_id:id,selected_model:model,permissions,seq:event.seq});
              await emit({ type: 'session_metadata', selected_model: model, permissions, seq: event.seq, at: eventTime(event.time) });
            }
            if (event.type === 'tool/call' && safeLabel(event.data?.name)) toolNames.set(event.data.callId, event.data.name);
            if (['turn/start', 'turn/end', 'tool/call', 'tool/result', 'assistant/message'].includes(event.type)) {
              const tool = event.type === 'tool/call' ? safeLabel(event.data?.name)
                : event.type === 'tool/result' ? toolNames.get(event.data?.message?.toolCallId) : null;
              const progress = event.type === 'tool/result' ? toolResultProgress(event.data?.message, tool)
                : event.type === 'tool/call' ? { summary: '正在执行工具操作' }
                  : event.type === 'assistant/message' ? { summary: safeProgress(textContent(event.data?.message)) }
                    : { summary: event.type === 'turn/start' ? '原生 dsh 开始编写与自测' : '原生 dsh 本轮执行结束' };
              if (event.type === 'assistant/message' && !progress.summary) continue;
              if(event.type==='assistant/message'){
                const claim=browserDiagnosticLines(textContent(event.data?.message));
                if(claim)void diagnostics.record('dsh','browser.model-statement',{session_id:id,seq:event.seq,verification:'MODEL_STATEMENT_ONLY',excerpt:claim});
              }
              if(event.type==='tool/call'||event.type==='tool/result'){
                const browser=event.type==='tool/result'&&tool==='pwsh'?browserDiagnosticLines(textContent(event.data?.message)):'';
                void diagnostics.record('dsh',event.type,{session_id:id,call_id:event.data?.callId||event.data?.message?.toolCallId,tool_name:tool,seq:event.seq,native_at:eventTime(event.time),...progress,
                  ...(progress.is_error?{error_excerpt:textContent(event.data?.message)}:{}),...(browser?{browser_diagnostic:browser}:{})},progress.is_error?'error':browser&&/error|failed|cannot|unable|denied|EPERM|EACCES|not found|does not exist|timeout|无法|失败|拒绝/i.test(browser)?'warn':'info');
              }
              if(['turn/start','turn/end'].includes(event.type))void diagnostics.record('dsh',event.type,{session_id:id,seq:event.seq,reason:event.data?.reason});
              await emit({ type: 'event', event_type: event.type, seq: event.seq, turn: event.data?.turn,
                at: eventTime(event.time), ...(tool ? { tool_name: tool } : {}), ...progress,
                ...(event.type === 'turn/start' ? { stage: '原生 dsh 正在编写与自测' } : {}) });
            }
          }
          return state;
        };
        const isIdle = state => (!lastEvent || lastEvent.type === 'turn/end') && state.queued.length === 0;
        const cancel = async (outcome = 'NATIVE_DSH_CANCELLED') => {
          await emit({ type: 'status', stage: outcome === null ? '执行和证据已保存，正在确认 DSH 结束' : '正在等待原生 dsh 停止确认' }).catch(() => {});
          let accepted = false;
          try { accepted = (await rpc('session/cancel', { sessionId: id }))?.accepted === true; } catch { /* Confirm from the log even if the receipt was lost. */ }
          const until = Date.now() + cancelTimeoutMs;
          do {
            try {
              const state = await consume(await snapshot(id, cursor));
              // Acknowledgement is insufficient: cancel retains queued inbox entries.
              if (isIdle(state) && (((seenPrompt || queuedPrompt) && terminal) || (accepted && !submitted))) return result(outcome);
            } catch { /* Keep waiting within the stop-confirmation window. */ }
            await delay(pollIntervalMs);
          } while (Date.now() < until);
          uncertain.add(key);
          return result('NATIVE_DSH_CANCEL_NOT_CONFIRMED', true, false);
        };
        try {
          if (controller.signal.aborted) return result('NATIVE_DSH_CANCELLED');
          const adopted = await rpc('session/create', { cwd: workspace, ...(id ? { sessionId: id } : {}) });
          if (!validSession(adopted?.sessionId) || (id && id !== adopted.sessionId)) throw fail('NATIVE_DSH_RESPONSE_INVALID');
          id = adopted.sessionId;
          await emit({ type: 'session_id' });
          const initial = await snapshot(id);
          baseline = cursor = initial.cursor;
          lastEvent = latestTurn(initial.events);
          for (const event of initial.events) { observeMetadata(event); await observeApproval(event, false); }
          observeProjection(initial.projections.values);
          if (!isIdle(initial)) return result('NATIVE_DSH_SESSION_BUSY', true, false);
          await emit({ type: 'session_ready', model: initial.projections.values.modelSelection || null,
            selected_model: model, permissions });
          if (controller.signal.aborted) return result('NATIVE_DSH_CANCELLED');
          // Mark the send before awaiting it. A lost HTTP reply must never cause a duplicate prompt.
          submitted = true;
          try {
            const response = await rpc('session/prompt', { sessionId: id, requestId, mode: 'queue',
              content: [{ type: 'text', text: prompt }], clientTimeZone: 'Asia/Shanghai' });
            if (response?.accepted !== true) throw fail('NATIVE_DSH_RESPONSE_INVALID');
            promptAccepted = true;
          } catch (error) {
            // Explicit remote rejection proves no admission; transport failures remain ambiguous.
            if (error.remote_code) submitted = false;
            throw error;
          }
          const admittedAt = Date.now();
          while (true) {
            if (controller.signal.aborted) return await cancel();
            if (completionSignal?.aborted) return await cancel(null);
            const closeoutError = closeoutCheck?.();
            if (closeoutError) return await cancel(closeoutError);
            const state = await consume(await snapshot(id, cursor));
            if (terminal && (seenPrompt || queuedPrompt) && terminal.seq > baseline && isIdle(state)) {
              const kind = terminal.data?.reason?.kind;
              return result(kind === 'completed' && seenPrompt ? null : kind === 'aborted' || kind === 'interrupted' ? 'NATIVE_DSH_INTERRUPTED' : 'NATIVE_DSH_TURN_FAILED');
            }
            const queuedOwn = state.queued.some(message => message?.source?.rpcId === requestId);
            if (!seenPrompt && !queuedOwn && Date.now() - admittedAt > startTimeoutMs) {
              uncertain.add(key);
              return result('NATIVE_DSH_PROMPT_NOT_OBSERVED', true, false);
            }
            await delay(pollIntervalMs, controller.signal);
          }
        } catch (error) {
          await diagnostics.record('dsh','transport.failed',{session_id:id,error},'error');
          if (submitted && controller.signal.aborted) return await cancel();
          const busy = submitted || error.code === 'NATIVE_DSH_SESSION_BUSY';
          if (busy) uncertain.add(key);
          return { ...result(error.code || 'NATIVE_DSH_CLIENT_FAILED', busy, !busy), prompt_accepted: promptAccepted,
            ...(error.remote_code ? { remote_code: error.remote_code } : {}) };
        } finally { signal?.removeEventListener('abort', abort); }
      })();
      try { return await operation.done; } finally { active.delete(key); }
    },
    async close() {
      closed = true;
      for (const operation of active.values()) operation.controller.abort();
      const results = await Promise.allSettled([...active.values()].map(operation => operation.done));
      cookie = '';
      return { closed: true, stop_confirmed: uncertain.size === 0 && results.every(result => result.status === 'fulfilled' && !result.value.busy) };
    },
  };
  return client;
}
