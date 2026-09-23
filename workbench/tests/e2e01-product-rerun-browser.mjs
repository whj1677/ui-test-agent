import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const cases = {
  'TC-003': { taskId: 'build-20260923025549-922a763f', button: '重新试跑正常入口（不调用模型）', hash: '1F1C3CD75E2BAAC6338B1C86273C32D52D2B848852B903D2F05E5A1E862B6A04' },
  'TC-006': { taskId: 'build-20260923025549-922a763f', button: '重新运行 TC-006（不调用模型）', hash: '1F1C3CD75E2BAAC6338B1C86273C32D52D2B848852B903D2F05E5A1E862B6A04' },
  'TC-001': { taskId: 'build-20260923025026-03dfb09e', button: '重新试跑正常入口（不调用模型）', hash: 'A82F9A7BF5B3D464E7FF8B65EBCF760757CC9E812863122E77CA21697DDBD255' },
  'TC-004': { taskId: 'build-20260923025026-03dfb09e', button: '重新运行 TC-004（不调用模型）', hash: 'A82F9A7BF5B3D464E7FF8B65EBCF760757CC9E812863122E77CA21697DDBD255' },
  'TC-002': { taskId: 'build-20260923025157-98c45421', button: '重新试跑正常入口（不调用模型）', hash: 'EE472C0293CC4DCD35C881BBBC8D360E71ABCE069615D03844255ABC4A407E93' },
  'TC-005': { taskId: 'build-20260923025157-98c45421', button: '重新运行 TC-005（不调用模型）', hash: 'EE472C0293CC4DCD35C881BBBC8D360E71ABCE069615D03844255ABC4A407E93' },
};
const externalId = process.argv[2];
const selected = cases[externalId];
assert.ok(selected, 'Pass exactly one of TC-001 through TC-006');
const base = 'http://127.0.0.1:4322';
const projectId = 'project-61579c25-2833-4c41-b592-357e1b306026';
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`${base}/workspace/#/projects/${projectId}/build-tasks/${selected.taskId}`);
  await page.getByRole('heading', { name: new RegExp(`^${externalId === 'TC-004' ? 'TC-001' : externalId === 'TC-005' ? 'TC-002' : externalId === 'TC-006' ? 'TC-003' : externalId} · v`) }).waitFor();
  const task = await (await page.request.get(`${base}/api/build/tasks/${selected.taskId}`)).json();
  assert.equal(task.candidates?.at(-1)?.sha256, selected.hash, 'frozen candidate identity is unchanged before UI launch');
  const before = await page.getByRole('heading', { name: new RegExp(`^${externalId} · run-`) }).count();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/build/tasks/${selected.taskId}/trial-runs`) && response.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: selected.button }).click();
  const response = await responsePromise;
  const result = await response.json();
  assert.equal(response.status(), 202, JSON.stringify(result));
  await page.getByRole('heading', { name: new RegExp(`^${externalId} · run-`) }).nth(before).waitFor();
  const after = await page.getByRole('heading', { name: new RegExp(`^${externalId} · run-`) }).count();
  assert.equal(after, before + 1, 'one new run appears in the workbench UI');
  const run = result.candidates?.at(-1)?.trial_runs?.at(-1);
  assert.equal(run?.executed_external_id, externalId);
  console.log(JSON.stringify({ external_id: externalId, run_id: run.run_id, status: run.status,
    complete_pass: run.complete_pass, runner_version: run.runner_version,
    timeline_status: run.caption_timeline?.status, timeline_reason: run.caption_timeline?.reason || null,
    candidate_sha256: run.candidate_sha256, technical_error: run.technical_error,
    started_at: run.started_at, finished_at: run.finished_at }));
} finally {
  await browser.close();
}
