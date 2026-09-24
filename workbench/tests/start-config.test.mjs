import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { test } from 'node:test';

const exec = promisify(execFile);
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));

test('startup template isolates inherited authorization and rejects missing runtime without private data', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-start-config-'));
  try {
    const target = path.join(root, 'workbench', 'scripts');
    await fs.mkdir(target, { recursive: true });
    await fs.copyFile(path.join(scripts, 'start-workbench.ps1'), path.join(target, 'start-workbench.ps1'));
    const runtime = path.join(root, 'empty-runtime');
    await fs.mkdir(runtime);
    const patch = path.join(root, 'fixture-patch.yml');
    await fs.writeFile(patch, '# config path check only; not a Harness configuration\n');
    const config = JSON.parse(await fs.readFile(path.join(scripts, 'start-workbench.local.json.example'), 'utf8'));
    for (const profile of Object.values(config.profiles)) Object.assign(profile, {
      WORKBENCH_BUILD_AUTHORIZATION_ID: null, WORKBENCH_DSH_HOME: runtime,
      WORKBENCH_HARNESS_PATCH: patch, WORKBENCH_USE_STORED_DSH_CREDENTIALS: null,
    });
    const configPath = path.join(target, 'start-workbench.local.json');
    await fs.writeFile(configPath, JSON.stringify(config));
    for (const data of ['six-case-e2e', 'auth01-user-trial']) {
      const dir = path.join(root, 'workbench', '.local', data, 'data');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'catalog.json'), '{}');
    }
    const env = { ...process.env, WORKBENCH_BUILD_AUTHORIZATION_ID: 'stale-test-authorization', M2C_BUILD_AUTHORIZATION_ID: 'stale-fallback', WORKBENCH_USE_STORED_DSH_CREDENTIALS: '1' };
    const check = async (data) => {
      try { return { code: 0, ...await exec('pwsh', ['-NoProfile', '-File', path.join(target, 'start-workbench.ps1'), '-Data', data, '-ConfigPath', configPath, '-CheckOnly'], { env }) }; }
      catch (error) { return error; }
    };
    for (const data of ['e2e', 'auth']) {
      const result = await check(data);
      assert.ok([0, 2].includes(result.code), result.stdout + result.stderr);
      assert.match(result.stdout, /未绑定建例授权/);
      assert.match(result.stdout, /已清除残留的 M2C_BUILD_AUTHORIZATION_ID/);
      assert.doesNotMatch(result.stdout, /stale-test-authorization|stale-fallback|已接通.*闭环/);
    }
    config.profiles.e2e.WORKBENCH_DSH_HOME = path.join(root, 'missing');
    await fs.writeFile(configPath, JSON.stringify(config));
    const missing = await check('e2e');
    assert.equal(missing.code, 1);
    assert.match(missing.stdout, /私有运行时不存在/);
    for (const data of ['six-case-e2e', 'auth01-user-trial']) {
      assert.deepEqual(await fs.readdir(path.join(root, 'workbench', '.local', data)), ['data']);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
