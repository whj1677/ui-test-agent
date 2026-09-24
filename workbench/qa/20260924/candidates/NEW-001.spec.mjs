import { test, expect } from '@playwright/test';

const CASE_TITLE = '分页筛选北站后翻页并返回';

test.describe(CASE_TITLE, () => {
  test('分页筛选北站后翻页并返回', async ({ page }) => {
    const combobox = page.getByRole('combobox', { name: '站点筛选' });
    const filterButton = page.getByRole('button', { name: '筛选', exact: true });
    const currentFilter = page.getByText(/当前筛选：/);
    const dataRows = page.locator('table tbody tr');
    const prevButton = page.getByRole('button', { name: '上一页' });
    const nextButton = page.getByRole('button', { name: '下一页' });
    const pageInfo = page.getByText(/共\d+条，\d+\/\d+页/);

    const expectRows = async (ids, sites) => {
      await expect(dataRows).toHaveCount(ids.length);
      for (let i = 0; i < ids.length; i += 1) {
        await expect(dataRows.nth(i).locator('td').nth(0)).toHaveText(ids[i]);
        await expect(dataRows.nth(i).locator('td').nth(1)).toHaveText(sites[i]);
      }
    };

    await test.step('CASE_STEP_1: 打开该用例绑定入口（scene=paging，variant以入口配置为准）', async () => {
      await page.goto(process.env.PROBE_URL);

      await expect(combobox).toHaveValue('全部');
      await expect(combobox.locator('option[selected]')).toHaveText('全部');
      await expect(currentFilter).toHaveText('当前筛选：全部');

      await expect(dataRows).toHaveCount(2);
      await expect(dataRows.nth(0).locator('td').nth(0)).toHaveText('P01');
      await expect(dataRows.nth(0).locator('td').nth(1)).toHaveText('北站');
      await expect(dataRows.nth(1).locator('td').nth(0)).toHaveText('P02');
      await expect(dataRows.nth(1).locator('td').nth(1)).toHaveText('南站');

      await expect(pageInfo).toHaveText('共8条，1/4页');
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();
    });

    await test.step('CASE_STEP_2: 站点筛选选择北站，点击筛选', async () => {
      await combobox.selectOption('北站');
      await filterButton.click();

      await expect(combobox).toHaveValue('北站');
      await expect(combobox.locator('option[selected]')).toHaveText('北站');
      await expect(currentFilter).toHaveText('当前筛选：北站');

      await expectRows(['P01', 'P03'], ['北站', '北站']);

      await expect(pageInfo).toHaveText('共4条，1/2页');
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();
    });

    await test.step('CASE_STEP_3: 点击下一页', async () => {
      await nextButton.click();

      await expect(combobox).toHaveValue('北站');
      await expect(combobox.locator('option[selected]')).toHaveText('北站');
      await expect(currentFilter).toHaveText('当前筛选：北站');

      await expectRows(['P05', 'P07'], ['北站', '北站']);

      await expect(pageInfo).toHaveText('共4条，2/2页');
      await expect(prevButton).toBeEnabled();
      await expect(nextButton).toBeDisabled();
    });

    await test.step('CASE_STEP_4: 点击上一页', async () => {
      await prevButton.click();

      await expect(combobox).toHaveValue('北站');
      await expect(combobox.locator('option[selected]')).toHaveText('北站');
      await expect(currentFilter).toHaveText('当前筛选：北站');

      await expectRows(['P01', 'P03'], ['北站', '北站']);

      await expect(pageInfo).toHaveText('共4条，1/2页');
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();
    });
  });
});
