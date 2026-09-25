import { test, expect } from "@playwright/test";

test("KC-21 与R-001半开区间重叠冲突", async ({ page }) => {
  await page.goto(process.env.PROBE_URL);

  // 新建预约弹窗（另有一个隐藏的“设备详情”drawer，同为 role=dialog，故按标签 div 限定）
  const booking = page.locator('div[role="dialog"]');

  await test.step("CASE_STEP_1", async () => {
    // 选择 EQ-103
    const eq103 = page.getByRole("checkbox", { name: "选择EQ-103" });
    await eq103.check();
    await expect(eq103).toBeChecked();

    // 进入新建预约第 1 步（资源）
    await page.getByRole("button", { name: "批量预约" }).click();
    await expect(booking.getByRole("heading", { name: "新建预约" })).toBeVisible();
    await expect(booking.getByText("EQ-103 示波器 南站 20元/小时")).toBeVisible();

    // 到第 2 步（时间用途）
    await booking.getByRole("button", { name: "下一步" }).click();

    // 进入时间冲突校验：时间控件与半开区间冲突规则可见
    await expect(booking.getByLabel("开始整点")).toBeVisible();
    await expect(booking.getByLabel("结束整点")).toBeVisible();
    await expect(booking.getByText(/与已确认预约半开区间重叠禁止/)).toBeVisible();

    // 合法填写申请人赵六和用途复测验证
    await booking.getByLabel("申请人").fill("赵六");
    await booking.getByLabel("用途").fill("复测验证");
    await expect(booking.getByLabel("申请人")).toHaveValue("赵六");
    await expect(booking.getByLabel("用途")).toHaveValue("复测验证");
  });

  await test.step("CASE_STEP_2", async () => {
    // 设置 2026-10-10 11:00 到 13:00
    await booking.getByLabel("日期").fill("2026-10-10");
    await expect(booking.getByLabel("日期")).toHaveValue("2026-10-10");

    await booking.getByLabel("开始整点").selectOption({ label: "11:00" });
    await booking.getByLabel("结束整点").selectOption({ label: "13:00" });
    await expect(booking.getByLabel("开始整点").locator("option:checked")).toHaveText("11:00");
    await expect(booking.getByLabel("结束整点").locator("option:checked")).toHaveText("13:00");

    await booking.getByRole("button", { name: "下一步" }).click();

    // 与 R-001 的 10:00-12:00 半开区间重叠：提示冲突并拒绝
    const feedback = booking.locator('[aria-live="assertive"]');
    await expect(feedback).toContainText("冲突");
    await expect(feedback).toContainText("R-001");
    await expect(booking.getByRole("heading", { name: "确认信息" })).toBeHidden();
    await expect(booking.getByRole("button", { name: "确认预约" })).toBeHidden();
    await expect(booking.getByLabel("开始整点")).toBeVisible();
  });

  await test.step("CASE_STEP_3", async () => {
    // 改为 09:00 到 10:00
    await booking.getByLabel("开始整点").selectOption({ label: "09:00" });
    await booking.getByLabel("结束整点").selectOption({ label: "10:00" });
    await expect(booking.getByLabel("开始整点").locator("option:checked")).toHaveText("09:00");
    await expect(booking.getByLabel("结束整点").locator("option:checked")).toHaveText("10:00");

    await booking.getByRole("button", { name: "下一步" }).click();

    // 结束紧接 R-001 开始，不重叠，允许进入确认
    await expect(booking.getByRole("heading", { name: "确认信息" })).toBeVisible();
    await expect(booking.getByRole("button", { name: "确认预约" })).toBeVisible();
    await expect(booking.locator("#confirmBox")).toContainText("2026-10-10 09:00-10:00");
  });
});
