import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { startFixture } from '../acceptance/serve.mjs';
import { BrowserSession } from '../src/browser.mjs';
import { DiscoveryBrowser } from '../src/discovery-browser.mjs';

// Engineering integration only. The driver chooses current product candidates;
// no model plans or executes these cases, and no oracle is sent to an Agent.
async function chain(t, caseId) {
  const fixture = await startFixture({ site: 'work-orders' });
  const session = new BrowserSession({ headless: true });
  let discovery;
  t.after(async () => {
    await discovery?.close();
    await session.close();
    await fixture.close();
  });
  const task = {
    id: 'release-discovery-chain',
    target: fixture.origin,
    authorization: { nonproduction: true, writes: false, readOnlyEndpoints: [] },
  };
  await session.open(task);
  await session.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
  await session.loginPage.getByRole('button', { name: '退出登录', exact: true }).waitFor();
  await session.authenticate(task, { kind: 'role', role: 'button', name: '退出登录', exact: true });
  const original = JSON.parse(
    await fs.readFile('acceptance/cases/work-orders.json', 'utf8'),
  ).cases.find((c) => c.case_id === caseId);
  assert.ok(original);
  const baseline = JSON.stringify(original);
  discovery = new DiscoveryBrowser(session, task, { maxSteps: 20 });
  discovery.beginCase(original);
  let observed = await discovery.open();
  const actions = [];
  async function act(name, operation) {
    const matches = observed.candidates.filter(
      (candidate) => candidate.name === name && candidate.operation === operation,
    );
    assert.equal(matches.length, 1, `one current product candidate: ${name}/${operation}`);
    const chosen = matches[0];
    observed = await discovery.act({ candidate_id: chosen.candidate_id });
    actions.push({ name, kind: chosen.kind, locator: chosen.locator });
    assert.equal(JSON.stringify(original), baseline, 'original case remains unchanged');
    assert.deepEqual(fixture.inspect().mutations, [], 'no synthetic business writes');
    return chosen;
  }
  // No direct browser interaction or literal-route rescue after authentication.
  await act('服务台');
  await act('工单中心');
  await act('工单关键字', 'fill');
  const query = await act('查询');
  assert.equal(query.kind, 'query');
  assert.equal(query.evidence.case_id, caseId);
  await act('查看详情');
  return {
    discovery,
    act,
    actions,
    text: () => observed.snapshot.text,
    candidates: () => observed.candidates,
    dialog: (name) => discovery.page.getByRole('dialog', { name, exact: true }),
  };
}

test('engineering WORK-006 chain: query, drawer, local retry, tab persistence and return', async (t) => {
  const f = await chain(t, 'WORK-006');
  const drawer = f.dialog('工单详情');
  assert.ok((await drawer.innerText()).includes('WO-107'));
  await f.act('处理记录');
  assert.ok(f.text().includes('处理记录暂时不可用'));
  assert.ok(!f.text().includes('2026-09-05 更换灯组'));
  const retry = await f.act('重试');
  assert.equal(retry.kind, 'reading');
  assert.equal(retry.evidence.case_id, 'WORK-006');
  assert.ok(f.text().includes('2026-09-05 更换灯组'));
  assert.ok(!f.text().includes('处理记录暂时不可用'));
  assert.ok(!f.candidates().some((c) => c.name === '重试'));
  await f.act('基本信息');
  await f.act('处理记录');
  assert.ok(f.text().includes('2026-09-05 更换灯组'));
  assert.ok(!f.text().includes('处理记录暂时不可用'));
  await f.act('关闭');
  assert.equal(await drawer.isVisible(), false);
  assert.ok(f.text().includes('WO-107'));
  assert.ok(f.text().includes('共1条 · 第1/1页'));
  assert.equal(
    await f.discovery.page.getByLabel('工单关键字', { exact: true }).inputValue(),
    'WO-107',
  );
  assert.deepEqual(
    f.actions.map((action) => action.name),
    [
      '服务台',
      '工单中心',
      '工单关键字',
      '查询',
      '查看详情',
      '处理记录',
      '重试',
      '基本信息',
      '处理记录',
      '关闭',
    ],
  );
});

test('engineering WORK-004 chain: same-name closes dismiss only the active overlay', async (t) => {
  const f = await chain(t, 'WORK-004');
  const drawer = f.dialog('工单详情');
  assert.ok((await drawer.innerText()).includes('WO-104'));
  assert.ok((await drawer.innerText()).includes('顾禾'));
  const help = await f.act('服务说明');
  assert.equal(help.kind, 'reading');
  assert.equal(help.evidence.case_id, 'WORK-004');
  const upper = f.dialog('服务说明');
  assert.ok(await upper.isVisible());
  assert.ok((await upper.innerText()).includes('仅关闭说明，不改变工单状态'));
  const upperClose = await f.act('关闭');
  assert.equal(upperClose.locator.scope.name, '服务说明');
  assert.equal(await upper.isVisible(), false);
  assert.ok(await drawer.isVisible());
  assert.ok((await drawer.innerText()).includes('WO-104'));
  assert.ok((await drawer.innerText()).includes('顾禾'));
  const drawerClose = await f.act('关闭');
  assert.equal(drawerClose.locator.scope.name, '工单详情');
  assert.equal(await drawer.isVisible(), false);
  assert.ok(f.text().includes('WO-104'));
  assert.ok(f.text().includes('共1条 · 第1/1页'));
  assert.equal(
    await f.discovery.page.getByLabel('工单关键字', { exact: true }).inputValue(),
    'WO-104',
  );
  assert.equal(f.actions.length, 8);
});
