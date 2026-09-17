import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startFixture } from './server.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const started = new Date();
const runDir = join(root, 'evidence', started.toISOString().replaceAll(':', '-').replaceAll('.', '-'));
await mkdir(runDir, { recursive: true });
const result = {
  schema_version: 'fixture-smoke/v1', scope: 'LOCAL_SYNTHETIC_FIXTURE_SOFTWARE_SELF_TEST',
  agent_acceptance: 'NOT_EXECUTED', started_at: started.toISOString(),
  command: 'node work/claude-supervision/20260916-autonomy/fixture/smoke.mjs',
  status: 'RUNNING', checks: [], screenshots: [], inputs: {}, fixture_instances: [], cleanup: {},
};
const fixtures = [], contexts = [], pageErrors = [], externalRequests = [];
let browser;

function safeError(error) {
  return String(error?.stack || error).replaceAll('demo-only', '[synthetic-password]')
    .replace(/fixture_session=[^;\s"']+/g, 'fixture_session=[redacted]')
    .replace(/\b[a-f0-9]{64}\b/g, '[redacted-value]');
}
async function check(name, action) {
  const time = Date.now();
  try {
    const observed = await action();
    result.checks.push({ name, status: 'PASSED', duration_ms: Date.now() - time, ...(observed === undefined ? {} : { observed }) });
  } catch (error) {
    result.checks.push({ name, status: 'FAILED', duration_ms: Date.now() - time, error: safeError(error) });
    throw error;
  }
}
async function screenshot(page, name) {
  const path = join(runDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  result.screenshots.push({ name, path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
async function instance(options) {
  const fixture = await startFixture({ port: 0, ...options });
  fixtures.push(fixture);
  assert.equal(fixture.server.address().address, '127.0.0.1');
  result.fixture_instances.push({ url: fixture.url, mode: options.mode, auto_login_delay_ms: options.autoLoginDelayMs || 0 });
  return fixture;
}
async function openContext(fixture) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: 'zh-CN' });
  contexts.push(context);
  const requests = [];
  await context.route('**/*', route => {
    const request = route.request(), target = new URL(request.url());
    if (target.origin !== fixture.url) {
      externalRequests.push({ origin: target.origin, path: target.pathname });
      return route.abort();
    }
    // No headers, cookies, bodies or credentials are recorded.
    requests.push({ method: request.method(), path: target.pathname });
    return route.continue();
  });
  context.on('page', page => page.on('pageerror', error => pageErrors.push(safeError(error))));
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  return { context, page, requests };
}
async function visible(locator) { await locator.waitFor({ state: 'visible' }); }
async function manualLogin(page, fixture) {
  await page.goto(`${fixture.url}/login`);
  await page.getByLabel('用户名', { exact: true }).fill('tester');
  await page.getByLabel('密码', { exact: true }).fill('demo-only');
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/login' && response.request().method() === 'POST'),
    page.getByRole('button', { name: '登录', exact: true }).click(),
  ]);
  assert.equal(response.status(), 303);
  await page.waitForURL(`${fixture.url}/dashboard`);
  await visible(page.getByRole('heading', { name: '工作台', exact: true }));
}
async function assertHome(page, fixture) {
  await visible(page.getByRole('heading', { name: '工作台', exact: true }));
  assert.equal(page.url(), `${fixture.url}/dashboard`);
  for (const name of ['资产运营', '报表中心']) assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByRole('link', { name: '计费中心', exact: true }).isVisible(), false);
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('table').count(), 0);
  await visible(page.getByRole('link', { name: '工作台', exact: true }));
  await visible(page.getByRole('button', { name: '退出登录', exact: true }));
}
async function enterBilling(page, fixture) {
  const menu = page.getByRole('button', { name: '资产运营', exact: true });
  if (await menu.getAttribute('aria-expanded') === 'false') await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.getByRole('link', { name: '计费中心', exact: true }).click();
  await page.waitForURL(`${fixture.url}/billing`);
  // A native modal makes background roles inert, but the visible heading remains.
  await visible(page.locator('h1'));
  assert.equal(await page.locator('h1').innerText(), '费率目录');
}
async function assertTable(page) {
  const table = page.getByRole('table', { name: '费率目录', exact: true });
  await visible(table);
  assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['方案名称', '时段', '单价', '状态', '操作']);
  const rows = table.locator('tbody tr');
  assert.equal(await rows.count(), 2);
  const observed = [];
  for (let i = 0; i < 2; i++) observed.push(await rows.nth(i).getByRole('cell').allTextContents());
  assert.deepEqual(observed, [
    ['工业日间方案', '08:00—22:00', '0.68元/度', '启用', '查看详情'],
    ['工业夜间方案', '22:00—08:00', '0.23元/度', '启用', '查看详情'],
  ]);
  assert.doesNotMatch(await page.locator('body').innerText(), /0\.32|故意|业务缺陷/);
  return { columns: 5, rows: 2, night_price_observed: observed[1][2] };
}
async function detail(page, name, period, price, shot) {
  const row = page.getByRole('table', { name: '费率目录', exact: true }).getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: '查看详情', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '方案详情', exact: true });
  await visible(dialog);
  assert.deepEqual(await dialog.locator('dt').allTextContents(), ['方案名称', '时段', '单价']);
  assert.deepEqual(await dialog.locator('dd').allTextContents(), [name, period, price]);
  assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
  if (shot) await screenshot(page, shot);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await visible(page.getByRole('heading', { name: '费率目录', exact: true }));
  assert.equal(await page.getByRole('dialog').count(), 0);
  return { name, period, price, closed_to_directory: true };
}

try {
  for (const file of ['server.mjs', 'smoke.mjs', 'cases.json', 'README.md']) result.inputs[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
  result.inputs['../task.md'] = createHash('sha256').update(await readFile(join(root, '..', 'task.md'))).digest('hex');
  await check('import_is_inert_and_windows_file_url_works', async () => {
    const url = pathToFileURL(join(root, 'server.mjs')).href;
    const code = `const m = await import(${JSON.stringify(url)}); if(typeof m.startFixture !== 'function') process.exit(2); console.log('IMPORT_ONLY_EXIT');`;
    const child = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { cwd: root, timeout: 5000, windowsHide: true });
    assert.equal(child.stdout.trim(), 'IMPORT_ONLY_EXIT');
    assert.equal(child.stderr, '');
    return { exited_without_server: true, file_url_import: true };
  });
  await check('three_frozen_human_cases_and_independent_night_oracle', async () => {
    const raw = await readFile(join(root, 'cases.json'), 'utf8'), baseline = JSON.parse(raw);
    assert.equal(baseline.schema_version, 'case-import/v1');
    assert.equal(baseline.case_count, 3);
    assert.equal(baseline.cases.length, 3);
    assert.deepEqual(baseline.cases.map(item => item.case_id), ['LOCAL-001', 'LOCAL-002', 'LOCAL-003']);
    assert.doesNotMatch(raw, /https?:\/\/|data-testid|testid|xpath|selector|locator|故意|缺陷|0\.23|"plan"/i);
    for (const item of baseline.cases) {
      assert.deepEqual(Object.keys(item).sort(), ['case_id', 'title', 'source_side', 'preconditions', 'steps'].sort());
      assert.equal(item.source_side, 'ui');
      assert.ok(item.title && item.preconditions.length && item.steps.length);
      assert.match(item.preconditions.join(''), /已登录.*工作台/);
      assert.equal(new Set(item.steps.map(step => step.step_id)).size, item.steps.length);
      for (const step of item.steps) {
        assert.deepEqual(Object.keys(step).sort(), ['step_id', 'action', 'expected'].sort());
        assert.ok(step.step_id && step.action && step.expected);
      }
    }
    const [directory, day, night] = baseline.cases;
    assert.doesNotMatch(JSON.stringify(directory), /0\.\d+/);
    for (const text of ['方案名称', '时段', '单价', '状态', '操作', '工业日间方案', '工业夜间方案']) assert.ok(directory.steps.some(step => step.expected.includes(text)));
    for (const text of ['方案名称为工业日间方案', '时段为08:00—22:00', '单价为0.68元/度']) assert.ok(day.steps.some(step => step.expected.includes(text)));
    assert.ok(day.steps.some(step => step.action.includes('若出现使用提示') && step.action.includes('知道了')));
    assert.ok(day.steps.some(step => step.action.includes('关闭') && step.expected.includes('返回费率目录')));
    assert.match(night.steps.at(-1).expected, /工业夜间方案单价为0\.32元\/度/);
    result.frozen_discrepancy = { case_id: 'LOCAL-003', expected: '0.32元/度', actual: null, business_comparison: 'NOT_YET_OBSERVED', agent_case_execution: 'NOT_EXECUTED' };
    return { count: 3, locator_free_human_steps: true, expected_night_price: '0.32元/度' };
  });

  browser = await chromium.launch({ headless: true });
  result.browser = { engine: 'Chromium', version: browser.version(), headless: true };
  const normal = await instance({ mode: 'normal' });
  const { page, context, requests } = await openContext(normal);
  await check('normal_health_and_unauthenticated_business_protection', async () => {
    const health = await context.request.get(`${normal.url}/health`);
    assert.equal(health.status(), 200);
    assert.deepEqual(await health.json(), { mode: 'normal', ready: true });
    for (const path of ['/dashboard', '/billing', '/reports']) {
      const response = await context.request.get(normal.url + path, { maxRedirects: 0 });
      assert.equal(response.status(), 303);
      assert.equal(response.headers().location, '/login');
      assert.doesNotMatch(await response.text(), /工业日间方案|工业夜间方案/);
    }
    await page.goto(`${normal.url}/billing`);
    await visible(page.getByRole('heading', { name: '登录工作台', exact: true }));
    assert.equal(page.url(), `${normal.url}/login`);
    assert.equal(await page.getByRole('table').count(), 0);
  });
  await check('incorrect_login_is_rejected_by_real_post', async () => {
    await page.getByLabel('用户名', { exact: true }).fill('incorrect-user');
    await page.getByLabel('密码', { exact: true }).fill('incorrect-local-value');
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/login' && response.request().method() === 'POST'),
      page.getByRole('button', { name: '登录', exact: true }).click(),
    ]);
    assert.equal(response.status(), 401);
    await visible(page.getByRole('alert'));
    assert.equal(await page.getByRole('alert').innerText(), '用户名或密码错误');
    assert.equal((await context.cookies()).length, 0);
  });
  await check('manual_login_lands_on_home_with_protected_random_session', async () => {
    await manualLogin(page, normal);
    await assertHome(page, normal);
    const cookie = (await context.cookies()).find(cookie => cookie.name === 'fixture_session');
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Strict');
    assert.equal(cookie.path, '/');
    assert.ok(/^[a-f0-9]{64}$/.test(cookie.value));
    assert.equal(await page.evaluate(() => document.cookie), '');
    assert.deepEqual(await (await context.request.get(`${normal.url}/health`)).json(), { mode: 'normal', ready: true });
    assert.equal(requests.some(request => request.path === '/billing' && request.method === 'POST'), false);
    await screenshot(page, 'normal-dashboard');
    return { cookie_http_only: true, same_site: 'Strict', cookie_value_persisted: false, landing_page: '工作台' };
  });
  await check('two_modules_and_expand_collapse_navigation', async () => {
    const asset = page.getByRole('button', { name: '资产运营', exact: true });
    await asset.click();
    await visible(page.getByRole('link', { name: '计费中心', exact: true }));
    await asset.click();
    assert.equal(await asset.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByRole('link', { name: '计费中心', exact: true }).isVisible(), false);
    await page.getByRole('button', { name: '报表中心', exact: true }).click();
    await page.getByRole('link', { name: '用量报表', exact: true }).click();
    await visible(page.getByRole('heading', { name: '用量报表', exact: true }));
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('table').count(), 0);
    await page.getByRole('link', { name: '工作台', exact: true }).click();
    await assertHome(page, normal);
    await enterBilling(page, normal);
  });
  await check('normal_directory_has_five_columns_two_rows_and_no_notice', async () => {
    assert.equal(await page.getByRole('dialog').count(), 0);
    const observed = await assertTable(page);
    result.frozen_discrepancy.actual = observed.night_price_observed;
    result.frozen_discrepancy.business_comparison = 'MISMATCH_CONFIRMED_BY_FIXTURE_SELF_TEST';
    assert.notEqual(result.frozen_discrepancy.actual, result.frozen_discrepancy.expected);
    await screenshot(page, 'normal-directory');
    return observed;
  });
  await check('normal_day_detail_all_fields_and_close', () => detail(page, '工业日间方案', '08:00—22:00', '0.68元/度', 'normal-day-detail'));
  await check('normal_night_detail_matches_selected_row_and_close', () => detail(page, '工业夜间方案', '22:00—08:00', '0.23元/度', 'normal-night-detail'));
  await check('logout_invalidates_server_session_and_clears_cookie', async () => {
    const oldCookie = (await context.cookies()).find(cookie => cookie.name === 'fixture_session');
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await page.waitForURL(`${normal.url}/login`);
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'fixture_session'), false);
    const stale = await context.request.get(`${normal.url}/billing`, { headers: { cookie: `${oldCookie.name}=${oldCookie.value}` }, maxRedirects: 0 });
    assert.equal(stale.status(), 303);
    assert.equal(stale.headers().location, '/login');
    await page.goto(`${normal.url}/billing`);
    await visible(page.getByRole('heading', { name: '登录工作台', exact: true }));
    await manualLogin(page, normal);
    const nextCookie = (await context.cookies()).find(cookie => cookie.name === 'fixture_session');
    assert.ok(nextCookie.value !== oldCookie.value, 'A new login must receive a distinct random session');
    return { stale_session_rejected: true, new_session_distinct: true };
  });

  const obstacle = await instance({ mode: 'obstacle' }), obstacleRun = await openContext(obstacle);
  const obstaclePage = obstacleRun.page;
  await check('obstacle_login_has_no_notice_until_directory', async () => {
    assert.deepEqual(await (await obstacleRun.context.request.get(`${obstacle.url}/health`)).json(), { mode: 'obstacle', ready: true });
    await manualLogin(obstaclePage, obstacle);
    await assertHome(obstaclePage, obstacle);
    await enterBilling(obstaclePage, obstacle);
  });
  await check('first_directory_notice_is_modal_and_blocks_real_pointer_click', async () => {
    const notice = obstaclePage.getByRole('dialog', { name: '使用提示', exact: true });
    await visible(notice);
    assert.equal(await notice.evaluate(element => element.matches(':modal')), true);
    const button = obstaclePage.locator('tbody tr').filter({ hasText: '工业日间方案' }).locator('button');
    let clickBlocked = false;
    try { await button.click({ timeout: 1000 }); }
    catch (error) {
      if (error.name !== 'TimeoutError' || !/intercepts pointer events/.test(error.message)) throw error;
      clickBlocked = true;
    }
    assert.equal(clickBlocked, true);
    assert.equal(await obstaclePage.locator('#rate-detail').evaluate(element => element.open), false);
    await screenshot(obstaclePage, 'obstacle-first-notice');
    const requestsBefore = obstacleRun.requests.length;
    await notice.getByRole('button', { name: '知道了', exact: true }).click();
    await notice.waitFor({ state: 'hidden' });
    assert.equal(obstacleRun.requests.length, requestsBefore, 'Dismissal must be local page state only');
    assert.equal(obstaclePage.url(), `${obstacle.url}/billing`);
    await assertTable(obstaclePage);
    await screenshot(obstaclePage, 'obstacle-dismissed-directory');
    return { native_modal: true, real_click_blocked: true, dismissal_network_requests: 0 };
  });
  await check('obstacle_both_details_work_after_dismissal', async () => {
    await detail(obstaclePage, '工业日间方案', '08:00—22:00', '0.68元/度');
    await detail(obstaclePage, '工业夜间方案', '22:00—08:00', '0.23元/度');
  });
  await check('notice_does_not_repeat_on_reload_navigation_or_same_session_tab', async () => {
    await obstaclePage.reload();
    await visible(obstaclePage.getByRole('heading', { name: '费率目录', exact: true }));
    assert.equal(await obstaclePage.getByRole('dialog').count(), 0);
    await obstaclePage.getByRole('link', { name: '工作台', exact: true }).click();
    await assertHome(obstaclePage, obstacle);
    await enterBilling(obstaclePage, obstacle);
    assert.equal(await obstaclePage.getByRole('dialog').count(), 0);
    const sameSessionPage = await obstacleRun.context.newPage();
    await sameSessionPage.goto(`${obstacle.url}/billing`);
    await visible(sameSessionPage.getByRole('heading', { name: '费率目录', exact: true }));
    assert.equal(await sameSessionPage.getByRole('dialog').count(), 0);
    await assertTable(sameSessionPage);
    await sameSessionPage.close();
  });
  await check('new_login_session_gets_its_own_first_notice', async () => {
    await obstaclePage.getByRole('button', { name: '退出登录', exact: true }).click();
    await obstaclePage.waitForURL(`${obstacle.url}/login`);
    await manualLogin(obstaclePage, obstacle);
    await enterBilling(obstaclePage, obstacle);
    const notice = obstaclePage.getByRole('dialog', { name: '使用提示', exact: true });
    await visible(notice);
    await notice.getByRole('button', { name: '知道了', exact: true }).click();
    await notice.waitFor({ state: 'hidden' });
  });

  for (const mode of ['normal', 'obstacle']) {
    const autoDelay = 600, autoFixture = await instance({ mode, autoLoginDelayMs: autoDelay });
    const auto = await openContext(autoFixture);
    await check(`${mode}_auto_login_only_submits_login_form_and_stays_home`, async () => {
      await auto.page.goto(`${autoFixture.url}/login`);
      await auto.page.waitForURL(`${autoFixture.url}/dashboard`);
      await assertHome(auto.page, autoFixture);
      await auto.page.waitForTimeout(autoDelay * 2 + 100);
      await assertHome(auto.page, autoFixture);
      assert.deepEqual(auto.requests.filter(request => request.method === 'POST'), [{ method: 'POST', path: '/login' }]);
      assert.equal(auto.requests.some(request => ['/billing', '/reports'].includes(request.path)), false);
      if (mode === 'normal') await screenshot(auto.page, 'auto-login-dashboard-only');
      return { login_posts: 1, business_navigation_requests: 0, expanded_menus: 0, agent_authentication: 'NOT_TESTED' };
    });
    if (mode === 'obstacle') {
      await check('auto_login_does_not_dismiss_obstacle_on_manual_directory_entry', async () => {
        await enterBilling(auto.page, autoFixture);
        const notice = auto.page.getByRole('dialog', { name: '使用提示', exact: true });
        await visible(notice);
        await auto.page.waitForTimeout(autoDelay * 2 + 100);
        assert.equal(await notice.isVisible(), true);
        assert.equal(await notice.evaluate(element => element.matches(':modal')), true);
      });
    } else {
      await check('manual_interaction_cancels_optional_auto_login', async () => {
        const manual = await openContext(autoFixture);
        await manual.page.goto(`${autoFixture.url}/login`);
        await manual.page.getByLabel('用户名', { exact: true }).fill('tester');
        await manual.page.waitForTimeout(autoDelay * 2 + 100);
        assert.equal(manual.page.url(), `${autoFixture.url}/login`);
        assert.equal(manual.requests.some(request => request.method === 'POST'), false);
        await manual.page.getByLabel('密码', { exact: true }).fill('demo-only');
        await manual.page.getByRole('button', { name: '登录', exact: true }).click();
        await manual.page.waitForURL(`${autoFixture.url}/dashboard`);
        await assertHome(manual.page, autoFixture);
      });
    }
  }
  await check('no_page_script_errors_or_external_requests', async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(externalRequests, []);
    return { page_errors: 0, external_requests: 0 };
  });
} catch (error) {
  result.error = safeError(error);
} finally {
  const cleanupErrors = [];
  for (const context of contexts) {
    try { await context.close(); } catch (error) { cleanupErrors.push(safeError(error)); }
  }
  try { if (browser) await browser.close(); } catch (error) { cleanupErrors.push(safeError(error)); }
  for (const fixture of fixtures) {
    try { await fixture.close(); } catch (error) { cleanupErrors.push(safeError(error)); }
  }
  result.cleanup = {
    contexts_created: contexts.length, browser_closed: browser ? !browser.isConnected() : true,
    fixture_servers_created: fixtures.length, fixture_servers_closed: fixtures.every(fixture => !fixture.server.listening), errors: cleanupErrors,
  };
  result.finished_at = new Date().toISOString();
  result.duration_ms = Date.now() - started.getTime();
  result.passed_checks = result.checks.filter(item => item.status === 'PASSED').length;
  result.failed_checks = result.checks.filter(item => item.status === 'FAILED').length;
  const passed = !result.error && !result.failed_checks && cleanupErrors.length === 0 && result.cleanup.browser_closed && result.cleanup.fixture_servers_closed;
  result.status = passed ? 'FIXTURE_SELF_TEST_PASSED' : 'FIXTURE_SELF_TEST_FAILED';
  result.evidence_file = join(runDir, 'smoke-result.json');
  const json = JSON.stringify(result, null, 2);
  await writeFile(result.evidence_file, `${json}\n`, 'utf8');
  console.log(json);
  process.exitCode = passed ? 0 : 1;
}
