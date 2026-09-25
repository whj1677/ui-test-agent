import { parseCandidateReport, projectCaseStepCoverage } from './report.mjs';
import { renderStepReplay } from './step-replay.mjs';

// Self-tests and independent verification use the same capture contract as
// explicit reruns. Capture belongs to the executor, never to generated code.
export async function verifyDevelopmentRun({ verify, options, identity, caseContent, contract, browserExecutable }) {
  const raw = await verify({ ...options, ...(identity ? { stepObservation: identity } : {}) });
  const result = await parseCandidateReport(raw.reportPath, raw.process);
  const coverage = projectCaseStepCoverage(result, contract);
  if (!identity) return { raw, result, coverage };
  const replay = options.signal?.aborted
    ? { replay: { status: 'UNAVAILABLE', reason: 'CANCELLED' } }
    : await renderStepReplay({ runDirectory: options.runDirectory, runId: identity.run_id,
      candidateSha256: identity.candidate_sha256, executedExternalId: identity.executed_external_id,
      executedCaseVersion: identity.executed_case_version, caseContent, coverage, browserExecutable });
  return { raw, result, coverage, evidence: { step_replay: replay.replay,
    recording: { viewport: { width: 1280, height: 720 }, video_size: { width: 1280, height: 720 },
      device_scale_factor: 1, codec: 'Playwright WebM', encoding_parameters: 'Playwright defaults; bitrate not overridden' },
    evidence_status: replay.replay.status === 'READY' && replay.replay.evidence_complete ? 'STEPS_CAPTURED' : 'INCOMPLETE',
    evidence_error: replay.replay.status === 'READY' && replay.replay.evidence_complete ? null : replay.replay.reason || 'STEP_CAPTURES_MISSING' } };
}
