import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { licenseError, MAX_LICENSE_BYTES } from './schema.mjs';

const executable = fileURLToPath(new URL('../bin/DeviceLicense.Bridge.exe', import.meta.url));
export const COMPONENT_VERSION = '1.0.0-rsa';
export async function callLicenseBridge(input) {
  const text = JSON.stringify(input);
  if (Buffer.byteLength(text) > MAX_LICENSE_BYTES) throw licenseError('LICENSE_DOCUMENT_INVALID');
  if (process.platform !== 'win32') throw licenseError('LICENSE_PLATFORM_UNSUPPORTED');
  return new Promise((resolve, reject) => {
    const child = execFile(executable, [], { windowsHide: true, timeout: 15000, maxBuffer: 65536, encoding: 'utf8' }, (error, stdout) => {
      if (error) return reject(licenseError('LICENSE_BRIDGE_UNAVAILABLE'));
      let response;
      try { response = JSON.parse(stdout.replace(/^\uFEFF/u, '')); } catch { return reject(licenseError('LICENSE_BRIDGE_INVALID')); }
      if (response.componentVersion !== COMPONENT_VERSION) return reject(licenseError('LICENSE_COMPONENT_VERSION_MISMATCH'));
      if (response.ok !== true) return reject(licenseError(/^(?:LICENSE|HARDWARE)_[A-Z0-9_]+$/.test(response.error || '') ? response.error : 'LICENSE_COMPONENT_FAILED'));
      if (!response.result || typeof response.result !== 'object' || Array.isArray(response.result)) return reject(licenseError('LICENSE_BRIDGE_INVALID'));
      resolve(response.result);
    });
    child.stdin.on('error', () => {}); child.stdin.end(text);
  });
}
