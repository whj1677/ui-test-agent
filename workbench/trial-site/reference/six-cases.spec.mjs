import { test, expect } from '@playwright/test';

async function expectDefault(page) {
  await expect(page.getByRole('heading', { name:'设备台账' })).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('共6条');
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await expect(page.locator('tbody tr').first()).toContainText('DEV-001');
  await expect(page.locator('tbody tr').last()).toContainText('DEV-006');
}

function queryCase(id, route) {
  test(`${id} 西站检修设备组合查询`, async ({ page }) => {
    await test.step('S01 打开设备台账并确认初始列表', async () => {
      await page.goto(`/ui/${route}`);
      await expectDefault(page);
    });
    await test.step('S02 选择西站和检修，查询前列表不变化', async () => {
      await page.locator('#station-filter').selectOption('西站');
      await page.locator('#status-filter').selectOption('检修');
      await expect(page.locator('#result-count')).toHaveText('共6条');
    });
    await test.step('S03 点击查询并核对结果', async () => {
      await page.getByRole('button', { name:'查询' }).click();
      await expect(page.locator('#result-count')).toHaveText('共2条');
      await expect(page.locator('tbody tr')).toHaveCount(2);
      await expect(page.locator('tbody tr').nth(0)).toContainText('DEV-002');
      await expect(page.locator('tbody tr').nth(1)).toContainText('DEV-005');
      await expect(page.locator('tbody')).not.toContainText('DEV-004');
    });
  });
}

function sortCase(id, route) {
  test(`${id} 额定功率降序排列`, async ({ page }) => {
    await test.step('S01 打开设备台账并选择额定功率降序', async () => {
      await page.goto(`/ui/${route}`);
      await expectDefault(page);
      await page.locator('#sort-filter').selectOption('POWER_DESC');
      await expect(page.locator('tbody tr').first()).toContainText('DEV-001');
    });
    await test.step('S02 点击查询并核对完整行顺序', async () => {
      await page.getByRole('button', { name:'查询' }).click();
      const ids = await page.locator('tbody tr td:first-child').allTextContents();
      expect(ids).toEqual(['DEV-005','DEV-006','DEV-002','DEV-004','DEV-001','DEV-003']);
      await expect(page.locator('tbody tr').nth(1)).toContainText('DEV-006');
      await expect(page.locator('tbody tr').nth(1)).toContainText('140 kW');
    });
  });
}

function detailCase(id, route) {
  test(`${id} 查看 DEV-005 设备详情`, async ({ page }) => {
    await test.step('S01 打开 DEV-005 详情', async () => {
      await page.goto(`/ui/${route}`);
      await expectDefault(page);
      await page.locator('tr[data-device-id="DEV-005"]').getByRole('button', { name:'详情' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('#detail-title')).toHaveText('设备详情 · DEV-005');
    });
    await test.step('S02 核对 DEV-005 详情字段', async () => {
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('[data-field="id"]')).toHaveText('DEV-005');
      await expect(dialog.locator('[data-field="name"]')).toHaveText('冷却泵');
      await expect(dialog.locator('[data-field="station"]')).toHaveText('西站');
      await expect(dialog.locator('[data-field="status"]')).toHaveText('检修');
      await expect(dialog.locator('[data-field="power"]')).toHaveText('220 kW');
    });
    await test.step('S03 关闭详情', async () => {
      await page.getByRole('button', { name:'关闭', exact:true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
}

queryCase('TC-001', 'a');
sortCase('TC-002', 'c');
detailCase('TC-003', 'e');
queryCase('TC-004', 'b');
sortCase('TC-005', 'd');
detailCase('TC-006', 'f');
