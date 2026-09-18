import test from 'node:test';
import assert from 'node:assert/strict';
import { extractExpectationRanges, expectationCoverageGaps } from '../src/expectation-coverage.mjs';
import { caseHash } from '../src/plans.mjs';
import { validatePlanAudit } from '../src/plan-quality.mjs';

const table = { kind: 'role', role: 'table', name: '记录', exact: true };
const ids = ['D001', 'D002', 'D003', 'D004', 'D005'];
const expected = '显示D001至D005';
const row = (id, check = 'visible', value) => ({
  target: { kind: 'row', table, key: { column: '编号', value: id } },
  check,
  ...(value === undefined ? {} : { expected: value }),
  obligation_ids: ['O1'],
  oracle_quote: expected,
});
const sequence = (values = ids) => ({
  target: table,
  check: 'row_sequence',
  expected: values,
  obligation_ids: ['O1'],
  oracle_quote: expected,
});
const cells = () => ({
  target: table,
  check: 'table_cells',
  expected: {
    key_column: '编号',
    rows: ids.map((key) => ({ key, cells: [{ column: '编号', check: 'text', expected: key }] })),
    ordered: true,
    exact_rows: true,
  },
  obligation_ids: ['O1'],
  oracle_quote: expected,
});

function fixture(text = expected, assertions = [row(ids[0]), row(ids[4])]) {
  const original = {
    step_id: 'S1',
    action: '查看列表',
    expected: text,
    obligations: [{ id: 'O1', text }],
  };
  const c = { case_id: 'RANGE-1', steps: [original] };
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: '/records',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: [
      {
        step_id: 'S1',
        source_action: original.action,
        source_expected: text,
        actions: [],
        assertion_mode: 'simultaneous',
        within_ms: 8000,
        assertions: structuredClone(assertions),
      },
    ],
  };
  const reply = {
    checks: [
      {
        step_id: 'S1',
        obligation_id: 'O1',
        status: 'COVERED',
        assertion_indices: assertions.map((_, i) => i),
        reason: '模型声称覆盖。',
      },
    ],
    issues: [],
  };
  return { c, plan, reply, original };
}
const audit = (f) => validatePlanAudit(f.reply, f.c, f.plan);
const gaps = (f) => expectationCoverageGaps(f.original, f.plan.steps[0].assertions, f.reply.checks);

test('bounded inclusive range extraction preserves prefix, zero padding and expected provenance', () => {
  for (const separator of ['至', '到', '-', '–', '—', '~', '～', ' to ']) {
    assert.deepEqual(extractExpectationRanges(`显示 D001${separator}D005。`), [
      { source: 'expected', quote: `D001${separator}D005`, ids },
    ]);
  }
  assert.deepEqual(extractExpectationRanges('ab9 至 ab12')[0].ids, ['ab9', 'ab10', 'ab11', 'ab12']);
  assert.deepEqual(extractExpectationRanges('X000至X000')[0].ids, ['X000']);
  assert.equal(extractExpectationRanges('A001至A050')[0].ids.length, 50);
  assert.equal(extractExpectationRanges('D001至D002；X07-X08').length, 2);
});

for (const text of [
  'D001至D051',
  'D005至D001',
  'D001至X005',
  'D001至d005',
  'D01至D005',
  'D01至D5',
  'D1至D05',
  '001至005',
  'D001至005',
  'D001到D005x',
  'D9007199254740992至D9007199254740993',
  'D001、D005',
  '_D001至D005',
  'AB-D001至AB-D005',
]) {
  test(`unsupported range stays with semantic review: ${text}`, () => {
    assert.deepEqual(extractExpectationRanges(text), []);
    assert.deepEqual(gaps(fixture(text)), []);
  });
}

test('endpoints cannot hide missing interior identities behind a COVERED reply', () => {
  const f = fixture(),
    before = structuredClone(f);
  assert.deepEqual(gaps(f)[0].missing, ['D002', 'D003', 'D004']);
  const result = audit(f);
  assert.equal(result.outcome, 'REPAIR');
  assert.equal(result.checks[0].status, 'MISSING');
  assert.ok(result.issues.some((i) => i.code === 'ASSERTION_GAP' && /D002/.test(i.reason)));
  assert.deepEqual(f, before);
});

test('every range, not just the first occurrence, is checked', () => {
  const f = fixture(
    'D001至D005；X01至X03',
    ids.map((id) => row(id)),
  );
  assert.deepEqual(
    gaps(f).map((g) => g.missing),
    [['X01', 'X02', 'X03']],
  );
});

for (const [label, assertions] of [
  ['visible rows', ids.map((id) => row(id))],
  ['row text', ids.map((id) => row(id, 'text', `${id} 商品`))],
  ['row contains identity', ids.map((id) => row(id, 'contains', id))],
  [
    'identity cells',
    ids.map((id) => ({
      ...row(id, 'text', id),
      target: { ...row(id).target, kind: 'cell', column: '编号' },
    })),
  ],
  [
    'visible identity cells',
    ids.map((id) => ({ ...row(id), target: { ...row(id).target, kind: 'cell', column: '编号' } })),
  ],
  ['row sequence', [sequence()]],
  ['table cells', [cells()]],
])
  test(`${label} satisfies the literal identity guard only`, () => {
    const f = fixture(expected, assertions);
    assert.deepEqual(gaps(f), []);
    assert.equal(audit(f).outcome, 'ACCEPT');
  });

for (const [label, make] of [
  ['hidden rows', (id) => row(id, 'hidden')],
  ['disabled visibility', (id) => row(id, 'visible', false)],
  ['empty contains', (id) => row(id, 'contains', '')],
  ['whitespace contains', (id) => row(id, 'contains', '   ')],
  ['field label only', (id) => row(id, 'contains', '编号')],
  ['enabled button', (id) => row(id, 'enabled', true)],
  ['wrong identifier text', (id) => row(id, 'text', `${id}0`)],
  ['label locator', (id) => ({ ...row(id), target: { kind: 'label', value: id, exact: true } })],
  [
    'row child label',
    (id) => ({
      ...row(id),
      target: { ...row(id).target, target: { kind: 'text', value: '编号', exact: true } },
    }),
  ],
  [
    'other cell',
    (id) => ({
      ...row(id, 'contains', id),
      target: { ...row(id).target, kind: 'cell', column: '备注' },
    }),
  ],
  ['whole-table text', (id) => ({ ...row(id, 'contains', id), target: table })],
])
  test(`${label} does not prove range membership`, () => {
    const f = fixture(expected, ids.map(make));
    assert.deepEqual(gaps(f)[0].missing, ids);
    assert.equal(audit(f).outcome, 'REPAIR');
  });

test('IDs in oracle_quote or obligation_ids never constitute a measured identity', () => {
  const f = fixture(expected, [{ ...row('unrelated'), oracle_quote: ids.join(' ') }]);
  assert.deepEqual(gaps(f)[0].missing, ids);
});

test('partial and malformed compound checks do not cover omitted IDs', () => {
  for (const assertion of [
    sequence(['D001', 'D005']),
    sequence(ids.map((id) => `${id}0`)),
    sequence([ids.join(' ')]),
  ])
    assert.equal(audit(fixture(expected, [assertion])).outcome, 'REPAIR');
  for (const mutate of [
    (a) => {
      a.expected.rows = a.expected.rows.filter((r) => r.key !== 'D003');
    },
    (a) => {
      a.expected.rows[2].cells = [];
    },
    (a) => {
      a.expected.rows[2].cells[0].expected = '';
    },
    (a) => {
      a.expected.rows[2].cells[0].check = 'contains';
    },
    (a) => {
      a.expected.key_column = '';
    },
    (a) => {
      a.expected.rows.push(structuredClone(a.expected.rows[2]));
    },
    (a) => {
      a.target = { kind: 'label', value: '编号', exact: true };
    },
  ]) {
    const a = cells();
    mutate(a);
    assert.ok(gaps(fixture(expected, [a]))[0].missing.includes('D003'));
  }
});

test('table_cells supports actual numeric cells bound to each exact row key', () => {
  const a = cells();
  a.expected.rows.forEach((r) => {
    r.cells = [{ column: '数量', check: 'number', expected: 0 }];
  });
  a.expected.ordered = false;
  a.expected.exact_rows = false;
  assert.deepEqual(gaps(fixture(expected, [a])), []);
  a.expected.rows[2].cells[0].expected = NaN;
  assert.ok(gaps(fixture(expected, [a]))[0].missing.includes('D003'));
});

test('current obligation must cite actual assertions; another obligation or step cannot lend coverage', () => {
  const f = fixture(
    expected,
    ids.map((id) => row(id)),
  );
  f.reply.checks[0].assertion_indices = [0, 4];
  assert.deepEqual(gaps(f)[0].missing, ['D002', 'D003', 'D004']);
  f.reply.checks[0].assertion_indices = [0, 1, 2, 3, 4];
  f.plan.steps[0].assertions[2].obligation_ids = ['OTHER'];
  assert.deepEqual(gaps(f)[0].missing, ['D003']);
  f.reply.checks[0].step_id = 'S2';
  assert.deepEqual(gaps(f)[0].missing, ids);
});

test('literal extraction ignores action, metadata and quotes when absent from original expected', () => {
  const f = fixture('列表可见', [row('D001')]);
  f.original.action = expected;
  assert.deepEqual(gaps(f), []);
});

test('multiple obligations retain their own literal coverage', () => {
  const f = fixture('显示D001至D005；显示第2/3页', [
    ...ids.map((id) => row(id)),
    {
      target: { kind: 'text', value: '第2/3页', exact: true },
      check: 'visible',
      obligation_ids: ['O2'],
    },
  ]);
  f.original.obligations = [
    { id: 'O1', text: expected },
    { id: 'O2', text: '显示第2/3页' },
  ];
  f.plan.case_hash = caseHash(f.c);
  f.reply.checks[0].assertion_indices = [0, 1, 2, 3, 4];
  f.reply.checks.push({
    step_id: 'S1',
    obligation_id: 'O2',
    status: 'COVERED',
    assertion_indices: [5],
    reason: '页码。',
  });
  assert.equal(audit(f).outcome, 'ACCEPT');
  f.plan.steps[0].assertions[5] = {
    ...f.plan.steps[0].assertions[5],
    check: 'enabled',
    expected: true,
  };
  const result = audit(f);
  assert.equal(result.checks[0].status, 'COVERED');
  assert.equal(result.checks[1].status, 'MISSING');
});

const pageAssertion = (check, value, target = { kind: 'testid', value: 'pagination' }) => ({
  target,
  check,
  ...(value === undefined ? {} : { expected: value }),
  oracle_quote: '第2/3页',
  obligation_ids: ['O1'],
});
for (const value of ['第2/3页', '共12条 · 第2/3页', '共12条 · 第 2 / 3 页']) {
  for (const check of ['text', 'contains', 'visible'])
    test(`page ${check} accepts explicit compatible text: ${value}`, () => {
      const a =
        check === 'visible'
          ? pageAssertion(check, undefined, { kind: 'text', value, exact: true })
          : pageAssertion(check, value);
      assert.deepEqual(gaps(fixture('显示第2/3页', [a])), []);
    });
}
for (const [label, a] of [
  [
    'enabled',
    pageAssertion('enabled', true, { kind: 'role', role: 'button', name: '下一页', exact: true }),
  ],
  ['hidden', pageAssertion('hidden', undefined, { kind: 'text', value: '第2/3页', exact: true })],
  ['generic visible', pageAssertion('visible')],
  [
    'empty contains',
    pageAssertion('contains', '', { kind: 'text', value: '第2/3页', exact: true }),
  ],
  ['partial page number', pageAssertion('contains', '2')],
  ['different current page', pageAssertion('text', '共12条 · 第1/3页')],
  ['different total pages', pageAssertion('text', '第2/4页')],
  [
    'different exact locator',
    pageAssertion('text', '第2/3页', { kind: 'text', value: '第1/3页', exact: true }),
  ],
  ['contradictory page text', pageAssertion('contains', '第2/3页 第1/3页')],
  [
    'label only',
    pageAssertion('visible', undefined, { kind: 'label', value: '第2/3页', exact: true }),
  ],
])
  test(`pagination rejects ${label}`, () => {
    const f = fixture('显示第2/3页', [a]);
    assert.equal(gaps(f)[0].kind, 'page');
    assert.equal(audit(f).outcome, 'REPAIR');
  });

test('checkpoints flatten within the original step, without borrowing evidence from another step', () => {
  const f = fixture(
    expected,
    ids.map((id) => row(id)),
  );
  const s = f.plan.steps[0];
  f.plan.schema_version = 'ui-agent-plan/v3';
  s.checkpoints = [
    { checkpoint_id: 'P1', actions: [], assertions: s.assertions.slice(0, 2) },
    { checkpoint_id: 'P2', actions: [], assertions: s.assertions.slice(2) },
  ];
  delete s.assertions;
  delete s.actions;
  delete s.within_ms;
  s.assertion_mode = 'sequential_checkpoints';
  s.timeout_ms = 60000;
  assert.equal(audit(f).outcome, 'ACCEPT');
  s.checkpoints[1].assertions[0].check = 'hidden';
  assert.equal(audit(f).outcome, 'REPAIR');
});

test('literal guards never override an independent model semantic finding', () => {
  const f = fixture(expected, [sequence()]);
  f.reply.checks[0].status = 'MISSING';
  f.reply.issues = [{ code: 'ASSERTION_GAP', step_id: 'S1', reason: '原预期的字段值尚未核验。' }];
  assert.deepEqual(gaps(f), []);
  assert.equal(audit(f).outcome, 'REPAIR');
  assert.deepEqual(audit(f).issues, f.reply.issues);
  f.reply.checks[0].status = 'UNCLEAR';
  f.reply.issues[0].code = 'ORACLE_UNCLEAR';
  assert.equal(audit(f).outcome, 'REPAIR');
  assert.equal(audit(f).checks[0].status, 'UNCLEAR');
});
