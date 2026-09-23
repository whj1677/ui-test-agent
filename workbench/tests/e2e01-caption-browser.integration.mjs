import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { trialTimelineInternals } from '../server/build/trial-timeline.mjs';

// Product-data browser check: no candidate or business page is scripted here.
const base = process.env.E2E01_BASE_URL || 'http://127.0.0.1:4322';
const projectId = process.env.E2E01_PROJECT_ID || 'project-61579c25-2833-4c41-b592-357e1b306026';
const evidence = path.resolve(process.env.E2E01_BROWSER_EVIDENCE || '.local/e2e01-caption-browser');
const executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await fs.mkdir(evidence, { recursive: true });
const response = await fetch(`${base}/api/case-library/projects/${projectId}/execution-records`);
assert.equal(response.ok, true, 'product records endpoint available');
const { records } = await response.json();
const selected = [1, 2, 3, 4, 5, 6].map((number) => {
  const id = `TC-${String(number).padStart(3, '0')}`;
  const run = records.filter((entry) => entry.executed_external_id === id && entry.runner_version === 'e2e01-caption-timeline-v1').at(-1);
  assert.ok(run, `${id} has a new caption-enabled run`);
  return run;
});
const faultOracle = {
  'TC-004': ['CASE_STEP_3', '共2条', '共3条'],
  'TC-005': ['CASE_STEP_2', '["DEV-005","DEV-006","DEV-002","DEV-004","DEV-001","DEV-003"]',
    '["DEV-005","DEV-002","DEV-006","DEV-004","DEV-001","DEV-003"]'],
  'TC-006': ['CASE_STEP_2', '220 kW', '320 kW'],
};
for (const [normal, fault] of [[0, 3], [1, 4], [2, 5]])
  assert.equal(selected[normal].candidate_sha256, selected[fault].candidate_sha256, 'normal/fault candidate bytes remain paired');

const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN', acceptDownloads: true });
const page = await context.newPage();
const summary = [];
try {
  const validLatest = [...records].sort((left, right) => String(left.started_at).localeCompare(String(right.started_at))).at(-1);
  await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records`);
  await page.locator(`.execution-detail[data-run-id="${validLatest.run_id}"]`).waitFor();
  assert.equal(await page.locator('video[data-testid="execution-video"]').count(), 1, 'no query selects the latest sorted run');
  await page.reload();
  await page.locator(`.execution-detail[data-run-id="${validLatest.run_id}"]`).waitFor();
  for (const invalid of ['', 'run-does-not-exist', 'not-a-run-id']) {
    const query = invalid === '' ? '?run_id=' : `?run_id=${encodeURIComponent(invalid)}`;
    await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records${query}`);
    await page.getByTestId('run-record-not-found').waitFor();
    assert.equal(await page.locator('.execution-detail').count(), 0, 'invalid requested target renders no other run detail');
    assert.equal(await page.locator('video').count(), 0, 'invalid requested target renders no other recording');
    assert.equal(await page.locator('.execution-step').count(), 0, 'invalid requested target renders no other step list');
  }
  const foreignProjectId = process.env.E2E01_FOREIGN_PROJECT_ID || 'project-0d8cab05-a2b0-4626-b6fb-fd17879c751f';
  const foreignRecordsResponse = await fetch(`${base}/api/case-library/projects/${foreignProjectId}/execution-records`);
  assert.equal(foreignRecordsResponse.ok, true);
  assert.deepEqual((await foreignRecordsResponse.json()).records, [], 'other project has no run records in this isolated dataset');
  await page.goto(`${base}/workspace/#/projects/${foreignProjectId}/execution-records?run_id=${validLatest.run_id}`);
  await page.getByTestId('run-record-not-found').waitFor();
  assert.equal(await page.locator('.execution-detail, video, .execution-step').count(), 0,
    'a run belonging to project A never displays project B detail or media');
  const first = selected[0]; const second = selected[1];
  await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=${first.run_id}`);
  await page.locator(`.execution-detail[data-run-id="${first.run_id}"]`).waitFor();
  await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=${second.run_id}`);
  await page.locator(`.execution-detail[data-run-id="${second.run_id}"]`).waitFor();
  await page.goBack();
  await page.locator(`.execution-detail[data-run-id="${first.run_id}"]`).waitFor();
  await page.goForward();
  await page.locator(`.execution-detail[data-run-id="${second.run_id}"]`).waitFor();
  summary.push({ check: 'run-id-selection', default_latest: validLatest.run_id, invalid_ids: 3,
    cross_project_id: validLatest.run_id, history: 'back-forward-refresh' });
  for (let index = 0; index < selected.length; index += 1) {
    const run = selected[index]; const id = run.executed_external_id;
    await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=${run.run_id}`);
    const detail = page.locator(`.execution-detail[data-run-id="${run.run_id}"]`);
    await detail.waitFor();
    assert.match(await detail.innerText(), new RegExp(id));
    assert.equal(run.status, index < 3 ? 'PASSED' : 'FAILED');
    assert.equal(run.complete_pass, index < 3);
    assert.equal(run.caption_timeline?.status, 'VERIFIED');
    assert.notEqual(run.caption_timeline?.schema, 'workbench/trial-timeline-v2', 'historical v1 timing is explicitly not accepted as calibrated');
    assert.match(await detail.innerText(), /旧版带中文字幕录像[\s\S]*时间未验证|旧版中文字幕录像[\s\S]*时间零点尚未验证/);
    if (index >= 3) {
      assert.deepEqual([run.failure_step, run.error?.expected, run.error?.actual], faultOracle[id]);
      assert.equal(run.specified_defect_detected, true);
    }
    const video = detail.getByTestId('execution-video');
    await video.evaluate((node) => new Promise((resolve, reject) => {
      if (node.readyState >= 1) return resolve();
      node.addEventListener('loadedmetadata', resolve, { once: true });
      node.addEventListener('error', () => reject(new Error('MEDIA_DECODE_FAILED')), { once: true });
    }));
    const duration = await video.evaluate((node) => node.duration);
    assert.ok(Number.isFinite(duration) && duration > 2, `${id} has seekable caption video`);
    await video.evaluate(async (node) => { node.muted = true; await node.play(); });
    await page.waitForFunction(() => document.querySelector('[data-testid="execution-video"]')?.currentTime > 0.15);
    await video.evaluate((node) => node.pause());
    await video.evaluate((node, seconds) => { node.currentTime = seconds; }, duration / 2);
    await page.waitForFunction((seconds) => Math.abs(document.querySelector('[data-testid="execution-video"]')?.currentTime - seconds) < 0.15, duration / 2);
    assert.equal(await detail.locator('[data-step-seek]:not([disabled])').count(), 0,
      'legacy timeline never offers a seek position that is not supported by decoded-frame evidence');
    await video.evaluate((node) => { node.playbackRate = 2; node.currentTime = Math.max(0, node.duration - 0.35); });
    assert.equal(await video.evaluate((node) => node.playbackRate), 2);
    await video.evaluate((node) => { node.playbackRate = 1; node.currentTime = 0; });
    if (index >= 3) {
      const failed = run.caption_timeline.steps.find((step) => step.execution_status === 'FAILED');
      assert.ok(failed && failed.actual !== '未单独采集实际值');
      assert.equal(await detail.locator(`[data-step-seek="${failed.step_id}"]`).isDisabled(), true);
      assert.match(await detail.innerText(), /预期：|预期\n/);
      const beforeInspect = await video.evaluate((node) => node.currentTime);
      await detail.getByText('查看原始错误').click();
      assert.ok(Math.abs(await video.evaluate((node) => node.currentTime) - beforeInspect) < 0.15,
        `${id} inspecting error does not rebuild or reset the player`);
      assert.match(await detail.innerText(), new RegExp(failed.actual.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    if (id === 'TC-006') {
      assert.equal(await detail.locator('[data-step-seek="CASE_STEP_3"]').isDisabled(), true);
      assert.match(await detail.locator('[data-step-id="CASE_STEP_3"]').innerText(), /未执行/);
    }
    await detail.screenshot({ path: path.join(evidence, `${id}-${run.run_id}-detail.png`) });
    const screenshotLink = detail.getByRole('link', { name: '查看本次截图' });
    const screenshotUrl = await screenshotLink.getAttribute('href');
    const image = await page.evaluate(async (url) => {
      const node = new Image(); node.src = url; await node.decode();
      return { width: node.naturalWidth, height: node.naturalHeight };
    }, screenshotUrl);
    assert.ok(image.width > 200 && image.height > 100, `${id} screenshot decodes`);
    const trace = detail.getByRole('link', { name: '下载本次 Trace' });
    const downloadPromise = page.waitForEvent('download'); await trace.click();
    const download = await downloadPromise;
    const tracePath = await download.path(); const traceBytes = await fs.readFile(tracePath);
    assert.ok(traceBytes.readUInt32LE(0) === 0x04034b50 && traceBytes.includes(Buffer.from('test.trace')), `${id} trace ZIP contains test stream`);
    const registeredTrace = run.files.find((file) => file.kind.endsWith('_trace'));
    assert.equal(createHash('sha256').update(traceBytes).digest('hex').toUpperCase(), registeredTrace.sha256);
    const testTrace = trialTimelineInternals.zipEntry(traceBytes, 'test.trace');
    assert.match(testTrace, /CASE_STEP_1/);
    if (run.failure_step) assert.match(testTrace, new RegExp(run.failure_step));
    const captionUrl = await detail.getByRole('link', { name: '下载带字幕视频' }).getAttribute('href');
    const independent = await context.newPage();
    await independent.goto(base);
    await independent.setContent(`<video controls muted src="${new URL(captionUrl, base).href}"></video>`);
    const externalVideo = independent.locator('video');
    await externalVideo.evaluate((node) => new Promise((resolve, reject) => {
      if (node.readyState >= 1) return resolve();
      node.addEventListener('loadedmetadata', resolve, { once: true });
      node.addEventListener('error', () => reject(new Error('INDEPENDENT_VIDEO_DECODE_FAILED')), { once: true });
    }));
    await externalVideo.evaluate(async (node) => { await node.play(); });
    await independent.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1);
    if (index === 0) {
      await externalVideo.click();
      await externalVideo.evaluate(async (node) => { await node.requestFullscreen(); });
      assert.equal(await independent.evaluate(() => document.fullscreenElement?.tagName), 'VIDEO');
      await independent.screenshot({ path: path.join(evidence, 'TC-001-fullscreen-caption.png') });
      await independent.evaluate(async () => { await document.exitFullscreen(); });
    }
    if (index >= 3) {
      const failed = run.caption_timeline.steps.find((step) => step.execution_status === 'FAILED');
      const segment = run.caption_timeline.presentation.segments.find((item) => item.step_id === failed.step_id);
      await externalVideo.evaluate((node, seconds) => new Promise((resolve, reject) => {
        node.pause();
        const timeout = setTimeout(() => reject(new Error('INDEPENDENT_SEEK_TIMEOUT')), 5000);
        node.addEventListener('seeked', () => { clearTimeout(timeout); resolve(); }, { once: true });
        node.currentTime = seconds;
      }), segment.result_start_seconds + 0.35);
      await independent.waitForTimeout(250);
      await externalVideo.screenshot({ path: path.join(evidence, `${id}-${run.run_id}-standalone-caption.png`) });
    }
    await independent.close();
    summary.push({ case_id: id, run_id: run.run_id, status: run.status, duration_seconds: duration,
      screenshot: image, trace_bytes: traceBytes.length, caption: 'played in workbench and independent page' });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=${selected[5].run_id}`);
  await page.locator('.execution-detail').screenshot({ path: path.join(evidence, 'TC-006-1920-detail.png') });
  const previous = selected[5].run_id;
  const next = selected[0].run_id;
  await page.locator(`a[href$="run_id=${next}"]`).first().click();
  await page.locator(`.execution-detail[data-run-id="${next}"]`).waitFor();
  assert.equal(await page.locator('.execution-detail').count(), 1);
  assert.doesNotMatch(await page.locator('.execution-detail').innerText(), new RegExp(previous));
  const fixturePage = await context.newPage();
  await fixturePage.route(`**/api/case-library/projects/${projectId}/execution-records`, async (route) => {
    const variant = fixturePage.url().split('fixture=')[1]?.split('&')[0];
    const item = structuredClone(selected[0]);
    item.run_id = `run-fixture-${variant}`;
    if (variant === 'no-media' || variant === 'interrupted') item.files = [];
    if (variant === 'no-timeline' || variant === 'interrupted') item.caption_timeline = null;
    if (variant === 'interrupted') { item.status = 'INTERRUPTED'; item.complete_pass = false; }
    await route.fulfill({ json: { records: [item] } });
  });
  for (const [variant, expected] of [['no-media', '本次运行没有可用录像'],
    ['no-timeline', '时间零点尚未验证'], ['interrupted', '中断']]) {
    await fixturePage.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=run-fixture-${variant}&fixture=${variant}`);
    await fixturePage.locator(`.execution-detail[data-run-id="run-fixture-${variant}"]`).waitFor();
    assert.match(await fixturePage.locator('.execution-detail').innerText(), new RegExp(expected));
    assert.equal(await fixturePage.locator('[data-step-seek]:not([disabled])').count(), 0);
  }
  await fixturePage.route('**/api/build/tasks/**/media/**', (route) => route.abort());
  await fixturePage.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=run-fixture-load-error&fixture=load-error`);
  await fixturePage.locator('.execution-detail[data-run-id="run-fixture-load-error"]').waitFor();
  await fixturePage.getByText('录像加载失败，请核对本次运行媒体；业务结果未改变。').waitFor();
  await fixturePage.close();
  await fs.writeFile(path.join(evidence, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ checked: summary.length, runs: summary.map((item) => item.run_id), evidence }));
} finally { await browser.close(); }
