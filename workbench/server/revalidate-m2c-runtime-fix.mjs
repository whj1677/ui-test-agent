import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { verifyWorkbenchCandidate } from './build/adapter.mjs';
import { counterexampleDetected, parseCandidateReport } from './build/report.mjs';
import { loadBuildTemplate } from './build/template.mjs';
import { createPaths } from './paths.mjs';
import { sha256File } from './integrity.mjs';
import { startFixtureServer } from '../../harness-probe/src/fixture-server.mjs';

const TASK_ID = 'build-20260921060716-ae44c3f2';
const CANDIDATE_SHA256 = '119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A';
const VALIDATION_ID = 'candidate-runtime-fix-20260921';
const ORIGINAL_NORMAL_SHA256 = '4E7D066FC8AED04F7D35A6910824192B0D31BF9CD426DAFBBF37E8DEB81778C4';
const ORIGINAL_NEGATIVE_SHA256 = '5A23FBE5EF4F1132BF95E989EF7743C1E105B4465448D23533E0975805F290FA';
const localRoot = path.resolve(process.env.M2C_ACCEPTANCE_ROOT || path.join(process.cwd(), '.local', 'm2c-acceptance'));
const paths = createPaths({ localRoot });
const taskRoot = path.join(paths.buildTasksRoot, TASK_ID);
const candidateSource = path.join(taskRoot, 'attempts', 'attempt-01-initial', 'workspace', 'output', 'candidate.spec.mjs');
const originalNormal = path.join(taskRoot, 'attempts', 'attempt-01-initial', 'verification', 'normal', 'playwright-report.json');
const originalNegative = path.join(taskRoot, 'attempts', 'attempt-01-initial', 'verification', 'negative', 'playwright-report.json');
const validationRoot = path.join(localRoot, 'candidate-revalidations', VALIDATION_ID);
const candidateCopy = path.join(validationRoot, 'input', 'candidate.spec.mjs');
const recordFile = path.join(validationRoot, 'revalidation.json');
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function repoRelative(value) {
  const relative = path.relative(paths.repoRoot, value).replaceAll('\\', '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return '<outside-repository>';
  return `<repo>/${relative}`;
}

function runtimeFacts(runtime) {
  return {
    runtime_root: repoRelative(runtime.runtime_root),
    cli_path: repoRelative(runtime.cli_path),
    config_path: repoRelative(runtime.config_path),
    cli_test: { package_path: repoRelative(runtime.cli_test.package_path), version: runtime.cli_test.version },
    config_test: { package_path: repoRelative(runtime.config_test.package_path), version: runtime.config_test.version },
    candidate_test: { package_path: repoRelative(runtime.candidate_test.package_path), version: runtime.candidate_test.version },
    cli_playwright: { package_path: repoRelative(runtime.cli_playwright.package_path), version: runtime.cli_playwright.version },
    config_playwright: { package_path: repoRelative(runtime.config_playwright.package_path), version: runtime.config_playwright.version },
    candidate_playwright: { package_path: repoRelative(runtime.candidate_playwright.package_path), version: runtime.candidate_playwright.version },
    consistent: runtime.consistent,
  };
}

async function fileIndex(root) {
  const output = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else output.push({
        relative_path: path.relative(root, absolute).replaceAll('\\', '/'),
        bytes: (await fs.stat(absolute)).size,
        sha256: await sha256File(absolute),
      });
    }
  }
  await visit(root);
  return output;
}

function mediaSummary(files) {
  return {
    screenshot: files.filter((item) => item.relative_path.endsWith('.png')).length,
    video: files.filter((item) => item.relative_path.endsWith('.webm')).length,
    trace: files.filter((item) => item.relative_path.endsWith('.zip')).length,
  };
}

await fs.access(browserExecutable);
assert.equal(await sha256File(candidateSource), CANDIDATE_SHA256, 'existing candidate hash changed');
assert.equal(await sha256File(originalNormal), ORIGINAL_NORMAL_SHA256, 'original normal report changed');
assert.equal(await sha256File(originalNegative), ORIGINAL_NEGATIVE_SHA256, 'original negative report changed');
const task = JSON.parse(await fs.readFile(path.join(taskRoot, 'task.json'), 'utf8'));
assert.equal(task.task_id, TASK_ID);
assert.equal(task.task_status, 'CANDIDATE_VALIDATION_FAILED');
assert.equal(task.candidates?.[0]?.sha256, CANDIDATE_SHA256);
try {
  await fs.access(validationRoot);
  throw new Error('CANDIDATE_REVALIDATION_ALREADY_EXISTS');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await fs.mkdir(path.dirname(candidateCopy), { recursive: true });
await fs.copyFile(candidateSource, candidateCopy);
assert.equal(await sha256File(candidateCopy), CANDIDATE_SHA256);
const template = await loadBuildTemplate(paths);
let normalServer;
let negativeServer;
const startedAt = new Date().toISOString();
try {
  normalServer = await startFixtureServer(template.internal.normalFixture);
  const normalRaw = await verifyWorkbenchCandidate({
    candidatePath: candidateCopy,
    browserExecutable,
    fixtureUrl: normalServer.url,
    runDirectory: path.join(validationRoot, 'normal'),
  });
  const normal = await parseCandidateReport(normalRaw.reportPath, normalRaw.process);
  await normalServer.close();
  normalServer = null;

  negativeServer = await startFixtureServer(template.internal.negativeFixture);
  const negativeRaw = await verifyWorkbenchCandidate({
    candidatePath: candidateCopy,
    browserExecutable,
    fixtureUrl: negativeServer.url,
    runDirectory: path.join(validationRoot, 'negative'),
  });
  const negative = await parseCandidateReport(negativeRaw.reportPath, negativeRaw.process);
  await negativeServer.close();
  negativeServer = null;

  const candidateAfter = await sha256File(candidateCopy);
  const sourceAfter = await sha256File(candidateSource);
  const normalFiles = await fileIndex(path.join(validationRoot, 'normal'));
  const negativeFiles = await fileIndex(path.join(validationRoot, 'negative'));
  const normalMedia = mediaSummary(normalFiles);
  const negativeMedia = mediaSummary(negativeFiles);
  const specifiedMismatch = counterexampleDetected(negative, task.template.expected, template.internal.counterexampleActual);
  const complete = normal.complete_pass && specifiedMismatch && candidateAfter === CANDIDATE_SHA256 && sourceAfter === CANDIDATE_SHA256 &&
    Object.values(normalMedia).every((count) => count > 0) && Object.values(negativeMedia).every((count) => count > 0);
  const record = {
    schema: 'workbench/existing-candidate-revalidation-v1',
    validation_id: VALIDATION_ID,
    source_task_id: TASK_ID,
    source_attempt_id: 'attempt-01-initial',
    source_candidate_version: 1,
    candidate_sha256: CANDIDATE_SHA256,
    candidate_source_unchanged: sourceAfter === CANDIDATE_SHA256,
    candidate_copy_unchanged: candidateAfter === CANDIDATE_SHA256,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    harness_started: false,
    model_called: false,
    status: complete ? 'TECHNICAL_REVALIDATION_PASSED' : 'TECHNICAL_REVALIDATION_FAILED',
    runtime: runtimeFacts(normalRaw.runtime),
    normal: { ...normal, process: { exit_code: normalRaw.process.exitCode, termination: normalRaw.process.termination }, media: normalMedia, files: normalFiles },
    negative: { ...negative, process: { exit_code: negativeRaw.process.exitCode, termination: negativeRaw.process.termination }, specified_mismatch: specifiedMismatch, media: negativeMedia, files: negativeFiles },
    original_reports: {
      normal_sha256_before: ORIGINAL_NORMAL_SHA256,
      normal_sha256_after: await sha256File(originalNormal),
      negative_sha256_before: ORIGINAL_NEGATIVE_SHA256,
      negative_sha256_after: await sha256File(originalNegative),
    },
    web_visibility: {
      original_task_and_candidate_visible: true,
      offline_revalidation_visible: false,
      media_visible: false,
    },
  };
  await fs.writeFile(recordFile, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({
    validation_id: VALIDATION_ID,
    task_id: TASK_ID,
    status: record.status,
    candidate_sha256: CANDIDATE_SHA256,
    normal: { test_status: normal.test_status, test_count: normal.test_count, media: normalMedia },
    negative: { test_status: negative.test_status, test_count: negative.test_count, expected: negative.error?.expected, actual: negative.error?.actual, media: negativeMedia },
    record: recordFile,
  }));
  if (!complete) process.exitCode = 2;
} finally {
  await normalServer?.close().catch(() => {});
  await negativeServer?.close().catch(() => {});
}
