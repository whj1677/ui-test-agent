import { test, expect } from "@playwright/test";

// Temporary diagnostic probe (not the candidate): observe the state produced by
// the frozen precondition "独立重置演示数据".
test("probe reset state", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "重置演示数据" }).click();

  const statusGroup = page.getByRole("group", { name: "状态多选" });
  const searchBox = page.getByRole("searchbox", { name: "搜索编号或名称" });
  const dataRows = page
    .getByRole("table", { name: "设备列表" })
    .locator("tbody tr");

  await expect
    .soft(statusGroup.getByRole("checkbox", { name: "空闲" }))
    .toBeChecked();
  await expect
    .soft(statusGroup.getByRole("checkbox", { name: "使用中" }))
    .toBeChecked();
  await expect
    .soft(statusGroup.getByRole("checkbox", { name: "维护" }))
    .toBeChecked();
  await expect.soft(dataRows).toHaveCount(8);

  await searchBox.fill("温循箱");
  await expect.soft(dataRows).toHaveCount(2);

  await searchBox.fill("");
  await expect.soft(dataRows).toHaveCount(8);
  await expect.soft(page.getByText(/共\s*8\s*条/)).toBeVisible();
});
