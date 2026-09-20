import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256File } from './integrity.mjs';

export const APPROVED_SCRIPT_SHA256 = '280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A';
export const APPROVED_SOURCE_COMMIT = '744a3f7a7b775e0a89a7150babf6e5d46649de1c';
export const APPROVED_ASSET_ID = 'sorting-s02-approved-280a7875';

export async function buildApprovedAsset(paths, options = {}) {
  const scriptRelative = 'pilot/revision-s02/tests/sorting.spec.ts';
  const scriptPath = options.scriptPath || path.join(paths.repoRoot, ...scriptRelative.split('/'));
  const actualSha = await sha256File(scriptPath);
  const expectedSha = options.expectedSha || APPROVED_SCRIPT_SHA256;
  if (actualSha !== expectedSha) throw new Error(`APPROVED_SCRIPT_HASH_MISMATCH:${actualSha}`);

  const casesPath = path.join(paths.repoRoot, 'heldout-lab', 'cases.json');
  const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
  const selected = new Map(
    cases.cases.filter((item) => ['HOLD-S1', 'HOLD-S2'].includes(item.case_id)).map((item) => [item.case_id, item]),
  );
  if (!selected.has('HOLD-S1') || !selected.has('HOLD-S2')) throw new Error('APPROVED_CASES_MISSING');

  const configRelative = 'pilot/revision-s02/playwright.config.ts';
  const lockRelative = 'pilot/package-lock.json';
  const approvalFiles = [
    'pilot/revision-s02/HUMAN_REVIEW.md',
    'pilot/revision-s02/FORMAL_REGRESSION.md',
  ];
  const lock = JSON.parse(await fs.readFile(path.join(paths.repoRoot, ...lockRelative.split('/')), 'utf8'));
  const environments = [
    { id: 'normal', label: '正常入口', case_id: 'HOLD-S1', entry_url: 'http://localhost:4198/probe/s1' },
    { id: 'fault', label: '故障入口', case_id: 'HOLD-S2', entry_url: 'http://localhost:4198/probe/s2' },
  ].map((environment) => ({
    ...environment,
    steps: selected.get(environment.case_id).steps.map((step) => ({
      step_id: step.step_id,
      action: step.action,
      expected: step.expected,
    })),
  }));

  return {
    schema: 'approved-workbench/asset-v1',
    asset_id: APPROVED_ASSET_ID,
    case_id: 'HOLD-S1',
    case_version: `heldout-lab/cases.json@${APPROVED_SOURCE_COMMIT}`,
    title: selected.get('HOLD-S1').title,
    version: 'revision-s02-approved-1',
    source_commit: APPROVED_SOURCE_COMMIT,
    approval_status: 'MIGRATED_APPROVED',
    registered_at: options.registeredAt || new Date().toISOString(),
    script: { path: scriptRelative, sha256: actualSha, bytes: (await fs.stat(scriptPath)).size },
    approval_basis: await Promise.all(
      approvalFiles.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(paths.repoRoot, ...relativePath.split('/'))),
        note: '迁入既有记录；未新增或伪造真人批准。',
      })),
    ),
    configuration: {
      path: configRelative,
      sha256: await sha256File(path.join(paths.repoRoot, ...configRelative.split('/'))),
      summary: {
        browser: 'chromium', locale: 'zh-CN', viewport: { width: 1440, height: 1000 },
        timeout_ms: 120000, expect_timeout_ms: 5000, workers: 1, retries: 0,
        trace: 'on', screenshot: 'on', video: 'on',
      },
    },
    dependency_lock: {
      path: lockRelative,
      sha256: await sha256File(path.join(paths.repoRoot, ...lockRelative.split('/'))),
      lockfile_version: lock.lockfileVersion,
      playwright_test: lock.packages?.['node_modules/@playwright/test']?.version || null,
      playwright: lock.packages?.['node_modules/playwright']?.version || null,
    },
    cases_source: { path: 'heldout-lab/cases.json', sha256: await sha256File(casesPath) },
    allowed_environments: environments,
  };
}
