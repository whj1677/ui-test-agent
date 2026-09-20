import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPartialAssertions } from '../src/partial-assertion-review.mjs';
import { adaptiveAuditInput } from '../src/adaptive-review.mjs';

function fixture() {
  const assertion = {
    target: { kind: 'role', role: 'heading', name: 'A', exact: true },
    check: 'visible',
    obligation_ids: ['O1'],
    oracle_quote: 'A及B可见',
  };
  const context = adaptiveAuditInput({
    original: {
      steps: [
        { step_id: '1', expected: 'A及B可见', obligations: [{ id: 'O1', text: 'A及B可见' }] },
      ],
    },
    candidate_plan: { steps: [{ step_id: '1', assertions: [assertion] }] },
    current_fragment: { assertions: [assertion] },
    complete: false,
  });
  const audit = {
    outcome: 'REPAIR',
    checks: [
      {
        step_id: '1',
        obligation_id: 'O1',
        status: 'MISSING',
        assertion_indices: [0],
        reason: 'A可作部分证据，B未测',
      },
    ],
    issues: [{ code: 'ASSERTION_GAP', step_id: '1', reason: 'B未测' }],
  };
  return { context, audit };
}
const answer = (status) => ({
  assertion_checks: [{ assertion_ref: 'A1', status, reason: '按原断言逐项复核的测试判定' }],
});

for (const status of ['SUPPORTED', 'CONTRADICTS', 'UNRESOLVED'])
  test('partial assertion semantic verdict remains separate from coverage: ' + status, async () => {
    const { context, audit } = fixture(),
      before = structuredClone({ context, audit });
    let calls = 0;
    const result = await reviewPartialAssertions(context, audit, async (request) => {
      calls++;
      assert.deepEqual(request.partial_assertion_review.required_refs, ['A1']);
      assert.deepEqual(request.partial_assertion_review.original_audit, audit);
      return answer(status);
    });
    assert.equal(calls, 1);
    assert.equal(result.outcome, 'REPAIR');
    assert.equal(result.checks[0].status, 'MISSING');
    assert.equal(
      result.issues.some((i) => i.code === 'ACTION_MISMATCH'),
      status !== 'SUPPORTED',
    );
    assert.deepEqual({ context, audit }, before);
  });

for (const bad of [
  {},
  { assertion_checks: [] },
  {
    assertion_checks: [
      ...answer('SUPPORTED').assertion_checks,
      ...answer('SUPPORTED').assertion_checks,
    ],
  },
  { assertion_checks: [{ ...answer('SUPPORTED').assertion_checks[0], assertion_ref: 'A9' }] },
  answer('ACCEPT'),
  { assertion_checks: [{ ...answer('SUPPORTED').assertion_checks[0], reason: '' }] },
  { ...answer('SUPPORTED'), complete: true },
  { assertion_checks: [{ ...answer('SUPPORTED').assertion_checks[0], expected: '替换原预期' }] },
])
  test(
    'missing or forged assertion verdict cannot authorize a partial candidate: ' +
      JSON.stringify(bad),
    async () => {
      const { context, audit } = fixture();
      let calls = 0;
      const result = await reviewPartialAssertions(context, audit, async () => {
        calls++;
        return bad;
      });
      assert.equal(calls, 1);
      assert.equal(result.partial_assertion_review.status, 'INVALID_RESPONSE');
      assert.ok(result.issues.some((i) => i.code === 'ACTION_MISMATCH'));
    },
  );

test('complete, already-rejected, action-only and supported current assertions add no request', async () => {
  for (const kind of ['complete', 'rejected', 'action-only', 'covered']) {
    const { context, audit } = fixture();
    if (kind === 'complete') context.complete = true;
    if (kind === 'rejected')
      audit.issues.push({ code: 'ACTION_MISMATCH', step_id: '1', reason: '原范围错误' });
    if (kind === 'action-only') context.current_fragment.assertions = [];
    if (kind === 'covered') {
      audit.checks[0].status = 'COVERED';
      audit.issues = [];
      audit.outcome = 'ACCEPT';
    }
    const result = await reviewPartialAssertions(context, audit, async () => {
      throw Error('UNEXPECTED_REQUEST');
    });
    assert.equal(result, audit);
  }
});

test('one covered source cannot hide a second unreviewed or negative binding', async () => {
  const { context, audit } = fixture();
  audit.checks.push({ ...audit.checks[0], obligation_id: 'O2', status: 'COVERED' });
  context.current_fragment.assertions[0].obligation_ids.push('O2');
  const fresh = adaptiveAuditInput(context);
  let called = false;
  const result = await reviewPartialAssertions(fresh, audit, async () => {
    called = true;
    return answer('CONTRADICTS');
  });
  assert.equal(called, true);
  assert.ok(result.issues.some((i) => i.code === 'ACTION_MISMATCH'));
});

test('executed prefix is not reviewed again and tail mismatch is rejected without asking', async () => {
  const { context, audit } = fixture();
  const prior = structuredClone(context.current_fragment.assertions[0]);
  prior.target.name = '先前证据';
  context.candidate_plan.steps[0].assertions.unshift(prior);
  const fresh = adaptiveAuditInput(context);
  audit.checks[0].assertion_indices = [1];
  const result = await reviewPartialAssertions(fresh, audit, async (request) => {
    assert.deepEqual(request.partial_assertion_review.required_refs, ['A2']);
    return {
      assertion_checks: [{ assertion_ref: 'A2', status: 'SUPPORTED', reason: '合法局部测量' }],
    };
  });
  assert.deepEqual(result.partial_assertion_review.required_refs, ['A2']);
  fresh.current_fragment = structuredClone(fresh.current_fragment);
  fresh.current_fragment.assertions[0].target.name = '不是当前候选';
  const rejected = await reviewPartialAssertions(fresh, audit, async () => {
    throw Error('NO_REQUEST');
  });
  assert.equal(rejected.partial_assertion_review.status, 'INVALID_CONTEXT');
});

test('invalid JSON denies execution once; cancellation and provider failures propagate', async () => {
  const { context, audit } = fixture();
  let calls = 0;
  const result = await reviewPartialAssertions(context, audit, async () => {
    calls++;
    throw Object.assign(Error('json'), { code: 'DEEPSEEK_JSON_INVALID' });
  });
  assert.equal(calls, 1);
  assert.equal(result.partial_assertion_review.status, 'INVALID_RESPONSE');
  for (const code of ['ABORTED', 'MODEL_CALL_LIMIT', 'DEEPSEEK_NETWORK_ERROR'])
    await assert.rejects(
      reviewPartialAssertions(context, audit, async () => {
        throw Object.assign(Error(code), { code });
      }),
      { code },
    );
});
