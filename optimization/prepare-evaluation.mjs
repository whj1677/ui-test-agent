import { hash, semanticHash } from '../src/common.mjs';
import { caseHash, planHash } from '../src/plans.mjs';
import { planningInput } from '../src/planning-input.mjs';
import { effectiveCase } from '../src/store.mjs';
import { scrubForLog } from '../src/telemetry.mjs';

function containsTruncation(value) {
  if (typeof value === 'string') return value.includes('[TRUNCATED');
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(containsTruncation);
}

/** Historical execution results are context for a reviewer, never gold labels.
 * These inputs reconstruct the current contract from archived task state; they
 * are not claimed to be the exact requests originally sent to a model. */
export function prepareEvaluationCase({ baselineBytes, state, caseId, family }) {
  if (hash(baselineBytes) !== state.baseline_sha256) throw new Error('BASELINE_CHANGED');
  if (typeof family !== 'string' || !family.trim()) throw new Error('CASE_FAMILY_REQUIRED');
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  const original = baseline.cases.find((item) => item.case_id === caseId);
  const row = state.cases.find((item) => item.case_id === caseId);
  if (!original || !row) throw new Error('CASE_NOT_FOUND');

  const testCase = effectiveCase(original, row);
  const input = planningInput(
    { ...state, snapshots: state.snapshots ?? [] },
    testCase,
    row,
    caseHash(testCase),
  );
  const missing = [];
  if (!input.pages.length) missing.push('PAGE_OBSERVATIONS_MISSING');
  if (containsTruncation(input)) missing.push('INPUT_TRUNCATED');
  if (testCase.steps.some((step) => !step.obligations?.length))
    missing.push('OBLIGATIONS_UNCONFIRMED');
  if (!row.reviewed) missing.push('CASE_NOT_CONFIRMED');

  // Apply the same default sanitization used by Controller.ask, without truncating
  // an otherwise complete input. The artifact stays local for further review.
  const sentInput = scrubForLog(input, { maxTextChars: Number.MAX_SAFE_INTEGER, maxDepth: 100 });
  const candidate = {
    schema_version: 'ui-agent-evaluation-candidate/v1',
    source: {
      task_id: state.id,
      case_id: caseId,
      baseline_sha256: state.baseline_sha256,
      original_case_hash: caseHash(original),
      effective_case_hash: caseHash(testCase),
      context_kind: 'RECONSTRUCTED_FROM_ARCHIVED_TASK',
    },
    family,
    input: sentInput,
    input_hash: semanticHash(sentInput),
    reference: { expected_outcome: null, reviewed: false },
    readiness: {
      status: missing.length ? 'MISSING_INPUT' : 'REVIEW_REQUIRED',
      issues: [...missing, 'INDEPENDENT_ORACLE_REVIEW_REQUIRED'],
      eligible_for_optimization: false,
    },
    historical: {
      status: row.status,
      plan_approved: Boolean(row.plan_approved),
      candidate_hash: row.plan ? planHash(row.plan) : null,
      candidate: row.plan ?? null,
      mapping_reason: row.mapping_reason ?? null,
      attempts: (row.attempts ?? []).length,
    },
  };
  return scrubForLog(candidate, { maxTextChars: Number.MAX_SAFE_INTEGER, maxDepth: 100 });
}

export function preparationSummary(candidates) {
  return {
    total: candidates.length,
    review_required: candidates.filter((item) => item.readiness.status === 'REVIEW_REQUIRED')
      .length,
    missing_input: candidates.filter((item) => item.readiness.status === 'MISSING_INPUT').length,
    eligible_for_optimization: candidates.filter((item) => item.readiness.eligible_for_optimization)
      .length,
    families: [...new Set(candidates.map((item) => item.family))],
    scope: 'Historical inputs for review; no new model calls, execution or inferred gold labels.',
  };
}
