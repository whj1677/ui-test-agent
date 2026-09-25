import { test, expect } from "@playwright/test";

// KC-08 跨页选择保留：设备预约调度 / 设备资源列表分页多选
test("KC-08 跨页选择保留", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const batchButton = page.getByRole("button", { name: "批量预约" });
  const pagerInfo = (pageNumber) => page.getByText(new RegExp(`第 ${pageNumber}/2 页`));
  const selectionSummary = page.getByText(/已选\s*\d+\s*项；跨页选择会保留/);

  await test.step("CASE_STEP_1", async () => {
    // 第1页首行设备 EQ-101
    const eq101 = page.getByRole("checkbox", { name: "选择EQ-101" });
    await expect(eq101).toBeVisible();
    await expect(page.getByText("EQ-101")).toBeVisible();
    await expect(eq101).not.toBeChecked();
    await expect(batchButton).toBeDisabled();

    await eq101.check();

    await expect(eq101).toBeChecked();
    await expect(selectionSummary).toHaveText(/已选 1 项/);
    await expect(batchButton).toBeEnabled();
  });

  await test.step("CASE_STEP_2", async () => {
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(pagerInfo(2)).toBeVisible();

    // 第2页设备 EQ-106
    const eq106 = page.getByRole("checkbox", { name: "选择EQ-106" });
    await expect(eq106).toBeVisible();
    await expect(page.getByText("EQ-106")).toBeVisible();
    await expect(eq106).not.toBeChecked();

    await eq106.check();

    await expect(eq106).toBeChecked();
    // 翻页后仍为已选 2 项，说明第1页 EQ-101 的选择被保留
    await expect(selectionSummary).toHaveText(/已选 2 项/);
    await expect(batchButton).toBeEnabled();
  });

  await test.step("CASE_STEP_3", async () => {
    // 返回第1页核对 EQ-101 仍勾选
    await page.getByRole("button", { name: "上一页" }).click();
    await expect(pagerInfo(1)).toBeVisible();
    const eq101 = page.getByRole("checkbox", { name: "选择EQ-101" });
    await expect(eq101).toBeVisible();
    await expect(eq101).toBeChecked();
    await expect(selectionSummary).toHaveText(/已选 2 项/);

    // 再翻到第2页核对 EQ-106 仍勾选
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(pagerInfo(2)).toBeVisible();
    const eq106 = page.getByRole("checkbox", { name: "选择EQ-106" });
    await expect(eq106).toBeVisible();
    await expect(eq106).toBeChecked();
    await expect(selectionSummary).toHaveText(/已选 2 项/);
    await expect(batchButton).toBeEnabled();
  });
});
