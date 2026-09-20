import { test, expect } from '@playwright/test';

// spec: HOLD-S1 工作区七功率排序核对
// seed: seed.spec.ts

test.describe('工作区七功率排序核对', () => {
  test('工作区七功率排序核对', async ({ page }) => {
    const table = page.getByRole('table', { name: '巡检任务列表' });
    const rows = table.locator('tbody tr');
    const sortSelect = page.getByLabel('排序');

    // S01: 在全新独立浏览器上下文直接打开 http://localhost:4198/probe/s1
    await test.step('S01', async () => {
      await page.goto(process.env.PILOT_ENTRY_URL || 'http://localhost:4198/probe/s1');

      // 默认计数器“共12条 · 第1/4页”
      await expect(page.getByText('共12条 · 第1/4页')).toBeVisible();
      // 排序为编号升序
      await expect(sortSelect).toHaveValue('id-asc');
      // 表体恰好3条数据行而非12条当前行
      await expect(rows).toHaveCount(3);
    });

    // S02: 仅将排序选为功率降序，不点击查询
    await test.step('S02', async () => {
      // 捕获操作前整张可见表格内容（全部行与单元格）
      const beforeRows = await rows.allTextContents();

      await sortSelect.selectOption(['功率降序']);

      // 排序控件显示功率降序
      await expect(sortSelect).toHaveValue('power-desc');
      // 表格内容与操作前完全一致（第一行H101、第二行H102、第三行H103）
      await expect(rows).toHaveText(beforeRows);
      // 计数器“共12条 · 第1/4页”
      await expect(page.getByText('共12条 · 第1/4页')).toBeVisible();
    });

    // S03: 点击查询并核对第1页
    await test.step('S03', async () => {
      await page.getByRole('button', { name: '查询' }).click();

      // 计数器“共12条 · 第1/4页”
      await expect(page.getByText('共12条 · 第1/4页')).toBeVisible();
      // 排序控件仍显示功率降序
      await expect(sortSelect).toHaveValue('power-desc');
      // 表体恰好3行
      await expect(rows).toHaveCount(3);

      // 位置1为H107且额定功率300 kW
      await expect(rows.nth(0)).toContainText('H107');
      await expect(rows.nth(0).getByRole('cell', { name: '300 kW' })).toHaveText('300 kW');
      // 位置2为H111且额定功率260 kW
      await expect(rows.nth(1)).toContainText('H111');
      await expect(rows.nth(1).getByRole('cell', { name: '260 kW' })).toHaveText('260 kW');
      // 位置3为H106且额定功率220 kW
      await expect(rows.nth(2)).toContainText('H106');
      await expect(rows.nth(2).getByRole('cell', { name: '220 kW' })).toHaveText('220 kW');
    });

    // S04: 点击下一页并核对第2页
    await test.step('S04', async () => {
      await page.getByRole('button', { name: '下一页' }).click();

      // 计数器“共12条 · 第2/4页”
      await expect(page.getByText('共12条 · 第2/4页')).toBeVisible();
      // 表体仍恰好3行，不显示12条当前行
      await expect(rows).toHaveCount(3);

      // 位置1为H112且额定功率200 kW
      await expect(rows.nth(0)).toContainText('H112');
      await expect(rows.nth(0).getByRole('cell', { name: '200 kW' })).toHaveText('200 kW');
      // 位置2为H109且额定功率180 kW
      await expect(rows.nth(1)).toContainText('H109');
      await expect(rows.nth(1).getByRole('cell', { name: '180 kW' })).toHaveText('180 kW');
      // 位置3为H105且额定功率140 kW
      await expect(rows.nth(2)).toContainText('H105');
      await expect(rows.nth(2).getByRole('cell', { name: '140 kW' })).toHaveText('140 kW');
    });
  });
});
