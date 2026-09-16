// Freeze only JavaScript source, never browser state or project data. Each
// content generation has distinct ESM URLs so local helper imports reload too.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function freezeSessionModules(projectPath, adapterFile) {
  const project = await fs.realpath(projectPath);
  const adapter = path.resolve(adapterFile);
  if (!inside(path.join(project, 'adapter'), adapter)) fail('SESSION_ADAPTER_OUTSIDE_PROJECT');
  const files = [];
  async function visit(dir) {
    const info = await fs.lstat(dir);
    if (info.isSymbolicLink()) fail('SESSION_SOURCE_SYMLINK');
    for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail('SESSION_SOURCE_SYMLINK');
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && /\.(mjs|cjs|js)$/.test(entry.name)) {
        const bytes = await fs.readFile(file);
        files.push({ path: path.relative(project, file).split(path.sep).join('/'), sha256: digest(bytes), bytes });
      }
    }
  }
  await visit(path.join(project, 'support'));
  await visit(path.join(project, 'adapter'));
  files.sort((a, b) => a.path.localeCompare(b.path));
  const adapterRelative = path.relative(project, adapter).split(path.sep).join('/');
  const adapterEntry = files.find(item => item.path === adapterRelative);
  if (!adapterEntry || !files.some(item => item.path === 'support/portable-ui-workflow.mjs')) fail('SESSION_MODULE_MISSING');
  const manifest = files.map(({ path, sha256 }) => ({ path, sha256 }));
  const generation = digest(JSON.stringify(manifest));
  const destination = path.join(project, '.session', 'runtime', generation);
  for (const item of files) {
    const target = path.join(destination, item.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    try { await fs.writeFile(target, item.bytes, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (digest(await fs.readFile(target)) !== item.sha256) fail('SESSION_SNAPSHOT_CHANGED');
    }
  }
  // Reject a concurrently edited source generation before loading any module.
  for (const item of files) if (digest(await fs.readFile(path.join(project, item.path))) !== item.sha256) fail('SESSION_SOURCE_CHANGED_DURING_FREEZE');
  return {
    generation, manifest, adapter_sha256: adapterEntry.sha256,
    adapterPath: path.join(destination, adapterRelative),
    runtimePath: path.join(destination, 'support', 'portable-ui-workflow.mjs'),
    adapterUrl: pathToFileURL(path.join(destination, adapterRelative)).href,
    runtimeUrl: pathToFileURL(path.join(destination, 'support', 'portable-ui-workflow.mjs')).href,
  };
}
