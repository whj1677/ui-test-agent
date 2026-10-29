import ExcelJS from 'exceljs';
import { contentHash } from './excel.mjs';
import { newCaseId } from './store.mjs';

export function caseType(content) { return content?.case_type || 'UNCLASSIFIED'; }
export function typedMetadata(content) {
  const result = {};
  if (!content.requirements_origin && (content.requirements_review || content.source_refs || content.steps?.some(s => s.source_refs?.length))) throw Error('CASE_DESIGN_REVIEW_REQUIRED');
  if (content.case_type !== undefined) {
    if (!['UI', 'BACKEND'].includes(content.case_type)) throw Error('CASE_TYPE_INVALID');
    result.case_type = content.case_type;
  }
  for (const key of ['requirements_origin', 'requirements_review', 'source_refs']) if (content[key] !== undefined) result[key] = structuredClone(content[key]);
  return result;
}

export function assertDesignImport(project, content, rootSource) {
  if (!content.requirements_origin) return;
  const origin = content.requirements_origin;
  const known = project.cases.find(c => c.versions.some(v => v.content_sha256 === contentHash(content) &&
    v.content.requirements_origin?.design_id === origin.design_id && v.content.requirements_origin?.candidate_id === origin.candidate_id));
  if (origin.project_id !== project.project_id || !known || contentHash(known.root_source)!==contentHash(rootSource || {})) throw Error('CASE_DESIGN_REVIEW_REQUIRED');
}

export async function confirmDesignedCases(store, { projectId, projectRevision, designId, candidates }) {
  if (!candidates?.length || new Set(candidates.map(c => c.candidate_id)).size !== candidates.length || new Set(candidates.map(c => c.root_source?.stable_id)).size !== candidates.length) throw Error('CASE_DESIGN_SELECTION_INVALID');
  const targets=candidates.filter(c=>c.target_case).map(c=>c.target_case.case_id);
  if(new Set(targets).size!==targets.length)throw Error('CASE_DESIGN_SELECTION_INVALID');
  const prepared = candidates.map(candidate => {
    if (candidate.root_source?.stable_id !== `requirements:${designId}:${candidate.candidate_id}`) throw Error('CASE_DESIGN_IDENTITY_INVALID');
    const content = { ...structuredClone(candidate.content), case_type: candidate.case_type,
      source_refs: structuredClone(candidate.source_refs || []), status: 'CONFIRMED',
      requirements_origin: { project_id: projectId, design_id: designId, candidate_id: candidate.candidate_id } };
    typedMetadata(content);
    if (!content.steps?.length || content.steps.some((s, i) => s.order !== i + 1 || !s.action?.trim() || !s.expected?.trim())) throw Error('CASE_DESIGN_CONTENT_INVALID');
    return { candidate, content, hash: contentHash(content) };
  });
  const match = (project, p) => {
    const target=p.candidate.target_case;
    const item = target ? project.cases.find(c=>c.case_id===target.case_id) : project.cases.find(c => c.root_source.stable_id === p.candidate.root_source.stable_id);
    if(target){
      if(!item || item.root_source.type!=='requirements-design')throw Error('CASE_DESIGN_REVISION_TARGET_INVALID');
      const existing=item.versions.find(v=>v.content_sha256===p.hash);
      if(existing)return{candidate_id:p.candidate.candidate_id,case_id:item.case_id,version:existing.version};
      const current=item.versions.find(v=>v.version===item.current_version);
      if(item.current_version!==target.case_version||current.content_sha256!==target.content_sha256)throw Error('CASE_DESIGN_REVISION_TARGET_STALE');
      return null;
    }
    if (!item) return null;
    const version = item.versions.find(v => v.content_sha256 === p.hash);
    if (!version) throw Error('CASE_DESIGN_CONFIRM_CONFLICT');
    return { candidate_id: p.candidate.candidate_id, case_id: item.case_id, version: version.version };
  };
  const before = await store.getProject(projectId);
  if (!before) throw Error('CASE_PROJECT_NOT_FOUND');
  const previous = prepared.map(p => match(before, p));
  if (previous.every(Boolean)) return { cases: previous };
  const rows = [];
  await store.updateProject(projectId, projectRevision, project => {
    const now = new Date().toISOString();
    for (const p of prepared) {
      const existing = match(project, p);
      if (existing) { rows.push(existing); continue; }
      const { candidate, content } = p;
      if(candidate.target_case){
        const item=project.cases.find(c=>c.case_id===candidate.target_case.case_id);
        const next=item.current_version+1;
        item.versions.push({version:next,content,content_sha256:p.hash,created_at:now,source:'REQUIREMENTS_REVISION_CONFIRMED'});
        Object.assign(item,{external_id:content.external_id,title:content.title,module:content.module,status:'CONFIRMED',current_version:next,updated_at:now});
        item.lineage.push({project_id:projectId,case_id:item.case_id,version:next,change:'REQUIREMENTS_REVISION_CONFIRMED',design_id:designId,at:now});
        rows.push({candidate_id:candidate.candidate_id,case_id:item.case_id,version:next});
        continue;
      }
      const id = newCaseId();
      project.cases.push({ case_id: id, external_id: content.external_id, title: content.title, module: content.module,
        status: 'CONFIRMED', current_version: 1, root_source: structuredClone(candidate.root_source),
        lineage: [{ project_id: projectId, case_id: id, version: 1, change: 'REQUIREMENTS_CONFIRMED', at: now }],
        import_batch_id: designId, created_at: now, updated_at: now,
        versions: [{ version: 1, content, content_sha256: contentHash(content), created_at: now, source: 'REQUIREMENTS_CONFIRMED' }] });
      rows.push({ candidate_id: candidate.candidate_id, case_id: id, version: 1 });
    }
    return project;
  });
  return { cases: rows };
}

export async function exportCasesWorkbook(pkg) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('测试用例');
  const { WORKBOOK_HEADERS, visibleCaseRow, addWorkbookPackage } = await import('./workbook-package.mjs');
  sheet.columns = WORKBOOK_HEADERS.map(header => ({ header, key: header, width: ['步骤','预期','来源'].includes(header) ? 50 : 22 }));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const item of pkg.cases) sheet.addRow(visibleCaseRow(item));
  addWorkbookPackage(workbook, pkg);
  sheet.getRow(1).font = { bold: true };
  sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
