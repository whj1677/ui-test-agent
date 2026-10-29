import path from 'node:path';
import {createHash} from 'node:crypto';
import {contentHash} from './excel.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;
const schema='workbench/script-package-v1';
const forbidden=/^(?:\.private|node_modules|\.git|\.auth|\.dsh|\.sessions|\.env(?:\..*)?|execute\.mjs|current-task\.json|.*(?:credentials|storage[-_]?state|auth[-_]?state|session[-_]?state|cookies|tokens).*\.json|.*\.(?:pem|key|pfx))$/i;
export function scriptPath(value){
  if(typeof value!=='string'||value.length>500||/[\\:\x00-\x1f]/.test(value)||path.posix.isAbsolute(value)||path.posix.normalize(value)!==value||value.split('/').some(p=>!p||p==='.'||p==='..'||forbidden.test(p)))throw Error('CASE_SCRIPT_PATH_INVALID');
  if(!/\.(?:mjs|cjs|js|ts|json)$/i.test(value))throw Error('CASE_SCRIPT_PATH_INVALID');
  return value;
}

// The package is data only. Importing never evaluates, installs or executes it.
export function validateScriptPackages(value,content){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>20)throw Error('CASE_SCRIPT_PACKAGE_INVALID');
  return value.map(item=>{
    if(item?.schema!==schema||item.runtime!=='PLAYWRIGHT'||!sha(item.script_sha256)||!sha(item.bundle_sha256)||
      sha(item.case_content_sha256)!==contentHash(content).toLowerCase()||!Array.isArray(item.manifest)||!item.manifest.length||item.manifest.length>1000||
      !Array.isArray(item.files)||item.files.length!==item.manifest.length)throw Error('CASE_SCRIPT_PACKAGE_INVALID');
    const entry=scriptPath(item.entry),seen=new Set();let total=0;
    const manifest=structuredClone(item.manifest);
    const files=manifest.map((file,index)=>{
      const name=scriptPath(file.path),key=name.toLowerCase(),payload=item.files[index];
      if(seen.has(key)||Object.keys(file).some(k=>!['path','bytes','sha256'].includes(k))||!sha(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>2*1024*1024||
        payload?.path!==name||typeof payload.content_base64!=='string'||payload.content_base64.length>3*1024*1024)throw Error('CASE_SCRIPT_PACKAGE_INVALID');
      seen.add(key);const bytes=Buffer.from(payload.content_base64,'base64');total+=bytes.length;
      if(total>10*1024*1024||bytes.length!==file.bytes||bytes.toString('base64')!==payload.content_base64||digest(bytes)!==sha(file.sha256))throw Error('CASE_SCRIPT_FILE_MISMATCH');
      return {path:name,content_base64:payload.content_base64};
    });
    if(digest(JSON.stringify(manifest))!==sha(item.bundle_sha256)||sha(manifest.find(f=>f.path===entry)?.sha256)!==sha(item.script_sha256))throw Error('CASE_SCRIPT_BUNDLE_MISMATCH');
    const provenance={};
    for(const key of ['project_id','case_id','case_version','task_id','record_id']){
      const v=item.provenance?.[key];
      if(v===undefined)continue;
      if(key==='case_version'?(!Number.isSafeInteger(v)||v<1):(typeof v!=='string'||!v||v.length>160||!/^[\w.-]+$/.test(v)))throw Error('CASE_SCRIPT_PACKAGE_INVALID');
      provenance[key]=v;
    }
    return {schema,runtime:'PLAYWRIGHT',entry,case_content_sha256:sha(item.case_content_sha256),script_sha256:sha(item.script_sha256),bundle_sha256:sha(item.bundle_sha256),manifest,files,provenance};
  });
}

export function attachImportedScripts(version,scripts,preview){
  let added=0;
  for(const pkg of scripts){
    const id=`imported-script-${digest(JSON.stringify([pkg.entry,pkg.script_sha256,pkg.bundle_sha256]))}`;
    if(version.imported_scripts?.some(row=>row.id===id))continue;
    (version.imported_scripts||=[]).push({id,imported_at:new Date().toISOString(),source_package_id:preview.source_detail.package_id,package:structuredClone(pkg)});added++;
  }
  return added;
}

const prefix=(project,item,version,stored)=>`/api/case-library/projects/${encodeURIComponent(project.project_id)}/imported-scripts/${encodeURIComponent(item.case_id)}/${version.version}/${stored.id}/files/`;
export function importedScriptDrafts(project){
  const drafts=[];
  for(const item of project.cases)for(const version of item.versions)for(const stored of version.imported_scripts||[]){
    let pkg,reason=null;
    try{[pkg]=validateScriptPackages([stored.package],version.content);}catch{pkg=stored.package||{};reason='CASE_SCRIPT_PACKAGE_INVALID';}
    const url=prefix(project,item,version,stored),entryIndex=pkg.files?.findIndex(f=>f.path===pkg.entry);
    const artifacts=reason?[]:pkg.manifest.map((file,index)=>({id:`${stored.id}-${index}`,name:file.path,relative_path:file.path,bytes:file.bytes,sha256:file.sha256,kind:'source',content_type:'text/plain',url:url+index}));
    drafts.push({origin:'IMPORTED_SCRIPT',project_id:project.project_id,task_id:null,draft_id:stored.id,case_id:item.case_id,external_id:version.content.external_id,title:version.content.title,
      case_version:version.version,content_sha256:version.content_sha256.toLowerCase(),binding_status:item.current_version===version.version?'CURRENT':'HISTORICAL',applies_to_current_version:item.current_version===version.version,
      created_at:stored.imported_at,entry:pkg.entry,draft_status:'UNEXECUTED',execution_status:'NOT_RUN',evidence_status:'NOT_CAPTURED',counts_for_case:false,human_review_status:'NOT_REVIEWED',
      script_sha256:pkg.script_sha256,bundle_sha256:pkg.bundle_sha256,provenance:pkg.provenance,artifacts,
      source:{available:!reason,reason,script_url:reason?null:url+entryIndex,manifest_url:reason?null:url+'manifest'}});
  }
  return drafts;
}

export function importedScriptFile(project,caseId,versionNumber,id,fileId){
  const item=project.cases.find(row=>row.case_id===caseId),version=item?.versions.find(row=>row.version===Number(versionNumber));
  const stored=version?.imported_scripts?.find(row=>row.id===id);
  if(!stored)throw Error('CASE_SCRIPT_NOT_FOUND');
  const [pkg]=validateScriptPackages([stored.package],version.content);
  if(fileId==='manifest')return {name:'source-manifest.json',body:Buffer.from(JSON.stringify({...pkg,files:undefined},null,2))};
  if(!/^(?:0|[1-9]\d{0,3})$/.test(fileId)||!pkg.files[Number(fileId)])throw Error('CASE_SCRIPT_NOT_FOUND');
  const file=pkg.files[Number(fileId)];return {name:path.posix.basename(file.path),body:Buffer.from(file.content_base64,'base64')};
}
