import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CredentialStore } from '../src/credential-store.mjs';
import { DeepSeek } from '../src/deepseek.mjs';
import { start } from '../src/server.mjs';

const fakeKey = 'synthetic-credential-not-a-real-api-key';
async function dir(t) {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-credential-'));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  return p;
}
test('unsupported storage fails explicitly without mutating in-memory configuration', async (t) => {
  const vault = new CredentialStore(await dir(t), { supported: false });
  const provider = new DeepSeek({
    key: '',
    fetchImpl: async () => {
      throw Error('no network');
    },
  });
  assert.equal(await vault.load(), null);
  await assert.rejects(provider.configureRemembered({ key: fakeKey, remember: true }, vault), {
    code: 'CREDENTIAL_STORAGE_UNSUPPORTED',
  });
  assert.equal(provider.configured(), false);
  await provider.configureRemembered({ key: fakeKey }, vault);
  assert.equal(provider.configured(), true);
  assert.equal(await vault.stat(), null);
});
test('oversized invalid regular file can be explicitly forgotten, never silently overwritten', async (t) => {
  const vault = new CredentialStore(await dir(t));
  await fs.writeFile(vault.file, 'x'.repeat(32769));
  assert.equal(await vault.load(), null);
  assert.equal(vault.error, 'CREDENTIAL_RESTORE_FAILED');
  await vault.forget();
  assert.equal(await vault.stat(), null);
});
test('corrupt encrypted configuration stays visible and unchanged until explicitly forgotten', async (t) => {
  const vault = new CredentialStore(await dir(t));
  await fs.writeFile(vault.file, '{broken');
  assert.equal(await vault.load(), null);
  assert.equal(vault.status().error, 'CREDENTIAL_RESTORE_FAILED');
  if (vault.supported)
    await assert.rejects(vault.save({ key: fakeKey }), { code: 'CREDENTIAL_FORGET_REQUIRED' });
  assert.equal(await fs.readFile(vault.file, 'utf8'), '{broken');
  await vault.forget();
  assert.equal(vault.status().error, null);
  assert.equal(await vault.stat(), null);
});
test(
  'Windows DPAPI roundtrip across server restart never exposes a key through config API',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-credential-restart-'));
    const make = () =>
      start({
        port: 0,
        dataDir,
        headless: true,
        provider: new DeepSeek({
          key: '',
          fetchImpl: async () => {
            throw Error('no network');
          },
        }),
      });
    let app = await make();
    t.after(async () => {
      await app.close();
      await fs.rm(dataDir, { recursive: true, force: true });
    });
    const post = async (body) => {
      const response = await fetch(app.url + '/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': app.csrf },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    let result = await post({ key: fakeKey, model: 'deepseek-v4-pro', remember: true });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.body.credential_storage.saved, true);
    const disk = await fs.readFile(path.join(dataDir, 'deepseek-credential.dpapi'), 'utf8');
    assert.ok(!disk.includes(fakeKey));
    assert.ok(!disk.includes('deepseek-v4-pro'));
    await app.close();
    app = await make();
    const config = await (await fetch(app.url + '/api/config')).json();
    assert.equal(config.configured, true);
    assert.equal(config.model, 'deepseek-v4-pro');
    assert.equal(config.credential_storage.saved, true);
    assert.ok(!JSON.stringify(config).includes(fakeKey));
    result = await post({ remember: false });
    assert.equal(result.status, 200);
    assert.equal(
      result.body.configured,
      true,
      'forget disk does not interrupt the current in-memory key',
    );
    await app.close();
    app = await make();
    assert.equal(app.provider.configured(), false);
  },
);
test('invalid model/remember never partially changes the private key', async (t) => {
  const vault = new CredentialStore(await dir(t));
  const provider = new DeepSeek({ key: '', fetchImpl: async () => {} });
  await assert.rejects(provider.configureRemembered({ key: fakeKey, model: 'unknown' }, vault), {
    code: 'UNSUPPORTED_MODEL',
  });
  await assert.rejects(provider.configureRemembered({ key: fakeKey, remember: 'yes' }, vault), {
    code: 'INVALID_REMEMBER',
  });
  assert.equal(provider.configured(), false);
});
