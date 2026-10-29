import {esc} from './workflow.js';

export function executionNotesHtml() {
  return '<section class="execution-notes panel" aria-label="记录问题"><div class="panel-body"><h3>记录问题，稍后排查</h3><p class="muted">可以先记下观察到的现象，无需现在判断是产品还是脚本问题。记录会关联这次运行的证据。</p><div data-run-notes-list aria-live="polite"></div><form data-run-notes-form><label class="field"><span>问题现象</span><textarea name="observation" rows="3" maxlength="4000" required placeholder="例如：点击保存后，页面仍没有出现新增记录。原因待排查。"></textarea></label><div class="actions"><button class="button" type="submit">保存问题记录</button><span data-run-notes-status role="status"></span></div></form></div></section>';
}

export async function mountExecutionNotes({root,projectId,runId,api,jsonOptions}) {
  if(!root || !runId)return;
  const endpoint=`/api/case-library/projects/${encodeURIComponent(projectId)}/execution-records/${encodeURIComponent(runId)}/notes`;
  const form=root.querySelector('[data-run-notes-form]'),list=root.querySelector('[data-run-notes-list]'),status=root.querySelector('[data-run-notes-status]');
  let notes=[],pending=false,requestId=null,submittedText='';
  const live=()=>root.isConnected;
  const draw=()=>{if(live())list.innerHTML=notes.map(note=>`<article class="run-observation"><span class="badge warning">待排查</span><small>${esc(note.created_at)}</small><p class="preserve-text">${esc(note.text)}</p></article>`).join('');};
  try{const result=await api(endpoint);if(!live())return;notes=result.notes||[];draw();}catch(error){if(live())status.textContent='历史问题暂未读取，请稍后刷新。';}
  if(!live())return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!live())return;
    const input=form.elements.namedItem('observation'),text=input.value.trim();if(!text)return input.focus();
    if(text!==submittedText){requestId=crypto.randomUUID();submittedText=text;}
    pending=true;const button=form.querySelector('button');button.disabled=true;input.disabled=true;status.textContent='正在保存…';
    try{const note=await api(endpoint,jsonOptions({request_id:requestId,text}));if(!live())return;
      if(!notes.some(item=>item.note_id===note.note_id))notes.push(note);draw();input.value='';submittedText='';requestId=null;status.textContent='已保存，状态：待排查。原运行结果保持不变。';
    }catch(error){if(live())status.textContent=`保存未确认：${error.message}。内容已保留，可以重试。`;}
    finally{pending=false;if(live()){button.disabled=false;input.disabled=false;}}
  });
}
