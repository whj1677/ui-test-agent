import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { BuildTaskStore } from '../server/build/store.mjs';

const acceptanceParent = path.resolve('.local'); await fs.mkdir(acceptanceParent, { recursive:true });
const localRoot = await fs.mkdtemp(path.join(acceptanceParent, 'ui-d2a-acceptance-'));
const sampleA = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_CASES_A.xlsx', import.meta.url));
const sampleB = fileURLToPath(new URL('../examples/ui-d2a/UI_D2A_CASES_B.xlsx', import.meta.url));
const evidenceRoot = path.resolve(process.env.UI_D2A_EVIDENCE_DIR || path.join(localRoot, 'evidence')); await fs.mkdir(evidenceRoot, { recursive:true });
let caseStore; let caseManager; let buildStore; let server; let baseUrl; const requests = [];

function makeServer() {
  const instance = createWorkbenchServer({ caseStore, caseManager, buildStore });
  instance.prependListener('request', (request) => requests.push({ method:request.method, url:request.url }));
  return instance;
}
async function listen() { server = makeServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}`; }
async function closeServer() { if (server?.listening) await new Promise((resolve) => server.close(resolve)); }
async function initStore() { caseStore = new CaseLibraryStore(path.join(localRoot, 'case-library')); await caseStore.init(); caseManager = new CaseLibraryManager(caseStore); buildStore = new BuildTaskStore(path.join(localRoot, 'build-tasks')); await buildStore.init(); }
async function waitHeading(page, name) { await page.getByRole('heading', { name, exact:true }).waitFor({ state:'visible', timeout:10_000 }); }
async function createProject(page, name, description) {
  await page.goto(`${baseUrl}/workspace/#/projects`); await waitHeading(page, '项目'); await page.getByRole('button', { name:'新建项目' }).click();
  await page.getByLabel('项目名称').fill(name); await page.getByLabel('项目说明').fill(description); await page.getByRole('button', { name:'创建并进入' }).click(); await waitHeading(page, name);
}
async function beginImport(page, file) {
  await page.getByRole('link', { name:'导入用例' }).first().click(); await waitHeading(page, '导入用例');
  if (await page.getByRole('button', { name:'继续导入' }).isVisible().catch(() => false)) await page.getByRole('button', { name:'继续导入' }).click();
  await page.locator('input[type=file]').setInputFiles(file); await page.getByRole('button', { name:'上传并读取' }).click(); await page.getByRole('button', { name:'生成后端预览' }).waitFor({ state:'visible', timeout:10_000 });
  await page.getByRole('button', { name:'生成后端预览' }).click(); await page.getByRole('button', { name:'确认导入' }).waitFor({ state:'visible', timeout:10_000 });
}
async function confirmImport(page) { await page.getByRole('button', { name:'确认导入' }).click(); await waitHeading(page, '导入确认已完成'); await page.getByRole('link', { name:'返回用例库' }).click(); await page.getByRole('heading', { name:'项目用例' }).waitFor(); }
async function saveDownload(page, buttonName, destination) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name:new RegExp(buttonName) }).click(); const download = await pending; await download.saveAs(destination); return destination;
}

await initStore(); await listen();
const browser = await chromium.launch({ headless:true }); const context = await browser.newContext({ viewport:{ width:1440, height:900 }, locale:'zh-CN', acceptDownloads:true }); const page = await context.newPage();
const consoleErrors = []; page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
try {
  await createProject(page, 'UI-D2A 验收项目 A', '真实 Excel 导入来源项目');
  const projectAId = new URL(page.url()).hash.split('/')[2];
  await beginImport(page, sampleA);
  assert.match(await page.locator('.preview-summary').innerText(), /2\s*新增[\s\S]*1\s*待确认\/待澄清/);
  assert.match(await page.locator('.preview-list').innerText(), /220\.5 kW与3\.65 V[\s\S]*127\.0\.0\.1[\s\S]*STEP_EXPECTED_MISSING/);
  assert.equal((await caseStore.getProject(projectAId)).cases.length, 0);
  await page.screenshot({ path:path.join(evidenceRoot, '01-real-import-preview-1440x900.png'), fullPage:true });
  await confirmImport(page);
  let projectA = await caseStore.getProject(projectAId); assert.equal(projectA.cases.length, 3); assert.equal(projectA.cases.filter((item) => item.status === 'PENDING_CONFIRMATION').length, 1);
  assert.match(projectA.cases[0].versions[0].content.test_data, /220\.5 kW[\s\S]*3\.65 V[\s\S]*127\.0\.0\.1/);
  await page.locator('.case-check').nth(0).check(); await page.locator('.case-check').nth(1).check();
  const selectedPath = path.join(localRoot, 'a-selected.json'); await saveDownload(page, '导出选中', selectedPath); const selectedPackage = JSON.parse(await fs.readFile(selectedPath, 'utf8'));
  assert.equal(selectedPackage.schema, 'workbench/case-package-v1'); assert.equal(selectedPackage.cases.length, 2); assert.equal('demo_only' in selectedPackage, false);
  const allPath = path.join(localRoot, 'a-all.json'); await saveDownload(page, '导出全部', allPath); const allPackage = JSON.parse(await fs.readFile(allPath, 'utf8')); assert.equal(allPackage.cases.length, 3);
  assert.equal(await page.getByRole('button', { name:/导出选中/ }).isEnabled(), true);

  await createProject(page, 'UI-D2A 验收项目 B', 'Excel 与正式原生包汇集项目');
  const projectBId = new URL(page.url()).hash.split('/')[2];
  await beginImport(page, sampleB); await confirmImport(page); assert.equal((await caseStore.getProject(projectBId)).cases.length, 1);
  await beginImport(page, allPath); assert.match(await page.locator('.preview-summary').innerText(), /3\s*新增|2\s*新增/); await confirmImport(page); let projectB = await caseStore.getProject(projectBId); assert.equal(projectB.cases.length, 4);
  await beginImport(page, allPath); assert.match(await page.locator('.preview-summary').innerText(), /3\s*重复/); await confirmImport(page); assert.equal((await caseStore.getProject(projectBId)).cases.length, 4);
  await page.screenshot({ path:path.join(evidenceRoot, '02-cross-project-library-1440x900.png'), fullPage:true });

  await page.getByRole('button', { name:/UI-D2A-001/ }).click(); await page.getByRole('button', { name:'编辑当前版本' }).click();
  await page.getByLabel('前置条件').fill('项目B独立前置条件\n不影响项目A'); await page.getByLabel('测试数据').fill('项目B数据 v2\n127.0.0.1');
  await page.locator('[data-step="0"] [data-action]').fill('打开项目B设备概览'); await page.getByRole('button', { name:'保存为新版本' }).click();
  await page.getByText('v2 · 内容已确认').waitFor({ state:'visible', timeout:10_000 }); projectB = await caseStore.getProject(projectBId); const edited = projectB.cases.find((item) => item.external_id === 'UI-D2A-001'); assert.equal(edited.current_version, 2);
  assert.equal(edited.versions[0].content.preconditions, '测试服务已启动\n采集终端处于在线状态'); assert.equal(edited.versions[1].content.preconditions, '项目B独立前置条件\n不影响项目A');
  projectA = await caseStore.getProject(projectAId); assert.equal(projectA.cases.find((item) => item.external_id === 'UI-D2A-001').current_version, 1);
  await page.getByRole('button', { name:/v1 · 内容已确认/ }).click(); await page.getByText(/测试服务已启动/).waitFor(); assert.match(await page.locator('.definition-grid').innerText(), /测试服务已启动/); assert.doesNotMatch(await page.locator('.definition-grid').innerText(), /项目B独立/);
  await page.getByRole('button', { name:/v2 · 内容已确认/ }).click(); await page.getByText(/项目B独立前置条件/).waitFor(); assert.match(await page.locator('.definition-grid').innerText(), /项目B独立前置条件/);
  const projectACase = projectA.cases.find((item) => item.external_id === 'UI-D2A-001');
  await page.goto(`${baseUrl}/workspace/#/projects/${projectAId}/cases/${projectACase.case_id}?version=1`); await page.getByText('设备监控 · v1').waitFor();
  await page.goto(`${baseUrl}/workspace/#/projects/${projectBId}/cases/${edited.case_id}`); await page.getByText('设备监控 · v2').waitFor(); assert.match(await page.locator('.definition-grid').innerText(), /项目B独立前置条件/); assert.equal(await page.getByRole('button', { name:'编辑当前版本' }).isVisible(), true);
  await page.reload(); await page.getByText('设备监控 · v2').waitFor();
  await page.goto(`${baseUrl}/workspace/#/projects/${projectBId}/cases/${edited.case_id}?version=9999`); await page.getByRole('heading', { name:'无法显示用例版本' }).waitFor(); assert.match(await page.locator('main').innerText(), /版本 9999 不存在/); assert.equal(await page.getByRole('button', { name:'编辑当前版本' }).count(), 0);
  await page.goto(`${baseUrl}/workspace/#/projects/${projectBId}/cases/${edited.case_id}?version=bad`); await page.getByRole('heading', { name:'无法显示用例版本' }).waitFor(); assert.match(await page.locator('main').innerText(), /版本参数无效/);
  await page.goBack(); await page.getByRole('heading', { name:'无法显示用例版本' }).waitFor();
  await page.goBack(); await page.getByText('设备监控 · v2').waitFor();
  await page.setViewportSize({ width:1920, height:1080 }); assert.equal(await page.locator('body').evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth + 1), true); await page.screenshot({ path:path.join(evidenceRoot, '03-version-detail-1920x1080.png'), fullPage:true });

  const conflict = structuredClone(allPackage); conflict.package_id = 'ui-d2a-conflict-package'; conflict.cases[0].content.title = '同来源变化内容';
  const conflictPath = path.join(localRoot, 'conflict.json'); await fs.writeFile(conflictPath, JSON.stringify(conflict));
  await page.goto(`${baseUrl}/workspace/#/projects/${projectBId}/cases`); await waitHeading(page, 'UI-D2A 验收项目 B'); await beginImport(page, conflictPath); assert.match(await page.locator('.preview-summary').innerText(), /1\s*同源内容冲突/); await confirmImport(page); assert.equal((await caseStore.getProject(projectBId)).cases.length, 4);
  await beginImport(page, conflictPath); await page.locator('[data-conflict]').selectOption('IMPORT_COPY'); await confirmImport(page); assert.equal((await caseStore.getProject(projectBId)).cases.length, 5);

  await page.goto(`${baseUrl}/workspace/#/projects/${projectBId}/settings`); await waitHeading(page, '项目设置');
  const second = await context.newPage(); await second.goto(`${baseUrl}/workspace/#/projects/${projectBId}/settings`); await waitHeading(second, '项目设置');
  await second.getByLabel('项目说明').fill('另一标签页先保存'); await second.getByRole('button', { name:'保存项目信息' }).click(); await second.getByText('项目信息已由后端保存。').waitFor();
  await page.getByLabel('项目说明').fill('当前标签页旧 revision'); await page.getByRole('button', { name:'保存项目信息' }).click(); await page.getByText(/项目已在其他页面发生变化/).waitFor(); await second.close();

  await page.setViewportSize({ width:1280, height:800 }); await page.goto(`${baseUrl}/workspace/#/projects`); await waitHeading(page, '项目'); assert.equal(await page.locator('body').evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth + 1), true); await page.screenshot({ path:path.join(evidenceRoot, '04-projects-1280x800.png'), fullPage:true });
  await page.setViewportSize({ width:1440, height:900 }); assert.equal(await page.locator('body').evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth + 1), true);

  await closeServer();
  await page.getByRole('link', { name:/进入项目/ }).first().click(); await page.getByRole('heading', { name:'无法读取真实数据' }).waitFor({ timeout:10_000 }); assert.match(await page.locator('main').innerText(), /无法连接工作台服务/);
  await initStore(); await listen();
  const restartContext = await browser.newContext({ viewport:{ width:1920, height:1080 }, locale:'zh-CN' }); const restartPage = await restartContext.newPage();
  await restartPage.goto(`${baseUrl}/workspace/#/projects`); await waitHeading(restartPage, '项目'); assert.equal(await restartPage.locator('.project-card').count(), 2);
  await restartPage.locator('.project-card').filter({ hasText:'UI-D2A 验收项目 B' }).getByRole('link', { name:/进入项目/ }).click();
  await restartPage.getByText('UI-D2A-001', { exact:true }).first().waitFor();
  await restartPage.locator('.case-link').filter({ hasText:'UI-D2A-001' }).first().click(); await restartPage.getByText('v2 · 内容已确认').waitFor();
  await restartPage.screenshot({ path:path.join(evidenceRoot, '05-restart-readback-1920x1080.png'), fullPage:true }); await restartContext.close();

  const forbidden = requests.filter((item) => item.method === 'POST' && /\/api\/(?:build|runs)/.test(item.url)); assert.deepEqual(forbidden, []);
  const unexpectedConsoleErrors = consoleErrors.filter((message) => !/status of 409|ERR_CONNECTION_REFUSED/.test(message));
  assert.deepEqual(unexpectedConsoleErrors, []);
  console.log(JSON.stringify({ status:'passed', data_root:localRoot, projects:2, project_a_cases:3, project_b_cases:5, selected_export_cases:2, all_export_cases:3, requests:requests.length, forbidden_execution_requests:0, screenshots:5 }));
  console.log('TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0');
} finally {
  await closeServer(); await context.close(); await browser.close();
  if (process.env.KEEP_UI_D2A_ACCEPTANCE !== '1') await fs.rm(localRoot, { recursive:true, force:true });
}
