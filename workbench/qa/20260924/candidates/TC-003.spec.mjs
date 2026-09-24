import { test, expect } from '@playwright/test';

// TC-003 查看 DEV-005 设备详情（入口 /ui/e）
// 模块：设备台账 / 设备详情
// 前置条件：已启动 TEST-SITE-01；初始列表包含 DEV-005；当前入口可访问。
// 测试数据：目标设备=DEV-005；设备名称=冷却泵；额定功率=220 kW；入口由环境变量 PROBE_URL 提供
test.describe('TC-003 查看 DEV-005 设备详情（入口 /ui/e）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(process.env.PROBE_URL);
  });

  test('查看 DEV-005 设备详情（入口 /ui/e）', async ({ page }) => {
    const deviceRow = page.getByRole('row').filter({ hasText: 'DEV-005' });
    const detailDialog = page.getByRole('dialog', { name: '设备详情 · DEV-005' });
    const detailValue = (field) => detailDialog.locator(`dd[data-field="${field}"]`);

    await test.step('CASE_STEP_1：S01 在 DEV-005 行点击“详情”', async () => {
      await expect(deviceRow).toBeVisible();
      await deviceRow.getByRole('button', { name: '详情', exact: true }).click();

      // 期望：打开标题为“设备详情 · DEV-005”的弹窗
      await expect(detailDialog).toBeVisible();
      await expect(
        detailDialog.getByRole('heading', { name: '设备详情 · DEV-005', exact: true }),
      ).toBeVisible();
    });

    await test.step('CASE_STEP_2：S02 核对详情中的设备编号、名称、站点、状态和额定功率', async () => {
      await expect(detailDialog).toBeVisible();

      // 期望：显示 DEV-005、冷却泵、西站、检修、220 kW
      await expect(detailDialog.getByText('设备编号', { exact: true })).toBeVisible();
      await expect(detailValue('id')).toHaveText('DEV-005');

      await expect(detailDialog.getByText('设备名称', { exact: true })).toBeVisible();
      await expect(detailValue('name')).toHaveText('冷却泵');

      await expect(detailDialog.getByText('所属站点', { exact: true })).toBeVisible();
      await expect(detailValue('station')).toHaveText('西站');

      await expect(detailDialog.getByText('状态', { exact: true })).toBeVisible();
      await expect(detailValue('status')).toHaveText('检修');

      await expect(detailDialog.getByText('额定功率', { exact: true })).toBeVisible();
      await expect(detailValue('power')).toHaveText('220 kW');
    });

    await test.step('CASE_STEP_3：S03 点击“关闭”', async () => {
      await detailDialog.getByRole('button', { name: '关闭', exact: true }).click();

      // 期望：详情弹窗关闭并返回设备列表
      await expect(detailDialog).toBeHidden();
      await expect(page.getByRole('heading', { name: '设备列表', exact: true })).toBeVisible();
      await expect(deviceRow).toBeVisible();
    });
  });
});
