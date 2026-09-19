import { displayNumber, displayUnit } from './table-assertion.mjs';

export const TABLE_ORDER_GUIDANCE =
  'table_order is a current-page RELATION, not observed values copied as expectations. expected={field:string,column:string,direction:"ascending"|"descending",comparison:"number"|"identifier"}. field is the literal ORIGINAL sort field (e.g. 功率), column is the exact observed header (e.g. 额定功率). A unique exact field header wins; otherwise a unique header ending in field (at least 2 characters) is allowed. Direction/field must be explicitly grounded in THIS expected quote (编号升序/功率降序), or in THIS action when the expected quote explicitly says 应用排序. A quote only saying 排序控件显示 or not clicking query does not authorize a new table ordering. Never use another step or observation as the oracle. number supports finite normal display numbers with at most 15 significant digits (precision loss, subnormal/underflow and unsupported formats are technical gaps) only when all sampled cells have the same unit; no conversion/tolerance/unit correctness. identifier supports common ASCII letter/hyphen prefix plus equally wide decimal suffix only; arbitrary collation unsupported. At least two rows are required. Equal adjacent values are allowed. All rows/headers are sampled together once; an inversion is a business difference, never retried into a pass. It proves only the CURRENT visible page monotonic order, not record membership, counts, precise row positions, completeness, global cross-page ordering or control values. Those original obligations still need their own measurements. table_cells with ordered is only for identities actually grounded in original data; never copy observed IDs just to prove sorting.';

const fail = (code, path) => {
  throw Object.assign(new Error(code + ': ' + path), { code, path, status: 400 });
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unsafe =
  /(?:不(?:是|按|应|要|得)|无需|未要求|不要|非|如果|假如|若|否则|可能|例如|比如|或者|或|不成立)/u;
function clauses(value) {
  return typeof value === 'string' ? value.split(/[。；;\n]/u) : [];
}
function literalDirection(text, expected) {
  const direction = expected.direction === 'ascending' ? '升序' : '降序';
  const pattern = new RegExp(
    '(?:^|[\\s，,:：、。；;“「"\'（(]|按|以|为|是|默认|选择|保持|恢复|使用|设置成|改成)' +
      escape(expected.field) +
      '\\s*' +
      direction +
      '(?=$|[\\s，,:：、。；;”」"\'）)]|排列|排序)',
    'u',
  );
  return clauses(text).some((clause) => !unsafe.test(clause) && pattern.test(clause));
}

// original is a trusted current-step projection, never supplied by model output.
export function validateTableOrder(expected, original) {
  if (
    !expected ||
    typeof expected !== 'object' ||
    Array.isArray(expected) ||
    Object.keys(expected).sort().join(',') !== 'column,comparison,direction,field'
  )
    fail('TABLE_ORDER_SCHEMA_INVALID', 'expected');
  for (const key of ['field', 'column'])
    if (
      typeof expected[key] !== 'string' ||
      !expected[key].trim() ||
      expected[key] !== expected[key].trim() ||
      expected[key].length > 120
    )
      fail('TABLE_ORDER_SCHEMA_INVALID', 'expected.' + key);
  if (
    !['ascending', 'descending'].includes(expected.direction) ||
    !['number', 'identifier'].includes(expected.comparison)
  )
    fail('TABLE_ORDER_SCHEMA_INVALID', 'expected');
  if (original !== undefined) {
    const quote = original.quote;
    if (
      typeof quote !== 'string' ||
      !quote ||
      typeof original.expected !== 'string' ||
      !original.expected.includes(quote)
    )
      fail('TABLE_ORDER_SOURCE_REQUIRED', 'original.quote');
    const eligible = (value) =>
      clauses(value).filter(
        (c) =>
          !unsafe.test(c) &&
          !/控件|选择框|下拉框|不点击查询|未点击查询|尚未应用|未应用|操作前/u.test(c),
      );
    const sourceClauses = eligible(original.expected);
    const quoteClauses = eligible(quote);
    const direct = quoteClauses.some(
      (q) =>
        literalDirection(q, expected) &&
        sourceClauses.some((c) => c.includes(q) && literalDirection(c, expected)),
    );
    const applied =
      quoteClauses.some(
        (q) =>
          /(?:应用|执行)排序/u.test(q) &&
          sourceClauses.some((c) => c.includes(q) && /(?:应用|执行)排序/u.test(c)),
      ) &&
      !/(?:不|未)点击查询|仅将|只选择/u.test(original.action ?? '') &&
      literalDirection(original.action, expected);
    if (!direct && !applied) fail('TABLE_ORDER_SOURCE_REQUIRED', 'expected.field/direction');
  }
  return expected;
}

export function compareTableOrder(actual, expected) {
  try {
    validateTableOrder(expected);
    if (
      !actual ||
      !Array.isArray(actual.headers) ||
      !Array.isArray(actual.rows) ||
      !actual.headers.length ||
      actual.headers.length > 128 ||
      actual.rows.length > 1000 ||
      actual.headers.length * actual.rows.length > 20000 ||
      actual.headers.some((h) => typeof h !== 'string' || !h.trim()) ||
      actual.rows.some(
        (r) =>
          !Array.isArray(r) ||
          r.length !== actual.headers.length ||
          r.some((c) => typeof c !== 'string' || c.length > 4096),
      )
    )
      fail('TABLE_ORDER_STRUCTURE_UNSUPPORTED', 'actual');
    const headers = actual.headers.map((h) => h.trim());
    if (new Set(headers).size !== headers.length) fail('TABLE_ORDER_COLUMN_AMBIGUOUS', 'headers');
    const matches = headers.includes(expected.field)
      ? [expected.field]
      : headers.filter((h) => expected.field.length >= 2 && h.endsWith(expected.field));
    if (matches.length !== 1 || matches[0] !== expected.column)
      fail('TABLE_ORDER_COLUMN_AMBIGUOUS', 'expected.column');
    if (actual.rows.length < 2) fail('TABLE_ORDER_INSUFFICIENT_ROWS', 'actual.rows');
    const column = headers.indexOf(expected.column);
    const texts = actual.rows.map((r) => r[column].trim());
    let values;
    if (expected.comparison === 'number') {
      values = texts.map(displayNumber);
      if (values.some((v) => v === null) || new Set(texts.map(displayUnit)).size !== 1)
        fail('TABLE_ORDER_VALUES_UNSUPPORTED', 'actual.rows');
      // Do not round two distinct high-precision decimals into an apparent tie.
      for (const [i, text] of texts.entries()) {
        const unit = displayUnit(text);
        const literal = (unit ? text.slice(0, -unit.length) : text).trim().replaceAll(',', '');
        const digits = literal
          .split(/[eE]/u)[0]
          .replace(/[.+-]/gu, '')
          .replace(/^0+/u, '')
          .replace(/0+$/u, '');
        if (
          digits.length > 15 ||
          (digits.length > 0 && values[i] === 0) ||
          (values[i] !== 0 && Math.abs(values[i]) < 2.2250738585072014e-308)
        )
          fail('TABLE_ORDER_VALUES_UNSUPPORTED', 'actual.rows');
      }
    } else {
      const parts = texts.map((s) => /^([A-Za-z][A-Za-z_-]*)([0-9]+)$/u.exec(s));
      if (
        parts.some((p) => !p) ||
        new Set(parts.map((p) => p[1])).size !== 1 ||
        new Set(parts.map((p) => p[2].length)).size !== 1
      )
        fail('TABLE_ORDER_VALUES_UNSUPPORTED', 'actual.rows');
      values = parts.map((p) => p[2]); // equal-width decimal strings: no Number precision loss
    }
    const differences = [];
    for (let i = 1; i < values.length; i++)
      if (
        expected.direction === 'ascending' ? values[i - 1] > values[i] : values[i - 1] < values[i]
      )
        differences.push({
          reason: 'order_inversion',
          positions: [i, i + 1],
          actual: [texts[i - 1], texts[i]],
        });
    return {
      passed: !differences.length,
      invalid: false,
      differences,
      field: expected.field,
      column: expected.column,
      direction: expected.direction,
      comparison: expected.comparison,
      values,
      scope: 'current_visible_page',
      unit_verified: false,
      conversion: false,
    };
  } catch (error) {
    if (!error.code?.startsWith('TABLE_ORDER_')) throw error;
    return { passed: false, invalid: true, error: error.code, differences: [], path: error.path };
  }
}
