import { test, expect } from "@playwright/test";

const DEVICE_TABLE = 'table[aria-label="设备列表"]';

async function readState(page) {
  const group = page.getByRole("group", { name: "状态多选" });
  const statuses = {
    idle: await group.getByRole("checkbox", { name: "空闲", exact: true }).isChecked(),
    busy: await group.getByRole("checkbox", { name: "使用中", exact: true }).isChecked(),
    maint: await group.getByRole("checkbox", { name: "维护", exact: true }).isChecked(),
  };
  const trigger = page.getByRole("button", { name: /^站点/ });
  const table = page.locator(DEVICE_TABLE);
  const ids = await table.locator("tbody tr td:nth-child(2)").allInnerTexts();
  const pager = await page
    .locator(
      'xpath=//table[@aria-label="设备列表"]/parent::div/following-sibling::*[contains(normalize-space(.), "共")]'
    )
    .innerText();
  return { statuses, site: (await trigger.innerText()).trim(), ids: ids.map((t) => t.trim()), pager: pager.replace(/\s+/g, "") };
}

test("probe reset effect", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  page.on("dialog", (dialog) => dialog.accept());

  const before = await readState(page);

  await page.getByRole("button", { name: "重置演示数据" }).click();
  await expect(page.getByRole("button", { name: "重置演示数据" })).toBeEnabled();
  await page.waitForTimeout(2500);

  const afterReset = await readState(page);

  await page.getByRole("button", { name: /^站点/ }).click();
  await page.getByRole("listbox", { name: "站点" }).getByRole("option", { name: "北站", exact: true }).click();
  const afterResetNorth = await readState(page);

  expect({ before, afterReset, afterResetNorth }).toEqual({
    before: { statuses: { idle: true, busy: false, maint: false }, site: "全部" },
    afterReset: { statuses: { idle: true, busy: false, maint: false }, site: "全部" },
    afterResetNorth: { statuses: { idle: true, busy: false, maint: false }, site: "北站", ids: ["EQ-101", "EQ-102", "EQ-105"] },
  });
});
