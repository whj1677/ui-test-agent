import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildRevalidationStore } from '../server/build/revalidations.mjs';
import { BuildTaskStore, M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const taskId = 'build-20260921060716-ae44c3f2';
const validationId = 'candidate-runtime-fix-20260921';
const candidateSha = '119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A';
const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const evidence = path.resolve(process.env.M2C_MEDIA_WEB_EVIDENCE || path.join(process.cwd(), 'docs', 'evidence', 'm2c-existing-revalidation-media.png'));
const paths = createPaths({ localRoot });
const store = new WorkbenchStore(paths.dataRoot); await store.init();
const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID }); await buildStore.init();
const revalidations = new BuildRevalidationStore(paths.buildRevalidationsRoot, buildStore); await revalidations.init();

function serverInstance() {
  const buildManager = new BuildTaskManager({
    store: buildStore, paths, authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID, otherActive: () => false,
  });
  return createWorkbenchServer({ store, manager: { active: null }, buildStore, buildManager, buildRevalidationStore: revalidations });
}

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) { await new Promise((resolve) => server.close(resolve)); }
function hash(buffer) { return createHash('sha256').update(buffer).digest('hex').toUpperCase(); }

async function verifyFullImage(page, image) {
  const popupPromise = page.waitForEvent('popup');
  await image.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  assert.match(popup.url(), /\/media\/(?:normal|negative)-screenshot$/);
  await popup.close();
}

async function verifyPlayable(page, lane) {
  const video = page.getByTestId(`revalidation-${lane}-video`);
  await video.waitFor();
  await video.evaluate((element) => new Promise((resolve, reject) => {
    if (element.readyState >= 1) return resolve();
    element.addEventListener('loadedmetadata', resolve, { once: true });
    element.addEventListener('error', () => reject(new Error('VIDEO_METADATA_ERROR')), { once: true });
  }));
  const duration = await video.evaluate((element) => element.duration);
  assert.equal(Number.isFinite(duration) && duration > 0, true);
  await video.evaluate(async (element) => { element.muted = true; await element.play(); });
  await page.waitForFunction((selector) => document.querySelector(selector)?.currentTime > 0.03, `[data-testid="revalidation-${lane}-video"]`);
  await video.evaluate((element) => element.pause());
  assert.equal(await video.evaluate((element) => element.paused), true);
  const target = Math.min(Math.max(duration / 2, 0.04), Math.max(duration - 0.02, 0.04));
  await video.evaluate((element, value) => { element.currentTime = value; }, target);
  await page.waitForFunction(({ selector, value }) => Math.abs(document.querySelector(selector)?.currentTime - value) < 0.08,
    { selector: `[data-testid="revalidation-${lane}-video"]`, value: target });
  return { duration, target };
}

let server = serverInstance();
let baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 }, locale: 'zh-CN' });
try {
  await page.goto(baseUrl);
  const historyCard = page.getByTestId('build-history').locator(`button[data-task-id="${taskId}"]`);
  await historyCard.waitFor(); await historyCard.click();
  const detail = page.getByTestId('build-detail');
  const text = await detail.innerText();
  assert.match(text, /原始验证 FAILED/);
  assert.match(text, /正常 NOT_RUN/);
  assert.match(text, /反例 NOT_RUN/);
  assert.match(text, /查看原始加载错误/);
  await page.getByText('查看原始加载错误', { exact: true }).click();
  const originalErrorText = await detail.innerText();
  assert.match(originalErrorText, /Requiring @playwright\/test second time/);
  assert.doesNotMatch(originalErrorText, /[A-Z]:\\/);
  assert.match(text, new RegExp(validationId));
  assert.match(text, /已有技术复验通过，尚未批准/);
  assert.match(text, /正常：1 条 PASSED/);

  const normalImage = page.getByTestId('revalidation-normal-screenshot');
  await normalImage.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="revalidation-normal-screenshot"]')?.naturalWidth > 0);
  assert.equal(await normalImage.locator('xpath=..').getAttribute('target'), '_blank');
  const normalImageUrl = await normalImage.getAttribute('src');
  assert.equal(hash(Buffer.from(await (await fetch(new URL(normalImageUrl, baseUrl))).arrayBuffer())), 'D51FF84550D52BAA830CA49B75636C92699E84FB1C3441B42A11FA539BAF515D');
  await verifyFullImage(page, normalImage);
  const normalVideo = await verifyPlayable(page, 'normal');
  await page.getByTestId('revalidation-normal-video').evaluate((element) => { element.dataset.pollMarker = 'preserve'; });
  await page.waitForTimeout(2300);
  assert.equal(await page.getByTestId('revalidation-normal-video').getAttribute('data-poll-marker'), 'preserve');
  assert.equal(await page.getByTestId('revalidation-normal-video').evaluate((element) => element.paused), true);
  assert.ok(Math.abs(await page.getByTestId('revalidation-normal-video').evaluate((element) => element.currentTime) - normalVideo.target) < 0.08);

  const normalTraceUrl = await page.getByTestId('revalidation-normal-trace').getAttribute('href');
  const normalTrace = Buffer.from(await (await fetch(new URL(normalTraceUrl, baseUrl))).arrayBuffer());
  assert.equal(hash(normalTrace), '54005E7C29A54BD175E2A9C8DB4503F3F9B59BED364ECE5C48A721169CAA17DB');

  await page.locator('#build-revalidations button[data-lane="negative"]').click();
  const negativeText = await page.getByTestId('build-revalidations').innerText();
  assert.match(negativeText, /反例：1 条 FAILED/);
  assert.match(negativeText, /期望：PROBE-42 · 实际：PROBE-41/);
  assert.match(negativeText, /指定错误已检出/);
  const negativeImage = page.getByTestId('revalidation-negative-screenshot');
  await negativeImage.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="revalidation-negative-screenshot"]')?.naturalWidth > 0);
  assert.equal(await negativeImage.locator('xpath=..').getAttribute('target'), '_blank');
  const negativeImageUrl = await negativeImage.getAttribute('src');
  assert.equal(hash(Buffer.from(await (await fetch(new URL(negativeImageUrl, baseUrl))).arrayBuffer())), '07A22F28B86A744ADC223B1D1D47C4740DFFDA7F8C52CD72AC3DCF7DE9268231');
  await verifyFullImage(page, negativeImage);
  const negativeVideo = await verifyPlayable(page, 'negative');
  const negativeTraceUrl = await page.getByTestId('revalidation-negative-trace').getAttribute('href');
  const negativeTrace = Buffer.from(await (await fetch(new URL(negativeTraceUrl, baseUrl))).arrayBuffer());
  assert.equal(hash(negativeTrace), '4BDE7E8AFD3E210BDB04FB421C618C075767A894E4A45DF706DC8510EC67DE91');
  assert.match(await negativeImage.getAttribute('src'), /negative-screenshot$/);
  assert.match(await page.getByTestId('revalidation-negative-video').getAttribute('src'), /negative-video$/);
  assert.doesNotMatch(await page.getByTestId('revalidation-negative-video').getAttribute('src'), /normal-video$/);

  await fs.mkdir(path.dirname(evidence), { recursive: true });
  await page.screenshot({ path: evidence, fullPage: true });

  await close(server);
  server = serverInstance(); baseUrl = await listen(server);
  await page.goto(baseUrl);
  const restartedCard = page.getByTestId('build-history').locator(`button[data-task-id="${taskId}"]`);
  await restartedCard.waitFor(); await restartedCard.click();
  assert.match(await page.getByTestId('build-revalidations').innerText(), new RegExp(validationId));
  assert.match(await page.getByTestId('build-revalidations').innerText(), /正常：1 条 PASSED/);

  console.log(JSON.stringify({
    task_id: taskId, validation_id: validationId, candidate_sha256: candidateSha,
    original_not_run_preserved: true, normal: '1 PASSED', negative: '1 FAILED PROBE-42/PROBE-41',
    screenshots_loaded: 2, videos_play_pause_seek_verified: 2,
    normal_video_duration: normalVideo.duration, negative_video_duration: negativeVideo.duration,
    traces_sha256_verified: 2, polling_preserved_video_state: true, restart_readback: true, evidence,
  }));
} finally {
  await browser.close();
  if (server.listening) await close(server);
}
