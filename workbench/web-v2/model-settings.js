import {api} from './api.js';
import {restartAndWait} from './service-restart.js';
export async function renderModelSettings({showPage,isCurrent}) {
  const state=await api('/api/model-settings');if(!isCurrent())return;
  const supported=state.activation_available;
  showPage(`<div class="page-heading"><div><h1>模型设置</h1><p>为当前 Windows 用户配置 DeepSeek API Key。</p></div></div><section class="panel"><div class="panel-body"><h2>DeepSeek</h2><p id="model-key-state">${state.enabled?'模型已启用。':state.configured?'密钥已保存，模型尚未启用。':'尚未配置模型。'}</p><form id="model-key-form" autocomplete="off"><label class="field">API Key<input id="model-key" type="password" autocomplete="new-password" maxlength="4096" required spellcheck="false"></label><label id="model-key-replace-label" ${state.configured?'':'hidden'}><input id="model-key-replace" type="checkbox" ${state.configured?'required':''}>替换当前已保存的密钥</label><p>密钥加密保存在本机，不会回显。${supported?'保存并启用会安全重启工作台；仅在你发起生成任务时调用模型并产生费用。':'保存后重新启动工作台以加载密钥。此启动方式暂不支持网页切换模型模式。'}</p><p id="model-key-message" role="status" aria-live="polite"></p><button class="button primary" type="submit">${supported?'保存并启用模型':'保存密钥'}</button><button id="model-key-activate" class="button" type="button" ${state.configured&&supported?'':'hidden'}>${state.enabled?'重新加载已保存密钥':'启用已保存密钥'}</button></form></div></section>`);
  const form=document.querySelector('#model-key-form'),input=document.querySelector('#model-key'),message=document.querySelector('#model-key-message'),button=form.querySelector('button'),activate=document.querySelector('#model-key-activate'),replace=document.querySelector('#model-key-replace');
  let disposed=false,working=false;
  const current=()=>!disposed&&isCurrent();
  const lock=value=>{working=value;button.disabled=value;activate.disabled=value;input.disabled=value;replace.disabled=value;};
  const enable=async()=>{
    if(current())message.textContent='密钥已保存，正在重启并启用模型…';
    const health=await api('/api/health');
    await restartAndWait({previous:health.service_identity,modelActivation:true,requestTimeoutMs:5000,
      postRestart:(id,signal)=>api('/api/model-settings/activate',{method:'POST',signal,headers:{'content-type':'application/json'},body:JSON.stringify({service_instance_id:id})}),
      getHealth:signal=>api('/api/health',{signal})});
    if(current()){document.querySelector('#model-key-state').textContent='模型已启用。';message.textContent='模型已启用，可以生成脚本和使用 AI 用例助手。';activate.textContent='重新加载已保存密钥';}
  };
  const failure=error=>{if(current())message.textContent=({MODEL_KEY_EXISTS:'已有密钥，请确认替换后重试。',MODEL_SETTINGS_BUSY:'有任务正在运行，请稍后重试。',WORKBENCH_BUSY:'密钥已保存。有任务正在运行，结束后点击启用。',MODEL_KEY_INVALID:'密钥不能为空，也不能包含换行。',MODEL_ACTIVATION_UNAVAILABLE:'密钥已保存，当前启动方式不支持网页启用。',SERVICE_RESTART_UNCONFIRMED:'密钥已保存，但尚未确认模型启用成功。请查看启动日志后重试。'})[error.code||error.message]||'操作未完成，请检查服务状态后重试。';};
  form.onsubmit=async event=>{event.preventDefault();if(!current()||working)return;lock(true);message.textContent='正在保存…';
    try{await api('/api/model-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:input.value,replace:replace.checked})});input.value='';
      if(current()){document.querySelector('#model-key-replace-label').hidden=false;replace.required=true;replace.checked=false;activate.hidden=!supported;message.textContent='密钥已加密保存，重新启动工作台后生效。';}
      if(supported)await enable();
    }catch(error){input.value='';failure(error);}finally{if(current())lock(false);}
  };
  activate.onclick=async()=>{if(!current()||working)return;lock(true);try{await enable();}catch(error){failure(error);}finally{if(current())lock(false);}};
  return ()=>{disposed=true;input.value='';form.onsubmit=null;activate.onclick=null;};
}
