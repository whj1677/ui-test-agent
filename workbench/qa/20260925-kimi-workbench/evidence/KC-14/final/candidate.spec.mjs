import { test, expect } from "@playwright/test";

test("KC-14 无选择批量预约禁用", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  // 设备资源面板内的批量预约按钮
  const batchReserveButton = page.getByRole("button", { name: "批量预约" });
  // 已选项计数提示（业务对象：当前勾选的设备数），限定在设备资源主区域内
  const selectionCounter = page
    .locator("main .hint")
    .filter({ hasText: /已选\s*\d+\s*项/ });
  // 表格中 EQ-101 行的勾选控件
  const eq101Checkbox = page.getByRole("checkbox", { name: "选择EQ-101" });

  await test.step("CASE_STEP_1", async () => {
    // 初始未勾选任何设备：已选项计数为 0，批量预约按钮处于禁用状态
    await expect(selectionCounter).toBeVisible();
    await expect(selectionCounter).toContainText(/已选\s*0\s*项/);
    await expect(eq101Checkbox).not.toBeChecked();
    await expect(batchReserveButton).toBeDisabled();
  });

  await test.step("CASE_STEP_2", async () => {
    // 勾选 EQ-101：已选项计数变为 1，批量预约按钮变为可用
    await eq101Checkbox.check();
    await expect(eq101Checkbox).toBeChecked();
    await expect(selectionCounter).toContainText(/已选\s*1\s*项/);
    await expect(batchReserveButton).toBeEnabled();
  });

  await test.step("CASE_STEP_3", async () => {
    // 取消勾选：已选项计数回到 0，批量预约按钮恢复禁用
    await eq101Checkbox.uncheck();
    await expect(eq101Checkbox).not.toBeChecked();
    await expect(selectionCounter).toContainText(/已选\s*0\s*项/);
    await expect(batchReserveButton).toBeDisabled();
  });
});
