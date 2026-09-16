// Optional transport for hosts whose shell cannot keep a writable stdin handle.
// Only JSONL commands live on disk. Authentication remains in the session's memory.
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export async function* commandFileLines(project, file, { idleMs = 0, maxCommands = 200, now = Date.now } = {}) {
  // Zero leaves session termination to the explicit close command / consumer.
  if (typeof idleMs !== 'number' || !Number.isFinite(idleMs) || idleMs < 0) throw new Error('SESSION_IDLE_INVALID');
  const root = path.resolve(project, '.session'); const target = path.resolve(project, file);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('SESSION_COMMAND_PATH_INVALID');
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, '', { flag: 'wx', mode: 0o600 });
  let consumed = Buffer.alloc(0); let lastCommand = now(); let count = 0;
  while (idleMs === 0 || now() - lastCommand < idleMs) {
    const bytes = await fs.readFile(target);
    if (bytes.length > 1024 * 1024 || !bytes.subarray(0, consumed.length).equals(consumed)) throw new Error('SESSION_COMMAND_FILE_CHANGED');
    let offset = consumed.length;
    for (;;) {
      const end = bytes.indexOf(10, offset); if (end < 0) break;
      const line = bytes.subarray(offset, end).toString('utf8').replace(/\r$/, ''); offset = end + 1;
      if (!line.trim()) continue;
      if (++count > maxCommands) throw new Error('SESSION_COMMAND_BUDGET_EXHAUSTED');
      consumed = bytes.subarray(0, offset); lastCommand = now();
      yield line;
      // A long execute operation is active work, not an idle command channel.
      lastCommand = now();
    }
    if (offset > consumed.length) consumed = bytes.subarray(0, offset);
    await sleep(200);
  }
  throw new Error('SESSION_IDLE_TIMEOUT');
}
