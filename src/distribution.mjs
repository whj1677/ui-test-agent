import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ROOT, readBuildInfo } from './build-info.mjs';
import { hash } from './common.mjs';

function candidateFiles(build) {
  return [...build.sources.map((source) => source.file), '试用说明.md'].sort();
}

// Validate the complete inventory before reading any manifest-supplied path.
// This detects damaged local packages, not a malicious publisher or concurrent filesystem swaps.
export async function verifyCandidate(root, manifest, build) {
  try {
    build ??= await readBuildInfo(root);
    const expected = new Set(candidateFiles(build));
    if (
      !manifest ||
      manifest.schema_version !== 'ui-agent-release/v1' ||
      manifest.application !== build.application ||
      manifest.version !== build.version ||
      manifest.build_id !== build.build_id ||
      manifest.release_status !== 'PENDING_ACCEPTANCE' ||
      !Array.isArray(manifest.files) ||
      manifest.files.length !== expected.size
    )
      throw new Error('INVALID_MANIFEST');
    for (const entry of manifest.files) {
      if (
        !entry ||
        typeof entry.file !== 'string' ||
        /[\\:\x00-\x1f]/.test(entry.file) ||
        entry.file.split('/').some((part) => !part || part === '.' || part === '..') ||
        !expected.delete(entry.file) ||
        typeof entry.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)
      )
        throw new Error('INVALID_INVENTORY');
    }
    for (const entry of manifest.files) {
      const parts = entry.file.split('/');
      let target = path.resolve(root);
      for (let index = 0; index < parts.length; index++) {
        target = path.join(target, parts[index]);
        const stat = await fs.lstat(target);
        if (
          stat.isSymbolicLink() ||
          (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())
        )
          throw new Error('INVALID_FILE_TYPE');
      }
      if (hash(await fs.readFile(target)) !== entry.sha256) throw new Error('FILE_CHANGED');
    }
    return { file_count: manifest.files.length };
  } catch {
    // A missing listed file is a broken candidate, not a checkout without a manifest.
    throw Object.assign(new Error('CANDIDATE_INTEGRITY_FAILED'), {
      code: 'CANDIDATE_INTEGRITY_FAILED',
    });
  }
}

// Explicit allowlist: never traverse the workspace, data directories or credentials.
export async function createCandidate(destination, root = APP_ROOT) {
  const build = await readBuildInfo(root);
  const files = candidateFiles(build);
  await fs.mkdir(destination); // A different candidate always receives a fresh directory.
  const manifest = [];
  for (const file of files.sort()) {
    const bytes = await fs.readFile(path.join(root, file));
    const target = path.join(destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
    manifest.push({ file, sha256: hash(bytes) });
  }
  const copied = await readBuildInfo(destination);
  if (copied.build_id !== build.build_id) throw new Error('SOURCE_CHANGED_DURING_PACKAGING');
  const release = {
    schema_version: 'ui-agent-release/v1',
    application: build.application,
    version: build.version,
    build_id: build.build_id,
    release_status: 'PENDING_ACCEPTANCE',
    files: manifest,
  };
  await fs.writeFile(
    path.join(destination, 'release-manifest.json'),
    JSON.stringify(release, null, 2),
    { flag: 'wx' },
  );
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const destination = process.argv[2];
  if (!destination) throw new Error('DESTINATION_REQUIRED');
  const result = await createCandidate(path.resolve(destination));
  console.log(
    JSON.stringify({
      directory: path.resolve(destination),
      version: result.version,
      build_id: result.build_id,
      release_status: result.release_status,
    }),
  );
}
