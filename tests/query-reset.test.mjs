import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { startFixture } from '../acceptance/serve.mjs';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { queryResetBinding } from '../src/query-forms.mjs';
import { DISCOVERY_PROMPT, validateDiscoveryResponse } from '../src/discovery.mjs';

const source = {
  case_id: 'RESET-1',
  steps: [
    { step_id: '1', action: '筛选词输入「alpha」，点击「查询」', expected: '原查询结果' },
    { step_id: '2', action: '点击「重置」', expected: '默认筛选结果' },
  ],
};
function form({ attrs = '', reset = '', input = '', extra = '', handler } = {}) {
  return `<form id="filters" ${attrs} onsubmit="event.preventDefault();window.submits=(window.submits||0)+1" onreset="${handler ?? 'window.resets=(window.resets||0)+1'}"><label>筛选词<input name="q" ${input}></label>${extra}<button type="submit">查询</button><button id="reset-control" type="reset" ${reset}>重置</button></form>`;
}
async function act(discovery, observed, name, operation) {
  const matches = observed.candidates.filter((c) => c.name === name && c.operation === operation);
  assert.equal(matches.length, 1, `one product candidate: ${name}/${operation}`);
  return discovery.act({ candidate_id: matches[0].candidate_id });
}
async function local(t, html = form(), original = source, nonproduction = true) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.method + ' ' + req.url);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<span data-testid="ready">Ready</span>' + html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const session = new BrowserSession({ headless: true });
  let discovery;
  t.after(async () => {
    await discovery?.close();
    await session.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const task = {
    id: 'reset-query',
    target: `http://127.0.0.1:${server.address().port}`,
    authorization: { nonproduction, writes: false, readOnlyEndpoints: [] },
  };
  await session.open(task);
  await session.authenticate(task, { kind: 'testid', value: 'ready' });
  discovery = new DiscoveryBrowser(session, task, { maxSteps: 15 });
  discovery.beginCase(original);
  return { discovery, observed: await discovery.open(), requests };
}
async function ready(f) {
  const filled = await act(f.discovery, f.observed, '筛选词', 'fill');
  const queried = await act(f.discovery, filled, '查询');
  const reset = queried.candidates.find((c) => c.kind === 'query_reset');
  assert.ok(reset, 'reset candidate after original query');
  return reset;
}

test('frozen WORK-002 query/reset uses only product candidates from the home page', async (t) => {
  const fixture = await startFixture({ site: 'work-orders' });
  const session = new BrowserSession({ headless: true });
  let discovery;
  t.after(async () => {
    await discovery?.close();
    await session.close();
    await fixture.close();
  });
  const task = {
    id: 'frozen-reset',
    target: fixture.origin,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  await session.loginPage.getByRole('button', { name: '退出登录', exact: true }).waitFor();
  await session.authenticate(task, { kind: 'role', role: 'button', name: '退出登录', exact: true });
  const original = JSON.parse(
    await fs.readFile('acceptance/cases/work-orders.json', 'utf8'),
  ).cases.find((c) => c.case_id === 'WORK-002');
  const baseline = JSON.stringify(original);
  discovery = new DiscoveryBrowser(session, task, { maxSteps: 15 });
  discovery.beginCase(original);
  let o = await discovery.open();
  for (const [name, operation] of [
    ['服务台'],
    ['工单中心'],
    ['区域', 'select'],
    ['优先级', 'select'],
    ['查询'],
  ])
    o = await act(discovery, o, name, operation);
  assert.ok(o.snapshot.text.includes('WO-105'));
  assert.ok(!o.snapshot.text.includes('WO-101'));
  const reset = o.candidates.find((c) => c.name === '重置');
  assert.equal(reset?.kind, 'query_reset');
  assert.equal(reset.evidence.source_quote, '点击「重置」');
  assert.equal(reset.evidence.query_step_id, '1');
  const after = await discovery.act({ candidate_id: reset.candidate_id });
  assert.ok(after.snapshot.text.includes('共8条 · 第1/3页'));
  for (const id of ['WO-101', 'WO-102', 'WO-103']) assert.ok(after.snapshot.text.includes(id));
  for (const name of ['工单关键字', '区域', '优先级']) {
    const controls = after.snapshot.controls.filter((c) => c.name === name);
    assert.equal(controls.length, 1);
    if (name === '工单关键字') assert.equal(controls[0].current_value, '');
    else assert.equal(controls[0].selected_label, '全部');
  }
  assert.ok(!after.candidates.some((c) => c.kind === 'query_reset'));
  assert.deepEqual(fixture.inspect().mutations, []);
  assert.equal(JSON.stringify(original), baseline);
  // This is operator-selected engineering integration, not a model-generated plan.
});

test('reset binding needs a preceding original query and exact positive standalone reset action', () => {
  const facts = {
    kind: 'native_get_query',
    query_label: '查询',
    reset_label: '重置',
    fields: [{ label: '筛选词', tag: 'INPUT', type: 'text', value: 'alpha', default_value: '' }],
  };
  assert.equal(queryResetBinding(source, facts).step_id, '2');
  for (const action of [
    '不要点击「重置」',
    '别在查询区点击「重置」',
    '如果有条件则点击「重置」',
    '点击「清空」',
    '页面提示：点击「重置」',
    '重置',
    '点击「重置」后提交申请',
  ]) {
    const c = structuredClone(source);
    c.steps[1].action = action;
    c.steps[1].expected = '点击「重置」';
    assert.equal(queryResetBinding(c, facts), null, action);
  }
  assert.equal(queryResetBinding({ ...source, steps: [...source.steps].reverse() }, facts), null);
  assert.equal(queryResetBinding({ ...source, steps: [source.steps[1]] }, facts), null);
  assert.equal(queryResetBinding(source, { ...facts, reset_label: '重置设备' }), null);
  assert.equal(
    queryResetBinding(source, { ...facts, fields: [{ ...facts.fields[0], value: 'other' }] }),
    null,
  );
  assert.ok(DISCOVERY_PROMPT.includes('kind:"query_reset"'));
  const reply = { action: { candidate_id: 'id' }, reason: '恢复原查询条件' };
  assert.equal(
    validateDiscoveryResponse(reply, {
      candidates: [{ candidate_id: 'id', kind: 'query_reset' }],
      caseIds: ['RESET-1'],
      currentCaseId: 'RESET-1',
    }),
    reply,
  );
});

test('native reset restores defaults with one event, no submit permission and no surviving permit', async (t) => {
  const f = await local(t),
    reset = await ready(f);
  assert.equal(await f.discovery.page.evaluate(() => window.submits), 1);
  await f.discovery.act({ candidate_id: reset.candidate_id });
  assert.equal(await f.discovery.page.getByLabel('筛选词', { exact: true }).inputValue(), '');
  assert.equal(await f.discovery.page.evaluate(() => window.resets), 1);
  assert.equal(await f.discovery.page.evaluate(() => window.submits), 1);
  await f.discovery.page.evaluate(() => document.querySelector('form').reset());
  assert.equal(await f.discovery.page.evaluate(() => window.resets), 1);
  await assert.rejects(f.discovery.observe(), { code: 'DISCOVERY_DISPATCH_BLOCKED' });
  assert.ok(f.requests.every((r) => r.startsWith('GET ')));
});

test('unsafe or ambiguous form/reset targets do not acquire reset capability', async (t) => {
  const variants = [
    ['POST', form({ attrs: 'method="post"' })],
    ['business route', form({ attrs: 'action="/reset"' })],
    [
      'custom button',
      form().replace('id="reset-control" type="reset"', 'id="reset-control" type="button"'),
    ],
    ['device reset', form().replace('>重置</button>', '>重置设备</button>')],
    ['duplicate', form({ extra: '<button type="reset">重置</button>' })],
    ['named', form({ reset: 'name="mode"' })],
    ['override', form({ reset: 'formaction="/delete"' })],
    ['external field', form() + '<input form="filters" aria-label="外部">'],
    ['hidden input', form({ extra: '<input type="hidden" name="token">' })],
    ['save button', form({ extra: '<button type="button">保存</button>' })],
    ['dialog', '<dialog open>' + form() + '</dialog>'],
  ];
  for (const [name, html] of variants)
    await t.test(name, async (t) => {
      const f = await local(t, html);
      const fill = f.observed.candidates.find((c) => c.operation === 'fill');
      const o = fill ? await f.discovery.act({ candidate_id: fill.candidate_id }) : f.observed;
      assert.ok(!o.candidates.some((c) => c.kind === 'query_reset'));
      assert.equal(await f.discovery.page.evaluate(() => window.resets || 0), 0);
    });
  await t.test('no nonproduction authorization', async (t) => {
    const f = await local(t, form(), source, false);
    assert.ok(!f.observed.candidates.some((c) => c.kind === 'query_reset' || c.operation));
  });
});

test('case, form, control identity and value changes invalidate a reset before dispatch', async (t) => {
  for (const change of ['case', 'value', 'default', 'method', 'reset node', 'field node'])
    await t.test(change, async (t) => {
      const f = await local(t),
        reset = await ready(f);
      if (change === 'case') f.discovery.beginCase({ ...source, steps: [] });
      else
        await f.discovery.page.evaluate((change) => {
          const field = document.querySelector('input');
          if (change === 'value') field.value = 'other';
          if (change === 'default') field.defaultValue = 'other';
          if (change === 'method') document.querySelector('form').method = 'post';
          if (change === 'reset node') {
            const e = document.querySelector('#reset-control');
            e.replaceWith(e.cloneNode(true));
          }
          if (change === 'field node') {
            const e = field.cloneNode(true);
            e.value = field.value;
            field.replaceWith(e);
          }
        }, change);
      await assert.rejects(f.discovery.act({ candidate_id: reset.candidate_id }), {
        code: 'DISCOVERY_STALE_PAGE',
      });
      assert.equal(await f.discovery.page.evaluate(() => window.resets || 0), 0);
    });
});

test('click-to-reset mutations, cross-form/repeated reset and submit are blocked at the event', async (t) => {
  const variants = [
    ['value', "this.form.querySelector('input').value='other'"],
    ['default', "this.form.querySelector('input').defaultValue='other'"],
    ['method', "this.form.method='post'"],
    [
      'field node',
      "const e=this.form.querySelector('input');const c=e.cloneNode(true);c.value=e.value;e.replaceWith(c)",
    ],
    ['shadow inspection', "this.form.querySelector('input').name='getAttribute'"],
    ['other form', "event.preventDefault();document.querySelector('#other').reset()"],
    ['duplicate', 'event.preventDefault();this.form.reset();this.form.reset()'],
    [
      'submit',
      "event.preventDefault();this.form.requestSubmit(this.form.querySelector('[type=submit]'))",
    ],
    [
      'synthetic event',
      "event.preventDefault();this.form.dispatchEvent(new Event('reset',{bubbles:true,cancelable:true}))",
    ],
  ];
  for (const [name, handler] of variants)
    await t.test(name, async (t) => {
      const f = await local(
        t,
        form({ reset: `onclick="${handler}"` }) +
          '<form id="other" onreset="window.otherReset=1"></form>',
      );
      const reset = await ready(f);
      await assert.rejects(f.discovery.act({ candidate_id: reset.candidate_id }), {
        code: 'DISCOVERY_DISPATCH_BLOCKED',
      });
      assert.equal(await f.discovery.page.evaluate(() => window.otherReset || 0), 0);
      assert.equal(
        await f.discovery.page.evaluate(() => window.resets || 0),
        name === 'duplicate' ? 1 : 0,
      );
      assert.equal(await f.discovery.page.evaluate(() => window.submits), 1);
      assert.ok(!f.requests.some((r) => r.startsWith('POST ') || r.includes('/delete')));
    });
});

test('pointerdown refusal must latch before the original reset click can dispatch', async (t) => {
  const f = await local(
    t,
    form({ reset: 'onmousedown="document.querySelector(\'#other\').reset()"' }) +
      '<form id="other" onreset="window.otherReset=1"></form>',
  );
  const reset = await ready(f);
  await assert.rejects(f.discovery.act({ candidate_id: reset.candidate_id }), {
    code: 'DISCOVERY_DISPATCH_BLOCKED',
  });
  assert.equal(await f.discovery.page.evaluate(() => window.otherReset || 0), 0);
  assert.equal(await f.discovery.page.evaluate(() => window.resets || 0), 0);
});

test('reset during another action and reset-handler network writes stay blocked', async (t) => {
  await t.test('during fill', async (t) => {
    const f = await local(t, form({ input: 'oninput="this.form.reset()"' }));
    const fill = f.observed.candidates.find((c) => c.operation === 'fill');
    assert.ok(fill);
    await assert.rejects(f.discovery.act({ candidate_id: fill.candidate_id }), {
      code: 'DISCOVERY_DISPATCH_BLOCKED',
    });
    assert.equal(await f.discovery.page.evaluate(() => window.resets || 0), 0);
  });
  for (const [name, handler] of [
    ['POST', "fetch('/save',{method:'POST'}).catch(()=>{})"],
    ['dangerous GET', "fetch('/reset').catch(()=>{})"],
  ])
    await t.test(name, async (t) => {
      const f = await local(t, form({ handler })),
        reset = await ready(f);
      await assert.rejects(f.discovery.act({ candidate_id: reset.candidate_id }), (e) =>
        ['WRITE_NOT_AUTHORIZED', 'DISCOVERY_DANGEROUS_ROUTE'].includes(e.code),
      );
      assert.ok(
        !f.requests.some(
          (r) => r.startsWith('POST ') || r.includes('/save') || r.includes('/reset'),
        ),
      );
    });
});
