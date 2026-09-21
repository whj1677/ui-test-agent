import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-build-browser-'));
const taskId = 'build-web-12345678';
let task = null;
let starts = 0;
const budget = { schema: 'workbench/build-stage-budget-v1', phase: 'M2-C', max_starts: 2, used_starts: 0, claims: [] };
const template = {
  template_id: 'synthetic-probe-v1', version: '1.0.0', title: '合成探针候选建例',
  summary: '固定的无登录合成页面交互任务。', input_sha256: 'b'.repeat(64),
  allowed_entry: { kind: 'fixture', route: '/probe' },
};
const buildStore = {
  async getBudget() { return structuredClone(budget); },
  async listTasks() { return task ? [structuredClone(task)] : []; },
  async getTask(id) { return id === taskId && task ? structuredClone(task) : null; },
};
const buildManager = {
  active: null,
  async templates() { return [template]; },
  async submit(id) {
    assert.equal(id, template.template_id);
    task = {
      task_id: taskId, task_status: 'SUBMITTED', generation_status: 'NOT_STARTED', verification_status: 'NOT_STARTED',
      human_review_status: 'NOT_READY', created_at: '2026-09-21T00:00:00.000Z', finished_at: null,
      template, budget: structuredClone(budget), candidates: [], files: [], revision_allowed: false, error: null,
    };
    return structuredClone(task);
  },
  async start(id) {
    assert.equal(id, taskId); starts += 1; budget.used_starts = 1;
    task = {
      ...task, task_status: 'WAITING_HUMAN_REVIEW', generation_status: 'COMPLETED', verification_status: 'PASSED',
      human_review_status: 'WAITING_REVIEW', finished_at: '2026-09-21T00:01:00.000Z', budget: structuredClone(budget),
      candidates: [{
        version: 1, verification_status: 'PASSED', sha256: 'c'.repeat(64), bytes: 88,
        code: 'test("safe", async () => { /* <img id="candidate-injected"> */ });',
        diff_from_previous: null, same_candidate_hash: true,
        normal: { test_status: 'PASSED', process: { exit_code: 0 } },
        negative: { test_status: 'FAILED', process: { exit_code: 1 } },
      }],
      files: [{ file_id: 'candidate-v1', kind: 'candidate', file_name: 'candidate.spec.mjs', bytes: 88, sha256: 'c'.repeat(64), web_visible: true }],
    };
    return structuredClone(task);
  },
};
const store = { async listAssets() { return []; }, async listRuns() { return []; } };
const server = createWorkbenchServer({ store, manager: { active: null }, buildStore, buildManager });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, locale: 'zh-CN' });
const consoleErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

try {
  await page.goto(baseUrl);
  await page.getByTestId('build-submit').waitFor({ state: 'visible' });
  assert.equal(await page.getByTestId('build-submit').isEnabled(), true);
  await page.getByTestId('build-submit').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="build-start"]').disabled);
  assert.equal(await page.getByTestId('build-start').isEnabled(), true);
  await page.getByTestId('build-start').click();
  await page.getByText('WAITING_REVIEW', { exact: true }).waitFor();
  assert.equal(starts, 1);
  assert.match(await page.getByTestId('build-detail').innerText(), /技术验证/);
  assert.match(await page.getByTestId('build-detail').innerText(), /PASSED/);
  assert.match(await page.getByTestId('build-detail').innerText(), /候选 v1/);
  assert.match(await page.getByTestId('build-detail').innerText(), /正常 PASSED\/0/);
  assert.match(await page.getByTestId('build-detail').innerText(), /反例 FAILED\/1/);
  assert.equal(await page.locator('#candidate-injected').count(), 0);
  assert.equal(await page.getByTestId('build-revise').isDisabled(), true);
  assert.match(await page.locator('#build-budget').innerText(), /1 \/ 2/);
  await page.waitForTimeout(1200);
  assert.equal(starts, 1);
  const screenshot = path.join(tempRoot, 'build-browser.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({ build_browser_flow: 'passed', task_id: taskId, screenshot }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(tempRoot, { recursive: true, force: true });
}
