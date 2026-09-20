import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { suggestObligations, validateAssertion } from '../src/plans.mjs';
import {
  approveInterpretation,
  withExpectationContract,
  contractIssues,
  interpretationInput,
} from '../src/expectation-contract.mjs';
import { sourceSupportsPosition, extractRowPositions } from '../src/table-position.mjs';
const table = { kind: 'role', role: 'table', name: '结果', exact: true };
function original(text) {
  return suggestObligations([{ step_id: 'S', action: '核对当前结果', expected: text }])[0];
}
function setup(o, rows, state = 'INTERPRETED', reviewState = 'SUPPORTED') {
  const expected = {
    key_column: '编号',
    rows: rows.map((r) => ({ ...r, cells: [{ column: '编号', check: 'text', expected: r.key }] })),
    ordered: false,
    exact_rows: false,
  };
  const draft = {
    obligations: o.obligations.map((x) => ({
      id: x.id,
      status: state,
      timing: state === 'INTERPRETED' ? 'AFTER_ACTIONS' : null,
      reason: '独立原文解释',
      predicates:
        state === 'INTERPRETED'
          ? [{ subject: '原记录绝对位置', check: 'table_cells', expected }]
          : [],
    })),
  };
  const review = {
    checks: o.obligations.map((x) => ({ id: x.id, status: reviewState, reason: '独立原文核对' })),
  };
  return { expected, draft, review, contract: approveInterpretation(draft, review, o) };
}
for (const text of [
  '位置2为R701',
  'R701必须占据表体的第二个数据位置',
  'R701 must occupy the second data row.',
])
  test(
    'independent expression uses reviewed relation, not added source regex: ' + text,
    async () => {
      const o = original(text),
        { contract, expected } = setup(o, [{ key: 'R701', position: 2 }]);
      assert.deepEqual(extractRowPositions(text), []);
      assert.equal(sourceSupportsPosition('R701', 2, o), false);
      await withExpectationContract(contract, async () => {
        assert.equal(sourceSupportsPosition('R701', 2, o), true);
        const a = {
          target: table,
          check: 'table_cells',
          expected,
          oracle_quote: text,
          obligation_ids: [o.obligations[0].id],
        };
        validateAssertion(a, o);
        assert.deepEqual(contractIssues(o, { assertions: [a] }), []);
        const weak = structuredClone(a);
        delete weak.expected.rows[0].position;
        assert.equal(contractIssues(o, { assertions: [weak] })[0].state, 'EVIDENCE_INSUFFICIENT');
        assert.equal(sourceSupportsPosition('R701', 1, o), false);
      });
      assert.equal(sourceSupportsPosition('R701', 2, o), false);
    },
  );
test('original HOLD-S2 untouched positional obligation cannot downgrade to membership', async () => {
  const raw = JSON.parse(await fs.readFile('heldout-lab/cases.json', 'utf8')).cases.find(
    (c) => c.case_id === 'HOLD-S2',
  );
  const o = suggestObligations(raw.steps).find((s) => s.step_id === 'S03');
  const rows = [
    ['H107', '300 kW'],
    ['H111', '260 kW'],
    ['H106', '220 kW'],
  ].map(([key, power], i) => ({
    key,
    position: i + 1,
    cells: [{ column: '额定功率', check: 'text', expected: power }],
  }));
  const expected = { key_column: '编号', rows, ordered: false, exact_rows: false };
  const fixed = [
    { subject: '计数器', check: 'text', expected: '共12条 · 第1/4页' },
    { subject: '排序控件', check: 'selected_label', expected: '功率降序' },
    { subject: '表体', check: 'row_count', expected: 3 },
  ];
  const draft = {
    obligations: o.obligations.map((x, i) => ({
      id: x.id,
      status: 'INTERPRETED',
      timing: 'AFTER_ACTIONS',
      reason: '逐原义务独立金标准',
      predicates: [
        i < 3
          ? fixed[i]
          : {
              subject: rows[i - 3].key + '的位置和功率',
              check: 'table_cells',
              expected: { ...expected, rows: [rows[i - 3]] },
            },
      ],
    })),
  };
  const contract = approveInterpretation(
    draft,
    {
      checks: o.obligations.map((x) => ({ id: x.id, status: 'SUPPORTED', reason: '原六义务核对' })),
    },
    o,
  );
  const others = fixed.map((p, i) => ({ ...p, obligation_ids: [o.obligations[i].id] }));
  await withExpectationContract(contract, async () => {
    assert.equal(sourceSupportsPosition('H111', 2, o), true);
    const a = {
      check: 'table_cells',
      target: table,
      expected,
      obligation_ids: o.obligations.slice(3).map((x) => x.id),
    };
    const weaker = structuredClone(a);
    weaker.expected.rows.forEach((r) => delete r.position);
    weaker.expected.ordered = true;
    assert.equal(contractIssues(o, { assertions: [...others, weaker] }).length, 3);
    assert.deepEqual(contractIssues(o, { assertions: [...others, a] }), []);
  });
});
for (const [state, review] of [
  ['UNINTERPRETED', 'SUPPORTED'],
  ['INTERPRETED', 'UNINTERPRETED'],
])
  test(
    'unknown source stays unknown even when candidate claims covered: ' + state + '/' + review,
    () => {
      const o = original('R701满足未提供的计算公式'),
        { contract } = setup(o, [{ key: 'R701', position: 2 }], state, review);
      withExpectationContract(contract, () => {
        assert.equal(contractIssues(o, { assertions: [] })[0].state, 'UNINTERPRETED');
        assert.equal(sourceSupportsPosition('R701', 2, o), false);
      });
    },
  );
test('cannot install serialized authority; original/hash change and concurrent step isolated', async () => {
  const o = original('位置2为R701'),
    { contract } = setup(o, [{ key: 'R701', position: 2 }]);
  assert.throws(() => withExpectationContract(structuredClone(contract), () => {}), /UNTRUSTED/);
  assert.throws(() => {
    contract.obligations[0].predicates = [];
  }, TypeError);
  await Promise.all([
    withExpectationContract(contract, async () => {
      await new Promise((r) => setTimeout(r, 5));
      assert.ok(sourceSupportsPosition('R701', 2, o));
      assert.equal(sourceSupportsPosition('R701', 2, { expected: '不同原文' }), false);
    }),
    Promise.resolve().then(() => assert.equal(sourceSupportsPosition('R701', 2, o), false)),
  ]);
});
test('missing, duplicate or invented obligation cannot become an empty covered contract', () => {
  const o = original('位置2为R701'),
    { draft, review } = setup(o, [{ key: 'R701', position: 2 }]);
  assert.throws(() => approveInterpretation({ obligations: [] }, review, o));
  assert.throws(() => approveInterpretation(draft, { checks: [] }, o));
  const bad = structuredClone(draft);
  bad.obligations[0].id = 'INVENTED';
  assert.throws(() => approveInterpretation(bad, review, o));
  assert.equal(interpretationInput(o).page_evidence, 'NOT_PROVIDED');
  assert.equal(interpretationInput(o).candidate, undefined);
});
test('legacy English terminal-period identity limitation remains explicit, not relaxed', () => {
  const o = original('The second data row must be R701.'),
    { contract, expected } = setup(o, [{ key: 'R701', position: 2 }]);
  withExpectationContract(contract, () =>
    assert.throws(
      () =>
        validateAssertion(
          {
            target: table,
            check: 'table_cells',
            expected,
            oracle_quote: o.expected,
            obligation_ids: [o.obligations[0].id],
          },
          o,
        ),
      /TABLE_SOURCE_UNGROUNDED/,
    ),
  );
});

test('pre-action proof cannot discharge a post-action source obligation', () => {
  const o = original('位置2为R701'),
    { contract, expected, draft, review } = setup(o, [{ key: 'R701', position: 2 }]);
  const a = { check: 'table_cells', expected, obligation_ids: [o.obligations[0].id] };
  const checkpoints = [
    { actions: [], assertions: [a] },
    { actions: [{ op: 'click' }], assertions: [] },
  ];
  withExpectationContract(contract, () =>
    assert.equal(contractIssues(o, { checkpoints })[0].state, 'EVIDENCE_INSUFFICIENT'),
  );
  draft.obligations[0].timing = 'BEFORE_ACTIONS';
  withExpectationContract(approveInterpretation(draft, review, o), () => {
    assert.deepEqual(contractIssues(o, { checkpoints }), []);
    assert.ok(
      contractIssues(o, { checkpoints: [{ actions: [{ op: 'click' }], assertions: [a] }] }).length,
    );
  });
});
