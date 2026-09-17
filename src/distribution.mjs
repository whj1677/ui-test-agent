import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ROOT, readBuildInfo } from './build-info.mjs';
import { hash } from './common.mjs';

// Explicit allowlist: never traverse the workspace, data directories or credentials.
export async function createCandidate(destination, root = APP_ROOT) {
  const build = await readBuildInfo(root);
  const files = [...build.sources.map((source) => source.file), '试用说明.md'];
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
