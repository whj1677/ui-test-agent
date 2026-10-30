import { projectCaseSelection } from './case-selection.js';
import { api } from './api.js';
import { loadNativeConsole, nativeConsoleModel, nativeScriptsHtml, nativeRecordsHtml, nativeRerunGroups, bindNativeConsole } from './native-console-view.js';
import { esc, batchReasons, stateLabel, remedyHtml, workspaceViewsHtml, workspaceViewHref } from './workflow.js';
import { openScriptOperation, mountGenerationProgress, generationProgress } from './script-actions.js';
import { requirementsApi } from './requirements-api.js';

const post = body => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const statusNames = {READY:'可生成',NEEDS_SUPPLEMENT:'需补充',CONFLICT:'存在冲突',UNSUPPORTED:'暂不支持',EXISTS:'已有脚本'};
const generationFailureReasons = {
  HARNESS_MODEL_TRANSPORT_FAILED:'模型服务调用失败，请检查服务连接后重新检查准备条件',
  MODEL_PROVIDER_UNAVAILABLE:'模型服务暂不可用，本条未生成；请检查服务后重新检查',
  MODEL_REQUEST_FAILED:'模型审查请求失败，请重新生成',
  'HARNESS_INCOMPLETE:error':'生成过程意外中断，请查看过程',
  DEVELOPMENT_HARNESS_PATCH_INVALID:'生成环境检查未通过，请联系项目维护人员',
  NO_TESTED_CANDIDATE_SUBMITTED:'脚本未完成最终提交，请查看过程后重新生成',
  CANDIDATE_BUDGET_EXHAUSTED:'本次自动修订仍未通过检查，请查看过程后重新生成'
};
const sourceId = source => source?.snapshot_id || source?.source_id || source?.id || '';
export function currentCaseItems(project) {
  return (project.cases || []).flatMap(item => {
    const content=item.versions?.find(v=>Number(v.version)===Number(item.current_version))?.content;
    return content?[{case_id:item.case_id,case_version:item.current_version,external_id:content.external_id || item.external_id,title:content.title || item.title,case_type:content.case_type,status:content.status}]:[];
  });
}
export function visibleWorkflowItems(items,type) { return type==='all'?items:items.filter(item=>(item.case_type==='BACKEND'?'backend':'ui')===type); }
export function workflowSelection(items,selected,type='all') {
  const visible=visibleWorkflowItems(items,type).filter(item=>selected.has(item.case_id));
  return {ids:visible.map(item=>item.case_id),ui:visible.filter(item=>item.case_type!=='BACKEND').length,backend:visible.filter(item=>item.case_type==='BACKEND').length};
}
export function workflowBackendPlans(item,plans=[]) {
  const current=plans.filter(plan=>plan.case_id===item.case_id && Number(plan.case_version)===Number(item.case_version));
  return {confirmed:current.filter(plan=>plan.state==='CONFIRMED'),pending:current.filter(plan=>['DRAFT','GENERATING'].includes(plan.state))};
}
export function workflowRunState(item,preview,plans=[]) {
  if(item.status!=='CONFIRMED')return {ready:false,label:'用例待确认',reason:'请先核对并确认业务内容。'};
  if(!preview)return {ready:false,label:'尚未检查',reason:'重新检查可运行条件后再选择。'};
  if(Number(preview.case_version)!==Number(item.case_version))return {ready:false,label:'版本需重查',reason:'用例版本已变化，请重新检查。'};
  if(preview.reason==='SCRIPT_SELECTION_REQUIRED'){
    const {confirmed,pending}=workflowBackendPlans(item,plans);
    return {ready:false,label:confirmed.length?'已确认 · 待选版本':'待选择版本',reason:confirmed.length?`${confirmed.map(plan=>`P${plan.version}`).join('、')} 已确认，请选择本次运行版本。${pending.length?'另有计划尚待处理。':'无需重复核对。'}`:'请选择本次运行的脚本版本。'};
  }
  return {ready:preview.state==='QUEUED' && !preview.reason,label:preview.state==='QUEUED' && !preview.reason?'已就绪':/AUTH_SESSION/.test(preview.reason||'')?'需登录':preview.reason==='SCRIPT_MISSING'?'缺少脚本':preview.reason==='SCRIPT_GENERATION_FAILED'?'生成失败':preview.reason==='BACKEND_PLAN_REVIEW_REQUIRED'?'待核对计划':'需要处理',reason:batchReasons[preview.reason] || (preview.reason?'准备条件尚未满足，请查看并处理。':preview.state==='QUEUED'?'运行前仍会核对版本、环境和授权。':'当前未达到可运行条件。')};
}
export function workflowEnvironmentState(environment,type='all') {
  const entries=[];
  for(const kind of type==='all'?['ui','backend']:[type]){
    const target=environment[kind],name=kind==='ui'?'前端':'后端';
    if(!target){entries.push({kind,tone:'warning',label:`${name}：未配置`,url:''});continue;}
    const status=environment[`${kind}_status`],url=target.entry_url || target.entry || target.base_url || target.name || '';
    const changed=status && status!=='CONFIGURED';
    const unavailable=target.reason==='GENERATION_TARGET_UNREACHABLE';
    entries.push({kind,url,tone:changed || target.ready===false?'warning':target.ready===true?'success':'neutral',label:`${name}：${changed?'配置需重新核对':unavailable?'地址无法访问':target.ready===false?'当前未就绪':target.ready===true?'地址可访问':'配置已保存 · 连接未检查'}`});
  }
  return entries;
}
export function workflowNextAction(items,previews,environment,{type='all',plans=[],checking=false,error=''}={}) {
  if(checking)return {action:'wait',label:'正在检查…',hint:'正在读取当前准备状态。'};
  if(error)return {action:'recheck',label:'重新检查',hint:'准备状态读取失败，请重新检查。'};
  if(!items.length)return {action:'import',label:'导入用例',hint:'先导入需要测试的用例。'};
  if(items.some(item=>workflowRunState(item,previews.find(row=>row.case_id===item.case_id),plans).ready))return null;
  const kinds=new Set(items.map(item=>item.case_type==='BACKEND'?'backend':'ui'));
  if(workflowEnvironmentState(environment,type).some(entry=>kinds.has(entry.kind) && entry.tone==='warning'))return {action:'environment',label:'检查测试环境',hint:'先处理环境配置或连接问题，再运行测试。'};
  const pending=items.find(item=>item.status!=='CONFIRMED');
  if(pending)return {action:'cases',label:'核对用例',hint:'先确认用例内容，再准备脚本。'};
  const review=items.find(item=>item.case_type==='BACKEND' && workflowBackendPlans(item,plans).pending.length===1 && workflowBackendPlans(item,plans).pending[0].state==='DRAFT' && ['BACKEND_PLAN_REVIEW_REQUIRED','SCRIPT_SELECTION_REQUIRED'].includes(previews.find(row=>row.case_id===item.case_id)?.reason));
  if(review)return {action:'review',label:'核对后端计划',hint:'核对待确认计划后，再选择运行版本。'};
  const choose=previews.find(row=>items.some(item=>item.case_id===row.case_id) && row.reason==='SCRIPT_SELECTION_REQUIRED');
  if(choose)return {action:'choose',caseId:choose.case_id,label:'选择运行版本',hint:'已有脚本，请选择本次要使用的版本。'};
  const missing=items.find(item=>['SCRIPT_MISSING','SCRIPT_GENERATION_FAILED','BACKEND_CONFIRMED_PLAN_REQUIRED','CASE_VERSION_NOT_APPLICABLE'].includes(previews.find(row=>row.case_id===item.case_id)?.reason));
  if(missing)return {action:missing.case_type==='BACKEND'?'backend':'ui',label:missing.case_type==='BACKEND'?'准备后端脚本':'准备前端脚本',hint:'先完成脚本准备，再开始运行。'};
  const blocked=items.find(item=>previews.find(row=>row.case_id===item.case_id)?.reason);
  return blocked?{action:'case',caseId:blocked.case_id,label:'处理运行条件',hint:'查看用例中尚未满足的运行条件。'}:{action:'recheck',label:'重新检查',hint:'尚无可运行用例，请先检查准备状态。'};
}
export function currentUiItems(project) {
  return (project.cases || []).flatMap(item => {
    const content = item.versions?.find(v => Number(v.version) === Number(item.current_version))?.content;
    return content?.status === 'CONFIRMED' && content.case_type !== 'BACKEND'
      ? [{case_id:item.case_id,case_version:item.current_version,external_id:content.external_id || item.external_id,title:content.title || item.title}] : [];
  });
}
export function splitUiReadiness(items) {
  return {ready:items.filter(i=>!i.reason && i.state!=='BLOCKED'),existing:items.filter(i=>i.reason==='SCRIPT_ALREADY_EXISTS'),blocked:items.filter(i=>(i.reason && i.reason!=='SCRIPT_ALREADY_EXISTS') || (i.state==='BLOCKED' && !i.reason)),failedHistory:items.filter(i=>i.failed_script_records?.length)};
}
export function uiGenerationItems(project, readiness, selected = new Set()) {
  const current = currentUiItems(project), uiIds = new Set(currentCaseItems(project).filter(item=>item.case_type!=='BACKEND').map(item=>item.case_id));
  const selectedUi = new Set([...selected].filter(id=>uiIds.has(id)));
  return splitUiReadiness(readiness).ready.flatMap(plan=>{
    const item=current.find(row=>row.case_id===plan.case_id && Number(row.case_version)===Number(plan.case_version));
    return item && (!selected.size || selectedUi.has(item.case_id)) ? [item] : [];
  });
}
export function backendGroups(items) {
  return Object.fromEntries(Object.keys(statusNames).map(status=>[status,items.filter(item=>item.status===status)]));
}
export function backendGenerationBlock(preparation) {
  if (!preparation) return '协议准备检查尚未完成。';
  if (preparation.model_available === false) return '脚本生成服务暂不可用，请联系项目维护人员。';
  const limits=preparation.limits?.generation || preparation.generation_limits;
  if (!limits || !['wall_ms','tool_calls','harness_starts','self_tests'].every(key=>Number.isFinite(limits[key]) && limits[key]>0)) return '脚本生成服务尚未就绪，请重新检查或联系项目维护人员。';
  return '';
}
export function backendBatchInput(preparation, {requestId,reviewer,modelConfirmed,httpConfirmed,analysisConfirmed}) {
  if (!reviewer?.trim()) throw Error('请填写本次操作者。');
  if (!modelConfirmed || !httpConfirmed || !analysisConfirmed) throw Error('请明确提交本次脚本生成操作。');
  if (!preparation.items?.some(item=>item.status==='READY')) throw Error('没有可生成的后端用例。');
  return {request_id:requestId,preparation_sha256:preparation.preparation_sha256,protocol_source_id:preparation.protocol_source_id,reviewer:reviewer.trim(),confirm_protocol_analysis:true,allow_model:true,allow_http_self_test:true};
}
export function preparationHtml(preparation,{base='',caseReturn=''}={}) {
  if (!preparation) return '<p class="muted">上传协议后，自动检查每条后端用例。</p>';
  const groups=backendGroups(preparation.items || []);
  const needsRevision=item=>item.missing?.some(issue=>issue.code==='BACKEND_CASE_STAGE_CONFLICT');
  const caseLink=item=>`${base}/cases/${encodeURIComponent(item.case_id)}?version=${encodeURIComponent(item.case_version)}&tab=${needsRevision(item)?'content':'scripts'}${caseReturn?'&return='+encodeURIComponent(caseReturn):''}`;
  const remedy=item=>needsRevision(item)?(base?`<a class="button" data-nav href="${caseLink(item)}">修订用例</a>`:''):'<button class="button" type="button" data-pw-protocol>补充信息</button>';
  const row=item=>`<tr><td><small>${esc(item.external_id || '')}</small><strong>${esc(item.title || item.external_id || '用例')}</strong></td><td><span class="badge ${item.status==='READY'?'success':'warning'}">${esc(needsRevision(item)?'需修订用例':statusNames[item.status] || '待核对')}</span></td><td>${base?`<a data-nav href="${caseLink(item)}">${needsRevision(item)?'修订用例':item.status==='EXISTS'?'核对执行计划':'查看用例与协议'}</a>`:''}${item.missing?.length && !needsRevision(item)?'<button type="button" class="pw-text-action" data-pw-protocol>补充信息</button>':''}</td></tr>`;
  return `<p class="pw-counts">${Object.entries(statusNames).filter(([key])=>groups[key].length).map(([key,label])=>`<span>${label} <strong>${groups[key].length}</strong></span>`).join('') || '暂无已确认的后端用例'}</p>${preparation.items?.length?`<div class="table-wrap"><table class="pw-table"><thead><tr><th>测试用例</th><th>生成准备</th><th>操作</th></tr></thead><tbody>${preparation.items.map(row).join('')}</tbody></table></div>`:''}${(preparation.items||[]).filter(item=>item.missing?.length).map(item=>`<article class="pw-gap"><div><strong>${esc(item.title || item.external_id)}</strong><ul>${item.missing.map(issue=>`<li>${issue.step_order?`步骤 ${esc(issue.step_order)}：`:''}${esc(issue.message || issue.code)}</li>`).join('')}</ul></div>${remedy(item)}</article>`).join('')}`;
}
export function limitsHtml(limits) {
  if (!limits) return '资源上限未返回，请重新检查。';
  const labels={wall_ms:'每条最长时间',tool_calls:'工具调用',harness_starts:'开发启动',self_tests:'自测',quality_reviews:'质量审查',independent_validations:'独立复验'};
  return Object.entries(labels).filter(([key])=>limits[key]!=null).map(([key,label])=>`${label} ${key==='wall_ms'?`${Math.round(limits[key]/60000*10)/10} 分钟`:`${limits[key]} 次`}`).join(' · ') || '详见高级资源设置';
}

export async function renderProjectWorkflow({project,showPage,go,launchBatch,onError=()=>{},isCurrent=()=>true}) {
  const pid=encodeURIComponent(project.project_id),base=`#/projects/${pid}`,endpoint=`/api/case-library/projects/${pid}`;
  let disposed=false,loginTimer,loginActive=false,uiBusy=true,backendBusy=true,preparation=null,preparationValid=false,protocolId='',generationBatches=[],backendDialog=null,authSession=null,uiOperation=null,stopUiProgress=null,stopBackendProgress=null,backendBatchesKnown=false,visibleBackendBatchId=null,bulkReviewBusy=false,stopBulkReview=null;
  const initialController=new AbortController();
  const initialSignal=AbortSignal.any([initialController.signal,AbortSignal.timeout(30000)]);
  const live=()=>!disposed && isCurrent();
  const dispose=()=>{disposed=true;initialController.abort();clearTimeout(loginTimer);stopUiProgress?.();stopBackendProgress?.();stopBulkReview?.();backendDialog?.remove();window.removeEventListener('hashchange',dispose);};
  window.addEventListener('hashchange',dispose);
  let environment;
  try{environment=await api(`${endpoint}/environment`,{signal:initialSignal});}catch(error){dispose();throw error;}
  if (!live()) return dispose;
  const ui=environment.ui,backend=environment.backend,uiId=environment.ui_environment_id || ui?.id;
  const uiItems=currentUiItems(project),caseItems=currentCaseItems(project),selected=projectCaseSelection(project.project_id,project.cases,new URLSearchParams((globalThis.location?.hash||'').split('?')[1]||''));
  const hasBackendCases=(project.cases||[]).some(item=>item.versions?.find(v=>Number(v.version)===Number(item.current_version))?.content?.case_type==='BACKEND');
  let nativeData={scripts:[],records:[],tasks:[]};
  const nativeModel=()=>nativeConsoleModel(project,nativeData,{currentOnly:true});
  const nativeDraft=item=>nativeModel().drafts.find(row=>row.case_id===item.case_id && Number(row.case_version)===Number(item.case_version));
  const hasNative=item=>Boolean(nativeDraft(item)) || nativeModel().scripts.some(row=>row.case_id===item.case_id && Number(row.case_version)===Number(item.case_version));
  const runState=(item,preview,plans)=>hasNative(item)&&item.case_type!=='BACKEND'?{ready:false,label:'DSH 原稿复跑',reason:'使用上方“运行已有脚本”，核对冻结版本后零模型执行。'}:workflowRunState(item,preview,plans);
  let uiPlan=[],readinessError='正在检查前端脚本准备条件…',runPlan=[],runError='正在检查可运行条件…',runBusy=true,backendPlans=[];
  let updateUiScope=()=>{};
  const readRun=signal=>caseItems.length
    ? api(`${endpoint}/batches/preflight`,{...post({scope:'project',case_ids:[],selections:[],software_version:'',mode:'technical'}),...(signal?{signal}:{})})
    : Promise.resolve({items:[]});
  const readPlans=signal=>hasBackendCases?api(`${endpoint}/backend`,signal?{signal}:{}):Promise.resolve({plans:[]});
  const checkUi=async signal=>{
    const results=[];
    if (!uiId) return [];
    for(let offset=0;offset<uiItems.length;offset+=200){
      if(!live()) return [];
      const result=await api(`${endpoint}/script-operations/preflight`,{...post({mode:'generate',request_id:`readiness-${crypto.randomUUID()}`,environment_id:uiId,quality_review_mode:'self-test-v1',skill_profile:'off',items:uiItems.slice(offset,offset+200).map(({case_id,case_version})=>({case_id,case_version}))}),...(signal?{signal}:{})});
      results.push(...(result.items || []));
    }
    return results;
  };
  const readBackend=signal=>api(`${endpoint}/backend/preparation${protocolId?`?protocol_source_id=${encodeURIComponent(protocolId)}`:''}`,signal?{signal}:{});
  const readAuth=signal=>ui?.auth_required && uiId && ui.auth_role ? api(`${endpoint}/auth?environment_id=${encodeURIComponent(uiId)}&role=${encodeURIComponent(ui.auth_role)}`,signal?{signal}:{}):Promise.resolve(null);
  const loadBackend=async()=>{const result=await readBackend();if(live()){preparation=result;preparationValid=true;protocolId=result.protocol_source_id || protocolId;}};
  let backendError='正在检查后端脚本准备条件…';
  const backendItems=(project.cases||[]).filter(item=>item.versions?.find(v=>Number(v.version)===Number(item.current_version))?.content?.case_type==='BACKEND');
  const hasConfirmed=(project.cases||[]).some(item=>item.versions?.find(v=>Number(v.version)===Number(item.current_version))?.content?.status==='CONFIRMED');
  const firstNeedsEnvironment=(!ui && !backend) || caseItems.some(item=>item.case_type==='BACKEND'?!backend:!ui);
  const hasActiveGeneration=generationProgress(uiOperation).active || generationBatches.some(batch=>generationProgress(batch,'backend').active);
  const viewQuery=new URLSearchParams((globalThis.location?.hash || '').split('?')[1] || '');
  const requestedPrepare=['ui','backend'].includes(viewQuery.get('prepare'))?viewQuery.get('prepare'):null;
  const requestedType=['all','ui','backend'].includes(viewQuery.get('test_type'))?viewQuery.get('test_type'):null;
  const nativeActive=()=>nativeData.tasks?.some(task=>['QUEUED','PREPARING','RUNNING','STOPPING','STOP_UNCONFIRMED'].includes(task.status));
  const nativeHref=()=>`${base}/native-dsh?selected=${encodeURIComponent([...selected].join(','))}`;
  for(const item of uiItems)if((viewQuery.get('selected')||'').split(',').includes(item.case_id))selected.add(item.case_id);
  if(requestedPrepare==='ui' && viewQuery.get('legacy')!=='1'){go(nativeHref());return dispose;}
  const activeType=generationProgress(uiOperation).active?'ui':generationBatches.some(batch=>generationProgress(batch,'backend').active)?'backend':null;
  let selectedType=requestedPrepare || requestedType || activeType || 'all',viewTouched=false;
  const initialView=requestedPrepare || (!requestedType && activeType==='backend')?'prepare':'run';
  for(const item of visibleWorkflowItems(caseItems,selectedType))if((viewQuery.get('selected') || '').split(',').includes(item.case_id))selected.add(item.case_id);
  const caseReturn=(type=selectedType)=>{const query=new URLSearchParams({test_type:type}),ids=workflowSelection(caseItems,selected,type).ids;if(ids.length)query.set('selected',ids.join(','));return `${base}?${query}`;};
  showPage(`<div class="page-heading"><div><h1>${esc(project.name)}</h1><p>在同一工作台管理用例、生成脚本并运行测试。</p></div></div>
    ${workspaceViewsHtml(project,'scripts',[...selected])}
    <div class="native-front-actions"><a class="button primary" id="pw-native-dsh" data-nav href="${base}/native-dsh">开始测试</a><button class="button" id="pw-native-existing" disabled>运行已有脚本（不调用模型）</button><span class="muted">首次测试由 DSH 编写并执行；已有脚本可直接复跑。</span></div>
    <div id="pw-native-console"></div>
    <div class="pw-environment-line"><div id="pw-environment-status" role="status"></div><a data-nav href="${base}/auth">${ui || backend?'环境设置':'先配置环境'}</a></div>
    ${!hasConfirmed?`<section class="panel pw-first-step"><h2>${firstNeedsEnvironment?'先配置测试环境':caseItems.length?'先核对测试用例':'先准备测试用例'}</h2><p>${firstNeedsEnvironment?'设置被测系统地址和登录方式，后续测试使用此项目环境。':caseItems.length?`已导入 ${caseItems.length} 条，全部待确认。先批量核对步骤与预期，再生成脚本。`:'导入已有 Excel，或通过 AI 用例助手设计后下载并导入。'}</p><div class="actions">${firstNeedsEnvironment?`<a class="button primary" data-nav href="${base}/auth">配置测试环境</a>`:''}${caseItems.length?`<a class="button ${firstNeedsEnvironment?'':'primary'}" data-nav href="${base}/cases?status=PENDING_CONFIRMATION&review=all&return=${encodeURIComponent(`${base}?prepare=ui`)}">批量核对用例（${caseItems.length}）</a>`:''}<a class="button ${!firstNeedsEnvironment && !caseItems.length?'primary':''}" data-nav href="${base}/import">导入用例</a><a class="button" data-nav href="${base}/requirements">AI 用例助手</a></div></section>`:''}
    <section class="panel pw-workspace">
      <div class="pw-test-tabs" role="tablist" aria-label="测试类型"><button type="button" role="tab" id="pw-tab-all" aria-controls="pw-panel-all">全部用例 <span>${caseItems.length}</span></button><button type="button" role="tab" id="pw-tab-ui" aria-controls="pw-panel-ui">前端测试 <span>${caseItems.filter(i=>i.case_type!=='BACKEND').length}</span></button><button type="button" role="tab" id="pw-tab-backend" aria-controls="pw-panel-backend">后端测试 <span>${backendItems.length}</span></button></div>
      <div id="pw-panel-all" role="tabpanel" aria-labelledby="pw-tab-all" class="panel-body"><div class="pw-task-heading"><div><h2 id="pw-run-title">批量操作</h2><p class="muted" id="pw-selection-summary">尚未选择用例</p></div><div class="actions"><button class="button primary" id="pw-next-step" hidden></button><button class="button" id="pw-review-backend" hidden>批量核对计划</button><button class="button" id="pw-select-ready">选择已就绪用例</button><button class="button primary" id="pw-run-selected" disabled>运行所选用例</button></div></div><div class="pw-prepare-links"><button class="button primary" id="pw-prepare-ui">批量生成前端脚本</button><button class="button" id="pw-prepare-backend">批量生成后端脚本</button></div><p class="muted">此页集中处理批量生成与运行；切换“用例”可编辑、核对正文和导出。</p><p id="pw-run-error" role="alert"></p><details class="pw-case-picker" id="pw-case-picker"><summary>展开选择前端生成或测试运行范围（${caseItems.length} 条）</summary><div id="pw-run-table"></div></details><div class="pw-table-footer"><p id="pw-scope-hint" class="muted">勾选决定本次运行范围。</p><div><button class="pw-text-action" id="pw-recheck-run">重新检查</button></div></div></div>
      <div class="panel-body" id="pw-panel-ui" role="tabpanel" aria-labelledby="pw-tab-ui">
        <div class="pw-task-heading"><div><h2>准备前端脚本</h2><p class="muted">${uiItems.length} 条已确认用例 · 已有脚本始终保留</p></div><button class="button small" id="pw-recheck-ui" ${uiId?'':'disabled'}>重新检查</button></div>
        ${!ui?`<p class="notice warning">尚未配置前端环境。<a data-nav href="${base}/auth">配置前端环境</a></p>`:''}
        ${ui?.auth_required?`<div class="pw-identity"><div><strong>${authSession?.verification_mode==='browser-page'?'登录方式：手动登录':`当前测试身份：${esc(ui.auth_role || '尚未指定')}`}</strong><p id="pw-login-status" role="status"></p><small>${authSession?.verification_mode==='browser-page'?'使用专用浏览器登录后的会话，检查测试入口能否访问。':'按项目配置的身份检查；不同身份的用例须先核对环境。'}</small></div><button class="button primary" id="pw-login" ${uiId && ui.auth_role?'':'disabled'}>${authSession?.verification_mode==='browser-page'?'打开登录浏览器':`登录${esc(ui.auth_role || '')}账号`}</button><button class="button" id="pw-login-check" hidden>我已登录，检查页面</button></div>${!ui.auth_role?`<p class="notice warning">请在<a data-nav href="${base}/auth">环境设置</a>中指定登录角色。</p>`:''}`:''}
        <div id="pw-ui-blockers" role="status"></div>
        <div class="actions"><button class="button primary" id="pw-generate-ui" ${uiId?'':'disabled'}>生成前端脚本</button><a class="button" id="pw-review-ui" data-nav href="${base}/cases">查看并核对脚本</a></div>
        <div id="pw-ui-readiness" role="status"></div><p id="pw-ui-error" role="alert">${esc(readinessError)}</p>
        <div id="pw-ui-progress"></div>
      </div>
      <div class="panel-body" id="pw-panel-backend" role="tabpanel" aria-labelledby="pw-tab-backend">
        <div class="pw-task-heading"><div><h2>生成后端测试脚本</h2><p class="muted">${backendItems.length} 条后端用例 · 保留已确认的业务预期</p></div><button class="button small" id="pw-recheck-backend">重新检查</button></div><p class="muted">后端批量生成处理当前协议下全部可生成用例；勾选范围用于测试运行，未就绪项暂不生成。</p>
        ${!hasBackendCases?`<p>暂无后端用例。<a data-nav href="${base}/requirements">AI 用例助手</a> 或 <a data-nav href="${base}/import">导入用例</a>。</p>`:''}
        ${!backend?`<p class="notice warning">尚未配置后端环境。<a data-nav href="${base}/auth">配置后端环境</a></p>`:''}
        <details class="pw-protocol-options${!hasBackendCases?' pw-empty-backend':''}" id="pw-protocol-options" ${!protocolId?'open':''}><summary id="pw-protocol-caption">${protocolId?'接口协议已选择 · 查看或更换':'先导入通讯协议'}</summary><p>需要明确接口地址、请求参数和响应说明。上传后自动检查每条用例。</p><label class="field pw-protocol-upload">${protocolId?'补充或更换完整协议':'选择协议文件'}<input id="pw-protocol-file" type="file" accept=".md,.docx"><small>支持 Markdown、Word。每次采用一份完整协议；更换后重新检查全部后端用例。</small></label><label class="field">选择已上传协议<select id="pw-protocol-select"><option value="">自动选择当前协议</option>${(preparation?.protocols||[]).map(p=>`<option value="${esc(p.id)}" ${p.id===protocolId?'selected':''}>${esc(p.name || '接口协议')}</option>`).join('')}</select></label><a data-nav href="${base}/bindings">按用例核对协议映射</a></details>
        <p id="pw-backend-error" role="alert">${esc(backendError)}</p><p id="pw-backend-gate" role="status"></p><div class="actions"><button class="button primary" id="pw-generate-backend" disabled>生成后端脚本</button></div>
        <div id="pw-backend-progress"></div><div id="pw-backend-preparation" role="status">${preparationHtml(preparation,{base,caseReturn:caseReturn('backend')})}</div>
      </div>
      <footer class="pw-run-bar" id="pw-generation-footer"><div><strong>返回选择运行范围</strong><small>自测通过的脚本可直接运行；失败项可查看原因并修订。</small></div><button class="button" id="pw-back-to-cases">选择用例并运行</button></footer>
    </section>
    <details class="pw-advanced"><summary>高级操作与历史</summary><div class="pw-extra-links"><a data-nav href="${base}/requirements">AI 用例助手</a><a data-nav href="${base}/import">导入用例</a><a data-nav href="${base}/bindings">人工协议映射</a><a data-nav href="${base}/cases">人工建议、示范与逐条脚本操作</a><a data-nav href="${base}?prepare=ui&legacy=1">历史前端生成流程</a><a data-nav href="${base}/generation">历史前端生成记录</a><a data-nav href="${base}/execution-list">测试结果</a></div><div id="pw-backend-batches"></div></details>`);
  if(!live())return dispose;
  const $=selector=>document.querySelector(selector);
  const backendReviewItems=()=>{
    const scope=workflowSelection(caseItems,selected,selectedType);
    return visibleWorkflowItems(caseItems,selectedType).filter(item=>{
      const {pending}=workflowBackendPlans(item,backendPlans);
      return item.case_type==='BACKEND' && item.status==='CONFIRMED' && (!scope.backend || selected.has(item.case_id)) && pending.length===1 && pending[0].state==='DRAFT' && ['BACKEND_PLAN_REVIEW_REQUIRED','SCRIPT_SELECTION_REQUIRED'].includes(runPlan.find(row=>row.case_id===item.case_id)?.reason);
    });
  };
  const renderRun=()=>{
    if(!live())return;
    $('#workspace-cases')?.setAttribute?.('href',workspaceViewHref(project.project_id,'cases',[...selected]));
    $('#pw-native-dsh')?.setAttribute?.('href',nativeHref());
    if($('#pw-native-dsh'))$('#pw-native-dsh').textContent=nativeActive()?'查看当前测试进度':'开始测试';
    const visible=visibleWorkflowItems(caseItems,selectedType),scope=workflowSelection(caseItems,selected,selectedType);
    $('#pw-selection-summary').textContent=scope.ids.length?`已选择 ${scope.ids.length} 条：前端 ${scope.ui} 条，后端 ${scope.backend} 条`:'尚未选择用例；勾选决定本次运行范围';
    $('#pw-run-selected').disabled=runBusy || !scope.ids.length;
    $('#pw-run-selected').textContent=scope.ids.length?`运行${selectedType==='ui'?'前端所选':selectedType==='backend'?'后端所选':'所选用例'} · ${scope.ids.length} 条`:'运行所选用例';
    $('#pw-run-error').textContent=nativeActive()?'':runError;
    $('#pw-recheck-run').disabled=runBusy;
    $('#pw-prepare-ui').textContent=nativeActive()?'查看前端生成进度':'DSH 生成前端脚本';
    $('#pw-prepare-backend').textContent=generationBatches.some(batch=>generationProgress(batch,'backend').active)?'查看后端生成进度':'批量生成后端脚本';
    $('#pw-prepare-ui').hidden=selectedType==='backend' || !caseItems.some(item=>item.case_type!=='BACKEND');
    $('#pw-prepare-backend').hidden=selectedType==='ui' || !backendItems.length;
    $('#pw-run-title').textContent=selectedType==='backend'?'后端测试':selectedType==='ui'?'前端测试':'选择用例并运行';
    const ready=visible.filter(item=>runState(item,runPlan.find(row=>row.case_id===item.case_id),backendPlans).ready).length;
    const next=workflowNextAction((scope.ids.length?visible.filter(item=>selected.has(item.case_id)):visible).filter(item=>!hasNative(item)),runPlan,environment,{type:selectedType,plans:backendPlans,checking:runBusy,error:runError});
    if(next)$('#pw-run-title').textContent='准备测试';
    const nativeCount=visible.filter(hasNative).length,draftCount=visible.filter(item=>nativeDraft(item)).length;
    if(scope.ids.some(id=>visible.some(item=>item.case_id===id&&hasNative(item)))){$('#pw-run-selected').disabled=true;$('#pw-selection-summary').textContent='所选范围包含 DSH 前端用例，请使用上方“运行已有脚本”核对并复跑。';}
    if(nativeCount && !ready)$('#pw-run-title').textContent=draftCount?'DSH 脚本与未执行稿件':'DSH 脚本已保存';
    if(!scope.ids.length)$('#pw-selection-summary').textContent=`${visible.length} 条用例 · ${ready} 条已就绪${visible.length-ready?` · ${visible.length-ready} 条待处理`:''}。${next?.hint || '请选择本次要运行的用例。'}`;
    if(nativeCount && !scope.ids.length)$('#pw-selection-summary').textContent=`${visible.length} 条用例 · ${nativeCount} 条已有 DSH 脚本 · ${ready} 条可由此入口运行。${draftCount?`${draftCount} 条有已登记未执行稿件，导入稿可在上方核对后复跑；未执行登记本身没有执行证据，也不计通过。`:"DSH 脚本、结果和证据见上方；可在“选择已有脚本复跑”中核对后运行。"}`;
    if(nativeActive()){
      $('#pw-run-title').textContent='前端测试正在进行';
      $('#pw-selection-summary').textContent='本项目已有前端脚本任务。点击上方“查看当前测试进度”继续；再次进入不会重新生成。运行准备将在任务结束后核对。';
      $('#pw-run-selected').disabled=true;
      if($('#pw-native-existing'))$('#pw-native-existing').disabled=true;
    }
    $('#pw-next-step').hidden=!next || ['ui','backend'].includes(next.action);$('#pw-next-step').textContent=next?.label || '';$('#pw-next-step').disabled=runBusy;
    $('#pw-next-step').onclick=()=>{
      if(!next || runBusy)return;
      if(next.action==='recheck')void refreshRun();
      else if(next.action==='choose')void launchBatch?.(project,'single',[next.caseId]);
      else if(next.action==='review')$('#pw-review-backend').click?.();
      else if(['ui','backend'].includes(next.action))$(`#pw-prepare-${next.action}`).click?.();
      else go(next.action==='environment'?`${base}/auth`:next.action==='case'?`${base}/cases/${encodeURIComponent(next.caseId)}?tab=scripts&return=${encodeURIComponent(caseReturn())}`:`${base}/${next.action}`);
    };
    $('#pw-run-selected').classList?.toggle('primary',!next);
    $('#pw-run-selected').hidden=!!next && !scope.ids.length;
    $('#pw-select-ready').hidden=!ready;

    $('#pw-environment-status').innerHTML=workflowEnvironmentState(environment,selectedType).filter(entry=>selectedType!=='all' || caseItems.some(item=>(item.case_type==='BACKEND'?'backend':'ui')===entry.kind) || !caseItems.length).map(entry=>`<span class="pw-environment-${entry.tone}"><i aria-hidden="true"></i><strong>${esc(entry.label)}</strong>${entry.url?`<small>${esc(entry.url)}</small>`:''}</span>`).join('');
    $('#pw-select-ready').disabled=runBusy || !ready;
    const reviewItems=backendReviewItems();
    $('#pw-review-backend').hidden=selectedType==='ui' || !reviewItems.length || next?.action==='review';
    $('#pw-review-backend').disabled=runBusy || bulkReviewBusy || !reviewItems.length;
    $('#pw-review-backend').textContent=`${scope.backend?'核对所选计划':'批量核对计划'}（${reviewItems.length}）`;
    $('#pw-scope-hint').textContent=selectedType==='all'?`${visible.length} 条用例，${ready} 条已就绪。运行前再次核对准备条件。`:`当前只查看${selectedType==='ui'?'前端':'后端'}用例；隐藏类型不参加本次运行。切换类型将清空选择。`;
    $('#pw-run-table').innerHTML=visible.length?`<div class="table-wrap"><table class="pw-table pw-selection-table"><thead><tr><th class="pw-check-cell">选择</th><th>测试用例</th><th>类型</th><th>状态</th><th>操作</th></tr></thead><tbody>${visible.map(item=>{
      const preview=runPlan.find(row=>row.case_id===item.case_id),originalState=runState(item,preview,backendPlans),draft=nativeDraft(item),state=draft&&!originalState.ready?{ready:false,label:draft.draft_status==='BLOCKED_PRECONDITION'?'前置阻塞 · 未执行':'稿件已登记 · 未执行',reason:draft.blocker?`DSH 报告：${draft.blocker.summary}`:draft.origin==='IMPORTED_SCRIPT'?'可查看冻结正文；使用上方原稿复跑入口核对当前环境。':'可查看冻结正文；尚未执行，无本次执行证据。'}:hasNative(item)&&!originalState.ready?{ready:false,label:'DSH 脚本已保存',reason:'可查看已有脚本、结果与证据；请在上方“选择已有脚本复跑”中核对后运行。'}:originalState,href=`${base}/cases/${encodeURIComponent(item.case_id)}?version=${encodeURIComponent(item.case_version)}&tab=scripts&return=${encodeURIComponent(caseReturn(item.case_type==='BACKEND'?'backend':selectedType))}`;
      return `<tr><td><input type="checkbox" data-pw-case="${esc(item.case_id)}" aria-label="选择 ${esc(item.external_id || item.title)}" ${selected.has(item.case_id)?'checked':''}></td><td><small>${esc(item.external_id)}</small><strong>${esc(item.title || '未命名用例')}</strong></td><td>${item.case_type==='BACKEND'?'后端':'前端'}</td><td><span class="badge ${state.ready?'success':'warning'}">${esc(state.label)}</span><small class="pw-state-reason">${esc(state.reason)}</small></td><td>${hasNative(item)&&!state.ready?`<a data-nav href="${href}">查看 DSH 脚本${draft?"与稿件":"与结果"}</a>`:state.ready?`<a data-nav href="${href}">查看脚本</a><button class="button small" type="button" data-pw-run="${esc(item.case_id)}">运行</button>`:item.status!=='CONFIRMED'?`<a data-nav href="${base}/cases/${encodeURIComponent(item.case_id)}?version=${encodeURIComponent(item.case_version)}">核对用例</a>`:preview?.reason==='SCRIPT_SELECTION_REQUIRED'?`<button class="button small" type="button" data-pw-choose="${esc(item.case_id)}">选择运行版本</button><a data-nav href="${href}">查看脚本</a>`:preview?.reason?remedyHtml(preview,project.project_id,{caseReturn:caseReturn(item.case_type==='BACKEND'?'backend':selectedType)}):`<a data-nav href="${href}">查看并处理</a>`}${item.case_type!=='BACKEND' && item.status==='CONFIRMED'?`<a class="button small" data-pw-demo data-nav href="${href}&demo=1">人工示范</a>`:''}</td></tr>`;
    }).join('')}</tbody></table></div>`:'<p class="pw-empty">暂无此类型的用例。可以导入已有用例，或通过 AI 用例助手设计。</p>';
    $('#pw-run-table').querySelectorAll?.('[data-pw-run]').forEach(button=>button.onclick=()=>{
      const item=visibleWorkflowItems(caseItems,selectedType).find(row=>row.case_id===button.dataset.pwRun);
      if(!runBusy && live() && item && runState(item,runPlan.find(row=>row.case_id===item.case_id)).ready)void launchBatch?.(project,'single',[item.case_id]);
    });
    $('#pw-run-table').querySelectorAll?.('[data-pw-case]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.pwCase):selected.delete(input.dataset.pwCase);renderRun();});
    $('#pw-run-table').querySelectorAll?.('[data-pw-choose]').forEach(button=>button.onclick=()=>{if(!runBusy && live())void launchBatch?.(project,'single',[button.dataset.pwChoose]);});
    const nativeOnly=selectedType==='ui' && visible.length && visible.every(item=>nativeRerunGroups(nativeModel()).some(group=>group.rows.some(row=>row.case_id===item.case_id && Number(row.case_version)===Number(item.case_version))));
    $('#pw-case-picker').hidden=Boolean(nativeOnly);
    if(nativeOnly){
      $('#pw-run-title').textContent='DSH 前端脚本与结果';
      $('#pw-selection-summary').textContent=`${visible.length} 条前端用例已有 DSH 脚本；结果、冻结正文与原稿复跑统一在上方 DSH 区域。`;
      $('#pw-run-selected').hidden=true;$('#pw-select-ready').hidden=true;$('#pw-prepare-ui').hidden=true;$('#pw-next-step').hidden=true;
      $('#pw-scope-hint').textContent='再次执行请使用上方“运行已有脚本（不调用模型）”；旧脚本操作保留在历史入口。';
    }
    updateUiScope();
  };
  const refreshRun=async()=>{if(runBusy || !live())return;runBusy=true;runPlan=[];backendPlans=[];renderRun();try{const [result,plans,freshEnvironment]=await Promise.all([readRun(),readPlans(),api(`${endpoint}/environment`)]);if(live()){runPlan=result.items || [];backendPlans=plans.plans || [];environment=freshEnvironment;runError='';}}catch{if(live()){runPlan=[];backendPlans=[];runError='可运行条件检查未完成，请重新检查。';}}finally{runBusy=false;renderRun();}};
  const selectType=(type,focus=false,view='run',initial=false)=>{
    if(!initial)viewTouched=true;
    if(selectedType!==type){if(view==='prepare'){const keep=new Set(visibleWorkflowItems(caseItems,type).map(item=>item.case_id));for(const id of selected)if(!keep.has(id))selected.delete(id);}else selected.clear();}selectedType=type;
    const preparing=type!=='all' && view==='prepare';
    for(const key of ['all','ui','backend']){const active=key===type,button=$(`#pw-tab-${key}`);button.setAttribute?.('aria-selected',String(active));button.tabIndex=active?0:-1;$(`#pw-panel-${key}`).hidden=key==='all'?preparing:!active||!preparing;if(active){button.setAttribute?.('aria-controls',preparing?`pw-panel-${type}`:'pw-panel-all');if(focus)button.focus?.();}}
    $('#pw-panel-all').setAttribute?.('aria-labelledby',`pw-tab-${type}`);
    $('#pw-generation-footer').hidden=!preparing;
    $('#pw-back-to-cases').textContent=`选择${type==='backend'?'后端':'前端'}用例并运行`;
    renderRun();
  };
  for(const type of ['all','ui','backend']){const button=$(`#pw-tab-${type}`);button.onclick=()=>selectType(type);button.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const types=['all','ui','backend'];selectType(event.key==='Home'?'all':event.key==='End'?'backend':types[(types.indexOf(selectedType)+(event.key==='ArrowLeft'?2:1))%3],true);}};}
  selectType(selectedType,false,initialView,true);
  $('#pw-run-selected').onclick=()=>{const scope=workflowSelection(caseItems,selected,selectedType);if(scope.ids.length && !runBusy && !scope.ids.some(id=>caseItems.some(item=>item.case_id===id&&hasNative(item))))void launchBatch?.(project,'selected',scope.ids);};
  $('#pw-select-ready').onclick=()=>{selected.clear();visibleWorkflowItems(caseItems,selectedType).filter(item=>runState(item,runPlan.find(row=>row.case_id===item.case_id)).ready).forEach(item=>selected.add(item.case_id));renderRun();};
  $('#pw-recheck-run').onclick=()=>void refreshRun();
  $('#pw-review-backend').onclick=async()=>{
    const items=backendReviewItems();if(bulkReviewBusy || runBusy || !items.length || !live())return;
    bulkReviewBusy=true;renderRun();
    try{
      const {openBackendBulkReview}=await import('./backend-bulk-review.js');
      if(!live())return;
      stopBulkReview=await openBackendBulkReview({project,items,onUpdated:refreshRun,isCurrent:live,opener:$('#pw-review-backend')});
      if(!live())stopBulkReview?.();
    }catch(error){if(live())onError(error);}finally{bulkReviewBusy=false;renderRun();}
  };
  $('#pw-prepare-ui').onclick=()=>go(nativeHref());
  $('#pw-native-existing').onclick=()=>{const target=$('.native-rerun-selection');if(target){target.open=true;target.scrollIntoView?.({block:'start',behavior:'smooth'});}};$('#pw-prepare-backend').onclick=()=>{selectType('backend',false,'prepare');backendSummary();};$('#pw-back-to-cases').onclick=()=>selectType(selectedType,false,'run');
  const openProtocol=()=>{const options=$('#pw-protocol-options');options.open=true;options.scrollIntoView?.({behavior:'smooth',block:'center'});$('#pw-protocol-file').focus?.();};
  $('#pw-backend-preparation').onclick=event=>{if(event.target.closest?.('[data-pw-protocol]'))openProtocol();};

  const authSummary=()=>{if(!live() || !ui?.auth_required)return;const browserPage=authSession?.verification_mode==='browser-page';$('#pw-login-status').textContent=authSession?.status==='VALID'?(browserPage?'页面访问已确认':'登录有效'):(browserPage?'请在专用浏览器登录，完成后点击“我已登录，检查页面”。':'请先登录被测系统，完成后自动继续。');$('#pw-login').hidden=false;$('#pw-login').textContent=authSession?.status==='VALID'?'查看登录浏览器':'打开登录浏览器';$('#pw-login-status').hidden=false;const manual=$('#pw-login-check');if(manual)manual.hidden=!browserPage || ['VALID','NOT_LOGGED_IN','BROWSER_CLOSED'].includes(authSession?.status);};
  const uiSummary=()=>{
    if(!live())return;
    const groups=splitUiReadiness(uiPlan.map(plan=>hasNative(plan)?{...plan,reason:'SCRIPT_ALREADY_EXISTS'}:plan)), detailsOpen=$('#pw-ui-readiness').querySelector?.('details')?.open;
    const selection=workflowSelection(caseItems,selected,'ui'),scope=visibleWorkflowItems(caseItems,'ui').filter(item=>!selection.ids.length || selected.has(item.case_id));
    const pending=scope.filter(item=>item.status!=='CONFIRMED'),readyItems=uiGenerationItems(project,uiPlan,selected).filter(item=>!hasNative(item));
    $('#pw-ui-blockers').innerHTML=pending.length?`<p class="notice warning">${pending.length} 条用例正文尚未确认，确认后才能生成脚本。<a data-nav href="${base}/cases?status=PENDING_CONFIRMATION&type=UI&review=all${selection.ids.length?`&selected=${encodeURIComponent(selection.ids.join(','))}`:''}&return=${encodeURIComponent(`${base}?prepare=ui${selection.ids.length?`&selected=${encodeURIComponent(selection.ids.join(','))}`:''}`)}">批量核对并确认用例</a></p>`:!uiItems.length?'<p class="notice">暂无已确认的前端用例。</p>':'';
    const itemHref=item=>`${base}/cases/${encodeURIComponent(item.case_id)}?version=${encodeURIComponent(item.case_version)}&tab=scripts`;
    const failedHistory=plan=>(plan?.failed_script_records || []).map(record=>{
      const code=record.reason || record.error;
      const reason=generationFailureReasons[code] || code || '原因未返回，请查看过程记录';
      return `<div class="pw-generation-failure"><span>失败记录：${esc(reason)}</span>${record.task_id?` <a data-nav href="${base}/build-tasks/${encodeURIComponent(record.task_id)}">查看过程</a>`:''}</div>`;
    }).join('');
    $('#pw-ui-readiness').innerHTML=`<p class="pw-readiness-summary">${uiItems.length} 条已确认用例${groups.ready.length?` · ${groups.ready.length} 条待生成`:''}${groups.existing.length?` · ${groups.existing.length} 条已有脚本`:''}${groups.failedHistory.length?` · ${groups.failedHistory.length} 条有失败历史`:''}${groups.blocked.length?` · ${groups.blocked.length} 条需处理`:''}</p>${groups.ready.length>200?'<p class="notice warning">单次最多生成 200 条，本次处理前 200 条；其余保留为待生成。</p>':''}${uiItems.length?`<details class="pw-case-picker"${detailsOpen?' open':''}><summary>查看每条用例的生成准备（${uiItems.length} 条）</summary><div class="table-wrap"><table class="pw-table"><thead><tr><th>测试用例</th><th>生成准备</th><th>操作</th></tr></thead><tbody>${uiItems.map(item=>{const plan=uiPlan.find(row=>row.case_id===item.case_id),reason=hasNative(item)?'SCRIPT_ALREADY_EXISTS':plan?.reason,label=!plan?'尚未检查':reason==='SCRIPT_ALREADY_EXISTS'?'已有脚本':!reason && plan.state!=='BLOCKED'?(plan.failed_script_records?.length?'上次失败，可重新生成':'可以生成'):/AUTH_SESSION/.test(reason||'')?'需要登录':'需要处理';return `<tr><td><small>${esc(item.external_id)}</small><strong>${esc(item.title)}</strong></td><td><span class="badge ${plan && !reason && plan.state!=='BLOCKED'?'success':'warning'}">${label}</span>${failedHistory(plan)}</td><td><a data-nav href="${itemHref(item)}">${reason==='SCRIPT_ALREADY_EXISTS'?'查看脚本':'查看用例'}</a><a class="button small" data-nav href="${itemHref(item)}&return=${encodeURIComponent(caseReturn('ui'))}&demo=1">人工示范</a></td></tr>`;}).join('')}</tbody></table></div></details>`:''}${groups.blocked.filter(item=>!ui?.auth_required || !/AUTH_SESSION/.test(item.reason)).map(item=>`<article class="pw-gap"><div><strong>${esc(item.title || uiItems.find(row=>row.case_id===item.case_id)?.title || item.external_id || '用例')}</strong><p>${esc(batchReasons[item.reason] || '脚本准备尚未完成，请查看并处理。')}</p></div>${/AUTH_SESSION/.test(item.reason)?`<button type="button" class="button" data-pw-login>登录${esc(ui?.auth_role || '')}账号</button>`:/ENVIRONMENT|TARGET/.test(item.reason)?`<a class="button" data-nav href="${base}/auth">检查环境</a>`:`<a class="button" data-nav href="${itemHref(item)}">查看并处理</a>`}</article>`).join('')}`;
    $('#pw-ui-readiness').querySelectorAll?.('[data-pw-login]').forEach(button=>button.onclick=()=>$('#pw-login')?.click?.());
    $('#pw-generate-ui').disabled=uiBusy || generationProgress(uiOperation).active || !uiId || !readyItems.length || Boolean(ui?.auth_required && authSession?.status!=='VALID');
    $('#pw-recheck-ui').disabled=uiBusy || !uiId;
    $('#pw-generate-ui').hidden=generationProgress(uiOperation).active;
    $('#pw-generate-ui').textContent=`${selection.ids.length?'生成所选就绪脚本':'批量生成前端脚本'}（${Math.min(200,readyItems.length)}）`;
    $('#pw-review-ui').hidden=!groups.existing.length || generationProgress(uiOperation).active;

  };
  const refreshUi=async()=>{if(uiBusy)return;uiBusy=true;uiSummary();try{const result=await Promise.all([checkUi(),readAuth(),api(`${endpoint}/script-operations`)]);if(live()){uiPlan=result[0];authSession=result[1]?.session || result[1];const operations=result[2].operations || [],latest=operations.find(item=>generationProgress(item).active) || operations[0] || null;if(latest && latest.operation_id!==uiOperation?.operation_id)showUiProgress(latest);uiOperation=latest;$('#pw-ui-error').textContent='';}}catch(e){uiPlan=[];authSession=null;if(live())$('#pw-ui-error').textContent=e.message;}finally{uiBusy=false;authSummary();uiSummary();void refreshRun();}};
  updateUiScope=uiSummary;
  const openUi=async()=>{
    if(uiBusy || generationProgress(uiOperation).active || !live())return;
    if(ui?.auth_required && authSession?.status!=='VALID')return;
    const items=uiGenerationItems(project,uiPlan,selected).filter(item=>!hasNative(item)).slice(0,200);
    if(items.length){uiBusy=true;uiSummary();try{await openScriptOperation({project,items,mode:'generate',go,onError,isCurrent:live,onStarted:showUiProgress});}finally{uiBusy=false;uiSummary();}}
  };
  const backendSummary=()=>{if(!live())return;const active=generationBatches.some(batch=>generationProgress(batch,'backend').active),gate=!backendBatchesKnown?'暂时无法读取生成进度，请重新检查。':active?'正在生成，进度与结果显示在下方。':!preparationValid?'准备状态需重新检查；当前显示仅供参考。':backendGenerationBlock(preparation);$('#pw-backend-gate').textContent=gate;$('#pw-backend-preparation').innerHTML=preparationHtml(preparation,{base,caseReturn:caseReturn('backend')});$('#pw-recheck-backend').disabled=backendBusy;$('#pw-protocol-select').disabled=backendBusy;$('#pw-protocol-file').disabled=backendBusy;$('#pw-generate-backend').disabled=backendBusy || !backend || Boolean(gate) || !(preparation?.items||[]).some(i=>i.status==='READY');$('#pw-generate-backend').hidden=active || !(preparation?.items||[]).some(i=>i.status==='READY');$('#pw-generate-backend').textContent=`生成后端脚本（${(preparation?.items||[]).filter(i=>i.status==='READY').length}）`;};
  const refreshBackend=async()=>{if(backendBusy)return;backendBusy=true;preparationValid=false;backendSummary();try{await loadBackend();let result;try{result=await api(`${endpoint}/backend/generation-batches`);}catch(error){backendBatchesKnown=false;throw error;}if(live()){backendBatchesKnown=true;generationBatches=result.batches || [];const latest=generationBatches.find(batch=>generationProgress(batch,'backend').active) || generationBatches[0];if(latest && latest.batch_id!==visibleBackendBatchId)showBackendProgress(latest);batchesHtml();$('#pw-backend-error').textContent='';}}catch(e){if(live())$('#pw-backend-error').textContent=e.message;}finally{backendBusy=false;backendSummary();void refreshRun();}};
  $('#pw-generate-ui').onclick=()=>void openUi();$('#pw-recheck-ui').onclick=()=>void refreshUi();
  $('#pw-login-check')?.addEventListener('click',async()=>{
    if(loginActive || !live())return;loginActive=true;$('#pw-login-check').disabled=true;
    try{
      const result=await api(`${endpoint}/auth/check`,post({environment_id:uiId,role:ui.auth_role,confirm_login:true}));if(!live())return;
      authSession=result.session || result;authSummary();
      if(authSession.status==='VALID')await refreshUi();
      else $('#pw-login-status').textContent=authSession.status==='AWAITING_LOGIN'?'仍在登录页面，请完成登录后再检查。':'页面检查未通过，请确认被测系统可以访问后重试。';
    }catch(error){if(live())$('#pw-login-status').textContent=`页面检查未完成：${error.message}`;}
    finally{loginActive=false;if(live())$('#pw-login-check').disabled=false;}
  });
  $('#pw-login')?.addEventListener('click',async()=>{
    if(loginActive || !live())return;loginActive=true;$('#pw-login').disabled=true;$('#pw-login-status').textContent='正在打开专用登录浏览器…';
    const scope={environment_id:uiId,role:ui.auth_role};let attempts=0;
    const check=async()=>{
      if(!live())return;
      try{
        const result=await api(`${endpoint}/auth/check`,post(scope));if(!live())return;
        const session=result.session || result;
        if(session.status==='VALID'){authSession=session;authSummary();$('#pw-login-status').textContent='登录已验证，正在检查待生成脚本。';loginActive=false;$('#pw-login').disabled=false;await refreshUi();return;}
        $('#pw-login-status').textContent='请在专用浏览器完成登录，工作台将检查登录状态。';
      }catch(e){if(live())$('#pw-login-status').textContent=`登录检查未完成：${e.message}`;}
      if(live() && ++attempts<60)loginTimer=setTimeout(()=>void check(),3000);
      else if(live()){loginActive=false;$('#pw-login').disabled=false;$('#pw-login-status').textContent='自动检查已结束；完成登录后可再次点击登录并准备生成。';}
    };
    try{
      const opened=await api(`${endpoint}/auth/focus`,post(scope));if(!live())return;
      authSession=opened.session || opened;
      if(authSession.status==='VALID'){loginActive=false;$('#pw-login').disabled=false;authSummary();return;}
      if(authSession?.verification_mode==='browser-page'){loginActive=false;$('#pw-login').disabled=false;authSummary();return;}
      $('#pw-login-status').textContent='请在专用浏览器完成登录，工作台将检查登录状态。';
      loginTimer=setTimeout(()=>void check(),1500);
    }catch(e){loginActive=false;if(live()){$('#pw-login').disabled=false;$('#pw-login-status').textContent=`登录检查未完成：${e.message}；可点击重新检查登录。`;}}
  });
  $('#pw-recheck-backend').onclick=()=>void refreshBackend();
  $('#pw-protocol-select').onchange=()=>{protocolId=$('#pw-protocol-select').value;void refreshBackend();};
  $('#pw-protocol-file').onchange=async()=>{
    const file=$('#pw-protocol-file').files?.[0];if(!file || backendBusy)return;
    backendBusy=true;preparationValid=false;backendSummary();
    try{const result=await requirementsApi.upload(project.project_id,{kind:'PROTOCOL',fileName:file.name,body:file});if(!live())return;protocolId=sourceId(result.source || result.snapshot || result);await loadBackend();if(live()){$('#pw-backend-error').textContent='';$('#pw-protocol-options').open=false;$('#pw-protocol-caption').textContent='接口协议已选择 · 查看或更换';$('#pw-protocol-select').innerHTML=(preparation?.protocols||[]).map(p=>`<option value="${esc(p.id)}" ${p.id===protocolId?'selected':''}>${esc(p.name)}</option>`).join('');}}
    catch(e){if(live())$('#pw-backend-error').textContent=e.message;}
    finally{backendBusy=false;if(live()){$('#pw-protocol-file').value='';backendSummary();}}
  };
  const batchesHtml=()=>{if(live())$('#pw-backend-batches').innerHTML=generationBatches.length?`<details><summary>后端生成历史（${generationBatches.length} 批）</summary>${generationBatches.map(batch=>`<details><summary>${esc(batch.created_at || '')} · ${esc(generationProgress(batch,'backend').title)} · ${(batch.items||[]).length} 条</summary>${(batch.items||[]).map(item=>`<p>${esc(item.external_id || item.title || '用例')} · ${esc(stateLabel(item.state))}${item.case_id?` · <a data-nav href="${base}/cases/${encodeURIComponent(item.case_id)}?version=${encodeURIComponent(item.case_version)}&tab=scripts${item.plan_id?`&plan_id=${encodeURIComponent(item.plan_id)}`:''}">查看脚本与结果</a>`:''}</p>`).join('')}</details>`).join('')}</details>`:'<p class="muted">暂无后端生成记录。</p>';};
  const showUiProgress=record=>{
    if(!live())return;stopUiProgress?.();uiOperation=record;uiSummary();
    stopUiProgress=mountGenerationProgress({container:$('#pw-ui-progress'),projectId:project.project_id,record,compact:true,isCurrent:live,onSettled:value=>{if(live()){uiOperation=value;void refreshUi();}}});
  };
  const showBackendProgress=record=>{
    if(!live())return;stopBackendProgress?.();visibleBackendBatchId=record.batch_id;backendBatchesKnown=true;
    generationBatches=[record,...generationBatches.filter(item=>item.batch_id!==record.batch_id)];backendSummary();batchesHtml();
    stopBackendProgress=mountGenerationProgress({container:$('#pw-backend-progress'),projectId:project.project_id,kind:'backend',record,compact:true,isCurrent:live,onSettled:value=>{if(live()){generationBatches=generationBatches.map(item=>item.batch_id===value.batch_id?value:item);batchesHtml();void refreshBackend();}}});
  };
  $('#pw-generate-backend').onclick=()=>{
    if(backendBusy || !backendBatchesKnown || generationBatches.some(batch=>generationProgress(batch,'backend').active) || !preparationValid || backendGenerationBlock(preparation) || !backend || !live())return;
    const frozen=preparation,ready=frozen.items.filter(i=>i.status==='READY').length,skip=frozen.items.length-ready;
    let requestId=`backend-${crypto.randomUUID()}`,requestScope='';const root=$('#modal-root');
    root.innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="生成后端脚本"><header><h2>生成后端脚本</h2></header><div class="modal-body"><p>本次生成 ${ready} 条${skip?`，${skip} 条暂不生成`:''}。</p><p>将使用项目已选协议编写脚本，并在配置的测试环境中自动验证。</p>${backend?.reviewer?`<input type="hidden" id="pw-reviewer" value="${esc(backend.reviewer)}">`:'<label class="field">测试人员<input id="pw-reviewer" placeholder="填写姓名或标识，供结果追溯"></label>'}<p role="alert" id="pw-batch-error"></p></div><footer><button class="button" id="pw-batch-close">取消</button><button class="button primary" id="pw-batch-submit" ${backend?.reviewer?'':'disabled'}>开始生成 ${ready} 条</button></footer></section></div>`;
    const dialog=root.firstElementChild,d=selector=>dialog.querySelector(selector);backendDialog=dialog;let sending=false;
    const close=()=>{if(!sending)dialog.remove();};d('#pw-batch-close').onclick=close;
    const valid=()=>Boolean(d('#pw-reviewer').value.trim());
    dialog.querySelectorAll('input').forEach(input=>input.oninput=()=>{d('#pw-batch-submit').disabled=sending || !valid();});
    d('#pw-batch-submit').onclick=async()=>{
      if(sending || !valid() || !live())return;
      if(!preparationValid || frozen!==preparation || backendGenerationBlock(preparation)){d('#pw-batch-error').textContent='准备条件已变化，请关闭后重新检查。';d('#pw-batch-submit').disabled=true;return;}
      const scope=JSON.stringify({preparation:frozen.preparation_sha256,protocol:frozen.protocol_source_id,reviewer:d('#pw-reviewer').value.trim()});
      if(requestScope && requestScope!==scope)requestId=`backend-${crypto.randomUUID()}`;requestScope=scope;
      const input=backendBatchInput(frozen,{requestId,reviewer:d('#pw-reviewer').value,analysisConfirmed:true,modelConfirmed:true,httpConfirmed:true});
      sending=true;dialog.querySelectorAll('input,button').forEach(el=>el.disabled=true);
      try{const batch=await api(`${endpoint}/backend/generation-batches`,post(input));sending=false;close();if(live()){showBackendProgress(batch);void refreshBackend();}}
      catch(e){if(dialog.isConnected)d('#pw-batch-error').textContent=e.message;}
      finally{sending=false;if(dialog.isConnected){dialog.querySelectorAll('input,button').forEach(el=>el.disabled=false);d('#pw-batch-submit').disabled=!valid();}}
    };
  };
  authSummary();uiSummary();backendSummary();batchesHtml();
  // Render the workspace before independent, bounded readiness checks settle.
  // A result is never usable until its own group has finished successfully.
  const signal=initialSignal;
  const loadInitialUi=async()=>{
    const results=await Promise.allSettled([checkUi(signal),readAuth(signal),api(`${endpoint}/script-operations`,{signal})]);
    if(!live())return;
    uiBusy=false;readinessError='';
    if(results[0].status==='fulfilled')uiPlan=results[0].value;
    else readinessError='前端脚本准备检查未完成，请重新检查。';
    if(results[1].status==='fulfilled')authSession=results[1].value?.session || results[1].value;
    else readinessError='登录状态读取未完成，请重新检查。';
    if(results[2].status==='fulfilled'){
      const operations=results[2].value.operations || [];
      uiOperation=operations.find(item=>generationProgress(item).active) || operations[0] || null;
    }else{uiPlan=[];readinessError='暂时无法恢复生成进度，请点击重新检查。';}
    $('#pw-ui-error').textContent=readinessError;authSummary();uiSummary();renderRun();
    if(uiOperation){showUiProgress(uiOperation);if(generationProgress(uiOperation).active && !requestedType && !requestedPrepare && !viewTouched)selectType('ui',false,'prepare',true);}
  };
  const loadInitialBackend=async()=>{
    const results=await Promise.allSettled([readBackend(signal),api(`${endpoint}/backend/generation-batches`,{signal})]);
    if(!live())return;
    backendBusy=false;backendError='';
    if(results[0].status==='fulfilled'){preparation=results[0].value;preparationValid=true;protocolId=preparation.protocol_source_id || '';}
    else backendError='后端脚本准备检查未完成，请重新检查。';
    if(results[1].status==='fulfilled'){generationBatches=results[1].value.batches || [];backendBatchesKnown=true;}
    else backendError='暂时无法恢复后端生成进度，请重新检查。';
    $('#pw-backend-error').textContent=backendError;backendSummary();batchesHtml();renderRun();
    const latest=generationBatches.find(batch=>generationProgress(batch,'backend').active) || generationBatches[0];
    if(latest){showBackendProgress(latest);if(generationProgress(latest,'backend').active && !generationProgress(uiOperation).active && !requestedType && !requestedPrepare && !viewTouched)selectType('backend',false,'prepare',true);}
  };
  const loadInitialRun=async()=>{
    const results=await Promise.allSettled([readRun(signal),readPlans(signal)]);
    if(!live())return;
    runBusy=false;runError='';
    if(results[0].status==='fulfilled')runPlan=results[0].value.items || [];
    else runError='可运行条件检查未完成，请重新检查。';
    if(results[1].status==='fulfilled')backendPlans=results[1].value.plans || [];
    else{runPlan=[];runError='后端计划状态读取失败，请重新检查。';}
    renderRun();
  };
  const loadInitialNative=async()=>{
    nativeData=await loadNativeConsole(project,api,{signal});
    if(!live())return;
    const model=nativeModel(),host=$('#pw-native-console');
    host.innerHTML=nativeRecordsHtml(project,model,{compact:true})+nativeScriptsHtml(project,model);$('#pw-native-existing').disabled=!nativeRerunGroups(model).length;bindNativeConsole(host);renderRun();
  };
  await Promise.all([loadInitialUi(),loadInitialBackend(),loadInitialRun(),loadInitialNative()]);
  if(live())$('.pw-workspace').hidden=!caseItems.length && !generationProgress(uiOperation).active && !generationBatches.some(batch=>generationProgress(batch,'backend').active);
  return dispose;
}
