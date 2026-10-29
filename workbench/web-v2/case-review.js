import { api } from './api.js';
import { esc } from './workflow.js';

export function pendingReviewItems(project, ids = null) {
  const selected = ids ? new Set(ids) : null;
  return (project.cases || []).flatMap(item => {
    const version = item.versions.find(row => row.version === item.current_version);
    if (!version || version.content.status === 'CONFIRMED' || selected && !selected.has(item.case_id)) return [];
    const content = version.content;
    const issue = content.requirements_origin ? '请先在用例助手核对设计草案' :
      !['UI','BACKEND'].includes(content.case_type) ? '用例类型未分类，请先编辑' :
      !content.external_id?.trim() || !content.title?.trim() || !content.steps?.length ||
      content.steps.some((step, index) => step.order !== index + 1 || !step.action?.trim() || !step.expected?.trim()) ? '步骤或预期不完整，请先编辑补充' : '';
    return [{ ...item, content, case_version: version.version, content_sha256: version.content_sha256, issue }];
  });
}

const errors = {
  CASE_PROJECT_REVISION_CONFLICT: '项目已在其他页面修改。本次没有确认任何用例，请关闭后刷新再核对。',
  CASE_CONTENT_REVIEW_CONFLICT: '用例版本已变化。本次没有确认任何用例，请关闭后刷新再核对。',
  CASE_CONTENT_REVIEW_INCOMPLETE: '有用例的步骤或预期不完整，请先补充。',
  CASE_DESIGN_REVIEW_REQUIRED: '设计草案需先在用例助手中核对。',
  CASE_CONTENT_ALREADY_CONFIRMED: '有用例已在其他页面确认，请刷新后重新选择。',
};

export async function openCaseContentReview({ project, ids, onConfirmed, onError = () => {}, isCurrent = () => true }) {
  const items = pendingReviewItems(project, ids);
  if (!items.length) { onError(Error('当前范围没有待确认用例。')); return; }
  const review = items.filter(item => !item.issue).slice(0, 200), blocked = items.filter(item => item.issue);
  let reviewer = '';
  try { reviewer = (await api(`/api/case-library/projects/${project.project_id}/environment`)).ui?.operator || ''; } catch {}
  if (!isCurrent()) return;
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><section class="modal case-review-dialog" role="dialog" aria-modal="true" aria-label="批量核对用例正文"><header><h2>批量核对用例正文</h2><button class="icon-button" data-review-close aria-label="关闭">×</button></header><div class="modal-body"><p>所选 ${items.length} 条 · 可确认 ${review.length} 条${blocked.length ? ` · ${blocked.length} 条需先补充` : ''}。确认后可返回工作台批量生成脚本。</p>${items.length - blocked.length > 200 ? '<p class="notice warning">单次核对前 200 条，其余保持待确认。</p>' : ''}${blocked.map(item => `<p class="notice warning">${esc(item.content.external_id)}：${esc(item.issue)} · <a data-nav href="#/projects/${project.project_id}/cases/${item.case_id}?tab=content">编辑用例</a></p>`).join('')}<div class="case-review-list">${review.map(item => `<details><summary>${esc(item.content.external_id)} · ${esc(item.content.title)} · v${item.case_version}</summary><p><strong>前置条件：</strong>${esc(item.content.preconditions || '无')}</p><p><strong>测试数据：</strong>${esc(item.content.test_data || '无')}</p><ol>${item.content.steps.map(step => `<li><strong>操作：</strong>${esc(step.action)}<br><strong>预期：</strong>${esc(step.expected)}</li>`).join('')}</ol></details>`).join('')}</div><label class="field">核对人<input data-review-person maxlength="100" value="${esc(reviewer)}"></label><label class="backend-check"><input type="checkbox" data-review-ack> 我已核对本次 ${review.length} 条用例的步骤与预期，确认作为测试依据。</label><p class="muted">确认仅更新内容状态并保留旧版本，不生成脚本、不运行测试。</p><p role="alert" data-review-error></p></div><footer><button class="button" data-review-close>取消</button><button class="button primary" data-review-submit disabled>确认 ${review.length} 条用例</button></footer></section></div>`;
  const dialog = root.firstElementChild, find = selector => dialog.querySelector(selector);
  let sending = false, closed = false;
  const dispose = () => { closed = true; window.removeEventListener('hashchange', dispose); dialog.remove(); };
  const close = () => { if (!sending) dispose(); };
  const live = () => !closed && dialog.isConnected && isCurrent();
  window.addEventListener('hashchange', dispose);
  dialog.querySelectorAll('[data-review-close]').forEach(button => button.onclick = close);
  const valid = () => review.length && find('[data-review-person]').value.trim() && find('[data-review-ack]').checked;
  const update = () => { find('[data-review-submit]').disabled = sending || !valid(); };
  find('[data-review-person]').oninput = update; find('[data-review-ack]').onchange = update;
  find('[data-review-submit]').onclick = async () => {
    if (sending || !valid() || !live()) return;
    sending = true; dialog.querySelectorAll('input,button').forEach(control => control.disabled = true);
    try {
      const updated = await api(`/api/case-library/projects/${project.project_id}/cases/confirm-content`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        revision: project.revision, reviewer: find('[data-review-person]').value.trim(), confirm_content: true,
        items: review.map(({ case_id, case_version, content_sha256 }) => ({ case_id, case_version, content_sha256 })),
      }) });
      const notify = live();
      sending = false; dispose(); if (notify && isCurrent()) await onConfirmed?.(updated);
    } catch (error) {
      if (live()) find('[data-review-error]').textContent = errors[error.code || error.message] || error.message;
    } finally {
      sending = false; if (live()) { dialog.querySelectorAll('input,button').forEach(control => control.disabled = false); update(); }
    }
  };
}
