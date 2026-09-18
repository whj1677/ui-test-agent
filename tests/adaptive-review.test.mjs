import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptivePlan, fragmentAuditPlan } from '../src/adaptive-plan.mjs';
import { suggestObligations } from '../src/plans.mjs';
import { auditInput } from '../src/plan-quality.mjs';
import {
  adaptiveAuditInput,
  compileAdaptiveAudit,
  reviewAdaptiveCandidate,
} from '../src/adaptive-review.mjs';
import { adaptiveCorrection, canReconsiderBlock } from '../src/adaptive-recovery.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
const base = 'http://127.0.0.1:4196/';
function fixture() {
  const c = {
    case_id: 'C1',
    steps: suggestObligations([
      { step_id: '1', action: '展开运营中心并进入资产设备。', expected: '资产设备标题可见。' },
    ]),
  };
  const plan = createAdaptivePlan(c, '/overview');
  const fragment = {
    actions: [],
    assertions: [
      {
        target: { kind: 'role', role: 'heading', name: '资产设备', exact: true },
        check: 'visible',
        oracle_quote: c.steps[0].expected,
        obligation_ids: ['1-O1'],
      },
    ],
    complete: true,
    within_ms: 1000,
    reason: '核验原预期',
  };
  const bundle = fragmentAuditPlan(c, plan.steps[0], [], fragment, base);
  return { input: auditInput(bundle.c, bundle.plan), step: plan.steps[0] };
}
const valid = () => ({
  checks: [
    {
      obligation_id: '1-O1',
      status: 'COVERED',
      assertion_refs: ['A1'],
      reason: '标题断言明确覆盖原预期',
    },
  ],
  issues: [],
});
test('stable audit assertion refs compile to strict same-step measured references', async () => {
  const { input } = fixture();
  const output = await reviewAdaptiveCandidate(input, async () => valid());
  assert.equal(output.outcome, 'ACCEPT');
  assert.deepEqual(output.checks[0].assertion_indices, [0]);
});
test('real V03 COVERED-with-empty-refs response is repaired without replanning candidate', async () => {
  const { input } = fixture();
  const seen = [];
  const events = [];
  const output = await reviewAdaptiveCandidate(
    input,
    async (i) => {
      seen.push(i);
      return seen.length === 1
        ? {
            checks: [
              {
                step_id: '1',
                obligation_id: '1-O1',
                status: 'COVERED',
                assertion_indices: [],
                reason: '点击已执行所以已覆盖',
              },
            ],
            issues: [],
          }
        : valid();
    },
    (...e) => events.push(e),
  );
  assert.equal(output.outcome, 'ACCEPT');
  assert.equal(seen.length, 2);
  assert.equal(events.length, 1);
  assert.deepEqual(seen[0].candidate_plan, seen[1].candidate_plan);
  assert.equal(seen[1].review_correction.code, 'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID');
});
test('persistent invalid review is bounded and is never implicitly accepted', async () => {
  let calls = 0;
  await assert.rejects(
    reviewAdaptiveCandidate(fixture().input, async () => {
      calls++;
      return { checks: [], issues: [] };
    }),
    { code: 'PLAN_AUDIT_COUNT_INVALID' },
  );
  assert.equal(calls, 3);
});
test('valid adverse semantic verdict is returned without retry or deletion', async () => {
  let calls = 0;
  const result = await reviewAdaptiveCandidate(fixture().input, async () => {
    calls++;
    const reply = valid();
    reply.issues = [
      { step_id: '1', code: 'ACTION_MISMATCH', reason: '当前检查对象错误，不能扩大原预期' },
    ];
    return reply;
  });
  assert.equal(calls, 1);
  assert.notEqual(result.outcome, 'ACCEPT');
  assert.equal(result.issues[0].code, 'ACTION_MISMATCH');
});
test('unknown/duplicate/mixed audit refs do not silently bind to another assertion', async () => {
  for (const refs of [['A2'], ['A1', 'A1']]) {
    const reply = valid();
    reply.checks[0].assertion_refs = refs;
    await assert.rejects(reviewAdaptiveCandidate(fixture().input, async () => reply));
  }
  const reply = valid();
  reply.checks[0].assertion_indices = [0];
  assert.throws(() => compileAdaptiveAudit(reply, adaptiveAuditInput(fixture().input)));
});
test('abort/provider-budget error is not retried as audit schema failure', async () => {
  let calls = 0;
  await assert.rejects(
    reviewAdaptiveCandidate(fixture().input, async () => {
      calls++;
      throw Object.assign(new Error('STOPPED'), { code: 'STOPPED' });
    }),
    { code: 'STOPPED' },
  );
  assert.equal(calls, 1);
});
test('block review requires a current source-named control or explicit original route', () => {
  const { step } = fixture();
  const current = {
    controls: [
      {
        role: 'button',
        name: '运营中心',
        locator: { kind: 'label', value: '运营中心', exact: true },
      },
    ],
  };
  assert.equal(canReconsiderBlock(current, step), true);
  assert.equal(canReconsiderBlock({ controls: [] }, step), false);
  assert.equal(
    canReconsiderBlock(
      { controls: [{ ...current.controls[0], name: '删除' }] },
      { source_action: '删除' },
    ),
    false,
  );
  assert.equal(canReconsiderBlock({ controls: [] }, { source_action: '打开 /assets。' }), true);
});
test('format correction preserves rejected response and explicit source constraints', () => {
  const { step } = fixture();
  const bad = { actions: [{ target: { kind: 'button', name: '运营中心' } }] };
  const out = adaptiveCorrection({ code: 'INVALID_LOCATOR' }, bad, step);
  assert.deepEqual(out.invalid_response, bad);
  assert.match(out.instruction, /kind:"role"/);
  assert.equal(out.source_expected, step.source_expected);
});

test('null check and mixed ref fields stay inside same-candidate audit correction', async () => {
  for (const bad of [
    { checks: [null], issues: [] },
    { checks: [{ ...valid().checks[0], assertion_indices: [0] }], issues: [] },
  ]) {
    let calls = 0;
    const output = await reviewAdaptiveCandidate(fixture().input, async (input) => {
      calls++;
      if (calls === 1) return bad;
      assert.equal(input.review_correction.code, 'PLAN_AUDIT_SCHEMA_INVALID');
      return valid();
    });
    assert.equal(output.outcome, 'ACCEPT');
    assert.equal(calls, 2);
  }
});

test('invalid JSON is repaired as audit format but never escapes as a planning retry', async () => {
  let calls = 0;
  const output = await reviewAdaptiveCandidate(fixture().input, async () => {
    if (++calls === 1)
      throw Object.assign(new Error('bad JSON'), { code: 'DEEPSEEK_JSON_INVALID' });
    return valid();
  });
  assert.equal(output.outcome, 'ACCEPT');
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    reviewAdaptiveCandidate(fixture().input, async () => {
      calls++;
      throw Object.assign(new Error('bad JSON'), { code: 'DEEPSEEK_JSON_INVALID' });
    }),
    (e) => e.code === 'DEEPSEEK_JSON_INVALID' && e.adaptive_audit_exhausted === true,
  );
  assert.equal(calls, 3);
});

test('adaptive final coverage cannot replace table unchanged with a sampled fixed row count', () => {
  const c = {
    case_id: 'REL',
    steps: suggestObligations([
      { step_id: '1', action: '填写关键词为A。', expected: '表格保持不变。' },
    ]),
  };
  const plan = createAdaptivePlan(c, '/');
  const fragment = {
    actions: [],
    assertions: [
      {
        target: { kind: 'role', role: 'table', name: '', exact: true },
        check: 'visible',
        oracle_quote: c.steps[0].expected,
        obligation_ids: ['1-O1'],
      },
    ],
    complete: true,
    within_ms: 1000,
    reason: '检查原表',
  };
  const bundle = fragmentAuditPlan(c, plan.steps[0], [], fragment, base);
  assert.throws(() => requirePlanSemantics(bundle.plan, bundle.c, { adaptive_readonly: true }), {
    code: 'PLAN_RELATION_UNPROVEN',
  });
  fragment.assertions[0].check = 'table_unchanged';
  const repaired = fragmentAuditPlan(c, plan.steps[0], [], fragment, base);
  assert.doesNotThrow(() =>
    requirePlanSemantics(repaired.plan, repaired.c, { adaptive_readonly: true }),
  );
});
