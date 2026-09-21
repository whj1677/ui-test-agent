import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { contentHash, inspectWorkbook, parseWorksheet } from './excel.mjs';
import { newCaseId, validCaseId } from './store.mjs';

const PACKAGE_SCHEMA = 'workbench/case-package-v1';

function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex').toUpperCase(); }
function requiredText(value, code, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(code);
  return value.trim();
}
function optionalText(value, code, max = 5000) {
  if (typeof value !== 'string' || value.length > max) throw new Error(code);
  return value;
}
function currentContent(item) { return item.versions.find((version) => version.version === item.current_version)?.content; }

function packageCandidates(pkg) {
  if (pkg?.schema !== PACKAGE_SCHEMA || !Array.isArray(pkg.cases)) throw new Error('CASE_PACKAGE_SCHEMA_UNSUPPORTED');
  return pkg.cases.map((item, index) => {
    if (!item?.root_source?.stable_id || !Array.isArray(item.lineage) || !item.content || !Array.isArray(item.content.steps)) throw new Error('CASE_PACKAGE_INVALID');
    const content = structuredClone(item.content);
    const issues = [];
    if (typeof content.external_id !== 'string' || !content.external_id.trim() || typeof content.title !== 'string' || !content.title.trim()) issues.push({ severity: 'ERROR', code: 'CASE_PACKAGE_CONTENT_INVALID', message: '原生包用例缺少有效编号或标题。' });
    if (!content.steps.length || content.steps.some((step, stepIndex) => step?.order !== stepIndex + 1 || typeof step.action !== 'string' || !step.action.trim() || typeof step.expected !== 'string')) issues.push({ severity: 'ERROR', code: 'CASE_PACKAGE_STEPS_INVALID', message: '原生包步骤必须有序，并包含动作和字符串预期。' });
    if (content.steps.some((step) => !step.expected.trim())) {
      issues.push({ severity: 'CLARIFICATION', code: 'EXPECTED_MISSING', message: '原生包存在缺少预期的步骤，导入后保持待确认。' });
      content.status = 'PENDING_CONFIRMATION';
    } else content.status = content.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
    return {
      candidate_key: `package-case-${index + 1}`, source_location: { package_id: pkg.package_id, index: index + 1 },
      root_source: structuredClone(item.root_source), source_version: item.source_version,
      lineage: structuredClone(item.lineage), content, content_sha256: contentHash(content), issues,
    };
  });
}

function classify(project, candidate) {
  if (candidate.issues.some((issue) => issue.severity === 'ERROR')) return 'UNIMPORTABLE';
  const sameSource = project.cases.filter((item) => item.root_source.stable_id === candidate.root_source.stable_id);
  if (sameSource.some((item) => item.versions.some((version) => version.content_sha256 === candidate.content_sha256))) return 'DUPLICATE';
  if (sameSource.length) return 'CONFLICT';
  if (candidate.issues.some((issue) => issue.severity === 'CLARIFICATION')) return 'PENDING_CLARIFICATION';
  return 'NEW';
}

function summarize(items) {
  const output = { NEW: 0, DUPLICATE: 0, CONFLICT: 0, PENDING_CLARIFICATION: 0, UNIMPORTABLE: 0 };
  for (const item of items) output[item.classification] += 1;
  return output;
}

function importCase(candidate, preview, project) {
  const now = new Date().toISOString();
  const caseId = newCaseId();
  const lineage = [...(candidate.lineage || []), {
    project_id: project.project_id, case_id: caseId, version: 1, imported_from: preview.source_type, at: now,
  }];
  return {
    case_id: caseId, external_id: candidate.content.external_id, title: candidate.content.title, module: candidate.content.module,
    status: candidate.content.status, current_version: 1, root_source: structuredClone(candidate.root_source), lineage,
    import_batch_id: preview.preview_id, created_at: now, updated_at: now,
    versions: [{ version: 1, content: structuredClone(candidate.content), content_sha256: candidate.content_sha256, created_at: now, source: 'IMPORT' }],
  };
}

export class CaseLibraryManager {
  constructor(store) { this.store = store; }

  async createProject(body) {
    return this.store.createProject({ name: requiredText(body.name, 'CASE_PROJECT_NAME_REQUIRED', 120), description: optionalText(body.description ?? '', 'CASE_PROJECT_DESCRIPTION_INVALID') });
  }

  async updateProject(projectId, body) {
    const revision = body.revision;
    if (!Number.isInteger(revision)) throw new Error('CASE_PROJECT_REVISION_REQUIRED');
    return this.store.updateProject(projectId, revision, (project) => ({ ...project, name: requiredText(body.name, 'CASE_PROJECT_NAME_REQUIRED', 120), description: optionalText(body.description ?? '', 'CASE_PROJECT_DESCRIPTION_INVALID') }));
  }

  async updateCase(projectId, caseId, body) {
    if (!validCaseId(caseId) || !Number.isInteger(body.revision)) throw new Error('CASE_UPDATE_INVALID');
    return this.store.updateProject(projectId, body.revision, (project) => {
      const item = project.cases.find((entry) => entry.case_id === caseId);
      if (!item) throw new Error('CASE_NOT_FOUND');
      const steps = body.content?.steps;
      if (!Array.isArray(steps) || !steps.length || steps.some((step, index) => step.order !== index + 1 || typeof step.action !== 'string' || !step.action.trim() || typeof step.expected !== 'string')) throw new Error('CASE_STEPS_INVALID');
      const content = {
        external_id: requiredText(body.content.external_id, 'CASE_EXTERNAL_ID_REQUIRED', 200),
        title: requiredText(body.content.title, 'CASE_TITLE_REQUIRED', 500), module: optionalText(body.content.module ?? '', 'CASE_MODULE_INVALID'),
        preconditions: optionalText(body.content.preconditions ?? '', 'CASE_PRECONDITIONS_INVALID'), test_data: optionalText(body.content.test_data ?? '', 'CASE_TEST_DATA_INVALID'),
        steps: structuredClone(steps), status: body.content.status === 'CONFIRMED' && steps.every((step) => step.expected.trim()) ? 'CONFIRMED' : 'PENDING_CONFIRMATION',
      };
      const now = new Date().toISOString();
      const version = item.current_version + 1;
      item.external_id = content.external_id; item.title = content.title; item.module = content.module; item.status = content.status;
      item.current_version = version; item.updated_at = now;
      item.versions.push({ version, content, content_sha256: contentHash(content), created_at: now, source: 'MANUAL_EDIT' });
      item.lineage.push({ project_id: project.project_id, case_id: item.case_id, version, change: 'MANUAL_EDIT', at: now });
      return project;
    });
  }

  async upload({ fileName, contentType, body }) {
    if (!Buffer.isBuffer(body) || body.length < 1 || body.length > 10 * 1024 * 1024) throw new Error('CASE_UPLOAD_SIZE_INVALID');
    const decodedName = decodeURIComponent(fileName || '');
    const extension = path.extname(decodedName).toLowerCase();
    const sourceType = extension === '.xlsx' && contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ? 'xlsx'
      : extension === '.json' && contentType === 'application/json' ? 'case-package' : null;
    if (!sourceType) throw new Error('CASE_UPLOAD_TYPE_UNSUPPORTED');
    const uploadId = `upload-${randomUUID()}`;
    const fileSha = sha256(body);
    const upload = { schema: 'workbench/case-upload-v1', upload_id: uploadId, file_name: path.basename(decodedName), source_type: sourceType, bytes: body.length, sha256: fileSha, created_at: new Date().toISOString() };
    await this.store.saveUpload(upload);
    const directory = this.store.uploadDirectory(uploadId);
    const sourceFile = path.join(directory, sourceType === 'xlsx' ? 'source.xlsx' : 'source.json');
    await fs.writeFile(sourceFile, body, { flag: 'wx' });
    if (sourceType === 'xlsx') upload.workbook = await inspectWorkbook(sourceFile);
    else {
      let pkg;
      try { pkg = JSON.parse(body.toString('utf8')); } catch { throw new Error('CASE_PACKAGE_INVALID_JSON'); }
      packageCandidates(pkg);
      upload.package = { schema: pkg.schema, package_id: pkg.package_id, case_count: pkg.cases.length };
    }
    await this.store.updateUpload(upload);
    return upload;
  }

  async preview(projectId, body) {
    const project = await this.store.getProject(projectId);
    if (!project) throw new Error('CASE_PROJECT_NOT_FOUND');
    const upload = await this.store.getUpload(body.upload_id);
    if (!upload) throw new Error('CASE_UPLOAD_NOT_FOUND');
    let candidates;
    let sourceDetail;
    if (upload.source_type === 'xlsx') {
      const parsed = await parseWorksheet(path.join(this.store.uploadDirectory(upload.upload_id), 'source.xlsx'), {
        sheet_name: requiredText(body.sheet_name, 'CASE_EXCEL_SHEET_REQUIRED'), mapping: body.mapping,
        upload_sha256: upload.sha256, file_name: upload.file_name,
      });
      candidates = parsed.rows; sourceDetail = { sheet_name: parsed.sheet_name, mapping: structuredClone(body.mapping) };
    } else {
      const pkg = JSON.parse(await fs.readFile(path.join(this.store.uploadDirectory(upload.upload_id), 'source.json'), 'utf8'));
      candidates = packageCandidates(pkg); sourceDetail = { package_id: pkg.package_id };
    }
    const items = candidates.map((candidate) => {
      const classification = classify(project, candidate);
      const externalIdCollision = classification === 'NEW' && project.cases.some((item) => item.external_id === candidate.content.external_id);
      const issues = externalIdCollision
        ? [...candidate.issues, { severity: 'WARNING', code: 'EXTERNAL_ID_COLLISION_DIFFERENT_SOURCE', message: '项目内存在相同对外编号，但来源身份不同；首版按独立用例追加。' }]
        : candidate.issues;
      return { ...candidate, issues, classification };
    });
    const preview = {
      schema: 'workbench/case-import-preview-v1', preview_id: `preview-${randomUUID()}`, project_id: projectId,
      project_revision: project.revision, upload_id: upload.upload_id, source_type: upload.source_type,
      source_file: { file_name: upload.file_name, sha256: upload.sha256, bytes: upload.bytes }, source_detail: sourceDetail,
      created_at: new Date().toISOString(), status: 'PREVIEWED', summary: summarize(items), items,
    };
    return this.store.savePreview(preview);
  }

  async confirm(projectId, previewId, decisions = {}) {
    const preview = await this.store.getPreview(previewId);
    if (!preview || preview.project_id !== projectId) throw new Error('CASE_PREVIEW_NOT_FOUND');
    const before = await this.store.getProject(projectId);
    if (!before) throw new Error('CASE_PROJECT_NOT_FOUND');
    const previous = before.imports.find((item) => item.preview_id === previewId);
    if (previous) return { project: before, result: structuredClone(previous.result), idempotent: true };
    if (before.revision !== preview.project_revision) throw new Error('CASE_IMPORT_PREVIEW_STALE');
    const result = { added: 0, skipped_duplicate: 0, skipped_conflict: 0, skipped_unimportable: 0, imported_case_ids: [] };
    const project = await this.store.updateProject(projectId, preview.project_revision, (current) => {
      for (const item of preview.items) {
        if (item.classification === 'DUPLICATE') { result.skipped_duplicate += 1; continue; }
        if (item.classification === 'UNIMPORTABLE') { result.skipped_unimportable += 1; continue; }
        if (item.classification === 'CONFLICT' && decisions[item.candidate_key] !== 'IMPORT_COPY') { result.skipped_conflict += 1; continue; }
        const created = importCase(item, preview, current);
        current.cases.push(created); result.added += 1; result.imported_case_ids.push(created.case_id);
      }
      current.imports.push({ preview_id: previewId, upload_id: preview.upload_id, source_type: preview.source_type, confirmed_at: new Date().toISOString(), result: structuredClone(result) });
      return current;
    });
    await this.store.savePreview({ ...preview, status: 'CONFIRMED', confirmed_at: new Date().toISOString(), result }).catch(() => {});
    return { project, result, idempotent: false };
  }

  async exportPackage(projectId, caseIds) {
    const project = await this.store.getProject(projectId);
    if (!project) throw new Error('CASE_PROJECT_NOT_FOUND');
    const selected = caseIds?.length ? project.cases.filter((item) => caseIds.includes(item.case_id)) : project.cases;
    if (!selected.length || (caseIds?.length && selected.length !== new Set(caseIds).size)) throw new Error('CASE_EXPORT_SELECTION_INVALID');
    const now = new Date().toISOString();
    return {
      schema: PACKAGE_SCHEMA, package_id: `case-package-${randomUUID()}`, exported_at: now,
      source_project: { project_id: project.project_id, name: project.name, revision: project.revision },
      cases: selected.map((item) => ({
        package_case_id: `${project.project_id}:${item.case_id}:v${item.current_version}`,
        source_version: item.current_version, root_source: structuredClone(item.root_source),
        lineage: [...item.lineage, { project_id: project.project_id, case_id: item.case_id, version: item.current_version, exported_at: now }],
        content: structuredClone(currentContent(item)),
      })),
    };
  }
}
