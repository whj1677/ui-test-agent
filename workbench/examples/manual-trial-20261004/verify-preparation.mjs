import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../../server/service-identity.mjs';
const here = new URL('./', import.meta.url), base = 'http://127.0.0.1:4322';
const digest = v => createHash('sha256').update(Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const get = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw Error('READ_FAILED:' + r.status); return r.json(); };
const receipt = JSON.parse(await fs.readFile(new URL('preparation.json', here), 'utf8'));
const prior = JSON.parse(await fs.readFile(new URL('old-projects-before.json', here), 'utf8'));
const prefix = base + '/api/case-library/projects/' + receipt.project_id;
const health = await get(base + '/api/health'), project = await get(prefix);
const sources = (await get(prefix + '/requirements/sources')).sources;
const designs = (await get(prefix + '/requirements/designs')).designs;
const records = (await get(prefix + '/execution-records')).records;
const targets = (await get(prefix + '/targets')).targets;
const backend = await get(prefix + '/backend');
let baseline = null, targetHealth = null, targetState = 'NEEDS_USER_START';
try {
  targetHealth = await get('http://127.0.0.1:4401/health');
  baseline = await get('http://127.0.0.1:4401/__control/baseline');
  targetState = 'READY';
} catch (error) {
  if (error.cause?.code !== 'ECONNREFUSED') throw error;
}
const oldChanged = [];
for (const row of prior.projects) if (digest(await get(base + '/api/case-library/projects/' + row.project_id)) !== row.sha256) oldChanged.push(row.project_id);
const source = await sourceFingerprint(fileURLToPath(new URL('../../../', here)));
const provenance = [];
for (const name of ['CASES.md','PROTOCOL.md','fixture/server.mjs','fixture/ledger.html']) {
  const file = new URL('../../qa/20260926-req0038-completion/' + name, here);
  provenance.push({ path: 'workbench/qa/20260926-req0038-completion/' + name, sha256: digest(await fs.readFile(file)) });
}
const verification = { at: new Date().toISOString(), project_id: project.project_id, official_status: health.status,
  loaded_source_matches_disk: source.source_sha256 === health.service_identity.source_sha256,
  source_count: sources.length, source_read_statuses: sources.map(s => [s.file_name, s.read_status, s.document_status]),
  cases: project.cases.length, designs: designs.length, runs: records.length, backend_plans: backend.plans.length,
  ui_target_ready: targets.length === 1 && targets[0].ready === true, backend_environments: backend.environments.length,
  target_state: targetState, target_service: targetHealth?.service || null, public_baseline: baseline,
  prior_project_count: prior.projects.length, prior_projects_changed: oldChanged,
  business_generation: 'NOT_RUN', business_execution: 'NOT_RUN', source_provenance: provenance,
  target_start: { current: targetState === 'READY' ? 'user foreground terminal reported; target identity verified' : 'needs user foreground start', previous_exec_session_id: 62343,
    first_background_attempt: 'automatic approval rejected Start-Process; no background service created' } };
await fs.writeFile(new URL('verification.json', here), JSON.stringify(verification, null, 2) + '\n');
if (verification.official_status !== 'ready' || !verification.loaded_source_matches_disk || verification.source_count !== 3 ||
    verification.cases || verification.designs || verification.runs || verification.backend_plans || oldChanged.length ||
    verification.backend_environments !== 1 || targetState === 'READY' && (!verification.ui_target_ready ||
    targetHealth.service !== 'req0038-synthetic-ledger' ||
    digest(baseline.items) !== digest([{code:'DEV-001',name:'循环泵一号',site:'东站',ratedPowerKw:80}]) || baseline.total !== 1)) throw Error('PREPARATION_CHECK_FAILED');
console.log(JSON.stringify({ project_id: project.project_id, sources: sources.length, target_state: targetState, backend_configuration_ready: true,
  cases: 0, plans: 0, runs: 0, old_projects_unchanged: true, business_model_calls: 0 }));
