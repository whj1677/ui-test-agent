import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { runOwnedProcess } from './process-control.mjs';
import { evaluatePlaywrightReport } from './candidate-verifier.mjs';
import { allowedEnvironment } from './harness-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function packageFact(requireFrom, packageName) {
  const packagePath = requireFrom.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  return { package_path: packagePath, version: manifest.version };
}

export async function inspectPlaywrightRuntime({ candidatePath, runtimeRoot = root, configPath = path.join(runtimeRoot, 'config', 'playwright.config.mjs') }) {
  const cliPath = path.join(runtimeRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  const candidateRequire = createRequire(candidatePath);
  const configRequire = createRequire(configPath);
  const cliRequire = createRequire(cliPath);
  const [cliTest, configTest, candidateTest] = await Promise.all([
    packageFact(cliRequire, '@playwright/test'),
    packageFact(configRequire, '@playwright/test'),
    packageFact(candidateRequire, '@playwright/test'),
  ]);
  // @playwright/test loads its helper from its own package location. Resolve
  // from that actual package rather than from the caller directory, where an
  // unused top-level playwright package may legitimately also exist.
  const [cliPlaywright, configPlaywright, candidatePlaywright] = await Promise.all([
    packageFact(createRequire(cliTest.package_path), 'playwright'),
    packageFact(createRequire(configTest.package_path), 'playwright'),
    packageFact(createRequire(candidateTest.package_path), 'playwright'),
  ]);
  return {
    runtime_root: path.resolve(runtimeRoot),
    cli_path: cliPath,
    config_path: path.resolve(configPath),
    cli_test: cliTest,
    config_test: configTest,
    candidate_test: candidateTest,
    cli_playwright: cliPlaywright,
    config_playwright: configPlaywright,
    candidate_playwright: candidatePlaywright,
    consistent: new Set([cliTest.package_path, configTest.package_path, candidateTest.package_path]).size === 1 &&
      new Set([cliPlaywright.package_path, configPlaywright.package_path, candidatePlaywright.package_path]).size === 1,
  };
}

export async function verifyCandidate({
  candidatePath, browserExecutable, fixtureUrl, runDirectory, signal,
  stepObservation = null,
  runtimeRoot = root, configPath = path.join(runtimeRoot, 'config', 'playwright.config.mjs'),
}) {
  const reportPath = path.join(runDirectory, 'playwright-report.json');
  await mkdir(runDirectory, { recursive: true });
  const runtime = await inspectPlaywrightRuntime({ candidatePath, runtimeRoot, configPath });
  if (stepObservation && !runtime.consistent) throw new Error('STEP_OBSERVER_PLAYWRIGHT_INSTALL_MISMATCH');
  let entryPath = candidatePath;
  if (stepObservation) {
    const observerPath = path.join(runtimeRoot, 'server', 'build', 'step-observer.mjs');
    const wrapperDir = path.join(runDirectory, 'observer-entry');
    await mkdir(wrapperDir, { recursive: true });
    entryPath = path.join(wrapperDir, 'observed.spec.mjs');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(entryPath, `import { installStepObserver } from ${JSON.stringify(new URL(`file:///${observerPath.replaceAll('\\', '/')}`).href)};\n` +
      `installStepObserver(${JSON.stringify({ directory: path.join(runDirectory, 'artifacts', 'step-evidence'), identity: stepObservation })});\n` +
      `await import(${JSON.stringify(new URL(`file:///${candidatePath.replaceAll('\\', '/')}`).href)});\n`);
  }
  const cli = runtime.cli_path;
  const config = runtime.config_path;
  const env = allowedEnvironment({
    DSH_PROBE_BROWSER_EXECUTABLE: browserExecutable,
    PROBE_URL: fixtureUrl,
    PROBE_CANDIDATE_DIR: path.dirname(entryPath),
    PROBE_REPORT_PATH: reportPath,
    PROBE_OUTPUT_DIR: path.join(runDirectory, 'artifacts'),
  });
  // Playwright treats positional file arguments as regular-expression filters
  // relative to testDir; an absolute Windows path is not a stable filter.
  const processResult = await runOwnedProcess(process.execPath, [cli, 'test', path.basename(entryPath), '--config', config], {
    // A run-specific observer directory can cross Windows MAX_PATH as a child
    // process cwd (the paired "negative" path is longer than "normal").
    // Playwright discovers the test via PROBE_CANDIDATE_DIR, not process cwd.
    cwd: runtimeRoot, env, timeoutMs: 60_000, signal,
  });
  let report = null;
  try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
  const reportAssessment = evaluatePlaywrightReport(report);
  return {
    success: processResult.exitCode === 0 && processResult.termination === null && reportAssessment.success,
    process: processResult,
    report: reportAssessment,
    reportPath,
    runtime,
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
