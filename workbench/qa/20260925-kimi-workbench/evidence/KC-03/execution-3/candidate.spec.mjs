import { test, expect } from "@playwright/test";

// Temporary logic probe (not the candidate): run the candidate's step 2/3 logic
// with 使用中 also selected, i.e. the "all devices" state the frozen case assumes.
test("probe candidate logic with full status filter", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const main = page.getByRole("main");
  const searchBox = page.getByRole("searchbox", { name: "搜索编号或名称" });
  const deviceTable = page.getByRole("table", { name: "设备列表" });
  const dataRows = deviceTable.locator("tbody tr");
  const rowByCode = (code) =>
    dataRows.filter({
      has: page.getByRole("cell", { name: code, exact: true }),
    });

  const statusGroup = page.getByRole("group", { name: "状态多选" });
  await statusGroup.getByRole("checkbox", { name: "使用中" }).check();
  await statusGroup.getByRole("checkbox", { name: "维护" }).check();

  await searchBox.fill("温循箱");
  await expect(dataRows).toHaveCount(2);
  const row101 = rowByCode("EQ-101");
  const row104 = rowByCode("EQ-104");
  await expect(row101).toHaveCount(1);
  await expect(row104).toHaveCount(1);
  await expect(
    row101.getByRole("cell", { name: "温循箱", exact: true }),
  ).toHaveCount(1);
  await expect(
    row101.getByRole("cell", { name: "北站", exact: true }),
  ).toHaveCount(1);
  await expect(
    row104.getByRole("cell", { name: "温循箱", exact: true }),
  ).toHaveCount(1);
  await expect(
    row104.getByRole("cell", { name: "南站", exact: true }),
  ).toHaveCount(1);
  await expect(main.getByText(/共\s*2\s*条/)).toBeVisible();

  await expect(dataRows.locator("td:nth-child(2)")).toHaveText([
    "EQ-101",
    "EQ-104",
  ]);
  await expect(
    row101.getByRole("cell", { name: "南站", exact: true }),
  ).toHaveCount(0);
  await expect(
    row104.getByRole("cell", { name: "北站", exact: true }),
  ).toHaveCount(0);

  await rowByCode("EQ-101").getByRole("checkbox").check();
  await expect(main.getByText(/已选\s*1\s*项/)).toBeVisible();
  await searchBox.fill("");
  await expect(main.getByText(/共\s*8\s*条/)).toBeVisible();
  await expect(main.getByText(/已选\s*0\s*项/)).toBeVisible();
  await expect(main.getByText(/第\s*1\/3\s*页/)).toBeVisible();
  await expect(main.getByRole("button", { name: "上一页" })).toBeDisabled();
});
