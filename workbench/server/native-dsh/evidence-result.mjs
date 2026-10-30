import fs from 'node:fs/promises';
import path from 'node:path';
import { renderStepReplay } from '../build/step-replay.mjs';
import { windowTimelineFromObservations } from '../build/window-timeline.mjs';
const read = async file => fs.readFile(file, 'utf8').then(JSON.parse).catch(() => null);

export function nativeEvidenceFiles(artifacts) {
  return artifacts.filter(a => /\.(?:png|webm|zip)$/i.test(a.relative_path)).map(a => ({
    file_id: a.id, file_name: a.name, relative_path: a.relative_path, bytes: a.bytes, sha256: a.sha256, mime_type: a.mime_type,
    kind: a.relative_path === 'artifacts/window-recording/browser-window.webm' ? 'trial_window_video' :
      a.relative_path === 'artifacts/step-replay-v1.webm' ? 'trial_step_replay_video' :
        a.kind === 'screenshot' ? 'trial_screenshot' : a.kind === 'trace' ? 'trial_trace' : 'trial_video',
  }));
}
export async function assembleNativeEvidence({ root, result, identity, caseContent, browserExecutable, renderReplay = renderStepReplay }) {
  const directory = path.join(root, 'artifacts', 'step-evidence');
  const metadata = await read(path.join(directory, 'runtime-metadata.json'));
  let observations = [];
  try { observations = (await fs.readFile(path.join(directory, 'step-observations.ndjson'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); } catch {}
  const matches = item => Object.entries(identity).every(([key, value]) => ['source_run_id','rerun_source_task_id','origin'].includes(key) || item?.[key] === value);
  const mappingValid = metadata?.mapping?.status === 'BOUND' && metadata?.test_count === 1 && result.tests.length === 1 && matches(metadata);
  const items = (caseContent.steps || []).map(source => {
    const found = observations.filter(o => o.step_id === `CASE_STEP_${source.order}`);
    const observation = found.length === 1 && matches(found[0]) && found[0].order === source.order ? found[0] : null;
    const priorFailure = mappingValid && observations.some(o => matches(o) && o.order < source.order && o.status === 'FAILED');
    return { step_id: `CASE_STEP_${source.order}`, order: source.order, raw_title: `CASE_STEP_${source.order}`,
      observed: Boolean(mappingValid && observation), execution_status: mappingValid && observation ? observation.status : priorFailure ? 'NOT_EXECUTED' : 'MISSING',
      attributed_assertions: mappingValid && observation ? observation.assertions : [], attributed_errors: [] };
  });
  const complete = mappingValid && items.length > 0 && items.every(i => i.observed) && observations.length === items.length;
  result.frozen_case_content = caseContent;
  result.evidence_mapping = metadata?.mapping || { status: 'UNAVAILABLE', reason: 'RUNTIME_METADATA_MISSING' };
  result.step_coverage = { status: complete ? 'COMPLETE' : 'INCOMPLETE', expected_steps: items.length, observed_steps: items.filter(i => i.observed).length, items };
  result.unbound_assertions = await read(path.join(directory, 'unbound-assertions.json')) || [];
  result.window_recording = result.execution_mode === 'BACKGROUND' ? {status:'NOT_REQUESTED',scope:'PAGE',reason:'BACKGROUND_MODE_PAGE_VIDEO'} : await read(path.join(root, 'artifacts', 'window-recording', 'recording.json')) || { status: 'UNAVAILABLE', reason: 'WINDOW_RECORDING_NOT_COLLECTED' };
  const basicSteps = items.map(item => {
    const source = caseContent.steps.find(s => s.order === item.order), observation = observations.find(o => o.step_id === item.step_id);
    const assertion = item.attributed_assertions.find(a => a.status === 'FAILED' && a.actual_present) || item.attributed_assertions.findLast(a => a.actual_present);
    return { ...item, action: source.action, expected: source.expected, assertions: item.attributed_assertions,
      actual_present: Boolean(assertion?.actual_present), actual_recorded: Boolean(assertion?.actual_present),
      ...(assertion?.actual_present ? { actual: assertion.actual } : {}), assertion_expected: assertion?.assertion_expected,
      value_source: assertion?.value_source || null, primary_assertion_index: assertion ? item.attributed_assertions.indexOf(assertion) : null,
      assertion_count: item.attributed_assertions.length,
      actual_assertion_source: assertion ? { assertion_index: item.attributed_assertions.indexOf(assertion) + 1,
        matcher_name: assertion.matcher_name, message: assertion.message, is_not: assertion.is_not, location: assertion.location } : null,
      actual_source_assertion: assertion ? { matcher_name: assertion.matcher_name, message: assertion.message, location: assertion.location } : null,
      observer_start: observation?.started_at, observer_end: observation?.ended_at,
      executed_start: observation?.business_started_at, executed_end: observation?.business_ended_at };
  });
  const rendered = mappingValid && observations.length ? await renderReplay({ runDirectory: root, runId: identity.run_id,
    candidateSha256: identity.candidate_sha256, executedExternalId: identity.executed_external_id, executedCaseVersion: identity.executed_case_version,
    caseContent, coverage: result.step_coverage, browserExecutable }) : null;
  result.step_replay = rendered?.replay || { schema: 'workbench/step-evidence-replay-v1', status: 'UNAVAILABLE', reason: 'STEP_MAPPING_NOT_VERIFIED' };
  if (!result.step_replay.steps) result.step_replay.steps = basicSteps;
  else result.step_replay.steps = result.step_replay.steps.map(step => ({ ...step, ...basicSteps.find(s => s.step_id === step.step_id) }));
  result.evidence_errors = [...(metadata?.errors || [])];
  try {
    const gaps = (await fs.readFile(path.join(root, 'instrumentation-gaps.ndjson'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    result.instrumentation_gaps = gaps;
    if (gaps.length) result.evidence_errors.push('NATIVE_EVIDENCE_UNSUPPORTED_SOURCE_MODULE');
  } catch {}
  return observations;
}
export function finalizeNativeEvidence(result, identity, observations) {
  result.files = nativeEvidenceFiles(result.artifacts);
  result.window_timeline = windowTimelineFromObservations({ ...result, ...identity, origin: 'NATIVE_DSH' }, observations);
  if(result.execution_mode === 'BACKGROUND'){
    const videos=result.files.filter(file=>file.kind==='trial_video');
    result.page_recording={status:videos.length?'COMPLETE':'UNAVAILABLE',scope:'PAGE',file_ids:videos.map(file=>file.file_id)};
  }
  const recordingComplete=result.execution_mode === 'BACKGROUND' ? result.page_recording?.status==='COMPLETE' : result.window_timeline.status === 'VERIFIED';
  const assertions = result.step_replay?.steps?.flatMap(step => step.assertions || []) || [];
  const actual = assertions.filter(a => a.actual_present && a.actual_recorded !== false).length;
  result.assertion_coverage = { total: assertions.length, actual, missing: assertions.length - actual,
    status: assertions.length && actual === assertions.length ? 'COMPLETE' : 'INCOMPLETE' };
  result.evidence_status = result.step_coverage?.status === 'COMPLETE' && recordingComplete &&
    result.step_replay?.status === 'READY' && result.step_replay.evidence_complete && !result.evidence_errors?.length &&
    result.step_replay.steps.every(s => s.actual_present) && result.assertion_coverage.status === 'COMPLETE' ? 'COMPLETE' : 'INCOMPLETE';
}
