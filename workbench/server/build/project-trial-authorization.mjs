import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { writeAtomicJson } from '../atomic-json.mjs';
import { resolveTrialCandidate } from './candidate-trials.mjs';
import { contentHash } from '../cases/excel.mjs';

const schema = 'workbench/project-trial-authorizations-v1';
const selectionKeys = ['project_id','case_id','case_version','content_sha256','source_task_id','candidate_version','bundle_sha256','environment_id'];
const identity = value => Object.fromEntries(selectionKeys.map(key => [key, value[key]]));
const same = (a, b) => selectionKeys.every(key => a[key] === b[key]);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();

export class ProjectTrialAuthorization {
  constructor({ root, buildManager, caseStore, atomicJson = writeAtomicJson }) {
    Object.assign(this, { root, buildManager, caseStore, atomicJson });
    this.file = path.join(root, 'project-trial-authorizations.json');
    this.queue = Promise.resolve();
    this.entries = [];
  }
  serial(fn) { const next = this.queue.then(fn, fn); this.queue = next.catch(() => {}); return next; }
  async read() {
    try {
      const value = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (value.schema !== schema || !Array.isArray(value.entries)) throw Error('PROJECT_TRIAL_AUTHORIZATION_STORE_INVALID');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { schema, entries: [] };
      throw error;
    }
  }
  async save(entries = this.entries) { await this.atomicJson(this.file, { schema, entries }); }
  async current(entry) {
    const project = await this.caseStore.getProject(entry.project_id);
    const item = project?.cases.find(row => row.case_id === entry.case_id);
    const version = item?.versions.find(row => row.version === entry.case_version);
    if (!version || item.current_version !== entry.case_version || version.content_sha256 !== entry.content_sha256 ||
        contentHash(version.content) !== entry.content_sha256 || version.content.status !== 'CONFIRMED') return false;
    const task = await this.buildManager.store.getTask(entry.source_task_id).catch(() => null);
    const candidate = task?.candidates?.find(row => row.version === entry.candidate_version);
    if (!task || task.source?.project_id !== entry.project_id || task.source?.case_id !== entry.case_id ||
        task.source?.case_version !== entry.case_version || task.source?.content_sha256 !== entry.content_sha256 ||
        task.environment_ref?.environment_id !== entry.environment_id || !candidate ||
        candidate.bundle?.sha256 !== entry.bundle_sha256 || candidate.sha256 !== entry.candidate_code_sha256 ||
        task.candidates.at(-1)?.version !== candidate.version) return false;
    const environment = this.buildManager.candidateTrialEnvironments.find(row => row.id === entry.environment_id);
    return environment?.configurationIdentity?.kind === 'registered-user-target' &&
      environment.configurationIdentity.configuration_sha256 === entry.environment_configuration_sha256 &&
      environment.configurationIdentity.project_id === entry.project_id &&
      task.environment_ref?.network_policy?.origin === environment.configurationIdentity.origin &&
      task.environment_ref?.network_policy?.path_prefix === environment.configurationIdentity.path_prefix;
  }
  async init() {
    this.entries = (await this.read()).entries;
    const ids = new Set();
    for (const entry of this.entries) {
      if (!entry.authorization_id || ids.has(entry.authorization_id) || !selectionKeys.every(key => typeof entry[key] === (key.endsWith('version') ? 'number' : 'string')) ||
          !entry.operator || entry.schema !== 'workbench/project-trial-authorization-v1' ||
          entry.confirmation !== 'LOCAL_OPERATOR_AUTHORIZED_THIS_EXACT_CANDIDATE_FOR_NON_PRODUCTION_TECHNICAL_TRIAL' ||
          typeof entry.authorized_at !== 'string' || typeof entry.authorization_sha256 !== 'string' ||
          !/^[A-F0-9]{64}$/.test(entry.environment_configuration_sha256 || '') ||
          !/^[A-F0-9]{64}$/.test(entry.candidate_code_sha256 || '') ||
          entry.invalidated_at !== null && typeof entry.invalidated_at !== 'string' ||
          entry.budget?.model_calls !== 0 || entry.budget?.candidate_runs_per_batch !== 1 ||
          entry.budget?.scope !== 'EXACT_CANDIDATE_NORMAL_LANE' ||
          entry.authorization_sha256 !== digest({ selection: identity(entry), environment_configuration_sha256: entry.environment_configuration_sha256,
            candidate_code_sha256: entry.candidate_code_sha256 })) throw Error('PROJECT_TRIAL_AUTHORIZATION_STORE_INVALID');
      ids.add(entry.authorization_id);
      if (entry.invalidated_at == null && await this.current(entry)) this.#install(entry);
    }
  }
  #install(entry) {
    if (!this.buildManager.candidateTrialAuthorizations.some(row => row.user_authorization_id === entry.authorization_id)) {
      this.buildManager.candidateTrialAuthorizations.push({ ...identity(entry), lanes: ['normal'],
        user_authorization_id: entry.authorization_id, environment_configuration_sha256: entry.environment_configuration_sha256,
        authorization_source: 'EXPLICIT_LOCAL_OPERATOR_TECHNICAL_TRIAL' });
    }
  }
  async authorize(projectId, body) {
    return this.serial(async () => {
      const selection = identity(body?.selection || {});
      if (!projectId || selection.project_id !== projectId || body?.confirm_technical_trial !== true ||
          typeof body?.operator !== 'string' || !body.operator.trim() || body.operator.length > 120 ||
          Object.keys(body?.selection || {}).some(key => !selectionKeys.includes(key))) throw Error('PROJECT_TRIAL_AUTHORIZATION_CONFIRMATION_REQUIRED');
      if (Object.values(selection).some(value => value === undefined) || !Number.isInteger(selection.case_version) ||
          !Number.isInteger(selection.candidate_version) || !/^[A-F0-9]{64}$/.test(selection.content_sha256 || '') ||
          !/^[A-F0-9]{64}$/.test(selection.bundle_sha256 || '')) throw Error('PROJECT_TRIAL_SELECTION_INVALID');
      const { task, candidate, version, environment } = await resolveTrialCandidate(this.buildManager,
        { ...selection, lane: 'normal', diagnostic: true }, false);
      const currentProject = await this.caseStore.getProject(projectId);
      const selectedCase = currentProject?.cases.find(item => item.case_id === selection.case_id);
      if (selectedCase?.current_version !== selection.case_version) throw Error('PROJECT_TRIAL_CASE_VERSION_EXPIRED');
      if (task.candidates.at(-1)?.version !== candidate.version) throw Error('PROJECT_TRIAL_CANDIDATE_EXPIRED');
      if (environment?.configurationIdentity?.kind !== 'registered-user-target' ||
          environment.configurationIdentity.project_id !== projectId) throw Error('PROJECT_TRIAL_ENVIRONMENT_NOT_USER_REGISTERED');
      const target = await this.buildManager.projectTargetAccess?.get(projectId, selection.environment_id);
      if (!target || target.configuration_sha256 !== environment.configurationIdentity.configuration_sha256) throw Error('PROJECT_TARGET_CONFIGURATION_CHANGED');
      if (version.content.status !== 'CONFIRMED') throw Error('CASE_CONTENT_NOT_CONFIRMED');
      const prior = this.entries.find(entry => same(entry, selection) && entry.environment_configuration_sha256 === target.configuration_sha256);
      if (prior && await this.current(prior)) return prior;
      const entry = { schema: 'workbench/project-trial-authorization-v1', authorization_id: `trial-auth-${randomUUID()}`,
        ...selection, environment_configuration_sha256: target.configuration_sha256,
        candidate_code_sha256: candidate.sha256, authorization_sha256: digest({ selection, environment_configuration_sha256: target.configuration_sha256,
          candidate_code_sha256: candidate.sha256 }), operator: body.operator.trim(),
        confirmation: 'LOCAL_OPERATOR_AUTHORIZED_THIS_EXACT_CANDIDATE_FOR_NON_PRODUCTION_TECHNICAL_TRIAL',
        budget: { model_calls: 0, candidate_runs_per_batch: 1, scope: 'EXACT_CANDIDATE_NORMAL_LANE' },
        authorized_at: new Date().toISOString(), invalidated_at: null };
      const nextEntries = [...this.entries, entry];
      await this.save(nextEntries);
      this.entries = nextEntries;
      this.#install(entry);
      return structuredClone(entry);
    });
  }
  async match(selection, configurationSha256) {
    const entry = this.entries.find(row => same(row, selection) && row.environment_configuration_sha256 === configurationSha256 &&
      row.invalidated_at == null);
    if (!entry || !(await this.current(entry))) return null;
    return entry;
  }
  async list(projectId) {
    const rows = await Promise.all(this.entries.filter(entry => entry.project_id === projectId).map(async entry => ({
      ...entry, current: await this.current(entry),
    })));
    return { authorizations: rows };
  }
}
