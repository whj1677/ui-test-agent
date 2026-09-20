// Necessary literal-source guard only, not a general natural-language proof.
// Positions/prefixes, field counts and conditional/lower-bound counts cannot
// authorize an exact current-table row count. Scope still needs semantic audit.
function integer(value) {
  if (/^\d+$/u.test(value)) return Number(value);
  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (Object.hasOwn(digits, value)) return digits[value];
  if (
    !/^[一二两三四五六七八九]?百(?:零[一二三四五六七八九])?$|^[一二两三四五六七八九]?十[一二三四五六七八九]?$/u.test(
      value,
    )
  )
    return null;
  if (value.includes('百')) {
    const [a, b] = value.split('百');
    return (digits[a] ?? 1) * 100 + (digits[b.replace('零', '')] ?? 0);
  }
  const [a, b] = value.split('十');
  return (digits[a] ?? 1) * 10 + (digits[b] ?? 0);
}

function withoutPositions(text) {
  return text
    .replace(
      /第\s*(?:-?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(?:至|到|[-~～])\s*(?:第\s*)?(?:-?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(?:条|行)/gu,
      '',
    )
    .replace(
      /(?:第|前|后|最前|最后|首|末|倒数)\s*(?:\d+|[零一二两三四五六七八九十百]+)\s*(?:条|行)/gu,
      '',
    )
    .replace(/\b(?:first|last|top|bottom)\s+\d+\s+(?:rows?|records?|results?)\b/giu, '');
}
export const hasTablePositionPhrase = (text) =>
  typeof text === 'string' && withoutPositions(text) !== text;

// Literal sole-record source. Key uniqueness alone is not total cardinality.
export function sourceUniqueRows(text) {
  if (typeof text !== 'string') return [];
  const result = [];
  for (const clause of text.split(/[；;。\n，,]/u)) {
    const match = clause.match(
      /唯一(?:的)?(?:结果)?(?:行|记录)\s*(?:是|为)\s*[「“"']?([A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)(?![A-Za-z0-9_-])/u,
    );
    if (!match) continue;
    const prefix = clause.slice(0, match.index);
    if (
      /不|未|无|非|如果|若|否则|假如|或|可能|例如|比如|示例|样例|此前|之前|原先|上次|曾经|历史|操作前|点击前|标题|按钮|输入框/u.test(
        prefix,
      )
    )
      continue;
    if (
      /或|如果|若|否则|假如|可能|不成立|并非|不是|不应|不一定/u.test(
        clause.slice(match.index + match[0].length),
      )
    )
      continue;
    result.push(match[1]);
  }
  return [...new Set(result)];
}

export function sourceTableCounts(text) {
  if (typeof text !== 'string') return [];
  const counts = [];
  for (let clause of text.split(/[；;。\n，,]/u)) {
    if (sourceUniqueRows(clause).length) counts.push(1);
    // A missing count is a capability/source gap, never implicit permission.
    if (
      /不|未|无需|无须|如果|若|否则|假如|可能|或|至少|至多|最少|最多|超过|大于|小于|\b(?:not|never|if|unless|maybe|or|at least|at most|more than|less than|up to)\b/iu.test(
        clause,
      )
    )
      continue;
    clause = withoutPositions(clause);
    if (
      /无记录|没有记录|(?:表格|列表|结果|记录)\s*为空|\bempty (?:table|list|results?)\b|\bno (?:rows|records|results)\b/iu.test(
        clause,
      )
    )
      counts.push(0);
    for (const match of clause.matchAll(
      /(\d+|[零一二两三四五六七八九十百]+)\s*(?:条|行|records?\b|rows?\b|results?\b)/giu,
    )) {
      // “一行” inside “唯一行” is not a standalone quantity. Only the
      // context-checked sole-record source above may authorize its cardinality.
      if (clause[match.index - 1] === '唯') continue;
      if (/^\d/u.test(match[1]) && /[A-Za-z0-9_.-]/u.test(clause[match.index - 1] ?? '')) continue;
      const value = integer(match[1]);
      if (Number.isSafeInteger(value) && value >= 0) counts.push(value);
    }
    for (const match of clause.matchAll(
      /(?:行数|条数|记录(?:总数|数|数量)|\b(?:row|record) count)\s*(?:为|是|:|：|=|is)?\s*(\d+|[零一二两三四五六七八九十百]+)(?![A-Za-z0-9.])/giu,
    )) {
      const value = integer(match[1]);
      if (Number.isSafeInteger(value) && value >= 0) counts.push(value);
    }
  }
  return [...new Set(counts)];
}
