import { test, expect } from '@playwright/test';

test('KC-22 紧接结束边界允许并刷新保持', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const stats = page.getByRole('region', { name: '统计' });
  const statValue = (label) => stats.locator('div', { hasText: label }).locator('b');
  const deviceTable = page.getByRole('table', { name: '设备列表' });
  const bookingDialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: '新建预约' }) });
  const recordsTable = page.getByRole('table', { name: '预约记录' });
  const recordRow = (id) => recordsTable.getByRole('row').filter({ hasText: id });

  // 前置条件：独立重置演示数据，保证基线只有 R-001。
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置演示数据' }).click();
  await expect(statValue('已确认预约')).toHaveText('1');
  await expect(statValue('已确认收入')).toHaveText('40');

  await test.step('CASE_STEP_1', async () => {
    await deviceTable.getByRole('checkbox', { name: '选择EQ-103' }).check();
    await expect(page.locator('div').filter({ hasText: /^已选 1 项/ })).toBeVisible();
    await page.getByRole('button', { name: '批量预约' }).click();

    await expect(bookingDialog.getByRole('heading', { name: '已选设备' })).toBeVisible();
    await expect(bookingDialog).toContainText('EQ-103');
    await expect(bookingDialog).toContainText('示波器');
    await expect(bookingDialog).toContainText('20元/小时');
    await bookingDialog.getByRole('button', { name: '下一步' }).click();

    const applicant = bookingDialog.getByRole('textbox', { name: '申请人' });
    await applicant.fill('钱七');
    const dateField = bookingDialog.getByRole('textbox', { name: '日期' });
    await dateField.fill('2026-10-10');
    const startHour = bookingDialog.getByRole('combobox', { name: '开始整点' });
    // 按界面可见文本选择整点，并断言当前选中的可见标签（HTML option value 不是业务值）。
    await startHour.selectOption({ label: '12:00' });
    await expect(startHour.locator('option:checked')).toHaveText('12:00');
    const endHour = bookingDialog.getByRole('combobox', { name: '结束整点' });
    await endHour.selectOption({ label: '14:00' });
    await expect(endHour.locator('option:checked')).toHaveText('14:00');
    const purpose = bookingDialog.getByRole('textbox', { name: '用途' });
    await purpose.fill('边界回归验证');

    await expect(applicant).toHaveValue('钱七');
    await expect(dateField).toHaveValue('2026-10-10');
    await expect(purpose).toHaveValue('边界回归验证');

    await bookingDialog.getByRole('button', { name: '下一步' }).click();

    await expect(bookingDialog.getByRole('heading', { name: '确认信息' })).toBeVisible();
    const infoLine = bookingDialog.locator('p', { hasText: '申请人' });
    await expect(infoLine).toContainText('EQ-103');
    await expect(infoLine).toContainText('2026-10-10 12:00-14:00');
    await expect(infoLine).toContainText('钱七');
    await expect(infoLine).toContainText('边界回归验证');
    const priceLine = bookingDialog.locator('p', { hasText: '总价：' });
    await expect(priceLine).toContainText('时长：2小时');
    await expect(priceLine).toContainText('小时费合计：20元');
    await expect(priceLine).toContainText('总价：40元');
    await expect(bookingDialog.getByRole('button', { name: '确认预约' })).toBeEnabled();
  });

  await test.step('CASE_STEP_2', async () => {
    await bookingDialog.getByRole('button', { name: '确认预约' }).click();
    await expect(bookingDialog).toBeHidden();
    await expect(page.getByRole('heading', { name: '预约记录' })).toBeVisible();

    await expect(recordsTable.getByRole('row')).toHaveCount(3);
    const rowR1 = recordRow('R-001');
    const rowR2 = recordRow('R-002');
    await expect(rowR1).toHaveCount(1);
    await expect(rowR2).toHaveCount(1);
    await expect(rowR1.getByRole('cell').nth(0)).toHaveText('R-001');
    await expect(rowR1.getByRole('cell').nth(6)).toHaveText('已确认');
    await expect(rowR2.getByRole('cell').nth(0)).toHaveText('R-002');
    await expect(rowR2.getByRole('cell').nth(1)).toContainText('EQ-103');
    await expect(rowR2.getByRole('cell').nth(2)).toHaveText('2026-10-10 12:00至14:00');
    await expect(rowR2.getByRole('cell').nth(3)).toHaveText('钱七');
    await expect(rowR2.getByRole('cell').nth(4)).toHaveText('边界回归验证');
    await expect(rowR2.getByRole('cell').nth(5)).toHaveText('40元');
    await expect(rowR2.getByRole('cell').nth(6)).toHaveText('已确认');

    await page.getByRole('button', { name: '设备资源' }).click();
    await expect(page.locator('div').filter({ hasText: /^已选 0 项/ })).toBeVisible();
    await expect(deviceTable.getByRole('checkbox', { name: '选择EQ-103' })).not.toBeChecked();
    await expect(page.getByRole('button', { name: '批量预约' })).toBeDisabled();
  });

  await test.step('CASE_STEP_3', async () => {
    await page.reload();
    await expect(statValue('已确认预约')).toHaveText('2');
    await expect(statValue('已确认收入')).toHaveText('80');

    await page.getByRole('button', { name: '预约记录' }).click();
    await expect(page.getByRole('heading', { name: '预约记录' })).toBeVisible();
    await expect(recordsTable.getByRole('row')).toHaveCount(3);
    const rowR1 = recordRow('R-001');
    const rowR2 = recordRow('R-002');
    await expect(rowR1).toHaveCount(1);
    await expect(rowR2).toHaveCount(1);
    await expect(rowR1.getByRole('cell').nth(0)).toHaveText('R-001');
    await expect(rowR1.getByRole('cell').nth(6)).toHaveText('已确认');
    await expect(rowR2.getByRole('cell').nth(0)).toHaveText('R-002');
    await expect(rowR2.getByRole('cell').nth(2)).toHaveText('2026-10-10 12:00至14:00');
    await expect(rowR2.getByRole('cell').nth(6)).toHaveText('已确认');
  });
});
