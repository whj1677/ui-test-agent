// Asset/reference verification only. Never supplies locators or actions to the Agent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { startHeldoutLab } from './serve.mjs';
import { chromium } from 'playwright';
const fixture = await startHeldoutLab(0);
const base = fixture.url;
const browser = await chromium.launch({ headless: true });
test.after(async () => {
  await browser.close();
  await fixture.close();
});
const cases = JSON.parse(await fs.readFile(new URL('./cases.json', import.meta.url), 'utf8'));
assert.equal(cases.cases.length, 8);
const names = {
  q1: '工作区一',
  q2: '工作区二',
  f1: '工作区三',
  f2: '工作区四',
  m1: '工作区五',
  m2: '工作区六',
  s1: '工作区七',
  s2: '工作区八',
};
const matrix = (p) =>
  p.locator('#rows tr').evaluateAll((rows) =>
    rows.map((r) =>
      Array.from(r.cells)
        .slice(0, -1)
        .map((c) => c.textContent.trim()),
    ),
  );
const sample = async (p) => {
  await p.locator('#kw').fill('H106');
  await p.getByRole('button', { name: '查询', exact: true }).click();
  assert.equal(await p.locator('#counter').textContent(), '共1条 · 第1/1页');
  assert.deepEqual((await matrix(p))[0], ['H106', '循环泵', '西站', '检修', '220 kW']);
  await p.locator('#rows').getByRole('button', { name: '详情', exact: true }).click();
  assert.equal(await p.locator('#loading').isVisible(), true);
  await p.locator('#detailId').getByText('H106', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await p.locator('#loading').isVisible(), false);
};
const hits = (p) =>
  p.locator('#closeDetail').evaluate((b) => {
    const r = b.getBoundingClientRect();
    return [
      [0.5, 0.5],
      [0.15, 0.15],
      [0.85, 0.15],
      [0.15, 0.85],
      [0.85, 0.85],
    ].map(([x, y]) => {
      const h = document.elementFromPoint(r.x + r.width * x, r.y + r.height * y);
      return { received: h === b || b.contains(h), hit: h?.className };
    });
  });
test('complete seed identity, power total, duplicate names and fresh-context isolation', async (t) => {
  const ctx = await browser.newContext();
  t.after(() => ctx.close());
  const p = await ctx.newPage();
  await p.goto(base + '/probe/q1');
  const all = [];
  for (let page = 1; page <= 4; page++) {
    all.push(...(await matrix(p)));
    if (page < 4) await p.getByRole('button', { name: '下一页', exact: true }).click();
  }
  assert.deepEqual(
    all.map((r) => [r[0], r[2], r[3], Number(r[4].split(' ')[0])]),
    [
      ['H101', '东站', '巡检', 80],
      ['H102', '西站', '检修', 120],
      ['H103', '东站', '检修', 60],
      ['H104', '西站', '巡检', 95],
      ['H105', '东站', '巡检', 140],
      ['H106', '西站', '检修', 220],
      ['H107', '东站', '检修', 300],
      ['H108', '西站', '巡检', 40],
      ['H109', '东站', '巡检', 180],
      ['H110', '西站', '检修', 110],
      ['H111', '东站', '检修', 260],
      ['H112', '西站', '巡检', 200],
    ],
  );
  assert.equal(
    all.reduce((s, r) => s + Number(r[4].split(' ')[0]), 0),
    1805,
  );
  assert.equal(all[1][1], '循环泵');
  assert.equal(all[5][1], '循环泵');
  const fresh = await browser.newContext();
  t.after(() => fresh.close());
  const f = await fresh.newPage();
  await f.goto(base + '/probe/q1');
  assert.deepEqual(
    (await matrix(f)).map((r) => r[0]),
    ['H101', 'H102', 'H103'],
  );
});
test('browser back/forward recomputes route-specific defects without stale view state', async (t) => {
  const ctx = await browser.newContext();
  t.after(() => ctx.close());
  const p = await ctx.newPage();
  await p.goto(base);
  await p.locator('.gridlinks').getByRole('link', { name: '工作区二', exact: true }).click();
  await p.getByLabel('所属站点', { exact: true }).selectOption('西站');
  await p.getByLabel('任务类型', { exact: true }).selectOption('检修');
  await p.getByRole('button', { name: '查询', exact: true }).click();
  assert.equal(await p.locator('#counter').textContent(), '共6条 · 第1/2页');
  await p
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作区一', exact: true })
    .click();
  assert.equal(await p.locator('#counter').textContent(), '共12条 · 第1/4页');
  await p.getByLabel('所属站点', { exact: true }).selectOption('西站');
  await p.getByLabel('任务类型', { exact: true }).selectOption('检修');
  await p.getByRole('button', { name: '查询', exact: true }).click();
  assert.equal(await p.locator('#counter').textContent(), '共3条 · 第1/1页');
  await p.goBack();
  assert.equal(await p.locator('#counter').textContent(), '共12条 · 第1/4页');
  await p.getByLabel('所属站点', { exact: true }).selectOption('西站');
  await p.getByLabel('任务类型', { exact: true }).selectOption('检修');
  await p.getByRole('button', { name: '查询', exact: true }).click();
  assert.equal(await p.locator('#counter').textContent(), '共6条 · 第1/2页');
});
for (const entry of ['direct', 'menu'])
  for (const kind of Object.keys(names)) {
    test(`${entry} ${kind}: verify independent normative data and intended contrast`, async (t) => {
      const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      t.after(() => ctx.close());
      const p = await ctx.newPage(),
        external = [],
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await ctx.route('**/*', async (route) => {
        if (new URL(route.request().url()).origin !== base) {
          external.push(route.request().url());
          await route.abort();
        } else await route.continue();
      });
      await p.goto(entry === 'direct' ? `${base}/probe/${kind}` : base);
      if (entry === 'menu') {
        assert.match(await p.locator('#homeView').textContent(), /1805 kW/);
        await p.locator('.gridlinks').getByRole('link', { name: names[kind], exact: true }).click();
      }
      assert.equal(await p.locator('#counter').textContent(), '共12条 · 第1/4页');
      assert.deepEqual(
        (await matrix(p)).map((r) => r[0]),
        ['H101', 'H102', 'H103'],
      );
      const original = await matrix(p);
      if (kind.startsWith('q')) {
        await p.getByLabel('所属站点', { exact: true }).selectOption('西站');
        await p.getByLabel('任务类型', { exact: true }).selectOption('检修');
        assert.deepEqual(await matrix(p), original);
        await p.getByRole('button', { name: '查询', exact: true }).click();
        if (kind === 'q1') {
          assert.equal(await p.locator('#counter').textContent(), '共3条 · 第1/1页');
          const rows = await matrix(p);
          assert.deepEqual(
            rows.map((r) => r[0]),
            ['H102', 'H106', 'H110'],
          );
          assert.deepEqual(
            rows.map((r) => r.slice(2)),
            [
              ['西站', '检修', '120 kW'],
              ['西站', '检修', '220 kW'],
              ['西站', '检修', '110 kW'],
            ],
          );
        } else {
          assert.equal(await p.locator('#counter').textContent(), '共6条 · 第1/2页');
          assert.deepEqual(
            (await matrix(p)).map((r) => r[0]),
            ['H102', 'H104', 'H106'],
          );
          assert.equal((await matrix(p))[1][3], '巡检');
        }
        await p.getByRole('button', { name: '重置', exact: true }).click();
        await p.waitForFunction(
          () => document.querySelector('#counter').textContent === '共12条 · 第1/4页',
        );
        assert.deepEqual(await matrix(p), original);
      } else if (kind.startsWith('s')) {
        await p.getByLabel('排序', { exact: true }).selectOption('power-desc');
        assert.deepEqual(await matrix(p), original);
        await p.getByRole('button', { name: '查询', exact: true }).click();
        const rows = await matrix(p);
        assert.deepEqual(
          rows.map((r) => r[0]),
          kind === 's1' ? ['H107', 'H111', 'H106'] : ['H107', 'H106', 'H111'],
        );
        assert.deepEqual(
          rows.map((r) => r[4]),
          kind === 's1' ? ['300 kW', '260 kW', '220 kW'] : ['300 kW', '220 kW', '260 kW'],
        );
        await p.getByRole('button', { name: '下一页', exact: true }).click();
        assert.equal(await p.locator('#counter').textContent(), '共12条 · 第2/4页');
        assert.deepEqual(
          (await matrix(p)).map((r) => [r[0], r[4]]),
          [
            ['H112', '200 kW'],
            ['H109', '180 kW'],
            ['H105', '140 kW'],
          ],
        );
      } else {
        await sample(p);
        if (kind.startsWith('f')) {
          assert.equal(await p.locator('#fName').textContent(), '循环泵');
          assert.equal(await p.locator('#fStation').textContent(), '西站');
          assert.equal(
            await p.locator('#fPower').textContent(),
            kind === 'f1' ? '220 kW' : '320 kW',
          );
          assert.match(await p.locator('.note').textContent(), /220 kW/);
          await p.getByRole('tab', { name: '作业参数', exact: true }).click();
          assert.deepEqual(await p.locator('#paneParam dd').allTextContents(), ['9天', '65℃']);
          assert.equal(await p.locator('#detailId').textContent(), 'H106');
          await p.getByRole('tab', { name: '基本信息', exact: true }).click();
          assert.equal(
            await p.locator('#fPower').textContent(),
            kind === 'f1' ? '220 kW' : '320 kW',
          );
        } else {
          await p.getByRole('button', { name: '读取说明', exact: true }).click();
          assert.equal(await p.locator('#detailDlg').evaluate((n) => n.open), true);
          assert.equal(await p.locator('#sampleDlg').evaluate((n) => n.open), true);
          assert.equal(await p.locator('#sampleDlg p').textContent(), '每90秒采样');
          await p.getByRole('button', { name: '关闭说明', exact: true }).click();
          assert.equal(await p.locator('#sampleDlg').evaluate((n) => n.open), false);
          assert.equal(await p.locator('#detailId').textContent(), 'H106');
          assert.equal(await p.locator('#closeDetail').isVisible(), true);
          assert.equal(await p.locator('#closeDetail').isEnabled(), true);
          const points = await hits(p);
          assert.deepEqual(
            points.map((x) => x.received),
            Array(5).fill(kind === 'm1'),
          );
          if (kind === 'm2') assert.ok(points.every((x) => x.hit === 'seam'));
          // Screenshots kept only in ignored draft reference evidence; no test outputs in frozen assets.
        }
        if (kind !== 'm2') {
          await p.getByRole('button', { name: '关闭详情', exact: true }).click();
          assert.equal(await p.locator('#detailDlg').evaluate((n) => n.open), false);
          assert.equal(await p.locator('#kw').inputValue(), 'H106');
          assert.equal(await p.locator('#counter').textContent(), '共1条 · 第1/1页');
        }
      }
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      assert.equal(await p.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.deepEqual(await ctx.cookies(), []);
    });
  }
