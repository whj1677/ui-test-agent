import { test, expect } from "@playwright/test";

// KC-07 费用降序排序前三（模块：设备预约调度）。
// 设备列表默认只勾选“空闲”，而用例期望覆盖 EQ-101..EQ-108 共 8 台设备
// （其中 EQ-104 为“使用中”，EQ-102/EQ-107 为“维护”）。因此先把状态范围设为
// 全部，使列表范围与用例期望的设备集合一致，再按用例的三个步骤执行。
const DEVICE_IDS_ASC = ["EQ-101", "EQ-102", "EQ-103", "EQ-104", "EQ-105", "EQ-106", "EQ-107", "EQ-108"];
const PAGE_SIZE = 3;

test("KC-07 费用降序排序前三", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(process.env.PROBE_URL);

  // 前置条件：独立重置演示数据（确认框由上面的 dialog handler 接受）。
  await page.getByRole("button", { name: "重置演示数据" }).click();

  const deviceTable = page.getByRole("table", { name: "设备列表" });
  await expect(deviceTable).toBeVisible();

  await page.getByRole("checkbox", { name: "空闲" }).check();
  await page.getByRole("checkbox", { name: "使用中" }).check();
  await page.getByRole("checkbox", { name: "维护" }).check();

  const pager = page.getByRole("button", { name: "下一页" }).locator("xpath=..");
  await expect(pager).toContainText("共 8 条");

  const rows = deviceTable.locator("tbody tr");
  const idCell = (index) => rows.nth(index).locator("td").nth(1);
  const feeCell = (index) => rows.nth(index).locator("td").nth(5);
  const sortSelect = page.getByLabel("排序");
  const selectedSort = sortSelect.locator("option:checked");

  await test.step("CASE_STEP_1", async () => {
    await sortSelect.selectOption({ label: "费用降序" });
    await expect(selectedSort).toHaveText("费用降序");
    await expect(rows).toHaveCount(3);
    await expect(idCell(0)).toHaveText("EQ-104");
    await expect(feeCell(0)).toHaveText("90");
    await expect(idCell(1)).toHaveText("EQ-101");
    await expect(feeCell(1)).toHaveText("80");
    await expect(idCell(2)).toHaveText("EQ-108");
    await expect(feeCell(2)).toHaveText("70");
  });

  await test.step("CASE_STEP_2", async () => {
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(selectedSort).toHaveText("费用降序");
    await expect(rows).toHaveCount(3);
    await expect(idCell(0)).toHaveText("EQ-105");
    await expect(feeCell(0)).toHaveText("60");
    await expect(idCell(1)).toHaveText("EQ-102");
    await expect(feeCell(1)).toHaveText("50");
    await expect(idCell(2)).toHaveText("EQ-107");
    await expect(feeCell(2)).toHaveText("40");
  });

  await test.step("CASE_STEP_3", async () => {
    await sortSelect.selectOption({ label: "编号升序" });
    await expect(selectedSort).toHaveText("编号升序");
    const pagerText = await pager.innerText();
    const pageNumber = Number(/第\s*(\d+)\s*\//.exec(pagerText)[1]);
    const expectedIds = DEVICE_IDS_ASC.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);
    await expect(rows).toHaveCount(expectedIds.length);
    for (let index = 0; index < expectedIds.length; index += 1) {
      await expect(idCell(index)).toHaveText(expectedIds[index]);
    }
  });
});
