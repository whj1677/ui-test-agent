export const stateLabel=s=>({PREVIEW:'准备检查',QUEUED:'排队中',RUNNING:'执行中',STOPPING:'取消中',FINISHED:'执行结束',CANCELLED:'已取消',INTERRUPTED:'服务中断',NOT_RUN:'未执行',BLOCKED:'阻塞',PASSED:'通过',FAILED:'失败'}[s]||s);
export const reviewLabels={REVIEWED_COMPLETE_FOR_THIS_CASE:'本次核查完整（未批准）',NOT_ACCEPTED_ACTION_CHANGED:'动作/预期偏离，不采纳',REVIEW_REQUIRED_PRECONDITION_ADDED:'前置条件待确认',BUSINESS_DIFFERENCE_RETAINED:'业务差异保留，待核对',BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP:'覆盖不足，业务差异保留',FROZEN_CASE_INPUT_CONFLICT:'原用例输入矛盾，待澄清'};
export const batchReasons={SCRIPT_MISSING:'缺少脚本',CASE_VERSION_NOT_APPLICABLE:'脚本不适用于此用例版本',SCRIPT_SELECTION_REQUIRED:'存在多个脚本，请明确选择版本',REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY:'核查不采纳，仅允许明确诊断试跑',TRIAL_NOT_AUTHORIZED:'没有此版本的技术试跑授权',TRIAL_ENVIRONMENT_UNAVAILABLE:'环境未就绪',TRIAL_BUNDLE_MISSING:'文件包缺失',BATCH_CANCELLED:'取消后未执行',SERVICE_INTERRUPTED_NO_REPLAY:'服务中断，不自动重放'};
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reviewHtml(review){return `<div class="notice ${review?.requirements_status==='REVIEWED_COMPLETE_FOR_THIS_CASE'?'':'warning'}" data-testid="requirement-review"><strong>要求核查：${esc(reviewLabels[review?.requirements_status]||'待核对')}</strong><p>${esc(review?.finding||'尚无绑定此用例版本和文件包的维护者核查；运行通过不代表要求完整。')}</p>${review?`<details><summary>核查来源（不等于正式批准）</summary><pre>${esc(JSON.stringify(review,null,2))}</pre></details>`:''}</div>`;}
export function batchHtml(b,base){const count=s=>b.items.filter(i=>i.state===s).length;return `<article data-batch-id="${esc(b.batch_id)}"><h3>测试批次 · ${esc(b.created_at)}</h3><p>范围：${esc({single:'单条',selected:'选中列表',project:'整个项目（含阻塞项）'}[b.scope])} · 软件版本：${esc(b.software_version||'未提供')} · 状态：${esc(stateLabel(b.state))} · ${b.mode==='diagnostic'?'诊断试跑':'限定技术试跑'}，未批准</p><p>请求 ${b.items.length} 条；已执行 ${count('FINISHED')+count('CANCELLED')}；阻塞 ${count('BLOCKED')}；未执行 ${count('NOT_RUN')+count('QUEUED')}。结果只属于本批。</p><table><thead><tr><th>用例</th><th>版本 / 脚本</th><th>本次状态</th><th>原因</th></tr></thead><tbody>${b.items.map(i=>`<tr><td><a data-nav href="${base}/cases/${encodeURIComponent(i.case_id)}?version=${i.case_version}&batch_id=${b.batch_id}${i.run_id?'&run_id='+encodeURIComponent(i.run_id):''}">${esc(i.external_id)} · ${esc(i.title)}</a></td><td>用例v${i.case_version} / ${i.selection?'候选v'+i.selection.candidate_version:'无'}</td><td>${esc(stateLabel(i.state))} · ${esc(stateLabel(i.result)||'未执行')}</td><td>${esc(batchReasons[i.reason]||i.reason||'—')}</td></tr>`).join('')}</tbody></table><details><summary>技术详情：冻结清单及身份</summary><pre>${esc(JSON.stringify(b,null,2))}</pre></details></article>`;}
export const rejectedReview = review => ['NOT_ACCEPTED_ACTION_CHANGED','BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP','FROZEN_CASE_INPUT_CONFLICT'].includes(review?.requirements_status);
export function automationState(data) {
 const candidates=data.candidates.filter(c=>c.applies_to_selected_version);
 const chosen=candidates.length===1?candidates[0]:null;
 const reason=chosen?(chosen.reason||(rejectedReview(chosen.requirement_review)?'REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY':null)):candidates.length?'SCRIPT_SELECTION_REQUIRED':data.candidates.length?'CASE_VERSION_NOT_APPLICABLE':'SCRIPT_MISSING';
 return {chosen,reason};
}
export function remedyHtml(item,projectId) {
 const base=`#/projects/${projectId}/cases/${item.case_id}`;
 if(item.reason==='SCRIPT_MISSING')return `<a data-nav href="${base}?version=${item.case_version}&tab=scripts">生成脚本（需模型授权）</a>`;
 if(item.reason==='CASE_VERSION_NOT_APPLICABLE')return `<a data-nav href="${base}?version=${item.case_version}&tab=scripts">查看历史脚本 / 为当前版本生成</a>`;
 if(item.reason==='SCRIPT_SELECTION_REQUIRED')return `<a data-nav href="${base}?version=${item.case_version}&tab=scripts">选择适用脚本</a>`;
 if(/ENVIRONMENT|AUTH_SESSION|NOT_AUTHORIZED/.test(item.reason||''))return `<a data-nav href="#/projects/${projectId}/auth">检查环境与授权</a>`;
 return item.reason?`<a data-nav href="${base}?version=${item.case_version}&tab=scripts">查看脚本与核查原因</a>`:'';
}
const startErrors={BATCH_EXECUTOR_BUSY:'工作台正在执行其他任务。本次未启动；任务结束后可直接重试。',BATCH_REQUEST_INVALID:'准备检查失败：软件版本标识最多 160 个字符，请修正后重试。',BATCH_ENVIRONMENT_CONFIGURATION_CHANGED:'环境配置已变化，请重新检查准备条件。',BATCH_NO_RUNNABLE_CASES:'没有可运行的脚本，请先处理阻塞原因。'};
let activeDialog=null;
export function openBatch({project,scope,ids,selections=[],api,mutate,jsonOptions,go,caseContext,caseReturn}) {
 if(activeDialog)return activeDialog;
 let resolveClosed;
 const lifetime=new Promise(resolve=>{resolveClosed=resolve;});activeDialog=lifetime;
 const root=document.querySelector('#modal-root'),endpoint=`/api/case-library/projects/${project.project_id}/batches`;
 let preview=null,checkedInput=null,frozenBatch=null,starting=false,closed=false,sequence=0,timer;
 let choices=new Map();selections=[...selections];
 const requestId='batch-request-'+crypto.randomUUID();
 root.innerHTML=`<div class="modal-backdrop"><section class="modal batch-modal" role="dialog" aria-modal="true" aria-label="运行确认"><header><h2>${scope==='project'?'运行整个项目':scope==='selected'?'运行选中用例':'运行此用例'}</h2><button class="button small" id="batch-close" aria-label="关闭运行确认">×</button></header><div class="modal-body"><p>复用已有脚本，不调用 Coding Agent。确认运行后形成新测试批次，保留历史结果。</p><p>本次范围：${scope==='project'?`整个项目 ${project.cases.length} 条（不受筛选或分页影响）`:ids.length+' 条'}；脚本仍为限定技术试跑，未批准。</p><label>被测软件版本 / 构建标识<input id="batch-software" placeholder="未提供（最多160字符）"></label><div id="batch-preview" role="status" aria-live="polite"></div><details class="batch-advanced"><summary>高级：诊断试跑</summary><label><input type="checkbox" id="batch-diagnostic">明确诊断核查不采纳的候选（不属于正式回归）</label><p>诊断不解除缺脚本、版本、环境或试跑授权限制。</p></details><p id="batch-error" role="alert"></p></div><footer class="actions"><button class="button" id="batch-cancel">取消</button><button class="button" id="batch-preflight">重新检查</button><button class="button primary" id="batch-start" disabled>确认运行已有脚本</button></footer></section></div>`;
 const dialog=root.firstElementChild,$=selector=>dialog.querySelector(selector);
 const start=$('#batch-start'),area=$('#batch-preview'),error=$('#batch-error');
 const payload=()=>({scope,case_ids:ids,selections,software_version:$('#batch-software').value,mode:$('#batch-diagnostic').checked?'diagnostic':'technical'});
 const controls=()=>dialog.querySelectorAll('button,input,select');
 const close=result=>{if(closed||starting)return;closed=true;sequence++;clearTimeout(timer);window.removeEventListener('hashchange',onNavigate);document.removeEventListener('keydown',onKey);dialog.remove();activeDialog=null;resolveClosed(result||{state:'closed'});};
 const onNavigate=()=>close(),onKey=e=>{if(e.key==='Escape')close();};
 window.addEventListener('hashchange',onNavigate);document.addEventListener('keydown',onKey);
 $('#batch-close').onclick=()=>close();$('#batch-cancel').onclick=()=>close();
 const updateStart=()=>{start.disabled=starting||!preview?.items.some(i=>i.state==='QUEUED')||(preview.items.some(i=>i.state==='BLOCKED')&&!$('#batch-partial')?.checked);};
 const renderPreview=()=>{
  const runnable=preview.items.filter(i=>i.state==='QUEUED').length,blocked=preview.items.length-runnable;
  area.setAttribute('aria-busy','false');
  area.innerHTML=`<section class="summary-strip"><div><span>本次范围</span><strong>${preview.items.length}</strong></div><div><span>可运行</span><strong>${runnable}</strong></div><div><span>阻塞</span><strong>${blocked}</strong></div></section><p>软件版本：${esc(preview.software_version||'未提供')} · 环境随所选脚本绑定</p><div class="table-wrap"><table><thead><tr><th>用例 / 脚本版本</th><th>环境</th><th>准备状态 / 处理入口</th></tr></thead><tbody>${preview.items.map(i=>`<tr><td><strong>${esc(i.external_id)}</strong> · 用例 v${i.case_version}<small>${i.selection?i.script_version?'脚本 S'+i.script_version:'历史候选 v'+i.selection.candidate_version:i.reason==='SCRIPT_SELECTION_REQUIRED'?'多个适用脚本待选择':i.available_versions?.length?'仅有用例 v'+i.available_versions.join('、v')+' 的脚本':'无脚本'}</small></td><td>${esc(i.selection?.environment_id||'未绑定适用脚本')}</td><td>${esc(batchReasons[i.reason]||i.reason||'可直接试跑（未批准）')}<small>${remedyHtml(i,project.project_id)}</small></td></tr>`).join('')}</tbody></table></div>${blocked?'<label class="notice warning"><input id="batch-partial" type="checkbox">仅运行可执行部分，保留全部阻塞项，不宣称全项目通过</label>':''}`;
  for(const [caseId,candidates] of choices){
   const row=preview.items.find(i=>i.case_id===caseId);if(!row)continue;
   const index=preview.items.indexOf(row),cell=area.querySelectorAll('tbody tr')[index]?.cells[0];if(!cell)continue;
   const selected=selections.find(s=>s.case_id===caseId);
   cell.insertAdjacentHTML('beforeend',`<label>本次脚本<select data-batch-script="${esc(caseId)}" aria-label="${esc(row.external_id)} 本次脚本"><option value="">请选择脚本版本</option>${candidates.map((c,n)=>`<option value="${n}" ${selected?.source_task_id===c.selection.source_task_id&&selected?.candidate_version===c.selection.candidate_version&&selected?.bundle_sha256===c.selection.bundle_sha256?'selected':''}>${esc(c.script_version?'S'+c.script_version:'候选 v'+c.selection.candidate_version)} · ${esc(c.created_at||'历史时间未登记')}</option>`).join('')}</select></label>`);
  }
  area.querySelectorAll('[data-batch-script]').forEach(select=>select.addEventListener('change',()=>{
   const caseId=select.dataset.batchScript,candidate=select.value===''?null:choices.get(caseId)?.[Number(select.value)];
   selections=selections.filter(s=>s.case_id!==caseId);if(candidate)selections.push(candidate.selection);
   schedule();
  }));
  $('#batch-partial')?.addEventListener('change',updateStart);updateStart();
 };
 const check=async token=>{
  const input=payload();
  try{
   const result=await mutate(endpoint+'/preflight',jsonOptions(input));
   if(closed||token!==sequence)return;
   const needed=result.items.filter(i=>i.reason==='SCRIPT_SELECTION_REQUIRED'||choices.has(i.case_id));
   const options=await Promise.all(needed.map(async i=>[i.case_id,(await api(`/api/case-library/projects/${project.project_id}/cases/${i.case_id}/automation?version=${i.case_version}`)).candidates.filter(c=>c.applies_to_selected_version)]));
   if(closed||token!==sequence)return;
   choices=new Map(options.filter(([,c])=>c.length>1));
   preview=result;checkedInput=input;renderPreview();
  }catch(e){if(closed||token!==sequence)return;area.setAttribute('aria-busy','false');area.textContent='准备检查未完成，修正条件后将自动重试。';error.textContent=startErrors[e.code]||startErrors[e.message]||e.message;}
  finally{if(!closed&&token===sequence)$('#batch-preflight').disabled=false;}
 };
 const schedule=(delay=0)=>{
  if(starting||closed)return;clearTimeout(timer);const token=++sequence;
  preview=null;checkedInput=null;frozenBatch=null;start.disabled=true;error.textContent='';area.textContent='正在检查准备条件…';area.setAttribute('aria-busy','true');$('#batch-preflight').disabled=true;
  timer=setTimeout(()=>void check(token),delay);
 };
 $('#batch-software').addEventListener('input',()=>schedule(200));$('#batch-diagnostic').addEventListener('change',()=>schedule());$('#batch-preflight').onclick=()=>schedule();
 // Compare what the user reviewed with the newly frozen backend selection.
 const fingerprint=b=>JSON.stringify(b.items.map(i=>({case_id:i.case_id,case_version:i.case_version,content_sha256:i.content_sha256,selection:i.selection,state:i.state,reason:i.reason,environment_identity:i.environment_identity,requirement_review:i.requirement_review})));
 start.onclick=async()=>{
  if(starting||start.disabled||!preview)return;
  const allowPartial=$('#batch-partial')?.checked===true;
  starting=true;controls().forEach(c=>{c.disabled=true;});error.textContent='';start.textContent='正在启动…';
  try{
   if(!frozenBatch)frozenBatch=await mutate(endpoint,jsonOptions(checkedInput));
   if(fingerprint(frozenBatch)!==fingerprint(preview)){
    preview=frozenBatch;renderPreview();error.textContent='准备条件已变化，请核对本次范围后重新确认。';return;
   }
   const b=await mutate(endpoint+'/'+frozenBatch.batch_id+'/start',jsonOptions({request_id:requestId,allow_partial:allowPartial}));
   starting=false;close({state:'started',batch_id:b.batch_id});
   go(caseContext?`#/projects/${project.project_id}/cases/${caseContext.case_id}?version=${caseContext.case_version}&batch_id=${b.batch_id}${caseReturn?.startsWith('#/projects/'+project.project_id+'/cases')?'&return='+encodeURIComponent(caseReturn):''}`:`#/projects/${project.project_id}/batches?batch_id=${b.batch_id}`,true);
  }catch(e){error.textContent=startErrors[e.code]||startErrors[e.message]||batchReasons[e.code]||e.message;}
  finally{starting=false;if(!closed){controls().forEach(c=>{c.disabled=false;});start.textContent='确认运行已有脚本';updateStart();}}
 };
 schedule();return lifetime;
}
