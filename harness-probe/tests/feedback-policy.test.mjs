import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWorkspaceFiles } from '../src/feedback-policy.mjs';

const fixed = [
  'feedback.json',
  'input/attempt-2-candidate.spec.mjs',
  'output/revised-candidate.spec.mjs',
  'task.md',
];

test('浏览器插件证据单独登记且不冒充候选输出', () => {
  const result = classifyWorkspaceFiles([...fixed, '.playwright-mcp/page.yml', '.playwright-mcp/console.log']);
  assert.equal(result.accepted, true);
  assert.equal(result.toolEvidence.length, 2);
  assert.deepEqual(result.unexpected, []);
});

test('任务目录内其他未登记文件仍被拒绝', () => {
  const result = classifyWorkspaceFiles([...fixed, 'unexpected.txt']);
  assert.equal(result.accepted, false);
  assert.deepEqual(result.unexpected, ['unexpected.txt']);
});
