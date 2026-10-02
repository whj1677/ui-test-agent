import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { dataset, frozenCase, samples, startTarget, input, observations } from './scenario.mjs';
import { executeBackendCase, backendDigest } from '../../server/backend/execution.mjs';

const rows = [];
for (const [implementation, candidate] of [
  ['contains-trim', 'raw-partial'], ['equals-trim', 'raw-partial'], ['contains-no-trim', 'raw-partial'],
  ['contains-no-trim', 'caller-trim'], ['contains-trim', 'complete-id'],
]) {
  const site = await startTarget(implementation);
  try {
    const args = input(site.base, candidate);
    const result = await executeBackendCase(args);
    const file = implementation + '__' + candidate + '.json';
    await fs.writeFile(new URL(file, import.meta.url), JSON.stringify({ implementation, candidate,
      scope: 'independent synthetic HTTP target; actual production executor; not formal workbench product run',
      case_sha256: args.caseVersion.content_sha256, execution_sha256: backendDigest(args.execution),
      frozenCase, dataset, execution: args.execution, requests: site.requests, result }, null, 2) + '\n');
    rows.push({ implementation, candidate, actual_status: result.status,
      expected_status: implementation === 'contains-trim' && candidate === 'raw-partial'
        || candidate === 'caller-trim' ? 'PASSED' : 'FAILED', evidence: file,
      interpretation: candidate === 'caller-trim' ? 'FALSE_GREEN_MASKS_MISSING_SERVER_TRIM_NOT_ACCEPTED'
        : candidate === 'complete-id' ? 'UNAUTHORIZED_INPUT_REWRITE_REJECTED'
          : implementation === 'contains-trim' ? 'SYNTHETIC_LITERAL_ORACLE_SATISFIED' : 'EXPECTED_MUTANT_BUSINESS_FAILURE' });
  } finally { await site.close(); }
}
for (const row of rows) assert.equal(row.actual_status, row.expected_status);
const diagnostic = { raw_complete_id: ' BK-006 ', correct: observations(' BK-006 ').items,
  wrong_equals: observations(' BK-006 ', 'equals-trim').items,
  partial_input: samples[1].raw, matches: samples[1].records,
  note: 'Complete-ID input cannot distinguish contains from equals; old expectations and records unchanged.' };
assert.deepEqual(diagnostic.correct, diagnostic.wrong_equals);
await fs.writeFile(new URL('scenario-results.json', import.meta.url), JSON.stringify({
  status: 'BOUNDED_SYNTHETIC_ORACLE_MATRIX_EXECUTED_NOT_PRODUCT_RELEASE', rows, diagnostic,
  provider_requests: 0, paid_model_tokens: 0, model_response_replay: 'saved B and explicitly authored test doubles only',
  empty_result_pages: 'UNSPECIFIED_IN_SOURCE_NOT_ASSERTED',
  ui_pagination_reset: 'NOT_EXECUTED_BACKEND_GET_DOES_NOT_PROVE_UI_STATE_RESET',
}, null, 2) + '\n');
console.log(JSON.stringify({ matrices: rows.length, correct: rows[0].actual_status,
  equals: rows[1].actual_status, no_trim: rows[2].actual_status, model_requests: 0, workbench_started: false }));
