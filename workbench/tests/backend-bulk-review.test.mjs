import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBackendBulkReview, backendBulkReviewSummary, createBackendBulkReviewSession, invalidateBackendBulkReviewRows } from '../web-v2/backend-bulk-review.js';

function fixture(generated = false) {
  const item = { case_id: 'case-one', case_version: 2, external_id: 'API-01', title: '查询结果' };
  const steps = [{ order: 1, action: '查询条目', expected: '返回指定条目' }];
  const project = { project_id: 'project-one', cases: [{ case_id: item.case_id, current_version: 2, versions: [{ version: 2, content_sha256: 'case-sha', content: { status: 'CONFIRMED', case_type: 'BACKEND', steps } }] }] };
  const environment = { backend_status: 'CONFIGURED', backend_environment_id: 'env-one', backend: { configuration_sha256: 'env-sha' } };
  const bindings = [{ version: 1, binding_id: 'binding-one', project_id: project.project_id, case_id: item.case_id, case_version: 2, case_content_sha256: 'case-sha', status: 'COMPLETE', confirmation_status: 'CONFIRMED', protocol_sha256: 'protocol-sha', applicability: 'CURRENT' }];
  const plan = { plan_id: 'plan-one', project_id: project.project_id, case_id: item.case_id, case_version: 2, content_sha256: 'case-sha', version: 1, revision: 7, state: 'DRAFT', environment_id: 'env-one', environment_sha256: 'env-sha', binding_version: 1, binding_id: 'binding-one', protocol_sha256: 'protocol-sha', execution: { environment_id: 'env-one', setup: [], cleanup: [], steps: [{ order: 1, requests: [{ id: 'query', method: 'GET', path: '/items/1', assertions: [{ target: 'status', op: 'equals', value: 200 }] }] }] } };
  if (generated) {
    plan.quality_policy = 'required-v1'; plan.quality_review_mode = 'dsh-tools-v1';
    plan.generation_session = { status: 'COMPLETED', quality_policy: 'required-v1', quality_review_mode: 'dsh-tools-v1',
      self_tests: [{ number: 1, status: 'PASSED', execution_sha256: 'execution-sha' }],
      candidate: { status: 'READY', quality_policy: 'required-v1', execution_sha256: 'execution-sha', self_test_number: 1, quality_review_number: 1, independent_validation_number: 1, coverage: [{ order: 1, requirement: steps[0].expected, request_ids: ['query'], uncovered: false }] },
      quality_reviews: [{ number: 1, mode: 'dsh-tools-v1', status: 'NO_FINDINGS', candidate_sha256: 'execution-sha', self_test_number: 1 }],
      independent_validations: [{ number: 1, status: 'PASSED', execution_sha256: 'execution-sha', self_test_number: 1 }],
    };
  }
  return { project, item, plans: [plan], bindings, environment, executionSha256: 'execution-sha' };
}
const evaluated = f => assessBackendBulkReview(f);
const row = id => { const f = fixture(); f.plans[0].plan_id = id; return { ...evaluated(f), selected: true }; };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('manual and complete generated plans are reviewable but never selected by default', () => {
  for (const generated of [false, true]) {
    const f = fixture(generated), result = evaluated(f);
    assert.equal(result.eligible, true);
    assert.equal(result.selected, false);
    assert.equal(result.outcome, null);
    assert.deepEqual(result.caseSteps, f.project.cases[0].versions[0].content.steps);
    assert.equal(result.plan.revision, 7);
    assert.match(result.reason, /等待人工/);
  }
});

test('multiple current drafts require explicit single-plan choice and never pick the latest', () => {
  const f = fixture();
  f.plans.unshift({ ...f.plans[0], plan_id: 'plan-newer', version: 2, revision: 19 });
  const result = evaluated(f);
  assert.equal(result.eligible, false);
  assert.equal(result.plan, null);
  assert.equal(result.plans.length, 2);
  assert.match(result.reason, /明确选择计划版本/);
});

test('older plans, confirmed plans and ongoing generation never enter the selected batch', () => {
  for (const [edit, phrase] of [
    [f => { f.plans[0].case_version = 1; }, /没有当前用例版本/],
    [f => { f.plans[0].state = 'CONFIRMED'; }, /无需重复确认/],
    [f => { f.plans[0].state = 'GENERATING'; }, /仍在生成/],
    [f => { f.project.cases[0].current_version = 3; }, /当前用例版本/],
    [f => { f.project.cases[0].versions[0].content.status = 'DRAFT'; }, /确认状态/],
  ]) {
    const f = fixture(); edit(f); const result = evaluated(f);
    assert.equal(result.eligible, false); assert.match(result.reason, phrase);
  }
});

test('a current confirmed plan is counted without repeating confirmation or selecting it for execution', async () => {
  const f = fixture();
  const confirmed = { ...f.plans[0], plan_id: 'confirmed-two', version: 2, state: 'CONFIRMED' };
  f.plans[0].state = 'FAILED'; f.plans.push(confirmed);
  const result = evaluated(f), summary = backendBulkReviewSummary([result]);
  assert.equal(result.plan, null);
  assert.equal(result.outcome, null);
  assert.equal(result.eligible, false);
  assert.equal(result.selected, false);
  assert.deepEqual(result.existingConfirmed, [confirmed]);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.available.length, 0);
  assert.equal(summary.selected.length, 0);
  assert.equal(summary.failed, 0);
  let calls = 0; result.selected = true;
  const session = createBackendBulkReviewSession({ projectId: f.project.project_id, rows: [result], request: async () => { calls += 1; } });
  await assert.rejects(session.confirm({ reviewer: 'tester', reviewed: true }), /先选择/);
  assert.equal(calls, 0);
});

test('confirmed plans from another version, project or content are not counted as current confirmations', () => {
  for (const edit of [
    f => { f.plans[0].case_version = 1; },
    f => { f.plans[0].project_id = 'other-project'; },
    f => { f.plans[0].content_sha256 = 'old-case-sha'; },
    f => { f.project.cases[0].current_version = 3; },
  ]) {
    const f = fixture(); f.plans[0].state = 'CONFIRMED'; edit(f);
    const result = evaluated(f);
    assert.equal(result.existingConfirmed.length, 0);
    assert.equal(backendBulkReviewSummary([result]).confirmed, 0);
    assert.equal(result.eligible, false);
  }
});

test('an old confirmation does not hide a new draft that needs review', () => {
  const f = fixture();
  f.plans.push({ ...f.plans[0], plan_id: 'confirmed-two', version: 2, state: 'CONFIRMED' });
  const result = evaluated(f), summary = backendBulkReviewSummary([result]);
  assert.equal(result.plan.plan_id, 'plan-one');
  assert.equal(result.eligible, true);
  assert.equal(summary.available.length, 1);
  assert.equal(summary.confirmed, 0);
});

test('reload failure no longer presents an earlier confirmed snapshot as current', () => {
  const f = fixture(); f.plans[0].state = 'CONFIRMED';
  const [result] = invalidateBackendBulkReviewRows([evaluated(f)], Error('WORKBENCH_UNREACHABLE'));
  assert.equal(result.reloadRequired, true);
  assert.equal(result.existingConfirmed.length, 0);
  assert.equal(backendBulkReviewSummary([result]).confirmed, 0);
});

test('changed environment, case hash and binding are shown as blockers', () => {
  for (const edit of [
    f => { f.environment.backend_environment_id = 'env-other'; },
    f => { f.environment.backend.configuration_sha256 = 'new-env-sha'; },
    f => { f.environment.backend_status = 'PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED'; },
    f => { f.plans[0].content_sha256 = 'old-case-sha'; },
    f => { f.bindings[0].confirmation_status = 'DRAFT'; },
    f => { f.bindings[0].protocol_sha256 = 'new-protocol-sha'; },
    f => { f.bindings[0].applicability = 'STALE_CASE_VERSION'; },
  ]) { const f = fixture(); edit(f); assert.equal(evaluated(f).eligible, false); }
});

test('generated plans require the exact tested content, coverage, review mode and independent validation', () => {
  for (const edit of [
    f => { f.executionSha256 = 'edited-sha'; },
    f => { f.plans[0].generation_session.self_tests[0].status = 'FAILED'; },
    f => { f.plans[0].generation_session.candidate.coverage[0].requirement = 'changed expectation'; },
    f => { f.plans[0].generation_session.candidate.coverage[0].uncovered = true; },
    f => { f.plans[0].generation_session.quality_policy = undefined; },
    f => { f.plans[0].generation_session.quality_reviews = []; },
    f => { f.plans[0].generation_session.quality_reviews[0].mode = 'static-v1'; },
    f => { f.plans[0].generation_session.quality_reviews[0].self_test_number = 2; },
    f => { f.plans[0].generation_session.independent_validations[0].execution_sha256 = 'old-sha'; },
    f => { f.plans[0].generation_session.independent_validations[0].status = 'FAILED'; },
  ]) { const f = fixture(true); edit(f); assert.equal(evaluated(f).eligible, false); }
});

test('business difference remains a warning with the single-plan decision path', () => {
  const f = fixture(true), session = f.plans[0].generation_session;
  session.candidate.status = 'BUSINESS_DIFFERENCE'; session.self_tests[0].status = 'FAILED'; session.independent_validations[0].status = 'FAILED';
  const result = evaluated(f);
  assert.equal(result.eligible, false);
  assert.match(result.reason, /业务差异.*单条计划核对后决定是否确认/);
  assert.equal(result.plan.plan_id, 'plan-one');
});

test('confirmation requires reviewer and declaration before any API call', async () => {
  let calls = 0;
  const session = createBackendBulkReviewSession({ projectId: 'project-one', rows: [row('plan-one')], request: async () => { calls += 1; } });
  await assert.rejects(session.confirm({ reviewer: 'tester', reviewed: false }), /全部所选/);
  await assert.rejects(session.confirm({ reviewer: ' ', reviewed: true }), /核对人/);
  assert.equal(calls, 0);
});

test('confirmation preserves displayed revisions, reports failures, and retries only unconfirmed transient failures', async () => {
  const rows = [row('plan-one'), row('plan-two')], calls = []; let fail = true, updates = 0;
  const session = createBackendBulkReviewSession({ projectId: 'project-one', rows, onUpdated: async () => { updates += 1; }, request: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.includes('plan-two') && fail) throw Error('WORKBENCH_BUSY');
  } });
  await session.confirm({ reviewer: ' tester ', reviewed: true });
  assert.deepEqual(calls.map(call => call.body), [{ revision: 7, reviewer: 'tester' }, { revision: 7, reviewer: 'tester' }]);
  assert.equal(rows[0].outcome, 'CONFIRMED'); assert.equal(rows[0].selected, false);
  assert.equal(rows[1].outcome, 'FAILED'); assert.equal(rows[1].reloadRequired, false);
  fail = false; await session.confirm({ reviewer: 'tester', reviewed: true });
  assert.equal(calls.length, 3); assert.match(calls[2].url, /plan-two\/confirm$/);
  assert.equal(rows[1].outcome, 'CONFIRMED'); assert.equal(updates, 2);
});

test('revision conflict and unknown network outcomes need explicit reload instead of silently updating or retrying', async () => {
  for (const error of ['BACKEND_PLAN_REVISION_CONFLICT', 'WORKBENCH_UNREACHABLE']) {
    const rows = [row('plan-one')]; let calls = 0;
    const session = createBackendBulkReviewSession({ projectId: 'project-one', rows, request: async () => { calls += 1; throw Error(error); } });
    await session.confirm({ reviewer: 'tester', reviewed: true });
    assert.equal(rows[0].reloadRequired, true); assert.equal(rows[0].selected, false); assert.equal(rows[0].plan.revision, 7);
    rows[0].selected = true;
    await assert.rejects(session.confirm({ reviewer: 'tester', reviewed: true }), /先选择/);
    assert.equal(calls, 1);
  }
});

test('repeated click and stop do not resend or claim to cancel an in-flight confirmation', async () => {
  const pending = deferred(), rows = [row('plan-one'), row('plan-two')]; let calls = 0;
  const session = createBackendBulkReviewSession({ projectId: 'project-one', rows, request: async () => { calls += 1; await pending.promise; } });
  const first = session.confirm({ reviewer: 'tester', reviewed: true });
  assert.equal(session.busy, true); assert.equal(rows[0].outcome, 'SUBMITTING');
  await session.confirm({ reviewer: 'tester', reviewed: true }); session.stop();
  assert.equal(session.busy, true); assert.equal(calls, 1);
  pending.resolve(); await first;
  assert.equal(rows[0].outcome, 'CONFIRMED'); assert.equal(rows[1].outcome, null); assert.equal(calls, 1); assert.equal(session.busy, false);
});

test('navigation stops the next request and preserves a completed in-flight result', async () => {
  const pending = deferred(), rows = [row('plan-one'), row('plan-two')]; let current = true, calls = 0, updates = 0;
  const session = createBackendBulkReviewSession({ projectId: 'project-one', rows, isCurrent: () => current, onUpdated: () => { updates += 1; }, request: async () => { calls += 1; await pending.promise; } });
  const work = session.confirm({ reviewer: 'tester', reviewed: true }); current = false; pending.resolve(); await work;
  assert.equal(calls, 1); assert.equal(rows[0].outcome, 'CONFIRMED'); assert.equal(rows[1].outcome, null); assert.equal(updates, 1);
});


test('failed reload disables earlier eligible snapshots and preserves completed confirmations', async () => {
  const completed = row('plan-one'); completed.outcome = 'CONFIRMED'; completed.selected = false;
  const loaded = invalidateBackendBulkReviewRows([completed, row('plan-two')], Error('WORKBENCH_UNREACHABLE'));
  assert.equal(loaded[0], completed);
  assert.equal(loaded[1].eligible, false); assert.equal(loaded[1].selected, false); assert.equal(loaded[1].reloadRequired, true);
  assert.match(loaded[1].reason, /重新载入失败/);
  loaded[1].selected = true;
  let calls = 0;
  const session = createBackendBulkReviewSession({ projectId: 'project-one', rows: loaded, request: async () => { calls += 1; } });
  await assert.rejects(session.confirm({ reviewer: 'tester', reviewed: true }), /先选择/);
  assert.equal(calls, 0);
});

test('submit lock stays in force while the workbench preflight refresh is in progress', async () => {
  const refreshing = deferred(), rows = [row('plan-one')]; let calls = 0;
  const session = createBackendBulkReviewSession({ projectId: 'project-one', rows, request: async () => { calls += 1; }, onUpdated: () => refreshing.promise });
  const work = session.confirm({ reviewer: 'tester', reviewed: true });
  await Promise.resolve();
  assert.equal(session.busy, true); assert.equal(rows[0].outcome, 'CONFIRMED');
  assert.equal(rows[0].plan.state, 'CONFIRMED'); assert.equal(rows[0].plan.reviewer, 'tester');
  await session.confirm({ reviewer: 'tester', reviewed: true });
  assert.equal(calls, 1); refreshing.resolve(); await work; assert.equal(session.busy, false);
});
