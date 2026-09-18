import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareAdaptive,
  requireAdaptiveAudit,
  adaptiveContextHash,
} from '../src/adaptive-preparation.mjs';
import { caseHash, planHash } from '../src/plans.mjs';
import { effectiveCase } from '../src/store.mjs';
import { INPUT_REVIEW_PROMPT } from '../src/input-review.mjs';

// Entirely injected store/controller/browser. No real model, browser or service.
function fixture() {
  const c = {
    case_id: 'ADAPT-1',
    title: '只读设备核验',
    source_side: 'ui',
    preconditions: '登录后只读查询资产设备。',
    data: { id: 'D001' },
    steps: [
      {
        step_id: 'S1',
        action: '从总览进入资产设备，查看D001详情。',
        expected: '设备编号为D001。',
        obligations: [{ id: 'S1-O1', text: '设备编号为D001。' }],
      },
    ],
  };
  const baseline = { cases: [structuredClone(c)] };
  const job = { id: 'job-adaptive', kind: 'test', abort: new AbortController() };
  let state = {
    target: 'http://lab.invalid/',
    authorization: { nonproduction: true, writes: false },
    auth_marker: { kind: 'text', value: '演示用户', exact: true },
    snapshots: [{ text: 'old irrelevant DOM' }],
    cases: [
      {
        case_id: c.case_id,
        reviewed: true,
        attempts: [],
        confirmations: [],
        plan: null,
        plan_approved: false,
        status: 'NEEDS_MAPPING',
      },
    ],
    events: [],
  };
  const trace = [],
    calls = [];
  const hooks = { ask: null, snapshot: null, read: null, update: null };
  const env = {
    active: true,
    response: { issues: [] },
    page: {
      url: 'http://lab.invalid/overview?view=assets#/panel?tab=main',
      login_page: false,
      network_issues: [],
      text: '当前首页',
      controls: [],
    },
  };
  const controller = {
    store: {
      async read() {
        trace.push('read');
        hooks.read?.();
        return structuredClone(state);
      },
      async update(id, fn) {
        assert.equal(id, job.id);
        trace.push('update');
        hooks.update?.();
        const draft = structuredClone(state);
        fn(draft);
        state = draft;
      },
      event(s, type, data) {
        s.events.push({ type, ...data });
      },
    },
    browser: {
      active(id) {
        assert.equal(id, job.id);
        return env.active;
      },
      authenticated: true,
      async snapshot() {
        trace.push('snapshot');
        hooks.snapshot?.();
        return structuredClone(env.page);
      },
    },
    assertCurrent(candidate) {
      trace.push('current');
      assert.equal(candidate, job);
      if (job.abort.signal.aborted) throw Object.assign(new Error('STOPPED'), { code: 'STOPPED' });
    },
    assertInput(candidate, s, base, id, hash) {
      trace.push('input');
      this.assertCurrent(candidate);
      const row = s.cases.find((r) => r.case_id === id);
      if (
        caseHash(
          effectiveCase(
            base.cases.find((item) => item.case_id === id),
            row,
          ),
        ) !== hash
      )
        throw Object.assign(new Error('MODEL_INPUT_CHANGED'), { code: 'MODEL_INPUT_CHANGED' });
    },
    async ask(candidate, prompt, bundle, options) {
      this.assertCurrent(candidate);
      trace.push('ask');
      calls.push({ prompt, bundle: structuredClone(bundle), options });
      await hooks.ask?.();
      return structuredClone(env.response);
    },
  };
  return {
    c,
    baseline,
    job,
    env,
    hooks,
    controller,
    trace,
    calls,
    get state() {
      return state;
    },
    get row() {
      return state.cases[0];
    },
    prepare() {
      return prepareAdaptive(controller, job, baseline, c);
    },
    audit(plan = state.cases[0].plan) {
      return requireAdaptiveAudit(state, c, state.cases[0], plan);
    },
  };
}

test('fresh input review and one shallow snapshot prepare an unapproved adaptive business contract', async () => {
  const f = fixture(),
    original = structuredClone(f.c);
  await f.prepare();
  assert.deepEqual(f.c, original);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].prompt, INPUT_REVIEW_PROMPT);
  assert.deepEqual(f.calls[0].options, { phase: 'input_review' });
  assert.deepEqual(Object.keys(f.calls[0].bundle).sort(), [
    'confirmations',
    'data_overrides',
    'effective',
    'original',
  ]);
  assert.equal(f.trace.filter((item) => item === 'snapshot').length, 1);
  assert.ok(f.trace.indexOf('ask') < f.trace.indexOf('snapshot'));
  assert.equal(f.row.status, 'PLAN_REVIEW');
  assert.equal(f.row.reviewed, true);
  assert.equal(f.row.plan_approved, false);
  assert.equal(f.row.approved_hash, undefined);
  assert.deepEqual(f.row.attempts, []);
  assert.deepEqual(f.row.navigation_start, f.env.page);
  const record = f.row.adaptive_preparation;
  assert.deepEqual(Object.keys(record).sort(), [
    'at',
    'case_hash',
    'context_hash',
    'entry',
    'input_review',
    'plan_hash',
  ]);
  assert.equal(record.context_hash, adaptiveContextHash(f.state, f.c));
  assert.equal(record.case_hash, caseHash(f.c));
  assert.equal(record.plan_hash, planHash(f.row.plan));
  assert.deepEqual(record.entry, { path: '/overview?view=assets#/panel?tab=main' });
  assert.equal(f.row.plan.entry_path, record.entry.path);
  assert.deepEqual(record.input_review, { issues: [] });
  assert.ok(Number.isFinite(Date.parse(record.at)));
  assert.deepEqual(f.row.preparation_budget, { case_hash: caseHash(f.c), used: 1, limit: 3 });
  assert.deepEqual(
    f.state.events.map((event) => event.type),
    ['ADAPTIVE_PREPARATION_STARTED', 'INPUT_REVIEW_FINISHED', 'ADAPTIVE_PLAN_PREPARED'],
  );
  assert.doesNotThrow(() => f.audit());
});

test('confirmed effective Case and explicit overrides reach input review without mutable DOM', async () => {
  const f = fixture();
  f.c.data.id = 'D009';
  f.c.steps[0].expected = '设备编号为D009。';
  f.c.steps[0].obligations[0].text = f.c.steps[0].expected;
  f.row.data_overrides = { data: { id: 'D009' } };
  f.row.confirmations = [{ ...f.c.steps[0], note: '操作人确认查D009', source: 'LOCAL_OPERATOR' }];
  await f.prepare();
  const bundle = f.calls[0].bundle;
  assert.equal(bundle.original.data.id, 'D001');
  assert.equal(bundle.effective.data.id, 'D009');
  assert.equal(bundle.effective.steps[0].expected, '设备编号为D009。');
  assert.equal(bundle.confirmations[0].note, '操作人确认查D009');
  assert.doesNotMatch(JSON.stringify(bundle), /irrelevant DOM|当前首页/);
});

test('old approved fixed plan is archived and its approval/audits are never transferred', async () => {
  const f = fixture();
  const old = { schema_version: 'ui-agent-plan/v2', steps: [{ existing: true }] };
  f.row.plan = structuredClone(old);
  f.row.plan_approved = true;
  f.row.approved_hash = 'old-approved';
  f.row.intent_preparation = { old: true };
  f.row.plan_audit = { outcome: 'ACCEPT' };
  f.row.navigation_start = { url: 'http://lab.invalid/stale' };
  f.row.plan_history = [{ at: 'older', plan: { older: true }, approved: false }];
  await f.prepare();
  assert.equal(f.row.plan_history.length, 2);
  assert.deepEqual(f.row.plan_history[1].plan, old);
  assert.equal(f.row.plan_history[1].approved, true);
  assert.equal(f.row.plan_approved, false);
  assert.equal(f.row.approved_hash, undefined);
  assert.equal(f.row.intent_preparation, undefined);
  assert.equal(f.row.plan_audit, undefined);
  assert.notEqual(f.row.plan.schema_version, old.schema_version);
});

test('a newly grounded input issue demotes to NEEDS_REVIEW and never samples or creates a plan', async () => {
  const f = fixture();
  f.env.response = {
    issues: [
      {
        code: 'DATA_PREREQUISITE',
        step_id: 'S1',
        message: '请确认该设备测试数据是否就绪。',
        source_quotes: ['查看D001详情'],
      },
    ],
  };
  f.row.plan = { old: true };
  f.row.plan_approved = true;
  f.row.approved_hash = 'old';
  assert.equal(await f.prepare(), undefined);
  assert.equal(f.row.status, 'NEEDS_REVIEW');
  assert.equal(f.row.reviewed, false);
  assert.equal(f.row.issues.length, 1);
  assert.ok(f.row.issues[0].quote_locations[0].paths.includes('/effective/steps/0/action'));
  assert.equal(f.row.input_review.issues.length, 1);
  assert.equal(f.row.adaptive_preparation, undefined);
  assert.equal(f.row.plan, null);
  assert.equal(f.row.plan_approved, false);
  assert.equal(f.row.approved_hash, undefined);
  assert.ok(!f.trace.includes('snapshot'));
  assert.equal(f.row.preparation_budget.used, 1);
  assert.equal(f.row.plan_history.length, 1);
});

test('malformed or ungrounded model review consumes budget without creating permission', async () => {
  for (const response of [
    { issues: [], approved: true },
    {
      issues: [
        { code: 'AMBIGUOUS', step_id: 'S1', message: '伪造来源', source_quotes: ['never in case'] },
      ],
    },
  ]) {
    const f = fixture();
    f.env.response = response;
    await assert.rejects(f.prepare(), (error) => error.code.startsWith('INPUT_REVIEW_'));
    assert.equal(f.row.preparation_budget.used, 1);
    assert.equal(f.row.plan, null);
    assert.equal(f.row.plan_approved, false);
    assert.ok(!f.trace.includes('snapshot'));
  }
});

test('three cumulative preparations share allowance; no button/channel/context refresh refunds spend', async () => {
  const f = fixture();
  for (let used = 1; used <= 3; used++) {
    f.state.auth_marker = { revision: used };
    await f.prepare();
    assert.equal(f.row.preparation_budget.used, used);
    assert.equal(f.row.plan_approved, false);
  }
  const previous = structuredClone(f.row);
  await assert.rejects(f.prepare(), { code: 'PLAN_REPAIR_LIMIT' });
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.row, previous);
  assert.equal(f.row.plan_history.length, 2);
});

test('existing fixed/intent budget is retained even when its prior hash or limit differs', async () => {
  const f = fixture();
  f.row.preparation_budget = { case_hash: 'previous-hash', used: 2, limit: 999 };
  await f.prepare();
  assert.deepEqual(f.row.preparation_budget, { case_hash: caseHash(f.c), used: 3, limit: 3 });
  await assert.rejects(f.prepare(), { code: 'PLAN_REPAIR_LIMIT' });
  assert.equal(f.calls.length, 1);
});

test('failed input-review transport is not a preparation budget refund', async () => {
  const f = fixture();
  f.hooks.ask = () => {
    throw Object.assign(new Error('injected'), { code: 'MODEL_UNAVAILABLE' });
  };
  await assert.rejects(f.prepare(), { code: 'MODEL_UNAVAILABLE' });
  assert.equal(f.row.preparation_budget.used, 1);
  assert.equal(f.row.plan, null);
  f.hooks.ask = null;
  await f.prepare();
  assert.equal(f.row.preparation_budget.used, 2);
});

for (const [name, change, code] of [
  [
    'no active browser',
    (f) => {
      f.env.active = false;
    },
    'BROWSER_REQUIRED',
  ],
  [
    'not authenticated',
    (f) => {
      f.controller.browser.authenticated = false;
    },
    'AUTH_REQUIRED',
  ],
  [
    'production',
    (f) => {
      f.state.authorization.nonproduction = false;
    },
    'NONPRODUCTION_CONFIRMATION_REQUIRED',
  ],
  [
    'writes enabled',
    (f) => {
      f.state.authorization.writes = true;
    },
    'ADAPTIVE_READ_ONLY_REQUIRED',
  ],
  [
    'writes unspecified',
    (f) => {
      delete f.state.authorization.writes;
    },
    'ADAPTIVE_READ_ONLY_REQUIRED',
  ],
  [
    'not reviewed',
    (f) => {
      f.row.reviewed = false;
    },
    'REVIEW_REQUIRED',
  ],
  [
    'attempt already exists',
    (f) => {
      f.row.attempts.push({ id: 'already-dispatched' });
    },
    'CASE_ALREADY_EXECUTED',
  ],
  [
    'attempt history absent',
    (f) => {
      delete f.row.attempts;
    },
    'CASE_ALREADY_EXECUTED',
  ],
  [
    'stopped job',
    (f) => {
      f.job.abort.abort();
    },
    'STOPPED',
  ],
])
  test(`preflight rejects ${name} before budget/model/snapshot`, async () => {
    const f = fixture();
    change(f);
    await assert.rejects(f.prepare(), { code });
    assert.equal(f.calls.length, 0);
    assert.equal(f.row.preparation_budget, undefined);
    assert.ok(!f.trace.includes('snapshot'));
  });

for (const [name, page, code] of [
  ['login page', { url: 'http://lab.invalid/login', login_page: true }, 'AUTH_REQUIRED'],
  [
    'network issue',
    { url: 'http://lab.invalid/home', network_issues: [{ code: 'NETWORK_BLOCKED' }] },
    'ADAPTIVE_ENTRY_UNOBSERVED',
  ],
  [
    'unknown network state',
    { url: 'http://lab.invalid/home', network_issues: 'unknown' },
    'ADAPTIVE_ENTRY_UNOBSERVED',
  ],
  ['cross origin', { url: 'http://other.invalid/home' }, 'OUTSIDE_TARGET_ORIGIN'],
  ['unobserved relative URL', { url: '/assets' }, 'ADAPTIVE_ENTRY_UNOBSERVED'],
  ['empty URL', { url: '' }, 'ADAPTIVE_ENTRY_UNOBSERVED'],
  ['sensitive query', { url: 'http://lab.invalid/home?token=synthetic' }, 'SENSITIVE_URL'],
  [
    'sensitive fragment',
    { url: 'http://lab.invalid/home#/panel?password=synthetic' },
    'SENSITIVE_URL',
  ],
  ['URL credentials', { url: 'http://demo:synthetic@lab.invalid/home' }, 'INVALID_TARGET_URL'],
])
  test(`shallow observation rejects ${name} without guessing another entry`, async () => {
    const f = fixture();
    f.env.page = page;
    await assert.rejects(f.prepare(), { code });
    assert.equal(f.calls.length, 1);
    assert.equal(f.trace.filter((item) => item === 'snapshot').length, 1);
    assert.equal(f.row.plan, null);
    assert.equal(f.row.adaptive_preparation, undefined);
    assert.equal(f.row.preparation_budget.used, 1);
  });

for (const phase of ['ask', 'snapshot']) {
  for (const [name, mutate, code] of [
    [
      'case text',
      (f) => {
        f.row.confirmations = [{ ...f.c.steps[0], expected: '变更预期' }];
      },
      'MODEL_INPUT_CHANGED',
    ],
    [
      'target',
      (f) => {
        f.state.target = 'http://other.invalid';
      },
      'MODEL_INPUT_CHANGED',
    ],
    [
      'authorization',
      (f) => {
        f.state.authorization.writes = true;
      },
      'MODEL_INPUT_CHANGED',
    ],
    [
      'auth marker',
      (f) => {
        f.state.auth_marker = { changed: true };
      },
      'MODEL_INPUT_CHANGED',
    ],
    [
      'review revoked',
      (f) => {
        f.row.reviewed = false;
      },
      'REVIEW_REQUIRED',
    ],
    [
      'attempt added',
      (f) => {
        f.row.attempts.push({ id: 'raced' });
      },
      'CASE_ALREADY_EXECUTED',
    ],
    [
      'browser closed',
      (f) => {
        f.env.active = false;
      },
      'BROWSER_REQUIRED',
    ],
    [
      'authentication lost',
      (f) => {
        f.controller.browser.authenticated = false;
      },
      'AUTH_REQUIRED',
    ],
    [
      'job stopped',
      (f) => {
        f.job.abort.abort();
      },
      'STOPPED',
    ],
    [
      'competing preparation',
      (f) => {
        f.row.preparation_budget.used++;
      },
      'MODEL_INPUT_CHANGED',
    ],
    [
      'concurrent fixed plan approval',
      (f) => {
        f.row.plan = { fixed: true };
        f.row.plan_approved = true;
      },
      'MODEL_INPUT_CHANGED',
    ],
  ])
    test(`race during ${phase}: ${name} cannot persist a new adaptive audit`, async () => {
      const f = fixture();
      f.hooks[phase] = () => mutate(f);
      await assert.rejects(f.prepare(), { code });
      assert.equal(f.row.adaptive_preparation, undefined);
      assert.ok(!f.state.events.some((event) => event.type === 'ADAPTIVE_PLAN_PREPARED'));
      if (phase === 'ask') assert.ok(!f.trace.includes('snapshot'));
    });
}

test('state is rechecked inside the final store transaction, not just before it', async () => {
  const f = fixture();
  f.hooks.snapshot = () => {
    f.hooks.update = () => {
      f.row.confirmations = [{ ...f.c.steps[0], action: '已改操作' }];
    };
  };
  await assert.rejects(f.prepare(), { code: 'MODEL_INPUT_CHANGED' });
  assert.equal(f.row.adaptive_preparation, undefined);
  assert.equal(f.row.plan, null);
});

test('context hash binds Case, target, authorization and marker but excludes snapshot content', () => {
  const f = fixture(),
    initial = adaptiveContextHash(f.state, f.c);
  f.state.snapshots.push({ text: 'new mutable page', url: 'http://lab.invalid/new' });
  f.row.navigation_start = { text: 'different observation' };
  assert.equal(adaptiveContextHash(f.state, f.c), initial);
  for (const key of ['target', 'authorization', 'auth_marker']) {
    const changed = structuredClone(f.state);
    changed[key] = key === 'target' ? 'http://changed.invalid' : { changed: true };
    assert.notEqual(adaptiveContextHash(changed, f.c), initial);
  }
  const changed = structuredClone(f.c);
  changed.data.id = 'D009';
  assert.notEqual(adaptiveContextHash(f.state, changed), initial);
});

for (const [name, change] of [
  [
    'missing receipt',
    (f) => {
      delete f.row.adaptive_preparation;
    },
  ],
  [
    'context hash',
    (f) => {
      f.row.adaptive_preparation.context_hash = 'forged';
    },
  ],
  [
    'case hash',
    (f) => {
      f.row.adaptive_preparation.case_hash = 'forged';
    },
  ],
  [
    'plan hash',
    (f) => {
      f.row.adaptive_preparation.plan_hash = 'forged';
    },
  ],
  [
    'entry path',
    (f) => {
      f.row.adaptive_preparation.entry.path = '/guessed';
    },
  ],
  [
    'record issues',
    (f) => {
      f.row.adaptive_preparation.input_review.issues.push({ code: 'AMBIGUOUS' });
    },
  ],
  [
    'current issues',
    (f) => {
      f.row.input_review.issues.push({ code: 'AMBIGUOUS' });
    },
  ],
  [
    'missing current review',
    (f) => {
      delete f.row.input_review;
    },
  ],
  [
    'fixed plan with matching forged plan hash',
    (f) => {
      f.row.plan = { schema_version: 'ui-agent-plan/v2', entry_path: f.row.plan.entry_path };
      f.row.adaptive_preparation.plan_hash = planHash(f.row.plan);
    },
  ],
])
  test(`audit refuses ${name}`, async () => {
    const f = fixture();
    await f.prepare();
    change(f);
    assert.throws(() => f.audit(), { code: 'ADAPTIVE_AUDIT_REQUIRED' });
  });

test('audit remains valid across mutable observations without approving or dispatching', async () => {
  const f = fixture();
  await f.prepare();
  f.state.snapshots = [{ text: 'different page content' }];
  const before = structuredClone(f.state);
  assert.doesNotThrow(() => f.audit());
  assert.deepEqual(f.state, before);
});
