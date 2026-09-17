import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { normalizeDiscoveryResponse, validateDiscoveryResponse } from '../src/discovery.mjs';
import { perform, checkAssertionGroup, snapshot, BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { normalizePlanResponse } from '../src/plans.mjs';

const context = {
  candidates: [{ candidate_id: 'current-id' }],
  caseIds: ['C1'],
  currentCaseId: 'C1',
};
test('plan envelope adaptation never strips contradictory flags or extra fields', () => {
  const plan = { schema_version: 'ui-agent-plan/v2' },
    bare = normalizePlanResponse(plan);
  assert.equal(bare.plan, plan);
  assert.deepEqual(normalizePlanResponse({ blocked: false, plan }), { plan });
  for (const value of [
    { blocked: true, plan },
    { blocked: false, plan, actions: [] },
    { plan, reason: 'extra' },
  ])
    assert.equal(normalizePlanResponse(value), value);
});
test('hash navigation observes delayed list response instead of previous networkidle', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/rows') {
      setTimeout(() => {
        res.setHeader('content-type', 'application/json');
        res.end('["A","B"]');
      }, 350);
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(
      `<strong data-testid="signed-in">User</strong><a href="#items" data-testid="items" onclick="setTimeout(load,0)">Items</a><main id="content">Home</main><script>async function load(){document.querySelector('main').textContent='Loading';const rows=await(await fetch('/rows')).json();document.querySelector('main').innerHTML='<table data-testid="grid"><tbody>'+rows.map(x=>'<tr><td>'+x+'</td></tr>').join('')+'</tbody></table>';}</script>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const target = `http://127.0.0.1:${server.address().port}`;
  const task = {
      id: 'settle-test',
      target,
      authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
    },
    session = new BrowserSession({ headless: true });
  let discovery;
  try {
    await session.open(task);
    await session.authenticate(task, { kind: 'testid', value: 'signed-in' });
    discovery = new DiscoveryBrowser(session, task, {});
    const initial = await discovery.open();
    const candidate = initial.candidates.find((c) => c.name === 'Items');
    assert.ok(candidate);
    const next = await discovery.act({ candidate_id: candidate.candidate_id });
    assert.equal(next.snapshot.controls.find((c) => c.locator.value === 'grid')?.row_count, 2);
    assert.ok(!next.snapshot.text.includes('Loading'));
  } finally {
    await discovery?.close();
    await session.close();
    await new Promise((r) => server.close(r));
  }
});
test('actual nested explanation is normalized without mutating raw evidence or allowing new targets', () => {
  const raw = { action: { candidate_id: 'current-id', reason: '查看页面' } },
    before = structuredClone(raw);
  const normalized = normalizeDiscoveryResponse(raw);
  assert.deepEqual(validateDiscoveryResponse(normalized, context), {
    action: { candidate_id: 'current-id' },
    reason: '查看页面',
  });
  assert.deepEqual(raw, before);
  for (const value of [
    { action: { candidate_id: 'missing-id', reason: '查看页面' } },
    { action: { candidate_id: 'current-id', reason: '查看页面', op: 'click' } },
    { action: { candidate_id: 'current-id', reason: '查看页面' }, reason: 'ambiguous' },
    { action: { candidate_id: 'current-id', reason: '查看页面' }, done: true },
  ])
    assert.throws(() => validateDiscoveryResponse(normalizeDiscoveryResponse(value), context));
});

test('reload preserves real cookie session; simultaneous predicates measure actual state and table data rows', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      `<button data-testid="next" disabled>Next</button><fieldset disabled><button data-testid="inherited">Disabled by fieldset</button></fieldset><select data-testid="filter"><option value="">All</option><option value="one">First</option></select><table data-testid="grid"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Item A</td></tr><tr><td>Item B</td></tr></tbody></table><span data-testid="auth">${req.headers.cookie?.includes('session=synthetic') ? 'Signed in' : 'Signed out'}</span>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: 'session', value: 'synthetic', url }]);
    const page = await ctx.newPage();
    await page.goto(url);
    await perform(page, { action_id: 'refresh', op: 'reload' }, url);
    const target = (value) => ({ kind: 'testid', value });
    const observed = await checkAssertionGroup(page, [
      { target: target('auth'), check: 'text', expected: 'Signed in' },
      { target: target('next'), check: 'enabled', expected: false },
      { target: target('inherited'), check: 'enabled', expected: false },
      { target: target('grid'), check: 'row_count', expected: 2 },
      { target: target('filter'), check: 'selected_label', expected: 'All' },
    ]);
    assert.ok(
      observed.every((o) => o.passed),
      JSON.stringify(observed),
    );
    const contrary = await checkAssertionGroup(
      page,
      [
        { target: target('grid'), check: 'row_count', expected: 3 },
        { target: target('next'), check: 'enabled', expected: true },
      ],
      { timeout: 150 },
    );
    assert.ok(contrary.every((o) => !o.passed));
    const facts = await snapshot(page);
    assert.equal(facts.controls.find((c) => c.locator.value === 'grid').row_count, 2);
    assert.deepEqual(facts.controls.find((c) => c.locator.value === 'filter').options, [
      { label: 'All', value: '' },
      { label: 'First', value: 'one' },
    ]);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
