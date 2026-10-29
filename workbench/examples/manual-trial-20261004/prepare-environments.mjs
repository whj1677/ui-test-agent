// Prepare only the publicly synthetic, user-requested target configuration.
import fs from 'node:fs/promises';
const root = new URL('./', import.meta.url), base = 'http://127.0.0.1:4322';
const prepared = JSON.parse(await fs.readFile(new URL('preparation.json', root), 'utf8'));
const prefix = '/api/case-library/projects/' + prepared.project_id;
async function api(route, body) {
  const response = await fetch(base + route, { method: body ? 'POST' : 'GET',
    headers: { Origin: base, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  const value = await response.json(); if (!response.ok) throw Error(value.error || route); return value;
}
const targetHealth = await fetch('http://127.0.0.1:4401/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
if (targetHealth.service !== 'req0038-synthetic-ledger') throw Error('SYNTHETIC_TARGET_IDENTITY_MISMATCH');
const operator = 'Codex（按用户选择准备公开合成练习）';
const targets = (await api(prefix + '/targets')).targets;
let ui = targets.find(t => t.entry_url === prepared.target_url && t.path_prefix === '/');
if (!ui) ui = await api(prefix + '/targets', { name: '设备台账 · 本次合成练习 UI', entry_url: prepared.target_url,
  path_prefix: '/', operator, confirm_non_production: true });
const listed = await api(prefix + '/backend');
let backend = listed.environments.find(e => e.base_url === 'http://127.0.0.1:4401' && e.mode === 'synthetic-namespace');
if (!backend) backend = await api(prefix + '/backend/environments', { name: '设备台账 · 本次合成 namespace',
  base_url: 'http://127.0.0.1:4401', mode: 'synthetic-namespace', reviewer: operator, non_production: true, authorized: true });
const result = { at: new Date().toISOString(), project_id: prepared.project_id, user_scope: 'User selected local synthetic project preparation.',
  ui_environment_id: ui.environment_id || ui.target?.environment_id, backend_environment_id: backend.environment_id,
  ui: await api(prefix + '/targets'), backend: await api(prefix + '/backend'),
  models_started: 0, business_runs_started: 0, note: 'Only target configuration. No exact candidate trial authorization or plan/case confirmation.' };
await fs.writeFile(new URL('environments.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ui_environments: result.ui.targets.length, backend_environments: result.backend.environments.length,
  ready: result.ui.targets.every(t => t.ready), models_started: 0, business_runs_started: 0 }));
