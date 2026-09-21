import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M3B2_PROJECT_CASE_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function report(status, error = null) {
  return {
    stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 },
    suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{
      status, error,
      steps: [
        { title: 'CASE_STEP_1', category: 'test.step', duration: 5 },
        { title: 'CASE_STEP_2', category: 'test.step', duration: 5 },
      ],
    }] }] }] }],
  };
}

async function xlsx(title, actionSuffix) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('项目用例');
  sheet.addRow(['用例编号', '标题', '模块', '前置条件', '测试数据', '步骤', '逐步预期', '内容状态']);
  sheet.addRow(['001', title, '合成探针', '本地无登录页面可访问', `输入标识=${actionSuffix}`,
    `确认按钮“执行探针交互”可见\n点击按钮“执行探针交互”${actionSuffix}`,
    '按钮“执行探针交互”可见\n输出显示PROBE-42', '已确认']);
  sheet.addRow(['002', `${title}备用`, '合成探针', '本地无登录页面可访问', `输入标识=${actionSuffix}-OTHER`,
    '确认按钮“执行探针交互”可见\n点击按钮“执行探针交互”',
    '按钮“执行探针交互”可见\n输出显示PROBE-42', '已确认']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function adapter(capture) {
  let fixtureCount = 0;
  return {
    async ensureHarnessRuntime() { return { dsh: '0.1.6-alpha.2' }; },
    async startFixtureServer() {
      fixtureCount += 1;
      return { url: fixtureCount % 2 ? 'http://127.0.0.1:41001/probe' : 'http://127.0.0.1:41002/probe', async close() {} };
    },
    async runHarnessTask(options) {
      capture.push({
        task: options.task, workspace: options.workspace, maxToolCalls: options.maxToolCalls, timeoutMs: options.timeoutMs,
        taskMarkdown: await fs.readFile(path.join(options.workspace, 'task.md'), 'utf8'),
        snapshot: JSON.parse(await fs.readFile(path.join(options.workspace, 'input', 'case-snapshot.json'), 'utf8')),
        renderedInstruction: await fs.readFile(path.join(options.workspace, 'agent-instruction.txt'), 'utf8'),
      });
      await options.onLifecycle({ type: 'process_spawn', pid: 24680, parent_pid: process.pid, at: new Date().toISOString() });
      await fs.mkdir(path.dirname(options.candidatePath), { recursive: true });
      await fs.writeFile(options.candidatePath, `import { test, expect } from '@playwright/test';\n` +
        `test('project case', async ({ page }) => {\n` +
        `  await page.goto(process.env.PROBE_URL);\n` +
        `  await test.step('CASE_STEP_1', async () => { await expect(page.getByRole('button', { name: '执行探针交互' })).toBeVisible(); });\n` +
        `  await test.step('CASE_STEP_2', async () => { await page.getByRole('button', { name: '执行探针交互' }).click(); await expect(page.locator('#probe-result')).toHaveText('PROBE-42'); });\n` +
        `});\n`);
      return {
        assessment: { success: true, completed: true, candidateExists: true, exitCode: 0, termination: null, finalPresent: true, turnEndReason: 'completed' },
        candidate: { path: 'output/candidate.spec.mjs' },
        events: [{ type: 'status', phase: 'step_end' }, { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' }, { type: 'tool_call', tool: 'write_file' }],
        process: { pid: 24680, parentPid: process.pid, exitCode: 0, signal: null, termination: null, exitObserved: true, closeObserved: true, outputComplete: true, observerError: null },
      };
    },
    async verifyCandidate({ fixtureUrl, runDirectory }) {
      await fs.mkdir(path.join(runDirectory, 'artifacts'), { recursive: true });
      const normal = fixtureUrl.includes('41001');
      const payload = normal ? report('passed') : report('failed', { message: 'Expected string: "PROBE-42"\nReceived string: "PROBE-41"' });
      const reportPath = path.join(runDirectory, 'playwright-report.json');
      await fs.writeFile(reportPath, JSON.stringify(payload));
      await fs.writeFile(path.join(runDirectory, 'artifacts', 'evidence.png'), 'png');
      await fs.writeFile(path.join(runDirectory, 'artifacts', 'evidence.webm'), 'video');
      await fs.writeFile(path.join(runDirectory, 'artifacts', 'trace.zip'), 'trace');
      return { reportPath, process: { exitCode: normal ? 0 : 1, termination: null, error: null } };
    },
  };
}

async function context(label, suffix) {
  await fs.mkdir(path.join(workbenchRoot, '.local'), { recursive: true });
  const localRoot = await fs.mkdtemp(path.join(workbenchRoot, '.local', 'm3b2-wiring-'));
  const paths = createPaths({ localRoot });
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const caseManager = new CaseLibraryManager(caseStore);
  const project = await caseManager.createProject({ name: label, description: 'M3-B2零模型接线' });
  const upload = await caseManager.upload({
    fileName: `${label}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: await xlsx(label, suffix),
  });
  const mapping = { external_id: '用例编号', title: '标题', module: '模块', preconditions: '前置条件', test_data: '测试数据', steps: '步骤', expected: '逐步预期', status: '内容状态' };
  const preview = await caseManager.preview(project.project_id, { upload_id: upload.upload_id, sheet_name: '项目用例', mapping });
  const imported = await caseManager.confirm(project.project_id, preview.preview_id, {});
  const item = imported.project.cases[0]; const version = item.versions[0];
  const otherItem = imported.project.cases[1]; const otherVersion = otherItem.versions[0];
  const store = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M3B2_PROJECT_CASE_AUTHORIZATION_ID }); await store.init();
  const capture = [];
  const manager = new BuildTaskManager({
    store, caseStore, paths, adapter: adapter(capture), authorizationId: M3B2_PROJECT_CASE_AUTHORIZATION_ID,
    browserExecutable: 'synthetic-browser', credentialProvider: () => ({ apiKey: 'synthetic-key', baseUrl: 'https://model.invalid' }),
    idFactory: () => `build-m3b2-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, '0')}`,
  });
  const request = {
    request_id: `case-build-request-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, '0')}`,
    project_id: imported.project.project_id, case_id: item.case_id, case_version: version.version,
    content_sha256: version.content_sha256, environment_id: 'synthetic-probe-normal-v1',
  };
  const otherRequest = {
    request_id: `case-build-request-other-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, '0')}`,
    project_id: imported.project.project_id, case_id: otherItem.case_id, case_version: otherVersion.version,
    content_sha256: otherVersion.content_sha256, environment_id: 'synthetic-probe-normal-v1',
  };
  return { localRoot, store, manager, request, otherRequest, capture };
}

test('M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权', async () => {
  const first = await context('项目用例甲', 'ALPHA');
  const second = await context('项目用例乙', 'BETA');
  try {
    for (const current of [first, second]) {
      const created = await current.manager.submitProjectCase(current.request);
      assert.equal(created.execution_policy.mode, 'SINGLE_AUTHORIZED_INITIAL');
      assert.equal(created.authorization.used_starts, 0);
      await current.manager.start(created.task_id);
      const result = await current.manager.wait(created.task_id);
      assert.equal(result.task_status, 'WAITING_HUMAN_REVIEW');
      assert.equal(result.verification_status, 'PASSED');
      assert.equal(result.human_review_status, 'WAITING_REVIEW');
      assert.equal(result.candidates.length, 1);
      assert.equal(result.candidates[0].same_candidate_hash, true);
      assert.equal(result.candidates[0].counterexample_detected, true);
      assert.ok(result.candidates[0].project_case_step_mapping.every((item) => item.observed));
      assert.equal(current.capture.length, 1);
      assert.equal(current.capture[0].maxToolCalls, 30);
      assert.equal(current.capture[0].timeoutMs, 600_000);
      assert.equal(current.capture[0].task, current.capture[0].renderedInstruction);
      assert.equal(current.capture[0].snapshot.source.content_sha256, current.request.content_sha256);
      assert.match(current.capture[0].taskMarkdown, new RegExp(current.request.content_sha256));
      assert.match(current.capture[0].renderedInstruction, /candidate\.spec\.mjs/);
      assert.match(current.capture[0].renderedInstruction, /http:\/\/127\.0\.0\.1:41001\/probe/);
      const authorization = await current.store.getRevalidationAuthorization();
      assert.equal(authorization.used_starts, 1);
      assert.deepEqual(authorization.scope, {
        project_id: current.request.project_id, case_id: current.request.case_id, case_version: current.request.case_version,
        content_sha256: current.request.content_sha256, environment_id: current.request.environment_id,
      });
      assert.equal((await current.store.getBudget()).used_starts, 0);
      await assert.rejects(() => current.manager.start(created.task_id), /BUILD_INITIAL_NOT_ALLOWED|BUILD_REVALIDATION_AUTHORIZATION_EXHAUSTED/);
      const mediaKinds = result.files.filter((file) => file.attempt_id === 'attempt-01-initial').map((file) => file.kind);
      for (const kind of ['attempt_task_document', 'attempt_input_snapshot', 'rendered_agent_instruction', 'normal_screenshot', 'normal_video', 'normal_trace', 'counterexample_screenshot', 'counterexample_video', 'counterexample_trace']) {
        assert.ok(mediaKinds.includes(kind), kind);
      }
    }
    assert.notEqual(first.capture[0].taskMarkdown, second.capture[0].taskMarkdown);
    assert.match(first.capture[0].taskMarkdown, /ALPHA/);
    assert.match(second.capture[0].taskMarkdown, /BETA/);
    assert.doesNotMatch(first.capture[0].taskMarkdown, /Frozen candidate task\n/);
  } finally {
    await Promise.all([first.manager.settle(), second.manager.settle()]);
    await Promise.all([fs.rm(first.localRoot, { recursive: true, force: true }), fs.rm(second.localRoot, { recursive: true, force: true })]);
  }
});

test('M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动', async () => {
  const current = await context('作用域项目', 'SCOPE');
  try {
    const created = await current.manager.submitProjectCase(current.request);
    await assert.rejects(() => current.manager.submitProjectCase(current.otherRequest), /BUILD_REVALIDATION_AUTHORIZATION_CONFLICT/);
    assert.equal((await current.store.listTasks()).length, 1);
    const plainStoreRoot = path.join(current.localRoot, 'plain-build-tasks');
    const plainStore = new BuildTaskStore(plainStoreRoot); await plainStore.init();
    const plainManager = new BuildTaskManager({
      store: plainStore, caseStore: current.manager.caseStore, paths: current.manager.paths,
      browserExecutable: 'synthetic-browser', credentialProvider: () => ({ apiKey: 'synthetic', baseUrl: 'https://model.invalid' }),
      idFactory: () => 'build-inputonly-00000001',
    });
    const old = await plainManager.submitProjectCase({ ...current.request, request_id: 'case-build-request-inputonly' });
    assert.equal(old.execution_policy.mode, 'INPUT_ONLY');
    await assert.rejects(() => plainManager.start(old.task_id), /BUILD_INPUT_ONLY_TASK_NOT_STARTABLE/);
    assert.equal(created.authorization.used_starts, 0);
  } finally { await fs.rm(current.localRoot, { recursive: true, force: true }); }
});
