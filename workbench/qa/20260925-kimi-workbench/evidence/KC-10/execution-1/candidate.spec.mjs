import { test, expect } from "@playwright/test";

test("KC-10 当前页全选只选可预约行", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const deviceTable = page.getByRole("table", { name: "设备列表" });
  const statusFilter = page.getByRole("group", { name: "状态多选" });
  const selectAllCurrentPage = deviceTable.getByRole("checkbox", {
    name: "当前页全选可预约行",
  });
  const batchReserveButton = page.getByRole("button", { name: "批量预约" });
  const selectionSummary = page.getByText(/^已选\s*\d+\s*项/);

  const rowCheckbox = (code) =>
    deviceTable
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: code, exact: true }) })
      .getByRole("checkbox");

  const eq101 = rowCheckbox("EQ-101");
  const eq102 = rowCheckbox("EQ-102");
  const eq103 = rowCheckbox("EQ-103");

  // Arrangement of the frozen precondition page: page 1 of the case contains the
  // maintenance row EQ-102 next to the available rows EQ-101/EQ-103, so the status
  // filter must include 维护 in addition to the default 空闲.
  await statusFilter.getByRole("checkbox", { name: "空闲" }).check();
  await statusFilter.getByRole("checkbox", { name: "维护" }).check();
  await expect(eq102).toBeVisible();

  await test.step("CASE_STEP_1", async () => {
    // 第1页点击当前页全选：只勾选可预约EQ-101和EQ-103，维护EQ-102不勾选，已选2项
    await selectAllCurrentPage.check();
    await expect(eq101).toBeChecked();
    await expect(eq103).toBeChecked();
    await expect(eq102).not.toBeChecked();
    await expect(selectionSummary).toContainText("已选 2 项");
  });

  await test.step("CASE_STEP_2", async () => {
    // 取消全选再单选EQ-103：仅EQ-103选中，EQ-102复选框仍禁用
    await selectAllCurrentPage.uncheck();
    await expect(selectionSummary).toContainText("已选 0 项");
    await eq103.check();
    await expect(eq103).toBeChecked();
    await expect(eq101).not.toBeChecked();
    await expect(eq102).toBeDisabled();
    await expect(eq102).not.toBeChecked();
    await expect(selectionSummary).toContainText("已选 1 项");
  });

  await test.step("CASE_STEP_3", async () => {
    // 确认批量预约状态：存在可预约选择时批量预约可用，清空后禁用
    await expect(batchReserveButton).toBeEnabled();
    await eq103.uncheck();
    await expect(selectionSummary).toContainText("已选 0 项");
    await expect(batchReserveButton).toBeDisabled();
  });
});
