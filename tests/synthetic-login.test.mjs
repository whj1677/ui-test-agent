import test from 'node:test';
import assert from 'node:assert/strict';
import { startSyntheticLoginFixture } from '../scripts/synthetic-login.mjs';
import { BrowserSession } from '../src/browser.mjs';

test('owned synthetic fixture enters and re-verifies a fresh browser without user actions', async (t) => {
  const fixture = await startSyntheticLoginFixture();
  const browser = new BrowserSession({ headless: true });
  t.after(async () => {
    await browser.close();
    await fixture.close();
  });
  const task = { id: 'synthetic-owned-session', target: fixture.url + '/' };
  for (let i = 0; i < 2; i++) {
    await browser.open(task);
    assert.equal(browser.authenticated, false);
    await fixture.enter(browser, task);
    assert.equal(browser.authenticated, true);
    assert.equal(new URL(browser.loginPage.url()).pathname, '/overview');
    await assert.rejects(fixture.enter(browser, { ...task, id: 'other' }), {
      code: 'SYNTHETIC_LOGIN_SCOPE_MISMATCH',
    });
    await assert.rejects(fixture.enter(browser, { ...task, target: 'https://example.com/' }), {
      code: 'SYNTHETIC_LOGIN_SCOPE_MISMATCH',
    });
    await browser.close();
  }
});
