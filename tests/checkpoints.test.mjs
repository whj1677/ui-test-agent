import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { stepOutcome } from '../public/evidence-view.js';
import { demoCases } from '../src/demo.mjs';
import { validatePlan, planHash, normalizePlanResponse, validateRepair } from '../src/plans.mjs';
import { auditInput, validatePlanAudit } from '../src/plan-quality.mjs';
import { stepAssertions } from '../src/plan-steps.mjs';
import { StepBudget } from '../src/step-budget.mjs';
import { semanticHash, escapeHTML } from '../src/common.mjs';
import { isAdaptivePlan } from '../src/adaptive-plan.mjs';

const base = 'http://127.0.0.1:4000';
const code = (value) => (error) => error.code === value;
function fixture(mutation = false) {
  const { baseline, plans } = demoCases();
  const index = mutation ? 1 : 0;
  const c = baseline.cases[index],
    p = plans[index];
  p.schema_version = 'ui-agent-plan/v3';
  p.steps = p.steps.map(({ actions, assertions, within_ms, ...step }, index) => ({
    ...step,
    assertion_mode: 'sequential_checkpoints',
    timeout_ms: 20000,
    checkpoints: assertions.map((assertion, at) => ({
      checkpoint_id: `CP-${index}-${at}`,
      actions: at ? [] : actions,
      within_ms,
      assertions: [assertion],
    })),
  }));
  return { c, p };
}

test('v3 preserves original steps and covers obligations across distinct checkpoints', () => {
  const { c, p } = fixture();
  assert.equal(validatePlan(p, c, base), p);
  assert.deepEqual(normalizePlanResponse(p), { plan: p });
  const before = planHash(p);
  p.steps[0].checkpoints.reverse();
  assert.notEqual(planHash(p), before);
});

for (const [name, change, error] of [
  ['missing obligation', (p) => p.steps[0].checkpoints.pop(), 'ORACLE_COVERAGE_INCOMPLETE'],
  [
    'duplicate checkpoint',
    (p) => (p.steps[0].checkpoints[1].checkpoint_id = p.steps[0].checkpoints[0].checkpoint_id),
    'CHECKPOINT_ID_INVALID',
  ],
  ['unbounded step clock', (p) => (p.steps[0].timeout_ms = 120001), 'STEP_DEADLINE_INVALID'],
  [
    'empty checkpoint',
    (p) => (p.steps[0].checkpoints[0].assertions = []),
    'ASSERTION_COUNT_INVALID',
  ],
  [
    'false simultaneous declaration',
    (p) => (p.steps[0].assertion_mode = 'simultaneous'),
    'ASSERTION_MODE_UNSUPPORTED',
  ],
  ['extra executable code', (p) => (p.steps[0].checkpoints[0].script = 'run()'), 'INVALID_SCHEMA'],
  ['v2 silent migration', (p) => (p.schema_version = 'ui-agent-plan/v2'), 'INVALID_SCHEMA'],
  ['unknown version', (p) => (p.schema_version = 'ui-agent-plan/v4'), 'PLAN_BASELINE_MISMATCH'],
])
  test(`checkpoint plan rejects ${name}`, () => {
    const { c, p } = fixture();
    change(p);
    assert.throws(() => validatePlan(p, c, base), code(error));
  });

test('original-step capacity cannot be multiplied by splitting checkpoints', () => {
  const { c, p } = fixture();
  const points = p.steps[0].checkpoints;
  points[0].assertions = Array(11).fill(points[0].assertions[0]);
  points[1].assertions = Array(10).fill(points[1].assertions[0]);
  assert.throws(() => validatePlan(p, c, base), code('ASSERTION_COUNT_INVALID'));
});

test('audit indices span checkpoints and reject an index from the wrong obligation', () => {
  const { c, p } = fixture();
  const input = auditInput(c, p);
  assert.deepEqual(
    input.assertion_index[0].entries.map((x) => x.checkpoint_id),
    ['CP-0-0', 'CP-0-1'],
  );
  const assertions = stepAssertions(p.steps[0]);
  const reply = {
    issues: [],
    checks: c.steps[0].obligations.map((obligation) => ({
      step_id: c.steps[0].step_id,
      obligation_id: obligation.id,
      status: 'COVERED',
      assertion_indices: assertions.flatMap((a, index) =>
        a.obligation_ids.includes(obligation.id) ? [index] : [],
      ),
      reason: '固定输入验证引用顺序，不证明模型语义判断',
    })),
  };
  assert.equal(validatePlanAudit(reply, c, p).outcome, 'ACCEPT');
  reply.checks[1].assertion_indices = [0];
  assert.throws(
    () => validatePlanAudit(reply, c, p),
    code('PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'),
  );
});

test('approved read-only locator recovery still finds actions inside checkpoints', () => {
  const { c, p } = fixture();
  const a = p.steps[0].checkpoints[0].actions[0];
  const failure = {
    action_id: a.action_id,
    phase: 'RESOLVE',
    dispatched: false,
    code: 'LOCATOR_NOT_VISIBLE',
    current_target: a.target,
  };
  const patch = {
    schema_version: 'ui-agent-locator-patch/v1',
    action_id: a.action_id,
    old_target_hash: semanticHash(a.target),
    target: { kind: 'label', value: '商品名称', exact: true },
  };
  assert.deepEqual(validateRepair(patch, p, c, base, failure).target, patch.target);
});

test('cleanup observation routes are versioned, same-origin and part of approval', () => {
  const { c, p } = fixture(true);
  const prior = planHash(p);
  p.cleanup.observation_path = '/tasks';
  validatePlan(p, c, base);
  assert.notEqual(planHash(p), prior);
  p.cleanup.observation_path = 'https://outside.test/delete';
  assert.throws(() => validatePlan(p, c, base), code('OUTSIDE_TARGET_ORIGIN'));
});

test('step budget cannot be reset by later checkpoints and v2 keeps its observation window', () => {
  let now = 1000;
  const budget = new StepBudget(1000, () => now);
  now = 1800;
  assert.equal(budget.remaining(8000), 200);
  assert.equal(budget.observationDeadline(now, 8000), 2000);
  now = 2000;
  assert.throws(() => budget.remaining(), code('STEP_DEADLINE_EXCEEDED'));
  const legacy = new StepBudget(undefined, () => now);
  now += 100000;
  assert.equal(legacy.remaining(), 8000);
  assert.equal(legacy.observationDeadline(now, 500), now + 500);
});

test('console shows original expectation, each checkpoint, time meaning and cleanup path', async () => {
  const source = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function planHTML(plan) {');
  const end = source.indexOf('\nfunction approveSelected', start);
  const context = {
    h: escapeHTML,
    isAdaptivePlan,
    loc: (target) => target?.value ?? '',
    opName: { click: '点击' },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const { p } = fixture(true);
  p.cleanup.observation_path = '/tasks';
  const html = context.planHTML(p);
  assert.ok(html.includes('检查点 1'));
  assert.ok(html.includes('不表示同一时刻或全过程成立'));
  assert.ok(html.includes('/tasks'));
  assert.ok(html.includes('原预期'));
});

test('report retains matching earlier observations without claiming the unfinished step passed', async () => {
  const source = await fs.readFile(new URL('../src/report-view.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function adaptiveStepIncomplete(');
  const end = source.indexOf('\nfunction renderCase(', start);
  const context = {
    h: escapeHTML,
    time: (value) => value,
    value: String,
    checks: { text: '文本等于' },
    target: () => '详情',
    stepOutcome,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const html = context.stepRows(
    { steps: [{ step_id: 'S1', action: '跨页查看', expected: '两页字段正确' }] },
    {
      actions: [],
      assertions: [
        { step_id: 'S1', checkpoint_id: 'FIRST', passed: true, actual: '正确', check: 'text' },
      ],
      checkpoints: [
        {
          step_id: 'S1',
          checkpoint_id: 'FIRST',
          status: 'ASSERTIONS_PASSED',
          observed_at: '2026-09-16T00:00:00Z',
        },
        { step_id: 'S1', checkpoint_id: 'LATER', status: 'NOT_EXECUTED' },
      ],
    },
  );
  assert.ok(html.includes('本点断言满足'));
  assert.ok(html.includes('未执行'));
  assert.ok(html.includes('未完成断言'));
  assert.ok(!html.includes('pill good'));
});
