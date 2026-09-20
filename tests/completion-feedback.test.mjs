import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateIssues } from '../src/adaptive-candidate-feedback.mjs';
import { createAdaptivePlan } from '../src/adaptive-plan.mjs';
import { suggestObligations } from '../src/plans.mjs';
import { completionIssues } from '../src/completion-evidence.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';

const base = 'http://localhost/';
const table = { kind: 'role', role: 'table', name: '结果', exact: true };
function fixture(expected = '默认第1页显示R001至R002。') {
  const c = {
    case_id: 'EARLY',
    steps: suggestObligations([{ step_id: '1', action: '打开 /result 并核对。', expected }]),
  };
  return { c, step: createAdaptivePlan(c, '/').steps[0], base };
}
function matrix(keys, exact = false) {
  return {
    target: table,
    check: 'table_cells',
    expected: {
      key_column: '编号',
      rows: keys.map((key) => ({ key, cells: [{ column: '编号', check: 'text', expected: key }] })),
      ordered: false,
      exact_rows: exact,
    },
    obligation_ids: ['1-O1'],
  };
}
const fragment = (assertions) => ({
  actions: [],
  assertions,
  complete: false,
  within_ms: 1000,
  reason: '原结果检查',
});
test('first rejected extra constraint also exposes the already-known default-page gap', () => {
  const context = fixture();
  const reply = fragment([matrix(['R001', 'R002'], true)]);
  reply.assertions[0].oracle_quote = context.c.steps[0].expected;
  const before = structuredClone(reply);
  const issues = candidateIssues(reply, context);
  assert.ok(issues.some((i) => i.code === 'PLAN_TABLE_CONSTRAINT_UNSUPPORTED'));
  assert.ok(
    issues.some((i) => i.code === 'PLAN_CURRENT_PAGE_UNPROVEN' && i.required_before_completion),
  );
  assert.deepEqual(reply, before);
});
test('candidate aggregation preserves same-checkpoint sole-row proof, not flattened fragments', () => {
  const context = fixture('唯一行是R009。');
  const identity = matrix(['R009']);
  const count = { target: table, check: 'row_count', expected: 1, obligation_ids: ['1-O1'] };
  assert.ok(
    candidateIssues(fragment([count]), { ...context, previous: [fragment([identity])] }).some(
      (i) => i.code === 'PLAN_UNIQUE_ROW_UNPROVEN',
    ),
  );
  assert.ok(
    !candidateIssues(fragment([identity, count]), context).some(
      (i) => i.code === 'PLAN_UNIQUE_ROW_UNPROVEN',
    ),
  );
});

test('future-page gap is advisory: partial navigation allowed, complete still refused', () => {
  const { c } = fixture();
  const plan = { steps: [{ actions: [{ op: 'navigate', value: '/result' }], assertions: [] }] };
  assert.ok(
    completionIssues(c.steps[0], plan.steps[0], { adaptiveReadonly: true }).some(
      (i) => i.code === 'PLAN_CURRENT_PAGE_UNPROVEN',
    ),
  );
  assert.doesNotThrow(() =>
    requirePlanSemantics(plan, c, { adaptive_readonly: true }, { complete: false }),
  );
  assert.throws(() => requirePlanSemantics(plan, c, { adaptive_readonly: true }), {
    code: 'PLAN_CURRENT_PAGE_UNPROVEN',
  });
});

test('wrong original page or source reference does not close the structural gap', () => {
  const { c } = fixture();
  const wanted = {
    target: { kind: 'css', value: '#pager' },
    check: 'contains',
    expected: '第1/',
    obligation_ids: ['1-O1'],
  };
  for (const assertion of [
    { ...wanted, expected: '第11/' },
    { ...wanted, obligation_ids: ['1-O9'] },
  ])
    assert.ok(
      completionIssues(
        c.steps[0],
        { actions: [], assertions: [assertion] },
        { adaptiveReadonly: true },
      ).some((i) => i.code === 'PLAN_CURRENT_PAGE_UNPROVEN'),
    );
  assert.deepEqual(
    completionIssues(c.steps[0], { actions: [], assertions: [wanted] }, { adaptiveReadonly: true }),
    [],
  );
});

test('malformed diagnostics are explicit unknowns and cannot mutate candidate or actual history', () => {
  const context = fixture();
  for (const reply of [null, { assertions: 'bad' }, { assertions: [null] }, { assertions: [{}] }]) {
    const before = structuredClone(reply);
    const issues = candidateIssues(reply, context);
    assert.ok(issues.length > 0);
    assert.ok(issues.every((i) => i.evidence_of_pass !== true));
    assert.deepEqual(reply, before);
  }
  const previous = [fragment([matrix(['R001', 'R002'])])];
  const copy = structuredClone(previous);
  candidateIssues(fragment([]), { ...context, previous });
  assert.deepEqual(previous, copy);
});

test('bounded diagnostic list declares truncation; hard completion is not truncated', () => {
  const context = fixture(
    '第1至30行依次为' + Array.from({ length: 30 }, (_, i) => 'R' + (101 + i)).join('、') + '。',
  );
  const issues = candidateIssues(fragment([]), context);
  assert.equal(issues.length, 24);
  assert.equal(issues.at(-1).code, 'DIAGNOSTIC_LIST_TRUNCATED');
  assert.equal(issues.at(-1).omitted_count, 7);
  const all = completionIssues(
    context.c.steps[0],
    { actions: [], assertions: [] },
    { adaptiveReadonly: true },
  );
  assert.equal(all.length, 30);
  assert.throws(
    () =>
      requirePlanSemantics({ steps: [{ actions: [], assertions: [] }] }, context.c, {
        adaptive_readonly: true,
      }),
    { code: 'PLAN_ROW_POSITION_UNPROVEN' },
  );
});
