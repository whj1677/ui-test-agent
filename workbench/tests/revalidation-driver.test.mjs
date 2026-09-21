import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { waitForTerminal } from './support/revalidation-driver.mjs';

test('复验驱动只等待本次task终态，不被旧历史终态提前满足', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <section id="build-history">
        <button data-task-id="build-old-interrupted"><strong>旧任务 · INTERRUPTED</strong></button>
        <button data-task-id="build-new-running"><strong>新任务 · GENERATING</strong></button>
      </section>
    `);
    const started = Date.now();
    const waiting = waitForTerminal(page, 'build-new-running', 2_000);
    await page.waitForTimeout(250);
    await page.locator('button[data-task-id="build-new-running"] strong').evaluate((node) => {
      node.textContent = '新任务 · CANDIDATE_VALIDATION_FAILED';
    });
    await waiting;
    assert.ok(Date.now() - started >= 200, 'old terminal history must not satisfy the new task wait');
  } finally {
    await browser.close();
  }
});
