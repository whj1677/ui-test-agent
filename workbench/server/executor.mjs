import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveInside, sha256File, stripAnsi } from './integrity.mjs';
import { analyzeRunArtifacts } from './report.mjs';
import { startFixtureServer } from '../../harness-probe/src/fixture-server.mjs';

const MAX_CONSOLE_BYTES = 2 * 1024 * 1024;
const ENV_ALLOWLIST = [
  'SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP',
  'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'HOME', 'PLAYWRIGHT_BROWSERS_PATH',
];

function createRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14).toLowerCase();
  return `run-${stamp}-${randomUUID().slice(0, 8).toLowerCase()}`;
}

const ENTRY_VARIABLES = new Set(['PILOT_ENTRY_URL', 'PROBE_URL']);

function childEnvironment(entryUrl, entryVariable = 'PILOT_ENTRY_URL', browserExecutable = null, source = process.env) {
  if (!ENTRY_VARIABLES.has(entryVariable)) throw new Error('ENTRY_ENVIRONMENT_VARIABLE_NOT_ALLOWED');
  const result = {};
  for (const key of ENV_ALLOWLIST) {
    if (typeof source[key] === 'string' && source[key]) result[key] = source[key];
  }
  result[entryVariable] = entryUrl;
  if (browserExecutable) result.DSH_PROBE_BROWSER_EXECUTABLE = browserExecutable;
  result.NO_PROXY = 'localhost,127.0.0.1';
  result.no_proxy = 'localhost,127.0.0.1';
  return result;
}

function runtimeConfig(reportFile, outputDirectory, asset) {
  const summary = asset.configuration.summary;
  const executable = summary.browser_executable_env
    ? `\n    launchOptions: { executablePath: process.env.${summary.browser_executable_env} },`
    : '';
  return `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: ${JSON.stringify(asset.execution?.test_file_name || path.basename(asset.script.path))},
  retries: ${summary.retries},
  workers: ${summary.workers},
  timeout: ${summary.timeout_ms},
  expect: { timeout: ${summary.expect_timeout_ms} },
  reporter: [['json', { outputFile: ${JSON.stringify(reportFile)} }]],
  outputDir: ${JSON.stringify(outputDirectory)},
  use: {
    browserName: ${JSON.stringify(summary.browser)}, headless: true, locale: ${JSON.stringify(summary.locale)},${executable}
    viewport: ${JSON.stringify(summary.viewport)},
    trace: ${JSON.stringify(summary.trace)}, screenshot: ${JSON.stringify(summary.screenshot)}, video: ${JSON.stringify(summary.video)},
  },
});
`;
}

async function defaultSiteVerifier(environment) {
  const entry = new URL(environment.entry_url);
  if (!['localhost', '127.0.0.1'].includes(entry.hostname) || entry.port !== '4198') {
    throw new Error('ENTRY_URL_NOT_ALLOWED');
  }
  const health = new URL('/healthz', entry);
  const healthResponse = await fetch(health, { signal: AbortSignal.timeout(2500), redirect: 'error' });
  const identity = await healthResponse.json().catch(() => null);
  if (!healthResponse.ok || identity?.site !== 'heldout-lab' || identity?.version !== 1) {
    throw new Error('HELDOUT_SITE_IDENTITY_MISMATCH');
  }
  const entryResponse = await fetch(entry, { method: 'HEAD', signal: AbortSignal.timeout(2500), redirect: 'error' });
  if (!entryResponse.ok) throw new Error('HELDOUT_ENTRY_UNAVAILABLE');
  return { health_url: health.toString(), site: identity.site, version: identity.version };
}

async function defaultKillTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('INVALID_OWNED_PID');
  if (process.platform !== 'win32') {
    process.kill(pid, 'SIGTERM');
    return;
  }
  const child = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    shell: false, windowsHide: true, stdio: 'ignore',
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) throw new Error(`TASKKILL_FAILED:${code}`);
}

function capture(stream, chunks) {
  if (!stream?.on) return;
  let bytes = 0;
  stream.on('data', (chunk) => {
    const buffer = Buffer.from(chunk);
    if (bytes >= MAX_CONSOLE_BYTES) return;
    const allowed = buffer.subarray(0, MAX_CONSOLE_BYTES - bytes);
    chunks.push(allowed);
    bytes += allowed.length;
  });
}

export class WorkbenchRunManager extends EventEmitter {
  constructor(options) {
    super();
    this.store = options.store;
    this.paths = options.paths;
    this.spawnProcess = options.spawnProcess || spawn;
    this.killTree = options.killTree || defaultKillTree;
    this.verifySite = options.verifySite || defaultSiteVerifier;
    this.startFixture = options.startFixture || startFixtureServer;
    this.browserExecutable = options.browserExecutable || process.env.DSH_PROBE_BROWSER_EXECUTABLE || null;
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || (() => createRunId(this.now()));
    this.active = null;
    this.starting = false;
    this.completions = new Map();
    this.shutdownRequested = false;
    this.storageFault = null;
    this.otherActive = options.otherActive || (() => false);
    this.onStorageFault = options.onStorageFault || (() => {});
  }

  async start(assetId, environmentId, options = {}) {
    if (this.shutdownRequested) throw new Error('WORKBENCH_SHUTTING_DOWN');
    if (this.storageFault) throw new Error('WORKBENCH_STORAGE_UNAVAILABLE');
    if (this.otherActive()) throw new Error('WORKBENCH_BUSY');
    if (this.starting || this.active) throw new Error('RUN_ALREADY_ACTIVE');
    this.starting = true;
    let run;
    let fixtureServer = null;
    let runtimeRoot = null;
    try {
      const asset = await this.store.getAsset(assetId);
      if (!asset || !['MIGRATED_APPROVED', 'HUMAN_FIRST_REVIEW_PASSED_SCOPED'].includes(asset.approval_status)) throw new Error('ASSET_NOT_APPROVED');
      const environments = options.acceptance === true ? asset.acceptance_environments || [] : asset.allowed_environments;
      const environment = environments.find((item) => item.id === environmentId);
      if (!environment) throw new Error('ENVIRONMENT_NOT_ALLOWED');
      if (asset.configuration.summary.browser_executable_env && !this.browserExecutable) throw new Error('BROWSER_EXECUTABLE_REQUIRED');
      let effectiveEnvironment = environment;
      let site;
      if (environment.fixture) {
        const fixturePath = resolveInside(this.paths.repoRoot, environment.fixture.path);
        if (await sha256File(fixturePath) !== environment.fixture.sha256) throw new Error('FIXTURE_HASH_MISMATCH');
        fixtureServer = await this.startFixture(fixturePath);
        effectiveEnvironment = { ...environment, entry_url: fixtureServer.url };
        site = { site: 'managed-synthetic-fixture', fixture_sha256: environment.fixture.sha256 };
      } else {
        site = await this.verifySite(environment);
      }

      const source = asset.script.storage === 'managed_asset'
        ? resolveInside(this.store.assetVersionDirectory(asset.asset_id, asset.version), asset.script.relative_path)
        : resolveInside(this.paths.repoRoot, asset.script.path);
      const sourceShaBefore = await sha256File(source);
      if (sourceShaBefore !== asset.script.sha256) throw new Error('APPROVED_SCRIPT_HASH_MISMATCH');

      const installedPackage = JSON.parse(
        await fs.readFile(path.join(this.paths.workbenchRoot, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'),
      );
      if (installedPackage.version !== asset.dependency_lock.playwright_test) {
        throw new Error('PLAYWRIGHT_VERSION_MISMATCH');
      }

      const runId = this.idFactory();
      const createdAt = this.now().toISOString();
      run = {
        schema: 'approved-workbench/run-v1', run_id: runId,
        asset_id: asset.asset_id, asset_version: asset.version, case_id: environment.case_id,
        source_commit: asset.source_commit, environment: {
          id: environment.id, label: environment.label, entry_url: effectiveEnvironment.entry_url,
          site_identity: site,
        },
        run_mode: options.acceptance === true ? 'CONTROLLED_ACCEPTANCE' : 'NORMAL_REGRESSION',
        project_case: asset.project_case ? structuredClone(asset.project_case) : null,
        review_scope: asset.scope || null,
        created_at: createdAt, started_at: null, finished_at: null,
        execution_status: 'STARTING', report_status: 'PENDING', test_status: 'PENDING', evidence_status: 'PENDING',
        process: { pid: null, state: 'STARTING', exit_code: null, signal: null },
        integrity: { expected_sha256: asset.script.sha256, source_before_sha256: sourceShaBefore, runtime_sha256: null, source_after_sha256: null },
        runtime: { browser: 'chromium', workers: 1, retries: 0, model_calls: 0, healer: false },
        steps: environment.steps.map((step) => ({ ...step, status: 'PENDING', error: null })),
        media: [], summary: null, error: null,
      };
      await this.store.createRun(run);
      const runRoot = this.store.runDirectory(runId);
      runtimeRoot = resolveInside(this.paths.executionRuntimeRoot, runId);
      const testsRoot = path.join(runtimeRoot, 'tests');
      const outputRoot = path.join(runRoot, 'artifacts');
      const reportFile = path.join(runRoot, 'report.json');
      const consoleFile = path.join(runRoot, 'console.txt');
      await fs.mkdir(testsRoot, { recursive: true });
      const runtimeName = asset.execution?.test_file_name || path.basename(asset.script.path);
      if (path.basename(runtimeName) !== runtimeName || !/^[a-z0-9][a-z0-9._-]{3,100}$/i.test(runtimeName)) throw new Error('ASSET_TEST_FILE_NAME_INVALID');
      const runtimeScript = path.join(testsRoot, runtimeName);
      await fs.copyFile(source, runtimeScript);
      const runtimeSha = await sha256File(runtimeScript);
      if (runtimeSha !== asset.script.sha256) throw new Error('RUNTIME_SCRIPT_HASH_MISMATCH');
      const configFile = path.join(runtimeRoot, 'playwright.config.mjs');
      await fs.writeFile(configFile, runtimeConfig(reportFile, outputRoot, asset), { flag: 'wx' });

      const cli = path.join(this.paths.workbenchRoot, 'node_modules', '@playwright', 'test', 'cli.js');
      const args = [cli, 'test', '--config', configFile, '--workers=1', '--retries=0'];
      if (this.shutdownRequested) throw new Error('WORKBENCH_SHUTTING_DOWN');
      const child = this.spawnProcess(process.execPath, args, {
        cwd: this.paths.workbenchRoot,
        env: childEnvironment(
          effectiveEnvironment.entry_url,
          asset.execution?.entry_url_environment_variable || 'PILOT_ENTRY_URL',
          asset.configuration.summary.browser_executable_env ? this.browserExecutable : null,
        ),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout = [];
      const stderr = [];
      capture(child.stdout, stdout);
      capture(child.stderr, stderr);
      this.active = { runId, child, stopRequested: false, phase: 'EXECUTING' };
      const completion = this.finishOnChild(runId, child, { source, runtimeScript, runtimeRoot, fixtureServer, reportFile, consoleFile, stdout, stderr });
      this.completions.set(runId, completion);
      void completion.catch(error => this.recordStorageFault(error, 'run_finalization'));
      void completion.finally(() => this.completions.delete(runId)).catch(() => {});
      run = await this.store.updateRun(runId, (current) => ({
        ...current, started_at: this.now().toISOString(), execution_status: 'RUNNING',
        process: { ...current.process, pid: child.pid || null, state: 'RUNNING' },
        integrity: { ...current.integrity, runtime_sha256: runtimeSha },
      })).catch(error => { this.recordStorageFault(error, 'persist_running'); throw error; });
      this.emit('changed', runId);
      return run;
    } catch (error) {
      const owned = this.active;
      if (owned && owned.runId === run?.run_id && Number.isInteger(owned.child.pid) && owned.phase !== 'FINALIZING') {
        owned.stopRequested = true;
        await this.killTree(owned.child.pid).catch(killError => this.recordStorageFault(killError, 'failed_start_cleanup'));
      }
      // After spawn the completion owns evidence and cleanup, including failed starts.
      // Removing the runtime here could make its final hash check read deleted bytes.
      const completionOwnsCleanup = run?.run_id && this.completions.has(run.run_id);
      if (!completionOwnsCleanup) {
        await fixtureServer?.close().catch(() => {});
        if (runtimeRoot) await fs.rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
      }
      if (run?.run_id && !completionOwnsCleanup) {
        await this.store.updateRun(run.run_id, (current) => ({
          ...current, finished_at: this.now().toISOString(), execution_status: 'START_FAILED',
          process: { ...current.process, state: 'START_FAILED' }, evidence_status: 'INCOMPLETE',
          error: { code: error.message.split(':')[0], message: stripAnsi(error.message) },
        })).catch(writeError => this.recordStorageFault(writeError, 'persist_start_failure'));
      }
      throw error;
    } finally {
      this.starting = false;
    }
  }

  finishOnChild(runId, child, context) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = async (exitCode, signal, startError) => {
        if (settled) return;
        settled = true;
        const owned = this.active?.runId === runId ? this.active : null;
        const stopped = Boolean(owned?.stopRequested);
        if (owned) owned.phase = 'FINALIZING';
        let result, failure;
        try {
        const consoleBytes = Buffer.concat([
          ...context.stdout, Buffer.from('\n--- stderr ---\n'), ...context.stderr,
        ]);
        await fs.writeFile(context.consoleFile, consoleBytes);
        let sourceAfter = null;
        let runtimeAfter = null;
        let integrityError = null;
        try {
          sourceAfter = await sha256File(context.source);
          runtimeAfter = await sha256File(context.runtimeScript);
          const current = await this.store.getRun(runId);
          if (sourceAfter !== current.integrity.expected_sha256 || runtimeAfter !== current.integrity.expected_sha256) {
            integrityError = 'SCRIPT_HASH_CHANGED';
          }
        } catch {
          integrityError = 'SCRIPT_HASH_CHECK_FAILED';
        }
        const currentBeforeAnalysis = await this.store.getRun(runId);
        const terminalStatus = integrityError ? 'INTEGRITY_FAILED' : stopped ? 'CANCELLED' : startError ? 'PROCESS_ERROR' : 'PROCESS_ENDED';
        const analysis = await analyzeRunArtifacts({
          runRoot: this.store.runDirectory(runId), reportFile: context.reportFile,
          registeredSteps: currentBeforeAnalysis.steps.map(({ step_id, action, expected }) => ({ step_id, action, expected })),
          exitCode: Number.isInteger(exitCode) ? exitCode : null, executionStatus: terminalStatus,
        });
        const next = await this.store.updateRun(runId, (current) => ({
          ...current,
          finished_at: this.now().toISOString(),
          execution_status: terminalStatus,
          report_status: analysis.report_status,
          test_status: analysis.test_status,
          evidence_status: analysis.evidence_status,
          process: { pid: null, state: 'ENDED', exit_code: Number.isInteger(exitCode) ? exitCode : null, signal: signal || null },
          integrity: { ...current.integrity, source_after_sha256: sourceAfter, runtime_after_sha256: runtimeAfter },
          steps: analysis.steps, media: analysis.media, summary: analysis.summary,
          error: integrityError
            ? { code: integrityError, message: '批准脚本来源或本次运行副本的结束哈希不一致。' }
            : startError ? { code: 'PROCESS_START_FAILED', message: stripAnsi(startError.message) } : analysis.error,
        }));
        this.emit('changed', runId);
        result = next;
        } catch (error) { failure = error; }
        finally {
          await context.fixtureServer?.close().catch(error => this.recordStorageFault(error, 'fixture_cleanup'));
          await fs.rm(context.runtimeRoot, { recursive: true, force: true }).catch(error => this.recordStorageFault(error, 'runtime_cleanup'));
          if (this.active?.runId === runId) this.active = null;
        }
        if (failure) reject(failure); else resolve(result);
      };
      child.once('error', (error) => finish(null, null, error));
      child.once('exit', (code, signal) => finish(code, signal, null));
    });
  }

  async stop(runId) {
    const owned = this.active;
    if (!owned || owned.runId !== runId) {
      const saved = await this.store.getRun(runId);
      if (saved && !['QUEUED', 'STARTING', 'RUNNING', 'STOPPING'].includes(saved.execution_status)) return saved;
      throw new Error('RUN_NOT_ACTIVE_OR_NOT_OWNED');
    }
    if (owned.stopSignalSent || owned.phase === 'FINALIZING') return this.store.getRun(runId);
    owned.stopRequested = true;
    let run, failure;
    try {
      run = await this.store.updateRun(runId, (current) => ({
        ...current, ...(['QUEUED', 'STARTING', 'RUNNING', 'STOPPING'].includes(current.execution_status)
          ? { execution_status: 'STOPPING', process: { ...current.process, state: 'STOPPING' } } : {}),
      }));
    } catch (error) { this.recordStorageFault(error, 'persist_stopping'); failure = error; }
    // Cancellation of an owned process must not depend on the disk being writable.
    if (this.active === owned && owned.phase !== 'FINALIZING' && Number.isInteger(owned.child.pid)) {
      try { await this.killTree(owned.child.pid); owned.stopSignalSent = true; }
      catch (error) { this.recordStorageFault(error, 'stop_owned_process'); throw error; }
    }
    this.emit('changed', runId);
    if (failure) throw failure;
    return run;
  }

  async startAcceptance(assetId, environmentId) {
    return this.start(assetId, environmentId, { acceptance: true });
  }

  async waitFor(runId) {
    const completion = this.completions.get(runId);
    return completion ? completion : this.store.getRun(runId);
  }

  recordStorageFault(error, operation) {
    this.storageFault ||= { code: error?.code || 'RUN_PERSISTENCE_FAILED', operation };
    this.onStorageFault(error, operation);
  }

  async settle() { await Promise.allSettled([...this.completions.values()]); }
}

export const executorInternals = { childEnvironment, createRunId, runtimeConfig };
