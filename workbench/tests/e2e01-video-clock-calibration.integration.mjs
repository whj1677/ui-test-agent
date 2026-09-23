import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { trialTimelineInternals } from '../server/build/trial-timeline.mjs';
import { mapTraceFramesToEncodedVideo } from '../server/build/caption-video.mjs';

const root = path.resolve('.');
const output = path.resolve(process.env.E2E01_CALIBRATION_OUTPUT || `.local/e2e01-video-clock-calibration-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const executablePath = process.env.E2E01_CALIBRATION_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await fs.mkdir(output, { recursive: false });
const run = spawnSync(process.execPath, ['node_modules/playwright/cli.js', 'test', '--config', 'tests/e2e01-video-clock-calibration.config.mjs'],
  { cwd: root, env: { ...process.env, E2E01_CALIBRATION_OUTPUT: output, E2E01_CALIBRATION_BROWSER: executablePath }, encoding: 'utf8' });
process.stdout.write(run.stdout || ''); process.stderr.write(run.stderr || '');
assert.equal(run.status, 0, 'isolated Playwright visual-state test succeeds');

async function findFiles(folder, names, results = []) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) await findFiles(absolute, names, results);
    else if (names.has(entry.name)) results.push(absolute);
  }
  return results;
}
const files = await findFiles(output, new Set(['trace.zip', 'video.webm']));
const tracePath = files.find((file) => path.basename(file) === 'trace.zip');
const videoPath = files.find((file) => path.basename(file) === 'video.webm');
assert.ok(tracePath && videoPath, 'actual recorded WebM and Playwright Trace exist');
const traceBytes = await fs.readFile(tracePath);
const testEvents = trialTimelineInternals.zipEntry(traceBytes, 'test.trace').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const steps = testEvents.filter((event) => event.type === 'before' && event.method === 'test.step' && /^CAL_STEP_[1-4]/.test(event.title));
assert.equal(steps.length, 4, 'real test.step events cover three measured boundaries and one holdout boundary');
const browser = await chromium.launch({ headless: true, executablePath });
let calibration;
try {
  const page = await browser.newPage();
  const clockMap = await mapTraceFramesToEncodedVideo(page, await fs.readFile(videoPath), tracePath);
  assert.equal(clockMap.status, 'VERIFIED', `decoded Trace/video mapping: ${JSON.stringify(clockMap)}`);
  const changes = await page.evaluate(async (base64) => {
    const video = document.createElement('video'); video.muted = true; video.src = `data:video/webm;base64,${base64}`;
    await new Promise((resolve, reject) => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', reject, { once: true }); });
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true }); const expected = [
      ['CAL_STATE_0', [51, 65, 85]], ['CAL_STATE_1', [185, 28, 28]], ['CAL_STATE_2', [4, 120, 87]],
      ['CAL_STATE_3', [126, 34, 206]], ['CAL_STATE_4', [3, 105, 161]],
    ];
    const found = []; let prior = null; let videoZeroPixel = null;
    for (let second = 0; second < video.duration; second += 1 / 25) {
      if (second > 0) await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = second; });
      context.drawImage(video, 0, 0, 32, 32); const pixel = context.getImageData(3, 4, 1, 1).data;
      if (second === 0) videoZeroPixel = [...pixel].slice(0, 3);
      const label = expected.map(([name, rgb]) => ({ name, error: Math.abs(pixel[0] - rgb[0]) + Math.abs(pixel[1] - rgb[1]) + Math.abs(pixel[2] - rgb[2]) }))
        .sort((left, right) => left.error - right.error)[0];
      const state = label.error < 45 ? label.name : null;
      if (state && state !== prior) found.push({ state, video_second: video.currentTime, pixel: [...pixel].slice(0, 3) });
      prior = state;
    }
    return { found, videoZeroPixel };
  }, (await fs.readFile(videoPath)).toString('base64'));
  const transitions = ['CAL_STATE_1', 'CAL_STATE_2', 'CAL_STATE_3', 'CAL_STATE_4'].map((state) => changes.found.find((change) => change.state === state));
  assert.ok(transitions.every(Boolean), 'four distinct state transitions are visible in decoded encoded video');
  const comparisons = steps.map((step, index) => {
    const expectedSecond = clockMap.slope * step.startTime + clockMap.intercept_seconds;
    const actualSecond = transitions[index].video_second;
    const deltaMs = Math.round(Math.abs(actualSecond - expectedSecond) * 1000);
    const previous = index > 0 ? clockMap.slope * steps[index - 1].startTime + clockMap.intercept_seconds : -Infinity;
    const next = index < steps.length - 1 ? clockMap.slope * steps[index + 1].startTime + clockMap.intercept_seconds : Infinity;
    const nearestAdjacentBoundaryMs = Math.min(expectedSecond - previous, next - expectedSecond) * 500;
    return { step: step.title, expected_second_from_trace_map: expectedSecond, visual_transition_second: actualSecond,
      deviation_ms: deltaMs, nearest_adjacent_boundary_ms: Math.round(nearestAdjacentBoundaryMs) };
  });
  assert.ok(comparisons.every((item) => item.deviation_ms < item.nearest_adjacent_boundary_ms),
    'decoded visual transitions remain closer to their own step event than to an adjacent step boundary');
  assert.ok(clockMap.guaranteed_precision_ms < Math.min(...comparisons.map((item) => item.nearest_adjacent_boundary_ms)),
    'measured clock uncertainty remains strictly inside the nearest half-step boundary');
  assert.ok(changes.videoZeroPixel.every((value) => value < 20),
    'time zero is inspected as the decoded black/blank initial recorder frame, not inferred from page creation');
  calibration = { status: 'VERIFIED', run_id: 'isolated-calibration-only', page_id: clockMap.page_id,
    startup_delay_ms: 500, video_zero_pixel_rgb: changes.videoZeroPixel,
    matched_frame_count: clockMap.matches.length,
    max_fit_residual_ms: Math.round(clockMap.max_residual_seconds * 1000), guaranteed_precision_ms: clockMap.guaranteed_precision_ms,
    max_measured_boundary_deviation_ms: Math.max(...comparisons.map((item) => item.deviation_ms)),
    boundary_comparisons: comparisons, visual_state_transitions: changes.found, media_paths: { trace: tracePath, video: videoPath } };
} finally { await browser.close(); }
await fs.writeFile(path.join(output, 'calibration-summary.json'), `${JSON.stringify(calibration, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(calibration, null, 2));
