import { createHash } from 'node:crypto';
import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './harness-runner.mjs';
import { startFixtureServer } from './fixture-server.mjs';
import { verifyCandidate } from './verify-candidate.mjs';
import { classifyWorkspaceFiles } from './feedback-policy.mjs';

const EXPECTED = 'PROBE-42';
const COUNTEREXAMPLE = 'PROBE-41';
const ORIGINAL_CANDIDATE_SHA256 = 'C4C68178C3F79D60B06E8968AE962865A0A6D56A5AD18E12055AB94980C8C600';
const runId = process.env.M2B_FEEDBACK_RUN_ID;
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
if (!runId || !browserExecutable) throw new Error('M2B_FEEDBACK_RUN_ID and DSH_PROBE_BROWSER_EXECUTABLE are required');

const taskRoot = path.join(ROOT, '.local', 'feedback-revisions', runId);
const workspace = path.join(taskRoot, 'workspace');
const candidatePath = path.join(workspace, 'output', 'revised-candidate.spec.mjs');
const historicalResultPath = path.join(taskRoot, 'result.json');
const verificationDirectory = path.join(taskRoot, 'verification-resume');
const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase();
const fileHash = async (filePath) => sha256(await readFile(filePath));

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else files.push(relative.replaceAll('\\', '/'));
  }
  return files.sort();
}

async function reportContains(reportPath) {
  try {
    const text = await readFile(reportPath, 'utf8');
    return { expected: text.includes(EXPECTED), actual: text.includes(COUNTEREXAMPLE) };
  } catch {
    return { expected: false, actual: false };
  }
}

const historicalResult = JSON.parse(await readFile(historicalResultPath, 'utf8'));
if (historicalResult.runId !== runId || historicalResult.harness?.assessment?.success !== true) {
  throw new Error('historical Harness run is not eligible for offline candidate verification');
}
const candidateHashBefore = await fileHash(candidatePath);
if (candidateHashBefore !== historicalResult.harness.candidate.sha256) throw new Error('revised candidate changed after Harness run');
if (await fileHash(path.join(workspace, 'input', 'attempt-2-candidate.spec.mjs')) !== ORIGINAL_CANDIDATE_SHA256) {
  throw new Error('copied M2-A failed candidate changed');
}
const classification = classifyWorkspaceFiles(await listFiles(workspace));
if (!classification.accepted) throw new Error(`workspace contains unexpected files: ${classification.unexpected.join(', ')}`);

const normalServer = await startFixtureServer(path.join(ROOT, 'fixture', 'index.html'));
let negativeServer;
try {
  const normal = await verifyCandidate({
    candidatePath,
    browserExecutable,
    fixtureUrl: normalServer.url,
    runDirectory: path.join(verificationDirectory, 'normal'),
  });
  const candidateHashAfterNormal = await fileHash(candidatePath);
  await normalServer.close();
  negativeServer = await startFixtureServer(path.join(ROOT, 'fixture', 'wrong-output.html'));
  const negative = await verifyCandidate({
    candidatePath,
    browserExecutable,
    fixtureUrl: negativeServer.url,
    runDirectory: path.join(verificationDirectory, 'negative'),
  });
  const candidateHashAfterNegative = await fileHash(candidatePath);
  const negativeText = await reportContains(negative.reportPath);
  const sameCandidate = candidateHashBefore === candidateHashAfterNormal && candidateHashBefore === candidateHashAfterNegative;
  const negativeDetected = negative.process.exitCode !== 0 && negative.report.testCount === 1 &&
    negative.report.failed === 1 && negativeText.expected && negativeText.actual;
  const success = normal.success && negativeDetected && sameCandidate;
  const result = {
    schema: 'm2b-feedback-candidate-verification-v1',
    runId,
    historicalResultPreserved: true,
    adapterCorrection: 'Register .playwright-mcp/* as tool-owned evidence rather than unexpected candidate output.',
    workspace: classification,
    candidate: { sha256: candidateHashBefore, sameForNormalAndNegative: sameCandidate },
    normal: { processExitCode: normal.process.exitCode, ...normal.report, success: normal.success },
    negative: {
      processExitCode: negative.process.exitCode,
      ...negative.report,
      expectedAndActualPresent: negativeText,
      detected: negativeDetected,
    },
    candidateProcessReceivedModelCredentials: false,
    success,
  };
  await writeFile(path.join(taskRoot, 'verification-result.json'), JSON.stringify(result, null, 2));
  if (success) await copyFile(candidatePath, path.join(ROOT, 'evidence', 'm2b-revised-candidate.spec.mjs'));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = success ? 0 : 1;
} finally {
  await normalServer.close().catch(() => {});
  await negativeServer?.close().catch(() => {});
}
