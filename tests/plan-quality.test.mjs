import test from 'node:test';
import assert from 'node:assert/strict';
import { caseHash, planHash } from '../src/plans.mjs';
import { INPUT_REVIEW_PROMPT, validateInputReview } from '../src/input-review.mjs';
import {
  PLAN_AUDIT_PROMPT,
  auditInput,
  validatePlanAudit,
  repairablePlanError,
} from '../src/plan-quality.mjs';

function fixture() {
  const c = {
    case_id: 'CASE-1',
    title: 'read-only record details',
    steps: [
      {
        step_id: 'S1',
        action: 'Open record A details',
        expected: 'Name is Alpha; status is Active',
        obligations: [
          { id: 'O1', text: 'Name is Alpha' },
          { id: 'O2', text: 'status is Active' },
        ],
      },
      {
        step_id: 'S2',
        action: 'Close details',
        expected: 'Dialog is hidden',
        obligations: [{ id: 'O3', text: 'Dialog is hidden' }],
      },
    ],
  };
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: '/records',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: c.steps.map((s) => ({
      step_id: s.step_id,
      source_action: s.action,
      source_expected: s.expected,
      actions: [],
      assertion_mode: 'simultaneous',
      within_ms: 8000,
      assertions: s.obligations.map((o) => ({
        target: { kind: 'testid', value: 'details' },
        check: 'contains',
        expected: o.text,
        oracle_quote: o.text,
        obligation_ids: [o.id],
      })),
    })),
  };
  const reply = {
    checks: c.steps.flatMap((s) =>
      s.obligations.map((o, i) => ({
        step_id: s.step_id,
        obligation_id: o.id,
        status: 'COVERED',
        assertion_indices: [i],
        reason: 'Explicit value assertion covers this original obligation.',
      })),
    ),
    issues: [],
  };
  return { c, plan, reply };
}
const code = (expected) => (e) => e.code === expected;

test('complete audit is accepted only as a model finding, not execution approval', () => {
  const { c, plan, reply } = fixture(),
    result = validatePlanAudit(reply, c, plan);
  assert.equal(result.outcome, 'ACCEPT');
  assert.deepEqual(Object.keys(result).sort(), ['checks', 'issues', 'outcome']);
  result.checks[0].reason = 'changed';
  assert.notEqual(reply.checks[0].reason, 'changed');
  assert.match(
    PLAN_AUDIT_PROMPT,
    /does not prove semantic completeness, runtime success or authorize execution/,
  );
});

test('an unreviewed extra assertion cannot hide behind copied obligation ids', () => {
  const { c, plan, reply } = fixture();
  plan.steps[0].assertions.push(structuredClone(plan.steps[0].assertions[0]));
  const result = validatePlanAudit(reply, c, plan);
  assert.equal(result.outcome, 'REPAIR');
  assert.ok(result.issues.some((i) => i.code === 'ACTION_MISMATCH'));
  assert.deepEqual(reply.issues, []);
});

test('audit input keeps originals and candidate hashes authoritative and clones evidence', () => {
  const { c, plan } = fixture(),
    context = {
      original: { case_id: 'different' },
      case_hash: 'wrong',
      plan_hash: 'wrong',
      candidate_plan: { bad: true },
      pages: [{ text: 'captured state' }],
      technical_context: {
        source_control_candidates: [{ locator: { kind: 'testid', value: 'details' } }],
      },
    };
  const input = auditInput(c, plan, context);
  assert.deepEqual(input.original, c);
  assert.deepEqual(input.candidate_plan, plan);
  assert.equal(input.case_hash, caseHash(c));
  assert.equal(input.plan_hash, planHash(plan));
  assert.equal(input.audit_indexing.final_approval, false);
  input.pages[0].text = 'changed';
  assert.equal(context.pages[0].text, 'captured state');
  assert.match(PLAN_AUDIT_PROMPT, /source is NOT observed success/);
  assert.match(PLAN_AUDIT_PROMPT, /never create, merge, delete or rewrite obligations/);
});

test('missing semantic coverage becomes a bounded repair finding', () => {
  const { c, plan, reply } = fixture();
  reply.checks[1] = {
    ...reply.checks[1],
    status: 'MISSING',
    assertion_indices: [],
    reason: 'Status value is not measured.',
  };
  reply.issues = [
    {
      code: 'ASSERTION_GAP',
      step_id: 'S1',
      reason:
        'Measure the explicit status value using a supported observed/source-confirmed target.',
    },
  ];
  assert.equal(validatePlanAudit(reply, c, plan).outcome, 'REPAIR');
});

test('technical audit uncertainty requires repair and preserves original findings and case', () => {
  const { c, plan, reply } = fixture(),
    before = structuredClone(c);
  reply.checks[0] = {
    ...reply.checks[0],
    status: 'UNCLEAR',
    assertion_indices: [],
    reason: 'The intended record population is undecided.',
  };
  reply.issues = [
    { code: 'ORACLE_UNCLEAR', step_id: 'S1', reason: 'Clarify the intended population.' },
    {
      code: 'LOCATOR_UNSUPPORTED',
      step_id: 'S2',
      reason: 'Closing control lacks technical evidence.',
    },
  ];
  const result = validatePlanAudit(reply, c, plan);
  assert.equal(result.outcome, 'REPAIR');
  assert.deepEqual(result.issues.slice(0, reply.issues.length), reply.issues);
  assert.equal(result.checks[0].status, 'UNCLEAR');
  assert.ok(
    result.issues.some((i) => i.code === 'PLAN_REVIEW_UNRESOLVED' && /input-review/.test(i.reason)),
  );
  assert.deepEqual(c, before);
});

test('action-level audit ambiguity also routes to repair when assertion checks are covered', () => {
  const { c, plan, reply } = fixture();
  reply.issues = [
    {
      code: 'ORACLE_UNCLEAR',
      step_id: 'S1',
      reason: 'Original action identifies two different target records.',
    },
  ];
  assert.equal(validatePlanAudit(reply, c, plan).outcome, 'REPAIR');
});

test('unclear findings are never dropped by technical/business keyword heuristics', () => {
  for (const reason of ['缺少定位器', '范围尚未决定', '所有数据', '未知问题。']) {
    const { c, plan, reply } = fixture();
    reply.issues.push({ code: 'ORACLE_UNCLEAR', step_id: 'S1', reason });
    const result = validatePlanAudit(reply, c, plan);
    assert.equal(result.outcome, 'REPAIR');
    assert.deepEqual(result.issues[0], reply.issues[0]);
    assert.equal(result.issues[1].code, 'PLAN_REVIEW_UNRESOLVED');
  }
});

test('independent source-grounded input review still retains genuine clarification issues', () => {
  // Plan audit cannot decide the case state. The controller's separate input
  // review path remains responsible for asking the operator about business input.
  const { c } = fixture();
  const issue = {
    code: 'AMBIGUOUS',
    step_id: 'S1',
    message: '请确认 Alpha 的身份范围。',
    source_quotes: ['Name is Alpha'],
  };
  const review = validateInputReview({ issues: [issue] }, c);
  assert.equal(review.issues[0].message, issue.message);
  assert.deepEqual(review.issues[0].quote_locations[0].paths, ['/effective/steps/0/expected']);
  assert.throws(
    () => validateInputReview({ issues: [{ ...issue, source_quotes: ['不存在的原文'] }] }, c),
    code('INPUT_REVIEW_QUOTE_UNGROUNDED'),
  );
  assert.match(INPUT_REVIEW_PROMPT, /before any plan repair/);
  assert.match(
    PLAN_AUDIT_PROMPT,
    /only that source-grounded input review may request user clarification/,
  );
});

for (const [label, mutate, error] of [
  ['missing obligation', (r) => r.checks.pop(), 'PLAN_AUDIT_COUNT_INVALID'],
  [
    'fabricated obligation',
    (r) => (r.checks[0].obligation_id = 'invented'),
    'PLAN_AUDIT_REFERENCE_INVALID',
  ],
  ['fabricated step', (r) => (r.checks[0].step_id = 'UNKNOWN'), 'PLAN_AUDIT_REFERENCE_INVALID'],
  [
    'duplicate obligation instead of another',
    (r) => (r.checks[1] = structuredClone(r.checks[0])),
    'PLAN_AUDIT_DUPLICATE_CHECK',
  ],
  [
    'negative index',
    (r) => (r.checks[0].assertion_indices = [-1]),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  [
    'fractional index',
    (r) => (r.checks[0].assertion_indices = [0.5]),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  [
    'string index',
    (r) => (r.checks[0].assertion_indices = ['0']),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  [
    'outside index',
    (r) => (r.checks[0].assertion_indices = [2]),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  [
    'index belongs to another obligation',
    (r) => (r.checks[0].assertion_indices = [1]),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  [
    'covered with no index',
    (r) => (r.checks[0].assertion_indices = []),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  [
    'duplicate assertion index',
    (r) => (r.checks[0].assertion_indices = [0, 0]),
    'PLAN_AUDIT_ASSERTION_REFERENCE_INVALID',
  ],
  ['unknown top-level field', (r) => (r.approved = true), 'PLAN_AUDIT_SCHEMA_INVALID'],
  [
    'unknown check field',
    (r) => (r.checks[0].replacement_expected = 'new expected'),
    'PLAN_AUDIT_SCHEMA_INVALID',
  ],
  [
    'unknown issue field',
    (r) =>
      (r.issues = [
        { code: 'ACTION_MISMATCH', step_id: 'S1', reason: 'Mismatch', replacement_action: 'save' },
      ]),
    'PLAN_AUDIT_SCHEMA_INVALID',
  ],
  [
    'unknown finding code',
    (r) => (r.issues = [{ code: 'AUTO_APPROVE', step_id: 'S1', reason: 'Approve' }]),
    'PLAN_AUDIT_ISSUE_INVALID',
  ],
  [
    'issue references another case step',
    (r) => (r.issues = [{ code: 'ACTION_MISMATCH', step_id: 'S9', reason: 'Mismatch' }]),
    'PLAN_AUDIT_ISSUE_INVALID',
  ],
  ['empty reason', (r) => (r.checks[0].reason = '  '), 'PLAN_AUDIT_CHECK_INVALID'],
  ['oversized reason', (r) => (r.checks[0].reason = 'x'.repeat(1201)), 'PLAN_AUDIT_CHECK_INVALID'],
  [
    'UNCLEAR without question issue',
    (r) => (r.checks[0].status = 'UNCLEAR'),
    'PLAN_AUDIT_INCONSISTENT',
  ],
  ['MISSING without gap issue', (r) => (r.checks[0].status = 'MISSING'), 'PLAN_AUDIT_INCONSISTENT'],
  [
    'gap contradicts covered checks',
    (r) => (r.issues = [{ code: 'ASSERTION_GAP', step_id: 'S1', reason: 'missing' }]),
    'PLAN_AUDIT_INCONSISTENT',
  ],
])
  test(`audit rejects ${label}`, () => {
    const { c, plan, reply } = fixture();
    mutate(reply);
    assert.throws(() => validatePlanAudit(reply, c, plan), code(error));
  });

test('missing checks may cite partial but only relevant same-step assertions', () => {
  const { c, plan, reply } = fixture();
  reply.checks[0].status = 'MISSING';
  reply.issues = [
    {
      code: 'ASSERTION_GAP',
      step_id: 'S1',
      reason: 'The referenced assertion measures only part of this expectation.',
    },
  ];
  assert.equal(validatePlanAudit(reply, c, plan).outcome, 'REPAIR');
  reply.checks[0].assertion_indices = [1];
  assert.throws(
    () => validatePlanAudit(reply, c, plan),
    code('PLAN_AUDIT_ASSERTION_REFERENCE_INVALID'),
  );
});

test('stale candidate or changed source mapping cannot be audited as current', () => {
  const { c, plan, reply } = fixture();
  plan.steps[0].source_expected = 'New Oracle';
  assert.throws(() => auditInput(c, plan, {}), code('PLAN_AUDIT_BASELINE_MISMATCH'));
  assert.throws(() => validatePlanAudit(reply, c, plan), code('PLAN_AUDIT_BASELINE_MISMATCH'));
  const fresh = fixture();
  fresh.plan.case_hash = 'wrong';
  assert.throws(
    () => validatePlanAudit(fresh.reply, fresh.c, fresh.plan),
    code('PLAN_AUDIT_BASELINE_MISMATCH'),
  );
});

test('candidate error whitelist repairs structure/types/mapping but never runtime or external failures', () => {
  for (const error of [
    'INVALID_SCHEMA',
    'ASSERTION_BOOL_INVALID',
    'UNSAFE_CSS_LOCATOR',
    'PLAN_ORIGINAL_STEP_CHANGED',
    'ORACLE_COVERAGE_INCOMPLETE',
    'CLEANUP_IDENTITY_REQUIRED',
  ])
    assert.equal(repairablePlanError(error), true, error);
  for (const error of [
    'DEEPSEEK_AUTH_FAILED',
    'DEEPSEEK_RATE_LIMIT',
    'DEEPSEEK_OUTPUT_TRUNCATED',
    'DEEPSEEK_JSON_INVALID',
    'ETIMEDOUT',
    'ENOSPC',
    'EVIDENCE_CHANGED',
    'SENSITIVE_CONTROL_FORBIDDEN',
    'OUTSIDE_TARGET_ORIGIN',
    'CASE_CLEANUP_FAILED',
    'BASELINE_CHANGED',
    'OBLIGATIONS_CONFIRMATION_REQUIRED',
    'ORACLE_REQUIRED',
    'PLAN_AUDIT_SCHEMA_INVALID',
    'LOCATOR_NOT_VISIBLE',
    'LOCATOR_NOT_UNIQUE',
    'ASSERTION_FAILED',
    'UNKNOWN',
    null,
    {},
  ])
    assert.equal(repairablePlanError(error), false, String(error));
});

test('table planning errors and explicit React policy error are repairable, never runtime prefixes', () => {
  for (const error of [
    'TABLE_SCHEMA_INVALID',
    'TABLE_ARRAY_INVALID',
    'TABLE_IDENTITY_INVALID',
    'TABLE_FLAGS_INVALID',
    'TABLE_EMPTY_EXPECTATION',
    'TABLE_KEY_DUPLICATE',
    'TABLE_EMPTY_CELLS',
    'TABLE_CELL_LIMIT',
    'TABLE_COLUMN_DUPLICATE',
    'TABLE_TEXT_INVALID',
    'TABLE_NUMBER_INVALID',
    'TABLE_CHECK_INVALID',
    'TABLE_SOURCE_UNGROUNDED',
    'TABLE_SOURCE_LIMIT',
    'TABLE_SOURCE_INVALID',
    'REACT_POLICY_INVALID',
  ])
    assert.equal(repairablePlanError(error), true, error);
  for (const error of [
    'TABLE_STRUCTURE_INVALID',
    'TABLE_SAMPLE_LIMIT',
    'TABLE_KEY_COLUMN_MISSING',
    'TABLE_COLUMN_MISSING',
    'TABLE_ASSERTION_FAILED',
    'TABLE_FUTURE_ERROR',
    'TABLE_',
    'REACT_FUTURE_ERROR',
    'REACT_POLICY_INVALID_EXTRA',
  ])
    assert.equal(repairablePlanError(error), false, error);
});

test('structural validator does not pretend to prove truth of a covered audit', () => {
  const { c, plan, reply } = fixture();
  // A lying reviewer can cite an existing mapped assertion. This module checks
  // references and schema, not arbitrary natural-language entailment.
  plan.steps[0].assertions[0].expected = 'Name label only';
  assert.equal(validatePlanAudit(reply, c, plan).outcome, 'ACCEPT');
  assert.match(PLAN_AUDIT_PROMPT, /Identify counterexamples/);
});

function rangeFixture(expected, check = 'hidden') {
  const f = fixture();
  const s = f.c.steps[0];
  s.expected = expected;
  s.obligations = [{ id: 'O1', text: expected }];
  f.plan.case_hash = caseHash(f.c);
  f.plan.steps[0].source_expected = expected;
  f.plan.steps[0].assertions = ['D001', 'D002', 'D003', 'D004', 'D005'].map((id) => ({
    target: {
      kind: 'row',
      table: { kind: 'role', role: 'table', name: '记录', exact: true },
      key: { column: '编号', value: id },
    },
    check,
    oracle_quote: expected,
    obligation_ids: ['O1'],
  }));
  f.reply.checks = f.reply.checks.filter((c) => c.obligation_id !== 'O2');
  f.reply.checks[0].assertion_indices = [0, 1, 2, 3, 4];
  return f;
}

for (const expected of [
  '不应出现D001至D005',
  '列表不得显示D001至D005',
  'D001至D005均不可见',
  'D001至D005应隐藏',
  '列表中没有D001至D005',
  '排除D001至D005',
  'D001至D005之外的记录可见',
  'D001至D005 must not appear',
  'D001至D005 should be hidden',
])
  test(`negative range must not demand positive presence: ${expected}`, () => {
    const f = rangeFixture(expected),
      before = structuredClone(f);
    const result = validatePlanAudit(f.reply, f.c, f.plan);
    // ACCEPT is still just the supplied model finding, not proof of absence.
    assert.equal(result.outcome, 'ACCEPT');
    assert.deepEqual(result.issues, []);
    assert.deepEqual(f, before);
  });

test('skipping positive range expansion retains missing/unclear absence findings', () => {
  for (const [status, code] of [
    ['MISSING', 'ASSERTION_GAP'],
    ['UNCLEAR', 'ORACLE_UNCLEAR'],
  ]) {
    const f = rangeFixture('不应出现D001至D005');
    f.reply.checks[0].status = status;
    f.reply.issues = [{ code, step_id: 'S1', reason: '原预期的缺席检查仍有问题。' }];
    const result = validatePlanAudit(f.reply, f.c, f.plan);
    assert.equal(result.outcome, 'REPAIR');
    assert.deepEqual(result.issues[0], f.reply.issues[0]);
    assert.equal(result.checks[0].status, status);
  }
});

test('negative clause does not disable another positive range or pagination guard', () => {
  const f = rangeFixture('不应出现D001至D005；应显示X001至X005；显示第2/3页');
  const result = validatePlanAudit(f.reply, f.c, f.plan);
  assert.equal(result.outcome, 'REPAIR');
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.some((i) => i.reason.includes('X001至X005')));
  assert.ok(result.issues.some((i) => i.reason.includes('第2/3页')));
  assert.ok(result.issues.every((i) => !i.reason.includes('D001至D005')));
});

test('hidden checks and negative reviewer prose cannot suppress a positive source range', () => {
  const f = rangeFixture('应显示D001至D005');
  f.reply.checks[0].reason = '不应拒绝此计划。';
  f.plan.steps[0].assertions.forEach((a) => {
    a.oracle_quote = '不应出现D001至D005';
  });
  const result = validatePlanAudit(f.reply, f.c, f.plan);
  assert.equal(result.outcome, 'REPAIR');
  assert.equal(result.checks[0].status, 'MISSING');
  assert.ok(result.issues.some((i) => i.reason.includes('D003')));
});
