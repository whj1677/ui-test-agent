import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAction,
  validateAssertion,
  validatePlan,
  caseHash,
  suggestObligations,
} from '../src/plans.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { describePlanError } from '../src/plan-feedback.mjs';
import { repairablePlanError } from '../src/plan-quality.mjs';

const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const action = {
  action_id: 'dismiss',
  op: 'dismiss_optional',
  target: role('dialog', '使用提示'),
  value: '知道了',
};
const target = role('button', '查看详情');
function sample() {
  const c = {
    case_id: 'C',
    steps: suggestObligations([
      {
        step_id: '1',
        action: '若出现使用提示，点击知道了；若未出现则继续。',
        expected: '没有提示遮挡操作。',
      },
      { step_id: '2', action: '点击查看详情。', expected: '详情可见。' },
    ]),
  };
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: 'C',
    case_hash: caseHash(c),
    entry_path: '/',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: c.steps.map((s, i) => ({
      step_id: s.step_id,
      source_action: s.action,
      source_expected: s.expected,
      actions: i ? [{ action_id: 'open', op: 'click', target }] : [structuredClone(action)],
      assertion_mode: 'simultaneous',
      within_ms: 800,
      assertions: [
        {
          target: i ? role('dialog', '详情') : target,
          check: i ? 'visible' : 'unobstructed',
          expected: true,
          oracle_quote: s.obligations[0].text,
          obligation_ids: [s.obligations[0].id],
        },
      ],
    })),
  };
  return { c, plan };
}
test('optional native notice schema works in v2 and v3 without arbitrary branching', () => {
  const { c, plan } = sample();
  validatePlan(plan, c, 'http://localhost/');
  requirePlanSemantics(plan, c);
  plan.schema_version = 'ui-agent-plan/v3';
  plan.steps = plan.steps.map((s, i) => ({
    step_id: s.step_id,
    source_action: s.source_action,
    source_expected: s.source_expected,
    assertion_mode: 'sequential_checkpoints',
    timeout_ms: 3000,
    checkpoints: [
      {
        checkpoint_id: 'p' + i,
        actions: s.actions,
        assertions: s.assertions,
        within_ms: s.within_ms,
      },
    ],
  }));
  validatePlan(plan, c, 'http://localhost/');
  requirePlanSemantics(plan, c);
});
test('optional condition must come from source; no arbitrary controls/repair/values or mutation', () => {
  for (const patch of [
    { target: role('button', '知道了') },
    { value: '确定' },
    { value: {} },
    { repair_anchor: target },
    { state: 'hidden' },
  ])
    assert.throws(() => validateAction({ ...action, ...patch }, 'http://localhost', new Set()), {
      code: 'OPTIONAL_DIALOG_SCHEMA',
    });
  const { c, plan } = sample();
  plan.steps[0].actions[0].target.name = '另一提示';
  assert.throws(() => validatePlan(plan, c, 'http://localhost'), {
    code: 'OPTIONAL_DIALOG_SOURCE_REQUIRED',
  });
  plan.steps[0].actions[0] = action;
  plan.data_effect = 'mutation';
  assert.throws(() => validatePlan(plan, c, 'http://localhost'), {
    code: 'OPTIONAL_DIALOG_SOURCE_REQUIRED',
  });
  assert.throws(() => validateAssertion({ target, check: 'unobstructed', expected: false }), {
    code: 'ASSERTION_BOOL_INVALID',
  });
});
test('visible-only obstruction proof, wrong target and omitted branch receive repairable feedback', () => {
  const { c, plan } = sample();
  const baseline = structuredClone(c);
  plan.steps[0].assertions[0].check = 'visible';
  let error;
  try {
    requirePlanSemantics(plan, c);
  } catch (e) {
    error = e;
  }
  assert.equal(error.code, 'PLAN_OBSTRUCTION_UNPROVEN');
  assert.equal(repairablePlanError(error.code), true);
  assert.equal(describePlanError(error, plan, c).field_path, 'plan.steps[0].assertions');
  plan.steps[0].assertions[0].check = 'unobstructed';
  plan.steps[0].assertions[0].target = role('table', '目录');
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_OBSTRUCTION_UNPROVEN' });
  plan.steps[0].actions = [];
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_CONDITIONAL_UNSUPPORTED' });
  assert.deepEqual(c, baseline);
});
test('optional close cannot be repeated within a step or replace a mandatory click', () => {
  const { c, plan } = sample();
  plan.steps[0].actions.push({ ...action, action_id: 'dismiss-again' });
  assert.throws(() => validatePlan(plan, c, 'http://localhost'), {
    code: 'OPTIONAL_DIALOG_SCHEMA',
  });
  plan.steps[0].actions.pop();
  c.steps[0].action = '点击使用提示中的知道了。';
  plan.steps[0].source_action = c.steps[0].action;
  plan.case_hash = caseHash(c);
  assert.throws(() => validatePlan(plan, c, 'http://localhost'), {
    code: 'OPTIONAL_DIALOG_SOURCE_REQUIRED',
  });
});
