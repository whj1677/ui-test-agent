import { api } from './api.js';
import { esc } from './workflow.js';

const activeStates = new Set(['QUEUED', 'PREPARING', 'RUNNING', 'STOPPING', 'STOP_UNCONFIRMED']);
const labels = { QUEUED: '待开始', PREPARING: '准备中', RUNNING: '执行中', STOPPING: '正在停止', STOP_UNCONFIRMED: '停止尚未确认', COMPLETED: '任务结束', PARTIAL: '部分完成', FINISHED: '任务结束', PASSED: '通过', FAILED: '失败', BLOCKED: '阻塞', CANCELLED: '已取消', INTERRUPTED: '服务中断', NOT_RUN: '未运行', ERROR: '执行异常', TIMED_OUT: '达到时间上限' };
const errors = {
  NATIVE_DSH_UNAVAILABLE: '原生 dsh 运行环境尚未就绪，请检查工作台运行配置。',
  NATIVE_DSH_RUNTIME_UNAVAILABLE: '原生 dsh 运行环境尚未就绪，请检查工作台运行配置。',
  NATIVE_DSH_LOGIN_REQUIRED: '请先到环境设置完成登录，再返回提交。',
  NATIVE_DSH_BUSY: '已有任务正在执行，请等待结束或先停止该任务。',
  WORKBENCH_BUSY: '工作台有其他任务正在执行，请等待结束后再提交。',
  AUTH_SESSION_REQUIRED: '请先到环境设置完成登录，再返回提交。',
  AUTH_SESSION_NOT_VALID: '登录会话已失效，请到环境设置重新登录。',
  PROJECT_ENVIRONMENT_NOT_CONFIGURED: '请先配置本项目的前端测试环境。',
  PROJECT_ENVIRONMENT_CONFIGURATION_CHANGED: '项目环境已变化，请重新载入后核对。',
  NATIVE_DSH_CASE_CHANGED: '用例版本已变化，请重新载入本页后选择。',
  NATIVE_DSH_EXISTING_SOURCE_CHANGED: '现有稿件副本已变化，未登记。请保留原稿后重新提交。',
  NATIVE_ENTRY_NOT_IN_SOURCE_BUNDLE: '所选用例尚无现有正式脚本；仅登记模式不会生成新稿。',
  NATIVE_DSH_REGISTER_ONE_CASE_REQUIRED: '仅登记模式每次请选择一条现有脚本。',
  NATIVE_DSH_EXECUTION_DISABLED: '本任务仅允许登记现有稿件，已禁止执行脚本。',
  WORKBENCH_UNREACHABLE: '暂时无法连接工作台。已提交的任务不会因本页重试而重复创建。',
};
const post = value => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const errorMessage = error => errors[error?.code || error?.message] || error?.message || String(error || '未知错误');
const duration = value => { const seconds = Math.max(0, Math.floor(Number(value || 0) / 1000)); return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`; };
const statusLabel = value => labels[value] || value || '未运行';
const countsForCase = run => run.purpose === 'case' && run.counts_for_case === true;
const elapsed = task => task?.elapsed_ms ?? (activeStates.has(task?.status) && Number.isFinite(Date.parse(task.created_at)) ? Date.now() - Date.parse(task.created_at) : 0);
const eventLabels = { 'turn/start': '开始处理', 'turn/end': '本轮处理结束', 'tool/call': '工具动作', 'tool/result': '工具结果', progress: '过程说明', 'approval/asked': '等待权限', 'approval/decided': '权限已处理' };
const publicText = value => typeof value === 'string' ? value.slice(0, 1200) : '';
const eventTime = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('zh-CN', { hour12: false }) : publicText(value);
};

export function nativeDshPublicEvents(task) {
  return (Array.isArray(task.events) ? task.events : []).filter(event => Object.hasOwn(eventLabels, event?.type)).slice(-500)
    .map(event => ({ type: event.type, seq: event.seq, at: publicText(event.at), tool_name: publicText(event.tool_name),
      summary: task.kind === 'REGISTER_EXISTING_DRAFT' && event.type === 'turn/start' && event.summary === '原生 dsh 开始编写与自测'
        ? '原生 dsh 开始登记现有稿件（未运行）' : publicText(event.summary),
      is_error: typeof event.is_error === 'boolean' ? event.is_error : null }));
}

export function nativeDshRevisionCount(task) {
  const hashes = new Map(); let count = 0;
  for (const run of task.runs || []) {
    if (!countsForCase(run)) continue;
    const identity = run.bundle_sha256 || run.script_sha256;
    if (!identity || !run.case_id) continue;
    if (hashes.has(run.case_id) && hashes.get(run.case_id) !== identity) count++;
    hashes.set(run.case_id, identity);
  }
  return count;
}

export function nativeDshProcessHtml(task, { historyOpen = false } = {}) {
  if(task.kind==='FROZEN_SCRIPT_RERUN')return `<h3>执行过程</h3><p role="status"><strong>当前阶段：</strong>${esc(task.stage || statusLabel(task.status))}</p><p>本次仅执行冻结脚本，模型调用 ${task.model_calls===0?'0':'未登记'}；不生成、修订脚本，也不产生 DSH 工具过程。</p>`;
  const events = nativeDshPublicEvents(task), recent = events.slice(-20), earlier = events.slice(0, -20);
  const toolErrors = task.runtime?.tool_exit_code_tracking !== true || events.some(event => event.type === 'tool/result' && typeof event.is_error !== 'boolean')
    ? '工具错误：旧记录未完整采集' : `工具错误 ${events.filter(event => event.type === 'tool/result' && event.is_error).length} 次`;
  const approvals = (Array.isArray(task.pending_approvals) ? task.pending_approvals : []).map(item => ({
    id: publicText(item.id || item.approval_id), tool_name: publicText(item.tool_name), purpose: publicText(item.purpose),
  }));
  const rows = values => values.map(event => `<li class="${event.is_error ? 'notice danger' : event.type === 'approval/asked' ? 'notice warning' : ''}"><p><time datetime="${esc(event.at)}">${esc(eventTime(event.at))}</time> · <strong>${esc(event.is_error ? '工具错误' : eventLabels[event.type])}</strong>${event.tool_name ? ` · ${esc(event.tool_name)}` : ''}</p>${event.summary ? `<p class="preserve-text">${esc(event.summary)}</p>` : ''}</li>`).join('');
  return `<h3>执行过程</h3><p role="status"><strong>当前阶段：</strong>${esc(task.stage || (activeStates.has(task.status) ? '等待运行进度' : statusLabel(task.status)))}</p>
    ${approvals.length ? `<aside class="notice warning" role="status"><strong>等待权限操作（${approvals.length} 项）</strong>${approvals.map(item => `<p>${esc(item.tool_name || '工具操作')} · ${esc(item.purpose || '需要你确认后继续')}</p>`).join('')}<p>请在原生 dsh 窗口处理权限请求。已有记录会继续保留。</p></aside>` : ''}
    <p class="muted">工具动作 ${events.filter(event => event.type === 'tool/call').length} 次 · ${toolErrors} · 脚本修订后自测 ${nativeDshRevisionCount(task)} 次</p>
    ${recent.length ? `<ol aria-label="最近执行过程">${rows(recent)}</ol>` : '<p class="muted">尚未收到过程记录。</p>'}
    ${earlier.length ? `<details data-native-events-history${historyOpen ? ' open' : ''}><summary>展开更早过程（${earlier.length} 条）</summary><ol aria-label="更早执行过程">${rows(earlier)}</ol></details>` : ''}
    <p class="muted">展示公开过程说明和工具执行摘要，最多保留最近 500 条。脚本修订次数只按计入用例结果的自测脚本快照变化计算。</p>`;
}

export function nativeDshHistoryFingerprint(tasks) {
  return JSON.stringify(tasks.map(({ elapsed_ms, stage, events, pending_approvals, ...task }) => task));
}

export function updateNativeDshProcess(container, task) {
  const fingerprint = JSON.stringify({ stage: task.stage, status: task.status, events: nativeDshPublicEvents(task), approvals: task.pending_approvals || [], revisions: nativeDshRevisionCount(task), tool_exit_code_tracking: task.runtime?.tool_exit_code_tracking === true });
  if (container.nativeProcessFingerprint === fingerprint) return;
  const historyOpen = container.querySelector?.('[data-native-events-history]')?.open === true;
  container.innerHTML = nativeDshProcessHtml(task, { historyOpen });
  container.nativeProcessFingerprint = fingerprint;
}

export function nativeDshCaseItems(project) {
  return (project.cases || []).flatMap(item => {
    const version = item.versions?.find(row => Number(row.version) === Number(item.current_version));
    return version?.content?.status === 'CONFIRMED' && version.content.case_type === 'UI' && /^[a-f0-9]{64}$/i.test(version.content_sha256 || '')
      ? [{ case_id: item.case_id, case_version: version.version, content_sha256: version.content_sha256,
        external_id: version.content.external_id || item.external_id, title: version.content.title || item.title }] : [];
  });
}

export function nativeDshTaskInput({ items, selected, environmentId, requestId, timeoutMinutes = 30, revisionNotes = '', kind = 'DSH_GENERATION_SELF_TEST' }) {
  if (!['DSH_GENERATION_SELF_TEST', 'REGISTER_EXISTING_DRAFT'].includes(kind)) throw Error('任务模式无效。');
  const registrationOnly = kind === 'REGISTER_EXISTING_DRAFT';
  const scope = items.filter(item => selected.has(item.case_id));
  if (!scope.length) throw Error('请至少选择一条已确认的前端用例。');
  if (scope.length > 200) throw Error('本次最多选择 200 条用例。');
  if (registrationOnly && scope.length !== 1) throw Error('仅登记模式每次请选择一条现有脚本。');
  if (!registrationOnly && !environmentId) throw Error('请先配置本项目的前端测试环境。');
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 120) throw Error('本批时间上限应为 1 至 120 分钟。');
  if (typeof revisionNotes !== 'string') throw Error('本批修订说明应为文本。');
  const notes = revisionNotes.trim();
  if (notes.length > 8000) throw Error('本批修订说明最多 8000 字符。');
  return { request_id: requestId, items: scope.map(({ case_id, case_version, content_sha256 }) => ({ case_id, case_version, content_sha256 })),
    ...(registrationOnly ? { kind, allow_execution: false } : { environment_id: environmentId, allow_execution: true }), allow_model: true, timeout_minutes: timeoutMinutes,
    ...(notes ? { revision_notes: notes } : {}) };
}

/**
 * 前置预检结果展示。
 *
 * 边界：预检**不阻塞**任务，因此这里只做"提前告知"，不得写成"已阻止""不通过"这类判定语。
 * 没有档案时如实说明是"未启用预检"，不要显示成"检查通过"。
 */
const PREFLIGHT_LABEL = { PASS: '检查通过', WARN: '有提示项', FAIL: '发现问题', SKIPPED: '未启用预检', UNKNOWN: '部分无法判定' };
const PREFLIGHT_CHECK_LABEL = {
  reachability: '目标可达性',
  session: '登录状态',
  targets: '档案目标复核',
};

export function nativeDshPreflightHtml(preflight) {
  if (!preflight) return '';
  if (preflight.static?.status === 'SKIPPED' && !preflight.runtime) {
    return '<p class="muted">本项目尚未提供 <code>module-profile.json</code>，本轮未启用前置预检（不影响任务执行）。</p>';
  }
  const rows = [];
  const staticResult = preflight.static;
  if (staticResult) {
    const detail = staticResult.status === 'SKIPPED'
      ? '未提供模块档案'
      : `档案条目 ${esc(staticResult.targets ?? 0)} 条`;
    rows.push(`<li><span class="badge${staticResult.status === 'FAIL' ? ' warning' : ''}">档案准入：${esc(PREFLIGHT_LABEL[staticResult.status] || staticResult.status)}</span> ${detail}</li>`);
  }
  for (const check of preflight.runtime?.checks ?? []) {
    const label = PREFLIGHT_CHECK_LABEL[check.name] || check.name;
    const extra = check.mismatched?.length ? `（对不上的目标：${esc(check.mismatched.map(m => `${m.name}=${m.matched}`).join('、'))}）` : '';
    rows.push(`<li><span class="badge${check.status === 'FAIL' ? ' warning' : ''}">${esc(label)}：${esc(PREFLIGHT_LABEL[check.status] || check.status)}</span>${extra}</li>`);
  }
  const issues = [...(staticResult?.errors ?? []), ...(preflight.runtime?.errors ?? [])];
  const warnings = [...(staticResult?.warnings ?? []), ...(preflight.runtime?.warnings ?? [])];
  const head = `<p class="muted">前置预检：<strong>${esc(PREFLIGHT_LABEL[preflight.status] || preflight.status)}</strong> · 只读检查，不阻塞任务，也不改变业务判定。</p>`;
  const blocks = [];
  if (rows.length) blocks.push(`<ul>${rows.join('')}</ul>`);
  if (issues.length) blocks.push(`<p class="notice danger">需处理：${esc(issues.map(i => i.detail || i.code).join('；'))}</p>`);
  if (warnings.length) blocks.push(`<details data-native-preflight-warnings><summary>提示项（${warnings.length}）</summary><ul>${warnings.map(w => `<li><code>${esc(w.code)}</code> ${esc(w.detail ?? '')}</li>`).join('')}</ul></details>`);
  return `${head}${blocks.join('')}`;
}

export const nativeDshArtifactUrl = (projectId, taskId, artifactId) => `/api/case-library/projects/${encodeURIComponent(projectId)}/native-dsh/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(artifactId)}`;

/**
 * 只读对话视图的渲染。
 *
 * 边界：只显示服务端已脱敏并白名单过滤过的条目；思考块不会出现在输入里
 * （服务端在构建阶段就丢弃），这里也不做任何"补全"。
 * 读不到时明确说明原因，绝不用空列表冒充"没有对话"。
 */
const transcriptReasonText = reason => ({
  NATIVE_DSH_NO_PROJECT_SESSION: '本项目尚未建立 dsh 会话，暂时没有可查看的对话。',
  NATIVE_DSH_TRANSCRIPT_NOT_FOUND: '找不到该会话的日志文件；会话可能尚未落盘或已被清理。',
  NATIVE_DSH_TRANSCRIPT_UNSUPPORTED: '该会话日志的存储格式当前无法读取。',
  NATIVE_DSH_TRANSCRIPT_UNREADABLE: '该会话日志存在但读取失败，未展示任何内容。',
  NATIVE_DSH_TRANSCRIPT_UNAVAILABLE: '当前无法读取会话日志存储。',
}[reason] || '当前无法读取该会话的对话记录。');

const TRANSCRIPT_LABEL = { user: '编排方输入', assistant: 'dsh 回复', tool_call: '工具调用', tool_result: '工具结果', turn_start: '回合开始', turn_end: '回合结束' };

// Only construct fixed, local markup from escaped public text. Links, images and
// raw HTML remain text: reading a model reply must not load external resources.
const transcriptInline = value => String(value).split(/(`[^`\n]*`)/g).map(part => part.startsWith('`') && part.endsWith('`')
  ? `<code>${esc(part.slice(1,-1))}</code>` : esc(part).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')).join('');
const transcriptCells = line => {
  const cells=[];let cell='',code=false;
  for(let i=0;i<line.length;i++){
    if(line[i]==='\\'&&line[i+1]==='|'){cell+='|';i++;continue;}
    if(line[i]==='`')code=!code;
    if(line[i]==='|'&&!code){cells.push(cell.trim());cell='';}else cell+=line[i];
  }
  cells.push(cell.trim());if(line.trim().startsWith('|'))cells.shift();if(line.trim().endsWith('|'))cells.pop();return cells;
};
const transcriptTableStart = (lines,i) => {
  if(i+1>=lines.length||!lines[i].includes('|'))return false;
  const head=transcriptCells(lines[i]),rule=transcriptCells(lines[i+1]);
  return head.length>1&&head.length===rule.length&&rule.every(cell=>/^:?-{3,}:?$/.test(cell));
};
function transcriptBody(text) {
  const lines=String(text).replace(/\r\n?/g,'\n').split('\n'),html=[];let i=0;
  while(i<lines.length){
    if(!lines[i].trim()){i++;continue;}
    if(/^\s*```/.test(lines[i])){
      const code=[];i++;while(i<lines.length&&!/^\s*```\s*$/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;
      html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);continue;
    }
    if(transcriptTableStart(lines,i)){
      const head=transcriptCells(lines[i]);i+=2;const rows=[];
      while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')){
        const row=transcriptCells(lines[i]);if(row.length!==head.length)break;
        rows.push(`<tr>${row.map(cell=>`<td>${transcriptInline(cell)}</td>`).join('')}</tr>`);i++;
      }
      html.push(`<div class="native-transcript-table" role="region" aria-label="回复表格，可横向滚动" tabindex="0"><table><thead><tr>${head.map(cell=>`<th scope="col">${transcriptInline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);continue;
    }
    const heading=/^\s{0,3}(#{1,6})\s+(.+)$/.exec(lines[i]);
    if(heading){const level=Math.min(6,heading[1].length+2);html.push(`<h${level}>${transcriptInline(heading[2])}</h${level}>`);i++;continue;}
    const list=/^\s*(?:([-+*])\s+|(\d+)\.\s+)(.+)$/.exec(lines[i]);
    if(list){
      const ordered=Boolean(list[2]),tag=ordered?'ol':'ul',items=[];
      while(i<lines.length){const row=/^\s*(?:([-+*])\s+|(\d+)\.\s+)(.+)$/.exec(lines[i]);if(!row||Boolean(row[2])!==ordered)break;items.push(`<li>${transcriptInline(row[3])}</li>`);i++;}
      const start=ordered&&Number(list[2])>1?` start="${Math.min(Number(list[2]),2147483647)}"`:'';html.push(`<${tag}${start}>${items.join('')}</${tag}>`);continue;
    }
    const paragraph=[lines[i++]];
    while(i<lines.length&&lines[i].trim()&&!/^\s*(?:```|#{1,6}\s|[-+*]\s|\d+\.\s)/.test(lines[i])&&!transcriptTableStart(lines,i))paragraph.push(lines[i++]);
    html.push(`<p>${paragraph.map(transcriptInline).join('<br>')}</p>`);
  }
  return `<div class="native-transcript-body">${html.join('')}</div>`;
}
const transcriptWhen = turn => {
  const date=turn.at==null?null:new Date(Number(turn.at));
  return date&&Number.isFinite(date.getTime())?`<small class="muted">${esc(date.toISOString().replace('T',' ').slice(0,19))}Z</small>`:'';
};
const transcriptReply = turn => `${transcriptBody(turn.text)}<details class="native-transcript-raw"><summary>查看原始回复</summary><pre class="preserve-text">${esc(turn.text)}</pre></details>`;

export function nativeDshTranscriptHtml(transcript) {
  if (!transcript || transcript.available !== true) {
    return `<p class="notice">${esc(transcriptReasonText(transcript?.reason))}</p>`;
  }
  const turns = Array.isArray(transcript.turns) ? transcript.turns : [];
  const integrity = transcript.integrity || {};
  const truncated = integrity.truncated === true;
  const head = `<p class="muted">会话 <code>${esc(transcript.session_id || '未知')}</code> · 共 ${turns.length} 条可展示记录 · 读取 ${esc(integrity.framesDecoded ?? 0)}/${esc(integrity.frames ?? 0)} 帧` +
    `${truncated ? ` · <strong>日志未完整解出（${esc(integrity.reason || '未知原因')}），以下内容可能不完整</strong>` : ''}</p>`;
  if (!turns.length) return `${head}<p class="muted">该会话没有可展示的对话记录。</p>`;
  const rows = turns.map(turn => {
    const label = TRANSCRIPT_LABEL[turn.role] || turn.type;
    const when = transcriptWhen(turn);
    if (turn.role === 'tool_call') {
      return `<details data-native-transcript-entry="${esc(turn.seq)}"><summary><span class="badge">${esc(label)}</span> ${esc(turn.tool || '未命名工具')}</summary><pre class="preserve-text">${esc(turn.arguments_preview || '')}</pre></details>`;
    }
    if (turn.role === 'tool_result') {
      return `<details data-native-transcript-entry="${esc(turn.seq)}"><summary><span class="badge${turn.is_error ? ' warning' : ''}">${esc(label)}${turn.is_error ? '（错误）' : ''}</span> ${esc(turn.tool || '')}</summary><pre class="preserve-text">${esc(turn.result_preview || '')}</pre></details>`;
    }
    if (!turn.text) return `<p class="muted">${esc(label)} ${when}</p>`;
    return `<article class="transcript-entry"><p><span class="badge">${esc(label)}</span> ${when}</p>${turn.role==='assistant'?transcriptReply(turn):`<pre class="preserve-text">${esc(turn.text)}</pre>`}</article>`;
  });
  const latestIndex=turns.findLastIndex(turn=>turn.role==='assistant'&&typeof turn.text==='string'&&turn.text.trim());
  const input=latestIndex<0?null:turns.slice(0,latestIndex).findLast(turn=>turn.role==='user'&&turn.text);
  const latest=latestIndex<0?'<p class="notice">本次读取尚无可展示的 dsh 回复，可展开完整对话核对输入和工具记录。</p>':
    `<section class="native-transcript-latest" data-native-transcript-latest tabindex="-1" aria-label="本次读取的最新 dsh 回复"><h3>本次读取的最新 dsh 回复</h3><p>${transcriptWhen(turns[latestIndex])}</p>`+
    `${input?`<details class="native-transcript-input"><summary>查看对应输入</summary><pre class="preserve-text">${esc(input.text)}</pre></details>`:''}${transcriptReply(turns[latestIndex])}</section>`;
  return `${head}${latestIndex<0?'':'<p><button type="button" class="button small" data-native-transcript-jump>跳到最新回复</button></p>'}${latest}`+
    `<details class="native-transcript-history"><summary>完整公开对话（${turns.length} 条，按时间顺序）</summary><div class="native-transcript-history-body" tabindex="0" role="region" aria-label="完整 dsh 公开对话">${rows.join('')}</div></details>`;
}

function errorHtml(error) {
  if (!error) return '';
  const text = String(typeof error === 'string' ? error : error.message || error.code || JSON.stringify(error))
    .replace(/\u001b\][\s\S]*?(?:\u0007|\u001b\\)/g, '').replace(/(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/g, '').replace(/\u001b[@-_]/g, '').trim();
  const summary = text.split(/\r?\n/).find(line => line.trim())?.trim() || '未知错误';
  return `<p class="notice danger">${esc(errors[summary] || summary)}</p><details data-native-error-detail><summary>完整错误</summary><pre class="preserve-text">${esc(text)}</pre></details>`;
}

export function nativeDshDiagnosticsHtml(task, projectId, { compact = false } = {}) {
  const taskId = task.id || task.task_id;
  if (task.project_id && task.project_id !== projectId) return '';
  const token = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,119}$/.test(value) ? value : null;
  const entries = (Array.isArray(task.diagnostics) ? task.diagnostics : []).filter(item =>
    item?.schema === 'workbench/native-dsh-task-diagnostic-v1' && item.project_id === projectId &&
    item.task_id === taskId && token(item.phase) && typeof item.summary === 'string').slice(-20).map(item => ({
      at: typeof item.at === 'string' ? item.at.slice(0, 80) : '', phase: item.phase,
      update_phase: ['LOAD', 'CHANGE', 'SAVE', 'CLONE'].includes(item.update_phase) ? item.update_phase : null,
      code: token(item.code) || token(item.summary), summary: item.summary.slice(0, 1200),
    }));
  if (!entries.length) return '';
  const latest = entries.at(-1);
  if (compact) return `<span data-native-diagnostic-summary>故障阶段：${esc(latest.phase)} · ${esc(latest.code || '错误码未登记')} · ${esc(latest.summary)}</span>`;
  const detail = item => `<p>阶段：<code>${esc(item.phase)}</code>${item.update_phase ? ` · 更新环节：<code>${esc(item.update_phase)}</code>` : ''} · 错误码：<code>${esc(item.code || '未登记')}</code></p><p class="preserve-text">${esc(item.summary)}</p>${item.at ? `<p class="muted"><time datetime="${esc(item.at)}">${esc(item.at)}</time></p>` : ''}`;
  return `<aside class="notice danger" data-native-task-diagnostics><strong>任务故障诊断</strong>${detail(latest)}${entries.length > 1 ? `<details><summary>更早诊断（${entries.length - 1} 条）</summary>${entries.slice(0, -1).reverse().map(detail).join('')}</details>` : ''}</aside>`;
}

function artifactsHtml(projectId, taskId, artifacts = [], scriptSha256) {
  const mainScript = scriptSha256 ? artifacts.find(item => item.kind === 'script' && item.sha256 === scriptSha256) : null;
  const primary = artifacts.filter(item => /screenshot|image|video/i.test(item.kind || '') || item === mainScript);
  const visible = primary.map(item => {
    const url = nativeDshArtifactUrl(projectId, taskId, item.id), name = esc(item.name || item.kind || '运行文件');
    if (/video/i.test(item.kind || '')) return `<div class="execution-media"><video controls preload="metadata" src="${url}" aria-label="${name}"></video><a href="${url}" target="_blank" rel="noreferrer">${name}</a></div>`;
    if (/screenshot|image/i.test(item.kind || '')) return `<a href="${url}" target="_blank" rel="noreferrer">查看截图：${name}</a>`;
    return `<a href="${url}" target="_blank" rel="noreferrer">主测试脚本：${name}</a>`;
  }).join(' · ');
  const allFiles = artifacts.map(item => `<li><a href="${nativeDshArtifactUrl(projectId, taskId, item.id)}" target="_blank" rel="noreferrer">${esc(item.relative_path || item.name || item.kind || '运行文件')}</a></li>`).join('');
  return `${visible ? `<div class="actions">${visible}</div>` : ''}${artifacts.length ? `<details data-native-all-files><summary>全部文件（${artifacts.length}）</summary><ul>${allFiles}</ul></details>` : ''}`;
}

function runHtml(run, task, projectId) {
  const counted = countsForCase(run);
  const purpose = run.purpose === 'diagnostic' ? '诊断执行（不计用例结果）'
    : run.purpose === 'case' ? counted ? '用例执行' : '用例执行（不计用例结果）'
      : '未归类执行（不计用例结果）';
  const badge = run.status === 'PASSED' ? counted ? ' success' : '' : ' warning';
  return `<article class="preview-item"><header><strong>${esc(run.external_id || task.items?.find(item => item.case_id === run.case_id)?.external_id || run.case_id || run.id)}</strong><span class="badge${badge}">${counted ? '' : '执行状态：'}${esc(statusLabel(run.status))}</span></header>
    <p><strong>${purpose}</strong></p>${errorHtml(run.error)}<p class="muted">运行 ${esc(run.id)} · ${task.kind==='FROZEN_SCRIPT_RERUN' || run.execution_kind==='FROZEN_SCRIPT_RERUN'?'原脚本复跑（无模型）':'生成期自测'}${run.entry ? ` · 入口：<code>${esc(run.entry)}</code>` : ''}</p>${artifactsHtml(projectId, task.id, run.artifacts, run.script_sha256)}</article>`;
}

export function nativeDshTaskHtml(task, projectId, { open = false } = {}) {
  const active = activeStates.has(task.status), id = esc(task.id), runs = task.runs || [];
  const registrationOnly = task.kind === 'REGISTER_EXISTING_DRAFT';
  return `<details class="panel" data-native-task="${id}"${open ? ' open' : ''}><summary>${esc(task.created_at || '')} · ${esc(registrationOnly && task.status === 'COMPLETED' ? '登记完成 · 未运行' : statusLabel(task.status))} · ${(task.items || []).length} 条用例 · <span data-native-elapsed="${id}">${duration(elapsed(task))}</span></summary><div class="panel-body">
    ${registrationOnly ? '<p class="notice">仅登记已有脚本，未运行不计通过。独立登记会话只使用现有源包副本；本次没有执行证据，已有运行结果保留。</p>' : ''}
    ${task.batch_progress ? `<p role="status"><strong>自动分批进度：第 ${esc(task.batch_progress.current)} / ${esc(task.batch_progress.total)} 批</strong> · 总计 ${esc(task.batch_progress.submitted_cases)} 条 · 整个任务共用时间上限</p>` : ''}
    ${errorHtml(task.error)}${nativeDshDiagnosticsHtml(task, projectId)}
    ${typeof task.revision_notes === 'string' && task.revision_notes ? `<details data-native-revision-notes><summary>本批修订说明（提交时记录）</summary><pre class="preserve-text">${esc(task.revision_notes)}</pre></details>` : ''}
    ${task.preflight ? `<details data-native-preflight><summary>前置预检（不阻塞执行）</summary>${nativeDshPreflightHtml(task.preflight)}</details>` : ''}
    ${task.status === 'STOP_UNCONFIRMED' ? '<p class="notice warning">尚未确认运行进程已停止，暂不能启动新任务或重启工作台。已有结果与证据仍可查看。</p>' : ''}
    ${active ? `<button type="button" class="button" data-native-stop="${id}" ${['STOPPING', 'STOP_UNCONFIRMED'].includes(task.status) ? 'disabled' : ''}>${task.status === 'STOP_UNCONFIRMED' ? '等待停止确认' : task.status === 'STOPPING' ? '正在停止…' : '停止本批'}</button>` : ''}
    <section data-native-process="${id}">${nativeDshProcessHtml(task)}</section>
    <p class="muted">${(task.items || []).map(item => `${esc(item.external_id || item.case_id)}：${esc(statusLabel(item.status))}`).join(' · ')}</p>
    ${(task.drafts || []).filter(draft => draft.schema === 'workbench/native-dsh-draft-v1' && draft.project_id === projectId && draft.task_id === task.id).map(draft => `<details data-native-draft="${esc(draft.id)}"><summary>${esc(draft.external_id)} · ${draft.draft_status === 'BLOCKED_PRECONDITION' ? '前置阻塞 · 未执行' : '稿件已登记 · 未执行'}</summary><p>仅保存稿件；未执行、不计通过，没有执行证据，人工首审未登记。</p>${draft.blocker ? `<p class="notice warning">DSH 报告（未独立核验）：${esc(draft.blocker.code)} · ${esc(draft.blocker.summary)}</p>` : ''}<p>脚本 SHA-256：<code>${esc(draft.script_sha256)}</code></p><p>文件包 SHA-256：<code>${esc(draft.bundle_sha256)}</code></p>${artifactsHtml(projectId, task.id, draft.artifacts, draft.script_sha256)}</details>`).join('')}
    ${runs.length ? runs.map(run => runHtml(run, task, projectId)).join('') : '<p class="muted">尚未收到程序执行记录。</p>'}
    ${task.artifacts?.length ? `<div>任务文件：${artifactsHtml(projectId, task.id, task.artifacts)}</div>` : ''}
    ${task.reply ? `<details><summary>dsh 任务说明</summary><pre class="preserve-text">${esc(task.reply)}</pre></details>` : ''}
    <details><summary>任务与会话编号</summary><p>任务：${id}<br>${registrationOnly ? '独立登记会话' : '项目会话'}：${esc(task.session_id || '尚未建立')}</p></details>
  </div></details>`;
}

export async function renderNativeDsh({ project, query = new URLSearchParams(), showPage, isCurrent = () => true }) {
  const projectId = project.project_id, base = `#/projects/${encodeURIComponent(projectId)}`, endpoint = `/api/case-library/projects/${encodeURIComponent(projectId)}`;
  const items = nativeDshCaseItems(project), selected = new Set(items.filter(item => (query.get('selected') || '').split(',').includes(item.case_id)).map(item => item.case_id));
  let disposed = false, timer, refreshing = false, sending = false, data = null, environment = null, authSession = null, requestIdentity = null, historyFingerprint = '', stateRevision = 0;
  const controllers = new Set(), live = () => !disposed && isCurrent();
  const dispose = () => { disposed = true; clearTimeout(timer); for (const controller of controllers) controller.abort(); controllers.clear(); };
  const request = async (url, options = {}) => {
    const controller = new AbortController(); controllers.add(controller);
    try { return await api(url, { ...options, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }); }
    finally { controllers.delete(controller); }
  };
  showPage(`<div class="page-heading"><div><h1>开始测试</h1><p>DSH 在本项目编写脚本并真实执行；已有脚本、公共函数和页面经验继续保留。</p></div><div class="actions"><a class="button" data-nav href="${base}">返回工作台</a><a class="button" data-nav href="${base}/batches">测试记录与证据</a></div></div>
    <section class="panel native-test-toolbar" aria-label="开始测试与登录准备"><div class="panel-body"><div class="actions"><button class="button primary" id="native-start" disabled>开始测试</button><button class="button" id="native-start-all" disabled>全部开始</button><button class="button" id="native-refresh" type="button">检查准备状态</button><a class="button" data-nav href="${base}/auth">环境与登录</a></div><p id="native-ready" role="status">正在检查测试准备…</p><div class="actions"><button class="button" id="native-login-open" hidden>打开登录窗口</button><button class="button" id="native-login-check" hidden>我已登录，检查状态</button></div><p id="native-error" role="alert"></p></div></section>
    <section id="native-current" aria-label="当前测试进度" aria-live="polite"></section>
    <section class="panel"><div class="panel-body"><p id="native-session" role="status">正在读取项目会话…</p><p id="native-environment" class="muted"></p>
    <label class="field">本批任务模式<select id="native-task-kind"><option value="DSH_GENERATION_SELF_TEST">生成脚本并自测</option><option value="REGISTER_EXISTING_DRAFT">仅登记现有稿件</option></select></label>
    <h2>测试范围与设置</h2><p id="native-mode-description">可一次启动全部用例，程序每 20 条自动分批连续处理。</p>
    <div class="actions"><button class="button" id="native-select-all" type="button">全选</button><button class="button" id="native-select-none" type="button">清空选择</button><label class="field">本批时间上限（分钟）<input id="native-timeout" type="number" min="1" max="120" step="1" value="30"></label></div>
    <p class="muted">达到上限会停止本批并保留已产生的文件与结果。你也可以随时停止。</p>
    <details><summary>选择测试用例（${items.length} 条已确认前端用例）</summary><div class="table-wrap"><table class="pw-table"><thead><tr><th>选择</th><th>测试用例</th><th>版本</th></tr></thead><tbody>${items.map(item => `<tr><td><input type="checkbox" data-native-case="${esc(item.case_id)}" aria-label="选择 ${esc(item.external_id || item.title)}"${selected.has(item.case_id) ? ' checked' : ''}></td><td><small>${esc(item.external_id)}</small><strong>${esc(item.title)}</strong></td><td>v${esc(item.case_version)}</td></tr>`).join('')}</tbody></table></div></details>
    ${items.length ? '' : '<p>暂无已确认的前端用例。请先导入并确认用例正文。</p>'}
    <label class="field">本批修订说明（可选）<textarea id="native-revision-notes" rows="4" maxlength="8000" placeholder="写明本批需要修订的用例与要求"></textarea></label>
    <p class="muted">最多 8000 字符，将随本批任务保存。</p>
    </div></section>
    <details class="panel"><summary>历史任务与故障诊断（保留原始结果）</summary><p class="muted">用例结果、脚本与证据集中在<a data-nav href="${base}/batches">测试记录</a>；以下为历史任务的原始过程，诊断不计用例通过。</p><div id="native-history"></div></details>
    <details class="panel"><summary>DSH 会话与公开对话</summary><button type="button" class="button" id="native-open-session" disabled>在 dsh 中打开此会话</button><p class="muted">只读展示实际输入与公开回复，不会调用模型或新建会话。</p>
    <div class="actions"><button class="button" id="native-transcript-load" type="button" disabled>查看对话</button></div>
    <div id="native-transcript"><p class="muted">点击“查看对话”读取本项目会话记录。</p></div></details>`);
  if (!live()) return dispose;
  const node = selector => document.querySelector(selector);
  const taskKind = () => node('#native-task-kind').value || 'DSH_GENERATION_SELF_TEST';
  const active = () => Boolean(data?.active_task_id) || (data?.tasks || []).some(task => activeStates.has(task.status));
  const busy = () => active() || data?.runtime_busy === true;
  const update = () => {
    if (!live()) return;
    const registrationOnly = taskKind() === 'REGISTER_EXISTING_DRAFT';
    const needsLogin = !registrationOnly && environment?.ui?.auth_required === true;
    const loginReady = !needsLogin || authSession?.status === 'VALID';
    const ready = data?.available === true && loginReady && (registrationOnly || Boolean(environment?.ui_environment_id || environment?.ui?.id));
    node('#native-open-session').disabled = !data?.session_id || data?.can_open_session !== true || data?.available !== true;
    node('#native-open-session').title = data?.session_id
      ? (data?.can_open_session === true && data?.available === true
        ? '在新标签打开本项目的原生 dsh 会话'
        : '原生 dsh 运行时当前不可用，暂时无法打开会话')
      : '本项目尚未建立 dsh 会话';
    const transcriptButton = node('#native-transcript-load');
    if (transcriptButton) {
      // 读取对话不需要 Host 在线（直接读日志），因此只以"有没有会话"为条件。
      transcriptButton.disabled = !data?.session_id;
      transcriptButton.title = data?.session_id ? '读取本项目会话的输入与回复' : '本项目尚未建立 dsh 会话';
    }
    node('#native-start').disabled = sending || !ready || busy() || !selected.size;
    node('#native-start').textContent = sending ? '正在提交…' : `${registrationOnly ? '让 DSH 登记现有稿件' : '开始测试'}${selected.size ? `（${selected.size} 条）` : ''}`;
    node('#native-start-all').hidden = registrationOnly;
    node('#native-start-all').disabled = sending || !ready || busy() || !items.length;
    node('#native-start-all').textContent = `全部开始（${items.length} 条）`;
    node('#native-ready').textContent = needsLogin && !loginReady ? '尚未完成本项目登录，测试还没有开始。打开登录窗口，登录后点击“我已登录，检查状态”。' : !ready ? '请先配置测试环境并确认 DSH 已就绪。' : busy() ? '测试正在处理，进度显示在下方。' : `已选 ${selected.size} 条 / 可测试 ${items.length} 条。超过 20 条自动连续分批；调用真实模型，时间上限为整个任务总上限。`;
    node('#native-login-open').hidden = node('#native-login-check').hidden = !needsLogin || loginReady;
    node('#native-task-kind').disabled = sending || busy();
    node('#native-mode-description').textContent = registrationOnly ? '仅登记已有脚本，未运行不计通过。每次选择一条已有正式脚本，由 DSH 在独立会话核对冻结副本并登记；不生成或修改业务稿，不登录、不访问测试目标，不产生执行证据。已有结果保留。' : '调用真实模型编写或修订脚本并在真实浏览器自测。可全部开始，由程序每 20 条自动连续处理；登录、版本和环境校验仍逐批执行。';
    node('#native-timeout').disabled = sending;
    node('#native-revision-notes').disabled = sending;
    node('#native-select-all').disabled = sending; node('#native-select-none').disabled = sending;
    document.querySelectorAll('[data-native-case]').forEach(input => { input.checked = selected.has(input.dataset.nativeCase); input.disabled = sending; });
    node('#native-session').textContent = registrationOnly && data?.available ? '仅登记模式使用独立任务会话，不读取或覆盖项目主会话；下方主会话对话入口不代表本次登记过程。' : !data ? '项目会话尚未读取' : !data.available ? errors.NATIVE_DSH_UNAVAILABLE : data.tasks?.some(task => task.status === 'STOP_UNCONFIRMED') ? '停止尚未确认，当前执行器仍保留占用；已有证据可继续查看。' : active() ? '本项目任务正在执行；已提交用例自动分批继续，离开页面后仍会运行，再次进入只恢复当前进度。' : data.runtime_busy ? '其他项目正在使用原生 dsh 执行器，结束后可提交本批。' : data.session_id ? '已有项目会话；本批将继续复用项目脚本与探索记录。' : '本批将建立项目会话，后续批次继续复用。';
    node('#native-environment').textContent = environment?.ui ? `当前环境：${environment.ui.name || environment.ui.id || environment.ui_environment_id} · ${environment.ui.entry_url || environment.ui.normal_url || environment.ui.base_url || ''}` : '尚未配置前端环境，请到“环境与登录”完成配置。';
  };
  const renderHistory = () => {
    if (!live()) return;
    const tasks = [...(data?.tasks || [])].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))), fingerprint = nativeDshHistoryFingerprint(tasks);
    const updateProcess = () => {
      document.querySelectorAll('[data-native-elapsed]').forEach(element => { element.textContent = duration(elapsed(tasks.find(task => task.id === element.dataset.nativeElapsed))); });
      document.querySelectorAll('[data-native-process]').forEach(element => {
        const task = tasks.find(item => item.id === element.dataset.nativeProcess);
        if (task) updateNativeDshProcess(element, task);
      });
    };
    if (fingerprint === historyFingerprint) {
      updateProcess();
      return;
    }
    historyFingerprint = fingerprint;
    const openIds = new Set([...document.querySelectorAll('[data-native-task][open]')].map(element => element.dataset.nativeTask));
    const current = tasks.find(task => activeStates.has(task.status));
    node('#native-current').innerHTML = current ? `<h2>当前测试进度</h2>${nativeDshTaskHtml(current, projectId, { open: true })}` : tasks.length ? `<p class="notice">最近任务：${esc(statusLabel(tasks[0].status))} · ${tasks[0].items?.length || 0} 条。<a data-nav href="${base}/batches">查看测试结果与证据</a></p>` : '';
    node('#native-history').innerHTML = tasks.length ? tasks.filter(task => task !== current).map(task => nativeDshTaskHtml(task, projectId, { open: openIds.has(task.id) })).join('') : '<p class="muted">暂无历史任务。</p>';
    document.querySelectorAll('[data-native-stop]').forEach(button => { button.onclick = async () => {
      if (button.disabled || !live()) return; button.disabled = true; button.textContent = '正在停止…'; stateRevision++;
      try { const task = await request(`${endpoint}/native-dsh/tasks/${encodeURIComponent(button.dataset.nativeStop)}/stop`, post({})); if (!live()) return; data.tasks = data.tasks.map(item => item.id === task.id ? task : item); if (!activeStates.has(task.status) && data.active_task_id === task.id) data.active_task_id = null; renderHistory(); update(); await refresh(); }
      catch (error) { if (live()) { node('#native-error').textContent = errorMessage(error); button.disabled = false; button.textContent = '停止本批'; } }
    }; });
    updateProcess();
  };
  const refresh = async ({ withEnvironment = false } = {}) => {
    if (refreshing || !live()) return; refreshing = true; clearTimeout(timer); const revision = stateRevision;
    try {
      const [next, env] = await Promise.all([request(`${endpoint}/native-dsh`), withEnvironment || !environment ? request(`${endpoint}/environment`) : Promise.resolve(environment)]);
      const session = env?.ui?.auth_required ? (await request(`${endpoint}/auth?environment_id=${encodeURIComponent(env.ui_environment_id)}&role=${encodeURIComponent(env.ui.auth_role || '')}`)).session : null;
      if (!live() || revision !== stateRevision) return; data = next; environment = env; authSession = session; update(); renderHistory();
    } catch (error) { if (live()) node('#native-error').textContent = errorMessage(error); }
    finally { refreshing = false; if (live() && busy()) timer = setTimeout(() => void refresh(), 2500); }
  };
  document.querySelectorAll('[data-native-case]').forEach(input => { input.onchange = () => { input.checked ? selected.add(input.dataset.nativeCase) : selected.delete(input.dataset.nativeCase); update(); }; });
  node('#native-select-all').onclick = () => { for (const item of items) selected.add(item.case_id); update(); };
  node('#native-select-none').onclick = () => { selected.clear(); update(); };
  node('#native-task-kind').onchange = () => { requestIdentity = null; update(); };
  node('#native-refresh').onclick = () => { node('#native-error').textContent = ''; void refresh({ withEnvironment: true }); };
  for (const [selector, operation] of [['#native-login-open', 'open'], ['#native-login-check', 'check']]) node(selector).onclick = async () => {
    const button = node(selector); if (button.disabled || sending || busy()) return;
    button.disabled = true;
    try { authSession = await request(`${endpoint}/auth/${operation}`, post({ environment_id: environment.ui_environment_id, role: environment.ui.auth_role, ...(operation === 'check' ? { confirm_login: true } : {}) })); await refresh(); }
    catch (error) { node('#native-error').textContent = errorMessage(error); }
    finally { if (live()) button.disabled = false; }
  };
  /**
   * 打开项目的原生 dsh 会话。
   *
   * 两条实测走过的弯路（都不要再走）：
   *   1) 原生表单提交 —— 被工作台页面的 `Content-Security-Policy: … form-action 'none'` 静默拦掉；
   *      而且 form-action 逐跳校验，重定向终点是另一个源的 dsh Host，放宽到 'self' 也没用。
   *   2) 前端 fetch 跟随重定向 —— 跨源跳转需要 CORS，Host 不返回 CORS 头，直接 Failed to fetch。
   * 因此改为：由同源服务端解析出目标地址（服务端不受上述两条限制），前端只负责导航。
   * 真正的跳转与一次性 cookie 仍由浏览器完成。
   */
  node('#native-open-session').onclick = async () => {
    const button = node('#native-open-session');
    if (button.disabled || !live()) return;
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = '正在打开…';
    let target = null;
    try {
      // 先开占位窗口，避免等响应回来再开窗被当成非用户手势而拦截；失败即关掉，不留白页。
      target = window.open('about:blank', '_blank');
      if (!target) throw Object.assign(new Error('POPUP_BLOCKED'), {code: 'POPUP_BLOCKED'});
      const resolved = await request(`${endpoint}/native-dsh/session-url`, { method: 'POST' });
      const url = resolved?.url;
      if (!url || !/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(url)) {
        throw Object.assign(new Error('BAD_TARGET'), {code: 'BAD_TARGET'});
      }
      target.location.replace(url);
    } catch (error) {
      if (target) { try { target.close(); } catch { /* 关闭失败无需处理 */ } }
      const code = error?.code || error?.message || 'OPEN_FAILED';
      node('#native-error').textContent = code === 'POPUP_BLOCKED'
        ? '浏览器拦截了新窗口。请允许本站弹出窗口后重试。'
        : `打开会话失败（${code}）。若持续失败，请重新读取状态后再试。`;
    } finally {
      if (live()) { button.disabled = false; button.textContent = previous; }
    }
  };
  node('#native-transcript-load').onclick = async () => {
    const button = node('#native-transcript-load'), target = node('#native-transcript');
    if (button.disabled || !live()) return;
    button.disabled = true; button.textContent = '正在读取…';
    try {
      const transcript = await request(`${endpoint}/native-dsh/transcript`);
      if (!live()) return;
      target.innerHTML = nativeDshTranscriptHtml(transcript);
      const jump=target.querySelector('[data-native-transcript-jump]');
      if(jump)jump.onclick=()=>{
        const latest=target.querySelector('[data-native-transcript-latest]');
        if(!latest)return;
        // Account for the pinned test controls so the reply heading stays visible.
        const toolbar=node('.native-test-toolbar');
        latest.style.scrollMarginTop=`${Math.max(90,Math.ceil(toolbar?.getBoundingClientRect().bottom||0)+16)}px`;
        latest.focus({preventScroll:true});latest.scrollIntoView({block:'start',behavior:'auto'});
      };
    } catch (error) { if (live()) target.innerHTML = `<p class="notice">读取对话失败：${esc(errorMessage(error))}</p>`; }
    finally { if (live()) { button.disabled = !data?.session_id; button.textContent = '重新读取对话'; } }
  };
  node('#native-start').onclick = async () => {
    if (sending || busy() || !live()) return;
    let input;
    try {
      input = nativeDshTaskInput({ items, selected, environmentId: environment?.ui_environment_id || environment?.ui?.id, requestId: '', timeoutMinutes: Number(node('#native-timeout').value), revisionNotes: node('#native-revision-notes').value, kind: taskKind() });
      const identity = JSON.stringify(input);
      if (requestIdentity?.identity !== identity) requestIdentity = { identity, requestId: `native-${crypto.randomUUID()}` };
      input.request_id = requestIdentity.requestId;
    } catch (error) { node('#native-error').textContent = errorMessage(error); return; }
    sending = true; stateRevision++; node('#native-error').textContent = ''; update();
    try {
      const task = await request(`${endpoint}/native-dsh/tasks`, post(input));
      if (!live()) return;
      requestIdentity = null; data = { ...data, active_task_id: activeStates.has(task.status) ? task.id : null, tasks: [task, ...(data?.tasks || []).filter(item => item.id !== task.id)] };
      selected.clear(); node('#native-revision-notes').value = ''; renderHistory(); await refresh();
    } catch (error) { if (live()) node('#native-error').textContent = errorMessage(error); }
    finally { sending = false; update(); }
  };
  node('#native-start-all').onclick = async () => { if (node('#native-start-all').disabled) return; for (const item of items) selected.add(item.case_id); update(); await node('#native-start').onclick(); };
  await refresh({ withEnvironment: true });
  return dispose;
}
