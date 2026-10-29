import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { FRONTEND_HANDOFF_SCHEMA, isHandoffSourcePath, sourceSnapshotHash, validateFrontendHandoff } from './contract.mjs';

const readJson = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
async function writeNew(file, value) {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
async function readSource(root, relative) {
  if (!isHandoffSourcePath(relative)) throw new Error(`Not an allowed relative source path: ${relative}`);
  const rootReal = await fs.realpath(root);
  const actual = await fs.realpath(path.join(rootReal, relative));
  const resolvedRelative = path.relative(rootReal, actual);
  if (resolvedRelative === '..' || resolvedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelative)) throw new Error(`Source link escapes root: ${relative}`);
  const stat = await fs.stat(actual);
  if (!stat.isFile() || stat.size > 2_000_000) throw new Error(`Source is not a bounded file: ${relative}`);
  const bytes = await fs.readFile(actual);
  const content = bytes.toString('utf8');
  if (content.includes('\0')) throw new Error(`Binary source rejected: ${relative}`);
  return { path: relative, sha256: createHash('sha256').update(bytes).digest('hex'), line_count: content.split(/\r?\n/).length };
}

export async function prepare({ root, selectionFile, manifestFile }) {
  const selection = await readJson(selectionFile);
  if (!selection || typeof selection.module?.name !== 'string' || !Array.isArray(selection.module.aliases) || !Array.isArray(selection.files) || selection.files.length < 1 || selection.files.length > 150) throw new Error('selection needs module{name,aliases} and 1..150 relative files');
  if (new Set(selection.files).size !== selection.files.length) throw new Error('duplicate source files');
  const files = [];
  for (const file of selection.files) files.push(await readSource(root, file));
  const manifest = { schema: 'frontend-module-handoff/internal-manifest-v1', created_at: new Date().toISOString(), package_id: `handoff-${randomUUID()}`, source_root: await fs.realpath(root), module: selection.module, source: { revision: selection.revision || null, files, snapshot_sha256: sourceSnapshotHash(files) } };
  await writeNew(manifestFile, manifest);
  return { manifest: path.resolve(manifestFile), files: files.length, snapshot_sha256: manifest.source.snapshot_sha256 };
}

export async function seal({ manifestFile, draftFile, outputFile }) {
  const manifest = await readJson(manifestFile);
  if (manifest.schema !== 'frontend-module-handoff/internal-manifest-v1') throw new Error('unsupported internal manifest');
  const current = [];
  for (const file of manifest.source.files) current.push(await readSource(manifest.source_root, file.path));
  if (sourceSnapshotHash(current) !== manifest.source.snapshot_sha256) throw new Error('Source changed after prepare; inspect changes and prepare a new export');
  const draft = await readJson(draftFile);
  if (Object.keys(draft).some(key => !['pages', 'unresolved'].includes(key))) throw new Error('draft contains unexpected fields; only pages and unresolved are allowed');
  const document = { schema: FRONTEND_HANDOFF_SCHEMA, package_id: manifest.package_id, created_at: manifest.created_at, module: manifest.module, source: manifest.source, pages: draft.pages, unresolved: draft.unresolved };
  const validation = validateFrontendHandoff(document);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  // Only selected source metadata is copied; the internal absolute root and all
  // source bytes remain on the developer's machine.
  await writeNew(outputFile, validation.package);
  return { output: path.resolve(outputFile), sha256: validation.sha256, module: document.module.name, pages: document.pages.length, unresolved: document.unresolved.length };
}

export async function validateFile(file) {
  const result = validateFrontendHandoff(await fs.readFile(file, 'utf8'));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return { valid: true, sha256: result.sha256, module: result.package.module.name, pages: result.package.pages.length };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  let result;
  if (command === 'prepare' && args.length === 3) result = await prepare({ root: args[0], selectionFile: args[1], manifestFile: args[2] });
  else if (command === 'seal' && args.length === 3) result = await seal({ manifestFile: args[0], draftFile: args[1], outputFile: args[2] });
  else if (command === 'validate' && args.length === 1) result = await validateFile(args[0]);
  else throw new Error('Usage: node handoff.mjs prepare <source-root> <selection.json> <internal-manifest.json> | seal <internal-manifest.json> <draft.json> <distribution.json> | validate <distribution.json>');
  process.stdout.write(JSON.stringify(result) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
