import { test, expect } from "@playwright/test";

test("KC-07 diag2: effect of demo data reset", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs += 1;
    dialog.accept();
  });
  await page.getByRole("button", { name: "重置演示数据" }).click();
  await page.waitForTimeout(1500);

  const statsText = await page.locator("main").first().innerText();
  const idle = await page.getByRole("checkbox", { name: "空闲" }).isChecked();
  const busy = await page.getByRole("checkbox", { name: "使用中" }).isChecked();
  const maint = await page.getByRole("checkbox", { name: "维护" }).isChecked();
  const deviceTable = page.getByRole("table", { name: "设备列表" });
  const ids = await deviceTable.locator("tbody tr td:nth-child(2)").allTextContents();
  const statuses = await deviceTable.locator("tbody tr td:nth-child(5)").allTextContents();

  expect(
    JSON.stringify({ dialogs, idle, busy, maint, ids, statuses, statsText: statsText.slice(0, 160) }),
  ).toBe("DIAG2");
});
