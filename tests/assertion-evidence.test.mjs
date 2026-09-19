import test from 'node:test';
import assert from 'node:assert/strict';
import { assertionEvidenceBinding, EVIDENCE_SOURCE_GUIDANCE } from '../src/assertion-evidence.mjs';
import { adaptiveAuditInput, ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
const target = {
  kind: 'within',
  scope: { role: 'dialog', name: '设备X', exact: true },
  target: { kind: 'definition', name: '温度', exact: true },
};
test('field evidence syntax keeps object and field separate from business values', () => {
  const a = { target, check: 'text', expected: '55 ℃', obligation_ids: ['O1', 'O2'] },
    before = structuredClone(a);
  const d = assertionEvidenceBinding(a);
  assert.equal(d.kind, 'native_definition_field');
  assert.equal(d.declared_field_label, '温度');
  assert.equal(d.comparison, 'exact_text');
  assert.equal(d.runtime_verified, false);
  assert.equal(Object.hasOwn(d, 'expected'), false);
  d.object_scope.name = 'different';
  assert.deepEqual(a, before);
});
test('heading, region substring and visibility cannot be tagged as a field value', () => {
  for (const a of [
    {
      target: { ...target, target: { kind: 'role', role: 'heading', name: '说明', exact: true } },
      check: 'text',
    },
    { target: { kind: 'within', scope: target.scope }, check: 'contains' },
  ])
    assert.equal(assertionEvidenceBinding(a).field_value_proof, false);
  assert.equal(
    assertionEvidenceBinding({ target, check: 'visible' }).comparison,
    'not_a_field_value_comparison',
  );
});
test('row field uses original identity and column, numeric projection is distinguished', () => {
  const a = {
    target: {
      kind: 'cell',
      table: { kind: 'role', role: 'table', name: '结果', exact: true },
      key: { column: '编号', value: 'X1' },
      column: '温度',
    },
    check: 'number',
  };
  const d = assertionEvidenceBinding(a);
  assert.equal(d.kind, 'table_record_field');
  assert.deepEqual(d.record_key, a.target.key);
  assert.equal(d.declared_field_label, '温度');
  assert.equal(
    assertionEvidenceBinding({ target, check: 'display_number' }).comparison,
    'numeric_projection',
  );
});
test('matrix descriptor lists columns without turning observed/expected values into proof', () => {
  const a = {
    target: { kind: 'role', role: 'table', name: '结果', exact: true },
    check: 'table_cells',
    expected: {
      key_column: '编号',
      rows: [{ key: 'X1', cells: [{ column: '温度', check: 'text', expected: '55 ℃' }] }],
    },
  };
  assert.deepEqual(assertionEvidenceBinding(a).declared_columns, ['温度']);
  assert.equal(assertionEvidenceBinding(a).runtime_verified, false);
  assert.doesNotMatch(JSON.stringify(assertionEvidenceBinding(a)), /55/);
});
test('advisory catalog does not alter candidate, source refs, original or audit status', () => {
  const a = { target, check: 'text', expected: '55 ℃', obligation_ids: ['O1', 'O2'] };
  const input = {
    original: { steps: [{ expected: '温度为55 ℃；说明即使含55 ℃也不作为温度字段' }] },
    candidate_plan: { steps: [{ step_id: '1', assertions: [a] }] },
  };
  const before = structuredClone(input),
    result = adaptiveAuditInput(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.assertion_catalog[0].obligation_ids, ['O1', 'O2']);
  assert.equal(result.assertion_catalog[0].evidence_binding.runtime_verified, false);
  assert.equal(Object.hasOwn(result, 'outcome'), false);
  assert.equal(Object.hasOwn(result.assertion_catalog[0], 'passed'), false);
});
test('planner and independent adaptive reviewer share bounded conditional-source policy', () => {
  assert.ok(ADAPTIVE_NEXT_PROMPT.includes(EVIDENCE_SOURCE_GUIDANCE));
  assert.ok(ADAPTIVE_REVIEW_REFERENCES.includes(EVIDENCE_SOURCE_GUIDANCE));
  assert.match(EVIDENCE_SOURCE_GUIDANCE, /positively REQUIRES note/);
  assert.match(EVIDENCE_SOURCE_GUIDANCE, /MISSING\/UNCLEAR/);
});
