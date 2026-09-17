import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { snapshot } from '../src/browser.mjs';
import { runtimeLocator } from '../src/row-locator.mjs';

async function fixture(t, html) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(html);
  return page;
}

test('id-free wrapped select exposes a stable field name and same-node locator', async (t) => {
  const page = await fixture(
    t,
    `<label>园区<select><option value="">全部</option><option value="w">梧桐园</option></select></label>`,
  );
  t.diagnostic(
    JSON.stringify({
      labelText: await page.locator('label').innerText(),
      labelCount: await page.getByLabel('园区', { exact: true }).count(),
      roleCount: await page.getByRole('combobox', { name: '园区', exact: true }).count(),
      aria: await page.locator('select').ariaSnapshot(),
    }),
  );
  const shot = await snapshot(page);
  const control = shot.controls.find((c) => c.role === 'combobox');
  assert.ok(control, JSON.stringify(shot));
  assert.equal(control.name, '园区');
  const handle = await runtimeLocator(page, control.locator).elementHandle();
  assert.equal(
    await page.locator('select').evaluate((node, other) => node === other, handle),
    true,
  );
  await handle.dispose();
  await page.locator('select').selectOption('w');
  const changed = (await snapshot(page)).controls.find((c) => c.role === 'combobox');
  assert.equal(changed.name, '园区');
  assert.deepEqual(changed.locator, control.locator);
});

test('unmapped and duplicate native fields report gaps instead of silently disappearing', async (t) => {
  const page = await fixture(
    t,
    '<label>园区<select><option>全部</option></select></label><label>园区<select><option>全部</option></select></label><label>名称<input></label>',
  );
  const duplicate = await snapshot(page);
  assert.ok(!duplicate.controls.some((c) => c.role === 'combobox'));
  assert.equal(duplicate.adapter_gaps.filter((g) => g.input.tag === 'SELECT').length, 2);
  assert.ok(duplicate.adapter_gaps.every((g) => g.code === 'ADAPTER_TARGET_NOT_UNIQUE'));
  const missing = await snapshot(page, {
    adapterSource: 'export function locate(element) { return null; }',
  });
  assert.equal(
    missing.adapter_gaps.filter((g) => ['SELECT', 'INPUT'].includes(g.input.tag)).length,
    3,
  );
});

test('field hints cover explicit, ARIA, multiple-label, decoration and native listbox layouts', async (t) => {
  const page = await fixture(
    t,
    `<label for="region">区域</label><select id="region"><option>全部</option></select>
    <label>低优先级<select aria-label="状态"><option>正常</option></select></label>
    <span id="model-label" hidden>型号</span><select aria-label="ignored" aria-labelledby="model-label"><option>A</option></select>
    <label for="code">设备</label><label for="code">编号</label><input id="code">
    <label><span>负责人</span><span aria-hidden="true">★</span><input></label>
    <label>分类<select multiple><option>A</option><option>B</option></select></label>
    <label>分组<select size="3"><option>A</option><option>B</option></select></label>
    <label>备注<textarea></textarea></label>`,
  );
  const shot = await snapshot(page);
  for (const [name, role] of [
    ['区域', 'combobox'],
    ['状态', 'combobox'],
    ['型号', 'combobox'],
    ['设备 编号', 'textbox'],
    ['负责人', 'textbox'],
    ['分类', 'listbox'],
    ['分组', 'listbox'],
    ['备注', 'textbox'],
  ]) {
    const controls = shot.controls.filter((c) => c.name === name && c.role === role);
    assert.equal(controls.length, 1, `${role}/${name}: ${JSON.stringify(shot)}`);
    assert.equal(await runtimeLocator(page, controls[0].locator).count(), 1);
  }
  assert.deepEqual(shot.adapter_gaps, []);
});

test('custom adapters cannot rebind a field to another uniquely named native control', async (t) => {
  const page = await fixture(
    t,
    '<label>区域<select><option>全部</option></select></label><label>状态<select><option>正常</option></select></label>',
  );
  const shot = await snapshot(page, {
    adapterSource:
      'export function locate(element) { return {kind:"role",role:"combobox",name:"状态",exact:true}; }',
  });
  assert.deepEqual(
    shot.controls.map((c) => c.name),
    ['状态'],
  );
  assert.equal(shot.adapter_gaps.length, 1);
  assert.equal(shot.adapter_gaps[0].code, 'ADAPTER_TARGET_IDENTITY_MISMATCH');
});

test('repair gaps do not expose sensitive input values or invite sensitive-field mapping', async (t) => {
  const page = await fixture(
    t,
    '<label>名称<input value="ordinary"></label><label>连接值<input name="api_key" value="synthetic-only-private-value"></label><label>验证<input autocomplete="one-time-code" value="synthetic-only-otp"></label>',
  );
  const shot = await snapshot(page, {
    adapterSource: 'export function locate(element) { return null; }',
  });
  assert.deepEqual(
    shot.adapter_gaps.map((g) => g.input.label),
    ['名称'],
  );
  assert.ok(!JSON.stringify(shot).includes('synthetic-only-private-value'));
  assert.ok(!JSON.stringify(shot).includes('synthetic-only-otp'));
});
