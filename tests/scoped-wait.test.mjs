import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { runtimeLocator } from '../src/row-locator.mjs';
import { perform } from '../src/browser.mjs';

const target = {
  kind: 'within',
  scope: { role: 'dialog', name: '设备详情', exact: true },
  target: { kind: 'role', role: 'heading', name: 'D009', exact: true },
};
for (const scenario of ['transition', 'persistent', 'hidden']) {
  test(`scoped readonly wait reobserves ambiguity within one deadline: ${scenario}`, async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent(
      '<div role="dialog" aria-label="设备详情" id="old">加载中</div><div role="dialog" aria-label="设备详情" id="current"><h2>D009</h2></div><script>window.clicks=0;document.addEventListener("click",()=>window.clicks++)</script>',
    );
    if (scenario === 'transition')
      await page.evaluate(() => setTimeout(() => document.querySelector('#old').remove(), 150));
    const start = Date.now();
    if (scenario === 'transition') {
      await perform(page, { op: 'wait', target, state: 'visible' }, 'http://fixture.test/');
      assert.equal(await runtimeLocator(page, target).count(), 1);
    } else {
      await assert.rejects(
        runtimeLocator(page, target).waitFor({
          state: scenario === 'hidden' ? 'hidden' : 'visible',
          timeout: 250,
        }),
        { code: 'WITHIN_SCOPE_NOT_UNIQUE' },
      );
      assert.ok(Date.now() - start < 2000, 'no timeout reset');
    }
    assert.equal(await page.evaluate(() => window.clicks), 0, 'observation must not dispatch');
  });
}
