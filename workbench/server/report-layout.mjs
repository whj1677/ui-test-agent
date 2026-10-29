
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = v => JSON.stringify(v,null,2);
const text = v => typeof v === 'string' ? v : json(v);
const labels = {UI:'前端 UI',BACKEND:'后端接口',UNCLASSIFIED:'未分类',FINISHED:'执行结束',NOT_EXECUTED:'未执行',RUNNING:'执行中',QUEUED:'排队中',STOPPING:'停止中',BLOCKED:'已阻塞',INTERRUPTED:'已中断',PASSED:'通过',FAILED:'失败',TIMEDOUT:'超时',TIMED_OUT:'超时',ERROR:'执行异常',CANCELLED:'已取消',HTTP_REQUEST_RESPONSE_ASSERTIONS:'HTTP 请求、响应与断言',NOT_RUN:'未执行',COMPLETE:'完整',INCOMPLETE:'不完整',NOT_COLLECTED:'未采集',NOT_APPROVED:'未批准',PENDING:'待核对',CONFIRMED_HTTP_PLAN_NOT_PRODUCT_APPROVAL:'已确认HTTP执行计划，非产品验收结论',LIMITED_TECHNICAL_TRIAL_NOT_APPROVED:'限定技术试跑，未批准',NO_APPLICABLE_SCRIPT:'没有适用脚本',REVIEWED_COMPLETE_FOR_THIS_CASE:'本次核查完整，未批准',BUSINESS_DIFFERENCE_RETAINED:'业务差异保留，待核对',NOT_ACCEPTED_ACTION_CHANGED:'动作或预期偏离，不采纳',BUSINESS_DIFFERENCE_WITH_COVERAGE_GAP:'覆盖不足，业务差异保留',FROZEN_CASE_INPUT_CONFLICT:'原用例输入矛盾，待澄清',REVIEW_REQUIRED_PRECONDITION_ADDED:'前置条件待确认'};
labels.NATIVE_EXECUTION_NOT_PRODUCT_APPROVAL = '原生脚本执行，人工首审未登记';
const label = v => labels[v] || v || '未记录';
const reasons = {CURRENT_VERSION_NOT_RUN:'当前用例版本尚未执行；旧版本结果仅供历史查看',NO_FORMAL_RUN:'当前范围没有正式执行记录',SCRIPT_MISSING:'脚本缺失',BATCH_CANCELLED:'批次已取消'};
const tone = s => s === 'PASSED' ? 'good' : ['FAILED','ERROR','TIMEDOUT','TIMED_OUT'].includes(s) ? 'bad' : ['RUNNING','QUEUED','STOPPING'].includes(s) ? 'info' : 'warn';
const badge = s => `<span class="badge ${tone(s)}">${esc(label(s))}</span>`;
const statusOf = (e,r) => r.scope === 'project_latest' ? e.state : ['BLOCKED','CANCELLED','INTERRUPTED','INCOMPLETE'].includes(e.state) ? e.state : e.result;
const attention = (e,r) => statusOf(e,r) !== 'PASSED' || e.evidence_status === 'INCOMPLETE';
const time = v => {
  if(!v)return '未记录';
  const d=new Date(v);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
};
const actual = fact => {
  if(!fact)return '未取得';
  if(Object.hasOwn(fact,'actual') && fact.actual !== undefined && fact.actual !== null)return text(fact.actual);
  const assertions=fact.assertions||fact.attributed_assertions;
  if(Array.isArray(assertions)&&assertions.length)return assertions.map(a=>{
    const present=a.actual_present!==false&&a.actual_recorded!==false&&Object.hasOwn(a,'actual')&&a.actual!==undefined;
    return `${a.target_label||a.target||a.matcher_name||a.name||'断言'}：${label(a.status)}；实际 ${present?text(a.actual):'未采集'}${Object.hasOwn(a,'assertion_expected')?`；预期 ${text(a.assertion_expected)}`:''}`;
  }).join('\n');
  const e=fact.error;
  if(['PLAYWRIGHT_MATCHER_RESULT','PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS'].includes(e?.value_source) && !e.value_unavailable_reason && Object.hasOwn(e,'actual'))return text(e.actual);
  return '实际值未采集';
};
const factFor = (e,s) => (e.steps||[]).find(f=>f.order===s.order||f.step_id===`CASE_STEP_${s.order}`||f.marker===`CASE_STEP_${s.order}`);
const noteFor = (e,r) => {
  if(e.reason)return reasons[e.reason]||e.reason;
  const f=(e.steps||[]).find(s=>['FAILED','ERROR','TIMEDOUT','TIMED_OUT'].includes(s.execution_status||s.status));
  if(f)return `步骤 ${f.order??f.step_id??f.marker}：${actual(f)}`;
  if(e.error)return e.error.message||e.error.code||e.error.type||text(e.error);
  if(e.evidence_status==='INCOMPLETE')return '执行证据不完整，请查看缺失项。';
  return {PASSED:'本次执行通过',NOT_RUN:'此范围尚未执行',RUNNING:'生成报告时仍在执行',BLOCKED:'执行条件未满足',CANCELLED:'本次执行已取消',INTERRUPTED:'本次执行已中断'}[statusOf(e,r)]||'请展开用例查看本次记录';
};
const fold = (title,body,cls='') => `<details class="${cls}"><summary>${title}</summary><div class="detail-body">${body}</div></details>`;
const scopeName = r => r.scope==='project_latest' ? r.group_key==='latest_per_case'?'每个用例最新结果':r.group_key==='all'?'所有历史范围（含重复用例）':'指定环境范围的最新结果':r.scope==='batch'?'指定测试批次':'指定用例的指定运行';
const scopeNote = r => r.scope==='batch'?'范围为选定批次的全部条目，包含未能开始执行的用例；后续复测不改变此快照。':r.scope==='run'?'仅包含选定用例的这一次运行；后续复测不改变此快照。':r.group_key==='latest_per_case'?'每个当前版本用例只列最新一条正式记录。结果来自不同测试范围与时间，不代表同一配置或软件版本的一轮全量验证。':r.group_key==='all'?'同一用例可能在多个范围重复出现。统计单位为“用例×范围条目”，不能把各组相加当作独立用例数。不同目标、角色或软件版本的结果不合并。':'仅展示指定范围内当前版本用例的最新正式记录。最新失败、阻塞或执行中不会被前次通过替代。';

function stepsHtml(e) {
  return `<div class="table-wrap"><table class="steps"><thead><tr><th>步骤</th><th>操作</th><th>预期结果</th><th>本次实际</th></tr></thead><tbody>${(e.content?.steps||[]).map(s=>{
    const f=factFor(e,s), status=f?.execution_status||f?.status||'未取得';
    return `<tr class="${tone(status)}"><td data-label="步骤">${esc(s.order)}</td><td data-label="操作">${esc(s.action)}</td><td data-label="预期结果">${esc(s.expected)}</td><td data-label="本次实际"><span class="step-fact">${esc(label(status))} / ${esc(actual(f))}</span></td></tr>`;
  }).join('')||'<tr><td colspan="4">未记录用例步骤</td></tr>'}</tbody></table></div>`;
}
function httpHtml(evidence) {
  const rows=[];
  for(const phase of ['setup','steps','cleanup'])for(const step of evidence[phase]||[]){
    for(const item of phase==='steps'?step.requests||[]:[step]){
      const a=item.assertions||[], req=item.request;
      rows.push(`<tr><td>${phase==='setup'?'准备数据':phase==='cleanup'?'清理数据':`步骤 ${esc(step.order)}`}</td><td>${esc(req?.kind==='response-reference'?`复用响应 ${req.source_request_id}`:`${req?.method||''} ${req?.url||item.request_id||'未记录'}`)}</td><td>${badge(item.status)}<span class="sub">HTTP ${esc(item.response?.status??'未记录')} · 断言 ${a.filter(x=>x.status==='PASSED').length} / ${a.length} 通过</span></td></tr>`);
    }
  }
  return fold('接口请求与清理记录',`<div class="table-wrap"><table><thead><tr><th>阶段</th><th>请求</th><th>结果</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="3">未记录请求</td></tr>'}</tbody></table></div>${fold('查看完整请求、响应与断言',`<pre>${esc(json(evidence))}</pre>`,'technical')}`);
}

const imageUrl = media => media?.included && typeof media.data_url === 'string' && media.data_url.startsWith('data:image/png;base64,') ? media.data_url : null;
const uniqueFactFor = (entry, step) => {
  const facts=(entry.steps||[]).filter(f=>f.order===step.order||f.step_id===`CASE_STEP_${step.order}`||f.marker===`CASE_STEP_${step.order}`);
  return facts.length===1?facts[0]:null;
};
function screenshotFigure(entry, media, title, id, message) {
  const url=imageUrl(media);
  if(!url)return `<figure class="shot-card missing"><figcaption>${esc(title)}</figcaption><p>${esc(message||media?.reason||'未记录对应截图')}</p></figure>`;
  return `<figure class="shot-card"><figcaption>${esc(title)}<span>点击放大</span></figcaption><button type="button" class="shot-preview" popovertarget="${id}" aria-label="放大：${esc(entry.external_id)} · ${esc(title)}"><img loading="lazy" src="${esc(url)}" alt="${esc(entry.external_id)} · ${esc(title)}"></button>
  <div popover id="${id}" class="shot-viewer" aria-label="${esc(entry.external_id)} · ${esc(title)}"><header><div><strong>${esc(entry.external_id)} · ${esc(title)}</strong><p>完整原图 · 可滚动查看</p></div><button type="button" popovertarget="${id}" popovertargetaction="hide" class="shot-close">关闭 <span>Esc</span></button></header><div class="shot-original"><img loading="lazy" src="${esc(url)}" alt="${esc(entry.external_id)} · ${esc(title)} 完整原图"></div><footer><a class="button" download="${esc(media.name)}" href="${esc(url)}">下载原图</a><span>${esc(media.name)}</span></footer></div></figure>`;
}
function mediaHtml(entry, entryIndex) {
  const media=entry.media||[], images=media.filter(m=>m.kind==='image'), used=new Set();
  const resolve=name=>{
    if(!name)return {message:'未记录对应截图'};
    const matches=images.filter(m=>m.name===name);
    if(matches.length!==1)return {message:matches.length?'截图名称重复，无法确定对应文件':'对应截图未携带'};
    used.add(matches[0]);return {media:matches[0]};
  };
  const stepCards=[...(entry.content?.steps||[])].sort((a,b)=>a.order-b.order).map((step,index)=>{
    const fact=uniqueFactFor(entry,step);
    if(!fact?.before_screenshot_file_name&&!fact?.screenshot_file_name)return '';
    const before=resolve(fact.before_screenshot_file_name), after=resolve(fact.screenshot_file_name);
    const phase=fact.screenshot_phase==='failure-after'?'失败后页面':fact.screenshot_phase==='after'?'步骤结束后页面':'记录的页面截图';
    const prefix=`shot-${entryIndex}-step-${index}`;
    return `<section class="shot-step"><div class="shot-step-heading"><h5>步骤 ${esc(step.order)}</h5>${badge(fact.execution_status||fact.status||'未记录')}</div><p class="shot-action">${esc(step.action)}</p><div class="shot-pair">${screenshotFigure(entry,before.media,`步骤 ${step.order} · 执行前页面`,prefix+'-before',before.message)}${screenshotFigure(entry,after.media,`步骤 ${step.order} · ${phase}`,prefix+'-after',after.message)}</div></section>`;
  }).join('');
  const other=images.filter(m=>!used.has(m));
  const otherHtml=other.length?fold(`其他截图（${other.length}）`,`<p class="muted">保留结束截图和未能明确关联步骤的截图。</p><div class="other-shots">${other.map((m,i)=>screenshotFigure(entry,m,m.name,`shot-${entryIndex}-other-${i}`)).join('')}</div>`,'other-screenshots'):'';
  const videos=media.filter(m=>m.kind==='video');
  const videosHtml=videos.length?fold(`录像回放（${videos.length}）`,videos.map(m=>{
    const name=m.name?.includes('step-replay')?'步骤证据回放（非连续录像）':m.name?.includes('browser-window')?'浏览器窗口录像':'页面录像';
    const valid=m.included&&typeof m.data_url==='string'&&m.data_url.startsWith('data:video/webm;base64,');
    return fold(name,valid?`<video controls preload="none" src="${esc(m.data_url)}" aria-label="${name}"></video><a class="button" download="${esc(m.name)}" href="${esc(m.data_url)}">下载视频</a>`:`<p class="muted">未携带：${esc(m.reason||'附件不可用')}</p>`,'recording');
  }).join(''),'recordings'):'';
  const files=media.filter(m=>!['image','video'].includes(m.kind));
  const filesHtml=files.length?fold(`其他附件（${files.length}）`,files.map(m=>{
    const valid=m.included&&typeof m.data_url==='string'&&m.data_url.startsWith('data:application/zip;base64,');
    return `<p>${esc(m.name)}</p>${valid?`<a class="button" download="${esc(m.name)}" href="${esc(m.data_url)}">下载 Trace</a>`:`<p class="muted">未携带：${esc(m.reason||'附件不可用')}</p>`}`;
  }).join('')):'';
  const inventory=media.length?fold('附件来源与校验信息',`<div class="table-wrap"><table><thead><tr><th>文件</th><th>携带情况</th><th>大小 / SHA256</th></tr></thead><tbody>${media.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.included?'已携带':`未携带：${esc(m.reason)}`}</td><td>${esc(m.bytes)} 字节<span class="sub">${esc(m.sha256)}</span></td></tr>`).join('')}</tbody></table></div>`,'technical'):'';
  const gallery=stepCards?`<div class="screenshot-gallery"><h4>按步骤查看截图</h4><p class="muted">左侧为执行前，右侧为步骤结束后的页面；截图不代替实际断言结果。</p>${stepCards}</div>`:'';
  return fold(`截图、录像与附件 <span class="muted">${images.length} 张截图 · ${videos.length} 段录像</span>`,gallery+otherHtml+videosHtml+filesHtml+inventory||'<p class="muted">无本次可用媒体，不使用其他记录素材。</p>','media');
}


function entryHtml(e,index,r,group) {
  const status=statusOf(e,r), env=group?.scope||e.environment||{};
  const technical={case_id:e.case_id,run_id:e.run_id,batch_id:e.batch_id||r.batch_id,previous_run_id:e.previous_run_id||null,content_sha256:e.content_sha256,bundle_sha256:e.bundle_sha256,service_identity:e.service_identity||null,failure_category:e.failure_category||null,fidelity_review:e.fidelity_review||null};
  return `<article class="case"><details id="case-${index}" class="case-detail"${attention(e,r)||r.entries.length===1?' open':''}><summary><span class="case-summary">${badge(status)}<span><strong>${esc(e.external_id)} · ${esc(e.title)}</strong><span class="sub">${esc(label(e.case_type||e.content?.case_type))} · 用例 v${esc(e.case_version)} · ${esc(env.environment_name||env.name||env.target_url||env.url||env.base_url||'环境未记录')} · ${esc(e.software_version||env.software_version||'软件版本未记录')}</span></span><span class="detail-hint">查看详情</span></span></summary><div class="detail-body">
    <div class="case-verdict"><div>当前结果：<strong>${esc(label(status))}</strong><span class="sub">原始执行：<b>${esc(label(e.result))}</b> · 要求核对：${esc(label(e.review?.requirements_status||'未核对'))} · 脚本资格：${esc(label(e.qualification))}</span></div><div>执行证据：${esc(label(e.evidence_status))}</div></div>
    ${attention(e,r)?`<p class="notice">${esc(noteFor(e,r))}</p>`:''}${e.review?.finding?`<p class="notice">要求核对说明：${esc(e.review.finding)}</p>`:''}
    <div class="context-grid"><div><h4>前置条件</h4><p>${esc(text(e.content?.preconditions??'未记录'))}</p></div><div><h4>测试数据</h4><p>${esc(text(e.content?.test_data??'未记录'))}</p></div></div>
    <h4>步骤与实际结果</h4>${stepsHtml(e)}${e.http_evidence?httpHtml(e.http_evidence):''}${mediaHtml(e,index)}
    ${fold('技术详情与来源记录',`<p>脚本版本：${esc(e.script_version||'历史未编号')} · 候选版本：${esc(e.candidate_version||'未记录')}</p><p>开始：${esc(time(e.started_at))} · 结束：${esc(time(e.finished_at))} · 复测次数：${esc(e.retest_count??'未记录')}</p><h4>原始错误</h4><pre>${esc(e.error?json(e.error):'未记录错误；实际值以步骤及本次证据为准，不从预期推测')}</pre><h4>环境与角色依据</h4><pre>${esc(json(e.environment||null))}</pre><h4>固定身份</h4><pre>${esc(json(technical))}</pre>`,'technical')}
    <a href="#case-index" class="back-link">返回用例清单 ↑</a>
  </div></details></article>`;
}
const css=`
.screenshot-gallery>h4{margin-top:12px}.shot-step{border:1px solid var(--line);border-radius:9px;padding:16px;margin:16px 0;background:#fafcfd}.shot-step-heading{display:flex;align-items:center;gap:12px;margin-bottom:6px}.shot-step-heading h5{font-size:15px;margin:0}.shot-action{font-size:14px;margin-bottom:14px}.shot-pair,.other-shots{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.shot-card{margin:0;min-width:0;background:white;border:1px solid var(--line);border-radius:7px;overflow:hidden}.shot-card figcaption{font-weight:600;font-size:13px;padding:10px 12px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line)}.shot-card figcaption span{color:var(--teal);font-size:12px;font-weight:400}.shot-preview{display:block;cursor:zoom-in;width:100%;border:0;padding:10px;background:#edf2f5;border-radius:0}.shot-preview img{width:100%;height:200px;object-fit:contain;display:block}.shot-preview:hover{background:#e2eeeb}.shot-preview:focus-visible,.shot-close:focus-visible{outline:3px solid #007fbc;outline-offset:-3px}.shot-card.missing p{padding:22px 12px;color:var(--muted);font-size:13px;min-height:100px}.other-shots{margin:12px 0}.recording video{width:100%;max-height:600px;background:#101e27;display:block;margin:12px auto;object-fit:contain}.recordings .recording{padding:0 12px;background:#f5f8fa;border-radius:6px;margin:8px 0}.shot-viewer{position:fixed;inset:0;margin:auto;width:min(1500px,96vw);max-width:96vw;height:94vh;max-height:94vh;padding:0;border:1px solid #c3d1db;border-radius:10px;background:#fff;color:var(--ink);box-shadow:0 15px 80px #0006;overflow:hidden}.shot-viewer:popover-open{display:flex;flex-direction:column}.shot-viewer::backdrop{background:#101e27b8}.shot-viewer header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid var(--line);flex-shrink:0}.shot-viewer header p{font-size:12px;color:var(--muted)}.shot-close{font:inherit;cursor:pointer;border:1px solid var(--line);border-radius:6px;padding:8px 14px;background:#f4f7f9;white-space:nowrap}.shot-close span{font-size:12px;color:var(--muted);margin-left:8px}.shot-original{min-height:0;overflow:auto;flex:1;background:#e6edf1;text-align:center;padding:16px}.shot-original img{display:block;max-width:100%;height:auto;margin:0 auto}.shot-viewer footer{display:flex;align-items:center;gap:16px;padding:12px 20px;border-top:1px solid var(--line);flex-shrink:0}.shot-viewer footer span{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
@media(max-width:760px){.shot-pair,.other-shots{grid-template-columns:1fr}.shot-step{padding:12px}.shot-preview img{height:180px}.shot-viewer header{padding:10px}.shot-viewer header strong{font-size:14px}.shot-viewer footer{padding:10px}.shot-viewer footer span{display:none}.shot-original{padding:6px}}
@media print{.shot-viewer{display:none!important}}


:root{color-scheme:light;--ink:#183243;--muted:#5e7080;--line:#dce5eb;--teal:#087e70;--bg:#f3f6f8}
*{box-sizing:border-box}html{scroll-padding-top:80px}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 "Segoe UI","Microsoft YaHei",sans-serif}main{max-width:1240px;margin:32px auto;padding:0 28px 48px}
a{color:#066e63;text-underline-offset:3px}a:hover{text-decoration-thickness:2px}a:focus-visible,summary:focus-visible{outline:3px solid #007fbc;outline-offset:4px}h1,h2,h3,h4,p{margin:0}h1{font-size:30px;line-height:1.4;margin:12px 0 18px;overflow-wrap:anywhere}h2{font-size:21px}h4{font-size:15px;margin:0 0 8px}p{white-space:pre-wrap;overflow-wrap:anywhere}pre{font:13px/1.6 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6f8;padding:16px;border-radius:8px;max-height:440px;overflow:auto}
.cover{background:white;border:1px solid var(--line);border-top:5px solid var(--teal);border-radius:12px;padding:28px 32px}.eyebrow{color:var(--teal);font-weight:700;font-size:13px;letter-spacing:2px}.meta{display:flex;gap:12px 28px;flex-wrap:wrap;color:var(--muted);font-size:14px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:24px 0 16px}.metric{background:#f5f8fa;border:1px solid var(--line);border-radius:9px;padding:14px 18px}.metric span{display:block;color:var(--muted);font-size:13px}.metric strong{font-size:30px;font-weight:650;line-height:1.4}.metric.good strong{color:#08705c}.metric.bad strong{color:#b13838}.metric.warn strong{color:#986218}.count-detail{font-size:13px;color:var(--muted)}.notice{border-left:3px solid #d8a14c;background:#fff9ed;border-radius:0 6px 6px 0;padding:12px 16px;margin-top:16px;font-size:14px}.scope-note{color:var(--muted);font-size:13px;margin-top:10px}.muted,.sub{color:var(--muted);font-size:13px}.sub{display:block;margin-top:4px}
.report-nav{position:sticky;top:0;z-index:2;display:flex;gap:8px;padding:10px 0;background:var(--bg);border-bottom:1px solid var(--line);margin:14px 0 24px}.report-nav a{padding:8px 14px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600}.report-nav a:hover{background:#e3efed}.panel{background:white;border:1px solid var(--line);border-radius:10px;margin:20px 0;padding:24px}.section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:18px}.section-heading p{color:var(--muted);font-size:13px}
.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th{text-align:left;background:#f2f6f8;color:#506879;font-size:13px;font-weight:600;padding:12px 14px}td{padding:14px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}td a{font-weight:600}.index-table th:first-child{width:30%}.index-table th:nth-child(2){width:13%}.index-table th:nth-child(3){width:23%}.index-table th:last-child{width:34%}.case-id{display:block;font-size:12px;color:var(--muted);font-weight:500}
.badge{display:inline-block;border-radius:5px;padding:3px 9px;font-size:12px;font-weight:650;white-space:nowrap;background:#edf2f5;color:#526677}.badge.good{background:#e5f4ee;color:#09644f}.badge.bad{background:#fdecec;color:#ab2929}.badge.warn{background:#fff3dd;color:#865915}.badge.info{background:#eaf1fd;color:#2f5c99}.issue-list{list-style:none;padding:0;margin:0}.issue-list li{display:grid;grid-template-columns:minmax(180px,1fr) auto 2fr;gap:18px;padding:14px 0;border-bottom:1px solid var(--line)}.issue-list li:last-child{border:0}.issue-list p{font-size:14px}.empty{background:#f0f7f4;padding:16px;border-radius:8px;color:#226451}
.case{border:1px solid var(--line);border-radius:9px;margin:12px 0;overflow:clip;background:white}.case-detail>summary{list-style:none;padding:18px 20px}.case-detail>summary::-webkit-details-marker{display:none}.case-summary{display:flex;align-items:center;gap:14px}.case-summary>span:nth-child(2){flex:1;min-width:0}.case-summary strong{font-size:16px;overflow-wrap:anywhere}.detail-hint{font-size:12px;color:var(--teal);white-space:nowrap}.detail-hint:after{content:" ＋"}.case-detail[open] .detail-hint:after{content:" −"}summary{cursor:pointer;font-weight:600;padding:12px 0;overflow-wrap:anywhere}summary .muted{font-weight:400;margin-left:8px}details+details{border-top:1px solid var(--line)}.detail-body{padding:8px 0 16px}.case-detail>.detail-body{padding:0 22px 22px}.case-detail[open]>summary{border-bottom:1px solid var(--line);margin-bottom:16px}.case-verdict{display:flex;justify-content:space-between;gap:20px;font-size:14px}.context-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.context-grid>div{background:#f5f8fa;padding:16px;border-radius:7px}.context-grid p{font-size:14px}
.steps{font-size:14px}.steps th:first-child{width:7%}.steps th:nth-child(2){width:28%}.steps th:nth-child(3){width:32%}.steps th:nth-child(4){width:33%}.steps tr.bad td:last-child{background:#fff1f1;color:#9b2828}.technical{font-size:13px;color:var(--muted)}.technical h4{color:var(--ink)}.attachment{border-top:1px solid var(--line);padding:16px 0}.attachment img,.attachment video{display:block;max-width:100%;max-height:620px;object-fit:contain;margin:14px auto;background:#101e27;border-radius:6px}.button{display:inline-block;padding:7px 14px;border:1px solid var(--line);border-radius:6px;text-decoration:none;font-size:13px}.back-link{display:inline-block;margin-top:12px;font-size:13px}.scope-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.scope-card{border:1px solid var(--line);border-radius:7px;padding:18px}.scope-card p{font-size:13px;margin:6px 0}.scope-card h3{font-size:16px;overflow-wrap:anywhere}.footer{color:var(--muted);font-size:12px;margin-top:28px;overflow-wrap:anywhere}:target{scroll-margin-top:80px;outline:2px solid #087e70;outline-offset:3px}
@media(max-width:760px){main{padding:0 14px 28px;margin:16px auto}.cover,.panel{padding:20px 16px}h1{font-size:24px}.metrics{grid-template-columns:repeat(3,1fr);gap:8px}.metric{padding:10px}.metric strong{font-size:26px}.report-nav{gap:0;flex-wrap:wrap}.report-nav a{padding:8px;font-size:13px}.section-heading,.case-verdict{display:block}.index-table{min-width:720px}.issue-list li{grid-template-columns:1fr auto;gap:8px}.issue-list p{grid-column:1/-1}.context-grid{grid-template-columns:1fr}.case-summary{align-items:flex-start;flex-wrap:wrap}.detail-hint{display:none}.case-detail>.detail-body{padding:0 14px 18px}.steps thead{display:none}.steps tr,.steps td{display:block;width:100%}.steps tr{border-bottom:2px solid var(--line);padding:10px 0}.steps td{border:0;padding:7px}.steps td:before{content:attr(data-label);display:block;font-size:12px;color:var(--muted)}}
@media print{body{background:white;font-size:10pt}main{max-width:none;padding:0;margin:0}.cover,.panel,.case{box-shadow:none;border-radius:0}.cover{padding:16px}.panel{padding:14px 0;border:0}.report-nav,.back-link,.detail-hint,.media,.technical{display:none!important}.metrics{gap:6px;margin:12px 0}.metric{padding:8px}.metric strong{font-size:22px}h1{font-size:23px}h2{font-size:17px}.case-detail::details-content{content-visibility:visible!important;display:block!important}.case-detail>.detail-body{display:block!important}.case-detail>summary{padding:12px 0}.case-detail>.detail-body{padding:0 10px 12px}.context-grid{gap:10px;margin:10px 0}tr,img,.metric,.scope-card{break-inside:avoid}h2,h3,h4,summary{break-after:avoid}.table-wrap{overflow:visible}thead{display:table-header-group}pre{max-height:none}.badge{border:1px solid currentColor}a{color:inherit;text-decoration:none}.notice{margin-top:10px}.footer{margin-top:14px}}
`;
export function renderReport(r) {
  const entries=r.entries||[], c=r.counts||{}, groups=r.groups||[];
  const indexed=entries.map((e,i)=>({e,i,g:groups.find(g=>g.group_key===e.group_key)}));
  const issues=indexed.filter(({e})=>attention(e,r));
  const ordered=[...indexed].sort((a,b)=>Number(attention(b.e,r))-Number(attention(a.e,r)));
  const unit=r.scope==='batch'?'批次条目':r.scope==='run'?'本次运行':r.group_key==='all'?'用例×范围条目':'当前用例';
  const metric=(name,n,cls='')=>`<div class="metric ${cls}"><span>${name}</span><strong>${esc(n??0)}</strong></div>`;
  const summary=`${unit} ${c.requested??0} · 已执行 ${c.executed??0} · 通过 ${c.passed??0} · 失败 ${c.failed??0} · 未执行 ${c.not_run??0}`;
  const extra=[['running','执行中'],['incomplete','证据不完整'],['blocked','阻塞'],['cancelled','取消'],['interrupted','中断']].filter(([k])=>c[k]).map(([k,n])=>`${n} ${c[k]}`).join(' · ');
  const pending=entries.filter(e=>!e.review?.requirements_status||e.review.requirements_status==='PENDING').length;
  const scopeCards=groups.length?groups.map((g,i)=>`<div class="scope-card"><h3>范围 ${i+1} · ${esc(g.scope?.environment_name||g.scope?.target_url||'环境未记录')}</h3><p>地址：${esc(g.scope?.target_url||'未记录')}</p><p>角色：${esc(g.scope?.role||'未记录')} · 软件版本：${esc(g.scope?.software_version||'未记录')}</p><p>本组 ${esc(g.counts?.requested)} 条 · 通过 ${esc(g.counts?.passed)} · 失败 ${esc(g.counts?.failed)} · 未执行 ${esc(g.counts?.not_run)}</p>${!g.scope?.configuration_sha256?'<p class="muted">配置版本未记录，无法证明历史记录使用同一配置。</p>':''}${fold('范围身份与完整统计',`<pre>${esc(json({group_key:g.group_key,scope:g.scope,counts:g.counts}))}</pre>`,'technical')}</div>`).join(''):'<p class="muted">环境依据保存在各用例的技术详情中。</p>';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src data:; base-uri 'none'"><title>${esc(r.project.name)} · ${r.scope==='project_latest'?'全项目最新测试结果':'测试报告'}</title><style>${css}</style></head><body><main id="overview">
<header class="cover"><div class="eyebrow">测试执行报告</div><h1>${esc(r.project.name)}</h1><div class="meta"><span>范围：${scopeName(r)}</span><span>生成：${esc(time(r.created_at))}（北京时间）</span></div><div class="metrics">${metric(unit,c.requested)}${metric('已执行',c.executed)}${metric('执行通过',c.passed,'good')}${metric('执行未通过',c.failed,c.failed?'bad':'')}${metric('未执行',c.not_run,c.not_run?'warn':'')}</div><p class="count-detail">${esc(summary)}${extra?` · ${esc(extra)}`:''}</p><p class="scope-note">${scopeNote(r)}${r.scope==='batch'?' 未开始的阻塞、取消项计入未执行；超时、执行异常或执行后取消计入执行未通过。':''}${c.incomplete?' 证据不完整可能与执行失败重叠，不参与加总。':''}</p><p class="notice">执行结果与业务验收分别核对。${pending?`本报告有 ${pending} 条要求尚未核对。`:'要求核对状态见各用例。'}后续复测不会改变这份固定报告。</p></header>
<nav class="report-nav" aria-label="报告目录"><a href="#overview">结果概览</a><a href="#attention">需关注项 ${issues.length}</a><a href="#case-index">用例清单</a><a href="#cases">步骤与证据</a><a href="#scopes">测试范围</a></nav>
<section class="panel" id="attention"><div class="section-heading"><h2>需关注项</h2><p>优先查看失败、未执行与证据缺失</p></div>${issues.length?`<ul class="issue-list">${issues.map(({e,i})=>`<li><a href="#case-${i}"><span class="case-id">${esc(e.external_id)}</span>${esc(e.title)}</a><div>${badge(statusOf(e,r))}</div><p>${esc(noteFor(e,r))}</p></li>`).join('')}</ul>`:'<p class="empty">本报告未发现执行失败、未执行或证据不完整的条目；要求核对状态请看用例清单。</p>'}</section>
<section class="panel" id="case-index"><div class="section-heading"><h2>用例清单</h2><p>点击名称定位详情；需关注的用例排在前面</p></div><div class="table-wrap"><table class="index-table"><thead><tr><th>测试用例</th><th>执行结果</th><th>范围 / 要求核对</th><th>本次说明</th></tr></thead><tbody>${ordered.map(({e,i,g})=>`<tr><td><a href="#case-${i}"><span class="case-id">${esc(e.external_id)} · v${esc(e.case_version)} · ${esc(label(e.case_type||e.content?.case_type))}</span>${esc(e.title)}</a></td><td>${badge(statusOf(e,r))}${statusOf(e,r)!==e.result?`<span class="sub">原始执行：${esc(label(e.result))}</span>`:''}</td><td>${g?`范围 ${groups.indexOf(g)+1}`:esc(e.software_version||'软件版本未记录')}<span class="sub">要求核对：${esc(label(e.review?.requirements_status||'未核对'))}</span></td><td>${esc(noteFor(e,r))}</td></tr>`).join('')||'<tr><td colspan="4">此范围没有用例</td></tr>'}</tbody></table></div></section>
<section id="cases"><div class="section-heading"><h2>步骤与证据</h2><p>通过项点击展开；失败与未执行项默认展开</p></div>${ordered.map(({e,i,g})=>entryHtml(e,i,r,g)).join('')}</section>
<section class="panel" id="scopes"><div class="section-heading"><h2>测试范围</h2><p>各范围保留自己的环境、角色与版本</p></div><div class="scope-cards">${scopeCards}</div></section>
<footer class="footer"><p>固定快照 · ${esc(r.report_id)} · 选取截止 ${esc(time(r.cutoff_at||r.created_at))}（北京时间）</p><p>已携带的截图、录像和附件可离线查看；未携带项在用例证据中列明。运行通过不等于产品验收通过。</p>${fold('报告生成服务身份',`<pre>${esc(json({report_service_identity:r.report_service_identity||null,scope:r.scope,group_key:r.group_key,batch_id:r.batch_id,run_id:r.run_id,counts:r.counts}))}</pre>`,'technical')}</footer>
</main></body></html>`;
}

