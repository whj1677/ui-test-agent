import fs from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

// Read only the two Playwright trace streams needed for execution timing.
function zipEntry(bytes, name) {
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
      if (method === 0) return compressed.toString('utf8');
      if (method === 8) return inflateRawSync(compressed).toString('utf8');
      throw new Error('TRACE_ZIP_COMPRESSION_UNSUPPORTED');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`TRACE_ENTRY_MISSING:${name}`);
}

function events(stream) {
  return stream.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function marker(title) { return /^CASE_STEP_([1-9]\d*)(?:\b|[:：\s])/.exec(title || '')?.[0]?.match(/^CASE_STEP_\d+/)?.[0] || null; }

export async function deriveTrialTimeline({ tracePath, durationSeconds, caseContent, coverage, runId, candidateSha256 }) {
  try {
    const bytes = await fs.readFile(tracePath);
    const testEvents = events(zipEntry(bytes, 'test.trace'));
    const contextEvents = events(zipEntry(bytes, '0-trace.trace'));
    const page = contextEvents.find((event) => event.type === 'event' && event.method === 'page' && Number.isFinite(event.time));
    const firstFrame = contextEvents.find((event) => event.type === 'screencast-frame' && Number.isFinite(event.timestamp));
    if (!page || !firstFrame || firstFrame.timestamp < page.time || firstFrame.timestamp - page.time > 500) throw new Error('VIDEO_ANCHOR_UNVERIFIED');
    const started = testEvents.filter((event) => event.type === 'before' && event.method === 'test.step' && marker(event.title));
    const finished = new Map(testEvents.filter((event) => event.type === 'after' && Number.isFinite(event.endTime)).map((event) => [event.callId, event]));
    const sourceSteps = caseContent?.steps || [];
    const steps = (coverage?.items || []).map((item) => {
      const source = sourceSteps.find((step) => step.order === item.order);
      const event = started.find((entry) => marker(entry.title) === item.marker);
      const end = event && finished.get(event.callId);
      const startSeconds = event && (event.startTime - page.time) / 1000;
      const endSeconds = end && (end.endTime - page.time) / 1000;
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
      schema: 'workbench/trial-timeline-v1', status: 'VERIFIED',
      run_id: runId, candidate_sha256: candidateSha256,
      source: { kind: 'PLAYWRIGHT_TRACE', trace_entry: 'test.trace + 0-trace.trace', anchor: 'page-created-event',
        first_frame_delta_ms: Math.round((firstFrame.timestamp - page.time) * 1000) / 1000,
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

export const trialTimelineInternals = { zipEntry, marker };
