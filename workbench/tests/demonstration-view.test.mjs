import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { buildAssertionReviews, canConfirmDemonstration, demonstrationLabel, eligibleDemonstration, eventSummary } from '../web-v2/demonstrations.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web-v2');

test('list projection labels use recorded step count, never the count of assertion reviews', () => {
  const brief = { demonstration_id: 'demo-private-identity', case_title: '筛选后翻页与详情',
    step_count: 5, status: 'CONFIRMED', created_at: '2026-09-30T04:00:00Z' };
  assert.match(demonstrationLabel(brief), /筛选后翻页与详情 · 5 步/);
  assert.match(demonstrationLabel(brief), /已确认/);
  assert.equal(demonstrationLabel(brief).includes(brief.demonstration_id), false);
  assert.match(demonstrationLabel({ ...brief, step_count: null, assertion_reviews: [{}, {}] }), /步骤未记录/);
  assert.match(demonstrationLabel({ ...brief, case_title: null, case_external_id: 'CASE-02' }), /^CASE-02/);
});

test('single-case demonstration selection requires confirmed matching version and environment', () => {
  const recording = { demonstration_id: 'demo-123', status: 'CONFIRMED', case_id: 'case-7',
    case_version: 2, environment_id: 'env-local' };
  assert.equal(eligibleDemonstration(recording, 'case-7', 2, 'env-local'), true);
  assert.equal(eligibleDemonstration(recording, 'case-7', 1, 'env-local'), false);
  assert.equal(eligibleDemonstration(recording, 'case-8', 2, 'env-local'), false);
  assert.equal(eligibleDemonstration(recording, 'case-7', 2, 'env-other'), false);
  assert.equal(eligibleDemonstration({ ...recording, status: 'STOPPED' }, 'case-7', 2, 'env-local'), false);
});

test('explicit reviews refer only to frozen expectations and optional locator event IDs', () => {
  const steps = [{ expected: '原预期一' }, { expected: '原预期二' }];
  const original = structuredClone(steps);
  assert.throws(() => buildAssertionReviews(steps, new Set([0]), new Map()), /NOT_REVIEWED/);
  assert.throws(() => buildAssertionReviews([{ expected: '' }], new Set([0]), new Map()), /NOT_REVIEWED/);
  assert.deepEqual(buildAssertionReviews(steps, new Set([0, 1]), new Map([[0, new Set(['event-3', 'event-4'])]])), [
    { step_index: 0, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: ['event-3', 'event-4'] },
    { step_index: 1, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: [] },
  ]);
  assert.deepEqual(buildAssertionReviews(steps.slice(0, 1), new Set([0]), new Map([[0, 'old-event']])), [
    { step_index: 0, confirmed: true, source: 'FROZEN_CASE', locator_event_ids: ['old-event'] },
  ], 'legacy single event selection is accepted');
  assert.throws(() => buildAssertionReviews(steps.slice(0, 1), new Set([0]), new Map([[0, new Set(Array.from({ length: 21 }, (_, i) => `e-${i}`))]])), /LOCATOR_LIMIT/);
  assert.deepEqual(steps, original, 'original expected text is not rewritten');
});

test('event summary uses only passive locator names, never input or actual values', () => {
  const event = { kind: 'fill', locator_hint: { visible_name: '模板名称', value: 'PRIVATE_INPUT' }, actual: 'PRIVATE_ACTUAL' };
  assert.equal(eventSummary(event), '输入（不记录输入值） · 模板名称');
  assert.equal(eventSummary(event).includes('PRIVATE'), false);
  assert.equal(eventSummary({ kind: 'assertion_target', locator_hint: { tag: 'td', css_path: 'table>tbody>tr:nth-of-type(1)>td:nth-of-type(3)' } }), '检查对象定位 · 表格第1行 · 第3列');
  assert.equal(eventSummary({ kind: 'assertion_target', locator_hint: { tag: 'span', id: 'dModel' } }), '检查对象定位 · #dModel');
});

test('stopped draft without an operation cannot enter confirmation', () => {
  const draft = { status: 'STOPPED', recording_sha256: 'frozen-hash', events: [] };
  assert.equal(canConfirmDemonstration(draft), false);
  assert.equal(canConfirmDemonstration({ ...draft, events: [{ event_id: 'event-1', kind: 'click' }] }), true);
  assert.equal(canConfirmDemonstration({ ...draft, status: 'RECORDING', events: [{ event_id: 'event-1' }] }), false);
  assert.equal(canConfirmDemonstration({ ...draft, events: [{ event_id: 'event-1' }], recording_sha256: null }), false);
});

test('loading a zero-event stopped draft keeps Confirm disabled after request cleanup', async () => {
  const id = 'demo-00000000-0000-4000-8000-000000000001';
  const base = '/api/case-library/projects/project-fixture/demonstrations';
  const steps = [{ order: 1, action: '输入名称', expected: '原预期保持' }];
  const recording = { demonstration_id: id, case_id: 'case-fixture', case_version: 1,
    environment_id: 'env-fixture', status: 'STOPPED', current_step_index: 0,
    recording_sha256: 'recording-hash', steps, events: [] };
  let confirmRequests = 0;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const json = value => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (pathname === '/api/case-library/projects/project-fixture/environment') return json({ revision: 1, ui_environment_id: 'env-fixture', backend_environment_id: null });
    if (pathname === '/api/script-environments') return json({ environments: [{ id: 'env-fixture', name: '本机目标', user_registered_target: true, ready: true, demonstration_ready: true }] });
    if (pathname === base) return json({ recordings: [recording] });
    if (pathname === `${base}/${id}`) return json(recording);
    if (pathname === `${base}/${id}/confirm`) { confirmRequests++; return json(recording); }
    if (pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><html><body><div id="modal-root"></div></body></html>'); return; }
    const script = { '/web-v2/demonstrations.js': 'demonstrations.js', '/web-v2/api.js': 'api.js', '/web-v2/workflow.js': 'workflow.js' }[pathname];
    if (script) { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await fs.readFile(path.join(webRoot, script))); return; }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
    const page = await browser.newPage();
    const openHistory = async () => {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(async ({ steps }) => {
        const { openDemonstrationDialog } = await import('/web-v2/demonstrations.js');
        await openDemonstrationDialog({ project: { project_id: 'project-fixture' },
          item: { case_id: 'case-fixture', current_version: 1, versions: [{ version: 1, content: { case_type: 'UI', status: 'CONFIRMED', steps } }] } });
      }, { steps });
      await page.locator('#demonstration-existing').selectOption(id);
      await page.getByRole('button', { name: '查看已有示范' }).click();
    };
    await openHistory();
    await page.getByText('未记录任何操作，请关闭后重新录制。').waitFor();
    assert.equal(await page.getByRole('button', { name: '确认示范' }).isDisabled(), true);
    recording.events = [{ event_id: 'event-1', step_index: 0, kind: 'click', locator_hint: { tag: 'button' } }];
    await openHistory();
    assert.equal(await page.getByRole('button', { name: '确认示范' }).isDisabled(), false);
    await page.getByRole('button', { name: '确认示范' }).click();
    await page.getByText('请逐步核对全部原预期；缺少原预期时先修改用例。').waitFor();
    assert.equal(confirmRequests, 0, 'unreviewed expected must not be submitted');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('login waits without recording, pick modes and multiple targets remain explicit', async () => {
  const base = '/api/case-library/projects/project-fixture/demonstrations';
  const id = 'demo-00000000-0000-4000-8000-000000000002';
  const steps = [{ action: '检查字段', expected: '原预期' }];
  const calls = [];
  let failPause = true;
  let recording = { demonstration_id: id, case_id: 'case-fixture', case_version: 1,
    environment_id: 'auth-env', status: 'WAITING_LOGIN', current_step_index: 0, steps, events: [] };
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const json = value => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (pathname === '/api/case-library/projects/project-fixture/environment') return json({ revision: 1, ui_environment_id: 'auth-env', backend_environment_id: null });
    if (pathname === '/api/script-environments') return json({ environments: [{ id: 'auth-env', name: '本机登录目标', user_registered_target: true, auth_required: true, auth_role: '测试员', ready: false, demonstration_ready: true }] });
    if (pathname === base && request.method === 'GET') return json({ recordings: [] });
    if (pathname === base && request.method === 'POST') return json(recording);
    if (pathname === `${base}/${id}`) return json(recording);
    if (pathname === `${base}/${id}/control`) {
      let body = ''; for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body); calls.push(payload);
      if (payload.action === 'login-check') recording = { ...recording, status: 'PAUSED' };
      if (payload.action === 'start') recording = { ...recording, status: 'RECORDING' };
      if (payload.action === 'pause') {
        if (failPause) { response.writeHead(409, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'PAUSE_FAILED' })); return; }
        recording = { ...recording, status: 'PAUSED', selection_mode: null };
      }
      if (payload.action === 'pick') recording = { ...recording, status: 'RECORDING', selection_mode: payload.pick_mode };
      if (payload.action === 'stop') recording = { ...recording, status: 'STOPPED', recording_sha256: 'hash',
        events: [{ event_id: 'event-a', kind: 'assertion_target', step_index: 0, locator_hint: { tag: 'td', css_path: 'table>tbody>tr:nth-of-type(1)>td:nth-of-type(3)' } }, { event_id: 'event-b', kind: 'assertion_target', step_index: 0, locator_hint: { id: 'dModel', tag: 'span' } }] };
      return json(recording);
    }
    if (pathname === `${base}/${id}/confirm`) { let body = ''; for await (const chunk of request) body += chunk; calls.push(JSON.parse(body)); return json({ ...recording, status: 'CONFIRMED' }); }
    if (pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><html><body><div id="modal-root"></div></body></html>'); return; }
    const script = { '/web-v2/demonstrations.js': 'demonstrations.js', '/web-v2/api.js': 'api.js', '/web-v2/workflow.js': 'workflow.js' }[pathname];
    if (script) { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await fs.readFile(path.join(webRoot, script))); return; }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async ({ steps }) => {
      const { openDemonstrationDialog } = await import('/web-v2/demonstrations.js');
      await openDemonstrationDialog({ project: { project_id: 'project-fixture' }, item: { case_id: 'case-fixture', current_version: 1, versions: [{ version: 1, content: { status: 'CONFIRMED', steps } }] } });
    }, { steps });
    await page.getByRole('button', { name: '打开专用浏览器' }).click();
    await page.getByText('等待人工登录（未录制）').waitFor();
    assert.equal(await page.getByRole('button', { name: '打开 Windows 悬浮控制条' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: '网页控制窗（备用）' }).count(), 1);
    await page.getByRole('button', { name: '打开 Windows 悬浮控制条' }).click();
    assert.equal(await page.getByRole('button', { name: '开始记录' }).count(), 0);
    await page.getByRole('button', { name: '打开登录浏览器' }).click();
    await page.getByRole('button', { name: '检查登录' }).click();
    await page.getByRole('button', { name: '开始记录' }).click();
    await page.getByRole('button', { name: '断言框选' }).click();
    await page.getByText('PAUSE_FAILED').waitFor();
    assert.equal(calls.some(call => call.action === 'pick'), false, 'failed pause must not start selection');
    failPause = false;
    await page.getByRole('button', { name: '断言框选' }).click();
    await page.getByText('检查对象标记：框选').waitFor();
    assert.equal(await page.locator('#demonstration-step').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '断言点选' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '暂停', exact: true }).isEnabled(), true);
    recording = { ...recording, status: 'PAUSED', selection_mode: null };
    await page.getByText('状态：已暂停', { exact: false }).first().waitFor();
    assert.equal(recording.status, 'PAUSED', 'selection completion does not auto-resume');
    await page.getByRole('button', { name: '停止并核对' }).click();
    await page.getByText('检查对象定位 · 表格第1行 · 第3列').first().waitFor();
    await page.getByText('检查对象定位 · #dModel').first().waitFor();
    await page.locator('[data-demo-target="0"]').nth(0).check();
    await page.locator('[data-demo-target="0"]').nth(1).check();
    await page.locator('[data-demo-target="0"]').nth(0).uncheck();
    await page.locator('[data-demo-review="0"]').check();
    await page.getByRole('button', { name: '确认示范' }).click();
    assert.deepEqual(calls.slice(0, 8).map(call => call.action), ['floating-open', 'login-open', 'login-check', 'start', 'pause', 'pause', 'pick', 'stop']);
    assert.equal(calls[6].pick_mode, 'box');
    assert.deepEqual(calls[8].assertion_reviews[0].locator_event_ids, ['event-b']);
    const rejected = await page.evaluate(async ({ steps }) => {
      const { openDemonstrationDialog } = await import('/web-v2/demonstrations.js');
      const errors = [];
      for (const case_type of ['BACKEND', null, 'UNKNOWN']) {
        await openDemonstrationDialog({ project: { project_id: 'project-fixture' },
          item: { case_id: 'case-fixture', current_version: 1, versions: [{ version: 1, content: { case_type, status: 'CONFIRMED', steps } }] },
          onError: error => errors.push(String(error.message)) });
      }
      return errors;
    }, { steps });
    assert.equal(rejected.length, 3);
    assert.ok(rejected.every(error => error.includes('只支持当前已确认的前端 UI 用例版本')));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});

test('fixture server closes if the browser executable cannot launch', async () => {
  const server = http.createServer((_request, response) => response.end('fixture'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    await assert.rejects(async () => {
      browser = await chromium.launch({ executablePath: path.join(webRoot, 'missing-fixture-browser.exe'), headless: true });
    });
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
  assert.equal(server.listening, false);
});

test('compact control window shows frozen step and pauses before explicit close', async () => {
  const id = 'demo-00000000-0000-4000-8000-000000000003';
  const base = `/api/case-library/projects/project-fixture/demonstrations/${id}`;
  let recording = { demonstration_id: id, status: 'RECORDING', current_step_index: 0,
    steps: [{ action: '点击保存', expected: '保存成功提示' }, { action: '查看结果', expected: '出现结果' }], selection_notice: 'SELECTION_RECORDED' };
  const calls = [];
  let failPause = true;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === base || pathname === `${base}/control`) {
      if (request.method === 'POST') {
        let body = ''; for await (const chunk of request) body += chunk;
        const payload = JSON.parse(body); const action = payload.action; calls.push(action);
        if (action === 'pause') {
          if (failPause) { response.writeHead(409, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'PAUSE_FAILED' })); return; }
          recording = { ...recording, status: 'PAUSED', selection_mode: null };
        }
        if (action === 'pick') recording = { ...recording, status: 'RECORDING', selection_mode: payload.pick_mode };
        if (action === 'step') recording = { ...recording, current_step_index: payload.step_index };
      }
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(recording)); return;
    }
    const file = { '/workspace/demonstration-control.html': 'demonstration-control.html', '/workspace/demonstration-control.js': 'demonstration-control.js', '/workspace/demonstration-control.css': 'demonstration-control.css' }[pathname];
    if (file) { response.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript' }); response.end(await fs.readFile(path.join(webRoot, file))); return; }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.DSH_PROBE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/workspace/demonstration-control.html?project_id=project-fixture&demonstration_id=${id}`);
    await page.locator('#step-action').filter({ hasText: '点击保存' }).waitFor();
    assert.equal(await page.locator('#step-expected').textContent(), '保存成功提示');
    assert.equal(await page.locator('#notice').textContent(), '检查对象已记录。');
    assert.equal(await page.locator('#next-step').textContent(), '下一步 2：查看结果');
    await page.getByRole('button', { name: '断言点选' }).click();
    await page.getByText('操作失败：PAUSE_FAILED').waitFor();
    assert.deepEqual(calls, ['pause'], 'popup failed pause must not call pick');
    failPause = false;
    await page.getByRole('button', { name: '断言点选' }).click();
    await page.getByText('单点标记中').waitFor();
    assert.equal(await page.locator('#step').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '下一步' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '断言框选' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '暂停', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.locator('#step-action').filter({ hasText: '查看结果' }).waitFor();
    await page.getByRole('button', { name: '暂停并关闭' }).click();
    await page.waitForTimeout(100);
    assert.deepEqual(calls, ['pause', 'pause', 'pick', 'pause', 'step']);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
