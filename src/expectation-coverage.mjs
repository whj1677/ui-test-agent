// Necessary coverage checks for a deliberately small literal grammar. These
// helpers never infer business rules, approve a plan, or replace semantic audit.
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const rangePattern = () =>
  /(?<![A-Za-z0-9_.-])([A-Za-z]+)(\d+)\s*(?:至|到|[-~～–—]|to\b)\s*([A-Za-z]+)(\d+)(?![A-Za-z0-9_])/gu;
const pagePattern = () => /第\s*([0-9]+)\s*\/\s*([0-9]+)\s*页/gu;

/** Only same-prefix ascending inclusive ranges of <=50 IDs are expanded.
 * Unpadded endpoints may differ in width; padded endpoints must agree in width.
 * Unsupported expressions are left to the model, never declared complete. */
export function extractExpectationRanges(expected) {
  if (typeof expected !== 'string') return [];
  const ranges = [];
  for (const match of expected.matchAll(rangePattern())) {
    const [, prefix, first, endPrefix, last] = match;
    const start = Number(first),
      end = Number(last);
    const padded = /^0\d/.test(first) || /^0\d/.test(last);
    if (
      prefix !== endPrefix ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      end < start ||
      end - start >= 50 ||
      (padded && first.length !== last.length)
    )
      continue;
    const width = padded ? first.length : 0;
    ranges.push({
      source: 'expected',
      quote: match[0],
      ids: Array.from(
        { length: end - start + 1 },
        (_, i) => `${prefix}${String(start + i).padStart(width, '0')}`,
      ),
    });
  }
  return ranges;
}

function pages(text) {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(pagePattern())].flatMap((match) => {
    const current = Number(match[1]),
      total = Number(match[2]);
    return Number.isSafeInteger(current) &&
      Number.isSafeInteger(total) &&
      current > 0 &&
      total >= current
      ? [{ source: 'expected', quote: match[0], current, total }]
      : [];
  });
}

function containsId(text, id) {
  // IDs are generated from letters/digits only. Avoid D001 matching D0010.
  return (
    typeof text === 'string' && new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`, 'u').test(text)
  );
}

function tableTarget(target) {
  // Actual TABLE resolution remains the existing plan/runtime validator's job.
  return (
    target &&
    (target.kind === 'role'
      ? target.role === 'table' && target.exact === true
      : ['testid', 'css', 'text'].includes(target.kind) &&
        nonempty(target.value) &&
        (target.kind !== 'text' || target.exact === true))
  );
}

function coversId(assertion, id) {
  const { target, check, expected } = assertion;
  if (check === 'row_sequence')
    return (
      tableTarget(target) &&
      Array.isArray(expected) &&
      expected.length > 0 &&
      expected.every(nonempty) &&
      new Set(expected).size === expected.length &&
      expected.some(
        (text) =>
          containsId(text, id) &&
          // One sequence entry measures one row, not a list of several IDs in it.
          (text.match(/[A-Za-z]+\d+/gu) ?? []).length === 1,
      )
    );
  if (check === 'table_cells') {
    if (
      !tableTarget(target) ||
      !nonempty(expected?.key_column) ||
      typeof expected.ordered !== 'boolean' ||
      typeof expected.exact_rows !== 'boolean' ||
      !Array.isArray(expected.rows) ||
      !expected.rows.length ||
      expected.rows.length > 50 ||
      new Set(expected.rows.map((row) => row?.key)).size !== expected.rows.length
    )
      return false;
    // A row key alone (or an empty contains-like cell) is not a measured result.
    return expected.rows.some(
      (row) =>
        row?.key === id &&
        Array.isArray(row.cells) &&
        row.cells.length > 0 &&
        row.cells.every(
          (cell) =>
            nonempty(cell?.column) &&
            ((cell.check === 'text' && nonempty(cell.expected)) ||
              (cell.check === 'number' &&
                typeof cell.expected === 'number' &&
                Number.isFinite(cell.expected))),
        ),
    );
  }
  if (
    !['row', 'cell'].includes(target?.kind) ||
    !tableTarget(target.table) ||
    target.key?.value !== id ||
    !nonempty(target.key.column) ||
    target.target !== undefined
  )
    return false;
  // The key scopes the row; use the row itself or its identity column, not an
  // unrelated field/label/button that happens to carry the same obligation ID.
  if (target.kind === 'cell' && target.column !== target.key.column) return false;
  if (check === 'visible') return expected === undefined || expected === true;
  return ['text', 'contains'].includes(check) && nonempty(expected) && containsId(expected, id);
}

function coversPage(assertion, page) {
  const { target, check, expected } = assertion;
  const compatible = (text) => {
    const found = pages(text);
    return (
      found.length > 0 && found.every((p) => p.current === page.current && p.total === page.total)
    );
  };
  if (check === 'visible')
    return (
      target?.kind === 'text' &&
      target.exact === true &&
      (expected === undefined || expected === true) &&
      compatible(target.value)
    );
  if (!['text', 'contains'].includes(check) || !nonempty(expected) || !compatible(expected))
    return false;
  // Do not credit a matching expected value on a text locator for another page.
  return (
    target &&
    target.kind !== 'label' &&
    target.kind !== 'placeholder' &&
    (target.kind !== 'text' || !pages(target.value).length || compatible(target.value))
  );
}

/** Returns gaps only. An empty result says nothing about unsupported grammar,
 * other clauses/fields, ordering, population, or cross-checkpoint timing.
 * Only assertions cited by this step's audit AND mapped to this obligation count.
 * Source literals are always extracted from original.expected, never metadata. */
export function expectationCoverageGaps(original, assertions, checks) {
  const literals = [
    ...extractExpectationRanges(original.expected).map((r) => ({ ...r, kind: 'range' })),
    ...pages(original.expected).map((p) => ({ ...p, kind: 'page' })),
  ];
  const gaps = [];
  for (const obligation of original.obligations) {
    const check = checks.find(
      (c) => c.step_id === original.step_id && c.obligation_id === obligation.id,
    );
    const applicable = (check?.assertion_indices ?? [])
      .map((index) => assertions[index])
      .filter((a) => a?.obligation_ids?.includes(obligation.id));
    for (const literal of literals.filter((l) => obligation.text.includes(l.quote))) {
      if (literal.kind === 'range') {
        const missing = literal.ids.filter((id) => !applicable.some((a) => coversId(a, id)));
        if (missing.length)
          gaps.push({
            obligation_id: obligation.id,
            source: 'expected',
            kind: 'range',
            quote: literal.quote,
            missing,
            reason: `原预期明确编号闭区间“${literal.quote}”缺少当前步骤义务下的实际身份断言：${missing.join('、')}。补齐每个编号的行/身份列文本或可见性、row_sequence 或 table_cells 检查；首尾、标签、原文引用和义务ID不构成覆盖。`,
          });
      } else if (!applicable.some((a) => coversPage(a, literal)))
        gaps.push({
          obligation_id: obligation.id,
          source: 'expected',
          kind: 'page',
          quote: literal.quote,
          reason: `原预期页码“${literal.quote}”缺少兼容的明确文本断言。使用页码文本定位的 visible 或 text/contains 检查相同当前页/总页数；按钮 enabled、空文本和原文引用不构成覆盖。`,
        });
    }
  }
  return gaps;
}
