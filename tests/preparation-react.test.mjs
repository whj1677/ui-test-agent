import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCases } from '../src/demo.mjs';
import { caseHash, planHash } from '../src/plans.mjs';
import { prepareWithRepair, repairInputHash } from '../src/plan-repair.mjs';
import { prepareAutonomously } from '../src/autonomous-recovery.mjs';
import { preparationGap, recoveryKind } from '../src/recovery-gap.mjs';
import { stepAssertions } from '../src/plan-steps.mjs';

const clone = structuredClone;
const origin = 'http://127.0.0.1:48991'; // No server, network or real provider is used.
const blockedReason = '缺少商品结果表格的定位证据';
const control = (name = '商品结果表格', value = 'products') => ({
  role: 'table',
  name,
  locator: { kind: 'testid', value },
});
const shot = (controls = []) => ({
  url: origin + '/catalog',
  title: '合成商品目录',
  text: '合成商品证据',
  controls,
  login_page: false,
});
function covered(c, plan) {
  return {
    checks: c.steps.flatMap((step) =>
      step.obligations.map((obligation) => ({
        step_id: step.step_id,
        obligation_id: obligation.id,
        status: 'COVERED',
        assertion_indices: stepAssertions(
          plan.steps.find((s) => s.step_id === step.step_id),
        ).flatMap((a, i) => (a.obligation_ids.includes(obligation.id) ? [i] : [])),
        reason: '注入审查，仅验证控制流，不代表模型语义判断。',
      })),
    ),
    issues: [],
  };
}

// Real prepareWithRepair + prepareAutonomously and their validators, with an
// in-memory store and injected model/explorer ports. No user tasks are created.
function harness({ reply, observation, snapshots = [shot()], caseIndex = 0 } = {}) {
  const fixture = demoCases();
  const c = clone(fixture.baseline.cases[caseIndex]);
  const plan = clone(fixture.plans[caseIndex]);
  const baseline = { ...fixture.baseline, cases: [c], case_count: 1 };
  const state = {
    target: origin,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
    snapshots: clone(snapshots),
    events: [],
    cases: [
      {
        case_id: c.case_id,
        reviewed: true,
        plan: null,
        plan_approved: false,
        issues: [],
        attempts: [],
        confirmations: [],
        status: 'READY_FOR_PLAN',
      },
    ],
  };
  const calls = [],
    decisions = [];
  const stats = { opens: 0, closes: 0, clean: 0 };
  const job = {
    id: 'in-memory-only',
    run_id: 'synthetic-run',
    abort: new AbortController(),
    phase_deadline: Date.now() + 30000,
  };
  const controller = {
    store: {
      read: async () => clone(state),
      update: async (_id, fn) => {
        fn(state);
      },
      event: (s, type, detail) => s.events.push({ type, ...clone(detail) }),
    },
    assertInput(_job, s, original, id, hash) {
      assert.equal(id, c.case_id);
      assert.equal(hash, caseHash(original.cases[0]));
      assert.equal(s.cases[0].case_id, id);
    },
    assertCurrent() {
      assert.equal(job.abort.signal.aborted, false);
    },
    sanitizeDiagnostic: clone,
    diagnostic: async () => {},
    modelDecision: async (_job, outcome, detail) => decisions.push({ outcome, ...clone(detail) }),
    async ask(_job, prompt, input, options) {
      const call = { phase: options.phase, input: clone(input), prompt };
      calls.push(call);
      assert.ok(calls.length <= 30, 'injected workflow must remain bounded');
      const custom = await reply?.(call, h);
      if (custom !== undefined) return clone(custom);
      switch (options.phase) {
        case 'input_review':
          return { issues: [] };
        case 'plan':
          return { plan: clone(plan) };
        case 'plan_audit':
          return covered(input.original, input.candidate_plan);
        case 'blocked_audit':
          return { outcome: 'BLOCKED', reason: input.blocked_response.reason, evidence_refs: [] };
        case 'evidence_recovery':
          return { done: true, reason: '注入观察结束，不代表产品通过' };
        default:
          assert.fail('unexpected model phase ' + options.phase);
      }
    },
    browser: { active: () => true, authenticated: true },
    async requireCleanSite() {
      stats.clean++;
    },
    discoveryFactory() {
      return {
        async open() {
          stats.opens++;
          return { snapshot: clone(observation?.(stats.opens, h) ?? shot()), candidates: [] };
        },
        async close() {
          stats.closes++;
        },
      };
    },
  };
  const h = {
    c,
    baseline,
    plan,
    state,
    calls,
    decisions,
    stats,
    job,
    controller,
    row: () => state.cases[0],
    count: (phase) => calls.filter((call) => call.phase === phase).length,
    run: () => prepareAutonomously(controller, job, baseline, c),
    prepare: () => prepareWithRepair(controller, job, baseline, c),
  };
  return h;
}

test('pure routing requires a diagnosed technical gap, not broad wording or an unknown code', () => {
  for (const reason of ['所有字段', '全部记录无法确认', '所有数据显示正确', '目前不能准备']) {
    assert.equal(
      preparationGap({ code: 'MODEL_MAPPING_BLOCKED', reason, blockAudit: { outcome: 'BLOCKED' } })
        .kind,
      'PLAN_REPAIR_ONLY',
    );
  }
  assert.equal(
    preparationGap({ code: 'UNKNOWN_NEW_ERROR', reason: blockedReason }).kind,
    'PLAN_REPAIR_ONLY',
  );
  assert.equal(
    preparationGap({
      code: 'MODEL_MAPPING_BLOCKED',
      reason: blockedReason,
      blockAudit: { outcome: 'BLOCKED' },
    }).kind,
    'TARGETED_EVIDENCE',
  );
  assert.equal(preparationGap({ code: 'PLAN_SCOPE_EVIDENCE_MISSING' }).kind, 'TARGETED_EVIDENCE');
  assert.equal(preparationGap({ code: 'INVALID_LOCATOR' }).kind, 'PLAN_REPAIR_ONLY');
});

test('pure routing keeps authentication, authorization, writes and unsupported reviews closed', () => {
  for (const code of [
    'AUTH_REQUIRED',
    'WRITE_NOT_AUTHORIZED',
    'PAGE_EVIDENCE_INCOMPLETE',
    'ORACLE_UNCLEAR',
  ])
    assert.equal(preparationGap({ code, reason: blockedReason }).kind, 'BOUNDARY_REQUIRES_INPUT');
  for (const reason of [
    '尚未登录，缺少商品控件定位',
    '缺少删除按钮的定位证据',
    '没有权限读取商品表格证据',
    '跨域页面未提供定位证据',
    'Missing credentials and locator evidence',
  ]) {
    assert.equal(
      preparationGap({ code: 'MODEL_MAPPING_BLOCKED', reason, blockAudit: { outcome: 'BLOCKED' } })
        .kind,
      'BOUNDARY_REQUIRES_INPUT',
    );
  }
  assert.equal(
    preparationGap({
      code: 'MODEL_MAPPING_BLOCKED',
      reason: blockedReason,
      blockAudit: { outcome: 'NEEDS_CLARIFICATION' },
    }).code,
    'INPUT_REVIEW_REQUIRED',
  );
  assert.equal(
    preparationGap({
      code: 'MODEL_MAPPING_BLOCKED',
      reason: blockedReason,
      blockAudit: { outcome: 'BLOCKED', validation_error: 'INVALID_SCHEMA' },
    }).kind,
    'BOUNDARY_REQUIRES_INPUT',
  );
});

test('pure routing distinguishes a URL citation from a grounded control repair', () => {
  const input = {
    code: 'MODEL_MAPPING_BLOCKED',
    reason: blockedReason,
    blockAudit: {
      outcome: 'REPAIR',
      evidence_refs: [{ fact: { kind: 'entry_path', value: '/catalog' } }],
    },
  };
  assert.equal(preparationGap(input).kind, 'TARGETED_EVIDENCE');
  input.blockAudit.evidence_refs = [
    { fact: { kind: 'control', name: '商品结果表格', locator: control().locator } },
  ];
  assert.equal(preparationGap(input).kind, 'PLAN_REPAIR_ONLY');
});

test('block audit clarification preserves confirmed input, never auto-admits or copies issues', async () => {
  const h = harness({
    reply: ({ phase }) => {
      if (phase === 'plan') return { blocked: true, reason: blockedReason };
      if (phase === 'blocked_audit')
        return {
          outcome: 'NEEDS_CLARIFICATION',
          reason: '所有字段需要重新确认',
          evidence_refs: [],
        };
    },
  });
  const before = clone(h.baseline);
  await h.run();
  assert.equal(h.row().reviewed, true);
  assert.equal(h.row().status, 'BLOCKED_MAPPING');
  assert.equal(h.row().self_repair.outcome, 'BLOCKED');
  assert.equal(h.row().self_repair.rounds[0].code, 'INPUT_REVIEW_REQUIRED');
  assert.match(h.row().mapping_reason, /尚未经独立输入审查证实/u);
  assert.equal(h.row().plan, null);
  assert.equal(h.row().plan_approved, false);
  assert.deepEqual(h.row().issues, []);
  assert.deepEqual(h.row().attempts, []);
  assert.deepEqual(h.baseline, before);
  assert.equal(h.stats.opens, 0);
  assert.equal(h.count('input_review'), 1);
  assert.deepEqual(Object.keys(h.calls[0].input).sort(), [
    'confirmations',
    'data_overrides',
    'effective',
    'original',
  ]);
  const count = h.calls.length;
  await h.run();
  assert.equal(
    h.calls.length,
    count,
    'same blocked input is retained without more review/model calls',
  );
});

test('only a grounded isolated input review can reopen a confirmed case', async () => {
  const h = harness({
    reply: ({ phase }) =>
      phase === 'input_review'
        ? {
            issues: [
              {
                code: 'AMBIGUOUS',
                step_id: 'S1',
                source_quotes: ['商品名称输入苹果'],
                message: '注入的输入问题，仅验证隔离审查路由。',
              },
            ],
          }
        : undefined,
  });
  await h.run();
  assert.equal(h.row().reviewed, false);
  assert.equal(h.row().status, 'NEEDS_REVIEW');
  assert.equal(h.row().self_repair.outcome, 'NEEDS_CLARIFICATION');
  assert.ok(h.row().issues[0].quote_locations.length);
  assert.equal(h.count('plan'), 0);
  assert.equal(h.stats.opens, 0);
});

test('plan UNCLEAR repairs the candidate but never reopens the confirmed case', async () => {
  const h = harness({
    reply: ({ phase, input }) => {
      if (phase !== 'plan_audit') return;
      const audit = covered(input.original, input.candidate_plan);
      audit.checks[0].status = 'UNCLEAR';
      audit.issues.push({ code: 'ORACLE_UNCLEAR', step_id: 'S1', reason: '所有字段尚未完整核验' });
      return audit;
    },
  });
  await h.run();
  assert.equal(h.row().reviewed, true);
  assert.equal(h.row().status, 'BLOCKED_MAPPING');
  assert.equal(h.row().self_repair.outcome, 'EXHAUSTED');
  assert.equal(h.count('plan'), 2, 'unchanged rejected candidate stops early');
  assert.equal(
    h.count('plan_audit'),
    1,
    'a changed auditor answer cannot rehabilitate unchanged input',
  );
  assert.equal(h.row().self_repair.rounds[1].code, 'PLAN_REPAIR_NO_PROGRESS');
  assert.equal(h.stats.opens, 0, 'broad expectations are not targeted evidence gaps');
  assert.deepEqual(h.row().issues, []);
});

test('missing evidence yields after one candidate, recovers, and re-audits before approval', async () => {
  const h = harness({
    observation: () => shot([control()]),
    reply: ({ phase, input }, h) => {
      if (phase === 'plan' && h.count('plan') === 1)
        return { blocked: true, reason: blockedReason };
      if (phase === 'blocked_audit') {
        const entry = input.evidence_catalog.find((e) => e.fact.kind === 'entry_path');
        return {
          outcome: 'REPAIR',
          reason: '仅观察到当前目录入口，仍缺少目标绑定事实',
          evidence_refs: [{ evidence_id: entry.evidence_id, fact: entry.fact }],
        };
      }
    },
  });
  await h.run();
  assert.deepEqual(
    h.calls.map((c) => c.phase),
    ['input_review', 'plan', 'blocked_audit', 'evidence_recovery', 'plan', 'plan_audit'],
  );
  assert.equal(h.row().preparation_budget.used, 2);
  assert.equal(h.row().evidence_recoveries.length, 1);
  assert.equal(h.row().evidence_recoveries[0].status, 'NEW_EVIDENCE');
  assert.equal(h.row().self_repair_history[0].rounds[0].recovery_gap.kind, 'TARGETED_EVIDENCE');
  assert.equal(h.row().status, 'PLAN_REVIEW');
  assert.equal(h.row().plan_approved, false);
  assert.deepEqual(h.row().attempts, []);
  assert.equal(h.stats.closes, 1);
});

test('a structured scope evidence error yields before repeated generation and includes its target', async () => {
  const locator = {
    kind: 'within',
    scope: { role: 'dialog', name: '商品详情', exact: true },
    target: { kind: 'label', value: '商品名称', exact: true },
  };
  const h = harness({ observation: () => shot([{ role: 'textbox', name: '商品名称', locator }]) });
  h.plan.steps[0].actions[0].target = locator;
  await h.run();
  assert.equal(h.row().status, 'PLAN_REVIEW');
  assert.equal(h.row().preparation_budget.used, 2);
  assert.equal(h.row().evidence_recoveries.length, 1);
  assert.match(h.row().evidence_recoveries[0].reason, /商品详情.*商品名称/u);
  assert.equal(h.row().self_repair_history[0].rounds[0].code, 'PLAN_SCOPE_EVIDENCE_MISSING');
});

test('a plan-audit locator evidence finding yields to recovery instead of using all candidates', async () => {
  const h = harness({
    observation: () => shot([control()]),
    reply: ({ phase, input }, h) => {
      if (phase !== 'plan_audit' || h.count('plan_audit') !== 1) return;
      const audit = covered(input.original, input.candidate_plan);
      audit.issues.push({ code: 'LOCATOR_UNSUPPORTED', step_id: 'S1', reason: blockedReason });
      return audit;
    },
  });
  await h.run();
  assert.equal(h.row().status, 'PLAN_REVIEW');
  assert.equal(h.count('plan'), 2);
  assert.equal(h.stats.opens, 1);
  assert.equal(h.row().self_repair_history[0].rounds[0].status, 'AUDIT_REJECTED');
});

test('3 candidates and 2 evidence recoveries are cumulative across fresh input and repeated calls', async () => {
  const h = harness({
    observation: (index) => shot([control('商品结果表格', 'products-' + index)]),
    reply: ({ phase }) => (phase === 'plan' ? { blocked: true, reason: blockedReason } : undefined),
  });
  await h.run();
  assert.equal(h.count('plan'), 3, JSON.stringify(h.row().evidence_recoveries));
  assert.equal(h.row().preparation_budget.used, 3);
  assert.equal(h.row().self_repair_history.length, 2);
  assert.equal(h.row().evidence_recoveries.length, 2);
  assert.equal(h.stats.opens, 2);
  assert.equal(h.row().status, 'BLOCKED_MAPPING');
  const count = h.calls.length;
  await h.run();
  assert.equal(h.calls.length, count);
  h.state.snapshots.push(shot([control('商品结果表格', 'external-new-observation')]));
  await h.run();
  assert.equal(
    h.calls.length,
    count,
    'even real new observations cannot replenish the three candidates',
  );
  assert.equal(h.row().preparation_budget.used, 3);
  assert.equal(h.stats.opens, 2);
});

test('two already reserved evidence attempts stop before a third even with candidate capacity', async () => {
  const h = harness({
    reply: ({ phase }) => (phase === 'plan' ? { blocked: true, reason: blockedReason } : undefined),
  });
  h.row().evidence_recoveries = [{ status: 'STARTED' }, { status: 'NO_PROGRESS' }];
  await h.run();
  assert.equal(h.row().preparation_budget.used, 1);
  assert.equal(h.stats.opens, 0);
  assert.equal(h.row().evidence_recoveries.length, 2);
});

test('no-progress recovery on identical input stops permanently despite timestamps and duplicate captures', async () => {
  const h = harness({
    reply: ({ phase }) => (phase === 'plan' ? { blocked: true, reason: blockedReason } : undefined),
  });
  await h.run();
  assert.equal(h.row().evidence_recoveries[0].status, 'NO_PROGRESS');
  const hash = h.row().self_repair.input_hash;
  const count = h.calls.length;
  h.state.snapshots[0].captured_at = 'later';
  h.state.snapshots.push({ ...clone(h.state.snapshots[0]), captured_at: 'even later' });
  await h.run();
  assert.equal(h.row().self_repair.input_hash, hash);
  assert.equal(h.calls.length, count);
  assert.equal(h.stats.opens, 1);
  assert.equal(h.row().preparation_budget.used, 1);
});

test('recovery/no-progress and exhausted-candidate guards cannot be bypassed by a stale gap marker', () => {
  const row = {
    self_repair: {
      input_hash: 'same',
      outcome: 'BLOCKED',
      rounds: [
        {
          code: 'MODEL_MAPPING_BLOCKED',
          reason: blockedReason,
          block_audit: { outcome: 'BLOCKED' },
          recovery_gap: { kind: 'TARGETED_EVIDENCE' },
        },
      ],
    },
  };
  for (const status of ['NO_PROGRESS', 'AUTH_REQUIRED', 'STARTED']) {
    row.evidence_recoveries = [{ parent_input_hash: 'same', status }];
    assert.equal(recoveryKind(row), 'PLAN_REPAIR_ONLY');
  }
  row.evidence_recoveries = [];
  row.self_repair.outcome = 'EXHAUSTED';
  assert.equal(recoveryKind(row), 'PLAN_REPAIR_ONLY');
});

test('authorization/session/executed/dirty boundaries keep the existing autonomous gate', async (t) => {
  for (const boundary of ['production', 'logged-out', 'inactive', 'executed', 'dirty']) {
    await t.test(boundary, async () => {
      const h = harness({
        observation: () => shot([control()]),
        reply: ({ phase }) =>
          phase === 'plan' ? { blocked: true, reason: blockedReason } : undefined,
      });
      if (boundary === 'production') h.state.authorization.nonproduction = false;
      if (boundary === 'logged-out') h.controller.browser.authenticated = false;
      if (boundary === 'inactive') h.controller.browser.active = () => false;
      if (boundary === 'executed') h.row().attempts.push({ status: 'UNKNOWN_DISPATCH' });
      if (boundary === 'dirty') {
        h.controller.requireCleanSite = async () => {
          throw Object.assign(new Error('DIRTY_SITE'), { code: 'DIRTY_SITE' });
        };
        await assert.rejects(h.run, { code: 'DIRTY_SITE' });
      } else await h.run();
      assert.equal(h.stats.opens, 0);
      assert.equal(h.row().plan_approved, false);
      assert.equal(h.row().status, 'BLOCKED_MAPPING');
    });
  }
});

test('textual authorization gaps do not start discovery even when the session gate is open', async () => {
  const h = harness({
    reply: ({ phase }) =>
      phase === 'plan'
        ? { blocked: true, reason: '缺少商品表格证据，读取接口尚未授权' }
        : undefined,
  });
  await h.run();
  assert.equal(h.stats.opens, 0);
  assert.equal(h.row().preparation_budget.used, 1);
  assert.equal(h.row().self_repair.rounds[0].recovery_gap.kind, 'BOUNDARY_REQUIRES_INPUT');
  assert.equal(h.row().reviewed, true);
});

test('changing invalid candidates stops at three and interruption does not restore a reserved slot', async () => {
  const h = harness({
    reply: ({ phase }, h) =>
      phase === 'plan' ? { plan: { invalid: h.count('plan') } } : undefined,
  });
  await h.run();
  assert.equal(h.count('plan'), 3);
  assert.equal(h.row().preparation_budget.used, 3);
  assert.equal(h.stats.opens, 0);
  const interrupted = harness({
    reply: ({ phase }) => {
      if (phase === 'plan') throw Object.assign(new Error('STOPPED'), { code: 'STOPPED' });
    },
  });
  for (let i = 1; i <= 3; i++) {
    await assert.rejects(interrupted.run, { code: 'STOPPED' });
    assert.equal(interrupted.row().preparation_budget.used, i);
  }
  await interrupted.run();
  assert.equal(interrupted.count('plan'), 3);
  assert.equal(interrupted.row().self_repair.outcome, 'EXHAUSTED');
});

test('new read-only v2/v3 candidates include guarded-react in the audited/approval hash only', async (t) => {
  for (const version of ['v2', 'v3'])
    await t.test(version, async () => {
      const h = harness();
      if (version === 'v3') {
        h.plan.schema_version = 'ui-agent-plan/v3';
        h.plan.steps = h.plan.steps.map(({ actions, assertions, within_ms, ...step }) => ({
          ...step,
          assertion_mode: 'sequential_checkpoints',
          timeout_ms: 60000,
          checkpoints: [{ checkpoint_id: 'S1-C1', actions, assertions, within_ms }],
        }));
      }
      const original = clone(h.plan);
      await h.prepare();
      assert.equal(h.row().status, 'PLAN_REVIEW');
      assert.deepEqual(h.row().plan.execution_policy, {
        mode: 'guarded-react',
        max_observations: 2,
      });
      assert.equal(h.row().plan_audit.plan_hash, planHash(h.row().plan));
      assert.notEqual(planHash(h.row().plan), planHash(original));
      assert.deepEqual(
        h.calls.find((c) => c.phase === 'plan_audit').input.candidate_plan.execution_policy,
        h.row().plan.execution_policy,
      );
      assert.deepEqual(h.plan, original, 'provider payload is not mutated');
      assert.equal(h.row().plan_approved, false);
    });
});

test('retained historical accepted plans do not acquire the new policy or a new hash', async () => {
  const h = harness();
  const hash = repairInputHash(h.state, h.c, h.row());
  h.row().plan = clone(h.plan);
  h.row().plan_approved = true;
  h.row().self_repair = { input_hash: hash, outcome: 'ACCEPTED', rounds: [] };
  h.row().plan_audit = { input_hash: hash, plan_hash: planHash(h.plan), outcome: 'ACCEPT' };
  await h.prepare();
  assert.deepEqual(h.row().plan, h.plan);
  assert.equal(h.row().plan.execution_policy, undefined);
  assert.equal(h.count('plan'), 0);
  assert.equal(planHash(h.row().plan), planHash(h.plan));
});

test('new mutation candidates do not acquire a read-only policy', async () => {
  const h = harness({ caseIndex: 1 });
  await h.prepare();
  assert.equal(h.row().status, 'PLAN_REVIEW');
  assert.equal(h.row().plan.execution_policy, undefined);
  assert.equal(h.row().plan_approved, false);
  assert.deepEqual(h.row().attempts, []);
});
