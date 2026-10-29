import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { summarizeHarnessProcess } from '../server/backend/harness-manager.mjs';
import { BackendHarnessManager } from '../server/backend/harness-manager.mjs';

test('process diagnostic keeps finite lifecycle evidence and classifies pre-tool failures without raw output', () => {
  const diagnostic = summarizeHarnessProcess({
    processResult: { exitCode: 1, termination: null, outputComplete: true, exitObserved: true, closeObserved: true,
      stdout: 'raw-secret-output', stderr: 'proxy password=not-for-storage' },
    events: [{ type: 'status', phase: 'turn_end', reason: { kind: 'error' } }],
  });
  assert.equal(diagnostic.exit_code, 1);
  assert.equal(diagnostic.failure_stage, 'PROCESS_EXIT_NONZERO');
  assert.equal(diagnostic.final_seen, false);
  assert.equal(diagnostic.provider_requests, null);
  assert.equal(diagnostic.provider_usage, null);
  assert.equal(JSON.stringify(diagnostic).includes('private-secret'), false);
  assert.equal(JSON.stringify(diagnostic).includes('raw-secret-output'), false);
  assert.equal(JSON.stringify(diagnostic).includes('not-for-storage'), false);
});

test('process diagnostic distinguishes tool bridge and event-terminal failures', () => {
  const terminal = { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } };
  assert.equal(summarizeHarnessProcess({ processResult: { exitCode: 0 }, events: [] }).failure_stage, 'FINAL_EVENT_MISSING');
  assert.equal(summarizeHarnessProcess({ processResult: { exitCode: 0 }, events: [{ type: 'final' }] }).failure_stage, 'TURN_END_EVENT_MISSING');
  assert.equal(summarizeHarnessProcess({ processResult: { exitCode: 0 }, events: [{ type: 'final' }, terminal] }).failure_stage, 'NO_TOOL_CALL');
  assert.equal(summarizeHarnessProcess({ processResult: { exitCode: 0 }, events: [{ type: 'final' }, terminal, { type: 'tool_call' }] }).failure_stage, 'TOOL_RESULT_MISSING');
  assert.equal(summarizeHarnessProcess({ processResult: { exitCode: null, termination: 'tool_limit' }, events: [] }).failure_stage, 'TOOL_BUDGET');
  assert.equal(summarizeHarnessProcess({ processResult: { exitCode: null, error: 'spawn ENOENT' }, events: [] }).process_error_kind, 'SPAWN_NOT_FOUND');
});

test('process diagnostic keeps provider HTTP failures as finite classifications only', () => {
  const diagnostic = summarizeHarnessProcess({
    processResult: { exitCode: 1, stderr: '', stdout: 'ignored raw stream' },
    events: [{ type: 'final', content: 'dsh: HTTP_404: DeepSeek Messages request failed (404); token=secret' },
      { type: 'status', phase: 'turn_end', reason: { kind: 'error' } }],
  });
  assert.equal(diagnostic.event_error_class, 'PROVIDER_HTTP_FAILURE');
  assert.equal(diagnostic.provider_http_status, 404);
  assert.equal(diagnostic.stderr_class, null);
  assert.equal(JSON.stringify(diagnostic).includes('secret'), false);
  assert.equal(JSON.stringify(diagnostic).includes('HTTP_404'), false);
  const clean = summarizeHarnessProcess({ processResult: { exitCode: 0 }, events: [
    { type: 'final', content: 'DeepSeek Messages request failed (404)' },
    { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } },
  ] });
  assert.equal(clean.event_error_class, null);
  assert.equal(clean.provider_http_status, null);
});

test('malformed model tool JSON in the terminal event is distinguished from network or configuration failure', () => {
  const diagnostic = summarizeHarnessProcess({ processResult: { exitCode: 1 }, events: [
    { type: 'final', text: '' }, { type: 'status', phase: 'turn_end', reason: { kind: 'error', error: {
      code: 'MALFORMED_RESPONSE', message: 'DeepSeek Messages stream: tool input is invalid JSON; SYNTHETIC_SECRET' } } },
  ] });
  assert.equal(diagnostic.event_error_class, 'MODEL_TOOL_RESPONSE_MALFORMED');
  assert.equal(diagnostic.provider_http_status, null);
  assert.equal(JSON.stringify(diagnostic).includes('SYNTHETIC_SECRET'), false);
  assert.equal(diagnostic.failure_stage, 'PROCESS_EXIT_NONZERO');
});

test('startup failure persists its bounded process diagnostic before the final plan save', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-harness-diagnostic-'));
  const oldProxyEnvironment = Object.fromEntries(['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'no_proxy', 'ALL_PROXY', 'all_proxy']
    .map(key => [key, process.env[key]]));
  process.env.HTTP_PROXY = 'http://unit-proxy.example:8080';
  process.env.HTTPS_PROXY = 'https://unit-proxy.example:8443';
  process.env.NO_PROXY = 'example.test,invalid value';
  process.env.ALL_PROXY = 'http://must-not-pass.example:9000';
  try {
    const snapshots = [];
    let spawnedEnvironment = null;
    const manager = new BackendHarnessManager({
      root, dshHome: path.join(root, 'dsh'),
      credentialProvider: async () => ({ apiKey: 'dummy-key', baseUrl: 'https://api.deepseek.com' }),
      qualityReviewer: async () => { throw Error('review is not reached by this diagnostic test'); },
      configuration: { provider: 'deepseek-official', model: 'deepseek-flash' },
      ensureRuntime: async () => {},
      probeConfig: async () => ({ exitCode: 0, stdout: '- id: agent-default-model\n  config:\n    model: deepseek-flash\n- id: llm-retry\n  disabled: true\n- id: skill-filesystem\n  disabled: true\n- id: tool-skill\n  disabled: true\n- id: backend-workbench-mcp\n- id: backend-tool-guard\n' }),
      runHarness: async input => { spawnedEnvironment = input.env; throw new Error('test harness process startup failure'); },
    });
    const plan = { plan_id: 'plan-diagnostic', project_id: 'project-diagnostic', request_mode: 'generate', execution: null };
    const persist = async value => snapshots.push(structuredClone(value));
    const result = await manager.start({ plan, context: {}, environment: {}, persist, assertCurrent: async () => {} });
    assert.equal(result.state.status, 'FAILED');
    assert.equal(result.state.process_diagnostic.failure_stage, 'RUNTIME_OR_CONFIGURATION_FAILURE');
    assert.ok(snapshots.length >= 2);
    const durable = snapshots.at(-1).generation_session.process_diagnostic;
    assert.equal(durable.failure_stage, 'RUNTIME_OR_CONFIGURATION_FAILURE');
    assert.equal(durable.provider_http_status, null);
    assert.equal(JSON.stringify(durable).includes('test harness process startup failure'), false);
    assert.equal(spawnedEnvironment.DEEPSEEK_BASE_URL, 'https://api.deepseek.com/anthropic');
    assert.equal(spawnedEnvironment.DEEPSEEK_API_KEY, 'dummy-key');
    assert.equal(spawnedEnvironment.HTTP_PROXY, 'http://unit-proxy.example:8080/');
    assert.equal(spawnedEnvironment.HTTPS_PROXY, 'https://unit-proxy.example:8443/');
    assert.equal(spawnedEnvironment.NO_PROXY, 'example.test,127.0.0.1,localhost,::1');
    assert.equal(spawnedEnvironment.ALL_PROXY, undefined);
    const patchText = await fs.readFile(path.join(root, 'project-diagnostic', 'plan-diagnostic', 'backend-harness.cordis.yml'), 'utf8');
    assert.match(patchText, /id: llm-deepseek\n  config:\n    protocol: messages/);
    assert.equal(JSON.stringify(snapshots).includes('dummy-key'), false);
    assert.equal(JSON.stringify(snapshots).includes('https://api.deepseek.com'), false);
  } finally {
    for (const [key, value] of Object.entries(oldProxyEnvironment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});
