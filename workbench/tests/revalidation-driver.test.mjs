import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { waitForTerminal } from './support/revalidation-driver.mjs';

async function legacyWaitForTerminal(page, _taskId, timeout = 2_000) {
  const terminals = ['WAITING_HUMAN_REVIEW', 'CANDIDATE_VALIDATION_FAILED', 'FAILED', 'CANCELLED', 'INTERRUPTED'];
  await page.waitForFunction((states) => {
    const cards = [...document.querySelectorAll('#build-history button strong')].map((node) => node.textContent || '');
    return cards.some((value) => states.some((state) => value.includes(state)));
  }, terminals, { timeout });
}

async function assertTaskScopedWait(browser, waitForTerminalImpl) {
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <section id="build-history">
        <button data-task-id="build-old-interrupted"><strong>旧任务 · INTERRUPTED</strong></button>
        <button data-task-id="build-new-running"><strong>新任务 · GENERATING</strong></button>
      </section>
    `);
    const waiting = waitForTerminalImpl(page, 'build-new-running', 2_000);
    const stateBeforeNewTerminal = await Promise.race([
      waiting.then(() => 'settled'),
      page.waitForTimeout(100).then(() => 'pending'),
    ]);
    assert.equal(stateBeforeNewTerminal, 'pending', 'old terminal history must not settle the new task wait');

    await page.locator('button[data-task-id="build-new-running"] strong').evaluate((node) => {
      node.textContent = '新任务 · CANDIDATE_VALIDATION_FAILED';
    });
    await waiting;
    assert.equal(
      await page.locator('button[data-task-id="build-new-running"] strong').textContent(),
      '新任务 · CANDIDATE_VALIDATION_FAILED',
    );
  } finally {
    await page.close();
  }
}

test('复验驱动只等待本次task终态，不被旧历史终态提前满足', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await assertTaskScopedWait(browser, waitForTerminal);
  } finally {
    await browser.close();
  }
});

test('原扫描任意历史卡片逻辑无法通过同一task终态等待断言', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await assert.rejects(
      () => assertTaskScopedWait(browser, legacyWaitForTerminal),
      (error) => error?.name === 'AssertionError' && /old terminal history/.test(error.message),
    );
  } finally {
    await browser.close();
  }
});
