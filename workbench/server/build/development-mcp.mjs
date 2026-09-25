import http from 'node:http';
import { randomUUID } from 'node:crypto';

const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
export const DEVELOPMENT_TOOLS = [
  { name: 'read_draft', description: 'Read the frozen normal case, current editable draft and cumulative task budget.', inputSchema: object() },
  { name: 'write_draft', description: 'Replace only this task draft. This does not execute or validate it. Supply the current SHA to prevent stale writes.', inputSchema: object({ code: { type: 'string' }, previous_sha256: { type: ['string', 'null'] } }, ['code', 'previous_sha256']) },
  { name: 'self_test', description: 'Execute an immutable snapshot of the current draft on the bound NORMAL environment. Returns actual Playwright error, steps, report and evidence. Max 3 executions per logical task; failed tests are feedback, not a tool failure.', inputSchema: object() },
  { name: 'read_evidence', description: 'Read this task development execution report or screenshot. No paths or URLs accepted.', inputSchema: object({ execution: { type: 'integer', minimum: 1, maximum: 3 }, kind: { type: 'string', enum: ['report', 'screenshot'] } }, ['execution', 'kind']) },
  { name: 'submit_candidate', description: 'Freeze the current tested bytes and provide coverage for every original step. Stops editing. May report unresolved business difference, missing coverage or environmental blocking; never grants approval.', inputSchema: object({ sha256: { type: 'string' }, outcome: { type: 'string', enum: ['ready', 'business_difference', 'needs_analysis', 'environment_blocked', 'budget_exhausted'] }, coverage: { type: 'array', items: object({ order: { type: 'integer' }, requirement: { type: 'string' }, check_lines: { type: 'array', items: { type: 'integer' } }, execution: { type: 'integer' }, uncovered: { type: 'string' } }, ['order', 'requirement', 'check_lines', 'execution', 'uncovered']) } }, ['sha256', 'outcome', 'coverage']) },
];

// Small stateless Streamable HTTP JSON-RPC endpoint; exercised with DSH's pinned MCP client.
// The unguessable route is per-task and closed before independent final validation.
export async function startDevelopmentMcp(invoke) {
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
        if (!tool) throw new Error('TOOL_NOT_ALLOWED');
        const args = message.params.arguments || {};
        if (!args || Array.isArray(args) || Object.keys(args).some(key => !(key in tool.inputSchema.properties)) || tool.inputSchema.required.some(key => !(key in args))) throw new Error('TOOL_ARGUMENTS_INVALID');
        try {
          const value = await invoke(tool.name, args);
          result = value?.content ? value : { content: [{ type: 'text', text: JSON.stringify(value) }] };
        } catch (error) { result = { isError: true, content: [{ type: 'text', text: String(error.message) }] }; }
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
