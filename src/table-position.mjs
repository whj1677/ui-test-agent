// Bounded source grammar, not a general natural-language equivalence checker.
// The original identifies a record AND an absolute visible data-row position.
// Never derive positions from observation, incidental numbers, or data-key names.
export function extractRowPositions(text) {
  if (typeof text !== 'string') return [];
  const positions = [];
  const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
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
