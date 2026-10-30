import { api } from './api.js';
import { batchReasons, esc, stateLabel } from './workflow.js';

const label = scope => ({ project_latest:'全项目（每条用例最新一次）', batch:'测试批次', run:'单用例运行' })[scope] || '未知范围';
const resultLabel = value => ({ PASSED:'通过', FAILED:'失败', TIMEDOUT:'超时', TIMED_OUT:'超时', ERROR:'执行异常', CANCELLED:'已取消', INTERRUPTED:'已中断', BLOCKED:'已阻塞', RUNNING:'执行中', QUEUED:'排队中', NOT_RUN:'未执行', CURRENT_VERSION_NOT_RUN:'当前版本未执行', INCOMPLETE:'证据不完整' })[value] || value || '未记录';
const evidenceLabel = value => ({ COMPLETE:'完整', INCOMPLETE:'不完整', NOT_COLLECTED:'未采集', HTTP_REQUEST_RESPONSE_ASSERTIONS:'HTTP 请求、响应与断言' })[value] || known(value);
const known = value => value === null || value === undefined || value === '' ? '未记录' : String(value);
const n = (obj, key) => Number(obj?.[key] || 0);
const scopeTitle = scope => [known(scope?.environment_name),scope?.target_url,scope?.role&&`角色 ${scope.role}`,scope?.software_version&&`软件版本 ${scope.software_version}`].filter(Boolean).join(' · ');
export const scopeOptionTitle = scope => {
  const date=value=>{const time=new Date(value);return Number.isNaN(time.valueOf())?'时间未记录':time.toLocaleString('zh-CN',{hour12:false});};
  const period=scope?.tested_from?`测试 ${date(scope.tested_from)}${scope.tested_to&&scope.tested_to!==scope.tested_from?' 至 '+date(scope.tested_to):''}`:'测试时间未记录';
  const config=scope?.configuration_sha256?`配置版本 ${scope.configuration_sha256.slice(0,12)}`:'配置版本未记录';
  const identity=scope?.environment_id?`登记 ${scope.environment_id.replace(/^env-/, '').slice(0,8)}`:'登记未记录';
  return `${scopeTitle(scope)} · ${period} · ${config} · ${identity}`;
};
const groupTitle = group => group?.group_key === 'group-unexecuted' ? '当前版本未执行' : scopeTitle(group?.scope);
const reasonLabel = value => {
  if (!value) return '未记录说明';
  return ({ CURRENT_VERSION_NOT_RUN:'当前用例版本尚无正式执行记录', NO_FORMAL_RUN:'当前用例尚无正式执行记录', ...batchReasons })[value] ||
    (/^[A-Z][A-Z0-9_]+$/.test(value) ? '执行说明待核对（技术代码见下）' : String(value));
};
const target = scope => `被测系统：${esc(known(scope?.environment_name))} · 地址：${esc(known(scope?.target_url))} · 角色：${esc(known(scope?.role))} · 软件版本：${esc(known(scope?.software_version))}<details><summary>查看被测范围技术依据</summary><p>配置 ID：${esc(known(scope?.environment_id))} · 配置摘要：${esc(known(scope?.configuration_sha256))}</p></details>`;
const counts = value => `用例 ${n(value,'requested')} · 通过 ${n(value,'passed')} · 失败 ${n(value,'failed')} · 未执行 ${n(value,'not_run')} · 执行中 ${n(value,'running')} · 证据不完整 ${n(value,'incomplete')} · 取消 ${n(value,'cancelled')} · 中断 ${n(value,'interrupted')} · 阻塞 ${n(value,'blocked')}`;

export function bindReportFrame({frame,status,retry,url,isCurrent=()=>true,setTimer=setTimeout,clearTimer=clearTimeout,fetchReport=fetch}) {
  let timer,disposed=false,controller=null,generation=0;
  const live=()=>!disposed&&isCurrent();
  const failed=()=>{if(live()){status.textContent='预览加载失败，请重试或在新标签页打开报告。';retry.hidden=false;}};
  const load=async()=>{
    if(!live())return;
    clearTimer(timer);controller?.abort();const token=++generation;controller=new AbortController();
    status.textContent='正在加载报告预览…';retry.hidden=true;
    timer=setTimer(()=>{if(live()&&token===generation){++generation;controller.abort();failed();}},30000);
    try {
      const response=await fetchReport(url,{signal:controller.signal});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const html=await response.text();
      if(!live()||token!==generation)return;
      const doc=frame.contentDocument;if(!doc)throw Error('REPORT_FRAME_UNAVAILABLE');
      // Saved report-layout snapshots use plain <style> blocks (optionally media).
      // Extract only that fixed markup before any document parsing; even a detached
      // DOMParser applies the inherited CSP. Keep all other snapshot bytes intact.
      const template=doc.createElement('template'),styles=[];
      const previewHtml=html.replace(/<style(?: media="[^"]*")?>[\s\S]*?<\/style>/g,markup=>{
        template.innerHTML=markup;const style=template.content.firstElementChild;
        styles.push({css:style.textContent,media:style.media});return '';
      });
      doc.open();doc.write(previewHtml);doc.close();
      if(!doc.body?.childElementCount)throw Error('REPORT_FRAME_EMPTY');
      doc.adoptedStyleSheets=styles.map(({css,media})=>{
        const sheet=new frame.contentWindow.CSSStyleSheet({media});sheet.replaceSync(css);return sheet;
      });
      doc.addEventListener('click',event=>{const link=event.target.closest?.('a[href^="#"]');if(!link)return;const target=doc.getElementById(link.getAttribute('href').slice(1));if(target){event.preventDefault();target.scrollIntoView();}});
      clearTimer(timer);status.textContent='报告预览已加载';retry.hidden=true;
    } catch(error) {if(error.name!=='AbortError'&&token===generation){clearTimer(timer);failed();}}
  };
  retry.addEventListener('click',load);load();
  return ()=>{disposed=true;++generation;controller?.abort();clearTimer(timer);retry.removeEventListener('click',load);};
}

function table(entries) {
  if (!entries?.length) return '<p class="notice">此被测范围没有可预览的项目用例。</p>';
  return [['UI','前端 UI 用例'],['BACKEND','后端用例'],['UNCLASSIFIED','未分类旧用例']].map(([kind,title]) => {
    const rows=entries.filter(e=>(e.case_type||'UNCLASSIFIED')===kind);
    if (!rows.length) return '';
    return `<h4>${title} · ${rows.length} 条</h4><div class="table-wrap"><table><thead><tr><th>当前用例</th><th>最近结果</th><th>执行时间</th><th>复测</th><th>说明</th></tr></thead><tbody>${rows.map(e=>`<tr><td><strong>${esc(known(e.external_id))}</strong><small>${esc(known(e.title))} · 当前 v${esc(known(e.case_version))}</small></td><td><strong>${esc(resultLabel(e.state))}</strong><small>原始执行：${esc(resultLabel(e.result))} · 证据：${esc(evidenceLabel(e.evidence_status))}</small></td><td>${esc(known(e.started_at))}<small>结束：${esc(known(e.finished_at))}</small></td><td>${n(e,'retest_count')} 次</td><td>${esc(reasonLabel(e.reason))}<details><summary>查看运行依据</summary><p>本次运行：${esc(known(e.run_id))} · 上次运行：${esc(known(e.previous_run_id))} · 原始原因：${esc(known(e.reason))}</p></details></td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
}

export function renderLatestPreview(preview) {
  if (!preview || !Array.isArray(preview.groups)) return '<p class="notice danger">预览资料不完整，请重试加载。</p>';
  const head=preview.group_key==='latest_per_case'
    ? `<p class="notice">项目当前 ${n(preview,'case_count')} 条用例，每条只展示最新一次，共 ${n(preview,'entry_count')} 行，按实际被测范围分为 ${preview.groups.length} 组。可能来自不同时间、系统、角色或软件版本，不能当作同一版本的一轮全量验证。预览截止：${esc(known(preview.cutoff_at))}。</p><p>${counts(preview.counts)}</p>`
    : preview.group_key==='all'
      ? `<p class="notice">历史范围展开：项目当前 ${n(preview,'case_count')} 条不同用例，${n(preview,'entry_count')} 条用例与范围组合，${preview.groups.length} 个被测范围。同一用例可能出现多组，各组数量不能相加。预览截止：${esc(known(preview.cutoff_at))}。</p>`
      : `<p class="notice">${counts(preview.counts)} · 预览截止：${esc(known(preview.cutoff_at))}。</p>`;
  if (!preview.groups.length) return head+'<p class="notice warning">当前项目没有可展示的用例或被测范围。</p>';
  const rule=preview.group_key==='latest_per_case'
    ? '每条当前用例只取最新一次正式结果，再按该次记录的真实被测范围分组；未测用例单独成组。最新失败不会被旧通过覆盖。'
    : '每条用例采用当前用例版本在该范围内最近一次结果；最新失败不会被旧通过覆盖。';
  return head+`<p>${rule}当前版本未复测及证据不完整如实保留。</p>`+
    preview.groups.map((g,index)=>`<section class="panel"><div class="panel-body"><h3>被测范围 ${index+1} · ${esc(groupTitle(g))}</h3><div>${target(g.scope)}</div><p>${counts(g.counts)}</p>${table(g.entries)}</div></section>`).join('');
}

export function createReportRequestTracker(makeId=()=>`report-${crypto.randomUUID()}`) {
  let current=null;
  return {
    forPayload(payload) { const key=JSON.stringify(payload); if (!current || current.key!==key) current={key,id:makeId()}; return current.id; },
    get activeId() { return current?.id||null; },
    reset() { current=null; },
  };
}

export async function renderReports({project,query,showPage,go,isCurrent=()=>true}) {
  let disposed=false;
  const dispose=()=>{disposed=true;};
  const live=()=>!disposed&&isCurrent();
  const base=`/api/case-library/projects/${encodeURIComponent(project.project_id)}/reports`, reportId=query.get('report_id');
  if (reportId) {
    let r;
    try {r=await api(`${base}/${encodeURIComponent(reportId)}`);}
    catch(error){if(!live())return dispose;throw error;}
    if(!live())return dispose;
    const scopeDetail=r.scope==='project_latest'
      ? ` · ${esc(r.group_key==='latest_per_case'?'每条用例最新一次':r.group_key==='all'?'所有历史范围展开（含重复用例）':scopeTitle(r.groups?.[0]?.scope))} · 截止 ${esc(known(r.cutoff_at))}`
      : ` · ${esc(r.batch_id||r.run_id)}`;
    const countNote=r.scope==='project_latest'&&r.group_key==='latest_per_case'
      ? `项目不同用例 ${n(r,'case_count')} 条，每条只展示一次，按实际被测范围分为 ${r.groups?.length||0} 组；这些结果可能来自不同系统、时间和软件版本，不能当作同版本一轮验证。`
      : r.scope==='project_latest'&&r.group_key==='all'
        ? `项目不同用例 ${n(r,'case_count')} 条，历史范围展开 ${n(r,'entry_count')} 行；各范围分别统计，不能将组数相加。`
        : `请求 ${n(r.counts,'requested')} 条，未执行 ${n(r.counts,'not_run')} 条。`;
    const htmlUrl=`${base}/${encodeURIComponent(r.report_id)}/html`;
    showPage(`<div class="page-heading"><div><h1>测试报告预览</h1><p>固定快照 · ${label(r.scope)}${scopeDetail} · 创建 ${esc(known(r.created_at))}</p></div><a class="button primary" href="${htmlUrl}?download=1" download>下载离线 HTML 报告</a></div><p class="notice">这是已保存快照；后续复测不更新此报告。${countNote}未携带的媒体会在报告中明确列出。</p><a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/reports">返回报告列表</a> · <a href="${htmlUrl}" target="_blank" rel="noopener noreferrer">在新标签页打开报告</a><p id="report-frame-status" role="status" aria-live="polite">正在加载报告预览…</p><button id="report-frame-retry" class="button" type="button" hidden>重试加载预览</button><iframe class="report-preview" title="固定快照报告预览" sandbox="allow-same-origin allow-downloads"></iframe>`);
    const frame=document.querySelector('.report-preview'),status=document.querySelector('#report-frame-status'),retry=document.querySelector('#report-frame-retry');
    const unbind=frame&&status&&retry?bindReportFrame({frame,status,retry,url:htmlUrl,isCurrent:live}):()=>{};
    return ()=>{dispose();unbind();};
  }
  let data;
  try {data=await Promise.all([
    api(base), api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/batches`),
    api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/execution-records`),
    api(`${base}/latest-preview?group_key=latest_per_case`).then(value=>({value}),error=>({error})),
  ]);}catch(error){if(!live())return dispose;throw error;}
  if(!live())return dispose;
  const [saved,batchData,recordData,latest]=data;
  const batches=batchData.batches||[], records=recordData.records||[], runId=query.get('run_id'), batchId=query.get('batch_id');
  if (runId&&!records.some(r=>r.run_id===runId)||batchId&&!batches.some(b=>b.batch_id===batchId)) throw Error('指定报告对象不属于当前项目');
  const options=(latest.value?.group_options||[]).filter(o=>!['all','latest_per_case'].includes(o.group_key)), initialGroup='latest_per_case';
  const targetControl=`<details><summary>高级筛选：按被测范围或展开历史范围</summary><label class="field">结果选择<select id="report-group"><option value="latest_per_case" selected>全项目（每条用例最新一次）</option>${options.map((o,index)=>`<option value="${esc(o.group_key)}">仅范围 ${index+1} · ${esc(scopeOptionTitle(o.scope))}</option>`).join('')}<option value="all">所有历史范围展开（含重复用例）</option></select><small>测试时间和配置版本帮助区分同地址的历史范围；不同登记、配置、角色和软件版本仍分别保留。展开历史范围会重复列出用例，分组计数不能相加。</small></label></details>`;
  const latestControl=latest.error
    ? `<p class="notice danger">全项目最新结果预览加载失败：${esc(latest.error.message)}。</p><button class="button" id="report-reload-preview" type="button">重试加载预览</button>`
    : targetControl;
  showPage(`<div class="page-heading"><div><h1>报告</h1><p>从项目当前用例清单生成最新结果快照，也可按指定批次或单次运行导出。</p></div></div><div class="report-layout"><section class="panel"><div class="panel-body"><h2>创建固定快照报告</h2><label class="field">报告范围<select id="report-scope"><option value="project_latest" ${runId||batchId?'':'selected'}>全项目（每条用例最新一次）</option><option value="batch" ${batchId?'selected':''}>指定测试批次</option><option value="run" ${runId?'selected':''}>单用例指定运行</option></select></label><div id="report-latest-controls"><p>默认每条当前用例只展示最新一次结果；结果可能来自不同时间、被测系统、角色或软件版本，不能当作同一版本的一轮全量验证。</p>${latestControl}</div><label class="field" id="report-batch-field">测试批次<select id="report-batch"><option value="">请选择</option>${batches.filter(b=>['FINISHED','CANCELLED','INTERRUPTED'].includes(b.state)).map(b=>`<option value="${esc(b.batch_id)}" ${batchId===b.batch_id?'selected':''}>${esc(b.created_at)} · ${esc(b.software_version||'版本未提供')} · ${b.items.length} 条 · ${esc(stateLabel(b.state))}</option>`).join('')}</select></label><label class="field" id="report-run-field">具体运行<select id="report-run"><option value="">请选择</option>${records.map(r=>`<option value="${esc(r.run_id)}" ${runId===r.run_id?'selected':''}>${esc(r.executed_external_id)} v${r.executed_case_version} · ${esc(r.started_at)} · ${esc(r.status)}</option>`).join('')}</select></label><details class="workflow-details"><summary>附件选项：视频与 Trace</summary><p>截图默认内嵌；可选择原始录像、中文回放和 Trace。附件合计上限 80 MB；超限或缺失项明确标记，不输出本机链接冒充离线附件。</p><label><input type="checkbox" id="report-video">携带视频（可能较大）</label><label><input type="checkbox" id="report-trace">携带 Trace（请确认无敏感业务资料）</label></details><p id="report-message" role="status" aria-live="polite"></p><button class="button primary" id="report-create" type="button">生成快照并预览</button><button class="button" id="report-cancel" type="button" hidden>取消生成</button></div></section><section class="panel"><div class="panel-body"><h2>已保存报告</h2>${saved.reports.map(r=>`<p><a data-nav href="#/projects/${encodeURIComponent(project.project_id)}/reports?report_id=${encodeURIComponent(r.report_id)}">${esc(r.created_at)} · ${label(r.scope)}${r.scope==='project_latest'?` · ${esc(r.group_key==='latest_per_case'?'每条用例最新一次':r.group_key==='all'?'所有历史范围展开（含重复用例）':scopeTitle(r.groups?.[0]?.scope))}`:''} · ${r.scope==='project_latest'&&r.group_key==='all'?`${n(r,'case_count')} 条不同用例 / ${n(r,'entry_count')} 行`:`${r.entry_count} 条`}</a></p>`).join('')||'<p>尚无报告快照</p>'}</div></section></div><section class="panel" id="report-latest-panel"><div class="panel-body"><h2>全项目最新结果预览</h2><div id="report-latest-preview" aria-live="polite"><p class="notice">正在加载每条用例的最新结果…</p></div></div></section>`);
  if(!live())return dispose;
  // Capture this page's controls so a late reply cannot select another page's DOM.
  const controls=new Map(['scope','group','message','create','cancel','latest-controls','latest-panel','batch-field','run-field','latest-preview','reload-preview','video','trace','batch','run'].map(id=>[`#report-${id}`,document.querySelector(`#report-${id}`)]));
  const $=selector=>controls.get(selector), message=$('#report-message'), button=$('#report-create'), cancel=$('#report-cancel');
  const livePage=()=>live()&&Boolean($('#report-scope'))&&$('#report-scope').isConnected!==false;
  const tracker=createReportRequestTracker(); let sending=false,ready=false,sequence=0,pendingId=null;
  const selectedGroup=()=>$('#report-group')?.value||initialGroup;
  const scope=()=>$('#report-scope').value;
  const toggle=()=>{ if(!livePage())return; $('#report-latest-controls').hidden=scope()!=='project_latest'; $('#report-latest-panel').hidden=scope()!=='project_latest'; $('#report-batch-field').hidden=scope()!=='batch'; $('#report-run-field').hidden=scope()!=='run'; button.disabled=sending||scope()==='project_latest'&&(!ready||!selectedGroup()); };
  const load=async group=>{
    if(!livePage())return;
    const token=++sequence;ready=false;toggle();
    if (!group) { $('#report-latest-preview').innerHTML='<p class="notice">请选择被测范围以查看最新结果。</p>'; return; }
    $('#report-latest-preview').innerHTML='<p class="notice">正在加载最新结果…</p>';
    try {
      const preview=await api(`${base}/latest-preview?group_key=${encodeURIComponent(group)}`);
      if (!livePage()||token!==sequence) return;
      $('#report-latest-preview').innerHTML=renderLatestPreview(preview);
      ready=preview.group_key===group&&n(preview,'case_count')>0;
      message.textContent=ready?'':n(preview,'case_count')?'预览范围与所选范围不一致，请重新加载。':'项目当前没有用例，无法生成全项目最新结果报告。';
    } catch (error) {
      if (!livePage()||token!==sequence) return;
      $('#report-latest-preview').innerHTML=`<p class="notice danger">预览加载失败：${esc(error.message)}。</p><button class="button" type="button" id="report-preview-retry">重试加载预览</button>`;
      message.textContent='未取得最新结果预览，暂不能生成报告。';
    }
    toggle();
  };
  $('#report-scope').onchange=()=>{if(!livePage())return;tracker.reset();message.textContent='';toggle();};
  $('#report-group')?.addEventListener('change',event=>{if(!livePage())return;tracker.reset();message.textContent='';load(event.target.value);});
  $('#report-latest-preview').addEventListener('click',event=>{if(livePage()&&event.target.closest('#report-preview-retry'))load(selectedGroup());});
  $('#report-reload-preview')?.addEventListener('click',()=>{if(livePage())go(`#/projects/${encodeURIComponent(project.project_id)}/reports`);});
  if (!latest.error) load(initialGroup);
  else $('#report-latest-preview').innerHTML='<p class="notice danger">暂时无法取得全项目最新结果；请点击上方“重试加载预览”。</p>';
  toggle();
  cancel.onclick=async()=>{
    if (!livePage()||!pendingId||cancel.disabled) return;
    cancel.disabled=true;
    try {const result=await api(base+'/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request_id:pendingId})});if(!livePage())return;message.textContent=result.state==='FINISHED'?'快照已先完成，保留已生成结果。':'已请求取消，等待服务端确认。';}
    catch(error){if(!livePage())return;message.textContent=`取消请求失败：${error.message}`;cancel.disabled=false;}
  };
  button.onclick=async()=>{
    if (!livePage()||sending) return;
    const kind=scope(), payload={scope:kind,include_video:$('#report-video').checked,include_trace:$('#report-trace').checked};
    if (kind==='project_latest') {payload.group_key=selectedGroup();if (!ready||!payload.group_key) {message.textContent='请先选择被测范围并完成预览。';return;}}
    else {const key=kind==='batch'?'batch_id':'run_id';payload[key]=$(kind==='batch'?'#report-batch':'#report-run').value;if (!payload[key]) {message.textContent='请先选择固定报告范围。';return;}}
    payload.request_id=tracker.forPayload(payload);
    pendingId=payload.request_id;
    sending=true;button.disabled=true;cancel.hidden=false;cancel.disabled=false;message.textContent='正在核对证据并保存快照…';
    try {const report=await api(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!livePage())return;tracker.reset();pendingId=null;go(`#/projects/${encodeURIComponent(project.project_id)}/reports?report_id=${encodeURIComponent(report.report_id)}`);}
    catch(error){if(!livePage())return;message.textContent=error.message==='REPORT_CANCELLED'?'已取消生成，未保存新快照。':`生成失败：${error.message}。可用相同选择重试。`;if(error.message==='REPORT_CANCELLED')tracker.reset();pendingId=null;sending=false;cancel.hidden=true;toggle();}
  };
  return dispose;
}
