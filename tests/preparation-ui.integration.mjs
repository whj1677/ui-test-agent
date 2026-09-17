import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { caseHash } from '../src/plans.mjs';
import { preparationTimeBudget } from '../src/job-budget.mjs';

// Real console and version-confirmation API. Scheduler states/advice below are
// synthetic UI fixtures, not evidence about the model's recommendation quality.
const directory = path.resolve('validation', 'preparation-ui-' + Date.now());
let modelCalls = 0;
const app = await start({
  port: 0,
  dataDir: path.join(directory, 'data'),
  headless: true,
  provider: new DeepSeek({
    key: 'synthetic-local-only',
    fetchImpl: async () => {
      modelCalls++;
      throw new Error('Unexpected model request');
    },
  }),
});
const cases = ['UI-P1', 'UI-P2'].map((case_id) => ({
  case_id,
  title: '确认查询结果 ' + case_id,
  source_side: 'ui',
  preconditions: '已登录。',
  steps: [
    {
      step_id: 'S1',
      action: '查看设备查询结果。',
      expected: '显示目标设备。',
      obligations: [{ id: 'S1-O1', text: '显示目标设备' }],
    },
  ],
}));
const id = await app.store.create({
  name: '准备调度与修订 · 界面验收',
  target: 'http://127.0.0.1:4188/',
  baseline: { schema_version: 'preparation-ui/v1', case_count: 2, cases },
});
await app.controller.configure(id, { nonproduction: true, writes: false, readOnlyEndpoints: [] });
for (const c of cases)
  await app.controller.confirmCase(id, c.case_id, { steps: c.steps, note: '合成初版' });
const baselineBefore = await fs.readFile(path.join(app.store.dir(id), 'baseline.json'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: 'reduce',
});
const errors = [],
  jobs = [];
let live = null;
page.on('pageerror', (error) => errors.push(error.message));
const waitText = (selector, text) =>
  page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent.includes(text),
    { selector, text },
    { timeout: 10000 },
  );
const refresh = () => page.locator('#output-refresh').click();
const capture = async (name) => {
  await page.screenshot({ path: path.join(directory, name + '.png'), fullPage: true });
};
try {
  await page.route(`**/api/tasks/${id}`, async (route) => {
    const response = await route.fetch(),
      state = await response.json();
    state.active = live;
    state.authenticated = true;
    await route.fulfill({ json: state });
  });
  await page.route(`**/api/tasks/${id}/job`, async (route) => {
    jobs.push(route.request().postDataJSON());
    await route.fulfill({ json: { started: true } });
  });
  await page.goto(app.url + '/#task=' + id);
  await page.locator('#preparation-settings').click();
  await page.locator('#prep-concurrency').selectOption('2');
  await page.locator('#save-preparation-settings').click();
  await waitText('#prep-error', '只读');
  assert.equal(jobs.length, 0);
  await page.locator('#prep-independent').check();
  await page.locator('#prep-time').selectOption('2');
  await page.locator('#save-preparation-settings').click();
  await waitText('.preparation-policy', '两路');
  await page.locator('#workflow-select-all').click();
  const posted = page.waitForResponse(
    (response) => response.url().endsWith('/job') && response.request().method() === 'POST',
  );
  await page.locator('#prepare').click();
  await posted;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].kind, 'prepare');
  assert.deepEqual(jobs[0].options, {
    concurrency: 2,
    independent_readonly: true,
    time_multiplier: 2,
  });
  assert.ok((await app.store.read(id)).cases.every((r) => !r.attempts.length));

  live = {
    kind: 'prepare',
    stage: 'PREPARING',
    calls: 4,
    workers: [
      { case_id: 'UI-P1', phase: 'discovery', remaining_ms: 120000, calls: 2 },
      { case_id: 'UI-P2', phase: 'planning', remaining_ms: 60000, calls: 2 },
    ],
  };
  await app.store.update(id, (s) => {
    s.preparation = {
      status: 'RUNNING',
      case_ids: cases.map((c) => c.case_id),
      options: jobs[0].options,
      time_budget: preparationTimeBudget(cases, jobs[0].options),
      workers: Object.fromEntries(
        cases.map((c) => [c.case_id, { case_id: c.case_id, status: 'RUNNING', discovery: {} }]),
      ),
    };
  });
  await refresh();
  await waitText('.preparation-progress', '2 条正在准备');
  await waitText('.preparation-progress', '页面取证');
  await waitText('.preparation-progress', '计划生成 / 审查 / 修复');
  assert.equal(await page.locator('#preparation-settings').isDisabled(), true);
  // A countdown/call update must not close an expanded budget or detach the
  // reader's focused disclosure. This uses normal polling, not a refresh click.
  await page.locator('.preparation-progress details summary').click();
  const reading = await page.evaluate(() => ({
    y: scrollY,
    top: document.querySelector('.preparation-progress details summary').getBoundingClientRect()
      .top,
  }));
  live.workers[0].remaining_ms = 59000;
  live.workers[0].calls = 3;
  await waitText('.preparation-progress', '模型 3 次');
  const updated = await page.evaluate(() => ({
    y: scrollY,
    top: document.querySelector('.preparation-progress details summary').getBoundingClientRect()
      .top,
    open: document.querySelector('.preparation-progress details').open,
    focused:
      document.activeElement === document.querySelector('.preparation-progress details summary'),
  }));
  assert.equal(updated.open, true, 'budget disclosure remains open across polls');
  assert.equal(updated.focused, true, 'budget summary retains keyboard focus');
  assert.ok(Math.abs(updated.y - reading.y) < 2);
  assert.ok(Math.abs(updated.top - reading.top) < 2);
  await page.locator('.preparation-progress details summary').click();
  await capture('01-parallel-progress-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await capture('02-parallel-progress-mobile');
  await page.setViewportSize({ width: 1440, height: 1050 });

  live = null;
  await app.store.update(id, (s) => {
    s.preparation.status = 'PARTIAL';
    for (const row of s.cases) {
      s.preparation.workers[row.case_id].status = 'PAUSED';
      row.status = 'NEEDS_REVIEW';
      row.issues = [{ code: 'AMBIGUOUS', step_id: 'S1', message: '请给出目标设备名称。' }];
      row.case_advice = {
        id: 'advice-' + row.case_id,
        case_hash: caseHash(cases.find((c) => c.case_id === row.case_id)),
        category: 'INPUT_CLARIFICATION',
        status: 'PENDING',
        message: '目标身份不明确，请人工补充合成设备名称。',
        suggestions: [
          {
            step_id: 'S1',
            field: 'expected',
            before: '显示目标设备。',
            after: '显示设备【待填写名称】。',
            reason: '原文未提供目标名称。',
            source_quotes: ['显示目标设备'],
            coverage_impact: '保持设备展示验证，补充身份。',
            requires_input: true,
          },
        ],
      };
    }
  });
  await refresh();
  await waitText('tbody', '待审查确认');
  await page.locator('[data-case="UI-P2"]').click();
  const unchanged = (await app.store.read(id)).cases[1].confirmations;
  await page.locator('#reject-case-advice').click();
  await page.locator('[data-case="UI-P1"]').click();
  assert.deepEqual((await app.store.read(id)).cases[1].confirmations, unchanged);
  assert.equal((await app.store.read(id)).cases[1].case_advice.status, 'REJECTED');
  await capture('03-advice-before-human-confirmation');
  await page.locator('#load-case-advice').click();
  assert.equal((await app.store.read(id)).cases[0].confirmations[0].expected, '显示目标设备。');
  await page.locator('#confirm-one').click();
  await waitText('#toast', '勾选修订确认');
  await page.locator('#advice-confirmed').check();
  await page.locator('#resolution').fill('合成业务确认：设备名称为测试设备甲。');
  await page.locator('#confirm-one').click();
  await waitText('#toast', '填写');
  assert.equal((await app.store.read(id)).cases[0].case_version, undefined);
  await page.locator('[data-expected="0"]').fill('显示设备测试设备甲。');
  await page.locator('[data-obligations="one-0"]').fill('显示设备测试设备甲');
  await page.locator('#confirm-one').click();
  await page.locator('#confirm-one').waitFor({ state: 'hidden' });
  const final = await app.store.read(id),
    row = final.cases[0];
  assert.equal(row.case_version, 2);
  assert.equal(row.case_advice.status, 'APPLIED');
  assert.equal(row.confirmation_history.at(-1).steps[0].expected, '显示目标设备。');
  assert.equal(row.confirmations[0].expected, '显示设备测试设备甲。');
  assert.equal(row.plan, null);
  assert.equal(row.plan_approved, false);
  assert.equal(row.attempts.length, 0);
  assert.deepEqual(
    await fs.readFile(path.join(app.store.dir(id), 'baseline.json')),
    baselineBefore,
  );
  assert.equal(jobs.length, 1, 'revision confirmation does not auto-run or auto-plan');
  assert.equal(modelCalls, 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      validated: true,
      settings: jobs[0].options,
      case_version: row.case_version,
      baseline_unchanged: true,
      model_calls: 0,
      directory,
    }),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
  await app.close();
}
