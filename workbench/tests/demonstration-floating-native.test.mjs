import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/demonstration-floating.cs');
const csc = path.join(process.env.WINDIR || 'C:\\WINDOWS', 'Microsoft.NET', 'Framework64',
  'v4.0.30319', 'csc.exe');

test('native floating client compiles and exercises refresh plus assertion entry without network or window',
  { skip: process.platform !== 'win32' }, async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'demonstration-floating-'));
    const exe = path.join(temp, 'client.exe');
    try {
      assert.equal(fs.existsSync(csc), true, 'Windows .NET Framework csc.exe is available');
      const build = spawnSync(csc, ['/nologo', '/target:winexe', `/out:${exe}`,
        '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
        '/reference:System.Net.Http.dll', '/reference:System.Web.Extensions.dll', source],
      { encoding: 'utf8', timeout: 20000 });
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
      const self = spawnSync(exe, ['--self-test'], { encoding: 'utf8', timeout: 15000 });
      assert.equal(self.status, 0, `${self.stdout}\n${self.stderr}`);
      assert.match(self.stdout, /DEMONSTRATION_FLOATING_SELFTEST_OK/);

      const invalid = spawnSync(exe, ['project-invalid/other', 'demo-473f0000-0000-0000-0000-000000000000'],
        { encoding: 'utf8', timeout: 5000 });
      assert.equal(invalid.status, 2);
      assert.match(invalid.stderr, /DEMONSTRATION_FLOATING_ID_INVALID/);

      const piped = await new Promise((resolve, reject) => {
        const child = spawn(exe, ['--pipe-self-test'], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => resolve({ code, stdout, stderr }));
        child.stdin.end('FOCUS\n');
      });
      assert.equal(piped.code, 0, piped.stderr);
      assert.match(piped.stdout, /DEMONSTRATION_FLOATING_PIPE_OK/);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });

test('native source fixes local origin and does not accept credential arguments', () => {
  const code = fs.readFileSync(source, 'utf8');
  assert.match(code, /const string Origin = "http:\/\/127\.0\.0\.1:4322"/);
  assert.match(code, /UseProxy = false, AllowAutoRedirect = false/);
  assert.match(code, /Console\.WriteLine\("DEMONSTRATION_FLOATING_READY"\)/);
  assert.match(code, /line != "FOCUS"/);
  assert.match(code, /expectedText\.Visible = !collapsed && expectedOpen/);
  assert.match(code, /if \(IsDisposed\) return/);
  assert.match(code, /AddButton\("断言点选"[\s\S]*?AddButton\("断言框选"/);
  assert.match(code, /SELFTEST_RECORDING_PAUSE_THEN_PICK_FAILED/);
  assert.match(code, /SELFTEST_FAILED_PAUSE_STARTED_PICK/);
  assert.doesNotMatch(code, /storageState|password|api.?key|--display-title/i);
});
