import { test, expect } from '@playwright/test';

const PROBE_URL = process.env.PROBE_URL;

test('西站检修设备组合查询（入口 /ui/a）', async ({ page }) => {
  const stationFilter = page.locator('#station-filter');
  const statusFilter = page.locator('#status-filter');
  const sortFilter = page.locator('#sort-filter');
  const queryButton = page.getByRole('button', { name: '查询', exact: true });
  const resultCount = page.locator('#result-count');
  const deviceRows = page.locator('#device-rows tr');

  await test.step('CASE_STEP_1: S01 打开指定入口，查看初始设备列表', async () => {
    await page.goto(PROBE_URL);

    await expect(resultCount).toHaveText('共6条');
    await expect(deviceRows).toHaveCount(6);
    await expect(deviceRows.locator('td:first-child')).toHaveText([
      'DEV-001',
      'DEV-002',
      'DEV-003',
      'DEV-004',
      'DEV-005',
      'DEV-006',
    ]);
  });

  await test.step('CASE_STEP_2: S02 选择“西站”和“检修”，暂不点击查询', async () => {
    await stationFilter.selectOption({ label: '西站' });
    await statusFilter.selectOption({ label: '检修' });

    await expect(stationFilter).toHaveValue('西站');
    await expect(stationFilter.locator('option:checked')).toHaveText('西站');
    await expect(statusFilter).toHaveValue('检修');
    await expect(statusFilter.locator('option:checked')).toHaveText('检修');
    await expect(sortFilter).toHaveValue('ID_ASC');

    await expect(resultCount).toHaveText('共6条');
    await expect(deviceRows).toHaveCount(6);
  });

  await test.step('CASE_STEP_3: S03 点击“查询”，核对结果数量和设备行', async () => {
    await queryButton.click();

    await expect(resultCount).toHaveText('共2条');
    await expect(deviceRows).toHaveCount(2);
    await expect(deviceRows.locator('td:first-child')).toHaveText([
      'DEV-002',
      'DEV-005',
    ]);
    await expect(page.locator('#device-rows tr[data-device-id="DEV-004"]')).toHaveCount(0);
    await expect(deviceRows.filter({ hasText: 'DEV-004' })).toHaveCount(0);
  });
});
