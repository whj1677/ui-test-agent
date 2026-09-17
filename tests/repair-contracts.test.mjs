import test from 'node:test';
import assert from 'node:assert/strict';
import { describePlanError } from '../src/plan-feedback.mjs';
import { requirePlanSemantics } from '../src/plan-semantics.mjs';
import { recoveryEvidence, recoveryKind, usefulProbe } from '../src/recovery-gap.mjs';
import { requireEntryNavigation } from '../src/case-entry-url.mjs';
import { planningInput } from '../src/planning-input.mjs';

test('illegal kind diagnostics name each known protocol path without echoing arbitrary content', () => {
  const bad = { kind: 'secret-raw-not-to-log', value: 'private-content' };
  const samples = [
    [{ preconditions: [{ target: bad }] }, 'plan.preconditions[0].target.kind'],
    [
      { steps: [{ actions: [{ op: 'click', target: bad }] }] },
      'plan.steps[0].actions[0].target.kind',
    ],
    [
      { steps: [{ checkpoints: [{ assertions: [{ target: bad }] }] }] },
      'plan.steps[0].checkpoints[0].assertions[0].target.kind',
    ],
    [{ cleanup: { ownership: [{ target: bad }] } }, 'plan.cleanup.ownership[0].target.kind'],
  ];
  for (const [plan, expectedPath] of samples) {
    const feedback = describePlanError({ code: 'INVALID_LOCATOR' }, plan);
    assert.equal(feedback.field_path, expectedPath);
    assert.equal(feedback.actual_type, 'string');
    assert.ok(feedback.allowed_kinds.includes('cell'));
    assert.ok(!JSON.stringify(feedback).includes('private-content'));
    assert.ok(!JSON.stringify(feedback).includes('secret-raw'));
  }
});

test('extra row counts and cross-record numeric assertions are rejected, original price remains unchanged', () => {
  const c = { steps: [{ action: '查看夜间记录', expected: '夜间的单价为0.32' }] };
  const a = {
    target: { kind: 'role', role: 'table', name: '费率目录', exact: true },
    check: 'row_count',
    expected: 2,
  };
  const plan = { steps: [{ assertions: [a] }] };
  const original = structuredClone(c);
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_ASSERTION_UNSUPPORTED' });
  a.check = 'contains';
  a.expected = '0.32';
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_RECORD_FIELD_UNBOUND' });
  a.target = {
    kind: 'cell',
    table: a.target,
    key: { column: '方案名称', value: '夜间' },
    column: '单价',
  };
  assert.doesNotThrow(() => requirePlanSemantics(plan, c));
  a.expected = '0.23';
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_ASSERTION_VALUE_UNSUPPORTED' });
  a.expected = '0.32';
  a.target.key.value = '页面新出现但未授权的记录';
  assert.throws(() => requirePlanSemantics(plan, c), { code: 'PLAN_ROW_IDENTITY_UNSUPPORTED' });
  assert.deepEqual(c, original);
  assert.equal(a.expected, '0.32');
});

test('explicit row count remains legal; no blanket prohibition of tables/counts', () => {
  requirePlanSemantics(
    {
      steps: [
        {
          assertions: [
            { target: { kind: 'testid', value: 'table' }, check: 'row_count', expected: 2 },
          ],
        },
      ],
    },
    { steps: [{ action: '查询', expected: '显示2条记录' }] },
  );
});

test('no-URL navigation uses authenticated observed redirect, not target root', () => {
  const c = { case_id: 'C', steps: [{ step_id: 'S1', action: '展开资产菜单' }] };
  const plan = { entry_path: '/dashboard', steps: [{ step_id: 'S1', actions: [{ op: 'click' }] }] };
  requireEntryNavigation(plan, c, 'http://example.test/', 'http://example.test/dashboard');
  assert.throws(
    () =>
      requireEntryNavigation(
        { ...plan, entry_path: '/billing' },
        c,
        'http://example.test/',
        'http://example.test/dashboard',
      ),
    { code: 'CASE_ENTRY_NAVIGATION_REQUIRED' },
  );
  const start = {
    url: 'http://example.test/dashboard',
    login_page: false,
    controls: [],
    navigation_job_id: 'job',
  };
  const input = planningInput(
    { target: 'http://example.test/', snapshots: [], navigation_start: start },
    c,
    { discovery: { job_id: 'job' } },
    'hash',
  );
  assert.deepEqual(input.pages, [start]);
  assert.equal(input.technical_context.navigation.execution_entry_path, '/dashboard');
});

test('unrelated menu/text changes are not evidence; a named missing cell binding is', () => {
  const reason = '缺少夜间记录的单价定位事实';
  const menu = {
    role: 'menuitem',
    name: '夜间',
    locator: { kind: 'text', value: '夜间', exact: true },
  };
  assert.deepEqual(
    recoveryEvidence([{ url: '/reports', text: 'changed', controls: [menu] }], reason),
    [],
  );
  const cell = {
    role: 'cell',
    name: '0.23',
    locator: {
      kind: 'cell',
      table: { kind: 'testid', value: 'rates' },
      key: { column: '方案名称', value: '夜间' },
      column: '单价',
    },
  };
  const page = { url: '/billing', controls: [cell] };
  assert.equal(recoveryEvidence([page], reason).length, 1);
  assert.deepEqual(
    recoveryEvidence([page], reason),
    recoveryEvidence([{ ...page, text: 'unrelated', captured_at: 'now' }], reason),
  );
  assert.equal(usefulProbe({ locator: cell.locator, count: 1, visible: true }, reason), true);
  assert.equal(
    usefulProbe({ locator: menu.locator, count: 1, visible: true }, '缺少详情字段'),
    false,
  );
  assert.equal(
    recoveryKind({ self_repair: { rounds: [{ code: 'INVALID_LOCATOR' }] } }),
    'PLAN_REPAIR_ONLY',
  );
  assert.equal(
    recoveryKind({ self_repair: { rounds: [{ code: 'ORACLE_UNCLEAR' }] } }),
    'BOUNDARY_REQUIRES_INPUT',
  );
});
