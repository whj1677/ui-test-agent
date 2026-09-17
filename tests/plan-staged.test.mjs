import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Controller } from '../src/controller.mjs';
import { Store } from '../src/store.mjs';
import { demoCases } from '../src/demo.mjs';
import { planHash } from '../src/plans.mjs';
import { fixtureModelReply } from './fixture-model.mjs';
import { generateStagedPlan, StagedValidationError } from '../src/plan-staged.mjs';

const base = 'http://127.0.0.1:4000';
const clone = structuredClone;
const confirmation = (c) => ({
  steps: c.steps.map((s) => ({
    step_id: s.step_id,
    action: s.action,
    expected: s.expected,
    obligations: clone(s.obligations),
  })),
  note: '测试夹具作者确认原文，未改变业务预期。',
});

async function fixture(handler, { planningMode = 'staged' } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-plan-staged-')),
    store = new Store(directory);
  await store.init();
  const { baseline, plans } = demoCases();
  const id = await store.create({ name: 'Staged planning fixture', target: base, baseline }),
    calls = [];
  const provider = {
    configured: () => true,
    model: 'injected-staged-fixture',
    json: async (prompt, input, options) => {
      calls.push({ prompt, input: clone(input) });
      const custom = handler
        ? await handler({ prompt, input: clone(input), options, calls })
        : undefined;
      return {
        value: custom ?? fixtureModelReply(prompt, input, plans),
        usage: {
          response_model: 'injected-staged-fixture',
          prompt_tokens: 1,
          completion_tokens: 1,
        },
      };
    },
  };
  const controller = new Controller({ store, provider, browser: {}, planningMode });
  await store.update(id, (state) => {
    state.snapshots = [{ text: '商品查询；苹果、香蕉、牛奶', captured_at: 'initial capture' }];
  });
  for (const c of baseline.cases) await controller.confirmCase(id, c.case_id, confirmation(c));
  return { directory, store, baseline, plans, id, calls, provider, controller };
}
async function launch(f, caseId) {
  await f.controller.launch(f.id, 'plan', [caseId]);
  const job = f.controller.active;
  await job.finished;
  return job;
}
const row = async (f, i = 0) => (await f.store.read(f.id)).cases[i];
const phases = (f) =>
  f.calls.map((c) =>
    c.input.purpose === 'plan_staged_scaffold'
      ? 'plan_scaffold'
      : c.input.purpose === 'plan_staged_step_actions'
        ? 'plan_actions'
        : c.input.purpose === 'plan_staged_step_assertions'
          ? 'plan_assertions'
          : c.input?.blocked_response
            ? 'blocked_audit'
            : c.input?.candidate_plan
              ? 'plan_audit'
              : 'input_review',
  );

test('staged scaffold, per-step actions and per-step assertions assemble into a candidate passing all existing gates', async () => {
  const f = await fixture();
  await launch(f, f.baseline.cases[0].case_id);
  const result = await row(f);
  assert.deepEqual(phases(f), [
    'input_review',
    'plan_scaffold',
    'plan_actions',
    'plan_assertions',
    'plan_audit',
  ]);
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.equal(result.plan_approved, false);
  assert.deepEqual(result.attempts, []);
  assert.equal(result.self_repair.outcome, 'ACCEPTED');
  assert.equal(result.self_repair.repair_count, 0);
  assert.deepEqual(
    result.plan,
    f.plans[0],
    'assembled plan is identical to the fixture reference, wording transcribed by the program',
  );
  await f.controller.approvePlan(f.id, result.case_id, planHash(result.plan));
  assert.equal(
    (await row(f)).plan_approved,
    true,
    'approval gate is unchanged for staged candidates',
  );
});

test('staged planning covers mutation cases including cleanup identity and ownership', async () => {
  const f = await fixture();
  await launch(f, f.baseline.cases[1].case_id);
  const result = await row(f, 1);
  assert.deepEqual(phases(f), [
    'input_review',
    'plan_scaffold',
    'plan_actions',
    'plan_assertions',
    'plan_audit',
  ]);
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.deepEqual(result.plan, f.plans[1]);
  assert.equal(result.plan.cleanup.identity, f.plans[1].cleanup.identity);
});

test('a stage-level validation failure consumes one repair round and the next attempt succeeds', async () => {
  let actionCalls = 0;
  const f = await fixture(({ input }) => {
    if (input.purpose === 'plan_staged_step_actions' && actionCalls++ === 0)
      return {
        actions: [{ action_id: 'S1-A1', op: 'click', target: { kind: 'nth', value: '1' } }],
      };
  });
  await launch(f, f.baseline.cases[0].case_id);
  const result = await row(f);
  assert.deepEqual(phases(f), [
    'input_review',
    'plan_scaffold',
    'plan_actions',
    'plan_scaffold',
    'plan_actions',
    'plan_assertions',
    'plan_audit',
  ]);
  assert.equal(result.self_repair.rounds[0].status, 'INVALID');
  assert.equal(result.self_repair.rounds[0].code, 'INVALID_LOCATOR');
  assert.equal(result.self_repair.repair_count, 1);
  assert.equal(result.self_repair.outcome, 'ACCEPTED');
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.deepEqual(result.plan, f.plans[0]);
});

test('a stage returning blocked goes through the existing block audit and never publishes a plan', async () => {
  const f = await fixture(({ input }) => {
    if (input.purpose === 'plan_staged_step_assertions')
      return { blocked: true, reason: '结果区域定位没有页面或源码依据。' };
  });
  await launch(f, f.baseline.cases[0].case_id);
  const result = await row(f);
  assert.deepEqual(phases(f), [
    'input_review',
    'plan_scaffold',
    'plan_actions',
    'plan_assertions',
    'blocked_audit',
  ]);
  assert.equal(result.self_repair.rounds[0].status, 'BLOCKED');
  assert.equal(result.self_repair.rounds[0].code, 'MODEL_MAPPING_BLOCKED');
  assert.equal(result.self_repair.outcome, 'BLOCKED');
  assert.equal(result.status, 'BLOCKED_MAPPING');
  assert.equal(result.plan, null);
  assert.equal(result.plan_approved, false);
});

test('planning mode is validated and defaults to the unchanged single-call planner', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent-planning-mode-')),
    store = new Store(directory);
  await store.init();
  const provider = { configured: () => false };
  assert.equal(new Controller({ store, provider, browser: {} }).planningMode, 'single');
  assert.throws(
    () => new Controller({ store, provider, browser: {}, planningMode: 'weird' }),
    (error) => error.code === 'PLANNING_MODE_INVALID',
  );
});

test('all stages receive full case data, relevant observations, scaffold and already planned steps', async () => {
  const { baseline, plans } = demoCases();
  const c = clone(baseline.cases[0]);
  c.data = { query: '苹果' };
  c.preconditions = ['已登录并进入商品列表'];
  c.steps.push({ ...clone(c.steps[0]), step_id: 'S2' });
  const plan = clone(plans[0]);
  plan.steps.push({ ...clone(plan.steps[0]), step_id: 'S2', actions: [] });
  const request = {
    original: c,
    pages: [
      { controls: [{ name: '商品名称', locator: { kind: 'testid', value: 'product-search' } }] },
    ],
    revision_feedback: ['保持精确商品名称检查'],
    authentication: { mode: 'operator_confirmed' },
    self_repair: { round: 1, feedback: { code: 'ASSERTION_GAP', reason: '补充数量检查' } },
  };
  const calls = [];
  const controller = {
    ask: async (_job, prompt, input) => {
      calls.push(clone(input));
      return fixtureModelReply(prompt, input, [plan]);
    },
  };
  const result = await generateStagedPlan(controller, {}, request, c, { target: base });
  assert.equal(result.plan.steps.length, 2);
  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.deepEqual(call.original, c);
    assert.deepEqual(call.pages, request.pages);
    assert.deepEqual(call.authentication, request.authentication);
    assert.deepEqual(call.revision_feedback, request.revision_feedback);
    assert.deepEqual(call.self_repair, request.self_repair);
    assert.deepEqual(
      call.previous_steps,
      call.step?.step_id === 'S2' ? [result.plan.steps[0]] : [],
    );
    if (call.step) {
      assert.deepEqual(call.scaffold.preconditions, plan.preconditions);
      assert.deepEqual(call.scaffold.cleanup, plan.cleanup);
    }
  }
});

test('different invalid responses with the same error code consume distinct slots and can recover', async () => {
  let count = 0;
  const f = await fixture(({ input }) => {
    if (input.purpose !== 'plan_staged_step_actions') return;
    if (++count <= 2)
      return {
        actions: [{ action_id: 'A1', op: 'click', target: { kind: 'nth', value: String(count) } }],
      };
    assert.equal(input.self_repair.round, 2);
    assert.equal(input.self_repair.feedback.stage, 'plan_actions');
    assert.equal(
      input.self_repair.previous_candidate.staged_failure.response.actions[0].target.value,
      '2',
    );
  });
  await launch(f, f.baseline.cases[0].case_id);
  const result = await row(f);
  assert.equal(result.status, 'PLAN_REVIEW');
  assert.deepEqual(
    result.self_repair.rounds.map((r) => r.status),
    ['INVALID', 'INVALID', 'ACCEPTED'],
  );
  assert.notEqual(result.self_repair.rounds[0].plan_hash, result.self_repair.rounds[1].plan_hash);
  assert.equal(result.self_repair.rounds[0].staged_failure.phase, 'plan_actions');
  assert.equal(result.plan_approved, false);
  assert.deepEqual(result.attempts, []);
});

test('identical stage responses still stop without spending a third candidate', async () => {
  const f = await fixture(({ input }) => {
    if (input.purpose === 'plan_staged_step_actions')
      return { actions: [{ action_id: 'A1', op: 'click', target: { kind: 'nth', value: '1' } }] };
  });
  await launch(f, f.baseline.cases[0].case_id);
  const result = await row(f);
  assert.equal(result.self_repair.rounds.length, 2);
  assert.equal(result.self_repair.rounds[1].code, 'PLAN_REPAIR_NO_PROGRESS');
  assert.equal(result.self_repair.outcome, 'EXHAUSTED');
});

test('assertion stage receives actionable feedback and the rejected response on repair', async () => {
  let count = 0;
  const f = await fixture(({ prompt, input }) => {
    if (input.purpose !== 'plan_staged_step_assertions') return;
    if (++count === 1) {
      const reply = fixtureModelReply(prompt, input, demoCases().plans);
      reply.mapped.within_ms = 99;
      return reply;
    }
    assert.equal(input.self_repair.feedback.code, 'ASSERTION_DEADLINE_INVALID');
    assert.equal(input.self_repair.feedback.stage, 'plan_assertions');
    assert.equal(input.self_repair.previous_candidate.staged_failure.response.mapped.within_ms, 99);
  });
  await launch(f, f.baseline.cases[0].case_id);
  assert.equal((await row(f)).status, 'PLAN_REVIEW');
  assert.equal(count, 2);
});

test('provider errors do not acquire staged validation identity even when their error code is repairable', async () => {
  const { baseline } = demoCases();
  const error = Object.assign(new Error('transport failed'), { code: 'INVALID_SCHEMA' });
  const controller = {
    ask: async () => {
      throw error;
    },
  };
  await assert.rejects(
    generateStagedPlan(controller, {}, {}, baseline.cases[0], { target: base }),
    (thrown) => thrown === error && !(thrown instanceof StagedValidationError),
  );
});
