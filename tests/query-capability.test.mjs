import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';
import { queryValues } from '../src/query-capability.mjs';
import { dynamicRowEvidence } from '../src/dynamic-row-evidence.mjs';
import { blockAuditInput, validateBlockAudit } from '../src/block-audit.mjs';

const original = {
  case_id: 'Q-1',
  steps: [
    {
      step_id: '1',
      action: '名称关键字输入「一号冷却塔」后点击「查询」',
      expected: '错误值不可成为输入',
    },
    { step_id: '2', action: '园区下拉选「梧桐园」，点击「查询」', expected: '园区为云杉园' },
  ],
};
const input = { tag: 'INPUT', type: 'text', label: '名称关键字' };
const select = {
  tag: 'SELECT',
  label: '园区',
  options: [
    { label: '全部', value: '' },
    { label: '梧桐园', value: 'park-2' },
  ],
};
test('query literals bind to the specific field and original action, never expected/page/model values', () => {
  assert.deepEqual(
    queryValues(original, input, '').map((x) => x.value),
    ['一号冷却塔'],
  );
  assert.deepEqual(
    queryValues(original, select, '').map((x) => x.value),
    ['park-2'],
  );
  assert.deepEqual(queryValues(original, { ...input, label: '无关字段' }, ''), []);
  assert.deepEqual(
    queryValues({ steps: [{ action: '读取字段', expected: original.steps[0].action }] }, input, ''),
    [],
  );
  assert.deepEqual(
    queryValues(
      original,
      { ...select, options: [{ label: '梧桐园', value: '2', disabled: true }] },
      '',
    ),
    [],
  );
  assert.deepEqual(
    queryValues(original, { ...select, options: [...select.options, select.options[1]] }, ''),
    [],
  );
  assert.deepEqual(queryValues(original, { ...input, type: 'password' }, ''), []);
  assert.deepEqual(
    queryValues({ steps: [{ action: '用户名称关键字输入「不属于该字段」' }] }, input, ''),
    [],
  );
});

async function fixture(t, extra = '', onInput = '', wrappedSelect = false) {
  let writes = 0;
  const html = `<span data-testid="ready">Ready</span><div id="filters">
    <label>名称关键字<input type="text" id="query" ${onInput}></label>
    ${wrappedSelect ? '<label>园区' : '<label for="park">园区</label>'}<select id="park"><option value="">全部</option><option value="park-2">梧桐园</option></select>${wrappedSelect ? '</label>' : ''}
    <button type="button">查询</button>${extra}</div>`;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') writes++;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const task = {
    id: 'query',
    target: `http://127.0.0.1:${server.address().port}/`,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  const session = new BrowserSession({ headless: true });
  const explorer = new DiscoveryBrowser(session, task, { maxSteps: 12 });
  t.after(async () => {
    await explorer.close();
    await session.close();
    await new Promise((r) => server.close(r));
  });
  await session.open(task);
  await session.authenticate(task, { kind: 'testid', value: 'ready' });
  explorer.beginCase(original);
  const observation = await explorer.open();
  return { explorer, observation, writes: () => writes };
}

test('Chromium provides field-bound query/select candidates without manual contracts and invalidates changed case', async (t) => {
  const { explorer, observation } = await fixture(t);
  const values = observation.candidates.filter((c) => c.operation);
  assert.deepEqual(
    values.map((c) => c.value),
    ['一号冷却塔', 'park-2'],
    JSON.stringify(observation.snapshot),
  );
  assert.ok(values.every((c) => c.evidence.kind === 'observed_query_scope'));
  await assert.rejects(explorer.act({ candidate_id: values[0].candidate_id, value: 'invented' }), {
    code: 'DISCOVERY_CANDIDATE_FORBIDDEN',
  });
  let next = await explorer.act({ candidate_id: values[0].candidate_id });
  assert.equal(await explorer.page.locator('#query').inputValue(), '一号冷却塔');
  const choice = next.candidates.find((c) => c.operation === 'select');
  await explorer.act({ candidate_id: choice.candidate_id });
  assert.equal(await explorer.page.locator('#park').inputValue(), 'park-2');
  next = await explorer.navigate('/');
  const stale = next.candidates.find((c) => c.operation === 'fill');
  explorer.beginCase({ ...original, steps: [] });
  await assert.rejects(explorer.act({ candidate_id: stale.candidate_id }), {
    code: 'DISCOVERY_STALE_PAGE',
  });
});

test('query inference rejects save forms, sensitive fields, unapproved environments and scope changes', async (t) => {
  const { explorer, observation } = await fixture(t, '<button type="button">保存</button>');
  assert.ok(!observation.candidates.some((c) => c.operation));
  await explorer.page
    .getByRole('button', { name: '保存', exact: true })
    .evaluate((e) => e.remove());
  const candidate = (await explorer.observe()).candidates.find((c) => c.operation === 'fill');
  assert.ok(candidate);
  await explorer.page
    .locator('#query')
    .evaluate((e) => e.setAttribute('autocomplete', 'current-password'));
  await assert.rejects(explorer.act({ candidate_id: candidate.candidate_id }), {
    code: 'DISCOVERY_STALE_PAGE',
  });
  assert.ok(!(await explorer.observe()).candidates.some((c) => c.operation === 'fill'));
  explorer.task.authorization.nonproduction = false;
  assert.ok(!(await explorer.observe()).candidates.some((c) => c.operation));
});

test('wrapped native select offers and executes only the original field-bound query value', async (t) => {
  const { explorer, observation, writes } = await fixture(t, '', '', true);
  const choices = observation.candidates.filter((c) => c.operation === 'select');
  assert.equal(choices.length, 1);
  assert.equal(choices[0].name, '园区');
  assert.equal(choices[0].value, 'park-2');
  assert.equal(choices[0].evidence.kind, 'observed_query_scope');
  const next = await explorer.act({ candidate_id: choices[0].candidate_id });
  assert.equal(await explorer.page.locator('#park').inputValue(), 'park-2');
  assert.equal(next.snapshot.controls.find((c) => c.role === 'combobox').name, '园区');
  assert.ok(!next.candidates.some((c) => c.operation === 'select'));
  assert.equal(writes(), 0);
});

test('query input cannot send autosave POST or trigger form submission', async (t) => {
  for (const handler of [
    "fetch('/autosave',{method:'POST'}).catch(()=>{})",
    "document.querySelector('form').requestSubmit()",
  ]) {
    await t.test(handler.startsWith('fetch') ? 'network write' : 'form submit', async (t) => {
      const { explorer, observation, writes } = await fixture(
        t,
        '<form method="post"><input name="x"></form>',
        `oninput="${handler}"`,
      );
      const candidate = observation.candidates.find((c) => c.operation === 'fill');
      assert.ok(candidate);
      await assert.rejects(explorer.act({ candidate_id: candidate.candidate_id }), (e) =>
        ['WRITE_NOT_AUTHORIZED', 'DISCOVERY_DISPATCH_BLOCKED'].includes(e.code),
      );
      assert.equal(writes(), 0);
    });
  }
});

test('dynamic row evidence contains observed schema/pattern, not invented future rows or success', () => {
  const table = { kind: 'role', role: 'table', name: '设备列表', exact: true };
  const target = { kind: 'role', role: 'button', name: '详情', exact: true };
  const pages = [
    {
      url: 'http://localhost/devices',
      controls: [
        { locator: table, headers: ['编号', '园区', '操作'] },
        { locator: { kind: 'row', table, key: { column: '编号', value: 'first' }, target } },
      ],
    },
  ];
  const bindings = dynamicRowEvidence(pages);
  assert.equal(bindings.length, 1);
  assert.deepEqual(bindings[0].inner_targets, [target]);
  assert.ok(!JSON.stringify(bindings).includes('first'));
  assert.deepEqual(
    dynamicRowEvidence([{ ...pages[0], network_issues: [{ code: 'blocked' }] }]),
    [],
  );
  const audit = blockAuditInput(
    { pages, technical_context: { dynamic_row_bindings: bindings } },
    { blocked: true },
  );
  const ref = audit.evidence_catalog.find((c) => c.fact.kind === 'dynamic_row_binding');
  assert.doesNotThrow(() =>
    validateBlockAudit(
      {
        outcome: 'REPAIR',
        reason: '保留原查询，按原园区条件运行时唯一绑定',
        evidence_refs: [{ evidence_id: ref.evidence_id, fact: ref.fact }],
      },
      audit,
    ),
  );
  assert.throws(() =>
    validateBlockAudit(
      {
        outcome: 'REPAIR',
        reason: 'invented',
        evidence_refs: [{ evidence_id: ref.evidence_id, fact: { ...ref.fact, success: true } }],
      },
      audit,
    ),
  );
});
