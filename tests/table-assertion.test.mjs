import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTableExpectation,
  compareTableCells,
  TABLE_ASSERTION_GUIDANCE,
} from '../src/table-assertion.mjs';

function matrix(rowCount = 5, cellCount = 5) {
  const columns = Array.from({ length: cellCount }, (_, i) => `字段${i + 1}`);
  const expected = {
    key_column: '编号',
    rows: Array.from({ length: rowCount }, (_, r) => ({
      key: `R-${r + 1}`,
      cells: columns.map((column, c) => ({ column, check: 'number', expected: (r + 1) * 100 + c })),
    })),
    ordered: true,
    exact_rows: true,
  };
  const actual = {
    headers: ['编号', ...columns],
    rows: expected.rows.map((row) => [row.key, ...row.cells.map((cell) => `${cell.expected} kWh`)]),
  };
  const original = {
    expected: '表格所有行和字段符合测试数据，按给定顺序且无额外行。',
    data: expected.rows,
  };
  return { expected, actual, original };
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test('grounded 5x5 compares all 25 fields, preserves immutable inputs and exports guidance', () => {
  const { expected, actual, original } = freeze(matrix());
  assert.equal(validateTableExpectation(expected, original), expected);
  assert.deepEqual(compareTableCells(actual, expected), {
    passed: true,
    invalid: false,
    differences: [],
    checked_cells: 25,
  });
  assert.match(TABLE_ASSERTION_GUIDANCE, /ONE DOM sample/);
  assert.match(TABLE_ASSERTION_GUIDANCE, /never observations/);
});

test('every individual cell including the middle is actually compared', () => {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const { expected, actual } = matrix();
      actual.rows[r][c + 1] = '-999 kWh';
      const result = compareTableCells(actual, expected);
      assert.equal(result.passed, false);
      assert.equal(result.invalid, false);
      assert.equal(result.checked_cells, 25);
      assert.deepEqual(result.differences, [
        {
          key: `R-${r + 1}`,
          column: `字段${c + 1}`,
          check: 'number',
          expected: (r + 1) * 100 + c,
          actual: '-999 kWh',
          parsed: -999,
          reason: 'value_mismatch',
        },
      ]);
    }
  }
});

test('reports all simultaneous field differences without early success or early exit', () => {
  const { expected, actual } = matrix();
  actual.rows.forEach((row) => row.splice(1, 5, ...Array(5).fill('0')));
  const result = compareTableCells(actual, expected);
  assert.equal(result.passed, false);
  assert.equal(result.differences.length, 25);
  assert.equal(result.checked_cells, 25);
});

test('same values on the wrong exact identity never satisfy the original row', () => {
  const { expected, actual } = matrix();
  actual.rows[2][0] = 'R-30';
  const result = compareTableCells(actual, expected);
  assert.equal(result.passed, false);
  assert.equal(result.invalid, false);
  assert.equal(result.differences.filter((d) => d.reason === 'missing_row').length, 5);
  assert.ok(result.differences.some((d) => d.reason === 'unexpected_row' && d.key === 'R-30'));
  assert.equal(result.checked_cells, 20);
});

test('reordered physical columns still compare by exact header identity', () => {
  const { expected, actual } = matrix();
  actual.headers.reverse();
  actual.rows.forEach((row) => row.reverse());
  assert.equal(compareTableCells(actual, expected).passed, true);
});

test('missing field column is technical invalid with one diff per affected row', () => {
  const { expected, actual } = matrix();
  actual.headers[3] = '字段30';
  const result = compareTableCells(actual, expected);
  assert.equal(result.passed, false);
  assert.equal(result.invalid, true);
  assert.equal(result.error, 'TABLE_COLUMN_MISSING');
  assert.equal(result.differences.filter((d) => d.reason === 'missing_column').length, 5);
  assert.equal(result.checked_cells, 20);
});

for (const [label, change, code] of [
  [
    'missing key column',
    (a) => {
      a.headers[0] = '编号后缀';
    },
    'TABLE_KEY_COLUMN_MISSING',
  ],
  [
    'duplicate field column',
    (a) => {
      a.headers[3] = a.headers[2];
    },
    'TABLE_COLUMN_DUPLICATE',
  ],
  [
    'duplicate key column',
    (a) => {
      a.headers[3] = '编号';
    },
    'TABLE_COLUMN_DUPLICATE',
  ],
  [
    'duplicate unrelated column',
    (a) => {
      a.headers.push('额外', '额外');
      a.rows.forEach((r) => r.push('', ''));
    },
    'TABLE_COLUMN_DUPLICATE',
  ],
  [
    'duplicate middle row identity',
    (a) => {
      a.rows[2][0] = a.rows[1][0];
    },
    'TABLE_KEY_DUPLICATE',
  ],
  [
    'blank identity',
    (a) => {
      a.rows[2][0] = ' ';
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'no schema',
    (a) => {
      a.headers = [];
      a.rows = [];
    },
    'TABLE_STRUCTURE_INVALID',
  ],
  [
    'blank header',
    (a) => {
      a.headers[2] = '';
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'ragged row',
    (a) => {
      a.rows[2].pop();
    },
    'TABLE_STRUCTURE_INVALID',
  ],
  [
    'non-string sampled cell',
    (a) => {
      a.rows[2][2] = 301;
    },
    'TABLE_STRUCTURE_INVALID',
  ],
  [
    'non-string header',
    (a) => {
      a.headers[2] = 1;
    },
    'TABLE_STRUCTURE_INVALID',
  ],
  [
    'unknown snapshot field',
    (a) => {
      a.truncated = true;
    },
    'TABLE_SCHEMA_INVALID',
  ],
  [
    'collector unsupported marker',
    (a) => {
      a.error = 'merged cells';
    },
    'TABLE_SCHEMA_INVALID',
  ],
  [
    'too many sampled rows',
    (a) => {
      a.rows = Array(1001).fill(a.rows[0]);
    },
    'TABLE_ARRAY_INVALID',
  ],
  [
    'too many sampled columns',
    (a) => {
      a.headers = Array(129).fill('x');
    },
    'TABLE_ARRAY_INVALID',
  ],
  [
    'sample total bound',
    (a) => {
      a.headers = Array(128).fill('x');
      a.rows = Array(157).fill([]);
    },
    'TABLE_SAMPLE_LIMIT',
  ],
])
  test(`technical invalid: ${label}`, () => {
    const { expected, actual } = matrix();
    change(actual);
    const result = compareTableCells(actual, expected);
    assert.equal(result.passed, false);
    assert.equal(result.invalid, true);
    assert.equal(result.error, code);
    assert.ok(result.differences.length > 0);
  });

test('a known empty table is a business mismatch for nonempty expectations', () => {
  const { expected, actual } = matrix();
  actual.rows = [];
  const result = compareTableCells(actual, expected);
  assert.equal(result.passed, false);
  assert.equal(result.invalid, false);
  assert.equal(result.differences.length, 25);
  assert.equal(result.checked_cells, 0);
});

test('explicit empty exact expectation can pass only a known empty table', () => {
  const { expected, actual } = matrix();
  expected.rows = [];
  assert.equal(compareTableCells(actual, expected).passed, false);
  actual.rows = [];
  assert.equal(compareTableCells(actual, expected).passed, true);
  assert.equal(compareTableCells({ headers: [], rows: [] }, expected).invalid, true);
  expected.exact_rows = false;
  assert.throws(() => validateTableExpectation(expected), { code: 'TABLE_EMPTY_EXPECTATION' });
});

test('ordered and exact_rows are independent; subset order is relative', () => {
  const { expected, actual } = matrix();
  [actual.rows[1], actual.rows[2]] = [actual.rows[2], actual.rows[1]];
  let result = compareTableCells(actual, expected);
  assert.equal(result.passed, false);
  assert.equal(result.differences.filter((d) => d.reason === 'row_order').length, 2);
  expected.ordered = false;
  assert.equal(compareTableCells(actual, expected).passed, true);
  expected.rows = [expected.rows[0], expected.rows[3]];
  assert.equal(compareTableCells(actual, expected).passed, false);
  expected.exact_rows = false;
  expected.ordered = true;
  assert.equal(compareTableCells(actual, expected).passed, true);
  expected.rows.reverse();
  assert.equal(compareTableCells(actual, expected).passed, false);
});

test('text is trimmed exact equality, no substring/case/inner whitespace folding', () => {
  const { expected, actual } = matrix(1, 1);
  expected.rows[0].cells[0] = { column: '字段1', check: 'text', expected: 'OK  Ready' };
  actual.rows[0][1] = ' \nOK  Ready\t';
  assert.equal(compareTableCells(actual, expected).passed, true);
  for (const text of ['OK Ready', 'ok  Ready', 'prefix OK  Ready', 'OK  Ready suffix']) {
    actual.rows[0][1] = text;
    assert.equal(compareTableCells(actual, expected).passed, false);
  }
  expected.rows[0].cells[0].expected = '';
  actual.rows[0][1] = ' \n';
  assert.equal(compareTableCells(actual, expected).passed, true);
});

for (const [text, value] of [
  ['100', 100],
  ['+100.00 kWh', 100],
  [' 100元 ', 100],
  ['1,234.5 kg', 1234.5],
  ['-1.25e2 mV', -125],
  ['.5%', 0.5],
  ['0', 0],
  ['1E+3', 1000],
  ['20 ℃', 20],
  ['10 元/kWh', 10],
  ['2 m²', 2],
  ['2 m2', 2],
])
  test(`strict number accepts ${text}`, () => {
    const { expected, actual } = matrix(1, 1);
    expected.rows[0].cells[0].expected = value;
    actual.rows[0][1] = text;
    assert.equal(compareTableCells(actual, expected).passed, true);
  });

for (const text of [
  '100 or 200',
  '100 or',
  '100/200',
  '100,200',
  '100 200',
  '100元200元',
  '100-200',
  '100±0',
  '100 (was 200)',
  '100\n200',
  '100 and',
  '1,00',
  '10,00.0',
  '0x64',
  '1e309',
  'Infinity',
  'NaN',
  '',
  ' ',
  '100.',
  '100px garbage',
  '=100',
  '$100',
  '100未知单位',
  '100 kWh extra',
])
  test(`strict number rejects ${JSON.stringify(text)}`, () => {
    const { expected, actual } = matrix(1, 1);
    actual.rows[0][1] = text;
    const result = compareTableCells(actual, expected);
    assert.equal(result.passed, false);
    assert.equal(result.invalid, false);
    // "100,200" is one valid grouped number, but must not compare equal to 100.
    assert.equal(
      result.differences[0].reason,
      text === '100,200' ? 'value_mismatch' : 'number_unparseable',
    );
  });

test('numeric checks have neither implicit unit conversion nor approximate equality', () => {
  const { expected, actual } = matrix(1, 1);
  expected.rows[0].cells[0].expected = 1;
  actual.rows[0][1] = '1000 W';
  assert.equal(compareTableCells(actual, expected).passed, false);
  actual.rows[0][1] = '1.0000001';
  assert.equal(compareTableCells(actual, expected).passed, false);
});

test('accepts 50 rows, 20 cells per row and 200 total at their inclusive boundaries', () => {
  for (const [rows, cells] of [
    [50, 4],
    [10, 20],
    [1, 20],
  ]) {
    const { expected, actual, original } = matrix(rows, cells);
    assert.equal(validateTableExpectation(expected, original), expected);
    assert.equal(compareTableCells(actual, expected).checked_cells, rows * cells);
    assert.equal(compareTableCells(actual, expected).passed, true);
  }
});

for (const [label, change, code] of [
  [
    '51 rows',
    (e) => {
      e.rows = matrix(51, 1).expected.rows;
    },
    'TABLE_ARRAY_INVALID',
  ],
  [
    '21 cells',
    (e) => {
      e.rows = matrix(1, 21).expected.rows;
    },
    'TABLE_ARRAY_INVALID',
  ],
  [
    '201 cells',
    (e) => {
      e.rows = matrix(10, 20).expected.rows;
      e.rows.push(matrix(11, 1).expected.rows[10]);
    },
    'TABLE_CELL_LIMIT',
  ],
  [
    'empty cells',
    (e) => {
      e.rows[0].cells = [];
    },
    'TABLE_EMPTY_CELLS',
  ],
  [
    'empty key',
    (e) => {
      e.rows[0].key = '';
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'whitespace key',
    (e) => {
      e.rows[0].key = '  ';
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'padded key',
    (e) => {
      e.rows[0].key = ' R-1';
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'numeric key',
    (e) => {
      e.rows[0].key = 1;
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'duplicate key',
    (e) => {
      e.rows[1].key = e.rows[0].key;
    },
    'TABLE_KEY_DUPLICATE',
  ],
  [
    'empty column',
    (e) => {
      e.rows[0].cells[0].column = '';
    },
    'TABLE_IDENTITY_INVALID',
  ],
  [
    'duplicate column',
    (e) => {
      e.rows[0].cells[1].column = e.rows[0].cells[0].column;
    },
    'TABLE_COLUMN_DUPLICATE',
  ],
  [
    'string number oracle',
    (e) => {
      e.rows[0].cells[0].expected = '100';
    },
    'TABLE_NUMBER_INVALID',
  ],
  [
    'numeric text oracle',
    (e) => {
      e.rows[0].cells[0].check = 'text';
    },
    'TABLE_TEXT_INVALID',
  ],
  [
    'NaN',
    (e) => {
      e.rows[0].cells[0].expected = NaN;
    },
    'TABLE_NUMBER_INVALID',
  ],
  [
    'Infinity',
    (e) => {
      e.rows[0].cells[0].expected = Infinity;
    },
    'TABLE_NUMBER_INVALID',
  ],
  [
    'negative Infinity',
    (e) => {
      e.rows[0].cells[0].expected = -Infinity;
    },
    'TABLE_NUMBER_INVALID',
  ],
  [
    'unsupported check',
    (e) => {
      e.rows[0].cells[0].check = 'contains';
    },
    'TABLE_CHECK_INVALID',
  ],
  [
    'unknown root',
    (e) => {
      e.tolerance = 10;
    },
    'TABLE_SCHEMA_INVALID',
  ],
  [
    'unknown row',
    (e) => {
      e.rows[0].index = 0;
    },
    'TABLE_SCHEMA_INVALID',
  ],
  [
    'unknown cell',
    (e) => {
      e.rows[0].cells[0].formula = 'x';
    },
    'TABLE_SCHEMA_INVALID',
  ],
  [
    'missing flag',
    (e) => {
      delete e.ordered;
    },
    'TABLE_SCHEMA_INVALID',
  ],
  [
    'nonboolean flag',
    (e) => {
      e.exact_rows = 'true';
    },
    'TABLE_FLAGS_INVALID',
  ],
  [
    'sparse rows',
    (e) => {
      delete e.rows[1];
    },
    'TABLE_ARRAY_INVALID',
  ],
  [
    'sparse cells',
    (e) => {
      delete e.rows[0].cells[1];
    },
    'TABLE_ARRAY_INVALID',
  ],
])
  test(`expectation rejects ${label}`, () => {
    const { expected, actual } = matrix();
    change(expected);
    assert.throws(() => validateTableExpectation(expected), { code });
    const result = compareTableCells(actual, expected);
    assert.equal(result.passed, false);
    assert.equal(result.invalid, true);
    assert.equal(result.error, code);
  });

test('source projection accepts current expected prose and explicit case data/test_data', () => {
  const { expected } = matrix(1, 1);
  for (const source of [
    { expected: 'R-1 的字段1为 100 kWh。' },
    { expected: '核对本用例的数据', data: { id: 'R-1', value: 100 } },
    { expected: '核对本用例的数据', test_data: [{ id: 'R-1', value: '100 kWh' }] },
    { expected: 'R-1', data: '字段1 = 100' },
    { expected: expected.rows },
  ])
    assert.equal(validateTableExpectation(expected, source), expected);
});

test('source grounding checks every key and expected, including the middle row', () => {
  const { expected, original } = matrix();
  original.data = structuredClone(original.data);
  expected.rows[2].cells[2].expected = 999999;
  assert.throws(() => validateTableExpectation(expected, original), {
    code: 'TABLE_SOURCE_UNGROUNDED',
    path: 'expected.rows[2].cells[2].expected',
  });
  expected.rows[2].cells[2].expected = 302;
  expected.rows[2].key = 'invented';
  assert.throws(() => validateTableExpectation(expected, original), {
    code: 'TABLE_SOURCE_UNGROUNDED',
    path: 'expected.rows[2].key',
  });
});

test('D001至D005 grounds every inclusive ID including middle row keys and identity cells', () => {
  const expected = {
    key_column: '编号',
    ordered: true,
    exact_rows: true,
    rows: Array.from({ length: 5 }, (_, i) => {
      const key = `D00${i + 1}`;
      return { key, cells: [{ column: '编号', check: 'text', expected: key }] };
    }),
  };
  for (const source of [
    { expected: '显示 D001至D005。' },
    { expected: '显示 D001 至 D005。' },
    { expected: '显示给定数据', data: 'D001至D005' },
  ])
    assert.equal(validateTableExpectation(expected, source), expected);
  for (const key of ['D000', 'D006', 'D0030', 'D03', 'E003']) {
    const wrong = structuredClone(expected);
    wrong.rows[2].key = key;
    assert.throws(() => validateTableExpectation(wrong, { expected: 'D001至D005' }), {
      code: 'TABLE_SOURCE_UNGROUNDED',
      path: 'expected.rows[2].key',
    });
  }
  for (const text of ['D005至D001', 'D001至E005', 'D01至D005', 'D001至D999']) {
    const middleOnly = { ...expected, rows: [expected.rows[2]] };
    assert.throws(() => validateTableExpectation(middleOnly, { expected: text }), {
      code: 'TABLE_SOURCE_UNGROUNDED',
    });
  }
});

test('page observations/actions/other steps are not accepted as original source roots', () => {
  const { expected } = matrix(1, 1);
  for (const root of ['observations', 'actual', 'page', 'steps', 'action', 'source']) {
    assert.throws(
      () =>
        validateTableExpectation(expected, {
          expected: '应符合原业务要求',
          [root]: { key: 'R-1', expected: 100 },
        }),
      { code: 'TABLE_SCHEMA_INVALID' },
    );
  }
  assert.throws(() => validateTableExpectation(expected, { expected: '应符合原业务要求' }), {
    code: 'TABLE_SOURCE_UNGROUNDED',
  });
  // Explicitly supported schema-only path does not pretend to prove provenance.
  assert.equal(validateTableExpectation(expected), expected);
});

test('partial IDs, numeric fragments and JSON property names do not ground invented values', () => {
  const { expected } = matrix(1, 1);
  for (const text of ['R-10 100', 'XR-1 100', 'R-1 1000', 'R-1 100.5', 'R-1 -100', 'R-1 ID100'])
    assert.throws(() => validateTableExpectation(expected, { expected: text }), {
      code: 'TABLE_SOURCE_UNGROUNDED',
    });
  assert.throws(
    () =>
      validateTableExpectation(expected, {
        expected: 'R-1',
        data: { 100: 'not an oracle' },
      }),
    { code: 'TABLE_SOURCE_UNGROUNDED' },
  );
  assert.throws(
    () =>
      validateTableExpectation(expected, {
        expected: 'R-1',
        data: { value: '100 or 200' },
      }),
    { code: 'TABLE_SOURCE_UNGROUNDED' },
  );
});

test('empty text needs an explicit empty source value', () => {
  const { expected } = matrix(1, 1);
  expected.rows[0].cells[0] = { column: '字段1', check: 'text', expected: '' };
  assert.throws(() => validateTableExpectation(expected, { expected: 'R-1 has a value' }), {
    code: 'TABLE_SOURCE_UNGROUNDED',
  });
  assert.equal(
    validateTableExpectation(expected, { expected: 'R-1', data: { value: '' } }),
    expected,
  );
});

test('malformed or unbounded original sources fail closed', () => {
  const { expected } = matrix(1, 1);
  const cycle = {};
  cycle.self = cycle;
  for (const original of [
    null,
    {},
    { expected: undefined },
    { expected: 'R-1', data: NaN },
    { expected: 'R-1', data: cycle },
  ])
    assert.throws(
      () => validateTableExpectation(expected, original),
      (e) => /^TABLE_(SCHEMA|SOURCE)_INVALID$/.test(e.code),
    );
  assert.throws(() => validateTableExpectation(expected, { expected: 'x'.repeat(1000001) }), {
    code: 'TABLE_SOURCE_LIMIT',
  });
});
