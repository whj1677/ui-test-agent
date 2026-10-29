import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { apply, BROWSER_BRIDGE_PATCH_PATH, openExistingSessionInBrowser, renderBrowserBridgeIndex } from '../server/native-dsh/browser-bridge.mjs';

const sessionId = 'session-8d23f460-f32f-4210-94ff-54c0681cdf33';
const html = '<!doctype html><html><head><script>globalThis.nativeBoot = true;</script><script type="module" crossorigin src="./assets/app.js"></script></head><body><div id="root"></div></body></html>';

function browser({ hash = `#workbench-session=${sessionId}`, saved, value = { values: { sessionListMetadata: { blank: false } } },
  writeFailure = false, readFailure = false, httpFailure = false, rpcFailure = false, readyState = 'complete', entries = true } = {}) {
  const values = new Map(saved === undefined ? [] : [['dsh.sessions.current', saved]]);
  const calls = [], replacements = [], messages = [], urls = [], listeners = [];
  let notifyDomRequested;
  const domRequested = new Promise(resolve => { notifyDomRequested = resolve; });
  const original = { attributes: [{ name: 'type', value: 'application/x-workbench-dsh-module' },
    { name: 'crossorigin', value: '' }, { name: 'src', value: './assets/app.js' }, { name: 'data-workbench-native-entry', value: '1' }],
  textContent: '', replaceWith: node => replacements.push(node) };
  const context = {
    document: { readyState,
      addEventListener: (event, callback) => { assert.equal(event, 'DOMContentLoaded'); listeners.push(callback); notifyDomRequested(); },
      querySelectorAll: selector => { assert.equal(selector, 'script[data-workbench-native-entry="1"]'); return entries ? [original] : []; },
      createElement: tag => ({ tag, attributes: {}, style: {}, setAttribute(name, value) { this.attributes[name] = value; } }),
      body: { replaceChildren: node => messages.push(node) } },
    location: { hash, pathname: '/', search: '' },
    history: { state: { retained: true }, replaceState: (state, title, url) => urls.push(url) },
    localStorage: { getItem: key => { if (readFailure) throw Error('private storage detail'); return values.get(key) ?? null; },
      setItem: (key, value) => { if (writeFailure) throw Error('private storage detail'); values.set(key, value); } },
    crypto: { randomUUID: () => 'read-only-open-request' }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      const request = JSON.parse(options.body);
      calls.push({ url, request });
      assert.equal(options.credentials, 'same-origin');
      return { ok: !httpFailure, json: async () => ({ type: 'server-response', rpcId: request.rpcId, result: { ok: !rpcFailure, value } }) };
    }
  };
  return { context, calls, replacements, messages, urls, values, listeners, domRequested,
    run: () => runInNewContext(`(${openExistingSessionInBrowser.toString()})()`, context) };
}

test('official patch resolves one local plugin and registers a disposable HTML tap', async () => {
  const patch = await readFile(BROWSER_BRIDGE_PATCH_PATH, 'utf8');
  assert.match(patch, /name: \.\/browser-bridge\.mjs/);
  let installed, disposed = false;
  apply({ effect: fn => { installed = fn(); }, webServer: { tapIndex: fn => {
    assert.equal(fn, renderBrowserBridgeIndex); return () => { disposed = true; };
  } } });
  installed();
  assert.equal(disposed, true);
});

test('HTML makes app entries inert and adds bridge before native bootstrap scripts', () => {
  const output = renderBrowserBridgeIndex(html);
  assert.ok(output.indexOf('data-workbench-native-bridge') < output.indexOf('globalThis.nativeBoot'));
  assert.match(output, /type="application\/x-workbench-dsh-module" crossorigin src="\.\/assets\/app\.js" data-workbench-native-entry="1"/);
  assert.doesNotMatch(output, /<script\s+type="module"/);
  assert.throws(() => renderBrowserBridgeIndex('<html></html>'), /HEAD_MISSING/);
  assert.throws(() => renderBrowserBridgeIndex('<head></head>'), /APP_ENTRY_MISSING/);
});

test('existing nonblank session performs only projections lookup before restoring native entry', async () => {
  const b = browser();
  const result = await b.run();
  assert.equal(result.status, 'opened');
  assert.equal(result.session_id, sessionId);
  assert.equal(b.calls.length, 1);
  assert.equal(b.calls[0].url, '/api/session/projections');
  assert.equal(b.calls[0].request.method, 'session/projections');
  assert.deepEqual(b.calls[0].request.payload, { args: { request: { sessionId } } });
  assert.equal(b.values.get('dsh.sessions.current'), JSON.stringify({ sessionId }));
  assert.deepEqual(b.urls, ['/']);
  assert.equal(b.replacements[0].type, 'module');
  assert.equal(b.replacements[0].attributes.src, './assets/app.js');
  assert.equal(b.messages.length, 0);
});

test('clean URL reload retains selected session and does not create a new session', async () => {
  const b = browser({ hash: '', saved: JSON.stringify({ sessionId }) });
  assert.equal((await b.run()).status, 'opened');
  assert.equal(b.calls.length, 1);
  assert.equal(b.calls[0].request.method, 'session/projections');
});

test('invalid or missing selections block without making an API call or booting native app', async () => {
  for (const options of [{ hash: '#session=wrong' }, { hash: `#workbench-session=${sessionId}&other=x` },
    { hash: '#workbench-session=../bad' }, { hash: '' }, { hash: '', saved: '{broken' }, { hash: '', readFailure: true }]) {
    const b = browser(options), result = await b.run();
    assert.equal(result.status, 'blocked');
    assert.equal(b.calls.length, 0);
    assert.equal(b.replacements.length, 0);
    assert.equal(b.messages[0].attributes.role, 'alert');
    assert.doesNotMatch(b.messages[0].textContent, /private storage detail/);
  }
});

test('missing, blank, inaccessible and storage-denied sessions never restore app entry', async () => {
  for (const options of [{ value: null }, { value: { values: { sessionListMetadata: { blank: true } } } },
    { value: { values: {} } }, { httpFailure: true }, { rpcFailure: true }, { writeFailure: true }, { entries: false }]) {
    const b = browser(options), result = await b.run();
    assert.equal(result.status, 'blocked');
    assert.equal(b.calls.length, 1);
    assert.equal(b.replacements.length, 0);
    assert.equal(b.messages.length, 1);
  }
});

test('native module waits for DOM readiness after safe selection succeeds', async () => {
  const b = browser({ readyState: 'loading' }), pending = b.run();
  await b.domRequested;
  assert.equal(b.replacements.length, 0);
  assert.equal(b.listeners.length, 1);
  b.listeners[0]();
  assert.equal((await pending).status, 'opened');
  assert.equal(b.replacements.length, 1);
});
