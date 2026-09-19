import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { snapshot, checkAssertionGroup } from '../src/browser.mjs';
import { runtimeLocator } from '../src/row-locator.mjs';
import { validateLocator, validateAction, validateAssertion } from '../src/plans.mjs';
import { startLab } from '../manual-lab/serve.mjs';

const definition = (name) => ({
  kind: 'within',
  scope: { role: 'dialog', name: '详情', exact: true },
  target: { kind: 'definition', name, exact: true },
});

test('definition schema stays scoped and read-only', () => {
  const target = definition('功率');
  assert.doesNotThrow(() => validateLocator(target));
  assert.doesNotThrow(() => validateAssertion({ target, check: 'number', expected: 200 }));
  assert.throws(
    () => validateAssertion({ target: target.target, check: 'number', expected: 200 }),
    { code: 'DEFINITION_SCOPE_REQUIRED' },
  );
  for (const op of ['click', 'hover', 'wait', 'fill'])
    assert.throws(
      () => validateAction({ action_id: 'A1', op, target }, 'http://localhost/', new Set()),
      { code: 'DEFINITION_ASSERTION_ONLY' },
    );
  assert.throws(() => validateAssertion({ target, check: 'contains', expected: '200' }), {
    code: 'DEFINITION_CHECK_UNSUPPORTED',
  });
  assert.throws(() => validateLocator(definition('API Key')), {
    code: 'SENSITIVE_CONTROL_FORBIDDEN',
  });
  assert.throws(() => validateLocator({ ...target, target: { ...target.target, nth: 0 } }));
});

test('unattributed wrapped definition fields bind labels not matching values or historical decoys', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(
    '<dialog open aria-label="详情"><h2>设备X</h2><dl><div><dt>功率</dt><dd>120</dd></div><div><dt>电压</dt><dd>200</dd></div></dl><p>历史功率200</p></dialog><article aria-label="其他对象"><dl><dt>功率</dt><dd>200</dd></dl></article>',
  );
  const observed = await snapshot(page);
  const power = observed.controls.find(
    (c) => c.field_context?.label === '功率' && c.scope_context?.role === 'dialog',
  );
  assert.deepEqual(power.locator, definition('功率'));
  assert.equal(power.field_context.value, '120');
  const [wrong] = await checkAssertionGroup(
    page,
    [{ target: power.locator, check: 'number', expected: 200 }],
    { timeout: 100 },
  );
  assert.equal(wrong.passed, false);
  assert.equal(wrong.actual, '120');
  await page
    .locator('dialog dd')
    .first()
    .evaluate((e) => (e.textContent = '200'));
  const [right] = await checkAssertionGroup(
    page,
    [{ target: power.locator, check: 'number', expected: 200 }],
    { timeout: 100 },
  );
  assert.equal(right.passed, true);
  await page
    .locator('dialog dt')
    .first()
    .evaluate((e) => (e.textContent = '其他字段'));
  assert.equal(await runtimeLocator(page, power.locator).count(), 0);
});

test('ambiguous, hidden duplicate, multi-definition and nested-object fields never pick first value', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const [body, code] of [
    ['<dl><dt>功率</dt><dd>200</dd><dt>功率</dt><dd>120</dd></dl>', 'DEFINITION_NOT_UNIQUE'],
    [
      '<dl><dt>功率</dt><dd>200</dd><div hidden><dt>功率</dt><dd>120</dd></div></dl>',
      'DEFINITION_NOT_UNIQUE',
    ],
    ['<dl><dt>功率</dt><dd>200</dd><dd>120</dd></dl>', 'DEFINITION_STRUCTURE_UNSUPPORTED'],
    ['<dl><dt>功率</dt><dd><button>200</button></dd></dl>', 'DEFINITION_STRUCTURE_UNSUPPORTED'],
    [
      '<article aria-label="子对象"><dl><dt>功率</dt><dd>200</dd></dl></article>',
      'WITHIN_TARGET_UNOWNED',
    ],
  ]) {
    await page.setContent('<dialog open aria-label="详情">' + body + '</dialog>');
    await assert.rejects(runtimeLocator(page, definition('功率')).count(), { code });
  }
});

test('unchanged manual lab exposes D009 native fields without adding ids or attributes', async (t) => {
  const lab = await startLab(0);
  t.after(() => lab.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(lab.url);
  await page.getByRole('button', { name: '进入演示', exact: true }).click();
  await page.getByRole('button', { name: '运营中心', exact: true }).click();
  await page.getByRole('link', { name: '资产设备', exact: true }).click();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'D009', exact: true }) })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  await page.getByRole('heading', { name: 'D009', exact: true }).waitFor();
  const observation = await snapshot(page);
  const fields = observation.controls.filter(
    (c) => c.field_context && c.scope_context?.name === '设备详情',
  );
  for (const label of ['名称', '园区', '状态', '额定功率'])
    assert.ok(
      fields.some((f) => f.field_context.label === label),
      label,
    );
  const power = fields.find((f) => f.field_context.label === '额定功率');
  assert.equal(power.locator.target.kind, 'definition');
  const [result] = await checkAssertionGroup(
    page,
    [{ target: power.locator, check: 'text', expected: '200 kW' }],
    { timeout: 100 },
  );
  assert.equal(result.passed, true);
});

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
