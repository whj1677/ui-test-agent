import { extractExpectationRanges } from './expectation-coverage.mjs';

// Adaptive planning uses one explicit comparison capability for numeric cells.
// This does not change approved fixed plans or the scalar browser comparator.
export const ADAPTIVE_NUMERIC_GUIDANCE = `NUMERIC CAPABILITIES: a top-level check:"number" compares only pure numeric DOM text (commas removed); it does NOT parse units such as kW, labels or formulas, including on definition fields. For a scoped definition field whose ORIGINAL requirement supplies only a number, use check:"display_number" with that finite ORIGINAL number. This explicit projection accepts one decimal with a supported display suffix; it does not verify or convert units. It is allowed only on within->definition, never whole dialogs/tables, and cannot substitute for an explicit unit requirement (use the original grounded text in that case). Do not add observed units to text expectations when the original only requires a number. In adaptive plans, a cell locator with check:"number" is not supported: use check:"table_cells" on that SAME observed table with the SAME original key, column and finite expected number, even for a single cell or pure-number display. Never duplicate it with a scalar number assertion. Do not copy units/values from observations into expectations. Keep all original source obligations; ordered/exact_rows stay false unless the original requires them. Numeric projection does NOT establish unit correctness: if the original explicitly requires a unit, also measure its original text faithfully, without conversion or inferred tolerance. Missing supported measurement is a technical gap, not a business failure or permission to weaken the oracle.`;

/** Pure helpers: no DOM reads, I/O, retries, formulas or inferred expectations. */
export const TABLE_ASSERTION_GUIDANCE = `table_cells compares a bounded matrix in ONE DOM sample: expected={key_column:string,rows:[{key:string,cells:[{column:string,check:"text"|"number",expected:string|number}]}],ordered:boolean,exact_rows:boolean}. At most 50 rows, 20 cells per row and 200 asserted cells total. Supply every required field, including middle rows. Keys and column names are exact, unique identities; never use substring or row position as identity. ordered checks the relative order of requested keys; exact_rows forbids extra rows. Empty expected rows require exact_rows:true. text is exact trimmed DOM text; number is one finite decimal (optional grouped thousands/exponent) with an optional supported display-unit suffix, with no unit conversion or tolerance. Expected keys/values must come from THIS original step's expected or explicit case.data/test_data, never observations. validateTableExpectation(expected, {expected:step.expected,data:case.data,test_data:case.test_data}) checks literal grounding; omit absent data fields. Omitting the second argument only checks schema and MUST NOT authorize a business plan. Grounding checks literal presence, not row/field associations, negation, completeness or ordering semantics: retain independent original-case coverage review. compareTableCells consumes exactly {headers:string[],rows:string[][]} collected together from one supported table; it cannot establish snapshot atomicity itself. The collector must reject merged/nested/virtual/unknown structures and incomplete/truncated samples. Missing/duplicate columns or ambiguous keys yield technical invalid, never a pass. Do not resample individual fields or change expected values after a difference.`;

const MAX_ROWS = 50;
const MAX_CELLS_PER_ROW = 20;
const MAX_CELLS = 200;
const MAX_TEXT = 4096;
// Separate sampling limits allow a subset expectation against a larger table.
// Never truncate to these limits: oversized input is a technical invalid result.
const MAX_ACTUAL_ROWS = 1000;
const MAX_ACTUAL_COLUMNS = 128;
const MAX_ACTUAL_CELLS = 20000;
const DECIMAL =
  '[+-]?(?:(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?';
// A deliberately closed vocabulary prevents prose such as "100 or" from
// masquerading as a display unit. Extend only with reviewed display formats.
const UNIT =
  '(?:元/kWh|kWh/日|kg/m³|元/度|m/s|mAh|mA|Ah|A|kWh|kW|MWh|MW|Wh|W|mV|kV|V|kHz|MHz|Hz|kΩ|MΩ|Ω|kPa|MPa|Pa|bar|rpm|ms|min|s|h|d|mm|cm|km|m²|m³|m2|m3|ml|mL|mg|m|L|kg|g|t|万元|亿元|元|人|个|条|件|次|台|度|%|‰|℃|℉|°C|°F|K)';
const DISPLAY_NUMBER = new RegExp(`^(${DECIMAL})(?:[ \\t]*(${UNIT}))?$`, 'u');
const SOURCE_NUMBER = new RegExp(`${DECIMAL}(?:[ \\t]*${UNIT})?`, 'gu');

function fail(code, path) {
  throw Object.assign(new Error(`${code}: ${path}`), { code, path, status: 400 });
}

function plain(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function shape(value, required, optional, path) {
  if (
    !plain(value) ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Reflect.ownKeys(value).some((key) => !required.includes(key) && !optional.includes(key))
  )
    fail('TABLE_SCHEMA_INVALID', path);
}

function array(value, max, path) {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    fail('TABLE_ARRAY_INVALID', path);
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, i)) fail('TABLE_ARRAY_INVALID', `${path}[${i}]`);
}

function identity(value, path) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 500)
    fail('TABLE_IDENTITY_INVALID', path);
}

/**
 * Returns the original expected object unchanged; throws {code,path,status:400}.
 * original (optional) is a trusted projection made by the planner, NOT model
 * output: {expected: currentStep.expected, data?: case.data, test_data?: case.test_data}.
 * Only these source roots are allowed. expected may be prose or JSON; data roots
 * may also be prose or JSON. JSON leaf VALUES match exactly (property names are
 * not facts); prose matches literal tokens, with strict numeric token parsing.
 * Explicit bounded inclusive ID ranges (e.g. D001至D005) in source prose
 * also ground each ID, using the shared expectation-coverage range grammar.
 * Missing original means schema-only validation (e.g. already approved runtime).
 * Caller owns provenance and semantic key/column/value association review.
 */
export function validateTableExpectation(expected, original) {
  shape(expected, ['key_column', 'rows', 'ordered', 'exact_rows'], [], 'expected');
  identity(expected.key_column, 'expected.key_column');
  if (typeof expected.ordered !== 'boolean' || typeof expected.exact_rows !== 'boolean')
    fail('TABLE_FLAGS_INVALID', 'expected');
  array(expected.rows, MAX_ROWS, 'expected.rows');
  if (!expected.rows.length && !expected.exact_rows)
    fail('TABLE_EMPTY_EXPECTATION', 'expected.rows');
  const keys = new Set();
  let total = 0;
  for (const [i, row] of expected.rows.entries()) {
    const path = `expected.rows[${i}]`;
    shape(row, ['key', 'cells'], [], path);
    identity(row.key, `${path}.key`);
    if (keys.has(row.key)) fail('TABLE_KEY_DUPLICATE', `${path}.key`);
    keys.add(row.key);
    array(row.cells, MAX_CELLS_PER_ROW, `${path}.cells`);
    if (!row.cells.length) fail('TABLE_EMPTY_CELLS', `${path}.cells`);
    total += row.cells.length;
    if (total > MAX_CELLS) fail('TABLE_CELL_LIMIT', 'expected.rows');
    const columns = new Set();
    for (const [j, cell] of row.cells.entries()) {
      const cellPath = `${path}.cells[${j}]`;
      shape(cell, ['column', 'check', 'expected'], [], cellPath);
      identity(cell.column, `${cellPath}.column`);
      if (columns.has(cell.column)) fail('TABLE_COLUMN_DUPLICATE', `${cellPath}.column`);
      columns.add(cell.column);
      if (cell.check === 'text') {
        if (
          typeof cell.expected !== 'string' ||
          cell.expected.length > MAX_TEXT ||
          cell.expected !== cell.expected.trim()
        )
          fail('TABLE_TEXT_INVALID', `${cellPath}.expected`);
      } else if (cell.check === 'number') {
        if (typeof cell.expected !== 'number' || !Number.isFinite(cell.expected))
          fail('TABLE_NUMBER_INVALID', `${cellPath}.expected`);
      } else fail('TABLE_CHECK_INVALID', `${cellPath}.check`);
    }
  }
  if (original !== undefined) {
    shape(original, ['expected'], ['data', 'test_data'], 'original');
    const sources = sourceLeaves(original);
    for (const [i, row] of expected.rows.entries()) {
      if (!grounded(row.key, sources)) fail('TABLE_SOURCE_UNGROUNDED', `expected.rows[${i}].key`);
      for (const [j, cell] of row.cells.entries())
        if (!grounded(cell.expected, sources))
          fail('TABLE_SOURCE_UNGROUNDED', `expected.rows[${i}].cells[${j}].expected`);
    }
  }
  return expected;
}

function sourceLeaves(original) {
  const leaves = [];
  const seen = new Set();
  let nodes = 0,
    chars = 0;
  function visit(value, path, depth, prose = false) {
    if (++nodes > 20000 || depth > 20) fail('TABLE_SOURCE_LIMIT', path);
    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
      chars += String(value).length;
      if (chars > 1000000) fail('TABLE_SOURCE_LIMIT', path);
      leaves.push({ value, prose });
      if (prose && typeof value === 'string')
        for (const range of extractExpectationRanges(value))
          for (const id of range.ids) visit(id, `${path}.range`, depth + 1);
    } else if (value === null || typeof value === 'boolean') {
      // Neither null nor booleans can ground text/number expectations.
    } else if (Array.isArray(value) || plain(value)) {
      if (seen.has(value)) fail('TABLE_SOURCE_INVALID', path);
      seen.add(value);
      if (Array.isArray(value)) array(value, 20000, path);
      for (const key of Object.keys(value)) visit(value[key], `${path}.${key}`, depth + 1);
      seen.delete(value);
    } else fail('TABLE_SOURCE_INVALID', path);
  }
  for (const root of ['expected', 'data', 'test_data'])
    if (Object.hasOwn(original, root)) visit(original[root], `original.${root}`, 0, true);
  return leaves;
}

export function displayNumber(text) {
  const match = DISPLAY_NUMBER.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(value) ? value : null;
}

export function displayUnit(text) {
  return typeof text === 'string' ? (DISPLAY_NUMBER.exec(text.trim())?.[2] ?? null) : null;
}

export function sourceSupportsNumber(value, original) {
  return Number.isFinite(value) && grounded(value, sourceLeaves(original));
}

// Source quantities are technical grounding only, not field-association proof.
export function sourceDisplayUnits(value, original) {
  const units = new Set();
  for (const source of sourceLeaves(original)) {
    if (typeof source.value !== 'string') continue;
    const matches = source.prose
      ? [...source.value.matchAll(SOURCE_NUMBER)]
      : [{ 0: source.value, index: 0 }];
    for (const match of matches) {
      const before = source.value[match.index - 1] ?? '';
      const after = source.value[match.index + match[0].length] ?? '';
      const unit = displayUnit(match[0]);
      if (
        unit &&
        displayNumber(match[0]) === value &&
        !/[A-Za-z0-9_.,+\-]/u.test(before) &&
        !/[A-Za-z0-9_.,+\-]/u.test(after)
      )
        units.add(unit);
    }
  }
  return [...units];
}

function grounded(value, sources) {
  return sources.some((source) => {
    if (source.value === value) return true;
    if (typeof source.value !== 'string') return false;
    if (!source.prose) {
      // Explicit numeric display strings in data may supply a numeric oracle.
      return typeof value === 'number' && displayNumber(source.value) === value;
    }
    if (typeof value === 'number') {
      for (const match of source.value.matchAll(SOURCE_NUMBER)) {
        const before = source.value[match.index - 1] ?? '';
        const after = source.value[match.index + match[0].length] ?? '';
        if (
          !/[A-Za-z0-9_.,+\-]/u.test(before) &&
          !/[A-Za-z0-9_.,+\-]/u.test(after) &&
          displayNumber(match[0]) === value
        )
          return true;
      }
      return false;
    }
    if (!value) return false; // Empty text must be an explicit JSON leaf.
    let at = source.value.indexOf(value);
    while (at !== -1) {
      const before = source.value[at - 1] ?? '';
      const after = source.value[at + value.length] ?? '';
      const left = /[A-Za-z0-9_]/u.test(value[0]) && /[A-Za-z0-9_.+\-]/u.test(before);
      const right = /[A-Za-z0-9_]/u.test(value.at(-1)) && /[A-Za-z0-9_.+\-]/u.test(after);
      if (!left && !right) return true;
      at = source.value.indexOf(value, at + 1);
    }
    return false;
  });
}

/**
 * Returns {passed, invalid, differences, checked_cells, error?}.
 * invalid:true means a technical/schema problem; error is a stable TABLE_* code.
 * invalid:false,passed:false means business differences in a usable sample.
 * Every requested cell is compared, or gets its own missing-row/column diff.
 * Inputs are never mutated. Actual text is trimmed, identities are otherwise exact.
 * ordered compares relative order for subsets; exact_rows also requires all keys.
 */
export function compareTableCells(actual, expected) {
  const differences = [];
  let checked = 0;
  const result = (invalid = false, error) => ({
    passed: !invalid && differences.length === 0,
    invalid,
    ...(error ? { error } : {}),
    differences,
    checked_cells: checked,
  });
  try {
    validateTableExpectation(expected);
    shape(actual, ['headers', 'rows'], [], 'actual');
    array(actual.headers, MAX_ACTUAL_COLUMNS, 'actual.headers');
    array(actual.rows, MAX_ACTUAL_ROWS, 'actual.rows');
    if (!actual.headers.length) fail('TABLE_STRUCTURE_INVALID', 'actual.headers');
    if (actual.headers.length * actual.rows.length > MAX_ACTUAL_CELLS)
      fail('TABLE_SAMPLE_LIMIT', 'actual.rows');
    const headers = actual.headers.map((header, i) => {
      if (typeof header !== 'string') fail('TABLE_STRUCTURE_INVALID', `actual.headers[${i}]`);
      identity(header.trim(), `actual.headers[${i}]`);
      return header.trim();
    });
    if (new Set(headers).size !== headers.length) fail('TABLE_COLUMN_DUPLICATE', 'actual.headers');
    const indices = new Map(headers.map((name, i) => [name, i]));
    if (!indices.has(expected.key_column)) fail('TABLE_KEY_COLUMN_MISSING', 'actual.headers');
    const rows = new Map();
    for (const [i, row] of actual.rows.entries()) {
      array(row, MAX_ACTUAL_COLUMNS, `actual.rows[${i}]`);
      if (
        row.length !== headers.length ||
        row.some((v) => typeof v !== 'string' || v.length > MAX_TEXT)
      )
        fail('TABLE_STRUCTURE_INVALID', `actual.rows[${i}]`);
      const key = row[indices.get(expected.key_column)].trim();
      identity(key, `actual.rows[${i}].key`);
      if (rows.has(key)) fail('TABLE_KEY_DUPLICATE', `actual.rows[${i}].key`);
      rows.set(key, { row, index: i });
    }
    let missingColumn = false;
    for (const row of expected.rows) {
      const found = rows.get(row.key);
      for (const cell of row.cells) {
        const base = {
          key: row.key,
          column: cell.column,
          check: cell.check,
          expected: cell.expected,
        };
        if (!indices.has(cell.column)) {
          missingColumn = true;
          differences.push({ ...base, actual: null, reason: 'missing_column' });
        } else if (!found) {
          differences.push({ ...base, actual: null, reason: 'missing_row' });
        } else {
          checked++;
          const text = found.row[indices.get(cell.column)].trim();
          const value = cell.check === 'number' ? displayNumber(text) : text;
          if (value === null || value !== cell.expected)
            differences.push({
              ...base,
              actual: text,
              ...(cell.check === 'number' ? { parsed: value } : {}),
              reason: value === null ? 'number_unparseable' : 'value_mismatch',
            });
        }
      }
    }
    if (expected.exact_rows) {
      const wanted = new Set(expected.rows.map((row) => row.key));
      for (const key of rows.keys())
        if (!wanted.has(key))
          differences.push({
            key,
            column: expected.key_column,
            expected: null,
            actual: key,
            reason: 'unexpected_row',
          });
    }
    if (expected.ordered) {
      const wanted = expected.rows.map((row) => row.key).filter((key) => rows.has(key));
      const present = new Set(wanted);
      const observed = [...rows.keys()].filter((key) => present.has(key));
      for (let i = 0; i < wanted.length; i++)
        if (wanted[i] !== observed[i])
          differences.push({
            key: wanted[i],
            column: expected.key_column,
            expected: wanted[i],
            actual: observed[i],
            index: i,
            reason: 'row_order',
          });
    }
    return result(missingColumn, missingColumn ? 'TABLE_COLUMN_MISSING' : undefined);
  } catch (error) {
    if (!error.code?.startsWith('TABLE_')) throw error;
    differences.push({ reason: 'invalid', code: error.code, path: error.path });
    return result(true, error.code);
  }
}
