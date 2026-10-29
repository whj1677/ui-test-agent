import { createHash } from 'node:crypto';
import { assertBackendCaseStages } from './case-stages.mjs';
import { queryFor, validateQueryDefinitions } from './query-contract.mjs';

export const BACKEND_EXECUTION_SCHEMA = 'workbench/backend-execution-v1';
export const BACKEND_RESULT_SCHEMA = 'workbench/backend-result-v1';
export const backendDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const SECRET_KEY = /authorization|cookie|password|passwd|secret|token|api[-_]?key|session|credential/i;
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const fail = code => { throw new Error(code); };
const validId = value => typeof value === 'string' && /^[a-zA-Z][\w-]{0,60}$/.test(value);
const unsafeKey = key => ['__proto__', 'constructor', 'prototype'].includes(key);
const arrayField = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value) && !unsafeKey(value);
const scalar = value => value === null || typeof value === 'string' && value.length <= 1024 && !value.includes('{{') || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean';
const recordFields = value => plain(value) && Object.keys(value).length >= 1 && Object.keys(value).length <= 12 &&
  Object.entries(value).every(([field, expected]) => arrayField(field) && scalar(expected) &&
    (typeof expected !== 'string' || !expected.includes('}}')));
const recordAssertion = assertion => assertion.target === 'json' && !Object.hasOwn(assertion, 'field') &&
  !Object.hasOwn(assertion, 'expected_from') && Object.hasOwn(assertion, 'value') && recordFields(assertion.value);
const nonemptyStringAssertion = assertion => assertion.target === 'json' && !Object.hasOwn(assertion, 'field') &&
  !Object.hasOwn(assertion, 'expected_from') && Object.hasOwn(assertion, 'value') && assertion.value === true;
const RUN_ID_PREFIX = /^[a-z0-9](?:[a-z0-9-]{0,24}[a-z0-9])?$/;
const metadataPointers = new Set(['', '/runId', '/ticket', '/released']);
const exactAssertion = (assertions, target, pointer, value) => assertions.some(assertion => assertion.target === target && assertion.op === 'equals' && !assertion.expected_from && assertion.value === value && (target === 'status' || assertion.pointer === pointer));
function contentTypeAssertion(assertion) {
  if (assertion.target !== 'header') return false;
  if (assertion.pointer !== '/content-type' || assertion.op !== 'media_type_equals' || assertion.value !== 'application/json' || Object.hasOwn(assertion, 'field') || Object.hasOwn(assertion, 'expected_from')) fail('BACKEND_ASSERTION_INVALID');
  return true;
}
const keys = (value, allowed, code) => {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(code);
};
export function readPointer(json, pointer) {
  if (pointer === '') return { exists: true, value: json };
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || /~(?![01])/u.test(pointer)) fail('BACKEND_JSON_POINTER_INVALID');
  let value = json;
  for (const encoded of pointer.slice(1).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    if (unsafeKey(key) || value == null || typeof value !== 'object' || !Object.hasOwn(value, key)) return { exists: false, value: undefined };
    value = value[key];
  }
  return { exists: true, value };
}
function references(value, previous) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\{\{([^{}]+)\}\}/g)) {
      if (match[1] === 'runId') continue;
      const separator = match[1].indexOf(':');
      if (separator < 1 || !previous.has(match[1].slice(0, separator))) fail('BACKEND_REFERENCE_INVALID');
      readPointer({}, match[1].slice(separator + 1));
    }
    if (value.replace(/\{\{[^{}]+\}\}/g, '').includes('{{')) fail('BACKEND_REFERENCE_INVALID');
  } else if (Array.isArray(value)) value.forEach(item => references(item, previous));
  else if (plain(value)) for (const [key, item] of Object.entries(value)) {
    if (unsafeKey(key)) fail('BACKEND_JSON_KEY_INVALID');
    references(item, previous);
  } else if (value !== null && !['number', 'boolean'].includes(typeof value)) fail('BACKEND_JSON_VALUE_INVALID');
}
function assertPath(path) {
  if (typeof path !== 'string' || path.length > 2000 || !path.startsWith('/') || path.startsWith('//') || /[\\#\x00-\x20]/.test(path)) fail('BACKEND_PATH_INVALID');
  const noTemplates = path.replace(/\{\{[^{}]+\}\}/g, 'value');
  let decoded;
  try { decoded = decodeURIComponent(noTemplates.split('?')[0]); } catch { fail('BACKEND_PATH_INVALID'); }
  if (/[\\%]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) fail('BACKEND_PATH_INVALID');
}
export function validateBackendEnvironment(environment) {
  if (!plain(environment) || !validId(environment.id) || environment.non_production !== true || environment.authorized !== true) fail('BACKEND_ENVIRONMENT_NOT_AUTHORIZED');
  let base;
  try { base = new URL(environment.base_url); } catch { fail('BACKEND_ENVIRONMENT_URL_INVALID'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash || base.port === '4322') fail('BACKEND_ENVIRONMENT_URL_INVALID');
  if (!Array.isArray(environment.allowed_path_prefixes) || !environment.allowed_path_prefixes.length || environment.allowed_path_prefixes.some(prefix => typeof prefix !== 'string' || !prefix.startsWith('/') || prefix === '/' || !prefix.endsWith('/') || /[\\%?#{}\x00-\x20]/.test(prefix))) fail('BACKEND_ENVIRONMENT_SCOPE_INVALID');
  if (!Array.isArray(environment.allowed_methods) || !environment.allowed_methods.length || environment.allowed_methods.some(method => !['GET', 'POST', 'DELETE'].includes(method))) fail('BACKEND_ENVIRONMENT_SCOPE_INVALID');
  const mode = environment.mode || (environment.namespace ? 'synthetic-namespace' : null);
  if (!['synthetic-namespace', 'http-json-readonly'].includes(mode)) fail('BACKEND_ENVIRONMENT_MODE_INVALID');
  if (mode === 'http-json-readonly' && environment.namespace && Object.hasOwn(environment.namespace, 'run_id_prefix')) fail('BACKEND_NAMESPACE_PREFIX_INVALID');
  const queries = environment.read_only_post_queries;
  if (mode === 'http-json-readonly' && (environment.namespace || (environment.allowed_headers || []).length ||
    (queries === undefined ? environment.allowed_methods.length !== 1 || environment.allowed_methods[0] !== 'GET' :
      environment.allowed_methods.length !== 2 || environment.allowed_methods[0] !== 'GET' || environment.allowed_methods[1] !== 'POST'))) fail('BACKEND_READONLY_ENVIRONMENT_INVALID');
  if (mode === 'http-json-readonly' && queries !== undefined) validateQueryDefinitions(queries, environment.allowed_path_prefixes);
  if (mode !== 'http-json-readonly' && queries !== undefined) fail('BACKEND_QUERY_CONTRACT_INVALID');
  if (environment.namespace) {
    const ns = environment.namespace;
    keys(ns, ['setup_path', 'resource_prefix', 'cleanup_prefix', 'run_id_prefix'], 'BACKEND_NAMESPACE_INVALID');
    if (Object.hasOwn(ns, 'run_id_prefix') && (typeof ns.run_id_prefix !== 'string' || !RUN_ID_PREFIX.test(ns.run_id_prefix))) fail('BACKEND_NAMESPACE_PREFIX_INVALID');
    for (const value of [ns.setup_path, ns.resource_prefix, ns.cleanup_prefix]) assertPath(value);
    if (!ns.resource_prefix.endsWith('/') || !ns.cleanup_prefix.endsWith('/') || [ns.setup_path, ns.resource_prefix, ns.cleanup_prefix].some(value => /[?{}%]/.test(value))) fail('BACKEND_NAMESPACE_INVALID');
  }
  const names = environment.allowed_headers || [];
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name) || SECRET_KEY.test(name) || ['host', 'connection', 'content-length', 'transfer-encoding', 'referer', 'origin'].includes(name))) fail('BACKEND_HEADERS_INVALID');
  return structuredClone(environment);
}
export function backendUrl(environment, path) {
  assertPath(path);
  const url = new URL(path, environment.base_url);
  // Re-check the normalized path. URL() canonicalizes dot segments before the
  // scope check, so the submitted path itself must also have been safe above.
  assertPath(url.pathname);
  if (url.origin !== new URL(environment.base_url).origin || !environment.allowed_path_prefixes.some(prefix => {
    const root = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    return url.pathname === root || url.pathname.startsWith(root + '/');
  })) fail('BACKEND_TARGET_OUT_OF_SCOPE');
  return url;
}
export function validateBackendExecution({ caseVersion, binding, execution, environment }) {
  validateBackendEnvironment(environment);
  if (!caseVersion || caseVersion.content?.case_type !== 'BACKEND' || caseVersion.content?.status !== 'CONFIRMED' || !caseVersion.content_sha256 || !Array.isArray(caseVersion.content.steps) || !caseVersion.content.steps.length) fail('BACKEND_CONFIRMED_CASE_REQUIRED');
  if (backendDigest(caseVersion.content).toUpperCase() !== caseVersion.content_sha256) fail('BACKEND_CASE_CONTENT_CHANGED');
  if (!binding || binding.status !== 'COMPLETE' || binding.confirmation_status !== 'CONFIRMED' || binding.case_version !== caseVersion.version || binding.case_content_sha256 !== caseVersion.content_sha256 || !binding.binding_id || !Number.isInteger(binding.version) || !binding.protocol_source_id || !binding.protocol_sha256 || binding.applicability === 'STALE_CASE_VERSION') fail('BACKEND_CONFIRMED_BINDING_REQUIRED');
  assertBackendCaseStages({ caseVersion, binding, environment });
  keys(execution, ['schema', 'environment_id', 'setup', 'steps', 'cleanup', 'request_timeout_ms', 'timeout_ms'], 'BACKEND_EXECUTION_INVALID');
  if (execution.schema !== BACKEND_EXECUTION_SCHEMA || execution.environment_id !== environment.id || !Array.isArray(execution.steps) || execution.steps.length !== caseVersion.content.steps.length || execution.steps.length > 30) fail('BACKEND_EXECUTION_INVALID');
  const timeout = execution.request_timeout_ms ?? 10000;
  const total = execution.timeout_ms ?? 120000;
  if (!Number.isInteger(timeout) || timeout < 50 || timeout > 30000 || !Number.isInteger(total) || total < timeout || total > 300000) fail('BACKEND_TIMEOUT_INVALID');
  const setup = execution.setup || [], cleanup = execution.cleanup || [];
  const environmentMode = environment.mode || (environment.namespace ? 'synthetic-namespace' : null);
  if (!Array.isArray(setup) || !Array.isArray(cleanup) || setup.length > 1 || cleanup.length > 1) fail('BACKEND_EXECUTION_INVALID');
  if (environmentMode === 'synthetic-namespace' && Boolean(setup.length) !== Boolean(cleanup.length)) fail('BACKEND_CLEANUP_REQUIRED');
  if (environmentMode === 'http-json-readonly' && (setup.length || cleanup.length)) fail('BACKEND_READONLY_SETUP_CLEANUP_FORBIDDEN');
  if (setup.length && !environment.namespace) fail('BACKEND_NAMESPACE_REQUIRED');
  const previous = new Set(), httpRequests = new Set(); let requestCount = 0;
  function request(request, phase) {
    if (plain(request) && Object.hasOwn(request, 'response_ref')) {
      keys(request, ['id', 'response_ref', 'assertions'], 'BACKEND_REQUEST_INVALID');
      if (phase !== 'step' || !validId(request.id) || previous.has(request.id) || typeof request.response_ref !== 'string' || !httpRequests.has(request.response_ref)) fail('BACKEND_REFERENCE_INVALID');
      if (!Array.isArray(request.assertions) || !request.assertions.length || request.assertions.length > 40) fail('BACKEND_ASSERTIONS_REQUIRED');
      let business = false;
      for (const assertion of request.assertions) {
        keys(assertion, ['target', 'pointer', 'op', 'value', 'expected_from', 'field'], 'BACKEND_ASSERTION_INVALID');
        if (contentTypeAssertion(assertion)) continue;
        if (!['status', 'json'].includes(assertion.target) || !['equals', 'exists', 'length', 'array_some_field_equals', 'array_some_fields_equal', 'string_nonempty'].includes(assertion.op)) fail('BACKEND_ASSERTION_INVALID');
        if (assertion.op === 'array_some_field_equals' ? assertion.target !== 'json' || !arrayField(assertion.field) || Object.hasOwn(assertion, 'expected_from') || !Object.hasOwn(assertion, 'value') || !scalar(assertion.value)
          : assertion.op === 'array_some_fields_equal' ? !recordAssertion(assertion)
            : assertion.op === 'string_nonempty' ? !nonemptyStringAssertion(assertion) : Object.hasOwn(assertion, 'field')) fail('BACKEND_ASSERTION_INVALID');
        if (assertion.target === 'json') {
          readPointer({}, assertion.pointer);
          business ||= assertion.op !== 'exists' && (!metadataPointers.has(assertion.pointer) || environmentMode === 'http-json-readonly' && assertion.pointer === '');
        } else if (assertion.op !== 'equals' || !Number.isInteger(assertion.value) || assertion.value < 100 || assertion.value > 599 || assertion.expected_from) fail('BACKEND_ASSERTION_INVALID');
        if (assertion.expected_from) {
          keys(assertion.expected_from, ['request_id', 'pointer'], 'BACKEND_REFERENCE_INVALID');
          if (!httpRequests.has(assertion.expected_from.request_id) || Object.hasOwn(assertion, 'value') || assertion.op === 'exists') fail('BACKEND_REFERENCE_INVALID');
          readPointer({}, assertion.expected_from.pointer);
        } else if (!Object.hasOwn(assertion, 'value')) fail('BACKEND_ASSERTION_INVALID');
        else references(assertion.value, httpRequests);
        if (assertion.op === 'exists' && typeof assertion.value !== 'boolean') fail('BACKEND_ASSERTION_INVALID');
        if (assertion.op === 'length' && !assertion.expected_from && (!Number.isInteger(assertion.value) || assertion.value < 0)) fail('BACKEND_ASSERTION_INVALID');
      }
      previous.add(request.id); requestCount++;
      return business;
    }
    keys(request, ['id', 'method', 'path', 'json', 'headers', 'assertions'], 'BACKEND_REQUEST_INVALID');
    if (!validId(request.id) || previous.has(request.id) || !environment.allowed_methods.includes(request.method)) fail('BACKEND_REQUEST_INVALID');
    assertPath(request.path); references(request.path, httpRequests);
    backendUrl(environment, request.path.replace(/\{\{[^{}]+\}\}/g, 'value'));
    if (Object.hasOwn(request, 'json')) {
      let encoded; try { encoded = JSON.stringify(request.json); } catch { fail('BACKEND_BODY_INVALID'); }
      if (request.method === 'GET' || environmentMode === 'http-json-readonly' && request.method !== 'POST' || !encoded || encoded.length > 32768) fail('BACKEND_BODY_INVALID');
      if (environmentMode !== 'http-json-readonly') references(request.json, httpRequests);
    }
    if (request.headers) {
      if (!plain(request.headers) || Object.keys(request.headers).length > 10) fail('BACKEND_HEADERS_INVALID');
      for (const [name, value] of Object.entries(request.headers)) {
        if (!(environment.allowed_headers || []).includes(name) || typeof value !== 'string' || /[\r\n]/.test(value) || !(environment.allowed_header_values?.[name] || []).includes(value)) fail('BACKEND_HEADERS_INVALID');
      }
    }
    if (!Array.isArray(request.assertions) || !request.assertions.length || request.assertions.length > 40) fail('BACKEND_ASSERTIONS_REQUIRED');
    let business = false;
    for (const assertion of request.assertions) {
      keys(assertion, ['target', 'pointer', 'op', 'value', 'expected_from', 'field'], 'BACKEND_ASSERTION_INVALID');
      if (contentTypeAssertion(assertion)) continue;
      if (!['status', 'json'].includes(assertion.target) || !['equals', 'exists', 'length', 'array_some_field_equals', 'array_some_fields_equal', 'string_nonempty'].includes(assertion.op)) fail('BACKEND_ASSERTION_INVALID');
      if (assertion.op === 'array_some_field_equals' ? assertion.target !== 'json' || !arrayField(assertion.field) || Object.hasOwn(assertion, 'expected_from') || !Object.hasOwn(assertion, 'value') || !scalar(assertion.value)
        : assertion.op === 'array_some_fields_equal' ? !recordAssertion(assertion)
          : assertion.op === 'string_nonempty' ? !nonemptyStringAssertion(assertion) : Object.hasOwn(assertion, 'field')) fail('BACKEND_ASSERTION_INVALID');
      if (assertion.target === 'json') {
        readPointer({}, assertion.pointer);
        // Transport identity and existence alone cannot establish a business
        // outcome. Semantic correspondence still requires human plan review.
        business ||= assertion.op !== 'exists' && (!metadataPointers.has(assertion.pointer) || environmentMode === 'http-json-readonly' && assertion.pointer === '');
      }
      else if (assertion.op !== 'equals' || !Number.isInteger(assertion.value) || assertion.value < 100 || assertion.value > 599 || assertion.expected_from) fail('BACKEND_ASSERTION_INVALID');
      if (assertion.expected_from) {
        keys(assertion.expected_from, ['request_id', 'pointer'], 'BACKEND_REFERENCE_INVALID');
        if (!httpRequests.has(assertion.expected_from.request_id) || Object.hasOwn(assertion, 'value') || assertion.op === 'exists') fail('BACKEND_REFERENCE_INVALID');
        readPointer({}, assertion.expected_from.pointer);
      } else if (!Object.hasOwn(assertion, 'value')) fail('BACKEND_ASSERTION_INVALID');
      else references(assertion.value, httpRequests);
      if (assertion.op === 'exists' && typeof assertion.value !== 'boolean') fail('BACKEND_ASSERTION_INVALID');
      if (assertion.op === 'length' && !assertion.expected_from && (!Number.isInteger(assertion.value) || assertion.value < 0)) fail('BACKEND_ASSERTION_INVALID');
    }
    if (phase === 'setup') {
      if (request.method !== 'POST' || request.path !== environment.namespace.setup_path || !plain(request.json) || Object.keys(request.json).length !== 1 || request.json.runId !== '{{runId}}' || !business) fail('BACKEND_NAMESPACE_SETUP_INVALID');
      if (!exactAssertion(request.assertions, 'status', null, 201) || !exactAssertion(request.assertions, 'json', '/created', true)) fail('BACKEND_NAMESPACE_SETUP_ASSERTIONS_REQUIRED');
    } else if (phase === 'cleanup') {
      if (request.method !== 'DELETE' || request.path !== environment.namespace.cleanup_prefix + '{{runId}}' || Object.hasOwn(request, 'json') || !business) fail('BACKEND_CLEANUP_SCOPE_INVALID');
      if (!exactAssertion(request.assertions, 'status', null, 200) || !exactAssertion(request.assertions, 'json', '/deleted', true)) fail('BACKEND_NAMESPACE_CLEANUP_ASSERTIONS_REQUIRED');
    } else {
      if (environmentMode === 'http-json-readonly') {
        if (request.method === 'GET') {
          if (Object.hasOwn(request, 'json') || Object.keys(request.headers || {}).length) fail('BACKEND_READONLY_REQUEST_INVALID');
        } else queryFor(environment, binding, request);
      } else if (!['GET', 'POST'].includes(request.method)) fail('BACKEND_METHOD_NOT_SUPPORTED');
      if (setup.length && !request.path.startsWith(environment.namespace.resource_prefix + '{{runId}}/')) fail('BACKEND_NAMESPACE_SCOPE_INVALID');
      if (environmentMode !== 'http-json-readonly' && request.method !== 'GET' && !setup.length) fail('BACKEND_CLEANUP_REQUIRED');
    }
    previous.add(request.id); httpRequests.add(request.id); requestCount += 1;
    return business;
  }
  for (const item of setup) request(item, 'setup');
  for (let index = 0; index < execution.steps.length; index += 1) {
    const step = execution.steps[index];
    keys(step, ['order', 'requests'], 'BACKEND_STEP_INVALID');
    if (step.order !== caseVersion.content.steps[index].order || !Array.isArray(step.requests) || !step.requests.length || step.requests.length > 10) fail('BACKEND_STEP_INVALID');
    let business = false;
    for (const item of step.requests) business = request(item, 'step') || business;
    if (!business) fail('BACKEND_BUSINESS_ASSERTION_REQUIRED');
  }
  for (const item of cleanup) request(item, 'cleanup');
  if (requestCount > 80) fail('BACKEND_REQUEST_LIMIT');
  return { execution: structuredClone({ ...execution, setup, cleanup, request_timeout_ms: timeout, timeout_ms: total }), execution_sha256: backendDigest(execution), environment_identity: backendDigest(environment) };
}
