import { test, expect } from "@playwright/test";

const ALL_IDS = ["P-101", "P-102", "P-203"];
const EMPTY_TEXT = "没有符合条件的设备";

function filterRegion(page) {
  return page.getByRole("region", { name: "设备筛选" });
}

function regionControl(page) {
  return filterRegion(page).getByRole("combobox", { name: "区域" });
}

function statusControl(page) {
  return filterRegion(page).getByRole("combobox", { name: "状态" });
}

function keywordControl(page) {
  return filterRegion(page).getByRole("textbox", { name: "设备关键字" });
}

function resultCount(page) {
  return filterRegion(page).getByRole("status", { name: "结果数量" });
}

function emptyMessage(page) {
  return filterRegion(page).getByText(EMPTY_TEXT, { exact: true });
}

function resultTable(page) {
  return filterRegion(page).getByRole("table", { name: "设备结果" });
}

function dataRows(page) {
  return resultTable(page).locator("tbody tr");
}

async function columnIndex(page, headerText) {
  const headers = resultTable(page).locator("thead th");
  const total = await headers.count();
  for (let i = 0; i < total; i += 1) {
    const text = (await headers.nth(i).innerText()).trim();
    if (text === headerText) {
      return i;
    }
  }
  throw new Error(`设备结果表缺少列头: ${headerText}`);
}

async function expectRowsInOrder(page, ids) {
  const rows = dataRows(page);
  await expect(rows).toHaveCount(ids.length);
  const codeColumn = await columnIndex(page, "设备编号");
  for (let i = 0; i < ids.length; i += 1) {
    await expect(rows.nth(i).locator("td").nth(codeColumn)).toHaveText(ids[i]);
  }
}

async function expectRowFields(page, rowIndex, expected) {
  const row = dataRows(page).nth(rowIndex);
  const columns = {
    设备编号: await columnIndex(page, "设备编号"),
    名称: await columnIndex(page, "名称"),
    区域: await columnIndex(page, "区域"),
    状态: await columnIndex(page, "状态"),
  };
  for (const label of Object.keys(expected)) {
    await expect(row.locator("td").nth(columns[label])).toHaveText(expected[label]);
  }
}

test("FRESH-A 自定义区域筛选、空结果与重置", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  await test.step("CASE_STEP_1", async () => {
    await expectRowsInOrder(page, ALL_IDS);
    await expect(regionControl(page)).toHaveText("全部区域");
    await expect(statusControl(page)).toHaveValue("全部状态");
    await expect(keywordControl(page)).toHaveValue("");
  });

  await test.step("CASE_STEP_2", async () => {
    await regionControl(page).click();
    await page.getByRole("option", { name: "南区", exact: true }).click();
    await expect(regionControl(page)).toHaveText("南区");
    await expect(dataRows(page)).toHaveCount(1);
    await expectRowFields(page, 0, {
      设备编号: "P-203",
      名称: "南站泵组",
      区域: "南区",
      状态: "启用",
    });
  });

  await test.step("CASE_STEP_3", async () => {
    await statusControl(page).selectOption({ label: "停用" });
    await expect(statusControl(page)).toHaveValue("停用");
    await expect(resultCount(page)).toHaveText("0条记录");
    await expect(emptyMessage(page)).toBeVisible();
    await expect(dataRows(page)).toHaveCount(0);
  });

  await test.step("CASE_STEP_4", async () => {
    await page.getByRole("button", { name: "重置" }).click();
    await expect(regionControl(page)).toHaveText("全部区域");
    await expect(statusControl(page)).toHaveValue("全部状态");
    await expect(keywordControl(page)).toHaveValue("");
    await expect(emptyMessage(page)).toBeHidden();
    await expectRowsInOrder(page, ALL_IDS);
  });

  await test.step("CASE_STEP_5", async () => {
    await keywordControl(page).fill("P-102");
    await expect(keywordControl(page)).toHaveValue("P-102");
    await page.getByRole("button", { name: "查询" }).click();
    await expect(dataRows(page)).toHaveCount(1);
    await expectRowFields(page, 0, {
      设备编号: "P-102",
      名称: "北站备用泵",
      区域: "北区",
      状态: "停用",
    });
  });
});
