import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { BrowserSession } from '../src/browser.mjs';
import { startLab } from '../manual-lab/serve.mjs';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { demoCases } from '../src/demo.mjs';

const code = (expected) => (error) => error.code === expected;

for (const mutation of ['route', 'challenge'])
  test(`authentication refuses a late ${mutation} change while memory state is captured`, async (t) => {
    const { browser, task, enter } = await fixture(t);
    await enter();
    const capture = browser.loginContext.storageState.bind(browser.loginContext);
    browser.loginContext.storageState = async () => {
      const state = await capture();
      if (mutation === 'route') await browser.loginPage.goto(task.target + 'assets');
      else
        await browser.loginPage.evaluate(() => {
          const input = document.createElement('input');
          input.autocomplete = 'one-time-code';
          document.body.append(input);
        });
      return state;
    };
    await assert.rejects(
      confirm(browser, task),
      code(mutation === 'route' ? 'LOGIN_CONFIRMATION_STALE' : 'LOGIN_NOT_FINISHED'),
    );
    assert.equal(browser.authenticated, false);
    assert.equal(browser.storage, null);
  });
async function fixture(t) {
  const lab = await startLab(0),
    browser = new BrowserSession({ headless: true });
  t.after(async () => {
    await browser.close();
    await lab.close();
  });
  const task = { id: 'isolated-login-recovery', target: lab.url + '/' };
  await browser.open(task);
  const enter = async () => {
    await browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
    await browser.loginPage.getByRole('heading', { name: '运营总览', exact: true }).waitFor();
  };
  return { lab, browser, task, enter };
}
async function confirm(browser, task) {
  const evidence = await browser.loginEvidence(task);
  const index = evidence.markers.findIndex((m) => m.name === '运营总览' && m.role === 'heading');
  assert.ok(index >= 0, 'a uniquely observed business heading is offered');
  return browser.confirmLoginEvidence(task, evidence.token, index);
}

test('actual complex lab: no automatic positive signal; explicit marker resumes the same waiting loop', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  await assert.rejects(
    browser.waitForAuthentication(task, { timeoutMs: 100 }),
    code('LOGIN_EVIDENCE_REQUIRED'),
  );
  assert.equal(browser.loginStatus(task.id), 'EVIDENCE_REQUIRED');
  const waiting = browser.waitForAuthentication(task, { timeoutMs: 5000 });
  const marker = await confirm(browser, task);
  assert.deepEqual(await waiting, marker);
  assert.equal(browser.authEvidence.source, 'OPERATOR_CONFIRMED_MARKER');
  assert.equal(browser.loginStatus(task.id), 'VERIFIED');
});

test('closed owner page is not active; explicit open recovers only that task in the original context', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  await confirm(browser, task);
  const context = browser.loginContext,
    old = browser.loginPage;
  await old.close();
  assert.equal(browser.browser.isConnected(), true);
  assert.equal(browser.active(task.id), false);
  assert.equal(browser.loginStatus(task.id), 'PAGE_CLOSED');
  assert.equal(browser.authenticated, false);
  assert.equal(browser.authEvidence, null);
  await browser.open(task);
  assert.equal(browser.loginContext, context);
  assert.notEqual(browser.loginPage, old);
  assert.equal(browser.active(task.id), true);
  assert.equal(browser.authenticated, false, 'opening a page does not grant authentication');
  await browser.loginPage.getByRole('heading', { name: '运营总览', exact: true }).waitFor();
  await confirm(browser, task);
});

test('waiting preparation repairs one closed page, then refuses an unbounded reopen loop', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  const old = browser.loginPage;
  const waiting = browser.waitForAuthentication(task, { timeoutMs: 5000 });
  const rejected = assert.rejects(waiting, code('BROWSER_REQUIRED'));
  await old.close();
  for (let i = 0; i < 40 && browser.loginPage === old; i++)
    await new Promise((r) => setTimeout(r, 50));
  assert.notEqual(browser.loginPage, old);
  await browser.loginPage.waitForLoadState('domcontentloaded');
  // Let the first recovery finish its observation before closing again.
  await new Promise((r) => setTimeout(r, 600));
  await browser.loginPage.close();
  await rejected;
});

test('closed context/browser can be reopened without inheriting verified authentication', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  await confirm(browser, task);
  const original = browser.loginContext;
  await original.close();
  await browser.open(task);
  assert.notEqual(browser.loginContext, original);
  assert.equal(browser.authenticated, false);
  await browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).waitFor();
  await browser.browser.close();
  assert.equal(browser.loginStatus(task.id), 'BROWSER_CLOSED');
  await browser.open(task);
  assert.equal(browser.active(task.id), true);
  assert.equal(browser.authenticated, false);
});

test('recovery never adopts an unrelated tab or another task session', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  const unrelated = await browser.loginContext.newPage();
  await unrelated.setContent('<h1>Unrelated page</h1>');
  await browser.loginPage.close();
  await browser.open(task);
  assert.notEqual(browser.loginPage, unrelated);
  assert.equal(await unrelated.locator('h1').textContent(), 'Unrelated page');
  const oldContext = browser.loginContext;
  await browser.open({ ...task, id: 'new-task' });
  assert.notEqual(browser.loginContext, oldContext);
  assert.equal(browser.authenticated, false);
  await browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).waitFor();
});

test('confirmation ticket rejects route changes, wrong tasks, expiry, invalid index and replay', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  let evidence = await browser.loginEvidence(task);
  await browser.loginPage.goto(task.target + 'assets');
  await assert.rejects(
    browser.confirmLoginEvidence(task, evidence.token, 0),
    code('LOGIN_CONFIRMATION_STALE'),
  );
  for (const variant of ['task', 'expiry', 'index']) {
    evidence = await browser.loginEvidence(task);
    if (variant === 'expiry') browser.loginTicket.expires = 0;
    await assert.rejects(
      browser.confirmLoginEvidence(
        variant === 'task' ? { ...task, id: 'other-task' } : task,
        evidence.token,
        variant === 'index' ? -1 : 0,
      ),
      code('LOGIN_CONFIRMATION_STALE'),
    );
    assert.equal(browser.authenticated, false);
  }
  evidence = await browser.loginEvidence(task);
  await browser.confirmLoginEvidence(task, evidence.token, 0);
  await assert.rejects(
    browser.confirmLoginEvidence(task, evidence.token, 0),
    code('LOGIN_CONFIRMATION_STALE'),
  );
});

test('password, OTP, cross-origin and broad markers cannot be operator-confirmed', async (t) => {
  const { browser, task, enter } = await fixture(t);
  await enter();
  for (const html of [
    '<input type="password">',
    '<input autocomplete="one-time-code">',
    '<input name="captcha">',
  ]) {
    await browser.loginPage.setContent('<h1>运营总览</h1>' + html);
    await assert.rejects(browser.loginEvidence(task), code('LOGIN_NOT_FINISHED'));
    await assert.rejects(
      browser.authenticate(task, { kind: 'role', role: 'heading', name: '运营总览', exact: true }),
      code('LOGIN_NOT_FINISHED'),
    );
    assert.equal(browser.authenticated, false);
  }
  await browser.loginPage.setContent('<main id="root">公开页面</main>');
  await assert.rejects(
    browser.authenticate(task, { kind: 'css', value: '#root' }),
    code('LOGIN_EVIDENCE_REQUIRED'),
  );
  await browser.loginPage.goto('about:blank');
  await assert.rejects(browser.loginEvidence(task), code('OUTSIDE_TARGET_ORIGIN'));
});

test('stopping waiting login does not recover another task or reopen a page', async (t) => {
  const { browser, task } = await fixture(t);
  await browser.loginPage.close();
  const signal = AbortSignal.abort();
  await assert.rejects(browser.waitForAuthentication(task, { signal }), code('STOPPED'));
  assert.equal(browser.active(task.id), false);
  await assert.rejects(
    browser.waitForAuthentication({ ...task, id: 'other' }, { timeoutMs: 100 }),
    code('BROWSER_REQUIRED'),
  );
  assert.equal(browser.loginStatus('other'), 'BROWSER_CLOSED');
});

test(
  'real console and Controller: confirm from waiting preparation, preserve scope, no second job',
  { timeout: 45000 },
  async (t) => {
    const lab = await startLab(0);
    const directory = path.resolve('validation', 'login-recovery-' + Date.now());
    await fs.mkdir(directory, { recursive: true });
    let calls = 0;
    const provider = new DeepSeek({
      key: 'synthetic-local-only',
      fetchImpl: async () => {
        throw new Error('NETWORK_FORBIDDEN');
      },
    });
    // Deliberately stop at the first model boundary: this test proves the login handoff,
    // not the quality of a generated plan or any real-model outcome.
    provider.json = async () => {
      calls++;
      throw Object.assign(new Error('SYNTHETIC_LOGIN_HANDOFF_END'), {
        code: 'SYNTHETIC_LOGIN_HANDOFF_END',
      });
    };
    const app = await start({
      port: 0,
      dataDir: path.join(directory, 'data'),
      headless: true,
      provider,
    });
    const ui = await chromium.launch({ headless: true });
    t.after(async () => {
      await ui.close();
      await app.close();
      await lab.close();
    });
    const baseline = demoCases().baseline;
    baseline.cases = baseline.cases.slice(0, 1);
    baseline.case_count = 1;
    const id = await app.store.create({
      name: '隔离登录交接测试',
      target: lab.url + '/',
      baseline,
    });
    await app.store.update(id, (s) => {
      s.authorization.nonproduction = true;
      s.cases[0].reviewed = true;
    });
    const before = await app.store.read(id);
    const baselineBytes = await fs.readFile(path.join(app.store.dir(id), 'baseline.json'));
    const post = (route, body, csrf = app.csrf) =>
      fetch(app.url + '/api/tasks/' + id + '/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body),
      });
    assert.equal((await post('login-evidence', {}, 'incorrect')).status, 403);
    await app.controller.launch(id, 'prepare', [baseline.cases[0].case_id]);
    const job = app.controller.active;
    for (let i = 0; i < 100 && job.stage !== 'WAITING_USER_LOGIN'; i++)
      await new Promise((r) => setTimeout(r, 50));
    assert.equal(job.stage, 'WAITING_USER_LOGIN');
    assert.equal(calls, 0);
    // Other jobs and ordinary capture must remain prohibited during a running preparation.
    await assert.rejects(app.controller.capture(id), code('JOB_ALREADY_RUNNING'));
    await assert.rejects(app.controller.loginEvidence('another-task'), code('JOB_ALREADY_RUNNING'));
    const stage = job.stage;
    job.stage = 'PLANNING';
    assert.equal((await post('login-evidence', {})).status, 409);
    job.stage = stage;
    await app.browser.loginPage.getByRole('button', { name: '进入演示', exact: true }).click();
    await app.browser.loginPage.getByRole('heading', { name: '运营总览', exact: true }).waitFor();
    const page = await ui.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(app.url + '/#task=' + id);
    await page.locator('#workflow-confirm-login').click();
    await page.locator('#login-marker').waitFor();
    await page.locator('#login-marker').selectOption({ label: '运营总览 · heading' });
    // Changing route invalidates the one-shot ticket. Error stays in the dialog with recovery.
    await app.browser.loginPage.goto(lab.url + '/assets');
    await page.locator('#confirm-login-evidence').click();
    await page.locator('#login-confirmation-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#login-confirmation-error').textContent(), /重新读取页面/);
    assert.equal(await page.locator('#modal').evaluate((e) => e.open), true);
    assert.equal(calls, 0);
    await app.browser.loginPage.goto(lab.url + '/overview');
    await page.locator('#reload-login-evidence').click();
    await page.locator('#login-marker').selectOption({ label: '运营总览 · heading' });
    await page.screenshot({ path: path.join(directory, 'confirmation-desktop.png') });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const bounds = await page.locator('#confirm-login-evidence').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375);
    await page.screenshot({ path: path.join(directory, 'confirmation-mobile.png') });
    await page.locator('#confirm-login-evidence').focus();
    const response = page.waitForResponse((r) => r.url().endsWith('/login-confirmation'));
    await page.keyboard.press('Enter');
    assert.equal((await (await response).json()).preparation_resumed, true);
    await job.finished;
    assert.ok(calls > 0, 'first model boundary is reached only after valid confirmation');
    const after = await app.store.read(id);
    assert.equal(after.events.filter((e) => e.type === 'JOB_STARTED').length, 1);
    assert.ok(after.events.some((e) => e.type === 'AUTHENTICATED'));
    assert.deepEqual(after.authorization, before.authorization);
    assert.equal(after.cases[0].plan_approved, false);
    assert.equal(after.cases[0].attempts.length, 0);
    assert.deepEqual(
      await fs.readFile(path.join(app.store.dir(id), 'baseline.json')),
      baselineBytes,
    );
    assert.deepEqual(errors, []);
    t.diagnostic(
      'screenshots: ' + directory + '; provider intentionally stops at the first model boundary',
    );
  },
);
