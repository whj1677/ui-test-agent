import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAPTIVE_PLAN_VERSION,
  ADAPTIVE_EXECUTION_POLICY,
  ADAPTIVE_STEP_TIMEOUT_MS,
  isAdaptivePlan,
  createAdaptivePlan,
  validateAdaptivePlan,
  validateAdaptiveFragment,
  fragmentAuditPlan,
  ADAPTIVE_NEXT_PROMPT,
  ADAPTIVE_AUDIT_PROMPT,
} from '../src/adaptive-plan.mjs';
import {
  caseHash,
  planHash,
  validatePlan,
  validateAction,
  validateAssertion,
} from '../src/plans.mjs';
import { auditInput, validatePlanAudit, PLAN_AUDIT_PROMPT } from '../src/plan-quality.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { stepActions, stepAssertions } from '../src/plan-steps.mjs';

const base = 'http://127.0.0.1:4888/orders';
const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const code = (expected) => (error) => error.code === expected;
const clone = (value) => structuredClone(value);
const click = (id = 'A1', name = '查询') => ({
  action_id: id,
  op: 'click',
  target: role('button', name),
});
const segment = (actions = [], assertions = [], complete = false) => ({
  actions,
  assertions,
  complete,
  within_ms: 5000,
  reason: '仅处理当前已观察控件。',
});
function fixture() {
  return {
    case_id: 'CASE-ADAPTIVE',
    title: '查询并查看工单',
    data: { keyword: 'WO-101', nested: [45, true, ''], range: '工单中心' },
    test_data: { region: '北区' },
    steps: [
      {
        step_id: 'S1',
        action:
          '输入 WO-101，选择 北区，按 Enter 查询，查看 WO-101 送风机巡检 详情，重置查询，打开 /orders#/home',
        expected: '名称为送风机巡检；状态为待处理',
        obligations: [
          { id: 'O1', text: '名称为送风机巡检' },
          { id: 'O2', text: '状态为待处理' },
        ],
      },
      {
        step_id: 'S2',
        action: '关闭详情，再选择 西区',
        expected: '工单详情已关闭',
        obligations: [{ id: 'O3', text: '工单详情已关闭' }],
      },
    ],
  };
}
function proofs(c = fixture(), stepIndex = 0) {
  return c.steps[stepIndex].obligations.map((obligation) => ({
    target: role('heading', '工单详情'),
    check: 'contains',
    expected: obligation.text,
    oracle_quote: obligation.text,
    obligation_ids: [obligation.id],
  }));
}
function validate(fragment, { c = fixture(), previous = [], step, plan } = {}) {
  plan ??= createAdaptivePlan(c, '/orders');
  return validateAdaptiveFragment(fragment, {
    c,
    plan,
    step: step ?? plan.steps[0],
    previous,
    base,
  });
}

test('contract copies exact original strings, hashes full Case and contains no precompiled checkpoints', () => {
  const c = fixture(),
    before = clone(c),
    plan = createAdaptivePlan(c, '/orders');
  assert.equal(ADAPTIVE_PLAN_VERSION, 'ui-agent-adaptive-plan/v1');
  assert.equal(isAdaptivePlan(plan), true);
  assert.equal(isAdaptivePlan(null), false);
  assert.equal(isAdaptivePlan({ schema_version: 'ui-agent-plan/v3' }), false);
  assert.equal(plan.case_hash, caseHash(c));
  assert.deepEqual(plan.execution_policy, {
    mode: 'adaptive-readonly',
    max_segments_per_step: 8,
    max_replans_per_step: 2,
  });
  assert.equal(Object.isFrozen(ADAPTIVE_EXECUTION_POLICY), true);
  assert.equal(ADAPTIVE_STEP_TIMEOUT_MS, 120000);
  assert.equal(validateAdaptivePlan(plan, c, base), plan);
  assert.equal(validatePlan(plan, c, base), plan); // main plans dispatch, including the import cycle
  assert.deepEqual(c, before);
  for (const [index, step] of plan.steps.entries()) {
    assert.deepEqual(step, {
      step_id: c.steps[index].step_id,
      source_action: c.steps[index].action,
      source_expected: c.steps[index].expected,
      timeout_ms: 120000,
      checkpoints: [],
    });
  }
  plan.execution_policy.max_segments_per_step = 7;
  plan.steps[0].source_action = '改写';
  assert.deepEqual(c, before);
  assert.equal(createAdaptivePlan(c, '/orders').execution_policy.max_segments_per_step, 8);
});

for (const [name, mutate, error] of [
  [
    'extra top field',
    (p) => {
      p.approved = true;
    },
    'INVALID_SCHEMA',
  ],
  [
    'missing notes',
    (p) => {
      delete p.notes;
    },
    'INVALID_SCHEMA',
  ],
  [
    'wrong version',
    (p) => {
      p.schema_version = 'ui-agent-plan/v3';
    },
    'PLAN_BASELINE_MISMATCH',
  ],
  [
    'wrong case id',
    (p) => {
      p.case_id = 'other';
    },
    'PLAN_BASELINE_MISMATCH',
  ],
  [
    'wrong hash',
    (p) => {
      p.case_hash = 'stale';
    },
    'PLAN_BASELINE_MISMATCH',
  ],
  [
    'external entry',
    (p) => {
      p.entry_path = 'https://external.invalid/ops';
    },
    'OUTSIDE_TARGET_ORIGIN',
  ],
  [
    'mutation',
    (p) => {
      p.data_effect = 'mutation';
    },
    'ADAPTIVE_READ_ONLY_REQUIRED',
  ],
  [
    'cleanup',
    (p) => {
      p.cleanup = {};
    },
    'ADAPTIVE_READ_ONLY_REQUIRED',
  ],
  [
    'precondition',
    (p) => {
      p.preconditions.push({});
    },
    'ADAPTIVE_INPUT_PRECOMPILED',
  ],
  [
    'policy extra',
    (p) => {
      p.execution_policy.approved = true;
    },
    'INVALID_SCHEMA',
  ],
  [
    'policy mode',
    (p) => {
      p.execution_policy.mode = 'guarded-react';
    },
    'ADAPTIVE_POLICY_INVALID',
  ],
  [
    'segment budget',
    (p) => {
      p.execution_policy.max_segments_per_step = 12;
    },
    'ADAPTIVE_POLICY_INVALID',
  ],
  [
    'replan budget',
    (p) => {
      p.execution_policy.max_replans_per_step = 3;
    },
    'ADAPTIVE_POLICY_INVALID',
  ],
  [
    'missing step',
    (p) => {
      p.steps.pop();
    },
    'PLAN_STEP_COUNT_MISMATCH',
  ],
  [
    'reordered steps',
    (p) => {
      p.steps.reverse();
    },
    'PLAN_ORIGINAL_STEP_CHANGED',
  ],
  [
    'changed source',
    (p) => {
      p.steps[0].source_expected += '。';
    },
    'PLAN_ORIGINAL_STEP_CHANGED',
  ],
  [
    'step extra',
    (p) => {
      p.steps[0].actions = [];
    },
    'INVALID_SCHEMA',
  ],
  [
    'precompiled step',
    (p) => {
      p.steps[0].checkpoints.push({});
    },
    'ADAPTIVE_INPUT_PRECOMPILED',
  ],
  [
    'illegal timeout',
    (p) => {
      p.steps[0].timeout_ms = 180000;
    },
    'STEP_DEADLINE_INVALID',
  ],
  [
    'string timeout',
    (p) => {
      p.steps[0].timeout_ms = '120000';
    },
    'STEP_DEADLINE_INVALID',
  ],
])
  test(`strict adaptive contract rejects ${name}`, () => {
    const c = fixture(),
      plan = createAdaptivePlan(c, '/orders');
    mutate(plan);
    assert.throws(() => validateAdaptivePlan(plan, c, base), code(error));
  });

test('Case hash includes data and changes are never silently rebased', () => {
  const c = fixture(),
    plan = createAdaptivePlan(c, '/orders'),
    hash = planHash(plan);
  c.test_data.region = '东区';
  assert.throws(() => validateAdaptivePlan(plan, c, base), code('PLAN_BASELINE_MISMATCH'));
  assert.notEqual(planHash(createAdaptivePlan(c, '/orders')), hash);
  const malformed = fixture();
  malformed.steps[1].step_id = 'S1';
  assert.throws(() => createAdaptivePlan(malformed, '/orders'), code('ADAPTIVE_INPUT_INVALID'));
  malformed.steps[1].step_id = 'S2';
  malformed.steps[0].obligations.pop();
  assert.throws(
    () => createAdaptivePlan(malformed, '/orders'),
    code('OBLIGATION_SOURCE_COVERAGE_INCOMPLETE'),
  );
});

test('action-only, assertion-only and copied fragment return; no inputs are mutated', () => {
  const c = fixture(),
    first = segment([click()]),
    before = clone(first);
  const result = validate(first, { c });
  assert.deepEqual(result, first);
  assert.notEqual(result, first);
  result.actions[0].target.name = 'changed';
  assert.deepEqual(first, before);
  assert.deepEqual(validate(segment([], [proofs(c)[0]]), { c, previous: [first] }).actions, []);
});

for (const [name, mutate, error] of [
  [
    'extra field',
    (f) => {
      f.code = 'evaluate()';
    },
    'INVALID_SCHEMA',
  ],
  [
    'missing reason',
    (f) => {
      delete f.reason;
    },
    'INVALID_SCHEMA',
  ],
  [
    'blank reason',
    (f) => {
      f.reason = ' ';
    },
    'ADAPTIVE_FRAGMENT_INVALID',
  ],
  [
    'nonboolean complete',
    (f) => {
      f.complete = 1;
    },
    'ADAPTIVE_FRAGMENT_INVALID',
  ],
  [
    'two actions',
    (f) => {
      f.actions.push(click('A2'));
    },
    'ADAPTIVE_ACTION_COUNT_INVALID',
  ],
  [
    '21 assertions',
    (f) => {
      f.assertions = Array(21).fill(proofs()[0]);
    },
    'ASSERTION_COUNT_INVALID',
  ],
  [
    'below time bound',
    (f) => {
      f.within_ms = 99;
    },
    'ASSERTION_DEADLINE_INVALID',
  ],
  [
    'above time bound',
    (f) => {
      f.within_ms = 30001;
    },
    'ASSERTION_DEADLINE_INVALID',
  ],
  [
    'fractional time',
    (f) => {
      f.within_ms = 100.5;
    },
    'ASSERTION_DEADLINE_INVALID',
  ],
  [
    'arbitrary operation',
    (f) => {
      f.actions[0].op = 'evaluate';
    },
    'ACTION_NOT_ALLOWED',
  ],
  [
    'repair_anchor',
    (f) => {
      f.actions[0].repair_anchor = role('button', '查询');
    },
    'ADAPTIVE_TARGET_CURRENT_DOM_REQUIRED',
  ],
  [
    'future case_named',
    (f) => {
      f.actions[0].target = { kind: 'case_named' };
    },
    'ADAPTIVE_TARGET_CURRENT_DOM_REQUIRED',
  ],
  [
    'future runtime_intent',
    (f) => {
      f.actions[0].target = { kind: 'runtime_intent' };
    },
    'ADAPTIVE_TARGET_CURRENT_DOM_REQUIRED',
  ],
])
  test(`fragment rejects ${name}`, () => {
    const fragment = segment([click()]);
    mutate(fragment);
    assert.throws(() => validate(fragment), code(error));
  });

test('empty completion requires earlier assertions and complete coverage, never just prior action', () => {
  assert.throws(() => validate(segment()), code('ADAPTIVE_FRAGMENT_EMPTY'));
  assert.throws(() => validate(segment([], [], true)), code('ADAPTIVE_FRAGMENT_EMPTY'));
  assert.throws(
    () => validate(segment([], [], true), { previous: [segment([click()])] }),
    code('ADAPTIVE_FRAGMENT_EMPTY'),
  );
  assert.throws(
    () => validate(segment([], [], true), { previous: [segment([], [proofs()[0]])] }),
    code('ORACLE_COVERAGE_INCOMPLETE'),
  );
  assert.equal(
    validate(segment([], [], true), { previous: [segment([click()], proofs())] }).complete,
    true,
  );
  assert.throws(
    () => validate(segment([], [], true), { previous: [segment([], proofs(), true)] }),
    code('ADAPTIVE_FRAGMENT_AFTER_COMPLETE'),
  );
});

test('current original step is authoritative; previous fragments and IDs are revalidated', () => {
  const c = fixture(),
    p = segment([click()]);
  assert.throws(() => validate(p, { previous: [p] }), code('ACTION_ID_INVALID'));
  assert.throws(() => validate(p, { previous: {} }), code('ADAPTIVE_FRAGMENT_HISTORY_INVALID'));
  assert.throws(
    () => validate(p, { step: { step_id: 'unknown' } }),
    code('PLAN_ORIGINAL_STEP_CHANGED'),
  );
  assert.throws(
    () => validate(p, { step: { ...c.steps[0], expected: 'new oracle' } }),
    code('PLAN_ORIGINAL_STEP_CHANGED'),
  );
  assert.equal(validate(p, { step: c.steps[0] }).actions[0].action_id, 'A1');
  const old = segment([click('old')]);
  old.actions[0].op = 'fetch';
  assert.throws(() => validate(p, { previous: [old] }), code('ACTION_NOT_ALLOWED'));
});

test('only current action substrings and data scalar VALUES authorize input; expected and other steps do not', () => {
  const target = { kind: 'label', value: '工单关键字', exact: true };
  for (const value of ['WO-101', '北区', '45', 'true', '']) {
    assert.equal(
      validate(segment([{ action_id: 'fill1', op: 'fill', target, value }])).actions[0].value,
      value,
    );
  }
  for (const value of ['待处理', '西区', 'keyword', 'region', 'page answer']) {
    assert.throws(
      () => validate(segment([{ action_id: 'fill1', op: 'fill', target, value }])),
      code('ADAPTIVE_VALUE_SOURCE_REQUIRED'),
    );
  }
  const c = fixture();
  delete c.data;
  assert.throws(
    () => validate(segment([{ action_id: 'fill1', op: 'fill', target, value: '' }]), { c }),
    code('ADAPTIVE_VALUE_SOURCE_REQUIRED'),
  );
  assert.equal(
    validate(segment([{ action_id: 'select1', op: 'select', target, value: '北区' }])).actions
      .length,
    1,
  );
  assert.equal(
    validate(segment([{ action_id: 'press1', op: 'press', target, value: 'Enter' }])).actions
      .length,
    1,
  );
  assert.throws(
    () => validate(segment([{ action_id: 'press1', op: 'press', target, value: 'Tab' }])),
    code('ADAPTIVE_VALUE_SOURCE_REQUIRED'),
  );
  assert.throws(
    () => validate(segment([{ action_id: 'press1', op: 'press', target, value: 'Control+A' }])),
    code('KEY_NOT_ALLOWED'),
  );
});

test('navigation needs same origin and whole explicit action path, not data or a path prefix', () => {
  const navigate = (value) => segment([{ action_id: 'nav', op: 'navigate', value }]);
  assert.equal(validate(navigate('/orders#/home')).actions.length, 1);
  for (const value of ['/orders#/home/extra', '/orders', '/ops', '/orders#/home?write=1'])
    assert.throws(() => validate(navigate(value)), code('ADAPTIVE_VALUE_SOURCE_REQUIRED'));
  assert.throws(() => validate(navigate('/orders?token=hidden')), code('SENSITIVE_URL'));
  assert.throws(
    () => validate(navigate('https://external.invalid/ops')),
    code('OUTSIDE_TARGET_ORIGIN'),
  );
  const c = fixture();
  c.data.path = '/only-data';
  assert.throws(
    () => validate(navigate('/only-data'), { c }),
    code('ADAPTIVE_VALUE_SOURCE_REQUIRED'),
  );
  c.steps[0].action = '打开 "/工单?状态=待处理"';
  assert.equal(validate(navigate('/工单?状态=待处理'), { c }).actions.length, 1);
});

for (const name of [
  '保存',
  '提交',
  '删除',
  '新建',
  '创建',
  '重置数据',
  '清空数据',
  '上传',
  '退出登录',
  'Delete',
  'Save',
])
  test(`read-only known-write guard rejects ${name} even if literal in source`, () => {
    const c = fixture();
    c.steps[0].action = `点击${name}`;
    assert.throws(
      () => validate(segment([click('a', name)]), { c }),
      code('ADAPTIVE_ACTION_WRITE_FORBIDDEN'),
    );
  });

test('query reset is source-bound and sensitive controls are forbidden for both actions and assertions', () => {
  assert.equal(validate(segment([click('a', '重置查询')])).actions.length, 1);
  assert.equal(validate(segment([click('a', '重置')])).actions.length, 1);
  const c = fixture();
  c.steps[0].action = '点击重置';
  assert.throws(
    () => validate(segment([click('a', '重置')]), { c }),
    code('ADAPTIVE_ACTION_WRITE_FORBIDDEN'),
  );
  for (const name of ['密码', 'password', 'API key', 'cookie', '验证码', 'token']) {
    assert.throws(() => validate(segment([click('a', name)])), code('SENSITIVE_CONTROL_FORBIDDEN'));
    const assertion = proofs()[0];
    assertion.target = role('textbox', name);
    assert.throws(() => validate(segment([], [assertion])), code('SENSITIVE_CONTROL_FORBIDDEN'));
  }
});

test('read-only technical tools remain in fixed protocol and retain optional-dialog source conditions', () => {
  for (const op of ['check', 'uncheck', 'hover', 'wait']) {
    const action = {
      action_id: 'a',
      op,
      target: role('checkbox', '北区'),
      ...(op === 'wait' ? { state: 'visible' } : {}),
    };
    assert.equal(validate(segment([action])).actions[0].op, op);
  }
  assert.equal(validate(segment([{ action_id: 'a', op: 'reload' }])).actions[0].op, 'reload');
  const c = fixture();
  c.steps[0].action = '如果出现“服务说明”则点击“关闭”，否则继续查询';
  const action = {
    action_id: 'dismiss',
    op: 'dismiss_optional',
    target: role('dialog', '服务说明'),
    value: '关闭',
  };
  assert.equal(validate(segment([action]), { c }).actions.length, 1);
  assert.throws(
    () =>
      validate(segment([{ ...action, action_id: 'again' }]), { c, previous: [segment([action])] }),
    code('OPTIONAL_DIALOG_SCHEMA'),
  );
  c.steps[0].action = '点击服务说明的关闭';
  assert.throws(() => validate(segment([action]), { c }), code('OPTIONAL_DIALOG_SOURCE_REQUIRED'));
});

test('row/cell identity must come from Case scalars/actions/expected, never current DOM or metadata keys', () => {
  const c = fixture(),
    table = role('table', '工单');
  const target = (value) => ({
    kind: 'row',
    table,
    key: { column: '编号', value },
    target: role('button', '查看详情'),
  });
  const scoped = (value, op = 'click') =>
    segment([
      { action_id: 'a', op, target: target(value), ...(op === 'wait' ? { state: 'visible' } : {}) },
    ]);
  assert.equal(validate(scoped('WO-101'), { c }).actions.length, 1);
  for (const value of ['WO-102', 'WO-10', 'keyword']) {
    for (const op of ['click', 'wait', 'hover'])
      assert.throws(
        () => validate(scoped(value, op), { c }),
        code('PLAN_ROW_IDENTITY_UNSUPPORTED'),
      );
    const assertion = proofs(c)[0];
    assertion.target = { kind: 'cell', table, key: { column: '编号', value }, column: '名称' };
    assert.throws(
      () => validate(segment([], [assertion]), { c }),
      code('PLAN_ROW_IDENTITY_UNSUPPORTED'),
    );
  }
  c.steps[1].expected = 'D001至D005均可见';
  c.steps[1].obligations = [{ id: 'O3', text: c.steps[1].expected }];
  assert.equal(validate(scoped('D003'), { c }).actions.length, 1);
  assert.throws(() => validate(scoped('D006'), { c }), code('PLAN_ROW_IDENTITY_UNSUPPORTED'));
});

test('business within scope is source-bound; dialog names are left to current-DOM independent audit', () => {
  const c = fixture();
  const scoped = (scope) =>
    segment([
      {
        action_id: 'a',
        op: 'hover',
        target: {
          kind: 'within',
          scope: { ...scope, exact: true },
          target: role('button', '查看详情'),
        },
      },
    ]);
  for (const scope of [
    { role: 'article', name: 'WO-101 送风机巡检' },
    { role: 'listitem', heading: '送风机巡检' },
    { role: 'dialog', name: '现场工单详情' },
  ])
    assert.equal(validate(scoped(scope), { c }).actions.length, 1);
  for (const scope of [
    { role: 'article', name: 'WO-102 送风机巡检' },
    { role: 'listitem', heading: '现场新标题' },
  ])
    assert.throws(() => validate(scoped(scope), { c }), code('PLAN_SCOPE_IDENTITY_UNSUPPORTED'));
  const assertion = proofs()[0];
  assertion.target = { kind: 'within', scope: { role: 'article', name: 'WO-102', exact: true } };
  assert.throws(() => validate(segment([], [assertion])), code('PLAN_SCOPE_IDENTITY_UNSUPPORTED'));
});

test('every assertion requires current-step quote and obligation IDs, including in prior fragments', () => {
  const assertion = proofs()[0];
  for (const [mutate, error] of [
    [
      (a) => {
        a.oracle_quote = '页面实际值';
      },
      'ASSERTION_ORACLE_QUOTE_REQUIRED',
    ],
    [
      (a) => {
        a.obligation_ids = ['O3'];
      },
      'ASSERTION_OBLIGATION_UNKNOWN',
    ],
    [
      (a) => {
        a.obligation_ids = [];
      },
      'ASSERTION_OBLIGATIONS_REQUIRED',
    ],
    [
      (a) => {
        a.target = { kind: 'runtime_intent' };
      },
      'ADAPTIVE_TARGET_CURRENT_DOM_REQUIRED',
    ],
  ]) {
    const bad = clone(assertion);
    mutate(bad);
    assert.throws(() => validate(segment([], [bad])), code(error));
    assert.throws(
      () => validate(segment([click()]), { previous: [segment([], [bad])] }),
      code(error),
    );
  }
});

test('matrix assertions are grounded in original data and count as one assertion, not cell count', () => {
  const c = fixture();
  c.steps = [
    {
      step_id: 'S1',
      action: '查询工单',
      expected: '表格所有行和字段符合测试数据',
      obligations: [{ id: 'O1', text: '表格所有行和字段符合测试数据' }],
    },
  ];
  const rows = Array.from({ length: 5 }, (_, row) => ({
    key: `R-${row + 1}`,
    cells: Array.from({ length: 5 }, (_, col) => ({
      column: `字段${col + 1}`,
      check: 'number',
      expected: row * 10 + col,
    })),
  }));
  c.test_data = rows;
  const matrix = {
    target: role('table', '工单'),
    check: 'table_cells',
    expected: { key_column: '编号', rows, ordered: false, exact_rows: true },
    oracle_quote: c.steps[0].expected,
    obligation_ids: ['O1'],
  };
  const fragment = segment([], [matrix], true);
  assert.equal(validate(fragment, { c }).assertions.length, 1);
  const copy = clone(fragment);
  copy.assertions[0].expected.rows[0].cells[0].expected = 98765;
  assert.throws(() => validate(copy, { c }), code('TABLE_SOURCE_UNGROUNDED'));
});

test('cumulative 20-assertion and 8-segment budgets cannot be reset by a new reply', () => {
  const previous = Array.from({ length: 7 }, (_, i) => segment([click(`a${i}`)], proofs()));
  const last = segment(
    [click('last')],
    Array.from({ length: 6 }, (_, i) => proofs()[i % 2]),
    true,
  );
  assert.equal(validate(last, { previous }).complete, true);
  last.assertions.push(proofs()[0]);
  assert.throws(() => validate(last, { previous }), code('ASSERTION_COUNT_INVALID'));
  assert.throws(
    () => validate(segment([], [], true), { previous: [...previous, segment([], proofs())] }),
    code('ADAPTIVE_SEGMENT_LIMIT'),
  );
});

test('projection groups consecutive actions only into the NEXT assertion checkpoint, preserves order and source', () => {
  const c = fixture(),
    original = clone(c);
  const previous = [
    segment([click('a1')]),
    segment([click('a2')], [proofs(c)[0]]),
    segment([click('a3')]),
  ];
  const last = segment([], [proofs(c)[1]], true);
  const bundle = fragmentAuditPlan(c, c.steps[0], previous, last, base);
  assert.equal(bundle.plan.schema_version, 'ui-agent-plan/v3');
  assert.equal(bundle.plan.execution_policy, undefined);
  assert.equal(bundle.c.steps.length, 1);
  assert.deepEqual(bundle.c.steps[0], c.steps[0]);
  assert.equal(bundle.plan.case_hash, caseHash(bundle.c));
  assert.notEqual(bundle.plan.case_hash, caseHash(c));
  assert.equal(bundle.plan.steps[0].timeout_ms, 120000);
  assert.deepEqual(
    bundle.plan.steps[0].checkpoints.map((point) => point.actions.map((a) => a.action_id)),
    [['a1', 'a2'], ['a3']],
  );
  assert.deepEqual(stepAssertions(bundle.plan.steps[0]), proofs(c));
  assert.equal(validatePlan(bundle.plan, bundle.c, base), bundle.plan);
  assert.deepEqual(c, original);
  bundle.c.data.keyword = 'changed';
  bundle.plan.steps[0].checkpoints[0].actions[0].target.name = 'changed';
  assert.deepEqual(c, original);
  assert.equal(previous[0].actions[0].target.name, '查询');
});

test('pending tail actions remain available for partial audit but can never disappear at complete', () => {
  const c = fixture(),
    previous = [segment([click('first')], proofs(c))];
  const tail = segment([click('tail')]);
  const bundle = fragmentAuditPlan(c, c.steps[0], previous, tail, base);
  assert.equal(bundle.plan.steps[0].checkpoints.length, 2);
  assert.deepEqual(bundle.plan.steps[0].checkpoints[1].assertions, []);
  assert.deepEqual(
    stepActions(bundle.plan.steps[0]).map((a) => a.action_id),
    ['first', 'tail'],
  );
  assert.throws(() => validatePlan(bundle.plan, bundle.c, base), code('ASSERTION_COUNT_INVALID'));
  assert.throws(
    () => validate({ ...tail, complete: true }, { c, previous }),
    code('ADAPTIVE_ACTION_UNCHECKED'),
  );
  assert.throws(
    () => validate(segment([], [], true), { c, previous: [...previous, tail] }),
    code('ADAPTIVE_ACTION_UNCHECKED'),
  );
  assert.equal(
    validate(segment([], proofs(c), true), { c, previous: [...previous, tail] }).complete,
    true,
  );
});

test('only-final-complete adds no checkpoint and v3 completion still enforces required click', () => {
  const c = fixture(),
    previous = [segment([], proofs(c))],
    last = segment([], [], true);
  const bundle = fragmentAuditPlan(c, c.steps[0], previous, last, base);
  assert.equal(bundle.plan.steps[0].checkpoints.length, 1);
  c.steps[0].requires_click = true;
  assert.throws(() => validate(last, { c, previous }), code('REQUIRED_CLICK_MISSING'));
  assert.equal(validate(last, { c, previous: [segment([click()], proofs(c))] }).complete, true);
});

test('partial audit injection retains missing obligations; other audit issues still reject and complete needs coverage', () => {
  const c = fixture(),
    fragment = segment([click()], [proofs(c)[0]]);
  const partial = fragmentAuditPlan(c, c.steps[0], [], fragment, base);
  const input = auditInput(partial.c, partial.plan, { complete: false, current: { controls: [] } });
  assert.equal(input.original.steps.length, 1);
  assert.equal(input.assertion_index[0].entries.length, 1);
  const reply = {
    checks: [
      {
        step_id: 'S1',
        obligation_id: 'O1',
        status: 'COVERED',
        assertion_indices: [0],
        reason: '原名称断言。',
      },
      {
        step_id: 'S1',
        obligation_id: 'O2',
        status: 'MISSING',
        assertion_indices: [],
        reason: '未来状态断言尚未提出。',
      },
    ],
    issues: [{ code: 'ASSERTION_GAP', step_id: 'S1', reason: '仅当前短段，状态待检查。' }],
  };
  const checked = validatePlanAudit(reply, partial.c, partial.plan);
  assert.equal(checked.outcome, 'REPAIR');
  assert.equal(
    checked.issues.every((issue) => issue.code === 'ASSERTION_GAP'),
    true,
  );
  reply.issues.push({
    code: 'ACTION_MISMATCH',
    step_id: 'S1',
    reason: '查询目标对象不符合原Case。',
  });
  assert.equal(
    validatePlanAudit(reply, partial.c, partial.plan).issues.some(
      (issue) => issue.code !== 'ASSERTION_GAP',
    ),
    true,
  );
  const full = fragmentAuditPlan(
    c,
    c.steps[0],
    [fragment],
    segment([], [proofs(c)[1]], true),
    base,
  );
  reply.issues = [];
  reply.checks[1] = {
    ...reply.checks[1],
    status: 'COVERED',
    assertion_indices: [1],
    reason: '累计状态断言完整。',
  };
  assert.equal(validatePlanAudit(reply, full.c, full.plan).outcome, 'ACCEPT');
});

test('partial validator does not require future URL evidence; complete caller semantics still rejects false coverage', () => {
  const c = fixture();
  c.steps[0].expected = '当前页面URL为 /orders';
  c.steps[0].obligations = [{ id: 'O1', text: c.steps[0].expected }];
  const first = segment([click()]);
  assert.equal(validate(first, { c }).actions.length, 1);
  const fake = proofs(c)[0];
  const completed = fragmentAuditPlan(c, c.steps[0], [first], segment([], [fake], true), base);
  assert.throws(
    () => requirePlanSemantics(completed.plan, completed.c, { pages: [] }),
    code('PLAN_URL_UNPROVEN'),
  );
});

test('prompts define current-only segments and an appended audit override, not a technical approval or replay', () => {
  const prompt = PLAN_AUDIT_PROMPT + '\n' + ADAPTIVE_AUDIT_PROMPT;
  assert.ok(
    prompt.indexOf('ADAPTIVE CURRENT-SEGMENT OVERRIDE') > prompt.indexOf('Independently review'),
  );
  assert.match(ADAPTIVE_AUDIT_PROMPT, /ASSERTION_GAP is the ONLY issue/);
  assert.match(ADAPTIVE_AUDIT_PROMPT, /complete:true/);
  assert.match(ADAPTIVE_AUDIT_PROMPT, /ACTION_MISMATCH/);
  assert.match(ADAPTIVE_AUDIT_PROMPT, /not a separate user approval/);
  assert.match(ADAPTIVE_NEXT_PROMPT, /at most ONE action/);
  assert.match(ADAPTIVE_NEXT_PROMPT, /Never replay a dispatched action/);
  assert.match(ADAPTIVE_NEXT_PROMPT, /120000ms/);
  assert.match(ADAPTIVE_NEXT_PROMPT, /localStorage/);
});

test('all complete JSON prompt examples parse and satisfy the existing action/assertion schema', () => {
  const examples = ADAPTIVE_NEXT_PROMPT.split('\n')
    .filter((line) => line.startsWith('{"'))
    .map((line) => JSON.parse(line));
  const actions = examples.filter((value) => value.action_id);
  const assertions = examples.filter((value) => value.check);
  assert.equal(actions.length, 5);
  assert.equal(assertions.length, 3);
  const ids = new Set();
  for (const action of actions) validateAction(action, base, ids);
  for (const assertion of assertions) {
    validateAssertion(
      assertion,
      {
        expected: assertion.oracle_quote,
        obligations: assertion.obligation_ids.map((id) => ({ id, text: assertion.oracle_quote })),
      },
      { data: assertion.check === 'table_cells' ? assertion.expected.rows : {} },
    );
  }
  assert.match(ADAPTIVE_NEXT_PROMPT, /same-named main\/article\/dialog\/container is NOT a button/);
});
