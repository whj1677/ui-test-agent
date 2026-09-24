import { test, expect } from '@playwright/test';

test('NEW-002 遥测首次失败后重试成功并关闭', async ({ page }) => {
  const entryUrl = process.env.PROBE_URL;

  await test.step('CASE_STEP_1: 打开该用例绑定入口（scene=retry，variant以入口配置为准）', async () => {
    await page.goto(entryUrl);

    // 期望：仅显示遥测读取相关控件
    const telemetryRegion = page.getByRole('region').filter({ has: page.getByRole('heading', { name: '遥测读取', exact: true }) });
    await expect(telemetryRegion).toBeVisible();
    await expect(page.getByRole('heading', { name: '遥测读取', exact: true })).toBeVisible();

    // 期望：按钮查看遥测可用
    const openButton = page.getByRole('button', { name: '查看遥测', exact: true });
    await expect(openButton).toBeVisible();
    await expect(openButton).toBeEnabled();

    // 期望：仅显示遥测读取相关控件（初始不应有其它可交互控件或已打开的详情）
    await expect(page.getByRole('dialog', { name: '遥测详情' })).toBeHidden();
    await expect(page.locator('main button')).toHaveCount(1);
  });

  await test.step('CASE_STEP_2: 点击查看遥测', async () => {
    await page.getByRole('button', { name: '查看遥测', exact: true }).click();

    // 期望：出现role=dialog且aria-label为遥测详情
    const dialog = page.getByRole('dialog', { name: '遥测详情' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', '遥测详情');

    // 期望：立即显示读取中…
    await expect(dialog.getByText('读取中…', { exact: true })).toBeVisible();

    // 期望：重试按钮禁用或不可见
    const retryButton = dialog.getByRole('button', { name: '重试', exact: true });
    const retryDisabled = await retryButton.isDisabled();
    const retryVisible = await retryButton.isVisible();
    expect(retryDisabled || !retryVisible).toBe(true);
  });

  await test.step('CASE_STEP_3: 等待约450毫秒', async () => {
    const dialog = page.getByRole('dialog', { name: '遥测详情' });
    const retryButton = dialog.getByRole('button', { name: '重试', exact: true });

    await page.waitForTimeout(450);

    // 期望：状态变为暂时无法读取
    await expect(dialog.getByText('暂时无法读取', { exact: true })).toBeVisible();

    // 期望：重试按钮可见且可用
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  await test.step('CASE_STEP_4: 点击重试', async () => {
    const dialog = page.getByRole('dialog', { name: '遥测详情' });
    const retryButton = dialog.getByRole('button', { name: '重试', exact: true });
    await retryButton.click();

    // 期望：立即显示读取中…
    await expect(dialog.getByText('读取中…', { exact: true })).toBeVisible();

    // 期望：重试按钮禁用
    await expect(retryButton).toBeDisabled();
  });

  await test.step('CASE_STEP_5: 再等待约650毫秒', async () => {
    const dialog = page.getByRole('dialog', { name: '遥测详情' });

    await page.waitForTimeout(650);

    // 期望：显示读取成功
    await expect(dialog.getByText('读取成功', { exact: true })).toBeVisible();

    // 期望：电压750 V
    await expect(dialog.getByText('电压', { exact: true })).toBeVisible();
    await expect(dialog.locator('strong').nth(0)).toHaveText('750 V');

    // 期望：采样时间2026-09-24 10:00:00
    await expect(dialog.getByText('采样时间', { exact: true })).toBeVisible();
    await expect(dialog.locator('strong').nth(1)).toHaveText('2026-09-24 10:00:00');
  });

  await test.step('CASE_STEP_6: 点击关闭', async () => {
    const dialog = page.getByRole('dialog', { name: '遥测详情' });
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();

    // 期望：遥测详情dialog不可见
    await expect(dialog).toBeHidden();
  });
});
