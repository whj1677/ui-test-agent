import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'm3a-excel-fidelity-boundary.xlsx');
const workbook = new ExcelJS.Workbook();
workbook.creator = 'ui-test-agent synthetic fixture';
workbook.created = new Date('2026-09-21T00:00:00.000Z');
const sheet = workbook.addWorksheet('保真边界', { views: [{ state: 'frozen', ySplit: 1 }] });

sheet.getCell('A1').value = '用例编号';
sheet.getCell('B1').value = '标题';
sheet.getCell('D1').value = '步骤';
sheet.getCell('F1').value = '逐步预期';
sheet.getCell('G1').value = '测试数据';
sheet.getCell('H1').value = '内容状态';

sheet.getCell('A2').value = '001';
sheet.getCell('B2').value = '数字与文本保真';
sheet.getCell('D2').value = '220.5 kW\n3.65 V\n127.0.0.1\nv1.2.3\n中文动作';
sheet.getCell('F2').value = '保持 220.5 kW\n保持 3.65 V\n显示 127.0.0.1\n版本 v1.2.3\n中文预期';
sheet.getCell('G2').value = '功率：220.5 kW\n地址：127.0.0.1';
sheet.getCell('H2').value = '已确认';

// Row 3 is intentionally empty. Row 4 must retain its physical worksheet location.
sheet.getCell('A4').value = '002';
sheet.getCell('B4').value = '步骤预期空行错位';
sheet.getCell('D4').value = '动作一\n\n动作三';
sheet.getCell('F4').value = '预期一\n预期二\n';
sheet.getCell('G4').value = '版本：2.0.1';
sheet.getCell('H4').value = '已确认';

sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
  cell.font = { name: 'Microsoft YaHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
});
sheet.columns.forEach((column, index) => { column.width = [14, 24, 5, 28, 5, 30, 25, 14][index]; });
for (const rowNumber of [2, 4]) {
  sheet.getRow(rowNumber).height = 86;
  sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Microsoft YaHei', size: 10 };
    cell.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.getCell(rowNumber, 1).numFmt = '@';
}

await workbook.xlsx.writeFile(output);
