import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256File } from './integrity.mjs';

export const REVIEWED_CANDIDATE_SHA256 = '4B183AD25305913547C309A86F273DAAB861004313385A5DEF3094385F3B0730';
export const REVIEWED_SOURCE_TASK_ID = 'build-20260921120911-48d7c545';
export const REVIEWED_REVIEW_ID = 'human-first-review-20260921';

function assertEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(code);
}

async function readJson(file, code) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { throw new Error(code); }
}

async function fileFact(file) {
  const stat = await fs.stat(file);
  return { sha256: await sha256File(file), bytes: stat.size };
}

async function verifyManagedCopies(directory, asset) {
  const script = path.join(directory, asset.script.relative_path);
  const review = path.join(directory, asset.review_basis.relative_path);
  const [scriptFact, reviewFact] = await Promise.all([fileFact(script), fileFact(review)]);
  assertEqual(scriptFact.sha256, asset.script.sha256, 'REVIEWED_ASSET_SCRIPT_COPY_CHANGED');
  assertEqual(scriptFact.bytes, asset.script.bytes, 'REVIEWED_ASSET_SCRIPT_COPY_CHANGED');
  assertEqual(reviewFact.sha256, asset.review_basis.sha256, 'REVIEWED_ASSET_REVIEW_COPY_CHANGED');
  assertEqual(reviewFact.bytes, asset.review_basis.bytes, 'REVIEWED_ASSET_REVIEW_COPY_CHANGED');
}

export async function registerReviewedProjectCaseAsset({
  store, paths, caseStore, taskId = REVIEWED_SOURCE_TASK_ID,
  reviewId = REVIEWED_REVIEW_ID, expectedCandidateSha256 = REVIEWED_CANDIDATE_SHA256,
  registeredAt = new Date().toISOString(),
}) {
  if (!/^build-[a-z0-9-]{8,100}$/.test(taskId || '')) throw new Error('REVIEWED_ASSET_TASK_ID_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{7,100}$/.test(reviewId || '')) throw new Error('REVIEWED_ASSET_REVIEW_ID_INVALID');
  if (!/^[A-F0-9]{64}$/.test(expectedCandidateSha256 || '')) throw new Error('REVIEWED_ASSET_CANDIDATE_HASH_INVALID');
  const taskRoot = path.join(paths.buildTasksRoot, taskId);
  const task = await readJson(path.join(taskRoot, 'task.json'), 'REVIEWED_ASSET_SOURCE_TASK_MISSING');
  assertEqual(task.task_id, taskId, 'REVIEWED_ASSET_TASK_ID_MISMATCH');
  if (task.source?.kind !== 'project-case') throw new Error('REVIEWED_ASSET_SOURCE_NOT_PROJECT_CASE');

  const reviewPath = path.join(taskRoot, 'reviews', `${reviewId}.json`);
  const review = await readJson(reviewPath, 'REVIEWED_ASSET_REVIEW_MISSING');
  assertEqual(review.schema, 'workbench/human-candidate-review-v1', 'REVIEWED_ASSET_REVIEW_INVALID');
  assertEqual(review.review_id, reviewId, 'REVIEWED_ASSET_REVIEW_ID_MISMATCH');
  assertEqual(review.decision, 'PASSED', 'REVIEWED_ASSET_REVIEW_NOT_PASSED');
  assertEqual(review.review_type, 'HUMAN_FIRST_REVIEW', 'REVIEWED_ASSET_REVIEW_INVALID');
  assertEqual(review.task_id, taskId, 'REVIEWED_ASSET_REVIEW_TASK_MISMATCH');
  assertEqual(review.candidate_sha256, expectedCandidateSha256, 'REVIEWED_ASSET_REVIEW_HASH_MISMATCH');
  if (review.scope !== '仅确认该候选符合本次两步无登录合成用例') throw new Error('REVIEWED_ASSET_SCOPE_MISMATCH');

  const candidate = task.candidates?.find((item) => item.sha256 === expectedCandidateSha256 && item.attempt_id === review.attempt_id);
  if (!candidate) throw new Error('REVIEWED_ASSET_CANDIDATE_LINK_MISMATCH');
  if (!Number.isInteger(candidate.version) || candidate.version < 1) throw new Error('REVIEWED_ASSET_CANDIDATE_VERSION_INVALID');
  const candidatePath = path.join(taskRoot, 'attempts', review.attempt_id, 'workspace', 'output', 'candidate.spec.mjs');
  const [candidateFact, reviewFact] = await Promise.all([fileFact(candidatePath), fileFact(reviewPath)]);
  assertEqual(candidateFact.sha256, expectedCandidateSha256, 'REVIEWED_ASSET_CANDIDATE_HASH_MISMATCH');
  assertEqual(candidate.bytes, candidateFact.bytes, 'REVIEWED_ASSET_CANDIDATE_SIZE_MISMATCH');

  const project = await caseStore.getProject(task.source.project_id);
  if (!project) throw new Error('REVIEWED_ASSET_PROJECT_MISSING');
  const caseItem = project.cases.find((item) => item.case_id === task.source.case_id);
  if (!caseItem) throw new Error('REVIEWED_ASSET_CASE_MISSING');
  const caseVersion = caseItem.versions.find((item) => item.version === task.source.case_version);
  if (!caseVersion) throw new Error('REVIEWED_ASSET_CASE_VERSION_MISSING');
  assertEqual(caseVersion.content_sha256, task.source.content_sha256, 'REVIEWED_ASSET_CASE_HASH_MISMATCH');
  const steps = caseVersion.content.steps.map((step) => ({
    step_id: `CASE_STEP_${step.order}`, action: step.action, expected: step.expected,
  }));
  if (!steps.length || steps.some((step) => !step.action || !step.expected)) throw new Error('REVIEWED_ASSET_CASE_STEPS_INVALID');

  const normalFixture = path.join(paths.repoRoot, 'harness-probe', 'fixture', 'index.html');
  const counterexampleFixture = path.join(paths.repoRoot, 'harness-probe', 'fixture', 'wrong-output.html');
  const configPath = path.join(paths.workbenchRoot, 'config', 'candidate.playwright.config.mjs');
  const lockPath = path.join(paths.workbenchRoot, 'package-lock.json');
  const packagePath = path.join(paths.workbenchRoot, 'node_modules', '@playwright', 'test', 'package.json');
  const [normalSha, counterexampleSha, configSha, lockSha, installedPackage] = await Promise.all([
    sha256File(normalFixture), sha256File(counterexampleFixture), sha256File(configPath), sha256File(lockPath),
    readJson(packagePath, 'REVIEWED_ASSET_PLAYWRIGHT_NOT_INSTALLED'),
  ]);
  assertEqual(installedPackage.version, '1.62.1', 'REVIEWED_ASSET_PLAYWRIGHT_VERSION_MISMATCH');

  const suffix = expectedCandidateSha256.slice(0, 12).toLowerCase();
  const assetId = `reviewed-project-case-${suffix}`;
  const version = `reviewed-v1-${suffix}`;
  const asset = {
    schema: 'approved-workbench/asset-v2',
    asset_id: assetId,
    asset_kind: 'HUMAN_REVIEWED_PROJECT_CASE',
    case_id: task.source.external_id,
    case_version: `project-case-v${task.source.case_version}`,
    title: `${task.source.external_id} · ${caseVersion.content.title}`,
    version,
    source_commit: null,
    approval_status: 'HUMAN_FIRST_REVIEW_PASSED_SCOPED',
    scope: review.scope,
    limitations: structuredClone(review.does_not_establish || []),
    registered_at: registeredAt,
    project_case: {
      project_id: task.source.project_id, case_id: task.source.case_id,
      case_version: task.source.case_version, content_sha256: task.source.content_sha256,
      external_id: task.source.external_id,
    },
    source_build: {
      task_id: task.task_id, attempt_id: review.attempt_id,
      candidate_version: candidate.version, candidate_sha256: candidate.sha256,
    },
    script: {
      storage: 'managed_asset', relative_path: 'candidate.spec.mjs', file_name: 'candidate.spec.mjs',
      sha256: candidateFact.sha256, bytes: candidateFact.bytes,
    },
    review_basis: {
      storage: 'managed_asset', relative_path: 'human-review.json', file_name: 'human-review.json',
      review_id: review.review_id, decision: review.decision, recorded_at: review.recorded_at,
      sha256: reviewFact.sha256, bytes: reviewFact.bytes,
      note: '承接用户已作出的限定人工首审结论；未由Codex补签。',
    },
    configuration: {
      source: 'workbench/config/candidate.playwright.config.mjs', sha256: configSha,
      summary: {
        browser: 'chromium', locale: 'zh-CN', viewport: { width: 1280, height: 720 },
        timeout_ms: 30000, expect_timeout_ms: 5000, workers: 1, retries: 0,
        trace: 'on', screenshot: 'on', video: 'on', browser_executable_env: 'DSH_PROBE_BROWSER_EXECUTABLE',
      },
    },
    dependency_lock: {
      path: 'workbench/package-lock.json', sha256: lockSha,
      playwright_test: installedPackage.version, playwright: installedPackage.version,
    },
    execution: { entry_url_environment_variable: 'PROBE_URL', test_file_name: 'candidate.spec.mjs' },
    allowed_environments: [{
      id: 'normal', label: '正常合成入口', case_id: task.source.external_id,
      fixture: { path: 'harness-probe/fixture/index.html', sha256: normalSha }, steps,
    }],
    acceptance_environments: [{
      id: 'counterexample', label: '独立错误输出反例（仅验收）', case_id: task.source.external_id,
      fixture: { path: 'harness-probe/fixture/wrong-output.html', sha256: counterexampleSha }, steps,
    }],
  };

  const existing = await store.getAsset(assetId);
  if (existing) {
    const directory = store.assetVersionDirectory(assetId, version);
    await verifyManagedCopies(directory, existing);
    const registered = await store.registerAsset(asset);
    return { ...registered, private_directory: directory };
  }

  const directory = store.assetVersionDirectory(assetId, version);
  const temporary = `${directory}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(temporary, { recursive: true });
  try {
    await Promise.all([
      fs.copyFile(candidatePath, path.join(temporary, asset.script.relative_path)),
      fs.copyFile(reviewPath, path.join(temporary, asset.review_basis.relative_path)),
    ]);
    await verifyManagedCopies(temporary, asset);
    await fs.mkdir(path.dirname(directory), { recursive: true });
    await fs.rename(temporary, directory);
    try {
      const registered = await store.registerAsset(asset);
      return { ...registered, private_directory: directory };
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}
