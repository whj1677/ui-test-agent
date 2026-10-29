import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const NATIVE_PLAYWRIGHT_VERSION = '1.62.1';
const workbench = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageNames = ['@playwright/test', 'playwright', 'playwright-core'];
const sha = content => createHash('sha256').update(content).digest('hex');
const fail = code => Object.assign(new Error(code), { code });
const slash = value => value.split(path.sep).join('/');
const absent = error => error?.code === 'ENOENT';
const exec = promisify(execFile);
// A fresh per-user runtime can inherit Modify without WRITE_DAC (for example
// under a writable drive root). The DSH restricted-token sandbox needs its
// owner to grant its capability SID. Only grant the current user access to a
// newly created, still-empty managed runtime root; never change existing roots.
async function ensureFreshOwnerAccess(root) {
  if (process.platform !== 'win32') return;
  const system = process.env.SystemRoot;
  if (!system || !path.isAbsolute(system)) throw fail('NATIVE_WORKSPACE_ACL_SYSTEM_PATH_REQUIRED');
  try {
    const { stdout } = await exec(path.join(system, 'System32', 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { windowsHide: true });
    const sid = stdout.match(/S-1-(?:\d+-)+\d+/i)?.[0];
    if (!sid) throw Error('SID_MISSING');
    await exec(path.join(system, 'System32', 'icacls.exe'), [root, '/grant', `*${sid}:(OI)(CI)F`], { windowsHide: true });
  } catch { throw fail('NATIVE_WORKSPACE_OWNER_ACCESS_FAILED'); }
}
async function optionalStat(file) { return fs.lstat(file).catch(error => absent(error) ? null : Promise.reject(error)); }
async function readJson(file) { return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
async function fileHash(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }

async function assertNoLinks(absolute) {
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if ((await optionalStat(current))?.isSymbolicLink()) throw fail('NATIVE_WORKSPACE_RUNTIME_LINK_REJECTED');
  }
}

async function inventory(modules, exact = false) {
  const files = [];
  if (exact) {
    const entries = await fs.readdir(modules);
    if (entries.some(name => !['@playwright', 'playwright', 'playwright-core'].includes(name)) ||
        (await fs.readdir(path.join(modules, '@playwright'))).some(name => name !== 'test')) throw fail('NATIVE_WORKSPACE_UNEXPECTED_DEPENDENCY');
  }
  for (const name of packageNames) {
    const directory = path.join(modules, name);
    if (!(await optionalStat(directory))?.isDirectory()) throw fail('NATIVE_WORKSPACE_DEPENDENCY_MISSING');
    await assertNoLinks(directory);
    let metadata;
    try { metadata = await readJson(path.join(directory, 'package.json')); }
    catch { throw fail('NATIVE_WORKSPACE_DEPENDENCY_MANIFEST_INVALID'); }
    if (metadata.name !== name || metadata.version !== NATIVE_PLAYWRIGHT_VERSION ||
      name === '@playwright/test' && metadata.dependencies?.playwright !== NATIVE_PLAYWRIGHT_VERSION ||
      name === 'playwright' && metadata.dependencies?.['playwright-core'] !== NATIVE_PLAYWRIGHT_VERSION) throw fail('NATIVE_WORKSPACE_DEPENDENCY_VERSION_MISMATCH');
    async function walk(folder) {
      for (const item of await fs.readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, item.name), info = await fs.lstat(file);
        if (info.isSymbolicLink()) throw fail('NATIVE_WORKSPACE_DEPENDENCY_LINK_REJECTED');
        if (info.isDirectory()) await walk(file);
        else if (info.isFile()) files.push({ path: slash(path.relative(modules, file)), bytes: info.size, sha256: await fileHash(file) });
        else throw fail('NATIVE_WORKSPACE_DEPENDENCY_FILE_INVALID');
      }
    }
    await walk(directory);
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function atomicJson(file, value) {
  const temporary = path.join(path.dirname(file), `.runtime-${randomUUID()}.tmp`);
  try { await fs.writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.unlink(temporary).catch(error => { if (!absent(error)) throw error; }); }
}

/** Offline local workspace support; existing runtime ACLs and old projects are preserved. */
export async function prepareNativeWorkspaceRuntime({ dataRoot, baseRoot } = {},
  { sourceModules = path.join(workbench, 'node_modules'), copyFile = fs.copyFile, ensureOwnerAccess = ensureFreshOwnerAccess } = {}) {
  if (!path.isAbsolute(dataRoot || '')) throw fail('NATIVE_WORKSPACE_DATA_ROOT_REQUIRED');
  dataRoot = path.resolve(dataRoot);
  const dataInfo = await optionalStat(dataRoot);
  if (!dataInfo?.isDirectory()) throw fail('NATIVE_WORKSPACE_DATA_ROOT_MISSING');
  dataRoot = await fs.realpath(dataRoot);
  if (!baseRoot) {
    if (!path.isAbsolute(process.env.LOCALAPPDATA || '')) throw fail('NATIVE_WORKSPACE_LOCALAPPDATA_REQUIRED');
    baseRoot = path.join(process.env.LOCALAPPDATA, 'ui-test-agent/native-dsh');
  }
  if (!path.isAbsolute(baseRoot)) throw fail('NATIVE_WORKSPACE_BASE_ROOT_REQUIRED');
  const dataIdentity = process.platform === 'win32' ? dataRoot.toLowerCase() : dataRoot;
  const id = sha(dataIdentity).slice(0, 16), root = path.join(path.resolve(baseRoot), id);
  const projectsRoot = path.join(root, 'projects'), modules = path.join(root, 'node_modules');
  const ownerPath = path.join(root, 'workspace-runtime.json'), manifestPath = path.join(root, 'dependency-manifest.json'), lockPath = path.join(root, '.prepare.lock');
  await assertNoLinks(root);
  await fs.mkdir(root, { recursive: true });
  const ownerInfo = await optionalStat(ownerPath);
  if (ownerInfo) {
    if (ownerInfo.isSymbolicLink()) throw fail('NATIVE_WORKSPACE_RUNTIME_LINK_REJECTED');
    const owner = await readJson(ownerPath).catch(() => { throw fail('NATIVE_WORKSPACE_RUNTIME_NOT_OWNED'); });
    if (owner.schema !== 'workbench/native-workspace-runtime-v1' || owner.id !== id || owner.data_root !== dataRoot || owner.version !== NATIVE_PLAYWRIGHT_VERSION) throw fail('NATIVE_WORKSPACE_RUNTIME_NOT_OWNED');
  } else {
    if ((await fs.readdir(root)).length) throw fail('NATIVE_WORKSPACE_RUNTIME_NOT_OWNED');
    await ensureOwnerAccess(root);
    await fs.writeFile(ownerPath, JSON.stringify({ schema: 'workbench/native-workspace-runtime-v1', id, data_root: dataRoot, version: NATIVE_PLAYWRIGHT_VERSION, created_at: new Date().toISOString() }), { flag: 'wx' });
  }
  let lock, staging;
  try {
    try { lock = await fs.open(lockPath, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw fail('NATIVE_WORKSPACE_RUNTIME_PREPARING'); throw error; }
    await assertNoLinks(sourceModules);
    const files = await inventory(sourceModules), bundleSha256 = sha(JSON.stringify(files));
    const savedInfo = await optionalStat(manifestPath), modulesInfo = await optionalStat(modules);
    let reused = false;
    if (savedInfo) {
      if (savedInfo.isSymbolicLink()) throw fail('NATIVE_WORKSPACE_RUNTIME_LINK_REJECTED');
      const saved = await readJson(manifestPath).catch(() => { throw fail('NATIVE_WORKSPACE_DEPENDENCY_MANIFEST_INVALID'); });
      if (saved.schema !== 'workbench/native-workspace-dependencies-v1' || saved.version !== NATIVE_PLAYWRIGHT_VERSION ||
          saved.bundle_sha256 !== bundleSha256 || JSON.stringify(saved.files) !== JSON.stringify(files)) throw fail('NATIVE_WORKSPACE_DEPENDENCY_SOURCE_CHANGED');
      if (!modulesInfo || modulesInfo.isSymbolicLink() || !modulesInfo.isDirectory()) throw fail('NATIVE_WORKSPACE_DEPENDENCY_COPY_INCOMPLETE');
      const copied = await inventory(modules, true);
      if (sha(JSON.stringify(copied)) !== bundleSha256) throw fail('NATIVE_WORKSPACE_DEPENDENCY_COPY_CHANGED');
      reused = true;
    } else {
      if (modulesInfo) throw fail('NATIVE_WORKSPACE_DEPENDENCY_COPY_INCOMPLETE');
      staging = path.join(root, `.dependency-staging-${randomUUID()}`);
      await fs.mkdir(staging);
      for (const file of files) {
        const target = path.join(staging, file.path);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(sourceModules, file.path), target);
      }
      if (sha(JSON.stringify(await inventory(staging, true))) !== bundleSha256) throw fail('NATIVE_WORKSPACE_DEPENDENCY_COPY_CHANGED');
      // The installed directory becomes visible only after every original byte is verified.
      await fs.rename(staging, modules); staging = null;
      await atomicJson(manifestPath, { schema: 'workbench/native-workspace-dependencies-v1', version: NATIVE_PLAYWRIGHT_VERSION,
        packages: packageNames, source: sourceModules, bundle_sha256: bundleSha256, files, created_at: new Date().toISOString() });
    }
    await assertNoLinks(projectsRoot);
    await fs.mkdir(projectsRoot, { recursive: true });
    return { root, projectsRoot, modulesRoot: modules, manifestPath, id, version: NATIVE_PLAYWRIGHT_VERSION,
      bundle_sha256: bundleSha256, file_count: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), reused };
  } finally {
    if (staging) {
      const actual = await fs.realpath(staging).catch(error => absent(error) ? null : Promise.reject(error));
      if (actual && path.dirname(actual) === root && path.basename(actual).startsWith('.dependency-staging-')) await fs.rm(actual, { recursive: true });
    }
    if (lock) { await lock.close(); await fs.unlink(lockPath); }
  }
}
