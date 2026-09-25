import { test, expect } from "@playwright/test";

// KC-05 状态多选空闲或维护
// 正常入口由任务绑定：await page.goto(process.env.PROBE_URL)

const STATUS_GROUP_NAME = "状态多选";
const RESULT_TABLE_NAME = "设备列表";

test("KC-05 状态多选空闲或维护", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const statusGroup = page.getByRole("group", { name: STATUS_GROUP_NAME });
  const idleBox = statusGroup.getByRole("checkbox", { name: "空闲", exact: true });
  const inUseBox = statusGroup.getByRole("checkbox", { name: "使用中", exact: true });
  const maintenanceBox = statusGroup.getByRole("checkbox", { name: "维护", exact: true });

  // 结果区域：设备列表表格与分页信息
  const resultTable = page.getByRole("table", { name: RESULT_TABLE_NAME });
  const resultRows = resultTable.locator("tbody tr");
  const pagerSummary = page.getByText(/^共 \d+ 条，第 \d+\/\d+ 页，每页3条$/);
  const nextPage = page.getByRole("button", { name: "下一页" });
  const prevPage = page.getByRole("button", { name: "上一页" });

  // 读取当前页可见行的编号与状态（编号列第2列，状态列第5列）
  const readVisibleRows = async () => {
    const count = await resultRows.count();
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const row = resultRows.nth(i);
      out.push({
        id: (await row.locator("td").nth(1).innerText()).trim(),
        status: (await row.locator("td").nth(4).innerText()).trim(),
      });
    }
    return out;
  };

  await test.step("CASE_STEP_1", async () => {
    // 状态勾选空闲和维护，取消使用中
    await idleBox.check();
    await maintenanceBox.check();
    await inUseBox.uncheck();

    await expect(idleBox).toBeChecked();
    await expect(maintenanceBox).toBeChecked();
    await expect(inUseBox).not.toBeChecked();
    await expect(statusGroup.getByRole("checkbox", { checked: true })).toHaveCount(2);

    // 显示空闲5条加维护2条，共7条
    await expect(pagerSummary).toHaveText("共 7 条，第 1/3 页，每页3条");

    const collected = [];
    await expect(resultRows).toHaveCount(3);
    collected.push(...(await readVisibleRows()));

    await nextPage.click();
    await expect(pagerSummary).toHaveText("共 7 条，第 2/3 页，每页3条");
    await expect(resultRows).toHaveCount(3);
    collected.push(...(await readVisibleRows()));

    await nextPage.click();
    await expect(pagerSummary).toHaveText("共 7 条，第 3/3 页，每页3条");
    await expect(resultRows).toHaveCount(1);
    collected.push(...(await readVisibleRows()));
    await expect(nextPage).toBeDisabled();

    expect(collected.map((r) => r.id)).toEqual([
      "EQ-101",
      "EQ-102",
      "EQ-103",
      "EQ-105",
      "EQ-106",
      "EQ-107",
      "EQ-108",
    ]);
    expect(collected.filter((r) => r.status === "空闲")).toHaveLength(5);
    expect(collected.filter((r) => r.status === "维护")).toHaveLength(2);
    // 排除EQ-104使用中
    expect(collected.map((r) => r.id)).not.toContain("EQ-104");
    expect(collected.map((r) => r.status)).not.toContain("使用中");

    // 回到第1页，供翻页浏览步骤校验
    await prevPage.click();
    await expect(pagerSummary).toHaveText("共 7 条，第 2/3 页，每页3条");
    await prevPage.click();
    await expect(pagerSummary).toHaveText("共 7 条，第 1/3 页，每页3条");
  });

  await test.step("CASE_STEP_2", async () => {
    // 第1页 101/102/103
    await expect(pagerSummary).toHaveText("共 7 条，第 1/3 页，每页3条");
    await expect(prevPage).toBeDisabled();
    await expect(resultRows).toHaveCount(3);
    await expect(resultRows.nth(0).locator("td").nth(1)).toHaveText("EQ-101");
    await expect(resultRows.nth(1).locator("td").nth(1)).toHaveText("EQ-102");
    await expect(resultRows.nth(2).locator("td").nth(1)).toHaveText("EQ-103");
    await expect(resultRows.nth(0).locator("td").nth(4)).toHaveText("空闲");
    await expect(resultRows.nth(1).locator("td").nth(4)).toHaveText("维护");
    await expect(resultRows.nth(2).locator("td").nth(4)).toHaveText("空闲");

    // 第2页 105/106/107
    await nextPage.click();
    await expect(pagerSummary).toHaveText("共 7 条，第 2/3 页，每页3条");
    await expect(resultRows).toHaveCount(3);
    await expect(resultRows.nth(0).locator("td").nth(1)).toHaveText("EQ-105");
    await expect(resultRows.nth(1).locator("td").nth(1)).toHaveText("EQ-106");
    await expect(resultRows.nth(2).locator("td").nth(1)).toHaveText("EQ-107");
    await expect(resultRows.nth(0).locator("td").nth(4)).toHaveText("空闲");
    await expect(resultRows.nth(1).locator("td").nth(4)).toHaveText("空闲");
    await expect(resultRows.nth(2).locator("td").nth(4)).toHaveText("维护");

    // 第3页 108，共3页
    await nextPage.click();
    await expect(pagerSummary).toHaveText("共 7 条，第 3/3 页，每页3条");
    await expect(resultRows).toHaveCount(1);
    await expect(resultRows.nth(0).locator("td").nth(1)).toHaveText("EQ-108");
    await expect(resultRows.nth(0).locator("td").nth(4)).toHaveText("空闲");
    await expect(nextPage).toBeDisabled();
  });

  await test.step("CASE_STEP_3", async () => {
    // 取消维护仅留空闲
    await maintenanceBox.uncheck();
    await expect(maintenanceBox).not.toBeChecked();
    await expect(idleBox).toBeChecked();
    await expect(inUseBox).not.toBeChecked();
    await expect(statusGroup.getByRole("checkbox", { checked: true })).toHaveCount(1);

    // 筛选变化后回到第1页：101/103/105
    await expect(pagerSummary).toHaveText("共 5 条，第 1/2 页，每页3条");
    await expect(resultRows).toHaveCount(3);
    await expect(resultRows.nth(0).locator("td").nth(1)).toHaveText("EQ-101");
    await expect(resultRows.nth(1).locator("td").nth(1)).toHaveText("EQ-103");
    await expect(resultRows.nth(2).locator("td").nth(1)).toHaveText("EQ-105");

    const remaining = await readVisibleRows();

    // 第2页：106/108
    await nextPage.click();
    await expect(pagerSummary).toHaveText("共 5 条，第 2/2 页，每页3条");
    await expect(resultRows).toHaveCount(2);
    await expect(resultRows.nth(0).locator("td").nth(1)).toHaveText("EQ-106");
    await expect(resultRows.nth(1).locator("td").nth(1)).toHaveText("EQ-108");
    await expect(nextPage).toBeDisabled();

    remaining.push(...(await readVisibleRows()));

    // 仅剩EQ-101/103/105/106/108共5条
    expect(remaining.map((r) => r.id)).toEqual([
      "EQ-101",
      "EQ-103",
      "EQ-105",
      "EQ-106",
      "EQ-108",
    ]);
    expect(remaining.map((r) => r.status)).not.toContain("维护");
    expect(remaining.map((r) => r.status)).not.toContain("使用中");
  });
});
