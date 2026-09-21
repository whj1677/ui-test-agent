import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ROOT, allowedEnvironment } from './harness-runner.mjs';
import { runOwnedProcess } from './process-control.mjs';

async function startEndpoint(label) {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(label);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise((resolve) => server.close(resolve)) };
}

export function assessIsolation(child, browser) {
  const file = child.files.workspaceRead.succeeded && child.files.workspaceWrite.succeeded &&
    !child.files.outsideRead.succeeded && !child.files.outsideWrite.succeeded;
  const network = child.network.allowed.succeeded && !child.network.denied.succeeded &&
    browser.allowed.succeeded && !browser.denied.succeeded;
  const credential = child.environment.allowedMarkerPresent && !child.environment.deepseekApiKeyPresent &&
    !child.environment.deepseekBaseUrlPresent && !child.files.outsideRead.succeeded;
  return {
    fileIsolationSatisfied: file,
    networkIsolationSatisfied: network,
    credentialIsolationSatisfied: credential,
    acceptableForRealHarnessRevision: file && network && credential,
  };
}

async function browserAttempt(page, url) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    return { succeeded: true, status: response?.status() ?? null };
  } catch (error) {
    return { succeeded: false, errorCode: error?.name ?? 'UNKNOWN' };
  }
}

export async function runIsolationAudit({ browserExecutable }) {
  const runId = `isolation-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const auditRoot = path.join(ROOT, '.local', 'isolation-audits', runId);
  const workspace = path.join(auditRoot, 'workspace');
  const outside = path.join(auditRoot, 'outside-workspace');
  await mkdir(workspace, { recursive: true });
  await mkdir(outside, { recursive: true });
  const workspaceFile = path.join(workspace, 'allowed.txt');
  const outsideFile = path.join(outside, 'synthetic-credential.txt');
  const outsideWriteFile = path.join(outside, 'unexpected-write.txt');
  await writeFile(workspaceFile, 'workspace-sentinel');
  await writeFile(outsideFile, 'synthetic-credential-sentinel');

  const allowedEndpoint = await startEndpoint('allowed-endpoint');
  const deniedEndpoint = await startEndpoint('denied-endpoint');
  const started = performance.now();
  try {
    const candidateEnv = allowedEnvironment({ M2B_ALLOWED_MARKER: 'allowed-marker' });
    const childScript = path.join(ROOT, 'tests', 'fixtures', 'isolation-child.mjs');
    const processResult = await runOwnedProcess(process.execPath, [
      childScript, workspaceFile, outsideFile, outsideWriteFile, allowedEndpoint.url, deniedEndpoint.url,
    ], { cwd: workspace, env: candidateEnv, timeoutMs: 30_000 });
    if (processResult.exitCode !== 0) throw new Error(`isolation child failed: ${processResult.error ?? processResult.stderr}`);
    const child = JSON.parse(processResult.stdout.trim());

    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    let browserFacts;
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      browserFacts = {
        allowed: await browserAttempt(page, allowedEndpoint.url),
        denied: await browserAttempt(page, deniedEndpoint.url),
      };
      await context.close();
    } finally {
      await browser.close();
    }

    const assessment = assessIsolation(child, browserFacts);
    const result = {
      schema: 'm2b-isolation-audit-v1',
      runId,
      durationMs: Math.round(performance.now() - started),
      execution: {
        harnessStarts: 0,
        agentSteps: null,
        harnessBrowserToolCalls: null,
        providerRequests: null,
        providerUsage: null,
        note: 'Isolation gate ran before Harness; model-related counters are not applicable, not observed zeros.',
      },
      child: {
        identity: child.identity,
        environment: child.environment,
        files: {
          workspaceReadSucceeded: child.files.workspaceRead.succeeded,
          workspaceWriteSucceeded: child.files.workspaceWrite.succeeded,
          outsideReadSucceeded: child.files.outsideRead.succeeded,
          outsideWriteSucceeded: child.files.outsideWrite.succeeded,
        },
        network: {
          allowedSucceeded: child.network.allowed.succeeded,
          deniedSucceeded: child.network.denied.succeeded,
        },
      },
      browser: {
        allowedSucceeded: browserFacts.allowed.succeeded,
        deniedSucceeded: browserFacts.denied.succeeded,
      },
      assessment,
    };
    await writeFile(path.join(auditRoot, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await Promise.all([allowedEndpoint.close(), deniedEndpoint.close()]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
  if (!browserExecutable) throw new Error('DSH_PROBE_BROWSER_EXECUTABLE is required');
  const result = await runIsolationAudit({ browserExecutable });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.assessment.acceptableForRealHarnessRevision ? 0 : 2;
}
