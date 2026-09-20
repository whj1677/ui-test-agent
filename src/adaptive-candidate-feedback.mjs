import { fragmentAuditPlan } from './adaptive-plan.mjs';
import { requirePlanSemantics } from './plan-semantics.mjs';
import { completionIssues } from './completion-evidence.mjs';

const unavailable = () => ({
  code: 'COMPLETION_DIAGNOSTIC_UNAVAILABLE',
  evidence_of_pass: false,
  reason: '候选结构不可评估；这不是无缺口或批准。先按原错误修正格式，保留原义务、时点和预算。',
});

// Diagnostic probes of independent candidate assertions. No dispatch, repair,
// model call, expectation rewrite, or acceptance state can originate here.
export function candidateIssues(reply, { c, step, base, pages = [], previous = [] }) {
  if (!reply || !Array.isArray(reply.assertions) || reply.assertions.length > 20)
    return [unavailable()];
  const original = c.steps.find((s) => s.step_id === step.step_id);
  if (!original) return [unavailable()];
  const issues = [];
  reply.assertions.forEach((assertion, index) => {
    try {
      const bundle = fragmentAuditPlan(
        c,
        step,
        [],
        {
          actions: [],
          assertions: [assertion],
          complete: false,
          within_ms: 100,
          reason: 'Read-only diagnostic of an unexecuted assertion, never an approved fragment.',
        },
        base,
      );
      requirePlanSemantics(
        bundle.plan,
        bundle.c,
        { adaptive_readonly: true, pages },
        { complete: false },
      );
    } catch (error) {
      if (/^[A-Z][A-Z0-9_]+$/u.test(error.code ?? ''))
        issues.push({
          code: error.code,
          candidate_assertion_index: index,
          ...(error.path ? { field_path: error.path } : {}),
          ...(error.plan_feedback ? { detail: error.plan_feedback } : {}),
        });
    }
  });
  try {
    // This is only a structural proposal projection. Each fragment's assertions
    // stay in its own sampling group; pending actions remain in original order.
    // It does not merge candidate evidence into the controller's completed list.
    const checkpoints = [...previous, reply].map((p) => {
      if (!p || !Array.isArray(p.assertions) || !Array.isArray(p.actions ?? []))
        throw Error('DIAGNOSTIC_SHAPE');
      if (p.assertions.some((a) => !a || typeof a !== 'object')) throw Error('DIAGNOSTIC_SHAPE');
      return { actions: p.actions ?? [], assertions: p.assertions };
    });
    for (const issue of completionIssues(original, { checkpoints }, { adaptiveReadonly: true }))
      issues.push({
        ...issue,
        required_before_completion: true,
        basis: 'unexecuted_proposal_plus_completed_structure',
        evidence_of_pass: false,
      });
  } catch {
    // Existing schema/source/dispatch guards remain authoritative. Diagnostic
    // failure cannot turn an unknown proposal into a complete one.
    issues.push(unavailable());
  }
  if (issues.length <= 24) return issues;
  return [
    ...issues.slice(0, 23),
    {
      code: 'DIAGNOSTIC_LIST_TRUNCATED',
      omitted_count: issues.length - 23,
      evidence_of_pass: false,
      reason: '仅展示前23项诊断；原完整守卫没有截断，未展示项仍必须满足。',
    },
  ];
}
