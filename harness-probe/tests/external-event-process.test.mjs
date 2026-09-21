import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarnessEventProcess } from '../src/harness-runner.mjs';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-ndjson-child.mjs');

async function run(mode, options = {}) {
  const lifecycle = [];
  const result = await runHarnessEventProcess({
    command: process.execPath,
    args: [fixture, mode],
    timeoutMs: options.timeoutMs || 5_000,
    maxToolCalls: options.maxToolCalls || 30,
    signal: options.signal,
    onLifecycle: async (event) => { lifecycle.push(event); },
  });
  return { ...result, lifecycle };
}

test('真实外部子进程的分段NDJSON等待close后完整结算', async () => {
  const result = await run('chunked-complete');
  assert.equal(result.processResult.exitCode, 0);
  assert.equal(result.processResult.exitObserved, true);
  assert.equal(result.processResult.closeObserved, true);
  assert.equal(result.processResult.outputComplete, true);
  assert.equal(result.events.at(-1).type, 'final');
  assert.ok(result.lifecycle.some((event) => event.type === 'process_spawn'));
  assert.ok(result.lifecycle.some((event) => event.type === 'process_exit'));
  assert.ok(result.lifecycle.some((event) => event.type === 'process_close'));
});

test('真实外部子进程部分事件后异常退出保留原始进程事实', async () => {
  const result = await run('partial-error');
  assert.equal(result.processResult.exitCode, 7);
  assert.equal(result.processResult.closeObserved, true);
  assert.equal(result.events[0].phase, 'step_start');
  assert.match(result.processResult.stderr, /synthetic child failure/);
});

test('无换行NDJSON末行在流关闭时仍被解析', async () => {
  const result = await run('terminal-no-newline');
  assert.equal(result.processResult.trailingStdoutLine, true);
  assert.equal(result.events.at(-1).type, 'final');
  assert.equal(result.processResult.outputComplete, true);
});

test('输出尚未完成的NDJSON末行保留为无原文的损坏事件', async () => {
  const result = await run('truncated-json');
  assert.equal(result.processResult.exitObserved, true);
  assert.equal(result.processResult.closeObserved, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, 'invalid_json');
  assert.equal(typeof result.events[0].sha256, 'string');
  assert.equal('line' in result.events[0], false);
});

test('外层取消、到期和工具额度均停止真实拥有子进程', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort('cancelled'), 80);
  const cancelled = await run('sleep', { signal: controller.signal });
  assert.equal(cancelled.processResult.termination, 'cancelled');

  const timedOut = await run('sleep', { timeoutMs: 80 });
  assert.equal(timedOut.processResult.termination, 'timeout');

  const limited = await run('many-tools', { maxToolCalls: 3 });
  assert.equal(limited.processResult.termination, 'tool_limit');
  assert.equal(limited.toolCalls, 3);
});
