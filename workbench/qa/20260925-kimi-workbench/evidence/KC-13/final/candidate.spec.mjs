import { test, expect } from "@playwright/test";

// KC-13 预约历史按编号隔离
// 正常入口由任务绑定；本机合成数据；保留原始用例输入。
test("KC-13 预约历史按编号隔离", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  const drawer = page.getByRole("dialog");
  const drawerTitle = page.locator("#drawerTitle");
  const drawerBasic = page.locator("#drawerBasic");
  const historyPanel = page.locator("#tabPanel");
  const mask = page.locator("#mask");
  const devTable = page.getByRole("table", { name: "设备列表" });

  // Open a device detail drawer from the device list and confirm it shows that code.
  const openDeviceDetail = async (code) => {
    const row = devTable.locator("tbody tr").filter({ hasText: code });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "详情" }).click();
    await expect(drawer).toHaveClass(/\bopen\b/);
    await expect(drawerTitle).toHaveText(`设备详情 ${code}`);
  };

  // Switch the drawer to the 预约历史 tab and confirm the tab is the current selection.
  const openReservationHistory = async () => {
    await page.getByRole("tab", { name: "预约历史" }).click();
    await expect(page.locator("#tabHis")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#tabBasic")).toHaveAttribute("aria-selected", "false");
  };

  await test.step("CASE_STEP_1", async () => {
    // 打开EQ-103详情进入预约历史
    await openDeviceDetail("EQ-103");
    await openReservationHistory();

    // 含R-001：2026-10-10 10:00至12:00，申请人李明，用途精度校准，状态已确认
    const record = historyPanel.locator("p").filter({ has: page.locator("b") });
    await expect(record).toHaveCount(1);

    // 预约编号是这条记录的身份，先绑定记录再核对各字段。
    await expect(record.locator("b")).toHaveText("R-001");

    const recordText = (await record.innerText()).replace(/\s+/g, " ").trim();
    expect(recordText).toContain("2026-10-10 10:00至12:00");
    expect(recordText).toContain("李明");
    expect(recordText).toContain("精度校准");
    expect(recordText).toContain("已确认");
    expect(recordText).toBe("R-001 2026-10-10 10:00至12:00 李明 精度校准 已确认");
  });

  await test.step("CASE_STEP_2", async () => {
    // 关闭后打开EQ-106详情进入预约历史
    await page.locator("#drawerClose").click();
    await expect(drawer).not.toHaveClass(/\bopen\b/);
    await expect(mask).not.toHaveClass(/\bshow\b/);

    await page.getByRole("button", { name: "下一页" }).click();
    await expect(devTable.locator("tbody tr").filter({ hasText: "EQ-106" })).toHaveCount(1);
    await openDeviceDetail("EQ-106");

    // 虽同为示波器
    await expect(drawerBasic).toContainText("编号：EQ-106");
    await expect(drawerBasic).toContainText("名称：示波器");

    // 但显示无预约历史
    await openReservationHistory();
    await expect(historyPanel).toHaveText("无预约历史");
    await expect(historyPanel).not.toContainText("R-001");
  });

  await test.step("CASE_STEP_3", async () => {
    // 核对顶部统计：已确认预约为1，已确认收入40元
    const stats = page.getByRole("region", { name: "统计" });

    const confirmedCard = stats.locator(".card").filter({ hasText: "已确认预约" });
    const revenueCard = stats.locator(".card").filter({ hasText: "已确认收入" });
    await expect(confirmedCard).toHaveCount(1);
    await expect(revenueCard).toHaveCount(1);

    // 标签与数值分别绑定
    await expect(confirmedCard.locator("span")).toHaveText("已确认预约");
    await expect(confirmedCard.locator("b")).toHaveText("1");
    await expect(revenueCard.locator("span")).toHaveText("已确认收入");
    await expect(revenueCard.locator("b")).toHaveText("40");
  });
});
