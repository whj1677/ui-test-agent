import { esc } from './workflow.js';
import { api } from './api.js';
import { nativeDshDiagnosticsHtml } from './native-dsh.js';
import { executionSteps, stepResultLabel, stepOutcomeNotice, executionMediaFiles, executionMediaUrl, windowRecordingNoticeHtml, enhanceMedia } from './execution-media.js';

const date = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '时间未记录';
const result = value => ({ PASSED: '运行通过', FAILED: '失败', TIMEDOUT: '超时', TIMED_OUT: '超时', RUNNING: '运行中', NOT_RUN: '未执行', CANCELLED: '已取消', INTERRUPTED: '已中断', PARTIAL:'部分完成', BLOCKED:'已阻塞', STOPPING:'正在停止', STOP_UNCONFIRMED:'停止未确认' }[value] || value || '结果未知');
const failedStatus = status => ['FAILED','TIMEDOUT','TIMED_OUT'].includes(status);
const terminalTask = status => ['COMPLETED','PARTIAL','FAILED','CANCELLED','INTERRUPTED','TIMED_OUT','TIMEDOUT','BLOCKED'].includes(status);
const sha = value => String(value || '').toLowerCase();
const identity = row => `${row.case_id}:${row.case_version}:${sha(row.content_sha256)}`;
const formal = row => row.purpose === 'case' && row.counts_for_case === true && ['CURRENT', 'HISTORICAL'].includes(row.binding_status);
const latestFirst = (a, b) => String(b.finished_at || b.started_at || b.created_at || '').localeCompare(String(a.finished_at || a.started_at || a.created_at || '')) || String(b.run_id).localeCompare(String(a.run_id));
const caseHref = (project, row, tab = 'results') => `#/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(row.case_id)}?version=${encodeURIComponent(row.case_version)}&tab=${tab}${tab === 'results' ? `&native_run=${encodeURIComponent(row.run_id || row.latest_run_id || '')}` : ''}`;
const executionName = row => row.kind === 'REGISTER_EXISTING_DRAFT' ? (row.status === 'COMPLETED' ? '登记完成 · 未运行' : '仅登记现有稿件') : row.execution_kind === 'FROZEN_SCRIPT_RERUN' || row.kind === 'FROZEN_SCRIPT_RERUN' ? '原脚本复跑' : '原生 DSH 自测';
const evidenceLabel = row => {
  const coverage=nativeAssertionCoverage(row);
  return row.evidence_status==='COMPLETE' && coverage.total && !coverage.missing ? '采集完整' : coverage.missing ? `断言实际 ${coverage.actual}/${coverage.total} · 采集不完整` : row.evidence_status==='INCOMPLETE'?'采集不完整':row.evidence_status?'断言覆盖待核验':'历史记录未登记步骤采集';
};

export async function loadNativeConsole(project, api, options = {}) {
  try {
    const {caseId, caseVersion, ...requestOptions} = options;
    const query = new URLSearchParams({view:'summary'});
    if(caseId)query.set('case_id',caseId);
    if(caseVersion != null)query.set('case_version',String(caseVersion));
    const data = await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/native-dsh/console?${query}`, requestOptions);
    if (data?.project_id !== project.project_id) throw Error('DSH_PROJECT_MISMATCH');
    return data;
  } catch (error) {
    return { project_id: project.project_id, scripts: [], records: [], tasks: [], load_error: error.message || '读取失败' };
  }
}

// Version and content identity are both required. A later diagnostic can never replace a case result.
export function nativeConsoleModel(project, data, { caseId, version, currentOnly = false, taskId } = {}) {
  const owns = row => row.project_id === project.project_id;
  const matches = row => {
    if (!owns(row) || (taskId && row.task_id !== taskId && !row.task_ids?.includes(taskId))) return false;
    if (caseId && row.case_id !== caseId) return false;
    if (version && (Number(row.case_version) !== Number(version.version) || sha(row.content_sha256) !== sha(version.content_sha256))) return false;
    if (currentOnly) {
      const item = project.cases?.find(item => item.case_id === row.case_id);
      const current = item?.versions?.find(v => Number(v.version) === Number(item.current_version));
      if (!current || Number(row.case_version) !== Number(current.version) || sha(row.content_sha256) !== sha(current.content_sha256)) return false;
    }
    return true;
  };
  const allScripts = (data.scripts || []).filter(owns).filter(row => row.source?.available !== false && formal(row)).map(row => ({...row}));
  const versions = new Map();
  for (const row of [...allScripts].sort((a, b) => String(a.created_at || a.started_at).localeCompare(String(b.created_at || b.started_at)) || String(a.script_id).localeCompare(String(b.script_id)))) {
    const key = identity(row), number = (versions.get(key) || 0) + 1;
    versions.set(key, number); row.display_version = `D${number}`;
  }
  const scripts = allScripts.filter(matches);
  const records = (data.records || []).filter(matches).sort(latestFirst);
  const cases = records.filter(formal), excluded = records.filter(row => !formal(row));
  const latest = [...new Map(records.filter(row => row.purpose === 'case' && ['CURRENT','HISTORICAL'].includes(row.binding_status)).reverse().map(row => [identity(row), row])).values()].sort((a, b) => String(a.external_id).localeCompare(String(b.external_id)));
  const drafts = (data.drafts || []).filter(matches).sort(latestFirst);
  return { scripts, records, drafts, cases, excluded, latest, tasks: data.tasks || [], load_error: data.load_error, passed: latest.filter(row => formal(row) && row.status === 'PASSED').length, failed: latest.filter(row => formal(row) && failedStatus(row.status)).length };
}

export function nativeTaskProgress(task, records = []) {
  const own=records.filter(row=>row.task_id===(task.task_id||task.id) && formal(row));
  return {terminal:terminalTask(task.status),locked:task.status==='STOP_UNCONFIRMED',count:own.length,
    passed:own.filter(row=>row.status==='PASSED').length,failed:own.filter(row=>failedStatus(row.status)).length};
}

function safeArtifactUrl(project, value) {
  const prefix = `/api/case-library/projects/${encodeURIComponent(project.project_id)}/native-dsh/tasks/`;
  const imported = `/api/case-library/projects/${encodeURIComponent(project.project_id)}/imported-scripts/`;
  if(typeof value==='string'&&value.startsWith(imported)&&/^[\w-]+\/\d+\/imported-script-[a-f0-9]{64}\/files\/(?:manifest|\d+)$/.test(value.slice(imported.length)))return value;
  return typeof value === 'string' && value.startsWith(prefix) && value.includes('/files/') && !/[<>"\s]/.test(value) ? value : '';
}
function artifactLink(project, artifact) {
  const url = safeArtifactUrl(project, artifact.url);
  return url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(artifact.name || artifact.kind || '证据文件')}</a>` : '<span>证据地址不可用</span>';
}
function sourceHtml(project, row) {
  const url = safeArtifactUrl(project, row.script_url || row.source?.script_url);
  if (!url || row.source?.available === false) return `<p class="notice warning">冻结脚本不可读取：${esc(row.source?.reason || '没有可核验的脚本文件')}。${row.draft_id ? '稿件登记保留，未执行。' : '原运行状态保留，不计入可信用例通过。'}</p>`;
  return `<details class="native-script-source"><summary>查看冻结脚本内容</summary><p><button type="button" class="button small" data-native-source="${esc(url)}">载入脚本内容</button> <a href="${esc(url)}" target="_blank" rel="noreferrer">打开脚本文件</a></p><pre data-native-source-content tabindex="0">点击载入，读取${row.draft_id ? '登记时' : '本次运行'}冻结的脚本。</pre></details>`;
}
const valueText = value => typeof value === 'string' ? (value === '' ? '""' : value) : value === undefined ? '未单独采集可信实际值' : JSON.stringify(value, null, 2);
const trustedValue = value => ['PLAYWRIGHT_MATCHER_RESULT','PLAYWRIGHT_MATCHER_ARGUMENTS','PLAYWRIGHT_SOFT_MATCHER_ARGUMENTS','PLAYWRIGHT_LOCATOR_OBSERVATION'].includes(value?.value_source) && value.actual_present !== false && value.actual_recorded !== false && Object.hasOwn(value,'actual') && value.actual !== undefined;
export function nativeAssertionCoverage(run) {
  if(run.evidence_deferred && run.assertion_coverage)return run.assertion_coverage;
  const assertions=(run.step_replay?.steps || []).flatMap(step=>step.assertions || []);
  const actual=assertions.filter(trustedValue).length;
  return {total:assertions.length,actual,missing:assertions.length-actual};
}
const observationLabel = data => data.value_source==='PLAYWRIGHT_LOCATOR_OBSERVATION' ? '断言结束后 DOM 实测' : data.value_source==='PLAYWRIGHT_MATCHER_RESULT' ? '原断言返回值' : '原断言实参';
const propertyLabel = matcher => ({toHaveText:'显示文字',toHaveValue:'字段值',toHaveClass:'样式类',toHaveCount:'匹配元素数',toBeVisible:'是否可见',toBe:'文本断言',toMatch:'文本匹配',toContain:'文本包含'}[matcher] || matcher);
const expectedText = a => a.expected_present!==false ? valueText(a.assertion_expected) : ({toBeVisible:'可见',toBeTruthy:'为真',toBeFalsy:'为假',toBeDefined:'已定义',toBeUndefined:'未定义',toBeNull:'空值'}[a.matcher_name] || '匹配器无显式预期参数');
function actualPairsHtml(assertions) {
  return `<div class="native-observation-table"><table><thead><tr><th>页面 / 文本观测</th><th>断言预期</th><th>实际值</th><th>结果</th></tr></thead><tbody>${assertions.map(a=>`<tr><td>${esc(a.target_label || a.message || propertyLabel(a.matcher_name))}<small>${esc(observationLabel(a))}</small></td><td>${esc(expectedText(a))}${a.is_not?'（不应匹配）':''}</td><td>${esc(a.matcher_name==='toBeVisible'?(a.actual?'可见':'不可见'):valueText(a.actual))}${a.display_value?`<small>显示：${esc(a.display_value)}</small>`:''}</td><td>${esc(result(a.status))}</td></tr>`).join('')}</tbody></table></div>`;
}
export function nativeStepActualHtml(step) {
  const assertions=step.assertions || [],available=assertions.filter(trustedValue);
  const page=available.filter(a=>a.value_source==='PLAYWRIGHT_LOCATOR_OBSERVATION');
  const main=available.filter(a=>a.value_source==='PLAYWRIGHT_LOCATOR_OBSERVATION'?['toHaveText','toBeVisible'].includes(a.matcher_name):typeof a.actual==='string');
  const extra=page.filter(a=>!main.includes(a));
  const missing=assertions.length-available.length;
  return `<div class="native-step-actual"><h5>本步实际观测 <span>${available.length}/${assertions.length} 条断言有实际值</span></h5>${main.length?`<p class="muted">页面文字、文本实参与可见性，按断言顺序排列。</p>${actualPairsHtml(main)}`:available.length?'<p>本步没有独立的页面文字观测，请核对下方数据断言；不使用任意一条值代表整步预期。</p>':'<p class="notice warning">本步未采集可信实际值。</p>'}${extra.length?`<details class="native-field-observations"><summary>字段、数量和属性观测（${extra.length}）</summary>${actualPairsHtml(extra)}</details>`:''}${missing?`<p class="notice warning">${missing} 条断言实际值未采集；步骤执行结论保留，证据不完整。</p>`:''}<p class="muted">DOM 值在原断言结束后只读采集，时点见明细；不用于重新判定断言。</p></div>`;
}
export function nativePrimaryActualLabel(step) {
  const count=step.assertions?.length || 0,index=step.primary_assertion_index,source=step.actual_source_assertion;
  if(!trustedValue(step))return `${count?`本步骤保留 ${count} 条断言明细；`:''}当前主值未取得可信实测来源。`;
  if(!source || !Number.isInteger(index) || index<0 || index>=count)return '主值与具体断言的关联未登记，请展开全部断言核对。';
  const assertion=step.assertions[index],matcher=`${assertion?.is_not?'not.':''}${source.matcher_name || assertion?.matcher_name || assertion?.matcher || '未记录'}`;
  return `主卡实际值来自第 ${index+1}/${count} 条断言：${matcher}${source.message?' · '+source.message:''}。其余断言请展开明细核对。`;
}
export function nativeAssertionDetails(step, run) {
  const coverage=run.step_coverage?.items?.find(item=>Number(item.order)===Number(step.order));
  const assertions=step.assertions || coverage?.assertions || coverage?.attributed_assertions?.map(item=>item.assertion || item) || [];
  if(!assertions.length)return '<p class="muted">本步骤未采集逐条断言明细；不以整例结果补充步骤覆盖。</p>';
  return `<details class="native-assertions"><summary>本步骤断言明细（${assertions.length}）</summary>${assertions.map(assertion=>{
    const data=assertion.error?.value_source?{...assertion,...assertion.error}:assertion;
    const location=data.location || data.source_location;
    const where=typeof location==='string'?location:location?`${location.file || ''}:${location.line || ''}:${location.column || ''}`:'未采集';
    const matcher=`${data.is_not?'not.':''}${data.matcher || data.matcher_name || '未记录'}`;
    const hasExpected=data.expected_present===true || data.expected_present!==false && (Object.hasOwn(data,'assertion_expected') || Object.hasOwn(data,'expected'));
    const expected=hasExpected?valueText(Object.hasOwn(data,'assertion_expected')?data.assertion_expected:data.expected):data.expected_present===false?`匹配器语义 ${matcher}（无显式预期参数）`:'断言预期参数未采集';
    return `<article><strong>${esc(data.title || data.message || data.name || matcher || '原脚本断言')}</strong><dl><dt>匹配器 / 状态</dt><dd>${esc(matcher)}${data.is_soft?' · soft':''} · ${esc(result(data.status || data.execution_status))}</dd><dt>脚本断言预期</dt><dd>${esc(expected)}</dd><dt>可信实际</dt><dd>${esc(trustedValue(data)?valueText(data.actual):`未单独采集可信实际值${data.value_unavailable_reason?' · '+data.value_unavailable_reason:''}`)}</dd><dt>采集来源</dt><dd>${esc(trustedValue(data)?observationLabel(data):'缺少可信实测来源')}${data.observed_at?` · ${esc(date(data.observed_at))}`:''}</dd>${data.target?`<dt>观测定位器</dt><dd>${esc(data.target)}</dd>`:''}<dt>源码位置</dt><dd>${esc(where)}</dd></dl></article>`;
  }).join('')}</details>`;
}
export function nativeMediaRun(project, row) {
  const fileKind = file => file.kind?.endsWith('_video') || file.kind?.endsWith('_screenshot') || file.kind?.endsWith('_trace') ? file.kind
    : /screenshot|image\//.test(`${file.kind || ''} ${file.content_type || ''}`) || /\.(png|jpe?g)$/i.test(file.name || '') ? 'trial_screenshot'
      : /video\//.test(file.content_type || '') || /\.(webm|mp4)$/i.test(file.name || '') ? 'trial_video'
        : /trace/i.test(file.kind || file.name || '') ? 'trial_trace' : file.kind || 'artifact';
  const files = (row.files?.length ? row.files : row.artifacts || []).map(file => ({
    ...file, file_id: file.file_id || file.id, file_name: file.file_name || file.name, kind: fileKind(file),
    artifact_url: safeArtifactUrl(project, file.artifact_url || file.url),
  })).filter(file => file.file_id && file.artifact_url);
  const item = project.cases?.find(item => item.case_id === row.case_id);
  const original = item?.versions?.find(version => Number(version.version) === Number(row.case_version) && sha(version.content_sha256) === sha(row.content_sha256));
  const run = {...row, origin:'NATIVE_DSH',project_id:project.project_id,candidate_sha256:row.candidate_sha256 || row.script_sha256,files,
    unbound_observations:row.unbound_observations || row.unbound_assertions || row.step_replay?.unbound_assertions,
    frozen_case_content:row.frozen_case_content || original?.content};
  const collected = executionSteps(run);
  const originalSteps = run.frozen_case_content?.steps || [];
  const merged = originalSteps.length ? originalSteps.map(source => {
    const step = collected.find(step => Number(step.order) === Number(source.order));
    return step ? {...step,action:source.action,expected:source.expected} : {step_id:`CASE_STEP_${source.order}`,order:source.order,action:source.action,expected:source.expected,execution_status:'MISSING',actual:'未单独采集可信实际值',actual_recorded:false};
  }) : collected;
  // Preserve machine-captured source metadata; never promote whole-case PASS into step PASS.
  run.step_replay = {...run.step_replay,status:run.step_replay?.status || 'UNAVAILABLE',reason:run.step_replay?.reason || 'LEGACY_STEP_CAPTURES_UNAVAILABLE',steps:merged};
  return run;
}
function nativeEvidenceIssuesHtml(row) {
  const reasons = [
    row.evidence_mapping?.reason ? `步骤映射：${row.evidence_mapping.reason}` : '',
    ...(row.evidence_errors || []).map(error => `采集错误：${typeof error === 'string' ? error : JSON.stringify(error)}`),
    row.step_replay?.status !== 'READY' && row.step_replay?.reason ? `步骤回放：${row.step_replay.reason}` : '',
    row.window_timeline?.status !== 'VERIFIED' && row.window_timeline?.reason ? `整窗同步：${row.window_timeline.reason}` : '',
  ].filter(Boolean);
  if (reasons.length) return `<div class="notice warning native-evidence-issues" role="status"><strong>证据不足原因</strong><ul>${[...new Set(reasons)].map(reason => `<li>${esc(reason)}</li>`).join('')}</ul></div>`;
  return row.evidence_mapping ? `<details class="native-evidence-mapping"><summary>步骤采集映射</summary><pre>${esc(JSON.stringify(row.evidence_mapping,null,2))}</pre></details>` : '';
}
export function nativeEvidenceHtml(project, row) {
  const run = nativeMediaRun(project,row), steps = executionSteps(run), files = executionMediaFiles(run);
  const replay = run.step_replay?.status === 'READY' ? files.replay : null;
  const trace = run.files.find(file=>file.kind.endsWith('_trace'));
  const outcome = stepOutcomeNotice(run,steps);
  const cards = steps.map(step=>`<li class="execution-step" data-step-id="${esc(step.step_id)}"><button type="button" class="execution-step-select" data-step-seek="${esc(step.step_id)}" disabled>${esc(step.order)}. ${esc(step.action)}</button><span class="badge ${step.execution_status==='PASSED'&&step.actual_recorded!==false?'success':step.execution_status==='FAILED'?'danger':'warning'}">${esc(step.execution_status==='PASSED'&&step.actual_recorded===false?'步骤执行通过 · 实际值未采集':stepResultLabel(step,run)||'步骤结论未核验')}</span><dl class="native-original-expected"><dt>原用例预期</dt><dd>${esc(step.expected||'原步骤预期未取得')}</dd></dl>${nativeStepActualHtml(step)}${nativeAssertionDetails(step,run)}</li>`).join('');
  const mediaData = {...run,artifacts:undefined,error:undefined,source:undefined};
  return `<section class="native-run-evidence execution-detail" data-native-media="${esc(JSON.stringify(mediaData))}"><h4>步骤结果与同步录像</h4><p class="notice ${run.evidence_status==='COMPLETE'&&!nativeAssertionCoverage(run).missing?'':'warning'}">证据状态：${esc(evidenceLabel(run))}；${nativeAssertionCoverage(run).actual}/${nativeAssertionCoverage(run).total} 条断言有可信实际值。执行结果与证据完整性分别核对。</p>${nativeEvidenceIssuesHtml(row)}${windowRecordingNoticeHtml(run)}${outcome?`<p class="notice danger">${esc(outcome)}</p>`:''}<div class="execution-evidence-layout"><div class="execution-media"><h4>本次运行媒体</h4>${replay?`<video data-testid="execution-video" controls preload="metadata" src="${esc(executionMediaUrl(run,replay.file_id))}"></video>`:''}${!files.window&&!files.original&&!replay?'<p class="notice warning">此运行没有可用录像；不会补造历史录像或步骤时间。</p>':''}${trace?`<a href="${esc(executionMediaUrl(run,trace.file_id))}" target="_blank" rel="noreferrer">下载本次 Trace</a>`:'<p>Trace 未采集</p>'}</div><div class="execution-steps"><h4>原用例步骤与本次实际</h4><p id="execution-playing-step">播放位置：尚未播放</p><ol>${cards||'<li>此记录未取得可核对的原步骤与步骤采集。</li>'}</ol></div></div>${run.unbound_observations?.length?`<details><summary>未绑定原步骤的观测（${run.unbound_observations.length}，不计步骤通过）</summary><pre>${esc(JSON.stringify(run.unbound_observations,null,2))}</pre></details>`:''}<details class="native-evidence"><summary>原始证据文件（${(row.artifacts||[]).length}）</summary><ul>${(row.artifacts||[]).map(file=>`<li>${artifactLink(project,file)}</li>`).join('')}</ul></details></section>`;
}
function runHtml(project, row, selectedRunId) {
  const counted = formal(row), label = counted ? `正式用例 · ${executionName(row)}` : row.purpose === 'diagnostic' ? '诊断执行 · 不计用例结果' : '未核验记录 · 不计用例结果';
  if(row.evidence_deferred){
    const endpoint=`/api/case-library/projects/${encodeURIComponent(project.project_id)}/native-dsh/console?run_id=${encodeURIComponent(row.run_id)}`;
    return `<details class="native-run" data-native-run="${esc(row.run_id)}" data-native-detail="${esc(endpoint)}" data-native-project="${esc(project.project_id)}" ${selectedRunId===row.run_id?'open':''}><summary><strong>${esc(row.external_id)} · ${esc(result(row.status))}</strong> · ${esc(date(row.started_at))} · ${label}</summary><div class="panel-body" data-native-detail-body><p>展开后读取本次完整步骤、实际值和同步录像，并重新核验冻结文件。</p><button type="button" class="button" data-native-detail-retry>载入本次证据</button></div></details>`;
  }
  return `<details class="native-run" data-native-run="${esc(row.run_id)}" ${selectedRunId === row.run_id ? 'open' : ''}><summary><strong>${esc(row.external_id)} · ${esc(result(row.status))}</strong> · ${esc(date(row.started_at))} · ${label}</summary><div class="panel-body"><p>用例 v${esc(row.case_version)} · ${esc(executionName(row))} · 人工首审未登记</p>${row.error ? `<pre>${esc(typeof row.error === 'string' ? row.error : JSON.stringify(row.error, null, 2))}</pre>` : ''}${nativeEvidenceHtml(project,row)}<p><a data-nav href="${caseHref(project, row, 'scripts')}">查看此用例脚本</a></p>${sourceHtml(project, row)}<details><summary>运行与冻结版本身份</summary><dl><dt>运行</dt><dd><code>${esc(row.run_id)}</code></dd><dt>任务</dt><dd><code>${esc(row.task_id)}</code></dd><dt>用例内容 SHA-256</dt><dd><code>${esc(row.content_sha256)}</code></dd><dt>脚本 SHA-256</dt><dd><code>${esc(row.script_sha256)}</code></dd><dt>文件包 SHA-256</dt><dd><code>${esc(row.bundle_sha256)}</code></dd></dl></details></div></details>`;
}
export function nativeScriptAvailability(model) {
  const hasScripts = model.scripts.length > 0, hasHistory = model.records.length > 0, hasDrafts = Boolean(model.drafts?.length);
  return {
    hasScripts, hasHistory, hasDrafts, hasRerunnableScripts:nativeRerunGroups(model).length>0,
    label: hasScripts ? 'DSH 已有脚本（下方查看）' : model.load_error ? 'DSH 状态未取得' : hasDrafts ? 'DSH 已登记稿件 · 未执行' : hasHistory ? '已有历史记录 · 冻结脚本待核验' : '尚未生成',
    notice: hasDrafts ? 'DSH 已登记稿件，可查看冻结正文及前置阻塞原因；尚未执行，不计用例通过，也没有执行证据。' : hasHistory && !hasScripts ? '已有 DSH 历史记录，冻结脚本不可读取或尚待核验。原运行状态及失败记录保留，请在结果与证据中核对；这不表示脚本从未生成。' : '',
  };
}
export function nativeDraftsHtml(project, drafts = []) {
  if (!drafts.length) return '';
  return `<section class="panel native-console native-drafts"><div class="panel-header"><h2>DSH 已登记稿件</h2><span>${drafts.length} 个冻结稿件</span></div><div class="panel-body"><p>以下保留稿件登记时的状态，不代表执行或审核通过；后续复跑结果与证据见“DSH 结果与证据”。导入稿保留源文件与依赖，登记本身仍为未执行、未首审。前置阻塞原因来自 DSH 报告，尚未独立核验。</p>${drafts.map(row => `<details data-native-draft="${esc(row.draft_id)}"><summary>${esc(row.external_id)} · 用例 v${esc(row.case_version)} · ${row.origin === 'IMPORTED_SCRIPT' ? '导入脚本 · 登记时未执行' : row.draft_status === 'BLOCKED_PRECONDITION' ? '前置阻塞 · 未执行' : '稿件已登记 · 未执行'} · ${esc(date(row.created_at))}</summary><p>${esc(row.title || '')}</p>${row.blocker ? `<p class="notice warning">DSH 报告：${esc(row.blocker.code)} · ${esc(row.blocker.summary)}</p>` : ''}${sourceHtml(project, row)}${row.origin==='IMPORTED_SCRIPT'?`<details class="imported-script-files"><summary>脚本与依赖（${row.artifacts.length} 个文件）</summary><ul>${row.artifacts.map(file=>`<li>${artifactLink(project,file)} · ${file.bytes} 字节</li>`).join('')}</ul></details>`:''}<details><summary>稿件冻结身份（历史只读）</summary><pre>${esc(JSON.stringify({draft_id:row.draft_id,task_id:row.task_id,entry:row.entry,content_sha256:row.content_sha256,script_sha256:row.script_sha256,bundle_sha256:row.bundle_sha256,provenance:row.provenance},null,2))}</pre></details></details>`).join('')}</div></section>`;
}
export function nativeRerunSelection(row) {
  if(row.origin==='IMPORTED_SCRIPT'||row.source_kind==='IMPORTED_SCRIPT'&&!row.run_id&&!row.latest_run_id)return {
    source_kind:'IMPORTED_SCRIPT',source_draft_id:row.draft_id||row.source_draft_id,case_id:row.case_id,case_version:row.case_version,
    content_sha256:row.content_sha256,script_sha256:row.script_sha256,bundle_sha256:row.bundle_sha256,
    ...(row.environment_identity?{environment_identity:row.environment_identity}:{})};
  return {source_task_id:row.task_id,source_run_id:row.latest_run_id || row.run_id,case_id:row.case_id,case_version:row.case_version,
    content_sha256:row.content_sha256,script_sha256:row.script_sha256,bundle_sha256:row.bundle_sha256};
}
export function nativeRerunItems(rows) {
  if (!rows.length || rows.length > 20) throw Error('请选择 1–20 条用例的已有冻结脚本。');
  const cases = new Set();
  return rows.map(row=>{
    const item = nativeRerunSelection(row);
    if ((item.source_kind==='IMPORTED_SCRIPT'?!/^imported-script-[a-f\d]{64}$/.test(item.source_draft_id||''):!item.source_task_id || !item.source_run_id) || !item.case_id || !Number.isInteger(Number(item.case_version)) || Number(item.case_version)<1 ||
      !['content_sha256','script_sha256','bundle_sha256'].every(key=>/^[a-f\d]{64}$/i.test(item[key] || ''))) throw Error('冻结脚本身份不完整，请刷新后核对。');
    if (cases.has(item.case_id)) throw Error('同一用例只能选择一个已有脚本版本。');
    cases.add(item.case_id); return item;
  });
}
export function nativeRerunGroups(model){
  const imported=(model.drafts||[]).filter(row=>row.origin==='IMPORTED_SCRIPT'&&row.binding_status==='CURRENT'&&row.source?.available===true)
    .map(row=>({...row,source_kind:'IMPORTED_SCRIPT',status:'NOT_RUN',display_version:`导入稿 ${String(row.script_sha256).slice(0,8)}`,updated_at:row.created_at}));
  const rows=[...model.scripts,...imported];
  return [...new Map(rows.map(row=>[identity(row),{external_id:row.external_id,title:row.title,rows:rows.filter(other=>identity(row)===identity(other))}])).values()]
    .sort((a,b)=>String(a.external_id).localeCompare(String(b.external_id)));
}
export function nativeRerunHtml(project, groups) {
  const current = groups.map(group=>({...group,rows:group.rows.filter(row=>row.binding_status==='CURRENT' && row.source?.available!==false)})).filter(group=>group.rows.length);
  if (!current.length) return '';
  return `<details class="native-rerun-selection" data-native-rerun-project="${esc(project.project_id)}"><summary>选择已有脚本复跑（不调用模型）</summary><p>仅执行已冻结的脚本，不生成或修订业务代码。请选择用例与脚本版本，下一步核对原文件包及运行范围。</p><div class="table-wrap"><table><thead><tr><th>选择</th><th>用例</th><th>已有脚本版本</th></tr></thead><tbody>${current.map(group=>`<tr><td><input type="checkbox" data-native-rerun-case checked aria-label="复跑 ${esc(group.external_id)}"></td><td>${esc(group.external_id)}<small>${esc(group.title||'')}</small></td><td><select data-native-rerun-version aria-label="${esc(group.external_id)} 的冻结脚本版本">${group.rows.map(row=>`<option value="${esc(JSON.stringify({...nativeRerunSelection(row),task_id:row.task_id,latest_run_id:row.latest_run_id,external_id:row.external_id,title:row.title,entry:row.entry,display_version:row.display_version}))}">${esc(row.display_version)} · ${esc(date(row.updated_at||row.started_at))} · ${esc(result(row.status))}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div><button type="button" class="button primary" data-native-rerun-preview>核对并复跑所选脚本</button><p data-native-rerun-notice role="status"></p></details>`;
}
export function nativeScriptsHtml(project, model) {
  if (model.load_error) return nativeLoadErrorHtml(model);
  const draftHtml = nativeDraftsHtml(project, model.drafts);
  const rerunGroups=nativeRerunGroups(model);
  if (!model.scripts.length) {
    const availability = nativeScriptAvailability(model);
    return draftHtml + (rerunGroups.length?`<section class="panel native-console native-scripts"><div class="panel-header"><h2>运行导入脚本</h2></div><div class="panel-body"><p>导入稿尚未执行。核对当前项目环境后，按原文件包执行并采集新的结果与证据；不调用模型。</p>${nativeRerunHtml(project,rerunGroups)}</div></section>`:'') + (availability.hasHistory ? `<section class="panel native-console native-scripts"><div class="panel-header"><h2>DSH 脚本待核验</h2></div><div class="panel-body"><p class="notice warning">${esc(availability.notice)}</p></div></section>` : '');
  }
  const groups = [...new Map(model.scripts.map(row => [identity(row), {external_id:row.external_id,title:row.title,rows:model.scripts.filter(other=>identity(other)===identity(row))}])).values()].sort((a,b)=>String(a.external_id).localeCompare(String(b.external_id)));
  return draftHtml + `<section class="panel native-console native-scripts"><div class="panel-header"><h2>DSH 已有脚本</h2><span>${groups.length} 条用例 · ${model.scripts.length} 个冻结版本</span></div><div class="panel-body"><p>以下脚本从已有运行的冻结文件读取。原生 DSH 自测与人工首审分开记录，尚未登记人工批准。</p>${nativeRerunHtml(project,rerunGroups)}${groups.map(group => `<details class="native-script-case"><summary><strong>${esc(group.external_id)} · ${esc(group.title || '')}</strong> · ${group.rows.length} 个脚本版本</summary>${group.rows.map(row => `<details class="native-script"><summary><strong>${esc(row.external_id)} · 脚本 ${esc(row.display_version)}</strong> · 用例 v${esc(row.case_version)} · ${esc(result(row.status))} · ${esc(date(row.updated_at || row.started_at))}</summary><div class="panel-body"><p>${esc(row.title || '')} · 人工首审未登记</p><p><code>${esc(row.entry)}</code></p>${sourceHtml(project, row)}<p><a data-nav href="${caseHref(project, { ...row, run_id: row.latest_run_id })}">查看该脚本最近结果与证据</a> · 保留 ${row.run_ids?.length || 1} 次运行</p><details><summary>冻结身份</summary><pre>${esc(JSON.stringify({script_id:row.script_id,script_sha256:row.script_sha256,bundle_sha256:row.bundle_sha256,content_sha256:row.content_sha256},null,2))}</pre></details></div></details>`).join('')}</details>`).join('')}</div></section>`;
}
export function nativeLoadErrorHtml(model) { return `<section class="panel native-console"><div class="panel-body"><p role="alert">DSH 脚本和结果暂时读取失败：${esc(model.load_error)}。不能据此判断为尚未生成或尚未执行。</p></div></section>`; }
export function nativeRecordsHtml(project, model, { selectedRunId = '', compact = false } = {}) {
  if (model.load_error) return nativeLoadErrorHtml(model);
  if (!model.records.length) return '';
  const selectedMissing = selectedRunId && !model.records.some(row => row.run_id === selectedRunId);
  return `<section class="panel native-console native-results"><div class="panel-header"><h2>DSH 结果与证据</h2></div><div class="panel-body"><p>本范围 ${model.latest.length} 个用例版本最近正式运行：<strong>${model.passed} 运行通过</strong> · ${model.failed} 失败；保留 ${model.cases.length} 次正式运行、${model.excluded.length} 次诊断或未核验记录。</p><p class="muted">这是各用例最近一次结果汇总，跨次运行不代表一次整组回归；人工首审、独立反例验证未登记。诊断执行不计用例通过。</p>${selectedMissing ? '<p role="alert">指定 DSH 运行不属于当前项目、用例版本或范围，未用其他运行替代。</p>' : ''}<div class="table-wrap"><table><thead><tr><th>用例 / 版本</th><th>最近正式运行</th><th>时间</th><th>操作</th></tr></thead><tbody>${model.latest.map(row => `<tr><td><strong>${esc(row.external_id)}</strong> v${esc(row.case_version)}<small>${esc(row.title || '')}</small></td><td><span class="badge ${!formal(row) ? 'warning' : row.status === 'PASSED' ? 'success' : failedStatus(row.status) ? 'danger' : 'warning'}">${esc(formal(row)?result(row.status):'证据未核验 · 不计通过')}</span><small>证据：${esc(evidenceLabel(row))}</small><small>人工首审未登记</small></td><td>${esc(date(row.started_at))}</td><td><a data-nav href="${caseHref(project, row)}">查看结果与证据</a> · <a data-nav href="${caseHref(project, row, 'scripts')}">脚本</a></td></tr>`).join('') || '<tr><td colspan="4">尚无可核验的正式用例结果。</td></tr>'}</tbody></table></div>${compact ? '' : `<details class="native-history" ${selectedRunId ? 'open' : ''}><summary>全部正式运行历史（${model.cases.length}，含失败记录）</summary>${model.cases.map(row => runHtml(project, row, selectedRunId)).join('')}</details><details class="native-diagnostics" ${model.excluded.some(row => row.run_id === selectedRunId) ? 'open' : ''}><summary>诊断与未核验记录（${model.excluded.length}，不计用例通过）</summary>${model.excluded.map(row => runHtml(project, row, selectedRunId)).join('')}</details>`}</div></section>`;
}
export function nativeTasksHtml(project, data) {
  if (data.load_error) return nativeLoadErrorHtml(data);
  const model = nativeConsoleModel(project, data);
  if (!model.records.length && !model.tasks.length) return '';
  return `<section class="panel native-console"><div class="panel-header"><h2>DSH 测试任务</h2></div><div class="panel-body"><p>按原任务保存正式自测、失败与诊断，任务完成不等于业务验收通过。</p>${model.tasks.map(task => { const scoped = nativeConsoleModel(project, data, { taskId: task.task_id }); return `<details><summary>${esc(date(task.created_at))} · ${scoped.latest.length} 个用例版本 · ${esc(executionName(task))} · ${scoped.passed} 最近运行通过 · ${scoped.excluded.length} 诊断或未核验 · ${scoped.drafts.length} 已登记稿件 ${nativeDshDiagnosticsHtml(task, project.project_id, { compact: true })}</summary><p>${esc(task.revision_notes || '')}</p><p>任务：<code>${esc(task.task_id)}</code> · ${esc(result(task.status))}</p>${nativeDshDiagnosticsHtml(task, project.project_id)}${task.kind==='FROZEN_SCRIPT_RERUN'&&!terminalTask(task.status)?`<p>${task.status==='STOP_UNCONFIRMED'?'停止未确认，运行仍锁定，不能开始下一轮。':''}<button type="button" class="button" data-native-task-stop="${esc(task.task_id)}" data-native-task-project="${esc(project.project_id)}" ${['STOPPING','STOP_UNCONFIRMED'].includes(task.status)?'disabled':''}>停止本次复跑</button></p>`:''}${nativeDraftsHtml(project, scoped.drafts)}${nativeRecordsHtml(project, scoped)}</details>`; }).join('')}</div></section>`;
}
const post = body => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const nativeRerunReason=code=>({PROJECT_ENVIRONMENT_NOT_CONFIGURED:'请先在项目设置中保存本项目的前端测试环境。',NATIVE_DSH_ENVIRONMENT_CONFIRMATION_REQUIRED:'请重新核对本次目标项目环境后提交。',NATIVE_DSH_ENVIRONMENT_CHANGED:'项目环境已变化，请重新预检并确认。',NATIVE_DSH_LOGIN_REQUIRED:'请先在目标项目的专用浏览器完成登录。',NATIVE_DSH_FORMAL_ENTRY_MISMATCH:'导入稿不是此用例的正式入口，不能作为业务用例运行。',NATIVE_DSH_CASE_CHANGED:'用例版本或确认状态已变化，请重新核对。'}[code]||code||'运行条件未满足');
function bindNativeRerun(root) {
  root?.querySelectorAll?.('[data-native-rerun-preview]').forEach(button=>{
    if(button.dataset.bound)return;button.dataset.bound='true';
    button.addEventListener('click',async()=>{
      const scope=button.closest('[data-native-rerun-project]'), projectId=scope.dataset.nativeRerunProject;
      const currentHash=location.hash,endpoint=`/api/case-library/projects/${encodeURIComponent(projectId)}/native-dsh`,notice=scope.querySelector('[data-native-rerun-notice]');
      button.disabled=true;notice.textContent='正在核对所选冻结脚本与运行条件…';
      try {
        const selected=[...scope.querySelectorAll('tbody tr')].filter(row=>row.querySelector('[data-native-rerun-case]').checked).map(row=>JSON.parse(row.querySelector('[data-native-rerun-version]').value));
        let items=nativeRerunItems(selected);const preview=await api(`${endpoint}/reruns/preflight`,post({items}));
        if(!scope.isConnected || location.hash!==currentHash)return;
        if(preview.project_id!==projectId || preview.model_calls!==0)throw Error('复跑预览身份或无模型执行声明不完整');
        items=items.map((item,index)=>item.source_kind==='IMPORTED_SCRIPT'?{...item,...(preview.items?.[index]?.environment_identity?{environment_identity:preview.items[index].environment_identity}:{})}:item);
        const dialog=document.createElement('dialog');dialog.className='native-rerun-dialog';
        dialog.innerHTML=`<h2>复跑已有冻结脚本</h2><p>本次选择 ${items.length} 条用例，模型调用 0。不生成或修订业务脚本；执行前再次核对下面的原用例与冻结文件包。</p><div data-native-rerun-progress role="status">${preview.allowed?'运行条件已核对，可以开始。':`当前不能开始：${esc(nativeRerunReason(preview.reason))}`}</div>${preview.items?.some(item=>item.source_kind==='IMPORTED_SCRIPT')?`<p class="notice">本次使用目标项目环境：${esc(preview.items.find(item=>item.environment_url)?.environment_url||'尚未配置')}。导入时的原项目环境和登录态不会复用。</p>`:''}<details open><summary>本次范围与脚本身份（${items.length} 条）</summary>${selected.map((row,index)=>`<article><h3>${esc(row.external_id)} · ${esc(row.display_version)} · 用例 v${esc(row.case_version)}</h3><p><code>${esc(row.entry)}</code></p><dl><dt>${items[index].source_kind==='IMPORTED_SCRIPT'?'导入冻结稿':'原运行'}</dt><dd><code>${esc(items[index].source_draft_id||items[index].source_run_id)}</code></dd><dt>脚本 SHA-256</dt><dd><code>${esc(row.script_sha256)}</code></dd><dt>文件包 SHA-256</dt><dd><code>${esc(row.bundle_sha256)}</code></dd><dt>用例内容 SHA-256</dt><dd><code>${esc(row.content_sha256)}</code></dd></dl>${preview.items?.[index]?.reason?`<p class="notice warning">${esc(nativeRerunReason(preview.items[index].reason))}</p>`:''}</article>`).join('')}</details><div class="actions"><button type="button" class="button primary" data-native-rerun-start ${preview.allowed?'':'disabled'}>开始复跑这 ${items.length} 条现有脚本</button><button type="button" class="button" data-native-rerun-stop hidden>停止本次复跑</button><button type="button" class="button" data-native-rerun-close>关闭</button><a class="button" data-nav href="#/projects/${encodeURIComponent(projectId)}/batches" data-native-rerun-result hidden>查看本次结果与证据</a></div>`;
        document.body.append(dialog);dialog.showModal();notice.textContent='已展开复跑范围与冻结身份，请核对。';
        let timer=null,startedTask=null;const requestId=`native-rerun-${crypto.randomUUID()}`;
        const close=()=>dialog.close();
        const cleanup=()=>{clearTimeout(timer);window.removeEventListener('hashchange',close);dialog.remove();};
        window.addEventListener('hashchange',close);dialog.addEventListener('close',cleanup,{once:true});
        dialog.querySelector('[data-native-rerun-close]').onclick=close;
        const progress=dialog.querySelector('[data-native-rerun-progress]');
        const update=async()=>{
          if(!dialog.isConnected || !startedTask)return;
          try {
            const data=await api(`${endpoint}/console`),task=data.tasks?.find(task=>task.task_id===startedTask);
            if(!dialog.isConnected)return;
            if(!task)throw Error('暂未取得本次任务记录');
            const state=nativeTaskProgress(task,data.records||[]),ended=state.terminal;
            const stop=dialog.querySelector('[data-native-rerun-stop]');stop.hidden=ended;stop.disabled=['STOPPING','STOP_UNCONFIRMED'].includes(task.status);stop.textContent=task.status==='STOP_UNCONFIRMED'?'停止未确认':task.status==='STOPPING'?'正在停止…':'停止本次复跑';
            progress.innerHTML=`<p><strong>${state.locked?'停止未确认，运行仍锁定，不能开始下一轮':ended?'本次原脚本复跑已结束':task.status==='STOPPING'?'正在停止原脚本复跑':'正在复跑原脚本'}</strong> · 模型调用 ${esc(task.model_calls??'未登记')} · ${esc(task.status)}</p><p>已保存 ${state.count} 条正式运行：${state.passed} 运行通过、${state.failed} 失败。步骤与媒体采集状态独立核对。</p><p>任务 <code>${esc(startedTask)}</code></p>`;
            dialog.querySelector('[data-native-rerun-result]').hidden=false;
            if(ended)dialog.querySelector('[data-native-rerun-close]').textContent='关闭';
            if(!ended)timer=setTimeout(update,2500);
          } catch(error) {if(dialog.isConnected){progress.textContent=`本次复跑进度暂时读取失败：${error.message}。任务不会因此重新启动。`;timer=setTimeout(update,4000);}}
        };
        dialog.querySelector('[data-native-rerun-stop]').onclick=async event=>{
          event.target.disabled=true;
          try{await api(`${endpoint}/tasks/${encodeURIComponent(startedTask)}/stop`,post({}));clearTimeout(timer);await update();}
          catch(error){progress.textContent=`停止请求未确认：${error.message}。请保留任务并核对，不能据此认为已经停止。`;event.target.disabled=false;}
        };
        const startButton=dialog.querySelector('[data-native-rerun-start]');
        startButton.onclick=async()=>{
          startButton.disabled=true;progress.textContent='正在启动所选冻结脚本复跑…';
          try {
            const task=await api(`${endpoint}/reruns`,post({items,request_id:requestId,allow_execution:true,timeout_minutes:30}));
            startedTask=task.id || task.task?.id || task.task_id;startButton.hidden=true;
            dialog.querySelector('[data-native-rerun-close]').textContent='关闭（运行继续）';
            await update();
          } catch(error) {progress.textContent=`本次启动未确认：${error.message}。未自动重试。`;startButton.disabled=false;}
        };
      } catch(error) {notice.textContent=`暂不能复跑：${error.message}`;}
      finally {if(button.isConnected)button.disabled=false;}
    });
  });
}
export function bindNativeConsole(root = document) {
  bindNativeRerun(root);
  root?.querySelectorAll?.('[data-native-detail]').forEach(details=>{
    if(details.dataset.detailBound)return;details.dataset.detailBound='true';
    const load=async()=>{
      if(!details.open || details.dataset.detailLoaded || details.dataset.detailLoading)return;
      details.dataset.detailLoading='true';
      const body=details.querySelector('[data-native-detail-body]');body.querySelector('p').textContent='正在读取本次证据并核验冻结文件…';
      try{
        const data=await api(details.dataset.nativeDetail),row=data.records?.find(row=>row.run_id===details.dataset.nativeRun && row.project_id===details.dataset.nativeProject);
        if(!row || data.project_id!==details.dataset.nativeProject)throw Error('运行身份不匹配');
        if(!details.isConnected)return;
        const template=document.createElement('template');template.innerHTML=runHtml({project_id:details.dataset.nativeProject},row,row.run_id);
        details.innerHTML=template.content.firstElementChild.innerHTML;details.dataset.detailLoaded='true';bindNativeConsole(details);
      }catch(error){if(details.isConnected)body.querySelector('p').textContent=`证据读取失败：${error.message}。请重试；未据此改变运行成绩。`;}
      finally{delete details.dataset.detailLoading;}
    };
    details.addEventListener('toggle',()=>void load());details.querySelector('[data-native-detail-retry]')?.addEventListener('click',()=>void load());void load();
  });
  root?.querySelectorAll?.('[data-native-task-stop]').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;
    try{await api(`/api/case-library/projects/${encodeURIComponent(button.dataset.nativeTaskProject)}/native-dsh/tasks/${encodeURIComponent(button.dataset.nativeTaskStop)}/stop`,post({}));button.textContent='停止请求已提交，等待记录更新';}
    catch(error){button.textContent=`停止未确认：${error.message}`;button.disabled=false;}
  }));
  root?.querySelectorAll?.('[data-native-media]').forEach(host=>{
    if(host.dataset.bound)return;host.dataset.bound='true';
    const initialize=()=>{
      if(host.dataset.initialized || !host.isConnected)return;
      const parent=host.closest('.native-run');if(parent && !parent.open)return;
      try {enhanceMedia(host,JSON.parse(host.dataset.nativeMedia));host.dataset.initialized='true';}
      catch {const note=document.createElement('p');note.className='notice warning';note.textContent='此运行的媒体关联暂不可用；原始证据文件仍可读取，业务结果未改变。';host.prepend(note);}
    };
    host.closest('.native-run')?.addEventListener('toggle',initialize);initialize();
  });
  root?.querySelectorAll?.('[data-native-source]').forEach(button => button.addEventListener('click', async () => {
    const output = button.closest('.native-script-source').querySelector('[data-native-source-content]');
    button.disabled = true; output.textContent = '正在读取冻结脚本…';
    try {
      const response = await fetch(button.dataset.nativeSource, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      output.textContent = await response.text(); button.textContent = '已载入冻结脚本';
    } catch (error) { output.textContent = `冻结脚本读取失败：${error.message}。原脚本与结果未改动。`; button.disabled = false; }
  }));
}
