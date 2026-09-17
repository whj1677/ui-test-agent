import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The user paused optimization/evaluation. Ordinary runtime regression stays independent.
const paused = new Set(['optimization.test.mjs', 'evaluation-preparation.test.mjs']);
const files = (await fs.readdir(path.join(root, 'tests')))
  .filter((name) => name.endsWith('.test.mjs') && !paused.has(name))
  .sort()
  .map((name) => path.join('tests', name));
const child = spawn(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
