import { api } from './api.js';
import { esc, batchReasons, stateLabel } from './workflow.js';
const post = body => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const environmentName=e=>e.preparation==='AUTO_START_ISOLATED_TARGET'?'本机被测应用 · 自动准备':e.name||e.id;
const labels={generate:'生成自动化脚本',revise:'基于问题修订脚本',regenerate:'重新生成自动化脚本'};
const reasons={GENERATION_TARGET_UNREACHABLE:'被测系统地址无法访问，请在环境与登录中核对目标地址',GENERATION_MODEL_CONFIRMATION_REQUIRED:'请确认本次模型使用和资源上限',GENERATION_NOT_AUTHORIZED:'当前服务尚未开放用户发起生成，且没有本次可用授权',GENERATION_ENVIRONMENT_NOT_READY:'尚未登记可供建例的环境',MODEL_GENERATION_DISABLED_IN_TRIAL_PROFILE:'当前配置禁止模型调用',REVISION_SCRIPT_AND_FEEDBACK_REQUIRED:'需明确选定旧脚本并填写问题反馈',SCRIPT_ALREADY_EXISTS:'已有脚本，请选择修订或从头重新生成',CASE_CONTENT_NOT_CONFIRMED:'用例正文尚未确认',GENERATION_AUTHORIZATION_AMBIGUOUS:'存在多条授权，请先核对授权范围'};
Object.assign(reasons, {
  AUTH_SESSION_REQUIRED:'请到“环境与登录”完成对应角色登录并检查有效，再重新检查准备条件',
  AUTH_SESSION_NOT_VALID:'登录会话已失效或变化，请重新登录并检查有效',
  AUTH_SESSION_BLOCKED:'登录会话失效，运行已停止；重新登录后可显式复跑',
  DEVELOPMENT_AUTH_ENVIRONMENT_INVALID:'被测地址与登记的登录环境不匹配，请核对环境配置',
  DEVELOPMENT_ENVIRONMENT_NOT_LOCAL:'该目标尚未按受控登录环境登记',
});
export async function openScriptOperation({project,items,mode,go,onError}){
  const root=document.querySelector('#modal-root');
  try{
    const envs=await api('/api/script-environments');
    const rows=await Promise.all(items.map(async item=>({...item,automation:await api(`/api/case-library/projects/${project.project_id}/cases/${item.case_id}/automation?version=${item.case_version}`)})));
    let sending=false,closed=false,plan=null,sequence=0,timer;const requestId='script-'+crypto.randomUUID();
    root.innerHTML=`<div class="modal-backdrop"><section class="modal script-dialog" role="dialog" aria-modal="true" aria-label="${labels[mode]}"><header><h2>${labels[mode]}</h2><button class="icon-button" id="script-close" aria-label="关闭">×</button></header><div class="modal-body"><p>此操作调用 Coding Agent，与“重新运行已有脚本”不同。</p><div class="notice">项目：${esc(project.name)} · 已选 ${items.length} 条，跨页选择按完整清单处理。不会修改原动作与预期。</div><div class="table-wrap"><table><thead><tr><th>用例</th><th>内容版本</th><th>旧脚本（始终保留）</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r.external_id||r.case_id)}</td><td>v${r.case_version}</td><td>${mode==='revise'?`<select data-revision-source="${i}" aria-label="${esc(r.external_id)} 修订来源"><option value="">请选择完整脚本包</option>${r.automation.candidates.filter(c=>c.applies_to_selected_version).map((c,j)=>`<option value="${j}">${c.script_version?'S'+c.script_version:'历史候选 v'+c.selection.candidate_version} · ${esc(c.created_at?new Date(c.created_at).toLocaleString():'历史时间未登记')}</option>`).join('')}</select>`:r.automation.candidates.filter(c=>c.applies_to_selected_version).map(c=>esc(c.script_version?'S'+c.script_version:'历史候选 v'+c.selection.candidate_version)).join('、')||'未生成'}</td></tr>`).join('')}</tbody></table></div><p><strong>${mode==='revise'?'带入选定旧文件包、原要求与问题反馈，由 Agent 自主观察、自测并修订。':'从当前确认用例与环境重新观察、编写、自测和修复；不把旧候选作为起稿输入。'}</strong></p>${mode==='revise'?'<label class="field">问题反馈<textarea id="script-feedback" rows="4" maxlength="6000" placeholder="说明需要修订的问题；原动作与预期保持不变"></textarea></label>':''}<label class="field">被测环境<select id="script-environment"><option value="">请选择环境</option>${envs.environments.map(e=>`<option value="${esc(e.id)}">${esc(environmentName(e))}</option>`).join('')}</select></label><p class="muted">环境指被测系统的地址、版本和登录条件。每次执行都会独立启动后台测试浏览器，不复用你正在操作的浏览器。</p><p id="script-environment-info"></p><div id="script-plan" role="status"></div><label class="notice" id="script-model-consent" hidden><input type="checkbox" id="script-model-confirm">确认本次调用模型，按上方范围及每条资源上限串行执行；失败也可能消耗模型费用。</label><p class="notice">生成失败、取消或超时均保留旧脚本、历史结果与媒体；新候选不自动批准、不替换正在执行的批次。</p><p role="alert" id="script-error"></p></div><footer><button class="button" id="script-cancel">取消</button><button class="button" id="script-check">检查准备条件</button><button class="button primary" id="script-confirm" disabled>${mode==='regenerate'?'确认重新生成':mode==='revise'?'确认修订':'确认生成'}</button></footer></section></div>`;
    const dialog=root.firstElementChild,$=selector=>dialog.querySelector(selector);
    const payload=()=>({mode,request_id:requestId,environment_id:document.querySelector('#script-environment').value,items:rows.map((r,i)=>{
      const input={case_id:r.case_id,case_version:r.case_version};
      if(mode==='revise'){
        const selected=document.querySelector(`[data-revision-source="${i}"]`).value;
        const candidate=selected===''?null:r.automation.candidates.filter(c=>c.applies_to_selected_version)[Number(selected)];
        if(candidate)Object.assign(input,{source_task_id:candidate.selection.source_task_id,candidate_version:candidate.selection.candidate_version,bundle_sha256:candidate.selection.bundle_sha256});
        input.feedback=document.querySelector('#script-feedback').value;if(r.run_id&&candidate)input.run_id=r.run_id;
      }return input;
    })});
    const updateConfirm=()=>{$('#script-confirm').disabled=sending||!plan||plan.items.some(i=>i.reason)||(plan.items.some(i=>i.requires_model_confirmation)&&!$('#script-model-confirm').checked);};
    const check=async token=>{
      try{
        const result=await api(`/api/case-library/projects/${project.project_id}/script-operations/preflight`,post(payload()));
        if(closed||!dialog.isConnected||token!==sequence)return;
        plan=result;
        $('#script-plan').innerHTML=`<p>请求 ${plan.items.length} 条 · 可开始 ${plan.items.filter(i=>!i.reason).length} · 待处理 ${plan.items.filter(i=>i.reason).length}</p><ul>${plan.items.map(i=>`<li>${esc(i.external_id)} v${i.case_version}：${esc((!$('#script-environment').value?'请选择被测系统':reasons[i.reason]||batchReasons[i.reason]||i.reason||'准备就绪'))}<br>${i.limits?`每条资源上限：${i.limits.wall_ms/60000} 分钟 / 开发会话 ${i.limits.harness_starts} 次 / 自测 ${i.limits.self_tests} 次 / 工具 ${i.limits.tool_calls} 次`:'暂无本次生成额度'}</li>`).join('')}</ul>`;
        $('#script-model-consent').hidden=!plan.items.some(i=>i.requires_model_confirmation);
      }catch(e){if(!closed&&dialog.isConnected&&token===sequence){$('#script-error').textContent=reasons[e.message]||e.message;$('#script-plan').textContent='准备检查未完成，修正条件后可重试。';}}
      finally{if(!closed&&dialog.isConnected&&token===sequence){$('#script-check').disabled=false;updateConfirm();}}
    };
    const schedule=(delay=0)=>{
      if(sending||closed)return;clearTimeout(timer);const token=++sequence;plan=null;
      $('#script-model-confirm').checked=false;$('#script-model-consent').hidden=true;updateConfirm();
      $('#script-error').textContent='';$('#script-plan').textContent='正在检查准备条件…';$('#script-check').disabled=true;
      const env=envs.environments.find(e=>e.id===$('#script-environment').value);
      $('#script-environment-info').textContent=env?`${environmentName(env)}：${env.entry||reasons[env.reason]||env.reason||'等待检查'}；${env.browser||'每次独立启动测试浏览器'}。`:'请选择已登记的被测环境。';
      timer=setTimeout(()=>void check(token),delay);
    };
    dialog.querySelectorAll('select,textarea').forEach(el=>el.addEventListener('input',()=>schedule(200)));
    $('#script-model-confirm').addEventListener('change',updateConfirm);
    if(envs.environments.length===1)$('#script-environment').value=envs.environments[0].id;
    const close=()=>{if(sending||closed)return;closed=true;sequence++;clearTimeout(timer);document.removeEventListener('keydown',onKey);window.removeEventListener('hashchange',close);dialog.remove();};
    const onKey=e=>{if(e.key==='Escape')close();};
    document.addEventListener('keydown',onKey);window.addEventListener('hashchange',close);
    dialog.querySelectorAll('#script-close,#script-cancel').forEach(el=>el.onclick=close);
    $('#script-check').onclick=()=>schedule();
    $('#script-confirm').onclick=async()=>{
      if(sending||$('#script-confirm').disabled)return;
      const input={...payload(),confirm_model_use:$('#script-model-confirm').checked};
      sending=true;const controls=[...dialog.querySelectorAll('button,input,select,textarea')];
      const disabled=controls.map(el=>el.disabled);controls.forEach(el=>{el.disabled=true;});
      try{
        const v=await api(`/api/case-library/projects/${project.project_id}/script-operations`,post(input));
        sending=false;close();go(`#/projects/${project.project_id}/generation/${v.operation_id}`,true);
      }catch(error){
        $('#script-error').textContent=error.message==='BUILD_TASK_ALREADY_ACTIVE'?'工作台正在执行其他任务，本次未启动。任务结束后可直接重试。':reasons[error.message]||error.message;
      }finally{
        sending=false;controls.forEach((el,i)=>{if(el.isConnected)el.disabled=disabled[i];});if(!closed)updateConfirm();
      }
    };
    schedule();
  }catch(e){onError(e);}
}
export async function renderGeneration({project,id,showPage,go}){
  if(!id){const {operations}=await api(`/api/case-library/projects/${project.project_id}/script-operations`);showPage(`<div class="page-heading"><h1>脚本生成记录</h1><a data-nav href="#/projects/${project.project_id}/cases">返回用例库</a></div><section class="panel"><div class="panel-body">${operations.map(v=>`<p><a data-nav href="#/projects/${project.project_id}/generation/${v.operation_id}">${esc(v.created_at)} · ${labels[v.mode]} · ${v.items.length} 条 · ${esc(stateLabel(v.state))}</a></p>`).join('')||'<p>尚未明确发起生成；准备检查与取消确认不会创建模型任务。</p>'}</div></section>`);return;}
  const base=`/api/case-library/projects/${project.project_id}/script-operations/${encodeURIComponent(id)}`,v=await api(base);
  showPage(`<div class="page-heading"><div><h1>${labels[v.mode]} · ${esc(v.state)}</h1><p>每条独立冻结，按顺序开发；新候选保留原要求，尚需独立核对。</p></div>${['QUEUED','RUNNING'].includes(v.state)?'<button class="button" id="stop-generation">取消后续生成</button>':''}</div><section class="panel"><div class="panel-body">${v.items.map(i=>`<article class="preview-item"><h2>${esc(i.external_id)} · v${i.case_version}</h2><p>${esc(i.state)} ${esc(reasons[i.reason]||i.reason||'')}</p><a data-nav href="#/projects/${project.project_id}/cases/${i.case_id}?version=${i.case_version}&tab=scripts">返回用例</a>${i.task_id?` · <a data-nav href="#/projects/${project.project_id}/build-tasks/${i.task_id}">查看实际开发过程与证据</a>`:''}</article>`).join('')}</div></section>`);
  document.querySelector('#stop-generation')?.addEventListener('click',async e=>{e.target.disabled=true;await api(base+'/stop',post({}));});
  if(['QUEUED','RUNNING'].includes(v.state)){const hash=location.hash;setTimeout(()=>{if(location.hash===hash)void renderGeneration({project,id,showPage,go});},2000);}
}
