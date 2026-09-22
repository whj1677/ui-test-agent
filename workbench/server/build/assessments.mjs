import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { resolveInside, sha256File } from '../integrity.mjs';
import {
  PROJECT_CASE_STEP_TITLE_RULE_VERSION,
  counterexampleDetected,
  mapProjectCaseSteps,
  parseCandidateReport,
} from './report.mjs';

const INDEX_SCHEMA = 'workbench/build-supplemental-assessment-index-v1';
const SOURCE_SCHEMA = 'workbench/build-supplemental-assessment-source-v1';
const ASSESSMENT_ID = /^[a-z0-9][a-z0-9-]{7,99}$/;
const REVIEW_STATUSES = new Set(['COVERED', 'PARTIAL', 'GAP', 'UNKNOWN']);

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

function sourceHash(source) {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex').toUpperCase();
}

function reportProcess(result) {
  return {
    exitCode: result?.process?.exit_code ?? null,
    termination: result?.process?.termination ?? null,
    error: result?.process?.error ?? null,
  };
}

function sanitizeError(error) {
  if (!error) return null;
  return {
    type: error.type ?? null,
    message: error.message ?? null,
    expected: error.expected ?? null,
    actual: error.actual ?? null,
    attribution: error.attribution ?? null,
  };
}

function sanitizeRawError(rawError) {
  if (!rawError) return null;
  return {
    message: rawError.message ?? null,
    location: rawError.location ? {
      file: rawError.location.file ? path.basename(rawError.location.file) : null,
      line: rawError.location.line ?? null,
      column: rawError.location.column ?? null,
    } : null,
    snippet: rawError.snippet ?? null,
  };
}

function publicMapping(mapping) {
  return {
    rule_version: mapping.rule_version,
    complete: mapping.complete,
    order_valid: mapping.order_valid,
    expected_sequence: mapping.expected_sequence,
    observed_sequence: mapping.observed_sequence,
    duplicates: mapping.duplicates,
    missing: mapping.missing,
    unexpected: mapping.unexpected,
    malformed_titles: mapping.malformed_titles,
    unattributed_error_count: mapping.unattributed_errors.length,
    items: mapping.items.map((item) => ({
      marker: item.marker,
      step_id: item.step_id,
      order: item.order,
      observed: item.observed,
      raw_title: item.raw_title,
      report_path: item.report_path,
      error_attributed: item.error_attributed,
      execution_status: item.execution_status,
      attributed_errors: item.attributed_errors.map((attributed) => ({
        step_id: attributed.step_id,
        report_path: attributed.report_path,
        error: sanitizeError(attributed.error),
        raw_error: sanitizeRawError(attributed.raw_error),
      })),
    })),
  };
}

function assertSource(source) {
  if (source?.schema !== SOURCE_SCHEMA || !ASSESSMENT_ID.test(source.assessment_id || '')) throw new Error('BUILD_ASSESSMENT_SOURCE_INVALID');
  if (source.mapping_rule_version !== PROJECT_CASE_STEP_TITLE_RULE_VERSION) throw new Error('BUILD_ASSESSMENT_RULE_VERSION_INVALID');
  if (!Array.isArray(source.business_review) || !source.business_review.length) throw new Error('BUILD_ASSESSMENT_REVIEW_INVALID');
  for (const item of source.business_review) {
    if (!/^CASE_STEP_[1-9]\d*$/.test(item.step_id || '') || !REVIEW_STATUSES.has(item.status) ||
        !Array.isArray(item.code_locations) || !item.code_locations.length || typeof item.evidence !== 'string' || !item.evidence) {
      throw new Error('BUILD_ASSESSMENT_REVIEW_INVALID');
    }
  }
}

async function checkedFile(taskRoot, descriptor, expectedHash, errorCode) {
  if (!descriptor || descriptor.sha256 !== expectedHash) throw new Error(errorCode);
  const file = resolveInside(taskRoot, descriptor.relative_path);
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size !== descriptor.bytes || await sha256File(file) !== expectedHash) throw new Error(errorCode);
  return file;
}

export class BuildSupplementalAssessmentStore {
  constructor(root, buildStore) {
    this.root = path.resolve(root);
    this.buildStore = buildStore;
    this.indexFile = path.join(this.root, 'index.json');
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
    const existing = await readJson(this.indexFile, null);
    if (!existing) await writeJsonAtomic(this.indexFile, { schema: INDEX_SCHEMA, records: [] });
    else if (existing.schema !== INDEX_SCHEMA || !Array.isArray(existing.records)) throw new Error('BUILD_ASSESSMENT_INDEX_INVALID');
  }

  async #index() {
    const index = await readJson(this.indexFile);
    if (index?.schema !== INDEX_SCHEMA || !Array.isArray(index.records)) throw new Error('BUILD_ASSESSMENT_INDEX_INVALID');
    return index;
  }

  async register(source) {
    assertSource(source);
    const task = await this.buildStore.getTask(source.source_task_id);
    if (!task) throw new Error('BUILD_ASSESSMENT_TASK_NOT_FOUND');
    const attempt = task.attempts?.find((item) => item.attempt_id === source.source_attempt_id);
    const candidate = task.candidates?.find((item) => item.version === source.source_candidate_version);
    if (!attempt || !candidate || candidate.attempt_id !== source.source_attempt_id || candidate.sha256 !== source.candidate_sha256) {
      throw new Error('BUILD_ASSESSMENT_CANDIDATE_MISMATCH');
    }
    const taskRoot = this.buildStore.taskDirectory(task.task_id);
    const candidateDescriptor = task.files?.find((item) => item.attempt_id === source.source_attempt_id && item.kind === 'candidate');
    await checkedFile(taskRoot, candidateDescriptor, source.candidate_sha256, 'BUILD_ASSESSMENT_CANDIDATE_CHANGED');
    const reports = {};
    for (const lane of ['normal', 'negative']) {
      const descriptor = task.files?.find((item) => item.attempt_id === source.source_attempt_id && item.kind === 'test_report' &&
        item.relative_path.replaceAll('\\', '/').includes(`/verification/${lane}/`));
      reports[lane] = await checkedFile(taskRoot, descriptor, source.report_sha256?.[lane], 'BUILD_ASSESSMENT_REPORT_CHANGED');
    }
    const [normal, negative] = await Promise.all([
      parseCandidateReport(reports.normal, reportProcess(candidate.normal)),
      parseCandidateReport(reports.negative, reportProcess(candidate.negative)),
    ]);
    const contract = task.input_bundle?.verification_contract;
    if (!contract || task.source?.kind !== 'project-case') throw new Error('BUILD_ASSESSMENT_CONTRACT_INVALID');
    const required = contract.required_step_markers || [];
    if (source.business_review.length !== required.length ||
        source.business_review.some((item, index) => item.step_id !== required[index])) throw new Error('BUILD_ASSESSMENT_REVIEW_INVALID');
    const normalMapping = mapProjectCaseSteps(normal, contract);
    const negativeMapping = mapProjectCaseSteps(negative, contract);
    const specifiedMismatch = counterexampleDetected(negative, contract);
    const businessComplete = source.business_review.every((item) => item.status === 'COVERED');
    const eligible = normal.complete_pass && normalMapping.complete && negativeMapping.complete && specifiedMismatch && businessComplete;
    const record = {
      schema: 'workbench/build-supplemental-assessment-v1',
      assessment_id: source.assessment_id,
      source_record_sha256: sourceHash(source),
      created_at: source.created_at,
      source_task_id: task.task_id,
      source_attempt_id: source.source_attempt_id,
      source_candidate_version: source.source_candidate_version,
      candidate_sha256: candidate.sha256,
      report_sha256: structuredClone(source.report_sha256),
      mapping_rule_version: PROJECT_CASE_STEP_TITLE_RULE_VERSION,
      original_task_state: {
        task_status: task.task_status,
        verification_status: candidate.verification_status,
        error: structuredClone(candidate.error || task.error || null),
      },
      normal: { test_status: normal.test_status, complete_pass: normal.complete_pass, error: sanitizeError(normal.error), step_mapping: publicMapping(normalMapping) },
      negative: { test_status: negative.test_status, error: sanitizeError(negative.error), step_mapping: publicMapping(negativeMapping), specified_mismatch: specifiedMismatch },
      business_review: structuredClone(source.business_review),
      conclusion: eligible ? 'ELIGIBLE_FOR_HUMAN_REVIEW' : 'BUSINESS_REVIEW_GAPS',
      conclusion_text: eligible ? '按兼容规则可进入人工首审，尚未批准。' : '步骤映射已补充评估，但业务核对仍有缺项，尚不可进入人工首审。',
      reviewer_kind: 'AI_TECHNICAL_READ_ONLY',
      approved: false,
    };
    const index = await this.#index();
    const existing = index.records.find((item) => item.assessment_id === record.assessment_id);
    if (existing) {
      if (existing.source_record_sha256 !== record.source_record_sha256) throw new Error('BUILD_ASSESSMENT_ALREADY_REGISTERED_DIFFERENT');
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
}
