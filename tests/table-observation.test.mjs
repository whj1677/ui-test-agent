import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkAssertionGroup } from '../src/browser.mjs';
import { validatePlan, caseHash } from '../src/plans.mjs';

// Synthetic DOM only: no model, HTTP server, user browser profile or external requests.
const target = { kind: 'testid', value: 'matrix' };
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});

function fixture() {
  const expected = {
    key_column: '编号',
    ordered: true,
    exact_rows: true,
    rows: Array.from({ length: 5 }, (_, r) => ({
      key: `D00${r + 1}`,
      cells: Array.from({ length: 5 }, (_, c) => ({
        column: `字段${c + 1}`,
        check: 'number',
        expected: (r + 1) * 100 + c + 1,
      })),
    })),
  };
  const expectedText =
    'D001至D005按编号顺序显示全部字段且无额外行：' +
    expected.rows
      .map(
        (row) =>
          `${row.key} ${row.cells.map((cell) => `${cell.column}=${cell.expected} kWh`).join('；')}`,
      )
      .join('；');
  const assertion = {
    target,
    check: 'table_cells',
    expected,
    oracle_quote: expectedText,
    obligation_ids: ['S1-O1'],
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:16px sans-serif}table{border-collapse:collapse}th,td{border:1px solid;padding:8px}
    </style></head><body><h1>合成矩阵</h1><p data-testid="phase">READY</p>
    <div id="wrapper"><table data-testid="matrix"><thead><tr><th>编号</th>${expected.rows[0].cells.map((cell) => `<th>${cell.column}</th>`).join('')}</tr></thead>
    <tbody>${expected.rows.map((row) => `<tr><td>${row.key}</td>${row.cells.map((cell) => `<td>${cell.expected} kWh</td>`).join('')}</tr>`).join('')}</tbody></table></div></body></html>`;
  return { expected, expectedText, assertion, html };
}

function planFixture(version = 'v2', source = 'expected') {
  const f = fixture();
  const text =
    source === 'expected'
      ? f.expectedText
      : 'D001至D005按编号顺序显示，全部字段等于用例测试数据且无额外行。';
  const original = {
    case_id: 'TABLE-ATOMIC-001',
    title: '独立合成矩阵',
    source_side: 'ui',
    steps: [
      {
        step_id: 'S1',
        action: '读取合成表格',
        expected: text,
        obligations: [{ id: 'S1-O1', text }],
      },
    ],
  };
  if (source !== 'expected') original[source] = structuredClone(f.expected.rows);
  const assertion = { ...f.assertion, oracle_quote: text };
  const actions = [{ action_id: 'S1-A1', op: 'wait', target, state: 'visible' }];
  const common = { step_id: 'S1', source_action: original.steps[0].action, source_expected: text };
  const step =
    version === 'v2'
      ? {
          ...common,
          assertion_mode: 'simultaneous',
          actions,
          assertions: [assertion],
          within_ms: 1000,
        }
      : {
          ...common,
          assertion_mode: 'sequential_checkpoints',
          timeout_ms: 2000,
          checkpoints: [
            { checkpoint_id: 'S1-C1', actions, assertions: [assertion], within_ms: 1000 },
          ],
        };
  const plan = {
    schema_version: `ui-agent-plan/${version}`,
    case_id: original.case_id,
    case_hash: caseHash(original),
    entry_path: '/synthetic-table',
    data_effect: 'read_only',
    preconditions: [],
    steps: [step],
    cleanup: null,
  };
  return { ...f, original, plan, assertion };
}

async function pageFor(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route('**/*', (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  const f = fixture();
  await page.setContent(f.html);
  return { ...f, page };
}

for (const version of ['v2', 'v3']) {
  for (const source of ['expected', 'data', 'test_data']) {
    test(`${version} accepts one 25-cell matrix grounded in case.${source}`, () => {
      const { plan, original } = planFixture(version, source);
      assert.equal(validatePlan(plan, original, 'http://synthetic.invalid'), plan);
    });
  }
}

test('plan rejects an invented middle field even when its oracle quote is authentic', () => {
  const { plan, original, assertion } = planFixture();
  assertion.expected.rows[2].cells[2].expected = 987654;
  assert.throws(() => validatePlan(plan, original, 'http://synthetic.invalid'), {
    code: 'TABLE_SOURCE_UNGROUNDED',
    path: 'expected.rows[2].cells[2].expected',
  });
});

test('Chromium normal 5x5 matrix measures all 25 cells and shares the group sample', async (t) => {
  const { page, assertion, expected } = await pageFor(t);
  const observations = await checkAssertionGroup(
    page,
    [assertion, { target: { kind: 'testid', value: 'phase' }, check: 'text', expected: 'READY' }],
    { timeout: 1500 },
  );
  assert.equal(observations.length, 2);
  assert.ok(
    observations.every((o) => o.passed && o.group_passed && o.window_observed && !o.timed_out),
  );
  assert.equal(observations[0].sample_id, observations[1].sample_id);
  assert.equal(observations[0].at, observations[1].at);
  assert.equal(observations[0].mode, 'simultaneous');
  assert.deepEqual(observations[0].actual.headers, [
    '编号',
    '字段1',
    '字段2',
    '字段3',
    '字段4',
    '字段5',
  ]);
  assert.deepEqual(
    observations[0].actual.rows,
    expected.rows.map((row) => [row.key, ...row.cells.map((cell) => `${cell.expected} kWh`)]),
  );
  assert.deepEqual(observations[0].table_comparison, {
    passed: true,
    invalid: false,
    differences: [],
    checked_cells: 25,
  });
});

test('Chromium wrong middle row gives the exact D003/字段3 difference', async (t) => {
  const { page, assertion } = await pageFor(t);
  await page
    .locator('tbody tr')
    .nth(2)
    .locator('td')
    .nth(3)
    .evaluate((cell) => {
      cell.textContent = '999 kWh';
    });
  const [o] = await checkAssertionGroup(page, [assertion], { timeout: 300 });
  assert.equal(o.passed, false);
  assert.equal(o.group_passed, false);
  assert.equal(o.timed_out, true);
  assert.equal(o.table_comparison.invalid, false);
  assert.equal(o.table_comparison.checked_cells, 25);
  assert.deepEqual(o.table_comparison.differences, [
    {
      key: 'D003',
      column: '字段3',
      check: 'number',
      expected: 303,
      actual: '999 kWh',
      parsed: 999,
      reason: 'value_mismatch',
    },
  ]);
});

test('Chromium missing exact middle identity reports every affected field', async (t) => {
  const { page, assertion } = await pageFor(t);
  await page
    .locator('tbody tr')
    .nth(2)
    .locator('td')
    .first()
    .evaluate((cell) => {
      cell.textContent = 'D0030';
    });
  const [o] = await checkAssertionGroup(page, [assertion], { timeout: 250 });
  assert.equal(o.passed, false);
  assert.equal(o.table_comparison.invalid, false);
  assert.equal(
    o.table_comparison.differences.filter((d) => d.key === 'D003' && d.reason === 'missing_row')
      .length,
    5,
  );
  assert.ok(
    o.table_comparison.differences.some((d) => d.reason === 'unexpected_row' && d.key === 'D0030'),
  );
});

for (const [name, change, code] of [
  [
    'nested table',
    () => {
      document
        .querySelector('tbody td')
        .insertAdjacentHTML('beforeend', '<table><tr><td>nested</td></tr></table>');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'colspan',
    () => {
      document.querySelector('tbody td').colSpan = 2;
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'rowspan',
    () => {
      document.querySelector('tbody td').rowSpan = 2;
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'virtual aria-rowcount',
    () => {
      document.querySelector('table').setAttribute('aria-rowcount', '500');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'virtual aria-rowindex',
    () => {
      document.querySelector('tbody tr').setAttribute('aria-rowindex', '101');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'virtual aria-colcount',
    () => {
      document.querySelector('table').setAttribute('aria-colcount', '500');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'virtual aria-colindex',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[3].setAttribute('aria-colindex', '101');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'display-none field',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[3].style.display = 'none';
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'visibility-hidden field',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[3].style.visibility = 'hidden';
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'hidden attribute field',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[3].hidden = true;
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'display-none header',
    () => {
      document.querySelector('thead tr').cells[3].style.display = 'none';
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'aria-hidden field',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[3].setAttribute('aria-hidden', 'true');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'aria-hidden row',
    () => {
      document.querySelectorAll('tbody tr')[2].setAttribute('aria-hidden', 'true');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'aria-hidden header',
    () => {
      document.querySelector('thead tr').cells[3].setAttribute('aria-hidden', 'true');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'inert field',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[3].inert = true;
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'aria-hidden table ancestor',
    () => {
      document.querySelector('#wrapper').setAttribute('aria-hidden', 'true');
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'inert table ancestor',
    () => {
      document.querySelector('#wrapper').inert = true;
    },
    'TABLE_STRUCTURE_UNSUPPORTED',
  ],
  [
    'duplicate header',
    () => {
      document.querySelector('thead tr').cells[3].textContent = '字段2';
    },
    'TABLE_COLUMN_DUPLICATE',
  ],
  [
    'missing field header',
    () => {
      document.querySelector('thead tr').cells[3].textContent = '其他字段';
    },
    'TABLE_COLUMN_MISSING',
  ],
  [
    'duplicate identity',
    () => {
      document.querySelectorAll('tbody tr')[2].cells[0].textContent = 'D002';
    },
    'TABLE_KEY_DUPLICATE',
  ],
]) {
  test(`Chromium rejects ${name} as a technical error, never business success`, async (t) => {
    const { page, assertion } = await pageFor(t);
    await page.evaluate(change);
    await assert.rejects(
      checkAssertionGroup(page, [assertion], { timeout: 1000 }).then((observations) => {
        t.diagnostic(
          JSON.stringify({
            unexpected_return: observations.map(({ passed, group_passed, table_comparison }) => ({
              passed,
              group_passed,
              table_comparison,
            })),
          }),
        );
        return observations;
      }),
      { code },
    );
  });
}

test('Chromium known empty table yields 25 missing-field differences, not technical invalid', async (t) => {
  const { page, assertion } = await pageFor(t);
  await page.locator('tbody').evaluate((body) => body.replaceChildren());
  const [o] = await checkAssertionGroup(page, [assertion], { timeout: 250 });
  assert.equal(o.passed, false);
  assert.equal(o.table_comparison.invalid, false);
  assert.equal(o.table_comparison.differences.length, 25);
  assert.ok(o.table_comparison.differences.every((d) => d.reason === 'missing_row'));
});

test('Chromium table-specific hidden guards do not change existing text assertion behavior', async (t) => {
  const { page } = await pageFor(t);
  await page.getByTestId('phase').evaluate((element) => {
    element.setAttribute('aria-hidden', 'true');
    element.inert = true;
  });
  const [observation] = await checkAssertionGroup(
    page,
    [{ target: { kind: 'testid', value: 'phase' }, check: 'text', expected: 'READY' }],
    { timeout: 1500 },
  );
  assert.equal(observation.passed, true);
  assert.equal(observation.group_passed, true);
});

for (const mode of ['two matrix fields', 'matrix and sibling assertion']) {
  test(`Chromium alternating ${mode} never combines different instants into success`, async (t) => {
    const { page, assertion } = await pageFor(t);
    // Both writes are synchronous in the same JS turn. Every actual DOM state
    // violates at least one predicate; each predicate separately becomes true.
    await page.evaluate((mode) => {
      const rows = document.querySelector('tbody').rows;
      const phase = document.querySelector('[data-testid="phase"]');
      window.tableObservationTransitions = 0;
      let state = false;
      const tick = () => {
        state = !state;
        rows[2].cells[3].textContent = state ? '303 kWh' : '999 kWh';
        if (mode === 'two matrix fields')
          rows[3].cells[4].textContent = state ? '999 kWh' : '404 kWh';
        else phase.textContent = state ? 'WAIT' : 'READY';
        window.tableObservationTransitions++;
      };
      tick();
      window.tableObservationTimer = setInterval(tick, 120);
    }, mode);
    const captured = [];
    const evaluate = page.evaluate.bind(page);
    // Observe complete samples from the production sampler without replacing
    // its implementation, manufacturing results, or rereading individual cells.
    page.evaluate = async (...args) => {
      const result = await evaluate(...args);
      if (result?.observations?.[0]?.actual?.rows) captured.push(structuredClone(result));
      return result;
    };
    let observations;
    try {
      const assertions = [assertion];
      if (mode === 'matrix and sibling assertion')
        assertions.push({
          target: { kind: 'testid', value: 'phase' },
          check: 'text',
          expected: 'READY',
        });
      observations = await checkAssertionGroup(page, assertions, { timeout: 1200 });
    } finally {
      page.evaluate = evaluate;
      await page.evaluate(() => clearInterval(window.tableObservationTimer));
    }
    assert.ok(await page.evaluate(() => window.tableObservationTransitions >= 4));
    assert.ok(captured.length >= 2, 'must observe more than one usable DOM sample');
    assert.deepEqual(
      new Set(captured.map((sample) => sample.observations[0].actual.rows[2][3])),
      new Set(['303 kWh', '999 kWh']),
      'must actually sample both alternating states',
    );
    for (const sample of captured) {
      const rows = sample.observations[0].actual.rows;
      const left = rows[2][3] === '303 kWh';
      const right =
        mode === 'two matrix fields'
          ? rows[3][4] === '404 kWh'
          : sample.observations[1].actual === 'READY';
      assert.notEqual(left, right, 'one complete sample always contains exactly one mismatch');
    }
    assert.ok(observations.every((o) => !o.group_passed && o.timed_out));
    if (mode === 'two matrix fields') {
      assert.equal(observations[0].passed, false);
      assert.equal(observations[0].table_comparison.checked_cells, 25);
      assert.equal(observations[0].table_comparison.differences.length, 1);
    } else {
      assert.ok(observations.some((o) => !o.passed));
      assert.equal(observations[0].at, observations[1].at);
      assert.equal(observations[0].sample_id, observations[1].sample_id);
    }
  });
}
