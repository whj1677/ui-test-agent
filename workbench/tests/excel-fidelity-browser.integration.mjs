import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'm3a-fidelity-browser-'));
const fixture = fileURLToPath(new URL('./fixtures/m3a-excel-fidelity-boundary.xlsx', import.meta.url));
let caseStore = new CaseLibraryStore(path.join(localRoot, 'case-library'));
await caseStore.init();
let caseManager = new CaseLibraryManager(caseStore);
const emptyStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const manager = { active: null };
const buildStore = { async listTasks() { return []; }, async getBudget() { return null; } };
const buildManager = { active: null, async templates() { return []; }, diagnostics() { return null; } };

function makeServer() { return createWorkbenchServer({ store: emptyStore, manager, buildStore, buildManager, caseStore, caseManager }); }
async function listen(server) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); return `http://127.0.0.1:${server.address().port}`; }
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
async function waitMessage(page, text) { await page.waitForFunction((expected) => document.querySelector('#case-message')?.textContent.includes(expected), text); }

let server = makeServer();
let baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
try {
  await page.goto(baseUrl);
  await page.locator('#case-library-heading').waitFor();
  await page.locator('#new-project-name').fill('Excel保真边界项目');
  await page.locator('#new-project-description').fill('真实 xlsx 上传、预览与确认');
  await page.locator('#create-project').click();
  await page.locator('#case-project-list').getByRole('button', { name: /^Excel保真边界项目/ }).waitFor();

  await page.locator('#case-import-file').setInputFiles(fixture);
  await page.locator('#upload-cases').click();
  await waitMessage(page, '已读取');
  assert.match(await page.locator('#case-sheet').innerText(), /保真边界（2 行）/);
  await page.locator('#preview-import').click();
  await waitMessage(page, '预览已生成');
  const previewText = await page.locator('#import-preview').innerText();
  for (const expected of ['新增 1', '无法导入 1', '保真边界 / 2', '保真边界 / 4', '220.5 kW', '3.65 V', '127.0.0.1', 'v1.2.3', '中文动作', '单元格第2行', '预期二', '单元格第3行', '动作三']) assert.match(previewText, new RegExp(expected.replaceAll('.', '\\.')));

  const screenshot = path.resolve('docs/evidence/M3A_EXCEL_FIDELITY_WEB.png');
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.locator('#confirm-import').click();
  await waitMessage(page, '新增 1 条');
  assert.equal(await page.locator('#case-table-body tr').count(), 1);
  await page.getByRole('cell', { name: '001', exact: true }).locator('..').click();
  assert.equal(await page.locator('#case-steps').inputValue(), '220.5 kW\n3.65 V\n127.0.0.1\nv1.2.3\n中文动作');
  assert.equal(await page.locator('#case-expected').inputValue(), '保持 220.5 kW\n保持 3.65 V\n显示 127.0.0.1\n版本 v1.2.3\n中文预期');

  const project = (await caseStore.listProjects())[0];
  assert.equal(project.cases.length, 1);
  assert.equal(project.cases[0].root_source.row, 2);
  assert.equal(project.cases[0].external_id, '001');
  assert.equal(project.cases[0].versions[0].content.status, 'CONFIRMED');

  await close(server);
  caseStore = new CaseLibraryStore(path.join(localRoot, 'case-library'));
  await caseStore.init();
  caseManager = new CaseLibraryManager(caseStore);
  server = makeServer();
  baseUrl = await listen(server);
  await page.goto(baseUrl);
  await page.locator('#case-project-list').getByText(/Excel保真边界项目/).waitFor();
  assert.equal(await page.locator('#case-table-body tr').count(), 1);

  console.log(JSON.stringify({ status: 'passed', physical_rows: [2, 4], added: 1, skipped_unimportable: 1, persisted_after_restart: true, screenshot }));
  console.log('TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0');
} finally {
  await browser.close();
  if (server.listening) await close(server);
  await fs.rm(localRoot, { recursive: true, force: true });
}
