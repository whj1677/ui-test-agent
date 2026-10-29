import { createHash } from 'node:crypto';
import { backendCaseStageIssues } from './case-stages.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const preparationDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const http = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(`?)(\/[A-Za-z0-9_./{}:-]+)(?:\?[^\s`，。]*)?\2/g;
const refs = (source, segments) => segments.map(segment => ({ snapshot_id: source.snapshot_id, segment_id: segment.segment_id, quote_sha256: segment.quote_sha256 }));
const messages = {
  BINDING_CONFLICT_UNRESOLVED: '协议与原业务预期存在未解决冲突，请先审阅业务修订。',
  PROTOCOL_REQUIRED: '请先导入通讯协议。', EXPLICIT_HTTP_REQUEST_REQUIRED: '请补充本步骤的明确 HTTP 方法与接口路径。',
  PROTOCOL_MAPPING_AMBIGUOUS: '协议中存在多个同方法与路径定义，请明确采用的接口定义。',
  PROTOCOL_ENDPOINT_MISSING: '协议中找不到本步骤方法与路径，请补充接口定义。', PROTOCOL_RESPONSE_REQUIRED: '接口缺少明确响应定义，请补充响应字段与状态。',
  CASE_EXPECTED_REQUIRED: '已确认用例缺少本步骤的业务预期。', BACKEND_ENVIRONMENT_REQUIRED: '请先选择项目后端测试环境。',
  CASE_REQUEST_INPUT_REQUIRED: '协议要求请求体，本用例尚未明确输入数据，请补充。',
  CASE_REQUEST_FIELDS_REQUIRED: '本用例尚未明确协议所需请求字段的取值，请补充输入数据。',
  CASE_REQUEST_HEADER_REQUIRED: '协议要求的请求头未在本步骤或测试数据中明确，请补充。',
  BACKEND_ENVIRONMENT_CAPABILITY_UNSUPPORTED: '当前后端执行能力不支持此方法或路径范围。',
  BACKEND_AUTH_UNSUPPORTED: '当前后端执行器不支持普通密钥、Token 或 Cookie 鉴权，请使用高级流程核查支持范围。',
  PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED: '项目后端环境配置已变化，请重新选择并确认环境。',
  PROJECT_ENVIRONMENT_NOT_CONFIGURED: '请先明确选择项目后端测试环境。',
  PROTOCOL_REQUEST_FIELDS_UNCLEAR: '请求体缺少明确字段定义，当前自动解析无法确认输入范围，请补充。',
};
const matchesPath = (template, actual) => {
  const parts = template.split('/'), values = actual.split('/');
  return parts.length === values.length && parts.every((part, index) => /^\{[\w-]+\}$/.test(part) ? Boolean(values[index]) : part === values[index]);
};

const endpointLine = /^\s*(?:\|\s*)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(`?)(\/[A-Za-z0-9_./{}:-]+)(?:\?[^\s`，。|]*)?\2(?=\s|[，,；;。|]|$)/;
const responseLabel = /(?:响应|返回|response)\s*[:：]?\s*(?:HTTP\s*)?[245]\d\d\s*\{/i;
const responseStatus = /\b[245]\d\d\s*\{/;

// A JSON body can contain objects and arrays; a first-closing-brace regex loses nested fields.
function requestJson(text) {
  const marker = /\bJSON\s*(?=\{)/i.exec(text);
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  const stack = []; let quoted = false, escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      if (stack.pop() !== (char === '}' ? '{' : '[')) return null;
      if (!stack.length) {
        try { return JSON.parse(text.slice(start, index + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function jsonFieldNames(value, fields = new Set()) {
  if (Array.isArray(value)) value.forEach(item => jsonFieldNames(item, fields));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    fields.add(key); jsonFieldNames(item, fields);
  }
  return [...fields];
}

function requiresRequestBody(text) {
  // Remove only a complete clause explicitly saying no body. Embedded phrases
  // in conditions or prohibitions stay conservative, as do other body mentions
  // and JSON declarations in the same endpoint.
  const requestText = text.replace(/(^|[，,。.;；！？!?\r\n])[ \t]*(?:无|(?:无需|不需要)[ \t]*(?:发送|携带)?|不(?:使用|发送|携带|包含|含)|没有)[ \t]*(?:任何[ \t]*)?请求体(?=[ \t]*(?:[，,。.;；！？!?\r\n]|$))/g, '$1');
  return /\bJSON\s*(?:\{|(?:四|三|二|两|[1-9])字段)|请求体|request\s*body/i.test(requestText);
}

// Only a method/path at the start of a line (or table row) defines an endpoint.
export function protocolCatalog(source) {
  const lines = (source?.segments || []).flatMap(segment => String(segment.text || '').split(/\r?\n/).map(text => ({ text, segment })));
  const entries = [];
  for (let index = 0; index < lines.length; index++) {
    const match = endpointLine.exec(lines[index].text);
    if (!match) continue;
    const block = [lines[index]];
    for (let at = index + 1; at < lines.length; at++) {
      if (endpointLine.test(lines[at].text) || /^\s*#/.test(lines[at].text)) break;
      block.push(lines[at]);
    }
    const responses = [], requestLines = []; let responseStarted = false;
    for (const line of block) {
      const cells = line.text.trim().startsWith('|') ? line.text.split('|').slice(1, -1).map(cell => cell.trim()) : [];
      const label = responseLabel.exec(line.text);
      const tableStatus = cells.length > 1 ? responseStatus.exec(cells.slice(1).join('|')) : null;
      if (label || tableStatus) {
        responseStarted = true;
        const boundary = label?.index ?? line.text.indexOf(tableStatus[0], line.text.indexOf('|', 1) + 1);
        requestLines.push(line.text.slice(0, boundary));
        responses.push(line.text.slice(boundary).trim());
      } else if (!responseStarted) requestLines.push(line.text);
    }
    const requestText = requestLines.join('\n');
    const declaration = requestText.match(/JSON\s*(?:四|三|二|两|[1-9])字段\s+([A-Za-z][A-Za-z0-9_]*(?:[、,，]\s*[A-Za-z][A-Za-z0-9_]*)+)/);
    const body = requestJson(requestText);
    const fields = declaration?.[1].split(/[、,，]\s*/) || (body ? jsonFieldNames(body) : []);
    const segments = [...new Map(block.map(line => [line.segment.segment_id, line.segment])).values()];
    entries.push({ method: match[1], path: match[3], text: block.map(line => line.text).join('\n'), response_text: responses.join('\n'),
      request_fields: fields, requires_body: requiresRequestBody(requestText), source_refs: refs(source, segments) });
  }
  return entries;
}

export async function prepareBackend(manager, projectId, { protocol_source_id } = {}) {
  const project = await manager.caseStore.getProject(projectId);
  if (!project) throw Error('CASE_PROJECT_NOT_FOUND');
  const sources = await manager.requirementsManager.listSources(projectId);
  const protocols = (sources.sources || sources).filter(source => source.kind === 'PROTOCOL');
  const chosen = protocol_source_id || protocols[0]?.snapshot_id;
  const source = chosen ? await manager.requirementsManager.getSource(projectId, chosen) : null;
  if (source && (source.kind !== 'PROTOCOL' || source.project_id !== projectId)) throw Error('BINDING_PROTOCOL_REQUIRED');
  const catalog = protocolCatalog(source);
  const listing = await manager.list(projectId);
  const environment = listing.environments.find(row => row.environment_id === listing.environment_binding?.backend_environment_id) || (!manager.projectEnvironments && listing.environments.length === 1 ? listing.environments[0] : null);
  let environmentError = null;
  if (manager.projectEnvironments) try { await manager.projectEnvironments.assert(projectId, 'backend', environment?.environment_id); } catch (error) { environmentError = error.message; }
  const authUnsupported = (source?.segments || []).flatMap(segment => segment.text.split(/\n|[。；;]/)).some(line => !/不使用|无需|不用|不是认证|不需要/i.test(line) && /(?:请求头|header).*\b(?:authorization|cookie|api[-_]?key)\b|\bAuthorization\s*[:：=]|\bBearer\s+\S+|(?:需要|必须|要求).*(?:Token|Cookie|密钥)/i.test(line));
  const items = [];
  for (const item of project.cases) {
    const version = item.versions.find(row => row.version === item.current_version);
    if (version?.content.case_type !== 'BACKEND' || version.content.status !== 'CONFIRMED') continue;
    const { bindings } = await manager.requirementsManager.getBindings(projectId, item.case_id);
    const current = bindings.filter(row => row.case_version === version.version && row.case_content_sha256 === version.content_sha256);
    const complete = current.filter(row => row.version === bindings.at(-1)?.version && row.status === 'COMPLETE' && row.confirmation_status === 'CONFIRMED' && source && row.protocol_source_id === source.snapshot_id && row.protocol_sha256 === source.sha256).at(-1);
    const row = { case_id: item.case_id, case_version: version.version, content_sha256: version.content_sha256, title: version.content.title, external_id: version.content.external_id,
      status: 'READY', missing: [], mappings: [], binding_version: complete?.version || null, expected_binding_revision: bindings.at(-1)?.version || 0 };
    const plan = listing.plans.find(plan => plan.case_id === item.case_id && plan.case_version === version.version && plan.content_sha256 === version.content_sha256 && plan.environment_id === environment?.environment_id && plan.environment_sha256 === environment?.configuration_sha256 && ['DRAFT', 'CONFIRMED', 'GENERATING'].includes(plan.state) && (plan.execution || plan.state === 'GENERATING') && current.some(binding => binding.version === plan.binding_version && binding.status === 'COMPLETE' && binding.confirmation_status === 'CONFIRMED' && binding.protocol_sha256 === plan.protocol_sha256 && binding.protocol_source_id === source?.snapshot_id) && source && plan.protocol_sha256 === source.sha256);
    if (current.some(binding => binding.status === 'CONFLICT')) { row.status = 'CONFLICT'; row.missing.push({ code: 'BINDING_CONFLICT_UNRESOLVED' }); }
    else if (plan) { row.status = 'EXISTS'; row.plan_id = plan.plan_id; }
    else if (!source) { row.status = 'NEEDS_SUPPLEMENT'; row.missing.push({ code: 'PROTOCOL_REQUIRED' }); }
    else if (!complete) {
      for (const step of version.content.steps) {
        const requests = [...String(step.action).matchAll(http)];
        if (!requests.length) { row.missing.push({ step_order: step.order, code: 'EXPLICIT_HTTP_REQUEST_REQUIRED' }); continue; }
        const selected = [];
        for (const request of requests) {
          const matches = catalog.filter(entry => entry.method === request[1] && matchesPath(entry.path, request[3]));
          if (matches.length !== 1) { row.missing.push({ step_order: step.order, code: matches.length ? 'PROTOCOL_MAPPING_AMBIGUOUS' : 'PROTOCOL_ENDPOINT_MISSING' }); continue; }
          const entry = matches[0];
          if (!entry.response_text) { row.missing.push({ step_order: step.order, code: 'PROTOCOL_RESPONSE_REQUIRED' }); continue; }
          const data = `${step.action}\n${version.content.test_data || ''}`;
          if (entry.requires_body && !entry.request_fields.length) { row.missing.push({ step_order: step.order, code: 'PROTOCOL_REQUEST_FIELDS_UNCLEAR' }); continue; }
          const headers = [...entry.text.matchAll(/(?:请求头|header)\s+([a-z][a-z0-9-]+)/gi)].map(match => match[1]);
          if (headers.some(header => !new RegExp(`\\b${header}\\b["']?\\s*[:=]\\s*(?:"[^"\\n]+"|'[^'\\n]+'|[^\\s,，;；。}]+)`, 'i').test(data))) { row.missing.push({ step_order: step.order, code: 'CASE_REQUEST_HEADER_REQUIRED' }); continue; }
          if (entry.request_fields.some(field => {
            const value = data.match(new RegExp(`\\b${field}\\b["']?\\s*[:=]\\s*("[^"\\n]+"|'[^'\\n]+'|[^\\s,，;；。}]+)`))?.[1];
            return !value || /^(?:TBD|TODO|待补充|待定)$/i.test(value) || entry.request_fields.some(next => value.startsWith(`${next}=`) || value.startsWith(`${next}:`));
          })) { row.missing.push({ step_order: step.order, code: 'CASE_REQUEST_FIELDS_REQUIRED' }); continue; }
          selected.push(entry);
        }
        if (selected.length === requests.length && step.expected?.trim()) row.mappings.push({ step_order: step.order, status: 'MAPPED', request: step.action,
          response: selected.map(entry => entry.text).join('\n').slice(0, 3000), observation: step.expected, source_refs: [...new Map(selected.flatMap(entry => entry.source_refs).map(ref => [ref.segment_id, ref])).values()] });
        else if (!step.expected?.trim()) row.missing.push({ step_order: step.order, code: 'CASE_EXPECTED_REQUIRED' });
      }
      if (row.missing.length) row.status = 'NEEDS_SUPPLEMENT';
    }
    if (row.status === 'READY') {
      if (!environment) { row.status = 'UNSUPPORTED'; row.missing.push({ code: 'BACKEND_ENVIRONMENT_REQUIRED' }); }
      else {
        if (/\b(?:authorization|bearer|cookie|api[-_]?key)\s*[:=]|鉴权.*(?:token|密钥|cookie)/i.test(`${version.content.preconditions || ''}\n${version.content.steps.map(step => step.action).join('\n')}`)) { row.status = 'UNSUPPORTED'; row.missing.push({ code: 'BACKEND_AUTH_UNSUPPORTED' }); }
        const mappings = complete?.mappings || row.mappings;
        for (const mapping of mappings) for (const request of String(mapping.request || '').matchAll(http)) {
          const prefixMatch = environment.allowed_path_prefixes?.some(prefix => request[3] === prefix.replace(/\/$/, '') || request[3].startsWith(prefix));
          const queryMatch = environment.mode !== 'http-json-readonly' || request[1] !== 'POST' || environment.read_only_post_queries?.some(query =>
            query.path === request[3] && !request[0].includes('?') && query.protocol_source_id === source.snapshot_id && query.protocol_sha256 === source.sha256 && query.readonly_reviewed === true);
          if (!environment.allowed_methods?.includes(request[1]) || !prefixMatch || !queryMatch) { row.status = 'UNSUPPORTED'; row.missing.push({ step_order: mapping.step_order, code: 'BACKEND_ENVIRONMENT_CAPABILITY_UNSUPPORTED' }); }
        }
      }
    }
    // A complete protocol or an old draft does not make a case with control
    // requests in its business steps expressible by the selected executor.
    const stageIssues = backendCaseStageIssues({ caseVersion: version, binding: complete || { mappings: row.mappings }, environment });
    if (stageIssues.length) {
      if (row.status !== 'CONFLICT') row.status = 'NEEDS_SUPPLEMENT';
      row.missing.unshift(...stageIssues); delete row.plan_id;
    }
    if (row.status !== 'CONFLICT' && (authUnsupported || environmentError)) { row.status = 'UNSUPPORTED'; row.missing.push({ code: authUnsupported ? 'BACKEND_AUTH_UNSUPPORTED' : environmentError }); }
    row.protocol_source_id = source?.snapshot_id || null;
    row.missing = row.missing.map(issue => ({ ...issue, message: issue.message || messages[issue.code] || issue.code }));
    items.push(row);
  }
  const result = { project_id: projectId, project_revision: project.revision, protocol_source_id: source?.snapshot_id || null, protocol_sha256: source?.sha256 || null,
    environment_id: environment?.environment_id || null, environment_sha256: environment?.configuration_sha256 || null, catalog, items,
    protocols: protocols.map(protocol => ({ id: protocol.snapshot_id, name: protocol.file_name || protocol.filename || protocol.snapshot_id })),
    automatic_scope: '仅自动识别明确 HTTP 方法、路径、请求字段与响应定义；未知格式需补充，不修改业务预期。',
    model_available: listing.model_available, generation_limits: listing.generation_limits || null, limits: { generation: listing.generation_limits || null, max_batch_cases: project.cases.length, concurrency: 1 } };
  return { ...result, preparation_sha256: preparationDigest(result) };
}
