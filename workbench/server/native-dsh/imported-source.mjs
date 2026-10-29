import {validateScriptPackages} from '../cases/script-package.mjs';
import {contentHash} from '../cases/excel.mjs';
import {formalEntry} from './execution-purpose.mjs';

const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
// Resolve only an owned, current imported UI case. Native diagnostics and ordinary
// DSH draft registrations cannot acquire execution rights through this source type.
export function importedRerunSource(project,selection){
  const item=project?.cases.find(row=>row.case_id===selection.case_id);
  const version=item?.versions.find(row=>row.version===selection.case_version);
  if(!version||item.current_version!==selection.case_version||!same(version.content_sha256,selection.content_sha256)||
    !same(contentHash(version.content),selection.content_sha256)||version.content.status!=='CONFIRMED'||version.content.case_type!=='UI')throw Error('NATIVE_DSH_CASE_CHANGED');
  const stored=version.imported_scripts?.find(row=>row.id===selection.source_draft_id);
  if(!stored)throw Error('NATIVE_DSH_RERUN_SOURCE_NOT_FOUND');
  const [pkg]=validateScriptPackages([stored.package],version.content);
  if(pkg.entry!==formalEntry(version.content.external_id))throw Error('NATIVE_DSH_FORMAL_ENTRY_MISMATCH');
  if(!same(pkg.script_sha256,selection.script_sha256)||!same(pkg.bundle_sha256,selection.bundle_sha256))throw Error('NATIVE_DSH_RERUN_SOURCE_CHANGED');
  return {entry:pkg.entry,script_sha256:pkg.script_sha256,bundle_sha256:pkg.bundle_sha256,importedPackage:pkg,content:structuredClone(version.content)};
}
