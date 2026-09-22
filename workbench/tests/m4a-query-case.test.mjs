import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { BuildTaskStore, M4A_QUERY_CASE_AUTHORIZATION_ID } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { contentHash } from '../server/cases/excel.mjs';
import { createPaths } from '../server/paths.mjs';
import { holdQ1CasePackage, loadHoldQ1Source } from '../server/build/heldout-query.mjs';

function playwrightReport(status, errorMessage = 'Expected: "3 matching rows"\nReceived: "6 matching rows"') {
  return {
    stats: { expected: status === 'passed' ? 1 : 0, unexpected: status === 'failed' ? 1 : 0, skipped: 0 },
    suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{
      status,
      error: status === 'failed' ? { message: errorMessage } : null,
      steps: [1, 2, 3].map((order) => ({ title: `CASE_STEP_${order}`, category: 'test.step', duration: 5 })),
    }] }] }] }],
  };
}

function adapter(capture) {
  return {
    async ensureHarnessRuntime() { return { dsh: '0.1.6-alpha.2' }; },
    async startFixtureServer(file, options) {
      capture.routes.push({ file, route: options.route });
      return { url: `http://127.0.0.1:43000${options.route}`, async close() {} };
    },
    async runHarnessTask(options) {
      capture.harnessStarts += 1;
      const snapshotText = await fs.readFile(path.join(options.workspace, 'input', 'case-snapshot.json'), 'utf8');
      const taskMarkdown = await fs.readFile(path.join(options.workspace, 'task.md'), 'utf8');
      const instruction = await fs.readFile(path.join(options.workspace, 'agent-instruction.txt'), 'utf8');
      capture.modelInputs.push({ snapshotText, taskMarkdown, instruction, prompt: options.task });
      await options.onLifecycle({ type: 'process_spawn', pid: 32109, parent_pid: process.pid });
      await fs.mkdir(path.dirname(options.candidatePath), { recursive: true });
      await fs.writeFile(options.candidatePath, "import { test } from '@playwright/test';\ntest('fixture', async () => {});\n");
      return {
        assessment: { success: true, completed: true, candidateExists: true, exitCode: 0, termination: null, finalPresent: true },
        candidate: { path: 'output/candidate.spec.mjs' }, events: [],
        process: { pid: 32109, parentPid: process.pid, exitCode: 0, signal: null, termination: null, exitObserved: true, closeObserved: true, outputComplete: true, observerError: null },
      };
    },
    async verifyCandidate({ fixtureUrl, runDirectory }) {
      const normal = fixtureUrl.endsWith('/probe/q1');
      const status = normal && capture.failFirstNormal && runDirectory.includes('attempt-01-initial') ? 'failed' : normal ? 'passed' : 'failed';
      const reportPath = path.join(runDirectory, 'playwright-report.json');
      await fs.mkdir(path.join(runDirectory, 'artifacts'), { recursive: true });
      const errorMessage = normal ? 'Expected: "heading visible"\nReceived: "heading hidden"' : undefined;
      await fs.writeFile(reportPath, JSON.stringify(playwrightReport(status, errorMessage)));
      for (const [name, body] of [['evidence.png', 'png'], ['evidence.webm', 'video'], ['trace.zip', 'trace']]) {
        await fs.writeFile(path.join(runDirectory, 'artifacts', name), body);
      }
      return { reportPath, process: { exitCode: status === 'passed' ? 0 : 1, termination: null, error: null } };
    },
  };
}

async function setup() {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'm4a-query-case-'));
  const paths = createPaths({ localRoot });
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const caseManager = new CaseLibraryManager(caseStore);
  const project = await caseManager.createProject({ name: 'M4-A HOLD-Q1', description: '单条查询迁移' });
  const pkg = await holdQ1CasePackage(paths, { packageId: 'case-package-hold-q1-test' });
  const upload = await caseManager.upload({ fileName: 'hold-q1.json', contentType: 'application/json', body: Buffer.from(JSON.stringify(pkg)) });
  const preview = await caseManager.preview(project.project_id, { upload_id: upload.upload_id });
  const imported = await caseManager.confirm(project.project_id, preview.preview_id, {});
  const item = imported.project.cases[0];
  const version = item.versions[0];
  const store = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: M4A_QUERY_CASE_AUTHORIZATION_ID }); await store.init();
  const capture = { routes: [], modelInputs: [], harnessStarts: 0, failFirstNormal: false };
  const manager = new BuildTaskManager({
    store, caseStore, paths, adapter: adapter(capture), authorizationId: M4A_QUERY_CASE_AUTHORIZATION_ID,
    browserExecutable: 'engineering-fixture-browser', credentialProvider: () => ({ apiKey: 'test-only', baseUrl: 'https://model.invalid' }),
    idFactory: () => 'build-m4a-query-case-test0001',
  });
  return { localRoot, paths, caseStore, imported, item, version, store, manager, capture, preview };
}

test('HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认', async () => {
  const context = await setup();
  try {
    const frozen = await loadHoldQ1Source(context.paths);
    assert.equal(context.preview.summary.NEW, 1);
    assert.equal(context.version.content.external_id, 'HOLD-Q1');
    assert.deepEqual(JSON.parse(context.version.content.preconditions), frozen.sourceCase.preconditions);
    const data = JSON.parse(context.version.content.test_data);
    assert.deepEqual(data, {
      source_side: frozen.sourceCase.source_side,
      page_entry_url: frozen.sourceCase.page_entry_url,
      read_only_scope: frozen.sourceCase.read_only_scope,
      synthetic_login: frozen.sourceCase.synthetic_login,
      data: frozen.sourceCase.data,
    });
    assert.deepEqual(context.version.content.steps, frozen.sourceCase.steps.map((step, index) => ({ order: index + 1, action: step.action, expected: step.expected })));
  } finally { await fs.rm(context.localRoot, { recursive: true, force: true }); }
});

test('M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2', async () => {
  const context = await setup();
  try {
    const request = {
      request_id: 'case-build-request-m4aquery01', project_id: context.imported.project.project_id,
      case_id: context.item.case_id, case_version: 1, content_sha256: context.version.content_sha256,
      environment_id: 'heldout-query-q1-v1',
    };
    const task = await context.manager.submitProjectCase(request);
    assert.equal(task.execution_policy.mode, 'AUTHORIZED_INITIAL_OPTIONAL_REVISION');
    assert.equal(task.authorization.max_starts, 2);
    await context.manager.start(task.task_id);
    const result = await context.manager.wait(task.task_id);
    assert.equal(result.task_status, 'WAITING_HUMAN_REVIEW');
    assert.equal(result.candidates[0].normal.complete_pass, true);
    assert.equal(result.candidates[0].negative.test_status, 'FAILED');
    assert.equal(result.candidates[0].counterexample_detected, true);
    assert.deepEqual(context.capture.routes.map((item) => item.route), ['/probe/q1', '/probe/q2']);
    assert.equal(context.capture.modelInputs.length, 1);
    const modelInput = Object.values(context.capture.modelInputs[0]).join('\n');
    assert.match(modelInput, /HOLD-Q1/);
    assert.match(modelInput, /CASE_STEP_1/);
    assert.match(modelInput, /CASE_STEP_3/);
    assert.match(modelInput, /\/probe\/q1/);
    assert.doesNotMatch(modelInput, /\/probe\/q2|HOLD-Q2|任务类型条件被忽略|返回全部西站6条|oracle/i);
    const authorization = await context.store.getRevalidationAuthorization();
    assert.equal(authorization.used_starts, 1);
    assert.equal(authorization.max_starts, 2);
    assert.equal((await context.store.getBudget()).used_starts, 0);
  } finally {
    await context.manager.settle();
    await fs.rm(context.localRoot, { recursive: true, force: true });
  }
});

test('HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权', async () => {
  const context = await setup();
  try {
    let changedHash;
    await context.caseStore.updateProject(context.imported.project.project_id, context.imported.project.revision, (project) => {
      const version = project.cases[0].versions[0];
      version.content.title = '被改写的题目';
      changedHash = contentHash(version.content);
      version.content_sha256 = changedHash;
      return project;
    });
    await assert.rejects(() => context.manager.submitProjectCase({
      request_id: 'case-build-request-m4amismatch', project_id: context.imported.project.project_id,
      case_id: context.item.case_id, case_version: 1, content_sha256: changedHash, environment_id: 'heldout-query-q1-v1',
    }), /CASE_BUILD_ENVIRONMENT_CASE_MISMATCH/);
    assert.equal((await context.store.listTasks()).length, 0);
    assert.equal(await context.store.getRevalidationAuthorization(), null);
  } finally { await fs.rm(context.localRoot, { recursive: true, force: true }); }
});

test('M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽', async () => {
  const context = await setup();
  context.capture.failFirstNormal = true;
  try {
    const created = await context.manager.submitProjectCase({
      request_id: 'case-build-request-m4arevise01', project_id: context.imported.project.project_id,
      case_id: context.item.case_id, case_version: 1, content_sha256: context.version.content_sha256,
      environment_id: 'heldout-query-q1-v1',
    });
    await context.manager.start(created.task_id);
    const first = await context.manager.wait(created.task_id);
    assert.equal(first.task_status, 'CANDIDATE_VALIDATION_FAILED');
    assert.equal(first.revision_allowed, true);
    await context.manager.revise(created.task_id);
    const second = await context.manager.wait(created.task_id);
    assert.equal(second.task_status, 'WAITING_HUMAN_REVIEW');
    assert.equal(second.candidates.length, 2);
    assert.equal(context.capture.harnessStarts, 2);
    assert.equal((await context.store.getRevalidationAuthorization()).used_starts, 2);
    assert.match(context.capture.modelInputs[1].prompt, /Revise the failed Playwright candidate/);
    assert.doesNotMatch(context.capture.modelInputs[1].prompt, /\/probe\/q2|HOLD-Q2|返回全部西站6条/);
    await assert.rejects(() => context.manager.revise(created.task_id), /BUILD_REVISION_NOT_ALLOWED/);
  } finally {
    await context.manager.settle();
    await fs.rm(context.localRoot, { recursive: true, force: true });
  }
});
