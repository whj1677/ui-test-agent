import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fail } from './common.mjs';

// No shell interpolation or secret command-line arguments. Only the encrypted
// envelope is written to disk. DPAPI is scoped to the current Windows account.
export function dpapi(mode, bytes) {
  if (process.platform !== 'win32') fail('CREDENTIAL_STORAGE_UNSUPPORTED');
  if (!['Protect', 'Unprotect'].includes(mode)) fail('CREDENTIAL_STORAGE_FAILED');
  const script = `$ErrorActionPreference='Stop'; try { Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $e=[Text.Encoding]::UTF8.GetBytes('ui-test-agent/deepseek/v1'); $r=[Security.Cryptography.ProtectedData]::${mode}($b,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r)) } catch { exit 1 }`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    );
    let output = '',
      settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error
        ? reject(
            Object.assign(new Error('CREDENTIAL_STORAGE_FAILED'), {
              code: 'CREDENTIAL_STORAGE_FAILED',
            }),
          )
        : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(true);
    }, 15000);
    child.on('error', () => finish(true));
    child.stdin.on('error', () => finish(true));
    child.stdout.on('data', (chunk) => {
      output += chunk.toString('ascii');
      if (output.length > 32768) {
        child.kill();
        finish(true);
      }
    });
    child.on('close', (code) => {
      if (code !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(output)) return finish(true);
      finish(false, Buffer.from(output, 'base64'));
    });
    child.stdin.end(Buffer.from(bytes).toString('base64'));
  });
}

export class CredentialStore {
  constructor(root, { crypt = dpapi, supported = process.platform === 'win32' } = {}) {
    this.file = path.join(root, 'deepseek-credential.dpapi');
    this.crypt = crypt;
    this.supported = supported;
    this.saved = false;
    this.error = null;
  }
  status() {
    return { supported: this.supported, saved: this.saved, error: this.error };
  }
  async stat() {
    try {
      const stat = await fs.lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768)
        fail('CREDENTIAL_STORAGE_INVALID');
      return stat;
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  async load() {
    try {
      if (!(await this.stat())) return null;
      this.saved = true;
      if (!this.supported) fail('CREDENTIAL_STORAGE_UNSUPPORTED');
      const envelope = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (
        envelope.schema !== 'ui-agent-dpapi/v1' ||
        typeof envelope.ciphertext !== 'string' ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)
      )
        fail('CREDENTIAL_STORAGE_INVALID');
      const plain = await this.crypt('Unprotect', Buffer.from(envelope.ciphertext, 'base64'));
      try {
        const config = JSON.parse(plain.toString('utf8'));
        if (
          typeof config.key !== 'string' ||
          !config.key.trim() ||
          config.key.length > 500 ||
          !['deepseek-flash', 'deepseek-v4-pro'].includes(config.model) ||
          config.base_url !== 'https://api.deepseek.com'
        )
          fail('CREDENTIAL_STORAGE_INVALID');
        this.error = null;
        return { key: config.key, model: config.model };
      } finally {
        plain.fill(0);
      }
    } catch {
      this.error = 'CREDENTIAL_RESTORE_FAILED';
      return null; // visible status; do not destroy a corrupt or foreign-account file
    }
  }
  async save(config) {
    if (!this.supported) fail('CREDENTIAL_STORAGE_UNSUPPORTED');
    if (this.error) fail('CREDENTIAL_FORGET_REQUIRED');
    if (!config.key || config.base_url !== 'https://api.deepseek.com')
      fail('CREDENTIAL_KEY_REQUIRED');
    await this.stat();
    const plain = Buffer.from(JSON.stringify(config));
    let ciphertext;
    try {
      ciphertext = await this.crypt('Protect', plain);
    } finally {
      plain.fill(0);
    }
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    try {
      await fs.writeFile(
        temporary,
        JSON.stringify({ schema: 'ui-agent-dpapi/v1', ciphertext: ciphertext.toString('base64') }),
        { flag: 'wx', mode: 0o600 },
      );
      await fs.rename(temporary, this.file);
      this.saved = true;
      this.error = null;
    } catch {
      fail('CREDENTIAL_STORAGE_FAILED');
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }
  async forget() {
    try {
      const stat = await fs.lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink()) fail('CREDENTIAL_STORAGE_INVALID');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    await fs.rm(this.file, { force: true });
    this.saved = false;
    this.error = null;
  }
}
