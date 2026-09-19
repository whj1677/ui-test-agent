export function wholeRowTarget(target) {
  if (target?.kind === 'within') return wholeRowTarget(target.target);
  if (target?.kind === 'row') return !target.target || wholeRowTarget(target.target);
  return target?.kind === 'role' && target.role === 'row';
}

function literalRowIntent(assertion, original) {
  if (!['text', 'contains'].includes(assertion.check) || typeof assertion.expected !== 'string')
    return false;
  const unsafe = /不|无须|无需|如果|若|例如|比如|示例|或者|并非|可能|假如|未要求/u;
  const sources = (original.obligations ?? [])
    .filter(
      (o) =>
        assertion.obligation_ids?.includes(o.id) &&
        typeof o.text === 'string' &&
        original.expected?.includes(o.text),
    )
    .map((o) => o.text);
  for (const clause of sources.flatMap((text) => text.split(/[。；;\n]/u))) {
    const match =
      /整行(?:文本|内容)\s*(?:应|必须)?\s*(为|是|等于|包含)\s*[“「"]([^”」"]+)[”」"]/u.exec(clause);
    if (
      !match ||
      unsafe.test(clause.slice(0, match.index) + clause.slice(match.index + match[0].length))
    )
      continue;
    if (
      match[2] === assertion.expected &&
      assertion.check === (match[1] === '包含' ? 'contains' : 'text')
    )
      return true;
  }
  return false;
}

export function requireRowEvidence(assertion, original, observedRow = false) {
  if (!['text', 'contains', 'number'].includes(assertion.check)) return;
  if (!observedRow && !wholeRowTarget(assertion.target)) return;
  if (literalRowIntent(assertion, original)) return;
  throw Object.assign(new Error('ASSERTION_ROW_FIELD_REQUIRED'), {
    code: 'ASSERTION_ROW_FIELD_REQUIRED',
    status: 400,
    plan_feedback: {
      field_path: 'assertion.target',
      reason:
        '完整业务行的文本/数值聚合不证明原指定字段。不要把观察摘要、操作按钮或页面单位拼成预期；在同一原记录key下用cell或table_cells核对原字段及原数值/明确单位。AND须测结果字段中原条件，而非只测控件、行数或ID。仅原步骤明确肯定的整行文本/内容及完整引号字面要求可以保留原整行比较；不得改原预期、归一化新预期或重放查询。',
    },
  });
}

export const ROW_EVIDENCE_GUIDANCE =
  'ROW FIELD EVIDENCE: A whole native/ARIA row text summary is NOT a bound field assertion. Do not copy/join observed row text into expected, including observed separators, units or action labels. For field requirements use SAME original record key and column with cell/table_cells, original values and supported numeric projection; keep every required condition and original timing. For query AND semantics, measure the original filter conditions on the returned record fields in THAT step. Control input values, record count or expected ID alone do not prove every filter field. Do not add other fields merely because visible. Whole-row scalar text/contains is only for an explicit positive original 整行文本/内容为/是/等于/包含 followed by the complete quoted literal; preserve its predicate and literal unchanged. Such a literal row assertion still does not acquire field identity. Neither advisory whole_table_row metadata nor any other syntax tag establishes coverage or runtime truth. Unsupported original wording remains a capability gap, not permission to rewrite the case, normalize a copied expected string, or replay query.';
