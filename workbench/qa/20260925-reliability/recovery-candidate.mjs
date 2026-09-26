import { test, expect } from "@playwright/test";

test("KC-10 当前页全选只选可预约行", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const table = page.getByRole("table", { name: "设备列表" });
  const selectAll = table.getByRole("checkbox", { name: "当前页全选可预约行" });
  const row101 = table.getByRole("row").filter({ hasText: "EQ-101" });
  const row102 = table.getByRole("row").filter({ hasText: "EQ-102" });
  const row103 = table.getByRole("row").filter({ hasText: "EQ-103" });
  const checkbox101 = row101.getByRole("checkbox");
  const checkbox102 = row102.getByRole("checkbox");
  const checkbox103 = row103.getByRole("checkbox");
  const selectionSummary = page.getByText("跨页选择会保留");
  const batchButton = page.getByRole("button", { name: "批量预约" });

  // 冻结用例前提：第1页为 EQ-101/EQ-103（可预约，空闲）与 EQ-102（维护，不可预约）。
  // 用例未要求任何筛选动作，故直接使用任务绑定的默认状态，不追加筛选操作。
  await test.step("CASE_STEP_1", async () => {
    await selectAll.click();
    await expect(checkbox101).toBeChecked();
    await expect(checkbox103).toBeChecked();
    await expect(row102).toBeVisible();
    await expect(checkbox102).not.toBeChecked();
    await expect(selectionSummary).toHaveText(/已选\s*2\s*项/);
  });

  await test.step("CASE_STEP_2", async () => {
    await selectAll.uncheck();
    await checkbox103.check();
    await expect(checkbox103).toBeChecked();
    await expect(checkbox101).not.toBeChecked();
    await expect(checkbox102).not.toBeChecked();
    await expect(checkbox102).toBeDisabled();
    await expect(selectionSummary).toHaveText(/已选\s*1\s*项/);
  });

  await test.step("CASE_STEP_3", async () => {
    await expect(batchButton).toBeEnabled();
    await checkbox103.uncheck();
    await expect(selectionSummary).toHaveText(/已选\s*0\s*项/);
    await expect(batchButton).toBeDisabled();
  });
});
