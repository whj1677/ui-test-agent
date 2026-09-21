import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runHarnessTask, ROOT } from './harness-runner.mjs';
import { startFixtureServer } from './fixture-server.mjs';
import { verifyCandidate } from './verify-candidate.mjs';

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = process.env.DEEPSEEK_BASE_URL;
const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
if (!apiKey || !baseUrl || !browserExecutable) {
  throw new Error('DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL and DSH_PROBE_BROWSER_EXECUTABLE are required');
}
const runId = `probe-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const localRoot = path.join(ROOT, '.local');
const workspace = path.join(localRoot, 'workspace', runId);
const outputDirectory = path.join(workspace, 'output');
const runDirectory = path.join(localRoot, 'runs', runId);
const candidatePath = path.join(outputDirectory, 'candidate.spec.mjs');
await mkdir(outputDirectory, { recursive: true });
await mkdir(runDirectory, { recursive: true });
const server = await startFixtureServer(path.join(ROOT, 'fixture', 'index.html'));
const startedAt = new Date().toISOString();
try {
  const task = [
    'You are running a bounded toolchain feasibility probe in an isolated workspace.',
    `Use the Playwright MCP browser tools to open exactly ${server.url}.`,
    'Click the button labelled “执行探针交互” and observe the visible result.',
    'The required expected result is supplied by this task: PROBE-42. Do not derive or change the expected value from page source.',
    `Then create exactly one Playwright Test candidate at ${candidatePath}.`,
    'The candidate must navigate to process.env.PROBE_URL, perform the same click, and assert the visible output equals the literal PROBE-42.',
    'Do not inspect parent directories, do not use any account or external site, and do not create other files.',
  ].join('\n');
  const harness = await runHarnessTask({
    task,
    workspace,
    dshHome: path.join(localRoot, 'dsh'),
    patchPath: path.join(ROOT, 'config', 'browser.cordis.yml'),
    candidatePath,
    browserExecutable,
    apiKey,
    baseUrl,
    timeoutMs: Number(process.env.PROBE_TIMEOUT_MS ?? 600_000),
  });
  const candidateExecution = harness.assessment.success
    ? await verifyCandidate({ candidatePath, browserExecutable, fixtureUrl: server.url, runDirectory })
    : null;
  const result = {
    schema: 'deepseek-harness-probe-result-v1',
    runId,
    startedAt,
    endedAt: new Date().toISOString(),
    tool: 'DeepSeek Harness dsh',
    harnessVersion: '0.1.6-alpha.2',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    browserProvider: '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp@0.1.6-alpha.2',
    budget: { maxAttempts: 1, timeoutMs: Number(process.env.PROBE_TIMEOUT_MS ?? 600_000), modelRetryPluginDisabled: true },
    fixture: { origin: new URL(server.url).origin, path: '/probe', expected: 'PROBE-42' },
    harness,
    candidateExecution,
    success: harness.assessment.success && candidateExecution?.success === true,
  };
  await writeFile(path.join(runDirectory, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    runId,
    success: result.success,
    harness: harness.assessment,
    candidate: harness.candidate,
    candidateExecution: candidateExecution && { success: candidateExecution.success, report: candidateExecution.report },
    localResult: path.relative(ROOT, path.join(runDirectory, 'result.json')).replaceAll('\\', '/'),
  }, null, 2));
  process.exitCode = result.success ? 0 : 1;
} finally {
  await server.close();
}
