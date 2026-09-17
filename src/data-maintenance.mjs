import fs from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fail, now, uid } from './common.mjs';

const guardName = '.maintenance.lock';

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function requireNoMaintenance(root) {
  if (await exists(path.join(root, guardName))) fail('DATA_MAINTENANCE_ACTIVE', 409);
}

async function withMaintenance(root, action) {
  await fs.mkdir(root, { recursive: true });
  const guard = path.join(root, guardName);
  let handle;
  try {
    handle = await fs.open(guard, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') fail('DATA_MAINTENANCE_ACTIVE', 409);
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ id: uid(), pid: process.pid, at: now() }));
    await handle.sync();
    return await action();
  } finally {
    await handle.close();
    await fs.unlink(guard);
  }
}

function requireDeadProcess(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) fail('WRITER_OWNER_UNVERIFIED', 409);
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') return;
    // Permission failures and PID reuse are never evidence of a dead owner.
    fail('WRITER_OWNER_UNVERIFIED', 409);
  }
  fail('WRITER_STILL_RUNNING', 409);
}

// Explicit operator action. Ordinary startup never removes an existing lock.
// The guard also excludes another recovery and a concurrent new server startup.
export async function recoverDeadWriter(root) {
  return withMaintenance(root, async () => {
    const lock = path.join(root, '.writer.lock');
    if (!(await exists(lock))) return { status: 'NO_LOCK' };
    const original = await fs.readFile(lock);
    let owner;
    try {
      owner = JSON.parse(original);
    } catch {
      fail('WRITER_OWNER_UNVERIFIED', 409);
    }
    if (owner.schema_version !== 'ui-agent-writer-lock/v1' || typeof owner.id !== 'string')
      fail('WRITER_OWNER_UNVERIFIED', 409);
    requireDeadProcess(owner.pid);
    const archive = path.join(root, 'maintenance', 'recovery-' + uid() + '.json');
    await fs.mkdir(path.dirname(archive), { recursive: true });
    await fs.writeFile(
      archive,
      JSON.stringify(
        { at: now(), source: 'LOCAL_OPERATOR', owner, status: 'DEAD_OWNER_CONFIRMED' },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    // Retain all task states, receipts and pending cleanup. Only the dead process lock goes.
    if (!(await fs.readFile(lock)).equals(original)) fail('DATA_DIRECTORY_LOCK_CHANGED', 409);
    await fs.unlink(lock);
    return { status: 'RECOVERED', archive };
  });
}

function requireOutside(source, destination) {
  const relative = path.relative(source, destination);
  if (
    !relative ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  )
    fail('BACKUP_INSIDE_DATA_DIRECTORY');
}

async function copyTree(source, destination, relative = '') {
  const manifest = [];
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (!relative && [guardName, '.writer.lock'].includes(entry.name)) continue;
    if (entry.isSymbolicLink()) fail('BACKUP_SYMLINK_UNSUPPORTED');
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    const name = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      await fs.mkdir(to);
      manifest.push(...(await copyTree(from, to, name)));
    } else if (entry.isFile()) {
      await fs.copyFile(from, to, constants.COPYFILE_EXCL);
      // Recordings can be large. Hash the copy as a stream instead of buffering it.
      const digest = createHash('sha256');
      for await (const chunk of createReadStream(to)) digest.update(chunk);
      manifest.push({ file: name, sha256: digest.digest('hex') });
    }
  }
  return manifest;
}

export async function backupData(root, destination) {
  const source = await fs.realpath(root);
  // Resolve the real parent, so a junction cannot turn an outside path into a nested copy.
  const target = path.join(
    await fs.realpath(path.dirname(path.resolve(destination))),
    path.basename(destination),
  );
  requireOutside(source, target);
  return withMaintenance(source, async () => {
    if (await exists(path.join(source, '.writer.lock'))) fail('BACKUP_REQUIRES_STOP', 409);
    await fs.mkdir(target); // Never merge or overwrite an existing backup.
    const data = path.join(target, 'data');
    await fs.mkdir(data);
    const files = await copyTree(source, data);
    const manifest = { schema_version: 'ui-agent-backup/v1', at: now(), files };
    await fs.writeFile(
      path.join(target, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2),
      { flag: 'wx' },
    );
    return { status: 'BACKED_UP', directory: target, file_count: files.length };
  });
}
