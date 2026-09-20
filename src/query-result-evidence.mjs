import { canonicalJSON } from './common.mjs';
import { stepAssertions } from './plan-steps.mjs';
import { sourceTableCounts } from './table-cardinality.mjs';

// A bounded necessary-evidence check, not a query-language interpreter. Only
// original input clauses supply values; observations and later steps never do.
function inputClauses(text) {
  const conditions = [];
  let unresolved = false;
  for (const clause of String(text)
    .split(/[，,。；;\n]/u)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!/输入|填写|填入|选择|选为/u.test(clause)) {
      if (!/^保持排序(?:为|是)/u.test(clause)) unresolved = true;
      continue;
    }
    const m =
      /^(?:在|将|把)?\s*[「“"]([^」”"]{1,40})[」”"]\s*(?:框|下拉框)?\s*(输入|填写|填入|选择|选为)\s*[:：]?\s*(?:[「“"]([^」”"]{1,200})[」”"]|([^「」“”"]{1,200}))$/u.exec(
        clause,
      );
    if (!m) {
      unresolved = true;
      continue;
    }
    const label = m[1].trim(),
      value = (m[3] ?? m[4]).trim();
    if (/排序|sort/iu.test(label)) continue;
    if (
      !value ||
      (/输入|填写|填入/u.test(m[2]) && !/关键词|关键字|keyword/iu.test(label)) ||
      /^(?:全部|所有|不限)$/u.test(value) ||
      (!m[3] && /然后|并且|或者|保持|不要|无需|不再|再点击/u.test(value)) ||
      conditions.some((c) => c.label === label)
    ) {
      unresolved = true;
      continue;
    }
    conditions.push({
      label,
      value,
      kind: /关键词|关键字|keyword/iu.test(label) ? 'keyword' : 'literal',
      source_quote: clause,
    });
  }
  return { conditions, unresolved: unresolved || conditions.length > 8 };
}

export function sourceQueryRequirements(c, original) {
  const obligations = (original.obligations ?? []).filter((o) => {
    if (typeof o.text !== 'string' || !original.expected?.includes(o.text)) return false;
    return o.text
      .split(/[。；;\n]/u)
      .some(
        (clause) =>
          /(?:^|[，,\s])(?:查询)?(?:所有|各个)?条件(?:按|以)\s*AND\s*(?:生效|组合生效)/iu.test(
            clause,
          ) && !/不|无需|如果|若|例如|比如|示例|或者|未/u.test(clause),
      );
  });
  if (!obligations.length) return [];
  const query = /(?:^|[，,。；;\s])点击\s*[「“"](?:查询|搜索|筛选|过滤)[」”"]/u.exec(
    original.action,
  );
  if (!query)
    return obligations.map((o) => ({ obligation_id: o.id, conditions: [], unresolved: true }));
  const before = original.action.slice(0, query.index).trim();
  const i = c.steps.findIndex((s) => s.step_id === original.step_id);
  // No skipping over navigation/reset/query or borrowing an earlier/future state.
  const prior = i > 0 ? c.steps[i - 1].action : '';
  const source = before || (!/点击|打开|进入|查询|搜索|重置|清空|导航/u.test(prior) ? prior : '');
  const parsed = inputClauses(source);
  return obligations.map((o) => ({
    obligation_id: o.id,
    ...parsed,
    unresolved: parsed.unresolved || parsed.conditions.length < 2,
  }));
}

function fieldMeasurements(assertion) {
  const t = assertion.target;
  if (t?.kind === 'cell' && ['text', 'contains'].includes(assertion.check))
    return [
      {
        table: t.table,
        key: t.key,
        column: t.column,
        check: assertion.check,
        expected: assertion.expected,
      },
    ];
  if (assertion.check !== 'table_cells') return [];
  return (assertion.expected?.rows ?? []).flatMap((row) => {
    const common = { table: t, key: { column: assertion.expected.key_column, value: row.key } };
    return [
      { ...common, column: assertion.expected.key_column, check: 'text', expected: row.key },
      ...(row.cells ?? []).map((cell) => ({ ...common, ...cell })),
    ];
  });
}

export function requireQueryResultEvidence(c, original, step) {
  for (const wanted of sourceQueryRequirements(c, original)) {
    const assertions = stepAssertions(step);
    const counts = sourceTableCounts(original.expected);
    // Explicit original empty-result expectations do not authorize inventing
    // a record just to measure fields. Still need a real same-step empty table.
    if (
      counts.length === 1 &&
      counts[0] === 0 &&
      assertions.some(
        (a) =>
          a.obligation_ids?.includes(wanted.obligation_id) &&
          ((a.check === 'row_count' && a.expected === 0) ||
            (a.check === 'table_cells' &&
              a.expected.exact_rows === true &&
              a.expected.rows.length === 0)),
      )
    )
      continue;
    const groups = new Map();
    for (const a of assertions) {
      if (!a.obligation_ids?.includes(wanted.obligation_id)) continue;
      for (const f of fieldMeasurements(a)) {
        const id = canonicalJSON({ table: f.table, key: f.key });
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(f);
      }
    }
    const missing = new Set();
    if (!groups.size) wanted.conditions.forEach((c) => missing.add(c.label));
    for (const fields of wanted.unresolved ? [] : groups.values()) {
      const matches = [];
      for (const condition of wanted.conditions) {
        const columns = fields
          .filter(
            (f) =>
              typeof f.expected === 'string' &&
              (condition.kind === 'keyword'
                ? ['text', 'contains'].includes(f.check) && f.expected.includes(condition.value)
                : f.check === 'text' && f.expected === condition.value),
          )
          .map((f) => f.column);
        matches.push([...new Set(columns)]);
        if (!columns.length) missing.add(condition.label);
      }
      // Separate named conditions need separate field witnesses. Equal literals
      // do not let one status cell stand in for another independent input.
      const assign = (i, used) =>
        i === matches.length ||
        matches[i].some((column) => !used.has(column) && assign(i + 1, new Set([...used, column])));
      if (matches.every((columns) => columns.length > 0) && !assign(0, new Set()))
        wanted.conditions.forEach((c) => missing.add(c.label));
    }
    if (wanted.unresolved || missing.size) {
      const code = wanted.unresolved
        ? 'PLAN_QUERY_SOURCE_UNRESOLVED'
        : 'PLAN_QUERY_RESULT_UNPROVEN';
      throw Object.assign(new Error(code), {
        code,
        status: 400,
        plan_feedback: {
          field_path: 'assertions',
          reason: wanted.unresolved
            ? `原义务${wanted.obligation_id}明确要求AND生效，但当前/紧邻前一步原查询输入不能由支持的字面格式完整确定。不能从页面或未来步骤反推输入；保留技术缺口，不自行修改用例。`
            : `原义务${wanted.obligation_id}的查询结果仍缺${[...missing].join('、')}字段证据。原条件=${JSON.stringify(wanted.conditions)}。在当前步骤同表同原记录key以cell/table_cells核对各条件；关键词可对对应结果字段contains原关键词，选择条件须原值text。输入框value/selected_label、数量或ID不能代替全部条件；不要跨行拼凑、借后续步骤或复制观察值。仅补当前结果断言，不重放已经执行的查询。字段对应关系、全部结果数量及真实性仍须独立审查和执行，不由此结构检查批准。`,
        },
      });
    }
  }
}

export const QUERY_RESULT_EVIDENCE_GUIDANCE =
  'AND QUERY RESULT EVIDENCE: When the original explicitly requires 条件按AND生效, use literal query inputs from THIS action or its immediately preceding input step, never observed answers or a future step. At that original query step measure EVERY original condition on the SAME returned record fields, using cell text/contains for the original keyword or source-grounded table_cells. A control value, count or ID alone is insufficient. Do not assemble different records into one proof or postpone a condition to a later original step. Keep the actual field association, all original returned-population obligations and source predicate under independent review; matching literal values alone is not semantic approval. Query exactly as originally required, then add missing read-only measurements without replay. Unsupported or ambiguous original inputs remain a specific capability gap; do not guess, change the case, copy DOM expected values or expand the budget.';
