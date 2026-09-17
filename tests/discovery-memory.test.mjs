import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserSession, snapshot } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import {
  validateDiscoveryInteractions,
  observationKey,
  discoveryActionKey,
  createDiscoveryMemory,
  rememberObservation,
  discoveryMemoryInput,
} from '../src/discovery-memory.mjs';
import { planningInput } from '../src/planning-input.mjs';

const locator = (value) => ({ kind: 'testid', value });
const c = {
  case_id: 'AUDIT-1',
  data: { query: 'alpha' },
  steps: [
    { step_id: 'S1', action: '查询 alpha，再选择不同类型查看字段', expected: '显示相关结果' },
  ],
  cleanup: { identity: 'owned-only' },
};
const baseline = { cases: [c] };
const contract = (operation = 'fill', values = ['alpha']) => ({
  case_id: c.case_id,
  entry_path: '/',
  locator: locator('query'),
  operation,
  values,
  evidence: { kind: 'source_review', ref: 'fixture:index.html#query', no_business_write: true },
});
const shot = (overrides = {}) => ({
  url: 'http://127.0.0.1/catalog',
  title: '目录',
  text: '查询',
  controls: [{ name: '查询', locator: locator('query'), current_value: '' }],
  ...overrides,
});
const observation = (page_id, snapshot) => ({ page_id, snapshot, candidates: [] });

test('discovery contracts reject unknown Cases, unsupported operations, missing provenance and arbitrary source values', () => {
  for (const invalid of [
    { ...contract(), case_id: 'OTHER' },
    { ...contract(), operation: 'press' },
    { ...contract(), values: ['not-in-original'] },
    { ...contract(), values: [c.steps[0].expected] },
    {
      ...contract(),
      evidence: { kind: 'model_guess', ref: 'model claims safe', no_business_write: true },
    },
    { ...contract(), evidence: { kind: 'source_review', ref: 'handler' } },
    {
      ...contract(),
      evidence: { kind: 'source_review', ref: 'handler', no_business_write: false },
    },
    { ...contract(), locator: { kind: 'css', value: 'form input' } },
    { ...contract(), values: [42] },
    { ...contract(), values: ['alpha\n'] },
  ])
    assert.throws(() => validateDiscoveryInteractions([invalid], baseline));
  assert.throws(() => validateDiscoveryInteractions([contract(), contract()], baseline));
});

test('a validated contract is detached from caller mutation and supports an explicitly permitted empty query', () => {
  const input = [contract('fill', ['alpha', ''])],
    validated = validateDiscoveryInteractions(input, baseline);
  assert.deepEqual(validated, input);
  input[0].values[0] = 'changed';
  input[0].evidence.no_business_write = false;
  assert.deepEqual(validated[0].values, ['alpha', '']);
  assert.equal(validated[0].evidence.no_business_write, true);
});

test('duplicate values are rejected during configuration instead of failing only at browser start', () => {
  assert.throws(() =>
    validateDiscoveryInteractions([contract('fill', ['alpha', 'alpha'])], baseline),
  );
});

test('JSON property names are not approved Case input data', () => {
  assert.throws(() => validateDiscoveryInteractions([contract('fill', ['query'])], baseline));
});

test('contracts require an explicit same-origin non-sensitive path', () => {
  for (const entry_path of [
    undefined,
    'https://other.invalid/catalog',
    '//other.invalid/catalog',
    'catalog',
    '/\\other.invalid/path',
    '/catalog?token=hidden',
    '/catalog\n',
  ]) {
    assert.throws(
      () => validateDiscoveryInteractions([{ ...contract(), entry_path }], baseline),
      `invalid path ${JSON.stringify(entry_path)}`,
    );
  }
  assert.doesNotThrow(() =>
    validateDiscoveryInteractions(
      [{ ...contract(), entry_path: '/catalog?filter=active#tab' }],
      baseline,
    ),
  );
});

test('state/action/value identity retains changes but ignores opaque candidate IDs', () => {
  const state = shot(),
    candidate = {
      candidate_id: 'first',
      locator: locator('query'),
      operation: 'fill',
      value: 'alpha',
    };
  assert.equal(
    discoveryActionKey(state, candidate),
    discoveryActionKey(state, { ...candidate, candidate_id: 'later' }),
  );
  assert.notEqual(
    discoveryActionKey(state, candidate),
    discoveryActionKey(state, { ...candidate, value: '' }),
  );
  assert.notEqual(
    discoveryActionKey(state, candidate),
    discoveryActionKey(state, { ...candidate, operation: 'select' }),
  );
  const filled = shot({
    controls: [{ name: '查询', locator: locator('query'), current_value: 'alpha' }],
  });
  assert.notEqual(observationKey(state), observationKey(filled));
  assert.notEqual(discoveryActionKey(state, candidate), discoveryActionKey(filled, candidate));
});

test('returning to a prior state does not hide a different relevant next action', () => {
  const state = shot(),
    first = { locator: locator('new'), operation: 'click' },
    next = { locator: locator('edit'), operation: 'click' };
  const seen = new Set([discoveryActionKey(state, first)]);
  assert.ok(seen.has(discoveryActionKey(shot(), first)));
  assert.ok(!seen.has(discoveryActionKey(shot(), next)));
  assert.ok(!seen.has(discoveryActionKey(shot({ text: '已打开详情' }), first)));
});

test('source-only locators do not become DOM observations or business results', () => {
  const handoff = {
    actions: [
      {
        knowledge_status: 'code_confirmed',
        controls: [
          {
            id: 'future',
            locator: locator('future'),
            source_refs: [{ path: 'index.html', anchor_id: 'after-save' }],
          },
        ],
      },
    ],
  };
  const memory = createDiscoveryMemory(c, handoff);
  rememberObservation(memory, observation('page-1', shot()));
  const result = discoveryMemoryInput(memory);
  assert.equal(result.observed_controls.length, 1);
  assert.equal(result.observed_controls[0].evidence, 'DOM_OBSERVED');
  assert.equal(result.unobserved_source_controls.length, 1);
  assert.equal(result.unobserved_source_controls[0].locator.value, 'future');
  assert.deepEqual(result.objectives, [
    { step_id: 'S1', operation: c.steps[0].action, observation_requirement: c.steps[0].expected },
  ]);
  assert.equal(Object.hasOwn(result, 'business_status'), false);
});

test('inferred and unresolved Handoff locators cannot be relabeled source-confirmed', () => {
  const actions = ['code_confirmed', 'inferred_candidate', 'unresolved'].map((status) => ({
    id: status,
    knowledge_status: status,
    source_refs: [{ path: 'index.html', anchor_id: status }],
    controls: [
      {
        id: status,
        locator: locator(status),
        source_refs: [{ path: 'index.html', anchor_id: status }],
      },
    ],
  }));
  const view = discoveryMemoryInput(createDiscoveryMemory(c, { actions }));
  const confirmed = view.source_controls.filter(
    (control) => control.evidence === 'SOURCE_CONFIRMED_CANDIDATE',
  );
  assert.deepEqual(
    confirmed.map((control) => control.locator.value),
    ['code_confirmed'],
  );
  for (const control of view.source_controls) {
    assert.ok(control.knowledge_status, 'original knowledge status must remain inspectable');
    assert.ok(control.source_refs?.length, 'source facts must retain an inspectable anchor');
  }
});

test('repeated observations keep a finite unique state record and preserve the transition back', () => {
  const memory = createDiscoveryMemory(c, null),
    start = shot(),
    modal = shot({ text: '新增表单', controls: [{ name: '关闭', locator: locator('close') }] });
  const initial = rememberObservation(memory, observation('first', start));
  rememberObservation(memory, observation('modal', modal), {
    from_state: initial.state_key,
    operation: 'click',
    locator: locator('new'),
  });
  const returned = rememberObservation(memory, observation('returned', start), {
    from_state: observationKey(modal),
    operation: 'click',
    locator: locator('close'),
  });
  const view = discoveryMemoryInput(memory);
  assert.equal(view.visited_states.length, 2);
  assert.equal(returned.new_controls, 0);
  assert.equal(view.transitions.length, 2);
  assert.equal(view.transitions[1].to_state, initial.state_key);
});

test('planning consumes only the current Case latest discovery job and matching memory', () => {
  const state = {
    target: 'http://127.0.0.1/catalog',
    handoff: null,
    auth_marker: locator('ready'),
    snapshots: [
      { ...shot(), tag: 'manual' },
      { ...shot(), tag: 'old', discovery_case_id: c.case_id, discovery_job_id: 'job-old' },
      { ...shot(), tag: 'current', discovery_case_id: c.case_id, discovery_job_id: 'job-current' },
      {
        ...shot(),
        tag: 'other-case',
        discovery_case_id: 'AUDIT-2',
        discovery_job_id: 'job-current',
      },
    ],
  };
  const row = {
    discovery: { job_id: 'job-current' },
    discovery_memory: { job_id: 'job-current', case_id: c.case_id },
    plan_feedback: [],
  };
  const result = planningInput(state, c, row, 'case-hash');
  assert.deepEqual(
    result.pages.map((page) => page.tag),
    ['manual', 'current'],
  );
  assert.equal(result.discovery_memory.job_id, 'job-current');
  const stale = planningInput(
    state,
    c,
    { ...row, discovery_memory: { job_id: 'job-old' } },
    'case-hash',
  );
  assert.equal(Object.hasOwn(stale, 'discovery_memory'), false);
});

async function realFixture(html, contracts, work) {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'text/html;charset=utf-8');
    res.end('<span data-testid="ready">Ready</span>' + html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const task = {
    id: 'independent-memory-audit',
    target: `http://127.0.0.1:${server.address().port}/`,
    authorization: { writes: false, readOnlyEndpoints: [] },
    discovery_interactions: contracts,
  };
  const session = new BrowserSession({ headless: true });
  let discovery;
  try {
    await session.open(task);
    await session.authenticate(task, locator('ready'));
    discovery = new DiscoveryBrowser(session, task, { maxSteps: 12 });
    await discovery.open();
    discovery.beginCase(c);
    await work(discovery, session);
  } finally {
    await discovery?.close();
    await session.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('an explicitly authorized empty fill remains available to undo a query', async () => {
  await realFixture(
    '<label>查询<input data-testid="query" type="search"></label>',
    [contract('fill', ['alpha', ''])],
    async (discovery) => {
      const initial = await discovery.observe(),
        fill = initial.candidates.find(
          (item) => item.operation === 'fill' && item.value === 'alpha',
        );
      assert.ok(fill);
      const filled = await discovery.act({ candidate_id: fill.candidate_id });
      const clear = filled.candidates.find(
        (item) => item.operation === 'fill' && item.value === '',
      );
      assert.ok(
        clear,
        'clearing a query should not require an empty string in the original Case data',
      );
      await discovery.act({ candidate_id: clear.candidate_id });
      assert.equal(await discovery.page.getByTestId('query').inputValue(), '');
    },
  );
});

test('a contract cannot be reused on a different route with the same locator or by a different Case', async () => {
  await realFixture(
    '<label>查询<input data-testid="query" type="search"></label>',
    [contract()],
    async (discovery) => {
      assert.ok((await discovery.observe()).candidates.some((item) => item.operation === 'fill'));
      const elsewhere = await discovery.navigate('/different-module');
      assert.ok(!elsewhere.candidates.some((item) => item.operation === 'fill'));
      await discovery.navigate('/');
      discovery.beginCase({ ...c, case_id: 'AUDIT-OTHER' });
      assert.ok(!(await discovery.observe()).candidates.some((item) => item.operation === 'fill'));
    },
  );
});

test('new current_value snapshots exclude private fields that discovery cannot manipulate', async () => {
  const html =
    '<label>查询<input data-testid="query" value="alpha"></label><label>验证码<input data-testid="pin" autocomplete="one-time-code" value="582964"></label><label>银行卡<input data-testid="card" autocomplete="cc-number" value="4111111111111111"></label><label>邮箱<input data-testid="mail" type="email" value="fixture@example.invalid"></label>';
  await realFixture(html, [], async (_discovery, session) => {
    const captured = await snapshot(session.loginPage, { marker: locator('ready') });
    assert.equal(
      captured.controls.find((item) => item.locator.value === 'query').current_value,
      'alpha',
    );
    for (const id of ['pin', 'card', 'mail'])
      assert.equal(
        Object.hasOwn(
          captured.controls.find((item) => item.locator.value === id),
          'current_value',
        ),
        false,
        `private field ${id}`,
      );
    const serialized = JSON.stringify(captured);
    for (const sensitive of ['582964', '4111111111111111', 'fixture@example.invalid'])
      assert.ok(!serialized.includes(sensitive));
  });
});
