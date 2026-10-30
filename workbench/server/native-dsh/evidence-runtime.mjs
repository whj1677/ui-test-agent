import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { types } from 'node:util';
import { structuredAssertion } from '../build/step-observer.mjs';
import { installActionHighlight } from '../build/action-highlight.mjs';
import { startWindowRecording } from '../build/window-recorder.mjs';
import { observeLocatorActual } from './locator-observation.mjs';

const config = process.env.NATIVE_EVIDENCE_CONFIG ? JSON.parse(readFileSync(process.env.NATIVE_EVIDENCE_CONFIG, 'utf8')) : null;
const identityKeys = new Set(['run_id','project_id','source_task_id','candidate_sha256','bundle_sha256','candidate_bundle_sha256','executed_external_id','executed_case_id','executed_case_version','executed_content_sha256','source_kind','source_draft_id']);
const identity = Object.fromEntries(Object.entries(config?.identity || {}).filter(([key]) => identityKeys.has(key)));
const directory = config && path.join(config.runDirectory, 'artifacts', 'step-evidence');
const plainMatchers = new Set(['toBe','toEqual','toStrictEqual','toContain','toContainEqual','toHaveLength','toBeTruthy','toBeFalsy','toBeNull','toBeDefined','toBeUndefined','toBeNaN','toBeGreaterThan','toBeGreaterThanOrEqual','toBeLessThan','toBeLessThanOrEqual','toBeCloseTo','toMatch','toMatchObject','toHaveProperty','toBeInstanceOf']);
let testApi, page, recorder, active, mapping, ordinal = 0, installed = false, errors = [], unbound = [], highlight = 'UNAVAILABLE', testCount = 0;
const now = () => new Date().toISOString();
async function safeWrite(name, value, append = false) {
  try { await fs.mkdir(directory, { recursive: true }); await fs[append ? 'appendFile' : 'writeFile'](path.join(directory, name), JSON.stringify(value) + '\n'); }
  catch { errors.push('EVIDENCE_WRITE_FAILED'); }
}
function observeError(error) { errors.push(String(error?.message || error).slice(0, 300)); }
function argumentSnapshot(name, key, value) {
  if (key === 'expected' && types.isRegExp(value)) {
    try { return structuredAssertion({ matcherResult: { name, expected: RegExp.prototype.toString.call(value) } }); } catch { return null; }
  }
  // Inspect data descriptors only: collecting evidence must not invoke getters.
  function plain(item, depth = 0, seen = new WeakSet()) {
    if (item === null || typeof item !== 'object') return true;
    if (depth > 3 || types.isProxy(item) || seen.has(item)) return false;
    seen.add(item);
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(item);
    return Object.values(descriptors).every(d => Object.hasOwn(d, 'value') && plain(d.value, depth + 1, seen));
  }
  try { return plain(value) ? structuredAssertion({ matcherResult: { name, [key]: value } }) : null; }
  catch { return null; }
}

export function install(api, sourceMapping) {
  if (!config || installed || !api) return;
  installed = true; testApi = api; mapping = sourceMapping;
  api.beforeEach(async ({ page: currentPage }) => {
    page = currentPage; testCount++; active = null; ordinal = 0;
    try { await page.context().addInitScript(installActionHighlight); await page.evaluate(installActionHighlight); highlight = 'INSTALLED'; }
    catch { errors.push('ACTION_HIGHLIGHT_INSTALL_FAILED'); }
    if(config.executionMode !== 'BACKGROUND') try { recorder = await startWindowRecording({ page, directory: path.join(config.runDirectory, 'artifacts', 'window-recording'), identity,
      maximumDurationMs: config.timeoutMs, prepared: config.recorderPrepared }); }
    catch (error) {
      errors.push('WINDOW_RECORDING_START_FAILED');
      try { const target = path.join(config.runDirectory, 'artifacts', 'window-recording'); await fs.mkdir(target, { recursive: true });
        await fs.writeFile(path.join(target, 'recording.json'), JSON.stringify(error.recording || { status: 'UNAVAILABLE', identity, reason: 'WINDOW_RECORDING_START_FAILED' })); } catch {}
    }
    await safeWrite('runtime-metadata.json', { schema: 'native-step-runtime-v1', ...identity, mapping, test_count: testCount, errors });
  });
  api.afterEach(async () => {
    await end();
    try { await recorder?.stop(); } catch { errors.push('WINDOW_RECORDING_STOP_FAILED'); }
    recorder = null;
    await safeWrite('unbound-assertions.json', unbound);
    await safeWrite('runtime-metadata.json', { schema: 'native-step-runtime-v1', ...identity, mapping, test_count: testCount, errors });
  });
}

async function capture(stepId, phase) {
  const started = Date.now(), file_name = `${stepId.toLowerCase()}-${phase}.png`;
  try {
    await fs.mkdir(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, file_name), timeout: 5000, style: '[data-workbench-action-highlight]{visibility:hidden!important}' });
    return { phase, file_name, captured_at: now(), capture_duration_ms: Date.now() - started };
  } catch { return { phase, file_name: null, captured_at: now(), capture_duration_ms: Date.now() - started, capture_error: 'STEP_SCREENSHOT_UNAVAILABLE' }; }
}
export async function begin() { /* beforeEach owns recording; original test timeout is unchanged. */ }
export async function boundary(order) {
  try {
    if (mapping?.status !== 'BOUND' || order !== ordinal + 1 || testCount !== 1) { errors.push('STEP_BOUNDARY_NOT_UNIQUE'); return; }
    await end(); ordinal = order;
    const step_id = `CASE_STEP_${order}`;
    active = { schema: 'workbench/step-observation-v1', ...identity, step_id, order, depth: 0, raw_title: step_id,
      status: 'PASSED', started_at: now(), business_started_at: null, business_ended_at: null, ended_at: null,
      action_highlight: { version: 'passive-dom-v1', status: highlight }, captures: [], assertions: [], raw_error: null,
      mapping: { ...mapping, boundaries: undefined }, errors_before: testApi.info().errors.length };
    active.captures.push(await capture(step_id, 'before')); active.business_started_at = now();
  } catch (error) { observeError(error); }
}
export function failure(error) {
  try { if (active) { active.status = 'FAILED'; active.raw_error = String(error?.message || error).slice(0, 12000); } }
  catch (error) { observeError(error); }
}
export async function end() {
  if (!active) return;
  const item = active; active = null;
  try {
    item.business_ended_at = now();
    if (testApi.info().errors.length > item.errors_before) item.status = 'FAILED';
    delete item.errors_before;
    item.captures.push(await capture(item.step_id, item.status === 'FAILED' ? 'failure-after' : 'after')); item.ended_at = now();
    await safeWrite('step-observations.ndjson', item, true);
  } catch (error) { observeError(error); }
}

// Matcher proxies only observe calls. They preserve synchronous return values,
// async settlement, .not/.soft, thrown error identity, and original call count.
export function wrapExpect(expectFunction, location) {
  return function observedExpect(received, ...messages) {
    const original = expectFunction(received, ...messages);
    const receivedSnapshot = argumentSnapshot('received', 'actual', received);
    function proxy(target, flags = {}) {
      return new Proxy(target, { get(object, property, receiver) {
        const value = Reflect.get(object, property, receiver);
        if (['not','resolves','rejects'].includes(property)) return proxy(value, { ...flags, [property]: true });
        if (typeof value !== 'function' || typeof property !== 'string') return value;
        return function observedMatcher(...args) {
          const owner = active, started_at = now();
          const expected = args.length ? argumentSnapshot(property, 'expected', property === 'toHaveProperty' && args.length > 1 ? args[1] : args[0]) : null;
          const before = testApi?.info().errors.length || 0;
          function record(error, observation) {
            try {
              const softFailure = location.soft && (testApi?.info().errors.length || 0) > before;
              const failed = Boolean(error || softFailure), real = error && structuredAssertion(error);
              const safeArguments = plainMatchers.has(property) && !flags.resolves && !flags.rejects;
              const argumentActual = safeArguments && receivedSnapshot?.actual_complete;
              const domActual = observation?.value_source === 'PLAYWRIGHT_LOCATOR_OBSERVATION';
              const actualPresent = Boolean(real?.actual_complete || argumentActual || domActual);
              const expectedPresent = Boolean(real?.expected_complete || expected?.expected_complete);
              const value_source = real?.actual_complete ? 'PLAYWRIGHT_MATCHER_RESULT' : argumentActual ?
                (location.soft ? 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS' : 'PLAYWRIGHT_MATCHER_ARGUMENTS') : domActual ? observation.value_source : null;
              const entry = { matcher_name: property, message: typeof messages[0] === 'string' ? messages[0].slice(0, 300) : null,
                location, is_not: Boolean(flags.not), is_soft: Boolean(location.soft), started_at, ended_at: now(),
                status: failed ? 'FAILED' : 'PASSED', actual_present: actualPresent, actual_recorded: actualPresent,
                expected_present: expectedPresent, value_source,
                ...(actualPresent ? { actual: real?.actual_complete ? real.actual : argumentActual ? receivedSnapshot.actual : observation.actual } : {}),
                ...(value_source === 'PLAYWRIGHT_LOCATOR_OBSERVATION' ? observation : {}),
                ...(expectedPresent ? { assertion_expected: real?.expected_complete ? real.expected : expected.expected } : {}),
                value_unavailable_reason: actualPresent ? null : observation?.reason || 'MATCHER_DID_NOT_EXPOSE_SAFE_ACTUAL',
                raw_error: error ? String(error.message || error).slice(0, 12000) : null };
              (owner?.assertions || unbound).push(entry);
            } catch (error) { observeError(error); }
          }
          try {
            const outcome = Reflect.apply(value, object, args);
            if (outcome && typeof outcome.then === 'function') return outcome.then(async result => {
              const observation = await observeLocatorActual(received, property, args, flags); record(null, observation); return result;
            }, async error => {
              const observation = structuredAssertion(error)?.actual_complete ? null : await observeLocatorActual(received, property, args, flags);
              record(error, observation); throw error;
            });
            record(); return outcome;
          } catch (error) { record(error); throw error; }
        };
      } });
    }
    return proxy(original);
  };
}
