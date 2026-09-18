const $ = (s) => document.querySelector(s),
  csrf = $('meta[name=csrf-token]').content;
const h = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
let current = null,
  state = null,
  config = {},
  selected = new Set(),
  lastRevision = -1,
  taskNavigationSignature = '',
  polling = false,
  workflowPending = false,
  toastTimer;
const preparationPreferences = new Map();
// The output panel survives workspace renders, so polling never collapses a
// reply or moves the reader away from an older record.
let outputTask = null,
  outputPanel = null,
  outputFollow = true,
  outputFilter = 'all',
  outputSignature = '',
  outputSyncAt = 0,
  outputConnectionError = false,
  outputDiagnostics = [],
  outputDiagnosticsAt = 0,
  outputDiagnosticsError = '',
  outputDiagnosticsPending = null,
  outputWasBusy = false,
  outputActionError = '';
const errors = {
  CASE_NAMED_SOURCE_REQUIRED: '未观察字段必须逐字来自对应步骤的操作原文，不能来自预期或经验猜测。',
  CASE_NAMED_GUARD_UNOBSERVED: '缺少可核验的向导页面和步骤信息，尚不能安全绑定后续字段。',
  CASE_NAMED_CONTEXT_MISMATCH: '当前页面或向导步骤与批准计划不符，未操作该字段。',
  CASE_NAMED_CONTEXT_CHANGED: '操作前或操作过程中页面、步骤或表单身份发生变化，已停止。',
  CASE_NAMED_FORM_MISMATCH: '无法确认当前步骤的唯一所属表单，已停止绑定。',
  CASE_NAMED_NOT_UNIQUE: '当前步骤存在同名控件，未自动选择其中一个。',
  CASE_NAMED_NOT_FOUND: '进入指定步骤后仍未找到批准的字段，未替换目标。',
  CASE_NAMED_TYPE_MISMATCH: '字段实际类型与批准计划不符，已停止绑定。',
  CASE_NAMED_ACTION_FORBIDDEN: '未观察定位不能用于危险操作、清理、前置条件或自动替换。',
  PREPARATION_OPTIONS_INVALID: '准备设置无效，请选择支持的并发数和时间档位。',
  PARALLEL_READONLY_CONFIRMATION_REQUIRED:
    '两路探索仅适用于相互独立的只读用例；请确认隔离条件，写入授权开启时使用串行。',
  PREPARATION_PLAN_TIMEOUT: '本条规划/审查时间已到，已保留页面证据；可增加时间后续跑。',
  PREPARATION_JOB_TIMEOUT: '本轮总时间已到，进度与累计消耗已保留；请选择未完成用例继续。',
  CASE_ADVICE_STALE: '用例或草案已变化，请重新打开详情核对，旧草案未应用。',
  CASE_ADVICE_INPUT_REQUIRED: '草案仍有未决输入，请填写真实业务决定，不能直接采纳占位内容。',
  CASE_ADVICE_NO_CHANGE: '尚未修改用例，未生成新版本。',
  CASE_ADVICE_INVALID: '建议格式或适用范围未通过校验，未改变用例。',
  OPTIONAL_DIALOG_SCHEMA: '条件关闭格式不受支持；只允许原文指定的提示及关闭文字。',
  OPTIONAL_DIALOG_SOURCE_REQUIRED: '原步骤未明确授权该条件关闭，或计划不是只读。',
  OPTIONAL_DIALOG_NOT_UNIQUE: '发现多个同名提示，未猜测关闭对象。',
  OPTIONAL_DISMISS_NOT_UNIQUE: '提示内的关闭按钮缺失或不唯一。',
  OPTIONAL_DIALOG_UNEXPECTED: '出现了原步骤未授权关闭的弹窗。',
  OPTIONAL_DIALOG_UNSAFE: '该提示不是受支持的原生本地关闭，或包含输入、确认等风险。',
  OPTIONAL_DIALOG_CHANGED: '提示或按钮在派发前后发生变化，未重放操作。',
  OPTIONAL_DIALOG_TIMEOUT: '条件关闭达到时间上限，未继续重试。',
  OPTIONAL_DIALOG_STILL_VISIBLE: '提示仍可见，不能算关闭成功。',
  PLAN_CONDITIONAL_UNSUPPORTED: '计划未忠实保留原步骤的出现/未出现两个分支。',
  PLAN_OBSTRUCTION_UNPROVEN: '当前断言不能证明后续目标不被遮挡，需要修正计划。',
  CASE_ENTRY_URL_INVALID:
    '页面入口URL格式无效，请使用同站点HTTP(S)地址或相对路径，不要包含账号密码。',
  CASE_ENTRY_URL_CROSS_ORIGIN: '页面入口URL必须与本轮测试环境同源（协议、主机和端口一致）。',
  CASE_ENTRY_URL_SENSITIVE: '页面入口URL含凭据或敏感参数，请删除这些参数后再填写。',
  CASE_ENTRY_URL_CONFLICT: '同一用例存在不同的页面入口URL，请核对后保留一个。',
  CASE_ENTRY_NAVIGATION_REQUIRED:
    '计划必须保留原用例从首页点击菜单进入的步骤，请重新探索并核对计划。',
  DEEPSEEK_KEY_REQUIRED: '请先在连接设置中填写 DeepSeek API Key。',
  DEEPSEEK_AUTH_FAILED: 'DeepSeek 拒绝了密钥，请检查后重试。',
  DEEPSEEK_BALANCE_REQUIRED: 'DeepSeek 账户余额不足。',
  DEEPSEEK_CONNECTION_FAILED:
    '未能连接 DeepSeek，请在连接设置中测试连接；使用代理时检查 HTTPS_PROXY / HTTP_PROXY，诊断日志可查看具体网络错误。',
  DEEPSEEK_TIMEOUT: 'DeepSeek 请求超时，已保留当前进度；请检查网络后重试。',
  DEEPSEEK_RATE_LIMIT: '模型服务暂时限流，请留意后续重试结果。',
  INVALID_LOCATOR: '控件定位格式无效，需要修正后再继续。',
  DEEPSEEK_OUTPUT_TRUNCATED: '模型输出被截断，本次未采纳。',
  DEEPSEEK_EMPTY_RESPONSE: '模型返回空内容，本次未采纳。',
  JOB_ALREADY_RUNNING: '已有任务正在进行，请等待或停止该任务。',
  REVIEW_AND_PAGE_REQUIRED: '先确认所选用例，并读取相关页面，再生成计划。',
  AUTH_REQUIRED: '请打开浏览器，登录后确认页面标志。',
  LOGIN_NOT_FINISHED: '当前页面显示登录表单，请先完成登录。',
  SESSION_UNVERIFIED: '未找到已确认的会话标志，请检查页面加载和标志选择；尚不能判定登录失效。',
  OBLIGATIONS_CONFIRMATION_REQUIRED: '请核对并填写每一步的预期分项。',
  OBLIGATION_SOURCE_COVERAGE_INCOMPLETE: '确认分项漏掉了部分原预期，请补全后再确认。',
  OBLIGATION_TEXT_NOT_IN_ORACLE: '预期分项应引用已确认预期中的原文，请核对修改。',
  ORACLE_COVERAGE_INCOMPLETE: '计划未覆盖全部已确认预期，请查看缺失分项。',
  PLAN_VERSION_REAPPROVAL_REQUIRED: '这是旧版计划，需要重新确认预期分项并生成新计划。',
  CHECKPOINT_COUNT_INVALID: '每个原步骤需要 1 至 8 个检查点。',
  CHECKPOINT_ID_INVALID: '检查点编号缺失或重复，请重新生成计划。',
  STEP_DEADLINE_INVALID: '分段步骤总预算须在 100 至 120000 毫秒内。',
  STEP_DEADLINE_EXCEEDED: '本步骤总预算已耗尽，后续业务操作未执行。',
  PLAN_APPROVAL_REQUIRED: '执行前需要核对并确认所选计划。',
  CASE_ALREADY_EXECUTED:
    '该用例已有执行记录。复测请新建轮次并重新导入；仅登录或前置阻塞且未操作的用例可继续。',
  CLEANUP_REQUIRED: '先处理待清理数据并记录恢复情况，再运行其他用例。',
  SITE_CLEANUP_REQUIRED:
    '同一站点的其他任务仍有待清理数据。请先打开提示的原任务，核实并记录恢复情况。',
  CLEANUP_STATE_UNVERIFIED:
    '有任务记录无法核实，当前不能确认数据已清理。请先检查该记录，勿通过新建任务绕过。',
  BUILD_SOURCE_CHANGED: '磁盘代码已经更新，请正常停止旧服务，再启动当前版本。',
  INSTANCE_CHANGED: '运行实例已改变，请刷新后重试。',
  WRITE_NOT_AUTHORIZED: '所选计划需要写入，请在环境设置中确认授权。',
  NONPRODUCTION_CONFIRMATION_REQUIRED: '请在环境设置中确认这是获准测试的非生产环境。',
  REVIEW_RESOLUTION_REQUIRED: '该用例存在审查问题，请填写处理说明。',
  HANDOFF_BASELINE_INVALID: '导出物与本轮用例基线不匹配或格式无效。请下载本轮基线用于生成导出物。',
  BASELINE_CHANGED: '检测到原始用例文件发生改变，已停止使用。',
  EVIDENCE_CHANGED: '执行事实文件校验失败。',
  REPORT_MEDIA_TOO_LARGE: '报告媒体超过150MB，请按较小批次新建轮次；原始媒体保留在本地 data 目录。',
  IMPORT_FAILED: '导入未成功。请核对工作表名、表头及 Python/openpyxl 环境。',
  CASE_SELECTION_INVALID: '请先选择要处理的用例。',
  LOCATOR_NOT_VISIBLE: '页面标志当前不可见，请选择登录后保持可见的标志。',
};
Object.assign(errors, {
  PAGE_EVIDENCE_INCOMPLETE:
    '目标页面仍有被拦截请求，不能把缺失数据当成正常结果。Agent 可继续寻找独立页面；确需该请求时，需核验只读接口契约。',
  DIAGNOSTIC_WRITE_FAILED:
    '诊断日志无法保存，已停止后续模型请求。请检查本机磁盘空间和目录写入权限。',
  DIAGNOSTIC_CHANGED: '诊断日志的内容或顺序校验不一致，已停止展示，原文件保留。',
  DIAGNOSTIC_READ_FAILED: '诊断日志暂时无法读取，请检查本机目录是否可访问。',
  DEEPSEEK_TIMEOUT: '模型请求超时，本次未采纳，可在诊断日志查看已记录的请求信息。',
});
Object.assign(errors, {
  DISCOVERY_UNAVAILABLE: '当前服务尚未启用自动探索。请连接支持自动探索的 v0.3.0 服务。',
  NO_PENDING_CASES: '本轮没有尚未执行的用例。',
  NO_UNEXECUTED_CASES: '本轮没有尚未执行的用例。',
  FIXTURE_PRESET: '本机演示使用预制计划，未自动调用模型；需要时可点击自动探索。',
  DISCOVERY_BUDGET_EXHAUSTED: '本次探索已达到预算，请查看已发现的页面及受阻原因。',
  DISCOVERY_BLOCKED: '当前探索受阻，请查看 Agent 运行输出中的具体原因。',
});
Object.assign(errors, {
  PLAN_AUDIT_REQUIRED: '计划或输入已变化，需要重新生成并核验计划后再核对执行。',
  INPUT_OVERRIDES_INVALID: '测试数据更正格式无效，请使用现有字段的 JSON 对象。',
  INPUT_OVERRIDE_UNKNOWN_FIELD: '测试数据更正只能使用原用例已有字段。',
  INPUT_OVERRIDE_STRUCTURE_CHANGED: '测试数据更正不能改变原数据结构或数组长度。',
  INPUT_OVERRIDE_UNSAFE_KEY: '测试数据更正包含不允许的字段名。',
  INPUT_OVERRIDE_LIMIT: '测试数据更正超出大小或层级限制，请缩小更正范围。',
});
const supportsDiscovery = () => config.auto_discovery === true;
Object.assign(errors, {
  LOGIN_EVIDENCE_REQUIRED:
    '尚不能可靠识别登录后的界面。浏览器和登录仍保留；请使用辅助操作中的确认登录状态，然后继续准备。',
  ADAPTER_PROGRAM_REJECTED: '生成的适配修复超出受限语法，已拒绝并保留原版本。',
  ADAPTER_REGRESSION_FAILED: '适配修复未通过回归验证，未启用该版本。',
});
const discoveryStatusNames = {
  IDLE: '待启动',
  PENDING: '等待探索',
  RUNNING: '探索中',
  EXPLORING: '探索中',
  PLANNING: '正在生成候选计划',
  CAPTURED: '页面采集结束',
  PARTIAL: '部分页面已采集',
  COMPLETE: '探索结束',
  COMPLETED: '探索结束',
  FINISHED: '探索结束',
  BLOCKED: '探索受阻',
  FAILED: '探索未完成',
  STOPPED: '探索已停止',
  INTERRUPTED: '探索已中断',
};
const reasonText = (reason) => errors[reason] ?? reason ?? '';
const repairStatusNames = {
  INVALID: '计划格式未采纳',
  BLOCKED: '计划受阻',
  AUDIT_REJECTED: '计划语义核验未满足',
  ACCEPTED: '候选计划已通过自检，仍需核对',
  ACCEPT: '本次语义核验未发现问题，仍需核对',
  REPAIR: '计划需要修复',
  NEEDS_CLARIFICATION: '需要澄清用例',
  EXHAUSTED: '已达修复上限，需处理',
  RUNNING: '正在修复',
  STOPPED: '已停止',
  INTERRUPTED: '已中断',
};
function preparationHistoryHTML(c) {
  const repair = c.self_repair,
    input = c.input_review,
    audit = c.plan_audit,
    legacy =
      c.plan && !repair
        ? '<p class="notice warn">历史/预置计划：未经过新增自动核验，仍需按原流程核对</p>'
        : '';
  if (!repair && !input && !audit) return legacy;
  const issueText = (i) =>
      typeof i === 'string'
        ? i
        : [i.step_id, i.message ?? i.reason ?? i.code].filter(Boolean).join(' · '),
    rounds = repair?.rounds ?? [];
  return `${legacy}<details class="plan-card preparation-history"><summary>输入审查与计划自修复 · 已修复 ${h(repair?.repair_count ?? 0)} / ${h(repair?.max_repairs ?? 2)} 次</summary><p>这里只记录计划准备过程。自检采纳不代表已经执行，也不代表测试预期满足；候选计划仍需核对后执行。</p>${input ? `<h4>输入审查</h4><p>${input.issues?.length ? input.issues.map((i) => h(issueText(i))).join('<br>') : '本次未发现输入问题。'}</p>` : ''}${repair ? `<p><strong>本次结果：</strong>${h(repairStatusNames[repair.outcome] ?? repair.outcome ?? '处理中')}</p><ol>${rounds.map((r, i) => `<li><strong>${r.round === 0 ? '首次计划' : '第 ' + h(r.round ?? i) + ' 次修复'} · ${h(repairStatusNames[r.status] ?? r.status)}</strong><p>${h(r.reason ?? r.code ?? '未记录补充原因')}</p><small>${h(r.at ?? '')}</small><details><summary>查看计划版本变化</summary><p class="mono">前一计划：${h(rounds[i - 1]?.plan_hash ?? '无')}<br>本次计划：${h(r.plan_hash ?? '未生成有效计划')}</p>${r.code ? `<p>原因代码：${h(r.code)}</p>` : ''}</details></li>`).join('') || '<li>尚无计划尝试记录。</li>'}</ol>` : ''}${audit ? `<h4>最近一次计划语义核验</h4><p>${h(repairStatusNames[audit.outcome] ?? audit.outcome)}${audit.issues?.length ? ' · ' + audit.issues.map((i) => h(issueText(i))).join('；') : ''}</p><details><summary>查看核验依据</summary><pre>${h(JSON.stringify({ plan_hash: audit.plan_hash, input_hash: audit.input_hash, checks: audit.checks, at: audit.at }, null, 2))}</pre></details>` : ''}</details>`;
}
function dataCorrectionHTML(c) {
  const keys = ['data', 'test_data'].filter(
    (key) =>
      c.original?.[key] && typeof c.original[key] === 'object' && !Array.isArray(c.original[key]),
  );
  if (!keys.length) return '';
  return `<details class="plan-card"><summary>测试数据更正（可选）</summary><p>原始测试数据保留不变。仅在确认原文存在冲突后，更正已有字段的值，并在问题处理说明中记录依据；留空或未修改不会新增更正。</p>${keys.map((key) => `<h4>${h(key)}</h4><blockquote>原始测试数据：<pre>${h(JSON.stringify(c.original[key], null, 2))}</pre></blockquote><label class="field">确认后的测试数据（JSON）<textarea data-correction="${key}" ${c.attempts?.length ? 'disabled' : ''}>${h(JSON.stringify(c.effective?.[key] ?? c.original[key], null, 2))}</textarea></label>`).join('')}</details>`;
}
function readDataCorrections(c) {
  const updates = {};
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function patch(original, next, path) {
    if (!object(next)) throw new Error(path + ' 必须是 JSON 对象。');
    const result = {};
    for (const [key, v] of Object.entries(next)) {
      if (!Object.hasOwn(original, key) || ['__proto__', 'prototype', 'constructor'].includes(key))
        throw new Error(path + ' 只能更正已有字段：' + key);
      const old = original[key];
      if (object(old)) {
        const diff = patch(old, v, path + '.' + key);
        if (Object.keys(diff).length) result[key] = { ...old, ...diff };
      } else if (!same(old, v)) result[key] = v;
    }
    return result;
  }
  for (const key of ['data', 'test_data']) {
    const field = $(`[data-correction="${key}"]`);
    if (!field?.value.trim()) continue;
    let next;
    try {
      next = JSON.parse(field.value);
    } catch {
      throw new Error(key + ' 的 JSON 格式不正确，请核对引号、逗号和括号。');
    }
    const diff = patch(c.effective?.[key] ?? c.original?.[key] ?? {}, next, key);
    if (Object.keys(diff).length) updates[key] = diff;
  }
  return Object.keys(updates).length ? { data_overrides: updates } : {};
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').hidden = false;
  $('#toast').textContent = message;
  $('#toast').className = error ? 'error' : '';
  toastTimer = setTimeout(() => ($('#toast').hidden = true), error ? 10000 : 4500);
}
async function api(url, body) {
  const r = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(body === undefined ? { signal: AbortSignal.timeout(8000) } : {}),
  });
  const value = await r.json();
  if (!r.ok) throw new Error(errors[value.error] ?? `操作未完成：${value.error}`);
  return value;
}
async function action(fn) {
  try {
    await fn();
    outputActionError = '';
    await refresh(true);
  } catch (e) {
    if (current && state?.id === current) {
      outputActionError = diagnosticsSafe(e.message);
      updateAgentOutput();
    }
    toast(e.message, true);
  }
}
function modal(html) {
  $('#modal-body').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
}
function close() {
  $('#modal').close();
  $('#modal-body').replaceChildren();
}
$('.modal-close').onclick = close;
async function fileData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function badge(status) {
  return `<span class="badge ${status === 'PASS_ASSERTIONS' ? 'good' : ['FAIL_ASSERTION', 'TECHNICAL_FAILED', 'CLEANUP_REQUIRED', 'BLOCKED_BUDGET'].includes(status) ? 'bad' : ['RUNNING', 'READY', 'PLAN_REVIEW'].includes(status) ? 'work' : ''}">${h(config.labels?.[status] ?? status)}</span>`;
}
function ids() {
  return [...selected];
}
function pendingDiscoveryIds(s) {
  const eligible = s.cases.filter((c) => !c.attempts.length);
  const unfinished = eligible.filter(
    (c) => c.status === 'BLOCKED_BUDGET' || c.discovery?.status === 'BLOCKED' || !c.discovery,
  );
  return (unfinished.length ? unfinished : eligible).map((c) => c.case_id);
}
function workflowRows() {
  return state.cases.filter((c) => selected.has(c.case_id));
}
function reusableDiscovery(s, rows) {
  return (
    rows.length > 0 &&
    rows.every(
      (c) =>
        c.discovery?.status === 'CAPTURED' &&
        s.snapshots?.some(
          (p) => p.discovery_case_id === c.case_id && p.discovery_job_id === c.discovery.job_id,
        ),
    )
  );
}
function preparationSummary(rows) {
  const pending = rows.filter((c) => !c.attempts.length);
  return `已探索 ${rows.filter((c) => c.discovery?.status === 'CAPTURED').length} / ${rows.length} 条 · 已生成计划 ${rows.filter((c) => c.plan).length} / ${rows.length} 份 · 待核对用例 ${pending.filter((c) => !c.reviewed).length} 条 · 已有执行记录 ${rows.length - pending.length} 条`;
}
function workflowState() {
  const rows = workflowRows(),
    pending = rows.filter((c) => !c.attempts.length);
  const unconfirmed = pending.filter((c) => !c.reviewed);
  const missing = pending.filter((c) => !c.plan);
  const blocked = pending.find((c) => c.reviewed && c.status === 'BLOCKED_MAPPING');
  let step = unconfirmed.length
    ? 0
    : missing.length || blocked
      ? 1
      : pending.some((c) => !c.plan_approved)
        ? 2
        : pending.length
          ? 3
          : 4;
  let id = ['confirm-main', 'prepare', 'approve-main', 'run-main', 'workflow-report'][step];
  let label = ['核对用例并继续', '开始自动准备', '核对所选计划', '执行所选', '查看执行报告'][step];
  let detail = [
    `还有 ${unconfirmed.length} 条用例需要核对。确认操作和预期后，自动开始准备。`,
    reusableDiscovery(state, missing)
      ? `还有 ${missing.length} 份计划待生成，将使用当前有效的页面观察继续规划。`
      : `还有 ${missing.length} 份计划待生成。登录后，Agent 自动探索页面、生成并检查计划。`,
    '请核对计划中的操作、预期和清理内容。核对后进入执行步骤。',
    '所选未执行用例的计划均已核对，可以开始执行。',
    '所选用例均已有执行记录，请查看实际结果；执行结束不代表断言全部满足。',
  ][step];
  let disabled = workflowPending || outputConnectionError;
  if (step === 1 && reusableDiscovery(state, missing)) label = '继续生成计划';
  if (step === 1 && blocked) {
    id = 'workflow-resolve';
    label = '查看待处理原因';
    detail = `${blocked.case_id} 的计划准备需要处理：${reasonText(blocked.mapping_reason) || '请核对该用例的准备记录。'}`;
  }
  const clarification = unconfirmed.find(
    (c) => c.issues?.length || c.effective?.steps?.some((s) => !s.expected),
  );
  if (step === 0 && clarification) {
    id = 'workflow-clarify';
    label = '补充用例后继续';
    detail = `${clarification.case_id} 需要先核对：${clarification.issues?.[0]?.message || '有步骤缺少预期结果。'}`;
  }
  if (step === 1 && !blocked && !config.configured) {
    id = 'workflow-connect';
    label = '连接 DeepSeek';
    detail = '用例已核对。请先配置模型连接，再开始生成计划。';
  } else if (step === 1 && !blocked && !config.autonomous_preparation) {
    disabled = true;
    detail = '当前服务不支持自动准备，请更新服务后继续。';
  }
  if (step === 3 && !state.authenticated) {
    id = 'workflow-login';
    label = state.browser_open ? '确认登录状态' : '打开登录浏览器';
    detail = '执行前需要有效登录。在浏览器完成登录后，确认登录状态，再执行已核对的计划。';
  }
  if (state.site_cleanup_blockers?.length || state.cases.some((c) => c.cleanup_required)) {
    id = 'workflow-cleanup';
    label = '查看待清理记录';
    detail = '先处理尚未完成的数据清理，再继续准备或执行。';
  }
  if (!rows.length) {
    step = 0;
    id = 'confirm-main';
    label = '请先选择用例';
    disabled = true;
    detail = '在下方勾选本轮要测试的用例。这里会显示它们的当前步骤和下一步操作。';
  }
  if (state.active) {
    step = state.active.kind === 'run' ? 3 : state.active.kind === 'review' ? 0 : 1;
    id = 'workflow-running';
    label = '正在处理，请等待';
    disabled = true;
    detail =
      state.active.stage === 'WAITING_USER_LOGIN'
        ? '请在 Agent 浏览器完成登录，识别成功后自动继续探索和生成计划。'
        : 'Agent 正在处理本轮选择的用例。下方运行输出会持续显示当前动作、回复和异常。';
    if (state.active.kind !== 'run' && state.cases.some((c) => !c.reviewed && !c.attempts.length)) {
      step = 0;
      detail += ' 尚有原文未核对的用例，它们本次只采集页面，核对后才能生成计划。';
    }
  }
  return { rows, pending, step, id, label, detail, disabled, blocked, clarification };
}
// Update the console in place: disconnecting the whole workspace invalidates
// browser scroll anchors and keyboard focus, even if its HTML looks unchanged.
// This is only used for display regions, never for the editable modal forms.
function patchConsole(parent, fresh, retain = () => false) {
  const key = (node) =>
    node.nodeType === Node.ELEMENT_NODE
      ? node.id || node.getAttribute('data-select') || node.getAttribute('data-case') || ''
      : '';
  const compatible = (a, b) => a?.nodeName === b.nodeName && key(a) === key(b);
  let cursor = parent.firstChild;
  for (const next of [...fresh.childNodes]) {
    let node = cursor;
    if (!compatible(node, next)) {
      node = key(next)
        ? [...parent.childNodes].find((candidate) => compatible(candidate, next))
        : null;
      if (!node) node = next.cloneNode(true);
      parent.insertBefore(node, cursor);
    }
    if (!retain(node)) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Disclosure state belongs to the reader, not the polling response.
        const keepAttribute = (name) => node.tagName === 'DETAILS' && name === 'open';
        for (const attribute of [...node.attributes])
          if (!keepAttribute(attribute.name) && !next.hasAttribute(attribute.name))
            node.removeAttribute(attribute.name);
        for (const attribute of next.attributes)
          if (
            !keepAttribute(attribute.name) &&
            node.getAttribute(attribute.name) !== attribute.value
          )
            node.setAttribute(attribute.name, attribute.value);
        if (node instanceof HTMLInputElement && node.type === 'checkbox')
          node.checked = next.checked;
        patchConsole(node, next, retain);
      } else if (node.nodeValue !== next.nodeValue) node.nodeValue = next.nodeValue;
    }
    cursor = node.nextSibling;
  }
  while (cursor) {
    const next = cursor.nextSibling;
    cursor.remove();
    cursor = next;
  }
}
function updateWorkflow() {
  const panel = $('#guided-workflow');
  if (!panel) return;
  const f = workflowState();
  const labels = ['核对用例', '自动准备', '核对计划', '执行测试', '查看结果'];
  const content = `<div class="panel-heading"><h2 id="workflow-title">本轮测试流程</h2><span class="workflow-selection">已选 ${f.rows.length} / ${state.cases.length} 条</span></div>
    <ol class="workflow-steps" aria-label="测试步骤">${labels.map((title, index) => `<li class="${index < f.step ? 'done' : index === f.step ? 'current' : 'locked'}" ${index === f.step ? 'aria-current="step"' : ''}><span class="workflow-number" aria-hidden="true">${index + 1}</span><div><strong>${title}</strong><small>${index < f.step ? '已完成' : index === f.step ? '当前步骤' : '等待前一步'}</small></div></li>`).join('')}</ol>
    <div class="workflow-next"><div><p id="workflow-detail">${h(f.detail)}</p><p id="workflow-summary">${h(preparationSummary(f.rows.length ? f.rows : state.cases))}</p></div><button id="${f.id}" class="primary" aria-describedby="workflow-detail" ${f.disabled ? 'disabled' : ''}>${h(workflowPending ? '正在提交…' : f.label)}</button></div>
    ${!f.rows.length && !state.active ? `<button id="workflow-select-all" class="link">选择全部 ${state.cases.length} 条用例</button>` : ''}
    ${f.pending.some((c) => c.plan) && f.pending.some((c) => !c.plan) ? '<button id="workflow-select-plans" class="link">只选择已有计划的用例，继续核对和执行</button>' : ''}
    ${config.preparation_controls ? `<div class="preparation-policy"><button id="preparation-settings" ${state.active ? 'disabled' : ''}>准备设置</button><span>${h(preparationPolicyText())}</span><small>取证与规划分别计时；准备不代表业务测试通过。</small></div>${preparationProgressHTML()}` : ''}`;
  const signature = JSON.stringify([state.id, f.rows.map((c) => c.case_id), content]);
  if (panel.workflowSignature === signature) return;
  panel.workflowSignature = signature;
  const template = document.createElement('template');
  template.innerHTML = content;
  patchConsole(panel, template.content);
  if ($('#preparation-settings')) $('#preparation-settings').onclick = preparationSettings;
  const button = panel.querySelector('.primary');
  button.onclick = () => {
    if (button.disabled) return;
    if (f.id === 'confirm-main') return confirmSelected({ continuePreparation: true });
    if (f.id === 'prepare') return action(() => startPreparedSelection(current, ids()));
    if (f.id === 'approve-main') return approveSelected();
    if (f.id === 'run-main')
      return action(() =>
        taskAPI('job', { kind: 'run', case_ids: f.pending.map((c) => c.case_id) }),
      );
    if (f.id === 'workflow-resolve') return caseDetail(f.blocked.case_id);
    if (f.id === 'workflow-clarify') return caseDetail(f.clarification.case_id);
    if (f.id === 'workflow-connect') return settings();
    if (f.id === 'workflow-login')
      return state.browser_open ? authDialog() : action(() => taskAPI('browser', {}));
    if (f.id === 'workflow-report') return $('#workspace .download').click();
    if (f.id === 'workflow-cleanup') {
      const own = state.cases.find((c) => c.cleanup_required);
      if (own) return caseDetail(own.case_id);
      return $('#workspace .site-cleanup-notice')?.scrollIntoView({ block: 'center' });
    }
  };
  const selectPlans = $('#workflow-select-plans');
  if (selectPlans)
    selectPlans.onclick = () => {
      selected = new Set(f.pending.filter((c) => c.plan).map((c) => c.case_id));
      render();
    };
  const selectAll = $('#workflow-select-all');
  if (selectAll)
    selectAll.onclick = () => {
      selected = new Set(state.cases.map((c) => c.case_id));
      render();
    };
  for (const [id, allowed] of [
    ['review', f.pending.length > 0],
    ['confirm', f.pending.length > 0],
    ['plan', f.pending.length > 0 && f.pending.every((c) => c.reviewed) && state.snapshots?.length],
    ['approve', f.pending.length > 0 && f.pending.every((c) => c.reviewed && c.plan)],
    [
      'run',
      f.pending.length > 0 &&
        f.pending.every((c) => c.plan_approved && c.plan) &&
        state.authenticated,
    ],
  ]) {
    const control = $('#' + id);
    if (control) {
      control.disabled = !!state.active || workflowPending || outputConnectionError || !allowed;
      control.title = allowed ? '' : '请先完成上方流程中的前置步骤。';
    }
  }
}
async function startPreparedSelection(taskId, caseIds) {
  if (workflowPending) return;
  workflowPending = true;
  updateWorkflow();
  try {
    const fresh = await api('/api/tasks/' + encodeURIComponent(taskId));
    if (current !== taskId) return;
    const rows = fresh.cases.filter(
      (c) =>
        caseIds.includes(c.case_id) &&
        !c.attempts.length &&
        (!c.plan || c.status === 'BLOCKED_BUDGET'),
    );
    if (!rows.length) return;
    if (rows.some((c) => !c.reviewed)) throw new Error('请先核对所选用例的操作和预期。');
    const kind = config.preparation_controls
      ? 'prepare'
      : reusableDiscovery(fresh, rows)
        ? 'plan'
        : 'prepare';
    await api('/api/tasks/' + encodeURIComponent(taskId) + '/job', {
      kind,
      case_ids: rows.map((c) => c.case_id),
      ...(config.preparation_controls
        ? { options: preparationPreferences.get(taskId) ?? fresh.preparation?.options ?? {} }
        : {}),
    });
    toast(
      kind === 'plan'
        ? '正在使用已采集的页面继续生成计划。'
        : '已开始自动准备；完成浏览器登录后会自动继续。',
    );
  } finally {
    workflowPending = false;
    updateWorkflow();
  }
}
function preparationPolicyText() {
  const o = preparationPreferences.get(current) ?? state.preparation?.options ?? {};
  return `${o.concurrency === 2 ? '两路只读探索' : '串行探索'} · ${o.time_multiplier === 2 ? '延长时间（2倍）' : '标准时间'} · 按步骤和预期分项分配`;
}
function durationLabel(ms) {
  return Math.ceil(Math.max(0, ms ?? 0) / 60000) + '分钟';
}
function preparationProgressHTML() {
  const p = state.preparation;
  if (!p) return '';
  const workers = Object.values(p.workers ?? {});
  const ready = workers.filter((w) => w.status === 'PLAN_READY').length;
  const paused = workers.filter((w) => ['PAUSED', 'NEEDS_REVIEW'].includes(w.status)).length;
  const live = new Map((state.active?.workers ?? []).map((w) => [w.case_id, w]));
  const running = workers.filter((w) => live.has(w.case_id));
  return `<div class="preparation-progress"><p>本轮 ${p.case_ids.length} 条 · ${ready} 条已形成计划 · ${running.length} 条正在准备 · ${paused} 条待处理 · ${Math.max(0, p.case_ids.length - workers.length)} 条等待调度</p>
    <p class="muted">总时间保护 ${durationLabel(p.time_budget?.wall_ms)}，累计工作预算 ${durationLabel(p.time_budget?.work_ms)}（含取证、规划/修复，非预计完成承诺）；等待人工登录不占用此预算。</p>
    ${running.map((w) => `<div class="preparation-worker"><strong>${h(w.case_id)}</strong><span>${live.get(w.case_id).phase === 'planning' ? '计划生成 / 审查 / 修复' : '页面取证'}</span><span>本阶段剩余约 ${durationLabel(live.get(w.case_id).remaining_ms)} · 模型 ${live.get(w.case_id).calls} 次</span></div>`).join('')}
    <details><summary>查看逐条进度与分阶段预算</summary>${p.case_ids
      .map((id) => {
        const w = p.workers[id],
          b = p.time_budget?.per_case[id];
        const label = !w
          ? '等待调度'
          : live.has(id)
            ? '正在准备'
            : w.status === 'PLAN_READY'
              ? '计划待核对'
              : w.status === 'NEEDS_REVIEW'
                ? '需要核对用例'
                : '暂停 / 待处理';
        return `<div class="preparation-worker"><strong>${h(id)}</strong><span>${label}${w?.reused ? ' · 已复用页面证据' : ''}</span><span>取证 ${durationLabel(b?.discovery_ms)} / 规划 ${durationLabel(b?.planning_ms)}</span></div>`;
      })
      .join('')}</details></div>`;
}
function preparationSettings() {
  const taskId = current,
    o = preparationPreferences.get(taskId) ?? state.preparation?.options ?? {};
  modal(`<h2>准备设置</h2><p>仅影响页面取证和计划准备；正式业务执行仍按原审批进行。</p>
    <label class="field">探索并发<select id="prep-concurrency"><option value="1">串行（默认）</option><option value="2">两路独立只读探索</option></select></label>
    <label><input id="prep-independent" type="checkbox">我已确认所选用例只读、相互独立，筛选/登录等服务器会话状态不会相互影响</label>
    <p class="muted">不同浏览器窗口不代表服务器隔离。有关联、共享会话状态或涉及写入时，请保持串行。</p>
    <label class="field">时间分配<select id="prep-time"><option value="1">标准：按步骤和预期分项分配</option><option value="2">延长：各阶段2倍时间</option></select></label>
    <p>延长时间不会增加本轮模型调用上限或三次候选机会，不清空历史消耗、不自动重试已执行业务。单条预算到限后继续其他条。</p>
    <p id="prep-error" role="alert"></p><button class="primary" id="save-preparation-settings">保存设置</button>`);
  $('#prep-concurrency').value = String(o.concurrency ?? 1);
  $('#prep-time').value = String(o.time_multiplier ?? 1);
  $('#prep-independent').checked = o.independent_readonly === true;
  $('#save-preparation-settings').onclick = () => {
    const options = {
      concurrency: Number($('#prep-concurrency').value),
      time_multiplier: Number($('#prep-time').value),
      independent_readonly: $('#prep-independent').checked,
    };
    if (
      options.concurrency === 2 &&
      (!options.independent_readonly || state.authorization.writes)
    ) {
      $('#prep-error').textContent = errors.PARALLEL_READONLY_CONFIRMATION_REQUIRED;
      return;
    }
    preparationPreferences.set(taskId, options);
    close();
    updateWorkflow();
  };
}
function obligationEditor(step, key) {
  return `<label class="field">需逐项验证的预期（每行一项，可编辑）<textarea data-obligations="${h(key)}">${h((step.obligations ?? []).map((o) => o.text).join('\n'))}</textarea></label>`;
}
function readObligations(key, stepIndex) {
  return $(`[data-obligations="${key}"]`)
    .value.split('\n')
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `S${stepIndex + 1}-O${index + 1}`, text }));
}
function taskAPI(suffix, body) {
  if (!current) throw new Error('请先选择任务。');
  return api(`/api/tasks/${current}/${suffix}`, body);
}
// This compatibility view deliberately exports only event metadata from older services.
// Case text, authentication state, input values and page captures are never copied here.
function basicDiagnostics(s) {
  const allowed = [
    'type',
    'at',
    'case_id',
    'step_id',
    'job_id',
    'request_id',
    'operation',
    'status',
    'code',
    'passed',
    'attempt',
    'repair_count',
    'duration_ms',
    'requested_model',
    'response_model',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
  ];
  return {
    schema_version: 'ui-agent-diagnostics/v1',
    task_id: s.id,
    logging_available: false,
    scope: '本轮基础日志；模型原始回复未留档',
    records: [],
    timeline: (s.events ?? []).map((event) =>
      Object.fromEntries(
        allowed
          .filter((key) => ['string', 'number', 'boolean'].includes(typeof event[key]))
          .map((key) => [key, event[key]]),
      ),
    ),
    summary: {
      approved_plans: s.cases.filter((c) => c.plan_approved).length,
      execution_receipts: s.cases.reduce((n, c) => n + (c.attempts?.length ?? 0), 0),
    },
  };
}
function diagnosticsSafe(value) {
  if (Array.isArray(value)) return value.map(diagnosticsSafe);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /(?:api[_-]?key|authorization|cookie|password|passwd|secret|credential|access[_-]?token|refresh[_-]?token|session[_-]?storage|storage[_-]?state)/i.test(
          key,
        )
          ? '[REDACTED]'
          : diagnosticsSafe(item),
      ]),
    );
  if (typeof value === 'string')
    return value
      .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [REDACTED]')
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
      .replace(
        /((?:api[_-]?key|password|passwd|secret|access[_-]?token|refresh[_-]?token)\s*[=:]\s*)([^\s,;"']+)/gi,
        (match, prefix, raw) => (raw.startsWith('[REDACTED]') ? match : prefix + '[REDACTED]'),
      );
  return value;
}
const diagnosticTypeNames = {
  MODEL_REQUEST: '模型请求已留档',
  MODEL_TRANSPORT_STARTED: '接口请求开始',
  MODEL_TRANSPORT_FINISHED: '接口请求结束',
  MODEL_RESPONSE_PARSED: '模型回复已解析',
  MODEL_RESPONSE_REJECTED: '模型回复未采纳',
  MODEL_PROVIDER_RESULT: '模型返回值已留档',
  MODEL_DECISION: '模型结果处理结论',
};
const diagnosticOutcomes = {
  ACCEPTED: '已采纳',
  BLOCKED: '受阻',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
};
async function diagnosticsDialog() {
  const taskId = current;
  if (!taskId) return toast('请先选择任务。', true);
  let payload;
  const response = await fetch(`/api/tasks/${taskId}/diagnostics`),
    legacy = response.status === 404;
  if (legacy) {
    const latest = await api(`/api/tasks/${taskId}`);
    payload = basicDiagnostics(latest);
  } else {
    payload = await response.json();
    if (!response.ok)
      throw new Error(
        errors[payload.error] ?? `诊断日志读取未完成：${payload.error ?? response.status}`,
      );
    if (
      payload.schema_version !== 'ui-agent-diagnostics/v1' ||
      !Array.isArray(payload.records) ||
      !Array.isArray(payload.timeline)
    )
      throw new Error('诊断日志格式无法识别，未展示或导出。');
  }
  payload = diagnosticsSafe(payload);
  const items = [
    ...payload.records.map((record) => ({ record, source: 'model' })),
    ...payload.timeline.map((record) => ({ record, source: 'activity' })),
  ].sort((a, b) => (Date.parse(b.record.at) || 0) - (Date.parse(a.record.at) || 0));
  const caseIds = [...new Set(items.map(({ record }) => record.case_id).filter(Boolean))].sort(),
    types = [...new Set(items.map(({ record }) => record.type).filter(Boolean))].sort();
  const requests = payload.records.filter((r) => r.type === 'MODEL_REQUEST').length,
    decisions = payload.records.filter((r) => r.type === 'MODEL_DECISION');
  let page = 0;
  const pageSize = 50;
  modal(
    `<h2>诊断日志</h2><p>用于核对 Agent 接收了什么、模型返回了什么、程序如何处理，以及浏览器执行到了哪一步。日志只在本机查看或下载。</p><div class="notice ${payload.logging_available ? '' : 'warn'}">${h(legacy ? '本轮基础日志；模型原始回复未留档' : payload.scope || '模型诊断记录与执行活动；记录范围以本轮实际留档为准。')}<br>日志展示的是可记录的输入、回复和处理结果，不包含模型隐藏思考过程。</div><div class="diagnostics-metrics"><span>已留档模型请求 <b>${requests}</b></span><span>模型处理结论 <b>${decisions.length}</b></span><span>执行活动 <b>${payload.timeline.length}</b></span></div>${!payload.logging_available ? `<p>${legacy ? '当前服务未启用详细模型日志，无法补录历史回复。' : '本轮暂无详细模型日志，历史模型输入输出无法补录。'}已有已核对计划 ${h(payload.summary.approved_plans)} 份、执行证据引用 ${h(payload.summary.execution_receipts)} 条；基础日志导出仅包含事件元数据和数量。</p>` : ''}<div class="diagnostics-filters"><label class="field">用例<select id="diagnostics-case"><option value="">全部用例</option>${caseIds.map((id) => `<option value="${h(id)}">${h(id)}</option>`).join('')}</select></label><label class="field">记录类型<select id="diagnostics-type"><option value="">全部类型</option>${types.map((type) => `<option value="${h(type)}">${h(diagnosticTypeNames[type] ?? eventNames[type] ?? type)}</option>`).join('')}</select></label><label class="field">处理结果<select id="diagnostics-outcome"><option value="">全部结果</option>${Object.entries(
      diagnosticOutcomes,
    )
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join(
        '',
      )}</select></label></div><div class="diagnostics-toolbar"><span id="diagnostics-count" class="muted" aria-live="polite"></span><div class="actions"><button id="diagnostics-refresh">刷新日志</button><button id="diagnostics-download">导出本轮日志 JSON</button></div></div><div id="diagnostics-records"></div><div class="diagnostics-pagination"><button id="diagnostics-prev">上一页</button><span id="diagnostics-page" class="muted"></span><button id="diagnostics-next">下一页</button></div><details><summary>留档范围与统计</summary><pre>${h(JSON.stringify({ task_id: payload.task_id, schema_version: payload.schema_version, logging_available: payload.logging_available, scope: payload.scope, metadata: payload.metadata, summary: payload.summary }, null, 2))}</pre></details><p>详细日志可能包含用例、页面文字和模型输出。导出前请核对内容，仅在获准范围内分享。</p>`,
  );
  function renderDiagnostics() {
    const selectedCase = $('#diagnostics-case').value,
      selectedType = $('#diagnostics-type').value,
      selectedOutcome = $('#diagnostics-outcome').value;
    const filtered = items.filter(
      ({ record }) =>
        (!selectedCase || record.case_id === selectedCase) &&
        (!selectedType || record.type === selectedType) &&
        (!selectedOutcome || record.outcome === selectedOutcome),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    $('#diagnostics-count').textContent =
      `符合筛选 ${filtered.length} 条 · 全部 ${items.length} 条`;
    $('#diagnostics-records').innerHTML =
      filtered
        .slice(page * pageSize, (page + 1) * pageSize)
        .map(
          ({ record, source }) =>
            `<details class="diagnostic-record"><summary><span class="diagnostic-record-heading"><time>${h(record.at ? new Date(record.at).toLocaleString('zh-CN', { hour12: false }) : '时间未记录')}</time><strong>${h(diagnosticTypeNames[record.type] ?? eventNames[record.type] ?? record.type)}</strong>${record.case_id ? `<span>${h(record.case_id)}</span>` : ''}${record.outcome ? `<span class="badge ${record.outcome === 'ACCEPTED' ? 'good' : ['REJECTED', 'BLOCKED'].includes(record.outcome) ? 'bad' : ''}">${h(diagnosticOutcomes[record.outcome] ?? record.outcome)}</span>` : ''}</span><span class="diagnostic-record-meta">${source === 'model' ? '模型诊断' : '执行活动'}${record.request_id ? ' · 请求 ' + h(record.request_id) : ''}${record.duration_ms !== undefined ? ' · ' + h(record.duration_ms) + ' ms' : ''}${record.code ? ' · ' + h(record.code) : ''}</span></summary><pre>${h(JSON.stringify(record, null, 2))}</pre></details>`,
        )
        .join('') || '<p class="muted">暂无符合筛选的记录。</p>';
    $('#diagnostics-page').textContent = `第 ${page + 1} / ${pages} 页`;
    $('#diagnostics-prev').disabled = page === 0;
    $('#diagnostics-next').disabled = page >= pages - 1;
  }
  for (const selector of ['#diagnostics-case', '#diagnostics-type', '#diagnostics-outcome'])
    $(selector).onchange = () => {
      page = 0;
      renderDiagnostics();
    };
  $('#diagnostics-prev').onclick = () => {
    page--;
    renderDiagnostics();
  };
  $('#diagnostics-next').onclick = () => {
    page++;
    renderDiagnostics();
  };
  $('#diagnostics-refresh').onclick = () => action(diagnosticsDialog);
  $('#diagnostics-download').onclick = () => {
    const blob = new Blob(
        [JSON.stringify({ ...payload, exported_at: new Date().toISOString() }, null, 2) + '\n'],
        { type: 'application/json;charset=utf-8' },
      ),
      url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `ui-agent-diagnostics-${String(payload.task_id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('诊断日志已在本机导出；文件包含本轮全部已留档记录。');
  };
  renderDiagnostics();
}
async function refresh(force = false) {
  if (polling) return;
  polling = true;
  try {
    const previousDiscoverySupport = supportsDiscovery();
    config = await api('/api/config');
    if (
      config.console_protocol !== 'ui-agent-console/v1' &&
      !['0.2.0', '0.2.1', '0.3.0'].includes(config.version)
    ) {
      current = null;
      $('#workspace').innerHTML =
        '<div class="intro"><h1>服务版本暂不兼容</h1><p>当前服务与此控制台协议不兼容，请正常停止原服务，使用同一安装包启动后刷新。</p></div>';
      return;
    }
    $('#connection').title =
      `版本 ${config.version} · 构建 ${config.build_id?.slice(0, 12) ?? '旧版未知'}`;
    $('#provider-status').textContent = config.configured
      ? `已配置 · ${config.model}`
      : '尚未配置密钥 · 演示仍可运行';
    $('#connection').textContent = config.configured
      ? config.model + ' · 官方接口'
      : 'DeepSeek · 待连接';
    const tasks = await api('/api/tasks');
    if (!current) {
      const linkedTask = new URLSearchParams(location.hash.slice(1)).get('task');
      if (tasks.some((task) => task.id === linkedTask)) current = linkedTask;
    }
    const navigationSignature = JSON.stringify([tasks, current]);
    if (navigationSignature !== taskNavigationSignature) {
      taskNavigationSignature = navigationSignature;
      $('#task-list').innerHTML =
        tasks
          .map(
            (t) =>
              `<button class="task ${t.id === current ? 'selected' : ''}" data-task="${h(t.id)}">${h(t.name)}<small>${t.total ?? '?'} 条用例 · ${h({ IDLE: '空闲', IMPORTED: '已导入', ANALYZING: '分析中', RUNNING: '执行中', STOPPED: '已停止', NEEDS_ATTENTION: '需处理', INTERRUPTED: '已中断' }[t.status] ?? t.status)}</small></button>`,
          )
          .join('') || '<p class="muted">还没有测试轮次</p>';
      for (const b of document.querySelectorAll('[data-task]'))
        b.onclick = () =>
          action(async () => {
            current = b.dataset.task;
            history.replaceState(null, '', '#task=' + encodeURIComponent(current));
            selected.clear();
            lastRevision = -1;
          });
    }
    if (!current) {
      renderEmpty();
      return;
    }
    const taskId = current;
    const next = await api('/api/tasks/' + taskId);
    if (taskId !== current) return;
    const changed =
      force ||
      next.revision !== lastRevision ||
      next.authenticated !== state?.authenticated ||
      JSON.stringify(next.active) !== JSON.stringify(state?.active) ||
      previousDiscoverySupport !== supportsDiscovery() ||
      JSON.stringify(next.discovery) !== JSON.stringify(state?.discovery) ||
      JSON.stringify(next.site_cleanup_blockers) !== JSON.stringify(state?.site_cleanup_blockers);
    state = next;
    outputSyncAt = Date.now();
    outputConnectionError = false;
    if (changed) {
      lastRevision = state.revision;
      render();
    }
    updateAgentOutput();
    if (!changed) updateWorkflow();
    // Detailed replies are already redacted by the existing diagnostics API.
    // Read them independently: a slow log must not freeze the live job state.
    void refreshOutputDiagnostics();
  } catch (error) {
    outputConnectionError = true;
    updateAgentOutput();
    updateWorkflow();
    if (force) throw error;
  } finally {
    polling = false;
  }
}
function renderEmpty() {
  $('#workspace').innerHTML =
    `<div class="intro"><p class="eyebrow">FROM TEST CASES TO BROWSER EVIDENCE</p><h1>让每一条用例，<br>都有看得见的执行过程。</h1><p>导入任意项目的 Web UI 用例，核对预期并登录。<br>${supportsDiscovery() ? '确认登录后，Agent 自动探索相关页面，为已确认用例生成候选计划。' : '当前服务尚未启用自动探索；仍可查看和使用现有用例、页面与计划。'}<br>核对计划后，程序执行并记录断言、截图和清理结果。</p><div class="actions"><button id="empty-import" class="primary">导入我的测试用例</button><button id="empty-demo">体验商品与任务演示 →</button></div><p class="mono">EXCEL / CSV / JSON · PLAYWRIGHT · DEEPSEEK</p></div>`;
  $('#empty-import').onclick = newTask;
  $('#empty-demo').onclick = createDemo;
}
const eventNames = {
  PREPARATION_EVIDENCE_REUSED: '复用当前有效页面证据',
  PREPARATION_PLANNING_STARTED: '取证结束，开始独立计时的规划',
  PREPARATION_CASE_PAUSED: '本条预算到限，保留进度并继续后续',
  CASE_ADVICE_READY: '已生成处理建议，未修改用例',
  CASE_ADVICE_REJECTED: '人工未采纳建议，原用例不变',
  PREPARATION_WAITING_LOGIN: '等待登录，完成后自动继续',
  ADAPTER_REPAIR_STARTED: '正在修复页面适配源码',
  ADAPTER_REPAIR_VERIFIED: '适配修复已验证并启用',
  ADAPTER_REPAIR_REJECTED: '适配修复未采纳，保留原版本',
  EVIDENCE_RECOVERY_STARTED: '正在重新取证并探测技术障碍',
  EVIDENCE_RECOVERY_FINISHED: '本次取证恢复结束',
  DISCOVERY_REQUEST_BLOCKED: '已拦截未知请求，继续观察独立菜单',
  CHECKPOINT_STARTED: '开始检查点',
  CHECKPOINT_FINISHED: '检查点已结束',
  CLEANUP_OBSERVATION_STARTED: '正在只读返回清理观察页',
  CLEANUP_OBSERVATION_FINISHED: '已返回清理观察页',
  PLAN_REPAIR_RETAINED: '保留既有修复结果与预算',
  PLAN_PREPARATION_STARTED: '开始生成首次候选计划',
  INPUT_REVIEW_STARTED: '正在审查用例输入',
  INPUT_REVIEW_FINISHED: '用例输入审查结束',
  PLAN_REPAIR_STARTED: '开始有限计划自修复',
  PLAN_REPAIR_ATTEMPT: '计划修复尝试已留档',
  PLAN_REPAIR_EXHAUSTED: '计划修复次数已用完，需处理',
  PLAN_AUDIT_STARTED: '正在核验计划与原预期',
  PLAN_AUDIT_FINISHED: '计划语义核验结束',
  DISCOVERY_CONTRACT_UPDATED: '已更新探索交互说明',
  DISCOVERY_FACTS_UPDATED: '已更新用例页面观察',
  PLAN_REVISION_REQUESTED: '已提交计划修订意见',
  PLAN_RESPONSE_REVALIDATED: '已重新校验留档计划',
  DISCOVERY_RESPONSE_NORMALIZED: '已兼容探索回复格式',
  PLAN_RESPONSE_NORMALIZED: '已兼容计划回复格式',
  IMPORTED: '已导入用例',
  AUTHORIZATION_UPDATED: '已更新环境授权',
  BROWSER_OPENED: '已打开浏览器',
  PAGE_CAPTURED: '已读取页面',
  AUTHENTICATED: '已保存本次登录',
  CASE_CONFIRMED: '已确认用例',
  PLAN_APPROVED: '已核对计划',
  JOB_STARTED: '开始批次',
  CASE_STARTED: '开始处理用例',
  MODEL_RESPONSE: '收到模型结果',
  CASE_REVIEWED: '用例文本审查结束',
  PLAN_GENERATED: '已生成计划',
  MAPPING_BLOCKED: '需要补充页面',
  CASE_PREPARATION_FAILED: '用例准备未完成',
  ATTEMPT_STARTED: '开始执行',
  STEP_STARTED: '开始步骤',
  ACTION_RESOLVING: '正在定位控件',
  LOCATOR_REPAIR_REQUESTED: '正在修复当前动作定位',
  CLEANUP_OWNERSHIP_OBSERVED: '已检查清理目标身份',
  CLEANUP_ACTION_EXECUTED: '清理动作已执行',
  ACTION_STARTED: '正在操作',
  ACTION_EXECUTED: '操作已执行',
  ASSERTION_OBSERVED: '已观察断言',
  STEP_FINISHED: '步骤结束',
  CLEANUP_STARTED: '正在清理',
  CLEANUP_FINISHED: '已验证清理',
  CASE_RESULT: '已保存执行结果',
  LOCATOR_REPAIR_ACCEPTED: '已采纳操作定位修复',
  JOB_FINISHED: '批次结束',
  JOB_FAILED: '批次需处理',
  STOP_REQUESTED: '正在停止',
  RECOVERY_CONFIRMED: '已记录人工恢复',
  FIXTURE_CREATED: '已创建合成演示',
  HANDOFF_BOUND: '已关联源码导出物',
  INTERRUPTED: '服务重启，执行已中断',
};
const opName = {
  dismiss_optional: '提示出现时关闭（未出现则跳过）',
  click: '点击',
  fill: '输入',
  select: '选择',
  press: '按键',
  check: '勾选',
  uncheck: '取消勾选',
  hover: '悬停',
  reload: '刷新当前页',
  navigate: '打开页面',
  wait: '等待',
};
const loc = (l) =>
  l?.kind === 'case_named'
    ? `尚未观察 · 原步骤 ${l.source_step_id} 命名：${loc(l.target)} · 类型 ${l.control_type} · ${l.guard?.path} / ${l.guard?.page_heading} / ${l.guard?.step}（执行时核验唯一表单与控件）`
    : ['row', 'cell'].includes(l?.kind)
      ? `${loc(l.table)} · ${l.key?.column}=${l.key?.value} · ${l.kind === 'cell' ? l.column : l.target ? loc(l.target) : '整行'}`
      : (l?.name ?? l?.value ?? '');
Object.assign(eventNames, {
  OPTIONAL_DIALOG_OBSERVED: '条件提示已检查',
  ACTION_SKIPPED: '提示未出现，未派发点击',
  DISCOVERY_STARTED: '自动探索已启动',
  DISCOVERY_OBSERVED: '已观察探索页面',
  DISCOVERY_CANDIDATES_PROVIDED: '本轮可选目标已提供',
  DISCOVERY_ACTION_BEFORE: '准备探索控件',
  DISCOVERY_ACTION_AFTER: '探索控件操作结束',
  DISCOVERY_NAVIGATE_BEFORE: '准备探索页面',
  DISCOVERY_REDIRECT_ALLOWED: '页面跳转已核验，继续探索',
  DISCOVERY_NAVIGATE_AFTER: '已进入探索页面',
  DISCOVERY_PAGE_CAPTURED: '已采集探索页面',
  DISCOVERY_CASE_FINISHED: '本条用例探索结束',
  DISCOVERY_BLOCKED: '自动探索受阻',
  DISCOVERY_BATCH_BUDGET_EXHAUSTED: '本批探索预算已耗尽',
  JOB_BATCH_STARTED: '开始处理下一批用例',
  JOB_BATCH_FINISHED: '本批用例处理结束',
  DISCOVERY_FINISHED: '自动探索结束',
  DISCOVERY_FAILED: '自动探索未完成',
});
Object.assign(eventNames, {
  DISCOVERY_OPENING: '正在复用登录打开探索页面',
  DISCOVERY_OPENED: '探索页面已打开',
  DISCOVERY_REFRESHED: '页面已变化，正在重新观察',
});
Object.assign(errors, {
  DISCOVERY_TIMEOUT: '本条页面取证已达到时间上限，已保留页面并继续后续用例。',
  DISCOVERY_STEP_LIMIT: '本轮探索已达到动作上限，已保留当前进度。',
  DISCOVERY_CASE_STEP_LIMIT: '本条用例已达到探索动作上限，已继续处理后续用例。',
  DISCOVERY_CASE_MODEL_BUDGET_EXHAUSTED:
    '本条用例已达到探索模型调用上限，已保留进度并继续后续用例。',
  DISCOVERY_MODEL_BUDGET_EXHAUSTED: '本批探索模型调用预算已耗尽，未完成用例可在新批次继续。',
  MODEL_CALL_BUDGET_EXHAUSTED: '本批逻辑模型调用预算已耗尽，已保留完成和受阻用例。',
  DISCOVERY_LOOP_DETECTED: '发现重复探索同一页面和控件，已停止此用例的探索。',
  DISCOVERY_STALE_PAGE: '页面或目标控件已变化，需要重新观察。',
  DISCOVERY_CANDIDATE_UNKNOWN: '模型选择的控件不在当前页面候选中，该操作未执行。',
  DISCOVERY_DANGEROUS_ROUTE: '目标入口可能提交、修改数据或下载文件，未作为探索导航执行。',
  DISCOVERY_EVIDENCE_FAILED: '探索操作记录无法保存，后续操作已停止。',
  DISCOVERY_DISPATCH_BLOCKED: '控件在点击前发生变化或当前操作不属于获准的探索动作。',
});
function eventText(e) {
  const discovery = e.type.startsWith('DISCOVERY_'),
    targetName = e.name ?? e.target?.name ?? e.target?.value ?? e.target_name,
    url = e.url ?? e.target?.url;
  return `${e.type === 'CLEANUP_ACTION_STARTED' ? '正在清理操作' : (eventNames[e.type] ?? e.type)}${e.case_id ? ' · ' + e.case_id : ''}${e.step_id ? ' / ' + e.step_id : ''}${e.checkpoint_id ? ' / 检查点 ' + e.checkpoint_id : ''}${e.round !== undefined ? ' · ' + (e.round === 0 ? '首次计划' : '第 ' + e.round + ' 次修复') : ''}${e.operation ? ' · ' + (opName[e.operation] ?? e.operation) + ' ' + (discovery ? (targetName ?? loc(e.target)) : loc(e.target)) : ''}${discovery && targetName && !e.operation ? ' · ' + targetName : ''}${discovery && url ? ' · ' + url : ''}${e.status ? ' · ' + (config.labels?.[e.status] ?? discoveryStatusNames[e.status] ?? repairStatusNames[e.status] ?? e.status) : ''}${e.outcome ? ' · ' + (repairStatusNames[e.outcome] ?? diagnosticOutcomes[e.outcome] ?? e.outcome) : ''}${typeof e.issues === 'number' ? ' · ' + e.issues + ' 项需处理' : ''}${e.passed !== undefined ? ' · ' + (e.passed ? '满足' : '不一致') : ''}${e.check ? ' · 预期 ' + JSON.stringify(e.expected) + ' / 实际 ' + JSON.stringify(e.actual) : ''}${e.code ? ' · ' + reasonText(e.code) : ''}${e.reason ? ' · ' + reasonText(e.reason) : ''}${e.message ? ' · ' + e.message : ''}${e.action ? ' · ' + (typeof e.action === 'string' ? e.action : (e.action.name ?? opName[e.action.op] ?? e.action.op ?? '')) : ''}${e.response_model ? ' · ' + e.response_model : ''}`;
}
const outputStages = {
  MODEL: '正在等待模型回复',
  WAITING_USER_LOGIN: '等待你在浏览器登录',
  review: '正在审查测试用例',
  plan: '正在生成候选计划',
  prepare: '正在准备测试',
  discover: '正在探索业务页面',
  run: '正在执行测试',
};
const outputPhases = {
  case_advice: '用例修订草案（待人工确认）',
  review: '用例审查',
  input_review: '输入核验',
  plan: '生成计划',
  plan_audit: '计划核验',
  discover: '页面探索',
  discovery: '页面探索',
  adapter_repair: '适配修复',
  repair: '定位修复',
};
function outputIssue(e) {
  return (
    e.passed === false ||
    ['REJECTED', 'BLOCKED', 'FAILED'].includes(e.outcome) ||
    [
      'FAIL_ASSERTION',
      'TECHNICAL_FAILED',
      'CLEANUP_REQUIRED',
      'BLOCKED_MAPPING',
      'BLOCKED_BUDGET',
    ].includes(e.status) ||
    /(?:FAILED|BLOCKED|REJECTED|EXHAUSTED|INTERRUPTED)$/.test(e.type) ||
    /REPAIR_(?:STARTED|ATTEMPT|REQUESTED)$/.test(e.type) ||
    e.will_retry === true
  );
}
function outputTime(at) {
  return Number.isFinite(Date.parse(at))
    ? new Date(at).toLocaleTimeString('zh-CN', { hour12: false })
    : '时间未记录';
}
function outputAge(at) {
  const stamp = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(stamp) || !stamp) return '暂无记录';
  const seconds = Math.max(0, Math.floor((Date.now() - stamp) / 1000));
  return seconds < 2
    ? '刚刚'
    : seconds < 60
      ? `${seconds} 秒前`
      : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒前`;
}
function outputText(selector, text) {
  const node = outputPanel?.querySelector(selector);
  if (node && node.textContent !== text) node.textContent = text;
}
function outputCurrentEvents() {
  const events = state?.events ?? [];
  const start = events.findLastIndex((event) => event.type === 'JOB_STARTED');
  return start < 0 ? events : events.slice(start);
}
function outputStatus() {
  const active = state.active;
  const events = outputCurrentEvents();
  const recent = events.at(-1);
  if (outputConnectionError || (outputSyncAt && Date.now() - outputSyncAt > 15000))
    return {
      tone: 'error',
      title: '连接中断，运行状态待确认',
      detail: '正在自动重新连接本机服务。下方保留最后收到的输出，恢复连接后会更新状态。',
    };
  if (active) {
    if (events.some((e) => e.type === 'STOP_REQUESTED'))
      return {
        tone: 'waiting',
        title: '正在停止并收尾',
        detail: '停止请求已收到，请等待当前操作和必要清理结束。',
      };
    if (active.stage === 'WAITING_USER_LOGIN')
      return {
        tone: 'waiting',
        title: outputStages.WAITING_USER_LOGIN,
        detail: '请在 Agent 打开的浏览器完成登录，识别成功后会自动继续。',
      };
    const title =
      outputStages[active.stage] ??
      eventNames[active.stage] ??
      outputStages[active.kind] ??
      'Agent 正在处理';
    return {
      tone: 'running',
      title,
      detail:
        active.stage === 'MODEL'
          ? '请求正在处理中，收到回复后会显示在下方；可以继续查看已有输出。'
          : 'Agent 正在继续当前批次，页面会自动更新执行和修复记录。',
    };
  }
  if (state.status === 'STOPPED')
    return {
      tone: 'neutral',
      title: '当前批次已停止',
      detail: '已保留停止前的输出，请根据用例状态决定下一步。',
    };
  if (state.status === 'INTERRUPTED')
    return {
      tone: 'error',
      title: '执行已中断',
      detail: '请核对最后输出及清理状态，已开始的操作不会自动重放。',
    };
  const failure = events.findLast((e) => e.type === 'JOB_FAILED' || e.type === 'INTERRUPTED');
  if (failure || state.status === 'NEEDS_ATTENTION')
    return {
      tone: 'error',
      title: '运行已结束，需要处理',
      detail: failure?.code ? reasonText(failure.code) : '请查看下方异常原因与用例状态。',
    };
  const touched = new Set(events.map((e) => e.case_id).filter(Boolean));
  const cases = state.cases.filter((c) => touched.has(c.case_id));
  if (cases.some((c) => !c.reviewed && !c.attempts.length))
    return {
      tone: 'waiting',
      title: cases.some((c) => c.discovery?.status === 'CAPTURED')
        ? '页面已探索，等待核对用例后生成计划'
        : '等待核对用例',
      detail: preparationSummary(cases) + '。请使用“本轮测试流程”中的下一步操作。',
    };
  if (
    cases.some((c) =>
      [
        'BLOCKED_MAPPING',
        'BLOCKED_BUDGET',
        'AUTH_REQUIRED',
        'BLOCKED_DATA',
        'CLEANUP_REQUIRED',
        'TECHNICAL_FAILED',
        'FAIL_ASSERTION',
      ].includes(c.status),
    )
  )
    return {
      tone: 'error',
      title: '本批处理结束，有用例需要处理',
      detail: preparationSummary(cases) + '。请查看对应的原因；已有计划的用例可以单独继续。',
    };
  if (cases.some((c) => c.plan && !c.plan_approved))
    return {
      tone: 'waiting',
      title: '计划已生成，等待核对',
      detail: preparationSummary(cases) + '。请核对计划的操作与预期。',
    };
  if (events.some((e) => e.type === 'JOB_FINISHED'))
    return {
      tone: 'neutral',
      title: cases.some((c) => !c.attempts.length && !c.plan)
        ? '页面探索已结束，计划尚未生成'
        : '当前批次已结束',
      detail: preparationSummary(cases) + '。请按测试流程继续，执行结果见报告。',
    };
  return {
    tone: 'neutral',
    title: '等待开始',
    detail: recent
      ? '已有操作记录。选择用例后开始准备或执行。'
      : '选择用例并开始准备，Agent 的运行输出会显示在这里。',
  };
}
function mountAgentOutput() {
  if (outputTask !== state.id) {
    outputTask = state.id;
    outputPanel = null;
    outputFollow = true;
    outputFilter = 'all';
    outputSignature = '';
    outputDiagnostics = [];
    outputDiagnosticsAt = 0;
    outputDiagnosticsError = '';
    outputWasBusy = false;
    outputActionError = '';
  }
  if (!outputPanel) {
    outputPanel = document.createElement('section');
    outputPanel.id = 'agent-output';
    outputPanel.className = 'panel agent-output';
    outputPanel.setAttribute('aria-labelledby', 'agent-output-title');
    outputPanel.innerHTML = `
      <div class="output-heading"><div><p class="output-eyebrow">运行过程</p><h2 id="agent-output-title">Agent 运行输出</h2></div>
        <div class="actions"><span id="output-connection" class="output-connection"></span><button id="output-refresh">刷新状态</button><button id="stop" class="danger" hidden>停止当前批次</button></div></div>
      <div class="output-status" role="status" aria-live="polite" aria-atomic="true"><span class="output-dot" aria-hidden="true"></span><div><strong id="output-state"></strong><p id="output-detail"></p></div></div>
      <div class="output-meta"><span>当前用例 <b id="output-case">—</b></span><span>本批模型调用 <b id="output-calls">—</b></span><span>本轮累计 <b id="output-total-calls">—</b></span><span>探索调用 <b id="output-discovery-calls">—</b></span><span>当前用例探索 <b id="output-case-calls">—</b></span><span>最后输出 <b id="output-last">暂无记录</b></span></div>
      <p id="output-silence" class="output-notice" hidden></p>
      <div id="output-problem" class="output-problem" hidden><strong>最近异常</strong><p id="output-problem-text"></p><button id="output-diagnostics">查看详细诊断</button></div>
      <div class="output-toolbar"><div class="output-filters" role="group" aria-label="输出筛选"><button data-output-filter="all" aria-pressed="true">全部输出</button><button data-output-filter="issues" aria-pressed="false">异常与重试</button></div><button id="output-follow" aria-pressed="true">跟随最新输出：开</button></div>
      <div id="output-records" class="output-records" tabindex="0" role="region" aria-label="Agent 输出记录，可滚动阅读"><ol id="output-list"></ol></div>
      <div class="output-footer"><span id="output-count"></span><span id="output-log-status"></span></div>`;
    outputPanel.querySelector('#output-refresh').onclick = () =>
      action(async () => {
        outputDiagnosticsAt = 0;
        await refresh(true);
      });
    outputPanel.querySelector('#output-diagnostics').onclick = () => action(diagnosticsDialog);
    outputPanel.querySelector('#stop').onclick = () => action(() => taskAPI('stop', {}));
    outputPanel.querySelector('#output-follow').onclick = () => {
      outputFollow = !outputFollow;
      updateAgentOutput();
      if (outputFollow) {
        const feed = outputPanel.querySelector('#output-records');
        feed.scrollTop = feed.scrollHeight;
      }
    };
    for (const button of outputPanel.querySelectorAll('[data-output-filter]'))
      button.onclick = () => {
        outputFilter = button.dataset.outputFilter;
        updateAgentOutput();
      };
    outputPanel.querySelector('#output-records').addEventListener('scroll', () => {
      const feed = outputPanel.querySelector('#output-records');
      if (outputFollow && feed.scrollHeight - feed.clientHeight - feed.scrollTop > 40) {
        outputFollow = false;
        updateAgentOutput();
      }
    });
    outputPanel.querySelector('#output-records').addEventListener(
      'toggle',
      (event) => {
        if (event.target instanceof HTMLDetailsElement && event.target.open && outputFollow) {
          outputFollow = false;
          updateAgentOutput();
        }
      },
      true,
    );
  }
  const guided = $('#guided-workflow');
  const heading = $('#workspace > .heading');
  if (heading.nextElementSibling !== guided) heading.after(guided);
  const placeholder = $('#agent-output');
  if (placeholder && placeholder !== outputPanel) placeholder.replaceWith(outputPanel);
  if (guided.nextElementSibling !== outputPanel) guided.after(outputPanel);
  updateAgentOutput();
}
function discoveryDiagnosticsText(event) {
  if (!event.observation_diagnostics && !event.candidate_diagnostics && !event.coverage)
    return null;
  const labels = {
    ADAPTER_MAPPING_MISSING: '未生成支持的定位',
    ADAPTER_TARGET_NOT_UNIQUE: '定位不唯一',
    ADAPTER_TARGET_MISSING: '定位已生成，但没有匹配对象',
    ADAPTER_TARGET_IDENTITY_MISMATCH: '定位不是原观察对象',
    ADAPTER_LOCATOR_REJECTED: '定位协议检查未通过',
    TARGET_NOT_UNIQUE: '当前定位不唯一',
    TARGET_DETACHED: '原目标已失效',
    TARGET_NOT_VISIBLE: '目标当前不可见',
    TARGET_OBSTRUCTED: '目标不能接收点击，可能被遮挡',
    TARGET_DISABLED: '目标已禁用',
    DOWNLOAD_FORBIDDEN: '探索不允许下载',
    EDITABLE_UNSUPPORTED: '不支持此编辑区域',
    STATEFUL_CONTROL_UNSUPPORTED: '状态型控件没有受支持的探索动作',
    ACTION_SAFETY_FILTERED: '动作未获探索安全规则许可',
    FORM_SUBMIT_UNAUTHORIZED: '表单提交没有获准的探索能力',
    ROUTE_SAFETY_FILTERED: '路由未通过安全检查',
    NEW_CONTEXT_UNSUPPORTED: '不支持打开新浏览上下文',
    INPUT_CAPABILITY_UNAVAILABLE: '未取得受支持的原文输入能力',
    INPUT_CAPABILITY_REJECTED: '输入当前条件不满足',
    INPUT_ALREADY_MATCHES: '当前值已符合原输入，无需重复操作',
    INPUT_IDENTITY_MISMATCH: '输入目标身份不一致',
    INPUT_SOURCE_UNSUPPORTED: '输入不属于原用例',
    OPTION_UNAVAILABLE: '选项不可用或不唯一',
    INTERACTION_UNSUPPORTED: '当前交互尚无受支持的探索能力',
    OBSERVATION_ONLY: '仅用于观察，无需生成动作',
    DISCOVERY_BROWSER_FAILED: '浏览器检查未完成，原因未知',
    DISCOVERY_ACTION_TIMEOUT: '浏览器检查达到等待期限',
  };
  const lines = ['这是技术观察诊断，不是业务测试结果；未采集或未提供动作不等于页面不存在该功能。'];
  for (const [title, log] of [
    ['定位阶段', event.observation_diagnostics?.rejected],
    ['候选阶段', event.candidate_diagnostics?.excluded],
  ]) {
    if (!log) continue;
    lines.push(`${title}：${log.total} 项未继续`);
    for (const [code, count] of Object.entries(log.counts ?? {}))
      lines.push(`  ${labels[code] ?? code}：${count} 项`);
    for (const sample of log.samples ?? [])
      lines.push(
        `  样例 #${sample.control_index} ${sample.name}：${labels[sample.code] ?? sample.code}`,
      );
    if (log.omitted_samples)
      lines.push(`  另 ${log.omitted_samples} 项仅保留原因计数（样例有上限）。`);
  }
  if (event.coverage) {
    const c = event.coverage;
    const names = {
      dialog: '弹窗',
      step: '当前步骤',
      navigation: '导航',
      table: '表格',
      form: '表单',
      region: '内容区域',
      page: '页面概览',
    };
    lines.push(
      `采集覆盖：${c.sampled_count} / ${c.eligible_count} 项，${c.omitted_count} 项未采集（上限 ${c.limit}）。`,
    );
    for (const r of c.regions ?? [])
      lines.push(
        `  ${names[r.kind] ?? r.kind} ${r.id}：${r.sampled_count} / ${r.eligible_count} 项，未采集 ${r.omitted_count} 项`,
      );
    if (c.omitted_region_count)
      lines.push(
        `  另 ${c.omitted_region_count} 个区域未逐项列出：采集 ${c.unlisted_sampled_count} / ${c.unlisted_eligible_count} 项。`,
      );
    if (c.text_truncated) lines.push('页面正文已截断，后部文字可能未提供；不代表后部功能不存在。');
    if (c.iframes?.count) lines.push(`页面含 ${c.iframes.count} 个框架；本次未采集框架内部。`);
    if (c.shadow_dom?.open_hosts)
      lines.push(`页面含 ${c.shadow_dom.open_hosts} 个开放 Shadow DOM 宿主；本次未采集其内部。`);
    lines.push(
      '覆盖范围仅为当前可见的普通 DOM；未渲染、折叠、虚拟滚动内容及关闭的 Shadow DOM 覆盖未知。',
    );
  }
  return lines.join('\n');
}
function outputRows() {
  const rows = (state.events ?? []).map((event, index) => ({
    key: `event-${index}-${event.at}`,
    at: event.at,
    issue: outputIssue(event),
    text: diagnosticsSafe(eventText(event)),
    source: '运行',
    body: discoveryDiagnosticsText(event),
    summary: '展开探索诊断',
  }));
  const parsed = new Set(
    outputDiagnostics.filter((r) => r.type === 'MODEL_RESPONSE_PARSED').map((r) => r.request_id),
  );
  for (const record of outputDiagnostics) {
    if (record.type === 'MODEL_PROVIDER_RESULT' && parsed.has(record.request_id)) continue;
    const response = [
      'MODEL_RESPONSE_PARSED',
      'MODEL_PROVIDER_RESULT',
      'MODEL_RESPONSE_REJECTED',
    ].includes(record.type);
    if (
      !response &&
      !['MODEL_REQUEST', 'MODEL_DECISION', 'MODEL_TRANSPORT_FINISHED'].includes(record.type)
    )
      continue;
    if (record.type === 'MODEL_TRANSPORT_FINISHED' && !record.will_retry && !record.error_code)
      continue;
    const phase = outputPhases[record.phase] ?? record.phase ?? '模型处理';
    const label = response
      ? '模型回复'
      : record.type === 'MODEL_REQUEST'
        ? '已发送模型请求'
        : record.will_retry
          ? '模型请求重试'
          : record.type === 'MODEL_DECISION'
            ? '回复处理结果'
            : '模型请求异常';
    const code = record.code ?? record.error_code;
    const detail = record.reason ?? record.parsed_value?.reason ?? record.parsed_value?.plan?.notes;
    const body = record.parsed_value ?? record.response_text;
    rows.push({
      key: `model-${record.id ?? `${record.request_id}-${record.type}-${record.at}`}`,
      at: record.at,
      source: '模型',
      issue: outputIssue(record) || !!record.error_code,
      text: `${label} · ${phase}${record.case_id ? ' · ' + record.case_id : ''}${record.outcome ? ' · ' + (diagnosticOutcomes[record.outcome] ?? record.outcome) : ''}${code ? ' · ' + reasonText(code) : ''}${detail ? ' · ' + String(detail).slice(0, 800) : ''}`,
      body:
        response && body !== undefined
          ? typeof body === 'string'
            ? body
            : JSON.stringify(body, null, 2)
          : null,
    });
  }
  return rows.sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
}
function updateAgentOutput() {
  if (!outputPanel?.isConnected || state?.id !== current || outputTask !== current) return;
  const status = outputStatus();
  outputPanel.dataset.tone = status.tone;
  outputText('#output-state', status.title);
  outputText('#output-detail', status.detail);
  const disconnected = status.title.startsWith('连接中断');
  outputPanel.dataset.connection = disconnected ? 'lost' : 'connected';
  outputText(
    '#output-connection',
    disconnected ? '连接异常 · 自动重连中' : '连接正常 · ' + outputAge(outputSyncAt) + '同步',
  );
  const activeBudget = state.active?.budget,
    discoveryBudget = activeBudget?.discovery ?? state.discovery?.budget?.discovery,
    modelBudget = activeBudget?.model_calls ?? state.discovery?.budget?.model_calls;
  outputText('#output-case', state.active?.current_case ?? state.discovery?.current_case ?? '—');
  outputText(
    '#output-calls',
    state.active ? `${state.active.calls ?? 0} / ${modelBudget?.limit ?? '—'}` : '—',
  );
  outputText(
    '#output-total-calls',
    state.active
      ? `${state.active.total_calls ?? 0} / ${state.active.project_budget?.model_call_limit ?? modelBudget?.limit ?? '—'}${state.active.batch_count > 1 ? ` · 第 ${state.active.batch_index}/${state.active.batch_count} 批` : ''}`
      : '—',
  );
  outputText(
    '#output-discovery-calls',
    discoveryBudget
      ? `${state.active?.discovery_calls ?? state.discovery?.model_calls ?? 0} / ${discoveryBudget.model_call_limit}`
      : '—',
  );
  outputText(
    '#output-case-calls',
    discoveryBudget && state.active?.current_case
      ? `${state.active.current_case_calls ?? 0} / ${discoveryBudget.model_calls_per_case}`
      : '—',
  );
  const stop = outputPanel.querySelector('#stop');
  stop.hidden = !state.active;
  stop.disabled = disconnected || outputCurrentEvents().some((e) => e.type === 'STOP_REQUESTED');
  const rows = outputRows();
  const last = rows.at(-1);
  outputText('#output-last', last ? outputAge(last.at) : '暂无记录');
  const silent = !disconnected && state.active && last && Date.now() - Date.parse(last.at) >= 30000;
  outputPanel.querySelector('#output-silence').hidden = !silent;
  if (silent)
    outputText(
      '#output-silence',
      `最近输出在 ${outputAge(last.at)}，服务状态仍在同步。${state.active.stage === 'WAITING_USER_LOGIN' ? '正在等候浏览器登录。' : '可能正在等待模型或页面响应，可以查看下方已有输出。'}`,
    );
  const currentEvents = outputCurrentEvents();
  const issue = currentEvents.findLast(outputIssue);
  outputPanel.querySelector('#output-problem').hidden = !issue && !outputActionError;
  outputText(
    '#output-problem-text',
    outputActionError ||
      (issue
        ? `${outputTime(issue.at)} · ${diagnosticsSafe(eventText(issue))}${state.active ? '（批次仍在处理，请看上方当前状态。）' : ''}`
        : ''),
  );
  outputText('#output-follow', outputFollow ? '跟随最新输出：开' : '跟随最新输出：关');
  outputPanel.querySelector('#output-follow').setAttribute('aria-pressed', String(outputFollow));
  for (const button of outputPanel.querySelectorAll('[data-output-filter]'))
    button.setAttribute('aria-pressed', String(button.dataset.outputFilter === outputFilter));
  const filtered = rows.filter((row) => outputFilter !== 'issues' || row.issue);
  const visible = filtered.slice(-80);
  const signature = JSON.stringify(visible);
  if (signature !== outputSignature) {
    const list = outputPanel.querySelector('#output-list');
    const feed = outputPanel.querySelector('#output-records');
    const scrollTop = feed.scrollTop;
    const existing = new Map([...list.children].map((node) => [node.dataset.key, node]));
    const keep = new Set(visible.map((row) => row.key));
    for (const [key, node] of existing) if (!keep.has(key)) node.remove();
    for (const row of visible) {
      let node = existing.get(row.key);
      if (!node) {
        node = document.createElement('li');
        node.dataset.key = row.key;
        node.className = row.issue ? 'output-row issue' : 'output-row';
        node.innerHTML = `<time>${h(outputTime(row.at))}</time><span class="output-source">${h(row.source)}</span><div class="output-content"><p>${h(diagnosticsSafe(row.text))}</p>${row.body ? `<details><summary>${h(row.summary ?? '展开模型输出')}</summary><pre>${h(diagnosticsSafe(row.body))}</pre></details>` : ''}</div>`;
      }
      // Insert only when order changes; do not detach an expanded/focused reply.
      const index = visible.indexOf(row);
      if (list.children[index] !== node) list.insertBefore(node, list.children[index] ?? null);
    }
    let empty = outputPanel.querySelector('.output-empty');
    if (!visible.length && !empty) {
      empty = document.createElement('p');
      empty.className = 'output-empty';
      feed.append(empty);
    }
    if (empty) {
      empty.hidden = visible.length > 0;
      empty.textContent =
        outputFilter === 'issues'
          ? '当前没有异常或重试记录。'
          : '暂无运行输出。开始准备后，这里会持续显示进展。';
    }
    feed.scrollTop = outputFollow ? feed.scrollHeight : scrollTop;
    outputSignature = signature;
  }
  outputText(
    '#output-count',
    `显示最近 ${visible.length} / ${filtered.length} 条${outputFilter === 'issues' ? '异常与重试' : '输出'} · 完整记录见诊断日志`,
  );
  outputText(
    '#output-log-status',
    outputDiagnosticsError || '每 1.5 秒同步状态 · 模型回复自动补充',
  );
}
async function refreshOutputDiagnostics() {
  const taskId = current;
  const panel = outputPanel;
  const completed = outputWasBusy && !state?.active;
  outputWasBusy = !!state?.active;
  if (
    outputDiagnosticsPending === taskId ||
    !taskId ||
    state?.id !== taskId ||
    (!completed && Date.now() - outputDiagnosticsAt < (state.active ? 6000 : 30000))
  )
    return;
  outputDiagnosticsPending = taskId;
  outputDiagnosticsAt = Date.now();
  try {
    const response = await fetch(`/api/tasks/${taskId}/diagnostics`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('诊断记录暂不可用，运行状态仍单独更新。');
    const payload = await response.json();
    if (payload.task_id !== taskId || !Array.isArray(payload.records))
      throw new Error('诊断记录格式不匹配，运行状态仍单独更新。');
    if (current !== taskId || outputTask !== taskId || outputPanel !== panel) return;
    outputDiagnostics = diagnosticsSafe(payload.records);
    outputDiagnosticsError = '';
  } catch {
    if (current === taskId && outputPanel === panel)
      outputDiagnosticsError = '模型输出暂未同步；可刷新重试，运行状态单独更新。';
  } finally {
    if (outputDiagnosticsPending === taskId) outputDiagnosticsPending = null;
    if (current === taskId && outputPanel === panel) updateAgentOutput();
  }
}
function discoveryHTML(s) {
  if (!supportsDiscovery())
    return `<div class="notice warn discovery-status" role="status"><strong>当前服务尚未启用自动探索</strong><span>服务版本 ${h(config.version)}。自动探索按钮不可用；现有页面读取、计划和执行入口仍可使用。</span></div>`;
  const d = s.discovery;
  if (!d)
    return '<div class="discovery-status" role="status"><strong>自动探索待启动</strong><span>确认登录后自动探索相关页面，并为已确认用例生成候选计划；也可点击按钮发起一轮探索。</span></div>';
  const count = (value) =>
      Array.isArray(value) ? value.length : Number.isFinite(value) ? value : 0,
    reason =
      d.reason === 'WRITE_NOT_AUTHORIZED' ? '探索请求尚未获得只读确认' : reasonText(d.reason);
  const blockedRequest = [...(s.events ?? [])]
    .reverse()
    .find(
      (event) => event.type === 'DISCOVERY_FAILED' && event.job_id === d.job_id && event.blocked,
    )?.blocked;
  const queryHelp =
    d.reason === 'WRITE_NOT_AUTHORIZED' && blockedRequest
      ? `<p>探索时拦截了未确认的请求：<code>${h(blockedRequest.method)} ${h(blockedRequest.path)}</code>。若已核实为只读查询，请在“环境设置 → 使用 POST 的只读查询接口”添加该完整路径后重新探索。允许计划写入不会放开探索阶段的请求。</p>`
      : '';
  const budget = d.budget?.discovery;
  const budgetText = budget
    ? ` · 第 ${d.batch_index ?? 1}/${d.batch_count ?? 1} 批 · 模型 ${count(d.model_calls)} / ${budget.model_call_limit} 次（每条最多 ${budget.model_calls_per_case}） · 动作 ${count(d.steps)} / ${budget.step_limit} 步 · 时限 ${Math.round(budget.timeout_ms / 60000)} 分钟${Number.isFinite(d.project_model_calls) ? ` · 本轮探索累计 ${d.project_model_calls} 次` : ''}`
    : '';
  return `<div class="discovery-status ${['PARTIAL', 'BLOCKED', 'FAILED', 'INTERRUPTED'].includes(d.status) ? 'warn' : ''}" role="status"><strong>${h(discoveryStatusNames[d.status] ?? d.status ?? '探索状态待确认')}</strong><span>${d.current_case ? '当前用例 ' + h(d.current_case) + ' · ' : ''}已采集 ${count(d.pages)} 个页面 · 已探索 ${count(d.steps)} 步${budgetText}${reason ? ' · ' + h(reason) : ''}</span>${queryHelp}</div>`;
}
function siteCleanupNotice(task) {
  const blockers = task.site_cleanup_blockers ?? [];
  if (!blockers.length) return '';
  return `<div class="notice warn site-cleanup-notice" role="status"><strong>此站点有数据恢复事项，自动探索与执行已暂停</strong><p>先到原任务核实测试数据并记录恢复证据；新建任务不能绕过。原任务仍可打开浏览器用于人工处理。</p><ul>${blockers.map((item) => `<li>${h(item.task_name)} · ${h(item.case_id ?? '记录无法核实')} ${item.reason === 'STATE_UNVERIFIED' ? '请维护者检查保留的记录，勿删除历史' : `<button class="link" data-cleanup-task="${h(item.task_id)}">打开原任务</button>`}</li>`).join('')}</ul></div>`;
}
function render() {
  const auxiliaryOpen = $('#preparation-tools')?.open ?? false;
  const outputScroll = outputPanel?.querySelector('#output-records')?.scrollTop ?? 0;
  const outputFocused = outputPanel?.contains(document.activeElement)
    ? document.activeElement
    : null;
  const s = state,
    busy = !!s.active,
    count = (status) => s.cases.filter((c) => c.status === status).length,
    blocked = s.cases.filter((c) =>
      [
        'NEEDS_REVIEW',
        'NEEDS_MAPPING',
        'BLOCKED_MAPPING',
        'BLOCKED_BUDGET',
        'AUTH_REQUIRED',
        'BLOCKED_DATA',
        'CLEANUP_REQUIRED',
      ].includes(c.status),
    ).length;
  history.replaceState(null, '', '#task=' + encodeURIComponent(s.id));
  const template = document.createElement('template');
  template.innerHTML = `${siteCleanupNotice(s)}<div class="heading"><div><h1>${h(s.name)}</h1><p>${h(s.target)} · ${s.fixture ? '本机合成演示' : '独立测试轮次'}</p></div><div class="actions"><button id="environment">环境设置</button><button id="diagnostics">诊断日志</button><a class="download" href="/api/tasks/${s.id}/report">下载离线报告 ↗</a></div></div>${s.fixture ? '<div class="notice">演示使用本地商品查询与任务管理、预制执行计划；运行时使用真实 Chromium。该结果不代表真实 DeepSeek 规划或产品验收。</div>' : ''}<div class="metrics"><div class="metric"><b>${s.cases.length}</b><span>原始用例总数</span></div><div class="metric"><b>${count('READY')}</b><span>可执行</span></div><div class="metric"><b>${count('PASS_ASSERTIONS')}</b><span>已核对断言满足</span></div><div class="metric"><b>${count('FAIL_ASSERTION') + count('TECHNICAL_FAILED')}</b><span>需查看执行差异</span></div><div class="metric"><b>${blocked}</b><span>待准备或处理</span></div></div><section class="panel guided-workflow" id="guided-workflow" aria-labelledby="workflow-title"></section><details class="panel" id="preparation-tools" ${auxiliaryOpen ? 'open' : ''}><summary>高级辅助操作（按需展开）</summary><div class="workflow"><section class="panel"><h3><i>01</i>核对用例</h3><p>原文单独保留。缺失或矛盾的预期按用例澄清，其他用例可以继续。</p><div class="actions"><button id="review" ${busy ? 'disabled' : ''}>审查所选用例</button><button id="confirm" ${busy ? 'disabled' : ''}>确认所选原文</button></div></section><section class="panel"><h3><i>02</i>登录并探索 <span class="badge ${s.authenticated ? 'good' : ''}">${s.authenticated ? '登录可复用' : s.browser_open ? '浏览器已打开' : '未连接'}</span></h3><p>${supportsDiscovery() ? '优先使用上方测试流程；这里用于补充页面信息或处理登录识别问题。' : '在 Chromium 登录一次并确认可见标志。当前服务尚未启用自动探索。'}</p><div class="actions"><button id="browser" ${busy ? 'disabled' : ''}>打开浏览器</button><button id="capture" ${busy ? 'disabled' : ''} title="需要补充页面信息时，读取当前浏览器页面">辅助：读取当前页面</button><button id="auth" ${busy ? 'disabled' : ''}>确认登录状态</button></div></section><section class="panel"><h3><i>03</i>核对计划并执行</h3><p>已采集 ${s.snapshots?.length ?? 0} 个页面。${supportsDiscovery() ? '辅助探索允许先采集页面；仅已核对用例会继续生成计划。' : '可根据现有页面信息重新规划。'}核对操作、断言与清理后再执行。</p><div class="actions"><button id="discover" ${busy || !supportsDiscovery() ? 'disabled' : ''}>辅助：探索页面</button><button id="plan" ${busy ? 'disabled' : ''} title="根据已采集页面重新生成所选用例的候选计划，不重新探索">重新规划所选用例</button><button id="approve" ${busy ? 'disabled' : ''}>辅助：核对所选计划</button><button id="run" ${busy ? 'disabled' : ''}>辅助：执行所选</button></div></section></div></details>${discoveryHTML(s)}<section class="panel"><div class="panel-heading"><h2>用例工作区 <small>点击标题查看原文、计划与证据</small></h2><div class="actions"><button id="discovery-contract" ${busy ? 'disabled' : ''} title="可选：导入已审查无业务写入的输入和选项操作说明">导入探索交互说明</button><button id="handoff" ${busy ? 'disabled' : ''}>关联前端导出物</button><a href="/api/tasks/${s.id}/baseline">下载用例基线</a></div></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="select-all" aria-label="选择全部用例" ${s.cases.every((c) => selected.has(c.case_id)) ? 'checked' : ''}></th><th>CASE / 用例</th><th>当前状态</th><th>执行记录</th><th>准备情况</th></tr></thead><tbody>${s.cases.map((c) => `<tr><td><input type="checkbox" data-select="${h(c.case_id)}" aria-label="选择 ${h(c.case_id)}" ${selected.has(c.case_id) ? 'checked' : ''}></td><td><button class="link" data-case="${h(c.case_id)}">${h(c.original.title ?? c.case_id)}</button><small class="mono">${h(c.case_id)}</small></td><td>${badge(c.status)}${c.cleanup_required ? '<small>仍有清理待处理</small>' : ''}</td><td>${c.attempts.length} 次<small>定位修复 ${c.repair_count} 次</small>${c.self_repair ? '<small>计划修复 ' + h(c.self_repair.repair_count ?? 0) + ' / ' + h(c.self_repair.max_repairs ?? 2) + ' 次</small>' : ''}</td><td>${c.reviewed ? '原文已确认' : c.issues.length ? '有 ' + c.issues.length + ' 项需核对' : '原文待核对'}<small>${h(c.mapping_reason ?? (c.plan_approved ? '计划已核对' : c.plan ? '计划待核对' : '计划未生成'))}</small></td></tr>`).join('')}</tbody></table></div></section>`;
  // Build the final order while detached; never temporarily shrink the live
  // document or move its retained workflow/output panels on every poll.
  const guided = template.content.querySelector('#guided-workflow');
  template.content.querySelector('.heading').after(guided);
  const placeholder = document.createElement('section');
  placeholder.id = 'agent-output';
  guided.after(placeholder);
  patchConsole(
    $('#workspace'),
    template.content,
    (node) => node.id === 'guided-workflow' || node.id === 'agent-output',
  );
  mountAgentOutput();
  const outputFeed = outputPanel.querySelector('#output-records');
  // Reattaching the retained panel can reset its scroll offset even when the
  // rows have not changed. Restore both live-follow and manual reading modes.
  outputFeed.scrollTop = outputFollow ? outputFeed.scrollHeight : outputScroll;
  if (outputFocused?.isConnected) outputFocused.focus({ preventScroll: true });
  for (const button of document.querySelectorAll('[data-cleanup-task]'))
    button.onclick = () =>
      action(async () => {
        current = button.dataset.cleanupTask;
        selected.clear();
        lastRevision = -1;
      });
  $('#select-all').onchange = (e) => {
    selected = e.target.checked ? new Set(s.cases.map((c) => c.case_id)) : new Set();
    render();
  };
  for (const el of document.querySelectorAll('[data-select]'))
    el.onchange = () => {
      el.checked ? selected.add(el.dataset.select) : selected.delete(el.dataset.select);
      $('#select-all').checked = s.cases.every((c) => selected.has(c.case_id));
      $('#select-all').indeterminate = selected.size > 0 && !$('#select-all').checked;
      updateWorkflow();
    };
  for (const el of document.querySelectorAll('[data-case]'))
    el.onclick = () => caseDetail(el.dataset.case);
  for (const kind of ['review', 'plan', 'run'])
    $('#' + kind).onclick = () =>
      action(async () => {
        await taskAPI('job', { kind, case_ids: ids() });
        toast(kind === 'run' ? '已开始执行，请查看上方 Agent 运行输出。' : '已开始处理所选用例。');
      });
  $('#discover').onclick = () =>
    action(async () => {
      if (!supportsDiscovery()) throw new Error(errors.DISCOVERY_UNAVAILABLE);
      const caseIds = selected.size ? ids() : pendingDiscoveryIds(s);
      if (!caseIds.length) throw new Error(errors.NO_UNEXECUTED_CASES);
      await taskAPI('job', { kind: 'discover', case_ids: caseIds });
      toast(
        `已启动 ${caseIds.length} 条用例的自动探索；已确认用例将生成候选计划，可在下方查看活动。`,
      );
    });
  $('#browser').onclick = () =>
    action(async () => {
      toast('正在打开 Chromium…');
      await taskAPI('browser', {});
      toast('请在可见 Chromium 中登录或进入测试页面。');
    });
  $('#capture').onclick = () =>
    action(async () => {
      const page = await taskAPI('capture', {});
      toast(`已辅助采集当前页面的 ${page.controls.length} 个唯一控件。`);
    });
  $('#diagnostics').onclick = () => action(diagnosticsDialog);
  $('#auth').onclick = authDialog;
  $('#confirm').onclick = () => confirmSelected();
  $('#approve').onclick = approveSelected;
  $('#environment').onclick = environment;
  $('#discovery-contract').onclick = () => $('#discovery-contract-file').click();
  $('#handoff').onclick = () => $('#handoff-file').click();
  if ($('#stop')) $('#stop').onclick = () => action(() => taskAPI('stop', {}));
  updateWorkflow();
}
function newTask() {
  modal(
    `<h2>导入测试用例</h2><p>支持 Excel、CSV、JSON。按本轮提供的内容建立独立基线，不从源码推断业务预期。</p><label class="field">轮次名称<input id="task-name" placeholder="例如：CRM 客户管理 · 第一轮"></label><label class="field">测试环境地址<input id="target" type="url" placeholder="http://localhost:3000/"></label><label class="field">用例文件<input id="case-file" type="file" accept=".xlsx,.xlsm,.csv,.json"></label><label class="field">Excel 工作表名（可选）<input id="sheet" placeholder="留空时读取默认用例表；普通多工作表请分轮导入"></label><label class="check"><input id="nonproduction" type="checkbox"> 这是我获准测试的非生产环境</label><label class="check"><input id="writes" type="checkbox"> 允许按核对后的计划创建、修改测试数据并精确清理</label><div class="dialog-footer"><button class="primary" id="import-submit">导入并检查</button></div>`,
  );
  $('#case-file')
    .closest('label')
    .insertAdjacentHTML(
      'afterend',
      '<p>可选列：Excel/CSV「页面入口URL」或 JSON 的 page_entry_url。支持同站点绝对地址、相对路径和 SPA 路由；可在用例详情补填，留空自主探索。</p>',
    );
  $('#import-submit').onclick = () =>
    action(async () => {
      const file = $('#case-file').files[0];
      if (!file) throw new Error('请选择用例文件。');
      if (file.size > 12 * 1024 * 1024) throw new Error('首版支持12MB以内文件。');
      const input = {
        name: $('#task-name').value,
        target: $('#target').value,
        filename: file.name,
        data_base64: await fileData(file),
        sheet: $('#sheet').value || undefined,
        nonproduction: $('#nonproduction').checked,
        writes: $('#writes').checked,
      };
      $('#import-submit').disabled = true;
      try {
        const r = await api('/api/tasks', input);
        current = r.id;
        selected.clear();
        lastRevision = -1;
        close();
        toast('用例已导入，原文已单独保存。');
      } finally {
        if ($('#import-submit')) $('#import-submit').disabled = false;
      }
    });
}
function settings() {
  modal(
    `<h2>连接 DeepSeek</h2><p>使用官方接口。密钥仅保留在本地服务内存中，也可通过 DEEPSEEK_API_KEY 环境变量配置。服务重启后需重新提供；密钥不会写入任务与报告。</p><label class="field">模型<select id="model"><option value="deepseek-flash">DeepSeek Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select></label><label class="field">API Key<input id="key" type="password" autocomplete="off" placeholder="${config.configured ? '已配置；留空保持当前密钥' : '在本机输入，不要发到聊天'}"></label><p id="connection-result"></p><div class="dialog-footer"><button id="test-connection">测试连接</button><button class="primary" id="save-config">保存设置</button></div>`,
  );
  $('#model').value = config.model ?? 'deepseek-flash';
  const save = async () => {
    const key = $('#key').value;
    await api('/api/config', { model: $('#model').value, ...(key ? { key } : {}) });
    $('#key').value = '';
  };
  $('#save-config').onclick = () =>
    action(async () => {
      await save();
      close();
      toast('连接设置已保存到本地进程。');
    });
  $('#test-connection').onclick = () =>
    action(async () => {
      $('#test-connection').disabled = true;
      try {
        await save();
        $('#connection-result').textContent = '正在请求官方接口…';
        const r = await api('/api/connection-test', {});
        $('#connection-result').textContent =
          `实际连接成功 · 返回模型 ${r.response_model} · ${r.prompt_tokens + r.completion_tokens} tokens`;
      } finally {
        if ($('#test-connection')) $('#test-connection').disabled = false;
      }
    });
}
async function createDemo() {
  await action(async () => {
    const r = await api('/api/demo', {});
    current = r.id;
    selected.clear();
    lastRevision = -1;
    toast('已创建本机演示，可创建并清理合成任务。先打开浏览器，点击“进入演示”。');
  });
}
function environment() {
  const s = state;
  modal(
    `<h2>环境与会话</h2><p>${h(s.target)}</p><label class="check"><input type="checkbox" id="env-np" ${s.authorization.nonproduction ? 'checked' : ''}> 已授权的非生产环境</label><label class="check"><input type="checkbox" id="env-writes" ${s.authorization.writes ? 'checked' : ''}> 允许按核对的计划写入测试数据并精确清理</label><label class="field">使用 POST 的只读查询接口（每行一个完整路径）<textarea id="readonly-paths" placeholder="例如 /api/items/search">${h(s.authorization.readOnlyEndpoints.map((e) => e.path).join('\n'))}</textarea></label><p>仅填写已确认无写入副作用的查询接口。未授权的非 GET 请求会被拦截；首版不支持 WebSocket。登录会话保留在服务内存，同一轮无需逐用例登录。</p><div class="dialog-footer"><button id="close-browser">关闭 Chromium</button><button class="primary" id="save-environment">保存</button></div>`,
  );
  $('#save-environment').onclick = () =>
    action(async () => {
      await taskAPI('authorization', {
        nonproduction: $('#env-np').checked,
        writes: $('#env-writes').checked,
        readOnlyEndpoints: $('#readonly-paths')
          .value.split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((path) => ({ method: 'POST', path })),
      });
      close();
    });
  $('#close-browser').onclick = () =>
    action(async () => {
      await taskAPI('close-browser', {});
      close();
    });
}
async function authDialog() {
  await action(async () => {
    const page = await taskAPI('capture', {});
    modal(
      `<h2>确认登录状态</h2><p>选择登录后可见、打开项目首页时仍然存在的唯一页面标志，例如用户昵称或主页标题。无需登录的网站可选择稳定主页标志。</p><label class="field">页面标志<select id="marker">${page.controls.map((c, i) => `<option value="${i}">${h(c.name)} · ${h(c.role)}</option>`).join('')}</select></label><p>本轮 Cookie、localStorage 与 sessionStorage 将在内存中复用。页面判定登录失效时暂停执行；回到同一个浏览器恢复后可继续尚未操作的用例。</p><div class="notice ${supportsDiscovery() ? '' : 'warn'}">${supportsDiscovery() ? '确认登录后将自动探索相关页面，为已确认用例生成候选计划。探索与计划生成不会自动执行业务用例；计划仍需核对。' : '当前服务尚未启用自动探索。确认登录仅保存本轮会话。'}</div><div class="dialog-footer"><button class="primary" id="save-marker">确认登录状态</button></div>`,
    );
    $('#save-marker').onclick = () =>
      action(async () => {
        const c = page.controls[Number($('#marker').value)];
        if (!c) throw new Error('未发现可选择的控件，请先打开登录后的主页。');
        const result = await taskAPI('authenticate', {
          marker: c.locator,
          ...(selected.size ? { case_ids: ids() } : {}),
        });
        close();
        if (!supportsDiscovery())
          return toast('登录状态已保存，本轮用例复用此会话。当前服务尚未启用自动探索。');
        if (result.authenticated !== true) throw new Error('服务未确认登录状态，请刷新后核对。');
        if (result.discovery_started === true)
          toast(
            '登录状态已保存，自动探索已启动；已确认用例将生成候选计划，请查看 Agent 运行输出。',
          );
        else
          toast(
            '登录状态已保存，自动探索尚未启动。' +
              reasonText(result.discovery_reason ?? '请查看当前任务状态，再点击自动探索。'),
          );
      });
  });
}
function confirmSelected({ continuePreparation = false } = {}) {
  const taskId = current,
    caseIds = ids();
  const rows = state.cases.filter(
    (c) =>
      caseIds.includes(c.case_id) && !c.attempts.length && (!continuePreparation || !c.reviewed),
  );
  if (!rows.length) return toast('请选择尚未执行的用例。', true);
  if (rows.some((c) => c.issues.length || c.effective.steps.some((s) => !s.expected)))
    return toast(
      '所选用例有待核对问题，请点击对应标题补充确认；其他无问题的用例可单独选择。',
      true,
    );
  modal(
    `<h2>核对所选原文 · ${rows.length} 条</h2><p>请核对每项预期是否完整、明确。分项内容只是按标点生成的草稿，可以修改；不得漏掉原预期中的条件。旧计划在步骤结束后同时验证；分段计划可在同一原步骤内依次操作和检查。分段观察发生于不同时间，不证明同时一致或持续不变。持续性和跨动作计时仍需另行设计。</p>${rows.map((c, ci) => `<div class="plan-card"><h3>${h(c.case_id)} · ${h(c.original.title)}</h3>${c.effective.steps.map((s, si) => `<p>${h(s.action)}</p><p><strong>预期：</strong>${h(s.expected)}</p>${obligationEditor(s.obligations ? s : c.obligation_draft[si], ci + '-' + si)}`).join('')}</div>`).join('')}<div class="dialog-footer"><button class="primary" id="confirm-all">以上用例原文已核对</button></div>`,
  );
  $('#confirm-all').onclick = () =>
    action(async () => {
      const button = $('#confirm-all');
      if (button.disabled) return;
      const confirmations = rows.map((c, ci) => ({
        case_id: c.case_id,
        steps: c.effective.steps.map(({ step_id, action, expected }, si) => ({
          step_id,
          action,
          expected,
          obligations: readObligations(ci + '-' + si, si),
        })),
        note: '本地用户核对原文及可同时观测的预期分项',
      }));
      button.disabled = true;
      button.textContent = '正在保存核对结果…';
      try {
        for (const input of confirmations)
          await api('/api/tasks/' + encodeURIComponent(taskId) + '/confirm', input);
        if (current !== taskId || !$('#modal').open || $('#confirm-all') !== button) return;
        close();
        if (continuePreparation && config.configured && config.autonomous_preparation)
          await startPreparedSelection(taskId, caseIds);
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = '重新保存并继续';
        }
      }
    });
  if (continuePreparation) {
    $('#confirm-all').textContent =
      config.configured && config.autonomous_preparation
        ? '确认用例并开始准备'
        : '确认用例，进入下一步';
    $('#confirm-all').before(
      Object.assign(document.createElement('p'), {
        className: 'muted',
        textContent: '确认后自动衔接准备。仍有效的页面观察可以复用；修改用例后按新内容重新准备。',
      }),
    );
  }
}
function planHTML(plan) {
  if (!plan) return '<p>尚未生成计划。</p>';
  const unobserved = plan.steps
    .flatMap((s) => s.checkpoints ?? [s])
    .flatMap((s) => [...s.actions, ...s.assertions])
    .filter((item) => item.target?.kind === 'case_named');
  const assertion = (item) =>
    `${loc(item.target)} · ${item.check} ${item.expected === undefined ? '' : JSON.stringify(item.expected)}${item.oracle_quote ? '（原预期：“' + item.oracle_quote + '”）' : ''}${item.obligation_ids ? ' · 对应 ' + item.obligation_ids.join('、') : ''}`;
  const assertions = (items) =>
    `<ul>${items.map((item) => `<li>${h(assertion(item))}</li>`).join('')}</ul>`;
  const actions = (items) =>
    `<ol>${items.map((item) => `<li>${h(opName[item.op])} ${h(loc(item.target))} ${item.value === undefined ? '' : h(JSON.stringify(item.value))} ${h(item.state ?? '')}${item.repair_anchor ? ' · 修复时必须仍对应 ' + h(loc(item.repair_anchor)) : ''}</li>`).join('')}</ol>`;
  const steps = plan.steps
    .map((step) => {
      const header = `<h4>${h(step.step_id)} · ${h(step.source_action)}</h4><p><strong>原预期：</strong>${h(step.source_expected)}</p>`;
      if (!step.checkpoints)
        return `${header}${actions(step.actions)}<p><strong>同时验证：</strong>全部条件需在 ${h(step.within_ms)} 毫秒预算内的同一次页面采样中满足。</p>${assertions(step.assertions)}`;
      return `${header}<p class="notice">本原步骤分 ${step.checkpoints.length} 个检查点依次观察，总预算 ${h(step.timeout_ms)} 毫秒。各点分别记录时间，不表示同一时刻或全过程成立。</p>${step.checkpoints.map((point, index) => `<section class="plan-card"><h4>检查点 ${index + 1} · ${h(point.checkpoint_id)}</h4>${actions(point.actions)}<p>本点在操作后 ${h(point.within_ms)} 毫秒内同时检查，并受剩余总预算限制：</p>${assertions(point.assertions)}</section>`).join('')}`;
    })
    .join('');
  const cleanup = plan.cleanup
    ? `<h4>执行后清理 · ${h(plan.cleanup.identity)}</h4>${plan.cleanup.observation_path ? `<p>先以只读方式返回已批准页面：${h(plan.cleanup.observation_path)}，再核实是否已清理及资源归属。</p>` : ''}<p>删除或恢复前先确认目标身份：</p>${assertions(plan.cleanup.ownership ?? [])}${actions(plan.cleanup.actions)}${assertions(plan.cleanup.assertions)}`
    : '<p>该计划无需数据清理。</p>';
  return `${unobserved.length ? `<div class="notice warn" data-unobserved-plan><strong>含 ${unobserved.length} 项尚未观察的定位</strong><p>以下标记项来自用例操作原文，不代表页面已经验证。此次核对固定完整操作、输入值、顺序、预期和定位；执行到对应步骤时核验页面、表单、类型和唯一性。不匹配将停止，不自动换目标或生成后续计划。</p></div>` : ''}<div class="notice ${plan.data_effect === 'mutation' ? 'warn' : ''}">打开 ${h(plan.entry_path)} · ${plan.data_effect === 'mutation' ? '会写入数据，必须验证清理' : '声明为只读操作'}</div><h4>前置条件</h4>${plan.preconditions.length ? assertions(plan.preconditions) : '<p>计划未声明自动验证项；请核对原用例前置条件。</p>'}${steps}${cleanup}<p>${h(plan.notes ?? '')}</p><details><summary>查看结构化计划</summary><pre>${h(JSON.stringify(plan, null, 2))}</pre></details>`;
}
function approveSelected() {
  const rows = state.cases.filter((c) => selected.has(c.case_id) && !c.attempts.length);
  if (!rows.length || rows.some((c) => !c.plan || !c.reviewed))
    return toast('请选择已生成计划且尚未执行的用例。', true);
  modal(
    `<h2>核对执行计划 · ${rows.length} 条</h2><p>核对每项原预期是否都有断言覆盖，输入是否准确，清理是否只作用于本轮测试数据。执行器只运行这里确认的计划；不能代替业务语义评审。</p>${rows.map((c) => `<div class="plan-card"><h3>${h(c.case_id)} · ${h(c.original.title)}</h3>${preparationHistoryHTML(c)}${planHTML(c.plan)}</div>`).join('')}<div class="dialog-footer"><button class="primary" id="approve-all">以上操作、断言和清理已核对</button></div>`,
  );
  $('#approve-all').onclick = () =>
    action(async () => {
      for (const c of rows)
        await taskAPI('approve', { case_id: c.case_id, plan_hash: c.plan_hash });
      close();
      toast('所选计划已核对，可以执行。');
    });
}
function caseDetail(id) {
  const c = state.cases.find((c) => c.case_id === id);
  const taskId = current;
  let appliedAdvice = null;
  modal(
    `<h2>${h(c.case_id)} · ${h(c.original.title)}</h2><p>${badge(c.status)}</p><p>原前置条件：${h(c.original.preconditions ?? '未填写')}</p>${c.issues.length ? '<div class="notice warn">' + c.issues.map((i) => h((i.step_id ?? '') + ' ' + i.message)).join('<br>') + '</div>' : ''}${c.effective.steps.map((s, i) => `<div class="step-editor"><h3>${h(s.step_id)}</h3><blockquote>原操作：${h(c.original.steps[i].action)}<br>原预期：${h(c.original.steps[i].expected ?? '缺失')}</blockquote><label class="field">确认操作<textarea data-action="${i}" ${c.attempts.length ? 'disabled' : ''}>${h(s.action)}</textarea></label><label class="field">确认预期<textarea data-expected="${i}" ${c.attempts.length ? 'disabled' : ''}>${h(s.expected ?? '')}</textarea></label>${!c.attempts.length ? obligationEditor(s.obligations ? s : c.obligation_draft[i], 'one-' + i) : '<p>已确认分项：' + h((s.obligations ?? []).map((o) => o.text).join('；')) + '</p>'}</div>`).join('')}${dataCorrectionHTML(c)}${!c.attempts.length ? '<label class="field">问题处理说明<textarea id="resolution" placeholder="若有缺失、矛盾或修改，记录确认依据。"></textarea></label><button id="confirm-one" class="primary">保存补充并确认用例</button>' : ''}${preparationHistoryHTML(c)}<div class="plan-card"><h3>执行计划</h3>${planHTML(c.plan)}</div>${config.plan_revision && c.reviewed && !c.attempts.length && !c.plan_feedback?.length ? '<label class="field">计划修订意见<textarea id="plan-feedback" maxlength="4000" placeholder="指出遗漏的原预期、错误定位或错误阻塞理由；不改变用例。"></textarea></label><button id="revise-plan">反馈并重新生成一次</button>' : ''}${c.plan_feedback?.length ? '<p>已提交一次修订意见：' + h(c.plan_feedback[0].text) + '</p>' : ''}${config.plan_revalidation && c.reviewed && !c.attempts.length && !c.revalidated_plan && c.status === 'BLOCKED_MAPPING' ? '<button id="revalidate-plan">重新校验已有模型回复</button>' : ''}<button id="view-facts">查看全部执行证据</button>${c.cleanup_required ? '<div class="notice warn">存在未完成清理。请人工检查并恢复本轮数据后填写情况。</div><textarea id="recovery-note" placeholder="精确记录检查对象、恢复动作与验证结果"></textarea><button id="recovered">记录已完成的人工恢复</button>' : ''}<p class="mono">原用例基线 ${h(state.baseline_sha256)}</p>`,
  );
  const entryField = document.createElement('div');
  entryField.innerHTML = `<label class="field">页面入口URL（选填）<input id="case-entry-url" maxlength="2048" placeholder="例如 /catalog 或 /#/catalog；留空则自主探索" value="${h(c.effective.page_entry_url ?? '')}" ${c.attempts.length || state.active ? 'disabled' : ''}></label><p>同站点页面地址，仅用于优先采集页面事实。普通失效时尝试恢复首页探索；安全阻断不会被自动解除。原用例的菜单导航和预期仍须执行。修改后旧计划需重新生成、核对。</p>${c.entry_hint ? `<p>上次入口核验：${h(c.entry_hint.status === 'OBSERVED' ? '已观察页面（非业务验证）' : '入口未核验，请查看原因')} · ${h(errors[c.entry_hint.code] ?? c.entry_hint.code)}</p>` : ''}`;
  $('#modal-body > h2 + p').after(entryField);
  if (c.case_advice) {
    const a = c.case_advice,
      panel = document.createElement('section');
    panel.className = 'case-advice';
    panel.innerHTML = `<h3>Agent 处理建议 · ${a.status === 'PENDING' ? '待人工决定' : h(a.status)}</h3><p>${h(a.message)}</p>
      ${(a.suggestions ?? []).map((v) => `<article><h4>${h(v.step_id)} · ${v.field === 'action' ? '操作' : '预期'}</h4><p>当前：${h(v.before)}</p><p class="advice-proposal">草案：${h(v.after)}</p><p>依据：${h(v.reason)}<br>引用：${h(v.source_quotes.join('；'))}<br>覆盖影响：${h(v.coverage_impact)}</p>${v.requires_input ? '<p class="warn">仍有业务信息待填写，不能直接采纳占位内容。</p>' : ''}</article>`).join('')}
      ${a.status === 'PENDING' && a.suggestions?.length && !c.attempts.length && !state.active ? '<button id="load-case-advice">带入下方编辑器（尚不保存）</button><button id="reject-case-advice">不采纳，保留原用例</button><p><label><input id="advice-confirmed" type="checkbox">我已核对修改内容、未决输入和覆盖影响，同意保存为新版本</label></p>' : ''}
      <p class="muted">草案不是已确认用例。原文和旧版本保留，保存修订后需要重新生成、核对计划；不自动执行。</p>`;
    entryField.after(panel);
    if ($('#load-case-advice'))
      $('#load-case-advice').onclick = () => {
        appliedAdvice = a;
        for (const v of a.suggestions) {
          const index = c.effective.steps.findIndex((s) => s.step_id === v.step_id);
          $(`[data-${v.field}="${index}"]`).value = v.after;
          if (v.field === 'expected') $(`[data-obligations="one-${index}"]`).value = v.after;
        }
        $('#confirm-one').textContent = '确认修订并保存新版本';
        $('#confirm-one').scrollIntoView({ block: 'center' });
      };
    if ($('#reject-case-advice'))
      $('#reject-case-advice').onclick = () =>
        action(async () => {
          await api('/api/tasks/' + encodeURIComponent(taskId) + '/reject-case-advice', {
            case_id: id,
            advice_id: a.id,
          });
          close();
          toast('未采纳建议，原用例保持不变。');
        });
  }
  if ($('#confirm-one'))
    $('#confirm-one').onclick = () =>
      action(async () => {
        if (appliedAdvice && !$('#advice-confirmed').checked)
          throw new Error('请先核对并勾选修订确认。');
        await api('/api/tasks/' + encodeURIComponent(taskId) + '/confirm', {
          case_id: id,
          ...(appliedAdvice
            ? { advice_id: appliedAdvice.id, expected_case_hash: appliedAdvice.case_hash }
            : {}),
          steps: c.effective.steps.map((s, i) => ({
            step_id: s.step_id,
            action: $(`[data-action="${i}"]`).value,
            expected: $(`[data-expected="${i}"]`).value,
            obligations: readObligations('one-' + i, i),
          })),
          note: $('#resolution').value,
          page_entry_url: $('#case-entry-url').value,
          ...readDataCorrections(c),
        });
        close();
      });
  if ($('#revise-plan'))
    $('#revise-plan').onclick = () =>
      action(async () => {
        await taskAPI('revise-plan', { case_id: id, feedback: $('#plan-feedback').value });
        await taskAPI('job', { kind: 'plan', case_ids: [id] });
        close();
        toast('已提交修订意见，保留原用例和旧计划。');
      });
  if ($('#revalidate-plan'))
    $('#revalidate-plan').onclick = () =>
      action(async () => {
        await taskAPI('revalidate-plan', { case_id: id });
        close();
        toast('已有回复已重新校验，尚未批准执行；未新增模型调用。');
      });
  $('#view-facts').onclick = () =>
    action(async () => {
      const facts = (await taskAPI('facts')).filter((f) => f.case_id === id);
      modal(
        `<h2>${h(id)} · 执行证据</h2>${facts.map((f) => `<div class="plan-card evidence">${badge(f.status)}<p>${h(f.started_at)} · 清理 ${h(f.cleanup_status)}</p>${f.media.map((m) => (m.type === 'video' ? `<video controls src="/api/tasks/${current}/media/${f.id}/${encodeURIComponent(m.file)}"></video>` : `<img alt="${h(m.step_id ?? '执行现场')}" src="/api/tasks/${current}/media/${f.id}/${encodeURIComponent(m.file)}">`)).join('')}<details><summary>动作、断言和事实摘要</summary><pre>${h(JSON.stringify(f, null, 2))}</pre></details></div>`).join('') || '<p>尚未产生执行证据。</p>'}`,
      );
    });
  if ($('#recovered'))
    $('#recovered').onclick = () =>
      action(async () => {
        await taskAPI('recovered', { case_id: id, note: $('#recovery-note').value });
        close();
      });
}
$('#handoff-file').onchange = () =>
  action(async () => {
    const file = $('#handoff-file').files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) throw new Error('文件过大。');
    await taskAPI('handoff', JSON.parse(await file.text()));
    $('#handoff-file').value = '';
    toast('导出物已按当前用例基线关联；源码事实不会定义业务预期。');
  });
$('#new-task').onclick = newTask;
$('#settings').onclick = settings;
$('#demo').onclick = createDemo;
$('#discovery-contract-file').onchange = () =>
  action(async () => {
    const file = $('#discovery-contract-file').files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) throw new Error('文件过大。');
    const result = await taskAPI('discovery-contract', JSON.parse(await file.text()));
    $('#discovery-contract-file').value = '';
    toast('已导入 ' + result.count + ' 项探索交互说明；仅影响页面观察，不授权保存或提交。');
  });
await action(() => refresh(true));
setInterval(() => refresh().catch((e) => toast(e.message, true)), 1500);
setInterval(updateAgentOutput, 1000);
