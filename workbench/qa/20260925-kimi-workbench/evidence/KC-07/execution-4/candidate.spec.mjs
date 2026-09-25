import { test, expect } from "@playwright/test";

test("KC-07 diag4: status checkbox semantics", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  const table = page.getByRole("table", { name: "设备列表" });
  const snapshotOf = async (tag) => {
    const idle = await page.getByRole("checkbox", { name: "空闲" }).isChecked();
    const busy = await page.getByRole("checkbox", { name: "使用中" }).isChecked();
    const maint = await page.getByRole("checkbox", { name: "维护" }).isChecked();
    const ids = await table.locator("tbody tr td:nth-child(2)").allTextContents();
    return tag + ":" + JSON.stringify({ idle, busy, maint, ids });
  };

  const log = [];
  log.push(await snapshotOf("init"));
  await page.getByRole("checkbox", { name: "使用中" }).check();
  log.push(await snapshotOf("busy"));
  await page.getByRole("checkbox", { name: "维护" }).check();
  log.push(await snapshotOf("maint"));
  await page.getByRole("checkbox", { name: "空闲" }).check();
  log.push(await snapshotOf("idle"));

  expect(JSON.stringify(log)).toBe("DIAG4");
});
