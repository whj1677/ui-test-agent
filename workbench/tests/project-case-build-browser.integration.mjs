import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'm3b1-browser-'));
const paths = createPaths({ localRoot });
const fixture = path.join(localRoot, 'm3b1-cases.xlsx');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('项目用例');
sheet.addRow(['用例编号', '标题', '模块', '前置条件', '测试数据', '步骤', '逐步预期', '内容状态']);
sheet.addRow(['001', '项目单条建例输入', '合成探针', '本地页面可访问\n无需登录', '功率=220.5 kW\n地址=127.0.0.1', '打开页面\n点击执行按钮', '页面展示按钮\n结果显示PROBE-42', '已确认']);
sheet.addRow(['002', '另一条已确认用例', '合成探针', '无需登录', '版本=3.10.2', '打开页面', '标题可见', '已确认']);
await workbook.xlsx.writeFile(fixture);

const emptyStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const runManager = { active: null };
let harnessStarts = 0;
let sequence = 0;
let caseStore; let caseManager; let buildStore; let buildManager;

async function constructManagers() {
  caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  caseManager = new CaseLibraryManager(caseStore);
  buildStore = new BuildTaskStore(paths.buildTasksRoot); await buildStore.init();
  buildManager = new BuildTaskManager({
    store: buildStore, caseStore, paths,
    idFactory: () => `build-browser-case-${String(++sequence).padStart(8, '0')}`,
    adapter: { async runHarnessTask() { harnessStarts += 1; throw new Error('HARNESS_MUST_NOT_RUN'); } },
  });
}
function makeServer() { return createWorkbenchServer({ store: emptyStore, manager: runManager, buildStore, buildManager, caseStore, caseManager }); }
async function listen(server) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); return `http://127.0.0.1:${server.address().port}`; }
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
async function waitCaseMessage(page, text) { await page.waitForFunction((value) => document.querySelector('#case-message')?.textContent.includes(value), text); }

await constructManagers();
let server = makeServer(); let baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
const consoleErrors = []; page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
try {
  await page.goto(baseUrl); await page.locator('#case-library-heading').waitFor();
  await page.locator('#new-project-name').fill('M3-B1 Web验收项目');
  await page.locator('#new-project-description').fill('零模型真实浏览器流程');
  await page.locator('#create-project').click();
  await page.locator('#case-project-list').getByText(/M3-B1 Web验收项目/).waitFor();
  await page.locator('#case-import-file').setInputFiles(fixture); await page.locator('#upload-cases').click(); await waitCaseMessage(page, '已读取');
  await page.locator('#case-sheet').selectOption('项目用例'); await page.locator('#case-sheet').dispatchEvent('change');
  await page.locator('#preview-import').click(); await waitCaseMessage(page, '预览已生成');
  assert.match(await page.locator('#import-preview').innerText(), /新增 2/);
  await page.locator('#confirm-import').click(); await waitCaseMessage(page, '新增 2 条');

  await page.getByRole('cell', { name: '001', exact: true }).locator('..').click();
  await page.getByTestId('case-build-version').selectOption('1');
  const budgetBefore = structuredClone(await buildStore.getBudget());
  await page.getByTestId('case-build-create').click();
  await page.waitForFunction(() => document.querySelector('#case-build-message')?.textContent.includes('Harness 尚未启动'));
  await page.getByText('本次建例输入', { exact: true }).waitFor();
  const inputText = await page.getByTestId('build-project-case-input').innerText();
  assert.match(inputText, /220\.5 kW/); assert.match(inputText, /127\.0\.0\.1/); assert.match(inputText, /点击执行按钮/); assert.match(inputText, /结果显示PROBE-42/);
  assert.match(await page.locator('#build-statuses').innerText(), /SUBMITTED/);
  assert.match(await page.locator('#build-candidates').innerText(), /尚未生成候选/);
  assert.equal(await page.getByTestId('build-start').isDisabled(), true);
  const created = (await buildStore.listTasks()).find((task) => task.source?.kind === 'project-case');
  assert.ok(created); assert.equal(created.attempts.length, 0); assert.deepEqual(await buildStore.getBudget(), budgetBefore); assert.equal(harnessStarts, 0);

  await page.locator('#build-back-to-case').click();
  await page.locator('#case-build-history').getByText(created.task_id).waitFor();
  const evidence = path.resolve('docs/evidence/M3B1_PROJECT_CASE_BUILD_INPUT_WEB.png');
  await fs.mkdir(path.dirname(evidence), { recursive: true });
  await page.screenshot({ path: evidence, fullPage: true });

  await close(server); await constructManagers(); server = makeServer(); baseUrl = await listen(server);
  await page.goto(baseUrl); await page.locator('#case-project-list').getByText(/M3-B1 Web验收项目/).click();
  await page.getByRole('cell', { name: '001', exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(created.task_id).waitFor();
  await page.locator('#case-build-history').getByText(created.task_id).click();
  assert.match(await page.getByTestId('build-project-case-input').innerText(), /设备|220\.5 kW/);
  assert.equal(harnessStarts, 0); assert.deepEqual(await buildStore.getBudget(), budgetBefore);
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({ status: 'passed', task_id: created.task_id, candidate_count: 0, harness_starts: 0, screenshot: evidence }));
  console.log('TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0');
} finally {
  await browser.close(); if (server.listening) await close(server); await fs.rm(localRoot, { recursive: true, force: true });
}
