import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from './process-control.mjs';
import { evaluatePlaywrightReport } from './candidate-verifier.mjs';
import { allowedEnvironment } from './harness-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function verifyCandidate({ candidatePath, browserExecutable, fixtureUrl, runDirectory }) {
  const reportPath = path.join(runDirectory, 'playwright-report.json');
  await mkdir(runDirectory, { recursive: true });
  const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  const config = path.join(root, 'config', 'playwright.config.mjs');
  const env = allowedEnvironment({
    DSH_PROBE_BROWSER_EXECUTABLE: browserExecutable,
    PROBE_URL: fixtureUrl,
    PROBE_CANDIDATE_DIR: path.dirname(candidatePath),
    PROBE_REPORT_PATH: reportPath,
  });
  // Playwright treats positional file arguments as regular-expression filters
  // relative to testDir; an absolute Windows path is not a stable filter.
  const processResult = await runOwnedProcess(process.execPath, [cli, 'test', path.basename(candidatePath), '--config', config], {
    cwd: path.dirname(candidatePath), env, timeoutMs: 60_000,
  });
  let report = null;
  try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
  const reportAssessment = evaluatePlaywrightReport(report);
  return {
    success: processResult.exitCode === 0 && processResult.termination === null && reportAssessment.success,
    process: processResult,
    report: reportAssessment,
    reportPath,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const candidatePath = process.env.PROBE_CANDIDATE_PATH;
  const browserExecutable = process.env.DSH_PROBE_BROWSER_EXECUTABLE;
  const fixtureUrl = process.env.PROBE_URL;
  if (!candidatePath || !browserExecutable || !fixtureUrl) throw new Error('PROBE_CANDIDATE_PATH, DSH_PROBE_BROWSER_EXECUTABLE and PROBE_URL are required');
  const result = await verifyCandidate({ candidatePath, browserExecutable, fixtureUrl, runDirectory: path.join(root, '.local', 'manual-verify') });
  console.log(JSON.stringify(result));
  process.exitCode = result.success ? 0 : 1;
}
