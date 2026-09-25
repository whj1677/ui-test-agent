import { test, expect } from '@playwright/test';

const DEVICE_TABLE_NAME = '设备列表';

function deviceTable(page) {
  return page.getByRole('table', { name: DEVICE_TABLE_NAME });
}

function dataRows(page) {
  return deviceTable(page).locator('tbody tr');
}

// 分页摘要与上一页/下一页按钮同处一个容器；用稳定的“上一页”控件定位该容器。
function pagerSummary(page) {
  return page.getByRole('button', { name: '上一页', exact: true }).locator('..');
}

// 依据“编号”列表头解析列序号，再把编号值绑定到该列的单元格上。
async function idColumnCells(page) {
  const table = deviceTable(page);
  const headers = table.getByRole('columnheader');
  const headerCount = await headers.count();
  let columnIndex = -1;
  for (let index = 0; index < headerCount; index += 1) {
    const label = (await headers.nth(index).innerText()).replace(/\s+/g, '');
    if (label === '编号') {
      columnIndex = index;
      break;
    }
  }
  if (columnIndex < 0) {
    throw new Error('设备列表缺少“编号”列，无法绑定编号字段');
  }
  return table.locator(`tbody tr td:nth-child(${columnIndex + 1})`);
}

test('KC-06 无结果与重置恢复', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const searchBox = page.getByRole('searchbox', { name: '搜索编号或名称' });
  const stationControl = page.getByRole('button', { name: /^站点/ });
  const idleCheckbox = page.getByRole('checkbox', { name: '空闲' });
  const inUseCheckbox = page.getByRole('checkbox', { name: '使用中' });
  const maintainCheckbox = page.getByRole('checkbox', { name: '维护' });
  const sortSelect = page.getByRole('combobox', { name: '排序' });
  const resetButton = page.getByRole('button', { name: '重置', exact: true });
  const emptyHint = page.getByText('没有匹配设备');
  const selectionSummary = page.getByText('跨页选择会保留');

  await test.step('CASE_STEP_1', async () => {
    await searchBox.fill('EQ-999');

    await expect(emptyHint).toBeVisible();
    await expect(dataRows(page)).toHaveCount(0);
    await expect(pagerSummary(page)).toContainText(/共\s*0\s*条/);
    await expect(pagerSummary(page)).toContainText(/第\s*1\s*\/\s*1\s*页/);
    await expect(page.getByRole('button', { name: '上一页' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled();
  });

  await test.step('CASE_STEP_2', async () => {
    await resetButton.click();

    await expect(searchBox).toHaveValue('');
    await expect(stationControl).toContainText('全部');
    await expect(idleCheckbox).not.toBeChecked();
    await expect(inUseCheckbox).not.toBeChecked();
    await expect(maintainCheckbox).not.toBeChecked();
    await expect(sortSelect.locator('option:checked')).toHaveText('编号升序');

    await expect(dataRows(page)).toHaveCount(3);
    await expect(await idColumnCells(page)).toHaveText(['EQ-101', 'EQ-102', 'EQ-103']);
    await expect(pagerSummary(page)).toContainText(/共\s*8\s*条/);
  });

  await test.step('CASE_STEP_3', async () => {
    await expect(selectionSummary).toContainText(/已选\s*0\s*项/);
    await expect(page.getByRole('button', { name: '批量预约' })).toBeDisabled();
  });
});
