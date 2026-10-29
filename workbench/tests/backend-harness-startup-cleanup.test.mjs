import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { BackendHarnessManager, BACKEND_HARNESS_LIMITS } from '../server/backend/harness-manager.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-harness-startup-cleanup-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const oldTimeout = globalThis.setTimeout, oldClear = globalThis.clearTimeout, oldListen = net.Server.prototype.listen;
  const timers = new Set(); let scheduled = 0, bindAttempts = 0, modelCalls = 0, runtimeCalls = 0;
  const external = new AbortController(), listeners = new Set();
  const add = external.signal.addEventListener.bind(external.signal), remove = external.signal.removeEventListener.bind(external.signal);
  external.signal.addEventListener = (type, listener, options) => { if (type === 'abort') listeners.add(listener); return add(type, listener, options); };
  external.signal.removeEventListener = (type, listener, options) => { if (type === 'abort') listeners.delete(listener); return remove(type, listener, options); };
  // These budget timers never start a real clock. We directly observe whether
  // acquired timer handles and caller listeners are released on startup errors.
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== BACKEND_HARNESS_LIMITS.wall_ms) return oldTimeout(callback, delay, ...args);
    const handle = { syntheticBudgetTimer: ++scheduled }; timers.add(handle); return handle;
  };
  globalThis.clearTimeout = handle => { if (timers.has(handle)) timers.delete(handle); else oldClear(handle); };
  net.Server.prototype.listen = () => {
    bindAttempts++;
    throw Object.assign(Error('Synthetic MCP bind failure'), { code: 'EADDRINUSE' });
  };
  t.after(() => {
    globalThis.setTimeout = oldTimeout; globalThis.clearTimeout = oldClear; net.Server.prototype.listen = oldListen;
    for (const listener of listeners) remove('abort', listener);
  });
  const manager = new BackendHarnessManager({ root, dshHome: path.join(root, 'synthetic-dsh'),
    configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'synthetic-never-sent', baseUrl: 'https://api.deepseek.com' }),
    qualityReviewer: async () => { throw Error('Review must not run'); },
    ensureRuntime: async () => { runtimeCalls++; throw Error('Runtime must not start'); },
    runHarness: async () => { modelCalls++; throw Error('Model must not run'); },
  });
  const start = qualityMode => manager.start({ plan: { project_id: 'project-cleanup', plan_id: 'plan-cleanup', request_mode: 'generate',
    ...(qualityMode ? { quality_review_mode: qualityMode } : {}) }, context: {}, environment: {}, signal: external.signal,
    persist: async () => {}, assertCurrent: async () => {} });
  return { manager, start, observe: () => ({ scheduled, liveTimers: timers.size, callerAbortListeners: listeners.size, bindAttempts, runtimeCalls, modelCalls }) };
}

test('MCP bind failure releases budget timer and caller abort listener before rejecting', async t => {
  const f = await fixture(t);
  await assert.rejects(f.start(), error => error.code === 'EADDRINUSE');
  const observed = f.observe(); console.log('STARTUP_CLEANUP_PROBE', JSON.stringify(observed));
  assert.equal(observed.bindAttempts, 1); assert.equal(observed.scheduled, 1);
  assert.equal(observed.liveTimers, 0); assert.equal(observed.callerAbortListeners, 0);
  assert.equal(observed.runtimeCalls, 0); assert.equal(observed.modelCalls, 0); assert.equal(f.manager.active, null);
});

test('session validation failure releases resources before any MCP bind or model attempt', async t => {
  const f = await fixture(t);
  await assert.rejects(f.start('invalid-mode'), /QUALITY_REVIEW_MODE_INVALID/);
  const observed = f.observe(); console.log('STARTUP_CLEANUP_PROBE', JSON.stringify(observed));
  assert.equal(observed.bindAttempts, 0); assert.equal(observed.scheduled, 1);
  assert.equal(observed.liveTimers, 0); assert.equal(observed.callerAbortListeners, 0);
  assert.equal(observed.runtimeCalls, 0); assert.equal(observed.modelCalls, 0); assert.equal(f.manager.active, null);
});
