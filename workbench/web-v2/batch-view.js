import {esc, stateLabel, batchReasons, remedyHtml} from './workflow.js';
import {loadNativeConsole,nativeConsoleModel,nativeRecordsHtml,nativeTasksHtml,bindNativeConsole} from './native-console-view.js';

export function batchItemOutcome(item) {
  if(item.state==='RUNNING')return 'running';
  if(['CANCELLED','INTERRUPTED'].includes(item.state))return 'interrupted';
  if(item.state==='BLOCKED')return 'blocked';
  if(['NOT_RUN','QUEUED'].includes(item.state))return 'notStarted';
  if(item.state==='FINISHED' && item.result==='PASSED')return 'passed';
  if(item.state==='FINISHED' && ['FAILED','TIMEDOUT'].includes(item.result))return 'failed';
  return 'unknown';
}
export function batchSummary(batch) {
  const counts={total:batch.items.length,passed:0,failed:0,interrupted:0,blocked:0,notStarted:0,running:0,unknown:0};
  for(const item of batch.items)counts[batchItemOutcome(item)]++;
  counts.processed=counts.total-counts.notStarted-counts.running;
  return counts;
}
export function batchRemainingItems(batch) {
  return batch.items.filter(item=>['interrupted','notStarted'].includes(batchItemOutcome(item)));
}
const active=batch=>['QUEUED','RUNNING','STOPPING'].includes(batch.state);
const labels={passed:'运行通过',failed:'失败',interrupted:'已中止',blocked:'未执行 · 需处理',notStarted:'未开始',running:'执行中',unknown:'结果待核对'};
const formatDate=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'未记录';
const resultHref=(base,item,batch)=>`${base}/cases/${encodeURIComponent(item.case_id)}?version=${item.case_version}&tab=results&batch_id=${encodeURIComponent(batch.batch_id)}${item.run_id?'&run_id='+encodeURIComponent(item.run_id):''}`;

export function batchDetailHtml(batch, project, filter='all') {
  const base=`#/projects/${encodeURIComponent(project.project_id)}`,counts=batchSummary(batch),running=active(batch),remaining=batchRemainingItems(batch);
  const title=batch.state==='STOPPING'?'正在停止测试':running?'测试进行中':batch.state==='CANCELLED'?'本次测试已停止':batch.state==='INTERRUPTED'?'本次测试已中断':'本次测试已结束';
  const metric=(key,label)=>`<div class="${key}"><strong>${counts[key]}</strong><span>${label}</span></div>`;
  const omitted=project.cases.filter(item=>!batch.items.some(row=>row.case_id===item.case_id)).length;
  const rows=batch.items.filter(item=>filter==='all'||batchItemOutcome(item)===filter);
  return `<div class="page-heading"><div><h1>${title}</h1><p>${esc(formatDate(batch.created_at))} · 测试版本 ${esc(batch.software_version||'未填写')}</p></div><a class="button" data-nav href="${base}">返回工作台</a></div>
    ${running?`<section class="batch-progress" aria-live="polite"><h2>${batch.state==='STOPPING'?'正在等待当前用例停止，已完成结果会保留':`已处理 ${counts.processed} / ${counts.total} 条`}</h2><progress value="${counts.processed}" max="${counts.total||1}" aria-label="本次运行进度"></progress><p>${batch.state==='STOPPING'?'停止请求已提交，不再启动后续用例；当前用例结果以实际返回为准。':'离开后可从测试记录返回查看，不会重新启动。'}</p></section>`:''}
    <p class="batch-selected-note">本次范围 ${counts.total} 条${omitted?` · 项目另外 ${omitted} 条未选入本次`:''}。以下统计仅包含本次用例，表示脚本运行结果。</p>
    <section class="batch-run-summary" aria-label="本次运行统计">${metric('passed','运行通过')}${metric('failed','失败')}${counts.interrupted?metric('interrupted','已中止'):''}${metric('notStarted',running?'等待开始':'未开始')}${counts.running?metric('running','执行中'):''}${counts.blocked?metric('blocked','未执行 · 需处理'):''}${counts.unknown?metric('unknown','结果待核对'):''}</section>
    <section class="panel"><div class="panel-header"><h2>本次用例</h2><label><span class="sr-only">筛选本次结果</span><select id="batch-state-filter">${[['all','全部结果'],['passed','运行通过'],['failed','失败'],['interrupted','已中止'],['notStarted','未开始'],['blocked','需处理']].map(([value,label])=>`<option value="${value}" ${value===filter?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="batch-run-table"><table><thead><tr><th>测试用例</th><th>类型</th><th>本次状态</th><th>说明</th><th>操作</th></tr></thead><tbody>${rows.map(item=>{const outcome=batchItemOutcome(item),link=resultHref(base,item,batch);return `<tr><td><strong>${esc(item.title||item.external_id)}</strong><small>${esc(item.external_id)} · 用例 v${item.case_version}</small></td><td>${item.selection?.kind==='HTTP_JSON'||project.cases.find(c=>c.case_id===item.case_id)?.versions?.find(v=>v.version===item.case_version)?.content?.case_type==='BACKEND'?'后端':'前端'}</td><td><span class="badge ${outcome==='passed'?'success':outcome==='failed'?'danger':'warning'}">${labels[outcome]}</span>${outcome==='passed' && item.qualification==='LIMITED_TECHNICAL_TRIAL_NOT_APPROVED' ? '<small>脚本要求待核对</small>' : ''}</td><td>${esc(item.reason==='BATCH_CANCELLED'?'本次停止后未开始':batchReasons[item.reason]||item.reason||'—')}</td><td><div class="batch-case-actions">${item.run_id?`<a data-nav href="${link}">${outcome==='failed'?'查看失败原因':'查看结果'}</a>`:remedyHtml(item,project.project_id)||'—'}</div></td></tr>`;}).join('')||'<tr><td colspan="5">当前筛选没有用例</td></tr>'}</tbody></table></div><div class="panel-body actions">${running?`<button class="button" id="cancel-batch" ${batch.state==='STOPPING'?'disabled':''}>${batch.state==='STOPPING'?'正在停止…':'停止测试'}</button>`:`${counts.failed?'<button class="button" id="rerun-failed">选择本次失败用例复跑</button>':''}${remaining.length?`<button class="button primary" id="rerun-remaining">选择本次未完成的 ${remaining.length} 条</button>`:''}<a class="button" data-nav href="${base}/reports?batch_id=${encodeURIComponent(batch.batch_id)}">导出本次报告</a>`}<a data-nav href="${base}/batches">全部测试记录</a></div></section>
    <p class="batch-selected-note">每次复跑会创建新的测试记录；本次结果与原用例内容保持保留。</p><p id="batch-action-error" role="alert"></p><details class="batch-technical"><summary>高级：脚本版本与运行详情</summary><pre>${esc(JSON.stringify(batch,null,2))}</pre></details>`;
}

export async function renderBatchPage({project,query,showPage,api,mutate,jsonOptions,launchBatch,isCurrent=()=>true}) {
  const base=`#/projects/${encodeURIComponent(project.project_id)}`,endpoint=`/api/case-library/projects/${encodeURIComponent(project.project_id)}/batches`,id=query.get('batch_id');
  let disposed=false,timer,filter='all',stopPending=false,refreshSequence=0;
  const live=()=>!disposed&&isCurrent();
  const dispose=()=>{disposed=true;clearTimeout(timer);window.removeEventListener('hashchange',dispose);};
  window.addEventListener('hashchange',dispose);
  const paintBatch=batch=>{
    if(!live())return;
        showPage(batchDetailHtml(batch,project,filter));
        if(stopPending && batch.state!=='STOPPING'){const button=document.querySelector('#cancel-batch');if(button){button.disabled=true;button.textContent='正在提交停止请求…';}}
        document.querySelector('#batch-state-filter').onchange=event=>{filter=event.target.value;paintBatch(batch);};
        document.querySelector('#cancel-batch')?.addEventListener('click',async event=>{
          if(stopPending)return;stopPending=true;event.target.disabled=true;event.target.textContent='正在提交停止请求…';
          try{await mutate(`${endpoint}/${encodeURIComponent(batch.batch_id)}/stop`,jsonOptions({}));if(live())await refresh();}
          catch(error){if(live()){document.querySelector('#batch-action-error').textContent=`停止未确认：${error.message}。请重试。`;const button=document.querySelector('#cancel-batch');if(button){button.disabled=false;button.textContent='停止测试';}}}
          finally{stopPending=false;}
        });
        const rerun=items=>launchBatch(project,'selected',items.map(item=>item.case_id),items.map(item=>item.selection).filter(Boolean));
        document.querySelector('#rerun-failed')?.addEventListener('click',()=>void rerun(batch.items.filter(item=>batchItemOutcome(item)==='failed')));
        document.querySelector('#rerun-remaining')?.addEventListener('click',()=>void rerun(batchRemainingItems(batch)));
  };
  const refresh=async()=>{
    if(!live())return;
    const sequence=++refreshSequence;
    try{
      const [{batches},nativeData]=await Promise.all([api(endpoint),id?Promise.resolve(null):loadNativeConsole(project,api)]);if(!live()||sequence!==refreshSequence)return;
      const batch=id?batches.find(item=>item.batch_id===id):null;
      if(id&&!batch){showPage('<section class="empty"><h1>未找到本次测试</h1><p>记录不存在或不属于当前项目。</p></section>');return;}
      if(batch){
        paintBatch(batch);
        clearTimeout(timer);if(active(batch))timer=setTimeout(()=>void refresh(),1800);
      }else{
        const records=batches.filter(item=>item.state!=='PREVIEW').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
        showPage(`<div class="page-heading"><div><h1>测试记录</h1><p>每次运行独立保留。进行中的测试可以随时返回查看。</p></div><a class="button" data-nav href="${base}">返回工作台</a></div><nav class="v2-history-tabs"><a class="active" data-nav href="${base}/batches">按次查看</a><a data-nav href="${base}/execution-list">按用例查看</a><a data-nav href="${base}/reports">测试报告</a></nav>${nativeRecordsHtml(project,nativeConsoleModel(project,nativeData,{currentOnly:true}),{compact:true})}${nativeTasksHtml(project,nativeData)}${records.length||!nativeData?.records?.length?`<section class="panel">${nativeData?.records?.length?'<div class="panel-header"><h2>其他测试批次</h2></div>':''}<div class="table-wrap"><table><thead><tr><th>运行时间</th><th>测试版本</th><th>本次范围</th><th>状态 / 结果</th><th>操作</th></tr></thead><tbody>${records.map(item=>{const c=batchSummary(item);return `<tr><td>${esc(formatDate(item.created_at))}</td><td>${esc(item.software_version||'未填写')}</td><td>${c.total} 条</td><td><span class="badge ${active(item)?'warning':''}">${esc(item.state==='STOPPING'?'正在停止':item.state==='CANCELLED'?'已停止':stateLabel(item.state))}</span><small>${c.passed} 运行通过 · ${c.failed} 失败 · ${c.notStarted+c.interrupted+c.blocked} 未完成</small></td><td><a data-nav href="${base}/batches?batch_id=${encodeURIComponent(item.batch_id)}">${active(item)?'返回进行中的测试':'查看结果'}</a></td></tr>`;}).join('')}</tbody></table></div>${records.length||nativeData?.records?.length?'':'<div class="batch-empty">暂无测试记录。到工作台选择已就绪的用例后开始测试。</div>'}</section>`:''}<details class="batch-technical"><summary>高级：历史结果</summary><a data-nav href="${base}/execution-records">查看未归入批次的历史执行与证据</a></details>`);
        bindNativeConsole();
        clearTimeout(timer);if(records.some(active)||(nativeData.tasks||[]).some(task=>['CREATED','QUEUED','STARTING','RUNNING','STOPPING'].includes(task.status)))timer=setTimeout(()=>void refresh(),4000);
      }
    }catch(error){if(live()){const area=document.querySelector('#batch-action-error');if(area)area.textContent=`记录暂未更新：${error.message}`;else showPage('<section class="empty"><h1>暂时无法读取测试记录</h1><p>请刷新后重试，已有测试不会重新启动。</p></section>');clearTimeout(timer);timer=setTimeout(()=>void refresh(),5000);}}
  };
  await refresh();return dispose;
}
