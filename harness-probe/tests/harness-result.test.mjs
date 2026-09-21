import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHarnessRun, createToolBudgetObserver } from '../src/harness-runner.mjs';
import { redactText, redactValue } from '../src/redact.mjs';

const completedEvents = [
  { type: 'session', sessionId: 'fake' },
  { type: 'tool_call', tool: 'mcp__playwright-mcp__browser_navigate' },
  { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } },
  { type: 'final', text: 'done' },
];
const cleanProcess = { exitCode: 0, termination: null, error: null };

test('完整终态、浏览器工具和文件同时存在才成功', () => {
  assert.equal(assessHarnessRun({ processResult: cleanProcess, events: completedEvents, candidateExists: true }).success, true);
});

test('缺文件不能标记成功', () => {
  assert.equal(assessHarnessRun({ processResult: cleanProcess, events: completedEvents, candidateExists: false }).success, false);
});

test('缺浏览器工具事实不能标记成功', () => {
  const events = completedEvents.filter((event) => event.type !== 'tool_call');
  assert.equal(assessHarnessRun({ processResult: cleanProcess, events, candidateExists: true }).success, false);
});

test('模型中断或不完整报告不能标记成功', () => {
  const events = completedEvents.map((event) => event.type === 'status' ? { ...event, reason: { kind: 'error' } } : event)
    .filter((event) => event.type !== 'final');
  assert.equal(assessHarnessRun({ processResult: { ...cleanProcess, exitCode: 1 }, events, candidateExists: true }).success, false);
});

test('取消和超时不能标记成功', () => {
  for (const termination of ['cancelled', 'timeout']) {
    assert.equal(assessHarnessRun({ processResult: { ...cleanProcess, exitCode: 1, termination }, events: completedEvents, candidateExists: true }).success, false);
  }
});

test('日志会遮蔽密钥、Bearer和敏感字段', () => {
  assert.doesNotMatch(redactText('key=abc Bearer token123', ['abc']), /abc|token123/);
  const value = redactValue({ apiKey: 'abc', nested: { cookie: 'x', text: 'secret=raw' } }, ['abc']);
  assert.equal(value.apiKey, '[REDACTED]');
  assert.equal(value.nested.cookie, '[REDACTED]');
  assert.doesNotMatch(value.nested.text, /raw/);
});

test('工具调用达到上限时触发外层停止且不会超过上限', () => {
  const reasons = [];
  const observer = createToolBudgetObserver(3, (reason) => reasons.push(reason));
  observer.observe({ type: 'tool_call', tool: 'one' });
  observer.observe({ type: 'status' });
  observer.observe({ type: 'tool_call', tool: 'two' });
  assert.deepEqual(reasons, []);
  observer.observe({ type: 'tool_call', tool: 'three' });
  assert.deepEqual(reasons, ['tool_limit']);
  assert.equal(observer.count(), 3);
});
