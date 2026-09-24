import { test, expect } from '@playwright/test';

test('NEW-003 两步维护申请校验、回退保留并生成预览', async ({ page }) => {
  await test.step('CASE_STEP_1: 打开该用例绑定入口（scene=wizard，variant以入口配置为准）', async () => {
    await page.goto(process.env.PROBE_URL);

    await expect(page.locator('#wStep1')).toBeVisible();
    await expect(page.locator('#wStep2')).toBeHidden();

    await expect(page.getByLabel('申请人（必填）')).toBeVisible();
    await expect(page.getByLabel('申请人（必填）')).toBeEditable();
    await expect(page.getByLabel('数量（整数1至5）')).toBeVisible();
    await expect(page.getByLabel('数量（整数1至5）')).toBeEditable();

    await expect(page.getByRole('button', { name: '下一步' })).toBeVisible();
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
  });

  await test.step('CASE_STEP_2: 申请人与数量均留空，点击下一步', async () => {
    await expect(page.locator('#wName')).toHaveValue('');
    await expect(page.locator('#wQty')).toHaveValue('');

    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.locator('#wErr')).toHaveText('请填写申请人');
    await expect(page.locator('#wStep1')).toBeVisible();
    await expect(page.locator('#wStep2')).toBeHidden();
  });

  await test.step('CASE_STEP_3: 填写申请人为测试员、数量为6，点击下一步', async () => {
    await page.locator('#wName').fill('测试员');
    await page.locator('#wQty').fill('6');

    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.locator('#wErr')).toHaveText('数量须为1至5的整数');
    await expect(page.locator('#wStep1')).toBeVisible();
    await expect(page.locator('#wStep2')).toBeHidden();
  });

  await test.step('CASE_STEP_4: 将数量改为2，点击下一步', async () => {
    await page.locator('#wQty').fill('2');

    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.locator('#wStep2')).toBeVisible();
    await expect(page.locator('#wStep1')).toBeHidden();
    await expect(page.locator('#wSummary')).toHaveText('申请人：测试员；数量：2');
  });

  await test.step('CASE_STEP_5: 点击上一步确认申请人测试员和数量2仍保留，再次点击下一步', async () => {
    await page.getByRole('button', { name: '上一步' }).click();

    await expect(page.locator('#wStep1')).toBeVisible();
    await expect(page.locator('#wStep2')).toBeHidden();
    await expect(page.locator('#wName')).toHaveValue('测试员');
    await expect(page.locator('#wQty')).toHaveValue('2');

    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.locator('#wStep2')).toBeVisible();
    await expect(page.locator('#wSummary')).toHaveText('申请人：测试员；数量：2');
  });

  await test.step('CASE_STEP_6: 勾选我已核对，点击生成预览', async () => {
    await page.locator('#wAgree').check();
    await expect(page.locator('#wAgree')).toBeChecked();

    await page.getByRole('button', { name: '生成预览' }).click();

    const preview = page.locator('#wPreview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText('预览申请人测试员数量2状态仅预览，未提交');

    const cells = preview.locator('.kv > span');
    await expect(cells.nth(0)).toHaveText('申请人');
    await expect(cells.nth(1)).toHaveText('测试员');
    await expect(cells.nth(2)).toHaveText('数量');
    await expect(cells.nth(3)).toHaveText('2');
    await expect(cells.nth(4)).toHaveText('状态');
    await expect(cells.nth(5)).toHaveText('仅预览，未提交');

    await expect(page.getByRole('button', { name: /提交|保存|上传/ })).toHaveCount(0);
    const stored = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    expect(stored.local).toBe(0);
    expect(stored.session).toBe(0);
  });
});
