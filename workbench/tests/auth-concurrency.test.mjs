import test from 'node:test';
import assert from 'node:assert/strict';
import { TargetAuthSessions } from '../server/auth/session.mjs';

const scope = { project_id: 'project-concurrency', environment_id: 'fixture', role: 'reader' };
const environment = { environment_id: 'fixture', roles: ['reader'], origin: 'http://127.0.0.1:1',
  login_url: 'http://127.0.0.1:1/login', identity_url: 'http://127.0.0.1:1/identity' };
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

function harness({ launchGate, navigationGate, identityGate } = {}) {
  const events = { launches: 0, closes: 0, requests: 0, routeHandler: null };
  const browserType = { launch: async () => {
    events.launches++;
    if (launchGate) await launchGate.promise;
    const browser = {
      connected: true, listeners: {},
      on(name, callback) { this.listeners[name] = callback; },
      isConnected() { return this.connected; },
      async close() { if (!this.connected) return; this.connected = false; events.closes++; this.listeners.disconnected?.(); },
      async newContext(options) { assert.equal(options.serviceWorkers, 'block'); return {
        async route(pattern, handler) { assert.equal(pattern, '**/*'); events.routeHandler = handler; },
        request: { get: async (_url, options) => { assert.equal(options.maxRedirects, 0); events.requests++; if (identityGate) await identityGate.promise; return { status: () => 200, ok: () => true, json: async () => ({ authenticated: true, account_id: 'reader-1', role: 'reader' }) }; } },
        storageState: async () => ({ cookies: [] }),
        newPage: async () => ({ goto: async () => { if (navigationGate) await navigationGate.promise; }, bringToFront: async () => {}, isClosed: () => false, close: async () => {} }),
      }; },
    };
    return browser;
  } };
  return { events, sessions: new TargetAuthSessions({ environments: [environment], browserExecutable: 'mock', browserType,
    loginPageProbe: async () => {}, headless: true }) };
}

test('same-scope concurrent opens share one launch and one session', async () => {
  const gate = deferred();
  const { events, sessions } = harness({ navigationGate: gate });
  const first = sessions.open(scope), second = sessions.open(scope);
  gate.release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(events.launches, 1);
  assert.equal(typeof events.routeHandler, 'function');
  let continued = 0, aborted = 0;
  const route = url => ({ request: () => ({ url: () => url }), continue: () => { continued++; }, abort: () => { aborted++; } });
  await events.routeHandler(route('http://127.0.0.1:1/protected'));
  await events.routeHandler(route('https://outside.example.test/'));
  assert.deepEqual([continued, aborted], [1, 1]);
  assert.equal(a.session_version, b.session_version);
  assert.equal(sessions.sessions.size, 1);
  await sessions.close();
  assert.equal(events.closes, 1);
});

test('clear and close wait for a preparing browser and leave no session', async () => {
  for (const action of ['clear', 'close']) {
    const gate = deferred();
    const { events, sessions } = harness({ launchGate: gate });
    const opening = sessions.open(scope);
    const cleanup = action === 'clear' ? sessions.clear(scope) : sessions.close();
    gate.release();
    await opening;
    await cleanup;
    assert.equal(sessions.status(scope).status, 'NOT_LOGGED_IN');
    assert.equal(sessions.sessions.size, 0);
    assert.equal(events.launches, 1);
    assert.equal(events.closes, 1);
    await sessions.close();
    assert.equal((await sessions.check(scope)).status, 'NOT_LOGGED_IN');
    assert.equal((await sessions.clear(scope)).status, 'NOT_LOGGED_IN');
    assert.equal(events.launches, 1);
    assert.equal(events.closes, 1);
    await assert.rejects(sessions.open(scope), /AUTH_SESSIONS_CLOSING/);
  }
});

test('clear waits for identity check, notifies invalidation once, and prevents stale VALID state', async () => {
  const gate = deferred();
  const { sessions } = harness({ identityGate: gate });
  const notices = [];
  sessions.setInvalidationListener(note => notices.push(note));
  await sessions.open(scope);
  const checking = sessions.check(scope);
  const clearing = sessions.clear(scope);
  gate.release();
  assert.equal((await checking).status, 'VALID');
  assert.equal((await clearing).status, 'NOT_LOGGED_IN');
  assert.equal(sessions.status(scope).status, 'NOT_LOGGED_IN');
  assert.deepEqual(notices.map(note => [note.status, note.trigger]), [['CLEARED', 'cleared']]);
  await sessions.close();
});

test('opening the login browser can focus a valid protected session without replacing it or navigating', async () => {
  const { events, sessions } = harness();
  await sessions.open(scope);await sessions.check(scope);
  const before=sessions.status(scope),item=[...sessions.sessions.values()][0];
  let focused=0,navigated=0;
  item.context.pages=()=>[{isClosed:()=>false,url:()=>environment.origin+'/app',bringToFront:async()=>{focused++;},goto:async()=>{navigated++;}}];
  const release=sessions.beginTaskProtection(scope,before.session_version);
  try{
    const after=await sessions.open(scope,{reuseExisting:true});
    assert.deepEqual(after,before);assert.equal(focused,1);assert.equal(navigated,0);
    assert.equal(events.launches,1);assert.equal(events.closes,0);
  }finally{release();await sessions.close();}
});
