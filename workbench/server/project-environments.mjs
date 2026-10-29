import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeAtomicJson } from './atomic-json.mjs';
import { scriptEnvironments } from './build/user-workflow.mjs';

const schema = 'workbench/project-environment-v1';
const fail = code => { throw Error(code); };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const validId = value => value === null || typeof value === 'string' && /^[\w-]{1,150}$/.test(value);

// The binding is separate from immutable target, case, plan and run records.
// A configuration change creates another revision; it never rewrites history.
export class ProjectEnvironments {
  constructor({ root, caseStore, buildManager, backendManager, busy = () => false, atomicJson = writeAtomicJson }) {
    Object.assign(this, { caseStore, buildManager, backendManager, busy, atomicJson });
    this.file = path.join(root, 'project-environments.json');
    this.queue = Promise.resolve(); this.changing = false;
  }
  async read() {
    let data;
    try { data = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { schema, revisions: [] }; fail('PROJECT_ENVIRONMENT_STORAGE_INVALID'); }
    if (data.schema !== schema || !Array.isArray(data.revisions)) fail('PROJECT_ENVIRONMENT_STORAGE_INVALID');
    const versions = new Map();
    for (const row of data.revisions) {
      if (!/^project-[a-f0-9-]{36}$/.test(row.project_id || '') || row.revision !== (versions.get(row.project_id) || 0) + 1 ||
          !validId(row.ui_environment_id) || !validId(row.backend_environment_id)) fail('PROJECT_ENVIRONMENT_STORAGE_INVALID');
      for (const kind of ['ui', 'backend']) {
        const id = row[`${kind}_environment_id`], identity = row[`${kind}_identity`];
        if (id ? identity?.environment_id !== id || !/^[a-f0-9]{64}$/i.test(identity?.configuration_sha256 || '') : identity !== null)
          fail('PROJECT_ENVIRONMENT_STORAGE_INVALID');
      }
      versions.set(row.project_id, row.revision);
    }
    return data;
  }
  async init() { await this.read(); }
  async binding(projectId) {
    if (!await this.caseStore.getProject(projectId)) fail('CASE_PROJECT_NOT_FOUND');
    return (await this.read()).revisions.filter(row => row.project_id === projectId).at(-1) ||
      { project_id: projectId, revision: 0, ui_environment_id: null, backend_environment_id: null, ui_identity: null, backend_identity: null };
  }
  async identity(projectId, kind, id) {
    if (kind === 'ui') {
      const environment = this.buildManager.developmentEnvironments.find(item => item.id === id && (!item.user_registered_target || item.project_id === projectId));
      if (!environment) fail('PROJECT_ENVIRONMENT_TARGET_INVALID');
      const trial = this.buildManager.candidateTrialEnvironments.find(item => item.id === id);
      const auth = environment.auth_requirement ? this.buildManager.authSessions.environment({ project_id: projectId, ...environment.auth_requirement }) : null;
      return { environment_id: id, configuration_sha256: digest({
        normal_url: environment.normal_url || null, fault_url: environment.fault_url || null, semantic_url: environment.semantic_url || null,
        validation_mode: environment.validation_mode || 'paired', target_scope: environment.target_scope || null,
        configuration_sha256: environment.configuration_sha256 || null, auth_requirement: environment.auth_requirement || null,
        auth, trial: trial?.configurationIdentity || null,
      }) };
    }
    if (kind !== 'backend') fail('PROJECT_ENVIRONMENT_KIND_INVALID');
    const environment = await this.backendManager.get(projectId, id);
    const { configuration_sha256, ...facts } = environment;
    if (environment.plan_id || environment.environment_id !== id || typeof configuration_sha256 !== 'string' ||
        createHash('sha256').update(JSON.stringify(facts)).digest('hex') !== configuration_sha256) fail('PROJECT_ENVIRONMENT_TARGET_INVALID');
    return { environment_id: id, configuration_sha256 };
  }
  async assert(projectId, kind, environmentId) {
    if (this.changing) fail('PROJECT_ENVIRONMENT_BUSY');
    const binding = await this.binding(projectId), id = binding[`${kind}_environment_id`];
    if (!id) fail('PROJECT_ENVIRONMENT_NOT_CONFIGURED');
    if (environmentId !== id) fail('PROJECT_ENVIRONMENT_MISMATCH');
    let current;
    try { current = await this.identity(projectId, kind, id); }
    catch { fail('PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED'); }
    if (this.changing) fail('PROJECT_ENVIRONMENT_BUSY');
    if (current.configuration_sha256 !== binding[`${kind}_identity`]?.configuration_sha256) fail('PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED');
    return binding;
  }
  async assertTask(task, projectId = task?.source?.project_id, environmentId = task?.environment_ref?.environment_id) {
    const binding = await this.assert(projectId, 'ui', environmentId);
    const frozen = task?.environment_ref?.project_environment_identity;
    if (frozen) {
      if (frozen.environment_id !== environmentId || frozen.configuration_sha256 !== binding.ui_identity.configuration_sha256)
        fail('PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED');
      return binding;
    }
    // Older registered UI tasks already froze their complete URL scope. Older
    // shared targets without such evidence remain readable but need regeneration.
    const network = task?.environment_ref?.network_policy;
    const current = this.buildManager.developmentEnvironments.find(item => item.id === environmentId);
    if (!current?.user_registered_target || !network?.configuration_sha256 ||
        network.configuration_sha256 !== current.configuration_sha256 || network.origin !== current.target_scope?.origin ||
        network.path_prefix !== current.target_scope?.path_prefix) fail('PROJECT_ENVIRONMENT_SCRIPT_REGENERATION_REQUIRED');
    return binding;
  }
  async describe(projectId) {
    const binding = await this.binding(projectId);
    const [uiCatalog, backendRecords] = await Promise.all([
      scriptEnvironments(this.buildManager, projectId, { catalog: true }), this.backendManager.all(projectId),
    ]);
    const ui_options = uiCatalog.environments, backend_options = backendRecords.filter(item => item.environment_id && !item.plan_id);
    const result = { schema, ...binding, ui_options, backend_options,
      ui: ui_options.find(item => item.id === binding.ui_environment_id) || null,
      backend: backend_options.find(item => item.environment_id === binding.backend_environment_id) || null };
    for (const kind of ['ui', 'backend']) {
      try { await this.assert(projectId, kind, binding[`${kind}_environment_id`]); result[`${kind}_status`] = 'CONFIGURED'; }
      catch (error) { result[`${kind}_status`] = error.message; }
    }
    return result;
  }
  set(projectId, input) {
    const update = async () => {
      if (!input || Object.keys(input).sort().join(',') !== 'backend_environment_id,revision,ui_environment_id' ||
          !Number.isInteger(input.revision) || input.revision < 0 || !validId(input.ui_environment_id) || !validId(input.backend_environment_id))
        fail('PROJECT_ENVIRONMENT_REQUEST_INVALID');
      this.changing = true;
      try {
        if (this.busy()) fail('PROJECT_ENVIRONMENT_BUSY');
        const previous = await this.binding(projectId);
        if (previous.revision !== input.revision) fail('PROJECT_ENVIRONMENT_REVISION_CONFLICT');
        const next = { project_id: projectId, revision: previous.revision + 1,
          ui_environment_id: input.ui_environment_id, backend_environment_id: input.backend_environment_id,
          ui_identity: input.ui_environment_id ? await this.identity(projectId, 'ui', input.ui_environment_id) : null,
          backend_identity: input.backend_environment_id ? await this.identity(projectId, 'backend', input.backend_environment_id) : null,
          updated_at: new Date().toISOString() };
        if (this.busy()) fail('PROJECT_ENVIRONMENT_BUSY');
        const data = await this.read(); data.revisions.push(next);
        await this.atomicJson(this.file, data);
      } finally { this.changing = false; }
      return this.describe(projectId);
    };
    const pending = this.queue.then(update, update); this.queue = pending.catch(() => {}); return pending;
  }
}
