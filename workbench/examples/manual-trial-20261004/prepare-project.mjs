// Only prepare raw sources through the existing 4322 API. No model/test start routes.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectDocument } from '../../server/requirements/documents.mjs';
import { validateBackendEnvironment } from '../../server/backend/schema.mjs';
const base = 'http://127.0.0.1:4322';
const folder = new URL('./', import.meta.url);
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
async function request(route, options = {}) {
  const res = await fetch(base + route, { ...options, headers: { Origin: base, ...options.headers }, signal: AbortSignal.timeout(10000) });
  const value = await res.json();
  if (!res.ok) throw Error(`${res.status}: ${value.error || route}`);
  return value;
}
const save = (name, value, flag = 'wx') => fs.writeFile(new URL(name, folder), JSON.stringify(value, null, 2) + '\n', { flag });
const health = await request('/api/health');
if (health.status !== 'ready' || health.accepting !== true || health.preparing || health.requirements?.active || health.backend ||
    Object.entries(health).some(([key, value]) => /^active_/.test(key) && value)) throw Error('OFFICIAL_WORKBENCH_NOT_IDLE_READY');
const definitions = [['PRD', '01-PRD.md'], ['MRD', '02-MRD.md'], ['PROTOCOL', '03-PROTOCOL.md']];
const docs = [];
for (const [kind, fileName] of definitions) {
  const body = await fs.readFile(new URL(fileName, folder));
  const inspected = inspectDocument({ kind, fileName, body });
  if (!inspected.segments.length || inspected.issues.length) throw Error('SOURCE_NOT_FULLY_READABLE:' + fileName);
  docs.push({ kind, fileName, body, sha256: inspected.sha256, segments: inspected.segments.length });
}
validateBackendEnvironment(JSON.parse(await fs.readFile(new URL('backend-environment.json', folder), 'utf8')));
let prior;
try { prior = JSON.parse(await fs.readFile(new URL('project-created.json', folder), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
let before;
try { before = JSON.parse(await fs.readFile(new URL('old-projects-before.json', folder), 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const list = (await request('/api/case-library/projects')).projects;
  before = { captured_at: new Date().toISOString(), projects: await Promise.all(list.map(async p => ({ project_id: p.project_id,
    sha256: digest(await request('/api/case-library/projects/' + p.project_id)) }))) };
  await save('old-projects-before.json', before);
}
const project = prior ? await request('/api/case-library/projects/' + prior.project_id) : await request('/api/case-library/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    name: '手动体验 · 设备台账 · 20261004',
    description: '本地公开合成练习：正常新增、重复编号拒绝、viewer拒绝。原始PRD/MRD/协议已准备，资料待操作者核对；用例、脚本和执行由用户自行操作。被测站点4401，正式工作台4322；不代表真实业务或发布验收。',
  }),
});
if (project.name !== '手动体验 · 设备台账 · 20261004') throw Error('PREPARED_PROJECT_IDENTITY_CHANGED');
if (!prior) await save('project-created.json', { project_id: project.project_id, name: project.name, created_at: project.created_at });
const path = '/api/case-library/projects/' + project.project_id;
let sources = (await request(path + '/requirements/sources')).sources;
for (const doc of docs) {
  const matches = sources.filter(s => s.file_name === doc.fileName);
  if (matches.length) {
    if (matches.length !== 1 || matches[0].sha256 !== doc.sha256) throw Error('PREPARED_SOURCE_CONFLICT:' + doc.fileName);
    continue;
  }
  const source = await request(path + '/requirements/sources', { method: 'POST', headers: {
    'Content-Type': 'application/octet-stream', 'x-file-name': encodeURIComponent(doc.fileName),
    'x-source-kind': doc.kind, 'x-document-version': 'v1', 'x-document-status': 'REVIEW_DRAFT',
  }, body: doc.body });
  sources.push(source);
}
const final = await request(path);
const designs = await request(path + '/requirements/designs');
const records = await request(path + '/execution-records');
const changed = [];
for (const p of before.projects) if (digest(await request('/api/case-library/projects/' + p.project_id)) !== p.sha256) changed.push(p.project_id);
const receipt = { at: new Date().toISOString(), project_id: project.project_id,
  project_url: base + '/workspace/#/projects/' + project.project_id + '/requirements', target_url: 'http://127.0.0.1:4401/ledger/',
  prepared_sources: sources.map(s => ({ snapshot_id: s.snapshot_id, kind: s.kind, file_name: s.file_name,
    sha256: s.sha256, read_status: s.read_status, document_status: s.document_status, model_analysis_status: s.model_analysis_status })),
  offline_parse: docs.map(d => ({ kind: d.kind, file_name: d.fileName, segments: d.segments })),
  cases: final.cases.length, designs: designs.designs?.length ?? designs.length ?? 0, runs: records.records.length,
  previous_project_count: before.projects.length, previous_projects_changed: changed,
  business_model_calls: 0, business_executions: 0, boundary: 'Preparation only; no cases approved, model generation or business execution.' };
await save('preparation.json', receipt, 'w');
if (receipt.cases || receipt.designs || receipt.runs || changed.length) throw Error('PREPARATION_BOUNDARY_CHANGED: inspect preparation.json');
console.log(JSON.stringify({ project_id: receipt.project_id, project_url: receipt.project_url, sources: sources.length,
  cases: receipt.cases, designs: receipt.designs, runs: receipt.runs, old_projects_unchanged: changed.length === 0 }));
