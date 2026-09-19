import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startContrastLab } from './serve.mjs';
import { importCases } from '../src/importer.mjs';

// Independent reference observations, NOT autonomous Agent results.
const oracle = JSON.parse(await fs.readFile(new URL('./oracle.json', import.meta.url), 'utf8'));
let site, browser;
before(async () => {
  site = await startContrastLab(0);
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await site?.close();
});
async function fixture(t, route = '/site/a1', viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' }),
    p = await ctx.newPage(),
    errors = [],
    external = [];
  p.setDefaultTimeout(4000);
  p.on('pageerror', (e) => errors.push(e.message));
  await ctx.route('**/*', (r) => {
    if (new URL(r.request().url()).origin !== site.url) {
      external.push(r.request().url());
      return r.abort();
    }
    return r.continue();
  });
  t.after(async () => {
    await ctx.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  });
  await p.goto(site.url + route);
  return p;
}
const btn = (root, name) => root.getByRole('button', { name, exact: true });
async function details(p) {
  const row = p
    .getByRole('row')
    .filter({ has: p.getByRole('cell', { name: 'D009', exact: true }) });
  await btn(row, '详情').click();
  const d = p.getByRole('dialog', { name: '设备详情', exact: true });
  await d.locator('section[aria-busy="false"]').waitFor();
  return d;
}
async function values(d) {
  return d.locator('section').evaluate((s) => {
    if (s.querySelector('table'))
      return Object.fromEntries(
        [...s.querySelectorAll('tbody tr')].map((r) => [
          r.cells[0].textContent,
          r.cells[1].textContent,
        ]),
      );
    return Object.fromEntries(
      [...s.querySelectorAll('dt')].map((dt) => [
        dt.textContent,
        dt.nextElementSibling.textContent,
      ]),
    );
  });
}
async function hitTarget(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [
      [0.5, 0.5],
      [0.2, 0.2],
      [0.8, 0.2],
      [0.2, 0.8],
      [0.8, 0.8],
    ].every(([x, y]) => {
      const hit = document.elementFromPoint(r.x + r.width * x, r.y + r.height * y);
      return hit === el || el.contains(hit);
    });
  });
}

for (const spec of oracle.cases)
  test('independent truth ' + spec.id, async (t) => {
    const p = await fixture(t, spec.path);
    assert.equal(await p.getByRole('row').count(), 3);
    assert.equal(await btn(p, '详情').count(), 2);
    const d = await details(p),
      v = await values(d);
    let actual;
    if (spec.field === 'identity') actual = await d.getByRole('heading', { level: 2 }).innerText();
    else if (spec.field === 'power') actual = v['额定功率'];
    else if (spec.field === 'park') actual = v['园区'];
    else {
      await btn(d, '读取说明').click();
      const child = p.getByRole('dialog', { name: '读取说明', exact: true });
      assert.match(await child.innerText(), /读数每60秒更新/);
      assert.equal(await p.locator('dialog[open]').count(), 2);
      await btn(child, '关闭说明').click();
      // dialog.close() queues the close event; wait for its actual teardown,
      // not just removal of the open attribute, before measuring the post-close state.
      await child.waitFor({ state: 'detached' });
      assert.equal(await p.locator('dialog[open]').count(), 1);
      actual = await hitTarget(btn(d, '关闭详情'));
    }
    assert.equal(
      actual,
      spec.actual,
      actual === spec.actual
        ? undefined
        : JSON.stringify(
            await d.evaluate((el) => ({
              html: el.innerHTML,
              cover: el.querySelector('.interceptor')?.getBoundingClientRect().toJSON(),
              button: el.querySelector('[data-close]')?.getBoundingClientRect().toJSON(),
              style: el.querySelector('.interceptor')
                ? getComputedStyle(el.querySelector('.interceptor')).pointerEvents
                : null,
            })),
          ),
    );
    const valid =
      spec.field === 'identity'
        ? actual === 'D009'
        : spec.field === 'power'
          ? actual === '200 kW'
          : spec.field === 'park'
            ? actual === '南园'
            : actual === true;
    assert.equal(valid, spec.expected === 'PASS_ASSERTIONS');
    if (spec.expected === 'PASS_ASSERTIONS') {
      assert.deepEqual(v, { 名称: '储能柜', 园区: '南园', 额定功率: '200 kW' });
      await btn(d, '关闭详情').click();
      assert.equal(await p.locator('dialog[open]').count(), 0);
    }
  });

test('import eight complete cases without grading outcomes or variant hints', async () => {
  const file = await fs.readFile(new URL('./cases.json', import.meta.url));
  const r = await importCases('contrast.json', file);
  assert.equal(r.cases.length, 8);
  assert.equal(new Set(r.cases.map((c) => c.case_id)).size, 8);
  for (const c of r.cases) {
    assert.ok(c.steps.every((s) => s.action && s.expected));
    assert.equal(Object.hasOwn(c, 'expected_status'), false);
    assert.doesNotMatch(c.title, /故障|错误|缺陷|正常/);
  }
});
for (const route of [
  '/oracle.json',
  '/SPEC.md',
  '/cases.json',
  '/verify.test.mjs',
  '/../src/server.mjs',
  '/site/a1?oracle=1',
])
  test('server does not serve grading or repository: ' + route, async () => {
    assert.equal((await fetch(site.url + route)).status, 404);
  });
test('server only accepts readonly methods', async () => {
  assert.equal((await fetch(site.url, { method: 'POST' })).status, 405);
});
test('query empty result and reset keep row identity', async (t) => {
  const p = await fixture(t);
  await p.getByLabel('关键词').fill('不存在');
  await btn(p, '查询').click();
  assert.equal(await p.getByRole('row').count(), 1);
  assert.equal(await p.getByRole('status').innerText(), '共0条');
  await btn(p, '重置').click();
  assert.equal(await p.getByRole('row').count(), 3);
});
test('normal nested Escape restores parent and focus', async (t) => {
  const p = await fixture(t, '/site/d1');
  const d = await details(p);
  await btn(d, '读取说明').click();
  const child = p.getByRole('dialog', { name: '读取说明', exact: true });
  await p.keyboard.press('Escape');
  await child.waitFor({ state: 'detached' });
  assert.equal(await p.locator('dialog[open]').count(), 1);
  assert.equal(await p.evaluate(() => document.activeElement.textContent), '读取说明');
  assert.equal(await hitTarget(btn(d, '关闭详情')), true);
});
test('closing while pending does not resurrect stale detail', async (t) => {
  const p = await fixture(t, '/site/b1');
  const row = p
    .getByRole('row')
    .filter({ has: p.getByRole('cell', { name: 'D009', exact: true }) });
  await btn(row, '详情').click();
  await btn(p.getByRole('dialog'), '关闭详情').click();
  await p.waitForTimeout(400);
  assert.equal(await p.locator('dialog').count(), 0);
});
for (const viewport of [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
])
  test('usable layout ' + viewport.width, async (t) => {
    const p = await fixture(t, '/site/b1', viewport);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const d = await details(p);
    assert.ok(await hitTarget(btn(d, '关闭详情')));
    await fs.mkdir(new URL('../validation/req0017/v9-visual/', import.meta.url), {
      recursive: true,
    });
    await p.screenshot({
      path: fileURLToPath(
        new URL(`../validation/req0017/v9-visual/contrast-${viewport.width}.png`, import.meta.url),
      ),
      fullPage: true,
    });
  });

// Known weak-oracle witness: passing a broad contains is not evidence of correctness.
for (const route of ['/site/a2', '/site/b2', '/site/c2'])
  test('broad text witness can match a wrong field/object ' + route, async (t) => {
    const p = await fixture(t, route),
      d = await details(p),
      text = await d.innerText();
    for (const decoy of ['储能柜', '南园', '200 kW']) assert.ok(text.includes(decoy));
    if (route.endsWith('c2')) {
      assert.ok(text.includes('D009'));
      assert.notEqual(await d.getByRole('heading').innerText(), 'D009');
    } else
      assert.notDeepEqual(await values(d), { 名称: '储能柜', 园区: '南园', 额定功率: '200 kW' });
  });
