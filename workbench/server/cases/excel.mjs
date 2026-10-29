import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const CASE_FIELDS = ['external_id', 'title', 'module', 'preconditions', 'test_data', 'steps', 'expected', 'status', 'case_type'];

const HEADER_ALIASES = {
  external_id: ['用例编号', '用例ID', '用例id', '测试用例编号', '测试用例ID'],
  title: ['用例标题', '标题', '用例名称', '测试用例标题'],
  module: ['模块', '所属模块', '功能模块'],
  preconditions: ['前置条件', '前提条件'],
  test_data: ['测试数据', '用例数据'],
  steps: ['测试步骤', '步骤', '测试步骤/测试数据', '操作步骤'],
  expected: ['预期结果', '逐步预期', '预期'],
  status: ['内容状态', '用例内容状态'],
  case_type: ['用例层级', 'case_type'],
};
const REQUIRED_MAPPING_FIELDS = ['external_id', 'title', 'steps'];

function suggestedMapping(headers) {
  const mapping = {}, issues = [];
  const normalized = (value) => String(value).trim().replace(/[\s　]+/g, '').toLowerCase();
  for (const field of CASE_FIELDS) {
    const aliases = new Set(HEADER_ALIASES[field].map(normalized));
    const matches = headers.filter((header) => aliases.has(normalized(header)));
    if (matches.length === 1) mapping[field] = matches[0];
    else if (matches.length > 1) issues.push({ code: 'MAPPING_AMBIGUOUS', field, headers: matches });
    else if (REQUIRED_MAPPING_FIELDS.includes(field)) issues.push({ code: 'MAPPING_REQUIRED', field, headers: [] });
  }
  const fieldsByHeader = new Map();
  for (const [field, header] of Object.entries(mapping)) fieldsByHeader.set(header, [...(fieldsByHeader.get(header) || []), field]);
  for (const [header, fields] of fieldsByHeader) if (fields.length > 1) {
    for (const field of fields) delete mapping[field];
    issues.push({ code: 'MAPPING_HEADER_CONFLICT', header, fields });
  }
  return { suggested_mapping: mapping, mapping_issues: issues };
}

function csvRecords(text) {
  const records = [], record = [];
  let field = '', state = 'START';
  const pushField = () => { record.push(field); field = ''; state = 'START'; };
  const pushRecord = () => { pushField(); records.push([...record]); record.length = 0; };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (state === 'QUOTED') {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else state = 'AFTER_QUOTE';
      } else field += char;
      continue;
    }
    if (char === ',') { pushField(); continue; }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      pushRecord(); continue;
    }
    if (char === '"') {
      if (state !== 'START') throw new Error('CASE_CSV_QUOTE_INVALID');
      state = 'QUOTED'; continue;
    }
    if (state === 'AFTER_QUOTE') throw new Error('CASE_CSV_QUOTE_INVALID');
    field += char; state = 'UNQUOTED';
  }
  if (state === 'QUOTED') throw new Error('CASE_CSV_QUOTE_UNTERMINATED');
  if (field.length || record.length || state === 'AFTER_QUOTE') pushRecord();
  if (!records.length || records[0].every((value) => !value.trim())) throw new Error('CASE_CSV_HEADER_REQUIRED');
  const width = records[0].length;
  for (let index = 1; index < records.length; index += 1) {
    if (records[index].every((value) => !value.trim())) continue;
    if (records[index].length !== width) throw new Error('CASE_CSV_ROW_WIDTH_MISMATCH');
  }
  return records;
}

async function csvWorkbook(file, fileName) {
  const bytes = await fs.readFile(file);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch {
    try { text = new TextDecoder('gb18030', { fatal: true }).decode(bytes); }
    catch { throw new Error('CASE_CSV_ENCODING_UNSUPPORTED'); }
  }
  text = text.replace(/^\uFEFF/, '');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('CASE_CSV_CONTROL_CHARACTER_UNSUPPORTED');
  const records = csvRecords(text), name = path.basename(fileName || file, '.csv');
  const sheetName = name || 'CSV';
  const getRow = (number) => {
    const values = records[number - 1] || [];
    return {
      getCell: (column) => ({ value: values[column - 1] ?? null }),
      eachCell: (_options, callback) => values.forEach((value, index) => { if (value !== '') callback({ value }, index + 1); }),
    };
  };
  const sheet = {
    name: sheetName, getRow,
    eachRow: (_options, callback) => records.forEach((values, index) => { if (values.some((value) => value !== '')) callback(getRow(index + 1), index + 1); }),
  };
  return { worksheets: [sheet], getWorksheet: (selected) => selected === sheetName ? sheet : undefined };
}

async function openWorkbook(file, fileName) {
  if (path.extname(file).toLowerCase() === '.csv') return csvWorkbook(file, fileName);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return workbook;
}

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

export async function inspectWorkbook(file, { file_name } = {}) {
  const workbook = await openWorkbook(file, file_name);
  return {
    sheets: workbook.worksheets.map((sheet) => {
      let rowCount = 0;
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 1 && rowHasData(row)) rowCount += 1;
      });
      const headers = readHeaderLayout(sheet).headers;
      return { name: sheet.name, row_count: rowCount, headers, ...suggestedMapping(headers) };
    }),
  };
}

export async function parseWorksheet(file, { sheet_name, mapping, upload_sha256, file_name }) {
  const workbook = await openWorkbook(file, file_name);
  const sheet = workbook.getWorksheet(sheet_name);
  if (!sheet) throw new Error('CASE_EXCEL_SHEET_NOT_FOUND');
  const { headers, columnByHeader } = readHeaderLayout(sheet);
  for (const required of REQUIRED_MAPPING_FIELDS) {
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
    const sourceFields = Object.fromEntries(headers.map((header) => [header, textValue(row.getCell(columnByHeader.get(header))).text]));
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
    const rawType = values.case_type.trim();
    const caseType = ({ UI: 'UI', BACKEND: 'BACKEND', '前端': 'UI', '后端': 'BACKEND' })[rawType.toUpperCase()];
    if (rawType && !caseType) issues.push({ severity: 'ERROR', code: 'CASE_TYPE_INVALID', field: 'case_type', row: rowNumber, message: `第${rowNumber}行用例层级须为 UI 或 BACKEND。` });
    const statusText = values.status.trim().toUpperCase();
    const hasAmbiguity = issues.some((issue) => ['ERROR', 'CLARIFICATION'].includes(issue.severity));
    const status = steps.length > 0 && !hasAmbiguity && ['已确认', 'CONFIRMED'].includes(statusText) ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
    const content = {
      external_id: values.external_id.trim(), title: values.title.trim(), module: values.module.trim(),
      preconditions: values.preconditions, test_data: values.test_data, steps, status,
      ...(caseType ? { case_type: caseType } : {}),
    };
    const sourceType = path.extname(file).toLowerCase() === '.csv' ? 'csv' : 'xlsx';
    rows.push({
      candidate_key: `${sourceType === 'csv' ? 'csv' : 'excel'}-row-${rowNumber}`, source_location: { sheet: sheet.name, row: rowNumber },
      root_source: { type: sourceType, stable_id: `${sourceType}:${upload_sha256}:${sheet.name}:${rowNumber}`, file_name, file_sha256: upload_sha256, sheet: sheet.name, row: rowNumber, source_fields: sourceFields },
      source_version: 1, content, content_sha256: contentHash(content), issues,
    });
  }
  return { sheet_name: sheet.name, headers, rows };
}
