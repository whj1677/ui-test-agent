import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from '@playwright/test';
import { installActionHighlight } from '../server/build/action-highlight.mjs';

const executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const html = `<!doctype html><html><body style="margin:40px;background:white">
  <button id="button" style="width:140px;height:50px">Go</button>
  <input id="password" type="password" style="display:block;width:140px;height:50px;margin-top:30px">
  <select id="select" style="display:block;width:140px;height:50px;margin-top:30px"><option>A</option><option>B</option></select>
  <button id="hidden" style="display:none">Hidden</button>
  <script>button.onclick=()=>button.dataset.clicked='yes'</script>
</body></html>`;

async function pixel(page, x, y) {
  const bytes = await page.screenshot();
  return page.evaluate(async ({ image, x, y }) => {
    const bitmap = new Image();
    bitmap.src = `data:image/png;base64,${image}`;
    await bitmap.decode();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(x, y, 1, 1).data];
  }, { image: bytes.toString('base64'), x, y });
}

async function borderPixel(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, `${selector} visible`);
  return pixel(page, Math.round(box.x - 2), Math.round(box.y + box.height / 2));
}

function near(actual, expected) {
  assert(actual.slice(0, 3).every((channel, index) => Math.abs(channel - expected[index]) < 35),
    `expected RGB ${expected}, got ${actual}`);
}

test('events highlight real click, input, and select without altering actions or exposing values', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
    await context.addInitScript(installActionHighlight);
    const page = await context.newPage();
    await page.goto(`data:text/html,${encodeURIComponent(html)}`);
    await page.evaluate(installActionHighlight); // Existing page installation is idempotent.
    assert.equal(await page.locator('[data-workbench-action-highlight]').count(), 1);
    assert.equal(await page.locator('div').count(), 0);
    assert.equal(await page.locator('button').count(), 2);
    assert.equal(await page.locator('input').count(), 1);
    assert.equal(await page.getByText('点击').count(), 0);
    assert.equal(await page.getByText('输入').count(), 0);
    assert.equal(await page.getByText('选择').count(), 0);
    assert.equal(await page.evaluate(() => {
      const button = document.querySelector('#button');
      const r = button.getBoundingClientRect();
      return document.elementFromPoint(r.x + 10, r.y + 10) === button;
    }), true, 'overlay does not intercept pointer targeting');
    await page.evaluate(() => document.querySelector('#hidden').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.notDeepEqual((await borderPixel(page, '#button')).slice(0, 3), [233, 84, 32], 'hidden target has no action ring');

    await page.locator('#button').hover();
    assert.notDeepEqual((await borderPixel(page, '#button')).slice(0, 3), [233, 84, 32], 'hover is not orange action');
    await page.locator('#button').click();
    near(await borderPixel(page, '#button'), [233, 84, 32]);
    assert.equal(await page.locator('#button').getAttribute('data-clicked'), 'yes');

    const secret = 'fixture-secret-37';
    await page.locator('#password').fill(secret);
    near(await borderPixel(page, '#password'), [22, 138, 74]);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'password');
    assert.equal(await page.locator('#password').inputValue(), secret);
    assert.equal(await page.evaluate(() => document.querySelector('[data-workbench-action-highlight]').outerHTML.includes('fixture-secret-37')), false);
    await page.locator('#password').press('End');
    assert.equal(await page.locator('#password').inputValue(), secret);

    await page.locator('#select').selectOption('B');
    near(await borderPixel(page, '#select'), [105, 65, 198]);
    assert.equal(await page.locator('#select').inputValue(), 'B');
    assert.equal(await page.locator('#hidden').isVisible(), false);
    assert.equal(await page.locator('[data-workbench-action-highlight]').count(), 1);

    await page.goto('data:text/html,<html><body><button id="next">Next</button></body></html>');
    await page.evaluate(installActionHighlight);
    assert.equal(await page.locator('[data-workbench-action-highlight]').count(), 1, 'document replacement does not accumulate hosts');
    await page.locator('#next').click();
    near(await borderPixel(page, '#next'), [233, 84, 32]);
    await context.close();
  } finally { await browser.close(); }
});

test('init script covers navigation and same-origin iframe without network or page errors', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(installActionHighlight);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) errors.push('unexpected network'); });
    await page.goto('data:text/html,<html><body><button id="nav">Nav</button><iframe srcdoc="<button id=frame>Frame</button>"></iframe></body></html>');
    assert.equal(await page.locator('[data-workbench-action-highlight]').count(), 1);
    const frame = page.frameLocator('iframe');
    assert.equal(await frame.locator('[data-workbench-action-highlight]').count(), 1);
    await frame.locator('#frame').click();
    await page.goto('data:text/html,<html><body><button id="again">Again</button></body></html>');
    assert.equal(await page.locator('[data-workbench-action-highlight]').count(), 1);
    await page.locator('#again').click();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('click ring follows DOM reflow and disappears when its target is removed', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
    await context.addInitScript(installActionHighlight);
    const page = await context.newPage();
    await page.goto('data:text/html,<body style="margin:40px"><div id="rows" style="height:200px"></div><button id="next" style="height:40px;width:120px">Next</button>');
    await page.locator('#next').click();
    const old = await page.locator('#next').boundingBox();
    await page.evaluate(() => document.querySelector('#rows').style.height = '80px');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    near(await borderPixel(page, '#next'), [233, 84, 32]);
    assert.notDeepEqual((await pixel(page, Math.round(old.x - 2), Math.round(old.y + old.height / 2))).slice(0, 3), [233,84,32]);
    const moved = await page.locator('#next').boundingBox();
    await page.locator('#next').evaluate(node => node.remove());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.notDeepEqual((await pixel(page, Math.round(moved.x - 2), Math.round(moved.y + moved.height / 2))).slice(0, 3), [233,84,32]);
  } finally { await browser.close(); }
});
