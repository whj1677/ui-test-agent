import { test, expect } from "@playwright/test";

const DEVICE_TABLE = 'table[aria-label="设备列表"]';

function deviceTable(page) {
  return page.locator(DEVICE_TABLE);
}

function deviceRows(page) {
  return deviceTable(page).locator("tbody tr");
}

function siteTrigger(page) {
  return page.getByRole("button", { name: /^站点/ });
}

function statusCheckbox(page, label) {
  return page
    .getByRole("group", { name: "状态多选" })
    .getByRole("checkbox", { name: label, exact: true });
}

function listPager(page) {
  return page.locator(
    'xpath=//table[@aria-label="设备列表"]/parent::div/following-sibling::*[contains(normalize-space(.), "共")]'
  );
}

async function selectSite(page, siteLabel) {
  const trigger = siteTrigger(page);
  await trigger.click();
  const listbox = page.getByRole("listbox", { name: "站点" });
  await expect.soft(listbox).toBeVisible();
  await listbox.getByRole("option", { name: siteLabel, exact: true }).click();
  // 站点 field value must reflect the chosen option immediately.
  await expect.soft(trigger).toHaveText(siteLabel);
}

async function setStatus(page, label, checked) {
  const box = statusCheckbox(page, label);
  if ((await box.isChecked()) !== checked) {
    await box.click();
  }
  // Live selection state after the change (not the initial [checked] attribute).
  if (checked) {
    await expect.soft(box).toBeChecked();
  } else {
    await expect.soft(box).not.toBeChecked();
  }
}

async function expectDeviceList(page, site, ids, total) {
  const table = deviceTable(page);
  await expect.soft(table).toBeVisible();

  const rows = deviceRows(page);
  await expect.soft(rows).toHaveCount(ids.length);

  const headers = (await table.getByRole("columnheader").allInnerTexts()).map((text) => text.trim());
  const idIndex = headers.indexOf("编号");
  const siteIndex = headers.indexOf("站点");
  expect.soft(idIndex).toBeGreaterThanOrEqual(0);
  expect.soft(siteIndex).toBeGreaterThanOrEqual(0);

  if (idIndex >= 0 && siteIndex >= 0) {
    for (let i = 0; i < ids.length; i += 1) {
      const cells = rows.nth(i).getByRole("cell");
      await expect.soft(cells.nth(idIndex)).toHaveText(ids[i]);
      await expect.soft(cells.nth(siteIndex)).toHaveText(site);
    }
  }

  const pager = listPager(page);
  await expect.soft(pager).toContainText(new RegExp(`共\\s*${total}\\s*条`));
  await expect.soft(pager).toContainText(/第\s*1\s*\/\s*\d+\s*页/);
}

test("KC-04 站点与状态AND组合筛选", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  await test.step("CASE_STEP_1", async () => {
    await selectSite(page, "北站");
    await expectDeviceList(page, "北站", ["EQ-101", "EQ-102", "EQ-105"], 3);
  });

  await test.step("CASE_STEP_2", async () => {
    await setStatus(page, "空闲", true);
    await setStatus(page, "使用中", false);
    await setStatus(page, "维护", false);
    await expectDeviceList(page, "北站", ["EQ-101", "EQ-105"], 2);
  });

  await test.step("CASE_STEP_3", async () => {
    await setStatus(page, "维护", true);
    await setStatus(page, "空闲", true);
    await setStatus(page, "使用中", false);
    await expectDeviceList(page, "北站", ["EQ-101", "EQ-102", "EQ-105"], 3);
  });
});
