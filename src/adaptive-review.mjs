import { fail, keys, publicError } from './common.mjs';
import { scrubForLog } from './telemetry.mjs';
import { stepAssertions } from './plan-steps.mjs';
import { validatePlanAudit } from './plan-quality.mjs';

export const ADAPTIVE_REVIEW_REFERENCES = `CURRENT AUDIT OUTPUT OVERRIDE: Prefer {checks:[{obligation_id,status,assertion_refs:["A1"],reason}],issues:[{code,step_id,reason}]}. The program supplies assertion_catalog with stable IDs for THIS cumulative candidate. Do not manufacture indices or mark an operation as a measured assertion. COVERED requires at least one actual assertion reference that checks that obligation. When entering a page is required, a measured heading or URL assertion may cover that obligation AND a heading obligation if its source_refs bind both; executed click alone is not coverage. Missing coverage in complete:false is MISSING + ASSERTION_GAP, not a protocol exception or business ambiguity. On review_correction, fix ONLY your audit response for the SAME candidate. Never modify the original expected, candidate, or execute actions. Legacy assertion_indices output remains accepted if strictly valid.
SUPPORTED RELATIONAL CHECK: table_unchanged (expected omitted or true) compares the complete single native table with a runtime-owned baseline frozen before this original step's first action, bound to run/step/locator/full URL. The executor independently compares after each action and at this assertion, rejects missing/forged/cross-scope baselines and unsupported structures, and never retries a mismatch until it becomes equal. It supports an explicit original table-unchanged/not-yet-applied-filter expectation; it is not a new literal value from the current page. It does NOT verify entered query field values (require value/selected_label separately), data beyond the current table, continuous states between samples, or a business result after clicking query. Row count alone is not proof of unchanged contents. Only mark its actual relation obligation covered, with the correct table scope.`;

export function adaptiveAuditInput(input) {
  return {
    ...input,
    assertion_catalog: input.candidate_plan.steps.flatMap((step) =>
      stepAssertions(step).map((assertion, index) => ({
        ref: `A${index + 1}`,
        step_id: step.step_id,
        ...assertion,
      })),
    ),
  };
}

export function compileAdaptiveAudit(reply, input) {
  if (!Array.isArray(reply?.checks)) return reply;
  const step = input.original.steps[0];
  const catalog = input.assertion_catalog;
  return {
    ...reply,
    checks: reply.checks.map((check) => {
      if (!check || typeof check !== 'object' || Array.isArray(check))
        fail('PLAN_AUDIT_SCHEMA_INVALID');
      if (!Object.hasOwn(check, 'assertion_refs')) return check;
      try {
        keys(
          check,
          ['step_id', 'obligation_id', 'status', 'assertion_refs', 'reason'],
          ['obligation_id', 'status', 'assertion_refs', 'reason'],
        );
      } catch {
        fail('PLAN_AUDIT_SCHEMA_INVALID');
      }
      if (!Array.isArray(check.assertion_refs)) fail('PLAN_AUDIT_ASSERTION_REFERENCE_INVALID');
      const stepId = check.step_id ?? step.step_id;
      const entries = catalog.filter((a) => a.step_id === stepId);
      const indices = check.assertion_refs.map((ref) => {
        const index = entries.findIndex((a) => a.ref === ref);
        if (index < 0) fail('PLAN_AUDIT_ASSERTION_REFERENCE_INVALID');
        return index;
      });
      const { assertion_refs, ...rest } = check;
      return { ...rest, step_id: stepId, assertion_indices: indices };
    }),
  };
}

// Only malformed audit responses are retried, never adverse semantic findings.
// Same frozen candidate, shared deadline, every request charged by the caller.
export async function reviewAdaptiveCandidate(input, ask, onRepair = async () => {}) {
  const context = adaptiveAuditInput(input);
  let correction;
  for (let attempt = 0; attempt <= 2; attempt++) {
    let reply;
    try {
      reply = await ask({ ...context, ...(correction ? { review_correction: correction } : {}) });
      return validatePlanAudit(
        compileAdaptiveAudit(reply, context),
        input.original,
        input.candidate_plan,
      );
    } catch (error) {
      if (
        error.code !== 'DEEPSEEK_JSON_INVALID' &&
        !/^PLAN_AUDIT_(?:SCHEMA|COUNT|REFERENCE|DUPLICATE|CHECK|ASSERTION_REFERENCE|ISSUE|INCONSISTENT)/u.test(
          error.code ?? '',
        )
      )
        throw error;
      if (attempt === 2) {
        error.adaptive_audit_exhausted = true;
        throw error;
      }
      correction = {
        code: publicError(error),
        invalid_response: scrubForLog(reply),
        instruction:
          'Repair this audit only. Each COVERED obligation must reference actual catalog assertions carrying that obligation ID. If no such measurement exists, use MISSING with ASSERTION_GAP; never count a click as a passed check. Use each obligation exactly once and no unknown/duplicate references.',
      };
      await onRepair(correction, attempt + 1);
    }
  }
}
