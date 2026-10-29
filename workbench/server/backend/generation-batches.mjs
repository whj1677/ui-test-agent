import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeAtomicJson } from '../atomic-json.mjs';
import { preparationDigest } from './protocol-preparation.mjs';

const copy = value => structuredClone(value);
const now = () => new Date().toISOString();
export class BackendGenerationBatches {
  constructor(manager) { this.manager = manager; this.root = path.join(manager.root, 'generation-batches'); this.queue = Promise.resolve(); this.writeQueue = Promise.resolve(); this.active = null; this.backgroundError = null; }
  serial(fn) { const task = this.queue.then(fn, fn); this.queue = task.catch(() => {}); return task; }
  file(id) { if (!/^generation-[a-f0-9-]{36}$/.test(id || '')) throw Error('BACKEND_GENERATION_BATCH_ID_INVALID'); return path.join(this.root, `${id}.json`); }
  async save(batch) { const snapshot = copy(batch); const operation = async () => { this.manager.writable(); try { await writeAtomicJson(this.file(snapshot.batch_id), snapshot); } catch (error) { this.manager.storageFault ||= 'BACKEND_GENERATION_BATCH_WRITE_FAILED'; throw error; } return snapshot; }; const next = this.writeQueue.then(operation, operation); this.writeQueue = next.catch(() => {}); return next; }
  async get(project, id) { const batch = JSON.parse(await fs.readFile(this.file(id), 'utf8')); if (batch.project_id !== project) throw Error('BACKEND_GENERATION_BATCH_PROJECT_MISMATCH'); return batch; }
  async list(project) { await fs.mkdir(this.root, { recursive: true }); const rows = await Promise.all((await fs.readdir(this.root)).filter(file => /^generation-[a-f0-9-]{36}\.json$/.test(file)).map(async file => JSON.parse(await fs.readFile(path.join(this.root, file), 'utf8')))); return rows.filter(row => !project || row.project_id === project).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  async init() { for (const batch of await this.list()) if (['QUEUED', 'RUNNING', 'STOPPING'].includes(batch.state)) { batch.state = 'INTERRUPTED'; batch.finished_at = now(); for (const row of batch.items) if (['QUEUED', 'GENERATING'].includes(row.state)) { row.state = 'NOT_RUN'; row.reason = 'SERVICE_INTERRUPTED_NO_REPLAY'; } await this.save(batch); } }
  async create(project, input) { return this.serial(async () => {
    const manager = this.manager; manager.writable();
    if (!/^[-\w]{8,100}$/.test(input.request_id || '')) throw Error('BACKEND_GENERATION_REQUEST_ID_REQUIRED');
    const requestSha = preparationDigest(input);
    const previous = (await this.list(project)).find(batch => batch.request_id === input.request_id);
    if (previous) { if (previous.request_sha256 !== requestSha) throw Error('BACKEND_GENERATION_REQUEST_CONFLICT'); return previous; }
    if (input.confirm_protocol_analysis !== true || input.allow_model !== true || input.allow_http_self_test !== true || typeof input.reviewer !== 'string' || !input.reviewer.trim() || input.reviewer.length > 120) throw Error('BACKEND_GENERATION_AUTH_REQUIRED');
    if (this.active || manager.active || manager.otherActive()) throw Error('WORKBENCH_BUSY');
    // Reserve across preparation, binding confirmation and gaps between generated plans.
    const owner = { project_id: project, cancelled: false }; this.active = owner; manager.generationBatchActive = owner;
    try {
      const preparation = await manager.preparation(project, { protocol_source_id: input.protocol_source_id });
      if (preparation.preparation_sha256 !== input.preparation_sha256) throw Error('BACKEND_PREPARATION_STALE');
      if (!preparation.model_available) throw Error('BACKEND_MODEL_AUTH_REQUIRED');
      if (!['wall_ms', 'tool_calls', 'harness_starts', 'self_tests'].every(key => Number.isFinite(preparation.generation_limits?.[key]) && preparation.generation_limits[key] > 0)) throw Error('BACKEND_GENERATION_LIMITS_REQUIRED');
      if (!preparation.items.some(row => row.status === 'READY')) throw Error('BACKEND_GENERATION_NO_READY_CASES');
      const batch = { schema: 'workbench/backend-generation-batch-v1', batch_id: `generation-${randomUUID()}`, project_id: project, request_id: input.request_id, request_sha256: requestSha,
        state: 'QUEUED', created_at: now(), reviewer: input.reviewer.trim(), preparation_sha256: preparation.preparation_sha256,
        protocol_source_id: preparation.protocol_source_id, protocol_sha256: preparation.protocol_sha256, environment_id: preparation.environment_id, environment_sha256: preparation.environment_sha256,
        items: preparation.items.map(row => ({ ...row, state: row.status === 'READY' ? 'QUEUED' : row.status === 'EXISTS' ? 'EXISTS' : 'BLOCKED', reason: row.missing[0]?.code || null })) };
      owner.batch = batch; await this.save(batch);
      this.completion = this.execute(batch, owner).finally(() => { if (this.active === owner) this.active = null; if (manager.generationBatchActive === owner) manager.generationBatchActive = null; });
      void this.completion.catch(error => { this.backgroundError = /^[A-Z_]+$/.test(error.message) ? error.message : 'BACKEND_GENERATION_BATCH_FAILED'; });
      return copy(batch);
    } catch (error) { this.active = null; manager.generationBatchActive = null; throw error; }
  }); }
  async execute(batch, owner) {
    const manager = this.manager;
    try {
      batch.state = 'RUNNING'; await this.save(batch);
      for (const row of batch.items) {
        if (row.state !== 'QUEUED') continue;
        if (owner.cancelled) { row.state = 'NOT_RUN'; row.reason = 'BACKEND_GENERATION_BATCH_CANCELLED'; continue; }
        try {
          const preparation = await manager.preparation(batch.project_id, { protocol_source_id: batch.protocol_source_id });
          const current = preparation.items.find(item => item.case_id === row.case_id);
          if (!current || current.case_version !== row.case_version || current.content_sha256 !== row.content_sha256 || preparation.protocol_sha256 !== batch.protocol_sha256 || preparation.environment_id !== batch.environment_id || preparation.environment_sha256 !== batch.environment_sha256) throw Error('BACKEND_GENERATION_IDENTITY_CHANGED');
          if (current.expected_binding_revision !== row.expected_binding_revision || current.binding_version !== row.binding_version || preparationDigest(current.mappings) !== preparationDigest(row.mappings)) throw Error('BACKEND_GENERATION_BINDING_CHANGED');
          if (current.status !== 'READY') throw Error(current.missing[0]?.code || 'BACKEND_GENERATION_NOT_READY');
          let bindingVersion = current.binding_version;
          if (!bindingVersion) {
            const binding = await manager.requirementsManager.createBinding(batch.project_id, { caseId: row.case_id, caseVersion: row.case_version, caseContentSha256: row.content_sha256,
              protocolSourceId: batch.protocol_source_id, mappings: current.mappings, expectedRevision: current.expected_binding_revision, confirmation: 'CONFIRM', reviewer: batch.reviewer });
            bindingVersion = binding.version;
          }
          if (owner.cancelled) { row.state = 'NOT_RUN'; row.reason = 'BACKEND_GENERATION_BATCH_CANCELLED'; continue; }
          const { bindings } = await manager.requirementsManager.getBindings(batch.project_id, row.case_id);
          const binding = bindings.find(entry => entry.version === bindingVersion);
          if (!binding || bindings.at(-1)?.version !== bindingVersion) throw Error('BACKEND_GENERATION_BINDING_CHANGED');
          owner.expectation = { case_id: row.case_id, case_version: row.case_version, content_sha256: row.content_sha256, protocol_source_id: batch.protocol_source_id,
            protocol_sha256: batch.protocol_sha256, environment_id: batch.environment_id, environment_sha256: batch.environment_sha256, binding_version: bindingVersion, mappings_sha256: preparationDigest(binding.mappings) };
          const plan = await manager.create(batch.project_id, { case_id: row.case_id, case_version: row.case_version, binding_version: bindingVersion, environment_id: batch.environment_id,
            request_mode: 'generate', generate: true, allow_model: true }, owner);
          row.plan_id = plan.plan_id; row.binding_version = bindingVersion; row.state = 'GENERATING'; await this.save(batch);
          await manager.completion;
          const done = await manager.get(batch.project_id, plan.plan_id); row.state = done.state; row.reason = done.error || null;
        } catch (error) { row.state = owner.cancelled ? 'NOT_RUN' : 'BLOCKED'; row.reason = /^[A-Z][A-Z0-9_]{4,100}$/.test(error.message) ? error.message : 'BACKEND_GENERATION_FAILED'; }
        await this.save(batch);
      }
      batch.state = owner.cancelled ? 'CANCELLED' : 'FINISHED';
    } catch (error) { batch.state = 'INTERRUPTED'; batch.error = 'BACKEND_GENERATION_BATCH_INTERRUPTED'; for (const row of batch.items) if (['GENERATING', 'QUEUED'].includes(row.state)) { row.state = 'NOT_RUN'; row.reason = batch.error; } }
    batch.finished_at = now(); await this.save(batch);
  }
  async cancel(project, id) {
    const batch = await this.get(project, id);
    if (['FINISHED', 'CANCELLED', 'INTERRUPTED'].includes(batch.state)) return batch;
    if (this.active?.batch?.batch_id === id && ['FINISHED', 'CANCELLED', 'INTERRUPTED'].includes(this.active.batch.state)) { await this.completion; return this.get(project, id); }
    if (this.active?.batch?.batch_id !== id) throw Error('BACKEND_GENERATION_BATCH_NOT_ACTIVE');
    this.active.cancelled = true; this.active.batch.state = 'STOPPING';
    if (this.manager.active?.project_id === project) this.manager.active.controller.abort();
    await this.save(this.active.batch); await this.completion; return this.get(project, id);
  }
  async shutdown() { if (this.active) { this.active.cancelled = true; this.manager.active?.controller.abort(); await this.completion; } }
}
