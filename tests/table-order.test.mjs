import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { validateTableOrder, compareTableOrder } from '../src/table-order.mjs';
import { validateAssertion } from '../src/plans.mjs';
import { checkAssertionGroup } from '../src/browser.mjs';
const expected = {
  field: '功率',
  column: '额定功率',
  direction: 'descending',
  comparison: 'number',
};
const original = {
  action: '将排序选择为 功率降序，点击查询。',
  expected: '应用排序并回第1页；仍显示共12条。',
};
const target = { kind: 'role', role: 'table', name: '设备', exact: true };
const assertion = {
  target,
  check: 'table_order',
  expected,
  oracle_quote: '应用排序并回第1页',
  obligation_ids: ['1-O1'],
};

test('new relation requires current original source and strict schema', () => {
  validateAssertion(assertion, {
    ...original,
    obligations: [{ id: '1-O1', text: original.expected }],
  });
  validateTableOrder(expected, { expected: '表格按功率降序排列', quote: '表格按功率降序排列' });
  validateTableOrder(expected, { ...original, quote: original.expected });
  for (const bad of [
    { ...expected, rows: [] },
    { ...expected, direction: 'desc' },
    { ...expected, comparison: 'locale' },
    { ...expected, field: '' },
  ])
    assert.throws(() => validateTableOrder(bad), { code: 'TABLE_ORDER_SCHEMA_INVALID' });
});
for (const [description, source] of [
  ['different direction', { expected: '表格按功率升序', quote: '表格按功率升序' }],
  ['control only', { expected: '排序控件显示功率降序', quote: '功率降序' }],
  ['cut negation', { expected: '不要求功率降序', quote: '功率降序' }],
  ['conditional', { expected: '如果功率降序，才检查', quote: '功率降序' }],
  ['alternative', { expected: '功率降序或编号升序', quote: '功率降序' }],
  ['wrong field suffix', { expected: '最大功率降序', quote: '最大功率降序' }],
  [
    'input only',
    { ...original, action: '仅将排序选择为功率降序，不点击查询', quote: '应用排序并回第1页' },
  ],
  ['no action source', { expected: original.expected, quote: '应用排序并回第1页' }],
  ['other step not source', { expected: '回第1页', quote: '应用排序', action: original.action }],
])
  test('reject source: ' + description, () => {
    assert.throws(() => validateTableOrder(expected, source), {
      code: 'TABLE_ORDER_SOURCE_REQUIRED',
    });
  });
const matrix = (values, headers = ['编号', '额定功率']) => ({
  headers,
  rows: values.map((v, i) => ['X00' + (i + 1), v]),
});
test('full current column, ties accepted, middle inversion caught', () => {
  const good = compareTableOrder(matrix(['300 kW', '220 kW', '220 kW']), expected);
  assert.equal(good.passed, true);
  assert.equal(good.scope, 'current_visible_page');
  assert.equal(good.unit_verified, false);
  const bad = compareTableOrder(matrix(['300 kW', '140 kW', '220 kW']), expected);
  assert.equal(bad.invalid, false);
  assert.equal(bad.passed, false);
  assert.deepEqual(bad.differences[0].positions, [2, 3]);
});
for (const [name, actual, error] of [
  ['mixed unit', matrix(['1 MW', '900 kW']), 'TABLE_ORDER_VALUES_UNSUPPORTED'],
  ['unparseable', matrix(['300 kW', '未知']), 'TABLE_ORDER_VALUES_UNSUPPORTED'],
  [
    'unsafe precision',
    matrix(['9007199254740992', '9007199254740993']),
    'TABLE_ORDER_VALUES_UNSUPPORTED',
  ],
  [
    'fraction precision',
    matrix(['0.10000000000000000001', '0.10000000000000000002']),
    'TABLE_ORDER_VALUES_UNSUPPORTED',
  ],
  ['underflow', matrix(['1e-999', '2e-999']), 'TABLE_ORDER_VALUES_UNSUPPORTED'],
  ['single', matrix(['300 kW']), 'TABLE_ORDER_INSUFFICIENT_ROWS'],
  ['empty', matrix([]), 'TABLE_ORDER_INSUFFICIENT_ROWS'],
  [
    'duplicate header',
    matrix(['3', '2'], ['额定功率', '额定功率']),
    'TABLE_ORDER_COLUMN_AMBIGUOUS',
  ],
  [
    'ambiguous suffix',
    matrix(['3', '2'], ['最大功率', '额定功率']),
    'TABLE_ORDER_COLUMN_AMBIGUOUS',
  ],
  ['wrong header', matrix(['3', '2'], ['编号', '温度']), 'TABLE_ORDER_COLUMN_AMBIGUOUS'],
])
  test('technical unsupported: ' + name, () => {
    const r = compareTableOrder(actual, expected);
    assert.equal(r.invalid, true);
    assert.equal(r.error, error);
    assert.equal(r.passed, false);
  });
test('exact field header beats suffix; cannot choose another power column', () => {
  const actual = {
    headers: ['功率', '最大功率'],
    rows: [
      ['3', '9'],
      ['2', '8'],
    ],
  };
  assert.equal(compareTableOrder(actual, { ...expected, column: '功率' }).passed, true);
  assert.equal(compareTableOrder(actual, { ...expected, column: '最大功率' }).invalid, true);
});
test('fixed-width identifiers without numeric overflow, no guessed collation', () => {
  const e = { field: '编号', column: '编号', direction: 'ascending', comparison: 'identifier' };
  const m = (values) => ({ headers: ['编号'], rows: values.map((v) => [v]) });
  assert.equal(compareTableOrder(m(['H101', 'H102', 'H103']), e).passed, true);
  assert.equal(compareTableOrder(m(['H101', 'H103', 'H102']), e).passed, false);
  assert.equal(
    compareTableOrder(m(['H100000000000000000001', 'H100000000000000000002']), e).passed,
    true,
  );
  for (const values of [
    ['H1', 'H02'],
    ['A001', 'B002'],
    ['001', '002'],
  ])
    assert.equal(compareTableOrder(m(values), e).invalid, true);
});
test('browser measures one native matrix and does not poll an inversion into a pass', async (t) => {
  const b = await chromium.launch({ headless: true });
  t.after(() => b.close());
  const p = await b.newPage();
  await p.setContent(
    '<table aria-label="设备"><thead><tr><th>编号</th><th>额定功率</th></tr></thead><tbody><tr><td>X001</td><td>100 kW</td></tr><tr><td>X002</td><td>300 kW</td></tr></tbody></table>',
  );
  // First actual sample schedules a later DOM "repair"; retrying would hide the defect.
  await p.evaluate(() => {
    const table = document.querySelector('table');
    const getter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText').get;
    window.sampleReads = 0;
    for (const c of table.querySelectorAll('td,th'))
      Object.defineProperty(c, 'innerText', {
        get() {
          window.sampleReads++;
          if (window.sampleReads === 1)
            setTimeout(() => {
              const cells = table.querySelectorAll('tbody tr td:last-child');
              cells[0].textContent = '300 kW';
              cells[1].textContent = '100 kW';
            }, 100);
          return getter.call(this);
        },
      });
  });
  const r = (await checkAssertionGroup(p, [assertion], { timeout: 3000 }))[0];
  assert.equal(r.passed, false);
  assert.deepEqual(r.table_comparison.values, [100, 300]);
  assert.equal(await p.evaluate(() => window.sampleReads), 6);
  assert.deepEqual(r.actual.rows[0], ['X001', '100 kW']);
});
test('merged/virtual table cannot produce ordering proof', async (t) => {
  const b = await chromium.launch({ headless: true });
  t.after(() => b.close());
  const p = await b.newPage();
  await p.setContent(
    '<table aria-label="设备" aria-rowcount="100"><thead><tr><th>编号</th><th>额定功率</th></tr></thead><tbody><tr><td>X001</td><td>3</td></tr><tr><td>X002</td><td>2</td></tr></tbody></table>',
  );
  await assert.rejects(checkAssertionGroup(p, [assertion], { timeout: 1000 }), {
    code: 'TABLE_STRUCTURE_UNSUPPORTED',
  });
});
