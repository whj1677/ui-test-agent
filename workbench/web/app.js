const state = {
  assets: [], runs: [], selectedRunId: null, activeRunId: null,
  selectedEnvironmentId: null,
  buildTemplates: [], buildTasks: [], selectedBuildTaskId: null, activeBuildTaskId: null,
  buildBudget: null, buildAuthorization: null,
  selectedRevalidationByTask: {}, selectedRevalidationLaneByTask: {}, renderedRevalidationKey: null,
  caseProjects: [], selectedProjectId: null, selectedCaseId: null, caseUpload: null, importPreview: null,
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

const mappingLabels = {
  external_id: '用例编号', title: '标题', module: '模块', preconditions: '前置条件', test_data: '测试数据',
  steps: '步骤', expected: '逐步预期', status: '内容状态',
};

function selectedProject() { return state.caseProjects.find((item) => item.project_id === state.selectedProjectId) || null; }
function currentCase(item) { return item?.versions.find((version) => version.version === item.current_version)?.content || null; }

function renderCaseLibrary() {
  setText('case-project-count', `${state.caseProjects.length} 个项目`);
  const list = byId('case-project-list'); clear(list);
  for (const project of state.caseProjects) {
    const button = make('button', `${project.name}（${project.cases.length}）`);
    button.classList.toggle('selected', project.project_id === state.selectedProjectId);
    button.addEventListener('click', () => { state.selectedProjectId = project.project_id; state.selectedCaseId = null; state.caseUpload = null; state.importPreview = null; renderCaseLibrary(); });
    list.append(button);
  }
  const project = selectedProject();
  byId('case-project-empty').classList.toggle('hidden', Boolean(project));
  byId('case-project-workspace').classList.toggle('hidden', !project);
  if (!project) return;
  byId('project-name').value = project.name; byId('project-description').value = project.description;
  const query = byId('case-search').value.trim().toLocaleLowerCase();
  const body = byId('case-table-body'); clear(body);
  for (const item of project.cases.filter((entry) => !query || entry.external_id.toLocaleLowerCase().includes(query) || entry.title.toLocaleLowerCase().includes(query))) {
    const row = document.createElement('tr');
    const checkboxCell = document.createElement('td'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.caseId = item.case_id; checkboxCell.append(checkbox);
    row.append(checkboxCell, make('td', item.external_id), make('td', item.title), make('td', item.module || '—'), make('td', item.status === 'CONFIRMED' ? '内容已确认' : '内容待确认'), make('td', `v${item.current_version}`));
    row.addEventListener('click', (event) => { if (event.target === checkbox) return; state.selectedCaseId = item.case_id; renderCaseDetail(); });
    body.append(row);
  }
  renderCaseDetail(); renderImportPreview();
}

function renderCaseDetail() {
  const project = selectedProject(); const item = project?.cases.find((entry) => entry.case_id === state.selectedCaseId); const form = byId('case-detail');
  form.classList.toggle('hidden', !item); if (!item) return;
  const content = currentCase(item);
  byId('case-external-id').value = content.external_id; byId('case-title').value = content.title; byId('case-module').value = content.module;
  byId('case-status').value = content.status; byId('case-preconditions').value = content.preconditions; byId('case-test-data').value = content.test_data;
  byId('case-steps').value = content.steps.map((step) => step.action).join('\n'); byId('case-expected').value = content.steps.map((step) => step.expected).join('\n');
  setText('case-source', `内部ID ${item.case_id} · 根来源 ${item.root_source.stable_id} · 导入批次 ${item.import_batch_id}`);
}

function renderMapping() {
  const upload = state.caseUpload; const box = byId('mapping-fields'); clear(box);
  box.classList.toggle('hidden', upload?.source_type !== 'xlsx');
  byId('case-sheet').classList.toggle('hidden', upload?.source_type !== 'xlsx');
  byId('preview-import').classList.toggle('hidden', !upload);
  if (upload?.source_type !== 'xlsx') return;
  const sheet = upload.workbook.sheets.find((item) => item.name === byId('case-sheet').value) || upload.workbook.sheets[0];
  for (const [field, labelText] of Object.entries(mappingLabels)) {
    const label = make('label', labelText); const select = document.createElement('select'); select.dataset.field = field;
    select.append(new Option('不映射', ''));
    for (const header of sheet.headers) select.append(new Option(header, header));
    select.value = sheet.headers.includes(labelText) ? labelText : ''; label.append(select); box.append(label);
  }
}

function renderImportPreview() {
  const preview = state.importPreview; const box = byId('import-preview'); clear(box); box.classList.toggle('hidden', !preview); if (!preview) return;
  const summary = make('div', undefined, 'preview-summary');
  const labels = { NEW: '新增', DUPLICATE: '重复跳过', CONFLICT: '冲突', PENDING_CLARIFICATION: '待澄清', UNIMPORTABLE: '无法导入' };
  for (const [key, value] of Object.entries(preview.summary)) summary.append(make('span', `${labels[key]} ${value}`, 'count'));
  box.append(summary);
  for (const item of preview.items) {
    const row = make('div', undefined, 'preview-item'); row.append(make('strong', `${item.content.external_id || '无编号'} · ${item.content.title || '无标题'}`), make('p', `${labels[item.classification]} · ${item.source_location.sheet || item.source_location.package_id} / ${item.source_location.row || item.source_location.index}`));
    for (const issue of item.issues) row.append(make('p', `${issue.severity}: ${issue.message}`, 'subtle-dark'));
    if (item.classification === 'CONFLICT') { const select = document.createElement('select'); select.dataset.conflictKey = item.candidate_key; select.append(new Option('跳过，不覆盖', 'SKIP'), new Option('作为独立副本导入', 'IMPORT_COPY')); row.append(select); }
    box.append(row);
  }
  const confirm = make('button', '确认导入', 'primary'); confirm.id = 'confirm-import'; confirm.addEventListener('click', confirmImport); box.append(confirm);
}

async function refreshCaseLibrary(preferredProjectId) {
  const result = await api('/api/case-library/projects'); state.caseProjects = result.projects;
  if (preferredProjectId) state.selectedProjectId = preferredProjectId;
  if (!state.caseProjects.some((item) => item.project_id === state.selectedProjectId)) state.selectedProjectId = state.caseProjects[0]?.project_id || null;
  renderCaseLibrary();
}

async function confirmImport() {
  const decisions = {}; document.querySelectorAll('[data-conflict-key]').forEach((select) => { decisions[select.dataset.conflictKey] = select.value; });
  try {
    const result = await api(`/api/case-library/projects/${encodeURIComponent(state.selectedProjectId)}/imports/${encodeURIComponent(state.importPreview.preview_id)}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decisions }) });
    setText('case-message', `${result.idempotent ? '重复确认：' : ''}新增 ${result.result.added} 条，重复跳过 ${result.result.skipped_duplicate} 条，冲突跳过 ${result.result.skipped_conflict} 条。`);
    state.importPreview = null; await refreshCaseLibrary(state.selectedProjectId);
  } catch (error) { setText('case-message', `导入失败：${error.message}`); }
}

async function downloadCases(all) {
  const ids = all ? [] : [...document.querySelectorAll('#case-table-body input:checked')].map((item) => item.dataset.caseId);
  if (!all && !ids.length) return setText('case-message', '请先选择至少一条用例。');
  const suffix = ids.length ? `?case_ids=${ids.map(encodeURIComponent).join(',')}` : '';
  const response = await fetch(`/api/case-library/projects/${encodeURIComponent(state.selectedProjectId)}/export${suffix}`);
  if (!response.ok) return setText('case-message', `导出失败：${(await response.json()).error}`);
  const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${state.selectedProjectId}-cases.json`; link.click(); URL.revokeObjectURL(link.href);
  setText('case-message', `已导出 ${all ? '全部' : `${ids.length} 条`}用例；不包含脚本、执行结果和媒体。`);
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

byId('create-project').addEventListener('click', async () => {
  try {
    const project = await api('/api/case-library/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: byId('new-project-name').value, description: byId('new-project-description').value }) });
    byId('new-project-name').value = ''; byId('new-project-description').value = ''; await refreshCaseLibrary(project.project_id);
  } catch (error) { setText('case-message', `创建失败：${error.message}`); }
});
byId('save-project').addEventListener('click', async () => {
  const project = selectedProject(); if (!project) return;
  try {
    await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: project.revision, name: byId('project-name').value, description: byId('project-description').value }) });
    setText('case-message', '项目信息已保存。'); await refreshCaseLibrary(project.project_id);
  } catch (error) { setText('case-message', `保存失败：${error.message}`); }
});
byId('case-search').addEventListener('input', renderCaseLibrary);
byId('case-sheet').addEventListener('change', renderMapping);
byId('upload-cases').addEventListener('click', async () => {
  const file = byId('case-import-file').files[0]; if (!file || !selectedProject()) return setText('case-message', '请选择项目和 .xlsx/.json 文件。');
  try {
    const response = await fetch('/api/case-library/uploads', { method: 'POST', headers: { 'content-type': file.type || (file.name.endsWith('.json') ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'x-file-name': encodeURIComponent(file.name) }, body: file });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
    state.caseUpload = payload; state.importPreview = null;
    const sheet = byId('case-sheet'); clear(sheet); for (const item of payload.workbook?.sheets || []) sheet.append(new Option(`${item.name}（${item.row_count} 行）`, item.name));
    renderMapping(); renderImportPreview(); setText('case-message', `已读取 ${payload.file_name}，请核对工作表、映射后预览。`);
  } catch (error) { setText('case-message', `读取失败：${error.message}`); }
});
byId('preview-import').addEventListener('click', async () => {
  if (!state.caseUpload || !selectedProject()) return;
  const body = { upload_id: state.caseUpload.upload_id };
  if (state.caseUpload.source_type === 'xlsx') {
    body.sheet_name = byId('case-sheet').value; body.mapping = {};
    document.querySelectorAll('#mapping-fields select').forEach((select) => { body.mapping[select.dataset.field] = select.value; });
  }
  try {
    state.importPreview = await api(`/api/case-library/projects/${encodeURIComponent(state.selectedProjectId)}/imports/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    renderImportPreview(); setText('case-message', '预览已生成；确认前项目不会改变。');
  } catch (error) { setText('case-message', `预览失败：${error.message}`); }
});
byId('case-detail').addEventListener('submit', async (event) => {
  event.preventDefault(); const project = selectedProject(); const item = project?.cases.find((entry) => entry.case_id === state.selectedCaseId); if (!item) return;
  const actions = byId('case-steps').value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean); const expected = byId('case-expected').value.split(/\r?\n/).map((value) => value.trim());
  const steps = actions.map((action, index) => ({ order: index + 1, action, expected: expected[index] || '' }));
  try {
    await api(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/cases/${encodeURIComponent(item.case_id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: project.revision, content: { external_id: byId('case-external-id').value, title: byId('case-title').value, module: byId('case-module').value, status: byId('case-status').value, preconditions: byId('case-preconditions').value, test_data: byId('case-test-data').value, steps } }) });
    setText('case-message', '已形成新的用例版本。'); await refreshCaseLibrary(project.project_id);
  } catch (error) { setText('case-message', `保存用例失败：${error.message}`); }
});
byId('export-selected').addEventListener('click', () => void downloadCases(false));
byId('export-all').addEventListener('click', () => void downloadCases(true));

await refresh();
await refreshCaseLibrary();
setInterval(refresh, 1000);
