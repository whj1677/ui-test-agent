// Independent reference verification of synthetic targets. NOT Agent autonomy evidence.
// This driver is never imported into product planning/execution or served over HTTP.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startFixture } from '../acceptance/serve.mjs';

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});
const role = (page, type, name) => page.getByRole(type, { name, exact: true });
const click = (page, name) => role(page, 'button', name).click();
const link = (page, name) => role(page, 'link', name).click();
async function text(locator, expected) {
  await locator.waitFor({ state: 'visible' });
  const actual = await locator.innerText();
  expected instanceof RegExp
    ? assert.match(actual, expected)
    : assert.equal(actual.trim(), expected);
}
async function count(locator, expected) {
  await locator.first().waitFor({ state: 'visible' });
  assert.equal(await locator.count(), expected);
}
async function setup(t, site) {
  const fixture = await startFixture({ site });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(5000);
  const errors = [],
    outside = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== fixture.origin) {
      outside.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  t.after(async () => {
    await context.close();
    await fixture.close();
    assert.deepEqual(errors, [], 'No hidden browser exceptions');
    assert.deepEqual(outside, [], 'No external requests, including prefetch');
  });
  await page.goto(fixture.origin);
  await click(page, '进入演示');
  await role(page, 'button', '退出登录').waitFor();
  return { fixture, context, page, initial: fixture.inspect().records };
}
async function deviceList(page) {
  await click(page, '设备中心');
  await link(page, '设备台账');
  await devicesReady(page);
}
async function devicesReady(page) {
  await page.getByText('数据加载中…', { exact: true }).waitFor({ state: 'hidden' });
  await page.locator('#devPager').waitFor();
}
async function deviceIds(page, ids) {
  await devicesReady(page);
  assert.deepEqual(
    await page.locator('#devTbody tr td:first-child').allTextContents(),
    ids.map((i) => `SB-2026-${String(i).padStart(3, '0')}`),
  );
}
async function deviceQuery(page, keyword) {
  await page.getByLabel('名称关键字', { exact: true }).fill(keyword);
  await click(page, '查询');
  await devicesReady(page);
}
async function deviceDetail(page, id) {
  await page
    .getByRole('row')
    .filter({ hasText: `SB-2026-${String(id).padStart(3, '0')}` })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  return page.locator('#detailDialog');
}

test('reference CPLX-001: original navigation / decoy / async table', async (t) => {
  const { page } = await setup(t, 'devices');
  await role(page, 'link', '工作台').waitFor();
  await click(page, '设备中心');
  for (const name of ['设备台账', '设备台账（旧）', '设备巡检', '设备总览'])
    await role(page, 'link', name).waitFor();
  await link(page, '设备巡检');
  await text(page.getByText('巡检计划建设中'), '巡检计划建设中');
  await link(page, '设备台账（旧）');
  await count(page.locator('.badge-old'), 12);
  assert.equal(await role(page, 'button', '详情').count(), 0);
  await link(page, '设备台账');
  await page.getByText('数据加载中…', { exact: true }).waitFor();
  await deviceIds(page, [1, 2, 3, 4]);
  await text(page.locator('#devPager'), /共 12 条，第 1 \/ 3 页/);
  assert.equal(new URL(page.url()).pathname, '/devices');
});
test('reference CPLX-002: combined filter / reset / paging', async (t) => {
  const { page } = await setup(t, 'devices');
  await deviceList(page);
  await click(page, '重置');
  await deviceIds(page, [1, 2, 3, 4]);
  await page.getByLabel('园区', { exact: true }).selectOption('枫林园');
  await page.getByLabel('状态', { exact: true }).selectOption('停机');
  await click(page, '查询');
  await page.getByText('数据加载中…', { exact: true }).waitFor();
  await deviceIds(page, [10]);
  await text(page.locator('#devTbody'), /三号冷却塔[\s\S]*枫林园[\s\S]*停机[\s\S]*林蔚/);
  await click(page, '重置');
  await deviceIds(page, [1, 2, 3, 4]);
  for (const name of ['园区', '状态', '名称关键字'])
    assert.equal(await page.getByLabel(name, { exact: true }).inputValue(), '');
  await click(page, '2');
  await page.getByText('数据加载中…', { exact: true }).waitFor();
  await deviceIds(page, [5, 6, 7, 8]);
  await deviceQuery(page, '冷却塔');
  await deviceIds(page, [1, 5, 6, 10]);
  assert.equal(await role(page, 'button', '2').count(), 0);
  await page.getByLabel('园区', { exact: true }).selectOption('云杉园');
  await click(page, '查询');
  await deviceIds(page, [1]);
});
test('reference CPLX-003: same name must resolve the correct row', async (t) => {
  const { page } = await setup(t, 'devices');
  await deviceList(page);
  await deviceQuery(page, '一号冷却塔');
  await deviceIds(page, [1, 6]);
  await page
    .getByRole('row')
    .filter({ hasText: '梧桐园' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  await text(page.locator('#detailTitle'), '一号冷却塔');
  await text(page.locator('#dId'), 'SB-2026-006');
  await text(page.locator('#dOwner'), '赵岚');
  await text(page.locator('#dPark'), '梧桐园');
  await text(page.locator('#dCap'), '320');
  await click(page, '关闭详情');
  assert.equal(await page.locator('#detailDialog').isVisible(), false);
  await deviceIds(page, [1, 6]);
});
test('reference CPLX-004: native nested dialog closes top layer only', async (t) => {
  const { page } = await setup(t, 'devices');
  await deviceList(page);
  const d = await deviceDetail(page, 4);
  assert.equal(await role(d, 'tab', '基本信息').getAttribute('aria-selected'), 'true');
  await click(d, '查看说明');
  await text(page.locator('#noteDialog'), /本设备纳入季度巡检范围/);
  await click(page.locator('#noteDialog'), '关闭说明');
  assert.equal(await d.isVisible(), true);
  assert.equal(await page.locator('#noteDialog').isVisible(), false);
  await role(d, 'tab', '维保记录').click();
  await text(page.locator('#panelMaint'), '2026-08-01 例行保养');
  await role(d, 'tab', '基本信息').click();
  await text(page.locator('#dOwner'), '陈启');
  await click(d, '关闭详情');
  await deviceIds(page, [1, 2, 3, 4]);
});
test('reference CPLX-005: original dependent form and negative bounds', async (t) => {
  const { page } = await setup(t, 'devices');
  await deviceList(page);
  await click(page, '+ 新增设备');
  const type = page.getByLabel('设备类型', { exact: true });
  assert.equal(await type.isDisabled(), true);
  await page.getByLabel('园区', { exact: true }).selectOption('梧桐园');
  assert.equal(await type.isEnabled(), true);
  assert.deepEqual(await type.locator('option').allTextContents(), [
    '请选择类型',
    '冷却塔',
    '水泵',
    '配电柜',
  ]);
  await type.selectOption('水泵');
  await page.getByLabel('容量(kW)', { exact: true }).fill('600');
  await page.getByLabel('负责人', { exact: true }).fill('测试员');
  await click(page, '确定');
  await text(page.locator('#err-fName'), '设备名称为必填项');
  await text(page.locator('#err-fCap'), '容量需为1-500的整数');
  await page.locator('#formSummary.show').waitFor();
  await page.getByLabel('设备名称', { exact: true }).fill('联动校验专用甲');
  await page.getByLabel('容量(kW)', { exact: true }).fill('0');
  await click(page, '确定');
  assert.equal(await page.locator('#err-fName').innerText(), '');
  await text(page.locator('#err-fCap'), '容量需为1-500的整数');
  await page.getByLabel('园区', { exact: true }).selectOption('枫林园');
  assert.equal(await type.inputValue(), '');
  await click(page, '取消');
  await deviceIds(page, [1, 2, 3, 4]);
  assert.equal(await page.getByText('新增成功', { exact: true }).isVisible(), false);
});
test('reference CPLX-006: valid form cancellation never creates a row', async (t) => {
  const { page } = await setup(t, 'devices');
  await deviceList(page);
  await click(page, '+ 新增设备');
  await page.getByLabel('园区', { exact: true }).selectOption('云杉园');
  await page.getByLabel('设备类型', { exact: true }).selectOption('水泵');
  for (const [name, value] of [
    ['设备名称', '临清专用取消样本'],
    ['容量(kW)', '200'],
    ['负责人', '试验员'],
  ])
    await page.getByLabel(name, { exact: true }).fill(value);
  await click(page, '取消');
  await devicesReady(page);
  assert.equal(await page.getByText('新增成功', { exact: true }).isVisible(), false);
  await deviceQuery(page, '临清');
  await text(page.locator('#devTbody'), '暂无数据');
  await click(page, '重置');
  await deviceIds(page, [1, 2, 3, 4]);
  await click(page, '3');
  await deviceIds(page, [9, 10, 11, 12]);
  await click(page, '1');
  await deviceIds(page, [1, 2, 3, 4]);
});
test('reference CPLX-007: read failure retry persists in same page lifetime', async (t) => {
  const { page } = await setup(t, 'devices');
  await deviceList(page);
  await click(page, '2');
  await deviceIds(page, [5, 6, 7, 8]);
  let d = await deviceDetail(page, 7);
  await role(d, 'tab', '维保记录').click();
  await text(page.locator('#panelMaint'), /维保记录读取失败，请重试/);
  assert.equal(await page.getByText('2026-08-12 更换指示灯', { exact: true }).isVisible(), false);
  await click(d, '重试');
  await text(page.locator('#panelMaint'), '2026-08-12 更换指示灯');
  await role(d, 'tab', '基本信息').click();
  await role(d, 'tab', '维保记录').click();
  await text(page.locator('#panelMaint'), '2026-08-12 更换指示灯');
  await click(d, '关闭详情');
  await deviceIds(page, [5, 6, 7, 8]);
  d = await deviceDetail(page, 7);
  await role(d, 'tab', '维保记录').click();
  await text(page.locator('#panelMaint'), '2026-08-12 更换指示灯');
});
test('reference CPLX-008: PRESERVED defect actual 840 contradicts expected 480', async (t) => {
  const { page, fixture } = await setup(t, 'devices');
  await page.goto(fixture.origin + '/devices');
  await devicesReady(page);
  const d = await deviceDetail(page, 3);
  await text(page.locator('#detailTitle'), '二号配电柜');
  await text(page.locator('#dId'), 'SB-2026-003');
  await text(page.locator('#dCap'), '840');
  assert.notEqual(await page.locator('#dCap').innerText(), '480');
  await text(page.locator('#dStatus'), '维保');
  await click(d, '关闭详情');
  await deviceIds(page, [1, 2, 3, 4]);
});

async function requestList(page) {
  if ((await role(page, 'button', '采购管理').getAttribute('aria-expanded')) !== 'true')
    await click(page, '采购管理');
  await link(page, '申请记录');
  await requestsReady(page);
}
async function requestsReady(page) {
  await page.getByText('正在加载申请…', { exact: true }).waitFor({ state: 'hidden' });
  await page.locator('#records').waitFor();
}
const record = (page, name) =>
  page.locator('li.record').filter({ has: role(page, 'heading', name) });
async function startRequest(page, name, category = '检修工具', quantity = '2', review = true) {
  await click(page, '新建申请');
  await page.getByLabel('申请名称', { exact: true }).fill(name);
  await page.getByLabel('项目', { exact: true }).selectOption('青岚站');
  await page.getByLabel('申请人', { exact: true }).fill('合成测试员');
  await click(page, '下一步');
  await page.getByLabel('品类', { exact: true }).selectOption(category);
  await page.getByLabel('数量', { exact: true }).fill(quantity);
  if (review) await click(page, '下一步');
}
async function summaryValue(page, label, value) {
  await text(
    page
      .locator('dt')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .locator('+ dd'),
    String(value),
  );
}
async function requestQuery(page, keyword) {
  await page.getByLabel('申请关键字', { exact: true }).fill(keyword);
  await click(page, '查询');
  await requestsReady(page);
}
test('reference REQS-001: sidebar navigation / wizard cancellation / home', async (t) => {
  const { page } = await setup(t, 'requests');
  await requestList(page);
  await count(page.locator('li.record'), 2);
  await record(page, '例行工具申请').waitFor();
  await record(page, '回归专用申请甲（勿删）').waitFor();
  await click(page, '新建申请');
  await role(page, 'heading', '1 基本信息').waitFor();
  await click(page, '取消');
  await requestsReady(page);
  await count(page.locator('li.record'), 2);
  await link(page, '首页');
  await role(page, 'heading', '采购申请工作台').waitFor();
  assert.equal(new URL(page.url()).hash, '#/home');
});
test('reference REQS-002: conditional native dialog present and absent branches', async (t) => {
  const { page, fixture } = await setup(t, 'requests');
  await requestList(page);
  await click(page, '使用说明');
  const d = role(page, 'dialog', '试用说明');
  await text(d, /所有数据仅用于本机合成测试/);
  const conditional = async () => {
    if (await d.isVisible()) await click(d, '知道了');
  };
  await conditional();
  assert.equal(await d.isVisible(), false);
  await conditional();
  await count(page.locator('li.record'), 2);
  assert.equal(fixture.inspect().mutations.length, 0);
});
test('reference REQS-003: required fields / lower and upper bounds / valid confirmation', async (t) => {
  const { page, fixture, initial } = await setup(t, 'requests');
  await requestList(page);
  await click(page, '新建申请');
  await click(page, '下一步');
  for (const msg of ['申请名称必填', '项目必选', '申请人必填'])
    await text(page.getByText(msg, { exact: true }), msg);
  await page.getByLabel('申请名称', { exact: true }).fill('边界校验样本');
  await page.getByLabel('项目', { exact: true }).selectOption('青岚站');
  await page.getByLabel('申请人', { exact: true }).fill('合成测试员');
  await click(page, '下一步');
  await role(page, 'heading', '2 采购明细').waitFor();
  assert.deepEqual(
    await page.getByLabel('品类', { exact: true }).locator('option').allTextContents(),
    ['请选择', '检修工具', '安全护具'],
  );
  await page.getByLabel('品类', { exact: true }).selectOption('检修工具');
  for (const value of ['0', '21']) {
    await page.getByLabel('数量', { exact: true }).fill(value);
    await click(page, '下一步');
    await text(page.getByText('数量必须是1至20的整数', { exact: true }), '数量必须是1至20的整数');
    await role(page, 'heading', '2 采购明细').waitFor();
  }
  await page.getByLabel('数量', { exact: true }).fill('2');
  await click(page, '下一步');
  await role(page, 'heading', '3 确认提交').waitFor();
  for (const [k, v] of [
    ['数量', 2],
    ['单价', 60],
    ['合计', 120],
  ])
    await summaryValue(page, k, v);
  await click(page, '取消');
  await requestsReady(page);
  await count(page.locator('li.record'), 2);
  assert.deepEqual(fixture.inspect(), { records: initial, mutations: [] });
});
test('reference REQS-004: returning preserves fields while changed project clears dependent category', async (t) => {
  const { page, fixture, initial } = await setup(t, 'requests');
  await requestList(page);
  await startRequest(page, '联动取消样本', '检修工具', '2', false);
  await click(page, '上一步');
  for (const [k, v] of [
    ['申请名称', '联动取消样本'],
    ['项目', '青岚站'],
    ['申请人', '合成测试员'],
  ])
    assert.equal(await page.getByLabel(k, { exact: true }).inputValue(), v);
  await page.getByLabel('项目', { exact: true }).selectOption('远川站');
  await click(page, '下一步');
  const category = page.getByLabel('品类', { exact: true });
  assert.equal(await category.inputValue(), '');
  assert.deepEqual(await category.locator('option').allTextContents(), ['请选择', '办公耗材']);
  assert.equal(await page.getByLabel('数量', { exact: true }).inputValue(), '2');
  await click(page, '取消');
  await requestsReady(page);
  await requestQuery(page, '联动取消样本');
  await text(page.getByText('没有匹配的申请', { exact: true }), '没有匹配的申请');
  assert.deepEqual(fixture.inspect(), { records: initial, mutations: [] });
});
async function submitRequest(page) {
  await click(page, '提交申请');
  await click(role(page, 'dialog', '提交申请'), '确认提交');
  await page.locator('#records').waitFor();
  await requestsReady(page);
  await text(page.getByRole('status'), '提交成功');
}
async function deleteExact(page, name) {
  await click(record(page, name), '删除');
  await text(role(page, 'dialog', '删除申请'), new RegExp(name));
  await click(role(page, 'dialog', '删除申请'), '确认删除');
  await page.getByRole('status').filter({ hasText: '删除成功' }).waitFor();
  await requestsReady(page);
}
test('reference REQS-005: exact-name create/delete cannot consume near-name seed', async (t) => {
  const { page, fixture, initial } = await setup(t, 'requests');
  await requestList(page);
  await startRequest(page, '回归专用申请甲');
  for (const [k, v] of [
    ['申请名称', '回归专用申请甲'],
    ['项目', '青岚站'],
    ['申请人', '合成测试员'],
    ['品类', '检修工具'],
    ['数量', 2],
    ['单价', 60],
    ['合计', 120],
  ])
    await summaryValue(page, k, v);
  await submitRequest(page);
  await requestQuery(page, '回归专用申请甲');
  await count(record(page, '回归专用申请甲'), 1);
  await text(record(page, '回归专用申请甲'), /待审批[\s\S]*金额 120/);
  await deleteExact(page, '回归专用申请甲');
  await record(page, '回归专用申请甲（勿删）').waitFor();
  assert.equal(await record(page, '回归专用申请甲').count(), 0);
  await click(page, '重置');
  await requestsReady(page);
  await count(page.locator('li.record'), 2);
  assert.deepEqual(fixture.inspect().records, initial);
  assert.deepEqual(
    fixture.inspect().mutations.map((m) => m.method),
    ['POST', 'DELETE'],
  );
});
test('reference REQS-006: edit with stacked native confirmation and exact cleanup', async (t) => {
  const { page, fixture, initial } = await setup(t, 'requests');
  await requestList(page);
  await startRequest(page, '回归专用申请乙');
  await submitRequest(page);
  await text(record(page, '回归专用申请乙'), /金额 120/);
  await click(record(page, '回归专用申请乙'), '编辑');
  const d = role(page, 'dialog', '编辑申请');
  await d.getByLabel('数量', { exact: true }).fill('3');
  await click(d, '保存');
  await role(page, 'dialog', '保存修改').waitFor();
  assert.equal(await d.isVisible(), true);
  await click(role(page, 'dialog', '保存修改'), '确认保存');
  await page.getByRole('status').filter({ hasText: '保存成功' }).waitFor();
  await requestsReady(page);
  await text(record(page, '回归专用申请乙'), /青岚站[\s\S]*数量 3[\s\S]*金额 180/);
  await deleteExact(page, '回归专用申请乙');
  assert.deepEqual(fixture.inspect().records, initial);
  assert.deepEqual(
    fixture.inspect().mutations.map((m) => m.method),
    ['POST', 'PATCH', 'DELETE'],
  );
});
test('reference REQS-007: forbidden write is reachable; reference does NOT submit or claim Agent blocking', async (t) => {
  const { page, fixture, initial } = await setup(t, 'requests');
  await requestList(page);
  await startRequest(page, '只读越权样本');
  await summaryValue(page, '合计', 120);
  await click(page, '提交申请');
  await role(role(page, 'dialog', '提交申请'), 'button', '确认提交').waitFor();
  assert.deepEqual(fixture.inspect(), { records: initial, mutations: [] });
  await click(role(page, 'dialog', '提交申请'), '取消');
  await click(page, '取消');
  await requestsReady(page);
  assert.deepEqual(fixture.inspect(), { records: initial, mutations: [] });
});
test('reference REQS-008: PRESERVED defect actual subtotal 300 contradicts 110 x 3 = 330', async (t) => {
  const { page, fixture, initial } = await setup(t, 'requests');
  await requestList(page);
  await startRequest(page, '护具金额核对', '安全护具', '3');
  await summaryValue(page, '数量', 3);
  await summaryValue(page, '单价', 110);
  await summaryValue(page, '合计', 300);
  assert.notEqual(300, 110 * 3);
  await click(page, '取消');
  await requestsReady(page);
  await requestQuery(page, '护具金额核对');
  await text(page.getByText('没有匹配的申请', { exact: true }), '没有匹配的申请');
  assert.deepEqual(fixture.inspect(), { records: initial, mutations: [] });
});

async function ordersReady(page) {
  await page.locator('#order-list[aria-busy=false]').waitFor();
}
async function ordersList(page) {
  await click(page, '服务台');
  await link(page.locator('#service-menu-links'), '工单中心');
  await ordersReady(page);
}
async function orderIds(page, ids) {
  await ordersReady(page);
  assert.deepEqual(
    await page.locator('article .order-id').allTextContents(),
    ids.map((i) => `WO-${i}`),
  );
}
async function ordersQuery(page, keyword) {
  await page.getByRole('searchbox', { name: '工单关键字', exact: true }).fill(keyword);
  await click(page, '查询');
  await ordersReady(page);
}
const orderCard = (page, id) => page.getByRole('article').filter({ hasText: `WO-${id}` });
async function orderDetail(page, id) {
  await click(orderCard(page, id), '查看详情');
  const d = role(page, 'dialog', '工单详情');
  await d.waitFor();
  return d;
}
test('reference WORK-001: multi-entry navigation / async cards / pagination', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await click(page, '服务台');
  await link(page.locator('#service-menu-links'), '知识公告');
  await role(page, 'heading', '公告中心暂无新消息').waitFor();
  await click(page, '服务台');
  await link(page.locator('#service-menu-links'), '工单中心');
  await page.getByText('正在加载工单…', { exact: true }).waitFor();
  await orderIds(page, [101, 102, 103]);
  await text(page.locator('#page-summary'), '共8条 · 第1/3页');
  assert.equal(new URL(page.url()).hash, '#/orders');
});
test('reference WORK-002: wrapped native selects / combined filters / reset', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await ordersList(page);
  await role(page, 'combobox', '区域').selectOption('东区');
  await role(page, 'combobox', '优先级').selectOption('高');
  await click(page, '查询');
  await orderIds(page, [105]);
  const c = orderCard(page, 105);
  for (const value of ['送风机巡检', '东区', '赵芷', '处理中']) await text(c, new RegExp(value));
  await click(page, '重置');
  await orderIds(page, [101, 102, 103]);
  for (const name of ['区域', '优先级'])
    assert.equal(await role(page, 'combobox', name).inputValue(), '');
  assert.equal(await role(page, 'searchbox', '工单关键字').inputValue(), '');
  await text(page.locator('#page-summary'), '共8条 · 第1/3页');
});
test('reference WORK-003: same-title cards resolve by region and preserve query', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await ordersList(page);
  await ordersQuery(page, '送风机巡检');
  await orderIds(page, [101, 105]);
  const east = page.getByRole('article').filter({ hasText: '东区' });
  await click(east, '查看详情');
  const d = role(page, 'dialog', '工单详情');
  for (const value of ['WO-105', '赵芷', '东区']) await text(d, new RegExp(value));
  assert.doesNotMatch(await d.innerText(), /WO-101/);
  await click(d, '关闭');
  await orderIds(page, [101, 105]);
  assert.equal(await role(page, 'searchbox', '工单关键字').inputValue(), '送风机巡检');
});
test('reference WORK-004: portal stacking / top-only close / focus / unobscured hit target', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await ordersList(page);
  await ordersQuery(page, 'WO-104');
  const d = await orderDetail(page, 104);
  await text(d, /顾禾/);
  await click(d, '服务说明');
  const top = role(page, 'dialog', '服务说明');
  await text(top, /仅关闭说明，不改变工单状态/);
  // Independent geometry check: visual point hits the top close, not underlying drawer.
  const close = role(top, 'button', '关闭');
  assert.equal(
    await close.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
    true,
  );
  assert.equal(await page.locator('#drawer-layer').evaluate((el) => el.inert), true);
  assert.equal(await page.locator('#application').evaluate((el) => el.inert), true);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await top.evaluate((el) => el.contains(document.activeElement)), true);
  }
  await click(top, '关闭');
  assert.equal(await top.isVisible(), false);
  await text(d, /WO-104[\s\S]*顾禾/);
  assert.equal(
    await role(d, 'button', '服务说明').evaluate((el) => el === document.activeElement),
    true,
  );
  await click(d, '关闭');
  assert.equal(await d.isVisible(), false);
  await orderIds(page, [104]);
  assert.equal(
    await role(orderCard(page, 104), 'button', '查看详情').evaluate(
      (el) => el === document.activeElement,
    ),
    true,
  );
  assert.equal(await page.locator('#application').evaluate((el) => el.inert), false);
});
test('reference WORK-005: page retention and filter reset from second page', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await ordersList(page);
  await click(page, '下一页');
  await orderIds(page, [104, 105, 106]);
  const d = await orderDetail(page, 106);
  await text(d, /门禁校验/);
  await click(d, '关闭');
  await text(page.locator('#page-summary'), '共8条 · 第2/3页');
  await role(page, 'combobox', '状态').selectOption('已完成');
  await click(page, '查询');
  await orderIds(page, [103, 106]);
  await text(page.locator('#page-summary'), '共2条 · 第1/1页');
});
test('reference WORK-006: local read error / retry / tab and reopen cache', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await ordersList(page);
  await ordersQuery(page, 'WO-107');
  let d = await orderDetail(page, 107);
  await role(d, 'tab', '处理记录').click();
  await text(d, /处理记录暂时不可用/);
  assert.equal(await page.getByText('2026-09-05 更换灯组', { exact: true }).isVisible(), false);
  await click(d, '重试');
  await page.getByText('2026-09-05 更换灯组', { exact: true }).waitFor();
  assert.equal(await page.getByText('处理记录暂时不可用', { exact: true }).isVisible(), false);
  await role(d, 'tab', '基本信息').click();
  await role(d, 'tab', '处理记录').click();
  await text(d, /2026-09-05 更换灯组/);
  await click(d, '关闭');
  await orderIds(page, [107]);
  d = await orderDetail(page, 107);
  await role(d, 'tab', '处理记录').click();
  await text(d, /2026-09-05 更换灯组/);
});
test('reference WORK-007: boundary link exists; no outbound navigation or Agent blocking claim', async (t) => {
  const { page } = await setup(t, 'work-orders');
  const external = role(page, 'link', '外部运维平台');
  await external.waitFor();
  assert.equal(await external.getAttribute('href'), 'https://external.invalid/ops');
  assert.equal(new URL(page.url()).hash, '#/home');
});
test('reference WORK-008: PRESERVED detail defect 30 contradicts expected 45', async (t) => {
  const { page } = await setup(t, 'work-orders');
  await ordersList(page);
  await ordersQuery(page, 'WO-105');
  await text(orderCard(page, 105), /45分钟/);
  const d = await orderDetail(page, 105);
  for (const value of ['WO-105', '送风机巡检', '赵芷']) await text(d, new RegExp(value));
  await text(
    d
      .locator('dt')
      .filter({ hasText: /^响应时限$/ })
      .locator('+ dd'),
    '30分钟',
  );
  assert.doesNotMatch(await d.innerText(), /45分钟/);
  await click(d, '关闭');
  await orderIds(page, [105]);
});

test('reference visuals: desktop / narrow / short-screen modals with no horizontal overflow', async (t) => {
  const directory = new URL('../validation/REQ-0004-visual/', import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const site of ['work-orders', 'requests']) {
    const { page } = await setup(t, site);
    for (const [width, height] of [
      [1440, 900],
      [375, 812],
      [667, 375],
    ]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (site === 'work-orders') {
        await page.goto(page.url().split('#')[0] + '#/home');
        await ordersList(page);
      } else {
        await page.goto(page.url().split('#')[0] + '#/home');
        await requestList(page);
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `${site} ${width} list overflow`,
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`${site}-${width}-list.png`, directory)),
        fullPage: true,
      });
      if (site === 'work-orders') {
        const d = await orderDetail(page, 101);
        await click(d, '服务说明');
      } else {
        await startRequest(page, '视觉检查取消样本');
        await click(page, '提交申请');
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `${site} ${width} modal overflow`,
      );
      const d =
        site === 'work-orders'
          ? role(page, 'dialog', '服务说明')
          : role(page, 'dialog', '提交申请');
      const bounds = await d.boundingBox();
      assert.ok(
        bounds.x >= 0 &&
          bounds.x + bounds.width <= width &&
          bounds.y >= 0 &&
          bounds.y + bounds.height <= height,
        `${site} modal outside viewport`,
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`${site}-${width}-modal.png`, directory)),
      });
      await click(d, site === 'work-orders' ? '关闭' : '取消');
    }
  }
});
