import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const RETRYABLE_RENAME = new Set(['EPERM', 'EACCES', 'EBUSY']);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function writeAtomicJson(file, value, io = fs, delay = wait) {
  return writeJson(file, value, io, delay, '');
}

// Existing record stores retain their newline-terminated JSON byte format.
export async function writeAtomicJsonLine(file, value, io = fs, delay = wait) {
  return writeJson(file, value, io, delay, '\n');
}

async function writeJson(file, value, io, delay, suffix) {
  await io.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const content = JSON.stringify(value, null, 2);
  await io.writeFile(temporary, suffix ? `${content}${suffix}` : content, { flag: 'wx' });
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
