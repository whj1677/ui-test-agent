import fs from 'node:fs/promises';
import path from 'node:path';
import { writeAtomicJson } from './atomic-json.mjs';
import { validateFrontendHandoff } from './frontend-handoff-contract.mjs';

const REGISTRY_SCHEMA = 'workbench/frontend-handoff-registry-v1';
const PROJECT_ID = /^project-[a-z0-9-]{8,80}$/;
const HANDOFF_ID = /^handoff-[a-f0-9]{64}$/;
const fail = code => { throw Error(code); };
const names = item => new Set([item.name, ...item.aliases]);
const overlaps = (a, b) => [...names(a)].some(name => names(b).has(name));
const matches = (item, module) => typeof module === 'string' && names(item).has(module);
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };

// Packages are immutable and project-local. Activation history is separate from
// the case library, so import and toggles cannot rewrite cases or generated scripts.
export class FrontendHandoffs {
  constructor({ root, caseStore, atomicJson = writeAtomicJson }) {
    Object.assign(this, { root: path.resolve(root), caseStore, atomicJson });
    this.queue = Promise.resolve();
  }
  async init() { await fs.mkdir(this.root, { recursive: true }); }
  serial(operation) { const next = this.queue.then(operation, operation); this.queue = next.catch(() => {}); return next; }
  async directory(projectId) {
    if (!PROJECT_ID.test(projectId || '')) fail('CASE_PROJECT_ID_INVALID');
    if (!await this.caseStore.getProject(projectId)) fail('CASE_PROJECT_NOT_FOUND');
    return path.join(this.root, projectId);
  }
  async read(projectId) {
    const directory = await this.directory(projectId);
    let data;
    try { data = JSON.parse(await fs.readFile(path.join(directory, 'index.json'), 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return { schema: REGISTRY_SCHEMA, project_id: projectId, imports: [], activations: [] };
      fail('FRONTEND_HANDOFF_STORAGE_INVALID');
    }
    if (data.schema !== REGISTRY_SCHEMA || data.project_id !== projectId || !Array.isArray(data.imports) || !Array.isArray(data.activations)) fail('FRONTEND_HANDOFF_STORAGE_INVALID');
    const ids = new Set();
    for (const item of data.imports) {
      if (!HANDOFF_ID.test(item.handoff_id || '') || item.handoff_id !== `handoff-${item.sha256}` || ids.has(item.handoff_id)) fail('FRONTEND_HANDOFF_STORAGE_INVALID');
      ids.add(item.handoff_id);
    }
    for (const [index, event] of data.activations.entries()) {
      if (event.revision !== index + 1 || !ids.has(event.handoff_id) || typeof event.enabled !== 'boolean') fail('FRONTEND_HANDOFF_STORAGE_INVALID');
    }
    return data;
  }
  active(data, id) { return data.activations.filter(event => event.handoff_id === id).at(-1)?.enabled === true; }
  activate(data, id, enabled) {
    if (this.active(data, id) === enabled) return;
    data.activations.push({ revision: data.activations.length + 1, handoff_id: id, enabled, at: new Date().toISOString() });
  }
  async packageFor(projectId, data, handoffId) {
    if (!HANDOFF_ID.test(handoffId || '')) fail('FRONTEND_HANDOFF_ID_INVALID');
    const row = data.imports.find(item => item.handoff_id === handoffId);
    if (!row) fail('FRONTEND_HANDOFF_NOT_FOUND');
    const directory = await this.directory(projectId), file = path.join(directory, `${handoffId}.json`);
    let value;
    try {
      const [realDirectory, realFile] = await Promise.all([fs.realpath(directory), fs.realpath(file)]);
      if (path.dirname(realFile) !== realDirectory) fail('FRONTEND_HANDOFF_STORAGE_INVALID');
      value = await fs.readFile(realFile, 'utf8');
    } catch { fail('FRONTEND_HANDOFF_STORAGE_INVALID'); }
    const validated = validateFrontendHandoff(value);
    if (!validated.ok || validated.sha256 !== row.sha256) fail('FRONTEND_HANDOFF_STORAGE_INVALID');
    return validated.package;
  }
  summary(row, document, enabled) {
    return { handoff_id: row.handoff_id, sha256: row.sha256, imported_at: row.imported_at, enabled,
      package_id: document.package_id, created_at: document.created_at, module: document.module,
      source_revision: document.source.revision, source_snapshot_sha256: document.source.snapshot_sha256,
      page_count: document.pages.length, control_count: document.pages.reduce((sum, item) => sum + item.controls.length, 0),
      unresolved: document.unresolved };
  }
  async list(projectId) {
    const data = await this.read(projectId);
    return { project_id: projectId, revision: data.activations.length, handoffs: await Promise.all(data.imports.map(async row =>
      this.summary(row, await this.packageFor(projectId, data, row.handoff_id), this.active(data, row.handoff_id)))) };
  }
  async get(projectId, handoffId) {
    const data = await this.read(projectId), document = await this.packageFor(projectId, data, handoffId);
    const row = data.imports.find(item => item.handoff_id === handoffId);
    return { ...this.summary(row, document, this.active(data, handoffId)), package: document };
  }
  async import(projectId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['package', 'enabled'].includes(key)) ||
        (body.enabled !== undefined && typeof body.enabled !== 'boolean')) fail('FRONTEND_HANDOFF_REQUEST_INVALID');
    const validated = validateFrontendHandoff(body.package);
    if (!validated.ok) fail('FRONTEND_HANDOFF_PACKAGE_INVALID');
    const document = validated.package, sha256 = validated.sha256, handoffId = `handoff-${sha256}`, enabled = body.enabled !== false;
    return this.serial(async () => {
      const data = await this.read(projectId), directory = await this.directory(projectId);
      let row = data.imports.find(item => item.handoff_id === handoffId);
      const idempotent = Boolean(row);
      if (row) await this.packageFor(projectId, data, handoffId);
      else {
        await fs.mkdir(directory, { recursive: true });
        // wx preserves immutable packages if an interrupted previous import left
        // the content file behind. Verify that file before adding its registry row.
        const file = path.join(directory, `${handoffId}.json`);
        try { await fs.writeFile(file, JSON.stringify(document), { flag: 'wx' }); }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const existing = validateFrontendHandoff(await fs.readFile(file, 'utf8'));
          if (!existing.ok || existing.sha256 !== sha256) fail('FRONTEND_HANDOFF_STORAGE_INVALID');
        }
        row = { handoff_id: handoffId, sha256, imported_at: new Date().toISOString() };
        data.imports.push(row);
      }
      if (enabled) for (const existing of data.imports) {
        if (existing.handoff_id !== handoffId && this.active(data, existing.handoff_id) &&
            overlaps((await this.packageFor(projectId, data, existing.handoff_id)).module, document.module)) this.activate(data, existing.handoff_id, false);
      }
      this.activate(data, handoffId, enabled);
      await this.atomicJson(path.join(directory, 'index.json'), data);
      return { ...this.summary(row, document, enabled), idempotent };
    });
  }
  async setEnabled(projectId, handoffId, enabled) {
    if (typeof enabled !== 'boolean') fail('FRONTEND_HANDOFF_REQUEST_INVALID');
    return this.serial(async () => {
      const data = await this.read(projectId), document = await this.packageFor(projectId, data, handoffId);
      if (enabled) for (const row of data.imports) {
        if (row.handoff_id !== handoffId && this.active(data, row.handoff_id) &&
            overlaps((await this.packageFor(projectId, data, row.handoff_id)).module, document.module)) this.activate(data, row.handoff_id, false);
      }
      this.activate(data, handoffId, enabled);
      await this.atomicJson(path.join(await this.directory(projectId), 'index.json'), data);
      return this.summary(data.imports.find(row => row.handoff_id === handoffId), document, enabled);
    });
  }
  async getForCase(projectId, handoffId, module) {
    const value = await this.get(projectId, handoffId);
    if (!matches(value.package.module, module)) fail('FRONTEND_HANDOFF_MODULE_MISMATCH');
    return freeze({ handoff_id: value.handoff_id, sha256: value.sha256, package: value.package });
  }
  async resolveForCase(projectId, module, { handoff_id = null, disabled = false } = {}) {
    if (disabled === true) return null;
    if (disabled !== false) fail('FRONTEND_HANDOFF_REQUEST_INVALID');
    if (handoff_id !== null) return this.getForCase(projectId, handoff_id, module);
    const data = await this.read(projectId), selected = [];
    for (const row of data.imports) {
      if (!this.active(data, row.handoff_id)) continue;
      const document = await this.packageFor(projectId, data, row.handoff_id);
      if (matches(document.module, module)) selected.push(freeze({ handoff_id: row.handoff_id, sha256: row.sha256, package: document }));
    }
    if (selected.length > 1) fail('FRONTEND_HANDOFF_MODULE_AMBIGUOUS');
    return selected[0] || null;
  }
}

export async function frontendHandoffRoute({ request, response, url, manager, sendJson, readJsonBody, trustedMutation }) {
  const match = url.pathname.match(/^\/api\/case-library\/projects\/([^/]+)\/frontend-handoffs(?:\/([^/]+)(?:\/(enabled))?)?$/);
  if (!match) return false;
  if (!manager) { sendJson(response, 503, { error: 'FRONTEND_HANDOFF_SERVICE_NOT_READY' }); return true; }
  const projectId = decodeURIComponent(match[1]), handoffId = match[2] ? decodeURIComponent(match[2]) : null;
  if (request.method !== 'GET' && !trustedMutation(request)) { sendJson(response, 403, { error: 'UNTRUSTED_LOCAL_ORIGIN' }); return true; }
  let value, status = 200;
  if (request.method === 'GET' && !match[3]) value = handoffId ? await manager.get(projectId, handoffId) : await manager.list(projectId);
  else if (request.method === 'POST' && !handoffId) {
    value = await manager.import(projectId, await readJsonBody(request, 512 * 1024)); status = value.idempotent ? 200 : 201;
  } else if (request.method === 'POST' && match[3] === 'enabled') {
    const body = await readJsonBody(request);
    if (!body || Object.keys(body).join(',') !== 'enabled') fail('FRONTEND_HANDOFF_REQUEST_INVALID');
    value = await manager.setEnabled(projectId, handoffId, body.enabled);
  } else { sendJson(response, 404, { error: 'FRONTEND_HANDOFF_ROUTE_NOT_FOUND' }); return true; }
  sendJson(response, status, value);
  return true;
}
