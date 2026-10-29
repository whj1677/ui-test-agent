// Offline byte verification. No server, model, account or external network.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const sha = value => createHash('sha256').update(value).digest('hex');
export async function verifyPortable(root) {
  root = path.resolve(root);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'portable-manifest.json'), 'utf8'));
  if (manifest.schema !== 'workbench/portable-package-v1' || manifest.platform !== 'win32-x64' || !Array.isArray(manifest.files)) throw Error('PORTABLE_MANIFEST_INVALID');
  const names = new Set();
  for (const item of manifest.files) {
    if (typeof item.path !== 'string' || item.path.includes('\\') || item.path.includes(':') || item.path.startsWith('/') || item.path.split('/').some(p => !p || p === '.' || p === '..') || names.has(item.path)) throw Error('PORTABLE_PATH_INVALID');
    names.add(item.path);
    let current = root;
    for (const segment of item.path.split('/')) {
      current = path.join(current, segment);
      if ((await fs.lstat(current)).isSymbolicLink()) throw Error('PORTABLE_SYMLINK_REJECTED');
    }
    const bytes = await fs.readFile(current);
    if (bytes.length !== item.bytes || sha(bytes) !== item.sha256) throw Error('PORTABLE_FILE_CHANGED:' + item.path);
  }
  for (const required of ['runtime/node/node.exe', 'workbench/server/index.mjs', 'workbench/server/licensing/deployment-policy.mjs', 'runtime/node/LICENSE']) if (!names.has(required)) throw Error('PORTABLE_REQUIRED_FILE_MISSING:' + required);
  async function inspect(relative='') {
    for(const entry of await fs.readdir(path.join(root,relative),{withFileTypes:true})) {
      const child=relative?relative+'/'+entry.name:entry.name;
      // These are the documented mutable customer workspace, not executable
      // runtime. They are never present in a newly constructed ZIP.
      if(child==='workbench/.local'||child==='workbench/scripts/start-workbench.local.json')continue;
      if(entry.isSymbolicLink())throw Error('PORTABLE_SYMLINK_REJECTED');
      if(entry.isDirectory())await inspect(child);
      else if(child!=='portable-manifest.json'&&!names.has(child))throw Error('PORTABLE_UNLISTED_FILE:'+child);
    }
  }
  await inspect();
  return {status:'PORTABLE_BYTES_VERIFIED_NOT_PRODUCT_ACCEPTANCE', files:names.size, source_sha256:manifest.source_sha256, node:manifest.node_version, browser:manifest.browser_version};
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  verifyPortable(process.argv[2] || path.resolve(fileURLToPath(new URL('../..', import.meta.url))))
    .then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode=1; });
}
