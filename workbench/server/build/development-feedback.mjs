export function developmentError(code, detail = {}) {
  const error = new Error(code);
  error.detail = { code, ...detail };
  return error;
}
export function safeFeedback(error, state = {}) {
  const code = error.detail?.code || (/^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'DEVELOPMENT_OPERATION_FAILED');
  const remaining = Math.max(0, (state.limits?.self_tests ?? 3) - (state.self_tests?.length ?? 0));
  const terminal = ['DEVELOPMENT_CANCELLED', 'DEVELOPMENT_TIME_EXHAUSTED', 'CANDIDATE_ALREADY_FROZEN'].includes(code);
  const recoveryFirst = state.recovery && !state.self_tests?.length;
  const allowed = terminal ? [] : code === 'SELF_TEST_BUDGET_EXHAUSTED' || code === 'SELF_TEST_BUDGET_EXHAUSTED_NO_UNVERIFIABLE_EDIT'
    ? ['read_draft', 'read_evidence', 'check_fidelity', 'submit_candidate']
    : code === 'UNCHANGED_FAILURE_REQUIRES_NEW_EVIDENCE'
      ? ['read_evidence', 'observe the normal page', 'write a justified revision', 'submit_candidate']
      : recoveryFirst ? ['read_draft', 'self_test']
        : remaining ? ['read_draft', 'read_evidence', 'correct the reported issue', 'write_draft', 'self_test', 'check_fidelity', 'submit_candidate']
          : ['read_draft', 'read_evidence', 'check_fidelity', 'submit_candidate'];
  return { code, rule: code, node: null, identifier: null, location: null,
    message: code === 'DRAFT_NOT_CREATED' ? 'No draft has been saved. Use write_draft with ES module code and previous_sha256=null.' : code,
    draft_saved: false, draft_exists: Boolean(state.draft_sha256), current_sha256: state.draft_sha256 ?? null,
    ...error.detail, allowed_next_steps: error.detail?.allowed_next_steps ?? allowed };
}
export const DEVELOPMENT_CONTRACT = {
  module_format: 'ES module (.mjs); use import { test, expect } from "@playwright/test"; require is not supported.',
  imports: ['@playwright/test', 'relative .mjs helpers within the development directory'], navigation: 'await page.goto(process.env.PROBE_URL)',
  native_tools: ['read', 'read_image', 'write', 'edit'],
  tools: ['run_diagnostic', 'read_draft', 'write_draft', 'self_test', 'read_evidence', 'check_fidelity', 'submit_candidate'],
  writing: 'write_draft performs static admission; rejected code is not saved. Saving is not execution or verification.',
  submission: 'Current complete file bundle must have a self-test. Coverage is review material, not semantic proof. Unknown semantics remain for human review; no automatic approval.',
  timing: 'For explicit quoted loading-message duration ranges, the runner owns timing_validation: a unique role=status/aria-live element must start hidden, then appear and disappear once within its original CASE_STEP. Wait for initial page loading before the case steps. Perform original UI actions and visible/hidden assertions. Do not use Date/performance/other candidate clocks or invent tolerance. The runner uses the frozen ms/seconds bounds, records measured duration and rejects missing/ambiguous/extra cycles; unsupported time language requires review, never ready.',
};
