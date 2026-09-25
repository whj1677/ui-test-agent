import { test, expect } from "@playwright/test";

// 设备列表表格与列定位：按表头标签推导列序号，绑定业务字段而不是硬编码答案。
const DEVICE_TABLE = 'table[aria-label="设备列表"]';

async function columnIndexByHeader(page, headerText) {
  const headers = page.locator(`${DEVICE_TABLE} thead th`);
  const total = await headers.count();
  for (let i = 0; i < total; i += 1) {
    const label = (await headers.nth(i).innerText()).trim();
    if (label === headerText) {
      return i + 1;
    }
  }
  throw new Error(`设备列表表头缺少列：${headerText}`);
}

// 每一行设备行的选择框由其业务对象（设备编号）绑定。
function rowCheckbox(page, deviceId) {
  return page.locator(`#devBody input.rowCk[aria-label="选择${deviceId}"]`);
}

test("KC-09 筛选变更清空选择并回第1页", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const searchBox = page.getByRole("searchbox", { name: "搜索编号或名称" });
  const siteButton = page.locator("#siteBtn");
  const siteList = page.locator("#siteList");
  const selInfo = page.locator("#selInfo");
  const pageInfo = page.locator("#pageInfo");
  const prevButton = page.locator("#prev");
  const nextButton = page.locator("#next");
  const batchButton = page.locator("#batchBook");
  const deviceRows = page.locator("#devBody tr");

  await test.step("CASE_STEP_1", async () => {
    // 前置：筛选未生效的第1页，未选择任何设备。
    await expect(searchBox).toHaveValue("");
    await expect(pageInfo).toContainText(/第\s*1\s*\/\s*\d+\s*页/);
    await expect(selInfo).toContainText(/已选\s*0\s*项/);

    const eq101 = rowCheckbox(page, "EQ-101");
    await expect(eq101).toBeVisible();
    await expect(eq101).not.toBeChecked();
    await eq101.check();
    await expect(selInfo).toContainText(/已选\s*1\s*项/);
    await expect(batchButton).toBeEnabled();

    // 翻到第2页：选择保留（已选 1 项），当前为第2页。
    await nextButton.click();
    await expect(pageInfo).toContainText(/第\s*2\s*\/\s*\d+\s*页/);
    await expect(prevButton).toBeEnabled();
    await expect(selInfo).toContainText(/已选\s*1\s*项/);
    await expect(batchButton).toBeEnabled();

    // 第2页自身没有任何勾选，因此“已选 1 项”只能来自上一页保留的 EQ-101。
    const pageRowCount = await deviceRows.count();
    expect(pageRowCount).toBeGreaterThan(0);
    for (let i = 0; i < pageRowCount; i += 1) {
      await expect(deviceRows.nth(i).locator("input.rowCk")).not.toBeChecked();
    }

    // 往返第1页确认 EQ-101 的勾选状态确实被保留，再回到第2页收尾。
    await prevButton.click();
    await expect(pageInfo).toContainText(/第\s*1\s*\/\s*\d+\s*页/);
    await expect(rowCheckbox(page, "EQ-101")).toBeChecked();
    await expect(selInfo).toContainText(/已选\s*1\s*项/);

    await nextButton.click();
    await expect(pageInfo).toContainText(/第\s*2\s*\/\s*\d+\s*页/);
    await expect(selInfo).toContainText(/已选\s*1\s*项/);
  });

  await test.step("CASE_STEP_2", async () => {
    await searchBox.fill("EQ-103");
    await expect(searchBox).toHaveValue("EQ-103");

    // 筛选变化：选择被清空。
    await expect(selInfo).toContainText(/已选\s*0\s*项/);
    await expect(batchButton).toBeDisabled();

    // 回到第1页。
    await expect(pageInfo).toContainText(/第\s*1\s*\/\s*\d+\s*页/);
    await expect(prevButton).toBeDisabled();

    // 仅显示 EQ-103：列表只保留一行，且该行编号列的值就是 EQ-103。
    const idColumn = await columnIndexByHeader(page, "编号");
    await expect(deviceRows).toHaveCount(1);
    await expect(deviceRows.first().locator(`td:nth-child(${idColumn})`)).toHaveText("EQ-103");
  });

  await test.step("CASE_STEP_3", async () => {
    await searchBox.fill("");
    await expect(searchBox).toHaveValue("");

    // 先重新建立“有选择且不在第1页”的状态，使“再次清空选择并回到第1页”可被真实观测。
    const eq101 = rowCheckbox(page, "EQ-101");
    await expect(eq101).toBeVisible();
    await eq101.check();
    await expect(selInfo).toContainText(/已选\s*1\s*项/);
    await nextButton.click();
    await expect(pageInfo).toContainText(/第\s*2\s*\/\s*\d+\s*页/);
    await expect(selInfo).toContainText(/已选\s*1\s*项/);

    // 改站点为南站（按可见选项文本选择）。
    await siteButton.click();
    await expect(siteList).toBeVisible();
    await page.locator('#siteList li[role="option"]').filter({ hasText: "南站" }).click();
    await expect(siteButton).toHaveText("南站");
    await expect(siteList).toBeHidden();

    // 再次清空选择并回到第1页。
    await expect(selInfo).toContainText(/已选\s*0\s*项/);
    await expect(batchButton).toBeDisabled();
    await expect(pageInfo).toContainText(/第\s*1\s*\/\s*\d+\s*页/);
    await expect(prevButton).toBeDisabled();

    // 显示南站设备：列表非空，且每一条可见设备行的站点列都是“南站”。
    const siteColumn = await columnIndexByHeader(page, "站点");
    await expect(deviceRows.first()).toBeVisible();
    const visibleRows = await deviceRows.count();
    expect(visibleRows).toBeGreaterThan(0);
    for (let i = 0; i < visibleRows; i += 1) {
      await expect(deviceRows.nth(i).locator(`td:nth-child(${siteColumn})`)).toHaveText("南站");
    }
  });
});
