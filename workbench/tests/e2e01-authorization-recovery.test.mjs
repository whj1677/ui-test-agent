import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildTaskStore, E2E01_PROJECT_CASE_AUTHORIZATION_ID } from '../server/build/store.mjs';

test('E2E-01 recovery adds one start while retaining all six original claims', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e01-recovery-'));
  try {
    const store = new BuildTaskStore(root, { authorizationId: E2E01_PROJECT_CASE_AUTHORIZATION_ID });
    await store.init();
    const projectId = 'project-12345678';
    const cases = [
      ['TC-001', 'test-site-01-query-v1'],
      ['TC-002', 'test-site-01-sorting-v1'],
      ['TC-003', 'test-site-01-detail-v1'],
    ];
    await store.registerE2E01Authorization({
      schema: 'workbench/e2e01-build-authorization-v1',
      authorization_id: E2E01_PROJECT_CASE_AUTHORIZATION_ID,
      kind: 'initial-with-optional-revision', linked_stage: 'E2E-01', project_id: projectId,
      max_starts: 6, used_starts: 0, claims: [],
      scopes: cases.map(([externalId, environmentId], index) => ({
        project_id: projectId, case_id: `case-1234567${index}`, external_id: externalId,
        case_version: 1, content_sha256: 'A'.repeat(64), environment_id: environmentId,
      })),
      limits: { max_tool_calls: 30, timeout_ms: 600_000 },
    });
    for (let index = 0; index < 6; index += 1) {
      await store.claimRevalidationStart(E2E01_PROJECT_CASE_AUTHORIZATION_ID, `build-original-${index}`, 'attempt-01-initial', '2026-09-23T00:00:00Z');
    }
    const recovered = await store.extendE2E01RuntimeRecovery('2026-09-23T01:00:00Z');
    assert.equal(recovered.max_starts, 7);
    assert.equal(recovered.used_starts, 6);
    assert.equal(recovered.claims.length, 6);
    assert.deepEqual(await store.extendE2E01RuntimeRecovery('2026-09-23T02:00:00Z'), recovered);
    const last = await store.claimRevalidationStart(E2E01_PROJECT_CASE_AUTHORIZATION_ID, 'build-revision-12345678', 'attempt-02-revision', '2026-09-23T03:00:00Z');
    assert.equal(last.used_starts, 7);
    assert.equal(last.claims.length, 7);
    await assert.rejects(() => store.claimRevalidationStart(E2E01_PROJECT_CASE_AUTHORIZATION_ID, 'build-extra-12345678', 'attempt-01-initial', '2026-09-23T04:00:00Z'), /EXHAUSTED/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
