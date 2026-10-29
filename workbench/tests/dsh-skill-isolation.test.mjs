import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from '../../harness-probe/src/process-control.mjs';
import { allowedEnvironment, DSH_BIN } from '../../harness-probe/src/harness-runner.mjs';
import { developmentPatch } from '../server/build/development-patch.mjs';
import { backendHarnessPatch } from '../server/backend/harness-patch.mjs';
import { runControlledHarnessTask } from '../server/build/adapter.mjs';
import { BackendHarnessManager } from '../server/backend/harness-manager.mjs';
import { assertControlledDshConfig } from '../server/skills/config-isolation.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserPatch = path.resolve(workbenchRoot, '../harness-probe/config/browser-flash.cordis.yml');
const moduleState = output => {
  const result = new Map();
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^- id: ([\w-]+)$/);
    if (match) { current = match[1]; result.set(current, false); continue; }
    if (current && /^  disabled: true$/.test(line)) result.set(current, true);
  }
  return result;
};
function assertIsolation(output, guard, mcp) {
  const states = moduleState(output);
  for (const id of ['skill-filesystem', 'tool-skill']) assert.equal(states.get(id), true, `${id} must be disabled in final DSH config: ${output.slice(Math.max(0, output.indexOf(id) - 20), output.indexOf(id) + 160)}`);
  for (const id of [guard, mcp]) assert.equal(states.get(id), false, `${id} must remain enabled in final DSH config`);
}
const validBackendConfig = '- id: agent-default-model\n  config:\n    model: deepseek-flash\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- id: backend-tool-guard\n- id: backend-workbench-mcp\n';
const retryProvider = "- id: llm-deepseek\n  name: '@deepseek-ai/dsh-llm-deepseek'\n  config:\n    protocol: messages\n    retryPolicy:\n      mode: normal\n      maxRetries: 2\n      retryableCodes:\n        - TIMEOUT\n        - TRANSPORT\n        - SERVER\n      backoff:\n        initialDelayMs: 500\n        maxDelayMs: 2000\n        jitterRatio: 0.1\n";
const validUiConfig = validBackendConfig.replace('backend-tool-guard', 'workbench-development-guard').replace('backend-workbench-mcp', 'workbench-development-mcp')
  .replace('- id: llm-retry\n  disabled: true', "- id: llm-retry\n  name: '@deepseek-ai/dsh-llm-retry'\n  disabled: false") + retryProvider;

test('controlled DSH profiles keep ambient Skills disabled and apply only UI-scoped retry', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-skill-isolation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  await fs.mkdir(home);
  const env = allowedEnvironment({ DSH_HOME: home, DSH_PROBE_BROWSER_EXECUTABLE: 'C:\\Windows\\System32\\notepad.exe' });
  assert.equal(env.DEEPSEEK_API_KEY, undefined);
  const base = await fs.readFile(browserPatch, 'utf8');
  const patches = [
    { name: 'ui', contents: developmentPatch(base, workbenchRoot), guard: 'workbench-development-guard', mcp: 'workbench-development-mcp' },
    { name: 'backend', contents: backendHarnessPatch(workbenchRoot), guard: 'backend-tool-guard', mcp: 'backend-workbench-mcp' },
  ];
  const evidence = [];
  for (const profile of patches) {
    const file = path.join(root, `${profile.name}.cordis.yml`);
    await fs.writeFile(file, profile.contents);
    const result = await runOwnedProcess(process.execPath, [DSH_BIN, '--profile', 'headless', '--patch', file, '--dump-config'],
      { cwd: root, env, timeoutMs: 30_000 });
    assert.equal(result.exitCode, 0, `${profile.name}: ${result.stderr}`);
    assertIsolation(result.stdout, profile.guard, profile.mcp);
    assertControlledDshConfig(result.stdout, { guard: profile.guard, mcp: profile.mcp, errorCode: 'CONFIG_REJECTED',
      ...(profile.name === 'ui' ? { retryPolicy: 'development-transport-v1' } : {}) });
    if (profile.name === 'ui') {
      let executions = 0;
      await runControlledHarnessTask({ developmentEndpoint: 'http://127.0.0.1:1', dshHome: home, workspace: root, patchPath: file },
        { probeConfig: async () => result, execute: async () => { executions++; return { completed: true }; } });
      assert.equal(executions, 1, 'real DSH config dump reaches the UI adapter execution gate');
      assert.throws(() => assertControlledDshConfig(result.stdout, { guard: profile.guard, mcp: profile.mcp, errorCode: 'CONFIG_REJECTED' }), /CONFIG_REJECTED/);
      assert.throws(() => assertControlledDshConfig(result.stdout, { guard: 'quality-review-tool-guard', mcp: 'quality-review-mcp', errorCode: 'CONFIG_REJECTED' }), /CONFIG_REJECTED/);
    }
    const states = moduleState(result.stdout);
    evidence.push({ profile: profile.name, command: 'node <bundled DSH_BIN> --profile headless --patch <temporary controlled patch> --dump-config', exit_code: result.exitCode,
      patch_sha256: createHash('sha256').update(profile.contents).digest('hex'), config_stdout_sha256: createHash('sha256').update(result.stdout).digest('hex'),
      skill_filesystem_disabled: states.get('skill-filesystem'), tool_skill_disabled: states.get('tool-skill'), retry_disabled: states.get('llm-retry'),
      guard_enabled: states.get(profile.guard) === false, mcp_enabled: states.get(profile.mcp) === false });
  }
  if (process.env.DSH_SKILL_QA_OUTPUT) {
    await fs.mkdir(path.dirname(process.env.DSH_SKILL_QA_OUTPUT), { recursive: true });
    await fs.writeFile(process.env.DSH_SKILL_QA_OUTPUT, JSON.stringify({ schema: 'workbench/dsh-skill-isolation-probe-v1', observed_at: new Date().toISOString(),
      probe: 'fresh-temporary-DSH_HOME', model_credentials_present: false, model_called: false, workbench_started: false, results: evidence }, null, 2) + '\n');
  }
  assert.throws(() => assertIsolation('- id: skill-filesystem\n  disabled: false\n- id: tool-skill\n  disabled: true\n- id: backend-tool-guard\n  disabled: false\n- id: backend-workbench-mcp\n  disabled: false\n', 'backend-tool-guard', 'backend-workbench-mcp'), /skill-filesystem must be disabled/);
});

test('UI pre-run probe rejects missing or re-enabled ambient Skills before calling DSH --json', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-ui-probe-denial-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  let executions = 0;
  const execute = async () => { executions++; return { completed: true }; };
  const options = { developmentEndpoint: 'http://127.0.0.1:1', dshHome: home, workspace: home, patchPath: browserPatch };
  for (const output of [validUiConfig.replace('- id: skill-filesystem\n  disabled: true\n', ''), validUiConfig.replace('- id: tool-skill\n  disabled: true', '- id: tool-skill\n  disabled: false'), validUiConfig + '- id: skill-filesystem\n  disabled: false\n']) {
    await assert.rejects(runControlledHarnessTask(options, { probeConfig: async () => ({ exitCode: 0, stdout: output }), execute }), /DEVELOPMENT_HARNESS_PATCH_INVALID/);
  }
  assert.equal(executions, 0);
  await runControlledHarnessTask(options, { probeConfig: async () => ({ exitCode: 0, stdout: validUiConfig }), execute });
  assert.equal(executions, 1);
  for (const output of [
    validUiConfig.replace('mode: normal', 'mode: always'),
    validUiConfig.replace('maxRetries: 2', 'maxRetries: 3'),
    validUiConfig.replace('        - TRANSPORT', '        - RATE_LIMIT'),
    validUiConfig.replace('maxDelayMs: 2000', 'maxDelayMs: 20000'),
    validUiConfig.replace('  disabled: false', '  disabled: true'),
    validUiConfig.replace('      maxRetries: 2', '      maxRetries: 2\n      unknown: true'),
    validUiConfig.replace(retryProvider, ''),
  ]) await assert.rejects(runControlledHarnessTask(options, { probeConfig: async () => ({ exitCode: 0, stdout: output }), execute }), /DEVELOPMENT_HARNESS_PATCH_INVALID/);
  assert.equal(executions, 1);
});

test('backend pre-run probe rejects ambient Skill fallback before calling DSH --json', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-backend-probe-denial-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let executions = 0;
  const manager = new BackendHarnessManager({ root, dshHome: path.join(root, 'home'), configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
    credentialProvider: async () => ({ apiKey: 'test-only', baseUrl: 'https://api.deepseek.com' }), ensureRuntime: async () => {},
    qualityReviewer: async () => { throw Error('review must not run before the DSH config probe'); },
    probeConfig: async () => ({ exitCode: 0, stdout: validBackendConfig.replace('- id: skill-filesystem\n  disabled: true\n', '') }),
    runHarness: async () => { executions++; return { processResult: { exitCode: 0 }, events: [] }; } });
  const plan = { project_id: 'project', plan_id: 'plan', request_mode: 'generate', generation_session: { status: 'RUNNING', self_tests: [] } };
  const context = { caseVersion: { content: { steps: [] } }, binding: { mappings: [] }, protocol: { segments: [] } };
  const environment = { environment_id: 'env', mode: 'http-json-readonly', base_url: 'http://127.0.0.1:1', allowed_methods: ['GET'], allowed_path_prefixes: ['/api/'] };
  await manager.start({ plan, context, environment, persist: async () => {}, assertCurrent: async () => {} });
  assert.equal(executions, 0);
  assert.equal(plan.generation_session.error, 'BACKEND_HARNESS_PATCH_INVALID');
});
