import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { extractDocxImages } from '../requirements/documents.mjs';
import { applyJsonRecovery } from './json-recovery.mjs';

const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const textSchema = maxLength => ({ type: 'string', maxLength });
const string = textSchema(200);
const strings = { type: 'array', maxItems: 40, items: textSchema(1500) };
const reference = object({ reference_id: string, source_id: string, segment_id: string, message_id: string, quote: textSchema(3000),
  validity: { type: 'string', enum: ['INVALID'] }, issue: string });
const step = object({ order: { type: 'integer', minimum: 1 }, action: textSchema(3000), expected: textSchema(3000),
  source_refs: { type: 'array', maxItems: 30, items: reference } }, ['order', 'action', 'expected', 'source_refs']);
const testCase = object({ case_id: string, case_type: { type: 'string', enum: ['UI', 'BACKEND'] }, external_id: string,
  title: textSchema(500), module: textSchema(500), preconditions: textSchema(5000), test_data: textSchema(5000),
  steps: { type: 'array', maxItems: 100, items: step }, pending_questions: strings }, ['case_type', 'title', 'steps']);
const observation = object({ source_id: string, image_id: string,
  observations: { type: 'array', maxItems: 40, items: object({ description: textSchema(1500), location: textSchema(500) }, ['description', 'location']) },
  uncertainties: strings }, ['source_id', 'observations', 'uncertainties']);
export const CASE_ASSISTANT_TOOLS = [
  { name: 'read_context', description: 'Read the saved conversation, current source manifest, previous complete draft and workbook check findings. Assistant text is not a business source.', inputSchema: object({}) },
  { name: 'read_source', description: 'Read original extracted document segments, in pages of up to 40. Cite the returned short reference_id; the workbench resolves it to the frozen source. No paths or URLs.',
    inputSchema: object({ source_id: string, offset: { type: 'integer', minimum: 0 } }, ['source_id']) },
  { name: 'read_image', description: 'Read the actual selected screenshot or an embedded Word image. Returns real image content and its frozen source identity. Read every image in the manifest.',
    inputSchema: object({ source_id: string, image_id: string }, ['source_id']) },
  { name: 'stage_cases', description: 'Save up to 20 complete cases by stable case_id. Existing IDs are replaced; all other staged cases remain. This is an atomic batch: a format error saves none of this batch and retains all earlier batches. Inspect findings and resubmit only affected cases. This is not final submission.',
    inputSchema: object({ cases: { type: 'array', maxItems: 20, items: { ...testCase, required: [...testCase.required, 'case_id'] } } }, ['cases']) },
  { name: 'submit_response', description: 'Finalize manual test-case drafts: either pass cases as the COMPLETE list, or omit cases and set use_staged_cases:true to finalize every staged case. Never combine the modes. The workbench creates Excel drafts for engineer review; this never approves cases or runs tests. After accepted:true stop tools.',
    inputSchema: object({ reply: textSchema(20000), questions: strings, cases: { type: 'array', maxItems: 200, items: testCase },
      use_staged_cases: { type: 'boolean' }, image_observations: { type: 'array', maxItems: 20, items: observation } }, ['reply', 'questions', 'image_observations']) },
];

export const name = 'workbench-case-assistant-guard';
export const inject = ['tools'];
const allowed = new Set(CASE_ASSISTANT_TOOLS.map(tool => `mcp__workbench-case-assistant__${tool.name}`));
export function apply(ctx) {
  applyJsonRecovery(ctx);
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.tools.presentAs('native');
    const denied = ctx.tools.schemas().map(tool => tool.name).filter(tool => !allowed.has(tool));
    if (denied.length) agent.ctx.tools.restrict({ deny: denied });
  });
  ctx.on('tools/pre-execute', (exec, next) => allowed.has(exec.name) ? next()
    : { kind: 'deny', reason: JSON.stringify({ code: 'CASE_ASSISTANT_TOOL_DENIED' }) });
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (code, feedback) => { throw Object.assign(new Error(code), feedback ? { feedback } : {}); };
const clone = value => structuredClone(value);
function text(value, limit = 5000, optional = false) {
  if (value === undefined && optional) return '';
  if (typeof value !== 'string' || value.length > limit) fail('CASE_ASSISTANT_RESPONSE_TEXT_INVALID');
  return value;
}
function textList(value, limit = 40) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) fail('CASE_ASSISTANT_RESPONSE_LIST_INVALID');
  return value.map(item => text(item, 1500));
}
function invalid(value, schema, field = '$') {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && schema.type !== type && !(schema.type === 'integer' && Number.isInteger(value))) return { field, rule: 'TYPE', expected: schema.type };
  if (schema.enum && !schema.enum.includes(value)) return { field, rule: 'ENUM', allowed: schema.enum };
  if (schema.minimum !== undefined && value < schema.minimum) return { field, rule: 'MINIMUM', minimum: schema.minimum };
  if (typeof value === 'string' && value.includes('\uFFFD')) return { field, rule: 'NO_REPLACEMENT_CHARACTER',
    next: 'Rewrite this field as valid readable text from the source. It contains the Unicode replacement character U+FFFD; do not remove it blindly or change the business meaning.' };
  if (typeof value === 'string' && schema.maxLength !== undefined && value.length > schema.maxLength) return { field, rule: 'MAX_LENGTH', max_length: schema.maxLength };
  if (type === 'object') {
    const missing = (schema.required || []).find(key => !Object.hasOwn(value, key));
    if (missing) return { field: `${field}.${missing}`, rule: 'REQUIRED' };
    for (const [key, item] of Object.entries(value)) {
      if (!schema.properties?.[key]) {
        if (schema.additionalProperties === false) return { field, rule: 'ALLOWED_FIELDS', allowed: Object.keys(schema.properties || {}) };
      } else {
        const error = invalid(item, schema.properties[key], `${field}.${key}`);
        if (error) return error;
      }
    }
  }
  if (type === 'array') {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return { field, rule: 'MAX_ITEMS', max_items: schema.maxItems };
    for (let index = 0; index < value.length; index++) {
      const error = invalid(value[index], schema.items || {}, `${field}[${index}]`);
      if (error) return error;
    }
  }
  return null;
}

export class CaseAssistantMcpSession {
  constructor({ projectId, messages = [], sources = [], previous = null, signal, onProgress = async () => {} }) {
    this.signal = signal;
    this.onProgress = onProgress;
    this.messages = clone(messages);
    this.previous = clone(previous);
    this.sources = new Map();
    this.images = new Map();
    this.readSegments = new Set();
    this.readImages = new Set();
    this.references = new Map();
    this.referenceIds = new Map();
    this.stagedCases = new Map();
    this.contextRead = false;
    this.response = null;
    this.toolCalls = 0;
    this.toolErrors = [];
    let imageBytes = 0;
    for (const source of sources) {
      if (!source?.snapshot_id || this.sources.has(source.snapshot_id) || source.project_id && source.project_id !== projectId) fail('CASE_ASSISTANT_SOURCE_INVALID');
      if (!Buffer.isBuffer(source.body) || source.sha256 && digest(source.body) !== source.sha256 || source.bytes != null && source.bytes !== source.body.length) fail('CASE_ASSISTANT_SOURCE_INTEGRITY_FAILED');
      const { body, ...metadata } = source;
      this.sources.set(source.snapshot_id, { ...clone(metadata), body: Buffer.from(body) });
      // Office text snapshots retain the protected original bytes. Their
      // unanalysed images cannot be reopened through the ordinary ZIP parser.
      const officeTextOnly = source.extension === '.docx' && source.reading_method === 'local-office' &&
        source.read_status === 'PARTIAL' && source.sections?.images === 'UNANALYZED' &&
        Array.isArray(source.embedded_images) && source.embedded_images.length === 0;
      const images = source.kind === 'IMAGE' ? [{ body, image_id: null,
        mime_type: /\.png$/i.test(source.file_name) ? 'image/png' : 'image/jpeg', sha256: digest(body) }]
        : source.extension === '.docx' && !officeTextOnly ? extractDocxImages(body) : [];
      for (const image of images) {
        if (source.extension === '.docx') {
          const saved = source.embedded_images?.find(item => item.image_id === image.image_id);
          if (!saved || saved.sha256 !== image.sha256) fail('CASE_ASSISTANT_SOURCE_INTEGRITY_FAILED');
        }
        imageBytes += image.body.length;
        if (image.body.length > 10 * 1024 * 1024 || imageBytes > 60 * 1024 * 1024 || this.images.size >= 20) fail('CASE_ASSISTANT_IMAGE_LIMIT_EXCEEDED');
        this.images.set(this.imageKey(source.snapshot_id, image.image_id), { source_id: source.snapshot_id,
          ...(image.image_id ? { image_id: image.image_id } : {}), mime_type: image.mime_type, sha256: image.sha256, body: Buffer.from(image.body) });
      }
    }
    if (Buffer.byteLength(JSON.stringify({ messages: this.messages, previous: this.previous })) > 750000) fail('CASE_ASSISTANT_CONTEXT_LIMIT_EXCEEDED');
    for (const message of this.messages.filter(item => item.role === 'user')) this.addReference({ message_id: message.id }, 'U');
    for (const source of this.sources.values()) {
      if (source.kind !== 'IMAGE') for (const segment of source.segments || []) {
        this.addReference({ source_id: source.snapshot_id, segment_id: segment.segment_id }, 'R');
      }
    }
  }
  imageKey(sourceId, imageId) { return `${sourceId}#${imageId || ''}`; }
  referenceKey(ref) { return JSON.stringify([ref.message_id || null, ref.source_id || null, ref.segment_id || null]); }
  addReference(ref, prefix) {
    const key = this.referenceKey(ref);
    if (!this.referenceIds.has(key)) {
      const id = `${prefix}${this.references.size + 1}`;
      this.referenceIds.set(key, id);
      this.references.set(id, ref);
    }
    return this.referenceIds.get(key);
  }
  check() {
    if (this.signal?.aborted) fail('CASE_ASSISTANT_CANCELLED');
    if (this.response) fail('CASE_ASSISTANT_ALREADY_SUBMITTED');
  }
  evidence() {
    return { tool_calls: this.toolCalls, context_read: this.contextRead,
      tool_errors: clone(this.toolErrors),
      source_segments_read: this.readSegments.size, staged_case_count: this.stagedCases.size,
      images_read: [...this.readImages].map(key => {
        const { body, ...metadata } = this.images.get(key);
        return { ...metadata, bytes: body.length };
      }) };
  }
  async invoke(toolName, args = {}) {
    this.check();
    const tool = CASE_ASSISTANT_TOOLS.find(item => item.name === toolName);
    if (!tool) fail('CASE_ASSISTANT_TOOL_DENIED');
    const argumentError = invalid(args, tool.inputSchema);
    if (argumentError) fail(argumentError.rule === 'NO_REPLACEMENT_CHARACTER'
      ? 'CASE_ASSISTANT_RESPONSE_TEXT_ENCODING_INVALID' : 'CASE_ASSISTANT_ARGUMENTS_INVALID', argumentError);
    this.toolCalls += 1;
    if (this.toolCalls > 80) fail('CASE_ASSISTANT_TOOL_LIMIT_EXCEEDED');
    if (toolName === 'read_context') {
      this.contextRead = true;
      await this.onProgress({ stage: 'READING_MATERIALS', tool: toolName });
      return { messages: this.messages.map(message => ({ ...clone(message), ...(message.role === 'user'
        ? { reference_id: this.referenceIds.get(this.referenceKey({ message_id: message.id })) } : {}) })),
      previous: clone(this.previous), staged_cases: clone([...this.stagedCases.values()]), sources: [...this.sources.values()].map(source => ({
        source_id: source.snapshot_id, snapshot_id: source.snapshot_id, file_name: source.file_name, kind: source.kind,
        sha256: source.sha256, read_status: source.read_status,
        ...(source.reading_method === 'local-office' ? {reading_method: source.reading_method, sections: clone(source.sections)} : {}),
        issues: clone(source.issues || []),
        segment_count: source.segments?.length || 0,
        images: [...this.images.values()].filter(image => image.source_id === source.snapshot_id).map(({ body, ...metadata }) => ({ ...metadata, bytes: body.length })),
      })), submission: { format: 'manual-test-cases', executes_tests: false, auto_imports: false, human_approved: false,
        modes: ['cases: complete replacement list', 'use_staged_cases:true with cases omitted: all staged cases'],
        staged_batch_limit: 20, case_limit: 200 } };
    }
    if (!this.contextRead) fail('CASE_ASSISTANT_READ_CONTEXT_FIRST');
    if (toolName === 'read_source') {
      const source = this.sources.get(args.source_id);
      if (!source || source.kind === 'IMAGE') fail('CASE_ASSISTANT_SOURCE_NOT_FOUND');
      const offset = args.offset || 0;
      const segments = source.segments || [];
      if (offset > segments.length) fail('CASE_ASSISTANT_SOURCE_OFFSET_INVALID');
      const page = segments.slice(offset, offset + 40);
      for (const segment of page) this.readSegments.add(`${source.snapshot_id}#${segment.segment_id}`);
      await this.onProgress({ stage: 'READING_MATERIALS', tool: toolName, source_id: source.snapshot_id });
      return { source_id: source.snapshot_id, sha256: source.sha256, file_name: source.file_name,
        segments: page.map(segment => ({ ...clone(segment), reference_id: this.referenceIds.get(this.referenceKey({
          source_id: source.snapshot_id, segment_id: segment.segment_id })) })),
        next_offset: offset + page.length < segments.length ? offset + page.length : null, total_segments: segments.length,
        issues: clone(source.issues || []) };
    }
    if (toolName === 'read_image') {
      const key = this.imageKey(args.source_id, args.image_id);
      const image = this.images.get(key);
      if (!image) fail('CASE_ASSISTANT_IMAGE_NOT_FOUND');
      this.readImages.add(key);
      await this.onProgress({ stage: 'READING_IMAGES', tool: toolName, source_id: image.source_id });
      const { body, ...metadata } = image;
      return { content: [{ type: 'text', text: JSON.stringify({ ...metadata, bytes: body.length, rule: 'Visible UI facts only; report unreadable images explicitly.' }) },
        { type: 'image', mimeType: image.mime_type, data: body.toString('base64') }] };
    }
    const { checkAssistantOutput } = await import('./output.mjs');
    if (toolName === 'stage_cases') {
      const cases = this.normalizeCases(args.cases);
      const ids = new Set();
      for (const [index, entry] of cases.entries()) {
        if (!entry.case_id.trim() || ids.has(entry.case_id)) fail('CASE_ASSISTANT_STAGED_CASE_ID_INVALID', {
          field: `$.cases[${index}].case_id`, rule: 'NON_EMPTY_UNIQUE_CASE_ID_WITHIN_BATCH' });
        ids.add(entry.case_id);
      }
      const next = new Map(this.stagedCases);
      for (const entry of cases) next.set(entry.case_id, entry);
      if (next.size > 200 || Buffer.byteLength(JSON.stringify([...next.values()])) > 750000) fail('CASE_ASSISTANT_DRAFT_LIMIT_EXCEEDED', {
        field: '$.cases', rule: 'STAGED_DRAFT_LIMIT', max_items: 200, max_bytes: 750000 });
      const checked = checkAssistantOutput({ cases: [...next.values()], questions: [] }, { sources: [...this.sources.values()], messages: this.messages });
      this.check();
      await this.onProgress({ stage: 'CHECKING_DRAFT', tool: toolName });
      this.check();
      this.stagedCases = next;
      return { staged: true, final: false, staged_case_count: next.size, staged_case_ids: [...next.keys()],
        checks: checked.checks, human_approved: false, next: 'Repair only affected complete cases with stage_cases, or finalize using use_staged_cases:true.' };
    }
    if (Object.hasOwn(args, 'cases') && args.use_staged_cases === true || !Object.hasOwn(args, 'cases') && args.use_staged_cases !== true) {
      fail('CASE_ASSISTANT_SUBMISSION_MODE_INVALID', { field: '$.cases', rule: 'CHOOSE_COMPLETE_CASES_OR_STAGED_CASES',
        next: 'Provide the complete cases array, or omit cases and set use_staged_cases:true. Do not combine them.' });
    }
    if (args.use_staged_cases === true && !this.stagedCases.size) fail('CASE_ASSISTANT_STAGED_CASES_EMPTY', {
      field: '$.use_staged_cases', rule: 'STAGE_CASES_BEFORE_FINALIZING' });
    const response = this.normalizeResponse(args, args.use_staged_cases === true ? [...this.stagedCases.values()] : null);
    const checked = checkAssistantOutput(response, { sources: [...this.sources.values()], messages: this.messages });
    this.check();
    await this.onProgress({ stage: 'CHECKING_DRAFT', tool: toolName });
    this.check();
    this.response = response;
    return { accepted: true, case_count: response.cases.length, questions: response.questions.length,
      checks: checked.checks, human_approved: false, next: 'Finish the turn.' };
  }
  normalizeReference(ref) {
    const original = clone(ref);
    const reject = issue => ({ ...original, validity: 'INVALID', issue });
    // A warning copied from a previous draft stays invalid until the reference itself is corrected.
    if (ref.validity === 'INVALID') return reject(ref.issue || 'REFERENCE_PREVIOUSLY_INVALID');
    if (ref.reference_id) {
      if (ref.message_id || ref.source_id || ref.segment_id) return reject('AMBIGUOUS_REFERENCE_ID');
      const resolved = this.references.get(ref.reference_id);
      if (!resolved) return reject('UNKNOWN_REFERENCE_ID');
      ref = { ...resolved, ...(ref.quote ? { quote: ref.quote } : {}) };
    }
    if (ref.message_id) {
      if (ref.source_id || ref.segment_id) return reject('AMBIGUOUS_REFERENCE_ID');
      const message = this.messages.find(item => item.id === ref.message_id && item.role === 'user');
      if (!message) return reject('USER_MESSAGE_NOT_FOUND');
      if (ref.quote && !message.text.includes(ref.quote)) return reject('QUOTE_NOT_FOUND');
      return { message_id: ref.message_id, ...(ref.quote ? { quote: text(ref.quote, 3000) } : {}) };
    }
    const source = this.sources.get(ref.source_id);
    const segment = source?.segments?.find(item => item.segment_id === ref.segment_id);
    if (!source || source.kind === 'IMAGE' || !segment) return reject('DOCUMENT_SEGMENT_NOT_FOUND');
    if (!this.readSegments.has(`${ref.source_id}#${ref.segment_id}`)) return reject('REFERENCE_NOT_READ');
    if (ref.quote && !segment.text.includes(ref.quote)) return reject('QUOTE_NOT_FOUND');
    return { source_id: ref.source_id, segment_id: ref.segment_id, ...(ref.quote ? { quote: text(ref.quote, 3000) } : {}) };
  }
  normalizeCases(rawCases) {
    if (rawCases.length > 200) fail('CASE_ASSISTANT_RESPONSE_LIMIT_EXCEEDED');
    return rawCases.map((item, caseIndex) => {
      if (item.steps.length > 100) fail('CASE_ASSISTANT_RESPONSE_LIMIT_EXCEEDED');
      return { case_id: text(item.case_id, 200, true), case_type: item.case_type,
        external_id: text(item.external_id, 200, true), title: text(item.title, 500), module: text(item.module, 500, true),
        preconditions: text(item.preconditions, 5000, true), test_data: text(item.test_data, 5000, true),
        steps: item.steps.map((entry, index) => {
          if (entry.order !== index + 1 || entry.source_refs.length > 30) fail('CASE_ASSISTANT_STEPS_INVALID', {
            field: `$.cases[${caseIndex}].steps[${index}].order`, rule: 'SEQUENTIAL_STEP_ORDER', expected: index + 1 });
          return { order: entry.order, action: text(entry.action, 3000), expected: text(entry.expected, 3000),
            source_refs: entry.source_refs.map(ref => this.normalizeReference(ref)) };
        }), pending_questions: textList(item.pending_questions),
      };
    });
  }
  normalizeResponse(raw, stagedCases = null) {
    if (raw.image_observations.length > 20) fail('CASE_ASSISTANT_RESPONSE_LIMIT_EXCEEDED');
    const reply = text(raw.reply, 20000);
    const questions = textList(raw.questions);
    const cases = stagedCases ? clone(stagedCases) : this.normalizeCases(raw.cases);
    const seen = new Set();
    const image_observations = raw.image_observations.map(item => {
      const key = this.imageKey(item.source_id, item.image_id);
      if (!this.images.has(key) || !this.readImages.has(key) || seen.has(key)) fail('CASE_ASSISTANT_IMAGE_OBSERVATION_INVALID');
      seen.add(key);
      if (item.observations.length > 40 || !item.observations.length && !item.uncertainties.length) fail('CASE_ASSISTANT_IMAGE_OBSERVATION_INVALID');
      return { source_id: item.source_id, ...(item.image_id ? { image_id: item.image_id } : {}),
        observations: item.observations.map(value => ({ description: text(value.description, 1500), location: text(value.location, 500) })),
        uncertainties: textList(item.uncertainties) };
    });
    if (seen.size !== this.images.size) fail('CASE_ASSISTANT_IMAGES_REQUIRE_READING', { field: '$.image_observations',
      rule: 'READ_AND_REPORT_EACH_SELECTED_IMAGE', missing: [...this.images.entries()].filter(([key]) => !seen.has(key))
        .map(([, image]) => ({ source_id: image.source_id, ...(image.image_id ? { image_id: image.image_id } : {}) })) });
    return { reply, questions, cases, image_observations };
  }
}

export async function startCaseAssistantMcp(session) {
  const route = `/${randomUUID()}`;
  let closing = false;
  let queue = Promise.resolve();
  const server = http.createServer(async (request, response) => {
    if (closing || request.url !== route || request.method !== 'POST' || request.headers.origin || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
      response.writeHead(404); response.end(); return;
    }
    let message;
    try {
      let body = '';
      for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 1000000) fail('CASE_ASSISTANT_REQUEST_TOO_LARGE'); }
      message = JSON.parse(body);
      if (message.id === undefined) { response.writeHead(202); response.end(); return; }
      let result;
      if (message.method === 'initialize') result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} },
        serverInfo: { name: 'workbench-case-assistant', version: '1.0.0' }, instructions: 'Only design manual test cases from this conversation and selected materials. Read context first; submit through submit_response. Never execute tests.' };
      else if (message.method === 'server/discover') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Legacy initialize transport supported' } })); return;
      } else if (message.method === 'ping') result = {};
      else if (message.method === 'tools/list') result = { tools: CASE_ASSISTANT_TOOLS };
      else if (message.method === 'tools/call') {
        const operation = queue.then(async () => {
          const value = await session.invoke(message.params?.name, message.params?.arguments || {});
          return value?.content ? value : { content: [{ type: 'text', text: JSON.stringify(value) }] };
        });
        queue = operation.catch(() => {});
        try { result = await operation; }
        catch (error) {
          const code = /^CASE_ASSISTANT_[A-Z_]+$/.test(error.message) ? error.message : 'CASE_ASSISTANT_TOOL_FAILED';
          session.toolErrors.push({ tool: CASE_ASSISTANT_TOOLS.some(tool => tool.name === message.params?.name) ? message.params.name : 'unknown',
            code, ...(error.feedback?.field ? { field: error.feedback.field } : {}) });
          session.toolErrors = session.toolErrors.slice(-20);
          result = { isError: true, content: [{ type: 'text', text: JSON.stringify({
          code,
          ...(error.feedback ? { feedback: error.feedback } : {}),
        }) }] }; }
      } else fail('CASE_ASSISTANT_METHOD_UNSUPPORTED');
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'INVALID_MCP_REQUEST' } }));
    }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${route}`, close: async () => {
    closing = true; server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await queue;
  } };
}
