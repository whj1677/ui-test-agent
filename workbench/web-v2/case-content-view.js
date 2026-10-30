import { esc } from './workflow.js';

// Reading a confirmed version does not require execution history or readiness.
// Keep these requests on the pages where their results are actually used.
export function renderCaseContent({project,item,version,query,showPage,go,statusText,sourceHtml='',onEdit}) {
  const content=version.content,base=`#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}`;
  const href=tab=>{const next=new URLSearchParams(query);next.set('version',version.version);next.set('tab',tab);return `${base}?${next}`;};
  const returnPath=(query.get('return')||'').split('?')[0];
  const fromAutomation=[`#/projects/${project.project_id}`,`#/projects/${project.project_id}/automation`].includes(returnPath);
  const back=fromAutomation||query.get('return')?.startsWith(`#/projects/${project.project_id}/cases`)?query.get('return'):`#/projects/${project.project_id}/cases`;
  showPage(`<div class="page-heading case-heading"><div><a data-nav href="${esc(back)}">← 返回用例</a><h1>${esc(content.external_id)} · ${esc(content.title)}</h1><p>${esc(content.module||'未填写模块')} · 用例 v${version.version}</p></div><a class="button" data-nav href="${esc(href('scripts'))}">脚本与运行</a></div>
    <label>用例版本 <select id="content-version">${[...item.versions].reverse().map(v=>`<option value="${v.version}" ${v.version===version.version?'selected':''}>v${v.version}${v.version===item.current_version?' · 当前':' · 历史只读'}</option>`).join('')}</select></label>
    <nav class="case-tabs" aria-label="用例详情页签">${[['results','结果与证据'],['content','用例内容'],['scripts','自动化脚本'],['history','历史结果']].map(([tab,label])=>`<a data-nav href="${esc(href(tab))}" ${tab==='content'?'aria-current="page" class="active"':''}>${label}</a>`).join('')}</nav>
    <section class="panel"><div class="panel-header"><h2>原始用例正文</h2>${version.version===item.current_version?`<button class="button" id="edit-case">${content.requirements_origin?'创建用例修订稿':'编辑当前版本'}</button>`:'<span>历史正文只读</span>'}</div><div class="panel-body"><p>内容状态：${esc(statusText(content.status))} · 用例类型：${content.case_type==='BACKEND'?'后端':content.case_type==='UI'?'前端 UI':'未分类'}</p>${!content.case_type&&version.version===item.current_version?'<p class="notice warning">此用例尚未分类。点击“编辑当前版本”，在“用例类型”中选择前端 UI 或后端后保存。</p>':''}<h3>前置条件</h3><p class="preserve-text">${esc(content.preconditions||'未填写')}</p><h3>测试数据</h3><p class="preserve-text">${esc(content.test_data||'未填写')}</p>${content.steps.map(step=>`<article class="step-pair"><strong>${esc(step.order)}</strong><div><small>动作</small><p>${esc(step.action)}</p></div><div><small>原预期</small><p>${esc(step.expected||'缺失，待确认')}</p></div></article>`).join('')}${sourceHtml}<details><summary>来源物理行列与版本身份</summary><pre>${esc(JSON.stringify({source:item.root_source,source_location:version.source_location||item.source_location,content_sha256:version.content_sha256,lineage:item.lineage},null,2))}</pre></details></div></section>`);
  document.querySelector('#edit-case')?.addEventListener('click',onEdit);
  document.querySelector('#content-version').onchange=event=>{
    const next=new URLSearchParams(query);next.set('version',event.target.value);next.set('tab','content');
    for(const key of ['run_id','native_run','batch_id','script_task','candidate'])next.delete(key);
    go(`${base}?${next}`);
  };
}

export async function loadCaseExecutionContext({project,item,version,query,api,loadNativeConsole}) {
  const endpoint=`/api/case-library/projects/${project.project_id}`;
  const native=loadNativeConsole(project,api,{caseId:item.case_id,caseVersion:version.version});
  const nativeResult=native.then(data=>{
    const ownsHistory=data.records?.some(row=>row.project_id===project.project_id&&row.case_id===item.case_id&&Number(row.case_version)===Number(version.version)&&String(row.content_sha256).toLowerCase()===String(version.content_sha256).toLowerCase());
    // Explicit legacy links and uncertain/missing native history retain the
    // original lookup. Never replace a failed lookup with a false empty result.
    return ownsHistory&&!data.load_error&&(query.get('tab')||'results')==='results'&&!query.has('run_id')&&!query.has('batch_id');
  });
  // Native result actions navigate to the scripts page for selection/readiness.
  // Legacy candidates and admission are still freshly read there and on legacy links.
  const automation=nativeResult.then(nativeOnly=>nativeOnly?{candidates:[],deferred:true}:api(`${endpoint}/cases/${item.case_id}/automation?version=${version.version}`));
  const records=nativeResult.then(nativeOnly=>nativeOnly?{records:[]}:api(`${endpoint}/execution-records`));
  return Promise.all([automation,native,records]);
}
