import { targetBlockedIconDependency, targetBlockedRequestFacts, targetNetworkBlockPatterns, targetPassiveDataImageAllowed, targetRequestAllowed } from '../project-target-access.mjs';

/** Browser-level CDP guard shared by Playwright and external CDP clients. */
export async function attachTargetNetworkGuard(endpoint, policy, onViolation = () => {}, { onBlockedDependency = () => {} } = {}) {
  if (typeof WebSocket !== 'function') throw Error('CDP_WEBSOCKET_UNAVAILABLE');
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(Error('CDP_CONNECT_TIMEOUT')); }, 5000);
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('open', () => clearTimeout(timer), { once: true });
    socket.addEventListener('error', event => { clearTimeout(timer); reject(event.error || Error('CDP_CONNECT_FAILED')); }, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const guardedSessions = new Set();
  let closed = false;
  let firstViolation = null;
  const diagnostics = { attachedSessions: 0, interceptedRequests: 0, blockedRequests: 0, guardInstallFailures: 0 };
  const blockedDependencies = new Map();
  const dependencyBlocked = (request, resourceType) => {
    if (!targetBlockedIconDependency(request?.url, resourceType, request?.method)) return false;
    const facts = { code: 'ICON_DEPENDENCY_BLOCKED', ...targetBlockedRequestFacts(request.url, resourceType), resource_type: String(resourceType).toLowerCase() };
    const key = `${facts.origin}${facts.path}`;
    if (!blockedDependencies.has(key) && blockedDependencies.size < 50) {
      blockedDependencies.set(key, facts);
      try { onBlockedDependency(facts); } catch {}
    }
    return true;
  };
  const report = (value, fatal = false) => {
    if (!firstViolation) firstViolation = value;
    try { onViolation(value, { fatal }); } catch {}
  };
  const networkPatterns = targetNetworkBlockPatterns(policy);
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP_TIMEOUT:${method}`)); }, 8000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const failPending = error => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
  };
  const guardSession = async sessionId => {
    if (!sessionId || guardedSessions.has(sessionId)) return;
    guardedSessions.add(sessionId);
    try {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId);
      await send('Network.enable', {}, sessionId);
      // Network-level rules survive another CDP client's Fetch.disable; WebSockets remain unsupported.
      await send('Network.setBlockedURLs', { urlPatterns: networkPatterns }, sessionId);
    } catch (error) {
      guardedSessions.delete(sessionId);
      if (error?.message?.includes("wasn't found") || error?.message?.includes('No session')) throw error;
      throw Error(`CDP_NETWORK_GUARD_INSTALL_FAILED:${error.message}`);
    }
  };
  const onMessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.id) {
      const wait = pending.get(message.id);
      if (!wait) return;
      pending.delete(message.id); clearTimeout(wait.timer);
      if (message.error) wait.reject(Error(message.error.message || 'CDP_COMMAND_FAILED'));
      else wait.resolve(message.result || {});
      return;
    }
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request, resourceType } = message.params || {};
      const sessionId = message.sessionId;
      const isWebSocket = /^wss?:/i.test(request?.url || '');
      const allowed = !isWebSocket && (targetRequestAllowed(policy, request?.url || '') ||
        targetPassiveDataImageAllowed(request?.url, resourceType));
      diagnostics.interceptedRequests++;
      if (!allowed) diagnostics.blockedRequests++;
      const command = allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest';
      const params = allowed ? { requestId } : { requestId, errorReason: 'BlockedByClient' };
      if (!allowed && !dependencyBlocked(request, resourceType) && !firstViolation) {
        report({ code: isWebSocket ? 'TARGET_WEBSOCKET_BLOCKED' : 'TARGET_SCOPE_REQUEST_BLOCKED',
          ...targetBlockedRequestFacts(request?.url || '', resourceType, isWebSocket ? 'websocket' : 'http') });
      }
      send(command, params, sessionId).catch(() => {});
      return;
    }
    if (message.method === 'Network.webSocketCreated' || message.method === 'Network.webSocketWillSendHandshakeRequest') {
      const url = message.params?.url || message.params?.request?.url;
      if (/^wss?:/i.test(url || '') && !firstViolation) {
        report({ code: 'TARGET_WEBSOCKET_BLOCKED', ...targetBlockedRequestFacts(url, 'websocket', 'websocket') });
      }
      return;
    }
    if (message.method === 'Network.requestWillBeSent') {
      const requestUrl = message.params?.request?.url;
      if (requestUrl && !targetRequestAllowed(policy, requestUrl) &&
          !targetPassiveDataImageAllowed(requestUrl, message.params?.type) &&
          !dependencyBlocked(message.params.request, message.params?.type) && !firstViolation) {
        report({ code: 'TARGET_SCOPE_REQUEST_BLOCKED',
          ...targetBlockedRequestFacts(requestUrl, message.params?.type) });
      }
      return;
    }
    if (message.method === 'Target.attachedToTarget') {
      const { sessionId, waitingForDebugger } = message.params || {};
      diagnostics.attachedSessions++;
      guardSession(sessionId).then(() => waitingForDebugger ? send('Runtime.runIfWaitingForDebugger', {}, sessionId) : null)
        .catch(error => {
          diagnostics.guardInstallFailures++;
          report({ code: 'TARGET_GUARD_INSTALL_FAILED', reason: String(error?.message || error) }, true);
          // Keep this target frozen. The task controller will abort and close the managed browser.
        });
    }
  };
  socket.addEventListener('message', onMessage);
  socket.addEventListener('close', () => {
    const unexpected = !closed;
    closed = true;
    failPending(Error('CDP_CONNECTION_CLOSED'));
    if (unexpected) report({ code: 'TARGET_GUARD_CONNECTION_LOST' }, true);
  });
  socket.addEventListener('error', () => {
    failPending(Error('CDP_CONNECTION_ERROR'));
    if (!closed) report({ code: 'TARGET_GUARD_CONNECTION_LOST' }, true);
  });
  try {
    await send('Target.setDiscoverTargets', { discover: true });
    await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    const { targetInfos = [] } = await send('Target.getTargets');
    for (const target of targetInfos.filter(item => item.type === 'page')) {
      const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      await guardSession(attached.sessionId);
    }
  } catch (error) {
    socket.close();
    throw error;
  }
  return {
    violation: () => firstViolation,
    diagnostics: () => ({ ...diagnostics, blockedDependencies: [...blockedDependencies.values()] }),
    close: async () => {
      if (closed) return;
      closed = true;
      failPending(Error('CDP_GUARD_CLOSED'));
      await new Promise(resolve => { socket.addEventListener('close', resolve, { once: true }); socket.close(); setTimeout(resolve, 1000); });
    }
  };
}
