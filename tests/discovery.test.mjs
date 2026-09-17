import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDiscoveryResponse, handoffEntryPaths } from '../src/discovery.mjs';

const options = {
  candidates: [{ candidate_id: 'obs-1:menu-2', label: '任务管理' }],
  caseIds: ['CAT-1', 'TASK-1'],
  currentCaseId: 'TASK-1',
};
const code = (expected) => (error) => error.code === expected;
const response = () => ({
  action: { candidate_id: 'obs-1:menu-2' },
  reason: '查看当前用例关联的任务管理页面',
});
const handoff = () => ({
  artifact_type: 'manual_case_frontend_handoff',
  schema_version: '1.0',
  actions: [
    { id: 'catalog', knowledge_status: 'code_confirmed', entry_path: '/catalog' },
    { id: 'tasks', knowledge_status: 'code_confirmed', entry_path: '/tasks' },
    { id: 'tasks-again', knowledge_status: 'code_confirmed', entry_path: '/tasks' },
    { id: 'candidate', knowledge_status: 'inferred_candidate', entry_path: '/unconfirmed' },
  ],
  case_bindings: [
    { case_id: 'CAT-1', steps: [{ step_id: 'S1', status: 'mapped', action_id: 'catalog' }] },
    {
      case_id: 'TASK-1',
      steps: [
        { step_id: 'S1', status: 'mapped', action_id: 'tasks' },
        { step_id: 'S2', status: 'mapped', action_id: 'tasks-again' },
        { step_id: 'S3', status: 'mapped', action_id: 'candidate' },
      ],
    },
  ],
});
const base = 'http://127.0.0.1:4179';

test('discovery selects an exact current candidate and returns the original object', () => {
  const value = response(),
    before = structuredClone(value);
  assert.equal(validateDiscoveryResponse(value, options), value);
  assert.deepEqual(value, before);
});
for (const value of [
  { done: true, reason: '页面及后续操作控件已有技术映射' },
  { blocked: true, reason: '缺少提交后生成的详情页定位信息' },
])
  test('discovery terminal response remains a technical result with empty candidates', () =>
    assert.equal(validateDiscoveryResponse(value, { ...options, candidates: [] }), value));
for (const [name, value, error] of [
  [
    'unknown candidate',
    { action: { candidate_id: 'obs-1:missing' }, reason: '查看页面' },
    'DISCOVERY_CANDIDATE_UNKNOWN',
  ],
  [
    'stale observation',
    { action: { candidate_id: 'obs-0:menu-2' }, reason: '查看页面' },
    'DISCOVERY_CANDIDATE_UNKNOWN',
  ],
  [
    'locator injection',
    {
      action: { candidate_id: 'obs-1:menu-2', target: { kind: 'text', value: '删除' } },
      reason: '打开页面',
    },
    'INVALID_SCHEMA',
  ],
  [
    'route injection',
    { action: { candidate_id: 'obs-1:menu-2', route: '/delete' }, reason: '打开页面' },
    'INVALID_SCHEMA',
  ],
  [
    'code injection',
    { action: { candidate_id: 'obs-1:menu-2', code: 'document.body.click()' }, reason: '打开页面' },
    'INVALID_SCHEMA',
  ],
  [
    'fill injection',
    { action: { candidate_id: 'obs-1:menu-2', op: 'fill', value: 'invented' }, reason: '打开页面' },
    'INVALID_SCHEMA',
  ],
  ['new oracle', { done: true, reason: '已定位', expected: '测试成功' }, 'INVALID_SCHEMA'],
  ['mixed result', { ...response(), done: true }, 'INVALID_SCHEMA'],
  ['false done', { done: false, reason: '还有事情' }, 'DISCOVERY_RESPONSE_INVALID'],
  ['nonboolean blocked', { blocked: 'true', reason: '缺少页面' }, 'DISCOVERY_RESPONSE_INVALID'],
  ['empty reason', { done: true, reason: '   ' }, 'DISCOVERY_REASON_INVALID'],
  ['oversize reason', { done: true, reason: '字'.repeat(601) }, 'DISCOVERY_REASON_INVALID'],
  ['control characters', { done: true, reason: '观察\u0000页面' }, 'DISCOVERY_REASON_INVALID'],
  ['arbitrary operation', { op: 'click', reason: '导航' }, 'DISCOVERY_RESPONSE_INVALID'],
])
  test('discovery rejects ' + name, () =>
    assert.throws(() => validateDiscoveryResponse(value, options), code(error)),
  );
test('discovery rejects invalid current Case or duplicate candidate identities', () => {
  assert.throws(
    () => validateDiscoveryResponse(response(), { ...options, currentCaseId: 'OTHER' }),
    code('DISCOVERY_CASE_CONTEXT_INVALID'),
  );
  assert.throws(
    () =>
      validateDiscoveryResponse(response(), {
        ...options,
        candidates: [...options.candidates, ...options.candidates],
      }),
    code('DISCOVERY_CANDIDATES_INVALID'),
  );
});
test('handoff routes are restricted to current Case mapped source-confirmed actions and deduplicated', () => {
  const value = handoff(),
    before = structuredClone(value);
  assert.deepEqual(handoffEntryPaths(value, 'TASK-1', base), ['/tasks']);
  assert.deepEqual(handoffEntryPaths(value, 'CAT-1', base), ['/catalog']);
  assert.deepEqual(handoffEntryPaths(value, 'UNKNOWN', base), []);
  assert.deepEqual(handoffEntryPaths(null, 'TASK-1', base), []);
  assert.deepEqual(value, before);
});
test('handoff preserves valid SPA route, query and fragment while ignoring arbitrary source links', () => {
  const value = handoff();
  value.actions[1].entry_path = '/#/tasks?filter=active';
  value.actions[2].entry_path = '/#/tasks?filter=active';
  value.source = {
    files: [{ anchors: [{ statement: 'https://example.org/not-a-bound-action' }] }],
  };
  assert.deepEqual(handoffEntryPaths(value, 'TASK-1', base), ['/#/tasks?filter=active']);
  value.actions[1].entry_path = '/tasks?filter=needs%20review';
  value.actions[2].entry_path = '/tasks?filter=needs%20review';
  assert.deepEqual(handoffEntryPaths(value, 'TASK-1', base), ['/tasks?filter=needs%20review']);
});
for (const route of [
  'https://evil.example/path',
  '//evil.example/path',
  '/\\evil.example/path',
  '/%2F%2Fevil.example/path',
  '/tasks/../admin',
  '/%252e%252e/admin',
  '/#//evil.example',
  '/tasks?token=abc',
  '/#/tasks?session_id=abc',
  '/tasks?%2574oken=abc',
  '/tasks%0Adelete',
  '/tasks%250Ddelete',
  '/bad%zz',
  'relative/tasks',
])
  test('handoff rejects unsafe bound entry path ' + JSON.stringify(route), () => {
    const value = handoff();
    value.actions[1].entry_path = route;
    assert.throws(
      () => handoffEntryPaths(value, 'TASK-1', base),
      code('DISCOVERY_UNSAFE_ENTRY_PATH'),
    );
  });
test('unresolved steps do not contribute routes and broken current bindings are rejected', () => {
  const value = handoff();
  value.case_bindings[1].steps = [{ step_id: 'S1', status: 'unresolved', action_id: null }];
  assert.deepEqual(handoffEntryPaths(value, 'TASK-1', base), []);
  value.case_bindings[1].steps = [{ step_id: 'S1', status: 'mapped', action_id: 'missing' }];
  assert.throws(() => handoffEntryPaths(value, 'TASK-1', base), code('DISCOVERY_HANDOFF_INVALID'));
  value.schema_version = '2.0';
  assert.throws(() => handoffEntryPaths(value, 'TASK-1', base), code('DISCOVERY_HANDOFF_INVALID'));
});
