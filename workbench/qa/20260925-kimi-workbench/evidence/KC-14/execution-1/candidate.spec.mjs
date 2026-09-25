import { test, expect } from "@playwright/test";

test("KC-14 无选择批量预约禁用", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  // 设备资源区域内的批量操作控件与已选项计数提示
  const batchReserveButton = page.getByRole("button", { name: "批量预约" });
  const selectionCounter = page.locator("main .hint");
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
