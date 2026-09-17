import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { demoCases } from '../src/demo.mjs';

// Real console, store and confirmation API. Worker results are controlled UI
// states, not product execution evidence. Every model request is forbidden.
const directory = path.resolve('validation', 'workflow-' + Date.now());
let modelCalls = 0;
const app = await start({
  port: 0,
  dataDir: path.join(directory, 'data'),
  headless: true,
  provider: new DeepSeek({
    key: 'synthetic-local-only',
    fetchImpl: async () => {
      modelCalls++;
      throw new Error('Unexpected model request in UI test');
    },
  }),
});
const fixture = demoCases();
const baseline = {
  ...fixture.baseline,
  case_count: 8,
  cases: Array.from({ length: 8 }, (_, i) => ({
    ...structuredClone(fixture.baseline.cases[0]),
    case_id: `UI-${i + 1}`,
    title: `复杂界面用例 ${i + 1}`,
  })),
};
const id = await app.store.create({
  name: '测试流程 · 八条用例',
  target: 'http://127.0.0.1:4188/',
  baseline,
});
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: 'reduce',
});
const errors = [],
  jobs = [];
page.on('pageerror', (error) => errors.push(error.message));
let active = null,
  failConfirmation = true,
  executed = false;
const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const waitText = (selector, text) =>
  page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent.includes(text),
    { selector, text },
    { timeout: 12000 },
  );
const update = async (fn) => {
  await app.store.update(id, fn);
  await page.locator('#output-refresh').click();
};
const capture = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(directory, name + '.png'), fullPage: true });
};
try {
  await page.route(`**/api/tasks/${id}`, async (route) => {
    const response = await route.fetch(),
      s = await response.json();
    s.active = active;
    s.authenticated = true;
    if (executed)
      for (const c of s.cases)
        if (c.case_id !== 'UI-1') {
          c.attempts = [{ id: 'synthetic-ui-receipt' }];
          c.status = c.case_id === 'UI-2' ? 'FAIL_ASSERTION' : 'PASS_ASSERTIONS';
        }
    await json(route, s);
  });
  await page.route(`**/api/tasks/${id}/confirm`, async (route) => {
    if (failConfirmation && route.request().postDataJSON().case_id === 'UI-2') {
      failConfirmation = false;
      return json(route, { error: 'CONFIRMATION_CONTENT_REQUIRED' }, 409);
    }
    await route.continue();
  });
  await page.route(`**/api/tasks/${id}/job`, async (route) => {
    const body = route.request().postDataJSON(),
      s = await app.store.read(id);
    assert.ok(body.case_ids.every((cid) => s.cases.find((c) => c.case_id === cid).reviewed));
    jobs.push(body);
    active = {
      kind: body.kind,
      stage: body.kind === 'prepare' ? 'WAITING_USER_LOGIN' : body.kind,
      calls: 0,
    };
    await app.store.update(id, (state) =>
      app.store.event(state, 'JOB_STARTED', { kind: body.kind }),
    );
    await json(route, { started: true });
  });
  await page.route(`**/api/tasks/${id}/approve`, async (route) => {
    const body = route.request().postDataJSON();
    await app.store.update(id, (s) => {
      const c = s.cases.find((c) => c.case_id === body.case_id);
      c.plan_approved = true;
      c.status = 'READY';
    });
    await json(route, { ok: true });
  });
  await page.goto(app.url + '/#task=' + id);
  await waitText('#workflow-detail', '勾选');
  assert.equal(await page.locator('#confirm-main').isDisabled(), true);
  await page.locator('#workflow-select-all').click();
  await waitText('#workflow-detail', '还有 8 条');
  assert.equal(await page.locator('#guided-workflow .primary').count(), 1);
  assert.equal(
    await page.locator('#guided-workflow [aria-current=step] strong').textContent(),
    '核对用例',
  );
  assert.equal(await page.locator('#run').isDisabled(), true);
  assert.equal(await page.locator('#plan').isDisabled(), true);
  await capture('01-confirm-first');
  await page.locator('#confirm-main').click();
  await page.locator('.modal-close').click();
  assert.equal(jobs.length, 0);
  assert.ok((await app.store.read(id)).cases.every((c) => !c.reviewed));
  await page.locator('#confirm-main').click();
  await page.locator('#confirm-all').click();
  await waitText('#confirm-all', '重新保存');
  assert.equal(jobs.length, 0, 'partial confirmation failure must not start a job');
  assert.equal((await app.store.read(id)).cases.filter((c) => c.reviewed).length, 1);
  await page.locator('#confirm-all').click();
  await waitText('#workflow-detail', '完成登录');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].kind, 'prepare');
  assert.deepEqual(
    jobs[0].case_ids,
    baseline.cases.map((c) => c.case_id),
  );
  assert.ok((await app.store.read(id)).cases.every((c) => c.reviewed));
  assert.equal(await page.locator('#workflow-running').isDisabled(), true);
  await capture('02-waiting-login');

  active = null;
  await update((s) => {
    for (const c of s.cases) c.discovery = { status: 'CAPTURED', job_id: 'observed-current' };
    s.snapshots = s.cases.map((c) => ({
      discovery_case_id: c.case_id,
      discovery_job_id: 'observed-current',
      controls: [],
    }));
    s.status = 'IDLE';
    for (const c of s.cases) app.store.event(s, 'DISCOVERY_CASE_FINISHED', { case_id: c.case_id });
    app.store.event(s, 'JOB_FINISHED', { kind: 'prepare' });
  });
  await waitText('#prepare', '继续生成计划');
  await waitText('#workflow-summary', '已生成计划 0 / 8');
  await waitText('#output-state', '计划尚未生成');
  await page.locator('#prepare').click();
  await waitText('#workflow-running', '等待');
  assert.equal(
    jobs[1].kind,
    'prepare',
    'the server validates checkpoint reuse instead of trusting the UI snapshot',
  );
  active = null;
  await update((s) => {
    s.cases[0].status = 'BLOCKED_MAPPING';
    s.cases[0].mapping_reason = '页面缺少可核验的维保记录表格';
    for (const c of s.cases.slice(1)) {
      c.plan = { ...structuredClone(fixture.plans[0]), case_id: c.case_id };
      c.status = 'PLAN_REVIEW';
    }
  });
  await waitText('#workflow-detail', 'UI-1');
  await waitText('#workflow-summary', '已生成计划 7 / 8');
  await capture('03-partial-plans');
  await page.locator('#workflow-select-plans').click();
  await waitText('#workflow-detail', '清理内容');
  assert.equal(
    await page.locator('#guided-workflow [aria-current=step] strong').textContent(),
    '核对计划',
  );
  await page.locator('#approve-main').click();
  await page.locator('#approve-all').click();
  await waitText('#run-main', '执行所选');
  assert.equal(jobs.length, 2, 'approving plans never automatically executes');
  await page.locator('#run-main').click();
  await waitText('#workflow-running', '等待');
  assert.deepEqual(
    jobs[2].case_ids,
    baseline.cases.slice(1).map((c) => c.case_id),
  );
  active = null;
  executed = true;
  await update((s) => app.store.event(s, 'JOB_FINISHED', { kind: 'run' }));
  await waitText('#workflow-detail', '执行结束不代表断言全部满足');
  assert.equal(await page.locator('#workflow-report').isEnabled(), true);
  await capture('04-executed-with-difference');

  // Old-style discovery-only state must explain why zero plans exist.
  executed = false;
  await update((s) => {
    app.store.event(s, 'JOB_STARTED', { kind: 'discover' });
    for (const c of s.cases) {
      c.reviewed = false;
      c.plan = null;
      c.plan_approved = false;
      c.status = 'NEEDS_REVIEW';
      app.store.event(s, 'DISCOVERY_CASE_FINISHED', { case_id: c.case_id, planning: false });
    }
    app.store.event(s, 'JOB_FINISHED', { kind: 'discover' });
  });
  await page.locator('#select-all').check();
  await waitText('#output-state', '等待核对用例后生成计划');
  await page.locator('[data-select="UI-1"]').uncheck();
  await waitText('.workflow-selection', '已选 7 / 8');
  assert.equal(await page.locator('#select-all').evaluate((el) => el.indeterminate), true);
  await update((s) => {
    s.cases[1].issues = [{ code: 'AMBIGUOUS', step_id: 'S1', message: '请明确查询结果的预期名称' }];
  });
  await waitText('#workflow-detail', '请明确查询结果的预期名称');
  await page.locator('#workflow-clarify').click();
  assert.equal(await page.locator('#confirm-one').isVisible(), true);
  await page.locator('.modal-close').click();
  assert.equal(jobs.length, 3);
  await update((s) => {
    s.cases[1].issues = [];
  });
  for (const [width, height] of [
    [1440, 1100],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const box = await page.locator('#guided-workflow').boundingBox();
    assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= width + 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await capture('05-prerequisite-' + width);
  }
  assert.equal(modelCalls, 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      validated: true,
      model_calls: modelCalls,
      jobs: jobs.map((j) => j.kind),
      directory,
    }),
  );
} finally {
  await browser.close();
  await app.close();
}
