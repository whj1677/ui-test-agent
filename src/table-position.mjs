// Bounded source grammar, not a general natural-language equivalence checker.
// The original identifies a record AND an absolute visible data-row position.
// Never derive positions from observation, incidental numbers, or data-key names.
const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const ordinal = (value) => chinese[value] ?? Number(value);

// A closed interval of POSITIONS is not a closed population of records.
// Parse only explicit lists: never fill omitted identities from the DOM or IDs.
function rangePositions(text) {
  const positions = [],
    gaps = [];
  if (typeof text !== 'string') return { positions, gaps };
  for (const clause of text.split(/[；;。\n，,]/u)) {
    const heads = [
      ...clause.matchAll(
        /第\s*(-?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(?:至|到|[-~～])\s*(?:第\s*)?(-?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*行/gu,
      ),
    ];
    if (!heads.length) continue;
    const head = heads[0],
      start = ordinal(head[1]),
      end = ordinal(head[2]);
    const prefix = clause.slice(0, head.index);
    const remainder = clause.slice(head.index + head[0].length);
    // Negation/history of the POSITION claim is distinct from record data such
    // as 未启用, 不可用 or 类别. Do not scan ordinary field values as instructions.
    if (
      /不|未|无需|无须|勿|(?:^|\s)别|如果|若|否则|假如|或|可能|例如|比如|示例|样例|此前|之前|原先|上次|曾经|历史|操作前|点击前|标题|按钮|输入框/u.test(
        prefix,
      ) ||
      /^\s*(?:不|未|无需|无须|勿|别|如果|若|否则|假如|可能)/u.test(remainder)
    )
      continue;
    const tail = remainder.match(/^\s*依次(?:为|是)\s*(.+?)\s*$/u);
    const entries = tail?.[1].split('、').map((v) => v.trim()) ?? [];
    const ids = entries.map(
      (v) => v.match(/^[「“"']?([A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)(?![A-Za-z0-9_-])/u)?.[1],
    );
    if (
      heads.length !== 1 ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end > 999 ||
      end < start ||
      end - start + 1 > 50 ||
      entries.length !== end - start + 1 ||
      /或|如果|若|否则|假如|可能/u.test(tail?.[1] ?? '') ||
      ids.some((v) => !v) ||
      new Set(ids).size !== ids.length
    ) {
      gaps.push(
        '原文位置范围需要明确合法界限及逐项身份列表；不能从现场补齐身份、猜测位置或降成相对顺序。',
      );
      continue;
    }
    positions.push(...ids.map((key, i) => ({ key, position: start + i })));
  }
  return { positions, gaps };
}

export function rowPositionSourceGaps(text) {
  return rangePositions(text).gaps;
}

export function extractRowPositions(text) {
  if (typeof text !== 'string') return [];
  const positions = rangePositions(text).positions;
  const pattern =
    /(?:首行|第\s*(\d{1,3}|[一二三四五六七八九十])\s*行)\s*(?:(?:恢复|回到|仍|保持|应)?\s*(?:为|是|回到)?\s*)?[「“"']?([A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)(?![A-Za-z0-9_-])/gu;
  for (const clause of text.split(/[；;。\n，,]/u)) {
    // Do not turn exclusions, conditional claims, or quoted negative examples
    // into mandatory positive position assertions.
    if (/不|未|无需|无须|勿|别|如果|若|否则|假如|或|可能|例如|比如/u.test(clause)) continue;
    for (const match of clause.matchAll(pattern)) {
      const position = match[1] ? (chinese[match[1]] ?? Number(match[1])) : 1;
      if (!Number.isInteger(position) || position < 1 || position > 1000) continue;
      positions.push({ key: match[2], position });
    }
  }
  return positions;
}

export function sourceSupportsPosition(key, position, original) {
  return extractRowPositions(original?.expected).some(
    (item) => item.key === key && item.position === position,
  );
}
