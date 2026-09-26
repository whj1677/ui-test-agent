import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const manifest = JSON.parse(await readFile(new URL('./test-manifest.json', import.meta.url), 'utf8'));
const files = manifest.unit;
if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length ||
    files.some(file => !/^tests\/[\w-]+\.test\.mjs$/.test(file))) {
  throw new Error('UNIT_TEST_MANIFEST_INVALID');
}
const result = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--test', ...files], { cwd: new URL('..', import.meta.url), stdio: 'inherit', shell: false });
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ code, signal }));
});
if (result.signal) throw new Error(`UNIT_TEST_TERMINATED_${result.signal}`);
process.exitCode = result.code ?? 1;
