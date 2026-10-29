import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runOwnedProcess } from '../src/process-control.mjs';
import { runHarnessEventProcess, runHarnessTask } from '../src/harness-runner.mjs';

// Generated in the parent and carried only by stdin, never in a command line.
const task = 'long-input-fixture 中文电价\n单双引号：\'" 反引号：` 美元：$() \\ 路径\r\n'.repeat(2400);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const expected = { bytes: Buffer.byteLength(task, 'utf8'), sha256: sha256(task) };
const readAndHash = `
  const { createHash } = require('node:crypto');
  const chunks = [];
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    const bytes = Buffer.concat(chunks);
    const result = { type: 'input_received', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), eof: true };
    process.stdout.write(JSON.stringify(result) + '\\n');
  });
`;

test('large UTF-8 stdin preserves Chinese, newlines and shell punctuation byte for byte through EOF', async () => {
  assert.ok(expected.bytes > 65536);
  const lifecycle = [];
  const result = await runOwnedProcess(process.execPath, ['-e', readAndHash], {
    stdin: task, timeoutMs: 5000, onLifecycle: event => lifecycle.push(event),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.termination, null);
  assert.equal(result.error, null);
  assert.equal(result.closeObserved, true);
  const received = JSON.parse(result.stdout.trim());
  assert.equal(received.bytes, expected.bytes);
  assert.equal(received.sha256, expected.sha256);
  assert.equal(received.eof, true);
  assert.equal(JSON.stringify(lifecycle).includes('long-input-fixture'), false);
});

test('an explicit empty stdin closes EOF instead of leaving the child waiting', async () => {
  const result = await runOwnedProcess(process.execPath, ['-e', readAndHash], { stdin: '', timeoutMs: 5000 });
  assert.equal(result.exitCode, 0);
  assert.equal(result.termination, null);
  const received = JSON.parse(result.stdout.trim());
  assert.equal(received.bytes, 0);
  assert.equal(received.sha256, sha256(''));
  assert.equal(received.eof, true);
});

test('event process forwards large stdin without changing bytes or losing its events', async () => {
  const result = await runHarnessEventProcess({ command: process.execPath, args: ['-e', readAndHash], stdin: task, timeoutMs: 5000 });
  assert.equal(result.processResult.exitCode, 0);
  assert.equal(result.processResult.termination, null);
  assert.deepEqual(result.events, [{ type: 'input_received', ...expected, eof: true }]);
  assert.equal(result.toolCalls, 0);
});

test('harness task passes dash in argv and its complete prompt in stdin without invoking dsh', async () => {
  let captured;
  const workspace = process.cwd();
  const result = await runHarnessTask({
    task, workspace, dshHome: path.join(workspace, 'unused-stdin-home'), patchPath: path.join(workspace, 'unused-patch.yml'),
    candidatePath: path.join(workspace, 'does-not-exist-stdin-candidate.mjs'), browserExecutable: 'unused-browser', timeoutMs: 1000,
    networkEnvironment: {},
    runProcess: async options => {
      captured = options;
      return {
        events: [{ type: 'status', phase: 'turn_end', reason: { kind: 'completed' } }, { type: 'final', text: 'transport fixture only' }],
        processResult: { exitCode: 0, termination: null, error: null, stdout: '', stderr: '', outputComplete: true, closeObserved: true },
        toolCalls: 0,
      };
    },
  });
  assert.equal(captured.args.at(-1), '-');
  assert.equal(captured.stdin, task);
  assert.equal(sha256(captured.stdin), expected.sha256);
  assert.equal(captured.args.some(arg => arg.includes('long-input-fixture')), false);
  assert.equal(captured.args.includes('--json'), true);
  assert.equal(result.assessment.toolCalls, 0);
  assert.equal(result.assessment.candidateExists, false);
});

test('a child that exits before consuming a large stdin cannot crash the owner with EPIPE', async () => {
  const lifecycle = [];
  const result = await runOwnedProcess(process.execPath, ['-e', 'process.stdin.destroy(); process.exit(23);'], {
    stdin: task.repeat(32), timeoutMs: 5000, onLifecycle: event => lifecycle.push(event),
  });
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.closeObserved, true);
  assert.notEqual(result.termination, 'timeout');
  assert.equal(JSON.stringify(lifecycle).includes('long-input-fixture'), false);
  if (result.error) assert.match(result.error, /^stdin:/);
  // EPIPE vs ECONNRESET is platform dependent; either is invocation-local.
  const stdinError = lifecycle.find(event => event.type === 'stdin_error');
  if (stdinError) assert.ok(typeof stdinError.code === 'string');
});

test('timeout still terminates an owned child after stdin EOF', async () => {
  const result = await runOwnedProcess(process.execPath, ['-e', readAndHash + '\nsetInterval(() => {}, 1000);'], { stdin: task, timeoutMs: 600 });
  assert.equal(JSON.parse(result.stdout.trim()).sha256, expected.sha256);
  assert.equal(result.termination, 'timeout');
  assert.notEqual(result.exitCode, 0);
});

test('event-process cancellation still stops the same child after receipt of large stdin', async () => {
  const controller = new AbortController();
  let spawns = 0;
  const result = await runHarnessEventProcess({
    command: process.execPath, args: ['-e', readAndHash + '\nsetInterval(() => {}, 1000);'],
    stdin: task, timeoutMs: 5000, signal: controller.signal,
    onLifecycle: event => {
      if (event.type === 'process_spawn') spawns++;
      if (event.type === 'harness_event' && event.event_type === 'input_received') controller.abort('cancelled');
    },
  });
  assert.equal(result.events[0].sha256, expected.sha256);
  assert.equal(result.processResult.termination, 'cancelled');
  assert.notEqual(result.processResult.exitCode, 0);
  assert.equal(spawns, 1);
});

test('installed dsh headless parser accepts dash with json mode without creating an agent', async () => {
  const { apply } = await import('../node_modules/@deepseek-ai/dsh-headless/lib/startup.js');
  let provided;
  const exits = [];
  apply({
    get: key => key === 'cmdlineArgs' ? { get: () => ['--json', '-'] } : key === 'appExit' ? code => exits.push(code) : undefined,
    provide: (key, value) => { provided = { key, value }; },
  });
  assert.deepEqual(provided, { key: 'headlessStartup', value: { task: '-', sessionId: undefined, json: true } });
  assert.deepEqual(exits, []);
});
