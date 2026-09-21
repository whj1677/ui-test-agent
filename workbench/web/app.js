const state = {
  assets: [], runs: [], selectedRunId: null, activeRunId: null,
  selectedEnvironmentId: null,
  buildTemplates: [], buildTasks: [], selectedBuildTaskId: null, activeBuildTaskId: null,
  buildBudget: null, buildAuthorization: null,
  selectedRevalidationByTask: {}, selectedRevalidationLaneByTask: {}, renderedRevalidationKey: null,
};
const byId = (id) => document.getElementById(id);

function setText(id, value) { byId(id).textContent = value ?? '—'; }
function clear(node) { while (node.firstChild) node.firstChild.remove(); }
function make(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload;
}

function renderAsset() {
  const asset = state.assets[0];
  const environmentSelect = byId('environment-select');
  setText('asset-count', state.assets.length);
  byId('asset-empty').classList.toggle('hidden', Boolean(asset));
  byId('asset-card').classList.toggle('hidden', !asset);
  clear(environmentSelect);
  if (!asset) {
    state.selectedEnvironmentId = null;
    return;
  }
  setText('asset-title', asset.title);
  setText('asset-version', `${asset.asset_id} · ${asset.version}`);
  setText('asset-case', `${asset.case_id} / ${asset.case_version}`);
  setText('asset-commit', asset.source_commit);
  setText('asset-sha', asset.script.sha256);
  setText('asset-approval', asset.approval_status);
  setText('asset-playwright', `${asset.dependency_lock.playwright_test} · workers=1 · retries=0`);
  const allowedEnvironmentIds = new Set(asset.allowed_environments.map((environment) => environment.id));
  if (!allowedEnvironmentIds.has(state.selectedEnvironmentId)) {
    state.selectedEnvironmentId = asset.allowed_environments[0]?.id ?? null;
  }
  for (const environment of asset.allowed_environments) {
    const option = make('option', `${environment.label} · ${environment.entry_url}`);
    option.value = environment.id;
    environmentSelect.append(option);
  }
  if (state.selectedEnvironmentId) environmentSelect.value = state.selectedEnvironmentId;
}

function renderControls() {
  const asset = state.assets[0];
  const busy = Boolean(state.activeRunId || state.activeBuildTaskId);
  byId('environment-select').disabled = !asset || busy;
  byId('run-button').disabled = !asset || busy;
  byId('stop-button').disabled = !state.activeRunId;
}

function selectedBuildTask() {
  return state.buildTasks.find((task) => task.task_id === state.selectedBuildTaskId) || null;
}

function renderBuildTemplate() {
  const template = state.buildTemplates[0];
  setText('build-template-title', template?.title || '固定任务不可用');
  setText('build-template-summary', template?.summary || '');
  setText('build-template-version', template ? `${template.template_id} · ${template.version}` : '—');
  setText('build-template-entry', template ? `${template.allowed_entry.kind} · ${template.allowed_entry.route}` : '—');
  setText('build-template-sha', template?.input_sha256);
  setText('build-budget', state.buildAuthorization
    ? `单次复验 ${state.buildAuthorization.used_starts} / ${state.buildAuthorization.max_starts}`
    : state.buildBudget ? `${state.buildBudget.used_starts} / ${state.buildBudget.max_starts}` : '—');
}

function renderBuildControls() {
  const task = selectedBuildTask();
  const busy = Boolean(state.activeRunId || state.activeBuildTaskId);
  const allowance = state.buildAuthorization || state.buildBudget;
  const exhausted = !allowance || allowance.used_starts >= allowance.max_starts;
  byId('build-submit').disabled = !state.buildTemplates.length || busy || exhausted;
  byId('build-start').disabled = busy || exhausted || task?.task_status !== 'SUBMITTED';
  byId('build-revise').disabled = busy || exhausted || !task?.revision_allowed;
  byId('build-stop').disabled = !state.activeBuildTaskId;
}

function renderBuildHistory() {
  const root = byId('build-history'); clear(root);
  if (!state.buildTasks.length) return root.append(make('div', '暂无建例任务。', 'empty'));
  for (const task of state.buildTasks) {
    const button = make('button'); button.type = 'button'; button.dataset.taskId = task.task_id;
    button.classList.toggle('selected', task.task_id === state.selectedBuildTaskId);
    button.append(make('strong', `${task.template.title} · ${task.task_status}`));
    button.append(make('span', task.task_id));
    button.append(make('span', `${task.created_at} · 候选 ${task.candidates.length} 版`));
    button.addEventListener('click', () => { state.selectedBuildTaskId = task.task_id; state.renderedRevalidationKey = null; render(); });
    root.append(button);
  }
}

function candidateResultText(candidate) {
  const normal = candidate.normal ? `${candidate.normal.test_status}/${candidate.normal.process?.exit_code ?? '—'}` : '未运行';
  const negative = candidate.negative ? `${candidate.negative.test_status}/${candidate.negative.process?.exit_code ?? '—'}` : '未运行';
  return `正常 ${normal} · 反例 ${negative} · 同哈希 ${candidate.same_candidate_hash ?? '—'}`;
}

function renderBuildDetail() {
  const task = selectedBuildTask();
  byId('build-detail-empty').classList.toggle('hidden', Boolean(task));
  byId('build-detail').classList.toggle('hidden', !task);
  if (!task) return;
  const statuses = byId('build-statuses'); clear(statuses);
  for (const [label, value] of [['任务', task.task_status], ['候选生成', task.generation_status], ['技术验证', task.verification_status], ['人工核对', task.human_review_status]]) {
    const item = make('div', undefined, 'status-item'); item.append(make('small', label), make('strong', value)); statuses.append(item);
  }
  const facts = byId('build-facts'); clear(facts);
  addFact(facts, '任务 ID', task.task_id);
  addFact(facts, '冻结输入', task.template.input_sha256);
  addFact(facts, '模型', 'deepseek-official / deepseek-v4-pro');
  addFact(facts, '阶段调用预算', `${task.budget.used_starts} / ${task.budget.max_starts}`);
  if (task.authorization) addFact(facts, '本次复验授权', `${task.authorization.authorization_id} · ${task.authorization.used_starts} / ${task.authorization.max_starts}`);
  addFact(facts, 'OS隔离', '未强制，残余风险已接受');
  addFact(facts, '创建/结束', `${task.created_at} / ${task.finished_at || '—'}`);

  const candidates = byId('build-candidates'); clear(candidates);
  if (!task.candidates.length) candidates.append(make('div', '尚未生成候选。', 'empty'));
  for (const candidate of task.candidates) {
    const card = make('article', undefined, 'candidate-card');
    const linked = task.revalidations?.find((item) => item.source_candidate_version === candidate.version && item.candidate_sha256 === candidate.sha256);
    card.append(make('strong', `候选 v${candidate.version} · 原始验证 ${candidate.verification_status}`));
    card.append(make('p', candidateResultText(candidate)));
    if (linked?.status === 'TECHNICAL_REVALIDATION_PASSED') card.append(make('p', '已有技术复验通过，尚未批准', 'result-highlight'));
    if (linked?.original_validation?.loading_errors?.length) {
      const originalError = make('details'); originalError.append(make('summary', '查看原始加载错误'));
      const pre = make('pre', linked.original_validation.loading_errors.join('\n'), 'error-box'); originalError.append(pre); card.append(originalError);
    }
    if (candidate.diff_from_previous?.base) card.append(make('p', `相对前版差异：${candidate.diff_from_previous.lines.length} 行`));
    const technical = document.createElement('details');
    technical.append(make('summary', '展开候选代码与完整哈希'));
    technical.append(make('p', `${candidate.sha256} · ${candidate.bytes} bytes`, 'mono break'));
    const code = make('pre'); code.textContent = candidate.code; technical.append(code);
    if (candidate.diff_from_previous?.lines?.length) {
      const diff = make('pre'); diff.textContent = JSON.stringify(candidate.diff_from_previous.lines, null, 2); technical.append(diff);
    }
    card.append(technical);
    candidates.append(card);
  }

  renderBuildRevalidations(task);

  const files = byId('build-files'); clear(files);
  if (!task.files.length) files.append(make('div', '尚无登记文件。', 'empty'));
  for (const file of task.files) {
    const card = make('article', undefined, 'file-card');
    card.append(make('strong', `${file.kind} · ${file.file_name}`));
    card.append(make('p', `${file.bytes} bytes · ${file.sha256.slice(0, 16)}… · ${file.web_visible ? '可在本页读取' : '仅本机登记'}`, 'mono'));
    files.append(card);
  }
  byId('build-error').textContent = task.error ? JSON.stringify(task.error, null, 2) : '无';
}

function revalidationMediaUrl(task, record, item) {
  return `/api/build/tasks/${encodeURIComponent(task.task_id)}/revalidations/${encodeURIComponent(record.validation_id)}/media/${encodeURIComponent(item.media_id)}`;
}

function renderBuildRevalidations(task) {
  const root = byId('build-revalidations');
  const records = task.revalidations || [];
  if (!records.length) {
    if (state.renderedRevalidationKey !== `${task.task_id}:empty`) { clear(root); root.append(make('div', '尚无已关联的候选复验。', 'empty')); }
    state.renderedRevalidationKey = `${task.task_id}:empty`;
    return;
  }
  const selectedId = records.some((item) => item.validation_id === state.selectedRevalidationByTask[task.task_id])
    ? state.selectedRevalidationByTask[task.task_id] : records[0].validation_id;
  state.selectedRevalidationByTask[task.task_id] = selectedId;
  const lane = ['normal', 'negative'].includes(state.selectedRevalidationLaneByTask[task.task_id])
    ? state.selectedRevalidationLaneByTask[task.task_id] : 'normal';
  state.selectedRevalidationLaneByTask[task.task_id] = lane;
  const record = records.find((item) => item.validation_id === selectedId);
  const signature = `${task.task_id}:${selectedId}:${lane}:${JSON.stringify(record)}`;
  if (state.renderedRevalidationKey === signature) return;
  state.renderedRevalidationKey = signature;
  clear(root);

  const picker = make('div', undefined, 'revalidation-picker');
  for (const item of records) {
    const button = make('button', item.validation_id); button.type = 'button';
    button.classList.toggle('selected', item.validation_id === selectedId);
    button.addEventListener('click', () => {
      state.selectedRevalidationByTask[task.task_id] = item.validation_id;
      state.renderedRevalidationKey = null;
      renderBuildRevalidations(task);
    });
    picker.append(button);
  }
  root.append(picker);

  const summary = make('article', undefined, 'revalidation-summary');
  summary.append(make('strong', `${record.validation_id} · ${record.status}`));
  summary.append(make('p', `${record.finished_at || '—'} · 候选 v${record.source_candidate_version}`));
  if (record.status === 'TECHNICAL_REVALIDATION_PASSED') summary.append(make('p', '已有技术复验通过，尚未批准', 'result-highlight'));
  const lanes = make('div', undefined, 'lane-tabs');
  for (const [value, label] of [['normal', '正常'], ['negative', '反例']]) {
    const button = make('button', `${label} · ${record[value].test_status}`); button.type = 'button';
    button.dataset.lane = value; button.classList.toggle('selected', value === lane);
    button.addEventListener('click', () => {
      state.selectedRevalidationLaneByTask[task.task_id] = value;
      state.renderedRevalidationKey = null;
      renderBuildRevalidations(task);
    });
    lanes.append(button);
  }
  summary.append(lanes);
  const result = record[lane];
  const resultBox = make('div', undefined, 'revalidation-result');
  resultBox.append(make('strong', `${lane === 'normal' ? '正常' : '反例'}：${result.test_count} 条 ${result.test_status}`));
  if (result.error?.expected != null || result.error?.actual != null) {
    resultBox.append(make('p', `期望：${result.error?.expected ?? '—'} · 实际：${result.error?.actual ?? '—'}`));
  }
  if (result.specified_mismatch) resultBox.append(make('p', '指定错误已检出', 'result-highlight'));
  if (result.error?.message) {
    const error = make('details'); error.append(make('summary', '查看原始错误事实'));
    const pre = make('pre', result.error.message, 'error-box'); error.append(pre); resultBox.append(error);
  }
  summary.append(resultBox);
  root.append(summary);

  const mediaRoot = make('div', undefined, 'media-grid revalidation-media');
  const items = record.media.filter((item) => item.lane === lane);
  if (!items.length) mediaRoot.append(make('div', '该验证没有已登记媒体。', 'empty'));
  for (const item of items) {
    const card = make('article', undefined, 'media-card');
    card.dataset.mediaId = item.media_id;
    const url = revalidationMediaUrl(task, record, item);
    card.append(make('strong', `${item.kind} · ${item.file_name}`), make('p', `${item.bytes} bytes · ${item.sha256.slice(0, 16)}…`, 'mono'));
    if (item.kind === 'screenshot') {
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener';
      const image = document.createElement('img'); image.src = url; image.alt = `${lane} ${item.file_name}`; image.dataset.testid = `revalidation-${lane}-screenshot`; link.append(image); card.append(link);
    } else if (item.kind === 'video') {
      const video = document.createElement('video'); video.src = url; video.controls = true; video.preload = 'metadata'; video.dataset.testid = `revalidation-${lane}-video`; card.append(video);
    } else {
      const link = make('a', '下载 Trace 后运行 npx playwright show-trace <文件> 在本机查看'); link.href = url; link.download = item.file_name; link.dataset.testid = `revalidation-${lane}-trace`; card.append(link);
    }
    mediaRoot.append(card);
  }
  root.append(mediaRoot);
  const technical = document.createElement('details'); technical.className = 'technical-details';
  technical.append(make('summary', '展开关联与完整哈希'));
  const facts = make('dl', undefined, 'facts compact');
  addFact(facts, '源任务', record.source_task_id); addFact(facts, '源尝试', record.source_attempt_id);
  addFact(facts, '候选版本', record.source_candidate_version); addFact(facts, '候选 SHA-256', record.candidate_sha256);
  addFact(facts, '运行配置', record.runtime?.config_path || '—'); addFact(facts, '运行环境一致', record.runtime?.consistent ?? '—');
  technical.append(facts); root.append(technical);
}

function renderHistory() {
  const root = byId('history');
  clear(root);
  setText('run-count', state.runs.length);
  if (!state.runs.length) return root.append(make('div', '暂无运行记录。', 'empty'));
  for (const run of state.runs) {
    const button = make('button');
    button.type = 'button';
    button.dataset.runId = run.run_id;
    button.classList.toggle('selected', run.run_id === state.selectedRunId);
    button.append(make('strong', `${run.environment.label} · ${run.execution_status}`));
    button.append(make('span', run.run_id));
    button.append(make('span', `${run.created_at} · 测试 ${run.test_status}`));
    button.addEventListener('click', () => { state.selectedRunId = run.run_id; render(); });
    root.append(button);
  }
}

function addFact(root, label, value) {
  const box = make('div'); box.append(make('dt', label), make('dd', value ?? '—')); root.append(box);
}
function renderDetail() {
  const run = state.runs.find((item) => item.run_id === state.selectedRunId);
  byId('detail-empty').classList.toggle('hidden', Boolean(run));
  byId('detail').classList.toggle('hidden', !run);
  if (!run) return;
  const statuses = byId('detail-statuses'); clear(statuses);
  for (const [label, value] of [['执行', run.execution_status], ['报告', run.report_status], ['测试', run.test_status], ['证据', run.evidence_status]]) {
    const item = make('div', undefined, 'status-item'); item.append(make('small', label), make('strong', value)); statuses.append(item);
  }
  const facts = byId('run-facts'); clear(facts);
  addFact(facts, '运行 ID', run.run_id); addFact(facts, '资产版本', run.asset_version);
  addFact(facts, '入口', run.environment.entry_url); addFact(facts, '退出码', run.process.exit_code);
  addFact(facts, '开始', run.started_at); addFact(facts, '结束', run.finished_at);
  addFact(facts, '来源哈希', run.integrity.source_after_sha256 || run.integrity.source_before_sha256);
  addFact(facts, '模型/重试', `${run.runtime.model_calls} / ${run.runtime.retries}`);
  const steps = byId('steps'); clear(steps);
  for (const step of run.steps || []) {
    const card = make('article', undefined, `step ${step.status}`);
    card.append(make('strong', `${step.step_id} · ${step.status}`), make('p', step.action), make('p', `预期：${step.expected}`));
    if (step.error?.message) card.append(make('p', `错误：${step.error.message}`));
    steps.append(card);
  }
  byId('error').textContent = run.error ? JSON.stringify(run.error, null, 2) : '无';
  const media = byId('media'); clear(media);
  if (!run.media?.length) media.append(make('div', '无已登记媒体。', 'empty'));
  for (const item of run.media || []) {
    const card = make('article', undefined, 'media-card');
    const url = `/api/runs/${encodeURIComponent(run.run_id)}/media/${encodeURIComponent(item.media_id)}`;
    card.append(make('strong', `${item.kind} · ${item.file_name}`), make('p', `${item.bytes} bytes · ${item.sha256.slice(0, 16)}…`, 'mono'));
    if (item.kind === 'screenshot') { const image = document.createElement('img'); image.src = url; image.alt = item.file_name; card.append(image); }
    else if (item.kind === 'video') { const video = document.createElement('video'); video.src = url; video.controls = true; card.append(video); }
    else { const link = make('a', '下载 Trace 在本机查看'); link.href = url; link.download = item.file_name; card.append(link); }
    media.append(card);
  }
}

function render() {
  renderAsset(); renderControls(); renderHistory(); renderDetail();
  renderBuildTemplate(); renderBuildControls(); renderBuildHistory(); renderBuildDetail();
}

async function refresh() {
  try {
    const [health, assets, runs, templates, buildTasks] = await Promise.all([
      api('/api/health'), api('/api/assets'), api('/api/runs'), api('/api/build/templates'), api('/api/build/tasks'),
    ]);
    state.assets = assets.assets; state.runs = runs.runs; state.activeRunId = health.active_run_id;
    state.buildTemplates = templates.templates; state.buildTasks = buildTasks.tasks;
    state.activeBuildTaskId = health.active_build_task_id; state.buildBudget = health.build_budget;
    state.buildAuthorization = health.build_authorization;
    if (!state.selectedRunId && state.runs[0]) state.selectedRunId = state.runs[0].run_id;
    if (!state.selectedBuildTaskId && state.buildTasks[0]) state.selectedBuildTaskId = state.buildTasks[0].task_id;
    setText('service-status', health.active_run_id || health.active_build_task_id ? '运行中' : '服务就绪');
    render();
  } catch (error) { setText('service-status', '连接失败'); setText('action-message', error.message); }
}

byId('environment-select').addEventListener('change', (event) => {
  state.selectedEnvironmentId = event.currentTarget.value;
});

byId('run-button').addEventListener('click', async () => {
  const asset = state.assets[0]; if (!asset) return;
  byId('run-button').disabled = true; setText('action-message', '正在启动真实 Playwright 进程…');
  try {
    const run = await api('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ asset_id: asset.asset_id, environment: state.selectedEnvironmentId }) });
    state.selectedRunId = run.run_id; setText('action-message', `已启动 ${run.run_id}`); await refresh();
  } catch (error) { setText('action-message', `启动被拒绝：${error.message}`); await refresh(); }
});

byId('stop-button').addEventListener('click', async () => {
  if (!state.activeRunId) return;
  try { await api(`/api/runs/${encodeURIComponent(state.activeRunId)}/stop`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); setText('action-message', '已请求停止当前任务。'); }
  catch (error) { setText('action-message', `停止失败：${error.message}`); }
  await refresh();
});

byId('build-submit').addEventListener('click', async () => {
  const template = state.buildTemplates[0]; if (!template) return;
  byId('build-submit').disabled = true; setText('build-message', '正在冻结固定任务输入…');
  try {
    const task = await api('/api/build/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template_id: template.template_id }) });
    state.selectedBuildTaskId = task.task_id; setText('build-message', `已提交 ${task.task_id}，等待显式启动。`);
  } catch (error) { setText('build-message', `提交失败：${error.message}`); }
  await refresh();
});

byId('build-start').addEventListener('click', async () => {
  const task = selectedBuildTask(); if (!task) return;
  byId('build-start').disabled = true; setText('build-message', '正在启动真实 Harness…');
  try {
    await api(`/api/build/tasks/${encodeURIComponent(task.task_id)}/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setText('build-message', `已启动 ${task.task_id}`);
  } catch (error) { setText('build-message', `启动失败：${error.message}`); }
  await refresh();
});

byId('build-revise').addEventListener('click', async () => {
  const task = selectedBuildTask(); if (!task) return;
  byId('build-revise').disabled = true; setText('build-message', '正在明确发起唯一一次反馈修订…');
  try {
    await api(`/api/build/tasks/${encodeURIComponent(task.task_id)}/revise`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setText('build-message', `已发起 ${task.task_id} 的反馈修订。`);
  } catch (error) { setText('build-message', `修订失败：${error.message}`); }
  await refresh();
});

byId('build-stop').addEventListener('click', async () => {
  if (!state.activeBuildTaskId) return;
  try {
    await api(`/api/build/tasks/${encodeURIComponent(state.activeBuildTaskId)}/stop`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setText('build-message', '已请求取消当前建例任务。');
  } catch (error) { setText('build-message', `取消失败：${error.message}`); }
  await refresh();
});

await refresh();
setInterval(refresh, 1000);
