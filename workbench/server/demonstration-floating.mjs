import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PROJECT = /^project-[a-z0-9-]{8,80}$/;
const DEMONSTRATION = /^demo-[a-f0-9-]{36}$/;
const READY = 'DEMONSTRATION_FLOATING_READY';
const READY_TIMEOUT_MS = 20000;
const BUILD_TIMEOUT_MS = 30000;
const MAX_STDOUT_BYTES = 1024;
const sourcePath = fileURLToPath(new URL('./demonstration-floating.cs', import.meta.url));
const appLocalRoot = fileURLToPath(new URL('../.local/runtime/demonstration-floating/', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function compilerPaths(systemRoot) {
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) throw Error('DEMONSTRATION_FLOATING_UNAVAILABLE');
  return ['Framework64', 'Framework'].map(folder => path.win32.join(systemRoot,
    'Microsoft.NET', folder, 'v4.0.30319', 'csc.exe'));
}

async function regularFile(file) {
  try { const stat = await fs.lstat(file); return stat.isFile() && !stat.isSymbolicLink(); }
  catch { return false; }
}

async function runCompiler(executable, args, spawnProcess) {
  let child;
  try { child = spawnProcess(executable, args, { windowsHide: true, shell: false,
    stdio: ['ignore', 'ignore', 'ignore'] }); }
  catch { throw Error('DEMONSTRATION_FLOATING_BUILD_FAILED'); }
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(Error(error)); else resolve();
    };
    const timeout = setTimeout(() => {
      try { child.kill(); } catch {}
      finish('DEMONSTRATION_FLOATING_BUILD_TIMEOUT');
    }, BUILD_TIMEOUT_MS);
    child.once('error', () => finish('DEMONSTRATION_FLOATING_BUILD_FAILED'));
    child.once('exit', code => finish(code === 0 ? null : 'DEMONSTRATION_FLOATING_BUILD_FAILED'));
  });
}

export async function prepareDemonstrationFloatingExecutable({ systemRoot = process.env.SystemRoot,
  source = sourcePath, cacheRoot = appLocalRoot, spawnProcess = spawn } = {}) {
  const compilers = compilerPaths(systemRoot);
  const compiler = (await Promise.all(compilers.map(regularFile))).findIndex(Boolean);
  if (compiler < 0) throw Error('DEMONSTRATION_FLOATING_UNAVAILABLE');
  const bytes = await fs.readFile(source);
  const sourceHash = sha256(bytes);
  const directory = path.join(cacheRoot, sourceHash);
  const output = path.join(directory, 'client.exe');
  const manifestPath = path.join(directory, 'manifest.json');
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest.source_sha256 === sourceHash && await regularFile(output) &&
      manifest.executable_sha256 === sha256(await fs.readFile(output))) return output;
  } catch { /* A missing or invalid cache entry is rebuilt. */ }
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `client-${randomUUID()}.exe`);
  const manifestTemporary = path.join(directory, `manifest-${randomUUID()}.json`);
  try {
    await runCompiler(compilers[compiler], ['/nologo', '/target:winexe', '/optimize+',
      `/out:${temporary}`, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
      '/reference:System.Net.Http.dll', '/reference:System.Web.Extensions.dll', source], spawnProcess);
    if (!await regularFile(temporary)) throw Error('DEMONSTRATION_FLOATING_BUILD_FAILED');
    const executableHash = sha256(await fs.readFile(temporary));
    await fs.rename(temporary, output);
    await fs.writeFile(manifestTemporary, JSON.stringify({ source_sha256: sourceHash,
      executable_sha256: executableHash }) + '\n', { flag: 'wx' });
    await fs.rename(manifestTemporary, manifestPath);
    return output;
  } finally {
    await fs.rm(temporary, { force: true });
    await fs.rm(manifestTemporary, { force: true });
  }
}

export class DemonstrationFloatingHost {
  constructor({ platform = process.platform, systemRoot = process.env.SystemRoot,
    spawnProcess = spawn, prepareExecutable = prepareDemonstrationFloatingExecutable,
    readyTimeoutMs = READY_TIMEOUT_MS } = {}) {
    Object.assign(this, { platform, systemRoot, spawnProcess, prepareExecutable, readyTimeoutMs });
    this.current = null;
  }

  async open(projectId, demonstrationId) {
    if (this.platform !== 'win32') throw Error('DEMONSTRATION_FLOATING_UNSUPPORTED');
    if (!PROJECT.test(projectId) || !DEMONSTRATION.test(demonstrationId)) throw Error('DEMONSTRATION_FLOATING_ID_INVALID');
    const key = `${projectId}/${demonstrationId}`;
    if (this.current) {
      if (this.current.key !== key) throw Error('DEMONSTRATION_FLOATING_ALREADY_ACTIVE');
      await this.current.ready;
      if (this.current && !this.current.child.killed && this.current.child.exitCode == null) {
        const current = this.current;
        try {
          await new Promise((resolve, reject) => current.child.stdin.write('FOCUS\n',
            error => error ? reject(error) : resolve()));
          if (this.current === current) return;
        } catch { this.#closeCurrent(current); }
      }
    }
    const executable = await this.prepareExecutable({ systemRoot: this.systemRoot });
    let child;
    try {
      child = this.spawnProcess(executable, [projectId, demonstrationId],
        { windowsHide: false, stdio: ['pipe', 'pipe', 'ignore'], shell: false });
    } catch { throw Error('DEMONSTRATION_FLOATING_START_FAILED'); }
    const current = { key, child, ready: null, closing: false, delayedClose: null };
    this.current = current;
    child.stdin?.on('error', () => this.#closeCurrent(current));
    child.stdout?.on('error', () => this.#closeCurrent(current));
    current.ready = new Promise((resolve, reject) => {
      let settled = false;
      let output = '';
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) { this.#closeCurrent(current); reject(Error(error)); }
        else resolve();
      };
      const timeout = setTimeout(() => finish('DEMONSTRATION_FLOATING_READY_TIMEOUT'), this.readyTimeoutMs);
      child.once('error', () => finish('DEMONSTRATION_FLOATING_START_FAILED'));
      child.once('exit', () => {
        if (this.current === current) this.current = null;
        finish('DEMONSTRATION_FLOATING_START_FAILED');
      });
      child.stdout?.on('data', chunk => {
        if (settled) return;
        output += chunk.toString('utf8');
        if (Buffer.byteLength(output, 'utf8') > MAX_STDOUT_BYTES) return finish('DEMONSTRATION_FLOATING_START_FAILED');
        const lines = output.split(/\r?\n/);
        output = lines.pop();
        if (lines.includes(READY)) finish();
      });
      if (!child.stdout || !child.stdin) finish('DEMONSTRATION_FLOATING_START_FAILED');
    });
    return current.ready;
  }

  #closeCurrent(current) {
    if (current.closing) return;
    current.closing = true;
    clearTimeout(current.delayedClose);
    if (this.current === current) this.current = null;
    try { current.child.stdin?.end(); } catch {}
    try { if (current.child.exitCode == null && !current.child.killed) current.child.kill(); } catch {}
  }

  close(projectId, demonstrationId, { afterResponse = false } = {}) {
    const current = this.current;
    if (!current || current.key !== `${projectId}/${demonstrationId}`) return;
    if (afterResponse) {
      // The native Stop button is awaiting this HTTP response from the workbench.
      current.delayedClose ||= setTimeout(() => this.#closeCurrent(current), 500);
      current.delayedClose.unref?.();
    } else this.#closeCurrent(current);
  }

  closeAll() { if (this.current) this.#closeCurrent(this.current); }
}
