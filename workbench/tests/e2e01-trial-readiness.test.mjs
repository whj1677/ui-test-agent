import assert from 'node:assert/strict';
import test from 'node:test';
import { e2eTrialReadiness } from '../server/build/manager.mjs';

test('E2E-01 reaches human review only after a passing normal run and the specified raw failure', () => {
  const hash = 'A'.repeat(64);
  const normal = {
    run_type: 'normal', candidate_sha256: hash, status: 'PASSED', complete_pass: true,
    step_coverage: { complete: true }, same_candidate_hash: true,
    media_file_ids: ['screenshot', 'video', 'trace'], technical_error: null,
  };
  const negative = {
    run_type: 'negative', candidate_sha256: hash, status: 'FAILED', complete_pass: false,
    specified_defect_detected: true, same_candidate_hash: true,
    media_file_ids: ['screenshot', 'video', 'trace'], technical_error: null,
  };
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal] }), false);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal, { ...negative, specified_defect_detected: false }] }), false);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal, negative] }), true);
  assert.equal(e2eTrialReadiness({ sha256: hash, same_candidate_hash: true, trial_runs: [{ ...normal, same_candidate_hash: undefined }, negative] }), true);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal, { ...negative, candidate_sha256: 'B'.repeat(64) }] }), false);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal, { ...negative, media_file_ids: [] }] }), false);
});
