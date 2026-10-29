import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../../web-v2/test-case-template.xlsx');
const bundledModules = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const supportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-case-template-'));
await fs.symlink(bundledModules, path.join(supportDir, 'node_modules'), 'junction');
const resolveFromBundle = createRequire(path.join(supportDir, 'entry.cjs'));
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(resolveFromBundle.resolve('@oai/artifact-tool')).href);
const JSZip = resolveFromBundle('jszip');

const headers = ['用例编号', '用例标题', '模块', '前置条件', '测试数据', '测试步骤', '预期结果', '内容状态', '优先级', '测试类型', '实际结果', '用例层级'];
const widths = [18, 28, 18, 28, 25, 45, 45, 17, 13, 15, 19, 15];
const workbook = Workbook.create();
const input = workbook.worksheets.add('用例填写');
const guide = workbook.worksheets.add('填写示例与说明');

function formatColumns(sheet, lastRow) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:L${lastRow}`).format.font = { name: 'Arial', size: 10, color: '#202B3A' };
  sheet.getRange(`A1:L${lastRow}`).format.verticalAlignment = 'top';
  sheet.getRange(`A1:L${lastRow}`).format.wrapText = true;
  widths.forEach((width, index) => {
    const letter = String.fromCharCode(65 + index);
    sheet.getRange(`${letter}1:${letter}${lastRow}`).format.columnWidth = width;
  });
}

function formatHeader(sheet, row) {
  const header = sheet.getRange(`A${row}:L${row}`);
  header.format.fill = '#244A6C';
  header.format.font = { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' };
  header.format.horizontalAlignment = 'center';
  header.format.verticalAlignment = 'center';
  header.format.rowHeight = 31;
  header.format.borders = { preset: 'inside', style: 'thin', color: '#FFFFFF' };
}

formatColumns(input, 51);
input.getRange('A1:L1').values = [headers];
formatHeader(input, 1);
input.getRange('A2:L51').format.rowHeight = 56;
input.getRange('A2:A51').setNumberFormat('@');
input.getRange('H2:H51').dataValidation = { rule: { type: 'list', values: ['待确认', '已确认'] } };
input.getRange('L2:L51').dataValidation = { rule: { type: 'list', values: ['UI', 'BACKEND'] } };
input.freezePanes.freezeRows(1);
input.tabColor = '#244A6C';

formatColumns(guide, 17);
guide.getRange('A1').values = [['虚构填写示例']];
guide.getRange('A1').format.font = { name: 'Arial', size: 13, bold: true, color: '#244A6C' };
guide.getRange('A1:L1').format.rowHeight = 34;
guide.getRange('A2:L2').values = [headers];
formatHeader(guide, 2);
guide.getRange('A3:L4').values = [
  ['EXAMPLE-001', '示例列表按名称筛选', '虚构列表', '从已登录首页开始；左侧有“示例管理”菜单，列表已有样例A和样例B', '关键词：样例A', '1. 点击左侧“示例管理”\n2. 点击子菜单“示例列表”\n3. 在“名称”输入框输入“样例A”\n4. 点击“查询”', '1. 展开子菜单，显示“示例列表”\n2. 打开示例列表，显示样例A和样例B\n3. 名称输入框显示样例A\n4. 列表仅显示样例A', '待确认', '中', '正向', '', 'UI'],
  ['EXAMPLE-002', '示例表单必填校验', '虚构表单', '已打开虚构新增表单', '名称留空', '1. 保持名称为空\n2. 点击保存', '1. 名称仍为空\n2. 提示名称不能为空，记录未保存', '待确认', '中', '反向', '', 'UI'],
];
guide.getRange('A3:K4').format.rowHeight = 83;
guide.getRange('A3:L3').format.rowHeight = 118;
guide.getRange('A3:A4').setNumberFormat('@');
guide.getRange('A3:L4').format.fill = '#F5F8FB';
guide.getRange('A6:K6').merge();
guide.getRange('A6').values = [['填写说明']];
guide.getRange('A6:K6').format.font = { name: 'Arial', size: 11, bold: true, color: '#244A6C' };
guide.getRange('A6:K6').format.rowHeight = 27;
const notes = [
  '只在“用例填写”工作表填写真用例。本页两条记录均为虚构示例，不参与导入。',
  '测试步骤与预期结果建议按单元格内换行逐行对应；每个动作有对应预期。',
  '原用例若以一句话描述复合操作或预期，可以保留完整原句，不凭猜测拆分或补写断言。',
  '“实际结果”若来自历史人工测试，仅作为原始参考；新执行结果由 Agent 另行记录。',
  '内容未经人工确认时留空或填“待确认”；不默认“已确认”。无需补录 UI 定位、API 协议或费用等技术信息。',
  '用例层级必填：浏览器前端填 UI，接口填 BACKEND。两者分别准备运行，不能用“正向/反向”替代层级。',
  '用例编号、标题、测试步骤、逐步预期必须填写。编号作为文本保持唯一；单元格换行用 Alt+Enter，不合并数据行。',
  '前置条件写明账号角色、已授权的测试数据与数据恢复要求；涉及计算时提供独立台账、公式、单位和误差范围。',
  '优先级、测试类型、历史实际结果仅作为源文件参考保留，不决定 Agent 的执行成绩；不要在模板里预填新一轮“通过”。',
  '多级导航必须写明起始页面及点击顺序，例如：首页 → 左侧“示例管理” → 子菜单“示例列表” → “新增”。不要只写“进入新增页面”。',
  '一步一个明确动作，使用界面上可见的名称，并写对应可观察预期。相同路径仍须写清，可复制复用；无需填写选择器或代码。',
];
notes.forEach((note, index) => {
  const row = 7 + index;
  guide.getRange(`A${row}:K${row}`).merge();
  guide.getRange(`A${row}`).values = [[note]];
  guide.getRange(`A${row}:K${row}`).format.rowHeight = 29;
});
guide.tabColor = '#9AAABA';

workbook.recalculate();
for (const [sheetName, range, imageName] of [
  ['用例填写', 'A1:L5', 'main-preview.png'],
  ['填写示例与说明', 'A1:L17', 'guide-preview.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(here, imageName), new Uint8Array(await preview.arrayBuffer()));
}
const check = await workbook.inspect({ kind: 'table', range: '用例填写!A1:K4', include: 'values,formulas', tableMaxRows: 4, tableMaxCols: 11, maxChars: 3000 });
console.log(check.ndjson);
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(output);
// The bundled exporter qualifies SpreadsheetML tags with x:. This workbench's
// ExcelJS reader expects unqualified tag names, so normalize only XML tag
// prefixes while retaining both namespace declarations and workbook content.
const zip = await JSZip.loadAsync(await fs.readFile(output));
const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
for (const name of Object.keys(zip.files).filter((item) => /^xl\/(?:workbook|styles|sharedStrings|worksheets\/sheet\d+)\.xml$/.test(item))) {
  const xml = await zip.file(name).async('string');
  if (!xml.includes(`xmlns:x="${spreadsheetNamespace}"`)) continue;
  zip.file(name, xml.replace(`xmlns:x="${spreadsheetNamespace}"`, `xmlns="${spreadsheetNamespace}" xmlns:x="${spreadsheetNamespace}"`).replace(/(<\/?)x:/g, '$1'));
}
await fs.writeFile(output, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
await fs.rm(`${output}.inspect.ndjson`, { force: true });
console.log(output);
