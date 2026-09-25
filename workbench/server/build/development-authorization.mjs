import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEVELOPMENT_LIMITS, digest } from './development-session.mjs';

const fileOf = store => path.join(store.root, 'development-authorizations.json');
// Explicit opt-in for new exploratory work. Existing receipts and defaults remain unchanged.
export const EXPLORATORY_LIMITS = Object.freeze({ self_tests: 10, revisions: 9, tool_calls: 360, harness_starts: 3, wall_ms: 30 * 60_000 });
export function authorizationLimits(entry) {
  if (entry.budget_profile && !['standard', 'exploratory'].includes(entry.budget_profile)) throw new Error('DEVELOPMENT_BUDGET_PROFILE_INVALID');
  const ceiling = entry.budget_profile === 'exploratory' ? EXPLORATORY_LIMITS : DEVELOPMENT_LIMITS;
  const limits = { ...ceiling, ...entry.limits };
  if (Object.entries(limits).some(([key, value]) => !(key in ceiling) || !Number.isInteger(value) || value < 1 || value > ceiling[key])) throw new Error('DEVELOPMENT_LIMITS_MAY_ONLY_REDUCE');
  return limits;
}
async function read(store) { try { return JSON.parse(await fs.readFile(fileOf(store), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return { schema: 'workbench/development-authorizations-v1', entries: [] }; throw error; } }
async function write(store, value) {
  const temporary = fileOf(store) + `.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await fs.rename(temporary, fileOf(store));
}
export async function registerDevelopmentAuthorization(store, entry) {
  return store.serial(async () => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(entry.logical_id) || !entry.project_id || !entry.case_id || !Number.isInteger(entry.case_version) || !/^[A-F0-9]{64}$/.test(entry.content_sha256) || !entry.environment_id || !['recovery', 'new'].includes(entry.mode)) throw new Error('DEVELOPMENT_AUTHORIZATION_INVALID');
    if (entry.mode === 'recovery' && (!entry.seed_code || digest(entry.seed_code) !== entry.seed_sha256)) throw new Error('RECOVERY_SEED_REQUIRED');
    const current = await read(store);
    if (current.entries.some(item => item.logical_id === entry.logical_id)) throw new Error('DEVELOPMENT_AUTHORIZATION_ALREADY_EXISTS');
    const limits = authorizationLimits(entry);
    current.entries.push({ ...entry, limits, task_id: null, registered_at: new Date().toISOString() });
    await write(store, current);
  });
}
export async function claimDevelopmentAuthorization(store, logicalId, taskId, validate = null) {
  return store.serial(async () => {
    const current = await read(store); const entry = current.entries.find(item => item.logical_id === logicalId);
    if (!entry) throw new Error('DEVELOPMENT_NOT_AUTHORIZED');
    if (entry.task_id) throw new Error('DEVELOPMENT_LOGICAL_TASK_ALREADY_CLAIMED:' + entry.task_id);
    if (validate) await validate(structuredClone(entry));
    entry.task_id = taskId; entry.claimed_at = new Date().toISOString(); await write(store, current);
    return structuredClone(entry);
  });
}
export async function developmentAuthorizations(store) {
  const current = await read(store);
  return current.entries.map(({ seed_code, seed_sha256, ...entry }) => entry);
}
