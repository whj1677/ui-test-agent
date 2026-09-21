import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { createPaths } from '../server/paths.mjs';
import { registerReviewedProjectCaseAsset } from '../server/reviewed-asset.mjs';
import { WorkbenchStore } from '../server/store.mjs';
import { CaseLibraryStore } from '../server/cases/store.mjs';

const roots = [];
const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase();

async function fixture(options = {}) {
  const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reviewed-asset-'));
  roots.push(localRoot);
  const paths = createPaths({ localRoot });
  const store = new WorkbenchStore(paths.dataRoot);
  const caseStore = new CaseLibraryStore(paths.caseLibraryRoot);
  await Promise.all([store.init(), caseStore.init()]);

  const taskId = options.taskId || 'build-test-reviewed-asset';
  const reviewId = 'human-first-review-test';
  const attemptId = 'attempt-01-initial';
  const projectId = options.projectId || 'project-11111111-1111-4111-8111-111111111111';
  const caseId = options.caseId || 'case-22222222-2222-4222-8222-222222222222';
  const contentSha = 'A'.repeat(64);
  const candidateBytes = Buffer.from("import { test, expect } from '@playwright/test';\ntest('scoped', async ({ page }) => { await page.goto(process.env.PROBE_URL); await test.step('CASE_STEP_1', async () => { await expect(page).toHaveTitle(/探针/); }); });\n");
  const candidateSha = sha256(candidateBytes);
  const taskRoot = path.join(paths.buildTasksRoot, taskId);
  await fs.mkdir(path.join(taskRoot, 'attempts', attemptId, 'workspace', 'output'), { recursive: true });
  await fs.mkdir(path.join(taskRoot, 'reviews'), { recursive: true });
  await fs.writeFile(path.join(taskRoot, 'attempts', attemptId, 'workspace', 'output', 'candidate.spec.mjs'), candidateBytes);
  await fs.writeFile(path.join(taskRoot, 'task.json'), JSON.stringify({
    task_id: taskId,
    source: { kind: 'project-case', project_id: projectId, case_id: caseId, case_version: 1, content_sha256: contentSha, external_id: 'CASE-001' },
    candidates: [{ version: 1, attempt_id: attemptId, sha256: candidateSha, bytes: candidateBytes.length }],
  }));
  await fs.writeFile(path.join(taskRoot, 'reviews', `${reviewId}.json`), JSON.stringify({
    schema: 'workbench/human-candidate-review-v1', review_id: reviewId,
    review_type: 'HUMAN_FIRST_REVIEW', task_id: taskId, attempt_id: attemptId,
    candidate_sha256: candidateSha, decision: options.decision || 'PASSED',
    scope: '仅确认该候选符合本次两步无登录合成用例', recorded_at: '2026-09-21T00:00:00.000Z',
    does_not_establish: ['不证明复杂业务能力'],
  }));

  const projectDirectory = caseStore.projectDirectory(projectId);
  await fs.mkdir(projectDirectory, { recursive: true });
  await fs.writeFile(path.join(projectDirectory, 'project.json'), JSON.stringify({
    schema: 'workbench/case-project-v1', project_id: projectId, name: '登记测试项目', description: '', revision: 2,
    created_at: '2026-09-21T00:00:00.000Z', updated_at: '2026-09-21T00:00:00.000Z', imports: [],
    cases: [{
      case_id: caseId, external_id: 'CASE-001', title: '限定用例', module: '探针', status: 'CONFIRMED', current_version: 2,
      versions: [
        { version: 1, content_sha256: contentSha, content: { title: '限定用例', steps: [{ order: 1, action: '打开页面', expected: '标题包含探针' }] } },
        { version: 2, content_sha256: 'B'.repeat(64), content: { title: '限定用例 v2', steps: [{ order: 1, action: '打开页面', expected: '标题包含探针 v2' }] } },
      ],
    }],
  }));
  return { paths, store, caseStore, taskId, reviewId, candidateSha, projectId, caseId };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节', async () => {
  const setup = await fixture();
  const first = await registerReviewedProjectCaseAsset({
    ...setup, expectedCandidateSha256: setup.candidateSha, registeredAt: '2026-09-21T01:00:00.000Z',
  });
  const second = await registerReviewedProjectCaseAsset({
    ...setup, expectedCandidateSha256: setup.candidateSha, registeredAt: '2026-09-21T02:00:00.000Z',
  });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal((await setup.store.listAssets()).length, 1);
  assert.equal(first.asset.project_case.case_version, 1);
  assert.equal(first.asset.project_case.content_sha256, 'A'.repeat(64));
  assert.equal(first.asset.approval_status, 'HUMAN_FIRST_REVIEW_PASSED_SCOPED');
  assert.equal(first.asset.allowed_environments.length, 1);
  assert.equal(first.asset.acceptance_environments.length, 1);
  assert.equal(await fs.readFile(path.join(first.private_directory, 'candidate.spec.mjs'), 'utf8'), await fs.readFile(path.join(setup.paths.buildTasksRoot, setup.taskId, 'attempts', 'attempt-01-initial', 'workspace', 'output', 'candidate.spec.mjs'), 'utf8'));
  assert.equal((await setup.caseStore.getProject(setup.projectId)).cases[0].current_version, 2, 'v2 exists but must not replace the v1 binding');
});

test('缺少有效首审、候选哈希变化或项目关联错误均拒绝登记', async () => {
  const unreviewed = await fixture({ taskId: 'build-test-unreviewed', decision: 'PENDING' });
  await assert.rejects(registerReviewedProjectCaseAsset({ ...unreviewed, expectedCandidateSha256: unreviewed.candidateSha }), /REVIEWED_ASSET_REVIEW_NOT_PASSED/);
  assert.equal((await unreviewed.store.listAssets()).length, 0);

  const changed = await fixture({ taskId: 'build-test-changed' });
  await fs.appendFile(path.join(changed.paths.buildTasksRoot, changed.taskId, 'attempts', 'attempt-01-initial', 'workspace', 'output', 'candidate.spec.mjs'), '// changed');
  await assert.rejects(registerReviewedProjectCaseAsset({ ...changed, expectedCandidateSha256: changed.candidateSha }), /REVIEWED_ASSET_CANDIDATE_HASH_MISMATCH/);
  assert.equal((await changed.store.listAssets()).length, 0);

  const mismatched = await fixture({ taskId: 'build-test-mismatched' });
  const taskFile = path.join(mismatched.paths.buildTasksRoot, mismatched.taskId, 'task.json');
  const task = JSON.parse(await fs.readFile(taskFile, 'utf8'));
  task.source.project_id = 'project-33333333-3333-4333-8333-333333333333';
  await fs.writeFile(taskFile, JSON.stringify(task));
  await assert.rejects(registerReviewedProjectCaseAsset({ ...mismatched, expectedCandidateSha256: mismatched.candidateSha }), /REVIEWED_ASSET_PROJECT_MISSING/);
  assert.equal((await mismatched.store.listAssets()).length, 0);
});
