import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installDemonstrationBridge, validateDemonstrationEvent } from '../server/demonstration-browser.mjs';

const executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function fixture(markup) {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const events = [];
  await context.exposeBinding('__workbenchDemonstrationEvent', (_source, value) => events.push(value));
  await context.addInitScript(installDemonstrationBridge);
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><body>${markup}</body></html>`);
  await page.evaluate(installDemonstrationBridge);
  return { browser, page, events };
}

async function drag(page, x1, y1, x2, y2) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

test('box picks multiple DOM targets with reverse drag and pauses without modifying page', async () => {
  const { browser, page, events } = await fixture(`
    <style>body{margin:0}#wrap{position:absolute;left:120px;top:140px;display:flex;gap:12px}
      button{width:90px;height:40px}</style>
    <div id="wrap"><button id="a" onclick="window.clicked++">甲</button><button id="b" onclick="window.clicked++">乙</button></div>
    <script>window.clicked=0</script>`);
  try {
    await page.evaluate(() => window.__workbenchSetDemonstrationMode('RECORDING', true, 3, 'box'));
    await drag(page, 320, 200, 110, 120);
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, 'assertion_targets');
    assert.equal(events[0].step_index, 3);
    assert.deepEqual(events[0].targets.map(item => item.locator_hint.id), ['a', 'b']);
    assert.equal(await page.evaluate(() => window.__workbenchDemonstrationMode), 'PAUSED');
    assert.equal(await page.evaluate(() => window.clicked), 0);
    assert.equal(JSON.stringify(events).includes('clientX'), false);
  } finally { await browser.close(); }
});

test('box uses viewport coordinates after scroll and CSS zoom', async () => {
  const { browser, page, events } = await fixture(`
    <style>body{height:1800px;margin:0}#area{position:absolute;top:900px;left:90px;zoom:1.5}
      button{width:110px;height:45px}</style>
    <div id="area"><button id="scrolled">选中</button></div>`);
  try {
    await page.locator('#scrolled').scrollIntoViewIfNeeded();
    const rect = await page.locator('#scrolled').boundingBox();
    await page.evaluate(() => window.__workbenchSetDemonstrationMode('RECORDING', true, 1, 'box'));
    await drag(page, rect.x - 10, rect.y - 10, rect.x + rect.width + 10, rect.y + rect.height + 10);
    assert.equal(events[0].kind, 'assertion_targets');
    assert.equal(events[0].targets[0].locator_hint.id, 'scrolled');
  } finally { await browser.close(); }
});

test('box excludes controls covered by a business modal and keeps the top dialog control', async () => {
  const { browser, page, events } = await fixture(`
    <style>body{margin:0}button{position:absolute;left:130px;top:140px;width:120px;height:44px}
      .backdrop{position:fixed;inset:0;background:#0007;z-index:10}
      .dialog{position:fixed;left:110px;top:110px;width:180px;height:110px;background:white;z-index:11}
      .dialog button{left:20px;top:30px}</style>
    <button id="under">底层保存</button><div class="backdrop"></div>
    <div class="dialog" role="dialog"><button id="top">弹窗取消</button></div>`);
  try {
    await page.evaluate(() => window.__workbenchSetDemonstrationMode('RECORDING', true, 4, 'box'));
    await drag(page, 100, 100, 300, 230);
    assert.equal(events[0].kind, 'assertion_targets');
    assert.deepEqual(events[0].targets.map(item => item.locator_hint.id), ['top']);
  } finally { await browser.close(); }
});

test('Escape, empty rectangle, sensitive input, iframe, canvas and overflow cancel explicitly', async () => {
  const buttons = Array.from({ length: 21 }, (_, index) => `<button id="many${index}">项${index}</button>`).join('');
  const { browser, page, events } = await fixture(`
    <style>body{margin:0}#empty{height:70px}#secret{position:absolute;left:30px;top:100px;width:100px;height:30px}
    iframe{position:absolute;left:180px;top:100px;width:100px;height:50px}
    canvas{position:absolute;left:320px;top:100px;width:100px;height:50px}
    #many{position:absolute;left:30px;top:300px;display:grid;grid-template-columns:repeat(7,85px)}button{height:30px}</style>
    <div id="empty"></div><input id="secret" type="password" value="fixture-private-123">
    <iframe srcdoc="<button>inner</button>"></iframe><canvas width="100" height="50"></canvas>
    <div id="many">${buttons}</div>`);
  try {
    const select = async (index, rectangle) => {
      await page.evaluate(index => window.__workbenchSetDemonstrationMode('RECORDING', true, index, 'box'), index);
      await drag(page, ...rectangle);
      assert.equal(events.at(-1).kind, 'selection_cancelled');
      assert.equal(await page.evaluate(() => window.__workbenchDemonstrationMode), 'PAUSED');
      return events.at(-1).reason;
    };
    await page.evaluate(() => window.__workbenchSetDemonstrationMode('RECORDING', true, 0, 'box'));
    await page.keyboard.press('Escape');
    assert.equal(events.at(-1).reason, 'ESCAPE');
    assert.equal(await select(1, [700, 200, 760, 260]), 'NO_HIT');
    assert.equal(await select(2, [20, 90, 150, 145]), 'SENSITIVE_TARGET');
    assert.equal(await select(3, [170, 90, 290, 160]), 'CROSS_FRAME');
    assert.equal(await select(4, [310, 90, 430, 160]), 'UNLOCATABLE_DOM');
    assert.equal(await select(5, [20, 290, 640, 410]), 'OVERFLOW');
    assert.equal(JSON.stringify(events).includes('fixture-private-123'), false);
    assert.equal(events.some(item => item.kind === 'assertion_targets' && item.targets.length === 20), false);
  } finally { await browser.close(); }
});

test('Node validates every batch locator and replaces forged frame hints', () => {
  const frame = { url: () => 'http://127.0.0.1:3100/page' };
  const page = { frames: () => [frame], mainFrame: () => frame };
  const target = { origin: 'http://127.0.0.1:3100', path_prefix: '/' };
  const hint = { tag: 'button', id: 'a', css_path: 'body>button:nth-of-type(1)' };
  const payload = { kind: 'assertion_targets', step_index: 2,
    targets: [{ locator_hint: { ...hint, value: 'private' }, frame_hint: { path: '/forged' } }] };
  const result = validateDemonstrationEvent(payload, { page, frame }, page, target);
  assert.deepEqual(result.targets[0].frame_hint, { index: 0, path: '/page' });
  assert.equal(result.targets[0].locator_hint.value, undefined);
  assert.equal(validateDemonstrationEvent({ ...payload, targets: [{ locator_hint: hint }, { locator_hint: { tag: 'input', type: 'password', css_path: hint.css_path } }] },
    { page, frame }, page, target), null);
  assert.equal(validateDemonstrationEvent({ ...payload, targets: Array(21).fill({ locator_hint: hint }) },
    { page, frame }, page, target), null);
  assert.equal(validateDemonstrationEvent({ kind: 'selection_cancelled', step_index: 2, reason: 'NO_HIT' },
    { page, frame }, page, target).reason, 'NO_HIT');
  assert.equal(validateDemonstrationEvent({ kind: 'selection_cancelled', step_index: 2, reason: 'fake' },
    { page, frame }, page, target), null);
});
