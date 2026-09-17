import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readBuildInfo } from '../src/build-info.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'validation', 'launcher-' + Date.now());
const dataDir = path.join(output, 'data');
await fs.mkdir(output, { recursive: true });
const build = await readBuildInfo(root);
const records = [];
function command(script, port) {
  return new Promise((resolve, reject) => {
    const process = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(root, script),
        ...(script === '启动.ps1' ? ['-NoOpen'] : []),
      ],
      {
        cwd: root,
        windowsHide: true,
        env: {
          ...globalThis.process.env,
          DEEPSEEK_API_KEY: '',
          UI_AGENT_PORT: String(port),
          UI_AGENT_DATA_DIR: dataDir,
        },
      },
    );
    let stdout = '',
      stderr = '';
    process.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    process.on('error', reject);
    process.on('exit', (code) => {
      // Start-Process can leave inherited pipe handles open in its background child.
      // Completion here belongs to the PowerShell launcher, not the running service.
      process.stdin.destroy();
      process.stdout.destroy();
      process.stderr.destroy();
      resolve({ code, stdout, stderr });
    });
  });
}
async function fake(config, run) {
  const server = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(config));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
for (const [scenario, config] of [
  ['old service has no build identity', { application: 'ui-test-agent', version: '0.3.0' }],
  [
    'same version different build',
    { application: 'ui-test-agent', version: build.version, build_id: 'different' },
  ],
  [
    'same build different data directory',
    {
      application: 'ui-test-agent',
      version: build.version,
      build_id: build.build_id,
      instance: { data_directory_id: 'different' },
    },
  ],
]) {
  await fake(config, async (port) => {
    const result = await command('启动.ps1', port);
    assert.notEqual(result.code, 0, scenario);
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/api/config`)).status,
      200,
      'Existing service must remain alive',
    );
    records.push({ scenario, refused: true, existing_service_untouched: true });
  });
}
const port = await fake({}, async (value) => value);
const url = `http://127.0.0.1:${port}`;
try {
  const started = await command('启动.ps1', port);
  await fs.writeFile(path.join(output, 'start-output.json'), JSON.stringify(started, null, 2));
  assert.equal(started.code, 0, started.stderr);
  const config = await (await fetch(url + '/api/config')).json();
  assert.equal(config.build_id, build.build_id);
  const reused = await command('启动.ps1', port);
  assert.equal(reused.code, 0, reused.stderr);
  assert.equal((await (await fetch(url + '/api/config')).json()).instance.id, config.instance.id);
  records.push({
    scenario: 'new launch and same-build reuse',
    instance_id: config.instance.id,
    build_id: config.build_id,
    verified: true,
  });
  const stopped = await command('停止.ps1', port);
  await fs.writeFile(path.join(output, 'stop-output.json'), JSON.stringify(stopped, null, 2));
  assert.equal(stopped.code, 0, stopped.stderr);
  await assert.rejects(fs.access(path.join(dataDir, '.writer.lock')), { code: 'ENOENT' });
  records.push({ scenario: 'graceful shutdown releases writer lock', verified: true });
} finally {
  // Only address the isolated helper's instance, never a pre-existing user service.
  try {
    const config = await (await fetch(url + '/api/config')).json();
    if (config.build_id === build.build_id) await command('停止.ps1', port);
  } catch {}
}
await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify({ build, records }, null, 2));
console.log(JSON.stringify({ verified: true, directory: output, scenarios: records.length }));
