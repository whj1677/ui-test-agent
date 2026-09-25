import { test, expect } from "@playwright/test";

test("KC-07 diagnostic: state after demo reset", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "重置演示数据" }).click();
  await expect(page.getByRole("button", { name: "重置演示数据" })).toBeVisible();
  const deviceTable = page.getByRole("table", { name: "设备列表" });
  const ids = await deviceTable.locator("tbody tr td:nth-child(2)").allTextContents();
  const fees = await deviceTable.locator("tbody tr td:nth-child(6)").allTextContents();
  const idle = await page.getByRole("checkbox", { name: "空闲" }).isChecked();
  const busy = await page.getByRole("checkbox", { name: "使用中" }).isChecked();
  const maint = await page.getByRole("checkbox", { name: "维护" }).isChecked();
  const pagerText = await page.locator("text=/共 .* 条/").first().textContent();
  expect(JSON.stringify({ ids, fees, idle, busy, maint, pagerText })).toBe("DUMP");
});
