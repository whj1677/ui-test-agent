// Reviewable contract example. These values describe the public synthetic fixture,
// not defaults for a user's business protocol. The caller supplies confirmed case/binding.
export const exampleEnvironment = {
  id: 'synthetic-ledger-http', non_production: true, authorized: true,
  base_url: 'http://127.0.0.1:4383',
  allowed_path_prefixes: ['/__control/namespaces/', '/api/v1/namespaces/'],
  allowed_methods: ['GET', 'POST', 'DELETE'],
  allowed_headers: ['x-synthetic-role'],
  allowed_header_values: { 'x-synthetic-role': ['editor', 'viewer'] },
  namespace: { setup_path: '/__control/namespaces', resource_prefix: '/api/v1/namespaces/', cleanup_prefix: '/__control/namespaces/' },
};
export const exampleExecution = {
  schema: 'workbench/backend-execution-v1', environment_id: exampleEnvironment.id,
  setup: [{ id: 'init', method: 'POST', path: '/__control/namespaces', json: { runId: '{{runId}}' }, assertions: [
    { target: 'status', op: 'equals', value: 201 }, { target: 'json', pointer: '/created', op: 'equals', value: true },
  ] }],
  steps: [{ order: 1, requests: [{ id: 'before', method: 'GET', path: '/api/v1/namespaces/{{runId}}/devices', assertions: [
    { target: 'status', op: 'equals', value: 200 }, { target: 'json', pointer: '/total', op: 'equals', value: 1 },
    { target: 'json', pointer: '/items/0/code', op: 'equals', value: 'DEV-001' },
  ] }] }, { order: 2, requests: [{ id: 'duplicate', method: 'POST', path: '/api/v1/namespaces/{{runId}}/devices', headers: { 'x-synthetic-role': 'editor' },
    json: { code: 'DEV-001', name: '重复设备', site: '西站', ratedPowerKw: 110 }, assertions: [
      { target: 'status', op: 'equals', value: 409 }, { target: 'json', pointer: '/created', op: 'equals', value: false },
      { target: 'json', pointer: '/error/code', op: 'equals', value: 'DUPLICATE_CODE' },
    ] }] }, { order: 3, requests: [{ id: 'after', method: 'GET', path: '/api/v1/namespaces/{{runId}}/devices', assertions: [
    { target: 'status', op: 'equals', value: 200 },
    { target: 'json', pointer: '/items', op: 'equals', expected_from: { request_id: 'before', pointer: '/items' } },
    { target: 'json', pointer: '/total', op: 'equals', expected_from: { request_id: 'before', pointer: '/total' } },
  ] }] }],
  cleanup: [{ id: 'cleanup', method: 'DELETE', path: '/__control/namespaces/{{runId}}', assertions: [
    { target: 'status', op: 'equals', value: 200 }, { target: 'json', pointer: '/deleted', op: 'equals', value: true },
  ] }],
};
