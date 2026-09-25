import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { safeFeedback, developmentError } from './development-feedback.mjs';

const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
function valid(value, schema) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![schema.type].flat().some(t => t === type || (t === 'integer' && Number.isInteger(value)))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum) return false;
  if (type === 'object') return (schema.required || []).every(key => key in value) && Object.keys(value).every(key => schema.properties?.[key] ? valid(value[key], schema.properties[key]) : schema.additionalProperties !== false);
  if (type === 'array') return value.every(item => valid(item, schema.items || {}));
  return true;
}
export const DEVELOPMENT_TOOLS = [
  { name: 'run_diagnostic', description: 'Run the prepared node --check command on snapshots of task JavaScript modules. No arbitrary command/path/URL or model credentials. Syntax diagnostics do not replace self_test.', inputSchema: object() },
  { name: 'read_draft', description: 'Read the frozen normal case, current editable draft and cumulative task budget.', inputSchema: object() },
  { name: 'write_draft', description: 'Statically check ES module syntax and permitted capabilities, then replace only this task draft. Rejected code is NOT saved. This does not execute or runtime-validate it. Supply the current SHA to prevent stale writes.', inputSchema: object({ code: { type: 'string' }, previous_sha256: { type: ['string', 'null'] } }, ['code', 'previous_sha256']) },
  { name: 'self_test', description: 'Execute an immutable snapshot of the current draft on the bound NORMAL environment. Returns actual Playwright error, steps, report and evidence. Max 3 executions per logical task; failed tests are feedback, not a tool failure.', inputSchema: object() },
  { name: 'read_evidence', description: 'Read this task development execution report or screenshot. No paths or URLs accepted.', inputSchema: object({ execution: { type: 'integer', minimum: 1, maximum: 3 }, kind: { type: 'string', enum: ['report', 'screenshot'] } }, ['execution', 'kind']) },
  { name: 'check_fidelity', description: 'Inspect finite original-obligation checks before submitting; returns helper/branch gaps and unknowns. This is not execution or human approval.', inputSchema: object() },
  { name: 'submit_candidate', description: 'Freeze the current tested bytes and provide coverage for every original step. Stops editing. May report unresolved business difference, missing coverage or environmental blocking; never grants approval.', inputSchema: object({ sha256: { type: 'string' }, outcome: { type: 'string', enum: ['ready', 'business_difference', 'needs_analysis', 'environment_blocked', 'budget_exhausted'] }, coverage: { type: 'array', items: object({ order: { type: 'integer' }, requirement: { type: 'string' }, check_lines: { type: 'array', items: { type: 'integer' } }, execution: { type: 'integer' }, uncovered: { type: 'string' } }, ['order', 'requirement', 'check_lines', 'execution', 'uncovered']) } }, ['sha256', 'outcome', 'coverage']) },
];

// Small stateless Streamable HTTP JSON-RPC endpoint; exercised with DSH's pinned MCP client.
// The unguessable route is per-task and closed before independent final validation.
export async function startDevelopmentMcp(invoke, { getState = () => ({}) } = {}) {
  const route = `/${randomUUID()}`;
  let closing = false;
  const server = http.createServer(async (request, response) => {
    if (closing || request.url !== route || request.method !== 'POST' || request.headers.origin || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
      response.writeHead(request.method === 'GET' ? 405 : 404); response.end(); return;
    }
    let message;
    try {
      let body = ''; for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 160_000) throw new Error('REQUEST_TOO_LARGE'); }
      message = JSON.parse(body);
      if (message.id === undefined) { response.writeHead(202); response.end(); return; }
      let result;
      if (message.method === 'initialize') result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'workbench-development', version: '1.0.0' }, instructions: 'Develop only the frozen normal case. Self-test current bytes before submission. Test failure feedback requires analysis; it is not task completion.' };
      else if (message.method === 'server/discover') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Legacy initialize transport supported' } })); return;
      }
      else if (message.method === 'ping') result = {};
      else if (message.method === 'tools/list') result = { tools: DEVELOPMENT_TOOLS };
      else if (message.method === 'tools/call') {
        const tool = DEVELOPMENT_TOOLS.find(item => item.name === message.params?.name);
        try {
        if (!tool) throw developmentError('TOOL_NOT_ALLOWED', { allowed_next_steps: DEVELOPMENT_TOOLS.map(t => t.name) });
        const args = message.params.arguments || {};
        if (!valid(args, tool.inputSchema)) throw developmentError('TOOL_ARGUMENTS_INVALID', { rule: 'EXACT_TOOL_SCHEMA', required: tool.inputSchema.required, allowed_parameters: Object.keys(tool.inputSchema.properties) });
          const value = await invoke(tool.name, args);
          result = value?.content ? value : { content: [{ type: 'text', text: JSON.stringify(value) }] };
        } catch (error) { result = { isError: true, content: [{ type: 'text', text: JSON.stringify(safeFeedback(error, getState())) }] }; }
      } else throw new Error('METHOD_NOT_SUPPORTED');
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: error.message } }));
    }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${route}`, close: async () => { closing = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
