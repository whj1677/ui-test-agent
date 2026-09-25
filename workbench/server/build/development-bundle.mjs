import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkDevelopmentCandidate } from './development-policy.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
export async function developmentBundle(root, { validate = true } = {}) {
  const entries = []; let total = 0;
  async function visit(directory) {
    for (const item of (await fs.readdir(directory, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink() || !item.isDirectory() && !item.isFile()) throw new Error('BUNDLE_LINK_NOT_ALLOWED');
      if (item.isDirectory()) { await visit(file); continue; }
      const name = path.relative(root, file).replaceAll('\\', '/');
      if (name.split('/').some(p => p === 'node_modules' || p.startsWith('.')) || /(^|\/)package(-lock)?\.json$/.test(name)) throw new Error('BUNDLE_RUNTIME_OVERRIDE_NOT_ALLOWED');
      const bytes = await fs.readFile(file); total += bytes.length;
      if (total > 2 * 1024 * 1024 || entries.length >= 100) throw new Error('BUNDLE_SIZE_LIMIT');
      entries.push({ path: name, bytes: bytes.length, sha256: hash(bytes), content: bytes });
    }
  }
  await visit(root);
  const names = new Set(entries.map(e=>e.path));
  if (!names.has('candidate.spec.mjs')) throw new Error('DRAFT_NOT_CREATED');
  if (validate) for (const entry of entries) if (/\.(mjs|js)$/.test(entry.path)) checkDevelopmentCandidate(entry.content.toString('utf8'), { entry: entry.path === 'candidate.spec.mjs', importAllowed: specifier => {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) return false;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(entry.path), specifier));
    return names.has(target) && /\.mjs$/.test(target);
  }});
  const files = entries.map(({content,...fact})=>fact);
  return { files, sha256: hash(JSON.stringify(files)), entries };
}
export async function saveBundle(bundle, destination) {
  for (const entry of bundle.entries) { const target = path.join(destination, entry.path); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, entry.content, { flag: 'wx' }); }
}
export async function verifyBundle(root, manifest) {
  for (const file of manifest.files) if (hash(await fs.readFile(path.join(root, file.path))) !== file.sha256) return false;
  return true;
}
