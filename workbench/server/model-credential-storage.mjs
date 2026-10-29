import fs from 'node:fs/promises';
import path from 'node:path';

const credentialName = 'deepseek-api-key.dpapi';
const absolute = value => typeof value === 'string' && path.isAbsolute(value);

// Never infer a missing USERPROFILE from this process when an explicit
// environment was supplied. In particular, fixtures must stay isolated.
export function modelCredentialPaths(environment = process.env) {
  const candidates = [];
  if (absolute(environment.USERPROFILE)) candidates.push({
    location: 'user-profile', file: path.join(environment.USERPROFILE, '.ui-test-agent', 'credentials', credentialName),
  });
  if (absolute(environment.LOCALAPPDATA)) candidates.push({
    location: 'legacy-localappdata', file: path.join(environment.LOCALAPPDATA, 'ui-test-agent', 'credentials', credentialName),
  });
  return candidates;
}

export function modelCredentialWritePath(environment = process.env) {
  const selected = modelCredentialPaths(environment)[0];
  if (!selected) throw Error('MODEL_CREDENTIAL_STORAGE_PATH_REQUIRED');
  return selected.file;
}

// Metadata only: enablement and startup use the same selection without
// decrypting, copying or silently replacing a credential. Only ENOENT falls back.
export async function locateModelCredential({ environment = process.env, stat = fs.lstat } = {}) {
  for (const candidate of modelCredentialPaths(environment)) {
    let info;
    try { info = await stat(candidate.file); }
    catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw Error('MODEL_CREDENTIAL_DPAPI_UNAVAILABLE');
    }
    if (!info.isFile() || info.isSymbolicLink?.() || info.size < 1 || info.size > 64 * 1024) {
      throw Error('MODEL_CREDENTIAL_DPAPI_INVALID');
    }
    return { ...candidate, bytes: info.size };
  }
  return null;
}
