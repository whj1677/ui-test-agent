import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deriveTrialTimeline } from '../server/build/trial-timeline.mjs';
import { addWebmDuration } from '../server/build/caption-video.mjs';
import { indexAttemptFiles } from '../server/build/files.mjs';

function traceZip(entries) {
  const local = []; const central = []; let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const filename = Buffer.from(name); const content = Buffer.from(value);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt32LE(content.length, 18); header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, content);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt32LE(content.length, 20); directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + content.length;
  }
  const centralBytes = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

const content = { steps: [
  { order: 1, action: '选择设备', expected: '显示列表' },
  { order: 2, action: '核对功率', expected: '220 kW' },
  { order: 3, action: '关闭弹窗', expected: '弹窗关闭' },
] };
const coverage = { items: [
  { marker: 'CASE_STEP_1', order: 1, observed: true, execution_status: 'PASSED' },
  { marker: 'CASE_STEP_2', order: 2, observed: true, execution_status: 'FAILED',
    attributed_errors: [{ error: { type: 'ASSERTION_MISMATCH', expected: '220 kW', actual: '320 kW' } }] },
  { marker: 'CASE_STEP_3', order: 3, observed: false, execution_status: 'NOT_EXECUTED' },
] };
const lines = (values) => values.map((value) => JSON.stringify(value)).join('\n');
const contextOptions = { type: 'context-options', playwrightVersion: '1.62.1' };
const clockMap = { status: 'VERIFIED', page_id: 'page-1', slope: 0.001, intercept_seconds: -1.04,
  guaranteed_precision_ms: 80, max_residual_seconds: 0.04,
  matches: [1040, 1500, 2000].map((time) => ({ trace_time_ms: time, trace_frame_sha1: `frame-${time}` })) };

test('trace-derived timeline preserves source timing and unexecuted step', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), `e2e01-timeline-${randomUUID()}-`));
  try {
    const tracePath = path.join(folder, 'trace.zip');
    const frames = [1040, 1500, 2000].map((time) => ({ type: 'screencast-frame', pageId: 'page-1', timestamp: time,
      frameSwapWallTime: time + 10, sha1: `frame-${time}` }));
    await fs.writeFile(tracePath, traceZip({
      '0-trace.trace': lines([contextOptions, { type: 'event', method: 'page', time: 1000, params: { pageId: 'page-1' } }, ...frames]),
      'test.trace': lines([
        { type: 'before', method: 'test.step', title: 'CASE_STEP_1', callId: 's1', startTime: 1200 },
        { type: 'after', callId: 's1', endTime: 1700 },
        { type: 'before', method: 'test.step', title: 'CASE_STEP_2', callId: 's2', startTime: 1700 },
        { type: 'after', callId: 's2', endTime: 2450 },
      ]),
    }));
    const result = await deriveTrialTimeline({ tracePath, durationSeconds: 2.7, caseContent: content,
      coverage, runId: 'run-synthetic', candidateSha256: 'SYNTHETIC', clockMap });
    assert.equal(result.status, 'VERIFIED');
    assert.ok(Math.abs(result.steps[0].source_video_start_seconds - 0.16) < 1e-9);
    assert.ok(Math.abs(result.steps[1].source_video_end_seconds - 1.41) < 1e-9);
    assert.equal(result.steps[1].actual, '320 kW');
    assert.equal(result.steps[0].actual, '未单独采集实际值');
    assert.equal(result.steps[2].source_video_start_seconds, null);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('missing or uncalibrated trace never invents a seek timeline', async () => {
  const missing = await deriveTrialTimeline({ tracePath: path.join(os.tmpdir(), randomUUID()),
    durationSeconds: 3, caseContent: content, coverage, runId: 'missing', candidateSha256: 'SYNTHETIC' });
  assert.equal(missing.status, 'UNAVAILABLE');
  assert.equal(missing.steps[1].source_video_start_seconds, null);
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), `e2e01-badtrace-${randomUUID()}-`));
  try {
    const tracePath = path.join(folder, 'trace.zip');
    await fs.writeFile(tracePath, traceZip({
      '0-trace.trace': lines([contextOptions, { type: 'event', method: 'page', time: 1000, params: { pageId: 'page-1' } },
        { type: 'screencast-frame', timestamp: 1800, pageId: 'page-1', frameSwapWallTime: 1810, sha1: 'frame-a' }]),
      'test.trace': lines([]),
    }));
    const result = await deriveTrialTimeline({ tracePath, durationSeconds: 3, caseContent: content,
      coverage, runId: 'uncalibrated', candidateSha256: 'SYNTHETIC', clockMap });
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.reason, 'TRACE_VIDEO_CLOCK_MAP_UNVERIFIED');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('derived WebM duration is explicit and invalid media fails closed', () => {
  const source = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]),
    Buffer.from([0x15, 0x49, 0xa9, 0x66, 0x84, 0x4d, 0x80, 0x81, 0x01])]);
  const output = addWebmDuration(source, 7.5);
  assert.equal(output[9], 0x8f);
  assert.equal(output.subarray(14, 17).toString('hex'), '448988');
  assert.equal(output.readDoubleBE(17), 7500);
  assert.throws(() => addWebmDuration(Buffer.from('not webm'), 7.5), /WEBM_DURATION_PATCH_UNAVAILABLE/);
});

test('versioned derived caption video is indexed as caption media without replacing v1', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `e2e01-caption-files-${randomUUID()}-`));
  try {
    const taskRoot = path.join(root, 'task');
    const attemptRoot = path.join(taskRoot, 'attempts', 'attempt-01-initial');
    const candidatePath = path.join(attemptRoot, 'workspace', 'input', 'candidate-v1.spec.mjs');
    const artifactRoot = path.join(attemptRoot, 'verification', 'normal', 'runs', 'run-test', 'artifacts');
    await fs.mkdir(path.dirname(candidatePath), { recursive: true });
    await fs.mkdir(artifactRoot, { recursive: true });
    await fs.writeFile(candidatePath, 'candidate bytes');
    await fs.writeFile(path.join(artifactRoot, 'captioned.webm'), 'v1 media');
    await fs.writeFile(path.join(artifactRoot, 'captioned-v2.webm'), 'v2 media');
    const indexed = await indexAttemptFiles({ taskRoot, attemptRoot, candidatePath, attemptId: 'attempt-01-initial', runId: 'run-test' });
    assert.deepEqual(indexed.unexpected, []);
    const videos = indexed.files.filter((file) => file.kind === 'normal_caption_video');
    assert.deepEqual(videos.map((file) => file.file_name).sort(), ['captioned-v2.webm', 'captioned.webm']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
