// Separate user-confirmed supplements from immutable imported case text.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function applyConfirmedExpectations(importedBytes, supplementBytes) {
  const imported = JSON.parse(importedBytes);
  if (!supplementBytes) return { imported, confirmations: {}, sha256: null };
  let supplement;
  try { supplement = JSON.parse(supplementBytes); } catch { fail('CONFIRMED_EXPECTATIONS_INVALID'); }
  if (supplement.schema_version !== 'manual-ui-confirmed-expectations/v1' || supplement.case_import_sha256 !== digest(importedBytes) || !Array.isArray(supplement.confirmations)) fail('CONFIRMED_EXPECTATIONS_BASELINE_INVALID');
  const confirmations = {};
  for (const record of supplement.confirmations) {
    if (!record || typeof record.case_id !== 'string' || Object.hasOwn(confirmations, record.case_id) || record.status !== 'CONFIRMED' || typeof record.source !== 'string' || !record.source.trim() || !Array.isArray(record.steps) || !record.steps.length) fail('CONFIRMED_EXPECTATIONS_INVALID');
    const item = imported.cases.find(c => c.case_id === record.case_id);
    if (!item || item.business_expectation_missing !== true) fail('CONFIRMED_EXPECTATIONS_NOT_MISSING');
    const seen = new Set();
    for (const entry of record.steps) {
      if (!entry || seen.has(entry.step_id) || typeof entry.expected !== 'string' || !entry.expected.trim()) fail('CONFIRMED_EXPECTATIONS_INVALID');
      seen.add(entry.step_id);
      const step = item.steps.find(s => s.step_id === entry.step_id);
      if (!step || String(step.expected ?? '').trim()) fail('CONFIRMED_EXPECTATIONS_NOT_MISSING');
      step.expected = entry.expected.trim();
      // The importer uses this placeholder when no observation was supplied.
      const observation = String(step.observation ?? "").trim();
      if (!observation || observation === "待确认观察方式") step.observation = step.expected;
    }
    if (item.steps.some(s => !String(s.expected ?? '').trim())) fail('CONFIRMED_EXPECTATIONS_INCOMPLETE');
    item.business_expectation_missing = false;
    item.import_status = item.import_issues?.length ? 'NEEDS_MAPPING' : 'IMPORTED';
    confirmations[record.case_id] = structuredClone(record);
  }
  return { imported, confirmations, sha256: digest(supplementBytes) };
}

export async function loadConfirmedExpectations(project, importedBytes) {
  let bytes;
  try { bytes = await fs.readFile(path.join(project, 'cases', 'confirmed-expectations.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return applyConfirmedExpectations(importedBytes, bytes);
}

export function assertSameRetryExpectations(previous, current, caseIds) {
  for (const id of caseIds) if (JSON.stringify(previous?.[id] ?? null) !== JSON.stringify(current?.[id] ?? null)) fail('REPAIR_EXPECTATION_BASELINE_CHANGED');
}
