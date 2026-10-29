import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { runOwnedProcess } from './process-control.mjs';
import { evaluatePlaywrightReport } from './candidate-verifier.mjs';
import { allowedEnvironment } from './harness-runner.mjs';
import { validateTimingEvidence } from '../../workbench/server/build/timing-evidence.mjs';
import { readBrowserAssertionEvidence } from '../../workbench/server/build/browser-assertion-records.mjs';
import { prepareWindowRecorder } from '../../workbench/server/build/window-recorder.mjs';
import { extractBrowserAssertionContract, evaluateBrowserAssertionObligations } from '../../workbench/server/build/browser-assertion-contract.mjs';

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
  stepObservation = null, windowRecording = false, authStorageState = null, sessionTerminationEndpoints = [], timingRequirements = [], networkPolicy = null, browserAssertionCase = null,
  runtimeRoot = root, configPath = path.join(runtimeRoot, 'config', 'playwright.config.mjs'),
}) {
  if (browserAssertionCase && extractBrowserAssertionContract(browserAssertionCase).configured && !stepObservation)
    throw new Error('BROWSER_ASSERTIONS_REQUIRE_STEP_OBSERVATION');
  if (authStorageState && sessionTerminationEndpoints.length && !stepObservation)
    throw new Error('AUTH_REQUEST_POLICY_REQUIRES_STEP_OBSERVATION');
  if (timingRequirements.length && !stepObservation) throw new Error('TIMING_REQUIRES_STEP_OBSERVATION');
  if (networkPolicy && !stepObservation) throw new Error('TARGET_SCOPE_POLICY_REQUIRES_STEP_OBSERVATION');
  if (timingRequirements.some(item => item.status !== 'RUNTIME_REQUIRED')) throw new Error('TIMING_REQUIREMENT_NEEDS_REVIEW');
  const reportPath = path.join(runDirectory, 'playwright-report.json');
  await mkdir(runDirectory, { recursive: true });
  const runtime = await inspectPlaywrightRuntime({ candidatePath, runtimeRoot, configPath });
  if (stepObservation && !runtime.consistent) throw new Error('STEP_OBSERVER_PLAYWRIGHT_INSTALL_MISMATCH');
  const windowDirectory = path.join(runDirectory, 'artifacts', 'window-recording');
  let windowOptions = null;
  if (windowRecording) {
    if (!stepObservation) throw new Error('WINDOW_RECORDING_REQUIRES_STEP_OBSERVATION');
    await mkdir(windowDirectory, { recursive: true });
    const pending = { schema: 'workbench/window-recording-v1', ...stepObservation, status: 'UNAVAILABLE', reason: 'WINDOW_RECORDING_NOT_STARTED' };
    try { windowOptions = { directory: windowDirectory, identity: stepObservation, prepared: await prepareWindowRecorder() }; }
    catch (error) {
      await writeFile(path.join(windowDirectory, 'recording.json'), JSON.stringify({ ...pending,
        reason: /^[A-Z_]+$/.test(error.message) ? error.message : 'WINDOW_RECORDING_PREPARATION_FAILED' }));
    }
  }
  let entryPath = candidatePath;
  if (stepObservation) {
    const observerPath = path.join(runtimeRoot, 'server', 'build', 'step-observer.mjs');
    const wrapperDir = path.join(runDirectory, 'observer-entry');
    await mkdir(wrapperDir, { recursive: true });
    entryPath = path.join(wrapperDir, 'observed.spec.mjs');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(entryPath, `import { installStepObserver } from ${JSON.stringify(new URL(`file:///${observerPath.replaceAll('\\', '/')}`).href)};\n` +
      `const observer = installStepObserver(${JSON.stringify({ directory: path.join(runDirectory, 'artifacts', 'step-evidence'), identity: stepObservation,
        allowedOrigin: authStorageState ? new URL(fixtureUrl).origin : null,
        networkPolicy, windowRecording: windowOptions, sessionTerminationEndpoints: authStorageState ? sessionTerminationEndpoints : [], timingRequirements })});\n` +
      `try { await import(${JSON.stringify(new URL(`file:///${candidatePath.replaceAll('\\', '/')}`).href)}); }\n` +
      `finally { observer.registerTeardown(); }\n`);
  }
  const cli = runtime.cli_path;
  const config = runtime.config_path;
  let networkDebugPort = null;
  if (networkPolicy) {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    networkDebugPort = server.address().port;
    await new Promise(resolve => server.close(resolve));
  }
  let authBridge = null;
  let authBridgeUrl = null;
  if (authStorageState) {
    const token = randomUUID();
    authBridge = http.createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== `/${token}` ||
          !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
        response.writeHead(404); response.end(); return;
      }
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(authStorageState));
    });
    await new Promise((resolve, reject) => authBridge.once('error', reject).listen(0, '127.0.0.1', resolve));
    authBridgeUrl = `http://127.0.0.1:${authBridge.address().port}/${token}`;
  }
  const env = allowedEnvironment({
    DSH_PROBE_BROWSER_EXECUTABLE: browserExecutable,
    PROBE_URL: fixtureUrl,
    PROBE_CANDIDATE_DIR: path.dirname(entryPath),
    PROBE_REPORT_PATH: reportPath,
    PROBE_OUTPUT_DIR: path.join(runDirectory, 'artifacts'),
    PROBE_NETWORK_POLICY_ENABLED: networkPolicy ? '1' : '',
    PROBE_RECORD_WINDOW: windowOptions ? '1' : '',
    ...(networkDebugPort ? { PROBE_CDP_DEBUGGING_PORT: String(networkDebugPort) } : {}),
    ...(authBridgeUrl ? { PROBE_AUTH_STATE_CHANNEL: authBridgeUrl } : {}),
  });
  // Playwright treats positional file arguments as regular-expression filters
  // relative to testDir; an absolute Windows path is not a stable filter.
  let processResult;
  try {
    processResult = await runOwnedProcess(process.execPath, [cli, 'test', path.basename(entryPath), '--config', config], {
      // A run-specific observer directory can cross Windows MAX_PATH as a child
      // process cwd (the paired "negative" path is longer than "normal").
      // Playwright discovers the test via PROBE_CANDIDATE_DIR, not process cwd.
      cwd: runtimeRoot, env, timeoutMs: 60_000, signal,
    });
  } finally {
    if (authBridge) {
      authBridge.closeAllConnections();
      await new Promise((resolve) => authBridge.close(resolve));
    }
  }
  let report = null;
  try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
  const reportAssessment = evaluatePlaywrightReport(report);
  let observations = [];
  if (timingRequirements.length) {
    try {
      observations = (await readFile(path.join(runDirectory, 'artifacts', 'step-evidence', 'step-observations.ndjson'), 'utf8'))
        .trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    } catch { /* Missing or invalid timing evidence must not become a pass. */ }
  }
  try {
    const breach = JSON.parse(await readFile(path.join(runDirectory, 'artifacts', 'step-evidence', 'network-policy-breach.json'), 'utf8'));
    const error = new Error('TARGET_SCOPE_REQUEST_BLOCKED'); error.code = 'TARGET_SCOPE_REQUEST_BLOCKED'; error.policyViolation = breach; throw error;
  } catch (error) { if (error.code === 'TARGET_SCOPE_REQUEST_BLOCKED') throw error; }
  const timing = validateTimingEvidence(timingRequirements, observations, stepObservation);
  const browserAssertions = stepObservation ? await readBrowserAssertionEvidence(runDirectory, stepObservation) : null;
  if (browserAssertions && browserAssertionCase) browserAssertions.obligations = evaluateBrowserAssertionObligations(browserAssertionCase, browserAssertions);
  if (reportAssessment.success && browserAssertions?.status === 'CHECKS_NOT_PASSED')
    throw new Error('BROWSER_ASSERTION_FAILURE_WAS_SWALLOWED');
  let windowRecord = null;
  if (windowRecording) {
    try {
      windowRecord = JSON.parse(await readFile(path.join(windowDirectory, 'recording.json'), 'utf8'));
      if (Object.entries(stepObservation).some(([key, value]) => (windowRecord.identity || windowRecord)[key] !== value))
        throw new Error('WINDOW_RECORDING_IDENTITY_MISMATCH');
      if (!['COMPLETE', 'INCOMPLETE', 'UNAVAILABLE'].includes(windowRecord.status))
        windowRecord = { ...windowRecord, status: 'INCOMPLETE', reason: 'WINDOW_RECORDING_INTERRUPTED' };
    } catch (error) { windowRecord = { ...stepObservation, status: 'UNAVAILABLE', reason: error.message === 'WINDOW_RECORDING_IDENTITY_MISMATCH' ? error.message : 'WINDOW_RECORDING_MANIFEST_MISSING' }; }
  }
  return {
    windowRecording: windowRecord,
    success: processResult.exitCode === 0 && processResult.termination === null && reportAssessment.success && timing.complete &&
      (!browserAssertions?.obligations?.configured || browserAssertions.obligations.status === 'COVERED'),
    timing,
    browserAssertions,
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
