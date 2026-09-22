import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { contentHash } from '../cases/excel.mjs';

export const HOLD_Q1_ENVIRONMENT_ID = 'heldout-query-q1-v1';
export const HOLD_Q1_CASE_ID = 'HOLD-Q1';
export const HOLD_Q1_COUNTEREXAMPLE_CASE_ID = 'HOLD-Q2';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

export function holdQ1Content(sourceCase) {
  if (sourceCase?.case_id !== HOLD_Q1_CASE_ID || !Array.isArray(sourceCase.preconditions) || !Array.isArray(sourceCase.steps)) {
    throw new Error('HOLD_Q1_SOURCE_INVALID');
  }
  return {
    external_id: sourceCase.case_id,
    title: sourceCase.title,
    module: '无登录合成列表查询',
    preconditions: JSON.stringify(sourceCase.preconditions, null, 2),
    test_data: JSON.stringify({
      source_side: sourceCase.source_side,
      page_entry_url: sourceCase.page_entry_url,
      read_only_scope: sourceCase.read_only_scope,
      synthetic_login: sourceCase.synthetic_login,
      data: sourceCase.data,
    }, null, 2),
    steps: sourceCase.steps.map((step, index) => ({
      order: index + 1,
      action: step.action,
      expected: step.expected,
    })),
    status: 'CONFIRMED',
  };
}

export async function loadHoldQ1Source(paths) {
  const casesPath = path.join(paths.repoRoot, 'heldout-lab', 'cases.json');
  const oraclePath = path.join(paths.repoRoot, 'heldout-lab', 'oracle.json');
  const fixturePath = path.join(paths.repoRoot, 'heldout-lab', 'index.html');
  const [casesText, oracleText] = await Promise.all([
    fs.readFile(casesPath, 'utf8'),
    fs.readFile(oraclePath, 'utf8'),
    fs.access(fixturePath),
  ]);
  const sourceCase = JSON.parse(casesText).cases?.find((item) => item.case_id === HOLD_Q1_CASE_ID);
  const fault = JSON.parse(oracleText).cases?.find((item) => item.case_id === HOLD_Q1_COUNTEREXAMPLE_CASE_ID);
  if (!sourceCase || sourceCase.page_entry_url !== 'http://localhost:4198/probe/q1' ||
      !fault || fault.expected_result !== 'FAIL_ASSERTION' || fault.failing_step_id !== 'S03') {
    throw new Error('HOLD_Q1_FROZEN_SOURCE_MISMATCH');
  }
  const content = holdQ1Content(sourceCase);
  return {
    sourceCase,
    content,
    content_sha256: contentHash(content),
    fixturePath,
    source: {
      cases_sha256: sha256(casesText),
      oracle_sha256: sha256(oracleText),
      case_id: HOLD_Q1_CASE_ID,
      counterexample_case_id: HOLD_Q1_COUNTEREXAMPLE_CASE_ID,
    },
    fault: {
      failing_step_id: fault.failing_step_id,
      business_field: fault.business_field,
      expected: fault.expected,
      actual: fault.actual,
    },
  };
}

export async function holdQ1CasePackage(paths, { packageId = 'case-package-hold-q1-m4a' } = {}) {
  const loaded = await loadHoldQ1Source(paths);
  return {
    schema: 'workbench/case-package-v1',
    package_id: packageId,
    exported_at: new Date().toISOString(),
    source_project: { project_id: 'heldout-lab', name: 'heldout-lab frozen cases', revision: 1 },
    cases: [{
      package_case_id: `${HOLD_Q1_CASE_ID}@${loaded.source.cases_sha256}`,
      source_version: 1,
      root_source: {
        kind: 'heldout-case-json',
        stable_id: `heldout-lab/cases.json#${HOLD_Q1_CASE_ID}`,
        source_sha256: loaded.source.cases_sha256,
      },
      lineage: [{ source: 'heldout-lab/cases.json', case_id: HOLD_Q1_CASE_ID, source_sha256: loaded.source.cases_sha256 }],
      content: loaded.content,
    }],
  };
}
