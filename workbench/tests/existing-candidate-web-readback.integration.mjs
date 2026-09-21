import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const taskId = 'build-20260921060716-ae44c3f2';
const candidateSha = '119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A';
const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const paths = createPaths({ localRoot });
const screenshot = path.join(localRoot, 'candidate-revalidations', 'candidate-runtime-fix-20260921', 'web-readback.png');
const store = new WorkbenchStore(paths.dataRoot); await store.init();
const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID });
await buildStore.init();
const runManager = { active: null };
const buildManager = new BuildTaskManager({
  store: buildStore,
  paths,
  authorizationId: M2C_WAIT_FIX_VALIDATION_AUTHORIZATION_ID,
  otherActive: () => false,
});
const server = createWorkbenchServer({ store, manager: runManager, buildStore, buildManager });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });

let browser;
try {
  const task = await buildStore.getTask(taskId);
  assert.equal(task.task_status, 'CANDIDATE_VALIDATION_FAILED');
  assert.equal(task.candidates[0].sha256, candidateSha);
  assert.equal(task.candidates[0].normal.test_status, 'NOT_RUN');
  assert.equal(task.candidates[0].negative.test_status, 'NOT_RUN');
  assert.equal((await buildStore.getRevalidationAuthorization()).used_starts, 1);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 }, locale: 'zh-CN' });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const card = page.getByTestId('build-history').locator(`button[data-task-id="${taskId}"]`);
  await card.waitFor();
  await card.click();
  const detail = page.getByTestId('build-detail');
  await assert.doesNotReject(() => detail.waitFor());
  const text = await detail.textContent();
  assert.match(text, new RegExp(taskId));
  assert.match(text, /CANDIDATE_VALIDATION_FAILED/);
  assert.match(text, /119AC2FE622ECE98/);
  assert.match(text, /正常 NOT_RUN/);
  assert.match(text, /反例 NOT_RUN/);
  assert.doesNotMatch(text, /candidate-runtime-fix-20260921/);
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({
    task_id: taskId,
    candidate_sha256: candidateSha,
    original_status_visible: true,
    offline_revalidation_visible: false,
    media_playback_available: false,
    screenshot,
  }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
