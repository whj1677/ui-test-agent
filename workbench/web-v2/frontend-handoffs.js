import { api } from './api.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const post = value => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const errors = {
  FRONTEND_HANDOFF_PACKAGE_INVALID: '导出物格式不符合要求，请使用配套的前端模块导出 Skill 重新导出 JSON。',
  FRONTEND_HANDOFF_STORAGE_INVALID: '已保存的交接资料校验失败，请保留原文件并检查工作台记录。',
  FRONTEND_HANDOFF_SERVICE_NOT_READY: '前端交接资料服务尚未加载，请在当前任务结束后重启工作台。',
  WORKBENCH_UNREACHABLE: '工作台暂时无法连接，请稍后重试。',
};

export function frontendHandoffsHtml(data) {
  const rows = data.handoffs || [];
  return rows.length ? rows.map(item => `<article class="notice"><h3>${esc(item.module.name)} · ${item.enabled ? '已启用' : '未启用'}</h3>
    <p>源码版本：${esc(item.source_revision || '未提供版本号')} · ${item.page_count} 个页面 · ${item.control_count} 个控件</p>
    <p class="muted">模块匹配：${esc([item.module.name, ...item.module.aliases].join('、'))} · 导入时间：${esc(item.imported_at)}</p>
    <details><summary>待确认信息（${item.unresolved.length} 项）与版本记录</summary>
      ${item.unresolved.length ? `<ul>${item.unresolved.map(issue => `<li>${esc(issue.topic)}：${esc(issue.reason)}</li>`).join('')}</ul>` : '<p>导出包未列出待确认项。实际页面仍需在生成时核对。</p>'}
      <p class="muted">导出编号：${esc(item.package_id)}<br>内容摘要：${esc(item.sha256)}</p></details>
    <button class="button" type="button" data-handoff-id="${esc(item.handoff_id)}" data-handoff-enable="${item.enabled ? 'false' : 'true'}">${item.enabled ? '停用交接资料' : '启用此版本'}</button></article>`).join('')
    : '<p class="muted">尚未导入前端技术交接资料。已有用例仍可直接生成脚本。</p>';
}

export async function renderFrontendHandoffs({ projectId, container, isCurrent = () => true }) {
  if (!container) return;
  const base = `/api/case-library/projects/${encodeURIComponent(projectId)}/frontend-handoffs`;
  container.innerHTML = `<div class="panel-body">
    <p>导入前端开发者通过 Skill 导出的 JSON，用于定位页面、控件及等待条件；原测试预期保持不变。</p>
    <p class="muted">同一模块启用新版本后，旧版本及历史脚本会保留。停用仅影响后续生成。</p>
    <form data-handoff-form><div class="field"><span class="handoff-field-label">前端模块导出文件</span><label class="handoff-file-picker"><input type="file" accept=".json,application/json" data-handoff-file><span class="handoff-file-button">选择 JSON 文件</span><span class="handoff-file-name" data-handoff-file-label>尚未选择文件</span></label></div>
      <button class="button primary" type="submit" disabled>导入并启用</button></form>
    <p data-handoff-status role="status" aria-live="polite"></p><div data-handoff-list>正在读取交接资料…</div></div>`;
  const form = container.querySelector('[data-handoff-form]'), input = container.querySelector('[data-handoff-file]');
  const fileLabel = container.querySelector('[data-handoff-file-label]');
  const submit = form.querySelector('button'), status = container.querySelector('[data-handoff-status]'), list = container.querySelector('[data-handoff-list]');
  let busy = false;
  const connected = () => isCurrent() && container.isConnected;
  const setBusy = value => {
    busy = value; input.disabled = value; submit.disabled = value || !input.files?.length;
    for (const button of list.querySelectorAll('button')) button.disabled = value;
  };
  const errorText = error => errors[error.code || error.message] || error.message || '操作未完成，请重试。';
  const refresh = async () => { const data = await api(base); if (connected()) list.innerHTML = frontendHandoffsHtml(data); };
  input.addEventListener('change', () => { fileLabel.textContent = input.files?.[0]?.name || '尚未选择文件'; setBusy(busy); status.textContent = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !connected()) return;
    const file = input.files?.[0]; if (!file) return;
    setBusy(true); status.textContent = '正在校验并导入交接资料…';
    try {
      if (!/\.json$/i.test(file.name) || file.size > 256 * 1024) throw Error('请选择不超过 256 KiB 的 JSON 导出文件。');
      let document; try { document = JSON.parse(await file.text()); } catch { throw Error('文件不是有效的 JSON，请重新选择导出文件。'); }
      if (!connected()) return;
      const value = await api(base, post({ package: document, enabled: true }));
      if (!connected()) return;
      status.textContent = `${value.module.name} 已导入并启用，后续匹配模块的生成将使用此版本。`;
      input.value = ''; fileLabel.textContent = '尚未选择文件'; await refresh();
    } catch (error) { if (connected()) status.textContent = errorText(error); }
    finally { if (connected()) setBusy(false); }
  });
  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-handoff-id]');
    if (!button || busy || !connected()) return;
    const enabled = button.dataset.handoffEnable === 'true';
    setBusy(true); status.textContent = enabled ? '正在启用此版本…' : '正在停用交接资料…';
    try {
      await api(`${base}/${encodeURIComponent(button.dataset.handoffId)}/enabled`, post({ enabled }));
      if (!connected()) return;
      status.textContent = enabled ? '此版本已启用。' : '已停用。交接资料和历史结果已保留。'; await refresh();
    } catch (error) { if (connected()) status.textContent = errorText(error); }
    finally { if (connected()) setBusy(false); }
  });
  try { await refresh(); }
  catch (error) { if (connected()) { list.textContent = ''; status.textContent = errorText(error); } }
}
