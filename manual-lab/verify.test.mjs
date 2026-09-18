import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startLab } from './serve.mjs';
import { importCases, mechanicalIssues } from '../src/importer.mjs';

// Independently authored from SPEC before inspecting the implementation. Not an Agent run.
let lab, browser;
const groups = {};
before(async () => {
  lab = await startLab(0);
  browser = await chromium.launch({ headless: true });
  for (const file of ['01-valid', '02-needs-review', '03-known-defects']) {
    groups[file] = await importCases(
      file + '.json',
      await fs.readFile(new URL('./cases/' + file + '.json', import.meta.url)),
    );
  }
});
after(async () => {
  await browser?.close();
  await lab?.close();
});
const button = (p, name) => p.getByRole('button', { name, exact: true });
const dialog = (p, name) => p.getByRole('dialog', { name, exact: true });
const row = (p, id) =>
  p.getByRole('row').filter({
    has: (typeof p.page === 'function' ? p.page() : p).getByText(id, { exact: true }),
  });
async function textHas(p, value) {
  await p.getByText(value, { exact: false }).first().waitFor();
}
async function fixture(t, route = '/overview', viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const errors = [],
    external = [];
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== lab.url) {
      external.push(u.origin);
      return route.abort();
    }
    return route.continue();
  });
  const p = await context.newPage();
  p.setDefaultTimeout(4500);
  p.on('pageerror', (e) => errors.push(e.message));
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(external, [], 'external requests');
  });
  await p.goto(lab.url + '/');
  await button(p, '进入演示').click();
  await p.getByRole('heading', { level: 1, name: '运营总览', exact: true }).waitFor();
  if (route != '/overview') await p.goto(lab.url + route);
  return p;
}
async function queryAsset(p, id) {
  await p.getByLabel('关键词', { exact: true }).fill(id);
  await button(p, '查询').click();
  await row(p, id).waitFor();
}
async function asset(p, id) {
  await queryAsset(p, id);
  await button(row(p, id), '详情').click();
  const d = dialog(p, '设备详情');
  await d.getByRole('heading', { name: id, exact: true }).waitFor();
  return d;
}
async function newOrder(p, name, device = 'D001') {
  await button(p, '新建工单').click();
  const d = dialog(p, '新建工单');
  await d.getByLabel('工单名称', { exact: true }).fill(name);
  await d.getByLabel('设备', { exact: true }).selectOption(device);
  return d;
}
async function config(d, priority = '高', days = '7', date = '2026-10-01') {
  await button(d, '下一步').click();
  await d.getByRole('heading', { name: '执行配置', exact: true }).waitFor();
  await button(d, '优先级').click();
  await d.getByRole('option', { name: priority, exact: true }).click();
  await d.getByLabel('巡检周期', { exact: true }).fill(days);
  await d.getByLabel('执行日期', { exact: true }).fill(date);
}
async function createOrder(p, name, device = 'D001', priority = '高') {
  const d = await newOrder(p, name, device);
  await config(d, priority);
  await button(d, '下一步').click();
  await button(d, '提交工单').click();
  await d.waitFor({ state: 'hidden' });
  const r = p.getByRole('row').filter({ has: p.getByText(name, { exact: true }) });
  await r.waitFor();
  return r;
}

test('24 native-import cases have isolated identities, fixed groups and accurate original oracle', () => {
  assert.deepEqual(
    Object.values(groups).map((g) => g.cases.length),
    [18, 4, 2],
  );
  const all = Object.values(groups).flatMap((g) => g.cases);
  assert.equal(new Set(all.map((c) => c.case_id)).size, 24);
  for (const [key, g] of Object.entries(groups)) {
    assert.equal(g.case_count, g.cases.length);
    for (const c of g.cases) {
      assert.equal(c.source_side, 'ui');
      assert.ok(c.steps.length >= 3 && c.steps.length <= 8, c.case_id);
      if (c.page_entry_url) assert.equal(new URL(c.page_entry_url).origin, 'http://127.0.0.1:4196');
      if (key !== '02-needs-review') assert.deepEqual(mechanicalIssues(c), [], c.case_id);
    }
  }
  for (const id of ['LAB-V01', 'LAB-V03', 'LAB-V05', 'LAB-V11'])
    assert.equal(all.find((c) => c.case_id === id).page_entry_url, undefined);
  assert.ok(
    mechanicalIssues(all.find((c) => c.case_id === 'LAB-R02')).some(
      (x) => x.code === 'EXPECTED_MISSING',
    ),
  );
  const b1 = JSON.stringify(all.find((c) => c.case_id === 'LAB-B01'));
  assert.match(b1, /0\.38/);
  assert.doesNotMatch(b1, /0\.83/);
  const b2 = JSON.stringify(all.find((c) => c.case_id === 'LAB-B02'));
  assert.match(b2, /50/);
  assert.doesNotMatch(b2, /52/);
});

test('server exposes only local synthetic routes, never answer files, source or write APIs', async () => {
  for (const pathname of [
    '/SPEC.md',
    '/GRADING.md',
    '/cases/01-valid.json',
    '/../package.json',
    '/public/index.html',
    '/assets?file=SPEC.md',
    '/.env',
  ]) {
    const response = await fetch(lab.url + pathname);
    assert.equal(response.status, 404, pathname);
  }
  assert.equal((await fetch(lab.url + '/assets', { method: 'POST' })).status, 405);
  assert.equal((await fetch(lab.url + '/healthz')).status, 200);
  const unexpected = await new Promise((resolve, reject) => {
    const req = http.get(lab.url, { headers: { host: 'example.com' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
  });
  assert.equal(unexpected, 421);
  assert.match(
    (await fetch(lab.url + '/')).headers.get('content-security-policy'),
    /connect-src 'none'/,
  );
});

test('V01 homepage navigation exposes 12 assets and 5 first-page rows', async (t) => {
  const p = await fixture(t);
  await button(p, '运营中心').click();
  await p.getByRole('link', { name: '资产设备', exact: true }).click();
  await p.getByRole('heading', { name: '资产设备', level: 1, exact: true }).waitFor();
  for (const id of ['D001', 'D002', 'D003', 'D004', 'D005'])
    assert.equal(await row(p, id).count(), 1);
  assert.equal(await row(p, 'D006').count(), 0);
  await textHas(p, '共12条');
  await textHas(p, '第1/3页');
});
test('V02 compound AND filter distinguishes the same-name south device', async (t) => {
  const p = await fixture(t, '/assets');
  await p.getByLabel('关键词', { exact: true }).fill('储能柜');
  await p.getByLabel('园区', { exact: true }).selectOption({ label: '南园' });
  await p.getByLabel('状态', { exact: true }).selectOption({ label: '运行' });
  await button(p, '查询').click();
  await textHas(row(p, 'D009'), '200');
  assert.equal(await row(p, 'D001').count(), 0);
  await textHas(p, '共1条');
});
test('V03 paginated same-name record binds D009, never D001', async (t) => {
  const p = await fixture(t, '/assets');
  await button(p, '下一页').click();
  await button(row(p, 'D009'), '详情').click();
  const d = dialog(p, '设备详情');
  await d.getByRole('heading', { name: 'D009', exact: true }).waitFor();
  await textHas(d, '南园');
  await textHas(d, '200');
  assert.equal(await d.getByText('D001', { exact: true }).count(), 0);
});
test('V04 tabs preserve D009 identity and specified parameter values', async (t) => {
  const p = await fixture(t, '/assets'),
    d = await asset(p, 'D009');
  await d.getByRole('tab', { name: '运行参数', exact: true }).click();
  await textHas(d, '7');
  await textHas(d, '50');
  await d.getByRole('tab', { name: '基本信息', exact: true }).click();
  await d.getByRole('heading', { name: 'D009', exact: true }).waitFor();
  await textHas(d, '200');
});
test('V05 nested modal blocks background and closes only the top layer', async (t) => {
  const p = await fixture(t, '/assets'),
    d = await asset(p, 'D009');
  await button(d, '读取说明').click();
  const top = dialog(p, '读取说明');
  await textHas(top, '读数每60秒更新');
  assert.equal(await p.locator('dialog[open]').count(), 2);
  await assert.rejects(button(d, '关闭详情').click({ timeout: 300 }), /Timeout/);
  await button(top, '关闭说明').click();
  assert.equal(await p.locator('dialog[open]').count(), 1);
  await d.getByRole('heading', { name: 'D009', exact: true }).waitFor();
  await button(d, '关闭详情').click();
  assert.equal(await p.locator('dialog[open]').count(), 0);
  assert.equal(await row(p, 'D009').count(), 1);
});
test('V06 querying from later page and resetting restore pagination', async (t) => {
  const p = await fixture(t, '/assets');
  await button(p, '下一页').click();
  await queryAsset(p, 'D012');
  await textHas(p, '第1/1页');
  await button(p, '重置').click();
  await textHas(p, '第1/3页');
  await textHas(p, '共12条');
  assert.equal(await p.getByLabel('关键词', { exact: true }).inputValue(), '');
});
test('V07 descending numeric power sort and reset', async (t) => {
  const p = await fixture(t, '/assets');
  await p.getByLabel('排序', { exact: true }).selectOption({ label: '功率降序' });
  await button(p, '查询').click();
  const ids = await p.locator('tbody tr td:first-child').allTextContents();
  assert.deepEqual(
    ids.slice(0, 2).map((s) => s.trim()),
    ['D012', 'D007'],
  );
  await button(p, '重置').click();
  assert.equal((await p.locator('tbody tr td:first-child').first().textContent()).trim(), 'D001');
});
test('V08 deterministic async read error recovers once with the correct device value', async (t) => {
  const p = await fixture(t, '/assets'),
    d = await asset(p, 'D009');
  await d.getByRole('tab', { name: '运行参数', exact: true }).click();
  await button(d, '加载遥测').click();
  await textHas(d, '遥测读取失败，请重试');
  await button(d, '重试').click();
  await textHas(d, '180');
});
test('V09 inclusive date range returns exactly two matching maintenance rows', async (t) => {
  const p = await fixture(t, '/assets'),
    d = await asset(p, 'D009');
  await d.getByRole('tab', { name: '维护记录', exact: true }).click();
  await d.getByLabel('开始日期', { exact: true }).fill('2026-09-10');
  await d.getByLabel('结束日期', { exact: true }).fill('2026-09-12');
  await button(d, '筛选记录').click();
  assert.equal(await row(d, 'MR091').count(), 1);
  assert.equal(await row(d, 'MR092').count(), 1);
  assert.equal(await row(d, 'MR093').count(), 0);
});

test('closing a loading detail prevents its delayed contents reopening on a new route', async (t) => {
  const p = await fixture(t, '/assets');
  await button(row(p, 'D001'), '详情').click();
  const pending = dialog(p, '设备详情');
  await textHas(pending, '正在加载设备详情');
  await button(pending, '取消加载').click();
  await p.getByRole('link', { name: '电价管理', exact: true }).click();
  // Longer than the specified 600 ms simulated request, so stale callbacks have had a chance to fire.
  await p.waitForTimeout(850);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.getByRole('heading', { level: 1, name: '电价管理', exact: true }).waitFor();
});
test('V10 standard tariff correct non-defect values', async (t) => {
  const p = await fixture(t, '/tariffs');
  await button(row(p, 'T001'), '详情').click();
  const d = dialog(p, '电价详情');
  await textHas(d, '2026-01-01');
  await textHas(d, '2026-12-31');
  await textHas(d, '0.68');
  await textHas(d, '1.20');
});
test('V11 conditional tariff help remains nested and keeps the right template', async (t) => {
  const p = await fixture(t, '/tariffs');
  await button(row(p, 'T002'), '详情').click();
  const d = dialog(p, '电价详情');
  await button(d, '适用范围说明').click();
  const top = dialog(p, '适用范围说明');
  await textHas(top, '仅在2026-10-01至2026-10-07生效');
  await button(top, '关闭说明').click();
  await d.getByRole('heading', { name: 'T002', exact: true }).waitFor();
  await button(d, '关闭详情').click();
  await button(row(p, 'T001'), '详情').click();
  assert.equal(await button(dialog(p, '电价详情'), '适用范围说明').count(), 0);
});
test('V12 audit pages and result filter reset page position', async (t) => {
  const p = await fixture(t, '/audit');
  await button(p, '下一页').click();
  await button(p, '下一页').click();
  for (const id of ['AU007', 'AU008', 'AU009']) assert.equal(await row(p, id).count(), 1);
  await p.getByLabel('结果', { exact: true }).selectOption({ label: '失败' });
  await button(p, '查询').click();
  for (const id of ['AU003', 'AU008']) assert.equal(await row(p, id).count(), 1);
  assert.equal(await row(p, 'AU009').count(), 0);
  await textHas(p, '第1/1页');
});
test('V13 wizard only creates on submit, uses dynamic id, persists all entered fields', async (t) => {
  const p = await fixture(t, '/work-orders'),
    d = await newOrder(p, '人工演练-标准工单');
  await config(d);
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('complex-lab-v1-orders')));
  assert.ok(!before.some((o) => JSON.stringify(o).includes('人工演练-标准工单')));
  await button(d, '下一步').click();
  assert.equal(await d.getByLabel('工单名称', { exact: true }).inputValue(), '人工演练-标准工单');
  await button(d, '提交工单').click();
  await d.waitFor({ state: 'hidden' });
  await p.reload();
  const r = p.getByRole('row').filter({ has: p.getByText('人工演练-标准工单', { exact: true }) });
  await r.waitFor();
  const txt = await r.innerText();
  assert.match(txt, /WO-/);
  for (const x of ['D001', '高', '7', '2026-10-01', '待执行']) assert.ok(txt.includes(x), x);
});
test('V14 missing name prevents advancing and leaves seed data alone', async (t) => {
  const p = await fixture(t, '/work-orders');
  await button(p, '新建工单').click();
  const d = dialog(p, '新建工单');
  await button(d, '下一步').click();
  await textHas(d, '请填写工单名称');
  await d.getByRole('heading', { name: '基本信息', exact: true }).waitFor();
  assert.equal(
    await p.evaluate(() => JSON.parse(localStorage.getItem('complex-lab-v1-orders')).length),
    1,
  );
});
test('V15 step-back preserves all configured values without committing', async (t) => {
  const p = await fixture(t, '/work-orders'),
    d = await newOrder(p, '人工演练-返回保持', 'D009');
  await config(d, '高', '14', '2026-10-02');
  await button(d, '上一步').click();
  assert.equal(await d.getByLabel('工单名称', { exact: true }).inputValue(), '人工演练-返回保持');
  await button(d, '下一步').click();
  assert.equal(await d.getByLabel('巡检周期', { exact: true }).inputValue(), '14');
  assert.equal(await d.getByLabel('执行日期', { exact: true }).inputValue(), '2026-10-02');
  await textHas(d, '高');
  await button(d, '取消').click();
  await button(dialog(p, '放弃编辑确认'), '放弃修改').click();
  assert.equal(await p.getByText('人工演练-返回保持', { exact: true }).count(), 0);
});
test('V16 dirty confirmation keeps data or discards only the draft', async (t) => {
  const p = await fixture(t, '/work-orders'),
    d = await newOrder(p, '人工演练-放弃测试');
  await button(d, '取消').click();
  await button(dialog(p, '放弃编辑确认'), '继续编辑').click();
  assert.equal(await d.getByLabel('工单名称', { exact: true }).inputValue(), '人工演练-放弃测试');
  await button(d, '取消').click();
  await button(dialog(p, '放弃编辑确认'), '放弃修改').click();
  assert.equal(await p.getByText('人工演练-放弃测试', { exact: true }).count(), 0);
  assert.equal(await row(p, 'WO-SEED').count(), 1);
});
test('V17 duplicate name is rejected at submit with no new persisted record', async (t) => {
  const p = await fixture(t, '/work-orders'),
    d = await newOrder(p, '既有巡检');
  await config(d, '中');
  await button(d, '下一步').click();
  await button(d, '提交工单').click();
  await textHas(d, '工单名称已存在');
  await d.getByRole('heading', { name: '确认提交', exact: true }).waitFor();
  assert.equal(
    await p.evaluate(() => JSON.parse(localStorage.getItem('complex-lab-v1-orders')).length),
    1,
  );
});

test('wizard keyboard priority, invalid period and escaped business text do not silently submit', async (t) => {
  const p = await fixture(t, '/work-orders');
  const d = await newOrder(p, '<b>合成文本</b>');
  await button(d, '下一步').click();
  await button(d, '优先级').click();
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await d.getByLabel('巡检周期', { exact: true }).fill('0');
  await d.getByLabel('执行日期', { exact: true }).fill('2026-10-01');
  await button(d, '下一步').click();
  await d.getByRole('heading', { name: '执行配置', exact: true }).waitFor();
  await d.getByLabel('巡检周期', { exact: true }).fill('7');
  await button(d, '下一步').click();
  assert.equal(await d.getByLabel('工单名称', { exact: true }).inputValue(), '<b>合成文本</b>');
  assert.equal(await d.locator('b').filter({ hasText: '合成文本' }).count(), 0);
  assert.equal(
    await p.evaluate(() => JSON.parse(localStorage.getItem('complex-lab-v1-orders')).length),
    1,
  );
});
test('V18 update and cleanup bind only the newly created record', async (t) => {
  const p = await fixture(t, '/work-orders');
  let r = await createOrder(p, '人工演练-周期调整', 'D009', '中');
  await button(r, '编辑周期').click();
  const d = dialog(p, '编辑工单');
  await textHas(d, '人工演练-周期调整');
  await d.getByLabel('巡检周期', { exact: true }).fill('14');
  await button(d, '保存周期').click();
  await textHas(r, '14');
  await textHas(row(p, 'WO-SEED'), '7');
  await button(r, '删除本轮工单').click();
  const confirm = dialog(p, '删除工单确认');
  await textHas(confirm, '人工演练-周期调整');
  await button(confirm, '确认删除').click();
  assert.equal(await r.count(), 0);
  assert.equal(await row(p, 'WO-SEED').count(), 1);
  assert.equal(await button(row(p, 'WO-SEED'), '删除本轮工单').count(), 0);
});
test('B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI', async (t) => {
  const p = await fixture(t, '/tariffs');
  await button(row(p, 'T001'), '详情').click();
  const d = dialog(p, '电价详情');
  await textHas(d, '0.83');
  assert.equal(await d.getByText('0.38', { exact: true }).count(), 0);
});
test('B02 seeded frequency defect exists only on D004, not the valid D009', async (t) => {
  const p = await fixture(t, '/assets'),
    d = await asset(p, 'D004');
  await d.getByRole('tab', { name: '运行参数', exact: true }).click();
  await textHas(d, '52');
  await button(d, '关闭详情').click();
  await button(p, '重置').click();
  const good = await asset(p, 'D009');
  await good.getByRole('tab', { name: '运行参数', exact: true }).click();
  await textHas(good, '50');
});
test('reload, history navigation and reset preserve isolation from unrelated storage', async (t) => {
  const p = await fixture(t, '/work-orders');
  await createOrder(p, '重置验证工单');
  await p.goto(lab.url + '/overview');
  await p.evaluate(() => localStorage.setItem('unrelated-user-data', 'keep'));
  await button(p, '运营中心').click();
  await p.getByRole('link', { name: '资产设备', exact: true }).click();
  await p.goBack();
  await p.getByRole('heading', { name: '运营总览', level: 1, exact: true }).waitFor();
  await button(p, '重置演练数据').click();
  await button(dialog(p, '重置确认'), '确认重置').click();
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('complex-lab-v1-orders')));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'WO-SEED');
  assert.equal(await p.evaluate(() => localStorage.getItem('unrelated-user-data')), 'keep');
  await p.reload();
  await p.getByRole('heading', { name: '运营总览', level: 1, exact: true }).waitFor();
});
test('desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence', async (t) => {
  const out = new URL('../validation/manual-lab/', import.meta.url);
  await fs.mkdir(out, { recursive: true });
  const p = await fixture(t, '/assets');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.screenshot({ path: fileURLToPath(new URL('desktop.png', out)), fullPage: true });
  await p.goto(lab.url + '/work-orders');
  const d = await newOrder(p, '键盘预览');
  await button(d, '下一步').click();
  await button(d, '优先级').click();
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await button(d, '取消').click();
  await p.screenshot({ path: fileURLToPath(new URL('nested-dialog.png', out)), fullPage: true });
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('dialog[open]').count(), 1);
  const mobile = await fixture(t, '/assets', { width: 375, height: 812 });
  assert.ok(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'page-wide horizontal overflow',
  );
  await mobile.screenshot({ path: fileURLToPath(new URL('mobile.png', out)), fullPage: true });
});
