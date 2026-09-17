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
  polling = false,
  toastTimer;
const errors = {
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
  DISCOVERY_BLOCKED: '当前探索受阻，请查看实时活动中的具体原因。',
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
  });
  const value = await r.json();
  if (!r.ok) throw new Error(errors[value.error] ?? `操作未完成：${value.error}`);
  return value;
}
async function action(fn) {
  try {
    await fn();
    await refresh(true);
  } catch (e) {
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
  return `<span class="badge ${status === 'PASS_ASSERTIONS' ? 'good' : ['FAIL_ASSERTION', 'TECHNICAL_FAILED', 'CLEANUP_REQUIRED'].includes(status) ? 'bad' : ['RUNNING', 'READY', 'PLAN_REVIEW'].includes(status) ? 'work' : ''}">${h(config.labels?.[status] ?? status)}</span>`;
}
function ids() {
  return [...selected];
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
          selected.clear();
          lastRevision = -1;
        });
    if (!current) {
      renderEmpty();
      return;
    }
    const next = await api('/api/tasks/' + current);
    const changed =
      force ||
      next.revision !== lastRevision ||
      next.authenticated !== state?.authenticated ||
      !!next.active !== !!state?.active ||
      previousDiscoverySupport !== supportsDiscovery() ||
      JSON.stringify(next.discovery) !== JSON.stringify(state?.discovery) ||
      JSON.stringify(next.site_cleanup_blockers) !== JSON.stringify(state?.site_cleanup_blockers);
    state = next;
    if (changed) {
      lastRevision = state.revision;
      render();
    }
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
  ['row', 'cell'].includes(l?.kind)
    ? `${loc(l.table)} · ${l.key?.column}=${l.key?.value} · ${l.kind === 'cell' ? l.column : l.target ? loc(l.target) : '整行'}`
    : (l?.name ?? l?.value ?? '');
Object.assign(eventNames, {
  OPTIONAL_DIALOG_OBSERVED: '条件提示已检查',
  ACTION_SKIPPED: '提示未出现，未派发点击',
  DISCOVERY_STARTED: '自动探索已启动',
  DISCOVERY_OBSERVED: '已观察探索页面',
  DISCOVERY_ACTION_BEFORE: '准备探索控件',
  DISCOVERY_ACTION_AFTER: '探索控件操作结束',
  DISCOVERY_NAVIGATE_BEFORE: '准备探索页面',
  DISCOVERY_REDIRECT_ALLOWED: '页面跳转已核验，继续探索',
  DISCOVERY_NAVIGATE_AFTER: '已进入探索页面',
  DISCOVERY_PAGE_CAPTURED: '已采集探索页面',
  DISCOVERY_CASE_FINISHED: '本条用例探索结束',
  DISCOVERY_BLOCKED: '自动探索受阻',
  DISCOVERY_FINISHED: '自动探索结束',
  DISCOVERY_FAILED: '自动探索未完成',
});
Object.assign(eventNames, {
  DISCOVERY_OPENING: '正在复用登录打开探索页面',
  DISCOVERY_OPENED: '探索页面已打开',
  DISCOVERY_REFRESHED: '页面已变化，正在重新观察',
});
Object.assign(errors, {
  DISCOVERY_TIMEOUT: '本轮探索已达到时间上限，已保留采集到的页面。',
  DISCOVERY_STEP_LIMIT: '本轮探索已达到动作上限，已保留当前进度。',
  DISCOVERY_MODEL_BUDGET_EXHAUSTED: '本轮探索已达到模型调用上限，未继续请求。',
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
  return `<div class="discovery-status ${['PARTIAL', 'BLOCKED', 'FAILED', 'INTERRUPTED'].includes(d.status) ? 'warn' : ''}" role="status"><strong>${h(discoveryStatusNames[d.status] ?? d.status ?? '探索状态待确认')}</strong><span>${d.current_case ? '当前用例 ' + h(d.current_case) + ' · ' : ''}已采集 ${count(d.pages)} 个页面 · 已探索 ${count(d.steps)} 步${reason ? ' · ' + h(reason) : ''}</span>${queryHelp}</div>`;
}
function siteCleanupNotice(task) {
  const blockers = task.site_cleanup_blockers ?? [];
  if (!blockers.length) return '';
  return `<div class="notice warn" role="status"><strong>此站点有数据恢复事项，自动探索与执行已暂停</strong><p>先到原任务核实测试数据并记录恢复证据；新建任务不能绕过。原任务仍可打开浏览器用于人工处理。</p><ul>${blockers.map((item) => `<li>${h(item.task_name)} · ${h(item.case_id ?? '记录无法核实')} ${item.reason === 'STATE_UNVERIFIED' ? '请维护者检查保留的记录，勿删除历史' : `<button class="link" data-cleanup-task="${h(item.task_id)}">打开原任务</button>`}</li>`).join('')}</ul></div>`;
}
function render() {
  const auxiliaryOpen = $('#preparation-tools')?.open ?? false;
  const s = state,
    busy = !!s.active,
    count = (status) => s.cases.filter((c) => c.status === status).length,
    blocked = s.cases.filter((c) =>
      [
        'NEEDS_REVIEW',
        'NEEDS_MAPPING',
        'BLOCKED_MAPPING',
        'AUTH_REQUIRED',
        'BLOCKED_DATA',
        'CLEANUP_REQUIRED',
      ].includes(c.status),
    ).length;
  const recent = s.events.at(-1);
  $('#workspace').innerHTML =
    `${siteCleanupNotice(s)}<div class="heading"><div><h1>${h(s.name)}</h1><p>${h(s.target)} · ${s.fixture ? '本机合成演示' : '独立测试轮次'}</p></div><div class="actions"><button id="environment">环境设置</button><button id="diagnostics">诊断日志</button><a class="download" href="/api/tasks/${s.id}/report">下载离线报告 ↗</a></div></div>${s.fixture ? '<div class="notice">演示使用本地商品查询与任务管理、预制执行计划；运行时使用真实 Chromium。该结果不代表真实 DeepSeek 规划或产品验收。</div>' : ''}<div class="metrics"><div class="metric"><b>${s.cases.length}</b><span>原始用例总数</span></div><div class="metric"><b>${count('READY')}</b><span>可执行</span></div><div class="metric"><b>${count('PASS_ASSERTIONS')}</b><span>已核对断言满足</span></div><div class="metric"><b>${count('FAIL_ASSERTION') + count('TECHNICAL_FAILED')}</b><span>需查看执行差异</span></div><div class="metric"><b>${blocked}</b><span>待准备或处理</span></div></div><section class="panel"><h2>自动准备</h2><p>选择用例后点击一次。在打开的浏览器中登录，Agent 会自动寻找相关模块、补充证据并尝试修复技术适配；无需先手工进入业务页面。业务预期和执行计划仍需核对。</p><button id="confirm-main" ${busy ? 'disabled' : ''}>核对所选用例</button><button class="primary" id="prepare" ${busy || !config.autonomous_preparation ? 'disabled' : ''}>开始准备所选用例</button><button id="approve-main" ${busy ? 'disabled' : ''}>核对所选计划</button><button id="run-main" ${busy ? 'disabled' : ''}>执行所选</button>${s.active?.stage === 'WAITING_USER_LOGIN' ? '<p role="status">等待浏览器登录；完成后会自动继续，无需点击确认。无法可靠识别时，可停止后使用下方辅助入口。</p>' : ''}</section><details class="panel" id="preparation-tools" ${auxiliaryOpen ? 'open' : ''}><summary>辅助操作与单步准备（正常流程无需逐项点击）</summary><div class="workflow"><section class="panel"><h3><i>01</i>核对用例</h3><p>原文单独保留。缺失或矛盾的预期按用例澄清，其他用例可以继续。</p><div class="actions"><button id="review" ${busy ? 'disabled' : ''}>审查所选用例</button><button id="confirm" ${busy ? 'disabled' : ''}>确认所选原文</button></div></section><section class="panel"><h3><i>02</i>登录并探索 <span class="badge ${s.authenticated ? 'good' : ''}">${s.authenticated ? '登录可复用' : s.browser_open ? '浏览器已打开' : '未连接'}</span></h3><p>${supportsDiscovery() ? '正常使用上方“开始准备”；这里用于无法自动识别登录时的辅助处理。' : '在 Chromium 登录一次并确认可见标志。当前服务尚未启用自动探索。'}</p><div class="actions"><button id="browser" ${busy ? 'disabled' : ''}>打开浏览器</button><button id="capture" ${busy ? 'disabled' : ''} title="需要补充页面信息时，读取当前浏览器页面">辅助：读取当前页面</button><button id="auth" ${busy ? 'disabled' : ''}>确认登录状态</button></div></section><section class="panel"><h3><i>03</i>核对计划并执行</h3><p>已采集 ${s.snapshots?.length ?? 0} 个页面。${supportsDiscovery() ? '自动探索为已确认用例生成候选计划；未选用例时探索全部未执行用例。' : '可根据现有页面信息重新规划。'}核对操作、断言与清理后再执行。</p><div class="actions"><button id="discover" ${busy || !supportsDiscovery() ? 'disabled' : ''}>自动探索并生成计划</button><button id="plan" ${busy ? 'disabled' : ''} title="根据已采集页面重新生成所选用例的候选计划，不重新探索">重新规划所选用例</button><button id="approve" ${busy ? 'disabled' : ''}>辅助：核对所选计划</button><button class="primary" id="run" ${busy ? 'disabled' : ''}>辅助：执行所选</button></div></section></div></details>${discoveryHTML(s)}<section class="panel"><div class="panel-heading"><h2>用例工作区 <small>点击标题查看原文、计划与证据</small></h2><div class="actions"><button id="discovery-contract" ${busy ? 'disabled' : ''} title="可选：导入已审查无业务写入的输入和选项操作说明">导入探索交互说明</button><button id="handoff" ${busy ? 'disabled' : ''}>关联前端导出物</button><a href="/api/tasks/${s.id}/baseline">下载用例基线</a></div></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="select-all" aria-label="选择全部用例" ${s.cases.every((c) => selected.has(c.case_id)) ? 'checked' : ''}></th><th>CASE / 用例</th><th>当前状态</th><th>执行记录</th><th>准备情况</th></tr></thead><tbody>${s.cases.map((c) => `<tr><td><input type="checkbox" data-select="${h(c.case_id)}" aria-label="选择 ${h(c.case_id)}" ${selected.has(c.case_id) ? 'checked' : ''}></td><td><button class="link" data-case="${h(c.case_id)}">${h(c.original.title ?? c.case_id)}</button><small class="mono">${h(c.case_id)}</small></td><td>${badge(c.status)}${c.cleanup_required ? '<small>仍有清理待处理</small>' : ''}</td><td>${c.attempts.length} 次<small>定位修复 ${c.repair_count} 次</small>${c.self_repair ? '<small>计划修复 ' + h(c.self_repair.repair_count ?? 0) + ' / ' + h(c.self_repair.max_repairs ?? 2) + ' 次</small>' : ''}</td><td>${c.reviewed ? '原文已确认' : c.issues.length ? '有 ' + c.issues.length + ' 项需核对' : '原文待核对'}<small>${h(c.mapping_reason ?? (c.plan_approved ? '计划已核对' : c.plan ? '计划待核对' : '计划未生成'))}</small></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-heading"><h2>实时活动 <small>展示页面探索、模型处理及实际执行记录</small></h2>${busy ? '<button id="stop" class="danger">停止当前批次</button>' : '<span class="badge">当前空闲</span>'}</div><div class="progress-line"><span>${busy ? '● 正在处理' : '○ 最近活动'} · ${h(recent ? eventText(recent) : '等待操作')}</span><span>${s.active ? (s.active.current_case ?? '准备批次') + ' · 本批模型调用 ' + s.active.calls + ' / 100' : ''}</span></div><ul class="events">${s.events
      .slice(-45)
      .reverse()
      .map(
        (e) =>
          `<li><time>${h(new Date(e.at).toLocaleTimeString('zh-CN', { hour12: false }))}</time><span>${h(eventText(e))}</span></li>`,
      )
      .join('')}</ul></section>`;
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
    el.onchange = () =>
      el.checked ? selected.add(el.dataset.select) : selected.delete(el.dataset.select);
  for (const el of document.querySelectorAll('[data-case]'))
    el.onclick = () => caseDetail(el.dataset.case);
  for (const kind of ['review', 'plan', 'run'])
    $('#' + kind).onclick = () =>
      action(async () => {
        await taskAPI('job', { kind, case_ids: ids() });
        toast(kind === 'run' ? '已开始执行；可在下方查看实时活动。' : '已开始处理所选用例。');
      });
  $('#prepare').onclick = () =>
    action(async () => {
      await taskAPI('job', { kind: 'prepare', case_ids: ids() });
      toast('已开始自动准备；如需登录，请直接在打开的浏览器完成，随后自动继续。');
    });
  $('#discover').onclick = () =>
    action(async () => {
      if (!supportsDiscovery()) throw new Error(errors.DISCOVERY_UNAVAILABLE);
      const caseIds = selected.size
        ? ids()
        : s.cases.filter((c) => !c.attempts.length).map((c) => c.case_id);
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
  $('#confirm').onclick = confirmSelected;
  $('#confirm-main').onclick = confirmSelected;
  $('#approve-main').onclick = approveSelected;
  $('#run-main').onclick = () =>
    action(async () => {
      await taskAPI('job', { kind: 'run', case_ids: ids() });
      toast('已开始执行已核对计划；可查看下方实时活动。');
    });
  $('#approve').onclick = approveSelected;
  $('#environment').onclick = environment;
  $('#discovery-contract').onclick = () => $('#discovery-contract-file').click();
  $('#handoff').onclick = () => $('#handoff-file').click();
  if ($('#stop')) $('#stop').onclick = () => action(() => taskAPI('stop', {}));
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
          toast('登录状态已保存，自动探索已启动；已确认用例将生成候选计划，请查看实时活动。');
        else
          toast(
            '登录状态已保存，自动探索尚未启动。' +
              reasonText(result.discovery_reason ?? '请查看当前任务状态，再点击自动探索。'),
          );
      });
  });
}
function confirmSelected() {
  const rows = state.cases.filter((c) => selected.has(c.case_id) && !c.attempts.length);
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
      for (const [ci, c] of rows.entries())
        await taskAPI('confirm', {
          case_id: c.case_id,
          steps: c.effective.steps.map(({ step_id, action, expected }, si) => ({
            step_id,
            action,
            expected,
            obligations: readObligations(ci + '-' + si, si),
          })),
          note: '本地用户核对原文及可同时观测的预期分项',
        });
      close();
    });
}
function planHTML(plan) {
  if (!plan) return '<p>尚未生成计划。</p>';
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
  return `<div class="notice ${plan.data_effect === 'mutation' ? 'warn' : ''}">打开 ${h(plan.entry_path)} · ${plan.data_effect === 'mutation' ? '会写入数据，必须验证清理' : '声明为只读操作'}</div><h4>前置条件</h4>${plan.preconditions.length ? assertions(plan.preconditions) : '<p>计划未声明自动验证项；请核对原用例前置条件。</p>'}${steps}${cleanup}<p>${h(plan.notes ?? '')}</p><details><summary>查看结构化计划</summary><pre>${h(JSON.stringify(plan, null, 2))}</pre></details>`;
}
function approveSelected() {
  const rows = state.cases.filter((c) => selected.has(c.case_id));
  if (!rows.length || rows.some((c) => !c.plan || c.attempts.length))
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
  modal(
    `<h2>${h(c.case_id)} · ${h(c.original.title)}</h2><p>${badge(c.status)}</p><p>原前置条件：${h(c.original.preconditions ?? '未填写')}</p>${c.issues.length ? '<div class="notice warn">' + c.issues.map((i) => h((i.step_id ?? '') + ' ' + i.message)).join('<br>') + '</div>' : ''}${c.effective.steps.map((s, i) => `<div class="step-editor"><h3>${h(s.step_id)}</h3><blockquote>原操作：${h(c.original.steps[i].action)}<br>原预期：${h(c.original.steps[i].expected ?? '缺失')}</blockquote><label class="field">确认操作<textarea data-action="${i}" ${c.attempts.length ? 'disabled' : ''}>${h(s.action)}</textarea></label><label class="field">确认预期<textarea data-expected="${i}" ${c.attempts.length ? 'disabled' : ''}>${h(s.expected ?? '')}</textarea></label>${!c.attempts.length ? obligationEditor(s.obligations ? s : c.obligation_draft[i], 'one-' + i) : '<p>已确认分项：' + h((s.obligations ?? []).map((o) => o.text).join('；')) + '</p>'}</div>`).join('')}${dataCorrectionHTML(c)}${!c.attempts.length ? '<label class="field">问题处理说明<textarea id="resolution" placeholder="若有缺失、矛盾或修改，记录确认依据。"></textarea></label><button id="confirm-one" class="primary">保存补充并确认用例</button>' : ''}${preparationHistoryHTML(c)}<div class="plan-card"><h3>执行计划</h3>${planHTML(c.plan)}</div>${config.plan_revision && c.reviewed && !c.attempts.length && !c.plan_feedback?.length ? '<label class="field">计划修订意见<textarea id="plan-feedback" maxlength="4000" placeholder="指出遗漏的原预期、错误定位或错误阻塞理由；不改变用例。"></textarea></label><button id="revise-plan">反馈并重新生成一次</button>' : ''}${c.plan_feedback?.length ? '<p>已提交一次修订意见：' + h(c.plan_feedback[0].text) + '</p>' : ''}${config.plan_revalidation && c.reviewed && !c.attempts.length && !c.revalidated_plan && c.status === 'BLOCKED_MAPPING' ? '<button id="revalidate-plan">重新校验已有模型回复</button>' : ''}<button id="view-facts">查看全部执行证据</button>${c.cleanup_required ? '<div class="notice warn">存在未完成清理。请人工检查并恢复本轮数据后填写情况。</div><textarea id="recovery-note" placeholder="精确记录检查对象、恢复动作与验证结果"></textarea><button id="recovered">记录已完成的人工恢复</button>' : ''}<p class="mono">原用例基线 ${h(state.baseline_sha256)}</p>`,
  );
  const entryField = document.createElement('div');
  entryField.innerHTML = `<label class="field">页面入口URL（选填）<input id="case-entry-url" maxlength="2048" placeholder="例如 /catalog 或 /#/catalog；留空则自主探索" value="${h(c.effective.page_entry_url ?? '')}" ${c.attempts.length || state.active ? 'disabled' : ''}></label><p>同站点页面地址，仅用于优先采集页面事实。普通失效时尝试恢复首页探索；安全阻断不会被自动解除。原用例的菜单导航和预期仍须执行。修改后旧计划需重新生成、核对。</p>${c.entry_hint ? `<p>上次入口核验：${h(c.entry_hint.status === 'OBSERVED' ? '已观察页面（非业务验证）' : '入口未核验，请查看原因')} · ${h(errors[c.entry_hint.code] ?? c.entry_hint.code)}</p>` : ''}`;
  $('#modal-body > h2 + p').after(entryField);
  if ($('#confirm-one'))
    $('#confirm-one').onclick = () =>
      action(async () => {
        await taskAPI('confirm', {
          case_id: id,
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
