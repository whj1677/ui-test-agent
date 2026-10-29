import path from 'node:path';

export function formalEntry(externalId) {
  if (typeof externalId !== 'string' || !/^[\w.-]{1,160}$/.test(externalId)) throw Error('NATIVE_DSH_CASE_ID_INVALID');
  return `specs/${externalId}.spec.mjs`;
}

export function normalizedEntry(entry) {
  if (typeof entry !== 'string' || !entry || entry.includes('\0')) throw Error('NATIVE_DSH_ENTRY_INVALID');
  const portable = entry.replaceAll('\\', '/');
  if (path.posix.isAbsolute(portable) || /^[a-z]:/i.test(portable)) throw Error('NATIVE_DSH_ENTRY_INVALID');
  const normalized = path.posix.normalize(portable);
  if (normalized === '..' || normalized.startsWith('../')) throw Error('NATIVE_DSH_ENTRY_INVALID');
  return normalized;
}

export function executionPurpose(input, item) {
  const purpose = input.purpose ?? 'case';
  if (!['case', 'diagnostic'].includes(purpose)) throw Error('NATIVE_DSH_PURPOSE_INVALID');
  const entry = normalizedEntry(input.entry);
  if (purpose === 'case' && entry !== (item.formal_entry || formalEntry(item.external_id))) throw Error('NATIVE_DSH_FORMAL_ENTRY_MISMATCH');
  return { purpose, entry, counts_for_case: purpose === 'case' };
}
