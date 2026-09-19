import test from 'node:test';
import assert from 'node:assert/strict';
import { needsTableBaseline } from '../src/table-invariant.mjs';
import { validateAssertion } from '../src/plans.mjs';

for (const text of [
  '表格内容与操作前完全一致',
  '列表数据与本步骤操作前相同',
  '表格与当前步骤操作前保持一致',
  '列表仍未应用条件',
  '表格内容和操作前完全相同',
])
  test(`same-step pre-action table relation: ${text}`, () => {
    assert.equal(needsTableBaseline(text), true);
    validateAssertion(
      {
        target: { kind: 'role', role: 'table', name: '结果', exact: true },
        check: 'table_unchanged',
        oracle_quote: text,
        obligation_ids: ['1-O1'],
      },
      { step_id: '1', action: '填写查询条件', expected: text, obligations: [{ id: '1-O1', text }] },
    );
  });
for (const text of [
  '表格不要求与操作前完全一致',
  '表格无需与操作前完全一致',
  '如果表格内容与操作前完全一致则继续',
  '表格内容与操作前完全一致或已更新',
  '表格内容与操作前完全一致不成立',
  '表格与上一步操作前完全一致',
  '表格与历史操作前完全一致',
  '字段内容与操作前完全一致',
  '表格与基准文件完全一致',
  '表格与操作前不一致',
  '表格与操作后完全一致',
  '例如表格内容与操作前完全一致',
  '表格与操作前完全一致或继续刷新',
  '列表未应用条件或数据已更新',
  '表格记录数与操作前完全一致',
])
  test(`not a current-step table invariant: ${text}`, () =>
    assert.equal(needsTableBaseline(text), false));
