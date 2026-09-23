import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:4322';
const projectId = 'project-61579c25-2833-4c41-b592-357e1b306026';
const runIds = [
  ['TC-003', 'run-03fa813c-4c77-4eaf-858c-95c4e513ff40', 'PASSED'],
  ['TC-006', 'run-b2c74b41-1d44-40cf-ad1f-91e61a071d87', 'FAILED'],
];
const evidence = path.resolve('.local/e2e01-product-unavailable-browser');
await fs.mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
  const response = await fetch(`${base}/api/case-library/projects/${projectId}/execution-records`);
  assert.equal(response.status, 200);
  const { records } = await response.json();
  const originalCount = records.length;
  const observations = [];
  for (const [id, runId, expectedStatus] of runIds) {
    const run = records.find((item) => item.run_id === runId);
    assert.equal(run?.executed_external_id, id);
    assert.equal(run.status, expectedStatus);
    assert.equal(run.caption_timeline?.status, 'UNAVAILABLE');
    await page.goto(`${base}/workspace/#/projects/${projectId}/execution-records?run_id=${runId}`);
    const detail = page.locator(`.execution-detail[data-run-id="${runId}"]`);
    await detail.waitFor();
    assert.match(await detail.innerText(), /无法精确定位/);
    assert.equal(await detail.locator('[data-step-seek]:not([disabled])').count(), 0);
    assert.equal(await detail.getByRole('link', { name: '下载带字幕视频' }).count(), 0);
    const video = detail.getByTestId('execution-video');
    await video.evaluate(async (node) => {
      node.muted = true;
      await node.play();
      await new Promise((resolve) => setTimeout(resolve, 150));
      node.pause();
    });
    const media = await video.evaluate(async (node) => {
      const duration = node.duration;
      node.currentTime = Math.min(duration - 0.05, 0.2);
      await new Promise((resolve) => node.addEventListener('seeked', resolve, { once: true }));
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
      const context = canvas.getContext('2d'); context.drawImage(node, 0, 0, 32, 32);
      const pixel = [...context.getImageData(16, 16, 1, 1).data].slice(0, 3);
      return { duration, time: node.currentTime, width: node.videoWidth, height: node.videoHeight, pixel };
    });
    assert.ok(media.duration > 0 && media.width > 100 && media.height > 100);
    await detail.screenshot({ path: path.join(evidence, `${id}-${runId}-detail.png`) });
    const screenshot = detail.getByRole('link', { name: '查看本次截图' });
    const imageResponse = await page.request.get(new URL(await screenshot.getAttribute('href'), base).href);
    assert.equal(imageResponse.status(), 200);
    assert.equal((await imageResponse.body()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const trace = detail.getByRole('link', { name: '下载本次 Trace' });
    const traceUrl = new URL(await trace.getAttribute('href'), base).href;
    const traceBytes = await (await page.request.get(traceUrl)).body();
    const task = await (await page.request.get(`${base}/api/build/tasks/${run.source_build_task_id}`)).json();
    const traceFile = task.files.find((item) => item.file_id === run.media_file_ids.find((fileId) =>
      task.files.some((file) => file.file_id === fileId && file.kind.endsWith('_trace'))));
    assert.equal(createHash('sha256').update(traceBytes).digest('hex').toUpperCase(), traceFile.sha256);
    if (id === 'TC-006') {
      assert.deepEqual([run.failure_step, run.error?.expected, run.error?.actual], ['CASE_STEP_2', '220 kW', '320 kW']);
      assert.equal(run.complete_pass, false);
      assert.match(await detail.locator('[data-step-id="CASE_STEP_3"]').innerText(), /未执行/);
    }
    observations.push({ id, run_id: runId, media, trace_sha256: traceFile.sha256, disabled_step_seeks: 3 });
  }
  await page.reload();
  await page.locator(`.execution-detail[data-run-id="${runIds[1][1]}"]`).waitFor();
  const after = await (await fetch(`${base}/api/case-library/projects/${projectId}/execution-records`)).json();
  assert.equal(after.records.length, originalCount, 'refresh does not create a run');
  console.log(JSON.stringify({ checked: observations.length, record_count: originalCount, observations, evidence }));
} finally { await browser.close(); }
