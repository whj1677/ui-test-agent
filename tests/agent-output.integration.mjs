import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';

// Exercise the real console DOM/polling against controlled responses from the
// existing endpoints. No provider call or business browser action is needed.
const directory = path.resolve('validation', 'agent-output-' + Date.now());
await fs.mkdir(directory, { recursive: true });
const app = await start({
  port: 0,
  dataDir: path.join(directory, 'data'),
  headless: true,
  provider: new DeepSeek({ key: '' }),
});
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const now = () => new Date().toISOString();
const caseA = {
  case_id: 'SYNTHETIC-001',
  status: 'NEEDS_MAPPING',
  reviewed: true,
  issues: [],
  original: { title: '日间方案详情核对' },
  attempts: [],
  repair_count: 0,
};
const caseB = {
  ...structuredClone(caseA),
  case_id: 'SYNTHETIC-002',
  original: { title: '夜间方案列表核对' },
};
const first = {
  id: 'output-first',
  name: '电价目录 · 界面合成验证',
  target: 'http://127.0.0.1:4188/',
  status: 'ANALYZING',
  revision: 1,
  cases: [caseA, caseB],
  events: [],
  snapshots: [],
  site_cleanup_blockers: [],
  authenticated: true,
  active: { kind: 'prepare', calls: 1, current_case: caseA.case_id, stage: 'MODEL' },
};
const second = {
  ...structuredClone(first),
  id: 'output-second',
  name: '另一轮 · 隔离输出',
  active: null,
  status: 'IDLE',
  events: [{ at: now(), type: 'IMPORTED' }],
};
let records = [];
let stateOffline = false;
let logsOffline = false;
let delayedLog;
let delayLogs = false;
const addEvent = (type, detail = {}) => {
  first.events.push({ type, at: now(), ...detail });
  first.revision++;
};
const json = (route, body) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
async function waitForText(selector, text) {
  await page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent.includes(text),
    { selector, text },
    { timeout: 16000 },
  );
}
async function sync() {
  await page.locator('#output-refresh').click();
}

try {
  await page.route('**/api/tasks', (route) =>
    json(
      route,
      [first, second].map((s) => ({ id: s.id, name: s.name, total: 2, status: s.status })),
    ),
  );
  await page.route('**/api/tasks/*', (route) =>
    stateOffline
      ? route.abort('failed')
      : json(route, route.request().url().endsWith(first.id) ? first : second),
  );
  await page.route('**/api/tasks/*/diagnostics', async (route) => {
    const taskId = route.request().url().includes(first.id) ? first.id : second.id;
    if (logsOffline)
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    if (delayLogs && taskId === first.id)
      await new Promise((resolve) => {
        delayedLog = resolve;
      });
    await json(route, { task_id: taskId, records: taskId === first.id ? records : [] });
  });
  addEvent('JOB_STARTED', { kind: 'prepare', count: 2 });
  addEvent('CASE_STARTED', { case_id: caseA.case_id });
  await page.goto(app.url + '/#task=' + first.id);
  await waitForText('#output-state', '正在等待模型回复');
  const panelBox = await page.locator('#agent-output').boundingBox();
  assert.ok(
    panelBox.y < 260 && panelBox.y + panelBox.height < 1000,
    'output is first-screen visible',
  );
  await page.screenshot({ path: path.join(directory, '01-running-desktop.png'), fullPage: true });

  // No new persisted event/revision: in-memory stage and call count must update.
  first.active.stage = 'WAITING_USER_LOGIN';
  await waitForText('#output-state', '等待你在浏览器登录');
  first.active.stage = 'MODEL';
  first.active.calls = 2;
  await waitForText('#output-calls', '2 / 100');
  for (const event of first.events) event.at = new Date(Date.now() - 45000).toISOString();
  first.revision++;
  await waitForText('#output-silence', '服务状态仍在同步');
  assert.equal(await page.locator('#output-silence').isVisible(), true);

  addEvent('PLAN_REPAIR_STARTED', { case_id: caseA.case_id, round: 1, code: 'INVALID_LOCATOR' });
  first.active.stage = 'PLAN_REPAIR_STARTED';
  await waitForText('#output-state', '开始有限计划自修复');
  const markup = '<img src=x onerror="window.outputInjected=true">';
  records = [
    {
      id: 'reply-one',
      at: now(),
      request_id: 'model-1',
      type: 'MODEL_RESPONSE_PARSED',
      phase: 'plan',
      case_id: caseA.case_id,
      parsed_value: {
        reason: '已找到工业日间方案，正在核验详情入口。',
        notes: markup,
        api_key: 'synthetic-local-secret',
      },
    },
    {
      id: 'retry-one',
      at: now(),
      request_id: 'model-2',
      type: 'MODEL_TRANSPORT_FINISHED',
      phase: 'plan',
      will_retry: true,
      error_code: 'DEEPSEEK_RATE_LIMIT',
    },
  ];
  await sync();
  await waitForText('#output-list', '已找到工业日间方案');
  assert.equal(await page.locator('#output-list img').count(), 0);
  assert.equal(await page.evaluate(() => window.outputInjected), undefined);
  assert.ok(!(await page.locator('#output-list').textContent()).includes('synthetic-local-secret'));
  await page.getByRole('button', { name: '异常与重试', exact: true }).click();
  await waitForText('#output-list', '模型请求重试');
  assert.ok(!(await page.locator('#output-list').textContent()).includes('已找到工业日间方案'));
  await page.getByRole('button', { name: '全部输出', exact: true }).click();
  if ((await page.locator('#output-follow').getAttribute('aria-pressed')) !== 'true')
    await page.locator('#output-follow').click();
  await page.locator('#output-list details summary').click();
  await page.waitForFunction(
    () => document.querySelector('#output-follow').getAttribute('aria-pressed') === 'false',
  );
  await page.locator('#output-records').evaluate((node) => {
    node.scrollTop = 0;
  });
  const beforeScroll = await page.locator('#output-records').evaluate((node) => node.scrollTop);
  addEvent('DISCOVERY_PAGE_CAPTURED', {
    case_id: caseA.case_id,
    message: '用于验证阅读位置保留的新输出',
  });
  await waitForText('#output-list', '用于验证阅读位置保留');
  assert.equal(await page.locator('#output-list details').getAttribute('open'), '');
  assert.ok(
    Math.abs(
      (await page.locator('#output-records').evaluate((node) => node.scrollTop)) - beforeScroll,
    ) < 2,
  );
  assert.equal(await page.locator('#output-follow').getAttribute('aria-pressed'), 'false');

  // A full refresh with unchanged rows must still follow the latest output.
  await page.locator('#output-follow').click();
  await sync();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#output-follow').getAttribute('aria-pressed'), 'true');
  assert.ok(
    await page
      .locator('#output-records')
      .evaluate(
        (node) =>
          node.scrollHeight > node.clientHeight &&
          node.scrollHeight - node.clientHeight - node.scrollTop < 2,
      ),
    'live-follow survives a full render without new rows',
  );

  // A failed final batch is never presented as merely idle or still running.
  addEvent('JOB_FAILED', { code: 'DEEPSEEK_CONNECTION_FAILED' });
  first.active = null;
  first.status = 'NEEDS_ATTENTION';
  await waitForText('#output-state', '运行已结束，需要处理');
  assert.equal(await page.locator('#output-problem').isVisible(), true);
  assert.equal(await page.locator('#stop').isVisible(), false);
  await page.screenshot({ path: path.join(directory, '02-failure-desktop.png'), fullPage: true });
  stateOffline = true;
  await waitForText('#output-state', '连接中断');
  assert.ok((await page.locator('#output-list').textContent()).includes('用于验证阅读位置保留'));
  stateOffline = false;
  await waitForText('#output-state', '运行已结束，需要处理');
  logsOffline = true;
  await sync();
  await waitForText('#output-log-status', '模型输出暂未同步');
  assert.ok((await page.locator('#output-state').textContent()).includes('运行已结束'));
  logsOffline = false;

  // Late logs from the previous task may not leak into the selected task.
  delayLogs = true;
  await sync();
  await page.waitForTimeout(150);
  await page.locator(`[data-task="${second.id}"]`).click();
  await waitForText('#workspace h1', second.name);
  delayedLog?.();
  await page.waitForTimeout(300);
  assert.ok(!(await page.locator('#output-list').textContent()).includes('工业日间方案'));
  assert.equal(await page.locator('#output-problem').isVisible(), false);
  delayLogs = false;
  first.status = 'STOPPED';
  await page.locator(`[data-task="${first.id}"]`).click();
  await waitForText('#output-state', '当前批次已停止');
  first.status = 'IDLE';
  first.events = [];
  first.revision++;
  caseA.status = 'BLOCKED_MAPPING';
  addEvent('JOB_STARTED', { kind: 'prepare', count: 1 });
  addEvent('CASE_STARTED', { case_id: caseA.case_id });
  addEvent('CASE_PREPARATION_FAILED', { case_id: caseA.case_id, code: 'INVALID_LOCATOR' });
  addEvent('JOB_FINISHED', { kind: 'prepare' });
  await waitForText('#output-state', '有用例需要处理');

  for (const [label, width, height] of [
    ['mobile', 390, 844],
    ['tablet', 820, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `${label} no page overflow`,
    );
    await page.locator('#agent-output').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(directory, `03-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  first.active = { kind: 'prepare', calls: 3, current_case: caseA.case_id, stage: 'MODEL' };
  first.status = 'ANALYZING';
  first.events = [];
  first.revision++;
  addEvent('JOB_STARTED', { kind: 'prepare', count: 1 });
  await waitForText('#output-state', '正在等待模型回复');
  assert.equal(
    await page.locator('.output-dot').evaluate((node) => getComputedStyle(node).animationName),
    'none',
  );
  await page.locator('#output-follow').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  assert.notEqual(
    await page.locator('#output-follow').evaluate((node) => getComputedStyle(node).outlineStyle),
    'none',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(directory, 'summary.json'),
    JSON.stringify(
      {
        scope: 'Real console, synthetic endpoint state transitions; no model or business execution',
        checks: [
          'first-screen output',
          'stage changes without revision',
          'login wait',
          'long silence',
          'automatic repair',
          'expandable replies',
          'safe text and credential redaction',
          'issue filtering',
          'reading position and live-follow after full render',
          'failed and blocked completion',
          'disconnect/reconnect',
          'log failure independent of state',
          'late task isolation',
          'stopped state',
          'mobile/tablet layout',
          'reduced motion and keyboard focus',
        ],
        page_errors: errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ validated: true, directory }));
} finally {
  delayedLog?.();
  await browser.close();
  await app.close();
}
