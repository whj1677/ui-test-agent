import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { Controller } from '../src/controller.mjs';
import { demoCases } from '../src/demo.mjs';
import { uid } from '../src/common.mjs';
import { fixtureModelPhase, fixtureModelReply } from './fixture-model.mjs';

const base = 'http://127.0.0.1:48100';
const marker = { kind: 'testid', value: 'signed-in' };
const done = { done: true, reason: '已取得当前用例需要的页面定位技术事实' };
const pick = (input) => ({
  action: { candidate_id: input.candidates[0].candidate_id },
  reason: '打开当前用例关联页面采集控件',
});
const deferred = () => {
  let resolve;
  return {
    promise: new Promise((r) => {
      resolve = r;
    }),
    resolve: (value) => resolve(value),
  };
};
const errorCode = (expected) => (error) => error.code === expected;

async function setup({
  count = 1,
  reviewed = true,
  configured = true,
  fixture = false,
  respond,
  stablePage = false,
} = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-discovery-controller-'));
  const store = new Store(directory);
  await store.init();
  const authored = demoCases();
  const cases = Array.from({ length: count }, (_, index) => {
    const source = structuredClone(authored.baseline.cases[index % authored.baseline.cases.length]);
    if (index >= authored.baseline.cases.length) source.case_id += '-BATCH-' + (index + 1);
    return source;
  });
  const plans = Array.from({ length: count }, (_, index) => {
    const source = structuredClone(authored.plans[index % authored.plans.length]);
    source.case_id = cases[index].case_id;
    return source;
  });
  const baseline = {
    ...authored.baseline,
    cases,
    case_count: count,
  };
  const id = await store.create({ name: 'Discovery controller fixture', target: base, baseline });
  await store.update(id, (s) => {
    s.fixture = fixture;
    s.authorization = { nonproduction: true, writes: false, readOnlyEndpoints: [] };
    s.cases.forEach((c) => (c.reviewed = reviewed));
  });
  const calls = [],
    browser = {
      authenticated: false,
      authentications: 0,
      active: () => true,
      async authenticate(task, actualMarker) {
        assert.equal(task.id, id);
        assert.deepEqual(actualMarker, marker);
        this.authentications++;
        this.authenticated = true;
      },
    };
  const runtime = {
    opens: 0,
    observes: 0,
    actions: [],
    navigations: [],
    closes: 0,
    factories: 0,
    step: 0,
    path: '/home',
    options: null,
  };
  const observation = () => ({
    page_id: 'page-' + runtime.step,
    snapshot: {
      url: base + runtime.path,
      title: 'Synthetic UI ' + (stablePage ? 0 : runtime.step),
      text: 'Technical observation ' + (stablePage ? 0 : runtime.step),
      controls: [
        { role: 'link', name: '相关模块', locator: { kind: 'testid', value: 'related-menu' } },
      ],
      login_page: false,
    },
    candidates: [
      {
        candidate_id: 'observation-' + runtime.step + ':menu',
        kind: 'link',
        name: '相关模块',
        locator: { kind: 'testid', value: 'related-menu' },
      },
    ],
  });
  const provider = {
    model: 'fixture-model',
    configured: () => configured,
    json: async (prompt, input, options) => {
      const phase = fixtureModelPhase(prompt, input);
      calls.push({ prompt, phase, input: structuredClone(input) });
      const value = ['input_review', 'plan_audit'].includes(phase)
        ? fixtureModelReply(prompt, input, plans)
        : respond
          ? await respond(input, { calls, runtime, options, plans, baseline, phase })
          : phase === 'discovery'
            ? runtime.actions.length
              ? done
              : pick(input)
            : fixtureModelReply(prompt, input, plans);
      return {
        value,
        usage: { response_model: 'fixture-model', prompt_tokens: 5, completion_tokens: 4 },
      };
    },
  };
  const controller = new Controller({
    store,
    provider,
    browser,
    discoveryFactory: (session, task, options) => {
      assert.equal(session, browser);
      assert.equal(task.id, id);
      runtime.factories++;
      runtime.options = options;
      return {
        beginCase() {
          runtime.caseStarts = (runtime.caseStarts ?? 0) + 1;
        },
        async open() {
          runtime.opens++;
          return observation();
        },
        async observe() {
          runtime.observes++;
          return observation();
        },
        async navigate(entry) {
          await options.onEvent({ type: 'DISCOVERY_NAVIGATE_BEFORE', entry_path: entry });
          runtime.navigations.push(entry);
          runtime.path = entry;
          runtime.step++;
          return observation();
        },
        async act(action) {
          await options.onEvent({
            type: 'DISCOVERY_ACTION_BEFORE',
            candidate_id: action.candidate_id,
          });
          if (runtime.actionTimeoutOnce) {
            runtime.actionTimeoutOnce = false;
            throw Object.assign(new Error('action timeout'), { code: 'DISCOVERY_ACTION_TIMEOUT' });
          }
          if (runtime.staleOnce) {
            runtime.staleOnce = false;
            throw Object.assign(new Error('page changed'), { code: 'DISCOVERY_STALE_PAGE' });
          }
          runtime.actions.push(structuredClone(action));
          runtime.step++;
          if (!stablePage) runtime.path = '/observed/' + runtime.step;
          return observation();
        },
        async close() {
          runtime.closes++;
        },
      };
    },
  });
  const originalBytes = await fs.readFile(path.join(store.dir(id), 'baseline.json'));
  return {
    store,
    id,
    controller,
    browser,
    runtime,
    calls,
    baseline,
    plans,
    originalBytes,
    async authenticateAndStart() {
      await controller.authenticate(id, marker);
      const result = await controller.discoverAfterAuthentication(id);
      return { result, job: controller.active };
    },
    async state() {
      return store.read(id);
    },
    async assertOriginal() {
      assert.deepEqual(await fs.readFile(path.join(store.dir(id), 'baseline.json')), originalBytes);
      assert.deepEqual(await store.baseline(id), baseline);
    },
  };
}

test('one authentication starts autonomous discovery then prepares an unapproved plan without changing the baseline', async () => {
  const h = await setup(),
    { result, job } = await h.authenticateAndStart();
  assert.deepEqual(result, { authenticated: true, discovery_started: true });
  assert.ok(job);
  await job.promise;
  const state = await h.state(),
    row = state.cases[0];
  assert.equal(h.browser.authentications, 1);
  assert.equal(h.runtime.opens, 1);
  assert.equal(h.runtime.actions.length, 1);
  assert.equal(h.runtime.closes, 1);
  assert.equal(row.discovery.status, 'CAPTURED');
  assert.equal(row.status, 'PLAN_REVIEW');
  assert.equal(row.plan_approved, false);
  assert.equal(row.attempts.length, 0);
  assert.equal(state.discovery.steps, 1);
  assert.equal(state.discovery.pages, 2);
  assert.ok(
    state.snapshots.every(
      (p) => p.discovery_case_id === row.case_id && p.discovery_job_id === job.run_id,
    ),
  );
  assert.equal(h.calls.filter((c) => c.input.purpose === 'case_ui_discovery').length, 2);
  assert.deepEqual(
    h.calls.filter((c) => c.phase !== 'discovery').map((c) => c.phase),
    ['input_review', 'plan', 'plan_audit'],
  );
  const planned = h.calls.find((c) => c.phase === 'plan');
  assert.ok(planned);
  assert.deepEqual(planned.input.original.steps, h.baseline.cases[0].steps);
  assert.deepEqual(
    row.plan.steps.map((s) => s.source_expected),
    h.baseline.cases[0].steps.map((s) => s.expected),
  );
  await h.assertOriginal();
  const logs = await h.controller.diagnosticLog(h.id).read();
  for (const phase of ['discovery', 'input_review', 'plan', 'plan_audit'])
    assert.ok(
      logs.some((r) => r.type === 'MODEL_REQUEST' && r.phase === phase),
      phase,
    );
});

test('unreviewed cases receive discovery observations but no generated or approved plan', async () => {
  const h = await setup({ reviewed: false, respond: () => done }),
    { job } = await h.authenticateAndStart();
  await job.promise;
  const row = (await h.state()).cases[0];
  assert.equal(row.discovery.status, 'CAPTURED');
  assert.equal(row.status, 'NEEDS_REVIEW');
  assert.equal(row.plan, null);
  assert.equal(row.plan_approved, false);
  assert.ok(h.calls.length > 0 && h.calls.every((c) => c.input.purpose === 'case_ui_discovery'));
  assert.equal(h.runtime.closes, 1);
  await h.assertOriginal();
});

test('unknown discovery candidate is never dispatched or converted into a plan', async () => {
  const h = await setup({
      respond: () => ({ action: { candidate_id: 'unknown-observation:id' }, reason: '打开页面' }),
    }),
    { job } = await h.authenticateAndStart();
  await job.promise;
  const row = (await h.state()).cases[0];
  assert.equal(row.status, 'BLOCKED_MAPPING');
  assert.equal(row.mapping_reason, 'DISCOVERY_CANDIDATE_UNKNOWN');
  assert.equal(row.plan, null);
  assert.equal(h.runtime.actions.length, 0);
  assert.equal(h.runtime.closes, 1);
  assert.equal(h.calls.length, 1);
});

for (const type of ['action', 'done'])
  test('cancelled late ' + type + ' response cannot dispatch UI or generate a plan', async () => {
    const entered = deferred(),
      release = deferred();
    const h = await setup({
      respond: async (input) => {
        entered.resolve();
        await release.promise;
        return type === 'action' ? pick(input) : done;
      },
    });
    const { job } = await h.authenticateAndStart();
    await entered.promise;
    await h.controller.stop(h.id);
    release.resolve();
    await job.promise;
    const state = await h.state();
    assert.equal(state.status, 'STOPPED');
    assert.equal(state.discovery.status, 'STOPPED');
    assert.equal(h.runtime.actions.length, 0);
    assert.equal(h.runtime.closes, 1);
    assert.equal(h.calls.length, 1);
    assert.equal(state.cases[0].plan, null);
    const logs = await h.controller.diagnosticLog(h.id).read();
    assert.ok(logs.some((r) => r.type === 'MODEL_DECISION' && r.outcome === 'CANCELLED'));
  });

test('the same observed state and action is removed so the model can finish instead of looping', async () => {
  const h = await setup({
      stablePage: true,
      reviewed: false,
      respond: (input) => (input.candidates.length ? pick(input) : done),
    }),
    { job } = await h.authenticateAndStart();
  await job.promise;
  const row = (await h.state()).cases[0];
  assert.equal(row.discovery.status, 'CAPTURED');
  assert.equal(h.runtime.actions.length, 1);
  assert.equal(h.calls.length, 2);
  assert.equal(h.runtime.closes, 1);
  assert.equal(h.calls[1].input.excluded_repeated_candidates, 1);
  assert.equal(h.calls[1].input.candidates.length, 0);
  assert.equal(row.discovery_memory.transitions.length, 1);
  assert.equal(row.discovery_memory.observed_controls[0].evidence, 'DOM_OBSERVED');
});

test('discovery budget scales by selected Case count instead of stopping at a shared 24 calls', async () => {
  const perCaseCalls = new Map();
  const h = await setup({
    count: 2,
    reviewed: false,
    respond: (input) => {
      const calls = (perCaseCalls.get(input.case.case_id) ?? 0) + 1;
      perCaseCalls.set(input.case.case_id, calls);
      return calls === 13 ? done : pick(input);
    },
  });
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(h.calls.length, 26);
  assert.equal(state.discovery.model_calls, 26);
  assert.equal(state.discovery.budget.case_count, 2);
  assert.equal(state.discovery.budget.model_calls.limit, 100);
  assert.equal(state.discovery.budget.discovery.model_call_limit, 26);
  assert.equal(state.discovery.budget.discovery.model_calls_per_case, 13);
  assert.equal(state.discovery.status, 'CAPTURED');
  assert.equal(state.discovery.completed_cases, 2);
  assert.equal(h.runtime.actions.length, 24);
  assert.equal(h.runtime.options.maxSteps, 13);
  assert.equal(h.runtime.closes, 2);
  assert.ok(state.cases.every((c) => c.discovery.status === 'CAPTURED'));
  assert.ok(state.cases.every((c) => c.discovery.model_calls === 13));
});

test('a Case step budget blocks only that Case and continues to later Cases', async () => {
  const h = await setup({
    count: 2,
    reviewed: false,
    respond: (input, { baseline }) =>
      input.case.case_id === baseline.cases[0].case_id ? pick(input) : done,
  });
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(state.discovery.status, 'PARTIAL');
  assert.equal(state.cases[0].status, 'BLOCKED_BUDGET');
  assert.equal(state.cases[0].discovery.reason, 'DISCOVERY_CASE_STEP_LIMIT');
  assert.equal(state.cases[0].discovery.model_calls, 13);
  assert.equal(state.cases[1].discovery.status, 'CAPTURED');
  assert.equal(state.cases[1].discovery.model_calls, 1);
  assert.equal(h.runtime.caseStarts, 2);
  assert.equal(h.runtime.closes, 2);
});

test('selected Cases beyond one bounded batch continue automatically in later batches', async () => {
  const h = await setup({ count: 8, reviewed: false, respond: () => done }),
    { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(h.runtime.factories, 8);
  assert.equal(h.runtime.opens, 8);
  assert.equal(h.runtime.closes, 8);
  assert.equal(h.calls.length, 8);
  assert.ok(state.cases.every((c) => c.discovery.status === 'CAPTURED'));
  assert.equal(state.discovery.batch_index, 2);
  assert.equal(state.discovery.batch_count, 2);
  assert.equal(state.discovery.project_model_calls, 8);
  assert.equal(state.events.filter((e) => e.type === 'JOB_BATCH_STARTED').length, 2);
  assert.equal(state.events.filter((e) => e.type === 'JOB_BATCH_FINISHED').length, 2);
  assert.equal(state.events.filter((e) => e.type === 'JOB_FINISHED').length, 1);
});

test('automatic discovery resumes budget-blocked Cases before recapturing completed Cases', async () => {
  const h = await setup({ count: 2, reviewed: false, respond: () => done });
  await h.store.update(h.id, (s) => {
    s.cases[0].discovery = { status: 'CAPTURED', job_id: 'earlier' };
    s.cases[1].status = 'BLOCKED_BUDGET';
    s.cases[1].discovery = {
      status: 'BLOCKED',
      job_id: 'earlier',
      reason: 'DISCOVERY_CASE_STEP_LIMIT',
    };
  });
  const { job } = await h.authenticateAndStart();
  await job.promise;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].input.case.case_id, h.baseline.cases[1].case_id);
  const state = await h.state();
  assert.equal(state.cases[0].discovery.job_id, 'earlier');
  assert.equal(state.cases[1].discovery.status, 'CAPTURED');
});

test('diagnostic I/O failure before an approved discovery dispatch stops the job and closes the explorer', async () => {
  const h = await setup({ respond: (input) => pick(input) }),
    log = h.controller.diagnosticLog(h.id),
    append = log.append.bind(log);
  log.append = async (record) => {
    if (record.type === 'MODEL_DECISION')
      throw Object.assign(new Error('injected disk failure'), { code: 'ENOSPC' });
    return append(record);
  };
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(state.discovery.reason, 'DIAGNOSTIC_WRITE_FAILED');
  assert.equal(state.discovery.status, 'FAILED');
  assert.equal(h.runtime.actions.length, 0);
  assert.equal(h.runtime.closes, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(state.cases[0].plan, null);
});

test('a blocked Case does not prevent later Cases from being discovered and prepared', async () => {
  const h = await setup({
    count: 2,
    respond: (input, { plans, baseline }) =>
      input.purpose === 'case_ui_discovery'
        ? input.case.case_id === baseline.cases[0].case_id
          ? { blocked: true, reason: '第一条用例详情需要业务提交后出现，目前缺少源码映射' }
          : done
        : { plan: plans.find((p) => p.case_id === input.original.case_id) },
  });
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(state.discovery.status, 'PARTIAL');
  assert.equal(state.discovery.blocked_cases, 1);
  assert.equal(state.discovery.completed_cases, 1);
  assert.equal(state.cases[0].status, 'BLOCKED_MAPPING');
  assert.equal(state.cases[0].plan, null);
  assert.equal(state.cases[1].status, 'PLAN_REVIEW');
  assert.equal(state.cases[1].plan_approved, false);
  assert.equal(h.runtime.closes, 2);
  await h.assertOriginal();
});

test('one action timeout is isolated to its Case and every Case starts a fresh loop allowance', async () => {
  const h = await setup({
    count: 2,
    respond: (input, { plans, baseline }) =>
      input.purpose === 'case_ui_discovery'
        ? input.case.case_id === baseline.cases[0].case_id
          ? pick(input)
          : done
        : { plan: plans.find((p) => p.case_id === input.original.case_id) },
  });
  h.runtime.actionTimeoutOnce = true;
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(state.discovery.status, 'PARTIAL');
  assert.equal(state.cases[0].mapping_reason, 'DISCOVERY_ACTION_TIMEOUT');
  assert.equal(state.cases[1].status, 'PLAN_REVIEW');
  assert.equal(h.runtime.caseStarts, 2);
});

for (const [setting, expected] of [
  ['fixture', 'FIXTURE_PRESET'],
  ['noKey', 'DEEPSEEK_KEY_REQUIRED'],
  ['executed', 'NO_UNEXECUTED_CASES'],
  ['cleanup', 'CLEANUP_REQUIRED'],
])
  test('automatic discovery reports ' + expected + ' instead of opening an explorer', async () => {
    const h = await setup({ fixture: setting === 'fixture', configured: setting !== 'noKey' });
    if (setting === 'executed')
      await h.store.update(h.id, (s) =>
        s.cases[0].attempts.push({ id: uid(), sha256: '0'.repeat(64) }),
      );
    if (setting === 'cleanup')
      await h.store.update(h.id, (s) => {
        s.cases[0].cleanup_required = true;
      });
    const { result, job } = await h.authenticateAndStart();
    assert.deepEqual(result, {
      authenticated: true,
      discovery_started: false,
      discovery_reason: expected,
    });
    assert.equal(job, null);
    assert.equal(h.browser.authentications, 1);
    assert.equal(h.runtime.factories, 0);
    assert.equal(h.calls.length, 0);
  });

test('explicit discovery refuses selected executed Cases and any unresolved cleanup', async () => {
  const h = await setup();
  await h.controller.authenticate(h.id, marker);
  await h.store.update(h.id, (s) =>
    s.cases[0].attempts.push({ id: uid(), sha256: '0'.repeat(64) }),
  );
  await assert.rejects(
    () => h.controller.launch(h.id, 'discover', [h.baseline.cases[0].case_id]),
    errorCode('CASE_ALREADY_EXECUTED'),
  );
  await h.store.update(h.id, (s) => {
    s.cases[0].attempts = [];
    s.cases[0].cleanup_required = true;
  });
  await assert.rejects(
    () => h.controller.launch(h.id, 'discover', [h.baseline.cases[0].case_id]),
    errorCode('CLEANUP_REQUIRED'),
  );
  assert.equal(h.runtime.factories, 0);
  assert.equal(h.calls.length, 0);
});

test('a replaced target refreshes observation and asks again without replaying a dispatched action', async () => {
  const h = await setup();
  h.runtime.staleOnce = true;
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(h.calls.filter((c) => c.input.purpose === 'case_ui_discovery').length, 3);
  assert.equal(h.runtime.actions.length, 1);
  assert.equal(h.runtime.closes, 1);
  assert.ok(state.events.some((e) => e.type === 'DISCOVERY_REFRESHED'));
  assert.equal(state.cases[0].status, 'PLAN_REVIEW');
  assert.equal(state.cases[0].plan_approved, false);
  await h.assertOriginal();
});

test('a late plan pauses planning while preserving completed discovery', async (t) => {
  const actualNow = Date.now;
  let elapsed = 0;
  t.mock.method(Date, 'now', () => actualNow() + elapsed);
  const h = await setup({
    respond: (input, { plans }) => {
      if (input.purpose === 'case_ui_discovery') return done;
      elapsed = 181000;
      return { plan: plans[0] };
    },
  });
  const { job } = await h.authenticateAndStart();
  await job.promise;
  const state = await h.state();
  assert.equal(state.discovery.status, 'CAPTURED');
  assert.equal(state.cases[0].status, 'BLOCKED_BUDGET');
  assert.equal(state.cases[0].mapping_reason, 'PREPARATION_PLAN_TIMEOUT');
  assert.equal(state.cases[0].plan, null);
  assert.equal(h.runtime.closes, 1);
  assert.ok(!state.events.some((e) => e.type === 'PLAN_GENERATED'));
});
