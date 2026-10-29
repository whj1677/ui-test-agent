import test from 'node:test';
import assert from 'node:assert/strict';
import { protocolCatalog } from '../server/backend/protocol-preparation.mjs';

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
