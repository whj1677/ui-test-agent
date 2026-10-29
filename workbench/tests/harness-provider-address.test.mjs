import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepSeekHarnessBaseUrl, harnessNetworkEnvironment } from '../../harness-probe/src/provider-environment.mjs';
import { runHarnessTask } from '../../harness-probe/src/harness-runner.mjs';
import { developmentPatch } from '../server/build/development-patch.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('official DeepSeek root and v1 addresses project only the DSH child to Anthropic Messages', () => {
  for (const input of ['https://api.deepseek.com', 'https://api.deepseek.com/', 'https://api.deepseek.com/v1', 'https://api.deepseek.com/v1/']) {
    assert.equal(deepSeekHarnessBaseUrl(input), 'https://api.deepseek.com/anthropic');
  }
  for (const input of ['https://api.deepseek.com/anthropic', 'https://api.deepseek.com/anthropic/', 'https://api.deepseek.com/anthropic/v1', 'https://api.deepseek.com/anthropic/v1/']) {
    const expected = input.replace(/\/$/, '');
    assert.equal(deepSeekHarnessBaseUrl(input), expected);
  }
  assert.throws(() => deepSeekHarnessBaseUrl('https://api.deepseek.com/other'), /DSH_OFFICIAL_BASE_URL_INVALID/);
});

test('non-official local stub addresses are preserved verbatim', () => {
  for (const input of ['http://127.0.0.1:4317', 'http://localhost:4317/v1/', 'https://stub.local.test/anthropic',
    'https://api.deepseek.com.attacker.invalid/v1']) {
    assert.equal(deepSeekHarnessBaseUrl(input), input);
  }
});

test('network environment mirrors only valid HTTP(S) proxies and adds loopback bypasses', () => {
  const result = harnessNetworkEnvironment({ HTTP_PROXY: 'http://proxy.example:7890', HTTPS_PROXY: 'https://proxy.example:7891',
    NO_PROXY: 'example.com,*.internal,invalid/path,bad value', ALL_PROXY: 'socks5://proxy.example:1080', OTHER_SECRET: 'do-not-copy' });
  assert.deepEqual(result, {
    HTTP_PROXY: 'http://proxy.example:7890/', http_proxy: 'http://proxy.example:7890/',
    HTTPS_PROXY: 'https://proxy.example:7891/', https_proxy: 'https://proxy.example:7891/',
    NO_PROXY: 'example.com,*.internal,127.0.0.1,localhost,::1', no_proxy: 'example.com,*.internal,127.0.0.1,localhost,::1',
  });
  assert.equal(Object.hasOwn(result, 'ALL_PROXY'), false);
  assert.equal(Object.hasOwn(result, 'OTHER_SECRET'), false);
});

test('proxy URLs with credentials, query, or fragment are rejected while lowercase proxy names are paired', () => {
  const rejected = harnessNetworkEnvironment({ HTTP_PROXY: 'http://user:pass@proxy.example:7890',
    HTTPS_PROXY: 'https://proxy.example:7891/?token=secret#fragment', NO_PROXY: '127.0.0.1,evil/path' });
  assert.equal(Object.hasOwn(rejected, 'HTTP_PROXY'), false);
  assert.equal(Object.hasOwn(rejected, 'HTTPS_PROXY'), false);
  assert.equal(rejected.NO_PROXY, '127.0.0.1,localhost,::1');

  const lower = harnessNetworkEnvironment({ http_proxy: 'http://127.0.0.1:7890', no_proxy: 'localhost' });
  assert.equal(lower.HTTP_PROXY, 'http://127.0.0.1:7890/');
  assert.equal(lower.http_proxy, lower.HTTP_PROXY);
  assert.equal(lower.NO_PROXY, 'localhost,127.0.0.1,::1');
});

test('runHarnessTask injects the projected address and unchanged key only into its child environment', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-provider-address-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'project');
  await fs.mkdir(workspace);
  const candidatePath = path.join(workspace, 'candidate.json');
  await fs.writeFile(candidatePath, '{"synthetic":true}', 'utf8');
  const credentials = { apiKey: 'synthetic-key-for-test', baseUrl: 'https://api.deepseek.com/v1/' };
  let childOptions;
  const result = await runHarnessTask({ task: 'synthetic no-model-runner test', workspace, dshHome: path.join(root, 'dsh'),
    patchPath: path.join(repoRoot, 'harness-probe/config/browser-flash.cordis.yml'), candidatePath,
    browserExecutable: 'synthetic-browser', apiKey: credentials.apiKey, baseUrl: credentials.baseUrl, timeoutMs: 1000,
    networkEnvironment: { HTTPS_PROXY: 'http://127.0.0.1:7890', NO_PROXY: 'example.com', ALL_PROXY: 'socks5://ignored:1080' },
    runProcess: async options => {
      childOptions = options;
      return { events: [
        { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' },
        { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } },
        { type: 'final' },
      ], processResult: { exitCode: 0, termination: null, outputComplete: true, closeObserved: true, observerError: null, stdout: '', stderr: '' }, toolCalls: 1 };
    } });
  assert.equal(childOptions.env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com/anthropic');
  assert.equal(childOptions.env.DEEPSEEK_API_KEY, credentials.apiKey);
  assert.equal(childOptions.env.HTTP_PROXY, undefined);
  assert.equal(childOptions.env.HTTPS_PROXY, 'http://127.0.0.1:7890/');
  assert.equal(childOptions.env.https_proxy, 'http://127.0.0.1:7890/');
  assert.equal(childOptions.env.NO_PROXY, 'example.com,127.0.0.1,localhost,::1');
  assert.equal(childOptions.env.no_proxy, childOptions.env.NO_PROXY);
  assert.equal(childOptions.env.ALL_PROXY, undefined);
  assert.deepEqual(credentials, { apiKey: 'synthetic-key-for-test', baseUrl: 'https://api.deepseek.com/v1/' }, 'projection does not mutate stored credential values');
  assert.equal(result.assessment.success, true);
});

test('all browser patches pin Messages protocol and dynamic development patch preserves it', async () => {
  const configNames = ['browser.cordis.yml', 'browser-flash.cordis.yml', 'browser-auth-attach.cordis.yml'];
  const configs = await Promise.all(configNames.map(name => fs.readFile(path.join(repoRoot, 'harness-probe/config', name), 'utf8')));
  for (const config of configs) {
    assert.match(config, /- id: llm-deepseek\r?\n  config:\r?\n    protocol: messages/);
    assert.doesNotMatch(config, /baseURL|DEEPSEEK_BASE_URL\s*:/i, 'model address stays outside static patches');
  }
  const dynamic = developmentPatch(configs[0], path.join(repoRoot, 'workbench'), { authAttach: true });
  assert.match(dynamic, /- id: llm-deepseek\r?\n  config:\r?\n    protocol: messages/);
  assert.match(dynamic, /workbench-development-guard/);
  assert.match(dynamic, /workbench-development-mcp/);
});
