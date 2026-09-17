import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { APP_ROOT, dataDirectoryId, readBuildInfo } from '../src/build-info.mjs';
import { verifyCandidate } from '../src/distribution.mjs';
import { hash } from '../src/common.mjs';

// Run only against a previously installed, disposable local validation candidate.
// This exercises the copied scripts/dependencies, not the checkout or the user's live instance.
assert.ok(process.argv[2], 'An installed validation candidate directory is required');
const root = await fs.realpath(path.resolve(process.argv[2]));
const validation = await fs.realpath(path.join(APP_ROOT, 'validation'));
const relative = path.relative(validation, root);
assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'release-manifest.json')));
await verifyCandidate(root, manifest);
const build = await readBuildInfo(root);
assert.equal(build.build_id, (await readBuildInfo(APP_ROOT)).build_id);
const output = await fs.mkdtemp(path.join(validation, 'package-smoke-'));
const data = path.join(output, 'data');
const backup = path.join(output, 'backup');
const socket = http.createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const url = 'http://127.0.0.1:' + port;
const records = [];

async function command(script, args = []) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, script), ...args],
      {
        cwd: root,
        windowsHide: true,
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: '',
          UI_AGENT_PORT: String(port),
          UI_AGENT_DATA_DIR: data,
          PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.browsers'),
        },
      },
    );
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ code, stdout, stderr });
    });
  });
  records.push({ script, ...result });
  assert.equal(result.code, 0, script + ': ' + result.stderr);
  return result;
}

const config = async () =>
  (await fetch(url + '/api/config', { signal: AbortSignal.timeout(3000) })).json();
let complete = false;
try {
  const inspected = await command('环境检查.ps1');
  assert.match(inspected.stdout, /候选包摘要/);
  assert.match(inspected.stdout, /与打包时一致/);
  assert.match(inspected.stdout, /已启动并正常关闭独立空白浏览器/);
  await command('启动.ps1', ['-NoOpen']);
  const started = await config();
  assert.equal(started.build_id, build.build_id);
  assert.equal(started.instance.data_directory_id, dataDirectoryId(data));
  assert.equal(started.configured, false, 'No real provider may be configured by installation');
  assert.equal((await fetch(url + '/', { signal: AbortSignal.timeout(3000) })).status, 200);
  await command('启动.ps1', ['-NoOpen']);
  assert.equal((await config()).instance.id, started.instance.id);
  await command('停止.ps1');
  await assert.rejects(fs.access(path.join(data, '.writer.lock')), { code: 'ENOENT' });
  // A synthetic stopped-data fact proves backup content preservation without creating a user task.
  const marker = Buffer.from('SYNTHETIC PACKAGE SMOKE FACT');
  await fs.writeFile(path.join(data, 'smoke-fact.json'), marker);
  await command('备份数据.ps1', ['-Destination', backup]);
  assert.deepEqual(await fs.readFile(path.join(backup, 'data', 'smoke-fact.json')), marker);
  assert.deepEqual(await fs.readFile(path.join(data, 'smoke-fact.json')), marker);
  const backedUp = JSON.parse(await fs.readFile(path.join(backup, 'backup-manifest.json')));
  assert.equal(
    backedUp.files.find((entry) => entry.file === 'smoke-fact.json').sha256,
    hash(marker),
  );
  await verifyCandidate(root, manifest);
  complete = true;
} finally {
  try {
    const running = await config();
    if (
      running.build_id === build.build_id &&
      running.instance?.data_directory_id === dataDirectoryId(data)
    ) {
      await command('停止.ps1');
    }
  } catch {}
  await fs.writeFile(
    path.join(output, 'summary.json'),
    JSON.stringify(
      {
        scope:
          'Installed candidate on existing Windows host; not clean Windows or product acceptance',
        complete,
        candidate: root,
        build_id: build.build_id,
        records,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      complete,
      directory: output,
      build_id: build.build_id,
      command_runs: records.length,
    }),
  );
}
