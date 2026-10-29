export const stateLabel=s=>({PREVIEW:'准备检查',QUEUED:'排队中',RUNNING:'执行中',STOPPING:'取消中',FINISHED:'执行结束',CANCELLED:'已取消',INTERRUPTED:'服务中断',NOT_RUN:'未执行',BLOCKED:'阻塞',AUTH_SESSION_BLOCKED:'登录失效，已阻断',PASSED:'通过',FAILED:'失败'}[s]||s);
export const reviewLabels={REVIEWED_COMPLETE_FOR_THIS_CASE:'本次核查完整（未批准）',NOT_ACCEPTED_ACTION_CHANGED:'动作/预期偏离，不采纳',REVIEW_REQUIRED_PRECONDITION_ADDED:'前置条件待确认',BUSINESS_DIFFERENCE_RETAINED:'业务差异保留，待核对',BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP:'覆盖不足，业务差异保留',FROZEN_CASE_INPUT_CONFLICT:'原用例输入矛盾，待澄清'};
export const batchReasons={SCRIPT_MISSING:'缺少脚本',CASE_VERSION_NOT_APPLICABLE:'脚本不适用于此用例版本',SCRIPT_SELECTION_REQUIRED:'存在多个脚本，请明确选择版本',BACKEND_EXECUTOR_NOT_CONFIGURED:'后端执行器未加载',BACKEND_CONFIRMED_PLAN_REQUIRED:'请先生成并确认后端执行计划',BACKEND_PLAN_REVIEW_REQUIRED:'后端执行计划待审阅确认',BACKEND_CASE_VERSION_STALE:'用例已更新，后端计划需要重新生成',REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY:'核查不采纳，仅允许明确诊断试跑',TRIAL_NOT_AUTHORIZED:'没有此版本的技术试跑授权',TRIAL_ENVIRONMENT_UNAVAILABLE:'被测系统未就绪',TRIAL_BUNDLE_MISSING:'文件包缺失',PROJECT_TRIAL_CANDIDATE_EXPIRED:'该候选已过期，不能用于当前登记的被测系统',GENERATION_TARGET_UNREACHABLE:'被测系统地址无法访问，请检查目标地址与服务状态',PROJECT_TARGET_PROJECT_MISMATCH:'被测系统登记在其他项目下，请核对当前项目',PROJECT_TARGET_SCOPE_INVALID:'被测系统的项目或路径范围无效',PROJECT_TARGET_CONFIGURATION_CHANGED:'被测系统登记内容已变化，请重新核对',PROJECT_ENVIRONMENT_SCRIPT_REGENERATION_REQUIRED:'旧脚本没有可核验的环境记录，请在当前项目环境下重新生成；历史结果保留。',PROJECT_ENVIRONMENT_NOT_CONFIGURED:'项目测试环境尚未配置，请前往项目测试环境设置。',PROJECT_ENVIRONMENT_MISMATCH:'资源绑定的环境与项目当前环境不同；历史记录不会自动切换，请前往项目测试环境设置核对。',PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED:'项目测试环境配置已变化，请刷新后重新检查。',PROJECT_ENVIRONMENT_BUSY:'有任务正在使用项目测试环境，暂不能修改绑定。',PROJECT_ENVIRONMENT_REVISION_CONFLICT:'项目测试环境修订已变化，请刷新设置页后重试。',BATCH_CANCELLED:'取消后未执行',SERVICE_INTERRUPTED_NO_REPLAY:'服务中断，不自动重放'};
Object.assign(batchReasons, {AUTH_SESSION_REQUIRED:'请在被测系统与登录中完成登录并检查有效',AUTH_SESSION_NOT_VALID:'登录会话已失效，请重新登录',AUTH_SESSION_BLOCKED:'登录会话失效，已停止执行',SCRIPT_GENERATION_FAILED:'脚本生成未成功，请重新生成'});
export function candidateReadiness(candidate) {
 const reason=candidate.reason||(rejectedReview(candidate.requirement_review)?'REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY':null);
 if(!candidate.applies_to_selected_version)return {runnable:false,label:'不适用当前内容版本',reason:'该候选绑定其他用例内容版本'};
 if(reason){
  const label=/AUTH_SESSION/.test(reason)?'需登录':reason==='BACKEND_PLAN_REVIEW_REQUIRED'?'计划待审阅':/NOT_AUTHORIZED/.test(reason)?'未授权':/ENVIRONMENT|TARGET/.test(reason)?'环境待处理':'当前不可运行';
  return {runnable:false,label,reason:batchReasons[reason]||reason};
 }
 if(candidate.human_review_status==='NOT_REQUIRED' && candidate.technical_status==='TECHNICAL_VALIDATION_PASSED' && candidate.validation_source==='SELF_TEST')return {runnable:true,label:'自测通过，可运行',reason:'已通过当前脚本的完整自测'};
 const technical=candidate.technical_status==='INCOMPLETE'?'技术验证未完成':candidate.technical_status==='TECHNICAL_VALIDATION_PASSED'?'技术验证已通过':null;
 const review=candidate.human_review_status==='WAITING_REVIEW'?'脚本待人工核对':candidate.human_review_status==='NOT_READY'?'脚本尚未就绪':null;
 return {runnable:true,label:candidate.selection?.kind==='HTTP_JSON'?'计划已确认，可技术执行':'可技术试跑（未批准）',reason:[technical,review].filter(Boolean).join('；')||'执行结果仍须人工核对'};
}
export function candidateOptionLabel(candidate) {
 const readiness=candidateReadiness(candidate),selection=candidate.selection||{};
 const name=candidate.script_version?`${selection.kind==='HTTP_JSON'?'P':'S'}${candidate.script_version}`:`候选 v${selection.candidate_version??'未知'}`;
 return `${name} · 用例 v${selection.case_version??'未知'} · ${readiness.label} · ${readiness.reason} · ${candidate.created_at||'时间未登记'}`;
}
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function workspaceViewHref(projectId, view, selected = []) {
  const base=`#/projects/${encodeURIComponent(projectId)}`;
  const query=new URLSearchParams({selected:[...new Set(selected)].join(',')});
  return `${base}${view==='cases'?'/cases':''}?${query}`;
}
export function workspaceViewsHtml(project, view, selected = []) {
  return `<nav class="workspace-view-tabs" aria-label="工作台视图"><a id="workspace-cases" data-nav href="${esc(workspaceViewHref(project.project_id,'cases',selected))}"${view==='cases'?' aria-current="page"':''}>用例 <span>${project.cases.length}</span></a><a id="workspace-scripts" data-nav href="${esc(workspaceViewHref(project.project_id,'scripts',selected))}"${view==='scripts'?' aria-current="page"':''}>脚本与运行</a></nav>`;
}
export function reviewHtml(review){return `<div class="notice ${review?.requirements_status==='REVIEWED_COMPLETE_FOR_THIS_CASE'?'':'warning'}" data-testid="requirement-review"><strong>要求核查：${esc(reviewLabels[review?.requirements_status]||'待核对')}</strong><p>${esc(review?.finding||'尚无绑定此用例版本和文件包的维护者核查；运行通过不代表要求完整。')}</p>${review?`<details><summary>核查来源（不等于正式批准）</summary><pre>${esc(JSON.stringify(review,null,2))}</pre></details>`:''}</div>`;}
export function batchHtml(b,base){const count=s=>b.items.filter(i=>i.state===s).length;return `<article data-batch-id="${esc(b.batch_id)}"><h3>测试批次 · ${esc(b.created_at)}</h3><p>范围：${esc({single:'单条',selected:'选中列表',project:'整个项目（含阻塞项）'}[b.scope])} · 软件版本：${esc(b.software_version||'未提供')} · 状态：${esc(stateLabel(b.state))} · ${b.mode==='diagnostic'?'诊断试跑':'限定技术试跑'}，未批准</p><p>请求 ${b.items.length} 条；执行结束 ${count('FINISHED')}；执行中 ${count('RUNNING')}；已取消 ${count('CANCELLED')}；阻塞 ${count('BLOCKED')}；未执行 ${count('NOT_RUN')+count('QUEUED')}。结果只属于本批。</p><table><thead><tr><th>用例</th><th>版本 / 脚本</th><th>本次状态</th><th>原因</th></tr></thead><tbody>${b.items.map(i=>`<tr><td><a data-nav href="${base}/cases/${encodeURIComponent(i.case_id)}?version=${i.case_version}&batch_id=${b.batch_id}${i.run_id?'&run_id='+encodeURIComponent(i.run_id):''}">${esc(i.external_id)} · ${esc(i.title)}</a></td><td>用例v${i.case_version} / ${i.selection?i.script_version?(i.selection.kind==='HTTP_JSON'?'HTTP计划 P':'脚本 S')+i.script_version:'历史候选v'+i.selection.candidate_version:'无'}</td><td>${esc(stateLabel(i.state))} · ${esc(i.result&&i.result!=='NOT_RUN'?stateLabel(i.result):i.state==='CANCELLED'?'未形成完整结果':i.state==='RUNNING'?'结果待定':'未执行')}</td><td>${esc(batchReasons[i.reason]||i.reason||'—')}</td></tr>`).join('')}</tbody></table><details><summary>技术详情：冻结清单及身份</summary><pre>${esc(JSON.stringify(b,null,2))}</pre></details></article>`;}
export const rejectedReview = review => ['NOT_ACCEPTED_ACTION_CHANGED','BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP','FROZEN_CASE_INPUT_CONFLICT'].includes(review?.requirements_status);
export function automationState(data) {
 const candidates=data.candidates.filter(c=>c.applies_to_selected_version);
 const chosen=candidates.length===1?candidates[0]:null;
 const reason=chosen?(chosen.reason||(rejectedReview(chosen.requirement_review)?'REQUIREMENTS_REJECTED_DIAGNOSTIC_ONLY':null)):candidates.length?'SCRIPT_SELECTION_REQUIRED':data.candidates.length?'CASE_VERSION_NOT_APPLICABLE':'SCRIPT_MISSING';
 return {chosen,reason};
}
export function remedyHtml(item,projectId,{caseReturn}={}) {
  const projectBase=`#/projects/${encodeURIComponent(projectId)}`;
  if(item.reason==='SCRIPT_GENERATION_FAILED'&&item.selection?.kind!=='HTTP_JSON')return `<a data-nav href="${projectBase}?prepare=ui">准备生成脚本</a>`;
 const query=new URLSearchParams({version:String(item.case_version),tab:'scripts'}),selection=item.selection;
 if(selection?.kind==='HTTP_JSON'&&selection.source_task_id)query.set('plan_id',selection.source_task_id);
 else if(selection?.source_task_id&&selection.candidate_version!=null){query.set('script_task',selection.source_task_id);query.set('candidate',String(selection.candidate_version));}
 if(caseReturn)query.set('return',caseReturn);
 const href=`${projectBase}/cases/${encodeURIComponent(item.case_id)}?${query}`;
 const action=label=>`<a data-nav href="${esc(href)}">${label}</a>`;
 if(item.reason==='SCRIPT_GENERATION_FAILED')return action('查看生成失败并重试');
 if(item.reason==='SCRIPT_MISSING')return action('生成脚本');
 if(item.reason==='CASE_VERSION_NOT_APPLICABLE')return action('为当前用例生成脚本');
 if(item.reason==='SCRIPT_SELECTION_REQUIRED')return action('选择并核对脚本版本');
 if(item.reason==='TRIAL_NOT_AUTHORIZED')return action('核对脚本并允许运行');
 if(item.reason==='BACKEND_PLAN_REVIEW_REQUIRED'||item.reason==='BACKEND_CONFIRMED_PLAN_REQUIRED')return action('核对后端计划');
 if(/AUTH_SESSION/.test(item.reason||''))return `<a data-nav href="${projectBase}/auth">去登录</a>`;
 if(/ENVIRONMENT|GENERATION_TARGET|PROJECT_TARGET/.test(item.reason||''))return `<a data-nav href="${projectBase}/auth">检查测试环境</a>`;
 return item.reason?action('查看并处理问题'):'';
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
 root.innerHTML=`<div class="modal-backdrop"><section class="modal batch-modal" role="dialog" aria-modal="true" aria-label="运行确认"><header><h2>开始测试</h2><button class="button small" id="batch-close" aria-label="关闭运行确认">×</button></header><div class="modal-body"><div class="batch-context"><p>检查范围：${scope==='project'?`项目全部 ${project.cases.length} 条用例`:scope==='selected'?`选中的 ${ids.length} 条用例`:'当前用例'}</p><label>测试版本（可选）<input id="batch-software" maxlength="160" placeholder="例如 v1.0"></label></div><div id="batch-preview" role="status" aria-live="polite">正在检查准备条件…</div><details class="batch-advanced"><summary>高级：诊断试跑</summary><label><input type="checkbox" id="batch-diagnostic">诊断核查不采纳的候选（不属于正式回归）</label><p>诊断模式仍受脚本、版本、环境与授权检查约束。</p></details><p id="batch-error" role="alert"></p></div><footer class="batch-footer"><p id="batch-start-hint" aria-live="polite">检查完成后即可选择运行。</p><div class="actions"><button class="button" id="batch-cancel">取消</button><button class="button" id="batch-preflight">重新检查</button><button class="button primary" id="batch-start" aria-describedby="batch-start-hint" disabled>正在检查…</button></div></footer></section></div>`;
 const dialog=root.firstElementChild,$=selector=>dialog.querySelector(selector);
 const start=$('#batch-start'),area=$('#batch-preview'),error=$('#batch-error');
 const needsAcknowledgement=()=>!preview || $('#batch-diagnostic').checked || preview.items.some(i=>i.state!=='QUEUED' || i.qualification!=='SELF_TEST_PASSED');
 const payload=()=>({scope,case_ids:ids,selections,software_version:$('#batch-software').value,mode:$('#batch-diagnostic').checked?'diagnostic':'technical'});
 const controls=()=>dialog.querySelectorAll('button,input,select');
 const close=(result,force=false)=>{if(closed||(starting&&!force))return;closed=true;sequence++;clearTimeout(timer);window.removeEventListener('hashchange',onNavigate);document.removeEventListener('keydown',onKey);dialog.remove();activeDialog=null;resolveClosed(result||{state:'closed'});};
 const onNavigate=()=>close({state:'left'},true),onKey=e=>{if(e.key==='Escape')close();};
 window.addEventListener('hashchange',onNavigate);document.addEventListener('keydown',onKey);
 $('#batch-close').onclick=()=>close();$('#batch-cancel').onclick=()=>close();
 const updateStart=()=>{
  const runnable=preview?.items.filter(i=>i.state==='QUEUED').length||0,blocked=preview?preview.items.length-runnable:0;
  const awaitingAcknowledgement=needsAcknowledgement()&&!$('#batch-run-ack')?.checked;
  start.disabled=starting||!runnable||awaitingAcknowledgement;
  if(starting)return;
  const diagnostic=$('#batch-diagnostic').checked;
  start.textContent=!preview?'正在检查…':!runnable?'暂无可运行用例':diagnostic?`诊断运行 ${runnable} 条`:blocked?`先运行可用的 ${runnable} 条`:`开始运行 ${runnable} 条`;
  $('#batch-start-hint').textContent=!preview?'检查完成后即可选择运行。':!runnable?'请先处理上方问题，再重新检查。':awaitingAcknowledgement?'请核对本次清单，并确认可以在此环境执行测试。':blocked?`其余 ${blocked} 条本次不运行，全部保留在结果中。`:!needsAcknowledgement()?'脚本已通过自测，可以直接开始运行。':'已确认本次范围，可以开始。';
 };
 const renderPreview=()=>{
  const runnableItems=preview.items.filter(i=>i.state==='QUEUED'),blockedItems=preview.items.filter(i=>i.state!=='QUEUED');
  const runnable=runnableItems.length,blocked=blockedItems.length;
  const readinessReason=i=>({TRIAL_NOT_AUTHORIZED:'脚本需要核对并允许运行',SCRIPT_SELECTION_REQUIRED:'有多个脚本版本，请选择本次使用的版本',BACKEND_PLAN_REVIEW_REQUIRED:'后端计划需要核对确认',BACKEND_CONFIRMED_PLAN_REQUIRED:'后端计划尚未准备完成'}[i.reason]||batchReasons[i.reason]||i.reason||(i.qualification==='SELF_TEST_PASSED'?'自测通过，可直接运行':'准备就绪'));
  const itemHtml=i=>`<li class="batch-case"><div class="batch-case-summary"><div><strong>${esc(i.external_id)}</strong><p class="batch-case-title">${esc(i.title||project.cases.find(c=>c.case_id===i.case_id)?.title||'')}</p><p>${esc(readinessReason(i))}</p><details><summary>脚本与环境</summary><small>用例 v${i.case_version}${i.script_version?` · ${i.selection?.kind==='HTTP_JSON'?'计划 P':'脚本 S'}${i.script_version}`:''} · ${esc(i.environment_identity?.name||i.selection?.environment_id||'环境未就绪')}</small></details></div><div class="batch-case-action">${remedyHtml(i,project.project_id)}</div></div><div data-batch-choice="${preview.items.indexOf(i)}"></div></li>`;
  area.setAttribute('aria-busy','false');
  area.innerHTML=`<section class="batch-readiness ${blocked?'needs-attention':''}" aria-label="准备结果"><h3>${runnable?`本次运行 ${runnable} 条用例`:'还不能开始运行'}</h3><p>${runnable?blocked?`另外 ${blocked} 条需要处理，本次不会执行。`:'请核对下方用例和测试版本。':`请按下方提示处理 ${blocked} 条用例，再重新检查。`}</p></section>${runnable?`<section class="batch-ready-list"><h3>本次运行清单（${runnable}）</h3><ul class="batch-cases">${runnableItems.map(itemHtml).join('')}</ul></section>`:''}${blocked?`<section class="batch-blockers"><h3>本次不运行（${blocked}）</h3><ul class="batch-cases">${blockedItems.map(itemHtml).join('')}</ul></section>`:''}${runnable&&needsAcknowledgement()?'<label class="batch-ack"><input id="batch-run-ack" type="checkbox">我已核对本次用例，可以在项目测试环境中执行测试。</label>':''}`;
  $('#batch-run-ack')?.addEventListener('change',updateStart);
  for(const [caseId,candidates] of choices){
   const row=preview.items.find(i=>i.case_id===caseId);if(!row)continue;
   const index=preview.items.indexOf(row),cell=area.querySelector(`[data-batch-choice="${index}"]`);if(!cell)continue;
   const selected=selections.find(s=>s.case_id===caseId);
   const ready=candidates.filter(candidate=>candidateReadiness(candidate).runnable);
   cell.insertAdjacentHTML('beforeend',`<label>本次脚本<select data-batch-script="${esc(caseId)}" aria-label="${esc(row.external_id)} 本次脚本"><option value="">请选择脚本版本</option>${candidates.map((c,n)=>`<option value="${n}" ${selected?.source_task_id===c.selection.source_task_id&&selected?.candidate_version===c.selection.candidate_version&&selected?.bundle_sha256===c.selection.bundle_sha256?'selected':''}>${esc(candidateOptionLabel(c))}</option>`).join('')}</select></label>${!selected&&ready.length===1?`<small>推荐：${esc(candidateOptionLabel(ready[0]))}；请亲自选择后重新检查。</small>`:''}`);
  }
  area.querySelectorAll('[data-batch-script]').forEach(select=>select.addEventListener('change',()=>{
   const caseId=select.dataset.batchScript,candidate=select.value===''?null:choices.get(caseId)?.[Number(select.value)];
   selections=selections.filter(s=>s.case_id!==caseId);if(candidate)selections.push(candidate.selection);
   schedule();
  }));
  updateStart();
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
  }catch(e){if(closed||token!==sequence)return;area.setAttribute('aria-busy','false');area.textContent='检查未完成，请点击“重新检查”重试。';start.textContent='检查未完成';$('#batch-start-hint').textContent='检查完成后才能开始运行。';error.textContent=startErrors[e.code]||startErrors[e.message]||e.message;}
  finally{if(!closed&&token===sequence)$('#batch-preflight').disabled=false;}
 };
 const schedule=(delay=0)=>{
  if(starting||closed)return;clearTimeout(timer);const token=++sequence;
  preview=null;checkedInput=null;frozenBatch=null;updateStart();error.textContent='';area.textContent='正在检查准备条件…';area.setAttribute('aria-busy','true');$('#batch-preflight').disabled=true;
  timer=setTimeout(()=>void check(token),delay);
 };
 $('#batch-software').addEventListener('input',()=>schedule(200));$('#batch-diagnostic').addEventListener('change',()=>schedule());$('#batch-preflight').onclick=()=>schedule();
 // Compare what the user reviewed with the newly frozen backend selection.
 const fingerprint=b=>JSON.stringify(b.items.map(i=>({case_id:i.case_id,case_version:i.case_version,content_sha256:i.content_sha256,selection:i.selection,state:i.state,reason:i.reason,environment_identity:i.environment_identity,requirement_review:i.requirement_review,qualification:i.qualification})));
 start.onclick=async()=>{
  if(starting||start.disabled||!preview)return;
  // The button names the exact runnable count; clicking it explicitly chooses that scope.
  const allowPartial=preview.items.some(i=>i.state==='BLOCKED');
  starting=true;controls().forEach(c=>{c.disabled=true;});error.textContent='';start.textContent='正在启动…';
  try{
   if(!frozenBatch)frozenBatch=await mutate(endpoint,jsonOptions(checkedInput));
   if(closed)return;
   if(fingerprint(frozenBatch)!==fingerprint(preview)){
    preview=frozenBatch;renderPreview();error.textContent='准备条件已变化，请核对本次范围后重新确认。';return;
   }
   const b=await mutate(endpoint+'/'+frozenBatch.batch_id+'/start',jsonOptions({request_id:requestId,allow_partial:allowPartial}));
   if(closed)return;
   starting=false;close({state:'started',batch_id:b.batch_id});
   const projectBase=`#/projects/${encodeURIComponent(project.project_id)}`,returnPath=typeof caseReturn==='string'?caseReturn.split('?')[0]:'';
   const returnQuery=([projectBase,`${projectBase}/automation`,`${projectBase}/cases`].includes(returnPath)||returnPath.startsWith(`${projectBase}/cases/`))?'&return='+encodeURIComponent(caseReturn):'';
   go(caseContext?`#/projects/${project.project_id}/cases/${caseContext.case_id}?version=${caseContext.case_version}&batch_id=${b.batch_id}${returnQuery}`:`#/projects/${project.project_id}/batches?batch_id=${b.batch_id}`,true);
  }catch(e){error.textContent=startErrors[e.code]||startErrors[e.message]||batchReasons[e.code]||e.message;}
  finally{starting=false;if(!closed){controls().forEach(c=>{c.disabled=false;});updateStart();}}
 };
 schedule();return lifetime;
}
