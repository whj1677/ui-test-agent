import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptivePlan, validateAdaptiveFragment } from '../src/adaptive-plan.mjs';
import { requireRowEvidence, wholeRowTarget, ROW_EVIDENCE_GUIDANCE } from '../src/row-evidence.mjs';
import { assertionEvidenceBinding } from '../src/assertion-evidence.mjs';
import { ADAPTIVE_NEXT_PROMPT } from '../src/adaptive-plan.mjs';
import { ADAPTIVE_REVIEW_REFERENCES } from '../src/adaptive-review.mjs';
import { requireAdaptiveAssertionTargets } from '../src/adaptive-execution.mjs';
import { chromium } from 'playwright';
const original = {
  case_id: 'ROW',
  steps: [
    {
      step_id: '1',
      action: '观察Z019记录',
      expected: 'Z019名称箱体，园区西园，状态运行，功率200',
      obligations: [{ id: '1-O1', text: 'Z019名称箱体，园区西园，状态运行，功率200' }],
    },
  ],
};
const table = { kind: 'role', role: 'table', name: '结果', exact: true };
const row = { kind: 'row', table, key: { column: '编号', value: 'Z019' } };
const plan = createAdaptivePlan(original, '/');
const candidate = (check, complete) => ({
  actions: [],
  assertions: [
    {
      target: row,
      check,
      expected: 'Z019 箱体 西园 运行 200 kW 详情',
      oracle_quote: original.steps[0].expected,
      obligation_ids: ['1-O1'],
    },
  ],
  complete,
  within_ms: 1000,
  reason: '错误地照抄整行摘要',
});
for (const [check, complete] of [
  ['text', true],
  ['text', false],
  ['contains', true],
])
  test('copied whole-row text is rejected before execution: ' + check + '/' + complete, () => {
    assert.throws(
      () =>
        validateAdaptiveFragment(candidate(check, complete), {
          c: original,
          plan,
          step: plan.steps[0],
          previous: [],
          base: 'http://127.0.0.1/',
        }),
      { code: 'ASSERTION_ROW_FIELD_REQUIRED' },
    );
  });

const a = { ...candidate('text', true).assertions[0] };
const source = (text) => ({ expected: text, obligations: [{ id: '1-O1', text }] });
for (const target of [
  row,
  { kind: 'role', role: 'row', name: 'Z019 箱体', exact: true },
  { kind: 'within', scope: { role: 'region', name: '结果', exact: true }, target: row },
])
  test('whole row syntax does not bind a business field ' + JSON.stringify(target), () => {
    assert.equal(wholeRowTarget(target), true);
    assert.throws(() => requireRowEvidence({ ...a, target }, original.steps[0]), {
      code: 'ASSERTION_ROW_FIELD_REQUIRED',
    });
    const d = assertionEvidenceBinding({ ...a, target });
    assert.equal(d.kind, 'whole_table_row');
    assert.equal(d.field_value_proof, false);
    assert.equal(d.runtime_verified, false);
  });
for (const target of [
  { kind: 'cell', table, key: row.key, column: '名称' },
  { ...row, target: { kind: 'role', role: 'button', name: '详情', exact: true } },
  { kind: 'role', role: 'heading', name: '名称', exact: true },
])
  test('a field or child target is not a whole row ' + target.kind, () =>
    assert.doesNotThrow(() => requireRowEvidence({ ...a, target }, original.steps[0])),
  );
for (const check of ['visible', 'hidden', 'count'])
  test('row existence is not a scalar field predicate ' + check, () =>
    assert.doesNotThrow(() => requireRowEvidence({ ...a, check }, original.steps[0])),
  );
for (const [text, check] of [
  ['整行文本为“Z019 箱体”', 'text'],
  ['整行内容包含“箱体”', 'contains'],
  ['整行文本必须等于“状态不通过”', 'text'],
])
  test('preserve explicit original literal ' + text, () => {
    const expected = /“([^”]+)”/u.exec(text)[1];
    assert.doesNotThrow(() => requireRowEvidence({ ...a, check, expected }, source(text)));
  });
for (const text of [
  '如果整行文本为“Z019 箱体”',
  '不要求整行文本为“Z019 箱体”',
  '例如整行文本为“Z019 箱体”',
  '整行文本为“Z019 箱体”仅为示例',
  '整行文本为“Z019 箱体”或者其他内容',
  '名称为Z019 箱体',
  '整行文本为Z019 箱体',
])
  test('no inferred literal intent ' + text, () =>
    assert.throws(() => requireRowEvidence({ ...a, expected: 'Z019 箱体' }, source(text)), {
      code: 'ASSERTION_ROW_FIELD_REQUIRED',
    }),
  );
test('literal from another obligation, another value or different predicate cannot authorize aggregate field proof', () => {
  const s = source('整行文本为“Z019 箱体”');
  for (const extra of [
    { obligation_ids: ['OTHER'] },
    { expected: 'Z019 箱体 200' },
    { check: 'contains' },
    { check: 'number', expected: 200 },
  ])
    assert.throws(() => requireRowEvidence({ ...a, expected: 'Z019 箱体', ...extra }, s), {
      code: 'ASSERTION_ROW_FIELD_REQUIRED',
    });
});
test('pure checks do not normalize the original or rewrite candidate; guidance shared', () => {
  const s = source('整行文本为“Z019 箱体”'),
    b = { ...a, expected: 'Z019 箱体' },
    before = structuredClone({ s, b });
  requireRowEvidence(b, s);
  assert.deepEqual({ s, b }, before);
  assert.ok(ADAPTIVE_NEXT_PROMPT.includes(ROW_EVIDENCE_GUIDANCE));
  assert.ok(ADAPTIVE_REVIEW_REFERENCES.includes(ROW_EVIDENCE_GUIDANCE));
});
test('actual native/ARIA rows reject CSS aliases before dispatch; cells and absent future targets remain distinct', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(
    '<table><tbody><tr id="native"><td id="field">Z019</td><td>箱体</td></tr></tbody></table><div role="row" id="aria">Z019 箱体</div>',
  );
  for (const id of ['native', 'aria'])
    await assert.rejects(
      requireAdaptiveAssertionTargets(
        page,
        { assertions: [{ ...a, target: { kind: 'css', value: '#' + id } }] },
        original.steps[0],
      ),
      { code: 'ASSERTION_ROW_FIELD_REQUIRED' },
    );
  await requireAdaptiveAssertionTargets(
    page,
    { assertions: [{ ...a, target: { kind: 'css', value: '#field' } }] },
    original.steps[0],
  );
  await requireAdaptiveAssertionTargets(
    page,
    { assertions: [{ ...a, target: { kind: 'css', value: '#not-yet-present' } }] },
    original.steps[0],
  );
  // The explicit literal is only admitted to the original comparator, not
  // declared equal here; execution still measures the actual separators.
  await requireAdaptiveAssertionTargets(
    page,
    { assertions: [{ ...a, target: { kind: 'css', value: '#native' }, expected: 'Z019 箱体' }] },
    source('整行文本为“Z019 箱体”'),
  );
});
