import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { demoCases } from '../src/demo.mjs';
import { caseHash } from '../src/plans.mjs';
import {
  preparationCaseBudget,
  preparationTimeBudget,
  preparationOptions,
} from '../src/job-budget.mjs';
import { adviceCategory, validateCaseAdvice, CASE_ADVICE_PROMPT } from '../src/case-advice.mjs';
import { modelPool } from '../src/preparation.mjs';
import { fixtureModelPhase, fixtureModelReply } from './fixture-model.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const done = { done: true, reason: '已取得当前用例的定位证据，不代表业务通过' };
test('a case-local malformed model reply is retained and does not cancel later cases', async (t) => {
  const h = await setup(t, {
    reply: ({ phase, input }) => {
      if (phase === 'discovery' && input.case?.case_id === 'P-1')
        throw Object.assign(new Error('DEEPSEEK_JSON_INVALID'), { code: 'DEEPSEEK_JSON_INVALID' });
    },
  });
  const state = await h.run();
  assert.equal(state.cases[0].status, 'BLOCKED_MAPPING');
  assert.equal(state.cases[0].mapping_reason, 'DEEPSEEK_JSON_INVALID');
  assert.equal(state.cases[0].attempts.length, 0);
  assert.ok(h.runtime.opens.includes('P-2'));
  assert.ok(state.events.some((e) => e.type === 'PREPARATION_CASE_PROTOCOL_FAILED'));
});
test('waiting root leaves login stage before any child discovery starts', async (t) => {
  const h = await setup(t, {
    count: 1,
    open: () => {
      assert.equal(h.controller.active.stage, 'PREPARING');
    },
  });
  h.controller.browser.authenticated = false;
  h.controller.browser.waitForAuthentication = async () => {
    assert.equal(h.controller.active.stage, 'WAITING_USER_LOGIN');
    h.controller.browser.authenticated = true;
    return { kind: 'testid', value: 'signed-in' };
  };
  await h.controller.launch(h.id, 'prepare', ['P-1']);
  await h.controller.active.finished;
  assert.ok(h.runtime.opens.includes('P-1'));
});
async function setup(
  t,
  { count = 2, reviewed = true, open, reply, time = 1500, wall = 30000 } = {},
) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-preparation-'));
  const store = new Store(directory);
  await store.init();
  const fixture = demoCases();
  const cases = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(fixture.baseline.cases[0]),
    case_id: 'P-' + (i + 1),
  }));
  const plans = cases.map((c) => ({
    ...structuredClone(fixture.plans[0]),
    case_id: c.case_id,
    case_hash: caseHash(c),
  }));
  const baseline = { ...fixture.baseline, cases, case_count: count };
  const id = await store.create({
    name: 'Isolated scheduling checks',
    target: 'http://127.0.0.1:48881/',
    baseline,
  });
  await store.update(id, (s) => {
    s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
    s.cases.forEach((r) => {
      r.reviewed = reviewed;
    });
  });
  const runtime = { opens: [], closes: [], active: 0, maximum: 0, calls: [] };
  const browser = { active: () => true, authenticated: true };
  const controller = new Controller({
    store,
    browser,
    preparationBudget: (cases, options) => ({
      ...preparationTimeBudget(cases, options),
      wall_ms: wall,
      per_case: Object.fromEntries(
        cases.map((c) => [c.case_id, { discovery_ms: time, planning_ms: time }]),
      ),
    }),
    provider: {
      configured: () => true,
      json: async (prompt, input, options) => {
        const phase =
          prompt === CASE_ADVICE_PROMPT ? 'case_advice' : fixtureModelPhase(prompt, input);
        runtime.calls.push({
          case_id: input.case?.case_id ?? input.original?.case_id ?? input.effective?.case_id,
          phase,
        });
        const custom = await reply?.({ prompt, input, options, phase, plans, controller });
        return {
          value: custom ?? (phase === 'discovery' ? done : fixtureModelReply(prompt, input, plans)),
          usage: {},
        };
      },
    },
    discoveryFactory: (session, task, options) => {
      const caseId =
        options.case_id ??
        [...controller.active.workers.values()].find((w) => !runtime.opens.includes(w.current_case))
          ?.current_case;
      let closed = false;
      return {
        async open() {
          runtime.opens.push(caseId);
          runtime.active++;
          runtime.maximum = Math.max(runtime.maximum, runtime.active);
          await open?.(caseId, options, runtime);
          return this.observe();
        },
        async observe() {
          return {
            page_id: caseId,
            snapshot: {
              url: 'http://127.0.0.1:48881/products',
              title: 'Synthetic page',
              text: 'Synthetic technical evidence',
              login_page: false,
              controls: [
                {
                  role: 'heading',
                  name: 'Products',
                  locator: { kind: 'testid', value: 'products' },
                },
              ],
            },
            candidates: [],
          };
        },
        async close() {
          if (!closed) {
            runtime.closes.push(caseId);
            runtime.active--;
            closed = true;
          }
        },
      };
    },
  });
  t.after(async () => {
    if (controller.active) await controller.stop(id);
    await store.releaseLock();
  });
  const run = async (options = {}, ids = cases.map((c) => c.case_id)) => {
    await controller.launch(id, 'discover', ids, options);
    const job = controller.active;
    await job.promise;
    return store.read(id);
  };
  return { id, store, controller, cases, plans, run, runtime, directory };
}

test('targeted recovery distinguishes fixed values/states and retains the last permitted action evidence', async (t) => {
  let acts = 0,
    recovered = false,
    limit = 0;
  const h = await setup(t, {
    count: 1,
    time: 10000,
    reply: ({ phase, input }) => {
      if (phase === 'plan' && !recovered) return { blocked: true, reason: '缺少目标表格证据' };
      if (phase === 'evidence_recovery') {
        assert.equal(
          input.candidates.length,
          1,
          'different values and states must not be pruned as repeated actions',
        );
        return { action: { candidate_id: input.candidates[0].candidate_id }, reason: '定向补证' };
      }
    },
  });
  h.controller.discoveryFactory = (_session, _task, options) => {
    limit = options.maxSteps;
    let c;
    return {
      beginCase(value) {
        c = value;
      },
      async open() {
        assert.equal(c.case_id, 'P-1');
        return this.observe();
      },
      async observe() {
        return {
          page_id: String(acts),
          snapshot: {
            url: 'http://127.0.0.1:48881/products',
            title: 'Synthetic recovery page',
            text: acts < 2 ? 'same' : 'state-' + acts,
            controls:
              acts === limit
                ? [{ name: '目标表格', role: 'table', locator: { kind: 'testid', value: 'table' } }]
                : [],
          },
          candidates: [
            {
              candidate_id: 'c-' + acts,
              locator: { kind: 'testid', value: 'query' },
              operation: 'fill',
              value: acts === 1 ? 'second' : 'first',
            },
          ],
        };
      },
      async act() {
        acts++;
        recovered = acts === limit;
        return this.observe();
      },
      async close() {},
    };
  };
  await h.store.update(h.id, (s) => {
    s.snapshots = [{ url: 'http://127.0.0.1:48881/products', text: 'start', controls: [] }];
  });
  await h.controller.launch(h.id, 'plan', ['P-1']);
  await h.controller.active.finished;
  const state = await h.store.read(h.id),
    row = state.cases[0];
  assert.equal(
    acts,
    limit,
    JSON.stringify({
      recoveries: row.evidence_recoveries,
      events: state.events.slice(-5),
      calls: h.runtime.calls,
    }),
  );
  assert.equal(row.evidence_recoveries[0].status, 'NEW_EVIDENCE');
  assert.equal(row.evidence_recoveries[0].added_binding_facts, 1);
  assert.ok(state.snapshots.some((p) => p.controls.some((v) => v.name === '目标表格')));
  assert.equal(row.status, 'PLAN_REVIEW', JSON.stringify(state.events.slice(-5)));
  assert.equal(row.plan_approved, false);
  assert.equal(row.attempts.length, 0);
  assert.equal(row.preparation_budget.used, 2, 'new evidence must not reset candidate spend');
});

test('case budgets grow with steps/obligations and preserve a bounded wall protection', () => {
  const simple = { steps: [{ obligations: [{ id: 'a' }] }] };
  const complex = { steps: Array.from({ length: 12 }, () => ({ obligations: [{}, {}, {}] })) };
  assert.ok(
    preparationCaseBudget(complex).discovery_ms > preparationCaseBudget(simple).discovery_ms,
  );
  assert.ok(preparationCaseBudget(complex).planning_ms > preparationCaseBudget(simple).planning_ms);
  const cases = Array.from({ length: 100 }, (_, i) => ({ ...complex, case_id: String(i) }));
  const a = preparationTimeBudget(cases, { time_multiplier: 1, concurrency: 1 });
  const b = preparationTimeBudget(cases, { time_multiplier: 1, concurrency: 2 });
  assert.equal(a.wall_ms, 10800000);
  assert.equal(a.wall_ms, b.wall_ms);
  assert.ok(a.work_ms > a.wall_ms);
  assert.throws(
    () => preparationOptions({ concurrency: 2 }, { authorization: { writes: false } }),
    /PARALLEL_READONLY/,
  );
  assert.throws(
    () =>
      preparationOptions(
        { concurrency: 2, independent_readonly: true },
        { authorization: { writes: true } },
      ),
    /PARALLEL_READONLY/,
  );
});

test('first Case timeout preserves partial evidence and does not prevent the remaining 7+1 batch selection', async (t) => {
  const h = await setup(t, {
    count: 8,
    reviewed: false,
    // This is a scheduling-isolation test, not a sub-second disk benchmark.
    // Under the concurrent browser suite, a healthy worker took 338ms and
    // exceeded the old 300ms injected window. Keep a real first-case timeout
    // and all isolation assertions, with headroom for the other seven workers.
    time: 3000,
    open: async (id) => {
      if (id === 'P-1') await sleep(3200);
    },
  });
  const s = await h.run();
  assert.equal(s.cases[0].status, 'BLOCKED_BUDGET');
  assert.equal(s.cases[0].case_advice.category, 'TIME_BUDGET');
  assert.ok(
    s.cases.slice(1).every((c) => c.discovery.status === 'CAPTURED'),
    JSON.stringify({ directory: h.directory, workers: s.preparation.workers }),
  );
  assert.equal(s.events.filter((e) => e.type === 'JOB_BATCH_FINISHED').length, 2);
  assert.equal(h.runtime.closes.length, 8);
  assert.equal(h.runtime.active, 0);
});

test('discovery and planning each receive their own time window, not a shared cumulative deadline', async (t) => {
  const h = await setup(t, {
    count: 1,
    // Combined work still exceeds one window. Allow scheduling headroom when
    // the full suite launches real Chromium alongside these injected phases.
    time: 4000,
    open: async () => sleep(2200),
    reply: async ({ phase }) => {
      if (phase === 'plan') await sleep(2200);
    },
  });
  const s = await h.run();
  assert.equal(s.cases[0].status, 'PLAN_REVIEW');
  assert.ok(s.cases[0].plan);
  assert.equal(s.cases[0].plan_approved, false);
  assert.equal(s.cases[0].attempts.length, 0);
});

test('plan timeout retains captured pages and next invocation reuses them without resetting usage', async (t) => {
  let slow = true;
  const h = await setup(t, {
    count: 1,
    time: 400,
    reply: async ({ phase }) => {
      if (phase === 'plan' && slow) {
        slow = false;
        await sleep(460);
      }
    },
  });
  const s = await h.run();
  assert.equal(s.cases[0].discovery.status, 'CAPTURED');
  assert.equal(s.cases[0].status, 'BLOCKED_BUDGET');
  const spent = s.cases[0].preparation_usage.logical_calls;
  const resumed = await h.run({ time_multiplier: 2 });
  assert.equal(h.runtime.opens.length, 1);
  assert.ok(resumed.preparation.workers['P-1'].reused);
  assert.equal(resumed.cases[0].preparation_usage.rounds, 2);
  assert.ok(resumed.cases[0].preparation_usage.logical_calls >= spent);
});

test('two workers overlap but have isolated contexts, request attribution and unapproved plans', async (t) => {
  const h = await setup(t, {
    count: 3,
    open: async () => sleep(70),
    reply: async ({ phase, input }) => {
      if (phase === 'discovery') await sleep(input.case.case_id === 'P-1' ? 45 : 5);
    },
  });
  const s = await h.run({ concurrency: 2, independent_readonly: true });
  assert.equal(h.runtime.maximum, 2);
  assert.equal(h.runtime.active, 0);
  assert.equal(new Set(h.runtime.opens).size, 3);
  assert.ok(
    s.cases.every((r) => r.plan?.case_id === r.case_id && !r.plan_approved && !r.attempts.length),
  );
  const records = (await h.controller.diagnostics(h.id)).records.filter(
    (r) => r.type === 'MODEL_REQUEST',
  );
  assert.ok(records.every((r) => r.worker_id === r.case_id));
  assert.equal(new Set(records.map((r) => r.call_number)).size, records.length);
  assert.ok(s.cases.every((r) => r.navigation_start.navigation_job_id === s.preparation.job_id));
});

test('serial is default and parallel requires an explicit independent-read-only declaration', async (t) => {
  const h = await setup(t, { reviewed: false, open: async () => sleep(15) });
  await assert.rejects(h.run({ concurrency: 2 }), {
    code: 'PARALLEL_READONLY_CONFIRMATION_REQUIRED',
  });
  await h.run();
  assert.equal(h.runtime.maximum, 1);
});

test('global timeout retains queued Cases and user cancellation is not a technical failure', async (t) => {
  const h = await setup(t, { count: 3, reviewed: false, wall: 100, open: async () => sleep(150) });
  const s = await h.run();
  assert.equal(s.preparation.reason, 'PREPARATION_JOB_TIMEOUT');
  assert.equal(s.cases[1].discovery, undefined);
  assert.equal(h.runtime.active, 0);
  const h2 = await setup(t, { count: 3, reviewed: false, open: async () => sleep(120) });
  await h2.controller.launch(
    h2.id,
    'discover',
    h2.cases.map((c) => c.case_id),
    { concurrency: 2, independent_readonly: true },
  );
  const stoppedJob = h2.controller.active;
  await sleep(35);
  await h2.controller.stop(h2.id);
  await stoppedJob.promise;
  const stopped = await h2.store.read(h2.id);
  assert.equal(stopped.status, 'STOPPED');
  assert.equal(h2.runtime.active, 0);
  assert.equal(stopped.cases[2].discovery, undefined);
});

test('context change invalidates the discovery checkpoint instead of recycling another session', async (t) => {
  const h = await setup(t, { count: 1, reviewed: false });
  await h.run();
  h.controller.discoverySessionKey = 'new-session';
  await h.run();
  assert.equal(h.runtime.opens.length, 2);
});

test('input advice is a draft: reject keeps Case; accept requires matching version and keeps original history', async (t) => {
  let proposal;
  const h = await setup(t, {
    count: 1,
    reply: async ({ phase, input }) => {
      if (phase === 'input_review')
        return {
          issues: [
            {
              code: 'AMBIGUOUS',
              step_id: input.effective.steps[0].step_id,
              message: '合成测试歧义',
              source_quotes: [input.effective.steps[0].action],
            },
          ],
        };
      if (phase === 'case_advice') {
        const step = input.effective.steps[0];
        proposal = {
          step_id: step.step_id,
          field: 'action',
          before: step.action,
          after: step.action + '（按已确认测试数据）',
          reason: '合成的人工待核对草案',
          source_quotes: [step.action],
          coverage_impact: '明确对象来源，预期保持',
          requires_input: false,
        };
        return { suggestions: [proposal] };
      }
    },
  });
  const original = await fs.readFile(path.join(h.store.dir(h.id), 'baseline.json'));
  const s = await h.run(),
    advice = s.cases[0].case_advice;
  assert.equal(s.cases[0].confirmations.length, 0);
  assert.equal(advice.suggestions.length, 1);
  assert.equal(s.cases[0].plan, null);
  const steps = h.cases[0].steps.map(({ step_id, action, expected, obligations }) => ({
    step_id,
    action,
    expected,
    obligations,
  }));
  steps[0].action = proposal.after;
  await assert.rejects(
    h.controller.confirmCase(h.id, 'P-1', {
      steps,
      note: '人工核对',
      advice_id: advice.id,
      expected_case_hash: 'stale',
    }),
    { code: 'CASE_ADVICE_STALE' },
  );
  await h.controller.confirmCase(h.id, 'P-1', {
    steps,
    note: '人工核对',
    advice_id: advice.id,
    expected_case_hash: advice.case_hash,
  });
  const revised = await h.store.read(h.id);
  assert.equal(revised.cases[0].case_advice.status, 'APPLIED');
  assert.equal(revised.cases[0].case_version, 2);
  assert.equal(revised.cases[0].plan_approved, false);
  assert.deepEqual(await fs.readFile(path.join(h.store.dir(h.id), 'baseline.json')), original);
});

test('only original input issues can yield revision suggestions; capability/time failure cannot manufacture an oracle change', () => {
  assert.equal(
    adviceCategory({ status: 'BLOCKED_BUDGET', input_review: { issues: [{}] } }),
    'TIME_BUDGET',
  );
  assert.equal(
    adviceCategory({ status: 'BLOCKED_MAPPING', mapping_reason: 'URL断言不支持', attempts: [] }),
    'ENGINE_CAPABILITY',
  );
  const c = { case_id: 'C', steps: [{ step_id: 'S', action: '点击', expected: '成功' }] };
  const change = {
    step_id: 'S',
    field: 'expected',
    before: '成功',
    after: '失败',
    reason: '页面失败',
    source_quotes: ['成功'],
    coverage_impact: '删除通过要求',
    requires_input: false,
  };
  assert.throws(() => validateCaseAdvice({ suggestions: [change] }, c, []), {
    code: 'CASE_ADVICE_INVALID',
  });
  assert.throws(
    () =>
      validateCaseAdvice({ suggestions: [change] }, c, [
        { step_id: 'S', code: 'AMBIGUOUS', source_quotes: ['点击'] },
      ]),
    { code: 'CASE_ADVICE_UNGROUNDED' },
  );
});

test('model permit queue is bounded and cancellation does not strand the next waiter', async () => {
  const permit = modelPool(2),
    a = new AbortController(),
    b = new AbortController();
  const release1 = await permit(a.signal),
    release2 = await permit(a.signal);
  const pending = permit(b.signal);
  b.abort(new Error('cancelled'));
  await assert.rejects(pending, /cancelled/);
  release1();
  release2();
  const release3 = await permit(a.signal);
  release3();
});
