import { test, expect } from "@playwright/test";

// KC-01 初始数据与三页分页边界（设备资源分页）

// 依据表头“编号”列的位置读取编号单元格，逐字段绑定而不是用期望值搜索。
async function deviceIdColumnIndex(table) {
  const headers = table.locator("thead th");
  const count = await headers.count();
  for (let i = 0; i < count; i++) {
    const label = (await headers.nth(i).innerText()).trim();
    if (label === "编号") return i;
  }
  throw new Error("未找到“编号”列表头");
}

async function readPageDeviceIds(page) {
  const table = page.getByRole("table", { name: "设备列表" });
  const idIndex = await deviceIdColumnIndex(table);
  const rows = page.locator("#devBody tr");
  const count = await rows.count();
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push((await rows.nth(i).locator("td").nth(idIndex).innerText()).trim());
  }
  return ids;
}

const pageInfo = (page) => page.locator("#pageInfo");
const prevButton = (page) => page.getByRole("button", { name: "上一页" });
const nextButton = (page) => page.getByRole("button", { name: "下一页" });

test("KC-01 初始数据与三页分页边界", async ({ page }) => {
  await test.step("CASE_STEP_1", async () => {
    await page.goto(process.env.PROBE_URL);

    // 打开页面并确认已重置演示数据命名空间
    const [dialog] = await Promise.all([
      page.waitForEvent("dialog"),
      page.getByRole("button", { name: "重置演示数据" }).click(),
    ]);
    await dialog.accept();

    // 重置后回到初始种子数据：1 条已确认预约、收入 40
    await expect(page.locator("#statConf")).toHaveText("1");
    await expect(page.locator("#statFee")).toHaveText("40");

    // 状态多选默认仅勾选“空闲”，勾选全部状态以查看完整设备资源列表
    const idle = page.getByRole("checkbox", { name: "空闲" });
    const busy = page.getByRole("checkbox", { name: "使用中" });
    const maint = page.getByRole("checkbox", { name: "维护" });
    await idle.check();
    await busy.check();
    await maint.check();
    await expect(idle).toBeChecked();
    await expect(busy).toBeChecked();
    await expect(maint).toBeChecked();

    // 共8条、每页3条、第1/3页、总数8
    await expect(pageInfo(page)).toHaveText(/共\s*8\s*条/);
    await expect(pageInfo(page)).toHaveText(/第\s*1\/3\s*页/);
    await expect(pageInfo(page)).toHaveText(/每页\s*3\s*条/);

    // 第1页显示 EQ-101/102/103（编号升序）
    expect(await readPageDeviceIds(page)).toEqual(["EQ-101", "EQ-102", "EQ-103"]);
    await expect(prevButton(page)).toBeDisabled();
    await expect(nextButton(page)).toBeEnabled();
  });

  await test.step("CASE_STEP_2", async () => {
    await nextButton(page).click();

    await expect(pageInfo(page)).toHaveText(/第\s*2\/3\s*页/);
    // 显示 EQ-104/105/106
    expect(await readPageDeviceIds(page)).toEqual(["EQ-104", "EQ-105", "EQ-106"]);
    // 上一页可用
    await expect(prevButton(page)).toBeEnabled();
  });

  await test.step("CASE_STEP_3", async () => {
    await nextButton(page).click();

    await expect(pageInfo(page)).toHaveText(/第\s*3\/3\s*页/);
    // 显示 EQ-107/108
    expect(await readPageDeviceIds(page)).toEqual(["EQ-107", "EQ-108"]);
    // 下一页禁用
    await expect(nextButton(page)).toBeDisabled();

    // 尝试继续下一页：仍停留在第3页
    await nextButton(page).click({ force: true });
    await expect(pageInfo(page)).toHaveText(/第\s*3\/3\s*页/);
    expect(await readPageDeviceIds(page)).toEqual(["EQ-107", "EQ-108"]);

    // 返回第1页后上一页禁用
    await prevButton(page).click();
    await expect(pageInfo(page)).toHaveText(/第\s*2\/3\s*页/);
    await prevButton(page).click();
    await expect(pageInfo(page)).toHaveText(/第\s*1\/3\s*页/);
    expect(await readPageDeviceIds(page)).toEqual(["EQ-101", "EQ-102", "EQ-103"]);
    await expect(prevButton(page)).toBeDisabled();
  });
});
