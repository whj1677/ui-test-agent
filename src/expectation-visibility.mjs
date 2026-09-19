import { semanticHash } from './common.mjs';
import { stepActions, stepAssertions } from './plan-steps.mjs';

// Necessary witnesses for a deliberately bounded, positive source grammar.
// No label inference, DOM identity proof, semantic approval or runtime result.
const same = (a, b) => semanticHash(a) === semanticHash(b);
const isTrue = (value) => value === undefined || value === true;
const leaf = (target) => (target?.kind === 'within' ? target.target : target);
const named = (target) => {
  const t = leaf(target);
  if (t?.kind === 'role' && ['heading', 'region', 'dialog'].includes(t.role) && t.exact === true)
    return t.name;
  if (t?.kind === 'text' && t.exact === true) return t.value;
  return undefined;
};
const dialogScope = (target) =>
  target?.kind === 'within' && target.scope?.role === 'dialog' ? target.scope : undefined;
function wholeDialog(target, scope) {
  if (target?.kind === 'within') return !target.target && same(target.scope, scope);
  return (
    target?.kind === 'role' &&
    target.role === 'dialog' &&
    target.exact === true &&
    scope.exact === true &&
    scope.heading === undefined &&
    target.name === scope.name
  );
}

export function visibilityEvidenceGaps(original, step) {
  const assertions = stepAssertions(step),
    gaps = [];
  for (const obligation of original.obligations ?? []) {
    if (/(?:例如|比如|示例|不要求|无需|并非要求|或者|或是)/u.test(obligation.text)) continue;
    const proofs = assertions.filter((a) => a.obligation_ids?.includes(obligation.id));
    // This specific positive prefix contains a visibility clause BEFORE an
    // even-if distractor. The distractor's value is never made mandatory.
    const match = /^可见(?:的)?[“「]?([\p{L}\p{N}_ -]{1,32}?)[”」]?\s*即使/u.exec(
      obligation.text.trim(),
    );
    if (match) {
      const name = match[1].trim();
      const fields = proofs.filter(
        (a) => a.target?.kind === 'within' && a.target.target?.kind === 'definition',
      );
      const visible = proofs.some(
        (a) =>
          a.check === 'visible' &&
          isTrue(a.expected) &&
          named(a.target) === name &&
          (!fields.length ||
            fields.some(
              (f) => a.target?.kind === 'within' && same(a.target.scope, f.target.scope),
            )),
      );
      if (!visible)
        gaps.push({
          obligation_id: obligation.id,
          kind: 'named_visibility',
          name,
          reason: `原条款“${obligation.text}”还含${name}可见要求。自身字段值证明不了备注/区域可见；须对当前观察中该名称的准确只读目标单独visible，并绑定本义务及同对象范围。不要求即使之后的干扰值出现，不改字段预期。`,
        });
    }
    // Only a literal approved close button inside its bound dialog, AND the
    // same original step's positive closed-state expectation. Conditional or
    // negative actions remain outside this small grammar.
    if (/(?:不|未|无需|不要|禁止|如果|若|假如|例如|比如|或)/u.test(original.action ?? '')) continue;
    for (const action of stepActions(step)) {
      if (!action) continue;
      const t = leaf(action.target),
        scope = dialogScope(action.target);
      if (
        action.op !== 'click' ||
        !scope ||
        t?.kind !== 'role' ||
        t.role !== 'button' ||
        t.exact !== true
      )
        continue;
      const close = /^关闭([\p{L}\p{N}_ -]{1,32})$/u.exec(t.name ?? '');
      if (!close || !(original.action ?? '').includes(t.name)) continue;
      const subject = close[1].trim();
      const source = obligation.text.trim();
      if (/(?:如果|若|假如|是否|可能|或)/u.test(source)) continue;
      if (!source.startsWith(subject + '关闭后') && !source.startsWith(subject + '已关闭'))
        continue;
      if (
        !proofs.some(
          (a) =>
            wholeDialog(a.target, scope) &&
            ((a.check === 'hidden' && isTrue(a.expected)) ||
              (a.check === 'count' && a.expected === 0)),
        )
      )
        gaps.push({
          obligation_id: obligation.id,
          kind: 'closed_dialog',
          scope: structuredClone(scope),
          reason: `原条款“${obligation.text}”要求关闭后的状态。点击${t.name}或背景列表可读不能证明弹窗消失；须对原关闭动作绑定的同一完整dialog单独hidden，或准确同对象count=0，并绑定本义务。关闭按钮隐藏/另一个弹窗不算；不得重放关闭或改原预期。`,
        });
    }
  }
  return gaps;
}

export const VISIBILITY_EVIDENCE_GUIDANCE =
  'COMPOUND VISIBILITY/CLOSURE: A source clause such as 可见X即使... contains X visibility BEFORE the conditional distractor. Measure the named X separately with visible in the same applicable object scope; a field value jointly supports only the field/source restriction, not the visibility clause. For an explicit close action followed by a closed-state expectation, include hidden (or exact-object count=0) for that same whole dialog. A dispatched close, hidden close button or readable background list is not proof of a closed dialog. Preserve current source IDs and earlier executed actions; add only missing witnesses, never replay closing. Unsupported wording still requires independent semantic audit; these necessary checks do not establish complete coverage.';
