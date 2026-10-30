import { caseAssistantApi } from './case-assistant-api.js';
import { requirementsApi as sourceApi } from './requirements-api.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const rows = value => Array.isArray(value) ? value : [];
const sourceId = source => source.snapshot_id || source.source_id;
const sourceName = source => (source.file_name || source.fileName || sourceId(source)) + (source.reading_method === 'local-office' ? ` · ${source.reading?.provider === 'wps' ? 'WPS' : 'Word'} 部分读取` : '');
const drafts = new Map();
const activeStatus = status => ['RUNNING', 'QUEUED', 'CANCEL_REQUESTED'].includes(status);
const pathFor = projectId => `#/projects/${encodeURIComponent(projectId)}/requirements`;
const issueText = issue => typeof issue === 'string' ? issue : issue?.message || issue?.question || issue?.text || issue?.code || '待补充';
export function assistantLocalWordPath(text) {
  const value=String(text || '').trim().replace(/^"([^"\r\n]+)"$/,'$1');
  return /^[a-z]:[\\/][^\r\n\0]*\.docx$/i.test(value) && value.length<=2000 ? value : null;
}

export function activeAssistantConversation(listing, projectId) {
  const capability = listing?.capabilities;
  if (capability?.project_id === projectId && capability.active_turn_id && capability.conversation_id) return capability.conversation_id;
  return rows(listing?.conversations).find(item => item.active_turn_id)?.id || '';
}

export function assistantErrorText(error) {
  const code = error?.code || error?.message || (typeof error === 'string' ? error : '');
  return ({
    WORKBENCH_UNREACHABLE: '暂时无法连接工作台，输入和已上传资料已保留。请恢复连接后重试。',
    CASE_ASSISTANT_UNAVAILABLE: 'AI 用例助手尚未启用。请先配置模型密钥，等任务结束后正常停止工作台，再运行“启用模型工作台.cmd”。当前可先添加资料，启用后再发送。',
    CASE_ASSISTANT_MODEL_UNAVAILABLE: 'AI 用例助手尚未启用。请先配置模型密钥，再用“启用模型工作台.cmd”启动；已运行时请先正常停止。',
    CASE_ASSISTANT_DSH_UNAVAILABLE: 'AI 用例助手运行环境不完整，请重新运行安装与环境检查，并用“启用模型工作台.cmd”启动。',
    CASE_ASSISTANT_CREDENTIALS_UNAVAILABLE: '模型连接配置尚未完成，请联系工作台管理员。',
    CASE_ASSISTANT_DSH_CONFIG_INVALID: '模型连接配置不可用，请联系工作台管理员检查。',
    CASE_ASSISTANT_TIMED_OUT: '本轮处理超时，资料和对话已保留。请缩小测试范围后继续。',
    CASE_ASSISTANT_SOURCE_LIMIT: '所选资料超过本轮处理上限，请分成不同对话处理。',
    CASE_ASSISTANT_INPUT_LIMIT_EXCEEDED: '对话或资料超过处理上限，请缩小范围，或新建对话。',
    CASE_ASSISTANT_CONVERSATION_LIMIT: '这段对话已达到处理上限，请新建对话并选取所需资料。',
    CASE_ASSISTANT_SERVICE_STOPPING: '工作台正在重启或暂停接收任务，请稍后再发送。',
    CASE_ASSISTANT_INTERRUPTED: '工作台重启中断了本轮处理，资料和对话已保留，可以继续。',
    CASE_ASSISTANT_BUSY: '这段对话仍在处理中，请等本轮结束后再补充。',
    CASE_ASSISTANT_TURN_ACTIVE: '这段对话仍在处理中，请等本轮结束后再补充。',
    CASE_ASSISTANT_CONVERSATION_NOT_FOUND: '未找到这段对话。请从历史对话重新选择。',
    CASE_ASSISTANT_OUTPUT_INVALID: 'AI 返回的内容未通过格式检查。请在对话中补充说明并重试。',
    CASE_ASSISTANT_TOOL_JSON_INVALID: '模型返回的用例数据格式仍不正确，本轮未完成。资料、对话和之前已完成的草稿已保留，可缩小范围后继续。',
    CASE_ASSISTANT_EXPORT_EMPTY: '本轮还没有格式合格的用例草稿，请让助手修正格式后再下载。',
    CASE_ASSISTANT_EXPORT_RESPONSE_INVALID: '下载内容不是 Excel 文件，请重试或联系管理员。',
    REQUIREMENT_FILE_TYPE_UNSUPPORTED: '请上传 Word（.docx）、Markdown 或 PNG/JPEG 截图。',
    REQUIREMENT_OFFICE_REQUIRED: '未找到可用的本机 Word/WPS 文字自动化接口。请确认已安装并激活相应软件，且企业允许本机读取。',
    REQUIREMENT_OFFICE_BUSY: 'WPS 未提供独立读取实例。请在 WPS 打开并保存这份原始文档，将原始 .docx 完整路径单独粘贴到下方输入框后发送，以读取已打开的原件。',
    REQUIREMENT_OFFICE_UNSAVED: '这份原件在 WPS 中有未保存修改，请保存后重试，以确保引用内容与原件一致。',
    REQUIREMENT_OFFICE_PERMISSION_DENIED: '本机 Word/WPS 未获准读取这份文档，请确认企业文档权限。原文件未修改。',
    REQUIREMENT_OFFICE_OPEN_FAILED: '当前方式未能读取文档。可在当前输入框单独粘贴原始 .docx 文件的完整路径，再点击发送，由本机 Word/WPS 读取。仍失败时请检查文档权限。',
    REQUIREMENT_OFFICE_PATH_INVALID: '请在当前输入框粘贴本机原始 .docx 文件的完整路径，例如 D:\\需求资料\\需求.docx。',
    REQUIREMENT_OFFICE_TIMEOUT: '本机文档读取超时，请检查 Word/WPS 的登录或权限提示后重试。',
    REQUIREMENT_OFFICE_CANCELLED: '已取消本机文档读取，原文件与已有资料保留。',
    REQUIREMENT_OFFICE_EMPTY: 'Word 已打开文件，但没有提取到正文或表格；图片等对象尚未读取。',
    REQUIREMENT_OFFICE_LIMIT: '这份 Word 的可提取内容超过本轮读取上限，请拆分资料。',
    REQUIREMENT_FILE_TOO_LARGE: '资料文件过大，请拆分资料后重新上传。',
    HTTP_404: '当前服务尚未加载 AI 用例助手，请联系管理员更新工作台。',
  })[code] || '本轮未完成，输入和已上传资料已保留。请查看原因后继续补充，或稍后重试。';
}

export function assistantProgressHtml(turn, now = Date.now()) {
  if (!turn || !activeStatus(turn.status)) return '';
  const stage = ({ PREPARING: '正在整理资料与对话', STARTING: '正在连接用例助手', THINKING: '正在分析资料与业务规则', REPAIRING_FORMAT: '正在修正数据格式，已暂存用例保留', READING: '正在阅读资料', READING_MATERIALS: '正在阅读需求文档', READING_IMAGES: '正在查看原型截图', GENERATING: '正在设计测试用例', CHECKING: '正在检查步骤、预期和文件格式', CHECKING_DRAFT: '正在检查用例草稿', EXPORTING: '正在准备 Excel', CANCELLING: '正在停止本轮处理' })[turn.stage] || '正在阅读资料、整理问题与测试用例';
  const start = Date.parse(turn.created_at || '');
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : null;
  return `<strong>${esc(turn.status === 'CANCEL_REQUESTED' ? '正在停止' : stage)}</strong><p>${seconds === null ? '' : `已用 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒 · `}状态自动更新，离开页面后仍会继续。</p><progress aria-label="AI 正在处理，尚无可计算的完成百分比"></progress><div class="actions"><button class="button small" type="button" data-ca-cancel ${turn.status === 'CANCEL_REQUESTED' ? 'disabled' : ''}>停止本轮</button></div>`;
}

function contentWarningCount(item) {
  const count = item.checks?.content_warning_count;
  return Number.isInteger(count) && count >= 0 ? count : rows(item.checks?.issues).filter(issue => issue?.severity === 'WARNING').length || rows(item.pending_questions).length;
}

function caseHtml(item) {
  const ready = item.checks?.ready === true;
  return `<details class="ca-case"><summary><strong>${esc(item.external_id || item.case_id)} · ${esc(item.title)}</strong><span class="badge">${item.case_type === 'BACKEND' ? '后端' : item.case_type === 'UI' ? '前端' : '未分类'}</span><span class="badge ${ready ? '' : 'warning'}">${ready ? '内容待核对' : '格式待修正'}</span></summary><div class="ca-case-content"><dl><dt>模块</dt><dd>${esc(item.module || '未提供')}</dd><dt>前置条件</dt><dd>${esc(item.preconditions || '未提供')}</dd><dt>测试数据</dt><dd>${esc(item.test_data || '未提供')}</dd></dl>${rows(item.steps).map(step => `<div class="ca-step"><strong>步骤 ${esc(step.order)}</strong><p>${esc(step.action)}</p><small>预期结果</small><p>${esc(step.expected || '待补充')}</p></div>`).join('')}${rows(item.pending_questions).length ? `<div class="ca-questions"><strong>内容待补充，可在 Excel 中修改</strong><ul>${item.pending_questions.map(q => `<li>${esc(issueText(q))}</li>`).join('')}</ul></div>` : ''}${rows(item.checks?.issues).length ? `<ul>${item.checks.issues.map(issue => `<li>${esc(issueText(issue))}</li>`).join('')}</ul>` : ''}</div></details>`;
}

export function assistantSourceFilesHtml({ selectedIds = [], files = [], sources = [], conversationSourceIds = [], disabled = false }) {
  const existing = new Map(sources.map(source => [sourceId(source), source]));
  const retained = new Set(conversationSourceIds);
  return [...new Set([...conversationSourceIds, ...selectedIds])].map(id => {
    const name = sourceName(existing.get(id) || { source_id: id });
    return `<span class="ca-file"><span>${esc(name)}${retained.has(id) ? ' · 已在本对话' : ''}</span>${retained.has(id) ? '' : `<button type="button" data-ca-remove-source="${esc(id)}" aria-label="移除资料 ${esc(name)}" ${disabled ? 'disabled' : ''}>×</button>`}</span>`;
  }).join('') + files.map((file, i) => `<span class="ca-file"><span>${esc(file.name)} · 待上传</span><button type="button" data-ca-remove-file="${i}" aria-label="移除文件 ${esc(file.name)}" ${disabled ? 'disabled' : ''}>×</button></span>`).join('');
}

export function assistantSourcePickerHtml({ sources = [], selectedIds = [], conversationSourceIds = [], disabled = false }) {
  const selected = new Set(selectedIds), retained = new Set(conversationSourceIds);
  return sources.length ? sources.map(source => {
    const id = sourceId(source), inConversation = retained.has(id);
    return `<label class="ca-source-option"><input type="checkbox" data-ca-source="${esc(id)}" ${selected.has(id) || inConversation ? 'checked' : ''} ${disabled || inConversation ? 'disabled' : ''}><span>${esc(sourceName(source))}${inConversation ? ' · 已在本对话' : ''}</span></label>`;
  }).join('') : '<p class="muted">还没有已上传资料。</p>';
}

function imageObservationsHtml(turn) {
  const images = rows(turn.image_observations);
  if (!images.length) return '';
  return `<details class="ca-checks"><summary>查看截图读取情况（${images.length} 张）</summary><p class="ca-result-note">以下是图片中的可见内容，不能代替业务规则。</p>${images.map((image, i) => `<h3>截图 ${i + 1}</h3><ul>${rows(image.observations).map(item => `<li>${esc(typeof item === 'string' ? item : item?.description)}${item?.location ? `（${esc(item.location)}）` : ''}</li>`).join('')}</ul>${rows(image.uncertainties).length ? `<strong>截图无法确认</strong><ul>${image.uncertainties.map(item => `<li>${esc(issueText(item))}</li>`).join('')}</ul>` : ''}`).join('')}</details>`;
}

export function assistantResultContext(conversation, selectedTurnId) {
  const turns = rows(conversation?.turns);
  const index = turns.findIndex(turn => turn.id === selectedTurnId);
  if (index < 0) return { heading: '用例结果', notice: '' };
  const current = turns.at(-1), selected = turns[index];
  const running = activeStatus(current?.status);
  const previousCompleted = turns.filter(turn => turn.status === 'COMPLETED').at(-1);
  const suffix = current.id === selected.id ? '' : running && previousCompleted?.id === selected.id ? '（上一轮已完成）' : '（历史结果）';
  return { heading: `第 ${index + 1} 轮用例${suffix}`, notice: running ? `本轮正在处理，以下为第 ${index + 1} 轮已保存结果。` : '' };
}

export function assistantResultHtml(turn, { heading = '本轮用例', notice = '' } = {}) {
  if (!turn) return '';
  const cases = rows(turn.cases);
  const ui = cases.filter(item => item.case_type === 'UI' && item.checks?.ready === true).length;
  const backend = cases.filter(item => item.case_type === 'BACKEND' && item.checks?.ready === true).length;
  const issues = rows(turn.checks?.issues);
  const pending = cases.filter(item => item.checks?.ready !== true).length;
  const contentWarnings = cases.filter(item => contentWarningCount(item) > 0).length;
  const failed = ['FAILED', 'INTERRUPTED', 'CANCELLED'].includes(turn.status);
  const terminalNotice = failed ? `<div class="notice warning"><strong>${turn.status === 'CANCELLED' ? '本轮已停止' : turn.status === 'INTERRUPTED' ? '本轮处理已中断' : '本轮未完成'}</strong><p>${esc(turn.status === 'CANCELLED' ? '已保存的对话和资料保留，可以继续补充。' : assistantErrorText(turn.error))}</p>${turn.error ? `<details><summary>查看原因</summary><p>${esc(issueText(turn.error))}</p></details>` : ''}</div>` : '';
  if (!cases.length && !issues.length) return terminalNotice;
  const canExport = turn.status === 'COMPLETED';
  return `${terminalNotice}<div class="ca-result-header"><div><h2>${esc(heading)}</h2>${notice ? `<p>${esc(notice)}</p>` : ''}<p>可下载草稿 ${ui + backend} 条${pending ? ` · 格式待修正 ${pending} 条` : ''}${contentWarnings ? ` · 含内容提示 ${contentWarnings} 条` : ''}</p></div></div><div class="ca-downloads"><button class="button primary" type="button" data-ca-export="UI" data-turn-id="${esc(turn.id)}" ${!ui || !canExport ? 'disabled' : ''}>下载前端 Excel 草稿（${ui}）</button><button class="button" type="button" data-ca-export="BACKEND" data-turn-id="${esc(turn.id)}" ${!backend || !canExport ? 'disabled' : ''}>下载后端 Excel 草稿（${backend}）</button></div><p class="ca-result-note">用例均为待确认、未执行。业务疑问不影响下载格式合格的草稿；请由测试工程师核对、修改后自行导入用例库。格式检查不保证业务内容正确。</p>${issues.length ? `<details class="ca-checks"><summary>检查提示（${issues.length} 项）</summary><ul>${issues.map(issue => `<li>${issue.case_id ? `${esc(issue.case_id)}：` : ''}${esc(issueText(issue))}</li>`).join('')}</ul></details>` : ''}${imageObservationsHtml(turn)}${cases.map(caseHtml).join('')}`;
}

export function assistantMessagesHtml(conversation) {
  const turns = rows(conversation?.turns);
  const messages = rows(conversation?.messages);
  if (!messages.length) return '<div class="ca-empty"><h2>把资料交给助手，一起把用例写清楚</h2><p>上传 PRD、业务说明或墨刀截图，说明测试范围。助手整理成 Excel 草稿，你可以继续对话修改，也可以下载后自行编辑、核对。</p></div>';
  return messages.map(message => {
    const assistant = message.role === 'assistant';
    const turn = turns.find(item => item.user_message_id === message.id);
    const responseAlreadySaved = turn && messages.some(item => item.role === 'assistant' && (item.turn_id === turn.id || (turn.reply && item.text === turn.reply)));
    const response = turn && !responseAlreadySaved && turn.reply ? `<article class="ca-message ca-message-assistant"><header><strong>用例助手</strong></header><p>${esc(turn.reply)}</p></article>` : '';
    const questionTurn = assistant ? turns.find(item => item.id === message.turn_id) : responseAlreadySaved ? null : turn;
    const latestQuestions = questionTurn?.id === turns.at(-1)?.id && questionTurn?.status === 'COMPLETED';
    const questionList = questionTurn && rows(questionTurn.questions).length ? `<ol>${questionTurn.questions.map(q => `<li>${esc(issueText(q))}</li>`).join('')}</ol>` : '';
    const questions = !questionList ? '' : latestQuestions
      ? `<div class="ca-questions"><h3>待核对的业务信息</h3>${questionList}<p>可在下方补充，也可在 Excel 草稿中修改。</p></div>`
      : `<details class="ca-history-questions"><summary>第 ${turns.indexOf(questionTurn) + 1} 轮当时的待补充问题（${questionTurn.questions.length} 项）</summary>${questionList}</details>`;
    return `<article class="ca-message ca-message-${assistant ? 'assistant' : 'user'}"><header><strong>${assistant ? '用例助手' : '你'}</strong></header><p>${esc(message.text)}</p></article>${response}${questions}`;
  }).join('');
}

// One in-flight read; a stopped or replaced page never paints an old response.
export function createAssistantPoller({ read, apply, onError, isCurrent = () => true, intervalMs = 2000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let stopped = false, timer = null;
  async function poll() {
    timer = null;
    if (stopped || !isCurrent()) return;
    let again = true;
    try {
      const conversation = await read();
      if (stopped || !isCurrent()) return;
      apply(conversation);
      again = Boolean(conversation.active_turn_id) || rows(conversation.turns).some(turn => activeStatus(turn.status));
    } catch (error) { if (!stopped && isCurrent()) onError(error); }
    if (again && !stopped && isCurrent()) timer = setTimer(poll, intervalMs);
  }
  timer = setTimer(poll, intervalMs);
  return () => { stopped = true; clearTimer(timer); timer = null; };
}

function loadDraft(key) {
  if (drafts.has(key)) return drafts.get(key);
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { /* Memory still preserves the draft if storage is unavailable. */ }
  const draft = { text: saved.text || '', sourceIds: new Set(rows(saved.sourceIds)), files: [], request: saved.request || null };
  drafts.set(key, draft);
  return draft;
}
function saveDraft(key, draft) {
  try { sessionStorage.setItem(key, JSON.stringify({ text: draft.text, sourceIds: [...draft.sourceIds], request: draft.request })); } catch { /* A full/blocked storage must not discard the in-memory draft. */ }
}

export async function renderCaseAssistant({ project, query = new URLSearchParams(), showPage, go, isCurrent = () => true, assistantApi = caseAssistantApi, requirementsApi = sourceApi, root = globalThis.document }) {
  const projectId = project.project_id;
  const route = pathFor(projectId);
  const activeKey = `case-assistant-active:${projectId}`;
  let alive = true, generation = 0, conversation = null, index = [], sources = [], capability = true, busy = false, selectedTurnId = '', stopPolling = null;
  let storedId = '';
  try { storedId = sessionStorage.getItem(activeKey) || ''; } catch { /* Optional restoration only. */ }
  let conversationId = query.get('conversation') || (query.has('new') ? '' : storedId);
  let draftKey = `case-assistant-draft:${projectId}:${conversationId || 'new'}`;
  let draft = loadDraft(draftKey);
  const current = () => alive && isCurrent();
  const find = selector => root.querySelector(selector);
  const all = selector => root.querySelectorAll(selector);
  const remember = () => { try { if (conversationId) sessionStorage.setItem(activeKey, conversationId); else sessionStorage.removeItem(activeKey); } catch { /* Optional restoration only. */ } };
  const setError = error => { if (!current()) return; const node = find('[data-ca-error]'); if (node) node.innerHTML = error ? `<div class="notice warning" role="alert"><p>${esc(assistantErrorText(error))}</p><details><summary>查看原因</summary><p>${esc(error.code || error.message || issueText(error))}</p></details></div>` : ''; };
  const activeTurn = () => rows(conversation?.turns).find(turn => turn.id === conversation?.active_turn_id) || rows(conversation?.turns).find(turn => activeStatus(turn.status));
  const materialsDisabled = () => busy || Boolean(activeTurn());
  const disabled = () => materialsDisabled() || !capability;

  function paintFiles() {
    if (!current()) return;
    const conversationSourceIds = rows(conversation?.source_ids);
    const retained = new Set(conversationSourceIds);
    const list = find('[data-ca-files]');
    if (list) list.innerHTML = assistantSourceFilesHtml({ selectedIds: [...draft.sourceIds], files: draft.files, sources, conversationSourceIds, disabled: materialsDisabled() });
    const picker = find('[data-ca-source-list]');
    if (picker) picker.innerHTML = assistantSourcePickerHtml({ sources, selectedIds: [...draft.sourceIds], conversationSourceIds, disabled: materialsDisabled() });
    for (const node of all('[data-ca-remove-source]')) node.addEventListener('click', () => { if (retained.has(node.dataset.caRemoveSource)) return; draft.sourceIds.delete(node.dataset.caRemoveSource); saveDraft(draftKey, draft); paintFiles(); });
    for (const node of all('[data-ca-remove-file]')) node.addEventListener('click', () => { draft.files.splice(Number(node.dataset.caRemoveFile), 1); paintFiles(); });
    for (const node of all('[data-ca-source]')) node.addEventListener('change', () => { if (retained.has(node.dataset.caSource)) return; if (node.checked) draft.sourceIds.add(node.dataset.caSource); else draft.sourceIds.delete(node.dataset.caSource); saveDraft(draftKey, draft); paintFiles(); });
  }

  function paintControls() {
    if (!current()) return;
    const send = find('[data-ca-send]');
    if (send) { send.disabled = materialsDisabled() || (!capability && !assistantLocalWordPath(draft.text)); send.textContent = busy ? '正在提交…' : activeTurn() ? '正在处理…' : '发送'; }
    const upload = find('[data-ca-upload]'); if (upload) upload.disabled = materialsDisabled();
    const fresh = find('[data-ca-new]'); if (fresh) { fresh.disabled = busy || Boolean(activeTurn()); fresh.title = activeTurn() ? '本项目正在生成用例，请继续查看当前进度，完成后可新建对话。' : ''; }
  }

  function paintConversation() {
    if (!current()) return;
    find('[data-ca-messages]').innerHTML = assistantMessagesHtml(conversation);
    find('[data-ca-progress]').innerHTML = assistantProgressHtml(activeTurn());
    const turns = rows(conversation?.turns).filter(turn => !activeStatus(turn.status));
    if (!turns.some(turn => turn.id === selectedTurnId)) selectedTurnId = turns.at(-1)?.id || '';
    const selected = turns.find(turn => turn.id === selectedTurnId);
    const resultNode = find('[data-ca-results]');
    resultNode.hidden = !selected;
    resultNode.innerHTML = `${turns.length > 1 ? `<label class="ca-turn-select">查看结果<select data-ca-turn>${turns.map((turn, i) => `<option value="${esc(turn.id)}" ${turn.id === selectedTurnId ? 'selected' : ''}>第 ${rows(conversation.turns).indexOf(turn) + 1} 轮${i === turns.length - 1 ? '（最新记录）' : ''}</option>`).join('')}</select></label>` : ''}${assistantResultHtml(selected, assistantResultContext(conversation, selectedTurnId))}`;
    find('[data-ca-turn]')?.addEventListener('change', event => { selectedTurnId = event.target.value; paintConversation(); });
    find('[data-ca-cancel]')?.addEventListener('click', async event => {
      event.target.disabled = true;
      try { const next = await assistantApi.cancel(projectId, conversationId); if (!current()) return; conversation = next; paintConversation(); }
      catch (error) { setError(error); if (current()) paintConversation(); }
    });
    for (const button of all('[data-ca-export]')) button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const file = await assistantApi.export(projectId, conversationId, button.dataset.turnId, button.dataset.caExport);
        if (!current()) return;
        const url = URL.createObjectURL(file.blob);
        const anchor = root.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { setError(error); }
      finally { if (current()) button.disabled = false; }
    });
    paintControls();
  }

  function poll() {
    stopPolling?.(); stopPolling = null;
    if (!activeTurn() || !conversationId) return;
    const expectedId = conversationId, epoch = generation;
    stopPolling = createAssistantPoller({
      read: () => assistantApi.get(projectId, expectedId),
      isCurrent: () => current() && generation === epoch && conversationId === expectedId,
      apply: next => { const wasActive = activeTurn(); conversation = next; if (wasActive && !activeTurn()) selectedTurnId = ''; setError(null); paintConversation(); if (!activeTurn()) paintFiles(); },
      onError: setError,
    });
  }

  async function send(event) {
    event.preventDefault();
    if (!current() || materialsDisabled()) return;
    draft.text = find('[data-ca-text]').value;
    const originalPath=assistantLocalWordPath(draft.text);
    if (originalPath) { await addLocalOffice(originalPath); return; }
    if (!capability) { setError(new Error('CASE_ASSISTANT_UNAVAILABLE')); return; }
    if (!draft.text.trim() && !draft.files.length && !draft.sourceIds.size) { find('[data-ca-text]').focus(); return; }
    busy = true; setError(null); paintControls(); paintFiles();
    try {
      while (draft.files.length) {
        const file = draft.files[0];
        const saved = await requirementsApi.upload(projectId, { kind: /\.(png|jpe?g)$/i.test(file.name) ? 'IMAGE' : 'PRD', fileName: file.name, body: file });
        const source = saved.source || saved.snapshot || saved;
        const id = sourceId(source);
        if (!id) throw new Error('REQUIREMENT_UPLOAD_RESPONSE_INVALID');
        if (!sources.some(row => sourceId(row) === id)) sources.push(source);
        draft.sourceIds.add(id); draft.files.shift(); saveDraft(draftKey, draft);
        if (!current()) return;
        paintFiles();
      }
      if (!conversationId) {
        conversation = await assistantApi.create(projectId, {});
        if (conversation.active_turn_id) {
          saveDraft(draftKey, draft);
          if (go) go(`${route}?conversation=${encodeURIComponent(conversation.id)}`);
          else {
            conversationId = conversation.id; draftKey = `case-assistant-draft:${projectId}:${conversationId}`; draft = loadDraft(draftKey);
            find('[data-ca-text]').value = draft.text; remember(); paintConversation(); paintFiles(); poll();
          }
          return;
        }
        conversationId = conversation.id;
        if (!conversationId) throw new Error('CASE_ASSISTANT_CONVERSATION_INVALID');
        const previousKey = draftKey;
        draftKey = `case-assistant-draft:${projectId}:${conversationId}`;
        drafts.set(draftKey, draft); saveDraft(draftKey, draft); drafts.delete(previousKey);
        try { sessionStorage.removeItem(previousKey); } catch { /* Optional storage cleanup. */ }
        remember();
        if (!current()) return;
      }
      const text = draft.text.trim() || '请根据这些资料整理可导入的 Excel 用例草稿，信息不足处标为待补充，业务内容由测试工程师核对。';
      const source_ids = [...draft.sourceIds].sort();
      const fingerprint = JSON.stringify({ text, source_ids });
      if (draft.request?.fingerprint !== fingerprint) draft.request = { fingerprint, request_id: crypto.randomUUID() };
      saveDraft(draftKey, draft);
      const submittedText = draft.text;
      const next = await assistantApi.send(projectId, conversationId, { request_id: draft.request.request_id, text, source_ids });
      conversation = next;
      // Keep edits typed while submitting; clear only text the server accepted.
      if (draft.text === submittedText) draft.text = '';
      draft.request = null; saveDraft(draftKey, draft);
      selectedTurnId = '';
      if (!current()) return;
      if (go && query.get('conversation') !== conversationId) { go(`${route}?conversation=${encodeURIComponent(conversationId)}`); return; }
      find('[data-ca-text]').value = draft.text;
      paintConversation(); poll();
    } catch (error) {
      setError(error);
      // A lost response may follow an accepted POST. Read its status, never
      // resend automatically or invent a completed state.
      if (conversationId && current()) {
        try {
          const next = await assistantApi.get(projectId, conversationId);
          if (current()) { conversation = next; paintConversation(); poll(); }
        } catch { /* Keep the original submission error and draft. */ }
      }
    }
    finally { busy = false; if (current()) { paintControls(); paintFiles(); } }
  }

  async function addLocalOffice(originalPath) {
    if (!current() || materialsDisabled()) return;
    busy = true; setError(null); paintControls(); paintFiles();
    const progress = find('[data-ca-progress]');
    if (progress) progress.textContent = '正在使用本机 Word/WPS 只读提取正文与表格…';
    const submittedText=draft.text;
    let loaded=false;
    try {
      const saved = await requirementsApi.uploadOffice(projectId, originalPath);
      if (!current()) return;
      const source = saved.source || saved.snapshot || saved, id = sourceId(source);
      if (!id) throw new Error('REQUIREMENT_UPLOAD_RESPONSE_INVALID');
      if (!sources.some(row => sourceId(row) === id)) sources.push(source);
      draft.sourceIds.add(id);
      // Replace only a pending upload proven to be this same original file.
      const remaining=[];
      for (const file of draft.files) {
        if (file.name===source.file_name && file.size===source.bytes) {
          const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
          const hash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
          if (hash===source.sha256) continue;
        }
        remaining.push(file);
      }
      draft.files=remaining;
      if (draft.text===submittedText) { draft.text=''; find('[data-ca-text]').value=''; }
      loaded=true; saveDraft(draftKey,draft);
    } catch (error) { setError(error); }
    finally { busy = false; if (current()) { paintConversation(); paintFiles(); if(loaded && progress) progress.textContent='文档正文与表格已读取，图片等内容尚未读取。请继续在这里输入测试范围，再发送给助手。'; } }
  }

  showPage(`<div class="case-assistant"><div class="page-heading"><div><h1>AI 用例助手</h1><p>辅助测试工程师编写用例，整理为可导入的 Excel 草稿；业务内容由你核对。</p></div><div class="actions"><a class="button" data-nav href="#/projects/${encodeURIComponent(projectId)}/cases">返回用例库</a></div></div><div data-ca-error class="ca-inline-error"></div><details class="ca-history"><summary>历史对话与旧版资料</summary><div data-ca-history class="ca-history-list"></div><p class="ca-history-link"><a data-nav href="${route}?view=legacy">查看旧版资料与用例设计记录</a></p></details><div class="ca-layout"><section class="panel"><div class="panel-header"><h2>和助手一起设计用例</h2><button class="button small" type="button" data-ca-new>新对话</button></div><div class="panel-body"><div data-ca-messages></div><div data-ca-progress class="ca-progress" role="status" aria-live="polite"></div><section data-ca-results hidden></section><form class="ca-composer" data-ca-form><label class="field"><span>告诉助手测试范围，或回答问题、提出修改意见</span><textarea data-ca-text placeholder="例如：根据这份 PRD 和页面截图，设计电价管理的前后端测试用例。重点覆盖新增、修改、权限和边界情况。" maxlength="12000"></textarea></label><div data-ca-files class="ca-file-list"></div><details class="ca-materials"><summary>选择项目里已上传的资料</summary><div data-ca-source-list class="ca-source-list"></div></details><div class="ca-compose-actions"><label class="button ca-upload-button">添加资料<input data-ca-upload type="file" multiple accept=".docx,.md,.markdown,.png,.jpg,.jpeg" aria-label="添加 Word、Markdown 或截图资料"></label><div class="actions"><button class="button primary" data-ca-send type="submit" disabled>读取对话中…</button></div></div><p class="ca-upload-help">支持 Word（.docx）、Markdown、PNG/JPEG。可在输入区粘贴、拖入文件。受保护 Word 无法读取时，可在此输入框单独粘贴原件的完整路径并发送，先由本机 Word/WPS 读取；再输入测试范围继续对话。</p></form></div></section></div></div>`);
  find('[data-ca-text]').value = draft.text;
  find('[data-ca-text]').addEventListener('input', event => { draft.text = event.target.value; saveDraft(draftKey, draft); paintControls(); });
  find('[data-ca-form]').addEventListener('submit', send);
  function addFiles(chosen) {
    if (materialsDisabled()) return;
    if (chosen.some(file => !/\.(docx|md|markdown|png|jpe?g)$/i.test(file.name))) { setError(new Error('REQUIREMENT_FILE_TYPE_UNSUPPORTED')); return; }
    draft.files.push(...chosen); setError(capability ? null : new Error('CASE_ASSISTANT_UNAVAILABLE')); paintFiles();
  }
  find('[data-ca-upload]').addEventListener('change', event => {
    addFiles([...event.target.files]);
    event.target.value = '';
  });
  find('[data-ca-form]').addEventListener('dragover', event => { if ([...(event.dataTransfer?.types || [])].includes('Files')) event.preventDefault(); });
  find('[data-ca-form]').addEventListener('drop', event => { const files=[...(event.dataTransfer?.files || [])]; if(files.length){event.preventDefault();addFiles(files);} });
  find('[data-ca-text]').addEventListener('paste', event => { const files=[...(event.clipboardData?.files || [])]; if(files.length){event.preventDefault();addFiles(files);} });
  find('[data-ca-new]').addEventListener('click', async () => {
    if (busy || activeTurn()) return;
    // Another tab may have started generation since this page was read.
    busy = true; paintControls();
    try {
      const running = activeAssistantConversation(await assistantApi.list(projectId), projectId);
      if (!current()) return;
      if (running) { if (go) go(`${route}?conversation=${encodeURIComponent(running)}`); return; }
    } catch (error) { setError(error); return; }
    finally { busy = false; paintControls(); }
    if (go) { go(`${route}?new=${encodeURIComponent(crypto.randomUUID())}`); return; }
    stopPolling?.(); generation += 1; conversation = null; conversationId = ''; selectedTurnId = ''; remember();
    draftKey = `case-assistant-draft:${projectId}:new`; draft = loadDraft(draftKey);
    find('[data-ca-text]').value = draft.text; setError(null); paintConversation(); paintFiles();
  });
  const dispose = () => { alive = false; generation += 1; stopPolling?.(); saveDraft(draftKey, draft); };
  try {
    const [listing, material] = await Promise.all([assistantApi.list(projectId), requirementsApi.listSources(projectId)]);
    if (!current()) return dispose;
    index = rows(listing.conversations); capability = listing.capabilities?.available !== false;
    sources = rows(Array.isArray(material) ? material : material.sources);
    const running = activeAssistantConversation(listing, projectId);
    if (running && (!query.get('conversation') || query.has('new'))) {
      // Preserve a fresh/stale-tab draft under its own key; never send it into
      // the running conversation just because the entry was clicked again.
      saveDraft(draftKey, draft);
      if (go) { go(`${route}?conversation=${encodeURIComponent(running)}`); return dispose; }
      conversationId = running; draftKey = `case-assistant-draft:${projectId}:${running}`; draft = loadDraft(draftKey);
      find('[data-ca-text]').value = draft.text;
    }
    if (conversationId) conversation = await assistantApi.get(projectId, conversationId);
    if (!current()) return dispose;
    if (conversation) {
      for (const source of rows(conversation.sources)) if (!sources.some(row => sourceId(row) === sourceId(source))) sources.push(source);
      for (const id of rows(conversation.source_ids)) draft.sourceIds.add(id);
      remember(); saveDraft(draftKey, draft);
    }
    find('[data-ca-history]').innerHTML = index.length ? index.map(item => `<a class="button small" data-nav href="${route}?conversation=${encodeURIComponent(item.id)}">${esc(item.title || '未命名对话')}</a>`).join('') : '<span>还没有历史对话。</span>';
    if (!capability) setError(new Error('CASE_ASSISTANT_UNAVAILABLE'));
    paintConversation(); paintFiles(); poll();
  } catch (error) { setError(error); }
  return dispose;
}
