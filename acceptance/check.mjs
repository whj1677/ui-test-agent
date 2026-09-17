import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function verifyManifest() {
  const manifest = JSON.parse(await readFile(path.join(root, 'acceptance/manifest.json'), 'utf8'));
  if (manifest.schema_version !== 'ui-fixture-freeze/v1' || manifest.case_count !== 24)
    throw new Error('Invalid freeze schema');
  const entries = Object.entries(manifest.files);
  if (entries.length < 15) throw new Error('Incomplete freeze');
  for (const [relative, expected] of entries) {
    const resolved = path.resolve(root, relative);
    if (
      !resolved.startsWith(root + path.sep) ||
      relative.includes('..') ||
      !/^[a-f0-9]{64}$/.test(expected)
    )
      throw new Error('Invalid freeze entry');
    const actual = createHash('sha256')
      .update(await readFile(resolved))
      .digest('hex');
    if (actual !== expected) throw new Error(`FIXTURE_DRIFT: ${relative}`);
  }
  return {
    status: 'fixture-freeze-verified',
    files: entries.length,
    cases: manifest.case_count,
    scope: 'synthetic artifacts only; not Agent execution',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(JSON.stringify(await verifyManifest()));
