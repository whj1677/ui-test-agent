import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDir = fileURLToPath(new URL('../examples/ui-d2a/', import.meta.url));
const headers = ['用例编号', '标题', '模块', '前置条件', '测试数据', '步骤', '逐步预期', '内容状态'];
const datasets = [
  {
    file: 'UI_D2A_CASES_A.xlsx', sheet: '体验项目A', rows: [
      ['UI-D2A-001', '设备参数与服务连通性核对', '设备监控', '测试服务已启动\n采集终端处于在线状态', '额定功率：220.5 kW\n单体电压：3.65 V\n服务地址：127.0.0.1\n备注：中文多行数据', '打开设备概览\n核对参数摘要\n检查服务地址', '概览页加载完成\n显示220.5 kW与3.65 V\n显示127.0.0.1', '已确认'],
      ['UI-D2A-002', '告警筛选条件保留', '告警中心', '存在多级别告警数据', '级别：重要\n状态：未确认', '选择重要级别\n切换到未确认状态', '级别显示为重要\n列表仅保留未确认告警', '已确认'],
      ['UI-D2A-003', '导出按钮可见性待澄清', '报表中心', '用户已进入报表页面', '报表类型：日报', '选择日报\n查看导出区域', '日报被选中\n', '待确认'],
    ],
  },
  {
    file: 'UI_D2A_CASES_B.xlsx', sheet: '体验项目B', rows: [
      ['UI-D2A-B-001', '本地连接状态展示', '系统设置', '本机服务可访问', '地址：127.0.0.1\n版本：v1.2.3', '打开连接设置\n查看连接状态', '显示127.0.0.1\n状态显示为已连接', '已确认'],
    ],
  },
];

for (const dataset of datasets) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UI Test Workbench'; workbook.created = new Date('2026-09-22T00:00:00Z');
  const sheet = workbook.addWorksheet(dataset.sheet, { views:[{ state:'frozen', ySplit:1, showGridLines:false }] });
  sheet.addRow(headers); for (const row of dataset.rows) sheet.addRow(row);
  const header = sheet.getRow(1); header.height = 24;
  header.eachCell((cell) => { cell.font = { name:'Microsoft YaHei', size:10, bold:true, color:{ argb:'FFFFFFFF' } }; cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF202523' } }; cell.alignment = { horizontal:'center', vertical:'middle' }; });
  const widths = [18, 28, 16, 30, 34, 34, 36, 14];
  sheet.columns.forEach((column, index) => { column.width = widths[index]; });
  for (let row = 2; row <= dataset.rows.length + 1; row += 1) {
    sheet.getRow(row).height = 68;
    sheet.getRow(row).eachCell({ includeEmpty:true }, (cell) => { cell.font = { name:'Microsoft YaHei', size:10, color:{ argb:'FF202523' } }; cell.alignment = { vertical:'top', wrapText:true }; });
    sheet.getCell(row, 1).numFmt = '@';
  }
  await workbook.xlsx.writeFile(path.join(outputDir, dataset.file));
  console.log(JSON.stringify({ file:dataset.file, sheet:dataset.sheet, rows:dataset.rows.length }));
}
