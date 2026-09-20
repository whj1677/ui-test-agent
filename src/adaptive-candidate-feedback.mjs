import { fragmentAuditPlan } from './adaptive-plan.mjs';
import { requirePlanSemantics } from './plan-semantics.mjs';
import { stepCapabilityFacts } from './adaptive-capabilities.mjs';
import { rowPositionSourceGaps } from './table-position.mjs';

// Diagnostic probes of independent candidate assertions. No dispatch, repair,
// model call, expectation rewrite, or acceptance state can originate here.
export function candidateIssues(reply, { c, step, base, pages = [], previous = [] }) {
  if (!reply || !Array.isArray(reply.assertions) || reply.assertions.length > 20) return [];
  const original = c.steps.find((s) => s.step_id === step.step_id);
  if (!original) return [];
  const issues = [];
  for (const reason of rowPositionSourceGaps(original.expected))
    issues.push({
      code: 'PLAN_ROW_POSITION_SOURCE_UNRESOLVED',
      required_before_completion: true,
      reason,
    });
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
  const assertions = [...previous.flatMap((p) => p.assertions ?? []), ...reply.assertions];
  for (const wanted of stepCapabilityFacts(original, base).row_positions) {
    if (
      !assertions.some(
        (a) =>
          a?.check === 'table_cells' &&
          Array.isArray(a.obligation_ids) &&
          a.obligation_ids.includes(wanted.source_ref) &&
          Array.isArray(a.expected?.rows) &&
          a.expected.rows.some((r) => r?.key === wanted.key && r.position === wanted.position),
      )
    )
      issues.push({
        code: 'PLAN_ROW_POSITION_UNPROVEN',
        required_before_completion: true,
        ...wanted,
      });
  }
  return issues.slice(0, 24);
}
