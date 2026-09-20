import { stepAssertions } from './plan-steps.mjs';

// Only an explicitly stated current page, not a derived page-size/ID formula.
// Full N/T literals retain the existing coverage path, including their total.
const positiveClause = (clause) =>
  !/不|未|无需|如果|若|例如|比如|示例|或者|除|至|前往|可跳转|按钮|链接|选项|输入框|控件|标题|曾经|之前|此前|上一步|历史|操作前/u.test(
    clause.replace(/[A-Za-z]+\d+\s*至\s*[A-Za-z]+\d+/gu, ''),
  );
export function currentPageRequirements(original) {
  const explicit = String(original.expected ?? '')
    .split(/[，,。；;\n]/u)
    .filter(positiveClause)
    .flatMap((clause) => [...clause.matchAll(/第\s*(\d+)\s*\/\s*(\d+)\s*页/gu)])
    .filter(
      (m) =>
        Number.isSafeInteger(Number(m[1])) &&
        Number.isSafeInteger(Number(m[2])) &&
        Number(m[1]) > 0 &&
        Number(m[2]) >= Number(m[1]),
    )
    .map((m) => Number(m[1]));
  const result = [];
  for (const o of original.obligations ?? []) {
    if (typeof o.text !== 'string' || !original.expected?.includes(o.text)) continue;
    for (const clause of o.text.split(/[，,。；;\n]/u)) {
      if (!positiveClause(clause)) continue;
      for (const m of clause.matchAll(
        /(?:默认|当前|回到|返回|进入|恢复(?:到)?|分页显示|显示|位于)\s*第\s*(\d+)\s*页/gu,
      )) {
        const current = Number(m[1]);
        if (Number.isSafeInteger(current) && current > 0 && !explicit.includes(current))
          result.push({ obligation_id: o.id, current, quote: m[0] });
      }
    }
  }
  return result;
}

function appropriateTarget(target, observedRole) {
  while (target?.kind === 'within' && target.target) target = target.target;
  if (!target || ['row', 'cell', 'label', 'placeholder'].includes(target.kind)) return false;
  const prohibited = [
    'table',
    'row',
    'cell',
    'button',
    'link',
    'menuitem',
    'textbox',
    'combobox',
    'spinbutton',
  ];
  return (
    !prohibited.includes(observedRole) &&
    !(target.kind === 'role' && prohibited.includes(target.role))
  );
}

function measures(assertion, wanted) {
  return (
    appropriateTarget(assertion.target) &&
    ((assertion.check === 'contains' && assertion.expected === `第${wanted.current}/`) ||
      (['text', 'contains'].includes(assertion.check) &&
        assertion.expected === `第${wanted.current}页`))
  );
}

export function requireCurrentPageAssertion(assertion, original, observedRole) {
  if (!['text', 'contains'].includes(assertion.check) || typeof assertion.expected !== 'string')
    return;
  if (!/第\s*\d+\s*(?:\/|页)/u.test(assertion.expected)) return;
  const sources = currentPageRequirements(original).filter((p) =>
    assertion.obligation_ids?.includes(p.obligation_id),
  );
  if (!sources.length) return;
  if (!sources.some((p) => measures(assertion, p))) {
    const code = appropriateTarget(assertion.target, observedRole)
      ? 'PLAN_CURRENT_PAGE_SOURCE_INVALID'
      : 'ADAPTIVE_TARGET_PAGE_MISMATCH';
    throw Object.assign(new Error(code), {
      code,
      status: 400,
      plan_feedback: {
        field_path: 'assertion',
        reason:
          '原义务只给当前页，没有总页数。针对独立当前页码文字用contains“第N/”（斜线是数字边界，不含总数），或页面实际采用独立格式时text/contains“第N页”，N保持原值；不能复制观察的总页数、用第N无边界子串、表格记录或翻页/输入控件替代，不重放导航。',
      },
    });
  }
  if (!appropriateTarget(assertion.target, observedRole))
    throw Object.assign(new Error('ADAPTIVE_TARGET_PAGE_MISMATCH'), {
      code: 'ADAPTIVE_TARGET_PAGE_MISMATCH',
      status: 400,
      plan_feedback: {
        field_path: 'assertion.target',
        reason:
          '当前DOM是表格/数据行/交互控件，不是独立当前页码文字。保持原N，重新绑定当前页码文字，不点击或重放导航。',
      },
    });
}

export function currentPageEvidenceGaps(original, step) {
  const assertions = stepAssertions(step);
  return currentPageRequirements(original)
    .filter(
      (p) => !assertions.some((a) => a.obligation_ids?.includes(p.obligation_id) && measures(a, p)),
    )
    .map((p) => ({
      ...p,
      reason: `原义务${p.obligation_id}的“${p.quote}”尚缺当前步骤页码测量。编号范围、标题和下一页按钮不能证明第${p.current}页；用当前独立页码文字contains“第${p.current}/”或实际独立格式text/contains“第${p.current}页”，不猜总页数，不借后续步骤，不重放已执行导航。`,
    }));
}

export const CURRENT_PAGE_GUIDANCE =
  'CURRENT PAGE WITHOUT TOTAL: An explicit original 默认/当前/回到第N页 needs a same-step current-page measurement, not only matching table IDs or a navigation button. If the original does not specify total pages, do not copy the observed denominator into expected. For a Chinese N/T pager, use contains with exactly 第N/ (slash bounds the original integer), or text/contains 第N页 when that is the actual standalone display format. Bind the observed independent counter, never the table, page-jump input or an available numbered navigation button. Preserve explicit original N/T requirements on the existing full-counter path. Do not borrow a later step, change N to the observation, guess totals or replay navigation. Unknown pagination representations remain a capability gap; this necessary witness does not replace independent object/timing audit.';
