import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';

const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const location = object({ path: { type: 'string' }, start_line: { type: 'integer' }, end_line: { type: 'integer' }, pointer: { type: 'string' } });
const reviewStep = object({ order: { type: 'integer' }, implementation: { type: 'string', enum: ['COVERED', 'MISSING', 'UNCERTAIN'] },
  explanation: { type: 'string', maxLength: 2000 }, locations: { type: 'array', maxItems: 12, items: location } }, ['order', 'implementation', 'explanation', 'locations']);
const finding = object({ kind: { type: 'string', enum: ['MISSING_ACTION', 'MISSING_ASSERTION', 'WEAK_ASSERTION', 'MISSING_SETUP', 'TIMING', 'UNSUPPORTED_ASSUMPTION', 'OTHER'] },
  step_order: { type: 'integer' }, source: object({ field: { type: 'string', enum: ['action', 'expected', 'preconditions', 'test_data'] }, quote: { type: 'string', maxLength: 500 } }, ['field', 'quote']),
  message: { type: 'string', maxLength: 1000 }, suggestion: { type: 'string', maxLength: 1000 }, location: {} },
  ['kind', 'step_order', 'source', 'message', 'suggestion', 'location']);
export const REVIEW_TOOLS = Object.freeze([
  { name: 'read_case', description: 'Read only the frozen confirmed case. This must be the first tool.', inputSchema: object() },
  { name: 'submit_obligations', description: 'Before seeing implementation, state at least one action and one expected obligation per step; split composite expectations as needed. At most 80 obligations and 24 KiB total. Each quote must be an exact substring of that original field, at most 250 characters; each check is at most 250 characters.', inputSchema: object({ obligations: { type: 'array', maxItems: 80, items: object({ order: { type: 'integer' }, field: { type: 'string', enum: ['action', 'expected'] }, quote: { type: 'string', maxLength: 250 }, check: { type: 'string', maxLength: 250 } }, ['order', 'field', 'quote', 'check']) } }, ['obligations']) },
  { name: 'read_candidate', description: 'Read the frozen candidate and confirmed technical context after obligations are submitted.', inputSchema: object() },
  { name: 'read_evidence', description: 'Read sanitized trusted execution evidence after obligations are submitted.', inputSchema: object() },
  { name: 'request_replay', description: 'Request at most one host-controlled independent replay of the same frozen candidate on its registered environment. No URL, command, or code argument.', inputSchema: object() },
  { name: 'submit_review', description: 'Submit exactly steps and findings. Each step has order, implementation, explanation and locations. UI locations are {path,start_line,end_line}; backend locations are {pointer}, with no UI fields. Finding location can be null. Do not put verdict, severity or extra fields in the result. Host validates actual quotes and locations.', inputSchema: object({ steps: { type: 'array', maxItems: 40, items: reviewStep }, findings: { type: 'array', maxItems: 40, items: finding } }, ['steps', 'findings']) },
]);

function valid(value, schema) {
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![schema.type].flat().some(type => type === kind || type === 'integer' && Number.isInteger(value))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (kind === 'string' && schema.maxLength !== undefined && value.length > schema.maxLength) return false;
  if (kind === 'array' && schema.maxItems !== undefined && value.length > schema.maxItems) return false;
  if (kind === 'object') return (schema.required || []).every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => schema.properties?.[key] ? valid(value[key], schema.properties[key]) : schema.additionalProperties !== false);
  if (kind === 'array') return value.every(item => valid(item, schema.items || {}));
  return true;
}

export async function startQualityReviewMcp(invoke, { onRejected } = {}) {
  const route = `/${randomUUID()}`;
  let closing = false;
  const receipts = [];
  let received = 0;
  const server = http.createServer(async (request, response) => {
    if (closing || request.url !== route || request.method !== 'POST' || request.headers.origin
      || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
      response.writeHead(404); response.end(); return;
    }
    // Record the host boundary without saving arguments, URLs or headers.
    // Counts include malformed JSON and schema rejection before invocation.
    const receipt = { number: ++received, bytes: 0, sha256: null, method: null,
      tool: null, outcome: 'RECEIVED', http_status: null };
    const digest = createHash('sha256');
    response.once('finish', () => {
      receipt.http_status = response.statusCode;
      if (receipts.length < 96) receipts.push({ ...receipt });
    });
    let message;
    try {
      let body = '';
      for await (const chunk of request) {
        digest.update(chunk); receipt.bytes += chunk.length;
        body += chunk; if (Buffer.byteLength(body) > 160_000) throw Error('REQUEST_TOO_LARGE');
      }
      receipt.sha256 = digest.digest('hex');
      message = JSON.parse(body);
      receipt.method = ['initialize','server/discover','ping','tools/list','tools/call'].includes(message?.method) ? message.method : 'OTHER';
      receipt.outcome = 'PROTOCOL_RESPONSE';
      if (message.id === undefined) { response.writeHead(202); response.end(); return; }
      let result;
      if (message.method === 'initialize') result = { protocolVersion: message.params?.protocolVersion,
        capabilities: { tools: {} }, serverInfo: { name: 'workbench-quality-review', version: '1.0.0' },
        instructions: 'Read the original case and commit to its obligations before inspecting candidate or evidence. Review only. No business approval.' };
      else if (message.method === 'server/discover') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id,
          error: { code: -32601, message: 'Legacy initialize transport supported' } })); return;
      }
      else if (message.method === 'ping') result = {};
      else if (message.method === 'tools/list') result = { tools: REVIEW_TOOLS };
      else if (message.method === 'tools/call') {
        const tool = REVIEW_TOOLS.find(item => item.name === message.params?.name);
        receipt.tool = tool?.name || 'UNKNOWN';
        if (!tool) throw Error('QUALITY_REVIEW_TOOL_DENIED');
        if (!valid(message.params?.arguments ?? {}, tool.inputSchema)) {
          // A known tool's invalid arguments are a failed tool result. Returning
          // HTTP 400 here aborts some MCP clients before they can correct the
          // bounded submission; no implementation is invoked or accepted.
          await onRejected?.(tool.name, 'QUALITY_REVIEW_TOOL_ARGUMENTS_INVALID');
          receipt.outcome = 'SCHEMA_REJECTED';
          result = { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'QUALITY_REVIEW_TOOL_ARGUMENTS_INVALID' }) }] };
        } else try {
          receipt.outcome = 'INVOKED';
          const value = await invoke(tool.name, message.params?.arguments ?? {});
          result = { content: [{ type: 'text', text: JSON.stringify(value) }] };
        } catch (error) {
          receipt.outcome = 'INVOCATION_REJECTED';
          result = { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: /^[A-Z_]{3,80}$/.test(error?.message || '') ? error.message : 'QUALITY_REVIEW_TOOL_FAILED' }) }] };
        }
      } else throw Error('METHOD_NOT_SUPPORTED');
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    } catch (error) {
      receipt.outcome = error instanceof SyntaxError ? 'JSON_PARSE_REJECTED' :
        /^[A-Z_]{3,80}$/.test(error?.message || '') ? error.message : 'INVALID_REQUEST';
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: /^[A-Z_]{3,80}$/.test(error?.message || '') ? error.message : 'INVALID_REQUEST' } }));
    }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${route}`,
    get receipt() { return { schema: 'workbench/quality-review-mcp-boundary-v1', received,
      retained: receipts.length, truncated: received > 96, requests: structuredClone(receipts) }; },
    close: async () => { closing = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
