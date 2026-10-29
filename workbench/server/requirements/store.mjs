import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256 } from './documents.mjs';
import { writeAtomicJsonLine as writeAtomic } from '../atomic-json.mjs';

const PROJECT_ID = /^project-[a-z0-9-]{8,80}$/;
const CASE_ID = /^case-[a-z0-9-]{8,80}$/;
const SOURCE_ID = /^source-[a-f0-9-]{36}$/;
const DESIGN_ID = /^design-[a-f0-9-]{36}$/;
const BINDING_ID = /^binding-[a-f0-9-]{36}$/;

function assertId(value, regex, code) { if (typeof value !== 'string' || !regex.test(value)) throw new Error(code); return value; }
async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
export class RequirementsStore {
  #queue = Promise.resolve();
  constructor(root) { this.root = path.resolve(root); }
  async init() { await fs.mkdir(this.root, { recursive: true }); }
  serial(operation) {
    const next = this.#queue.then(operation, operation);
    this.#queue = next.catch(() => {});
    return next;
  }
  projectRoot(projectId) {
    return path.join(this.root, assertId(projectId, PROJECT_ID, 'REQUIREMENT_PROJECT_ID_INVALID'));
  }
  sourceRoot(projectId, sourceId) {
    return path.join(this.projectRoot(projectId), 'sources', assertId(sourceId, SOURCE_ID, 'REQUIREMENT_SOURCE_ID_INVALID'));
  }
  designRoot(projectId, designId) {
    return path.join(this.projectRoot(projectId), 'designs', assertId(designId, DESIGN_ID, 'REQUIREMENT_DESIGN_ID_INVALID'));
  }
  bindingRoot(projectId, caseId) {
    return path.join(this.projectRoot(projectId), 'bindings', assertId(caseId, CASE_ID, 'BINDING_CASE_ID_INVALID'));
  }
  async createSource(projectId, source, bytes) {
    return this.serial(async () => {
      const directory = this.sourceRoot(projectId, source.snapshot_id);
      await fs.mkdir(path.dirname(directory), { recursive: true });
      await fs.mkdir(directory, { recursive: false });
      await fs.writeFile(path.join(directory, 'original.bin'), bytes, { flag: 'wx' });
      await fs.writeFile(path.join(directory, 'snapshot.json'), `${JSON.stringify(source, null, 2)}\n`, { flag: 'wx' });
      return structuredClone(source);
    });
  }
  async getSource(projectId, sourceId, { verifyBytes = true } = {}) {
    const directory = this.sourceRoot(projectId, sourceId);
    const source = await readJson(path.join(directory, 'snapshot.json'));
    if (!source) return null;
    if (source.project_id !== projectId || source.snapshot_id !== sourceId) throw new Error('REQUIREMENT_SOURCE_CORRUPT');
    if (verifyBytes) {
      const bytes = await fs.readFile(path.join(directory, 'original.bin'));
      if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) throw new Error('REQUIREMENT_SOURCE_INTEGRITY_FAILED');
    }
    return structuredClone(source);
  }
  async listSources(projectId) {
    const directory = path.join(this.projectRoot(projectId), 'sources');
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return { sources: [] }; throw error; }
    const sources = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SOURCE_ID.test(entry.name)) continue;
      const source = await this.getSource(projectId, entry.name, { verifyBytes: false });
      if (source) sources.push(source);
    }
    return { sources: sources.sort((a, b) => b.created_at.localeCompare(a.created_at)) };
  }
  async getSourceBytes(projectId, sourceId) {
    const source = await this.getSource(projectId, sourceId);
    if (!source) throw new Error('REQUIREMENT_SOURCE_NOT_FOUND');
    const bytes = await fs.readFile(path.join(this.sourceRoot(projectId, sourceId), 'original.bin'));
    if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) throw new Error('REQUIREMENT_SOURCE_INTEGRITY_FAILED');
    return bytes;
  }
  async createDesign(projectId, design) {
    return this.serial(async () => {
      const directory = this.designRoot(projectId, design.design_id);
      await fs.mkdir(path.dirname(directory), { recursive: true });
      await fs.mkdir(directory, { recursive: false });
      await fs.writeFile(path.join(directory, 'revision-1.json'), `${JSON.stringify(design, null, 2)}\n`, { flag: 'wx' });
      await writeAtomic(path.join(directory, 'current.json'), design);
      return structuredClone(design);
    });
  }
  async createBindingRevisionDesign(projectId, design, bindingId, bindingVersion) {
    return this.serial(async () => {
      const directory = this.designRoot(projectId, design.design_id);
      const existing = await this.getDesign(projectId, design.design_id);
      if (existing) {
        if (existing.revision_basis?.binding_id !== bindingId || existing.revision_basis?.binding_version !== bindingVersion) {
          throw new Error('BINDING_REVISION_DESIGN_CONFLICT');
        }
        return existing;
      }
      try { await fs.mkdir(directory, { recursive: false }); }
      catch (error) {
        if (error.code === 'ENOENT') {
          await fs.mkdir(path.dirname(directory), { recursive: true });
          await fs.mkdir(directory, { recursive: false });
        } else if (error.code === 'EEXIST') throw new Error('BINDING_REVISION_DESIGN_INCOMPLETE');
        else throw error;
      }
      await fs.writeFile(path.join(directory, 'revision-1.json'), `${JSON.stringify(design, null, 2)}\n`, { flag: 'wx' });
      await writeAtomic(path.join(directory, 'current.json'), design);
      return structuredClone(design);
    });
  }
  async createCaseRevisionDesign(projectId, design) {
    return this.serial(async () => {
      const directory = this.designRoot(projectId, design.design_id);
      const existing = await this.getDesign(projectId, design.design_id);
      if (existing) {
        if (existing.revision_basis?.mode !== 'CASE_DESIGN_CORRECTION' ||
            existing.revision_basis?.request_id !== design.revision_basis.request_id ||
            existing.revision_basis?.request_sha256 !== design.revision_basis.request_sha256) {
          throw new Error('CASE_DESIGN_REVISION_REQUEST_CONFLICT');
        }
        return { design: existing, idempotent: true };
      }
      try { await fs.mkdir(directory, { recursive: false }); }
      catch (error) {
        if (error.code === 'ENOENT') {
          await fs.mkdir(path.dirname(directory), { recursive: true });
          await fs.mkdir(directory, { recursive: false });
        } else if (error.code === 'EEXIST') throw new Error('CASE_DESIGN_REVISION_INCOMPLETE');
        else throw error;
      }
      await fs.writeFile(path.join(directory, 'revision-1.json'), `${JSON.stringify(design, null, 2)}\n`, { flag: 'wx' });
      await writeAtomic(path.join(directory, 'current.json'), design);
      return { design: structuredClone(design), idempotent: false };
    });
  }
  async getDesign(projectId, designId) {
    const design = await readJson(path.join(this.designRoot(projectId, designId), 'current.json'));
    if (!design) return null;
    if (design.project_id !== projectId || design.design_id !== designId) throw new Error('REQUIREMENT_DESIGN_CORRUPT');
    return structuredClone(design);
  }
  async listDesigns(projectId) {
    const directory = path.join(this.projectRoot(projectId), 'designs');
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return { designs: [] }; throw error; }
    const designs = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !DESIGN_ID.test(entry.name)) continue;
      const design = await this.getDesign(projectId, entry.name);
      if (design) designs.push({
        design_id: design.design_id, project_id: design.project_id, revision: design.revision,
        status: design.status, source_refs: design.source_refs, updated_at: design.updated_at,
      });
    }
    return { designs: designs.sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
  }
  async updateDesign(projectId, designId, expectedRevision, updater) {
    return this.serial(async () => {
      const current = await this.getDesign(projectId, designId);
      if (!current) throw new Error('REQUIREMENT_DESIGN_NOT_FOUND');
      if (current.revision !== expectedRevision) throw new Error('REQUIREMENT_REVISION_CONFLICT');
      const next = await updater(structuredClone(current));
      if (next.project_id !== projectId || next.design_id !== designId) throw new Error('REQUIREMENT_DESIGN_UPDATE_INVALID');
      next.revision = current.revision + 1;
      next.updated_at = new Date().toISOString();
      const directory = this.designRoot(projectId, designId);
      await fs.writeFile(path.join(directory, `revision-${next.revision}.json`), `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
      await writeAtomic(path.join(directory, 'current.json'), next);
      return structuredClone(next);
    });
  }
  async saveBinding(projectId, caseId, binding, expectedRevision) {
    return this.serial(async () => {
      const previous = await this.getBindings(projectId, caseId);
      const latest = previous.bindings.at(-1);
      if ((latest?.version || 0) !== expectedRevision) throw new Error('BINDING_REVISION_CONFLICT');
      const version = expectedRevision + 1;
      const next = { ...binding, version };
      if (!BINDING_ID.test(next.binding_id) || next.project_id !== projectId || next.case_id !== caseId) throw new Error('BINDING_ID_INVALID');
      const directory = this.bindingRoot(projectId, caseId);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, `version-${version}.json`), `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
      return structuredClone(next);
    });
  }
  async getBindings(projectId, caseId) {
    const directory = this.bindingRoot(projectId, caseId);
    let entries;
    try { entries = await fs.readdir(directory); }
    catch (error) { if (error.code === 'ENOENT') return { bindings: [] }; throw error; }
    const versions = entries.map((name) => /^version-(\d+)\.json$/.exec(name)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
    const bindings = [];
    for (const version of versions) {
      const binding = await readJson(path.join(directory, `version-${version}.json`));
      if (!binding || binding.project_id !== projectId || binding.case_id !== caseId || binding.version !== version) throw new Error('BINDING_CORRUPT');
      bindings.push(binding);
    }
    return { bindings };
  }
}

export function newSourceId() { return `source-${randomUUID()}`; }
export function newDesignId() { return `design-${randomUUID()}`; }
export function newBindingId() { return `binding-${randomUUID()}`; }
export function bindingRevisionDesignId(projectId, caseId, bindingId, version) {
  const digest = sha256(`${projectId}:${caseId}:${bindingId}:${version}`).slice(0, 32);
  return `design-${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}
export function caseRevisionDesignId(projectId, requestId) {
  const digest = sha256(`${projectId}:case-revision:${requestId}`).slice(0, 32);
  return `design-${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}
