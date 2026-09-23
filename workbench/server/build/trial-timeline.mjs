import fs from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

// Read only the two Playwright trace streams needed for execution timing.
function zipEntryBytes(bytes, name) {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error('TRACE_ZIP_DIRECTORY_MISSING');
  let cursor = bytes.readUInt32LE(end + 16);
  const count = bytes.readUInt16LE(end + 10);
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('TRACE_ZIP_ENTRY_INVALID');
    const method = bytes.readUInt16LE(cursor + 10);
    const size = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42);
    const currentName = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (currentName === name) {
      if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('TRACE_ZIP_LOCAL_ENTRY_INVALID');
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const compressed = bytes.subarray(start, start + size);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      throw new Error('TRACE_ZIP_COMPRESSION_UNSUPPORTED');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`TRACE_ENTRY_MISSING:${name}`);
}

function zipEntry(bytes, name) { return zipEntryBytes(bytes, name).toString('utf8'); }

function events(stream) {
  return stream.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function marker(title) { return /^CASE_STEP_([1-9]\d*)(?:\b|[:：\s])/.exec(title || '')?.[0]?.match(/^CASE_STEP_\d+/)?.[0] || null; }

export async function deriveTrialTimeline({ tracePath, durationSeconds, caseContent, coverage, runId, candidateSha256, clockMap }) {
  try {
    const bytes = await fs.readFile(tracePath);
    const testEvents = events(zipEntry(bytes, 'test.trace'));
    const contextEvents = events(zipEntry(bytes, '0-trace.trace'));
    const contextOptions = contextEvents.find((event) => event.type === 'context-options');
    if (contextOptions?.playwrightVersion !== '1.62.1') throw new Error('PLAYWRIGHT_CLOCK_VERSION_UNSUPPORTED');
    const pages = contextEvents.filter((event) => event.type === 'event' && event.method === 'page' &&
      Number.isFinite(event.time) && typeof event.params?.pageId === 'string');
    if (pages.length !== 1) throw new Error('VIDEO_PAGE_IDENTITY_AMBIGUOUS');
    const page = pages[0];
    const frames = contextEvents.filter((event) => event.type === 'screencast-frame' &&
      event.pageId === page.params.pageId && Number.isFinite(event.timestamp) && Number.isFinite(event.frameSwapWallTime));
    const firstFrame = frames[0];
    if (!firstFrame || clockMap?.status !== 'VERIFIED' || clockMap.page_id !== page.params.pageId ||
        !Number.isFinite(clockMap.slope) || !Number.isFinite(clockMap.intercept_seconds) ||
        !Array.isArray(clockMap.matches) || clockMap.matches.length < 3 ||
        !Number.isFinite(clockMap.guaranteed_precision_ms) || clockMap.guaranteed_precision_ms > 160 ||
        !clockMap.matches.every((match) => frames.some((frame) => frame.timestamp === match.trace_time_ms && frame.sha1 === match.trace_frame_sha1)))
      throw new Error(clockMap?.reason || 'TRACE_VIDEO_CLOCK_MAP_UNVERIFIED');
    const started = testEvents.filter((event) => event.type === 'before' && event.method === 'test.step' && marker(event.title));
    const finished = new Map(testEvents.filter((event) => event.type === 'after' && Number.isFinite(event.endTime)).map((event) => [event.callId, event]));
    const sourceSteps = caseContent?.steps || [];
    const mappedStepStarts = (coverage?.items || []).map((item) => started.find((entry) => marker(entry.title) === item.marker)?.startTime)
      .filter(Number.isFinite).sort((left, right) => left - right);
    const nearestStepBoundaryMs = mappedStepStarts.slice(1).reduce((nearest, time, index) =>
      Math.min(nearest, (time - mappedStepStarts[index]) / 2), Infinity);
    if (clockMap.guaranteed_precision_ms >= nearestStepBoundaryMs)
      throw new Error('VIDEO_CLOCK_UNCERTAINTY_CROSSES_ADJACENT_STEP_BOUNDARY');
    const steps = (coverage?.items || []).map((item) => {
      const source = sourceSteps.find((step) => step.order === item.order);
      const event = started.find((entry) => marker(entry.title) === item.marker);
      const end = event && finished.get(event.callId);
      const startSeconds = event && clockMap.slope * event.startTime + clockMap.intercept_seconds;
      const endSeconds = end && clockMap.slope * end.endTime + clockMap.intercept_seconds;
      const valid = item.observed && Number.isFinite(startSeconds) && Number.isFinite(endSeconds) &&
        startSeconds >= -0.08 && endSeconds >= startSeconds && endSeconds <= durationSeconds + 0.12;
      const attributed = item.attributed_errors?.find((entry) => entry.error?.type === 'ASSERTION_MISMATCH')?.error;
      return {
        step_id: item.marker, order: item.order,
        action: source?.action || '原步骤动作未取得', expected: source?.expected || '原步骤预期未取得',
        execution_status: item.execution_status,
        actual: attributed?.actual ?? '未单独采集实际值',
        assertion_expected: attributed?.expected ?? null,
        source_video_start_seconds: valid ? Math.max(0, startSeconds) : null,
        source_video_end_seconds: valid ? Math.min(durationSeconds, endSeconds) : null,
        source_trace_call_id: valid ? event.callId : null,
      };
    });
    if (steps.some((step) => step.execution_status !== 'NOT_EXECUTED' && step.source_video_start_seconds === null)) throw new Error('STEP_VIDEO_TIME_UNVERIFIED');
    return {
      schema: 'workbench/trial-timeline-v2', status: 'VERIFIED',
      run_id: runId, candidate_sha256: candidateSha256,
      source: { kind: 'PLAYWRIGHT_TRACE_AND_DECODED_VIDEO', trace_entry: 'test.trace + 0-trace.trace', anchor: 'same-page-trace-jpeg-to-decoded-webm-frame-fit',
        page_id: page.params.pageId, trace_first_frame_timestamp_ms: firstFrame.timestamp,
        trace_first_frame_swap_wall_time_ms: firstFrame.frameSwapWallTime,
        clock_slope: clockMap.slope, clock_intercept_seconds: clockMap.intercept_seconds,
        matched_frame_count: clockMap.matches.length,
        max_clock_fit_residual_ms: Math.round(clockMap.max_residual_seconds * 1000),
        guaranteed_precision_ms: clockMap.guaranteed_precision_ms,
        matched_frames: clockMap.matches,
        video_duration_seconds: durationSeconds, playwright_version: '1.62.1' },
      steps,
    };
  } catch (error) {
    return { schema: 'workbench/trial-timeline-v1', status: 'UNAVAILABLE', run_id: runId,
      candidate_sha256: candidateSha256, reason: error.message, steps: (coverage?.items || []).map((item) => {
        const source = caseContent?.steps?.find((step) => step.order === item.order);
        const attributed = item.attributed_errors?.find((entry) => entry.error?.type === 'ASSERTION_MISMATCH')?.error;
        return { step_id: item.marker, order: item.order, action: source?.action || '原步骤动作未取得',
          expected: source?.expected || '原步骤预期未取得', execution_status: item.execution_status,
          actual: attributed?.actual ?? '未单独采集实际值', assertion_expected: attributed?.expected ?? null,
          source_video_start_seconds: null, source_video_end_seconds: null };
      }) };
  }
}

export const trialTimelineInternals = { zipEntry, zipEntryBytes, marker };
