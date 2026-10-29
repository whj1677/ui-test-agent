import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { test, expect } from '@playwright/test';
import { parseProjectCaseStepTitle } from './report.mjs';
import { sessionTerminationRequest } from '../auth/session-request-policy.mjs';
import { startTimingObservation } from './timing-observer.mjs';
import { attachTargetNetworkGuard } from './cdp-network-guard.mjs';
import { installActionHighlight } from './action-highlight.mjs';
import { startWindowRecording } from './window-recorder.mjs';
import { installBrowserAssertionEvidence } from './browser-assertion-evidence.mjs';

export const STEP_OBSERVER_VERSION = 'e2e01-step-observer-v6';
const MAX_STRING = 256;
const SECRET_KEY = /password|passwd|secret|token|cookie|authorization|api.?key|credential|session/i;
const SECRET_VALUE = /(?:bearer\s+\S+|(?:password|passwd|secret|token|cookie|authorization|api.?key|credential|session)\s*[:=]\s*\S+)/i;

function safeAssertionValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean') return { value, complete: true };
  if (typeof value === 'number') return Number.isFinite(value) ? { value, complete: true } : { complete: false };
  if (typeof value === 'string') return value.length <= MAX_STRING && !SECRET_VALUE.test(value)
    ? { value, complete: true } : { complete: false };
  if (depth >= 3 || !value || typeof value !== 'object' || seen.has(value)) return { complete: false };
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 20) return { complete: false };
    const items = value.map(item => safeAssertionValue(item, depth + 1, seen));
    return items.every(item => item.complete) ? { value: items.map(item => item.value), complete: true } : { complete: false };
  }
  const keys = Object.keys(value);
  if (Object.getPrototypeOf(value) !== Object.prototype || keys.length > 20 || keys.some(key => SECRET_KEY.test(key))) return { complete: false };
  const output = {};
  for (const key of keys) {
    const item = safeAssertionValue(value[key], depth + 1, seen);
    if (!item.complete) return { complete: false };
    output[key] = item.value;
  }
  return { value: output, complete: true };
}

export function structuredAssertion(error) {
  const matcher = error?.matcherResult;
  if (!matcher || typeof matcher !== 'object') return null;
  const name = typeof matcher.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(matcher.name) ? matcher.name : null;
  const expectedPresent = Object.hasOwn(matcher, 'expected');
  const actualPresent = Object.hasOwn(matcher, 'actual');
  const expected = expectedPresent ? safeAssertionValue(matcher.expected) : { complete: false };
  const actual = actualPresent ? safeAssertionValue(matcher.actual) : { complete: false };
  return { name, capture_source: 'PLAYWRIGHT_MATCHER_RESULT', expected_present: expectedPresent, actual_present: actualPresent,
    expected_complete: expected.complete, actual_complete: actual.complete,
    ...(expected.complete ? { expected: expected.value } : {}), ...(actual.complete ? { actual: actual.value } : {}) };
}

export function installStepObserver({ directory, identity, allowedOrigin = null, networkPolicy = null, windowRecording = null, sessionTerminationEndpoints = [], timingRequirements = [], capture = async (page, file) => page.screenshot({ path: file, style: '[data-workbench-action-highlight]{visibility:hidden!important}' }) }) {
  if (!directory || !identity?.run_id || !identity?.candidate_sha256) throw new Error('STEP_OBSERVER_IDENTITY_REQUIRED');
  const originalStep = test.step;
  const softDescriptor = Object.getOwnPropertyDescriptor(expect, 'soft');
  const originalSoft = expect.soft;
  let activeAssertionRecord = null;
  // Playwright serializes soft errors before test.info().errors exposes them,
  // dropping matcherResult. Observe the actual matcher arguments at invocation;
  // record only a matcher that added a real Playwright soft error.
  if (softDescriptor?.configurable) Object.defineProperty(expect, 'soft', { configurable: true, value: (received, ...message) => {
    const matcher = originalSoft(received, ...message);
    const owner = activeAssertionRecord;
    if (!owner) return matcher;
    return new Proxy(matcher, { get(target, key, receiver) {
      const method = Reflect.get(target, key, receiver);
      if (!['toBe', 'toEqual', 'toStrictEqual', 'toContain', 'toContainEqual', 'toHaveLength'].includes(key) || typeof method !== 'function') return method;
      return (...args) => {
        const snapshot = args.length === 1 ? structuredAssertion({ matcherResult: { name: key, expected: args[0], actual: received } }) : null;
        const before = test.info().errors.length;
        const collect = () => {
          if (owner !== activeAssertionRecord || test.info().errors.length <= before) return;
          if (snapshot?.expected_complete && snapshot?.actual_complete)
            owner.assertions.push({ ...snapshot, capture_source: 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS' });
        };
        const outcome = method.apply(target, args);
        if (outcome && typeof outcome.then === 'function') return outcome.finally(collect);
        collect();
        return outcome;
      };
    } });
  } });
  let page = null;
  let activeBusinessStep = null;
  let depth = 0;
  let ordinal = 0;
  const guardedContexts = new WeakSet();
  const highlightedContexts = new WeakSet();
  let actionHighlightStatus = 'UNAVAILABLE';
  let networkGuard = null;
  let windowRecorder = null;
  let policyWriteQueue = Promise.resolve();
  test.beforeEach(async ({ page: workerPage }) => {
    const context = workerPage.context();
    actionHighlightStatus = 'UNAVAILABLE';
    try {
      if (!highlightedContexts.has(context)) {
        await context.addInitScript(installActionHighlight);
        highlightedContexts.add(context);
      }
      // addInitScript covers future navigations and frames; the current page
      // may already exist when this beforeEach hook runs.
      await workerPage.evaluate(installActionHighlight);
      actionHighlightStatus = 'INSTALLED';
    } catch {
      // A visual aid must not replace the candidate's business result.
      try { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(path.join(directory, 'action-highlight-error.txt'), 'ACTION_HIGHLIGHT_INSTALL_FAILED'); } catch {}
    }
    if ((allowedOrigin || networkPolicy) && !guardedContexts.has(context)) {
      guardedContexts.add(context);
      if (allowedOrigin) await context.route('**/*', async route => {
      let target;
      try { target = new URL(route.request().url()); } catch { return route.abort(); }
      if (allowedOrigin && target.origin !== allowedOrigin) return route.abort();
      if (sessionTerminationRequest(target.href, route.request().method(), allowedOrigin, sessionTerminationEndpoints))
        return route.abort('blockedbyclient');
      return route.continue();
      });
    }
    if (networkPolicy && !networkGuard) {
      const endpoint = await browserEndpointFromPort(process.env.PROBE_CDP_DEBUGGING_PORT);
      networkGuard = await attachTargetNetworkGuard(endpoint, networkPolicy, (violation, { fatal } = {}) => {
        policyWriteQueue = policyWriteQueue.then(() => recordPolicyBreach(directory, violation));
        if (fatal) void context.browser()?.close().catch(() => {});
      }, { onBlockedDependency: dependency => {
        policyWriteQueue = policyWriteQueue.then(async () => {
          await fs.mkdir(directory, { recursive: true });
          await fs.appendFile(path.join(directory, 'network-blocked-dependencies.ndjson'), JSON.stringify({ ...dependency, at: new Date().toISOString() }) + '\n');
        });
      } });
    }
    page = workerPage;
    if (windowRecording) {
      try { windowRecorder = await startWindowRecording({ ...windowRecording, page: workerPage }); }
      catch (error) {
        // Recording failure is visible evidence failure, never a replacement business verdict.
        try {
          await fs.mkdir(windowRecording.directory, { recursive: true });
          await fs.writeFile(path.join(windowRecording.directory, 'recording.json'), JSON.stringify(error.recording || {
            ...identity, status: 'UNAVAILABLE', reason: 'WINDOW_RECORDING_START_FAILED',
          }));
        } catch { /* Missing recording metadata is handled as incomplete evidence by the verifier. */ }
      }
    }
    installBrowserAssertionEvidence({ page: workerPage, allowedOrigin: networkPolicy?.origin || allowedOrigin, identity, getStep: () => activeBusinessStep,
      record: async entry => {
        await fs.mkdir(directory, { recursive: true });
        await fs.appendFile(path.join(directory, 'browser-assertions.ndjson'), JSON.stringify({
          ...entry, ...identity, schema: 'workbench/browser-assertion-evidence-v1', step_order: entry.step_order,
        }) + '\n', 'utf8');
      } });
  });
  const registerTeardown = () => test.afterEach(async () => {
    try { await windowRecorder?.stop(); }
    catch { /* Recording failure cannot replace the candidate's business assertions. */ }
    finally { windowRecorder = null; await networkGuard?.close(); networkGuard = null; await policyWriteQueue; }
  });
  const evidencePath = path.join(directory, 'step-observations.ndjson');
  async function snapshot(stepId, phase) {
    const started = performance.now();
    const file = path.join(directory, `${stepId.toLowerCase()}-${phase}.png`);
    try {
      if (!page || page.isClosed()) throw new Error('OBSERVED_PAGE_UNAVAILABLE');
      await fs.mkdir(directory, { recursive: true });
      await capture(page, file);
      return { phase, file_name: path.basename(file), captured_at: new Date().toISOString(), capture_duration_ms: performance.now() - started };
    } catch (error) {
      return { phase, file_name: null, captured_at: new Date().toISOString(), capture_duration_ms: performance.now() - started,
        capture_error: String(error?.message || error) };
    }
  }
  test.step = async function observedStep(title, callback, options) {
    const parsed = parseProjectCaseStepTitle(title);
    if (!parsed || typeof callback !== 'function') return originalStep.call(this, title, callback, options);
    const order = ++ordinal;
    const parentDepth = depth;
    return originalStep.call(this, title, async (...args) => {
      depth = parentDepth + 1;
      const startedAt = new Date().toISOString();
      const before = await snapshot(parsed.step_id, 'before');
      const businessStartedAt = new Date().toISOString();
      let businessEndedAt = null;
      let after;
      let state = 'PASSED';
      let rawError = null;
      let timingObserver = null;
      let timingObservations = [];
      const assertionRecord = { assertions: [] };
      const previousAssertionRecord = activeAssertionRecord;
      const previousBusinessStep = activeBusinessStep;
      activeBusinessStep = parsed.order;
      activeAssertionRecord = assertionRecord;
      const initialErrors = test.info().errors.length;
      try {
        const required = timingRequirements.filter(item => item.step === parsed.order);
        if (required.length) timingObserver = await startTimingObservation(page, required);
        const value = await callback(...args);
        if (timingObserver) {
          timingObservations = await timingObserver.finish(); timingObserver = null;
          if (timingObservations.some(item => item.status !== 'PASSED'))
            throw new Error(`FROZEN_TIMING_REQUIREMENT_FAILED: ${JSON.stringify(timingObservations)}`);
        }
        businessEndedAt = new Date().toISOString();
        // Soft assertions return normally but are real Playwright errors.
        const recorded = test.info().errors.slice(initialErrors);
        if (recorded.length) {
          state = 'FAILED'; rawError = { name: 'PlaywrightSoftAssertion', message: recorded.map(e => e.message || '').join('\n'), stack: recorded.map(e => e.stack || '').join('\n') };
          if (recorded.length !== 1 || assertionRecord.assertions.length !== 1) assertionRecord.assertions.length = 0;
        }
        return value;
      } catch (error) {
        businessEndedAt = new Date().toISOString();
        state = 'FAILED';
        rawError = { name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '') };
        assertionRecord.assertions.length = 0;
        const assertion = structuredAssertion(error);
        if (assertion) assertionRecord.assertions.push(assertion);
        throw error;
      } finally {
        activeBusinessStep = previousBusinessStep;
        activeAssertionRecord = previousAssertionRecord;
        if (timingObserver) timingObservations = await timingObserver.finish();
        // This awaited capture is inside the original test.step callback. The
        // candidate cannot enter its next awaited business step until it ends.
        after = await snapshot(parsed.step_id, state === 'FAILED' ? 'failure-after' : 'after');
        const entry = { schema: 'workbench/step-observation-v1', observer_version: STEP_OBSERVER_VERSION,
          ...identity, step_id: parsed.step_id, raw_title: title, order, depth: parentDepth,
          started_at: startedAt, ended_at: new Date().toISOString(),
          business_started_at: businessStartedAt, business_ended_at: businessEndedAt,
          status: state,
          action_highlight: { version: 'passive-dom-v1', status: actionHighlightStatus },
          timing_observations: timingObservations,
          raw_error: rawError, assertions: assertionRecord.assertions, captures: [before, after] };
        try { await fs.mkdir(directory, { recursive: true }); await fs.appendFile(evidencePath, `${JSON.stringify(entry)}\n`, 'utf8'); }
        catch (error) { /* Evidence failure must never replace a business assertion. */
          try { await fs.writeFile(path.join(directory, 'observation-write-error.txt'), String(error?.message || error)); } catch {} }
        depth = parentDepth;
      }
    }, options);
  };
  test.step.skip = originalStep.skip;
  return { evidencePath, registerTeardown, restore: () => {
    test.step = originalStep;
    if (softDescriptor?.configurable) Object.defineProperty(expect, 'soft', softDescriptor);
  } };
}

async function recordPolicyBreach(directory, violation) {
  const blocked = { schema: 'workbench/project-target-network-policy-breach-v1', code: violation.code,
    channel: violation.channel || 'http', origin: violation.origin || 'INVALID_URL',
    path: violation.channel === 'data' ? '' : violation.path || '',
    ...(violation.channel === 'data' ? { resource_type: violation.resource_type || 'unknown', mime: violation.mime || 'unknown' } : {}),
    at: new Date().toISOString() };
  try {
    const targetFile = path.join(directory, 'network-policy-breach.json');
    try { await fs.access(targetFile); } catch { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(targetFile, JSON.stringify(blocked)); }
  } catch {}
}

async function browserEndpointFromPort(rawPort) {
  if (!/^\d{1,5}$/.test(rawPort || '') || Number(rawPort) < 1 || Number(rawPort) > 65535) throw Error('TARGET_CDP_ENDPOINT_UNAVAILABLE');
  const port = Number(rawPort), deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(400) });
      const endpoint = (await response.json()).webSocketDebuggerUrl;
      if (response.ok && new RegExp(`^ws://127\\.0\\.0\\.1:${port}/devtools/browser/[\\w-]+$`).test(endpoint || '')) return endpoint;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('TARGET_CDP_ENDPOINT_UNAVAILABLE');
}
