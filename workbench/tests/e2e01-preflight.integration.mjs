import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAdapter } from '../server/build/adapter.mjs';
import { BuildTaskManager } from '../server/build/manager.mjs';
import { E2E01_PROJECT_CASE_AUTHORIZATION_ID, BuildTaskStore } from '../server/build/store.mjs';
import { CaseLibraryManager } from '../server/cases/manager.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';
import { createPaths } from '../server/paths.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.dirname(workbenchRoot);
const localRoot = await fs.mkdtemp(path.join(workbenchRoot, '.local', 'e2e01-preflight-'));
const packagePath = path.join(workbenchRoot, 'examples', 'ui-six-cases', 'UI_TRIAL_6_CASES.workbench.json');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
process.env.WORKBENCH_TEST_SITE_BASE_URL = 'http://127.0.0.1:4320';

const smokeCandidate = `import { test, expect } from '@playwright/test';
test('isolated engineering wiring sample', async ({ page }) => {
  await test.step('CASE_STEP_1 open local page and check document response', async () => {
    const response = await page.goto(process.env.PROBE_URL);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: '设备台账' })).toBeVisible();
  });
  await test.step('CASE_STEP_2 check visible filter controls only', async () => {
    await expect(page.locator('select')).toHaveCount(3);
  });
  await test.step('CASE_STEP_3 check page remains interactive', async () => {
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible();
  });
});
`;

let keepRoot = false;
try {
  await fs.access(browserExecutable);
  const paths = createPaths({ localRoot, workbenchRoot, repoRoot });
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot); await caseStore.init();
  const caseManager = new CaseLibraryManager(caseStore);
  const project = await caseManager.createProject({ name: 'E2E-01工程预检（非产品运行）', description: '仅验证新接口、Playwright CLI 与媒体登记；不启动Harness。' });
  const uploaded = await caseManager.upload({ fileName: path.basename(packagePath), contentType: 'application/json', body: await fs.readFile(packagePath) });
  const preview = await caseManager.preview(project.project_id, { upload_id: uploaded.upload_id });
  const imported = await caseManager.confirm(project.project_id, preview.preview_id, {});
  assert.equal(imported.result.added, 6);
  const importedProject = imported.project;
  const sourceCase = importedProject.cases.find((item) => item.external_id === 'TC-001');
  const sourceVersion = sourceCase.versions.find((item) => item.version === 1);
  const store = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: E2E01_PROJECT_CASE_AUTHORIZATION_ID }); await store.init();
  const candidateAdapter = {
    ensureHarnessRuntime: async () => ({ engineering_stub: true }),
    runHarnessTask: async ({ candidatePath }) => {
      await fs.writeFile(candidatePath, smokeCandidate, { flag: 'wx' });
      return {
        assessment: { success: true, completed: true, candidateExists: true, browserToolCalls: 0, exitCode: 0, termination: null },
        process: { pid: 0, parentPid: null, exitCode: 0, signal: null, termination: null, exitObserved: true, closeObserved: true, outputComplete: true },
        events: [], candidate: { path: 'output/candidate.spec.mjs' },
      };
    },
    verifyCandidate: buildAdapter.verifyCandidate,
  };
  const manager = new BuildTaskManager({
    store, caseStore, paths, adapter: candidateAdapter, authorizationId: E2E01_PROJECT_CASE_AUTHORIZATION_ID,
    browserExecutable, useStoredDshCredentials: true,
    modelConfiguration: { provider: 'engineering-stub', model: null, credential_source: 'none', dsh_version: 'not_started' },
  });
  const task = await manager.submitProjectCase({
    request_id: 'case-build-request-e2e01preflight00', project_id: project.project_id,
    case_id: sourceCase.case_id, case_version: 1, content_sha256: sourceVersion.content_sha256,
    environment_id: 'test-site-01-query-v1',
  });
  assert.equal(task.task_status, 'SUBMITTED');
  assert.equal(task.input_bundle.snapshot.environment_ref.allowed_entry.route, '/ui/a');
  assert.equal(JSON.stringify(task.input_bundle).includes('/ui/b'), false, 'Fault route must stay out of the frozen builder input.');
  assert.equal(JSON.stringify(task.input_bundle).includes('320 kW'), false, 'Fault output must stay out of the frozen builder input.');
  await manager.start(task.task_id);
  await manager.wait(task.task_id);
  const generated = await store.getTask(task.task_id);
  if (!generated.candidates[0]?.trial_runs?.length) console.log(JSON.stringify({ task_status: generated.task_status, error: generated.error, attempt: generated.attempts.at(-1), candidate: generated.candidates[0] }, null, 2));
  assert.equal(generated.candidates.length, 1);
  assert.equal(generated.candidates[0].sha256, generated.candidates[0].trial_runs[0].candidate_sha256);
  assert.equal(generated.candidates[0].trial_runs[0].status, 'PASSED');
  assert.equal(generated.task_status, 'WAITING_E2E_TRIALS');
  const pair = generated.trial_binding.paired;
  const counter = await manager.runProjectCaseTrial(task.task_id, {
    candidate_version: generated.candidates[0].version, candidate_sha256: generated.candidates[0].sha256,
    executed_external_id: pair.external_id, case_id: pair.case_id, case_version: pair.case_version,
    content_sha256: pair.content_sha256,
  });
  assert.equal(counter.candidates[0].trial_runs.length, 2);
  assert.notEqual(counter.candidates[0].trial_runs[0].run_id, counter.candidates[0].trial_runs[1].run_id);
  assert.equal(counter.candidates[0].trial_runs[0].candidate_sha256, counter.candidates[0].trial_runs[1].candidate_sha256);
  assert.equal(counter.candidates[0].trial_runs[1].specified_defect_detected, false);
  for (const run of counter.candidates[0].trial_runs) {
    const media = counter.files.filter((file) => run.media_file_ids.includes(file.file_id));
    assert.equal(media.length, 3);
    assert.ok(media.some((file) => file.kind.endsWith('_screenshot')));
    assert.ok(media.some((file) => file.kind.endsWith('_video')));
    assert.ok(media.some((file) => file.kind.endsWith('_trace')));
  }
  const restartedStore = new BuildTaskStore(paths.buildTasksRoot, { authorizationId: E2E01_PROJECT_CASE_AUTHORIZATION_ID }); await restartedStore.init();
  const readback = await restartedStore.getTask(task.task_id);
  assert.equal(readback.candidates[0].trial_runs.length, 2);
  assert.equal(readback.attempts.length, 1, 'Pair execution is zero-model and must not create a Harness attempt.');
  console.log(JSON.stringify({
    status: 'ENGINEERING_PREFLIGHT_ONLY', model_calls: 0, harness_starts: 0, playwright_runs: 2,
    task_id: task.task_id, raw_results: readback.candidates[0].trial_runs.map((run) => ({ external_id: run.executed_external_id, status: run.status, step_coverage: run.step_coverage.complete, media_count: run.media_file_ids.length, defect_detected: run.specified_defect_detected })),
  }, null, 2));
} finally {
  if (!keepRoot) await fs.rm(localRoot, { recursive: true, force: true });
}
