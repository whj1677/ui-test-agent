import test from 'node:test';
import assert from 'node:assert/strict';
import { backendCaseReturn, backendGenerationEvidenceHtml, backendPlanSummaryHtml, backendReasons, backendRunHtml, renderBackendCase, stageBackendRevisionContext } from '../web-v2/backend.js';

test('plan review leads with requests, source baseline and cleanup while keeping product acceptance separate', () => {
  const html = backendPlanSummaryHtml({ environment_id: 'test-env', request_timeout_ms: 5000, timeout_ms: 20000, setup: [], cleanup: [], steps: [{ order: 1, requests: [
    { id: 'before', method: 'GET', path: '/api/books?page=1', assertions: [{ target: 'status', op: 'equals', value: 200 }] },
    { id: 'after', response_ref: 'before', assertions: [{ target: 'json', pointer: '/total', op: 'equals', expected_from: { request_id: 'before', pointer: '/total' } }, { target: 'header', pointer: '/content-type', op: 'media_type_equals', value: 'application/json' }] },
  ] }] }, [{ order: 1, action: '查询图书', expected: '结果数量保持一致' }], { state: 'CONFIRMED', reviewer: '张三' });
  for (const phrase of ['GET /api/books?page=1', '查询参数', '复核已取得响应', '基线来自 before 的 JSON /total', '响应 Content-Type', '媒体类型等于', '结果数量保持一致', '单请求 5000 ms', '产品验收']) assert.ok(html.includes(phrase), phrase);
  assert.ok(!html.includes('已验收'));
  assert.ok(!html.includes('<script>'));
});

const generationPlan = {
  generation_session: {
    status: 'COMPLETED',
    limits: { wall_ms: 120000, tool_calls: 18, harness_starts: 2, self_tests: 2 },
    tool_calls_used: 7,
    harness_starts: 1,
    provider_requests: null,
    provider_usage: null,
    finished_at: '2026-09-27T03:00:00.000Z',
    self_tests: [
      { number: 1, execution_sha256: 'old-hash', status: 'FAILED', started_at: 'start-1', finished_at: 'end-1', result: { status: 'FAILED', actual: '<script>' } },
      { number: 2, execution_sha256: 'candidate-hash', status: 'PASSED', started_at: 'start-2', finished_at: 'end-2', result: { status: 'PASSED' } },
    ],
    candidate: { status: 'READY', execution_sha256: 'candidate-hash', submitted_at: 'submitted' },
  },
};

test('DSH evidence renders session budgets, unknown provider usage, each self-test and pending candidate review', () => {
  const plan = structuredClone(generationPlan);
  plan.generation_session.self_tests[0].result = {
    status: 'FAILED', execution_status: 'FINISHED', requests_sent: 1,
    steps: [{ order: 1, action: '查询订单', expected: '订单状态为已支付', status: 'FAILED', requests: [{
      request_id: 'query-order', status: 'FAILED', request: { method: 'GET', path: '/api/orders/1' },
      response: { status: 200, body: { note: '<script>' } }, assertions: [{ target: 'json', pointer: '/status', op: 'equals', expected: 'PAID', actual: 'PENDING', status: 'FAILED' }],
    }] }],
  };
  const html = backendGenerationEvidenceHtml(plan, [{ order: 1, action: '查询订单', expected: '订单状态为已支付' }]);
  assert.match(html, /自动生成会话已结束/);
  assert.match(html, /生成和自测结束后/);
  assert.match(html, /最长 120 秒/);
  assert.match(html, /工具调用 7 \/ 18/);
  assert.match(html, /自动生成启动 1 \/ 2/);
  assert.match(html, /自测 2 \/ 2/);
  assert.equal((html.match(/未提供可靠统计/g) || []).length, 2);
  assert.match(html, /第 1 次 · 失败/);
  assert.match(html, /第 2 次 · 通过/);
  assert.match(html, /候选已提交，待按业务要求审阅/);
  assert.match(html, /不会自动确认计划/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /原预期/);
  assert.match(html, /订单状态为已支付/);
  assert.match(html, /PAID/);
  assert.match(html, /PENDING/);
  assert.match(html, /<details class="backend-self-test"><summary>/, 'self-test details start collapsed');
  assert.match(html, /<details class="backend-self-test-technical"><summary>/, 'technical JSON starts collapsed');
  assert.match(html, /完整计划哈希/);
});

test('independent review renders actual finding schema, uncertain steps and separate usage without approving', () => {
  const plan = structuredClone(generationPlan);
  plan.generation_session.limits = { wall_ms: 900000, tool_calls: 80, harness_starts: 1, self_tests: 5, quality_reviews: 3, independent_validations: 2 };
  plan.generation_session.quality_reviews = [{ number: 1, status: 'NEEDS_ANALYSIS', candidate_sha256: 'candidate-hash',
    self_test_number: 2, input_sha256: 'review-input-hash', model_calls: 1, usage: { total_tokens: 17 },
    steps: [{ order: 1, implementation: 'UNCERTAIN', explanation: '分页结果集合未能定位到完整比较' }],
    findings: [{ kind: 'MISSING_ASSERTION', step_order: 1, source: { field: 'expected', quote: '包含 BK-001' },
      location: { pointer: '/steps/0/requests/0/assertions/0' }, message: '缺成员断言', suggestion: '按原预期检查数组成员' }] }];
  plan.generation_session.independent_validations = [{ number: 1, status: 'FAILED', execution_sha256: 'candidate-hash',
    self_test_number: 2, result: { status: 'FAILED', requests_sent: 1, cleanup_error: null } }];
  const html = backendGenerationEvidenceHtml(plan);
  for (const phrase of ['付费独立质量审查 1 / 3', '独立复验 1 / 2', 'UNCERTAIN', '分页结果集合未能定位到完整比较',
    'MISSING_ASSERTION', '原用例 expected', '包含 BK-001', '/steps/0/requests/0/assertions/0', '缺成员断言', '按原预期检查数组成员']) assert.match(html, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /来源未定位|位置未定位/);
});

test('failed DSH session shows bounded diagnostic clues and collapsed allowlisted process facts', () => {
  const html = backendGenerationEvidenceHtml({ generation_session: {
    status: 'FAILED', error: 'BACKEND_HARNESS_PROCESS_FAILED', provider_requests: null, provider_usage: null,
    process_diagnostic: {
      failure_stage: 'PROCESS_EXIT_NONZERO', stderr_class: 'PROVIDER_HTTP_FAILURE', event_error_class: null,
      provider_http_status: 404, exit_code: 1, termination: null, final_seen: false, turn_end_reason: 'error',
      dsh_tool_call_events: 2, dsh_tool_result_events: 1, output_complete: true, exit_observed: true, close_observed: true,
      error_code: 'BACKEND_HARNESS_PROCESS_FAILED', unrecognized: 'do-not-render-secret',
    },
  } });
  assert.match(html, /诊断线索（有限事件的启发式分类，不能证明根因）/);
  assert.match(html, /进程以非零代码退出/);
  assert.match(html, /模型服务 HTTP 404/);
  assert.match(html, /<details class="backend-process-diagnostic"><summary>/, 'process details start collapsed');
  assert.match(html, /自动生成工具调用事件数<\/dt><dd>2/);
  assert.match(html, /收到最终事件<\/dt><dd>否/);
  assert.match(html, /未提供可靠统计/);
  assert.doesNotMatch(html, /do-not-render-secret/);
  assert.doesNotMatch(html, /<details class="backend-process-diagnostic" open/);
});

test('successful DSH diagnostics add no failure warning and legacy failures state that details were not saved', () => {
  const success = backendGenerationEvidenceHtml({ generation_session: {
    status: 'COMPLETED', process_diagnostic: { failure_stage: 'COMPLETED', final_seen: true, turn_end_reason: 'completed' },
  } });
  assert.match(success, /有限进程诊断详情/);
  assert.doesNotMatch(success, /诊断线索（|<p class="notice warning">/);

  const legacyFailure = backendGenerationEvidenceHtml({ generation_session: { status: 'FAILED', error: 'BACKEND_HARNESS_PROCESS_FAILED' } });
  assert.match(legacyFailure, /该历史失败记录未保存过程诊断详情，根因未知/);
  assert.doesNotMatch(legacyFailure, /进程以非零代码退出|模型服务 HTTP/);
});

test('legacy plans with no DSH session show no fabricated DSH session or self-test', () => {
  assert.equal(backendGenerationEvidenceHtml({ plan_id: 'legacy', model_requests: [] }), '');
});

test('edited DSH plan self-test hash rejection gives explicit recovery paths', () => {
  assert.match(backendReasons.BACKEND_HARNESS_SELF_TEST_REQUIRED, /冻结哈希不一致/);
  assert.match(backendReasons.BACKEND_HARNESS_SELF_TEST_REQUIRED, /脚本生成与自测/);
  assert.match(backendReasons.BACKEND_HARNESS_SELF_TEST_REQUIRED, /空白人工计划（不调用模型）/);
});

async function renderScriptsPage(plan, { tab = 'scripts', caseStatus = 'CONFIRMED', currentVersion = 1, onEdit, returnTo, candidates = [], configured = true, modelAvailable = true, bindingsAvailable = true, exercise, records = [], generationLimits = { wall_ms: 900000, tool_calls: 80, harness_starts: 1, self_tests: 5, quality_reviews: 3, independent_validations: 2 } } = {}) {
  const htmlState = { value: '' };
  const nodes = new Map(), requests = [], notices = [], navigations = [], batchLaunches = [];
  const query = new URLSearchParams('version=1&plan_id=plan-1');
  query.set('tab', tab);
  if (returnTo != null) query.set('return', returnTo);
  const root = {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, { listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; }, toggleAttribute() {}, querySelector(child) { return root.querySelector(child); }, insertAdjacentHTML() {}, closest() { return {}; } }); return nodes.get(selector); },
    addEventListener() {},
  };
  const priorDocument = globalThis.document, priorLocation = globalThis.location, priorFormData = globalThis.FormData;
  globalThis.document = {
    querySelector(selector) { return selector === '.backend-case' ? root : null; },
    querySelectorAll() { return []; },
    createElement() { return {}; },
    head: { append() {} },
  };
  globalThis.location = { hash: `#/projects/project-1/cases/case-1?${query}` };
  const content = { case_type: 'BACKEND', status: caseStatus, external_id: 'TC-1', title: '查询业务记录', module: '查询', steps: [{ order: 1, action: '查询记录', expected: '返回匹配记录' }] };
  const item = { case_id: 'case-1', current_version: currentVersion, versions: [{ version: 1, content, content_sha256: 'case-hash' }] };
  const environment = { environment_id: 'env-1', name: '测试环境', base_url: 'http://127.0.0.1:4401', mode: 'http-json-readonly', allowed_path_prefixes: ['/api/books/'], reviewer: '核对人' };
  const binding = { version: 1, case_version: 1, case_content_sha256: 'case-hash', status: 'COMPLETE', confirmation_status: 'CONFIRMED', applicability: 'CURRENT' };
  const api = async (url, options) => {
    if (options) {
      const body = JSON.parse(options.body);
      requests.push({ url, method: options.method, body });
      if (url.endsWith('/confirm')) { plan = { ...plan, state: 'CONFIRMED', reviewer: body.reviewer }; return plan; }
      return { plan_id: 'created-plan' };
    }
    if (url.endsWith('/environment')) return { revision: configured ? 1 : 0, backend_environment_id: configured ? environment.environment_id : null, backend: configured ? environment : null, backend_options: [environment] };
    if (url.includes('/backend?')) return { environments: [environment], plans: [plan], model_available: modelAvailable, generation_limits: generationLimits };
    if (url.includes('/automation?')) return { candidates };
    if (url.includes('/requirements/bindings?')) return { bindings: bindingsAvailable ? [binding] : [] };
    if (url.endsWith('/execution-records')) return { records };
    if (url.endsWith('/batches')) return { batches: [] };
    throw Error(`Unexpected API request: ${url}`);
  };
  try {
    await renderBackendCase({
      project: { project_id: 'project-1', name: '项目' }, item,
      version: item.versions[0], query, onEdit,
      showPage(html) { htmlState.value = html; }, go(url) { navigations.push(url); }, toast(message) { notices.push(message); }, api, launchBatch(...args) { batchLaunches.push(args); },
    });
    if (exercise) {
      globalThis.FormData = class { constructor(entries) { this.entries = entries; } get(key) { return this.entries[key] ?? null; } has(key) { return Object.hasOwn(this.entries, key); } };
      await exercise({ nodes, requests, notices, navigations, batchLaunches, async click(selector) {
        const node = nodes.get(selector), handler = node?.listeners.click || node?.onclick;
        assert.ok(handler, `${selector} has a click handler`);
        handler();
        await new Promise(resolve => setImmediate(resolve));
      }, async submit(selector, value, entries = {}) {
        const handler = nodes.get(selector)?.listeners.submit;
        assert.ok(handler, `${selector} has a submit handler`);
        handler({ preventDefault() {}, currentTarget: { environment_id: 'env-1', binding_version: '1', quality_review_mode: 'static-v1', ...entries }, submitter: { value } });
        await new Promise(resolve => setImmediate(resolve));
      } });
    }
    return htmlState.value;
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    globalThis.FormData = priorFormData;
    if (priorLocation === undefined) delete globalThis.location; else globalThis.location = priorLocation;
  }
}

test('backend scripts page distinguishes DSH session from manual zero-model plan creation', async () => {
  const plan = {
    plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-1',
    state: 'DRAFT', revision: 1, execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-1', setup: [], steps: [], cleanup: [] },
    ...generationPlan,
  };
  const html = await renderScriptsPage(plan);
  assert.match(html, /Agent 生成并自测/);
  assert.match(html, /生成和自测结束后/);
  assert.match(html, /最长 900 秒 · 工具调用最多 80 次 · 自测最多 5 次 · 付费独立质量审查最多 3 次 · 独立复验最多 2 次 · 自动生成启动最多 1 次/);
  assert.match(html, /会内可以检查结果并在不改变原用例预期的前提下修订、复测/);
  assert.match(html, /会话结束后不会自动重启/);
  assert.match(html, /发送实际 HTTP 请求/);
  assert.match(html, /创建空白计划，不调用模型|创建空白人工计划（不调用模型）/);
  assert.match(html, /value="revise"[^>]*>修订并自测/);
  assert.match(html, /value="regenerate"[^>]*>从头生成并自测/);
  assert.equal((html.match(/name="skill_profile" type="checkbox"/g) || []).length, 2, 'creation and rework forms each expose an opt-in checkbox');
  assert.doesNotMatch(html, /name="allow_model"/);
  assert.match(html, /旧版本保留/);
  assert.match(html, /type="hidden" name="environment_id" value="env-1"/);
  assert.doesNotMatch(html, /<select name="environment_id"|id="backend-environment-form"/);
  assert.doesNotMatch(html, /最多生成一次|单次模型生成计划/);
  assert.match(html, /HTTP 自测记录（2）/);
  assert.match(html, /候选已提交，待按业务要求审阅/);
  assert.match(html, /id="backend-confirm-plan"/);
  assert.match(html, /我已逐步核对原业务预期/);
  assert.match(html, /从协议到可执行计划/);
  assert.match(html, /上传协议只提供参考内容/);
  assert.ok(html.indexOf('id="backend-plan-summary"') < html.indexOf('class="backend-plan-technical"'));
  assert.match(html, /<details class="backend-plan-technical"><summary>技术详情与 JSON 编辑/);
  assert.match(html, /id="backend-plan-json"/);
  assert.doesNotMatch(html, /失败不会自动修复或重试/);
});

test('missing DSH limits blocks paid generation and revision but preserves manual plan creation', async () => {
  const plan = {
    plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-1',
    state: 'DRAFT', revision: 1, execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-1', setup: [], steps: [], cleanup: [] },
    ...generationPlan,
  };
  const html = await renderScriptsPage(plan, { generationLimits: null });
  assert.match(html, /自动生成暂不可用/);
  assert.match(html, /id="backend-create-form"[\s\S]*?value="manual"(?! disabled)/);
  assert.match(html, /value="model" disabled/);
  assert.doesNotMatch(html, /name="allow_model"/);
  assert.match(html, /value="revise" disabled/);
  assert.match(html, /value="regenerate" disabled/);
});

test('unconfigured project cannot create plans and provides a working configuration link while retaining history', async () => {
  const html = await renderScriptsPage({ plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-1',
    state: 'DRAFT', revision: 1, execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-1', setup: [], steps: [], cleanup: [] } }, { configured: false });
  assert.match(html, /value="manual" disabled/);
  assert.match(html, /value="model" disabled/);
  assert.match(html, /href="#\/projects\/project-1\/auth"/);
  assert.doesNotMatch(html, /\$\{pid\}/);
  assert.match(html, /计划版本历史/);
});

test('readable historical plan keeps its own environment instead of using the current project target name', async () => {
  const plan = { plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-old',
    state: 'DRAFT', revision: 1, execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-old', setup: [], steps: [], cleanup: [] } };
  const before = structuredClone(plan);
  const html = await renderScriptsPage(plan);
  assert.match(html, /执行范围<\/strong> 环境 env-old/);
  assert.doesNotMatch(html, /执行范围<\/strong> 环境 测试环境/);
  assert.deepEqual(plan, before);
});

test('backend scripts page blocks confirmation without a reviewable DSH candidate and shows manual recovery', async () => {
  const plan = {
    plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-1',
    state: 'FAILED', revision: 1, error: 'BACKEND_HARNESS_CANDIDATE_REQUIRED',
    execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-1', setup: [], steps: [], cleanup: [] },
    generation_session: { ...generationPlan.generation_session, status: 'FAILED', self_tests: [], candidate: { status: 'ENVIRONMENT_BLOCKED', execution_sha256: 'attempted-hash' } },
  };
  const html = await renderScriptsPage(plan);
  assert.doesNotMatch(html, /id="backend-confirm-plan"/);
  assert.match(html, /尚无可审阅候选，不能确认/);
  assert.match(html, /重新启动脚本生成与自测/);
  assert.match(html, /创建空白计划，不调用模型|创建空白人工计划（不调用模型）/);
});

test('candidate confirmation requires a completed session and a DRAFT plan', async () => {
  const base = {
    plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-1',
    revision: 1, execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-1', setup: [], steps: [], cleanup: [] },
    generation_session: { ...generationPlan.generation_session, candidate: { status: 'READY', execution_sha256: 'candidate-hash' } },
  };
  for (const changed of [
    { state: 'DRAFT', generation_session: { ...base.generation_session, status: 'RUNNING' } },
    { state: 'FAILED', generation_session: { ...base.generation_session, status: 'COMPLETED' } },
  ]) {
    const html = await renderScriptsPage({ ...base, state: 'DRAFT', ...changed });
    assert.doesNotMatch(html, /id="backend-confirm-plan"/);
    assert.match(html, /尚无可审阅候选，不能确认/);
  }
  const confirmed = await renderScriptsPage({ ...base, state: 'CONFIRMED', generation_session: { ...base.generation_session, status: 'COMPLETED' } });
  assert.doesNotMatch(confirmed, /id="backend-confirm-plan"/);
  assert.match(confirmed, /已由 .* 确认并冻结/);
});

test('readonly GET runs without setup or cleanup do not claim missing cleanup evidence', () => {
  const run = {
    run_id: 'readonly-1', status: 'PASSED', execution_status: 'FINISHED', environment_binding: { mode: 'http-json-readonly' },
    http_evidence: { setup: [], steps: [], cleanup: [] },
  };
  const readonlyHtml = backendRunHtml(run);
  assert.match(readonlyHtml, /只读 GET 环境未配置初始化或清理请求，无需单独清理/);
  assert.doesNotMatch(readonlyHtml, /未取得清理记录，不能视为清理成功/);
  const unknownHtml = backendRunHtml({ ...run, environment_binding: undefined });
  assert.match(unknownHtml, /未取得清理记录，不能视为清理成功/);
});

test('response-reference evidence is shown as a stored response review and keeps its assertions', () => {
  const html = backendRunHtml({
    run_id: 'run-page-1', status: 'PASSED', execution_status: 'FINISHED',
    environment_binding: { mode: 'http-json-readonly' },
    http_evidence: { setup: [], cleanup: [], steps: [{
      order: 3, action: '合并两页结果与初始数据核对', expected: '共8条，无重复、无遗漏', status: 'PASSED', requests: [{
        request_id: 'compare-pages', status: 'PASSED',
        request: { kind: 'response-reference', source_request_id: 'page-two' },
        response: { status: 200, body: { total: 8 } },
        assertions: [{ target: 'json', pointer: '/total', op: 'equals', expected: 8, actual: 8, status: 'PASSED' }],
      }],
    }] },
  });
  assert.match(html, /复核已存响应 · 来源 page-two/);
  assert.match(html, /来源与冻结响应/);
  assert.match(html, /共8条，无重复、无遗漏/);
  assert.match(html, /<code>8<\/code>/);
  assert.doesNotMatch(html, /compare-pages · 未发送/);
});


const actionPlan = {
  plan_id: 'plan-1', version: 1, case_version: 1, binding_version: 1, environment_id: 'env-1',
  state: 'DRAFT', revision: 7,
  execution: { schema: 'workbench/backend-execution-v1', environment_id: 'env-1', setup: [], steps: [], cleanup: [] },
};

function outsideCollapsedDetails(html) {
  let depth = 0, visible = '', previous = 0;
  for (const match of html.matchAll(/<details\b[^>]*>|<\/details>/g)) {
    if (!depth) visible += html.slice(previous, match.index);
    depth += match[0].startsWith('</') ? -1 : 1;
    previous = match.index + match[0].length;
  }
  assert.equal(depth, 0, 'all advanced detail sections close');
  return visible + html.slice(previous);
}

test('backend normal view keeps service budgets and usage in collapsed advanced details', async () => {
  const html = await renderScriptsPage({ ...actionPlan, ...generationPlan });
  assert.match(html, /<details class="backend-generation-advanced"><summary>高级详情/);
  assert.match(html, /<details class="backend-advanced wide"><summary>高级设置/);
  assert.doesNotMatch(outsideCollapsedDetails(html), /DSH|模型用量|底层模型调用数|会话预算|工具调用最多|潜在费用|剩余预算/);
  assert.match(html, /工具调用最多 80 次/);
  assert.match(html, /生成和自测结束后/);
  assert.match(outsideCollapsedDetails(html), /我已逐步核对原业务预期/);
});

test('explicit generate, revise and regenerate submit once without a fee checkbox; manual remains model-free', async () => {
  await renderScriptsPage(actionPlan, { exercise: async ({ submit, requests, navigations }) => {
    assert.equal(requests.length, 0, 'rendering never submits an action');
    for (const [selector, action, extra] of [
      ['#backend-create-form', 'model', {}],
      ['#backend-rework-form', 'revise', { feedback: '缺少状态断言' }],
      ['#backend-rework-form', 'regenerate', {}],
      ['#backend-create-form', 'manual', {}],
    ]) {
      const before = requests.length;
      await submit(selector, action, extra);
      assert.equal(requests.length, before + 1, 'one API request per explicit action');
      const { url, body } = requests.at(-1);
      assert.match(url, /\/backend\/plans$/);
      assert.equal(body.case_id, 'case-1');
      assert.equal(body.case_version, 1);
      assert.equal(body.binding_version, 1);
      assert.equal(body.environment_id, 'env-1');
      assert.equal(body.generate, action !== 'manual');
      assert.equal(body.allow_model, action !== 'manual');
      assert.equal(body.quality_review_mode, 'static-v1');
      assert.equal(body.skill_profile, 'off');
      if (selector === '#backend-rework-form') assert.equal(body.source_plan_id, 'plan-1');
      if (action === 'revise') assert.equal(body.feedback, '缺少状态断言');
      else assert.equal(body.feedback, undefined);
    }
    assert.equal(navigations.length, 4);
  } });
});

test('unavailable service or absent limits block explicit generation and keep manual creation available', async () => {
  for (const unavailable of [{ modelAvailable: false }, { generationLimits: null }]) {
    const html = await renderScriptsPage(actionPlan, { ...unavailable, exercise: async ({ submit, requests, notices }) => {
      await submit('#backend-create-form', 'model');
      await submit('#backend-rework-form', 'revise', { feedback: '缺少断言' });
      await submit('#backend-rework-form', 'regenerate');
      assert.equal(requests.length, 0, 'service gating survives direct handler submission');
      assert.equal(notices.length, 3);
      assert.ok(notices.every(message => message.includes('联系工作台管理员')));
      await submit('#backend-create-form', 'manual');
      assert.equal(requests.length, 1);
      assert.equal(requests[0].body.generate, false);
      assert.equal(requests[0].body.allow_model, false);
    } });
    for (const action of ['model', 'revise', 'regenerate']) assert.match(html, new RegExp(`value="${action}" disabled`));
    assert.doesNotMatch(html, /value="manual" disabled/);
  }
});

test('protocol binding remains required and business review is distinct from generation submission', async () => {
  const blocked = await renderScriptsPage(actionPlan, { bindingsAvailable: false });
  for (const action of ['model', 'revise', 'regenerate', 'manual']) assert.match(blocked, new RegExp(`value="${action}" disabled`));
  await renderScriptsPage(actionPlan, { exercise: async ({ nodes, requests, notices }) => {
    const reviewed = nodes.get('#backend-reviewed') || {};
    nodes.set('#backend-reviewed', reviewed);
    reviewed.checked = false;
    nodes.get('#backend-confirm-plan').listeners.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 0);
    assert.match(notices.at(-1), /请先逐步核对原预期、请求、断言和清理/);
  } });
});

test('failed generation gives testers recovery steps while preserving diagnosis in advanced details', () => {
  const html = backendGenerationEvidenceHtml({ generation_session: { status: 'FAILED', error: 'BACKEND_HARNESS_PROCESS_FAILED' } });
  assert.match(outsideCollapsedDetails(html), /联系工作台管理员检查服务/);
  assert.match(outsideCollapsedDetails(html), /恢复后点击修订或重新生成/);
  assert.doesNotMatch(outsideCollapsedDetails(html), /BACKEND_HARNESS_PROCESS_FAILED|根因未知|模型用量/);
});


test('explicit backend revision retains the original failure run and plan identity', async () => {
  stageBackendRevisionContext({ project_id: 'project-1', case_id: 'case-1', case_version: 1, plan_id: 'plan-1', run_id: 'failed-run', feedback: '实际状态为待支付' });
  const record = { run_id: 'failed-run', project_id: 'project-1', executed_case_id: 'case-1', executed_case_version: 1, source_build_task_id: 'plan-1', environment_id: 'env-1', status: 'FAILED' };
  await renderScriptsPage(actionPlan, { records: [record], exercise: async ({ submit, requests }) => {
    assert.equal(requests.length, 0, 'loading original feedback does not submit it');
    await submit('#backend-rework-form', 'revise', { feedback: '实际状态为待支付' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.run_id, 'failed-run');
    assert.equal(requests[0].body.source_plan_id, 'plan-1');
    assert.equal(requests[0].body.feedback, '实际状态为待支付');
    assert.equal(requests[0].body.allow_model, true);
  } });
});


test('backend return links accept only this project workbench or case routes', () => {
  const fallback = '#/projects/project-1/cases';
  for (const href of ['#/projects/project-1', '#/projects/project-1/automation', '#/projects/project-1?test_type=backend&selected=case-1,case-2']) {
    assert.deepEqual(backendCaseReturn('project-1', href), { href, label: '返回工作台', workbench: true });
  }
  for (const href of ['#/projects/project-1/cases?type=backend', '#/projects/project-1/cases/case-1?version=2']) {
    assert.equal(backendCaseReturn('project-1', href).href, href);
  }
  for (const href of ['https://example.test', '//example.test', '#/projects/project-2', '#/projects/project-1-other/cases',
    '#/projects/project-1/cases-elsewhere', '#/projects/project-1?return=https://example.test', '#/projects/project-1?test_type=ui',
    '#/projects/project-1?test_type=backend&test_type=backend', '#/projects/project-1?selected=case-1,%22onclick%3Dalert(1)',
    '#/projects/project-1?selected=case-1&selected=case-2', '#/projects/project-1?selected=case-1,']) {
    assert.equal(backendCaseReturn('project-1', href).href, fallback, href);
  }
});

test('selected plan review leads and preparation, generation evidence and history stay collapsed', async () => {
  const html = await renderScriptsPage({ ...actionPlan, ...generationPlan }, { returnTo: '#/projects/project-1?test_type=backend&selected=case-1,case-2' });
  const visible = outsideCollapsedDetails(html);
  assert.match(visible, /id="backend-plan-summary"/);
  assert.match(visible, /id="backend-confirm-plan"/);
  assert.doesNotMatch(visible, /id="backend-create-form"|从协议到可执行计划|HTTP 自测记录|计划版本历史/);
  assert.match(html, /<details class="backend-generation-history"><summary>/);
  assert.match(html, /<details class="panel backend-plan-preparation"><summary>/);
  assert.match(html, /<details class="panel backend-plan-history"><summary>/);
  assert.match(html, /href="#\/projects\/project-1\?test_type=backend&amp;selected=case-1,case-2">← 返回工作台/);
});

test('confirming a plan preserves explicit review and offers the same batch confirmation without auto-running', async () => {
  const selection = { kind: 'HTTP_JSON', case_id: 'case-1', case_version: 1, source_task_id: 'plan-1', candidate_version: 1, bundle_sha256: 'plan-hash', environment_id: 'env-1' };
  const before = structuredClone(actionPlan);
  const html = await renderScriptsPage(actionPlan, {
    returnTo: '#/projects/project-1?test_type=backend&selected=case-1,case-2',
    candidates: [{ source_task_id: 'plan-1', applies_to_selected_version: true, selection }],
    exercise: async ({ nodes, requests, notices, batchLaunches, click }) => {
      await click('#backend-run-reviewed');
      assert.equal(batchLaunches.length, 0, 'draft plan cannot run through an action handler');
      await click('#backend-confirm-plan');
      assert.equal(requests.length, 0, 'review acknowledgement remains required');
      assert.match(notices.at(-1), /请先逐步核对原预期/);
      nodes.get('#backend-reviewed').checked = true;
      nodes.get('#backend-plan-json').value = JSON.stringify(actionPlan.execution);
      nodes.set('#backend-reviewer', { value: ' 测试核对人 ' });
      await click('#backend-confirm-plan');
      assert.equal(requests.length, 1);
      assert.match(requests[0].url, /\/backend\/plans\/plan-1\/confirm$/);
      assert.deepEqual(requests[0].body, { revision: 7, reviewer: '测试核对人', execution: actionPlan.execution });
      assert.equal(batchLaunches.length, 0, 'confirmation never starts a run');
      await click('#backend-run-reviewed');
      assert.equal(batchLaunches.length, 1);
      assert.deepEqual(batchLaunches[0].slice(1), ['single', ['case-1'], [selection], { case_id: 'case-1', case_version: 1 }]);
    },
  });
  assert.deepEqual(actionPlan, before, 'rendering and confirmation do not mutate the supplied plan');
  const visible = outsideCollapsedDetails(html);
  assert.match(visible, /id="backend-run-reviewed" >运行此用例/);
  assert.match(visible, /href="#\/projects\/project-1\?test_type=backend&amp;selected=case-1,case-2">返回工作台/);
  assert.doesNotMatch(visible, /id="backend-confirm-plan"/);
});


test('current backend content remains editable before confirmation and historical content stays read-only', async () => {
  for (const caseStatus of ['PENDING_CONFIRMATION', 'CONFIRMED']) {
    let edits = 0;
    const html = await renderScriptsPage(actionPlan, {
      tab: 'content', caseStatus, onEdit: () => { edits += 1; },
      exercise: async ({ click }) => { await click('#backend-edit-case'); },
    });
    assert.match(html, /id="backend-edit-case">编辑当前用例版本/);
    assert.doesNotMatch(html, /历史用例只读/);
    assert.equal(edits, 1);
    const historical = await renderScriptsPage(actionPlan, {
      tab: 'content', caseStatus, currentVersion: 2, onEdit: () => { edits += 1; },
    });
    assert.match(historical, /历史用例只读/);
    assert.doesNotMatch(historical, /id="backend-edit-case"/);
  }
});

test('editing pending backend content does not enable generation or plan confirmation', async () => {
  const html = await renderScriptsPage(actionPlan, { caseStatus: 'PENDING_CONFIRMATION', onEdit() {} });
  for (const action of ['model', 'manual']) {
    assert.match(html, new RegExp(`value="${action}" disabled`));
  }
  assert.doesNotMatch(html, /value="revise"|value="regenerate"/);
  assert.doesNotMatch(html, /id="backend-confirm-plan"/);
  assert.match(html, /id="backend-plan-json"[^>]*readonly/);
});
