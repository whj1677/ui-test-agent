import { test, expect } from '@playwright/test';

// 用例：额定功率降序排列（入口 /ui/c）
// 前置：设备固定数据为 DEV-001 至 DEV-006；站点=全部站点；状态=全部状态。
test('额定功率降序排列（入口 /ui/c）', async ({ page }) => {
  const deviceRows = page.locator('table tbody tr');

  await test.step('CASE_STEP_1: 打开指定入口并选择额定功率降序，暂不点击查询', async () => {
    await page.goto(process.env.PROBE_URL);

    await page.getByRole('combobox', { name: '排序方式' }).selectOption('额定功率降序');

    // 预期：初始仍显示共6条，第一行为 DEV-001
    await expect(page.getByText('共6条', { exact: true })).toBeVisible();
    await expect(deviceRows).toHaveCount(6);
    await expect(deviceRows.first()).toContainText('DEV-001');
  });

  await test.step('CASE_STEP_2: 点击查询，核对六条完整设备行顺序', async () => {
    await page.getByRole('button', { name: '查询' }).click();

    // 预期：顺序为 DEV-005、DEV-006、DEV-002、DEV-004、DEV-001、DEV-003
    const expectedOrder = [
      'DEV-005',
      'DEV-006',
      'DEV-002',
      'DEV-004',
      'DEV-001',
      'DEV-003',
    ];

    await expect(deviceRows).toHaveCount(expectedOrder.length);

    for (let index = 0; index < expectedOrder.length; index += 1) {
      await expect(deviceRows.nth(index)).toContainText(expectedOrder[index]);
    }

    // 预期：第2行为 DEV-006 / 排水泵 / 东站 / 运行 / 140 kW
    const secondRowCells = deviceRows.nth(1).locator('td');
    await expect(secondRowCells.nth(0)).toHaveText('DEV-006');
    await expect(secondRowCells.nth(1)).toHaveText('排水泵');
    await expect(secondRowCells.nth(2)).toHaveText('东站');
    await expect(secondRowCells.nth(3)).toHaveText('运行');
    await expect(secondRowCells.nth(4)).toHaveText('140 kW');
  });
});
