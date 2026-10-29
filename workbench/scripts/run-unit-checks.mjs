import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const manifest = JSON.parse(await readFile(new URL('./test-manifest.json', import.meta.url), 'utf8'));
const files = manifest.unit;
if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length ||
    files.some(file => !/^tests\/[\w-]+\.test\.mjs$/.test(file))) {
  throw new Error('UNIT_TEST_MANIFEST_INVALID');
}
const result = await new Promise((resolve, reject) => {
  // These filesystem-backed fixtures also run while the official model runtime
  // is active. Serialize files so local I/O contention does not strand a test's
  // asynchronous persistence within its bounded completion deadline.
  // A stalled browser or native fixture must fail the engineering run instead
  // of holding it forever. This does not affect business execution timeouts.
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=180000', ...files], { cwd: new URL('..', import.meta.url), stdio: 'inherit', shell: false });
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ code, signal }));
});
if (result.signal) throw new Error(`UNIT_TEST_TERMINATED_${result.signal}`);
process.exitCode = result.code ?? 1;
