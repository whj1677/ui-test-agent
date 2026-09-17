import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hash, semanticHash } from './common.mjs';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Governance scripts are maintenance-only and are not distributed to testers.
const runtimeDirectories = ['src', 'public', 'vendor'];
const runtimeFiles = [
  'package.json',
  'package-lock.json',
  '启动.cmd',
  '启动.ps1',
  '停止.cmd',
  '停止.ps1',
  '安装.cmd',
  '安装.ps1',
  '环境检查.cmd',
  '环境检查.ps1',
  '恢复启动.cmd',
  '恢复启动.ps1',
  '备份数据.cmd',
  '备份数据.ps1',
  'requirements-import.txt',
];

async function directoryFiles(root, directory) {
  let entries;
  try {
    entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
    const relative = directory + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error('BUILD_SYMLINK_UNSUPPORTED');
    if (entry.isDirectory()) files.push(...(await directoryFiles(root, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

// Content identity excludes user data, credentials, reports and maintenance tests.
// It changes when any shipped runtime or dependency definition changes.
export async function readBuildInfo(root = APP_ROOT) {
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const files = [];
  for (const directory of runtimeDirectories)
    files.push(...(await directoryFiles(root, directory)));
  for (const file of runtimeFiles) {
    try {
      await fs.access(path.join(root, file));
      files.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT' || ['package.json', 'package-lock.json'].includes(file))
        throw error;
    }
  }
  const sources = [];
  for (const file of files.sort()) {
    sources.push({ file, sha256: hash(await fs.readFile(path.join(root, file))) });
  }
  return {
    schema_version: 'ui-agent-build/v1',
    application: 'ui-test-agent',
    version: metadata.version,
    build_id: semanticHash(sources),
    sources,
  };
}

export function dataDirectoryId(directory) {
  const absolute = path.resolve(directory);
  return hash(process.platform === 'win32' ? absolute.toLowerCase() : absolute);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const build = await readBuildInfo();
  const directory = process.env.UI_AGENT_DATA_DIR || path.join(APP_ROOT, 'data', 'v02');
  process.stdout.write(JSON.stringify({ ...build, data_directory_id: dataDirectoryId(directory) }));
}
