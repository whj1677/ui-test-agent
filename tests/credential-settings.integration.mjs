import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from '../src/server.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { CredentialStore, dpapi } from '../src/credential-store.mjs';

test(
  'settings has opt-in retention, busy guard, inline recovery and usable narrow layout',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-settings-'));
    let release, entered;
    const pending = new Promise((r) => {
      entered = r;
    });
    const gate = new Promise((r) => {
      release = r;
    });
    const vault = new CredentialStore(directory, {
      crypt: async (...args) => {
        entered();
        await gate;
        return dpapi(...args);
      },
    });
    const app = await start({
      port: 0,
      dataDir: directory,
      credentialStore: vault,
      provider: new DeepSeek({
        key: '',
        fetchImpl: async () => {
          throw Error('unexpected network');
        },
      }),
    });
    const browser = await chromium.launch({ headless: true });
    t.after(async () => {
      release();
      await browser.close();
      await app.close();
      await fs.rm(directory, { recursive: true, force: true });
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(app.url);
    await page.locator('#settings').click();
    assert.equal(await page.locator('#remember-key').isChecked(), false);
    await page.locator('#key').fill('synthetic-ui-credential-only');
    await page.locator('#remember-key').check();
    await page.locator('#save-config').click();
    await pending;
    assert.equal(await page.locator('#save-config').isDisabled(), true);
    const concurrent = await fetch(app.url + '/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': app.csrf },
      body: JSON.stringify({ key: 'different', remember: false }),
    });
    assert.equal(concurrent.status, 409);
    release();
    await page
      .getByText('已加密保存，下次启动自动恢复。保存设置不代表连接测试成功。', { exact: true })
      .waitFor();
    assert.equal(await page.locator('#key').inputValue(), '');
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.locator('#remember-key').isVisible(), true);
    assert.ok(await page.locator('#modal').evaluate((e) => e.scrollWidth <= e.clientWidth + 1));
    await fs.mkdir('validation/req0016-v2', { recursive: true });
    await page.screenshot({ path: 'validation/req0016-v2/settings-375.png' });
    // A disk failure must keep user input and a recoverable message; no close/toast-only failure.
    vault.error = 'CREDENTIAL_RESTORE_FAILED';
    await page.locator('#key').fill('synthetic-replacement-only');
    await page.locator('#save-config').click();
    await page.getByText(/设置未完成：旧加密副本无法恢复/).waitFor();
    assert.equal(await page.locator('#key').inputValue(), 'synthetic-replacement-only');
    await page.locator('#remember-key').uncheck();
    await page.locator('#save-config').click();
    await page.getByText('已保存到当前进程，磁盘无加密副本。', { exact: true }).waitFor();
    assert.equal(vault.saved, false);
  },
);
