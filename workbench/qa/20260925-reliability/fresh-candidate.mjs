// KC-05 状态多选空闲或维护（设备预约调度 / 设备资源列表）
// 说明：全部断言限定在「设备资源」区域内，避免隐藏的「预约记录」面板干扰。
import { test, expect } from "@playwright/test";

const PANEL_NAME = "设备资源";
const TABLE_NAME = "设备列表";
const STATUS_GROUP_NAME = "状态多选";

const FREE = "空闲";
const IN_USE = "使用中";
const MAINTENANCE = "维护";
const ALL_STATUSES = [FREE, IN_USE, MAINTENANCE];

// 设备列表列：0 复选框 / 1 编号 / 2 名称 / 3 站点 / 4 状态 / 5 费用 / 6 操作
const CODE_COLUMN = 1;
const STATUS_COLUMN = 4;

function panel(page) {
  return page.getByRole("region", { name: PANEL_NAME });
}

function deviceTable(page) {
  return panel(page).getByRole("table", { name: TABLE_NAME });
}

function deviceRows(page) {
  return deviceTable(page).locator("tbody tr");
}

function cell(row, columnIndex) {
  return row.locator("td").nth(columnIndex);
}

function statusBox(page, label) {
  return panel(page)
    .getByRole("group", { name: STATUS_GROUP_NAME })
    .getByRole("checkbox", { name: label, exact: true });
}

function pageSummary(page) {
  return panel(page).getByText("每页3条");
}

function nextPageButton(page) {
  return panel(page).getByRole("button", { name: "下一页" });
}

// 读取「状态多选」中每个状态当前的实时勾选状态（checked 属性，而非初始 attribute）。
async function expectStatusSelection(page, expectedChecked) {
  for (const label of ALL_STATUSES) {
    const box = statusBox(page, label);
    if (expectedChecked.includes(label)) {
      await expect(box).toBeChecked();
    } else {
      await expect(box).not.toBeChecked();
    }
  }
}

// 断言结果总数与当前页码：形如「共 7 条，第 1/3 页，每页3条」。
async function expectPager(page, total, pageNumber, pageCount) {
  await expect(pageSummary(page)).toContainText(`共 ${total} 条`);
  await expect(pageSummary(page)).toContainText(`第 ${pageNumber}/${pageCount} 页`);
}

// expected: [{ code, status }]，按显示顺序逐行绑定「编号」列与「状态」列。
async function expectPageRows(page, expected) {
  const dataRows = deviceRows(page);
  await expect(dataRows).toHaveCount(expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    await expect(cell(dataRows.nth(index), CODE_COLUMN)).toHaveText(expected[index].code);
    await expect(cell(dataRows.nth(index), STATUS_COLUMN)).toHaveText(expected[index].status);
  }
}

async function readPageCodes(page) {
  const dataRows = deviceRows(page);
  const count = await dataRows.count();
  const codes = [];
  for (let index = 0; index < count; index += 1) {
    codes.push((await cell(dataRows.nth(index), CODE_COLUMN).textContent()).trim());
  }
  return codes;
}

test("KC-05 状态多选空闲或维护", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);
  await expect(deviceTable(page)).toBeVisible();

  await test.step("CASE_STEP_1", async () => {
    // 状态勾选空闲和维护，取消使用中
    await statusBox(page, FREE).check();
    await statusBox(page, MAINTENANCE).check();
    await statusBox(page, IN_USE).uncheck();

    // 当前选中状态为「空闲 + 维护」
    await expectStatusSelection(page, [FREE, MAINTENANCE]);

    // 空闲5条 + 维护2条 = 共7条；第1页为 101/102/103
    await expectPager(page, 7, 1, 3);
    await expectPageRows(page, [
      { code: "EQ-101", status: FREE },
      { code: "EQ-102", status: MAINTENANCE },
      { code: "EQ-103", status: FREE },
    ]);
  });

  await test.step("CASE_STEP_2", async () => {
    const visitedCodes = [];

    await expectPager(page, 7, 1, 3);
    await expectPageRows(page, [
      { code: "EQ-101", status: FREE },
      { code: "EQ-102", status: MAINTENANCE },
      { code: "EQ-103", status: FREE },
    ]);
    visitedCodes.push(...(await readPageCodes(page)));

    await nextPageButton(page).click();
    await expectPager(page, 7, 2, 3);
    await expectPageRows(page, [
      { code: "EQ-105", status: FREE },
      { code: "EQ-106", status: FREE },
      { code: "EQ-107", status: MAINTENANCE },
    ]);
    visitedCodes.push(...(await readPageCodes(page)));

    await nextPageButton(page).click();
    await expectPager(page, 7, 3, 3);
    await expectPageRows(page, [{ code: "EQ-108", status: FREE }]);
    visitedCodes.push(...(await readPageCodes(page)));

    // 3页浏览完毕后的完整结果：共7条，且不含使用中的 EQ-104
    expect(visitedCodes).toEqual([
      "EQ-101",
      "EQ-102",
      "EQ-103",
      "EQ-105",
      "EQ-106",
      "EQ-107",
      "EQ-108",
    ]);
  });

  await test.step("CASE_STEP_3", async () => {
    // 取消维护，仅留空闲
    await statusBox(page, MAINTENANCE).uncheck();

    await expectStatusSelection(page, [FREE]);
    await expectPager(page, 5, 1, 2);
    await expectPageRows(page, [
      { code: "EQ-101", status: FREE },
      { code: "EQ-103", status: FREE },
      { code: "EQ-105", status: FREE },
    ]);

    await nextPageButton(page).click();
    await expectPager(page, 5, 2, 2);
    await expectPageRows(page, [
      { code: "EQ-106", status: FREE },
      { code: "EQ-108", status: FREE },
    ]);
  });
});
