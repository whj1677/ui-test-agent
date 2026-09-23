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

test('caption runner requires verified timeline and four registered media for both lanes', () => {
  const hash = 'C'.repeat(64);
  const base = { candidate_sha256: hash, same_candidate_hash: true, technical_error: null,
    runner_version: 'e2e01-caption-timeline-v3', caption_timeline: { schema: 'workbench/trial-timeline-v2', status: 'VERIFIED' },
    media_file_ids: ['screenshot', 'video', 'trace', 'caption-video'] };
  const normal = { ...base, run_type: 'normal', status: 'PASSED', complete_pass: true, step_coverage: { complete: true } };
  const negative = { ...base, run_type: 'negative', status: 'FAILED', complete_pass: false, specified_defect_detected: true };
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal, negative] }), true);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [{ ...normal, runner_version: 'e2e01-caption-timeline-v2' }, negative] }), false);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [{ ...normal, runner_version: 'e2e01-caption-timeline-v1' }, negative] }), false);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [normal, { ...negative, media_file_ids: base.media_file_ids.slice(0, 3) }] }), false);
  assert.equal(e2eTrialReadiness({ sha256: hash, trial_runs: [{ ...normal, caption_timeline: { status: 'UNAVAILABLE' } }, negative] }), false);
});
