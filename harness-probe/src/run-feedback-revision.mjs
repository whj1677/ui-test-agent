import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runHarnessTask, ROOT } from './harness-runner.mjs';
import { startFixtureServer } from './fixture-server.mjs';
import { verifyCandidate } from './verify-candidate.mjs';
import { classifyWorkspaceFiles } from './feedback-policy.mjs';

const EXPECTED = 'PROBE-42';
const COUNTEREXAMPLE = 'PROBE-41';
const MAX_TOOL_CALLS = 30;
const TIMEOUT_MS = 600_000;
const ORIGINAL_CANDIDATE_SHA256 = 'C4C68178C3F79D60B06E8968AE962865A0A6D56A5AD18E12055AB94980C8C600';

const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase();

async function fileHash(filePath) {
  return sha256(await readFile(filePath));
}

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

function usageFromEvents(events) {
  const totals = {};
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'number' && /^(input_tokens|output_tokens|cache_read_tokens|total_tokens)$/.test(key)) {
        totals[key] = Math.max(totals[key] ?? 0, child);
      } else visit(child);
    }
  };
  for (const event of events) visit(event);
  return Object.keys(totals).length ? totals : null;
}

async function rawReportFacts(reportPath) {
  try {
    const text = await readFile(reportPath, 'utf8');
    return {
      expectedPresent: text.includes(EXPECTED),
      counterexamplePresent: text.includes(COUNTEREXAMPLE),
    };
  } catch {
    return { expectedPresent: false, counterexamplePresent: false };
  }
}

async function claimOnlyAttempt(markerPath, runId) {
  await mkdir(path.dirname(markerPath), { recursive: true });
  let handle;
  try {
    handle = await open(markerPath, 'wx');
    await handle.writeFile(JSON.stringify({ runId, startedAt: new Date().toISOString(), maxAttempts: 1 }, null, 2));
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('M2-B feedback revision Harness attempt was already started');
    throw error;
  } finally {
    await handle?.close();
  }
}

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = process.env.DEEPSEEK_BASE_URL;
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
if (!apiKey || !baseUrl || !browserExecutable) {
  throw new Error('DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL and DSH_PROBE_BROWSER_EXECUTABLE are required');
}

const runId = `feedback-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const localRoot = path.join(ROOT, '.local');
const taskRoot = path.join(localRoot, 'feedback-revisions', runId);
const workspace = path.join(taskRoot, 'workspace');
const inputDirectory = path.join(workspace, 'input');
const outputDirectory = path.join(workspace, 'output');
const runDirectory = path.join(taskRoot, 'verification');
const candidatePath = path.join(outputDirectory, 'revised-candidate.spec.mjs');
const originalCandidate = path.join(ROOT, 'evidence', 'attempt-2-candidate.spec.mjs');
const copiedCandidate = path.join(inputDirectory, 'attempt-2-candidate.spec.mjs');
const attemptMarker = path.join(localRoot, 'feedback-revisions', '.harness-started.json');

await mkdir(inputDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });
if (await fileHash(originalCandidate) !== ORIGINAL_CANDIDATE_SHA256) throw new Error('M2-A second candidate hash mismatch');
await copyFile(originalCandidate, copiedCandidate);

const taskDocument = [
  '# Original probe task',
  '',
  'Use the Playwright browser tool to open the supplied local probe URL.',
  'Click the button labelled “执行探针交互”.',
  `The required expected result is supplied by the task: ${EXPECTED}.`,
  'Create one Playwright Test candidate that navigates to process.env.PROBE_URL, performs the same click, and asserts that the visible output equals the literal expected value.',
  'Do not derive or change the expected value from the page.',
].join('\n');
const feedback = {
  sourceRun: 'probe-2026-09-21T01-29-47-892Z-8fbcbdbb',
  candidateSha256: ORIGINAL_CANDIDATE_SHA256,
  actualExecution: {
    exitCode: 1,
    testCount: 1,
    passed: 0,
    failed: 1,
    error: `expect(locator('status')).toHaveText('${EXPECTED}') timed out after 5000ms because locator('status') resolved to 0 elements`,
  },
};
await writeFile(path.join(workspace, 'task.md'), taskDocument);
await writeFile(path.join(workspace, 'feedback.json'), JSON.stringify(feedback, null, 2));
const inputHashesBefore = {
  task: await fileHash(path.join(workspace, 'task.md')),
  feedback: await fileHash(path.join(workspace, 'feedback.json')),
  failedCandidate: await fileHash(copiedCandidate),
};

const normalServer = await startFixtureServer(path.join(ROOT, 'fixture', 'index.html'));
const startedAt = new Date().toISOString();
let negativeServer;
try {
  const prompt = [
    'Revise one failed Playwright candidate in this dedicated single-task workspace.',
    `Use the Playwright MCP browser tools to open exactly ${normalServer.url} and perform the interaction described in task.md.`,
    'Read only task.md, feedback.json, and input/attempt-2-candidate.spec.mjs as task inputs.',
    'Preserve the original interaction and literal PROBE-42 expectation. Fix only the technical locator problem evidenced by the failed execution.',
    `Write exactly one revised candidate to ${candidatePath}.`,
    'The candidate must use process.env.PROBE_URL. Do not delete the assertion, swallow errors, skip the test, or add unrelated business actions.',
    'Do not inspect parent directories, other repository files, accounts, external sites, or company systems. Do not create other files.',
  ].join('\n');

  await claimOnlyAttempt(attemptMarker, runId);
  const harness = await runHarnessTask({
    task: prompt,
    workspace,
    dshHome: path.join(localRoot, 'dsh'),
    patchPath: path.join(ROOT, 'config', 'browser.cordis.yml'),
    candidatePath,
    browserExecutable,
    apiKey,
    baseUrl,
    timeoutMs: TIMEOUT_MS,
    maxToolCalls: MAX_TOOL_CALLS,
  });

  const filesAfterHarness = await listFiles(workspace);
  const fileClassification = classifyWorkspaceFiles(filesAfterHarness);
  const registeredOutputOnly = fileClassification.accepted;
  const inputHashesAfter = {
    task: await fileHash(path.join(workspace, 'task.md')),
    feedback: await fileHash(path.join(workspace, 'feedback.json')),
    failedCandidate: await fileHash(copiedCandidate),
  };
  const inputsUnchanged = JSON.stringify(inputHashesBefore) === JSON.stringify(inputHashesAfter);

  let candidateHashBefore = null;
  let normal = null;
  let negative = null;
  let candidateHashAfterNormal = null;
  let candidateHashAfterNegative = null;
  if (harness.assessment.success && registeredOutputOnly && inputsUnchanged) {
    candidateHashBefore = await fileHash(candidatePath);
    normal = await verifyCandidate({
      candidatePath,
      browserExecutable,
      fixtureUrl: normalServer.url,
      runDirectory: path.join(runDirectory, 'normal'),
    });
    candidateHashAfterNormal = await fileHash(candidatePath);
    await normalServer.close();
    negativeServer = await startFixtureServer(path.join(ROOT, 'fixture', 'wrong-output.html'));
    negative = await verifyCandidate({
      candidatePath,
      browserExecutable,
      fixtureUrl: negativeServer.url,
      runDirectory: path.join(runDirectory, 'negative'),
    });
    candidateHashAfterNegative = await fileHash(candidatePath);
  }

  const negativeFacts = negative ? await rawReportFacts(negative.reportPath) : null;
  const sameCandidate = Boolean(candidateHashBefore) && candidateHashBefore === candidateHashAfterNormal && candidateHashBefore === candidateHashAfterNegative;
  const negativeDetected = Boolean(negative) && negative.process.exitCode !== 0 &&
    negative.report.testCount === 1 && negative.report.failed === 1 &&
    negativeFacts.expectedPresent && negativeFacts.counterexamplePresent;
  const success = harness.assessment.success && registeredOutputOnly && inputsUnchanged &&
    normal?.success === true && negativeDetected && sameCandidate;
  const result = {
    schema: 'm2b-feedback-revision-result-v1',
    runId,
    startedAt,
    endedAt: new Date().toISOString(),
    policy: {
      mode: 'single-host-dedicated-task-directory-with-minimum-exposure',
      osFileIsolation: false,
      osNetworkIsolation: false,
      residualRiskAcceptedByUser: true,
      maxHarnessStarts: 1,
      timeoutMs: TIMEOUT_MS,
      maxToolCalls: MAX_TOOL_CALLS,
      modelRetryPluginDisabled: true,
    },
    tool: 'DeepSeek Harness dsh',
    harnessVersion: '0.1.6-alpha.2',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    harness: {
      assessment: harness.assessment,
      candidate: harness.candidate,
      usage: usageFromEvents(harness.events),
      observableAgentSteps: harness.events.filter((event) => event.type === 'status' && event.phase === 'step_end').length,
      browserToolCalls: harness.events.filter((event) => event.type === 'tool_call' && /^mcp__playwright-mcp__/.test(event.tool ?? '')).length,
    },
    workspace: { filesAfterHarness, fileClassification, registeredOutputOnly, inputsUnchanged },
    candidate: { sha256: candidateHashBefore, sameForNormalAndNegative: sameCandidate },
    normal: normal && { processExitCode: normal.process.exitCode, ...normal.report, success: normal.success },
    negative: negative && { processExitCode: negative.process.exitCode, ...negative.report, expectedAndActualPresent: negativeFacts, detected: negativeDetected },
    success,
  };
  await writeFile(path.join(taskRoot, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    runId,
    success,
    harness: result.harness,
    workspace: result.workspace,
    candidate: result.candidate,
    normal: result.normal,
    negative: result.negative,
    localResult: path.relative(ROOT, path.join(taskRoot, 'result.json')).replaceAll('\\', '/'),
  }, null, 2));
  process.exitCode = success ? 0 : 1;
} finally {
  await normalServer.close().catch(() => {});
  await negativeServer?.close().catch(() => {});
}
