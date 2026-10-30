import test from 'node:test';
import assert from 'node:assert/strict';
import { protocolCatalog, prepareBackend } from '../server/backend/protocol-preparation.mjs';

const source = texts => ({ snapshot_id: 'protocol-fixture', segments: texts.map((text, index) => ({ segment_id: `part-${index}`, quote_sha256: `hash-${index}`, text })) });
const detail = 'GET /cloud/templates/{id}';
const reply = '响应 200 {"code":200,"data":{"id":11,"items":[{"price":0.3111}]}}。';

test('GET response JSON has no request body across paragraph and line layouts', () => {
  const layouts = [
    [detail, reply, 'id 和 price 为 JSON 数值。'],
    [`${detail}\n${reply}\nid 和 price 为 JSON 数值。`],
    [`${detail}\n${reply}\n`, '', 'id 和 price 为 JSON 数值。'],
    [`${detail}；${reply} id 和 price 为 JSON 数值。`],
    ['| 方法与路径 | 请求与响应 |', `| ${detail} | 200 {"code":200,"data":{"id":11}} |`],
  ];
  for (const texts of layouts) {
    const catalog = protocolCatalog(source(texts));
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].requires_body, false);
    assert.deepEqual(catalog[0].request_fields, []);
    assert.match(catalog[0].response_text, /200\s*\{/);
    assert.ok(catalog[0].source_refs.length > 0);
  }
});

test('nested request JSON is fully traversed while response fields stay separate', () => {
  const body = '{"pageNo":1,"pageSize":10,"param":{"name":"sample","applicateMonthStart":"2026-12-01","applicateMonthEnd":"2026-12-31"}}';
  const cases = [
    [`POST /cloud/templates/page，JSON ${body}`, '响应 200 {"code":200,"data":{"list":[],"total":1}}'],
    [`POST /cloud/templates/page，JSON ${body} 响应 200 {"code":200,"data":{"list":[],"total":1}}`],
    [`| POST /cloud/templates/page | JSON ${body}；200 {"code":200,"data":{"list":[],"total":1}} |`],
  ];
  for (const texts of cases) {
    const [entry] = protocolCatalog(source(texts));
    assert.equal(entry.requires_body, true);
    assert.deepEqual(entry.request_fields, ['pageNo', 'pageSize', 'param', 'name', 'applicateMonthStart', 'applicateMonthEnd']);
    assert.ok(!entry.request_fields.includes('code'));
    assert.ok(!entry.request_fields.includes('total'));
    assert.match(entry.response_text, /200\s*\{/);
  }
});

test('duplicate method/path definitions remain separate and prose references do not define endpoints', () => {
  const catalog = protocolCatalog(source([
    '正文引用 GET /cloud/templates/{id} 仅作说明。',
    `${detail}\n${reply}\nPOST /cloud/templates/page，JSON {"pageNo":1}\n响应 200 {"code":200}`,
    `${detail}\n${reply}`,
  ]));
  assert.deepEqual(catalog.map(entry => `${entry.method} ${entry.path}`), [detail, 'POST /cloud/templates/page', detail]);
  assert.equal(catalog[0].requires_body, false);
  assert.equal(catalog[1].requires_body, true);
  assert.equal(catalog[2].requires_body, false);
  assert.deepEqual(catalog[0].source_refs.map(ref => ref.segment_id), ['part-1']);
});

test('incomplete request JSON leaves fields unclear rather than borrowing response keys', () => {
  const [entry] = protocolCatalog(source(['POST /cloud/templates/page，JSON {"param":{"name":"a"}', '响应 200 {"code":200,"data":{}}']));
  assert.equal(entry.requires_body, true);
  assert.deepEqual(entry.request_fields, []);
});

test('explicit no-body wording does not create a request-body obligation', () => {
  for (const text of ['只读接口，无需认证，无请求体。', '无需发送请求体。', '不需要请求体。', '不发送任何请求体。']) {
    const [entry] = protocolCatalog(source(['GET /architecture-api/items', text, '响应 200 {"items":[],"total":0}']));
    assert.equal(entry.requires_body, false, text);
    assert.deepEqual(entry.request_fields, []);
  }
  const [post] = protocolCatalog(source(['POST /synthetic/ping，无请求体。', '响应 200 {"ok":true}']));
  assert.equal(post.requires_body, false, 'Body detection is semantic, not a blanket GET exemption');
});

test('body negation stays attached to its mention and cannot erase another clause or interface', () => {
  for (const text of ['无需认证，请求体字段尚未定义。', '没有请求体字段定义。', '无请求体；但另需请求体，字段尚未定义。', '并非无请求体。', '不是不需要请求体。', '如果无请求体。', '不支持无请求体。']) {
    const [entry] = protocolCatalog(source(['POST /synthetic/query', text, '响应 200 {"ok":true}']));
    assert.equal(entry.requires_body, true, text);
  }
  const catalog = protocolCatalog(source([
    'GET /synthetic/list\n无请求体。\n响应 200 {"items":[]}',
    'POST /synthetic/query\n请求体字段待补充。\n响应 200 {"items":[]}',
    'POST /synthetic/known\n无需认证；JSON {"name":"Beta"}\n响应 200 {"items":[]}',
    'GET /synthetic/last\n没有请求体。\n响应 200 {"items":[]}',
  ]));
  assert.deepEqual(catalog.map(entry => entry.requires_body), [false, true, true, false]);
  assert.deepEqual(catalog[2].request_fields, ['name']);
  const [conflicting] = protocolCatalog(source(['POST /synthetic/conflict\n无请求体；JSON {"name":"Beta"}\n响应 200 {"items":[]}']));
  assert.equal(conflicting.requires_body, true, 'An explicit JSON declaration remains evidence despite another negative clause');
});

test('the original synthetic GET protocol reaches preparation READY without rewriting the source', async () => {
  const protocol = { ...source(['# 架构回归固定合成协议\n\nGET /architecture-api/items\n查询参数 q 为名称子串，大小写不敏感；本例 q=Beta。只读接口，无需认证，无请求体。\n响应 200 {"items":[{"code":"ARCH-B","name":"Beta"}],"total":1}\n响应 Content-Type 为 application/json; charset=utf-8。items 仅包含名称匹配的固定数据。']), kind: 'PROTOCOL', project_id: 'project-synthetic', sha256: 'synthetic-sha' };
  const project = { project_id: 'project-synthetic', revision: 1, cases: [{ case_id: 'case-synthetic', current_version: 1,
    versions: [{ version: 1, content_sha256: 'case-sha', content: { external_id: 'HTTP-ARCH-MODEL-001', title: '固定合成查询', case_type: 'BACKEND', status: 'CONFIRMED',
      steps: [{ order: 1, action: 'GET /architecture-api/items?q=Beta，不发送请求体。', expected: 'HTTP状态200；total=1，items仅含 ARCH-B/Beta。' }] } }] }] };
  const manager = { caseStore: { getProject: async () => structuredClone(project) },
    requirementsManager: { listSources: async () => ({ sources: [protocol] }), getSource: async () => protocol, getBindings: async () => ({ bindings: [] }) },
    list: async () => ({ environments: [{ environment_id: 'env-synthetic', configuration_sha256: 'environment-sha', mode: 'http-json-readonly',
      allowed_methods: ['GET'], allowed_path_prefixes: ['/architecture-api/'] }], plans: [], model_available: false }) };
  const result = await prepareBackend(manager, project.project_id);
  assert.equal(result.catalog[0].requires_body, false);
  assert.equal(result.items[0].status, 'READY');
  assert.deepEqual(result.items[0].missing, []);
  assert.equal(result.items[0].mappings.length, 1);
  assert.equal(protocol.segments[0].text.includes('只读接口，无需认证，无请求体。'), true);
});
