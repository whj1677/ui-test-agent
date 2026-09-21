import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInside } from '../integrity.mjs';

const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY']);
const PROJECT_ID = /^project-[a-z0-9-]{8,80}$/;
const CASE_ID = /^case-[a-z0-9-]{8,80}$/;

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}

async function writeJsonAtomic(file, value, io = fs) {
  await io.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await io.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    for (let attempt = 0; ; attempt += 1) {
      try { await io.rename(temporary, file); break; }
      catch (error) {
        if (!RETRYABLE.has(error.code) || attempt >= 7) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
  } finally { await io.rm(temporary, { force: true }).catch(() => {}); }
}

function validateProject(project) {
  if (project?.schema !== 'workbench/case-project-v1' || !PROJECT_ID.test(project.project_id) ||
      !Number.isInteger(project.revision) || !Array.isArray(project.cases) || !Array.isArray(project.imports)) {
    throw new Error('CASE_PROJECT_INVALID');
  }
  return project;
}

export class CaseLibraryStore {
  #queue = Promise.resolve();

  constructor(root, options = {}) {
    this.root = path.resolve(root);
    this.projectsRoot = path.join(this.root, 'projects');
    this.uploadsRoot = path.join(this.root, 'uploads');
    this.previewsRoot = path.join(this.root, 'previews');
    this.io = options.io || fs;
  }

  serial(operation) {
    const next = this.#queue.then(operation, operation);
    this.#queue = next.catch(() => {});
    return next;
  }

  async init() {
    await Promise.all([this.io.mkdir(this.projectsRoot, { recursive: true }), this.io.mkdir(this.uploadsRoot, { recursive: true }), this.io.mkdir(this.previewsRoot, { recursive: true })]);
  }

  projectDirectory(projectId) {
    if (!PROJECT_ID.test(projectId)) throw new Error('CASE_PROJECT_ID_INVALID');
    return resolveInside(this.projectsRoot, projectId);
  }

  uploadDirectory(uploadId) {
    if (!/^upload-[a-z0-9-]{8,80}$/.test(uploadId)) throw new Error('CASE_UPLOAD_ID_INVALID');
    return resolveInside(this.uploadsRoot, uploadId);
  }

  previewFile(previewId) {
    if (!/^preview-[a-z0-9-]{8,80}$/.test(previewId)) throw new Error('CASE_PREVIEW_ID_INVALID');
    return resolveInside(this.previewsRoot, `${previewId}.json`);
  }

  async createProject({ name, description = '' }) {
    const now = new Date().toISOString();
    const project = {
      schema: 'workbench/case-project-v1', project_id: `project-${randomUUID()}`, name, description,
      revision: 1, created_at: now, updated_at: now, cases: [], imports: [],
    };
    return this.serial(async () => {
      const directory = this.projectDirectory(project.project_id);
      await this.io.mkdir(directory, { recursive: false });
      await writeJsonAtomic(path.join(directory, 'project.json'), project, this.io);
      return structuredClone(project);
    });
  }

  async getProject(projectId) {
    const project = await readJson(path.join(this.projectDirectory(projectId), 'project.json'), null);
    return project ? structuredClone(validateProject(project)) : null;
  }

  async listProjects() {
    const entries = await this.io.readdir(this.projectsRoot, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !PROJECT_ID.test(entry.name)) continue;
      const project = await this.getProject(entry.name);
      if (project) projects.push(project);
    }
    return projects.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  async updateProject(projectId, expectedRevision, updater) {
    return this.serial(async () => {
      const file = path.join(this.projectDirectory(projectId), 'project.json');
      const current = validateProject(await readJson(file));
      if (expectedRevision != null && current.revision !== expectedRevision) throw new Error('CASE_PROJECT_REVISION_CONFLICT');
      const next = validateProject(await updater(structuredClone(current)));
      if (next.project_id !== projectId) throw new Error('CASE_PROJECT_UPDATE_INVALID');
      next.revision = current.revision + 1;
      next.updated_at = new Date().toISOString();
      await writeJsonAtomic(file, next, this.io);
      return structuredClone(next);
    });
  }

  async saveUpload(upload) {
    return this.serial(async () => {
      const directory = this.uploadDirectory(upload.upload_id);
      await this.io.mkdir(directory, { recursive: false });
      await writeJsonAtomic(path.join(directory, 'upload.json'), upload, this.io);
      return structuredClone(upload);
    });
  }

  async updateUpload(upload) {
    return this.serial(async () => {
      const directory = this.uploadDirectory(upload.upload_id);
      await this.io.access(directory);
      await writeJsonAtomic(path.join(directory, 'upload.json'), upload, this.io);
      return structuredClone(upload);
    });
  }

  async getUpload(uploadId) { return readJson(path.join(this.uploadDirectory(uploadId), 'upload.json'), null); }

  async savePreview(preview) {
    return this.serial(async () => {
      await writeJsonAtomic(this.previewFile(preview.preview_id), preview, this.io);
      return structuredClone(preview);
    });
  }

  async getPreview(previewId) { return readJson(this.previewFile(previewId), null); }
}

export function newCaseId() { return `case-${randomUUID()}`; }
export function validCaseId(value) { return CASE_ID.test(value); }
