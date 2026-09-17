import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, semanticHash } from '../src/common.mjs';
import { demoCases } from '../src/demo.mjs';
import { prepareEvaluationCase, preparationSummary } from '../optimization/prepare-evaluation.mjs';

function fixture() {
  const { baseline, plans } = demoCases();
  const baselineBytes = Buffer.from(JSON.stringify(baseline));
  const testCase = baseline.cases[0];
  return {
    baselineBytes,
    caseId: testCase.case_id,
    family: 'query',
    state: {
      id: 'archived-test-task',
      target: 'http://localhost:1234/catalog',
      baseline_sha256: hash(baselineBytes),
      auth_marker: { kind: 'testid', value: 'signed-in' },
      snapshots: [
        { discovery_case_id: testCase.case_id, text: '商品查询', controls: [] },
        { discovery_case_id: 'ANOTHER-CASE', text: '不得混入当前输入', controls: [] },
      ],
      cases: [
        {
          case_id: testCase.case_id,
          reviewed: true,
          status: 'PASS_ASSERTIONS',
          plan_approved: true,
          plan: plans[0],
          attempts: [{}],
        },
      ],
    },
  };
}

test('historical PASS and approved plan are preserved outside input and never become gold', () => {
  const source = fixture();
  const before = structuredClone(source.state);
  const result = prepareEvaluationCase(source);
  assert.equal(result.reference.expected_outcome, null);
  assert.equal(result.reference.reviewed, false);
  assert.equal(result.readiness.eligible_for_optimization, false);
  assert.equal(result.historical.status, 'PASS_ASSERTIONS');
  assert.equal(result.historical.attempts, 1);
  assert.equal(result.input.pages.length, 1);
  assert.equal(JSON.stringify(result.input).includes('不得混入'), false);
  assert.equal(Object.hasOwn(result.input, 'plan'), false);
  assert.equal(result.input_hash, semanticHash(result.input));
  assert.deepEqual(source.state, before);
});

test('missing or truncated observations remain in preparation totals with no invented data', () => {
  const missing = fixture();
  delete missing.state.snapshots;
  const truncated = fixture();
  truncated.state.snapshots[0].text = '片段\n[TRUNCATED original_chars=99999 limit=24000]';
  const candidates = [prepareEvaluationCase(missing), prepareEvaluationCase(truncated)];
  assert.ok(candidates[0].readiness.issues.includes('PAGE_OBSERVATIONS_MISSING'));
  assert.ok(candidates[1].readiness.issues.includes('INPUT_TRUNCATED'));
  assert.deepEqual(preparationSummary(candidates), {
    total: 2,
    review_required: 0,
    missing_input: 2,
    eligible_for_optimization: 0,
    families: ['query'],
    scope: 'Historical inputs for review; no new model calls, execution or inferred gold labels.',
  });
});

test('changed baseline or unknown case cannot be silently imported', () => {
  const source = fixture();
  assert.throws(
    () => prepareEvaluationCase({ ...source, baselineBytes: Buffer.from('{}') }),
    /BASELINE_CHANGED/,
  );
  assert.throws(() => prepareEvaluationCase({ ...source, caseId: 'invented' }), /CASE_NOT_FOUND/);
});

test('review artifacts redact credential-shaped content and hash the sanitized input', () => {
  const source = fixture();
  source.state.snapshots[0].text = 'password=fixture-secret';
  const result = prepareEvaluationCase(source);
  assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
  assert.equal(result.input_hash, semanticHash(result.input));
});
