import { fileURLToPath } from 'node:url';

export const BROWSER_BRIDGE_PATCH_PATH = fileURLToPath(new URL('./browser-bridge.patch.yml', import.meta.url));
export const name = 'workbench-native-browser-bridge';
export const inject = ['webServer'];

// This function is serialized into the owned Host's HTML. Keep it self-contained.
export async function openExistingSessionInBrowser() {
  const entrySelector = 'script[data-workbench-native-entry="1"]';
  const selectionKey = 'dsh.sessions.current';
  const validId = value => typeof value === 'string' && /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const domReady = () => document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  let stage = 'INVALID_SESSION_LINK';
  try {
    const fragment = location.hash;
    let sessionId;
    if (fragment) {
      const match = /^#workbench-session=(session-[0-9a-f-]+)$/i.exec(fragment);
      if (!match || !validId(match[1])) throw new Error(stage);
      sessionId = match[1];
    } else {
      stage = 'SESSION_SELECTION_UNAVAILABLE';
      sessionId = JSON.parse(localStorage.getItem(selectionKey) || 'null')?.sessionId;
      if (!validId(sessionId)) throw new Error(stage);
    }

    // Reading projections neither creates/adopts a Session nor activates an Agent.
    // Reject blank Sessions too: the native workspace otherwise creates a fallback.
    stage = 'SESSION_LOOKUP_FAILED';
    const rpcId = crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let response, envelope;
    try {
      response = await fetch('/api/session/projections', {
        method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method: 'session/projections',
          payload: { args: { request: { sessionId } } } })
      });
      if (!response.ok) throw new Error(stage);
      envelope = await response.json();
    } finally { clearTimeout(timer); }
    if (envelope?.type !== 'server-response' || envelope.rpcId !== rpcId || envelope.result?.ok !== true) throw new Error(stage);
    stage = 'SESSION_NOT_AVAILABLE';
    if (!envelope.result.value || envelope.result.value.values?.sessionListMetadata?.blank !== false) throw new Error(stage);

    stage = 'SESSION_SELECTION_UNAVAILABLE';
    const selection = JSON.stringify({ sessionId });
    localStorage.setItem(selectionKey, selection);
    if (localStorage.getItem(selectionKey) !== selection) throw new Error(stage);
    // Remove the bridge fragment before the native client begins; never log it.
    history.replaceState(history.state, '', location.pathname + location.search);
    await domReady();
    const entries = [...document.querySelectorAll(entrySelector)];
    if (!entries.length) { stage = 'NATIVE_APP_ENTRY_MISSING'; throw new Error(stage); }
    for (const original of entries) {
      const script = document.createElement('script');
      for (const attribute of original.attributes) {
        if (attribute.name !== 'type' && attribute.name !== 'data-workbench-native-entry') script.setAttribute(attribute.name, attribute.value);
      }
      script.type = 'module';
      script.async = false;
      script.textContent = original.textContent;
      original.replaceWith(script);
    }
    return { status: 'opened', session_id: sessionId };
  } catch {
    // A thrown head script alone would still let later modules boot. The entries
    // remain inert on every failure, so native restoreSelection cannot create.
    await domReady();
    const message = document.createElement('main');
    message.setAttribute('role', 'alert');
    message.style.cssText = 'max-width:48rem;margin:12vh auto;padding:2rem;font:16px/1.7 system-ui;color:#253443';
    message.textContent = `无法打开指定的 dsh 会话（${stage}）。请回到工作台重新点击“在 dsh 中打开此会话”。未启动原生界面，也未新建会话。`;
    document.body.replaceChildren(message);
    return { status: 'blocked', error: stage };
  }
}

/** Gate the installed native app entry until selection and read-only lookup pass. */
export function renderBrowserBridgeIndex(html) {
  if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error('NATIVE_DSH_BRIDGE_HEAD_MISSING');
  let count = 0;
  const gated = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (full, attributes, body) => {
    const moduleType = /\btype\s*=\s*(["'])module\1/i;
    if (!moduleType.test(attributes)) return full;
    count++;
    return `<script${attributes.replace(moduleType, 'type="application/x-workbench-dsh-module"')} data-workbench-native-entry="1">${body}</script>`;
  });
  if (!count) throw new Error('NATIVE_DSH_BRIDGE_APP_ENTRY_MISSING');
  const boot = `<script data-workbench-native-bridge="1">globalThis.__WORKBENCH_DSH_BRIDGE_READY__=(${openExistingSessionInBrowser.toString()})();</script>`;
  return gated.replace(/<head(?:\s[^>]*)?>/i, open => `${open}${boot}`);
}

/** Official Cordis plugin, installed only through the owned Host's extra patch. */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.tapIndex(renderBrowserBridgeIndex));
}
