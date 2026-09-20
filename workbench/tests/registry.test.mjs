import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPaths } from '../server/paths.mjs';
import { APPROVED_SCRIPT_SHA256, buildApprovedAsset } from '../server/registry.mjs';

test('approved sorting asset is derived from the real frozen records', async () => {
  const asset = await buildApprovedAsset(createPaths(), { registeredAt: '2026-09-20T00:00:00.000Z' });
  assert.equal(asset.script.sha256, APPROVED_SCRIPT_SHA256);
  assert.equal(asset.source_commit, '744a3f7a7b775e0a89a7150babf6e5d46649de1c');
  assert.equal(asset.dependency_lock.playwright_test, '1.62.1');
  assert.deepEqual(asset.allowed_environments.map((item) => item.id), ['normal', 'fault']);
  assert.deepEqual(asset.allowed_environments[0].steps.map((item) => item.step_id), ['S01', 'S02', 'S03', 'S04']);
  assert.equal(asset.approval_basis.length, 2);
});

test('hash mismatch is rejected instead of becoming a new approval', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-registry-'));
  const changed = path.join(root, 'sorting.spec.ts');
  await fs.writeFile(changed, 'changed');
  await assert.rejects(
    buildApprovedAsset(createPaths(), { scriptPath: changed }),
    /APPROVED_SCRIPT_HASH_MISMATCH/,
  );
  await fs.rm(root, { recursive: true, force: true });
});
