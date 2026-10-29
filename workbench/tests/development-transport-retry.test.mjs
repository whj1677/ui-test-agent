import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from '../../harness-probe/src/process-control.mjs';
import { allowedEnvironment, DSH_BIN } from '../../harness-probe/src/harness-runner.mjs';
import { resolveRetryPolicy } from '../../harness-probe/node_modules/@deepseek-ai/dsh-llm/lib/index.js';
import { developmentPatch } from '../server/build/development-patch.mjs';

const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configRoot = path.resolve(workbenchRoot, '../harness-probe/config');
const retryPolicy = { mode: 'normal', maxRetries: 2, retryableCodes: ['TIMEOUT', 'TRANSPORT', 'SERVER'],
  backoff: { initialDelayMs: 500, maxDelayMs: 2000, jitterRatio: 0.1 } };

test('UI development patch enables only bounded request retry accepted by the installed DSH schema', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'development-retry-config-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  await fs.mkdir(home);
  assert.deepEqual(resolveRetryPolicy(retryPolicy, 'llm-deepseek: retryPolicy'), {
    mode: 'normal', maxRetries: 2, retryableCodes: ['TIMEOUT', 'TRANSPORT', 'SERVER'],
    initialDelayMs: 500, maxDelayMs: 2000, jitterRatio: 0.1,
  });
  for (const name of ['browser.cordis.yml', 'browser-flash.cordis.yml']) {
    const base = await fs.readFile(path.join(configRoot, name), 'utf8');
    assert.match(base, /- id: llm-retry\r?\n  disabled: true/);
    const patch = developmentPatch(base, workbenchRoot);
    assert.match(patch, /- id: llm-deepseek\r?\n  config:\r?\n    protocol: messages\r?\n    retryPolicy:\r?\n      mode: normal\r?\n      maxRetries: 2/);
    assert.match(patch, /retryableCodes:\r?\n        - TIMEOUT\r?\n        - TRANSPORT\r?\n        - SERVER/);
    assert.match(patch, /- id: llm-retry\r?\n  disabled: false/);
    assert.doesNotMatch(patch, /mode: always/);
    assert.match(base, /- id: llm-retry\r?\n  disabled: true/, 'shared profile remains disabled');
    const patchPath = path.join(root, name);
    await fs.writeFile(patchPath, patch);
    const result = await runOwnedProcess(process.execPath, [DSH_BIN, '--profile', 'headless', '--patch', patchPath, '--dump-config'],
      { cwd: root, env: allowedEnvironment({ DSH_HOME: home, DSH_PROBE_BROWSER_EXECUTABLE: 'C:\\Windows\\System32\\notepad.exe' }), timeoutMs: 30_000 });
    assert.equal(result.exitCode, 0, `${name}: ${result.stderr}`);
    const retryBlock = result.stdout.slice(result.stdout.indexOf('- id: llm-retry'), result.stdout.indexOf('- id: llm-retry') + 150);
    const providerBlock = result.stdout.slice(result.stdout.indexOf('- id: llm-deepseek'), result.stdout.indexOf('- id: llm-deepseek') + 450);
    assert.match(retryBlock, /disabled: false/, `${name}: retry executor was not enabled`);
    assert.match(providerBlock, /protocol: messages\r?\n    retryPolicy:/, `${name}: provider retry policy was not retained`);
    assert.match(providerBlock, /maxRetries: 2/, `${name}: retry budget was not retained`);
  }
});

test('unknown base profile cannot silently enable an unbounded retry configuration', () => {
  assert.throws(() => developmentPatch('- id: llm-retry\n  disabled: true\n', workbenchRoot), /DEVELOPMENT_RETRY_PATCH_INVALID/);
  assert.throws(() => developmentPatch('- id: llm-deepseek\n  config:\n    protocol: messages\n', workbenchRoot), /DEVELOPMENT_RETRY_PATCH_INVALID/);
});
