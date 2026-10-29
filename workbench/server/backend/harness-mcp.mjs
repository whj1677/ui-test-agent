import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { BACKEND_EXECUTION_INPUT_SCHEMA, BACKEND_VALIDATION_GUIDANCE } from './harness-contract.mjs';

const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const tools = [
  { name: 'read_context', description: 'Read the frozen confirmed case, binding, protocol, registered target and current draft hash.', inputSchema: object() },
  { name: 'write_draft', description: 'Replace the complete declarative HTTP/JSON plan after validation. Follow the nested schema and read_context capabilities; errors provide validation_guidance. Requires the current draft SHA (CAS). Copy read_context.draft_sha256 exactly into previous_sha256: for the first draft send JSON null, not the string "null", an empty string or a guessed hash. Later writes require the exact current draft hash.', inputSchema: object({ execution: { type: 'object' }, previous_sha256: { type: ['string', 'null'] } }, ['execution', 'previous_sha256']) },
  { name: 'self_test', description: 'Execute exactly the current declarative plan bytes using the bound backend executor. Business differences are evidence, not a reason to relax assertions.', inputSchema: object() },
  { name: 'read_evidence', description: 'Read a bounded report from one self-test by its ordinal.', inputSchema: object({ number: { type: 'integer', minimum: 1, maximum: 10 } }, ['number']) },
  { name: 'review_candidate', description: 'Independently review the exact current tested draft against the confirmed case and protocol. Returns located findings to repair in this same session; it does not approve a plan.', inputSchema: object() },
  { name: 'submit_candidate', description: 'Submit the exact tested SHA. coverage records whether each original obligation is implemented in the plan, not whether it passed or ran. READY and BUSINESS_DIFFERENCE require each step to cite its real plan request_id and set uncovered to empty; a business failure and later NOT_RUN steps stay in execution evidence and must not be called passing. Use NEEDS_ANALYSIS and name actual implementation gaps in uncovered. This tool never grants human approval.', inputSchema: object({ execution_sha256: { type: 'string' }, outcome: { type: 'string', enum: ['READY', 'BUSINESS_DIFFERENCE', 'NEEDS_ANALYSIS', 'ENVIRONMENT_BLOCKED'] }, coverage: { type: 'array', items: object({ order: { type: 'integer' }, requirement: { type: 'string' }, request_ids: { type: 'array', items: { type: 'string' } }, uncovered: { type: 'string' } }, ['order', 'requirement', 'request_ids', 'uncovered']) } }, ['execution_sha256', 'outcome', 'coverage']) },
];
// Advertised syntax is richer; dispatch keeps the original validation so the
// existing validator still supplies its specific errors and acceptance rules.
export const BACKEND_HARNESS_TOOLS = tools.map(tool => tool.name === 'write_draft'
  ? { ...tool, inputSchema: object({ execution: BACKEND_EXECUTION_INPUT_SCHEMA, previous_sha256: { type: ['string', 'null'] } }, ['execution', 'previous_sha256']) }
  : tool);
function valid(value, schema) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![].concat(schema.type).some(item => item === type || item === 'integer' && Number.isInteger(value))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (type === 'object') return (schema.required || []).every(key => Object.hasOwn(value, key)) && Object.entries(value).every(([key, child]) => schema.properties?.[key] ? valid(child, schema.properties[key]) : schema.additionalProperties !== false);
  if (type === 'array') return value.every(item => valid(item, schema.items || {}));
  if (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum) return false;
  return true;
}
export async function startBackendHarnessMcp(invoke, getState = () => ({}), onTransportFailure = async()=>{}) {
  const route = `/${randomUUID()}`; let closing = false;
  const server = http.createServer(async (request, response) => {
    if (closing || request.url !== route || request.method !== 'POST' || request.headers.origin || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) { response.writeHead(404); response.end(); return; }
    let body = '', message;
    try {
      for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 160_000) throw new Error('REQUEST_TOO_LARGE'); }
      message = JSON.parse(body);
      let result;
      if (message.id === undefined) { response.writeHead(202); response.end(); return; }
      if (message.method === 'initialize') result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'workbench-backend', version: '1.0.0' }, instructions: 'Only use the six workbench backend tools. Produce a declarative backend-execution-v1 plan for the registered environment; preserve every business step and assertion source. Review the tested draft before submission; review is not human approval.' };
      else if (message.method === 'server/discover') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Legacy initialize transport supported' } })); return; }
      else if (message.method === 'ping') result = {};
      else if (message.method === 'tools/list') result = { tools: BACKEND_HARNESS_TOOLS };
      else if (message.method === 'tools/call') {
        const tool = tools.find(item => item.name === message.params?.name), args = message.params?.arguments || {};
        try {
          if (!tool) { await onTransportFailure('unknown','BACKEND_HARNESS_TOOL_DENIED'); throw new Error('BACKEND_HARNESS_TOOL_DENIED'); }
          if (!valid(args, tool.inputSchema)) { await onTransportFailure(tool.name,'BACKEND_HARNESS_ARGUMENTS_INVALID'); throw new Error('BACKEND_HARNESS_ARGUMENTS_INVALID'); }
          // Older model calls may quote the empty-draft sentinel. The session's
          // strict CAS still rejects null once an actual draft exists.
          const input = tool.name === 'write_draft' && args.previous_sha256 === 'null' ? { ...args, previous_sha256: null } : args;
          const value = await invoke(tool.name, input);
          result = { content: [{ type: 'text', text: JSON.stringify(value) }] };
        } catch (error) { result = { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: /^[A-Z][A-Z0-9_]{4,100}$/.test(error.message) ? error.message : 'BACKEND_HARNESS_TOOL_FAILED', ...(Object.hasOwn(BACKEND_VALIDATION_GUIDANCE, error.message) ? { validation_guidance: BACKEND_VALIDATION_GUIDANCE[error.message] } : {}), state: getState() }) }] }; }
      } else throw new Error('MCP_METHOD_NOT_SUPPORTED');
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id ?? null, result }));
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'INVALID_MCP_REQUEST' } }));
    }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${route}`, close: async () => { closing = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
