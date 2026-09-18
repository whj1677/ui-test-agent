import { semanticHash } from './common.mjs';

const generic =
  /^(?:返回|关闭|取消|保存|提交|确定|菜单|首页|工作台|设置|back|close|cancel|save|submit|menu|home|settings)$/iu;
function named(value, reason) {
  return (
    typeof value === 'string' &&
    value.trim().length >= 2 &&
    !generic.test(value.trim()) &&
    reason.toLowerCase().includes(value.trim().toLowerCase())
  );
}
const evidenceErrors = new Set(['PLAN_SCOPE_EVIDENCE_MISSING']);
// Text is only a conservative routing hint after a structured blocked/audit
// result. A broad expectation (including “所有”) is never itself a missing fact.
const missingEvidence = (reason) =>
  /(?:缺少|缺失|缺乏|未找到|未观察|未采集|未提供|未取得|没有|不足|missing|unobserved|not observed|not found|unavailable)/iu.test(
    reason,
  ) &&
  /(?:定位|控件|输入框|选择器|快照|DOM|页面.{0,12}(?:证据|事实)|表格.{0,12}(?:证据|事实)|(?:技术|绑定|范围|运行时).{0,12}(?:证据|事实)|locator|selector|snapshot|control|binding|runtime evidence)/iu.test(
    reason,
  );
const boundaryReason = (reason) =>
  /(?:授权|权限|登录|认证|凭据|密码|验证码|生产环境|跨域|外部站点|写入|删除|清理|业务(?:歧义|规则|决定)|预期(?:值|不清|未明确)|验收(?:标准|判定)|\b(?:auth\w*|permission|credentials?|password|login|sign.in|cross.origin|production|write|mutation|delete|cleanup|oracle)\b)/iu.test(
    reason,
  );

/** Routing is neither proof of a business issue nor permission to execute.
 * Unknown obstacles stay blocked; recovery still uses the existing browser,
 * authorization, candidate, evidence and progress gates. */
export function preparationGap({ code = '', reason = '', blockAudit, planAudit } = {}) {
  const gap = (kind, diagnosis) => ({ kind, code: diagnosis });
  if (/AUTH|PERMISSION|WRITE_NOT_AUTHORIZED|ORACLE_UNCLEAR|PAGE_EVIDENCE_INCOMPLETE/u.test(code))
    return gap('BOUNDARY_REQUIRES_INPUT', code);
  if (blockAudit?.outcome === 'NEEDS_CLARIFICATION' || code === 'INPUT_REVIEW_REQUIRED')
    return gap('BOUNDARY_REQUIRES_INPUT', 'INPUT_REVIEW_REQUIRED');
  if (blockAudit?.validation_error)
    return gap('BOUNDARY_REQUIRES_INPUT', blockAudit.validation_error);
  if (evidenceErrors.has(code)) return gap('TARGETED_EVIDENCE', code);
  if (
    /^(?:INVALID_|ASSERTION_|ACTION_|CLEANUP_SCOPE_IDENTITY|OPTIONAL_DIALOG_(?:SCHEMA|SOURCE|CLEANUP)|PLAN_(?:CONDITIONAL|OBSTRUCTION|ASSERTION|ROW_IDENTITY|SCOPE_IDENTITY|RECORD_FIELD)|LOCATOR_EXACT|UNSAFE_CSS)/u.test(
      code,
    )
  )
    return gap('PLAN_REPAIR_ONLY', code);
  if (code === 'MODEL_MAPPING_BLOCKED') {
    if (boundaryReason(reason) || boundaryReason(blockAudit?.reason ?? ''))
      return gap('BOUNDARY_REQUIRES_INPUT', 'BLOCKED_BOUNDARY');
    // Exact, validated control/binding evidence can justify a bounded candidate
    // repair. Merely citing an entry URL cannot fill a missing control fact.
    const binding = blockAudit?.evidence_refs?.some((ref) =>
      ['control', 'dynamic_row_binding', 'wizard_context'].includes(ref.fact?.kind),
    );
    if (blockAudit?.outcome === 'REPAIR' && binding)
      return gap('PLAN_REPAIR_ONLY', 'GROUNDED_BLOCK_REPAIR');
    if (['BLOCKED', 'REPAIR'].includes(blockAudit?.outcome) && missingEvidence(reason))
      return gap('TARGETED_EVIDENCE', 'TECHNICAL_EVIDENCE_MISSING');
  }
  if (code === 'PLAN_SEMANTIC_GAP') {
    const issues = planAudit?.issues ?? [];
    if (issues.some((issue) => issue.code === 'CLEANUP_UNSAFE'))
      return gap('BOUNDARY_REQUIRES_INPUT', 'CLEANUP_UNSAFE');
    if (issues.some((issue) => ['ORACLE_UNCLEAR', 'PLAN_REVIEW_UNRESOLVED'].includes(issue.code)))
      return gap('PLAN_REPAIR_ONLY', 'PLAN_REVIEW_UNRESOLVED');
    const locatorGaps = issues.filter((issue) => issue.code === 'LOCATOR_UNSUPPORTED');
    if (locatorGaps.some((issue) => boundaryReason(issue.reason)))
      return gap('BOUNDARY_REQUIRES_INPUT', 'BLOCKED_BOUNDARY');
    if (locatorGaps.some((issue) => missingEvidence(issue.reason)))
      return gap('TARGETED_EVIDENCE', 'TECHNICAL_EVIDENCE_MISSING');
  }
  return gap('PLAN_REPAIR_ONLY', code || 'UNCLASSIFIED_BLOCK');
}

export function recoveryKind(row) {
  const attempt = row.self_repair?.rounds?.at(-1);
  // A repeated candidate, failed recovery or interrupted attempt on unchanged
  // input is not a new recovery opportunity when the user clicks prepare again.
  if (
    row.self_repair?.outcome === 'EXHAUSTED' ||
    ['PLAN_REPAIR_NO_PROGRESS', 'PLAN_REPAIR_LIMIT'].includes(attempt?.code) ||
    (row.preparation_budget?.used ?? 0) >= 3 ||
    (row.evidence_recoveries?.length ?? 0) >= 2 ||
    row.evidence_recoveries?.some(
      (recovery) =>
        recovery.parent_input_hash &&
        recovery.parent_input_hash === row.self_repair?.input_hash &&
        recovery.status !== 'NEW_EVIDENCE',
    )
  )
    return 'PLAN_REPAIR_ONLY';
  return preparationGap({
    code: attempt?.code,
    reason: attempt?.reason ?? row.mapping_reason ?? '',
    blockAudit: attempt?.block_audit,
    planAudit: row.plan_audit?.plan_hash === attempt?.plan_hash ? row.plan_audit : undefined,
  }).kind;
}
function relevant(locator, name, reason) {
  return (
    named(name, reason) ||
    named(locator?.column, reason) ||
    named(locator?.key?.value, reason) ||
    named(locator?.scope?.name, reason) ||
    named(locator?.scope?.heading, reason) ||
    named(locator?.target?.name, reason)
  );
}
// Only binding facts for the diagnosed gap. Not whole-page text, values, timestamps,
// expanded menus, unrelated routes, or the mere arrival of another snapshot.
export function recoveryEvidence(pages, reason = '') {
  const facts = new Set();
  for (const page of pages ?? []) {
    if (page.login_page || page.network_issues?.length) continue;
    for (const control of page.controls ?? []) {
      if (
        !control.locator ||
        ['navigation', 'menuitem', 'link', 'treeitem'].includes(control.role) ||
        control.in_navigation
      )
        continue;
      if (relevant(control.locator, control.name, reason))
        facts.add(
          semanticHash({ url: page.url, locator: control.locator, role: control.role ?? null }),
        );
    }
  }
  return [...facts].sort();
}
export function usefulProbe(probe, reason = '') {
  return (
    probe.count === 1 &&
    probe.visible === true &&
    relevant(probe.locator, probe.locator?.name ?? probe.locator?.value, reason)
  );
}
