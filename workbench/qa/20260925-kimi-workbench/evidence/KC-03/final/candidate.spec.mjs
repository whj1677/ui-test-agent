import { test, expect } from "@playwright/test";

test("KC-03 同名温循箱搜索", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const main = page.getByRole("main");
  const searchBox = page.getByRole("searchbox", { name: "搜索编号或名称" });
  const deviceTable = page.getByRole("table", { name: "设备列表" });
  const dataRows = deviceTable.locator("tbody tr");

  // Bind a field value to the business object (the device row) that owns it.
  const rowByCode = (code) =>
    dataRows.filter({
      has: page.getByRole("cell", { name: code, exact: true }),
    });

  await test.step("CASE_STEP_1", async () => {
    await searchBox.fill("温循箱");

    // Only two devices named 温循箱 exist in the demo data.
    await expect(dataRows).toHaveCount(2);

    const row101 = rowByCode("EQ-101");
    const row104 = rowByCode("EQ-104");
    await expect(row101).toHaveCount(1);
    await expect(row104).toHaveCount(1);

    // The 编号, 名称 and 站点 of each row must belong to the same device.
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
  });

  await test.step("CASE_STEP_2", async () => {
    // The two rows carry distinct 编号 values EQ-101 and EQ-104.
    await expect(dataRows.locator("td:nth-child(2)")).toHaveText([
      "EQ-101",
      "EQ-104",
    ]);

    const row101 = rowByCode("EQ-101");
    const row104 = rowByCode("EQ-104");
    await expect(row101).toHaveCount(1);
    await expect(row104).toHaveCount(1);

    // Each 编号 is bound to its own station, so same-named devices are neither
    // merged into one row nor swapped/mixed with each other.
    await expect(
      row101.getByRole("cell", { name: "北站", exact: true }),
    ).toHaveCount(1);
    await expect(
      row101.getByRole("cell", { name: "南站", exact: true }),
    ).toHaveCount(0);
    await expect(
      row104.getByRole("cell", { name: "南站", exact: true }),
    ).toHaveCount(1);
    await expect(
      row104.getByRole("cell", { name: "北站", exact: true }),
    ).toHaveCount(0);
  });

  await test.step("CASE_STEP_3", async () => {
    // Select a row first so that the "filter change clears the selection"
    // behaviour is actually observable when the search is cleared.
    await rowByCode("EQ-101").getByRole("checkbox").check();
    await expect(main.getByText(/已选\s*1\s*项/)).toBeVisible();

    await searchBox.fill("");

    await expect(main.getByText(/共\s*8\s*条/)).toBeVisible();
    await expect(main.getByText(/已选\s*0\s*项/)).toBeVisible();
    await expect(main.getByText(/第\s*1\/3\s*页/)).toBeVisible();
    await expect(main.getByRole("button", { name: "上一页" })).toBeDisabled();
  });
});
