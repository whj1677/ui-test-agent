import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Isolated UI fixture: verifies the current frontend contract without adding a
// product run or modifying the real E2E-01 project.
const base = 'http://127.0.0.1:4322';
const projectId = 'project-61579c25-2833-4c41-b592-357e1b306026';
const evidenceRoot = path.resolve('.local/step-replay-browser');
await fs.mkdir(evidenceRoot, { recursive: true });
const folders = (await fs.readdir('.local', { withFileTypes: true })).filter((item) => item.isDirectory() && item.name.startsWith('step-observer-check-'));
const latest = folders.map((entry) => ({ name: entry.name, time: 0 }));
for (const item of latest) item.time = (await fs.stat(path.join('.local', item.name))).mtimeMs;
latest.sort((a, b) => b.time - a.time);
assert(latest.length, 'engineering replay fixture required');
const fixtureRoot = path.join('.local', latest[0].name, 'ordered', 'run');
const video = await fs.readFile(path.join(fixtureRoot, 'artifacts', 'step-replay-v1.webm'));
const observed = (await fs.readFile(path.join(fixtureRoot, 'artifacts', 'step-evidence', 'step-observations.ndjson'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const response = await fetch(`${base}/api/case-library/projects/${projectId}/execution-records`);
assert.equal(response.ok, true);
const real = (await response.json()).records.find((run) => run.executed_external_id === 'TC-003');
assert(real);
const runId = 'run-engineering-replay-fixture';
const chapters = observed.map((entry, index) => ({ step_id: entry.step_id, start_seconds: index * 3,
  result_start_seconds: index * 3 + 1.2, end_seconds: index * 3 + 3 }));
const fixture = { ...real, run_id: runId, status: 'PASSED', error: null, step_replay: {
  schema: 'workbench/step-evidence-replay-v1', status: 'READY', run_id: runId,
  steps: observed.map((entry) => ({ step_id: entry.step_id, order: entry.order, action: `工程动作${entry.order}`,
    expected: `工程预期${entry.order}`, actual: '未单独采集实际值', execution_status: 'PASSED',
    screenshot_phase: 'after', screenshot_file_name: entry.captures[1].file_name })), chapters,
  }, files: [...real.files, { file_id: 'fixture-replay-video', file_name: 'step-replay-v1.webm', kind: 'normal_step_replay_video' }],
  runner_version: 'e2e01-step-evidence-replay-v1' };
fixture.step_replay.steps.push({ step_id: 'CASE_STEP_4', order: 4, action: '失败后不会执行的步骤', expected: '未执行',
  actual: '未单独采集实际值', execution_status: 'NOT_EXECUTED', screenshot_phase: null, screenshot_file_name: null });
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
  const page = await context.newPage();
  let variant = 'ready';
  await page.route(`**/api/case-library/projects/${projectId}/execution-records`, (route) => {
    const item = structuredClone(fixture);
    if (variant === 'missing-media' || variant === 'interrupted') {
      item.step_replay = { ...item.step_replay, status: 'UNAVAILABLE', reason: 'ENGINEERING_MEDIA_MISSING' };
      item.files = item.files.filter((file) => file.file_id !== 'fixture-replay-video');
    }
    if (variant === 'missing-screenshot') {
      item.step_replay.steps[0].screenshot_file_name = null;
      item.step_replay.steps[0].screenshot_error = 'CAPTURE_FAILED';
      item.step_replay.evidence_complete = false;
      item.step_replay.missing_captures = ['CASE_STEP_1'];
    }
    if (variant === 'interrupted') { item.status = 'INTERRUPTED'; item.complete_pass = false; }
    return route.fulfill({ json: { records: [item] } });
  });
  await page.route('**/api/build/tasks/**/media/fixture-replay-video', (route) => {
    const match = String(route.request().headers().range || '').match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), video.length - 1) : video.length - 1;
    return route.fulfill({ status: match ? 206 : 200, body: video.subarray(start, end + 1), contentType: 'video/webm',
      headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${video.length}`, 'content-length': String(end - start + 1) } });
  });
  await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=${runId}`);
  const detail = page.locator(`.execution-detail[data-run-id="${runId}"]`);
  await detail.waitFor();
  assert.match(await detail.innerText(), /非原始连续录像/);
  assert.equal(await page.locator('video').count(), 2);
  assert.equal(await page.locator('[data-step-seek]:not([disabled])').count(), 3);
  assert.equal(await page.locator('[data-step-seek="CASE_STEP_4"]').isEnabled(), false);
  const playback = page.getByTestId('execution-video');
  await playback.evaluate((element) => new Promise((resolve, reject) => {
    if (element.readyState >= 1) return resolve(); element.onloadedmetadata = resolve; element.onerror = reject;
  }));
  await page.locator('[data-step-seek="CASE_STEP_2"]').click();
  await playback.evaluate((element) => new Promise((resolve) => { if (element.currentTime >= 2.9) return resolve(); element.addEventListener('seeked', resolve, { once: true }); setTimeout(resolve, 1500); }));
  const seekSecond = await playback.evaluate((element) => element.currentTime);
  assert(seekSecond >= 2.9, `chapter click did not seek: ${seekSecond}; duration=${await playback.evaluate((element)=>element.duration)}; selected=${await page.locator('[data-step-id="CASE_STEP_2"]').getAttribute('class')}; ${await page.locator('#execution-video-message').innerText()}`);
  await playback.evaluate(async (element) => { await element.play(); await new Promise((resolve) => setTimeout(resolve, 250)); element.pause(); });
  assert.match(await page.locator('#execution-playing-step').innerText(), /步骤 2/);
  await page.screenshot({ path: path.join(evidenceRoot, 'fixture-replay-detail.png') });
  await page.reload(); await detail.waitFor();
  assert.equal(await page.getByTestId('execution-video').count(), 1);
  variant = 'missing-screenshot'; await page.reload(); await detail.waitFor();
  assert.match(await detail.innerText(), /CAPTURE_FAILED/);
  assert.match(await detail.innerText(), /截图采集不完整/);
  variant = 'missing-media'; await page.reload(); await detail.waitFor();
  assert.match(await detail.innerText(), /ENGINEERING_MEDIA_MISSING/);
  assert.equal(await page.locator('[data-step-seek]:not([disabled])').count(), 0);
  variant = 'interrupted'; await page.reload(); await detail.waitFor();
  assert.match(await detail.innerText(), /中断/);
  await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=not-found`);
  await page.getByTestId('run-record-not-found').waitFor();
  assert.equal(await page.locator('video').count(), 0);
  console.log(JSON.stringify({ status: 'PASS', checks: 14, fixture: true, evidence: evidenceRoot }));
} finally { await browser.close(); }
