import { test, expect } from "@playwright/test";

test("KC-07 diag3: reset vs status filter", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(process.env.PROBE_URL);

  const table = page.getByRole("table", { name: "设备列表" });
  await page.getByRole("checkbox", { name: "使用中" }).check();
  await page.getByRole("checkbox", { name: "维护" }).check();
  await expect(table.locator("tbody tr")).toHaveCount(8);
  const before = await table.locator("tbody tr").count();

  await page.getByRole("button", { name: "重置演示数据" }).click();
  const started = Date.now();
  let settled = "no-change";
  try {
    await expect(table.locator("tbody tr")).toHaveCount(5, { timeout: 8000 });
    settled = "dropped-to-5";
  } catch {
    settled = "stayed";
  }
  const elapsedMs = Date.now() - started;

  const idle = await page.getByRole("checkbox", { name: "空闲" }).isChecked();
  const busy = await page.getByRole("checkbox", { name: "使用中" }).isChecked();
  const maint = await page.getByRole("checkbox", { name: "维护" }).isChecked();
  const after = await table.locator("tbody tr").count();

  expect(JSON.stringify({ before, settled, elapsedMs, idle, busy, maint, after })).toBe("DIAG3");
});
