import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Controller } from '../src/controller.mjs';
import { Store, effectiveCase } from '../src/store.mjs';
import { DiagnosticLog } from '../src/telemetry.mjs';
import { demoCases } from '../src/demo.mjs';
import { caseHash, planHash, PLAN_PROMPT, REVIEW_PROMPT } from '../src/plans.mjs';
import { repairInputHash } from '../src/plan-repair.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';
import { PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';

const base = 'http://127.0.0.1:4000';
const clone = structuredClone;
const code = (expected) => (error) => error.code === expected;
const confirmation = (c) => ({
  steps: c.steps.map((s) => ({
    step_id: s.step_id,
    action: s.action,
    expected: s.expected,
    obligations: clone(s.obligations),
  })),
  note: '测试夹具作者确认原文，未改变业务预期。',
});

function phaseOf(prompt, input) {
  if (prompt.startsWith(INPUT_REVIEW_PROMPT)) return 'input_review';
  if (prompt.startsWith(REVIEW_PROMPT)) return 'review';
  if (prompt.startsWith(PLAN_AUDIT_PROMPT)) return 'plan_audit';
  if (prompt.startsWith(PLAN_PROMPT)) return 'plan';
  if (input?.blocked_response) return 'blocked_audit';
  throw new Error('Unexpected model phase in self-repair fixture');
}
function covered(c, plan) {
  return {
    checks: c.steps.flatMap((step) =>
      step.obligations.map((obligation) => ({
        step_id: step.step_id,
        obligation_id: obligation.id,
        status: 'COVERED',
        assertion_indices: plan.steps
          .find((s) => s.step_id === step.step_id)
          .assertions.flatMap((a, i) => (a.obligation_ids.includes(obligation.id) ? [i] : [])),
        reason: 'Mocked semantic audit for controller boundary verification.',
      })),
    ),
    issues: [],
  };
}
function auditProblem(c, plan, status = 'MISSING', issueCode = 'ASSERTION_GAP') {
  const reply = covered(c, plan);
  reply.checks[0].status = status;
  reply.checks[0].reason = '第一项只观察了控件可见性，不能证明原预期中的精确业务值。';
  reply.issues.push({
    code: issueCode,
    step_id: c.steps[0].step_id,
    reason: reply.checks[0].reason,
  });
  return reply;
}
async function fixture(handler, { caseUpdate, browser = {} } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-self-repair-')),
    store = new Store(directory);
  await store.init();
  const { baseline, plans } = demoCases();
  if (caseUpdate) {
    caseUpdate(baseline.cases[0]);
    plans[0].case_hash = caseHash(baseline.cases[0]);
  }
  const id = await store.create({ name: 'Self-repair boundary fixture', target: base, baseline }),
    calls = [];
  const f = { directory, store, baseline, plans, id, calls, browser };
  f.provider = {
    configured: () => true,
    model: 'injected-self-repair-fixture',
    json: async (prompt, input, options) => {
      const phase = phaseOf(prompt, input),
        record = { phase, prompt, input: clone(input) };
      calls.push(record);
      const custom = handler
        ? await handler({ phase, prompt, input, options, f, record })
        : undefined;
      const value =
        custom ??
        (['input_review', 'review'].includes(phase)
          ? { issues: [] }
          : phase === 'plan_audit'
            ? covered(input.original, input.candidate_plan)
            : { plan: clone(plans.find((plan) => plan.case_id === input.original.case_id)) });
      return {
        value,
        usage: {
          response_model: 'injected-self-repair-fixture',
          prompt_tokens: 1,
          completion_tokens: 1,
        },
      };
    },
  };
  f.controller = new Controller({ store, provider: f.provider, browser });
  await store.update(id, (state) => {
    state.snapshots = [{ text: '商品查询；苹果、香蕉、牛奶', captured_at: 'initial capture' }];
  });
  for (const c of baseline.cases) await f.controller.confirmCase(id, c.case_id, confirmation(c));
  return f;
}
async function launch(f, ids = [f.baseline.cases[0].case_id]) {
  await f.controller.launch(f.id, 'plan', ids);
  const job = f.controller.active;
  await job.finished;
  return job;
}
const row = async (f) => (await f.store.read(f.id)).cases[0];
const plansRequested = (f) => f.calls.filter((call) => call.phase === 'plan');

test('starting-page job metadata alone is not a new planning input', () => {
  const c = { case_id: 'C', steps: [{ step_id: 'S1', action: '点击菜单', expected: '打开目录' }] };
  const state = {
    target: base,
    snapshots: [],
    navigation_start: { url: base + '/home', controls: [], navigation_job_id: 'first' },
  };
  const before = repairInputHash(state, c, {});
  state.navigation_start.navigation_job_id = 'second';
  assert.equal(repairInputHash(state, c, {}), before);
});

test('invalid locator feedback reaches the next candidate with exact path, previous candidate and unchanged budget', async () => {
  let count = 0;
  const f = await fixture(({ phase, f }) => {
    if (phase === 'plan' && count++ === 0) {
      const bad = clone(f.plans[0]);
      bad.steps[0].actions[0].target = { kind: 'button', name: '查询', exact: true };
      return { plan: bad };
    }
  });
  await launch(f);
  const result = await row(f);
  const second = plansRequested(f)[1].input.self_repair;
  assert.equal(second.feedback.field_path, 'plan.steps[0].actions[0].target.kind');
  assert.ok(second.feedback.allowed_kinds.includes('role'));
  assert.equal(second.previous_candidate.steps[0].actions[0].target.kind, 'button');
  assert.equal(result.self_repair.rounds[0].feedback.field_path, second.feedback.field_path);
  assert.equal(result.preparation_budget.used, 2);
  assert.equal(result.plan_history[0].status, 'INVALID');
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.equal(result.plan_approved, false);
});

test('a free quote cannot authorize block repair or erase the original missing cleanup reason', async () => {
  const blockedReason = '缺少该测试记录的精确删除定位。';
  const f = await fixture(({ phase }) => {
    if (phase === 'plan') return { blocked: true, reason: blockedReason };
    if (phase === 'blocked_audit')
      return { outcome: 'REPAIR', reason: '详情说明存在删除能力。', evidence_quotes: ['详情'] };
  });
  await f.store.update(f.id, (state) => {
    state.snapshots = [
      { text: '详情', controls: [{ name: '详情', locator: { kind: 'testid', value: 'details' } }] },
    ];
  });
  await launch(f);
  const result = await row(f);
  assert.equal(result.status, 'BLOCKED_MAPPING');
  assert.equal(result.mapping_reason, blockedReason);
  assert.equal(result.self_repair.rounds[0].block_audit.validation_error, 'INVALID_SCHEMA');
  assert.equal(plansRequested(f).length, 1);
  assert.equal(result.plan, null);
  assert.deepEqual(result.attempts, []);
});

test('a grounded block review requests a new candidate, preserves the obstacle, and still requires audit and approval', async () => {
  const blockedReason = '未找到商品查询输入框。';
  let count = 0;
  const f = await fixture(({ phase, input }) => {
    if (phase === 'plan' && count++ === 0) return { blocked: true, reason: blockedReason };
    if (phase === 'blocked_audit') {
      const entry = input.evidence_catalog[0];
      return {
        outcome: 'REPAIR',
        reason: '已采集到商品查询输入框，可据此重新规划。',
        evidence_refs: [{ evidence_id: entry.evidence_id, fact: entry.fact }],
      };
    }
  });
  await f.store.update(f.id, (state) => {
    state.snapshots = [
      { controls: [{ name: '商品名称', locator: { kind: 'testid', value: 'product-search' } }] },
    ];
  });
  await launch(f);
  const result = await row(f);
  assert.equal(result.self_repair.rounds[0].reason, blockedReason);
  assert.equal(result.self_repair.rounds[0].status, 'BLOCKED');
  assert.equal(result.self_repair.rounds[0].block_audit.outcome, 'REPAIR');
  const feedback = plansRequested(f)[1].input.self_repair.feedback;
  assert.equal(feedback.reason, blockedReason);
  assert.ok(feedback.review_reason.includes('重新规划'));
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.equal(result.plan_audit.outcome, 'ACCEPT');
  assert.equal(result.plan_approved, false);
  assert.deepEqual(result.attempts, []);
});

test('changing the details fact to claim delete is rejected before another planning attempt', async () => {
  const f = await fixture(({ phase, input }) => {
    if (phase === 'plan') return { blocked: true, reason: '删除依据缺失' };
    if (phase === 'blocked_audit') {
      const entry = input.evidence_catalog[0];
      return {
        outcome: 'REPAIR',
        reason: '存在删除按钮',
        evidence_refs: [{ evidence_id: entry.evidence_id, fact: { ...entry.fact, name: '删除' } }],
      };
    }
  });
  await f.store.update(f.id, (state) => {
    state.snapshots = [
      { controls: [{ name: '详情', locator: { kind: 'testid', value: 'details' } }] },
    ];
  });
  await launch(f);
  assert.equal(
    (await row(f)).self_repair.rounds[0].block_audit.validation_error,
    'BLOCK_AUDIT_EVIDENCE_INVALID',
  );
  assert.equal(plansRequested(f).length, 1);
});

test('a malformed boolean candidate is repaired before audit, without automatic approval or execution', async () => {
  let count = 0;
  const f = await fixture(({ phase, f }) => {
    if (phase === 'plan' && count++ === 0) {
      const bad = clone(f.plans[0]);
      bad.steps[0].assertions[0].check = 'enabled';
      bad.steps[0].assertions[0].expected = 'true';
      return { plan: bad };
    }
  });
  const baselineBefore = await f.store.baseline(f.id);
  await launch(f);
  const result = await row(f);
  assert.deepEqual(
    f.calls.map((c) => c.phase),
    ['input_review', 'plan', 'plan', 'plan_audit'],
  );
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.equal(result.plan_approved, false);
  assert.deepEqual(result.attempts, []);
  assert.equal(result.self_repair.repair_count, 1);
  assert.equal(result.self_repair.rounds[0].code, 'ASSERTION_BOOL_INVALID');
  assert.equal(result.self_repair.outcome, 'ACCEPTED');
  assert.equal(result.plan_audit.plan_hash, planHash(result.plan));
  assert.deepEqual(await f.store.baseline(f.id), baselineBefore);
  const correction = plansRequested(f)[1].input.self_repair;
  assert.equal(correction.round, 1);
  assert.equal(correction.max_repairs, 2);
  assert.equal(correction.feedback.code, 'ASSERTION_BOOL_INVALID');
});

test('semantic coverage failure repairs the candidate then audits the complete replacement again', async () => {
  let candidate = 0,
    audit = 0;
  const f = await fixture(({ phase, input, f }) => {
    if (phase === 'plan' && candidate++ === 0) {
      const incomplete = clone(f.plans[0]);
      incomplete.steps[0].assertions[0].check = 'visible';
      delete incomplete.steps[0].assertions[0].expected;
      return { plan: incomplete };
    }
    if (phase === 'plan_audit' && audit++ === 0)
      return auditProblem(input.original, input.candidate_plan);
  });
  await launch(f);
  const result = await row(f);
  assert.deepEqual(
    f.calls.map((c) => c.phase),
    ['input_review', 'plan', 'plan_audit', 'plan', 'plan_audit'],
  );
  assert.equal(result.self_repair.rounds[0].status, 'AUDIT_REJECTED');
  assert.equal(result.self_repair.rounds[0].code, 'PLAN_SEMANTIC_GAP');
  assert.equal(result.self_repair.rounds[1].status, 'ACCEPTED');
  assert.equal(result.plan.steps[0].assertions[0].check, 'text');
  assert.equal(plansRequested(f)[1].input.self_repair.feedback.issues[0].code, 'ASSERTION_GAP');
  assert.deepEqual(
    result.plan_audit.checks.map((c) => c.status),
    ['COVERED', 'COVERED'],
  );
});

test('repair cannot adopt a rewritten expectation or modify the confirmed baseline', async () => {
  let count = 0;
  const f = await fixture(({ phase, f }) => {
    if (phase === 'plan' && count++ === 0) {
      const weakened = clone(f.plans[0]);
      weakened.steps[0].source_expected = '只要结果区域可见即可。';
      return { plan: weakened };
    }
  });
  const before = await f.store.baseline(f.id),
    confirmationBefore = (await row(f)).confirmations;
  await launch(f);
  const result = await row(f);
  assert.equal(result.self_repair.rounds[0].code, 'PLAN_ORIGINAL_STEP_CHANGED');
  for (const request of plansRequested(f))
    assert.deepEqual(request.input.original, before.cases[0]);
  assert.equal(result.plan.steps[0].source_expected, before.cases[0].steps[0].expected);
  assert.deepEqual(result.confirmations, confirmationBefore);
  assert.deepEqual(await f.store.baseline(f.id), before);
});

test('grounded unresolved input conflict stops before planning and requests operator clarification', async () => {
  const f = await fixture(
    ({ phase }) =>
      phase === 'input_review'
        ? {
            issues: [
              {
                code: 'CONTRADICTION',
                step_id: 'S1',
                message: '步骤填写苹果，测试数据填写香蕉，请确认实际测试输入。',
                source_quotes: ['商品名称输入苹果', '香蕉'],
              },
            ],
          }
        : undefined,
    {
      caseUpdate: (c) => {
        c.data = { query: '香蕉' };
      },
    },
  );
  await launch(f);
  const result = await row(f);
  assert.deepEqual(
    f.calls.map((c) => c.phase),
    ['input_review'],
  );
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.equal(result.reviewed, false);
  assert.equal(result.self_repair.outcome, 'NEEDS_CLARIFICATION');
  assert.equal(result.self_repair.rounds.length, 0);
  assert.equal(result.plan, null);
  assert.ok(result.issues[0].quote_locations.length);
  assert.equal((await f.store.baseline(f.id)).cases[0].data.query, '香蕉');
});

test('plan-audit uncertainty preserves confirmed input and stops repeated unchanged candidate', async () => {
  const f = await fixture(({ phase, input }) =>
    phase === 'plan_audit'
      ? auditProblem(input.original, input.candidate_plan, 'UNCLEAR', 'ORACLE_UNCLEAR')
      : undefined,
  );
  await launch(f);
  const result = await row(f);
  assert.deepEqual(
    f.calls.map((c) => c.phase),
    ['input_review', 'plan', 'plan_audit', 'plan'],
  );
  assert.equal(result.status, 'BLOCKED_MAPPING');
  assert.equal(result.reviewed, true);
  assert.equal(result.self_repair.outcome, 'EXHAUSTED');
  assert.equal(result.self_repair.repair_count, 1);
  assert.equal(result.plan_approved, false);
});

test('an identical rejected candidate stops early rather than consuming all remaining repair attempts', async () => {
  const f = await fixture(({ phase }) =>
    phase === 'plan' ? { plan: { wrong: 'the exact same rejected candidate' } } : undefined,
  );
  await launch(f);
  const result = await row(f),
    state = await f.store.read(f.id);
  assert.equal(plansRequested(f).length, 2);
  assert.equal(result.self_repair.repair_count, 1);
  assert.equal(result.self_repair.rounds.length, 2);
  assert.equal(result.self_repair.outcome, 'EXHAUSTED');
  assert.equal(result.status, 'BLOCKED_MAPPING');
  assert.equal(result.plan, null);
  assert.ok(
    state.events.some(
      (e) => e.type === 'PLAN_REPAIR_EXHAUSTED' && e.code === 'PLAN_REPAIR_NO_PROGRESS',
    ),
  );
});

test('an unchanged semantically rejected candidate cannot become accepted merely because a second audit changes its answer', async () => {
  let audits = 0;
  const f = await fixture(({ phase, input, f }) => {
    if (phase === 'plan') {
      const unchanged = clone(f.plans[0]);
      unchanged.steps[0].assertions[0].check = 'visible';
      delete unchanged.steps[0].assertions[0].expected;
      return { plan: unchanged };
    }
    if (phase === 'plan_audit' && audits++ === 0)
      return auditProblem(input.original, input.candidate_plan);
  });
  await launch(f);
  const result = await row(f);
  assert.equal(
    result.status,
    'BLOCKED_MAPPING',
    'the second identical candidate still has the original semantic defect',
  );
  assert.equal(result.plan, null);
  assert.equal(result.self_repair.outcome, 'EXHAUSTED');
  assert.equal(plansRequested(f).length, 2);
  assert.equal(
    f.calls.filter((c) => c.phase === 'plan_audit').length,
    1,
    'no progress is detected before asking another auditor',
  );
});

test('two repairs are durable across controller restart, a timestamp refresh and identical reconfirmation', async () => {
  let count = 0;
  const f = await fixture(({ phase }) =>
    phase === 'plan' ? { plan: { wrong: ++count } } : undefined,
  );
  await launch(f);
  const initial = await row(f),
    callsBefore = f.calls.length;
  assert.equal(plansRequested(f).length, 3);
  assert.equal(initial.self_repair.repair_count, 2);
  assert.equal(initial.self_repair.outcome, 'EXHAUSTED');
  f.controller = new Controller({ store: f.store, provider: f.provider, browser: f.browser });
  await launch(f);
  assert.equal(f.calls.length, callsBefore);
  await f.store.update(f.id, (state) => {
    state.snapshots[0].captured_at = 'new capture timestamp, same evidence';
  });
  await f.controller.confirmCase(
    f.id,
    f.baseline.cases[0].case_id,
    confirmation(f.baseline.cases[0]),
  );
  await launch(f);
  const retained = await row(f);
  assert.equal(f.calls.length, callsBefore);
  assert.equal(retained.self_repair.input_hash, initial.self_repair.input_hash);
  assert.equal(retained.self_repair.rounds.length, 3);
  assert.equal(retained.self_repair.repair_count, 2);
  assert.equal(
    retained.status,
    'BLOCKED_MAPPING',
    'retained exhausted outcome must remain visible after identical reconfirmation',
  );
});

test('a real observation change retains the total preparation budget and prior repair history', async () => {
  let count = 0;
  const f = await fixture(({ phase }) =>
    phase === 'plan' ? { plan: { wrong: ++count } } : undefined,
  );
  await launch(f);
  const initial = await row(f),
    reviewCalls = f.calls.filter((c) => c.phase === 'input_review').length;
  await f.store.update(f.id, (state) => {
    state.snapshots[0].text += '；新采集到商品数量区域';
  });
  await launch(f);
  const current = await row(f);
  assert.notEqual(current.self_repair.input_hash, initial.self_repair.input_hash);
  assert.equal(current.self_repair.repair_count, 0);
  assert.equal(current.self_repair.outcome, 'EXHAUSTED');
  assert.equal(current.preparation_budget.used, 3);
  assert.equal(current.self_repair_history.length, 1);
  assert.deepEqual(current.self_repair_history[0], initial.self_repair);
  assert.equal(plansRequested(f).length, 3);
  assert.equal(
    f.calls.filter((c) => c.phase === 'input_review').length,
    reviewCalls,
    'unchanged business input review remains reusable',
  );
});

test('appending duplicate snapshots through capture cannot replenish an exhausted repair budget', async () => {
  let count = 0;
  const shot = {
    url: base + '/catalog',
    title: '商品查询',
    text: '商品查询；苹果、香蕉、牛奶',
    controls: [],
  };
  const browser = { active: () => true, snapshot: async () => clone(shot) };
  const f = await fixture(
    ({ phase }) => (phase === 'plan' ? { plan: { wrong: ++count } } : undefined),
    { browser },
  );
  await f.store.update(f.id, (s) => {
    s.snapshots = [{ ...clone(shot), captured_at: 'old capture timestamp' }];
  });
  await launch(f);
  const exhausted = await row(f),
    callsBefore = f.calls.length;
  for (let i = 0; i < 3; i++) await f.controller.capture(f.id);
  const captured = await f.store.read(f.id);
  assert.equal(captured.snapshots.length, 4);
  assert.notEqual(captured.snapshots[0].captured_at, captured.snapshots[1].captured_at);
  await launch(f);
  const retained = await row(f);
  assert.equal(f.calls.length, callsBefore);
  assert.equal(plansRequested(f).length, 3);
  assert.equal(retained.self_repair.input_hash, exhausted.self_repair.input_hash);
  assert.deepEqual(retained.self_repair, exhausted.self_repair);
  assert.equal(retained.self_repair_history.length, 0);
  assert.equal(retained.status, 'BLOCKED_MAPPING');
});

test('review and identical confirmation restore the previously audited candidate without another planning call or implicit approval', async () => {
  const f = await fixture();
  await launch(f);
  const accepted = await row(f),
    cid = accepted.case_id;
  await f.controller.approvePlan(f.id, cid, planHash(accepted.plan));
  assert.equal((await row(f)).plan_approved, true);
  const callsBefore = f.calls.length;
  await f.controller.launch(f.id, 'review', [cid]);
  const reviewJob = f.controller.active;
  await reviewJob.finished;
  const reviewed = await row(f);
  assert.equal(reviewed.plan, null);
  assert.equal(reviewed.plan_approved, false);
  assert.equal(reviewed.reviewed, false);
  assert.ok(
    reviewed.plan_history.some(
      (item) => item.status === 'ACCEPTED' && planHash(item.plan) === accepted.plan_audit.plan_hash,
    ),
  );
  await f.controller.confirmCase(f.id, cid, confirmation(f.baseline.cases[0]));
  assert.equal((await row(f)).plan, null);
  await launch(f);
  const restored = await row(f);
  assert.equal(f.calls.length, callsBefore + 1);
  assert.equal(f.calls.at(-1).phase, 'review');
  assert.equal(restored.status, 'PLAN_REVIEW');
  assert.deepEqual(restored.plan, accepted.plan);
  assert.deepEqual(restored.plan_audit, accepted.plan_audit);
  assert.deepEqual(restored.self_repair, accepted.self_repair);
  assert.equal(restored.plan_approved, false);
  assert.equal(restored.approved_hash, undefined);
  assert.deepEqual(restored.attempts, []);
  await f.controller.approvePlan(f.id, cid, planHash(restored.plan));
  assert.equal(
    (await row(f)).plan_approved,
    true,
    'fresh explicit approval is still required and remains possible',
  );
});

test('approval requires the accepted audit for the exact current candidate and technical input', async () => {
  const f = await fixture();
  await launch(f);
  const accepted = await row(f),
    cid = accepted.case_id;
  await f.controller.approvePlan(f.id, cid, planHash(accepted.plan));
  assert.equal((await row(f)).plan_approved, true);
  await f.store.update(f.id, (s) => {
    s.cases[0].plan.notes = 'candidate changed after audit';
    s.cases[0].plan_approved = false;
  });
  await assert.rejects(
    f.controller.approvePlan(f.id, cid, planHash((await row(f)).plan)),
    code('PLAN_AUDIT_REQUIRED'),
  );
  await f.store.update(f.id, (s) => {
    s.cases[0] = clone(accepted);
    s.snapshots[0].text += ' changed observation';
  });
  await assert.rejects(
    f.controller.approvePlan(f.id, cid, planHash(accepted.plan)),
    code('PLAN_AUDIT_REQUIRED'),
  );
  assert.equal((await row(f)).plan_approved, false);
});

test('execution also rejects a stale audit even if an approval receipt is already present', async () => {
  let executions = 0;
  const browser = {
    active: () => true,
    authenticated: true,
    execute: async () => {
      executions++;
      throw new Error('stale audit reached browser');
    },
  };
  const f = await fixture(undefined, { browser });
  await launch(f);
  const approved = await row(f);
  await f.controller.approvePlan(f.id, approved.case_id, planHash(approved.plan));
  await f.store.update(f.id, (s) => {
    s.authorization.nonproduction = true;
    s.cases[0].plan_audit.plan_hash = '0'.repeat(64);
  });
  await assert.rejects(
    f.controller.launch(f.id, 'run', [approved.case_id]),
    code('PLAN_AUDIT_REQUIRED'),
  );
  assert.equal(executions, 0);
  assert.equal((await f.store.read(f.id)).run_scopes?.length ?? 0, 0);
});

test('stop during semantic audit retains late output only in diagnostics and never publishes the plan', async () => {
  let entered, release;
  const auditEntered = new Promise((resolve) => (entered = resolve)),
    held = new Promise((resolve) => (release = resolve));
  const f = await fixture(async ({ phase }) => {
    if (phase === 'plan_audit') {
      entered();
      await held;
    }
  });
  await f.controller.launch(f.id, 'plan', [f.baseline.cases[0].case_id]);
  const job = f.controller.active;
  await auditEntered;
  try {
    await f.controller.stop(f.id);
  } finally {
    release();
  }
  await job.finished;
  const result = await row(f),
    state = await f.store.read(f.id),
    diagnostics = await f.controller.diagnostics(f.id);
  assert.equal(state.status, 'STOPPED');
  assert.equal(result.plan, null);
  assert.equal(result.plan_approved, false);
  assert.ok(!result.plan_audit);
  assert.ok(
    diagnostics.records.some((r) => r.type === 'MODEL_PROVIDER_RESULT' && r.phase === 'plan_audit'),
  );
  assert.ok(
    diagnostics.records.some(
      (r) => r.type === 'MODEL_DECISION' && r.phase === 'plan_audit' && r.outcome === 'CANCELLED',
    ),
  );
});

test('a reserved interrupted repair round remains spent after restart and only one final attempt is available', async () => {
  let entered,
    release,
    requests = 0;
  const started = new Promise((resolve) => (entered = resolve)),
    held = new Promise((resolve) => (release = resolve));
  const f = await fixture(async ({ phase }) => {
    if (phase === 'plan') {
      requests++;
      if (requests === 2) {
        entered();
        await held;
      }
      return { plan: { wrong: requests } };
    }
  });
  await f.controller.launch(f.id, 'plan', [f.baseline.cases[0].case_id]);
  const job = f.controller.active;
  await started;
  try {
    await f.controller.stop(f.id);
  } finally {
    release();
  }
  await job.finished;
  const stopped = await row(f);
  assert.equal(stopped.self_repair.rounds.length, 2);
  assert.equal(stopped.self_repair.rounds[1].status, 'PENDING');
  f.controller = new Controller({ store: f.store, provider: f.provider, browser: f.browser });
  await launch(f);
  const result = await row(f);
  assert.equal(requests, 3);
  assert.equal(result.self_repair.rounds.length, 3);
  assert.equal(result.self_repair.repair_count, 2);
  assert.equal(result.self_repair.outcome, 'EXHAUSTED');
  await launch(f);
  assert.equal(requests, 3);
});

test('diagnostic failure after a model result stops self-repair and the remaining batch', async () => {
  const f = await fixture(({ phase }) =>
    phase === 'plan' ? { plan: { wrong: 'requires another attempt' } } : undefined,
  );
  const log = new DiagnosticLog(path.join(f.store.dir(f.id), 'diagnostics'));
  f.controller.diagnosticLogs.set(f.id, {
    append: async (record) => {
      if (record.type === 'MODEL_PROVIDER_RESULT' && record.phase === 'plan')
        throw Object.assign(new Error('fixture disk full'), { code: 'ENOSPC' });
      return log.append(record);
    },
    read: () => log.read(),
  });
  const job = await launch(
      f,
      f.baseline.cases.map((c) => c.case_id),
    ),
    state = await f.store.read(f.id);
  assert.equal(job.diagnostic_failed, true);
  assert.equal(state.status, 'NEEDS_ATTENTION');
  assert.deepEqual(
    f.calls.map((c) => c.phase),
    ['input_review', 'plan'],
  );
  assert.equal(state.cases[0].plan, null);
  assert.equal(state.cases[1].self_repair, undefined);
  assert.ok(
    state.events.some((e) => e.type === 'JOB_FAILED' && e.code === 'DIAGNOSTIC_WRITE_FAILED'),
  );
});

test('data overrides are explicit operator records, preserve baseline bytes and invalidate an old audit', async () => {
  const f = await fixture(undefined, {
    caseUpdate: (c) => {
      c.data = { query: '苹果', customer: { name: '原测试客户', region: '东区' } };
      c.test_data = { label: '原标签' };
    },
  });
  await launch(f);
  const accepted = await row(f),
    baselineFile = path.join(f.store.dir(f.id), 'baseline.json'),
    bytesBefore = await fs.readFile(baselineFile);
  await f.controller.confirmCase(f.id, accepted.case_id, {
    ...confirmation(f.baseline.cases[0]),
    data_overrides: {
      data: { customer: { name: '已确认测试客户' } },
      test_data: { label: '补充标签' },
    },
  });
  const changed = await row(f),
    effective = effectiveCase(f.baseline.cases[0], changed);
  assert.deepEqual(await fs.readFile(baselineFile), bytesBefore);
  assert.equal(effective.data.customer.name, '已确认测试客户');
  assert.equal(effective.data.customer.region, '东区');
  assert.equal(effective.data.query, '苹果');
  assert.equal(effective.test_data.label, '补充标签');
  assert.equal(changed.plan, null);
  assert.equal(changed.plan_audit, undefined);
  assert.equal(changed.plan_approved, false);
  assert.equal(changed.confirmation_history.length, 1);
  assert.deepEqual(changed.data_overrides, {
    data: { customer: { name: '已确认测试客户' } },
    test_data: { label: '补充标签' },
  });
  await assert.rejects(
    f.controller.confirmCase(f.id, accepted.case_id, {
      ...confirmation(f.baseline.cases[0]),
      data_overrides: { data: { invented: 'new' } },
    }),
    code('INPUT_OVERRIDE_UNKNOWN_FIELD'),
  );
  assert.deepEqual(await fs.readFile(baselineFile), bytesBefore);
});
