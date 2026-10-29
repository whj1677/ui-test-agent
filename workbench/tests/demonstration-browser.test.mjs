import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { installDemonstrationBridge, openDemonstrationBrowser, validateDemonstrationEvent } from '../server/demonstration-browser.mjs';

const executablePath = process.env.DSH_PROBE_BROWSER_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
async function until(predicate, description) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(predicate(), true, description);
}

test('trusted manual actions yield bounded hints; password and page scripts cannot emit through the listener', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext();
    const received = [];
    await context.exposeBinding('__workbenchDemonstrationEvent', (_source, value) => received.push(value));
    await context.addInitScript(installDemonstrationBridge);
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><body>
      <button>查询</button><input id="password" type="password">
      <input id="search" autocomplete="off" placeholder="关键词"><button id="pick">编辑</button>
      <script>window.clicked=0;document.querySelector('#pick').onclick=()=>window.clicked++</script>
      </body></html>`);
    await page.evaluate(installDemonstrationBridge);
    await page.evaluate(() => window.__workbenchSetDemonstrationMode('RECORDING', false, 0));
    await page.getByRole('button', { name: '查询' }).click();
    await page.locator('#password').fill('fixture-private-123');
    await page.locator('#search').fill('synthetic');
    await until(() => received.some(item => item.kind === 'fill' && item.locator_hint?.id === 'search'), 'search fill observed');
    assert.equal(received.some(item => item.locator_hint?.id === 'password'), false);
    assert.equal(JSON.stringify(received).includes('fixture-private-123'), false);
    assert.equal(received.some(item => item.locator_hint?.visible_name === '查询'), true);
    assert.equal(received.some(item => item.locator_hint?.css_path?.includes('nth-of-type')), true);
    assert.equal(received.some(item => item.kind === 'fill' && item.locator_hint?.id === 'search'), true, JSON.stringify(received));
    await page.evaluate(() => window.__workbenchSetDemonstrationMode('RECORDING', true, 1));
    await page.locator('#pick').click();
    assert.equal(await page.evaluate(() => window.clicked), 0, 'pick prevents tested-page click');
    assert.equal(received.at(-1).kind, 'assertion_target');
    assert.equal(received.at(-1).step_index, 1);
    await page.evaluate(() => document.querySelector('#pick').click());
    assert.equal(received.filter(item => item.kind === 'click' && item.locator_hint?.id === 'pick').length, 0,
      'synthetic DOM click is not recorded');
  } finally { await browser.close(); }
});

test('Node rejects unexpected keys, secrets, foreign frame and out-of-scope URL', () => {
  const frame = { url: () => 'http://127.0.0.1:3100/page' };
  const page = { frames: () => [frame] };
  const target = { origin: 'http://127.0.0.1:3100', path_prefix: '/' };
  const payload = { kind: 'click', step_index: 0, locator_hint: { tag: 'button',
    visible_name: '查询', secret: 'raw-value', css_path: 'body>button:nth-of-type(1)' } };
  const accepted = validateDemonstrationEvent(payload, { page, frame }, page, target);
  assert.equal(accepted.locator_hint.secret, undefined);
  assert.equal(accepted.locator_hint.visible_name, '查询');
  assert.equal(validateDemonstrationEvent(payload, { page: {}, frame }, page, target), null);
  assert.equal(validateDemonstrationEvent(payload, { page, frame: { url: () => 'http://evil.example/' } }, page, target), null);
  assert.equal(validateDemonstrationEvent({ ...payload, locator_hint: { tag: 'input', type: 'password' } },
    { page, frame }, page, target), null);
});

test('guarded fixture keeps manual recording mode across navigation; pause and pick remain bounded', async () => {
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(request.url === '/next'
      ? '<!doctype html><button id="after">编辑</button><button id="pick">取消</button><script>window.clicks=0;document.querySelector("#pick").onclick=()=>window.clicks++</script>'
      : '<!doctype html><button id="before" onclick="location.href=\'/next\'">查询</button><input id="search" autocomplete="off" placeholder="关键词">');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const target = { origin, path_prefix: '/', entry_url: `${origin}/` };
  const events = [];
  const interruptions = [];
  let session;
  try {
    session = await openDemonstrationBrowser(target, executablePath, event => events.push(event),
      (code, detail) => interruptions.push({ code, detail }), { headless: true });
    await session.setMode('RECORDING', false, 0);
    await session.page.locator('#search').fill('fixture-search');
    await session.page.locator('#before').click();
    await session.page.waitForURL(`${origin}/next`);
    await session.page.waitForFunction(() => window.__workbenchDemonstrationMode === 'RECORDING');
    await session.page.locator('#after').click();
    await until(() => events.some(event => event.kind === 'click' && event.locator_hint.visible_name === '编辑'), 'click after navigation observed');
    assert.equal(events.some(event => event.kind === 'click' && event.locator_hint.visible_name === '编辑'), true);
    assert.equal(events.some(event => event.kind === 'navigation' && event.locator_hint.path === '/next'), true);
    assert.equal(JSON.stringify(events).includes('fixture-search'), false);
    const beforePause = events.length;
    await session.setMode('PAUSED', false, 0);
    await session.page.locator('#after').click();
    assert.equal(events.length, beforePause);
    await session.setMode('RECORDING', true, 0);
    await session.page.locator('#pick').click();
    await until(() => events.at(-1)?.kind === 'assertion_target', 'pick observed');
    assert.equal(await session.page.evaluate(() => window.clicks), 0);
    assert.equal(events.at(-1).kind, 'assertion_target');
    assert.equal(await session.page.evaluate(() => window.__workbenchDemonstrationMode), 'PAUSED');
    const afterPick = events.length;
    await session.page.locator('#after').click();
    assert.equal(events.length, afterPick, 'Node and browser both pause after picking');
    assert.deepEqual(interruptions, [], JSON.stringify(session.violation()));
  } finally {
    await session?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('initial out-of-scope subresource rejects visible recording before it becomes active', async () => {
  const server = http.createServer((_request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end('<!doctype html><img src="/outside/blocked.png">');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let live;
  const interrupted = [];
  try {
    try {
      live = await openDemonstrationBrowser({ origin, path_prefix: '/app', entry_url: `${origin}/app` },
        executablePath, () => {}, code => interrupted.push(code), { headless: true });
    } catch (error) { assert.match(error.message, /TARGET_SCOPE_REQUEST_BLOCKED/); }
    if (live) await until(() => interrupted.includes('TARGET_SCOPE_REQUEST_BLOCKED'), 'late violation delivered');
  } finally { await live?.close(); await new Promise(resolve => server.close(resolve)); }
});
