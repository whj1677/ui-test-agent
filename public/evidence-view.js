// Read-only presentation shared by the console and offline report.
const escape = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const sameStep = (id) => (v) => v.step_id === id;

export function stepOutcome(fact, stepId) {
  const match = sameStep(stepId);
  const observations = [
    ...(fact?.assertions ?? []),
    ...(fact?.relational_observations ?? []),
  ].filter(match);
  const actions = (fact?.actions ?? []).filter(match);
  const checkpoints = (fact?.checkpoints ?? []).filter(match);
  const segments = (fact?.adaptive_segments ?? []).filter(match);
  const completion = (fact?.adaptive_steps ?? []).some((s) => match(s) && s.status === 'COMPLETE');
  const adaptive =
    !!fact && (Object.hasOwn(fact, 'adaptive_steps') || Object.hasOwn(fact, 'adaptive_segments'));
  const attempted =
    observations.length > 0 ||
    actions.length > 0 ||
    segments.length > 0 ||
    completion ||
    checkpoints.some((p) => p.status !== 'NOT_EXECUTED');
  const missingCompletion = adaptive && attempted && !completion;
  const failed =
    observations.some((a) => a.passed === false || a.group_passed === false) ||
    checkpoints.some((p) => p.status === 'FAIL_ASSERTION');
  const passed =
    observations.length > 0 &&
    observations.every((a) => a.passed === true && a.group_passed !== false) &&
    !missingCompletion &&
    checkpoints.every((p) => p.status === 'ASSERTIONS_PASSED');
  const status = failed ? 'FAIL' : passed ? 'PASS' : attempted ? 'INCOMPLETE' : 'NOT_EXECUTED';
  const error =
    status === 'INCOMPLETE' || status === 'FAIL'
      ? (segments.findLast((s) => s.error)?.error ??
        checkpoints.findLast((p) => p.error)?.error ??
        fact?.error)
      : null;
  return {
    status,
    missingCompletion,
    observations,
    error,
    label: {
      PASS: '通过 · 断言满足',
      FAIL: '失败 · 断言不一致',
      INCOMPLETE: '未完成 · 不能判通过',
      NOT_EXECUTED: '未执行',
    }[status],
    passedChecks: observations.filter((a) => a.passed === true && a.group_passed !== false).length,
  };
}

const value = (v) => (v == null ? '未记录' : typeof v === 'object' ? JSON.stringify(v) : String(v));
export function renderEvidenceSteps(fact, fallbackCase) {
  // Historical runs must use the case frozen at execution, not a later edit.
  const steps = fact?.executed_case?.steps ?? fallbackCase?.steps ?? [];
  const outcomes = steps.map((s) => ({ step: s, ...stepOutcome(fact, s.step_id) }));
  const counts = (status) => outcomes.filter((s) => s.status === status).length;
  return `<section class="execution-results" aria-label="原步骤执行结果"><h3>原步骤结果</h3><p class="result-counts">通过 ${counts('PASS')} · 失败 ${counts('FAIL')} · 未完成 ${counts('INCOMPLETE')} · 未执行 ${counts('NOT_EXECUTED')}</p><p class="result-note">这是本次执行的最终记录，不随播放进度变化。部分检查满足不代表整步通过。</p>${steps.length ? `<ol class="result-steps">${outcomes.map((s) => `<li data-step-result="${s.status}"><details${s.status === 'FAIL' || s.status === 'INCOMPLETE' ? ' open' : ''}><summary><span class="result-label result-${s.status.toLowerCase()}">${escape(s.label)}</span><span>步骤 ${escape(s.step.step_id)} · ${escape(s.step.action)}</span></summary><p><strong>原预期：</strong>${escape(s.step.expected ?? '未填写')}</p>${s.status === 'NOT_EXECUTED' ? '<p>没有该步骤的执行记录，不计作产品失败。</p>' : `<p>已记录检查 ${s.observations.length} 项，其中 ${s.passedChecks} 项满足（不代表预期覆盖率）。</p>`}${s.error ? `<p class="result-error">停止原因：${escape(s.error)}</p>` : ''}${s.observations.length ? `<details class="measurement-details"><summary>查看 ${s.observations.length} 项检查明细</summary>${s.observations.map((a) => `<p class="result-observation"><strong>${a.passed === false ? '本项不一致' : a.passed === true ? '本项满足' : '待核实'}${a.group_passed === false ? '（整组未满足）' : ''}</strong> · ${escape(a.oracle_quote ?? a.check ?? '页面检查')}<br>期望：${escape(value(a.expected))}<br>实际：${escape(value(a.actual))}</p>`).join('')}</details>` : ''}</details></li>`).join('')}</ol>` : '<p>该历史记录没有原步骤快照，请查看原始事实；不推测步骤结论。</p>'}</section>`;
}
