import { stepAssertions } from './plan-steps.mjs';
import { validateTableOrder, compareTableOrder } from './table-order.mjs';

// Necessary evidence for literal positive order requirements, not general NLP.
// The original source and independent audit remain authoritative.
export function sourceOrderRequirements(original) {
  const result = [];
  for (const obligation of original.obligations ?? []) {
    const text = obligation.text;
    if (typeof text !== 'string' || !original.expected?.includes(text)) continue;
    for (const clause of text.split(/[。；;\n]/u)) {
      const pattern =
        /(?:^|[，,\s])(?:默认)?(?:排序(?:为|是)|(?:表格|表体|列表)(?:按|以))\s*[“「]?([\p{L}\p{N}_ -]{1,24}?)\s*(升序|降序)(?=$|[”」\s，,、]|排列|排序)/gu;
      for (const match of clause.matchAll(pattern)) {
        const field = match[1].trim();
        const direction = match[2] === '升序' ? 'ascending' : 'descending';
        // Reuse the existing source exclusions; never cut a negation/control
        // qualifier from the original sentence to manufacture a new obligation.
        try {
          validateTableOrder(
            { field, column: field, direction, comparison: 'number' },
            {
              action: original.action,
              expected: original.expected,
              quote: clause,
            },
          );
        } catch (error) {
          if (error.code === 'TABLE_ORDER_SOURCE_REQUIRED') continue;
          throw error;
        }
        result.push({ obligation_id: obligation.id, field, direction });
      }
    }
  }
  return result;
}

function completeMatrixWitness(assertion, wanted) {
  const matrix = assertion.expected;
  if (
    assertion.check !== 'table_cells' ||
    matrix?.ordered !== true ||
    matrix.exact_rows !== true ||
    !Array.isArray(matrix.rows) ||
    matrix.rows.length < 2
  )
    return false;
  const columns = [
    ...new Set([
      matrix.key_column,
      ...matrix.rows.flatMap((r) => (r.cells ?? []).map((c) => c.column)),
    ]),
  ];
  if (columns.some((c) => typeof c !== 'string')) return false;
  // This projection is NOT the actual full header inventory. It cannot prove
  // that a suffix is unique or that the exact original header is absent.
  // Only literal fields suffice here; aliases need runtime table_order.
  if (!columns.includes(wanted.field)) return false;
  const column = wanted.field;
  const values = matrix.rows.map((row) => {
    if (matrix.key_column === column) return row.key;
    const cells = (row.cells ?? []).filter((c) => c.column === column);
    // Exact text proves display units too. Numeric/contains projections do not
    // imply a common-unit relation; they may be supplemented by table_order.
    return cells.length === 1 && cells[0].check === 'text' ? cells[0].expected : undefined;
  });
  if (values.some((v) => typeof v !== 'string')) return false;
  return ['identifier', 'number'].some(
    (comparison) =>
      compareTableOrder(
        { headers: [column], rows: values.map((v) => [v]) },
        { field: wanted.field, column, direction: wanted.direction, comparison },
      ).passed,
  );
}

export function orderEvidenceGaps(original, step) {
  const assertions = stepAssertions(step).filter(Boolean);
  return sourceOrderRequirements(original)
    .filter(
      (wanted) =>
        !assertions.some((a) => {
          if (!a.obligation_ids?.includes(wanted.obligation_id)) return false;
          if (a.check === 'table_order') {
            try {
              validateTableOrder(a.expected, {
                action: original.action,
                expected: original.expected,
                quote: a.oracle_quote,
              });
            } catch {
              return false;
            }
            return a.expected.field === wanted.field && a.expected.direction === wanted.direction;
          }
          return completeMatrixWitness(a, wanted);
        }),
    )
    .map((wanted) => ({
      ...wanted,
      reason: `原义务${wanted.obligation_id}要求实际${wanted.field}${wanted.direction === 'ascending' ? '升序' : '降序'}。排序控件的selected_label/value只证明选项，不能证明表体顺序；对当前同一业务表补同义务table_order，或原文已提供身份和值且列名精确等于原字段的完整ordered/exact_rows文本矩阵。矩阵投影不能判断未列出的实际表头，字段后缀映射须用现场table_order。不得从观察复制期望值、另选表、重新查询排序或借其他步骤证据。`,
    }));
}

export const ORDER_EVIDENCE_GUIDANCE =
  'ACTUAL ORDER EVIDENCE: A literal original 排序为X升序/降序 or 表格按X升序/降序 requires the table relation, not only a selected sort control. On completion bind table_order to that SAME obligation, or a source-grounded full ordered/exact_rows matrix whose exact values and exact original field header prove that order. A projected matrix cannot establish suffix uniqueness or absence of the actual exact field header; use runtime table_order for supported suffix mapping. Control-only or not-yet-applied expectations do NOT require applying the selected sort. Never manufacture expected IDs from the observation, substitute a different table, reuse another step timing, replay query/sort, or treat this necessary witness as complete semantic approval.';
