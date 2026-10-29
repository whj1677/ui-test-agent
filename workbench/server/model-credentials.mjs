import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { parseEnv } from 'node:util';
import { verifyCredentialBroker } from '../scripts/native-runtime.mjs';
import { locateModelCredential } from './model-credential-storage.mjs';

export const DEEPSEEK_OFFICIAL_URL = 'https://api.deepseek.com';
const worker = fileURLToPath(new URL('../scripts/native/WindowsCredential.exe', import.meta.url));
const failure = code => new Error(code);
function credential(apiKey, baseUrl, source) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 4096 || /[\u0000-\u001f\u007f]/.test(apiKey)) throw failure('MODEL_CREDENTIAL_INVALID');
  const base = baseUrl?.trim().replace(/\/$/, '') || DEEPSEEK_OFFICIAL_URL;
  if (![DEEPSEEK_OFFICIAL_URL, `${DEEPSEEK_OFFICIAL_URL}/v1`].includes(base)) throw failure('MODEL_CREDENTIAL_ENDPOINT_NOT_OFFICIAL');
  return { apiKey: apiKey.trim(), baseUrl: base, source };
}

// The only plaintext result travels through the child pipe to this process.
// No key, command substitution, profile write, stdout log or error body escapes.
export async function readWindowsCredential(file, { platform = process.platform, environment = process.env, execute = execFile } = {}) {
  if (platform !== 'win32') throw failure('MODEL_CREDENTIAL_DPAPI_WINDOWS_REQUIRED');
  try { await verifyCredentialBroker(); } catch { throw failure('MODEL_CREDENTIAL_DPAPI_UNAVAILABLE'); }
  return new Promise((resolve, reject) => {
    execute(worker, ['read', '--file', file],
      { windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 }, (error, stdout) => {
        if (error) { reject(failure('MODEL_CREDENTIAL_DPAPI_UNAVAILABLE')); return; }
        try {
          const value = JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim());
          if (!value || Object.keys(value).length !== 1) throw failure('MODEL_CREDENTIAL_INVALID');
          resolve(credential(value.apiKey, DEEPSEEK_OFFICIAL_URL, 'windows-dpapi-current-user'));
        } catch { reject(failure('MODEL_CREDENTIAL_DPAPI_INVALID')); }
      });
  });
}

export async function resolveModelCredentials({ useStoredCredentials = false, dshHome, environment = process.env, preferWindowsCredentials = false,
  readFile = fs.readFile, stat = fs.lstat, decrypt = readWindowsCredential } = {}) {
  if (!useStoredCredentials) {
    return environment.DEEPSEEK_API_KEY ? credential(environment.DEEPSEEK_API_KEY, environment.DEEPSEEK_BASE_URL, 'process-environment') : null;
  }
  // An explicitly configured existing DSH home retains its existing source.
  // A clean packaged home has no .env and resolves the user's DPAPI file instead.
  if (dshHome && !preferWindowsCredentials) {
    let stored;
    try { stored = parseEnv(await readFile(path.join(dshHome, '.env'), 'utf8')); }
    catch (error) { if (error?.code !== 'ENOENT') throw failure('MODEL_CREDENTIAL_LEGACY_UNREADABLE'); }
    if (stored?.DEEPSEEK_API_KEY) return credential(stored.DEEPSEEK_API_KEY, stored.DEEPSEEK_BASE_URL, 'saved-dsh-home');
  }
  const selected = await locateModelCredential({ environment, stat });
  if (!selected) return null;
  return decrypt(selected.file, { environment });
}

// One service lifetime uses one resolved source for documents and Harness. A
// user changing their saved key restarts the service to select the new value.
export function createModelCredentialProvider(options = {}) {
  let pending;
  return () => pending ||= resolveModelCredentials(options);
}
