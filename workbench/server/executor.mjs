import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveInside, sha256File, stripAnsi } from './integrity.mjs';
import { analyzeRunArtifacts } from './report.mjs';

const MAX_CONSOLE_BYTES = 2 * 1024 * 1024;
const ENV_ALLOWLIST = [
  'SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP',
  'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'HOME', 'PLAYWRIGHT_BROWSERS_PATH',
];

function createRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14).toLowerCase();
  return `run-${stamp}-${randomUUID().slice(0, 8).toLowerCase()}`;
}

function childEnvironment(entryUrl, source = process.env) {
  const result = {};
  for (const key of ENV_ALLOWLIST) {
    if (typeof source[key] === 'string' && source[key]) result[key] = source[key];
  }
  result.PILOT_ENTRY_URL = entryUrl;
  result.NO_PROXY = 'localhost,127.0.0.1';
  result.no_proxy = 'localhost,127.0.0.1';
  return result;
}

function runtimeConfig(reportFile, outputDirectory) {
  return `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'sorting.spec.ts',
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 5_000 },
  reporter: [['json', { outputFile: ${JSON.stringify(reportFile)} }]],
  outputDir: ${JSON.stringify(outputDirectory)},
  use: {
    browserName: 'chromium', headless: true, locale: 'zh-CN',
    viewport: { width: 1440, height: 1000 },
    trace: 'on', screenshot: 'on', video: 'on',
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
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || (() => createRunId(this.now()));
    this.active = null;
    this.starting = false;
    this.completions = new Map();
  }

  async start(assetId, environmentId) {
    if (this.starting || this.active) throw new Error('RUN_ALREADY_ACTIVE');
    this.starting = true;
    let run;
    try {
      const asset = await this.store.getAsset(assetId);
      if (!asset || asset.approval_status !== 'MIGRATED_APPROVED') throw new Error('ASSET_NOT_APPROVED');
      const environment = asset.allowed_environments.find((item) => item.id === environmentId);
      if (!environment) throw new Error('ENVIRONMENT_NOT_ALLOWED');
      const site = await this.verifySite(environment);

      const source = resolveInside(this.paths.repoRoot, asset.script.path);
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
          id: environment.id, label: environment.label, entry_url: environment.entry_url,
          site_identity: site,
        },
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
      const runtimeRoot = path.join(runRoot, 'runtime');
      const testsRoot = path.join(runtimeRoot, 'tests');
      const outputRoot = path.join(runRoot, 'artifacts');
      const reportFile = path.join(runRoot, 'report.json');
      const consoleFile = path.join(runRoot, 'console.txt');
      await fs.mkdir(testsRoot, { recursive: true });
      const runtimeScript = path.join(testsRoot, 'sorting.spec.ts');
      await fs.copyFile(source, runtimeScript);
      const runtimeSha = await sha256File(runtimeScript);
      if (runtimeSha !== asset.script.sha256) throw new Error('RUNTIME_SCRIPT_HASH_MISMATCH');
      const configFile = path.join(runtimeRoot, 'playwright.config.mjs');
      await fs.writeFile(configFile, runtimeConfig(reportFile, outputRoot), { flag: 'wx' });

      const cli = path.join(this.paths.workbenchRoot, 'node_modules', '@playwright', 'test', 'cli.js');
      const args = [cli, 'test', '--config', configFile, '--workers=1', '--retries=0'];
      const child = this.spawnProcess(process.execPath, args, {
        cwd: this.paths.workbenchRoot,
        env: childEnvironment(environment.entry_url),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout = [];
      const stderr = [];
      capture(child.stdout, stdout);
      capture(child.stderr, stderr);
      this.active = { runId, child, stopRequested: false };
      run = await this.store.updateRun(runId, (current) => ({
        ...current, started_at: this.now().toISOString(), execution_status: 'RUNNING',
        process: { ...current.process, pid: child.pid || null, state: 'RUNNING' },
        integrity: { ...current.integrity, runtime_sha256: runtimeSha },
      }));
      const completion = this.finishOnChild(runId, child, { source, runtimeScript, reportFile, consoleFile, stdout, stderr });
      this.completions.set(runId, completion);
      completion.finally(() => this.completions.delete(runId));
      this.emit('changed', runId);
      return run;
    } catch (error) {
      if (run?.run_id) {
        await this.store.updateRun(run.run_id, (current) => ({
          ...current, finished_at: this.now().toISOString(), execution_status: 'START_FAILED',
          process: { ...current.process, state: 'START_FAILED' }, evidence_status: 'INCOMPLETE',
          error: { code: error.message.split(':')[0], message: stripAnsi(error.message) },
        }));
      }
      throw error;
    } finally {
      this.starting = false;
    }
  }

  finishOnChild(runId, child, context) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = async (exitCode, signal, startError) => {
        if (settled) return;
        settled = true;
        const owned = this.active?.runId === runId ? this.active : null;
        const stopped = Boolean(owned?.stopRequested);
        if (owned) this.active = null;
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
        resolve(next);
      };
      child.once('error', (error) => finish(null, null, error));
      child.once('exit', (code, signal) => finish(code, signal, null));
    });
  }

  async stop(runId) {
    if (!this.active || this.active.runId !== runId) throw new Error('RUN_NOT_ACTIVE_OR_NOT_OWNED');
    if (this.active.stopRequested) return this.store.getRun(runId);
    this.active.stopRequested = true;
    const run = await this.store.updateRun(runId, (current) => ({
      ...current, execution_status: 'STOPPING', process: { ...current.process, state: 'STOPPING' },
    }));
    await this.killTree(this.active.child.pid);
    this.emit('changed', runId);
    return run;
  }

  async waitFor(runId) {
    const completion = this.completions.get(runId);
    return completion ? completion : this.store.getRun(runId);
  }
}

export const executorInternals = { childEnvironment, createRunId, runtimeConfig };
