// Verify serialized customer ZIP bytes without extracting, starting a service,
// reading credentials or trusting the build process's filesystem byte view.
import unzipper from 'unzipper';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MANIFEST = 'portable-manifest.json';
const REQUIRED = ['runtime/node/node.exe', 'runtime/node/LICENSE', 'workbench/server/index.mjs', 'workbench/server/licensing/deployment-policy.mjs'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function safeName(name) {
  return typeof name === 'string' && name.length > 0 && !/[\\:\x00]/.test(name)
    && !name.startsWith('/') && name.split('/').every(p => p && p !== '.' && p !== '..');
}
async function digestEntry(entry, expectedBytes, collect = false) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > 2 ** 31
    || entry.uncompressedSize !== expectedBytes) throw Error('PORTABLE_ARCHIVE_SIZE_INVALID:' + entry.path);
  const hash = createHash('sha256'), chunks = [];
  let bytes = 0;
  const stream = entry.stream();
  for await (const chunk of stream) {
    bytes += chunk.length;
    if (bytes > expectedBytes) { stream.destroy(); throw Error('PORTABLE_ARCHIVE_SIZE_INVALID:' + entry.path); }
    hash.update(chunk);
    if (collect) chunks.push(chunk);
  }
  if (bytes !== expectedBytes) throw Error('PORTABLE_ARCHIVE_SIZE_INVALID:' + entry.path);
  return { sha256: hash.digest('hex'), bytes, ...(collect ? { content: Buffer.concat(chunks) } : {}) };
}

export async function verifyPortableArchive(archive, { expectedManifestSha256 } = {}) {
  if (expectedManifestSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedManifestSha256)) throw Error('PORTABLE_MANIFEST_DIGEST_INVALID');
  const directory = await unzipper.Open.file(path.resolve(archive));
  if (!directory.files.length || directory.files.length > 100000) throw Error('PORTABLE_ARCHIVE_ENTRY_LIMIT');
  const entries = new Map();
  for (const entry of directory.files) {
    if (!safeName(entry.path) || entries.has(entry.path) || entry.type !== 'File'
      || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw Error('PORTABLE_ARCHIVE_PATH_INVALID');
    entries.set(entry.path, entry);
  }
  const manifestEntry = entries.get(MANIFEST);
  if (!manifestEntry || manifestEntry.uncompressedSize > 32 * 1024 * 1024) throw Error('PORTABLE_MANIFEST_INVALID');
  const manifestBytes = await digestEntry(manifestEntry, manifestEntry.uncompressedSize, true);
  if (expectedManifestSha256 && manifestBytes.sha256 !== expectedManifestSha256) throw Error('PORTABLE_MANIFEST_DIGEST_MISMATCH');
  const manifest = JSON.parse(manifestBytes.content.toString('utf8'));
  if (manifest.schema !== 'workbench/portable-package-v1' || manifest.platform !== 'win32-x64' || !Array.isArray(manifest.files)) throw Error('PORTABLE_MANIFEST_INVALID');
  const names = new Set();
  let bytes = 0;
  for (const item of manifest.files) {
    if (!safeName(item.path) || item.path === MANIFEST || names.has(item.path)) throw Error('PORTABLE_ARCHIVE_PATH_INVALID');
    names.add(item.path);
    const entry = entries.get(item.path);
    if (!entry) throw Error('PORTABLE_ARCHIVE_FILE_MISSING:' + item.path);
    if (!/^[a-f0-9]{64}$/.test(item.sha256)) throw Error('PORTABLE_MANIFEST_INVALID');
    const actual = await digestEntry(entry, item.bytes);
    if (actual.sha256 !== item.sha256) throw Error('PORTABLE_FILE_CHANGED:' + item.path);
    bytes += actual.bytes;
  }
  for (const name of REQUIRED) if (!names.has(name)) throw Error('PORTABLE_REQUIRED_FILE_MISSING:' + name);
  for (const name of entries.keys()) if (name !== MANIFEST && !names.has(name)) throw Error('PORTABLE_UNLISTED_FILE:' + name);
  return { status: 'PORTABLE_ARCHIVE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE', files: names.size,
    bytes_uncompressed: bytes, manifest_sha256: manifestBytes.sha256, source_sha256: manifest.source_sha256,
    node: manifest.node_version, browser: manifest.browser_version };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  verifyPortableArchive(process.argv[2], { expectedManifestSha256: process.argv[3] })
    .then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
