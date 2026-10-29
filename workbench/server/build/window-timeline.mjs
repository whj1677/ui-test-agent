import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const schema = 'workbench/window-step-timeline-v1';
export function windowTimelineFromObservations(run, observations) {
  const unavailable = reason => ({ schema, status: 'UNAVAILABLE', reason, run_id: run.run_id });
  const recording = run.window_recording;
  if (recording?.status !== 'COMPLETE') return unavailable('WINDOW_RECORDING_NOT_COMPLETE');
  const expected = { run_id: run.run_id, candidate_sha256: run.candidate_sha256,
    candidate_bundle_sha256: run.bundle_sha256, executed_external_id: run.executed_external_id,
    executed_case_id: run.executed_case_id, executed_case_version: run.executed_case_version,
    executed_content_sha256: run.executed_content_sha256 };
  const matches = value => Object.entries(expected).every(([key, item]) => item != null && value?.[key] === item);
  if (!matches(recording.identity)) return unavailable('WINDOW_TIMELINE_IDENTITY_MISMATCH');
  const videoPath = run.origin === 'NATIVE_DSH' ? 'artifacts/window-recording/browser-window.webm' : 'execution/artifacts/window-recording/browser-window.webm';
  const media = run.files?.find(file => file.kind === 'trial_window_video' && file.relative_path === videoPath);
  if (!media?.sha256 || media.bytes !== recording.video_bytes || !media.bytes) return unavailable('WINDOW_TIMELINE_MEDIA_MISMATCH');
  const fps = recording.fps, duration = recording.encoded_duration_seconds;
  const zero = Date.parse(recording.started_at), stop = Date.parse(recording.ended_at);
  if (!Number.isInteger(fps) || fps < 1 || fps > 30 || !Number.isInteger(recording.frame_count) || recording.frame_count < 1 ||
      !Number.isFinite(duration) || duration <= 0 || duration > 3600 ||
      Math.abs(duration - recording.frame_count / fps) > 0.001 || !Number.isFinite(zero) || !Number.isFinite(stop) || stop <= zero ||
      Math.abs((stop - zero) / 1000 - duration) > Math.max(.25, 2 / fps) ||
      !Number.isFinite(recording.maximum_capture_gap_ms) || recording.maximum_capture_gap_ms > 1500)
    return unavailable('WINDOW_TIMELINE_CLOCK_UNVERIFIED');
  const covered = (run.step_coverage?.items || []).filter(item => item.observed);
  if (!Array.isArray(observations) || !observations.length || observations.length !== covered.length || observations.length > 1000)
    return unavailable('WINDOW_TIMELINE_STEPS_MISSING');
  const steps = []; let previousEnd = -Infinity;
  for (let i = 0; i < observations.length; i++) {
    const item = observations[i], coverage = covered[i];
    if (item.schema !== 'workbench/step-observation-v1' || !matches(item) || item.depth !== 0 ||
        item.step_id !== coverage.step_id || item.raw_title !== coverage.raw_title || item.order !== coverage.order ||
        item.status !== coverage.execution_status || !['PASSED', 'FAILED'].includes(item.status) ||
        steps.some(step => step.step_id === item.step_id)) return unavailable('WINDOW_TIMELINE_STEP_IDENTITY_MISMATCH');
    const frozen = run.step_replay?.steps?.find(step => step.step_id === item.step_id);
    const frozenTimes = { observer_start: 'started_at', executed_start: 'business_started_at',
      executed_end: 'business_ended_at', observer_end: 'ended_at' };
    if (run.step_replay?.status === 'READY' && (!frozen || Object.entries(frozenTimes).some(([saved, raw]) =>
      frozen[saved] != null && frozen[saved] !== item[raw]))) return unavailable('WINDOW_TIMELINE_FROZEN_TIME_CONFLICT');
    const dates = [item.started_at, item.business_started_at, item.business_ended_at, item.ended_at].map(Date.parse);
    if (dates.some(value => !Number.isFinite(value)) || dates[0] < previousEnd ||
        dates.some((value, index) => index && value < dates[index - 1]) || dates[3] <= dates[0] ||
        dates[0] < zero - 1000 / fps || dates[3] > stop + 1000 / fps)
      return unavailable('WINDOW_TIMELINE_STEP_RANGE_INVALID');
    previousEnd = dates[3];
    const [start, action, result, end] = dates.map(value => Math.max(0, Math.min(duration, (value - zero) / 1000)));
    if (end <= start) return unavailable('WINDOW_TIMELINE_STEP_RANGE_INVALID');
    steps.push({ step_id: item.step_id, order: item.order, execution_status: item.status,
      start_seconds: start, action_start_seconds: action, result_start_seconds: result, end_seconds: end });
  }
  return { schema, status: 'VERIFIED', reason: null, ...expected, duration_seconds: duration,
    accuracy_seconds: Math.max(1 / fps, recording.maximum_capture_gap_ms / 1000),
    source: 'EXECUTOR_STEP_OBSERVATIONS_AND_NATIVE_RECORDING_CLOCK', video_sha256: media.sha256, steps };
}

// A projection: old run.json and video bytes are never rewritten to invent timing.
export async function withWindowTimeline(run, store) {
  if (!run?.window_recording || run.origin !== 'EXPLICIT_CANDIDATE_TRIAL') return run;
  let timeline;
  try {
    const file = path.join(store.runDirectory(run.run_id), 'execution', 'artifacts', 'step-evidence', 'step-observations.ndjson');
    if ((await fs.stat(file)).size > 4 * 1024 * 1024) throw Error('OBSERVATIONS_TOO_LARGE');
    const bytes = await fs.readFile(file);
    const observations = bytes.toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    timeline = windowTimelineFromObservations(run, observations);
    if (timeline.status === 'VERIFIED') timeline.observations_sha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  } catch {
    timeline = { schema, status: 'UNAVAILABLE', reason: 'WINDOW_TIMELINE_OBSERVATIONS_UNAVAILABLE', run_id: run.run_id };
  }
  return { ...run, window_timeline: timeline };
}
