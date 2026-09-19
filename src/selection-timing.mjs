import { semanticHash } from './common.mjs';
import { stepCheckpoints } from './plan-steps.mjs';

const leaf = (target) => (target?.kind === 'within' ? target.target : target);
function positiveSwitch(action, name) {
  return String(action ?? '')
    .split(/[，,；;。\n]/u)
    .some((clause) => {
      if (/(?:不|未|无需|不要|禁止|如果|若|假如|例如|比如|示例|或)/u.test(clause)) return false;
      const literal = clause.replace(/[“”「」"]/gu, '');
      return ['切换到', '切换至', '切回', '点击', '选择'].some((verb) =>
        ['页签', '标签页'].some((suffix) => literal.includes(verb + name + suffix)),
      );
    });
}

// A narrow ordering check, not a semantic approval or a comparison with current
// selection. No current DOM value is used to change an oracle or grant retries.
export function selectionTimingGaps(original, step) {
  if (/(?:操作前|切换前|点击前|切回前|默认|初始)/u.test(original.expected ?? '')) return [];
  const clicks = new Set(),
    gaps = [];
  for (const [pointIndex, point] of stepCheckpoints(step).entries()) {
    for (const action of point.actions ?? [])
      if (action?.op === 'click') clicks.add(semanticHash(action.target));
    for (const [index, a] of (point.assertions ?? []).entries()) {
      const tab = leaf(a.target);
      if (
        a.check !== 'aria_selected' ||
        a.expected !== true ||
        tab?.kind !== 'role' ||
        tab.role !== 'tab' ||
        tab.exact !== true ||
        typeof tab.name !== 'string' ||
        !tab.name ||
        !positiveSwitch(original.action, tab.name)
      )
        continue;
      if (!clicks.has(semanticHash(a.target)))
        gaps.push({
          checkpoint_index: pointIndex,
          assertion_index: index,
          reason: `原步骤要求切换到${tab.name}页签；当前候选在本步骤对应同目标切换动作之前检查选中=true，时机错误。先按原动作提交该页签合法click，再测动作后状态/原字段；或只保留有原文依据的当前测量。前一步/其他对象/未来动作不算，不能从当前值修改预期、补造原业务规则或重放已执行切换。若已执行但定位表达不同，复用其相同目标绑定，不再点击。`,
        });
    }
  }
  return gaps;
}

export const SELECTION_TIMING_GUIDANCE =
  "ACTION/POSTCONDITION ORDER: If this original step asks to switch back/to tab X, do not assert X selected=true before actually performing that step's switch. Observation that X is currently unselected is not an application defect before the action. Current assertions are original business checks, not a way to invent preparatory expectations. Propose the permitted switch first, then measure original postconditions/fields in the same or subsequent fragment; do not replay an already dispatched switch. Original default/initial or explicit pre-action selection requirements must still be measured as written, without clicking to manufacture them. A real unselected tab AFTER its authorized switch still fails, never retry it into a pass. Every supplied partial-fragment assertion must have valid source and timing; ASSERTION_GAP for future fields does not permit premature or extra assertions.";
