import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { snapshot } from '../src/browser.mjs';
import { runtimeLocator } from '../src/row-locator.mjs';
import { requireAdaptiveAssertionTargets } from '../src/adaptive-execution.mjs';
import { requireAdaptivePageTarget } from '../src/expectation-coverage.mjs';

async function fixture(t, html) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<h1>静态文本</h1>' + html);
  return page;
}

test('unattributed scalar texts enter the current catalog with exact same-node binding', async (t) => {
  const page = await fixture(
    t,
    '<section><button>上一页</button><span>共12条 · 第2/3页</span><button>下一页</button><p>正在同步</p><output>最后更新于12:00</output></section>',
  );
  const shot = await snapshot(page);
  for (const value of ['共12条 · 第2/3页', '正在同步', '最后更新于12:00']) {
    const c = shot.controls.find((c) => c.text_context?.value === value);
    assert.ok(c, value);
    assert.deepEqual(c.locator, { kind: 'text', value, exact: true });
    assert.equal(c.text_context.read_only, true);
    assert.equal(await runtimeLocator(page, c.locator).count(), 1);
    assert.equal(await runtimeLocator(page, c.locator).innerText(), value);
  }
});

test('duplicate, hidden, interactive, sensitive and long leaf text is not promoted', async (t) => {
  const page = await fixture(
    t,
    '<span>重复</span><span>重复</span><span hidden>隐藏</span><button><span>执行</span></button><span>API Key: synthetic-not-a-key</span><p>' +
      '正文'.repeat(100) +
      '</p>',
  );
  const shot = await snapshot(page);
  assert.equal(shot.controls.filter((c) => c.text_context).length, 0);
  assert.ok(shot.controls.some((c) => c.role === 'button' && c.name === '执行'));
  const custom = await snapshot(page, {
    adapterSource: 'export function locate(element) { return null; }',
  });
  assert.equal(custom.controls.length, 0);
});

test('scoped static text does not steal another object and custom adapter is not bypassed', async (t) => {
  const page = await fixture(
    t,
    '<article aria-label="对象A"><span>状态正常</span></article><article aria-label="对象B"><span>状态正常</span></article><p>独立文本</p>',
  );
  const shot = await snapshot(page);
  const statuses = shot.controls.filter((c) => c.text_context?.value === '状态正常');
  assert.equal(statuses.length, 2);
  assert.deepEqual(
    statuses.map((c) => c.locator.scope.name),
    ['对象A', '对象B'],
  );
  const custom = await snapshot(page, {
    adapterSource: 'export function locate(element) { return null; }',
  });
  assert.equal(custom.controls.length, 0);
});

test('page-counter whole-table binding is rejected for role, CSS and testid aliases', async (t) => {
  const page = await fixture(
    t,
    '<table id="assets" data-testid="assets"><tbody><tr><td>D009</td></tr></tbody></table><span id="pager">第1/3页</span>',
  );
  const original = { expected: '分页显示第2/3页。' };
  const assertion = (target) => ({ target, check: 'text', expected: '第2/3页' });
  for (const target of [
    { kind: 'role', role: 'table', name: '', exact: true },
    { kind: 'css', value: '#assets' },
    { kind: 'testid', value: 'assets' },
  ])
    await assert.rejects(
      requireAdaptiveAssertionTargets(page, { assertions: [assertion(target)] }, original),
      { code: 'ADAPTIVE_TARGET_PAGE_MISMATCH' },
    );
  assert.throws(
    () =>
      requireAdaptivePageTarget(
        assertion({ kind: 'role', role: 'table', name: '', exact: true }),
        original,
      ),
    { code: 'ADAPTIVE_TARGET_PAGE_MISMATCH' },
  );
  await requireAdaptiveAssertionTargets(
    page,
    { assertions: [assertion({ kind: 'css', value: '#pager' })] },
    original,
  );
});
