import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyWorkbenchCandidate } from '../server/build/adapter.mjs';
import { parseCandidateReport } from '../server/build/report.mjs';
import { chromium } from '@playwright/test';
import { renderStepReplay } from '../server/build/step-replay.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = await fs.mkdtemp(path.join(root, '.local', 'step-observer-check-'));
const executable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlPath = path.join(workspace, 'static.html');
await fs.writeFile(htmlPath, '<!doctype html><html><meta charset="utf-8"><body><button id="change">A</button><script>change.onclick=()=>{change.textContent=change.textContent==="A"?"B":"C"}</script></body></html>');

async function run(name, source) {
  const candidateDir = path.join(workspace, name, 'candidate');
  const runDirectory = path.join(workspace, name, 'run');
  await fs.mkdir(candidateDir, { recursive: true });
  const candidatePath = path.join(candidateDir, 'candidate.spec.mjs');
  await fs.writeFile(candidatePath, source);
  const raw = await verifyWorkbenchCandidate({ candidatePath, browserExecutable: executable,
    fixtureUrl: pathToFileURL(htmlPath).href, runDirectory,
    stepObservation: { run_id: `run-${name}`, candidate_sha256: 'A'.repeat(64), executed_external_id: 'ENGINEERING', executed_case_version: 1 } });
  const report = await parseCandidateReport(raw.reportPath, raw.process);
  const evidenceDir = path.join(runDirectory, 'artifacts', 'step-evidence');
  const observations = (await fs.readFile(path.join(evidenceDir, 'step-observations.ndjson'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  return { raw, report, observations, evidenceDir, runDirectory };
}

const importLine = "import { test, expect } from '@playwright/test';";
const success = await run('ordered', `${importLine}
test.beforeEach(async({page})=>page.goto(process.env.PROBE_URL));
test('static steps',async({page})=>{
 await test.step('CASE_STEP_1: change',async()=>{await page.locator('#change').click()});
 await test.step('CASE_STEP_2: assert unchanged',async()=>{await expect(page.locator('#change')).toHaveText('B')});
 await test.step('CASE_STEP_3: change quickly',async()=>{await page.locator('#change').click()});
});`);
assert.equal(success.report.test_status, 'PASSED', JSON.stringify(success.raw.process));
assert.deepEqual(success.observations.map((item) => item.step_id), ['CASE_STEP_1', 'CASE_STEP_2', 'CASE_STEP_3']);
assert(success.observations.every((item) => item.captures.every((capture) => capture.file_name && !capture.capture_error)));
assert(success.observations.every((item) => item.started_at <= item.business_started_at &&
  item.business_started_at <= item.business_ended_at && item.business_ended_at <= item.ended_at));

const browser = await chromium.launch({ executablePath: executable, headless: true });
try {
  const page = await browser.newPage();
  async function visualText(file) {
    const bytes = await fs.readFile(file);
    await page.setContent(`<img id="evidence" src="data:image/png;base64,${bytes.toString('base64')}">`);
    return page.evaluate(async () => {
      const image = document.querySelector('#evidence'); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const pixel = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0; for (let i = 0; i < pixel.length; i += 64) hash = (hash * 31 + pixel[i]) >>> 0;
      return hash;
    });
  }
  const hashes = [];
  for (const step of success.observations) for (const capture of step.captures)
    hashes.push(await visualText(path.join(success.evidenceDir, capture.file_name)));
  assert.equal(hashes[1], hashes[2], 'same B scene belongs to step 1 end and step 2 start');
  assert.equal(hashes[2], hashes[3], 'pure assertion has same before/after scene');
  assert.equal(hashes[3], hashes[4], 'rapid following step begins at same B scene');
  assert.notEqual(hashes[4], hashes[5], 'step 3 changes scene');
  assert.notEqual(hashes[0], hashes[1], 'step 1 changes scene');
} finally { await browser.close(); }

// Regression: on Windows a run-specific "negative" observer cwd reached 259
// characters and child-process spawn failed before Playwright wrote a report.
const shortCandidate = path.join(workspace, 'ordered', 'candidate', 'candidate.spec.mjs');
const longTail = path.join('negative', 'runs', 'run-engineering', 'observer-entry');
const padding = Math.max(1, 260 - path.join(workspace, longTail).length - 1);
const longRunDirectory = path.join(workspace, 'x'.repeat(padding), 'negative', 'runs', 'run-engineering');
assert(path.join(longRunDirectory, 'observer-entry').length >= 260);
const longRun = await verifyWorkbenchCandidate({ candidatePath: shortCandidate, browserExecutable: executable,
  fixtureUrl: pathToFileURL(htmlPath).href, runDirectory: longRunDirectory,
  stepObservation: { run_id: 'run-long-cwd', candidate_sha256: 'A'.repeat(64), executed_external_id: 'ENGINEERING', executed_case_version: 1 } });
const longReport = await parseCandidateReport(longRun.reportPath, longRun.process);
assert.equal(longRun.process.error, null, JSON.stringify(longRun.process));
assert.equal(longReport.test_status, 'PASSED', JSON.stringify(longRun.process));
assert((await fs.readFile(path.join(longRunDirectory, 'artifacts', 'step-evidence', 'step-observations.ndjson'), 'utf8')).includes('CASE_STEP_3'));

const failure = await run('failure', `${importLine}
test.beforeEach(async({page})=>page.goto(process.env.PROBE_URL));
test.afterEach(async({page})=>page.close());
test('failure and cleanup',async({page})=>{
 await test.step('CASE_STEP_1: change',async()=>{await page.locator('#change').click()});
 await test.step('CASE_STEP_2: assert failure',async()=>{await expect(page.locator('#change')).toHaveText('WRONG')});
 await test.step('CASE_STEP_3: must not run',async()=>{throw new Error('NEXT_STEP_RAN')});
});`);
assert.equal(failure.report.test_status, 'FAILED');
assert.match(failure.report.error.message, /WRONG/);
assert.deepEqual(failure.observations.map((item) => item.step_id), ['CASE_STEP_1', 'CASE_STEP_2']);
assert.equal(failure.observations[1].status, 'FAILED');
assert(failure.observations[1].captures[1].file_name, 'failure image captured before afterEach closes page');

const captureFailure = await run('capture-failure', `${importLine}
test.beforeEach(async({page})=>page.goto(process.env.PROBE_URL));
test('capture failure preserves assertion',async({page})=>{
 await test.step('CASE_STEP_1: close then fail',async()=>{await page.close(); throw new Error('ORIGINAL_BUSINESS_ERROR')});
});`);
assert.equal(captureFailure.report.test_status, 'FAILED');
assert.match(captureFailure.report.error.message, /ORIGINAL_BUSINESS_ERROR/);
assert.equal(captureFailure.observations[0].captures[1].file_name, null);
assert.match(captureFailure.observations[0].captures[1].capture_error, /OBSERVED_PAGE_UNAVAILABLE/);
const replay = await renderStepReplay({ runDirectory: success.runDirectory, runId: 'run-ordered',
  candidateSha256: 'A'.repeat(64), executedExternalId: 'ENGINEERING', executedCaseVersion: 1,
  caseContent: { steps: [1,2,3].map((order) => ({ order, action: `工程动作${order}`, expected: `工程预期${order}` })) },
  coverage: { items: success.observations.map((item) => ({ step_id: item.step_id, order: item.order,
    raw_title: item.raw_title, execution_status: item.status, observed: true, attributed_errors: [] })) },
  browserExecutable: executable });
assert.equal(replay.replay.status, 'READY', replay.replay.reason);
assert.equal(replay.replay.evidence_complete, true);
assert.equal(replay.replay.chapters.length, 3);
assert(replay.replay.chapters.every((chapter, index) => index === 0 || chapter.start_seconds >= replay.replay.chapters[index - 1].end_seconds));
assert(replay.replay.steps.every((step) => step.screenshot_phase === 'after' && step.screenshot_file_name));
const replayBrowser = await chromium.launch({ executablePath: executable, headless: true });
try {
  const page = await replayBrowser.newPage({ viewport: { width: 1280, height: 900 } });
  const bytes = await fs.readFile(replay.videoPath);
  await page.setContent(`<video controls muted src="data:video/webm;base64,${bytes.toString('base64')}"></video>`);
  await page.locator('video').evaluate((video) => new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve(); video.onloadedmetadata = resolve; video.onerror = reject;
  }));
  const duration = await page.locator('video').evaluate((video) => video.duration);
  assert(duration >= replay.replay.chapters.at(-1).end_seconds);
  await page.locator('video').evaluate(async (video, second) => {
    video.currentTime = second;
    await new Promise((resolve) => { video.onseeked = resolve; });
  }, replay.replay.chapters[1].result_start_seconds + 0.3);
  await page.locator('video').screenshot({ path: path.join(workspace, 'replay-step-2-result.png') });
} finally { await replayBrowser.close(); }
console.log(JSON.stringify({ status: 'PASS', checks: 24, workspace, replay_video: replay.videoPath,
  decoded_frame: path.join(workspace, 'replay-step-2-result.png') }));
