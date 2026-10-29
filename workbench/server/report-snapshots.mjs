import { renderReport } from './report-layout.mjs';
export { renderReport } from './report-layout.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveInside, sha256File } from './integrity.mjs';
import { selectProjectLatest, latestCountsFor } from './report-latest-selection.mjs';
import { readList } from './read-list.mjs';
const digest = x => createHash('sha256').update(x).digest('hex');
const safeBusinessQueryKeys = new Set(['page','keyword','category','status']);
const clean = (value, options = {}) => {
  const {httpEvidence = false, authorizedBusinessScopes = []} = options;
  if (Array.isArray(value)) return value.map(item => clean(item, options));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/cookie|token|secret|password|storageState|credential|cdp|authorization/i.test(k)).map(([k,v])=>[k,clean(v,options)]));
  return typeof value==='string'?value.replace(/(Bearer\s+)[\w.\-]+/gi,'$1[REDACTED]').replace(/((?:api[_-]?key|password|token|cookie)\s*[:=]\s*)[^\s,;&]+/gi,'$1[REDACTED]').replace(/https?:\/\/[^\s，。；！？、]+/g,url=>{try{
    const u=new URL(url);u.username='';u.password='';u.hash='';
    const scope=`${u.origin}${u.pathname}`;
    // Device evidence keeps its pre-existing, narrowly scoped code exception.
    if(httpEvidence&&/^\/api\/v1\/namespaces\/backend-run-[a-f0-9-]{36}\/devices$/.test(u.pathname)){
      for(const [key,value] of [...u.searchParams])u.searchParams.set(key,key==='code'&&value.length<=100&&!/[\x00-\x1f]/.test(value)?value:'[REDACTED]');
    }else if(authorizedBusinessScopes.includes(scope)){
      for(const [key,value] of [...u.searchParams]){
        if(/authorization|cookie|password|passwd|secret|token|api[-_]?key|session|credential/i.test(key))u.searchParams.set(key,'[REDACTED]');
        else if(!safeBusinessQueryKeys.has(key.toLowerCase())||/[\x00-\x1f]/.test(value))u.searchParams.set(key,'[REDACTED]');
      }
    }else u.search='';
    return u.toString();
  }catch{return '[URL]';}}):value;
};
const backendRequestScopes = evidence => {
  const scopes=new Set();
  for(const phase of ['setup','steps','cleanup'])for(const step of evidence?.[phase]||[])for(const item of step.requests||[]){
    try{const u=new URL(item.request?.url);scopes.add(`${u.origin}${u.pathname}`);}catch{}
  }
  return [...scopes];
};
const printable = value => {try{return JSON.stringify(value);}catch{return String(value);}};
const assertionLabel = assertion => {
  const target=assertion.target==='status'?'HTTP 状态码':assertion.target==='header'?'响应类型 Content-Type':assertion.pointer||'JSON';
  const described=assertion.op==='array_some_field_equals'?`${target} 任一记录的字段 ${assertion.field} 等于`:target;
  if(assertion.status==='FAILED'){
    const expected=Object.hasOwn(assertion,'expected')?printable(assertion.expected):'未提供';
    const actual=assertion.actual_exists===false?'字段缺失（actual_exists=false）':Object.hasOwn(assertion,'actual')?printable(assertion.actual):'实际值未记录';
    return `${described}：预期 ${expected}；实际 ${actual}`;
  }
  const actual=assertion.actual_exists===false?'字段缺失':Object.hasOwn(assertion,'actual')?printable(assertion.actual):'实际值未记录';
  return `${described}=${actual}`;
};
const backendStepSummaries = evidence => (evidence?.steps||[]).map(step=>{
  const assertions=(step.requests||[]).flatMap(request=>request.assertions||[]);
  const failed=assertions.filter(assertion=>assertion.status==='FAILED');
  let actual;
  if(step.status==='NOT_RUN'||!assertions.length&&step.status==='NOT_RUN')actual='未执行';
  else if(failed.length)actual=failed.map(assertionLabel).join('；');
  else if(assertions.length)actual=`${assertions.filter(assertion=>assertion.status==='PASSED').length} 项断言通过；实际示例：${assertions.filter(assertion=>assertion.status==='PASSED').slice(0,2).map(assertionLabel).join('；')}`;
  else actual='没有断言结果';
  return {order:step.order,status:step.status||'未记录',actual};
});

export class ReportSnapshots {
  #listCache = new Map();
  constructor({root,caseStore,batchManager,records,store,buildStore,nativeArtifact}) {Object.assign(this,{root,caseStore,batchManager,records,store,buildStore,nativeArtifact});this.queue=Promise.resolve();this.pending=new Map();}
  file(id) {if(!/^report-[a-f0-9]{40}$/.test(id))throw Error('REPORT_ID_INVALID');return path.join(this.root,id+'.json');}
  async get(id,project){const r=JSON.parse(await fs.readFile(this.file(id),'utf8'));if(r.project.project_id!==project)throw Error('REPORT_PROJECT_MISMATCH');return r;}
  async html(id,project){const r=await this.get(id,project),file=this.file(id).replace(/\.json$/,'.html');try{return await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}const html=renderReport(r);try{await fs.writeFile(file,html,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}return fs.readFile(file,'utf8');}
  async list(project){
    await fs.mkdir(this.root,{recursive:true});
    const files=(await fs.readdir(this.root)).filter(f=>/^report-[a-f0-9]{40}\.json$/.test(f));
    const present=new Set(files);
    for(const key of this.#listCache.keys())if(!present.has(key))this.#listCache.delete(key);
    const rows=await readList(files,async file=>{
      const filename=path.join(this.root,file),stat=await fs.stat(filename,{bigint:true});
      const signature=`${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
      const cached=this.#listCache.get(file);
      if(cached?.signature===signature)return cached.summary;
      const {entries,groups,...report}=JSON.parse(await fs.readFile(filename,'utf8'));
      const summary={...report,groups:groups?.map(({entries:groupEntries,...group})=>({...group,entry_count:groupEntries?.length||0})),entry_count:entries.length};
      // Retain only list metadata, never embedded screenshots or video entries.
      this.#listCache.set(file,{signature,summary});
      while(this.#listCache.size>256)this.#listCache.delete(this.#listCache.keys().next().value);
      return summary;
    });
    return structuredClone(rows.filter(r=>r.project.project_id===project));
  }
  async latestPreview(projectId,group_key='all'){
    const project=await this.caseStore.getProject(projectId);if(!project)throw Error('CASE_PROJECT_NOT_FOUND');
    const [records,batches]=await Promise.all([this.records(projectId),this.batchManager?.list?.(projectId) || []]);
    return selectProjectLatest(structuredClone(project),structuredClone(records),structuredClone(batches),{group_key});
  }
  create(projectId,input){const key=projectId+':'+input.request_id,fingerprint=digest(JSON.stringify(input)),prior=this.pending.get(key);if(prior)return prior.fingerprint===fingerprint?prior.promise:Promise.reject(Error('REPORT_REQUEST_CONFLICT'));const controller=new AbortController();const next=this.queue.then(()=>this.createSnapshot(projectId,input,controller.signal));const promise=next.finally(()=>this.pending.delete(key));this.pending.set(key,{controller,promise,fingerprint});this.queue=promise.catch(()=>{});return promise;}
  async cancel(projectId,input){const pending=this.pending.get(projectId+':'+input.request_id);if(pending){pending.controller.abort();return {state:'CANCEL_REQUESTED'};}const id='report-'+digest(projectId+':'+input.request_id).slice(0,40);try{const r=await this.get(id,projectId);return{state:'FINISHED',report_id:r.report_id};}catch(e){if(e.code!=='ENOENT')throw e;return{state:'NOT_FOUND'};}}
  async createSnapshot(projectId,input,signal){
    const checkCancelled=()=>{if(signal?.aborted)throw Error('REPORT_CANCELLED');};checkCancelled();
    if(!['batch','run','project_latest'].includes(input.scope)||!/^[-\w]{8,100}$/.test(input.request_id||'')||Object.keys(input).some(k=>!['scope','batch_id','run_id','group_key','request_id','include_video','include_trace'].includes(k))||
      (input.scope==='project_latest' && (input.batch_id||input.run_id||typeof input.group_key!=='string'))||
      (input.scope!=='project_latest' && input.group_key))throw Error('REPORT_SCOPE_INVALID');
    const reportId='report-'+digest(projectId+':'+input.request_id).slice(0,40),fingerprint=digest(JSON.stringify(input));
    try{const old=await this.get(reportId,projectId);if(old.fingerprint!==fingerprint)throw Error('REPORT_REQUEST_CONFLICT');return old;}catch(e){if(e.code!=='ENOENT')throw e;}
    const project=await this.caseStore.getProject(projectId);if(!project)throw Error('CASE_PROJECT_NOT_FOUND');
    const records=structuredClone(await this.records(projectId));let batch=null,items,latest=null;
    if(input.scope==='batch'){
      if(input.run_id)throw Error('REPORT_SCOPE_INVALID');batch=await this.batchManager.get(input.batch_id,projectId);
      if(!['FINISHED','CANCELLED','INTERRUPTED'].includes(batch.state))throw Error('REPORT_BATCH_NOT_FINISHED');items=batch.items;
    }else if(input.scope==='run'){
      if(input.batch_id)throw Error('REPORT_SCOPE_INVALID');const r=records.find(r=>r.run_id===input.run_id);if(!r)throw Error('REPORT_RUN_NOT_IN_PROJECT');
      items=[{case_id:r.executed_case_id,case_version:r.executed_case_version,external_id:r.executed_external_id,run_id:r.run_id,state:r.execution_status||'FINISHED'}];
    }else{
      const batches=structuredClone(await this.batchManager?.list?.(projectId) || []);
      latest=selectProjectLatest(structuredClone(project),records,batches,{group_key:input.group_key});
      items=latest.groups.flatMap(group=>group.entries.map(e=>({...e,group_key:group.group_key,
        case_id:e.case_id,external_id:e.external_id,state:e.state})));
    }
    const entries=[];let total=0;
    for(const item of items){
      checkCancelled();
      const run=item.run_id?records.find(r=>r.run_id===item.run_id&&r.executed_case_id===item.case_id&&r.executed_case_version===item.case_version):null;
      if(item.run_id&&!run)throw Error('REPORT_RUN_IDENTITY_MISMATCH');
      if(run&&['QUEUED','RUNNING','STOPPING'].includes(run.execution_status)&&!latest)throw Error('REPORT_RUN_NOT_FINISHED');
      const mutableRun=latest&&run&&['QUEUED','RUNNING','STOPPING'].includes(run.execution_status);
      const content=run?.frozen_case_content||project.cases.find(c=>c.case_id===item.case_id)?.versions.find(v=>v.version===item.case_version)?.content;
      const authorizedBusinessScopes=run?.schema==='workbench/backend-run-v1'?backendRequestScopes(run.http_evidence):[];
      const httpEvidence=clean(run?.http_evidence||null,{httpEvidence:run?.schema==='workbench/backend-run-v1',authorizedBusinessScopes});
      const stepEvidence=run?.schema==='workbench/backend-run-v1'&&run.http_evidence
        ?backendStepSummaries(httpEvidence)
        :clean(run?.step_replay?.steps||run?.step_coverage?.items||run?.steps||[],{authorizedBusinessScopes});
      const entry={case_id:item.case_id,external_id:item.external_id,title:content?.title||item.title,case_version:item.case_version,content_sha256:run?.executed_content_sha256||run?.content_sha256||item.content_sha256,
        service_identity:run?.service_identity||null,failure_category:run?.failure_category||null,fidelity_review:clean(run?.fidelity_review||null),
        run_id:run?.run_id||null,script_version:run?.script_version||null,candidate_version:run?.candidate_version||item.selection?.candidate_version||null,bundle_sha256:run?.bundle_sha256||item.selection?.bundle_sha256||null,
        software_version:batch?.software_version||run?.software_version||null,environment:clean(run?.environment_binding||item.environment_identity||null),
        state:item.state,result:latest?item.result:run?.status||'NOT_RUN',qualification:run?.qualification||run?.approval_status||item.qualification||'NOT_APPROVED',product_approval_status:run?.approval_status||'NOT_APPROVED',review:clean(run?.requirement_review||item.requirement_review||null),
        reason:item.reason||run?.reason||null,error:clean(mutableRun?null:run?.error||run?.result?.error||run?.technical_error||null),content:clean(content,{authorizedBusinessScopes}),steps:mutableRun?[]:stepEvidence,
        http_evidence:mutableRun?null:httpEvidence,evidence_status:latest?item.evidence_status|| (run?.http_evidence?'HTTP_REQUEST_RESPONSE_ASSERTIONS':'NOT_COLLECTED'):run?.http_evidence?'HTTP_REQUEST_RESPONSE_ASSERTIONS':run?.evidence_status||'NOT_COLLECTED',media:[],
        ...(latest?{group_key:item.group_key,case_type:item.case_type,started_at:item.started_at,finished_at:item.finished_at,retest_count:item.retest_count,previous_run_id:item.previous_run_id,batch_id:item.batch_id}:{} )};
      if(run&&!mutableRun){
        const native=run.schema==='workbench/native-dsh-report-run-v1';
        const legacyRoot=native?null:run.schema==='workbench/backend-run-v1'||run.origin==='EXPLICIT_CANDIDATE_TRIAL'?this.store.runDirectory(run.run_id):this.buildStore.taskDirectory(run.source_build_task_id);
        for(const media of run.files||[]){
          checkCancelled();
          const kind=/screenshot$/.test(media.kind)?'image':/video$/.test(media.kind)?'video':/trace$/.test(media.kind)?'trace':null;if(!kind)continue;
          const include=kind==='image'||kind==='video'&&input.include_video===true||kind==='trace'&&input.include_trace===true;
          const attachment={file_id:media.file_id,name:path.basename(media.relative_path),kind,sha256:media.sha256,bytes:media.bytes,included:false,reason:include?null:'未选择随报告携带'};
          if(include){
            try{
              const registered=native?await this.nativeArtifact(projectId,run.task_id,media.file_id):null;
              if(native&&(!registered||registered.media.relative_path!==media.relative_path||registered.media.sha256?.toUpperCase()!==media.sha256||registered.media.bytes!==media.bytes))throw Error('MEDIA_IDENTITY_MISMATCH');
              const root=native?registered.root:legacyRoot;
              const realRoot=await fs.realpath(root),file=await fs.realpath(resolveInside(root,media.relative_path));
              if(!file.startsWith(realRoot+path.sep)||await sha256File(file)!==media.sha256)throw Error('MEDIA_INTEGRITY_FAILED');
              const stat=await fs.stat(file);if(stat.size!==media.bytes)throw Error('MEDIA_SIZE_CHANGED');
              if(total+stat.size>80*1024*1024)throw Error('REPORT_ATTACHMENT_SIZE_LIMIT_80MB');
              const bytes=await fs.readFile(file);total+=bytes.length;
              const type=kind==='image'?'image/png':kind==='video'?'video/webm':'application/zip';
              attachment.data_url=`data:${type};base64,${bytes.toString('base64')}`;attachment.included=true;
            }catch(e){attachment.reason=e.message;}
          }entry.media.push(attachment);
        }
      }
      if(latest&&entry.media.some(m=>m.reason&&m.reason!=='未选择随报告携带')){
        entry.evidence_status='INCOMPLETE';
        if(entry.state==='PASSED')entry.state='INCOMPLETE';
      }
      if(run?.origin==='NATIVE_DSH'&&entry.media.some(m=>m.reason&&m.reason!=='未选择随报告携带'))entry.evidence_status='INCOMPLETE';
      if(run?.origin==='NATIVE_DSH'&&entry.result==='PASSED'&&entry.evidence_status!=='COMPLETE')entry.state='INCOMPLETE';
      entries.push(entry);
    }
    const frozenGroups=latest?.groups.map(({entries:groupEntries,...group})=>{
      const selected=groupEntries.map(e=>entries.find(x=>x.group_key===group.group_key&&x.case_id===e.case_id));
      return {...group,counts:latestCountsFor(selected),entries:selected.map(e=>({group_key:e.group_key,case_id:e.case_id,run_id:e.run_id}))};
    });
    const frozenCounts=latest?{...latestCountsFor(entries),count_unit:'CASE_SCOPE'}:null;
    const snapshot={schema:'workbench/report-snapshot-v1',report_id:reportId,fingerprint,created_at:new Date().toISOString(),report_service_identity:this.serviceIdentity||null,project:{project_id:projectId,name:clean(project.name)},scope:input.scope,batch_id:batch?.batch_id||null,run_id:input.scope==='run'?input.run_id:null,attachment_bytes:total,
      counts:frozenCounts||{requested:entries.length,executed:entries.filter(e=>['PASSED','FAILED','TIMEDOUT','TIMED_OUT','ERROR','CANCELLED'].includes(e.result)).length,passed:entries.filter(e=>e.result==='PASSED'&&e.state!=='INCOMPLETE').length,failed:entries.filter(e=>['FAILED','TIMEDOUT','TIMED_OUT','ERROR','CANCELLED'].includes(e.result)).length,...(entries.some(e=>e.state==='INCOMPLETE')?{incomplete:entries.filter(e=>e.state==='INCOMPLETE').length}:{}),not_run:entries.filter(e=>!['PASSED','FAILED','TIMEDOUT','TIMED_OUT','ERROR','CANCELLED'].includes(e.result)).length},entries,
      ...(latest?{group_key:latest.group_key,case_count:latest.case_count,entry_count:entries.length,cutoff_at:latest.cutoff_at,
        groups:frozenGroups,group_options:latest.group_options}:{} )};
    await fs.mkdir(this.root,{recursive:true});checkCancelled();await fs.writeFile(this.file(reportId),JSON.stringify(snapshot),{flag:'wx'});await this.html(reportId,projectId);return snapshot;
  }
}
