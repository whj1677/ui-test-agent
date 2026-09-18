import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  dir = path.join(ROOT, 'validation', 'console-' + Date.now());
await fs.mkdir(dir, { recursive: true });
const app = await start({
  port: 0,
  dataDir: path.join(dir, 'data'),
  headless: true,
  provider: new DeepSeek({ key: '' }),
});
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1536, height: 1050 }, acceptDownloads: true });
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));
const post = (url, body) =>
  fetch(app.url + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': app.csrf },
    body: JSON.stringify(body),
  });
try {
  await page.goto(app.url);
  await page.getByRole('heading', { name: /让每一条用例/ }).waitFor();
  await page.screenshot({ path: path.join(dir, '01-home.png'), fullPage: true });
  const csrf = await fetch(app.url + '/api/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(csrf.status, 403);
  const foreign = await fetch(app.url + '/api/demo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': app.csrf,
      Origin: 'http://untrusted.example',
    },
    body: '{}',
  });
  assert.equal(foreign.status, 403);
  const host = await new Promise((resolve, reject) => {
    http
      .get(app.url + '/api/config', { headers: { Host: 'untrusted.example' } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      })
      .on('error', reject);
  });
  assert.equal(host, 403);
  const arbitrary = await fetch(app.url + '/src/server.mjs');
  assert.equal(arbitrary.status, 404);
  await page.getByRole('button', { name: '体验商品与任务演示 →' }).click();
  await page.getByRole('heading', { name: '跨业务演示 · 商品 + 任务' }).waitFor();
  const tasks = await app.store.list(),
    id = tasks[0].id;
  await page.locator('#preparation-tools > summary').click();
  await page.getByRole('button', { name: '打开浏览器', exact: true }).click();
  await page.getByText('浏览器已打开', { exact: true }).waitFor();
  await app.browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  await page.getByRole('button', { name: '确认登录状态', exact: true }).click();
  await page.getByRole('heading', { name: '确认当前页面并继续', exact: true }).waitFor();
  await page.locator('#login-marker').selectOption({ label: '演示用户 · strong' });
  await page.locator('#confirm-login-evidence').click();
  await page.getByText('登录可复用', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: '选择全部用例' }).check();
  await page.locator('#approve-main').click();
  await page.getByRole('heading', { name: '核对执行计划 · 2 条' }).waitFor();
  await page.screenshot({ path: path.join(dir, '02-plan-review.png'), fullPage: true });
  await page.getByRole('button', { name: '以上操作、断言和清理已核对' }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('td .badge.work').length === 2 &&
      [...document.querySelectorAll('td .badge')].every((e) => e.textContent === '可执行'),
  );
  await page.getByRole('button', { name: '执行所选', exact: true }).click();
  // The API is checked as well as the displayed state; frontend text alone is not execution evidence.
  for (let i = 0; i < 180; i++) {
    const s = await app.store.read(id);
    if (s.events.some((e) => e.type === 'JOB_FINISHED' && e.kind === 'run')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const s = await app.store.read(id);
  assert.deepEqual(
    s.cases.map((c) => c.status),
    ['PASS_ASSERTIONS', 'PASS_ASSERTIONS'],
  );
  assert.equal(app.demo.tasks.size, 0);
  assert.equal(app.demo.logins, 1);
  for (const name of [
    'ACTION_STARTED',
    'ACTION_EXECUTED',
    'ASSERTION_OBSERVED',
    'CLEANUP_FINISHED',
    'CASE_RESULT',
  ])
    assert.ok(
      s.events.some((e) => e.type === name),
      name,
    );
  const writeFact = await app.store.facts(id, s.cases[1].attempts[0]);
  assert.deepEqual(writeFact.executed_plan, s.cases[1].plan);
  assert.equal(writeFact.cleanup_actions[0].status, 'EXECUTED');
  assert.ok(writeFact.preconditions.some((p) => p.stage === 'BEFORE_ACTIONS' && p.passed));
  await page.waitForFunction(() => document.querySelectorAll('td .badge.good').length === 2);
  await page.screenshot({ path: path.join(dir, '03-results.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载离线报告 ↗' }).click();
  const download = await downloadPromise;
  const reportPath = path.join(dir, 'ui-test-report.html');
  await download.saveAs(reportPath);
  const html = await fs.readFile(reportPath, 'utf8');
  assert.ok(html.includes('data:video/webm;base64,'));
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(html.includes('CATALOG-001') && html.includes('TASK-001'));
  assert.ok(html.includes('不代表真实 DeepSeek'));
  const offline = await browser.newPage();
  await offline.goto('file:///' + reportPath.replaceAll('\\', '/'));
  await offline.getByRole('heading', { name: '跨业务演示 · 商品 + 任务', exact: true }).waitFor();
  await offline.locator('#query').fill('TASK-001');
  assert.equal(await offline.locator('article:visible').count(), 1);
  await offline.screenshot({ path: path.join(dir, '04-offline-report.png'), fullPage: true });
  await offline.close();
  await page.getByRole('button', { name: '按名称查询商品', exact: true }).click();
  await page.getByRole('button', { name: '查看全部执行证据' }).click();
  await page.locator('video').waitFor();
  assert.ok(await page.locator('img').count());
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const replay = await post(`/api/tasks/${id}/job`, { kind: 'run', case_ids: ['CATALOG-001'] });
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'CASE_ALREADY_EXECUTED');
  assert.deepEqual(jsErrors, []);
  await fs.writeFile(
    path.join(dir, 'summary.json'),
    JSON.stringify(
      {
        scope: 'Real local console and Chromium synthetic E2E; no DeepSeek request',
        task_id: id,
        statuses: s.cases.map((c) => ({ case_id: c.case_id, status: c.status })),
        login_count: app.demo.logins,
        cleanup_remaining: app.demo.tasks.size,
        csrf_rejected: true,
        foreign_origin_rejected: true,
        host_rejected: true,
        arbitrary_files_unavailable: true,
        offline_media_embedded: true,
        page_errors: jsErrors,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    JSON.stringify({ validated: true, directory: dir, report: reportPath }) + '\n',
  );
} finally {
  await browser.close();
  await app.close();
}
