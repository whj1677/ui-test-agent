import { test, expect } from "@playwright/test";

const LIST_TABLE = 'table[aria-label="工单结果"]';

// Resolve a column number from the table's header text so every cell
// assertion is bound to its business field label, not to a position guess.
async function columnIndex(table, headerName) {
  const headers = await table.locator("thead th").allTextContents();
  const idx = headers.findIndex((h) => h.trim() === headerName);
  if (idx < 0) throw new Error(`列表中不存在列: ${headerName}`);
  return idx + 1;
}

function columnCell(row, columnNumber) {
  return row.locator(`td:nth-child(${columnNumber})`);
}

// Identify a list row by its labelled business fields (e.g. 编号 + 区域).
async function rowMatching(table, fields) {
  let selector = "tbody tr";
  for (const [header, value] of Object.entries(fields)) {
    const idx = await columnIndex(table, header);
    selector += `:has(td:nth-child(${idx}):text-is(${JSON.stringify(value)}))`;
  }
  return table.locator(selector);
}

// Bind a detail-panel value to its term (dt) so the value element is
// identified by the field relationship, never by the expected answer.
function fieldValue(panel, label) {
  return panel.locator(`dt:text-is(${JSON.stringify(label)}) + dd`);
}

test("同名工单目标选择、详情页签及返回保留筛选", async ({ page }) => {
  const table = page.locator(LIST_TABLE);
  const rows = table.locator("tbody tr");
  const filterInput = page.getByRole("textbox", { name: "工单名称" });
  const searchButton = page.getByRole("button", { name: "筛选" });

  await test.step("CASE_STEP_1", async () => {
    await page.goto(process.env.PROBE_URL);

    await expect(page.getByRole("heading", { name: "工单台账" })).toBeVisible();
    await expect(page.locator('section[aria-label="工单列表"]')).toBeVisible();
    await expect(filterInput).toHaveValue("");
    await expect(rows).toHaveCount(3);

    const idCol = await columnIndex(table, "编号");
    await expect(columnCell(rows.nth(0), idCol)).toHaveText("WO-201");
    await expect(columnCell(rows.nth(1), idCol)).toHaveText("WO-202");
    await expect(columnCell(rows.nth(2), idCol)).toHaveText("WO-203");
  });

  await test.step("CASE_STEP_2", async () => {
    await filterInput.fill("巡检任务");
    await searchButton.click();

    await expect(rows).toHaveCount(2);

    const idCol = await columnIndex(table, "编号");
    const nameCol = await columnIndex(table, "名称");
    const areaCol = await columnIndex(table, "区域");
    const ownerCol = await columnIndex(table, "负责人");

    const first = rows.nth(0);
    await expect(columnCell(first, idCol)).toHaveText("WO-201");
    await expect(columnCell(first, nameCol)).toHaveText("巡检任务");
    await expect(columnCell(first, areaCol)).toHaveText("北区");
    await expect(columnCell(first, ownerCol)).toHaveText("林工");

    const second = rows.nth(1);
    await expect(columnCell(second, idCol)).toHaveText("WO-202");
    await expect(columnCell(second, nameCol)).toHaveText("巡检任务");
    await expect(columnCell(second, areaCol)).toHaveText("南区");
    await expect(columnCell(second, ownerCol)).toHaveText("林工");
  });

  await test.step("CASE_STEP_3", async () => {
    const targetRow = await rowMatching(table, { 编号: "WO-202", 区域: "南区" });
    await expect(targetRow).toHaveCount(1);
    await targetRow.getByRole("button", { name: "查看详情" }).click();

    await expect(page.getByRole("heading", { name: "工单详情" })).toBeVisible();

    const basicTab = page.getByRole("tab", { name: "基本信息" });
    await expect(basicTab).toHaveAttribute("aria-selected", "true");

    const basicPanel = page.getByRole("tabpanel", { name: "基本信息" });
    await expect(fieldValue(basicPanel, "工单编号")).toHaveText("WO-202");
    await expect(fieldValue(basicPanel, "名称")).toHaveText("巡检任务");
    await expect(fieldValue(basicPanel, "区域")).toHaveText("南区");
    await expect(fieldValue(basicPanel, "负责人")).toHaveText("林工");
    await expect(fieldValue(basicPanel, "优先级")).toHaveText("高");
  });

  await test.step("CASE_STEP_4", async () => {
    const basicTab = page.getByRole("tab", { name: "基本信息" });
    const recordTab = page.getByRole("tab", { name: "处理记录" });

    await recordTab.click();

    await expect(recordTab).toHaveAttribute("aria-selected", "true");
    await expect(basicTab).toHaveAttribute("aria-selected", "false");

    const recordPanel = page.getByRole("tabpanel", { name: "处理记录" });
    await expect(fieldValue(recordPanel, "工单编号")).toHaveText("WO-202");
    await expect(fieldValue(recordPanel, "最近处理人")).toHaveText("赵工");
    await expect(fieldValue(recordPanel, "处理结果")).toHaveText("等待备件");
  });

  await test.step("CASE_STEP_5", async () => {
    await page.getByRole("button", { name: "返回列表" }).click();

    await expect(page.getByRole("heading", { name: "工单台账" })).toBeVisible();
    await expect(filterInput).toHaveValue("巡检任务");
    await expect(rows).toHaveCount(2);

    const idCol = await columnIndex(table, "编号");
    const areaCol = await columnIndex(table, "区域");
    const ownerCol = await columnIndex(table, "负责人");

    const first = rows.nth(0);
    await expect(columnCell(first, idCol)).toHaveText("WO-201");
    await expect(columnCell(first, areaCol)).toHaveText("北区");
    await expect(columnCell(first, ownerCol)).toHaveText("林工");

    const second = rows.nth(1);
    await expect(columnCell(second, idCol)).toHaveText("WO-202");
    await expect(columnCell(second, areaCol)).toHaveText("南区");
    await expect(columnCell(second, ownerCol)).toHaveText("林工");
  });
});
