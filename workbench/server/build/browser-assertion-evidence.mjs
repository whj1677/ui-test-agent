const WRITE_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 1024 * 1024;
const QUIET_MS = 500;
const WAIT_MS = 5000;
const MAX_CONTRACT_BYTES = 32 * 1024;
const SECRET = /(?:password|passwd|secret|token|authorization|cookie|credential|api[_-]?key|session)/i;
const SECRET_VALUE = /(?:password|passwd|secret|token|authorization|cookie|credential|api[_-]?key)\s*[:=]|\bbearer\s+\S+/i;
const PROTOTYPE_KEY = new Set(['__proto__', 'constructor', 'prototype']);

// The observer covers only requests started after installation and until the
// finite quiet window ends. Later browser/background requests remain unproven.

function fail(message) { throw new Error(`BROWSER_ASSERTION_CONTRACT_INVALID: ${message}`); }
function originOf(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('HTTP_ORIGIN_REQUIRED');
    return url.origin;
  } catch { fail('HTTP_ORIGIN_REQUIRED'); }
}
function exactPath(value) {
  if (typeof value !== 'string' || value.length > 512 || !/^\/(?!\/)[\x21-\x7e]*$/.test(value) || /[?#%*{}<>\\]/.test(value) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) fail('EXACT_PATH_REQUIRED');
  return value;
}
function pathsOf(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 20) fail('PATHS_REQUIRED');
  const result = paths.map(exactPath);
  if (new Set(result).size !== result.length) fail('DUPLICATE_PATH');
  return result;
}
function methodsOf(methods = WRITE_METHODS) {
  if (!Array.isArray(methods) || !methods.length || methods.length > 4 || methods.some(m => !WRITE_METHODS.includes(m)) || new Set(methods).size !== methods.length) fail('WRITE_METHODS_REQUIRED');
  return [...methods];
}
function pointerOf(value) {
  if (typeof value !== 'string' || value.length > 512 || !/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/.test(value) || SECRET.test(value) ||
    value.slice(1).split('/').map(x => x.replaceAll('~1', '/').replaceAll('~0', '~')).some(x => PROTOTYPE_KEY.has(x))) fail('SAFE_POINTER_REQUIRED');
  return value;
}
function scalar(value) { return value === null || ['string', 'number', 'boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value)) && (typeof value !== 'string' || value.length <= 256); }
function compact(value) {
  if (typeof value !== 'string') return value;
  if (SECRET_VALUE.test(value)) return '<redacted-sensitive-value>';
  return value.length > 120 ? `${value.slice(0, 120)}…` : value;
}
function contractValue(value) {
  if (typeof value === 'string' && SECRET_VALUE.test(value)) fail('SENSITIVE_CONTRACT_VALUE');
  return value;
}
function boundedContract(value) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_CONTRACT_BYTES) fail('CONTRACT_TOO_LARGE');
  return value;
}
function projected(item, fields) { return Object.fromEntries(fields.map(field => [field, compact(item[field])])); }
function readPointer(object, pointer) {
  let current = object;
  for (const part of pointer.slice(1).split('/').map(x => x.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) return { found: false };
    current = current[part];
  }
  return { found: true, value: current };
}
function identityOf(identity) {
  if (identity == null) return Object.freeze({});
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) fail('IDENTITY_INVALID');
  const allowed = ['task_id', 'run_id', 'candidate_sha256', 'candidate_bundle_sha256', 'executed_case_id', 'executed_case_version', 'executed_external_id', 'executed_content_sha256', 'case_sha256', 'step_order'];
  if (Object.keys(identity).some(key => !allowed.includes(key) || SECRET.test(key))) fail('IDENTITY_INVALID');
  const output = {};
  for (const [key, value] of Object.entries(identity)) {
    if (typeof value !== 'string' && !Number.isSafeInteger(value) || typeof value === 'string' && value.length > 256) fail('IDENTITY_INVALID');
    output[key] = value;
  }
  return Object.freeze(output);
}
function businessStatusOf(status) {
  if (!status || typeof status !== 'object' || Object.keys(status).some(k => !['pointer', 'success', 'failure'].includes(k))) fail('BUSINESS_STATUS_REQUIRED');
  const pointer = pointerOf(status.pointer);
  const success = status.success, failure = status.failure;
  if (!Array.isArray(success) || !success.length || !Array.isArray(failure) || !failure.length ||
    [...success, ...failure].some(v => !scalar(v)) ||
    [...success, ...failure].some(v => typeof v !== typeof success[0]) ||
    new Set([...success, ...failure].map(v => JSON.stringify(v))).size !== success.length + failure.length) fail('BUSINESS_VALUES_INVALID');
  return { pointer, success: success.map(contractValue), failure: failure.map(contractValue) };
}
function jsonContractOf(options) {
  if (!options || options.method !== 'GET') fail('GET_REQUIRED');
  const path = exactPath(options.path);
  const equals = options.equals ?? [], arrays = options.arrays ?? [];
  if (!Array.isArray(equals) || !Array.isArray(arrays) || equals.length + arrays.length === 0 || equals.length + arrays.length > 20) fail('JSON_CHECKS_REQUIRED');
  const eq = equals.map(row => {
    if (!row || typeof row !== 'object' || !scalar(row.value)) fail('SCALAR_EXPECTED');
    return { pointer: pointerOf(row.pointer), value: contractValue(row.value) };
  });
  const ar = arrays.map(row => {
    const pointer = pointerOf(row?.pointer), fields = row?.fields, items = row?.items;
    if (!Array.isArray(fields) || !fields.length || fields.length > 12 || fields.some(f => typeof f !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(f) || SECRET.test(f)) || new Set(fields).size !== fields.length || !Array.isArray(items) || items.length > 100) fail('ARRAY_CONTRACT_INVALID');
    const expectedItems = items.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).length !== fields.length || fields.some(f => !Object.hasOwn(item, f) || !scalar(item[f]))) fail('ARRAY_ITEM_INVALID');
      return Object.fromEntries(fields.map(f => [f, contractValue(item[f])]));
    });
    return { pointer, fields: [...fields], items: expectedItems };
  });
  return { path, equals: eq, arrays: ar };
}
function tuple(item, fields) { return JSON.stringify(fields.map(field => item[field])); }
function arrayComparison(actual, expected, fields) {
  const expectedProjection = expected.slice(0, 12).map(item => projected(item, fields));
  if (!Array.isArray(actual)) return { matches: false, actual_count: null, expected_count: expected.length, expected_items: expectedProjection, actual_diff: [] };
  const counts = new Map();
  for (const item of expected) counts.set(tuple(item, fields), (counts.get(tuple(item, fields)) || 0) + 1);
  let valid = actual.length === expected.length;
  const actualDiff = [];
  for (const item of actual) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || fields.some(f => !Object.hasOwn(item, f) || !scalar(item[f]))) { valid = false; if (actualDiff.length < 12) actualDiff.push('<invalid-item>'); continue; }
    const key = tuple(item, fields), count = counts.get(key) || 0;
    if (!count) { valid = false; if (actualDiff.length < 12) actualDiff.push(projected(item, fields)); }
    else counts.set(key, count - 1);
  }
  if ([...counts.values()].some(count => count !== 0)) valid = false;
  const missing = [];
  for (const item of expected) {
    const key = tuple(item, fields), count = counts.get(key) || 0;
    if (count > 0) { if (missing.length < 12) missing.push(projected(item, fields)); counts.set(key, count - 1); }
  }
  return { matches: valid, actual_count: actual.length, expected_count: expected.length, expected_items: expectedProjection, actual_diff: actualDiff, missing_items: missing };
}

function observe(page, origin, paths, methods) {
  const selected = new Set(paths), allowed = new Set(methods), entries = new Map();
  let lastEvent = Date.now(), overflow = false, scopeViolation = false;
  const isTarget = request => {
    try {
      const url = new URL(request.url());
      if (!selected.has(url.pathname) || !allowed.has(request.method())) return false;
      if (url.origin !== origin) { scopeViolation = true; lastEvent = Date.now(); return false; }
      return true;
    } catch { scopeViolation = true; lastEvent = Date.now(); return false; }
  };
  const onRequest = request => {
    if (!isTarget(request)) return;
    lastEvent = Date.now();
    if (entries.size >= MAX_REQUESTS) { overflow = true; return; }
    entries.set(request, { method: request.method(), path: new URL(request.url()).pathname, finished: false, response: null, body: null, body_error: null, body_pending: false, failed: false });
  };
  const onResponse = response => {
    const entry = entries.get(response.request());
    if (!entry) return;
    lastEvent = Date.now();
    if (entry.response) { entry.body_error = 'DUPLICATE_RESPONSE'; return; }
    entry.response = { http_status: response.status() };
    entry.body_pending = true;
    Promise.resolve().then(() => response.body()).then(bytes => {
      if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
      if (bytes.length > MAX_BODY_BYTES) { entry.body_error = 'BODY_TOO_LARGE'; return; }
      try { entry.body = JSON.parse(bytes.toString('utf8')); }
      catch { entry.body_error = 'BODY_JSON_INVALID'; }
    }).catch(() => { entry.body_error = 'BODY_UNAVAILABLE'; }).finally(() => { entry.body_pending = false; lastEvent = Date.now(); });
  };
  const onFinished = request => { const entry = entries.get(request); if (entry) { entry.finished = true; lastEvent = Date.now(); } };
  const onFailed = request => { const entry = entries.get(request); if (entry) { entry.failed = true; lastEvent = Date.now(); } };
  page.on('request', onRequest); page.on('response', onResponse); page.on('requestfinished', onFinished); page.on('requestfailed', onFailed);
  return {
    entries, get overflow() { return overflow; }, get scopeViolation() { return scopeViolation; }, get lastEvent() { return lastEvent; },
    stop() { page.off('request', onRequest); page.off('response', onResponse); page.off('requestfinished', onFinished); page.off('requestfailed', onFailed); },
  };
}
async function settle(observation) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (Date.now() - observation.lastEvent >= QUIET_MS && [...observation.entries.values()].every(e => e.finished && !e.body_pending)) return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return false;
}

export function installBrowserAssertionEvidence({ page, allowedOrigin, identity, record, getStep } = {}) {
  if (!page || typeof page.on !== 'function' || typeof page.off !== 'function' || typeof page.url !== 'function' || typeof record !== 'function') fail('PAGE_AND_RECORD_REQUIRED');
  if (getStep !== undefined && typeof getStep !== 'function') fail('STEP_GETTER_INVALID');
  if (Object.hasOwn(page, 'testEvidence')) fail('ALREADY_INSTALLED');
  let origin = allowedOrigin ? originOf(allowedOrigin) : null;
  if (allowedOrigin && allowedOrigin !== origin) fail('EXACT_ORIGIN_REQUIRED');
  const boundIdentity = identityOf(identity);
  const currentStep = () => {
    const step = getStep?.() ?? null;
    if (step !== null && (!Number.isSafeInteger(step) || step < 1)) fail('STEP_GETTER_INVALID');
    return step;
  };
  async function execute(kind, paths, methods, action, judge, contract, expectedBase = null) {
    if (typeof action !== 'function') fail('ACTION_REQUIRED');
    const startStep = currentStep();
    origin ??= originOf(page.url());
    const observation = observe(page, origin, paths, methods);
    let actionError = null, settled = false;
    try { await action(); settled = await settle(observation); }
    catch (error) { actionError = error; }
    finally { observation.stop(); }
    let pageScopeViolation = false;
    try { pageScopeViolation = originOf(page.url()) !== origin; }
    catch { pageScopeViolation = true; }
    const entries = [...observation.entries.values()];
    const common = { kind, paths: [...paths], methods: [...methods], identity: boundIdentity, step_order: startStep, contract, request_count: entries.length, ...(expectedBase ? { expected: expectedBase } : {}) };
    let result;
    if (actionError) result = { status: 'UNKNOWN', reason: 'ACTION_ERROR' };
    else if (currentStep() !== startStep) result = { status: 'UNKNOWN', reason: 'STEP_CHANGED_DURING_ASSERTION' };
    else if (observation.scopeViolation || pageScopeViolation || observation.overflow || !settled) result = { status: 'UNKNOWN', reason: observation.scopeViolation || pageScopeViolation ? 'SCOPE_VIOLATION' : observation.overflow ? 'REQUEST_LIMIT' : 'INCOMPLETE_OR_LATE_REQUEST' };
    else result = judge(entries);
    try { await record({ ...common, ...result }); }
    catch (recordError) { if (!actionError) throw recordError; }
    if (actionError) throw actionError;
    if (result.status !== 'PASSED') throw new Error(`BROWSER_ASSERTION_${result.status}: ${result.reason || kind}`);
    return result;
  }
  const api = Object.freeze({
    expectNoWrites(options, action) {
      const paths = pathsOf(options?.paths), methods = methodsOf(options?.methods);
      const contract = boundedContract({ paths: [...paths], methods: [...methods] });
      return execute('no_writes', paths, methods, action, entries => entries.length ? { status: 'FAILED', reason: 'WRITE_REQUEST_OBSERVED', expected: { request_count: 0 }, actual: { request_count: entries.length } } : { status: 'PASSED', expected: { request_count: 0 }, actual: { request_count: 0 } }, contract, { request_count: 0 });
    },
    expectNoSuccessfulWrites(options, action) {
      const paths = pathsOf(options?.paths), methods = methodsOf(options?.methods), status = businessStatusOf(options?.business_status);
      const contract = boundedContract({ paths: [...paths], methods: [...methods], business_status: { pointer: status.pointer, success: [...status.success], failure: [...status.failure] } });
      const expected = { success_count: 0, business_status: { pointer: status.pointer, success: status.success.map(compact), failure: status.failure.map(compact) } };
      return execute('no_successful_writes', paths, methods, action, entries => {
        let unknown = false, successes = 0, failures = 0;
        for (const entry of entries) {
          if (entry.failed || !entry.response || entry.body_error || !entry.finished) { unknown = true; continue; }
          const code = readPointer(entry.body, status.pointer);
          if (!code.found || typeof code.value !== typeof status.success[0]) { unknown = true; continue; }
          if (entry.response.http_status === 200 && status.success.includes(code.value)) successes++;
          else if (entry.response.http_status === 200 && status.failure.includes(code.value)) failures++;
          else unknown = true;
        }
        const actual = { request_count: entries.length, success_count: successes, failure_count: failures, unknown_count: entries.length - successes - failures };
        if (successes) return { status: 'FAILED', reason: 'SUCCESSFUL_WRITE_OBSERVED', expected, actual };
        if (unknown) return { status: 'UNKNOWN', reason: 'WRITE_OUTCOME_UNKNOWN', expected, actual };
        return { status: 'PASSED', expected, actual };
      }, contract, expected);
    },
    expectJsonResponse(options, action) {
      const expectedJson = jsonContractOf(options);
      const contract = boundedContract({ method: 'GET', path: expectedJson.path, equals: expectedJson.equals.map(row => ({ ...row })), arrays: expectedJson.arrays.map(row => ({ pointer: row.pointer, fields: [...row.fields], items: row.items.map(item => ({ ...item })) })) });
      return execute('json_response', [expectedJson.path], ['GET'], action, entries => {
        if (entries.length !== 1) return { status: 'FAILED', reason: 'EXPECTED_ONE_FRESH_RESPONSE', actual: { response_count: entries.length } };
        const entry = entries[0];
        if (entry.failed || !entry.response || entry.body_error || !entry.finished) return { status: 'UNKNOWN', reason: 'RESPONSE_UNAVAILABLE' };
        if (entry.response.http_status !== 200) return { status: 'FAILED', reason: 'HTTP_STATUS_MISMATCH', actual: { http_status: entry.response.http_status }, expected: { http_status: 200 } };
        const checks = [];
        for (const row of expectedJson.equals) {
          const actual = readPointer(entry.body, row.pointer);
          checks.push({ pointer: row.pointer, expected: compact(row.value), actual: actual.found && scalar(actual.value) ? compact(actual.value) : '<missing-or-nonscalar>', matches: actual.found && Object.is(actual.value, row.value) });
        }
        for (const row of expectedJson.arrays) {
          const actual = readPointer(entry.body, row.pointer);
          checks.push({ pointer: row.pointer, fields: row.fields, ...arrayComparison(actual.value, row.items, row.fields) });
        }
        return { status: checks.every(row => row.matches) ? 'PASSED' : 'FAILED', reason: checks.every(row => row.matches) ? undefined : 'JSON_ASSERTION_MISMATCH', actual: { checks } };
      }, contract, { response_count: 1, http_status: 200 });
    },
    async decimalText(text, { unit } = {}) {
      const startStep = currentStep();
      if (typeof unit !== 'string' || !unit || SECRET.test(unit)) fail('UNIT_REQUIRED');
      if (typeof text !== 'string') fail('DECIMAL_TEXT_REQUIRED');
      const contract = boundedContract({ unit: contractValue(unit) });
      // An unawaited call can outlive its CASE_STEP; yield once before verdict.
      await new Promise(resolve => setImmediate(resolve));
      if (currentStep() !== startStep) {
        await record({ kind: 'decimal_text', identity: boundIdentity, step_order: startStep, contract, status: 'UNKNOWN', reason: 'STEP_CHANGED_DURING_ASSERTION', expected: { unit: compact(unit) } });
        throw new Error('BROWSER_ASSERTION_UNKNOWN: STEP_CHANGED_DURING_ASSERTION');
      }
      const escape = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = new RegExp(`^\\s*([+-]?(?:0|[1-9]\\d*)(?:\\.\\d+)?)\\s*${escape}\\s*$`).exec(text);
      const number = match ? Number(match[1]) : NaN;
      if (!match || !Number.isFinite(number)) {
        await record({ kind: 'decimal_text', identity: boundIdentity, step_order: startStep, contract, status: 'FAILED', reason: 'DECIMAL_TEXT_INVALID', expected: { unit: compact(unit) }, actual: { valid: false } });
        throw new Error('BROWSER_ASSERTION_FAILED: DECIMAL_TEXT_INVALID');
      }
      await record({ kind: 'decimal_text', identity: boundIdentity, step_order: startStep, contract, status: 'PASSED', expected: { unit: compact(unit) }, actual: { value: match[1] } });
      return match[1];
    },
  });
  Object.defineProperty(page, 'testEvidence', { value: api, writable: false, configurable: false, enumerable: false });
  return api;
}
