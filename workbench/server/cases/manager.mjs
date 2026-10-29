import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { contentHash, inspectWorkbook, parseWorksheet } from './excel.mjs';
import { newCaseId, validCaseId } from './store.mjs';
import { typedMetadata, assertDesignImport } from './design.mjs';
import { WORKBOOK_META_SHEET, readWorkbookPackage, assertWorkbookProjectSource } from './workbook-package.mjs';
import { extractBrowserAssertionContract } from '../build/browser-assertion-contract.mjs';
import { validateScriptPackages, attachImportedScripts } from './script-package.mjs';

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
function caseTestData(content) {
  const value = optionalText(content.test_data ?? '', 'CASE_TEST_DATA_INVALID', 32 * 1024);
  // A bounded frozen assertion block may exceed the ordinary free-text limit.
  // Validate it against these exact steps before creating a new case version.
  const { configured } = extractBrowserAssertionContract({ ...content, test_data: value });
  if (!configured && value.length > 5000) throw Error('CASE_TEST_DATA_INVALID');
  return value;
}
function currentContent(item) { return item.versions.find((version) => version.version === item.current_version)?.content; }

function packageCandidates(pkg) {
  if (pkg?.schema !== PACKAGE_SCHEMA || !Array.isArray(pkg.cases)) throw new Error('CASE_PACKAGE_SCHEMA_UNSUPPORTED');
  return pkg.cases.map((item, index) => {
    if (!item?.root_source?.stable_id || !Array.isArray(item.lineage) || !item.content || !Array.isArray(item.content.steps)) throw new Error('CASE_PACKAGE_INVALID');
    const content = structuredClone(item.content);
    typedMetadata(content);
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
      script_packages: validateScriptPackages(item.script_packages, content),
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
      const previous = currentContent(item);
      if (previous.requirements_origin || body.content?.requirements_origin) throw Error('CASE_DESIGN_REVIEW_REQUIRED');
      const steps = body.content?.steps;
      if (!Array.isArray(steps) || !steps.length || steps.some((step, index) => step.order !== index + 1 || typeof step.action !== 'string' || !step.action.trim() || typeof step.expected !== 'string')) throw new Error('CASE_STEPS_INVALID');
      const content = {
        ...typedMetadata({ ...previous, ...body.content }),
        external_id: requiredText(body.content.external_id, 'CASE_EXTERNAL_ID_REQUIRED', 200),
        title: requiredText(body.content.title, 'CASE_TITLE_REQUIRED', 500), module: optionalText(body.content.module ?? '', 'CASE_MODULE_INVALID'),
        preconditions: optionalText(body.content.preconditions ?? '', 'CASE_PRECONDITIONS_INVALID'), test_data: caseTestData(body.content),
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

  async confirmContents(projectId, body) {
    if (!Number.isInteger(body.revision) || body.confirm_content !== true || !Array.isArray(body.items) ||
        !body.items.length || body.items.length > 200 || body.items.some(item => !item || !validCaseId(item.case_id) ||
          !Number.isInteger(item.case_version) || typeof item.content_sha256 !== 'string') ||
        new Set(body.items.map(item => item.case_id)).size !== body.items.length)
      throw Error('CASE_CONTENT_CONFIRMATION_INVALID');
    const reviewer = requiredText(body.reviewer, 'CASE_CONTENT_REVIEWER_REQUIRED', 100);
    return this.store.updateProject(projectId, body.revision, project => {
      // Validate every frozen version before changing any case. One stale or
      // incomplete item rejects the entire group without a partial approval.
      const targets = body.items.map(input => {
        const item = project.cases.find(row => row.case_id === input.case_id);
        const version = item?.versions.find(row => row.version === item.current_version);
        if (!item || item.current_version !== input.case_version || version.content_sha256 !== input.content_sha256)
          throw Error('CASE_CONTENT_REVIEW_CONFLICT');
        const content = version.content;
        if (content.requirements_origin) throw Error('CASE_DESIGN_REVIEW_REQUIRED');
        if (content.status === 'CONFIRMED') throw Error('CASE_CONTENT_ALREADY_CONFIRMED');
        if (!['UI','BACKEND'].includes(content.case_type) || !content.external_id?.trim() || !content.title?.trim() || !content.steps?.length ||
            content.steps.some((step, index) => step.order !== index + 1 || !step.action?.trim() || !step.expected?.trim()))
          throw Error('CASE_CONTENT_REVIEW_INCOMPLETE');
        return item;
      });
      const at = new Date().toISOString();
      for (const item of targets) {
        const content = { ...structuredClone(currentContent(item)), status: 'CONFIRMED' };
        const version = item.current_version + 1;
        item.status = 'CONFIRMED'; item.current_version = version; item.updated_at = at;
        item.versions.push({ version, content, content_sha256: contentHash(content), created_at: at,
          source: 'MANUAL_CONFIRMATION', reviewed_by: reviewer });
        item.lineage.push({ project_id: projectId, case_id: item.case_id, version, change: 'MANUAL_CONFIRMATION', reviewer, at });
      }
      return project;
    });
  }

  async upload({ fileName, contentType, body }) {
    if (!Buffer.isBuffer(body) || body.length < 1 || body.length > 10 * 1024 * 1024) throw new Error('CASE_UPLOAD_SIZE_INVALID');
    const decodedName = decodeURIComponent(fileName || '');
    const extension = path.extname(decodedName).toLowerCase();
    const mime = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
    const csvMime = new Set(['text/csv', 'application/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/octet-stream']);
    const sourceType = extension === '.xlsx' && mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ? 'xlsx'
      : extension === '.csv' && csvMime.has(mime) ? 'csv'
        : extension === '.json' && mime === 'application/json' ? 'case-package' : null;
    if (!sourceType) throw new Error('CASE_UPLOAD_TYPE_UNSUPPORTED');
    const uploadId = `upload-${randomUUID()}`;
    const fileSha = sha256(body);
    const upload = { schema: 'workbench/case-upload-v1', upload_id: uploadId, file_name: path.basename(decodedName), source_type: sourceType, bytes: body.length, sha256: fileSha, created_at: new Date().toISOString() };
    await this.store.saveUpload(upload);
    const directory = this.store.uploadDirectory(uploadId);
    const sourceFile = path.join(directory, sourceType === 'xlsx' ? 'source.xlsx' : sourceType === 'csv' ? 'source.csv' : 'source.json');
    await fs.writeFile(sourceFile, body, { flag: 'wx' });
    if (sourceType === 'xlsx' || sourceType === 'csv') {
      upload.workbook = await inspectWorkbook(sourceFile, { file_name: upload.file_name });
      if (sourceType === 'xlsx') {
        const exported = await readWorkbookPackage(sourceFile);
        if (exported) {
          upload.workbook.sheets = upload.workbook.sheets.filter(sheet => sheet.name !== WORKBOOK_META_SHEET);
          upload.workbook_export_format = 'workbench/case-xlsx-v1';
        }
      }
    }
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
    if (upload.source_type === 'xlsx' || upload.source_type === 'csv') {
      const sourceFile = path.join(this.store.uploadDirectory(upload.upload_id), upload.source_type === 'csv' ? 'source.csv' : 'source.xlsx');
      const exported = upload.source_type === 'xlsx' ? await readWorkbookPackage(sourceFile) : null;
      if (exported) {
        assertWorkbookProjectSource(project, exported.pkg);
        candidates = packageCandidates(exported.pkg);
        for (const change of exported.changes) {
          const affected = change.index === 0 ? candidates : [candidates[change.index - 1]].filter(Boolean);
          for (const candidate of affected) candidate.issues.push({ severity: 'ERROR', code: 'CASE_WORKBOOK_VISIBLE_CHANGED_REVIEW_REQUIRED', field: change.field,
            message: `导出工作簿可见内容已变化（${change.field}）；需重新核对来源与用例，不能沿用原确认结果。` });
        }
        sourceDetail = { package_id: exported.pkg.package_id, sheet_name: exported.sheet_name,
          workbook_format: 'workbench/case-xlsx-v1', visible_change_count: exported.changes.length };
      } else {
        const sheetName = upload.source_type === 'csv' && body.sheet_name == null ? upload.workbook.sheets[0]?.name
          : requiredText(body.sheet_name, 'CASE_EXCEL_SHEET_REQUIRED');
        const sheet = upload.workbook.sheets.find((entry) => entry.name === sheetName);
        const mapping = body.mapping === undefined ? sheet?.suggested_mapping : body.mapping;
        const parsed = await parseWorksheet(sourceFile, {
          sheet_name: sheetName, mapping,
          upload_sha256: upload.sha256, file_name: upload.file_name,
        });
        candidates = parsed.rows; sourceDetail = { sheet_name: parsed.sheet_name, mapping: structuredClone(mapping) };
      }
    } else {
      const pkg = JSON.parse(await fs.readFile(path.join(this.store.uploadDirectory(upload.upload_id), 'source.json'), 'utf8'));
      candidates = packageCandidates(pkg); sourceDetail = { package_id: pkg.package_id };
    }
    const items = candidates.map((candidate) => {
      if (candidate.root_source?.type === 'requirements-design' && !candidate.content.requirements_origin) throw Error('CASE_DESIGN_REVIEW_REQUIRED');
      assertDesignImport(project, candidate.content, candidate.root_source);
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
      script_summary: { included: items.reduce((sum,item)=>sum+(item.script_packages?.length||0),0), status: 'NOT_RUN' },
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
    const result = { added: 0, skipped_duplicate: 0, skipped_conflict: 0, skipped_unimportable: 0, imported_case_ids: [], scripts_added: 0, scripts_skipped: 0 };
    const project = await this.store.updateProject(projectId, preview.project_revision, (current) => {
      for (const item of preview.items) {
        const scripts = validateScriptPackages(item.script_packages, item.content);
        if (item.classification === 'DUPLICATE') {
          const matches=current.cases.filter(row=>row.root_source.stable_id===item.root_source.stable_id&&row.versions.find(v=>v.version===row.current_version)?.content_sha256===item.content_sha256);
          const added=matches.length===1?attachImportedScripts(matches[0].versions.find(v=>v.version===matches[0].current_version),scripts,preview):0;
          result.scripts_added+=added;result.scripts_skipped+=scripts.length-added;
          result.skipped_duplicate += 1; continue;
        }
        if (item.classification === 'UNIMPORTABLE') { result.skipped_unimportable += 1; result.scripts_skipped+=scripts.length; continue; }
        if (item.classification === 'CONFLICT' && decisions[item.candidate_key] !== 'IMPORT_COPY') { result.skipped_conflict += 1; result.scripts_skipped+=scripts.length; continue; }
        const created = importCase(item, preview, current);
        result.scripts_added+=attachImportedScripts(created.versions[0],scripts,preview);
        current.cases.push(created); result.added += 1; result.imported_case_ids.push(created.case_id);
      }
      current.imports.push({ preview_id: previewId, upload_id: preview.upload_id, source_type: preview.source_type, confirmed_at: new Date().toISOString(), result: structuredClone(result) });
      return current;
    });
    await this.store.savePreview({ ...preview, status: 'CONFIRMED', confirmed_at: new Date().toISOString(), result }).catch(() => {});
    return { project, result, idempotent: false };
  }

  async exportPackage(projectId, caseIds, caseType = null) {
    const project = await this.store.getProject(projectId);
    if (!project) throw new Error('CASE_PROJECT_NOT_FOUND');
    if (caseType && !['UI','BACKEND'].includes(caseType)) throw Error('CASE_TYPE_INVALID');
    const pool = caseType ? project.cases.filter(item => {
      const content = currentContent(item);
      return content?.case_type === caseType && content.status === 'CONFIRMED';
    }) : project.cases;
    const selected = caseIds?.length ? pool.filter((item) => caseIds.includes(item.case_id)) : pool;
    if (!selected.length || (caseIds?.length && selected.length !== new Set(caseIds).size)) throw new Error('CASE_EXPORT_SELECTION_INVALID');
    const now = new Date().toISOString();
    const pkg = {
      schema: PACKAGE_SCHEMA, package_id: `case-package-${randomUUID()}`, exported_at: now,
      source_project: { project_id: project.project_id, name: project.name, revision: project.revision },
      cases: selected.map((item) => ({
        package_case_id: `${project.project_id}:${item.case_id}:v${item.current_version}`,
        source_version: item.current_version, root_source: structuredClone(item.root_source),
        lineage: [...item.lineage, { project_id: project.project_id, case_id: item.case_id, version: item.current_version, exported_at: now }],
        content: structuredClone(currentContent(item)),
      })),
    };
    if (this.scriptExporter) await this.scriptExporter(project, pkg);
    else for (const item of pkg.cases) {
      const current=project.cases.find(row=>row.case_id===item.lineage.at(-1).case_id)?.versions.find(v=>v.version===item.source_version);
      item.script_packages=validateScriptPackages((current?.imported_scripts||[]).map(row=>row.package),item.content);
    }
    if (Buffer.byteLength(JSON.stringify(pkg))>10*1024*1024) throw Error('CASE_SCRIPT_EXPORT_TOO_LARGE');
    return pkg;
  }
}
