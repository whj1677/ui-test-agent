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
export function recoveryKind(row) {
  const code = row.self_repair?.rounds?.at(-1)?.code ?? '';
  if (
    /^(?:INVALID_|ASSERTION_|ACTION_|OPTIONAL_DIALOG_(?:SCHEMA|SOURCE|CLEANUP)|PLAN_(?:CONDITIONAL|OBSTRUCTION|ASSERTION|ROW_IDENTITY|RECORD_FIELD)|LOCATOR_EXACT|UNSAFE_CSS)/u.test(
      code,
    )
  )
    return 'PLAN_REPAIR_ONLY';
  if (/AUTH|PERMISSION|WRITE_NOT_AUTHORIZED|ORACLE_UNCLEAR|PAGE_EVIDENCE_INCOMPLETE/u.test(code))
    return 'BOUNDARY_REQUIRES_INPUT';
  return 'TARGETED_EVIDENCE';
}
function relevant(locator, name, reason) {
  return (
    named(name, reason) ||
    named(locator?.column, reason) ||
    named(locator?.key?.value, reason) ||
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
