import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveInside, sha256File } from '../integrity.mjs';

const INDEX_SCHEMA = 'workbench/build-revalidation-index-v1';
const RECORD_SCHEMA = 'workbench/existing-candidate-revalidation-v1';
const VALIDATION_ID = /^[a-z0-9][a-z0-9-]{7,99}$/;
const MEDIA_TYPES = new Map([
  ['.png', { kind: 'screenshot', content_type: 'image/png' }],
  ['.webm', { kind: 'video', content_type: 'video/webm' }],
  ['.zip', { kind: 'trace', content_type: 'application/zip' }],
]);

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try { await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}

function assertString(value, code) {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function publicResult(result) {
  return {
    report_status: result?.report_status ?? null,
    test_status: result?.test_status ?? null,
    test_count: result?.test_count ?? null,
    complete_pass: result?.complete_pass === true,
    process: {
      exit_code: result?.process?.exit_code ?? null,
      termination: result?.process?.termination ?? null,
    },
    error: result?.error ? {
      type: result.error.type ?? null,
      message: result.error.message ?? null,
      expected: result.error.expected ?? null,
      actual: result.error.actual ?? null,
      attribution: result.error.attribution ?? null,
    } : null,
    specified_mismatch: result?.specified_mismatch === true,
  };
}

async function originalValidationFacts(buildStore, task, candidate, source) {
  const facts = { normal: publicResult(candidate.normal), negative: publicResult(candidate.negative), loading_errors: [] };
  if (typeof buildStore.taskDirectory !== 'function') return facts;
  const taskRoot = buildStore.taskDirectory(task.task_id);
  for (const lane of ['normal', 'negative']) {
    const expected = source.original_reports?.[`${lane}_sha256_before`];
    const after = source.original_reports?.[`${lane}_sha256_after`];
    const descriptor = task.files?.find((item) => item.kind === 'test_report' && item.attempt_id === source.source_attempt_id &&
      item.relative_path.replaceAll('\\', '/').includes(`/verification/${lane}/`));
    if (!descriptor || !expected || expected !== after || descriptor.sha256 !== expected) throw new Error('REVALIDATION_ORIGINAL_REPORT_MISMATCH');
    const reportFile = resolveInside(taskRoot, descriptor.relative_path);
    const stat = await fs.stat(reportFile);
    if (!stat.isFile() || stat.size !== descriptor.bytes || await sha256File(reportFile) !== expected) throw new Error('REVALIDATION_ORIGINAL_REPORT_CHANGED');
    const report = await readJson(reportFile);
    for (const error of report.errors || []) {
      const firstLine = String(error?.message || '').split(/\r?\n/, 1)[0].trim();
      if (firstLine && !facts.loading_errors.includes(firstLine)) facts.loading_errors.push(firstLine);
    }
  }
  return facts;
}

async function verifiedFile(root, descriptor) {
  const relative = assertString(descriptor?.relative_path, 'REVALIDATION_FILE_PATH_INVALID');
  const absolute = resolveInside(root, relative);
  let realRoot;
  let realFile;
  try { [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(absolute)]); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('REVALIDATION_FILE_MISSING');
    throw error;
  }
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error('REVALIDATION_FILE_OUTSIDE_ROOT');
  const stat = await fs.stat(realFile);
  if (!stat.isFile() || stat.size !== descriptor.bytes) throw new Error('REVALIDATION_FILE_CHANGED');
  if (await sha256File(realFile) !== descriptor.sha256) throw new Error('REVALIDATION_FILE_CHANGED');
  return { relative_path: relative, bytes: stat.size, sha256: descriptor.sha256 };
}

export class BuildRevalidationStore {
  constructor(root, buildStore) {
    this.root = path.resolve(root);
    this.buildStore = buildStore;
    this.indexFile = path.join(this.root, 'index.json');
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
    const existing = await readJson(this.indexFile, null);
    if (!existing) await writeJsonAtomic(this.indexFile, { schema: INDEX_SCHEMA, records: [] });
    else if (existing.schema !== INDEX_SCHEMA || !Array.isArray(existing.records)) throw new Error('REVALIDATION_INDEX_INVALID');
  }

  validationDirectory(validationId) {
    if (!VALIDATION_ID.test(validationId)) throw new Error('REVALIDATION_ID_INVALID');
    return resolveInside(this.root, validationId);
  }

  async #index() {
    const index = await readJson(this.indexFile);
    if (index?.schema !== INDEX_SCHEMA || !Array.isArray(index.records)) throw new Error('REVALIDATION_INDEX_INVALID');
    return index;
  }

  async register(validationId) {
    const validationRoot = this.validationDirectory(validationId);
    const sourceFile = resolveInside(validationRoot, 'revalidation.json');
    const source = await readJson(sourceFile);
    if (source?.schema !== RECORD_SCHEMA || source.validation_id !== validationId) throw new Error('REVALIDATION_RECORD_INVALID');
    const task = await this.buildStore.getTask(assertString(source.source_task_id, 'REVALIDATION_TASK_INVALID'));
    if (!task) throw new Error('REVALIDATION_SOURCE_TASK_NOT_FOUND');
    const attempt = task.attempts?.find((item) => item.attempt_id === source.source_attempt_id);
    if (!attempt) throw new Error('REVALIDATION_SOURCE_ATTEMPT_MISMATCH');
    const candidate = task.candidates?.find((item) => item.version === source.source_candidate_version);
    if (!candidate) throw new Error('REVALIDATION_SOURCE_CANDIDATE_MISMATCH');
    if (candidate.attempt_id !== source.source_attempt_id || candidate.sha256 !== source.candidate_sha256) {
      throw new Error('REVALIDATION_SOURCE_CANDIDATE_MISMATCH');
    }
    const sourceRecordSha256 = await sha256File(sourceFile);

    const media = [];
    for (const lane of ['normal', 'negative']) {
      const laneRoot = resolveInside(validationRoot, lane);
      for (const descriptor of source[lane]?.files || []) {
        const checked = await verifiedFile(laneRoot, descriptor);
        const mediaType = MEDIA_TYPES.get(path.extname(checked.relative_path).toLowerCase());
        if (!mediaType) continue;
        media.push({
          media_id: `${lane}-${mediaType.kind}`,
          lane,
          ...mediaType,
          file_name: path.basename(checked.relative_path),
          relative_path: `${lane}/${checked.relative_path}`.replaceAll('\\', '/'),
          bytes: checked.bytes,
          sha256: checked.sha256,
        });
      }
    }
    const record = {
      validation_id: validationId,
      source_record_sha256: sourceRecordSha256,
      source_task_id: source.source_task_id,
      source_attempt_id: source.source_attempt_id,
      source_candidate_version: source.source_candidate_version,
      candidate_sha256: source.candidate_sha256,
      started_at: source.started_at ?? null,
      finished_at: source.finished_at ?? null,
      status: source.status ?? null,
      runtime: source.runtime ?? null,
      normal: publicResult(source.normal),
      negative: publicResult(source.negative),
      original_reports: source.original_reports ?? null,
      original_validation: await originalValidationFacts(this.buildStore, task, candidate, source),
      media,
    };
    const index = await this.#index();
    const existing = index.records.find((item) => item.validation_id === validationId);
    if (existing) {
      const sameIdentity = existing.source_task_id === record.source_task_id &&
        existing.source_attempt_id === record.source_attempt_id &&
        existing.source_candidate_version === record.source_candidate_version &&
        existing.candidate_sha256 === record.candidate_sha256;
      if (!sameIdentity || (existing.source_record_sha256 && existing.source_record_sha256 !== sourceRecordSha256)) {
        throw new Error('REVALIDATION_ALREADY_REGISTERED_DIFFERENT');
      }
      index.records[index.records.indexOf(existing)] = record;
      await writeJsonAtomic(this.indexFile, index);
      return structuredClone(record);
    }
    index.records.push(record);
    await writeJsonAtomic(this.indexFile, index);
    return structuredClone(record);
  }

  async listForTask(taskId) {
    const index = await this.#index();
    return structuredClone(index.records.filter((item) => item.source_task_id === taskId));
  }

  async get(validationId) {
    const index = await this.#index();
    return structuredClone(index.records.find((item) => item.validation_id === validationId) || null);
  }

  async resolveMedia(taskId, validationId, mediaId) {
    const record = await this.get(validationId);
    if (!record || record.source_task_id !== taskId) return null;
    const media = record.media.find((item) => item.media_id === mediaId);
    if (!media) return null;
    return { root: this.validationDirectory(validationId), media };
  }
}
