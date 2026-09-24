import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

function scopeKey(scope) {
  if (!scope || !/^project-[\w-]+$/.test(scope.project_id || '') ||
      !/^[\w-]+$/.test(scope.environment_id || '') || !/^[\w-]+$/.test(scope.role || '')) {
    throw new Error('AUTH_SCOPE_INVALID');
  }
  return JSON.stringify([scope.project_id, scope.environment_id, scope.role]);
}

async function freeLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function publicState(item) {
  return {
    project_id: item.scope.project_id, environment_id: item.scope.environment_id, role: item.scope.role,
    session_version: item.version, status: item.status, account_id: item.identity?.account_id || null,
    expires_at: item.identity?.expires_at || null, reason: item.reason || null,
  };
}

export class TargetAuthSessions {
  constructor({ environments, browserExecutable, browserType = chromium, headless = false, now = () => Date.now() }) {
    this.environments = new Map(environments.map((item) => [item.environment_id, item]));
    this.browserExecutable = browserExecutable;
    this.browserType = browserType;
    this.headless = headless;
    this.now = now;
    this.sessions = new Map();
  }

  environment(scope) {
    scopeKey(scope);
    const environment = this.environments.get(scope.environment_id);
    if (!environment || !environment.roles.includes(scope.role)) throw new Error('AUTH_ENVIRONMENT_ROLE_NOT_ALLOWED');
    for (const field of ['login_url', 'identity_url']) {
      const url = new URL(environment[field]);
      if (url.origin !== environment.origin || !['https:', 'http:'].includes(url.protocol)) throw new Error('AUTH_ENVIRONMENT_ORIGIN_INVALID');
      if (url.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('AUTH_ENVIRONMENT_ORIGIN_INVALID');
    }
    return environment;
  }

  list() {
    return [...this.environments.values()].map(({ environment_id, name, roles }) => ({ environment_id, name, roles }));
  }

  status(scope) {
    const item = this.sessions.get(scopeKey(scope));
    return item ? publicState(item) : { ...scope, session_version: null, status: 'NOT_LOGGED_IN', account_id: null, expires_at: null, reason: null };
  }

  async open(scope) {
    const environment = this.environment(scope);
    const key = scopeKey(scope);
    if (this.sessions.has(key)) await this.clear(scope);
    if (!this.browserExecutable) throw new Error('AUTH_BROWSER_EXECUTABLE_REQUIRED');
    const port = await freeLoopbackPort();
    const browser = await this.browserType.launch({
      headless: this.headless, executablePath: this.browserExecutable,
      args: ['--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`],
    });
    try {
      // newContext is off-the-record; no persistent profile is reused.
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await page.goto(environment.login_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const item = { scope: { ...scope }, version: randomUUID(), browser, context, page, port,
        status: 'AWAITING_LOGIN', identity: null, reason: null };
      browser.on('disconnected', () => {
        if (this.sessions.get(key) === item) {
          item.status = 'BROWSER_CLOSED'; item.identity = null; item.reason = 'BROWSER_CLOSED';
        }
      });
      this.sessions.set(key, item);
      await page.bringToFront();
      return publicState(item);
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }
  }

  async check(scope) {
    const environment = this.environment(scope);
    const item = this.sessions.get(scopeKey(scope));
    if (!item) return this.status(scope);
    if (!item.browser.isConnected()) {
      item.status = 'BROWSER_CLOSED'; item.identity = null; item.reason = 'BROWSER_CLOSED';
      return publicState(item);
    }
    let response;
    try {
      // BrowserContext.request shares this context's cookies; the endpoint is
      // explicitly configured as read-only and supplies account and role facts.
      response = await item.context.request.get(environment.identity_url, { timeout: 5000, failOnStatusCode: false });
    } catch {
      item.status = 'CHECK_UNAVAILABLE'; item.reason = 'IDENTITY_CHECK_UNAVAILABLE';
      return publicState(item);
    }
    if (response.status() === 401) {
      const waiting = item.status === 'AWAITING_LOGIN';
      item.status = waiting ? 'AWAITING_LOGIN' : 'EXPIRED'; item.identity = null;
      item.reason = waiting ? 'LOGIN_REQUIRED' : 'SESSION_EXPIRED';
      return publicState(item);
    }
    if (response.status() === 403) {
      item.status = 'PERMISSION_DENIED'; item.identity = null; item.reason = 'PERMISSION_DENIED';
      return publicState(item);
    }
    if (!response.ok()) {
      item.status = 'CHECK_UNAVAILABLE'; item.reason = 'IDENTITY_CHECK_UNAVAILABLE';
      return publicState(item);
    }
    let body;
    try { body = await response.json(); } catch {}
    if (body?.authenticated !== true || typeof body.account_id !== 'string' || !body.account_id ||
        typeof body.role !== 'string' || !body.role) {
      item.status = 'IDENTITY_UNVERIFIED'; item.identity = null; item.reason = 'IDENTITY_EVIDENCE_MISSING';
      return publicState(item);
    }
    if (body.role !== scope.role) {
      item.status = 'ROLE_MISMATCH'; item.identity = null; item.reason = 'ROLE_MISMATCH';
      return publicState(item);
    }
    if (item.identity && item.identity.account_id !== body.account_id) {
      item.status = 'IDENTITY_CHANGED'; item.identity = null; item.reason = 'IDENTITY_CHANGED';
      return publicState(item);
    }
    const expires = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : null;
    if (expires != null && (!Number.isFinite(expires) || expires <= this.now())) {
      item.status = 'EXPIRED'; item.identity = null; item.reason = 'SESSION_EXPIRED';
      return publicState(item);
    }
    const firstVerified = item.status !== 'VALID';
    if (['EXPIRED', 'ROLE_MISMATCH', 'PERMISSION_DENIED', 'IDENTITY_CHANGED'].includes(item.status)) item.version = randomUUID();
    item.identity = { account_id: body.account_id, role: body.role, expires_at: expires == null ? null : new Date(expires).toISOString() };
    item.status = 'VALID'; item.reason = null;
    if (firstVerified && item.page && !item.page.isClosed()) {
      // The model attaches only after this transition. Discard the tab that
      // handled the password/MFA form, retaining only its in-memory context.
      await item.page.close();
      item.page = await item.context.newPage();
    }
    return publicState(item);
  }

  async stateForExecution(scope, expectedVersion) {
    const status = await this.check(scope);
    if (status.status !== 'VALID' || status.session_version !== expectedVersion) throw new Error('AUTH_SESSION_NOT_VALID');
    const item = this.sessions.get(scopeKey(scope));
    return structuredClone(await item.context.storageState({ indexedDB: true }));
  }

  async attachEndpoint(scope, expectedVersion) {
    const status = await this.check(scope);
    if (status.status !== 'VALID' || status.session_version !== expectedVersion) throw new Error('AUTH_SESSION_NOT_VALID');
    const item = this.sessions.get(scopeKey(scope));
    const response = await fetch(`http://127.0.0.1:${item.port}/json/version`);
    if (!response.ok) throw new Error('AUTH_BROWSER_CDP_UNAVAILABLE');
    const endpoint = (await response.json()).webSocketDebuggerUrl;
    if (!/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[\w-]+$/.test(endpoint || '')) {
      throw new Error('AUTH_BROWSER_CDP_UNAVAILABLE');
    }
    return endpoint;
  }

  async clear(scope) {
    const item = this.sessions.get(scopeKey(scope));
    if (!item) return this.status(scope);
    this.sessions.delete(scopeKey(scope));
    item.identity = null;
    await item.browser.close().catch(() => {});
    return this.status(scope);
  }

  async close() {
    for (const item of this.sessions.values()) await item.browser.close().catch(() => {});
    this.sessions.clear();
  }
}
