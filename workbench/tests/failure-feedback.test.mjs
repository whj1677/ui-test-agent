import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFailureFeedback } from '../server/failure-feedback.mjs';
import { uiRevisionEvidence } from '../server/script-operations.mjs';

const caseContent = { steps: [{ order: 1, action: '搜索小写编号', expected: '包含BK-001' }, { order: 2, action: '搜索大写编号', expected: '结果一致' }] };
test('assertion mismatch is a possible business difference and fail-fast stays unexecuted', () => {
  const record = { status: 'FAILED', steps: [{ order: 1, status: 'FAILED', requests: [{ request_id: 'search', assertions: [{ target: 'json', pointer: '/items', expected: ['BK-001'], actual: [], status: 'FAILED' }] }] }] };
  const before = structuredClone(record), feedback = buildFailureFeedback({ record, caseContent });
  assert.equal(feedback.classification.category, 'BUSINESS_DIFFERENCE');
  assert.equal(feedback.classification.certainty, 'POSSIBLE_BUSINESS_DIFFERENCE');
  assert.equal(feedback.steps[0].status, 'FAILED'); assert.equal(feedback.steps[1].status, 'NOT_EXECUTED');
  assert.equal(feedback.steps[0].expected, '包含BK-001'); assert.deepEqual(record, before);
});
test('technical/cleanup errors and ambiguous timeouts cannot become product defects', () => {
  for (const code of ['BACKEND_NETWORK_ERROR','BACKEND_TIMEOUT','LOCATOR_TIMEOUT']) {
    const feedback = buildFailureFeedback({ record: { status: 'FAILED', technical_error: { code }, steps: [{ order: 1, requests: [{ assertions: [{ status: 'FAILED' }] }] }] }, caseContent });
    assert.equal(feedback.classification.category, 'NEEDS_ANALYSIS');
  }
  const env = buildFailureFeedback({ record: { status: 'FAILED', technical_error: { code: 'AUTH_SESSION_REQUIRED' } }, caseContent });
  assert.equal(env.classification.category, 'ENVIRONMENT_BLOCKED');
  assert.match(env.classification.next_action, /复跑同一脚本/);
});
test('known script error differs from unknown renderer diagnosis and active execution', () => {
  assert.equal(buildFailureFeedback({ record: { status: 'ERROR', error: { code: 'ERR_MODULE_NOT_FOUND' } } }).classification.category, 'SCRIPT_ERROR');
  assert.equal(buildFailureFeedback({ record: { status: 'ERROR', error: { message: '本机沙箱不可用' } } }).classification.category, 'NEEDS_ANALYSIS');
  assert.equal(buildFailureFeedback({ record: { status: 'RUNNING', complete_pass: true, error: { code: 'AUTH_SESSION_REQUIRED' } } }).classification.category, 'NEEDS_ANALYSIS');
});
test('feedback excludes raw HTTP headers and masks secret-valued assertion pointers', () => {
  const result = buildFailureFeedback({ record: { status: 'FAILED', http_evidence: { steps: [{ order: 1, requests: [{ request_id: 'x', request: { headers: { authorization: 'hidden-header' } }, response: { json: { password: 'hidden-body' } }, assertions: [{ target: 'json', pointer: '/access_token', expected: 'hidden-expected', actual: 'hidden-actual', status: 'FAILED' }] }] }] } } });
  const text = JSON.stringify(result);
  for (const secret of ['hidden-header', 'hidden-body', 'hidden-expected', 'hidden-actual']) assert.equal(text.includes(secret), false);
  assert.match(text, /REDACTED/);
});
test('UI feedback uses only structured matcher actual and keeps legacy text unknown', () => {
  const record = { status: 'FAILED', step_coverage: { items: [
    { order: 1, execution_status: 'FAILED', attributed_errors: [{ error: { type: 'ASSERTION_MISMATCH', expected: '["BK-001"]', actual: '[]', value_source: 'PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS', actual_present: true } }] },
    { order: 2, execution_status: 'FAILED', attributed_errors: [{ error: { type: 'ASSERTION_UNRESOLVED', message: 'Expected: BK-001 Received: []', actual: '[]', value_source: 'LEGACY_PLAYWRIGHT_MESSAGE' } }] },
  ] } };
  const feedback = buildFailureFeedback({ record, caseContent });
  assert.equal(feedback.steps[0].actual, '[]');
  assert.equal(feedback.steps[0].actual_recorded, true);
  assert.equal(feedback.steps[1].actual, null);
  assert.equal(feedback.steps[1].actual_recorded, false);
  assert.equal(feedback.steps[1].expected, '结果一致');
});
const input = { run_id: 'run-1', case_id: 'case-1', case_version: 1, source_task_id: 'build-1', candidate_version: 2, bundle_sha256: 'sha' };
const options = { projectId: 'project-1', input, environmentId: 'env-1', sourceEnvironmentId: 'env-1', caseContent, contentSha256: 'content' };
const run = { run_id: 'run-1', project_id: 'project-1', executed_case_id: 'case-1', executed_case_version: 1, source_build_task_id: 'build-1', candidate_version: 2, bundle_sha256: 'sha', finished_at: '2026-09-28', status: 'FAILED', error: { type: 'ASSERTION_MISMATCH', expected: 'BK-001', actual: [] } };
test('UI source run snapshot is immutable and bound to exact source identity', () => {
  const record = structuredClone(run), snapshot = uiRevisionEvidence(record, options);
  assert.equal(snapshot.run_id, 'run-1'); assert.equal(snapshot.failure_feedback.identity.case_version, 1);
  record.error.actual.push('changed-after-freeze'); assert.deepEqual(snapshot.failure_feedback.steps[0].actual, null);
  assert.equal(snapshot.evidence_sha256.length, 64);
  for (const key of ['project_id','executed_case_id','executed_case_version','source_build_task_id','candidate_version','bundle_sha256'])
    assert.throws(() => uiRevisionEvidence({ ...run, [key]: 'wrong' }, options), /REVISION_RUN_IDENTITY_MISMATCH/);
});
test('unfinished and different-environment UI runs cannot seed bound repair evidence', () => {
  assert.throws(() => uiRevisionEvidence({ ...run, execution_status: 'RUNNING' }, options), /REVISION_RUN_NOT_FINISHED/);
  assert.throws(() => uiRevisionEvidence({ ...run, execution_status: 'FINISHED', status: 'RUNNING' }, options), /REVISION_RUN_NOT_FINISHED/);
  assert.throws(() => uiRevisionEvidence({ ...run, environment_id: 'env-other' }, options), /REVISION_RUN_ENVIRONMENT_MISMATCH/);
});
