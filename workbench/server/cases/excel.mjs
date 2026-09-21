import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';

export const CASE_FIELDS = ['external_id', 'title', 'module', 'preconditions', 'test_data', 'steps', 'expected', 'status'];

function textValue(cell) {
  const value = cell.value;
  if (value == null) return { text: '', formula: false, numeric: false };
  if (typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) return { text: '', formula: true, numeric: false };
  if (typeof value === 'object' && Array.isArray(value.richText)) return { text: value.richText.map((part) => part.text || '').join(''), formula: false, numeric: false };
  if (typeof value === 'object' && value.text) return { text: String(value.text), formula: false, numeric: false };
  if (value instanceof Date) return { text: value.toISOString(), formula: false, numeric: false };
  return { text: String(value), formula: false, numeric: typeof value === 'number' };
}

function positionedLines(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map((text, index) => ({
    cell_line: index + 1,
    text,
    blank: !text.trim(),
  }));
}

function readHeaderLayout(sheet) {
  const headers = [];
  const columnByHeader = new Map();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const read = textValue(cell);
    if (read.formula) throw new Error('CASE_EXCEL_HEADER_FORMULA_UNSUPPORTED');
    const header = read.text.trim();
    if (!header) return;
    if (columnByHeader.has(header)) throw new Error('CASE_EXCEL_HEADER_DUPLICATE');
    headers.push(header);
    columnByHeader.set(header, columnNumber);
  });
  return { headers, columnByHeader };
}

function rowHasData(row) {
  let hasData = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const read = textValue(cell);
    if (read.formula || read.text.trim()) hasData = true;
  });
  return hasData;
}

export function contentHash(content) {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex').toUpperCase();
}

export async function inspectWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return {
    sheets: workbook.worksheets.map((sheet) => {
      let rowCount = 0;
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 1 && rowHasData(row)) rowCount += 1;
      });
      return { name: sheet.name, row_count: rowCount, headers: readHeaderLayout(sheet).headers };
    }),
  };
}

export async function parseWorksheet(file, { sheet_name, mapping, upload_sha256, file_name }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet(sheet_name);
  if (!sheet) throw new Error('CASE_EXCEL_SHEET_NOT_FOUND');
  const { headers, columnByHeader } = readHeaderLayout(sheet);
  for (const required of ['external_id', 'title', 'steps']) {
    if (!mapping?.[required] || !columnByHeader.has(mapping[required])) throw new Error('CASE_EXCEL_MAPPING_REQUIRED');
  }
  const rows = [];
  const dataRowNumbers = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1 && rowHasData(row)) dataRowNumbers.push(rowNumber);
  });
  for (const rowNumber of dataRowNumbers) {
    const row = sheet.getRow(rowNumber);
    const values = {};
    const issues = [];
    for (const field of CASE_FIELDS) {
      const header = mapping[field];
      if (!header) { values[field] = ''; continue; }
      const columnNumber = columnByHeader.get(header);
      if (!columnNumber) throw new Error('CASE_EXCEL_MAPPING_HEADER_NOT_FOUND');
      const read = textValue(row.getCell(columnNumber));
      if (read.formula) issues.push({ severity: 'ERROR', code: 'FORMULA_UNSUPPORTED', field, row: rowNumber, message: `第${rowNumber}行“${header}”为公式，首版不读取或计算公式。` });
      if (field === 'external_id' && read.numeric) issues.push({ severity: 'WARNING', code: 'NUMERIC_CASE_ID', field, row: rowNumber, message: `第${rowNumber}行用例编号为数值，原文件若含前导零将无法可靠恢复。` });
      values[field] = read.text;
    }
    if (!Object.values(values).some((value) => value.trim())) continue;
    if (!values.external_id.trim()) issues.push({ severity: 'ERROR', code: 'CASE_ID_REQUIRED', field: 'external_id', row: rowNumber, message: `第${rowNumber}行缺少用例编号。` });
    if (!values.title.trim()) issues.push({ severity: 'ERROR', code: 'CASE_TITLE_REQUIRED', field: 'title', row: rowNumber, message: `第${rowNumber}行缺少标题。` });
    const actions = positionedLines(values.steps);
    const expected = positionedLines(values.expected);
    const steps = [];
    const lineCount = Math.max(actions.length, expected.length);
    for (let index = 0; index < lineCount; index += 1) {
      const actionLine = actions[index] || { cell_line: index + 1, text: '', blank: true };
      const expectedLine = expected[index] || { cell_line: index + 1, text: '', blank: true };
      if (actionLine.blank && expectedLine.blank) continue;
      if (actionLine.blank) {
        issues.push({ severity: 'ERROR', code: 'STEP_ACTION_MISSING', field: 'steps', row: rowNumber, cell_line: index + 1, original_action: actionLine.text, original_expected: expectedLine.text, message: `第${rowNumber}行单元格第${index + 1}行缺少动作，原预期“${expectedLine.text}”无法确定归属。` });
        continue;
      }
      const step = { order: steps.length + 1, action: actionLine.text, expected: expectedLine.text };
      steps.push(step);
      if (expectedLine.blank) {
        issues.push({ severity: 'CLARIFICATION', code: 'STEP_EXPECTED_MISSING', field: 'expected', row: rowNumber, cell_line: index + 1, original_action: actionLine.text, original_expected: expectedLine.text, message: `第${rowNumber}行单元格第${index + 1}行动作“${actionLine.text}”缺少对应预期，保持待澄清。` });
      }
    }
    if (!steps.length) issues.push({ severity: 'ERROR', code: 'CASE_STEPS_REQUIRED', field: 'steps', row: rowNumber, message: `第${rowNumber}行缺少测试步骤。` });
    const statusText = values.status.trim().toUpperCase();
    const hasAmbiguity = issues.some((issue) => ['ERROR', 'CLARIFICATION'].includes(issue.severity));
    const status = steps.length > 0 && !hasAmbiguity && ['已确认', 'CONFIRMED'].includes(statusText) ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
    const content = {
      external_id: values.external_id.trim(), title: values.title.trim(), module: values.module.trim(),
      preconditions: values.preconditions, test_data: values.test_data, steps, status,
    };
    rows.push({
      candidate_key: `excel-row-${rowNumber}`, source_location: { sheet: sheet.name, row: rowNumber },
      root_source: { type: 'xlsx', stable_id: `xlsx:${upload_sha256}:${sheet.name}:${rowNumber}`, file_name, file_sha256: upload_sha256, sheet: sheet.name, row: rowNumber },
      source_version: 1, content, content_sha256: contentHash(content), issues,
    });
  }
  return { sheet_name: sheet.name, headers, rows };
}
