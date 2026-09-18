import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { snapshot } from '../src/browser.mjs';
import { runtimeLocator } from '../src/row-locator.mjs';

async function fixture(t, html) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<h1>覆盖试验</h1>' + html);
  return page;
}
const noise = (count) =>
  Array.from({ length: count }, (_, i) => `<div id="noise-${i}">无关数据 ${i}</div>`).join('');
function accounting(shot) {
  const c = shot.coverage;
  assert.ok(c.sampled_count <= 300);
  assert.equal(c.eligible_count, c.sampled_count + c.omitted_count);
  assert.equal(c.sampled_count, shot.observation_diagnostics.raw_count);
  assert.equal(
    c.regions.reduce((n, r) => n + r.eligible_count, 0) + c.unlisted_eligible_count,
    c.eligible_count,
  );
  assert.equal(
    c.regions.reduce((n, r) => n + r.sampled_count, 0) + c.unlisted_sampled_count,
    c.sampled_count,
  );
  for (const r of c.regions) assert.equal(r.eligible_count, r.sampled_count + r.omitted_count);
}

test('small page keeps DOM order, original facts and same-node locators', async (t) => {
  const page = await fixture(
    t,
    '<nav><a href="#list">电价管理</a></nav><label>名称<input value="日间"></label><button>查看详情</button>',
  );
  const shot = await snapshot(page);
  assert.equal(shot.coverage.mode, 'dom-order');
  assert.equal(shot.coverage.truncated, false);
  assert.deepEqual(
    shot.controls.map((c) => c.name),
    ['覆盖试验', '电价管理', '名称', '查看详情'],
  );
  assert.equal(shot.controls[2].current_value, '日间');
  for (const control of shot.controls)
    assert.equal(await runtimeLocator(page, control.locator).count(), 1);
  accounting(shot);
});

test('tail dialogs, current wizard and navigation survive a large preceding page', async (t) => {
  const page = await fixture(
    t,
    noise(450) +
      `<nav><a href="#tariff">电价管理</a></nav>
    <ol><li aria-current="step">基本信息</li></ol><section><h2>基本信息</h2><label>备注<input></label></section>
    <section role="dialog" aria-label="参数"><button>关闭参数</button><label>功率<input></label></section>
    <section role="dialog" aria-label="帮助"><button>关闭帮助</button></section>`,
  );
  const shot = await snapshot(page);
  for (const name of ['覆盖试验', '电价管理', '基本信息', '备注', '关闭参数', '功率', '关闭帮助'])
    assert.ok(
      shot.controls.some((c) => c.name === name),
      name,
    );
  for (const kind of ['dialog', 'step', 'navigation', 'page'])
    assert.ok(shot.coverage.regions.some((r) => r.kind === kind));
  assert.equal(shot.coverage.mode, 'region-balanced');
  assert.equal(shot.coverage.sampled_count, 300);
  assert.ok(shot.coverage.omitted_count > 150);
  accounting(shot);
});

test('literal action hints rescue a late target even among hundreds of buttons', async (t) => {
  const buttons = Array.from({ length: 420 }, (_, i) => `<button>查看项目${i}</button>`).join('');
  const page = await fixture(t, buttons + '<button>查看青桐目录</button>');
  const original = { action: '点击「查看青桐目录」', expected: '查看项目300' };
  const shot = await snapshot(page, { focusText: [original.action] });
  assert.ok(shot.controls.some((c) => c.name === '查看青桐目录'));
  assert.ok(
    !shot.controls.some((c) => c.name === original.expected),
    'expected text was not promoted',
  );
  const target = shot.controls.find((c) => c.name === '查看青桐目录');
  assert.equal(await runtimeLocator(page, target.locator).innerText(), '查看青桐目录');
  accounting(shot);
});

test('long table does not consume all sample slots or erase a later named region', async (t) => {
  const rows = Array.from(
    { length: 350 },
    (_, i) => `<tr><td>对象${i}</td><td>正常</td></tr>`,
  ).join('');
  const page = await fixture(
    t,
    `<table id="catalog"><thead><tr><th>名称</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table>
    <section><h2>更多查询</h2><label>站点<input></label><button>打开筛选</button></section>`,
  );
  const shot = await snapshot(page);
  assert.ok(shot.controls.some((c) => c.name === '打开筛选'));
  assert.ok(shot.controls.some((c) => c.name === '站点'));
  assert.equal(shot.controls.find((c) => c.role === 'table').row_count, 350);
  assert.ok(shot.coverage.regions.some((r) => r.kind === 'table' && r.omitted_count > 0));
  accounting(shot);
});

test('more regions and dialog controls than the budget remain explicitly incomplete', async (t) => {
  const regions = Array.from(
    { length: 30 },
    (_, i) =>
      `<section><h2>区域${i}</h2>${Array.from({ length: 12 }, (_, j) => `<button>查看${i}-${j}</button>`).join('')}</section>`,
  ).join('');
  const dialogs = ['A', 'B']
    .map(
      (name) =>
        `<section role="dialog" aria-label="窗口${name}">${Array.from({ length: 180 }, (_, i) => `<button>查看${name}-${i}</button>`).join('')}</section>`,
    )
    .join('');
  const page = await fixture(t, regions + dialogs);
  const shot = await snapshot(page);
  assert.equal(shot.coverage.regions.length, 24);
  assert.equal(shot.coverage.omitted_region_count, 9);
  const d = shot.coverage.regions.filter((r) => r.kind === 'dialog');
  assert.equal(d.length, 2);
  assert.ok(d.every((r) => r.sampled_count >= 48 && r.omitted_count > 0));
  accounting(shot);
});

test('hidden, password, frame and shadow content never masquerade as covered', async (t) => {
  const page = await fixture(
    t,
    noise(310) +
      `<button hidden>隐藏详情</button><input type="password" value="synthetic-do-not-report">
    <iframe srcdoc="<button>框架详情</button>"></iframe><div id="shadow"></div><div id="closed"></div>`,
  );
  await page.evaluate(() => {
    document.querySelector('#shadow').attachShadow({ mode: 'open' }).innerHTML =
      '<button>影子详情</button>';
    document.querySelector('#closed').attachShadow({ mode: 'closed' }).innerHTML =
      '<button>关闭影子</button>';
  });
  const shot = await snapshot(page, {
    marker: { kind: 'role', role: 'heading', name: '覆盖试验', exact: true },
  });
  for (const name of ['隐藏详情', '框架详情', '影子详情', '关闭影子'])
    assert.ok(!shot.controls.some((c) => c.name === name));
  assert.ok(!JSON.stringify(shot).includes('synthetic-do-not-report'));
  assert.deepEqual(shot.coverage.iframes, { count: 1, contents_captured: false });
  assert.deepEqual(shot.coverage.shadow_dom, {
    open_hosts: 1,
    contents_captured: false,
    closed_roots: 'unknown',
  });
  accounting(shot);
});

test('long text truncation is explicit even on a small control page', async (t) => {
  const page = await fixture(t, '<p>' + '正文'.repeat(9000) + '</p><button>后部详情</button>');
  const shot = await snapshot(page);
  assert.equal(shot.coverage.text_truncated, true);
  assert.equal(shot.text.length, 16000);
  assert.equal(shot.coverage.truncated, false);
  assert.ok(shot.controls.some((c) => c.name === '后部详情'));
  accounting(shot);
});
