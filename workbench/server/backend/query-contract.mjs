// A reviewed POST query is an enumerated exception to the GET-only adapter.
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const fail = code => { throw Error(code); };
const unsafe = key => ['__proto__', 'constructor', 'prototype'].includes(key);
const keys = (value, names) => plain(value) && Object.keys(value).every(key => names.includes(key));
const field = key => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) && !unsafe(key);
const exactPath = path => typeof path === 'string' && path.length <= 200 && /^\/[A-Za-z0-9_./:-]+$/.test(path) &&
  !path.startsWith('//') && !path.split('/').some(part => part === '.' || part === '..') && !path.endsWith('/');
const within = (path, prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix);

export function validateQuerySchema(schema) {
  if (schema?.type !== 'object') fail('BACKEND_QUERY_SCHEMA_INVALID');
  let encoded; try { encoded = JSON.stringify(schema); } catch { fail('BACKEND_QUERY_SCHEMA_INVALID'); }
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > 16384) fail('BACKEND_QUERY_SCHEMA_INVALID');
  let count = 0;
  function visit(node, depth) {
    if (!plain(node) || !['object', 'string', 'integer', 'number', 'boolean'].includes(node.type)) fail('BACKEND_QUERY_SCHEMA_INVALID');
    if (node.type === 'object') {
      if (depth > 3 || !keys(node, ['type', 'properties', 'required', 'additionalProperties']) || node.additionalProperties !== false ||
        !plain(node.properties) || !Object.keys(node.properties).length || !Array.isArray(node.required) ||
        new Set(node.required).size !== node.required.length || node.required.some(key => !Object.hasOwn(node.properties, key))) fail('BACKEND_QUERY_SCHEMA_INVALID');
      for (const [key, child] of Object.entries(node.properties)) {
        if (!field(key) || ++count > 32) fail('BACKEND_QUERY_SCHEMA_INVALID');
        visit(child, depth + 1);
      }
      return;
    }
    const allowed = node.type === 'string' ? ['type', 'maxLength', 'enum'] :
      node.type === 'boolean' ? ['type', 'enum'] : ['type', 'minimum', 'maximum', 'enum'];
    if (!keys(node, allowed)) fail('BACKEND_QUERY_SCHEMA_INVALID');
    if (node.type === 'string' && (!Number.isInteger(node.maxLength) || node.maxLength < 1 || node.maxLength > 1024)) fail('BACKEND_QUERY_SCHEMA_INVALID');
    if (['integer', 'number'].includes(node.type) && (!Number.isFinite(node.minimum) || !Number.isFinite(node.maximum) ||
      node.minimum > node.maximum || Math.abs(node.minimum) > 1e12 || Math.abs(node.maximum) > 1e12)) fail('BACKEND_QUERY_SCHEMA_INVALID');
    if (Object.hasOwn(node, 'enum') && (!Array.isArray(node.enum) || !node.enum.length || node.enum.length > 20 ||
      new Set(node.enum.map(value => JSON.stringify(value))).size !== node.enum.length ||
      node.enum.some(value => !scalar(value, node)))) fail('BACKEND_QUERY_SCHEMA_INVALID');
  }
  visit(schema, 1);
  return schema;
}

function scalar(value, schema) {
  if (schema.type === 'string') return typeof value === 'string' && value.length <= schema.maxLength && !value.includes('{{');
  if (schema.type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isInteger(value)) &&
    value >= schema.minimum && value <= schema.maximum;
}

export function validateQueryBody(body, schema) {
  validateQuerySchema(schema);
  let encoded;
  try { encoded = JSON.stringify(body); } catch { fail('BACKEND_QUERY_BODY_INVALID'); }
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > 8192) fail('BACKEND_QUERY_BODY_INVALID');
  function visit(value, node) {
    if (node.type !== 'object') return scalar(value, node) && (!node.enum || node.enum.includes(value));
    if (!plain(value) || Object.keys(value).some(key => !field(key) || !Object.hasOwn(node.properties, key)) ||
      node.required.some(key => !Object.hasOwn(value, key))) return false;
    return Object.entries(value).every(([key, child]) => visit(child, node.properties[key]));
  }
  if (!visit(body, schema)) fail('BACKEND_QUERY_BODY_INVALID');
  return body;
}

export function validateQueryDefinitions(definitions, prefixes) {
  if (!Array.isArray(definitions) || definitions.length < 1 || definitions.length > 10) fail('BACKEND_QUERY_CONTRACT_INVALID');
  const paths = new Set();
  for (const query of definitions) {
    if (!keys(query, ['path', 'protocol_source_id', 'protocol_sha256', 'readonly_reviewed', 'body_schema']) ||
      !exactPath(query.path) || paths.has(query.path) || !prefixes.some(prefix => within(query.path, prefix)) ||
      typeof query.protocol_source_id !== 'string' || !query.protocol_source_id.trim() || query.protocol_source_id.length > 200 ||
      typeof query.protocol_sha256 !== 'string' || !query.protocol_sha256.trim() || query.protocol_sha256.length > 200 || query.readonly_reviewed !== true) fail('BACKEND_QUERY_CONTRACT_INVALID');
    validateQuerySchema(query.body_schema);
    paths.add(query.path);
  }
  return definitions;
}

export function queryFor(environment, binding, request) {
  const query = environment.read_only_post_queries?.find(item => item.path === request.path);
  if (!query || request.method !== 'POST' || query.protocol_source_id !== binding.protocol_source_id ||
    query.protocol_sha256 !== binding.protocol_sha256 || query.readonly_reviewed !== true) fail('BACKEND_READONLY_REQUEST_INVALID');
  if (!Object.hasOwn(request, 'json') || Object.keys(request.headers || {}).length) fail('BACKEND_READONLY_REQUEST_INVALID');
  validateQueryBody(request.json, query.body_schema);
  return query;
}
