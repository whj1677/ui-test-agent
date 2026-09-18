import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../src/report-view.mjs';

const original = {
  case_id: 'C1',
  title: '动态步骤报告',
  steps: [{ step_id: 'S1', action: '检查字段A和B', expected: 'A和B均匹配' }],
};
function fixture(overrides = {}) {
  return {
    id: 'run',
    status: 'TECHNICAL_FAILED',
    error: 'ADAPTIVE_SEGMENT_LIMIT',
    adaptive_segments: [{ step_id: 'S1', status: 'EXECUTED' }],
    adaptive_steps: [],
    assertions: [
      {
        step_id: 'S1',
        checkpoint_id: 'p1',
        check: 'text',
        passed: true,
        expected: 'A',
        actual: 'A',
      },
    ],
    actions: [],
    checkpoints: [{ step_id: 'S1', checkpoint_id: 'p1', status: 'ASSERTIONS_PASSED' }],
    ...overrides,
  };
}
function render(fact) {
  const html = renderReport({
    state: { name: '合成报告测试', target: 'http://fixture.invalid', events: [] },
    baseline: { cases: [original] },
    projection: { scope_valid: true },
    manifest: {
      counts: {
        total: 1,
        attempted: 1,
        pass: fact.status === 'PASS_ASSERTIONS' ? 1 : 0,
        fail: fact.status === 'FAIL_ASSERTION' ? 1 : 0,
        technical_failed: fact.status === 'TECHNICAL_FAILED' ? 1 : 0,
        evidence_incomplete: 0,
        cleanup_required: 0,
      },
    },
    rows: [
      {
        c: { case_id: 'C1', status: fact.status, latest: fact, issues: [] },
        record: {},
        original,
        effective: original,
        attempts: [],
      },
    ],
    scopeText: '仅合成事实',
    labels: {},
  });
  return { html, row: html.match(/<tbody>(.*?)<\/tbody>/s)[1] };
}
const green = '<span class="pill good">断言满足</span>';
const complete = [{ step_id: 'S1', status: 'COMPLETE' }];

test('after-action table invariant failure is visible without inventing planned assertions', () => {
  const fact = fixture({
    status: 'FAIL_ASSERTION',
    error: 'BUSINESS_ASSERTION_FAILED',
    assertions: [],
    relational_observations: [
      {
        step_id: 'S1',
        checkpoint_id: 'p1',
        check: 'table_unchanged',
        passed: false,
        group_passed: false,
        oracle_quote: '表格不应用新条件',
        actual: '中间字段已变化',
        table_comparison: {
          checked_cells: 25,
          differences: [
            { column: '额定功率', expected: '100 kW', actual: '999 kW', reason: 'cell_changed' },
          ],
        },
      },
    ],
    checkpoints: [{ step_id: 'S1', checkpoint_id: 'p1', status: 'FAIL_ASSERTION' }],
  });
  const before = structuredClone(fact);
  const { row } = render(fact);
  assert.match(row, /动作后关系检查/);
  assert.match(row, /100 kW/);
  assert.match(row, /999 kW/);
  assert.match(row, /断言不一致/);
  assert.ok(!row.includes(green));
  assert.equal(fact.assertions.length, 0);
  assert.deepEqual(fact, before);
});

test('partial matched evidence followed by segment exhaustion is not a passed step or case', () => {
  const fact = fixture(),
    before = structuredClone(fact);
  const { html, row } = render(fact);
  assert.ok(!row.includes(green));
  assert.match(row, /未完成断言/);
  assert.match(row, /步骤未完成：ADAPTIVE_SEGMENT_LIMIT/);
  assert.match(row, /实际：A/);
  assert.match(html, /<span>断言满足<\/span><strong>0<\/strong>/);
  assert.match(html, /data-group="attention"/);
  assert.deepEqual(fact, before, 'rendering must not rewrite execution facts');
});

for (const marker of ['adaptive_segments', 'adaptive_steps']) {
  test(`${marker} alone (including empty array) requires matching COMPLETE`, () => {
    const fact = fixture();
    delete fact.adaptive_segments;
    delete fact.adaptive_steps;
    fact[marker] = [];
    delete fact.error;
    const { row } = render(fact);
    assert.ok(!row.includes(green));
    assert.match(row, /尚无本步骤的 COMPLETE 完成记录/);
  });
}

test('matching COMPLETE plus all passing fields and checkpoints is green', () => {
  const { row } = render(
    fixture({ status: 'PASS_ASSERTIONS', error: null, adaptive_steps: complete }),
  );
  assert.ok(row.includes(green));
  assert.doesNotMatch(row, /步骤未完成/);
});

for (const adaptive_steps of [[], complete]) {
  test(`failed table field remains a mismatch with COMPLETE=${!!adaptive_steps.length}`, () => {
    const { row } = render(
      fixture({
        status: 'FAIL_ASSERTION',
        error: 'ASSERTION_FAILED',
        adaptive_steps,
        assertions: [
          {
            step_id: 'S1',
            check: 'table_cells',
            passed: false,
            table_comparison: {
              checked_cells: 25,
              differences: [
                { key: 'D003', column: '频率', expected: 50, actual: 60, reason: 'value_mismatch' },
              ],
            },
          },
        ],
      }),
    );
    assert.ok(!row.includes(green));
    assert.match(row, /pill bad">断言不一致/);
    assert.match(row, /已比对 25 个字段/);
    assert.match(row, /D003 \/ 频率：期望 50，实际 60/);
    if (!adaptive_steps.length) assert.match(row, /步骤未完成：ASSERTION_FAILED/);
  });
}

test('another step COMPLETE and this step pending cannot establish completion', () => {
  const { row } = render(
    fixture({
      adaptive_steps: [
        { step_id: 'S2', status: 'COMPLETE' },
        { step_id: 'S1', status: 'RUNNING' },
      ],
    }),
  );
  assert.ok(!row.includes(green));
  assert.match(row, /未完成断言/);
});

test('COMPLETE does not override group failure, unfinished checkpoint or absent assertions', () => {
  for (const overrides of [
    { assertions: [{ step_id: 'S1', passed: true, group_passed: false }] },
    { checkpoints: [{ step_id: 'S1', status: 'RUNNING' }] },
    { assertions: [] },
  ])
    assert.ok(!render(fixture({ adaptive_steps: complete, ...overrides })).row.includes(green));
});

test('current step failure reason is preferred and escaped; case timeout is the fallback', () => {
  const { row } = render(
    fixture({
      adaptive_segments: [
        { step_id: 'S1', error: '<audit-rejected>' },
        { step_id: 'S2', error: 'unrelated-error' },
      ],
    }),
  );
  assert.match(row, /步骤未完成：&lt;audit-rejected&gt;/);
  assert.doesNotMatch(row, /<audit-rejected>|unrelated-error/);
  assert.match(render(fixture({ error: 'STEP_DEADLINE_EXCEEDED' })).row, /本步骤总预算已耗尽/);
});

test('dynamic step without observations stays incomplete with its reason', () => {
  const { row } = render(fixture({ assertions: [], checkpoints: [] }));
  assert.match(row, /未完成断言/);
  assert.match(row, /步骤未完成：ADAPTIVE_SEGMENT_LIMIT/);
});

test('legacy facts without adaptive markers retain passing, failed and unexecuted behavior', () => {
  const fact = fixture();
  delete fact.adaptive_segments;
  delete fact.adaptive_steps;
  assert.ok(render(fact).row.includes(green));
  assert.doesNotMatch(render(fact).row, /步骤未完成/);
  fact.assertions[0].passed = false;
  assert.match(render(fact).row, /pill bad">断言不一致/);
  fact.assertions = [];
  fact.checkpoints = [];
  assert.match(render(fact).row, /pill warn">未执行/);
});
