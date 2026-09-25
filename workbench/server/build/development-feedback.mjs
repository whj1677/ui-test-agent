export function developmentError(code, detail = {}) {
  const error = new Error(code);
  error.detail = { code, ...detail };
  return error;
}
export function safeFeedback(error, state = {}) {
  const code = error.detail?.code || (/^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'DEVELOPMENT_OPERATION_FAILED');
  return { code, rule: code, node: null, identifier: null, location: null,
    message: code === 'DRAFT_NOT_CREATED' ? 'No draft has been saved. Use write_draft with ES module code and previous_sha256=null.' : code,
    draft_saved: false, draft_exists: Boolean(state.draft_sha256), current_sha256: state.draft_sha256 ?? null,
    allowed_next_steps: ['read_draft', 'correct the reported issue', 'write_draft', 'self_test'],
    ...error.detail };
}
export const DEVELOPMENT_CONTRACT = {
  module_format: 'ES module (.mjs); use import { test, expect } from "@playwright/test"; require is not supported.',
  imports: ['@playwright/test', 'relative .mjs helpers within the development directory'], navigation: 'await page.goto(process.env.PROBE_URL)',
  native_tools: ['read', 'read_image', 'write', 'edit'],
  tools: ['run_diagnostic', 'read_draft', 'write_draft', 'self_test', 'read_evidence', 'check_fidelity', 'submit_candidate'],
  writing: 'write_draft performs static admission; rejected code is not saved. Saving is not execution or verification.',
  submission: 'Current complete file bundle must have a self-test. Coverage is review material, not semantic proof. Unknown semantics remain for human review; no automatic approval.',
};
