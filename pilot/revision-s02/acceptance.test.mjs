import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

const repo = new URL('../../', import.meta.url);
async function run(args) {
  const child = spawn(process.execPath, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  return { code, stdout, stderr };
}

test('generator candidate source and S02 static contract', async () => {
  const result = await run(['--test', 'pilot/revision-s02/verify-candidate.test.mjs']);
  assert.equal(result.code, 0, result.stdout + result.stderr);
});

test('same candidate passes normal engineering fixture and rejects extra row in S02', async () => {
  const result = await run(['pilot/revision-s02/run-engineering-check.mjs']);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const summary = JSON.parse(await fs.readFile(new URL('../private/revision-s02/engineering/summary.json', import.meta.url), 'utf8'));
  assert.equal(summary.normal.exit_code, 0);
  assert.equal(summary.extra_row.exit_code, 1);
  assert.equal(summary.extra_row_has_expected_count_3_actual_4, true);
  assert.equal(summary.s02_error_present, true);
  assert.equal(summary.s03_started, false);
  assert.equal(summary.model_calls, 0);
  assert.equal(summary.retries, 0);
});
