import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Reuse the installation selected by the caller. This module never launches a browser.
if (!process.env.WORKBENCH_PACKAGE) throw new Error('WORKBENCH_PACKAGE is required');
const require = createRequire(path.resolve(process.env.WORKBENCH_PACKAGE));
const { chromium } = require('playwright');
export const { expect } = require('@playwright/test');
const runtimeFile = fileURLToPath(import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const stamp = () => new Date().toISOString();
const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

class RunnerError extends Error {
  constructor(code, message = code) { super(message); this.name = 'RunnerError'; this.code = code; }
}
class BlockedError extends Error {
  constructor(message) { super(message); this.name = 'BlockedError'; this.code = 'PRECONDITION'; }
}
function safeUrl(value) {
  try { const u = new URL(value); return `${u.origin}${u.pathname}`; }
  catch { return '<invalid-url>'; }
}
function safeError(error) {
  return {
    name: error?.name ?? 'Error', code: error?.code ?? null,
    message: String(error?.message ?? error).replace(/https?:\/\/[^\s"'<>]+/g, safeUrl).slice(0, 4000),
  };
}
function match(pattern, event) {
  if (pattern instanceof RegExp) { pattern.lastIndex = 0; return pattern.test(event.url); }
  return pattern === event.url || pattern === event.path;
}
function validPattern(pattern) { return pattern instanceof RegExp || (typeof pattern === 'string' && pattern.length > 0); }
function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Literal local imports are followed recursively. Computed imports require dependencyDirs.
async function sourceFiles(entry, dependencyDirs = []) {
  const found = new Map();
  async function add(file) {
    file = await fs.realpath(file);
    if (found.has(file)) return;
    const bytes = await fs.readFile(file);
    found.set(file, bytes);
    if (!/\.(?:mjs|cjs|js)$/.test(file)) return;
    const text = bytes.toString('utf8');
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      await add(path.resolve(path.dirname(file), m[1]));
    }
  }
  async function walk(dir, root) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isSymbolicLink()) throw new RunnerError('DEPENDENCY_SYMLINK', file);
      if (!inside(root, file)) throw new RunnerError('DEPENDENCY_ESCAPES_ROOT');
      if (item.isDirectory()) {
        if (!['node_modules', '.git'].includes(item.name)) await walk(file, root);
      } else if (item.isFile() && /\.(?:mjs|cjs|js|json|md)$/.test(item.name)) await add(file);
    }
  }
  await add(entry);
  await add(runtimeFile);
  for (const directory of dependencyDirs) {
    const dir = await fs.realpath(directory);
    await walk(dir, dir);
  }
  return found;
}

async function attachOriginalPage() {
  if (!process.env.PILOT_CDP || !process.env.TARGET_URL) throw new RunnerError('BROWSER_ENV_MISSING');
  let target;
  try { target = new URL(process.env.TARGET_URL).href; }
  catch { throw new RunnerError('TARGET_URL_INVALID'); }
  let browser;
  try { browser = await chromium.connectOverCDP(process.env.PILOT_CDP); }
  catch (error) { throw new BlockedError(`Original browser unavailable: ${safeError(error).message}`); }
  const pages = browser.contexts().flatMap(context => context.pages()).filter(page => page.url() === target);
  if (pages.length !== 1) throw new BlockedError(`Expected one original page at ${safeUrl(target)}; found ${pages.length}`);
  return pages[0];
}

/** Run one frozen original case. Always await the returned promise before exiting the script. */
export async function runCase({ caseFile, externalId, scriptFile, outputDir, attempt, dependencyDirs = [], execute }) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new RunnerError('INVALID_ATTEMPT');
  if (typeof execute !== 'function') throw new RunnerError('EXECUTE_REQUIRED');
  const directory = path.resolve(outputDir, `attempt-${String(attempt).padStart(3, '0')}`);
  await fs.mkdir(path.dirname(directory), { recursive: true });
  // An attempt is immutable. A duplicate cannot overwrite prior evidence or touch the page.
  await fs.mkdir(directory);
  const report = {
    schema: 'dsh-ui-runner/v1', attempt, status: 'RUNNING', failure_kind: null,
    started_at: stamp(), finished_at: null, model_calls: 0,
    case: null, steps: [], checks: [], screenshots: [], request_watches: [],
    cleanup: { registered: 0, executed: 0, succeeded: 0 }, faults: [], source_snapshot: [],
  };
  let page, rawCase, casePath, sources, activeStep = null, sequence = 0;
  const cleanups = [], internalCleanups = [], active = new Set(), pendingChecks = new Set(), finalNetworkChecks = [];
  let executionEnded = false;
  function fault(error, phase) {
    const kind = error instanceof RunnerError ? 'RUNNER_ERROR'
      : error instanceof BlockedError ? 'PRECONDITION'
        : error?.matcherResult || error?.name === 'AssertionError' ? 'ASSERTION' : 'SCRIPT_ERROR';
    if (!report.faults.some(item => item.error === error)) report.faults.push({ error, kind, phase, ...safeError(error) });
    return error;
  }
  const fail = (code, phase = 'runner') => { const error = new RunnerError(code); fault(error, phase); throw error; };
  const track = (set, promise) => {
    set.add(promise); promise.then(() => set.delete(promise), () => set.delete(promise)); return promise;
  };
  async function screenshot(label) {
    if (!page) return null;
    const name = `${String(++sequence).padStart(3, '0')}-${String(label).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}.png`;
    try {
      await page.screenshot({ path: path.join(directory, name), animations: 'disabled', fullPage: false });
      report.screenshots.push({ file: name, at: stamp() }); return name;
    } catch (error) { throw fault(new RunnerError('SCREENSHOT_FAILED', safeError(error).message), 'evidence'); }
  }
  try {
    casePath = path.resolve(caseFile);
    rawCase = await fs.readFile(casePath);
    const parsed = JSON.parse(rawCase.toString('utf8'));
    const cases = Array.isArray(parsed) ? parsed : [parsed];
    const candidates = externalId ? cases.filter(c => (c.external_id ?? c.content?.external_id) === externalId) : cases;
    if (candidates.length !== 1) fail('SELECT_EXACTLY_ONE_CASE');
    const frozenCase = deepFreeze(structuredClone(candidates[0]));
    const content = frozenCase.content ?? frozenCase;
    if (!Array.isArray(content.steps) || content.steps.length === 0) fail('ORIGINAL_STEPS_MISSING');
    const orders = content.steps.map(step => step.order);
    if (orders.some(order => !Number.isSafeInteger(order)) || new Set(orders).size !== orders.length) fail('INVALID_ORIGINAL_STEP_ORDERS');
    report.case = {
      external_id: frozenCase.external_id ?? content.external_id,
      case_id: frozenCase.case_id ?? null,
      case_version: frozenCase.case_version ?? null,
      declared_content_sha256: frozenCase.content_sha256 ?? null,
      input_file_sha256: sha256(rawCase), actual_content_json_sha256: sha256(JSON.stringify(content)),
    };
    await fs.writeFile(path.join(directory, 'original-case.json'), rawCase, { flag: 'wx' });
    sources = await sourceFiles(path.resolve(scriptFile), dependencyDirs.map(p => path.resolve(p)));
    await fs.mkdir(path.join(directory, 'source'));
    for (const [file, bytes] of sources) {
      const snapshot = `source/${String(report.source_snapshot.length + 1).padStart(3, '0')}-${path.basename(file)}`;
      await fs.writeFile(path.join(directory, snapshot), bytes, { flag: 'wx' });
      report.source_snapshot.push({ source: file, file: snapshot, sha256: sha256(bytes) });
    }
    report.steps = content.steps.map(step => ({ ...structuredClone(step), status: 'NOT_RUN', check_ids: [] }));
    page = await attachOriginalPage();
    const ctx = {
      page, frozenCase, screenshot,
      blocked(reason) { const error = new BlockedError(reason); fault(error, 'precondition'); throw error; },
      cleanup(fn) {
        if (typeof fn !== 'function' || executionEnded) fail('INVALID_CLEANUP_REGISTRATION');
        cleanups.push(fn); report.cleanup.registered++;
      },
      check(id, fn) {
        if (!activeStep || executionEnded) fail('CHECK_OUTSIDE_STEP');
        if (typeof id !== 'string' || !id || report.checks.some(check => check.id === id)) fail('INVALID_OR_DUPLICATE_CHECK_ID');
        const current = activeStep;
        const entry = { id, step_order: current.order, status: 'RUNNING', started_at: stamp() };
        report.checks.push(entry); current.check_ids.push(id);
        return track(pendingChecks, (async () => {
          try { if (await fn() === false) throw new RunnerError('CHECK_RETURNED_FALSE'); entry.status = 'PASSED'; }
          catch (error) { entry.status = 'FAILED'; entry.error = safeError(error); throw fault(error, `check:${id}`); }
          finally { entry.finished_at = stamp(); }
        })());
      },
      step(order, fn) {
        if (activeStep || executionEnded) fail('CONCURRENT_OR_LATE_STEP');
        const entry = report.steps.find(step => step.status === 'NOT_RUN');
        if (!entry || entry.order !== order) fail('STEP_ORDER_MISMATCH');
        activeStep = entry; entry.status = 'RUNNING'; entry.started_at = stamp();
        return track(active, (async () => {
          try {
            await fn();
            if (pendingChecks.size) { fault(new RunnerError('CHECK_NOT_AWAITED'), `step:${order}`); await Promise.allSettled([...pendingChecks]); }
            if (!entry.check_ids.length) fail('STEP_HAS_NO_CHECK', `step:${order}`);
            if (report.checks.some(check => check.step_order === order && check.status !== 'PASSED')) {
              const error = new Error('A check in this step failed, even if its exception was caught');
              error.name = 'AssertionError'; throw error;
            }
            entry.status = 'PASSED'; await screenshot(`step-${order}`);
          } catch (error) {
            entry.status = error instanceof BlockedError ? 'BLOCKED' : 'FAILED'; entry.error = safeError(error);
            await screenshot(`step-${order}-failure`).catch(() => {});
            throw fault(error, `step:${order}`);
          } finally { entry.finished_at = stamp(); activeStep = null; }
        })());
      },
      async watchRequests({ urlPattern, methods, probe, probePattern, probeMethods, probeTimeoutMs = 2000 }) {
        if (!validPattern(urlPattern) || !validPattern(probePattern) || typeof probe !== 'function') fail('REQUEST_WATCH_PROBE_REQUIRED');
        if (!Number.isFinite(probeTimeoutMs) || probeTimeoutMs < 1 || probeTimeoutMs > 30000) fail('INVALID_PROBE_TIMEOUT');
        const entry = { channel: 'CDP Network.requestWillBeSent', channel_verified: false, passive: true, events: [], assertions: [] };
        report.request_watches.push(entry);
        let session, stopped = false;
        const normalizeMethods = value => value?.map(method => String(method).toUpperCase());
        const watchMethods = normalizeMethods(methods), expectedProbeMethods = normalizeMethods(probeMethods);
        const isTarget = event => match(urlPattern, event) && (!watchMethods || watchMethods.includes(event.method));
        const onRequest = event => {
          const url = safeUrl(event.request.url);
          if (url === '<invalid-url>') return;
          entry.events.push({ index: entry.events.length, at: stamp(), method: event.request.method.toUpperCase(), url, path: new URL(url).pathname });
        };
        try {
          session = await page.context().newCDPSession(page);
          internalCleanups.push(async () => { stopped = true; session.off('Network.requestWillBeSent', onRequest); await session.detach(); });
          session.on('Network.requestWillBeSent', onRequest);
          await session.send('Network.enable');
          const start = entry.events.length;
          await probe();
          const deadline = Date.now() + probeTimeoutMs;
          const seen = () => entry.events.slice(start).some(event => match(probePattern, event) && (!expectedProbeMethods || expectedProbeMethods.includes(event.method)));
          while (!seen() && Date.now() < deadline) await delay(25);
          if (!seen()) fail('REQUEST_CHANNEL_UNVERIFIED', 'request-probe');
          entry.channel_verified = true;
        } catch (error) { throw fault(error, 'request-watch'); }
        const marks = new WeakSet();
        return Object.freeze({
          mark() {
            if (stopped) fail('REQUEST_WATCH_STOPPED');
            const marker = Object.freeze({ index: entry.events.length, at: stamp() }); marks.add(marker); return marker;
          },
          async assertNoneSince(marker, { observationMs = 300 } = {}) {
            if (!marks.has(marker) || stopped || !entry.channel_verified) fail('INVALID_REQUEST_MARK_OR_CHANNEL');
            if (!Number.isFinite(observationMs) || observationMs < 0 || observationMs > 10000) fail('INVALID_OBSERVATION_WINDOW');
            const assertion = { from: marker.at, observation_ms: observationMs, status: 'RUNNING' };
            entry.assertions.push(assertion);
            const verify = async () => {
              try { await session.send('Runtime.evaluate', { expression: '0', returnByValue: true }); }
              catch (error) { throw fault(new RunnerError('REQUEST_CHANNEL_DISCONNECTED', safeError(error).message), 'request-assertion'); }
              const unexpected = entry.events.slice(marker.index).filter(isTarget);
              assertion.checked_at = stamp(); assertion.count = unexpected.length;
              if (unexpected.length) {
                assertion.status = 'FAILED';
                const error = new Error(`Unexpected request starts: ${unexpected.map(event => `${event.method} ${event.path}`).join(', ')}`);
                error.name = 'AssertionError'; throw fault(error, 'request-assertion');
              }
              assertion.status = 'PASSED';
            };
            // Re-check through the end of execute, catching requests arriving after the initial wait.
            finalNetworkChecks.push(verify);
            await delay(observationMs); await verify();
          },
        });
      },
    };
    await execute(Object.freeze(ctx));
    if (active.size || pendingChecks.size) fault(new RunnerError('EXECUTION_NOT_AWAITED'), 'execute');
    await Promise.allSettled([...active, ...pendingChecks]);
    if (!report.faults.length && report.steps.some(step => step.status !== 'PASSED')) fault(new RunnerError('ORIGINAL_STEPS_INCOMPLETE'), 'completeness');
    if (!report.faults.length && !report.checks.length) fault(new RunnerError('NO_ASSERTIONS'), 'completeness');
  } catch (error) {
    fault(error, 'execute');
    await screenshot('failure').catch(() => {});
  } finally {
    executionEnded = true;
    await Promise.allSettled([...active, ...pendingChecks]);
    for (const verify of finalNetworkChecks) { try { await verify(); } catch {} }
    if (page && !cleanups.length && (!report.faults.length || report.steps.some(step => step.status !== 'NOT_RUN'))) fault(new RunnerError('CLEANUP_NOT_REGISTERED'), 'cleanup');
    for (const cleanup of cleanups.reverse()) {
      report.cleanup.executed++;
      try { if (await cleanup() === false) throw new Error('Cleanup returned false'); report.cleanup.succeeded++; }
      catch (error) { fault(new RunnerError('CLEANUP_FAILED', safeError(error).message), 'cleanup'); await screenshot('cleanup-failure').catch(() => {}); }
    }
    for (const cleanup of internalCleanups.reverse()) {
      try { await cleanup(); } catch (error) { fault(new RunnerError('LISTENER_CLEANUP_FAILED', safeError(error).message), 'cleanup'); }
    }
    if (rawCase) {
      try { if (sha256(await fs.readFile(casePath)) !== sha256(rawCase)) fault(new RunnerError('ORIGINAL_CASE_CHANGED'), 'integrity'); }
      catch (error) { fault(new RunnerError('ORIGINAL_CASE_UNREADABLE', safeError(error).message), 'integrity'); }
    }
    if (sources) {
      try {
        const current = await sourceFiles(path.resolve(scriptFile), dependencyDirs.map(p => path.resolve(p)));
        if (current.size !== sources.size || [...sources].some(([file, bytes]) => !current.has(file) || sha256(current.get(file)) !== sha256(bytes))) fault(new RunnerError('SOURCE_CHANGED_DURING_RUN'), 'integrity');
      } catch (error) { fault(new RunnerError('SOURCE_INTEGRITY_CHECK_FAILED', safeError(error).message), 'integrity'); }
    }
    const first = report.faults.find(item => item.kind === 'RUNNER_ERROR') ?? report.faults.find(item => item.kind !== 'PRECONDITION') ?? report.faults[0];
    report.status = first ? first.kind === 'RUNNER_ERROR' ? 'ERROR' : first.kind === 'PRECONDITION' ? 'BLOCKED' : 'FAILED' : 'PASSED';
    report.failure_kind = first?.kind ?? null;
    report.faults = report.faults.map(({ error, ...item }) => item);
    report.finished_at = stamp();
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  }
  return report;
}
