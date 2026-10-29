import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { BACKEND_RESULT_SCHEMA, SECRET_KEY, backendUrl, readPointer, validateBackendExecution } from './schema.mjs';
import { queryFor } from './query-contract.mjs';
export { BACKEND_EXECUTION_SCHEMA, validateBackendEnvironment, validateBackendExecution, backendDigest } from './schema.mjs';

const now = () => new Date().toISOString();
const knownCodes = new Set(['BACKEND_CANCELLED', 'BACKEND_TIMEOUT', 'BACKEND_RESPONSE_TOO_LARGE', 'BACKEND_RESPONSE_JSON_INVALID', 'BACKEND_REDIRECT_REFUSED', 'BACKEND_REFERENCE_UNAVAILABLE', 'BACKEND_NAMESPACE_ID_MISMATCH', 'BACKEND_NETWORK_ERROR']);
function redactor() {
  const secrets = new Set();
  const find = (value, depth = 0) => {
    if (depth > 30 || !value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY.test(key) && typeof item === 'string' && item) secrets.add(item);
      find(item, depth + 1);
    }
  };
  const text = value => {
    let result = value;
    for (const secret of [...secrets].sort((a, b) => b.length - a.length)) result = result.replaceAll(secret, '[REDACTED]');
    return result.replace(/\bBearer\s+[A-Za-z0-9_.~+/-]+=*/gi, 'Bearer [REDACTED]');
  };
  const clean = (value, key = '', depth = 0) => {
    if (SECRET_KEY.test(key)) return '[REDACTED]';
    if (depth > 30) return '[DEPTH_LIMIT]';
    if (typeof value === 'string') return text(value);
    if (Array.isArray(value)) return value.map(item => clean(item, '', depth + 1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, clean(item, name, depth + 1)]));
    return value;
  };
  return { find, clean };
}
function resolveTemplate(value, responses, runId, path = false) {
  const get = token => {
    if (token === 'runId') return runId;
    const separator = token.indexOf(':');
    const response = responses.get(token.slice(0, separator));
    const resolved = readPointer(response?.json, token.slice(separator + 1));
    if (!response || !resolved.exists) throw new Error('BACKEND_REFERENCE_UNAVAILABLE');
    return resolved.value;
  };
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{([^{}]+)\}\}$/);
    if (exact && !path) return structuredClone(get(exact[1]));
    return value.replace(/\{\{([^{}]+)\}\}/g, (_, token) => {
      const item = get(token);
      if (!['string', 'number', 'boolean'].includes(typeof item)) throw new Error('BACKEND_REFERENCE_UNAVAILABLE');
      return path ? encodeURIComponent(String(item)) : String(item);
    });
  }
  if (Array.isArray(value)) return value.map(item => resolveTemplate(item, responses, runId));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTemplate(item, responses, runId)]));
  return value;
}
async function readJsonResponse(response, limit = 131072) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('BACKEND_RESPONSE_TOO_LARGE'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('BACKEND_RESPONSE_JSON_INVALID');
  const parts = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('BACKEND_RESPONSE_TOO_LARGE'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw new Error('BACKEND_RESPONSE_JSON_INVALID'); }
}
function contentTypeMatchesJson(value) {
  if (typeof value !== 'string') return false;
  // Match only the media type plus at most one well-formed charset parameter.
  // JSON parsing below stays independent of this protocol assertion.
  const token = "[A-Za-z0-9!#$%&'*+.^_`|~-]+";
  const pattern = new RegExp(`^[ \\t]*application/json(?:[ \\t]*;[ \\t]*charset[ \\t]*=[ \\t]*(?:${token}|"${token}"))?[ \\t]*$`, 'i');
  return pattern.test(value);
}
function assertionsFor(specs, response, responses, runId) {
  return specs.map(spec => {
    if (spec.target === 'header') {
      const actual = response.headers?.['content-type'] ?? null;
      return { target: spec.target, pointer: spec.pointer, op: spec.op, expected: spec.value, actual,
        actual_exists: actual !== null, status: contentTypeMatchesJson(actual) ? 'PASSED' : 'FAILED' };
    }
    const observed = spec.target === 'status' ? { exists: true, value: response.status } : readPointer(response.json, spec.pointer);
    let expected;
    if (spec.expected_from) {
      const prior = responses.get(spec.expected_from.request_id);
      const found = readPointer(prior?.json, spec.expected_from.pointer);
      if (!prior || !found.exists) throw new Error('BACKEND_REFERENCE_UNAVAILABLE');
      expected = found.value;
    } else expected = resolveTemplate(spec.value, responses, runId);
    const measured = spec.op === 'length' ? (Array.isArray(observed.value) || typeof observed.value === 'string' ? observed.value.length : undefined) : spec.op === 'exists' ? observed.exists : observed.value;
    const passed = spec.op === 'string_nonempty'
      ? observed.exists && typeof observed.value === 'string' && observed.value.trim().length > 0
      : spec.op === 'array_some_fields_equal'
      ? observed.exists && Array.isArray(observed.value) && observed.value.some(item => item !== null && typeof item === 'object' && !Array.isArray(item) &&
        Object.entries(expected).every(([field, value]) => Object.hasOwn(item, field) && isDeepStrictEqual(item[field], value)))
      : spec.op === 'array_some_field_equals'
      ? observed.exists && Array.isArray(observed.value) && observed.value.some(item => item !== null && typeof item === 'object' && !Array.isArray(item) && Object.hasOwn(item, spec.field) && isDeepStrictEqual(item[spec.field], expected))
      : spec.op === 'exists' ? measured === expected : observed.exists && isDeepStrictEqual(measured, expected);
    return { target: spec.target, pointer: spec.pointer ?? null, op: spec.op, ...(spec.op === 'array_some_field_equals' ? { field: spec.field } : {}), expected, actual: measured ?? null, actual_exists: observed.exists, status: passed ? 'PASSED' : 'FAILED' };
  });
}

// This adapter has no filesystem, shell, model, credential-loading, redirect or retry capability.
export async function executeBackendCase({ caseVersion, binding, execution, environment, signal, onEvidence = async () => {} }) {
  const checked = validateBackendExecution({ caseVersion, binding, execution, environment });
  const plan = checked.execution;
  const runId = `${environment.namespace?.run_id_prefix ?? 'backend-run'}-${randomUUID()}`;
  const responses = new Map(), redact = redactor();
  redact.find(plan);
  const overall = AbortSignal.timeout(plan.timeout_ms);
  const outer = signal ? AbortSignal.any([signal, overall]) : overall;
  const result = {
    schema: BACKEND_RESULT_SCHEMA, runner_kind: 'HTTP_JSON', run_id: runId,
    case_version: caseVersion.version, case_content_sha256: caseVersion.content_sha256,
    binding_id: binding.binding_id, binding_version: binding.version, protocol_source_id: binding.protocol_source_id, protocol_sha256: binding.protocol_sha256,
    execution_sha256: checked.execution_sha256, environment_id: environment.id, environment_identity: checked.environment_identity,
    started_at: now(), finished_at: null, execution_status: 'RUNNING', status: 'RUNNING', complete_pass: false,
    model_calls: 0, requests_sent: 0, request_count_semantics: 'HTTP_DISPATCH_ATTEMPTS', setup: [], steps: [], cleanup: [], technical_error: null,
  };
  const emit = async event => { await onEvidence(redact.clean({ run_id: runId, ...event })); };
  let setupAttempted = false, namespaceAlreadyExisted = false, aborted = false, timedOut = false, transportFailed = false;
  async function request(spec, phase) {
    if (Object.hasOwn(spec, 'response_ref')) {
      const record = { request_id: spec.id, phase, started_at: now(), finished_at: null, status: 'RUNNING',
        request: { kind: 'response-reference', source_request_id: spec.response_ref }, response: null, assertions: [], error: null };
      try {
        await emit({ type: 'request-started', phase, request_id: spec.id, request: record.request });
        if (phase !== 'step') throw new Error('BACKEND_REFERENCE_UNAVAILABLE');
        if (outer.aborted) throw new Error(signal?.aborted ? 'BACKEND_CANCELLED' : 'BACKEND_TIMEOUT');
        const source = responses.get(spec.response_ref);
        if (!source) throw new Error('BACKEND_REFERENCE_UNAVAILABLE');
        const observed = { status: source.status, json: structuredClone(source.json), headers: structuredClone(source.headers) };
        record.response = structuredClone(observed);
        record.assertions = assertionsFor(spec.assertions, observed, responses, runId);
        record.status = record.assertions.every(item => item.status === 'PASSED') ? 'PASSED' : 'FAILED';
      } catch (error) {
        const code = phase !== 'cleanup' && signal?.aborted ? 'BACKEND_CANCELLED'
          : outer.aborted ? signal?.aborted ? 'BACKEND_CANCELLED' : 'BACKEND_TIMEOUT'
          : knownCodes.has(error.message) ? error.message
          : /^BACKEND_[A-Z0-9_]+$/.test(error.message) ? error.message : 'BACKEND_NETWORK_ERROR';
        record.error = { code };
        record.status = code === 'BACKEND_CANCELLED' ? 'CANCELLED' : code === 'BACKEND_TIMEOUT' ? 'TIMED_OUT' : 'ERROR';
        aborted ||= code === 'BACKEND_CANCELLED'; timedOut ||= code === 'BACKEND_TIMEOUT'; transportFailed ||= code !== 'BACKEND_CANCELLED' && code !== 'BACKEND_TIMEOUT';
        if (record.status === 'ERROR') result.technical_error ||= { code };
      }
      record.finished_at = now();
      const clean = redact.clean(record);
      await emit({ type: 'request-finished', phase, request_id: spec.id, record: clean });
      return clean;
    }
    const record = { request_id: spec.id, phase, started_at: now(), finished_at: null, status: 'RUNNING', request: null, response: null, assertions: [], error: null };
    const deadline = AbortSignal.timeout(plan.request_timeout_ms);
    const requestSignal = phase === 'cleanup' ? deadline : AbortSignal.any([outer, deadline]);
    try {
      if (phase !== 'cleanup' && outer.aborted) throw new Error(signal?.aborted ? 'BACKEND_CANCELLED' : 'BACKEND_TIMEOUT');
      const requestPath = resolveTemplate(spec.path, responses, runId, true);
      const url = backendUrl(environment, requestPath);
      const json = Object.hasOwn(spec, 'json') ? resolveTemplate(spec.json, responses, runId) : undefined;
      if (environment.mode === 'http-json-readonly' && spec.method === 'POST') queryFor(environment, binding, { method: spec.method, path: requestPath, json, headers: spec.headers });
      const headers = { accept: 'application/json', ...(json === undefined ? {} : { 'content-type': 'application/json' }), ...(spec.headers || {}) };
      const query = Object.fromEntries(url.searchParams.entries()); redact.find(query); redact.find(json);
      for (const [key] of url.searchParams) if (SECRET_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
      record.request = { method: spec.method, url: url.href, headers, ...(json === undefined ? {} : { json }) };
      await emit({ type: 'request-started', phase, request_id: spec.id, request: record.request });
      if (phase === 'setup') setupAttempted = true;
      result.requests_sent += 1;
      const response = await fetch(backendUrl(environment, requestPath), { method: spec.method, headers, ...(json === undefined ? {} : { body: JSON.stringify(json) }), signal: requestSignal, redirect: 'manual' });
      record.response = { status: response.status, headers: { 'content-type': response.headers.get('content-type') } };
      if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new Error('BACKEND_REDIRECT_REFUSED'); }
      const responseJson = await readJsonResponse(response);
      redact.find(responseJson);
      record.response.json = responseJson;
      if (phase === 'setup' && response.status === 200 && responseJson?.runId === runId && responseJson.created === false) namespaceAlreadyExisted = true;
      if (plan.setup.length && responseJson?.runId !== runId) throw new Error('BACKEND_NAMESPACE_ID_MISMATCH');
      const value = { status: response.status, json: responseJson, headers: { 'content-type': record.response.headers['content-type'] } };
      record.assertions = assertionsFor(spec.assertions, value, responses, runId);
      responses.set(spec.id, value);
      record.status = record.assertions.every(item => item.status === 'PASSED') ? 'PASSED' : 'FAILED';
    } catch (error) {
      const code = phase !== 'cleanup' && signal?.aborted ? 'BACKEND_CANCELLED'
        : requestSignal.aborted ? 'BACKEND_TIMEOUT' : knownCodes.has(error.message) ? error.message
        : /^BACKEND_[A-Z0-9_]+$/.test(error.message) ? error.message : 'BACKEND_NETWORK_ERROR';
      record.error = { code };
      record.status = code === 'BACKEND_CANCELLED' ? 'CANCELLED' : code === 'BACKEND_TIMEOUT' ? 'TIMED_OUT' : 'ERROR';
      if (phase !== 'cleanup') {
        aborted ||= code === 'BACKEND_CANCELLED'; timedOut ||= code === 'BACKEND_TIMEOUT'; transportFailed = true;
        result.technical_error ||= { code };
      }
    }
    record.finished_at = now();
    const clean = redact.clean(record);
    await emit({ type: 'request-finished', phase, request_id: spec.id, record: clean });
    return clean;
  }
  let stop = false;
  try {
    for (const spec of plan.setup) {
      const record = await request(spec, 'setup'); result.setup.push(record);
      if (record.status !== 'PASSED') { stop = true; break; }
    }
    for (let index = 0; index < plan.steps.length; index += 1) {
      const step = plan.steps[index], original = caseVersion.content.steps[index];
      const item = { order: step.order, action: original.action, expected: original.expected, status: 'NOT_RUN', started_at: null, finished_at: null, requests: [] };
      result.steps.push(item);
      if (stop || outer.aborted) {
        if (outer.aborted) { aborted ||= Boolean(signal?.aborted); timedOut ||= !signal?.aborted; result.technical_error ||= { code: signal?.aborted ? 'BACKEND_CANCELLED' : 'BACKEND_TIMEOUT' }; }
        continue;
      }
      item.started_at = now();
      for (const spec of step.requests) {
        const record = await request(spec, 'step'); item.requests.push(record);
        if (record.status !== 'PASSED') { stop = true; break; }
      }
      item.status = item.requests.every(record => record.status === 'PASSED') && item.requests.length === step.requests.length ? 'PASSED'
        : item.requests.at(-1)?.status || 'NOT_RUN';
      item.finished_at = now();
      await emit({ type: 'step-finished', step: item });
    }
  } finally {
    // Even an aborted initialization may have created its unique namespace. Cleanup
    // uses this invocation's generated ID only and is never retried or broadened.
    if (setupAttempted && !namespaceAlreadyExisted) for (const spec of plan.cleanup) result.cleanup.push(await request(spec, 'cleanup'));
  }
  const cleanupFailed = result.cleanup.some(item => item.status !== 'PASSED');
  if (cleanupFailed) result.cleanup_error = { code: 'BACKEND_CLEANUP_FAILED', manual_recovery_required: true, namespace_id: runId };
  if (signal?.aborted) { aborted = true; result.technical_error ||= { code: 'BACKEND_CANCELLED' }; }
  result.execution_status = aborted ? 'CANCELLED' : 'FINISHED';
  result.status = aborted ? 'CANCELLED' : timedOut ? 'TIMED_OUT' : transportFailed ? 'ERROR'
    : cleanupFailed || result.setup.some(item => item.status !== 'PASSED') || result.steps.some(item => item.status !== 'PASSED') ? 'FAILED' : 'PASSED';
  result.complete_pass = result.status === 'PASSED' && result.steps.length === plan.steps.length;
  result.finished_at = now();
  const cleanResult = redact.clean(result);
  await emit({ type: 'finished', result: cleanResult });
  return cleanResult;
}
