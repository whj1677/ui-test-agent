import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { captureTableBaselines, needsTableBaseline } from '../src/table-invariant.mjs';
import { BrowserSession, checkAssertionGroup } from '../src/browser.mjs';
import { validateAssertion } from '../src/plans.mjs';
import { StepBudget } from '../src/step-budget.mjs';
import { Store } from '../src/store.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

// Intercepted synthetic DOM only: no real model, active lab, credentials or services.
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});
const target = { kind: 'testid', value: 'matrix' };
const tableContext = { run_id: 'run-invariant', step_id: 'S2' };
const relation = '尚未点击查询前表格不应用新条件';
const original = {
  step_id: 'S2',
  action: '填写关键词并选择园区、状态。',
  expected: '三个条件均已按输入设置；' + relation + '。',
  obligations: [
    { id: 'S2-O1', text: '三个条件均已按输入设置' },
    { id: 'S2-O2', text: relation },
  ],
};
const invariant = {
  target,
  check: 'table_unchanged',
  oracle_quote: relation,
  obligation_ids: ['S2-O2'],
};
const current = { controls: [{ role: 'table', locator: target }] };
const headers = ['编号', '名称', '园区', '状态', '额定功率'];
const rows = [
  ['D001', '储能柜', '北园', '运行', '100'],
  ['D002', '冷却泵', '北园', '待机', '80'],
  ['D003', '充电桩', '南园', '运行', '60'],
  ['D004', '逆变器', '北园', '告警', '150'],
  ['D005', '空调机', '南园', '待机', '40'],
];
const html = `<!doctype html><meta charset="utf-8"><h1>合成资产</h1>
  <label>关键词<input data-testid="keyword"></label>
  <label>园区<select data-testid="park"><option>全部</option><option>南园</option></select></label>
  <label>状态<select data-testid="state"><option>全部</option><option>运行</option></select></label>
  <table data-testid="matrix"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

async function fixture(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  const page = await context.newPage();
  await page.goto('http://table-invariant.test/assets?view=one#results');
  return {
    page,
    capture: (observation = current, scope = tableContext) =>
      captureTableBaselines(page, observation, scope),
  };
}
async function observe(page, tableBaselines, options = {}) {
  return (
    await checkAssertionGroup(page, [invariant], {
      timeout: 1000,
      tableBaselines,
      tableContext,
      ...options,
    })
  )[0];
}

test('relation matcher authorizes only explicit table/list invariance, not fixed-reference equality or its negation', () => {
  for (const text of [relation, '列表保持不变。', '表格保持原样', 'The table is unchanged.'])
    assert.equal(needsTableBaseline(text), true, text);
  for (const text of [
    undefined,
    '字段保持不变',
    '表格与标准表相同',
    '列表与业务数据一致',
    '表格保持一致',
    '表格无需保持不变',
    '表格不应保持原样',
    '表格不是不变',
    '表格不保持不变',
    '表格不变不成立',
    'The table is not unchanged.',
    'The table need not be unchanged.',
  ])
    assert.equal(needsTableBaseline(text), false, text);
});

test('assertion schema needs sourced relationship and accepts only omitted/true expected', () => {
  validateAssertion(invariant, original);
  validateAssertion({ ...invariant, expected: true }, original);
  for (const expected of [false, null, 'unchanged', rows])
    assert.throws(() => validateAssertion({ ...invariant, expected }, original), {
      code: 'ASSERTION_BOOL_INVALID',
    });
  assert.throws(() => validateAssertion(invariant), { code: 'TABLE_INVARIANT_SOURCE_REQUIRED' });
  assert.throws(() => validateAssertion(invariant, { ...original, expected: '表格与标准表相同' }), {
    code: 'TABLE_INVARIANT_SOURCE_REQUIRED',
  });
  assert.throws(
    () =>
      validateAssertion(
        { ...invariant, oracle_quote: '三个条件均已按输入设置', obligation_ids: ['S2-O1'] },
        original,
      ),
    { code: 'TABLE_INVARIANT_SOURCE_REQUIRED' },
  );
  assert.throws(() => validateAssertion({ ...invariant, baseline: rows }, original));
  // Existing fixed-assertion behavior remains independent of relation support.
  validateAssertion(
    { target, check: 'text', expected: '固定值', oracle_quote: '固定值', obligation_ids: ['O'] },
    { expected: '固定值', obligations: [{ id: 'O', text: '固定值' }] },
  );
});

test('unchanged 5x5 passes, observed locator duplicates deduplicate, raw baseline and full URL are not serializable', async (t) => {
  const { page, capture } = await fixture(t);
  const token = await capture({ controls: [...current.controls, ...current.controls] });
  assert.equal(token.tables.length, 1);
  assert.ok(Object.isFrozen(token));
  assert.doesNotMatch(JSON.stringify(token), /D001|储能柜|view=one|#results/);
  const actual = await observe(page, token);
  assert.equal(actual.passed, true);
  assert.equal(actual.table_comparison.checked_cells, 25);
  assert.deepEqual(actual.table_comparison.before, { headers, rows });
  assert.equal(actual.table_comparison.scope, 'sampled_after_each_action');
  assert.ok(actual.sample_id);
});

const changes = [
  [
    'same-count replacement',
    () => {
      document.querySelector('tbody tr:nth-child(3) td').textContent = 'D099';
    },
  ],
  [
    'middle field',
    () => {
      document.querySelector('tbody tr:nth-child(3) td:nth-child(5)').textContent = '61';
    },
  ],
  [
    'row order',
    () => {
      const b = document.querySelector('tbody');
      b.prepend(b.lastElementChild);
    },
  ],
  [
    'column order',
    () => {
      for (const r of document.querySelectorAll('tr')) r.prepend(r.lastElementChild);
    },
  ],
  [
    'additional column',
    () => {
      for (const r of document.querySelectorAll('tr'))
        r.insertAdjacentHTML(
          'beforeend',
          r.parentElement.tagName === 'THEAD' ? '<th>附加列</th>' : '<td>额外</td>',
        );
    },
  ],
  [
    'removed column',
    () => {
      for (const r of document.querySelectorAll('tr')) r.lastElementChild.remove();
    },
  ],
  [
    'removed row',
    () => {
      document.querySelector('tbody tr').remove();
    },
  ],
  [
    'numeric display differs',
    () => {
      document.querySelector('tbody td:last-child').textContent = '100 kW';
    },
  ],
];
for (const [name, change] of changes)
  test(`${name} is a reported business difference, never an eventual-match retry`, async (t) => {
    const { page, capture } = await fixture(t),
      token = await capture();
    await page.evaluate(change);
    const observation = await observe(page, token);
    assert.equal(observation.passed, false);
    assert.equal(observation.table_comparison.invalid, false);
    assert.ok(observation.table_comparison.differences.length);
    // Resetting the DOM cannot erase a mismatch already observed in this step.
    await page.setContent(html);
    assert.equal((await observe(page, token)).passed, false);
  });

const unsupported = [
  [
    'hidden row',
    () => {
      document.querySelector('tbody tr:nth-child(3)').style.display = 'none';
    },
  ],
  [
    'hidden field',
    () => {
      document.querySelector('tbody td').style.visibility = 'hidden';
    },
  ],
  [
    'aria-hidden row',
    () => {
      document.querySelector('tbody tr').setAttribute('aria-hidden', 'true');
    },
  ],
  [
    'inert row',
    () => {
      document.querySelector('tbody tr').inert = true;
    },
  ],
  [
    'transparent table',
    () => {
      document.querySelector('table').style.opacity = '0';
    },
  ],
  [
    'virtual rows',
    () => {
      document.querySelector('table').setAttribute('aria-rowcount', '50');
    },
  ],
  [
    'virtual columns',
    () => {
      document.querySelector('td').setAttribute('aria-colindex', '8');
    },
  ],
  [
    'merged cells',
    () => {
      document.querySelector('td').colSpan = 2;
    },
  ],
  [
    'nested table',
    () => {
      document.querySelector('td').innerHTML =
        '<table><tbody><tr><td>nested</td></tr></tbody></table>';
    },
  ],
  [
    'missing cell',
    () => {
      document.querySelector('td').remove();
    },
  ],
];
for (const [name, change] of unsupported)
  test(`${name} is technical invalid both at capture and comparison`, async (t) => {
    const { page, capture } = await fixture(t),
      token = await capture();
    await page.evaluate(change);
    await assert.rejects(capture(), { code: 'TABLE_STRUCTURE_UNSUPPORTED' });
    await assert.rejects(observe(page, token), { code: 'TABLE_STRUCTURE_UNSUPPORTED' });
  });

test('duplicate columns and oversized full matrices are rejected without truncation', async (t) => {
  const { page, capture } = await fixture(t);
  await page.evaluate(() => {
    document.querySelector('th:nth-child(2)').textContent = '编号';
  });
  await assert.rejects(capture(), { code: 'TABLE_COLUMN_IDENTITY_INVALID' });
  await page.setContent(html);
  await page.evaluate(() => {
    const b = document.querySelector('tbody');
    while (b.rows.length < 41) b.append(b.rows[0].cloneNode(true));
  });
  await assert.rejects(capture(), { code: 'TABLE_SAMPLE_LIMIT' });
});

test('capture requires exactly one observed native table with a unique locator', async (t) => {
  const { page, capture } = await fixture(t);
  await assert.rejects(capture({ controls: [] }), { code: 'TABLE_BASELINE_TABLE_REQUIRED' });
  await assert.rejects(
    capture({
      controls: [
        ...current.controls,
        { role: 'table', locator: { kind: 'testid', value: 'other' } },
      ],
    }),
    { code: 'TABLE_BASELINE_TABLE_NOT_UNIQUE' },
  );
  await page.evaluate(() => document.body.append(document.querySelector('table').cloneNode(true)));
  await assert.rejects(capture(), { code: 'TABLE_BASELINE_TABLE_NOT_UNIQUE' });
});

test('missing/forged baseline, wrong run/step/page/locator or missing context cannot pass', async (t) => {
  const { page, capture } = await fixture(t),
    token = await capture();
  await assert.rejects(observe(page), { code: 'TABLE_BASELINE_REQUIRED' });
  await assert.rejects(observe(page, structuredClone(token)), { code: 'TABLE_BASELINE_REQUIRED' });
  await assert.rejects(observe(page, token, { tableContext: undefined }), {
    code: 'TABLE_BASELINE_SCOPE_REQUIRED',
  });
  for (const scope of [
    { ...tableContext, run_id: 'other' },
    { ...tableContext, step_id: 'S3' },
  ])
    await assert.rejects(observe(page, token, { tableContext: scope }), {
      code: 'TABLE_BASELINE_SCOPE_MISMATCH',
    });
  const other = await fixture(t);
  await assert.rejects(observe(other.page, token), { code: 'TABLE_BASELINE_SCOPE_MISMATCH' });
  await assert.rejects(
    checkAssertionGroup(page, [{ ...invariant, target: { kind: 'css', value: '#different' } }], {
      tableBaselines: token,
      tableContext,
    }),
    { code: 'TABLE_BASELINE_LOCATOR_MISMATCH' },
  );
});

for (const suffix of ['?view=two#results', '?view=one#other'])
  test(`full URL mismatch ${suffix} is technical invalid`, async (t) => {
    const { page, capture } = await fixture(t),
      token = await capture();
    await page.evaluate((suffix) => history.replaceState(null, '', '/assets' + suffix), suffix);
    await assert.rejects(observe(page, token), { code: 'TABLE_BASELINE_URL_CHANGED' });
  });

test('an empty native table can remain empty, adding a row fails', async (t) => {
  const { page, capture } = await fixture(t);
  await page.evaluate(() => {
    document.querySelector('tbody').innerHTML = '';
  });
  const token = await capture();
  assert.equal((await observe(page, token)).passed, true);
  await page.evaluate(() => {
    document.querySelector('tbody').innerHTML =
      '<tr><td>D001</td><td>x</td><td>x</td><td>x</td><td>x</td></tr>';
  });
  assert.equal((await observe(page, token)).passed, false);
});

test('comparison is raw but evidence matrices/differences are redacted', async (t) => {
  const { page, capture } = await fixture(t);
  await page.evaluate(() => {
    document.querySelector('td').textContent = 'token=synthetic-before';
  });
  const token = await capture();
  await page.evaluate(() => {
    document.querySelector('td').textContent = 'token=synthetic-after';
  });
  const result = await observe(page, token);
  assert.equal(result.passed, false);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-before|synthetic-after/);
  assert.match(JSON.stringify(result), /REDACTED/);
});

function actionRun(page, tableBaselines, actions) {
  const point = { checkpoint_id: 'C2', actions, assertions: [invariant], within_ms: 1000 };
  const step = {
    step_id: 'S2',
    source_action: original.action,
    source_expected: original.expected,
    timeout_ms: 5000,
    checkpoints: [point],
  };
  return {
    page,
    tableBaselines,
    step,
    stepIndex: 1,
    point,
    budget: new StepBudget(5000),
    task: { target: page.url() },
    plan: { data_effect: 'read_only' },
    c: { steps: [original] },
    result: {
      id: tableContext.run_id,
      actions: [],
      assertions: [],
      media: [],
      checkpoints: [{ step_id: 'S2', checkpoint_id: 'C2' }],
    },
    recording: {
      beginStep: async () => {},
      beginCheckpoint: async () => {},
      beforeAction: async () => {},
      observed: async () => {},
    },
    guard: { dirty: false, blocked: null },
    emit: async () => {},
    setPhase: () => {},
  };
}
const fill = (id, value) => ({
  action_id: id,
  op: 'fill',
  target: { kind: 'testid', value: 'keyword' },
  value,
});

test('real fill/select actions each record sourced invariant evidence without changing the baseline', async (t) => {
  const { page, capture } = await fixture(t),
    token = await capture();
  const run = actionRun(page, token, [
    fill('A1', '储能柜'),
    { action_id: 'A2', op: 'select', target: { kind: 'testid', value: 'park' }, value: '南园' },
    { action_id: 'A3', op: 'select', target: { kind: 'testid', value: 'state' }, value: '运行' },
  ]);
  await new BrowserSession().executeActions(run);
  assert.equal(run.result.actions.length, 3);
  assert.equal(
    run.result.assertions.length,
    0,
    'automatic guards are not declared plan assertions',
  );
  assert.equal(run.result.relational_observations.length, 3);
  for (const [index, a] of run.result.relational_observations.entries()) {
    assert.equal(a.passed, true);
    assert.equal(a.action_id, 'A' + (index + 1));
    assert.equal(a.oracle_quote, relation);
    assert.deepEqual(a.obligation_ids, ['S2-O2']);
    assert.equal(a.scope, 'sampled_after_each_action');
    assert.match(a.message, /操作前一致/);
    assert.equal(a.table_comparison.baseline_at, token.captured_at);
  }
});

test('executeStep stops on first changed action; the second action that would restore the table is never dispatched', async (t) => {
  const { page, capture } = await fixture(t),
    token = await capture();
  await page.evaluate(() => {
    window.inputCalls = 0;
    document.querySelector('input').oninput = () => {
      window.inputCalls++;
      document.querySelector('tbody tr:nth-child(3) td:nth-child(5)').textContent =
        window.inputCalls === 1 ? '999' : '60';
    };
  });
  const run = actionRun(page, token, [fill('A1', '改变'), fill('A2', '恢复')]);
  await assert.rejects(new BrowserSession().executeStep(run), {
    code: 'BUSINESS_ASSERTION_FAILED',
  });
  assert.equal(await page.evaluate(() => window.inputCalls), 1);
  assert.equal(run.result.actions.length, 1);
  assert.equal(run.result.actions[0].dispatched, true);
  assert.equal(run.result.assertions.length, 0);
  assert.equal(run.result.relational_observations[0].passed, false);
  assert.match(run.result.relational_observations[0].message, /操作前不一致/);
  assert.equal(run.result.relational_observations[0].table_comparison.differences[0].row_index, 2);
  assert.equal(run.result.checkpoints[0].status, 'FAIL_ASSERTION');
});

test('executeStep rejects a baseline from another original step before any interaction', async (t) => {
  const { page, capture } = await fixture(t);
  const token = await capture(current, { ...tableContext, step_id: 'S1' });
  const run = actionRun(page, token, [fill('A1', '不应执行')]);
  await assert.rejects(new BrowserSession().executeStep(run), {
    code: 'TABLE_BASELINE_SCOPE_MISMATCH',
  });
  assert.equal(run.result.actions.length, 0);
  assert.equal(await page.locator('input').inputValue(), '');
});

test('executeStep rejects a missing baseline before dispatch of a declared relation assertion', async (t) => {
  const { page } = await fixture(t);
  const run = actionRun(page, undefined, [fill('A1', '不应执行')]);
  await assert.rejects(new BrowserSession().executeStep(run), { code: 'TABLE_BASELINE_REQUIRED' });
  assert.equal(run.result.actions.length, 0);
  assert.equal(await page.locator('input').inputValue(), '');
});

test('executionProjection preserves independent relational failure without counting it as a planned assertion or technical error', async (t) => {
  const directory = path.resolve('synthetic-invariant-projection-not-created');
  const readdir = fs.readdir;
  t.mock.method(fs, 'readdir', async (location, ...args) =>
    location === path.join(directory, 'runs') ? [] : readdir(location, ...args),
  );
  const fact = {
    id: 'attempt',
    case_id: 'C',
    status: 'FAIL_ASSERTION',
    business_status: 'ASSERTION_MISMATCH',
    error: 'BUSINESS_ASSERTION_FAILED',
    assertions: [],
    checkpoints: [{ checkpoint_id: 'C2', assertion_count: 0, status: 'FAIL_ASSERTION' }],
    relational_observations: [
      {
        ...invariant,
        step_id: 'S2',
        action_id: 'A1',
        passed: false,
        scope: 'sampled_after_each_action',
      },
    ],
  };
  const state = {
    cases: [{ case_id: 'C', status: 'FAIL_ASSERTION', attempts: [{ id: 'attempt' }] }],
  };
  const injected = {
    baseline: async () => ({ cases: [{ case_id: 'C' }] }),
    facts: async () => fact,
    dir: () => directory,
  };
  const projection = await Store.prototype.executionProjection.call(injected, 'task', state);
  assert.deepEqual(projection.issues, []);
  assert.equal(projection.counts.pass, 0);
  assert.equal(projection.counts.fail, 1);
  assert.equal(projection.counts.technical_failed, 0);
  assert.deepEqual(
    projection.cases[0].latest.relational_observations,
    fact.relational_observations,
  );
  // The current store does not itself enforce assertion_count; keep the evidence
  // contract honest rather than relying on a projection validation error.
  fact.assertions.push(fact.relational_observations[0]);
  assert.deepEqual(
    (await Store.prototype.executionProjection.call(injected, 'task', state)).issues,
    [],
  );
});
