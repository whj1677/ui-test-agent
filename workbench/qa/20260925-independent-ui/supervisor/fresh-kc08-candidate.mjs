import { test, expect } from "@playwright/test";

/**
 * KC-08 跨页选择保留（设备预约调度）
 * 步骤 1：第1页勾选 EQ-101     -> 已选 1 项，批量预约可用
 * 步骤 2：翻到第2页勾选 EQ-106 -> 翻页后 EQ-101 选择保留，已选 2 项
 * 步骤 3：返回第1页和第2页核对 -> EQ-101 与 EQ-106 均保持勾选，已选 2 项
 *
 * 定位说明（来自正常入口观察）：
 * - 设备资源面板为可见的 <section class="panel">，另有隐藏的“预约记录”面板与隐藏弹窗，
 *   所有定位都收敛到“设备资源”面板内，避免命中隐藏区域的同名控件。
 * - 行选择框的可访问名称为“选择<编号>”。
 * - 选择数量状态元素为 DIV.hint，文本形如“已选 N 项；跨页选择会保留…”，
 *   这里用前缀锚定该状态元素，数量值单独断言。
 */

function resourcePanel(page) {
  return page
    .locator("main section.panel")
    .filter({ has: page.getByRole("heading", { name: "设备资源", level: 1 }) });
}

function deviceList(page) {
  return resourcePanel(page).getByRole("table", { name: "设备列表" });
}

function deviceCheckbox(page, deviceId) {
  return deviceList(page).getByRole("checkbox", { name: `选择${deviceId}`, exact: true });
}

function selectionSummary(page) {
  return resourcePanel(page).getByText(/^已选 \d+ 项/);
}

function nextPageButton(page) {
  return resourcePanel(page).getByRole("button", { name: "下一页", exact: true });
}

function prevPageButton(page) {
  return resourcePanel(page).getByRole("button", { name: "上一页", exact: true });
}

function batchReserveButton(page) {
  return resourcePanel(page).getByRole("button", { name: "批量预约", exact: true });
}

test("KC-08 跨页选择保留", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  await test.step("CASE_STEP_1", async () => {
    // 第1页勾选 EQ-101
    const eq101 = deviceCheckbox(page, "EQ-101");
    await expect(eq101).toBeVisible();
    await eq101.click();
    await expect(eq101).toBeChecked();
    // 已选 1 项
    await expect(selectionSummary(page)).toHaveText(/^已选 1 项/);
    // 批量预约可用（可见且可用）
    const batch = batchReserveButton(page);
    await expect(batch).toBeVisible();
    await expect(batch).toBeEnabled();
  });

  await test.step("CASE_STEP_2", async () => {
    // 翻到第2页
    await nextPageButton(page).click();
    const eq106 = deviceCheckbox(page, "EQ-106");
    await expect(eq106).toBeVisible();
    // 翻页后 EQ-101（位于第1页）选择保留：总数仍为 1
    await expect(selectionSummary(page)).toHaveText(/^已选 1 项/);
    // 勾选 EQ-106
    await eq106.click();
    await expect(eq106).toBeChecked();
    // 已选 2 项
    await expect(selectionSummary(page)).toHaveText(/^已选 2 项/);
  });

  await test.step("CASE_STEP_3", async () => {
    // 返回第1页核对 EQ-101
    await prevPageButton(page).click();
    const eq101 = deviceCheckbox(page, "EQ-101");
    await expect(eq101).toBeVisible();
    await expect(eq101).toBeChecked();
    await expect(selectionSummary(page)).toHaveText(/^已选 2 项/);
    // 回到第2页核对 EQ-106
    await nextPageButton(page).click();
    const eq106 = deviceCheckbox(page, "EQ-106");
    await expect(eq106).toBeVisible();
    await expect(eq106).toBeChecked();
    await expect(selectionSummary(page)).toHaveText(/^已选 2 项/);
  });
});
