import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess } from './process-control.mjs';
import { allowedEnvironment } from './harness-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dshHome = path.join(root, '.local', 'dsh');
const dshBin = path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const required = {
  '@deepseek-ai/dsh-browser-use': '0.1.6-alpha.2',
  '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp': '0.1.6-alpha.2',
};
await mkdir(dshHome, { recursive: true });
const env = allowedEnvironment({ DSH_HOME: dshHome });
let result = await runOwnedProcess(process.execPath, [dshBin, '--profile', 'headless', '--dump-default-config'], {
  cwd: root, env, timeoutMs: 60_000,
});
if (result.exitCode !== 0) throw new Error(`failed to initialize isolated profile: ${result.stderr}`);
const packagePath = path.join(dshHome, 'profiles', 'headless', 'package.json');
let installed = {};
try { installed = JSON.parse(await readFile(packagePath, 'utf8')).dependencies ?? {}; } catch {}
const missing = Object.entries(required).filter(([name, version]) => installed[name] !== version);
if (missing.length) {
  result = await runOwnedProcess(process.execPath, [dshBin, 'plugin', '--profile', 'headless', 'add',
    ...missing.map(([name, version]) => `${name}@${version}`)], { cwd: root, env, timeoutMs: 180_000 });
  if (result.exitCode !== 0) throw new Error(`failed to install isolated profile plugins: ${result.stderr}`);
}
const finalPackage = JSON.parse(await readFile(packagePath, 'utf8'));
for (const [name, version] of Object.entries(required)) {
  if (finalPackage.dependencies?.[name] !== version) throw new Error(`profile package mismatch: ${name}`);
}
console.log(JSON.stringify({ status: 'ready', dshVersion: '0.1.6-alpha.2', dshHome, plugins: required }));
