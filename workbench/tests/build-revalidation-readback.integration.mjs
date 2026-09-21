import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M2C_REVALIDATION_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { createPaths } from '../server/paths.mjs';
import { WorkbenchStore } from '../server/store.mjs';

const taskId = process.argv[2];
if (!/^build-[a-z0-9-]{8,80}$/.test(taskId || '')) throw new Error('M2C_REVALIDATION_TASK_ID_REQUIRED');

const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const paths = createPaths({ localRoot });
const screenshot = path.join(paths.workbenchRoot, 'docs', 'evidence', 'm2c-revalidation-cancelled.png');
const store = new WorkbenchStore(paths.dataRoot); await store.init();
const buildStore = new BuildTaskStore(paths.buildTasksRoot); await buildStore.init();
await buildStore.recoverInterrupted();
const manager = { active: null };
const buildManager = new BuildTaskManager({
  store: buildStore,
  paths,
  authorizationId: M2C_REVALIDATION_AUTHORIZATION_ID,
  otherActive: () => false,
});
const server = createWorkbenchServer({ store, manager, buildStore, buildManager });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });

let browser;
try {
  const task = await buildStore.getTask(taskId);
  const authorization = await buildStore.getRevalidationAuthorization();
  assert.equal(task.task_status, 'CANCELLED');
  assert.equal(task.generation_status, 'CANCELLED');
  assert.equal(task.verification_status, 'NOT_RUN');
  assert.equal(task.candidates.length, 0);
  assert.equal(task.attempts.length, 1);
  assert.equal(authorization.used_starts, 1);
  assert.equal(authorization.max_starts, 1);
  assert.equal((await buildStore.getBudget()).used_starts, 1);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1500 }, locale: 'zh-CN' });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const card = page.getByTestId('build-history').locator(`button[data-task-id="${taskId}"]`);
  await card.waitFor();
  await card.click();
  await page.waitForFunction((expectedTaskId) => {
    const detail = document.querySelector('[data-testid="build-detail"]');
    return detail?.textContent?.includes(expectedTaskId) && detail.textContent.includes('CANCELLED');
  }, taskId);
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ task_id: taskId, status: task.task_status, screenshot }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
