import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { startFixture } from '../acceptance/serve.mjs';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { queryFormBinding, queryFormValues } from '../src/query-forms.mjs';
import { DISCOVERY_PROMPT, validateDiscoveryResponse } from '../src/discovery.mjs';

test('query protocol still accepts only a current opaque ID and documents its limited capability', () => {
  const options = {
    candidates: [{ candidate_id: 'query-1', kind: 'query' }],
    caseIds: ['Q-1'],
    currentCaseId: 'Q-1',
  };
  const reply = { action: { candidate_id: 'query-1' }, reason: '按原查询条件观察结果控件' };
  assert.equal(validateDiscoveryResponse(reply, options), reply);
  for (const extra of [{ op: 'submit' }, { value: 'invented' }, { target: 'form' }])
    assert.throws(() =>
      validateDiscoveryResponse({ ...reply, action: { ...reply.action, ...extra } }, options),
    );
  assert.throws(() => validateDiscoveryResponse(reply, { ...options, candidates: [] }), {
    code: 'DISCOVERY_CANDIDATE_UNKNOWN',
  });
  assert.ok(DISCOVERY_PROMPT.includes('A current kind:"query" candidate'));
  assert.ok(DISCOVERY_PROMPT.includes('not permission for arbitrary form submission'));
  // This checks the protocol and prompt text, not real-model compliance.
});

async function frozen(t, site, caseId) {
  const fixture = await startFixture({ site });
  const session = new BrowserSession({ headless: true });
  let discovery;
  t.after(async () => {
    await discovery?.close();
    await session.close();
    await fixture.close();
  });
  const task = {
    id: 'query-forms',
    target: fixture.origin,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  await session.loginPage.getByRole('button', { name: '退出登录', exact: true }).waitFor();
  await session.authenticate(task, { kind: 'role', role: 'button', name: '退出登录', exact: true });
  const original = JSON.parse(
    await fs.readFile(`acceptance/cases/${site}.json`, 'utf8'),
  ).cases.find((c) => c.case_id === caseId);
  discovery = new DiscoveryBrowser(session, task, { maxSteps: 20 });
  discovery.beginCase(original);
  await discovery.open();
  const observed = await discovery.navigate(site === 'work-orders' ? '/#/orders' : '/#/requests');
  return { fixture, discovery, observed, original };
}

async function actNamed(discovery, observed, name, operation) {
  const matches = observed.candidates.filter((c) => c.name === name && c.operation === operation);
  assert.equal(matches.length, 1, `one product candidate for ${name}/${operation}`);
  return discovery.act({ candidate_id: matches[0].candidate_id });
}

test('frozen work-order native GET filter uses original select values and a guarded query candidate', async (t) => {
  const { fixture, discovery, observed, original } = await frozen(t, 'work-orders', 'WORK-002');
  const baseline = JSON.stringify(original);
  assert.ok(
    !observed.candidates.some((c) => c.kind === 'query'),
    'do not submit before source conditions match',
  );
  const region = await actNamed(discovery, observed, '区域', 'select');
  assert.ok(!region.candidates.some((c) => c.kind === 'query'));
  const priority = await actNamed(discovery, region, '优先级', 'select');
  const query = priority.candidates.find((c) => c.kind === 'query');
  assert.ok(query);
  assert.equal(query.evidence.case_id, original.case_id);
  const after = await discovery.act({ candidate_id: query.candidate_id });
  assert.ok(after.snapshot.text.includes('WO-105'));
  assert.ok(!after.snapshot.text.includes('WO-101'));
  assert.deepEqual(fixture.inspect().mutations, []);
  assert.equal(JSON.stringify(original), baseline);
});

test('second frozen UI filters using original quoted field wording and an implicit query verb', async (t) => {
  const { fixture, discovery, observed } = await frozen(t, 'requests', 'REQS-004');
  const filled = await actNamed(discovery, observed, '申请关键字', 'fill');
  const query = filled.candidates.find((c) => c.kind === 'query');
  assert.ok(query);
  const after = await discovery.act({ candidate_id: query.candidate_id });
  assert.ok(after.snapshot.text.includes('没有匹配的申请'));
  assert.deepEqual(fixture.inspect().mutations, []);
  // Only its query segment is exercised, not the preceding wizard or full case.
});

const source = {
  case_id: 'FORM-Q1',
  steps: [
    { step_id: '1', action: '筛选词输入「alpha」，点击「查询」', expected: '不用于产生输入或许可' },
  ],
};
const formHTML = (
  attrs = '',
  body = '',
  handler = 'event.preventDefault(); window.submits=(window.submits||0)+1',
) =>
  `<form id="filters" ${attrs} onsubmit="${handler}"><label>筛选词<input name="q" id="q"></label>${body}<button id="query" type="submit">查询</button></form>`;

async function local(t, html = formHTML(), original = source, options = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<span data-testid="ready">Ready</span>' + html);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const task = {
    id: 'local-query-forms',
    target: `http://127.0.0.1:${server.address().port}`,
    authorization: {
      nonproduction: options.nonproduction ?? true,
      writes: false,
      readOnlyEndpoints: [],
    },
  };
  const session = new BrowserSession({ headless: true });
  const discovery = new DiscoveryBrowser(session, task, { maxSteps: 14, onEvent: options.onEvent });
  t.after(async () => {
    await discovery.close();
    await session.close();
    await new Promise((r) => server.close(r));
  });
  await session.open(task);
  await session.authenticate(task, { kind: 'testid', value: 'ready' });
  discovery.beginCase(original);
  const observed = await discovery.open();
  return { discovery, observed, requests };
}

async function readyQuery(f) {
  const filled = await actNamed(f.discovery, f.observed, '筛选词', 'fill');
  const query = filled.candidates.find((c) => c.kind === 'query');
  assert.ok(query);
  return query;
}

test('actual native GET navigation and SPA submit handlers both use the regular click path', async (t) => {
  for (const native of [true, false])
    await t.test(native ? 'native GET' : 'SPA', async (t) => {
      const events = [];
      const f = await local(t, formHTML('', '', native ? '' : undefined), source, {
        onEvent: (e) => events.push(e),
      });
      const query = await readyQuery(f);
      await f.discovery.act({ candidate_id: query.candidate_id });
      if (native) assert.ok(f.requests.includes('GET /?q=alpha'));
      else assert.equal(await f.discovery.page.evaluate(() => window.submits), 1);
      assert.ok(f.requests.every((r) => r.startsWith('GET ')));
      assert.ok(
        events.some(
          (e) =>
            e.kind === 'DISCOVERY_ACTION_AFTER' && e.detail?.evidence?.kind === 'case_query_form',
        ) || events.some((e) => JSON.stringify(e).includes('case_query_form')),
      );
    });
});

test('source negatives, expectations, synonyms and changed or unrelated values never create query permits', () => {
  const facts = {
    kind: 'native_get_query',
    query_label: '查询',
    fields: [{ tag: 'INPUT', type: 'text', label: '筛选词', value: 'alpha', default_value: '' }],
  };
  assert.equal(queryFormBinding(source, facts).case_id, source.case_id);
  for (const action of [
    '不要' + source.steps[0].action,
    '别在' + source.steps[0].action,
    '不在' + source.steps[0].action,
    '如果有结果则' + source.steps[0].action,
    '筛选词输入「alpha」，点击「搜索」',
    '页面提示：查询条件为alpha',
    '查询',
    '筛选词输入「alpha」后再输入「beta」，点击「查询」',
  ]) {
    const c = { ...source, steps: [{ action, expected: source.steps[0].action }] };
    assert.equal(queryFormBinding(c, facts), null, action);
    assert.deepEqual(queryFormValues(c, facts, facts.fields[0], '筛选词'), [], action);
  }
  assert.equal(
    queryFormBinding(source, { ...facts, fields: [{ ...facts.fields[0], value: 'beta' }] }),
    null,
  );
  assert.equal(
    queryFormBinding(source, {
      ...facts,
      fields: [
        ...facts.fields,
        { tag: 'INPUT', type: 'text', label: '其他', value: 'unexpected', default_value: '' },
      ],
    }),
    null,
  );
});

test('unsafe methods, overrides, ambiguous and sensitive fields do not gain the query capability', async (t) => {
  const variants = [
    ['POST', formHTML('method="post"')],
    ['foreign action', formHTML('action="https://example.invalid/"')],
    ['dangerous GET', formHTML('action="/delete"')],
    ['existing query params', formHTML('action="/?action=delete"')],
    ['new target', formHTML('target="_blank"')],
    ['hidden input', formHTML('', '<input type="hidden" name="extra" value="x">')],
    ['duplicate names', formHTML('', '<label>另一个<input name="q"></label>')],
    ['duplicate labels', formHTML('', '<label>筛选词<input name="other"></label>')],
    ['named property', formHTML('', '<label>其他<input name="action"></label>')],
    ['save button', formHTML('', '<button type="button">保存</button>')],
    ['sensitive input', formHTML().replace('name="q"', 'name="token"')],
    ['disabled fieldset', '<fieldset disabled>' + formHTML() + '</fieldset>'],
    ['dialog', '<dialog open>' + formHTML() + '</dialog>'],
    ['external control', formHTML() + '<input form="filters" aria-label="其他">'],
    ['same form IDs', formHTML() + '<form id="filters"></form>'],
    ['named submitter', formHTML().replace('id="query"', 'id="query" name="mode"')],
    ...[
      'formaction="/delete"',
      'formmethod="post"',
      'formtarget="_blank"',
      'formenctype="text/plain"',
      'formnovalidate',
      'form="filters"',
    ].map((a) => [a, formHTML().replace('id="query"', `id="query" ${a}`)]),
  ];
  for (const [name, html] of variants)
    await t.test(name, async (t) => {
      const f = await local(t, html);
      assert.ok(!f.observed.candidates.some((c) => c.operation || c.kind === 'query'), name);
      assert.ok(!f.requests.some((r) => !r.startsWith('GET ') || r.includes('/delete')));
    });
});

test('case changes and pre-dispatch form/value/identity changes invalidate a query candidate', async (t) => {
  for (const change of ['case', 'value', 'action', 'identity', 'field identity'])
    await t.test(change, async (t) => {
      const f = await local(t);
      const query = await readyQuery(f);
      if (change === 'case') f.discovery.beginCase({ ...source, steps: [] });
      else
        await f.discovery.page.evaluate((change) => {
          if (change === 'value') document.querySelector('input').value = 'other';
          if (change === 'action') document.querySelector('form').action = '/other';
          if (change === 'identity') {
            const old = document.querySelector('button');
            old.replaceWith(old.cloneNode(true));
          }
          if (change === 'field identity') {
            const old = document.querySelector('input');
            const replacement = old.cloneNode(true);
            replacement.value = old.value;
            old.replaceWith(replacement);
          }
        }, change);
      await assert.rejects(f.discovery.act({ candidate_id: query.candidate_id }), {
        code: 'DISCOVERY_STALE_PAGE',
      });
      assert.equal(await f.discovery.page.evaluate(() => window.submits || 0), 0);
    });
});

test('click-to-submit changes and unrelated or repeated submissions are refused at event time', async (t) => {
  const actions = [
    ['method', "this.form.method='post'"],
    ['override', "this.setAttribute('formaction','/delete')"],
    ['value', "this.form.querySelector('input').value='changed'"],
    ['identity', "const f=this.form.querySelector('input');f.replaceWith(f.cloneNode(true))"],
    ['implicit submitter', 'this.form.requestSubmit();event.preventDefault()'],
    ['unrelated form', "document.querySelector('#other').requestSubmit();event.preventDefault()"],
    [
      'duplicate',
      'event.preventDefault();this.form.requestSubmit(this);this.form.requestSubmit(this)',
    ],
  ];
  for (const [name, handler] of actions)
    await t.test(name, async (t) => {
      const html =
        formHTML().replace('id="query"', `id="query" onclick="${handler}"`) +
        '<form id="other" onsubmit="event.preventDefault();window.otherSubmit=1"></form>';
      const f = await local(t, html),
        query = await readyQuery(f);
      await assert.rejects(f.discovery.act({ candidate_id: query.candidate_id }), {
        code: 'DISCOVERY_DISPATCH_BLOCKED',
      });
      assert.equal(await f.discovery.page.evaluate(() => window.otherSubmit || 0), 0);
      assert.equal(
        await f.discovery.page.evaluate(() => window.submits || 0),
        name === 'duplicate' ? 1 : 0,
      );
      assert.ok(!f.requests.some((r) => r.startsWith('POST ') || r.includes('/delete')));
    });
});

test('no submit permission during filling or after action cleanup; query names do not authorize network writes', async (t) => {
  const samples = [
    ['during fill', formHTML().replace('name="q"', 'name="q" oninput="this.form.requestSubmit()"')],
    [
      'POST handler',
      formHTML('', '', "event.preventDefault();fetch('/save',{method:'POST'}).catch(()=>{})"),
    ],
    [
      'dangerous GET handler',
      formHTML('', '', "event.preventDefault();fetch('/delete').catch(()=>{})"),
    ],
  ];
  for (const [name, html] of samples)
    await t.test(name, async (t) => {
      const f = await local(t, html);
      const candidate =
        name === 'during fill'
          ? f.observed.candidates.find((c) => c.operation === 'fill')
          : await readyQuery(f);
      assert.ok(candidate);
      await assert.rejects(f.discovery.act({ candidate_id: candidate.candidate_id }), (e) =>
        [
          'DISCOVERY_DISPATCH_BLOCKED',
          'WRITE_NOT_AUTHORIZED',
          'DISCOVERY_DANGEROUS_ROUTE',
        ].includes(e.code),
      );
      assert.ok(
        !f.requests.some(
          (r) => r.startsWith('POST ') || r.includes('/delete') || r.includes('/save'),
        ),
      );
    });
  await t.test('after cleanup', async (t) => {
    const f = await local(t),
      query = await readyQuery(f);
    await f.discovery.act({ candidate_id: query.candidate_id });
    await f.discovery.page.evaluate(() =>
      document.querySelector('form').requestSubmit(document.querySelector('button')),
    );
    assert.equal(await f.discovery.page.evaluate(() => window.submits), 1);
    await assert.rejects(f.discovery.observe(), { code: 'DISCOVERY_DISPATCH_BLOCKED' });
  });
  await t.test('nonproduction not authorized', async (t) => {
    const f = await local(t, formHTML(), source, { nonproduction: false });
    assert.ok(!f.observed.candidates.some((c) => c.operation || c.kind === 'query'));
  });
});

test('late named-control shadowing must fail closed even when DOM inspection throws', async (t) => {
  const html = formHTML().replace(
    'id="query"',
    `id="query" onclick="this.form.querySelector('input').name='getAttribute'"`,
  );
  const f = await local(t, html),
    query = await readyQuery(f);
  let error;
  try {
    await f.discovery.act({ candidate_id: query.candidate_id });
  } catch (e) {
    error = e;
  }
  assert.deepEqual(
    { code: error?.code, submits: await f.discovery.page.evaluate(() => window.submits || 0) },
    { code: 'DISCOVERY_DISPATCH_BLOCKED', submits: 0 },
  );
});
