import { test, expect } from '@playwright/test';

const CASE_TITLE = '分页筛选北站后翻页并返回';

test.describe(CASE_TITLE, () => {
  test(CASE_TITLE, async ({ page }) => {
    const panel = page.locator('main');
    const combobox = page.getByRole('combobox', { name: '站点筛选' });
    const filterButton = page.getByRole('button', { name: '筛选', exact: true });
    const currentFilter = page.getByText(/当前筛选：/);
    const dataRows = panel.locator('table tbody tr:has(td)');
    const prevButton = panel.getByRole('button', { name: '上一页' });
    const nextButton = panel.getByRole('button', { name: '下一页' });
    const pageInfo = page.getByText(/共\d+条，\d+\/\d+页/);

    // Observe the live selected option; the [selected] attribute does not track later changes.
    const expectSelected = async (label) => {
      await expect(combobox.locator('option:checked')).toHaveText(label);
    };

    const expectRows = async (ids, sites) => {
      await expect(dataRows).toHaveCount(ids.length);
      for (let i = 0; i < ids.length; i += 1) {
        await expect(dataRows.nth(i).locator('td').nth(0)).toHaveText(ids[i]);
        await expect(dataRows.nth(i).locator('td').nth(1)).toHaveText(sites[i]);
      }
    };

    await test.step('CASE_STEP_1: 打开该用例绑定入口（scene=paging，variant以入口配置为准）', async () => {
      await page.goto(process.env.PROBE_URL);

      await expect(currentFilter).toHaveText('当前筛选：全部');
      await expectSelected('全部');

      await expectRows(['P01', 'P02'], ['北站', '南站']);

      await expect(pageInfo).toHaveText('共8条，1/4页');
    });

    await test.step('CASE_STEP_2: 站点筛选选择北站，点击筛选', async () => {
      await combobox.selectOption({ label: '北站' });
      await filterButton.click();

      await expectSelected('北站');
      await expect(currentFilter).toHaveText('当前筛选：北站');

      await expectRows(['P01', 'P03'], ['北站', '北站']);

      await expect(pageInfo).toHaveText('共4条，1/2页');
    });

    await test.step('CASE_STEP_3: 点击下一页', async () => {
      await nextButton.click();

      await expectSelected('北站');
      await expect(currentFilter).toHaveText('当前筛选：北站');

      await expectRows(['P05', 'P07'], ['北站', '北站']);

      await expect(pageInfo).toHaveText('共4条，2/2页');
    });

    await test.step('CASE_STEP_4: 点击上一页', async () => {
      await prevButton.click();

      await expectSelected('北站');
      await expect(currentFilter).toHaveText('当前筛选：北站');

      await expectRows(['P01', 'P03'], ['北站', '北站']);

      await expect(pageInfo).toHaveText('共4条，1/2页');
    });
  });
});
