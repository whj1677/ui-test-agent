import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { contentHash } from './excel.mjs';

export const WORKBOOK_META_SHEET = '__workbench_package_v1';
const MARKER = 'workbench/case-xlsx-v1';
const PART_SIZE = 24000;
export const WORKBOOK_HEADERS = ['编号', '标题', '类型', '模块', '前置条件', '测试数据', '步骤', '预期', '确认状态', '用例版本', '自动化准备', '来源', '工作台回导标记'];

const digest = text => createHash('sha256').update(text).digest('hex').toUpperCase();
const printable = value => {
  if (value == null) return '';
  if (typeof value === 'object') return null; // A formula, hyperlink or rich text is a change, not the original literal.
  return String(value).replace(/\r\n?/g, '\n');
};

export function visibleCaseRow(item) {
  const c = item.content;
  return [c.external_id, c.title, c.case_type || 'UNCLASSIFIED', c.module || '', c.preconditions || '', c.test_data || '',
    c.steps.map(step => `${step.order}. ${step.action}`).join('\n'),
    c.steps.map(step => `${step.order}. ${step.expected}`).join('\n'),
    c.status, item.source_version, item.automation_readiness || (c.case_type === 'BACKEND' ? '待协议绑定' : '待检查'),
    JSON.stringify(c.source_refs || []), MARKER];
}

export function addWorkbookPackage(workbook, pkg) {
  const sheet = workbook.addWorksheet(WORKBOOK_META_SHEET);
  sheet.state = 'veryHidden';
  const json = JSON.stringify(pkg);
  const chunks = [];
  for (let start = 0; start < json.length;) {
    let end = Math.min(start + PART_SIZE, json.length);
    if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end -= 1;
    chunks.push(json.slice(start, end));
    start = end;
  }
  sheet.getCell('A1').value = MARKER;
  sheet.getCell('B1').value = digest(json);
  sheet.getCell('C1').value = chunks.length;
  chunks.forEach((part, index) => { sheet.getCell(index + 2, 1).value = part; });
}

export async function readWorkbookPackage(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const metadata = workbook.getWorksheet(WORKBOOK_META_SHEET);
  const visible = workbook.getWorksheet('测试用例');
  const markedVisible = visible && WORKBOOK_HEADERS.some((header, index) => printable(visible.getRow(1).getCell(index + 1).value) === '工作台回导标记');
  if (!metadata) {
    if (markedVisible) throw Error('CASE_WORKBOOK_SNAPSHOT_MISSING');
    return null;
  }
  if (!visible || metadata.getCell('A1').value !== MARKER || metadata.state !== 'veryHidden') throw Error('CASE_WORKBOOK_SNAPSHOT_INVALID');
  const count = metadata.getCell('C1').value;
  if (!Number.isInteger(count) || count < 1 || count > 500) throw Error('CASE_WORKBOOK_SNAPSHOT_INVALID');
  let json = '';
  for (let n = 0; n < count; n++) {
    const part = metadata.getCell(n + 2, 1).value;
    if (typeof part !== 'string' || !part.length || part.length > PART_SIZE) throw Error('CASE_WORKBOOK_SNAPSHOT_INVALID');
    json += part;
  }
  if (json.length > 10 * 1024 * 1024 || digest(json) !== metadata.getCell('B1').value) throw Error('CASE_WORKBOOK_SNAPSHOT_INVALID');
  let pkg;
  try { pkg = JSON.parse(json); } catch { throw Error('CASE_WORKBOOK_SNAPSHOT_INVALID'); }
  if (pkg?.schema !== 'workbench/case-package-v1' || !Array.isArray(pkg.cases) || !pkg.cases.length || !pkg.source_project?.project_id) throw Error('CASE_WORKBOOK_SNAPSHOT_INVALID');
  const changes = [];
  for (let col = 1; col <= WORKBOOK_HEADERS.length; col++) {
    if (printable(visible.getRow(1).getCell(col).value) !== WORKBOOK_HEADERS[col - 1]) changes.push({ index: 0, field: WORKBOOK_HEADERS[col - 1], reason: 'HEADER_CHANGED' });
  }
  if (visible.columnCount !== WORKBOOK_HEADERS.length) changes.push({ index: 0, field: '列数', reason: 'COLUMN_COUNT_CHANGED' });
  const physical = [];
  visible.eachRow({ includeEmpty: false }, (row, number) => { if (number > 1 && row.hasValues) physical.push(number); });
  if (physical.length !== pkg.cases.length || physical.some((number, index) => number !== index + 2))
    changes.push({ index: 0, field: '行数与顺序', reason: 'ROW_SET_CHANGED' });
  for (let index = 0; index < pkg.cases.length; index++) {
    const expected = visibleCaseRow(pkg.cases[index]);
    const row = visible.getRow(index + 2);
    expected.forEach((value, col) => {
      if (printable(row.getCell(col + 1).value) !== String(value ?? ''))
        changes.push({ index: index + 1, field: WORKBOOK_HEADERS[col], reason: 'CELL_CHANGED' });
    });
  }
  return { pkg, changes, sheet_name: visible.name };
}

export function assertWorkbookProjectSource(project, pkg) {
  if (pkg.source_project?.project_id !== project.project_id) throw Error('CASE_WORKBOOK_PROJECT_MISMATCH');
  for (const entry of pkg.cases) {
    const match = /^(.+):([^:]+):v(\d+)$/.exec(entry.package_case_id || '');
    if (!match || match[1] !== project.project_id || Number(match[3]) !== entry.source_version) throw Error('CASE_WORKBOOK_SOURCE_CHANGED');
    const item = project.cases.find(candidate => candidate.case_id === match[2]);
    const version = item?.versions.find(candidate => candidate.version === entry.source_version);
    if (!version || contentHash(version.content) !== contentHash(entry.content) ||
        JSON.stringify(item.root_source) !== JSON.stringify(entry.root_source) ||
        JSON.stringify(item.lineage) !== JSON.stringify(entry.lineage?.slice(0, -1)))
      throw Error('CASE_WORKBOOK_SOURCE_CHANGED');
  }
}
