import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'examples', 'M3A_CASE_IMPORT_TEMPLATE_V1.xlsx');
const workbook = new ExcelJS.Workbook();
workbook.creator = 'ui-test-agent workbench';
workbook.created = new Date('2026-09-21T00:00:00.000Z');
const headers = ['用例编号', '标题', '模块', '前置条件', '测试数据', '步骤', '逐步预期', '内容状态'];
const sheets = [
  ['项目A示例', [
    ['001', '中文多步骤登录校验', '账户', '测试站点可访问\n使用无登录合成页', '用户名：演示用户\n输入保留原始换行', '1. 打开合成页面\n2. 输入演示值\n3. 点击确认', '1. 页面加载完成\n2. 输入框显示演示值\n3. 结果显示 PROBE-42', '已确认'],
    ['A-中文-02', '列表筛选并清空', '列表', '页面已有三条合成数据', '筛选词：电池', '1. 输入筛选词\n2. 清空筛选', '1. 仅显示匹配项\n2. 恢复全部数据', '待确认'],
    ['003', '缺少逐步预期示例', '边界', '用于演示待澄清状态', '无', '1. 打开边界页面\n2. 观察结果', '', '待确认'],
  ]],
  ['项目B示例', [
    ['B-001', '项目B自有用例', '基础', '合成页面可访问', '输入：B项目', '1. 打开页面\n2. 输入B项目', '1. 页面加载完成\n2. 页面显示B项目', '已确认'],
  ]],
];
for (const [name, rows] of sheets) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(headers); for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => { cell.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheet.columns.forEach((column, index) => { column.width = [15, 28, 16, 24, 24, 38, 38, 16][index]; });
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    sheet.getRow(row).height = 78;
    sheet.getRow(row).eachCell({ includeEmpty: true }, (cell) => { cell.font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF172033' } }; cell.alignment = { vertical: 'top', wrapText: true }; });
    sheet.getCell(row, 1).numFmt = '@';
  }
}
await workbook.xlsx.writeFile(output);
