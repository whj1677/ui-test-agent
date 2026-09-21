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

function splitLines(value) {
  return String(value || '').replace(/\r\n/g, '\n').split('\n').map((item) => item.trim()).filter(Boolean)
    .map((item) => item.replace(/^\s*\d+[.)、]\s*/, ''));
}

export function contentHash(content) {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex').toUpperCase();
}

export async function inspectWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return {
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      row_count: Math.max(0, sheet.actualRowCount - 1),
      headers: Array.from({ length: sheet.actualColumnCount }, (_, index) => textValue(sheet.getCell(1, index + 1)).text),
    })),
  };
}

export async function parseWorksheet(file, { sheet_name, mapping, upload_sha256, file_name }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet(sheet_name);
  if (!sheet) throw new Error('CASE_EXCEL_SHEET_NOT_FOUND');
  const headers = Array.from({ length: sheet.actualColumnCount }, (_, index) => textValue(sheet.getCell(1, index + 1)).text);
  const columnByHeader = new Map(headers.map((header, index) => [header, index + 1]));
  for (const required of ['external_id', 'title', 'steps']) {
    if (!mapping?.[required] || !columnByHeader.has(mapping[required])) throw new Error('CASE_EXCEL_MAPPING_REQUIRED');
  }
  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = {};
    const issues = [];
    for (const field of CASE_FIELDS) {
      const header = mapping[field];
      if (!header) { values[field] = ''; continue; }
      const read = textValue(row.getCell(columnByHeader.get(header)));
      if (read.formula) issues.push({ severity: 'ERROR', code: 'FORMULA_UNSUPPORTED', field, row: rowNumber, message: `第${rowNumber}行“${header}”为公式，首版不读取或计算公式。` });
      if (field === 'external_id' && read.numeric) issues.push({ severity: 'WARNING', code: 'NUMERIC_CASE_ID', field, row: rowNumber, message: `第${rowNumber}行用例编号为数值，原文件若含前导零将无法可靠恢复。` });
      values[field] = read.text;
    }
    if (!Object.values(values).some((value) => value.trim())) continue;
    if (!values.external_id.trim()) issues.push({ severity: 'ERROR', code: 'CASE_ID_REQUIRED', field: 'external_id', row: rowNumber, message: `第${rowNumber}行缺少用例编号。` });
    if (!values.title.trim()) issues.push({ severity: 'ERROR', code: 'CASE_TITLE_REQUIRED', field: 'title', row: rowNumber, message: `第${rowNumber}行缺少标题。` });
    const actions = splitLines(values.steps);
    const expected = splitLines(values.expected);
    if (!actions.length) issues.push({ severity: 'ERROR', code: 'CASE_STEPS_REQUIRED', field: 'steps', row: rowNumber, message: `第${rowNumber}行缺少测试步骤。` });
    if (expected.length && expected.length !== actions.length) issues.push({ severity: 'ERROR', code: 'STEP_EXPECTED_COUNT_MISMATCH', field: 'expected', row: rowNumber, message: `第${rowNumber}行步骤${actions.length}条、预期${expected.length}条，无法确定对应关系。` });
    if (!expected.length && actions.length) issues.push({ severity: 'CLARIFICATION', code: 'EXPECTED_MISSING', field: 'expected', row: rowNumber, message: `第${rowNumber}行缺少逐步预期，允许以待澄清状态导入。` });
    const steps = actions.map((action, index) => ({ order: index + 1, action, expected: expected[index] || '' }));
    const statusText = values.status.trim().toUpperCase();
    const status = expected.length === actions.length && actions.length > 0 && ['已确认', 'CONFIRMED'].includes(statusText) ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
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
