import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveInside, sha256File } from './integrity.mjs';
const digest = x => createHash('sha256').update(x).digest('hex');
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = value => {
  if (Array.isArray(value)) return value.map(clean);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/cookie|token|secret|password|storageState|credential|cdp|authorization/i.test(k)).map(([k,v])=>[k,clean(v)]));
  return typeof value==='string'?value.replace(/(Bearer\s+)[\w.\-]+/gi,'$1[REDACTED]').replace(/((?:api[_-]?key|password|token|cookie)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]').replace(/https?:\/\/[^\s]+/g,url=>{try{const u=new URL(url);u.username='';u.password='';u.search='';return u.toString();}catch{return '[URL]';}}):value;
};

export class ReportSnapshots {
  constructor({root,caseStore,batchManager,records,store,buildStore}) {Object.assign(this,{root,caseStore,batchManager,records,store,buildStore});this.queue=Promise.resolve();this.pending=new Map();}
  file(id) {if(!/^report-[a-f0-9]{40}$/.test(id))throw Error('REPORT_ID_INVALID');return path.join(this.root,id+'.json');}
  async get(id,project){const r=JSON.parse(await fs.readFile(this.file(id),'utf8'));if(r.project.project_id!==project)throw Error('REPORT_PROJECT_MISMATCH');return r;}
  async html(id,project){const r=await this.get(id,project),file=this.file(id).replace(/\.json$/,'.html');try{return await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}const html=renderReport(r);try{await fs.writeFile(file,html,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}return fs.readFile(file,'utf8');}
  async list(project){await fs.mkdir(this.root,{recursive:true});const rows=await Promise.all((await fs.readdir(this.root)).filter(f=>/^report-[a-f0-9]{40}\.json$/.test(f)).map(async f=>JSON.parse(await fs.readFile(path.join(this.root,f),'utf8'))));return rows.filter(r=>r.project.project_id===project).map(({entries,...r})=>({...r,entry_count:entries.length}));}
  create(projectId,input){const key=projectId+':'+input.request_id,fingerprint=digest(JSON.stringify(input)),prior=this.pending.get(key);if(prior)return prior.fingerprint===fingerprint?prior.promise:Promise.reject(Error('REPORT_REQUEST_CONFLICT'));const controller=new AbortController();const next=this.queue.then(()=>this.createSnapshot(projectId,input,controller.signal));const promise=next.finally(()=>this.pending.delete(key));this.pending.set(key,{controller,promise,fingerprint});this.queue=promise.catch(()=>{});return promise;}
  async cancel(projectId,input){const pending=this.pending.get(projectId+':'+input.request_id);if(pending){pending.controller.abort();return {state:'CANCEL_REQUESTED'};}const id='report-'+digest(projectId+':'+input.request_id).slice(0,40);try{const r=await this.get(id,projectId);return{state:'FINISHED',report_id:r.report_id};}catch(e){if(e.code!=='ENOENT')throw e;return{state:'NOT_FOUND'};}}
  async createSnapshot(projectId,input,signal){
    const checkCancelled=()=>{if(signal?.aborted)throw Error('REPORT_CANCELLED');};checkCancelled();
    if(!['batch','run'].includes(input.scope)||!/^[-\w]{8,100}$/.test(input.request_id||'')||Object.keys(input).some(k=>!['scope','batch_id','run_id','request_id','include_video','include_trace'].includes(k)))throw Error('REPORT_SCOPE_INVALID');
    const reportId='report-'+digest(projectId+':'+input.request_id).slice(0,40),fingerprint=digest(JSON.stringify(input));
    try{const old=await this.get(reportId,projectId);if(old.fingerprint!==fingerprint)throw Error('REPORT_REQUEST_CONFLICT');return old;}catch(e){if(e.code!=='ENOENT')throw e;}
    const project=await this.caseStore.getProject(projectId);if(!project)throw Error('CASE_PROJECT_NOT_FOUND');
    const records=await this.records(projectId);let batch=null,items;
    if(input.scope==='batch'){
      if(input.run_id)throw Error('REPORT_SCOPE_INVALID');batch=await this.batchManager.get(input.batch_id,projectId);
      if(!['FINISHED','CANCELLED','INTERRUPTED'].includes(batch.state))throw Error('REPORT_BATCH_NOT_FINISHED');items=batch.items;
    }else{
      if(input.batch_id)throw Error('REPORT_SCOPE_INVALID');const r=records.find(r=>r.run_id===input.run_id);if(!r)throw Error('REPORT_RUN_NOT_IN_PROJECT');
      items=[{case_id:r.executed_case_id,case_version:r.executed_case_version,external_id:r.executed_external_id,run_id:r.run_id,state:r.execution_status||'FINISHED'}];
    }
    const entries=[];let total=0;
    for(const item of items){
      checkCancelled();
      const run=item.run_id?records.find(r=>r.run_id===item.run_id&&r.executed_case_id===item.case_id&&r.executed_case_version===item.case_version):null;
      if(item.run_id&&!run)throw Error('REPORT_RUN_IDENTITY_MISMATCH');
      if(run&&['QUEUED','RUNNING','STOPPING'].includes(run.execution_status))throw Error('REPORT_RUN_NOT_FINISHED');
      const content=run?.frozen_case_content||project.cases.find(c=>c.case_id===item.case_id)?.versions.find(v=>v.version===item.case_version)?.content;
      const entry={case_id:item.case_id,external_id:item.external_id,title:content?.title||item.title,case_version:item.case_version,content_sha256:run?.executed_content_sha256||item.content_sha256,
        service_identity:run?.service_identity||null,failure_category:run?.failure_category||null,fidelity_review:clean(run?.fidelity_review||null),
        run_id:run?.run_id||null,script_version:run?.script_version||null,candidate_version:run?.candidate_version||item.selection?.candidate_version||null,bundle_sha256:run?.bundle_sha256||item.selection?.bundle_sha256||null,
        software_version:batch?.software_version||run?.software_version||null,environment:clean(run?.environment_binding||item.environment_identity||null),
        state:item.state,result:run?.status||'NOT_RUN',qualification:run?.approval_status||item.qualification||'NOT_APPROVED',review:clean(run?.requirement_review||item.requirement_review||null),
        reason:item.reason||null,error:clean(run?.error||run?.result?.error||run?.technical_error||null),content:clean(content),steps:clean(run?.step_replay?.steps||run?.step_coverage?.items||[]),
        evidence_status:run?.evidence_status||'NOT_COLLECTED',media:[]};
      if(run){
        const root=run.origin==='EXPLICIT_CANDIDATE_TRIAL'?this.store.runDirectory(run.run_id):this.buildStore.taskDirectory(run.source_build_task_id);
        for(const media of run.files||[]){
          checkCancelled();
          const kind=/screenshot$/.test(media.kind)?'image':/video$/.test(media.kind)?'video':/trace$/.test(media.kind)?'trace':null;if(!kind)continue;
          const include=kind==='image'||kind==='video'&&input.include_video===true||kind==='trace'&&input.include_trace===true;
          const attachment={file_id:media.file_id,name:path.basename(media.relative_path),kind,sha256:media.sha256,bytes:media.bytes,included:false,reason:include?null:'未选择随报告携带'};
          if(include){
            try{
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
      }entries.push(entry);
    }
    const snapshot={schema:'workbench/report-snapshot-v1',report_id:reportId,fingerprint,created_at:new Date().toISOString(),report_service_identity:this.serviceIdentity||null,project:{project_id:projectId,name:clean(project.name)},scope:input.scope,batch_id:batch?.batch_id||null,run_id:input.scope==='run'?input.run_id:null,attachment_bytes:total,
      counts:{requested:entries.length,executed:entries.filter(e=>['PASSED','FAILED','TIMEDOUT'].includes(e.result)).length,passed:entries.filter(e=>e.result==='PASSED').length,failed:entries.filter(e=>['FAILED','TIMEDOUT'].includes(e.result)).length,not_run:entries.filter(e=>!['PASSED','FAILED','TIMEDOUT'].includes(e.result)).length},entries};
    await fs.mkdir(this.root,{recursive:true});checkCancelled();await fs.writeFile(this.file(reportId),JSON.stringify(snapshot),{flag:'wx'});await this.html(reportId,projectId);return snapshot;
  }
}
const label = value => ({PASSED:'通过',FAILED:'失败',TIMEDOUT:'超时',NOT_RUN:'未执行',COMPLETE:'完整',INCOMPLETE:'不完整',NOT_COLLECTED:'未采集',NOT_APPROVED:'未批准',LIMITED_TECHNICAL_TRIAL_NOT_APPROVED:'限定技术试跑，未批准',NO_APPLICABLE_SCRIPT:'没有适用脚本',REVIEWED_COMPLETE_FOR_THIS_CASE:'本次核查完整，未批准',BUSINESS_DIFFERENCE_RETAINED:'业务差异保留，待核对',NOT_ACCEPTED_ACTION_CHANGED:'动作或预期偏离，不采纳',BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP:'覆盖不足，业务差异保留',FROZEN_CASE_INPUT_CONFLICT:'原用例输入矛盾，待澄清',REVIEW_REQUIRED_PRECONDITION_ADDED:'前置条件待确认'}[value] || value);
export function renderReport(r){
  const entries=r.entries.map(e=>`<section><h2>${esc(e.external_id)} · ${esc(e.title)}</h2><p>用例 v${e.case_version} · 脚本 ${esc(e.script_version||'历史未编号')} / 候选 ${esc(e.candidate_version||'无')} · 被测版本 ${esc(e.software_version||'未提供')}</p><p>原始执行：<b>${esc(label(e.result))}</b> · 要求核对：${esc(label(e.review?.requirements_status)||'未核对')} · 脚本资格：${esc(label(e.qualification))} · 媒体：${esc(label(e.evidence_status))}</p><p>${esc(e.review?.finding||'')} ${esc(e.reason||'')}</p><details><summary>环境与角色依据</summary><pre>${esc(JSON.stringify(e.environment||'未记录',null,2))}</pre></details><h3>原要求</h3><p>${esc(e.content?.preconditions||'')}</p><p>${esc(e.content?.test_data||'')}</p><table><thead><tr><th>步骤</th><th>原动作</th><th>原预期</th><th>实际状态 / 值</th></tr></thead><tbody>${(e.content?.steps||[]).map(s=>{const fact=e.steps.find(t=>t.order===s.order||t.step_id===`CASE_STEP_${s.order}`||t.marker===`CASE_STEP_${s.order}`);return `<tr><td>${s.order}</td><td>${esc(s.action)}</td><td>${esc(s.expected)}</td><td>${esc(fact?.execution_status||fact?.status||'未取得')} / ${esc(fact?.actual||'未取得')}</td></tr>`;}).join('')}</tbody></table><h3>原始错误</h3><pre>${esc(e.error?JSON.stringify(e.error,null,2):'未记录错误；实际值以步骤及本次证据为准，不从预期推测')}</pre><h3>同一次运行的证据</h3>${e.media.map(m=>`<article><p>${esc(m.name)} · ${esc(m.kind)} · ${m.bytes} 字节 · SHA256 ${esc(m.sha256)}</p>${m.included?m.kind==='image'?`<img src="${m.data_url}" alt="${esc(e.external_id)} 本次截图"><a download="${esc(m.name)}" href="${m.data_url}">下载截图</a>`:m.kind==='video'?`<p>${m.name.includes('step-replay')?'中文步骤证据回放（非原始连续录像）':'原始连续录像；历史录制可能清晰度有限'}</p><video controls preload="metadata" src="${m.data_url}"></video><a download="${esc(m.name)}" href="${m.data_url}">下载视频</a>`:`<a download="${esc(m.name)}" href="${m.data_url}">下载 Trace</a>`:`<p>未携带：${esc(m.reason)}</p>`}</article>`).join('')||'<p>无本次可用媒体，不使用其他记录素材。</p>'}<details><summary>固定身份</summary><pre>${esc(JSON.stringify({case_id:e.case_id,run_id:e.run_id,content_sha256:e.content_sha256,bundle_sha256:e.bundle_sha256,service_identity:e.service_identity||null,failure_category:e.failure_category||null,fidelity_review:e.fidelity_review||null},null,2))}</pre></details></section>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src data:; base-uri 'none'"><title>${esc(r.project.name)} · 测试报告</title><style>body{max-width:1100px;margin:40px auto;padding:24px;font:14px/1.65 'Microsoft YaHei',sans-serif;color:#252525;background:#f7f7f6}section{background:white;border:1px solid #e2e3df;border-radius:8px;padding:24px;margin:24px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;text-align:left;padding:10px;vertical-align:top}p,pre,td{white-space:pre-wrap;overflow-wrap:anywhere}img,video{max-width:100%}h1{font-size:26px}h2{font-size:20px}a{display:inline-block;padding:10px}</style><h1>${esc(r.project.name)} · 测试报告</h1><p>固定范围：${r.scope==='batch'?'指定测试批次':'指定用例的指定运行'} · ${esc(r.batch_id||r.run_id)}<br>快照 ${esc(r.report_id)} · ${esc(r.created_at)}</p><p>请求 ${r.counts.requested} · 已执行 ${r.counts.executed} · 原始通过 ${r.counts.passed} · 未通过 ${r.counts.failed} · 未执行 ${r.counts.not_run}</p><p>执行通过、要求完整、脚本正式采用分别核对。本报告不拼接其他批次成绩；后续复测不改变此快照。所有已携带媒体离线可用，未携带项明确列出。</p><details><summary>报告生成服务身份</summary><pre>${esc(JSON.stringify(r.report_service_identity||null,null,2))}</pre></details>${entries}</html>`;
}
