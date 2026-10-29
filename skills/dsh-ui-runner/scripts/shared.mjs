import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire, isBuiltin} from 'node:module';
import {pathToFileURL} from 'node:url';

const digest = data => createHash('sha256').update(data).digest('hex');
const scope = value => new URL(value).href;
const loadedRoots = new Map();
const fingerprint = files => digest(JSON.stringify(files));
const localTypes = new Set(['.mjs', '.js', '.json']);
let parse;

function requireUnchangedProcess(root, files, markLoaded = false) {
  const hash = fingerprint(files);
  if (loadedRoots.has(root) && loadedRoots.get(root) !== hash) throw Error('SHARED_SOURCE_CHANGED_RESTART_PROCESS_REQUIRED');
  if (markLoaded) loadedRoots.set(root, hash);
}

// This verifies normal module dependencies, not a sandbox for hostile JavaScript.
async function validateImports(root, files) {
  parse ??= createRequire(process.env.WORKBENCH_PACKAGE || import.meta.url)('acorn').parse;
  const tracked = new Set(files.map(item => path.resolve(root, item.file)));
  for (const item of files) {
    const file = path.resolve(root, item.file);
    if (path.extname(file) === '.json') continue;
    const ast = parse(await fs.readFile(file, 'utf8'), {ecmaVersion:'latest', sourceType:'module'});
    const imports = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type) && node.source) {
        if (node.source.type !== 'Literal' || typeof node.source.value !== 'string') throw Error('SHARED_NONLITERAL_IMPORT_UNSUPPORTED');
        imports.push(node.source.value);
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require') throw Error('SHARED_REQUIRE_UNSUPPORTED');
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    }
    visit(ast);
    for (const specifier of imports) {
      if (isBuiltin(specifier)) continue;
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw Error(`SHARED_EXTERNAL_IMPORT_UNSUPPORTED:${specifier}`);
      if (/[?#]/.test(specifier)) throw Error(`SHARED_IMPORT_URL_UNSUPPORTED:${specifier}`);
      const target = path.resolve(path.dirname(file), specifier);
      const relative = path.relative(root, target);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error(`SHARED_IMPORT_OUTSIDE_ROOT:${specifier}`);
      if (!localTypes.has(path.extname(target))) throw Error(`SHARED_IMPORT_TYPE_UNSUPPORTED:${specifier}`);
      if (!tracked.has(target)) throw Error(`SHARED_IMPORT_UNTRACKED:${specifier}`);
      if (await fs.realpath(target) !== target) throw Error('SHARED_SYMLINK_UNSUPPORTED');
    }
  }
}
async function sourceFiles(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
      if (entry.isSymbolicLink()) throw Error('SHARED_SYMLINK_UNSUPPORTED');
      if (entry.name === 'node_modules' || entry.name === 'evidence') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:mjs|js|json)$/.test(entry.name) && entry.name !== 'manifest.json') {
        files.push({file: path.relative(root, file).replaceAll('\\', '/'), sha256: digest(await fs.readFile(file))});
      }
    }
  }
  await walk(root);
  return files.sort((a,b) => a.file.localeCompare(b.file));
}
async function resolveEntry(root, entry, files) {
  if (!entry.id || !entry.file || !entry.operation || !entry.verify) throw Error('SHARED_ENTRY_INVALID');
  const file = path.resolve(root, entry.file);
  const relative = path.relative(root, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error('SHARED_PATH_OUTSIDE_ROOT');
  if (!['.mjs', '.js'].includes(path.extname(file)) || !files.some(item => path.resolve(root, item.file) === file)) throw Error('SHARED_ENTRY_UNTRACKED');
  const real = await fs.realpath(file);
  if (real !== file) throw Error('SHARED_SYMLINK_UNSUPPORTED');
  requireUnchangedProcess(root, files, true);
  const mod = await import(`${pathToFileURL(file)}?sha=${digest(await fs.readFile(file))}`);
  if (typeof mod[entry.operation] !== 'function' || typeof mod[entry.verify] !== 'function') throw Error('SHARED_EXPORT_MISSING');
  return mod;
}

// Only technical operations and their live guards are shared. Business assertions stay in each case.
export async function publishShared({page, root, entries}) {
  root = await fs.realpath(root);
  if (!Array.isArray(entries) || !entries.length || new Set(entries.map(e=>e.id)).size !== entries.length) throw Error('SHARED_IDS_INVALID');
  const before = await sourceFiles(root);
  requireUnchangedProcess(root, before);
  await validateImports(root, before);
  const moduleUrl = scope(page.url());
  const checks = [];
  for (const entry of entries) {
    const mod = await resolveEntry(root, entry, before);
    if (await mod[entry.verify](page) !== true) throw Error(`SHARED_GUARD_FAILED:${entry.id}`);
    if (scope(page.url()) !== moduleUrl) throw Error('SHARED_SCOPE_CHANGED_DURING_VERIFY');
    checks.push({id: entry.id, checked_at: new Date().toISOString(), passed: true});
  }
  if (JSON.stringify(before) !== JSON.stringify(await sourceFiles(root))) throw Error('SHARED_CHANGED_DURING_VERIFY');
  const manifest = {schema:'dsh-ui-shared-v1', module_url:moduleUrl, verified_at:new Date().toISOString(), entries, files:before, checks};
  await fs.writeFile(path.join(root,'manifest.json'), JSON.stringify(manifest,null,2));
  return manifest;
}

export async function useShared({page, root, ids}) {
  root = await fs.realpath(root);
  const manifest = JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
  async function checkState() {
    if (manifest.schema !== 'dsh-ui-shared-v1' || manifest.module_url !== scope(page.url())) throw Error('SHARED_SCOPE_MISMATCH');
    const files = await sourceFiles(root);
    requireUnchangedProcess(root, files);
    if (JSON.stringify(manifest.files) !== JSON.stringify(files)) throw Error('SHARED_SOURCE_CHANGED_REVERIFY_REQUIRED');
    return files;
  }
  const files = await checkState();
  await validateImports(root, files);
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw Error('SHARED_IDS_INVALID');
  const operations = Object.create(null);
  for (const id of ids) {
    const entry = manifest.entries.find(e=>e.id===id);
    if (!entry) throw Error(`SHARED_ENTRY_MISSING:${id}`);
    const mod = await resolveEntry(root,entry,files);
    if (await mod[entry.verify](page) !== true) throw Error(`SHARED_STALE_REPAIR_THIS_OPERATION:${id}`);
    await checkState();
    operations[id] = async (...args) => {
      await checkState();
      if (await mod[entry.verify](page) !== true) throw Error(`SHARED_STALE_REPAIR_THIS_OPERATION:${id}`);
      await checkState();
      return mod[entry.operation](page,...args);
    };
  }
  return operations;
}
