import { esc } from './workflow.js';

const messages = {
  CASE_LIFECYCLE_BUSY: '工作台正在处理任务或其他修改，请稍后再试。',
  CASE_PROJECT_REVISION_CONFLICT: '项目已变化，本次未修改任何用例。请刷新后重新选择。',
  CASE_LIFECYCLE_CONFLICT: '所选用例版本已变化，本次未修改任何用例。请刷新后重新选择。',
  CASE_LIFECYCLE_NOT_FOUND: '所选用例已被移动或不属于当前项目，请刷新后重新选择。',
};

export function openCaseLifecycle({ project, ids, restore = false, openModal, mutate, jsonOptions, onChanged }) {
  const source = restore ? (project.deleted_cases || []) : project.cases;
  const selected = new Set(ids);
  const items = source.filter(item => selected.has(item.case_id));
  if (!items.length || items.length !== selected.size) throw Error('请重新选择当前项目中的用例。');
  if (items.length > 200) throw Error('每次最多处理 200 条用例，请缩小选择范围。');
  const label = restore ? '恢复' : '删除';
  openModal({ title: `${label} ${items.length} 条用例`, confirmLabel: restore ? '确认恢复' : '移到已删除',
    body: `<p>${restore ? '恢复后用例将重新出现在用例库，沿用原编号、版本和关联资料。' : '用例将移到“已删除”列表，可随时恢复。原版本、脚本和运行记录会保留。'}</p><ul>${items.map(item => `<li>${esc(item.external_id)} · ${esc(item.title)} · v${item.current_version}</li>`).join('')}</ul><p class="muted">不会生成脚本或运行测试。</p>`,
    onConfirm: async close => {
      const body = { revision: project.revision, [restore ? 'confirm_restore' : 'confirm_delete']: true,
        items: items.map(item => ({ case_id: item.case_id, case_version: item.current_version,
          content_sha256: item.versions.find(version => version.version === item.current_version).content_sha256 })) };
      let updated;
      try { updated = await mutate(`/api/case-library/projects/${encodeURIComponent(project.project_id)}/cases/${restore ? 'restore' : 'delete'}`, jsonOptions(body)); }
      catch (error) { throw Error(messages[error.code || error.message] || error.message); }
      close(); onChanged(updated);
    },
  });
}

export function renderDeletedCases({ project, showPage, onRestore }) {
  const cases = project.deleted_cases || [];
  showPage(`<div class="page-heading"><div><h1>已删除的用例</h1><p>${esc(project.name)} · ${cases.length} 条 · 原版本、脚本和运行记录保留</p></div><a class="button" data-nav href="#/projects/${encodeURIComponent(project.project_id)}/cases">返回用例库</a></div><section class="panel"><div class="panel-body">${cases.length ? `<div class="table-wrap"><table><thead><tr><th>编号 / 标题</th><th>删除时间</th><th>操作</th></tr></thead><tbody>${cases.map(item => `<tr><td><strong>${esc(item.external_id)}</strong><p>${esc(item.title)} · v${item.current_version}</p></td><td>${esc(new Date(item.deletion.deleted_at).toLocaleString('zh-CN'))}</td><td><button class="button small" data-restore-case="${esc(item.case_id)}">恢复用例</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">暂无已删除的用例。</p>'}</div></section>`);
  document.querySelectorAll('[data-restore-case]').forEach(button => button.addEventListener('click', () => onRestore(button.dataset.restoreCase)));
}
