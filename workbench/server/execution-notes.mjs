import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const schema = 'workbench/execution-note-v1';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safeId = /^[\w-]{1,160}$/;
const fail = code => { throw Error(code); };
const hash = text => createHash('sha256').update(text).digest('hex');
const storageError = error => new Error('EXECUTION_NOTE_STORAGE_ERROR', { cause: error });

// Observations may be attached to any existing run. They are pending analysis,
// never a replacement result, failure attribution, or approval of a script.
export class ExecutionNotes {
  constructor({ root, getRecords }) {
    if (!root || typeof getRecords !== 'function') fail('EXECUTION_NOTE_CONFIGURATION_INVALID');
    this.root = path.resolve(root);
    this.getRecords = getRecords;
  }

  async record(projectId, runId) {
    if (typeof projectId !== 'string' || !safeId.test(projectId) || typeof runId !== 'string' || !safeId.test(runId)) fail('EXECUTION_NOTE_SCOPE_INVALID');
    const records = await this.getRecords(projectId);
    if (!Array.isArray(records)) fail('EXECUTION_NOTE_RECORDS_INVALID');
    const matches = records.filter(record => record.run_id === runId && record.project_id === projectId);
    if (matches.length !== 1) fail('EXECUTION_NOTE_RUN_NOT_FOUND');
    return matches[0];
  }

  async directory(projectId, runId, create = false) {
    const directories = [this.root, path.join(this.root, projectId), path.join(this.root, projectId, runId)];
    try {
      // Check each component before creating its child; a note directory must
      // not redirect writes to another project through a symlink/junction.
      for (const directory of directories) {
        if (create) {
          try { await fs.mkdir(directory, { recursive: directory === this.root }); }
          catch (error) { if (error.code !== 'EEXIST') throw error; }
        }
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) fail('EXECUTION_NOTE_STORAGE_PATH_INVALID');
      }
      return directories.at(-1);
    } catch (error) {
      if (!create && error.code === 'ENOENT') return null;
      throw storageError(error);
    }
  }

  async read(file, projectId, runId, requestId) {
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) fail('EXECUTION_NOTE_STORAGE_PATH_INVALID');
      const note = JSON.parse(await fs.readFile(file, 'utf8'));
      if (note.schema !== schema || note.project_id !== projectId || note.run_id !== runId ||
          note.request_id !== requestId || note.status !== 'NEEDS_ANALYSIS' ||
          !/^note-[a-f0-9-]{36}$/.test(note.note_id || '') ||
          typeof note.text !== 'string' || !note.text.trim() || note.text.length > 4000 ||
          note.payload_sha256 !== hash(note.text) || !Number.isFinite(Date.parse(note.created_at)) ||
          !note.binding || note.binding.project_id !== projectId || note.binding.run_id !== runId) fail('EXECUTION_NOTE_STORAGE_INVALID');
      return note;
    } catch (error) { throw storageError(error); }
  }

  async list(projectId, runId) {
    await this.record(projectId, runId);
    const directory = await this.directory(projectId, runId);
    if (!directory) return { notes: [] };
    try {
      const files = await fs.readdir(directory);
      const notes = [];
      for (const file of files.filter(file => file.endsWith('.json')).sort()) {
        const requestId = file.slice(0, -5);
        if (!uuid.test(requestId)) fail('EXECUTION_NOTE_STORAGE_INVALID');
        notes.push(await this.read(path.join(directory, file), projectId, runId, requestId));
      }
      notes.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.note_id.localeCompare(b.note_id));
      return { notes };
    } catch (error) { throw storageError(error); }
  }

  async append(projectId, runId, input) {
    const record = await this.record(projectId, runId);
    if (!input || Object.keys(input).some(key => !['request_id', 'text'].includes(key)) ||
        typeof input.request_id !== 'string' || !uuid.test(input.request_id) ||
        typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000) fail('EXECUTION_NOTE_INPUT_INVALID');
    const requestId = input.request_id.toLowerCase(), text = input.text.trim();
    const directory = await this.directory(projectId, runId, true);
    const file = path.join(directory, `${requestId}.json`), temporary = path.join(directory, `.pending-${randomUUID()}`);
    const selection = record.selection || {};
    const note = { schema, note_id: `note-${randomUUID()}`, request_id: requestId,
      project_id: projectId, run_id: runId, text, payload_sha256: hash(text), created_at: new Date().toISOString(), status: 'NEEDS_ANALYSIS',
      binding: { project_id: projectId, run_id: runId,
        case_id: record.executed_case_id ?? record.case_id ?? selection.case_id ?? null,
        case_version: record.executed_case_version ?? record.case_version ?? selection.case_version ?? null,
        source_task_id: record.source_build_task_id ?? record.source_task_id ?? selection.source_task_id ?? record.plan_id ?? null,
        candidate_version: record.candidate_version ?? selection.candidate_version ?? null,
        bundle_sha256: record.bundle_sha256 ?? record.execution_sha256 ?? selection.bundle_sha256 ?? null,
        environment_id: record.environment_id ?? record.environment_binding?.environment_id ?? selection.environment_id ?? null,
        original_status: record.result?.test_status ?? record.result?.status ?? record.test_status ?? record.status ?? null,
      } };
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(note, null, 2)}\n`, 'utf8');
      await handle.sync(); await handle.close(); handle = null;
      // A hard link publishes the fully written file atomically on Windows,
      // while EEXIST protects the immutable idempotency record from overwrite.
      try { await fs.link(temporary, file); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      const saved = await this.read(file, projectId, runId, requestId);
      if (saved.payload_sha256 !== note.payload_sha256 || saved.text !== text) fail('EXECUTION_NOTE_REQUEST_CONFLICT');
      return saved;
    } catch (error) {
      if (error.message === 'EXECUTION_NOTE_REQUEST_CONFLICT') throw error;
      throw storageError(error);
    } finally {
      if (handle) await handle.close();
      try { await fs.unlink(temporary); } catch (error) { if (error.code !== 'ENOENT') throw storageError(error); }
    }
  }
}
