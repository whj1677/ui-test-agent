import { test, expect, type Locator } from '@playwright/test';

// spec: HOLD-S1 工作区七功率排序核对
// seed: seed.spec.ts

async function columnIndex(table: Locator, name: string): Promise<number> {
  const headers = table.getByRole('columnheader');
  const count = await headers.count();
  for (let i = 0; i < count; i++) {
    if ((await headers.nth(i).innerText()).trim() === name) {
      return i;
    }
  }
  throw new Error(`未找到表头列: ${name}`);
}

test.describe('工作区七功率排序核对', () => {
  test('工作区七功率排序核对', async ({ page }) => {
    const table = page.getByRole('table', { name: '巡检任务列表' });
    const rows = table.locator('tbody tr');
    const sortSelect = page.getByLabel('排序');

    let idColumn = -1;
    let powerColumn = -1;

    // S01: 在全新独立浏览器上下文直接打开 http://localhost:4198/probe/s1
    await test.step('S01', async () => {
      await page.goto(process.env.PILOT_ENTRY_URL || 'http://localhost:4198/probe/s1');

      // 默认计数器“共12条 · 第1/4页”
      await expect(page.getByText('共12条 · 第1/4页', { exact: true })).toBeVisible();

      // 排序为编号升序：控件显示“编号升序”
      await expect(sortSelect.locator('option:checked')).toHaveText('编号升序');

      // 表体恰好3条数据行而非12条当前行
      await expect(rows).toHaveCount(3);

      // 编号升序：当前表体编号顺序正确
      idColumn = await columnIndex(table, '编号');
      await expect(rows.nth(0).locator('td').nth(idColumn)).toHaveText('H101');
      await expect(rows.nth(1).locator('td').nth(idColumn)).toHaveText('H102');
      await expect(rows.nth(2).locator('td').nth(idColumn)).toHaveText('H103');
    });

    // S02: 仅将排序选为功率降序，不点击查询
    await test.step('S02', async () => {
      // 捕获操作前整张可见表格内容（覆盖可见表头与每行每列）
      const headerTexts = (await table.getByRole('columnheader').allTextContents()).map((t) => t.trim());
      const beforeRowCellTexts: string[][] = [];
      const rowCountBefore = await rows.count();
      for (let i = 0; i < rowCountBefore; i++) {
        beforeRowCellTexts.push((await rows.nth(i).locator('td').allTextContents()).map((t) => t.trim()));
      }

      await sortSelect.selectOption({ label: '功率降序' });

      // 排序控件显示功率降序（直接核对选中项中文文字）
      await expect(sortSelect.locator('option:checked')).toHaveText('功率降序');

      // 实际数据行数与操作前行数相同
      await expect(rows).toHaveCount(rowCountBefore);

      // 表格内容与操作前完全一致（可见表头）
      await expect(table.getByRole('columnheader')).toHaveText(headerTexts);

      // 表格内容与操作前完全一致（每行每列）
      for (let i = 0; i < beforeRowCellTexts.length; i++) {
        await expect(rows.nth(i).locator('td')).toHaveText(beforeRowCellTexts[i]);
      }

      // 第一行H101、第二行H102、第三行H103
      await expect(rows.nth(0).locator('td').nth(idColumn)).toHaveText('H101');
      await expect(rows.nth(1).locator('td').nth(idColumn)).toHaveText('H102');
      await expect(rows.nth(2).locator('td').nth(idColumn)).toHaveText('H103');

      // 计数器“共12条 · 第1/4页”
      await expect(page.getByText('共12条 · 第1/4页', { exact: true })).toBeVisible();
    });

    // S03: 点击查询并核对第1页
    await test.step('S03', async () => {
      await page.getByRole('button', { name: '查询' }).click();

      // 计数器“共12条 · 第1/4页”
      await expect(page.getByText('共12条 · 第1/4页', { exact: true })).toBeVisible();

      // 排序控件仍显示功率降序（直接核对选中项中文文字）
      await expect(sortSelect.locator('option:checked')).toHaveText('功率降序');

      // 表体恰好3行
      await expect(rows).toHaveCount(3);

      powerColumn = await columnIndex(table, '额定功率');

      // 位置1为H107且额定功率300 kW
      await expect(rows.nth(0).locator('td').nth(idColumn)).toHaveText('H107');
      await expect(rows.nth(0).locator('td').nth(powerColumn)).toHaveText('300 kW');

      // 位置2为H111且额定功率260 kW
      await expect(rows.nth(1).locator('td').nth(idColumn)).toHaveText('H111');
      await expect(rows.nth(1).locator('td').nth(powerColumn)).toHaveText('260 kW');

      // 位置3为H106且额定功率220 kW
      await expect(rows.nth(2).locator('td').nth(idColumn)).toHaveText('H106');
      await expect(rows.nth(2).locator('td').nth(powerColumn)).toHaveText('220 kW');
    });

    // S04: 点击下一页并核对第2页
    await test.step('S04', async () => {
      await page.getByRole('button', { name: '下一页' }).click();

      // 计数器“共12条 · 第2/4页”
      await expect(page.getByText('共12条 · 第2/4页', { exact: true })).toBeVisible();

      // 表体仍恰好3行，不显示12条当前行
      await expect(rows).toHaveCount(3);

      // 位置1为H112且额定功率200 kW
      await expect(rows.nth(0).locator('td').nth(idColumn)).toHaveText('H112');
      await expect(rows.nth(0).locator('td').nth(powerColumn)).toHaveText('200 kW');

      // 位置2为H109且额定功率180 kW
      await expect(rows.nth(1).locator('td').nth(idColumn)).toHaveText('H109');
      await expect(rows.nth(1).locator('td').nth(powerColumn)).toHaveText('180 kW');

      // 位置3为H105且额定功率140 kW
      await expect(rows.nth(2).locator('td').nth(idColumn)).toHaveText('H105');
      await expect(rows.nth(2).locator('td').nth(powerColumn)).toHaveText('140 kW');
    });
  });
});
