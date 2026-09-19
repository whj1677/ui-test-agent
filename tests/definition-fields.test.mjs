import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { snapshot, checkAssertionGroup } from '../src/browser.mjs';
import { runtimeLocator } from '../src/row-locator.mjs';

test('definition values have independent scoped targets instead of whole-dialog text', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(
    '<dialog open aria-label="设备 D009"><h2>详情</h2><dl><dt>名称</dt><dd data-field="name">储能柜</dd><dt>额定功率</dt><dd data-field="power">120 kW</dd></dl><button>读取说明</button><p>历史值200 kW</p></dialog><article aria-label="关联设备"><dl><dt>额定功率</dt><dd data-field="power">200 kW</dd></dl></article>',
  );
  const observed = await snapshot(page);
  const fields = observed.controls.filter((c) => c.field_context);
  assert.equal(fields.length, 3, JSON.stringify(observed.observation_diagnostics));
  const power = fields.find(
    (c) => c.scope_context?.name === '设备 D009' && c.field_context.label === '额定功率',
  );
  assert.equal(power.field_context.value, '120 kW');
  assert.equal(await runtimeLocator(page, power.locator).evaluate((e) => e.innerText), '120 kW');
  assert.ok(!power.field_context.value.includes('200'));
  const measured = await checkAssertionGroup(
    page,
    [{ target: power.locator, check: 'text', expected: '200 kW' }],
    { timeout: 100 },
  );
  assert.equal(measured[0].passed, false);
  assert.equal(measured[0].actual, '120 kW');
  await page.locator('dialog dl').evaluate((dl) => {
    const duplicate = document.createElement('dd');
    duplicate.dataset.field = 'power';
    duplicate.textContent = '200 kW';
    const label = document.createElement('dt');
    label.textContent = '备用功率';
    dl.append(label, duplicate);
  });
  const ambiguous = await snapshot(page);
  assert.ok(
    !ambiguous.controls.some(
      (c) => c.scope_context?.name === '设备 D009' && c.field_context?.label === '额定功率',
    ),
  );
});
