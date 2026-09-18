import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { startLab } from '../manual-lab/serve.mjs';
import { perform, checkAssertionGroup } from '../src/browser.mjs';
import { validatePlan, caseHash } from '../src/plans.mjs';
import { extractExpectationRanges } from '../src/expectation-coverage.mjs';

// Deterministic product-engine replay, NOT model planning or autonomous acceptance.
// Read only V01/V02/V03. Original actions/expected/data remain byte-for-byte equal
// as strings/JSON; only the test execution origin is mapped to startLab(0).
let lab, browser, originals;
before(async () => {
  const source = JSON.parse(
    await fs.readFile(new URL('../manual-lab/cases/01-valid.json', import.meta.url), 'utf8'),
  );
  originals = source.cases.filter((c) => ['LAB-V01', 'LAB-V02', 'LAB-V03'].includes(c.case_id));
  assert.deepEqual(
    originals.map((c) => c.case_id),
    ['LAB-V01', 'LAB-V02', 'LAB-V03'],
  );
  lab = await startLab(0);
  assert.notEqual(new URL(lab.url).port, '4196');
  assert.equal(new URL(lab.url).hostname, '127.0.0.1');
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  try {
    await browser?.close();
  } finally {
    await lab?.close();
  }
});

const role = (role, name) => ({ kind: 'role', role, name, exact: true });
const label = (value) => ({ kind: 'label', value, exact: true });
const text = (value) => ({ kind: 'text', value, exact: true });
const table = role('table', '');
const heading = (name) => role('heading', name);
const detail = role('dialog', '设备详情');
const insideDetail = (target) => ({
  kind: 'within',
  scope: { role: 'dialog', name: '设备详情', exact: true },
  target,
});
const check = (target, check, expected) => ({
  target,
  check,
  ...(expected === undefined ? {} : { expected }),
});
const visible = (target) => check(target, 'visible');
const wait = (target) => ({ op: 'wait', target, state: 'visible' });
const click = (name) => ({ op: 'click', target: role('button', name) });
const pager = (value) => check(text(value), 'text', value);
const menuActions = () => [click('运营中心'), { op: 'click', target: role('link', '资产设备') }];

function assetMatrix(rows) {
  return {
    key_column: '编号',
    ordered: true,
    exact_rows: true,
    rows: rows.map(([key, name, park, status, power]) => ({
      key,
      cells: [
        { column: '编号', check: 'text', expected: key },
        { column: '名称', check: 'text', expected: name },
        { column: '园区', check: 'text', expected: park },
        { column: '状态', check: 'text', expected: status },
        { column: '额定功率', check: 'number', expected: Number(power) },
      ],
    })),
  };
}

function identityMatrix(originalExpected) {
  const ids = extractExpectationRanges(originalExpected).flatMap((range) => range.ids);
  assert.equal(ids.length, 5, 'original case explicitly names the complete five-ID range');
  return {
    key_column: '编号',
    ordered: true,
    exact_rows: true,
    rows: ids.map((key) => ({ key, cells: [{ column: '编号', check: 'text', expected: key }] })),
  };
}

function buildPlan(caseId) {
  const original = originals.find((c) => c.case_id === caseId);
  const c = structuredClone(original);
  // Test author maps one full original expected to one obligation, without
  // rewriting/splitting its semantic content or claiming real PM confirmation.
  c.steps = c.steps.map((s) => ({
    ...s,
    obligations: [{ id: `O-${s.step_id}`, text: s.expected }],
  }));
  let execution;
  if (caseId === 'LAB-V01') {
    const source = c.steps[3].expected;
    const rows = [
      ...source.matchAll(/(D\d{3})\s+(\S+)\s+(北园|南园)\s+(运行|待机|告警)\s+(\d+)/gu),
    ].map((match) => match.slice(1));
    assert.equal(rows.length, 5, 'all 25 business values come from the original V01 expected');
    execution = [
      {
        actions: [wait(heading('运营总览'))],
        assertions: [
          check(heading('运营总览'), 'text', '运营总览'),
          check(heading('运营总览'), 'url_equals', `${lab.url}/overview`),
        ],
      },
      {
        actions: menuActions(),
        assertions: [
          check(heading('资产设备'), 'text', '资产设备'),
          ...['关键词', '园区', '状态', '排序'].map((name) => visible(label(name))),
          visible(role('button', '查询')),
          visible(role('button', '重置')),
        ],
      },
      {
        actions: [wait(table)],
        assertions: [pager('共12条 · 第1/3页'), check(table, 'row_count', 5)],
      },
      { actions: [wait(table)], assertions: [check(table, 'table_cells', assetMatrix(rows))] },
    ];
  } else if (caseId === 'LAB-V02') {
    const d = c.data;
    execution = [
      {
        actions: [{ op: 'navigate', value: '/assets' }],
        assertions: [check(heading('资产设备'), 'text', '资产设备'), pager('共12条 · 第1/3页')],
      },
      {
        actions: [
          { op: 'fill', target: label('关键词'), value: d.keyword },
          { op: 'select', target: label('园区'), value: d.park },
          { op: 'select', target: label('状态'), value: d.status },
        ],
        assertions: [
          check(label('关键词'), 'value', d.keyword),
          check(label('园区'), 'selected_label', d.park),
          check(label('状态'), 'selected_label', d.status),
          check(label('排序'), 'selected_label', d.sort),
          pager('共12条 · 第1/3页'),
        ],
      },
      {
        actions: [click('查询')],
        assertions: [check(table, 'row_count', 1), pager('共1条 · 第1/1页')],
      },
      {
        actions: [wait(table)],
        assertions: [
          check(
            table,
            'table_cells',
            assetMatrix([[d.expected_asset_id, d.keyword, d.park, d.status, d.expected_power_kw]]),
          ),
          check({ kind: 'row', table, key: { column: '编号', value: 'D001' } }, 'count', 0),
        ],
      },
    ];
  } else {
    const d = c.data;
    execution = [
      {
        actions: menuActions(),
        assertions: [
          check(heading('资产设备'), 'text', '资产设备'),
          pager('共12条 · 第1/3页'),
          check(table, 'table_cells', identityMatrix(c.steps[0].expected)),
        ],
      },
      {
        actions: [click('下一页')],
        assertions: [
          pager('共12条 · 第2/3页'),
          check(table, 'table_cells', identityMatrix(c.steps[1].expected)),
        ],
      },
      {
        actions: [
          {
            op: 'click',
            target: {
              kind: 'row',
              table,
              key: { column: '编号', value: d.target_asset_id },
              target: role('button', '详情'),
            },
          },
          wait(insideDetail(heading(d.target_asset_id))),
        ],
        assertions: [
          visible(detail),
          check(insideDetail(heading(d.target_asset_id)), 'text', d.target_asset_id),
        ],
      },
      {
        actions: [wait(detail)],
        assertions: [
          check(insideDetail(heading(d.target_asset_id)), 'text', d.target_asset_id),
          check(insideDetail(text(d.target_name)), 'text', d.target_name),
          check(insideDetail(text(d.target_park)), 'text', d.target_park),
          check(insideDetail(text(`${d.target_power_kw} kW`)), 'text', `${d.target_power_kw} kW`),
          check(insideDetail(heading('D001')), 'count', 0),
          check(insideDetail(text('北园')), 'count', 0),
          check(insideDetail(text('100 kW')), 'count', 0),
        ],
      },
    ];
  }
  assert.equal(execution.length, c.steps.length);
  const plan = {
    schema_version: 'ui-agent-plan/v2',
    case_id: c.case_id,
    case_hash: caseHash(c),
    entry_path: '/overview',
    data_effect: 'read_only',
    preconditions: [],
    cleanup: null,
    steps: execution.map((run, i) => ({
      step_id: c.steps[i].step_id,
      source_action: c.steps[i].action,
      source_expected: c.steps[i].expected,
      assertion_mode: 'simultaneous',
      within_ms: 1500,
      actions: run.actions.map((action, a) => ({ ...action, action_id: `S${i + 1}-A${a + 1}` })),
      assertions: run.assertions.map((assertion) => ({
        ...assertion,
        oracle_quote: c.steps[i].expected,
        obligation_ids: [c.steps[i].obligations[0].id],
      })),
    })),
  };
  assert.equal(validatePlan(plan, c, lab.url), plan);
  assert.deepEqual(
    c.steps.map(({ obligations, ...s }) => s),
    original.steps,
  );
  assert.deepEqual(c.data, original.data);
  return plan;
}

async function freshOverview(t) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const unexpectedRequests = [],
    errors = [];
  await context.route('**/*', (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== lab.url || !['GET', 'HEAD'].includes(request.method())) {
      unexpectedRequests.push({ method: request.method(), url: request.url() });
      return route.abort();
    }
    return route.continue();
  });
  t.after(async () => {
    await context.close();
    assert.deepEqual(
      unexpectedRequests,
      [],
      'no active 4196 service, external service or network mutation',
    );
    assert.deepEqual(errors, [], 'no uncaught fixture errors');
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(4000);
  assert.deepEqual(
    await context.storageState(),
    { cookies: [], origins: [] },
    'fresh browser context before loading the fixture',
  );
  await page.goto(lab.url + '/');
  await perform(page, { action_id: 'ENTER', ...click('进入演示') }, lab.url);
  const initial = await checkAssertionGroup(
    page,
    [
      check(heading('运营总览'), 'text', '运营总览'),
      check(heading('运营总览'), 'url_equals', `${lab.url}/overview`),
    ],
    { timeout: 1500 },
  );
  assert.ok(
    initial.every((o) => o.passed && o.group_passed),
    'start at overview before original navigation',
  );
  return page;
}

// V02 explicitly requires unchanged table state BEFORE Query. This direct
// before/after equality reference proves only that relational invariant; it is
// never converted into a table_cells expectation or a new business oracle.
async function snapshotTable(page) {
  return page.getByRole('table', { name: '', exact: true }).evaluate((table) => ({
    headers: [...table.tHead.rows[0].cells].map((cell) => cell.innerText.trim()),
    rows: [...table.tBodies]
      .flatMap((body) => [...body.rows])
      .map((row) => [...row.cells].map((cell) => cell.innerText.trim())),
  }));
}

async function replay(t, caseId, fault) {
  const plan = buildPlan(caseId);
  const page = await freshOverview(t);
  const records = [];
  let beforeQuery,
    unchangedChecks = 0;
  for (const [index, step] of plan.steps.entries()) {
    if (caseId === 'LAB-V02' && index === 1) beforeQuery = await snapshotTable(page);
    for (const action of step.actions) {
      await perform(page, action, lab.url);
      if (caseId === 'LAB-V02' && index === 1) {
        assert.deepEqual(
          await snapshotTable(page),
          beforeQuery,
          'each condition edit must leave ALL original table cells unchanged until Query',
        );
        unchangedChecks++;
      }
    }
    if (fault?.step === index + 1) await fault.inject(page);
    const observations = await checkAssertionGroup(page, step.assertions, {
      timeout: fault?.step === index + 1 ? 350 : 1500,
    });
    records.push({ step_id: step.step_id, observations });
    if (fault?.step === index + 1) {
      assert.ok(
        observations.some((o) => !o.passed),
        `${fault.name} must fail the ORIGINAL oracle`,
      );
      assert.ok(observations.every((o) => !o.group_passed));
      return { records, failed: observations, page };
    }
    assert.ok(
      observations.every((o) => o.passed && o.group_passed),
      `${caseId} original step ${step.step_id}: ${JSON.stringify(observations)}`,
    );
  }
  assert.equal(records.length, 4, 'complete original four-step chain executed');
  if (caseId === 'LAB-V02') assert.equal(unchangedChecks, 3);
  return { records, page };
}

test('LAB-V01 original overview/menu/pagination and full 25-field matrix replay', async (t) => {
  const { records } = await replay(t, 'LAB-V01');
  const comparison = records[3].observations[0].table_comparison;
  assert.deepEqual(comparison, {
    passed: true,
    invalid: false,
    differences: [],
    checked_cells: 25,
  });
});

test('LAB-V02 original AND query preserves table before Query and returns only D009', async (t) => {
  const { records } = await replay(t, 'LAB-V02');
  assert.equal(records[3].observations[0].table_comparison.checked_cells, 5);
  assert.equal(records[3].observations[1].actual, 0, 'D001 absent');
});

test('LAB-V03 original menu/page2 checks all D006..D010 then D009 detail identity and fields', async (t) => {
  const { records } = await replay(t, 'LAB-V03');
  const pageTwo = records[1].observations[1];
  assert.deepEqual(
    pageTwo.actual.rows.map((row) => row[0]),
    ['D006', 'D007', 'D008', 'D009', 'D010'],
  );
  assert.equal(pageTwo.table_comparison.checked_cells, 5);
  assert.equal(records[2].observations[1].actual, 'D009');
  assert.equal(records[3].observations[0].actual, 'D009');
});

test('fault control: V01 wrong middle-row power fails the unchanged full matrix', async (t) => {
  const { failed } = await replay(t, 'LAB-V01', {
    step: 4,
    name: 'middle-row power',
    inject: (page) =>
      page.getByRole('table').evaluate((table) => {
        const row = [...table.tBodies[0].rows].find(
          (row) => row.cells[0].innerText.trim() === 'D003',
        );
        row.cells[4].textContent = '999 kW';
      }),
  });
  assert.equal(failed[0].table_comparison.checked_cells, 25);
  assert.deepEqual(failed[0].table_comparison.differences, [
    {
      key: 'D003',
      column: '额定功率',
      check: 'number',
      expected: 60,
      actual: '999 kW',
      parsed: 999,
      reason: 'value_mismatch',
    },
  ]);
});

test('fault control: V03 wrong page text fails despite complete correct second-page rows', async (t) => {
  const { failed } = await replay(t, 'LAB-V03', {
    step: 2,
    name: 'page number',
    inject: (page) =>
      page.locator('.pager span').evaluate((span) => {
        span.textContent = '共12条 · 第1/3页';
      }),
  });
  assert.equal(failed[0].passed, false);
  assert.equal(failed[1].passed, true, 'all second-page identities still independently match');
  assert.deepEqual(
    failed[1].actual.rows.map((row) => row[0]),
    ['D006', 'D007', 'D008', 'D009', 'D010'],
  );
});

test('fault control: V03 wrong detail identity fails even with D009 field values intact', async (t) => {
  const { failed } = await replay(t, 'LAB-V03', {
    step: 4,
    name: 'wrong detail object',
    inject: (page) =>
      page
        .getByRole('dialog', { name: '设备详情', exact: true })
        .getByRole('heading', { name: 'D009', exact: true })
        .evaluate((heading) => {
          heading.textContent = 'D001';
        }),
  });
  assert.equal(failed[0].passed, false, 'D009 identity is mandatory at field observation time');
  assert.ok(
    failed.slice(1, 4).every((o) => o.passed),
    'correct field values cannot substitute for identity',
  );
  assert.equal(
    failed[4].passed,
    false,
    'explicit not-D001 expectation also detects the substituted object',
  );
});
