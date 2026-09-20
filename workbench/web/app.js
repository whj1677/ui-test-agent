const state = { assets: [], runs: [], selectedRunId: null, activeRunId: null };
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
  setText('asset-count', state.assets.length);
  byId('asset-empty').classList.toggle('hidden', Boolean(asset));
  byId('asset-card').classList.toggle('hidden', !asset);
  clear(byId('environment-select'));
  if (!asset) return;
  setText('asset-title', asset.title);
  setText('asset-version', `${asset.asset_id} · ${asset.version}`);
  setText('asset-case', `${asset.case_id} / ${asset.case_version}`);
  setText('asset-commit', asset.source_commit);
  setText('asset-sha', asset.script.sha256);
  setText('asset-approval', asset.approval_status);
  setText('asset-playwright', `${asset.dependency_lock.playwright_test} · workers=1 · retries=0`);
  for (const environment of asset.allowed_environments) {
    const option = make('option', `${environment.label} · ${environment.entry_url}`);
    option.value = environment.id;
    byId('environment-select').append(option);
  }
}

function renderControls() {
  const asset = state.assets[0];
  byId('environment-select').disabled = !asset || Boolean(state.activeRunId);
  byId('run-button').disabled = !asset || Boolean(state.activeRunId);
  byId('stop-button').disabled = !state.activeRunId;
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

function render() { renderAsset(); renderControls(); renderHistory(); renderDetail(); }

async function refresh() {
  try {
    const [health, assets, runs] = await Promise.all([api('/api/health'), api('/api/assets'), api('/api/runs')]);
    state.assets = assets.assets; state.runs = runs.runs; state.activeRunId = health.active_run_id;
    if (!state.selectedRunId && state.runs[0]) state.selectedRunId = state.runs[0].run_id;
    setText('service-status', health.active_run_id ? '运行中' : '服务就绪');
    render();
  } catch (error) { setText('service-status', '连接失败'); setText('action-message', error.message); }
}

byId('run-button').addEventListener('click', async () => {
  const asset = state.assets[0]; if (!asset) return;
  byId('run-button').disabled = true; setText('action-message', '正在启动真实 Playwright 进程…');
  try {
    const run = await api('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ asset_id: asset.asset_id, environment: byId('environment-select').value }) });
    state.selectedRunId = run.run_id; setText('action-message', `已启动 ${run.run_id}`); await refresh();
  } catch (error) { setText('action-message', `启动被拒绝：${error.message}`); await refresh(); }
});

byId('stop-button').addEventListener('click', async () => {
  if (!state.activeRunId) return;
  try { await api(`/api/runs/${encodeURIComponent(state.activeRunId)}/stop`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); setText('action-message', '已请求停止当前任务。'); }
  catch (error) { setText('action-message', `停止失败：${error.message}`); }
  await refresh();
});

await refresh();
setInterval(refresh, 1000);
