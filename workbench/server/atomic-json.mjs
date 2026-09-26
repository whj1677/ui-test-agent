import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const RETRYABLE_RENAME = new Set(['EPERM', 'EACCES', 'EBUSY']);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Match the bounded Windows rename retry used by the case and build stores.
export async function writeAtomicJson(file, value, io = fs, delay = wait) {
  await io.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await io.writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx' });
  try {
    for (let attempt = 0; ; attempt += 1) {
      try { await io.rename(temporary, file); break; }
      catch (error) {
        if (!RETRYABLE_RENAME.has(error.code) || attempt >= 7) throw error;
        await delay(20 * (attempt + 1));
      }
    }
  } finally { await io.rm(temporary, { force: true }).catch(() => {}); }
}
