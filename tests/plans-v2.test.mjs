import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON, semanticHash, hash } from '../src/common.mjs';
import { demoCases } from '../src/demo.mjs';
import {
  caseHash,
  planHash,
  validatePlan,
  validateRepair,
  repairInvariant,
  suggestObligations,
  validateObligations,
} from '../src/plans.mjs';

const base = 'http://127.0.0.1:4000';
const code = (x) => (e) => e.code === x;
const fixture = () => {
  const { baseline, plans } = demoCases();
  return { c: baseline.cases[0], p: plans[0], mutation: plans[1], mc: baseline.cases[1] };
};
const repairFixture = () => {
  const { c, p } = fixture(),
    a = p.steps[0].actions[0];
  const failure = {
    action_id: a.action_id,
    code: 'LOCATOR_NOT_VISIBLE',
    phase: 'RESOLVE',
    dispatched: false,
    current_target: structuredClone(a.target),
  };
  const patch = {
    schema_version: 'ui-agent-locator-patch/v1',
    action_id: a.action_id,
    old_target_hash: semanticHash(a.target),
    target: { kind: 'label', value: '商品名称', exact: true },
  };
  return { c, p, a, failure, patch };
};

test('v2 fixture plans validate in both synthetic domains', () => {
  const { c, p, mutation, mc } = fixture();
  assert.equal(validatePlan(p, c, base), p);
  assert.equal(validatePlan(mutation, mc, base), mutation);
});
test('canonical semantic hashes ignore object key order and preserve arrays and strings', () => {
  const a = { z: [1, { b: ' 汉字\n', a: true }], a: 3 },
    b = { a: 3, z: [1, { a: true, b: ' 汉字\n' }] };
  assert.equal(canonicalJSON(a), '{' + '"a":3,"z":[1,{"a":true,"b":" 汉字\\n"}]}');
  assert.equal(semanticHash(a), semanticHash(b));
  assert.notEqual(hash(a), hash(b));
  assert.notEqual(semanticHash([1, 2]), semanticHash([2, 1]));
  assert.notEqual(semanticHash(' x'), semanticHash('x'));
});
test('canonical encoding rejects values outside JSON rather than dropping semantic fields', () => {
  for (const v of [
    undefined,
    NaN,
    Infinity,
    { a: undefined },
    [undefined],
    new Date(),
    Buffer.from('x'),
  ])
    assert.throws(() => canonicalJSON(v), code('NON_JSON_VALUE'));
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => canonicalJSON(cycle), code('NON_JSON_VALUE'));
  assert.throws(() => canonicalJSON(Array(1)), code('NON_JSON_VALUE'));
  const disguisedHole = Array(1);
  disguisedHole.extra = true;
  assert.throws(() => canonicalJSON(disguisedHole), code('NON_JSON_VALUE'));
});
test('v1 hash interpretation stays legacy and v1 execution demands reapproval', () => {
  const { c, p } = fixture();
  p.schema_version = 'ui-agent-plan/v1';
  p.case_hash = hash(c);
  assert.equal(planHash(p), hash(p));
  assert.throws(() => validatePlan(p, c, base), code('PLAN_VERSION_REAPPROVAL_REQUIRED'));
});
test('reordering v2 plan or case keys does not invalidate canonical approval', () => {
  const { c, p } = fixture(),
    reorder = (x) => Object.fromEntries(Object.entries(x).reverse());
  assert.equal(caseHash(c), caseHash(reorder(c)));
  assert.equal(planHash(p), planHash(reorder(p)));
  assert.equal(repairInvariant(p), repairInvariant(reorder(p)));
  validatePlan(reorder(p), reorder(c), base);
});
test('obligation drafts preserve original wording and never mutate the supplied case', () => {
  const { c } = fixture(),
    before = structuredClone(c);
  delete c.steps[0].obligations;
  const snapshot = structuredClone(c);
  const draft = suggestObligations(c.steps);
  assert.deepEqual(c, snapshot);
  assert.deepEqual(draft[0].obligations, before.steps[0].obligations);
  assert.equal(validateObligations(draft), draft);
  assert.throws(() => validateObligations(c.steps), code('OBLIGATIONS_CONFIRMATION_REQUIRED'));
});
test('compound expectation cannot lose its quantity obligation', () => {
  const { c, p } = fixture();
  p.steps[0].assertions.pop();
  assert.throws(() => validatePlan(p, c, base), code('ORACLE_COVERAGE_INCOMPLETE'));
});
test('confirmation cannot silently omit a second original clause', () => {
  const { c, p } = fixture();
  c.steps[0].obligations.pop();
  p.case_hash = caseHash(c);
  assert.throws(() => validateObligations(c.steps), code('OBLIGATION_SOURCE_COVERAGE_INCOMPLETE'));
  assert.throws(() => validatePlan(p, c, base), code('OBLIGATION_SOURCE_COVERAGE_INCOMPLETE'));
});
test('repeated quoted phrases cover every exact occurrence and keep surrounding clauses required', () => {
  const s = {
    step_id: 'S1',
    expected: '“就绪”， “就绪”；共2条。',
    obligations: [
      { id: 'O1', text: '就绪' },
      { id: 'O2', text: '共2条' },
    ],
  };
  validateObligations([s]);
  s.obligations.pop();
  assert.throws(() => validateObligations([s]), code('OBLIGATION_SOURCE_COVERAGE_INCOMPLETE'));
  const overlap = { step_id: 'S1', expected: 'aaaa', obligations: [{ id: 'O1', text: 'aaa' }] };
  validateObligations([overlap]);
});
test('source coverage ignores punctuation and whitespace but never numeric or mathematical content', () => {
  const s = { step_id: 'S1', expected: ' “通过” \n。', obligations: [{ id: 'O1', text: '通过' }] };
  validateObligations([s]);
  s.expected = '通过 ≥ 2';
  assert.throws(() => validateObligations([s]), code('OBLIGATION_SOURCE_COVERAGE_INCOMPLETE'));
  s.obligations.push({ id: 'O2', text: '2' });
  assert.throws(() => validateObligations([s]), code('OBLIGATION_SOURCE_COVERAGE_INCOMPLETE'));
  s.obligations.push({ id: 'O3', text: '≥' });
  validateObligations([s]);
});
test('draft splitting retains thousands separators and decimal points inside numbers', () => {
  const draft = suggestObligations([
    { step_id: 'S1', action: '查看金额', expected: '金额为1,234.56，余额为9，876.50,显示成功。' },
  ]);
  assert.deepEqual(
    draft[0].obligations.map((o) => o.text),
    ['金额为1,234.56', '余额为9，876.50', '显示成功'],
  );
  validateObligations(draft);
});
test('business assertions require mapped confirmed obligations', () => {
  const { c, p } = fixture();
  delete p.steps[0].assertions[0].obligation_ids;
  assert.throws(() => validatePlan(p, c, base), code('ASSERTION_OBLIGATIONS_REQUIRED'));
});
test('invented obligation ids and unrelated quotes cannot satisfy coverage', () => {
  const { c, p } = fixture();
  p.steps[0].assertions[0].obligation_ids = ['INVENTED'];
  assert.throws(() => validatePlan(p, c, base), code('ASSERTION_OBLIGATION_UNKNOWN'));
  p.steps[0].assertions[0].obligation_ids = [c.steps[0].obligations[1].id];
  assert.throws(() => validatePlan(p, c, base), code('ASSERTION_OBLIGATION_QUOTE_MISMATCH'));
});
test('obligation text cannot invent business requirements', () => {
  const { c } = fixture();
  c.steps[0].obligations[0].text = '未批准的其他要求';
  assert.throws(() => validateObligations(c.steps), code('OBLIGATION_TEXT_NOT_IN_ORACLE'));
});
test('obligation ids are unique across all steps', () => {
  const { c } = fixture();
  c.steps.push({ ...structuredClone(c.steps[0]), step_id: 'S2' });
  assert.throws(() => validateObligations(c.steps), code('OBLIGATION_ID_INVALID'));
});
test('v2 only supports simultaneous assertions with an explicit bounded deadline', () => {
  const { c, p } = fixture();
  p.steps[0].assertion_mode = 'throughout';
  assert.throws(() => validatePlan(p, c, base), code('ASSERTION_MODE_UNSUPPORTED'));
  p.steps[0].assertion_mode = 'simultaneous';
  for (const value of [0, 99, 30001, 100.5]) {
    p.steps[0].within_ms = value;
    assert.throws(() => validatePlan(p, c, base), code('ASSERTION_DEADLINE_INVALID'));
  }
  p.steps[0].assertions = [];
  assert.throws(() => validatePlan(p, c, base), code('ASSERTION_DEADLINE_INVALID'));
});
test('action ids cannot alias across business and cleanup actions', () => {
  const { mutation, mc } = fixture();
  mutation.cleanup.actions[0].action_id = mutation.steps[0].actions[0].action_id;
  assert.throws(() => validatePlan(mutation, mc, base), code('ACTION_ID_INVALID'));
});
test('mutation cleanup requires a read-only identity observation', () => {
  const { mutation, mc } = fixture();
  delete mutation.cleanup.ownership;
  assert.throws(() => validatePlan(mutation, mc, base), code('INVALID_SCHEMA'));
  mutation.cleanup.ownership = [
    { target: mutation.cleanup.assertions[0].target, check: 'visible' },
  ];
  assert.throws(
    () => validatePlan(mutation, mc, base),
    code('CLEANUP_OWNERSHIP_IDENTITY_REQUIRED'),
  );
});
test('locator patch returns only the failed approved action with replaced target', () => {
  const { c, p, a, failure, patch } = repairFixture(),
    before = structuredClone(p);
  const result = validateRepair(patch, p, c, base, failure);
  assert.deepEqual(result, { ...a, target: patch.target });
  assert.deepEqual(p, before);
  assert.equal(result.action_id, a.action_id);
  assert.equal(result.value, '苹果');
  assert.deepEqual(result.repair_anchor, a.repair_anchor);
});
test('repair rejects an entire plan, extra edits and another action id', () => {
  const { c, p, failure, patch } = repairFixture();
  const candidate = structuredClone(p);
  candidate.steps[0].actions.forEach(
    (a) => (a.target = { kind: 'testid', value: 'other-business-object' }),
  );
  assert.throws(() => validateRepair(candidate, p, c, base, failure), code('INVALID_SCHEMA'));
  assert.throws(
    () => validateRepair({ ...patch, value: '香蕉' }, p, c, base, failure),
    code('INVALID_SCHEMA'),
  );
  assert.throws(
    () =>
      validateRepair({ ...patch, action_id: p.steps[0].actions[1].action_id }, p, c, base, failure),
    code('REPAIR_ACTION_MISMATCH'),
  );
});
test('repair only accepts locator resolution failures before dispatch', () => {
  const { c, p, failure, patch } = repairFixture();
  for (const f of [
    { ...failure, code: 'ENOSPC' },
    { ...failure, code: 'TIMEOUT' },
    { ...failure, phase: 'EXECUTE' },
    { ...failure, dispatched: true },
    undefined,
  ])
    assert.throws(() => validateRepair(patch, p, c, base, f), code('REPAIR_NOT_ELIGIBLE'));
});
test('repair requires approved independent anchor and the current locator digest', () => {
  const { c, p, failure, patch } = repairFixture();
  assert.throws(
    () => validateRepair({ ...patch, old_target_hash: '0'.repeat(64) }, p, c, base, failure),
    code('REPAIR_STALE_TARGET'),
  );
  assert.throws(
    () => validateRepair({ ...patch, target: failure.current_target }, p, c, base, failure),
    code('REPAIR_NO_CHANGE'),
  );
  delete p.steps[0].actions[0].repair_anchor;
  assert.throws(() => validateRepair(patch, p, c, base, failure), code('REPAIR_ANCHOR_REQUIRED'));
});
test('repair fingerprint includes every action locator and preserves approval fields', () => {
  const { p } = fixture();
  const changed = structuredClone(p);
  changed.steps[0].actions[0].target.value = 'other';
  assert.notEqual(repairInvariant(p), repairInvariant(changed));
});
test('cleanup actions are excluded from model locator repair', () => {
  const { mc, mutation } = fixture(),
    a = mutation.cleanup.actions[0];
  a.repair_anchor = { kind: 'role', role: 'button', name: '删除', exact: true };
  assert.throws(() => validatePlan(mutation, mc, base), code('CLEANUP_REPAIR_FORBIDDEN'));
});
