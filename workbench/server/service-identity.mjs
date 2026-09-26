import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
export async function sourceFingerprint(repoRoot) {
  const files = [];
  async function walk(relative) {
    for (const entry of (await fs.readdir(path.join(repoRoot, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw Error('SOURCE_IDENTITY_SYMLINK');
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(name);
      else if (/\.(?:mjs|js|json|html|css|yml)$/.test(name)) files.push(name);
    }
  }
  for (const folder of ['workbench/server','workbench/web-v2','harness-probe/src']) await walk(folder);
  for (const name of ['package.json','package-lock.json','workbench/package.json','workbench/package-lock.json','harness-probe/package.json','harness-probe/package-lock.json']) files.push(name);
  const digest = createHash('sha256');
  for (const name of files.sort()) digest.update(name+'\0'+sha(await fs.readFile(path.join(repoRoot,name)))+'\n');
  return { source_sha256:digest.digest('hex'), source_file_count:files.length };
}

export async function createServiceIdentity({repoRoot,localRoot,instanceId,configuration}) {
  // configuration is an explicit non-secret projection supplied by the launcher.
  const source = await sourceFingerprint(repoRoot);
  return Object.freeze({schema:'workbench/service-identity-v1',service_instance_id:instanceId,
    captured_at:new Date().toISOString(),...source,configuration_sha256:sha(JSON.stringify(configuration)),
    data_root_sha256:sha(path.resolve(localRoot)),entry:'http://127.0.0.1:4322/workspace/'});
}
