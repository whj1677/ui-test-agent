import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function sha256File(file) {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase();
}

export function resolveInside(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.includes('\0') || path.isAbsolute(relativePath)) {
    throw new Error('PATH_NOT_RELATIVE');
  }
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, relativePath);
  const prefix = `${absoluteRoot}${path.sep}`;
  if (resolved !== absoluteRoot && !resolved.startsWith(prefix)) throw new Error('PATH_OUTSIDE_ROOT');
  return resolved;
}

export function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
}
