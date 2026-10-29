import {readFrozenNativeFile} from './console.mjs';
import {validateScriptPackages} from '../cases/script-package.mjs';

// Only registered case sources qualify. Mutable workspaces and diagnostics are never exported.
export async function exportNativeScriptPackages(manager,project,pkg){
  const console=await manager.console(project.project_id);
  for(const item of pkg.cases){
    const caseId=item.lineage.at(-1).case_id;
    const current=row=>row.case_id===caseId&&row.case_version===item.source_version&&row.applies_to_current_version;
    const sources=[...console.records.filter(row=>current(row)&&row.recorded_counts_for_case),...console.drafts.filter(current)]
      .sort((a,b)=>String(b.finished_at||b.created_at||b.started_at||'').localeCompare(String(a.finished_at||a.created_at||a.started_at||'')));
    const latest=sources[0];
    if(!latest){item.script_packages=[];item.script_export_status='NO_CURRENT_SCRIPT';continue;}
    if(!latest.source?.available)throw Error('CASE_SCRIPT_EXPORT_SOURCE_UNAVAILABLE');
    if(latest.origin==='IMPORTED_SCRIPT'){
      const version=project.cases.find(row=>row.case_id===caseId).versions.find(row=>row.version===item.source_version);
      item.script_packages=validateScriptPackages([version.imported_scripts.find(row=>row.id===latest.draft_id).package],item.content);
    }else{
      const store=latest.draft_id?'drafts':'runs',id=latest.draft_id||latest.run_id;
      const read=relative=>readFrozenNativeFile(manager.directory(project.project_id),id,relative,store);
      const manifest=JSON.parse(await read('source-manifest.json'));
      const files=[];
      for(const file of manifest.files)files.push({path:file.path,content_base64:(await read(`snapshot/${file.path}`)).toString('base64')});
      item.script_packages=validateScriptPackages([{schema:'workbench/script-package-v1',runtime:'PLAYWRIGHT',entry:latest.entry,case_content_sha256:latest.content_sha256,
        script_sha256:latest.script_sha256,bundle_sha256:latest.bundle_sha256,manifest:manifest.files,files,
        provenance:{project_id:project.project_id,case_id:caseId,case_version:item.source_version,task_id:latest.task_id,record_id:id}}],item.content);
    }
    item.script_export_status='INCLUDED';
  }
}
