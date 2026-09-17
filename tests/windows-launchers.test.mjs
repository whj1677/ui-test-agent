import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launchers = ['恢复启动', '启动', '停止', '安装', '环境检查', '备份数据'];

test('Windows batch launchers retain CRLF and a BOM-free ASCII preamble', async () => {
  for (const name of launchers) {
    const source = await fs.readFile(path.join(root, name + '.cmd'), 'utf8');
    assert.ok(source.startsWith('@echo off\r\n'), name + ': CMD preamble must use CRLF');
    assert.ok(!/(?<!\r)\n/.test(source), name + ': bare LF can corrupt CMD parsing after chcp');
  }
});

for (const name of launchers) {
  test(
    name + '.cmd reaches PowerShell without executing the real maintenance script',
    { skip: process.platform !== 'win32' },
    async () => {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-agent launch 中文-'));
      try {
        await fs.copyFile(path.join(root, name + '.cmd'), path.join(directory, name + '.cmd'));
        // Isolate command parsing: never start/stop a service, recover a real lock,
        // install dependencies, or touch user data during this regression check.
        await fs.writeFile(
          path.join(directory, name + '.ps1'),
          "[Console]::WriteLine('UI_AGENT_WRAPPER_REACHED_PS1')\r\nexit 0\r\n",
          'utf8',
        );
        const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', name + '.cmd'], {
          cwd: directory,
          input: '\r\n',
          windowsHide: true,
          timeout: 12000,
          encoding: 'utf8',
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /UI_AGENT_WRAPPER_REACHED_PS1/, result.stdout + result.stderr);
      } finally {
        // Only this uniquely-created test directory is eligible for cleanup.
        assert.ok(path.dirname(directory) === path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('ui-agent launch 中文-'));
        await fs.rm(directory, { recursive: true, force: true });
      }
    },
  );
}
