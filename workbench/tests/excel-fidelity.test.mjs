import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inspectWorkbook, parseWorksheet } from '../server/cases/excel.mjs';

const fixture = fileURLToPath(new URL('./fixtures/m3a-excel-fidelity-boundary.xlsx', import.meta.url));
const mapping = {
  external_id: '用例编号', title: '标题', steps: '步骤', expected: '逐步预期', test_data: '测试数据', status: '内容状态',
};

test('real xlsx preserves numeric-looking text, physical rows and blank columns', async () => {
  const inspected = await inspectWorkbook(fixture);
  assert.deepEqual(inspected.sheets[0].headers, ['用例编号', '标题', '步骤', '逐步预期', '测试数据', '内容状态']);
  const parsed = await parseWorksheet(fixture, { sheet_name: '保真边界', mapping, upload_sha256: 'F'.repeat(64), file_name: 'm3a-excel-fidelity-boundary.xlsx' });
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows.map((item) => item.source_location.row), [2, 4]);
  assert.equal(parsed.rows[0].content.external_id, '001');
  assert.deepEqual(parsed.rows[0].content.steps.map((step) => step.action), ['220.5 kW', '3.65 V', '127.0.0.1', 'v1.2.3', '中文动作']);
  assert.deepEqual(parsed.rows[0].content.steps.map((step) => step.expected), ['保持 220.5 kW', '保持 3.65 V', '显示 127.0.0.1', '版本 v1.2.3', '中文预期']);
  assert.equal(parsed.rows[0].content.test_data, '功率：220.5 kW\n地址：127.0.0.1');
});

test('real xlsx keeps step and expected cell-line positions instead of compacting blanks', async () => {
  const parsed = await parseWorksheet(fixture, { sheet_name: '保真边界', mapping, upload_sha256: 'F'.repeat(64), file_name: 'm3a-excel-fidelity-boundary.xlsx' });
  const ambiguous = parsed.rows[1];
  assert.equal(ambiguous.content.status, 'PENDING_CONFIRMATION');
  assert.deepEqual(ambiguous.content.steps, [
    { order: 1, action: '动作一', expected: '预期一' },
    { order: 2, action: '动作三', expected: '' },
  ]);
  assert.deepEqual(ambiguous.issues.map((issue) => [issue.code, issue.cell_line]), [
    ['STEP_ACTION_MISSING', 2],
    ['STEP_EXPECTED_MISSING', 3],
  ]);
  assert.equal(ambiguous.issues[0].original_expected, '预期二');
  assert.equal(ambiguous.issues[1].original_action, '动作三');
});
