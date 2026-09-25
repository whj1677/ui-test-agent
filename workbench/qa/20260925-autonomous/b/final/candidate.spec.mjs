import { test, expect } from '@playwright/test';

test('NEW-002 遥测首次失败后重试成功并关闭', async ({ page }) => {
  const telemetryRegion = page.getByRole('region');
  const openButton = telemetryRegion.getByRole('button', { name: '查看遥测' });
  const dialog = page.getByRole('dialog', { name: '遥测详情' });
  const retry = dialog.getByRole('button', { name: '重试' });
  const loading = dialog.getByText('读取中…', { exact: true });

  // 步骤 2/4：读取过程中重试按钮必须处于禁用状态，或者根本不显示。
  const expectRetryUnavailable = async () => {
    if (await retry.isVisible()) {
      await expect(retry).toBeDisabled();
    } else {
      await expect(retry).toBeHidden();
    }
  };

  await test.step('CASE_STEP_1', async () => {
    await page.goto(process.env.PROBE_URL);
    // 仅显示遥测读取相关控件：该区域内只有“查看遥测”一个可见控件，且可用。
    await expect(openButton).toBeVisible();
    await expect(openButton).toBeEnabled();
    await expect(telemetryRegion.locator('button:visible')).toHaveCount(1);
  });

  await test.step('CASE_STEP_2', async () => {
    await openButton.click();
    await expect(dialog).toBeVisible();
    await expect(loading).toBeVisible();
    await expectRetryUnavailable();
  });

  await test.step('CASE_STEP_3', async () => {
    await expect(dialog.getByText('暂时无法读取', { exact: true })).toBeVisible();
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
  });

  await test.step('CASE_STEP_4', async () => {
    await retry.click();
    await expect(loading).toBeVisible();
    await expectRetryUnavailable();
  });

  await test.step('CASE_STEP_5', async () => {
    await expect(dialog.getByText('读取成功', { exact: true })).toBeVisible();
    await expect(dialog.getByText('750 V', { exact: true })).toBeVisible();
    await expect(dialog.getByText('2026-09-24 10:00:00', { exact: true })).toBeVisible();
  });

  await test.step('CASE_STEP_6', async () => {
    await dialog.getByRole('button', { name: '关闭' }).click();
    await expect(dialog).toBeHidden();
  });
});
