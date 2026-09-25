import { test, expect } from '@playwright/test';

test('KC-16 申请人空值与长度校验', async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const bookingDialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: '新建预约' }) });
  const applicant = bookingDialog.getByRole('textbox', { name: '申请人' });
  const purpose = bookingDialog.getByRole('textbox', { name: '用途' });
  const dateField = bookingDialog.getByRole('textbox', { name: '日期' });
  const startField = bookingDialog.getByRole('combobox', { name: '开始整点' });
  const endField = bookingDialog.getByRole('combobox', { name: '结束整点' });
  const nextButton = bookingDialog.getByRole('button', { name: '下一步' });
  const backButton = bookingDialog.getByRole('button', { name: '返回' });
  const applicantError = bookingDialog.getByText('申请人必填，去两端空白后长度需为2到20字', { exact: true });
  const confirmHeading = bookingDialog.getByRole('heading', { name: '确认信息' });

  await test.step('CASE_STEP_1', async () => {
    await page.getByRole('checkbox', { name: '选择EQ-101' }).check();
    await page.getByRole('button', { name: '批量预约' }).click();
    await expect(bookingDialog).toBeVisible();
    await nextButton.click();
    await expect(applicant).toBeVisible();

    await applicant.fill('   ');
    await purpose.fill('可靠性摸底测试');
    await nextButton.click();

    await expect(applicantError).toBeVisible();
    await expect(confirmHeading).toHaveCount(0);
    await expect(purpose).toBeVisible();
    await expect(applicant).toHaveValue('   ');
    await expect(purpose).toHaveValue('可靠性摸底测试');
  });

  await test.step('CASE_STEP_2', async () => {
    await applicant.fill('李');
    await nextButton.click();

    await expect(applicantError).toBeVisible();
    await expect(confirmHeading).toHaveCount(0);
    await expect(applicant).toHaveValue('李');
  });

  await test.step('CASE_STEP_3', async () => {
    const dateBefore = await dateField.inputValue();
    const startBefore = await startField.inputValue();
    const endBefore = await endField.inputValue();

    await applicant.fill('李四');
    await nextButton.click();

    await expect(confirmHeading).toBeVisible();
    await expect(bookingDialog.getByRole('button', { name: '确认预约' })).toBeVisible();

    await backButton.click();

    await expect(applicant).toBeVisible();
    await expect(applicant).toHaveValue('李四');
    await expect(purpose).toHaveValue('可靠性摸底测试');
    await expect(dateField).toHaveValue(dateBefore);
    await expect(startField).toHaveValue(startBefore);
    await expect(endField).toHaveValue(endBefore);
  });
});
