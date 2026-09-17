import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';

const locator = (value) => ({ kind: 'testid', value });
const contract = (target, operation, values, case_id = 'C-1') => ({
  case_id,
  entry_path: '/',
  locator: locator(target),
  operation,
  values,
  evidence: { kind: 'source_review', ref: 'fixture:reviewed-handler', no_business_write: true },
});
const original = {
  case_id: 'C-1',
  data: { query: 'alpha', description: 'original description' },
  steps: [{ action: 'Input alpha and choose advanced', expected: 'beta is not an input' }],
};

async function fixture(html, { contracts = [], readOnlyEndpoints = [] } = {}, work) {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      requests.push({ method: req.method, path: req.url });
      res.setHeader('content-type', 'application/json');
      res.end('{"items":["alpha"]}');
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end('<span data-testid="ready">Ready</span>' + html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const task = {
    id: 'discovery-controls',
    target: `http://127.0.0.1:${server.address().port}`,
    authorization: { writes: false, readOnlyEndpoints },
    discovery_interactions: contracts,
  };
  const session = new BrowserSession({ headless: true });
  let discovery;
  try {
    await session.open(task);
    await session.authenticate(task, locator('ready'));
    discovery = new DiscoveryBrowser(session, task, { maxSteps: 16 });
    await discovery.open();
    discovery.beginCase(original);
    await work({ discovery, requests, task });
  } finally {
    await discovery?.close();
    await session.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('dynamic discovery contracts require explicit reviewed non-write evidence and bounded values', () => {
  const item = contract('query', 'fill', ['alpha']);
  for (const invalid of [
    { ...item, evidence: { kind: 'source_review', ref: 'handler' } },
    { ...item, evidence: { ...item.evidence, no_business_write: false } },
    { ...item, evidence: { ...item.evidence, kind: 'model_guess' } },
    { ...item, values: Array(4).fill('alpha') },
    { ...item, values: ['a'.repeat(201)] },
    { ...item, values: ['sk-1234567890'] },
    { ...item, locator: { kind: 'css', value: 'form input' } },
    { ...item, operation: 'submit' },
    { ...item, entry_path: undefined },
    { ...item, entry_path: 'https://outside.invalid/' },
    { ...item, entry_path: '//outside.invalid/' },
    { ...item, entry_path: 'relative-path' },
    { ...item, entry_path: '/\\outside.invalid/' },
    { ...item, entry_path: '/save' },
    {
      ...contract(
        'type',
        'select',
        Array.from({ length: 9 }, (_, i) => String(i)),
      ),
    },
  ])
    assert.throws(
      () => new DiscoveryBrowser({}, { discovery_interactions: [invalid] }),
      (e) => e.code === 'DISCOVERY_INTERACTION_CONTRACT_INVALID',
    );
  assert.doesNotThrow(() => new DiscoveryBrowser({}, { discovery_interactions: [item] }));
});

test('real Chromium exposes dynamic fields only through fixed case-bound input and DOM option candidates', async () => {
  const html = `<label>Query<input data-testid="query" type="search"></label>
    <label>Mode<select data-testid="mode" onchange="document.querySelector('#advanced').hidden=this.value!=='advanced'"><option value="basic">Basic</option><option value="advanced">Advanced</option><option value="disabled" disabled>Disabled</option><option value="hidden" hidden>Hidden</option></select></label>
    <div id="advanced" hidden><label>Description<textarea data-testid="description"></textarea></label></div>
    <label>Password<input data-testid="credential" type="text" autocomplete="current-password"></label>
    <label>Read only<input data-testid="readonly" readonly></label><input data-testid="password" type="password">`;
  const contracts = [
    contract('query', 'fill', ['alpha', 'beta']),
    contract('mode', 'select', ['advanced', 'missing', 'disabled', 'hidden']),
    contract('description', 'fill', ['original description']),
    contract('credential', 'fill', ['alpha']),
    contract('readonly', 'fill', ['alpha']),
    contract('password', 'fill', ['alpha']),
  ];
  await fixture(html, { contracts }, async ({ discovery }) => {
    let observed = await discovery.observe();
    const inputs = observed.candidates.filter((c) => c.operation);
    assert.deepEqual(
      inputs.map((c) => [c.operation, c.value]),
      [
        ['fill', 'alpha'],
        ['select', 'advanced'],
      ],
    );
    const query = inputs.find((c) => c.operation === 'fill');
    await assert.rejects(
      discovery.act({ candidate_id: query.candidate_id, value: 'attacker' }),
      (e) => e.code === 'DISCOVERY_CANDIDATE_FORBIDDEN',
    );
    observed = await discovery.act({ candidate_id: query.candidate_id });
    assert.equal(await discovery.page.getByTestId('query').inputValue(), 'alpha');
    assert.ok(
      !observed.candidates.some((c) => c.operation === 'fill' && c.locator.value === 'query'),
    );
    observed = await discovery.act({
      candidate_id: observed.candidates.find((c) => c.operation === 'select').candidate_id,
    });
    assert.ok(observed.snapshot.controls.some((c) => c.locator.value === 'description'));
    const description = observed.candidates.find((c) => c.locator.value === 'description');
    assert.equal(description.value, 'original description');
    await discovery.act({ candidate_id: description.candidate_id });
    assert.equal(
      await discovery.page.getByTestId('description').inputValue(),
      'original description',
    );
    assert.equal(discovery.step, 3);
  });
});

test('without an operator contract inputs remain unavailable, and the next case cannot reuse a capability', async () => {
  const html = '<label>Query<input data-testid="query" type="search"></label>';
  await fixture(html, {}, async ({ discovery }) =>
    assert.ok(!(await discovery.observe()).candidates.some((c) => c.operation)),
  );
  await fixture(
    html,
    { contracts: [contract('query', 'fill', ['alpha'])] },
    async ({ discovery }) => {
      const candidate = (await discovery.observe()).candidates.find((c) => c.operation === 'fill');
      assert.ok(candidate);
      discovery.beginCase({ ...original, case_id: 'C-2' });
      await assert.rejects(
        discovery.act({ candidate_id: candidate.candidate_id }),
        (e) => e.code === 'DISCOVERY_STALE_PAGE',
      );
      assert.ok(!(await discovery.observe()).candidates.some((c) => c.operation));
    },
  );
});

test('a dynamic capability is confined to its normalized path, query and hash even when testids are reused', async () => {
  const html = '<label>Query<input data-testid="query" type="search"></label>';
  const scoped = {
    ...contract('query', 'fill', ['alpha']),
    entry_path: '/review/../booking/?view=all#filters',
  };
  await fixture(html, { contracts: [scoped] }, async ({ discovery }) => {
    assert.ok(!(await discovery.observe()).candidates.some((c) => c.operation));
    let observed = await discovery.navigate('/booking/?view=all#filters');
    let candidate = observed.candidates.find((c) => c.operation === 'fill');
    assert.ok(candidate);
    assert.equal(candidate.entry_path, '/booking/?view=all#filters');
    await discovery.page.evaluate(() =>
      history.replaceState(null, '', '/service/?view=all#filters'),
    );
    await assert.rejects(
      discovery.act({ candidate_id: candidate.candidate_id }),
      (e) => e.code === 'DISCOVERY_STALE_PAGE',
    );
    assert.ok(!(await discovery.observe()).candidates.some((c) => c.operation));
    for (const wrong of ['/booking/?view=other#filters', '/booking/?view=all#other']) {
      observed = await discovery.navigate(wrong);
      assert.ok(!observed.candidates.some((c) => c.operation));
    }
    observed = await discovery.navigate('/booking/?view=all#filters');
    candidate = observed.candidates.find((c) => c.operation === 'fill');
    assert.ok(candidate);
    await discovery.act({ candidate_id: candidate.candidate_id });
    assert.equal(await discovery.page.getByTestId('query').inputValue(), 'alpha');
  });
});

test('explicit clear capabilities work without empty case text and repeat budgets distinguish semantic input state', async () => {
  await fixture(
    '<label>Query<input data-testid="query" type="search" value="alpha"></label>',
    { contracts: [contract('query', 'fill', [''])] },
    async ({ discovery }) => {
      assert.ok(!Object.values(original.data).includes(''));
      for (const value of ['alpha', 'beta', 'gamma', 'alpha']) {
        await discovery.page.getByTestId('query').evaluate((e, value) => (e.value = value), value);
        const observed = await discovery.observe(),
          clear = observed.candidates.find((c) => c.operation === 'fill' && c.value === '');
        assert.ok(clear);
        await discovery.act({ candidate_id: clear.candidate_id });
        assert.equal(await discovery.page.getByTestId('query').inputValue(), '');
      }
      assert.equal(discovery.step, 4);
      await discovery.page.getByTestId('query').evaluate((e) => (e.value = 'alpha'));
      const repeated = (await discovery.observe()).candidates.find((c) => c.operation === 'fill');
      await assert.rejects(
        discovery.act({ candidate_id: repeated.candidate_id }),
        (e) => e.code === 'DISCOVERY_LOOP_LIMIT',
      );
      assert.equal(discovery.step, 4);
    },
  );
});

test('field values and DOM option changes invalidate previously observed dynamic candidates', async () => {
  await fixture(
    '<label>Query<input data-testid="query" type="search"></label><select data-testid="mode"><option value="basic">Basic</option><option value="advanced">Advanced</option></select>',
    { contracts: [contract('query', 'fill', ['alpha']), contract('mode', 'select', ['advanced'])] },
    async ({ discovery }) => {
      let candidates = (await discovery.observe()).candidates;
      const query = candidates.find((c) => c.operation === 'fill');
      await discovery.page.getByTestId('query').evaluate((e) => (e.value = 'changed'));
      await assert.rejects(
        discovery.act({ candidate_id: query.candidate_id }),
        (e) => e.code === 'DISCOVERY_STALE_PAGE',
      );
      candidates = (await discovery.observe()).candidates;
      const select = candidates.find((c) => c.operation === 'select');
      await discovery.page.getByTestId('mode').evaluate((e) => (e.options[1].disabled = true));
      await assert.rejects(
        discovery.act({ candidate_id: select.candidate_id }),
        (e) => e.code === 'DISCOVERY_STALE_PAGE',
      );
      assert.equal(discovery.step, 0);
    },
  );
});

test('an autosave POST triggered by an approved local input is blocked before reaching the server', async () => {
  await fixture(
    `<label>Query<input data-testid="query" type="search" oninput="fetch('/autosave',{method:'POST',body:this.value}).catch(()=>{})"></label>`,
    { contracts: [contract('query', 'fill', ['alpha'])] },
    async ({ discovery, requests }) => {
      const candidate = (await discovery.observe()).candidates.find((c) => c.operation === 'fill');
      await assert.rejects(
        discovery.act({ candidate_id: candidate.candidate_id }),
        (e) => e.code === 'WRITE_NOT_AUTHORIZED',
      );
      assert.deepEqual(requests, []);
      assert.equal(discovery.guard.blocked, 'WRITE_NOT_AUTHORIZED');
      assert.deepEqual(discovery.blockedRequest, { method: 'POST', path: '/autosave' });
    },
  );
});

test('a select change cannot bypass the form-submit guard even with a reviewed interaction', async () => {
  await fixture(
    `<form method="post" action="/commit"><select data-testid="mode" onchange="this.form.requestSubmit()"><option value="basic">Basic</option><option value="advanced">Advanced</option></select></form>`,
    { contracts: [contract('mode', 'select', ['advanced'])] },
    async ({ discovery, requests }) => {
      const candidate = (await discovery.observe()).candidates.find(
        (c) => c.operation === 'select',
      );
      await assert.rejects(
        discovery.act({ candidate_id: candidate.candidate_id }),
        (e) => e.code === 'DISCOVERY_DISPATCH_BLOCKED',
      );
      assert.deepEqual(requests, []);
    },
  );
});

test('POST queries work only with an existing exact read-only endpoint authorization', async () => {
  await fixture(
    `<label>Query<input data-testid="query" type="search" oninput="fetch('/lookup',{method:'POST',body:this.value}).then(r=>r.json()).then(data=>document.querySelector('#result').textContent=data.items.join(','))"></label><p id="result"></p>`,
    {
      contracts: [contract('query', 'fill', ['alpha'])],
      readOnlyEndpoints: [{ method: 'POST', path: '/lookup' }],
    },
    async ({ discovery, requests }) => {
      const candidate = (await discovery.observe()).candidates.find((c) => c.operation === 'fill');
      const observed = await discovery.act({ candidate_id: candidate.candidate_id });
      assert.deepEqual(requests, [{ method: 'POST', path: '/lookup' }]);
      assert.match(observed.snapshot.text, /alpha/);
      assert.equal(discovery.guard.dirty, false);
    },
  );
});
