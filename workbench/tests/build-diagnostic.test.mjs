import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { dshHomeSecrets, harnessStderrDiagnostic } from '../server/build/diagnostic.mjs';

test('Harness stderr diagnostic keeps error context and redacts credentials', () => {
  const diagnostic = harnessStderrDiagnostic('Error: launch failed\nDEEPSEEK_API_KEY=sk-abc123456789xyz\nBearer xyz123\n', []);
  assert.match(diagnostic.excerpt, /Error: launch failed/);
  assert.doesNotMatch(diagnostic.excerpt, /abc123456789xyz|Bearer xyz123/);
  assert.equal(diagnostic.bytes > 0, true);
  assert.equal(diagnostic.truncated, false);
});

test('stored DSH credential is redacted even without a sk prefix', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-diagnostic-'));
  try {
    await fs.writeFile(path.join(root, '.env'), 'DEEPSEEK_API_KEY=unusualSyntheticCredential\n');
    const secrets = await dshHomeSecrets(root);
    const diagnostic = harnessStderrDiagnostic('Error: unusualSyntheticCredential rejected', secrets);
    assert.doesNotMatch(diagnostic.excerpt, /unusualSyntheticCredential/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
