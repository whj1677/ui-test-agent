import assert from 'node:assert/strict';
import { PLAN_PROMPT, REVIEW_PROMPT } from '../src/plans.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import {
  STAGED_SCAFFOLD_PROMPT,
  STAGED_STEP_ACTIONS_PROMPT,
  STAGED_STEP_ASSERTIONS_PROMPT,
} from '../src/plan-staged.mjs';

// Test-only protocol replies. They make no claim about real-model review quality.
export function fixtureModelPhase(prompt, input) {
  if (input?.purpose === 'case_ui_recovery') return 'evidence_recovery';
  if (input?.gaps && input?.source && input?.boundary) return 'adapter_repair';
  if (input?.purpose === 'case_ui_discovery') return 'discovery';
  if (prompt.startsWith(PLAN_AUDIT_PROMPT)) return 'plan_audit';
  if (prompt.startsWith(INPUT_REVIEW_PROMPT)) return 'input_review';
  if (input?.blocked_response && prompt.startsWith("Review a planner's blocked response"))
    return 'blocked_audit';
  if (prompt.startsWith(REVIEW_PROMPT)) return 'input_review';
  if (prompt.startsWith(STAGED_SCAFFOLD_PROMPT)) return 'plan_scaffold';
  if (prompt.startsWith(STAGED_STEP_ACTIONS_PROMPT)) return 'plan_actions';
  if (prompt.startsWith(STAGED_STEP_ASSERTIONS_PROMPT)) return 'plan_assertions';
  if (prompt.startsWith(PLAN_PROMPT)) return 'plan';
  throw new Error('Unknown fixture model prompt');
}

export function fixtureAuditReply(c, plan) {
  return {
    checks: c.steps.flatMap((step) =>
      step.obligations.map((obligation) => {
        const candidate = plan.steps.find((s) => s.step_id === step.step_id);
        const assertion_indices = candidate.assertions.flatMap((a, i) =>
          a.obligation_ids?.includes(obligation.id) ? [i] : [],
        );
        assert.ok(
          assertion_indices.length,
          'Fixture plan must have mapped assertions before mocked acceptance',
        );
        return {
          step_id: step.step_id,
          obligation_id: obligation.id,
          status: 'COVERED',
          assertion_indices,
          reason: 'Test fixture audit response; not a real semantic review.',
        };
      }),
    ),
    issues: [],
  };
}

export function fixtureModelReply(prompt, input, plans) {
  const phase = fixtureModelPhase(prompt, input);
  if (phase === 'input_review') return { issues: [] };
  if (phase === 'blocked_audit')
    return { outcome: 'BLOCKED', reason: input.blocked_response.reason, evidence_refs: [] };
  if (phase === 'plan_audit') return fixtureAuditReply(input.original, input.candidate_plan);
  if (phase === 'plan') {
    const plan = plans.find((p) => p.case_id === input.original.case_id);
    assert.ok(plan, 'Missing fixture candidate for requested case');
    return { plan };
  }
  if (phase === 'plan_scaffold') {
    const plan = plans.find((p) => p.case_id === input.original.case_id);
    assert.ok(plan, 'Missing fixture candidate for requested case');
    return {
      scaffold: {
        entry_path: plan.entry_path,
        data_effect: plan.data_effect,
        preconditions: structuredClone(plan.preconditions),
        cleanup: structuredClone(plan.cleanup),
        ...(plan.notes !== undefined ? { notes: plan.notes } : {}),
      },
    };
  }
  if (phase === 'plan_actions') {
    const plan = plans.find((p) => p.case_id === input.case_id);
    const step = plan?.steps.find((s) => s.step_id === input.step.step_id);
    assert.ok(step, 'Missing fixture step for staged actions');
    return { actions: structuredClone(step.actions) };
  }
  if (phase === 'plan_assertions') {
    const plan = plans.find((p) => p.case_id === input.case_id);
    const step = plan?.steps.find((s) => s.step_id === input.step.step_id);
    assert.ok(step, 'Missing fixture step for staged assertions');
    return { mapped: { assertions: structuredClone(step.assertions), within_ms: step.within_ms } };
  }
  throw new Error('Discovery reply must be supplied by the discovery fixture');
}

export function fixtureTransportRequest(options) {
  const body = JSON.parse(options.body);
  return {
    prompt: body.messages.find((m) => m.role === 'system').content,
    input: JSON.parse(body.messages.find((m) => m.role === 'user').content),
  };
}
