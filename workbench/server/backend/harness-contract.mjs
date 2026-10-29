// Model-visible syntax only. The existing validator remains authoritative for
// case identity, cross-request references, environment scope and business gates.
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const reference = object({ request_id: { type: 'string' }, pointer: { type: 'string' } }, ['request_id', 'pointer']);
const assertion = object({ target: { type: 'string', enum: ['status', 'json', 'header'] }, pointer: { type: 'string' },
  op: { type: 'string', enum: ['equals', 'exists', 'length', 'array_some_field_equals', 'array_some_fields_equal', 'string_nonempty', 'media_type_equals'] },
  value: {}, expected_from: reference, field: { type: 'string' } }, ['target', 'op']);
const request = object({ id: { type: 'string', pattern: '^[a-zA-Z][\\w-]{0,60}$' },
  method: { type: 'string', enum: ['GET', 'POST', 'DELETE'] }, path: { type: 'string' },
  headers: { type: 'object', additionalProperties: { type: 'string' } }, json: {}, response_ref: { type: 'string' },
  assertions: { type: 'array', minItems: 1, maxItems: 40, items: assertion } }, ['id', 'assertions']);
export const BACKEND_EXECUTION_INPUT_SCHEMA = object({ schema: { type: 'string', enum: ['workbench/backend-execution-v1'] },
  environment_id: { type: 'string' }, setup: { type: 'array', maxItems: 1, items: request },
  steps: { type: 'array', minItems: 1, maxItems: 30, items: object({ order: { type: 'integer' },
    requests: { type: 'array', minItems: 1, maxItems: 10, items: request } }, ['order', 'requests']) },
  cleanup: { type: 'array', maxItems: 1, items: request },
  request_timeout_ms: { type: 'integer', minimum: 50, maximum: 30000 },
  timeout_ms: { type: 'integer', maximum: 300000 } }, ['schema', 'environment_id', 'steps']);

export const BACKEND_VALIDATION_GUIDANCE = Object.freeze({
  BACKEND_EXECUTION_INVALID: 'Use only schema, environment_id, setup, steps, cleanup, request_timeout_ms, timeout_ms. Copy environment_id exactly; schema is workbench/backend-execution-v1. Include every confirmed step in order, at most 30; setup/cleanup arrays have at most one request each.',
  BACKEND_STEP_INVALID: 'Each step has only order and requests. Copy the confirmed step order exactly; supply 1–10 requests.',
  BACKEND_REQUEST_INVALID: 'HTTP request keys: id,method,path,json,headers,assertions. Response reuse keys: id,response_ref,assertions only. IDs must be unique, start with an ASCII letter, then at most 60 word/hyphen characters. Use a registered allowed method.',
  BACKEND_ASSERTION_INVALID: 'Status: {target:"status",op:"equals",value:200} with integer 100–599. JSON requires a valid pointer. exists value must be Boolean; length value a nonnegative integer. value and expected_from are mutually exclusive. field only belongs to array_some_field_equals; that op forbids expected_from even null, requires ASCII own field and literal scalar value. array_some_fields_equal requires 1–12 legal own fields mapped to literal scalars in value, without field/expected_from/templates. string_nonempty requires JSON target and value:true without field/expected_from. Header supports only /content-type + media_type_equals + application/json without field/expected_from.',
  BACKEND_ASSERTIONS_REQUIRED: 'Supply 1–40 assertions per request.',
  BACKEND_BUSINESS_ASSERTION_REQUIRED: 'Each step needs a non-existence JSON business assertion; status/header and namespace metadata /runId,/ticket,/released alone do not count. Preserve the confirmed business expectation.',
  BACKEND_CLEANUP_REQUIRED: 'Synthetic setup and cleanup must both be present or both absent. Any non-GET step requires namespace setup and cleanup.',
  BACKEND_NAMESPACE_SETUP_INVALID: 'Setup must POST exact namespace.setup_path with JSON containing only {runId:"{{runId}}"} and a JSON business assertion.',
  BACKEND_NAMESPACE_SETUP_ASSERTIONS_REQUIRED: 'Setup must include {target:"status",op:"equals",value:201} and {target:"json",pointer:"/created",op:"equals",value:true}.',
  BACKEND_CLEANUP_SCOPE_INVALID: 'Cleanup must DELETE namespace.cleanup_prefix + "{{runId}}", without json body, with a JSON business assertion.',
  BACKEND_NAMESPACE_CLEANUP_ASSERTIONS_REQUIRED: 'Cleanup must include {target:"status",op:"equals",value:200} and {target:"json",pointer:"/deleted",op:"equals",value:true}.',
  BACKEND_NAMESPACE_SCOPE_INVALID: 'With setup, step HTTP paths must start with namespace.resource_prefix + "{{runId}}/".',
  BACKEND_NAMESPACE_REQUIRED: 'Do not add namespace setup to an environment without a registered namespace.',
  BACKEND_REFERENCE_INVALID: 'References name an earlier HTTP request only. Use {{request-id:/pointer}} or expected_from:{request_id,pointer}; response_ref cannot chain from response_ref. expected_from forbids value and exists.',
  BACKEND_JSON_POINTER_INVALID: 'Use JSON pointer "" for root or /field; escape ~ as ~0 and / as ~1.',
  BACKEND_JSON_KEY_INVALID: 'Do not use __proto__, constructor or prototype keys.',
  BACKEND_JSON_VALUE_INVALID: 'Use JSON data values and well-formed references, never undefined/functions.',
  BACKEND_PATH_INVALID: 'Use a relative path starting /, without //, backslashes, fragments, whitespace, dot segments or malformed percent escapes.',
  BACKEND_TARGET_OUT_OF_SCOPE: 'Keep relative paths within the registered allowed_path_prefixes and origin.',
  BACKEND_METHOD_NOT_SUPPORTED: 'Synthetic business steps support GET/POST; DELETE belongs to cleanup.',
  BACKEND_BODY_INVALID: 'GET has no json body. A reviewed read-only POST query requires a literal JSON body matching its registered body_schema; other bodies are JSON within 32768 serialized characters.',
  BACKEND_HEADERS_INVALID: 'Use only exact registered header names and values; no credentials, unregistered headers or line breaks.',
  BACKEND_TIMEOUT_INVALID: 'request_timeout_ms is integer 50–30000 (default10000); timeout_ms is integer at least request_timeout_ms and at most300000 (default120000).',
  BACKEND_REQUEST_LIMIT: 'At most 80 requests including setup, cleanup and response references.',
  BACKEND_READONLY_SETUP_CLEANUP_FORBIDDEN: 'Read-only mode requires empty setup and cleanup.',
  BACKEND_READONLY_REQUEST_INVALID: 'Read-only steps allow GET, or an explicitly registered POST query at its exact path with a literal body matching body_schema and current protocol identity. No custom headers, setup or cleanup.',
  BACKEND_QUERY_CONTRACT_INVALID: 'The reviewed POST query registration is invalid; keep its exact path, protocol identity and bounded body schema unchanged and report the environment issue.',
  BACKEND_QUERY_SCHEMA_INVALID: 'The registered POST query body_schema is invalid; report the environment issue instead of widening the plan.',
  BACKEND_QUERY_PROTOCOL_INVALID: 'The POST query registration does not match the current project protocol snapshot and endpoint; report the environment issue.',
  BACKEND_QUERY_BODY_INVALID: 'The POST query requires a literal JSON body within its registered body_schema; do not add template variables or undeclared fields.',
  BACKEND_CONFIRMED_CASE_REQUIRED: 'Reload frozen confirmed backend case context; do not invent or change its identity.',
  BACKEND_CASE_STAGE_CONFLICT: 'The confirmed case places a registered test setup/cleanup control request in a business step. Stop and report that a reviewed case revision is required; do not delete steps or substitute a readback.',
  BACKEND_CASE_CONTENT_CHANGED: 'Confirmed case hash changed: reload context; do not rewrite confirmed facts.',
  BACKEND_CONFIRMED_BINDING_REQUIRED: 'A current complete confirmed protocol binding is required; do not invent one.',
  BACKEND_ENVIRONMENT_NOT_AUTHORIZED: 'Registered non-production authorized environment is required; do not change authorization.',
  BACKEND_ENVIRONMENT_URL_INVALID: 'Registered base URL is invalid; preserve context and report environment blockage.',
  BACKEND_ENVIRONMENT_SCOPE_INVALID: 'Registered method/path scope is invalid; preserve context and report environment blockage.',
  BACKEND_ENVIRONMENT_MODE_INVALID: 'Only registered synthetic-namespace or http-json-readonly modes are supported.',
  BACKEND_READONLY_ENVIRONMENT_INVALID: 'Registered read-only environment must be GET-only without namespace or headers.',
  BACKEND_NAMESPACE_INVALID: 'Registered namespace must contain valid exact setup_path/resource_prefix/cleanup_prefix; do not invent replacements.',
  BACKEND_NAMESPACE_PREFIX_INVALID: 'The registered run_id_prefix must be 1–26 lowercase letters/digits/hyphens with alphanumeric ends, for synthetic namespace mode only. Preserve the environment and report the configuration problem; do not change it in the execution plan.',
});

// No user business facts: this illustrates syntax for a hypothetical confirmed
// single-step fixture. Replace the step and environment with read_context facts.
export const BACKEND_FORMAT_EXAMPLE = {
  schema: 'workbench/backend-execution-v1', environment_id: 'syntax-example',
  setup: [{ id: 'init', method: 'POST', path: '/__control/namespaces', json: { runId: '{{runId}}' }, assertions: [
    { target: 'status', op: 'equals', value: 201 }, { target: 'json', pointer: '/created', op: 'equals', value: true }] }],
  steps: [{ order: 1, requests: [{ id: 'query', method: 'GET', path: '/api/v1/namespaces/{{runId}}/example', assertions: [
    { target: 'status', op: 'equals', value: 200 }, { target: 'json', pointer: '/value', op: 'equals', value: 1 },
    { target: 'json', pointer: '/value', op: 'exists', value: true }] }] }],
  cleanup: [{ id: 'cleanup', method: 'DELETE', path: '/__control/namespaces/{{runId}}', assertions: [
    { target: 'status', op: 'equals', value: 200 }, { target: 'json', pointer: '/deleted', op: 'equals', value: true }] }],
};
export const BACKEND_CONTRACT_PROMPT = [
  'For fields that must belong to the SAME record in an unordered response array, use {target:"json",pointer:"/items",op:"array_some_fields_equal",value:{code:"KNOWN-ID",name:"Known name"}}. value contains 1–12 own ASCII field names and literal JSON scalar values (no templates/nested values/prototype keys); field and expected_from are forbidden even null. One array object must match ALL fields; extra fields and any array order are allowed. Retain length/count or other required collection assertions separately. Multiple single-field matches or correct responses from other endpoints cannot establish field association in this response.',
  'When the confirmed expectation requires a nonempty string, use {target:"json",pointer:"/error/message",op:"string_nonempty",value:true}; only a string with at least one non-whitespace character passes. No field or expected_from. This checks nonempty text only, not the meaning of the message; retain confirmed error-code and other business assertions and disclose any unverified semantic obligation.',
  'The write_draft execution schema describes syntax; the existing validator additionally checks registered scope, references, current identity and every confirmed business obligation. HTTP requests require method/path; response_ref requests contain only id,response_ref,assertions. No extra keys. JSON assertions require pointer; exists requires Boolean value; length requires nonnegative integer value. Never include both value and expected_from.',
  'Synthetic setup must POST exact namespace.setup_path with only {runId:"{{runId}}"}, asserting status201 and /created=true. Cleanup must DELETE exact namespace.cleanup_prefix+"{{runId}}", no body, asserting status200 and /deleted=true. Both arrays at most one; synthetic non-GET steps require both. Read-only POST queries use empty setup/cleanup. Copy actual paths/environment from read_context, never assume these illustrative paths.',
  'Complete FORMAT-ONLY example for a hypothetical confirmed single-step fixture (not business/protocol facts; replace every step/action/assertion with the confirmed case and registered capabilities): ' + JSON.stringify(BACKEND_FORMAT_EXAMPLE),
  'On rejection use the returned validation_guidance and current state/hash; repair the indicated contract without removing confirmed expectations. Known validation code guide: ' + JSON.stringify(BACKEND_VALIDATION_GUIDANCE),
].join('\n');
