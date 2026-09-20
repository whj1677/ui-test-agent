import { stepActions, stepAssertions } from './plan-steps.mjs';
import { semanticHash } from './common.mjs';
import { extractRowPositions, rowPositionSourceGaps } from './table-position.mjs';
import { needsTableBaseline } from './table-invariant.mjs';
import { visibilityEvidenceGaps } from './expectation-visibility.mjs';
import { orderEvidenceGaps } from './order-evidence.mjs';
import { currentPageEvidenceGaps } from './page-index-evidence.mjs';
import { uniqueRowEvidenceGaps } from './unique-row-evidence.mjs';
import { contractIssues } from './expectation-contract.mjs';

// Necessary structural evidence only. The same list drives the original
// completion guard and advisory rejection feedback. Never approves execution,
// validates malformed plans, supplies a target, or proves actual measurements.
// Keep checkpoints intact: joint requirements must not combine distinct samples.
export function completionIssues(
  original,
  step,
  { adaptiveReadonly = false, nextTarget, fieldPath = 'plan.step' } = {},
) {
  const issues = [];
  const add = (code, field_path, reason, detail = {}) =>
    issues.push({ code, field_path, reason, ...detail });
  if (adaptiveReadonly) {
    for (const issue of contractIssues(original, step))
      issues.push({ ...issue, field_path: fieldPath + '.assertions' });
    const uniqueGaps = uniqueRowEvidenceGaps(original, step);
    if (uniqueGaps.length)
      add(
        'PLAN_UNIQUE_ROW_UNPROVEN',
        fieldPath + '.assertions',
        `原唯一记录${uniqueGaps.map((g) => g.key).join('、')}缺同表同检查点的身份+数量1证据，或单行闭合矩阵。仅键唯一/排除另一个键/以前步骤的数量不能替代；保留原字段和来源，不重放动作。`,
      );
    const positionSourceGaps = rowPositionSourceGaps(original.expected);
    if (positionSourceGaps.length)
      add(
        'PLAN_ROW_POSITION_SOURCE_UNRESOLVED',
        fieldPath + '.assertions',
        positionSourceGaps.join('\n'),
      );
    const orderGaps = orderEvidenceGaps(original, step);
    const pageGaps = currentPageEvidenceGaps(original, step);
    if (pageGaps.length)
      add(
        'PLAN_CURRENT_PAGE_UNPROVEN',
        fieldPath + '.assertions',
        pageGaps.map((g) => g.reason).join('\n'),
      );
    if (orderGaps.length)
      add(
        'PLAN_TABLE_ORDER_UNPROVEN',
        fieldPath + '.assertions',
        orderGaps.map((g) => g.reason).join('\n'),
      );
    const visibilityGaps = visibilityEvidenceGaps(original, step);
    if (visibilityGaps.length)
      add(
        'PLAN_VISIBILITY_UNPROVEN',
        fieldPath + '.assertions',
        visibilityGaps.map((gap) => `${gap.obligation_id}: ${gap.reason}`).join('\n'),
      );
    for (const obligation of original.obligations ?? []) {
      for (const wanted of extractRowPositions(obligation.text)) {
        if (
          !stepAssertions(step).some(
            (a) =>
              a.check === 'table_cells' &&
              a.obligation_ids?.includes(obligation.id) &&
              a.expected.rows.some(
                (row) => row.key === wanted.key && row.position === wanted.position,
              ),
          )
        )
          add(
            'PLAN_ROW_POSITION_UNPROVEN',
            fieldPath + '.assertions',
            `原义务要求${wanted.key}位于第${wanted.position}行。成员存在、单元格值或相对ordered不证明绝对位置；须在同一已观察表格的table_cells中为原身份提供position。不得增加全表仅这些行、修改原位置或重放动作。`,
            { source_ref: obligation.id, ...wanted },
          );
      }
    }
  }
  for (const obligation of original.obligations ?? []) {
    if (
      adaptiveReadonly &&
      needsTableBaseline(obligation.text) &&
      !stepAssertions(step).some(
        (a) => a.check === 'table_unchanged' && a.obligation_ids?.includes(obligation.id),
      )
    )
      add(
        'PLAN_RELATION_UNPROVEN',
        fieldPath + '.assertions',
        '原预期要求表格在操作前后保持不变，须用table_unchanged比较本步骤操作前完整快照；当前行数、固定当前值或模型观察不构成该关系证据。',
      );
  }
  for (const obligation of original.obligations ?? []) {
    if (!/(?:页面|当前|浏览器)\s*URL|地址栏|(?:current|browser|page)\s+URL/iu.test(obligation.text))
      continue;
    const proofs = stepAssertions(step).filter((a) => a.obligation_ids?.includes(obligation.id));
    if (!proofs.some((a) => ['url_equals', 'url_contains', 'url_not_contains'].includes(a.check)))
      add(
        'PLAN_URL_UNPROVEN',
        fieldPath + '.assertions',
        '原预期要求验证当前地址栏。标题或页面可见不能证明URL；使用url_equals/url_contains/url_not_contains并保留原分项。',
      );
  }
  const optionalSource =
    /(?:若|如果|if).*?(?:出现|显示|present|visible)/iu.test(original.action) &&
    /(?:知道了|关闭|取消|got it|close|cancel)/iu.test(original.action) &&
    /(?:未|不|否则|otherwise|else)/iu.test(original.action);
  if (optionalSource && !stepActions(step).some((a) => a?.op === 'dismiss_optional'))
    add(
      'PLAN_CONDITIONAL_UNSUPPORTED',
      fieldPath + '.actions',
      '原步骤要求提示出现则关闭、未出现则继续；不能删去条件动作或改成无条件点击/等待。使用dismiss_optional，由原文精确标题和按钮名定义条件，保留两个分支共同的原预期。',
    );
  for (const obligation of original.obligations ?? []) {
    if (
      !/(?:无|没有|不|未).*?(?:遮挡|阻挡)|unobstructed|not obstruct|not block/iu.test(
        obligation.text,
      )
    )
      continue;
    const proofs = stepAssertions(step).filter((a) => a.obligation_ids?.includes(obligation.id));
    if (!proofs.some((a) => a.check === 'unobstructed'))
      add(
        'PLAN_OBSTRUCTION_UNPROVEN',
        fieldPath + '.assertions',
        'visible/hidden/count不能证明操作不被遮挡。用unobstructed对后续原操作的准确已观察目标做当前命中验证，不修改原预期。',
      );
    if (
      optionalSource &&
      (!nextTarget ||
        !proofs.some(
          (a) => a.check === 'unobstructed' && semanticHash(a.target) === semanticHash(nextTarget),
        ))
    )
      add(
        'PLAN_OBSTRUCTION_UNPROVEN',
        fieldPath + '.assertions',
        '条件提示后的无遮挡断言必须绑定后续原操作的同一个目标（含业务行身份）；表格或其他菜单命中不能代替该目标。',
      );
  }
  return issues;
}
