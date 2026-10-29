import net from 'node:net';
import { chromium } from 'playwright';
import { targetBlockedIconDependency, targetBlockedRequestFacts, targetPassiveDataImageAllowed, targetRequestAllowed } from '../project-target-access.mjs';
import { attachTargetNetworkGuard } from './cdp-network-guard.mjs';
import { sessionTerminationRequest } from '../auth/session-request-policy.mjs';

async function freeLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function startProjectTargetBrowser(target, browserExecutable, onViolation = () => {}, options = {}) {
  if (!browserExecutable) throw Error('PROJECT_TARGET_BROWSER_REQUIRED');
  const port = await freeLoopbackPort();
  const browser = await chromium.launch({ headless: options.headless ?? true, executablePath: browserExecutable,
    args: ['--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`] });
  let cdpGuard;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block',
      ...(options.storageState ? { storageState: options.storageState } : {}) });
    let violation = null;
    await context.route('**/*', route => {
      const url = route.request().url();
      if (options.sessionTerminationEndpoints?.length && sessionTerminationRequest(url, route.request().method(),
        target.origin, options.sessionTerminationEndpoints)) return route.abort('blockedbyclient');
      if (targetRequestAllowed(target, url) || targetPassiveDataImageAllowed(url, route.request().resourceType())) return route.continue();
      if (!violation && !targetBlockedIconDependency(url, route.request().resourceType(), route.request().method())) {
        violation = { code: 'TARGET_SCOPE_REQUEST_BLOCKED', ...targetBlockedRequestFacts(url, route.request().resourceType()) };
        try { onViolation(violation); } catch {}
      }
      return route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', async route => {
      let url;
      try { url = route.url(); } catch { url = ''; }
      if (!violation) {
        violation = { code: 'TARGET_WEBSOCKET_BLOCKED', ...targetBlockedRequestFacts(url, 'websocket', 'websocket') };
        try { onViolation(violation); } catch {}
      }
      await route.close({ code: 'TARGET_WEBSOCKET_BLOCKED', reason: 'WebSocket is disabled for registered user targets' });
    });
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5000) });
    const endpoint = (await response.json()).webSocketDebuggerUrl;
    if (!response.ok || !/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[\w-]+$/.test(endpoint || '')) throw Error('PROJECT_TARGET_BROWSER_ATTACH_UNAVAILABLE');
    cdpGuard = await attachTargetNetworkGuard(endpoint, target, value => {
      if (!violation) violation = value;
      try { onViolation(value); } catch {}
    });
    const page = await context.newPage();
    if (options.beforeNavigate) await options.beforeNavigate({ browser, context, page });
    await page.goto(target.entry_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { endpoint, context, page, violation: () => violation || cdpGuard.violation(), diagnostics: () => cdpGuard.diagnostics(), close: async () => { await cdpGuard?.close(); await browser.close(); } };
  } catch (error) {
    await cdpGuard?.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}
