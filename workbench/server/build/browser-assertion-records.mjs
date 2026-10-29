import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateBrowserAssertionObligations } from './browser-assertion-contract.mjs';

export function applyBrowserAssertionVerdict(result, evidence, caseContent) {
  const obligations = evaluateBrowserAssertionObligations(caseContent, evidence);
  if (!obligations.configured || obligations.status === 'COVERED') return result;
  return { ...result, complete_pass: false, test_status: 'FAILED',
    browser_assertion_obligations: obligations,
    error: !result.complete_pass && result.error ? result.error : { code: 'FROZEN_BROWSER_ASSERTION_REQUIREMENT_FAILED', obligations } };
}

// These records prove only invoked, bounded checks. An empty list never proves
// that the frozen case has no network or persistence obligations.
export async function readBrowserAssertionEvidence(runDirectory, identity) {
  const file = path.join(runDirectory, 'artifacts', 'step-evidence', 'browser-assertions.ndjson');
  let bytes;
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 512 * 1024) throw Error('BROWSER_ASSERTION_RECORD_LIMIT');
    bytes = await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'NOT_USED', records: [], semantic_approval: false };
    throw error;
  }
  let records;
  try { records = bytes.toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
  catch { throw Error('BROWSER_ASSERTION_RECORD_INVALID'); }
  if (!identity?.run_id || !records.length || records.length > 100 || records.some(record =>
    record.schema !== 'workbench/browser-assertion-evidence-v1' || !['PASSED', 'FAILED', 'UNKNOWN'].includes(record.status) ||
    (record.step_order !== null && (!Number.isSafeInteger(record.step_order) || record.step_order < 1)) ||
    ['run_id', 'candidate_sha256', 'candidate_bundle_sha256', 'executed_case_id', 'executed_case_version', 'executed_content_sha256']
      .some(key => identity[key] !== undefined && record[key] !== identity[key]))) throw Error('BROWSER_ASSERTION_RECORD_IDENTITY_INVALID');
  return { status: records.every(record => record.status === 'PASSED') ? 'CHECKS_PASSED' : 'CHECKS_NOT_PASSED',
    sha256: createHash('sha256').update(bytes).digest('hex'), records, semantic_approval: false,
    scope: 'Only these invoked checks in this run; no whole-case semantic approval or hidden server activity proof.' };
}
