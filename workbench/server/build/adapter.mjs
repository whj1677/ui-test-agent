import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarnessTask, allowedEnvironment, DSH_BIN } from '../../../harness-probe/src/harness-runner.mjs';
import { runOwnedProcess } from '../../../harness-probe/src/process-control.mjs';
import { startFixtureServer } from '../../../harness-probe/src/fixture-server.mjs';
import { verifyCandidate } from '../../../harness-probe/src/verify-candidate.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const candidateConfig = path.join(workbenchRoot, 'config', 'candidate.playwright.config.mjs');

const REQUIRED_PLUGINS = {
  '@deepseek-ai/dsh-browser-use': '0.1.6-alpha.2',
  '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp': '0.1.6-alpha.2',
};

export async function ensureHarnessRuntime(dshHome, cwd, signal) {
  if (signal?.aborted) throw new Error('DEVELOPMENT_CANCELLED');
  await fs.mkdir(dshHome, { recursive: true });
  const env = allowedEnvironment({ DSH_HOME: dshHome });
  let result = await runOwnedProcess(process.execPath, [DSH_BIN, '--profile', 'headless', '--dump-default-config'], { cwd, env, signal, timeoutMs: 60_000 });
  if (signal?.aborted) throw new Error('DEVELOPMENT_CANCELLED');
  if (result.exitCode !== 0) throw new Error(`HARNESS_PROFILE_INIT_FAILED:${result.error || result.stderr}`);
  const packageFile = path.join(dshHome, 'profiles', 'headless', 'package.json');
  const profile = JSON.parse(await fs.readFile(packageFile, 'utf8'));
  const missing = Object.entries(REQUIRED_PLUGINS).filter(([name, version]) => profile.dependencies?.[name] !== version);
  if (missing.length) {
    result = await runOwnedProcess(process.execPath, [DSH_BIN, 'plugin', '--profile', 'headless', 'add', ...missing.map(([name, version]) => `${name}@${version}`)], { cwd, env, signal, timeoutMs: 180_000 });
    if (signal?.aborted) throw new Error('DEVELOPMENT_CANCELLED');
    if (result.exitCode !== 0) throw new Error(`HARNESS_PLUGIN_SETUP_FAILED:${result.error || result.stderr}`);
  }
  const finalProfile = JSON.parse(await fs.readFile(packageFile, 'utf8'));
  for (const [name, version] of Object.entries(REQUIRED_PLUGINS)) {
    if (finalProfile.dependencies?.[name] !== version) throw new Error(`HARNESS_PLUGIN_VERSION_MISMATCH:${name}`);
  }
  return { dsh: '0.1.6-alpha.2', plugins: REQUIRED_PLUGINS };
}

export function verifyWorkbenchCandidate(options) {
  return verifyCandidate({ ...options, runtimeRoot: workbenchRoot, configPath: candidateConfig });
}

export const buildAdapter = { runHarnessTask, startFixtureServer, verifyCandidate: verifyWorkbenchCandidate, ensureHarnessRuntime };

export function usageFromEvents(events) {
  const totals = {};
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'number' && /^(input_tokens|output_tokens|cache_read_tokens|total_tokens)$/.test(key)) totals[key] = Math.max(totals[key] ?? 0, child);
      else visit(child);
    }
  };
  for (const event of events || []) visit(event);
  return Object.keys(totals).length ? totals : null;
}
