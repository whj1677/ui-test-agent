import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkAssertion, checkAssertionGroup } from '../src/browser.mjs';

const table = { kind: 'role', role: 'table', name: '结果', exact: true };
const row = { kind: 'row', table, key: { column: '编号', value: 'R001' } };
const markup = (rows = ['R009']) =>
  `<table aria-label="结果"><thead><tr><th>编号</th><th>名称</th></tr></thead><tbody>${rows.map((id) => `<tr><td>${id}</td><td>设备</td></tr>`).join('')}</tbody></table>`;

for (const scenario of ['missing', 'hidden', 'absent', 'present'])
  test('negative key assertion requires healthy parent scope: ' + scenario, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent(
      scenario === 'missing'
        ? '<h1>加载中</h1>'
        : markup(scenario === 'present' ? ['R001'] : ['R009']),
    );
    if (scenario === 'hidden') await page.locator('table').evaluate((e) => (e.hidden = true));
    for (const check of ['count', 'hidden']) {
      const assertion = { target: row, check, ...(check === 'count' ? { expected: 0 } : {}) };
      if (['missing', 'hidden'].includes(scenario))
        await assert.rejects(checkAssertion(page, assertion, { timeout: 1000 }), (e) =>
          /ROW_NEGATIVE_SCOPE/.test(e.code),
        );
      else {
        const a = await checkAssertion(page, assertion, { timeout: 200 });
        assert.equal(a.passed, scenario === 'absent');
        assert.equal(a.negative_scope.scope, 'complete_current_native_table');
        assert.deepEqual(a.negative_scope.matrix.rows, [
          [scenario === 'present' ? 'R001' : 'R009', '设备'],
        ]);
      }
    }
  });

const invalidPages = {
  duplicate_table: markup() + markup(),
  duplicate_keys: markup(['R009', 'R009']),
  blank_key: markup(['']),
  missing_key_column: markup().replace('<th>编号</th>', '<th>别名</th>'),
  duplicate_column: markup().replace('<th>名称</th>', '<th>编号</th>'),
  hidden_row: markup().replace('<tbody><tr>', '<tbody><tr hidden>'),
  hidden_cell: markup().replace('<td>R009', '<td hidden>R009'),
  merged: markup().replace('<td>R009', '<td colspan="2">R009'),
  virtual: markup().replace('<table ', '<table aria-rowcount="200" '),
  nested: markup().replace('设备</td>', '<table><tr><td>设备</td></tr></table></td>'),
  sample_limit: markup(Array.from({ length: 51 }, (_, i) => 'R' + (100 + i))),
  busy_table: markup([]).replace('<table ', '<table aria-busy="true" '),
  busy_parent: '<section aria-busy="true">' + markup([]) + '</section>',
};
for (const [scenario, html] of Object.entries(invalidPages))
  test('invalid parent matrix never proves keyed absence: ' + scenario, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent(html);
    await assert.rejects(
      checkAssertion(page, { target: row, check: 'count', expected: 0 }, { timeout: 500 }),
      (e) => /ROW_|TABLE_/.test(e.code),
    );
  });

test('empty healthy table is absence; missing cell column is not', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(markup([]));
  const a = await checkAssertion(page, { target: row, check: 'count', expected: 0 });
  assert.equal(a.passed, true);
  assert.deepEqual(a.negative_scope.matrix.rows, []);
  await assert.rejects(
    checkAssertion(page, {
      target: { kind: 'cell', table, key: row.key, column: '不存在的列' },
      check: 'count',
      expected: 0,
    }),
    { code: 'ROW_NEGATIVE_SCOPE_CELL_COLUMN_MISSING' },
  );
});

test('negative target and positive fields share one sample without scope substitution', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(markup());
  const [a, b] = await checkAssertionGroup(page, [
    { target: row, check: 'count', expected: 0 },
    {
      target: { kind: 'cell', table, key: { column: '编号', value: 'R009' }, column: '名称' },
      check: 'text',
      expected: '设备',
    },
  ]);
  assert.equal(a.passed && b.passed, true);
  assert.equal(a.sample_id, b.sample_id);
  assert.equal(a.at, b.at);
  assert.equal(a.negative_scope.key.value, 'R001');
  assert.equal(a.negative_scope.target_kind, 'row');
  assert.equal(a.negative_scope.inner_target, null);
  const child = await checkAssertion(page, {
    target: {
      ...row,
      key: { column: '编号', value: 'R009' },
      target: { kind: 'role', role: 'button', name: '隐藏操作', exact: true },
    },
    check: 'count',
    expected: 0,
  });
  assert.equal(child.passed, true);
  assert.equal(
    child.negative_scope.inner_target.name,
    '隐藏操作',
    'missing child is not a claim the record is absent',
  );
  assert.equal(child.negative_scope.matrix.rows[0][0], 'R009');
});

for (const change of ['remove-parent', 'insert-key'])
  test(
    'parent/key mutation after locator collection cannot give a stale absence pass: ' + change,
    async (t) => {
      const browser = await chromium.launch({ headless: true });
      t.after(() => browser.close());
      const page = await browser.newPage();
      await page.setContent(markup());
      const evaluate = page.evaluate.bind(page);
      let changed = false;
      page.evaluate = async (fn, arg) => {
        if (!changed && arg?.assertions && arg.negativeScopes) {
          changed = true;
          await evaluate((change) => {
            if (change === 'remove-parent') document.querySelector('table').remove();
            else document.querySelector('tbody td').textContent = 'R001';
          }, change);
        }
        return evaluate(fn, arg);
      };
      if (change === 'remove-parent')
        await assert.rejects(
          checkAssertion(page, { target: row, check: 'count', expected: 0 }, { timeout: 600 }),
          { code: 'ROW_NEGATIVE_SCOPE_TABLE_NOT_UNIQUE' },
        );
      else {
        const a = await checkAssertion(
          page,
          { target: row, check: 'count', expected: 0 },
          { timeout: 600 },
        );
        assert.equal(a.passed, false);
        assert.equal(a.actual, 1);
        assert.equal(a.negative_scope.matrix.rows[0][0], 'R001');
      }
      assert.equal(changed, true);
    },
  );
