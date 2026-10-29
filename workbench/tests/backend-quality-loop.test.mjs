import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendHarnessSession } from '../server/backend/harness-session.mjs';
import { backendDigest } from '../server/backend/schema.mjs';
import { CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS } from '../server/quality-review.mjs';

const copy = value => structuredClone(value);
const good = () => ({ status: 'PASSED', complete_pass: true, technical_error: null, cleanup_error: null,
  setup: [], cleanup: [], steps: [{ order: 1, status: 'PASSED', requests: [{ request_id: 'query', status: 'PASSED', assertions: [
    { target: 'json', pointer: '/items', op: 'equals', expected: [{ code: 'BK-001' }], actual: [{ code: 'BK-001' }], status: 'PASSED' },
  ] }] }] });
const badBusiness = () => ({ ...good(), status: 'FAILED', complete_pass: false,
  steps: [{ order: 1, status: 'FAILED', requests: [{ request_id: 'query', status: 'FAILED', assertions: [
    { target: 'json', pointer: '/items', op: 'equals', expected: [{ code: 'BK-001' }], actual: [], status: 'FAILED' },
  ] }] }] });
function fixture({ verdicts = ['NO_FINDINGS'], results = [], assertCurrent = async () => {}, signal, limits, reviewMode = 'static-v1', clock, reviewTimeout } = {}) {
  const content = { case_type: 'BACKEND', status: 'CONFIRMED', external_id: 'BE-Q-1', title: '搜索',
    steps: [{ order: 1, action: '查询图书', expected: '结果包含 BK-001' }] };
  const caseSha = backendDigest(content).toUpperCase();
  const context = { caseVersion: { version: 1, content, content_sha256: caseSha },
    binding: { version: 1, case_version: 1, case_content_sha256: caseSha, binding_id: 'binding-test',
      protocol_source_id: 'protocol-test', protocol_sha256: 'a'.repeat(64), status: 'COMPLETE', confirmation_status: 'CONFIRMED',
      mappings: [{ order: 1, path: '/api/books' }] }, protocol: { segments: [{ text: 'GET /api/books' }] } };
  const environment = { id: 'env-00000000-0000-4000-8000-000000000001', environment_id: 'env-00000000-0000-4000-8000-000000000001',
    non_production: true, authorized: true, mode: 'http-json-readonly', base_url: 'http://127.0.0.1:1',
    allowed_methods: ['GET'], allowed_headers: [], allowed_path_prefixes: ['/api/books/'] };
  const execution = { schema: 'workbench/backend-execution-v1', environment_id: environment.environment_id, setup: [], cleanup: [],
    steps: [{ order: 1, requests: [{ id: 'query', method: 'GET', path: '/api/books?keyword=BK-001', assertions: [
      { target: 'json', pointer: '/items', op: 'array_some_field_equals', field: 'code', value: 'BK-001' },
    ] }] }] };
  const plan = { plan_id: 'plan-test', project_id: 'project-test', case_id: 'case-test', case_version: 1, quality_review_mode: reviewMode,
    content_sha256: context.caseVersion.content_sha256, protocol_sha256: 'a'.repeat(64), revision: 1, execution: null };
  let reviews = 0, executes = 0, saves = 0;
  const qualityReviewer = async ({ kind, frozenCase, caseSha256, candidateSha256, execution: input, context: reviewContext, evidence }) => {
    reviews += 1;
    assert.equal(kind, 'backend'); assert.deepEqual(frozenCase, content); assert.deepEqual(input, plan.execution);
    assert.equal(reviewContext.confirmed_binding.length, 1); assert.equal(reviewContext.protocol_segments.length, 1);
    assert.ok(evidence?.steps); assert.equal(caseSha256, plan.content_sha256);
    const status = verdicts.shift() || 'NO_FINDINGS';
    return { schema: 'workbench/candidate-quality-review-v1', status, case_sha256: caseSha256,
      candidate_sha256: candidateSha256, input_sha256: 'b'.repeat(64), model_calls: 1, model: 'mock', usage: { total_tokens: 7 },
      semantic_approval: false, findings: status === 'REPAIR_REQUIRED' ? [{ kind: 'MISSING_ASSERTION', step_order: 1,
        source: { field: 'expected', quote: 'BK-001' }, location: { pointer: '/steps/0/requests/0/assertions/0' },
        message: '缺少成员检查', suggestion: '按原预期添加成员断言' }] : [], steps: [] };
  };
  const execute = async () => { executes += 1; return copy(results.shift() || good()); };
  const session = new BackendHarnessSession({ plan, context, environment, execute, qualityReviewer, assertCurrent,
    persist: async () => { saves += 1; }, signal, limits, clock, reviewTimeout });
  const coverage = [{ order: 1, requirement: content.steps[0].expected, request_ids: ['query'], uncovered: '' }];
  return { session, plan, execution, coverage, counts: () => ({ reviews, executes, saves }) };
}
async function draftAndTest(f) {
  const draft = await f.session.invoke('write_draft', { previous_sha256: f.session.currentSha(), execution: f.execution });
  await f.session.invoke('self_test', {}); return draft.draft_sha256;
}
const submit = (f, sha, outcome = 'READY') => f.session.invoke('submit_candidate', { execution_sha256: sha, outcome, coverage: f.coverage });

test('submission orchestrates review and independent validation without granting approval', async()=>{
  const f=fixture(); await f.session.initialize(); const sha=await draftAndTest(f);
  const contract=f.session.readContext().submission_contract;
  assert.equal(contract.coverage[0].requirement,'结果包含 BK-001');
  assert.equal(contract.coverage[0].uncovered,null);
  const result=await submit(f,sha);
  assert.equal(result.frozen,true); assert.equal(result.semantic_approval,false);
  assert.equal(f.counts().reviews,1); assert.equal(f.counts().executes,2);
  assert.equal(f.plan.generation_session.quality_reviews[0].candidate_sha256,sha);
  assert.equal(f.plan.generation_session.independent_validations[0].execution_sha256,sha);
  assert.equal(result.progress.phase,'FROZEN_FOR_HUMAN_REVIEW');
});

test('rejected review structure diagnostics survive in the session without approving a candidate', async()=>{
  const f=fixture();await f.session.initialize();await draftAndTest(f);
  const diagnostic={scope:'step',rule:'MISSING_KEY',index:0,field:'implementation'};
  f.session.qualityReviewer=async()=>({schema:'workbench/candidate-quality-review-v1',status:'NEEDS_ANALYSIS',
    case_sha256:f.plan.content_sha256,candidate_sha256:f.session.currentSha(),input_sha256:'b'.repeat(64),
    model_calls:1,model:'mock',semantic_approval:false,steps:[],findings:[],
    error_code:'MODEL_RESPONSE_STRUCTURE_INVALID',structure_diagnostic:diagnostic});
  const result=await f.session.invoke('review_candidate',{});
  assert.equal(result.status,'NEEDS_ANALYSIS');assert.equal(f.plan.generation_session.candidate,null);
  assert.deepEqual(f.plan.generation_session.quality_reviews[0].structure_diagnostic,diagnostic);
});

test('automatic submission cannot reuse a clean review after the draft changes', async()=>{
  const f=fixture({verdicts:['NO_FINDINGS','REPAIR_REQUIRED']}); await f.session.initialize();
  const first=await draftAndTest(f); await f.session.invoke('review_candidate',{});
  const changed=copy(f.execution); changed.steps[0].requests[0].assertions.push({target:'json',pointer:'/total',op:'equals',value:1});
  const next=await f.session.invoke('write_draft',{previous_sha256:first,execution:changed});
  await f.session.invoke('self_test',{});
  const result=await submit(f,next.draft_sha256);
  assert.equal(result.status,'REPAIR_REQUIRED'); assert.equal(result.frozen,false);
  assert.equal(f.counts().reviews,2); assert.equal(f.plan.generation_session.candidate,null);
  assert.equal(f.plan.generation_session.independent_validations.length,0);
  assert.equal(f.plan.generation_session.progress.phase,'REPAIR_DRAFT');
});

test('coverage errors and invalid transport calls are counted without recording supplied secrets',async()=>{
  const f=fixture(); await f.session.initialize(); const sha=await draftAndTest(f);
  const supplied='PRIVATE_VALUE_DO_NOT_PERSIST';
  await assert.rejects(()=>f.session.invoke('submit_candidate',{execution_sha256:sha,outcome:'READY',coverage:[{...f.coverage[0],requirement:supplied}]}),/BACKEND_CANDIDATE_COVERAGE_INVALID/);
  const used=f.session.state.tool_calls_used;
  await f.session.transportFailure('write_draft','BACKEND_HARNESS_ARGUMENTS_INVALID');
  assert.equal(f.session.state.tool_calls_used,used+1);
  assert.equal(f.session.state.tool_diagnostics.errors,2);
  assert.equal(f.session.state.tool_diagnostics.recent.at(-1).error_code,'BACKEND_HARNESS_ARGUMENTS_INVALID');
  assert.equal(JSON.stringify(f.session.state).includes(supplied),false);
  assert.equal(f.counts().reviews,0); assert.equal(f.plan.generation_session.candidate,null);
});

test('same session receives located repair feedback, revises, retests, reviews and independently validates before freeze', async () => {
  const f = fixture({ verdicts: ['REPAIR_REQUIRED', 'NO_FINDINGS'] }); await f.session.initialize();
  const first = await draftAndTest(f);
  const gap = await submit(f, first);
  assert.equal(gap.status, 'REPAIR_REQUIRED'); assert.equal(gap.frozen, false);
  assert.equal(gap.findings[0].location.pointer, '/steps/0/requests/0/assertions/0');
  assert.equal(f.plan.generation_session.candidate, null);
  assert.equal((await f.session.invoke('review_candidate', {})).cached, true);
  assert.equal(f.counts().reviews, 1);
  const changed = copy(f.execution); changed.steps[0].requests[0].assertions.push({ target: 'json', pointer: '/total', op: 'equals', value: 1 });
  f.execution = changed;
  const second = await f.session.invoke('write_draft', { previous_sha256: first, execution: changed });
  await f.session.invoke('self_test', {});
  await f.session.invoke('review_candidate', {});
  await assert.rejects(() => submit(f, first), /BACKEND_CURRENT_BYTES_REQUIRE_SELF_TEST/);
  const frozen = await submit(f, second.draft_sha256);
  assert.equal(frozen.frozen, true); assert.equal(frozen.candidate.status, 'READY');
  assert.equal(f.plan.generation_session.independent_validations.length, 1);
  assert.equal(f.counts().executes, 3); assert.equal(f.counts().reviews, 2);
});

test('green self-test with independent missing coverage cannot become READY; uncertain review preserves usage and can freeze NEEDS_ANALYSIS', async () => {
  const f = fixture({ verdicts: ['REPAIR_REQUIRED'] }); await f.session.initialize();
  const sha = await draftAndTest(f);
  const reviewed = await f.session.invoke('review_candidate', {});
  assert.equal(reviewed.status, 'REPAIR_REQUIRED');
  assert.equal((await submit(f, sha)).status, 'REPAIR_REQUIRED');
  assert.equal(f.plan.generation_session.candidate, null);
  const needs = await submit(f, sha, 'NEEDS_ANALYSIS');
  assert.equal(needs.candidate.status, 'NEEDS_ANALYSIS'); assert.equal(needs.semantic_approval, false);
  assert.equal(f.plan.generation_session.quality_reviews[0].usage.total_tokens, 7);
});

test('independent mismatch is pinned to the SHA; only a changed draft can use a second validation', async () => {
  const f = fixture({ results: [good(), badBusiness(), good(), good()] }); await f.session.initialize();
  const sha = await draftAndTest(f); await f.session.invoke('review_candidate', {});
  const first = await submit(f, sha); assert.equal(first.status, 'INDEPENDENT_VALIDATION_FAILED');
  assert.equal(first.evidence.requests[0].assertions[0].actual, '[]');
  const second = await submit(f, sha); assert.equal(second.validation_number, first.validation_number);
  assert.equal(f.counts().executes, 2); assert.equal(f.plan.generation_session.candidate, null);
  await f.session.invoke('self_test', {}); await f.session.invoke('review_candidate', {});
  assert.equal((await submit(f, sha)).status, 'INDEPENDENT_VALIDATION_FAILED');
  assert.equal(f.counts().executes, 3);
  const changed = copy(f.execution); changed.steps[0].requests[0].assertions.push({ target: 'json', pointer: '/total', op: 'equals', value: 1 });
  const next = await f.session.invoke('write_draft', { previous_sha256: sha, execution: changed });
  await f.session.invoke('self_test', {}); await f.session.invoke('review_candidate', {});
  assert.equal((await submit(f, next.draft_sha256)).frozen, true);
  assert.equal(f.counts().executes, 5); assert.equal(f.plan.generation_session.independent_validations.length, 2);
});

test('review service exception consumes one durable review slot and prevents READY', async () => {
  const f = fixture(); await f.session.initialize();
  const sha = await draftAndTest(f);
  f.session.qualityReviewer = async () => { throw Error('network-details-not-for-model'); };
  const result = await f.session.invoke('review_candidate', {});
  assert.equal(result.status, 'NEEDS_ANALYSIS'); assert.equal(result.error_code, 'BACKEND_HARNESS_OPERATION_FAILED');
  assert.equal(f.plan.generation_session.quality_reviews.length, 1);
  assert.equal((await submit(f, sha)).status, 'NEEDS_ANALYSIS');
  assert.equal((await submit(f, sha, 'NEEDS_ANALYSIS')).candidate.status, 'NEEDS_ANALYSIS');
});

test('real business difference requires independent failed assertions and no technical or cleanup error', async () => {
  const f = fixture({ results: [badBusiness(), badBusiness()] }); await f.session.initialize();
  const sha = await draftAndTest(f); await f.session.invoke('review_candidate', {});
  assert.equal((await submit(f, sha, 'BUSINESS_DIFFERENCE')).candidate.status, 'BUSINESS_DIFFERENCE');
  assert.equal(f.plan.generation_session.independent_validations[0].status, 'FAILED');
});

test('review budget is reserved before calling the reviewer and cannot be regained by changing the draft', async () => {
  const f = fixture({ verdicts: ['REPAIR_REQUIRED'], limits: { quality_reviews: 1 } }); await f.session.initialize();
  const first = await draftAndTest(f); await f.session.invoke('review_candidate', {});
  const changed = copy(f.execution); changed.steps[0].requests[0].assertions.push({ target: 'json', pointer: '/total', op: 'equals', value: 1 });
  const next = await f.session.invoke('write_draft', { previous_sha256: first, execution: changed });
  await f.session.invoke('self_test', {});
  const result = await f.session.invoke('review_candidate', {});
  assert.equal(result.error_code, 'BACKEND_QUALITY_REVIEW_BUDGET_EXHAUSTED');
  assert.equal(f.counts().reviews, 1);
  assert.equal((await submit(f, next.draft_sha256)).error_code, 'BACKEND_QUALITY_REVIEW_BUDGET_EXHAUSTED');
  assert.equal((await submit(f, next.draft_sha256, 'NEEDS_ANALYSIS')).candidate.status, 'NEEDS_ANALYSIS');
});

test('identity drift after a paid review invalidates the verdict but preserves its real usage', async () => {
  let current = true;
  const f = fixture({ assertCurrent: async () => { if (!current) throw Error('BACKEND_PLAN_IDENTITY_CHANGED'); } });
  await f.session.initialize(); const sha = await draftAndTest(f);
  f.session.qualityReviewer = async ({ caseSha256, candidateSha256 }) => {
    current = false;
    return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
      candidate_sha256: candidateSha256, input_sha256: 'b'.repeat(64), findings: [], steps: [], model_calls: 1,
      usage: { total_tokens: 19 }, semantic_approval: false };
  };
  const result = await f.session.invoke('review_candidate', {});
  assert.equal(result.status, 'NEEDS_ANALYSIS'); assert.equal(result.error_code, 'BACKEND_PLAN_IDENTITY_CHANGED');
  assert.equal(f.plan.generation_session.quality_reviews[0].model_calls, 1);
  assert.equal(f.plan.generation_session.quality_reviews[0].usage.total_tokens, 19);
  await assert.rejects(() => submit(f, sha), /BACKEND_PLAN_IDENTITY_CHANGED/);
});

test('cancellation during an awaited paid review cannot use a late NO_FINDINGS response', async () => {
  const controller = new AbortController();
  const timeout = new AbortController();
  const f = fixture({ signal: controller.signal, reviewTimeout: () => timeout.signal }); await f.session.initialize();
  await draftAndTest(f);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  f.session.qualityReviewer = async ({ caseSha256, candidateSha256 }) => {
    await held;
    return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
      candidate_sha256: candidateSha256, input_sha256: 'b'.repeat(64), findings: [], steps: [], model_calls: 1,
      usage: { total_tokens: 23 }, semantic_approval: false };
  };
  const pending = f.session.invoke('review_candidate', {});
  while (!f.plan.generation_session.quality_reviews?.length) await new Promise(resolve => setImmediate(resolve));
  controller.abort(); timeout.abort(); release();
  const result = await pending;
  assert.equal(result.status, 'NEEDS_ANALYSIS');
  assert.equal(result.error_code, 'BACKEND_HARNESS_CANCELLED');
  assert.equal(f.plan.generation_session.quality_reviews[0].model_calls, 1);
  assert.equal(f.plan.generation_session.quality_reviews[0].usage.total_tokens, 23);
  await assert.rejects(() => f.session.invoke('submit_candidate', {}), /BACKEND_HARNESS_CANCELLED/);
});

for (const reviewMode of ['static-v1', 'dsh-tools-v1']) {
  test(`${reviewMode} backend review uses shared limit and rejects a late NO_FINDINGS after local timeout`, async () => {
    const timeout = new AbortController(); const requested = [];
    const f = fixture({ reviewMode, reviewTimeout: ms => { requested.push(ms); return timeout.signal; } });
    await f.session.initialize(); const sha = await draftAndTest(f);
    f.session.qualityReviewer = async ({ caseSha256, candidateSha256 }) => {
      timeout.abort();
      return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
        candidate_sha256: candidateSha256, input_sha256: 'b'.repeat(64), findings: [], steps: [],
        model_calls: 1, usage: { total_tokens: 23 }, semantic_approval: false };
    };
    const result = await f.session.invoke('review_candidate', {});
    assert.deepEqual(requested, [CANDIDATE_QUALITY_REVIEW_TIMEOUT_MS]);
    assert.equal(result.status, 'NEEDS_ANALYSIS');
    assert.equal(result.error_code, 'BACKEND_QUALITY_REVIEW_TIMEOUT');
    assert.equal(f.plan.generation_session.quality_reviews[0].model_calls, 1);
    assert.equal(f.plan.generation_session.independent_validations.length, 0);
    assert.equal((await submit(f, sha)).frozen, false);
  });
}

test('backend review is capped by remaining wall time and retains wall-budget error', async () => {
  let clock = 1_000; const requested = []; const timeout = new AbortController();
  const f = fixture({ clock: () => clock, reviewTimeout: ms => { requested.push(ms); return timeout.signal; } });
  await f.session.initialize(); await draftAndTest(f);
  f.plan.generation_session.deadline_ms = f.session.state.deadline_ms = clock + 1_234;
  f.session.qualityReviewer = async ({ caseSha256, candidateSha256 }) => {
    clock = f.session.state.deadline_ms; timeout.abort();
    return { schema: 'workbench/candidate-quality-review-v1', status: 'NO_FINDINGS', case_sha256: caseSha256,
      candidate_sha256: candidateSha256, input_sha256: 'b'.repeat(64), findings: [], steps: [], semantic_approval: false };
  };
  const result = await f.session.invoke('review_candidate', {});
  assert.deepEqual(requested, [1_234]);
  assert.equal(result.status, 'NEEDS_ANALYSIS');
  assert.equal(result.error_code, 'BACKEND_HARNESS_WALL_BUDGET_EXHAUSTED');
});

test('independent validation budget exhaustion invokes no further validation on a changed draft', async () => {
  const f = fixture({ results: [good(), badBusiness(), good()], limits: { independent_validations: 1 } });
  await f.session.initialize();
  const sha = await draftAndTest(f); await f.session.invoke('review_candidate', {});
  assert.equal((await submit(f, sha)).status, 'INDEPENDENT_VALIDATION_FAILED');
  const changed = copy(f.execution); changed.steps[0].requests[0].assertions.push({ target: 'json', pointer: '/total', op: 'equals', value: 1 });
  const next = await f.session.invoke('write_draft', { previous_sha256: sha, execution: changed });
  await f.session.invoke('self_test', {}); await f.session.invoke('review_candidate', {});
  const result = await submit(f, next.draft_sha256);
  assert.equal(result.error_code, 'BACKEND_INDEPENDENT_VALIDATION_BUDGET_EXHAUSTED');
  assert.equal(f.counts().executes, 3);
  assert.equal(f.plan.generation_session.independent_validations.length, 1);
});

test('invalid backend location diagnostic persists without accepting or freezing the candidate', async () => {
  const f = fixture(); await f.session.initialize(); await draftAndTest(f);
  const diagnostic = { scope: 'step', index: 0, location_index: 0, rule: 'POINTER_NOT_FOUND' };
  f.session.qualityReviewer = async () => ({ status: 'NEEDS_ANALYSIS', case_sha256: f.plan.content_sha256,
    candidate_sha256: f.session.currentSha(), input_sha256: 'b'.repeat(64), model_calls: 1, semantic_approval: false,
    steps: [], findings: [], error_code: 'MODEL_RESPONSE_LOCATION_INVALID', location_diagnostic: diagnostic });
  const result = await f.session.invoke('review_candidate', {});
  assert.equal(result.status, 'NEEDS_ANALYSIS');
  assert.equal(f.plan.generation_session.candidate, null);
  assert.deepEqual(f.plan.generation_session.quality_reviews[0].location_diagnostic, diagnostic);
});
