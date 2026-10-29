import { api } from './api.js';
import { esc, batchReasons, stateLabel, candidateOptionLabel } from './workflow.js';
import { failureFeedbackHtml } from './execution-list.js';
import { eligibleDemonstration, demonstrationLabel } from './demonstrations.js';
const post = body => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const environmentName=e=>e.name||e.id;
const labels={generate:'生成自动化脚本',revise:'基于问题修订脚本',regenerate:'重新生成自动化脚本'};
export const demonstrationOptionLabel = demonstrationLabel;
export function scriptRevisionRunMatches(projectId,item,run,candidate){
  return Boolean(candidate && run && run.finished_at && !['QUEUED','RUNNING','STARTING','STOPPING','EXECUTING'].includes(run.execution_status) &&
    item.run_id===run.run_id && run.project_id===projectId &&
    run.executed_case_id===item.case_id && run.executed_case_version===item.case_version &&
    run.source_build_task_id===candidate.selection.source_task_id &&
    String(run.candidate_version)===String(candidate.selection.candidate_version) &&
    run.bundle_sha256===candidate.selection.bundle_sha256 &&
    (run.environment_id||run.selection?.environment_id)===candidate.selection.environment_id &&
    ['FAILED','TIMEDOUT','TIMED_OUT','ERROR'].includes(run.status));
}
const reasons={GENERATION_TARGET_UNREACHABLE:'被测系统地址无法访问，请在项目测试环境设置中核对目标地址',GENERATION_MODEL_CONFIRMATION_REQUIRED:'本次生成尚未提交，请重新点击开始生成',GENERATION_NOT_AUTHORIZED:'当前服务尚未开放用户发起生成，且没有本次可用授权',GENERATION_ENVIRONMENT_NOT_READY:'尚未登记可供建例的环境',PROJECT_TARGET_PROJECT_MISMATCH:'该被测系统属于其他项目，请在当前项目重新登记',PROJECT_TARGET_SCOPE_INVALID:'被测系统的项目或路径范围无效',PROJECT_TARGET_CONFIGURATION_CHANGED:'被测系统登记内容已变化，请重新核对并登记',PROJECT_ENVIRONMENT_SCRIPT_REGENERATION_REQUIRED:'旧脚本没有可核验的环境记录，请在当前项目环境下重新生成；历史结果保留。',PROJECT_ENVIRONMENT_NOT_CONFIGURED:'项目尚未配置 UI 测试环境，请先前往项目测试环境设置。',PROJECT_ENVIRONMENT_MISMATCH:'原脚本或运行绑定的环境与项目当前 UI 环境不同；历史环境不会自动切换，请前往项目测试环境设置核对。',PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED:'项目测试环境配置已变化，请刷新后重新检查。',PROJECT_ENVIRONMENT_BUSY:'有项目运行任务正在使用测试环境，暂不能更改绑定。',PROJECT_ENVIRONMENT_REVISION_CONFLICT:'项目测试环境修订已变化，请刷新后重新保存。',MODEL_GENERATION_DISABLED_IN_TRIAL_PROFILE:'当前配置禁止模型调用',REVISION_SCRIPT_AND_FEEDBACK_REQUIRED:'需明确选定旧脚本并填写问题反馈',REVISION_SOURCE_NOT_AVAILABLE:'原运行绑定的旧脚本包已不可用；请回到原记录核对，不能改选其他候选',REVISION_SOURCE_IDENTITY_INCOMPLETE:'原运行的旧脚本身份不完整，不能自动带入修订',REVISION_ENVIRONMENT_MISMATCH:'所选运行绑定不同被测系统，请分批处理',BACKEND_EXECUTOR_NOT_CONFIGURED:'后端协议绑定可继续管理；执行器尚未开放，不能生成或运行后端脚本',SCRIPT_ALREADY_EXISTS:'已有脚本，请选择修订或从头重新生成',CASE_CONTENT_NOT_CONFIRMED:'用例正文尚未确认',GENERATION_AUTHORIZATION_AMBIGUOUS:'存在多条授权，请先核对授权范围'};
Object.assign(reasons, {
  MISSING_TEST_PREREQUISITE:'缺少用例要求的前置数据或条件，请查看过程中的检查范围与原因',
  AUTH_SESSION_REQUIRED:'请到“被测系统与登录”完成对应角色登录并检查有效，再重新检查准备条件',
  AUTH_SESSION_NOT_VALID:'登录会话已失效或变化，请重新登录并检查有效',
  AUTH_SESSION_BLOCKED:'登录会话失效，运行已停止；重新登录后可显式复跑',
  DEVELOPMENT_AUTH_ENVIRONMENT_INVALID:'被测地址与登记的登录环境不匹配，请核对环境配置',
  DEVELOPMENT_ENVIRONMENT_NOT_LOCAL:'该目标尚未按受控登录环境登记',
  HARNESS_MODEL_TRANSPORT_FAILED:'模型服务调用失败，请检查服务连接后重新检查准备条件；本次失败记录已保留',
  MODEL_PROVIDER_UNAVAILABLE:'模型服务暂不可用，本条未生成；请检查服务后显式重新发起生成',
  MODEL_REQUEST_FAILED:'模型审查请求失败，请重新生成',
  'HARNESS_INCOMPLETE:error':'生成过程意外中断，请查看过程',
  DEVELOPMENT_HARNESS_PATCH_INVALID:'生成环境检查未通过，请联系项目维护人员',
  NO_TESTED_CANDIDATE_SUBMITTED:'脚本未完成最终提交，请查看过程后重新生成',
  CANDIDATE_BUDGET_EXHAUSTED:'本次自动修订仍未通过检查，请查看过程后重新生成',
});
const workingStates = new Set(['QUEUED','RUNNING','STARTING','GENERATING','VERIFYING','STOPPING']);
const resultNames = {QUEUED:'排队中',RUNNING:'生成中',GENERATING:'生成中',VERIFYING:'校验中',READY:'自测通过，可运行',ENVIRONMENT_BLOCKED:'前置条件受阻',WAITING_HUMAN_REVIEW:'已生成，待核对',DRAFT:'已产出，待审阅',CONFIRMED:'已确认',EXISTS:'已有脚本，保留',CANDIDATE_VALIDATION_FAILED:'脚本校验未通过',FAILED:'生成失败',BUILD_FAILED:'生成失败',GENERATION_FAILED:'生成失败',BLOCKED:'受阻',CANCELLED:'已取消',NOT_RUN:'未生成',INTERRUPTED:'已中断',AUTH_SESSION_BLOCKED:'登录失效，已停止',BUDGET_EXHAUSTED:'资源上限已用尽'};
const failedResultStates = new Set(['ENVIRONMENT_BLOCKED','CANDIDATE_VALIDATION_FAILED','FAILED','BUILD_FAILED','GENERATION_FAILED','BLOCKED','AUTH_SESSION_BLOCKED','BUDGET_EXHAUSTED']);
const itemFailureReason = item => item.reason ? (reasons[item.reason] || batchReasons[item.reason] || item.reason) : failedResultStates.has(item.state) ? '失败原因未返回；请查看过程记录' : '';
export function generationProgress(record, kind='ui') {
  const active=workingStates.has(record?.state), items=record?.items || [];
  const result={active,total:items.length,processed:0,generated:0,failed:0,skipped:0,waiting:0,current:null};
  for(const item of items){
    if(workingStates.has(item.state) && active){result.waiting++;if(item.state!=='QUEUED' && !result.current)result.current=item;}
    else {result.processed++;if((kind==='backend'?['DRAFT','CONFIRMED']:['READY','WAITING_HUMAN_REVIEW']).includes(item.state))result.generated++;
      else if(['EXISTS','NOT_RUN','CANCELLED'].includes(item.state) || workingStates.has(item.state))result.skipped++;
      else result.failed++;}
  }
  result.current ||= active ? items.find(item=>item.state==='QUEUED') : null;
  result.title=active && (record?.cancel_requested || record?.state==='STOPPING') ? '正在停止，已产出结果会保留' : active ? '正在生成脚本'
    : record?.state==='CANCELLED' ? '生成已取消' : record?.state==='INTERRUPTED' ? '生成已中断'
    : result.failed ? `生成结束，${result.failed} 条未成功` : result.generated ? `已生成 ${result.generated} 条${record?.quality_review_mode==='self-test-v1'?'，可运行':'，待核对'}` : '生成结束，本次未生成新脚本';
  return result;
}
export function generationStage(task, kind='ui') {
  if(!task)return '正在处理';
  const work=kind==='backend'?task.generation_session:task.development;
  const running=rows=>Array.isArray(rows) && rows.some(row=>['RUNNING','EXECUTING','REVIEWING','STARTING'].includes(row.status) && !row.finished_at);
  if(task.task_status==='VERIFYING' && task.quality_policy?.quality_review_mode==='self-test-v1')return '正在保存已通过自测的脚本';
  if(task.task_status==='VERIFYING' || running(work?.independent_validations) || running(work?.final_executions))return '正在独立复验';
  if(running(work?.quality_reviews))return '正在审查脚本';
  if(running(work?.self_tests))return '正在运行自测';
  return kind==='backend'?'正在根据协议编写或修订脚本':'正在观察页面、编写或修订脚本';
}
export function generationProgressHtml(record,{kind='ui',projectId=record.project_id,task=null,error='',cancelPending=false,compact=false}={}) {
  const progress=generationProgress(record,kind), base=`#/projects/${encodeURIComponent(projectId)}`;
  const elapsed=Math.max(0,Math.floor((Date.parse(record.finished_at || new Date().toISOString())-Date.parse(record.created_at))/1000));
  const summary=`已处理 ${progress.processed} / ${progress.total} 条 · ${record.quality_review_mode==='self-test-v1'?'可运行':'待核对'} ${progress.generated} · 未成功 ${progress.failed} · 跳过/未生成 ${progress.skipped}`;
  const current=progress.current;
  const meter=progress.active && progress.total===1 ? '<progress aria-label="当前脚本生成中，尚无可计算的完成百分比"></progress>'
    : `<progress max="${Math.max(1,progress.total)}" value="${progress.processed}" aria-label="脚本生成处理进度" aria-valuetext="${esc(summary)}"></progress>`;
  return `<section class="generation-progress${compact?' compact':''}" data-outcome="${progress.active?'active':progress.failed?'attention':'done'}" aria-label="${kind==='backend'?'后端':'前端'}脚本生成进度"><div role="status" aria-live="polite"><h3>${esc(progress.title)}</h3>${meter}<p class="generation-progress-counts">${summary}</p>${current?`<p><strong>当前：${esc(current.external_id || current.title || '当前用例')}</strong> · ${current.state==='QUEUED'?'等待开始':esc(generationStage(task,kind))}</p>${progress.total>1 && current.state!=='QUEUED'?'<progress class="generation-current-progress" aria-label="当前用例处理中"></progress>':''}`:''}<p class="muted">${Number.isFinite(elapsed)?`已用 ${Math.floor(elapsed/60)} 分 ${elapsed%60} 秒 · `:''}${progress.active?'状态每 2 秒自动更新；进度按已处理条数计算。' :progress.failed?'请查看失败原因；检查后需显式重新发起生成。':record.quality_review_mode==='self-test-v1'&&progress.generated?'已通过自测的脚本可以直接运行。':'处理结束不等于业务测试通过，请核对候选结果。'}</p></div>${record.error?`<p class="notice warning" role="alert">任务中断：${esc(reasons[record.error] || record.error)}；未处理用例不会自动重试。</p>`:''}${error?`<p class="notice warning" role="alert">${esc(error)}；上次状态已保留，正在重新读取。</p>`:''}${compact?`<details data-generation-details${progress.failed || record.error?' open':''}><summary>查看每条结果</summary>`:''}<ul class="generation-result-list">${(record.items || []).map(item=>`<li><strong>${esc(item.external_id || item.title || '用例')}</strong>：${esc(!progress.active && workingStates.has(item.state)?'已停止，结果待检查':resultNames[item.state] || stateLabel(item.state))}${itemFailureReason(item)?`<span class="generation-reason">${esc(itemFailureReason(item))}</span>`:''}${!workingStates.has(item.state) && item.case_id?` <a data-nav href="${base}/cases/${encodeURIComponent(item.case_id)}?version=${encodeURIComponent(item.case_version)}&tab=scripts">查看脚本与结果</a>`:''}${item.task_id?` <a data-nav href="${base}/build-tasks/${encodeURIComponent(item.task_id)}">查看过程</a>`:''}</li>`).join('')}</ul>${compact?'</details>':''}${progress.active?`<button class="button" data-generation-stop ${cancelPending || record.cancel_requested || record.state==='STOPPING'?'disabled':''}>${cancelPending || record.cancel_requested || record.state==='STOPPING'?'正在停止…':'停止生成'}</button>`:''}</section>`;
}
// Poll existing receipts only. Reopening or retrying never starts another model call.
export function watchGenerationProgress({projectId,kind='ui',initial,onUpdate,onError=()=>{},onSettled=()=>{},isCurrent=()=>true,request=api,interval=2000}) {
  const id=kind==='backend'?initial.batch_id:initial.operation_id;
  const base=`/api/case-library/projects/${encodeURIComponent(projectId)}/${kind==='backend'?'backend/generation-batches':'script-operations'}/${encodeURIComponent(id)}`;
  let stopped=false,timer,busy=false,record=initial,settled=false;
  const controller=new AbortController(),live=()=>!stopped && isCurrent();
  const dispose=()=>{stopped=true;clearTimeout(timer);controller.abort();};
  const tick=async()=>{
    if(!live() || busy)return;clearTimeout(timer);busy=true;
    try {
      const next=await request(base,{signal:controller.signal});if(!live())return;
      record=next;let task=null;
      const item=generationProgress(record,kind).current;
      const detail=kind==='backend'?item?.plan_id:item?.task_id;
      if(detail)try{task=await request(kind==='backend'?`/api/case-library/projects/${encodeURIComponent(projectId)}/backend/plans/${encodeURIComponent(detail)}`:`/api/build/tasks/${encodeURIComponent(detail)}`,{signal:controller.signal});}catch{/* Batch state remains authoritative when optional stage details are unavailable. */}
      if(!live())return;onUpdate(record,task);
      if(!generationProgress(record,kind).active && !settled){settled=true;onSettled(record);}
    }catch(error){if(live())onError(error);}
    finally{busy=false;if(live() && !settled)timer=setTimeout(()=>void tick(),interval);}
  };
  if(live())onUpdate(initial,null);
  const ready=tick();
  return {dispose,refresh:tick,ready,base};
}
export function mountGenerationProgress({container,projectId,kind='ui',record,compact=false,isCurrent=()=>true,onSettled=()=>{}}) {
  let disposed=false,current=record,task=null,error='',cancelPending=false;
  const live=()=>!disposed && isCurrent();
  const render=()=>{if(live()){const restoreFocus=document.activeElement?.matches('[data-generation-stop]') && container.contains(document.activeElement);const detailsOpen=container.querySelector?.('[data-generation-details]')?.open;container.innerHTML=generationProgressHtml(current,{kind,projectId,task,error,cancelPending,compact});if(detailsOpen)container.querySelector('[data-generation-details]').open=true;if(restoreFocus)container.querySelector('[data-generation-stop]')?.focus();}};
  const watcher=watchGenerationProgress({projectId,kind,initial:record,isCurrent:live,onUpdate:(value,detail)=>{current=value;task=detail;error='';render();},onError:()=>{error='暂时无法更新进度';render();},onSettled});
  container.onclick=async event=>{
    if(!event.target.closest('[data-generation-stop]') || cancelPending || !live())return;
    cancelPending=true;render();
    try{await api(`${watcher.base}/${kind==='backend'?'cancel':'stop'}`,post({}));if(live())await watcher.refresh();}
    catch{error='停止请求尚未确认';}
    finally{cancelPending=false;render();}
  };
  return ()=>{disposed=true;watcher.dispose();container.onclick=null;};
}
export function openGenerationProgress({project,record,isCurrent=()=>true}) {
  const root=document.querySelector('#modal-root');
  root.innerHTML='<div class="modal-backdrop"><section class="modal script-dialog" role="dialog" aria-modal="true" aria-label="脚本生成进度"><header><h2>脚本生成进度</h2><button class="icon-button" data-progress-close aria-label="收起进度">×</button></header><div class="modal-body" data-progress-body></div><footer><span class="muted">收起后任务继续；项目首页会显示最新进度。</span><button class="button" data-progress-close>收起</button></footer></section></div>';
  const dialog=root.firstElementChild;
  const stop=mountGenerationProgress({container:dialog.querySelector('[data-progress-body]'),projectId:project.project_id,record,isCurrent:()=>dialog.isConnected && isCurrent()});
  const close=()=>{stop();dialog.remove();window.removeEventListener('hashchange',close);document.removeEventListener('keydown',key);};
  const key=event=>{if(event.key==='Escape')close();};
  dialog.querySelectorAll('[data-progress-close]').forEach(button=>button.onclick=close);
  window.addEventListener('hashchange',close);document.addEventListener('keydown',key);
  return close;
}
export async function openScriptOperation({project,items,mode,go,onError,initialFeedback='',isCurrent=()=>true,onStarted}){
  const root=document.querySelector('#modal-root');
  const initialHash=location.hash;
  const controller=new AbortController();
  let loadingClosed=false;
  root.innerHTML=`<div class="modal-backdrop"><section class="modal script-dialog" role="dialog" aria-modal="true" aria-label="${labels[mode]}"><header><h2>${labels[mode]}</h2></header><div class="modal-body"><p role="status">正在检查 ${items.length} 条用例的生成准备条件…</p></div><footer><button class="button" data-loading-close>取消</button><button class="button primary" disabled>生成脚本</button></footer></section></div>`;
  const loadingDialog=root.firstElementChild;
  const closeLoading=()=>{loadingClosed=true;controller.abort();loadingDialog.remove();detachLoading();};
  const loadingKey=event=>{if(event.key==='Escape')closeLoading();};
  const detachLoading=()=>{window.removeEventListener('hashchange',closeLoading);document.removeEventListener('keydown',loadingKey);};
  loadingDialog.querySelector('[data-loading-close]').onclick=closeLoading;
  window.addEventListener('hashchange',closeLoading);document.addEventListener('keydown',loadingKey);
  const live=()=>!loadingClosed && isCurrent() && location.hash===initialHash;
  const read=path=>api(path,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});
  try{
    const [envs,projectEnvironment]=await Promise.all([
      read(`/api/script-environments?project_id=${encodeURIComponent(project.project_id)}`),
      read(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/environment`),
    ]);
    if(!live()){detachLoading();return;}
    const currentUiId=projectEnvironment.ui_environment_id;
    const currentUi=projectEnvironment.ui;
    const rows=await Promise.all(items.map(async item=>{
      // Fresh generation uses the batch preflight's history, avoiding a full
      // task-store scan per case. Revision still resolves exact candidates.
      if(mode!=='revise')return {...item,candidates:[],lockedSource:null};
      const automation=await read(`/api/case-library/projects/${project.project_id}/cases/${item.case_id}/automation?version=${item.case_version}`);
      const candidates=automation.candidates.filter(candidate=>candidate.applies_to_selected_version);
      const hasIdentity=Boolean(item.source_task_id || item.candidate_version != null || item.bundle_sha256);
      if(mode==='revise' && hasIdentity && !(item.source_task_id && item.candidate_version != null && item.bundle_sha256)) throw Error('REVISION_SOURCE_IDENTITY_INCOMPLETE');
      const lockedSource=mode==='revise' && hasIdentity ? candidates.find(candidate=>candidate.selection.source_task_id===item.source_task_id &&
        String(candidate.selection.candidate_version)===String(item.candidate_version) && candidate.selection.bundle_sha256===item.bundle_sha256) : null;
      if(mode==='revise' && hasIdentity && !lockedSource) throw Error('REVISION_SOURCE_NOT_AVAILABLE');
      return {...item,automation,candidates,lockedSource};
    }));
    if(mode==='revise' && rows.some(row=>row.run_id && row.lockedSource)){
      const {records=[]}=await read(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/execution-records`);
      for(const row of rows){
        if(!row.run_id || !row.lockedSource)continue;
        row.boundRun=records.find(run=>scriptRevisionRunMatches(project.project_id,row,run,row.lockedSource));
        if(!row.boundRun)throw Error('原运行与所选脚本、用例版本或环境身份不匹配，请返回执行列表重新选择。');
      }
    }
    const lockedEnvironments=[...new Set(rows.map(row=>row.lockedSource?.selection.environment_id).filter(Boolean))];
    if(lockedEnvironments.length>1) throw Error('REVISION_ENVIRONMENT_MISMATCH');
    if(lockedEnvironments.length && lockedEnvironments[0]!==currentUiId) throw Error('PROJECT_ENVIRONMENT_MISMATCH');
    if(mode==='revise' && typeof initialFeedback!=='string') throw Error('REVISION_FEEDBACK_INVALID');
    if(initialFeedback.length>6000) throw Error('REVISION_FEEDBACK_TOO_LONG');
    let demonstrations=[];
    if(rows.length===1)try{
      const result=await read(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/demonstrations`);
      demonstrations=(result.recordings||[]).filter(recording=>eligibleDemonstration(recording,rows[0].case_id,rows[0].case_version,recording.environment_id));
    }catch{/* Optional hint is unavailable; ordinary script generation remains available. */}
    if(!live() || root.firstElementChild!==loadingDialog){detachLoading();return;}
    detachLoading();
    let sending=false,closed=false,plan=null,sequence=0,timer;const requestId='script-'+crypto.randomUUID();
    const revisionSourceTable=`<div class="table-wrap"><table><thead><tr><th>用例</th><th>版本</th><th>修订来源</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r.external_id||r.case_id)}</td><td>v${r.case_version}</td><td><select data-revision-source="${i}" aria-label="${esc(r.external_id)} 修订来源" ${r.lockedSource?'disabled':''}><option value="">请选择精确脚本版本</option>${r.candidates.map((c,j)=>`<option value="${j}" ${r.lockedSource===c?'selected':''}>${esc(candidateOptionLabel(c))}</option>`).join('')}</select>${r.lockedSource?'<small>来源已与本次运行精确绑定</small>':''}</td></tr>`).join('')}</tbody></table></div>`;
    root.innerHTML=`<div class="modal-backdrop"><section class="modal script-dialog" role="dialog" aria-modal="true" aria-label="${labels[mode]}"><header><h2>${labels[mode]}</h2><button class="icon-button" id="script-close" aria-label="关闭">×</button></header><div class="modal-body"><div class="notice">将为 ${items.length} 条已选用例生成脚本。</div><div class="notice ${currentUi?'':'warning'}"><strong>测试环境：</strong>${currentUi?`${esc(currentUi.name||currentUi.id)} · ${esc(currentUi.entry_url||currentUi.entry||'无固定地址')}`:'尚未配置'} · <a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/auth">环境设置</a></div><input type="hidden" id="script-environment" value="${esc(currentUiId||'')}"><p><strong>${mode==='revise'?'选定旧脚本并说明问题，Agent 将观察、自测和修订。':'Agent 将依据已确认用例与项目环境观察、编写并自测。'}</strong></p>${mode==='revise'?`${revisionSourceTable}<label class="field">问题反馈<textarea id="script-feedback" rows="3" maxlength="6000" placeholder="描述实际问题；原动作与预期保持不变"></textarea></label>`:''}<div id="script-plan" role="status" aria-live="polite">正在检查准备条件…</div><details class="script-advanced"><summary>高级设置</summary><p id="script-environment-info" class="muted"></p><div id="script-plan-details"></div><p>此操作调用 Coding Agent；不修改原动作与预期。软件版本在运行时另填。每次执行使用独立测试浏览器。</p><label class="backend-check"><input type="checkbox" id="script-skill-profile">使用测试编写规范（实验）</label><label class="field"><span>生成方式</span><select id="script-review-mode"><option value="self-test-v1">自测通过即可运行（默认）</option><option value="static-v1">A：无工具审查</option><option value="dsh-tools-v1">B：受控工具审查（实验）</option></select></label><p class="muted">默认自测通过即可运行；可按需启用独立审查。</p>${mode==='revise'?'<p>修订脚本来源请在主视图明确选择；其他旧候选不会自动代入。</p>':`<div class="table-wrap"><table><thead><tr><th>用例</th><th>版本</th><th>已有脚本（始终保留）</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r.external_id||r.case_id)}</td><td>v${r.case_version}</td><td data-script-history="${i}">正在检查…</td></tr>`).join('')}</tbody></table></div>`}${rows.length===1?'<label class="field" id="script-demonstration-field" hidden>人工示范（可选）<select id="script-demonstration"><option value="">不使用示范</option></select><small>仅传入已确认的脱敏示范，原用例预期仍是唯一断言来源。</small><details><summary>示范记录身份</summary><code id="script-demonstration-identity"></code></details></label>':''}<p class="notice">失败、取消或超时保留旧脚本、历史结果与媒体；自测通过的脚本可直接运行；正在执行的批次仍使用原脚本。</p></details><p role="alert" id="script-error"></p></div><footer><button class="button" id="script-cancel">取消</button><button class="button" id="script-check">重查</button><button class="button primary" id="script-confirm" disabled>${mode==='regenerate'?'重新生成':mode==='revise'?'修订脚本':'生成脚本'}</button></footer></section></div>`;
    const dialog=root.firstElementChild,$=selector=>dialog.querySelector(selector);
    const updateDemonstrations=()=>{
      const select=$('#script-demonstration');if(!select)return;
      const matching=demonstrations.filter(recording=>eligibleDemonstration(recording,rows[0].case_id,rows[0].case_version,$('#script-environment').value));
      select.innerHTML='<option value="">不使用示范</option>'+matching.map(recording=>`<option value="${esc(recording.demonstration_id)}">${esc(demonstrationOptionLabel(recording))}</option>`).join('');
      $('#script-demonstration-identity').textContent=matching.map(recording=>`${demonstrationOptionLabel(recording)}：${recording.demonstration_id}`).join('\n');
      $('#script-demonstration-field').hidden=!matching.length;
    };
    if(mode==='revise'){
      $('#script-feedback').value=initialFeedback;
      const bound=rows.filter(row=>row.boundRun);
      if(bound.length)$('#script-feedback').closest('label').insertAdjacentHTML('beforebegin',`<div class="notice" role="status"><strong>原运行、用例和脚本已自动绑定</strong>${bound.map(row=>`<p>${esc(row.external_id||row.case_id)} v${esc(row.case_version)} · ${esc(row.lockedSource.script_version?'S'+row.lockedSource.script_version:'候选 v'+row.lockedSource.selection.candidate_version)} · 运行 ${esc(row.run_id)} · 原结果 ${esc(row.boundRun.status)}</p>${failureFeedbackHtml(row.boundRun)}`).join('')}<p>请只补充实际观察；反馈不会自动更改原用例预期。</p></div>`);
    }
    const payload=()=>({mode,request_id:requestId,quality_review_mode:$('#script-review-mode').value,skill_profile:$('#script-skill-profile').checked?'test-authoring-v1':'off',environment_id:document.querySelector('#script-environment').value,items:rows.map((r,i)=>{
      const input={case_id:r.case_id,case_version:r.case_version};
      if(rows.length===1 && $('#script-demonstration')?.value)input.demonstration_id=$('#script-demonstration').value;
      if(mode==='revise'){
        const selected=document.querySelector(`[data-revision-source="${i}"]`).value;
        const candidate=selected===''?null:r.candidates[Number(selected)];
        if(candidate)Object.assign(input,{source_task_id:candidate.selection.source_task_id,candidate_version:candidate.selection.candidate_version,bundle_sha256:candidate.selection.bundle_sha256});
        input.feedback=document.querySelector('#script-feedback').value;
        if(r.boundRun&&r.lockedSource===candidate)input.run_id=r.boundRun.run_id;
      }return input;
    })});
    const updateConfirm=()=>{$('#script-confirm').disabled=sending||!plan||plan.items.some(i=>i.reason);};
    const check=async token=>{
      if(!currentUiId){ plan={items:rows.map(row=>({external_id:row.external_id||row.case_id,case_version:row.case_version,reason:'PROJECT_ENVIRONMENT_NOT_CONFIGURED'}))}; $('#script-plan').innerHTML=`<p class="notice warning">${reasons.PROJECT_ENVIRONMENT_NOT_CONFIGURED} <a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/auth">去项目测试环境设置</a></p>`; $('#script-error').textContent=''; $('#script-check').disabled=false; updateConfirm(); return; }
      try{
        const result=await api(`/api/case-library/projects/${project.project_id}/script-operations/preflight`,{...post(payload()),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});
        if(closed||!dialog.isConnected||token!==sequence)return;
        plan=result;
        if(mode!=='revise')for(const [index,row] of rows.entries()){
          const history=plan.items.find(item=>item.case_id===row.case_id)?.old_scripts || [];
          const cell=dialog.querySelector(`[data-script-history="${index}"]`);
          if(cell)cell.textContent=history.map(item=>`候选 v${item.candidate_version} · ${item.source_task_id}`).join('、') || '未生成';
        }
        const blocked=plan.items.filter(i=>i.reason);
        const reviewIds=blocked.filter(item=>item.reason==='CASE_CONTENT_NOT_CONFIRMED').map(item=>item.case_id);
        const reviewQuery=new URLSearchParams({status:'PENDING_CONFIRMATION',type:'UI',review:'all',selected:reviewIds.join(','),return:`#/projects/${project.project_id}?prepare=ui&selected=${encodeURIComponent(rows.map(item=>item.case_id).join(','))}`});
        $('#script-plan').innerHTML=blocked.length?`<p class="notice warning">${blocked.length} 条用例需先处理</p><ul>${blocked.map(i=>`<li>${esc(i.external_id || '用例')}：${esc(reasons[i.reason] || batchReasons[i.reason] || i.reason)}${i.reason==='CASE_CONTENT_NOT_CONFIRMED'?` · <a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(i.case_id)}?tab=content">核对用例正文</a>`:/ENVIRONMENT|TARGET|AUTH_SESSION|NOT_AUTHORIZED/.test(i.reason)?` · <a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/auth">检查项目环境</a>`:''}</li>`).join('')}</ul>${reviewIds.length?`<p><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases?${esc(reviewQuery.toString())}">批量核对所选待确认用例</a></p>`:''}`:`<p class="notice">准备就绪，可以开始生成 ${plan.items.length} 条脚本。</p>`;
        $('#script-plan-details').innerHTML=`<ul>${plan.items.map(i=>`<li>${esc(i.external_id || '用例')} · 用例 v${esc(i.case_version)}${i.limits?` · 最长 ${i.limits.wall_ms/60000} 分钟`:''}</li>`).join('')}</ul>`;
      }catch(e){if(!closed&&dialog.isConnected&&token===sequence){$('#script-error').textContent=reasons[e.message]||e.message;$('#script-plan').textContent='准备检查未完成，修正条件后可重试。';}}
      finally{if(!closed&&dialog.isConnected&&token===sequence){$('#script-check').disabled=false;updateConfirm();}}
    };
    const schedule=(delay=0)=>{
      if(sending||closed)return;clearTimeout(timer);const token=++sequence;plan=null;
      updateConfirm();
      $('#script-error').textContent='';$('#script-plan').textContent='正在检查准备条件…';$('#script-check').disabled=true;
      const env=envs.environments.find(e=>e.id===$('#script-environment').value);
      $('#script-environment-info').textContent=env?`${environmentName(env)}：${env.entry_url||env.entry||reasons[env.reason]||env.reason||'运行时自动准备本机页面'}；${env.browser||'每次独立启动测试浏览器'}。`:reasons.PROJECT_ENVIRONMENT_NOT_CONFIGURED;
      timer=setTimeout(()=>void check(token),delay);
    };
    dialog.querySelectorAll('select,textarea,#script-skill-profile').forEach(el=>el.addEventListener('input',()=>schedule(200)));
    $('#script-environment').addEventListener('change',updateDemonstrations);
    if(lockedEnvironments.length){
      $('#script-environment').value=lockedEnvironments[0];$('#script-environment').disabled=true;
    }else if(envs.environments.length===1)$('#script-environment').value=envs.environments[0].id;
    updateDemonstrations();
    const close=()=>{if(sending||closed)return;closed=true;controller.abort();sequence++;clearTimeout(timer);document.removeEventListener('keydown',onKey);window.removeEventListener('hashchange',close);dialog.remove();};
    const onKey=e=>{if(e.key==='Escape')close();};
    document.addEventListener('keydown',onKey);window.addEventListener('hashchange',close);
    dialog.querySelectorAll('#script-close,#script-cancel').forEach(el=>el.onclick=close);
    $('#script-check').onclick=()=>schedule();
    $('#script-confirm').onclick=async()=>{
      if(sending||closed||!live()||$('#script-confirm').disabled)return;
      const input={...payload(),confirm_model_use:true};
      sending=true;const controls=[...dialog.querySelectorAll('button,input,select,textarea')];
      const disabled=controls.map(el=>el.disabled);controls.forEach(el=>{el.disabled=true;});
      const confirmLabel=$('#script-confirm').textContent;
      $('#script-confirm').textContent='正在启动…';
      $('#script-plan').textContent=`正在提交 ${rows.length} 条用例，等待工作台确认任务已启动…`;
      $('#script-error').textContent='';
      try{
        const v=await api(`/api/case-library/projects/${project.project_id}/script-operations`,post(input));
        sending=false;close();if(!live())return;
        if(onStarted)onStarted(v);else openGenerationProgress({project,record:v,isCurrent:live});
      }catch(error){
        $('#script-error').textContent=error.message==='BUILD_TASK_ALREADY_ACTIVE'?'工作台正在执行其他任务，本次未启动。任务结束后可直接重试。':reasons[error.message]||error.message;
        $('#script-plan').textContent='尚未确认本次启动结果，请检查生成记录后再重试。';
      }finally{
        sending=false;controls.forEach((el,i)=>{if(el.isConnected)el.disabled=disabled[i];});if(!closed){$('#script-confirm').textContent=confirmLabel;updateConfirm();}
      }
    };
    schedule();
  }catch(e){if(live()){if(root.firstElementChild===loadingDialog)loadingDialog.querySelector('[role="status"]').textContent=`准备检查未完成：${e.message}。请关闭后重试。`;else onError(e);}}
}
export async function renderGeneration({project,id,showPage,isCurrent=()=>true}){
  const endpoint=`/api/case-library/projects/${encodeURIComponent(project.project_id)}/script-operations`;
  if(!id){
    const {operations}=await api(endpoint);if(!isCurrent())return;
    showPage(`<div class="page-heading"><h1>脚本生成记录</h1><a data-nav href="#/projects/${project.project_id}">返回项目首页</a></div><section class="panel"><div class="panel-body">${operations.map(v=>`<p><a data-nav href="#/projects/${project.project_id}/generation/${v.operation_id}">${esc(v.created_at)} · ${labels[v.mode]} · ${esc(generationProgress(v).title)}</a></p>`).join('')||'<p>尚未发起生成。</p>'}</div></section>`);return;
  }
  const record=await api(`${endpoint}/${encodeURIComponent(id)}`);if(!isCurrent())return;
  showPage(`<div class="page-heading"><h1>${esc(labels[record.mode] || '脚本生成进度')}</h1><a data-nav href="#/projects/${project.project_id}">返回项目首页</a></div><section class="panel"><div class="panel-body" id="generation-progress-body"></div></section>`);
  return mountGenerationProgress({container:document.querySelector('#generation-progress-body'),projectId:project.project_id,record,isCurrent});
}
