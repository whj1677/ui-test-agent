import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';

const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'm3a-browser-'));
const template = fileURLToPath(new URL('../examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx', import.meta.url));
let caseStore = new CaseLibraryStore(path.join(localRoot, 'case-library')); await caseStore.init();
let caseManager = new CaseLibraryManager(caseStore);
const emptyStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const manager = { active: null };
const buildStore = { async listTasks() { return []; }, async getBudget() { return null; } };
const buildManager = { active: null, async templates() { return []; }, diagnostics() { return null; } };
function makeServer() { return createWorkbenchServer({ store: emptyStore, manager, buildStore, buildManager, caseStore, caseManager }); }
async function listen(server) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); return `http://127.0.0.1:${server.address().port}`; }
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
async function waitMessage(page, text) { await page.waitForFunction((expected) => document.querySelector('#case-message')?.textContent.includes(expected), text); }
async function createProject(page, name, description = '') {
  await page.locator('#new-project-name').fill(name); await page.locator('#new-project-description').fill(description); await page.locator('#create-project').click();
  await page.locator('#case-project-list').getByRole('button', { name: new RegExp(`^${name}`) }).waitFor();
}
async function selectProject(page, name) { await page.locator('#case-project-list').getByRole('button', { name: new RegExp(`^${name}`) }).click(); }
async function importFile(page, file, sheetName) {
  await page.locator('#case-import-file').setInputFiles(file); await page.locator('#upload-cases').click(); await waitMessage(page, '已读取');
  if (sheetName) { await page.locator('#case-sheet').selectOption(sheetName); await page.locator('#case-sheet').dispatchEvent('change'); }
  await page.locator('#preview-import').click(); await waitMessage(page, '预览已生成');
}
async function confirmImport(page) { await page.locator('#confirm-import').click(); await waitMessage(page, '新增'); }
async function download(page, buttonId, destination) {
  const pending = page.waitForEvent('download'); await page.locator(buttonId).click(); const item = await pending; await item.saveAs(destination);
}

let server = makeServer(); let baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true }); let page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, locale: 'zh-CN' });
const consoleErrors = []; page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
try {
  await page.goto(baseUrl); await page.locator('#case-library-heading').waitFor();
  await createProject(page, '项目A', '从真实 Excel 导入');
  await importFile(page, template, '项目A示例');
  assert.match(await page.locator('#import-preview').innerText(), /新增 2/); assert.match(await page.locator('#import-preview').innerText(), /待澄清 1/);
  await confirmImport(page); assert.equal(await page.locator('#case-table-body tr').count(), 3);
  assert.match(await page.locator('#case-table-body').innerText(), /001/); assert.match(await page.locator('#case-table-body').innerText(), /中文多步骤登录校验/);
  await page.locator('#case-table-body input[type=checkbox]').nth(0).check(); await page.locator('#case-table-body input[type=checkbox]').nth(1).check();
  const selectedPackage = path.join(localRoot, 'selected.json'); await download(page, '#export-selected', selectedPackage);
  const selectedJson = JSON.parse(await fs.readFile(selectedPackage, 'utf8')); assert.equal(selectedJson.cases.length, 2); assert.equal(selectedJson.cases[0].content.steps.length, 3);

  await createProject(page, '项目B', 'Excel 与原生包混合');
  await importFile(page, template, '项目B示例'); await confirmImport(page);
  await importFile(page, selectedPackage); await confirmImport(page); assert.equal(await page.locator('#case-table-body tr').count(), 3);
  await importFile(page, selectedPackage); assert.match(await page.locator('#import-preview').innerText(), /重复跳过 2/); await confirmImport(page); assert.equal(await page.locator('#case-table-body tr').count(), 3);

  await page.getByRole('cell', { name: '001', exact: true }).locator('..').click(); await page.locator('#case-title').fill('项目B独立修改'); await page.locator('#case-detail button[type=submit]').click(); await waitMessage(page, '新的用例版本');
  const projectA = (await caseStore.listProjects()).find((item) => item.name === '项目A'); assert.equal(projectA.cases.find((item) => item.external_id === '001').title, '中文多步骤登录校验');

  const conflict = structuredClone(selectedJson); conflict.package_id = 'm3a-conflict-fixture'; conflict.cases[0].content.title = '同来源冲突内容';
  const conflictFile = path.join(localRoot, 'conflict.json'); await fs.writeFile(conflictFile, JSON.stringify(conflict));
  await importFile(page, conflictFile); assert.match(await page.locator('#import-preview').innerText(), /冲突/); const countBefore = await page.locator('#case-table-body tr').count(); await confirmImport(page); assert.equal(await page.locator('#case-table-body tr').count(), countBefore);

  const projectBPackage = path.join(localRoot, 'project-b.json'); await download(page, '#export-all', projectBPackage);
  await createProject(page, '空项目C', '往返验证'); await importFile(page, projectBPackage); await confirmImport(page); assert.equal(await page.locator('#case-table-body tr').count(), 3);
  const projectB = (await caseStore.listProjects()).find((item) => item.name === '项目B'); const projectC = (await caseStore.listProjects()).find((item) => item.name === '空项目C');
  assert.deepEqual(projectC.cases.map((item) => item.versions[0].content), projectB.cases.map((item) => item.versions.at(-1).content));

  await selectProject(page, '项目B');
  const screenshot = path.resolve('docs/evidence/M3A_CASE_LIBRARY_WEB.png'); await fs.mkdir(path.dirname(screenshot), { recursive: true }); await page.screenshot({ path: screenshot, fullPage: true });
  await close(server); caseStore = new CaseLibraryStore(path.join(localRoot, 'case-library')); await caseStore.init(); caseManager = new CaseLibraryManager(caseStore); server = makeServer(); baseUrl = await listen(server);
  await page.goto(baseUrl); await page.locator('#case-project-list').getByText(/项目A/).waitFor(); assert.equal(await page.locator('#case-project-list button').count(), 3);
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({ status: 'passed', projects: 3, project_a_cases: 3, project_b_cases: 3, project_c_cases: 3, screenshot }));
  console.log('TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0');
} finally {
  await browser.close(); if (server.listening) await close(server); await fs.rm(localRoot, { recursive: true, force: true });
}
