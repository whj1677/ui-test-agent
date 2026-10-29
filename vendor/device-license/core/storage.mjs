import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_LICENSE_BYTES, canonicalJson, licenseError, parseLicenseJson } from './schema.mjs';
import { verifyLicense } from './verify.mjs';

function absoluteFile(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw licenseError('LICENSE_STORAGE_PATH_INVALID');
  return path.resolve(filePath);
}

async function readDocument(filePath) {
  let handle;
  try {
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_LICENSE_BYTES) throw licenseError('LICENSE_STORAGE_INVALID');
    handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(MAX_LICENSE_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_LICENSE_BYTES) throw licenseError('LICENSE_STORAGE_INVALID');
    return parseLicenseJson(buffer.subarray(0, bytesRead).toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw licenseError('LICENSE_MISSING');
    if (error.code?.startsWith('LICENSE_')) throw error;
    throw licenseError('LICENSE_STORAGE_UNAVAILABLE');
  } finally { await handle?.close(); }
}

export async function loadInstalledLicense({ expectedProduct, filePath, publicKey, hardwareFingerprint, profileId }) {
  const license = await readDocument(absoluteFile(filePath));
  const payload = await verifyLicense({ expectedProduct, license, publicKey, hardwareFingerprint, profileId });
  return { license, payload };
}

export async function installLicense({ expectedProduct, license, filePath, publicKey, hardwareFingerprint, profileId, replace = false }) {
  if (typeof replace !== 'boolean') throw licenseError('LICENSE_REPLACEMENT_FLAG_INVALID');
  const payload = await verifyLicense({ expectedProduct, license, publicKey, hardwareFingerprint, profileId });
  const destination = absoluteFile(filePath);
  const serialized = `${canonicalJson(license)}\n`;
  const existing = async () => {
    const current = await loadInstalledLicense({ expectedProduct, filePath: destination, publicKey, hardwareFingerprint, profileId });
    if (canonicalJson(current.license) !== canonicalJson(license)) throw licenseError('LICENSE_ALREADY_INSTALLED');
    return { installed: false, alreadyInstalled: true, payload: current.payload };
  };
  try { return await existing(); }
  catch (error) {
    if (error.code !== 'LICENSE_MISSING' && !replace) throw error;
    if (error.code !== 'LICENSE_MISSING') {
      const stat = await fs.lstat(destination);
      if (stat.isSymbolicLink() || !stat.isFile()) throw licenseError('LICENSE_STORAGE_INVALID');
    }
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    // A hard link atomically publishes the complete synced file and never replaces
    // another installation. Unsupported filesystems fail closed; no overwrite fallback.
    try {
      if (replace) await fs.rename(temporary, destination);
      else await fs.link(temporary, destination);
    }
    catch (error) { if (error.code === 'EEXIST') return await existing(); throw error; }
    return { installed: true, alreadyInstalled: false, replaced: replace, payload };
  } catch (error) {
    if (error.code?.startsWith('LICENSE_')) throw error;
    throw licenseError('LICENSE_STORAGE_UNAVAILABLE');
  } finally {
    await handle?.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
  }
}
