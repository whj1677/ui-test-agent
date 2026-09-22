import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createWorkbenchServer } from '../server/app.mjs';
import { BuildSupplementalAssessmentStore } from '../server/build/assessments.mjs';
import { PROJECT_CASE_STEP_TITLE_RULE_VERSION } from '../server/build/report.mjs';
import { BuildTaskStore, M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { sha256File } from '../server/integrity.mjs';
import { createPaths } from '../server/paths.mjs';

const localRoot = path.resolve(process.env.M4A_ACCEPTANCE_ROOT || '');
const taskId = process.env.M4A_SOURCE_TASK_ID || 'build-20260922022951-0e638858';
const candidateSha256 = process.env.M4A_CANDIDATE_SHA256 || 'CA3819EF8CA3A3C8A89DFFEB5F53372658EA34EEAD59245714BB742BB06B6914';
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
const assessmentId = process.env.M4A_ASSESSMENT_ID || 'm4a-step-title-compat-20260922';
const publicScreenshot = path.resolve(process.env.M4A_PUBLIC_SCREENSHOT || 'docs/evidence/M4A_STEP_COMPAT_OFFLINE_WEB.png');
if (!localRoot || !browserExecutable) throw new Error('M4A_OFFLINE_ASSESSMENT_CONFIGURATION_REQUIRED');

const paths = createPaths({ localRoot });
const buildStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M4A_QUERY_CASE_FLASH_RETRY_AUTHORIZATION_ID }); await buildStore.init();
const assessmentStore = new BuildSupplementalAssessmentStore(paths.buildAssessmentsRoot, buildStore); await assessmentStore.init();
const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
const caseManager = new CaseLibraryManager(caseStore);
const task = await buildStore.getTask(taskId);
assert.ok(task, 'source task is required');
const candidate = task.candidates?.find((item) => item.sha256 === candidateSha256);
assert.ok(candidate, 'registered source candidate is required');
const candidateDescriptor = task.files.find((item) => item.attempt_id === candidate.attempt_id && item.kind === 'candidate');
const reportDescriptors = Object.fromEntries(['normal', 'negative'].map((lane) => [lane, task.files.find((item) => item.attempt_id === candidate.attempt_id && item.kind === 'test_report' && item.relative_path.replaceAll('\\', '/').includes(`/verification/${lane}/`))]));
assert.ok(candidateDescriptor && reportDescriptors.normal && reportDescriptors.negative);
const taskRoot = buildStore.taskDirectory(taskId);
const candidateFile = path.join(taskRoot, candidateDescriptor.relative_path);
const taskFile = path.join(taskRoot, 'task.json');
const authorizationFile = buildStore.revalidationAuthorizationFile;
const originalHashes = {
  task: await sha256File(taskFile), authorization: await sha256File(authorizationFile), candidate: await sha256File(candidateFile),
  normal_report: await sha256File(path.join(taskRoot, reportDescriptors.normal.relative_path)),
  negative_report: await sha256File(path.join(taskRoot, reportDescriptors.negative.relative_path)),
};
assert.equal(originalHashes.candidate, candidateSha256);
const code = await fs.readFile(candidateFile, 'utf8');
for (const required of [
  "toHaveText('共12条 · 第1/4页')", "toEqual(['H101', 'H102', 'H103'])", 'toEqual(rowsBeforeQuery)',
  "toHaveText('共3条 · 第1/1页')", "toEqual(['H102', 'H106', 'H110'])", "toEqual(['120 kW', '220 kW', '110 kW'])",
]) assert.ok(code.includes(required), `candidate review basis missing: ${required}`);
assert.equal(code.includes("toEqual(['循环泵', '循环泵', '疏水泵'])"), false);

const source = {
  schema: 'workbench/build-supplemental-assessment-source-v1', assessment_id: assessmentId,
  created_at: process.env.M4A_ASSESSMENT_CREATED_AT || '2026-09-22T04:30:00.000Z', source_task_id: taskId, source_attempt_id: candidate.attempt_id,
  source_candidate_version: candidate.version, candidate_sha256: candidateSha256,
  report_sha256: { normal: originalHashes.normal_report, negative: originalHashes.negative_report },
  mapping_rule_version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
  business_review: [
    {
      step_id: 'CASE_STEP_1', status: 'COVERED',
      requirement: 'S01标题、默认计数器、空关键词、两个“全部”、编号升序和3行默认态。',
      code_locations: ['candidate.spec.mjs:50-61'],
      evidence: '正常原报告步骤1完成且整条测试PASSED；候选逐项断言默认控件和行数。',
    },
    {
      step_id: 'CASE_STEP_2', status: 'COVERED',
      requirement: 'S02只改变站点/类型且不查询，计数不变，整张表与前态逐单元格完全一致并保持H101/H102/H103。',
      code_locations: ['candidate.spec.mjs:64-76', 'candidate.spec.mjs:23-32'],
      evidence: 'readRows读取每行全部td；toEqual(rowsBeforeQuery)覆盖新增/缺失行、列值和顺序，另断言3行及三个ID。',
    },
    {
      step_id: 'CASE_STEP_3', status: 'PARTIAL',
      requirement: 'S03联合查询后的数量、顺序及expected_records对应字段。',
      code_locations: ['candidate.spec.mjs:79-89'],
      evidence: '已有正常报告证明计数、3行、ID顺序、站点、类型和功率断言执行通过；候选未断言测试数据中的任务名称列（循环泵、循环泵、疏水泵）。',
    },
  ],
};
const assessment = await assessmentStore.register(source);
assert.equal(assessment.normal.step_mapping.complete, true);
assert.equal(assessment.negative.step_mapping.complete, true);
assert.equal(assessment.negative.specified_mismatch, true);
assert.equal(assessment.negative.step_mapping.items.find((item) => item.step_id === 'CASE_STEP_3').error_attributed, true);
assert.equal(assessment.conclusion, 'BUSINESS_REVIEW_GAPS');

const emptyRunStore = { async listAssets() { return []; }, async listRuns() { return []; } };
const inertBuildManager = { active: null, diagnostics() { return { storage_status: 'READY' }; }, async templates() { return []; } };
const listen = async () => {
  const server = createWorkbenchServer({ store: emptyRunStore, manager: { active: null }, buildStore, buildManager: inertBuildManager, buildAssessmentStore: assessmentStore, caseStore, caseManager });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
};
const close = (server) => new Promise((resolve) => server.close(resolve));
let runtime = await listen();
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, locale: 'zh-CN' });
let restartReadback = false;
try {
  await page.goto(runtime.baseUrl);
  await page.locator('#case-project-list').getByText(/M4-A HOLD-Q1 查询迁移/).click();
  await page.getByRole('cell', { name: 'HOLD-Q1', exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(taskId).click();
  const assessmentPanel = page.getByTestId('build-supplemental-assessments');
  await assert.doesNotReject(() => assessmentPanel.getByText(assessmentId, { exact: false }).waitFor());
  const text = await assessmentPanel.innerText();
  for (const expected of ['BUSINESS_REVIEW_GAPS', 'CASE_STEP_1', 'CASE_STEP_2', 'CASE_STEP_3', '反例错误归属本步骤', 'PARTIAL', '任务名称列']) assert.match(text, new RegExp(expected));
  assert.match(await page.locator('#build-error').innerText(), /PROJECT_CASE_STEP_COVERAGE_INCOMPLETE/);
  const image = page.getByTestId('candidate-normal-screenshot'); await image.waitFor();
  assert.equal(await image.evaluate((item) => item.complete && item.naturalWidth > 0), true);
  await fs.mkdir(path.dirname(publicScreenshot), { recursive: true });
  await page.screenshot({ path: publicScreenshot, fullPage: true });
  await close(runtime.server);
  runtime = await listen();
  await page.goto(runtime.baseUrl);
  await page.locator('#case-project-list').getByText(/M4-A HOLD-Q1 查询迁移/).click();
  await page.getByRole('cell', { name: 'HOLD-Q1', exact: true }).locator('..').click();
  await page.locator('#case-build-history').getByText(taskId).click();
  await page.getByTestId('build-supplemental-assessments').getByText(assessmentId, { exact: false }).waitFor();
  restartReadback = true;
} finally {
  await browser.close();
  if (runtime.server.listening) await close(runtime.server);
}
const finalHashes = {
  task: await sha256File(taskFile), authorization: await sha256File(authorizationFile), candidate: await sha256File(candidateFile),
  normal_report: await sha256File(path.join(taskRoot, reportDescriptors.normal.relative_path)),
  negative_report: await sha256File(path.join(taskRoot, reportDescriptors.negative.relative_path)),
};
assert.deepEqual(finalHashes, originalHashes);
await fs.mkdir(path.join(localRoot, 'evidence'), { recursive: true });
const summaryFile = path.join(localRoot, 'evidence', 'm4a-step-compat-offline-summary.json');
await fs.writeFile(summaryFile, `${JSON.stringify({ assessment, original_hashes: originalHashes, final_hashes: finalHashes, restart_readback: restartReadback, public_screenshot: publicScreenshot }, null, 2)}\n`);
console.log(JSON.stringify({ task_id: taskId, assessment_id: assessmentId, conclusion: assessment.conclusion, restart_readback: restartReadback, summary: summaryFile }));
