import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { buildAdapter } from '../server/build/adapter.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M3B2_PROJECT_CASE_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(new URL('../package.json', import.meta.url))));
await fs.mkdir(path.join(workbenchRoot, '.local'), { recursive: true });
const localRoot = await fs.mkdtemp(path.join(workbenchRoot, '.local', 'm3b2-browser-'));
const paths = createPaths({ localRoot });
const fixture = path.join(localRoot, 'm3b2-case.xlsx');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('项目用例');
sheet.addRow(['用例编号', '标题', '模块', '前置条件', '测试数据', '步骤', '逐步预期', '内容状态']);
sheet.addRow(['001', '合成探针真实建例', '合成探针', '本地无登录页面可访问', '入口由工作台绑定',
  '确认按钮“执行探针交互”可见\n点击按钮“执行探针交互”',
  '按钮“执行探针交互”可见\n输出显示PROBE-42', '已确认']);
await workbook.xlsx.writeFile(fixture);

const emptyStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const runManager = { active: null };
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let harnessStarts = 0;
let sequence = 0;
let caseStore; let caseManager; let buildStore; let buildManager;

const adapter = {
  ...buildAdapter,
  async ensureHarnessRuntime() { return { dsh: '0.1.6-alpha.2' }; },
  async runHarnessTask(options) {
    harnessStarts += 1;
    await options.onLifecycle({ type: 'process_spawn', pid: 13579, parent_pid: process.pid, at: new Date().toISOString() });
    const snapshot = JSON.parse(await fs.readFile(path.join(options.workspace, 'input', 'case-snapshot.json'), 'utf8'));
    assert.equal(snapshot.content.steps[1].expected, '输出显示PROBE-42');
    assert.equal(await fs.readFile(path.join(options.workspace, 'agent-instruction.txt'), 'utf8'), options.task);
    const code = `import { test, expect } from '@playwright/test';
test('M3-B2 project case', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await test.step('CASE_STEP_1', async () => {
    await expect(page.getByRole('button', { name: '执行探针交互' })).toBeVisible();
  });
  await test.step('CASE_STEP_2', async () => {
    await page.getByRole('button', { name: '执行探针交互' }).click();
    await expect(page.locator('#probe-result')).toHaveText('PROBE-42');
  });
});
`;
    await fs.mkdir(path.dirname(options.candidatePath), { recursive: true });
    await fs.writeFile(options.candidatePath, code);
    return {
      assessment: { success: true, completed: true, candidateExists: true, exitCode: 0, termination: null, finalPresent: true, turnEndReason: 'completed', toolCalls: 2, maxToolCalls: 30, toolLimitReached: false },
      candidate: { path: 'output/candidate.spec.mjs' },
      events: [{ type: 'status', phase: 'step_end' }, { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' }, { type: 'tool_call', tool: 'write_file' }],
      process: { pid: 13579, parentPid: process.pid, exitCode: 0, signal: null, termination: null, exitObserved: true, closeObserved: true, outputComplete: true, observerError: null },
    };
  },
};

async function constructManagers() {
  caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  caseManager = new CaseLibraryManager(caseStore);
  buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M3B2_PROJECT_CASE_AUTHORIZATION_ID }); await buildStore.init();
  buildManager = new BuildTaskManager({
    store: buildStore, caseStore, paths, adapter, authorizationId: M3B2_PROJECT_CASE_AUTHORIZATION_ID,
    browserExecutable, credentialProvider: () => ({ apiKey: 'synthetic-key', baseUrl: 'https://model.invalid' }),
    idFactory: () => `build-m3b2-browser-${String(++sequence).padStart(8, '0')}`,
  });
}
function makeServer() { return createWorkbenchServer({ store: emptyStore, manager: runManager, buildStore, buildManager, caseStore, caseManager }); }
async function listen(server) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); return `http://127.0.0.1:${server.address().port}`; }
async function close(server) { await new Promise((resolve) => server.close(resolve)); }
async function waitText(page, selector, text) { await page.waitForFunction(([target, value]) => document.querySelector(target)?.textContent.includes(value), [selector, text]); }
async function sha256(response) { return createHash('sha256').update(Buffer.from(await response.body())).digest('hex').toUpperCase(); }

await fs.access(browserExecutable);
await constructManagers();
let server = makeServer(); let baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
try {
  await page.goto(baseUrl); await page.locator('#case-library-heading').waitFor();
  await page.locator('#new-project-name').fill('M3-B2 Web验收项目');
  await page.locator('#new-project-description').fill('零模型真实浏览器接线验证');
  await page.locator('#create-project').click();
  await page.locator('#case-project-list').getByText(/M3-B2 Web验收项目/).waitFor();
  await page.locator('#case-import-file').setInputFiles(fixture); await page.locator('#upload-cases').click(); await waitText(page, '#case-message', '已读取');
  await page.locator('#preview-import').click(); await waitText(page, '#case-message', '预览已生成');
  await page.locator('#confirm-import').click(); await waitText(page, '#case-message', '新增 1 条');
  await page.getByRole('cell', { name: '001', exact: true }).locator('..').click();
  await page.getByTestId('case-build-version').selectOption('1');
  await page.getByTestId('case-build-create').click();
  await waitText(page, '#case-build-message', 'Harness 尚未启动');
  await page.waitForFunction(() => !document.querySelector('[data-testid="build-start"]')?.disabled);
  await page.getByTestId('build-start').click();
  await page.waitForFunction(() => /WAITING_HUMAN_REVIEW|CANDIDATE_VALIDATION_FAILED|FAILED|INTERRUPTED|CANCELLED/.test(document.querySelector('#build-statuses')?.textContent || ''), null, { timeout: 90_000 });
  const task = (await buildStore.listTasks())[0];
  assert.equal(task.task_status, 'WAITING_HUMAN_REVIEW', JSON.stringify({ status: task.task_status, error: task.error, candidate: task.candidates[0] }, null, 2));
  assert.equal(task.candidates[0].normal.test_status, 'PASSED');
  assert.equal(task.candidates[0].negative.test_status, 'FAILED');
  assert.equal(task.candidates[0].negative.error.expected, 'PROBE-42');
  assert.equal(task.candidates[0].negative.error.actual, 'PROBE-41');
  assert.ok(task.candidates[0].project_case_step_mapping.every((item) => item.observed));
  await page.locator('[data-testid="candidate-normal-screenshot"]').waitFor();
  await page.locator('[data-testid="candidate-negative-screenshot"]').waitFor();
  assert.equal(await page.locator('[data-testid="candidate-normal-screenshot"]').evaluate((image) => image.complete && image.naturalWidth > 0), true);
  assert.equal(await page.locator('[data-testid="candidate-negative-screenshot"]').evaluate((image) => image.complete && image.naturalWidth > 0), true);
  for (const lane of ['normal', 'negative']) {
    const video = page.locator(`[data-testid="candidate-${lane}-video"]`);
    await video.waitFor();
    await video.evaluate(async (element) => { await element.play(); });
    await page.waitForTimeout(300);
    await video.evaluate((element) => element.pause());
    const before = await video.evaluate((element) => element.currentTime);
    await page.waitForTimeout(2200);
    const after = await video.evaluate((element) => element.currentTime);
    assert.ok(before > 0); assert.ok(Math.abs(after - before) < 0.15);
    await video.evaluate((element) => { element.currentTime = Math.min(0.2, element.duration || 0.2); });
  }
  for (const lane of ['normal', 'negative']) {
    const descriptor = task.files.find((file) => file.attempt_id === task.candidates[0].attempt_id && file.kind === `${lane === 'normal' ? 'normal' : 'counterexample'}_trace`);
    const response = await page.request.get(`${baseUrl}/api/build/tasks/${task.task_id}/media/${descriptor.file_id}`);
    assert.equal(response.status(), 200); assert.equal(await sha256(response), descriptor.sha256);
  }
  const evidence = path.resolve('docs/evidence/M3B2_PROJECT_CASE_RUN_WEB.png');
  await fs.mkdir(path.dirname(evidence), { recursive: true }); await page.screenshot({ path: evidence, fullPage: true });
  await close(server); await constructManagers(); server = makeServer(); baseUrl = await listen(server);
  await page.goto(baseUrl); await page.locator('#case-project-list').getByText(/M3-B2 Web验收项目/).click();
  await page.getByRole('cell', { name: '001', exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(task.task_id).click();
  await page.waitForFunction(() => document.querySelector('#build-statuses')?.textContent.includes('WAITING_HUMAN_REVIEW'));
  assert.equal(harnessStarts, 1);
  console.log(JSON.stringify({ status: 'passed', task_id: task.task_id, candidate_sha256: task.candidates[0].sha256, harness_starts: harnessStarts, screenshot: evidence }));
  console.log('TAP version 13\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0');
} finally {
  await browser.close(); if (server.listening) await close(server); await buildManager.settle(); await fs.rm(localRoot, { recursive: true, force: true });
}
