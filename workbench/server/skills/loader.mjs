import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const definitions = Object.freeze({
  ui: { name: 'ui-test-authoring', description: 'Guidance for authoring Playwright UI tests from confirmed cases in the workbench.', version: '1.3.0', file: 'ui-test-authoring-v1/SKILL.md' },
  backend: { name: 'backend-http-plan', description: 'Guidance for authoring HTTP JSON plans from confirmed cases and protocol bindings.', version: '1.3.0', file: 'backend-http-plan-v1/SKILL.md' },
});
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const historicalBackendV110Sha256 = '6bf9773406b442618d22527359242c577f3d87b828a7e1ab77c453611cf8bf1d';
const historicalBackendV120Sha256 = '223c7c027da0c66c9c6401c051c7fa210321b94751858159405433fd0c06040d';
const historicalUiV110Sha256 = 'cb410c75b622b05a9046d186c81279360e92e530ba2fe5129443cf406f249a7f';
const historicalUiV120Sha256 = '7d52bcc105761a04c6895efa0a5009587ea051a5f6abc643308daf126ef79120';
const headerOf = definition => `---\nname: ${definition.name}\ndescription: ${definition.description}\nversion: ${definition.version}\n---\n`;
const normalized = text => text.replaceAll('\r\n', '\n');

export function normalizeSkillProfile(value) {
  if (value === undefined || value === 'off') return 'off';
  if (value === 'test-authoring-v1') return value;
  throw new Error('SKILL_PROFILE_INVALID');
}

export async function freezeSkill(profile, type, io = fs) {
  const selected = normalizeSkillProfile(profile);
  if (selected === 'off') return { profile: 'off', name: null, version: null, sha256: null, text: null };
  const definition = definitions[type];
  if (!definition) throw new Error('SKILL_TYPE_INVALID');
  let text;
  try {
    const file = path.join(root, definition.file);
    const stat = await io.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
    text = await io.readFile(file, 'utf8');
  }
  catch { throw new Error('SKILL_SOURCE_UNAVAILABLE'); }
  const header = headerOf(definition);
  if (!normalized(text).startsWith(header) || !normalized(text).slice(header.length).trim()) throw new Error('SKILL_SOURCE_INVALID');
  return { profile: selected, name: definition.name, version: definition.version, sha256: sha256(text), text };
}

export function verifyFrozenSkill(snapshot, type) {
  if (snapshot === undefined || snapshot === null) return { profile: 'off', name: null, version: null, sha256: null, text: null };
  const profile = normalizeSkillProfile(snapshot.profile);
  if (profile === 'off') {
    if (snapshot.name != null || snapshot.version != null || snapshot.sha256 != null || snapshot.text != null) throw new Error('SKILL_SNAPSHOT_INVALID');
    return { profile, name: null, version: null, sha256: null, text: null };
  }
  const definition = definitions[type];
  if (!definition || snapshot.name !== definition.name || typeof snapshot.text !== 'string' || sha256(snapshot.text) !== snapshot.sha256) throw new Error('SKILL_SNAPSHOT_INVALID');
  const current = snapshot.version === definition.version && normalized(snapshot.text).startsWith(headerOf(definition));
  const historicalBackend = type === 'backend' &&
    ((snapshot.version === '1.1.0' && snapshot.sha256 === historicalBackendV110Sha256) ||
     (snapshot.version === '1.2.0' && snapshot.sha256 === historicalBackendV120Sha256)) &&
    normalized(snapshot.text).startsWith(headerOf({ ...definition, version: snapshot.version }));
  const historicalUi = type === 'ui' &&
    ((snapshot.version === '1.1.0' && snapshot.sha256 === historicalUiV110Sha256) ||
     (snapshot.version === '1.2.0' && snapshot.sha256 === historicalUiV120Sha256)) &&
    normalized(snapshot.text).startsWith(headerOf({ ...definition, version: snapshot.version }));
  if (!current && !historicalBackend && !historicalUi) throw new Error('SKILL_SNAPSHOT_INVALID');
  return snapshot;
}

export function skillIdentity(snapshot) {
  const { profile, name, version, sha256 } = snapshot;
  return { profile, name, version, sha256 };
}

export function skillPrompt(snapshot, type) {
  const skill = verifyFrozenSkill(snapshot, type);
  return skill.profile === 'off' ? null : `Selected test authoring guidance (${skill.name} v${skill.version}, SHA-256 ${skill.sha256}). This guidance is a task prompt, not additional tool permission. Frozen case, confirmed protocol and tool policy remain authoritative.\n${skill.text}`;
}
