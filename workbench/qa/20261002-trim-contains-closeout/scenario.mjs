import http from 'node:http';
import { once } from 'node:events';
import { backendDigest } from '../../server/backend/execution.mjs';

// Explicit new synthetic dataset, never an edit of the old 8-book dataset.
export const dataset = Object.freeze([
  { code: 'BK-001', title: '围城', category: '小说', status: '在架' },
  { code: 'BK-006', title: '深入浅出Node.js', category: '科技', status: '在架' },
  { code: 'BK-106', title: '合成测试记录106', category: '科技', status: '在架' },
  { code: 'XY-006', title: '合成测试记录XY', category: '历史', status: '借出' },
].map(Object.freeze));
export const samples = Object.freeze([
  { raw: '', records: [...dataset] },
  { raw: ' K-00 ', records: [dataset[0], dataset[1]] },
  { raw: ' K-999 ', records: [] },
  { raw: ' \t ', records: [...dataset] },
]);
export const frozenCase = Object.freeze({
  case_type: 'BACKEND', status: 'CONFIRMED',
  title: '独立合成：原样含空格部分编号与空关键词边界',
  preconditions: '独立只读合成数据集恰含BK-001、BK-006、BK-106、XY-006；不读取或修改旧项目数据。查询无分类/状态筛选，从page=1发起，每页5条，编号升序。',
  test_data: '固定四条记录见dataset；原始输入依次为空串、一个空格+K-00+一个空格、一个空格+K-999+一个空格、空格+Tab+空格。编号或书名包含匹配，不区分大小写，去输入两端空格；空关键词不筛选。',
  steps: [
    { order: 1, action: 'GET查询空关键词page=1，建立字面基线。', expected: '返回四条固定记录BK-001、BK-006、BK-106、XY-006，编号升序；逐记录code/title/category/status符合固定数据；total=4、page=1、page_size=5、pages=1。' },
    { order: 2, action: 'GET以原样“ K-00 ”查询page=1，不在调用侧trim。', expected: '去除两端空格后按编号包含匹配；只返回BK-001与BK-006，按编号升序且四字段符合固定数据，排除BK-106和XY-006；total=2、page=1、page_size=5、pages=1。' },
    { order: 3, action: 'GET以原样“ K-999 ”查询page=1，不在调用侧trim。', expected: 'HTTP200且可解析JSON，items为空数组、total=0、page=1、page_size=5；无命中是正常业务结果。原来源未定义零结果pages，不能补造其预期。' },
    { order: 4, action: 'GET以原样空格+Tab+空格查询page=1，独立读回全部数据。', expected: '全空白去除后为空关键词，不筛选；返回原四条记录及原四字段和顺序，数据未变；total=4、page=1、page_size=5、pages=1。' },
  ],
});

export function observations(raw, variant = 'contains-trim') {
  if (!['contains-trim', 'equals-trim', 'contains-no-trim'].includes(variant)) throw Error('UNKNOWN_VARIANT');
  const keyword = (variant === 'contains-no-trim' ? raw : raw.trim()).toLowerCase();
  const items = dataset.filter(row => !keyword || (variant === 'equals-trim'
    ? row.code.toLowerCase() === keyword || row.title.toLowerCase() === keyword
    : row.code.toLowerCase().includes(keyword) || row.title.toLowerCase().includes(keyword)));
  return { items, total: items.length, page: 1, page_size: 5, pages: Math.max(1, Math.ceil(items.length / 5)) };
}

// A tiny engineering HTTP target, not a workbench or a customer business system.
export async function startTarget(variant) {
  const requests = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== '/api/books') {
      response.writeHead(405); response.end(); return;
    }
    const raw = url.searchParams.get('keyword') ?? '';
    requests.push({ method: request.method, raw_keyword: raw, path: request.url });
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(observations(raw, variant)));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { base: `http://127.0.0.1:${server.address().port}`, requests,
    async close() { server.closeAllConnections(); server.close(); await once(server, 'close'); } };
}

export function input(base, candidateVariant = 'raw-partial') {
  const caseHash = backendDigest(frozenCase).toUpperCase();
  const environment = { id: 'synthetic-trim-contains', mode: 'http-json-readonly', base_url: base,
    non_production: true, authorized: true, allowed_methods: ['GET'], allowed_headers: [], allowed_path_prefixes: ['/api/books/'] };
  const steps = samples.map((sample, index) => {
    let raw = sample.raw;
    if (index === 1 && candidateVariant === 'complete-id') raw = ' BK-006 ';
    if (candidateVariant === 'caller-trim') raw = raw.trim();
    const assertions = [
      { target: 'status', op: 'equals', value: 200 },
      { target: 'header', pointer: '/content-type', op: 'media_type_equals', value: 'application/json' },
      { target: 'json', pointer: '/items', op: 'length', value: sample.records.length },
      ...['total', 'page', 'page_size'].map(key => ({ target: 'json', pointer: '/' + key, op: 'equals',
        value: key === 'total' ? sample.records.length : key === 'page' ? 1 : 5 })),
      ...(sample.records.length ? [{ target: 'json', pointer: '/pages', op: 'equals', value: 1 }] : []),
      ...sample.records.flatMap((record, row) => Object.entries(record).map(([field, value]) =>
        ({ target: 'json', pointer: `/items/${row}/${field}`, op: 'equals', value }))),
    ];
    return { order: index + 1, requests: [{ id: 'query-' + (index + 1), method: 'GET',
      path: '/api/books?page=1&keyword=' + encodeURIComponent(raw) + '&category=&status=', assertions }] };
  });
  return { caseVersion: { version: 1, content: frozenCase, content_sha256: caseHash },
    binding: { binding_id: 'synthetic-binding', version: 1, case_version: 1, case_content_sha256: caseHash,
      protocol_source_id: 'synthetic-protocol-v1', protocol_sha256: backendDigest({ path: '/api/books', methods: ['GET'] }),
      status: 'COMPLETE', confirmation_status: 'CONFIRMED' },
    execution: { schema: 'workbench/backend-execution-v1', environment_id: environment.id, setup: [], cleanup: [], steps,
      request_timeout_ms: 1000, timeout_ms: 5000 }, environment };
}

export function reviewInput(args, evidence) {
  return { kind: 'backend', frozenCase: args.caseVersion.content,
    caseSha256: args.caseVersion.content_sha256.toLowerCase(), candidateSha256: backendDigest(args.execution),
    execution: args.execution, context: { scope: 'independent synthetic engineering case', protocol: 'GET only; JSON; no mutation', dataset }, evidence };
}

// Explicit authored test doubles for host contract tests, not real model judgements.
export function authoredAnswer({ weak = false } = {}) {
  return { steps: frozenCase.steps.map(step => ({ order: step.order,
    implementation: weak && step.order === 2 ? 'UNCERTAIN' : 'COVERED',
    explanation: '离线审查契约样本；业务oracle来自冻结数据和真实执行矩阵。',
    locations: [{ pointer: `/steps/${step.order - 1}/requests/0` }] })),
    findings: weak ? [{ kind: 'WEAK_ASSERTION', step_order: 2,
      source: { field: 'expected', quote: '去除两端空格后按编号包含匹配' },
      message: '候选改变了冻结的原样部分编号输入，不能证明trim后的包含规则。',
      suggestion: '恢复冻结原样输入K-00及明确结果集合，不改源预期。', location: { pointer: '/steps/1/requests/0/path' } }] : [] };
}
