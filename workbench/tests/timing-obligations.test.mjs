import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTimingObligations, checkCandidateTiming } from '../server/build/timing-obligations.mjs';

const case02 = {
  external_id: 'CASE-02',
  steps: [
    { order: 1, action: '在“名称筛选”输入框中输入“温控”，点击“查询”按钮', expected: '出现可见加载提示“正在加载设备列表…”，约 400-600ms 后提示消失且列表刷新；分页指示为“第 1 页 / 共 2 页（共 3 条）”。' },
    { order: 2, action: '观察筛选结果', expected: '显示两行结果。' },
    { order: 4, action: '点击 INV-104 所在行的“查看详情”按钮', expected: '右侧抽屉打开并先显示“正在加载设备详情…”，约 400-600ms 后显示：编号 INV-104、权限提示“当前角色 inspector 可选择该设备”。' },
  ],
};

function one(expected, action = '点击“查询”按钮') {
  return { steps: [{ order: 1, action, expected }] };
}

test('CASE-02 extracts both exact frozen loading ranges and preserves their text', () => {
  const obligations = extractTimingObligations(case02);
  assert.equal(obligations.length, 2);
  assert.deepEqual(obligations.map(({ id, step, target, min_ms, max_ms, raw_range, status }) => ({ id, step, target, min_ms, max_ms, raw_range, status })), [
    { id: 'CASE_STEP_1:timing:1', step: 1, target: '正在加载设备列表…', min_ms: 400, max_ms: 600, raw_range: '400-600ms', status: 'RUNTIME_REQUIRED' },
    { id: 'CASE_STEP_4:timing:1', step: 4, target: '正在加载设备详情…', min_ms: 400, max_ms: 600, raw_range: '400-600ms', status: 'RUNTIME_REQUIRED' },
  ]);
  assert.equal(obligations[0].requirement, case02.steps[0].expected);
  assert.equal(obligations[1].requirement, case02.steps[2].expected);
});

test('seconds and mixed explicit units convert to milliseconds with inclusive boundary values', () => {
  const seconds = extractTimingObligations(one('加载提示“正在加载…”持续 0.4-0.6s 后消失。'))[0];
  assert.deepEqual([seconds.min_ms, seconds.max_ms, seconds.raw_range], [400, 600, '0.4-0.6s']);
  const mixed = extractTimingObligations(one('加载提示“正在加载…”持续 400毫秒-0.6秒 后消失。'))[0];
  assert.deepEqual([mixed.min_ms, mixed.max_ms], [400, 600]);
  const boundary = extractTimingObligations(one('加载提示“正在加载…”持续 400-400毫秒 后消失。'))[0];
  assert.equal(boundary.status, 'RUNTIME_REQUIRED');
  assert.deepEqual([boundary.min_ms, boundary.max_ms], [400, 400]);
});

test('ambiguous targets, ranges and units stay in review', () => {
  const examples = [
    ['加载提示“正在加载A…”和“正在加载B…”持续 400-600ms 后消失。', 'MULTIPLE_LOADING_TARGETS'],
    ['加载提示持续 400-600ms 后消失。', 'QUOTED_LOADING_TARGET_REQUIRED'],
    ['加载提示“正在加载…”在 600ms 后消失。', 'TIME_RANGE_NOT_UNIQUELY_RECOGNIZED'],
    ['加载提示“正在加载…”约 400-600 后消失。', 'TIME_RANGE_NOT_UNIQUELY_RECOGNIZED'],
    ['加载提示“正在加载…”先持续 400-600ms，再持续 700-800ms。', 'MULTIPLE_TIME_RANGES'],
    ['加载提示“正在加载…”持续 400-600ms 后消失，且最长不超过 1000ms。', 'ADDITIONAL_TIME_LIMIT'],
    ['加载提示“正在加载…”持续 600-400ms 后消失。', 'INVALID_TIME_RANGE'],
  ];
  for (const [expected, reason] of examples) {
    const result = extractTimingObligations(one(expected));
    assert.equal(result.length, 1, expected);
    assert.equal(result[0].status, 'NEEDS_REVIEW', expected);
    assert.equal(result[0].reason, reason, expected);
    assert.equal(result[0].requirement, expected);
    assert.equal(result[0].min_ms, undefined);
  }
});

test('old 300-2000ms candidate pattern is rejected without relying on historical files', () => {
  const code = `
    test.step('CASE_STEP_1', async () => {
      const startedAt = Date.now();
      await nameFilter.fill('温控');
      await searchButton.click();
      await expect(listLoading).toBeVisible();
      await expect(listLoading).toBeHidden({ timeout: 5000 });
      const elapsedMs = Date.now() - startedAt;
      expect(elapsedMs).toBeGreaterThanOrEqual(300);
      expect(elapsedMs).toBeLessThanOrEqual(2000);
    });
    test.step('CASE_STEP_4', async () => {
      const startedAt = Date.now();
      await detailButton.click();
      await expect(detailLoading).toBeVisible();
      await expect(detailLoading).toBeHidden({ timeout: 5000 });
      const elapsedMs = Date.now() - startedAt;
      expect(elapsedMs).toBeGreaterThanOrEqual(300);
      expect(elapsedMs).toBeLessThanOrEqual(2000);
    });`;
  const result = checkCandidateTiming(code, case02);
  assert.equal(result.obligations.length, 2);
  assert.ok(result.violations.some(item => item.code === 'TIMING_MUST_USE_RUNNER_OBSERVATION'));
  assert.ok(result.violations.every(item => item.line != null && item.column != null));
  assert.ok(result.violations.every(item => item.code === 'TIMING_MUST_USE_RUNNER_OBSERVATION'));
});

test('candidate timing check does not inspect step or helper structure', () => {
  const supported = one('加载提示“正在加载…”持续 400-600ms 后消失。');
  assert.deepEqual(checkCandidateTiming('export const helper = () => true;', supported).violations, []);
});

test('AST catches direct, aliased and global-property clocks', () => {
  for (const expression of [
    'Date.now()', 'new Date()', 'const clock = Date.now; clock()',
    'performance.now()', 'const clock = performance; clock.now()',
    'window.performance.now()', 'window["performance"].now()',
    'window[key].now()', 'globalThis["Date"].now()',
    'process.hrtime.bigint()', 'document.timeline.currentTime',
  ]) {
    const result = checkCandidateTiming(expression, one('加载提示“正在加载…”持续 400-600ms 后消失。'));
    assert.ok(result.violations.some(item => item.code === 'TIMING_MUST_USE_RUNNER_OBSERVATION'), expression);
  }
});

test('comment text and plain timeout parameters do not trigger the clock rule', () => {
  const code = `
    // Date.now() and performance.now() would be candidate-owned clocks.
    test.step('CASE_STEP_1', async () => {
      await searchButton.click({ timeout: 5000 });
      await expect(listLoading).toBeVisible({ timeout: 5000 });
      await expect(listLoading).toBeHidden({ timeout: 5000 });
    });`;
  const result = checkCandidateTiming(code, one('加载提示“正在加载…”持续 400-600ms 后消失。'));
  assert.deepEqual(result.violations, []);
});

test('a case without numeric timing obligations leaves existing candidates alone', () => {
  const noTime = one('加载提示“正在加载设备列表…”出现后消失；显示第 1 页。');
  assert.deepEqual(extractTimingObligations(noTime), []);
  assert.deepEqual(checkCandidateTiming('Date.now(); new Date();', noTime), { obligations: [], violations: [] });
});
