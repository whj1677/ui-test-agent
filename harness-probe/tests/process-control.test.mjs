import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from '../src/process-control.mjs';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-process.mjs');

test('启动失败会返回错误且不等待到期', async () => {
  const started = Date.now();
  const result = await runOwnedProcess('definitely-not-a-real-command-m2-probe', [], { timeoutMs: 5_000 });
  assert.equal(result.exitCode, null);
  assert.match(result.error, /ENOENT|not found/i);
  assert.ok(Date.now() - started < 4_000);
});

test('超时会终止本任务拥有的进程', async () => {
  const result = await runOwnedProcess(process.execPath, [fixture, 'sleep'], { timeoutMs: 250 });
  assert.equal(result.termination, 'timeout');
  assert.notEqual(result.exitCode, 0);
});

test('用户取消会终止本任务拥有的进程且不重启', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);
  const result = await runOwnedProcess(process.execPath, [fixture, 'sleep'], { timeoutMs: 5_000, signal: controller.signal });
  assert.equal(result.termination, 'cancelled');
  assert.notEqual(result.exitCode, 0);
});
