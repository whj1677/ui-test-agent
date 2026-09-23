import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { redactText } from '../../../harness-probe/src/redact.mjs';

export async function dshHomeSecrets(dshHome) {
  try {
    const values = parseEnv(await fs.readFile(path.join(dshHome, '.env'), 'utf8'));
    return [values.DEEPSEEK_API_KEY].filter(Boolean);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export function harnessStderrDiagnostic(stderr, explicitSecrets = []) {
  const raw = String(stderr ?? '');
  if (!raw) return null;
  const cleaned = redactText(raw, explicitSecrets)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gi, '[REDACTED_KEY]')
    .replace(/((?:DEEPSEEK_API_KEY|api[_-]?key|auth[_-]?token|authorization|cookie|password|secret)["']?\s*[:=]\s*["']?)[^\s,"';}]+/gi, '$1[REDACTED]');
  return {
    bytes: Buffer.byteLength(raw),
    sha256: createHash('sha256').update(raw).digest('hex').toUpperCase(),
    excerpt: cleaned.slice(0, 4096),
    truncated: cleaned.length > 4096,
  };
}
